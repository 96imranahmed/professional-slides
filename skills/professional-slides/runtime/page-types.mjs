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

// Keys the compiler owns. Written by the author they would bypass the choices.
const OWNED = ["layout", "shape", "arrange", "soWhat", "pageType"];
// Keys of a typed page that are choices or authoring notes, not slide keys.
const CHOICE_KEYS = ["type", "form", "commentary", "takeaway", "why", "series", "rail"];

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

// The data an exhibit type reads, from its registered sample: what an author
// has to supply, as against styling (heading, unit, annotations, ...).
const STYLING = new Set(["heading", "unit", "annotations", "highlights", "focusSeries", "active", "treatment", "placement", "arrangement",
  "attributionAlign", "variant", "conclusion", "center", "today", "totals", "targets", "ranges", "highlight", "centerId", "ringOrder", "referenceLines", "legend", "dataLabels"]);
export function dataKeys(exhibitType) {
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
export function compilePage(pageIn, index = 0) {
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

  const primary = slide.exhibit ?? slide.exhibits?.[0];
  // The exhibit carries the data its form reads, named before the build has to.
  for (const ex of [slide.exhibit, ...(slide.exhibits || [])].filter(Boolean)) {
    const keys = dataKeys(ex.type);
    if (keys.length && !keys.some((key) => ex[key] !== undefined))
      throw new Error(`${id}: a ${ex.type} exhibit reads ${keys.map((k) => `\`${k}\``).join(", ")} - none is given`);
  }
  if (page.type === "composition" && ["pie", "donut"].includes(page.form)) {
    const values = (primary.values || []).map(Number), total = values.reduce((a, b) => a + b, 0);
    if (values.some((v) => v / total < 0.05)) throw new Error(`${id}: a part under 5% of the whole has no room in a ${page.form} slice; a waffle or a stacked bar shows small parts`);
  }
  if (page.type === "numbers" && page.form === "metric-strip" && exhibits.length !== 1) throw new Error(`${id}: a metric strip sits over one exhibit`);
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
  if (["beside", "beside-left", "below"].includes(page.commentary) && !points && !page.paragraphs)
    throw new Error(`${id}: commentary "${page.commentary}" needs the points it places`);
  if (page.commentary === "on-exhibit" && primary?.type?.startsWith("chart.") && !(primary.annotations || []).length)
    throw new Error(`${id}: commentary "on-exhibit" writes the explanation as callouts on the chart - give the exhibit \`annotations\` ({ category, text })`);
  if (page.commentary === "captions") {
    const bare = exhibits.filter((e) => !(typeof e.caption === "string" && e.caption.trim()));
    if (page.type === "picture" ? !(page.pictures || []).every((p) => p.label || p.line) : bare.length)
      throw new Error(`${id}: commentary "captions" puts one finding under each panel - every exhibit needs its \`caption\``);
  }
  if (page.commentary === "captions" && page.type !== "picture") {
    for (const ex of exhibits) {
      if (words(ex.caption).length < 8) throw new Error(`${id}: a caption is the panel's finding in a sentence - eight words or more, not a label ("${ex.caption}")`);
      if (overlap(`${page.title} ${ex.heading ?? ""}`, ex.caption) > 0.7) throw new Error(`${id}: the caption "${ex.caption}" repeats the title or the panel heading; say what this panel shows that the others do not`);
    }
  }
  if (page.commentary === "on-exhibit" && primary?.type?.startsWith("chart.")) {
    const said = (primary.annotations || []).reduce((n, a) => n + words(a.text).length, 0);
    if (said < 10) throw new Error(`${id}: moving the explanation onto the chart means writing it there - the callouts carry ${said} words; give them the mechanism and the qualification (10 or more words between them), or choose "beside"`);
  }
  if (page.commentary === "rail") {
    if (typeof page.rail !== "string" || words(page.rail).length < 10) throw new Error(`${id}: commentary "rail" sets one developed claim in the side panel - write it as \`rail\`, ten words or more`);
    slide.panel = { text: page.rail.trim() };
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

  if (typeof page.takeaway === "string") slide.soWhat = page.takeaway.trim();
  slide.pageType = { type: page.type, form: page.form, commentary: page.commentary, takeaway: typeof page.takeaway === "string",
    ...(page.series ? { series: String(page.series) } : {}), why: page.why.trim() };
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

/** The catalogue as the author reads it. */
export function describeTypes() {
  const lines = ["# Page types", "", "Every analytical page is one of these. Each choice is required; none has a default.", "",
    "`commentary` - where the explanation lives:", ...Object.entries(COMMENTARY).map(([k, v]) => `- \`${k}\`: ${v}`), "",
    "`takeaway` - `false`, or the closing sentence (strong decks close about one page in ten on a line).", "",
    "`why` - one sentence on why this type fits the claim.", ""];
  for (const [name, t] of Object.entries(PAGE_TYPES)) {
    const n = Array.isArray(t.exhibits) ? `${t.exhibits[0]}-${t.exhibits[1]}` : t.exhibits;
    const data = Object.entries(t.forms).map(([form, target]) => [form, dataKeys(target)]).filter(([, keys]) => keys.length);
    lines.push(`## ${name}`, t.task, "", `- form: ${Object.keys(t.forms).join(" | ")}`,
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
