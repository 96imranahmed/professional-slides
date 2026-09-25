// Page types: the authoring kit a deck is written through.
//
// A deck written straight into the deck spec came out as one page repeated. A
// harness authored fifty pages through a single helper - title, three points,
// a closing line, a source, one exhibit - and every page took the same
// skeleton: a takeaway line on 43 of 43 pages and bullets under the exhibit on
// nearly all of them. Strong consulting decks put a closing line on
// about one page in ten and bullets under the exhibit on about one in fifty;
// their commentary sits on the chart, in the table, under each panel, beside
// the exhibit or nowhere, and a quarter of their pages carry two or more
// exhibits. The composer could draw all of that. Nothing asked the author to
// choose it: the skill said to leave the layout unset, and a default taken
// fifty times is a template.
//
// So every analytical page is written as a page *type* - the reading task it
// serves - and each type has choices with no defaults. `commentary` says where
// the explanation lives, `takeaway` says whether the page closes on a line,
// `form` says which exhibit carries the evidence. The compiler derives the
// page's structure (layout, shape, arrangement, exhibit type, closing line)
// from those choices, so the declaration is the structure and cannot drift
// from it; the author does not write `layout`, `shape`, `arrange` or `soWhat`.
// The deck-level variety contract (gates/variety_gates.mjs) then reads the
// choices and blocks a deck built from one of them, before anything is drawn.
//
//   node runtime/author-deck.mjs --types          the catalogue, for the author
//   node runtime/author-deck.mjs <id>.pages.json  compile, gate, write the deck and plan

import { REGISTRY, measureInsight } from "./registry.mjs";
import { trivialChart } from "./gates/craft_gates.mjs";
import { calloutFits } from "./chart-annotations.mjs";
import { sideStatementLayout } from "./figures.mjs";
import { hasPhrase } from "./text-layout.mjs";
import { readFileSync } from "node:fs";

// The limits the page gates hold the page's text to, published in `--types`
// so an author meets them by reading rather than by failing. The title's word
// limit is read from the contract the gates read (weight.json) and checked at
// compile: a 15-word title used to compile, compose and fail at the scene
// check. The line limits are the gates' own (page_gates.py TITLE_LINES,
// TAKEAWAY_LONG; the subtitle's and the bar's are refused as they compose).
const TITLE_WORDS = JSON.parse(readFileSync(new URL("./weight.json", import.meta.url), "utf8")).plan.titleWords;
export const TEXT_LIMITS = Object.freeze({ titleWords: TITLE_WORDS.max, titleTarget: TITLE_WORDS.target, titleLines: 2, subtitleLines: 2, takeawayLines: 3, barLines: 2 });
export const titleWords = (title) => String(title ?? "").replace(/\s*\(\d+\/\d+\)\s*$/, "").trim().split(/\s+/).filter(Boolean).length;

// Where the page's explanation lives. Each maps onto what the composer draws.
export const COMMENTARY = Object.freeze({
  beside: "a commentary column to the right of the exhibit",
  "beside-left": "a commentary column to the left of the exhibit",
  below: "points in a band under the exhibit",
  rail: "one claim in a filled side panel (`rail` text) beside the exhibit",
  "on-exhibit": "callouts on the chart itself (`annotations`), no separate text",
  "in-exhibit": "the explanation lives in the exhibit's cells (an implication column, a findings matrix, labelled cards)",
  captions: "one finding under each panel (`caption` on every exhibit)",
  "so-what-bar": "one implication in a filled bar across the foot of the exhibit (`bar` text); the page's close",
  none: "the exhibit carries the page alone",
});

const CHART = (name) => `chart.${name}`;
// The so-what bar closes whatever the page drew, so it joins every placement
// list of a type whose evidence can end on one implication.
const ANY_TEXT = ["beside", "beside-left", "below", "rail", "so-what-bar"];

/**
 * The catalogue. `forms` maps each allowed form to the exhibit type or page
 * construction it compiles to; `commentary` lists the placements the type can
 * take. `requires` names the content the page must carry.
 */
export const PAGE_TYPES = Object.freeze({
  trend: {
    task: "how a measure moved over time, with the rate or the break marked on the plot",
    forms: { line: CHART("line"), column: CHART("column"), "stacked-column": CHART("stacked-column"), area: CHART("area"),
      "stacked-area": CHART("stacked-area"), combo: CHART("combo"), slope: CHART("slope"), indexed: CHART("line") },
    commentary: [...ANY_TEXT, "on-exhibit"], exhibits: 1, marked: true, periods: true,
  },
  ranking: {
    task: "where every member of the set stands on one measure, the subject marked",
    forms: { bar: CHART("bar"), column: CHART("column"), lollipop: CHART("lollipop"), dumbbell: CHART("dumbbell"), bullet: CHART("bullet"),
      distribution: CHART("bar"), "aligned-bars": "aligned-bars" },
    commentary: [...ANY_TEXT, "on-exhibit"], exhibits: 1, marked: true, minCategories: 4,
  },
  composition: {
    task: "what a whole is made of, and how the mix differs between members or periods",
    forms: { "stacked-bar": CHART("stacked-bar"), "stacked-column": CHART("stacked-column"), marimekko: CHART("marimekko"),
      waffle: CHART("waffle"), donut: CHART("donut"), treemap: CHART("treemap"), pie: CHART("pie") },
    commentary: [...ANY_TEXT, "on-exhibit"], exhibits: 1,
  },
  relationship: {
    task: "how two measures move together across the members",
    forms: { scatter: CHART("scatter"), bubble: CHART("bubble"), "bubble-grid": CHART("bubble-grid") },
    commentary: [...ANY_TEXT, "on-exhibit"], exhibits: 1,
  },
  bridge: {
    task: "what a change between two totals is made of",
    forms: { waterfall: CHART("waterfall") },
    commentary: [...ANY_TEXT, "on-exhibit"], exhibits: 1,
  },
  panels: {
    task: "one question answered for two to four cuts, measures or members side by side",
    // `sequence`: two or three exhibits read left to right with an arrow
    // between each - cause and effect, before and after, input to result.
    forms: { row: "row", grid: "grid", stack: "stack", sequence: "sequence" },
    commentary: ["captions", "below", "so-what-bar", "none"], exhibits: [2, 4],
  },
  scorecard: {
    task: "options or members judged against criteria, each cell coded",
    forms: { harvey: "harvey", heatmap: "heatmap", rag: "rag", lights: "lights", check: "check", bars: "bars",
      progress: "progress", dot: "dot", trend: "trend", binary: "binary" },
    commentary: ["in-exhibit", "beside", "below", "so-what-bar", "none"], exhibits: 1, table: true,
  },
  lookup: {
    task: "measures a reader looks up and compares, grouped under their units",
    forms: { "measure-table": "measure-table", table: "table" },
    commentary: ["in-exhibit", "beside", "below", "so-what-bar", "none"], exhibits: 1, table: true,
  },
  matrix: {
    task: "findings down the side, their evidence in two or three columns across",
    forms: { "findings-matrix": "findings-matrix" },
    commentary: ["in-exhibit"], exhibits: 0, rows: true,
  },
  mechanism: {
    task: "how a system works: its parts, flows, stages or causes",
    forms: Object.fromEntries(["flow", "tree", "cycle", "steps", "framework", "layers", "relationship-network", "funnel",
      "sankey", "quadrants", "matrix", "spectrum", "process", "chevron-process", "zone-matrix", "rank-flow"].map((f) => [f, f])),
    commentary: [...ANY_TEXT, "on-exhibit", "none"], exhibits: 1,
  },
  schedule: {
    task: "what happens when: phases, milestones, workstreams",
    forms: { timeline: "timeline", gantt: "gantt", roadmap: "roadmap" },
    commentary: ["beside", "below", "so-what-bar", "none"], exhibits: 1,
  },
  numbers: {
    task: "a few measured numbers that carry the claim, with the evidence under them",
    forms: { "hero-number": "hero-number", "metric-strip": "metrics-over-exhibit", "fact-grid": "fact-grid", "stat-list": "stat-list" },
    // Every numbers form sets its figures against one exhibit: the proof beside
    // a hero number, the tiles of a grid, the chart under a strip.
    commentary: ["beside", "below", "none"], exhibits: 1,
  },
  parallel: {
    task: "three to six parallel ideas, each headed, often with an icon",
    // `labelled-rows`: two to five rows down the page, each a filled label
    // block with its bullets beside it and, optionally, a number or a small
    // exhibit at the right - three challenges, what changed in each area, a
    // diagnosis. The same reading task as cards, read down instead of across,
    // with room for the evidence each idea rests on.
    forms: { cards: "cards", capsules: "capsules", "arrow-rows": "arrow-rows", "labelled-rows": "labelled-rows" },
    commentary: ["in-exhibit", "below", "so-what-bar", "none"], exhibits: [0, 1],
  },
  profiles: {
    task: "who the named players are, with their marks and the numbers the deck compares",
    forms: { logos: "logos", people: "people", "logo-table": "table", cards: "cards" },
    commentary: ["in-exhibit", "below", "none"], exhibits: 1,
  },
  place: {
    task: "where things are: a network, a footprint, a regional pattern",
    forms: { map: "map" },
    commentary: [...ANY_TEXT, "on-exhibit"], exhibits: 1,
  },
  picture: {
    task: "what the subject looks like: an aircraft, a site, a product",
    forms: { "picture-hero": "picture-hero", "picture-pair": "picture-pair", "picture-strip": "picture-strip", "photo-backdrop": "photo-backdrop" },
    commentary: ["captions", "beside", "below"], exhibits: [0, 1],
  },
  options: {
    task: "two or three options compared on the same terms",
    forms: { compare: "compare", "table-halves": "table-halves", "two-up": "two-up-contrast" },
    commentary: ["in-exhibit", "below", "none"], exhibits: [1, 2],
  },
  argument: {
    task: "a developed argument in prose, where the reasoning is the evidence",
    forms: { memo: "text", sidebar: "sidebar" },
    commentary: ["none"], exhibits: 0,
  },
  statement: {
    task: "one sentence the deck turns on, or the voices behind it",
    forms: { statement: "statement", quotes: "quote-cluster" },
    commentary: ["none"], exhibits: [0, 1],
  },
  summary: {
    task: "the answer and its proof, at the opening or the close",
    forms: { "executive-summary": "executive-summary", takeaways: "takeaways" },
    commentary: ["none"], exhibits: [0, 1],
  },
});

// What kind of evidence settles a claim (the content plan's vocabulary), and
// the shape of the data behind it (the insight log's). A page type can only be
// chosen where the evidence has its shape: a ranking needs the whole peer set,
// a trend a series over time. A page whose evidence lacks the shape is a
// research task, found here rather than by the storyline critic or the review.
export const SETTLES_KINDS = ["count", "share", "rank", "rate", "sequence", "comparison", "structure", "qualitative"];
//
// A shape also has a breadth. A generated deck's chart pages plotted a median
// of five values against about twenty-two on strong decks' pages, because the
// research stopped at the subject and one comparator: a "series" of four years,
// a "peer set" of three. So each chart-bearing shape records how wide its data
// is - `breadth: { periods, series, members, parts, steps }`, or the `data`
// itself (`categories`, `series`, `points`, ...) for the counts to be read
// from - and the insight log refuses a shape narrower than a page needs while
// finding the longer window or the rest of the peer set is still research.
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

/** How wide an insight's data is: its `breadth` counts, over the counts read off its `data`. */
export function breadthOf(insight) {
  const data = insight?.data && typeof insight.data === "object" ? insight.data : null;
  const n = (list) => (Array.isArray(list) ? list.length : undefined);
  const read = {};
  if (data) {
    const rows = n(data.categories) ?? n(data.labels) ?? n(data.points) ?? n(data.rows) ?? n(data.items) ?? n(data.values);
    const series = n(data.series);
    if (insight.shape === "series") Object.assign(read, { periods: rows, series: series ?? 1 });
    if (insight.shape === "peer-set" || insight.shape === "measure-pair") read.members = rows;
    if (insight.shape === "mix") read.parts = data.categories && series ? series : rows;
    if (insight.shape === "bridge" && rows !== undefined) read.steps = rows - 2;
  }
  const counts = { ...read, ...(insight?.breadth && typeof insight.breadth === "object" ? insight.breadth : {}) };
  return Object.fromEntries(Object.entries(counts).filter(([, v]) => Number.isFinite(v)));
}

/**
 * Why an insight's data is too narrow for its shape, or null. A chart-bearing
 * shape with no breadth recorded is refused with what to record, so a log
 * written before breadth was recorded names every insight to update at once.
 */
export function breadthProblem(insight) {
  const shape = SHAPES[insight?.shape];
  if (!shape?.needs) return null;
  const id = insight.id ?? "?", counts = breadthOf(insight);
  if (!Object.keys(counts).length)
    return `${id} (${insight.shape}): record how wide its data is - \`breadth: { ${BREADTH_KEYS[insight.shape].map((k) => `${k}: n`).join(", ")} }\` or the \`data\` itself - so the pages resting on it can be held to what a ${insight.shape} is: ${shape.means}`;
  if (shape.needs(counts)) return null;
  return `${id} (${insight.shape}): the data has ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")}; a ${insight.shape} is ${shape.means}. ` +
    `That is a research task before any page is written: find ${shape.deepen}. If the data does not exist, record the shape it has (\`fact\`) and carry it on a numbers page`;
}

// The exhibit family each type reads as, for its reading task (reading-tasks.json).
const FAMILY = { trend: "chart", ranking: "chart", composition: "chart", relationship: "chart", bridge: "chart",
  scorecard: "table", lookup: "table", matrix: "table", mechanism: "diagram", schedule: "diagram",
  argument: "text", statement: "text", summary: "text" };
export const familyOf = (type, form) => (type === "profiles" && form === "logo-table") || (type === "options" && form !== "two-up") ? "table" : FAMILY[type] ?? "exhibit";

// Keys the compiler owns. Written by the author they would bypass the choices.
const OWNED = ["layout", "shape", "arrange", "soWhat", "pageType"];
// Keys of a typed page that are choices or authoring notes, not slide keys.
const CHOICE_KEYS = ["type", "form", "commentary", "takeaway", "why", "series", "rail", "bar", "settles", "adds", "evidence"];

const PERIOD = /^(?:(?:19|20)\d{2}(?:[EFP]|\s*[EF])?|FY\s?'?\d{2,4}.*|[QH][1-4]\b.*|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b.*|\d{4}[-–/]\d{2,4}.*)$/i;
const exhibitsOf = (page) => [page.exhibit, ...(page.exhibits || [])].filter((e) => e && typeof e === "object");

/** Does a chart mark anything on the plot: a callout, a highlight, a reference, a rate? */
export function markedChart(ex) {
  // Only what the chart renderers draw: a key they ignore would pass here and
  // leave the plot bare.
  const lists = ["annotations", "highlights", "referenceLines", "events", "changeAnnotations"];
  return lists.some((key) => Array.isArray(ex?.[key]) && ex[key].length > 0)
    || ["change", "cagr", "growth", "focusSeries"].some((key) => ex?.[key] !== undefined && ex[key] !== false);
}

// How many values an exhibit plots: every number a reader can read off it - a
// bar, a point on a line, a slice, a dot on a scatter, a box's five figures, a
// cell with a number in it (the row label is not one). A waffle counts its
// parts, not its squares: the squares are one count drawn out. A chart group
// is the sum of its charts, a page the sum of its exhibits.
const finite = (v) => v !== null && v !== "" && typeof v !== "boolean" && !Array.isArray(v) && typeof v !== "object" && Number.isFinite(Number(v));
const counted = (list) => (Array.isArray(list) ? list.filter(finite).length : 0);
const TABLE_TYPES = new Set(["table", "comparison-table", "heatmap", "trend-rows", "insight-tree-table"]);
function numericCells(ex) {
  const cellText = (c) => (c && typeof c === "object" ? (finite(c.value) ? String(c.value) : String(c.text ?? c.label ?? "")) : String(c ?? ""));
  return (ex.rows || []).reduce((n, row) => n + (Array.isArray(row) ? row : row?.cells || []).slice(Array.isArray(row) ? 1 : 0)
    .filter((c) => /\d/.test(cellText(c))).length, 0);
}
export function plottedValues(ex) {
  if (Array.isArray(ex)) return ex.reduce((n, e) => n + plottedValues(e), 0);
  if (!ex || typeof ex !== "object") return 0;
  const type = String(ex.type ?? "");
  if (type === "chart-group") return (ex.charts || []).reduce((n, c) => n + plottedValues({ type: c?.component, ...(c?.props || {}) }), 0);
  if (type === "chart.waffle") return (ex.categories || []).length;
  if (TABLE_TYPES.has(type)) return numericCells(ex);
  if (Array.isArray(ex.boxes)) return ex.boxes.length * 5;
  if (Array.isArray(ex.low) && Array.isArray(ex.high)) return counted(ex.low) + counted(ex.high);
  if (Array.isArray(ex.series) && ex.series.length)
    return ex.series.reduce((n, s) => n + (Array.isArray(s?.points) ? s.points.length : counted(s?.values)), 0) + counted(ex.targets);
  if (Array.isArray(ex.points)) return ex.points.length;
  if (Array.isArray(ex.values)) return ex.values.flat().filter(finite).length;
  if (Array.isArray(ex.items)) return ex.items.reduce((n, item) => n + (Array.isArray(item?.values) ? counted(item.values) : finite(item?.value) ? 1 : 0), 0);
  if (Array.isArray(ex.markers)) return ex.markers.length;
  return 0;
}

// The evidence floor for a chart page. Strong consulting decks' chart pages
// plot a median of about 22 values (the middle half 10 to 48); a generated
// fifty-page deck plotted a median of 5, because every type's minimum - four
// periods, four members - was a single series at its least. The floor sits
// under strong decks' lower quartile, so it refuses only what they rarely
// draw, one series of four to seven values, and each way of deepening clears
// it in one move: a second series doubles a four-period trend, a peer set of
// eight fills a ranking.
//   - A bridge's steps are the drivers the change has; splitting a driver to
//     reach eight bars would invent precision. Start, three steps and end is
//     the least that decomposes a change rather than restating two totals.
//   - One whole's parts (pie, donut, treemap, waffle) number what the whole
//     has - a pie holds five at most, and small counts are sent to the waffle
//     - so the form is not floored; the deck's median still counts them.
// The deck-level median (variety_gates.mjs EVIDENCE_DEPTH) holds the rest.
export const EVIDENCE_FLOOR = Object.freeze({ chart: 8, bridge: 5 });
const CHART_TYPES = ["trend", "ranking", "composition", "relationship", "bridge"];
const WHOLE_PARTS = ["pie", "donut", "treemap", "waffle"];
const isChartExhibit = (ex) => /^chart[.-]/.test(String(ex?.type ?? ""));
/** Is this a chart page: a chart type, or panels that carry a chart? */
export const chartPage = (type, exhibits) => CHART_TYPES.includes(type) || (type === "panels" && exhibits.some(isChartExhibit));
const DEEPEN = {
  trend: "a longer window (eight or more periods), or the peers or a benchmark over the same periods as further series - form `indexed` sets the subject against three or more peers",
  ranking: "the whole peer set (form `distribution` sorts fifteen to forty members), the prior period as a second series (form `dumbbell`), or several measures for the same members (form `aligned-bars`)",
  composition: "the mix for each member or each period side by side (form `stacked-bar` or `stacked-column`)",
  relationship: "every member of the set as a point, eight or more",
  bridge: "the drivers of the change, one step each - three or more between the totals",
  panels: "each panel the whole set or the series over time, not a pair of numbers",
};

// What each component can hold, as its renderer enforces it: published in the
// catalogue and checked at compile, so an author learns a donut's five-part
// limit from `--types`, not from a failed composition.
export const LIMITS = Object.freeze({
  "chart.pie": { key: "labels", min: 2, max: 5 }, "chart.donut": { key: "labels", min: 2, max: 5 },
  "chart.slope": { key: "categories", min: 2, max: 4 }, "chart.treemap": { key: "items", min: 2, max: 20 },
  "chart.sparklines": { key: "items", min: 2, max: 12 }, cycle: { key: "items", min: 3, max: 6 }, steps: { key: "items", min: 3, max: 6 },
  people: { key: "items", min: 2, max: 5 }, logos: { key: "items", min: 2, max: 12 }, cards: { key: "items", min: 2, max: 6 },
  takeaways: { key: "items", min: 2, max: 5 }, gantt: { key: "periods", min: 2 },
  // A figure is a number, not a phrase: the renderers refuse a longer value.
  "stat-list": { key: "items", min: 2, max: 6, valueChars: 9 }, "fact-grid": { key: "items", min: 3, max: 9, valueChars: 10 },
  "chart.waffle": { key: "categories", min: 2 },
  // Page constructions, checked on the page: a row block past five is too
  // short to hold its bullets, and a sequence past three is a process diagram.
  "labelled-rows": { key: "blocks", min: 2, max: 5 }, sequence: { key: "exhibits", min: 2, max: 3 },
  // Forms built for many values, held by the form rather than the component:
  // a distribution is the whole field sorted - under fifteen members it is an
  // ordinary ranking, past forty the bars are too thin to label; aligned bars
  // are two to four measures, as many columns as the page's width holds (two
  // beside a text column, measured); an indexed line sets the subject against
  // three or more peers, and past eight lines the grey peers cannot be told apart.
  "ranking/distribution": { key: "categories", min: 15, max: 40 }, "ranking/aligned-bars": { key: "series", min: 2, max: 4 },
  "trend/indexed": { key: "series", min: 4, max: 8 },
});
/** The limit a page's primary exhibit is held to: its form's, else its component's. */
const limitOf = (type, form, target) => LIMITS[`${type}/${form}`] ?? LIMITS[target];
// Callouts a chart carries before the plot runs out of clear corridors: past
// three, the fourth note is commentary and belongs beside the chart.
export const CALLOUTS_MAX = 3;
// The rail's panel is a third of the body row; its statement is set at heading
// size and runs to eight lines, measured here the way the renderer sets it.
const RAIL_WIDTH = 373;
export const railFits = (text) => { try { sideStatementLayout({ x: 0, y: 0, width: RAIL_WIDTH, height: 600 }, { text }); return true; } catch { return false; } };
// The so-what bar runs the body's width and holds two lines: one implication,
// measured the way the insight band sets it. A third line is an argument, and
// an argument belongs beside the exhibit.
const BAR_WIDTH = 1160;
export const barFits = (text) => (measureInsight({ x: 0, y: 0, width: BAR_WIDTH, height: 400 }, { text, variant: "primary" }).body?.lines?.length ?? 99) <= 2;
// A row block's label is a name set bold on the house colour, not a sentence:
// it has to read at a glance down the left edge.
const BLOCK_LABEL_WORDS = 5, BLOCK_CHART_ROWS = 2;

// The least a page of each type carries to be worth a page. Below it the type
// was chosen for less evidence than it needs: a three-phase roadmap, a two-part
// pie and a four-row matrix each left half a page empty on a real deck.
const MINIMUM = Object.freeze({
  composition: (ex, form) => form === "waffle"
    ? ((ex.series || []).length === 1 && (ex.categories || []).length >= 2) || "a waffle counts the members of each part - `categories` for the parts and one series of whole counts"
    : ["pie", "donut", "treemap"].includes(form)
    ? ((ex.labels || ex.items || []).length >= 3 || "a share of one thing is a numbers page - a composition shows three or more parts")
    : ((ex.categories || []).length >= 2 && (ex.series || []).length >= 2) || (ex.series || []).length >= 3 || "a composition compares the mix across two or more members or periods, or shows three or more parts",
  schedule: (ex, form) => form === "gantt" ? true : (ex.items || []).length >= 4 || "a timeline or roadmap of three items is a strip, not a page - four or more dated items, or pair it with the evidence behind them as panels",
  parallel: (ex) => (ex.items || []).length >= 3 || "three or more parallel ideas",
  mechanism: (ex) => ["nodes", "items", "stages", "layers", "branches", "pillars", "quadrants", "points", "flows"].some((key) => Array.isArray(ex[key]) && ex[key].length >= 3) || "a mechanism has three or more parts",
  relationship: (ex) => (ex.points || ex.rows || []).length >= 5 || "a relationship needs five or more members to show one",
  bridge: (ex) => (ex.categories || []).length >= 4 || "a bridge has a start, two or more steps and an end",
});

// The data an exhibit type reads, from its registered sample: what an author
// has to supply, as against styling (heading, unit, annotations, ...).
const STYLING = new Set(["heading", "unit", "annotations", "highlights", "focusSeries", "active", "treatment", "placement", "arrangement",
  "attributionAlign", "variant", "conclusion", "center", "today", "totals", "targets", "ranges", "highlight", "centerId", "ringOrder", "referenceLines", "legend", "dataLabels"]);
// Page constructions that are not registered components, with what they read.
const CONSTRUCTION_DATA = {
  "hero-number": ["kpi"], "metrics-over-exhibit": ["metrics", "exhibit"], "findings-matrix": ["rows (each with cells)"], "measure-table": ["columns", "rows"],
  text: ["paragraphs"], sidebar: ["panel", "paragraphs"], statement: ["text"], "executive-summary": ["points"], takeaways: ["items"],
  "picture-hero": ["pictures"], "picture-pair": ["pictures"], "picture-strip": ["pictures"], "photo-backdrop": ["photo", "exhibit"],
  "two-up-contrast": ["exhibits"], "table-halves": ["exhibits"], row: ["exhibits"], grid: ["exhibits"], stack: ["exhibits"], sequence: ["exhibits"],
  "labelled-rows": ["blocks (each a `label` of five words at most, two to four `points`, and on every row or none a `metric` { value, label } or a small `exhibit` - a two-row table, or a headed chart on a page of two blocks)"],
  "aligned-bars": ["categories", "series (one per measure: name, unit, values)", "highlights (the subject)"],
};
// Forms that read more than their component's sample says.
const FORM_DATA = {
  "argument/memo": ["paragraphs (150 to 330 words)", "panel ({ text, kicker }: the conclusion or the figures to keep, down the right)"],
  "trend/indexed": ["categories", "series (raw values, the subject and three or more peers)", "indexBase (the period set to 100)", "subject (the series in colour)"],
  "ranking/distribution": ["categories (15 to 40 members, sorted by the value)", "series (one measure)", "highlights (the subject)"],
};
export function dataKeys(exhibitType, { type, form } = {}) {
  if (FORM_DATA[`${type}/${form}`]) return FORM_DATA[`${type}/${form}`];
  if (CONSTRUCTION_DATA[exhibitType]) return CONSTRUCTION_DATA[exhibitType];
  const sample = REGISTRY.get(exhibitType)?.sample;
  return sample ? Object.keys(sample).filter((key) => !STYLING.has(key)) : [];
}

/**
 * The forms built for many values, checked and set up from what the author
 * wrote. An indexed trend is rebased here, so the author supplies the raw
 * series and no line is indexed by hand; a distribution is the whole field
 * sorted with the subject marked; aligned bars are one category axis with a
 * column per measure.
 */
function formExhibit(id, page, ex) {
  const cats = (ex.categories || []).map(String);
  const series = Array.isArray(ex.series) ? ex.series : [];
  if (page.type === "trend" && page.form === "indexed") {
    const at = cats.indexOf(String(ex.indexBase));
    if (at < 0) throw new Error(`${id}: an indexed trend names its base period in \`indexBase\` - one of its categories - and sets every line to 100 there`);
    if (!series.some((s) => s?.name === ex.subject)) throw new Error(`${id}: an indexed trend names its \`subject\` - the series drawn in colour while the peers stay grey`);
    ex.series = series.map((s) => {
      const base = Number(s?.values?.[at]);
      if (!(base > 0)) throw new Error(`${id}: "${s?.name}" has no positive value at ${ex.indexBase} to index from; choose a base period every series reports`);
      return { ...s, values: s.values.map((v) => (finite(v) ? Math.round((Number(v) / base) * 1000) / 10 : v)) };
    });
    // Every line passes through 100 at the base and the unit names it; a
    // labelled base line was tried and its label sat on the peers' lines.
    ex.focusSeries = ex.subject;
    if (!String(ex.heading ?? "").trim()) ex.heading = `Index, ${ex.indexBase} = 100`;
    else if (!ex.unit) ex.unit = `Index, ${ex.indexBase} = 100`;
    delete ex.indexBase; delete ex.subject;
  }
  if (page.type === "ranking" && page.form === "distribution") {
    if (series.length !== 1) throw new Error(`${id}: a distribution plots one measure across the field - one series; several measures for the same members are form "aligned-bars"`);
    const v = (series[0].values || []).map(Number);
    if (!(v.every((x, i) => !i || x <= v[i - 1]) || v.every((x, i) => !i || x >= v[i - 1])))
      throw new Error(`${id}: a distribution is sorted - order the members by the value, so the subject's place in the field is where it stands`);
    if (!(ex.highlights || []).some((h) => cats.includes(String(h?.category))))
      throw new Error(`${id}: a distribution marks the subject - \`highlights: [{ category }]\` naming one of its members`);
  }
  if (page.type === "ranking" && page.form === "aligned-bars") {
    if (page.commentary === "on-exhibit") throw new Error(`${id}: aligned bars carry no callouts - a callout on one column pushes its bars out of line with the others; choose "beside", "below" or "rail"`);
    // Each column needs about two hundred pixels for its bars and their values:
    // beside a text column the exhibit holds two, across the page four.
    if (["beside", "beside-left", "rail"].includes(page.commentary) && series.length > 2)
      throw new Error(`${id}: aligned bars beside a text column hold two measures; ${series.length} need the page's width - choose commentary "below"`);
    const bad = series.find((s) => typeof s?.name !== "string" || !s.name.trim() || !Array.isArray(s.values) || s.values.length !== cats.length);
    if (!cats.length || bad) throw new Error(`${id}: aligned bars list the members once in \`categories\` and give each measure as a series - \`{ name, unit, values }\`, one value per member${bad ? ` ("${bad?.name ?? "?"}" does not)` : ""}`);
  }
}

/** Aligned bars as the composer draws them: a chart group of bar charts on one category axis. */
function alignedBarsGroup(ex) {
  const { categories, series, highlights = [], valueFormat, type, ...rest } = ex;
  return { ...rest, type: "chart-group", aligned: true, charts: series.map((s) => ({ heading: s.name, ...(s.unit ? { unit: s.unit } : {}), component: "chart.bar",
    props: { categories, series: [{ name: s.name, values: s.values }], highlights, ...(s.valueFormat ?? valueFormat ? { valueFormat: s.valueFormat ?? valueFormat } : {}) } })) };
}
const words = (text) => String(text ?? "").trim().split(/\s+/).filter(Boolean);
const overlap = (a, b) => { const x = new Set(words(a).map((w) => w.toLowerCase())); const y = words(b).map((w) => w.toLowerCase()); return y.length ? y.filter((w) => x.has(w)).length / y.length : 0; };

const choose = (id, axis, allowed, value) =>
  `${id}: choose \`${axis}\` - one of ${allowed.map((v) => `"${v}"`).join(", ")}${value === undefined ? "" : ` (got ${JSON.stringify(value)})`}. There is no default: the choice is what makes this page different from the last one.`;

/**
 * The structural signature of a composed slide: what the compiler set. A
 * build compares it with the one recorded at compile time, so a hand edit to
 * the structure after authoring is caught rather than trusted.
 */
export function structureOf(slide) {
  return [slide.kind ?? "", slide.layout ?? "", slide.shape ?? "", slide.role ?? "", slide.arrange ?? "",
    slide.soWhat ? "close" : "", exhibitsOf(slide).map((e) => e.type ?? "").join("+"),
    (slide.points || []).length ? "points" : "", slide.panel ? "rail" : ""].join("|");
}

// How an exhibit reads at a glance: a plot, a grid of cells, or a drawn figure.
const exhibitFamily = (ex) => (String(ex?.type ?? "").startsWith("chart.") ? "chart"
  : ["table", "rows", "compare", "phase-table"].includes(ex?.type) ? "table" : "figure");

/**
 * The page as a reader sees it before reading a word: how the body is laid
 * out, how many exhibits of which family, whether a text column or points sit
 * with them, and how the page closes. The variety contract counts repeats of
 * this, not of the declared type: a trend beside its points and a stat list
 * beside its points declare two types and draw one page, and fifty such pages
 * read as one page repeated whatever they declared.
 *
 * Mirrored columns are one skeleton - the reader does not notice which side
 * the column is on. And beside a text column the exhibit's family drops out:
 * that page reads as "an exhibit with its column" whether the exhibit is a
 * chart, a table or a figure. Where the exhibit carries the page alone, its
 * family is what the reader sees, so it stays.
 */
export function skeletonOf(slide) {
  const exhibits = exhibitsOf(slide);
  const column = ["exhibit-left", "exhibit-right"].includes(slide.layout);
  const drawn = column ? "exhibit beside a column"
    : slide.arrange ? `${slide.arrange} of exhibits`
    : slide.shape ?? slide.role ?? (slide.kind && slide.kind !== "content" ? slide.kind : slide.layout ?? "exhibit-full");
  const families = [...new Set(exhibits.map(exhibitFamily))].join("+");
  const close = slide.soWhat ? (slide.soWhat?.style === "bar" ? "so-what bar" : "closing line") : "open";
  return [drawn, exhibits.length ? `${exhibits.length} ${column ? "exhibit" : families}` : "",
    (slide.points || []).length ? "points" : "", slide.panel ? "rail" : "", close].filter(Boolean).join(" · ");
}

/**
 * A labelled-rows page's blocks: each a short label, two to four bullets, and
 * - on every row or on none, so the right-hand column lines up - a number or
 * a small exhibit that is the row's evidence.
 */
function checkBlocks(page, id, exhibits) {
  if (exhibits.length) throw new Error(`${id}: a labelled-rows page carries its evidence in its rows - move the exhibit into a block's \`exhibit\`, or choose form "cards"`);
  const blocks = page.blocks, { min, max } = LIMITS["labelled-rows"];
  if (!Array.isArray(blocks) || blocks.length < min || blocks.length > max)
    throw new Error(`${id}: a labelled-rows page carries ${min} to ${max} \`blocks\` - { label, points, and a metric or exhibit if the rows have evidence }; this one has ${Array.isArray(blocks) ? blocks.length : 0}`);
  blocks.forEach((block, at) => {
    const where = `${id}: block ${at + 1}`;
    if (!block || typeof block !== "object" || typeof block.label !== "string" || !block.label.trim()) throw new Error(`${where} needs its \`label\``);
    if (words(block.label).length > BLOCK_LABEL_WORDS) throw new Error(`${where}: the label "${block.label}" is a sentence; a row's label names the area in ${BLOCK_LABEL_WORDS} words or fewer and its bullets say what happened there`);
    if (!Array.isArray(block.points) || block.points.length < 2 || block.points.length > 4) throw new Error(`${where} carries two to four \`points\` beside its label; it has ${Array.isArray(block.points) ? block.points.length : 0}`);
    const keys = Object.keys(block).filter((key) => !["label", "points", "metric", "exhibit"].includes(key));
    if (keys.length) throw new Error(`${where}: unknown key${keys.length === 1 ? "" : "s"} ${keys.map((k) => `\`${k}\``).join(", ")} - a block is { label, points, metric | exhibit }`);
    if (block.metric && block.exhibit) throw new Error(`${where} carries a \`metric\` or an \`exhibit\` at its right, not both`);
    if (block.metric && !(block.metric.value !== undefined && String(block.metric.value).trim() && block.metric.label)) throw new Error(`${where}: a block's \`metric\` is { value, label }`);
    if (block.metric && String(block.metric.value).length > 10) throw new Error(`${where}: a block's metric is a figure of 10 characters at most ("${block.metric.value}"); put the unit in the label`);
    if (block.exhibit) {
      if (!block.exhibit.type) throw new Error(`${where}: name the block exhibit's \`type\` (chart.bar, chart.column, table, ...)`);
      const keys = CONSTRUCTION_DATA[block.exhibit.type] ? [] : dataKeys(block.exhibit.type);
      if (keys.length && !keys.some((key) => block.exhibit[key] !== undefined)) throw new Error(`${where}: a ${block.exhibit.type} exhibit reads ${keys.map((k) => `\`${k}\``).join(", ")} - none is given`);
    }
  });
  const sides = blocks.filter((block) => block.metric || block.exhibit).length;
  if (sides && sides !== blocks.length) throw new Error(`${id}: ${sides} of ${blocks.length} blocks carry a metric or exhibit at the right; give every row one or none, so the column lines up`);
  // A chart keeps a 100px plot under its heading and above its axis, which a
  // row takes only when the body is split in two: at three rows a two-bar
  // chart came out 12px short. A number or a two-row table fits any row.
  const charts = blocks.filter((block) => String(block.exhibit?.type ?? "").startsWith("chart.")).length;
  if (charts && blocks.length > BLOCK_CHART_ROWS)
    throw new Error(`${id}: a chart at the right of a row needs half the body's height, so it fits a page of ${BLOCK_CHART_ROWS} blocks; with ${blocks.length}, give each row a \`metric\` or a two-row table`);
  const unheaded = blocks.filter((block) => String(block.exhibit?.type ?? "").startsWith("chart.") && !block.exhibit.heading).length;
  if (unheaded) throw new Error(`${id}: a chart in a block carries its \`heading\` - the measure and, with \`unit\`, its unit`);
}

/**
 * Compile one typed page into a deck-spec slide. Throws with the choice to
 * make when a choice is missing or impossible; structural pages (`kind`
 * cover, section, agenda) pass through unchanged.
 */
export function compilePage(pageIn, index = 0, { insights = null, draft = false } = {}) {
  if (!pageIn || typeof pageIn !== "object") throw new Error(`page ${index + 1} is not an object`);
  const page = structuredClone(pageIn);
  const id = page.id ?? `page-${index + 1}`;
  if (!page.type) {
    if (page.kind && ["section", "divider", "agenda", "cover"].includes(page.kind)) return { ...page };
    throw new Error(`${id}: give the page a \`type\` - one of ${Object.keys(PAGE_TYPES).join(", ")} - or a structural \`kind\` (section, agenda). Run \`node runtime/author-deck.mjs --types\` for what each is for.`);
  }
  const type = PAGE_TYPES[page.type];
  if (!type) throw new Error(`${id}: unknown page type "${page.type}"; one of ${Object.keys(PAGE_TYPES).join(", ")}`);
  for (const key of OWNED) if (page[key] !== undefined) throw new Error(`${id}: \`${key}\` is set by the page's choices, not written - choose \`commentary\`, \`form\` and \`takeaway\` instead`);
  const forms = Object.keys(type.forms);
  if (!forms.includes(page.form)) throw new Error(choose(id, "form", forms, page.form));
  if (!type.commentary.includes(page.commentary)) throw new Error(choose(id, "commentary", type.commentary, page.commentary));
  // Row blocks carry their explanation in their own bullets; a band of points
  // under five rows of bullets says it twice.
  if (page.form === "labelled-rows" && !["in-exhibit", "so-what-bar"].includes(page.commentary))
    throw new Error(choose(id, "commentary", ["in-exhibit", "so-what-bar"], page.commentary).replace("There is no default", "Each row's bullets are the commentary; there is no default"));
  if (page.takeaway === undefined || !(page.takeaway === false || (typeof page.takeaway === "string" && page.takeaway.trim())))
    throw new Error(`${id}: choose \`takeaway\` - false, or the closing sentence. Strong decks close about one page in ten on a line; most let the title carry the message.`);
  if (page.commentary === "so-what-bar" && page.takeaway !== false)
    throw new Error(`${id}: the so-what bar is the page's close; set \`takeaway: false\` - a closing line under the bar says the implication twice`);
  if (page.bar !== undefined && page.commentary !== "so-what-bar")
    throw new Error(`${id}: \`bar\` is the text of a so-what bar - choose commentary "so-what-bar" for it, or drop it`);
  if (typeof page.why !== "string" || page.why.trim().split(/\s+/).length < 4)
    throw new Error(`${id}: say in \`why\` why a ${page.type} page (${type.task}) is the right one for this claim`);
  const said = titleWords(page.title);
  if (said > TEXT_LIMITS.titleWords)
    throw new Error(`${id}: TITLE_WORDS - the title runs to ${said} words and the build refuses past ${TEXT_LIMITS.titleWords}; cut it to the claim, ${TEXT_LIMITS.titleTarget} words or fewer sets on one line`);

  // The content decisions, made before the layout ones and checked first:
  // what settles the claim, and what the commentary adds. With an insight log
  // the page names the insights it rests on, and they settle it.
  let settles = page.settles;
  const evidence = Array.isArray(page.evidence) ? page.evidence : [];
  if (insights) {
    const needs = TYPE_SHAPES[page.type];
    if (needs && !evidence.length) throw new Error(`${id}: name the insights this ${page.type} page rests on in \`evidence\` (ids from the insight log)`);
    const found = evidence.map((key) => insights.get(key));
    const unknown = evidence.filter((key, i) => !found[i]);
    if (unknown.length) throw new Error(`${id}: \`evidence\` names ${unknown.join(", ")}, which the insight log does not hold`);
    if (needs && !found.some((item) => needs.includes(item.shape)))
      throw new Error(`${id}: a ${page.type} page needs evidence shaped as ${needs.map((s) => `${s} (${SHAPES[s].means})`).join(" or ")}; its insights are ${[...new Set(found.map((i) => i.shape ?? "unshaped"))].join(", ")}. Find that data, or choose the type the evidence supports`);
    if (!settles && found.length) {
      const lead = found.find((item) => !needs || needs.includes(item.shape)) ?? found[0];
      settles = { kind: SHAPES[lead.shape]?.kind ?? "qualitative", what: found.map((item) => item.finding).join(" ") };
    }
  }
  if (!["statement", "summary"].includes(page.type)) {
    if (!settles || !SETTLES_KINDS.includes(settles.kind) || typeof settles.what !== "string" || !settles.what.trim())
      throw new Error(`${id}: say what settles the claim - \`settles: { kind, what }\`, kind one of ${SETTLES_KINDS.join(", ")}${insights ? ", or name its insights in `evidence`" : ""}`);
  }
  if (page.adds !== undefined && page.adds !== null && typeof page.adds !== "string") throw new Error(`${id}: \`adds\` is what the commentary says that the exhibit cannot - a sentence, or null`);

  const slide = {};
  for (const [key, value] of Object.entries(page)) if (!CHOICE_KEYS.includes(key)) slide[key] = value;
  const target = type.forms[page.form];
  const exhibits = exhibitsOf(page);
  const [lo, hi] = Array.isArray(type.exhibits) ? type.exhibits : [type.exhibits, type.exhibits];
  if (exhibits.length < lo || exhibits.length > hi)
    throw new Error(`${id}: a ${page.type} page carries ${lo === hi ? lo : `${lo} to ${hi}`} exhibit${hi === 1 ? "" : "s"}; this one has ${exhibits.length}`);
  if (page.blocks !== undefined && page.form !== "labelled-rows") throw new Error(`${id}: \`blocks\` are the rows of a labelled-rows page - choose type "parallel", form "labelled-rows", or drop them`);
  if (page.form === "labelled-rows") checkBlocks(page, id, exhibits);

  // The form sets the exhibit's type, so the form is the choice that counts.
  const setType = (ex, value) => {
    if (ex.type !== undefined && ex.type !== value) throw new Error(`${id}: form "${page.form}" draws ${value}, but the exhibit says type "${ex.type}"; drop the exhibit's type and let the form set it`);
    ex.type = value;
  };
  if (target.startsWith("chart.") || target === "aligned-bars" || ["mechanism", "schedule"].includes(page.type) || (page.type === "profiles" && page.form !== "logo-table")
      || (page.type === "parallel" && exhibits.length) || (page.type === "numbers" && ["fact-grid", "stat-list"].includes(page.form))) {
    if (!exhibits.length) throw new Error(`${id}: form "${page.form}" needs its exhibit`);
    setType(slide.exhibit ?? slide.exhibits[0], target);
  }

  if (page.type === "profiles" && page.form === "logo-table") {
    setType(slide.exhibit, "table");
    if (!(slide.exhibit.columns || []).some((c) => c && typeof c === "object" && c.type === "logo"))
      throw new Error(`${id}: a logo table introduces each player by its mark - give it a \`type: "logo"\` column`);
  }
  if (page.type === "picture") {
    if (page.form === "photo-backdrop" ? !(page.photo && exhibits.length) : !(page.pictures || []).length)
      throw new Error(`${id}: ${page.form === "photo-backdrop" ? "a photo-backdrop page carries a `photo` and one exhibit" : `a ${page.form} page carries its \`pictures\``}`);
  }

  // Types the form implies for every exhibit it carries, set before any check reads them.
  if (page.type === "place") setType(slide.exhibit, "map");
  if (type.table && slide.exhibit) setType(slide.exhibit, "table");
  if (page.type === "statement" && page.form === "quotes" && slide.exhibit) setType(slide.exhibit, "quote-cluster");
  if (page.type === "options" && page.form === "compare" && slide.exhibit) setType(slide.exhibit, "compare");
  const untyped = [slide.exhibit, ...(slide.exhibits || [])].filter((ex) => ex && typeof ex === "object" && !ex.type);
  if (untyped.length) throw new Error(`${id}: ${untyped.length === 1 ? "the exhibit has" : `${untyped.length} exhibits have`} no \`type\`; a ${page.type}/${page.form} page does not set it, so name it (table, chart.bar, map, ...)`);
  const primary = slide.exhibit ?? slide.exhibits?.[0];
  // The exhibit carries the data its form reads, named before the build has to.
  for (const ex of [slide.exhibit, ...(slide.exhibits || [])].filter(Boolean)) {
    const keys = CONSTRUCTION_DATA[ex.type] ? [] : dataKeys(ex.type);
    if (keys.length && !keys.some((key) => ex[key] !== undefined))
      throw new Error(`${id}: a ${ex.type} exhibit reads ${keys.map((k) => `\`${k}\``).join(", ")} - none is given`);
  }
  // What the component can hold, and what the type needs to be worth a page.
  for (const ex of [slide.exhibit, ...(slide.exhibits || [])].filter(Boolean)) {
    const limit = LIMITS[ex.type], n = limit && Array.isArray(ex[limit.key]) ? ex[limit.key].length : null;
    if (n !== null && (n < limit.min || (limit.max && n > limit.max)))
      throw new Error(`${id}: a ${ex.type} holds ${limit.min}${limit.max ? ` to ${limit.max}` : " or more"} ${limit.key}; this one has ${n}`);
    const long = limit?.valueChars && (ex.items || []).find((item) => String(item?.value ?? "").length > limit.valueChars);
    if (long) throw new Error(`${id}: a ${ex.type} value is a figure of ${limit.valueChars} characters at most ("${long.value}"); put the unit in the label`);
    if (ex.type?.startsWith("chart.") && (ex.annotations || []).length > CALLOUTS_MAX)
      throw new Error(`${id}: a chart carries ${CALLOUTS_MAX} callouts at most (this one has ${ex.annotations.length}); the rest is commentary - choose "beside" or "rail" for it`);
  }
  const formLimit = primary && LIMITS[`${page.type}/${page.form}`];
  if (formLimit) {
    const n = Array.isArray(primary[formLimit.key]) ? primary[formLimit.key].length : 0;
    if (n < formLimit.min || n > formLimit.max) throw new Error(`${id}: form "${page.form}" holds ${formLimit.min} to ${formLimit.max} ${formLimit.key}; this one has ${n}`);
  }
  if (primary) formExhibit(id, page, primary);
  const minimum = primary && MINIMUM[page.type]?.(primary, page.form);
  if (typeof minimum === "string") throw new Error(`${id}: ${minimum}`);
  // Small counts are counted, not shared out: fourteen cities as 50% / 29% / 14%
  // / 7% of a pie reads as precision the count does not have.
  if (page.type === "composition" && ["pie", "donut", "treemap"].includes(page.form)) {
    const values = (primary.values || (primary.items || []).map((item) => item.value) || []).map(Number);
    const total = values.reduce((a, b) => a + b, 0);
    if (values.length && values.every(Number.isInteger) && total < 25)
      throw new Error(`${id}: ${total} items shared out as percentages overstates a small count - show the counts (form "waffle": the parts as \`categories\`, one series of counts)`);
  }
  if (page.type === "composition" && ["pie", "donut"].includes(page.form)) {
    const values = (primary.values || []).map(Number), total = values.reduce((a, b) => a + b, 0);
    if (values.some((v) => v / total < 0.05)) throw new Error(`${id}: a part under 5% of the whole has no room in a ${page.form} slice; a waffle or a stacked bar shows small parts`);
  }
  if (page.type === "numbers" && page.form === "metric-strip" && exhibits.length !== 1) throw new Error(`${id}: a metric strip sits over one exhibit`);
  // The strip and its exhibit fill the page; the composer has no room for points.
  if (page.type === "numbers" && page.form === "metric-strip" && page.commentary !== "none") throw new Error(`${id}: a metric strip's numbers and exhibit carry the page - choose commentary "none", or a hero-number page for a number with its argument beside it`);
  if (page.type === "panels") {
    const flat = exhibits.filter((ex) => trivialChart(ex));
    if (flat.length) throw new Error(`${id}: ${flat.length} panel${flat.length === 1 ? " plots" : "s plot"} two numbers of one series; two numbers are a metric pair - set them as a numbers page, or give each panel the whole set or the series over time`);
  }

  // Evidence checks the type makes.
  if (type.marked && !markedChart(primary))
    throw new Error(`${id}: a ${page.type} chart marks its finding on the plot - an annotation, a highlight, a reference line or the rate of change. A bare chart is a picture of the data, not evidence for the title.`);
  if (type.periods && page.form !== "slope") {
    const cats = (primary.categories || []).map(String);
    if (cats.length < 4 || cats.filter((c) => PERIOD.test(c.trim())).length < Math.ceil(cats.length * 0.75))
      throw new Error(`${id}: a trend runs over four or more periods (years, quarters, months); this one has ${cats.length} categories. Two or three periods are a comparison: use numbers or ranking.`);
  }
  if (type.minCategories && (primary.categories || primary.rows || []).length < type.minCategories)
    throw new Error(`${id}: a ranking shows the whole set - ${type.minCategories} members or more. Two or three numbers are a metric pair: use a numbers page.`);
  // The evidence floor (EVIDENCE_FLOOR), counted on what the page plots.
  const values = plottedValues(exhibits);
  const isChart = chartPage(page.type, exhibits);
  if (isChart && !(page.type === "composition" && WHOLE_PARTS.includes(page.form))) {
    const floor = page.type === "bridge" ? EVIDENCE_FLOOR.bridge : EVIDENCE_FLOOR.chart;
    if (values < floor) throw new Error(`${id}: this ${page.type} page plots ${values} value${values === 1 ? "" : "s"}; a chart page plots ${floor} or more (strong decks' chart pages plot about 22, the middle half 10 to 48). ` +
      `Deepen the evidence, not the styling: ${DEEPEN[page.type]}. If the data stops here, it is a numbers page - or a research task`);
  }
  if (page.type === "ranking" && page.form === "aligned-bars") {
    if (slide.exhibit) slide.exhibit = alignedBarsGroup(primary); else slide.exhibits = [alignedBarsGroup(primary)];
  }
  if (type.table) {
    if (primary.type !== undefined && primary.type !== "table") throw new Error(`${id}: a ${page.type} page carries a table exhibit`);
    primary.type = "table";
    if (page.type === "scorecard") {
      // A column codes its cells by type, or by the flag the composer turns
      // into one: `heat: true` for a heatmap, `bar: true` for in-cell bars
      // (a bare `type: "bars"` needs a declared scale; the flag builds it).
      const flag = { heatmap: "heat", bars: "bar" }[page.form];
      if (page.form === "bars" && (primary.columns || []).some((c) => c?.type === "bars" && c.bar !== true))
        throw new Error(`${id}: code the bar column with \`bar: true\` - it builds the scale a bare \`type: "bars"\` needs`);
      const coded = (primary.columns || []).some((c) => c && typeof c === "object" && (c.type === page.form || (flag && c[flag] === true)))
        || (primary.rows || []).some((row) => (Array.isArray(row) ? row : row?.cells || []).some((cell) => cell && typeof cell === "object" && cell.type === page.form));
      if (!coded) throw new Error(`${id}: a ${page.form} scorecard codes its cells - give at least one column \`type: "${page.form}"\``);
    }
    if (page.form === "measure-table") slide.shape = "measure-table";
  }
  if (type.rows) {
    if (!Array.isArray(page.rows) || !page.rows.some((row) => Array.isArray(row?.cells))) throw new Error(`${id}: a findings matrix carries \`rows\`, each with a label and \`cells\``);
    slide.shape = "findings-matrix";
  }

  // Commentary: where the explanation lives decides the layout.
  const points = (page.points || []).length;
  const textless = ["on-exhibit", "in-exhibit", "captions", "none"].includes(page.commentary);
  if (page.commentary === "so-what-bar" && points)
    throw new Error(`${id}: commentary "so-what-bar" closes the exhibit on one implication in \`bar\`; the points are a second commentary - fold them into the bar, or choose "beside" or "below"`);
  if (textless && points && !["summary"].includes(page.type))
    throw new Error(`${id}: commentary "${page.commentary}" puts the explanation ${COMMENTARY[page.commentary].replace(/^the /, "")}; move the points there or choose "beside" or "below"`);
  // A draft is the spine: titles, types, data and evidence. The copy checks
  // below wait for the full compile.
  // The finding is marked in each point, not only the first: a page-level
  // phrase is accented where it occurs, so a single phrase lit one point and
  // left the rest grey. `highlight` takes a list - a phrase from each point -
  // or a point carries its own.
  const phrases = (Array.isArray(page.highlight) ? page.highlight : page.highlight ? [page.highlight] : []).map((p) => String(p).toLowerCase());
  const pointTexts = (page.points || []).map((point) => (typeof point === "string" ? point : `${point?.lead ?? ""} ${point?.text ?? ""}`).toLowerCase());
  // A phrase that appears in no point marks nothing. Checked in a draft too,
  // since a draft with its points written would otherwise pass it on to the
  // full compile to find.
  // A labelled-rows page writes its points in its blocks, and is held to the same.
  const blockTexts = page.form === "labelled-rows" ? (page.blocks || []).flatMap((block) => block?.points || [])
    .map((point) => (typeof point === "string" ? point : `${point?.lead ?? ""} ${point?.text ?? ""}`).toLowerCase()) : [];
  // Found as whole words, by the rule the accent is set by (phraseAt): "22"
  // passed here on "FY22" and was then drawn as half a year in the accent.
  const texts = [...pointTexts, ...blockTexts];
  const stray = points || blockTexts.length ? phrases.filter((p) => p && !texts.some((text) => hasPhrase(text, p))) : [];
  if (stray.length) {
    // Quoted as the point writes it: the texts above are lowercased to match.
    const written = [...(page.points || []), ...(page.form === "labelled-rows" ? (page.blocks || []).flatMap((block) => block?.points || []) : [])]
      .map((point) => (typeof point === "string" ? point : `${point?.lead ?? ""} ${point?.text ?? ""}`));
    const partWord = written.find((text) => text.toLowerCase().includes(stray[0]));
    const at = partWord ? partWord.toLowerCase().indexOf(stray[0]) : -1;
    throw new Error(partWord
      ? `${id}: \`highlight\` "${stray[0]}" occurs only inside a longer word or number ("${partWord.slice(Math.max(0, at - 12), at + stray[0].length + 12).trim()}"), so it would light half a word; highlight the whole word or figure as the point writes it`
      : `${id}: \`highlight\` "${stray[0]}" appears in none of the points; use a phrase exactly as a point writes it`);
  }
  if (!draft && points >= 2 && ["beside", "beside-left", "below"].includes(page.commentary)) {
    const marked = (page.points || []).filter((point, at) => (point && typeof point === "object" && point.highlight) || phrases.some((p) => p && hasPhrase(pointTexts[at], p))).length;
    if (marked < Math.ceil(points / 2)) throw new Error(`${id}: mark the finding in each point - ${marked} of ${points} points carry a highlighted phrase; give \`highlight\` a list with a phrase from each point (the number or claim the reader should see first), or \`highlight\` on the point`);
  }
  if (!draft && ["beside", "beside-left", "below"].includes(page.commentary) && !points && !page.paragraphs)
    throw new Error(`${id}: commentary "${page.commentary}" needs the points it places`);
  if (!draft && page.commentary === "on-exhibit" && primary?.type?.startsWith("chart.") && !(primary.annotations || []).length)
    throw new Error(`${id}: commentary "on-exhibit" writes the explanation as callouts on the chart - give the exhibit \`annotations\` ({ category, text })`);
  if (!draft && page.commentary === "captions") {
    const bare = exhibits.filter((e) => !(typeof e.caption === "string" && e.caption.trim()));
    if (page.type === "picture" ? !(page.pictures || []).every((p) => p.label || p.line) : bare.length)
      throw new Error(`${id}: commentary "captions" puts one finding under each panel - every exhibit needs its \`caption\``);
  }
  if (!draft && page.commentary === "captions" && page.type !== "picture") {
    for (const ex of exhibits) {
      if (words(ex.caption).length < 8) throw new Error(`${id}: a caption is the panel's finding in a sentence - eight words or more, not a label ("${ex.caption}")`);
      if (overlap(`${page.title} ${ex.heading ?? ""}`, ex.caption) > 0.7) throw new Error(`${id}: the caption "${ex.caption}" repeats the title or the panel heading; say what this panel shows that the others do not`);
    }
  }
  if (!draft && page.commentary === "on-exhibit" && primary?.type?.startsWith("chart.")) {
    // Each callout is measured the way the chart will set it: a box that holds
    // two lines, so a paragraph belongs in two callouts or beside the chart.
    const long = (primary.annotations || []).filter((a) => !calloutFits(a.text));
    if (long.length) throw new Error(`${id}: ${long.length} callout${long.length === 1 ? " is" : "s are"} too long for the chart's callout box ("${long[0].text}"); a callout holds about twelve words - split it, or choose "beside" for the argument`);
    const said = (primary.annotations || []).reduce((n, a) => n + words(a.text).length, 0);
    if (said < 10) throw new Error(`${id}: moving the explanation onto the chart means writing it there - the callouts carry ${said} words; give them the mechanism and the qualification (10 or more words between them), or choose "beside"`);
  }
  if (page.commentary === "rail") {
    if (!draft && (typeof page.rail !== "string" || words(page.rail).length < 10)) throw new Error(`${id}: commentary "rail" sets one developed claim in the side panel - write it as \`rail\`, ten words or more`);
    if (typeof page.rail === "string" && !railFits(page.rail)) throw new Error(`${id}: the rail runs past its eight lines (about ${railCapacity()} words); it is the page's one claim - cut it, or choose "beside" for an argument`);
    slide.panel = { text: String(page.rail ?? "").trim() || page.title };
  }
  if (page.commentary === "so-what-bar") {
    // The bar is the implication the exhibit leads to, so it is written as one:
    // a sentence long enough to say what follows, short enough for two lines.
    if (!draft && (typeof page.bar !== "string" || words(page.bar).length < 8))
      throw new Error(`${id}: commentary "so-what-bar" closes the page on the implication - write it as \`bar\`, a sentence of eight words or more`);
    if (typeof page.bar === "string" && !barFits(page.bar))
      throw new Error(`${id}: the so-what bar runs past its two lines; it is one implication - cut it, or choose "beside" for an argument`);
    if (typeof page.bar === "string" && overlap(page.title, page.bar) > 0.7)
      throw new Error(`${id}: the bar "${page.bar}" repeats the title; say what follows from the evidence, not what it shows`);
    if (typeof page.bar === "string" && page.bar.trim()) slide.soWhat = { text: page.bar.trim(), style: "bar" };
  }
  const layoutFor = { beside: "exhibit-left", "beside-left": "exhibit-right", below: "exhibit-top", rail: "sidebar" };
  if (page.type === "panels") {
    if (page.form === "grid" && exhibits.length < 3) throw new Error(`${id}: a grid of panels holds three or four; two sit in a row`);
    if (page.form === "sequence") {
      const { min, max } = LIMITS.sequence;
      if (exhibits.length < min || exhibits.length > max) throw new Error(`${id}: a sequence reads left to right in ${min} to ${max} steps; this one has ${exhibits.length} - four are a grid, or a process diagram`);
      // The arrow says "this leads to that"; each step names what it is, or the
      // reader cannot say what led to what.
      const unnamed = exhibits.filter((ex) => !(typeof ex.heading === "string" && ex.heading.trim()));
      if (unnamed.length) throw new Error(`${id}: every step of a sequence carries its \`heading\` - the cause, the change, the result; ${unnamed.length} ${unnamed.length === 1 ? "has" : "have"} none`);
    }
    slide.arrange = page.form;
    if (page.exhibit) { slide.exhibits = [page.exhibit, ...(page.exhibits || [])]; delete slide.exhibit; }
  } else if (page.type === "numbers") {
    if (page.form === "hero-number") { if (!page.kpi) throw new Error(`${id}: a hero-number page names its number as \`kpi\``); slide.layout = "hero-number"; }
    else if (page.form === "metric-strip") { if (!(page.metrics || []).length) throw new Error(`${id}: a metric strip carries \`metrics\``); slide.layout = "metrics-over-exhibit"; }
    else slide.layout = layoutFor[page.commentary] ?? "exhibit-full";
  } else if (page.type === "picture") {
    slide.layout = target;
  } else if (page.type === "parallel" && page.form === "labelled-rows") {
    slide.layout = target;
  } else if (page.type === "options") {
    if (page.form === "compare") setType(primary, "compare");
    else slide.layout = target;
  } else if (page.type === "argument") {
    if (!(page.paragraphs || []).length && !points) throw new Error(`${id}: an argument page carries its \`paragraphs\``);
    slide.layout = target;
    if (page.form === "sidebar" && !page.panel) throw new Error(`${id}: a sidebar argument sets its claim in \`panel\``);
    // A memo's prose runs at a readable measure, which a text page's words
    // fill down but not across: the width it leaves is the panel's. Without
    // one the memo was set in equal columns that needed some 500 words to
    // reach the foot, and every memo page stopped halfway down.
    if (page.form === "memo" && (page.paragraphs || []).length && !page.panel)
      throw new Error(`${id}: a memo sets its prose at a readable measure with a \`panel\` beside it - { text, kicker } carrying the conclusion or the figures the reader keeps - which takes the width the prose leaves`);
  } else if (page.type === "statement") {
    if (page.form === "statement") { slide.kind = "statement"; if (!page.text) throw new Error(`${id}: a statement page carries its \`text\``); }
    else { if (!primary) throw new Error(`${id}: a quotes page carries a quote-cluster exhibit`); setType(primary, "quote-cluster"); }
  } else if (page.type === "summary") {
    if (page.form === "executive-summary") { slide.role = "executive-summary"; if (!points) throw new Error(`${id}: an executive summary carries its developed \`points\``); }
    else { slide.kind = "takeaways"; if (!(page.items || []).length) throw new Error(`${id}: a takeaways page carries its \`items\``); }
  } else if (!type.rows && slide.shape !== "measure-table") {
    slide.layout = layoutFor[page.commentary] ?? "exhibit-full";
  } else if (layoutFor[page.commentary]) {
    slide.layout = layoutFor[page.commentary];
  }

  // Advisories the compiler can see and the author should: they do not block.
  const advisories = [];
  if (page.type === "place" && typeof primary?.geography === "string") {
    const points = (primary.markers || []).filter((m) => Number.isFinite(m?.longitude) && Number.isFinite(m?.latitude));
    const span = points.length > 1 ? Math.max(...points.map((m) => m.longitude)) - Math.min(...points.map((m) => m.longitude)) : 0;
    if (points.length > 1 && span < 20) advisories.push(`MAP_COARSE: the markers span ${span.toFixed(1)} degrees; the built-in 1:110m coastline is coarse at that scale - import a 1:10m or 1:50m geography (runtime/import-geography.mjs) and pass it as \`geography\``);
  }
  if (typeof page.takeaway === "string") slide.soWhat = page.takeaway.trim();
  slide.pageType = { type: page.type, form: page.form, commentary: page.commentary, takeaway: typeof page.takeaway === "string",
    ...(page.series ? { series: String(page.series) } : {}), why: page.why.trim(), family: familyOf(page.type, page.form),
    // What the page plots, for the deck's evidence depth (EVIDENCE_DEPTH) and the author's summary.
    ...(exhibits.length ? { values } : {}), ...(isChart ? { chart: true } : {}),
    ...(advisories.length ? { advisories } : {}),
    // The claim is the title: the build holds the two together.
    content: { claim: String(page.title ?? page.text ?? "").trim(), ...(settles ? { settles } : {}), adds: page.adds ?? null, ...(evidence.length ? { evidence } : {}) } };
  slide.pageType.structure = structureOf(slide);
  // What the variety contract counts: the page as drawn, not as declared.
  slide.pageType.skeleton = skeletonOf(slide);
  return slide;
}

/** The normalized plan-gate architecture a compiled page type stands for. */
export function architectureOf(slide) {
  const t = slide.pageType;
  if (!t) return null;
  if (t.type === "panels") return t.form === "stack" ? "evidence-stack" : "paired-evidence";
  if (t.type === "numbers") return t.form === "hero-number" ? "hero-number-with-evidence" : t.form === "metric-strip" ? "metrics-over-evidence" : "metrics-with-text";
  if (t.type === "picture") return "picture-led";
  if (t.type === "parallel" || t.type === "profiles") return "card-grid";
  if (t.type === "argument" || t.type === "statement" || t.type === "summary") return "text";
  if (t.type === "schedule") return t.form === "gantt" ? "gantt" : t.form === "roadmap" ? "roadmap" : "timeline";
  if (t.type === "mechanism") return ({ tree: "tree", cycle: "cycle", steps: "steps", process: "process", "chevron-process": "chevron-process", flow: "flow",
    quadrants: "quadrants", matrix: "matrix", "relationship-network": "relationship-network" })[t.form] ?? "flow";
  if (t.type === "matrix" || t.type === "scorecard") return "matrix";
  if (t.type === "options") return "paired-evidence";
  if (t.type === "bridge") return "reconciliation";
  return ["on-exhibit", "none", "in-exhibit"].includes(t.commentary) ? "evidence-only" : "evidence-with-commentary";
}

/** How many words of ordinary prose a chart callout holds, by the renderer's own measure. */
export function calloutCapacity() {
  const words = "the operator added capacity on the busiest routes before demand returned in full".split(" ");
  let n = 1;
  while (n < 40 && calloutFits(Array.from({ length: n + 1 }, (_, i) => words[i % words.length]).join(" "))) n += 1;
  return n;
}

/** How many words of ordinary prose the rail's panel holds, by the renderer's own measure. */
export function railCapacity() {
  const words = "the operator added capacity on the busiest routes before demand returned in full".split(" ");
  let n = 1;
  while (n < 120 && railFits(Array.from({ length: n + 1 }, (_, i) => words[i % words.length]).join(" "))) n += 1;
  return n;
}

/** The catalogue as the author reads it. */
export function describeTypes() {
  const lines = ["# Page types", "", "Every analytical page is one of these. Each choice is required; none has a default.", "",
    "`commentary` - where the explanation lives:", ...Object.entries(COMMENTARY).map(([k, v]) => `- \`${k}\`: ${v}`), "",
    "`takeaway` - `false`, or the closing sentence (strong decks close about one page in ten on a line or a band).", "",
    "`bar` - with commentary `so-what-bar`, the implication set in a filled bar across the foot of the exhibit: a sentence of eight words or more that fits two lines. The bar is the page's close, so `takeaway` is `false`, and it counts toward the closing share.", "",
    "Beyond one exhibit and a column: `parallel` form `labelled-rows` sets two to five `blocks` down the page, each a filled label with its bullets and an optional `metric` or small `exhibit` at the right; `panels` form `sequence` joins two or three headed exhibits with arrows (cause to effect, before to after).", "",
    "`why` - one sentence on why this type fits the claim.", "`settles` - { kind, what }, or `evidence` naming insight ids when there is an insight log.", "",
    "`node runtime/author-deck.mjs --example <type>` prints a worked page of any type to start from.", "",
    "`highlight` - on a page with commentary points, a list with the phrase from each point the reader should see first (or `highlight` on the point).", "",
    `Capacities: a chart callout holds about ${calloutCapacity()} words (measured against its box) and a chart ${CALLOUTS_MAX} callouts; a rail about ${railCapacity()} words (eight lines); a stat-list value 9 characters and a fact-grid value 10. A fact-grid takes \`columns\` (1 to 4 tiles across; two rows or more fill the frame, one row grows by a third) and, on any item, \`gauge\` (0 to 1, a bar on the tile's foot). Commentary \`below\` runs up to three points across, four two by two, more three to a row. \`author-deck --check\` prints each page's word floor, ceiling and footer share as the page composes.`, "",
    `Text limits the build holds every page to: a title of ${TEXT_LIMITS.titleWords} words at most (TITLE_WORDS, refused at compile) and ${TEXT_LIMITS.titleLines} lines (TITLE_LINES) - write to ${TEXT_LIMITS.titleTarget}, which sets on one line, since more than a third of titles past it is PLAN_TITLE_LENGTH; a \`subtitle\` ${TEXT_LIMITS.subtitleLines} lines; a chart or panel \`heading\` one line at its frame's width with its unit inline (HEADING_WRAPS - a short unit moves under the heading on its own, a unit written as a phrase does not); a \`takeaway\` ${TEXT_LIMITS.takeawayLines} lines, one or two the norm (TAKEAWAY_LONG); a \`bar\` ${TEXT_LIMITS.barLines} lines; prose 35 to 90 characters a line (CPL). A chart \`heading\` or \`unit\` carries no results: its numbers are a period ("FY26", "2 August 2026"), a sample ("n = 240"), a set size ("top 40"), an index base ("2019 = 100") or a rank scale ("rank, 1 = best").`, "",
    `Evidence: a chart page (trend, ranking, composition, relationship, bridge, panels of charts) plots ${EVIDENCE_FLOOR.chart} or more values - a bridge ${EVIDENCE_FLOOR.bridge}, one whole's parts (pie, donut, treemap, waffle) are not floored - and strong decks' chart pages plot about 22. Deepen with the peer set, a prior period or a benchmark series, or a longer window: forms \`indexed\` (trend), \`distribution\` and \`aligned-bars\` (ranking) are built for many values.`, ""];
  for (const [name, t] of Object.entries(PAGE_TYPES)) {
    const n = Array.isArray(t.exhibits) ? `${t.exhibits[0]}-${t.exhibits[1]}` : t.exhibits;
    const data = Object.entries(t.forms).map(([form, target]) => [form, dataKeys(target, { type: name, form })]).filter(([, keys]) => keys.length);
    lines.push(`## ${name}`, t.task, "", `- form: ${Object.keys(t.forms).join(" | ")}`,
      ...(() => { const limits = Object.entries(t.forms).map(([form, target]) => [form, limitOf(name, form, target)]).filter(([, l]) => l);
        return limits.length ? [`- holds: ${limits.map(([form, l]) => `${form} ${l.min}${l.max ? `-${l.max}` : "+"} ${l.key}${l.valueChars ? ` (values ${l.valueChars} characters at most)` : ""}`).join("; ")}`] : []; })(),
      ...(data.length ? [`- data: ${[...data.reduce((m, [form, keys]) => m.set(keys.join(", "), [...(m.get(keys.join(", ")) || []), form]), new Map())]
        .map(([keys, forms]) => forms.length === data.length ? keys : `${keys} (${forms.join(", ")})`).join("; ")}`] : []), `- commentary: ${t.commentary.join(" | ")}`, `- exhibits: ${n}` +
      (t.marked ? "; the chart marks its finding (annotation, highlight, reference line or rate)" : "") +
      (t.periods ? "; four or more periods" : "") + (t.minCategories ? `; ${t.minCategories}+ members` : "") + (t.rows ? "; `rows` with `cells`" : "") +
      (CHART_TYPES.includes(name) || name === "panels" ? `; plots ${name === "bridge" ? EVIDENCE_FLOOR.bridge : EVIDENCE_FLOOR.chart}+ values${name === "panels" ? " when a panel is a chart" : ""}` : ""), "");
  }
  return lines.join("\n");
}

// The exhibit each many-value form reads, for a harness that generates to the schema.
const FORM_SCHEMA = {
  "trend/indexed": { type: "object", required: ["categories", "series", "indexBase", "subject"],
    properties: { series: { type: "array", minItems: LIMITS["trend/indexed"].min, maxItems: LIMITS["trend/indexed"].max }, indexBase: { type: "string" }, subject: { type: "string" } } },
  "ranking/distribution": { type: "object", required: ["categories", "series", "highlights"],
    properties: { categories: { type: "array", minItems: LIMITS["ranking/distribution"].min, maxItems: LIMITS["ranking/distribution"].max }, series: { type: "array", minItems: 1, maxItems: 1 } } },
  "ranking/aligned-bars": { type: "object", required: ["categories", "series", "highlights"],
    properties: { series: { type: "array", minItems: LIMITS["ranking/aligned-bars"].min, maxItems: LIMITS["ranking/aligned-bars"].max,
      items: { type: "object", required: ["name", "values"], properties: { name: { type: "string" }, unit: { type: "string" }, values: { type: "array" } } } } } },
};

/** A JSON Schema for a typed page, for harnesses that validate or constrain generation. */
export function pageSchema() {
  const typed = Object.entries(PAGE_TYPES).map(([name, t]) => ({
    type: "object",
    required: ["id", "type", "form", "commentary", "takeaway", "why", "title"],
    properties: {
      id: { type: "string" }, type: { const: name }, title: { type: "string" },
      form: { enum: Object.keys(t.forms) }, commentary: { enum: t.commentary },
      takeaway: { oneOf: [{ const: false }, { type: "string", minLength: 8 }] },
      why: { type: "string", minLength: 20 }, series: { type: "string" }, rail: { type: "string" },
      bar: { type: "string", minLength: 8, description: "with commentary so-what-bar: the implication in a filled bar under the exhibit, two lines at most" },
      ...(t.forms["labelled-rows"] ? { blocks: { type: "array", minItems: 2, maxItems: 5, description: "form labelled-rows: the rows down the page", items: {
        type: "object", required: ["label", "points"], additionalProperties: false,
        properties: { label: { type: "string" }, points: { type: "array", minItems: 2, maxItems: 4 },
          metric: { type: "object", required: ["value", "label"] }, exhibit: { type: "object", required: ["type"] } } } } } : {}),
      settles: { type: "object", required: ["kind", "what"], properties: { kind: { enum: SETTLES_KINDS }, what: { type: "string", minLength: 8 } } },
      adds: { oneOf: [{ type: "null" }, { type: "string", minLength: 8 }] },
      evidence: { type: "array", items: { type: "string" }, description: "insight ids from <id>.insights.json; with an insight log, required for data-bearing types and it derives settles" },
    },
    not: { anyOf: OWNED.map((key) => ({ required: [key] })) },
    ...(Object.keys(t.forms).some((form) => FORM_SCHEMA[`${name}/${form}`]) ? { allOf: Object.keys(t.forms).filter((form) => FORM_SCHEMA[`${name}/${form}`])
      .map((form) => ({ if: { properties: { form: { const: form } } }, then: { required: ["exhibit"], properties: { exhibit: FORM_SCHEMA[`${name}/${form}`] } } })) } : {}),
  }));
  const structural = { type: "object", required: ["kind"], properties: { kind: { enum: ["section", "agenda"] } } };
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema", $id: "professional-slides.pages/v1",
    type: "object", required: ["deck", "pages"],
    properties: { deck: { type: "object", description: "the deck-level keys of the deck spec (schema, id, design, identity, cover, players, ...), without slides" },
      pages: { type: "array", items: { oneOf: [...typed, structural] } }, appendix: { type: "array", items: { oneOf: typed } } },
  };
}
