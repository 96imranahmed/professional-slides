// deck/v3 → planner deckPlan. The author writes content and intent (~10 fields per
// slide); everything geometric — layout, sizes, density, section nesting — is derived
// here from what the page carries.
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
import { measureText, accentRuns } from "./text-layout.mjs";
import { chartAnnotationBands, evidenceAnnotationTopBandCount, EVIDENCE_CALLOUT_BAND } from "./chart-annotations.mjs";
import { legendRowCount } from "./legends.mjs";
import { measureTable } from "./tables.mjs";
import { resolveWeight, normalizeWeight } from "./weight.mjs";
import { groupThousands } from "./draw.mjs";

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
    // A row may carry several content columns (`cells`), which is the reference
    // deck's densest page: findings down the left with a numbered disc and an
    // icon, two or three columns across, each cell a short bulleted list under
    // a bold lead. Four hundred words of structured evidence, no chart.
    if ((ex.rows || []).some((row) => Array.isArray(row.cells))) {
      const rowsIn = ex.rows;
      const count = Math.max(...rowsIn.map((row) => (row.cells || []).length));
      if (!(count >= 1 && count <= 3)) throw new Error("A row matrix carries one to three content columns per row");
      const labels = (Array.isArray(ex.columns) ? ex.columns : []).map((column) => String(typeof column === "string" ? column : column?.label || ""));
      // `columns` heads the label column first, then the content columns; a
      // list as long as the content columns heads those alone.
      const headLabel = labels.length > count ? labels[0] : "";
      const headContent = labels.length > count ? labels.slice(1) : labels;
      const cellOf = (value) => {
        if (value === undefined || value === null) return { type: "text", text: " " };
        if (Array.isArray(value)) return { type: "bullets", items: value };
        if (typeof value === "string") return { type: "text", text: value };
        const { lead, points, text, highlight, ...rest } = value;
        // `highlight` names the phrase the cell sets in the accent; the table
        // calls that `accent`, because a cell's `highlight: true` is the older
        // flag that marks the whole cell.
        const accent = highlight === undefined || highlight === null ? {} : { accent: highlight };
        if (Array.isArray(points) && points.length) return { type: "bullets", items: points, ...(lead ? { lead } : {}), ...accent, ...rest };
        if (typeof text === "string" && text.trim()) return { type: "text", text: lead ? `${lead}. ${text}` : text, ...accent, ...rest };
        if (typeof lead === "string" && lead.trim()) return { type: "text", text: lead, bold: true, ...accent, ...rest };
        throw new Error("A row matrix cell needs text or points");
      };
      const numbered = ex.numbered !== false;
      const rows = rowsIn.map((row, index) => [
        { type: "category", text: String(row.label ?? ""), surface: "plain",
          ...(numbered ? { sectionNumber: row.number ?? index + 1 } : {}),
          ...(row.icon ? { icon: row.icon } : {}) },
        ...Array.from({ length: count }, (_, at) => cellOf((row.cells || [])[at]))
      ]);
      return { type: "table", treatment: "categories", variant: "plain", density: ex.density || "compact",
        columns: [{ label: headLabel, type: "category", width: 220 },
                  ...Array.from({ length: count }, (_, at) => ({ label: headContent[at] || "", type: "text", width: 420 }))],
        rows };
    }
    const rows = (ex.rows || []).map((row) => [{ type: "category", text: row.label, ...(row.number ? { sectionNumber: row.number } : {}), ...(row.icon ? { icon: row.icon } : {}) }, Array.isArray(row.points) ? { type: "bullets", items: row.points } : row.text]);
    // `columns: ["What we found", "What it means"]` heads the two tracks. The
    // reference pages label them; an unlabelled ledger keeps the blank band.
    const labels = Array.isArray(ex.columns) ? ex.columns.map((column) => String(typeof column === "string" ? column : column?.label || "")) : [];
    return { type: "table", treatment: "categories", variant: "standard", columns: [{ label: labels[0] || "", type: "category", width: 200 }, { label: labels[1] || "", type: "text", width: 800 }], rows, density: ex.density };
  }
  return ex;
}

/** Components whose render is the table renderer, reached by their own id. */
const TABLE_RENDERERS = ["trend-rows", "comparison-table", "heatmap"];

function exhibitItem(exIn, id, baseDir, size = SIZE) {
  // `caption`: the finding under this panel. In a two-up or a grid the
  // reference captions every panel rather than closing with one shared
  // so-what, because each panel answers its own question.
  if (exIn && typeof exIn.caption === "string" && exIn.caption.trim()) {
    const { caption, captionHeight, ...rest } = exIn;
    const panel = exhibitItem(rest, id, baseDir, { width: { fr: 1 }, height: "fill" });
    // The caption is the panel's finding, set as a statement box under it - a
    // bare grey line under a plot reads as a stray label. Peers share one box
    // height, so the plots above them keep one baseline.
    return { id: `${id}-captioned`, layout: "flow.column", gap: "space.3", size,
      items: [panel, { id: `${id}-caption`, component: "insight", props: { text: caption.trim(), variant: "neutral", align: "center" },
        size: captionHeight ? { width: { fr: 1 }, height: captionHeight } : HUG }] };
  }
  const ex = tableAlias(exIn);
  const { type, layout: _l, ...rest } = ex;
  if (type === "image") return { id, component: "image-frame", props: { ...imageProps(ex.path ? ex : ex.image, baseDir), ...(ex.fit ? { fit: ex.fit } : {}) }, size };
  if (type === "cards" || type === "quadrants") { const { centre, ...sz } = size; return { id, component: type, props: { ...rest, ...(centre ? { valign: "middle" } : {}) }, size: sz }; }
  if (type === "swot") return { id, component: "quadrants", props: { quadrants: ["Strengths", "Weaknesses", "Opportunities", "Threats"].map((title, i) => ({ title, points: [rest.strengths, rest.weaknesses, rest.opportunities, rest.threats][i] || [] })) }, size };
  if (type === "table") {
    const styled = styleTable(rest);
    return { id, component: "table", props: { ...styled, density: rest.density || "body", fillHeight: size.height === "fill", ...(rest.rowSpacing ? { rowSpacing: rest.rowSpacing } : {}), ...(rest.headerShape ? { headerShape: rest.headerShape } : {}) }, size };
  }
  // The other table renderers reach the page by their component id rather than
  // through the `table` alias, and used to lose the one thing the alias does
  // for them: a table in a full-height frame spreads its rows down the frame
  // instead of hugging the top and leaving the page empty under it.
  if (TABLE_RENDERERS.includes(type)) {
    return { id, component: type, props: { ...rest, fillHeight: size.height === "fill" }, size };
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
 * reading of the same data, which is how a reference measure table gets to six
 * columns without a second source.
 */
const DERIVATIONS = ["rank", "share", "change", "index"];
const cellText = (cell) => String((cell && typeof cell === "object" ? cell.text ?? cell.value : cell) ?? "").trim();
const numberOf = (cell) => {
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
// every published table prints it. Only whole numbers, only where the whole
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
      const text = groupThousands(String(value));
      return cell && typeof cell === "object" ? { ...cell, text } : text;
    });
    const { plain, ...rest } = row;
    return plain ? cells : { ...rest, cells };
  });
  return { ...ex, rows };
}

/**
 * `total: true` closes a table of counts with the column sums, which is how a
 * reference measure table ends. Numeric columns sum; a share column sums to 100;
 * anything the arithmetic cannot reach stays blank rather than guessing.
 */
function totalRow(ex) {
  if (ex.total !== true) return ex;
  const rows = ex.rows.map((row) => (Array.isArray(row) ? { cells: row, plain: true } : { ...row }));
  const body = rows.filter((row) => row.style !== "total" && row.style !== "group");
  if (!body.length) return ex;
  if (rows.some((row) => row.style === "total")) throw new Error("The table already carries a total row");
  const label = typeof ex.totalLabel === "string" && ex.totalLabel.trim() ? ex.totalLabel.trim() : "Total";
  const cells = ex.columns.map((column, index) => {
    if (index === 0) return label;
    const derived = typeof column === "object" ? column.derived : null;
    if (derived === "rank" || derived === "index" || derived === "change") return " ";
    if (derived === "share") return "100";
    const values = body.map((row) => numberOf(row.cells[index]));
    if (values.some((value) => value === null)) return " ";
    return String(Math.round(values.reduce((a, b) => a + b, 0) * 10) / 10);
  });
  const { total: _t, totalLabel: _l, ...rest } = ex;
  return { ...rest, rows: [...rows.map((row) => (row.plain ? row.cells : row)), { style: "total", cells }] };
}

/**
 * A column marked `implication: true` is the conclusion drawn from the columns
 * before it, not a fourth fact beside them.
 *
 * The review put it plainly: a "Verdict" column flush against the evidence in
 * an identical cell reads as more evidence. The renderer already knows how to
 * draw a gutter of chevrons (`type: "implication"`), so this inserts one before
 * the marked column and decides how much of it to draw.
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
  if (at === 0) throw new Error("An implication column follows the evidence it is drawn from; it cannot be the first column");
  const rows = ex.rows || [];
  const style = ex.implicationStyle || (rows.length >= 5 ? "single" : "per-row");
  if (!["per-row", "single"].includes(style)) throw new Error(`Unknown implicationStyle: ${style}; use per-row or single`);
  const middle = Math.floor((rows.length - 1) / 2);
  const gutter = { label: "", type: "implication", width: 52 };
  const { implication: _flag, ...rest } = columns[at];
  const marked = { type: "text", ...rest };
  const nextColumns = [...columns.slice(0, at), gutter, marked, ...columns.slice(at + 1)];
  const nextRows = rows.map((row, index) => {
    const cells = Array.isArray(row) ? row : row.cells || [];
    // A blank cell in the gutter on the rows that carry no chevron.
    const draw = style === "per-row" || index === middle;
    const mark = { type: "implication", relation: "implies", ...(draw ? {} : { draw: false }) };
    const next = [...cells.slice(0, at), mark, ...cells.slice(at)];
    return Array.isArray(row) ? next : { ...row, cells: next };
  });
  return { ...ex, columns: nextColumns, rows: nextRows, implicationStyle: undefined };
}

/**
 * Column treatments that turn a value into something the eye reads before the
 * mind does.
 *
 * `heat: true` fills every cell in the column on a sequential scale, which is
 * how the reference benchmark tables let a reader find the leader without
 * reading a single number. `bubble: true` sets the value in a filled pill, the
 * same device the change annotation uses on a chart, so one column of a flat
 * reference table carries emphasis.
 */
function columnTreatments(ex) {
  const columns = ex.columns || [];
  const marks = columns.map((c) => (c && typeof c === "object" ? { heat: c.heat === true, bubble: c.bubble === true } : { heat: false, bubble: false }));
  if (!marks.some((m) => m.heat || m.bubble)) return ex;
  const nextColumns = columns.map((c, i) => {
    if (!marks[i].heat && !marks[i].bubble) return c;
    const { heat: _h, bubble: _b, ...rest } = c;
    return marks[i].heat ? { ...rest, type: "heatmap" } : rest;
  });
  const asNumber = (cell) => {
    const raw = String(cell?.text ?? cell ?? "").replace(/[^0-9.+-]/g, "");
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };
  const nextRows = (ex.rows || []).map((row) => {
    const cells = Array.isArray(row) ? row : row.cells || [];
    const next = cells.map((cell, i) => {
      if (marks[i].heat) {
        const value = asNumber(cell);
        if (value === null) throw new Error(`A heat column needs numeric cells; "${String(cell?.text ?? cell)}" is not one`);
        return { type: "heatmap", value };
      }
      if (marks[i].bubble) {
        const text = String(cell?.text ?? cell ?? "").trim();
        if (!text) throw new Error("A bubble column needs text in every cell");
        return { ...(typeof cell === "object" && cell ? cell : {}), type: "highlight", text, surface: "bubble" };
      }
      return cell;
    });
    return Array.isArray(row) ? next : { ...row, cells: next };
  });
  return { ...ex, columns: nextColumns, rows: nextRows };
}

export function styleTable(ex) {
  ex = groupNumericColumns(totalRow(deriveColumns(implicationColumn(columnTreatments(ex)))));
  // An object column (one that names a `group`, a `unit`, an alignment) still
  // gets its width from what it holds, unless it sets one: otherwise adding a
  // unit to a header would silently reweight every column to equal shares and
  // squeeze the one column that needed the room.
  const columns = ex.columns.map((c, i) => typeof c === "string"
    ? { label: c, type: "text", bold: i === 0, width: columnWeight(ex, i) }
    : { width: columnWeight(ex, i), ...c });
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

/**
 * The shapes a commentary column can take.
 *
 * Measured over the reference client decks, the numbered disc is one device
 * among six, and it is used for a full-width ledger of one-line items rather
 * than for a three-item side column. A composer with one shape produced five
 * consecutive pages of identical numbered lists; these are the alternatives the
 * corpus actually uses, and `resolvePointsStyle` rotates through the ones that
 * suit the content.
 */
const POINT_STYLES = {
  // Icon, then the lead running into the sentence in the house accent.
  "icon-lead": { marker: "icon", inlineLead: true },
  // The icon in a ring, the lead above its own text: for points that each
  // carry their own evidence.
  "icon-framed": { marker: "icon-ring" },
  // A bold lead and its paragraph, nothing in the gutter.
  prose: { marker: "none" },
  // A hairline between items instead of a mark beside them.
  ruled: { marker: "rule" },
  // A / B / C: options, not steps.
  lettered: { marker: "letter" },
  // The numbered disc, which the corpus reserves for an ordered ledger.
  numbered: { marker: "number" },
  // The plain house bullet.
  bulleted: { marker: "auto" },
};

export const POINT_STYLE_NAMES = Object.freeze(Object.keys(POINT_STYLES));

/**
 * Which shape this column takes: what the author asked for, else what the
 * content is, else whichever suitable shape has been used least recently.
 */
function resolvePointsStyle(slide, points, recentStyles = []) {
  if (slide.pointsStyle) {
    if (!POINT_STYLES[slide.pointsStyle]) throw new Error(`Unknown pointsStyle: ${slide.pointsStyle}; use one of ${POINT_STYLE_NAMES.join(", ")}`);
    return slide.pointsStyle;
  }
  const entries = points.map((point) => (typeof point === "string" ? { text: point } : point || {}));
  // Content decides first, where it speaks clearly.
  if (entries.some((e) => e.icon)) return "icon-lead";
  if (entries.some((e) => e.state)) return "numbered";
  if (entries.every((e) => e.number !== undefined)) return "numbered";
  if (!entries.some((e) => e.lead)) return "bulleted";
  // Otherwise the column is a set of parallel findings, and any of these suit
  // it. Take the one used longest ago so a section does not repeat one shape.
  const viable = ["icon-lead", "ruled", "prose", "numbered"];
  const unused = recentStyles.length + 1;
  const staleness = (name) => { const at = recentStyles.indexOf(name); return at === -1 ? unused : at; };
  return viable.slice().sort((a, b) => staleness(b) - staleness(a) || viable.indexOf(a) - viable.indexOf(b))[0];
}

function pointsItem(points, id, tone, fill, inColumn = false, style = null) {
  // The side column is a track, not a shelf: its points spread down it unless
  // the deck is airy, where the white space is the point. A list that hugs the
  // top of a 500px column leaves two fifths of it empty, which is how a page
  // that carries real content still reads as thin. A list under a row of
  // exhibits hugs instead — there it is a footer, not a column.
  const distribute = inColumn && fill !== "airy" && points.length > 1;
  const shape = style && POINT_STYLES[style] ? POINT_STYLES[style] : {};
  return { id, component: "bullet-list", props: { variant: "body", items: points, ...shape, ...(tone === "dark" || tone === "primary" ? { tone: "inverse" } : {}), ...(distribute ? { distribute: true } : {}) }, size: distribute ? { width: { fr: 1 }, height: "fill" } : HUG };
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

/**
 * The page's close, under everything else.
 *
 * One sentence is the tonal band. A list is the reference decks' other closing
 * device: two or three square-bulleted lines on a muted surface under a dense
 * table, each carrying its own finding, rather than one long band that says
 * three things in a row.
 */
function soWhatItem(text, id) {
  if (Array.isArray(text)) {
    if (!text.length) throw new Error("A soWhat list needs at least one line");
    if (text.length > 3) throw new Error("A soWhat list carries at most three lines; the rest belongs in the page");
    return { id, component: "insight", props: { items: text, variant: "tonal" }, size: HUG };
  }
  return { id, component: "insight", props: { text, variant: "tonal" }, size: HUG };
}

/**
 * The page shapes the composer can build, and what each one wants.
 *
 * Measured against the corpus, a reference client deck runs about five distinct
 * page shapes per ten analytical pages and never lets one shape past a quarter
 * of the deck. A deck built on the old chooser ran 1.3 shapes per ten pages with
 * 69% on one of them, because a single branch - one exhibit plus any commentary
 * - returned `exhibit-left` and caught almost every page.
 *
 * So the choice is scored rather than short-circuited. `fit` says how well a
 * shape suits what the page carries; a shape the page cannot support scores 0
 * and is never chosen. Among the shapes that fit, the one used least recently
 * wins, which is what spreads a section across its repertoire.
 */
const PAGE_SHAPES = {
  // One exhibit, commentary beside it. The workhorse, and the one that used to
  // be the whole repertoire.
  "exhibit-left": { fit: (s, ex) => (ex.length === 1 && hasCommentary(s) && !needsFullWidth(ex[0]) ? 3 : 0) },
  // The mirror. The reference decks alternate sides down a section; reading
  // the commentary first suits a page whose exhibit confirms a claim.
  "exhibit-right": { fit: (s, ex) => (ex.length === 1 && hasCommentary(s) && !s.photo && !s.kpi && !needsFullWidth(ex[0]) ? 3 : 0) },
  // The exhibit across the full width with the commentary in columns beneath
  // it: the commonest reference shape, and the right one when the exhibit is
  // wide (many categories) or the commentary divides into parallel points.
  "exhibit-top": {
    fit: (s, ex) => {
      if (ex.length !== 1 || !Array.isArray(s.points) || s.points.length < 2 || s.points.length > 4) return 0;
      if (s.photo || s.kpi || s.insight || s.insights) return 0;
      // A `compare` exhibit is already two columns arguing with each other; its
      // commentary belongs beside it, not stacked underneath.
      if (["compare", "quadrants", "swot", "matrix"].includes(ex[0].type)) return 0;
      // It fits as well as the side column does, never better: a page composed
      // on its own keeps the established shape, and the variety comes from
      // alternating across the deck rather than from a new monoculture.
      return 3;
    },
  },
  // One enormous figure with its explanation, one supporting exhibit beside it.
  // For the page whose whole argument is a single number.
  "hero-number": { fit: (s, ex) => (s.kpi && ex.length === 1 && !s.photo ? (s.points?.length ? 3 : 4) : 0) },
  // Half the page on a tinted ground, half on the canvas: a comparison that
  // genuinely has two sides, rather than evidence and its meaning.
  "split-tone": {
    fit: (s, ex) => (ex.length === 2 && !s.points?.length && !s.kpi
      && ex.every((e) => typeof e.caption === "string" && e.caption.trim()) ? 4 : 0),
  },
  // Two exhibits side by side, each captioned, no shared column.
  "two-up-contrast": { fit: (s, ex) => (ex.length === 2 && !s.points?.length && !s.kpi ? 3 : 0) },
  "two-up": { fit: (s, ex) => (ex.length >= 2 ? 3 : 0) },
  // Stacking halves each panel's height, which a chart with an annotation band
  // cannot always take. It is reachable from `arrange: "stack"` and from the
  // auto-stack rule above (two charts on one category set), both of which know
  // the panels fit - so it is never chosen on score alone.
  "stack": { fit: () => 0 },
  "grid": { fit: (s, ex) => (ex.length >= 4 ? 4 : 0) },
  "exhibit-full": { fit: (s, ex) => (ex.length === 1 && (!hasCommentary(s) || needsFullWidth(ex[0])) ? 3 : 0) },
  "text": { fit: (s, ex) => (ex.length === 0 ? 3 : 0) },
};

export const PAGE_SHAPE_NAMES = Object.freeze(Object.keys(PAGE_SHAPES));

const TABLE_LIKE_TYPES = ["table", "rows", "compare", "phase-table"];
const hasCommentary = (s) => Boolean(s.points?.length || s.insight || s.insights?.length || s.kpi);

/**
 * An exhibit that cannot survive being narrowed to two thirds of the page.
 *
 * A five-column table of sentences needs the full measure: squeezed into a
 * side-column layout its header words stop fitting their cells, which the
 * measurer refuses outright. The chooser has to know that before it picks the
 * shape, or a page that would have composed simply fails.
 */
function needsFullWidth(ex) {
  if (!ex) return false;
  // A timeline with many periods, a matrix, a map: exhibits whose horizontal
  // axis is the content and cannot be compressed.
  if (["gantt", "timeline", "roadmap", "map", "heatmap", "marimekko"].includes(ex.type)) return true;
  if (!TABLE_LIKE_TYPES.includes(ex.type)) return false;
  const columns = ex.columns || [];
  if (columns.length >= 5) return true;
  const cells = (ex.rows || []).flatMap((row) => (Array.isArray(row) ? row : row?.cells || []));
  const longest = Math.max(0, ...cells.map((cell) => String(cell?.text ?? cell ?? "").length));
  // Sentence-length cells starve the narrow label column when the table is
  // squeezed, and the header word stops fitting before the cell text does.
  return columns.length >= 3 && longest > 60;
}

function chooseLayout(slide, recent = []) {
  if (slide.layout && slide.layout !== "auto") return slide.layout;
  const exhibits = slide.exhibits || (slide.exhibit ? [slide.exhibit] : []);
  // An explicit arrangement is the author overriding the choice, not a hint.
  if (slide.arrange === "stack") return "stack";
  if (slide.arrange === "row") return exhibits.length === 2 && !slide.points?.length ? "two-up-contrast" : "two-up";
  if (slide.arrange === "grid" || exhibits.length >= 4) return "grid";
  // Two charts on one category set with points beside them stack in the hero
  // column rather than shrinking into a three-way row.
  if (exhibits.length === 2 && slide.points?.length && exhibits.every((ex) => String(ex.type).startsWith("chart.")) && JSON.stringify(exhibits[0].categories) === JSON.stringify(exhibits[1].categories)) return "stack";

  const scored = Object.entries(PAGE_SHAPES)
    .map(([name, shape]) => [name, shape.fit(slide, exhibits)])
    .filter(([, score]) => score > 0);
  if (!scored.length) return exhibits.length ? "exhibit-full" : "text";
  const best = Math.max(...scored.map(([, score]) => score));
  // Shapes within one point of the best all suit the page, so the tie is broken
  // on variety: the one used longest ago. `recent` is most-recent-first.
  const viable = scored.filter(([, score]) => score >= best - 1).map(([name]) => name);
  if (viable.length === 1) return viable[0];
  // Staleness is how many pages ago the shape was used, capped so that "never
  // used" is a finite number and the comparison stays deterministic. The order
  // is: least recently used, then best fit, then the order declared above - so
  // a page composed on its own always resolves the same way, and a deck spreads
  // across its repertoire.
  const unused = recent.length + 1;
  const staleness = (name) => { const at = recent.indexOf(name); return at === -1 ? unused : at; };
  const score = (name) => scored.find(([n]) => n === name)[1];
  const declared = (name) => PAGE_SHAPE_NAMES.indexOf(name);
  return viable.slice().sort((a, b) =>
    staleness(b) - staleness(a) || score(b) - score(a) || declared(a) - declared(b))[0];
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
/**
 * Every key a slide may carry, with the one line that says what it is for.
 *
 * Without this, a misspelled key - `subtitile`, `footnote`, `insite` - composed
 * silently and the page came out missing the thing the author wrote. The check
 * is a spelling check, not a schema: the value's shape is still the business of
 * whichever pass reads it.
 */
export const SLIDE_KEYS = Object.freeze({
  // what the page is
  id: "the page's own id; one is derived from its position when absent",
  kind: "statement, takeaways, section, agenda or cover; absent means an analytical page",
  shape: "one of the four heavy-page shapes: findings-matrix, measure-table, model-page, half-and-half",
  layout: "force a layout instead of letting the composer choose one",
  arrange: "row or stack, when the page carries more than one exhibit",
  density: "this page's density profile, overriding the deck's",
  // the title band
  title: "the action title: the finding, not the subject",
  titleLead: "a lead-in phrase set before the title in the accent",
  subtitle: "the standfirst under the title: the measure, the population and the period",
  kicker: "the small label above the title naming the part of the argument",
  tag: "PRELIMINARY, ILLUSTRATIVE, Exhibit 3 - the page's badge",
  tracker: "the section tracker shown on this page",
  // the evidence
  exhibit: "the page's one exhibit",
  exhibits: "two or more exhibits, arranged by `arrange`",
  rows: "a label-and-text table written at slide level",
  columns: "the headers for that table",
  photo: "a photograph beside the copy",
  image: "a full-bleed picture, on the fixed-shape pages",
  metrics: "a strip of measured tiles",
  metricsPosition: "top (the default) or bottom",
  metricsTone: "the tiles' treatment",
  kpi: "the one big number the exhibit proves, at the top of the side column",
  // the commentary
  points: "the commentary column: a lead and a sentence per point",
  pointsHeading: "the heading over that column, or false for none",
  pointsStyle: "how the column is marked: icon-lead, icon-framed, prose, ruled, lettered, numbered or bulleted",
  pointsTone: "open, dark, muted, tint or primary",
  pointsAlign: "middle to centre the points on the exhibit",
  paragraphs: "body prose, on a text page",
  text: "the sentence a statement page carries",
  subtext: "the line under that sentence",
  insight: "the so-what as a box in the side column",
  insights: "two statements in that column: a plain one above a boxed one",
  callout: "a boxed aside beside the evidence",
  soWhat: "the page's close, under everything else",
  implication: "false to drop the marker joining evidence to meaning",
  items: "the entries on an agenda or takeaways page",
  active: "which agenda entry the deck is on",
  summary: "the line under a section divider's title",
  number: "a section divider's number",
  // the footer
  source: "where the numbers came from",
  note: "the footnote line, or a list of numbered notes",
  footnotes: "notes tied to a label, printed with a superscript marker",
  notes: "the speaker notes, which print in the file and never on the page",
  // the rest
  serves: "which ranked criteria this page answers",
  tone: "dark or light, on the fixed-shape pages",
  accent: "an accent phrase inside a statement",
  style: "a per-kind style switch (an agenda in columns, say)",
  stackWeights: "the height shares of stacked exhibits",
  pairedWeights: "the width shares of paired exhibits",
});

function assertKnownSlideKeys(slide, id) {
  const known = Object.keys(SLIDE_KEYS);
  for (const key of Object.keys(slide)) {
    if (key in SLIDE_KEYS) continue;
    const lower = key.toLowerCase();
    // The nearest known key by a cheap edit distance: a misspelling is almost
    // always a transposition, a doubled letter or a dropped one.
    const near = known.filter((candidate) => {
      const other = candidate.toLowerCase();
      if (Math.abs(other.length - lower.length) > 2) return false;
      const shared = [...new Set(lower)].filter((ch) => other.includes(ch)).length;
      return shared >= Math.max(3, Math.min(other.length, lower.length) - 2);
    });
    const hint = near.length ? ` Did you mean ${near.slice(0, 3).map((k) => `\`${k}\``).join(" or ")}?` : "";
    throw new Error(`${id}: unknown slide key \`${key}\`.${hint} The page keys are ${known.join(", ")}.`);
  }
}

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

/**
 * The four pages that are not analytical pages.
 *
 * Each is a fixed shape with no layout to negotiate, so each is one function
 * from the spec to the plan rather than an early return buried in the
 * composer. They share the picture and the speaker notes, which is what
 * `chrome` carries.
 */
const KINDS = {
  statement: (slide, { id }) => ({ kind: "statement", text: slide.text || slide.title,
    ...(slide.accent ? { accent: slide.accent } : {}),
    ...(slide.subtext ? { subtext: slide.subtext } : {}),
    ...(slide.tone === "dark" ? { mode: "dark" } : {}) }),
  takeaways: (slide) => ({ kind: "takeaways",
    ...(slide.title ? { title: slide.title } : {}),
    items: slide.points || slide.items,
    ...(slide.tone === "light" ? { mode: "light" } : {}) }),
  section: (slide) => ({ kind: "divider", title: slide.title,
    ...(slide.summary ? { subtitle: slide.summary } : {}),
    ...(slide.number !== undefined ? { number: slide.number } : {}) }),
  agenda: (slide, { id }) => ({ title: slide.title || "Contents", layout: "flow.column",
    items: [{ id: `${id}-agenda`, component: "agenda", props: { items: slide.items,
      ...(slide.active !== undefined ? { active: slide.active } : {}),
      ...(slide.style === "columns" ? { variant: "columns" } : {}) }, size: SIZE }] }),
};

/**
 * The four heavy-page shapes, named.
 *
 * SKILL.md describes the shapes a reference deck's dense pages take; a `shape`
 * on the slide is the author saying "this is that page", and the preset sets
 * the weight and the defaults that shape needs. Everything a preset sets, the
 * slide can override, because the shape is a starting point and not a mould.
 */
const SHAPES = {
  // Findings down the left, columns of short bulleted evidence across.
  "findings-matrix": (slide) => {
    if (!Array.isArray(slide.rows) && !(slide.exhibit && slide.exhibit.type === "rows")) {
      throw new Error("A findings-matrix page is built from `rows`, each with `cells`");
    }
    return { density: slide.density ?? "pre-read", implication: slide.implication ?? false };
  },
  // Ten to fifteen rows, measures under grouped headers, footnote markers.
  "measure-table": (slide) => {
    const ex = slide.exhibit;
    if (!ex || !["table", "rows", "compare"].includes(ex.type)) throw new Error("A measure-table page needs a table exhibit");
    return { density: slide.density ?? "pre-read",
      exhibit: { density: ex.density ?? "compact", total: ex.total ?? true, ...ex } };
  },
  // The assumptions grid behind a forecast: the chart over its own numbers.
  "model-page": (slide) => {
    const ex = slide.exhibit;
    if (!ex || !String(ex.type).startsWith("chart.")) throw new Error("A model-page is a chart over its own data table");
    return { density: slide.density ?? "pre-read", exhibit: { ...ex, dataTable: ex.dataTable ?? true } };
  },
  // The page that states the answer: the measures across the top, the findings
  // that carry them as a numbered ledger, the close underneath. Your deck's
  // page 2 was this page assembled by hand, and nothing said to write it.
  "executive-summary": (slide) => {
    const findings = slide.points || slide.rows;
    if (!Array.isArray(findings) || findings.length < 2 || findings.length > 5) {
      throw new Error("An executive summary carries two to five findings in `points`");
    }
    if (!Array.isArray(slide.metrics) || !slide.metrics.length) {
      throw new Error("An executive summary opens with the measures the answer rests on, in `metrics`");
    }
    return {
      density: slide.density ?? "pre-read",
      points: findings,
      pointsStyle: slide.pointsStyle ?? "numbered",
      pointsHeading: slide.pointsHeading ?? false,
      layout: slide.layout ?? "text",
      rows: undefined,
    };
  },
  // A chart with its own commentary on one side, icon-led points on the other.
  "half-and-half": (slide) => {
    if (!slide.exhibit || !Array.isArray(slide.points) || !slide.points.length) {
      throw new Error("A half-and-half page needs one exhibit and a column of points");
    }
    return { density: slide.density ?? "pre-read", layout: slide.layout ?? "exhibit-left" };
  },
};

export const SHAPE_NAMES = Object.freeze(Object.keys(SHAPES));

/**
 * The composer's rewrite passes, in the order they run.
 *
 * Each pass reads the slide the last one produced and returns the slide the
 * next one sees, so the order is the pipeline and the names are what it does.
 * A pass that needs to hand something to the layout stage rather than to the
 * next pass writes it on `ctx`.
 */
const SLIDE_PASSES = [
  ["footnotes", (slide) => applyFootnotes(slide)],
  ["paired-bars", (slide) => pairedBars(slide)],

  // Findings the exhibit's own data supports: a percent stack, the highlight
  // the title names, the change between the periods it compares.
  ["read-the-data", (slide) => {
    const derive = (ex) => changeFromContent(highlightFromTitle(percentStack(ex), slide.title), slide.title);
    if (slide.exhibit) return { ...slide, exhibit: derive(slide.exhibit) };
    if (slide.exhibits) return { ...slide, exhibits: slide.exhibits.map(derive) };
    return slide;
  }],

  // `shape: "findings-matrix"` and friends: the page says which of the four
  // heavy shapes it is, and the preset fills in what that shape needs.
  ["shape", (slide) => {
    if (!slide.shape) return slide;
    const preset = SHAPES[slide.shape];
    if (!preset) throw new Error(`Unknown page shape: ${slide.shape}; use one of ${SHAPE_NAMES.join(", ")}`);
    const { shape: _s, ...rest } = slide;
    return { ...rest, ...preset(slide) };
  }],

  // A page that names its measure in the standfirst does not name it again
  // over the plot: with one exhibit, the subtitle is the chart's title, and
  // the exhibit's own heading band would print it twice. The unit joins the
  // standfirst when the standfirst does not already carry it. Panels in a row
  // keep their headings - those name the series, not the measure.
  ["standfirst-carries-the-measure", (slide) => {
    if (!(slide.subtitle && slide.exhibit && !slide.exhibits && slide.exhibit.heading
        && !(Array.isArray(slide.metrics) && slide.metrics.length) && !slide.kpi)) return slide;
    const unit = typeof slide.exhibit.unit === "string" ? slide.exhibit.unit.trim() : "";
    const carries = unit && slide.subtitle.toLowerCase().includes(unit.toLowerCase());
    const { heading: _h, unit: _u, ...exhibit } = slide.exhibit;
    return { ...slide, subtitle: unit && !carries ? `${slide.subtitle}, ${unit}` : slide.subtitle, exhibit };
  }],

  // `split: true` on a multi-series chart sets it as small multiples: one
  // panel per series, each headed by the series name, sharing one value scale
  // and one category axis. A legend and twelve marks becomes three headings
  // and twelve labelled marks - the reference's way of showing three cuts of
  // one measure.
  ["split-into-small-multiples", (slide) => {
    if (!(slide.exhibit && slide.exhibit.split === true && !slide.exhibits)) return slide;
    const { split: _s, series, ...rest } = slide.exhibit;
    if (!Array.isArray(series) || series.length < 2 || series.length > 4) throw new Error("A split chart needs two to four series");
    // Every panel keeps the unit, so the peers share one value scale and the
    // comparison holds; the measure itself moves to the page's standfirst.
    const measure = [rest.heading, rest.unit].filter(Boolean).join(", ");
    return { ...slide, exhibit: undefined,
      ...(slide.subtitle || !measure ? {} : { subtitle: measure }),
      exhibits: series.map((entry) => ({ ...rest, heading: entry.name, series: [entry], legend: false })) };
  }],

  // A deck whose weight asks for two elements a page gets the second one
  // offered rather than demanded: a chart of six categories or fewer, with no
  // table, no metrics and no second exhibit, tabulates itself underneath.
  // `dataTable: false` declines it. A single labelled series is not offered
  // one - its table would print the same five numbers a second time.
  ["offer-a-data-table", (slide, { elements }) => {
    if (!(elements >= 2 && slide.exhibit && !slide.exhibits && String(slide.exhibit.type).startsWith("chart.")
        && slide.exhibit.dataTable === undefined && Array.isArray(slide.exhibit.series) && Array.isArray(slide.exhibit.categories)
        && slide.exhibit.categories.length <= 6 && slide.exhibit.series.length >= 2 && slide.exhibit.series.length <= 3
        && !(Array.isArray(slide.metrics) && slide.metrics.length) && !slide.kpi && !thinChart(slide.exhibit))) return slide;
    return { ...slide, exhibit: { ...slide.exhibit, dataTable: true } };
  }],

  // `dataTable: true` tabulates the chart's own series under it: the same
  // numbers, printed, which is the cheapest second element a page can carry
  // and what the reference pages do under a column chart.
  ["build-the-data-table", (slide) => {
    if (!(slide.exhibit && slide.exhibit.dataTable === true && Array.isArray(slide.exhibit.series) && !slide.exhibits)) return slide;
    return { ...slide, exhibit: { ...slide.exhibit, dataTable: slide.exhibit.series.map((series) => ({ label: series.name, values: (series.values || []).map((value) => formatTableValue(value)) })) } };
  }],

  // The chart stacks over a compact table whose columns are its categories.
  ["stack-the-data-table", (slide) => {
    if (!(slide.exhibit && Array.isArray(slide.exhibit.dataTable) && slide.exhibit.dataTable.length && !slide.exhibits)) return slide;
    const chart = { ...slide.exhibit }; const rowsIn = chart.dataTable; delete chart.dataTable;
    const table = { type: "table", density: "compact", treatment: "open", variant: "plain", columns: [{ label: "", type: "text", bold: true, width: 120 }, ...(chart.categories || []).map(() => ({ label: "", type: "text", align: "center", width: 80 }))], rows: rowsIn.map((r) => [r.label, ...(r.values || []).map(String)]) };
    return { ...slide, exhibit: undefined, exhibits: [chart, table], arrange: "stack", stackWeights: [4, 1] };
  }],

  // Hero fitness: a thin single-series chart becomes a column of KPI tiles
  // (one per category) that stands in for the hero, points beside it.
  ["thin-chart-becomes-tiles", (slide, ctx) => {
    if (!((!slide.layout || slide.layout === "auto") && slide.exhibit && !slide.exhibits && thinChart(slide.exhibit) && !slide.metrics)) return slide;
    ctx.tileColumn = chartToMetrics(slide.exhibit);
    ctx.tilePoints = slide.points || [];
    return { ...slide, exhibit: undefined, exhibits: undefined, points: undefined };
  }],

  // `rows` at slide level is the label-and-text table.
  ["rows-become-a-table", (slide) => (slide.rows && !slide.exhibit && !slide.exhibits
    ? { ...slide, exhibit: { type: "rows", rows: slide.rows, ...(Array.isArray(slide.columns) ? { columns: slide.columns } : {}) } }
    : slide)],

  // One big number parked above a table reads as two pages glued together: the
  // tile floats in air and the table starts again under it. A lone metric over
  // a table is the hero number of the side column instead, beside its evidence.
  ["lone-metric-joins-its-evidence", (slide) => {
    const TABLE_LIKE = ["table", "rows", "compare", "phase-table"];
    if (!(Array.isArray(slide.metrics) && slide.metrics.length === 1 && !slide.kpi && slide.metricsPosition !== "bottom"
        && !slide.exhibits && TABLE_LIKE.includes(slide.exhibit?.type))) return slide;
    const tile = typeof slide.metrics[0] === "string" ? { value: slide.metrics[0] } : slide.metrics[0];
    return { ...slide, metrics: undefined, kpi: { value: tile.value, ...(tile.label ? { label: tile.label } : {}), ...(tile.sublabel ? { sublabel: tile.sublabel } : {}) } };
  }],

  // A text page whose points carry leads is a numbered ledger: label + text
  // rows with rules, filling the page, rather than a list floating at the top.
  ["led-points-become-a-ledger", (slide) => {
    if (!(!slide.exhibit && !slide.exhibits && !slide.rows && !slide.photo && (!slide.layout || slide.layout === "auto")
        && Array.isArray(slide.points) && slide.points.length >= 2 && slide.points.length <= 6
        && slide.points.every((pt) => pt && typeof pt === "object" && pt.lead && pt.text && !pt.icon && pt.state == null))) return slide;
    return { ...slide, points: undefined, exhibit: { type: "rows", rows: slide.points.map((pt, i) => ({ label: pt.lead, text: pt.text, number: pt.number ?? i + 1 })) } };
  }],
];

/** The pass names, in order - what the composer does to a slide and when. */
export const PASS_NAMES = Object.freeze(SLIDE_PASSES.map(([name]) => name));

export function composeSlide(slide, index, baseDir, fill = "balanced", elements = 1, recent = [], recentStyles = []) {
  const id = slide.id || `s${String(index + 1).padStart(2, "0")}`;
  assertKnownSlideKeys(slide, id);
  const ctx = { id, baseDir, fill, elements, tileColumn: null, tilePoints: [] };

  // The first three passes run for every page; the fixed-shape pages then take
  // their own route and the rest go on through the pipeline.
  for (const [, run] of SLIDE_PASSES.slice(0, 3)) slide = run(slide, ctx);
  if (KINDS[slide.kind]) {
    return { id, ...KINDS[slide.kind](slide, ctx),
      ...(slide.image ? { image: imageProps(slide.image, baseDir) } : {}),
      ...(slide.notes ? { notes: slide.notes } : {}) };
  }
  const slideIn = slide;
  for (const [name, run] of SLIDE_PASSES.slice(3)) {
    try {
      slide = run(slide, ctx);
    } catch (error) {
      throw new Error(`${id} (${name}): ${error.message}`, { cause: error });
    }
  }
  const { tileColumn, tilePoints } = ctx;
  const layout = chooseLayout(slide, recent);
  if (Array.isArray(recent)) recent.unshift(layout);
  // The column's shape, resolved once for the page and remembered, so
  // consecutive pages do not all reach for the same device.
  // The tile pass moves a thin chart's points onto the context, so read both.
  const columnPoints = slide.points?.length ? slide.points : tilePoints;
  const pointsStyle = columnPoints?.length ? resolvePointsStyle(slide, columnPoints, recentStyles) : null;
  if (pointsStyle && Array.isArray(recentStyles)) recentStyles.unshift(pointsStyle);
  const exhibits = slide.exhibits || (slide.exhibit ? [slide.exhibit] : []);
  const items = [];
  const metricsBelow = slide.metricsPosition === "bottom";
  if (Array.isArray(slide.metrics) && slide.metrics.length && !metricsBelow) items.push(metricsStrip(slide.metrics, `${id}-metrics`, slide.metricsTone));
  if (tileColumn) {
    const tiles = { id: `${id}-tiles`, layout: "flow.column", size: { width: { fr: 1 }, height: "fill" }, items: tileColumn.map((m, i) => ({ id: `${id}-tile-${i}`, component: "metric", props: { ...m, variant: "prominent" }, size: { width: { fr: 1 }, height: "fill" } })) };
    const side = { id: `${id}-side`, heading: slide.pointsHeading || "What it means", treatment: sideTreatment(slide), size: { width: { fr: 1 }, height: "fill" }, items: [pointsItem(tilePoints, `${id}-points`, sideTreatment(slide), fill, true, pointsStyle)] };
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
    const list = slide.points?.length ? pointsItem(slide.points, `${id}-points`, tone, fill, true, pointsStyle) : null;
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
  } else if (layout === "exhibit-top") {
    // The exhibit across the full width, its commentary in columns beneath it.
    // A wide exhibit - ten categories, a twelve-row table - has no width to
    // give a side column, and three findings read better as three columns than
    // as three stacked paragraphs in a 360px gutter.
    const item = exhibitItem(exhibits[0], `${id}-exhibit`, baseDir, { width: { fr: 1 }, height: "fill" });
    if (String(exhibits[0].type).startsWith("chart.") && item.props?.unit && !item.props.unitPlacement) item.props.unitPlacement = "inline";
    // A point's lead becomes the column's heading only when its sentence can
    // stand without it. Points are often written to run on from the lead ("Core
    // regionals carry the most activity" + "with 54 use cases in ideation"),
    // and hoisting the lead into a heading leaves the column starting mid
    // sentence - so those join back into one paragraph instead.
    const standsAlone = (text) => /^[A-Z0-9"“(]/.test(String(text).trim());
    const columns = slide.points.map((point, at) => {
      const entry = typeof point === "string" ? { text: point } : point;
      const hoist = entry.lead && standsAlone(entry.text);
      const text = hoist ? entry.text : [entry.lead, entry.text].filter(Boolean).join(" ");
      // A lead that stays in the sentence still leads it: it runs in bold, the
      // way the reference pages set the phrase that carries the finding.
      const runs = !hoist && entry.lead
        ? accentRuns(text, [entry.lead], { bold: true, strict: false })
        : null;
      return { id: `${id}-col-${at}`, layout: "flow.column", size: { width: { fr: 1 }, height: "fill" },
        ...(hoist ? { heading: entry.lead } : {}),
        items: [{ id: `${id}-col-${at}-text`, component: "paragraph", props: { text, ...(runs ? { runs } : {}) }, size: HUG }] };
    });
    // The columns share one heading, the way the side column does: without it
    // the page drops straight from the plot into three paragraphs with nothing
    // saying what they are. `pointsHeading: false` suppresses it.
    const belowHeading = slide.pointsHeading === false ? null : slide.pointsHeading || "What it means";
    items.push({ id: `${id}-stack`, layout: "flow.column", size: SIZE, items: [
      headedPanel(exhibits[0], item, `${id}-exhibit`, false),
      { id: `${id}-below`, ...(belowHeading ? { heading: belowHeading } : {}), layout: "flow.row", size: HUG, items: columns },
    ] });
  } else if (layout === "hero-number") {
    // One figure carries the page: the number set large with its explanation,
    // the exhibit beside it as the proof rather than as the subject.
    const kpi = { id: `${id}-kpi`, component: "metric",
      props: { value: slide.kpi.value, label: slide.kpi.label, ...(slide.kpi.sublabel ? { sublabel: slide.kpi.sublabel } : {}), tone: "hero", variant: "prominent" },
      size: { width: { fr: 1 }, height: slide.points?.length ? 150 : "fill" } };
    const sideItems = [kpi];
    if (slide.points?.length) sideItems.push(pointsItem(slide.points, `${id}-points`, sideTreatment(slide), fill, true, pointsStyle));
    const hero = exhibitItem(exhibits[0], `${id}-exhibit`, baseDir, { width: { fr: 2 }, height: "fill" });
    items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: [
      { id: `${id}-side`, layout: "flow.column", size: { width: { fr: 1 }, height: "fill" }, leftover: slide.points?.length ? "distribute" : "center", items: sideItems },
      headedPanel(exhibits[0], hero, `${id}-exhibit`, false),
    ] });
  } else if (layout === "split-tone") {
    // A comparison with two genuine sides: each exhibit on its own ground, the
    // left tinted so the page reads as two halves rather than as evidence and
    // commentary.
    const half = (ex, at) => {
      const panel = exhibitItem(ex, `${id}-exhibit-${at}`, baseDir, { width: { fr: 1 }, height: "fill" });
      return { id: `${id}-half-${at}`, layout: "flow.column", size: { width: { fr: 1 }, height: "fill" },
        ...(at === 0 ? { treatment: "muted" } : {}),
        items: [headedPanel(ex, panel, `${id}-exhibit-${at}`, true)] };
    };
    items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: exhibits.slice(0, 2).map(half) });
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
      const side = { id: `${id}-side`, heading: slide.pointsHeading || "What it means", treatment: sideTreatment(slide), size: { width: { fr: 1 }, height: "fill" }, items: [pointsItem(slide.points, `${id}-points`, sideTreatment(slide), fill, true, pointsStyle)] };
      items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: [stacked, side] });
    } else items.push({ ...stacked, size: SIZE });
  } else if (layout === "grid") {
    // Two rows of two small exhibits, every panel headed.
    const panels = exhibits.slice(0, 4).map((ex, i) => headedPanel(ex, { ...exhibitItem(ex, `${id}-exhibit-${i}`, baseDir), size: SIZE }, `${id}-exhibit-${i}`));
    items.push({ id: `${id}-grid`, layout: "flow.column", size: SIZE, items: [{ id: `${id}-row-a`, layout: "flow.row", size: SIZE, items: panels.slice(0, 2) }, { id: `${id}-row-b`, layout: "flow.row", size: SIZE, items: panels.slice(2, 4) }] });
    if (slide.points?.length) items.push(pointsItem(slide.points, `${id}-points`, sideTreatment(slide), fill, false, pointsStyle));
  } else if (layout === "two-up" || layout === "two-up-contrast") {
    // `two-up-contrast` is the same row with each panel carrying its own
    // caption and no shared column: the page's commentary sits under the panel
    // it belongs to, so neither exhibit is the subject and the other the proof.
    if (layout === "two-up-contrast") for (const ex of exhibits) if (ex.caption === undefined && ex.heading) ex.caption = undefined;
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
    // Captions in a row are measured together and given one height, so the
    // panels above them keep one baseline.
    const captioned = exhibits.filter((ex) => typeof ex.caption === "string" && ex.caption.trim());
    if (captioned.length) {
      // The captions are the page's commentary. A points column under them
      // squeezes the page's own conclusion into whatever is left, so a page
      // captions its panels or carries a list, not both.
      if (slide.points?.length) throw new Error(`${id}: panel captions are the commentary; drop the page's points or the captions`);
      const width = Math.max(160, (BODY_WIDTH - COLUMN_GAP * (exhibits.length - 1)) / exhibits.length);
      const padding = 32;
      const height = Math.max(...captioned.map((ex) => measureText(ex.caption.trim(), width - padding, { fontFamily: "Arial", fontSize: 14, wrapWidthRatio: 1 }).height)) + padding;
      for (const ex of captioned) ex.captionHeight = Math.ceil(height);
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
    if (slide.points?.length) items.push(pointsItem(slide.points, `${id}-points`, sideTreatment(slide), fill, false, pointsStyle));
  } else if (slide.photo && (slide.points?.length || slide.paragraphs?.length)) {
    // Text beside a photograph: the copy takes the left column (a toned panel
    // when `pointsTone` says so), the photo the right, both full height.
    const tone = sideTreatment(slide);
    const copy = [...(slide.paragraphs || []).map((p, i) => ({ id: `${id}-p${i}`, component: "paragraph", props: { text: p }, size: HUG })), ...(slide.points?.length ? [pointsItem(slide.points, `${id}-points`, tone, fill, true, pointsStyle)] : [])];
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
  return { id, title: slide.title, layout: "flow.column", ...(slide.titleLead ? { titleLead: slide.titleLead } : {}), ...(slide.tag ? { tag: slide.tag } : {}), ...(slide.kicker ? { kicker: slide.kicker } : {}), ...(slide.subtitle ? { subtitle: slide.subtitle } : {}), ...(slide.density ? { density: slide.density } : {}), ...(slide.source ? { source: prefixed("Source", slide.source) } : {}), ...(noteLine ? { note: noteLine } : {}), ...(slide.notes ? { notes: slide.notes } : {}), ...(slide.tracker ? { tracker: slide.tracker } : {}), items };
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
  // The contents page and the tracker answer different questions - what the
  // deck covers, and where you are in it - so they are two settings. They used
  // to be one: `sectionTabs` defaulted to `!spec.agenda`, which is why a deck
  // that took the section pills silently had no contents page anywhere.
  const sections = spec.slides.filter((s) => s.kind === "section").length;
  if (spec.tracker !== undefined && !["pills", "repeat-contents", false].includes(spec.tracker)) {
    throw new Error(`Unknown tracker: ${spec.tracker}; use "pills", "repeat-contents" or false`);
  }
  if (spec.contents !== undefined && ![true, false, "once"].includes(spec.contents)) {
    throw new Error(`Unknown contents: ${spec.contents}; use true, "once" or false`);
  }
  // `agenda` is the old spelling of the pair and still resolves to it.
  const trackerMode = spec.tracker ?? (spec.sectionTabs === false ? false : spec.agenda ? "repeat-contents" : "pills");
  const contentsMode = spec.contents ?? (spec.agenda === "once" ? "once" : spec.agenda ? true : sections >= 2);
  const tabs = spec.sectionTabs ?? (trackerMode === "pills" && sections >= 2);
  // `appendix: [...]`: the source pages behind the story - the model grid, the
  // full table, the survey instrument - set at `density: "appendix"` behind an
  // Appendix divider. The corpus keeps its densest pages here, and a page that
  // belongs in the appendix stops crowding the page that carries the argument.
  const appendix = Array.isArray(spec.appendix) && spec.appendix.length
    ? [{ kind: "section", title: "Appendix", summary: "The workings behind the story" },
       ...spec.appendix.map((page) => ({ density: "appendix", ...page }))]
    : [];
  const storySlides = appendix.length ? [...spec.slides, ...appendix] : spec.slides;
  // The contents page leads the deck; `repeat-contents` also reprints it in
  // front of every later section, which is the other way a deck tracks.
  const agendaMode = trackerMode === "repeat-contents" ? true : contentsMode === "once" || contentsMode === true ? "once" : false;
  const pages = agendaPages(tabs ? sectionTabs(storySlides) : storySlides, contentsMode === false ? false : agendaMode, spec.agendaStyle);
  const bodyScale = spec.chrome ? Math.max(0.4, Math.min(1.2, ((spec.chrome.footerTop ?? 684) - 36 - (spec.chrome.bodyTop ?? 140)) / 508)) : 1;
  const fill = resolveFill(spec);
  // The weight contract: what a page of this deck is expected to carry. The
  // deck's own `weight` wins, then the house profile a template produced, then
  // the fill level.
  const weight = resolveWeight(spec, fill);
  // The shapes the last few analytical pages took, most recent first: the
  // chooser breaks a tie on variety, so a section spreads across its repertoire
  // instead of repeating whichever shape fitted first.
  const recent = [], recentStyles = [];
  for (const page of pages.flatMap(splitTables).flatMap((p) => paginateTable(p, bodyScale))) {
    slides.push(composeSlide(page, slides.length, baseDir, fill, weight.elements, recent, recentStyles));
    recent.splice(4);
    recentStyles.splice(3);
  }
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

/**
 * The page budget, read from the spec before anything is laid out.
 *
 * A gate that fires on a rendered page tells the author their page is thin; it
 * cannot tell them what to do about it, because by then the data is a scene. At
 * plan time the data is still data, so the budget can name the remedy: this
 * chart carries five of the nine categories you supplied, this table has no
 * derived column, this page carries one evidence element where the deck's
 * weight asks for two.
 *
 * Returns findings in the page-gates shape, so preflight prints them beside the
 * story gates. `THIN_PLAN` is the estimate; `THIN_PAGE` remains the measurement.
 */
const PLAN_WORD = (value) => (typeof value === "string" ? value.trim().split(/\s+/).filter(Boolean).length : 0);

function planWords(slide) {
  let words = 0;
  const text = (value) => { words += PLAN_WORD(value); };
  const point = (item) => { if (typeof item === "string") text(item); else if (item && typeof item === "object") { text(item.lead); text(item.text); } };
  (slide.points || []).forEach(point);
  (Array.isArray(slide.insights) ? slide.insights : slide.insight ? [slide.insight] : []).forEach((entry) => { if (typeof entry === "string") text(entry); else if (entry) { text(entry.heading); text(entry.text); } });
  text(slide.soWhat);
  text(slide.subtitle);
  if (slide.callout) { text(typeof slide.callout === "string" ? slide.callout : `${slide.callout.lead || ""} ${slide.callout.text || ""}`); }
  if (slide.kpi) { text(slide.kpi.value); text(slide.kpi.label); text(slide.kpi.sublabel); }
  (slide.metrics || []).forEach((metric) => { text(metric.value); text(metric.label); text(metric.sublabel); text(metric.delta); });
  const rowsOf = (rows) => (rows || []).forEach((row) => {
    if (Array.isArray(row)) { row.forEach((cell) => text(typeof cell === "string" ? cell : cell?.text ?? cell?.value)); return; }
    text(row.label);
    text(row.text);
    (row.points || []).forEach(point);
    (row.cells || []).forEach((cell) => {
      if (typeof cell === "string") { text(cell); return; }
      if (Array.isArray(cell)) { cell.forEach(point); return; }
      if (!cell) return;
      text(cell.text); text(cell.lead);
      (cell.points || cell.items || []).forEach(point);
    });
  });
  rowsOf(slide.rows);
  (slide.columns || []).forEach((column) => text(typeof column === "string" ? column : column?.label));
  for (const exhibit of [slide.exhibit, ...(slide.exhibits || [])].filter(Boolean)) {
    text(exhibit.heading); text(exhibit.panelHeading); text(exhibit.unit);
    (exhibit.categories || []).forEach(text);
    (exhibit.categoryNotes || []).forEach(text);
    (exhibit.series || []).forEach((series) => { text(series.name); words += (series.values || []).length; });
    (exhibit.columns || []).forEach((column) => { if (typeof column === "string") text(column); else if (column) { text(column.label); text(column.unit); text(column.group); } });
    rowsOf(exhibit.rows);
    (exhibit.items || []).forEach((item) => { if (typeof item === "string") text(item); else if (item) { text(item.label); text(item.text); text(item.detail); text(item.title); (item.points || []).forEach(point); } });
    (exhibit.annotations || []).forEach((annotation) => text(annotation?.text));
    (exhibit.periods || []).forEach((period) => text(period?.label));
    (exhibit.events || []).forEach((event) => text(event?.label));
  }
  return words;
}

/** What this page could carry, given the data it already holds. */
function planRemedies(slide, elements) {
  const out = [];
  const exhibits = [slide.exhibit, ...(slide.exhibits || [])].filter(Boolean);
  const hero = exhibits[0];
  const points = slide.points || [];
  if (!slide.subtitle) out.push("name the measure, the population and the period in a `subtitle`");
  if (hero && String(hero.type || "").startsWith("chart.")) {
    const categories = (hero.categories || []).length;
    const series = (hero.series || []).length;
    if (categories && categories < 8) out.push(`the page holds a dozen categories and the chart shows ${categories}: show the rest, or the second cut of the same measure`);
    if (series === 1 && hero.dataTable === undefined) out.push("tabulate the series under the chart (`dataTable: true`)");
    if (!hero.categoryNotes) out.push("name the base under each category (`categoryNotes: [\"n=412\", …]`)");
    if (!hero.annotations && !hero.periods && !hero.events && hero.change === undefined && !hero.cagr) out.push("annotate the chart: bracket the periods, flag the event, or carry the change");
  }
  const tableLike = exhibits.find((exhibit) => exhibit.type === "table" || exhibit.type === "rows");
  if (tableLike) {
    const rows = (tableLike.rows || []).length;
    if (rows && rows < 8) out.push(`the page holds around fourteen rows and the table shows ${rows}: show the rows behind the summary`);
    if (tableLike.type === "table" && !tableLike.derive) out.push("add a derived column (`derive: [\"share\", \"rank\", \"change\"]`) - the numbers are already in the table");
  }
  if (points.length && points.length < 5) out.push(`carry five or six points in the column, not ${points.length}`);
  if (exhibits.length < elements) out.push(`the deck's weight asks for ${elements} evidence elements and the page carries ${exhibits.length}`);
  return out;
}

export function budgetFindings(spec) {
  if (!isV3(spec) || !Array.isArray(spec.slides)) return [];
  const weight = resolveWeight(spec, resolveFill(spec));
  const floor = weight.pageWords || 0;
  if (floor <= 0) return [];
  const out = [];
  spec.slides.forEach((slide, index) => {
    if (slide.kind && slide.kind !== "content") return;                 // covers, dividers, statements, takeaways
    if (!slide.title) return;
    const estimate = planWords(slide);
    if (estimate >= floor) return;
    const remedies = planRemedies(slide, weight.elements || 1);
    out.push({
      slide: index + 1, code: "THIN_PLAN", measured: estimate, threshold: floor,
      repair: `This page plans to carry about ${estimate} words of body text against a floor of ${floor}. From this page's own data: ${remedies.slice(0, 3).join("; ") || "deepen the evidence"}.`,
    });
  });
  return out;
}
