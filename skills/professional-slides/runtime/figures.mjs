// Seventeen figure families that well-made decks use and the skill could not
// otherwise draw.
//
// These are diagram and statistic styles that had no component: a column of large statistics, a
// flowchart, spectrum sliders, a layer stack, items placed into category
// columns, a rank table across periods, a two-sided flow, an icon array, rows
// carried by arrows and a row of capsule pillars. Each is drawn from the
// primitives every other component uses, so the PowerPoint emitter and the
// HTML renderer need nothing new, and each measures itself and refuses content
// it cannot set rather than overflowing.
import { token, tokenValue, stableId, rectPrimitive, ellipsePrimitive, linePrimitive, shapePrimitive } from "./core.mjs";
import { MARK_TOKENS, numberMarker, iconMarker } from "./marks.mjs";
import { measureAt, fillRect, measuredLabel } from "./draw.mjs";
import { mediaNode } from "./media.mjs";

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
// A strong deck sets these down a dark side panel or in a two-column grid; the
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
// sits. They suit mindsets and positioning: "fixed" to "growth",
// "reactive" to "creative". The pole names carry the scale, so there are no ticks.
//
// `segments: 3–7` turns each track into a row of discrete steps with the one the
// subject sits on filled: the familiar assessment scale ("impact on
// industry: very low … very high", "time to mainstream: 0–2 … 10+ years"). A
// judged grade is not a point on a continuum, and a slider drawn at 0.62 claims
// a precision the judgement does not have. `scale` names the steps once, above
// the first row; a row then needs only its own name, `left`.
function normalizeSpectrum(props) {
  const segments = props.segments === undefined ? null : Number(props.segments);
  if (segments !== null && !(Number.isInteger(segments) && segments >= 3 && segments <= 7)) throw new Error("A segmented spectrum takes 3 to 7 segments");
  if (props.scale !== undefined && (segments === null || !Array.isArray(props.scale) || props.scale.length !== segments || props.scale.some((step) => !clean(step)))) throw new Error("A spectrum's scale names every segment, in order, and needs `segments`");
  return between(props.items, 2, 6, "A spectrum").map((item, i) => {
    if (segments !== null) {
      if (!clean(item?.left)) throw new Error(`Spectrum row ${i + 1} needs its name in \`left\``);
      const level = Number(item.level);
      if (!(Number.isInteger(level) && level >= 1 && level <= segments)) throw new Error(`Spectrum row ${i + 1} sits on a segment from 1 to ${segments}; give its \`level\``);
      return { left: clean(item.left), right: clean(item.right), level, value: (level - 0.5) / segments, text: clean(item.text) };
    }
    if (!clean(item?.left) || !clean(item?.right)) throw new Error(`Spectrum row ${i + 1} needs both poles named`);
    const value = Number(item.value);
    if (!(value >= 0 && value <= 1)) throw new Error(`Spectrum row ${i + 1} places its marker at a fraction from 0 to 1`);
    return { left: clean(item.left), right: clean(item.right), value, text: clean(item.text) };
  });
}

export function spectrumLayout(frame, props) {
  const items = normalizeSpectrum(props);
  const segments = props.segments === undefined ? null : Number(props.segments);
  const poleWidth = Math.min(200, frame.width * 0.2);
  // A segmented scale whose rows name no right-hand pole gives the track that column.
  const rightPole = segments === null || items.some((item) => item.right);
  const trackWidth = frame.width - (rightPole ? 2 : 1) * poleWidth - (rightPole ? 2 : 1) * v("space.4");
  if (trackWidth < 200) throw new Error("A spectrum is too narrow to show position; widen it");
  const rows = items.map((item) => {
    const left = measure(item.left, poleWidth, "type.body", true), right = item.right ? measure(item.right, poleWidth, "type.body", true) : null;
    const text = item.text ? measure(item.text, trackWidth, "type.compact") : null;
    const head = Math.max(left.height, right?.height ?? 0, 24);
    return { item, left, right, text, head, height: head + (text ? v("space.2") + text.height : 0) };
  });
  const gap = v("space.5");
  const segGap = 4, segWidth = segments ? (trackWidth - segGap * (segments - 1)) / segments : 0;
  const scale = segments && props.scale ? props.scale.map((step) => measure(step, segWidth, "type.label")) : null;
  const header = scale ? Math.max(...scale.map((m) => m.height)) + v("space.2") : 0;
  return { rows, segments, segGap, segWidth, scale, header, rightPole, poleWidth, trackWidth, gap, height: header + rows.reduce((s, r) => s + r.height, 0) + gap * (rows.length - 1) };
}

export function spectrumNodes({ id, frame, props }) {
  const L = spectrumLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`The spectrum needs ${Math.ceil(L.height)}px and has ${Math.floor(frame.height)}px; drop a row or its note`);
  const out = [];
  const room = frame.height - L.height;
  const gap = L.rows.length > 1 ? L.gap + Math.min(room / (L.rows.length - 1), L.gap * 2) : 0;
  const used = L.header + L.rows.reduce((s, r) => s + r.height, 0) + gap * (L.rows.length - 1);
  let y = frame.y + Math.max(0, (frame.height - used) / 2);
  const trackX = frame.x + L.poleWidth + v("space.4");
  const segX = (k) => trackX + k * (L.segWidth + L.segGap);
  if (L.scale) L.scale.forEach((m, k) => out.push(label(stableId(id, "scale", k), "spectrum-scale", { x: segX(k), y: y + L.header - v("space.2") - m.height, width: L.segWidth }, m, style("type.label", SECONDARY, false, "center"))));
  y += L.header;
  L.rows.forEach((r, i) => {
    const rid = stableId(id, "row", i), mid = y + r.head / 2, dot = 16;
    out.push(label(stableId(rid, "left"), "spectrum-pole", { x: frame.x, y: mid - r.left.height / 2, width: L.poleWidth }, r.left, style("type.body", INK, true, "right")));
    if (r.right) out.push(label(stableId(rid, "right"), "spectrum-pole", { x: trackX + L.trackWidth + v("space.4"), y: mid - r.right.height / 2, width: L.poleWidth }, r.right, style("type.body", ACCENT, true, "left")));
    if (L.segments) {
      for (let k = 0; k < L.segments; k++) out.push(fillRect(stableId(rid, "segment", k), k === r.item.level - 1 ? "spectrum-level" : "spectrum-segment", { x: segX(k), y: mid - 7, width: L.segWidth, height: 14 }, k === r.item.level - 1 ? ACCENT : MUTED, { data: { level: k + 1, selected: k === r.item.level - 1 } }));
      if (r.text) out.push(label(stableId(rid, "text"), "spectrum-text", { x: trackX, y: y + r.head + v("space.2"), width: L.trackWidth }, r.text, style("type.compact", SECONDARY, false, "left")));
      y += r.height + gap;
      return;
    }
    out.push(fillRect(stableId(rid, "track"), "spectrum-track", { x: trackX, y: mid - 3, width: L.trackWidth, height: 6 }, MUTED, { radius: "radius.round" }));
    out.push(fillRect(stableId(rid, "fill"), "spectrum-fill", { x: trackX, y: mid - 3, width: L.trackWidth * r.item.value, height: 6 }, TINT, { radius: "radius.round" }));
    out.push(ellipsePrimitive({ id: stableId(rid, "marker"), role: "spectrum-marker", frame: { x: trackX + L.trackWidth * r.item.value - dot / 2, y: mid - dot / 2, width: dot, height: dot }, style: { fill: ACCENT, stroke: WHITE, lineWidth: token("line.standard") }, data: { value: r.item.value } }));
    if (r.text) out.push(label(stableId(rid, "text"), "spectrum-text", { x: trackX, y: y + r.head + v("space.2"), width: L.trackWidth }, r.text, style("type.compact", SECONDARY, false, "center")));
    y += r.height + gap;
  });
  return out;
}

/* ------------------------------------------------------------------ layers */

// A layer stack: bands one above another, each resting on the one below. A
// well-made deck draws architectures, capability stacks and hierarchies of need this
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
  if (L.height > frame.height + 0.01) throw new Error(`The sankey needs ${Math.ceil(L.height)}px and has ${Math.floor(frame.height)}px; drop a node or give the sankey more height`);
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
// and it suits exactly that kind of population share.
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
  if (L.height > frame.height + 0.01) throw new Error(`The pictogram needs ${Math.ceil(L.height)}px and has ${Math.floor(frame.height)}px; drop a row or give it more height`);
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
  if (L.height > frame.height + 0.01) throw new Error(`The arrow rows need ${Math.ceil(L.height)}px and have ${Math.floor(frame.height)}px; drop a row or shorten the labels`);
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


/* ---------------------------------------------------------------- fact-grid */

// The infographic panel: a grid of facts, each a large figure with its label,
// an optional icon and an optional gauge - the dense "by the numbers" page a
// strong report runs. Every tile is one fact; a tile with two numbers in it
// is two tiles.
function normalizeFacts(props) {
  return between(props.items, 3, 9, "A fact grid").map((item, i) => {
    if (!clean(item?.value) || !clean(item?.label)) throw new Error(`Fact ${i + 1} needs a value and a label`);
    if (String(item.value).length > 10) throw new Error(`Fact ${i + 1}: "${item.value}" is too long for a figure; keep it to ten characters`);
    const gauge = item.gauge === undefined ? null : Number(item.gauge);
    if (gauge !== null && !(gauge >= 0 && gauge <= 1)) throw new Error(`Fact ${i + 1}: a gauge is a fraction from 0 to 1`);
    return { value: clean(item.value), label: clean(item.label), text: clean(item.text), icon: item.icon ?? null, gauge };
  });
}

// How far a single row of fact tiles grows past its natural height.
const FACT_ROW_GROWTH = 1.35;

/** The most height a fact grid uses: a single row stops at FACT_ROW_GROWTH; two rows or more take the frame. */
export function factGridCeiling(frame, props) {
  const L = factGridLayout(frame, props);
  return L.rows > 1 ? null : L.height * FACT_ROW_GROWTH;
}

export function factGridLayout(frame, props) {
  const items = normalizeFacts(props);
  const gap = v("space.4"), pad = v("space.4");
  const innerAt = (n) => (frame.width - gap * (n - 1)) / n - 2 * pad;
  if (props.columns !== undefined && !(Number.isInteger(props.columns) && props.columns >= 1 && props.columns <= Math.min(4, items.length)))
    throw new Error(`A fact grid's \`columns\` is how many tiles run across: a whole number from 1 to 4, and no more than its ${items.length} facts`);
  // Four tiles in a row fit the page's width but not a column beside
  // commentary; there the grid wraps to two rows rather than failing a page
  // whose choice of placement was sound.
  let columns = props.columns ?? (items.length <= 4 ? items.length : items.length <= 6 ? 3 : Math.min(4, Math.ceil(items.length / 2)));
  if (props.columns === undefined) while (columns > 1 && innerAt(columns) < 110) columns = columns === 4 && items.length === 4 ? 2 : columns - 1;
  const at = (n) => {
    const rows = Math.ceil(items.length / n);
    const width = (frame.width - gap * (n - 1)) / n, inner = width - 2 * pad;
    const tiles = items.map((item) => {
      const value = measure(item.value, inner, "type.metric", true, DISPLAY);
      const label = measure(item.label, inner, "type.body", true);
      const text = item.text ? measure(item.text, inner, "type.compact") : null;
      const top = item.icon ? 28 + v("space.2") : 0;
      return { item, value, label, text, height: 2 * pad + top + value.height + v("space.1") + label.height + (text ? v("space.1") + text.height : 0) + (item.gauge !== null ? v("space.2") + 6 : 0) };
    });
    const rowHeights = Array.from({ length: rows }, (_, r) => Math.max(...tiles.slice(r * n, (r + 1) * n).map((t) => t.height)));
    return { tiles, columns: n, rows, width, inner, gap, pad, rowHeights, height: rowHeights.reduce((a, b) => a + b, 0) + gap * (rows - 1) };
  };
  let layout = at(columns);
  // A single row of four or more that would leave more than a fifth of a
  // given frame empty, even grown, wraps to two rows, which take the frame:
  // four tiles in one row across a 500px body were a strip at the top with the
  // rest of the page under it. An author's `columns` is kept.
  if (props.columns === undefined && layout.rows === 1 && items.length >= 4 && Number.isFinite(frame.height) && layout.height * FACT_ROW_GROWTH < frame.height * 0.8) {
    const wrapped = at(Math.ceil(items.length / 2));
    if (wrapped.height <= frame.height) layout = wrapped;
  }
  if (layout.inner < 110) throw new Error("A fact grid this wide is too narrow per tile; use fewer columns");
  return layout;
}

export function factGridNodes({ id, frame, props }) {
  const L = factGridLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`The fact grid needs ${Math.ceil(L.height)}px and has ${Math.floor(frame.height)}px; drop a fact or its line`);
  const dark = props.tone === "dark", out = [];
  // A grid of two rows or more takes the height its frame gives it: the tiles
  // are the exhibit, and four tiles two by two beside the commentary grew by a
  // third and then sat centred with a band of air above and below the grid.
  // A single row still grows by a third at most - a row of tiles as tall as
  // the page is a row of empty boxes - and sits at the top of its frame, the
  // rest going to what follows (measureCeiling). Copy in a tile that grew is
  // centred in it, the way a card's is; a gauge stays on the tile's foot.
  const fit = (frame.height - L.gap * (L.rows - 1)) / (L.height - L.gap * (L.rows - 1));
  const stretch = L.rows > 1 ? Math.max(1, fit) : Math.min(FACT_ROW_GROWTH, fit);
  let y = frame.y;
  for (let r = 0; r < L.rows; r++) {
    const h = L.rowHeights[r] * stretch;
    L.tiles.slice(r * L.columns, (r + 1) * L.columns).forEach((t, c) => {
      const x = frame.x + c * (L.width + L.gap), tid = stableId(id, "fact", r * L.columns + c);
      out.push(fillRect(stableId(tid, "tile"), "fact-tile", { x, y, width: L.width, height: h }, dark ? PRIMARY : MUTED, { radius: "radius.small" }));
      // `t.height` counts the gauge's band, which stays on the foot, so the
      // copy centres in what is above it by the same half of the growth.
      let ty = y + L.pad + Math.max(0, h - t.height) / 2;
      if (t.item.icon) { out.push(...iconMarker({ id: stableId(tid, "icon"), role: "fact-icon", x: x + L.pad, y: ty, size: 28, icon: t.item.icon, tone: dark ? "inverse" : "accent" })); ty += 28 + v("space.2"); }
      out.push(label(stableId(tid, "value"), "fact-value", { x: x + L.pad, y: ty, width: L.inner }, t.value, style("type.metric", dark ? WHITE : ACCENT, true, "left", DISPLAY)));
      ty += t.value.height + v("space.1");
      out.push(label(stableId(tid, "label"), "fact-label", { x: x + L.pad, y: ty, width: L.inner }, t.label, style("type.body", dark ? WHITE : INK, true)));
      ty += t.label.height;
      if (t.text) { out.push(label(stableId(tid, "text"), "fact-text", { x: x + L.pad, y: ty + v("space.1"), width: L.inner }, t.text, style("type.compact", dark ? WHITE : SECONDARY))); ty += v("space.1") + t.text.height; }
      if (t.item.gauge !== null) {
        const gy = y + h - L.pad - 6;
        out.push(fillRect(stableId(tid, "gauge-track"), "fact-gauge-track", { x: x + L.pad, y: gy, width: L.inner, height: 6 }, dark ? SECONDARY : RULE, { radius: "radius.round" }));
        out.push(fillRect(stableId(tid, "gauge"), "fact-gauge", { x: x + L.pad, y: gy, width: Math.max(2, L.inner * t.item.gauge), height: 6 }, ACCENT, { radius: "radius.round" }));
      }
    });
    y += h + L.gap;
  }
  return out;
}

/* ------------------------------------------------------------- zone-matrix */

// A matrix of graded zones with items plotted on it: likelihood against impact,
// effort against value. The zones are graded in the accent's own tint, never
// red, amber and green - the deck reserves status colour for verdicts, and a
// background that says "danger" makes a claim the items have not earned.
function normalizeZones(props) {
  const axis = (a, name) => {
    if (!clean(a?.label)) throw new Error(`A zone matrix needs a ${name} axis label`);
    return { label: clean(a.label), low: clean(a.low) ?? "Low", high: clean(a.high) ?? "High" };
  };
  const size = props.size ?? 3;
  if (![2, 3, 4].includes(size)) throw new Error("A zone matrix is 2, 3 or 4 zones a side");
  const points = between(props.points, 1, 15, "A zone matrix's items").map((pt, i) => {
    const x = Number(pt?.x), y = Number(pt?.y);
    if (!clean(pt?.label)) throw new Error(`Plotted item ${i + 1} needs a label`);
    if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) throw new Error(`"${pt.label}" is placed at a fraction from 0 to 1 on each axis`);
    return { label: clean(pt.label), x, y, highlight: Boolean(pt.highlight) };
  });
  return { x: axis(props.xAxis, "horizontal"), y: axis(props.yAxis, "vertical"), size, points, zoneLabels: props.zoneLabels ?? null };
}

export function zoneMatrixLayout(frame, props) {
  const Z = normalizeZones(props);
  const axisWidth = 56, axisHeight = 44;
  const side = Math.min(frame.width * 0.62 - axisWidth, (Number.isFinite(frame.height) ? frame.height : 460) - axisHeight);
  return { ...Z, axisWidth, axisHeight, side, height: Math.max(260, side + axisHeight) };
}

export function zoneMatrixNodes({ id, frame, props }) {
  const L = zoneMatrixLayout(frame, props);
  const side = Math.min(L.side, frame.height - L.axisHeight);
  if (side < 200) throw new Error("A zone matrix needs at least 200px a side");
  const out = [], x0 = frame.x + L.axisWidth, y0 = frame.y, cell = side / L.size;
  const tones = [MUTED, TINT, ACCENT];
  for (let i = 0; i < L.size; i++) for (let j = 0; j < L.size; j++) {
    const level = (i + (L.size - 1 - j)) / (2 * (L.size - 1));
    const tone = tones[Math.min(2, Math.floor(level * 2.999))];
    out.push(fillRect(stableId(id, "zone", i, j), "zone-cell", { x: x0 + i * cell, y: y0 + j * cell, width: cell - 2, height: cell - 2 }, tone, { data: { level } }));
  }
  if (L.zoneLabels) for (const [key, at] of [["low", [0, L.size - 1]], ["high", [L.size - 1, 0]]]) {
    const text = clean(L.zoneLabels[key]); if (!text) continue;
    const m = measure(text, cell - 12, "type.label", true);
    const [i, j] = at, dark = key === "high";
    out.push(label(stableId(id, "zone-label", key), "zone-label", { x: x0 + i * cell + 6, y: y0 + j * cell + 6, width: cell - 12 }, m, style("type.label", dark ? WHITE : SECONDARY, true)));
  }
  // Ids by position, not by text: both axes default their ends to "Low" and
  // "High", and two labels named for their words collide.
  const ax = (key, text, frameBox, align) => { const m = measure(text, frameBox.width, "type.compact", true); out.push(label(stableId(id, "axis", key), "zone-axis", frameBox, m, style("type.compact", INK, true, align))); };
  ax("x-label", L.x.label, { x: x0, y: y0 + side + 20, width: side }, "center");
  ax("x-low", L.x.low, { x: x0, y: y0 + side + 4, width: side / 2 }, "left");
  ax("x-high", L.x.high, { x: x0 + side / 2, y: y0 + side + 4, width: side / 2 }, "right");
  ax("y-high", L.y.high, { x: frame.x, y: y0, width: L.axisWidth - 6 }, "right");
  ax("y-low", L.y.low, { x: frame.x, y: y0 + side - 18, width: L.axisWidth - 6 }, "right");
  const yl = measure(L.y.label, L.axisWidth - 6, "type.compact", true);
  out.push(label(stableId(id, "axis-y"), "zone-axis", { x: frame.x, y: y0 + side / 2 - yl.height / 2, width: L.axisWidth - 6 }, yl, style("type.compact", INK, true, "right")));
  const listX = x0 + side + v("space.5"), listW = frame.x + frame.width - listX;
  L.points.forEach((pt, k) => {
    const cx = x0 + pt.x * side, cy = y0 + (1 - pt.y) * side, r = 13;
    // A highlighted item is drawn white on its zone, ringed in ink: an accent
    // disc on the accent zone vanished into it.
    out.push(ellipsePrimitive({ id: stableId(id, "item", k), role: "zone-item", frame: { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }, style: { fill: pt.highlight ? WHITE : PRIMARY, stroke: pt.highlight ? INK : WHITE, lineWidth: token("line.standard") } }));
    const n = measure(String(k + 1), 2 * r, "type.label", true);
    out.push(label(stableId(id, "item-number", k), "zone-item-number", { x: cx - r, y: cy - n.height / 2, width: 2 * r }, n, style("type.label", pt.highlight ? INK : WHITE, true, "center")));
    if (listW > 120) {
      const m = measure(`${k + 1}  ${pt.label}`, listW, "type.compact", pt.highlight);
      out.push(label(stableId(id, "legend", k), "zone-legend", { x: listX, y: y0 + k * Math.max(22, m.height + 6), width: listW }, m, style("type.compact", INK, pt.highlight)));
    }
  });
  return out;
}

/* ------------------------------------------------------------ device-frame */

// A screenshot shown in the device it runs on: a laptop or a phone. The frame
// says "this is the product as a customer sees it", which a bare screenshot on
// a slide does not.
export function deviceFrameLayout(frame, props) {
  const device = props.device ?? "laptop";
  if (!["laptop", "phone"].includes(device)) throw new Error("A device frame is a laptop or a phone");
  if (!props.image || (!props.image.dataUri && !clean(props.image.alt))) throw new Error("A device frame needs an image, or `{ alt }` naming the screenshot to come");
  const w = frame.width, h = Number.isFinite(frame.height) ? frame.height : w * 0.62;
  return { device, height: Math.min(h, device === "laptop" ? w * 0.62 : 520) };
}

export function deviceFrameNodes({ id, frame, props }) {
  const L = deviceFrameLayout(frame, props);
  const out = [];
  let screen;
  if (L.device === "laptop") {
    const bodyH = frame.height * 0.9, bodyW = Math.min(frame.width, bodyH * 1.55), x = frame.x + (frame.width - bodyW) / 2, y = frame.y;
    out.push(fillRect(stableId(id, "lid"), "device-body", { x, y, width: bodyW, height: bodyH }, INK, { radius: "radius.small" }));
    screen = { x: x + 12, y: y + 12, width: bodyW - 24, height: bodyH - 24 };
    out.push(shapePrimitive({ id: stableId(id, "base"), role: "device-base", geometry: "trapezoid", frame: { x: x - bodyW * 0.06, y: y + bodyH, width: bodyW * 1.12, height: frame.height * 0.06 }, style: { fill: SECONDARY, stroke: "none" } }));
  } else {
    const h = frame.height, w = Math.min(frame.width, h * 0.5), x = frame.x + (frame.width - w) / 2;
    out.push(fillRect(stableId(id, "body"), "device-body", { x, y: frame.y, width: w, height: h }, INK, { radius: "radius.round" }));
    screen = { x: x + 10, y: frame.y + 28, width: w - 20, height: h - 56 };
  }
  if (props.image.dataUri) out.push(mediaNode({ id: stableId(id, "screen"), role: "image", frame: screen, props: props.image, fit: "cover" }));
  else {
    out.push(fillRect(stableId(id, "screen"), "image-frame", screen, MUTED, { data: { alt: props.image.alt } }));
    const m = measure(props.image.alt, screen.width - 24, "type.compact");
    out.push(label(stableId(id, "alt"), "device-alt", { x: screen.x + 12, y: screen.y + (screen.height - m.height) / 2, width: screen.width - 24 }, m, style("type.compact", SECONDARY, false, "center")));
  }
  return out;
}

/* --------------------------------------------------------------- worksheet */

// A worksheet: labelled boxes with the prompt for what goes in each, left for
// the reader to fill. Workshop and training decks use it to hand the method
// over; the prompts are the content.
function normalizeWorksheet(props) {
  return between(props.fields, 2, 9, "A worksheet").map((f, i) => {
    if (!clean(f?.label) || !clean(f?.prompt)) throw new Error(`Worksheet field ${i + 1} needs a label and a prompt`);
    const span = f.span ?? 1;
    if (![1, 2, 3].includes(span)) throw new Error(`Worksheet field ${i + 1}: span is 1, 2 or 3`);
    return { label: clean(f.label), prompt: clean(f.prompt), span };
  });
}

export function worksheetLayout(frame, props) {
  const fields = normalizeWorksheet(props), columns = props.columns ?? 3, gap = v("space.4");
  const unit = (frame.width - gap * (columns - 1)) / columns;
  const rows = []; let row = [], used = 0;
  for (const f of fields) { const span = Math.min(f.span, columns); if (used + span > columns) { rows.push(row); row = []; used = 0; } row.push({ ...f, span }); used += span; }
  if (row.length) rows.push(row);
  const measured = rows.map((r) => r.map((f) => {
    const w = unit * f.span + gap * (f.span - 1) - 2 * v("space.3");
    return { ...f, width: w, title: measure(f.label, w, "type.body", true), text: measure(f.prompt, w, "type.compact") };
  }));
  const min = measured.map((r) => Math.max(...r.map((f) => f.title.height + v("space.1") + f.text.height)) + 2 * v("space.3") + 40);
  return { rows: measured, columns, gap, unit, min, height: min.reduce((a, b) => a + b, 0) + gap * (rows.length - 1) };
}

export function worksheetNodes({ id, frame, props }) {
  const L = worksheetLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`The worksheet needs ${Math.ceil(L.height)}px and has ${Math.floor(frame.height)}px; drop a field`);
  const out = [], spare = (frame.height - L.height) / L.rows.length;
  let y = frame.y;
  L.rows.forEach((row, r) => {
    const h = L.min[r] + spare; let x = frame.x;
    row.forEach((f, c) => {
      const w = L.unit * f.span + L.gap * (f.span - 1), fid = stableId(id, "field", r, c);
      out.push(fillRect(stableId(fid, "box"), "worksheet-box", { x, y, width: w, height: h }, "none", { stroke: RULE, radius: "radius.small" }));
      out.push(label(stableId(fid, "label"), "worksheet-label", { x: x + v("space.3"), y: y + v("space.3"), width: f.width }, f.title, style("type.body", INK, true)));
      out.push(label(stableId(fid, "prompt"), "worksheet-prompt", { x: x + v("space.3"), y: y + v("space.3") + f.title.height + v("space.1"), width: f.width }, f.text, style("type.compact", SECONDARY)));
      x += w + L.gap;
    });
    y += h + L.gap;
  });
  return out;
}

/* ------------------------------------------------------------------ speech */

// People and what they said, in speech bubbles above them: the interview page
// where the speaker matters as much as the line. Two to four speakers.
function normalizeSpeech(props) {
  return between(props.items, 2, 4, "A speech page").map((item, i) => {
    if (!clean(item?.speaker) || !clean(item?.quote)) throw new Error(`Speaker ${i + 1} needs a name and a quote`);
    return { speaker: clean(item.speaker), role: clean(item.role), quote: clean(item.quote), icon: item.icon ?? null };
  });
}

export function speechLayout(frame, props) {
  const items = normalizeSpeech(props), gap = v("space.5");
  const width = (frame.width - gap * (items.length - 1)) / items.length, inner = width - 2 * v("space.4");
  const measured = items.map((item) => ({ item, quote: measure(`“${item.quote}”`, inner, "type.body"),
    name: measure(item.speaker, width, "type.compact", true), role: item.role ? measure(item.role, width, "type.label") : null }));
  if (measured.some((m) => m.quote.lines.length > 8)) throw new Error("A quote in a speech bubble runs to eight lines at most; cut it to the line that matters");
  const bubble = Math.max(...measured.map((m) => m.quote.height)) + 2 * v("space.4");
  const avatar = 52, foot = avatar + v("space.2") + Math.max(...measured.map((m) => m.name.height + (m.role ? m.role.height : 0)));
  return { measured, gap, width, inner, bubble, avatar, foot, height: bubble / 0.84 + v("space.3") + foot };
}

export function speechNodes({ id, frame, props }) {
  const L = speechLayout(frame, props);
  if (L.height > frame.height + 0.01) throw new Error(`The speech page needs ${Math.ceil(L.height)}px and has ${Math.floor(frame.height)}px; shorten the quotes`);
  const out = [], top = frame.y + (frame.height - L.height) / 2, bubbleH = L.bubble / 0.84;
  L.measured.forEach((m, i) => {
    const x = frame.x + i * (L.width + L.gap), sid = stableId(id, "speaker", i);
    out.push(shapePrimitive({ id: stableId(sid, "bubble"), role: "speech-bubble", geometry: "quoteCallout", frame: { x, y: top, width: L.width, height: bubbleH },
      style: { fill: i % 2 ? MUTED : TINT, stroke: "none" }, data: { bodyRatio: 0.84, caretCenterRatio: 0.5, caretWidthRatio: 0.12 } }));
    out.push(label(stableId(sid, "quote"), "speech-quote", { x: x + v("space.4"), y: top + v("space.4"), width: L.inner }, m.quote, style("type.body", INK)));
    const ay = top + bubbleH + v("space.3"), ax = x + (L.width - L.avatar) / 2;
    if (m.item.icon) out.push(...iconMarker({ id: stableId(sid, "avatar"), role: "speech-avatar", x: ax, y: ay, size: L.avatar, icon: m.item.icon, tone: "filled" }));
    else {
      out.push(ellipsePrimitive({ id: stableId(sid, "avatar"), role: "speech-avatar", frame: { x: ax, y: ay, width: L.avatar, height: L.avatar }, style: { fill: PRIMARY, stroke: "none" } }));
      const initials = m.item.speaker.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      const im = measure(initials, L.avatar, "type.body", true);
      out.push(label(stableId(sid, "initials"), "speech-initials", { x: ax, y: ay + (L.avatar - im.height) / 2, width: L.avatar }, im, style("type.body", WHITE, true, "center")));
    }
    let ny = ay + L.avatar + v("space.2");
    out.push(label(stableId(sid, "name"), "speech-name", { x, y: ny, width: L.width }, m.name, style("type.compact", INK, true, "center")));
    if (m.role) out.push(label(stableId(sid, "role"), "speech-role", { x, y: ny + m.name.height, width: L.width }, m.role, style("type.label", SECONDARY, false, "center")));
  });
  return out;
}


/* ---------------------------------------------------------- side-statement */

// The panel of a sidebar page: the statement set large in a filled column, a
// short accent bar above it. A question, a claim or the page's single figure;
// the evidence sits beside it.
export function sideStatementLayout(frame, props) {
  if (!clean(props.text)) throw new Error("A side statement needs its text");
  const inner = frame.width - 2 * v("space.5");
  const text = measure(props.text, inner, "type.heading", true, DISPLAY);
  if (text.lines.length > 8) throw new Error("A side statement runs to eight lines at most; it is the page's reading, not its argument");
  const kicker = clean(props.kicker) ? measure(props.kicker, inner, "type.label", true) : null;
  return { inner, text, kicker, height: text.height + (kicker ? kicker.height + v("space.3") : 0) + v("space.4") + 2 * v("space.5") };
}

export function sideStatementNodes({ id, frame, props }) {
  const L = sideStatementLayout(frame, props);
  const tone = props.tone ?? "dark", light = tone === "muted" || tone === "tint";
  const fill = tone === "primary" ? PRIMARY : tone === "muted" ? MUTED : tone === "tint" ? TINT : INK;
  const ink = light ? INK : WHITE, out = [fillRect(stableId(id, "panel"), "side-panel", frame, fill)];
  let y = frame.y + Math.max(v("space.5"), (frame.height - L.height) / 2 + v("space.5"));
  const x = frame.x + v("space.5");
  out.push(fillRect(stableId(id, "bar"), "side-panel-bar", { x, y, width: 32, height: 3 }, ACCENT));
  y += v("space.4");
  if (L.kicker) { out.push(label(stableId(id, "kicker"), "side-panel-kicker", { x, y, width: L.inner }, L.kicker, style("type.label", light ? SECONDARY : WHITE, true))); y += L.kicker.height + v("space.3"); }
  out.push(label(stableId(id, "text"), "side-panel-text", { x, y, width: L.inner }, L.text, style("type.heading", ink, true, "left", DISPLAY)));
  return out;
}

/* ------------------------------------------------------------- radial-bars */

// Concentric arcs, one per item, each swept in proportion to its value: the
// familiar radial bar (three survey shares as rings, a nested set of
// half-circles). Each arc runs clockwise from twelve o'clock over at most three
// quarters of a turn, so the empty quarter holds every ring's figure and label
// on the ring's own line. The rings are shares of different wholes read side by
// side; a split of one whole belongs in a pie.
const RADIAL_SWEEP = 270;
function normalizeRadial(props) {
  const max = props.max ?? 100;
  if (!(Number.isFinite(max) && max > 0)) throw new Error("A radial bar's max must be a positive number");
  const unit = props.unit ?? (max === 100 ? "%" : "");
  const items = between(props.items, 2, 6, "A radial bar");
  // The rings' figures are read together, so they share one precision: 40.0%
  // beside 32.5%, not 40% - a decimal for all when any ring needs one.
  const decimals = items.some((item) => Number(Number(item?.value).toFixed(1)) % 1 !== 0) ? 1 : 0;
  return items.map((item, i) => {
    if (!clean(item?.label)) throw new Error(`Radial ring ${i + 1} needs a label`);
    const value = Number(item.value);
    if (!(value >= 0 && value <= max)) throw new Error(`Radial ring ${i + 1}: value must be between 0 and ${max}`);
    return { label: clean(item.label), value, display: clean(item.display) ?? `${value.toFixed(decimals)}${unit}`, highlight: item.highlight === true };
  });
}

export function radialBarsLayout(frame, props) {
  const items = normalizeRadial(props), max = props.max ?? 100;
  const valueWidth = Math.max(...items.map((item) => measure(item.display, 400, "type.body", true).width)) + 2;
  // Measured for its height, the figure asks for a 420px circle; placed, it takes
  // the height it is given. In a narrow frame the circle gives up radius until
  // every label sits on its own ring's line: a smaller figure that reads beats
  // a larger one whose labels run into the ring below.
  const widest = Math.floor(Math.min(Number.isFinite(frame.height) ? frame.height : 420, frame.width * 0.62) / 2);
  let failure = null;
  for (let R = widest; R >= 60; R -= 8) {
    const hole = R * 0.26, band = (R - hole) / items.length, thickness = band * 0.72;
    if (thickness < 10) { failure ??= "The radial bar is too small for its rings; enlarge it or drop a ring"; break; }
    const labelMax = frame.width - R - valueWidth - v("space.3") - v("space.2");
    if (labelMax < 90) { failure = "A radial bar needs room left of its centre for the ring labels; widen it"; continue; }
    const rows = items.map((item) => ({ item, text: measure(item.label, labelMax, "type.compact"), sweep: RADIAL_SWEEP * item.value / max }));
    const tall = rows.find((row) => row.text.height > band + 0.01);
    if (tall) { failure = `Radial ring label "${tall.item.label}" needs ${Math.ceil(tall.text.height)}px and its ring has ${Math.floor(band)}px; shorten it`; continue; }
    const labelWidth = Math.max(...rows.map((row) => row.text.width)) + 2;
    const left = Math.max(R, labelWidth + valueWidth + v("space.3") + v("space.2"));
    return { rows, R, hole, band, thickness, valueWidth, labelWidth, left, width: left + R, height: 2 * R };
  }
  throw new Error(failure ?? "The radial bar is too small for its rings; enlarge it or drop a ring");
}

// An annular sector as a polygon in the fractions of its square frame.
function annulus(size, outer, inner, from, to) {
  const c = size / 2, steps = Math.max(2, Math.ceil(Math.abs(to - from) / 3));
  const at = (r, deg) => { const t = (deg - 90) * Math.PI / 180; return [Number(((c + r * Math.cos(t)) / size).toFixed(5)), Number(((c + r * Math.sin(t)) / size).toFixed(5))]; };
  const outerArc = Array.from({ length: steps + 1 }, (_, i) => at(outer, from + (to - from) * i / steps));
  const innerArc = Array.from({ length: steps + 1 }, (_, i) => at(inner, to - (to - from) * i / steps));
  return [[...outerArc, ...innerArc]];
}

export function radialBarsNodes({ id, frame, props }) {
  const L = radialBarsLayout(frame, props);
  if (L.height > frame.height + 0.01 || L.width > frame.width + 0.01) throw new Error("The radial bar does not fit its frame; give it a squarer, larger frame or drop a ring");
  const cx = frame.x + (frame.width - L.width) / 2 + L.left, cy = frame.y + (frame.height - L.height) / 2 + L.R;
  const square = { x: cx - L.R, y: cy - L.R, width: 2 * L.R, height: 2 * L.R };
  const size = 2 * L.R, out = [];
  L.rows.forEach((row, i) => {
    const rid = stableId(id, "ring", i), outer = L.R - i * L.band, inner = outer - L.thickness;
    const fill = row.item.highlight ? ACCENT : PRIMARY;
    if (row.sweep > 0.01) out.push(shapePrimitive({ id: stableId(rid, "arc"), role: "radial-arc", geometry: "customPolygon", frame: square, style: { fill, stroke: "none", lineWidth: token("line.hairline") }, data: { paths: annulus(size, outer, inner, 0, row.sweep), value: row.item.value, label: row.item.label } }));
    if (row.sweep < RADIAL_SWEEP - 0.01) out.push(shapePrimitive({ id: stableId(rid, "track"), role: "radial-track", geometry: "customPolygon", frame: square, style: { fill: MUTED, stroke: "none", lineWidth: token("line.hairline") }, data: { paths: annulus(size, outer, inner, row.sweep, RADIAL_SWEEP) } }));
    // The figure sits against the vertical through the centre, the label to its
    // left, both centred on the ring's own band.
    const mid = cy - outer + L.thickness / 2;
    const value = measure(row.item.display, L.valueWidth, "type.body", true);
    out.push(label(stableId(rid, "value"), "radial-value", { x: cx - v("space.2") - L.valueWidth, y: mid - value.height / 2, width: L.valueWidth }, value, style("type.body", row.item.highlight ? ACCENT : INK, true, "right")));
    out.push(label(stableId(rid, "label"), "radial-label", { x: cx - v("space.2") - L.valueWidth - v("space.3") - L.labelWidth, y: mid - row.text.height / 2, width: L.labelWidth }, row.text, style("type.compact", SECONDARY, false, "right")));
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
  "fact-grid": { items: [{ value: "63m", label: "(Insert what it counts)" }, { value: "1,200+", label: "(Insert what it counts)" }, { value: "47%", label: "(Insert what share it measures)", gauge: 0.47 }], columns: 3 },
  "zone-matrix": { xAxis: { label: "(Insert axis)" }, yAxis: { label: "(Insert axis)" }, points: [{ label: "(Insert item)", x: 0.3, y: 0.7 }, { label: "(Insert item)", x: 0.8, y: 0.8 }] },
  "device-frame": { device: "laptop", image: { alt: "(Insert what the screenshot shows)" } },
  worksheet: { fields: [{ label: "(Insert field)", prompt: "(Insert the question it answers)", span: 3 }, { label: "(Insert field)", prompt: "(Insert the question)" }, { label: "(Insert field)", prompt: "(Insert the question)" }] },
  speech: { items: [{ speaker: "(Insert name)", quote: "(Insert what they said)" }, { speaker: "(Insert name)", quote: "(Insert what they said)" }] },
  "side-statement": { text: "(Insert the statement the page makes)", kicker: "(Insert a label)" },
  "radial-bars": { items: [{ label: "(Insert what the first share counts)", value: 93 }, { label: "(Insert what the second share counts)", value: 91 }, { label: "(Insert what the third share counts)", value: 77, highlight: true }] },
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
  "fact-grid": { useWhen: "three to nine separate facts, each a figure with its label, on a 'by the numbers' page", why: "a grid of equal tiles lets each figure read on its own and the set read as a profile", actionTitle: "state what the facts together say" },
  "zone-matrix": { useWhen: "items plotted on two judged axes whose combination grades them, such as likelihood against impact", why: "graded zones show where attention belongs without asserting a verdict colour", actionTitle: "state which items sit in the highest zone" },
  "device-frame": { useWhen: "a product or document screenshot, shown as a customer sees it", why: "the device frame says the image is the working product, not an illustration", actionTitle: "state what the screen shows the customer can do" },
  worksheet: { useWhen: "handing a method over: the fields to complete and the question each answers", why: "labelled empty boxes make the method usable in the room", actionTitle: "state what completing the worksheet produces" },
  speech: { useWhen: "two to four people and what they said, when who said it matters", why: "bubbles above named speakers keep each line attached to its source", actionTitle: "state what the voices agree on or disagree about" },
  "radial-bars": { useWhen: "two to six shares of different wholes, such as the percentage agreeing with each survey statement, on a page that wants a visual rather than a bar list", why: "rings of one length scale keep the shares comparable while reading as one figure; the figure and label sit on each ring's line", actionTitle: "state which share leads and by how much" },
  "side-statement": { useWhen: "the panel of a sidebar page: a question, claim or figure the content beside it supports", why: "a filled column in heading type reads first and holds the page's one idea", actionTitle: "let the panel carry the question and the title the answer" },
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
  "fact-grid": [factGridNodes, factGridLayout, { width: 1160, height: 440 }],
  "zone-matrix": [zoneMatrixNodes, zoneMatrixLayout, { width: 1160, height: 460 }],
  "device-frame": [deviceFrameNodes, deviceFrameLayout, { width: 720, height: 440 }],
  worksheet: [worksheetNodes, worksheetLayout, { width: 1160, height: 440 }],
  speech: [speechNodes, speechLayout, { width: 1160, height: 400 }],
  "side-statement": [sideStatementNodes, sideStatementLayout, { width: 380, height: 508 }],
  "radial-bars": [radialBarsNodes, radialBarsLayout, { width: 760, height: 420 }],
};

export const FIGURE_IDS = Object.freeze(Object.keys(RENDER));

export function registerFigures(registry) {
  for (const [id, [nodes, layout, preferredSize]] of Object.entries(RENDER)) {
    registry.set(id, { id, version: "1.0.0", category: "diagram", role: id, tokens: [...FIGURE_TOKENS], preferredSize,
      sample: SAMPLES[id], render: (input) => ({ nodes: nodes(input) }), measureContent: ({ frame, props }) => layout(frame, props),
      ...(id === "fact-grid" ? { measureCeiling: ({ frame, props }) => factGridCeiling(frame, props) } : {}),
      guidance: GUIDANCE[id] });
  }
  return registry;
}
