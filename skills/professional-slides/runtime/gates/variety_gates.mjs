// The variety contract, read from the choices each page made.
//
// A deck's variety is decided when its pages are chosen, not when they are
// drawn: by the time a render shows fifty pages of one skeleton, the remedy is
// a rewrite. These rules read the page types (page-types.mjs) and block before
// the build. They run twice from one implementation: when the deck is authored
// (author-deck.mjs) and again in the build's preflight, which also refuses a
// long deck whose pages were not authored as types, or whose structure was
// edited by hand after it was compiled.
//
// The thresholds sit outside what 123 content pages of strong consulting
// decks measure, so a well-made deck passes them with room: there the commonest page
// type is 23% of pages, the commonest commentary placement 27%, a closing
// line 9%, pages with two or more exhibits 24%, and 80% of chart pages mark
// something on the plot.
//
// Placement and repetition are measured on the page as drawn, not on the
// declared choices: "beside" and "beside-left" draw one placement, and a trend
// beside its points and a stat list beside its points draw one signature. The
// reader sees one page each time, so the contract counts one.
//
// The deck's exhibit mix and range are read here too, on the compiled pages,
// where each page's family is the exhibit it draws. The plan gates read the
// same bands off the families the author declared, which can be wrong, and so
// only advise; here the count is exact, and it blocks.

import { PLAN, DECK_LENGTH, RULES, applyRulesVersion } from "../weight.mjs";
import { calloutCapacity, countInWords } from "../chart-annotations.mjs";
import { isTable, rowCells } from "../evidence.mjs";
import { FIT_WORDS } from "../claim-fit.mjs";

export const VARIETY_CODES = Object.freeze({
  PAGE_TYPE_UNDECLARED: "the deck's pages were not authored as page types, so nothing chose their structure",
  PAGE_TYPE_EDITED: "a page's structure was changed after it was compiled from its choices",
  VARIETY_TYPE_SHARE: "one page type carries too much of the deck",
  VARIETY_TYPE_RANGE: "the deck uses too few page types for its length",
  VARIETY_TYPE_RUN: "the same page type repeats down consecutive pages",
  VARIETY_COMMENTARY: "one commentary placement carries too much of the deck",
  VARIETY_TAKEAWAY: "too many pages close on a takeaway line",
  VARIETY_PANELS: "too few pages carry two or more exhibits",
  VARIETY_COLUMN: "too many pages are one exhibit with a text column beside it",
  VARIETY_SIGNATURE: "one drawn page - layout, exhibits, text column and close - repeats across the deck",
  EVIDENCE_DEPTH: "the deck's chart pages plot too few values: the median chart page is thinner than strong decks'",
  VARIETY_EXHIBIT_MIX: "one evidence family is outside its band across the deck's compiled pages",
  VARIETY_EXHIBIT_RANGE: "the deck draws too few kinds of exhibit for its length",
  // Measured and advised, never refused (fitStandings): the range floor counts the kinds a deck draws, not how its exhibits are shared between them.
  VARIETY_KIND_SHARE: "the three commonest exhibit kinds carry most of the deck's exhibits",
  VARIETY_FIT_UNUSED: "a page is drawn in a form, or an exhibit in a kind, that carries its claim less directly than another its measures fill",
  // Raised by author-deck.mjs: the page failed to compose; the rest of the deck is still checked.
  PAGE_DOES_NOT_COMPOSE: "a page could not be composed",
  // Raised by author-deck.mjs: the page's type refused its choices.
  COMPILE: "a page that does not compile from its type's choices",
  // Advisory, raised by the page-type compiler (page-types.mjs) and listed in the author's summary.
  MAP_COARSE: "a regional map drawn on the built-in 1:110m coastline, which is coarse at that scale",
  // Found by a whole-deck review and refused where the page is written
  // (page-types.mjs reviewedDefect, compose-tables.mjs totalRow); the author sees
  // them as COMPILE or PAGE_DOES_NOT_COMPOSE findings carrying these codes.
  TOTAL_ROW_BLANK: "a table row labelled as a total with no value in any of its result cells",
  TABLE_TOO_SHORT: "a table of fewer than three body rows, where two or three figures are a numbers page",
  TABLE_PANELS_MERGE: "two tables on one page with the same columns, which read as one table split in two - on different measures, nothing reads across",
  TABLE_STACK: "two or more tables set one above another on a page, so the reader holds one grid in mind while reading the next",
  COMPARISON_MEASURES_DIFFER: "panels headed by different players, each on its own measure, so nothing reads across",
  TIME_AXIS_UNEVEN: "a column chart whose dated categories are unevenly spaced in time but drawn one slot apart",
  VERDICT_TABLE_PLAIN: "a lookup, options or matrix table whose judgement column (lead, verdict, confidence, status) is plain text",
  SCENARIO_PROSE: "two to four alternatives written as paragraphs of sixty words or more each",
  PROSE_PARAGRAPH_LONG: "a paragraph of more than sixty words, longer than a strong deck sets one block",
  PROSE_UNSIGNPOSTED: "a paragraph of thirty words or more with no bold lead to scan it by",
  // Advisory, raised by the page-type compiler and listed in the author's summary.
  SHARES_IN_TILES: "shares of one measure an order of magnitude apart set in tiles of one size",
  // Deck-level, read here from the compiled pages.
  VARIETY_TABLES: "one table construction on more than half of ten consecutive analytical pages",
  PLAYERS_UNMARKED: "the deck compares named players but no early page shows their logos",
  PROFILE_UNPICTURED: "a page introducing players or products as cards with no logo or picture on any of them",
});

export const VARIETY = Object.freeze({
  from: DECK_LENGTH.variety, // content pages; shorter decks are probes
  typeShareMax: 0.25,       // strong decks: commonest type 23%
  // Strong decks: commonest placement 27%, so the cap sits just outside it;
  // the worked example's commonest placement is under a quarter.
  commentaryShareMax: 0.3,
  // Points under the exhibit have a cap of their own: strong decks set
  // bullets under an exhibit on about one page in fifty, and comment on the
  // plot, in the cells, under each panel or beside it instead.
  belowShareMax: 0.12,
  takeawayShareMax: 0.25,   // strong decks: 9% of pages close on a line or band; a so-what bar is a close
  // Structure, counted on the page as drawn (page-types.mjs drawnOf), from
  // fifteen pages. Strong decks carry two or more exhibits on a quarter to a
  // third of their pages and draw one exhibit beside a text column on about
  // one in eight. The floor sits under strong decks' lowest share, so a deck
  // that chose its pages passes with room, and it counts every way a page
  // carries two bodies of evidence - panels, a sequence, a metric strip over
  // its chart, row blocks with an exhibit each, a photograph under an exhibit.
  // The cap sits half as high again as strong decks' share: the column is a
  // good page, and a deck that reaches for it on one page in three has
  // stopped asking what each page has to show.
  structureFrom: 15,
  multiShareMin: 0.2,
  columnShareMax: 0.2,
  // Keyed on the drawn skeleton, not the declared type. The commonest skeleton
  // in strong decks is a full-width chart carrying its own callouts, about 16%
  // of pages; one exhibit beside a column is 13%.
  signatureShareMax: 0.2,
  runMax: 2,                // three in a row of one type reads as one page repeated
  // Evidence depth: strong decks' chart pages plot a median of about 22 values
  // (the middle half 10 to 48). Each page is floored at 8 when it compiles
  // (page-types.mjs EVIDENCE_FLOOR), and a deck of pages that all sit on the
  // floor is still thin: the median chart page has to reach 15, between strong
  // decks' lower quartile and median, so half the charts carry a peer set, a
  // second series or a longer window. Read from eight chart pages, where a
  // median means something. The target is advised, never refused: strong
  // decks' chart pages print about 26 numbers, a quarter of them under 20
  // (weight.json reference.numericByFamily), so a median under 20 is a deck
  // thinner than most of theirs - but a page of twelve honest values is not
  // refused for it.
  evidenceFrom: 8,
  evidenceMedianMin: 15,
  evidenceMedianTarget: 20,
});

// The pages a deck of one exhibit and a column is usually hiding: what the
// column was holding, the page that draws it, and whether that page carries
// two or more exhibits (a string says on what condition). Every structure
// repair is built from this one list, so no repair offers a page another does
// not, and page-types.md prints it as a table (a test holds the two together).
export const REDRAWS = Object.freeze([
  { holding: "a second cut of the same evidence - another measure, another member, the other period", draw: "two or more panels, each headed, its finding under it as a `caption`",
    choice: "`panels`, form `row`, `grid` or `stack`, commentary `captions`", multi: true },
  { holding: "the three numbers that carry the claim", draw: "the exhibit under a strip of them", choice: "`numbers`, form `metric-strip`, commentary `none`", multi: true },
  { holding: "notes on particular marks", draw: "callouts on the plot", choice: `commentary \`on-exhibit\`, three at most, about ${countInWords(calloutCapacity())} words each`, multi: false },
  { holding: "one implication", draw: "a so-what bar under the exhibit", choice: "commentary `so-what-bar`", multi: false },
  { holding: "a point per area, each with its own evidence", draw: "labelled row blocks, a number or a small exhibit at the right of each", choice: "`parallel`, form `labelled-rows`",
    multi: "with a small `exhibit` on each row" },
  { holding: "a point per row of a table", draw: "the table's last column, the implication of each row", choice: "`lookup` or `scorecard`, commentary `in-exhibit`", multi: false },
  { holding: "a cause and its effect", draw: "two or three exhibits joined by arrows", choice: "`panels`, form `sequence`", multi: true },
  { holding: "the case for each of two options", draw: "the two options side by side, each with its exhibit", choice: "`options`, form `two-up`", multi: true },
  { holding: "what the subject looks like", draw: "the exhibit on a card over its subject's photograph", choice: "`picture`, form `photo-backdrop`", multi: true },
]);
const redraws = (multiOnly = false) => REDRAWS.filter((r) => !multiOnly || r.multi)
  .map((r) => `${r.draw} (${r.choice}${multiOnly && typeof r.multi === "string" ? `, ${r.multi}` : ""})`).join("; ");
// What the middle page of a run of one type can become, by the run's type:
// the forms the same evidence takes as a different page.
const RUN_ALTERNATIVES = {
  panels: "one of its cuts as a `trend` or `ranking` page with the other in a callout or the rail, or a `numbers` metric-strip over one exhibit",
  trend: "`panels` (the measure beside a second cut), a `numbers` hero-number with the series as its evidence, or a `bridge` if it explains a change",
  ranking: "`panels` (two cuts of the set side by side), a `scorecard` if the members are rated on several measures, or `numbers`",
  numbers: "a `trend` or `ranking` page for the series behind the figure, or `panels`",
  composition: "a `ranking` of the parts, or `panels` setting the mix beside its change",
  matrix: "a `scorecard` coding the cells, `parallel` labelled rows, or `options` compare",
  scorecard: "a `matrix` of findings, or a `ranking` of the measure that decides it",
  lookup: "a `scorecard` coding the cells, or `profiles`",
  parallel: "`mechanism` if the items connect, or a `matrix` of findings",
  argument: "`statement`, or a page whose exhibit carries the evidence the prose describes",
};

/**
 * What the deck's chart pages plot, from the counts the compiler recorded on
 * each page (`pageType.values`): how many chart pages, their median and range,
 * and the five thinnest - read by the gate below and printed in the author's summary.
 */
export function evidenceDepth(slides) {
  const charts = slides.filter((s) => s.pageType?.chart && Number.isFinite(s.pageType.values));
  const values = charts.map((s) => s.pageType.values).sort((a, b) => a - b);
  const mid = values.length / 2;
  const median = values.length ? (values.length % 2 ? values[Math.floor(mid)] : (values[mid - 1] + values[mid]) / 2) : 0;
  const thinnest = [...charts].sort((a, b) => a.pageType.values - b.pageType.values).slice(0, 5).map((s) => `${s.id ?? "?"} (${s.pageType.values})`);
  return { chartPages: charts.length, median, min: values[0] ?? 0, max: values.at(-1) ?? 0, thinnest };
}

/**
 * The types in page order, a run of one type folded to its ends ("p4-p6
 * panels x3"): printed in the author's summary and in a run's finding, so the
 * two read alike: a count of types cannot show where a run of three panels
 * pages sits.
 */
export function typeSequence(slides) {
  return slides.filter((s) => s.pageType).reduce((runs, s) => {
    const last = runs.at(-1);
    if (last?.type === s.pageType.type) last.ids.push(s.id ?? "?"); else runs.push({ type: s.pageType.type, ids: [s.id ?? "?"] });
    return runs;
  }, []).map(({ type, ids }) => (ids.length === 1 ? `${ids[0]} ${type}` : `${ids[0]}-${ids.at(-1)} ${type} x${ids.length}`)).join(" | ");
}

// How VARIETY_COLUMN counts a rail, said on its standing line: the two rules that read a page's commentary read a rail differently, each for what it measures.
const RAIL_AS_COLUMN = "a rail counts here: it is a column beside the exhibit, as points beside it are";

/**
 * The deck's structure as drawn: the skeletons and how often each is drawn,
 * and the two shares the contract holds - pages carrying two or more exhibits,
 * and pages that are one exhibit beside a text column. Read from what the
 * compiler recorded on each page (`pageType.drawn`), or from `drawnOf` for a
 * deck compiled before it was recorded; pages with neither are left out.
 */
export function structureMix(slides, { drawnOf } = {}) {
  const known = slides.filter(isContent).map((s) => ({ s, d: s.pageType?.drawn ?? (drawnOf && s.pageType ? drawnOf(s) : null) })).filter((x) => x.d);
  const pick = (test) => { const hit = known.filter(test); return { pages: hit.length, share: known.length ? share(hit.length, known.length) : 0, ids: hit.map((x) => x.s.id ?? null) }; };
  const skeletons = {};
  for (const s of slides.filter(isContent)) if (s.pageType?.skeleton) skeletons[s.pageType.skeleton] = (skeletons[s.pageType.skeleton] || 0) + 1;
  const multi = pick((x) => x.d.exhibits >= 2);
  return { pages: known.length, multi: { pages: multi.pages, share: multi.share }, column: pick((x) => x.d.column), skeletons: Object.fromEntries(Object.entries(skeletons).sort((a, b) => b[1] - a[1])) };
}

const isContent = (slide) => (!slide.kind || slide.kind === "content" || slide.kind === "statement" || slide.kind === "takeaways") && slide.title !== undefined;
const share = (n, of) => Math.round((n / of) * 100) / 100;

// The evidence families, by exhibit type. One vocabulary for the plan, which
// names an exhibit per page (plan_gates.mjs family), and for the compiled
// deck, which draws it. Numbers and cards are families of their own, so
// diagram is not everything that is not a chart, a table or text.
const CHART_LIKE = new Set(["metrics", "chart-group", "funnel", "sankey", "rank-flow", "pictogram", "radial-bars", "horizons"]);
const TABLE_LIKE = new Set(["table", "rows", "compare", "phase-table", "matrix", "comparison-table", "heatmap", "trend-rows",
  "insight-tree-table", "scorecard", "worksheet", "zone-matrix", "status-list"]);
const NUMBERS_LIKE = new Set(["fact-grid", "metric-strip", "stat-list", "kpi", "cards", "capsules", "highlight-strip",
  "labelled-rows", "logos", "people"]);
const PICTURE_LIKE = new Set(["image", "photo", "picture", "picture-pair", "picture-strip", "picture-hero", "device-frame"]);
const TEXT_LIKE = new Set(["", "text", "bullet-list", "quote-cluster", "speech"]);
// A page the plan records as two exhibits side by side is a structure, not a family.
const MIXED_LIKE = new Set(["paired", "panels", "two-up", "two-up-contrast"]);

/**
 * The evidence family of an exhibit type: chart, table, numbers (metric
 * tiles, fact grids, cards, labelled rows), picture, text, mixed (a plan's
 * paired pages) or diagram (flows, steps, cycles, maps, frameworks - every
 * drawn structure).
 */
export function exhibitFamily(type) {
  const t = String(type ?? "").trim();
  if (t.startsWith("chart.") || CHART_LIKE.has(t)) return "chart";
  if (TABLE_LIKE.has(t)) return "table";
  if (NUMBERS_LIKE.has(t)) return "numbers";
  if (PICTURE_LIKE.has(t)) return "picture";
  if (TEXT_LIKE.has(t)) return "text";
  if (MIXED_LIKE.has(t)) return "mixed";
  return "diagram";
}

// The family a page type sets when its page draws no exhibit of its own: a
// findings matrix is its table, labelled rows and profiles their cards, a
// picture page its photographs, prose its text.
const TYPE_FAMILY = { trend: "chart", ranking: "chart", composition: "chart", relationship: "chart", bridge: "chart",
  scorecard: "table", lookup: "table", matrix: "table", mechanism: "diagram", schedule: "diagram", place: "diagram",
  numbers: "numbers", parallel: "numbers", profiles: "numbers", picture: "picture", panels: "mixed", options: "mixed",
  argument: "text", statement: "text", summary: "text" };

/** A compiled page's family: the first exhibit it draws, or what its type sets when it draws none. */
export function pageFamily(slide) {
  const [first] = exhibitsOf(slide);
  if (first) return exhibitFamily(first.type);
  if (slide.photo || slide.image) return "picture";
  if (slide.shape === "findings-matrix") return "table";
  return TYPE_FAMILY[slide.pageType?.type] ?? "text";
}

/** What a compiled page draws, at the grain VARIETY_EXHIBIT_RANGE counts: each exhibit type, or its type and form when it draws none. */
export const exhibitKinds = (slide) => {
  const types = exhibitsOf(slide).map((ex) => String(ex.type ?? "")).filter(Boolean);
  return types.length ? types : [`${slide.pageType?.type ?? "page"}/${slide.pageType?.form ?? "default"}`];
};

/**
 * The deck's exhibit mix and range on its compiled pages: each family's share,
 * the pages in it, and the distinct exhibits per ten pages. Printed in the
 * author's summary and read by the two rules below.
 */
export function exhibitMix(slides) {
  const content = slides.filter(isContent);
  const families = {};
  for (const s of content) (families[pageFamily(s)] ??= []).push(s.id ?? null);
  const kinds = new Set(content.flatMap(exhibitKinds));
  return { pages: content.length, families: Object.fromEntries(Object.entries(families).map(([f, ids]) => [f, { pages: ids.length, share: share(ids.length, content.length || 1), ids }])),
    distinct: kinds.size, perTen: content.length ? Math.round((kinds.size / content.length) * 1000) / 100 : 0, kinds: [...kinds].sort() };
}

// What a page in an over-full family can become, by family.
const MIX_REPAIR = {
  chart: "Find the pages whose claim is a quantity - a ranking, a change over time, a share, a gap to a benchmark - and draw the series or the peer set behind it (`trend`, `ranking`, `composition`, `bridge`, `relationship`). Where the data stops, that is a research task, not a styling one",
  table: "Keep the tables that are genuine look-ups; draw the rest as what they show - a ranking as bars, a change as a trend, verdicts as a coded `scorecard`, a sequence as a `schedule`",
  diagram: "Keep the diagrams that draw a real mechanism; set a list of parallel points as `parallel` labelled rows and a measured claim as a chart",
  numbers: "Give the numbers their series: a fact grid or a card set whose figures compare members or periods is a `ranking` or a `trend`, and a metric strip belongs over the exhibit it summarises",
  picture: "Keep the photographs where the subject is the evidence; the rest of the page's argument wants its exhibit",
  text: "Give the argument something to stand on: the chart, table or diagram the prose describes",
};

/**
 * Findings for a deck's content slides. `structureOf` is passed in so the
 * gate and the compiler share one definition without a circular import.
 */
// Words are not this file's business: the text contract holds every page to
// the floor for its reading task, on the text of the composed page
// (derive-content.mjs), and the rendered deck's empty space is DECK_THIN_PAGES.
export function varietyFindings(spec, options = {}) {
  // A deck revised under older rules hears the rules introduced since as advisories.
  return applyRulesVersion(contractFindings(spec, options), spec);
}

// `standings`, when given, takes where the deck stands against each rule of
// the contract, broken or not: `{ code, key?, what, value, bar, side, count?,
// of?, unit?, applies, blocks, pages?, each? }`, the record the page gates
// write too (gate_config.py `standing`). The author's report prints one line
// a rule from it on every run, so a refusal is never the first time its rule
// is mentioned.
function contractFindings(spec, { structureOf, drawnOf, standings = [] } = {}) {
  if (spec.purpose === "catalogue") return [];
  const slides = [...(spec.slides || []), ...(spec.appendix || [])].filter(isContent);
  const findings = [];
  // `rule` names the variant of a code a rules version introduced (weight.json rules.introduced).
  const block = (code, measured, threshold, repair, pages = null, rule = null) => findings.push({ slide: pages, code, ...(rule ? { rule } : {}), severity: "blocker", measured, threshold, repair });
  const stand = (code, what, value, bar, side, more = {}) => standings.push({ code, what, value, bar, side, applies: true, blocks: true, ...more });
  if (slides.length < VARIETY.from) {
    stand("VARIETY_TYPE_RANGE", "content pages (the variety contract is read from this many)", slides.length, VARIETY.from, "min", { unit: "pages", applies: false });
    return findings;
  }

  const untyped = slides.filter((s) => !s.pageType?.type);
  stand("PAGE_TYPE_UNDECLARED", "content pages with no page type", untyped.length, 0, "max", { unit: "pages" });
  if (untyped.length) {
    block("PAGE_TYPE_UNDECLARED", { pages: untyped.length, of: slides.length, ids: untyped.slice(0, 12).map((s) => s.id ?? null) }, 0,
      `${untyped.length} of ${slides.length} content pages carry no page type. Author the deck as \`<id>.pages.json\` - every page a ` +
      "`type` with its `form`, `commentary`, `takeaway` and `why` - and compile it with `node runtime/author-deck.mjs <id>.pages.json`. " +
      "`--types` lists the types. A deck written straight into the spec takes the composer's defaults on every page, which is how fifty " +
      "pages become one page repeated.", untyped.map((s) => s.id ?? null));
    return findings;
  }
  if (structureOf) {
    const edited = slides.filter((s) => s.pageType.structure && s.pageType.structure !== structureOf(s));
    stand("PAGE_TYPE_EDITED", "pages whose structure was edited after compiling", edited.length, 0, "max", { unit: "pages" });
    if (edited.length) block("PAGE_TYPE_EDITED", { pages: edited.map((s) => s.id ?? null) }, 0,
      "These pages' layout, exhibit type, arrangement or closing line no longer match the choices they were compiled from. Change the " +
      "choice in the pages file and recompile; an edit to the compiled spec is overwritten by the next compile and bypasses the contract.",
      edited.map((s) => s.id ?? null));
  }

  const n = slides.length;
  const tally = (key) => { const m = new Map(); for (const s of slides) { const k = key(s); m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); };

  const idsWhere = (test) => slides.filter(test).map((s) => s.id ?? null);
  const types = tally((s) => s.pageType.type);
  stand("VARIETY_TYPE_SHARE", `pages of the commonest type (${types[0][0]})`, share(types[0][1], n), VARIETY.typeShareMax, "max",
    { count: types[0][1], of: n, pages: idsWhere((s) => s.pageType.type === types[0][0]) });
  if (types[0][1] / n > VARIETY.typeShareMax) {
    block("VARIETY_TYPE_SHARE", { type: types[0][0], pages: types[0][1], of: n, share: share(types[0][1], n) }, VARIETY.typeShareMax,
      `${types[0][1]} of ${n} pages are ${types[0][0]} pages. Go back to the claims those pages make and ask what each has to show: ` +
      "a whole set ranked, a change over time with its rate, a mix, a mechanism, several cuts side by side, a scorecard. The type follows " +
      "the claim; a deck where one type carries a quarter of the pages has stopped asking.");
  }
  const need = Math.min(8, Math.ceil(n / 5));
  stand("VARIETY_TYPE_RANGE", "page types used", types.length, need, "min", { unit: "types" });
  if (types.length < need) {
    block("VARIETY_TYPE_RANGE", { types: types.length, pages: n, used: types.map(([t]) => t) }, need,
      `${types.length} page types across ${n} pages; a deck this long uses at least ${need}. Strong decks draw on eleven families - ` +
      "single charts, panels side by side, findings matrices, coded scorecards, parallel columns, prose, diagrams, lookups, pictures, " +
      "quotes and statements - roughly in that order of frequency.");
  }

  // Runs: a declared series (one template on purpose) counts once. The repair
  // names the page to change and what to: "change the middle page" leaves the
  // author to find which one and to guess a type its evidence could carry.
  let run = [], at = 0, longest = [];
  const flush = () => {
    const series = run[0]?.pageType.series && run.every((s) => s.pageType.series === run[0].pageType.series);
    if (!series && run.length > longest.length) longest = run;
    if (run.length > VARIETY.runMax && !series) {
      const type = run[0].pageType.type, ids = run.map((s) => s.id ?? null);
      const middle = run[Math.floor(run.length / 2)];
      const start = at - run.length;
      // The nearest page of another type the middle page can trade places
      // with: neither neighbour of its place is of the run's type, so the
      // trade breaks this run without starting another.
      const mid = start + Math.floor(run.length / 2);
      const swap = slides.map((s, j) => ({ s, j })).filter(({ s, j }) => (j < start - 1 || j > at) && s.pageType.type !== type
        && slides[j - 1]?.pageType.type !== type && slides[j + 1]?.pageType.type !== type)
        .sort((a, b) => Math.abs(a.j - mid) - Math.abs(b.j - mid))[0]?.s;
      block("VARIETY_TYPE_RUN", { type, run: run.length, pages: ids, sequence: typeSequence(slides.slice(Math.max(0, start - 1), at + 1)) }, VARIETY.runMax,
        `${run.length} ${type} pages in a row (${ids.join(", ")}) read as one page repeated. Change ${middle.id} to another type - ` +
        `${RUN_ALTERNATIVES[type] ?? "the type its evidence actually carries"}` +
        (swap ? `; or, if the storyline allows, trade places with ${swap.id} (${swap.pageType.type})` : "") +
        ". Mark a deliberate run of one template with a shared `series`.", ids);
    }
  };
  for (const slide of slides) {
    if (run.length && slide.pageType.type === run[0].pageType.type) run.push(slide);
    else { flush(); run = [slide]; }
    at += 1;
  }
  flush();
  stand("VARIETY_TYPE_RUN", `pages of one type in a row${longest.length ? ` (${longest[0].pageType.type})` : ""}`, longest.length, VARIETY.runMax, "max",
    { unit: "pages", pages: longest.map((s) => s.id ?? null) });

  // A column on the left and a column on the right are one placement to a reader.
  const placement = (s) => (s.pageType.commentary === "beside-left" ? "beside" : s.pageType.commentary);
  const commentary = tally(placement);
  stand("VARIETY_COMMENTARY", `pages on the commonest commentary placement (${commentary[0][0]})`, share(commentary[0][1], n), VARIETY.commentaryShareMax, "max",
    { count: commentary[0][1], of: n, pages: idsWhere((s) => placement(s) === commentary[0][0]) });
  if (commentary[0][1] / n > VARIETY.commentaryShareMax) {
    const [top, count] = commentary[0];
    block("VARIETY_COMMENTARY", { commentary: top, pages: count, of: n, share: share(count, n),
      mix: Object.fromEntries(commentary) }, VARIETY.commentaryShareMax,
      `${count} of ${n} pages put their explanation ${top === "below" ? "in points under the exhibit" : top === "beside" ? "in a column beside the exhibit (either side)" : `"${top}"`}. ` +
      "In strong decks the explanation lives in several places: on the chart as callouts, in the table's cells, under each panel, in a " +
      "column beside the exhibit, in a so-what bar under it, or nowhere because the exhibit and its title carry it. Choose the placement " +
      "that puts each sentence where the eye already is for that page" +
      (top === "beside" || top === "below" ? ` - and ask whether the page is one exhibit at all: ${redraws()}.` : "."));
  }
  const below = idsWhere((s) => placement(s) === "below");
  stand("VARIETY_COMMENTARY", "pages with points under the exhibit", share(below.length, n), VARIETY.belowShareMax, "max", { key: "below", count: below.length, of: n, pages: below });
  if (below.length / n > VARIETY.belowShareMax) {
    block("VARIETY_COMMENTARY", { commentary: "below", pages: below.length, of: n, share: share(below.length, n), ids: below }, VARIETY.belowShareMax,
      `${below.length} of ${n} pages put their points under the exhibit, where strong decks do it on about one page in fifty; at most ` +
      `${Math.floor(VARIETY.belowShareMax * n)} here. Put the finding on the plot as a number - the change, the gap, the total - or in the table's ` +
      `cells, a caption under each panel, a so-what bar, or nowhere when the title carries it: ${redraws()}.`, below, "VARIETY_COMMENTARY.below");
  }
  // A so-what bar is a close as much as a closing line is: counted apart, a
  // deck could close every page by moving the line into a bar.
  const closes = slides.filter((s) => s.pageType.takeaway || s.pageType.commentary === "so-what-bar").length;
  stand("VARIETY_TAKEAWAY", "pages closing on a takeaway line or a so-what bar", share(closes, n), VARIETY.takeawayShareMax, "max",
    { count: closes, of: n, pages: idsWhere((s) => s.pageType.takeaway || s.pageType.commentary === "so-what-bar") });
  if (closes / n > VARIETY.takeawayShareMax) {
    block("VARIETY_TAKEAWAY", { pages: closes, of: n, share: share(closes, n) }, VARIETY.takeawayShareMax,
      `${closes} of ${n} pages close on a takeaway line or a so-what bar. The title is the page's message; a close that restates it on every page ` +
      "is a template, and strong decks use one on about one page in ten - where the implication goes beyond the title. Keep it there, " +
      "and let the rest end on their evidence.");
  }
  const mix = structureMix(slides, { drawnOf });
  stand("VARIETY_PANELS", "pages carrying two or more exhibits", mix.multi.share, VARIETY.multiShareMin, "min",
    { count: mix.multi.pages, of: mix.pages, applies: mix.pages >= VARIETY.structureFrom });
  // This rule reads how the page is drawn, so a rail is a column here: the exhibit keeps two thirds of the width beside a side
  // panel, as it does beside points. PAGE_SHAPE_FLAT reads what the page argues with, and there a rail is one claim, not commentary.
  stand("VARIETY_COLUMN", "pages of one exhibit beside a text column", mix.column.share, VARIETY.columnShareMax, "max",
    { count: mix.column.pages, of: mix.pages, applies: mix.pages >= VARIETY.structureFrom, pages: mix.column.ids, note: RAIL_AS_COLUMN });
  if (mix.pages >= VARIETY.structureFrom && mix.multi.share < VARIETY.multiShareMin) {
    block("VARIETY_PANELS", { pages: mix.multi.pages, of: mix.pages, share: mix.multi.share }, VARIETY.multiShareMin,
      `${mix.multi.pages} of ${mix.pages} pages carry two or more exhibits; a deck this long needs ${Math.ceil(VARIETY.multiShareMin * mix.pages)}, and strong decks ` +
      "carry them on a quarter to a third of their pages - the same measure for several members, two measures that together prove the claim, " +
      `before and after, cause and effect. Find the pages where the reader would otherwise hold one chart in mind while turning to the next, and draw them as: ${redraws(true)}.`,
      null);
  }
  if (mix.pages >= VARIETY.structureFrom && mix.column.share > VARIETY.columnShareMax) {
    block("VARIETY_COLUMN", { pages: mix.column.pages, of: mix.pages, share: mix.column.share, ids: mix.column.ids }, VARIETY.columnShareMax,
      `${mix.column.pages} of ${mix.pages} pages are one exhibit with a text column beside it - points beside or before it, a rail, or a hero number ` +
      `with its points - where strong decks draw about one page in eight that way; at most ${Math.floor(VARIETY.columnShareMax * mix.pages)} here. ` +
      `Keep the column where the argument needs a paragraph the exhibit cannot hold, and redraw the rest as what they show: ${redraws()}.`,
      mix.column.ids);
  }
  const depth = evidenceDepth(slides);
  stand("EVIDENCE_DEPTH", "values the median chart page plots", depth.median, VARIETY.evidenceMedianMin, "min", { unit: "values", applies: depth.chartPages >= VARIETY.evidenceFrom,
    each: Object.fromEntries(slides.filter((s) => s.pageType?.chart && Number.isFinite(s.pageType.values)).map((s) => [s.id ?? "?", s.pageType.values])),
    ...(depth.median < VARIETY.evidenceMedianTarget ? { note: `advised: under strong decks' ${VARIETY.evidenceMedianTarget}, which a peer set, a second series or a longer window on the thinnest pages reaches` } : {}) });
  if (depth.chartPages >= VARIETY.evidenceFrom && depth.median < VARIETY.evidenceMedianMin) {
    block("EVIDENCE_DEPTH", depth, VARIETY.evidenceMedianMin,
      `The median chart page plots ${depth.median} values across ${depth.chartPages} chart pages; strong decks' chart pages plot about 22 ` +
      `(the middle half 10 to 48), and this deck's median has to reach ${VARIETY.evidenceMedianMin}. Deepen the thinnest - ${depth.thinnest.join(", ")} - ` +
      "with the evidence a sharp team would have gathered: the whole peer set sorted (ranking form `distribution`), several measures for the " +
      "same members (`aligned-bars`), the subject indexed against its peers (trend form `indexed`), a prior period or a benchmark as a second " +
      "series, a longer window. Where the data stops, that is a research task, not a styling one.", depth.thinnest.map((t) => t.split(" ")[0]));
  }
  // The drawn skeleton the compiler recorded (page-types.mjs skeletonOf); a
  // deck compiled before it was recorded falls back to its declared choices.
  const signatureOf = (s) => s.pageType.skeleton ?? `${s.pageType.type} · ${s.pageType.commentary} · ${s.pageType.takeaway ? "close" : "open"}`;
  const signature = tally(signatureOf);
  stand("VARIETY_SIGNATURE", `pages drawn as the commonest skeleton (${signature[0][0]})`, share(signature[0][1], n), VARIETY.signatureShareMax, "max",
    { count: signature[0][1], of: n, pages: idsWhere((s) => signatureOf(s) === signature[0][0]) });
  if (signature[0][1] / n > VARIETY.signatureShareMax) {
    const ids = slides.filter((s) => signatureOf(s) === signature[0][0]).map((s) => s.id ?? null);
    block("VARIETY_SIGNATURE", { signature: signature[0][0], pages: signature[0][1], of: n, ids }, VARIETY.signatureShareMax,
      `${signature[0][1]} of ${n} pages are drawn as the same page: ${signature[0][0]}. They may declare different types, but a reader ` +
      "sees one layout repeated. Go back to what each has to show and draw the pages that are not one exhibit as what they are: " +
      `${redraws()}. A deck's rhythm comes from pages that ask the reader to do different things.`, ids);
  }
  findings.push(...mixFindings(slides, stand));
  findings.push(...reviewedDeckFindings(spec, slides, stand));
  return findings;
}

/**
 * VARIETY_EXHIBIT_MIX and VARIETY_EXHIBIT_RANGE: the bands weight.json
 * `plan.mixEnforced` names, and the exhibit range floor, on the compiled
 * pages. The deck is already long enough to judge (VARIETY.from).
 */
function mixFindings(slides, stand) {
  const findings = [];
  const block = (code, measured, threshold, repair, pages = null, rule = null) => findings.push({ slide: pages, code, ...(rule ? { rule } : {}), severity: "blocker", measured, threshold, repair });
  const mix = exhibitMix(slides);
  for (const band of PLAN.mixEnforced.bands) {
    const [family, side] = band.split(".");
    const limit = PLAN.mix[family]?.[side];
    if (limit === undefined) continue;
    const got = mix.families[family] ?? { pages: 0, share: 0, ids: [] };
    const exact = got.pages / mix.pages;
    stand("VARIETY_EXHIBIT_MIX", `pages carried by ${family === "numbers" ? "numbers or cards" : family === "text" ? "text" : `a ${family}`}`, got.share, limit, side, { key: band, count: got.pages, of: mix.pages, pages: got.ids });
    if (side === "min" ? exact >= limit : exact <= limit) continue;
    const shares = Object.fromEntries(Object.entries(mix.families).map(([f, v]) => [f, v.share]));
    // A band a rules version lowered: a share between its old bar and the new is the rule as tightened (weight.json rules.tightened).
    const lowered = RULES.tightened?.[`VARIETY_EXHIBIT_MIX.${band}`];
    block("VARIETY_EXHIBIT_MIX", { family, share: got.share, pages: got.pages, of: mix.pages, direction: side === "min" ? "below" : "above", mix: shares, ids: got.ids }, limit,
      side === "min"
        ? `${got.pages} of ${mix.pages} pages are carried by a ${family} (${Math.round(exact * 100)}%); a deck this long carries at least ${Math.round(limit * 100)}%. ${MIX_REPAIR[family]}.`
        : `${got.pages} of ${mix.pages} pages are carried by ${family === "numbers" ? "numbers or cards" : `a ${family}`} (${Math.round(exact * 100)}%, ${got.ids.slice(0, 12).join(", ")}); at most ${Math.round(limit * 100)}%. ${MIX_REPAIR[family]}.`,
      side === "min" ? null : got.ids, lowered && exact <= lowered.before ? `VARIETY_EXHIBIT_MIX.${band}.tightened` : null);
  }
  const floor = PLAN.craft.exhibitVarietyPerTen.min;
  // The floor is a rate per ten pages; in kinds, it is the fewest this deck's length allows.
  stand("VARIETY_EXHIBIT_RANGE", `kinds of exhibit drawn (${floor} per ten pages)`, mix.distinct, Math.ceil((floor * mix.pages) / 10 - 1e-9), "min", { unit: "kinds" });
  if ((mix.distinct / mix.pages) * 10 < floor) {
    block("VARIETY_EXHIBIT_RANGE", { perTen: mix.perTen, distinct: mix.distinct, pages: mix.pages, kinds: mix.kinds }, floor,
      `This deck draws ${mix.distinct} kinds of exhibit across ${mix.pages} pages - ${mix.perTen} per ten, against a floor of ${floor} and ` +
      `${PLAN.craft.exhibitVarietyPerTen.observed.join(", ")} in the example decks. It uses ${mix.kinds.join(", ")}. Ask what each page's evidence ` +
      "actually is before reaching for the shape the last page used: a sequence can be a timeline or a gantt, a composition a marimekko or a " +
      "waffle, a ranking a lollipop, a distribution a boxplot or a dumbbell, two measures on one category a combo, a mechanism a flow or a cycle.");
  }
  return findings;
}

// How a deck's exhibits are shared between kinds. The range floor (VARIETY_EXHIBIT_RANGE) asks for a number of kinds and is met
// by a deck that draws a dozen kinds once each and three of them forty times: three decks written from one brief each drew 14
// or 15 kinds and set 63% to 70% of their exhibits as a table, a bar chart and a line chart. `max` is a mark to read the share
// against, not a calibrated bar: the reference decks were measured by exhibit family, not kind, so there is nothing to calibrate
// a kind share on. It sits between those decks and the skill's own worked decks (the worked example sets half its exhibits in
// its three commonest kinds). It is read from two dozen exhibits: under that three kinds carry most of any deck (a deck of
// twelve at the range floor draws five kinds, and three of five is 60%), and the share says nothing. And it only advises: which kind a page takes is decided by what the page claims (claim-fit.mjs), so the remedy it names is the free
// choices among the pages drawn in those kinds - and where there are none, it says the mix follows from the claims.
export const KIND_SHARE = Object.freeze({ top: 3, max: 0.55, from: 24 });

/**
 * Two readings of a deck's exhibits that no rule holds, as standings and
 * advisories:
 *
 *   VARIETY_KIND_SHARE  the share of the exhibits drawn in the three commonest
 *                       kinds (KIND_SHARE), with the pages among them that
 *                       could take another kind at the same fit
 *   VARIETY_FIT_UNUSED  the pages drawn in a form - or carrying an exhibit in a
 *                       kind - that carries their claim less directly than
 *                       another their measures fill ("fit left on the table")
 *
 * `fits` is each page's fit by id (claim-fit.mjs pageFit, deck-structure.mjs
 * fitsOf); without an insight log there is none, and only the share is read.
 * `kept` is, on a revision, the ids of the pages kept as their source slide
 * drew them (deck-structure.mjs keptAsSource; null for new work): such a page
 * is the user's own drawing - it is counted in the share and never counted as
 * fit unused. The fit is read on the pages the revision adds or redraws, and
 * on those only; and the share of a revision is a standing and never an
 * advisory, since a revision draws its pages as the source deck draws them.
 * `carried` is the exhibits of the slides a revision carries from its source
 * deck, `[{ id, kind }]` as the inventory read them (deck-structure.mjs
 * carriedKinds): a carried slide is never compiled, so its exhibits are
 * counted in the share from there, and nothing of it is judged.
 */
export function fitStandings(spec, { fits = new Map(), kept = null, carried = [] } = {}) {
  if (spec.purpose === "catalogue") return { findings: [], standings: [] };
  const slides = [...(spec.slides || []), ...(spec.appendix || [])].filter(isContent);
  const drawn = [...slides.flatMap((slide) => exhibitsOf(slide).map((ex) => ({ id: String(slide.id), kind: String(ex.type ?? "") }))), ...carried.map((item) => ({ id: String(item.id), kind: String(item.kind ?? "") }))].filter((item) => item.kind);
  const tally = new Map();
  for (const item of drawn) tally.set(item.kind, (tally.get(item.kind) ?? 0) + 1);
  const top = [...tally].sort((a, b) => b[1] - a[1]).slice(0, KIND_SHARE.top);
  const count = top.reduce((sum, [, n]) => sum + n, 0), value = drawn.length ? Math.round((count / drawn.length) * 1000) / 1000 : 0;
  const applies = drawn.length >= KIND_SHARE.from;
  const own = (id) => !kept?.has(String(id));
  const known = [...fits.values()].filter(Boolean);
  // What a page could take in place of what it draws, at the same fit: the latitude the deck has without changing what any page claims.
  const free = known.filter((fit) => own(fit.id)).flatMap((fit) => [
    ...(fit.chosen && fit.chosen.grade === fit.forms.top && fit.forms.equal.length > 1 ? [{ id: fit.id, has: `${fit.type}/${fit.form}`, kind: fit.forms.equal.find((item) => item.form === fit.form)?.kind, also: fit.forms.equal.filter((item) => item.form !== fit.form).map((item) => item.form) }] : []),
    // A chart among charts is free to be another chart: a table in its place is the author's call for exact values, never the plan's.
    ...fit.exhibits.filter((item) => item.grade !== null && item.grade === item.kinds.top).map((item) => ({ id: fit.id, has: item.kind, kind: item.kind, also: item.kinds.equal.map((kind) => kind.kind).filter((kind) => kind !== item.kind && kind.startsWith("chart.")) })),
  ]).filter((item) => item.also.length && top.some(([kind]) => kind === item.kind))
    // One entry a page and form: two panels of one kind are one choice.
    .reduce((list, item) => { const same = list.find((other) => other.id === item.id && other.has === item.has); if (same) same.also = [...new Set([...same.also, ...item.also])]; else list.push({ ...item }); return list; }, []);
  const left = known.filter((fit) => fit.left.length), ours = left.filter((fit) => own(fit.id));
  const keeps = (kept ? slides.filter((slide) => kept.has(String(slide.id))).length : 0) + new Set(carried.map((item) => String(item.id))).size;
  const imported = keeps ? `; ${keeps} of the deck's pages are kept as the source deck drew them, counted here and not judged` : "";
  // The standing line names what to do about it, since an advisory's repair is not printed with a refusal: a few pages, the rest counted.
  const short = (kind) => String(kind).replace(/^chart\./, "");
  const some = (list, say) => `${list.slice(0, 6).map(say).join("; ")}${list.length > 6 ? `; and ${list.length - 6} more` : ""}`;
  // A revision is told the share and nothing to do about it: its pages are drawn as the source deck draws them, and consistency with that deck comes before spread.
  const latitude = kept ? "; read of the imported deck as revised, which a revision does not redraw" : free.length ? `; carried as directly by another form, so free to differ: ${some(free, (item) => `${item.id} ${short(item.has)} (or ${item.also.map(short).join(", ")})`)}` : drawn.length && fits.size ? "; no page in those kinds is carried as directly by another form" : "";
  const mend = ours.length ? `: ${some(ours, (fit) => `${fit.id} ${fit.left.map((item) => `${item.where === "form" ? "form" : item.where} ${short(item.has)} -> ${item.better.map(short).join(" or ")}`).join(", ")}`)}` : "";
  const standings = [
    { code: "VARIETY_KIND_SHARE", what: `exhibits drawn in the ${KIND_SHARE.top} commonest kinds (${top.map(([kind, n]) => `${kind} ${n}`).join(", ") || "none"}), of ${drawn.length}`, value, bar: KIND_SHARE.max, side: "max", unit: "share", applies, blocks: false,
      pages: [...new Set(free.map((item) => String(item.id)))], note: `advised, never refused; a mark to read the share against, not a bar calibrated on the reference decks${latitude}${imported}` },
    ...(fits.size ? [{ code: "VARIETY_FIT_UNUSED", what: "pages drawn in a form that carries their claim less directly than another they could take", value: ours.length, bar: 0, side: "max", unit: "pages", applies: true, blocks: false,
      pages: ours.map((fit) => String(fit.id)), note: `advised, never refused${mend}${imported}` }] : []),
  ];
  const findings = [];
  if (applies && value > KIND_SHARE.max && !kept) findings.push({ code: "VARIETY_KIND_SHARE", severity: "advisory", slide: [...new Set(free.map((item) => item.id))], measured: { share: value, exhibits: drawn.length, kinds: Object.fromEntries(top) }, threshold: KIND_SHARE.max,
    repair: `${count} of the deck's ${drawn.length} exhibits are ${top.map(([kind, n]) => `${kind} (${n})`).join(", ")} - ${Math.round(value * 100)}%. ` +
      (free.length ? `No page need claim anything else to change that: ${free.slice(0, 12).map((item) => `${item.id} (${item.has}) is carried as directly by ${item.also.join(" or ")}`).join("; ")}${free.length > 12 ? `; and ${free.length - 12} more` : ""}. Take another of those forms where the deck repeats one - \`--plan\` gives each such page the form whose turn it is in the deck's draw (its \`variation\`), and says which on the page's line.`
        : `None of the pages in those kinds is carried as directly by another form, so the mix follows from what the pages claim: a wider mix needs evidence of another shape - a gap between two points, a part of a whole, two measures set against each other - not another chart of the same one.`) });
  if (ours.length) findings.push({ code: "VARIETY_FIT_UNUSED", severity: "advisory", slide: ours.map((fit) => fit.id), measured: { pages: ours.length },
    repair: ours.slice(0, 12).map((fit) => `${fit.id}: ${fit.left.map((item) => `${item.where === "form" ? `form \`${item.has}\`` : `${item.where} (\`${item.has}\`)`} ${FIT_WORDS[item.grade]}${item.where === "form" ? "" : ` of its measures`}; ${item.better.map((name) => `\`${name}\``).join(" or ")} ${item.better.length === 1 ? "carries" : "carry"} it directly`).join(", and ")}`).join(" | ") +
      `${ours.length > 12 ? ` | and ${ours.length - 12} more` : ""}. A form within the page's type is the layout's to change, and keeps the storyline critique; keep the form where the page's point is something the measures do not say, and say so in \`why\`` });
  return { findings, standings };
}

// Deck-level defects that show only across the whole deck, read from the compiled pages.
export const REVIEWED = Object.freeze({ tableWindow: 10, tableRunMax: 5, earlyPages: 3, titleShare: 0.2, titleNames: 2 });

// The coded-cell vocabulary the compiler (page-types.mjs) and these rules both
// read, kept here because the compiler imports this module and not the other
// way round; a table and its rows are evidence.mjs's `isTable` and `rowCells`.
/** Column and cell types the composer draws as a code - a mark, a pill, a bar, a number badge, a logo - rather than as text. */
export const CODED = new Set(["binary", "harvey", "heatmap", "bars", "rag", "lights", "progress", "dot", "check", "trend", "number", "logo", "photo"]);
const exhibitsOf = (slide) => [slide.exhibit, ...(slide.exhibits || [])].filter((ex) => ex && typeof ex === "object");

/**
 * The deck's players by every name a page may use for them - the name, its
 * `short` and its `aliases`, lower-cased - each mapped to the player's name.
 * A table cell naming a player is drawn as its logo, a panel headed by one is
 * that player's panel, and an early logo under a short name introduces it.
 * All three read this one map, so a player declared as "Southgate Labs" with
 * short "Southgate" is the same player to each.
 */
export function playerNames(players) {
  const names = new Map();
  for (const p of Array.isArray(players) ? players : []) {
    const player = typeof p === "string" ? { name: p } : p;
    if (typeof player?.name !== "string" || !player.name.trim()) continue;
    for (const alias of [player.name, player.short, ...(player.aliases || [])])
      if (typeof alias === "string" && alias.trim()) names.set(alias.trim().toLowerCase(), player.name);
  }
  return names;
}

/**
 * How a page's table reads before a word of it is read: the first column
 * filled or open, cells coded or all text, a short grid or a long one, and a
 * band across its foot or none. Tables of one grammar close together read as
 * one page repeated, however different what they hold: funding stages,
 * commitments and verdicts all set as dark first-column text grids closed by a
 * grey strip.
 */
export function tableConstruction(slide) {
  const table = exhibitsOf(slide).find(isTable);
  if (!table && slide.shape !== "findings-matrix") return null;
  const columns = table?.columns || [];
  const rows = table ? table.rows || [] : slide.rows || [];
  const first = !table || table.treatment === "categories" || (table.treatment === undefined && columns.some((c) => c?.type === "category"))
    ? "filled first column" : table.treatment === "standard" ? "filled header" : "open first column";
  const coded = columns.some((c) => CODED.has(c?.type) || c?.heat || c?.bar || c?.harvey)
    || rows.some((row) => rowCells(row).some((cell) => CODED.has(cell?.type)));
  return [first, coded ? "coded cells" : "text cells", rows.length > 8 ? "long" : "short", slide.soWhat ? "a band at the foot" : "open foot"].join(" · ");
}

function reviewedDeckFindings(spec, slides, stand) {
  const findings = [];
  const block = (code, measured, threshold, repair, pages = null) => findings.push({ slide: pages, code, severity: "blocker", measured, threshold, repair });
  const analytical = slides.filter((s) => s.pageType && !["statement", "summary"].includes(s.pageType.type));
  // Table monotony: the worst window of ten analytical pages.
  let worst = null, most = [];
  for (let at = 0; at + REVIEWED.tableWindow <= Math.max(analytical.length, REVIEWED.tableWindow); at += 1) {
    const window = analytical.slice(at, at + REVIEWED.tableWindow), tally = new Map();
    for (const s of window) { const key = tableConstruction(s); if (key) tally.set(key, [...(tally.get(key) || []), s.id ?? null]); }
    for (const [key, ids] of tally) {
      if (ids.length > most.length) most = ids;
      if (ids.length > REVIEWED.tableRunMax && (!worst || ids.length > worst.ids.length)) worst = { key, ids, from: window[0]?.id ?? null, to: window.at(-1)?.id ?? null };
    }
  }
  stand("VARIETY_TABLES", `pages of one table construction in any ${REVIEWED.tableWindow} consecutive analytical pages`, most.length, REVIEWED.tableRunMax, "max", { unit: "pages", pages: most });
  if (worst) block("VARIETY_TABLES", { construction: worst.key, pages: worst.ids.length, window: [worst.from, worst.to], ids: worst.ids }, REVIEWED.tableRunMax,
    `${worst.ids.length} of the ${REVIEWED.tableWindow} analytical pages from ${worst.from} to ${worst.to} are the same table - ${worst.key} (${worst.ids.join(", ")}). ` +
    "A reader stops telling them apart, and the differences in the evidence go with them. Draw each as what its evidence is: funding stages or a " +
    "cash position as a bridge or a flow (`bridge`, `mechanism` form `flow`), commitments over time as bars aligned on their durations (`schedule` " +
    "form `gantt`, `ranking` form `aligned-bars`), verdicts as a coded scorecard (`scorecard` forms harvey, rag, check), measures as a chart; keep the table for the look-up.", worst.ids);

  // Identity: the players the deck compares, shown by their marks early.
  const aliases = playerNames(spec.players);
  const players = [...new Set(aliases.values())];
  const named = players.length >= 2 ? players : titleNames(analytical);
  if (named.length >= 2) {
    const early = [spec.cover, ...analytical.slice(0, REVIEWED.earlyPages)].filter(Boolean);
    const marks = early.flatMap(logoTexts).join(" \n ").toLowerCase();
    // A logo under any of the player's names introduces it.
    const unmarked = named.filter((name) => ![name.toLowerCase(), ...[...aliases].filter(([, n]) => n === name).map(([alias]) => alias)].some((alias) => marks.includes(alias)));
    stand("PLAYERS_UNMARKED", `compared players with no logo on the cover or the first ${REVIEWED.earlyPages} pages`, unmarked.length, 0, "max", { unit: "players" });
    if (unmarked.length) block("PLAYERS_UNMARKED", { players: named, unmarked, pages: early.map((p) => p.id ?? "cover") }, 0,
      `The deck compares ${named.join(", ")}${players.length >= 2 ? "" : " (named in its titles again and again)"}, and neither the cover nor the first ${REVIEWED.earlyPages} pages ` +
      `shows ${unmarked.length === named.length ? "their logos" : `the logo of ${unmarked.join(", ")}`}. Introduce them by their marks before the evidence starts: a \`profiles\` page ` +
      "(form `logos`, or `logo-table` with each player's numbers), or a `logo` column in an early table. " +
      // A deck that declares it is built without the network (asset-needs.mjs) fetches nothing: the cell that names its player prints the name.
      (spec.assets?.fetch === "none" ? "Write each as a `logo` cell that names its `player`: the deck declares it is built without the network, so the cell prints the name where the mark would be."
        : `Write each as \`{ alt: "<Name> logo" }\` - the build fetches it from the player's Wikipedia infobox${players.length >= 2 ? "" : "; declare them in the deck's `players` so it can"}.`),
      early.map((p) => p.id ?? "cover"));
  }
  // A page that introduces players or products as cards is about what they look like as much as what they do.
  for (const s of slides.filter((slide) => slide.pageType?.type === "profiles" && slide.pageType.form === "cards")) {
    const items = exhibitsOf(s).some(isTable) ? [] : (s.exhibit?.items || []);
    if (items.length && !items.some((item) => ["logo", "media", "image", "photo", "picture"].some((key) => item?.[key])))
      block("PROFILE_UNPICTURED", { page: s.id ?? null, cards: items.length }, 1,
        `${s.id}: ${items.length} cards introduce ${items.map((item) => item?.title ?? item?.name).filter(Boolean).slice(0, 4).join(", ")} with no logo or picture on any of them. ` +
        "A reader recognises a company by its mark and a product by its look: give each card its `logo` ({ alt: \"<Name> logo\" }, fetched by name) or a credited " +
        "`image` ({ alt, search }, fetched from Wikimedia Commons), or introduce them as form `logos`.", [s.id ?? null]);
  }
  return findings;
}

/** Every logo a page draws, as the text that names it: `{ alt }` logos, logo cells, logos exhibits. */
function logoTexts(page) {
  const found = [];
  const walk = (value, inLogo) => {
    if (Array.isArray(value)) return value.forEach((v) => walk(v, inLogo));
    if (!value || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value)) {
      if (key === "alt" && typeof v === "string" && (inLogo || /\blogo\b/i.test(v))) found.push(v);
      else walk(v, inLogo || key === "logo" || (key === "exhibit" && v?.type === "logos"));
    }
    if (value.type === "logos") found.push(...(value.items || []).map((item) => String(item?.name ?? "")));
    // A logo cell that names its player marks that player, with a file to draw or without: the refusal tells the author to
    // write one, so the rule reads the key it names (`player`) as well as the image's `alt`.
    if (value.type === "logo" && typeof value.player === "string" && value.player.trim()) found.push(value.player);
  };
  walk(page, false);
  return found;
}

/**
 * The organisations a deck without `players` keeps naming: capitalised names
 * in a fifth of its titles or more, never written in lower case. Two or more
 * of them make a comparison of named players.
 */
function titleNames(slides) {
  const titles = slides.map((s) => String(s.title ?? ""));
  if (titles.length < 8) return [];
  const lower = new Set(titles.join(" ").match(/\b[a-z][a-z'’]+\b/g) ?? []);
  const counts = new Map();
  for (const title of titles) for (const name of new Set((title.match(/\b[A-Z][A-Za-z0-9]*[A-Z0-9]?[A-Za-z0-9]*\b/g) ?? []).filter((w) => w.length > 2 && !lower.has(w.toLowerCase()))))
    counts.set(name, (counts.get(name) || 0) + 1);
  const names = [...counts].filter(([, n]) => n >= Math.max(4, REVIEWED.titleShare * titles.length)).map(([name]) => name);
  return names.length >= REVIEWED.titleNames ? names : [];
}
