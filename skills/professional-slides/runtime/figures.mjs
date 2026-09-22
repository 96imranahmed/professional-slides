// Ten figure families the reference corpus uses and the skill could not draw.
//
// A 400-page sample of the corpus (evals/corpus/styles) was classified into 85
// design styles and each probed against the runtime. These are the diagram and
// statistic styles that had no component: a column of large statistics, a
// flowchart, spectrum sliders, a layer stack, items placed into category
// columns, a rank table across periods, a two-sided flow, an icon array, rows
// carried by arrows and a row of capsule pillars. Each is drawn from the
// primitives every other component uses, so the PowerPoint emitter and the
// HTML renderer need nothing new, and each measures itself and refuses content
// it cannot set rather than overflowing.
import { token, tokenValue, stableId, rectPrimitive, ellipsePrimitive, linePrimitive, shapePrimitive } from "./core.mjs";
import { MARK_TOKENS, numberMarker, iconMarker } from "./marks.mjs";
import { measureAt, fillRect, measuredLabel } from "./draw.mjs";

const PRIMARY = token("color.componentPrimary"), ACCENT = token("color.accent"), INK = token("color.ink");
const WHITE = token("color.onPrimary"), SECONDARY = token("color.textSecondary"), RULE = token("color.rule");
const MUTED = token("color.surfaceMuted"), TINT = token("color.accentTint");
const FONT = token("font.body"), DISPLAY = token("font.display");
const v = (id) => tokenValue(token(id));

export const FIGURE_TOKENS = Object.freeze([...new Set([...MARK_TOKENS,
  "color.componentPrimary", "color.accent", "color.accentTint", "color.ink", "color.onPrimary", "color.textSecondary",
  "color.rule", "color.surfaceMuted", "font.body", "font.display", "type.metric", "type.heading", "type.body",
  "type.compact", "type.label", "space.1", "space.2", "space.3", "space.4", "space.5", "space.6",
  "line.hairline", "line.standard", "radius.none", "radius.small", "radius.round"])]);

const style = (size, color = INK, bold = false, align = "left", font = FONT, valign = "top") =>
  ({ fontFamily: font, fontSize: token(size), color, bold, align, valign, wrap: false });
const measure = (value, width, size, bold = false, font = FONT) => measureAt(value, Math.max(1, width), { size, bold, font });
const label = measuredLabel;
const clean = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
const between = (items, lo, hi, what) => {
  if (!Array.isArray(items) || items.length < lo || items.length > hi) throw new Error(`${what} takes ${lo} to ${hi} entries`);
  return items;
};
const line = (id, role, x1, y1, x2, y2, stroke = RULE, width = "line.hairline", data = {}) =>
  linePrimitive({ id, role, x1, y1, x2, y2, style: { stroke, lineWidth: token(width) }, data });

/* --------------------------------------------------------------- stat-list */

// A column of large statistics, each with the line that says what it counts.
// The corpus sets these down a dark side panel or in a two-column grid; the
// number is the figure, so it is set in the metric type and the sentence beside
// it at body size. Rows share the height they are given, capped so a short list
// does not turn into four islands.
function normalizeStats(props) {
  return between(props.items, 2, 6, "A stat list").map((item, i) => {
    if (!clean(item?.value)) throw new Error(`Stat ${i + 1} needs a value`);
    if (!clean(item?.text)) throw new Error(`Stat ${i + 1} needs the line that says what it counts`);
    if (String(item.value).length > 9) throw new Error(`Stat ${i + 1}: "${item.value}" is a sentence, not a statistic; keep the value to nine characters`);
    return { value: clean(item.value), text: clean(item.text), icon: item.icon ?? null };
  });
}

export function statListLayout(frame, props) {
  const items = normalizeStats(props);
  const columns = props.variant === "grid" ? 2 : 1;
  const gap = v("space.5"), colGap = v("space.6");
  const colWidth = (frame.width - colGap * (columns - 1)) / columns;
  const values = items.map((item) => measure(item.value, colWidth, "type.metric", true, DISPLAY));
  const valueWidth = Math.min(colWidth * 0.42, Math.max(...values.map((m) => m.width)) + v("space.2"));
  const textWidth = colWidth - valueWidth - v("space.4");
  if (textWidth < 120) throw new Error("A stat list is too narrow for its sentences; widen it or shorten the values");
  const texts = items.map((item) => measure(item.text, textWidth, "type.body"));
  if (texts.some((m) => m.lines.length > 4)) throw new Error("Each statistic takes a sentence of four lines at most; move the rest into the note");
  const rows = items.map((item, i) => ({ item, value: values[i], text: texts[i], height: Math.max(values[i].height, texts[i].height) }));
  const perColumn = Math.ceil(rows.length / columns);
  const columnHeights = Array.from({ length: columns }, (_, c) => rows.slice(c * perColumn, (c + 1) * perColumn)
    .reduce((sum, r, i) => sum + r.height + (i ? gap : 0), 0));
  return { rows, columns, perColumn, colWidth, colGap, valueWidth, textWidth, gap, height: Math.max(...columnHeights) + 2 * v("space.3") };
}

export function statListNodes({ id, frame, props }) {
  const L = statListLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`The stat list needs ${Math.ceil(L.height)}px and has ${Math.floor(frame.height)}px; drop a statistic or shorten its sentence`);
  const dark = props.tone === "dark";
  const nodes = [];
  if (dark) nodes.push(fillRect(stableId(id, "panel"), "stat-panel", frame, PRIMARY));
  const pad = v("space.3");
  // Spare height widens the gaps up to half as much again, then the list centres.
  for (let c = 0; c < L.columns; c++) {
    const rows = L.rows.slice(c * L.perColumn, (c + 1) * L.perColumn);
    const natural = rows.reduce((sum, r) => sum + r.height, 0);
    const room = frame.height - 2 * pad - natural;
    const gap = rows.length > 1 ? Math.min(Math.max(L.gap, room / (rows.length - 1)), L.gap * 2.2) : 0;
    const used = natural + gap * (rows.length - 1);
    let y = frame.y + pad + Math.max(0, (frame.height - 2 * pad - used) / 2);
    const x = frame.x + (dark ? pad : 0) + c * (L.colWidth + L.colGap);
    rows.forEach((r, i) => {
      const rid = stableId(id, "stat", c * L.perColumn + i);
      nodes.push(label(stableId(rid, "value"), "stat-value", { x, y, width: L.valueWidth }, r.value,
        style("type.metric", dark ? WHITE : ACCENT, true, "left", DISPLAY)));
      nodes.push(label(stableId(rid, "text"), "stat-text", { x: x + L.valueWidth + v("space.4"), y: y + Math.max(0, (r.value.height - r.text.height) / 2), width: L.textWidth }, r.text,
        style("type.body", dark ? WHITE : INK)));
      y += r.height;
      if (i < rows.length - 1) {
        nodes.push(line(stableId(rid, "rule"), "stat-rule", x, y + gap / 2, x + L.colWidth - (dark ? 2 * pad : 0), y + gap / 2, dark ? WHITE : RULE));
        y += gap;
      }
    });
  }
  return nodes;
}

/* -------------------------------------------------------------------- flow */

// A flowchart: named steps and the arrows between them, laid out in columns by
// how many steps precede each one. A loop is a cycle, which has its own
// component; a flow that loops back is refused rather than drawn as a tangle.
function normalizeFlow(props) {
  const nodes = between(props.nodes, 3, 14, "A flow").map((node, i) => {
    if (!clean(node?.id) || !clean(node?.label)) throw new Error(`Flow step ${i + 1} needs an id and a label`);
    return { id: clean(node.id), label: clean(node.label), text: clean(node.text), tone: node.tone ?? null };
  });
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length) throw new Error("Flow step ids must be unique");
  const edges = (props.edges || []).map((edge, i) => {
    if (!ids.has(edge?.from) || !ids.has(edge?.to)) throw new Error(`Flow arrow ${i + 1} names a step that is not on the page`);
    if (edge.from === edge.to) throw new Error(`Flow arrow ${i + 1} points a step at itself`);
    return { from: edge.from, to: edge.to, label: clean(edge.label) };
  });
  if (!edges.length) throw new Error("A flow needs arrows; steps with no arrows between them are a list");
  // Layer by longest path from a source; a cycle never settles.
  const layer = new Map(nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass <= nodes.length; pass++) {
    let changed = false;
    for (const e of edges) if (layer.get(e.to) < layer.get(e.from) + 1) { layer.set(e.to, layer.get(e.from) + 1); changed = true; }
    if (!changed) break;
    if (pass === nodes.length) throw new Error("A flow cannot loop back on itself; draw a repeating sequence with the cycle component");
  }
  return { nodes, edges, layer };
}

export function flowLayout(frame, props) {
  const { nodes, edges, layer } = normalizeFlow(props);
  const layers = Math.max(...layer.values()) + 1;
  if (layers < 2) throw new Error("A flow needs at least two stages");
  const colGap = 56, rowGap = v("space.4");
  const colWidth = (frame.width - colGap * (layers - 1)) / layers;
  if (colWidth < 120) throw new Error("A flow this deep is too narrow to label; split it or use fewer stages");
  const inner = colWidth - 2 * v("space.3");
  const columns = Array.from({ length: layers }, () => []);
  // Order each column by where its predecessors sit, so arrows cross less.
  const order = new Map();
  for (const n of nodes) {
    const col = columns[layer.get(n.id)];
    const preds = edges.filter((e) => e.to === n.id).map((e) => order.get(e.from)).filter((o) => o !== undefined);
    const key = preds.length ? preds.reduce((a, b) => a + b, 0) / preds.length : col.length;
    col.push({ node: n, key });
    col.sort((a, b) => a.key - b.key);
    col.forEach((entry, i) => order.set(entry.node.id, i));
  }
  const boxes = new Map();
  let tallest = 0;
  columns.forEach((col, c) => {
    const measured = col.map(({ node }) => {
      const title = measure(node.label, inner, "type.body", true);
      const body = node.text ? measure(node.text, inner, "type.compact") : null;
      if (title.lines.length > 3) throw new Error(`Flow step "${node.label}" is too long to label; shorten it`);
      return { node, title, body, height: title.height + (body ? v("space.1") + body.height : 0) + 2 * v("space.3") };
    });
    const height = measured.reduce((s, m) => s + m.height, 0) + rowGap * (measured.length - 1);
    tallest = Math.max(tallest, height);
    measured.forEach((m) => boxes.set(m.node.id, { ...m, column: c }));
    columns[c] = measured;
  });
  return { nodes, edges, columns, boxes, colWidth, colGap, rowGap, inner, height: tallest };
}

export function flowNodes({ id, frame, props }) {
  const L = flowLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`The flow needs ${Math.ceil(L.height)}px and has ${Math.floor(frame.height)}px; drop the step descriptions or split the flow`);
  const out = [], placed = new Map();
  L.columns.forEach((col, c) => {
    const x = frame.x + c * (L.colWidth + L.colGap);
    const used = col.reduce((s, m) => s + m.height, 0);
    const gap = col.length > 1 ? Math.min((frame.height - used) / (col.length - 1), L.rowGap * 3) : 0;
    let y = frame.y + (frame.height - used - gap * (col.length - 1)) / 2;
    for (const m of col) {
      const box = { x, y, width: L.colWidth, height: m.height };
      placed.set(m.node.id, box);
      const tone = m.node.tone === "accent" ? ACCENT : m.node.tone === "muted" ? MUTED : PRIMARY;
      const ink = m.node.tone === "muted" ? INK : WHITE;
      out.push(fillRect(stableId(id, "step", m.node.id), "flow-step", box, tone, { radius: "radius.small" }));
      const top = y + v("space.3");
      out.push(label(stableId(id, "label", m.node.id), "flow-step-label", { x: x + v("space.3"), y: top, width: L.inner }, m.title, style("type.body", ink, true, "center")));
      if (m.body) out.push(label(stableId(id, "text", m.node.id), "flow-step-text", { x: x + v("space.3"), y: top + m.title.height + v("space.1"), width: L.inner }, m.body, style("type.compact", ink, false, "center")));
      y += m.height + gap;
    }
  });
  L.edges.forEach((e, i) => {
    const a = placed.get(e.from), b = placed.get(e.to);
    const x1 = a.x + a.width, y1 = a.y + a.height / 2, x2 = b.x - 2, y2 = b.y + b.height / 2;
    out.push(line(stableId(id, "arrow", i), "flow-arrow", x1, y1, x2, y2, SECONDARY, "line.standard", { endArrow: true }));
    if (e.label) {
      const m = measure(e.label, L.colGap + 40, "type.label");
      out.push(label(stableId(id, "arrow-label", i), "flow-arrow-label", { x: (x1 + x2) / 2 - (L.colGap + 40) / 2, y: (y1 + y2) / 2 - m.height - 2, width: L.colGap + 40 }, m, style("type.label", SECONDARY, false, "center")));
    }
  });
  return out;
}

/* ---------------------------------------------------------------- spectrum */

// Sliders between two poles, one per dimension, with a marker where the subject
// sits. The corpus uses them for mindsets and positioning: "fixed" to "growth",
// "reactive" to "creative". The pole names carry the scale, so there are no ticks.
function normalizeSpectrum(props) {
  return between(props.items, 2, 6, "A spectrum").map((item, i) => {
    if (!clean(item?.left) || !clean(item?.right)) throw new Error(`Spectrum row ${i + 1} needs both poles named`);
    const value = Number(item.value);
    if (!(value >= 0 && value <= 1)) throw new Error(`Spectrum row ${i + 1} places its marker at a fraction from 0 to 1`);
    return { left: clean(item.left), right: clean(item.right), value, text: clean(item.text) };
  });
}

export function spectrumLayout(frame, props) {
  const items = normalizeSpectrum(props);
  const poleWidth = Math.min(200, frame.width * 0.2);
  const trackWidth = frame.width - 2 * poleWidth - 2 * v("space.4");
  if (trackWidth < 200) throw new Error("A spectrum is too narrow to show position; widen it");
  const rows = items.map((item) => {
    const left = measure(item.left, poleWidth, "type.body", true), right = measure(item.right, poleWidth, "type.body", true);
    const text = item.text ? measure(item.text, trackWidth, "type.compact") : null;
    const head = Math.max(left.height, right.height, 24);
    return { item, left, right, text, head, height: head + (text ? v("space.2") + text.height : 0) };
  });
  const gap = v("space.5");
  return { rows, poleWidth, trackWidth, gap, height: rows.reduce((s, r) => s + r.height, 0) + gap * (rows.length - 1) };
}

export function spectrumNodes({ id, frame, props }) {
  const L = spectrumLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`The spectrum needs ${Math.ceil(L.height)}px and has ${Math.floor(frame.height)}px; drop a row or its note`);
  const out = [];
  const room = frame.height - L.height;
  const gap = L.rows.length > 1 ? L.gap + Math.min(room / (L.rows.length - 1), L.gap * 2) : 0;
  const used = L.rows.reduce((s, r) => s + r.height, 0) + gap * (L.rows.length - 1);
  let y = frame.y + Math.max(0, (frame.height - used) / 2);
  const trackX = frame.x + L.poleWidth + v("space.4");
  L.rows.forEach((r, i) => {
    const rid = stableId(id, "row", i), mid = y + r.head / 2, dot = 16;
    out.push(label(stableId(rid, "left"), "spectrum-pole", { x: frame.x, y: mid - r.left.height / 2, width: L.poleWidth }, r.left, style("type.body", INK, true, "right")));
    out.push(label(stableId(rid, "right"), "spectrum-pole", { x: trackX + L.trackWidth + v("space.4"), y: mid - r.right.height / 2, width: L.poleWidth }, r.right, style("type.body", ACCENT, true, "left")));
    out.push(fillRect(stableId(rid, "track"), "spectrum-track", { x: trackX, y: mid - 3, width: L.trackWidth, height: 6 }, MUTED, { radius: "radius.round" }));
    out.push(fillRect(stableId(rid, "fill"), "spectrum-fill", { x: trackX, y: mid - 3, width: L.trackWidth * r.item.value, height: 6 }, TINT, { radius: "radius.round" }));
    out.push(ellipsePrimitive({ id: stableId(rid, "marker"), role: "spectrum-marker", frame: { x: trackX + L.trackWidth * r.item.value - dot / 2, y: mid - dot / 2, width: dot, height: dot }, style: { fill: ACCENT, stroke: WHITE, lineWidth: token("line.standard") }, data: { value: r.item.value } }));
    if (r.text) out.push(label(stableId(rid, "text"), "spectrum-text", { x: trackX, y: y + r.head + v("space.2"), width: L.trackWidth }, r.text, style("type.compact", SECONDARY, false, "center")));
    y += r.height + gap;
  });
  return out;
}

/* ------------------------------------------------------------------ layers */

// A layer stack: bands one above another, each resting on the one below. The
// corpus draws architectures, capability stacks and hierarchies of need this
// way. The top band takes the accent; the rest step down in tone.
function normalizeLayers(props) {
  return between(props.layers, 2, 7, "A layer stack").map((layer, i) => {
    if (!clean(layer?.label)) throw new Error(`Layer ${i + 1} needs a label`);
    return { label: clean(layer.label), text: clean(layer.text) };
  });
}

export function layersLayout(frame, props) {
  const layers = normalizeLayers(props);
  const labelWidth = Math.min(260, frame.width * 0.28), pad = v("space.4");
  const textWidth = frame.width - labelWidth - 3 * pad;
  const rows = layers.map((layer) => {
    const title = measure(layer.label, labelWidth, "type.body", true);
    const text = layer.text ? measure(layer.text, textWidth, "type.body") : null;
    return { layer, title, text, height: Math.max(title.height, text ? text.height : 0) + 2 * v("space.3") };
  });
  const gap = v("space.1");
  return { rows, labelWidth, textWidth, pad, gap, height: rows.reduce((s, r) => s + r.height, 0) + gap * (rows.length - 1) };
}

export function layersNodes({ id, frame, props }) {
  const L = layersLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`The layer stack needs ${Math.ceil(L.height)}px and has ${Math.floor(frame.height)}px; shorten the descriptions`);
  const stretch = Math.min(1.5, frame.height / L.height);
  const out = [];
  let y = frame.y + (frame.height - L.height * stretch) / 2;
  const tones = [ACCENT, PRIMARY];
  L.rows.forEach((r, i) => {
    const h = r.height * stretch, rid = stableId(id, "layer", i);
    // Each band is inset a little more than the one below it, so the stack
    // reads as resting on its base rather than as a table of rows.
    const inset = (L.rows.length - 1 - i) * 10;
    const band = { x: frame.x + inset, y, width: frame.width - 2 * inset, height: h };
    const fill = i === 0 ? tones[0] : tones[1];
    out.push(fillRect(stableId(rid, "band"), "layer-band", band, fill, { radius: "radius.small" }));
    out.push(label(stableId(rid, "label"), "layer-label", { x: band.x + L.pad, y: y + (h - r.title.height) / 2, width: L.labelWidth }, r.title, style("type.body", WHITE, true)));
    if (r.text) out.push(label(stableId(rid, "text"), "layer-text", { x: band.x + L.pad * 2 + L.labelWidth, y: y + (h - r.text.height) / 2, width: Math.min(L.textWidth, band.width - L.labelWidth - 3 * L.pad) }, r.text, style("type.body", WHITE)));
    y += h + L.gap;
  });
  return out;
}

/* --------------------------------------------------------------- placement */

// Items placed into the category that fits them: sectors sorted into "setback",
// "continued growth" and "accelerated", initiatives into horizons. The columns
// are the judgement; each item appears once, in one column.
function normalizePlacement(props) {
  const columns = between(props.columns, 2, 5, "A placement grid").map((col, i) => {
    if (!clean(col?.label)) throw new Error(`Placement column ${i + 1} needs a label`);
    return { label: clean(col.label), text: clean(col.text), icon: col.icon ?? null };
  });
  const items = between(props.items, 2, 30, "A placement grid's items").map((item, i) => {
    const column = Number.isInteger(item?.column) ? item.column : columns.findIndex((c) => c.label === item?.column);
    if (!clean(item?.label)) throw new Error(`Placed item ${i + 1} needs a label`);
    if (!(column >= 0 && column < columns.length)) throw new Error(`Placed item "${item.label}" names a column that is not on the page`);
    return { label: clean(item.label), column, highlight: Boolean(item.highlight) };
  });
  return { columns, items };
}

export function placementLayout(frame, props) {
  const { columns, items } = normalizePlacement(props);
  const gap = v("space.4"), width = (frame.width - gap * (columns.length - 1)) / columns.length;
  const inner = width - 2 * v("space.3");
  const heads = columns.map((c) => ({ title: measure(c.label, inner - (c.icon ? 32 : 0), "type.body", true), text: c.text ? measure(c.text, inner, "type.compact") : null }));
  const headHeight = Math.max(...heads.map((h) => h.title.height + (h.text ? v("space.1") + h.text.height : 0))) + 2 * v("space.3");
  const pills = items.map((item) => ({ item, m: measure(item.label, inner, "type.compact", item.highlight) }));
  const pillGap = v("space.2");
  const stacks = columns.map((_, c) => pills.filter((p) => p.item.column === c));
  const stackHeight = Math.max(...stacks.map((s) => s.reduce((sum, p) => sum + p.m.height + 2 * v("space.2"), 0) + pillGap * Math.max(0, s.length - 1)));
  return { columns, heads, stacks, width, inner, gap, headHeight, pillGap, height: headHeight + v("space.3") + stackHeight };
}

export function placementNodes({ id, frame, props }) {
  const L = placementLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`The placement grid needs ${Math.ceil(L.height)}px and has ${Math.floor(frame.height)}px; place fewer items`);
  const out = [];
  L.columns.forEach((col, c) => {
    const x = frame.x + c * (L.width + L.gap), cid = stableId(id, "column", c), head = L.heads[c];
    out.push(fillRect(stableId(cid, "head"), "placement-head", { x, y: frame.y, width: L.width, height: L.headHeight }, PRIMARY));
    let hx = x + v("space.3");
    if (col.icon) { out.push(...iconMarker({ id: stableId(cid, "icon"), role: "placement-icon", x: hx, y: frame.y + v("space.3"), size: 24, icon: col.icon, tone: "inverse" })); hx += 32; }
    out.push(label(stableId(cid, "label"), "placement-label", { x: hx, y: frame.y + v("space.3"), width: L.inner - (col.icon ? 32 : 0) }, head.title, style("type.body", WHITE, true)));
    if (head.text) out.push(label(stableId(cid, "text"), "placement-text", { x: x + v("space.3"), y: frame.y + v("space.3") + head.title.height + v("space.1"), width: L.inner }, head.text, style("type.compact", WHITE)));
    out.push(fillRect(stableId(cid, "well"), "placement-well", { x, y: frame.y + L.headHeight, width: L.width, height: frame.height - L.headHeight }, MUTED));
    let y = frame.y + L.headHeight + v("space.3");
    L.stacks[c].forEach((p, i) => {
      const h = p.m.height + 2 * v("space.2"), pid = stableId(cid, "item", i);
      out.push(fillRect(stableId(pid, "pill"), "placement-item", { x: x + v("space.2"), y, width: L.width - 2 * v("space.2"), height: h }, p.item.highlight ? ACCENT : WHITE, { stroke: p.item.highlight ? "none" : RULE, radius: "radius.small" }));
      out.push(label(stableId(pid, "label"), "placement-item-label", { x: x + v("space.3"), y: y + v("space.2"), width: L.inner }, p.m, style("type.compact", p.item.highlight ? WHITE : INK, p.item.highlight, "center")));
      y += h + L.pillGap;
    });
  });
  return out;
}

/* --------------------------------------------------------------- rank-flow */

// A rank table across periods: each column a period, each row a rank, and a
// line joining one entity's positions so its rise or fall reads at a glance.
// Named entities take the accent; the rest stay grey, which is the point.
function normalizeRanks(props) {
  const periods = between(props.periods, 2, 6, "A rank flow's periods").map((p) => String(p));
  const entities = between(props.entities, 3, 15, "A rank flow").map((e, i) => {
    if (!clean(e?.name)) throw new Error(`Ranked entity ${i + 1} needs a name`);
    if (!Array.isArray(e.ranks) || e.ranks.length !== periods.length) throw new Error(`"${e.name}" needs one rank per period`);
    return { name: clean(e.name), ranks: e.ranks.map(Number) };
  });
  const depth = entities.length;
  periods.forEach((_, p) => {
    const seen = entities.map((e) => e.ranks[p]);
    if (seen.some((r) => !Number.isInteger(r) || r < 1 || r > depth) || new Set(seen).size !== seen.length) throw new Error(`Period "${periods[p]}" must rank every entity once, from 1 to ${depth}`);
  });
  const focus = new Set((props.highlight || []).map(String));
  for (const name of focus) if (!entities.some((e) => e.name === name)) throw new Error(`Highlighted "${name}" is not ranked`);
  return { periods, entities, focus, depth };
}

export function rankFlowLayout(frame, props) {
  const R = normalizeRanks(props);
  // A row is as tall as its longest name needs at this width, so a narrow frame
  // wraps "United Kingdom" to two lines and the table grows rather than
  // clipping. Placed in a taller frame, rows may open up a little to fill it.
  const labelWidth = Math.min((frame.width - 28) / R.periods.length * 0.62, 180);
  const tallest = Math.max(...R.entities.map((e) => measure(e.name, labelWidth - 12, "type.label", true).height));
  const natural = Math.max(24, tallest + 8);
  const header = 28, row = Number.isFinite(frame.height) ? Math.max(natural, Math.min(natural * 1.6, (frame.height - header) / R.depth)) : natural;
  return { ...R, header, row, labelWidth, height: header + row * R.depth };
}

export function rankFlowNodes({ id, frame, props }) {
  const L = rankFlowLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`The rank flow needs ${Math.ceil(L.height)}px and has ${Math.floor(frame.height)}px; rank fewer entities`);
  const out = [], n = L.periods.length;
  const rankWidth = 28, cellWidth = (frame.width - rankWidth) / n, labelWidth = L.labelWidth;
  const x0 = frame.x + rankWidth, rowY = (rank) => frame.y + L.header + (rank - 1) * L.row;
  L.periods.forEach((p, i) => {
    const m = measure(p, labelWidth, "type.compact", true);
    out.push(label(stableId(id, "period", i), "rank-period", { x: x0 + i * cellWidth, y: frame.y, width: labelWidth }, m, style("type.compact", INK, true)));
  });
  for (let r = 1; r <= L.depth; r++) {
    const m = measure(String(r), rankWidth, "type.label");
    out.push(label(stableId(id, "rank", r), "rank-number", { x: frame.x, y: rowY(r) + (L.row - m.height) / 2, width: rankWidth - 6 }, m, style("type.label", SECONDARY, false, "right")));
  }
  // Grey entities first, highlighted last, so the lines that matter sit on top.
  const ordered = [...L.entities].sort((a, b) => Number(L.focus.has(a.name)) - Number(L.focus.has(b.name)));
  for (const e of ordered) {
    const on = L.focus.has(e.name), eid = stableId(id, "entity", e.name);
    for (let i = 0; i < n - 1; i++) {
      const y1 = rowY(e.ranks[i]) + L.row / 2, y2 = rowY(e.ranks[i + 1]) + L.row / 2;
      out.push(line(stableId(eid, "link", i), "rank-link", x0 + i * cellWidth + labelWidth + 4, y1, x0 + (i + 1) * cellWidth - 4, y2, on ? ACCENT : RULE, on ? "line.standard" : "line.hairline"));
    }
    e.ranks.forEach((r, i) => {
      const cell = { x: x0 + i * cellWidth, y: rowY(r) + 2, width: labelWidth, height: L.row - 4 };
      out.push(fillRect(stableId(eid, "cell", i), "rank-cell", cell, on ? ACCENT : MUTED, { radius: "radius.small" }));
      const m = measure(e.name, labelWidth - 12, "type.label", on);
      out.push(label(stableId(eid, "name", i), "rank-name", { x: cell.x + 6, y: cell.y + (cell.height - m.height) / 2, width: labelWidth - 12 }, m, style("type.label", on ? WHITE : INK, on)));
    });
  }
  return out;
}

/* ------------------------------------------------------------------ sankey */

// Two sets and the quantities moving between them: roles today to roles
// tomorrow, spend by source to spend by use. Node height is its total; each
// band's thickness is its value, so the widths add up on both sides.
function normalizeSankey(props) {
  const side = (list, what) => between(list, 2, 10, `A sankey's ${what}`).map((n, i) => {
    if (!clean(n?.id) || !clean(n?.label)) throw new Error(`Sankey ${what} ${i + 1} needs an id and a label`);
    return { id: clean(n.id), label: clean(n.label) };
  });
  const left = side(props.left, "left side"), right = side(props.right, "right side");
  const flows = between(props.flows, 2, 40, "A sankey's flows").map((f, i) => {
    const value = Number(f?.value);
    if (!left.some((n) => n.id === f?.from) || !right.some((n) => n.id === f?.to)) throw new Error(`Sankey flow ${i + 1} must run from a left node to a right node`);
    if (!(value > 0)) throw new Error(`Sankey flow ${i + 1} needs a positive value`);
    return { from: f.from, to: f.to, value };
  });
  for (const n of [...left, ...right]) if (!flows.some((f) => f.from === n.id || f.to === n.id)) throw new Error(`Sankey node "${n.label}" has no flow`);
  return { left, right, flows, focus: new Set(props.highlight || []) };
}

export function sankeyLayout(frame, props) {
  const S = normalizeSankey(props);
  const labelWidth = Math.min(200, frame.width * 0.2);
  // Each node needs room for its label at this width; a narrow sankey wraps its
  // labels and grows rather than letting them overlap the next node.
  const tallest = Math.max(...[...S.left, ...S.right].map((n) => measure(n.label, labelWidth, "type.compact", true).height));
  const perNode = Math.max(36, tallest + v("space.2"));
  return { ...S, labelWidth, height: Math.max(S.left.length, S.right.length) * perNode };
}

export function sankeyNodes({ id, frame, props }) {
  const L = sankeyLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`The sankey needs ${Math.ceil(L.height)}px and has ${Math.floor(frame.height)}px`);
  const out = [], bar = 14, gap = v("space.2");
  const total = L.flows.reduce((s, f) => s + f.value, 0);
  const place = (nodes, key) => {
    const room = frame.height - gap * (nodes.length - 1);
    let y = frame.y; const at = new Map();
    for (const n of nodes) {
      const sum = L.flows.filter((f) => f[key] === n.id).reduce((s, f) => s + f.value, 0);
      const h = Math.max(4, room * sum / total); at.set(n.id, { y, h, cursor: y }); y += h + gap;
    }
    return at;
  };
  const leftAt = place(L.left, "from"), rightAt = place(L.right, "to");
  const xl = frame.x + L.labelWidth + v("space.2"), xr = frame.x + frame.width - L.labelWidth - v("space.2") - bar;
  const room = frame.height - gap * (Math.max(L.left.length, L.right.length) - 1);
  L.flows.forEach((f, i) => {
    const a = leftAt.get(f.from), b = rightAt.get(f.to), h = room * f.value / total;
    const on = L.focus.has(f.from) || L.focus.has(f.to);
    const pts = [[xl + bar, a.cursor], [xr, b.cursor], [xr, b.cursor + h], [xl + bar, a.cursor + h]];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const box = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
    out.push(shapePrimitive({ id: stableId(id, "band", i), role: "sankey-band", geometry: "iconPath", frame: box,
      style: { fill: on ? TINT : MUTED, stroke: "none" },
      data: { value: f.value, paths: [{ points: pts.map(([x, y]) => [(x - box.x) / box.width, (y - box.y) / box.height]), closed: true }] } }));
    a.cursor += h; b.cursor += h;
  });
  const side = (nodes, at, x, align) => nodes.forEach((n) => {
    const p = at.get(n.id), on = L.focus.has(n.id);
    out.push(fillRect(stableId(id, "node", n.id), "sankey-node", { x, y: p.y, width: bar, height: p.h }, on ? ACCENT : PRIMARY));
    const m = measure(n.label, L.labelWidth, "type.compact", on);
    const lx = align === "right" ? frame.x : x + bar + v("space.2");
    out.push(label(stableId(id, "label", n.id), "sankey-label", { x: lx, y: p.y + (p.h - m.height) / 2, width: L.labelWidth }, m, style("type.compact", INK, on, align)));
  });
  side(L.left, leftAt, xl, "right");
  side(L.right, rightAt, xr, "left");
  return out;
}

/* --------------------------------------------------------------- pictogram */

// An icon array: ten or twenty figures per row with the share filled in the
// accent. "Six in ten" reads faster as six filled people than as a bar at 60%,
// and the corpus uses it for exactly that kind of population share.
function normalizePictogram(props) {
  const of = props.of ?? 10;
  if (![10, 20].includes(of)) throw new Error("A pictogram row counts out of 10 or 20");
  const rows = between(props.rows, 1, 5, "A pictogram").map((row, i) => {
    const value = Number(row?.value);
    if (!clean(row?.label)) throw new Error(`Pictogram row ${i + 1} needs a label`);
    if (!(value >= 0 && value <= of)) throw new Error(`Pictogram row ${i + 1} fills 0 to ${of} figures`);
    return { label: clean(row.label), value, text: clean(row.text) };
  });
  return { of, rows, icon: props.icon ?? "person" };
}

export function pictogramLayout(frame, props) {
  const P = normalizePictogram(props);
  const labelWidth = Math.min(300, frame.width * 0.32), iconArea = frame.width - labelWidth - v("space.5");
  const size = Math.min(48, (iconArea - (P.of - 1) * 6) / P.of);
  if (size < 12) throw new Error("A pictogram is too narrow for its figures; widen it");
  const rows = P.rows.map((row) => {
    const title = measure(row.label, labelWidth, "type.body", true), text = row.text ? measure(row.text, labelWidth, "type.compact") : null;
    return { row, title, text, height: Math.max(size, title.height + (text ? v("space.1") + text.height : 0)) };
  });
  return { ...P, rows, size, labelWidth, iconArea, height: rows.reduce((s, r) => s + r.height, 0) + v("space.5") * (rows.length - 1) };
}

export function pictogramNodes({ id, frame, props }) {
  const L = pictogramLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`The pictogram needs ${Math.ceil(L.height)}px and has ${Math.floor(frame.height)}px`);
  const out = [], gap = v("space.5") + Math.min(v("space.5"), (frame.height - L.height) / Math.max(1, L.rows.length - 1));
  let y = frame.y + Math.max(0, (frame.height - L.height - (gap - v("space.5")) * (L.rows.length - 1)) / 2);
  L.rows.forEach((r, i) => {
    const rid = stableId(id, "row", i);
    out.push(label(stableId(rid, "label"), "pictogram-label", { x: frame.x, y, width: L.labelWidth }, r.title, style("type.body", INK, true)));
    if (r.text) out.push(label(stableId(rid, "text"), "pictogram-text", { x: frame.x, y: y + r.title.height + v("space.1"), width: L.labelWidth }, r.text, style("type.compact", SECONDARY)));
    const x0 = frame.x + L.labelWidth + v("space.5"), iy = y + (r.height - L.size) / 2;
    for (let k = 0; k < L.of; k++) {
      const filled = k < Math.round(r.row.value);
      out.push(...iconMarker({ id: stableId(rid, "figure", k), role: "pictogram-figure", x: x0 + k * (L.size + 6), y: iy, size: L.size, icon: L.icon, tone: filled ? "accent" : "faint" }));
    }
    y += r.height + gap;
  });
  return out;
}

/* -------------------------------------------------------------- arrow-rows */

// Rows each carried by a block arrow: the scenario or lever in the arrow, what
// follows from it beside. The arrow says the row leads somewhere, which a table
// row does not.
function normalizeArrowRows(props) {
  return between(props.items, 2, 6, "Arrow rows").map((item, i) => {
    if (!clean(item?.label)) throw new Error(`Arrow row ${i + 1} needs a label`);
    return { label: clean(item.label), text: clean(item.text), icon: item.icon ?? null };
  });
}

export function arrowRowsLayout(frame, props) {
  const items = normalizeArrowRows(props);
  const arrowWidth = Math.min(340, frame.width * 0.36), inner = arrowWidth - 2 * v("space.4") - 24;
  const textWidth = frame.width - arrowWidth - v("space.5");
  const rows = items.map((item) => {
    const title = measure(item.label, inner - (item.icon ? 32 : 0), "type.body", true), text = item.text ? measure(item.text, textWidth, "type.body") : null;
    return { item, title, text, height: Math.max(title.height + 2 * v("space.3"), text ? text.height : 0, 52) };
  });
  const gap = v("space.4");
  return { rows, arrowWidth, inner, textWidth, gap, height: rows.reduce((s, r) => s + r.height, 0) + gap * (rows.length - 1) };
}

export function arrowRowsNodes({ id, frame, props }) {
  const L = arrowRowsLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`The arrow rows need ${Math.ceil(L.height)}px and have ${Math.floor(frame.height)}px`);
  const out = [], room = frame.height - L.height, gap = L.gap + Math.min(room / Math.max(1, L.rows.length - 1), L.gap * 2);
  const used = L.rows.reduce((s, r) => s + r.height, 0) + gap * (L.rows.length - 1);
  let y = frame.y + Math.max(0, (frame.height - used) / 2);
  L.rows.forEach((r, i) => {
    const rid = stableId(id, "row", i), last = i === L.rows.length - 1;
    out.push(shapePrimitive({ id: stableId(rid, "arrow"), role: "arrow-row-shape", geometry: "notchedRightArrow", frame: { x: frame.x, y, width: L.arrowWidth, height: r.height }, style: { fill: last ? ACCENT : PRIMARY, stroke: "none" } }));
    let tx = frame.x + v("space.4");
    if (r.item.icon) { out.push(...iconMarker({ id: stableId(rid, "icon"), role: "arrow-row-icon", x: tx, y: y + (r.height - 24) / 2, size: 24, icon: r.item.icon, tone: "inverse" })); tx += 32; }
    out.push(label(stableId(rid, "label"), "arrow-row-label", { x: tx, y: y + (r.height - r.title.height) / 2, width: L.inner - (r.item.icon ? 32 : 0) }, r.title, style("type.body", WHITE, true)));
    if (r.text) out.push(label(stableId(rid, "text"), "arrow-row-text", { x: frame.x + L.arrowWidth + v("space.5"), y: y + (r.height - r.text.height) / 2, width: L.textWidth }, r.text, style("type.body", INK)));
    y += r.height + gap;
  });
  return out;
}

/* ---------------------------------------------------------------- capsules */

// Tall rounded pillars side by side, each numbered at the top with its icon at
// the foot: the three or four priorities of a plan, set as columns a reader
// takes one at a time.
function normalizeCapsules(props) {
  return between(props.items, 2, 5, "Capsules").map((item, i) => {
    if (!clean(item?.title)) throw new Error(`Capsule ${i + 1} needs a title`);
    return { title: clean(item.title), text: clean(item.text), icon: item.icon ?? null };
  });
}

export function capsulesLayout(frame, props) {
  const items = normalizeCapsules(props);
  // A fifth of the frame per pillar: narrow enough to stand as a column, and it
  // scales with the page so a narrow frame wraps the titles rather than
  // pretending every width sets them the same.
  const gap = v("space.6"), width = Math.min(frame.width * 0.2, (frame.width - gap * (items.length - 1)) / items.length);
  const inner = width - 2 * v("space.4");
  const measured = items.map((item) => ({ item, title: measure(item.title, inner, "type.body", true), text: item.text ? measure(item.text, inner, "type.compact") : null }));
  const content = Math.max(...measured.map((m) => m.title.height + (m.text ? v("space.2") + m.text.height : 0)));
  const disc = 56, icon = 32;
  return { measured, gap, width, inner, disc, icon, height: v("space.5") + disc + v("space.4") + content + v("space.4") + icon + v("space.5") };
}

export function capsulesNodes({ id, frame, props }) {
  const L = capsulesLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`The capsules need ${Math.ceil(L.height)}px and have ${Math.floor(frame.height)}px; shorten the text`);
  const out = [], n = L.measured.length;
  const total = n * L.width + (n - 1) * L.gap, x0 = frame.x + (frame.width - total) / 2;
  // A capsule is a pillar: it takes most of the height it is given, so it reads
  // as tall and narrow rather than as a lozenge around its text.
  const h = Math.max(L.height, frame.height * 0.92), y0 = frame.y + (frame.height - h) / 2;
  L.measured.forEach((m, i) => {
    const x = x0 + i * (L.width + L.gap), cid = stableId(id, "capsule", i), fill = i % 2 ? PRIMARY : ACCENT;
    out.push(fillRect(stableId(cid, "body"), "capsule-body", { x, y: y0, width: L.width, height: h }, fill, { radius: "radius.round" }));
    out.push(...numberMarker({ id: stableId(cid, "number"), role: "capsule-number", x: x + (L.width - L.disc) / 2, y: y0 + v("space.5"), size: L.disc, number: i + 1, reverse: false }));
    let y = y0 + v("space.5") + L.disc + v("space.4");
    out.push(label(stableId(cid, "title"), "capsule-title", { x: x + v("space.4"), y, width: L.inner }, m.title, style("type.body", WHITE, true, "center")));
    y += m.title.height + v("space.2");
    if (m.text) out.push(label(stableId(cid, "text"), "capsule-text", { x: x + v("space.4"), y, width: L.inner }, m.text, style("type.compact", WHITE, false, "center")));
    if (m.item.icon) out.push(...iconMarker({ id: stableId(cid, "icon"), role: "capsule-icon", x: x + (L.width - L.icon) / 2, y: y0 + h - v("space.5") - L.icon, size: L.icon, icon: m.item.icon, tone: "inverse" }));
  });
  return out;
}

/* ----------------------------------------------------------- registration */

const SAMPLES = {
  "stat-list": { items: [{ value: "87%", text: "(Insert what the first statistic counts)" }, { value: "70%", text: "(Insert what the second statistic counts)" }, { value: "1 in 4", text: "(Insert what the third statistic counts)" }] },
  flow: { nodes: [{ id: "a", label: "(Insert step 1)" }, { id: "b", label: "(Insert branch A)" }, { id: "c", label: "(Insert branch B)" }, { id: "d", label: "(Insert outcome)" }],
    edges: [{ from: "a", to: "b" }, { from: "a", to: "c" }, { from: "b", to: "d" }, { from: "c", to: "d" }] },
  spectrum: { items: [{ left: "(Insert pole A)", right: "(Insert pole B)", value: 0.7 }, { left: "(Insert pole A)", right: "(Insert pole B)", value: 0.4 }, { left: "(Insert pole A)", right: "(Insert pole B)", value: 0.85 }] },
  layers: { layers: [{ label: "(Insert top layer)", text: "(Insert what it does)" }, { label: "(Insert middle layer)", text: "(Insert what it does)" }, { label: "(Insert base layer)", text: "(Insert what it does)" }] },
  placement: { columns: [{ label: "(Insert category 1)" }, { label: "(Insert category 2)" }, { label: "(Insert category 3)" }],
    items: [{ label: "(Insert item)", column: 0 }, { label: "(Insert item)", column: 1 }, { label: "(Insert item)", column: 1 }, { label: "(Insert item)", column: 2 }] },
  "rank-flow": { periods: ["(Period 1)", "(Period 2)", "(Period 3)"], entities: [{ name: "(Entity A)", ranks: [1, 2, 3] }, { name: "(Entity B)", ranks: [2, 1, 1] }, { name: "(Entity C)", ranks: [3, 3, 2] }], highlight: ["(Entity B)"] },
  sankey: { left: [{ id: "a", label: "(Insert source 1)" }, { id: "b", label: "(Insert source 2)" }], right: [{ id: "x", label: "(Insert use 1)" }, { id: "y", label: "(Insert use 2)" }],
    flows: [{ from: "a", to: "x", value: 3 }, { from: "a", to: "y", value: 1 }, { from: "b", to: "y", value: 2 }] },
  pictogram: { rows: [{ label: "(Insert population)", value: 6 }, { label: "(Insert comparison)", value: 3 }] },
  "arrow-rows": { items: [{ label: "(Insert scenario 1)", text: "(Insert what follows)" }, { label: "(Insert scenario 2)", text: "(Insert what follows)" }] },
  capsules: { items: [{ title: "(Insert priority 1)", text: "(Insert what it means)" }, { title: "(Insert priority 2)", text: "(Insert what it means)" }, { title: "(Insert priority 3)", text: "(Insert what it means)" }] },
};

const GUIDANCE = {
  "stat-list": { useWhen: "two to six headline statistics, each with the sentence that says what it counts", why: "large numbers down a column read before anything else on the page, and the sentence beside each stops the number being read out of context", actionTitle: "state what the statistics together show" },
  flow: { useWhen: "a process with branches or merges, where the arrows between steps carry the argument", why: "columns by stage keep the reading left to right and the arrows show which steps depend on which", actionTitle: "state where the flow breaks or what decides the branch" },
  spectrum: { useWhen: "positions on two to six dimensions, each between two named poles", why: "a marker on a track shows where the subject sits and how far it has to move, without inventing a numeric scale", actionTitle: "state which dimension is furthest from where it needs to be" },
  layers: { useWhen: "two to seven layers that rest on one another, such as a technology stack or a hierarchy of needs", why: "stacked bands say each layer depends on the one beneath it, which a list does not", actionTitle: "state which layer the argument turns on" },
  placement: { useWhen: "sorting named items into two to five categories, such as sectors by outlook or initiatives by horizon", why: "each item appears once in the column that fits it, so the reader sees both the category and its membership", actionTitle: "state which category matters and what is in it" },
  "rank-flow": { useWhen: "the rank of three to fifteen entities across two to six periods, where movement is the finding", why: "lines joining an entity's positions show rises and falls that a table of ranks hides", actionTitle: "state who moved and by how far" },
  sankey: { useWhen: "quantities moving from one set of categories to another, such as roles today to roles tomorrow", why: "band widths add up on both sides, so the reader sees where each source goes and what each use is made of", actionTitle: "state the flow that decides the answer" },
  pictogram: { useWhen: "one to five population shares best read as 'six in ten'", why: "filled figures make a share countable, which a bar at 60% does not", actionTitle: "state the share and who it describes" },
  "arrow-rows": { useWhen: "two to six scenarios or levers, each leading to a consequence", why: "the arrow says the row leads somewhere; the consequence sits where the arrow points", actionTitle: "state the scenario that matters and what follows from it" },
  capsules: { useWhen: "two to five priorities or principles set as equal columns", why: "tall pillars side by side read as parallel commitments, each taken on its own", actionTitle: "state the priority the rest depend on" },
};

const RENDER = {
  "stat-list": [statListNodes, statListLayout, { width: 520, height: 440 }],
  flow: [flowNodes, flowLayout, { width: 1160, height: 440 }],
  spectrum: [spectrumNodes, spectrumLayout, { width: 1160, height: 380 }],
  layers: [layersNodes, layersLayout, { width: 1160, height: 420 }],
  placement: [placementNodes, placementLayout, { width: 1160, height: 460 }],
  "rank-flow": [rankFlowNodes, rankFlowLayout, { width: 1160, height: 460 }],
  sankey: [sankeyNodes, sankeyLayout, { width: 1160, height: 440 }],
  pictogram: [pictogramNodes, pictogramLayout, { width: 1160, height: 320 }],
  "arrow-rows": [arrowRowsNodes, arrowRowsLayout, { width: 1160, height: 400 }],
  capsules: [capsulesNodes, capsulesLayout, { width: 1160, height: 460 }],
};

export const FIGURE_IDS = Object.freeze(Object.keys(RENDER));

export function registerFigures(registry) {
  for (const [id, [nodes, layout, preferredSize]] of Object.entries(RENDER)) {
    registry.set(id, { id, version: "1.0.0", category: "diagram", role: id, tokens: [...FIGURE_TOKENS], preferredSize,
      sample: SAMPLES[id], render: (input) => ({ nodes: nodes(input) }), measureContent: ({ frame, props }) => layout(frame, props),
      guidance: GUIDANCE[id] });
  }
  return registry;
}
