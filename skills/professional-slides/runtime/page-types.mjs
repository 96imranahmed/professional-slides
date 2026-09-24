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

import { REGISTRY } from "./registry.mjs";
import { trivialChart } from "./gates/craft_gates.mjs";
import { calloutFits } from "./chart-annotations.mjs";

// Where the page's explanation lives. Each maps onto what the composer draws.
export const COMMENTARY = Object.freeze({
  beside: "a commentary column to the right of the exhibit",
  "beside-left": "a commentary column to the left of the exhibit",
  below: "points in a band under the exhibit",
  rail: "one claim in a filled side panel (`rail` text) beside the exhibit",
  "on-exhibit": "callouts on the chart itself (`annotations`), no separate text",
  "in-exhibit": "the explanation lives in the exhibit's cells (an implication column, a findings matrix, labelled cards)",
  captions: "one finding under each panel (`caption` on every exhibit)",
  none: "the exhibit carries the page alone",
});

const CHART = (name) => `chart.${name}`;
const ANY_TEXT = ["beside", "beside-left", "below", "rail"];

/**
 * The catalogue. `forms` maps each allowed form to the exhibit type or page
 * construction it compiles to; `commentary` lists the placements the type can
 * take. `requires` names the content the page must carry.
 */
export const PAGE_TYPES = Object.freeze({
  trend: {
    task: "how a measure moved over time, with the rate or the break marked on the plot",
    forms: { line: CHART("line"), column: CHART("column"), "stacked-column": CHART("stacked-column"), area: CHART("area"),
      "stacked-area": CHART("stacked-area"), combo: CHART("combo"), slope: CHART("slope") },
    commentary: [...ANY_TEXT, "on-exhibit"], exhibits: 1, marked: true, periods: true,
  },
  ranking: {
    task: "where every member of the set stands on one measure, the subject marked",
    forms: { bar: CHART("bar"), column: CHART("column"), lollipop: CHART("lollipop"), dumbbell: CHART("dumbbell"), bullet: CHART("bullet") },
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
    forms: { row: "row", grid: "grid", stack: "stack" },
    commentary: ["captions", "below", "none"], exhibits: [2, 4],
  },
  scorecard: {
    task: "options or members judged against criteria, each cell coded",
    forms: { harvey: "harvey", heatmap: "heatmap", rag: "rag", lights: "lights", check: "check", bars: "bars",
      progress: "progress", dot: "dot", trend: "trend", binary: "binary" },
    commentary: ["in-exhibit", "beside", "below", "none"], exhibits: 1, table: true,
  },
  lookup: {
    task: "measures a reader looks up and compares, grouped under their units",
    forms: { "measure-table": "measure-table", table: "table" },
    commentary: ["in-exhibit", "beside", "below", "none"], exhibits: 1, table: true,
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
    commentary: ["beside", "below", "none"], exhibits: 1,
  },
  numbers: {
    task: "a few measured numbers that carry the claim, with the evidence under them",
    forms: { "hero-number": "hero-number", "metric-strip": "metrics-over-exhibit", "fact-grid": "fact-grid", "stat-list": "stat-list" },
    commentary: ["beside", "below", "none"], exhibits: [0, 1],
  },
  parallel: {
    task: "three to six parallel ideas, each headed, often with an icon",
    forms: { cards: "cards", capsules: "capsules", "arrow-rows": "arrow-rows" },
    commentary: ["in-exhibit", "below", "none"], exhibits: [0, 1],
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
export const SHAPES = Object.freeze({
  series: { kind: "rate", means: "one measure over four or more periods" },
  "peer-set": { kind: "rank", means: "one measure for every member of the set" },
  mix: { kind: "share", means: "the parts of a whole" },
  "measure-pair": { kind: "comparison", means: "two measures for each member" },
  bridge: { kind: "structure", means: "the steps between two totals" },
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
// The exhibit family each type reads as, for its reading task (reading-tasks.json).
const FAMILY = { trend: "chart", ranking: "chart", composition: "chart", relationship: "chart", bridge: "chart",
  scorecard: "table", lookup: "table", matrix: "table", mechanism: "diagram", schedule: "diagram",
  argument: "text", statement: "text", summary: "text" };
export const familyOf = (type, form) => (type === "profiles" && form === "logo-table") || (type === "options" && form !== "two-up") ? "table" : FAMILY[type] ?? "exhibit";

// Keys the compiler owns. Written by the author they would bypass the choices.
const OWNED = ["layout", "shape", "arrange", "soWhat", "pageType"];
// Keys of a typed page that are choices or authoring notes, not slide keys.
const CHOICE_KEYS = ["type", "form", "commentary", "takeaway", "why", "series", "rail", "settles", "adds", "evidence"];

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

// What each component can hold, as its renderer enforces it: published in the
// catalogue and checked at compile, so an author learns a donut's five-part
// limit from `--types`, not from a failed composition.
export const LIMITS = Object.freeze({
  "chart.pie": { key: "labels", min: 2, max: 5 }, "chart.donut": { key: "labels", min: 2, max: 5 },
  "chart.slope": { key: "categories", min: 2, max: 4 }, "chart.treemap": { key: "items", min: 2, max: 20 },
  "chart.sparklines": { key: "items", min: 2, max: 12 }, cycle: { key: "items", min: 3, max: 6 }, steps: { key: "items", min: 3, max: 6 },
  people: { key: "items", min: 2, max: 5 }, logos: { key: "items", min: 2, max: 12 }, cards: { key: "items", min: 2, max: 6 },
  takeaways: { key: "items", min: 2, max: 5 }, gantt: { key: "periods", min: 2 },
});

// The least a page of each type carries to be worth a page. Below it the type
// was chosen for less evidence than it needs: a three-phase roadmap, a two-part
// pie and a four-row matrix each left half a page empty on a real deck.
const MINIMUM = Object.freeze({
  composition: (ex, form) => ["pie", "donut", "treemap"].includes(form)
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
  "two-up-contrast": ["exhibits"], "table-halves": ["exhibits"], row: ["exhibits"], grid: ["exhibits"], stack: ["exhibits"],
};
export function dataKeys(exhibitType) {
  if (CONSTRUCTION_DATA[exhibitType]) return CONSTRUCTION_DATA[exhibitType];
  const sample = REGISTRY.get(exhibitType)?.sample;
  return sample ? Object.keys(sample).filter((key) => !STYLING.has(key)) : [];
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
  if (page.takeaway === undefined || !(page.takeaway === false || (typeof page.takeaway === "string" && page.takeaway.trim())))
    throw new Error(`${id}: choose \`takeaway\` - false, or the closing sentence. Strong decks close about one page in ten on a line; most let the title carry the message.`);
  if (typeof page.why !== "string" || page.why.trim().split(/\s+/).length < 4)
    throw new Error(`${id}: say in \`why\` why a ${page.type} page (${type.task}) is the right one for this claim`);

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

  // The form sets the exhibit's type, so the form is the choice that counts.
  const setType = (ex, value) => {
    if (ex.type !== undefined && ex.type !== value) throw new Error(`${id}: form "${page.form}" draws ${value}, but the exhibit says type "${ex.type}"; drop the exhibit's type and let the form set it`);
    ex.type = value;
  };
  if (target.startsWith("chart.") || ["mechanism", "schedule"].includes(page.type) || (page.type === "profiles" && page.form !== "logo-table")
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
  }
  const minimum = primary && MINIMUM[page.type]?.(primary, page.form);
  if (typeof minimum === "string") throw new Error(`${id}: ${minimum}`);
  // Small counts are counted, not shared out: fourteen cities as 50% / 29% / 14%
  // / 7% of a pie reads as precision the count does not have.
  if (page.type === "composition" && ["pie", "donut", "treemap"].includes(page.form)) {
    const values = (primary.values || (primary.items || []).map((item) => item.value) || []).map(Number);
    const total = values.reduce((a, b) => a + b, 0);
    if (values.length && values.every(Number.isInteger) && total < 25)
      throw new Error(`${id}: ${total} items shared out as percentages overstates a small count - show the counts (a waffle, or a ranking of the parts)`);
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
  if (textless && points && !["summary"].includes(page.type))
    throw new Error(`${id}: commentary "${page.commentary}" puts the explanation ${COMMENTARY[page.commentary].replace(/^the /, "")}; move the points there or choose "beside" or "below"`);
  // A draft is the spine: titles, types, data and evidence. The copy checks
  // below wait for the full compile.
  // The finding is marked in each point, not only the first: a page-level
  // phrase is accented where it occurs, so a single phrase lit one point and
  // left the rest grey. `highlight` takes a list - a phrase from each point -
  // or a point carries its own.
  if (!draft && points >= 2 && ["beside", "beside-left", "below"].includes(page.commentary)) {
    const phrases = (Array.isArray(page.highlight) ? page.highlight : page.highlight ? [page.highlight] : []).map((p) => String(p).toLowerCase());
    const marked = (page.points || []).filter((point) => {
      const text = (typeof point === "string" ? point : `${point?.lead ?? ""} ${point?.text ?? ""}`).toLowerCase();
      return (point && typeof point === "object" && point.highlight) || phrases.some((p) => p && text.includes(p));
    }).length;
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
    slide.panel = { text: String(page.rail ?? "").trim() || page.title };
  }
  const layoutFor = { beside: "exhibit-left", "beside-left": "exhibit-right", below: "exhibit-top", rail: "sidebar" };
  if (page.type === "panels") {
    if (page.form === "grid" && exhibits.length < 3) throw new Error(`${id}: a grid of panels holds three or four; two sit in a row`);
    slide.arrange = page.form;
    if (page.exhibit) { slide.exhibits = [page.exhibit, ...(page.exhibits || [])]; delete slide.exhibit; }
  } else if (page.type === "numbers") {
    if (page.form === "hero-number") { if (!page.kpi) throw new Error(`${id}: a hero-number page names its number as \`kpi\``); slide.layout = "hero-number"; }
    else if (page.form === "metric-strip") { if (!(page.metrics || []).length) throw new Error(`${id}: a metric strip carries \`metrics\``); slide.layout = "metrics-over-exhibit"; }
    else slide.layout = layoutFor[page.commentary] ?? "exhibit-full";
  } else if (page.type === "picture") {
    slide.layout = target;
  } else if (page.type === "options") {
    if (page.form === "compare") setType(primary, "compare");
    else slide.layout = target;
  } else if (page.type === "argument") {
    if (!(page.paragraphs || []).length && !points) throw new Error(`${id}: an argument page carries its \`paragraphs\``);
    slide.layout = target;
    if (page.form === "sidebar" && !page.panel) throw new Error(`${id}: a sidebar argument sets its claim in \`panel\``);
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
    ...(advisories.length ? { advisories } : {}),
    // The claim is the title: the build holds the two together.
    content: { claim: String(page.title ?? page.text ?? "").trim(), ...(settles ? { settles } : {}), adds: page.adds ?? null, ...(evidence.length ? { evidence } : {}) } };
  slide.pageType.structure = structureOf(slide);
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

/** The catalogue as the author reads it. */
export function describeTypes() {
  const lines = ["# Page types", "", "Every analytical page is one of these. Each choice is required; none has a default.", "",
    "`commentary` - where the explanation lives:", ...Object.entries(COMMENTARY).map(([k, v]) => `- \`${k}\`: ${v}`), "",
    "`takeaway` - `false`, or the closing sentence (strong decks close about one page in ten on a line).", "",
    "`why` - one sentence on why this type fits the claim.", "`settles` - { kind, what }, or `evidence` naming insight ids when there is an insight log.", "",
    "`node runtime/author-deck.mjs --example <type>` prints a worked page of any type to start from.", "",
    "`highlight` - on a page with commentary points, a list with the phrase from each point the reader should see first (or `highlight` on the point).", "",
    `Capacities: a chart callout holds about ${calloutCapacity()} words (measured against its box); \`author-deck --check\` prints each page's word floor, ceiling and footer share as the page composes.`, ""];
  for (const [name, t] of Object.entries(PAGE_TYPES)) {
    const n = Array.isArray(t.exhibits) ? `${t.exhibits[0]}-${t.exhibits[1]}` : t.exhibits;
    const data = Object.entries(t.forms).map(([form, target]) => [form, dataKeys(target)]).filter(([, keys]) => keys.length);
    lines.push(`## ${name}`, t.task, "", `- form: ${Object.keys(t.forms).join(" | ")}`,
      ...(() => { const limits = Object.entries(t.forms).map(([form, target]) => [form, LIMITS[target]]).filter(([, l]) => l);
        return limits.length ? [`- holds: ${limits.map(([form, l]) => `${form} ${l.min}${l.max ? `-${l.max}` : "+"} ${l.key}`).join("; ")}`] : []; })(),
      ...(data.length ? [`- data: ${[...data.reduce((m, [form, keys]) => m.set(keys.join(", "), [...(m.get(keys.join(", ")) || []), form]), new Map())]
        .map(([keys, forms]) => forms.length === data.length ? keys : `${keys} (${forms.join(", ")})`).join("; ")}`] : []), `- commentary: ${t.commentary.join(" | ")}`, `- exhibits: ${n}` +
      (t.marked ? "; the chart marks its finding (annotation, highlight, reference line or rate)" : "") +
      (t.periods ? "; four or more periods" : "") + (t.minCategories ? `; ${t.minCategories}+ members` : "") + (t.rows ? "; `rows` with `cells`" : ""), "");
  }
  return lines.join("\n");
}

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
      settles: { type: "object", required: ["kind", "what"], properties: { kind: { enum: SETTLES_KINDS }, what: { type: "string", minLength: 8 } } },
      adds: { oneOf: [{ type: "null" }, { type: "string", minLength: 8 }] },
      evidence: { type: "array", items: { type: "string" }, description: "insight ids from <id>.insights.json; with an insight log, required for data-bearing types and it derives settles" },
    },
    not: { anyOf: OWNED.map((key) => ({ required: [key] })) },
  }));
  const structural = { type: "object", required: ["kind"], properties: { kind: { enum: ["section", "agenda"] } } };
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema", $id: "professional-slides.pages/v1",
    type: "object", required: ["deck", "pages"],
    properties: { deck: { type: "object", description: "the deck-level keys of the deck spec (schema, id, design, identity, cover, players, ...), without slides" },
      pages: { type: "array", items: { oneOf: [...typed, structural] } }, appendix: { type: "array", items: { oneOf: typed } } },
  };
}
