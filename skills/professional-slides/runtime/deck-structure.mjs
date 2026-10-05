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
import { exhibitKinds, fitStandings, varietyFindings } from "./gates/variety_gates.mjs";
import { drawOrder, formDraw, kindOfForm, pageFit, otherTypes, sharedKinds } from "./claim-fit.mjs";
import { featuredDraw } from "./design-systems.mjs";
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
export function declaredStructure(spec, { planOf, insights = undefined, sourceKinds = null }) {
  const standings = [];
  const variety = varietyFindings(spec, { structureOf, drawnOf, standings });
  // How the deck's exhibits are spread over their kinds, and the pages drawn in a form that carries their claim less directly than
  // another they could take: said with the standings, and never a refusal (gates/variety_gates.mjs fitStandings). Read where the
  // caller passes the insight log (null where the deck has none); a search that only weighs the rules leaves it out.
  const fit = insights === undefined ? { findings: [], standings: [] } : fitStandings(spec, { fits: fitsOf(spec, insights), kept: keptAsSource(spec, sourceKinds), carried: carriedKinds(spec.carried, sourceKinds) });
  standings.push(...fit.standings);
  variety.push(...fit.findings);
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
// The same order with the pressure left out: what the rules themselves say of two allocations.
const heldCheaper = (a, b) => cheaper({ ...a, pressure: 0 }, { ...b, pressure: 0 });

// The exhibit a page draws where its form leaves the kind to the author, told
// from the shape of the evidence it rests on (evidence.mjs SHAPES).
const SHAPE_EXHIBIT = { series: "chart.line", "peer-set": "chart.bar", mix: "chart.stacked-bar", "measure-pair": "chart.scatter", bridge: "chart.waterfall",
  geography: "map", schedule: "timeline", roster: "table", fact: "table", qualitative: "table" };

// The exhibit a measure takes by the axis it runs over, where the fit table reads no task from it; one value is a figure, not an exhibit.
const AXIS_EXHIBIT = { periods: "chart.line", members: "chart.bar" };
const REGISTRIES = new WeakMap();
const registryOf = (insights) => { if (!insights || typeof insights !== "object") return new Map(); if (!REGISTRIES.has(insights)) REGISTRIES.set(insights, measureRegistry(insights)); return REGISTRIES.get(insights); };

/** Each analytical page's fit (claim-fit.mjs pageFit), by page id: the compiled slides of a deck, or the pages of a spine. */
export function fitsOf(spec, insights) {
  const registry = registryOf(insights);
  const pages = [...(spec.slides ?? spec.pages ?? []), ...(spec.appendix ?? [])].filter((page) => page && typeof page === "object" && (page.pageType || page.type));
  return new Map(registry.size ? pages.map((page) => [String(page.id), pageFit(page, { registry, insights })]).filter(([, fit]) => fit) : []);
}

/**
 * A deck's draw as the plan reads it (`deck.variation`, `deck.design`): the
 * seed, and the forms and kinds it features from its design system's
 * repertoire. A deck with no `variation` has no draw, and a revision features
 * nothing: its pages are drawn as the source deck draws its like.
 */
export function drawOf(deck) {
  const seed = deck?.variation ?? null;
  return { seed, ...(seed === null || deck?.workflow === REVISION ? { forms: new Set(), kinds: new Set() } : featuredDraw(seed, deck?.design)) };
}

/**
 * The kind each exhibit of a page takes where its form leaves the kind open
 * and the page has not said it - a cut of the claim nobody has written, or an
 * exhibit the spine declares by a `basis` stub with no `type`: the kinds that
 * carry each cut of the claim's measures best (claim-fit.mjs), one a cut.
 * Among kinds of one grade, one every cut of the page can take comes first,
 * so panels match; on a revision, the one the source deck draws most
 * (`convention`); then the deck's draw (claim-fit.mjs drawOrder): one it
 * features (`featured`), then whose turn it is in the deck's own hand for the
 * cut's reading task (`seed` - one order a deck, so a deck's rankings are all
 * drawn one way); for a deck with no draw the one `fewest(kind)` says it
 * draws least; then the catalogue's order.
 * `[{ at, kind, also, task, by }]`: `at` the exhibit's place on the page,
 * `also` the other kinds of the same grade, `by` what told the kind from them
 * ("only", "matched", "featured", "convention", "seed", "spread" or
 * "order"). Empty where no task is read from the measures.
 */
export function openKinds(page, insights, { seed = null, fewest = () => 0, featured = null, convention = null } = {}) {
  const fit = pageFit(page, { registry: registryOf(insights), insights });
  const cuts = (fit?.exhibits ?? []).filter((item) => !item.written);
  const matched = sharedKinds(cuts);
  return cuts.map((cut) => {
    // The deck's hand is an order, and each mark's turn comes round in proportion to its place in it (claim-fit.mjs drawOrder).
    const { ordered, by } = drawOrder(cut.kinds.equal.map((item) => item.kind).filter((kind) => kind.startsWith("chart.")), { seed, task: cut.task, featured, load: fewest,
      before: [["matched", (a, b) => matched.includes(b) - matched.includes(a)], ...(convention ? [["convention", (a, b) => convention(a) - convention(b)]] : [])] });
    return { at: cut.at, kind: ordered[0], also: ordered.slice(1), task: cut.task, by: ordered.length < 2 ? "only" : by(ordered[0], ordered[1]) };
  }).filter((item) => item.kind);
}

/**
 * The exhibit kinds a page's evidence takes where the page has not written
 * its exhibits, one for each exhibit in turn: an estimate, from what the page
 * does declare. Where a reading task can be told from the measures its claim
 * is about, the kind that carries each cut of them best (claim-fit.mjs), kinds
 * of one grade in the order the deck's `variation` draws them. Otherwise
 * those measures each by the axis it runs over; then the insights it rests
 * on, by their shape, those its type can carry first. A table where it
 * declares neither.
 */
export function evidenceExhibits(page, insights, { seed = null, kinds: featured = null } = {}) {
  // Where the measures say what a reader is to do with them, each exhibit is estimated as the kind that carries it (openKinds).
  const fitted = openKinds(page, insights, { seed, featured }).map((item) => item.kind);
  if (fitted.length) return fitted;
  const registry = registryOf(insights);
  const claimed = (Array.isArray(page?.settles?.measures) ? page.settles.measures : []).map((ref) => AXIS_EXHIBIT[axisOf(registry.get(ref)).kind]).filter(Boolean);
  const found = (Array.isArray(page?.evidence) ? page.evidence : []).map((id) => insights?.get?.(id)).filter(Boolean);
  const carried = (item) => (TYPE_SHAPES[page.type] ?? []).includes(item.shape);
  const shaped = [...found.filter(carried), ...found.filter((item) => !carried(item))].map((item) => SHAPE_EXHIBIT[item.shape]).filter(Boolean);
  const kinds = [...claimed, ...shaped];
  return kinds.length ? kinds : ["table"];
}

// The exhibit a `basis` stub declares, where the page's form leaves the kind to the author: the class it states in `as`;
// otherwise the kind that carries its measures best, in the deck's draw (`fitted`, openKinds) - a stub is given the kind the plan
// proposes for it, not a line because it runs over periods; and where no task is read from them, the one its first recorded
// measure takes by its axis. A measure of one value is a figure.
const CLASS_EXHIBIT = { table: "table", figure: "fact-grid" };
function stubKind(basis, registry, fitted = null) {
  if (CLASS_EXHIBIT[basis?.as]) return CLASS_EXHIBIT[basis.as];
  if (fitted) return fitted;
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
 * `given` is the kinds the deck's plan gives the page's open exhibits
 * (openKindsOf, by page): a stub whose kind is open is read as the kind it is
 * given there, so a draft and a plan read one stub as one kind. Without it
 * the stub is read as the first of the kinds that carry it best.
 */
export function stubsOf(page, insights, given = null) {
  const registry = registryOf(insights);
  const own = exhibitsOf(page && typeof page === "object" ? page : {});
  const plots = own.filter(undrawnExhibit).map((ex) => declaredPlot(ex.basis, registry));
  const fitted = new Map((given ?? (own.some((ex) => undrawnExhibit(ex) && ex.type === undefined) ? openKinds(page, insights) : [])).map((item) => [item.at, item.kind]));
  return { kinds: own.map((ex, at) => (undrawnExhibit(ex) ? stubKind(ex.basis, registry, fitted.get(at) ?? null) : null)), values: plots.every((n) => n !== null) ? plots.reduce((sum, n) => sum + n, 0) : null };
}

// The workflow of a point change to an imported deck (review-passes.mjs REVISION), named here so the structure search loads no review code.
const REVISION = "existing_deck_revision";
const sourceOf = (page) => page?.pageType?.sourceSlide ?? page?.sourceSlide;

/**
 * How a revision's source deck draws its pages: how many of the imported
 * pages are drawn in each form (`forms`, by `<type>/<form>`) and in each
 * exhibit kind (`kinds`) - the kinds each page's source slide drew where the
 * inventory says (`sourceKinds`, by source slide), else the ones the page
 * itself writes or its form sets. What a page the revision adds or redraws is
 * matched to, so the deck stays drawn one way.
 */
function sourceConventions(pages, sourceKinds) {
  const forms = new Map(), kinds = new Map();
  const count = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
  for (const page of pages) {
    if (!page || typeof page !== "object" || page.sourceSlide === undefined) continue;
    const type = PAGE_TYPES[page.type], formed = type && Object.hasOwn(type.forms, page.form ?? "");
    if (formed) count(forms, `${page.type}/${page.form}`);
    const own = exhibitsOf(page).filter((ex) => ex.type).map((ex) => String(ex.type));
    for (const kind of sourceKinds?.get?.(page.sourceSlide) ?? (own.length ? own : formed ? [String(type.forms[page.form])] : [])) count(kinds, kind);
  }
  return { forms, kinds };
}

/**
 * The pages of a revision kept as their source slide drew them, by id: an
 * imported page whose exhibits are of the kinds its slide drew (`sourceKinds`,
 * by source slide; without an inventory, every imported page). They are the
 * user's own drawing: the fit is not read against them. Null for new work.
 */
export function keptAsSource(spec, sourceKinds = null) {
  if (spec?.workflow !== REVISION) return null;
  const kindsOf = (page) => exhibitsOf(page).map((ex) => String(ex.type ?? "")).filter(Boolean).sort().join("|");
  return new Set([...(spec.slides ?? spec.pages ?? []), ...(spec.appendix ?? [])].filter((page) => page && typeof page === "object" && sourceOf(page) !== undefined)
    .filter((page) => !sourceKinds?.has?.(sourceOf(page)) || kindsOf(page) === [...sourceKinds.get(sourceOf(page))].sort().join("|")).map((page) => String(page.id)));
}
/**
 * The exhibits the slides a revision carries from its source deck draw, as
 * `[{ id, kind }]`: `carried` is the carried pages - the compiled deck's
 * `carried`, or the pages file's pages marked `carry: true` - and
 * `sourceKinds` what each source slide drew (fit-review.mjs sourceKindsOf).
 * A carried slide is never compiled, so the deck's share of exhibit kinds
 * counts it from here (gates/variety_gates.mjs fitStandings); it is the
 * user's own, and nothing of it is judged.
 */
export const carriedKinds = (carried, sourceKinds) => (carried || []).flatMap((page) => (sourceKinds?.get?.(page?.sourceSlide) ?? []).map((kind) => ({ id: String(page.id), kind })));
// What stands for an exhibit kind nobody has declared, to tell which stand-ins rest on an estimate.
const UNDECLARED = "(undeclared)";
/** Does a page's stand-in under `choice` carry an exhibit whose kind neither the page nor its form declares. */
const estimatedUnder = (page, index, choice) => { const slide = declaredSlide({ ...page, ...choice }, index, { exhibitType: UNDECLARED }); return Boolean(slide) && exhibitsOf(slide).some((ex) => ex.type === UNDECLARED); };

// Types whose form names what the subject is - a cycle, a gantt, a memo, a
// map - rather than how a measure is drawn. A plan keeps the form such a page
// declares, or the type's first; it never picks one to satisfy a mix rule. A
// summary's form is its place: the deck's answer where it opens the deck, and
// what to keep from it where it comes after the first analytical page
// (`closing`) - an opening summary's answer table is not a closing list's.
const SUBJECT_FORMS = new Set(["mechanism", "schedule", "picture", "argument", "statement", "summary", "place", "matrix", "bridge"]);
const openForms = (type, closing = false) => (type === "summary" && closing ? ["takeaways"] : SUBJECT_FORMS.has(type) ? Object.keys(PAGE_TYPES[type].forms).slice(0, 1) : plannableForms(type));

/**
 * The choices a plan takes freely for a page: the form it declares; or the
 * forms that carry its claim best where its measures say what the claim asks
 * of a reader (`fitted`, claim-fit.mjs); or the forms that read the data its
 * type's first form reads (a summary's by its place: `closing`, it comes after
 * the deck's first analytical page). Each with the placement the page declares where
 * that form compiles with it, or with every placement the form takes. Empty
 * for a page with no known type.
 */
export function freeChoices(page, fitted = null, closing = false) {
  const type = page && typeof page === "object" ? PAGE_TYPES[page.type] : null;
  if (!type) return [];
  const forms = Object.hasOwn(type.forms, page.form ?? "") ? [page.form] : fitted?.length ? fitted : openForms(page.type, closing);
  // A placement the page declares is kept on every form that compiles with it.
  return forms.flatMap((form) => { const placements = placementsOf(page.type, form);
    return (placements.includes(page.commentary) ? [page.commentary] : placements).map((commentary) => ({ form, commentary })); });
}

/**
 * The kinds a deck's open exhibits take, by page (`Map` page -> openKinds'
 * result): every page whose form leaves the kind of an exhibit open and that
 * has not said it, in page order, each cut given - of the kinds that carry it
 * equally well - the one the deck's draw features, then the one whose turn it
 * is in the deck's hand for the cut's reading task (drawOrder: counted over the
 * exhibits the pages type themselves, the charts their declared forms draw,
 * and the cuts already given). A deck with no draw takes the one it draws
 * least. On a revision the one the source deck draws most (`sourceKinds`:
 * what each source slide drew), and nothing is featured: its like is drawn
 * its way. One reading for a plan and a draft: both stand a stub in as the
 * kind it is given here.
 */
export function openKindsOf(doc, insights, { sourceKinds = null } = {}) {
  const draw = drawOf(doc.deck), revision = doc.deck?.workflow === REVISION;
  const all = [...(doc.pages || []), ...(doc.appendix || [])], pages = all.filter((page) => page && typeof page === "object" && PAGE_TYPES[page.type]);
  const bySource = revision ? sourceConventions(all, sourceKinds) : null;
  const drawnKinds = new Map();
  const drew = (kind) => drawnKinds.set(kind, (drawnKinds.get(kind) ?? 0) + 1);
  for (const page of pages) {
    const own = exhibitsOf(page).filter((ex) => ex.type).map((ex) => String(ex.type)), drawsByForm = PAGE_TYPES[page.type].forms[page.form ?? ""];
    own.forEach(drew);
    if (!own.length && typeof drawsByForm === "string" && drawsByForm.startsWith("chart.")) drew(drawsByForm);
  }
  const given = new Map();
  for (const page of pages) {
    const kinds = openKinds(page, insights, { seed: draw.seed, featured: draw.kinds, fewest: (kind) => drawnKinds.get(kind) ?? 0, convention: revision ? (kind) => -(bySource.kinds.get(kind) ?? 0) : null });
    if (!kinds.length) continue;
    given.set(page, kinds);
    kinds.forEach((item) => drew(item.kind));
  }
  return given;
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
 * A page whose fit is read (claim-fit.mjs) is given one of the forms that
 * carry its claim best, and stays among them whatever a rule says: a rule
 * those forms cannot meet between them is left unsatisfied, with the pages so
 * held (`pinned`). Where several fit equally the choice is made by what the
 * deck's draw features, then the spread of the deck's kinds, then the room
 * under the caps, then the deck's `variation` - each page says which (`by`).
 * `forms: "any"` asks instead whether any allocation the catalogue allows
 * meets the rules: the forms that only serve a claim are then tried to mend a
 * broken rule, and a page so moved is marked (`served`). That is the question
 * a draft asks before it holds a rule against a spine; the plan asks it only
 * to say what a rule its best-fit forms cannot meet would cost.
 *
 * On a revision (`sourceKinds`: what each source slide drew, by slide) an
 * imported page keeps the form it declares and is never changed for a rule;
 * one that declares none takes the form that draws what its slide drew; and a
 * page the revision adds takes, of its candidates, the form the source deck
 * draws most. Nothing is spread and nothing featured.
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
// A rule the page types alone break cannot be met by any form or placement.
const TYPE_RULES = new Set(["VARIETY_TYPE_SHARE", "VARIETY_TYPE_RANGE", "VARIETY_TYPE_RUN", "PAGE_TYPE_UNDECLARED"]);
const brokenStandings = (current) => current.standings.filter((standing) => standing.blocks && ["over", "short"].includes(standingRoom(standing).state));
// Whether a broken rule is one a form or a placement can mend: while only the types break rules, widening the search
// to declared pages or pairs of changes reads the structure tens of thousands of times for nothing.
const mendable = (current) => brokenStandings(current).some((standing) => !TYPE_RULES.has(standing.code))
  || current.findings.some((f) => isBlocking(f) && classOf(f.code) === "S" && !TYPE_RULES.has(f.code));

export function allocateStructure(doc, { insights = null, planOf, compiled = null, blocksOf = null, sourceKinds = null, forms = "best", maxSteps = 40, maxEvaluations = 40000 } = {}) {
  let evaluations = 0;
  // The deck's draw, which orders the choices left free once fit and spread have been weighed; a deck without one takes the catalogue's order.
  const seed = doc.deck?.variation ?? null;
  // A revision's imported pages are the user's own: each keeps the form it declares, whatever a rule or the fit says of it, and
  // a page the revision adds or redraws is drawn as the source deck draws its like before the fit's free choices are spread.
  const revision = doc.deck?.workflow === REVISION;
  // What the draw features from the design system's repertoire: among forms and kinds of equal fit, these come first. A revision features nothing.
  const featured = drawOf(doc.deck);
  const formRank = (type, form, task) => formDraw(seed, type, form, task);
  const registry = registryOf(insights);
  const all = [...(doc.pages || []).map((page) => ({ page, appendix: false })), ...(doc.appendix || []).map((page) => ({ page, appendix: true }))];
  const drawnBySource = revision ? sourceConventions(all.map(({ page }) => page), sourceKinds) : null;
  const opening = all.findIndex(({ page }) => PAGE_TYPES[page?.type]);
  const entries = all.map(({ page, appendix }, index) => {
    const type = page && typeof page === "object" ? PAGE_TYPES[page.type] : null;
    if (!type) return { page, index, appendix, fixed: true };
    const formDeclared = Object.hasOwn(type.forms, page.form ?? "");
    // How the type's forms carry the page's claim, where its measures say what the claim asks of a reader: a page that declares no
    // form is given one of those that carry it best, and only those are weighed against each other for spread and by the draw.
    const fit = registry.size ? pageFit(page, { registry, insights }) : null;
    const gradeIn = (form) => (fit?.task ? fit.forms.ranked.find((item) => item.form === form)?.grade ?? 0 : null);
    const best = !formDeclared && fit?.task ? fit.forms.equal.map((item) => item.form).filter((form) => Object.hasOwn(type.forms, form)) : [];
    // On a revision: a page imported from a slide that drew a chart or a table takes the form that draws the same, whatever the
    // fit says of it; any other page that declares no form takes, of the forms it could be given, the one the source deck draws most.
    const open = openForms(page.type, index > opening), candidates = best.length ? best : formDeclared ? [] : open;
    const asSource = revision && !formDeclared && page.sourceSlide !== undefined ? Object.keys(type.forms).filter((form) => (sourceKinds?.get?.(page.sourceSlide) ?? []).includes(String(type.forms[form]))) : [];
    const used = (form) => (drawnBySource?.forms.get(`${page.type}/${form}`) ?? 0) * 1000 + (drawnBySource?.kinds.get(String(type.forms[form])) ?? 0);
    const most = revision && !asSource.length && candidates.length ? Math.max(...candidates.map(used)) : 0;
    const conventional = most > 0 ? candidates.filter((form) => used(form) === most) : [];
    const given = asSource.length ? asSource.filter((form) => !best.length || best.includes(form)).concat(asSource).slice(0, 1) : conventional.length ? conventional : candidates;
    const options = freeChoices(page, given);
    const declared = formDeclared && placementsOf(page.type, page.form).includes(page.commentary);
    // Every choice the plan may take to mend a broken rule when the free ones cannot. A page whose fit is read never leaves the
    // forms that carry its claim best - a rule those cannot meet is reported unmet, not met with a weaker picture - and a
    // declared form whose fit is read is changed only for one that carries the claim at least as directly.
    // (`forms: "any"` asks the other question - whether any allocation the catalogue allows meets the rules - and lifts both.)
    const mendable = asSource.length ? given : forms === "any" ? Object.keys(type.forms) : best.length ? given : formDeclared && fit?.chosen ? Object.keys(type.forms).filter((form) => gradeIn(form) >= fit.chosen.grade) : Object.keys(type.forms);
    // A summary's form is its place (openForms), not the layout's: no rule turns a closing list into a second answer.
    const wider = page.type === "summary" ? [] : mendable.flatMap((form) => placementsOf(page.type, form).map((commentary) => ({ form, commentary })));
    // The page as the compile reads it, where it compiles as written under the choices it declares.
    const written = declared ? compiled?.get?.(String(page.id ?? `page-${index + 1}`)) ?? null : null;
    return { page, index, appendix, type, options, wider, declared, formDeclared, written, slides: new Map(), fit, best, open, fitted: best.length > 0, imported: revision && page.sourceSlide !== undefined,
      // The forms the page is held to by its fit, where that is fewer than its type has: what a rule left unmet is pinned by.
      held: mendable.length < Object.keys(type.forms).length && !asSource.length ? mendable : null,
      by: asSource.length ? "source" : conventional.length && conventional.length < candidates.length ? "convention" : null,
      choice: declared ? { form: page.form, commentary: page.commentary } : options[0], exhibitType: evidenceExhibits(page, insights, featured), stubs: stubsOf(page, insights) };
  });
  // The kinds of the exhibits whose form leaves them open (openKindsOf): a stub the spine declares with no kind is stood in for
  // by the kind it is given there, whatever told it from its equals.
  const open = openKindsOf(doc, insights, { sourceKinds });
  for (const entry of entries.filter((e) => !e.fixed)) {
    const kinds = open.get(entry.page);
    if (!kinds?.length) continue;
    entry.kinds = kinds;
    entry.exhibitType = kinds.map((item) => item.kind);
    entry.stubs = stubsOf(entry.page, insights, kinds);
  }
  const slideOf = (entry, choice) => {
    const key = `${choice.form}/${choice.commentary}`;
    if (entry.written && choice.form === entry.page.form && choice.commentary === entry.page.commentary) return entry.written;
    if (!entry.slides.has(key)) entry.slides.set(key, declaredSlide({ ...entry.page, ...choice }, entry.index, { exhibitType: entry.exhibitType, players: doc.deck?.players, stubs: entry.stubs }));
    return entry.slides.get(key);
  };
  // The deck under the choices as they stand, one page swapped for another choice where `override` names it.
  const specOf = (override = null) => {
    const slides = [], appendix = [];
    for (const entry of entries) {
      const slide = entry.fixed ? (entry.page && typeof entry.page === "object" && entry.page.kind ? entry.page : null)
        : slideOf(entry, override?.entry === entry ? override.choice : entry.choice);
      if (slide) (entry.appendix ? appendix : slides).push(slide);
    }
    return { ...doc.deck, slides, ...(appendix.length ? { appendix } : {}) };
  };
  const evaluate = (override = null) => {
    evaluations += 1;
    const spec = specOf(override), slides = spec.slides, appendix = spec.appendix ?? [];
    const declared = declaredStructure(spec, { planOf });
    const shape = shapeStructure([...slides, ...appendix].filter((slide) => slide.pageType).map((slide) => ({ id: slide.id, architecture: declaredArchitecture(slide) })),
      { airy: resolveFill(spec) === "airy" });
    // The deck's median words a block under these choices, where the caller read each page's off its scene (`blocksOf`: the
    // page as its copy is written, never a stand-in for copy to come): it steers the free choices and never refuses a plan -
    // the render measures the rule.
    const read = blocksOf ? entries.filter((entry) => !entry.fixed).map((entry) => [entry, blocksOf(entry.page, override?.entry === entry ? override.choice : entry.choice)]).filter(([, blocks]) => blocks?.prose && blocks.count > 0) : [];
    const sizes = read.map(([, blocks]) => blocks.wordsPerBlock).sort((a, b) => a - b);
    const middle = sizes.length ? (sizes.length % 2 ? sizes[(sizes.length - 1) / 2] : (sizes[sizes.length / 2 - 1] + sizes[sizes.length / 2]) / 2) : null;
    const estimate = sizes.length >= BLOCKS.from ? [["floor", BLOCKS.low, "min"], ["ceiling", BLOCKS.high, "max"]].map(([key, bar, side]) => ({ code: "TEXT_FRAGMENTED", key, what: "median words a block on the prose pages", value: round(middle, 1), bar, side, unit: "words",
      applies: true, blocks: false, estimated: "read from the scene of the pages as their copy is written, the way --check reads it; the render measures it", tolerance: BLOCKS.tolerance, each: Object.fromEntries(read.map(([entry, blocks]) => [String(entry.page.id ?? `page-${entry.index + 1}`), blocks.wordsPerBlock])) })) : [];
    return { findings: [...declared.findings, ...shape.findings], standings: [...declared.standings, ...shape.standings, ...estimate] };
  };
  const typed = entries.filter((entry) => !entry.fixed);
  const before = evaluate();
  // Each open page in turn takes the choice that leaves the cost lowest. Where its choices are forms that carry its claim
  // equally well, two that leave the rules as they were are told apart by whether the deck's draw features one, then by the
  // deck's own hand for the page's reading task (claim-fit.mjs drawOrder): so one deck draws one task one way wherever the claim leaves the
  // choice free, and two decks from one brief differ there and nowhere else. A deck with no draw spreads its kinds instead.
  // A page whose fit is not read keeps the catalogue's order, as before: nothing is rotated that no fit ranks. A revision
  // spreads nothing: its free choices were already narrowed to the source deck's own (above), and the draw breaks what is left.
  const decided = new Map();
  const kindsUnder = (entry, choice) => { const slide = slideOf(entry, choice); return slide ? exhibitKinds(slide) : []; };
  const settle = (entry) => { for (const kind of kindsUnder(entry, entry.choice)) decided.set(kind, (decided.get(kind) ?? 0) + 1); };
  typed.filter((e) => e.declared).forEach(settle);
  for (const entry of typed.filter((e) => !e.declared)) {
    const weighed = entry.options.map((choice) => ({ choice, cost: structureCost(evaluate({ entry, choice })),
      spread: entry.fitted && !revision ? kindsUnder(entry, choice).reduce((sum, kind) => sum + (decided.get(kind) ?? 0), 0) : 0 }));
    // The rules first, then the deck's draw (claim-fit.mjs drawOrder), then the room under the caps. What told the form from the
    // others it could have taken is the first thing it and the strongest of them differ on.
    const { ordered: [best, ...rest], by } = drawOrder(weighed, { seed: entry.fitted ? seed : null, task: entry.fit?.task, featured: entry.fitted ? featured.forms : null, load: (w) => w.spread,
      mark: (w) => `${entry.page.type}/${w.choice.form}`, before: [["rules", (a, b) => (heldCheaper(a.cost, b.cost) ? -1 : heldCheaper(b.cost, a.cost) ? 1 : 0)]],
      after: [["room", (a, b) => (Math.abs(a.cost.pressure - b.cost.pressure) > 1e-9 ? a.cost.pressure - b.cost.pressure : 0)]] });
    const rival = rest.find((w) => w.choice.form !== best.choice.form);
    if (entry.fitted && rival && !entry.by) entry.by = by(best, rival);
    entry.choice = best.choice;
    settle(entry);
  }
  // A page's choices with those that keep its form first: of two changes that mend a rule equally, the one that moves only the
  // commentary is taken, so a form the spread or the draw chose is not changed as a side effect of a placement.
  const sameFormFirst = (entry, choices) => [...choices.filter((choice) => choice.form === entry.choice.form), ...choices.filter((choice) => choice.form !== entry.choice.form)];
  // Then single changes, while one lowers the cost: the open pages first, the declared ones only when no open page helps.
  let current = evaluate(), cost = structureCost(current), steps = 0, capped = false;
  while ((((cost.blockers || cost.lacking) && mendable(current)) || cost.drift || cost.tight) && !capped) {
    let best = null;
    // The open pages' free choices first. Only to mend a broken rule, never for room alone: a form built for
    // particular data on a page that declares no form, and last a change to a declared choice - a declared form
    // among them, which is kept while only its placement is open and changed only here, where it is reported.
    const open = typed.filter((e) => !e.declared), broken = Boolean(cost.blockers || cost.lacking) && mendable(current);
    // An estimate steers the free choices only: a form built for particular data, or a change to a declared choice, is taken
    // for the rules the plan is held to, so those are weighed with the estimate left out.
    const held = (c) => ({ ...c, drift: 0 });
    for (const [pool, choices, free] of [[open, "options", true], ...(broken ? [[open.filter((e) => !e.formDeclared), "wider", false], [typed.filter((e) => (e.declared || e.formDeclared) && !e.imported), "wider", false]] : [])]) {
      for (const entry of pool) for (const choice of sameFormFirst(entry, entry[choices])) {
        if (choice.form === entry.choice.form && choice.commentary === entry.choice.commentary) continue;
        // A form chosen among equals by the spread and the draw is changed to mend a broken rule, never for room alone:
        // room is made with placements, or the seed's choices would be undone wherever a rule sat at its bar.
        if (!broken && entry.fitted && choice.form !== entry.choice.form) continue;
        const next = structureCost(evaluate({ entry, choice }));
        if (free ? cheaper(next, best?.cost ?? cost) : cheaper(held(next), held(best?.cost ?? cost))) best = { entry, choice, cost: next };
      }
      if (best) break;
    }
    // A rule that counts the commonest of several classes - the commonest skeleton, placement or architecture - does not move
    // when a page leaves a class tied with another over the cap: two changes mend it and neither is cheaper alone. So where
    // no single change helps a broken rule, a page that rule counts is moved to a free choice that makes nothing worse, and
    // the single changes are read again from there; the first such pair that ends cheaper is taken.
    if (!best && broken) {
      const counted = new Set(current.standings.filter((standing) => standing.blocks && ["over", "short"].includes(standingRoom(standing).state)).flatMap((standing) => standing.pages ?? []).map(String));
      pairs: for (const entry of open.filter((e) => counted.has(String(e.page.id ?? `page-${e.index + 1}`)))) for (const choice of sameFormFirst(entry, entry.options)) {
        if (choice.form === entry.choice.form && choice.commentary === entry.choice.commentary) continue;
        const moved = structureCost(evaluate({ entry, choice }));
        if (moved.blockers > cost.blockers || moved.lacking > cost.lacking + 1e-9 || evaluations >= maxEvaluations) continue;
        const kept = entry.choice;
        entry.choice = choice;
        for (const other of open) for (const next of sameFormFirst(other, other.options)) {
          if (other === entry || (next.form === other.choice.form && next.commentary === other.choice.commentary)) continue;
          const after = structureCost(evaluate({ entry: other, choice: next }));
          if (cheaper(after, best?.cost ?? cost)) best = { entry: other, choice: next, cost: after, first: { entry, choice } };
        }
        entry.choice = kept;
        if (best) break pairs;
      }
      if (best) { if (best.first.choice.form !== best.first.entry.choice.form) best.first.entry.by = "rules"; best.first.entry.choice = best.first.choice; steps += 1; }
    }
    if (!best) break;
    // A form changed here was changed for a rule, whatever chose it first.
    if (best.choice.form !== best.entry.choice.form) best.entry.by = "rules";
    best.entry.choice = best.choice;
    steps += 1;
    current = evaluate();
    cost = structureCost(current);
    capped = steps >= maxSteps || evaluations >= maxEvaluations;
  }
  const broken = brokenStandings(current);
  const unsatisfied = [...new Map([...broken.map((standing) => [`${standing.code}${standing.key ? `.${standing.key}` : ""}`, { code: standing.code, standing }]),
    ...current.findings.filter((f) => isBlocking(f) && classOf(f.code) === "S" && !broken.some((standing) => standing.code === f.code)).map((f) => [f.code, { code: f.code, finding: f }])]).values()]
    .map((item) => ({ ...item, fixedByTypes: TYPE_RULES.has(item.code) }));
  const changed = (entry) => entry.choice.form !== entry.page.form || entry.choice.commentary !== entry.page.commentary;
  // A page that declares its form and not where its commentary sits keeps the form: only the placement is proposed.
  const formChanged = (entry) => entry.formDeclared && entry.choice.form !== entry.page.form;
  // A page read off an estimate: it does not compile as written, and neither it nor its form says what kind an exhibit of it is.
  const estimated = (entry) => !(entry.written && !changed(entry)) && estimatedUnder(entry.page, entry.index, entry.choice);
  // What the fit says of each page's choice, for the plan to print: the task read from its measures, the other forms that carry it
  // as well (the latitude) and what told the chosen one from them, the forms that carry it more directly than the one it has, and
  // the kinds its open exhibits were given.
  const shapesOf = (entry) => (Array.isArray(entry.page.evidence) ? entry.page.evidence : []).map((id) => insights?.get?.(id)?.shape).filter(Boolean);
  const fitNote = (entry) => {
    const fit = entry.fit, ranked = fit?.task ? fit.forms : null;
    const grade = ranked ? ranked.ranked.find((item) => item.form === entry.choice.form)?.grade ?? 0 : null;
    const judged = entry.formDeclared && entry.choice.form === entry.page.form && !fit?.chosen;
    const equal = ranked ? ranked.equal.map((item) => item.form) : [];
    const shapes = shapesOf(entry);
    const carriedBy = (type) => !TYPE_SHAPES[type] || shapes.some((shape) => TYPE_SHAPES[type].includes(shape));
    const elsewhere = registry.size && !entry.imported ? otherTypes(entry.page, { registry, insights, carriedBy }) : [];
    // And the forms of other types that carry the claim as directly as this one's best, where the page's evidence can rest under
    // that type: the page's latitude in its type, with the one this deck's draw would take where it ranks one above the page's own.
    const beside = registry.size && !entry.imported && !revision ? otherTypes(entry.page, { registry, insights, carriedBy, equal: true }) : [];
    const ownRank = seed !== null && fit?.task ? formRank(entry.page.type, entry.choice.form, fit.task) : null;
    const drawn = ownRank === null ? null : beside.filter((item) => formRank(item.type, item.form, item.task) < ownRank).sort((a, b) => formRank(a.type, a.form, a.task) - formRank(b.type, b.form, b.task))[0] ?? null;
    // Where the author declared a choice the fit leaves free - a form, or the kind of an exhibit on a page of open kinds - the
    // mark this deck's draw takes among its equals, when it is another: said, never made (a declared choice is always kept).
    const kept = entry.formDeclared && entry.choice.form === entry.page.form;
    const hand = seed !== null && !revision && kept && ranked && !judged && grade === ranked.top && equal.length > 1
      ? drawOrder(equal, { seed, task: fit.task, featured: featured.forms, mark: (form) => `${entry.page.type}/${form}` }).ordered[0] : null;
    const typed = seed !== null && !revision ? (fit?.exhibits ?? []).filter((item) => item.written && item.kind && item.grade === item.kinds.top).map((item) => {
      const kinds = drawOrder(item.kinds.equal.map((kind) => kind.kind).filter((kind) => kind.startsWith("chart.")), { seed, task: item.task, featured: featured.kinds }).ordered;
      return { where: `exhibit ${item.at + 1}`, has: item.kind, task: item.task, also: kinds.filter((kind) => kind !== item.kind), hand: kinds[0] };
    }).filter((item) => item.also.length && item.hand !== item.has) : [];
    return { ...(ranked ? { task: fit.task } : {}), ...(ranked && !judged && grade === ranked.top && equal.length > 1 ? { also: equal.filter((form) => form !== entry.choice.form) } : {}),
      ...(hand && hand !== entry.choice.form ? { hand } : {}), ...(typed.length ? { typed } : {}),
      ...(entry.by && (!entry.formDeclared || entry.choice.form !== entry.page.form) ? { by: entry.by } : {}),
      ...(ranked && !judged && grade < ranked.top && !entry.imported ? { better: equal } : {}), ...(entry.kinds?.length ? { kinds: entry.kinds } : {}),
      ...(fit?.left.some((item) => item.where !== "form") && !entry.imported ? { exhibits: fit.left.filter((item) => item.where !== "form") } : {}), ...(elsewhere.length ? { elsewhere } : {}),
      ...(beside.length ? { beside: beside.map(({ type, form }) => ({ type, form })), ...(drawn ? { typeHand: { type: drawn.type, form: drawn.form, kind: kindOfForm(drawn.type, drawn.form) } } : {}) } : {}) };
  };
  // A page moved off the forms that carry its claim best: one given a form outside them, or a declared form changed for one outside them.
  const offBest = (entry) => Boolean(entry.fit?.task) && !entry.fit.forms.equal.some((item) => item.form === entry.choice.form) && (entry.fitted || (Boolean(entry.fit.chosen) && entry.choice.form !== entry.page.form));
  // A rule left unmet while pages are held to the forms that carry their claims best: the pages so held, for the plan to name.
  const pinned = unsatisfied.length ? typed.filter((entry) => entry.held && !entry.imported).map((entry) => ({ id: entry.page.id ?? `page-${entry.index + 1}`, forms: entry.held })) : [];
  // The deck's exhibits by kind under the allocation, and the pages whose form leaves fit unused (gates/variety_gates.mjs fitStandings): read once, on the result.
  const final = specOf();
  const spread = fitStandings(final, { fits: fitsOf(final, insights), kept: keptAsSource(final, sourceKinds), carried: carriedKinds(all.map(({ page }) => page).filter((page) => page?.carry === true), sourceKinds) });
  current.standings.push(...spread.standings);
  return {
    pages: typed.map((entry) => ({ id: entry.page.id ?? `page-${entry.index + 1}`, type: entry.page.type, form: entry.choice.form, commentary: entry.choice.commentary,
      source: formChanged(entry) || (entry.declared && changed(entry)) ? "changed" : entry.declared ? "declared" : entry.formDeclared ? "placed" : "proposed", ...(estimated(entry) ? { estimated: true } : {}),
      ...(entry.imported ? { imported: true } : {}), ...fitNote(entry),
      // Under `forms: "any"`: a page moved off the forms that carry its claim best to meet a rule, with the forms it left.
      ...(offBest(entry) ? { served: entry.fit.forms.equal.map((item) => item.form) } : {}),
      // The exhibits the page draws under its choice, by kind: what the deck's spread is counted over.
      draws: exhibitsOf(slideOf(entry, entry.choice) ?? {}).map((ex) => String(ex.type ?? "")).filter(Boolean),
      // A form the plan took only to mend a rule, with the data it is built for: the author checks the evidence holds it.
      // (A form the page's own measures fill, and that carries its claim best, was chosen for that and needs no such check.)
      ...(!entry.declared && entry.page.form !== entry.choice.form && !entry.open.includes(entry.choice.form) && !(entry.fitted && entry.best.includes(entry.choice.form)) && entry.by !== "source"
        ? { reads: dataKeys(entry.type.forms[entry.choice.form], { type: entry.page.type, form: entry.choice.form }) } : {}),
      ...((entry.declared && changed(entry)) || formChanged(entry) ? { was: { form: entry.page.form, ...(entry.declared ? { commentary: entry.page.commentary } : {}) } } : {}) })),
    structure: current, declared: before, satisfied: !unsatisfied.length, unsatisfied, pinned, steps, evaluations, capped: capped && !!(cost.blockers || cost.lacking),
  };
}
