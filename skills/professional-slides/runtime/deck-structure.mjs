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
import { PAGE_TYPES, dataKeys, declaredSlide, declaredUnits, drawnOf, placementsOf, plannableForms, structureOf, undrawnExhibit, exhibitRange } from "./page-types.mjs";
import { TYPE_SHAPES } from "./evidence.mjs";
import { axisOf, measureRegistry, normalUnit, valuesOf } from "./measures.mjs";
import { declaredPlot, refsOf } from "./gates/dependency_gates.mjs";
import { resolveFill } from "./compose-points.mjs";
import { DECK_LENGTH, PLAN } from "./weight.mjs";
import { describeGaps, periodTimes } from "./time-axis.mjs";
import { VARIETY, exhibitFamily, exhibitKinds, exhibitMix, fitStandings, pageFamily, structureMix, varietyFindings } from "./gates/variety_gates.mjs";
import { drawOrder, formDraw, kindOfForm, pageFit, otherTypes, sharedKinds } from "./claim-fit.mjs";
import { featuredDraw } from "./design-systems.mjs";
import { architecture, planBlockers, runPlanGates, styleEntropy } from "./gates/plan_gates.mjs";
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
// The placements that put developed text on the page (page-types.mjs COMMENTARY): points beside or under the exhibit, a
// caption under each panel. The others - a rail, a so-what bar, callouts on the plot, the exhibit's own cells, none - leave
// it to what the page writes.
const PLACED_COMMENTARY = Object.freeze(["beside", "beside-left", "below", "captions"]);

export function declaredArchitecture(slide) {
  if (!slide?.pageType || slide.kind === "statement" || slide.kind === "takeaways") return null;
  const blocks = Array.isArray(slide.blocks) ? slide.blocks : [];
  const types = [...exhibitsOf(slide), ...blocks.map((block) => block?.exhibit).filter(Boolean)].map((ex) => String(ex.type ?? ""));
  const evidence = types.filter(isEvidence);
  // A findings matrix is drawn as a table, and a model page sets its chart over its own data table.
  if (slide.shape === "findings-matrix" || slide.shape === "model-page") evidence.push("table");
  const captioned = slide.pageType.commentary === "captions" || exhibitsOf(slide).some((ex) => typeof ex.caption === "string" && ex.caption.trim());
  // A page declared with its commentary beside or below the exhibit is written with it - the compile refuses the placement
  // without the points it places - so a spine page is counted by its placement before its copy exists. On the BA retest the
  // lead moved nine pages to commentary placements and the provisional count, which read only written points, did not move.
  const placed = PLACED_COMMENTARY.includes(slide.pageType.commentary);
  const comments = placed || (slide.points || []).length > 0 || (slide.paragraphs || []).length > 0 || captioned || blocks.some((block) => (block?.points || []).length) || types.includes("cards");
  // A panel of figures is figures, as the composed page's gate reads it (gates/deck_gates.py page_architecture).
  const metrics = Boolean(slide.kpi) || (slide.metrics || []).length > 0 || blocks.some((block) => block?.metric) || types.includes("metrics");
  // Where the figures sit against the evidence - over it or beside it - is what the gate reads off the composed page. A page
  // not yet composed has no layout; its form says where they will sit: a numbers page's hero number or metric strip
  // (page-types.mjs), an executive summary's measures across the top (compose-passes.mjs), a panel of figures at either end
  // of a row or a sequence, or atop a stack. Read as commentary instead, the BA deck's executive summary and its fuel
  // sequence (two charts, then IAG's guidance as figures) put the declared count two pages over the composed one, and the
  // written deck a page over its cap.
  const panels = exhibitsOf(slide).map((ex) => String(ex.type ?? "")), form = slide.pageType.form;
  const figuresAt = (at) => panels.length > 1 && panels.at(at) === "metrics";
  const layout = slide.layout ?? (form === "hero-number" ? "hero-number"
    : form === "metric-strip" || slide.role === "executive-summary" || (slide.arrange === "stack" && figuresAt(0)) ? "metrics-over-exhibit"
    : ["row", "sequence"].includes(slide.arrange) && (figuresAt(0) || figuresAt(-1)) ? "hero-number" : null);
  if (evidence.length) {
    if (metrics && layout === "metrics-over-exhibit") return "metrics-over-evidence";
    if (metrics && layout === "hero-number") return "hero-number-with-evidence";
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
export const BLOCK_ESTIMATE_TOLERANCE = 2;

/**
 * A deck's page architectures in page order, counted as PAGE_SHAPE_FLAT counts
 * them (deck_gates.py shape_variety): the distinct architectures per ten pages,
 * averaged over ten-page windows, and the commonest one.
 */
export function shapeVariety(shapes) {
  const counts = new Map();
  for (const shape of shapes) counts.set(shape, (counts.get(shape) || 0) + 1);
  const window = Math.min(10, shapes.length), windows = shapes.length - window + 1;
  // The window slides a page at a time, its distinct shapes counted as it goes: a structure search reads this for every
  // candidate deck, and a set built afresh for each of a hundred windows was a tenth of the search.
  const inWindow = new Map();
  const enter = (shape) => inWindow.set(shape, (inWindow.get(shape) ?? 0) + 1);
  const leave = (shape) => { const left = inWindow.get(shape) - 1; if (left) inWindow.set(shape, left); else inWindow.delete(shape); };
  for (let at = 0; at < window - 1; at += 1) enter(shapes[at]);
  let total = 0;
  for (let at = 0; at < windows; at += 1) {
    if (window) enter(shapes[at + window - 1]);
    total += (inWindow.size * 10) / window;
    if (window) leave(shapes[at]);
  }
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
 * for the caller to file. `weighing` asks only what a search weighs a deck by
 * (structureCost): the standings and the blocking findings of the structure
 * class, the plan's advisories left unread (plan_gates.mjs planBlockers).
 */
export function declaredStructure(spec, { planOf, insights = undefined, sourceKinds = null, memo = null, weighing = false }) {
  const standings = [];
  // `memo` is a structure search's: the page objects it swaps in and out are read once each, however often the deck is read.
  const structureOfSlide = memo ? (slide) => { if (!memo.structures.has(slide)) memo.structures.set(slide, structureOf(slide)); return memo.structures.get(slide); } : structureOf;
  const variety = varietyFindings(spec, { structureOf: structureOfSlide, drawnOf, standings, memo });
  // How the deck's exhibits are spread over their kinds, and the pages drawn in a form that carries their claim less directly than
  // another they could take: said with the standings, and never a refusal (gates/variety_gates.mjs fitStandings). Read where the
  // caller passes the insight log (null where the deck has none); a search that only weighs the rules leaves it out.
  const fit = insights === undefined ? { findings: [], standings: [] } : fitStandings(spec, { fits: fitsOf(spec, insights), kept: keptAsSource(spec, sourceKinds), carried: carriedKinds(spec.carried, sourceKinds) });
  standings.push(...fit.standings);
  variety.push(...fit.findings);
  const plan = planOf(spec, memo ? { records: memo.records } : undefined);
  const report = weighing ? { findings: planBlockers(plan, { deck: spec, reads: memo?.reads, shapes: memo?.shapes }) } : runPlanGates(plan, { deck: spec, reads: memo?.reads });
  const content = plan.pages.filter((page) => !page.kind || page.kind === "content");
  const entropy = memo ? styleEntropy(content, (page) => { if (!memo.shapes.has(page)) memo.shapes.set(page, architecture(page)); return memo.shapes.get(page); }) : styleEntropy(content);
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
 * for a page with no known type. `units`, the units the page's declared
 * measures are in (page-types.mjs declaredUnits), leave out a form that
 * cannot set them: a trellis of two units.
 */
export function freeChoices(page, fitted = null, closing = false, { units = null } = {}) {
  const type = page && typeof page === "object" ? PAGE_TYPES[page.type] : null;
  if (!type) return [];
  const forms = Object.hasOwn(type.forms, page.form ?? "") ? [page.form] : fitted?.length ? fitted : openForms(page.type, closing);
  // A placement the page declares is kept on every form that compiles with it.
  return forms.flatMap((form) => { const placements = placementsOf(page.type, form, { units });
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
 * choice changed to mend a rule, with what it `was` and `why`: the rules the
 * change lowered, movedRules). A rule the spine hears as an advisory
 * (SPINE_ADVISORY) is never in `unsatisfied` and never makes a plan
 * unsatisfied: left unmet it is in `advisory`, where VARIETY_EXHIBIT_RANGE
 * carries the kinds the allocation `drawn` and the changes that would add one
 * (`adders`), each checked against its page's evidence (heldChanges; `fills`
 * is the caller's check, and those it refuses are `refused`).
 */
// The most changes the plan names that would add a kind of exhibit the deck does not draw (VARIETY_EXHIBIT_RANGE).
const KIND_ADDERS = 12;
// The rules the spine hears as advisories: read and reported at --plan and --draft, held at the full compile. The kinds floor is
// a layout rule - the writers' exhibits settle it - and on the BA retest it held a spine a floor only written pages could reach:
// the draft counted 28 kinds with 64 pages not drawn yet, the plan 33 with its own changes, against 38; the plan would not write
// while it was short, and four batches of type changes (twelve minutes) ran before the storyline critique could stage.
export const SPINE_ADVISORY = Object.freeze(new Set(["VARIETY_EXHIBIT_RANGE"]));

// The kinds that encode a value as a length or an area filled from zero: a bar, a column, an area, a share of a whole.
const FILLED = new Set(["chart.bar", "chart.column", "chart.stacked-bar", "chart.stacked-column", "chart.area", "chart.stacked-area", "chart.lollipop",
  "chart.waterfall", "chart.bullet", "chart.marimekko", "chart.waffle", "chart.donut", "chart.pie", "chart.treemap", "chart.combo", "aligned-bars", "radial-bars", "pictogram"]);
// The kinds that fill the span between one period and the next, so draw a value in every period they cross.
const AREAS = new Set(["chart.area", "chart.stacked-area"]);
// The kinds that add their series into one whole.
const STACKS = new Set(["chart.stacked-area", "chart.stacked-column", "chart.stacked-bar", "chart.marimekko"]);

/** The measures a page draws: those its claim names, else every measure of the insights it rests on. */
function pageMeasures(page, registry) {
  const named = (Array.isArray(page?.settles?.measures) ? page.settles.measures : []).map((ref) => registry.get(String(ref))).filter(Boolean);
  if (named.length) return named;
  const owners = new Set((Array.isArray(page?.evidence) ? page.evidence : []).map(String));
  return [...registry.values()].filter((measure) => owners.has(String(measure.owner)));
}

/**
 * Why drawing a page's measures as `kinds` would show them less truthfully
 * than they are recorded, or null: a rank (its unit) as a length or an area
 * from zero, where a rise in rank draws as a fall; a stack of series in two
 * units, which have no total; a filled area across
 * periods the record skips (uneven periods, or a value missing), which draws
 * values in years the series does not have; a single area over a change
 * small beside its distance from zero, filled from a floor or flattened.
 * Read from the recorded periods,
 * values and unit, never from the words. On the BA retest a variety fix moved
 * lc04 from a line to a stacked area that joined 2019 to 2022 across 2020-21,
 * drawing about 70m Heathrow passengers in years it carried 20m, and the
 * deck review blocked it; pr06 and pr07 drew ranks as bars and areas, and
 * hw01 and sh01 areas from a floor. A form the plan offers - a free choice, a
 * change to mend a rule, a suggestion to add a kind - never draws its series
 * so: the page keeps the form that draws it as recorded.
 */
export function seriesHidden(kinds, measures) {
  const filled = kinds.filter((kind) => FILLED.has(kind)), areas = kinds.filter((kind) => AREAS.has(kind));
  if (!filled.length) return null;
  // A stack sums its series into one total: series in two units have none (na04's passengers and Heathrow's share, on the BA copy).
  const stacked = kinds.find((kind) => STACKS.has(kind)), units = [...new Set(measures.map((measure) => normalUnit(measure.unit)).filter(Boolean))];
  if (stacked && units.length > 1) return `${stacked} sums its series into one total, and ${measures.map((measure) => measure.ref).slice(0, 3).join(", ")} are in ${units.join(" and ")}, which do not add up (a combo or panels draw them)`;
  for (const measure of measures) {
    if (normalUnit(measure.unit) === "rank") return `${measure.ref} is a rank, where 1 leads: ${filled[0]} draws a rise in rank as a fall (a line on an inverted axis, a dot or a table draws it)`;
    const axis = axisOf(measure);
    if (!areas.length || axis.kind !== "periods") continue;
    const values = valuesOf(measure), times = periodTimes(axis.labels);
    if (values.some((value) => value === null || value === undefined) || (times && Math.max(...times.gaps) - Math.min(...times.gaps) > 0.01))
      return `${measure.ref} skips periods (${describeGaps(axis.labels) || "a value is missing"} apart): ${areas[0]} fills across them, drawing values in periods the record does not have (a line with its points marked draws it)`;
    const numbers = values.filter(Number.isFinite), low = numbers.length > 1 ? Math.min(...numbers) : 0, high = numbers.length > 1 ? Math.max(...numbers) : 0;
    // Its change small beside its distance from zero (sh01's low-cost share, 30% to 35%): an area from zero draws it flat, and
    // one from a floor draws it several times its size. Where the change is visible from zero (hw01's fuel, 1.9 to 3.9), it holds.
    if (areas.includes("chart.area") && low > 0 && high - low < low / 2)
      return `${measure.ref} runs from ${low} to ${high}, a change small beside its distance from zero: an area filled from zero flattens it and one filled from a floor overstates it (a line draws it)`;
  }
  return null;
}

/**
 * The forms that would draw a page in a kind the deck does not draw (`drawn`):
 * another form of its type, or a form of a type its evidence's shapes rest
 * under (TYPE_SHAPES), each as the page would be drawn once redrawn - its own
 * exhibits set aside, so the kind is the form's, or the estimate from its
 * evidence where the form leaves it open. A kind no other page draws
 * (`alone`) is lost when its page is redrawn: a change is listed only where it
 * adds more than it loses. (Taking two such changes on the BA copy, a steps
 * page as a framework and labelled rows as capsules, left the count where it
 * was.)
 */
function kindChanges(page, index, { form, commentary, exhibitType, players, shapes, drawn, alone = [] }) {
  const redrawn = (type, to) => { const placements = placementsOf(type, to);
    return declaredSlide({ ...page, type, form: to, commentary: placements.includes(commentary) ? commentary : placements[0], exhibit: undefined, exhibits: undefined }, index, { exhibitType, players }); };
  const types = [page.type, ...Object.keys(TYPE_SHAPES).filter((type) => type !== page.type && TYPE_SHAPES[type].some((shape) => shapes.has(shape)))];
  const found = [];
  for (const type of types) for (const to of Object.keys(PAGE_TYPES[type].forms)) {
    if (type === page.type && to === form) continue;
    const slide = redrawn(type, to), kinds = new Set(slide ? exhibitKinds(slide) : []), adds = [...kinds].filter((kind) => !drawn.has(kind)), loses = alone.filter((kind) => !kinds.has(kind));
    if (adds.length > loses.length) found.push({ change: type === page.type ? "form" : "type", ...(type === page.type ? {} : { from: page.type }), type, form: to, adds, ...(loses.length ? { loses } : {}), slide });
  }
  return found;
}

/**
 * Of the changes `found` (in the order they are offered), those that hold:
 * each is read against its page's evidence - the series it would draw
 * (seriesHidden), then `fills(page, type, form)`, the caller's check that the
 * evidence fills the form the way `--scaffold <type>/<form> --evidence` binds
 * it (author-deck.mjs) - lazily, in order, so only as many are checked as are
 * offered. One change for each kind first, two a page at most, so the list
 * spans the kinds and pages there are; then the rest in order, `most` in all.
 * On the BA retest the plan suggested a sankey for three single values, a
 * bubble for a measure pair, a waterfall with no bridge, and pie, marimekko,
 * small multiples and arrow rows its sections then refused: four sections
 * each spent a draft round or two finding out. Returns `{ offered, refused }`.
 */
function heldChanges(found, { registry, fills = null, most = KIND_ADDERS }) {
  const verdicts = new Map();
  const refusal = (item) => {
    // What the page would draw: its exhibits' kinds, and the form's own (aligned bars draw as a group of charts).
    const kinds = [...exhibitKinds(item.slide ?? {}), String(PAGE_TYPES[item.type]?.forms?.[item.form] ?? "")];
    if (!verdicts.has(item)) verdicts.set(item, seriesHidden(kinds, pageMeasures(item.page, registry)) ?? fills?.(item.page, item.type, item.form) ?? null);
    return verdicts.get(item);
  };
  const seen = new Set(), each = new Map(), picked = new Set();
  for (const item of found) {
    if (picked.size >= most) break;
    if (seen.has(item.adds[0]) || (each.get(item.id) ?? 0) >= 2 || refusal(item)) continue;
    seen.add(item.adds[0]); each.set(item.id, (each.get(item.id) ?? 0) + 1); picked.add(item);
  }
  // Then a kind no change has added yet (one held back by its page's two), then the rest.
  const fresh = found.filter((item) => !seen.has(item.adds[0]));
  for (const item of [...fresh, ...found]) { if (picked.size >= most) break; if (!picked.has(item) && !refusal(item)) picked.add(item); }
  return { offered: found.filter((item) => picked.has(item)), refused: found.filter((item) => verdicts.get(item)).map((item) => ({ item, why: verdicts.get(item) })) };
}
// A rule the page types alone break cannot be met by any form or placement.
const TYPE_RULES = new Set(["VARIETY_TYPE_SHARE", "VARIETY_TYPE_RANGE", "VARIETY_TYPE_RUN", "PAGE_TYPE_UNDECLARED"]);
const brokenStandings = (current) => current.standings.filter((standing) => standing.blocks && ["over", "short"].includes(standingRoom(standing).state));
// Whether a broken rule is one a form or a placement can mend: while only the types break rules, widening the search
// to declared pages or pairs of changes reads the structure tens of thousands of times for nothing.
const mendable = (current) => brokenStandings(current).some((standing) => !TYPE_RULES.has(standing.code))
  || current.findings.some((f) => isBlocking(f) && classOf(f.code) === "S" && !TYPE_RULES.has(f.code));
/**
 * The rules one step of the search moved, read off the deck's structure
 * before and after it: `mends` the broken rules it lowered (fewer blocking
 * findings, or less room lacking), `room` the rules it only gave room under
 * (a standing off its bar, a cap with a page fewer). On the BA retest the plan
 * printed "changed (declared insight-tree/none)" with no rule, beside its own
 * "a form you declare on a page is kept": the change is said with what it was
 * made for.
 */
function movedRules(before, after) {
  const key = (standing) => `${standing.code}.${standing.key ?? ""}`;
  const was = new Map(before.standings.filter((standing) => standing.blocks).map((standing) => [key(standing), standingRoom(standing)]));
  const mends = new Set(), room = new Set();
  for (const standing of after.standings.filter((s) => s.blocks)) {
    const then = was.get(key(standing)), now = standingRoom(standing);
    if (then && now.margin > then.margin + 1e-9) (["over", "short"].includes(then.state) ? mends : room).add(standing.code);
  }
  const tally = (findings) => findings.filter((f) => isBlocking(f) && classOf(f.code) === "S").reduce((counts, f) => counts.set(f.code, (counts.get(f.code) ?? 0) + 1), new Map());
  const had = tally(before.findings), has = tally(after.findings);
  for (const [code, count] of had) if ((has.get(code) ?? 0) < count) mends.add(code);
  return { mends: [...mends], room: [...room].filter((code) => !mends.has(code)) };
}

export function allocateStructure(doc, { insights = null, planOf, compiled = null, blocksOf = null, sourceKinds = null, forms = "best", fills = null, maxSteps = 40, maxEvaluations = 40000 } = {}) {
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
    // A form the plan gives a page - free, or to mend a rule - draws its series as recorded (seriesHidden): one that draws a rank
    // as a fall, or fills across periods the record skips, is never offered. A form the page declares is the author's, and kept,
    // as is a revision's drawing of its source slide; where none of the forms that carry the claim best is truthful, they stand.
    const measures = registry.size ? pageMeasures(page, registry) : [];
    const truthful = (form) => form === page.form || asSource.length > 0 || !seriesHidden([String(type.forms[form])], measures);
    const plain = given.filter(truthful);
    const units = declaredUnits(page, registry), options = freeChoices(page, plain.length ? plain : given, false, { units });
    const declared = formDeclared && placementsOf(page.type, page.form, { units }).includes(page.commentary);
    // Every choice the plan may take to mend a broken rule when the free ones cannot. A page whose fit is read never leaves the
    // forms that carry its claim best - a rule those cannot meet is reported unmet, not met with a weaker picture - and a
    // declared form whose fit is read is changed only for one that carries the claim at least as directly.
    // (`forms: "any"` asks the other question - whether any allocation the catalogue allows meets the rules - and lifts both.)
    const mendable = asSource.length ? given : forms === "any" ? Object.keys(type.forms) : best.length ? given : formDeclared && fit?.chosen ? Object.keys(type.forms).filter((form) => gradeIn(form) >= fit.chosen.grade) : Object.keys(type.forms);
    // A summary's form is its place (openForms), not the layout's: no rule turns a closing list into a second answer.
    // A form that cannot hold the exhibits the page carries - those it has written, or as many as its declared form draws at
    // least - is no mend for it: a row of two panels is not a trellis of one, and the change would be refused at the compile.
    const drawnCount = [page.exhibit, ...(Array.isArray(page.exhibits) ? page.exhibits : [])].filter((ex) => ex && typeof ex === "object").length;
    const carried = drawnCount || (formDeclared ? exhibitRange(page.type, page.form)[0] : 0);
    const holds = (form) => { const [lo, hi] = exhibitRange(page.type, form); return !carried || (carried >= lo && carried <= hi); };
    const wider = page.type === "summary" ? [] : mendable.filter(holds).filter(truthful).flatMap((form) => placementsOf(page.type, form, { units }).map((commentary) => ({ form, commentary })));
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
  // The search reads the deck tens of thousands of times with one page swapped: each page object's reads are kept for the search.
  const memo = { structures: new WeakMap(), tables: new WeakMap(), records: new WeakMap(), reads: new WeakMap(), shapes: new WeakMap(), architectures: new WeakMap(),
    families: new WeakMap(), kinds: new WeakMap(), marks: new WeakMap(), players: new WeakMap() };
  const architectureOf = (slide) => { if (!memo.architectures.has(slide)) memo.architectures.set(slide, declaredArchitecture(slide)); return memo.architectures.get(slide); };
  // `weighing`: a candidate the search only weighs (structureCost), read for its standings and structure blockers alone.
  const evaluate = (override = null, weighing = false) => {
    evaluations += 1;
    const spec = specOf(override), slides = spec.slides, appendix = spec.appendix ?? [];
    const declared = declaredStructure(spec, { planOf, memo, weighing });
    const shape = shapeStructure([...slides, ...appendix].filter((slide) => slide.pageType).map((slide) => ({ id: slide.id, architecture: architectureOf(slide) })),
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
  const weigh = (override) => structureCost(evaluate(override, true));
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
    const weighed = entry.options.map((choice) => ({ choice, cost: weigh({ entry, choice }),
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
    // And such a change is taken only where it lowers what the broken rules lack. Weighed on the whole cost, it was taken for
    // room alone: on the BA retest 32 of the 33 declared choices the plan changed, while a rule no declared choice could meet was
    // short, only took a cap or a floor off its bar (movedRules: "room"), against the plan's own "a form you declare is kept".
    const mends = (c) => c.blockers < cost.blockers || (c.blockers === cost.blockers && c.lacking < cost.lacking - 1e-9);
    for (const [pool, choices, free] of [[open, "options", true], ...(broken ? [[open.filter((e) => !e.formDeclared), "wider", false], [typed.filter((e) => (e.declared || e.formDeclared) && !e.imported), "wider", false]] : [])]) {
      singles: for (const entry of pool) for (const choice of sameFormFirst(entry, entry[choices])) {
        // The budget holds inside a pass as between passes: a wide deck's widened pool is thousands of whole-deck evaluations.
        if (evaluations >= maxEvaluations) break singles;
        if (choice.form === entry.choice.form && choice.commentary === entry.choice.commentary) continue;
        // A form chosen among equals by the spread and the draw is changed to mend a broken rule, never for room alone:
        // room is made with placements, or the seed's choices would be undone wherever a rule sat at its bar.
        if (!broken && entry.fitted && choice.form !== entry.choice.form) continue;
        const next = weigh({ entry, choice });
        if (free ? cheaper(next, best?.cost ?? cost) : mends(next) && cheaper(held(next), held(best?.cost ?? cost))) best = { entry, choice, cost: next };
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
        const moved = weigh({ entry, choice });
        if (moved.blockers > cost.blockers || moved.lacking > cost.lacking + 1e-9 || evaluations >= maxEvaluations) continue;
        const kept = entry.choice;
        entry.choice = choice;
        seconds: for (const other of open) for (const next of sameFormFirst(other, other.options)) {
          if (evaluations >= maxEvaluations) break seconds;
          if (other === entry || (next.form === other.choice.form && next.commentary === other.choice.commentary)) continue;
          const after = weigh({ entry: other, choice: next });
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
    const was = current;
    current = evaluate();
    cost = structureCost(current);
    // What the step was taken for, kept on each page it moved: a declared choice changed is printed with the rule it lowered.
    const why = movedRules(was, current);
    for (const entry of [best.entry, ...(best.first ? [best.first.entry] : [])]) for (const [kind, codes] of Object.entries(why)) codes.forEach((code) => (entry.why ??= { mends: new Set(), room: new Set() })[kind].add(code));
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
  const pinned = unsatisfied.some((item) => !SPINE_ADVISORY.has(item.code)) ? typed.filter((entry) => entry.held && !entry.imported).map((entry) => ({ id: entry.page.id ?? `page-${entry.index + 1}`, forms: entry.held })) : [];
  // The deck's exhibits by kind under the allocation, and the pages whose form leaves fit unused (gates/variety_gates.mjs fitStandings): read once, on the result.
  const final = specOf();
  const spread = fitStandings(final, { fits: fitsOf(final, insights), kept: keptAsSource(final, sourceKinds), carried: carriedKinds(all.map(({ page }) => page).filter((page) => page?.carry === true), sourceKinds) });
  current.standings.push(...spread.standings);
  // Where the deck draws too few kinds of exhibit (VARIETY_EXHIBIT_RANGE), the kinds it draws and the changes that would add one
  // it does not: on a page, another form of its type, or a form of another type its evidence's shapes rest under (TYPE_SHAPES),
  // whose exhibit is of a kind not drawn - the families the deck draws least first, one change for each kind before a second.
  // On the BA retest the plan said "short by 1 kinds" and named neither, and the lead found five kinds by trial in 23 minutes
  // and 12 runs, scaffolding a dozen forms that were mostly refused on shape. Each is now checked against its page's evidence
  // before it is offered; the plan makes none of them, since each draws the page in a form its claim did not choose.
  const kindAdders = () => {
    const ranged = current.findings.find((f) => f.code === "VARIETY_EXHIBIT_RANGE");
    const drawn = new Set(ranged?.measured?.kinds ?? exhibitMix([...final.slides, ...(final.appendix ?? [])]).kinds);
    // A kind is counted in its exhibit's family, and a page that draws no exhibit (its kind is its type and form) in its page's.
    const familyOf = (kind, slide) => (kind.includes("/") ? pageFamily(slide) : exhibitFamily(kind));
    const families = new Map(), drawers = new Map();
    for (const entry of typed) { const slide = slideOf(entry, entry.choice); for (const kind of slide ? exhibitKinds(slide) : []) families.set(familyOf(kind, slide), (families.get(familyOf(kind, slide)) ?? 0) + 1);
      for (const kind of new Set(slide ? exhibitKinds(slide) : [])) drawers.set(kind, (drawers.get(kind) ?? 0) + 1); }
    const found = [];
    for (const entry of typed.filter((e) => !e.imported && e.page.type !== "summary")) {
      const id = String(entry.page.id ?? `page-${entry.index + 1}`);
      const own = slideOf(entry, entry.choice), alone = [...new Set(own ? exhibitKinds(own) : [])].filter((kind) => drawers.get(kind) === 1);
      for (const { slide, ...item } of kindChanges(entry.page, entry.index, { form: entry.choice.form, commentary: entry.choice.commentary, exhibitType: entry.exhibitType,
        players: doc.deck?.players, shapes: new Set(shapesOf(entry)), drawn, alone })) found.push({ id, ...item, family: familyOf(item.adds[0], slide), at: entry.index, slide, page: entry.page });
    }
    const load = (item) => families.get(item.family) ?? 0;
    found.sort((a, b) => load(a) - load(b) || a.family.localeCompare(b.family) || a.adds[0].localeCompare(b.adds[0]) || (a.change === "form" ? 0 : 1) - (b.change === "form" ? 0 : 1) || a.at - b.at);
    // Each checked against its page's evidence before it is offered (heldChanges): those it does not hold are said apart.
    const { offered, refused } = heldChanges(found, { registry, fills });
    const bare = ({ at: _at, slide: _slide, page: _page, ...item }) => item;
    return { drawn: [...drawn].sort(), adders: offered.map((item) => ({ ...bare(item), drawn: families.get(item.family) ?? 0 })),
      ...(refused.length ? { refused: refused.map(({ item, why }) => ({ id: item.id, type: item.type, form: item.form, why })) } : {}) };
  };
  // A rule the spine hears as an advisory (SPINE_ADVISORY) is reported, never held against the allocation: what the plan meets
  // is written, and the writers' exhibits settle the rest before the full compile holds it.
  const held = unsatisfied.filter((item) => !SPINE_ADVISORY.has(item.code)), advised = unsatisfied.filter((item) => SPINE_ADVISORY.has(item.code));
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
      ...((entry.declared && changed(entry)) || formChanged(entry) ? { was: { form: entry.page.form, ...(entry.declared ? { commentary: entry.page.commentary } : {}) },
        // The rules the steps that moved it lowered: those it mends, else those it only gives room under.
        ...(entry.why ? { why: { mends: [...entry.why.mends], room: [...entry.why.room].filter((code) => !entry.why.mends.has(code)) } } : {}) } : {}) })),
    structure: current, declared: before, satisfied: !held.length, unsatisfied: held,
    advisory: advised.map((item) => (item.code === "VARIETY_EXHIBIT_RANGE" ? { ...item, ...kindAdders() } : item)), pinned, steps, evaluations, capped: capped && !!(cost.blockers || cost.lacking),
  };
}

/**
 * Each capped quota of the deck as one section's room in it, for its brief
 * (author-deck.mjs --brief skeleton|writer --section): the deck's cap in
 * pages over its content pages as the pages file holds them, the pages the
 * other sections already hold, the section's own, and what is left to it.
 * The pages are read as the plan reads them - compiled where they compile
 * (`compiled`), else from their declared choices with their exhibits
 * estimated from their evidence - and counted as the gates count them
 * (gates/variety_gates.mjs): the numbers family, the type of each page, the
 * points under an exhibit, the closes (a takeaway or a so-what bar), the
 * single exhibits beside a text column. And the kinds of exhibit: the floor,
 * those the other sections draw, the section's own, and the changes on its
 * pages that would add a kind the deck does not draw, each checked against
 * its page's evidence (heldChanges, with the caller's `fills`).
 *
 * On the BA retest fourteen skeleton agents each saw the deck's caps only as
 * a provisional advisory on their own draft: 84 pages came back with 21
 * numbers pages (25%, cap 10%) and 24 panels pages (29%, cap 25%), 2a alone
 * wrote four numbers pages of six, and four batches of type changes went
 * back to the sections; after the writers, each met VARIETY_COMMENTARY,
 * VARIETY_TAKEAWAY and VARIETY_COLUMN as unclearable on its own pages, since
 * one section's fix tipped another's cap. `mine` is the section's page ids.
 */
export function sectionQuotas(doc, { insights = null, compiled = null, mine, fills = null }) {
  const registry = registryOf(insights), featured = drawOf(doc.deck);
  const all = [...(doc.pages || []), ...(doc.appendix || [])].filter((page) => page && typeof page === "object" && !page.include && page.carry !== true);
  const content = all.map((page, index) => ({ page, index, id: String(page.id ?? `page-${index + 1}`) })).filter(({ page }) => !page.kind || page.kind === "content");
  const drawn = content.filter(({ page }) => PAGE_TYPES[page.type]).map((item) => ({ ...item,
    slide: compiled?.get?.(item.id) ?? declaredSlide(item.page, item.index, { exhibitType: evidenceExhibits(item.page, insights, featured), players: doc.deck?.players, stubs: stubsOf(item.page, insights) }) }))
    .filter((item) => item.slide);
  const n = content.length, ids = (test) => drawn.filter(test).map((item) => item.id);
  const quota = (code, key, what, share, held, of = n) => {
    const cap = Math.floor(share * of + 1e-9), others = held.filter((id) => !mine.has(id)), own = held.filter((id) => mine.has(id));
    return { code, ...(key ? { key } : {}), what, share, of, cap, others, own, room: cap - others.length };
  };
  const placement = (slide) => (slide.pageType?.commentary === "beside-left" ? "beside" : slide.pageType?.commentary);
  // A type is shown where the section draws it or where it is the deck's commonest: the rest have room to spare.
  const types = [...new Set(drawn.map((item) => item.page.type))].map((type) => [type, ids((item) => item.page.type === type)]).sort((a, b) => b[1].length - a[1].length);
  const shownTypes = types.filter(([, held], at) => at === 0 || held.some((id) => mine.has(id)));
  const columns = structureMix(drawn.map((item) => item.slide), { drawnOf });
  const quotas = [
    quota("VARIETY_EXHIBIT_MIX", "numbers", "pages carried by numbers or cards", PLAN.mix.numbers.max, ids((item) => pageFamily(item.slide) === "numbers")),
    ...shownTypes.map(([type, held]) => quota("VARIETY_TYPE_SHARE", type, `${type} pages`, VARIETY.typeShareMax, held)),
    quota("VARIETY_COMMENTARY", "below", "pages with points under the exhibit", VARIETY.belowShareMax, ids((item) => placement(item.slide) === "below")),
    quota("VARIETY_TAKEAWAY", null, "pages closing on a takeaway line or a so-what bar", VARIETY.takeawayShareMax, ids((item) => item.slide.pageType?.takeaway || item.slide.pageType?.commentary === "so-what-bar")),
    quota("VARIETY_COLUMN", null, "pages of one exhibit beside a text column", VARIETY.columnShareMax, columns.column.ids.map(String), columns.pages),
  ];
  // The kinds: a floor the deck's length sets, those the other sections draw, the section's own, and what its pages could add.
  const kindsOf = (items) => new Set(items.flatMap((item) => exhibitKinds(item.slide)));
  const others = kindsOf(drawn.filter((item) => !mine.has(item.id))), own = kindsOf(drawn.filter((item) => mine.has(item.id)));
  const deck = new Set([...others, ...own]);
  const found = drawn.filter((item) => mine.has(item.id) && item.page.type !== "summary").flatMap((item) => {
    const shapes = new Set((Array.isArray(item.page.evidence) ? item.page.evidence : []).map((id) => insights?.get?.(id)?.shape).filter(Boolean));
    return kindChanges(item.page, item.index, { form: item.slide.pageType?.form ?? item.page.form, commentary: item.slide.pageType?.commentary ?? item.page.commentary,
      exhibitType: evidenceExhibits(item.page, insights, featured), players: doc.deck?.players, shapes, drawn: deck }).map((change) => ({ id: item.id, ...change, page: item.page }));
  });
  const { offered, refused } = heldChanges(found, { registry, fills, most: 8 });
  return { pages: n, quotas, kinds: { floor: Math.ceil((PLAN.craft.exhibitVarietyPerTen.min * n) / 10 - 1e-9), perTen: PLAN.craft.exhibitVarietyPerTen.min,
    deck: deck.size, others: [...others].sort(), own: [...own].sort(), only: [...own].filter((kind) => !others.has(kind)).sort(),
    adds: offered.map(({ slide: _slide, page: _page, ...item }) => item), refused: refused.length } };
}
