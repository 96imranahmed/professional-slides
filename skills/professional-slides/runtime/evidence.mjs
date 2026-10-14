// Tables and exhibits read without the layout engine: what a table is, its
// rows and cells as the reader reads them, and how many values an exhibit
// plots. The compiler (page-types.mjs), the binding and the number checks
// read these.


// One definition of "a table", so no two checks disagree about what is one.
const TABLE_TYPES = new Set(["table", "comparison-table", "heatmap", "trend-rows", "insight-tree-table"]);
/** Is this exhibit a grid of rows the table checks read? */
export const isTable = (ex) => TABLE_TYPES.has(String(ex?.type ?? "")) && Array.isArray(ex.rows);
/** A table row's cells: a row is an array, or `{ cells, label?, style? }`. */
export const rowCells = (row) => (Array.isArray(row) ? row : Array.isArray(row?.cells) ? row.cells : []);

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
const JUDGED_CELLS = new Set(["harvey", "rag", "lights", "check", "dot", "trend", "binary"]);
export const judgedCell = (cell) => Boolean(cell) && typeof cell === "object" && JUDGED_CELLS.has(cell.type);
const numericCells = (ex) => ex.rows.reduce((n, row) => n + resultCells(row).filter((c) => !judgedCell(c) && /\d/.test(cellText(c))).length, 0);

export function plottedValues(ex, { printed = false } = {}) {
  if (Array.isArray(ex)) return ex.reduce((n, e) => n + plottedValues(e, { printed }), 0);
  if (!ex || typeof ex !== "object") return 0;
  const type = String(ex.type ?? "");
  if (type === "chart-group") return (ex.charts || []).reduce((n, c) => n + plottedValues({ type: c?.component, ...(c?.props || {}) }), 0);
  if (type === "chart.waffle") return (ex.categories || []).length;
  if (type === "pictogram") return (ex.rows || []).length;
  // A zone matrix places things on two judged axes - likelihood against impact - so its positions are judgements, not
  // measurements; a deck's risk map was refused for "plotting six numbers" that no insight could hold.
  if (type === "zone-matrix") return 0;
  if (isTable(ex)) return numericCells(ex);
  if (Array.isArray(ex.boxes)) return ex.boxes.length * 5;
  if (Array.isArray(ex.low) && Array.isArray(ex.high)) return counted(ex.low) + counted(ex.high);
  // A point on a scatter is read on both axes - two values, three with a
  // bubble's size - as a box is its five figures: a seven-point demand curve
  // plots fourteen, where a single series of seven bars plots seven.
  const reads = type === "chart.bubble" ? 3 : type === "chart.scatter" ? 2 : 1;
  if (Array.isArray(ex.series) && ex.series.length)
    return ex.series.reduce((n, s) => n + (Array.isArray(s?.points) ? s.points.length * reads : counted(s?.values)), 0) + counted(ex.targets);
  if (Array.isArray(ex.points)) return ex.points.length * reads;
  if (Array.isArray(ex.values)) return ex.values.flat().filter(finite).length;
  // `printed`: a figure bound and printed ("29%") is a number the reader reads as a typed one (29) is - the evidence floor
  // counts both, so a page drawn at the spine and laid out reads the same; the binding gates count only what was typed.
  // A trellis of stacks plots each panel's parts (`series`), a value a part a category.
  if (Array.isArray(ex.items)) return ex.items.reduce((n, item) => n + (Array.isArray(item?.series) ? item.series.reduce((m, part) => m + counted(part?.values), 0) : Array.isArray(item?.values) ? counted(item.values) : finite(item?.value) || (printed && typeof item?.value === "string" && /\d/.test(item.value)) ? 1 : 0), 0);
  // A marker plots its value; one that only places a city on the map plots nothing - its coordinates are where, not how much.
  if (Array.isArray(ex.markers)) return ex.markers.filter((marker) => finite(marker?.value)).length;
  return 0;
}

