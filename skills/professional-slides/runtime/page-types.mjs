// Page types: the authoring kit a deck is written through.
//
// Every analytical page is written as a page *type* - the reading task it
// serves - with a `form` (which exhibit carries the evidence) and a
// `commentary` (where the explanation lives). Both have defaults: the type's
// first form, and the placement the page's own text asks for. The compiler
// derives the page's structure (layout, shape, arrangement, exhibit type,
// closing line) from those choices, so the author does not write `layout`,
// `shape`, `arrange` or `soWhat`. It refuses only what cannot be drawn - an
// unknown type, form, key or icon, data a form cannot read, more than a frame
// holds - and adjusts what it can, saying so in the page's advisories.
//
//   node runtime/author-deck.mjs --types          the catalogue, for the author
//   node runtime/author-deck.mjs <id>.pages.json  compile, check and write the deck

import { REGISTRY } from "./registry.mjs";
import { readablePeriod, isPeriodLabel } from "./time-axis.mjs";
import { playerEntries, playerNames, plannedMark, planPlayerMarks } from "./players.mjs";
import { isTable, rowCells, finite, cellText, rowLabel, resultCells } from "./evidence.mjs";
import { textWordList, proseParts } from "./text-contract.mjs";
import { measureInsight } from "./registry-text.mjs";
import { calloutFits, calloutCapacity, countInWords } from "./chart-annotations.mjs";
import { sideStatementLayout } from "./figures.mjs";
import { hasPhrase } from "./text-layout.mjs";
import { validateReference, REFERENCE_SCHEMA } from "./reference-page.mjs";
import { sourceDate } from "./sources-registry.mjs";
import { halvesProblems } from "./compose-layouts.mjs";
import { checkPictures } from "./compose-pictures.mjs";
import { planFlags } from "./flags.mjs";
import { planPictureKinds } from "./compose-pictures.mjs";
import { iconDefinition, unknownIcon, ICON_NAMES } from "./icons.mjs";
import { POLARITIES } from "./tables.mjs";
import { deckSchema } from "./deck-keys.mjs";
import { GROUNDS } from "./palettes.mjs";
import { bandAxis } from "./chart-bands.mjs";

// The lines a page's text bands hold: a title sets on two lines at most
// (page_gates.py TITLE_LINES), a takeaway and a so-what bar on two.
export const TEXT_LIMITS = Object.freeze({ titleLines: 2, subtitleLines: 1, takeawayLines: 2, barLines: 2 });

// Where the page's explanation lives. Each maps onto what the composer draws.
export const COMMENTARY = Object.freeze({
  beside: "a commentary column to the right of the exhibit",
  "beside-left": "a commentary column to the left of the exhibit",
  below: "points in a band under the exhibit",
  rail: "one claim in a filled side panel (`rail` text) beside the exhibit",
  "on-exhibit": "on the chart itself, no separate text: a number mark (`cagr`, `changeAnnotations`, labelled `referenceLines`, a labelled value `bands` range, `stackTotals`) first, sentence callouts (`annotations`) where the mechanism needs them",
  "in-exhibit": "the explanation lives in the exhibit's cells (an implication column, a findings matrix, labelled cards)",
  captions: "one finding under each panel (`caption` on every exhibit)",
  "so-what-bar": "one implication in a filled bar across the foot of the exhibit (`bar` text); the page's close",
  none: "the exhibit carries the page alone",
});

const CHART = (name) => `chart.${name}`;
// The series charts a model page may draw over its data table.
const MODEL_CHARTS = ["chart.column", "chart.line", "chart.area", "chart.stacked-column", "chart.combo"];
// The so-what bar closes whatever the page drew, so it joins every placement
// list of a type whose evidence can end on one implication.
const ANY_TEXT = ["beside", "beside-left", "below", "rail", "so-what-bar"];

/**
 * The catalogue. `forms` maps each allowed form to the exhibit type or page
 * construction it compiles to, the first the default; `commentary` lists the
 * placements the type can take.
 */
export const PAGE_TYPES = Object.freeze({
  trend: {
    task: "how a measure moved over time",
    // `sparklines`: one small line per member over the same window - the
    // question is which of many series moved, not one series' path; `model`:
    // the series over its own data table, a forecast read with its numbers.
    forms: { line: CHART("line"), column: CHART("column"), "stacked-column": CHART("stacked-column"), area: CHART("area"),
      "stacked-area": CHART("stacked-area"), combo: CHART("combo"), slope: CHART("slope"), indexed: CHART("line"),
      sparklines: CHART("sparklines"), model: "model-page" },
    commentary: ["on-exhibit", ...ANY_TEXT], exhibits: 1,
  },
  ranking: {
    task: "where the members of a set stand on one measure",
    // `boxplot`: each member's spread - its range, middle half and median -
    // where one figure per member would hide how far its values run.
    // `range`: each member's low to high - the valuation methods of a
    // football field, a target's band by line - where the middle half is not known.
    forms: { bar: CHART("bar"), column: CHART("column"), lollipop: CHART("lollipop"), dumbbell: CHART("dumbbell"), bullet: CHART("bullet"),
      distribution: CHART("bar"), "aligned-bars": "aligned-bars", boxplot: CHART("boxplot"), range: CHART("range") },
    commentary: ["on-exhibit", ...ANY_TEXT], exhibits: 1,
  },
  composition: {
    task: "what a whole is made of, and how the mix differs between members or periods",
    // `pictogram`: a population's share counted in figures - six in ten -
    // for one to five populations, where a percentage reads as precision.
    // `radial-bars`: a share of each of two to six populations, each its own
    // whole, as arcs round one centre.
    forms: { "stacked-bar": CHART("stacked-bar"), "stacked-column": CHART("stacked-column"), marimekko: CHART("marimekko"),
      waffle: CHART("waffle"), donut: CHART("donut"), treemap: CHART("treemap"), pie: CHART("pie"), pictogram: "pictogram", "radial-bars": "radial-bars" },
    commentary: ["on-exhibit", ...ANY_TEXT], exhibits: 1,
  },
  relationship: {
    task: "how two measures move together across the members",
    forms: { scatter: CHART("scatter"), bubble: CHART("bubble"), "bubble-grid": CHART("bubble-grid") },
    commentary: ["on-exhibit", ...ANY_TEXT], exhibits: 1,
  },
  bridge: {
    task: "what a change between two totals is made of",
    forms: { waterfall: CHART("waterfall") },
    commentary: ["on-exhibit", ...ANY_TEXT], exhibits: 1,
  },
  panels: {
    task: "one question answered for two to four cuts, measures or members side by side - or up to twelve as small multiples, where the series are too many to share one axis (series compared over the same periods are lines on one chart, trend/line)",
    // `sequence`: two or three exhibits read left to right with an arrow
    // between each - cause and effect, before and after, input to result.
    // `small-multiples`: five to twelve cuts as one trellis of small charts of
    // one kind on one scale, where four panels stop.
    // `dashboard`: two to six headed exhibits of any kind on a grid of named
    // areas - a hero chart and its satellites, a map beside a table - under an
    // optional strip of figures, with an optional rail.
    // `breakout`: an overview and the detail of one of its bars, columns or
    // segments, the mark fanned out to the panel that splits it.
    forms: { row: "row", grid: "grid", stack: "stack", sequence: "sequence", "small-multiples": CHART("small-multiples"), dashboard: "dashboard", breakout: "breakout" },
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
    // `organization`: who reports to whom; `placement`: items set in the
    // columns they belong to; `insight-tree`: an issue broken into branches,
    // each leaf's evidence in the table beside it.
    forms: { ...Object.fromEntries(["flow", "tree", "cycle", "steps", "framework", "layers", "relationship-network", "funnel",
      "sankey", "quadrants", "matrix", "spectrum", "process", "chevron-process", "zone-matrix", "rank-flow", "organization", "placement", "venn"].map((f) => [f, f])),
      "insight-tree": "insight-tree-table" },
    commentary: ["on-exhibit", ...ANY_TEXT, "none"], exhibits: 1,
  },
  schedule: {
    task: "what happens when: phases, milestones, workstreams",
    // `horizons`: the portfolio of bets by when each pays - the core now,
    // growth next, options later - where a timeline would date them as tasks.
    // `rollout`: initiatives row by row, each one's phase in each year.
    forms: { timeline: "timeline", gantt: "gantt", roadmap: "roadmap", horizons: CHART("horizons"), rollout: "initiative-rollout" },
    commentary: ["beside", "below", "so-what-bar", "none"], exhibits: 1,
  },
  numbers: {
    task: "a few measured numbers that carry the claim, with the evidence under them",
    // `nested-circles`: a whole and the part of it inside the part - a market sized to what can be served and won.
    forms: { "hero-number": "hero-number", "metric-strip": "metrics-over-exhibit", "fact-grid": "fact-grid", "stat-list": "stat-list", "nested-circles": "nested-circles" },
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
    commentary: ["on-exhibit", ...ANY_TEXT], exhibits: 1,
  },
  picture: {
    task: "what the subject looks like: an aircraft, a site, a product",
    // `device`: a product as its user sees it - a screenshot in its phone, tablet or laptop frame.
    forms: { "picture-hero": "picture-hero", "picture-pair": "picture-pair", "picture-strip": "picture-strip", "photo-backdrop": "photo-backdrop", device: "device-frame" },
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
  reference: { task: "reconstruct a supplied slide image as editable native elements", forms: { native: "reference" }, commentary: ["none"], exhibits: 0 },
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
// radar's profile has no cells to hold the reading, so its commentary sits
// beside it, in a rail or under it - a radar is round, and beside its words it
// takes the page's height, where under them it is held to a band; a chart
// over its own data table keeps the table under it, so its commentary sits
// beside it or on it.
const FORM_COMMENTARY = Object.freeze({
  "trend/sparklines": [...ANY_TEXT], "ranking/boxplot": [...ANY_TEXT], "composition/pictogram": [...ANY_TEXT],
  "profiles/radar": ["beside", "beside-left", "rail", "below", "none"], "trend/model": ["beside", "on-exhibit"],
  // A trellis is one exhibit: its commentary sits beside or under it as a chart's does, and its panels carry no captions.
  "panels/small-multiples": [...ANY_TEXT, "none"],
  // A dashboard's cells carry their own headings and figures: its words are the rail beside it or the bar under it.
  "panels/dashboard": ["none", "rail", "so-what-bar"],
  // A device frame is one screenshot with no pictures to caption: its words sit beside it or under it.
  "picture/device": ["beside", "below"],
});
// Forms that carry a different number of exhibits from their type: a trellis is one exhibit of many panels.
const FORM_EXHIBITS = Object.freeze({ "panels/small-multiples": 1, "panels/dashboard": [2, 6], "panels/breakout": 2 });
// The charts whose bars, columns and segments a breakout or a spread runs from:
// the marks it links are boxes with a top, a bottom and a side to leave from.
const LINKED_CHARTS = new Set(["chart.column", "chart.bar", "chart.stacked-column", "chart.stacked-bar"]);
/** One end of a breakout or a spread: an exhibit by its place on the page (0, 1, ...), a category it draws, and a series of it. */
function linkEnd(id, key, end, ref, exhibits, { mark = true } = {}) {
  if (!ref || typeof ref !== "object") throw new Error(`${id}: \`${key}.${end}\` names { exhibit${mark ? ", category, series?" : ""} } - the exhibit by its place on the page, from 0`);
  const at = ref.exhibit;
  if (!Number.isInteger(at) || at < 0 || at >= exhibits.length) throw new Error(`${id}: \`${key}.${end}.exhibit\` is the exhibit's place on the page, 0 to ${exhibits.length - 1} (got ${JSON.stringify(at)})`);
  const ex = exhibits[at];
  if (!LINKED_CHARTS.has(ex.type)) throw new Error(`${id}: a ${key} runs between bars, columns or stacks (${[...LINKED_CHARTS].join(", ")}); exhibit ${at} is ${ex.type}`);
  if (!mark) return { exhibit: at };
  const categories = (ex.categories || []).map(String), names = (ex.series || []).map((sr) => sr?.name);
  if (!categories.includes(String(ref.category))) throw new Error(`${id}: \`${key}.${end}.category\` is one of exhibit ${at}'s categories (${categories.join(", ")}); got ${JSON.stringify(ref.category)}`);
  if (ref.series !== undefined && !names.includes(ref.series)) throw new Error(`${id}: \`${key}.${end}.series\` is one of exhibit ${at}'s series (${names.join(", ")}); got ${JSON.stringify(ref.series)}`);
  return { exhibit: at, category: String(ref.category), ...(ref.series !== undefined ? { series: ref.series } : {}) };
}
/** `breakout: { from: { exhibit, category, series? }, to: exhibit }` - the overview's mark and the panel that splits it, the overview first. */
function breakoutOf(page, id, exhibits) {
  const b = page.breakout;
  if (!b || typeof b !== "object") throw new Error(`${id}: a breakout page names the mark it splits - \`breakout: { from: { exhibit: 0, category, series? }, to: 1 }\`, the overview first and the detail beside it`);
  const from = linkEnd(id, "breakout", "from", { exhibit: 0, ...b.from }, exhibits);
  const to = linkEnd(id, "breakout", "to", { exhibit: b.to ?? 1 }, exhibits, { mark: false });
  if (to.exhibit <= from.exhibit) throw new Error(`${id}: the detail a breakout fans out to sits to the right of its overview - \`to\` after \`from.exhibit\``);
  return { from, to };
}
/** `spread: { from: { exhibit, category, series? }, to: { ... }, label }` - the gap between marks in two panels, named. */
function spreadOf(page, id, exhibits) {
  const sp = page.spread;
  if (!sp || typeof sp !== "object" || typeof sp.label !== "string" || !sp.label.trim()) throw new Error(`${id}: \`spread\` names the gap it draws - { from, to, label }, the label the difference in the measure's unit ("+12 pts")`);
  const from = linkEnd(id, "spread", "from", sp.from, exhibits), to = linkEnd(id, "spread", "to", sp.to, exhibits);
  if (to.exhibit <= from.exhibit) throw new Error(`${id}: a spread runs left to right, from a mark in one panel to a mark in a later one`);
  return { from, to, label: sp.label.trim() };
}
/** The fewest and most exhibits a page of `type` and `form` carries: `[lo, hi]`. */
export function exhibitRange(type, form) {
  const n = FORM_EXHIBITS[`${type}/${form}`] ?? PAGE_TYPES[type]?.exhibits ?? 1;
  return Array.isArray(n) ? n : [n, n];
}
/** A panels page drawn as one trellis: its one exhibit is laid out as a chart's is, not as a row of panels. */
export const trellisPage = (type, form) => type === "panels" && form === "small-multiples";
const commentaryOf = (type, form) => FORM_COMMENTARY[`${type}/${form}`] ?? PAGE_TYPES[type]?.commentary ?? [];
/**
 * Whether the exhibit a page of `type` and `form` draws can carry the page's
 * explanation on itself: a chart says which marks it draws (its registry
 * `decorations`, charts.mjs), and commentary "on-exhibit" is written there as
 * a sentence callout (`annotations`) or a number mark (NUMBER_MARKS). A bullet
 * chart draws neither, a waffle only a highlight: on the BA retest the plan
 * gave on-exhibit to ranking/bullet and composition/waffle and the writer found
 * each could not compose. An exhibit that is not a chart (a diagram, a map, a
 * model page's chart over its table) declares no marks: its explanation is in
 * its own labels, steps and notes, and the placement stays its type's.
 */
const takesOnExhibit = (type, form) => {
  const drawn = REGISTRY.get(String(PAGE_TYPES[type]?.forms?.[form] ?? ""))?.decorations?.draws;
  return !drawn || drawn.some((key) => key === "annotations" || NUMBER_MARKS.includes(key));
};

/**
 * The commentary placements a page of `type` and `form` compiles with: the
 * form's list, less what the form cannot draw - row blocks carry their
 * commentary in their bullets, a metric strip leaves no room for points,
 * aligned bars take no callouts, a chart that draws no callout and no number
 * mark takes no "on-exhibit".
 */
export function placementsOf(type, form) {
  const all = commentaryOf(type, form).filter((c) => c !== "on-exhibit" || takesOnExhibit(type, form));
  if (form === "labelled-rows") return all.filter((c) => ["in-exhibit", "so-what-bar"].includes(c));
  if (type === "numbers" && form === "metric-strip") return all.filter((c) => c === "none");
  if (type === "ranking" && form === "aligned-bars") return all.filter((c) => c !== "on-exhibit");
  return all;
}

// Keys the compiler owns. Written by the author they would bypass the choices.
const OWNED = ["layout", "shape", "arrange", "soWhat", "pageType"];
// Keys of a typed page that are choices or authoring notes, not slide keys.
// `draft` and `sourceSlide` are a revision's: the imported slide's old copy
// and its position in the source deck (runtime/import-deck.py). `limits` is
// the note `--scaffold` and `--example` print on a page, which the compiler
// reads past, so a scaffold pasted whole still compiles. `why`, `settles` and
// `adds` are notes an author may keep on a page; nothing reads them.
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
  const lists = ["annotations", "highlights", "events", "bands", ...(TARGET_CHARTS.has(ex?.type) ? ["targets"] : [])];
  return lists.some((key) => Array.isArray(ex?.[key]) && ex[key].length > 0) || (ex?.focusSeries !== undefined && ex.focusSeries !== false) || numberMarked(ex);
}

// A number set on the plot: the change or growth rate on an arrow, the gap
// bracketed, a benchmark as a reference line, a stack's total. Strong decks
// mark a chart this way far more often than with a sentence - a signed change
// on one page in eight, a total on one in ten - so a number mark carries the
// page's commentary on the plot, and a sentence callout beside it is optional.
const NUMBER_MARKS = ["changeAnnotations", "referenceLines", "stackTotals", "segmentGrowth", "seriesGrowth", "change", "cagr", "growth"];
// A labelled band on the value axis - a target range, a tolerance - is a benchmark set on the plot, as a labelled
// reference line is (chart-bands.mjs).
const valueBandMarked = (ex) => (Array.isArray(ex?.bands) ? ex.bands : []).some((band) => band?.label && ["value", "x", "y"].includes(bandAxis(band)));
export const numberMarked = (ex) => NUMBER_MARKS.some((key) => (Array.isArray(ex?.[key]) ? ex[key].length > 0 : ex?.[key] != null && ex[key] !== false)) || valueBandMarked(ex);

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
  "labelled-rows": { key: "blocks", min: 1, max: 5 }, sequence: { key: "exhibits", min: 2, max: 3 },
  // Forms held by the frame rather than the component: past forty bars a
  // distribution's rows are too thin to label; aligned bars run as many
  // columns as the page's width holds (two beside a text column, measured);
  // past eight lines an indexed trend's grey peers cannot be told apart.
  "ranking/distribution": { key: "categories", min: 2, max: 40 }, "ranking/aligned-bars": { key: "series", min: 1, max: 4 },
  "trend/indexed": { key: "series", min: 1, max: 8 },
  // Forms held by their component: a radar holds three to eight axes
  // (past eight its labels collide round the rim), a box plot four to twelve
  // members, a pictogram one to five populations, the horizons two to five bets.
  "chart.radar": { key: "categories", min: 3, max: 8 }, "chart.boxplot": { key: "categories", min: 4, max: 12 },
  "chart.small-multiples": { key: "items", min: 2, max: 12 },
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
// A chart at the right of a row needs half the body's height: two rows hold one.
const BLOCK_CHART_ROWS = 2, BLOCK_POINTS_MAX = 4;

// The forms whose data has one shape the renderer reads.
const FORM_SHAPE = Object.freeze({
  "composition/pictogram": (ex) => (ex.rows || []).length >= 1 || "a pictogram counts a share of each population in figures - `rows`, each { label, value } out of `of` (10 or 20)",
  "composition/waffle": (ex) => ((ex.series || []).length === 1 && (ex.categories || []).length >= 2) || "a waffle counts the members of each part - `categories` for the parts and one series of whole counts",
});

// The data an exhibit type reads, from its registered sample: what an author
// has to supply, as against styling (heading, unit, annotations, ...).
const STYLING = new Set(["heading", "unit", "annotations", "highlights", "focusSeries", "active", "treatment", "placement", "arrangement",
  "attributionAlign", "variant", "conclusion", "center", "today", "totals", "targets", "ranges", "highlight", "centerId", "ringOrder", "referenceLines", "legend", "dataLabels", "labelTreatment"]);
// Page constructions that are not registered components, with what they read.
const CONSTRUCTION_DATA = {
  "hero-number": ["kpi"], "metrics-over-exhibit": ["metrics", "exhibit"], "findings-matrix": ["rows (each with cells)"], "measure-table": ["columns", "rows"],
  text: ["paragraphs"], sidebar: ["panel", "paragraphs"], statement: ["text"], "executive-summary": ["points"], takeaways: ["items"],
  "picture-hero": ["pictures"], "picture-pair": ["pictures"], "picture-strip": ["pictures"], "photo-backdrop": ["photo", "exhibit"],
  "two-up-contrast": ["exhibits"], "table-halves": ["exhibits"], row: ["exhibits"], grid: ["exhibits"], stack: ["exhibits"], sequence: ["exhibits"],
  "labelled-rows": ["blocks (each a `label`, optionally its `icon`, up to four `points`, and optionally a `metric` { value, label } or a small `exhibit` - a table, or a headed chart on a page of two blocks)"],
  "aligned-bars": ["categories", "series (one per measure: name, unit, values)", "highlights (the subject)"],
};
// Forms that read more than their component's sample says.
const FORM_DATA = {
  "argument/memo": ["paragraphs (each a string or `{ lead, text }`)", "panel ({ text, kicker }: the conclusion or the figures to keep, down the right)"],
  "trend/indexed": ["categories", "series (raw values, the subject and its peers)", "indexBase (the period set to 100; the first by default)", "subject (the series in colour; the first by default)"],
  "ranking/distribution": ["categories (up to 40 members; sorted by the value for you)", "series (one measure)", "highlights (the subject)"],
  "ranking/boxplot": ["categories (4 to 12 members)", "boxes (one { min, q1, median, q3, max } per member)", "highlights (the subject)"],
  "trend/sparklines": ["items (2 to 12, each { label, values } over the same periods)", "highlights (the subject's `category`: its label)", "unit (the measure and the window)"],
  "trend/model": ["categories", "series", "the chart's `type` (chart.column by default; line, area, stacked-column or combo)"],
  "composition/pictogram": ["rows (1 to 5, each { label, value, text } - the figures filled out of `of`)", "of (10 or 20)", "icon (the figure: person by default)"],
  "profiles/radar": ["categories (3 to 8 attributes)", "series (1 to 4 players, one value per attribute)", "max (the scale's top; the largest value by default)", "focusSeries (the subject; the first series by default)"],
  "schedule/horizons": ["horizons (2 to 5, each { label, title, description })", "variant (curves, stepped, stepped-minimal, stepped-bands)"],
  "panels/dashboard": ["exhibits (2 to 6, each with its `heading`, of any kind - charts, a table, a map, a `panel` of text, a `metric` - and an `area` { column, row, columnSpan, rowSpan } on the grid, or none to fill it in reading order)", "grid ({ columns, rows }: how many tracks each way, or their widths as weights - [2, 1, 1]; 4 columns and 3 rows at most)", "metrics (an optional strip of 2 to 6 figures over the grid)"],
  "panels/small-multiples": ["one exhibit: mark (column, bar or line; stacked-column or stacked-bar, each panel a stack of the same parts; donut, each panel one whole)", "categories (the axis every panel shares; a donut's parts)", "items (2 to 12 panels, each { label, values, focus?, reference? }; a stacked panel { label, series: [{ name, values }] })", "percent (true: each stack as shares of its total)", "centre (the part whose share each donut's hole prints)", "highlights (the panel the page is about)", "reference (\"average\" or a value)", "scale (shared or own)", "rowLabels and columnLabels (a grid read both ways)"],
  "schedule/timeline": ["items (each { date, label, text }: when, what happens, and a sentence on it, set at reading size and counted as the page's words)", "orientation (across or down; absent, the frame decides - rows where the page has the height, columns over commentary below)"],
  "schedule/roadmap": ["items (each { label, period, text }: the stage, when it runs, and what it delivers)", "orientation (across or down; absent, the frame decides)"],
};
const sampleKeys = (exhibitType) => { const sample = REGISTRY.get(exhibitType)?.sample; return sample ? Object.keys(sample).filter((key) => !STYLING.has(key)) : []; };
export function dataKeys(exhibitType, { type, form, variant } = {}) {
  // A variant with its own sample reads that sample's data, not the default's:
  // a phase roadmap has phases and no `items`.
  // An organization set by hand reads `nodes` and `connectors`, which its sample, the automatic layout, does not carry.
  if (exhibitType === "organization" && !variant) return [...(sampleKeys("organization")), "nodes"];
  const own = variant && REGISTRY.get(exhibitType)?.variants?.[variant]?.props;
  if (own && Object.keys(own).some((key) => own[key] !== undefined && !STYLING.has(key)))
    return Object.keys(own).filter((key) => own[key] !== undefined && !STYLING.has(key));
  if (FORM_DATA[`${type}/${form}`]) return FORM_DATA[`${type}/${form}`];
  if (CONSTRUCTION_DATA[exhibitType]) return CONSTRUCTION_DATA[exhibitType];
  const sample = REGISTRY.get(exhibitType)?.sample;
  return sample ? Object.keys(sample).filter((key) => !STYLING.has(key)) : [];
}

/**
 * The forms built for many values, set up from what the author wrote. An
 * indexed trend is rebased here, so the author supplies the raw series - its
 * base the first period and its subject the first series unless named; a
 * distribution is the whole field sorted by its value; aligned bars are one
 * category axis with a column per measure. A callout a form has no room for is
 * set aside, and the page's advisories say so (`adjusted`).
 */
function formExhibit(id, page, ex, adjusted) {
  const cats = (ex.categories || []).map(String);
  const series = Array.isArray(ex.series) ? ex.series : [];
  const setAside = (what, why) => { adjusted.push(`${what} set aside: ${why}`); };
  const dropCallouts = (keep, why) => {
    const notes = ex.annotations || [];
    if (notes.length <= keep) return;
    ex.annotations = notes.slice(0, keep);
    setAside(`${notes.length - keep} callout${notes.length - keep === 1 ? "" : "s"}`, why);
  };
  // A trend runs over time. Members measured at one time drawn as a trend read as a change that never happened: the
  // A350F deck's e-commerce page joined four shares - international, worldwide, two lanes - with a rising line.
  if (page.type === "trend" && !["sparklines", "model"].includes(page.form) && cats.length >= 2) {
    const odd = cats.filter((category) => !isPeriodLabel(category));
    if (odd.length) throw new Error(`TREND_NOT_TIME: ${id}: a trend runs over periods, and ${odd.length === cats.length ? "none of its categories is one" : `${odd.slice(0, 3).map((c) => `"${c}"`).join(", ")}${odd.length > 3 ? ` and ${odd.length - 3} more` : ""} ${odd.length === 1 ? "is" : "are"} not`}: members compared at one time are a ranking (\`ranking/bar\`), the parts of a whole a composition`);
  }
  // A ranking is read in order: its bars are set largest first, as a distribution's are, unless the order is the
  // author's (\`order: "given"\`) or runs it brackets (\`categoryGroups\`). Four of the A350F deck's ranked pages came out
  // in the order their measures listed their members.
  if (page.type === "ranking" && ["bar", "column", "lollipop"].includes(page.form)) {
    const given = ex.order === "given";
    delete ex.order;
    const key = series[0]?.values || [];
    if (!given && !ex.categoryGroups && cats.length > 2 && key.length === cats.length && key.every(finite)) {
      const order = cats.map((_, i) => i).sort((a, b) => Number(key[b]) - Number(key[a]) || a - b);
      if (order.some((at, i) => at !== i)) {
        const reorder = (list) => (Array.isArray(list) && list.length === cats.length ? order.map((i) => list[i]) : list);
        ex.categories = reorder(ex.categories);
        ex.series = series.map((item) => ({ ...item, values: reorder(item.values) }));
        for (const k of ["categoryNotes", "rowNotes"]) if (ex[k] !== undefined) ex[k] = reorder(ex[k]);
        if (Array.isArray(ex.deltas) && ex.deltas.every((d) => typeof d !== "object")) ex.deltas = reorder(ex.deltas);
        if (Array.isArray(ex.dataTable)) ex.dataTable = ex.dataTable.map((row) => ({ ...row, values: reorder(row.values) }));
      }
    }
  }
  if (page.type === "trend" && page.form === "indexed") {
    const base = ex.indexBase ?? cats[0], subject = ex.subject ?? series[0]?.name;
    const at = cats.indexOf(String(base));
    if (at < 0) throw new Error(`${id}: an indexed trend's \`indexBase\` is one of its categories - the period every line is set to 100 at (got ${JSON.stringify(base)})`);
    if (!series.some((s) => s?.name === subject)) throw new Error(`${id}: an indexed trend's \`subject\` names one of its series - the line drawn in colour while the peers stay grey`);
    ex.series = series.map((s) => {
      const value = Number(s?.values?.[at]);
      if (!(value > 0)) throw new Error(`${id}: "${s?.name}" has no positive value at ${base} to index from; choose a base period every series reports`);
      return { ...s, values: s.values.map((v) => (finite(v) ? Math.round((Number(v) / value) * 1000) / 10 : v)) };
    });
    // Every line passes through 100 at the base and the unit names it; a
    // labelled base line would set its label on the peers' lines.
    ex.focusSeries = subject;
    if (!String(ex.heading ?? "").trim()) ex.heading = `Index, ${base} = 100`;
    else if (!ex.unit) ex.unit = `Index, ${base} = 100`;
    delete ex.indexBase; delete ex.subject;
  }
  if (page.type === "ranking" && page.form === "distribution") {
    if (series.length !== 1) throw new Error(`${id}: a distribution plots one measure across the field - one series; several measures for the same members are form "aligned-bars"`);
    // The field is read by its order, so it is set in order of the value, largest first.
    const values = series[0].values || [];
    const order = cats.map((_, i) => i).sort((a, b) => (finite(values[b]) ? Number(values[b]) : -Infinity) - (finite(values[a]) ? Number(values[a]) : -Infinity));
    if (order.some((at, i) => at !== i)) {
      ex.categories = order.map((i) => ex.categories[i]);
      ex.series = [{ ...series[0], values: order.map((i) => values[i]) }];
    }
    // Forty rows ten pixels apart hold one callout beside its bar, not a second.
    dropCallouts(1, "a distribution's rows are too close for a second callout; say the rest in the commentary");
  }
  if (page.type === "trend" && page.form === "sparklines") {
    const items = Array.isArray(ex.items) ? ex.items : [];
    const lengths = new Set(items.map((item) => (Array.isArray(item?.values) ? item.values.length : 0)));
    if (lengths.size > 1) throw new Error(`${id}: small multiples share one window - every item carries the same periods (${[...lengths].join(", ")} values given); a missing period is null`);
    dropCallouts(0, "small multiples draw no callouts; say what moved in the commentary");
  }
  if (page.type === "ranking" && page.form === "boxplot") dropCallouts(0, "a box plot draws no callouts; say what the spread shows in the commentary");
  if (page.type === "profiles" && page.form === "radar") {
    if (series.length < 1 || series.length > 4) throw new Error(`${id}: a radar sets one to four players over the same attributes; this one has ${series.length}`);
    const bad = series.find((s) => !Array.isArray(s?.values) || s.values.length !== cats.length);
    if (bad) throw new Error(`${id}: every player on a radar has one value per attribute - "${bad?.name ?? "?"}" does not`);
    if (series.length > 1 && !series.some((s) => s?.name === ex.focusSeries)) ex.focusSeries = series[0].name;
  }
  if (page.type === "ranking" && page.form === "aligned-bars") {
    // Each column needs about two hundred pixels for its bars and their values:
    // beside a text column the exhibit holds two, across the page four.
    if (["beside", "beside-left", "rail"].includes(page.commentary) && series.length > 2)
      throw new Error(`${id}: aligned bars beside a text column hold two measures; ${series.length} need the page's width - choose commentary "below"`);
    const bad = series.find((s) => typeof s?.name !== "string" || !s.name.trim() || !Array.isArray(s.values) || s.values.length !== cats.length);
    if (!cats.length || bad) throw new Error(`${id}: aligned bars list the members once in \`categories\` and give each measure as a series - \`{ name, unit, values }\`, one value per member${bad ? ` ("${bad?.name ?? "?"}" does not)` : ""}`);
    dropCallouts(0, "a callout on one column pushes its bars out of line with the others");
  }
}

/** Aligned bars as the composer draws them: a chart group of bar charts on one category axis. */
function alignedBarsGroup(ex) {
  const { categories, series, highlights = [], valueFormat, type, ...rest } = ex;
  return { ...rest, type: "chart-group", aligned: true, charts: series.map((s) => ({ heading: s.name, ...(s.unit ? { unit: s.unit } : {}), component: "chart.bar",
    props: { categories, series: [{ name: s.name, values: s.values }], highlights, ...(s.valueFormat ?? valueFormat ? { valueFormat: s.valueFormat ?? valueFormat } : {}) } })) };
}
const words = textWordList;

const choose = (id, axis, allowed, value) =>
  `${id}: \`${axis}\` is one of ${allowed.map((v) => `"${v}"`).join(", ")}${value === undefined ? "" : ` (got ${JSON.stringify(value)})`}`;

/**
 * A labelled-rows page's blocks: each a label, its bullets, and optionally a
 * number or a small exhibit at the right that is the row's evidence.
 */
function checkBlocks(page, id, exhibits) {
  if (exhibits.length) throw new Error(`${id}: a labelled-rows page carries its evidence in its rows - move the exhibit into a block's \`exhibit\`, or choose form "cards"`);
  const blocks = page.blocks, { min, max } = LIMITS["labelled-rows"];
  if (!Array.isArray(blocks) || blocks.length < min || blocks.length > max)
    throw new Error(`${id}: a labelled-rows page carries ${min} to ${max} \`blocks\` - { label, points, and a metric or exhibit if the rows have evidence }; this one has ${Array.isArray(blocks) ? blocks.length : 0}`);
  blocks.forEach((block, at) => {
    const where = `${id}: block ${at + 1}`;
    if (!block || typeof block !== "object" || typeof block.label !== "string" || !block.label.trim()) throw new Error(`${where} needs its \`label\``);
    if (!Array.isArray(block.points) || block.points.length > BLOCK_POINTS_MAX) throw new Error(`${where} carries up to ${BLOCK_POINTS_MAX} \`points\` beside its label; it has ${Array.isArray(block.points) ? block.points.length : "none"}`);
    const keys = Object.keys(block).filter((key) => !["label", "icon", "points", "metric", "exhibit"].includes(key));
    if (keys.length) throw new Error(`${where}: unknown key${keys.length === 1 ? "" : "s"} ${keys.map((k) => `\`${k}\``).join(", ")} - a block is { label, icon?, points, metric | exhibit }`);
    if (block.metric && block.exhibit) throw new Error(`${where} carries a \`metric\` or an \`exhibit\` at its right, not both`);
    if (block.metric && !(block.metric.value !== undefined && String(block.metric.value).trim() && block.metric.label)) throw new Error(`${where}: a block's \`metric\` is { value, label }`);
    if (block.metric && String(block.metric.value).length > 10) throw new Error(`${where}: a block's metric is a figure of 10 characters at most ("${block.metric.value}"); put the unit in the label`);
    if (block.exhibit) {
      if (!block.exhibit.type) throw new Error(`${where}: name the block exhibit's \`type\` (chart.bar, chart.column, table, ...)`);
      const keys = CONSTRUCTION_DATA[block.exhibit.type] ? [] : dataKeys(block.exhibit.type);
      if (keys.length && !keys.some((key) => block.exhibit[key] !== undefined)) throw new Error(`${where}: a ${block.exhibit.type} exhibit reads ${keys.map((k) => `\`${k}\``).join(", ")} - none is given`);
    }
  });
  // A chart keeps a 100px plot under its heading and above its axis, which a
  // row takes only when the body is split in two: at three rows a two-bar
  // chart comes out 12px short. A number or a two-row table fits any row.
  const charts = blocks.filter((block) => String(block.exhibit?.type ?? "").startsWith("chart.")).length;
  if (charts && blocks.length > BLOCK_CHART_ROWS)
    throw new Error(`${id}: a chart at the right of a row needs half the body's height, so it fits a page of ${BLOCK_CHART_ROWS} blocks; with ${blocks.length}, give each row a \`metric\` or a two-row table`);
}

const BLANK = /^[\s\-–—]*$/;

/**
 * A row styled as a total (`style: "total"`) with nothing in its result
 * cells: a total row carries its total. compose-tables.mjs totalRow adds one
 * only where a column sums.
 */
function blankTotal(rows) {
  for (const row of rows || []) {
    if (row?.style !== "total") continue;
    const results = resultCells(row);
    if (results.length && results.every((c) => BLANK.test(cellText(c)))) return { label: cellText(rowLabel(row)).trim() || "total" };
  }
  return null;
}

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
  for (const key of ["changeAnnotations", "periods", "bands"]) if (Array.isArray(ex[key])) ex[key] = ex[key].map((item) => (item && typeof item === "object" ? Object.fromEntries(Object.entries(item).map(([k, v]) => [k, ["start", "end", "from", "to"].includes(k) ? to(v) : v])) : item));
  if (ex.forecastFrom !== undefined) ex.forecastFrom = to(ex.forecastFrom);
  if (Array.isArray(ex.categoryBreaks)) ex.categoryBreaks = ex.categoryBreaks.map(to);
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
  const point = (p) => { if (typeof p === "string") add(p); else if (p && typeof p === "object") { add(p.lead); add(p.text); (p.points || []).forEach(point); } };
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

// A point's own figure: its first quantity with a currency, a percentage or a
// unit. In a point of evidence that quantity is what the reader should see
// first, so an unmarked point is marked on it. A bare count is not: the Spacebar
// run's points lit "7" and "11" as random accents, so a point with no quantity
// stays unmarked unless the page names its phrase.
const FIGURE = /(?<![\p{L}\d.,])(?:US\$|A\$|[$£€¥]|(?:AED|USD|EUR|GBP|SAR|QAR)\s?)?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|trillion|percentage points|bn|mn|m|k|pp|pts|x)(?![\p{L}\d])|%|×)?/gu;
export function pointFigure(text) {
  const found = [...String(text ?? "").matchAll(FIGURE)].map((m) => m[0].trim()).filter((figure) => hasPhrase(text, figure));
  return found.find((figure) => /[%×$£€¥]|[a-z]$|^(?:AED|USD|EUR|GBP|SAR|QAR)/i.test(figure)) ?? null;
}

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
 * where the registry gives one; without the statuses; then the primary
 * sources by name with the rest counted ("+3 more in the notes"), down to
 * the primaries alone. The primaries (`primary`, page-numbers.mjs
 * primaryCitations) are the sources of the numbers the title prints and each
 * exhibit's own - the one most of its plotted measures cite, none where more
 * than two tie - and every form
 * names them, first: on the BA retest the shortest forms named a few sources
 * or none ("+11 more in the notes", "14 records, listed in the notes") and a
 * reader of the page could look up neither the title's figures nor the
 * chart's. A page with no measures to read them from keeps the count alone. A
 * source is named with the registry's `date` where it records one and the
 * name does not already carry it - the as-at date a reader needs. The footer
 * shows the first form that fits its lines and the words it has room for
 * under the note bar (page-template.mjs, core.mjs compileSlide), the last at
 * the footer's full line limit, and whatever it leaves out is kept whole in
 * the speaker notes. A citation typed as text has one form, the author's.
 */
export function citationForms(keys, registry, { primary = null } = {}) {
  const held = keys.filter((key) => (primary ?? []).includes(key));
  const first = held.length ? held : keys.slice(0, 1);
  const entries = [...first, ...keys.filter((key) => !first.includes(key))].map((key) => registry[key]);
  const label = entries.length > 1 ? "Sources" : "Source";
  const line = (names) => `${label}: ${names.join("; ")}`;
  // Several articles of one publisher share its short name: a short form says it once, and the fullest form names each.
  // When a source was read changes nothing about how its number reads: it is the registry's `retrieved`, which no form
  // prints - on a deck whose every source was retrieved one day, it was a third of every footer. When it was published
  // is its `date`, which every form prints.
  // A name that already dates itself - "(Oct 2026)" against a printed 14 Oct 2026 - is not dated again: the Spacebar footers
  // read "... (Oct 2026), 14 Oct 2026".
  const datesItself = (name, date) => name.includes(date) || date.split(" ").slice(-2).every((part) => new RegExp(/^\d{4}$/.test(part) ? `\\b${part}\\b` : `\\b${part.slice(0, 3)}`, "i").test(name));
  const nameOf = (e, short, status) => { const name = short && typeof e.short === "string" && e.short.trim() ? e.short.trim() : e.name;
    const date = sourceDate(e)?.printed, dated = date && !datesItself(name, date) ? `${name}, ${date}` : name;
    return status && e.status ? `${dated} (${e.status})` : dated; };
  const named = (short, status, list = entries) => [...new Set(list.map((e) => nameOf(e, short, status)))];
  const brief = named(true, false), primaries = named(true, false, entries.slice(0, first.length));
  // A page with no measures to read primaries from (`primary` null: a deck with no insight log) keeps the old floor: the
  // leading names counted down to the count alone, the list whole in the notes. One whose measures name no primary - a
  // title with no number, over a ranking of members each read from its own report - names its first source.
  const known = Array.isArray(primary);
  const floor = known ? Math.max(1, primaries.length) : 0;
  const counted = Array.from({ length: Math.max(0, brief.length - Math.max(floor, 1)) }, (_, i) => brief.length - 1 - i)
    .map((shown) => `${line(brief.slice(0, shown))}; +${brief.length - shown} more in the notes`);
  return [...new Set([line(named(false, true)), line(named(true, true)), line(brief), ...counted, ...(known ? [] : [`${label}: ${entries.length} ${entries.length === 1 ? "record" : "records"}, listed in the notes`])])];
}

/**
 * The commentary a page takes when it names none: the placement its own text
 * asks for - points beside the exhibit, a rail, a bar, a caption under every
 * panel, callouts on the chart - else the exhibit carries the page alone.
 */
function defaultCommentary(page) {
  const allowed = placementsOf(page.type, page.form);
  const exhibits = exhibitsOf(page);
  const said = (text) => typeof text === "string" && text.trim();
  // Points beside a chart or a table are a column the page asks for, not the default: strong decks set one beside under a
  // fifth of their chart and table pages, and carry the point the title rests on on the exhibit itself; the skill had set
  // a column on three of four. A page that writes points over such an exhibit chooses where they go.
  const kinds = exhibits.length ? exhibits.map((ex) => String(ex.type ?? PAGE_TYPES[page.type]?.forms?.[page.form] ?? "")) : [String(PAGE_TYPES[page.type]?.forms?.[page.form] ?? "")];
  const data = kinds.some((kind) => kind.startsWith("chart.") || kind === "table");
  if (data && allowed.includes("beside") && ((page.points || []).length || (page.paragraphs || []).length)) {
    const table = kinds.every((kind) => kind === "table");
    throw Object.assign(new Error(`${page.id ?? "page"}: the page writes \`points\` over a ${table ? "table" : "chart"} without saying where they go. Most strong pages carry the point on the exhibit itself: ${table ? "set it in the table (an implication column, `commentary: \"in-exhibit\"`)" : "set the one the title rests on as a callout (`annotations: [{ category, text }]`, a change mark or a labelled reference line) with `commentary: \"on-exhibit\"`"} and drop the points; or ask for the column - \`commentary: "beside"\` - or the band under the exhibit - \`commentary: "below"\``), { code: "COMMENTARY_UNCHOSEN" });
  }
  const asked = [
    ...((page.points || []).length || (page.paragraphs || []).length ? ["beside", "below"] : []),
    ...(said(page.rail) ? ["rail"] : []),
    ...(said(page.bar) ? ["so-what-bar"] : []),
    ...(exhibits.length && exhibits.every((ex) => said(ex.caption)) ? ["captions"] : []),
    ...(page.type === "picture" && (page.pictures || []).length && page.pictures.every((p) => p?.label || p?.line) ? ["captions"] : []),
    ...(exhibits.some((ex) => (ex.annotations || []).length) ? ["on-exhibit"] : []),
    "none", "in-exhibit", "on-exhibit",
  ];
  return asked.find((c) => allowed.includes(c)) ?? allowed[0];
}

/**
 * The page's choices, checked before anything else: the type, its form and
 * commentary (each defaulted where the page names none), the takeaway, the
 * icons, the polarity of its measures and its citation.
 */
function checkChoices(page, id, { sources = null, sourcePrimary = null, adjusted }) {
  const type = PAGE_TYPES[page.type];
  if (!type) throw new Error(`${id}: unknown page type "${page.type}"; one of ${Object.keys(PAGE_TYPES).join(", ")}`);
  for (const key of OWNED) if (page[key] !== undefined) throw new Error(`${id}: \`${key}\` is set by the page's choices, not written - choose \`commentary\`, \`form\` and \`takeaway\` instead`);
  // One body size across the deck: a page that needs room takes it from its layout.
  if (page.density !== undefined) throw new Error(`${id}: \`density\` is the deck's, not the page's - the deck sets one body size (\`density\` on the deck); a page that needs room changes its layout (another form, fewer rows, a split across two pages) or moves to the appendix`);
  const forms = Object.keys(type.forms);
  if (page.form === undefined) page.form = forms[0];
  if (!forms.includes(page.form)) throw new Error(choose(id, "form", forms, page.form));
  if (page.commentary === undefined) page.commentary = defaultCommentary(page);
  const placements = placementsOf(page.type, page.form);
  if (!placements.includes(page.commentary)) {
    // A chart that draws no callout and no number mark cannot carry the explanation on itself.
    if (page.commentary === "on-exhibit" && commentaryOf(page.type, page.form).includes("on-exhibit")) {
      const drawn = REGISTRY.get(String(type.forms[page.form])).decorations.draws;
      throw new Error(`${id}: a ${page.form} chart draws no callout and no number mark${drawn.length ? ` (it draws ${drawn.map((key) => `\`${key}\``).join(", ")})` : ""}, so commentary "on-exhibit" has nowhere to write the explanation - choose ${placements.map((c) => `"${c}"`).join(", ")}, or a form whose chart takes callouts`);
    }
    throw new Error(choose(id, "commentary", placements, page.commentary));
  }
  // No close is the norm.
  if (page.takeaway === undefined) page.takeaway = false;
  if (!(page.takeaway === false || (typeof page.takeaway === "string" && page.takeaway.trim())))
    throw new Error(`${id}: \`takeaway\` is the closing sentence, or false (the default); most pages let the title carry the message`);
  if (page.commentary === "so-what-bar" && page.takeaway !== false) { adjusted.push("takeaway set aside: the so-what bar is the page's close"); page.takeaway = false; }
  if (page.bar !== undefined && page.commentary !== "so-what-bar") adjusted.push(`bar set aside: it is the text of a so-what bar, and the page's commentary is "${page.commentary}"`);
  // Every icon the page names, checked here with the nearest names.
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
    if (keys) page.sourceForms = citationForms(keys, sources, { primary: sourcePrimary });
  }
  return { type };
}

/**
 * Compile one typed page into a deck-spec slide. Throws where the page cannot
 * be drawn - an unknown type, form or key, data its form cannot read, more
 * than its frame holds; structural pages (`kind` cover, section, agenda) pass
 * through unchanged. What the compiler adjusts itself - a field the placement
 * does not draw, a highlight that lands nowhere, a callout a form has no room
 * for - is said in `pageType.advisories`.
 */
export function compilePage(pageIn, index = 0, { players = null, spineOnly = false, sources = null, sourcePrimary = null } = {}) {
  if (!pageIn || typeof pageIn !== "object") throw new Error(`page ${index + 1} is not an object`);
  const page = structuredClone(pageIn);
  const id = page.id ?? `page-${index + 1}`;
  if (page.type === "reference") {
    validateReference(page);
    // A reconstruction standing in for a slide of an imported deck names it, as a typed page does, so the revision keeps
    // its place and section and does not count the original as dropped.
    return { id, kind: "reference", title: page.title, reference: page.reference, nodes: page.nodes, notes: page.notes,
      uncertainties: page.uncertainties || [], ...(page.hidden ? { hidden: true } : {}), ...(page.sourceSlide !== undefined ? { sourceSlide: page.sourceSlide } : {}) };
  }
  if (!page.type) {
    // A section's number is the divider's numeral and the tracker's marker;
    // "01 / " written into its title as well numbers it three ways.
    // A structural page written without an id is given one from its kind and its place, here, once: every later stage
    // - the composition, the build - then names it the same way, where each would otherwise number it by its own count.
    const named = { ...page, id: page.id ?? `${page.kind}-${index + 1}` };
    if (page.kind === "section" && typeof page.title === "string" && /^\s*\d{1,2}\s*[/|.:)\-–—]/.test(page.title)) return { ...named, title: page.title.replace(/^\s*(?:section\s+)?\d{1,2}\s*(?:[/|.:)\-–—]\s*)+/i, "").trim() || page.title };
    if (page.kind && ["section", "divider", "agenda", "cover"].includes(page.kind)) return named;
    throw new Error(`${id}: give the page a \`type\` - one of ${Object.keys(PAGE_TYPES).join(", ")} - or a structural \`kind\` (section, agenda). Run \`node runtime/author-deck.mjs --types\` for what each is for.`);
  }
  const adjusted = [];
  const { type } = checkChoices(page, id, { sources, sourcePrimary, adjusted });
  // A page whose references do not bind yet has nothing past its choices to check (`spineOnly`).
  if (spineOnly) return null;
  // Each refusal says which step made it (`stage` on the error): the page's shape, the data its exhibits hold, the copy, or the layout.
  const staged = (stage, run) => { try { return run(); } catch (error) { if (error && typeof error === "object" && error.stage === undefined) error.stage = stage; throw error; } };
  const { slide, target, exhibits, setType, primary } = staged("shape", () => typedSlide(page, id, type, players));
  staged("evidence", () => checkExhibitData({ page, id, slide, exhibits, primary, adjusted }));
  staged("evidence", () => typedEvidence({ page, id, type, slide, exhibits, primary }));
  const { points } = staged("copy", () => checkCommentary({ page, id, slide, exhibits, primary, players, adjusted }));
  staged("layout", () => layOutPage({ page, id, type, slide, target, exhibits, setType, primary, points, adjusted }));
  return withPageType({ page, slide, adjusted });
}

/** The slide a page compiles to: its own keys less the choices, its exhibits typed by the form, the players' cells marked, and the primary exhibit. */
function typedSlide(page, id, type, players) {
  const slide = {};
  for (const [key, value] of Object.entries(page)) if (!CHOICE_KEYS.includes(key)) slide[key] = value;
  const target = type.forms[page.form];
  const exhibits = exhibitsOf(page);
  const [lo, hi] = exhibitRange(page.type, page.form);
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
      || (page.type === "parallel" && exhibits.length) || (page.type === "numbers" && ["fact-grid", "stat-list", "nested-circles"].includes(page.form))) {
    if (!exhibits.length) throw new Error(`${id}: form "${page.form}" needs its exhibit`);
    setType(slide.exhibit ?? slide.exhibits[0], target);
  }

  if (page.type === "profiles" && page.form === "logo-table") {
    setType(slide.exhibit, "table");
    if (!(slide.exhibit.columns || []).some((c) => c && typeof c === "object" && c.type === "logo"))
      throw new Error(`${id}: a logo table introduces each player by its mark - give it a \`type: "logo"\` column`);
  }
  if (page.type === "picture" && page.form === "device") {
    if (!exhibits.length) throw new Error(`${id}: a device page carries its \`exhibit\` - { device, image } - the screenshot in its frame`);
    setType(slide.exhibit ?? slide.exhibits[0], "device-frame");
  } else if (page.type === "picture") {
    if (page.form === "photo-backdrop" ? !(page.photo && exhibits.length) : !(page.pictures || []).length)
      throw new Error(`${id}: ${page.form === "photo-backdrop" ? "a photo-backdrop page carries a `photo` and one exhibit" : `a ${page.form} page carries its \`pictures\``}`);
    // How many pictures the form holds, and their one crop, said here in the page's words, not at composition.
    if (page.form !== "photo-backdrop") checkPictures(page.pictures, id, page.form);
    else if (page.photo?.crop !== undefined) throw new Error(`${id}: a backdrop runs to the slide's edges under its card, so it is not cropped to a circle; drop \`crop\`, or set the round photo on a picture-hero page`);
  }
  if (page.photo && page.type !== "picture") checkPictures([page.photo], id);

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
  // A country named as a mark - `flag: "France"`, or its ISO code - is planned as its flag's picture, or the page is refused
  // with the nearest names a flag is drawn for.
  planFlags(slide, id);
  planPictureKinds(slide, id);
  for (const ex of exhibitsOf(slide)) readableCategories(ex);
  const primary = slide.exhibit ?? slide.exhibits?.[0];
  return { slide, target, exhibits, setType, primary };
}

/** The exhibits' data: the keys each one's form reads, and the limits on its marks and on the form's. */
function checkExhibitData({ page, id, slide, exhibits, primary, adjusted }) {
  // The exhibit carries the data its form reads, named before the build has to.
  for (const ex of exhibitsOf(slide)) {
    const keys = CONSTRUCTION_DATA[ex.type] ? [] : dataKeys(ex.type, { variant: ex.variant });
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
  // An icon over a chart's heading (`headingIcon`, registry-chart-title.mjs) names the panel by its picture before its
  // words. It needs a heading to stand over - a table heads its columns with `columns[].headerIcon` - and panels side
  // by side share one heading band, so an icon over one heading and not the next sets their headings at two heights.
  // The unit prints beside the heading: a heading that already says it reads it twice - "Fuel burn for the same job,
  // 777F = 100, index (777F = 100)" on the A350F deck.
  for (const ex of exhibitsOf(slide)) {
    const heading = String(ex.heading ?? ""), unit = typeof ex.unit === "string" ? ex.unit : "";
    const plain = (text) => text.toLowerCase().replace(/[^a-z0-9%$£€=]+/g, " ").trim();
    const parts = [unit, ...[...unit.matchAll(/\(([^)]+)\)/g)].map((m) => m[1])].map(plain).filter((part) => part.includes(" ") || part.includes("="));
    const repeated = parts.find((part) => ` ${plain(heading)} `.includes(` ${part} `));
    if (heading && repeated) throw new Error(`HEADING_REPEATS_UNIT: ${id}: the heading "${heading}" already says "${repeated}", and the unit "${unit}" prints beside it; say it once - in \`unit\`, and the heading names the measure`);
  }
  const iconed = exhibitsOf(slide).filter((ex) => ex.headingIcon !== undefined);
  for (const ex of iconed) {
    if (!String(ex.type ?? "").startsWith("chart.")) throw new Error(`${id}: \`headingIcon\` stands over a chart's heading, and a ${ex.type} exhibit draws none${ex.type === "table" ? "; a table sets an icon over a column's header as `columns[].headerIcon`" : ""}`);
    if (!String(ex.heading ?? "").trim()) throw new Error(`${id}: \`headingIcon\` stands over the chart's heading, and this chart has none; give it a \`heading\`, or drop the icon`);
    if (!iconDefinition(ex.headingIcon)) throw new Error(`${id}: ${unknownIcon(ex.headingIcon, "heading icon")}`);
  }
  if (iconed.length && iconed.length < exhibitsOf(slide).length)
    throw new Error(`${id}: ${iconed.length} of ${exhibitsOf(slide).length} panels carry a \`headingIcon\`; panels side by side share one heading band, so every one carries an icon or none does`);
  const formLimit = primary && LIMITS[`${page.type}/${page.form}`];
  if (formLimit) {
    const n = Array.isArray(primary[formLimit.key]) ? primary[formLimit.key].length : 0;
    if (n < formLimit.min || n > formLimit.max) throw new Error(`${id}: form "${page.form}" holds ${formLimit.min} to ${formLimit.max} ${formLimit.key}; this one has ${n}`);
  }
  if (primary) formExhibit(id, page, primary, adjusted);
  const shape = primary && FORM_SHAPE[`${page.type}/${page.form}`]?.(primary);
  if (typeof shape === "string") throw new Error(`${id}: ${shape}`);
  if (page.type === "numbers" && page.form === "metric-strip" && exhibits.length !== 1) throw new Error(`${id}: a metric strip sits over one exhibit`);
}

/** The table or the rows the page's type is built from, typed as the composer draws them; a total row left blank is refused. */
function typedEvidence({ page, id, type, slide, exhibits, primary }) {
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
  const tables = [...exhibits, ...(page.blocks || []).map((block) => block?.exhibit).filter(Boolean)].filter(isTable);
  const total = [...tables.map((ex) => ex.rows), ...(type.rows ? [page.rows] : [])].map(blankTotal).find(Boolean);
  if (total) throw new Error(`${id}: TOTAL_ROW_BLANK - the row "${total.label}" is styled as a total with no value in any result cell; give it its total, or drop the row`);
}

// The commentary a side title leaves room for: the panel takes a third of the
// width, so the body is one exhibit carrying its own explanation.
const SIDE_TITLE_COMMENTARY = ["none", "on-exhibit", "in-exhibit"];
/** The commentary the page carries, against what its `commentary` choice says it carries. */
function checkCommentary({ page, id, slide, exhibits, primary, players, adjusted }) {
  if (page.titlePlacement !== undefined && !["top", "side"].includes(page.titlePlacement))
    throw new Error(`${id}: \`titlePlacement\` is "top" (the default) or "side" (got ${JSON.stringify(page.titlePlacement)})`);
  if (page.titleNumeral !== undefined && page.titlePlacement !== "side") throw new Error(`${id}: \`titleNumeral\` is the figure set over a side title - it needs \`titlePlacement: "side"\``);
  if (page.titlePlacement === "side") {
    if (exhibits.length !== 1 || !SIDE_TITLE_COMMENTARY.includes(page.commentary))
      throw new Error(`${id}: a side title takes a third of the page's width, so the body beside it is one exhibit carrying its own explanation - commentary ${SIDE_TITLE_COMMENTARY.map((c) => `"${c}"`).join(", ")} (this page has ${exhibits.length} exhibit${exhibits.length === 1 ? "" : "s"} and "${page.commentary}")`);
    if (page.titleNumeral !== undefined && !(typeof page.titleNumeral === "string" && /\d/.test(page.titleNumeral) && page.titleNumeral.trim().split(/\s+/).length <= 2))
      throw new Error(`${id}: \`titleNumeral\` is the finding's figure ("47%", "£2.1bn"), a word or two at most; the words go in the title`);
  }
  // Points the placement does not draw are set aside, and the author told.
  const textless = ["on-exhibit", "in-exhibit", "captions", "none"].includes(page.commentary);
  if ((page.points || []).length && (page.commentary === "so-what-bar" || (textless && page.type !== "summary"))) {
    adjusted.push(`points set aside: commentary "${page.commentary}" draws none - choose "beside" or "below" to set them`);
    delete slide.points;
  }
  const points = (slide.points || []).length;
  // A highlight phrase is set in the accent wherever the page writes it (accentTexts); one written nowhere an accent is
  // drawn is set aside. Found as whole words, so "22" does not light half of "FY22".
  const written = accentTexts({ ...page, points: slide.points });
  const asked = (Array.isArray(page.highlight) ? page.highlight : page.highlight ? [page.highlight] : []).map(String);
  const kept = asked.filter((p) => p && written.some((text) => hasPhrase(text, p, { ignoreCase: true })));
  if (kept.length < asked.length) {
    const stray = asked.filter((p) => !kept.includes(p));
    adjusted.push(`highlight ${stray.map((p) => `"${p}"`).join(", ")} set aside: the page writes ${stray.length === 1 ? "it" : "them"} nowhere an accent is drawn (its points, paragraphs, rail, bar, takeaway, captions or table cells)`);
    if (kept.length) slide.highlight = kept; else delete slide.highlight;
  }
  const phrases = kept.map((p) => p.toLowerCase());
  // A declared player's name is a name, whatever digits it holds: a point's figure is never read off "Opus 5.5".
  const names = [...playerNames(players).keys()].filter((name) => /\d/.test(name));
  const figureOf = (text) => pointFigure(names.reduce((said, name) => said.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (found) => " ".repeat(found.length)), String(text)));
  const pointTexts = (slide.points || []).map((point) => (typeof point === "string" ? point : `${point?.lead ?? ""} ${point?.text ?? ""}`).toLowerCase());
  // A point the author left unmarked is marked on its own figure.
  if (points >= 2 && ["beside", "beside-left", "below"].includes(page.commentary)) {
    const derived = [];
    (slide.points || []).forEach((point, at) => {
      if ((point && typeof point === "object" && point.highlight) || phrases.some((p) => p && hasPhrase(pointTexts[at], p))) return;
      const figure = figureOf(typeof point === "string" ? point : `${point?.lead ?? ""} ${point?.text ?? ""}`);
      if (figure) derived.push(figure);
    });
    if (derived.length) slide.highlight = [...kept, ...derived];
  }
  // A paragraph carries its colour as a point does: one that none of the
  // page's phrases lands in is marked on its own figure.
  if ((page.paragraphs || []).length >= 2) {
    const prose = page.paragraphs.filter((p) => !(p && typeof p === "object" && p.highlight)).map((p) => proseParts(p).text);
    const derived = prose.filter((text) => !phrases.some((p) => p && hasPhrase(text.toLowerCase(), p))).map(figureOf).filter(Boolean);
    const marked = slide.highlight === undefined ? [] : Array.isArray(slide.highlight) ? slide.highlight : [slide.highlight];
    if (derived.length) slide.highlight = [...marked, ...derived];
  }
  if (Array.isArray(page.paragraphs)) slide.paragraphs = page.paragraphs.map((p, at) => {
    if (!p || typeof p !== "object" || p.highlight === undefined) return p;
    const parts = proseParts(p);
    const held = parts.highlight.filter((phrase) => [parts.lead, parts.text].some((text) => hasPhrase(text, phrase, { ignoreCase: true })));
    if (held.length === parts.highlight.length) return p;
    adjusted.push(`paragraph ${at + 1}'s highlight ${parts.highlight.filter((h) => !held.includes(h)).map((h) => `"${h}"`).join(", ")} set aside: it is not in the paragraph's lead or text`);
    const { highlight: _set, ...rest } = p;
    return held.length ? { ...rest, highlight: held } : rest;
  });
  if (["beside", "beside-left", "below"].includes(page.commentary) && !points && !page.paragraphs)
    throw new Error(`${id}: commentary "${page.commentary}" places points beside or below the exhibit, and the page has none - give it \`points\`, or leave \`commentary\` out`);
  if (page.commentary === "captions") {
    const bare = exhibits.filter((e) => !(typeof e.caption === "string" && e.caption.trim()));
    if (page.type === "picture" ? !(page.pictures || []).every((p) => p.label || p.line) : bare.length)
      throw new Error(`${id}: commentary "captions" puts one finding under each panel - every exhibit needs its \`caption\``);
  }
  if (page.commentary === "on-exhibit" && primary?.type?.startsWith("chart.")) {
    // Each callout is measured the way the chart will set it: a box that holds
    // two lines, so a paragraph belongs in two callouts or beside the chart.
    const long = (primary.annotations || []).filter((a) => !calloutFits(a.text));
    if (long.length) throw new Error(`${id}: ${long.length} callout${long.length === 1 ? " is" : "s are"} too long for the chart's callout box ("${long[0].text}"); a callout holds about ${countInWords(calloutCapacity())} words - split it, or choose "beside" for the argument`);
  }
  if (page.commentary === "rail") {
    if (typeof page.rail !== "string" || !page.rail.trim()) throw new Error(`${id}: commentary "rail" sets one claim in the side panel - write it as \`rail\``);
    if (!railFits(page.rail)) throw new Error(`${id}: the rail runs past its eight lines (about ${railCapacity()} words); it is the page's one claim - cut it, or choose "beside" for an argument`);
    slide.panel = { text: page.rail.trim() };
  }
  if (page.commentary === "so-what-bar") {
    if (typeof page.bar !== "string" || !page.bar.trim()) throw new Error(`${id}: commentary "so-what-bar" closes the page on the implication - write it as \`bar\``);
    if (!barFits(page.bar)) throw new Error(`${id}: the so-what bar runs past its two lines; it is one implication - cut it, or choose "beside" for an argument`);
    slide.soWhat = { text: page.bar.trim(), style: "bar" };
  }
  return { points };
}

// A dashboard's grid: four tracks across and three down at most, and, under a strip of figures, two down - each cell needs the
// height a chart's heading and a readable plot take (chart-axes.mjs MIN_PLOT_HEIGHT).
export const DASHBOARD = Object.freeze({ columns: 4, rows: 3, rowsUnderStrip: 2, metrics: 6 });
const tracks = (spec, name, id, most) => {
  const list = Number.isInteger(spec) ? Array.from({ length: spec }, () => 1) : spec;
  if (!Array.isArray(list) || !list.length || list.length > most || list.some((w) => !(Number.isFinite(w) && w > 0)))
    throw new Error(`${id}: a dashboard's grid.${name} is how many tracks run that way (1 to ${most}) or their widths as weights - [2, 1, 1]`);
  return list;
};
/**
 * A dashboard's grid, checked against its exhibits: the column and row
 * tracks, and each exhibit's area on them (1-based, spans of tracks). An
 * exhibit with no `area` takes the next free cell in reading order. Areas
 * overlap nowhere, and every exhibit names what its cell shows (`heading`).
 */
function dashboardGrid(page, id, exhibits) {
  const metrics = Array.isArray(page.metrics) ? page.metrics.length : 0;
  if (metrics && (metrics < 2 || metrics > DASHBOARD.metrics)) throw new Error(`${id}: a dashboard's strip of figures holds 2 to ${DASHBOARD.metrics} metrics (this has ${metrics})`);
  const given = page.grid ?? {};
  if (typeof given !== "object") throw new Error(`${id}: grid is { columns, rows }`);
  const unplaced = exhibits.filter((ex) => !ex.area).length;
  const columns = tracks(given.columns ?? Math.min(DASHBOARD.columns, Math.max(2, Math.ceil(exhibits.length / 2))), "columns", id, DASHBOARD.columns);
  const most = metrics ? DASHBOARD.rowsUnderStrip : DASHBOARD.rows;
  const asked = Array.isArray(given.rows) ? given.rows.length : given.rows;
  if (metrics && asked > DASHBOARD.rowsUnderStrip) throw new Error(`${id}: under a strip of figures a dashboard holds ${DASHBOARD.rowsUnderStrip} rows; three leave each cell under the height a chart needs - drop a row, or move the figures into a cell`);
  const rows = tracks(given.rows ?? Math.min(most, Math.ceil(exhibits.length / columns.length)), "rows", id, most);
  const taken = new Set(), placed = [];
  const claim = (column, row, columnSpan, rowSpan, at) => {
    for (let c = column; c < column + columnSpan; c += 1) for (let r = row; r < row + rowSpan; r += 1) {
      const key = `${c},${r}`;
      if (taken.has(key)) throw new Error(`${id}: exhibit ${at + 1}'s area overlaps another's at column ${c + 1}, row ${r + 1}`);
      taken.add(key);
    }
  };
  exhibits.forEach((ex, at) => {
    if (!(typeof ex.heading === "string" && ex.heading.trim()) && !(typeof ex.panelHeading === "string" && ex.panelHeading.trim()))
      throw new Error(`${id}: every cell of a dashboard names what it shows - exhibit ${at + 1} (${ex.type ?? "untyped"}) has no \`heading\``);
    if (!ex.area) return;
    const { column, row, columnSpan = 1, rowSpan = 1 } = ex.area;
    const ok = [column, row, columnSpan, rowSpan].every(Number.isInteger) && column >= 1 && row >= 1 && columnSpan >= 1 && rowSpan >= 1
      && column - 1 + columnSpan <= columns.length && row - 1 + rowSpan <= rows.length;
    if (!ok) throw new Error(`${id}: exhibit ${at + 1}'s area { column, row, columnSpan, rowSpan } counts tracks from 1 and stays inside the ${columns.length} by ${rows.length} grid (got ${JSON.stringify(ex.area)})`);
    claim(column - 1, row - 1, columnSpan, rowSpan, at);
    placed[at] = { column: column - 1, row: row - 1, columnSpan, rowSpan };
  });
  // The rest fill the free cells in reading order, a cell each.
  const free = [];
  for (let r = 0; r < rows.length; r += 1) for (let c = 0; c < columns.length; c += 1) if (!taken.has(`${c},${r}`)) free.push({ column: c, row: r, columnSpan: 1, rowSpan: 1 });
  if (unplaced > free.length) throw new Error(`${id}: ${unplaced} exhibits have no area and the ${columns.length} by ${rows.length} grid has ${free.length} free cells; widen the grid or give each an area`);
  exhibits.forEach((ex, at) => { if (!placed[at]) placed[at] = free.shift(); });
  return { columns, rows, areas: placed };
}

/** The layout the commentary and the form ask for, and each type's own arrangement of the slide. */
function layOutPage({ page, id, type, slide, target, exhibits, setType, primary, points, adjusted }) {
  const layoutFor = { beside: "exhibit-left", "beside-left": "exhibit-right", below: "exhibit-top", rail: "sidebar" };
  if (page.type === "panels" && page.form === "dashboard") {
    slide.arrange = "dashboard";
    slide.grid = dashboardGrid(page, id, exhibits);
    if (page.exhibit) { slide.exhibits = [page.exhibit, ...(page.exhibits || [])]; delete slide.exhibit; }
  } else if (trellisPage(page.type, page.form)) {
    // A trellis is one chart, set as a chart is: beside its commentary, over it, or across the page.
    slide.layout = layoutFor[page.commentary] ?? "exhibit-full";
  } else if (page.type === "panels") {
    // Two panels are a row: a grid of two would leave its second row empty.
    if (page.form === "grid" && exhibits.length < 3) adjusted.push("grid set as a row: two panels fill one row");
    if (page.form === "sequence") {
      const { min, max } = LIMITS.sequence;
      if (exhibits.length < min || exhibits.length > max) throw new Error(`${id}: a sequence reads left to right in ${min} to ${max} steps; this one has ${exhibits.length} - four are a grid, or a process diagram`);
      // The arrow says "this leads to that"; each step names what it is, or the
      // reader cannot say what led to what.
      const unnamed = exhibits.filter((ex) => !(typeof ex.heading === "string" && ex.heading.trim()));
      if (unnamed.length) throw new Error(`${id}: every step of a sequence carries its \`heading\` - the cause, the change, the result; ${unnamed.length} ${unnamed.length === 1 ? "has" : "have"} none`);
    }
    if (page.form === "breakout") {
      slide.breakout = breakoutOf(page, id, exhibits);
      // The fan is drawn on the marks as the deck draws them; a native chart
      // is laid out by PowerPoint, and its bars would move off the lines.
      for (const ex of exhibits) ex.native = false;
      // The mark broken out is the overview's subject: lit, unless the author marked it.
      const overview = exhibits[slide.breakout.from.exhibit];
      if (!markedChart(overview) && (overview.series || []).length === 1) overview.highlights = [{ category: slide.breakout.from.category }];
    }
    else if (page.breakout !== undefined) throw new Error(`${id}: \`breakout\` fans a mark out to the panel that splits it - it belongs to panels form "breakout"`);
    if (page.spread !== undefined) {
      if (!["row", "breakout"].includes(page.form)) throw new Error(`${id}: \`spread\` names the gap between marks in two panels of a row - panels form "row"`);
      slide.spread = spreadOf(page, id, exhibits);
      for (const at of [slide.spread.from.exhibit, slide.spread.to.exhibit]) exhibits[at].native = false;
    }
    slide.arrange = page.form === "grid" && exhibits.length < 3 ? "row" : page.form;
    if (page.exhibit) { slide.exhibits = [page.exhibit, ...(page.exhibits || [])]; delete slide.exhibit; }
  } else if (page.type === "numbers") {
    if (page.form === "hero-number") { if (!page.kpi) throw new Error(`${id}: a hero-number page names its number as \`kpi\``); slide.layout = "hero-number"; }
    else if (page.form === "metric-strip") { if (!(page.metrics || []).length) throw new Error(`${id}: a metric strip carries \`metrics\``); slide.layout = "metrics-over-exhibit"; }
    else slide.layout = layoutFor[page.commentary] ?? "exhibit-full";
  } else if (page.type === "picture") {
    slide.layout = page.form === "device" ? layoutFor[page.commentary] ?? "exhibit-full" : target;
  } else if (page.type === "parallel" && page.form === "labelled-rows") {
    slide.layout = target;
  } else if (page.type === "options") {
    if (page.form === "compare") setType(primary, "compare");
    else slide.layout = target;
  } else if (page.type === "argument") {
    if (!(page.paragraphs || []).length && !points) throw new Error(`${id}: an argument page carries its \`paragraphs\``);
    slide.layout = target;
    if (page.form === "sidebar" && !page.panel) throw new Error(`${id}: a sidebar argument sets its claim in \`panel\``);
  } else if (page.type === "statement") {
    if (page.form === "statement") {
      slide.kind = "statement"; if (!page.text) throw new Error(`${id}: a statement page carries its \`text\``);
      // A statement page is its sentence: an exhibit written with it was dropped without a word.
      if (exhibits.length) throw new Error(`${id}: a statement page is its one sentence, and draws no exhibit - set the evidence on its own page, or put a photograph behind the sentence as \`image\``);
    }
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

  const halved = exhibitsOf(slide).filter((ex) => ex?.split === "halves");
  if (halved.length) slide.layout = halvesLayout(page, id, slide, halved);

  // A statement or takeaways page has no title band to hang a standfirst in.
  if (slide.kind && page.subtitle !== undefined) throw new Error(`${id}: a ${page.form} page has no title band, so it takes no \`subtitle\`; put the scope in its text`);
}

/**
 * The layout of a page whose table is asked to be set in halves (`split:
 * "halves"`): two panels across the page, the header repeated, read top-left
 * to bottom-right, and the commentary under them. A ranking of twenty cities
 * with its points could be neither one table (it split across two slides) nor
 * two of ten (TABLE_PANELS_MERGE). Where the table cannot be halved, or the
 * page leaves it no width to halve in, the refusal says why.
 */
function halvesLayout(page, id, slide, halved) {
  const exhibits = exhibitsOf(slide);
  const other = halved.find((ex) => ex.type !== "table");
  if (other) throw new Error(`${id}: \`split: "halves"\` sets a table in two panels side by side, and a ${other.type} is not halved${String(other.type).startsWith("chart.") ? "; `split: true` sets a chart's series as small multiples" : ""}`);
  if (exhibits.length !== 1) throw new Error(`${id}: a table in halves takes the page's width as its one exhibit, and this page carries ${exhibits.length}; set the other evidence on its own page`);
  if (!["exhibit-full", "exhibit-top"].includes(slide.layout))
    throw new Error(`${id}: a table in halves takes the page's width, and ${slide.layout ? `commentary "${page.commentary}" sets it beside a column` : `a ${page.type}/${page.form} page lays its table out itself`}; choose commentary "below", "so-what-bar" or "none" for the halves, or drop \`split\``);
  const problems = halvesProblems(halved[0], { asked: true });
  if (problems.length) throw new Error(`${id}: the table cannot be set in halves (\`split: "halves"\`) - ${problems.join("; ")}. Drop \`split\` and the table is set whole, stepping down its density to fit`);
  return "table-halves";
}

/** The page's `pageType` record: its choices, what the compiler adjusted, and the claim the title makes. */
function withPageType({ page, slide, adjusted }) {
  if (typeof page.takeaway === "string") slide.soWhat = page.takeaway.trim();
  const evidence = Array.isArray(page.evidence) ? page.evidence : [];
  slide.pageType = { type: page.type, form: page.form, commentary: page.commentary, takeaway: typeof page.takeaway === "string",
    ...(page.series ? { series: String(page.series) } : {}),
    ...(page.sourceSlide !== undefined ? { sourceSlide: page.sourceSlide } : {}), ...(Array.isArray(page.only) && page.only.length ? { only: page.only.map(String) } : {}),
    ...(adjusted.length ? { advisories: adjusted.map((note) => `PAGE_ADJUSTED: ${note}`) } : {}),
    content: { claim: String(page.title ?? page.text ?? "").trim(), ...(evidence.length ? { evidence } : {}) } };
  return slide;
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

/** How many words of ordinary prose a chart callout holds, by the renderer's own measure (chart-annotations.mjs). */
export { calloutCapacity };

/** How many words of ordinary prose the rail's panel holds, by the renderer's own measure. */
export function railCapacity() {
  const words = "the operator added capacity on the busiest routes before demand returned in full".split(" ");
  let n = 1;
  while (n < 120 && railFits(Array.from({ length: n + 1 }, (_, i) => words[i % words.length]).join(" "))) n += 1;
  return n;
}

/** The catalogue as the author reads it. */
export function describeTypes() {
  const lines = ["# Page types", "",
    "Every analytical page is one of these. `type` is required; `form` defaults to the type's first, and `commentary` to the placement the page's own text asks for (a `rail`, a `bar`, a caption on every panel, callouts on the chart), else none. Points over a chart or a table go where the page says (`beside`, `below`), and most pages carry the point on the exhibit instead: a callout on the chart, an implication column in the table.", "",
    "`commentary` - where the explanation lives:", ...Object.entries(COMMENTARY).map(([k, v]) => `- \`${k}\`: ${v}`), "",
    `\`takeaway\` - optional: the closing sentence, ${TEXT_LIMITS.takeawayLines} lines; absent, the page closes on its exhibit.`, "",
    "`bar` - with commentary `so-what-bar`, the implication in a filled bar across the foot of the exhibit, two lines at most.", "",
    "`subtitle` - optional, and left out unless the deck the user gave as the style to follow sets a line under its titles: one line naming what the title leaves out - the measure and unit, the population, the period or the scope. Without one, the exhibit's heading carries the measure and unit.", "",
    "Numbers by reference - where the insight log records measures, a page names the measure and the runtime writes the number: an exhibit's `series: [{ measure: \"<insight id>/<measure>\", name }]` takes its categories, values, unit and basis from the measures; a metric, a `kpi`, a row block's `metric` or a fact-grid item is `{ measure, format, label }`; and `{{<insight id>/<measure>@<period or member> | 0.0}}` in any text prints that number. A number typed into text is traced to the measures the page rests on (NUMBER_UNTRACED, advised).", "",
    "`source` - the citation as text, or a list of keys into the pages file's `sources` registry (`{ key: { name, short, url, status, date } }`), fitted by the runtime to the footer, the full list kept in the speaker notes.", "",
    "`highlight` - the phrase from each point the reader should see first; a point left unmarked is marked on its first quantity with a unit or currency (a bare count is left unmarked). A phrase the page writes nowhere an accent is drawn is set aside.", "",
    "`better` - on a metric, a table column, row or trend cell: the direction that is good news, \"up\" (the default) or \"down\" (a cost, churn, a wait).", "",
    "Refused at compile only where a page cannot be drawn: an unknown type, form, key or icon; data its form cannot read; more than its frame holds (the limits below); a total row left blank (TOTAL_ROW_BLANK). Fields a placement does not draw, callouts a form has no room for and a highlight that lands nowhere are set aside, and the page's advisories say so (PAGE_ADJUSTED).", "",
    `Capacities: a chart callout holds about ${calloutCapacity()} words and a chart ${CALLOUTS_MAX} callouts (a bridge over commentary \`below\`, ${WATERFALL_BELOW_CALLOUTS}); a rail about ${railCapacity()} words; a stat-list value 9 characters and a fact-grid value 10. A fact-grid takes \`columns\` (1 to 4 tiles across; a single column never stretches) and, on any item, \`gauge\` (0 to 1, a bar on the tile's foot). Commentary \`below\` runs up to three points across, four two by two, more three to a row.`, "",
    `Icons (a point's, a card's, a row label's \`icon\`): ${ICON_NAMES.join(", ")}. \`author-deck --icons\` lists the other words each answers to.`, "",
    "`node runtime/author-deck.mjs --example <type>` prints a worked page of any type; `--scaffold <type>` prints a page of that type that compiles, to fill in.", ""];
  // `reference` rebuilds a supplied slide image as native elements; it is not a page a deck is written with.
  for (const [name, t] of Object.entries(PAGE_TYPES).filter(([name]) => name !== "reference")) {
    const n = (Array.isArray(t.exhibits) ? `${t.exhibits[0]}-${t.exhibits[1]}` : t.exhibits) + Object.keys(t.forms).filter((form) => FORM_EXHIBITS[`${name}/${form}`] !== undefined).map((form) => ` (form ${form}: ${exhibitRange(name, form).join("-").replace(/^(\d+)-\1$/, "$1")})`).join("");
    const data = Object.entries(t.forms).map(([form, target]) => [form, dataKeys(target, { type: name, form })]).filter(([, keys]) => keys.length);
    const sparing = Object.keys(t.forms).filter((form) => SPARING_FORMS[`${name}/${form}`]);
    lines.push(`## ${name}`, t.task, "", `- form: ${Object.keys(t.forms).filter((form) => !sparing.includes(form)).join(" | ")}`,
      ...(sparing.length ? [`- use sparingly: ${sparing.map((form) => `${form} - ${SPARING_FORMS[`${name}/${form}`]}`).join("; ")}`] : []),
      ...(() => { const limits = Object.entries(t.forms).map(([form, target]) => [form, limitOf(name, form, target)]).filter(([, l]) => l);
        return limits.length ? [`- holds: ${limits.map(([form, l]) => `${form} ${l.min}${l.max ? `-${l.max}` : "+"} ${l.key}${l.valueChars ? ` (values ${l.valueChars} characters at most)` : ""}${l.columns ? ` (\`columns\` 1-${l.columns}, or left out)` : ""}`).join("; ")}`] : []; })(),
      ...(data.length ? [`- data: ${[...data.reduce((m, [form, keys]) => m.set(keys.join(", "), [...(m.get(keys.join(", ")) || []), form]), new Map())]
        .map(([keys, forms]) => forms.length === data.length ? keys : `${keys} (${forms.join(", ")})`).join("; ")}`] : []), `- commentary: ${t.commentary.join(" | ")}${Object.keys(t.forms).filter((form) => FORM_COMMENTARY[`${name}/${form}`])
        .map((form) => `; form ${form} takes ${FORM_COMMENTARY[`${name}/${form}`].join(" | ")}`).join("")}`, `- exhibits: ${n}` + (t.rows ? "; `rows` with `cells`" : ""), "");
  }
  return lines.join("\n");
}

// Forms strong decks seldom use, listed after the rest with the case each earns its place in. Listed alike, they were
// reached for as readily as bars and tables: the Spacebar deck's two weakest pages were a treemap of near-equal weights and
// a row of capsules.
const SPARING_FORMS = Object.freeze({
  "composition/treemap": "six or more parts whose sizes differ several-fold, too many for bars; near-equal parts are refused",
  "composition/marimekko": "a mix that differs between members whose own sizes differ too, both read at once",
  "composition/waffle": "one or two shares the reader should count out of a hundred",
  "composition/pictogram": "a share of people or things the reader should picture - 1 in 5",
  "composition/radial-bars": "a few items' progress toward one full mark",
  "relationship/bubble-grid": "a third measure read across rows and columns at once",
  "mechanism/sankey": "flows between stages whose sizes are the point",
  "mechanism/venn": "an overlap between two or three sets that is itself the finding",
  "parallel/capsules": "two to five priorities that each stand as a column with a sentence; cards or labelled rows say the same with less ink",
});

// Which way a measure is good news: a delta or a trend arrow is coloured by
// it. On a metric, a table column (every trend cell under it), a row, or a cell.
const POLARITY_SCHEMA = { enum: [...POLARITIES], default: "up", description: "the direction that is good news for this measure: \"up\" (revenue, share, retention) or \"down\" (a cost, churn, a wait); a delta or trend arrow is coloured by it, not by its sign" };
const METRIC_SCHEMA = { type: "object", anyOf: [{ required: ["value"] }, { required: ["measure"] }], properties: { value: { type: ["string", "number"] }, label: { type: "string" }, sublabel: { type: "string" },
  measure: { type: "string", description: "in place of `value`: the number to print, by reference - \"<insight id>/<measure>\", with \"@<period or member>\" for one value of a longer measure; the runtime writes `value` in the `format`" },
  format: { type: "string", description: "how a `measure` is printed: the digits as 0, 0.0 or 0,0 with what is printed round them (\"+0.0%\", \"CHF 0.0bn\"), then `| abs`, `| /1000` or `| x100`" },
  delta: { type: "string", description: "the signed change, \"+8 pts\" or \"-3%\"; green or red by `better`" }, better: POLARITY_SCHEMA } };

// The exhibit each many-value form reads, for a harness that generates to the schema.
const FORM_SCHEMA = {
  "trend/indexed": { type: "object", required: ["categories", "series"],
    properties: { series: { type: "array", minItems: LIMITS["trend/indexed"].min, maxItems: LIMITS["trend/indexed"].max }, indexBase: { type: "string" }, subject: { type: "string" } } },
  "ranking/distribution": { type: "object", required: ["categories", "series"],
    properties: { categories: { type: "array", minItems: LIMITS["ranking/distribution"].min, maxItems: LIMITS["ranking/distribution"].max }, series: { type: "array", minItems: 1, maxItems: 1 } } },
  "ranking/aligned-bars": { type: "object", required: ["categories", "series"],
    properties: { series: { type: "array", minItems: LIMITS["ranking/aligned-bars"].min, maxItems: LIMITS["ranking/aligned-bars"].max,
      items: { type: "object", required: ["name", "values"], properties: { name: { type: "string" }, unit: { type: "string" }, values: { type: "array" } } } } } },
};

/**
 * A JSON Schema for a typed page, for harnesses that validate or constrain
 * generation: the pages file, or with `only` the page schema of one type.
 */
export function pageSchema(only = null) {
  if (only === "reference") return REFERENCE_SCHEMA;
  if (only !== null && !PAGE_TYPES[only]) throw new Error(`unknown page type "${only}"; one of ${Object.keys(PAGE_TYPES).join(", ")}`);
  // Any page, typed or structural, may be hidden.
  const hidden = { type: "boolean", description: "true keeps the slide in the file but out of the slide show (PowerPoint's Hide Slide); it is still rendered and reviewed. An imported hidden slide's page carries it, and a page composed where a hidden slide stood is hidden without it; false shows the slide again" };
  const typed = Object.entries(PAGE_TYPES).filter(([name]) => only === null || name === only).map(([name, t]) => name === "reference" ? REFERENCE_SCHEMA : ({
    type: "object",
    required: ["id", "type", "title"],
    properties: {
      id: { type: "string" }, type: { const: name }, title: { type: "string" },
      subtitle: { type: "string", description: "optional standfirst under the title, left out unless the reference deck sets one: the measure and unit, the population, the period or the scope, in one line" },
      form: { enum: Object.keys(t.forms), default: Object.keys(t.forms)[0] }, commentary: { enum: [...new Set([...t.commentary, ...Object.keys(t.forms).flatMap((form) => FORM_COMMENTARY[`${name}/${form}`] || [])])] },
      takeaway: { oneOf: [{ const: false }, { type: "string", minLength: 8 }], description: `optional closing sentence, ${TEXT_LIMITS.takeawayLines} lines at most; absent or false, the page closes on its exhibit` },
      source: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" }, minItems: 1 }], description: "the citation as text, or keys of the pages file's `sources` registry" },
      series: { type: "string" }, rail: { type: "string" },
      bar: { type: "string", description: "with commentary so-what-bar: the implication in a filled bar under the exhibit, two lines at most" },
      ...(t.forms["labelled-rows"] ? { blocks: { type: "array", minItems: 1, maxItems: 5, description: "form labelled-rows: the rows down the page", items: {
        type: "object", required: ["label", "points"], additionalProperties: false,
        properties: { label: { type: "string" }, points: { type: "array", maxItems: 4 },
          metric: { ...METRIC_SCHEMA, required: ["label"] }, exhibit: { type: "object", required: ["type"] } } } } } : {}),
      ...(name === "numbers" ? { metrics: { type: "array", items: METRIC_SCHEMA, description: "form metric-strip: the figures across the top" }, kpi: { ...METRIC_SCHEMA, description: "form hero-number: the one figure" } } : {}),
      ...(t.table ? { exhibit: { type: "object", properties: {
        columns: { type: "array", items: { oneOf: [{ type: "string" }, { type: "object", properties: { better: POLARITY_SCHEMA } }] } },
        rows: { type: "array", items: { oneOf: [{ type: "array" }, { type: "object", properties: { better: POLARITY_SCHEMA } }] } } } } } : {}),
      evidence: { type: "array", items: { type: "string" }, description: "optional: insight ids from <id>.insights.json the page rests on; a number typed on the page is traced to their measures" },
      tone: { enum: GROUNDS, description: "the page's ground: dark (the house's own dark) or primary (a field of its primary) sets this page apart, every colour derived for it; light keeps a page light in a deck whose `tone` is dark" },
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
