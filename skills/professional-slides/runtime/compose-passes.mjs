// The composer's rewrite passes over a slide, in the order they run
// (`SLIDE_PASSES`): the page's highlight pushed down to the text that says
// it, the precision its copy quotes handed to its charts, footnotes marked,
// paired bars split, the chart defaults read from the title and data
// (compose-charts.mjs), and the four heavy-page shapes (`SHAPES`) applied.
import { hasPhrase, measureText } from "./text-layout.mjs";
import { figuresWithDecimals, formatValue } from "./value-format.mjs";
import { formatTableValue } from "./compose-tables.mjs";
import { TABLE_ALIGNED, SIDEWAYS_CATEGORIES, percentStack, focusFromTitle, decisiveFromTitle, changeFromContent, pairedBars } from "./compose-charts.mjs";

/**
 * `footnotes: [{ on, text }]`: the page's numbered notes. Each one prints a
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

/**
 * The four heavy-page shapes, named.
 *
 * SKILL.md describes the shapes a strong deck's dense pages take; a `shape`
 * on the slide is the author saying "this is that page", and the preset sets
 * the weight and the defaults that shape needs. Everything a preset sets, the
 * slide can override, because the shape is a starting point and not a mould.
 *
 * No preset sets the page's density. The deck's density is its one body size:
 * a preset that set its pages at the pre-read size would set the executive
 * summary's points at 11pt beside 12pt on every other page. A heavy page fits
 * by its layout - its columns, its rows, its split - not by shrinking its type.
 */
const SHAPES = {
  // Findings down the left, columns of short bulleted evidence across.
  "findings-matrix": (slide) => {
    if (!Array.isArray(slide.rows) && !(slide.exhibit && slide.exhibit.type === "rows")) {
      throw new Error("A findings-matrix page is built from `rows`, each with `cells`");
    }
    return { implication: slide.implication ?? false };
  },
  // Ten to fifteen rows, measures under grouped headers, footnote markers.
  "measure-table": (slide) => {
    const ex = slide.exhibit;
    if (!ex || !["table", "rows", "compare"].includes(ex.type)) throw new Error("A measure-table page needs a table exhibit");
    return { exhibit: { density: ex.density ?? "compact", total: ex.total ?? "auto", ...ex } };
  },
  // The assumptions grid behind a forecast: the chart over its own numbers.
  "model-page": (slide) => {
    const ex = slide.exhibit;
    if (!ex || !String(ex.type).startsWith("chart.")) throw new Error("A model-page is a chart over its own data table");
    return { exhibit: { ...ex, dataTable: ex.dataTable ?? true } };
  },
  // The page that states the answer: the measures across the top, the findings
  // that carry them as a numbered ledger, the close underneath.
  "executive-summary": (slide) => {
    const findings = slide.points || slide.rows;
    // Up to seven: an executive summary is the densest text page in the
    // deck, four to six developed statements of about sixty words with their
    // parts as sub-points (a strong one runs to 245 words a page), not three
    // bullets and an insight box.
    if (!Array.isArray(findings) || findings.length < 2 || findings.length > 7) {
      throw new Error("An executive summary carries two to seven findings in `points`");
    }
    return {
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
    return { layout: slide.layout ?? "exhibit-left" };
  },
};

export const SHAPE_NAMES = Object.freeze(Object.keys(SHAPES));

/**
 * The page's own highlight, pushed down to whatever carries the page's prose.
 *
 * The content stage records exactly one highlight per page - "the phrase the
 * reader should see first" - and strong decks emphasise a phrase on half their
 * pages, and on seven pages of type in ten (DECK_CRAFT). So a page-level
 * `highlight` is given to every point and every table cell whose text actually
 * contains it, and to none that do not - the phrase is emphasised where it is
 * said, not asserted where it is absent.
 */
function highlightThePhrase(slide) {
  const declared = slide.highlight;
  if (declared === undefined || declared === null) return slide;
  const phrases = (Array.isArray(declared) ? declared : [declared])
    .map((p) => String(p ?? "").trim()).filter(Boolean);
  if (!phrases.length) return slide;
  // As whole words and regardless of case, the rule accentRuns sets them by:
  // "22" offered to "FY22" would be accepted here and lit as half a year.
  const inside = (text) => phrases.filter((p) => hasPhrase(text, p, { ignoreCase: true }));
  // The phrase stays on the slide: `soWhat` and the insight boxes are built
  // later, from the slide, and they set it in the accent too.
  const next = { ...slide };

  const markPoints = (points) => points.map((point) => {
    if (typeof point === "string") {
      const found = inside(point);
      return found.length ? { text: point, highlight: found } : point;
    }
    if (!point || typeof point !== "object" || point.highlight !== undefined) return point;
    const found = inside(`${point.lead ?? ""} ${point.text ?? ""}`);
    return found.length ? { ...point, highlight: found } : point;
  });
  if (Array.isArray(slide.points)) next.points = markPoints(slide.points);
  // A labelled-rows page says its findings in each row's bullets.
  if (Array.isArray(slide.blocks)) next.blocks = slide.blocks.map((block) => (Array.isArray(block?.points) ? { ...block, points: markPoints(block.points) } : block));
  // A table says it in a cell: the cell's own `highlight` is the accent phrase,
  // which `exhibitItem` already knows how to read.
  const markTable = (ex) => {
    if (!ex || typeof ex !== "object" || !Array.isArray(ex.rows)) return ex;
    let touched = false;
    // A list in a cell is a bulleted cell only where the exhibit reads one.
    const lists = ex.type === "rows" || ex.type === "phase-table";
    const rows = ex.rows.map((row) => {
      const cells = Array.isArray(row) ? row : row?.cells;
      if (!Array.isArray(cells)) return row;
      const next = markCells(cells, lists);
      if (next === cells) return row;
      touched = true;
      return Array.isArray(row) ? next : { ...row, cells: next };
    });
    return touched ? { ...ex, rows } : ex;
  };
  // Every other place the page's prose is drawn takes the phrase too: the
  // executive summary's points below its table, a rail, the two columns of a
  // comparison, the bulleted cells of a findings matrix and a panel's caption.
  const markCells = (cells, lists = true) => {
    let touched = false;
    const marked = cells.map((cell) => {
      if ((cell && typeof cell === "object" && !Array.isArray(cell) && cell.highlight !== undefined) || (Array.isArray(cell) && !lists)) return cell;
      // A bulleted cell is a list of strings; its phrase is found in any of them.
      const found = Array.isArray(cell) ? cell.flatMap((item) => (typeof item === "string" ? inside(item) : []))
        : typeof cell === "string" ? inside(cell)
          // A table's own bulleted cell lists its lines as `items`.
          : [cell?.lead, cell?.text, ...[cell?.points, cell?.items].flatMap((list) => (Array.isArray(list) ? list : []))].filter((t) => typeof t === "string").flatMap(inside);
      if (!found.length) return cell;
      touched = true;
      const unique = [...new Set(found)];
      return Array.isArray(cell) ? { points: cell, highlight: unique } : typeof cell === "string" ? { text: cell, highlight: unique } : { ...cell, highlight: unique };
    });
    return touched ? marked : cells;
  };
  const markExhibit = (exIn) => {
    let ex = markTable(exIn);
    if (!ex || typeof ex !== "object") return ex;
    if (ex.type === "compare") {
      const side = (column) => {
        if (!column || typeof column !== "object") return column;
        if (Array.isArray(column.points)) { const points = markCells(column.points); return points === column.points ? column : { ...column, points }; }
        if (typeof column.text === "string") { const [text] = markCells([column.text]); return text === column.text ? column : { ...column, text: undefined, points: [text] }; }
        return column;
      };
      ex = { ...ex, left: side(ex.left), right: side(ex.right) };
    }
    if (typeof ex.caption === "string") { const found = inside(ex.caption); if (found.length) ex = { ...ex, captionHighlight: found }; }
    return ex;
  };
  if (next.exhibit) next.exhibit = markExhibit(next.exhibit);
  if (Array.isArray(next.exhibits)) next.exhibits = next.exhibits.map(markExhibit);
  // A findings matrix carries its rows on the page, not in an exhibit.
  if (Array.isArray(next.rows)) next.rows = next.rows.map((row) => (Array.isArray(row?.cells) ? { ...row, cells: markCells(row.cells) } : row));
  if (next.panel && typeof next.panel.text === "string") { const found = inside(next.panel.text); if (found.length) next.panel = { ...next.panel, highlight: found }; }
  return next;
}

/**
 * Each chart on the page is handed the figures its copy writes with decimals,
 * so a label prints a value to the precision the page quotes it
 * (value-format.mjs quotedDecimals), and a page that says 11.6 does not sit
 * over a bar that says 12.
 */
function quotedPrecision(slide) {
  const texts = [];
  const add = (value) => { if (typeof value === "string" || typeof value === "number") texts.push(String(value)); };
  const point = (p) => { if (typeof p === "string") add(p); else if (p && typeof p === "object") { add(p.lead); add(p.text); (p.points || []).forEach(add); } };
  const tile = (m) => { if (m && typeof m === "object") { add(m.value); add(m.label); add(m.sublabel); add(m.delta); } else add(m); };
  add(slide.title); add(slide.subtitle); add(slide.panel?.text); add(typeof slide.soWhat === "string" ? slide.soWhat : slide.soWhat?.text);
  (slide.points || []).forEach(point); (slide.paragraphs || []).forEach(point); (slide.metrics || []).forEach(tile); tile(slide.kpi);
  (slide.blocks || []).forEach((block) => { (block?.points || []).forEach(point); tile(block?.metric); });
  const exhibits = [slide.exhibit, ...(slide.exhibits || []), ...(slide.blocks || []).map((block) => block?.exhibit)].filter((ex) => ex && typeof ex === "object");
  for (const ex of exhibits) add(ex.caption);
  const quotedFigures = figuresWithDecimals(texts);
  if (!quotedFigures.length) return slide;
  const hand = (ex) => {
    if (!ex || typeof ex !== "object") return ex;
    if (ex.type === "chart-group") return { ...ex, charts: (ex.charts || []).map((c) => (c && typeof c === "object" ? { ...c, props: { ...(c.props || {}), quotedFigures } } : c)) };
    return String(ex.type ?? "").startsWith("chart.") ? { ...ex, quotedFigures } : ex;
  };
  return { ...slide, ...(slide.exhibit ? { exhibit: hand(slide.exhibit) } : {}), ...(slide.exhibits ? { exhibits: slide.exhibits.map(hand) } : {}),
    ...(slide.blocks ? { blocks: slide.blocks.map((block) => (block?.exhibit ? { ...block, exhibit: hand(block.exhibit) } : block)) } : {}) };
}

/**
 * The composer's rewrite passes, in the order they run.
 *
 * Each pass reads the slide the last one produced and returns the slide the
 * next one sees, so the order is the pipeline and the names are what it does.
 * The context provides the slide identifier, asset directory and density.
 */
export const SLIDE_PASSES = [
  ["highlight-the-phrase", (slide) => highlightThePhrase(slide)],
  ["quoted-precision", (slide) => quotedPrecision(slide)],
  ["footnotes", (slide) => applyFootnotes(slide)],
  ["paired-bars", (slide) => pairedBars(slide)],

  // Normalize an authored percent stack or explicitly requested change annotation.
  ["read-the-data", (slide) => {
    const derive = (ex) => decisiveFromTitle(focusFromTitle(changeFromContent(percentStack(ex), slide.title), slide.title), slide.title);
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

  // `split: true` on a multi-series chart sets it as small multiples: one
  // panel per series, each headed by the series name, sharing one value scale
  // and one category axis. A legend and twelve marks becomes three headings
  // and twelve labelled marks - the well-made way of showing three cuts of
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

  // An explicitly requested data table prints exact series values beneath the chart.
  ["build-the-data-table", (slide) => {
    if (!(slide.exhibit && slide.exhibit.dataTable === true && Array.isArray(slide.exhibit.series) && !slide.exhibits)) return slide;
    // The table prints each value as the chart's labels do, to one precision.
    return { ...slide, exhibit: { ...slide.exhibit, dataTable: slide.exhibit.series.map((series) => ({ label: series.name, values: (series.values || []).map((value) => (typeof value === "number" && Number.isFinite(value) ? formatValue(value, slide.exhibit) : formatTableValue(value))) })) } };
  }],

  // The chart stacks over a compact table whose columns are its categories.
  // A chart that can set its categories over those columns (TABLE_ALIGNED;
  // chart-axes.mjs tableSpan) does: the label column is measured from the row
  // names and fixed, the value columns share the rest equally, and the plot is
  // inset to match, so each figure sits under its own bar or point. The table
  // then carries the values, so the chart prints none of its own - the same
  // figure on the bar and again under it - and needs no value axis to read
  // them off. An author who asks for both (`dataLabels: true`) is refused.
  ["stack-the-data-table", (slide) => {
    if (!(slide.exhibit && Array.isArray(slide.exhibit.dataTable) && slide.exhibit.dataTable.length && !slide.exhibits)) return slide;
    if (SIDEWAYS_CATEGORIES.has(String(slide.exhibit.type))) {
      const { dataTable: _drop, ...exhibit } = slide.exhibit;
      return { ...slide, exhibit };
    }
    const chart = { ...slide.exhibit }; const rowsIn = chart.dataTable; delete chart.dataTable;
    const aligned = TABLE_ALIGNED.has(String(chart.type));
    if (aligned && chart.dataLabels === true)
      throw new Error(`${slide.id ?? "A chart"}: the data table under the chart prints every value, and \`dataLabels: true\` prints each one again on its mark - drop \`dataLabels\` (the table carries the figures) or drop the table`);
    // The label column holds the longest row name in the table's bold label type.
    const label = aligned ? Math.max(96, ...rowsIn.map((r) => Math.ceil(measureText(String(r.label ?? ""), 4000, { fontFamily: "Arial", fontSize: 12, bold: true }).width) + 32)) : 0;
    if (aligned) Object.assign(chart, { categoryColumns: { label },
      // Stack totals are the stack's own figure, which the table does not print.
      ...(chart.stackTotals || chart.secondaryLabels ? {} : { dataLabels: false }),
      ...(chart.showValueAxis === undefined && chart.gridlines !== true && chart.type !== "chart.waffle" ? { showValueAxis: false } : {}),
      // Lines keep their names in a legend: the table's columns run to the
      // plot's edge, leaving no gutter for names at the line ends.
      ...(["chart.line", "chart.area"].includes(chart.type) && chart.endLabels === undefined && chart.directLabels === undefined ? { endLabels: false } : {}) });
    // `chartData`: the table is the chart's own figures, printed under it -
    // part of the chart, which the treated-table share does not count
    // (build-bars.mjs chartDataTable).
    const table = { type: "table", chartData: true, density: "compact", treatment: "open", variant: "plain",
      columns: [{ label: "", type: "text", bold: true, width: aligned ? { px: label } : 120 }, ...(chart.categories || []).map(() => ({ label: "", type: "text", align: "center", width: aligned ? 1 : 80 }))],
      rows: rowsIn.map((r) => [r.label, ...(r.values || []).map(String)]) };
    return { ...slide, exhibit: undefined, exhibits: [chart, table], arrange: "stack", stackWeights: [4, 1] };
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
];

/** The pass names, in order - what the composer does to a slide and when. */
export const PASS_NAMES = Object.freeze(SLIDE_PASSES.map(([name]) => name));
