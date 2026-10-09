// Page types: the authoring kit a deck is written through.
//
// A deck written straight into the deck spec, every page through one helper -
// title, three points, a closing line, a source, one exhibit - is one page
// repeated. Strong consulting decks put a closing line on about one page in
// ten and bullets under the exhibit on about one in fifty; their commentary
// sits on the chart, in the table, under each panel, beside the exhibit or
// nowhere, and a quarter of their pages carry two or more exhibits. The
// composer draws all of that, but only a choice made per page reaches it: a
// default taken fifty times is a template.
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

import { REGISTRY } from "./registry.mjs";
import { measureInsight } from "./registry-text.mjs";
import { calloutFits, calloutCapacity, countInWords } from "./chart-annotations.mjs";
import { sideStatementLayout } from "./figures.mjs";
import { hasPhrase, measureText } from "./text-layout.mjs";
import { timePositions, describeGaps, isPeriodLabel, readablePeriod } from "./time-axis.mjs";
import { columnQuestion } from "./compose-tables.mjs";
import { SCALAR_FIGURE } from "./value-format.mjs";
import { focusFromTitle } from "./compose-charts.mjs";
import { REVIEWED, CODED, playerNames } from "./gates/variety_gates.mjs";
import { playerEntries, plannedMark, planPlayerMarks } from "./players.mjs";
import { SHAPES, TYPE_SHAPES, breadthOf, breadthProblem, plottedValues, trivialChart, isTable, rowCells, finite, counted, cellText, rowLabel, resultCells } from "./evidence.mjs";
import { wordBudgetOf } from "./derive-content.mjs";
import { iconDefinition, unknownIcon, ICON_NAMES } from "./icons.mjs";
import { POLARITIES } from "./tables.mjs";
import { waivedRules, predatedRule, ruleIntroduced } from "./weight.mjs";
import { textWordList, textWords, proseParts, PROSE_LEAD_FROM, PROSE_PARAGRAPH_MAX, PROSE_LEAD_WORDS } from "./text-contract.mjs";
import { deckSchema } from "./deck-keys.mjs";
import { registered } from "./errors.mjs";
import { describeFit, rightFor } from "./claim-fit.mjs";
import { judged } from "./judgements.mjs";

// The limits the page gates hold the page's text to, published in `--types`
// so an author meets them by reading rather than by failing, and checked at
// compile. A title sets on one line at about ten words and on two lines at
// fifteen; past them it is carrying the period or scope its `subtitle` is
// for. Strong decks' titles run a median of 10 words, and two in five run past
// twelve - the finding with its comparator and its cause. The page gates hold the same numbers (weight.json
// `plan.titleWords.max`, page_gates.py TITLE_WORDS, TITLE_LINES and
// TAKEAWAY_LONG), and a test holds each pair to one value.
// The executive summary's ceiling, as the budget every check reads sets it.
const SUMMARY_WORDS = wordBudgetOf("text-page", { role: "executive-summary" }).ceiling;
export const TEXT_LIMITS = Object.freeze({ titleWords: 15, titleTarget: 10, titleLines: 2, subtitleLines: 1, takeawayLines: 2, barLines: 2 });
export const titleWords = (title) => textWords(String(title ?? "").replace(/\s*\(\d+\/\d+\)\s*$/, ""));

// Where the page's explanation lives. Each maps onto what the composer draws.
export const COMMENTARY = Object.freeze({
  beside: "a commentary column to the right of the exhibit",
  "beside-left": "a commentary column to the left of the exhibit",
  below: "points in a band under the exhibit",
  rail: "one claim in a filled side panel (`rail` text) beside the exhibit",
  "on-exhibit": "on the chart itself, no separate text: a number mark (`cagr`, `changeAnnotations`, labelled `referenceLines`, `stackTotals`) first, sentence callouts (`annotations`) where the mechanism needs them",
  "in-exhibit": "the explanation lives in the exhibit's cells (an implication column, a findings matrix, labelled cards)",
  captions: "one finding under each panel (`caption` on every exhibit)",
  "so-what-bar": "one implication in a filled bar across the foot of the exhibit (`bar` text); the page's close",
  none: "the exhibit carries the page alone",
});

const CHART = (name) => `chart.${name}`;
// The fewest words a panel beside prose alone holds before it reads as an
// empty column (compilePage, argument pages).
const PANEL_WORDS_MIN = 25;
// The series charts a model page may draw over its data table.
const MODEL_CHARTS = ["chart.column", "chart.line", "chart.area", "chart.stacked-column", "chart.combo"];
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
    // `sparklines`: one small line per member over the same window - the
    // question is which of many series moved, not one series' path; `model`:
    // the series over its own data table, a forecast read with its numbers.
    forms: { line: CHART("line"), column: CHART("column"), "stacked-column": CHART("stacked-column"), area: CHART("area"),
      "stacked-area": CHART("stacked-area"), combo: CHART("combo"), slope: CHART("slope"), indexed: CHART("line"),
      sparklines: CHART("sparklines"), model: "model-page" },
    commentary: [...ANY_TEXT, "on-exhibit"], exhibits: 1, marked: true, periods: 4,
  },
  ranking: {
    task: "where every member of the set stands on one measure, the subject marked",
    // `boxplot`: each member's spread - its range, middle half and median -
    // where one figure per member would hide how far its values run.
    forms: { bar: CHART("bar"), column: CHART("column"), lollipop: CHART("lollipop"), dumbbell: CHART("dumbbell"), bullet: CHART("bullet"),
      distribution: CHART("bar"), "aligned-bars": "aligned-bars", boxplot: CHART("boxplot") },
    commentary: [...ANY_TEXT, "on-exhibit"], exhibits: 1, marked: true, minCategories: 4,
  },
  composition: {
    task: "what a whole is made of, and how the mix differs between members or periods",
    // `pictogram`: a population's share counted in figures - six in ten -
    // for one to five populations, where a percentage reads as precision.
    forms: { "stacked-bar": CHART("stacked-bar"), "stacked-column": CHART("stacked-column"), marimekko: CHART("marimekko"),
      waffle: CHART("waffle"), donut: CHART("donut"), treemap: CHART("treemap"), pie: CHART("pie"), pictogram: "pictogram" },
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
    // `horizons`: the portfolio of bets by when each pays - the core now,
    // growth next, options later - where a timeline would date them as tasks.
    forms: { timeline: "timeline", gantt: "gantt", roadmap: "roadmap", horizons: CHART("horizons") },
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
    // `radar`: each player's profile across three to eight attributes on one
    // scale, where the shape of the profile is the comparison.
    forms: { logos: "logos", people: "people", "logo-table": "table", cards: "cards", radar: CHART("radar") },
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

/**
 * How each of the composer's named presets is reached: the page type, form
 * and commentary that write it, or `internal` with why no page asks for it by
 * name. A preset no page type writes is either a composition some reading
 * task needs - and then it is a form - or a device the composer applies
 * itself; left as neither it is dead code an author reads about and cannot use.
 */
export const PRESET_ROUTES = Object.freeze({
  shapes: {
    "executive-summary": { type: "summary", form: "executive-summary" },
    "findings-matrix": { type: "matrix", form: "findings-matrix" },
    "measure-table": { type: "lookup", form: "measure-table" },
    "model-page": { type: "trend", form: "model" },
    "half-and-half": { internal: "a chart with icon-led points beside it is `exhibit-left`, which commentary \"beside\" draws with `pointsStyle: \"icon-lead\"`; the name adds no composition" },
  },
  layouts: {
    "exhibit-left": { commentary: "beside" }, "exhibit-right": { commentary: "beside-left" }, "exhibit-top": { commentary: "below" },
    "exhibit-full": { type: "trend", form: "line", commentary: "on-exhibit" }, "hero-number": { type: "numbers", form: "hero-number" }, "metrics-over-exhibit": { type: "numbers", form: "metric-strip" },
    "two-up-contrast": { type: "options", form: "two-up" }, "two-up": { type: "panels", form: "row", commentary: "below" },
    "split-tone": { internal: "two captioned exhibits side by side, which is `options` form `two-up`: the toned half it was named for is an alternation a row of panels does not keep (planner.mjs alignRowPanels), so it draws the same page" },
    stack: { type: "panels", form: "stack" }, grid: { type: "panels", form: "grid" }, "table-halves": { type: "options", form: "table-halves" },
    "picture-pair": { type: "picture", form: "picture-pair" }, "picture-strip": { type: "picture", form: "picture-strip" }, "picture-hero": { type: "picture", form: "picture-hero" },
    text: { type: "argument", form: "memo" },
  },
});

// Placements a form cannot draw, narrowed from its type's list: small
// multiples, box plots and pictograms carry no callouts on their marks; a
// radar's profile has no cells to hold the reading; a chart over its own data
// table keeps the table under it, so its commentary sits beside it or on it.
export const FORM_COMMENTARY = Object.freeze({
  "trend/sparklines": [...ANY_TEXT], "ranking/boxplot": [...ANY_TEXT], "composition/pictogram": [...ANY_TEXT],
  "profiles/radar": ["below", "none"], "trend/model": ["beside", "on-exhibit"],
});
const commentaryOf = (type, form) => FORM_COMMENTARY[`${type}/${form}`] ?? PAGE_TYPES[type]?.commentary ?? [];
/**
 * The commentary placements a page of `type` and `form` compiles with: the
 * form's list, less the placements a later compile check refuses for that
 * form - row blocks carry their commentary in their bullets, a metric strip
 * leaves no room for points, aligned bars take no callouts.
 */
export function placementsOf(type, form) {
  const all = commentaryOf(type, form);
  if (form === "labelled-rows") return all.filter((c) => ["in-exhibit", "so-what-bar"].includes(c));
  if (type === "numbers" && form === "metric-strip") return all.filter((c) => c === "none");
  if (type === "ranking" && form === "aligned-bars") return all.filter((c) => c !== "on-exhibit");
  return all;
}

// What kind of evidence settles a claim (the content plan's vocabulary), and
// the shape of the data behind it (the insight log's). A page type can only be
// chosen where the evidence has its shape: a ranking needs the whole peer set,
// a trend a series over time. A page whose evidence lacks the shape is a
// research task, found here rather than by the storyline critic or the review.
// The shapes, their breadth and the values an exhibit plots are evidence.mjs's.
export { breadthOf, breadthProblem, plottedValues };
export const SETTLES_KINDS = ["count", "share", "rank", "rate", "sequence", "comparison", "structure", "qualitative"];

// The exhibit family each type reads as, for its reading task (reading-tasks.json).
const FAMILY = { trend: "chart", ranking: "chart", composition: "chart", relationship: "chart", bridge: "chart",
  scorecard: "table", lookup: "table", matrix: "table", mechanism: "diagram", schedule: "diagram",
  argument: "text", statement: "text", summary: "text" };
export const familyOf = (type, form) => (type === "profiles" && form === "logo-table") || (type === "options" && form !== "two-up") ? "table"
  : type === "profiles" && form === "radar" ? "chart" : FAMILY[type] ?? "exhibit";

// Keys the compiler owns. Written by the author they would bypass the choices.
const OWNED = ["layout", "shape", "arrange", "soWhat", "pageType"];
// Keys of a typed page that are choices or authoring notes, not slide keys.
// `draft` and `sourceSlide` are a revision's: the imported slide's old copy
// and its position in the source deck (runtime/import-deck.py). `limits` is
// the note `--scaffold` and `--example` print on a page - the countable
// limits it is held to (limits.mjs) - which the compiler reads past, so a
// scaffold pasted whole still compiles.
// `only` is a revision's too: the other pages a page composed where a slide stood says state its slide's old figure of another thing (gates/consistency_gates.mjs).
const CHOICE_KEYS = ["type", "form", "commentary", "takeaway", "why", "series", "rail", "bar", "settles", "adds", "evidence", "draft", "sourceSlide", "limits", "only"];

const exhibitsOf = (page) => [page.exhibit, ...(page.exhibits || [])].filter((e) => e && typeof e === "object");

// The charts that draw `targets` (charts-extra.mjs bulletChart): one target line on every row.
const TARGET_CHARTS = new Set(["chart.bullet"]);

/** Does a chart mark anything on the plot: a callout, a highlight, a reference, a rate? */
export function markedChart(ex) {
  // Only what the chart renderers draw: a key they ignore would pass here and
  // leave the plot bare.
  // A bullet chart's mark is the target it sets each measure against
  // (`targets`): it draws no callout or highlight, and the target line on
  // every row is the comparison a ranking is asked to mark. Only there: every
  // other chart ignores the key, and a bare bar chart is not marked by it.
  const lists = ["annotations", "highlights", "events", ...(TARGET_CHARTS.has(ex?.type) ? ["targets"] : [])];
  return lists.some((key) => Array.isArray(ex?.[key]) && ex[key].length > 0) || (ex?.focusSeries !== undefined && ex.focusSeries !== false) || numberMarked(ex);
}

// A number set on the plot: the change or growth rate on an arrow, the gap
// bracketed, a benchmark as a reference line, a stack's total. Strong decks
// mark a chart this way far more often than with a sentence - a signed change
// on one page in eight, a total on one in ten - so a number mark carries the
// page's commentary on the plot, and a sentence callout beside it is optional.
const NUMBER_MARKS = ["changeAnnotations", "referenceLines", "stackTotals", "segmentGrowth", "seriesGrowth", "change", "cagr", "growth"];
export const numberMarked = (ex) => NUMBER_MARKS.some((key) => (Array.isArray(ex?.[key]) ? ex[key].length > 0 : ex?.[key] != null && ex[key] !== false));

// The evidence floor for a chart page. Strong consulting decks' chart pages
// plot a median of about 22 values (the middle half 10 to 48), while a type's
// minimum - four periods, four members - is a single series at its least. The
// floor sits under strong decks' lower quartile, so it refuses only what they
// rarely draw, one series of four to seven values, and each way of deepening
// clears it in one move: a second series doubles a four-period trend, a peer
// set of eight fills a ranking.
//   - A bridge's steps are the drivers the change has; splitting a driver to
//     reach eight bars would invent precision. Start, three steps and end is
//     the least that decomposes a change rather than restating two totals.
//   - One whole's parts (pie, donut, treemap, waffle) number what the whole
//     has - a pie holds five at most, and small counts are sent to the waffle
//     - so the form is not floored; the deck's median still counts them.
// The deck-level median (variety_gates.mjs EVIDENCE_DEPTH) holds the rest.
export const EVIDENCE_FLOOR = Object.freeze({ chart: 8, bridge: 5 });
const CHART_TYPES = ["trend", "ranking", "composition", "relationship", "bridge"];
const WHOLE_PARTS = ["pie", "donut", "treemap", "waffle", "pictogram"];
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
  "stat-list": { key: "items", min: 2, max: 6, valueChars: 9 }, "fact-grid": { key: "items", min: 3, max: 9, valueChars: 10, columns: 4 },
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
  // Forms held by their component: a radar holds three to eight axes
  // (past eight its labels collide round the rim), a box plot four to twelve
  // members, a pictogram one to five populations, the horizons two to five bets.
  "chart.radar": { key: "categories", min: 3, max: 8 }, "chart.boxplot": { key: "categories", min: 4, max: 12 },
  pictogram: { key: "rows", min: 1, max: 5 }, "chart.horizons": { key: "horizons", min: 2, max: 5 },
});
/** The limit a page's primary exhibit is held to: its form's, else its component's. */
export const limitOf = (type, form, target) => LIMITS[`${type}/${form}`] ?? LIMITS[target];
// Callouts a chart carries before the plot runs out of clear corridors: past
// three, the fourth note is commentary and belongs beside the chart.
export const CALLOUTS_MAX = 3;
export const WATERFALL_BELOW_CALLOUTS = 2;
// The rail's panel is a third of the body row at most - a quarter where its
// statement fits there (compose-text-pages.mjs); its statement is set at
// heading size and runs to eight lines, measured here the way the renderer sets it.
const RAIL_WIDTH = 373;
export const railFits = (text) => { try { sideStatementLayout({ x: 0, y: 0, width: RAIL_WIDTH, height: 600 }, { text }); return true; } catch { return false; } };
// The so-what bar runs the body's width and holds two lines: one implication,
// measured the way the insight band sets it. A third line is an argument, and
// an argument belongs beside the exhibit.
const BAR_WIDTH = 1160;
export const barFits = (text) => (measureInsight({ x: 0, y: 0, width: BAR_WIDTH, height: 400 }, { text, variant: "primary" }).body?.lines?.length ?? 99) <= 2;
// The takeaway band runs the body's width too and says the reading once, in a
// line or two (page_gates.py TAKEAWAY_LONG measures it as it composes).
export const takeawayLines = (text) => measureInsight({ x: 0, y: 0, width: BAR_WIDTH, height: 400 }, { text, variant: "tonal" }).body?.lines?.length ?? 99;
// A row block's label is a name set bold on the house colour, not a sentence:
// it has to read at a glance down the left edge.
const BLOCK_LABEL_WORDS = 5, BLOCK_CHART_ROWS = 2;
// The countable limits on a page's copy that the compile holds and nothing
// else names: the fewest words a rail, a so-what bar, a caption and a chart's
// callouts between them carry before they are a label rather than a claim,
// and how many points a labelled row sets beside its label. Named once here
// so the check and the published limit (limits.mjs) are one number.
export const COPY_LIMITS = Object.freeze({ railWordsMin: 10, barWordsMin: 8, captionWordsMin: 8, calloutWordsMin: 10,
  blockPoints: Object.freeze({ min: 2, max: 4 }), blockLabelWords: BLOCK_LABEL_WORDS, panelWordsMin: PANEL_WORDS_MIN });

// The least a page of each type carries to be worth a page. Below it the type
// was chosen for less evidence than it needs: a three-phase roadmap, a two-part
// pie or a four-row matrix leaves half a page empty.
const MINIMUM = Object.freeze({
  composition: (ex, form) => form === "pictogram"
    ? (ex.rows || []).length >= 1 || "a pictogram counts a share of each population in figures - `rows`, each { label, value } out of `of` (10 or 20)"
    : form === "waffle"
    ? ((ex.series || []).length === 1 && (ex.categories || []).length >= 2) || "a waffle counts the members of each part - `categories` for the parts and one series of whole counts"
    : ["pie", "donut", "treemap"].includes(form)
    ? ((ex.labels || ex.items || []).length >= 3 || "a share of one thing is a numbers page - a composition shows three or more parts")
    : ((ex.categories || []).length >= 2 && (ex.series || []).length >= 2) || (ex.series || []).length >= 3 || "a composition compares the mix across two or more members or periods, or shows three or more parts",
  schedule: (ex, form) => form === "gantt" ? true : form === "horizons" ? (ex.horizons || []).length >= 2 || "the horizons are two to five bets, each { label, title, description } in the order they pay"
    : (ex.items || []).length >= 4 || "a timeline or roadmap of three items is a strip, not a page - four or more dated items ({ date | period, label, text }), or pair it with the evidence behind them as panels",
  parallel: (ex) => (ex.items || []).length >= 3 || "three or more parallel ideas",
  // A decision tree holds exactly two branches (its renderer's limit), so its
  // parts are the conclusions under them; a rank flow's are its `entities`.
  mechanism: (ex, form) => (form === "tree" ? (ex.branches || []).flatMap((b) => b?.conclusions || []).length >= 3
    : ["nodes", "items", "stages", "layers", "branches", "pillars", "quadrants", "points", "flows", "entities"].some((key) => Array.isArray(ex[key]) && ex[key].length >= 3)) || "a mechanism has three or more parts",
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
  "argument/memo": ["paragraphs (150 to 330 words; each `{ lead, text }`, the lead a 2-8 word subheading, the text 60 words at most)", `panel ({ text, kicker }: the conclusion or the figures to keep, down the right; ${PANEL_WORDS_MIN} words or more)`],
  "trend/indexed": ["categories", "series (raw values, the subject and three or more peers)", "indexBase (the period set to 100)", "subject (the series in colour)"],
  "ranking/distribution": ["categories (15 to 40 members, sorted by the value)", "series (one measure)", "highlights (the subject)"],
  "ranking/boxplot": ["categories (4 to 12 members)", "boxes (one { min, q1, median, q3, max } per member)", "highlights (the subject)"],
  "trend/sparklines": ["items (2 to 12, each { label, values } over the same four or more periods)", "highlights (the subject's `category`: its label)", "unit (the measure and the window)"],
  "trend/model": ["categories", "series", "the chart's `type` (chart.column by default; line, area, stacked-column or combo)"],
  "composition/pictogram": ["rows (1 to 5, each { label, value, text } - the figures filled out of `of`)", "of (10 or 20)", "icon (the figure: person by default)"],
  "profiles/radar": ["categories (3 to 8 attributes)", "series (1 to 4 players, one value per attribute)", "max (the scale's top)", "focusSeries (the subject)"],
  "schedule/horizons": ["horizons (2 to 5, each { label, title, description })", "variant (curves, stepped, stepped-minimal, stepped-bands)"],
  "schedule/timeline": ["items (4 or more, each { date, label, text }: when, what happens, and a sentence on it, set at reading size and counted as the page's words)", "orientation (across or down; absent, the frame decides - rows where the page has the height, columns over commentary below)"],
  "schedule/roadmap": ["items (4 or more, each { label, period, text }: the stage, when it runs, and what it delivers)", "orientation (across or down; absent, the frame decides)"],
};
/**
 * The forms a plan can give a page of `type` before the page is written
 * (deck-structure.mjs allocateStructure): the type's first form, and every
 * other form that is not built for particular data. An indexed trend, a
 * distribution, small multiples, a radar (FORM_DATA), and a page construction
 * among a type's chart or component forms - aligned bars, labelled rows, a
 * table in halves - are chosen by an author who holds that data.
 */
export function plannableForms(type) {
  const forms = Object.entries(PAGE_TYPES[type]?.forms ?? {});
  const built = ([, target]) => Boolean(CONSTRUCTION_DATA[target]);
  return forms.filter((entry, at) => at === 0 || !(FORM_DATA[`${type}/${entry[0]}`] || (built(entry) && !built(forms[0])))).map(([form]) => form);
}
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
    // labelled base line would set its label on the peers' lines.
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
    // Forty rows ten pixels apart hold one callout beside its bar - the
    // subject's, or any one member's - and not a second: every pair tried
    // on a forty-member field but one left the second box nowhere clear of
    // its neighbours' bars and values.
    if ((ex.annotations || []).length > 1)
      throw new Error(`${id}: a distribution carries one callout (this one has ${ex.annotations.length}) - its rows are too close for a second box; keep the note on the subject and put the rest in the commentary`);
  }
  // The subject a small-multiple or box-plot page is about is marked by name:
  // these charts draw no callouts, so the highlight is the finding on the plot.
  const names = (list) => new Set((list || []).map((item) => String(item?.label ?? item ?? "")));
  const marksSubject = (members) => (ex.highlights || []).some((h) => members.has(String(h?.category)));
  if (page.type === "trend" && page.form === "sparklines") {
    const items = Array.isArray(ex.items) ? ex.items : [];
    const short = items.find((item) => !Array.isArray(item?.values) || item.values.filter(finite).length < 4);
    if (short) throw new Error(`${id}: small multiples run over four or more periods each; "${short?.label ?? "?"}" has ${Array.isArray(short?.values) ? short.values.length : 0} - two or three periods are a comparison, a \`ranking\` or a \`numbers\` page`);
    const lengths = new Set(items.map((item) => item.values.length));
    if (lengths.size > 1) throw new Error(`${id}: small multiples share one window - every item carries the same periods (${[...lengths].join(", ")} values given); a missing period is null`);
    if (!marksSubject(names(items))) throw new Error(`${id}: small multiples mark the member the page is about - \`highlights: [{ category }]\` naming one item's label; the rest stay grey`);
    if ((ex.annotations || []).length) throw new Error(`${id}: small multiples carry no callouts; say what moved in the commentary, or draw the one series as a \`line\` with its callouts`);
  }
  if (page.type === "ranking" && page.form === "boxplot") {
    if (!marksSubject(names(cats))) throw new Error(`${id}: a box plot marks its subject - \`highlights: [{ category }]\` naming one of its members`);
    if ((ex.annotations || []).length) throw new Error(`${id}: a box plot carries no callouts; say what the spread shows in the commentary`);
  }
  if (page.type === "profiles" && page.form === "radar") {
    if (series.length < 1 || series.length > 4) throw new Error(`${id}: a radar sets one to four players over the same attributes; this one has ${series.length}`);
    const bad = series.find((s) => !Array.isArray(s?.values) || s.values.length !== cats.length);
    if (bad) throw new Error(`${id}: every player on a radar has one value per attribute - "${bad?.name ?? "?"}" does not`);
    if (!Number.isFinite(Number(ex.max))) throw new Error(`${id}: a radar names its scale's top in \`max\` (5 on a five-point rating, 100 on a share) - the same for every attribute`);
    if (series.length > 1 && !series.some((s) => s?.name === ex.focusSeries)) throw new Error(`${id}: a radar of several players names the one the page is about in \`focusSeries\`; it is filled and the others outlined`);
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
const words = textWordList;
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
// The composer's table aliases (rows, compare, phase-table) are drawn as grids too.
const exhibitFamily = (ex) => (String(ex?.type ?? "").startsWith("chart") ? "chart"
  : isTable(ex) || ["rows", "compare", "phase-table"].includes(ex?.type) ? "table" : "figure");

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
 *
 * The column and the exhibit count are drawnOf's, which VARIETY_COLUMN and
 * VARIETY_PANELS read, so a rail or a hero number with its points is a column
 * to both rules or to neither.
 */
export function skeletonOf(slide) {
  const { exhibits, column } = drawnOf(slide);
  const drawn = column ? "exhibit beside a column"
    : slide.arrange ? `${slide.arrange} of exhibits`
    : slide.shape ?? slide.role ?? (slide.kind && slide.kind !== "content" ? slide.kind : slide.layout ?? "exhibit-full");
  const families = [...new Set([...exhibitsOf(slide), ...(slide.blocks || []).map((block) => block?.exhibit).filter(Boolean)].map(exhibitFamily))].join("+");
  const close = slide.soWhat ? (slide.soWhat?.style === "bar" ? "so-what bar" : "closing line") : "open";
  return [drawn, exhibits ? `${exhibits} ${column || !families ? "exhibit" : families}` : "",
    (slide.points || []).length ? "points" : "", slide.panel ? "rail" : "", close].filter(Boolean).join(" · ");
}

/**
 * The two counts the variety contract holds a deck's structure to, read off
 * the page as drawn: how many exhibits the reader meets, and whether the page
 * is one exhibit with a text column beside it.
 *
 * An exhibit is a body of evidence with its own frame: each panel, a strip of
 * measured numbers over its chart, the photograph a backdrop page sets its
 * exhibit on, the small exhibit at the right of each row block. Aligned bars
 * are one exhibit - one category axis read across - whatever their columns.
 *
 * The column is the page strong decks draw about one time in eight: a column
 * of points or a rail beside a single exhibit, on either side, and a hero
 * number with its points in the column beside its proof, which reads the same
 * way. A rail is a column here because this reads how the page is drawn - the
 * exhibit at two thirds of the width beside a side panel. PAGE_SHAPE_FLAT
 * reads what the page argues with, and counts the same rail as the page's
 * close, not commentary (deck-structure.mjs declaredArchitecture): the two
 * rules differ on a rail by design, and each says so on its standing line.
 */
export function drawnOf(slide) {
  const exhibits = exhibitsOf(slide);
  const count = exhibits.reduce((n, ex) => n + (ex.type === "chart-group" && !ex.aligned ? Math.max(1, (ex.charts || []).length) : 1), 0)
    + (slide.blocks || []).filter((block) => block?.exhibit).length
    + (slide.layout === "metrics-over-exhibit" && (slide.metrics || []).length ? 1 : 0)
    + (slide.layout === "photo-backdrop" && slide.photo ? 1 : 0);
  const column = count === 1 && (["exhibit-left", "exhibit-right"].includes(slide.layout) || (slide.layout === "sidebar" && exhibits.length === 1)
    || (slide.layout === "hero-number" && (slide.points || []).length > 0));
  return { exhibits: count, column };
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
    if (!Array.isArray(block.points) || block.points.length < COPY_LIMITS.blockPoints.min || block.points.length > COPY_LIMITS.blockPoints.max) throw new Error(`${where} carries two to four \`points\` beside its label; it has ${Array.isArray(block.points) ? block.points.length : 0}`);
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
  // The label names the area and the evidence at the right carries its
  // figures. A label written as "OpenAI $122B / Anthropic $65B" over a table
  // of 122 and 65 prints each number twice a row apart, and leaves the row with
  // no name for what the numbers measure.
  blocks.forEach((block, at) => {
    const said = figuresIn(block.label);
    if (!said.length) return;
    const shown = new Set([...(block.metric ? figuresIn(block.metric.value) : []),
      ...(isTable(block.exhibit || {}) ? (block.exhibit.rows || []).flatMap((row) => resultCells(row).flatMap((cell) => figuresIn(cellText(cell)))) : []),
      ...chartsIn(block.exhibit).flatMap((chart) => [...(chart?.series || []).flatMap((s) => s?.values || []), ...(chart?.values || [])]).filter(finite).map(Number)]);
    const repeated = said.filter((figure) => shown.has(figure));
    if (repeated.length) throw new Error(`${id}: block ${at + 1}'s label "${String(block.label).replace(/\s*\n\s*/g, " / ")}" repeats ${repeated.join(" and ")}, which its ${block.metric ? "metric" : "exhibit"} prints beside it; the label names the area the row is about (the measure, the question) in ${BLOCK_LABEL_WORDS} words or fewer, and the figures stay in the evidence`);
  });
  const sides = blocks.filter((block) => block.metric || block.exhibit).length;
  if (sides && sides !== blocks.length) throw new Error(`${id}: ${sides} of ${blocks.length} blocks carry a metric or exhibit at the right; give every row one or none, so the column lines up`);
  // A chart keeps a 100px plot under its heading and above its axis, which a
  // row takes only when the body is split in two: at three rows a two-bar
  // chart comes out 12px short. A number or a two-row table fits any row.
  const charts = blocks.filter((block) => String(block.exhibit?.type ?? "").startsWith("chart.")).length;
  if (charts && blocks.length > BLOCK_CHART_ROWS)
    throw new Error(`${id}: a chart at the right of a row needs half the body's height, so it fits a page of ${BLOCK_CHART_ROWS} blocks; with ${blocks.length}, give each row a \`metric\` or a two-row table`);
  const unheaded = blocks.filter((block) => String(block.exhibit?.type ?? "").startsWith("chart.") && !block.exhibit.heading).length;
  if (unheaded) throw new Error(`${id}: a chart in a block carries its \`heading\` - the measure and, with \`unit\`, its unit`);
}

// Defects a whole-deck review finds, refused here where the page is written
// rather than left for the review to find.
const BLANK = /^[\s\-–—]*$/;
const COLUMN_CHARTS = new Set(["chart.column", "chart.stacked-column", "chart.combo"]);
// What a heading, a column, a row label or a set of paragraphs means is read,
// not matched against a list of words: each rule below that turns on it asks
// its question of a model once (judgements.mjs, judgement-kinds.json) and
// holds where the recorded answer is the defect. A question not yet answered
// does not hold, and the compile lists it as pending.
const SCENARIO_WORDS = 60;
const PROSE_TYPES = new Set(["options", "scorecard", "lookup", "matrix", "summary", "statement"]);
// A table earns its grid at three rows; a logo table introducing two players
// is a roster, and PLAYERS_UNMARKED sends a two-player deck to one.
const TABLE_ROWS = 3, ROSTER_ROWS = 2;

// The review's refusals as the catalogue prints them - the code, what it
// refuses, what to draw instead. `--types` is built from these lists and a
// test holds them to the codes the compiler raises, so the catalogue names
// every refusal.
const REVIEW_RULES = [
  ["TABLE_TOO_SHORT", `a table of fewer than ${TABLE_ROWS} body rows (a logo table introducing two players, and a row block's small table, are exempt)`, "two or three figures are a numbers page"],
  ["TABLE_PANELS_MERGE", "two tables with the same columns on one page, whether their rows name the same measures or different ones", "one table, the members as columns and every measure as a row, \"n/a\" where a member does not disclose one"],
  ["TABLE_STACK", "two or more tables set one above another (panels form stack, or in both rows of a grid)", "one table with the members as columns, or one table with the other evidence as a chart or a strip of numbers beside or above it; tables side by side in a row pass"],
  ["COMPARISON_MEASURES_DIFFER", "panels headed by different declared players, each on a measure of its own", "one panel per measure, the players as its bars or series"],
  ["TOTAL_ROW_BLANK", "a table row that closes the table as a total (`style: \"total\"`, or a label that reads as one) with nothing in its result cells", "a measure table adds its own total only where a column sums, and `total: true` where none does is refused"],
  ["TIME_AXIS_UNEVEN", "a column chart of four or more dates at uneven gaps, whose heading does not tell the reader they are chosen dates", "a line or an area spaces dated categories by the time between them, so draw the series as one, or say \"snapshots\" or \"selected years\" in the heading"],
  ["VERDICT_TABLE_PLAIN", "on a lookup, options or matrix page, a column whose cells judge each row - who leads, a verdict, a rating, a status - in plain words", "give it a `type`: rag, harvey, check, lights, dot, or use a scorecard"],
  ["SCENARIO_PROSE", `two to four alternatives (scenarios, options, paths) the reader is to compare, as paragraphs of ${SCENARIO_WORDS} words or more each`, "set them as options, labelled rows or a table of trigger, who captures the value, the test, the counter-signal"],
  ["PROSE_PARAGRAPH_LONG", `a paragraph of more than ${PROSE_PARAGRAPH_MAX} words`, "two led paragraphs, each its own claim"],
  ["PROSE_UNSIGNPOSTED", `a paragraph of ${PROSE_LEAD_FROM} words or more with no \`lead\`, or a lead outside ${PROSE_LEAD_WORDS.join(" to ")} words`, "write it as `{ lead, text }`: the lead is the subheading the reader scans by, set in bold above the prose"],
];
const ADVISED_RULES = [
  ["SHARES_IN_TILES", "shares of one measure more than five times apart in tiles of one size", "one 0-100% scale"],
  ["MAP_COARSE", "a place page whose markers span under twenty degrees of the built-in 1:110m coastline", "import a finer geography with runtime/import-geography.mjs"],
];
const printRules = (rules) => rules.map(([code, rule, repair]) => `${rule} (${code} - ${repair})`).join("; ");

/**
 * A total row with nothing in it: a "Total" label over blank result cells.
 * compose-tables.mjs totalRow adds a total only where a column sums, and a row the
 * author writes is held to the same: labelled a total, it carries one.
 */
function blankTotal(rows, headers, id) {
  const labels = (rows || []).map((row) => cellText(rowLabel(row)).trim());
  for (const [at, row] of (rows || []).entries()) {
    const label = labels[at], results = resultCells(row);
    if (!results.length || !results.every((c) => BLANK.test(cellText(c)))) continue;
    // A row styled as the total says so; a row whose label reads as one is asked (row-is-total) - a blank row is as often a group's heading.
    if (row?.style === "total" || (label && judged("row-is-total", label, { headers: (headers || []).map(headerText), rows: labels }, id)?.verdict === "total")) return { label: label || "total" };
  }
  return null;
}
const headerText = (column) => (typeof column === "string" ? column : String(column?.label ?? ""));

/** The chart exhibits an exhibit carries: itself, or the charts of a chart group. */
const chartsIn = (ex) => (ex?.type === "chart-group" ? (ex.charts || []).map((c) => ({ type: c?.component, heading: c?.heading, unit: c?.unit, ...(c?.props || {}) })) : [ex]);

/**
 * A table's columns after its label column, as (header, cells) pairs, with a
 * pair joined by " / " in the header and " | " in its cells split into its
 * parts: a findings matrix wrote "Current signal / Winner call" over "Model X
 * at 58 | Firm A".
 */
function tableColumns(headers, rows) {
  return headers.slice(1).flatMap((column, at) => {
    const header = typeof column === "string" ? column : String(column?.label ?? "");
    const cells = (rows || []).map((row) => resultCells(row)[at]);
    const parts = header.split(/\s+\/\s+/);
    const split = parts.length > 1 && cells.every((cell) => BLANK.test(cellText(cell)) || cellText(cell).split(" | ").length === parts.length);
    return split ? parts.map((part, i) => ({ column, header: part, cells: cells.map((cell) => cellText(cell).split(" | ")[i] ?? "") })) : [{ column, header, cells }];
  });
}

/**
 * A column of judgements set as words. A column headed lead, winner,
 * confidence or status that sets "Firm A", "Medium", "No verdict" in the same
 * grey text as the evidence beside it reads the page's answer as one more
 * fact. What the column says is asked (column-reads), the question the
 * composer asks of it: a status, a direction or progress is coded by the
 * composer and passes, as do facts; a judgement that is none of those, in
 * words, is the defect. A typed column passes.
 */
function plainVerdict(headers, rows, id) {
  const all = (headers || []).map(headerText);
  for (const { column, header, cells } of tableColumns(headers, rows)) {
    if (column && typeof column === "object" && (CODED.has(column.type) || column.heat || column.bar || column.harvey)) continue;
    // A column of figures alone is measures, or progress, and never a verdict in words: it is not asked here.
    const asked = columnQuestion(header, cells, all);
    if (!asked || asked.subject.cells.every((cell) => SCALAR_FIGURE.test(cell))) continue;
    if (judged("column-reads", asked.subject, asked.context, id)?.verdict === "judges") return { header, examples: asked.subject.cells.slice(0, 3) };
  }
  return null;
}

/** A page's parallel prose: its paragraphs, points, card texts or row blocks, each as one run with its lead. */
function proseBlocks(page, exhibits) {
  const joined = (...parts) => parts.flat().filter(Boolean).map((p) => (typeof p === "string" ? p : `${p?.lead ?? ""} ${p?.text ?? ""}`)).join(" ");
  if ((page.paragraphs || []).length) return page.paragraphs.map(proseParts);
  if ((page.points || []).length) return page.points.map((p) => ({ lead: typeof p === "object" ? String(p?.lead ?? "") : "", text: joined(p) }));
  if (page.form === "labelled-rows") return (page.blocks || []).map((b) => ({ lead: String(b?.label ?? ""), text: joined(b?.points || []) }));
  const items = exhibits.find((ex) => ex?.type === "cards")?.items || [];
  return items.map((item) => ({ lead: String(item?.title ?? ""), text: joined(item?.text, item?.points || []) }));
}

/**
 * The page's tables, as a reader compares them, first defect first.
 *
 * Two tables with the same columns - a measure and its disclosed value,
 * stacked for two firms - read as a form half filled in, and where their rows
 * name different measures (one firm's round on committed capital and undrawn
 * credit, the other's on round size and included commitments) nothing reads
 * across at all. One table with the members as columns and every measure as
 * a row, "n/a" where a member does not disclose one, compares them on the
 * same terms and makes the gap the finding. One refusal says both, since the
 * two share one repair.
 *
 * Tables with different columns stacked one above another read no better: the
 * reader holds the first grid in mind while reading the second. Side by side
 * in a row they are two panels the eye reads across, and pass.
 *
 * Alone, a table earns its grid at three rows. A row block's small table is
 * not passed here: there it is the row's evidence, beside the row's bullets.
 */
function tableDefect(page, id, exhibits, skip = new Set()) {
  const tables = exhibits.filter(isTable);
  const headers = (ex) => (ex.columns || []).map((c) => String(typeof c === "string" ? c : c?.label ?? "").trim().toLowerCase()).join("|");
  const twins = tables.filter((ex, at) => headers(ex) && tables.some((other, k) => k !== at && headers(other) === headers(ex)));
  if (twins.length && !skip.has("TABLE_PANELS_MERGE")) {
    const measures = (ex) => ex.rows.map((row) => cellText(rowLabel(row)).trim()).filter(Boolean);
    const union = [...new Map(twins.flatMap(measures).map((m) => [m.toLowerCase(), m])).values()];
    const differ = twins.some((ex) => measures(ex).length !== union.length);
    return `${id}: TABLE_PANELS_MERGE - ${twins.length} tables on the page share the columns "${(twins[0].columns || []).map((c) => (typeof c === "string" ? c : c?.label)).join(" | ")}"` +
      (differ ? ` but set their members on different measures (${twins.map((ex) => `${ex.heading ?? "a table"}: ${measures(ex).join(", ")}`).join("; ")}), so nothing reads across. ` +
        `Set them as one table, the members as columns and every measure as a row - ${union.join(", ")} - with "n/a" where a member does not disclose one: each member is compared on the same measures, and a gap is the finding a substitute metric would hide`
        : "; set them as one table with what they compare as columns (or a column per member), so the reader compares across a row rather than between two grids whose columns do not line up");
  }
  // A stack draws its panels one above another; a grid draws two rows of two.
  const row = { stack: (at) => at, grid: (at) => Math.floor(at / 2) }[page.type === "panels" ? page.form : ""];
  const stacked = row ? new Set(exhibits.flatMap((ex, at) => (isTable(ex) ? [row(at)] : []))).size : 0;
  if (stacked > 1 && !skip.has("TABLE_STACK")) return `${id}: TABLE_STACK - ${stacked} tables are set one above another (panels form "${page.form}"), so the reader holds the first grid in mind while reading the next and their columns do not line up. ` +
    "Set them as one table with the members as columns, or keep one table and draw the other evidence as a chart or a strip of numbers beside or above it (`panels` form `row` with a chart beside the table, or `numbers` form `metric-strip` over it)";
  const least = page.type === "profiles" && page.form === "logo-table" ? ROSTER_ROWS : TABLE_ROWS;
  const bodyRows = (ex) => ex.rows.filter((r) => !(r && !Array.isArray(r) && ["total", "group"].includes(r.style))).length;
  const short = tables.find((ex) => bodyRows(ex) < least);
  if (short && !skip.has("TABLE_TOO_SHORT")) return `${id}: TABLE_TOO_SHORT - a table of ${bodyRows(short)} row${bodyRows(short) === 1 ? "" : "s"}${short.heading ? ` ("${short.heading}")` : ""} is a form half filled in; ` +
    (least === ROSTER_ROWS ? "a logo table introduces two players or more" : "a table earns its grid at three rows. Set two or three figures as a numbers page (fact-grid, stat-list, or a metric strip over the exhibit that proves them), or two members side by side as profile cards or a compare");
  return null;
}

/**
 * What a review would find that asks for another page or another exhibit:
 * the tables, members compared on different measures, alternatives written as
 * prose. Checked before the type's own evidence rules, since the page it asks
 * for has other rules.
 */
function reshapeDefect(page, id, exhibits, players, skip = new Set()) {
  const table = tableDefect(page, id, exhibits, skip);
  if (table) return table;
  // A comparison sets every member on the same measures: panels headed by
  // two players, one on revenue and the other on weekly users, compare nothing.
  const names = [...playerNames(players)];
  const memberOf = (ex) => names.find(([alias]) => new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(String(ex?.heading ?? "")))?.[1];
  const members = page.type === "panels" ? exhibits.filter(memberOf) : [];
  if (members.length >= 2 && new Set(members.map(memberOf)).size === members.length && !skip.has("COMPARISON_MEASURES_DIFFER")) {
    const measure = (ex) => (isTable(ex) ? ex.rows.map((row) => cellText(rowLabel(row)).trim().toLowerCase()).sort().join("|") : String(ex.unit ?? "").trim().toLowerCase());
    if (new Set(members.map(measure)).size > 1)
      return `${id}: COMPARISON_MEASURES_DIFFER - the panels set ${members.map((ex) => `${memberOf(ex)} on "${ex.unit ?? measure(ex)}"`).join(" and ")}: members compared side by side are measured the same way. ` +
        "Give each member the same measure in each panel (one panel per measure, the members as its bars or series), with \"n/a\" where one does not publish it";
  }
  if (!PROSE_TYPES.has(page.type) && !skip.has("SCENARIO_PROSE")) {
    const blocks = proseBlocks(page, exhibits), long = blocks.filter((b) => words(b.text).length >= SCENARIO_WORDS);
    // Whether the paragraphs are alternatives or the steps of one argument is read (prose-alternatives).
    const alternatives = () => judged("prose-alternatives", { title: String(page.title ?? ""), purpose: String(page.why ?? ""), paragraphs: blocks.map((b) => ({ lead: b.lead, text: b.text })) }, null, id)?.verdict === "alternatives";
    if (long.length >= 2 && long.length <= 4 && long.length === blocks.length && alternatives())
      return `${id}: SCENARIO_PROSE - ${long.length} alternatives are set as paragraphs of ${long.map((b) => words(b.text).length).join(", ")} words, which a reader has to hold in mind to compare. ` +
        "Set them side by side on the same terms: type `options` (form compare or table-halves), `parallel` form `labelled-rows`, or a comparison table whose columns are what each is judged on - the trigger, who captures the value, the test that would show it, the signal against it";
  }
  return null;
}

/**
 * What a review would find in the cells of a page whose type and shape are
 * right - a blank total, dates at uneven gaps drawn one slot apart, a verdict
 * set as words - as the refusal to throw, or null. Checked last: the fix is
 * to the cells, and a page still to be reshaped would be fixed twice.
 */
function reviewedDefect(page, id, exhibits, skip = new Set()) {
  const tables = exhibits.filter(isTable);
  const total = !skip.has("TOTAL_ROW_BLANK") && [...tables.map((ex) => [ex.rows, ex.columns]), page.type === "matrix" ? [page.rows, page.columns] : [null]].map(([rows, headers]) => blankTotal(rows, headers, id)).find(Boolean);
  if (total) return `${id}: TOTAL_ROW_BLANK - the row "${total.label}" closes the table as a total with no value in any result cell; a total row carries its computed total - or delete it. ` +
    "Totals belong only where the columns share a basis (counts, amounts); `total: true` on a measure table sums the columns that add up";
  for (const chart of exhibits.flatMap(chartsIn)) {
    // Three columns are a comparison of chosen years (FY19, FY22, FY26: before,
    // trough, now); four or more read as a series, and the eye reads the rhythm.
    if (skip.has("TIME_AXIS_UNEVEN") || !COLUMN_CHARTS.has(chart?.type) || (chart.categories || []).length < 4 || !timePositions(chart.categories)) continue;
    // A heading may tell the reader the columns are chosen dates (heading-says-snapshots); one that says nothing does not.
    const told = { heading: String(chart.heading ?? "").trim(), unit: String(chart.unit ?? "").trim() };
    const series = !told.heading && !told.unit ? true : judged("heading-says-snapshots", told, { categories: chart.categories.map(String) }, id)?.verdict === "reads-as-series";
    if (series) return `${id}: TIME_AXIS_UNEVEN - the columns ${chart.categories.slice(0, 4).join(", ")}, ... are dated ${describeGaps(chart.categories)} apart but a column chart sets them one slot apart, so the reader sees a rhythm the dates do not have. ` +
      "Plot the series as a line or an area (the runtime spaces dated points by the time between them), fill in the missing periods, or say in the heading that the columns are snapshots (\"selected years\", \"snapshots\")";
  }
  const prose = proseDefect(page, id, skip);
  if (prose) return prose;
  if (["lookup", "options", "matrix"].includes(page.type) && !skip.has("VERDICT_TABLE_PLAIN")) {
    const plain = [...tables, ...(page.type === "matrix" ? [page] : [])].map((ex) => plainVerdict(ex.columns || [], ex.rows, id)).find(Boolean);
    if (plain) return `${id}: VERDICT_TABLE_PLAIN - the "${plain.header}" column judges each row (${plain.examples.map((e) => `"${e}"`).join(", ")}) in plain text, where it reads as one more fact beside the evidence. ` +
      "Code the judgement: give the column a `type` - \"rag\" (a status pill), \"harvey\" (a rating), \"check\", \"lights\" or \"dot\" - or make the page a `scorecard` (forms harvey, rag, check, lights, dot, heatmap, bars). Where the column names who leads, declare them in the deck's `players`: a cell naming a player is drawn as its mark - a logo, an outline or a photograph - which says who without spending a status colour";
  }
  return null;
}

/**
 * Prose a reader cannot scan: paragraphs past PROSE_PARAGRAPH_MAX words, or of
 * PROSE_LEAD_FROM words or more with no lead to read them by. Every offending
 * paragraph is named at once, so one rewrite clears the page.
 */
function proseDefect(page, id, skip) {
  const parts = (page.paragraphs || []).map(proseParts);
  if (!parts.length) return null;
  const sized = parts.map((p, at) => ({ at: at + 1, lead: p.lead, words: words(p.text).length, leadWords: words(p.lead).length }));
  const list = (items, say) => items.map((p) => `${p.at} (${say(p)})`).join(", ");
  const long = sized.filter((p) => p.words > PROSE_PARAGRAPH_MAX);
  if (long.length && !skip.has("PROSE_PARAGRAPH_LONG"))
    return `${id}: PROSE_PARAGRAPH_LONG - paragraph${long.length === 1 ? "" : "s"} ${list(long, (p) => `${p.words} words`)} run${long.length === 1 ? "s" : ""} past the ${PROSE_PARAGRAPH_MAX} a strong deck sets in one block. ` +
      "Split each into two paragraphs that make their own claim, each under its own `lead`, or cut what the exhibit or the panel already says - not the mechanism or the consequence";
  const bare = sized.filter((p) => (!p.lead && p.words >= PROSE_LEAD_FROM) || (p.lead && (p.leadWords < PROSE_LEAD_WORDS[0] || p.leadWords > PROSE_LEAD_WORDS[1])));
  if (bare.length && !skip.has("PROSE_UNSIGNPOSTED"))
    return `${id}: PROSE_UNSIGNPOSTED - paragraph${bare.length === 1 ? "" : "s"} ${list(bare, (p) => (p.lead ? `a lead of ${p.leadWords} words` : `${p.words} words, no lead`))} give${bare.length === 1 ? "s" : ""} the reader nothing to scan by. ` +
      `Write each as \`{ "lead": "...", "text": "..." }\`: the lead is a ${PROSE_LEAD_WORDS.join(" to ")}-word subheading saying what the paragraph establishes ("Off-peak fares are the weaker lever"), set in bold above it; the text is the reasoning under it`;
  return null;
}

// Categorical charts whose marks a reader reads by value.
const VALUE_CHARTS = new Set(["chart.column", "chart.bar", "chart.line", "chart.area", "chart.stacked-column", "chart.stacked-bar",
  "chart.grouped-column", "chart.lollipop", "chart.dumbbell", "chart.slope", "chart.combo"]);
const LABELLED_MARKS_MAX = 12;
const seriesOf = (points) => [...(points || []).reduce((groups, point) => {
  const key = typeof point?.series === "string" && point.series.trim() ? point.series : "";
  return groups.set(key, [...(groups.get(key) || []), point]);
}, new Map()).values()];
const monotone = (points) => {
  const ys = [...points].filter((p) => finite(p?.x) && finite(p?.y)).sort((a, b) => a.x - b.x).map((p) => Number(p.y));
  return ys.length >= 6 && (ys.every((y, i) => !i || y < ys[i - 1]) || ys.every((y, i) => !i || y > ys[i - 1]));
};
// A figure written as a tile value or a chart value, as a number: "~$24B" is 24.
const figureOf = (value) => { const m = /-?\d[\d,]*(?:\.\d+)?/.exec(String(value ?? "")); return m ? Number(m[0].replace(/,/g, "")) : null; };
// Every figure a text writes, as numbers - years left out, which a label may
// name ("Since 2019") without repeating a result.
const figuresIn = (text) => [...String(text ?? "").matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, "")))
  .filter((v) => Number.isFinite(v) && !(Number.isInteger(v) && v >= 1900 && v <= 2100));
const unitOf = (value) => (/%/.test(String(value)) ? "%" : /[$€£]/.test(String(value)) ? "$" : /pp\b/i.test(String(value)) ? "pp" : /x\b|×/i.test(String(value)) ? "x" : "n");

/**
 * A chart's year-and-month categories ("2025-08") as the page prints them
 * ("Aug 25"), with every reference to them - callouts, highlights, change
 * brackets, forecast and period bands - renamed with them, so the deck, its
 * text plan and the drawn axis say the same thing.
 */
function readableCategories(ex) {
  if (!String(ex?.type ?? "").startsWith("chart.") || !Array.isArray(ex.categories)) return;
  const renamed = new Map(ex.categories.map((c) => [String(c), readablePeriod(c)]).filter(([from, to]) => from !== to));
  if (!renamed.size) return;
  const to = (value) => (renamed.has(String(value)) ? renamed.get(String(value)) : value);
  ex.categories = ex.categories.map(to);
  for (const key of ["annotations", "highlights", "pointHighlights", "events"]) if (Array.isArray(ex[key])) ex[key] = ex[key].map((item) => (item && typeof item === "object" && item.category !== undefined ? { ...item, category: to(item.category) } : item));
  for (const key of ["changeAnnotations", "periods"]) if (Array.isArray(ex[key])) ex[key] = ex[key].map((item) => (item && typeof item === "object" ? Object.fromEntries(Object.entries(item).map(([k, v]) => [k, ["start", "end", "from", "to"].includes(k) ? to(v) : v])) : item));
  if (ex.forecastFrom !== undefined) ex.forecastFrom = to(ex.forecastFrom);
}

// The chart-form refusals (chartFormDefect), by code.
export const CHART_FORM_CODES = Object.freeze({
  SCATTER_OVER_TIME: "a scatter whose x axis is time: a trend drawn without its line",
  SCATTER_CURVE: "six or more points running one way as x grows, drawn as loose dots",
  LABELS_OFF: "value labels switched off on twelve marks or fewer with no gridlines",
  GUTTER_UNEARNED: "an implication chevron before a column that names another fact",
  PILL_NO_VERDICT: "a status colour on a pill that says there is no verdict",
  TILES_ONE_MEASURE: "one measure at two dates or for two members, in separate tiles",
  STRIP_REPEATS_CHART: "a metric strip that repeats the figures its chart prints",
  NUMBER_CARDS: "a one-column fact grid whose tiles carry no sentence",
  METRIC_WORD_VALUE: "a metric or headline figure whose value is a word, not a number",
});

/**
 * The chart or figure a page drew where another form says the finding: dots
 * over time, a curve set as loose dots, numbers the reader has to compare in
 * boxes, a strip that prints what the chart under it prints, and value marks
 * with nothing to read them by. Each is refused with the form that says it.
 */
function chartFormDefect(page, id, exhibits, players, skip = new Set()) {
  for (const chart of exhibits.flatMap(chartsIn)) {
    if (["chart.scatter", "chart.bubble"].includes(chart?.type)) {
      const xs = (chart.points || []).map((p) => Number(p?.x)).filter(Number.isFinite);
      const years = xs.length >= 3 && xs.every((x) => Number.isInteger(x) && x >= 1900 && x <= 2100);
      // An x axis that measures time - years as numbers, or a label that reads as time (axis-measures-time): a scatter over
      // "months since launch" is a trend drawn without its line.
      const timed = () => years || (String(chart.xLabel ?? "").trim() && judged("axis-measures-time", String(chart.xLabel).trim(), null, id)?.verdict === "time");
      if (!skip.has("SCATTER_OVER_TIME") && timed())
        return { code: "SCATTER_OVER_TIME", message: `${id}: the scatter plots against time ("${chart.xLabel ?? `x from ${Math.min(...xs)} to ${Math.max(...xs)}`}"), which is a trend drawn without its line; set it as a \`trend\` page (form line), the dates as its categories and each series as a line, with a \`referenceLines\` entry for the level it is read against` };
      if (chart.connect !== true && !skip.has("SCATTER_CURVE")) {
        const curve = seriesOf(chart.points).find(monotone);
        if (curve) return { code: "SCATTER_CURVE", message: `${id}: ${curve.length} points${curve[0]?.series ? ` of "${curve[0].series}"` : ""} run in one direction as x grows - a curve, which as loose dots reads as a sample of observations; join each series in x order (\`connect: true\`, the series named at its end) and mark the level it is read against with \`referenceLines\` ({ value, label }: the break-even, the parity line, the hurdle)` };
      }
    }
    if (VALUE_CHARTS.has(chart?.type) && chart.dataLabels === false && chart.gridlines !== true && !skip.has("LABELS_OFF")) {
      const marks = (chart.series || []).reduce((n, s) => n + counted(s?.values), 0);
      if (marks && marks <= LABELLED_MARKS_MAX)
        return { code: "LABELS_OFF", message: `${id}: the ${chart.type.slice(6)} switches its value labels off with ${marks} marks and no gridlines, so the reader has nothing to read a value by; at ${LABELLED_MARKS_MAX} marks or fewer the values are printed on the marks - drop \`dataLabels: false\`, or set \`gridlines: true\` where the shape is the point` };
    }
  }
  // One tile across the page is a grey band holding a figure at its left end;
  // a single column earns its width only when every tile carries its sentence.
  const cards = exhibits.find((ex) => ex?.type === "fact-grid" && ex.columns === 1 && (ex.items || []).some((item) => !item?.text));
  if (cards && !skip.has("NUMBER_CARDS")) return { code: "NUMBER_CARDS", message: `${id}: a fact grid of one column sets each figure at the left of a band the page's width; run the ${(cards.items || []).length} facts across (drop \`columns\`, or set 2 to 4), or give every tile its sentence in \`text\`` };
  for (const table of exhibits.filter(isTable)) {
    // The chevron gutter says "therefore": it belongs before a column that
    // reads the row ("Competitive meaning"), not before one more fact
    // ("Conversion known?").
    const headers = (table.columns || []).map(headerText);
    const inferred = skip.has("GUTTER_UNEARNED") ? null : (table.columns || []).find((c) => c && typeof c === "object" && c.implication === true
      && (!String(c.label ?? "").trim() || judged("header-concludes", String(c.label).trim(), { headers }, id)?.verdict === "names-a-fact"));
    if (inferred) return { code: "GUTTER_UNEARNED", message: `${id}: the column "${inferred.label ?? ""}" is marked \`implication: true\`, which draws a "therefore" chevron before it, but its header names another fact, not what the row implies; drop \`implication\`, or head the column with the inference it draws ("What it means", "Verdict", "Recommended action")` };
    // A status colour on a row that has no status: amber for "Split" and
    // "Unranked" says the row is behind.
    const loud = skip.has("PILL_NO_VERDICT") ? null : table.rows.flatMap(rowCells).find((cell) => cell && typeof cell === "object" && cell.type === "rag" && cell.value !== "neutral"
      && String(cell.text ?? "").trim() && judged("pill-states-status", String(cell.text).trim(), null, id)?.verdict === "no-verdict");
    if (loud) return { code: "PILL_NO_VERDICT", message: `${id}: the status pill "${loud.text}" is drawn as ${loud.value}, a status colour, on a row with no verdict; set it \`value: "neutral"\` (a grey pill), and keep green, amber and red for states` };
  }
  // A metric is a figure: "Below plan", "Asia", "Strikes" or "Seven" set where
  // a number belongs is a label in a number's place, which a hundred-page
  // deck's self-check found rested on nothing the record held. A date is a
  // figure (a milestone's "2030"); a count is written in digits.
  const worded = [...(page.metrics || []), ...(page.kpi && typeof page.kpi === "object" ? [page.kpi] : [])]
    .find((tile) => tile && typeof tile === "object" && tile.measure === undefined && typeof tile.value === "string" && tile.value.trim() && !/\d/.test(tile.value));
  if (worded && !skip.has("METRIC_WORD_VALUE"))
    return { code: "METRIC_WORD_VALUE", message: `${id}: the ${page.kpi === worded ? "headline figure" : "metric"} "${worded.value}" ("${worded.label ?? ""}") is a word where a figure belongs. Give it the number the record holds - \`{ "measure": "<insight>/<measure>@<period or member>", "format": "...", "label": "..." }\`, a count in digits, a date - or say it in the copy and give the tile a measured figure` };
  // Tiles of one measure at two dates or for two members: the reader
  // compares them, and a comparison belongs on one axis. Two tiles in one unit
  // under different labels may be one measure or two, which is read
  // (tiles-one-measure); tiles in different units never are.
  const tiles = [...(page.metrics || []), ...exhibits.filter((ex) => ["fact-grid", "stat-list"].includes(ex?.type)).flatMap((ex) => ex.items || [])]
    .filter((item) => item && typeof item === "object" && figureOf(item.value) !== null);
  const label = (tile) => String(tile.label ?? "").trim();
  const paired = tiles.some((a, i) => tiles.slice(i + 1).some((b) => unitOf(a.value) === unitOf(b.value) && label(a) && label(b) && label(a).toLowerCase() !== label(b).toLowerCase()));
  if (paired && !skip.has("TILES_ONE_MEASURE")) {
    const read = judged("tiles-one-measure", tiles.map((tile, at) => ({ id: `t${at + 1}`, value: String(tile.value), label: label(tile) })), null, id);
    const [a, b] = read?.verdict === "one-measure" ? (read.pair || []).map((tid) => tiles[Number(String(tid).slice(1)) - 1]) : [];
    if (a && b)
      return { code: "TILES_ONE_MEASURE", message: `${id}: the tiles ${a.value} ("${a.label}") and ${b.value} ("${b.label}") are one measure at two dates or for two members, which the reader has to compare in separate boxes; plot the measure on one axis - a \`trend\` page across the dates, a \`ranking\` across the members, or the chart the page already carries - and keep tiles for measures that differ` };
  }
  // A strip over a chart that prints the same figures says them twice.
  if (page.type === "numbers" && page.form === "metric-strip" && (page.metrics || []).length) {
    const plotted = new Set(exhibits.flatMap(chartsIn).filter((chart) => chart?.dataLabels !== false)
      .flatMap((chart) => [...(chart.series || []).flatMap((s) => s?.values || []), ...(chart.values || []), ...(chart.points || []).flatMap((p) => [p?.x, p?.y])])
      .filter(finite).map((v) => Math.round(Number(v) * 100) / 100));
    const repeated = page.metrics.filter((m) => { const v = figureOf(m?.value); return v !== null && plotted.has(Math.round(v * 100) / 100); });
    if (plotted.size && repeated.length >= 2 && repeated.length * 2 > page.metrics.length && !skip.has("STRIP_REPEATS_CHART"))
      return { code: "STRIP_REPEATS_CHART", message: `${id}: the strip repeats ${repeated.map((m) => m.value).join(", ")}, which the chart under it prints on its marks; the strip carries what the chart does not - the change, the rate, the gap, a share of the total - or the page is the chart alone` };
  }
  return null;
}

/**
 * The first refusal `check(skip)` finds that the deck is held to. A revision
 * (`workflow: "existing_deck_revision"`) that records an older `rulesVersion`
 * predates every rule introduced since (weight.json rules): each such refusal
 * is recorded in `advisories` with the version that introduced it, and the
 * check is read again past it, so a later refusal the deck is held to is not
 * hidden behind a waived one. A refusal is `"<id>: CODE - ..."` or
 * `{ code, message }`.
 */
function unwaived(check, { waived, rules, advisories }) {
  const skip = new Set();
  for (;;) {
    const found = check(skip);
    if (!found) return null;
    const message = typeof found === "string" ? found : found.message;
    const code = typeof found === "string" ? /^[^:]+: ([A-Z][A-Z_]+) - /.exec(found)?.[1] : found.code;
    if (!code || skip.has(code) || !predatedRule(rules, code, undefined, waived)) return found;
    advisories.push(waivedAdvice(code, code, message, rules));
    skip.add(code);
  }
}

/** A refusal the deck predates, as the advisory the author reads in its place. */
const waivedAdvice = (code, rule, message, rules) =>
  `${code}: ${String(message).replace(/^[^:]+:\s*(?:[A-Z][A-Z_]+ - )?/, "")} (not enforced: introduced in rules version ${ruleIntroduced(rule)}, after the version ${rules?.rulesVersion} this revision records)`;

/**
 * Shares of one measure set as same-size tiles. A metric strip held 9.6% and
 * 57% of the same web-visit measure in boxes of one width, and its chart
 * 2.0% and 78% in bars of one width: equal boxes say the numbers are alike
 * when the point is that they are not. Advisory - tiles of different measures
 * are right, and whether two labels name one measure is a reading, not a rule.
 */
function sharesInTiles(page, exhibits) {
  const items = [...(page.metrics || []), ...(page.blocks || []).map((b) => b?.metric),
    ...exhibits.filter((ex) => ["fact-grid", "stat-list", "cards"].includes(ex?.type)).flatMap((ex) => ex.items || [])].filter((item) => item && typeof item === "object");
  const shares = items.map((item) => ({ item, pct: /^\s*(\d+(?:\.\d+)?)\s?%\s*$/.exec(String(item.value ?? ""))?.[1], terms: new Set(words(item.label).map((w) => w.toLowerCase().replace(/[^a-z]/g, "")).filter((w) => w.length > 3)) }))
    .filter((s) => s.pct !== undefined && Number(s.pct) > 0);
  for (const [i, a] of shares.entries()) for (const b of shares.slice(i + 1)) {
    const shared = [...a.terms].filter((w) => b.terms.has(w));
    const [lo, hi] = [Number(a.pct), Number(b.pct)].sort((x, y) => x - y);
    if (shared.length >= 2 && hi / lo > 5)
      return `SHARES_IN_TILES: ${a.item.value} and ${b.item.value} are shares of one measure ("${a.item.label}") set in tiles of one size, so a reader sees two alike boxes where one is ${Math.round(hi / lo)} times the other; set the shares on one 0-100% scale - a bar, a dumbbell or a slope - and keep tiles for measures that differ`;
  }
  return null;
}

/**
 * The page's text that the composer sets a `highlight` in (compose-passes.mjs
 * highlightThePhrase): the points and row blocks, the rail or a side panel,
 * the so-what bar and the takeaway, paragraphs, panel captions, and the cells of a table,
 * a findings matrix or a comparison. The compile check reads the same list, so
 * a phrase it accepts is a phrase the page draws.
 */
export function accentTexts(page) {
  const texts = [];
  const add = (value) => { if (typeof value === "string" && value.trim()) texts.push(value); };
  const point = (p) => { if (typeof p === "string") add(p); else if (p && typeof p === "object") { add(p.lead); add(p.text); (p.points || []).forEach(add); } };
  const cell = (c) => (Array.isArray(c) ? c.forEach(add) : point(c));
  (page.points || []).forEach(point);
  (page.blocks || []).forEach((block) => (block?.points || []).forEach(point));
  add(page.rail); add(page.bar); add(page.panel?.text);
  (page.paragraphs || []).forEach(point);
  if (typeof page.takeaway === "string") add(page.takeaway);
  (page.rows || []).forEach((row) => (Array.isArray(row?.cells) ? row.cells : []).forEach(cell));
  for (const ex of exhibitsOf(page)) {
    if (!ex || typeof ex !== "object") continue;
    add(ex.caption);
    // A list in a cell is bulleted, and marked, only where the exhibit reads one.
    const lists = ex.type === "rows" || ex.type === "phase-table";
    for (const row of Array.isArray(ex.rows) ? ex.rows : []) rowCells(row).forEach((c) => (Array.isArray(c) && !lists ? null : cell(c)));
    for (const side of [ex.left, ex.right]) if (side && typeof side === "object") { (side.points || []).forEach(point); add(side.text); }
  }
  return texts;
}

/** Where the page says something without drawing an accent, for the message that names it. */
function unaccentedPlaces(page) {
  const places = [["title", page.title], ["subtitle", page.subtitle]];
  for (const ex of exhibitsOf(page)) {
    if (!ex || typeof ex !== "object") continue;
    places.push(["exhibit's heading", ex.heading]);
    for (const a of ex.annotations || []) places.push(["chart's callout", a?.text]);
  }
  return places.filter(([, text]) => typeof text === "string");
}

/**
 * The page types a data shape can carry: the types that ask for it
 * (TYPE_SHAPES), and every type that asks for no shape at all.
 */
export function typesForShape(shape) {
  return { asking: Object.entries(TYPE_SHAPES).filter(([, shapes]) => shapes.includes(shape)).map(([name]) => name),
    open: Object.keys(PAGE_TYPES).filter((name) => !TYPE_SHAPES[name]) };
}
const typesLine = (shapes) => {
  const lines = [...new Set(shapes)].map((shape) => { const { asking } = typesForShape(shape); return `${shape} carries ${asking.length ? asking.join(", ") : "none of the data types"}`; });
  return `${lines.join("; ")}; any shape carries ${typesForShape(null).open.join(", ")}`;
};

// A title leads with the finding. One that states a gap or a method note -
// what the evidence lacks, cannot settle or leaves undisclosed - puts the
// limitation where the answer belongs; the limitation goes in the `subtitle`
// or a footnote, and the title says which way the evidence leans. Whether a
// title leads with its gap is read (title-leads-with-gap): the words it
// rests on, where it does; null where it does not or is not yet read.
export const titleGap = (title, where = null) => {
  const text = String(title ?? "").trim();
  if (!text) return null;
  const read = judged("title-leads-with-gap", text, null, where);
  return read?.verdict === "gap" ? read.quote ?? text : null;
};

// A title that is only a measurement - "The fleet is 116 aircraft": a count
// with no comparator and no consequence. It tells the reader how many, not
// against what or so what. A title with a number that is not a year is read
// (title-count-only).
const COUNT = /(?<![\p{L}\d])(?!(?:19|20)\d\d(?![\d.,]))\d[\d,.]*/u;
export const countOnlyTitle = (title, where = null) => { const t = String(title ?? "").trim(); return COUNT.test(t) && judged("title-count-only", t, null, where)?.verdict === "count-only"; };

// A point's own figure: its first quantity with a currency, a percentage or a
// unit, else its first number that is not a year. In a point of evidence the
// number is what the reader should see first, so an unmarked point is marked
// on it (and a point with no figure is named, not refused).
const FIGURE = /(?<![\p{L}\d.,])(?:US\$|A\$|[$£€¥]|(?:AED|USD|EUR|GBP|SAR|QAR)\s?)?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|trillion|percentage points|bn|mn|m|k|pp|pts|x)(?![\p{L}\d])|%|×)?/gu;
export function pointFigure(text) {
  const found = [...String(text ?? "").matchAll(FIGURE)].map((m) => m[0].trim()).filter((figure) => hasPhrase(text, figure));
  const unit = found.find((figure) => /[%×$£€¥]|[a-z]$|^(?:AED|USD|EUR|GBP|SAR|QAR)/i.test(figure));
  return unit ?? found.find((figure) => !/^(?:19|20)\d\d$/.test(figure)) ?? null;
}

// Commentary placements whose text says something the exhibit does not, and
// so records what (`adds`). A rail and a so-what bar are one sentence each,
// which is what they add; the others carry several and say it in `adds`.
const ADDS_WRITTEN = ["beside", "beside-left", "below", "captions", "on-exhibit"];
const ADDS_SAID = { rail: "rail", "so-what-bar": "bar" };

/** A chart or a table measures something: its claim is settled by a count, share, rank, rate, sequence, comparison or structure. */
const measuredPage = (type, form, exhibits) => chartPage(type, exhibits) || (familyOf(type, form) === "table" && type !== "matrix");

/**
 * A page's `source` as its citation line. A list names keys of the pages
 * file's `sources` registry - `{ key: { name, url, status } }` - and is set
 * as "Source: name (status); name", so one source is written once and cited
 * by key on every page that rests on it.
 */
export function citationOf(source, registry, id = "page") {
  if (!Array.isArray(source)) return source;
  if (!registry || typeof registry !== "object") throw new Error(`${id}: \`source\` lists registry keys (${source.join(", ")}), but the pages file has no \`sources\` registry - add \`sources: { key: { name, url, status } }\` beside \`deck\` and \`pages\`, or write the citation as text`);
  const unknown = source.filter((key) => !registry[key]);
  if (unknown.length) throw new Error(`${id}: \`source\` names ${unknown.map((k) => `"${k}"`).join(", ")}, which the \`sources\` registry does not hold; its keys are ${Object.keys(registry).join(", ")}`);
  return citationForms(source, registry)[0];
}

/**
 * The ways the runtime may set a citation it wrote itself from registry keys,
 * fullest first: every source by name with its status; by its `short` name
 * where the registry gives one; without the statuses; then the leading names
 * with the rest counted ("+3 more"), down to the count alone. The footer
 * shows the first that fits its lines and the words it has room for under the
 * note bar (page-template.mjs, core.mjs compileSlide), so a page that rests on
 * many records is never refused for the citation the runtime derived, and
 * whatever the footer leaves out is kept whole in the speaker notes. A citation typed as text has one form, the author's.
 */
export function citationForms(keys, registry) {
  const entries = keys.map((key) => registry[key]);
  const label = entries.length > 1 ? "Sources" : "Source";
  const line = (names) => `${label}: ${names.join("; ")}`;
  // Several articles of one publisher share its short name: a short form says it once, and the fullest form names each.
  // When a source was read changes nothing about how its number reads: it is the registry's `retrieved`, which no form
  // prints - on a deck whose every source was retrieved one day, it was a third of every footer.
  const named = (short, status) => [...new Set(entries.map((e) => { const name = short && typeof e.short === "string" && e.short.trim() ? e.short.trim() : e.name;
    return status && e.status ? `${name} (${e.status})` : name; }))];
  const brief = named(true, false);
  const counted = Array.from({ length: Math.max(0, brief.length - 1) }, (_, i) => brief.length - 1 - i)
    .map((shown) => `${line(brief.slice(0, shown))}; +${brief.length - shown} more in the notes`);
  return [...new Set([line(named(false, true)), line(named(true, true)), line(brief), ...counted, `${label}: ${entries.length} ${entries.length === 1 ? "record" : "records"}, listed in the notes`])];
}

/**
 * What the compile refuses of a page's title band for its length, all of it:
 * `{ refused, waived }`. `refused` holds the title past its words
 * (`TITLE_WORDS`) and then whatever the subtitle is refused for - its words,
 * its one line, a restated title or heading - each a whole message; `waived`
 * the title refusal a revision recorded under an earlier rules version hears as
 * advice. Read off the page alone, so a caller can say it of a page the
 * compile stopped at for something else (author-deck.mjs compileDeck): every
 * length a first run can know is said at the first run.
 */
export function titleBandProblems(page, id, { rules = null, waived = waivedRules(rules ?? {}) } = {}) {
  const refused = [], advised = [];
  const said = titleWords(page?.title);
  if (said > TEXT_LIMITS.titleWords) {
    const message = `${id}: TITLE_WORDS - the title runs to ${said} words and the build refuses past ${TEXT_LIMITS.titleWords}; keep the finding and its comparator (${TEXT_LIMITS.titleTarget} words is the norm) and move the period, the population and the scope to \`subtitle\``;
    // A revision recorded under an earlier rules version is held to that version's bar.
    const rule = predatedRule(rules, "TITLE_WORDS", said, waived);
    if (rule) advised.push(waivedAdvice("TITLE_WORDS", rule, message, rules)); else refused.push(message);
  }
  if (page?.subtitle !== undefined) {
    const problem = subtitleProblem(String(page.title ?? ""), page.subtitle, exhibitsOf(page));
    if (problem) refused.push(`${id}: the subtitle ${problem}`);
  }
  return { refused, waived: advised };
}

/**
 * The page's spine, checked before anything else and in every mode: the
 * type and its choices, the title, what settles the claim and the insights it
 * rests on. A spine compile stops here; the exhibit and the copy are the full
 * compile's.
 */
function spineOf(page, id, { insights = null, sources = null, rules = null, waived = new Set(), waivedAdvisories = [] } = {}) {
  const type = PAGE_TYPES[page.type];
  if (!type) throw new Error(`${id}: unknown page type "${page.type}"; one of ${Object.keys(PAGE_TYPES).join(", ")}`);
  for (const key of OWNED) if (page[key] !== undefined) throw new Error(`${id}: \`${key}\` is set by the page's choices, not written - choose \`commentary\`, \`form\` and \`takeaway\` instead`);
  // One body size across the deck: a page set a size smaller than its
  // neighbours reads as a different document. A page that needs room takes it
  // from its layout, and the appendix is set at its own size by the composer.
  if (page.density !== undefined) throw new Error(`${id}: \`density\` is the deck's, not the page's - the deck sets one body size (\`density\` on the deck); a page that needs room changes its layout (another form, fewer rows, a split across two pages) or moves to the appendix`);
  const forms = Object.keys(type.forms);
  if (!forms.includes(page.form)) throw new Error(choose(id, "form", forms, page.form));
  if (!commentaryOf(page.type, page.form).includes(page.commentary)) throw new Error(choose(id, "commentary", commentaryOf(page.type, page.form), page.commentary));
  // Row blocks carry their explanation in their own bullets; a band of points
  // under five rows of bullets says it twice.
  if (page.form === "labelled-rows" && !["in-exhibit", "so-what-bar"].includes(page.commentary))
    throw new Error(choose(id, "commentary", ["in-exhibit", "so-what-bar"], page.commentary).replace("There is no default", "Each row's bullets are the commentary; there is no default"));
  // No close is the norm: strong decks close about one page in ten on a line.
  if (page.takeaway === undefined) page.takeaway = false;
  if (!(page.takeaway === false || (typeof page.takeaway === "string" && page.takeaway.trim())))
    throw new Error(`${id}: \`takeaway\` is the closing sentence, or false (the default); most pages let the title carry the message`);
  if (page.commentary === "so-what-bar" && page.takeaway !== false)
    throw new Error(`${id}: the so-what bar is the page's close; leave \`takeaway\` out (or \`takeaway: false\`) - a closing line under the bar says the implication twice`);
  if (page.bar !== undefined && page.commentary !== "so-what-bar")
    throw new Error(`${id}: \`bar\` is the text of a so-what bar - choose commentary "so-what-bar" for it, or drop it`);
  if (typeof page.why !== "string" || textWords(page.why) < 4)
    throw new Error(`${id}: say in \`why\` why a ${page.type} page (${type.task}) is the right one for this claim`);
  // The title band's lengths are refused together: a page told its title is long and, a run later, that its subtitle is too
  // has cost a compile for what one reading of the page knew.
  const band = titleBandProblems(page, id, { rules, waived });
  waivedAdvisories.push(...band.waived);
  if (band.refused.length) throw new Error(band.refused.length === 1 ? band.refused[0] : `${band.refused[0]}; and its subtitle ${band.refused[1].slice(`${id}: the subtitle `.length)}`);
  // Every icon the page names, checked here with the nearest names: "Unknown
  // icon: plane" surfaced from the composer with no list to choose from.
  const icons = [];
  const walk = (value) => { if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === "object") for (const [key, v] of Object.entries(value)) { if (key === "icon" && typeof v === "string") icons.push(v); else walk(v); } };
  walk(page);
  const unknown = icons.find((name) => !iconDefinition(name));
  if (unknown) throw new Error(`${id}: ${unknownIcon(unknown)}`);
  // A delta or a trend arrow is coloured by merit: `better` names the
  // direction that is good news - "down" for a cost, churn or a wait - on a
  // metric, a table's row or column, or one trend cell.
  const polarity = [];
  const seek = (value, path) => { if (Array.isArray(value)) value.forEach((v, i) => seek(v, `${path}[${i}]`)); else if (value && typeof value === "object") for (const [key, v] of Object.entries(value)) { if (key === "better") polarity.push([path, v]); else seek(v, path ? `${path}.${key}` : key); } };
  seek(page, "");
  const wrong = polarity.find(([, v]) => !POLARITIES.includes(v));
  if (wrong) throw new Error(`${id}: \`better\` on ${wrong[0] || "the page"} is ${JSON.stringify(wrong[1])}; it names the direction that is good news for the measure - "up" (the default: revenue, share, retention) or "down" (a cost, churn, a wait) - so a delta or trend arrow is coloured by merit, not by sign`);
  if (page.sourceForms !== undefined) throw new Error(`${id}: \`sourceForms\` is written by the compiler from the \`sources\` registry; cite with \`source\` - registry keys, or the citation as text`);
  if (page.source !== undefined) {
    const keys = Array.isArray(page.source) ? page.source : null;
    page.source = citationOf(page.source, sources, id);
    if (keys) page.sourceForms = citationForms(keys, sources);
  }

  // The content decisions, made before the layout ones and checked first:
  // what settles the claim, and what the commentary adds. With an insight log
  // the page names the insights it rests on, and they settle it.
  const measured = measuredPage(page.type, page.form, exhibitsOf(page));
  let settles = page.settles;
  const evidence = Array.isArray(page.evidence) ? page.evidence : [];
  if (insights) {
    const needs = TYPE_SHAPES[page.type];
    if (needs && !evidence.length) throw new Error(`${id}: name the insights this ${page.type} page rests on in \`evidence\` (ids from the insight log)`);
    const found = evidence.map((key) => insights.get(key));
    const missing = evidence.filter((key, i) => !found[i]);
    if (missing.length) throw new Error(`${id}: \`evidence\` names ${missing.join(", ")}, which the insight log does not hold`);
    if (needs && !found.some((item) => needs.includes(item.shape))) {
      const shapes = found.map((i) => i.shape ?? "unshaped");
      throw new Error(`${id}: a ${page.type} page needs evidence shaped as ${needs.map((s) => `${s} (${SHAPES[s].means})`).join(" or ")}; its insights are ${[...new Set(shapes)].join(", ")}. ` +
        `Find that data, or choose a type the evidence supports: ${typesLine(shapes.filter((s) => SHAPES[s]))}`);
    }
    if (!settles && found.length) {
      const lead = found.find((item) => !needs || needs.includes(item.shape)) ?? found[0];
      // A scorecard of judgements is settled by the comparison it draws.
      const kind = SHAPES[lead.shape]?.kind ?? "qualitative";
      settles = { kind: measured && kind === "qualitative" ? "comparison" : kind, what: found.map((item) => item.finding).join(" ") };
    }
  }
  if (!["statement", "summary"].includes(page.type)) {
    if (!settles || !SETTLES_KINDS.includes(settles.kind) || typeof settles.what !== "string" || !settles.what.trim())
      throw new Error(`${id}: say what settles the claim - \`settles: { kind, what }\`, kind one of ${SETTLES_KINDS.join(", ")}${insights ? ", or name its insights in `evidence`" : ""}`);
    if (measured && settles.kind === "qualitative")
      throw new Error(`${id}: a ${page.type} page ${familyOf(page.type, page.form) === "table" ? "tabulates" : "plots"} a measure, so its claim is not settled by a "qualitative" judgement; name what the ${familyOf(page.type, page.form) === "table" ? "table" : "chart"} settles - ${SETTLES_KINDS.filter((k) => k !== "qualitative").join(", ")} - or, where the evidence is statements rather than measures, choose the type that carries them (matrix, mechanism, argument, parallel)`);
  }
  const titleAdvisories = countOnlyTitle(page.title, id)
    ? [`TITLE_COUNT_ONLY: the title states a number without a comparator or consequence ("${page.title}"); say against what, or what follows - the finding, not only the measurement`] : [];
  return { type, settles, evidence, titleAdvisories };
}

// The exhibit a form draws when the form itself sets its type, or null where
// the author names it (a hero number's proof, a panel, a row block's exhibit).
const formDraws = (type, form) => {
  const target = PAGE_TYPES[type]?.forms[form];
  if (!target) return null;
  if (target.startsWith("chart.")) return target;
  if (target === "aligned-bars") return "chart-group";
  if (target === "model-page") return CHART("column");
  if (PAGE_TYPES[type].table || (type === "profiles" && form === "logo-table")) return "table";
  if (["mechanism", "schedule", "composition", "profiles"].includes(type)) return target;
  if (type === "parallel" && form !== "labelled-rows") return target;
  if (type === "numbers" && ["fact-grid", "stat-list"].includes(form)) return target;
  return type === "place" ? "map" : type === "statement" && form === "quotes" ? "quote-cluster" : type === "options" && form === "compare" ? "compare" : null;
};
// How many exhibits a page of each construction carries when its own are not written yet.
const declaredExhibits = (type, form) => (type === "panels" || (type === "options" && form !== "compare") ? 2
  : type === "picture" ? (form === "photo-backdrop" ? 1 : 0) : ["argument", "summary", "matrix"].includes(type) || form === "labelled-rows" || form === "statement" ? 0 : 1);

/** An exhibit a spine declares and has not drawn: nothing but its `basis`, its `type`, or neither. */
export const undrawnExhibit = (ex) => Boolean(ex) && typeof ex === "object" && Object.keys(ex).every((key) => key === "type" || key === "basis");

// An exhibit that names the measures the runtime is to write its numbers from, and carries none yet.
const unfilledExhibit = (ex) => plottedValues(ex) === 0 && /"measure"\s*:/.test(JSON.stringify(ex));

/**
 * A page as its declared choices alone describe it: the slide its `type`,
 * `form` and `commentary` would compile to, with the record the variety
 * contract counts (`pageType`), and nothing checked. It stands in for a page
 * that does not compile, and for a page of a plan whose exhibit is not
 * written yet, so the rules that read a deck's structure are evaluated on
 * every page on every run (deck-structure.mjs); `pageType.declared` marks it
 * as provisional. The page's own exhibits are kept where it has them;
 * otherwise it carries as many as its form draws, typed by the form or, where
 * the author names the exhibit, by `exhibitType` (the kind its evidence takes,
 * or a list of kinds, one for each exhibit in turn);
 * an unwritten profiles page carries the deck's `players`. An exhibit the
 * page declares with a `basis` stub and has not drawn is read as the stub
 * declares it (`stubs`, deck-structure.mjs stubsOf): its kind where the form
 * leaves it open, and the values its measures hold - or no count at all where
 * it names none, since an undrawn exhibit plots nothing yet rather than zero.
 * Null for a page with no known type; a form or placement the type does not
 * offer is left out of the record.
 */
export function declaredSlide(pageIn, index = 0, { exhibitType = "table", players = null, stubs = null } = {}) {
  const page = pageIn && typeof pageIn === "object" ? pageIn : {};
  const type = PAGE_TYPES[page.type];
  if (!type) return null;
  const form = Object.hasOwn(type.forms, page.form ?? "") ? page.form : null;
  const commentary = form && commentaryOf(page.type, form).includes(page.commentary) ? page.commentary : type.commentary.includes(page.commentary) ? page.commentary : null;
  const target = form ? type.forms[form] : null;
  const draws = formDraws(page.type, form);
  const own = exhibitsOf(page).map((ex) => ({ ...ex }));
  // An exhibit the spine declares and has not drawn (a `basis` stub) is read as what it declares, never as one drawn with nothing in it.
  const written = own.filter((ex) => !undrawnExhibit(ex));
  const exhibits = own.length ? own : Array.from({ length: form ? declaredExhibits(page.type, form) : 0 }, () => ({}));
  const estimate = (at) => (Array.isArray(exhibitType) ? exhibitType[at % exhibitType.length] ?? "table" : exhibitType);
  exhibits.forEach((ex, at) => { if (!ex.type) ex.type = at === 0 && draws ? draws : draws && page.type !== "numbers" ? draws : stubs?.kinds?.[at] ?? estimate(at); });
  if (target === "aligned-bars" && exhibits[0]) exhibits[0].aligned = true;
  // A profiles page not yet written will introduce the deck's players by their marks, each in the kind it declares.
  if (page.type === "profiles" && !written.length && exhibits[0] && form !== "radar" && Array.isArray(players))
    exhibits[0].items = playerEntries(players).map((entry) => ({ name: entry.name, logo: plannedMark(entry) }));
  const slide = { id: page.id ?? `page-${index + 1}`, title: page.title ?? "" };
  const text = ["beside", "beside-left", "below"].includes(commentary);
  if (Array.isArray(page.points) ? page.points.length : text || form === "executive-summary") slide.points = Array.isArray(page.points) ? page.points : [""];
  for (const key of ["blocks", "rows", "metrics", "kpi", "photo", "pictures", "paragraphs"]) if (page[key] !== undefined) slide[key] = page[key];
  if (exhibits.length === 1 && page.type !== "panels") slide.exhibit = exhibits[0]; else if (exhibits.length) slide.exhibits = exhibits;
  // The layout each choice sets, as layOutPage sets it on a page that compiles.
  const layoutFor = { beside: "exhibit-left", "beside-left": "exhibit-right", below: "exhibit-top", rail: "sidebar" };
  if (page.type === "panels") slide.arrange = form ?? "row";
  else if (page.type === "numbers") {
    slide.layout = form === "hero-number" ? "hero-number" : form === "metric-strip" ? "metrics-over-exhibit" : layoutFor[commentary] ?? "exhibit-full";
    if (form === "metric-strip" && !slide.metrics) slide.metrics = [{}];
  } else if (page.type === "picture" || form === "labelled-rows" || page.type === "argument" || (page.type === "options" && form !== "compare")) { if (target) slide.layout = target; }
  else if (page.type === "statement") { if (form === "statement") slide.kind = "statement"; }
  else if (page.type === "summary") { if (form === "takeaways") slide.kind = "takeaways"; else slide.role = "executive-summary"; }
  else if (target === "model-page") { slide.shape = "model-page"; slide.layout = "stack"; }
  else if (page.type === "options") { /* a comparison table sets no layout */ }
  else if (!type.rows && form !== "measure-table") slide.layout = layoutFor[commentary] ?? "exhibit-full";
  else if (layoutFor[commentary]) slide.layout = layoutFor[commentary];
  if (type.rows) slide.shape = "findings-matrix";
  if (form === "measure-table") slide.shape = "measure-table";
  if (form === "photo-backdrop" && !slide.photo) slide.photo = {};
  // An argument's prose sets beside its panel in either form.
  if (page.type === "argument") slide.panel = page.panel ?? { text: "" };
  if (commentary === "rail") slide.panel = { text: String(page.rail ?? page.title ?? "") };
  if (commentary === "so-what-bar") slide.soWhat = { text: String(page.bar ?? ""), style: "bar" };
  if (typeof page.takeaway === "string" && page.takeaway.trim()) slide.soWhat = page.takeaway.trim();
  const drawn = exhibitsOf(slide);
  slide.pageType = { type: page.type, ...(form ? { form } : {}), ...(commentary ? { commentary } : {}), takeaway: typeof page.takeaway === "string" && Boolean(page.takeaway.trim()),
    ...(page.series ? { series: String(page.series) } : {}), why: String(page.why ?? "").trim(), family: familyOf(page.type, form),
    // What the page plots: its drawn exhibits' values and, for its stubs, the values their measures hold - unread where a stub names none.
    // An exhibit that names its measures and has not been filled from them is as undrawn as a stub: its depth is not read as zero.
    ...(own.length && !written.some(unfilledExhibit) && (written.length === own.length || Number.isFinite(stubs?.values)) ? { values: plottedValues(written) + (written.length === own.length ? 0 : stubs.values) } : {}),
    ...(chartPage(page.type, drawn) ? { chart: true } : {}), declared: true,
    // A revision's page stands in with the slide it was imported from, as its compiled record carries it.
    ...(page.sourceSlide !== undefined ? { sourceSlide: page.sourceSlide } : {}), ...(Array.isArray(page.only) && page.only.length ? { only: page.only.map(String) } : {}),
    content: { claim: String(page.title ?? page.text ?? "").trim(), ...(page.settles && typeof page.settles === "object" ? { settles: page.settles } : {}), adds: page.adds ?? null,
      ...(Array.isArray(page.evidence) && page.evidence.length ? { evidence: page.evidence } : {}) } };
  slide.pageType.structure = structureOf(slide);
  slide.pageType.skeleton = skeletonOf(slide);
  slide.pageType.drawn = drawnOf(slide);
  return slide;
}

/**
 * `page` with another `form` and `commentary` chosen and its content left as
 * written, for the fit search to compile (fit-search.mjs). An exhibit `type`
 * the page wrote only to repeat what its form draws is dropped, so the new
 * form sets it; any other type stays, and the compiler says so if the form
 * cannot draw it.
 */
export function withChoice(page, form, commentary) {
  const out = structuredClone(page);
  const first = out.exhibit ?? out.exhibits?.[0];
  if (form !== page.form && first && typeof first === "object" && first.type !== undefined && first.type === formDraws(page.type, page.form)) delete first.type;
  return Object.assign(out, { form, commentary });
}

/**
 * Compile one typed page into a deck-spec slide. Throws with the choice to
 * make when a choice is missing or impossible; structural pages (`kind`
 * cover, section, agenda) pass through unchanged.
 *
 * Only the first refusal is shown, so the checks run in the order a fix is
 * made: the choices are valid; the page is the right shape (the exhibits,
 * their data and limits, the tables and prose a review would send to another
 * page); the type's evidence holds (marked, periods, members, the floor); and
 * last the cells. A blank total refused before the table is found too short
 * to be a table would be a fix made and then thrown away.
 */
export function compilePage(pageIn, index = 0, { insights = null, players = null, spineOnly = false, sources = null, rules = null } = {}) {
  if (!pageIn || typeof pageIn !== "object") throw new Error(`page ${index + 1} is not an object`);
  const page = structuredClone(pageIn);
  const id = page.id ?? `page-${index + 1}`;
  if (!page.type) {
    // A section's number is the divider's numeral and the tracker's marker;
    // "01 / " written into its title as well numbers it three ways.
    // A structural page written without an id is given one from its kind and its place, here, once: every later stage
    // - the content plan, the composition, the build - then names it the same way, where each would otherwise number it by its own count.
    const named = { ...page, id: page.id ?? `${page.kind}-${index + 1}` };
    if (page.kind === "section" && typeof page.title === "string" && /^\s*\d{1,2}\s*[/|.:)\-–—]/.test(page.title)) return { ...named, title: page.title.replace(/^\s*(?:section\s+)?\d{1,2}\s*(?:[/|.:)\-–—]\s*)+/i, "").trim() || page.title };
    if (page.kind && ["section", "divider", "agenda", "cover"].includes(page.kind)) return named;
    throw new Error(`${id}: give the page a \`type\` - one of ${Object.keys(PAGE_TYPES).join(", ")} - or a structural \`kind\` (section, agenda). Run \`node runtime/author-deck.mjs --types\` for what each is for.`);
  }
  // `rules` is the deck's { workflow, rulesVersion }: a revision recorded
  // under an older version hears the refusals introduced since as advisories.
  const waived = waivedRules(rules ?? {}), waivedAdvisories = [];
  const { type, settles, evidence, titleAdvisories } = spineOf(page, id, { insights, sources, rules, waived, waivedAdvisories });
  // There is one compile. A page whose references do not bind yet has nothing past its spine to check - its type and
  // choices, its title, what settles it, the insights it rests on (`spineOnly`); every other page, a draft's among them, is
  // compiled whole. A draft reaches here with the page completed by placeholder copy (spine-witness.mjs), so nothing below
  // is waived for it: a declaration the compile refuses, it refuses in a draft.
  if (spineOnly) return null;
  if (page.adds !== undefined && page.adds !== null && typeof page.adds !== "string") throw new Error(`${id}: \`adds\` is what the commentary says that the exhibit cannot - a sentence, or null`);
  // Each refusal says which step made it (`stage` on the error): the page's shape - the exhibits its form carries and their
  // types - the evidence those exhibits hold under the type and form, the copy, or the layout.
  const staged = (stage, run) => { try { return run(); } catch (error) { if (error && typeof error === "object" && error.stage === undefined) error.stage = stage; throw error; } };
  const { slide, target, exhibits, setType, primary } = staged("shape", () => typedSlide(page, id, type, players));
  staged("evidence", () => checkExhibitData({ page, id, slide, exhibits, primary }));
  const { values, isChart } = staged("evidence", () => checkTypeEvidence({ page, id, type, slide, exhibits, primary, players, rules, waived, waivedAdvisories }));
  const { points, unmarkedPoints } = staged("copy", () => checkCommentary({ page, id, slide, exhibits, primary, rules, waived, waivedAdvisories }));
  staged("layout", () => layOutPage({ page, id, type, slide, target, exhibits, setType, primary, points }));
  return withPageType({ page, slide, exhibits, primary, values, isChart, unmarkedPoints, waivedAdvisories, settles, evidence, titleAdvisories });
}

/** The slide a page compiles to: its own keys less the choices, its exhibits typed by the form, the players' cells marked, and the primary exhibit. */
function typedSlide(page, id, type, players) {
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
  if (target === "model-page") {
    // A chart over its own data table: the chart is the trend's, its type the
    // author's among the series charts, and the table is built from its data.
    if (!exhibits.length) throw new Error(`${id}: form "model" needs its chart`);
    const chart = slide.exhibit ?? slide.exhibits[0];
    chart.type ??= CHART("column");
    if (!MODEL_CHARTS.includes(chart.type)) throw new Error(`${id}: a model page sets a series over its data table - its chart is ${MODEL_CHARTS.join(", ")}; "${chart.type}" is not one`);
    if (!Array.isArray(chart.series) || !chart.series.length) throw new Error(`${id}: a model page's chart carries the \`series\` its data table prints`);
    slide.shape = "model-page";
  } else if (target.startsWith("chart.") || target === "aligned-bars" || ["mechanism", "schedule", "composition"].includes(page.type) || (page.type === "profiles" && page.form !== "logo-table")
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
  const untyped = exhibitsOf(slide).filter((ex) => !ex.type);
  if (untyped.length) throw new Error(`${id}: ${untyped.length === 1 ? "the exhibit has" : `${untyped.length} exhibits have`} no \`type\`; a ${page.type}/${page.form} page does not set it, so name it (table, chart.bar, map, ...)`);
  // Cells naming a player become its mark before any check reads the table, and every place a page draws a player's
  // mark - a cell or a logos member naming it, a logo planned under its name - is planned in the kind the player declares.
  if (players) { markPlayerCells(slide, players); planPlayerMarks(slide, players); }
  for (const ex of exhibitsOf(slide)) readableCategories(ex);
  const primary = slide.exhibit ?? slide.exhibits?.[0];
  return { slide, target, exhibits, setType, primary };
}

/** The exhibits' data: the keys each one's form reads, the limits on its marks and on the form's, and the minimum its type needs. */
function checkExhibitData({ page, id, slide, exhibits, primary }) {
  // The exhibit carries the data its form reads, named before the build has to.
  for (const ex of exhibitsOf(slide)) {
    const keys = CONSTRUCTION_DATA[ex.type] ? [] : dataKeys(ex.type);
    if (keys.length && !keys.some((key) => ex[key] !== undefined))
      throw new Error(`${id}: a ${ex.type} exhibit reads ${keys.map((k) => `\`${k}\``).join(", ")} - none is given`);
  }
  // What the component can hold, and what the type needs to be worth a page.
  for (const ex of exhibitsOf(slide)) {
    const limit = LIMITS[ex.type], n = limit && Array.isArray(ex[limit.key]) ? ex[limit.key].length : null;
    if (n !== null && (n < limit.min || (limit.max && n > limit.max)))
      throw new Error(`${id}: a ${ex.type} holds ${limit.min}${limit.max ? ` to ${limit.max}` : " or more"} ${limit.key}; this one has ${n}`);
    const long = limit?.valueChars && (ex.items || []).find((item) => String(item?.value ?? "").length > limit.valueChars);
    if (long) throw new Error(`${id}: a ${ex.type} value is a figure of ${limit.valueChars} characters at most ("${long.value}"); put the unit in the label`);
    // How many tiles a grid runs across is held where the page is compiled, in the page's words: the composer's refusal of it
    // came a stage later and named a width in pixels.
    if (limit?.columns && ex.columns !== undefined && !(Number.isInteger(ex.columns) && ex.columns >= 1 && ex.columns <= Math.min(limit.columns, (ex.items || []).length)))
      throw new Error(`${id}: a ${ex.type}'s \`columns\` is how many tiles run across - a whole number from 1 to ${limit.columns}, and no more than its ${(ex.items || []).length} items (got ${JSON.stringify(ex.columns)}). ${(ex.items || []).length > limit.columns ? `${(ex.items || []).length} items run in rows of ${limit.columns} or fewer: leave \`columns\` out and the grid sets them` : "Leave it out and the grid sets them"}`);
    if (ex.type?.startsWith("chart.") && (ex.annotations || []).length > CALLOUTS_MAX)
      throw new Error(`${id}: a chart carries ${CALLOUTS_MAX} callouts at most (this one has ${ex.annotations.length}); the rest is commentary - choose "beside" or "rail" for it`);
    // A bridge over a band of points is the page's width and a third short of
    // its height: three callouts' bands leave no room beside the tall totals
    // for the third. Two fit; beside a column the bridge keeps its height and
    // takes three.
    if (ex.type === "chart.waterfall" && page.commentary === "below" && (ex.annotations || []).length > WATERFALL_BELOW_CALLOUTS)
      throw new Error(`${id}: a bridge over commentary "below" carries ${WATERFALL_BELOW_CALLOUTS} callouts at most (this one has ${ex.annotations.length}) - the points take a third of its height; choose "rail" or "beside" for three, or move a note into the points`);
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
}

/**
 * The evidence the type holds to: the shape a review would send to another
 * page, a marked subject, periods, members and the floor on the values, the
 * chart's form, and the table or rows the type is built from.
 */
function checkTypeEvidence({ page, id, type, slide, exhibits, primary, players, rules, waived, waivedAdvisories }) {
  const held = { waived, rules, advisories: waivedAdvisories };
  const reshape = unwaived((skip) => reshapeDefect(page, id, exhibits, players, skip), held);
  if (reshape) throw new Error(reshape);

  // Evidence checks the type makes.
  // A title that names one series or bar marks it (compose-charts.mjs focusFromTitle).
  if (type.marked && !markedChart(primary) && !markedChart(focusFromTitle(primary, page.title)))
    throw new Error(`${id}: a ${page.type} chart marks its finding on the plot - an annotation, a highlight, a reference line or the rate of change. A bare chart is a picture of the data, not evidence for the title.`);
  // Small multiples carry their periods in each item's values (formExhibit).
  if (type.periods && !["slope", "sparklines"].includes(page.form)) {
    const cats = (primary.categories || []).map(String);
    if (cats.length < type.periods || cats.filter(isPeriodLabel).length < Math.ceil(cats.length * 0.75))
      throw new Error(`${id}: a trend runs over four or more periods (years, quarters, months); this one has ${cats.length} categories. Two or three periods are a comparison: use numbers or ranking.`);
  }
  if (type.minCategories && (primary.categories || primary.rows || []).length < type.minCategories)
    throw new Error(`${id}: a ranking shows the whole set - ${type.minCategories} members or more. Two or three numbers are a metric pair: use a numbers page.`);
  // The evidence floor (EVIDENCE_FLOOR), counted on what the page plots.
  const values = plottedValues(exhibits, { printed: true });
  const isChart = chartPage(page.type, exhibits);
  if (isChart && !(page.type === "composition" && WHOLE_PARTS.includes(page.form))) {
    const floor = page.type === "bridge" ? EVIDENCE_FLOOR.bridge : EVIDENCE_FLOOR.chart;
    if (values < floor) throw new Error(`${id}: this ${page.type} page plots ${values} value${values === 1 ? "" : "s"}; a chart page plots ${floor} or more (strong decks' chart pages plot about 22, the middle half 10 to 48). ` +
      `Deepen the evidence, not the styling: ${DEEPEN[page.type]}. If the data stops here, it is a numbers page - or a research task`);
  }
  const reviewed = unwaived((skip) => reviewedDefect(page, id, [...exhibits, ...(page.blocks || []).map((block) => block?.exhibit).filter(Boolean)], skip), held);
  if (reviewed) throw new Error(reviewed);
  const form = unwaived((skip) => chartFormDefect(page, id, exhibitsOf(slide), players, skip), held);
  if (form) {
    registered(CHART_FORM_CODES, form.code);
    throw new Error(form.message);
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
        || (primary.rows || []).some((row) => rowCells(row).some((cell) => cell?.type === page.form));
      if (!coded) throw new Error(`${id}: a ${page.form} scorecard codes its cells - give at least one column \`type: "${page.form}"\``);
    }
    if (page.form === "measure-table") slide.shape = "measure-table";
  }
  if (type.rows) {
    if (!Array.isArray(page.rows) || !page.rows.some((row) => Array.isArray(row?.cells))) throw new Error(`${id}: a findings matrix carries \`rows\`, each with a label and \`cells\``);
    slide.shape = "findings-matrix";
  }

  return { values, isChart };
}

/** The commentary the page carries, against what its `commentary` choice says it carries. */
function checkCommentary({ page, id, slide, exhibits, primary, rules, waived, waivedAdvisories }) {
  // Commentary: where the explanation lives decides the layout.
  const points = (page.points || []).length;
  const textless = ["on-exhibit", "in-exhibit", "captions", "none"].includes(page.commentary);
  if (page.commentary === "so-what-bar" && points)
    throw new Error(`${id}: commentary "so-what-bar" closes the exhibit on one implication in \`bar\`; the points are a second commentary - fold them into the bar, or choose "beside" or "below"`);
  if (textless && points && !["summary"].includes(page.type))
    throw new Error(`${id}: commentary "${page.commentary}" puts the explanation ${COMMENTARY[page.commentary].replace(/^the /, "")}; move the points there or choose "beside" or "below"`);
  // The finding is marked in each point, not only the first: a page-level
  // phrase is accented where it occurs, so a single phrase lights one point and
  // leaves the rest grey. `highlight` takes a list - a phrase from each point -
  // or a point carries its own.
  const phrases = (Array.isArray(page.highlight) ? page.highlight : page.highlight ? [page.highlight] : []).map((p) => String(p).toLowerCase());
  const pointTexts = (page.points || []).map((point) => (typeof point === "string" ? point : `${point?.lead ?? ""} ${point?.text ?? ""}`).toLowerCase());
  // A phrase that lands nowhere marks nothing.
  // Found as whole words, by the rule the accent is set by (phraseAt), so "22"
  // does not pass on "FY22" and draw half a year in the accent.
  // Read against every place the page draws an accent (accentTexts) - a rail,
  // a matrix cell or a comparison column as well as its points - and not
  // against a chart callout or the title, which draw no accent.
  const written = accentTexts(page);
  const stray = phrases.filter((p) => p && !written.some((text) => hasPhrase(text, p, { ignoreCase: true })));
  if (stray.length) {
    const partWord = written.find((text) => text.toLowerCase().includes(stray[0]));
    const at = partWord ? partWord.toLowerCase().indexOf(stray[0]) : -1;
    // A cell naming a declared player is drawn as its logo (markPlayerCells),
    // and a mark takes no accent, so the refusal names the logo rather than
    // reporting the name as only in the title.
    const logo = !partWord && exhibitsOf(page).filter(isTable).flatMap((ex) => ex.rows.flatMap(rowCells))
      .find((cell) => cell?.type === "logo" && hasPhrase(cellText(cell), stray[0], { ignoreCase: true }));
    const elsewhere = !partWord && !logo && unaccentedPlaces(page).find(([, text]) => hasPhrase(text, stray[0], { ignoreCase: true }))?.[0];
    const places = written.length ? "its points, paragraphs, rail, bar, takeaway, captions and table, matrix or comparison cells" : null;
    throw new Error(partWord
      ? `${id}: \`highlight\` "${stray[0]}" occurs only inside a longer word or number ("${partWord.slice(Math.max(0, at - 12), at + stray[0].length + 12).trim()}"), so it would light half a word; highlight the whole word or figure as the page writes it`
      : logo ? `${id}: \`highlight\` "${stray[0]}" is a table cell drawn as ${cellText(logo).replace(/ logo$/i, "")}'s logo, and a logo takes no accent; to set the name in the accent write the cell as \`{ text, highlight: true }\`, which keeps it as text, or drop the phrase`
      : elsewhere ? `${id}: \`highlight\` "${stray[0]}" is only in the ${elsewhere}, which is drawn without an accent; highlight a phrase from ${places ?? "the page's commentary"}, or drop it`
        : places ? `${id}: \`highlight\` "${stray[0]}" appears nowhere the page draws an accent (${places}); use a phrase exactly as the page writes it`
          : `${id}: \`highlight\` "${stray[0]}" has nowhere to land - this page draws no commentary text to set it in; drop \`highlight\`, or mark the chart with \`highlights\` instead`);
  }
  // A point the author left unmarked is marked on its own figure; one with no
  // figure is named in the advisories, since the phrase that carries a
  // qualitative point is the author's to choose.
  const unmarkedPoints = [];
  if (points >= 2 && ["beside", "beside-left", "below"].includes(page.commentary)) {
    const derived = [];
    (page.points || []).forEach((point, at) => {
      if ((point && typeof point === "object" && point.highlight) || phrases.some((p) => p && hasPhrase(pointTexts[at], p))) return;
      const text = typeof point === "string" ? point : `${point?.lead ?? ""} ${point?.text ?? ""}`;
      const figure = pointFigure(text);
      if (figure) derived.push(figure); else unmarkedPoints.push(at + 1);
    });
    if (derived.length) slide.highlight = [...(Array.isArray(page.highlight) ? page.highlight : page.highlight ? [page.highlight] : []), ...derived];
  }
  // A paragraph carries its colour as a point does: one that none of the
  // page's phrases lands in is marked on its own figure. Its lead is already
  // bold, so the accent goes to the number the paragraph turns on.
  const prose = (page.paragraphs || []).filter((p) => !(p && typeof p === "object" && p.highlight)).map((p) => proseParts(p).text);
  if ((page.paragraphs || []).length >= 2) {
    const derived = prose.filter((text) => !phrases.some((p) => p && hasPhrase(text.toLowerCase(), p))).map(pointFigure).filter(Boolean);
    const marked = slide.highlight ?? page.highlight;
    if (derived.length) slide.highlight = [...(Array.isArray(marked) ? marked : marked ? [marked] : []), ...derived];
  }
  (page.paragraphs || []).map(proseParts).forEach((p, at) => {
    const lost = p.highlight.find((phrase) => ![p.lead, p.text].some((text) => hasPhrase(text, phrase, { ignoreCase: true })));
    if (lost) throw new Error(`${id}: paragraph ${at + 1}'s \`highlight\` "${lost}" is not in its lead or its text; use a phrase exactly as the paragraph writes it`);
  });
  if (["beside", "beside-left", "below"].includes(page.commentary) && !points && !page.paragraphs)
    throw new Error(`${id}: commentary "${page.commentary}" needs the points it places`);
  if (page.commentary === "on-exhibit" && primary?.type?.startsWith("chart.") && !(primary.annotations || []).length && !numberMarked(primary))
    throw new Error(`${id}: commentary "on-exhibit" writes the explanation on the chart - mark it with a number: the change or growth rate (\`cagr\`, \`changeAnnotations\`), the gap bracketed, a benchmark as a labelled \`referenceLines\`, the stack's \`stackTotals\`; or give it \`annotations\` ({ category, text })`);
  if (page.commentary === "captions") {
    const bare = exhibits.filter((e) => !(typeof e.caption === "string" && e.caption.trim()));
    if (page.type === "picture" ? !(page.pictures || []).every((p) => p.label || p.line) : bare.length)
      throw new Error(`${id}: commentary "captions" puts one finding under each panel - every exhibit needs its \`caption\``);
  }
  if (page.commentary === "captions" && page.type !== "picture") {
    for (const ex of exhibits) {
      if (words(ex.caption).length < COPY_LIMITS.captionWordsMin) throw new Error(`${id}: a caption is the panel's finding in a sentence - eight words or more, not a label ("${ex.caption}")`);
      if (overlap(`${page.title} ${ex.heading ?? ""}`, ex.caption) > 0.7) throw new Error(`${id}: the caption "${ex.caption}" repeats the title or the panel heading; say what this panel shows that the others do not`);
    }
  }
  if (page.commentary === "on-exhibit" && primary?.type?.startsWith("chart.")) {
    // Each callout is measured the way the chart will set it: a box that holds
    // two lines, so a paragraph belongs in two callouts or beside the chart.
    const long = (primary.annotations || []).filter((a) => !calloutFits(a.text));
    if (long.length) throw new Error(`${id}: ${long.length} callout${long.length === 1 ? " is" : "s are"} too long for the chart's callout box ("${long[0].text}"); a callout holds about ${countInWords(calloutCapacity())} words - split it, or choose "beside" for the argument`);
    const said = (primary.annotations || []).reduce((n, a) => n + words(a.text).length, 0);
    if (said < COPY_LIMITS.calloutWordsMin && !numberMarked(primary)) throw new Error(`${id}: moving the explanation onto the chart means writing it there - the callouts carry ${said} words; mark the finding with a number (the change, the gap, the total), or give the callouts the mechanism (10 or more words between them), or choose "beside"`);
  }
  if (page.commentary === "rail") {
    if ((typeof page.rail !== "string" || words(page.rail).length < COPY_LIMITS.railWordsMin)) throw new Error(`${id}: commentary "rail" sets one developed claim in the side panel - write it as \`rail\`, ten words or more`);
    if (typeof page.rail === "string" && !railFits(page.rail)) throw new Error(`${id}: the rail runs past its eight lines (about ${railCapacity()} words); it is the page's one claim - cut it, or choose "beside" for an argument`);
    slide.panel = { text: String(page.rail ?? "").trim() || page.title };
  }
  if (page.commentary === "so-what-bar") {
    // The bar is the implication the exhibit leads to, so it is written as one:
    // a sentence long enough to say what follows, short enough for two lines.
    if ((typeof page.bar !== "string" || words(page.bar).length < COPY_LIMITS.barWordsMin))
      throw new Error(`${id}: commentary "so-what-bar" closes the page on the implication - write it as \`bar\`, a sentence of eight words or more`);
    if (typeof page.bar === "string" && !barFits(page.bar))
      throw new Error(`${id}: the so-what bar runs past its two lines; it is one implication - cut it, or choose "beside" for an argument`);
    if (typeof page.bar === "string" && overlap(page.title, page.bar) > 0.7)
      throw new Error(`${id}: the bar "${page.bar}" repeats the title; say what follows from the evidence, not what it shows`);
    if (typeof page.bar === "string" && page.bar.trim()) slide.soWhat = { text: page.bar.trim(), style: "bar" };
  }
  const closing = typeof page.takeaway === "string" ? takeawayLines(page.takeaway) : 0;
  if (closing > TEXT_LIMITS.takeawayLines) {
    const message = `${id}: TAKEAWAY_LONG - the takeaway runs past ${TEXT_LIMITS.takeawayLines} lines; it says the reading once - cut it to one implication, put the qualification in the note, or set a second argument as commentary`;
    const rule = predatedRule(rules, "TAKEAWAY_LONG", closing, waived);
    if (!rule) throw new Error(message);
    waivedAdvisories.push(waivedAdvice("TAKEAWAY_LONG", rule, message, rules));
  }
  // What the commentary says that the exhibit cannot. A rail or a bar is one
  // sentence and is its own answer; points, captions and callouts say it in
  // `adds`, and `adds: null` there says the commentary adds nothing.
  if (ADDS_WRITTEN.includes(page.commentary) && !(typeof page.adds === "string" && words(page.adds).length >= 4)) {
    const what = page.commentary === "captions" ? "captions" : page.commentary === "on-exhibit" ? "callouts" : "points";
    throw new Error(`${id}: say in \`adds\` what the ${what} say that the exhibit cannot - one sentence${page.adds === null ? "; `adds: null` says they add nothing, and then the page's commentary is \"none\" (or \"in-exhibit\") and the exhibit takes the room" : ""}`);
  }
  return { points, unmarkedPoints };
}

/** The layout the commentary and the form ask for, and each type's own arrangement of the slide. */
function layOutPage({ page, id, type, slide, target, exhibits, setType, primary, points }) {
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
    // one the memo sets in equal columns that need some 500 words to reach
    // the foot, and the page stops halfway down.
    if (page.form === "memo" && (page.paragraphs || []).length && !page.panel)
      throw new Error(`${id}: a memo sets its prose at a readable measure with a \`panel\` beside it - { text, kicker } carrying the conclusion or the figures the reader keeps - which takes the width the prose leaves`);
    // That width is over half the page: prose that reaches the foot does so
    // at a reading measure (compose-points.mjs proseBeside), whatever the panel
    // holds. A sentence of a statement set in it is a column of tint that is
    // mostly empty, so under PANEL_WORDS_MIN the panel is refused here, where
    // its words are cheap to change - not widened, nor the prose thinned to
    // fill it. A sidebar beside an exhibit or points keeps a third of the row.
    const proseBeside = page.form === "memo" || (!(page.exhibit || (page.exhibits || []).length) && !points);
    const panelWords = textWords(page.panel?.text ?? "");
    if (page.panel && proseBeside && (page.paragraphs || []).length && panelWords < PANEL_WORDS_MIN)
      throw new Error(`${id}: the panel takes the width the prose leaves - over half the page - and ${panelWords} words set a column of tint that is mostly empty. Give it what the reader keeps beside the reasoning - the figures, the conditions, the decision and its cost, as the argument states them - in ${PANEL_WORDS_MIN} words or more; or, with no more to hold, set the page as a sidebar beside its evidence (an exhibit or points), where the panel keeps a third of the row`);
  } else if (page.type === "statement") {
    if (page.form === "statement") { slide.kind = "statement"; if (!page.text) throw new Error(`${id}: a statement page carries its \`text\``); }
    else { if (!primary) throw new Error(`${id}: a quotes page carries a quote-cluster exhibit`); setType(primary, "quote-cluster"); }
  } else if (page.type === "summary") {
    if (page.form === "executive-summary") { slide.role = "executive-summary"; if (!points) throw new Error(`${id}: an executive summary carries its developed \`points\``); }
    else { slide.kind = "takeaways"; if (!(page.items || []).length) throw new Error(`${id}: a takeaways page carries its \`items\``); }
  } else if (slide.shape === "model-page") {
    // The chart and its table stack in the exhibit's column, the points beside.
    slide.layout = "stack";
  } else if (!type.rows && slide.shape !== "measure-table") {
    slide.layout = layoutFor[page.commentary] ?? "exhibit-full";
  } else if (layoutFor[page.commentary]) {
    slide.layout = layoutFor[page.commentary];
  }

  // A statement or takeaways page has no title band to hang a standfirst in.
  if (slide.kind && page.subtitle !== undefined) throw new Error(`${id}: a ${page.form} page has no title band, so it takes no \`subtitle\`; put the scope in its text`);
}

/** The page's advisories and its `pageType` record: the choices, and the structure, skeleton and drawn shape the variety contract counts. */
function withPageType({ page, slide, exhibits, primary, values, isChart, unmarkedPoints, waivedAdvisories, settles, evidence, titleAdvisories }) {
  // Advisories the compiler can see and the author should: they do not block.
  const advisories = [...titleAdvisories, ...waivedAdvisories];
  if (unmarkedPoints.length) advisories.push(`POINT_UNMARKED: point${unmarkedPoints.length === 1 ? "" : "s"} ${unmarkedPoints.join(", ")} carr${unmarkedPoints.length === 1 ? "ies" : "y"} no figure to mark and no \`highlight\`; name the phrase the reader should see first, on the point or in the page's \`highlight\` list`);
  const tiles = sharesInTiles(page, exhibits);
  if (tiles) advisories.push(tiles);
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
    ...(page.sourceSlide !== undefined ? { sourceSlide: page.sourceSlide } : {}), ...(Array.isArray(page.only) && page.only.length ? { only: page.only.map(String) } : {}),
    ...(advisories.length ? { advisories } : {}),
    // The claim is the title: the build holds the two together.
    content: { claim: String(page.title ?? page.text ?? "").trim(), ...(settles ? { settles } : {}),
      adds: page.adds ?? (ADDS_SAID[page.commentary] && typeof page[ADDS_SAID[page.commentary]] === "string" ? page[ADDS_SAID[page.commentary]].trim() : null), ...(evidence.length ? { evidence } : {}) } };
  slide.pageType.structure = structureOf(slide);
  // What the variety contract counts: the page as drawn, not as declared.
  slide.pageType.skeleton = skeletonOf(slide);
  slide.pageType.drawn = drawnOf(slide);
  return slide;
}

// The standfirst: one line under the title, in body type, above the rule. A
// fifth of strong analytical pages carry one, and it says what the title
// leaves out - the measure and unit, the population, the period, the scope -
// so the title can stay a claim. It is not a second title, so it neither
// restates the title nor runs past a line.
export const SUBTITLE_WORDS = 16;
const SUBTITLE_WIDTH = 1160;
export function subtitleProblem(title, subtitle, exhibits = []) {
  if (typeof subtitle !== "string" || !subtitle.trim() || subtitle.includes("\n")) return "is one line of text under the title";
  const n = words(subtitle).length;
  if (n > SUBTITLE_WORDS) return `runs to ${n} words; keep it to ${SUBTITLE_WORDS} or fewer - the scope, the unit, the population or the period, not a second finding`;
  if (measureText(subtitle.trim(), SUBTITLE_WIDTH, { fontSize: 12 }).lines.length > 1) return "runs past one line; cut it to the scope, the unit, the population or the period";
  if (overlap(title, subtitle) > 0.7) return "repeats the title; say what the title leaves out - the measure, the population, the period";
  // The chart already names its measure and unit in its heading, so a
  // subtitle built from the heading says it twice, one line apart - "Revenue
  // by region, FY26 (AED bn)" over a chart headed "Revenue by region, FY26 ·
  // AED bn" - so it is compared with the heading as well as the title.
  const bare = (text) => String(text ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
  for (const ex of exhibits) {
    const heading = [ex?.heading, ex?.unit].filter((part) => typeof part === "string" && part.trim()).join(" ");
    if (heading && typeof ex.heading === "string" && overlap(bare(heading), bare(subtitle)) > 0.7)
      return `repeats the exhibit's heading ("${ex.heading}"${ex.unit ? `, ${ex.unit}` : ""}); the heading names the measure and unit, so the subtitle says what it leaves out - the population, the period basis or the scope - or is dropped`;
  }
  return null;
}

/**
 * Table cells that name a declared player, drawn as its mark. A comparison
 * table whose verdict column read "OpenAI" / "Anthropic" set the names as
 * green status pills, which reads as good and bad rather than as who; the
 * mark says who at a glance and leaves colour to mean a state. Only exact
 * names (or a player's `short`/`aliases`) outside the row-label column are
 * marked, so a sentence that mentions a player stays prose. The mark is the
 * one the player declares (players.mjs plannedMark): a logo, filled from
 * assets/logos/ or fetched by the build (fetch-logos.mjs), as a players
 * page's are; a place's outline, drawn from the geography data; a thing's
 * photograph, fetched with the deck's photographs. Until a file is there the
 * cell keeps the name.
 */
export function markPlayerCells(slide, players) {
  const names = playerNames(players);
  const entries = new Map(playerEntries(players).map((entry) => [entry.name, entry]));
  const markOf = (name) => plannedMark(entries.get(name));
  // The player a short verdict opens with: "Firm A leads", "Firm B
  // confirmed" - four words at most, so a sentence stays prose.
  const leading = (text) => {
    const said = String(text).trim();
    if (words(said).length > 4) return null;
    for (const [alias, name] of names) if (new RegExp(`^${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(said)) return name;
    return null;
  };
  const mark = (value) => {
    // A cell that carries its own accent stays text: a mark cannot be accented.
    const text = typeof value === "string" ? value : value && typeof value === "object" && !value.type && typeof value.text === "string" && value.highlight === undefined && value.accent === undefined ? value.text : null;
    const name = text === null ? null : names.get(text.trim().toLowerCase());
    if (name) return { type: "logo", player: name, media: markOf(name) };
    // A status pill saying who leads ("Firm A" in green, "Firm B" in green)
    // spends the status colours on a name; the verdict is the player's mark
    // with its words beside it, and colour keeps meaning a state.
    const verdict = value && typeof value === "object" && value.type === "rag" && typeof value.text === "string" ? leading(value.text) : text !== null ? leading(text) : null;
    if (verdict && (value?.type === "rag" || text !== null)) return { type: "logo", player: verdict, media: markOf(verdict), text: String(value?.text ?? text).trim() };
    return value;
  };
  // A column headed by a player ("Firm A", "Firm B result") carries the
  // player's mark beside its label.
  const headed = (label) => { const said = String(label ?? "").trim(); for (const [alias, name] of names) if (new RegExp(`(^|\\W)${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`, "i").test(said)) return name; return null; };
  // Every header from `first` on that names a player; the columns before it
  // head the row labels.
  const markHeaders = (columns, first) => columns.map((column, c) => {
    const label = typeof column === "string" ? column : column?.label;
    const player = c >= first && !(column && typeof column === "object" && (column.logo || column.type === "logo")) ? headed(label) : null;
    if (!player) return column;
    return { ...(typeof column === "string" ? { label: column } : column), logo: markOf(player) };
  });
  if (!names.size) return;
  for (const ex of exhibitsOf(slide).filter(isTable)) {
    ex.rows = ex.rows.map((row) => Array.isArray(row) ? row.map((cell, c) => c === 0 ? cell : mark(cell))
      : row && Array.isArray(row.cells) ? { ...row, cells: row.cells.map((cell, c) => c === 0 && row.label === undefined ? cell : mark(cell)) } : row);
    if (Array.isArray(ex.columns)) ex.columns = markHeaders(ex.columns, 1);
  }
  // A findings matrix heads its columns at the page's level ("Anthropic",
  // "OpenAI route"): a column headed by a player carries the mark as a
  // table's does. Its first header heads the row labels when it heads one
  // more column than the rows carry (the composer reads it the same way).
  if (Array.isArray(slide.columns) && Array.isArray(slide.rows) && slide.rows.some((row) => Array.isArray(row?.cells))) {
    const count = Math.max(...slide.rows.map((row) => (Array.isArray(row?.cells) ? row.cells.length : 0)));
    slide.columns = markHeaders(slide.columns, slide.columns.length > count ? 1 : 0);
  }
}

/**
 * The normalized plan-gate architecture a compiled page type stands for. The
 * plan record reads the declared placement, so a rail is declared here as
 * commentary beside its evidence (PLAN_STYLE_ENTROPY counts it so);
 * PAGE_SHAPE_FLAT, read on the composed page, counts a rail as the close of an
 * evidence-only page.
 */
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

/** How many words of ordinary prose a chart callout holds, by the renderer's own measure (chart-annotations.mjs). */
export { calloutCapacity };

/** How many words of ordinary prose the rail's panel holds, by the renderer's own measure. */
export function railCapacity() {
  const words = "the operator added capacity on the busiest routes before demand returned in full".split(" ");
  let n = 1;
  while (n < 120 && railFits(Array.from({ length: n + 1 }, (_, i) => words[i % words.length]).join(" "))) n += 1;
  return n;
}

/**
 * How many named columns a chart panel holds in a row of two, three and four,
 * by the renderer's own measure: a column chart of eight-letter names drawn at
 * the panel's width until a name no longer fits its column. Period labels
 * (FY17, 2019, Q1 2025) are not counted - the chart labels every second or
 * third when they crowd - but a name is never dropped. The widths are the
 * composer's (compose-arrangements.mjs peerExhibitsRow).
 */
export function panelColumnCapacity() {
  const names = ["Northern", "Southern", "Atlantic", "Pacifica", "Midlands", "Highland", "Lowlands", "Eastward", "Westward", "Frontier", "Lakeside", "Seaboard", "Downtown", "Hillside"];
  const chart = REGISTRY.get("chart.column");
  return Object.fromEntries([2, 3, 4].map((n) => {
    const width = (1160 - (n - 1) * 16) / n;
    let k = 2;
    while (k < names.length) {
      const categories = names.slice(0, k + 1);
      try { chart.render({ id: "capacity", frame: { x: 0, y: 0, width, height: 360 }, props: { categories, series: [{ name: "Value", values: categories.map((_, i) => 40 + i) }], highlights: [], annotations: [], referenceLines: [] } }); }
      catch { break; }
      k += 1;
    }
    return [n, k];
  }));
}

/**
 * How many members a distribution names, by the renderer's own measure: a
 * bar chart of `n` members in a 440px frame beside a rail, grown until its
 * rows' names step down from 10pt to 8pt, and then until they thin to every
 * second one. The catalogue prints both counts, so an author knows where the
 * names shrink and where every second one is dropped.
 */
export function distributionLabelCapacity() {
  const chart = REGISTRY.get("chart.bar");
  const labelled = (n) => {
    const categories = Array.from({ length: n }, (_, i) => `Member ${i + 1}`);
    const nodes = chart.render({ id: "capacity", frame: { x: 0, y: 0, width: 760, height: 440 }, props: { categories, series: [{ name: "Value", values: categories.map((_, i) => 200 - i) }], highlights: [], annotations: [], referenceLines: [] } }).nodes;
    const labels = nodes.filter((node) => node.role === "category-label");
    return { all: labels.length === n, small: labels.some((node) => node.style?.fontSize?.value < 10) };
  };
  let full = 15, small = null;
  for (let n = 15; n <= 60; n += 1) {
    const { all, small: reduced } = labelled(n);
    if (!all) break;
    if (reduced) small = n; else full = n;
  }
  return { full, small: small ?? full };
}

/** The catalogue as the author reads it. */
export function describeTypes() {
  const lines = ["# Page types", "", "Every analytical page is one of these. `type`, `form`, `commentary` and `why` are required and have no default.", "",
    "`commentary` - where the explanation lives:", ...Object.entries(COMMENTARY).map(([k, v]) => `- \`${k}\`: ${v}`), "",
    `\`takeaway\` - optional: the closing sentence, ${TEXT_LIMITS.takeawayLines} lines at most (TAKEAWAY_LONG, refused at compile); absent, the page closes on its exhibit, as most do (strong decks close about one page in ten on a line or a band).`, "",
    "`adds` - what the commentary says that the exhibit cannot, one sentence: required with commentary `beside`, `beside-left`, `below`, `captions` or `on-exhibit` (`null` there is refused - it says the commentary adds nothing); a `rail` or `bar` is its own answer; optional elsewhere.", "",
    "`bar` - with commentary `so-what-bar`, the implication set in a filled bar across the foot of the exhibit: a sentence of eight words or more that fits two lines. The bar is the page's close, so `takeaway` is `false`, and it counts toward the closing share.", "",
    "Beyond one exhibit and a column: `parallel` form `labelled-rows` sets two to five `blocks` down the page, each a filled label with its bullets and an optional `metric` or small `exhibit` at the right; `panels` form `sequence` joins two or three headed exhibits with arrows (cause to effect, before to after).", "",
    "`why` - one sentence on why this type fits the claim.", "`settles` - { kind, what }, or `evidence` naming insight ids when there is an insight log (then `settles` is derived from them). A chart or table page is settled by a count, share, rank, rate, sequence, comparison or structure, never `qualitative`.", "",
    "Numbers by reference - where the insight log records measures, a page names the measure and the runtime writes the number: an exhibit's `series: [{ measure: \"<insight id>/<measure>\", name }]` takes its categories, values, unit and basis from the measures (`select: { from, to }`, `{ periods }` or `{ members, order }` narrows the axis; a series naming a recorded measure and then a scenario's path is one line with the assumed run bracketed); a metric, a `kpi`, a row block's `metric` or a fact-grid item is `{ measure, format, label }` (`format` \"+0.0%\", \"CHF 0.0bn | /1000\"); and `{{<insight id>/<measure>@<period or member> | 0.0}}` in any text prints that number. A series that is context beside the claim's own says so itself (`{ measure, role: \"context\", relevance }`); a table whose every measurement is a token, or a grid whose every figure is bound, needs no `basis`. Typed numbers stay allowed: an exhibit's with its `basis`, checked against the measure, and a number typed into text is traced to the measures the page rests on (NUMBER_UNTRACED, advised).", "",
    "`source` - the citation as text, or a list of keys into the pages file's `sources` registry (`{ key: { name, short, url, status } }` beside `deck` and `pages`), set as \"Source: name (status); name\". A citation written from keys is fitted by the runtime to the footer's lines and to the words the footer has room for under NOTE_HEAVY, which counts the footer as drawn - `short` names, then the statuses dropped, then the leading names and \"+k more in the notes\", then the count alone, the full list kept in the speaker notes; a citation typed as text is the author's and is held to the footer's lines.", "",
    `\`subtitle\` - optional, on any analytical page: one line under the title (${SUBTITLE_WORDS} words at most) naming what the title leaves out - the measure and unit, the population, the period or the scope. It is set small above the title rule and counts with the title, not the body; it must not restate the title.`, "",
    "`node runtime/author-deck.mjs --example <type>` prints a worked page of any type; `--scaffold <type> [--evidence <insight-id>]` prints a page of that type that compiles, with the insight's measures named in its exhibit, to fill in.", "",
    "`highlight` - on a page with commentary points, a list with the phrase from each point the reader should see first (or `highlight` on the point). A point left unmarked is marked on its own figure (its first percentage, amount or count); a point with no figure is named in the advisories (POINT_UNMARKED). It is set in the accent wherever the page writes it - points, paragraphs, a rail or side panel, the bar or takeaway, captions, and table, matrix and comparison cells; a phrase that is only in the title, a heading or a callout is refused.", "",
    "`better` - on a metric (a strip's `metrics`, a hero's `kpi`, a row block's `metric`), a table column, a table row or one trend cell: the direction that is good news for the measure, \"up\" (the default) or \"down\" (a cost, churn, a wait). A delta and a trend arrow are coloured by it - a rising cost is red - not by their sign.", "",
    `Refused at compile, because a review found each on a finished deck: ${printRules(REVIEW_RULES)}. Advised: ${printRules(ADVISED_RULES)}. Deck-level: more than ${REVIEWED.tableRunMax} of any ${REVIEWED.tableWindow} consecutive analytical pages drawn as one table construction (VARIETY_TABLES); declared \`players\` without each one's own mark - its logo, its place's outline or its photograph, as it declares - on the cover or the first ${REVIEWED.earlyPages} analytical pages (PLAYERS_UNMARKED); \`profiles\` cards with no logo or picture (PROFILE_UNPICTURED). An executive summary is held to the text page's upper quartile (${SUMMARY_WORDS} body words), not its fence; a point's lead and text are one block for TEXT_BLOCK_TOO_LONG, and so is a card's or a cell's text.`, "",
    `Capacities: a chart callout holds about ${calloutCapacity()} words (measured against its box) and a chart ${CALLOUTS_MAX} callouts; a rail about ${railCapacity()} words (eight lines); a stat-list value 9 characters and a fact-grid value 10. A fact-grid takes \`columns\` (1 to 4 tiles across, one only when every tile carries its \`text\`; two rows or more fill the frame, one row grows by a third, a single column never stretches) and, on any item, \`gauge\` (0 to 1, a bar on the tile's foot). Commentary \`below\` runs up to three points across, four two by two, more three to a row. \`author-deck --check\` prints each page's word floor, ceiling and footer share as the page composes.`, "",
    `Text limits the build holds every page to: a title of ${TEXT_LIMITS.titleWords} words at most (TITLE_WORDS, refused at compile) and ${TEXT_LIMITS.titleLines} lines (TITLE_LINES) - the finding and its comparator, ${TEXT_LIMITS.titleTarget} words the norm, with the period, population and scope moved to the \`subtitle\`; a title that leads with a gap - what the evidence lacks, leaves unproven or cannot settle - on more than 15% of the analytical pages is refused (TITLE_GAP_SHARE), and a bare count ("The fleet is 116 aircraft") is advised (TITLE_COUNT_ONLY), each title read by a model (judge.mjs); a \`subtitle\` one line of ${SUBTITLE_WORDS} words; a chart or panel \`heading\` one line at its frame's width with its unit inline (HEADING_WRAPS - a short unit moves under the heading on its own, a unit written as a phrase does not); a \`takeaway\` ${TEXT_LIMITS.takeawayLines} lines (TAKEAWAY_LONG); a \`bar\` ${TEXT_LIMITS.barLines} lines; prose 35 to 90 characters a line (CPL). A chart \`heading\` or \`unit\` carries no results: its numbers are a period ("FY26", "2 August 2026"), a sample ("n = 240"), a set size ("top 40"), an index base ("2019 = 100") or a rank scale ("rank, 1 = best"); a figure that notation does not settle is read by a model (judge.mjs).`, "",
    ...(() => { const names = distributionLabelCapacity(); return [
    `A \`distribution\` (or any bar chart of many rows) names every member while its rows hold a line: at the chart's 10pt up to about ${names.full} members at full height, at 8pt up to about ${names.small}; past that it names every second member (every nth when the rows are thinner still) and reads the field's shape from the bars. The subject, any highlighted member and any member a callout names are always named, and the rows beside them go unnamed so their labels do not touch. To name them all, give the chart the page's height (commentary "rail" or "none"), or cut the field to the members that matter.`, ""]; })(),
    ...(() => { const columns = panelColumnCapacity(); return [
    `A chart callout takes free space inside the plot first - above a short mark, beside a line, in an empty corner, its leader to the mark - and a band above the plot only when the plot has none, so the plot keeps its height; panels sharing one scale keep their shared band. Chart limits the runtime cannot lift: a bridge over commentary \`below\` carries ${WATERFALL_BELOW_CALLOUTS} callouts (beside a column, ${CALLOUTS_MAX}); a \`distribution\` one callout, which sits beside its bar; \`aligned-bars\` none. Panels in a row: a column panel holds about ${columns[2]} named columns (eight-letter names) in a row of two, ${columns[3]} in a row of three and ${columns[4]} in a row of four - period labels (FY17, 2019, Q1) thin to every second or third, so ten or more periods fit any row, but a column chart never drops a name: shorten them or use bars. On bar panels that read across (the same members) in different units a callout sits in its bar's row - past the bar's end, past the axis for a bar below zero, or set inside a long bar - so bars reading across panels keep their rows level and no band stands empty over the neighbour; where the row has no room it takes a rail, which a panel in a row of three or four cannot spare, so there annotate a shorter bar or say it in the caption. Column and line panels on one value scale (the same unit) share the tallest panel's callout band so their plots stay one height; panels in different units keep their own bands, so annotate one and leave its neighbours plain freely. Two-series lines in a row of three or four name their series in a legend rather than at the line ends.`, ""]; })(),
    // A placement is also a word floor: points beside or below make the page
    // one read with its commentary, and moving a rail below raises a chart
    // page's floor from 42 to 112 words, so the catalogue prints both floors.
    `Word floors follow the reading task, which the commentary placement decides - points \`beside\` or \`below\` (or paragraphs) make a page read with its commentary; a rail, captions, callouts, a so-what bar or none leave it led by its exhibit: ${
      ["chart", "table", "exhibit", "diagram"].map((family) => `${family} pages ${wordBudgetOf(`${family}-led`).floor} words led, ${wordBudgetOf(`${family}-with-commentary`).floor} with points`).join("; ")
    }; a text page ${wordBudgetOf("text-page").floor}. \`author-deck --check\` prints each page's floor and the one the other placement would set.`, "",
    `Icons (a point's, a card's, a row label's \`icon\`): ${ICON_NAMES.join(", ")}. \`author-deck --icons\` lists the other words each answers to (aircraft, airport and flight are \`plane\`).`, "",
    `Evidence: a chart page (trend, ranking, composition, relationship, bridge, panels of charts) plots ${EVIDENCE_FLOOR.chart} or more values - a bridge ${EVIDENCE_FLOOR.bridge}, one whole's parts (pie, donut, treemap, waffle) are not floored - and strong decks' chart pages plot about 22. Deepen with the peer set, a prior period or a benchmark series, or a longer window: forms \`indexed\` (trend), \`distribution\` and \`aligned-bars\` (ranking) are built for many values.`, ""];
  // Which form carries which claim (claim-fit.mjs): the one definition the plan, a scaffold, the fit search and the standings read.
  lines.push(...describeFit());
  for (const [name, t] of Object.entries(PAGE_TYPES)) {
    const n = Array.isArray(t.exhibits) ? `${t.exhibits[0]}-${t.exhibits[1]}` : t.exhibits;
    const data = Object.entries(t.forms).map(([form, target]) => [form, dataKeys(target, { type: name, form })]).filter(([, keys]) => keys.length);
    lines.push(`## ${name}`, t.task, "", `- form: ${Object.keys(t.forms).join(" | ")}`,
      // What a form's page has to show, where no measure says it (the forms graded from measures are listed by reading task above).
      ...(Object.keys(t.forms).some((form) => rightFor(name, form)) ? [`- right for: ${Object.keys(t.forms).filter((form) => rightFor(name, form)).map((form) => `${form} - ${rightFor(name, form)}`).join("; ")}`] : []),
      ...(() => { const limits = Object.entries(t.forms).map(([form, target]) => [form, limitOf(name, form, target)]).filter(([, l]) => l);
        return limits.length ? [`- holds: ${limits.map(([form, l]) => `${form} ${l.min}${l.max ? `-${l.max}` : "+"} ${l.key}${l.valueChars ? ` (values ${l.valueChars} characters at most)` : ""}${l.columns ? ` (\`columns\` 1-${l.columns}, or left out)` : ""}`).join("; ")}`] : []; })(),
      ...(data.length ? [`- data: ${[...data.reduce((m, [form, keys]) => m.set(keys.join(", "), [...(m.get(keys.join(", ")) || []), form]), new Map())]
        .map(([keys, forms]) => forms.length === data.length ? keys : `${keys} (${forms.join(", ")})`).join("; ")}`] : []), `- commentary: ${t.commentary.join(" | ")}${Object.keys(t.forms).filter((form) => FORM_COMMENTARY[`${name}/${form}`])
        .map((form) => `; form ${form} takes ${FORM_COMMENTARY[`${name}/${form}`].join(" | ")}`).join("")}`, `- exhibits: ${n}` +
      (t.marked ? "; the chart marks its finding (annotation, highlight, reference line or rate)" : "") +
      (t.periods ? "; four or more periods" : "") + (t.minCategories ? `; ${t.minCategories}+ members` : "") + (t.rows ? "; `rows` with `cells`" : "") +
      (CHART_TYPES.includes(name) || name === "panels" ? `; plots ${name === "bridge" ? EVIDENCE_FLOOR.bridge : EVIDENCE_FLOOR.chart}+ values${name === "panels" ? " when a panel is a chart" : ""}` : ""), "");
  }
  return lines.join("\n");
}

// Which way a measure is good news: a delta or a trend arrow is coloured by
// it. On a metric, a table column (every trend cell under it), a row, or a cell.
const POLARITY_SCHEMA = { enum: [...POLARITIES], default: "up", description: "the direction that is good news for this measure: \"up\" (revenue, share, retention) or \"down\" (a cost, churn, a wait); a delta or trend arrow is coloured by it, not by its sign" };
const METRIC_SCHEMA = { type: "object", anyOf: [{ required: ["value"] }, { required: ["measure"] }], properties: { value: { type: ["string", "number"] }, label: { type: "string" }, sublabel: { type: "string" },
  measure: { type: "string", description: "in place of `value`: the number to print, by reference - \"<insight id>/<measure>\", with \"@<period or member>\" for one value of a longer measure; the runtime writes `value` in the `format`" },
  format: { type: "string", description: "how a `measure` is printed: the digits as 0, 0.0 or 0,0 with what is printed round them (\"+0.0%\", \"CHF 0.0bn\"), then `| abs`, `| /1000` or `| x100`" },
  delta: { type: "string", description: "the signed change, \"+8 pts\" or \"-3%\"; green or red by `better`" }, better: POLARITY_SCHEMA } };

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

/**
 * A JSON Schema for a typed page, for harnesses that validate or constrain
 * generation: the pages file, or with `only` the page schema of one type.
 */
export function pageSchema(only = null) {
  if (only !== null && !PAGE_TYPES[only]) throw new Error(`unknown page type "${only}"; one of ${Object.keys(PAGE_TYPES).join(", ")}`);
  // Any page, typed or structural, may be hidden.
  const hidden = { type: "boolean", description: "true keeps the slide in the file but out of the slide show (PowerPoint's Hide Slide); it is still rendered and reviewed. An imported hidden slide's page carries it, and a page composed where a hidden slide stood is hidden without it; false shows the slide again" };
  const typed = Object.entries(PAGE_TYPES).filter(([name]) => only === null || name === only).map(([name, t]) => ({
    type: "object",
    required: ["id", "type", "form", "commentary", "why", "title"],
    properties: {
      id: { type: "string" }, type: { const: name }, title: { type: "string" },
      subtitle: { type: "string", description: `optional standfirst under the title: the measure and unit, the population, the period or the scope, in one line of ${SUBTITLE_WORDS} words or fewer; never a restatement of the title` },
      form: { enum: Object.keys(t.forms) }, commentary: { enum: t.commentary },
      takeaway: { oneOf: [{ const: false }, { type: "string", minLength: 8 }], description: `optional closing sentence, ${TEXT_LIMITS.takeawayLines} lines at most; absent or false, the page closes on its exhibit` },
      source: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" }, minItems: 1 }], description: "the citation as text, or keys of the pages file's `sources` registry" },
      why: { type: "string", minLength: 20 }, series: { type: "string" }, rail: { type: "string" },
      bar: { type: "string", minLength: 8, description: "with commentary so-what-bar: the implication in a filled bar under the exhibit, two lines at most" },
      ...(t.forms["labelled-rows"] ? { blocks: { type: "array", minItems: 2, maxItems: 5, description: "form labelled-rows: the rows down the page", items: {
        type: "object", required: ["label", "points"], additionalProperties: false,
        properties: { label: { type: "string" }, points: { type: "array", minItems: 2, maxItems: 4 },
          metric: { ...METRIC_SCHEMA, required: ["label"] }, exhibit: { type: "object", required: ["type"] } } } } } : {}),
      ...(name === "numbers" ? { metrics: { type: "array", items: METRIC_SCHEMA, description: "form metric-strip: the figures across the top" }, kpi: { ...METRIC_SCHEMA, description: "form hero-number: the one figure" } } : {}),
      ...(t.table ? { exhibit: { type: "object", properties: {
        columns: { type: "array", items: { oneOf: [{ type: "string" }, { type: "object", properties: { better: POLARITY_SCHEMA } }] } },
        rows: { type: "array", items: { oneOf: [{ type: "array" }, { type: "object", properties: { better: POLARITY_SCHEMA } }] } } } } } : {}),
      settles: { type: "object", required: ["kind", "what"], properties: { kind: { enum: SETTLES_KINDS }, what: { type: "string", minLength: 8 } } },
      adds: { oneOf: [{ type: "null" }, { type: "string", minLength: 8 }], description: "what the commentary says that the exhibit cannot; required with commentary beside, beside-left, below, captions or on-exhibit" },
      evidence: { type: "array", items: { type: "string" }, description: "insight ids from <id>.insights.json; with an insight log, required for data-bearing types and it derives settles" },
      hidden,
    },
    not: { anyOf: OWNED.map((key) => ({ required: [key] })) },
    ...(() => {
      const forms = Object.keys(t.forms), rules = [
        ...forms.filter((form) => FORM_SCHEMA[`${name}/${form}`]).map((form) => ({ if: { properties: { form: { const: form } } }, then: { required: ["exhibit"], properties: { exhibit: FORM_SCHEMA[`${name}/${form}`] } } })),
        // A form that narrows its type's placements says so to the generator.
        ...forms.filter((form) => FORM_COMMENTARY[`${name}/${form}`]).map((form) => ({ if: { properties: { form: { const: form } } }, then: { properties: { commentary: { enum: FORM_COMMENTARY[`${name}/${form}`] } } } }))];
      return rules.length ? { allOf: rules } : {};
    })(),
  }));
  if (only !== null) return { $schema: "https://json-schema.org/draft/2020-12/schema", $id: `professional-slides.pages/v1#${only}`, ...typed[0] };
  const structural = { type: "object", required: ["kind"], properties: { kind: { enum: ["section", "agenda"] }, hidden } };
  const source = { type: "object", required: ["name"], additionalProperties: false,
    properties: { name: { type: "string" }, short: { type: "string", description: "the name the footer falls back to when a page's full citation does not fit its lines; the full names stay in the speaker notes" }, url: { type: "string" }, status: { type: "string", description: "how far the source can be relied on, printed after its name: audited, company-reported, press report, estimate, survey" },
      missing: { type: "array", items: { enum: ["publisher", "date", "document"] }, minItems: 1, uniqueItems: true, description: "what the record does not name, declared once here: the deck states it on one derived page, and the reviewers are told it is a declared limit" },
      reason: { type: "string", description: "with `missing`: why - who supplied the record and what is known of it" } } };
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema", $id: "professional-slides.pages/v1",
    type: "object", required: ["deck", "pages"],
    // The deck-level keys are the table the compile holds `deck` to (deck-keys.mjs).
    properties: { deck: (({ $schema: _schema, $id: _id, ...keys }) => keys)(deckSchema()),
      sources: { type: "object", additionalProperties: source, description: "the source registry: each source once, cited from a page's `source` by key" },
      pages: { type: "array", items: { oneOf: [...typed, structural] } }, appendix: { type: "array", items: { oneOf: typed } } },
  };
}
