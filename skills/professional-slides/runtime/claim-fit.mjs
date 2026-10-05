// Which form carries which claim.
//
// A page's form is chosen because it fits what the page claims, never to make
// a deck look varied. That choice was written down in prose (references/
// design.md, "Pick the page type from what the page says") and nowhere a
// program could read it, so everything that proposes a form - the plan, a
// scaffold, the estimate of an exhibit nobody has written - took the type's
// first form, or a line for anything over periods and a bar for anything over
// members. Three decks written from one brief by three authors then drew the
// same four kinds for two thirds of their exhibits, most of them on pages
// whose form leaves the kind to the author (panels, a metric strip's chart).
//
// This module is that choice as data, in one table:
//
//   READING_TASKS  what a reader is asked to do with the measures a page
//                  shows - read a change between two points, a trend over many
//                  periods, a rank in a peer set, a part of a whole - each told
//                  from the measures themselves (taskOf): the axis they run
//                  over, how many periods or members the page shows, how many
//                  series, their units, and what the insight log says of them
//                  (a mix, a bridge, a threshold, an analysis's result).
//   CARRIERS       every form of every page type, with the exhibit it draws,
//                  the tasks it carries and how well (directly, or with the
//                  reader doing work), and the data it needs to be drawn.
//
// For a page - its type, `settles`, the measures it shows and the insights it
// rests on - pageFit gives the forms of its type that carry its claim, graded,
// and the same for each exhibit whose kind its form leaves open. The plan
// (deck-structure.mjs), a scaffold and the fit search read it, the catalogue
// prints it (`--types`), and the deck's standing counts the pages drawn in a
// form that carries their claim less directly than another they could take.
//
// A form's judged content - the levels of a Harvey ball, the stages of a
// mechanism, which of two diagrams a system is - is not in any measure, so the
// table says what such a form is for (`shows`) and nothing here proposes or
// questions one: where no task can be read, there is no fit to rank by.
import { axisOf, isPercentUnit, normalUnit, valuesOf } from "./measures.mjs";
import { drawRank } from "./design-systems.mjs";

/**
 * The grades a form takes for a claim: `direct`, the best fit - the form shows
 * the very thing the reader is asked to read; `work`, it serves - the values
 * are there and the reader works the relation out; `none`, admissible to the
 * page type and weak - it draws the measures and not what the claim says of
 * them.
 */
export const GRADE = Object.freeze({ none: 0, work: 1, direct: 2 });
/** Each grade in words, by its number. */
export const FIT_WORDS = Object.freeze(["does not carry the claim", "carries it with the reader doing work", "carries it directly"]);
/** Each grade's name, by its number: what a plan, a scaffold and the catalogue call it. */
export const FIT_NAMES = Object.freeze(["weak", "serves", "best fit"]);

/** The reading tasks told from the measures a page shows. */
export const READING_TASKS = Object.freeze({
  trend: "how one measure, or up to four on one scale, moved over four or more periods",
  "many-series": "which of five or more series moved over the same periods",
  index: "how measures of different sizes or units moved against each other from a common base",
  "two-scales": "two measures in different units read over the same periods",
  "gap-over-time": "the gap between two series in one unit as it opens or closes over time",
  "target-over-time": "one measure against a threshold or target, period by period",
  pair: "two values in one unit for each member - before and after, or one measure against another",
  rank: "where each member of a set stands on one measure",
  distribution: "where the subject sits in a whole field of fifteen or more members",
  spread: "how far each member's own values run - its range, middle half and median",
  target: "each member against a target or threshold",
  profile: "several measures for the same members, each read on its own scale",
  relationship: "how two measures move together across the members",
  "part-of-whole": "what one whole is made of",
  "share-of-each": "a share of each of a few populations, each its own whole",
  "mix-compared": "how the mix of a whole differs between members or between two dates",
  "mix-over-time": "how the mix of a whole changes over time",
  contribution: "what a change between two totals is made of",
  lookup: "exact values a reader looks up and compares",
  figures: "a few numbers that carry the claim",
  cuts: "one question answered for two to four cuts side by side",
});

const D = GRADE.direct, W = GRADE.work;
const within = (n, lo, hi = Infinity) => n >= lo && n <= hi;
const need = (ok, why) => (ok ? null : why);
const first = (...reasons) => reasons.find(Boolean) ?? null;
// A page of a type needs what the type's compile asks - four periods of a trend, four members of a ranking; one exhibit among others needs two.
const least = (typed) => (typed ? 4 : 2);
const overPeriods = (p, least = 4) => first(need(p.axis === "periods", "measures that run over periods"), need(p.labels >= least, `${least} or more periods`));
const overMembers = (p, least = 4) => first(need(p.axis === "members", "measures that run over members"), need(p.labels >= least, `${least} or more members`));
const oneUnit = (p) => need(p.units === 1 || p.index, "measures in one unit");
const oneSeries = (p) => need(p.series === 1, "one measure");
const unsigned = (p) => need(!p.signed, "no negative value");
// A mark that stands on zero - a column, an area - shows a movement only where the movement is a visible part of the level:
// a fifth of the peak or more. Under that the columns are all one height, and a line, whose scale may start above zero, shows it.
const SWING = 0.2;
const stands = (p) => p.swing >= SWING;
// A gap is read as the space between two lines. Pairs of columns show it only where there are few enough pairs to compare
// height against height, pair by pair: six dates. Past that the columns are a fence, and the reader subtracts.
const FEW_DATES = 6;
// Two values a member: two measures over the members, or the members' series at two periods (drawn pivoted, bind.mjs).
const paired = (p) => (p.axis === "members" && p.series === 2 && p.units === 1) || (p.axis === "periods" && p.labels === 2 && p.units === 1 && p.series >= 2);
// The members of a pair, on whichever axis they sit.
const pairMembers = (p) => (p.axis === "members" ? p.labels : p.series);

/**
 * The catalogue's forms as carriers of a claim. Each row: the page type and
 * form, the exhibit kind the form draws (null for a page construction), and
 *
 *   carries  the reading tasks it carries, each a grade or a function of the
 *            page's profile returning one (GRADE.direct, GRADE.work, GRADE.none)
 *   needs    what the measures must supply for it to be drawn, as a function
 *            of the profile returning null or the lack, in words
 *   bound    how a page writes it from measures (bind.mjs), in a phrase
 *   shows    for a form whose content is the author's judgement or the
 *            subject's own shape, what the page has to show for it to be right
 *   alone    false for a form that is a construction of its page type and
 *            cannot stand as one exhibit among others on a panels page
 */
export const CARRIERS = Object.freeze([
  // --- trend ---------------------------------------------------------------
  { type: "trend", form: "line", kind: "chart.line", bound: "series: [{ measure }] over periods",
    // One scale holds about six lines a reader can tell apart, the subject in colour; past that each series is a small line of its own.
    carries: { trend: D, "gap-over-time": D, "target-over-time": D, index: (p) => (p.index ? D : W), "many-series": (p) => (p.series <= 6 && p.units === 1 ? D : W), "mix-over-time": W },
    needs: (p) => first(overPeriods(p), oneUnit(p)) },
  { type: "trend", form: "column", kind: "chart.column", bound: "series: [{ measure }] over periods",
    // Columns read period by period: up to twelve - a decade of years, a year of months - they are the levels themselves, past
    // that a trend drawn as unconnected bars. Two or three dates of a few members are paired columns: the levels at each date.
    carries: { trend: (p) => (p.labels <= 12 && p.series <= 2 && stands(p) ? D : W), "gap-over-time": (p) => (p.labels <= FEW_DATES && stands(p) ? D : W), "target-over-time": (p) => (p.labels <= 12 && stands(p) ? D : W), pair: (p) => (pairMembers(p) <= 3 ? D : W) },
    needs: (p, typed) => first(overPeriods(p, least(typed)), oneUnit(p), need(p.series <= 3, "three series at most")) },
  { type: "trend", form: "area", kind: "chart.area", bound: "series: [{ measure }] over periods",
    // An area is a volume standing on zero: one series of a quantity, not a rate, a share or an index.
    carries: { trend: (p) => (p.series === 1 && !p.signed && !p.percent && !p.index && stands(p) ? D : W), "target-over-time": W },
    needs: (p) => first(overPeriods(p), oneUnit(p), need(p.series <= 2, "one or two series")) },
  { type: "trend", form: "stacked-column", kind: "chart.stacked-column", bound: "series: [{ measure }], one a part, over periods",
    carries: { "mix-over-time": D }, needs: (p) => first(overPeriods(p), oneUnit(p), need(p.series >= 2, "two or more parts"), unsigned(p)) },
  { type: "trend", form: "stacked-area", kind: "chart.stacked-area", bound: "series: [{ measure }], one a part, over periods",
    carries: { "mix-over-time": (p) => (p.labels >= 5 ? D : W) }, needs: (p) => first(overPeriods(p), oneUnit(p), need(p.series >= 2, "two or more parts"), unsigned(p)) },
  { type: "trend", form: "combo", kind: "chart.combo", bound: "series: [{ measure }, { measure }] over periods, with secondaryAxis",
    carries: { "two-scales": D, "gap-over-time": W }, needs: (p) => first(overPeriods(p), need(p.series === 2, "exactly two measures")) },
  { type: "trend", form: "slope", kind: "chart.slope", bound: "series: [{ measure }] with select: { periods } of two to four dates; or two dated measures over members with pivot",
    carries: { pair: D },
    needs: (p) => first(need(paired(p) || (p.axis === "periods" && within(p.labels, 2, 4)), "two to four dates"), need(p.axis === "periods" || p.dated, "two dates of one measure"), need(pairMembers(p) <= 12, "twelve lines at most"), oneUnit(p)) },
  { type: "trend", form: "indexed", kind: "chart.line", alone: false, bound: "series: [{ measure }] of an index analysis, or raw series with indexBase",
    carries: { index: D, "many-series": W }, needs: (p) => first(overPeriods(p), need(within(p.series, 4, 8), "four to eight series")) },
  { type: "trend", form: "sparklines", kind: "chart.sparklines", bound: "series: [{ measure }], one a small line, over the same periods",
    carries: { "many-series": D, index: W, trend: (p) => (p.series >= 2 ? W : GRADE.none) }, needs: (p) => first(overPeriods(p), need(within(p.series, 2, 12), "two to twelve series")) },
  { type: "trend", form: "model", kind: null, alone: false, bound: "series: [{ measure }] over periods; the data table is built from them",
    // A forecast read with its numbers: the chart over its own data table.
    carries: { trend: (p) => (p.assumed ? D : W), "mix-over-time": W }, needs: (p) => first(overPeriods(p), oneUnit(p), need(p.labels <= 12, "twelve periods at most")) },
  // --- ranking -------------------------------------------------------------
  { type: "ranking", form: "bar", kind: "chart.bar", bound: "series: [{ measure }] over members, select: { order }",
// The parts of a whole as sorted bars: each part's size read exactly by its length, where slices and tiles show the whole.
    carries: { rank: D, target: D, distribution: W, "part-of-whole": D, "share-of-each": W, pair: (p) => (pairMembers(p) <= 6 ? D : W) },
    needs: (p, typed) => first(need(p.axis === "members" || paired(p), "measures that run over members"), need((paired(p) ? pairMembers(p) : p.labels) >= least(typed), `${least(typed)} or more members`), oneUnit(p), need(p.series <= 3 || paired(p), "three series at most")) },
  { type: "ranking", form: "column", kind: "chart.column", bound: "series: [{ measure }] over members",
    carries: { rank: (p) => (p.labels <= 8 ? D : W), target: (p) => (p.labels <= 8 ? D : W), pair: W },
    needs: (p) => first(overMembers(p), oneUnit(p), need(p.labels <= 12, "twelve members at most"), need(p.series <= 2, "one or two series")) },
  { type: "ranking", form: "lollipop", kind: "chart.lollipop", bound: "series: [{ measure }] over members, select: { order }",
    carries: { rank: D, distribution: W, target: W }, needs: (p) => first(overMembers(p), oneSeries(p)) },
  { type: "ranking", form: "dumbbell", kind: "chart.dumbbell", bound: "series: [{ measure }, { measure }] over members; or the members' series at two periods with pivot",
    carries: { pair: D }, needs: (p) => first(need(paired(p), "two values in one unit for each member"), need(pairMembers(p) >= 4, "four or more members")) },
  { type: "ranking", form: "bullet", kind: "chart.bullet", bound: "series: [{ measure }] with targets: { measure }",
    carries: { target: D }, needs: (p) => first(overMembers(p), oneSeries(p), need(p.targets > 0, "a target or threshold in the measure's unit")) },
  { type: "ranking", form: "distribution", kind: "chart.bar", alone: false, bound: "series: [{ measure }] over members, select: { order }",
    carries: { distribution: D }, needs: (p) => first(overMembers(p, 15), oneSeries(p), need(p.labels <= 40, "forty members at most")) },
  { type: "ranking", form: "aligned-bars", kind: "chart-group", alone: false, bound: "series: [{ measure }], one a column, over the same members",
    carries: { profile: D, pair: W }, needs: (p) => first(overMembers(p), need(within(p.series, 2, 4), "two to four measures")) },
  { type: "ranking", form: "boxplot", kind: "chart.boxplot", bound: "boxes: { min, q1, median, q3, max }, a measure each over the same members",
    carries: { spread: D }, needs: (p) => first(overMembers(p), need(p.spread, "five measures named min, q1, median, q3 and max"), need(p.labels <= 12, "twelve members at most")) },
  // --- composition ---------------------------------------------------------
  { type: "composition", form: "stacked-bar", kind: "chart.stacked-bar", bound: "series: [{ measure }], one a part, over the wholes",
    // Rows read down a list of members. Dates read left to right: the mix of one whole at two or three dates is a column a date,
    // and set as rows it is read against the direction of time - it serves.
    carries: { "mix-compared": (p) => (p.axis === "periods" ? W : D), "mix-over-time": W }, needs: (p) => first(need(p.series >= 2, "two or more parts"), oneUnit(p), unsigned(p)) },
  { type: "composition", form: "stacked-column", kind: "chart.stacked-column", bound: "series: [{ measure }], one a part, over the wholes",
    carries: { "mix-compared": (p) => (p.labels <= 8 ? D : W), "mix-over-time": D }, needs: (p) => first(need(p.series >= 2, "two or more parts"), oneUnit(p), unsigned(p)) },
  { type: "composition", form: "marimekko", kind: "chart.marimekko", bound: "series: [{ measure }], one a part, over the wholes",
    // Each column as wide as its total: size and share together, which a mix recorded in per cent has no size to show. The
    // widths earn their place where the wholes differ in size by enough to see - a fifth of the largest - and there are three or
    // more of them to set against each other. Over two or three dates of one whole, or wholes of one size, it is a stacked
    // column whose widths say nothing, drawn in a form the reader has to learn: it serves.
    carries: { "mix-compared": (p) => (p.percent ? GRADE.none : p.axis === "members" && p.labels >= 3 && (p.wholes ?? 0) >= SWING ? D : W) }, needs: (p) => first(need(p.series >= 2, "two or more parts"), oneUnit(p), unsigned(p), need(!p.percent, "amounts, not percentages")) },
  { type: "composition", form: "waffle", kind: "chart.waffle", bound: "series: [{ measure }] over the parts",
    // A share read as counts: one mark a unit, a hundred to a block at most.
    carries: { "part-of-whole": D }, needs: (p) => first(overMembers(p, 2), oneSeries(p), need(p.whole && !p.signed, "whole counts"), need(p.top <= 100, "a hundred units a part at most")) },
  { type: "composition", form: "donut", kind: "chart.donut", bound: "measure: \"<ref>\" over the parts",
    carries: { "part-of-whole": D }, needs: (p) => first(overMembers(p, 2), oneSeries(p), need(p.labels <= 5, "five parts at most"), need(p.positive, "every part above zero")) },
  { type: "composition", form: "treemap", kind: "chart.treemap", bound: "measure: \"<ref>\" over the parts",
    carries: { "part-of-whole": (p) => (p.labels >= 5 ? D : W) }, needs: (p) => first(overMembers(p, 2), oneSeries(p), need(p.labels <= 20, "twenty parts at most"), need(p.positive, "every part above zero")) },
  { type: "composition", form: "pie", kind: "chart.pie", bound: "measure: \"<ref>\" over the parts",
    carries: { "part-of-whole": D }, needs: (p) => first(overMembers(p, 2), oneSeries(p), need(p.labels <= 5, "five parts at most"), need(p.positive, "every part above zero")) },
  { type: "composition", form: "pictogram", kind: "pictogram", shows: "a population share read as figures - six in ten - for one to five populations",
    carries: { "share-of-each": D }, needs: (p) => first(need(p.axis === "members" && p.labels <= 5, "one to five populations"), oneSeries(p), need(p.percent, "a percentage of each population")) },
  // --- relationship --------------------------------------------------------
  { type: "relationship", form: "scatter", kind: "chart.scatter", bound: "points: { x: \"<ref>\", y: \"<ref>\" }, two measures over the same members",
    carries: { relationship: D, profile: (p) => (p.series === 2 ? W : GRADE.none), pair: W }, needs: (p) => first(overMembers(p, 5), need(p.series === 2, "exactly two measures")) },
  { type: "relationship", form: "bubble", kind: "chart.bubble", bound: "points: { x, y, size }, three measures over the same members",
    carries: { relationship: D, profile: W }, needs: (p) => first(overMembers(p, 5), need(p.series === 3, "exactly three measures")) },
  { type: "relationship", form: "bubble-grid", kind: "chart.bubble-grid", bound: "series: [{ measure }], one a column, over the members as rows",
    carries: { profile: (p) => (p.units === 1 ? D : GRADE.none) }, needs: (p) => first(overMembers(p, 3), need(p.series >= 3, "three or more measures"), oneUnit(p), unsigned(p)) },
  // --- bridge --------------------------------------------------------------
  { type: "bridge", form: "waterfall", kind: "chart.waterfall", bound: "measure: \"<ref>\" over opening total, steps and closing total; or bridge: { from, steps, to }",
    carries: { contribution: D }, needs: (p) => first(overMembers(p, 4), oneSeries(p)) },
  // --- panels: one exhibit a cut ------------------------------------------
  { type: "panels", form: "row", kind: null, carries: { cuts: (p) => (p.cuts <= 3 ? D : W) }, needs: (p) => need(within(p.cuts, 2, 4), "two to four cuts") },
  { type: "panels", form: "grid", kind: null, carries: { cuts: (p) => (p.cuts === 4 ? D : W) }, needs: (p) => need(within(p.cuts, 3, 4), "three or four cuts") },
  // One above the other on a shared time axis: two series a reader reads down the same periods.
  { type: "panels", form: "stack", kind: null, carries: { cuts: (p) => (p.cuts === 2 && p.axis === "periods" ? D : W) }, needs: (p) => need(p.cuts === 2, "exactly two cuts") },
  { type: "panels", form: "sequence", kind: null, shows: "cause and effect, before and after, input to result: two or three exhibits read left to right with an arrow between each",
    carries: { cuts: (p) => (p.sequence ? D : GRADE.none) }, needs: (p) => need(within(p.cuts, 2, 3), "two or three steps") },
  // --- scorecard: recorded magnitudes in coded cells -----------------------
  { type: "scorecard", form: "heatmap", kind: "table", bound: "a token a cell under columns with heat: true",
    carries: { profile: (p) => (p.series >= 3 ? D : W) }, needs: (p) => need(p.axis !== "periods", "measures over members") },
  { type: "scorecard", form: "bars", kind: "table", bound: "a token a cell under columns with bar: true",
    carries: { profile: D, rank: W }, needs: (p) => need(p.axis !== "periods", "measures over members") },
  { type: "scorecard", form: "progress", kind: "table", bound: "a token a cell under a column of type progress",
    carries: { profile: (p) => (p.percent && !p.signed && p.top <= 100 ? D : GRADE.none) }, needs: (p) => need(p.percent && !p.signed && p.top <= 100, "percentages of a maximum") },
  ...["harvey", "rag", "lights", "check", "dot", "trend", "binary"].map((form) => ({ type: "scorecard", form, kind: "table", judged: true,
    shows: { harvey: "members rated against criteria on a declared scale", rag: "a state or verdict a cell: on track, at risk, off track", lights: "a state a cell as a lamp", check: "which members meet each criterion",
      dot: "a yes or no a cell", trend: "the direction each measure moved for each member", binary: "which of two states each cell is in" }[form] })),
  // --- lookup --------------------------------------------------------------
  // Measures grouped under their units: its point where the page looks up measures in more than one.
  { type: "lookup", form: "measure-table", kind: "table", bound: "a token a cell: a measure a row, grouped under its unit",
    carries: { lookup: (p) => (p.units > 1 ? D : W) }, needs: () => null },
  { type: "lookup", form: "table", kind: "table", bound: "a token a cell: the members down the side, a measure a column",
    carries: { lookup: D, profile: (p) => (p.units > 1 ? D : W), figures: D,
      ...Object.fromEntries(["rank", "pair", "trend", "part-of-whole", "mix-compared", "target", "distribution"].map((task) => [task, W])) }, needs: () => null },
  // --- numbers -------------------------------------------------------------
  { type: "numbers", form: "hero-number", kind: null, carries: { figures: (p) => (p.scalars === 1 && p.series > 0 ? D : GRADE.none) }, needs: (p) => need(p.series > 0, "the evidence that produced the number, as an exhibit") },
  // A strip's figures need not each be a measure of their own - the latest value and the change are read off the series under it -
  // so one recorded figure over its exhibit is carried by a strip as directly as by a hero number: which leads is the author's.
  { type: "numbers", form: "metric-strip", kind: null, carries: { figures: (p) => (within(p.scalars, 1, 4) && p.series > 0 ? D : GRADE.none) }, needs: (p) => need(p.series > 0, "an exhibit under the strip") },
  { type: "numbers", form: "fact-grid", kind: "fact-grid", carries: { figures: (p) => (within(p.scalars, 3, 9) && !p.series ? D : GRADE.none) }, needs: (p) => need(within(p.scalars, 3, 9), "three to nine figures") },
  { type: "numbers", form: "stat-list", kind: "stat-list", carries: { figures: (p) => (within(p.scalars, 2, 6) && !p.series ? D : GRADE.none) }, needs: (p) => need(within(p.scalars, 2, 6), "two to six figures") },
  // --- forms whose content is the subject's own shape or the author's judgement
  ...Object.entries({
    "matrix/findings-matrix": "findings down the side, their evidence in two or three columns across",
    "mechanism/flow": "steps with branches or merges", "mechanism/tree": "a decision with branches", "mechanism/cycle": "something that repeats",
    "mechanism/steps": "a sequence in which each step builds on the last", "mechanism/framework": "an ambition resting on its levers",
    "mechanism/layers": "a hierarchy or a dependency stack", "mechanism/relationship-network": "a hub and what depends on it",
    "mechanism/funnel": "a quantity narrowing stage by stage", "mechanism/sankey": "quantities moving from one set to another",
    "mechanism/quadrants": "four boxes on two axes, each holding a list", "mechanism/matrix": "things placed on two judged axes",
    "mechanism/spectrum": "a position between two poles, or a judged grade on a named scale", "mechanism/process": "a sequence of steps",
    "mechanism/chevron-process": "a sequence of stages, each with its detail", "mechanism/zone-matrix": "things placed on two axes, by zone",
    "mechanism/rank-flow": "rank movement across periods",
    "schedule/timeline": "dated milestones", "schedule/gantt": "durations and overlaps across workstreams", "schedule/roadmap": "stages, when each runs and what it delivers",
    "schedule/horizons": "a portfolio of bets by when each pays",
    "parallel/cards": "three to six parallel ideas, an icon each", "parallel/capsules": "three to six parallel ideas in a line", "parallel/arrow-rows": "parallel ideas read down, each leading to its consequence",
    "parallel/labelled-rows": "a point per area, each with its evidence",
    "profiles/logos": "the players the deck compares, by their marks", "profiles/people": "the people involved", "profiles/logo-table": "the players with the numbers the deck will use",
    "profiles/cards": "each player or product on a card", "profiles/radar": "each player's profile across three to eight attributes on one scale",
    "place/map": "where things are: a network, a footprint, a regional pattern",
    "picture/picture-hero": "one thing worth seeing", "picture/picture-pair": "two things worth seeing side by side", "picture/picture-strip": "a run of pictures", "picture/photo-backdrop": "an exhibit over its subject's photograph",
    "options/compare": "two options compared on the same terms", "options/table-halves": "two or three options compared row by row", "options/two-up": "the case for each of two options, each with its exhibit",
    "argument/memo": "a developed argument in prose", "argument/sidebar": "an argument with its claim set beside it",
    "statement/statement": "one sentence the deck turns on", "statement/quotes": "what people said",
    "summary/executive-summary": "the answer and its proof, at the opening", "summary/takeaways": "what to keep, at the close",
  }).map(([key, shows]) => ({ type: key.split("/")[0], form: key.split("/")[1], kind: null, shows, judged: true })),
].map((row) => Object.freeze({ alone: true, carries: {}, needs: () => null, ...row })));

// The exhibit kinds the table grades: what an exhibit on a page of open kinds is read as.
const KINDS = new Set(CARRIERS.filter((row) => row.alone && row.kind && !row.judged).map((row) => row.kind));
const BY_FORM = new Map(CARRIERS.map((row) => [`${row.type}/${row.form}`, row]));
/** The carrier of one form, or null. */
export const carrierOf = (type, form) => BY_FORM.get(`${type}/${form}`) ?? null;
/** The exhibit kind a chart form draws, for a binding that is written before the compiler types the exhibit. */
export const kindOfForm = (type, form) => carrierOf(type, form)?.kind ?? null;

/** What a form's page has to show for the form to be right, where that is the author's judgement or the subject's own shape and no measure says it; "" for a form graded from measures alone. */
export const rightFor = (type, form) => carrierOf(type, form)?.shows ?? "";

// Profiles to try a grade on, where a form's grade depends on what the page shows: the best it reaches on any of them is the
// best it can be. Every combination of a few values of each thing a grade reads.
const PROBES = (() => {
  const axes = { series: [0, 1, 2, 3, 6], labels: [2, 4, 8, 20], units: [1, 2], swing: [0.1, 0.6], percent: [false, true], scalars: [0, 1, 3], cuts: [2, 4] };
  return Object.entries(axes).reduce((list, [key, values]) => list.flatMap((p) => values.map((value) => ({ ...p, [key]: value }))), [{ axis: "periods", index: false, signed: false, positive: true, top: 50, sequence: true, assumed: true, wholes: 0.5 }])
    .flatMap((p) => [p, { ...p, axis: "members" }, { ...p, index: true }]);
})();
const bestGrade = (grade) => (typeof grade === "function" ? Math.max(...PROBES.map((p) => grade(p))) : grade);

/**
 * The fit table as a coverage matrix: for each reading task, the forms that
 * can be its best fit and the ones that at most serve it; and the forms that
 * carry no task read from measures.
 */
export function fitCoverage() {
  const tasks = Object.fromEntries(Object.keys(READING_TASKS).map((task) => [task, { direct: [], work: [] }]));
  for (const row of CARRIERS) for (const [task, grade] of Object.entries(row.carries)) { const best = bestGrade(grade); if (best > GRADE.none) tasks[task][best === D ? "direct" : "work"].push(`${row.type}/${row.form}`); }
  return { tasks, subject: CARRIERS.filter((row) => !Object.keys(row.carries).length).map((row) => `${row.type}/${row.form}`), forms: CARRIERS.length };
}

const HANDS = new Map();
/**
 * A deck's hand: for each reading task, the exhibit kinds that can be its
 * best fit, in the order this deck draws them (`Map` task -> kinds). One
 * order a deck and a task, not one a page: a deck that draws its rankings as
 * dot plots draws every ranking that way wherever a dot plot is among the
 * kinds that carry the page best, and the next deck from the same spine draws
 * them as bars. A draw made page by page gives every deck the same mixture of
 * all the equals - which is why two decks then look alike - and one deck
 * three encodings of one reading task; this gives a deck one hand and two
 * decks two. The tasks take their first mark in turn, in the seed's order,
 * and a task passes over a kind an earlier task already leads with where it
 * has another: so one deck's leading marks are different kinds where the
 * table allows, and no draw makes a deck of columns. The hand orders kinds of
 * equal fit and nothing else: a kind that carries a page less directly is
 * never reached through it.
 */
export function handOf(seed) {
  const key = String(seed);
  if (!HANDS.has(key)) {
    const taken = new Set(), hand = new Map();
    for (const task of Object.keys(READING_TASKS).sort((a, b) => drawRank(seed, "task", a) - drawRank(seed, "task", b))) {
      const kinds = [...new Set(CARRIERS.filter((row) => row.alone && String(row.kind ?? "").startsWith("chart.") && bestGrade(row.carries[task] ?? GRADE.none) === D).map((row) => row.kind))]
        .sort((a, b) => drawRank(seed, "mark", task, a) - drawRank(seed, "mark", task, b));
      const lead = kinds.find((kind) => !taken.has(kind)) ?? kinds[0];
      if (lead) taken.add(lead);
      hand.set(task, lead ? [lead, ...kinds.filter((kind) => kind !== lead)] : []);
    }
    HANDS.set(key, hand);
  }
  return HANDS.get(key);
}

/**
 * Where a mark falls in a deck's hand for one reading task, lowest first: a
 * kind of the hand by its place in it; any other mark - a form that is a page
 * construction, as `<type>/<form>` - by the seed alone, after them.
 */
export function markRank(seed, task, mark) {
  const at = (handOf(seed).get(task) ?? []).indexOf(mark);
  return at >= 0 ? at : 100 + drawRank(seed, "mark", task ?? "", mark);
}

/**
 * The fit table as the catalogue prints it (`--types`): for each reading task
 * a page's measures can set, the forms that are its best fit and the ones that
 * serve it, as `<type>/<form>`. One section, in Markdown lines.
 */
export function describeFit() {
  const { tasks } = fitCoverage();
  return ["## Which form carries which claim", "",
    "A form is chosen by what the page asks its reader to do with the measures it shows. The runtime reads that task from the measures themselves - the axis they run over, how many periods or members the page shows, how many series, their units, a threshold among them, and the relation the claim asserts (`settles.relation`) - and grades every form of the page's type against it: " +
    `${FIT_NAMES[GRADE.direct]} (${FIT_WORDS[GRADE.direct]}), ${FIT_NAMES[GRADE.work]} (${FIT_WORDS[GRADE.work]}) or ${FIT_NAMES[GRADE.none]} (${FIT_WORDS[GRADE.none]}). A form is a best fit only where the measures fill it (two to four dates for a slope, five parts at most for a donut). ` +
    "`--plan` gives each page a best-fit form, spreads the deck's kinds where several fit equally and breaks what is left with the deck's `variation`; `--scaffold <type> --evidence <insight-id>` says which forms fit that insight; a page drawn in a form that only serves its claim while another of its type is a best fit is advised (VARIETY_FIT_UNUSED). A form chosen for variety and not for the claim is the wrong form.", "",
    ...Object.entries(tasks).map(([task, { direct, work }]) => `- ${READING_TASKS[task]}: ${FIT_NAMES[GRADE.direct]} ${direct.join(", ") || "none"}${work.length ? `; ${FIT_NAMES[GRADE.work]} ${work.join(", ")}` : ""}`), ""];
}

const finite = (value) => typeof value === "number" && Number.isFinite(value);
const SPREAD = ["min", "q1", "median", "q3", "max"];
// A measure every reference to it carries a place on: `ref@label` names one value of it.
const bare = (ref) => String(ref).split("@")[0].trim();

/**
 * The measures an exhibit shows, by reference, wherever it names them: the
 * series it binds, its one `measure`, the measures of a scatter's `points`, a
 * bullet's `targets`, a bridge and a box plot, the figures of its `items`,
 * and the `basis` a typed or compiled exhibit carries.
 */
export function exhibitRefs(ex) {
  if (!ex || typeof ex !== "object") return [];
  const named = (node) => (typeof node === "string" ? [node] : Array.isArray(node) ? node.flatMap(named) : node && typeof node === "object" && node.measure !== undefined ? named(node.measure) : []);
  const object = (node) => (node && typeof node === "object" && !Array.isArray(node) ? Object.values(node).flatMap((value) => (typeof value === "string" ? [value] : named(value))) : []);
  const basis = ex.basis && typeof ex.basis === "object" ? [...(Array.isArray(ex.basis.measures) ? ex.basis.measures : []), ...(typeof ex.basis.measure === "string" ? [ex.basis.measure] : [])] : [];
  return [...new Set([...(Array.isArray(ex.series) ? ex.series.flatMap(named) : []), ...named(ex.measure === undefined ? [] : [ex.measure]), ...object(ex.points), ...object(ex.boxes),
    ...(ex.targets && !Array.isArray(ex.targets) ? named(ex.targets) : []), ...(ex.bridge && typeof ex.bridge === "object" ? [ex.bridge.from, ex.bridge.to, ...[].concat(ex.bridge.steps ?? [])].flatMap(named) : []),
    ...(Array.isArray(ex.items) ? ex.items.flatMap(named) : []), ...basis].filter((ref) => typeof ref === "string").map((ref) => ref.trim()))];
}

/** Every text an exhibit draws as a label: its categories, its series' names, its items, points and rows. */
function drawnLabels(ex) {
  const out = new Set();
  const take = (list, ...keys) => { for (const item of Array.isArray(list) ? list : []) { const text = item && typeof item === "object" ? keys.map((key) => item[key]).find((v) => v !== undefined) : item; if (text !== undefined && text !== null && typeof text !== "object") out.add(String(text)); } };
  take(ex.categories); take(ex.labels); take(ex.series, "name"); take(ex.items, "label", "name"); take(Array.isArray(ex.points) ? ex.points : [], "name", "label"); take(Array.isArray(ex.rows) ? ex.rows.map((row) => (Array.isArray(row) ? row[0] : row?.label)) : []);
  for (const chart of Array.isArray(ex.charts) ? ex.charts : []) for (const label of drawnLabels(chart?.props ?? {})) out.add(label);
  return out;
}

/** The periods or members of `axis` an exhibit shows: the ones it draws, the ones its `select` or its basis names, or all of them. */
function shownLabels(ex, axis) {
  const drawn = drawnLabels(ex);
  if (drawn.size) { const kept = axis.labels.filter((label) => drawn.has(label)); if (kept.length) return kept; }
  const select = ex.select && typeof ex.select === "object" ? ex.select : null;
  const declared = ex.basis && typeof ex.basis === "object" ? [ex.basis.labels, ex.basis.members].find((v) => v !== undefined) : undefined;
  const named = select ? (axis.kind === "periods" ? select.periods ?? (select.from !== undefined || select.to !== undefined ? { from: select.from, to: select.to } : undefined) : select.members) : declared;
  if (Array.isArray(named)) { const kept = axis.labels.filter((label) => named.map(String).includes(label)); return kept.length ? kept : axis.labels; }
  if (named && typeof named === "object" && (named.from !== undefined || named.to !== undefined)) {
    const from = named.from === undefined ? 0 : axis.labels.indexOf(String(named.from)), to = named.to === undefined ? axis.labels.length - 1 : axis.labels.indexOf(String(named.to));
    return from >= 0 && to >= from ? axis.labels.slice(from, to + 1) : axis.labels;
  }
  return axis.labels;
}

/**
 * What a set of measures gives a reader to read, as the carriers ask of it:
 * `{ axis, labels, series, units, percent, index, signed, positive, whole,
 * top, swing, wholes, parts, bridge, additive, targets, assumed,
 * dated, spread, scalars, refs }`. `refs` are the measures named; those that run over the commonest
 * axis among them are the series, the single values the scalars. `ex` is the
 * exhibit that shows them, where one is written (its drawn labels, `select`
 * or declared view narrow the axis); `prefer` is the axis a page type reads
 * (a trend's periods) where the measures run over both. Null where none of
 * the references is a recorded measure.
 */
export function profileOf(refs, { registry, insights = null, evidence = [], ex = null, prefer = null } = {}) {
  // One value of a longer measure (`ref@label`) is a figure the page prints, as a measure of one value is.
  const whole = [...new Set(refs.filter((ref) => !String(ref).includes("@")).map(bare))], picked = [...new Set(refs.filter((ref) => String(ref).includes("@")))].filter((ref) => registry?.has?.(bare(ref)));
  const measures = whole.map((ref) => registry?.get?.(ref)).filter(Boolean);
  if (!measures.length && !picked.length) return null;
  const axed = measures.filter((m) => axisOf(m).kind !== "scalar"), single = [...measures.filter((m) => axisOf(m).kind === "scalar"), ...picked.map((ref) => ({ ...registry.get(bare(ref)), ref }))];
  const kinds = ["periods", "members"].map((kind) => [kind, axed.filter((m) => axisOf(m).kind === kind).length]);
  const axis = !axed.length ? "scalar" : prefer && kinds.find(([kind]) => kind === prefer)[1] ? prefer : kinds[0][1] >= kinds[1][1] ? "periods" : "members";
  const along = axed.filter((m) => axisOf(m).kind === axis);
  const ownerOf = (m) => insights?.get?.(m.owner) ?? null;
  // A scenario's path carries a recorded series on past its last period: drawn with the series it starts from, the two are one line.
  const carriesOn = (m) => axis === "periods" && m.assumed && along.some((other) => other !== m && !other.assumed && normalUnit(other.unit) === normalUnit(m.unit) && (m.inputs ?? []).includes(other.ref));
  const series = along.filter((m) => !carriesOn(m));
  if (!series.length) return { axis, labels: 0, series: 0, units: 0, scalars: single.length, targets: 0, refs: [...measures, ...single].map((m) => m.ref) };
  // Over time the axis is every period any series shows - a path runs on from its record; over members it is the members
  // every measure places (the first one's where they share none).
  const shown = along.map((m) => shownLabels(ex ?? {}, axisOf(m)));
  const common = shown[0].filter((label) => shown.every((labels) => labels.includes(label)));
  const labels = axis === "periods" ? [...new Set(shown.flat())] : common.length ? common : shown[0];
  const values = along.flatMap((m) => labels.map((label) => valuesOf(m)[axisOf(m).labels.indexOf(label)])).filter(finite);
  const units = new Set(series.map((m) => normalUnit(m.unit)));
  const names = new Set(series.map((m) => String(m.name).toLowerCase()));
  // A threshold the series is read against: a single value in its unit that is a standard, an assumption or a threshold analysis's.
  const targets = single.filter((m) => units.has(normalUnit(m.unit)) && (m.standard === true || m.assumed || ownerOf(m)?.op === "threshold" || /threshold|target|floor|ceiling|limit|standard|covenant/i.test(m.name))).length;
  const sums = (Array.isArray(evidence) ? evidence : []).map((id) => insights?.get?.(id)).filter((item) => item?.derived && item.op === "sum" && Array.isArray(item.inputs));
  const periods = series.map((m) => (typeof m.period === "string" ? m.period.trim().toLowerCase() : null));
  return {
    axis, labels: labels.length, series: series.length, units: units.size, scalars: single.length, targets, refs: measures.map((m) => m.ref),
    percent: series.every((m) => isPercentUnit(m.unit)), index: series.every((m) => m.base !== undefined), signed: values.some((v) => v < 0), positive: values.length > 0 && values.every((v) => v > 0),
    whole: values.length > 0 && values.every(Number.isInteger), top: values.length ? Math.max(...values.map(Math.abs)) : 0,
    // How far the values move, as a share of their peak: what a mark standing on zero has to show.
    swing: values.length && Math.max(...values.map(Math.abs)) > 0 ? (Math.max(...values) - Math.min(...values)) / Math.max(...values.map(Math.abs)) : 0,
    total: series.length === 1 ? values.reduce((sum, v) => sum + v, 0) : null,
    // How far the wholes differ in size where several series stack: each label's total, as a share of the largest.
    wholes: (() => { const totals = labels.map((label) => along.map((m) => valuesOf(m)[axisOf(m).labels.indexOf(label)]).filter(finite).reduce((sum, v) => sum + v, 0)), peak = Math.max(0, ...totals.map(Math.abs));
      return series.length >= 2 && peak > 0 ? (Math.max(...totals) - Math.min(...totals)) / peak : 0; })(),
    parts: series.some((m) => ownerOf(m)?.shape === "mix" || ownerOf(m)?.op === "share"), bridge: series.some((m) => ownerOf(m)?.shape === "bridge"),
    additive: sums.some((item) => series.filter((m) => item.inputs.includes(m.ref)).length >= 2), assumed: along.some((m) => m.assumed),
    dated: series.length === 2 && periods.every(Boolean) && periods[0] !== periods[1],
    spread: series.length === SPREAD.length && SPREAD.every((name) => names.has(name)),
  };
}

/**
 * The reading task a profile sets, or null where the measures do not say:
 * what the reader is asked to do with what the page shows. `claim` is the
 * page's `settles` - its `kind` and the `relation` it asserts.
 */
export function taskOf(p, claim = {}, type = null) {
  if (!p) return null;
  const kind = claim?.kind;
  // A relation is asserted between measures: an exhibit of one series has none to show.
  const relation = p.series >= 2 ? claim?.relation?.kind : undefined;
  if (p.axis === "scalar" || !p.series) return p.scalars ? "figures" : null;
  // The page type is the author's own statement of the task where the measures leave it open: a relationship page reads
  // two or three measures against each other, a bridge its steps, a composition its parts.
  if (type === "relationship" && p.axis === "members" && within(p.series, 2, 3)) return "relationship";
  if (type === "bridge" && p.axis === "members" && p.series === 1) return "contribution";
  if (type === "composition" && p.series >= 2 && p.units === 1) return p.axis === "periods" && p.labels > 3 ? "mix-over-time" : "mix-compared";
  if (type === "composition" && p.axis === "members" && p.series === 1 && !p.signed) return p.percent && Math.abs((p.total ?? 0) - 100) > 1 && p.labels <= 5 ? "share-of-each" : "part-of-whole";
  if (p.axis === "periods") {
    // Parts of a whole over time are read as its mix - unless the claim is settled by a rate: then it is about how far each
    // part moved, and the parts are series read against each other (two or three dates a pair, more a trend), not a stack whose
    // upper bands have no baseline to read a change from.
    if (p.series >= 2 && p.units === 1 && (p.parts || p.additive) && kind !== "rate") return p.labels <= 3 ? "mix-compared" : "mix-over-time";
    // Two or three dates are a comparison, not a trend: each series is a member with a value at each date.
    if (p.labels <= 3) return p.series >= 2 && p.units === 1 && p.labels >= 2 ? "pair" : "figures";
    if (p.series >= 2 && (p.index || relation === "index")) return "index";
    if (p.units > 1) return p.series === 2 && relation !== "separate" ? "two-scales" : relation === "separate" ? "many-series" : "index";
    if (p.targets && p.series <= 2) return "target-over-time";
    // A gap the claim asserts is read between two of the series, whatever else is drawn beside them as context.
    if (relation === "gap") return "gap-over-time";
    // Levels the claim compares are read on one scale, however many series there are: which is larger, and by how much.
    return p.series >= 5 && relation !== "levels" ? "many-series" : "trend";
  }
  if (p.spread) return "spread";
  if (p.bridge && p.series === 1) return "contribution";
  if (p.series === 1) {
    // Parts of one whole: a mix or a share analysis, or percentages that add up to a hundred. A percentage of each member's
    // own whole adds up to nothing, and is read member by member.
    const hundred = p.percent && Math.abs((p.total ?? 0) - 100) <= 1;
    // Unless the claim ranks them: then the parts are members of a set, read against each other.
    if (!p.signed && (hundred || (p.parts && !p.percent)) && kind !== "rank") return "part-of-whole";
    if (kind === "share" && p.percent && p.labels <= 5) return "share-of-each";
    if (p.targets) return "target";
    if (p.labels <= 3) return "figures";
    return p.labels >= 15 ? "distribution" : "rank";
  }
  if (p.units === 1 && (p.parts || p.additive)) return "mix-compared";
  if (p.series === 2) {
    if (p.units === 1) return relation === "separate" ? "profile" : "pair";
    return relation !== "separate" && kind !== "rank" && p.labels >= 8 ? "relationship" : "profile";
  }
  return p.series === 3 && p.units > 1 && kind === "comparison" && relation !== "separate" && p.labels >= 8 ? "relationship" : "profile";
}

/** One carrier's grade for a task under a profile, and what the profile lacks for it to be drawn (null where it fills it). */
export function gradeOf(row, task, p, typed = true) {
  const grade = row.carries[task];
  const value = typeof grade === "function" ? grade(p) : grade ?? GRADE.none;
  return { grade: value, lacks: value ? row.needs(p, typed) : null };
}

/**
 * The carriers of `task` under profile `p`, graded: `{ ranked, top, equal,
 * lacking }`. `ranked` is every candidate that carries the task and can be
 * drawn, best first, each `{ type, form, kind, grade }`; `equal` those at the
 * best grade; `lacking` the candidates that would carry the task and that the
 * measures do not fill, each with what it `lacks`. `type` narrows the
 * candidates to one page type's forms; without it they are the kinds an
 * exhibit can take on a page that leaves its kind open - one entry a kind, at
 * the best grade any form drawing it reaches.
 */
export function carriersFor(task, p, { type = null } = {}) {
  if (!task || !p) return { ranked: [], top: GRADE.none, equal: [], lacking: [] };
  const rows = CARRIERS.filter((row) => (type ? row.type === type : row.alone && row.kind && row.type !== "scorecard" && row.form !== "measure-table"));
  const all = rows.map((row) => ({ row, ...gradeOf(row, task, p, Boolean(type)) })).filter((item) => item.grade > GRADE.none);
  const graded = all.filter((item) => !item.lacks).map(({ row, grade }) => ({ type: row.type, form: row.form, kind: row.kind, grade }));
  const best = new Map();
  for (const item of graded) { const key = type ? item.form : item.kind; if (!best.has(key) || best.get(key).grade < item.grade) best.set(key, item); }
  const ranked = [...best.values()].sort((a, b) => b.grade - a.grade);
  const top = ranked[0]?.grade ?? GRADE.none;
  const lacking = all.filter((item) => item.lacks && !best.has(type ? item.row.form : item.row.kind)).map(({ row, grade, lacks }) => ({ type: row.type, form: row.form, kind: row.kind, grade, lacks }));
  return { ranked, top, equal: ranked.filter((item) => item.grade === top), lacking };
}

/**
 * Why a form or a kind has the grade it has for a task, in a sentence: what
 * a plan, a scaffold and the fit search print beside a choice. `name` is the
 * form or kind as the author writes it.
 */
export function fitSentence(name, task, grade, lacks = null) {
  const asks = READING_TASKS[task] ?? "what the page claims";
  if (lacks) return `\`${name}\` would carry it and the measures do not fill it: it needs ${lacks}`;
  return `\`${name}\` ${grade === GRADE.direct ? "is a best fit" : grade === GRADE.work ? "serves" : "is a weak fit"}: it ${FIT_WORDS[grade]} (${asks})`;
}

const exhibitsOf = (page) => [page.exhibit, ...(Array.isArray(page.exhibits) ? page.exhibits : [])].filter((ex) => ex && typeof ex === "object");
// An exhibit a spine declares by its `basis` alone, with no kind named (page-types.mjs undrawnExhibit, less the ones that name a `type`).
const undrawnStub = (ex) => Boolean(ex) && typeof ex === "object" && ex.basis !== undefined && Object.keys(ex).every((key) => key === "basis");
// The axis a page type reads where a page's measures run over both.
const TYPE_AXIS = { trend: "periods", ranking: "members", composition: null, relationship: "members", bridge: "members", scorecard: "members" };
// The types whose form leaves the kind of an exhibit to the author: each exhibit is read on its own.
const OPEN_KINDS = new Set(["panels", "numbers"]);

/**
 * The measures of a claim that one exhibit would draw together: those in one
 * unit over one axis - series that share a period, or measures over one set
 * of members (one's members all among the other's). Measures the claim says
 * are read separately are a cut each.
 */
function cutsOf(refs, registry, separate = false) {
  const groups = [];
  const together = (group, axis) => (axis.kind === "periods" ? group.labels.some((label) => axis.labels.includes(label))
    : axis.labels.every((label) => group.labels.includes(label)) || group.labels.every((label) => axis.labels.includes(label)));
  for (const ref of [...new Set(refs.map(bare))]) {
    const m = registry?.get?.(ref);
    if (!m || axisOf(m).kind === "scalar") continue;
    const axis = axisOf(m);
    const home = separate ? null : groups.find((group) => group.kind === axis.kind && group.unit === normalUnit(m.unit) && together(group, axis));
    if (home) home.refs.push(ref); else groups.push({ kind: axis.kind, unit: normalUnit(m.unit), labels: axis.labels, refs: [ref] });
  }
  return groups.map((group) => group.refs);
}

/** A page or a compiled slide as the fit reads it: its type and form, its claim, the insights it rests on and its exhibits. */
function describe(page) {
  const record = page?.pageType && typeof page.pageType === "object" ? page.pageType : null;
  const settles = record ? record.content?.settles : page?.settles;
  // A compiled slide keeps each exhibit's `basis` in its record (author-deck.mjs withoutDependencies): read back onto the exhibit it was written on.
  const kept = Array.isArray(record?.dependencies?.exhibits) ? record.dependencies.exhibits : [];
  const exhibits = exhibitsOf(page ?? {}).map((ex, at) => (ex.basis === undefined && kept[at] ? { ...ex, basis: kept[at] } : ex));
  return { id: page?.id, type: record?.type ?? page?.type, form: record?.form ?? page?.form ?? null, settles: settles && typeof settles === "object" ? settles : {},
    evidence: (record ? record.content?.evidence : page?.evidence) ?? [], exhibits, imported: (record?.sourceSlide ?? page?.sourceSlide) !== undefined };
}

/**
 * How a page's choices fit its claim: for the page's type, the forms that
 * carry what it shows; and for a page whose form leaves the kind of an
 * exhibit open, the kinds that carry each exhibit's measures.
 *
 *   { id, type, form, task, profile,
 *     forms: { ranked, top, equal },            the forms of the type, graded for the page's task
 *     chosen: { form, grade } | null,           the declared form's grade, where it is a carrier read from measures
 *     exhibits: [{ at, refs, task, kind, written, grade, kinds: { ranked, top, equal } }],   `written` false for a cut the page has not drawn yet
 *     left: [{ where, has, grade, better: [...] }] }   what is drawn in a form that carries its claim less directly than another it could take
 *
 * `page` is a page of a pages file or a compiled slide. Null where the page's
 * type is unknown or none of its measures is recorded: there is no fit to
 * read, and nothing is proposed or questioned.
 */
export function pageFit(page, { registry, insights = null } = {}) {
  const d = describe(page);
  if (!d.type || !registry?.size) return null;
  const claimed = Array.isArray(d.settles.measures) ? d.settles.measures.filter((ref) => typeof ref === "string") : [];
  const written = d.exhibits.map((ex, at) => ({ ex, at, refs: exhibitRefs(ex) }));
  const context = { registry, insights, evidence: d.evidence };
  const open = OPEN_KINDS.has(d.type);
  // The exhibits a page with open kinds draws: the written ones by the measures each names, else one for each cut of the claim.
  const drawn = written.filter((item) => item.refs.some((ref) => registry.has(ref)));
  // A single value the claim names in a cut's unit - a standard, a target - is read with that cut: what its members are set against.
  const single = claimed.filter((ref) => !String(ref).includes("@") && registry.has(ref) && axisOf(registry.get(ref)).kind === "scalar");
  const withSingles = (refs) => [...refs, ...single.filter((ref) => refs.some((other) => normalUnit(registry.get(other).unit) === normalUnit(registry.get(ref).unit)))];
  const cuts = open ? (drawn.length ? drawn : cutsOf(claimed, registry, d.settles.relation?.kind === "separate").map((refs, at) => ({ ex: null, at, refs: withSingles(refs) }))) : [];
  const exhibits = cuts.map(({ ex, at, refs }) => {
    const profile = profileOf(refs, { ...context, ex }), task = taskOf(profile, d.settles);
    const kinds = carriersFor(task, profile);
    // A kind the table does not hold - a range, a map, a set of cards - is the author's own choice, and is not graded; nor is a
    // table among charts, which is chosen for the exact values a reader looks up, and no measure says whether they will.
    const kind = ex?.type && KINDS.has(String(ex.type)) && String(ex.type) !== "table" ? String(ex.type) : null;
    // An exhibit the spine declares and has not drawn - a `basis` stub with no `type` - has no kind yet: it is a cut still to be
    // given one, as a cut nobody has written is. A stub that says it is a table or a figure (`as`) has said what it is.
    const stub = undrawnStub(ex);
    return { at, refs, task, profile, kind, written: ex !== null && !stub, stated: stub ? ex.basis?.as ?? null : null, grade: kind && kinds.ranked.length ? kinds.ranked.find((item) => item.kind === kind)?.grade ?? GRADE.none : null, kinds };
  // A grid or a list of figures is its page's own form, and two or three values are figures whatever draws them: neither is ranked as a chart.
  }).filter((item) => item.task && item.task !== "figures" && item.profile.series > 0 && !["fact-grid", "stat-list"].includes(d.form) && !["table", "figure"].includes(item.stated));
  // The page's own profile: what its one exhibit shows, or its claim's measures; a page of cuts is profiled by how many it holds.
  const primary = !open && drawn.length ? drawn[0] : null;
  const refs = primary ? primary.refs : claimed;
  let profile = profileOf(refs, { ...context, ex: primary?.ex ?? null, prefer: TYPE_AXIS[d.type] ?? null });
  let task = null;
  if (d.type === "panels") { if (exhibits.length) { profile = { cuts: Math.max(exhibits.length, written.length), axis: exhibits.every((item) => item.profile.axis === "periods") ? "periods" : "members", sequence: d.settles.kind === "sequence" }; task = "cuts"; } }
  else if (d.type === "numbers") { if (profile && (profile.scalars || profile.series)) task = "figures"; }
  else if (d.type === "lookup") { if (profile) task = "lookup"; }
  else if (d.type === "scorecard") { if (profile && profile.series > 0 && profile.axis === "members") task = "profile"; }
  else task = profile && profile.series > 0 ? taskOf(profile, d.settles, d.type) : null;
  const forms = carriersFor(task, profile, { type: d.type });
  // A figures page whose figures are single values of longer measures says nothing of how many it prints: no form is ranked.
  const known = task && forms.ranked.length > 0 && !(d.type === "numbers" && !profile.scalars);
  if (!known && !exhibits.length) return null;
  const row = d.form ? carrierOf(d.type, d.form) : null;
  // How many figures a numbers page prints is not in its measures - a value of a longer measure prints as one too - so its declared form is never questioned.
  const chosen = known && row && !row.judged && d.type !== "numbers" ? { form: d.form, grade: forms.ranked.find((item) => item.form === d.form)?.grade ?? GRADE.none } : null;
  // What is drawn in a form that serves the claim while another is its best fit. A form the table does not rank for the task at
  // all is not named: the page compiles, so it draws something the measures' profile did not say, and that is the author's to judge.
  const left = [
    ...(chosen && chosen.grade === GRADE.work && forms.top === GRADE.direct ? [{ where: "form", has: d.form, grade: chosen.grade, better: forms.equal.map((item) => item.form) }] : []),
    ...exhibits.filter((item) => item.grade === GRADE.work && item.kinds.top === GRADE.direct).map((item) => ({ where: `exhibit ${item.at + 1}`, has: item.kind, grade: item.grade, task: item.task, better: item.kinds.equal.map((kind) => kind.kind) })),
  ];
  return { id: d.id, type: d.type, form: d.form, imported: d.imported, task: known ? task : null, profile: known ? profile : null, forms: known ? forms : { ranked: [], top: GRADE.none, equal: [] }, chosen, exhibits, left };
}

/**
 * The forms of other page types that carry a page's claim more directly than
 * any form of its own type: `[{ type, form, grade }]`, for a plan to say before
 * the critique binds the type. `shapes` are the shapes of the page's evidence
 * and `carriedBy` the page types each shape can rest under (evidence.mjs
 * TYPE_SHAPES): a type the evidence cannot carry is not offered. With
 * `equal`, the forms of other types that carry it as directly as the best of
 * its own, where its own carries it directly: the latitude a page has in its
 * type - which the evidence contract leaves almost none of, since a type
 * rests on one shape of evidence (measured by evals/quality/variability.mjs).
 */
export function otherTypes(page, { registry, insights = null, carriedBy = () => true, equal = false } = {}) {
  const d = describe(page);
  // A page of another kind - a summary, a diagram, a set of cards - is not a chart some type would draw better; and measures the
  // claim says are read each on its own are a lookup by the author's own statement.
  if (!d.type || !(d.type in TYPE_AXIS || d.type === "lookup") || !registry?.size || d.settles.relation?.kind === "separate") return [];
  const claimed = Array.isArray(d.settles.measures) ? d.settles.measures : [];
  const profile = profileOf(claimed, { registry, insights, evidence: d.evidence, prefer: TYPE_AXIS[d.type] ?? null }), task = taskOf(profile, d.settles, d.type);
  if (!task || !profile.series) return [];
  // A lookup page chose exact values over a picture of them: only its measures' own task says whether a chart carries them.
  const read = d.type === "lookup" || d.type === "scorecard" ? taskOf(profile, d.settles) : task;
  const own = d.type === "lookup" || d.type === "scorecard" ? GRADE.work : carriersFor(task, profile, { type: d.type }).top;
  if ((own >= D) !== equal) return [];
  return CARRIERS.filter((row) => row.type !== d.type && !row.judged && String(row.kind ?? "").startsWith("chart") && carriedBy(row.type)).map((row) => ({ type: row.type, form: row.form, ...gradeOf(row, read, profile) }))
    .filter((item) => item.grade === D && !item.lacks).map(({ type, form, grade }) => ({ type, form, grade, task: read }));
}

/**
 * Where another page type carries what a page's measures ask of a reader
 * directly and its own does not, the sentence saying so, for a storyline
 * critic's check of the evidence's shape - the type is settled at the spine,
 * so this is the one thing the fit says that only the critique can mend. A
 * chart page whose type has no best-fit form for its measures, or a lookup
 * table of measures a chart would carry: the critic judges whether the exact
 * values are what the reader needs. "" where the type carries the claim
 * directly, where no task is read, and for a scorecard, whose coding is a
 * judgement no measure makes.
 */
export function typeFitNote(page, context = {}) {
  const d = describe(page);
  if (!d.type || !(d.type in TYPE_AXIS || d.type === "lookup") || d.type === "scorecard") return "";
  const better = otherTypes(page, context);
  if (!better.length) return "";
  const forms = better.slice(0, 3).map((item) => `${item.type}/${item.form}`).join(" or ");
  return d.type === "lookup" ? `its measures ask the reader to read ${READING_TASKS[better[0].task]}, which ${forms} would carry directly; a table of them is right where the exact values are what the reader needs`
    : `its measures ask the reader to read ${READING_TASKS[better[0].task]}, which no form of a ${d.type} page carries directly; ${forms} would`;
}

/** The exhibit kinds every one of a page's cuts can take at its own best grade: what lets panels read across in one encoding. */
export function sharedKinds(exhibits) {
  const sets = exhibits.map((item) => item.kinds.equal.map((kind) => kind.kind));
  return sets.length > 1 ? sets[0].filter((kind) => sets.every((set) => set.includes(kind))) : [];
}

/** A profile in a phrase: what the page shows, as the plan and a scaffold say it. */
export function profileWords(p) {
  if (!p) return "";
  if (p.cuts !== undefined && p.series === undefined) return `${p.cuts} cut${p.cuts === 1 ? "" : "s"}`;
  if (!p.series) return `${p.scalars} single value${p.scalars === 1 ? "" : "s"}`;
  return `${p.series} measure${p.series === 1 ? "" : "s"} over ${p.labels} ${p.labels === 1 ? p.axis.slice(0, -1) : p.axis}${p.units > 1 ? ` in ${p.units} units` : ""}${p.scalars ? ` and ${p.scalars} single value${p.scalars === 1 ? "" : "s"}` : ""}`;
}

// The data a chart reads, whatever its kind: what a scaffold clears before it writes an exhibit from measures.
export const DATA_KEYS = Object.freeze(["categories", "labels", "values", "series", "measure", "items", "points", "boxes", "rows", "columns", "bridge", "unit", "referenceLines", "forecastFrom", "periods", "totals",
  "focusSeries", "max", "targets", "ranges", "xScale", "yScale", "xLabel", "yLabel", "yMin", "yMax", "sizeLegend", "select", "pivot", "secondaryAxis", "secondaryUnit", "indexBase", "subject"]);

/**
 * An exhibit of `kind` written from an insight's measures, by reference: the
 * keys to set on it (`set`), the measures it then shows (`claimed`), the
 * labels it draws along its axis (`labels`) and the series it draws (`names`)
 * - what a mark on it can name - or `why` it cannot be written from them.
 * `measures` are the insight's, each `{ ref, name, m }`; `form` is the page's
 * form where that changes what the exhibit reads (an indexed trend, aligned
 * bars, a distribution).
 */
export function boundKeys(kind, measures, { form = null } = {}) {
  const all = measures.map((x) => ({ ...x, axis: axisOf(x.m) }));
  const series = all.filter((x) => x.axis.kind !== "scalar"), single = all.filter((x) => x.axis.kind === "scalar");
  if (!series.length) return { why: "the insight records no measure over periods or members for the exhibit to plot" };
  const lead = series[0], sameUnit = (x) => normalUnit(x.m.unit) === normalUnit(lead.m.unit);
  const beside = series.filter((x) => x.axis.kind === lead.axis.kind && x.axis.labels.some((label) => lead.axis.labels.includes(label)));
  const together = beside.filter(sameUnit);
  const named = (list) => list.map((x) => ({ measure: x.ref, name: x.name }));
  const out = (set, shown, { labels = lead.axis.labels, names = shown.map((x) => x.name) } = {}) => ({ set, claimed: shown.map((x) => x.ref), labels, names });
  const overMembers = lead.axis.kind === "members", ends = [lead.axis.labels[0], lead.axis.labels.at(-1)];
  if (kind === "chart.scatter" || kind === "chart.bubble") {
    const count = kind === "chart.bubble" ? 3 : 2;
    if (!overMembers || beside.length < count) return { why: `a ${kind.slice(6)} sets ${count} measures against each other member by member, and the insight records ${overMembers ? beside.length : 0} over one set of members` };
    const [x, y, size] = beside;
    return out({ points: { x: { measure: x.ref, name: `(${x.name}: what the x axis measures)` }, y: { measure: y.ref, name: `(${y.name}: what the y axis measures)` }, ...(count === 3 ? { size: { measure: size.ref, name: `(${size.name}: what the size shows)` } } : {}) } }, beside.slice(0, count), { names: lead.axis.labels });
  }
  if (kind === "chart.sparklines") return !overMembers && together.length >= 2 ? out({ series: named(together.slice(0, 12)) }, together.slice(0, 12), { labels: together.slice(0, 12).map((x) => x.name) })
    : { why: "small multiples set two to twelve series in one unit over the same periods, and the insight records fewer" };
  if (kind === "chart.treemap" || kind === "chart.pie" || kind === "chart.donut") return overMembers ? out({ measure: lead.ref }, [lead]) : { why: "the parts of a whole are one measure over its members, and the insight's first measure runs over periods" };
  if (kind === "chart.waterfall") return overMembers && lead.axis.labels.length >= 3 ? out({ measure: lead.ref, totals: [0, lead.axis.labels.length - 1] }, [lead])
    : { why: "a bridge is one measure whose members are its opening total, its steps and its closing total, and the insight records none over three or more members" };
  if (kind === "chart.boxplot") {
    const box = SPREAD.map((name) => series.find((x) => String(x.name).toLowerCase() === name));
    return box.every(Boolean) ? out({ series: named(box) }, box) : { why: `a box plot is five measures over the same members, named ${SPREAD.join(", ")}, and the insight does not record them` };
  }
  if (kind === "chart.bullet") {
    const target = single.find(sameUnit) ?? series.find((x) => x !== lead && sameUnit(x) && x.axis.kind === "members");
    return overMembers && target ? out({ series: named([lead]), targets: { measure: target.ref } }, [lead, target], { names: [lead.name] }) : { why: "a bullet sets a measure over members against a target in its unit, and the insight records no such target" };
  }
  if (kind === "chart.slope") {
    if (!overMembers) return together.length <= 12 ? out({ series: named(together), select: { periods: ends } }, together, { labels: ends }) : { why: "a slope holds twelve lines at most" };
    return together.length === 2 && lead.axis.labels.length <= 12 ? out({ series: named(together), pivot: true }, together, { labels: together.map((x) => x.name), names: lead.axis.labels }) : { why: "a slope over members is two dated measures for twelve members at most" };
  }
  if (kind === "chart.dumbbell") {
    if (overMembers) return together.length >= 2 ? out({ series: named(together.slice(0, 2)) }, together.slice(0, 2)) : { why: "a dumbbell joins two measures in one unit for each member, and the insight records one" };
    return together.length >= 4 ? out({ series: named(together), select: { periods: ends }, pivot: true }, together, { labels: together.map((x) => x.name), names: ends }) : { why: "a dumbbell over time is four or more series read at two periods, and the insight records fewer" };
  }
  if (kind === "chart.combo") return !overMembers && beside.length >= 2 ? out({ series: named(beside.slice(0, 2)) }, beside.slice(0, 2)) : { why: "a combo is two measures over the same periods, and the insight records one" };
  if (kind === "chart.bubble-grid") return overMembers && together.length >= 2 ? out({ series: named(together) }, together) : { why: "a bubble grid is two or more measures in one unit over the same members" };
  if (kind === "chart.lollipop" || kind === "chart.waffle" || form === "distribution") return out({ series: named([lead]), ...(form === "distribution" ? { select: { order: "descending" } } : {}) }, [lead]);
  // An indexed trend takes every series, whatever its unit, rebased; aligned bars a column and a unit a measure, four at most; every other chart the measures on one scale.
  const drawn = form === "indexed" ? beside : form === "aligned-bars" ? beside.slice(0, 4) : together;
  return out({ series: named(drawn), ...(form === "indexed" ? (drawn.some((x) => x.m.base !== undefined) ? {} : { indexBase: lead.axis.labels[0] }) : {}), ...(form === "indexed" ? { subject: lead.name } : {}) }, drawn);
}
