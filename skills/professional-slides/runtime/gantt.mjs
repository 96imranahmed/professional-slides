// Project plan (gantt): a period header (optionally under a year tier), a
// label column with filled group cells, bars with in-bar labels, milestone
// diamonds and a "today" line. The galleries' most repeated planning page.
//
// props: {
//   periods: ["Jan", "Feb", ...],            // column labels, equal width
//   tiers?: [{ label: "2024", from: 0, to: 9 }],   // optional band above the periods (inclusive indices)
//   groups?: [{ name, rows: [row] }],         // or rows: [row] without groups
//   rows?: [{ label, from, to, text?, milestones?: [{ at, label? }], tone?: "primary"|"secondary"|"accent" }],
//   today?: 4.5,                              // period index (fractional) for the vertical line
//   labelWidth?: px
// }
import { token, tokenValue, stableId, textPrimitive, rectPrimitive, linePrimitive, shapePrimitive } from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { measureAt, fillRect } from "./draw.mjs";

const v = (id) => tokenValue(token(id));
const INK = token("color.ink"), WHITE = token("color.onPrimary"), PRIMARY = token("color.componentPrimary"), SECOND = token("color.chartSeries2"), ACCENT = token("color.accent");
const RULE = token("color.rule"), MUTED = token("color.surfaceMuted"), GREY = token("color.textSecondary"), FONT = token("font.body");
export const GANTT_TOKENS = Object.freeze(["color.ink", "color.onPrimary", "color.componentPrimary", "color.chartSeries2", "color.accent", "color.rule", "color.surfaceMuted", "color.textSecondary", "font.body", "type.body", "type.compact", "type.label", "space.1", "space.2", "space.3", "space.4", "line.hairline", "line.standard", "radius.none", "radius.small"]);

const measure = (text, width, size = "type.compact", bold = false) => measureAt(text, width, { size, bold });
const style = (size, color = INK, bold = false, align = "left") => ({ fontFamily: FONT, fontSize: token(size), color, bold, align, valign: "top", wrap: false });
const text = (id, role, frame, layout, st, data = {}) => textPrimitive({ id, role, frame: { ...frame, height: layout.height }, text: layout.text, style: { ...st, lineHeight: layout.lineHeight }, data: { ...data, textLayout: layout } });
const rect = (id, role, frame, fill, radius = "radius.none", data = {}) => fillRect(id, role, frame, fill, { radius, data });
const rule = (id, x1, y1, x2, y2, stroke = RULE, data = {}) => linePrimitive({ id, role: "gantt-rule", x1, y1, x2, y2, style: { stroke, lineWidth: token("line.hairline") }, data });

function normalize(props) {
  if (!Array.isArray(props.periods) || props.periods.length < 2) throw new Error("Gantt requires at least two periods");
  const groups = Array.isArray(props.groups) && props.groups.length ? props.groups : [{ name: null, rows: props.rows || [] }];
  const rows = [];
  groups.forEach((g, gi) => {
    if (!Array.isArray(g.rows) || !g.rows.length) throw new Error(`Gantt group ${gi + 1} needs rows`);
    g.rows.forEach((r, ri) => {
      if (!r || typeof r.label !== "string" || !r.label.trim()) throw new Error(`Gantt row ${ri + 1} in group ${gi + 1} requires a label`);
      if (!(Number.isFinite(r.from) && Number.isFinite(r.to) && r.from >= 0 && r.to <= props.periods.length && r.to > r.from)) throw new Error(`Gantt row "${r.label}" needs from < to within the periods (${props.periods.length})`);
      rows.push({ ...r, group: gi, first: ri === 0, count: g.rows.length, tone: r.tone ?? (gi % 2 ? "secondary" : "primary"), milestones: Array.isArray(r.milestones) ? r.milestones : [] });
    });
  });
  if (rows.length > 14) throw new Error("Gantt carries at most 14 rows on one page; split the plan");
  return { groups, rows };
}

export function ganttLayout(frame, props) {
  const { groups, rows } = normalize(props);
  const hasGroups = groups.some((g) => g.name);
  const groupWidth = hasGroups ? Math.max(v("space.4") * 5, ...groups.map((g) => g.name ? Math.ceil(measure(g.name, 400, "type.compact", true).width) + 2 * v("space.2") : 0)) : 0;
  const labelWidth = props.labelWidth ?? Math.max(120, frame.width * 0.18);
  const left = frame.x + groupWidth + (hasGroups ? v("space.2") : 0) + labelWidth + v("space.2");
  const gridWidth = frame.x + frame.width - left;
  const cell = gridWidth / props.periods.length;
  if (cell < 22) throw new Error("Gantt period cells are too narrow; use fewer periods");
  const tierHeight = Array.isArray(props.tiers) && props.tiers.length ? measure("X", cell, "type.label", true).height + v("space.1") : 0;
  const headerHeight = measure("X", cell, "type.label", true).height + v("space.2");
  const labels = rows.map((r) => measure(r.label, labelWidth, "type.compact", false));
  const natural = labels.map((l) => Math.max(v("space.4") + v("space.3"), l.height + v("space.2")));
  const todayRow = Number.isFinite(props.today) ? measure("Today", 100, "type.label", true).height + v("space.1") : 0;
  const naturalHeight = tierHeight + headerHeight + natural.reduce((a, b) => a + b, 0) + todayRow;
  const available = frame.height - tierHeight - headerHeight - todayRow;
  const total = natural.reduce((a, b) => a + b, 0);
  // Rows stretch to fill the frame up to twice their natural height.
  const scale = available > total ? Math.min(2, available / total) : 1;
  const heights = natural.map((h) => h * scale);
  return { groups, rows, hasGroups, groupWidth, labelWidth, left, gridWidth, cell, tierHeight, headerHeight, labels, heights, height: tierHeight + headerHeight + heights.reduce((a, b) => a + b, 0), todayRow, naturalHeight };
}

// Where a milestone's label sits (the rule `ganttNodes` draws it by): after
// its diamond when it fits before the grid's edge, otherwise before it.
function milestoneLabelSpan(L, ms, gridRight) {
  const mx = L.left + ms.at * L.cell, size = v("space.3");
  const lm = measure(ms.label, L.cell * 2, "type.label", false);
  const fits = mx + size / 2 + v("space.1") + lm.width <= gridRight;
  return fits ? [mx + size / 2 + v("space.1"), mx + size / 2 + v("space.1") + lm.width] : [mx - size / 2 - v("space.1") - lm.width, mx - size / 2 - v("space.1")];
}

/**
 * Where a bar's own label goes, measured against everything else on its row.
 *
 * The label was set inside the bar whenever it fitted the bar's width, with
 * nothing looking at what else crossed the bar: on the Emirates 777X plan the
 * dashed Today line ran through "None in service" so that it read "Now in
 * service", and a milestone diamond or its label at the bar's end could land
 * on the text the same way. The row's marks are now obstacles - the Today
 * line, each milestone diamond and each milestone label - and the label takes
 * the first place it fits on one line clear of all of them: inside the bar
 * (white, bold) in the first clear stretch, else after the bar, else before
 * it (grey). A label with no clear place is still set inside the bar, as it
 * was, rather than dropped.
 */
function barLabelPlacement(L, row, bx, bw, x0, gridRight, props) {
  const pad = v("space.2"), clear = v("space.1");
  const obstacles = [];
  if (Number.isFinite(props.today)) { const tx = x0 + props.today * L.cell; obstacles.push([tx - clear, tx + clear]); }
  for (const ms of row.milestones) {
    if (!Number.isFinite(ms.at)) continue;
    const mx = x0 + ms.at * L.cell, size = v("space.3");
    obstacles.push([mx - size / 2 - clear, mx + size / 2 + clear]);
    if (ms.label) { const [a, b] = milestoneLabelSpan(L, ms, gridRight); obstacles.push([a - clear, b + clear]); }
  }
  // The clear stretches of [from, to] once the obstacles are cut out of it.
  const clearOf = (from, to) => {
    let spans = [[from, to]];
    for (const [a, b] of obstacles) spans = spans.flatMap(([s, e]) => b <= s || a >= e ? [[s, e]] : [[s, Math.min(e, a)], [Math.max(s, b), e]].filter(([p, q]) => q - p > 0));
    return spans;
  };
  const single = (bold) => measure(row.text, 100000, "type.label", bold).width;
  const insideWidth = single(true), outsideWidth = single(false);
  const inside = clearOf(bx + pad, bx + bw - pad).find(([s, e]) => e - s >= insideWidth);
  if (inside) return { x: inside[0], width: inside[1] - inside[0], layout: measure(row.text, inside[1] - inside[0], "type.label", true), inside: true, align: "left" };
  const after = clearOf(bx + bw + pad, gridRight)[0];
  if (after && after[0] <= bx + bw + pad + 0.01 && after[1] - after[0] >= outsideWidth) return { x: after[0], width: after[1] - after[0], layout: measure(row.text, after[1] - after[0], "type.label", false), inside: false, align: "left" };
  const before = clearOf(x0, bx - pad).at(-1);
  if (before && before[1] >= bx - pad - 0.01 && before[1] - before[0] >= outsideWidth) return { x: before[0], width: before[1] - before[0], layout: measure(row.text, before[1] - before[0], "type.label", false), inside: false, align: "right" };
  const fallback = measure(row.text, bw - 2 * pad, "type.label", true);
  return fallback.lines.length === 1 ? { x: bx + pad, width: bw - 2 * pad, layout: fallback, inside: true, align: "left" } : null;
}

export function ganttNodes({ id, frame, props }) {
  const L = ganttLayout(frame, props);
  const valign = props.valign ?? "middle";
  if (!["top", "middle", "bottom"].includes(valign)) throw new Error("Gantt valign must be top, middle or bottom");
  if (L.naturalHeight > frame.height + 0.01) throw new Error(`Gantt needs ${Math.ceil(L.naturalHeight)}px but has ${frame.height}px; split the plan`);
  const nodes = [];
  const x0 = L.left, gridRight = frame.x + frame.width;
  // Keep the measured schedule together when capped row growth leaves spare
  // height. Reserve the optional Today caption in the same centred group.
  const spare = Math.max(0, frame.height - L.height - L.todayRow);
  let y = frame.y + (valign === "middle" ? spare / 2 : valign === "bottom" ? spare : 0);
  // Year tier
  if (L.tierHeight) {
    for (const [i, tier] of props.tiers.entries()) {
      const tx = x0 + tier.from * L.cell, tw = (tier.to - tier.from + 1) * L.cell;
      const m = measure(tier.label, tw, "type.label", true);
      nodes.push(text(stableId(id, "tier", i), "gantt-tier", { x: tx, y, width: tw - v("space.1") }, m, style("type.label", GREY, true, "left")));
      nodes.push(rule(stableId(id, "tier-rule", i), tx, y + L.tierHeight - 2, tx + tw - v("space.1"), y + L.tierHeight - 2));
    }
    y += L.tierHeight;
  }
  // Period header
  nodes.push(rect(stableId(id, "header-band"), "gantt-header", { x: x0, y, width: L.gridWidth, height: L.headerHeight }, MUTED));
  props.periods.forEach((p, i) => {
    const m = measure(p, L.cell, "type.label", true);
    nodes.push(text(stableId(id, "period", i), "gantt-period", { x: x0 + i * L.cell, y: y + v("space.1"), width: L.cell }, m, style("type.label", INK, true, "center")));
  });
  y += L.headerHeight;
  const bodyTop = y;
  const bodyBottom = bodyTop + L.heights.reduce((a, b) => a + b, 0);
  // Period gridlines (light) behind the bars
  for (let i = 1; i < props.periods.length; i += 1) nodes.push(rule(stableId(id, "grid", i), x0 + i * L.cell, bodyTop, x0 + i * L.cell, bodyBottom, MUTED, { period: i }));
  // Rows
  L.rows.forEach((row, r) => {
    const h = L.heights[r], rid = stableId(id, "row", r);
    const mid = y + h / 2;
    // group cell (filled, spans the group's rows)
    if (L.hasGroups && row.first && L.groups[row.group].name) {
      const gh = L.heights.slice(r, r + row.count).reduce((a, b) => a + b, 0);
      nodes.push(rect(stableId(id, "group", row.group), "gantt-group", { x: frame.x, y: y + 1, width: L.groupWidth, height: gh - 2 }, row.group % 2 ? SECOND : PRIMARY, "radius.none", { group: row.group }));
      const gm = measure(L.groups[row.group].name, L.groupWidth - 2 * v("space.2"), "type.compact", true);
      nodes.push(text(stableId(id, "group-label", row.group), "gantt-group-label", { x: frame.x + v("space.2"), y: y + (gh - gm.height) / 2, width: L.groupWidth - 2 * v("space.2") }, gm, style("type.compact", WHITE, true, "center")));
    }
    // label
    const lx = frame.x + (L.hasGroups ? L.groupWidth + v("space.2") : 0);
    nodes.push(text(rid + ":label", "gantt-label", { x: lx, y: mid - L.labels[r].height / 2, width: L.labelWidth }, L.labels[r], style("type.compact", INK, false, "left"), { row: r }));
    // bar
    const bx = x0 + row.from * L.cell, bw = (row.to - row.from) * L.cell;
    const barH = Math.min(h - v("space.2"), v("space.4") + v("space.1"));
    const fill = row.tone === "accent" ? ACCENT : row.tone === "secondary" ? SECOND : PRIMARY;
    nodes.push(rect(rid + ":bar", "gantt-bar", { x: bx + 1, y: mid - barH / 2, width: bw - 2, height: barH }, fill, "radius.small", { row: r, from: row.from, to: row.to }));
    if (row.text) {
      const placed = barLabelPlacement(L, row, bx, bw, x0, gridRight, props);
      if (placed) nodes.push(text(rid + ":text", "gantt-bar-label", { x: placed.x, y: mid - placed.layout.height / 2, width: placed.width }, placed.layout, style("type.label", placed.inside ? WHITE : GREY, placed.inside, placed.align), { row: r, placement: placed.inside ? "inside" : placed.align === "right" ? "before" : "after" }));
    }
    // milestones
    row.milestones.forEach((ms, k) => {
      if (!(Number.isFinite(ms.at) && ms.at >= 0 && ms.at <= props.periods.length)) throw new Error(`Gantt milestone ${k + 1} on "${row.label}" is outside the periods`);
      const mx = x0 + ms.at * L.cell, size = v("space.3");
      nodes.push(shapePrimitive({ id: rid + `:milestone-${k}`, role: "gantt-milestone", geometry: "diamond", frame: { x: mx - size / 2, y: mid - size / 2, width: size, height: size }, style: { fill: ACCENT, stroke: WHITE, lineWidth: token("line.hairline"), radius: token("radius.none") }, data: { row: r, at: ms.at } }));
      if (ms.label) {
        const lm = measure(ms.label, L.cell * 2, "type.label", false);
        const fits = mx + size / 2 + v("space.1") + lm.width <= gridRight;
        const lx2 = fits ? mx + size / 2 + v("space.1") : mx - size / 2 - v("space.1") - L.cell * 2;
        nodes.push(text(rid + `:milestone-label-${k}`, "gantt-milestone-label", { x: lx2, y: mid - lm.height / 2, width: L.cell * 2 }, lm, style("type.label", GREY, false, fits ? "left" : "right"), { row: r }));
      }
    });
    nodes.push(rule(rid + ":rule", lx, y + h, gridRight, y + h));
    y += h;
  });
  // Today line, labelled under the grid
  if (Number.isFinite(props.today)) {
    const tx = x0 + props.today * L.cell;
    nodes.push(linePrimitive({ id: stableId(id, "today"), role: "gantt-today", x1: tx, y1: bodyTop, x2: tx, y2: y, style: { stroke: ACCENT, lineWidth: token("line.standard"), dash: "dash" }, data: { today: props.today } }));
    const tm = measure("Today", L.cell * 2, "type.label", true);
    if (y + v("space.1") + tm.height <= frame.y + frame.height) nodes.push(text(stableId(id, "today-label"), "gantt-today-label", { x: tx - L.cell, y: y + v("space.1"), width: L.cell * 2 }, tm, style("type.label", ACCENT, true, "center")));
  }
  return nodes;
}

export function registerGantt(registry) {
  registry.set("gantt", {
    id: "gantt", version: "1.0.0", category: "relationship", role: "gantt", tokens: [...GANTT_TOKENS], preferredSize: { width: 1160, height: 420 },
    sample: { periods: ["M1", "M2", "M3", "M4", "M5", "M6"], groups: [{ name: "Phase 1", rows: [{ label: "(Insert workstream)", from: 0, to: 2, text: "(Insert activity)" }, { label: "(Insert workstream)", from: 1, to: 3 }] }, { name: "Phase 2", rows: [{ label: "(Insert workstream)", from: 3, to: 6, milestones: [{ at: 6, label: "Go-live" }] }] }], today: 2.5 },
    render: (input) => ({ nodes: ganttNodes(input) }),
    measureContent: ({ frame, props }) => ({ height: ganttLayout({ ...frame, height: Number.MAX_SAFE_INTEGER / 4 }, props).naturalHeight }),
    // Rows grow to twice their natural height and the schedule then centres
    // in whatever is left, which under a full-width plan put the spare above
    // and below it - a gap between the plan and its commentary. The column
    // gives it the grown height and keeps the rest as the page's margin.
    measureCeiling: ({ frame, props }) => { const L = ganttLayout(frame, props); return L.height + L.todayRow; },
    guidance: { useWhen: "a plan with dated workstreams, phases and milestones on one calendar", why: "bars on one time axis make sequence, overlap and slack visible at a glance", actionTitle: "state the critical path and the date it protects" }
  });
  return registry;
}
