// What a bar or column chart sets against groups of its marks and against
// single labels, as strong decks annotate them:
//
//   groupBrackets: [{ categories, label, value }]
//       a bracket over (or beside) a run of categories with their sum or
//       their share of the whole - "47.5% of total" - printed at it.
//   valueLabels: [{ category, series, display, estimate, ring }]
//       a mark's printed value said another way - a range ("20-30") or an
//       approximation ("~446") - which marks the bar as an estimate, drawn
//       lighter as an assumption is; `ring: true` circles a label the page
//       turns on.
//
// The bracket's figure is computed from the plotted values, never typed, so
// it states what the marks show.
import { ellipsePrimitive, linePrimitive, rectPrimitive, stableId, textPrimitive, token, tokenValue } from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { formatValue } from "./value-format.mjs";
import { FONT, INK, CHART_LABEL, textStyle, lineStyle, labelBold } from "./chart-axes.mjs";

export const BRACKETS_MAX = 3;
const BRACKET_VALUES = Object.freeze(["sum", "share", "none"]);
// A bracket's text is a figure and a few words: past this width it is a callout.
const BRACKET_TEXT_WIDTH = 150;
// The bracket's arm, and the gap to its text.
const ARM = 5, GAP = 6;
// The band over a column chart a bracket and its text take above the tallest mark of its run.
export const BRACKET_BAND = 36;

const face = () => ({ fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL), bold: labelBold() });

/** The category's plotted total: its one value, or its stack (the positive parts). */
const totalAt = (series, at, stacked) => (stacked ? series.reduce((sum, item) => sum + Math.max(0, item.values[at] ?? 0), 0) : series.reduce((sum, item) => sum + (item.values[at] ?? 0), 0));

/**
 * The brackets a chart's props ask for, checked and their text written:
 * `{ from, to, text, layout, index }` with from-to the category indices.
 */
export function normalizeGroupBrackets(props = {}, categories = [], series = [], { stacked = false } = {}) {
  if (props.groupBrackets === undefined) return [];
  if (!Array.isArray(props.groupBrackets) || !props.groupBrackets.length) throw new Error("groupBrackets must be a nonempty array of { categories, label, value }");
  if (props.groupBrackets.length > BRACKETS_MAX) throw new Error(`a chart carries ${BRACKETS_MAX} group brackets at most (this one has ${props.groupBrackets.length}); more groups are a stacked or grouped chart`);
  const names = categories.map(String), taken = new Set();
  const whole = categories.reduce((sum, _, at) => sum + totalAt(series, at, stacked), 0);
  return props.groupBrackets.map((bracket, index) => {
    const where = `group bracket ${index + 1}`;
    if (!bracket || !Array.isArray(bracket.categories) || bracket.categories.length < 2) throw new Error(`${where} names two or more categories in \`categories\``);
    const at = bracket.categories.map((name) => names.indexOf(String(name)));
    if (at.some((i) => i < 0)) throw new Error(`${where} names "${bracket.categories[at.indexOf(-1)]}", which is not one of the chart's categories`);
    const sorted = [...at].sort((a, b) => a - b);
    if (sorted.some((i, k) => k && i !== sorted[k - 1] + 1)) throw new Error(`${where} brackets categories that sit together on the axis; ${bracket.categories.join(", ")} do not - order the categories so the group is a run, or bracket each run`);
    if (sorted.some((i) => taken.has(i))) throw new Error(`${where} overlaps another bracket; a category belongs to one group`);
    sorted.forEach((i) => taken.add(i));
    if (sorted.length === names.length) throw new Error(`${where} brackets every category, which is the total - print it as the chart's total or in the heading`);
    const value = bracket.value ?? "sum";
    if (!BRACKET_VALUES.includes(value)) throw new Error(`${where}: value is one of ${BRACKET_VALUES.map((v) => `"${v}"`).join(", ")}`);
    if (bracket.label !== undefined && (typeof bracket.label !== "string" || !bracket.label.trim())) throw new Error(`${where}: label is a few words after the figure ("of total", "Top three")`);
    if (value === "none" && !bracket.label) throw new Error(`${where} prints nothing: give it a label or a value`);
    const sum = sorted.reduce((total, i) => total + totalAt(series, i, stacked), 0);
    if (value === "share" && !(whole > 0)) throw new Error(`${where} prints a share of the whole, and the chart's values do not sum to a positive whole`);
    const figure = value === "sum" ? formatValue(sum, props) : value === "share" ? `${(sum / whole * 100).toFixed(sum / whole * 100 >= 10 ? 0 : 1)}%` : "";
    const text = [figure, bracket.label?.trim()].filter(Boolean).join(" ");
    const layout = measureText(text, BRACKET_TEXT_WIDTH, face());
    if (layout.lines.length > 2) throw new Error(`${where}: "${text}" runs past two lines; a bracket carries a figure and a few words`);
    return { from: sorted[0], to: sorted.at(-1), text, layout, index, sum, value };
  });
}

/** The gutter a horizontal chart's brackets take at its right: the arm and the widest text. */
export function bracketGutter(brackets) {
  return brackets.length ? ARM + GAP + Math.ceil(Math.max(...brackets.map((b) => b.layout.width))) + 4 : 0;
}

/**
 * Each bracket drawn: on a bar chart a rule down the right of its rows, past
 * every value label, with the text beside it; on a column chart a rule over
 * its columns, above their tallest value label, with the text over it.
 */
export function bracketNodes({ id, brackets, horizontal, plot, categories, nodes, rightOf }) {
  const out = [];
  for (const bracket of brackets) {
    const names = new Set(categories.slice(bracket.from, bracket.to + 1).map(String));
    const marks = nodes.filter((node) => ["chart-mark", "data-label"].includes(node.role) && names.has(String(node.data?.category)));
    const data = { bracket: bracket.index, categories: [...names], value: bracket.value, sum: bracket.sum };
    if (horizontal) {
      const rows = marks.filter((node) => node.role === "chart-mark").map((node) => node.frame);
      const top = Math.min(...rows.map((r) => r.y)) + 1, bottom = Math.max(...rows.map((r) => r.y + r.height)) - 1, x = rightOf;
      for (const [part, x1, y1, x2, y2] of [["spine", x, top, x, bottom], ["top", x - ARM, top, x, top], ["bottom", x - ARM, bottom, x, bottom]])
        out.push(linePrimitive({ id: stableId(id, "group-bracket", bracket.index, part), role: "chart-bracket", x1, y1, x2, y2, style: lineStyle(INK, token("line.hairline")), data }));
      const height = bracket.layout.height;
      out.push(textPrimitive({ id: stableId(id, "group-bracket-label", bracket.index), role: "chart-bracket-label", frame: { x: x + GAP, y: (top + bottom) / 2 - height / 2, width: Math.ceil(bracket.layout.width) + 2, height },
        text: bracket.layout.text, style: { ...textStyle(CHART_LABEL, INK, true, "left"), valign: "top", lineHeight: bracket.layout.lineHeight, wrap: false }, data: { ...data, textLayout: bracket.layout } }));
      continue;
    }
    const lanes = categories.slice(bracket.from, bracket.to + 1).map((name) => nodes.find((node) => node.role === "chart-mark" && String(node.data?.category) === String(name))).filter(Boolean).map((node) => node.frame);
    const left = Math.min(...lanes.map((f) => f.x)), right = Math.max(...lanes.map((f) => f.x + f.width));
    // Just over the run's tallest mark and its value label; the plot's top band holds it over the tallest of all (BRACKET_BAND).
    const y = Math.min(...marks.map((node) => node.frame.y)) - 8;
    for (const [part, x1, y1, x2, y2] of [["spine", left, y, right, y], ["left", left, y, left, y + ARM], ["right", right, y, right, y + ARM]])
      out.push(linePrimitive({ id: stableId(id, "group-bracket", bracket.index, part), role: "chart-bracket", x1, y1, x2, y2, style: lineStyle(INK, token("line.hairline")), data }));
    const width = Math.ceil(bracket.layout.width) + 2;
    out.push(textPrimitive({ id: stableId(id, "group-bracket-label", bracket.index), role: "chart-bracket-label", frame: { x: (left + right) / 2 - width / 2, y: y - bracket.layout.height - 3, width, height: bracket.layout.height },
      text: bracket.layout.text, style: { ...textStyle(CHART_LABEL, INK, true, "center"), valign: "top", lineHeight: bracket.layout.lineHeight, wrap: false }, data: { ...data, textLayout: bracket.layout } }));
  }
  return out;
}

/**
 * A chart's label overrides, checked, keyed `<series>:<category>`: the text
 * to print in place of the value, whether the mark is an estimate, whether
 * its label is ringed.
 */
export function normalizeValueLabels(props = {}, categories = [], series = []) {
  if (props.valueLabels === undefined) return new Map();
  if (!Array.isArray(props.valueLabels) || !props.valueLabels.length) throw new Error("valueLabels must be a nonempty array of { category, series, display, estimate, ring }");
  const names = categories.map(String), seriesNames = series.map((item) => item.name), map = new Map();
  props.valueLabels.forEach((entry, index) => {
    const where = `value label ${index + 1}`;
    if (!entry || !names.includes(String(entry.category))) throw new Error(`${where} names a category of the chart in \`category\` (${names.slice(0, 8).join(", ")})`);
    const name = entry.series ?? (seriesNames.length === 1 ? seriesNames[0] : undefined);
    if (!seriesNames.includes(name)) throw new Error(`${where} on a chart of ${seriesNames.length} series names its \`series\` (${seriesNames.join(", ")})`);
    if (entry.display !== undefined && (typeof entry.display !== "string" || !entry.display.trim() || entry.display.length > 12)) throw new Error(`${where}: display is the value said another way - a range ("20-30") or an approximation ("~446") - in 12 characters at most`);
    if (entry.display === undefined && entry.ring !== true && entry.estimate === undefined) throw new Error(`${where} changes nothing: give it a \`display\`, \`estimate: true\` or \`ring: true\``);
    const key = `${name}:${entry.category}`;
    if (map.has(key)) throw new Error(`${where} repeats ${entry.category}${series.length > 1 ? ` (${name})` : ""}`);
    // A value said as a range or an approximation is an estimate, unless the author says otherwise.
    map.set(key, { display: entry.display?.trim(), estimate: entry.estimate ?? entry.display !== undefined, ring: entry.ring === true });
  });
  return map;
}

/** A ring round each label the page turns on, clear of its ink. */
export function labelRings({ id, nodes, valueLabels }) {
  const out = [];
  for (const label of nodes.filter((node) => node.role === "data-label" && node.data?.category !== undefined && valueLabels.get(`${node.data.series}:${node.data.category}`)?.ring)) {
    const ink = measureText(label.text, 1000, face());
    const cx = label.style.align === "left" ? label.frame.x + ink.width / 2 : label.style.align === "right" ? label.frame.x + label.frame.width - ink.width / 2 : label.frame.x + label.frame.width / 2;
    const cy = label.frame.y + label.frame.height / 2;
    const width = ink.width + 16, height = ink.height + 10;
    out.push(ellipsePrimitive({ id: stableId(label.id, "ring"), role: "chart-label-ring", frame: { x: cx - width / 2, y: cy - height / 2, width, height }, style: { fill: "none", stroke: token("color.chartSubject"), lineWidth: token("line.standard") }, data: { category: label.data.category, series: label.data.series } }));
  }
  return out;
}

// A note level with each bar of a bar chart, in a column at its right: what a
// respondent said ("a verbatim"), the reason behind a figure, the action a row
// calls for. `rowNotes` runs one entry a category, in category order - text,
// or `{ text, tone, quote, arrow }` - `null` leaving a row bare.
//
//   tone   "positive" | "negative": a voice for or against, marked by a bar
//          of the verdict's colour at the note's left (a verdict is what the
//          status colours are kept for); the text stays ink
//   quote  true sets the text in quotation marks, as said
//   arrow  true draws a leader from the note back to its bar's value
export const ROW_NOTE_GAP = 14;
const ROW_NOTE_TONES = Object.freeze(["positive", "negative", "neutral"]);
const ROW_NOTE_WIDTH = Object.freeze({ min: 160, max: 360 });

/** A bar chart's row notes, checked: `{ width, notes }` with a note (or null) per category; null for a chart with none. */
export function normalizeRowNotes(props = {}, categories = [], { horizontal = false, frame } = {}) {
  if (props.rowNotes === undefined) return null;
  if (!horizontal) throw new Error("rowNotes sit level with a bar chart's rows; on columns, say it in a callout or under the chart");
  if (!Array.isArray(props.rowNotes) || props.rowNotes.length !== categories.length) throw new Error(`rowNotes carries one entry a category, in category order (${categories.length}), null for a row with none`);
  const notes = props.rowNotes.map((entry, at) => {
    if (entry === null || entry === undefined) return null;
    const note = typeof entry === "string" ? { text: entry } : entry;
    if (!note || typeof note.text !== "string" || !note.text.trim()) throw new Error(`row note ${at + 1} is text, or { text, tone, quote, arrow }`);
    if (note.tone !== undefined && !ROW_NOTE_TONES.includes(note.tone)) throw new Error(`row note ${at + 1}: tone is ${ROW_NOTE_TONES.map((t) => `"${t}"`).join(", ")} - a voice for, against or neither`);
    return { text: note.quote ? `“${note.text.trim().replace(/^[“"]|[”"]$/g, "")}”` : note.text.trim(), tone: note.tone, arrow: note.arrow === true };
  });
  if (!notes.some(Boolean)) throw new Error("rowNotes carries no note; drop it");
  const asked = props.rowNotesWidth;
  if (asked !== undefined && !(Number.isFinite(asked) && asked >= ROW_NOTE_WIDTH.min && asked <= ROW_NOTE_WIDTH.max)) throw new Error(`rowNotesWidth is the note column's width in px, ${ROW_NOTE_WIDTH.min} to ${ROW_NOTE_WIDTH.max}`);
  const width = asked ?? Math.max(ROW_NOTE_WIDTH.min, Math.min(ROW_NOTE_WIDTH.max, Math.round((frame?.width ?? 760) * 0.34)));
  return { width, notes };
}

/** Each row's note in the column at the chart's right, centred on its bar, with its tone bar and its leader. */
export function rowNoteNodes({ id, rowNotes, categories, categoryMap, nodes, left }) {
  const out = [], tone = { positive: token("color.positive"), negative: token("color.negative"), neutral: token("color.chartComparator") };
  const toned = rowNotes.notes.some((note) => note?.tone);
  rowNotes.notes.forEach((note, at) => {
    if (!note) return;
    const category = categories[at], lane = categoryMap.get(category);
    const x = left + (toned ? 8 : 0), width = rowNotes.width - (toned ? 8 : 0);
    const layout = measureText(note.text, width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL) });
    const room = lane.height + 14;
    if (layout.height > room) throw new Error(`row note ${at + 1} ("${note.text.slice(0, 40)}...") runs to ${layout.lines.length} lines, more than its row holds; cut it, widen the column (rowNotesWidth), or give the chart more height`);
    // Centred on the row's bars as drawn, which sit a few pixels inside their lane.
    const bars = nodes.filter((node) => node.role === "chart-mark" && node.data?.category === category).map((node) => node.frame);
    const mid = bars.length ? (Math.min(...bars.map((b) => b.y)) + Math.max(...bars.map((b) => b.y + b.height))) / 2 : lane.y + lane.height / 2;
    const y = mid - layout.height / 2, data = { category, rowNote: true, ...(note.tone ? { tone: note.tone } : {}) };
    if (note.tone) out.push(rectPrimitive({ id: stableId(id, "row-note-tone", category), role: "chart-row-note-tone", frame: { x: left, y, width: 3, height: layout.height }, style: { fill: tone[note.tone], stroke: "none", lineWidth: token("line.hairline") }, data }));
    out.push(textPrimitive({ id: stableId(id, "row-note", category), role: "chart-row-note", frame: { x, y, width, height: layout.height }, text: layout.text,
      style: { ...textStyle(CHART_LABEL, INK, false, "left"), valign: "top", lineHeight: layout.lineHeight, wrap: false }, data: { ...data, textLayout: layout } }));
    if (note.arrow) {
      // The bar's end, or its value's ink where the value is printed past it.
      const ink = (node) => (node.role === "data-label" && node.style?.align === "left" ? node.frame.x + measureText(node.text, 1000, face()).width : node.frame.x + node.frame.width);
      const ends = nodes.filter((node) => ["chart-mark", "data-label"].includes(node.role) && node.data?.category === category).map(ink);
      const from = Math.max(...ends) + 4;
      if (left - 6 - from > 12) out.push(linePrimitive({ id: stableId(id, "row-note-leader", category), role: "annotation-leader", x1: left - 6, y1: mid, x2: from, y2: mid, style: lineStyle(INK, token("line.hairline")), data: { ...data, endArrow: true } }));
    }
  });
  return out;
}
