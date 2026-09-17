// deck/v3 → planner deckPlan. The author writes content and intent (~10 fields per
// slide); everything geometric — layout, sizes, density, section nesting — is derived
// here from what the page carries. See deep-audit-and-revamp.md item 4.
//
// {
//   "schema": "professional-slides.deck/v3",
//   "id": "nyc-or-sf", "palette": "mckinsey", "density": "executive",
//   "cover": { "title", "subtitle", "date", "logo", "tone": "dark|light", "image": "assets/cover.jpg" },
//   "footer": "Document title",          // right footer, beside the page number
//   "slides": [
//     { "title": "Costs grew 9% against 5% revenue growth, moving FY22 into a loss",
//       "exhibit": { "type": "chart.column", "heading": "Revenue and cost, $bn", "unit": "$bn",
//                    "categories": [...], "series": [{ "name": "...", "values": [...] }] },
//       "points": ["...", "..."],           // ≤ 3 short supporting points (optional)
//       "soWhat": "One-sentence consequence for the decision",   // optional
//       "source": "Australia Post annual reports 2015–22", "note": "Figures may not sum", "notes": "speaker notes",
//       "tag": "Preliminary", "titleLead": "Why", "callout": "How to read this page",
//       "layout": "auto",                 // auto | exhibit-full | exhibit-left | exhibit-right | two-up | stack | grid | text
//       "arrange": "stack|grid", "metrics": [{ "value": "$2.1B", "label": "..." }], "rows": [{ "label", "text|points" }] },
//     { "kind": "section", "title": "Where the money goes" }
//   ]
// }
// exhibit.type: any registered component id, or the aliases "table", "image", "metrics", "cards",
// "quadrants", "swot", "compare", "phase-table", "rows".
import fs from "node:fs";
import path from "node:path";
import { measureText } from "./text-layout.mjs";
import { chartAnnotationBands, evidenceAnnotationTopBandCount, EVIDENCE_CALLOUT_BAND } from "./chart-annotations.mjs";
import { legendRowCount } from "./legends.mjs";
import { measureTable } from "./tables.mjs";
import { resolveWeight, normalizeWeight } from "./weight.mjs";

const V3 = "professional-slides.deck/v3";
const SIZE = { width: { fr: 1 }, height: "fill" };
const HUG = { width: { fr: 1 }, height: "hug" };

export function isV3(spec) { return spec?.schema === V3; }

function imageDimensions(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), mime: "image/png" };
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7), mime: "image/jpeg" };
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  throw new Error("Only PNG and JPEG images are supported");
}

function imageProps(ref, baseDir) {
  const file = path.resolve(baseDir, typeof ref === "string" ? ref : ref.path);
  const buffer = fs.readFileSync(file);
  const { width, height, mime } = imageDimensions(buffer);
  return { dataUri: `data:${mime};base64,${buffer.toString("base64")}`, width, height, alt: (typeof ref === "object" && ref.alt) || path.basename(file), ...(typeof ref === "object" && ref.credit ? { authorization: ref.credit } : {}) };
}

/** Aliases that resolve to a table: compare (two headed columns), phase-table (chevron header, row labels), rows (label + text). */
function tableAlias(ex) {
  if (ex.type === "compare") {
    const left = ex.left || {}, right = ex.right || {};
    const l = left.points || (left.text ? [left.text] : []), r = right.points || (right.text ? [right.text] : []);
    const n = Math.max(l.length, r.length);
    const rows = Array.from({ length: n }, (_, i) => [l[i] ?? "", r[i] ?? ""].map((cell) => (typeof cell === "string" && !cell.trim() ? { type: "text", text: " " } : cell)));
    // The tinted column is the one the page decides for. Before/after pages
    // decide for "after", which is the default; a comparison of two options
    // names its side with `winner` ("left", "right" or a heading), and
    // `winner: false` leaves both columns plain when the page splits the verdict.
    const headings = [left.heading || "Before", right.heading || "After"];
    let highlightColumn = 1;
    if (ex.winner === false) highlightColumn = undefined;
    else if (ex.winner !== undefined) {
      const wanted = String(ex.winner).trim().toLowerCase();
      const at = wanted === "left" ? 0 : wanted === "right" ? 1 : headings.findIndex((h) => String(h).trim().toLowerCase() === wanted);
      if (at < 0) throw new Error(`compare winner "${ex.winner}" must be "left", "right", false or a column heading`);
      highlightColumn = at;
    }
    return { type: "table", treatment: "standard", variant: "standard", ...(highlightColumn === undefined ? {} : { highlightColumn }), columns: headings.map((label) => ({ label, type: "text" })), rows, density: ex.density };
  }
  if (ex.type === "phase-table") {
    const phases = ex.phases || ex.columns || [];
    const rows = (ex.rows || []).map((row) => [{ type: "category", text: row.label }, ...phases.map((_, i) => { const cell = (row.cells || [])[i]; return Array.isArray(cell) ? { type: "bullets", items: cell } : cell ?? " "; })]);
    const labelWidth = Math.max(110, ...(ex.rows || []).map((row) => Math.ceil(measureText(String(row.label || ""), 400, { fontFamily: "Arial", fontSize: 14, bold: true, wrapWidthRatio: 1 }).width) + 32));
    return { type: "table", treatment: "dimensions", variant: "standard", headerShape: "chevron", columns: [{ label: "", type: "category", width: labelWidth }, ...phases.map((ph) => ({ label: typeof ph === "string" ? ph : ph.label, type: "text", width: 200 }))], rows, density: ex.density };
  }
  if (ex.type === "rows") {
    const rows = (ex.rows || []).map((row) => [{ type: "category", text: row.label, ...(row.number ? { sectionNumber: row.number } : {}), ...(row.icon ? { icon: row.icon } : {}) }, Array.isArray(row.points) ? { type: "bullets", items: row.points } : row.text]);
    // `columns: ["What we found", "What it means"]` heads the two tracks. The
    // reference pages label them; an unlabelled ledger keeps the blank band.
    const labels = Array.isArray(ex.columns) ? ex.columns.map((column) => String(typeof column === "string" ? column : column?.label || "")) : [];
    return { type: "table", treatment: "categories", variant: "standard", columns: [{ label: labels[0] || "", type: "category", width: 200 }, { label: labels[1] || "", type: "text", width: 800 }], rows, density: ex.density };
  }
  return ex;
}

function exhibitItem(exIn, id, baseDir, size = SIZE) {
  const ex = tableAlias(exIn);
  const { type, layout: _l, ...rest } = ex;
  if (type === "image") return { id, component: "image-frame", props: { ...imageProps(ex.path ? ex : ex.image, baseDir), ...(ex.fit ? { fit: ex.fit } : {}) }, size };
  if (type === "cards" || type === "quadrants") { const { centre, ...sz } = size; return { id, component: type, props: { ...rest, ...(centre ? { valign: "middle" } : {}) }, size: sz }; }
  if (type === "swot") return { id, component: "quadrants", props: { quadrants: ["Strengths", "Weaknesses", "Opportunities", "Threats"].map((title, i) => ({ title, points: [rest.strengths, rest.weaknesses, rest.opportunities, rest.threats][i] || [] })) }, size };
  if (type === "table") {
    const styled = styleTable(rest);
    return { id, component: "table", props: { ...styled, density: rest.density || "body", fillHeight: size.height === "fill", ...(rest.rowSpacing ? { rowSpacing: rest.rowSpacing } : {}), ...(rest.headerShape ? { headerShape: rest.headerShape } : {}) }, size };
  }
  // A metrics exhibit: one row up to four tiles, a grid of equal rows beyond
  // (the McKinsey "Impact to date" 3x3 of navy tiles). `tone` sets every tile.
  if (type === "metrics") {
    const tiles = rest.items.map((m) => (typeof m === "string" ? { value: m } : m));
    const perRow = rest.columns || (tiles.length <= 4 ? tiles.length : tiles.length <= 6 ? 3 : tiles.length <= 8 ? 4 : 3);
    const rows = []; for (let i = 0; i < tiles.length; i += perRow) rows.push(tiles.slice(i, i + perRow));
    const tile = (m, i) => ({ id: `${id}-${i}`, component: "metric", props: { ...(rest.tone ? { tone: rest.tone } : {}), ...(rest.tone === "ink" || rest.tone === "rule" || rows.length > 1 ? { variant: "prominent" } : {}), ...m }, size: { width: { fr: 1 }, height: rows.length > 1 ? "fill" : 140 } });
    if (rows.length === 1) return { id, layout: "flow.row", size: HUG, items: rows[0].map(tile) };
    let n = 0;
    return { id, layout: "flow.column", size, items: rows.map((row, r) => ({ id: `${id}-row-${r}`, layout: "flow.row", size: { width: { fr: 1 }, height: "fill" }, items: row.map((m) => tile(m, n++)) })) };
  }
  if (type.startsWith("chart.")) {
    const multi = Array.isArray(rest.series) && rest.series.length > 1;
    // Lines carry their series name at the end of the line instead of a legend,
    // and no per-point labels when there is more than one series.
    const line = type === "chart.line" || type === "chart.area";
    const props = { dataLabels: !(line && multi), legend: multi && !line, ...(line && multi ? { endLabels: true } : {}), highlights: [], annotations: [], referenceLines: [], ...rest };
    // Lines that finish close together need their end labels pushed apart, which
    // only the drawn chart can do; the native chart would stack them.
    if (line && multi && props.endLabels && props.native !== false) {
      const ends = rest.series.map((sr) => Number(sr.values?.at(-1))).filter(Number.isFinite).sort((a, b) => a - b);
      const all = rest.series.flatMap((sr) => sr.values || []).filter(Number.isFinite);
      const range = Math.max(...all) - Math.min(0, ...all) || 1;
      if (ends.some((v, i) => i && (v - ends[i - 1]) / range < 0.08)) props.native = false;
    }
    // A leftover cagr (one the change rule could not compute) becomes a heading pill.
    if (rest.cagr) { props.badge = rest.cagr.label || `CAGR ${rest.cagr.from}–${rest.cagr.to}`; delete props.cagr; }
    delete props.change;
    return { id, component: type, props, size };
  }
  if (type === "relationship-network" && Array.isArray(rest.edges)) rest.edges = rest.edges.map((e, i) => ({ id: `${e.from}-${e.to}-${i}`, direction: "none", relation: "relates-to", ...e }));
  return { id, component: type, props: rest, size };
}

/**
 * Row rule: every panel in a row carries a heading band and the bands share one
 * rule line, so content starts level across the row. Charts bring their own
 * heading (chart-title); anything else is wrapped in a headed section.
 */
const DIAGRAM_TYPES = ["cards", "quadrants", "swot", "metrics", "cycle", "steps", "people", "logos", "framework", "relationship-network", "map", "process", "chevron-process", "timeline", "roadmap", "tree", "organization", "funnel", "matrix", "journey", "image"];
/** A diagram carries no heading band unless the author gives it one; its side column then centres instead. */
function unheaded(ex) { return DIAGRAM_TYPES.includes(ex.type) && !ex.panelHeading; }
function headedPanel(ex, item, id, align = true) {
  if (unheaded(ex)) return item;
  if (String(ex.type).startsWith("chart.")) {
    if (ex.panelHeading && !ex.heading) item.props.heading = ex.panelHeading;
    return item;
  }
  // The band exists for the row rule: it gives the panel's content the same
  // starting line as its neighbour's. When the author has not named the panel,
  // the band stays blank rather than printing the table's own first column
  // label back at it (the header row says that already) or the word "Detail" -
  // and when nothing beside it carries a heading to align to, there is no band
  // at all, because an empty band is a rule and a gap that say nothing.
  const heading = ex.panelHeading || ex.heading || (align ? " " : null);
  if (!heading) return item;
  return { id: `${id}-panel`, heading, treatment: "open", size: item.size, items: [item] };
}

/**
 * Table treatment is chosen from what the table says, not from the first option
 * in the list. An explicit `treatment`, `variant` or object column wins.
 *   sequence  (rows numbered, or a Stage/Step/Phase first column) → numbered category
 *             markers on a filled first column ("categories" treatment)
 *   scorecard (criteria × options, ≥ 4 columns)                   → filled header ("standard")
 *   decision  (last column is a Decision/Then/So-what)             → filled header, accented last column
 *   listing   (anything else)                                      → open rules only
 */
const RAG_WORDS = [
  [/^(on[\s-]?track|green|ok|on plan|on schedule)$/i, "on-track"],
  [/^(complete|completed|done|delivered)$/i, "complete"],
  [/^(behind|behind plan|delayed|amber|yellow|slipping|watch)$/i, "behind"],
  [/^(at[\s-]?risk|overdue|red|blocked|off[\s-]?track|critical)$/i, "at-risk"],
  [/^(not started|planned|pending|to do|todo)$/i, "not-started"],
];
/** Verdict cells: ✓/✗, status words and "45 %" under a progress heading become typed cells. */
function verdictCell(value, header) {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (/^(✓|✔|yes|y|true)$/i.test(text)) return { type: "check", value: "yes" };
  if (/^(✗|✘|✕|x|no|n|false)$/i.test(text)) return { type: "check", value: "no" };
  for (const [re, state] of RAG_WORDS) if (re.test(text)) return { type: "rag", value: state, text: /^(green|amber|yellow|red|ok)$/i.test(text) ? undefined : text };
  if (/^\d{1,3}\s*%$/.test(text) && /(complete|progress|done|achiev)/i.test(String(header || ""))) return { type: "progress", value: Number(text.replace(/[^\d]/g, "")) };
  // Signed changes under a change heading read in green or red.
  if (/(change|delta|yoy|y\/y|growth|vs\.?|variance|difference)/i.test(String(header || "")) && /^[+\-−–]\s?\d/.test(text)) return { type: "text", text, tone: /^[+]/.test(text) ? "positive" : "negative" };
  // Outlook columns: arrows or the outlook words become trend rings.
  if (/(outlook|trend|momentum|direction)/i.test(String(header || "")) && /^(↑|↗|up|positive|strong|improving|→|flat|neutral|moderate|stable|↓|↘|down|negative|weak|declining)$/i.test(text)) return { type: "trend", value: /^(↑|↗|up|positive|strong|improving)$/i.test(text) ? "up" : /^(↓|↘|down|negative|weak|declining)$/i.test(text) ? "down" : "flat" };
  return value;
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
  const rows = rowsIn.map((r) => Array.isArray(r) ? r.map((cell) => {
    if (!cell || typeof cell !== "object" || cell.scale || !["harvey", "binary", "heatmap"].includes(cell.type)) return cell;
    const id = cell.type === "harvey" ? "rating" : cell.type === "binary" ? "check" : "heat";
    used = true; scales[id] = scales[id] || DEFAULT_SCALES[id];
    // Binary states accept the words an author writes: positive/yes/true, negative/no/false.
    const value = cell.type === "binary" ? ({ positive: "yes", true: "yes", yes: "yes", negative: "no", false: "no", no: "no", missing: "missing", na: "missing" }[String(cell.value).toLowerCase()] ?? cell.value) : cell.value;
    return { ...cell, value, scale: id };
  }) : r);
  return { rows, ...(used || ex.scales ? { scales } : {}) };
}

export function styleTable(ex) {
  const columns = ex.columns.map((c, i) => typeof c === "string" ? { label: c, type: "text", bold: i === 0, width: columnWeight(ex, i) } : { ...c });
  const scaled = withDefaultScales(ex, ex.rows.map((r) => Array.isArray(r) ? r.map((cell, i) => verdictCell(cell, columnLabel(ex.columns[i]))) : r));
  const rowsIn = scaled.rows;
  if (scaled.scales) ex = { ...ex, scales: scaled.scales };
  // The recommended option's column is tinted end to end.
  const recommended = ex.recommended !== undefined ? columns.findIndex((c) => String(c.label).trim().toLowerCase() === String(ex.recommended).trim().toLowerCase()) : -1;
  if (ex.recommended !== undefined && recommended < 0) throw new Error(`Table recommended column "${ex.recommended}" is not a column label`);
  const extra = { ...(recommended >= 0 ? { highlightColumn: recommended } : Number.isInteger(ex.highlightColumn) ? { highlightColumn: ex.highlightColumn } : {}), ...(ex.scales ? { scales: ex.scales } : {}) };
  // A "Total …" row at the end is the accent total band.
  rowsIn.forEach((r, i) => {
    if (Array.isArray(r) && i === rowsIn.length - 1 && /^total\b/i.test(String(r[0]?.text ?? r[0] ?? ""))) rowsIn[i] = { style: "total", cells: r };
  });
  // `highlightRow`: the subject's row (by first-cell label or index) as a tinted
  // band, the way the benchmark tables single out the client city or company.
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
  const explicit = ex.treatment || ex.variant || ex.columns.some((c) => typeof c === "object");
  if (explicit) return { variant: ex.variant || "plain", treatment: ex.treatment || "open", columns, rows: rowsIn, ...extra };
  const first = rowsIn.map((r) => String(r[0]?.text ?? r[0] ?? ""));
  const numbered = first.length > 1 && first.every((v) => /^\s*\d+\s*[·.)\-–:]\s*\S/.test(v));
  const head0 = String(columns[0].label || "").toLowerCase();
  const headLast = String(columns[columns.length - 1].label || "").toLowerCase();
  const sequence = numbered || /^(stage|step|phase|wave|horizon|priority|milestone)s?\b/.test(head0);
  const decision = /\b(decide|decision|implication|so what|then\b|recommend|verdict|action)/.test(headLast);
  const scorecard = columns.length >= 4 && /\b(gate|criteri|dimension|factor|requirement|measure|option)/.test(head0);
  if (sequence) {
    const cols = [{ ...columns[0], type: "category" }, ...columns.slice(1)];
    const rows = rowsIn.map((r, i) => {
      const m = String(r[0]?.text ?? r[0]).match(/^\s*(\d+)\s*[·.)\-–:]\s*(.*)$/);
      const cell = { type: "category", text: m ? m[2] : String(r[0]?.text ?? r[0]), sectionNumber: m ? Number(m[1]) : i + 1 };
      return [cell, ...r.slice(1)];
    });
    return { variant: "standard", treatment: "categories", columns: cols, rows, ...extra };
  }
  if (scorecard) return { variant: "standard", treatment: "standard", columns, rows: rowsIn, ...extra };
  if (decision) {
    const rows = rowsIn.map((r) => [...r.slice(0, -1), typeof r[r.length - 1] === "string" ? { text: r[r.length - 1], type: "highlight" } : r[r.length - 1]]);
    return { variant: "standard", treatment: "standard", columns, rows, ...extra };
  }
  return { variant: "plain", treatment: "open", columns, rows: rowsIn, ...extra };
}

// Columns are weighted by the measured width of the widest thing they hold
// (header included, the first column bold), plus cell padding, clamped between
// 60 px and 420 px so a "Year 1" column stays narrow, a short label never
// wraps, and a sentence column takes the rest and wraps.
function columnWeight(ex, i) {
  const font = { fontFamily: "Arial", fontSize: 12, wrapWidthRatio: 1 };
  const texts = [String(columnLabel(ex.columns[i]) ?? ""), ...ex.rows.map((r) => { const row = Array.isArray(r) ? r : r?.cells || []; return String(row[i]?.text ?? row[i] ?? ""); })];
  const widest = Math.max(...texts.map((text) => measureText(text.replace(/^\s*\d+\s*[·.)\-–:]\s*/, "") || " ", 4000, { ...font, bold: i === 0 }).width));
  return Math.min(420, Math.max(60, widest)) + 24;
}

const heavyTable = (ex) => (ex.rows || []).length > 5 || (ex.rows || []).some((row) => (Array.isArray(row) ? row : row?.cells || []).some((cell) => String(cell?.text ?? cell ?? "").length > 60));
const tableSignature = (ex) => { const s = styleTable(ex); return `${s.variant}/${s.treatment}`; };

/**
 * Two tables on one page must read as one design. They share a row only when
 * their treatments already match and both are light; otherwise each table takes
 * its own page. The title carries a 1/2 marker, the points travel with the first
 * page and the so-what, being the pages' shared claim, with every page. An
 * explicit `layout` is left alone.
 */
export function splitTables(slide) {
  if (slide.layout && slide.layout !== "auto") return [slide];
  const exhibits = slide.exhibits || [];
  const tables = exhibits.filter((ex) => ex?.type === "table");
  if (tables.length < 2) return [slide];
  const oneDesign = new Set(tables.map(tableSignature)).size === 1;
  if (oneDesign && !tables.some(heavyTable)) return [slide];
  return exhibits.map((ex, i) => {
    const page = { ...slide, exhibit: ex, title: `${slide.title} (${i + 1}/${exhibits.length})` };
    delete page.exhibits;
    if (slide.id) page.id = `${slide.id}-${i + 1}`;
    if (i !== 0) delete page.points;
    return page;
  });
}

/**
 * A long table continues on the next page with its header row repeated rather
 * than stepping down to dense type: more than MAX_ROWS rows split into equal
 * pages marked (1/2), (2/2). Applies to a lone table under an auto layout.
 */
const MAX_ROWS = 8;
export function paginateTable(slide, bodyScale = 1) {
  if (slide.layout && slide.layout !== "auto") return [slide];
  const ex = slide.exhibit;
  if (!ex || ex.type !== "table" || !Array.isArray(ex.rows) || slide.exhibits) return [slide];
  // The page holds about 16 body lines of table (compact rows in the firm decks
  // run to 14–20 one-line rows): a row of short cells counts one line, longer
  // cells wrap, so a ranking table keeps a dozen rows on a page while a text
  // table breaks at eight.
  const cellText = (cell) => String(cell?.text ?? (Array.isArray(cell?.points) ? cell.points.join(" ") : cell ?? ""));
  const columnChars = slide.points?.length ? 30 : 42;
  const lines = (r) => Math.max(1, ...(Array.isArray(r) ? r : r.cells || []).map((cell) => Math.ceil(cellText(cell).length / columnChars)));
  // Row heights in body density: a one-line row takes about 34px, each further
  // line 16px, the header 40px. The budget is the body height (508px built in,
  // scaled by a template's chrome) less the page's other furniture.
  // Heights come from the table renderer itself, not from a model of it: the
  // styled props (status pills, zebra bands, wrapped cells) decide the row
  // height, and only `measureTable` knows them.
  const width = slide.points?.length || slide.insight || slide.kpi ? Math.round((BODY_WIDTH - CONNECTOR_WIDTH - COLUMN_GAP * 3) * 3 / 5) : BODY_WIDTH;
  // A single-line row measures 48px at body density, 32 compact and 24 dense,
  // with a header of 44, 32 and 24: the fallback when a spec the renderer cannot
  // measure (mismatched columns, a half-built table) reaches this far.
  const ROW = { body: { row: 48, line: 20, header: 44 }, compact: { row: 32, line: 16, header: 32 }, dense: { row: 24, line: 14, header: 24 } };
  const modelled = (density) => {
    const metric = ROW[density] || ROW.body;
    return metric.header + ex.rows.reduce((sum, r) => sum + metric.row + metric.line * (lines(r) - 1), 0);
  };
  const heightAt = (density) => {
    try {
      const styled = styleTable({ ...ex, density });
      const measured = measureTable({ frame: { x: 0, y: 0, width, height: 100000 }, props: { ...styled, density } }).height;
      return Number.isFinite(measured) ? measured : modelled(density);
    } catch {
      return modelled(density);
    }
  };
  const available = 508 * bodyScale - (slide.callout ? 70 : 0) - (Array.isArray(slide.metrics) && slide.metrics.length ? 112 : 0) - (slide.soWhat ? 44 : 0) - 4;
  // The density ladder comes before the split. A twenty-row table set compact is
  // one page of evidence; the same table halved across two pages is two pages of
  // half an argument, and the reference decks run tables to twenty and thirty
  // rows rather than splitting them. `density` on the exhibit still wins.
  const ladder = ex.density === undefined ? ["body", "compact", "dense"] : [ex.density];
  const fits = ladder.find((density) => heightAt(density) <= available);
  if (fits) return [fits === "body" || fits === ex.density ? slide : { ...slide, exhibit: { ...ex, density: fits } }];
  const densest = ladder[ladder.length - 1];
  const perRow = Math.max(20, heightAt(densest) / Math.max(1, ex.rows.length));
  const rowsPerPage = Math.max(3, Math.floor(available / perRow));
  const pages = Math.ceil(ex.rows.length / rowsPerPage), per = Math.ceil(ex.rows.length / pages);
  return Array.from({ length: pages }, (_, i) => {
    const rows = ex.rows.slice(i * per, (i + 1) * per);
    // A highlighted row travels with the page that holds it; other pages drop the key.
    const label = (r) => String((Array.isArray(r) ? r : r.cells)[0]?.text ?? (Array.isArray(r) ? r : r.cells)[0] ?? "").trim().toLowerCase();
    const keeps = ex.highlightRow === undefined ? false : Number.isInteger(ex.highlightRow) ? ex.highlightRow >= i * per && ex.highlightRow < (i + 1) * per : rows.some((r) => label(r) === String(ex.highlightRow).trim().toLowerCase());
    const { highlightRow, ...rest } = ex;
    const page = { ...slide, exhibit: { ...rest, density: densest, rows, ...(keeps ? { highlightRow: Number.isInteger(highlightRow) ? highlightRow - i * per : highlightRow } : {}) }, title: `${slide.title} (${i + 1}/${pages})` };
    if (slide.id) page.id = `${slide.id}-${i + 1}`;
    if (i !== 0) delete page.points;
    return page;
  });
}

/**
 * The shared ceiling for peer charts. The ladder is fine-grained on purpose: a
 * 62% maximum rounded to 100 leaves the bars crossing three fifths of the plot
 * and the page reading empty, where a ceiling of 80 keeps the scale honest and
 * the marks worth looking at.
 */
/** A chart value as a table cell: whole numbers from ten up, one decimal below. */
function formatTableValue(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value ?? "");
  return Math.abs(value) >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
}

function niceCeiling(value) {
  if (!(value > 0)) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  for (const rung of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (rung * magnitude >= value) return rung * magnitude;
  return 10 * magnitude;
}

/** A KPI strip: equal tiles in a row, hugging one tile height. */
/** `metricsTone` on the page sets every tile: dark, tint, ink (black tiles) or rule (accent values behind hairlines). */
function metricsStrip(metrics, id, tone) {
  const tiles = metrics.map((m) => (typeof m === "string" ? { value: m } : m));
  const prominent = tone === "ink" || tone === "rule";
  return { id, layout: "flow.row", size: { width: { fr: 1 }, height: prominent ? 124 : tone === "ring" ? 150 : 104 }, items: tiles.map((m, i) => ({ id: `${id}-${i}`, component: "metric", props: { ...(tone ? { tone } : {}), ...(prominent ? { variant: "prominent" } : {}), ...m }, size: { width: { fr: 1 }, height: "fill" } })) };
}

/**
 * Hero fitness: a single-series chart with three categories or fewer is not a
 * hero; it becomes a KPI strip (value tiles labelled by category) so the page
 * does not carry a plot that is mostly air.
 */
function thinChart(ex) {
  if (!ex || !String(ex.type).startsWith("chart.") || !Array.isArray(ex.series) || ex.series.length !== 1) return false;
  const values = ex.series[0].values || [];
  return values.length > 0 && values.length <= 3 && !ex.type.includes("waterfall") && !ex.type.includes("pie") && !ex.type.includes("donut");
}
function chartToMetrics(ex) {
  // "$k" wraps the number ($48k); "%" and "pts" follow it (48%).
  const unit = String(ex.unit || "").trim();
  const m = unit.match(/^([^\w\s%]*)(.*)$/);
  const prefix = m ? m[1] : "", suffix = m ? m[2] : unit;
  return (ex.categories || []).map((c, i) => ({ value: `${prefix}${ex.series[0].values[i]}${suffix}`, label: c, tone: "dark" }));
}

/** `photo: { path, alt, credit }` on a content page: a cropped photograph column. */
function photoStrip(slide, id, baseDir, fr = 1) {
  if (!slide.photo) return null;
  return { id, component: "image-frame", props: { ...imageProps(slide.photo, baseDir), fit: "cover" }, size: { width: { fr }, height: "fill" } };
}

// The body frame a content page lays out into, and the furniture between its
// columns: used to measure a side column against what it holds before the
// planner turns fractions into pixels.
const BODY_WIDTH = 1160, BODY_HEIGHT = 508, CONNECTOR_WIDTH = 44, COLUMN_GAP = 16;
const LIST_BODY_PX = 14, LIST_ITEM_GAP = 16, LIST_LEAD_GAP = 4, LIST_MARKER_OFFSET = 22;
/** The height a points list wants at a given column width. */
function pointsHeight(points, width) {
  const textWidth = Math.max(60, width - LIST_MARKER_OFFSET);
  let total = 0;
  (points || []).forEach((point, index) => {
    const object = point && typeof point === "object";
    const lead = object && point.lead ? measureText(String(point.lead), textWidth, { fontFamily: "Arial", fontSize: LIST_BODY_PX, bold: true }) : null;
    const text = String(object ? point.text ?? "" : point ?? "");
    const body = text ? measureText(text, textWidth, { fontFamily: "Arial", fontSize: LIST_BODY_PX }) : null;
    total += (lead ? lead.height + (body ? LIST_LEAD_GAP : 0) : 0) + (body ? body.height : 0);
    if (index < (points || []).length - 1) total += LIST_ITEM_GAP;
  });
  return total;
}

function pointsItem(points, id, tone, fill, inColumn = false) {
  // The side column is a track, not a shelf: its points spread down it unless
  // the deck is airy, where the white space is the point. A list that hugs the
  // top of a 500px column leaves two fifths of it empty, which is how a page
  // that carries real content still reads as thin. A list under a row of
  // exhibits hugs instead — there it is a footer, not a column.
  const distribute = inColumn && fill !== "airy" && points.length > 1;
  return { id, component: "bullet-list", props: { variant: "body", items: points, ...(tone === "dark" || tone === "primary" ? { tone: "inverse" } : {}), ...(distribute ? { distribute: true } : {}) }, size: distribute ? { width: { fr: 1 }, height: "fill" } : HUG };
}

/**
 * How full a page should read. `fill` on the deck: "full" (the pre-read page —
 * the side column's points spread down the column and the gates want more ink),
 * "balanced" (the default working page) or "airy" (a live-pitch page, where
 * white space is the point and the gates relax). Absent, it follows the density:
 * pre-read and appendix fill, live-pitch is airy, executive is balanced.
 */
export const FILL_LEVELS = Object.freeze(["full", "balanced", "airy"]);
export function resolveFill(spec = {}) {
  if (spec.fill !== undefined) {
    if (!FILL_LEVELS.includes(spec.fill)) throw new Error(`Unknown fill: ${spec.fill}; use one of ${FILL_LEVELS.join(", ")}`);
    return spec.fill;
  }
  return { "pre-read": "full", appendix: "full", "live-pitch": "airy" }[spec.density] ?? "balanced";
}

/**
 * `pointsTone`: the side column as a panel — "dark" (a navy "Key insights"
 * column, white text), "muted" (grey commentary), "tint" (accent-tinted
 * message) or "primary". Absent, the column is open with a rule.
 */
const POINTS_TONES = ["open", "dark", "muted", "tint", "primary"];
function sideTreatment(slide) {
  const tone = slide.pointsTone ?? "open";
  if (!POINTS_TONES.includes(tone)) throw new Error(`Unknown pointsTone: ${tone}; use one of ${POINTS_TONES.join(", ")}`);
  return tone;
}

function soWhatItem(text, id) {
  return { id, component: "insight", props: { text, variant: "tonal" }, size: HUG };
}

function chooseLayout(slide) {
  if (slide.layout && slide.layout !== "auto") return slide.layout;
  const exhibits = slide.exhibits || (slide.exhibit ? [slide.exhibit] : []);
  if (slide.arrange === "stack") return "stack";
  if (slide.arrange === "row") return "two-up";
  if (slide.arrange === "grid" || exhibits.length >= 4) return "grid";
  // Auto-stack: two charts on one category set with points beside them stack
  // in the hero column rather than shrinking into a three-way row.
  if (exhibits.length === 2 && slide.points?.length && exhibits.every((ex) => String(ex.type).startsWith("chart.")) && JSON.stringify(exhibits[0].categories) === JSON.stringify(exhibits[1].categories)) return "stack";
  if (exhibits.length >= 2) return "two-up";
  if (exhibits.length === 1) return slide.points?.length || slide.insight || slide.insights?.length || slide.kpi ? "exhibit-left" : "exhibit-full";
  return "text";
}

/**
 * Highlight the answer: a single-series bar or column chart with no declared
 * highlight takes one from the title when the title names a category.
 */
function highlightFromTitle(ex, title) {
  if (!ex || !["chart.column", "chart.bar", "chart.range"].includes(ex.type) || (ex.highlights || []).length) return ex;
  if (ex.type !== "chart.range" && (!Array.isArray(ex.series) || ex.series.length !== 1)) return ex;
  const t = String(title || "").toLowerCase();
  // A category may carry a footnote marker ("2022\u00b9"); the title does not, so
  // the match is made on the bare label.
  const bare = (value) => String(value).replace(/[\u00b9\u00b2\u00b3\u2074-\u2079]/g, "");
  const hits = (ex.categories || []).filter((c) => bare(c).length >= 3 && new RegExp(`(^|[^a-z0-9])${bare(c).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`).test(t)).sort((a, b) => t.indexOf(bare(a).toLowerCase()) - t.indexOf(bare(b).toLowerCase()));
  return hits.length ? { ...ex, highlights: [{ category: hits[0], style: "bar" }] } : ex;
}

/**
 * Growth indicators. A chart that measures a change carries the change on the
 * chart: an arrow with a bubble from the first to the last period of a single
 * series, or a bracket per category between two series when the title talks
 * about the gap. `change: false` turns it off; `change: { from, to, text? }`
 * (or `change: true`) asks for the arrow explicitly; `cagr` puts the rate in
 * the bubble as "+13% p.a.".
 */
const PERIOD_CATEGORY = /(?:19|20)\d{2}|^FY\s?\d{2,4}|^[QH][1-4]\b|^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b|^(?:Current|Today|Now|Baseline|Before|Future|Target|After|Year \d)/i;
const GAP_WORDS = /\b(?:gap|beat|beats|lead|leads|ahead|behind|trail|trails|above|below|higher|lower|more than|less than|points?|pts|pp|vs\.?|versus|outperform\w*|exceed\w*)\b/i;
const CHANGE_TYPES = ["chart.column", "chart.bar", "chart.line", "chart.area", "chart.stacked-column"];
const fmtNumber = (n) => { const a = Math.abs(n); return a >= 10 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, ""); };
const signed = (n, suffix = "") => `${n >= 0 ? "+" : "−"}${fmtNumber(Math.abs(n))}${suffix}`;
/** `percent: true` on a stacked chart re-expresses each category as shares of its total (100% stack). */
export function percentStack(ex) {
  if (!ex || !ex.percent || !["chart.stacked-column", "chart.stacked-bar"].includes(ex.type) || !Array.isArray(ex.series) || !Array.isArray(ex.categories)) return ex;
  const totals = ex.categories.map((_, i) => ex.series.reduce((sum, sr) => sum + (sr.values[i] || 0), 0));
  const series = ex.series.map((sr) => ({ ...sr, values: sr.values.map((v, i) => (totals[i] ? Math.round((v / totals[i]) * 1000) / 10 : 0)) }));
  const { percent, ...rest } = ex;
  return { ...rest, series, unit: ex.unit || "% of total", yMin: 0, yMax: 100, change: ex.change ?? false };
}

export function changeFromContent(ex, title) {
  if (!ex || !CHANGE_TYPES.includes(ex.type) || ex.change === false || (ex.changeAnnotations || []).length) return ex;
  const categories = ex.categories || [], series = Array.isArray(ex.series) ? ex.series : [];
  if (categories.length < 2 || !series.length || !series.every((sr) => Array.isArray(sr.values) && sr.values.length === categories.length && sr.values.every(Number.isFinite))) return ex;
  const percentUnit = /%|percent|share|pts|points/i.test(String(ex.unit || ""));
  const delta = (a, b) => (percentUnit ? signed(b - a, " pp") : a > 0 ? signed(((b - a) / a) * 100, "%") : null);
  const out = { ...ex }; delete out.change;
  if (ex.cagr) {
    // The CAGR belongs on the arrow between its two periods, not in the heading.
    const a = categories.indexOf(ex.cagr.from), b = categories.indexOf(ex.cagr.to);
    if (a < 0 || b <= a) throw new Error("cagr.from and cagr.to must name two categories in order");
    const v0 = series[0].values[a], v1 = series[0].values[b];
    const year = (c) => { const m = String(c).match(/(?:19|20)\d{2}/); return m ? Number(m[0]) : null; };
    const years = year(ex.cagr.from) !== null && year(ex.cagr.to) !== null && year(ex.cagr.to) > year(ex.cagr.from) ? year(ex.cagr.to) - year(ex.cagr.from) : b - a;
    if (v0 > 0 && v1 > 0) {
      const rate = (Math.pow(v1 / v0, 1 / years) - 1) * 100;
      delete out.cagr;
      return { ...out, changeAnnotations: [{ start: ex.cagr.from, end: ex.cagr.to, style: "arrow", text: `${signed(rate, "%")} p.a.` }] };
    }
    return ex;
  }
  const explicit = ex.change && typeof ex.change === "object" ? ex.change : null;
  const periodic = categories.every((c) => PERIOD_CATEGORY.test(String(c)));
  const stacked = ex.type === "chart.stacked-column";
  // A stack's change is the change in its totals.
  const totals = stacked ? categories.map((_, i) => series.reduce((sum, sr) => sum + sr.values[i], 0)) : series[0].values;
  // `change: "steps"`: the period-to-period change between every adjacent pair,
  // as a small bracket above each pair (the e-Conomy small-multiple pattern).
  if (ex.change === "steps" && (series.length === 1 || stacked) && categories.length >= 2 && categories.length <= 8) {
    const annotations = [];
    for (let i = 1; i < categories.length; i += 1) {
      const text = delta(totals[i - 1], totals[i]);
      if (text) annotations.push({ start: categories[i - 1], end: categories[i], style: "bracket", text, compact: true });
    }
    return annotations.length ? { ...out, changeAnnotations: annotations } : ex;
  }
  // An implied first-to-last change only reads on a series that trends: a run
  // that peaks and falls back, or starts from next to nothing, gets no arrow
  // unless the author asks for one (an epidemic curve, a launch ramp).
  const peak = Math.max(...totals.map(Math.abs)), first = Math.abs(totals[0]), last = Math.abs(totals[totals.length - 1]);
  // A growth column beside the stack already states the change per segment.
  const trends = first >= peak * 0.05 && (last >= peak * 0.6 || last <= first) && !ex.segmentGrowth;
  if ((series.length === 1 || stacked) && (explicit || ex.change === true || (periodic && ex.type !== "chart.bar" && trends))) {
    const from = explicit?.from ?? categories[0], to = explicit?.to ?? categories[categories.length - 1];
    const a = categories.indexOf(from), b = categories.indexOf(to);
    if (a < 0 || b <= a) throw new Error("change.from and change.to must name two categories in order");
    const text = explicit?.text || delta(totals[a], totals[b]);
    // Columns take the diagonal arrow across the tops; a line takes its change
    // beside its last point, where the eye already lands.
    // Adjacent columns take a bracket: an arrow has no room to read between them.
    const style = ex.type === "chart.line" || ex.type === "chart.area" ? "end-bubble" : b - a === 1 ? "bracket" : "arrow";
    return text ? { ...out, changeAnnotations: [{ start: from, end: to, style, text }] } : ex;
  }
  if (series.length === 2 && categories.length <= 6 && (ex.change === true || GAP_WORDS.test(String(title || "")))) {
    // The subject is the focus series when one is named, else the first series;
    // the bubble reads subject minus comparator.
    const focus = series.find((sr) => sr.name === ex.focusSeries) || series[0], base = series.find((sr) => sr !== focus);
    const annotations = categories.map((c, i) => ({ start: { category: c, series: base.name }, end: { category: c, series: focus.name }, style: "bracket", text: percentUnit ? signed(focus.values[i] - base.values[i], " pp") : signed(focus.values[i] - base.values[i]) }));
    return { ...out, changeAnnotations: annotations };
  }
  return ex;
}

/**
 * `paired: true` on a horizontal bar chart with two or three series: one panel
 * per series side by side, each on its own scale and headed by the series
 * name, sharing the left panel's category column (the McKinsey "share of
 * commuters | share of residents" pair). The row is a two-up of peers, so the
 * plots share one top band and the rows line up.
 */
function pairedBars(slide) {
  const ex = slide.exhibit;
  if (!ex || ex.type !== "chart.bar" || ex.paired !== true) return slide;
  const series = Array.isArray(ex.series) ? ex.series : [];
  if (series.length < 2 || series.length > 3) throw new Error("paired bars take two or three series");
  const { paired, heading, unit, units: unitsIn, ...rest } = ex;
  const units = Array.isArray(unitsIn) ? unitsIn : [];
  const panels = series.map((sr, i) => ({ ...rest, series: [sr], panelHeading: sr.name, ...(units[i] || unit ? { unit: units[i] || unit } : {}), ...(i ? { categoryLabels: false } : {}), native: false }));
  return { ...slide, exhibit: undefined, exhibits: panels, arrange: "row", pairedHeading: heading, pairedWeights: series.map((_, i) => (i ? 1 : 1.35)) };
}

/**
 * `footnotes: [{ on, text }]`: the firm page's numbered notes. Each one prints a
 * superscript against the first occurrence of `on` — a category, a series name,
 * a column label, a table cell, a point — and its text joins the numbered note
 * line under the page. A footnote with no `on` (or whose `on` is not found) is
 * still numbered and still printed: the note is the point, the marker is a
 * convenience. This is where a page's basis, exclusion and as-at date live, and
 * it is the cheapest honest density there is.
 */
const FOOTNOTE_MARKS = ["\u00b9", "\u00b2", "\u00b3", "\u2074", "\u2075", "\u2076", "\u2077", "\u2078", "\u2079"];
function applyFootnotes(slide) {
  const list = Array.isArray(slide.footnotes) ? slide.footnotes : null;
  if (!list || !list.length) return slide;
  if (list.length > FOOTNOTE_MARKS.length) throw new Error("A page carries at most nine footnotes");
  const notes = [];
  const pending = list.map((entry, index) => {
    const text = String((typeof entry === "string" ? entry : entry?.text) ?? "").trim();
    if (!text) throw new Error("A footnote needs text");
    notes.push(text);
    const on = typeof entry === "object" && entry?.on ? String(entry.on) : null;
    return { on, mark: FOOTNOTE_MARKS[index], placed: !on };
  });
  // Inside an exhibit a category, a series or a column label is both a printed
  // label and the key the chart matches its highlights and annotations by, so
  // every occurrence takes the marker and the references keep resolving.
  // Outside it, prose takes the marker once.
  const walk = (node, everywhere) => {
    if (typeof node === "string") {
      let out = node;
      for (const item of pending) {
        if (!item.on || (item.placed && !everywhere)) continue;
        if (!out.includes(item.on)) continue;
        if (!everywhere) {
          const at = out.indexOf(item.on);
          out = `${out.slice(0, at + item.on.length)}${item.mark}${out.slice(at + item.on.length)}`;
        } else {
          out = out.split(item.on).join(`${item.on}${item.mark}`);
        }
        item.placed = true;
      }
      return out;
    }
    if (Array.isArray(node)) return node.map((item) => walk(item, everywhere));
    if (node && typeof node === "object") {
      const out = {};
      for (const [key, value] of Object.entries(node)) out[key] = key === "path" || key === "type" || key === "dataUri" ? value : walk(value, everywhere);
      return out;
    }
    return node;
  };
  const marked = {};
  if (slide.exhibit !== undefined) marked.exhibit = walk(slide.exhibit, true);
  if (slide.exhibits !== undefined) marked.exhibits = walk(slide.exhibits, true);
  for (const key of ["points", "rows", "metrics", "insight", "kpi", "callout"]) {
    if (slide[key] !== undefined) marked[key] = walk(slide[key], false);
  }
  const existing = slide.note === undefined ? [] : Array.isArray(slide.note) ? slide.note : [slide.note];
  const { footnotes, ...rest } = slide;
  return { ...rest, ...marked, note: [...notes, ...existing] };
}

export function composeSlide(slide, index, baseDir, fill = "balanced", elements = 1) {
  const id = slide.id || `s${String(index + 1).padStart(2, "0")}`;
  slide = applyFootnotes(slide);
  slide = pairedBars(slide);
  if (slide.exhibit) slide = { ...slide, exhibit: changeFromContent(highlightFromTitle(percentStack(slide.exhibit), slide.title), slide.title) };
  if (slide.exhibits) slide = { ...slide, exhibits: slide.exhibits.map((ex) => changeFromContent(highlightFromTitle(percentStack(ex), slide.title), slide.title)) };
  if (slide.kind === "statement") return { id, kind: "statement", text: slide.text || slide.title, ...(slide.accent ? { accent: slide.accent } : {}), ...(slide.subtext ? { subtext: slide.subtext } : {}), ...(slide.tone === "dark" ? { mode: "dark" } : {}), ...(slide.image ? { image: imageProps(slide.image, baseDir) } : {}), ...(slide.notes ? { notes: slide.notes } : {}) };
  if (slide.kind === "takeaways") return { id, kind: "takeaways", ...(slide.title ? { title: slide.title } : {}), items: slide.points || slide.items, ...(slide.tone === "light" ? { mode: "light" } : {}), ...(slide.image ? { image: imageProps(slide.image, baseDir) } : {}), ...(slide.notes ? { notes: slide.notes } : {}) };
  if (slide.kind === "section") return { id, kind: "divider", title: slide.title, ...(slide.summary ? { subtitle: slide.summary } : {}), ...(slide.number !== undefined ? { number: slide.number } : {}), ...(slide.image ? { image: imageProps(slide.image, baseDir) } : {}), ...(slide.notes ? { notes: slide.notes } : {}) };
  if (slide.kind === "agenda") return { id, title: slide.title || "Contents", layout: "flow.column", items: [{ id: `${id}-agenda`, component: "agenda", props: { items: slide.items, ...(slide.active !== undefined ? { active: slide.active } : {}), ...(slide.style === "columns" ? { variant: "columns" } : {}) }, size: SIZE }] };
  const slideIn = slide;
  // A value table under the chart: the chart stacks over a compact table whose
  // columns are the chart's categories.
  // A deck whose weight asks for two elements a page gets the second one offered
  // rather than demanded: a chart of six categories or fewer, with no table, no
  // metrics and no second exhibit, tabulates itself underneath. `dataTable:
  // false` declines it.
  if (elements >= 2 && slide.exhibit && !slide.exhibits && String(slide.exhibit.type).startsWith("chart.")
      && slide.exhibit.dataTable === undefined && Array.isArray(slide.exhibit.series) && Array.isArray(slide.exhibit.categories)
      && slide.exhibit.categories.length <= 6 && slide.exhibit.series.length <= 3
      && !(Array.isArray(slide.metrics) && slide.metrics.length) && !slide.kpi && !thinChart(slide.exhibit)) {
    slide = { ...slide, exhibit: { ...slide.exhibit, dataTable: true } };
  }
  // `dataTable: true` tabulates the chart's own series under it: the same
  // numbers, printed, which is the cheapest second element a page can carry and
  // what the reference pages do under a column chart.
  if (slide.exhibit && slide.exhibit.dataTable === true && Array.isArray(slide.exhibit.series) && !slide.exhibits) {
    slide = { ...slide, exhibit: { ...slide.exhibit, dataTable: slide.exhibit.series.map((series) => ({ label: series.name, values: (series.values || []).map((value) => formatTableValue(value)) })) } };
  }
  if (slide.exhibit && Array.isArray(slide.exhibit.dataTable) && slide.exhibit.dataTable.length && !slide.exhibits) {
    const chart = { ...slide.exhibit }; const rowsIn = chart.dataTable; delete chart.dataTable;
    const table = { type: "table", density: "compact", treatment: "open", variant: "plain", columns: [{ label: "", type: "text", bold: true, width: 120 }, ...(chart.categories || []).map((c) => ({ label: "", type: "text", align: "center", width: 80 }))], rows: rowsIn.map((r) => [r.label, ...(r.values || []).map(String)]) };
    slide = { ...slide, exhibit: undefined, exhibits: [chart, table], arrange: "stack", stackWeights: [4, 1] };
  }
  // Hero fitness: a thin single-series chart becomes a column of KPI tiles
  // (one per category) that stands in for the hero, points beside it.
  let tileColumn = null, tilePoints = [];
  if ((!slide.layout || slide.layout === "auto") && slide.exhibit && !slide.exhibits && thinChart(slide.exhibit) && !slide.metrics) {
    tileColumn = chartToMetrics(slide.exhibit);
    tilePoints = slide.points || [];
    slide = { ...slide, exhibit: undefined, exhibits: undefined, points: undefined };
  }
  // `rows` at slide level is the label-and-text table.
  if (slide.rows && !slide.exhibit && !slide.exhibits) slide = { ...slide, exhibit: { type: "rows", rows: slide.rows, ...(Array.isArray(slide.columns) ? { columns: slide.columns } : {}) } };
  // One big number parked above a table reads as two pages glued together: the
  // tile floats in air and the table starts again under it. A lone metric over a
  // table is the hero number of the side column instead, beside its evidence.
  const TABLE_LIKE = ["table", "rows", "compare", "phase-table"];
  if (Array.isArray(slide.metrics) && slide.metrics.length === 1 && !slide.kpi && slide.metricsPosition !== "bottom" && !slide.exhibits && TABLE_LIKE.includes(slide.exhibit?.type)) {
    const tile = typeof slide.metrics[0] === "string" ? { value: slide.metrics[0] } : slide.metrics[0];
    slide = { ...slide, metrics: undefined, kpi: { value: tile.value, ...(tile.label ? { label: tile.label } : {}), ...(tile.sublabel ? { sublabel: tile.sublabel } : {}) } };
  }
  // A text page whose points carry leads is a numbered ledger: label + text
  // rows with rules, filling the page, rather than a list floating at the top.
  if (!slide.exhibit && !slide.exhibits && !slide.rows && !slide.photo && (!slide.layout || slide.layout === "auto") && Array.isArray(slide.points) && slide.points.length >= 2 && slide.points.length <= 6 && slide.points.every((pt) => pt && typeof pt === "object" && pt.lead && pt.text && !pt.icon && pt.state == null)) {
    slide = { ...slide, points: undefined, exhibit: { type: "rows", rows: slide.points.map((pt, i) => ({ label: pt.lead, text: pt.text, number: pt.number ?? i + 1 })) } };
  }
  const layout = chooseLayout(slide);
  const exhibits = slide.exhibits || (slide.exhibit ? [slide.exhibit] : []);
  const items = [];
  const metricsBelow = slide.metricsPosition === "bottom";
  if (Array.isArray(slide.metrics) && slide.metrics.length && !metricsBelow) items.push(metricsStrip(slide.metrics, `${id}-metrics`, slide.metricsTone));
  if (tileColumn) {
    const tiles = { id: `${id}-tiles`, layout: "flow.column", size: { width: { fr: 1 }, height: "fill" }, items: tileColumn.map((m, i) => ({ id: `${id}-tile-${i}`, component: "metric", props: { ...m, variant: "prominent" }, size: { width: { fr: 1 }, height: "fill" } })) };
    const side = { id: `${id}-side`, heading: slide.pointsHeading || "What it means", treatment: sideTreatment(slide), size: { width: { fr: 1 }, height: "fill" }, items: [pointsItem(tilePoints, `${id}-points`, sideTreatment(slide), fill, true)] };
    // The tile column reads as the evidence, so the same implication marker joins it to the meaning.
    const tileChevron = (slide.implication ?? true) && tilePoints.length ? { id: `${id}-implication`, component: "connector", props: { variant: "divider-chevron" }, size: { width: 44, height: "fill" } } : null;
    items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: tilePoints.length ? [tiles, tileChevron, side].filter(Boolean) : [tiles] });
  }
  // A full-width table needs no heading of its own: the action title and the
  // header row already say what it is. Heading bands exist for the row rule only.
  const centredCards = (ex) => ex.type === "cards" && ex.tone !== "header" && ex.tone !== "numbered" && (ex.items || []).every((i) => i.icon && !(i.points || []).length);
  if (layout === "exhibit-full" && centredCards(exhibits[0])) {
    // Icon cards with a line each hug their content and sit centred in the
    // space above the takeaway; header and numbered cards fill the page as columns.
    items.push(exhibitItem(exhibits[0], `${id}-exhibit`, baseDir, { ...SIZE, centre: true }));
  } else if (layout === "exhibit-full") {
    const item = exhibitItem(exhibits[0], `${id}-exhibit`, baseDir);
    if (String(exhibits[0].type).startsWith("chart.") && item.props?.unit && !item.props.unitPlacement) item.props.unitPlacement = "inline";
    items.push(item);
  }
  else if (layout === "exhibit-left" || layout === "exhibit-right") {
    // Side ratios: chart + points 2:1, table + points 3:2 — a starting point,
    // not a constant. The column is then measured against what it holds (below).
    const heroFr = exhibits[0].type === "table" || exhibits[0].type === "rows" || exhibits[0].type === "compare" ? 3 : 2;
    const baseSideFr = heroFr === 3 ? 2 : 1;
    // A chart beside a text column keeps a one-line heading with the unit
    // inline; the two-line heading is for peers in a row, where the bands align.
    const heroItem = exhibitItem(exhibits[0], `${id}-exhibit`, baseDir, { width: { fr: heroFr }, height: "fill" });
    if (String(exhibits[0].type).startsWith("chart.") && heroItem.props?.unit && !heroItem.props.unitPlacement) heroItem.props.unitPlacement = "inline";
    // The side column is a headed section so its rule shares the chart heading's
    // band and the points start level with the plot, not with the heading text.
    // `pointsAlign: "middle"` centres the points on the exhibit instead.
    const tone = sideTreatment(slide);
    const list = slide.points?.length ? pointsItem(slide.points, `${id}-points`, tone, fill, true) : null;
    // `kpi: { value, label }`: the one big number the chart proves, in the accent
    // at the top of the side column, above the points.
    const kpiTile = slide.kpi ? { id: `${id}-kpi`, component: "metric", props: { value: slide.kpi.value, label: slide.kpi.label, ...(slide.kpi.sublabel ? { sublabel: slide.kpi.sublabel } : {}), tone: "hero", variant: "prominent" }, size: { width: { fr: 1 }, height: 110 } } : null;
    // `insight`: the so-what as a tonal box in the side column, centred on the
    // exhibit when it stands alone, above the points when there are some. The
    // column then carries no heading unless `pointsHeading` names one.
    // `insights: [a, b]` is the reference pattern of flanking an exhibit with two
    // statements that carry the numbers in words; `insight` is the single box.
    const insightSpecs = (Array.isArray(slide.insights) ? slide.insights : slide.insight !== undefined ? [slide.insight] : []).filter((entry) => entry !== undefined && entry !== null);
    if (insightSpecs.length > 2) throw new Error(`${id}: a side column carries at most two insights`);
    // Two statements are a reading, then its consequence: the first set plain in
    // the column and the second in the box under it. Two equal boxes make the
    // column read as two unrelated labels with a gap between them.
    const insightBoxes = insightSpecs.map((entry, at) => {
      const variant = insightSpecs.length > 1 && at === 0 ? "plain" : "tonal";
      return { id: insightSpecs.length > 1 ? `${id}-insight-${at + 1}` : `${id}-insight`, component: "insight",
        props: typeof entry === "string" ? { text: entry, variant } : { variant, ...entry }, size: HUG };
    });
    const insightBox = insightBoxes[0] ?? null;
    if (!list && !insightBox && !kpiTile) throw new Error(`${id}: a side column needs points, an insight or a kpi`);
    const sideItems = [kpiTile, ...insightBoxes, list].filter(Boolean);
    // "What it means" above three lines of text is a label on a mostly empty
    // column. The heading earns its line when the column holds a list; a column
    // that is one number or one box takes the blank band and keeps the rule.
    const heading = slide.pointsHeading === false || (insightBox && !slide.pointsHeading) || (!list && !slide.pointsHeading) ? null : slide.pointsHeading || "What it means";
    // The hero's blank heading band exists to line its content up with the
    // column's heading. With no heading beside it the band is an empty rule, so
    // the exhibit starts at the top of the body instead.
    const hero = headedPanel(exhibits[0], heroItem, `${id}-exhibit`, Boolean(heading));
    // The column's width is negotiated with its content, not fixed by the
    // layout: forty words in a 361px track leave two fifths of the column
    // empty, and the exhibit beside it wanted that width anyway. A short column
    // narrows (its text then wraps to more lines, and the hero grows); a column
    // that would overrun widens.
    const sideFr = (() => {
      if (fill === "airy" || !list) return baseSideFr;
      const columns = heroFr + baseSideFr + (slide.photo ? 1 : 0);
      const track = (fr) => Math.max(140, (BODY_WIDTH - CONNECTOR_WIDTH - COLUMN_GAP * columns) * (fr / (heroFr + fr + (slide.photo ? 1 : 0))));
      const extras = (kpiTile ? 126 : 0) + insightBoxes.length * 104 + (heading ? 44 : 0);
      const natural = extras + pointsHeight(slide.points, track(baseSideFr));
      // A photograph strip takes a quarter of the row, which leaves the
      // commentary a 267px gutter that nothing reads comfortably. The column
      // keeps a floor of 300px; the photograph gives up the width.
      if (slide.photo && track(baseSideFr) < 300) return baseSideFr * 1.25;
      if (natural < BODY_HEIGHT * 0.45) return baseSideFr * 0.8;
      if (natural > BODY_HEIGHT * 0.98) return baseSideFr * 1.2;
      return baseSideFr;
    })();
    // A column of statements and nothing else - one box, or a statement above a
    // box - is read against the exhibit beside it, so it centres on the exhibit
    // rather than hugging the top of the track. Anything with a list in it has
    // something that can spread instead. `pointsAlign` overrides either way.
    const boxesOnly = sideItems.length > 0 && sideItems.every((item) => insightBoxes.includes(item));
    const centre = slide.pointsAlign === "middle" || (slide.pointsAlign === undefined && fill !== "full" && (boxesOnly || sideItems.length <= 1) && (unheaded(exhibits[0]) || (insightBox && !list) || (tone !== "open" && !heading)));
    // A toned panel is always a section (it needs a surface); it takes the
    // heading unless the author suppresses it with `pointsHeading: false`.
    // A column of several blocks (a number, a box, the points) spreads them down
    // the track rather than stacking them under the heading with the bottom
    // third left over.
    // Spreading blocks down the track works when one of them can absorb the
    // slack (a points list, which spreads its own items). Statements alone have
    // nothing to absorb it, so distributing would pin them to opposite ends of
    // an empty track; they sit together, centred, instead.
    const spread = !centre && fill !== "airy" && sideItems.length > 1 && !boxesOnly ? "distribute" : null;
    const side = tone === "open" && centre && !heading
      ? { id: `${id}-side`, layout: "flow.column", size: { width: { fr: sideFr }, height: "fill" }, leftover: "center", items: sideItems }
      : { id: `${id}-side`, ...(heading ? { heading } : {}), treatment: tone, layout: "flow.column", ...(centre ? { leftover: "center" } : spread ? { leftover: spread } : {}), size: { width: { fr: sideFr }, height: "fill" }, items: sideItems };
    // `implication`: the chevron disc between the exhibit and its consequences,
    // the way the firm pages join evidence to implication. On by default for a
    // headed open column beside an exhibit; `implication: false` removes it,
    // `implication: true` adds it to a toned or unheaded column.
    // A column that runs the body's full height — a toned box, or an open column
    // headed by a title, or a page with a photo strip — takes the dashed divider
    // with the disc centred on it. A short centred column (an insight box, two
    // lines) needs no divider: the disc alone joins the evidence to its meaning.
    const fullBleed = Boolean(heading) || tone !== "open" || Boolean(slide.photo);
    const implication = slide.implication ?? true;
    const chevron = implication ? { id: `${id}-implication`, component: "connector", props: { variant: fullBleed ? "divider-chevron" : "disc-chevron" }, size: { width: fullBleed ? 44 : 40, height: "fill" } } : null;
    // `photo`: a photograph strip at the right edge, full body height, cropped
    // to fit (the 2022 McKinsey pattern: chart, commentary, photo).
    const photo = photoStrip(slide, `${id}-photo`, baseDir);
    const ordered = layout === "exhibit-left" ? [hero, chevron, side] : [side, chevron, hero];
    items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: [...ordered.filter(Boolean), ...(photo ? [photo] : [])] });
  } else if (layout === "stack") {
    // Exhibits stacked in the hero column, points beside them.
    // A value table under a chart hugs its rows and carries no heading band.
    const stackItem = (ex, i) => {
      const hug = Boolean(slide.stackWeights) && ex.type === "table";
      const item = { ...exhibitItem(ex, `${id}-exhibit-${i}`, baseDir, hug ? HUG : SIZE), size: hug ? HUG : SIZE };
      return hug ? item : headedPanel(ex, item, `${id}-exhibit-${i}`);
    };
    const stacked = { id: `${id}-stack`, layout: "flow.column", size: { width: { fr: 2 }, height: "fill" }, items: exhibits.map(stackItem) };
    if (slide.points?.length) {
      const side = { id: `${id}-side`, heading: slide.pointsHeading || "What it means", treatment: sideTreatment(slide), size: { width: { fr: 1 }, height: "fill" }, items: [pointsItem(slide.points, `${id}-points`, sideTreatment(slide), fill, true)] };
      items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: [stacked, side] });
    } else items.push({ ...stacked, size: SIZE });
  } else if (layout === "grid") {
    // Two rows of two small exhibits, every panel headed.
    const panels = exhibits.slice(0, 4).map((ex, i) => headedPanel(ex, { ...exhibitItem(ex, `${id}-exhibit-${i}`, baseDir), size: SIZE }, `${id}-exhibit-${i}`));
    items.push({ id: `${id}-grid`, layout: "flow.column", size: SIZE, items: [{ id: `${id}-row-a`, layout: "flow.row", size: SIZE, items: panels.slice(0, 2) }, { id: `${id}-row-b`, layout: "flow.row", size: SIZE, items: panels.slice(2, 4) }] });
    if (slide.points?.length) items.push(pointsItem(slide.points, `${id}-points`));
  } else if (layout === "two-up") {
    // Peer tables share one density: a row with a text-heavy table steps every
    // table in it to compact together, so type stays uniform across the row.
    const tables = exhibits.filter((ex) => ex.type === "table");
    if (tables.length >= 2) {
      if (tables.some(heavyTable)) for (const ex of tables) ex.density = ex.density || "compact";
      // An explicit two-up keeps both tables on the page, so they share one
      // design: when their inferred treatments differ, both fall back to the
      // open listing rather than mixing a filled tracker with plain rules.
      if (new Set(tables.map(tableSignature)).size > 1) for (const ex of tables) { ex.variant = "plain"; ex.treatment = "open"; }
    }
    // Peer charts with one unit share one value scale, or the comparison lies.
    const charts = exhibits.filter((ex) => String(ex.type).startsWith("chart.") && Array.isArray(ex.series));
    if (charts.length >= 2 && charts.every((ex) => ex.unit === charts[0].unit && ex.yMax === undefined)) {
      // A stack reaches its total, not its tallest segment: scaling a pair of
      // 100% stacks to their largest segment puts the plot below the data.
      const reach = (ex) => (["chart.stacked-column", "chart.stacked-bar"].includes(ex.type)
        ? Math.max(...(ex.categories || []).map((_, i) => ex.series.reduce((sum, se) => sum + (se.values[i] || 0), 0)))
        : Math.max(...ex.series.flatMap((se) => se.values)));
      const max = Math.max(...charts.map(reach));
      const shared = niceCeiling(max);
      for (const ex of charts) { ex.yMin = ex.yMin ?? 0; ex.yMax = shared; }
    }
    // One scale needs one plot frame: peers share the row's tallest top band
    // (legend, growth arrows, callouts), and when one peer must be drawn as
    // shapes (annotations), all of them are, so their baselines coincide.
    if (charts.length >= 2) {
      const decorated = (ex) => (ex.referenceLines || []).length || (ex.annotations || []).length || (ex.changeAnnotations || []).length || (ex.highlights || []).some((h) => h?.style !== "bar");
      const topBand = (ex) => {
        const line = ex.type === "chart.line" || ex.type === "chart.area", multi = (ex.series || []).length > 1;
        const legend = ex.legend === true || (ex.legend !== false && multi && !line);
        // The legend may wrap; the row's inset must cover the tallest one (1160px row, n panels).
        const rows = legend ? legendRowCount((ex.series || []).map((sr) => sr.name), Math.max(120, 1160 / Math.max(1, charts.length) - 70)) : 0;
        return (rows ? 52 + (rows - 1) * 26 : 28) + chartAnnotationBands({ changeAnnotations: ex.changeAnnotations || [] }).top + evidenceAnnotationTopBandCount({ annotations: ex.annotations || [] }) * EVIDENCE_CALLOUT_BAND;
      };
      const inset = Math.max(...charts.map(topBand));
      for (const ex of charts) { ex.plotTopInset = inset; if (charts.some(decorated)) ex.native = false; }
    }
    // Chart beside a narrow table (three columns or fewer): the chart takes 3:2.
    const panelSize = (ex) => {
      if (slide.pairedWeights) return { width: { fr: slide.pairedWeights[exhibits.indexOf(ex)] }, height: "fill" };
      if (exhibits.length !== 2) return SIZE;
      const other = exhibits.find((o) => o !== ex);
      const narrow = (t) => t?.type === "table" && (t.columns || []).length <= 3;
      if (String(ex.type).startsWith("chart.") && narrow(other)) return { width: { fr: 3 }, height: "fill" };
      if (narrow(ex) && String(other?.type).startsWith("chart.")) return { width: { fr: 2 }, height: "fill" };
      return SIZE;
    };
    items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: exhibits.slice(0, 4).map((ex, i) => headedPanel(ex, { ...exhibitItem(ex, `${id}-exhibit-${i}`, baseDir), size: panelSize(ex) }, `${id}-exhibit-${i}`)) });
    if (slide.points?.length) items.push(pointsItem(slide.points, `${id}-points`));
  } else if (slide.photo && (slide.points?.length || slide.paragraphs?.length)) {
    // Text beside a photograph: the copy takes the left column (a toned panel
    // when `pointsTone` says so), the photo the right, both full height.
    const tone = sideTreatment(slide);
    const copy = [...(slide.paragraphs || []).map((p, i) => ({ id: `${id}-p${i}`, component: "paragraph", props: { text: p }, size: HUG })), ...(slide.points?.length ? [pointsItem(slide.points, `${id}-points`, tone, fill, true)] : [])];
    const column = { id: `${id}-side`, ...(slide.pointsHeading ? { heading: slide.pointsHeading } : {}), treatment: tone, layout: "flow.column", ...(slide.pointsAlign === "middle" ? { leftover: "center" } : {}), size: { width: { fr: 1.2 }, height: "fill" }, items: copy };
    items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: [column, photoStrip(slide, `${id}-photo`, baseDir, 1)] });
  } else {
    const points = slide.points || [];
    if (points.length > 4) {
      const half = Math.ceil(points.length / 2);
      items.push({ id: `${id}-row`, layout: "flow.row", size: HUG, items: [pointsItem(points.slice(0, half), `${id}-points-a`), pointsItem(points.slice(half), `${id}-points-b`)] });
    } else if (points.length) items.push(pointsItem(points, `${id}-points`));
    for (const [i, p] of (slide.paragraphs || []).entries()) items.push({ id: `${id}-p${i}`, component: "paragraph", props: { text: p }, size: HUG });
  }
  // A reading note sits at the top of the side column when there is one,
  // otherwise as a full-width band above the content.
  if (Array.isArray(slide.metrics) && slide.metrics.length && metricsBelow) items.push(metricsStrip(slide.metrics, `${id}-metrics`, slide.metricsTone));
  if (slide.callout) {
    const note = { id: `${id}-callout`, component: "callout", props: typeof slide.callout === "string" ? { text: slide.callout } : slide.callout, size: HUG };
    const row = items.find((it) => it.id === `${id}-row`);
    const at = row?.items?.findIndex((it) => it.id === `${id}-side`) ?? -1;
    if (at >= 0) row.items[at] = { id: `${id}-side-column`, layout: "flow.column", size: row.items[at].size, items: [note, { ...row.items[at], size: { width: { fr: 1 }, height: "fill" } }] };
    else items.push(note); // full-width pages: the reading aid sits under the exhibit, above the takeaway
  }
  if (slide.soWhat) items.push(soWhatItem(slide.soWhat, `${id}-sowhat`));
  if (!items.length) throw new Error(`${id}: a slide needs an exhibit, points, paragraphs or a soWhat`);
  // Footer: "Source:" and "Note:" lead their lines, as on a consulting page.
  const prefixed = (label, text) => (text && !/^(source|sources|note|notes)\s*:/i.test(text) ? `${label}: ${text}` : text);
  // `note` takes a list as well as a line: the reference pages carry two to four
  // numbered notes under the page, and a numbered note is what a superscript in
  // a label or a heading ("Revenue¹") points at.
  const noteLine = Array.isArray(slide.note)
    ? (slide.note.length ? `Notes: ${slide.note.map((item, index) => `${index + 1}. ${String(item).trim().replace(/^\d+\.\s*/, "")}`).join("   ")}` : null)
    : prefixed("Note", slide.note);
  return { id, title: slide.title, layout: "flow.column", ...(slide.titleLead ? { titleLead: slide.titleLead } : {}), ...(slide.tag ? { tag: slide.tag } : {}), ...(slide.kicker ? { kicker: slide.kicker } : {}), ...(slide.density ? { density: slide.density } : {}), ...(slide.source ? { source: prefixed("Source", slide.source) } : {}), ...(noteLine ? { note: noteLine } : {}), ...(slide.notes ? { notes: slide.notes } : {}), ...(slide.tracker ? { tracker: slide.tracker } : {}), items };
}

/**
 * `agenda: true` numbers the section dividers, inserts a Contents page before
 * the first section and repeats it (with the coming section highlighted) in
 * front of every later section: the classic tracker. `agenda: "once"` inserts
 * only the Contents page.
 */
/**
 * `sectionTabs: true` on the deck: every analytical page under a section
 * carries the section pill tabs above its title, the current section filled.
 * A deck with sections gets them by default — a reader who cannot tell which
 * section they are in is reading a pile of pages — and `sectionTabs: false`
 * takes them off (use `agenda` instead, which tracks by repeating the contents).
 */
export function sectionTabs(slidesIn) {
  const sections = slidesIn.filter((s) => s.kind === "section");
  if (sections.length < 2) return slidesIn;
  const items = sections.map((s, i) => ({ id: String(i + 1), label: s.title }));
  let current = 0;
  return slidesIn.map((slide) => {
    if (slide.kind === "section") { current = sections.indexOf(slide) + 1; return slide; }
    if (slide.kind || !current || slide.tracker) return slide;
    return { ...slide, tracker: { trackerId: "deck-sections", items, selectedId: String(current), construction: "compact-pills" } };
  });
}

export function agendaPages(slidesIn, agenda, agendaStyle) {
  const sections = slidesIn.filter((s) => s.kind === "section");
  if (!agenda || sections.length < 2) return slidesIn;
  const numbered = new Map(sections.map((s, i) => [s, s.number ?? i + 1]));
  const items = sections.map((s) => ({ label: s.title, ...(s.summary ? { detail: s.summary } : {}) }));
  const out = [];
  let seen = 0;
  for (const slide of slidesIn) {
    if (slide.kind === "section") {
      if (seen === 0 || agenda !== "once") out.push({ kind: "agenda", id: `agenda-${seen + 1}`, title: seen === 0 ? "Contents" : "Agenda", items, active: seen, ...(agendaStyle ? { style: agendaStyle } : {}) });
      out.push({ ...slide, number: numbered.get(slide) });
      seen += 1;
    } else out.push(slide);
  }
  return out;
}

/** Expand a v3 deck into the deckPlan the planner consumes. */
export function composeDeck(spec, baseDir = process.cwd()) {
  if (!isV3(spec)) throw new Error(`Expected schema ${V3}`);
  if (!spec.id || !Array.isArray(spec.slides)) throw new Error("deck/v3 requires id and slides");
  const slides = [];
  if (spec.cover) {
    const cover = { id: "cover", kind: "cover", title: spec.cover.title, subtitle: spec.cover.subtitle || "" };
    if (spec.cover.date) cover.date = spec.cover.date;
    if (spec.cover.logo || spec.logo) cover.logo = spec.cover.logo || spec.logo;
    // `image` with `layout: "full"` puts the title on a card over a full-bleed
    // photograph; otherwise the photo takes the right half and `tone: "dark"`
    // paints the title half navy (the McKinsey/BCG 2020 cover).
    if (spec.cover.image) { cover.variant = spec.cover.layout === "full" ? "full-image" : "half-image"; cover.image = imageProps(spec.cover.image, baseDir); if (spec.cover.tone) cover.tone = spec.cover.tone; }
    else cover.variant = spec.cover.tone === "light" ? "plain" : "dark";
    if (spec.cover.notes) cover.notes = spec.cover.notes;
    slides.push(cover);
  }
  // The tracker is on by default once a deck has sections: pills above the title
  // unless the deck tracks by repeating its contents page (`agenda`).
  const tabs = spec.sectionTabs ?? (!spec.agenda && spec.slides.filter((s) => s.kind === "section").length >= 2);
  const pages = agendaPages(tabs ? sectionTabs(spec.slides) : spec.slides, spec.agenda, spec.agendaStyle);
  const bodyScale = spec.chrome ? Math.max(0.4, Math.min(1.2, ((spec.chrome.footerTop ?? 684) - 36 - (spec.chrome.bodyTop ?? 140)) / 508)) : 1;
  const fill = resolveFill(spec);
  // The weight contract: what a page of this deck is expected to carry. The
  // deck's own `weight` wins, then the house profile a template produced, then
  // the fill level.
  const weight = resolveWeight(spec, fill);
  for (const page of pages.flatMap(splitTables).flatMap((p) => paginateTable(p, bodyScale))) slides.push(composeSlide(page, slides.length, baseDir, fill, weight.elements));
  return {
    id: spec.id,
    palette: spec.palette || "mckinsey",
    ...(spec.pageTemplate ? { pageTemplate: spec.pageTemplate } : {}),
    ...(spec.typography ? { typography: spec.typography } : {}),
    ...(spec.chrome ? { chrome: spec.chrome } : {}),
    fill,
    weight,
    slides: slides.map((s) => {
      const page = spec.density && !s.density && s.kind !== "cover" ? { ...s, density: spec.density } : { ...s };
      // The document title sits in the footer beside the page number.
      if (spec.footer && s.kind !== "cover" && page.companyName === undefined) page.companyName = spec.footer;
      return page;
    })
  };
}

/**
 * Coverage (revamp item 30): when the spec lists the brief's ranked `criteria`,
 * every criterion must be served by at least one page that carries an exhibit
 * (`serves: ["education", …]` on the slide). Returns findings; empty when covered.
 */
export function coverageFindings(spec) {
  if (!isV3(spec) || !Array.isArray(spec.criteria) || !spec.criteria.length) return [];
  const served = new Map(spec.criteria.map((c) => [String(c).toLowerCase(), []]));
  spec.slides.forEach((slide, i) => {
    const hasExhibit = Boolean(slide.exhibit || (slide.exhibits || []).length);
    for (const c of slide.serves || []) if (served.has(String(c).toLowerCase()) && hasExhibit) served.get(String(c).toLowerCase()).push(i + 1);
  });
  return [...served.entries()].filter(([, pages]) => !pages.length).map(([criterion]) => ({ slide: null, code: "MISSING_EVIDENCE", measured: criterion, threshold: "one comparative exhibit", repair: `Add a page whose exhibit compares every option on "${criterion}", and mark it serves: ["${criterion}"].` }));
}

/** Accept v2 (deckPlan) or v3 (deck) and return a deckPlan. */
/**
 * `template: "house.json"` applies a house profile written by
 * runtime/import-template.py from a template deck: its palette overlay,
 * typography, chrome margins, page template and density become the deck's
 * defaults; anything the spec sets explicitly still wins.
 */
export function applyTemplate(spec, baseDir = process.cwd()) {
  if (!spec?.template) return spec;
  const file = path.resolve(baseDir, spec.template);
  if (!file.endsWith(".json")) throw new Error("template must name a house profile .json (run runtime/import-template.py on the .pptx first)");
  const house = JSON.parse(fs.readFileSync(file, "utf8"));
  if (house.schema !== "professional-slides.house/v1") throw new Error("template must be a professional-slides.house/v1 profile");
  const out = { ...spec };
  delete out.template;
  if (!spec.palette && house.palette) out.palette = house.palette;
  if (!spec.typography && house.typography) out.typography = house.typography;
  if (!spec.chrome && house.chrome) out.chrome = house.chrome;
  if (!spec.pageTemplate && house.pageTemplate) out.pageTemplate = house.pageTemplate;
  if (!spec.density && house.density) out.density = house.density;
  if (!spec.footer && house.footer) out.footer = house.footer;
  // A template deck also sets how full its pages read: the importer measures the
  // template's own words, elements and body coverage and writes them as `fill`
  // and `weight`, so a deck built on a dense house is judged by that house.
  if (!spec.fill && house.fill) out.fill = house.fill;
  if (!spec.weight && house.weight) out.weight = normalizeWeight(house.weight, "template weight");
  return out;
}

export function toDeckPlan(specIn, baseDir) {
  const spec = applyTemplate(specIn, baseDir);
  if (isV3(spec)) return composeDeck(spec, baseDir);
  if (spec?.deckPlan) return spec.deckPlan;
  throw new Error("Spec must be professional-slides.deck/v3 or carry a deckPlan");
}
