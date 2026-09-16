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
    return { type: "table", treatment: "standard", variant: "standard", highlightColumn: 1, columns: [{ label: left.heading || "Before", type: "text" }, { label: right.heading || "After", type: "text" }], rows, density: ex.density };
  }
  if (ex.type === "phase-table") {
    const phases = ex.phases || ex.columns || [];
    const rows = (ex.rows || []).map((row) => [{ type: "category", text: row.label }, ...phases.map((_, i) => { const cell = (row.cells || [])[i]; return Array.isArray(cell) ? { type: "bullets", items: cell } : cell ?? " "; })]);
    const labelWidth = Math.max(110, ...(ex.rows || []).map((row) => Math.ceil(measureText(String(row.label || ""), 400, { fontFamily: "Arial", fontSize: 14, bold: true, wrapWidthRatio: 1 }).width) + 32));
    return { type: "table", treatment: "dimensions", variant: "standard", headerShape: "chevron", columns: [{ label: "", type: "category", width: labelWidth }, ...phases.map((ph) => ({ label: typeof ph === "string" ? ph : ph.label, type: "text", width: 200 }))], rows, density: ex.density };
  }
  if (ex.type === "rows") {
    const rows = (ex.rows || []).map((row) => [{ type: "category", text: row.label, ...(row.number ? { sectionNumber: row.number } : {}), ...(row.icon ? { icon: row.icon } : {}) }, Array.isArray(row.points) ? { type: "bullets", items: row.points } : row.text]);
    return { type: "table", treatment: "categories", variant: "standard", columns: [{ label: "", type: "category", width: 200 }, { label: "", type: "text", width: 800 }], rows, density: ex.density };
  }
  return ex;
}

function exhibitItem(exIn, id, baseDir, size = SIZE) {
  const ex = tableAlias(exIn);
  const { type, layout: _l, ...rest } = ex;
  if (type === "image") return { id, component: "image-frame", props: imageProps(ex.path ? ex : ex.image, baseDir), size };
  if (type === "cards" || type === "quadrants") { const { centre, ...sz } = size; return { id, component: type, props: { ...rest, ...(centre ? { valign: "middle" } : {}) }, size: sz }; }
  if (type === "swot") return { id, component: "quadrants", props: { quadrants: ["Strengths", "Weaknesses", "Opportunities", "Threats"].map((title, i) => ({ title, points: [rest.strengths, rest.weaknesses, rest.opportunities, rest.threats][i] || [] })) }, size };
  if (type === "table") {
    const styled = styleTable(rest);
    return { id, component: "table", props: { ...styled, density: rest.density || "body", fillHeight: size.height === "fill", ...(rest.rowSpacing ? { rowSpacing: rest.rowSpacing } : {}), ...(rest.headerShape ? { headerShape: rest.headerShape } : {}) }, size };
  }
  if (type === "metrics") return { id, layout: "flow.row", size: HUG, items: rest.items.map((m, i) => ({ id: `${id}-${i}`, component: "metric", props: m, size: { width: { fr: 1 }, height: 140 } })) };
  if (type.startsWith("chart.")) {
    const multi = Array.isArray(rest.series) && rest.series.length > 1;
    // Lines carry their series name at the end of the line instead of a legend,
    // and no per-point labels when there is more than one series.
    const line = type === "chart.line" || type === "chart.area";
    const props = { dataLabels: !(line && multi), legend: multi && !line, ...(line && multi ? { endLabels: true } : {}), highlights: [], annotations: [], referenceLines: [], ...rest };
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
function headedPanel(ex, item, id) {
  if (unheaded(ex)) return item;
  if (String(ex.type).startsWith("chart.")) {
    if (ex.panelHeading && !ex.heading) item.props.heading = ex.panelHeading;
    return item;
  }
  const heading = ex.panelHeading || ex.heading || (ex.columns ? String(typeof ex.columns[0] === "string" ? ex.columns[0] : ex.columns[0]?.label || "") : "") || "Detail";
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
  return value;
}
const columnLabel = (c) => (typeof c === "string" ? c : c?.label || "");

export function styleTable(ex) {
  const columns = ex.columns.map((c, i) => typeof c === "string" ? { label: c, type: "text", bold: i === 0, width: columnWeight(ex, i) } : { ...c });
  const rowsIn = ex.rows.map((r) => Array.isArray(r) ? r.map((cell, i) => verdictCell(cell, columnLabel(ex.columns[i]))) : r);
  // The recommended option's column is tinted end to end.
  const recommended = ex.recommended !== undefined ? columns.findIndex((c) => String(c.label).trim().toLowerCase() === String(ex.recommended).trim().toLowerCase()) : -1;
  if (ex.recommended !== undefined && recommended < 0) throw new Error(`Table recommended column "${ex.recommended}" is not a column label`);
  const extra = recommended >= 0 ? { highlightColumn: recommended } : Number.isInteger(ex.highlightColumn) ? { highlightColumn: ex.highlightColumn } : {};
  // A "Total …" row at the end is the accent total band.
  rowsIn.forEach((r, i) => {
    if (Array.isArray(r) && i === rowsIn.length - 1 && /^total\b/i.test(String(r[0]?.text ?? r[0] ?? ""))) rowsIn[i] = { style: "total", cells: r };
  });
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

const heavyTable = (ex) => (ex.rows || []).length > 5 || (ex.rows || []).some((row) => row.some((cell) => String(cell?.text ?? cell ?? "").length > 60));
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
export function paginateTable(slide) {
  if (slide.layout && slide.layout !== "auto") return [slide];
  const ex = slide.exhibit;
  if (!ex || ex.type !== "table" || !Array.isArray(ex.rows) || ex.rows.length <= MAX_ROWS || slide.exhibits) return [slide];
  const pages = Math.ceil(ex.rows.length / MAX_ROWS), per = Math.ceil(ex.rows.length / pages);
  return Array.from({ length: pages }, (_, i) => {
    const page = { ...slide, exhibit: { ...ex, rows: ex.rows.slice(i * per, (i + 1) * per) }, title: `${slide.title} (${i + 1}/${pages})` };
    if (slide.id) page.id = `${slide.id}-${i + 1}`;
    if (i !== 0) delete page.points;
    return page;
  });
}

function niceCeiling(value) {
  if (!(value > 0)) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  for (const rung of [1, 2, 2.5, 5, 10]) if (rung * magnitude >= value) return rung * magnitude;
  return 10 * magnitude;
}

/** A KPI strip: equal tiles in a row, hugging one tile height. */
function metricsStrip(metrics, id) {
  const tiles = metrics.map((m) => (typeof m === "string" ? { value: m } : m));
  return { id, layout: "flow.row", size: { width: { fr: 1 }, height: 104 }, items: tiles.map((m, i) => ({ id: `${id}-${i}`, component: "metric", props: m, size: { width: { fr: 1 }, height: "fill" } })) };
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

function pointsItem(points, id) {
  return { id, component: "bullet-list", props: { variant: "body", items: points }, size: HUG };
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
  if (exhibits.length === 1) return slide.points?.length ? "exhibit-left" : "exhibit-full";
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
  const hits = (ex.categories || []).filter((c) => String(c).length >= 3 && new RegExp(`(^|[^a-z0-9])${String(c).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`).test(t)).sort((a, b) => t.indexOf(String(a).toLowerCase()) - t.indexOf(String(b).toLowerCase()));
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
  if ((series.length === 1 || stacked) && (explicit || ex.change === true || (periodic && ex.type !== "chart.bar"))) {
    const from = explicit?.from ?? categories[0], to = explicit?.to ?? categories[categories.length - 1];
    const a = categories.indexOf(from), b = categories.indexOf(to);
    if (a < 0 || b <= a) throw new Error("change.from and change.to must name two categories in order");
    const text = explicit?.text || delta(totals[a], totals[b]);
    // Columns take the diagonal arrow across the tops; a line takes its change
    // beside its last point, where the eye already lands.
    const style = ex.type === "chart.line" || ex.type === "chart.area" ? "end-bubble" : "arrow";
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

export function composeSlide(slide, index, baseDir) {
  const id = slide.id || `s${String(index + 1).padStart(2, "0")}`;
  if (slide.exhibit) slide = { ...slide, exhibit: changeFromContent(highlightFromTitle(slide.exhibit, slide.title), slide.title) };
  if (slide.exhibits) slide = { ...slide, exhibits: slide.exhibits.map((ex) => changeFromContent(highlightFromTitle(ex, slide.title), slide.title)) };
  if (slide.kind === "section") return { id, kind: "divider", title: slide.title, ...(slide.summary ? { subtitle: slide.summary } : {}), ...(slide.number !== undefined ? { number: slide.number } : {}), ...(slide.notes ? { notes: slide.notes } : {}) };
  if (slide.kind === "agenda") return { id, title: slide.title || "Contents", layout: "flow.column", items: [{ id: `${id}-agenda`, component: "agenda", props: { items: slide.items, ...(slide.active !== undefined ? { active: slide.active } : {}) }, size: SIZE }] };
  const slideIn = slide;
  // A value table under the chart: the chart stacks over a compact table whose
  // columns are the chart's categories.
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
  if (slide.rows && !slide.exhibit && !slide.exhibits) slide = { ...slide, exhibit: { type: "rows", rows: slide.rows } };
  // A text page whose points carry leads is a numbered ledger: label + text
  // rows with rules, filling the page, rather than a list floating at the top.
  if (!slide.exhibit && !slide.exhibits && !slide.rows && (!slide.layout || slide.layout === "auto") && Array.isArray(slide.points) && slide.points.length >= 2 && slide.points.length <= 6 && slide.points.every((pt) => pt && typeof pt === "object" && pt.lead && pt.text && !pt.icon && pt.state == null)) {
    slide = { ...slide, points: undefined, exhibit: { type: "rows", rows: slide.points.map((pt, i) => ({ label: pt.lead, text: pt.text, number: pt.number ?? i + 1 })) } };
  }
  const layout = chooseLayout(slide);
  const exhibits = slide.exhibits || (slide.exhibit ? [slide.exhibit] : []);
  const items = [];
  const metricsBelow = slide.metricsPosition === "bottom";
  if (Array.isArray(slide.metrics) && slide.metrics.length && !metricsBelow) items.push(metricsStrip(slide.metrics, `${id}-metrics`));
  if (tileColumn) {
    const tiles = { id: `${id}-tiles`, layout: "flow.column", size: { width: { fr: 1 }, height: "fill" }, items: tileColumn.map((m, i) => ({ id: `${id}-tile-${i}`, component: "metric", props: { ...m, variant: "prominent" }, size: { width: { fr: 1 }, height: "fill" } })) };
    const side = { id: `${id}-side`, heading: slide.pointsHeading || "What it means", treatment: "open", size: { width: { fr: 1 }, height: "fill" }, items: [pointsItem(tilePoints, `${id}-points`)] };
    items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: tilePoints.length ? [tiles, side] : [tiles] });
  }
  // A full-width table needs no heading of its own: the action title and the
  // header row already say what it is. Heading bands exist for the row rule only.
  const centredCards = (ex) => ex.type === "cards" && ex.tone !== "header" && ex.tone !== "numbered" && (ex.items || []).every((i) => i.icon && !(i.points || []).length);
  if (layout === "exhibit-full" && centredCards(exhibits[0])) {
    // Icon cards with a line each hug their content and sit centred in the
    // space above the takeaway; header and numbered cards fill the page as columns.
    items.push(exhibitItem(exhibits[0], `${id}-exhibit`, baseDir, { ...SIZE, centre: true }));
  } else if (layout === "exhibit-full") items.push(exhibitItem(exhibits[0], `${id}-exhibit`, baseDir));
  else if (layout === "exhibit-left" || layout === "exhibit-right") {
    // Side ratios: chart + points 2:1, table + points 3:2.
    const heroFr = exhibits[0].type === "table" || exhibits[0].type === "rows" || exhibits[0].type === "compare" ? 3 : 2;
    const sideFr = heroFr === 3 ? 2 : 1;
    const hero = headedPanel(exhibits[0], exhibitItem(exhibits[0], `${id}-exhibit`, baseDir, { width: { fr: heroFr }, height: "fill" }), `${id}-exhibit`);
    // The side column is a headed section so its rule shares the chart heading's
    // band and the points start level with the plot, not with the heading text.
    // `pointsAlign: "middle"` centres the points on the exhibit instead.
    const list = pointsItem(slide.points || [], `${id}-points`);
    const side = slide.pointsAlign === "middle" || (slide.pointsAlign === undefined && unheaded(exhibits[0]))
      ? { id: `${id}-side`, layout: "flow.column", size: { width: { fr: sideFr }, height: "fill" }, leftover: "center", items: [list] }
      : { id: `${id}-side`, heading: slide.pointsHeading || "What it means", treatment: "open", size: { width: { fr: sideFr }, height: "fill" }, items: [list] };
    items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: layout === "exhibit-left" ? [hero, side] : [side, hero] });
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
      const side = { id: `${id}-side`, heading: slide.pointsHeading || "What it means", treatment: "open", size: { width: { fr: 1 }, height: "fill" }, items: [pointsItem(slide.points, `${id}-points`)] };
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
      const max = Math.max(...charts.flatMap((ex) => ex.series.flatMap((se) => se.values)));
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
        return (legend ? 52 : 28) + chartAnnotationBands({ changeAnnotations: ex.changeAnnotations || [] }).top + evidenceAnnotationTopBandCount({ annotations: ex.annotations || [] }) * EVIDENCE_CALLOUT_BAND;
      };
      const inset = Math.max(...charts.map(topBand));
      for (const ex of charts) { ex.plotTopInset = inset; if (charts.some(decorated)) ex.native = false; }
    }
    // Chart beside a narrow table (three columns or fewer): the chart takes 3:2.
    const panelSize = (ex) => {
      if (exhibits.length !== 2) return SIZE;
      const other = exhibits.find((o) => o !== ex);
      const narrow = (t) => t?.type === "table" && (t.columns || []).length <= 3;
      if (String(ex.type).startsWith("chart.") && narrow(other)) return { width: { fr: 3 }, height: "fill" };
      if (narrow(ex) && String(other?.type).startsWith("chart.")) return { width: { fr: 2 }, height: "fill" };
      return SIZE;
    };
    items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: exhibits.slice(0, 4).map((ex, i) => headedPanel(ex, { ...exhibitItem(ex, `${id}-exhibit-${i}`, baseDir), size: panelSize(ex) }, `${id}-exhibit-${i}`)) });
    if (slide.points?.length) items.push(pointsItem(slide.points, `${id}-points`));
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
  if (Array.isArray(slide.metrics) && slide.metrics.length && metricsBelow) items.push(metricsStrip(slide.metrics, `${id}-metrics`));
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
  return { id, title: slide.title, layout: "flow.column", ...(slide.titleLead ? { titleLead: slide.titleLead } : {}), ...(slide.tag ? { tag: slide.tag } : {}), ...(slide.density ? { density: slide.density } : {}), ...(slide.source ? { source: prefixed("Source", slide.source) } : {}), ...(slide.note ? { note: prefixed("Note", slide.note) } : {}), ...(slide.notes ? { notes: slide.notes } : {}), ...(slide.tracker ? { tracker: slide.tracker } : {}), items };
}

/**
 * `agenda: true` numbers the section dividers, inserts a Contents page before
 * the first section and repeats it (with the coming section highlighted) in
 * front of every later section: the classic tracker. `agenda: "once"` inserts
 * only the Contents page.
 */
export function agendaPages(slidesIn, agenda) {
  const sections = slidesIn.filter((s) => s.kind === "section");
  if (!agenda || sections.length < 2) return slidesIn;
  const numbered = new Map(sections.map((s, i) => [s, s.number ?? i + 1]));
  const items = sections.map((s) => ({ label: s.title, ...(s.summary ? { detail: s.summary } : {}) }));
  const out = [];
  let seen = 0;
  for (const slide of slidesIn) {
    if (slide.kind === "section") {
      if (seen === 0 || agenda !== "once") out.push({ kind: "agenda", id: `agenda-${seen + 1}`, title: seen === 0 ? "Contents" : "Agenda", items, active: seen });
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
    if (spec.cover.image) { cover.variant = "half-image"; cover.image = imageProps(spec.cover.image, baseDir); }
    else cover.variant = spec.cover.tone === "light" ? "plain" : "dark";
    if (spec.cover.notes) cover.notes = spec.cover.notes;
    slides.push(cover);
  }
  const pages = agendaPages(spec.slides, spec.agenda);
  for (const page of pages.flatMap(splitTables).flatMap(paginateTable)) slides.push(composeSlide(page, slides.length, baseDir));
  return {
    id: spec.id,
    palette: spec.palette || "mckinsey",
    ...(spec.pageTemplate ? { pageTemplate: spec.pageTemplate } : {}),
    ...(spec.typography ? { typography: spec.typography } : {}),
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
export function toDeckPlan(spec, baseDir) {
  if (isV3(spec)) return composeDeck(spec, baseDir);
  if (spec?.deckPlan) return spec.deckPlan;
  throw new Error("Spec must be professional-slides.deck/v3 or carry a deckPlan");
}
