// The deck's structure, read off its pages' descriptors.
//
// A descriptor is what a page's choices say about it before a word of its
// copy is checked: its type, form and commentary placement, the exhibits it
// draws, its section, the insights it rests on. The rules over descriptors
// (class S, gates/gate_classes.mjs) decide which page takes which form, so
// they are evaluated first and on every run - on the compiled page where it
// compiles, and on its declared choices (page-types.mjs declaredSlide) where
// it does not, so that fixing a page never reveals a structure rule the run
// before could have reported.
import { PAGE_TYPES, dataKeys, declaredSlide, drawnOf, placementsOf, plannableForms, structureOf, undrawnExhibit } from "./page-types.mjs";
import { TYPE_SHAPES } from "./evidence.mjs";
import { axisOf, measureRegistry } from "./measures.mjs";
import { declaredPlot, refsOf } from "./gates/dependency_gates.mjs";
import { resolveFill } from "./compose-points.mjs";
import { DECK_LENGTH, PLAN } from "./weight.mjs";
import { varietyFindings } from "./gates/variety_gates.mjs";
import { runPlanGates, styleEntropy } from "./gates/plan_gates.mjs";
import { classOf, standingRoom } from "./gates/gate_classes.mjs";

const exhibitsOf = (slide) => [slide.exhibit, ...(slide.exhibits || [])].filter((ex) => ex && typeof ex === "object");
// The exhibits the page gates count as evidence (gates/deck_gates.py
// page_architecture): charts, the table constructions, and the diagrams a
// page can be carried by on their own.
const TABLES = new Set(["table", "rows", "compare", "phase-table"]);
const DIAGRAMS = new Set(["steps", "cycle", "journey", "timeline", "process", "chevron-process", "flow", "roadmap", "tree", "organization",
  "matrix", "quadrants", "chart.horizons", "gantt", "relationship-network"]);
const isEvidence = (type) => type.startsWith("chart.") || TABLES.has(type) || DIAGRAMS.has(type);

/**
 * The architecture PAGE_SHAPE_FLAT will read off a page once it is composed,
 * told from the compiled or declared slide: the relationship between its
 * evidence and its commentary, not its chart type. The page gates measure it
 * on the composed geometry (deck_gates.py page_architecture) and that
 * measurement is used wherever a page composed; this stands in for a page
 * that did not, and for a plan's pages, and a test holds the two to one
 * answer on the worked examples.
 *
 * Commentary here is developed text: points, paragraphs, captions, the points
 * of a row block, cards. One claim set beside or under the exhibit - a rail,
 * a so-what bar, a takeaway - is the page's close, not commentary, so a page
 * with a rail and nothing else is evidence-only under this rule, as the page
 * gates read it (no side statement is among their commentary components).
 * VARIETY_COLUMN reads the same page the other way, and means to: it counts
 * how pages are drawn, and a rail is drawn as a column beside its exhibit
 * (page-types.mjs drawnOf). So swapping points for a rail lowers neither
 * count: it stays a column page there, and becomes evidence-only here.
 */
// How PAGE_SHAPE_FLAT counts a rail, said on its standing line (the page gates say the same on theirs: gate_config.py RAIL_AS_CLOSE).
const RAIL_AS_CLOSE = "a rail, a so-what bar and a takeaway are one claim each and leave a page evidence-only; points, paragraphs, captions and cards make it evidence-with-commentary";

export function declaredArchitecture(slide) {
  if (!slide?.pageType || slide.kind === "statement" || slide.kind === "takeaways") return null;
  const blocks = Array.isArray(slide.blocks) ? slide.blocks : [];
  const types = [...exhibitsOf(slide), ...blocks.map((block) => block?.exhibit).filter(Boolean)].map((ex) => String(ex.type ?? ""));
  const evidence = types.filter(isEvidence);
  // A findings matrix is drawn as a table, and a model page sets its chart over its own data table.
  if (slide.shape === "findings-matrix" || slide.shape === "model-page") evidence.push("table");
  const captioned = slide.pageType.commentary === "captions" || exhibitsOf(slide).some((ex) => typeof ex.caption === "string" && ex.caption.trim());
  const comments = (slide.points || []).length > 0 || (slide.paragraphs || []).length > 0 || captioned || blocks.some((block) => (block?.points || []).length) || types.includes("cards");
  const metrics = Boolean(slide.kpi) || (slide.metrics || []).length > 0 || blocks.some((block) => block?.metric);
  if (evidence.length) {
    if (metrics && slide.layout === "metrics-over-exhibit") return "metrics-over-evidence";
    if (metrics && slide.layout === "hero-number") return "hero-number-with-evidence";
    if (comments) return "evidence-with-commentary";
    if (evidence.length === 1) return DIAGRAMS.has(evidence[0]) ? evidence[0] : evidence[0] === "chart.waterfall" ? "reconciliation" : "evidence-only";
    return evidence.length > 2 ? "evidence-grid" : slide.arrange === "stack" || slide.shape === "model-page" ? "evidence-stack" : "paired-evidence";
  }
  if (slide.photo || (slide.pictures || []).length) return "picture-led";
  if (types.includes("cards")) return "card-grid";
  if (metrics) return "metrics-with-text";
  return comments ? "text" : null;
}

// PAGE_SHAPE_FLAT's bars (gates/gate_config.py THRESHOLDS shape_variety_from,
// shapes_per_ten_min, shape_share_max): the page gates hold the composed deck
// to them, and the same figures are read here off declared pages, before
// anything composes. A test holds the two copies to one value.
export const SHAPE = Object.freeze({ from: DECK_LENGTH.shapeVariety, perTenMin: 3, shareMax: 0.4 });
/** How far a scene's estimate of the deck's median words a block stood from the rendered median, in words: said with every such estimate. */
export const BLOCK_ESTIMATE_TOLERANCE = 4;

/**
 * A deck's page architectures in page order, counted as PAGE_SHAPE_FLAT counts
 * them (deck_gates.py shape_variety): the distinct architectures per ten pages,
 * averaged over ten-page windows, and the commonest one.
 */
export function shapeVariety(shapes) {
  const counts = new Map();
  for (const shape of shapes) counts.set(shape, (counts.get(shape) || 0) + 1);
  const window = Math.min(10, shapes.length), windows = shapes.length - window + 1;
  let total = 0;
  for (let at = 0; at < windows; at += 1) total += (new Set(shapes.slice(at, at + window)).size * 10) / window;
  const [commonest, count] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return { perTen: windows > 0 ? total / windows : 0, commonest, count, pages: shapes.length };
}

const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places;
const isBlocking = (finding) => ["blocker", "blocking"].includes(finding.severity);

/**
 * PAGE_SHAPE_FLAT read off `pages` - `[{ id, architecture }]` in page order,
 * the architecture measured where the page composed and declared where it did
 * not: its two standings, and the finding when a bar is broken.
 */
export function shapeStructure(pages, { airy = false } = {}) {
  const shaped = pages.filter((page) => page.architecture);
  if (airy || !shaped.length) return { standings: [], findings: [] };
  const variety = shapeVariety(shaped.map((page) => page.architecture));
  const applies = shaped.length >= SHAPE.from;
  const ids = shaped.filter((page) => page.architecture === variety.commonest).map((page) => page.id);
  const standings = [
    { code: "PAGE_SHAPE_FLAT", key: "share", what: `pages on the commonest architecture (${variety.commonest})`, value: round(variety.count / shaped.length, 4), bar: SHAPE.shareMax, side: "max",
      count: variety.count, of: shaped.length, applies, blocks: true, pages: ids, note: RAIL_AS_CLOSE },
    { code: "PAGE_SHAPE_FLAT", key: "perTen", what: "distinct architectures per ten pages", value: round(variety.perTen, 1), bar: SHAPE.perTenMin, side: "min", unit: "per ten", applies, blocks: true },
  ];
  if (!applies || (variety.perTen >= SHAPE.perTenMin && variety.count / shaped.length <= SHAPE.shareMax)) return { standings, findings: [] };
  return { standings, findings: [{ code: "PAGE_SHAPE_FLAT", severity: "blocker", slide: ids,
    measured: { shapesPerTen: round(variety.perTen, 1), commonest: variety.commonest, commonestShare: round(variety.count / shaped.length), pages: shaped.length },
    threshold: `${SHAPE.perTenMin} distinct architectures per ten pages, none past ${Math.round(SHAPE.shareMax * 100)}%`,
    repair: `${variety.count} of ${shaped.length} pages are ${variety.commonest} (${ids.join(", ")}), and the deck draws ${round(variety.perTen, 1)} architectures per ten pages. ` +
      "The same evidence relationship dominates: two or three commentary columns, cards versus prose and an optional closing band count as one architecture. " +
      "Redraw some of these pages as what their evidence is - paired evidence on a shared basis, a metric with its proof, a reconciled bridge, a sequence, " +
      "an exhibit that carries the page alone - by changing the page's `form` or `commentary` (`--plan` proposes an allocation that passes)" }] };
}

/**
 * The deck's structure rules that read declared choices alone, on `spec` - a
 * compiled deck whose pages that did not compile are stood in for by their
 * declared slides: the variety contract and the plan record's gates, with
 * where the deck stands against each. `planOf` builds the plan record
 * (author-deck.mjs); findings of other classes the two raise come back too,
 * for the caller to file.
 */
export function declaredStructure(spec, { planOf }) {
  const standings = [];
  const variety = varietyFindings(spec, { structureOf, drawnOf, standings });
  const plan = planOf(spec);
  const report = runPlanGates(plan, { deck: spec });
  const content = plan.pages.filter((page) => !page.kind || page.kind === "content");
  const entropy = styleEntropy(content);
  if (entropy.declared && entropy.pages) {
    const [commonest, count] = [...entropy.counts].sort((a, b) => b[1] - a[1])[0];
    const applies = content.length >= DECK_LENGTH.plan;
    standings.push({ code: "PLAN_STYLE_ENTROPY", key: "share", what: `pages declaring the commonest architecture (${commonest})`, value: round(count / entropy.pages, 4), bar: PLAN_ARCHITECTURE_SHARE, side: "max",
      count, of: entropy.pages, applies, blocks: true },
    { code: "PLAN_STYLE_ENTROPY", key: "entropy", what: "evenness of the declared architectures (0 to 1)", value: round(entropy.value), bar: PLAN.entropyMin, side: "min", unit: "entropy", applies, blocks: true });
  }
  return { findings: [...variety, ...report.findings], standings };
}
// The share of a plan's pages one declared architecture may take (plan_gates.mjs gateEntropy).
const PLAN_ARCHITECTURE_SHARE = 0.4;

/**
 * How far a deck is from satisfying its structure rules, for a search to
 * minimise: the blocking findings, then the room the broken standings lack -
 * in pages where the rule counts pages, as a share of the bar otherwise -
 * then how many rules sit exactly at their bar, and last the pressure on the
 * caps (each capped share against its cap, squared). So of two allocations
 * that pass, the one with room to spare is kept, and choices spread across
 * the placements and forms in proportion to what each rule allows: a deck
 * authored to a plan at five caps breaks one with its first changed page.
 */
function structureCost({ findings, standings }) {
  const rooms = standings.filter((standing) => standing.blocks).map((standing) => ({ standing, room: standingRoom(standing) }));
  const lacking = rooms.filter(({ room }) => ["over", "short"].includes(room.state))
    .reduce((sum, { standing, room }) => sum + (room.unit === "pages" ? -room.margin : Math.abs(room.margin) / Math.max(Math.abs(standing.bar), 1e-9)), 0);
  const pressure = rooms.filter(({ standing }) => standing.applies && standing.side === "max" && standing.of && standing.bar > 0)
    .reduce((sum, { standing }) => sum + (standing.count / standing.of / standing.bar) ** 2, 0);
  // How far an estimated standing is outside its band, as a share of the bar, plus the share of its pages on the wrong side
  // of the bar: a median does not move until half the pages have, so the search is shown each page that crosses. Weighed
  // after the rules the plan is held to.
  const astray = (standing) => { const each = Object.values(standing.each ?? {}); return each.length ? each.filter((value) => standing.side === "min" ? value < standing.bar : value > standing.bar).length / each.length : 0; };
  const drift = standings.filter((standing) => standing.estimated).map((standing) => ({ standing, room: standingRoom(standing) })).filter(({ room }) => ["over", "short"].includes(room.state))
    .reduce((sum, { standing, room }) => sum + Math.abs(room.margin) / Math.max(Math.abs(standing.bar), 1e-9) + astray(standing), 0);
  return { blockers: findings.filter((f) => isBlocking(f) && classOf(f.code) === "S").length, lacking: round(lacking, 4), drift: round(drift, 4), tight: rooms.filter(({ room }) => room.state === "at").length, pressure: round(pressure, 4) };
}
const cheaper = (a, b) => a.blockers !== b.blockers ? a.blockers < b.blockers : Math.abs(a.lacking - b.lacking) > 1e-9 ? a.lacking < b.lacking
  : Math.abs(a.drift - b.drift) > 1e-9 ? a.drift < b.drift : a.tight !== b.tight ? a.tight < b.tight : a.pressure < b.pressure - 1e-9;

// The exhibit a page draws where its form leaves the kind to the author, told
// from the shape of the evidence it rests on (evidence.mjs SHAPES).
const SHAPE_EXHIBIT = { series: "chart.line", "peer-set": "chart.bar", mix: "chart.stacked-bar", "measure-pair": "chart.scatter", bridge: "chart.waterfall",
  geography: "map", schedule: "timeline", roster: "table", fact: "table", qualitative: "table" };

// The exhibit a measure takes by the axis it runs over; one value is a figure, not an exhibit.
const AXIS_EXHIBIT = { periods: "chart.line", members: "chart.bar" };
const REGISTRIES = new WeakMap();
const registryOf = (insights) => { if (!insights || typeof insights !== "object") return new Map(); if (!REGISTRIES.has(insights)) REGISTRIES.set(insights, measureRegistry(insights)); return REGISTRIES.get(insights); };

/**
 * The exhibit kinds a page's evidence takes where the page has not written
 * its exhibits, one for each exhibit in turn: an estimate, from what the page
 * does declare. First the measures its claim is about (`settles.measures`),
 * each by the axis it runs over; then the insights it rests on, by their
 * shape, those its type can carry first. A table where it declares neither.
 */
export function evidenceExhibits(page, insights) {
  const registry = registryOf(insights);
  const claimed = (Array.isArray(page?.settles?.measures) ? page.settles.measures : []).map((ref) => AXIS_EXHIBIT[axisOf(registry.get(ref)).kind]).filter(Boolean);
  const found = (Array.isArray(page?.evidence) ? page.evidence : []).map((id) => insights?.get?.(id)).filter(Boolean);
  const carried = (item) => (TYPE_SHAPES[page.type] ?? []).includes(item.shape);
  const shaped = [...found.filter(carried), ...found.filter((item) => !carried(item))].map((item) => SHAPE_EXHIBIT[item.shape]).filter(Boolean);
  const kinds = [...claimed, ...shaped];
  return kinds.length ? kinds : ["table"];
}

// The exhibit a `basis` stub declares, where the page's form leaves the kind to the author: the class it states in `as`,
// otherwise the one its first recorded measure takes by its axis; a measure of one value is a figure.
const CLASS_EXHIBIT = { table: "table", figure: "fact-grid" };
function stubKind(basis, registry) {
  if (CLASS_EXHIBIT[basis?.as]) return CLASS_EXHIBIT[basis.as];
  const axis = refsOf(basis).filter((ref) => registry.has(ref)).map((ref) => axisOf(registry.get(ref)).kind)[0];
  return axis === undefined ? null : AXIS_EXHIBIT[axis] ?? (basis?.as === "chart" ? null : CLASS_EXHIBIT.figure);
}

/**
 * How a spine's exhibits that are declared and not drawn are read
 * (page-types.mjs undrawnExhibit: a `basis` stub, with or without its
 * `type`). A stub is a declaration, not an exhibit that plots nothing: for
 * each of the page's exhibits in turn, `kinds` holds the kind its basis
 * declares (null for a drawn exhibit, and for a stub that says nothing of its
 * kind), and `values` how many values the stubs will plot between them, from
 * the measures they name (gates/dependency_gates.mjs declaredPlot) - null
 * where a stub names no recorded measure, so the page's depth is not read yet.
 */
export function stubsOf(page, insights) {
  const registry = registryOf(insights);
  const own = exhibitsOf(page && typeof page === "object" ? page : {});
  const plots = own.filter(undrawnExhibit).map((ex) => declaredPlot(ex.basis, registry));
  return { kinds: own.map((ex) => (undrawnExhibit(ex) ? stubKind(ex.basis, registry) : null)), values: plots.every((n) => n !== null) ? plots.reduce((sum, n) => sum + n, 0) : null };
}

// What stands for an exhibit kind nobody has declared, to tell which stand-ins rest on an estimate.
const UNDECLARED = "(undeclared)";
/** Does a page's stand-in under `choice` carry an exhibit whose kind neither the page nor its form declares. */
const estimatedUnder = (page, index, choice) => { const slide = declaredSlide({ ...page, ...choice }, index, { exhibitType: UNDECLARED }); return Boolean(slide) && exhibitsOf(slide).some((ex) => ex.type === UNDECLARED); };

// Types whose form names what the subject is - a cycle, a gantt, a memo, a
// map - rather than how a measure is drawn. A plan keeps the form such a page
// declares, or the type's first; it never picks one to satisfy a mix rule.
const SUBJECT_FORMS = new Set(["mechanism", "schedule", "picture", "argument", "statement", "summary", "place", "matrix", "bridge"]);
const openForms = (type) => (SUBJECT_FORMS.has(type) ? Object.keys(PAGE_TYPES[type].forms).slice(0, 1) : plannableForms(type));

/**
 * The choices a plan takes freely for a page: the form it declares, or the
 * forms that read the data its type's first form reads, each with the
 * placement it declares where that form compiles with it, or with every
 * placement the form takes. Empty for a page with no known type.
 */
export function freeChoices(page) {
  const type = page && typeof page === "object" ? PAGE_TYPES[page.type] : null;
  if (!type) return [];
  const forms = Object.hasOwn(type.forms, page.form ?? "") ? [page.form] : openForms(page.type);
  // A placement the page declares is kept on every form that compiles with it.
  return forms.flatMap((form) => { const placements = placementsOf(page.type, form);
    return (placements.includes(page.commentary) ? [page.commentary] : placements).map((commentary) => ({ form, commentary })); });
}

// The band the render holds the prose pages' median words a block to (TEXT_FRAGMENTED), and the pages it is read from.
// `tolerance` is how far a scene's estimate of that median stood from the rendered one (gates/density_profile.py SCENE_TOLERANCE: a test holds the two to one figure).
const BLOCKS = Object.freeze({ low: PLAN.textForm.wordsPerBlock.q1, high: PLAN.textForm.wordsPerBlock.q3, from: DECK_LENGTH.density, tolerance: BLOCK_ESTIMATE_TOLERANCE });

/**
 * An allocation of form and commentary placement to a spine's pages that
 * satisfies the deck's structure rules, found before any page is written.
 *
 * `pages` are the spine's pages in order (structural pages pass through). A
 * page keeps the form and placement it declares, and a declared form is kept
 * where only the placement is missing; one that declares neither is
 * given them, from the catalogue: the forms that read the data its type's
 * first form reads, and every placement its form compiles with.
 *
 * What a page declares is read wherever it is declared, and only what is
 * absent is estimated. A page that compiles as written is read as the compile
 * reads it (`compiled`, the compiled slides by page id), so a deck whose
 * pages all compile gets the standings its compile reports. A page whose
 * exhibits are not written yet is stood in for by its declared choices, its
 * exhibits typed by its form or - where the form leaves the kind to the
 * author - read from the `basis` stub that declares it (stubsOf: its class
 * and the values its measures hold), or estimated from the measures and
 * insights the page names (evidenceExhibits) where no stub says; a page with
 * an estimated exhibit is marked `estimated`, and what the rules say of it is
 * a reading of that estimate.
 *
 * `blocksOf(page, choice)` gives, where the caller has it, the text blocks a
 * page sets under a choice - `{ count, wordsPerBlock, prose }`, read off the
 * page composed with placeholder copy (author-deck.mjs --plan). The deck's
 * median words a block over its prose pages is then a standing of the
 * allocation, marked as an estimate: the free choices are steered away from
 * placements that take it out of the band the render holds it to
 * (TEXT_FRAGMENTED), no declared choice is changed for it, and it never makes
 * a plan unsatisfied.
 *
 * The search is deterministic and bounded by count, never by the clock: each
 * open page in turn takes the choice that leaves the deck's structure cost
 * lowest (ties to the catalogue's order), then single changes are applied
 * while one lowers the cost, `maxSteps` at most and within `maxEvaluations`
 * readings of the deck's structure (`capped` when either stops it with a
 * rule still broken). Where those choices cannot
 * satisfy a rule, the forms built for particular data are tried on the open
 * pages (each reported with the data it `reads`), then declared choices
 * (reported as changes); where nothing does, `unsatisfied` names the rules,
 * and whether the declared types alone break them.
 *
 * Returns `{ pages: [{ id, type, form, commentary, source, estimated }],
 * structure: { findings, standings }, declared: { findings, standings },
 * satisfied, unsatisfied, steps, evaluations, capped }`; `source` is
 * "declared" (both choices kept), "placed" (the declared form kept and its
 * placement proposed), "proposed" (both given) or "changed" (a declared
 * choice changed to mend a rule, with what it `was`).
 */
export function allocateStructure(doc, { insights = null, planOf, compiled = null, blocksOf = null, maxSteps = 40, maxEvaluations = 40000 } = {}) {
  let evaluations = 0;
  const all = [...(doc.pages || []).map((page) => ({ page, appendix: false })), ...(doc.appendix || []).map((page) => ({ page, appendix: true }))];
  const entries = all.map(({ page, appendix }, index) => {
    const type = page && typeof page === "object" ? PAGE_TYPES[page.type] : null;
    if (!type) return { page, index, appendix, fixed: true };
    const formDeclared = Object.hasOwn(type.forms, page.form ?? "");
    const options = freeChoices(page);
    const declared = formDeclared && placementsOf(page.type, page.form).includes(page.commentary);
    // Every choice the catalogue allows the type, for when the forms a plan chooses freely cannot satisfy a rule between them.
    const wider = Object.keys(type.forms).flatMap((form) => placementsOf(page.type, form).map((commentary) => ({ form, commentary })));
    // The page as the compile reads it, where it compiles as written under the choices it declares.
    const written = declared ? compiled?.get?.(String(page.id ?? `page-${index + 1}`)) ?? null : null;
    return { page, index, appendix, type, options, wider, declared, formDeclared, written, slides: new Map(),
      choice: declared ? { form: page.form, commentary: page.commentary } : options[0], exhibitType: evidenceExhibits(page, insights), stubs: stubsOf(page, insights) };
  });
  const slideOf = (entry, choice) => {
    const key = `${choice.form}/${choice.commentary}`;
    if (entry.written && choice.form === entry.page.form && choice.commentary === entry.page.commentary) return entry.written;
    if (!entry.slides.has(key)) entry.slides.set(key, declaredSlide({ ...entry.page, ...choice }, entry.index, { exhibitType: entry.exhibitType, players: doc.deck?.players, stubs: entry.stubs }));
    return entry.slides.get(key);
  };
  const evaluate = (override = null) => {
    evaluations += 1;
    const slides = [], appendix = [];
    for (const entry of entries) {
      const slide = entry.fixed ? (entry.page && typeof entry.page === "object" && entry.page.kind ? entry.page : null)
        : slideOf(entry, override?.entry === entry ? override.choice : entry.choice);
      if (slide) (entry.appendix ? appendix : slides).push(slide);
    }
    const spec = { ...doc.deck, slides, ...(appendix.length ? { appendix } : {}) };
    const declared = declaredStructure(spec, { planOf });
    const shape = shapeStructure([...slides, ...appendix].filter((slide) => slide.pageType).map((slide) => ({ id: slide.id, architecture: declaredArchitecture(slide) })),
      { airy: resolveFill(spec) === "airy" });
    // The deck's median words a block under these choices, where the caller estimated each page's (`blocksOf`): an estimate,
    // which steers the free choices and never refuses a plan - the render measures the rule.
    const read = blocksOf ? entries.filter((entry) => !entry.fixed).map((entry) => [entry, blocksOf(entry.page, override?.entry === entry ? override.choice : entry.choice)]).filter(([, blocks]) => blocks?.prose && blocks.count > 0) : [];
    const sizes = read.map(([, blocks]) => blocks.wordsPerBlock).sort((a, b) => a - b);
    const middle = sizes.length ? (sizes.length % 2 ? sizes[(sizes.length - 1) / 2] : (sizes[sizes.length / 2 - 1] + sizes[sizes.length / 2]) / 2) : null;
    const estimate = sizes.length >= BLOCKS.from ? [["floor", BLOCKS.low, "min"], ["ceiling", BLOCKS.high, "max"]].map(([key, bar, side]) => ({ code: "TEXT_FRAGMENTED", key, what: "median words a block on the prose pages", value: round(middle, 1), bar, side, unit: "words",
      applies: true, blocks: false, estimated: "estimated with placeholder copy at a developed length; the render measures it", tolerance: BLOCKS.tolerance, each: Object.fromEntries(read.map(([entry, blocks]) => [String(entry.page.id ?? `page-${entry.index + 1}`), blocks.wordsPerBlock])) })) : [];
    return { findings: [...declared.findings, ...shape.findings], standings: [...declared.standings, ...shape.standings, ...estimate] };
  };
  const typed = entries.filter((entry) => !entry.fixed);
  const before = evaluate();
  // Each open page in turn takes the choice that leaves the cost lowest.
  for (const entry of typed.filter((e) => !e.declared)) {
    let best = null;
    for (const choice of entry.options) {
      const cost = structureCost(evaluate({ entry, choice }));
      if (!best || cheaper(cost, best.cost)) best = { choice, cost };
    }
    entry.choice = best.choice;
  }
  // Then single changes, while one lowers the cost: the open pages first, the declared ones only when no open page helps.
  let current = evaluate(), cost = structureCost(current), steps = 0, capped = false;
  while ((cost.blockers || cost.lacking || cost.drift || cost.tight) && !capped) {
    let best = null;
    // The open pages' free choices first. Only to mend a broken rule, never for room alone: a form built for
    // particular data on a page that declares no form, and last a change to a declared choice - a declared form
    // among them, which is kept while only its placement is open and changed only here, where it is reported.
    const open = typed.filter((e) => !e.declared), broken = cost.blockers || cost.lacking;
    // An estimate steers the free choices only: a form built for particular data, or a change to a declared choice, is taken
    // for the rules the plan is held to, so those are weighed with the estimate left out.
    const held = (c) => ({ ...c, drift: 0 });
    for (const [pool, choices, free] of [[open, "options", true], ...(broken ? [[open.filter((e) => !e.formDeclared), "wider", false], [typed.filter((e) => e.declared || e.formDeclared), "wider", false]] : [])]) {
      for (const entry of pool) for (const choice of entry[choices]) {
        if (choice.form === entry.choice.form && choice.commentary === entry.choice.commentary) continue;
        const next = structureCost(evaluate({ entry, choice }));
        if (free ? cheaper(next, best?.cost ?? cost) : cheaper(held(next), held(best?.cost ?? cost))) best = { entry, choice, cost: next };
      }
      if (best) break;
    }
    if (!best) break;
    best.entry.choice = best.choice;
    steps += 1;
    current = evaluate();
    cost = structureCost(current);
    capped = steps >= maxSteps || evaluations >= maxEvaluations;
  }
  const broken = current.standings.filter((standing) => standing.blocks && ["over", "short"].includes(standingRoom(standing).state));
  // A rule the page types alone break cannot be met by any form or placement.
  const TYPE_RULES = new Set(["VARIETY_TYPE_SHARE", "VARIETY_TYPE_RANGE", "VARIETY_TYPE_RUN", "PAGE_TYPE_UNDECLARED"]);
  const unsatisfied = [...new Map([...broken.map((standing) => [`${standing.code}${standing.key ? `.${standing.key}` : ""}`, { code: standing.code, standing }]),
    ...current.findings.filter((f) => isBlocking(f) && classOf(f.code) === "S" && !broken.some((standing) => standing.code === f.code)).map((f) => [f.code, { code: f.code, finding: f }])]).values()]
    .map((item) => ({ ...item, fixedByTypes: TYPE_RULES.has(item.code) }));
  const changed = (entry) => entry.choice.form !== entry.page.form || entry.choice.commentary !== entry.page.commentary;
  // A page that declares its form and not where its commentary sits keeps the form: only the placement is proposed.
  const formChanged = (entry) => entry.formDeclared && entry.choice.form !== entry.page.form;
  // A page read off an estimate: it does not compile as written, and neither it nor its form says what kind an exhibit of it is.
  const estimated = (entry) => !(entry.written && !changed(entry)) && estimatedUnder(entry.page, entry.index, entry.choice);
  return {
    pages: typed.map((entry) => ({ id: entry.page.id ?? `page-${entry.index + 1}`, type: entry.page.type, form: entry.choice.form, commentary: entry.choice.commentary,
      source: formChanged(entry) || (entry.declared && changed(entry)) ? "changed" : entry.declared ? "declared" : entry.formDeclared ? "placed" : "proposed", ...(estimated(entry) ? { estimated: true } : {}),
      // A form the plan took only to mend a rule, with the data it is built for: the author checks the evidence holds it.
      ...(!entry.declared && entry.page.form !== entry.choice.form && !openForms(entry.page.type).includes(entry.choice.form)
        ? { reads: dataKeys(entry.type.forms[entry.choice.form], { type: entry.page.type, form: entry.choice.form }) } : {}),
      ...((entry.declared && changed(entry)) || formChanged(entry) ? { was: { form: entry.page.form, ...(entry.declared ? { commentary: entry.page.commentary } : {}) } } : {}) })),
    structure: current, declared: before, satisfied: !unsatisfied.length, unsatisfied, steps, evaluations, capped: capped && !!(cost.blockers || cost.lacking),
  };
}
