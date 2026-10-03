// An exhibit as a layout-tree item (`exhibitItem`): the aliases an author can
// write for a component ("table", "image", "metrics", "rows", ...) resolved,
// media references read, a table styled, and a panel given its heading where
// the component does not draw its own (`headedPanel`).
import { measureText } from "./text-layout.mjs";
import { SIZE, HUG } from "./compose-body.mjs";
import { imageProps, resolveMediaRefs } from "./compose-pictures.mjs";
import { styleTable } from "./compose-tables.mjs";

/** Aliases that resolve to a table: compare (two headed columns), phase-table (chevron header, row labels), rows (label + text). */
function tableAlias(ex) {
  if (ex.type === "compare") {
    const left = ex.left || {}, right = ex.right || {};
    const l = left.points || (left.text ? [left.text] : []), r = right.points || (right.text ? [right.text] : []);
    const n = Math.max(l.length, r.length);
    const rows = Array.from({ length: n }, (_, i) => [l[i] ?? "", r[i] ?? ""].map((cell) => (typeof cell === "string" && !cell.trim() ? { blank: true } : cell)));
    // The tinted column is the one the page decides for. Before/after pages
    // decide for "after", which is the default; a comparison of two options
    // names its side with `winner` ("left", "right" or a heading), and
    // `winner: false` leaves both columns plain when the page splits the verdict.
    const headings = [left.heading || "Before", right.heading || "After"];
    let highlightColumn;
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
    const rows = (ex.rows || []).map((row) => [{ type: "category", text: row.label }, ...phases.map((_, i) => { const cell = (row.cells || [])[i]; return Array.isArray(cell) ? { type: "bullets", items: cell }
      // A bulleted cell the page's highlight marked arrives as { points, highlight };
      // the table reads the phrase as the cell's accent (tables.mjs normalize).
      : cell && typeof cell === "object" && Array.isArray(cell.points) ? { type: "bullets", items: cell.points, highlight: cell.highlight } : cell ?? " "; })]);
    const labelWidth = Math.max(110, ...(ex.rows || []).map((row) => Math.ceil(measureText(String(row.label || ""), 400, { fontFamily: "Arial", fontSize: 14, bold: true }).width) + 32));
    return { type: "table", treatment: "dimensions", variant: "standard", headerShape: ex.headerShape ?? "chevron", columns: [{ label: "", type: "category", width: labelWidth }, ...phases.map((ph) => ({ label: typeof ph === "string" ? ph : ph.label, type: "text", width: 200 }))], rows, density: ex.density };
  }
  if (ex.type === "rows") {
    // A row may carry several content columns (`cells`), which is a strong
    // deck's densest page: findings down the left with a numbered disc and an
    // icon, two or three columns across, each cell a short bulleted list under
    // a bold lead. Four hundred words of structured evidence, no chart.
    if ((ex.rows || []).some((row) => Array.isArray(row.cells))) {
      const rowsIn = ex.rows;
      const count = Math.max(...rowsIn.map((row) => (row.cells || []).length));
      if (!(count >= 1 && count <= 3)) throw new Error("A row matrix carries one to three content columns per row");
      const labels = (Array.isArray(ex.columns) ? ex.columns : []).map((column) => String(typeof column === "string" ? column : column?.label || ""));
      // A header naming a declared player carries its mark (page-types.mjs
      // markPlayerCells), drawn beside the label as a table's is.
      const marks = (Array.isArray(ex.columns) ? ex.columns : []).map((column) => (column && typeof column === "object" ? column.logo : undefined));
      // `columns` heads the label column first, then the content columns; a
      // list as long as the content columns heads those alone.
      const headLabel = labels.length > count ? labels[0] : "";
      const headContent = labels.length > count ? labels.slice(1) : labels;
      const headMarks = labels.length > count ? marks.slice(1) : marks;
      const cellOf = (value) => {
        if (value === undefined || value === null) return { type: "text", text: " " };
        if (Array.isArray(value)) return { type: "bullets", items: value };
        if (typeof value === "string") return { type: "text", text: value };
        // A `highlight` phrase rides along in `rest`: the table reads it as
        // the cell's accent (tables.mjs normalize).
        const { lead, points, text, ...rest } = value;
        if (Array.isArray(points) && points.length) return { type: "bullets", items: points, ...(lead ? { lead } : {}), ...rest };
        if (typeof text === "string" && text.trim()) return { type: "text", text: lead ? `${lead}. ${text}` : text, ...rest };
        if (typeof lead === "string" && lead.trim()) return { type: "text", text: lead, bold: true, ...rest };
        throw new Error("A row matrix cell needs text or points");
      };
      const numbered = ex.numbered === true;
      // `style: "accented"` on a row is the finding the argument turns on -
      // today's position among the outcomes, the subject among its peers -
      // banded in the accent tint as a table's `highlightRow` is.
      if (rowsIn.some((row) => row.style !== undefined && row.style !== "accented"))
        throw new Error("A row matrix row's `style` is \"accented\", the row the argument turns on");
      const rows = rowsIn.map((row, index) => {
        const cells = [
          { type: "category", text: String(row.label ?? ""), surface: "plain",
            ...(numbered || row.number !== undefined ? { sectionNumber: row.number ?? index + 1 } : {}),
            ...(row.icon ? { icon: row.icon } : {}) },
          ...Array.from({ length: count }, (_, at) => cellOf((row.cells || [])[at]))
        ];
        return row.style === "accented" ? { style: "accented", cells } : cells;
      });
      return { type: "table", treatment: "categories", variant: "plain", density: ex.density || "compact",
        columns: [{ label: headLabel, type: "category", width: 220 },
                  ...Array.from({ length: count }, (_, at) => ({ label: headContent[at] || "", type: "text", width: 420, ...(headMarks[at] ? { logo: headMarks[at] } : {}) }))],
        rows };
    }
    const rows = (ex.rows || []).map((row) => [{ type: "category", text: row.label, ...(row.number ? { sectionNumber: row.number } : {}), ...(row.icon ? { icon: row.icon } : {}) }, Array.isArray(row.points) ? { type: "bullets", items: row.points } : row.text]);
    // `columns: ["What we found", "What it means"]` heads the two tracks. A
    // well-made ledger labels them; an unlabelled ledger keeps the blank band.
    const labels = Array.isArray(ex.columns) ? ex.columns.map((column) => String(typeof column === "string" ? column : column?.label || "")) : [];
    return { type: "table", treatment: "categories", variant: "standard", columns: [{ label: labels[0] || "", type: "category", width: 200 }, { label: labels[1] || "", type: "text", width: 800 }], rows, density: ex.density };
  }
  return ex;
}

/** Components whose render is the table renderer, reached by their own id. */
const TABLE_RENDERERS = ["trend-rows", "comparison-table", "heatmap"];

export function exhibitItem(exIn, id, baseDir, size = SIZE) {
  exIn = resolveMediaRefs(exIn, baseDir);
  // A `compare` whose sides name an `image` sets the two pictures above the two
  // columns, aligned to them. A comparison of two named things - two
  // characters, two cities, two products - is a page the reader should be able
  // to tell apart before reading a word, and a strong deck leads with the
  // picture. The images share one height so the columns beneath them start
  // level, and the exhibit is unchanged underneath: this is furniture above a
  // comparison, not a different exhibit.
  if (exIn && exIn.type === "compare" && (exIn.left?.image || exIn.right?.image)) {
    const { left = {}, right = {}, imageHeight, ...restOfCompare } = exIn;
    const strip = (side, key) => (side.image
      ? { id: `${id}-${key}-image`, component: "image-frame", props: { ...imageProps(side.image, baseDir), fit: "cover" }, size: { width: { fr: 1 }, height: "fill" } }
      : { id: `${id}-${key}-image`, layout: "flow.column", size: { width: { fr: 1 }, height: "fill" }, items: [] });
    const bare = { ...restOfCompare, left: { ...left, image: undefined }, right: { ...right, image: undefined } };
    return { id: `${id}-pictured`, layout: "flow.column", gap: "space.3", size, items: [
      { id: `${id}-images`, layout: "flow.row", gap: "space.3", size: { width: { fr: 1 }, height: imageHeight ?? 180 },
        items: [strip(left, "left"), strip(right, "right")] },
      exhibitItem(bare, id, baseDir, { width: { fr: 1 }, height: "fill" }),
    ] };
  }
  // `caption`: the finding under this panel. In a two-up or a grid a
  // well-made page captions every panel rather than closing with one shared
  // so-what, because each panel answers its own question.
  if (exIn && typeof exIn.caption === "string" && exIn.caption.trim()) {
    const { caption, captionHeight, captionHighlight, ...rest } = exIn;
    const panel = exhibitItem(rest, id, baseDir, { width: { fr: 1 }, height: "fill" });
    // The caption is the panel's finding in compact type, left-aligned under
    // it at the panel's width, with no surface: set as a centred bold box it
    // is the loudest thing on the page after the title. The statement box is
    // the page's takeaway alone. Peers share one caption height, so the plots
    // above them keep one baseline.
    return { id: `${id}-captioned`, layout: "flow.column", gap: "space.3", size,
      items: [panel, { id: `${id}-caption`, component: "paragraph", props: { text: caption.trim(), variant: "caption", maxMeasure: false, ...(captionHighlight ? { highlight: captionHighlight } : {}) },
        size: captionHeight ? { width: { fr: 1 }, height: captionHeight } : HUG }] };
  }
  const typeStep = exIn?._typeStep === true && size.height === "fill";
  const ex = tableAlias(exIn);
  const { type, layout: _l, _typeStep: _t, _densityChosen: _d, ...rest } = ex;
  if (type === "image") return { id, component: "image-frame", props: { ...imageProps(ex.path ? ex : ex.image, baseDir), ...(ex.fit ? { fit: ex.fit } : {}) }, size };
  if (type === "cards" || type === "quadrants") {
    const { centre, ...sz } = size;
    // `columns: n` wraps the cards into rows of n - the grid variant of the
    // same set. A list of five named things has three shapes, not one: down the
    // page as an icon list, across the page as a row of cards, or as a grid
    // when there are more of them than a row can hold at a readable width. The
    // rows are separate `cards` components stacked, so each row keeps the
    // shared heading band and one baseline, which is what makes a grid read as
    // a grid rather than as two unrelated rows.
    const perRow = Number.isInteger(rest.columns) ? rest.columns : 0;
    const items = rest.items || [];
    if (type === "cards" && perRow >= 2 && items.length > perRow) {
      // Even rows, not a remainder. Four cards at three across as a row of
      // three and a row of one leave a lone card, which the card renderer
      // refuses because one card in a row is not a row. Four across two rows
      // is two and two.
      const rowCount = Math.ceil(items.length / perRow);
      const base = Math.floor(items.length / rowCount), over = items.length % rowCount;
      const rows = [];
      for (let at = 0, r = 0; r < rowCount; r += 1) { const take = base + (r < over ? 1 : 0); rows.push(items.slice(at, at + take)); at += take; }
      const { columns: _c, ...cardProps } = rest;
      // Open rows form one measured group. Centring each row in an equal
      // fraction of the page creates an empty band between related content.
      const open = ["plain", "columns"].includes(rest.tone);
      return { id, layout: "flow.column", gap: "space.4", ...(open ? { leftover: "center" } : {}), size: sz, items: rows.map((row, r) => ({
        id: `${id}-row-${r}`, component: "cards",
        props: { ...cardProps, items: row, ...(centre ? { valign: "middle" } : {}) },
        size: { width: { fr: 1 }, height: open ? "hug" : "fill" },
      })) };
    }
    return { id, component: type, props: { ...rest, ...(centre ? { valign: "middle" } : {}) }, size: sz };
  }
  if (type === "swot") return { id, component: "quadrants", props: { quadrants: ["Strengths", "Weaknesses", "Opportunities", "Threats"].map((title, i) => ({ title, points: [rest.strengths, rest.weaknesses, rest.opportunities, rest.threats][i] || [] })) }, size };
  if (type === "table") {
    const styled = styleTable(rest);
    return { id, component: "table", props: { ...styled, density: rest.density || "body", fillHeight: size.height === "fill", ...(rest.chartData ? { chartData: true } : {}), ...(typeStep ? { typeStep: true } : {}), ...(rest.rowSpacing ? { rowSpacing: rest.rowSpacing } : {}), ...(rest.headerShape ? { headerShape: rest.headerShape } : {}) }, size };
  }
  // The other table renderers reach the page by their component id rather than
  // through the `table` alias, and keep the one thing the alias does for
  // them: a table in a full-height frame spreads its rows down the frame
  // instead of hugging the top and leaving the page empty under it.
  if (TABLE_RENDERERS.includes(type)) {
    return { id, component: type, props: { ...rest, fillHeight: size.height === "fill" }, size };
  }
  // A metrics exhibit: one row up to four tiles, a grid of equal rows beyond
  // (an "Impact to date" 3x3 of navy tiles, say). `tone` sets every tile.
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
    // A scatter carries its series on its points, not in a series list, so
    // they are counted there: dots coloured three ways need a key.
    const pointSeries = ["chart.scatter", "chart.bubble"].includes(type) && Array.isArray(rest.points)
      ? new Set(rest.points.map((point) => point?.series).filter((name) => typeof name === "string" && name.trim())).size : 0;
    const multi = (Array.isArray(rest.series) && rest.series.length > 1) || pointSeries > 1;
    // Lines carry their series name at the end of the line instead of a legend,
    // and no per-point labels when there is more than one series.
    const line = type === "chart.line" || type === "chart.area";
    // A pie or donut has no series list, so `multi` is false, and a false
    // legend default reads to a part-to-whole chart as "the legend is shared
    // with a neighbour" and draws none. Its categories are its labels, so it
    // keeps its legend unless the author places them otherwise.
    const partToWhole = type === "chart.pie" || type === "chart.donut";
    // A pie or donut names its slices at the rim, where the eye already is,
    // rather than in a stacked key above a circle centred in the frame. An
    // author's legend or variant is kept.
    const rimLabels = partToWhole && rest.legend === undefined && rest.variant === undefined && rest.outsideLabels === undefined;
    // Connected scatter series carry their names at their ends (chart-scatter-pie.mjs).
    const namedEnds = pointSeries > 1 && rest.connect === true;
    const props = { dataLabels: !(line && multi), ...(partToWhole ? {} : { legend: multi && !line && !namedEnds }), ...(rimLabels ? { variant: "outside-labels" } : {}), ...(line && multi ? { endLabels: true } : {}), highlights: [], annotations: [], referenceLines: [], ...rest };
    // Switching off the default endpoint labels must retain series identity.
    if (line && multi && !props.endLabels && props.directLabels !== "end" && rest.legend === undefined) props.legend = true;
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
export const DIAGRAM_TYPES = ["cards", "quadrants", "swot", "metrics", "cycle", "steps", "people", "logos", "framework", "relationship-network", "map", "process", "chevron-process", "timeline", "roadmap", "tree", "organization", "funnel", "matrix", "journey", "image"];
/** A diagram carries no heading band unless the author gives it one; its side column then starts at the diagram's top. */
function unheaded(ex) { return DIAGRAM_TYPES.includes(ex.type) && !ex.panelHeading; }
export function headedPanel(ex, item, id, align = true) {
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
