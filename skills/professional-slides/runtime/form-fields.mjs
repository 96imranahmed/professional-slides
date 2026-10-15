// What each page form reads, field by field (author-deck.mjs --schema <type>/<form>, --schema kinds).
//
// `--schema <type>` is the JSON Schema of a page's own keys, and an exhibit was
// in it as `{ type: "object" }`: what a chart, a timeline or a table reads was
// in the renderers alone. Section writers read the source to learn it - a
// timeline's items, a rollout's rows, a chart's `select`, `categoryBreaks`,
// `peers` and `omits`, a table's heat and `better` - and every reading was a
// model turn. This is that reference, kept beside the code it describes: for a
// form, the exhibit kind it draws, every field that kind reads (its data, its
// options, and each mark it draws with the shape it is written in), the fields
// a bound exhibit names its measures by, and the page's own fields its
// placements read. What can be read off the code
// is: the kind a form draws (page-types.mjs PAGE_TYPES), its placements
// (placementsOf), the marks a chart draws (its registry `decorations`) and what
// a form requires of its exhibit (pageSchema); the words are written here, and
// a test holds them to the code - every form has its kind's fields, every key
// of a kind's registered sample is described, and every mark a chart can draw
// has its shape.

import { PAGE_TYPES, exhibitRange, pageSchema, placementsOf } from "./page-types.mjs";
import { REGISTRY } from "./registry.mjs";

// The fields every chart reads, beside its own data.
const CHART = {
  heading: "string - the measure, population and period, one line; a figure only as a period, a sample (n = 240), a set size, an index base (2019 = 100) or a rank scale",
  unit: "string - one line, no results; needs `heading`",
  unitPlacement: "\"inline\" - the unit on the heading's line (falls back under it where it does not fit)",
  headingIcon: "icon name - over the heading; on every panel of a row or none",
  badge: "string - a pill at the heading's right (\"CAGR 2024-30: +13%\")",
  caption: "string - the finding under the panel",
  question: "{ text, base? } - a survey question under the heading, 3 lines at most; `base` a count (n = 1,204) or a string",
  valueFormat: "{ decimals 0-6, prefix, suffix, compactUnit: \"k\"|\"m\"|\"bn\", sign: \"auto\"|\"always\", grouping } - how values print; unset, one precision for the chart",
  focus: "string | string[] - the subject: a series name becomes `focusSeries`, a category a highlighted bar, points on a scatter",
  native: "false - drawn as shapes, not a native PowerPoint chart",
  calloutBand: "\"shared\" | \"band\" - callouts keep the band above the plot",
  type: "the kind - set by the form; written only on a page whose exhibits are typed (panels, two-up, hero-number, metric-strip, photo-backdrop, summary)",
};
// The value axis's own fields, on the charts that draw one.
const AXIS = {
  yMin: "number - the value axis's foot; unset, the runtime sets it on whole 1/2/2.5/5 steps (NICE_TICKS); bars include 0",
  yMax: "number - the value axis's top; holds every value",
  gridlines: "boolean - quiet gridlines (needs a visible axis)",
  showValueAxis: "boolean - unset: shown with gridlines, or when values are not labelled",
};
// The labels' fields, on the charts that read them.
const LABELS = {
  dataLabels: "boolean - values on the marks; false at 12 marks or fewer needs `gridlines` (LABELS_OFF)",
  legend: "boolean - the series key",
};
const CATEGORICAL = {
  categories: "string[] - required (or bound), unique: the periods or members",
  series: "[{ name, values: number[one per category], state?: \"recorded\"|\"assumed\"|\"reference\", assumedFrom?: category }] - required (or bound); names unique",
};
const SERIES_EXTRAS = {
  focusSeries: "series name - the subject in the primary, the rest grey (2+ series)",
  colorIndices: "int[one per series, 0-5] - each series' palette colour",
  forecastFrom: "category - from there on drawn as forecast (single-series columns or bars: tinted, keyed; `forecastKey: false`, `actualLabel`, `forecastLabel`)",
  change: "false | true | { from, to, text? } | \"steps\" - the growth arrow or bracket the claim compares; unset, none",
  cagr: "{ from, to, label? } - the compound rate on an arrow (a stack: its totals)",
  dataTable: "true | [{ label, values }] - a value table under the chart, aligned to the categories (the runtime then sets `categoryColumns`, the table's label column: not written)",
  split: "true - 2-4 series drawn as one panel each",
};
const COLUMN_EXTRAS = {
  categoryNotes: "(string|null)[] in category order - a second line under each label (\"n=412\")",
  categoryGroups: "[{ id, label, categories: 2+ contiguous }] - a bracket naming each run",
  deltas: "number[] | [{ category, value, significant? }] - a change pill over each column or a disc beside each bar; `deltaThreshold` (5), `deltasLabel`",
};
const BAR_EXTRAS = {
  xMin: "number - the value axis's foot (a bar's axis runs across; `yMin` is read too)",
  xMax: "number - the value axis's top",
  categoryLabel: "\"beside\" | \"above\" - a label set over its bar across the plot (survey statements)",
  categoryLabels: "false - no label column (a paired panel's second)",
  rowNotes: "(string | { text, tone?: positive|negative|neutral, quote?, arrow? } | null)[one per category] - a note column level with each bar; `rowNotesWidth` 160-360",
  paired: "true - 2-3 series as side-by-side panels sharing one label column; `units: [one per series]`",
};
const STACK_EXTRAS = {
  stackTotals: "[{ category, value, roundingTolerance?, roundingReason? }] - each stack's total, reconciled to its segments",
  secondaryLabels: "[{ category, series | anchor: \"stack-total\", value, unit, valueFormat? }] - a second figure on a segment or total",
  secondaryLabelStyle: "\"stacked\" | \"parenthetical\" (needs `secondaryUnit`, named in the heading)",
  percent: "true - each stack re-expressed as shares of 100",
};
const LINE_EXTRAS = {
  directLabels: "\"end\" - each line named at its end (`endLabels: true` the same), no legend",
  area: "false - no fill under a lone line",
  "series[].rank": "true - a rank line, 1 at the top (every series a rank)",
  xAxis: "{ unit, min, max, ticks: [{ value, label }] 2-12 } - a numeric x axis (sparse observations): then `series: [{ name, points: [{ key, x, y, breakBefore?, label? }], status?: before|after }]`, `gapPolicy` (connect-observations | explicit-breaks), `statusBoundary` { x, beforeLabel, afterLabel }",
};
const POINTS = {
  points: "[{ name (unique), x, y, series?, showLabel?: false }] - required (or bound by `points: { x: { measure }, y: { measure } }`); every point a `series` or none",
  connect: "true - each series joined in x order (`seriesLabels: false` drops the end names)",
  quadrants: "{ x, y, style?: threshold-lines|alternating-tint|focus-tint, titles?: { topLeft, topRight, bottomLeft, bottomRight }, focus? } - quadrant lines and names",
  xLabel: "string - the x axis's title", yLabel: "string - the y axis's title",
  xMin: "number", xMax: "number", yMin: "number", yMax: "number",
  xScale: "{ min, max, step } - the x axis, set whole", yScale: "{ min, max, step } - the y axis, set whole",
  yTickLabels: "[{ value, label }] - named ticks",
  gridlines: "boolean", legend: "boolean", dataLabels: "false - no point names", colorIndices: "int[] - series colours",
};

/**
 * Each exhibit kind a form draws, by the name PAGE_TYPES gives it: `data` the fields it is drawn from, `options` what else
 * it reads, `chart` whether it takes the chart fields and the marks its registry entry draws, `axis` the value axis's
 * fields, `labels` the value labels' and the legend's (all, or those listed), `bound`
 * whether its numbers can be written by reference (series, figures, tokens), and `page` the page-level fields the form
 * reads beside (or instead of) an exhibit. A form whose name is not a kind here is read as the kind `ALIASES` gives.
 */
export const KINDS = Object.freeze({
  "chart.column": { chart: true, axis: true, labels: true, bound: true, data: CATEGORICAL, options: { ...SERIES_EXTRAS, ...COLUMN_EXTRAS } },
  "chart.bar": { chart: true, axis: true, labels: true, bound: true, data: CATEGORICAL, options: { ...SERIES_EXTRAS, ...COLUMN_EXTRAS, ...BAR_EXTRAS } },
  "chart.stacked-column": { chart: true, axis: true, labels: true, bound: true, data: CATEGORICAL, options: { ...SERIES_EXTRAS, ...COLUMN_EXTRAS, ...STACK_EXTRAS } },
  "chart.stacked-bar": { chart: true, axis: true, labels: true, bound: true, data: CATEGORICAL, options: { ...SERIES_EXTRAS, ...COLUMN_EXTRAS, ...STACK_EXTRAS, ...BAR_EXTRAS } },
  "chart.line": { chart: true, axis: true, labels: true, bound: true, data: CATEGORICAL, options: { ...SERIES_EXTRAS, ...LINE_EXTRAS } },
  "chart.area": { chart: true, axis: true, labels: true, bound: true, data: CATEGORICAL, options: { ...SERIES_EXTRAS, directLabels: LINE_EXTRAS.directLabels } },
  "chart.stacked-area": { chart: true, bound: true, data: { categories: CATEGORICAL.categories, series: "[{ name, values }] 2-6, none below 0, no missing periods" },
    options: { yMax: AXIS.yMax, gridlines: AXIS.gridlines, legend: LABELS.legend, percent: STACK_EXTRAS.percent, colorIndices: SERIES_EXTRAS.colorIndices } },
  "chart.combo": { chart: true, axis: true, labels: ["dataLabels"], bound: true, data: { categories: CATEGORICAL.categories, series: "[{ name, values }] exactly 2 - the columns, then the line" },
    options: { secondaryAxis: "true - the line on its own scale (`y2Min`, `y2Max`)", secondaryUnit: "string - the line's unit", secondaryValueFormat: "valueFormat - the line's" } },
  "chart.waterfall": { chart: true, axis: true, bound: true, data: { categories: CATEGORICAL.categories, values: "number[one per category] - a total's level, a step's change", totals: "int[] - the indices that are totals ([0, last])" },
    options: { orientation: "\"vertical\" | \"horizontal\"", labelDecimals: "int - the labels' decimals", bridge: "{ from?: { measure: ref@label, name? }, steps: { measure } | [{ measure, name }], to: { measure }, residual?: \"<label>\" } - the bridge written from measures, reconciled" } },
  "chart.scatter": { chart: true, bound: true, data: { points: POINTS.points }, options: { ...POINTS, points: undefined, trendLine: "{ method?: \"linear\", label? } - a fitted line (5+ points)" } },
  "chart.bubble": { chart: true, bound: true, data: { points: "[{ name, x, y, size > 0, series? }] - required (or bound with `size: { measure }`)" }, options: { ...POINTS, points: undefined, sizeLegend: "{ label, markerSize? } - what a bubble's area shows" } },
  "chart.pie": { chart: true, bound: true, data: { labels: "string[2-5] unique - the parts", values: "number[one per label] >= 0; a part under 5% is refused" },
    options: { variant: "\"outside-labels\" (default) | \"legend-top-right\" | \"shared-legend\"", legend: "boolean", dataLabels: "false", categoryKeys: "string[] - one colour key across neighbouring charts" } },
  "chart.donut": { chart: true, bound: true, data: { labels: "string[2-5] unique - the parts", values: "number[one per label] >= 0; a part under 5% is refused" },
    options: { variant: "\"outside-labels\" (default) | \"legend-top-right\" | \"shared-legend\"", legend: "boolean", dataLabels: "false", categoryKeys: "string[]", center: "string | { value, label } - a figure in the hole (native file only)" } },
  "chart.marimekko": { chart: true, bound: true, data: { categories: CATEGORICAL.categories, series: "[{ name, values >= 0 }] - each column stacked to 100%", widths: "positive[one per category] - column widths; unset, the totals" },
    options: { percentLabels: "false - values, not shares", legend: "boolean", colorIndices: SERIES_EXTRAS.colorIndices } },
  "chart.bubble-grid": { chart: true, bound: true, data: { rows: "string[] - members", columns: "string[] - measures", values: "number[rows][columns] >= 0" }, options: { valueFormat: CHART.valueFormat } },
  "chart.waffle": { chart: true, bound: true, data: { categories: CATEGORICAL.categories, series: "[{ name, values: whole counts >= 0 }] exactly 1" },
    options: { percent: "true - a 10x10 block a category, values 0-100", color: "token id - the dot fill", dataLabels: "false - no counts" } },
  "chart.range": { chart: true, bound: true, data: { categories: CATEGORICAL.categories, low: "number[one per category]", high: "number[one per category] >= low" },
    options: { xMin: "number", xMax: "number", includeZero: "true - the axis takes 0" } },
  "chart.horizons": { chart: true, data: { horizons: "[{ id, label, title?, description?, timeframe?, summary?, details?: [{ label, value }] <= 4, colorIndex? 0-5, start?, end? 0-1 }]" },
    options: { variant: "\"curves\" (<= 5) | \"stepped\" (<= 5) | \"stepped-minimal\" (<= 10) | \"stepped-bands\" (<= 3)", xLabel: "string (curves)", yLabel: "string (curves)" } },
  "chart.small-multiples": { chart: true, bound: true, data: { mark: "\"column\" (default) | bar | line | stacked-column | stacked-bar | donut", categories: "string[] - the shared axis (a donut's 2-6 parts)",
    items: "[{ label, values (null only for a line's gap), focus?: category, reference?: number }] 5-12 - one panel each; stacked: { label, series: [{ name, values }] }" },
    options: { scale: "\"shared\" (default) | \"own\"", reference: "\"average\" | number - a line on every panel", percent: "true - stacked marks as shares", centre: "part - a donut's centre figure", rowLabels: "string[] - with `columnLabels`, a grid read both ways", columnLabels: "string[]", columns: "int - panels a row" } },
  "chart.slope": { chart: true, bound: true, data: { categories: "string[2-4] - the periods", series: "[{ name, values }] 1-12 - one line each" }, options: { focusSeries: SERIES_EXTRAS.focusSeries, yMin: AXIS.yMin, yMax: AXIS.yMax } },
  "chart.lollipop": { chart: true, bound: true, data: { categories: CATEGORICAL.categories, series: "[{ name, values }] exactly 1" }, options: { xMin: "number (takes 0)", xMax: "number" } },
  "chart.dumbbell": { chart: true, bound: true, data: { categories: CATEGORICAL.categories, series: "[{ name, values }] exactly 2 - before, after" }, options: { legend: "boolean (on)", xMin: "number", xMax: "number", includeZero: "true", colorIndices: SERIES_EXTRAS.colorIndices } },
  "chart.bullet": { chart: true, bound: true, data: { categories: CATEGORICAL.categories, series: "[{ name, values }] exactly 1", targets: "number[one per category] | { measure } - required: the target line on each row", ranges: "[[poor, ok, good] per category] - the bands behind" },
    options: { xMin: "number (0)", xMax: "number" } },
  "chart.treemap": { chart: true, bound: true, data: { items: "[{ label, value > 0 }] 2-20" }, options: { colorIndices: SERIES_EXTRAS.colorIndices } },
  "chart.radar": { chart: true, bound: true, data: { categories: "string[3-8] - the axes", series: "[{ name, values }] 1-4 - one profile each" }, options: { max: "number - the scale's top (the data's maximum)", legend: "boolean", focusSeries: SERIES_EXTRAS.focusSeries, colorIndices: SERIES_EXTRAS.colorIndices } },
  "chart.boxplot": { chart: true, bound: true, data: { categories: CATEGORICAL.categories, boxes: "[{ min, q1, median, q3, max }] one per category (bound: 5 measures in that order)" }, options: { yMin: AXIS.yMin, yMax: AXIS.yMax, gridlines: AXIS.gridlines } },
  "chart.sparklines": { chart: true, bound: true, data: { items: "[{ label, values (4+, one length), note? }] 2-12 - one small line each" }, options: { columns: "int - cells a row", sharedScale: "true - one scale for all" } },
  "aligned-bars": { bound: true, data: { categories: "string[] 4+ - the members", series: "[{ name, unit?, values, valueFormat? }] 2-4 - one headed bar column each; at most 2 beside a text column" },
    options: { highlights: "[{ category }] - the subject (or a title naming one member)" } },
  "model-page": { chart: true, axis: true, labels: true, bound: true, data: CATEGORICAL, options: { type: "chart.column | chart.line | chart.area | chart.stacked-column | chart.combo - the series over its own data table", dataTable: "true (the form's default) - the values under the chart" } },
  table: { table: true, bound: true, data: {
    columns: "(string | { label, type?, unit?, group?, width?, minWidth?, align?, bold?, heat?, domain?, better?, bar?, barScale?, bubble?, implication?, headerIcon?, logo?, scale?, numberDisplay?, labelDisplay?, vertical? })[] - the header; a column's keys reach each of its cells",
    rows: "(cell[one per column] | { cells, style?: plain|accented|total|group, better?: up|down, icon? })[] - the body rows; the label is the first cell",
  }, options: {
    "cell": "string | number | { text, value, type?, highlight?: true | phrase, bold?, tone?: positive|negative, sub?, icon?, blank? } - typed cells: harvey 0-4, rag (on-track, behind, at-risk, complete, not-started, ...), lights green|amber|red, check / dot true|\"yes\", progress 0-100, trend up|flat|down (+ `better`), binary yes|no|missing, sparkline { values }, bars { values, scale }, bullets { items, lead? }, category { text, rowSpan?, sectionNumber? }, quote { text, by? }, logo { player | media }",
    "columns[].heat": "true - the column shaded by its figures (whole 1-5 as scores; else 5 steps over its range or `domain: [lo, hi]`); `better: \"down\"` turns it",
    "columns[].better": "\"up\" | \"down\" - on a heat column, the direction that is good; a row's or a cell's `better` colours its trend cells",
    "columns[].bar": "true - in-cell bars on one scale (needs `label` and `unit`; `barScale` shares one across columns)",
    "columns[].implication": "true - a \"therefore\" chevron before the column; its header names the inference",
    treatment: "\"open\" | \"standard\" | \"dimensions\" | \"categories\" - the header and label styling; unset, inferred",
    density: "\"body\" | \"compact\" | \"dense\" - type size; stepped down to fit",
    highlightRow: "row index | first-cell label - the row accented (the subject's row by default)",
    highlightColumn: "column index - tinted end to end (`recommended`: by label)",
    total: "true | \"auto\" - a closing row summing the additive columns (`totalLabel`)",
    derive: "\"rank\" | \"share\" | \"change\" | \"index\" | list - computed columns (`deriveFrom`, `deriveAgainst`)",
    scales: "{ <id>: { type: harvey|binary|heatmap|bars, label, ... } } - the keys typed cells read by `scale`",
    icons: "icon name[one per row] - before each row label",
    columnWidths: "fractions[one per final column] summing to 1",
    split: "\"halves\" - a long table set as two panels (1 exhibit, <= 3 columns, 10+ rows, no typed cells)",
    legend: "false - drop the heat or bar key (where every cell prints its figure)",
    heading: "string - the panel heading (drawn where the layout heads panels)",
    caption: CHART.caption,
    "tokens": "`{{<insight>/<measure>@<period or member> | <format>}}` in a cell prints a recorded number; a table whose every measurement is a token needs no `basis`",
  } },
  "comparison-table": { data: { columns: "string[] - the heads", rows: "cell[one per column][] - the rows" }, options: { selectedColumn: "column index - its cells highlighted" } },
  "trend-rows": { data: { columns: "string[3] - the heads", rows: "[label, text, text][] - the label a category column" }, options: {} },
  "status-list": { data: { items: "[{ label, status: positive|caution|negative }] - a check, ! or x disc each" }, options: {} },
  "measure-table": { alias: "table", note: "density \"compact\" and `total: \"auto\"` unless written; columns carry `unit` and `group`, the page `footnotes: [{ on, text }]`" },
  "findings-matrix": { page: {
    rows: "[{ label, cells: 1-3 of string | string[] (bullets) | { lead, points } | { lead, text }, icon?, number?, style?: \"accented\" }] - the findings down the side, every row the same number of cells",
    columns: "(string | { label, logo })[] - the heads; one more than the content columns heads the label column",
  } },
  "insight-tree-table": { data: { root: "{ id, label } - required", branches: "[{ id, label, leaves: [{ id, label, insight, implications: string | string[1-4] }] }] 1-4 - 3 to 7 leaves in all, ids unique" },
    options: { headers: "{ tree, insight, implication } - the column heads (write them)", rowTreatment: "\"tonal\" | \"open\"" } },
  timeline: { data: { items: "(string | { label, date? | period?, maturity?, text? | detail? })[] 4+ - the stages; bare strings draw a numbered strip" },
    options: { orientation: "\"across\" | \"down\"", eras: "[{ label, from, to }] 1-4 - stage labels or indices, in order", active: "index - the stage filled",
      variant: "\"time-grid\" (axis { kind: \"periods\", precision, periods: [{ id, label }] }, lanes [{ id, label, events: [{ id, periodId, kind }] }], eventKinds [{ id, label, symbol: triangle|open-circle }], bands?, qualifiers?) | \"dated-lanes\" (axis { kind: \"date\", scale: \"elapsed-days\", precision: \"day\", domain: [ISO, ISO] }, lanes, events [{ id, laneId, date, label }], relationships?) | \"phase-hierarchy\" (phases [{ id, label, duration, children? }], expandedPhaseId, expansionLabel, phaseAnnotations?)" } },
  gantt: { data: { periods: "string[] 2+ - the columns", rows: "[{ label, from, to (period indices, fractions allowed), text?, milestones?: [{ at, label? }], tone?: primary|secondary|accent }] <= 14 - or `groups: [{ name, rows }]`" },
    options: { groups: "[{ name, rows }] - the rows in named groups, in place of `rows`", tiers: "[{ label, from, to }] - a band above the periods", today: "fractional period index - a dashed line", labelWidth: "px", valign: "top | middle | bottom" } },
  roadmap: { data: { items: "(string | { label, period?, date?, maturity?, text? | detail? })[] 4+" },
    options: { orientation: "\"across\" | \"down\"", eras: "[{ label, from, to }]", active: "index",
      variant: "\"wave-columns\" (items 3+ of { heading | label, range?, activities?: [string], deliverables?: [string] }) | \"phase-workstreams\" (phases [{ id, label, period?, workstreams: [{ id, label, activities: [{ id, text, lead? }] }], products? }] 2+, 4+ workstreams in all; owners?, leadershipBands?, recurringProducts?, qualifiers?, workstreamWeights?)" } },
  "initiative-rollout": { data: { years: "string[] 3+ - the columns", rows: "[{ label, phases: string[one per year] }] 2+ - each initiative's phase in each year" }, options: {} },
  flow: { data: { nodes: "[{ id, label, text?, tone?: accent|muted }] 3-14", edges: "[{ from, to, label? }] 1+ - no loops (a cycle is form `cycle`)" }, options: {} },
  tree: { data: { root: "string - the question", branches: "[{ id, label, conclusions: [{ id, text }] 1-3 }] exactly 2 - 3+ conclusions in all", conclusion: "string - an overall conclusion" }, options: { note: "needs the page's width (a frame of 900 x 440): commentary \"none\", \"on-exhibit\" or \"so-what-bar\"" } },
  cycle: { data: { items: "[{ label, text?, icon?, number? }] 3-6" }, options: { center: "string - the loop's name inside the ring" } },
  steps: { data: { items: "[{ label, text?, icon? }] 3-6 - the last takes the accent" }, options: {} },
  framework: { data: { roof: "string - required", pillars: "[{ title, points?: [string] }] 3-5", foundation: "string" }, options: { highlight: "pillar index - its head accented", variant: "\"house\" (default)" } },
  layers: { data: { layers: "[{ label, text? }] 3-7" }, options: {} },
  "relationship-network": { data: { nodes: "[{ id, label, body?, tone?: primary|accent|outline }] 4-7 - a centre and 3-6 round it", centerId: "node id - required", ringOrder: "perimeter ids in ring order - required",
    edges: "[{ from, to, direction?: forward|bidirectional|none, relation? }] - spokes and ring neighbours, one a pair, no labels" }, options: { variant: "\"hub-ring\" | \"directed-spokes\"" } },
  funnel: { data: { stages: "[{ label, value }] 3+ - the first positive, none above it" }, options: { rates: "\"previous\" | \"first\" | \"none\"", variant: "\"qualitative\" (basis \"qualitative-selection\", inputSources, inputDescription, stages [{ id, label, details }], outcome { label, details })" } },
  sankey: { data: { left: "[{ id, label }] 2-10", right: "[{ id, label }] 2-10", flows: "[{ from: left id, to: right id, value > 0 }] 3-40 - every node in a flow" }, options: { highlight: "node id[]" } },
  quadrants: { data: { quadrants: "[{ title, points?: [string | { text }], text? }] exactly 4 - top-left, top-right, bottom-left, bottom-right" }, options: { tone: "\"light\"" } },
  matrix: { data: { xAxis: "{ label, minLabel, maxLabel } - required", yAxis: "{ label, minLabel, maxLabel } - required", points: "[{ label, x: 0-1, y: 0-1, size?, state?: positive|caution|negative }] 3+" },
    options: { highlight: "point index", highlightQuadrant: "topLeft | topRight | bottomLeft | bottomRight", quadrantLabels: "{ topLeft?, topRight?, bottomLeft?, bottomRight? }", bubbles: "boolean" } },
  spectrum: { data: { items: "[{ left, right, value: 0-1, text?, quotes?: { left?, right? } }] 3-6 - or with `segments` 3-7: { left, right?, level }, or with `markers`: { left, right, values: { <marker id>: 0-1 } }" },
    options: { segments: "int 3-7", scale: "string[one per segment]", markers: "[{ id, label }] 2-3 - the first the subject" } },
  process: { data: { items: "(string | { label, period?, maturity?, detail? })[] 3+" }, options: { active: "index" } },
  "chevron-process": { data: { items: "[{ heading?, label, details?: [string] }] 3+" }, options: { emphasizeFirst: "boolean", detailStyle: "\"circled-number\"" } },
  "zone-matrix": { data: { xAxis: "{ label, low?, high? } - required", yAxis: "{ label, low?, high? } - required", points: "[{ label, x: 0-1, y: 0-1, highlight? }] 3-15" }, options: { size: "2 | 3 | 4 zones a side", zoneLabels: "{ low?, high? }" } },
  "rank-flow": { data: { periods: "string[2-6]", entities: "[{ name, ranks: int[one per period] }] 3-15 - each period ranks every entity once" }, options: { highlight: "entity name[]" } },
  organization: { data: { root: "string - required", children: "string[] 3+" }, options: { highlight: "child index", nodes: "[{ id, label, detail?, x, y, width, height (fractions), tone? }] with `connectors: [{ from, to }]` - laid out by hand instead" } },
  placement: { data: { columns: "[{ label, text?, icon? }] 2-5", items: "[{ label, column: index | label, highlight? }] 3-30" }, options: {} },
  venn: { data: { sets: "[{ id, label, text? }] 2-3", overlaps: "[{ sets: [2+ ids], label }]" }, options: {} },
  pictogram: { bound: true, data: { rows: "[{ label, value: 0 to `of`, text? }] 1-5" }, options: { of: "10 (default) | 20", icon: "icon name (person)" } },
  "radial-bars": { bound: true, data: { items: "[{ label, value 0 to max, display?, highlight?: true }] 2-6 (or { label, measure, format })" }, options: { max: "number (100)", unit: "\"%\" where max is 100" } },
  "hero-number": { page: { kpi: "{ value | measure, format?, label, sublabel?, delta?, better? } - the one figure (required)", exhibit: "{ type, ... } - the proof beside it, any kind, its `type` written (required)" } },
  "metrics-over-exhibit": { page: { metrics: "[{ value | measure, format?, label, sublabel?, delta?, better? }] - the strip of figures (required)", exhibit: "{ type, ... } - the chart under them, its `type` written (required); commentary \"none\"",
    metricsPosition: "\"top\" | \"bottom\"", metricsTone: "default | dark | tint | hero | ink | rule | ring" } },
  "fact-grid": { bound: true, data: { items: "[{ value: string <= 10 characters | measure + format, label, text?, icon?, gauge?: 0-1 }] 3-9" }, options: { columns: "1-4 tiles across (1 only where every tile has `text`)", tone: "\"dark\"" } },
  "stat-list": { bound: true, data: { items: "[{ value: string <= 9 characters | measure + format, text, icon? }] 2-6" }, options: { variant: "\"grid\"", tone: "\"dark\"" } },
  "nested-circles": { bound: true, data: { items: "[{ label, value > 0 (each at most the one before), display?, text? }] 2-4 (or measure + format)" }, options: {} },
  cards: { data: { items: "[{ title, text?, points?: [string | { text }], icon?, logo?: media, number?, footer?, value? }] 2-6" },
    options: { tone: "outline | header | numbered | plain | disc | big-number | dark | columns | stat (needs `value` on every card)", align: "\"center\"", valign: "\"middle\"", question: "string - a panel on the left", columns: "int - cards a row" } },
  capsules: { data: { items: "[{ title, text?, icon? }] 2-5" }, options: {} },
  "arrow-rows": { data: { items: "[{ label, text?, icon? }] 2-6 - the last takes the accent" }, options: {} },
  "labelled-rows": { page: { blocks: "[{ label (<= 5 words), icon? (an icon name, set over the label), points: 2-4 points, metric?: { value | measure, label, delta? } | exhibit?: { type, ... } }] 2-5 - every row a metric or exhibit, or none; no `exhibit` on the page" } },
  logos: { data: { items: "[{ name, caption?, image?: media }] 2-12 - a declared player's mark fills `image` by name" }, options: {} },
  people: { data: { items: "[{ name, role?, points?: [string] <= 3, image?: { path, alt, credit } | { alt, search } }] 2-5" }, options: {} },
  map: { data: { geography: "preset (world, europe, usa, ...) | \"country:<ISO or name>\" | an imported { id, title, source, geojson }", markers: "[{ label?, id?, longitude + latitude | country | x + y, value?, display?, style?: \"badge\", hub?, size?, fraction?, number? }]" },
    options: { highlightCountries: "ISO code or name[]", routes: "[{ from, to, status?: operating|planned, value? }] - ends name markers", choropleth: "{ values: [{ featureId, value, note? }], scale: { domain: [lo, hi], unit, palette?, decimals? }, labels? } - not with markers",
      sizeLegend: "false | { label, style?, values? } - what a circle's size shows", valueLabel: "string", crop: "\"fit\"" } },
  "picture-hero": { page: { pictures: "(path | { path | search, alt, credit?, label?, text?, crop?: \"circle\", kind?: photograph|illustration })[] - the first drawn, its label and text its caption", kpi: "metric - beside the picture", paragraphs: "prose in the copy column" } },
  "picture-pair": { page: { pictures: "(path | { path | search, alt, credit?, label?, text?, icon?, points?, crop? })[2] - once one has a label or text, each has a `label`" } },
  "picture-strip": { page: { pictures: "(path | { path | search, alt, credit?, label?, text?, icon?, points?, crop? })[3-12] - more than 5 run in rows; with captions every one has a `label`" } },
  "photo-backdrop": { page: { photo: "{ path | search, alt, credit } - required, no crop", exhibit: "{ type, ... } - one exhibit over it, its `type` written (required)", photoSide: "\"left\" | \"right\"" } },
  "device-frame": { data: { image: "{ path, alt, credit } | { alt, search } - required: the screenshot", device: "\"laptop\" (default) | \"phone\"" }, options: {} },
  compare: { data: { left: "{ heading? (Before), points?: [string | cell], text?, image? } - one side", right: "{ heading? (After), points?, text?, image? }" }, options: { winner: "\"left\" | \"right\" | a heading | false - the side tinted", density: "table density", imageHeight: "px (180)", caption: CHART.caption } },
  "table-halves": { page: { exhibits: "[{ type: \"table\", ... }] - one table, split in reading order into two panels" } },
  "two-up-contrast": { page: { exhibits: "[{ type, heading, caption?, ... }] 1-2 - side by side, any kind, each typed", pairedWeights: "fractions - the two widths" } },
  text: { page: { paragraphs: "[{ lead (2-8 words), text (<= 60 words) }] - required; about 150-330 words in all", panel: "{ text (25+ words), kicker?, tone?: tint|dark|primary|muted, highlight? } - required: down the right" } },
  sidebar: { page: { panel: "{ text (25+ words, <= 8 lines), kicker?, tone?: dark|primary|muted|tint, highlight? } - required: down the left", paragraphs: "[{ lead, text }] - required" } },
  statement: { page: { text: "string - required: the sentence, <= 5 lines", accent: "phrase | phrase[] - set in the accent; each in the text", subtext: "string - a line under it", tone: "dark | light | primary", image: "media - a photograph behind" } },
  "quote-cluster": { data: { quotes: "[{ quote | text, attribution, detail?, avatarText? (<= 3 characters), portrait?, tone?: positive|negative|neutral }] 1-5 (or one `quote` and `attribution` on the exhibit)" },
    options: { treatment: "\"speech-bubble\" | \"contained\" | \"callout\"", placement: "\"full-field\" | \"section\" (4-5 quotes: full-field)", arrangement: "\"grid\" | \"staggered\" (3 full-field bubbles)", attributionPlacement: "inside | below-center | below-left", attributionAlign: "left | center | right", avatar: "boolean", avatarSize: "24-72" } },
  "executive-summary": { page: { points: "[{ lead, text }] - required: the answer, its proof, the consequence, the action; a ledger when every point is led and 20+ words", exhibit: "{ type, ... } - an answer table or chart, its `type` written", metrics: "metric[] - a strip" } },
  takeaways: { page: { items: "string[2-5] - required: a lead clause before a colon set bold", tone: "dark | light", image: "media" } },
  row: { panels: true }, grid: { panels: true }, stack: { panels: true }, sequence: { panels: true }, dashboard: { panels: true }, breakout: { panels: true },
});

// The forms whose kind is another's: the scorecard forms are tables whose cells are coded one way.
const ALIASES = Object.freeze({ harvey: "table", heatmap: "table", rag: "table", lights: "table", check: "table", bars: "table", progress: "table", dot: "table", trend: "table", binary: "table" });
// What each scorecard form codes its cells as: a column `type` (or flag) or a cell `type` (\"a <form> scorecard codes its cells\").
const CODED = Object.freeze({ harvey: "`type: \"harvey\"` cells, 0-4", heatmap: "a `heat: true` column, or `type: \"heatmap\"` cells", rag: "`type: \"rag\"` cells, a state key ({ value: \"at-risk\" } prints \"At risk\")",
  lights: "`type: \"lights\"` cells, green | amber | red", check: "`type: \"check\"` cells, true | \"yes\" | \"done\"", bars: "a `{ label, unit, bar: true }` column (`barScale` to share)",
  progress: "`type: \"progress\"` cells, 0-100", dot: "`type: \"dot\"` cells, true | \"yes\"", trend: "`type: \"trend\"` cells, up | flat | down, with `better`", binary: "`type: \"binary\"` cells, yes | no | missing (`labelDisplay`)" });

// The exhibit fields a form reads beyond its kind's: a chart drawn one way for one form.
const FORM_EXTRAS = Object.freeze({
  "trend/indexed": { indexBase: "period - the runtime rebases every series to 100 there (required unless the measures are an `index` analysis)", subject: "series name - the subject line (required)" },
  "ranking/distribution": { highlights: "[{ category }] - the subject, named whatever the rows; 15-40 members, one series" },
  "profiles/logo-table": { "columns[].type": "\"logo\" on one column (required): a cell `{ type: \"logo\", player }` draws the player's mark; 2+ rows" },
});

// The page-level fields of a panels page, by form.
const PANELS = {
  exhibits: "[{ type, heading?, caption?, ... }] - each typed, any kind (`--schema kinds`); with commentary \"captions\" every one has a `caption`",
};
const PANEL_FORMS = Object.freeze({
  row: { ...PANELS, spread: "{ from: { exhibit, category, series? }, to: { ... }, label } - the gap between two marks, named" },
  grid: { ...PANELS, exhibits: "3-4 typed exhibits" },
  stack: { ...PANELS, stackWeights: "fractions - each panel's height" },
  sequence: { ...PANELS, exhibits: "2-3 typed exhibits, each with a `heading`; arrows between them" },
  dashboard: { ...PANELS, exhibits: "2-6 typed exhibits, each with a `heading`; `area: { column, row, columnSpan?, rowSpan? }` places one, or `{ type: \"panel\", heading, text }`", grid: "{ columns: 1-4 | weights, rows: 1-3 | weights }", metrics: "metric[2-6] - a strip over the grid" },
  breakout: { ...PANELS, exhibits: "exactly 2 bar, column or stacked charts - the overview, then the detail", breakout: "{ from: { exhibit (0), category, series? }, to: index (1) } - required: the mark the detail splits" },
});

// Each mark a chart can draw, as it is written on the exhibit.
export const MARKS = Object.freeze({
  annotations: "[{ category, series?, text, treatment?: callout|orthogonal-dot|speech, style?: box|tint|plain|bubble|pill|figure (+ figure), border? }] - callouts, 3 a chart, ~10 words each",
  referenceLines: "[{ value, label?, style?: line|marker, placement?: inside|outside-end }] - a named comparator; the domain takes its value",
  highlights: "[{ category, series?, style?: bar|region-box|region-tint }] - the marks the claim is about (bar: a one-series bar or column)",
  focus: "string | string[] - the subject point(s)",
  focusSeries: "series name - the subject series",
  changeAnnotations: "[{ start, end (category | { category, series }), text (one figure), style?: arrow|bracket|construction|interval-label|end-bubble, compact? }] - a change between marks",
  annotationRail: "{ items: [{ category, text }] } | { rows: [{ label, items }] } - a figure over each column",
  periods: "[{ from, to, label }] - brackets over runs of categories",
  events: "[{ at, label }] - a dated line with a flag",
  pointHighlights: "[{ category, series?, size?, label? }] - numbered rings on points",
  bands: "[{ from, to, label?, style?: tint|box, axis?: value|category }] <= 3 - a value range or a run of categories",
  intervals: "[{ low: (number|null)[], high: (number|null)[], label? }] <= 3 - a scenario range or fan",
  valueBreak: "{ from, to } - a cut in the value axis",
  categoryBreaks: "[category, ...] - a // after each, for periods that are not adjacent; columns over uneven dates under a data table, or broken at some gaps, are broken at every long gap",
  groupBrackets: "[{ categories: 2+ contiguous, label?, value?: sum|share|none }] <= 3",
  valueLabels: "[{ category, series?, display? (<= 12 characters, an estimate), estimate?, ring? }] - a value said another way",
  segmentGrowth: "{ from, to, label? } | list <= 3 - a growth column per segment",
  seriesGrowth: "{ from, to, label? } | list <= 3 - a growth column per line (with end labels)",
  stackBracket: "[series name, ...] - brackets those segments and prints their sum",
  diverging: "true | { neutral: series } - a Likert scale round zero",
  trendLine: "{ method?: \"linear\", label? } - a fitted line (5+ points)",
  categoryIcons: "{ <category>: icon | { icon } | { image: { path | alt } } | { flag } } | array in category order - a mark beside each label",
});

// How a bound exhibit names its measures, and how a typed one says which it shows (bind.mjs, page-numbers.mjs).
const BOUND = Object.freeze({
  role: "\"proof\" | \"context\" - what the bound exhibit is to the claim (as `basis.role`)",
  relevance: "string - why a context exhibit is on the page (as `basis.relevance`)",
  "series[].measure": "\"<insight>/<measure>\" | [ref, ref] - the runtime writes the categories, values, unit and basis (two refs: a record then a scenario, one line)",
  "series[].role": "\"context\" - a series beside the claim's own",
  select: "{ from?, to? } | { periods: [...] } over periods; { members: [...], order?: descending|ascending } over members - narrows the axis",
  pivot: "true - each series' measure a category, each selected period or member a series",
  measure: "ref - one measure for the whole exhibit (its slices the categories, or a pie's labels)",
  basis: "{ measures: [ref] | measure, role?: proof|context, relevance?, as?: chart|table|figure, labels?, members? } - what a typed exhibit shows; on a bound one only `role` and `relevance`",
  tokens: "`{{<insight>/<measure>@<period or member> | <format>}}` in any text prints the recorded number",
});
// The page's own fields the placements read, each with the placements that read it.
const PLACED = Object.freeze({
  points: { in: ["beside", "beside-left", "below"], line: "[string | { lead, text, icon?, highlight? }] - the commentary: a column beside, or up to 3 across under the exhibit" },
  paragraphs: { in: ["beside", "beside-left", "below"], line: "[string | { lead, text }] - prose in place of points" },
  rail: { in: ["rail"], line: "string - one claim in a filled side panel, eight lines at most" },
  bar: { in: ["so-what-bar"], line: "string - the implication across the foot, 2 lines" },
  "exhibits[].caption": { in: ["captions"], line: "string - a finding under each panel" },
});
const PAGE = Object.freeze({
  title: "string - the claim, 2 lines at most", evidence: "insight id[] - optional: the insights the page rests on",
  subtitle: "string - one line", takeaway: "false | string - a closing line", source: "string | registry key[]",
  note: "string | string[] - the footer note", footnotes: "[{ on, text }] - a marker on a figure", highlight: "phrase | phrase[] - set in the accent",
});

/** The kind a form draws, as KINDS names it: the form's own entry where PAGE_TYPES maps it to one, else its alias. */
const kindOf = (type, form) => { const own = PAGE_TYPES[type]?.forms?.[form]; return own === undefined ? null : KINDS[own] ? own : ALIASES[own] ?? own; };
const drawn = (kind) => REGISTRY.get(kind)?.decorations?.draws ?? [];
const defined = (fields) => Object.fromEntries(Object.entries(fields ?? {}).filter(([, line]) => line !== undefined));

/** What an exhibit of `kind` reads: its own fields, the chart's and the axis's where it is a chart, its marks and its bound fields. */
function exhibitFields(kind) {
  const entry = KINDS[kind];
  if (!entry) return null;
  const own = entry.alias ? KINDS[entry.alias] : entry;
  // The marks the kind's renderer draws (its registry `decorations`), less those its own options already say.
  const marks = Object.fromEntries(drawn(kind).filter((key) => MARKS[key] && !(own.options && key in own.options) && !(key in CHART)).map((key) => [key, MARKS[key]]));
  // The chart's and the axis's fields, less those the kind says in its own words (a model page's `type`).
  const labels = own.labels === true ? LABELS : Array.isArray(own.labels) ? Object.fromEntries(own.labels.map((key) => [key, LABELS[key]])) : {};
  const shared = own.chart ? Object.fromEntries(Object.entries({ ...CHART, ...(own.axis ? AXIS : {}), ...labels }).filter(([key]) => !(own.options && key in own.options) && !(own.data && key in own.data))) : {};
  return {
    ...defined({ ...own.data }), ...defined({ ...own.options }), ...(entry.note ? { note: entry.note } : {}), ...shared,
    ...(Object.keys(marks).length ? { marks } : {}),
    ...(own.bound ? { bound: own.table ? { tokens: BOUND.tokens, basis: BOUND.basis } : own.chart || own.data?.series ? BOUND : { "items[].measure": "ref + `format` - the runtime writes the value", tokens: BOUND.tokens } } : {}),
  };
}

// What every typed exhibit may carry whatever its kind: its heading and caption on a panels page, its place on a dashboard,
// and what it shows.
const EXHIBIT = Object.freeze({
  heading: "string - the panel's heading",
  caption: "string - the finding under the panel",
  area: "{ column, row, columnSpan?, rowSpan? } - its place on a dashboard",
  basis: BOUND.basis,
});

/**
 * The keys of an authored exhibit that nothing reads: neither its kind's fields (what `--schema` prints for it), nor the
 * fields every typed exhibit takes, nor a `$` note. `kind` is the exhibit's own `type` or, untyped, the kind its page's
 * form draws (`type`, `form`); a page construction with no exhibit kind returns none. Read past, such a key was dropped
 * without a word: the BA deck's `marks: { referenceLines }` lost its reference line, and `peers` and `omits` - which no
 * code has read since the deck conventions were cut - said nothing on 34 exhibits.
 */
export function unreadKeys(exhibit, { type, form, kind = exhibit?.type } = {}) {
  if (!exhibit || typeof exhibit !== "object" || Array.isArray(exhibit)) return [];
  const drawnKind = kind ?? (type && form ? kindOf(type, form) : null);
  const fields = drawnKind ? exhibitFields(drawnKind) : null;
  if (!fields) return [];
  const top = (key) => key.split(/[.[]/)[0];
  const known = new Set(["type", ...Object.keys(EXHIBIT), ...Object.keys(FORM_EXTRAS[`${type}/${form}`] ?? {}).map(top)]);
  for (const [key, value] of Object.entries(fields)) {
    if ((key === "marks" || key === "bound") && value && typeof value === "object") for (const inner of Object.keys(value)) known.add(top(inner));
    else if (key !== "note") known.add(top(key));
  }
  return Object.keys(exhibit).filter((key) => !known.has(key) && !key.startsWith("$")).map((key) => ({ key, kind: drawnKind }));
}

/**
 * Every field a page of `type` and `form` reads, compactly: the kind it draws, its placements, the page's own fields
 * (those every page takes and those its placements and form read), and the exhibit's fields. Throws, naming the forms,
 * on a form the type does not have.
 */
export function formFields(type, form) {
  const t = PAGE_TYPES[type];
  if (!t) throw new Error(`unknown page type "${type}"; one of ${Object.keys(PAGE_TYPES).join(", ")}`);
  if (!Object.hasOwn(t.forms, form)) throw new Error(`${type} has no form "${form}"; its forms: ${Object.keys(t.forms).join(", ")}`);
  const kind = kindOf(type, form), entry = KINDS[kind] ?? {};
  const placements = placementsOf(type, form), [lo, hi] = exhibitRange(type, form);
  // Each placed field with the placements of this form that read it.
  const placed = Object.fromEntries(Object.entries(PLACED).map(([key, field]) => [key, field.in.filter((placement) => placements.includes(placement))])
    .filter(([, read]) => read.length).map(([key, read]) => [key, `${PLACED[key].line} (${read.join(", ")})`]));
  // What the form requires of its exhibit beyond the kind's own fields (page-types.mjs FORM_SCHEMA, as `--schema <type>` prints
  // it): the keys it must carry, and the count a list of them is held to.
  const rule = (pageSchema(type).allOf || []).find((r) => r.if?.properties?.form?.const === form && r.then?.properties?.exhibit)?.then.properties.exhibit;
  const counted = Object.entries(rule?.properties ?? {}).filter(([, value]) => value?.minItems !== undefined || value?.maxItems !== undefined)
    .map(([key, value]) => `${key}: ${value.minItems ?? 0}${value.maxItems !== undefined ? `-${value.maxItems}` : "+"}`);
  const panels = entry.panels ? PANEL_FORMS[form] : null;
  const exhibit = entry.page || panels ? null : { ...(FORM_EXTRAS[`${type}/${form}`] ?? {}), ...exhibitFields(kind) };
  return {
    form: `${type}/${form}`, task: t.task, draws: entry.page || panels ? `${form === "labelled-rows" ? "rows of blocks" : "a page construction"} (${PAGE_TYPES[type].forms[form]})` : PAGE_TYPES[type].forms[form],
    exhibits: lo === hi ? lo : `${lo}-${hi}`, commentary: placements,
    page: { ...PAGE, ...placed, ...(entry.page ?? {}), ...(panels ?? {}) },
    ...(exhibit ? { exhibit } : {}),
    ...(ALIASES[PAGE_TYPES[type].forms[form]] ? { coded: `a ${form} scorecard codes its cells: ${CODED[form]}` } : {}),
    ...(rule?.required || counted.length ? { required: [...(rule.required ?? []), ...counted] } : {}),
    more: `--example ${type}/${form} prints a worked page; --limits ${type}/${form} its countable limits; --schema kinds every exhibit kind`,
  };
}

/**
 * The fields one exhibit kind reads, as a typed exhibit writes them (`{ type: "chart.column", ... }` in a panel, a hero
 * number's proof): `{ kind, drawnBy, exhibit }`, or null for a name that is no exhibit kind.
 */
export function kindFields(kind) {
  const entry = KINDS[kind];
  if (!entry || entry.page || entry.panels) return null;
  return { kind, drawnBy: exhibitKinds().kinds[kind], exhibit: exhibitFields(kind) };
}

/**
 * Every exhibit kind with the type/forms that draw it, and the forms whose exhibits are typed (`exhibits[i].type`, a
 * hero number's proof): `{ kinds: { <kind>: "type/form, ..." }, typed: "type/form, ..." }`, each list a line.
 */
export function exhibitKinds() {
  const kinds = {};
  for (const [type, t] of Object.entries(PAGE_TYPES)) for (const [form, drawnAs] of Object.entries(t.forms)) {
    const kind = KINDS[drawnAs] && !KINDS[drawnAs].page && !KINDS[drawnAs].panels ? drawnAs : ALIASES[drawnAs] ?? null;
    if (kind) kinds[kind] = kinds[kind] ? `${kinds[kind]}, ${type}/${form}` : `${type}/${form}`;
  }
  // A kind no form draws on its own is a typed exhibit's (a panel, a hero number's proof).
  for (const [kind, entry] of Object.entries(KINDS)) if (!kinds[kind] && !entry.page && !entry.panels && !entry.alias) kinds[kind] = "no form of its own: an exhibit's `type` on a typed form";
  const typed = Object.entries(PAGE_TYPES).flatMap(([type, t]) => Object.keys(t.forms).filter((form) => {
    const entry = KINDS[t.forms[form]];
    return entry?.panels || ["hero-number", "metrics-over-exhibit", "photo-backdrop", "executive-summary", "two-up-contrast", "table-halves", "labelled-rows"].includes(t.forms[form]);
  }).map((form) => `${type}/${form}`)).join(", ");
  return { kinds, typed, note: "a kind is drawn by the forms listed, its `type` set by the form; on a typed form each exhibit names its kind in `type` (chart.column, table, map, ...). `--schema <kind>` prints the fields a kind reads, `--schema <type>/<form>` a form's" };
}
