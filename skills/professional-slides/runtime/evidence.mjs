// The evidence a page rests on, read without the layout engine: the shape of
// an insight's data and how wide it is (the insight log's vocabulary), and how
// many values an exhibit plots. The compiler (page-types.mjs), the storyline
// critique (storyline.mjs) and the variety contract (gates/variety_gates.mjs)
// all read these, so none of them needs the others to load.

import { isPeriodLabel } from "./time-axis.mjs";

// The table vocabulary the compiler and the variety contract both read: one
// definition of "a table", so no two checks disagree about what is one.
const TABLE_TYPES = new Set(["table", "comparison-table", "heatmap", "trend-rows", "insight-tree-table"]);
/** Is this exhibit a grid of rows the table checks read? */
export const isTable = (ex) => TABLE_TYPES.has(String(ex?.type ?? "")) && Array.isArray(ex.rows);
/** A table row's cells: a row is an array, or `{ cells, label?, style? }`. */
export const rowCells = (row) => (Array.isArray(row) ? row : Array.isArray(row?.cells) ? row.cells : []);

// The shape of the data behind a claim: a page type can only be chosen where
// the evidence has its shape - a ranking needs the whole peer set, a trend a
// series over time (page-types.mjs TYPE_SHAPES).
//
// A shape also has a breadth. Strong decks' chart pages plot a median of about
// twenty-two values; research that stops at the subject and one comparator - a
// "series" of four years, a "peer set" of three - plots about five. So each
// chart-bearing shape records how wide its data is - `breadth: { periods,
// series, members, parts, steps }`, or the `data` itself (`categories`,
// `series`, `points`, ...) for the counts to be read from - and the insight
// log refuses a shape narrower than a page needs while finding the longer
// window or the rest of the peer set is still research.
export const SHAPES = Object.freeze({
  series: { kind: "rate", means: "one measure over six or more periods, or four or more for two or more series (the subject and its peers or a benchmark)",
    needs: ({ periods = 0, series = 1 }) => periods >= 6 || (periods >= 4 && series >= 2),
    deepen: "the longer window (six or more periods), or the same measure for the peers or a benchmark over the same periods" },
  "peer-set": { kind: "rank", means: "one measure for every member of the set, six or more members",
    needs: ({ members = 0 }) => members >= 6, deepen: "the whole peer set on the same basis, six members or more" },
  mix: { kind: "share", means: "the parts of a whole, three or more", needs: ({ parts = 0 }) => parts >= 3, deepen: "the whole broken into three or more parts" },
  "measure-pair": { kind: "comparison", means: "two measures for each of eight or more members",
    needs: ({ members = 0 }) => members >= 8, deepen: "both measures for eight or more members of the set" },
  bridge: { kind: "structure", means: "the three or more steps between two totals",
    needs: ({ steps = 0 }) => steps >= 3, deepen: "the drivers of the change, three or more steps between the totals" },
  geography: { kind: "structure", means: "places with coordinates or regions" },
  schedule: { kind: "sequence", means: "dated phases, milestones or workstreams" },
  roster: { kind: "count", means: "the named members and their attributes" },
  fact: { kind: "count", means: "a few measured numbers" },
  qualitative: { kind: "qualitative", means: "sourced statements, judgements or mechanisms" },
});
const QUANT = ["series", "peer-set", "mix", "measure-pair", "bridge", "fact"];
export const TYPE_SHAPES = Object.freeze({
  trend: ["series"], ranking: ["peer-set"], composition: ["mix"], relationship: ["measure-pair"], bridge: ["bridge"],
  place: ["geography"], schedule: ["schedule"], profiles: ["roster", "peer-set"], numbers: [...QUANT],
  panels: [...QUANT], scorecard: ["peer-set", "roster", "qualitative", "measure-pair"], lookup: [...QUANT, "roster"],
});
const BREADTH_KEYS = { series: ["periods", "series"], "peer-set": ["members"], mix: ["parts"], "measure-pair": ["members"], bridge: ["steps"] };

/**
 * How wide an insight's data is: its `breadth` counts, over the counts read off its `data`.
 *
 * A mix's parts are what its chart splits the whole into. Where two or more
 * series stack over the categories (stacked bar or column, marimekko), each
 * category - a member, a period, a column - is a whole and the series are its
 * parts. Otherwise each category, label, item or row is a part and the one
 * series, if any, holds their values: a donut, pie, waffle, treemap,
 * pictogram or one-series stacked bar over A, B and C is three parts.
 */
export function breadthOf(insight) {
  const data = insight?.data && typeof insight.data === "object" ? insight.data : null;
  const n = (list) => (Array.isArray(list) ? list.length : undefined);
  const read = {};
  if (data) {
    const rows = n(data.categories) ?? n(data.labels) ?? n(data.points) ?? n(data.rows) ?? n(data.items) ?? n(data.values);
    const series = n(data.series);
    if (insight.shape === "series") Object.assign(read, { periods: rows, series: series ?? 1 });
    if (insight.shape === "peer-set" || insight.shape === "measure-pair") read.members = rows;
    if (insight.shape === "mix") read.parts = series >= 2 ? series : rows;
    if (insight.shape === "bridge" && rows !== undefined) read.steps = rows - 2;
  }
  const counts = { ...read, ...(insight?.breadth && typeof insight.breadth === "object" ? insight.breadth : {}) };
  return Object.fromEntries(Object.entries(counts).filter(([, v]) => Number.isFinite(v)));
}

/**
 * Why an insight's data is too narrow for its shape, or null. A chart-bearing
 * shape with no breadth recorded is refused with what to record, so a log
 * that records none names every insight to update at once.
 */
export function breadthProblem(insight) {
  const shape = SHAPES[insight?.shape];
  if (!shape?.needs) return null;
  const id = insight.id ?? "?", counts = breadthOf(insight);
  if (!Object.keys(counts).length)
    return `${id} (${insight.shape}): record how wide its data is - \`breadth: { ${BREADTH_KEYS[insight.shape].map((k) => `${k}: n`).join(", ")} }\` or the \`data\` itself - so the pages resting on it can be held to what a ${insight.shape} is: ${shape.means}`;
  if (shape.needs(counts)) return null;
  // A breadth recorded under another shape's key says nothing this shape reads: the repair is the key, not more research.
  const read = BREADTH_KEYS[insight.shape], other = Object.keys(counts).filter((key) => !read.includes(key));
  if (other.length && !read.some((key) => key in counts))
    return `${id} (${insight.shape}): \`breadth\` records ${other.map((key) => `\`${key}\``).join(", ")}, and a ${insight.shape} is counted in ${read.map((key) => `\`${key}\``).join(" and ")} - ${shape.means}. Write \`breadth: { ${read.map((key) => `${key}: n`).join(", ")} }\`${other.length === 1 && read.length === 1 ? ` (the ${counts[other[0]]} recorded as ${other[0]} ${counts[other[0]] === 1 ? "is its part" : `are its ${read[0]}`}, if that is what they count)` : ""}, or leave \`breadth\` out and give the \`data\` itself`;
  return `${id} (${insight.shape}): the data has ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")}; a ${insight.shape} is ${shape.means}. ` +
    `That is a research task before any page is written: find ${shape.deepen}. If the data does not exist, record the shape it has (\`fact\`) and carry it on a numbers page`;
}

// How many values an exhibit plots: every number a reader can read off it - a
// bar, a point on a line, a slice, a dot on a scatter, a box's five figures, a
// cell with a number in it (the row label is not one). A waffle counts its
// parts, not its squares: the squares are one count drawn out. A chart group
// is the sum of its charts, a page the sum of its exhibits.
export const finite = (v) => v !== null && v !== "" && typeof v !== "boolean" && !Array.isArray(v) && typeof v !== "object" && Number.isFinite(Number(v));
export const counted = (list) => (Array.isArray(list) ? list.filter(finite).length : 0);

// A table cell as the reader reads it: its text or value, or - for a logo
// drawn in place of a name - the player it names. Read as text alone, a logo
// cell would be blank, and a total row of player names refused as empty.
export const cellText = (cell) => {
  if (!cell || typeof cell !== "object") return String(cell ?? "");
  if (cell.blank === true) return "";
  const said = cell.text ?? cell.value ?? cell.label ?? cell.player ?? cell.media?.alt ?? cell.state ?? cell.score;
  return said === undefined || said === null ? "" : String(said);
};
// A row's label and the cells that carry its results. An array row leads with
// its label; an object row carries it as `label` or, without one, as its first cell.
const labelInCells = (row) => Array.isArray(row) || row?.label === undefined;
export const rowLabel = (row) => (labelInCells(row) ? rowCells(row)[0] : row.label);
export const resultCells = (row) => rowCells(row).slice(labelInCells(row) ? 1 : 0);
// A scorecard's judged cell - a Harvey ball, a RAG state, a lamp, a tick, a dot,
// an arrow, one of two states - is a grade on the author's scale, not a measurement:
// no measure holds it, so it is neither bound nor counted as a plotted value.
export const JUDGED_CELLS = new Set(["harvey", "rag", "lights", "check", "dot", "trend", "binary"]);
export const judgedCell = (cell) => Boolean(cell) && typeof cell === "object" && JUDGED_CELLS.has(cell.type);
const numericCells = (ex) => ex.rows.reduce((n, row) => n + resultCells(row).filter((c) => !judgedCell(c) && /\d/.test(cellText(c))).length, 0);

export function plottedValues(ex, { printed = false } = {}) {
  if (Array.isArray(ex)) return ex.reduce((n, e) => n + plottedValues(e, { printed }), 0);
  if (!ex || typeof ex !== "object") return 0;
  const type = String(ex.type ?? "");
  if (type === "chart-group") return (ex.charts || []).reduce((n, c) => n + plottedValues({ type: c?.component, ...(c?.props || {}) }), 0);
  if (type === "chart.waffle") return (ex.categories || []).length;
  if (type === "pictogram") return (ex.rows || []).length;
  if (isTable(ex)) return numericCells(ex);
  if (Array.isArray(ex.boxes)) return ex.boxes.length * 5;
  if (Array.isArray(ex.low) && Array.isArray(ex.high)) return counted(ex.low) + counted(ex.high);
  if (Array.isArray(ex.series) && ex.series.length)
    return ex.series.reduce((n, s) => n + (Array.isArray(s?.points) ? s.points.length : counted(s?.values)), 0) + counted(ex.targets);
  if (Array.isArray(ex.points)) return ex.points.length;
  if (Array.isArray(ex.values)) return ex.values.flat().filter(finite).length;
  // `printed`: a figure bound and printed ("29%") is a number the reader reads as a typed one (29) is - the evidence floor
  // counts both, so a page drawn at the spine and laid out reads the same; the binding gates count only what was typed.
  if (Array.isArray(ex.items)) return ex.items.reduce((n, item) => n + (Array.isArray(item?.values) ? counted(item.values) : finite(item?.value) || (printed && typeof item?.value === "string" && /\d/.test(item.value)) ? 1 : 0), 0);
  if (Array.isArray(ex.markers)) return ex.markers.length;
  return 0;
}

const isChart = (ex) => String(ex.type ?? "").startsWith("chart.");

/** A chart that shows two numbers of one series: a metric pair with a chart drawn round it. */
export function trivialChart(ex) {
  if (!isChart(ex) || ["chart.scatter", "chart.bubble", "chart.bubble-grid", "chart.waffle"].includes(ex.type)) return false;
  const series = Array.isArray(ex.series) ? ex.series.length : 1;
  const categories = Array.isArray(ex.categories) ? ex.categories.length : Array.isArray(ex.rows) ? ex.rows.length : Infinity;
  return series <= 1 && categories <= 2;
}

/** A chart over time: four or more period categories. */
export function trendChart(ex) {
  const categories = Array.isArray(ex.categories) ? ex.categories.map(String) : [];
  return isChart(ex) && categories.length >= 4 && categories.filter(isPeriodLabel).length >= Math.ceil(categories.length * 0.75);
}
