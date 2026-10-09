// Table treatment and inference: what the composer does to an authored
// table before the renderer sees it (`styleTable`). It sets a status
// column's cells as RAG pills by what a model reads them to say, derives and
// totals columns where the figures add up, infers the treatment a column's
// figures want - bars on one shared scale, open-ended and range bars,
// ratings, icons - and leaves untreated a grid that reads as text. `heavyTable` says when a table needs a page of its own.
import { groupThousands } from "./draw.mjs";
import { SCALAR_FIGURE, figureUnit, withUnit } from "./value-format.mjs";
import { decade } from "./nice-numbers.mjs";
import { measureText } from "./text-layout.mjs";
import { resultCells } from "./evidence.mjs";
import { judged } from "./judgements.mjs";

/**
 * Table treatment is chosen from what the table says, not from the first option
 * in the list. An explicit `treatment`, `variant` or object column wins.
 *   sequence  (rows numbered, or a Stage/Step/Phase first column) → numbered category
 *             markers on a filled first column ("categories" treatment)
 *   scorecard (criteria × options, ≥ 4 columns)                   → filled header ("standard")
 *   decision  (last column is a Decision/Then/So-what)             → filled header, accented last column
 *   listing   (anything else)                                      → open rules only
 */
// What a column of words says of each row - a status, a direction, a
// judgement or a fact - is read, not matched against a list of status words:
// the column's header and its words are put to a model once (column-reads,
// judgements.mjs) and the recorded answer sets the cells. A status column's
// cells become pills in the colour of each cell's state, keeping the author's
// words; a direction column's become trend rings; a progress column's
// percentages become progress bars. A column not yet answered stays text, and
// the compile lists its question as pending. Ticks and crosses are marks, not
// words, and are read as such.
const CELL_WORDS_MAX = 5;
const BLANK_CELL = /^[\s\-–—]*$/;
const PERCENT = /^(\d{1,3}(?:\.\d+)?)\s*%$/;
const STATE_RAG = { positive: "on-track", caution: "behind", negative: "at-risk", neutral: "neutral" };
const squeezed = (text) => String(text ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
// A cell the highlight pass has already claimed arrives as {text, highlight}
// rather than as a string, and is still read for its state: a scorecard
// whose highlight phrase is its own verdict word keeps the pill on the rows
// it names. A state is worth more than an accent, and a pill emphasises the
// word more than the accent would, so the typed cell wins and the redundant
// accent is dropped.
const claimedText = (value) => (value !== null && typeof value === "object" && value.type === undefined && typeof value.text === "string" && value.highlight !== undefined ? value.text : value);
const wordsOf = (cell) => {
  const text = claimedText(cell);
  return typeof text === "string" || typeof text === "number" ? String(text).trim() : null;
};

/**
 * The column-reads question a column puts: its header and the distinct words
 * of its short cells, with the table's headers as context. Null where it is
 * not asked: a column with fewer than two cells of five words or less, or
 * fewer such cells than half its written ones, is prose or figures, and a
 * figure other than a percentage (which may be progress) is a measure.
 */
export function columnQuestion(header, cells, headers) {
  const written = (cells || []).filter((cell) => !(cell === null || cell === undefined || (typeof cell !== "object" && BLANK_CELL.test(String(cell)))));
  const plain = written.map(wordsOf).filter((text) => text && !BLANK_CELL.test(text) && !/^(✓|✔|✗|✘|✕)$/.test(text)
    && text.split(/\s+/).length <= CELL_WORDS_MAX && (!SCALAR_FIGURE.test(text) || PERCENT.test(text)));
  if (plain.length < 2 || plain.length * 2 < written.length) return null;
  return { subject: { header: String(header ?? ""), cells: [...new Set(plain)] }, context: { headers: (headers || []).map((h) => String(h ?? "")) } };
}

/** A cell as its column's reading sets it: ✓/✗ as a check, and a status, direction or progress cell as its typed cell. */
export function readCell(value, reading) {
  const text = wordsOf(value);
  if (text === null) return value;
  if (/^(✓|✔)$/.test(text)) return { type: "check", value: "yes" };
  if (/^(✗|✘|✕)$/.test(text)) return { type: "check", value: "no" };
  const read = (list) => (list || []).find((entry) => squeezed(entry?.cell) === squeezed(text))?.value;
  if (reading?.verdict === "status" && STATE_RAG[read(reading.states)]) return { type: "rag", value: STATE_RAG[read(reading.states)], text };
  if (reading?.verdict === "direction" && ["up", "flat", "down"].includes(read(reading.directions))) return { type: "trend", value: read(reading.directions) };
  if (reading?.verdict === "progress" && PERCENT.test(text) && Number(text.match(PERCENT)[1]) <= 100) return { type: "progress", value: Number(text.match(PERCENT)[1]) };
  return value;
}

/** Each column's recorded reading (column-reads), by column index; the label column and a typed column are not read. */
function columnReadings(ex) {
  const headers = (ex.columns || []).map(columnLabel);
  return (ex.columns || []).map((column, c) => {
    if (!c || (column && typeof column === "object" && ((column.type && column.type !== "text") || column.heat || column.bar || column.harvey))) return null;
    const asked = columnQuestion(headers[c], (ex.rows || []).map((row) => resultCells(row)[c - 1]), headers);
    return asked && judged("column-reads", asked.subject, asked.context);
  });
}
const columnLabel = (c) => (typeof c === "string" ? c : c?.label || "");

/** Default rating scales so a spec can write `{ type: "harvey", value: 3 }` without declaring anchors. */
const DEFAULT_SCALES = {
  rating: { type: "harvey", label: "Rating", min: 0, max: 4, anchors: { 0: "None", 1: "Weak", 2: "Partial", 3: "Strong", 4: "Full" } },
  check: { type: "binary", label: "Meets requirement", test: "The option meets the requirement", labelDisplay: "none", states: { yes: "Yes", no: "No", missing: "Not assessed" } },
  heat: { type: "heatmap", label: "Score", min: 1, max: 5, anchors: { 1: "Lowest", 2: "Low", 3: "Medium", 4: "High", 5: "Highest" }, palette: "theme-sequential" },
};
function withDefaultScales(ex, rowsIn) {
  const scales = { ...(ex.scales || {}) };
  let used = false;
  // Where every column carrying ticks asks its question in the header
  // ("Resets?"), the key under the table is a sentence about nothing.
  const asks = (index) => /\?\s*$/.test(columnLabel((ex.columns || [])[index] ?? "").trim());
  const binaryColumns = new Set();
  for (const row of rowsIn) {
    const cells = Array.isArray(row) ? row : row?.cells;
    if (!Array.isArray(cells)) continue;
    cells.forEach((cell, index) => { if (cell && typeof cell === "object" && cell.type === "binary" && !cell.scale) binaryColumns.add(index); });
  }
  const selfEvident = binaryColumns.size > 0 && [...binaryColumns].every(asks);
  const rows = rowsIn.map((r) => Array.isArray(r) ? r.map((cell) => {
    if (!cell || typeof cell !== "object" || cell.scale || !["harvey", "binary", "heatmap"].includes(cell.type)) return cell;
    const id = cell.type === "harvey" ? "rating" : cell.type === "binary" ? "check" : "heat";
    used = true;
    scales[id] = scales[id] || (id === "check" && selfEvident
      ? { ...DEFAULT_SCALES.check, legend: false } : DEFAULT_SCALES[id]);
    // Binary states accept the words an author writes: positive/yes/true, negative/no/false.
    const value = cell.type === "binary" ? ({ positive: "yes", true: "yes", yes: "yes", negative: "no", false: "no", no: "no", missing: "missing", na: "missing" }[String(cell.value).toLowerCase()] ?? cell.value) : cell.value;
    return { ...cell, value, scale: id };
  }) : r);
  return { rows, ...(used || ex.scales ? { scales } : {}) };
}

/**
 * Derived columns: `derive: ["rank", "share", "change", "index"]` on a table of
 * counts adds columns computed from the table's own numbers - never invented.
 *   rank    the row's position on the named measure, 1 = highest
 *   share   the row's share of that measure's total, to a whole percent
 *   change  the change from an earlier numeric column to the measure column
 *   index   the measure rebased to 100 at the highest row
 * `deriveFrom` names the measure column (default: the first numeric one), and a
 * total row is left out of the arithmetic and carries the totals instead.
 * Ten rows and one derived column is ten more blocks of evidence and a second
 * reading of the same data, which is how a well-made measure table gets to six
 * columns without a second source.
 */
const DERIVATIONS = ["rank", "share", "change", "index"];
const cellText = (cell) => String((cell && typeof cell === "object" ? cell.text ?? cell.value : cell) ?? "").trim();
const numberOf = (cell) => {
  // A bar cell carries its figure as the bar's value: the treatment runs before
  // the derivation, and read as text it was empty and every row ranked first.
  // A bound or a range is not a figure to rank or share.
  if (cell && typeof cell === "object" && cell.type === "bars") return cell.values?.length === 1 && Number.isFinite(cell.values[0]) && [undefined, "approx"].includes(cell.bound) ? cell.values[0] : null;
  const text = cellText(cell).replace(/[,\s]/g, "").replace(/[$£€]/g, "").replace(/%$/, "");
  if (!/^-?\d*\.?\d+$/.test(text)) return null;
  return Number(text);
};
function deriveColumns(ex) {
  const wanted = Array.isArray(ex.derive) ? ex.derive : ex.derive ? [ex.derive] : [];
  if (!wanted.length) return ex;
  for (const name of wanted) if (!DERIVATIONS.includes(name)) throw new Error(`Unknown derived column "${name}"; use ${DERIVATIONS.join(", ")}`);
  const columns = ex.columns.map((column) => (typeof column === "string" ? { label: column } : { ...column }));
  const rowsIn = ex.rows.map((row) => (Array.isArray(row) ? { cells: row } : { ...row }));
  const body = rowsIn.filter((row) => row.style !== "total" && row.style !== "group");
  const indexOfLabel = (label) => columns.findIndex((column) => String(column.label ?? "").trim().toLowerCase() === String(label).trim().toLowerCase());
  let measure = ex.deriveFrom ? indexOfLabel(ex.deriveFrom) : -1;
  if (ex.deriveFrom !== undefined && measure < 0) throw new Error(`deriveFrom "${ex.deriveFrom}" is not a column label`);
  if (measure < 0) measure = columns.findIndex((column, index) => index > 0 && body.every((row) => numberOf(row.cells[index]) !== null));
  if (measure < 0) throw new Error("A derived column needs a column of numbers to derive from");
  const values = body.map((row) => numberOf(row.cells[measure]));
  const total = values.reduce((sum, value) => sum + value, 0);
  const highest = Math.max(...values);
  const ordered = [...values].sort((a, b) => b - a);
  // `change` needs an earlier numeric column to measure against.
  const priorIndex = wanted.includes("change")
    ? (ex.deriveAgainst ? indexOfLabel(ex.deriveAgainst) : columns.findIndex((column, index) => index > 0 && index !== measure && body.every((row) => numberOf(row.cells[index]) !== null)))
    : -1;
  if (wanted.includes("change") && priorIndex < 0) throw new Error("A change column needs a second column of numbers to measure against");
  const measureLabel = String(columns[measure].label ?? "").trim();
  const heads = { rank: "Rank", share: "Share", change: "Change", index: "Index" };
  const units = { rank: `of ${body.length}`, share: "% of total", change: "%", index: "highest = 100" };
  const cellFor = (name, at) => {
    const value = values[at];
    if (name === "rank") return String(ordered.indexOf(value) + 1);
    if (name === "share") {
      if (!total) return "n/a";
      const share = (value / total) * 100;
      return share > 0 && share < 0.5 ? "<1" : String(Math.round(share));
    }
    if (name === "index") return highest ? String(Math.round((value / highest) * 100)) : "n/a";
    const prior = numberOf(body[at].cells[priorIndex]);
    if (!prior) return "n/a";
    const change = ((value - prior) / Math.abs(prior)) * 100;
    return `${change >= 0 ? "+" : "−"}${Math.abs(change) < 10 ? Math.abs(change).toFixed(1) : Math.round(Math.abs(change))}`;
  };
  // Derived columns are appended, so they can only share the measure's group
  // band when that group is the last one: a band that reappears after another
  // is two different things and the table refuses it.
  const trailingGroup = columns[columns.length - 1].group ?? null;
  const group = columns[measure].group && columns[measure].group === trailingGroup ? columns[measure].group : null;
  const derivedColumns = wanted.map((name) => ({
    label: heads[name], unit: units[name], type: "text", align: "right",
    ...(group ? { group } : {}), derived: name,
  }));
  let at = -1;
  const rows = rowsIn.map((row) => {
    const derivable = row.style !== "total" && row.style !== "group";
    if (derivable) at += 1;
    const position = at;
    const cells = [...row.cells, ...wanted.map((name) => (derivable ? cellFor(name, position) : name === "share" ? "100" : " "))];
    return row.style ? { ...row, cells } : cells;
  });
  const { derive: _d, deriveFrom: _f, deriveAgainst: _a, ...rest } = ex;
  return { ...rest, columns: [...columns, ...derivedColumns], rows, derivedMeasure: measureLabel };
}

// A column of bare four-figure counts reads with a thousands separator, the way
// every well-made table prints it. Only whole numbers, only where the whole
// column is numeric, so a code or a year is left alone.
function groupNumericColumns(ex) {
  const rowsIn = ex.rows.map((row) => (Array.isArray(row) ? { cells: row, plain: true } : { ...row }));
  const body = rowsIn.filter((row) => row.style !== "group");
  const count = ex.columns.length;
  const grouped = new Set();
  for (let i = 1; i < count; i++) {
    const values = body.map((row) => numberOf(row.cells[i]));
    if (values.some((value) => value === null)) continue;
    if (!values.some((value) => Math.abs(value) >= 1000 && Number.isInteger(value))) continue;
    if (body.some((row) => /^(19|20)\d{2}$/.test(cellText(row.cells[i])))) continue;  // years
    grouped.add(i);
  }
  if (!grouped.size) return ex;
  const rows = rowsIn.map((row) => {
    const cells = row.cells.map((cell, i) => {
      if (!grouped.has(i)) return cell;
      const value = numberOf(cell);
      if (value === null || Math.abs(value) < 1000) return cell;
      // Add grouping to the numeric substring, never replace the authored
      // display value: currency, percentage signs and decimal precision carry
      // meaning even when the arithmetic parser ignores them.
      const text = cellText(cell).replace(/\d[\d,]*(?:\.\d+)?/, (digits) => {
        const [integer, fraction] = digits.replaceAll(",", "").split(".");
        return groupThousands(integer) + (fraction === undefined ? "" : `.${fraction}`);
      });
      return cell && typeof cell === "object" ? { ...cell, text } : text;
    });
    const { plain, ...rest } = row;
    return plain ? cells : { ...rest, cells };
  });
  return { ...ex, rows };
}

/**
 * `total: true` closes a table of counts with the column sums, which is how a
 * well-made measure table ends. Numeric columns sum; a share column sums to 100;
 * anything the arithmetic cannot reach stays blank rather than guessing.
 */
/**
 * Whether a column's numbers are quantities, which add up, or measures of one
 * row against another, which do not. Counts, amounts and durations total; a
 * multiple, a ratio, a rate, a percentage, a score, an average or an index is a
 * statement about a row, and stacking those statements is not a statement about
 * the table.
 */
const NOT_ADDITIVE = /(multiple|ratio|rate|score|rating|average|avg|median|mean|index|margin|share|percent|yield|per\b|cagr|growth|utilisation|utilization|efficiency|density|likelihood|probability)/i;
// An ordinal is not a quantity either: a column of years summed to 12,103
// under a table whose numbers are otherwise right makes a reader stop
// believing the totals beside it.
const ORDINAL = /^(year|yr|date|quarter|month|week|period|rank|position|order|no\.?|nr\.?|num|number|#|id|code|season|edition|wave|phase|stage)\b/i;
const NOT_ADDITIVE_UNIT = /^(x|%|pt|pts|bps|:1|\/|per\b)/i;
function addsUp(column, values = []) {
  const label = typeof column === "string" ? column : String(column?.label ?? "");
  const unit = typeof column === "object" ? String(column?.unit ?? "") : "";
  if (/\(\s*x\b|\bx\s*\)|\bx budget\b/i.test(label)) return false;
  if (ORDINAL.test(label.trim())) return false;
  // And where the header says nothing, the numbers do: whole numbers that are
  // all plausible years are a column of years whatever it is called.
  const numbers = values.filter((value) => value !== null);
  if (numbers.length >= 3 && numbers.every((value) => Number.isInteger(value) && value >= 1800 && value <= 2200)) return false;
  return !NOT_ADDITIVE.test(label) && !NOT_ADDITIVE_UNIT.test(unit.trim());
}

function totalRow(ex) {
  if (ex.total !== true && ex.total !== "auto") return ex;
  const rows = ex.rows.map((row) => (Array.isArray(row) ? { cells: row, plain: true } : { ...row }));
  const body = rows.filter((row) => row.style !== "total" && row.style !== "group");
  if (!body.length) return ex;
  if (rows.some((row) => row.style === "total")) {
    if (ex.total === "auto") { const { total: _t, totalLabel: _l, ...rest } = ex; return rest; }
    throw new Error("The table already carries a total row");
  }
  const label = typeof ex.totalLabel === "string" && ex.totalLabel.trim() ? ex.totalLabel.trim() : "Total";
  const cells = ex.columns.map((column, index) => {
    if (index === 0) return label;
    const derived = typeof column === "object" ? column.derived : null;
    if (derived === "rank" || derived === "index" || derived === "change") return " ";
    if (derived === "share") return "100";
    // Only quantities add up. A multiple, a ratio, a rate, a score or an
    // average summed down its column produces a number that means nothing -
    // "41.4" under a column of budget multiples - and a total row is exactly
    // where a reader trusts the arithmetic without checking it. Those columns
    // carry the weighted figure where the table holds the two quantities it is
    // drawn from, and otherwise nothing. The row keeps the cell empty rather
    // than printing a figure the table cannot justify.
    // A bar cell carries its number in `values`; its total is printed as text
    // in the band, since a total drawn on its parts' scale runs off the end.
    const bars = typeof column === "object" && column?.type === "bars";
    const values = body.map((row) => (bars ? (Number.isFinite(row.cells[index]?.values?.[0]) ? row.cells[index].values[0] : null) : numberOf(row.cells[index])));
    if (!addsUp(column, values)) return " ";
    if (values.some((value) => value === null)) return " ";
    const sum = String(Math.round(values.reduce((a, b) => a + b, 0) * 10) / 10);
    return bars ? { type: "text", text: sum } : sum;
  });
  const { total: _t, totalLabel: _l, ...rest } = ex;
  // A total row is its totals. The measure-table preset's total ("auto") is
  // added only where a column sums, so a table of text never closes on a
  // "Total" label over a blank row, and one the author asks for where none
  // does is refused.
  if (cells.slice(1).every((cell) => !cellText(cell))) {
    if (ex.total === "auto") return rest;
    throw new Error("TOTAL_ROW_BLANK: `total: true` asks for a total row, but no column of this table adds up (counts and amounts do; rates, shares, scores and text do not), so the row would carry a label and nothing else - a total row carries its computed total, or it is deleted");
  }
  return { ...rest, rows: [...rows.map((row) => (row.plain ? row.cells : row)), { style: "total", cells }] };
}

/**
 * A column marked `implication: true` is the conclusion drawn from the columns
 * before it, not a fourth fact beside them.
 *
 * A "Verdict" column flush against the evidence in an identical cell reads as
 * more evidence. The renderer draws a gutter of chevrons
 * (`type: "implication"`), so this inserts one before the marked column and
 * decides how much of it to draw.
 *
 *   `per-row`  a chevron on every row, at four rows or fewer, where the eye
 *              can follow each line across
 *   `single`   one chevron centred in the gutter, at five rows or more, so the
 *              page says "evidence, then verdict" once rather than six times
 */
function implicationColumn(ex) {
  const columns = ex.columns || [];
  const at = columns.findIndex((c) => c && typeof c === "object" && c.implication === true);
  if (at < 0) return ex;
  if (ex.implicationStyle === "none") return { ...ex, columns: columns.map(c => c && typeof c === "object" ? { ...c, implication: false } : c) };
  if (at === 0) throw new Error("An implication column follows the evidence it is drawn from; it cannot be the first column");
  const rows = ex.rows || [];
  const style = ex.implicationStyle || (rows.length >= 5 ? "single" : "per-row");
  if (!["per-row", "single"].includes(style)) throw new Error(`Unknown implicationStyle: ${style}; use per-row or single`);
  // At five rows or more the gutter is drawn once, as a device belonging to the
  // whole table rather than to a row: a dashed rule down its own column with the
  // disc centred on it. Drawn as a chevron on the middle row it reads as a mark
  // against that row - on a twelve-market scorecard, a verdict on France - which
  // is the opposite of "all of this evidence, therefore all of that".
  const asDivider = style === "single";
  // Fixed pixels, not a weight. A column's `width` is a share of what is left
  // after the fixed columns are reserved, and the composer weights the text
  // columns by their measured content - numbers in the hundreds. As a bare 52
  // in that pool the gutter takes 52/1289 of the table, 47px, which is
  // narrower than the disc it exists to hold. It is the one column on the page
  // with a size of its own, so it says so.
  const gutter = { label: "", type: "implication", width: { px: 52 }, ...(asDivider ? { divider: true } : {}) };
  const { implication: _flag, ...rest } = columns[at];
  const marked = { type: "text", ...rest };
  const nextColumns = [...columns.slice(0, at), gutter, marked, ...columns.slice(at + 1)];
  const nextRows = rows.map((row) => {
    const cells = Array.isArray(row) ? row : row.cells || [];
    // Every gutter cell is blank under the divider: the column draws itself once.
    // Per-row, every row carries its own chevron.
    const draw = !asDivider;
    const mark = { type: "implication", relation: "implies", ...(draw ? {} : { draw: false }) };
    const next = [...cells.slice(0, at), mark, ...cells.slice(at)];
    return Array.isArray(row) ? next : { ...row, cells: next };
  });
  return { ...ex, columns: nextColumns, rows: nextRows, implicationStyle: undefined };
}

/**
 * The treatment a table's own cells ask for, where its author set none.
 *
 * A table page is a typed choice - a lookup, a measure table, a comparison -
 * and the cells say which device carries it. Strong decks treat nearly every
 * table, and a table of ratings set as words, a column of magnitudes set as
 * figures, or a total set like one more row is a treatment the data already
 * implies and the author did not name. So the composer names it, and only
 * where the cells' shape supports it:
 *
 *   ratings      every cell of a column one word of one ordinal scale (none,
 *                weak, partial, strong, full; or none, low, medium, high, very
 *                high), two levels or more - Harvey balls, the word beside each
 *   presence     every cell Yes or No under a header that asks the question -
 *                a filled or empty dot
 *   a matrix     three or more columns of exact figures in one unit - one heat
 *                scale across them, each cell keeping its figure
 *   a measure    otherwise the first column of figures with a unit - bars in
 *                the cells on a zero-based scale, the figure beside each, as
 *                written; a table of two figures and their names (a row
 *                block's two members side by side) is enough here, where the
 *                other treatments want three rows
 *   a total      a closing row whose figures add up the rows above it - the
 *                total band, set bold
 *
 * Nothing is inferred on a table that carries a treatment already
 * (gates/table-treatments.json: an implication gutter, banding or a value
 * pill is not one). A bar column's figure may be an approximation, a bound or
 * a range ("~$24B", ">$1B", "500+", "<5%", "3-5"), each drawn for what it says
 * (`quantity`), and a cell that says the figure is missing ("n/a", "not
 * disclosed") keeps its words with no bar; a heat cell and a total read exact
 * figures only.
 */
const INFERRED_ROWS_MIN = 3;
const RATING_SCALES = [
  { levels: { none: 0, weak: 1, limited: 1, partial: 2, strong: 3, full: 4 }, anchors: ["None", "Weak", "Partial", "Strong", "Full"] },
  { levels: { none: 0, low: 1, medium: 2, moderate: 2, high: 3, "very high": 4 }, anchors: ["None", "Low", "Medium", "High", "Very high"] },
];
// An exact figure: an optional currency sign, digits (grouped or not), an
// optional unit suffix. A bound or an approximation is not one.
const FIGURE = /^([$£€])?\s*([+\-−])?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(%|x|bn|b|m|k|pp|pts?)?$/i;
function figure(cell) {
  if (cell && typeof cell === "object" && (cell.type !== undefined && cell.type !== "text")) return null;
  const match = FIGURE.exec(cellText(cell));
  if (!match) return null;
  const value = Number(`${match[2] === "-" || match[2] === "−" ? "-" : ""}${match[3].replace(/,/g, "")}${match[4] ?? ""}`);
  return Number.isFinite(value) ? { value, mark: `${match[1] ?? ""}|${(match[5] ?? "").toLowerCase()}` } : null;
}
// A quantity a bar can stand for: an exact figure, or one written as an
// approximation ("~$24B", "c. 40%"), a bound (">$40B", "500+", "<5%") or a
// range ("$4,500-5,600", "3-5%"). Each is drawn for what it says (tables.mjs):
// an approximation as its bar, the "~" in the label beside it; a lower bound
// as a bar left open at its end, since the true value lies past it; an upper
// bound or a range as a range mark that claims no point inside it. `value` is
// the bar's far end: the bound, or the range's top.
const APPROXIMATE = /^(?:~|≈|c\.\s*|ca\.\s*|circa\s+|about\s+|around\s+|roughly\s+|approx(?:\.|imately)?\s+)/i;
const AT_LEAST = /^(?:>=?|≥|over\s+|more than\s+|at least\s+|above\s+)/i;
const AT_MOST = /^(?:<=?|≤|under\s+|less than\s+|below\s+|up to\s+|at most\s+)/i;
const SPAN = /^(.*\d)\s*(?:-|–|—|\bto\b)\s*([$£€]?\s*\d.*)$/i;
// A cell saying the figure does not exist or was not published: printed as
// written in a bar column, with no bar, never read as zero.
export const MISSING_FIGURE = /^(?:n\/?a|n\.a\.|–|—|-|undisclosed|unpublished|unreported|not (?:disclosed|published|reported|available)|no data)$/i;
export function quantity(cell) {
  if (cell && typeof cell === "object" && (cell.type !== undefined && cell.type !== "text")) return null;
  const text = cellText(cell);
  const exact = figure(text);
  if (exact) return { ...exact, bound: null };
  for (const [prefix, bound] of [[APPROXIMATE, "approx"], [AT_LEAST, "lower"], [AT_MOST, "upper"]]) {
    const match = prefix.exec(text);
    if (!match) continue;
    const found = figure(text.slice(match[0].length));
    return found ? { ...found, bound } : null;
  }
  const plus = /^(.*\d.*?)\s*\+$/.exec(text);
  if (plus) { const found = figure(plus[1]); return found ? { ...found, bound: "lower" } : null; }
  const span = SPAN.exec(text);
  const low = span && figure(span[1]), high = span && figure(span[2]);
  if (!low || !high) return null;
  // "$4,500-5,600" and "3-5%" write the sign or the suffix once: the end that
  // omits it takes the other's, and two that disagree are not one range.
  const [lowSign, lowSuffix] = low.mark.split("|"), [highSign, highSuffix] = high.mark.split("|");
  if ((lowSign && highSign && lowSign !== highSign) || (lowSuffix && highSuffix && lowSuffix !== highSuffix) || !(low.value < high.value)) return null;
  return { value: high.value, low: low.value, mark: `${lowSign || highSign}|${highSuffix || lowSuffix}`, bound: "range" };
}
const isBodyRow = (row) => Array.isArray(row) || !["total", "group"].includes(row?.style);
const rowCellsOf = (row) => (Array.isArray(row) ? row : row?.cells || []);
function columnUnit(column, mark) {
  if (column && typeof column === "object" && String(column.unit ?? "").trim()) return String(column.unit).trim();
  const label = columnLabel(column);
  const named = /\(([^)]+)\)\s*$/.exec(label)?.[1] ?? /,\s*([^,]{1,12})$/.exec(label)?.[1];
  if (named) return named.trim();
  const [sign, suffix] = mark.split("|");
  if (suffix === "%" || suffix === "x") return suffix;
  const scale = { bn: "B", b: "B", m: "M", k: "K" }[suffix];
  return sign ? `${sign}${scale ?? ""}` : null;
}
// The cell types and column flags that draw a treatment as
// gates/table-treatments.json defines one - heat, ratings, dots, bars, state
// marks, logos, icons, trend arrows - which is what the treated share counts.
// A table carrying one already says what its data shows, and nothing is added.
// Banding, a value pill, the implication gutter, a highlighted phrase and a
// filled label column keep the reader's place or structure the grid; they say
// nothing about the figures, which stay free to take the device their shape
// implies.
const TREATMENT_CELLS = new Set(["heatmap", "bars", "harvey", "rating", "dot", "progress", "rag", "status", "lights", "lamp", "check", "binary", "trend", "logo"]);
const TREATMENT_COLUMNS = ["heat", "bar", "harvey", "logo", "icon"];
const treatmentCell = (cell) => cell && typeof cell === "object" && (TREATMENT_CELLS.has(String(cell.type ?? "")) || Boolean(cell.icon));
function tableTreated(ex) {
  if (ex.highlightColumn !== undefined || ex.highlightRow !== undefined || ex.recommended !== undefined || Array.isArray(ex.icons)) return true;
  if ((ex.columns || []).some((c) => c && typeof c === "object" && (TREATMENT_COLUMNS.some((key) => c[key]) || TREATMENT_CELLS.has(String(c.type ?? ""))))) return true;
  return (ex.rows || []).some((row) => (!Array.isArray(row) && (row?.icon || row?.style === "accented")) || rowCellsOf(row).some(treatmentCell));
}
export function inferredTreatments(ex) {
  const columns = ex.columns || [], rows = ex.rows || [];
  if (!columns.length || tableTreated(ex)) return ex;
  let body = rows.filter(isBodyRow);
  const next = { ...ex, columns: [...columns], rows: [...rows] };
  // A total: the closing row adds up the rows above it in a column of figures,
  // and sits within their range (an average, a weighted rate) in every other.
  const last = rows.length - 1;
  if (!rows.some((row) => !isBodyRow(row)) && body.length > INFERRED_ROWS_MIN && !figure(rowCellsOf(rows[last])[0])) {
    const above = rows.slice(0, last);
    let sums = 0, fits = true;
    for (let i = 1; i < columns.length; i++) {
      const values = above.map((row) => figure(rowCellsOf(row)[i])), total = figure(rowCellsOf(rows[last])[i]);
      if (!total || values.some((v) => !v)) continue;
      const sum = values.reduce((a, v) => a + v.value, 0);
      const decimals = Math.max(...[...values, total].map((v) => String(v.value).split(".")[1]?.length ?? 0));
      if (Math.abs(sum - total.value) <= Math.max(0.5 * 10 ** -decimals * values.length, Math.abs(total.value) * 0.005)) sums += 1;
      else if (total.value < Math.min(...values.map((v) => v.value)) || total.value > Math.max(...values.map((v) => v.value))) fits = false;
    }
    if (sums && fits) {
      next.rows[last] = { ...(Array.isArray(rows[last]) ? {} : rows[last]), style: "total", cells: rowCellsOf(rows[last]) };
      body = next.rows.filter(isBodyRow);
      if (ex.total === "auto") delete next.total;
    }
  }
  const few = body.length < INFERRED_ROWS_MIN;
  if (few && !(body.length === 2 && columns.length === 2)) return next;
  const cellsAt = (i) => body.map((row) => rowCellsOf(row)[i]);
  const word = (cell) => (typeof cell === "string" || (cell && typeof cell === "object" && cell.type === undefined && typeof cell.text === "string" && !cell.highlight)) ? cellText(cell).toLowerCase() : null;
  const scales = { ...(ex.scales || {}) };
  const figures = [];
  for (let i = 1; i < columns.length; i++) {
    const column = columns[i];
    if (column && typeof column === "object" && (column.type || column.implication || column.logo)) continue;
    const words = cellsAt(i).map(word);
    const label = columnLabel(column) || `Column ${i + 1}`;
    // Ratings on a named ordinal scale, the word kept beside each ball.
    const scale = !few && words.every(Boolean) && RATING_SCALES.find((sc) => words.every((w) => w in sc.levels));
    if (scale && new Set(words.map((w) => scale.levels[w])).size >= 2) {
      const anchors = Object.fromEntries(scale.anchors.map((a, level) => [level, a]));
      for (const w of words) anchors[scale.levels[w]] = w.charAt(0).toUpperCase() + w.slice(1);
      const id = `${barScaleId(label).replace(/-bar$/, "")}-rating`;
      scales[id] = { type: "harvey", label, min: 0, max: 4, anchors };
      next.rows = next.rows.map((row) => (isBodyRow(row) ? mapTableCells(row, (cells) => cells.map((cell, c) => (c === i ? { type: "harvey", value: scale.levels[word(cell)], scale: id } : cell))) : row));
      continue;
    }
    // Presence, answered: Yes or No under a header that asks.
    if (!few && words.every((w) => w === "yes" || w === "no") && /\?\s*$/.test(label)) {
      next.rows = next.rows.map((row) => (isBodyRow(row) ? mapTableCells(row, (cells) => cells.map((cell, c) => (c === i ? { type: "dot", value: word(cell) === "yes" } : cell))) : row));
      continue;
    }
    // Figures: every cell a quantity or a figure marked missing, enough of
    // them to compare, one sign and suffix, not all alike, not an ordinal.
    const cells = cellsAt(i), parsed = cells.map(quantity), known = parsed.filter(Boolean);
    if (cells.some((cell, r) => !parsed[r] && !MISSING_FIGURE.test(cellText(cell)))) continue;
    if (known.length < Math.min(cells.length, INFERRED_ROWS_MIN) || new Set(known.map((v) => v.mark)).size !== 1 || new Set(known.map((v) => v.value)).size < 2) continue;
    if (ORDINAL.test(label.trim()) || known.every((v) => Number.isInteger(v.value) && v.value >= 1800 && v.value <= 2200)) continue;
    figures.push({ i, unit: columnUnit(column, known[0].mark), values: known.map((v) => v.value), exact: parsed.every((v) => v?.bound === null) });
  }
  const byUnit = new Map();
  for (const f of figures) if (f.unit) byUnit.set(f.unit, [...(byUnit.get(f.unit) || []), f]);
  // A heat cell is coloured at its figure, so a heat matrix is of exact figures.
  const matrix = few ? null : [...byUnit.values()].map((group) => group.filter((f) => f.exact)).find((group) => group.length >= 3);
  if (matrix) {
    // One heat scale across the matrix, in five equal steps of its range; each
    // cell keeps the figure the author wrote.
    const all = matrix.flatMap((f) => f.values), lo = Math.min(...all), hi = Math.max(...all);
    const printed = (value) => cellText(body.flatMap((row) => matrix.map((f) => rowCellsOf(row)[f.i])).find((cell) => figure(cell)?.value === value));
    const id = `${barScaleId(matrix[0].unit).replace(/-bar$/, "")}-heat`;
    // Keyed as a ramp from the lowest figure to the highest in their own
    // units (tables.mjs layoutRamp); every cell prints its figure, so the
    // author may drop the key (`legend: false` on the table).
    const inUnits = (text) => (figureUnit(text) ? text : withUnit(text, matrix[0].unit));
    scales[id] = { type: "heatmap", label: `${matrix.map((f) => columnLabel(columns[f.i])).join(", ")} (${matrix[0].unit})`, min: 1, max: 5,
      anchors: { 1: printed(lo), 5: printed(hi) }, ramp: { low: inUnits(printed(lo)), high: inUnits(printed(hi)) },
      ...(ex.legend === false ? { legend: false } : {}), palette: "theme-sequential" };
    const at = new Set(matrix.map((f) => f.i));
    next.rows = next.rows.map((row) => (isBodyRow(row) ? mapTableCells(row, (cells) => cells.map((cell, c) => (at.has(c)
      ? { type: "heatmap", value: 1 + Math.round(((figure(cell).value - lo) / (hi - lo)) * 4), figure: cellText(cell), scale: id } : cell))) : row));
  } else {
    // A measure: bars in the cells of the first column of figures with a unit.
    const measure = columns.length <= 5 ? figures.find((f) => f.unit) : null;
    if (measure) {
      const column = columns[measure.i];
      // The figure beside each bar is printed as a table prints it: a column
      // with a four-figure value takes thousands separators on every value.
      if (measure.values.some((v) => Math.abs(v) >= 1000))
        next.rows = next.rows.map((row) => mapTableCells(row, (cells) => cells.map((cell, c) => (c === measure.i && quantity(cell)
          ? cellText(cell).replace(/\d[\d,]*(?:\.\d+)?/g, (digits) => { const [integer, fraction] = digits.replaceAll(",", "").split("."); return groupThousands(integer) + (fraction === undefined ? "" : `.${fraction}`); })
          : cell))));
      // The row the title ranks (decisiveFromTitle), when its figure is the
      // least or the greatest whatever its bounds: what the column marks
      // instead where its bars do not fit and a shade cannot state a bound or
      // a range (tables.mjs withoutInferredBars).
      const extent = (row) => { const q = barQuantity(rowCellsOf(row)[measure.i]); return !q ? null : q.bound === "range" ? [q.low, q.value] : q.bound === "lower" ? [q.value, Infinity] : q.bound === "upper" ? [-Infinity, q.value] : [q.value, q.value]; };
      const spans = next.rows.map((row) => (isBodyRow(row) ? extent(row) : null));
      const decisive = ex.decisive === "least" || ex.decisive === "most" ? spans.findIndex((span, r) => span && spans.every((other, o) => o === r || !other
        || (ex.decisive === "least" ? span[1] < other[0] : span[0] > other[1]))) : -1;
      next.columns[measure.i] = { ...(typeof column === "string" ? { label: column } : column), bar: true, unit: measure.unit, inferred: true, width: columnWeight(ex, measure.i) * 2,
        ...(decisive >= 0 ? { fallbackRow: decisive } : {}) };
    }
  }
  return Object.keys(scales).length ? { ...next, scales } : next;
}

/**
 * Column treatments that turn a value into something the eye reads before the
 * mind does.
 *
 * `heat: true` fills every cell in the column on a sequential scale, which is
 * how a well-made benchmarking table lets a reader find the leader without
 * reading a single number. `bubble: true` sets the value in a filled pill, the
 * same device the change annotation uses on a chart, so one column of a flat
 * table carries emphasis. `bar: true` draws the in-cell bar chart:
 * the magnitude down the column read at a glance, the figure still beside it.
 *
 * Reaching the bar cell by hand means declaring a scale record (min, max,
 * unit, label, series) and then writing
 * `{type: "bars", values: [41], scale: "share"}` in every row. The column's
 * own numbers say all of that, so the flag reads them.
 */
/** A bar cell's number, or null when the cell is not one. A typed cell carries
 *  no `text`, and `String({})` is "[object Object]", which strips to "" and
 *  reads as 0 - a cell silently at the bottom of the scale. */
function barNumber(cell) {
  if (cell && typeof cell === "object" && cell.text === undefined) return null;
  const raw = String(cell?.text ?? cell ?? "").replace(/[^0-9.+-]/g, "");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
// A bar cell's quantity: what `quantity` reads, or else the number in the cell
// ("12 days") as written, keeping a bound or approximation its words declare.
// A range it cannot read is no number: stripped of its dash, "4,500-5,600"
// would read as 45,005,600.
function barQuantity(cell) {
  const found = quantity(cell);
  if (found || (cell && typeof cell === "object" && cell.text === undefined)) return found;
  const text = cellText(cell);
  if (/\d\s*(?:-|–|—|\bto\b)\s*[$£€]?\s*\d/i.test(text)) return null;
  const value = barNumber(cell);
  if (value === null) return null;
  return { value, bound: APPROXIMATE.test(text) ? "approx" : AT_LEAST.test(text) || /\+\s*$/.test(text) ? "lower" : AT_MOST.test(text) ? "upper" : null };
}
// A lower bound's bar is left open past its end, so its scale keeps a tenth
// more room than the bound for the opening.
const OPEN_END = 1.1;
const barExtent = (found) => (found ? (found.bound === "lower" ? found.value * OPEN_END : found.value) : null);
const sharedBarScale = (column) => (column && typeof column === "object" && typeof column.barScale === "string" && column.barScale.trim() ? column.barScale.trim() : null);
const barScaleId = (label) => `${String(label).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-bar`;
/** Zero (or below zero) to a round number above the largest value, so the bars
 *  are proportional to the measure rather than to each other, and a column of
 *  41/33/30 does not draw its smallest bar as nothing. */
function barScaleRecord(label, unit, values) {
  const top = Math.max(...values, 0), bottom = Math.min(...values, 0);
  const step = decade(Math.max(1e-9, top - bottom)) / 2;
  return {
    type: "bars", label, unit, series: [label],
    min: bottom < 0 ? Math.floor(bottom / step) * step : 0,
    max: Math.ceil(top / step) * step,
  };
}

/**
 * Every bar column's scale, read off the whole table.
 *
 * A table long enough to split is styled once per page, and a page that read
 * its bar scale off the rows it received could draw a $440m bar on the second
 * page longer than a $1,148m bar on the first, which is the kind of page that
 * makes a reader doubt every number in the deck. The scale belongs to the
 * column, so it is computed before the split and handed to both halves.
 */
export function barScales(ex) {
  const scales = {};
  for (const [index, column] of (ex?.columns || []).entries()) {
    if (!column || typeof column !== "object" || column.bar !== true) continue;
    const label = String(column.label ?? "").trim(), unit = String(column.unit ?? "").trim();
    if (!label || !unit) continue; // styleTable says what is missing, and better.
    // `barScale`: columns that measure the same thing share one scale, so a
    // row reads across them. Pooled over every column in the group.
    const group = sharedBarScale(column);
    const members = group ? (ex.columns || []).map((c, i) => [c, i]).filter(([c]) => c && sharedBarScale(c) === group).map(([, i]) => i) : [index];
    const values = members.flatMap((i) => (ex.rows || [])
      .map((row) => (Array.isArray(row) ? row : row.cells || [])[i])
      .map((cell) => barExtent(barQuantity(cell))).filter((n) => Number.isFinite(n)));
    if (values.length) scales[barScaleId(group ?? label)] = { ...barScaleRecord(group ?? label, unit, values), legend: false,
      labelTexts: (ex.rows || []).map(row => {
        const cell = (Array.isArray(row) ? row : row.cells || [])[index];
        return String(cell?.text ?? cell ?? "");
      }) };
  }
  return scales;
}

function columnTreatments(ex) {
  const columns = ex.columns || [];
  const flag = (c, name) => c && typeof c === "object" && c[name] === true;
  const marks = columns.map((c, i) => ({ heat: flag(c, "heat"), bubble: flag(c, "bubble") || ex.bubbleColumn === i, bar: flag(c, "bar") }));
  if (!marks.some((m) => m.heat || m.bubble || m.bar)) return ex;
  marks.forEach((m, i) => {
    if ([m.heat, m.bubble, m.bar].filter(Boolean).length > 1) {
      throw new Error(`Column ${i + 1} asks for more than one treatment; a column is heat, bubble or bar, not two of them`);
    }
  });
  const barScales = {};
  const heat = heatColumns(ex, marks.map((m, i) => (m.heat ? i : -1)).filter((i) => i >= 0));
  const nextColumns = columns.map((c, i) => {
    if (!marks[i].heat && !marks[i].bubble && !marks[i].bar) return c;
    const { heat: _h, bubble: _b, bar: _r, domain: _d, ...rest } = c;
    if (marks[i].heat) return { ...rest, type: "heatmap" };
    if (!marks[i].bar) return rest;
    // One scale per bar column, shared across its rows: the bars in a column
    // are comparable to each other and to nothing else on the page.
    const label = String(rest.label ?? "").trim();
    if (!label) throw new Error("A bar column needs a label; it names the scale its bars share");
    const unit = String(rest.unit ?? "").trim();
    if (!unit) throw new Error(`The "${label}" bar column needs a unit: a bar without one is a length, not a measure`);
    const group = sharedBarScale(rest);
    if (group && columns.some((other) => sharedBarScale(other) === group && String(other.unit ?? "").trim() !== unit)) {
      throw new Error(`Bar columns sharing the "${group}" scale must share a unit`);
    }
    barScales[i] = { id: barScaleId(group ?? label), label: group ?? label, unit };
    return { ...rest, type: "bars" };
  });
  // The column writes its own cells, so a cell that already has a type is the
  // author saying two different things at once.
  const asNumber = barNumber;
  const nextRows = (ex.rows || []).map((row) => {
    // A total the composer's own bars would draw off the end of their scale
    // keeps its figure, set bold in its band; an author's bar column bars it.
    if (!Array.isArray(row) && row?.style === "total" && columns.some((c) => c?.inferred === true))
      return { ...row, cells: (row.cells || []).map((cell, i) => (columns[i]?.inferred === true ? { type: "text", text: cellText(cell) || " " } : cell)) };
    const cells = Array.isArray(row) ? row : row.cells || [];
    const next = cells.map((cell, i) => {
      if (marks[i].heat) return heat.cell(i, cell);
      if (marks[i].bubble) {
        const text = String(cell?.text ?? cell ?? "").trim();
        if (!text) throw new Error("A bubble column needs text in every cell");
        return { ...(typeof cell === "object" && cell ? cell : {}), type: "highlight", text, surface: "bubble" };
      }
      if (marks[i].bar) {
        const text = String(cell?.text ?? cell ?? "").trim();
        const found = barQuantity(cell);
        // A figure marked missing keeps its words and draws no bar: it is not
        // zero. It stands where the figures stand, at the column's right.
        if (!found && MISSING_FIGURE.test(text)) return { type: "text", text, align: "right" };
        if (!found) throw new Error(`A bar column needs numeric cells; "${String(cell?.text ?? cell)}" is not one`);
        // The bar is drawn from the number, for what it is - a bound left
        // open, a range as its span; the label beside it is the figure the
        // author wrote, to the precision they wrote it in.
        return { type: "bars", values: [found.value], labels: [text], scale: barScales[i].id,
          ...(found.bound ? { bound: found.bound } : {}), ...(found.bound === "range" ? { low: found.low } : {}),
          ...(cell?.markFocus !== undefined ? { markFocus: cell.markFocus } : {}) };
      }
      return cell;
    });
    return Array.isArray(row) ? next : { ...row, cells: next };
  });
  // The scale each bar column shares, read off the column's own numbers. A
  // scale already on the exhibit under this id is kept: that is either the
  // author's own, or the one `paginateTable` computed over every row before it
  // split the table, and a half-table must not rescale itself.
  const scales = { ...(ex.scales || {}) };
  for (const [index, record] of Object.entries(barScales)) {
    const members = Object.entries(barScales).filter(([, other]) => other.id === record.id).map(([i]) => Number(i));
    const values = members.flatMap((i) => nextRows.map((row) => (Array.isArray(row) ? row : row.cells)[i]).map((cell) => (cell?.type === "bars" ? barExtent({ value: cell.values[0], bound: cell.bound }) : null)).filter((n) => Number.isFinite(n)));
    if (!values.length) throw new Error(`The "${record.label}" bar column has no numbers to scale`);
    // The column header already prints the unit, so a legend line repeating it
    // with "common scale 0 to N" is template text under the table.
    if (!scales[record.id]) scales[record.id] = { ...barScaleRecord(record.label, record.unit, values), legend: false };
  }
  Object.assign(scales, heat.scales);
  return { ...ex, columns: nextColumns, rows: nextRows, bubbleColumn: undefined, ...(Object.keys(barScales).length || Object.keys(heat.scales).length ? { scales } : {}) };
}

// The steps a heat column is shaded in, and the scores the default scale names (DEFAULT_SCALES.heat).
const HEAT_STEPS = 5;

/**
 * The heat columns of a table (`heat: true`), read whole before a cell is
 * written, so that everything wrong with one is said in one refusal.
 *
 * A heat column shades numbers, and takes them one of two ways. Scores - every
 * cell a whole number from 1 to 5 - are shaded as they stand, on the scale
 * the key names Lowest to Highest. Any other figures are recorded values:
 * each cell keeps the figure its author wrote and is shaded by where it sits
 * between the column's lowest and highest figure, in five equal steps, with
 * the key drawn as a ramp between those two figures - or across the `domain:
 * [low, high]` the column declares, where the shade should mean the same
 * thing in every table (a share out of 100, a score out of 10). A figure
 * marked missing ("n/a", "not disclosed") keeps its words and takes no shade:
 * it is not the bottom of the scale. `cell(i, cell)` is the cell as drawn;
 * `scales` the scale each recorded column shares down its rows.
 */
function heatColumns(ex, indexes) {
  const scales = {}, modes = new Map(), problems = [];
  const bodyCells = (i) => (ex.rows || []).map((row) => (Array.isArray(row) ? row : row?.cells || [])[i]);
  for (const i of indexes) {
    const column = ex.columns[i], label = String(columnLabel(column) || `column ${i + 1}`).trim();
    const cells = bodyCells(i), texts = cells.map((cell) => String(cell?.text ?? cell ?? "").trim());
    const numbers = cells.map((cell, r) => (MISSING_FIGURE.test(texts[r]) ? null : barNumber(cell)));
    const unread = texts.filter((text, r) => numbers[r] === null && !MISSING_FIGURE.test(text));
    const known = numbers.filter((n) => n !== null);
    const domain = column.domain;
    const declared = Array.isArray(domain) && domain.length === 2 && domain.every((n) => typeof n === "number" && Number.isFinite(n)) && domain[0] < domain[1];
    const said = [];
    if (unread.length) said.push(`${unread.map((text) => `"${text}"`).join(", ")} ${unread.length === 1 ? "is" : "are"} not a number (a figure that is missing is written "n/a" or "not disclosed", and takes no shade)`);
    if (domain !== undefined && !declared) said.push(`its \`domain\` is [low, high], two numbers with low under high`);
    const outside = declared ? texts.filter((_, r) => numbers[r] !== null && (numbers[r] < domain[0] || numbers[r] > domain[1])) : [];
    if (outside.length) said.push(`${outside.map((text) => `"${text}"`).join(", ")} ${outside.length === 1 ? "lies" : "lie"} outside the \`domain\` it declares (${domain[0]} to ${domain[1]})`);
    if (!known.length) said.push("it has no number to shade");
    if (said.length) { problems.push(`the "${label}" heat column: ${said.join("; ")}`); continue; }
    const scores = !declared && known.every((n) => Number.isInteger(n) && n >= 1 && n <= HEAT_STEPS);
    if (scores) { modes.set(i, { scores: true }); continue; }
    const [lo, hi] = declared ? domain : [Math.min(...known), Math.max(...known)];
    const unit = String(column.unit ?? "").trim() || figureUnit(texts[numbers.indexOf(known[0])]) || "";
    const ends = declared ? [String(lo), String(hi)] : [texts[numbers.indexOf(lo)], texts[numbers.indexOf(hi)]];
    const inUnits = (text) => (figureUnit(text) || !unit ? text : withUnit(text, unit));
    const id = `${barScaleId(label).replace(/-bar$/, "")}-${i + 1}-heat`;
    scales[id] = { type: "heatmap", label: unit && !label.includes(unit) ? `${label} (${unit})` : label, min: 1, max: HEAT_STEPS, anchors: { 1: ends[0], [HEAT_STEPS]: ends[1] }, ramp: { low: inUnits(ends[0]), high: inUnits(ends[1]) },
      ...(ex.legend === false ? { legend: false } : {}), palette: "theme-sequential" };
    modes.set(i, { id, lo, hi });
  }
  if (problems.length) throw new Error(`A heat column shades numbers - whole scores from 1 to ${HEAT_STEPS} as they stand, any other figures by where each sits between the column's lowest and highest (or across the \`domain: [low, high]\` the column declares). ${problems.join(". ")[0].toUpperCase()}${problems.join(". ").slice(1)}`);
  const cell = (i, value) => {
    const mode = modes.get(i), text = String(value?.text ?? value ?? "").trim();
    if (MISSING_FIGURE.test(text)) return { type: "text", text, align: "right" };
    const n = barNumber(value);
    if (mode.scores) return { type: "heatmap", value: n };
    // Five equal steps of the range; a column whose figures are all one value sits at the middle step.
    const step = mode.hi > mode.lo ? 1 + Math.round(((n - mode.lo) / (mode.hi - mode.lo)) * (HEAT_STEPS - 1)) : Math.ceil(HEAT_STEPS / 2);
    return { type: "heatmap", value: step, figure: text, scale: mode.id };
  };
  return { scales, cell };
}

/**
 * `icons: [...]` on a table, or `icon` on a row: an icon beside each row label.
 *
 * The renderer draws an icon on a `category` cell - it is how a findings
 * matrix marks its rows - and this gives a plain `columns`/`rows` table the
 * route to it that the `rows` alias has. An authored icon draws wherever it
 * is authored.
 */
function iconColumn(ex) {
  const rows = ex.rows || [];
  const listed = Array.isArray(ex.icons) ? ex.icons : null;
  const perRow = rows.some((row) => !Array.isArray(row) && row?.icon);
  if (!listed && !perRow) return ex;
  if (listed && listed.length !== rows.length) {
    throw new Error(`A table's \`icons\` needs one per row: ${listed.length} for ${rows.length} rows`);
  }
  const columns = (ex.columns || []).map((c, i) => (i === 0
    ? (typeof c === "object" && c ? { ...c, type: "category" } : { label: String(c ?? ""), type: "category" })
    : c));
  const nextRows = rows.map((row, index) => {
    const cells = Array.isArray(row) ? row : row.cells || [];
    const icon = listed ? listed[index] : row?.icon;
    if (!icon) return row;
    const first = cells[0];
    const cell = { type: "category", text: String(first?.text ?? first ?? ""), ...(typeof first === "object" && first ? first : {}), icon };
    const next = [{ ...cell, type: "category", icon }, ...cells.slice(1)];
    return Array.isArray(row) ? next : { ...row, icon: undefined, cells: next };
  });
  return { ...ex, columns, rows: nextRows, icons: undefined };
}

// A verdict remains joined unless its author asks for an inference gutter.
const VERDICT_HEADER = /\b(decide|decision|implication|so what|then\b|recommend|verdict|action|takeaway|what it means)/;

const TREATED_CELL = new Set(["heatmap", "bars", "harvey", "highlight", "category", "status", "icon",
                              "lamp", "dot", "check", "progress", "rating", "number-circle"]);
const TREATED_COLUMN = ["heat", "bubble", "bar", "harvey", "implication", "icon"];

/**
 * Did every treatment pass decline this table?
 *
 * Read after the chain, off what will actually be drawn: a column that asks for
 * one, a cell that carries a type, a highlighted row or column, a derived
 * column or a total band. `rows` counts the body, so a five-row table with a
 * header is six lines of grid.
 */
function untreatedGrid(ex, columns, rows, extra) {
  if (rows.length < 5) return false;
  if (ex.zebra !== undefined) return false;           // the author has decided
  if (ex.bubbleColumn !== undefined) return false;
  if (extra.highlightColumn !== undefined || ex.highlightRow !== undefined) return false;
  if (columns.some((c) => TREATED_COLUMN.some((key) => c?.[key]) || TREATED_CELL.has(String(c?.type ?? "")))) return false;
  // `derive` and a total row are not in conflict with banding: a computed share
  // column is a treatment of the numbers, not of the grid, and a total band is
  // one row. What rules banding out is a device already running down the rows.
  return !rows.some((row) => {
    if (!Array.isArray(row)) {
      const style = String(row?.style ?? "");
      if (style === "total") return false;
      if (!Array.isArray(row?.cells)) return true;
      return row.cells.some((cell) => cell && typeof cell === "object" && TREATED_CELL.has(String(cell.type ?? "")));
    }
    return row.some((cell) => cell && typeof cell === "object" && TREATED_CELL.has(String(cell.type ?? "")));
  });
}

// An authored rubric maps its anchor words to marks. Words alone never invent a scale.
function rubricColumns(ex) {
  const selected = ex.columns.map(c => c && typeof c === "object" && c.scale && ex.scales?.[c.scale]?.type === "harvey" ? c.scale : null);
  if (!selected.some(Boolean)) return ex;
  const rows = ex.rows.map(row => {
    const cells = Array.isArray(row) ? row : row.cells;
    const next = cells.map((cell, index) => {
      const id = selected[index]; if (!id || (cell && typeof cell === "object")) return cell;
      const anchor = Object.entries(ex.scales[id].anchors || {}).find(([, label]) => String(label).toLowerCase() === String(cell).toLowerCase());
      return anchor ? { type: "harvey", value: Number(anchor[0]), scale: id } : { type: "text", text: String(cell) };
    });
    return Array.isArray(row) ? next : { ...row, cells: next };
  });
  return { ...ex, rows, columns: ex.columns.map((c,i) => selected[i] ? { ...c, harvey: true } : c) };
}

export function validateCategoryLabels(ex) {
  // A category treatment distinguishes category labels, not repeated attributes.
  // Validate before pagination so a repeated label cannot hide on another page.
  ex.columns.forEach((column, index) => {
    if (column?.type !== "category") return;
    const seen = new Set();
    for (const row of ex.rows) {
      const cell = (Array.isArray(row) ? row : row.cells)[index];
      const surface = cell?.surface ?? column.surface ?? (ex.variant === "plain" || ex.treatment === "dimensions" ? "plain" : "primary");
      if (surface !== "primary" || cell === null || cell === undefined || (cell?.type && cell.type !== "category")) continue;
      const label = String(cell?.text ?? cell).trim().toLowerCase();
      if (!label) continue;
      if (seen.has(label)) throw new Error(`Filled category column repeats "${label}"; use plain text for repeated attributes or one spanning category cell`);
      seen.add(label);
    }
  });
}

function numberedRowLabel(value) {
  const text = String(value?.text ?? value ?? "");
  // Clock times and decimal identifiers are data, not ordinal row prefixes.
  if (/^\s*\d+[:.]\d/.test(text)) return null;
  return text.match(/^\s*(\d+)\s*[·.)\-–:]\s*(.*\S)\s*$/);
}

const tableCells = row => Array.isArray(row) ? row : row.cells;
const mapTableCells = (row, transform) => Array.isArray(row) ? transform(row) : { ...row, cells: transform(row.cells) };

export function styleTable(ex) {
  validateCategoryLabels(ex);
  if (ex.treatment === undefined && ex.columns.some(c => c?.type === "category")) ex = { ...ex, treatment: "categories" };
  for (const transform of [rubricColumns, iconColumn, inferredTreatments, columnTreatments, implicationColumn, deriveColumns, totalRow, groupNumericColumns]) ex = transform(ex);
  // An object column (one that names a `group`, a `unit`, an alignment) still
  // gets its width from what it holds, unless it sets one: otherwise adding a
  // unit to a header would silently reweight every column to equal shares and
  // squeeze the one column that needed the room.
  const columns = ex.columns.map((c, i) => typeof c === "string"
    ? { label: c, type: "text", bold: i === 0, width: columnWeight(ex, i) }
    : { width: columnWeight(ex, i), ...c });
  const readings = columnReadings(ex);
  const scaled = withDefaultScales(ex, ex.rows.map(row => mapTableCells(row, cells => cells.map((cell, i) => readCell(cell, readings[i + (Array.isArray(row) || row?.label === undefined ? 0 : 1)])))));
  const rowsIn = scaled.rows;
  if (scaled.scales) ex = { ...ex, scales: scaled.scales };
  // The recommended option's column is tinted end to end.
  const recommended = ex.recommended !== undefined ? columns.findIndex((c) => String(c.label).trim().toLowerCase() === String(ex.recommended).trim().toLowerCase()) : -1;
  if (ex.recommended !== undefined && recommended < 0) throw new Error(`Table recommended column "${ex.recommended}" is not a column label`);
  const extra = { ...(recommended >= 0 ? { highlightColumn: recommended } : Number.isInteger(ex.highlightColumn) ? { highlightColumn: ex.highlightColumn } : {}), ...(ex.scales ? { scales: ex.scales } : {}), ...(ex.columnWidths ? { columnWidths: ex.columnWidths } : {}) };
  if (ex.rowAlignment !== undefined) extra.rowAlignment = ex.rowAlignment;
  // A table that ends the chain with no treatment at all is a plain grid, and a
  // plain grid past five rows is where a reader loses their place. About 89% of
  // tables in strong decks carry a treatment of some kind, and the commonest
  // by far is a banded row - it costs the
  // page nothing and it is the only device that works on a table of words. So
  // banding is what an untreated table falls back to, rather than nothing.
  if (untreatedGrid(ex, columns, rowsIn, extra)) extra.zebra = true;
  // A "Total …" row at the end is the accent total band.
  rowsIn.forEach((r, i) => {
    if (Array.isArray(r) && i === rowsIn.length - 1 && /^total\b/i.test(String(r[0]?.text ?? r[0] ?? ""))) rowsIn[i] = { style: "total", cells: r };
  });
  // `highlightRow`: the subject's row (by first-cell label or index) as a tinted
  // band, the way a benchmarking table singles out the client's own city or company.
  if (ex.highlightRow !== undefined) {
    const label = (r) => String((Array.isArray(r) ? r : r.cells)[0]?.text ?? (Array.isArray(r) ? r : r.cells)[0] ?? "").trim().toLowerCase();
    const at = Number.isInteger(ex.highlightRow) ? ex.highlightRow : rowsIn.findIndex((r) => label(r) === String(ex.highlightRow).trim().toLowerCase());
    if (at < 0 || at >= rowsIn.length) throw new Error(`Table highlightRow "${ex.highlightRow}" is not a row label or index`);
    rowsIn[at] = Array.isArray(rowsIn[at]) ? { style: "accented", cells: rowsIn[at] } : { ...rowsIn[at], style: "accented" };
  }
  // A "#" column of row numbers becomes numbered discs with no filled box.
  const head0Raw = String(columns[0].label || "").trim();
  if (/^(#|no\.?|nr\.?|n°)$/i.test(head0Raw) && rowsIn.every((r) => { const row = Array.isArray(r) ? r : r.cells; return /^\d+$/.test(String(row[0]?.text ?? row[0] ?? "").trim()) || r.style; })) {
    columns[0] = { ...columns[0], type: "category", label: "", width: 48 };
    rowsIn.forEach((r, i) => { const row = Array.isArray(r) ? r : r.cells; if (/^\d+$/.test(String(row[0]?.text ?? row[0] ?? "").trim())) row[0] = { type: "category", text: "", surface: "plain", sectionNumber: Number(String(row[0]?.text ?? row[0]).trim()) }; });
  }
  const explicit = ex.treatment || ex.variant;
  if (explicit) return { variant: ex.variant || (ex.treatment && ex.treatment !== "open" ? "standard" : "plain"), treatment: ex.treatment || "open", columns, rows: rowsIn, ...extra };
  const first = rowsIn.map((r) => String(tableCells(r)[0]?.text ?? tableCells(r)[0] ?? ""));
  const numbered = first.length > 1 && first.every(v => numberedRowLabel(v));
  const head0 = String(columns[0].label || "").toLowerCase();
  const headLast = String(columns[columns.length - 1].label || "").toLowerCase();
  const sequence = numbered || /^(stage|step|phase|wave|horizon|priority|milestone)s?\b/.test(head0);
  const decision = VERDICT_HEADER.test(headLast);
  const scorecard = columns.length >= 4 && /\b(gate|criteri|dimension|factor|requirement|measure|option)/.test(head0);
  if (sequence) {
    const cols = [{ ...columns[0], type: "category" }, ...columns.slice(1)];
    const rows = rowsIn.map((row, i) => row.style === "total" ? row : mapTableCells(row, r => {
      const m = numberedRowLabel(r[0]);
      const cell = { type: "category", text: m ? m[2] : String(r[0]?.text ?? r[0]), sectionNumber: m ? Number(m[1]) : i + 1 };
      return [cell, ...r.slice(1)];
    }));
    return { variant: "standard", treatment: "categories", columns: cols, rows, ...extra };
  }
  if (scorecard) return { variant: "standard", treatment: "standard", columns, rows: rowsIn, ...extra };
  if (decision) {
    // A plain verdict stays joined; only an authored inference adds a gutter.
    const rows = rowsIn.map(row => mapTableCells(row, r => [...r.slice(0, -1), typeof r[r.length - 1] === "string" ? { text: r[r.length - 1], type: "highlight" } : r[r.length - 1]]));
    return { variant: "standard", treatment: "standard", columns, rows, ...extra };
  }
  return { variant: "plain", treatment: "open", columns, rows: rowsIn, ...extra };
}

// Columns are weighted by the measured width of the widest thing they hold
// (header included, the first column bold), plus cell padding, clamped between
// 60 px and 420 px so a "Year 1" column stays narrow, a short label never
// wraps, and a sentence column takes the rest and wraps.
export function columnWeight(ex, i) {
  const font = { fontFamily: "Arial", fontSize: 12 };
  const texts = [String(columnLabel(ex.columns[i]) ?? ""), ...ex.rows.map((r) => { const row = Array.isArray(r) ? r : r?.cells || []; return String(row[i]?.text ?? row[i] ?? ""); })];
  const widest = Math.max(...texts.map((text) => measureText(text.replace(/^\s*\d+\s*[·.)\-–:]\s*/, "") || " ", 4000, { ...font, bold: i === 0 }).width));
  return Math.min(420, Math.max(60, widest)) + 24;
}

export const heavyTable = (ex) => (ex.rows || []).length > 5 || (ex.rows || []).some((row) => (Array.isArray(row) ? row : row?.cells || []).some((cell) => String(cell?.text ?? cell ?? "").length > 60));

/** A chart value as a table cell: whole numbers from ten up, one decimal below. */
export function formatTableValue(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value ?? "");
  return Math.abs(value) >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
}
