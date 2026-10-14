// What each page's claim and exhibits rest on, checked as data.
//
// A page names the insights it rests on (`evidence`), and until now that was
// the whole dependency: a list of ids on the page. Nothing said which measure
// the claim is about or which measure each exhibit plots, so an exhibit copied
// from another page - a chart of one measure under a title about another, its id
// appended to `evidence`, the citation left as it was - passed every check
// that reads the page's structure. With measures in the insight log
// (measures.mjs) the dependency is declared and checked:
//
//   "settles": { "kind": "comparison", "what": "...", "measures": ["i-results/ocf", "i-results/pat"],
//                "relation": { "kind": "gap" } },
//   "exhibit": { "type": "chart.line", ..., "basis": { "measures": ["i-results/ocf"], "role": "proof" } },
//   "metrics": [{ "value": "-21.6%", "label": "Operating cash flow", "basis": { "measures": ["A-ocf/percent"] } }]
//
// - `settles.measures` are the measures the claim is about.
// - `basis` on an exhibit (or a metric) names the measures it plots and its
//   `role`: "proof" of the claim (the default), or "context" beside it, with
//   the `relevance` a reviewer judges. One exhibit can show a measure of the
//   claim and a measure that is context for it: `basis.roles` gives a measure
//   its own role and relevance - `{ "<ref>": { role: "context", relevance } }`
//   - and the basis's `role` is the default for the rest. A bound series says
//   it on the series (`{ measure, role, relevance }`, bind.mjs). Every rule on
//   roles below reads them measure by measure (roleFor).
// - the exhibit's unit, its periods or members and its plotted numbers are
//   held to the measures it names; a proof exhibit plots a measure of the
//   claim (or one computed from it, or one it is computed from); a page with
//   numbers on it has something that proves its claim; and the citation covers
//   the sources of what the page plots.
//
// The relation the claim asserts between two measures is declared too
// (`settles.relation`), so two same-unit measures a reader has to compare are
// not left in separate panels for the reader to subtract.
//
// An exhibit or a metric may name its measure and leave the numbers to the
// runtime, and any text may print a recorded number through a `{{...}}` token
// (bind.mjs). What the runtime wrote is not checked against the record a
// second time; what the author still typed is: a typed exhibit and a typed
// metric as above, and every number typed into the page's text is traced to a
// value of a measure the page rests on, or reported.
//
// Everything here reads declared fields and numbers. No title is parsed for
// its claim.
import { cellText, isTable, plottedValues, rowCells, tileKey } from "../evidence.mjs";
import { axisOf, isRatioUnit, measureRegistry, normalUnit, parseRef, valuesOf } from "../measures.mjs";
import { BINDING_CODES, bindDeck, readFormat, renderValue, withoutTokens } from "../bind.mjs";
import { matches, measurementsIn, percentUnit, printedNumbers, states } from "../printed-numbers.mjs";
import { registered } from "../errors.mjs";
import { kindOfForm } from "../claim-fit.mjs";

export const DEPENDENCY_CODES = Object.freeze({
  CLAIM_MEASURES_MISSING: "a page with numbers on it does not say which measures its claim is about",
  BASIS_MISSING: "an exhibit that plots numbers names no measure it plots",
  BASIS_UNKNOWN: "a `basis` or `settles.measures` names a measure the insight log does not hold, or one from an insight the page does not rest on; or a `basis` gives a role or a class (`as`) that is not one",
  BASIS_UNIT: "an exhibit's unit is not the unit of any measure it says it plots",
  BASIS_AXIS: "an exhibit's periods or members - drawn, or declared in its `basis` for a spine - are not those of the measure it says it shows",
  BASIS_VALUES: "an exhibit's plotted numbers are not the values of the measure it says it plots",
  PROOF_OFF_CLAIM: "an exhibit offered as proof plots no measure of the page's claim",
  PROOF_MISSING: "a page whose exhibits are all context: nothing on it proves the claim",
  CONTEXT_UNEXPLAINED: "a context exhibit that does not say why it is on the page",
  SOURCE_UNCITED: "the page's citation leaves out a source the measures it shows are cited to, or is typed where it can be derived",
  RELATION_UNDECLARED: "two measures of the claim in one unit sit in separate exhibits and the page does not say what the reader is to read between them",
  RELATION_SPLIT: "the claim asserts a relation between two measures and no exhibit shows them on one basis",
});

// What a page's figures say against the record itself, read off the references and the recorded values alone - no judge,
// no words: two tiles that print one recorded measure, a format that prints decimals no recorded value carries, and a page
// resting on insights the answer critique names together as a comparison the log cannot support.
export const RECORD_CODES = Object.freeze({
  TILES_SAME_MEASURE: "two tiles of one page print one recorded measure at two periods or for two members",
  PRECISION_UNRECORDED: "a token or a bound figure prints more decimal places than any recorded value of its measure carries",
  COMPARISON_UNSUPPORTED: "a page draws on two or more insights the answer critique names together as a comparison the insight log cannot support",
});

/** The relations a claim can assert between its measures, and what shows each. */
export const RELATION_KINDS = Object.freeze({
  gap: "the difference between two measures in one unit: both on one scale, or the computed gap",
  ratio: "one measure over another: the computed ratio",
  levels: "which of several measures in one unit is larger, and by how much: all on one scale",
  index: "how measures in different units move against each other: the computed index",
  separate: "each measure is read on its own; the page says why they are not set on one scale (`reason`)",
});
const ROLES = ["proof", "context"];
const RELEVANCE_WORDS = 6;
const words = (text) => String(text ?? "").trim().split(/\s+/).filter(Boolean).length;

const exhibitsOf = (page) => [page.exhibit, ...(Array.isArray(page.exhibits) ? page.exhibits : []), ...(Array.isArray(page.blocks) ? page.blocks.map((block) => block?.exhibit) : [])].filter((ex) => ex && typeof ex === "object");
// Every figure a page prints as a number with its label: a strip's metrics, a hero's `kpi`, the metric at the right
// of a labelled row, and an item of a fact grid or a stat list that carries a `basis` of its own.
const itemsOf = (page) => exhibitsOf(page).flatMap((ex) => (Array.isArray(ex.items) ? ex.items : [])).filter((item) => item && typeof item === "object" && item.basis);
export const metricsOf = (page) => [...(Array.isArray(page.metrics) ? page.metrics : []), page.kpi, ...(Array.isArray(page.blocks) ? page.blocks.map((block) => block?.metric) : []), ...itemsOf(page)].filter((m) => m && typeof m === "object");
const nameOf = (ex, i) => (typeof ex.heading === "string" && ex.heading.trim() ? `"${ex.heading.trim()}"` : `exhibit ${i + 1}${ex.type ? ` (${ex.type})` : ""}`);
export const refsOf = (basis) => (Array.isArray(basis?.measures) ? basis.measures : typeof basis?.measure === "string" ? [basis.measure] : []).filter((ref) => typeof ref === "string");
/**
 * The role a `basis` gives one measure it names, with the relevance claimed
 * for it: the measure's own entry in `basis.roles` (an object, or the role
 * alone), otherwise the basis's `role` - proof where it states none - and its
 * `relevance`.
 */
export function roleFor(basis, ref) {
  const entry = basis?.roles && typeof basis.roles === "object" ? basis.roles[ref] : undefined;
  const own = typeof entry === "string" ? { role: entry } : entry && typeof entry === "object" ? entry : {};
  return { role: own.role ?? basis?.role ?? "proof", relevance: own.relevance ?? basis?.relevance };
}
/** The measures a basis names in `role`. */
const refsIn = (basis, role) => refsOf(basis).filter((ref) => roleFor(basis, ref).role === role);

// The view a `basis` declares for an exhibit or a figure the spine has not
// drawn yet: how the page will show each measure it names - the class in `as`,
// and which of its periods or members in `labels` (a list, a window
// `{ from, to }`, or one of either per measure, `{ "<ref>": ... }`) or in
// `members`. The storyline critique reads the declared view exactly as it
// reads a drawn exhibit showing it (storyline.mjs shownOf), so a page laid
// out to its declared view keeps the critique; a drawn exhibit is read as drawn.
export const VIEW_CLASSES = Object.freeze(["chart", "table", "figure"]);
const isWindow = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0 && Object.keys(value).every((key) => key === "from" || key === "to");
const perMeasure = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value) && !isWindow(value);
export const declaresView = (basis) => Boolean(basis) && typeof basis === "object" && (basis.as !== undefined || basis.labels !== undefined || basis.members !== undefined);
/** The periods or members of `axis` one declared list or window selects, in the axis's order; null where it selects none of them. */
function selectedLabels(value, axis) {
  if (Array.isArray(value)) { const wanted = new Set(value.map(String)); const on = axis.labels.filter((label) => wanted.has(label)); return on.length ? on : null; }
  if (!isWindow(value)) return null;
  const from = value.from === undefined ? 0 : axis.labels.indexOf(String(value.from)), to = value.to === undefined ? axis.labels.length - 1 : axis.labels.indexOf(String(value.to));
  return from < 0 || to < from ? null : axis.labels.slice(from, to + 1);
}
/** Every problem with the view a `basis` declares, as `{ code, text }`: a class that is not one, and periods or members no measure it names runs over. */
function declaredViewProblems(basis, registry) {
  if (!declaresView(basis)) return [];
  const problems = [];
  if (basis.as !== undefined && !VIEW_CLASSES.includes(basis.as)) problems.push({ code: "BASIS_UNKNOWN", text: `\`basis.as\` is ${JSON.stringify(basis.as)}; it says how the page will show the measure - ${VIEW_CLASSES.map((name) => `"${name}"`).join(", ")} (a metric or a hero figure is a "figure")` });
  const axes = refsOf(basis).filter((ref) => registry.has(ref)).map((ref) => [ref, axisOf(registry.get(ref))]);
  const check = (value, where, over) => {
    if (value === undefined) return;
    const wanted = Array.isArray(value) ? value.map(String) : isWindow(value) ? [value.from, value.to].filter((label) => label !== undefined).map(String) : null;
    if (!wanted) return void problems.push({ code: "BASIS_AXIS", text: `\`${where}\` is a list of periods or members, or a window { from, to }` });
    const off = wanted.filter((label) => !over.some(([, axis]) => axis.labels.includes(label)));
    if (off.length) problems.push({ code: "BASIS_AXIS", text: `\`${where}\` names ${off.join(", ")}, which ${over.map(([ref]) => ref).join(", ") || "no measure the basis names"} ${over.length === 1 ? "does" : "do"} not run over${over.length ? ` (${[...new Set(over.flatMap(([, axis]) => axis.labels))].slice(0, 12).join(", ")})` : ""}: declare the periods or members the page will show as the measure names them` });
  };
  if (perMeasure(basis.labels)) for (const [ref, value] of Object.entries(basis.labels)) {
    if (!refsOf(basis).includes(ref)) problems.push({ code: "BASIS_UNKNOWN", text: `\`basis.labels\` gives a view of ${ref}, which the basis does not name in \`measures\`` });
    else check(value, `basis.labels["${ref}"]`, axes.filter(([name]) => name === ref));
  } else check(basis.labels, "basis.labels", axes);
  check(basis.members, "basis.members", axes);
  return problems;
}

/** The measures a measure is computed from, through every analysis between: its lineage. */
function lineage(ref, registry, seen = new Set()) {
  for (const input of registry.get(ref)?.inputs || []) if (!seen.has(input)) { seen.add(input); lineage(input, registry, seen); }
  return seen;
}
/** Does plotting `shown` bear on `claimed`: the same measure, or one computed from the other. */
const bearsOn = (shown, claimed, registry) => shown === claimed || lineage(shown, registry).has(claimed) || lineage(claimed, registry).has(shown);

// How a measure's numbers are read: each on its own size - two significant figures of the value itself - and as a percentage where its unit is one (printed-numbers.mjs).
const readingOf = (measure) => ({ percent: percentUnit(measure.unit) });
// A series draws a measure when, at every category the exhibit plots that the
// measure has a number for, the series shows that number: one point of the
// claim's measure beside another chart is not the claim's measure drawn. A
// measure with no axis is drawn by a series that shows nothing else (a rule
// across the plot), not by a chance equal value.
function drawsMeasure(categories, values, measure) {
  const axis = axisOf(measure), recorded = valuesOf(measure);
  const reading = readingOf(measure);
  if (axis.kind === "scalar") { const shown = values.filter((v) => typeof v === "number"); return shown.length > 0 && shown.every((v) => matches(v, recorded[0], reading)); }
  const held = categories.map((label, i) => [axis.labels.indexOf(label), values[i]]).filter(([at]) => at >= 0 && recorded[at] !== null && recorded[at] !== undefined);
  return held.length > 0 && held.every(([at, value]) => typeof value === "number" && matches(value, recorded[at], reading));
}
const plotsMeasure = (plotted, measure) => plotted.series.some((s) => drawsMeasure(plotted.categories, s.values, measure));

/** The series an exhibit plots against its categories: [{ name, values }], or null where it plots no such thing. */
function plottedSeries(ex) {
  const categories = Array.isArray(ex.categories) ? ex.categories.map(String) : Array.isArray(ex.labels) ? ex.labels.map(String) : null;
  if (!categories) return null;
  if (Array.isArray(ex.series) && ex.series.every((s) => Array.isArray(s?.values))) return { categories, series: ex.series.map((s, i) => ({ name: s.name ?? `series ${i + 1}`, values: s.values })) };
  if (Array.isArray(ex.values) && ex.values.every((v) => v === null || typeof v === "number")) return { categories, series: [{ name: ex.heading ?? "values", values: ex.values }] };
  return null;
}

/** The first plotted number of a series that is not the measure's, or null when the series is the measure's. */
function strayValue(categories, values, measure) {
  const axis = axisOf(measure);
  const recorded = valuesOf(measure), reading = readingOf(measure);
  for (const [i, value] of values.entries()) {
    if (value === null || value === undefined) continue;
    if (typeof value !== "number") return { label: categories[i], value };
    const at = axis.kind === "scalar" ? 0 : axis.labels.indexOf(categories[i]);
    if (at < 0 || !matches(value, recorded[at], reading)) return { label: categories[i], value, recorded: at < 0 ? undefined : recorded[at] };
  }
  return null;
}

const statesMeasure = (number, measure) => valuesOf(measure).some((v) => states(number, v, { unit: measure.unit }));

function basisFindings(id, what, item, basis, { registry, evidence, plots, bound, typed = item }) {
  const out = [];
  const add = (code, repair, measured) => out.push({ code: registered(DEPENDENCY_CODES, code), id, severity: "blocker", ...(measured === undefined ? {} : { measured }), repair: `${id}: ${repair}` });
  if (basis.role !== undefined && !ROLES.includes(basis.role)) add("BASIS_UNKNOWN", `${what}'s \`basis.role\` is "proof" (it proves the claim; the default) or "context" (it sits beside the claim, with its \`relevance\`)`);
  // A measure's own role, where one exhibit shows the claim's measure and its context together.
  if (basis.roles !== undefined) {
    const entries = basis.roles && typeof basis.roles === "object" && !Array.isArray(basis.roles) ? Object.entries(basis.roles) : null;
    if (!entries) add("BASIS_UNKNOWN", `${what}'s \`basis.roles\` gives a measure its own role - { "<insight id>/<measure>": { role: "context", relevance: "..." } } - where it differs from the exhibit's \`role\``);
    for (const [ref, entry] of entries ?? []) {
      const role = typeof entry === "string" ? entry : entry?.role;
      if (!refsOf(basis).includes(ref)) add("BASIS_UNKNOWN", `${what}'s \`basis.roles\` gives a role to ${ref}, which the basis does not name in \`measures\``, [ref]);
      else if (!ROLES.includes(role)) add("BASIS_UNKNOWN", `${what}'s \`basis.roles["${ref}"]\` is { role, relevance }: the role is "proof" or "context", and a context measure says its \`relevance\``, [ref]);
    }
  }
  for (const problem of declaredViewProblems(basis, registry)) add(problem.code, `${what}: ${problem.text}`);
  const refs = refsOf(basis);
  const unknown = refs.filter((ref) => !registry.has(ref));
  if (unknown.length) add("BASIS_UNKNOWN", `${what} names ${unknown.join(", ")}, which the insight log's measures do not hold${unknown.some((ref) => !parseRef(ref)) ? " - a measure is named `<insight id>/<measure>`" : ""}`, unknown);
  const unrested = [...new Set(refs.filter((ref) => registry.has(ref)).map((ref) => registry.get(ref).owner))].filter((owner) => !evidence.includes(owner));
  if (unrested.length) add("BASIS_UNKNOWN", `${what} plots a measure of ${unrested.join(", ")}, which the page does not name in \`evidence\`: a page rests on the insights its exhibits are drawn from - name ${unrested.length === 1 ? "it" : "them"}, or plot what the page does rest on`, unrested);
  const measures = refs.map((ref) => registry.get(ref)).filter(Boolean);
  if (!measures.length) return out;
  // Each context measure says why it is on the page: the exhibit's `relevance` where the whole exhibit is context, the measure's own where one series of it is.
  const unexplained = refsIn(basis, "context").filter((ref) => words(roleFor(basis, ref).relevance) < RELEVANCE_WORDS);
  if (unexplained.length) add("CONTEXT_UNEXPLAINED", unexplained.length === refs.length
    ? `${what} is context, not proof of the claim: say in \`basis.relevance\` what it tells the reader about this claim (${RELEVANCE_WORDS} words or more); the reviewer judges it on that sentence`
    : `${what} shows ${unexplained.join(", ")} as context beside the claim's measure: say in the measure's own \`relevance\` - on its bound series, or in \`basis.roles["<ref>"].relevance\` - what it tells the reader about this claim (${RELEVANCE_WORDS} words or more); the reviewer judges it on that sentence`, unexplained);
  // What the runtime wrote from the measure is the measure's: its unit, axis and numbers are not read back against it.
  if (bound.filled.has(item)) return out;
  const tokened = bound.shown.get(item) ?? new Set();
  if (!plots) {
    // A metric states one number of the measure it names.
    // The first number a metric prints is the one it states; what follows it is commentary.
    const printed = tokened.size ? [] : printedNumbers(item.value).slice(0, 1);
    if (printed.length && !printed.some((number) => measures.some((m) => statesMeasure(number, m))))
      add("BASIS_VALUES", `${what} prints ${item.value}, and ${refs.join(", ")} record${measures.length === 1 ? "s" : ""} no such number (${measures.flatMap((m) => valuesOf(m)).filter((v) => v !== null).slice(-4).join(", ")}): print the recorded or computed value, or name the measure this is`, { printed: item.value, recorded: measures.flatMap((m) => valuesOf(m)).filter((v) => v !== null).slice(-4) });
    return out;
  }
  if (Array.isArray(item.rows)) {
    // A table shows every measure it names: a token prints it, or one of the cells the author typed states a number of it.
    // A number the runtime wrote for one measure is that measure's, and does not stand for another it happens to equal.
    const rows = Array.isArray(typed?.rows) ? typed.rows : item.rows;
    const cells = rows.flatMap((row) => (Array.isArray(row) ? row : Array.isArray(row?.cells) ? row.cells : [])).flatMap((cell) => { const text = typeof cell === "object" && cell ? cell.text ?? cell.value : cell; return printedNumbers(typeof text === "number" ? String(text) : withoutTokens(text)); });
    const unshown = measures.filter((m) => !tokened.has(m.ref) && !cells.some((number) => statesMeasure(number, m))).map((m) => m.ref);
    if (unshown.length) add("BASIS_VALUES", `${what} names ${unshown.join(", ")} and no cell of the table states a number of ${unshown.length === 1 ? "it" : "theirs"}: a basis lists the measures the exhibit shows, not ones it would like to be about`, { unshown });
  }
  // One scale, one unit: every measure a chart names is in the unit it is drawn in (a combo's second axis has its own).
  const drawnUnits = [item.unit, item.secondaryUnit].filter((unit) => typeof unit === "string" && unit.trim()).map(normalUnit);
  if (drawnUnits.length && !Array.isArray(item.rows) && measures.some((m) => !drawnUnits.includes(normalUnit(m.unit))))
    add("BASIS_UNIT", `${what} is drawn in ${item.unit}, and the measure${measures.length === 1 ? "" : "s"} it names ${measures.length === 1 ? "is" : "are"} in ${[...new Set(measures.map((m) => m.unit))].join(", ")} (${refs.join(", ")}): the exhibit plots something other than what it says it plots`, { exhibit: item.unit, measures: measures.map((m) => m.unit) });
  const plotted = plottedSeries(item);
  if (!plotted) return out;
  const axes = measures.map(axisOf).filter((axis) => axis.kind !== "scalar");
  const outside = axes.length ? plotted.categories.filter((label) => !axes.some((axis) => axis.labels.includes(label))) : [];
  if (outside.length) { add("BASIS_AXIS", `${what} plots ${outside.slice(0, 6).join(", ")}${outside.length > 6 ? ", ..." : ""}, which ${refs.join(", ")} ${measures.length === 1 ? "does" : "do"} not run over (${[...new Set(axes.flatMap((axis) => axis.labels))].slice(0, 12).join(", ")})`, outside); return out; }
  let strayed = false;
  for (const series of plotted.series) {
    const strays = measures.map((m) => strayValue(plotted.categories, series.values, m));
    if (strays.every(Boolean)) {
      strayed = true;
      const nearest = strays.reduce((a, b) => (b.recorded !== undefined && a.recorded === undefined ? b : a));
      add("BASIS_VALUES", `${what} plots ${series.name} = ${nearest.value} at ${nearest.label}, and ${refs.join(", ")} record${measures.length === 1 ? "s" : ""} ${nearest.recorded === undefined ? "no value there" : nearest.recorded}: the numbers drawn are not the measure's - plot the recorded values at the precision the exhibit prints, two significant figures or more, or name the measure these are`, { series: series.name, label: nearest.label, plotted: nearest.value, recorded: nearest.recorded ?? null });
    }
  }
  // Every measure the basis names is one the exhibit draws: a claim's measure
  // listed beside the one actually plotted would otherwise pass as its proof.
  const undrawn = measures.filter((m) => !plotsMeasure(plotted, m)).map((m) => m.ref);
  if (undrawn.length && !strayed) add("BASIS_VALUES", `${what} names ${undrawn.join(", ")} and no series shows ${undrawn.length === 1 ? "it" : "them"} at every category drawn: a basis lists the measures the exhibit plots - name only those, and plot the claim's measure where this exhibit is its proof`, { undrawn });
  return out;
}

/**
 * The citation keys a page's dependencies need: every `cite` key of the
 * measures it shows - the ones its exhibits and figures name in a `basis`,
 * and the ones bound into its text (`printed`) - and of the measures its
 * claim is about (`settles.measures`), each measure's own where it records
 * one, otherwise its insight's (measures.mjs measureRegistry; an analysis
 * carries its inputs'). A claim rests on the record of what it is about
 * whether or not the page draws it: a title that says orders outgrew revenue
 * over a chart of revenue alone still owes the reader the orders' source.
 * What is not asked is the rest of an insight - a measure the page neither
 * shows nor claims. Empty when those measures name no registry key.
 */
export function requiredCitations(page, registry, printed = []) {
  const refs = [...exhibitsOf(page).flatMap((ex) => refsOf(ex.basis)), ...metricsOf(page).flatMap((m) => refsOf(m.basis)), ...printed, ...(Array.isArray(page.settles?.measures) ? page.settles.measures : [])].filter((ref) => registry.has(ref));
  return [...new Set(refs.flatMap((ref) => registry.get(ref)?.cite || []))];
}

/** The pairs of the claim's measures a reader has to hold against each other across exhibits. */
function splitPairs(page, registry) {
  const proof = exhibitsOf(page).filter((ex) => ex.basis).map((ex) => refsIn(ex.basis, "proof").filter((ref) => registry.has(ref))).filter((refs) => refs.length);
  const claimed = (Array.isArray(page.settles?.measures) ? page.settles.measures : []).filter((ref) => registry.has(ref));
  const together = (a, b) => proof.some((refs) => (refs.includes(a) && refs.includes(b)) || refs.some((ref) => { const from = lineage(ref, registry); return from.has(a) && from.has(b); }));
  const pairs = [];
  for (const [i, a] of claimed.entries()) for (const b of claimed.slice(i + 1)) {
    const [x, y] = [registry.get(a), registry.get(b)];
    const shown = (ref) => proof.some((refs) => refs.includes(ref));
    if (!shown(a) || !shown(b) || together(a, b)) continue;
    const [ax, ay] = [axisOf(x), axisOf(y)];
    const shared = ax.kind === ay.kind && (ax.kind === "scalar" || ax.labels.some((label) => ay.labels.includes(label)));
    if (shared) pairs.push({ a, b, sameUnit: normalUnit(x.unit) === normalUnit(y.unit) });
  }
  return pairs;
}

function relationFindings(page, id, registry) {
  const relation = page.settles?.relation;
  const out = [];
  const add = (code, repair, measured) => out.push({ code: registered(DEPENDENCY_CODES, code), id, severity: "blocker", measured, repair: `${id}: ${repair}` });
  if (relation !== undefined && (!relation || typeof relation !== "object" || !Object.hasOwn(RELATION_KINDS, relation.kind))) {
    add("RELATION_UNDECLARED", `\`settles.relation.kind\` is one of ${Object.entries(RELATION_KINDS).map(([kind, about]) => `${kind} (${about})`).join("; ")}`);
    return out;
  }
  const pairs = splitPairs(page, registry);
  if (!pairs.length) return out;
  const named = pairs.map((p) => `${p.a} and ${p.b}`).join("; ");
  if (!relation) {
    const comparable = pairs.filter((p) => p.sameUnit);
    if (comparable.length) add("RELATION_UNDECLARED", `the claim is about ${comparable.map((p) => `${p.a} and ${p.b}`).join("; ")}, in one unit over the same ${axisOf(registry.get(comparable[0].a)).kind === "periods" ? "periods" : "members"}, drawn in separate exhibits. Say what the reader reads between them in \`settles.relation\` - ${Object.keys(RELATION_KINDS).join(", ")} - and draw that: a gap or levels on one scale (or the computed gap, analysis.mjs), "separate" with its \`reason\` where each is read alone`, comparable);
    return out;
  }
  if (relation.kind === "separate") {
    if (words(relation.reason) < RELEVANCE_WORDS) add("RELATION_SPLIT", `\`settles.relation\` says ${named} are read separately: say why they are not set on one scale in \`reason\` (${RELEVANCE_WORDS} words or more - exact lookup, units that do not compare, a prose-first page); the reviewer judges it on that sentence`, pairs);
    return out;
  }
  const split = relation.kind === "index" || relation.kind === "ratio" ? pairs : pairs.filter((p) => p.sameUnit);
  if (split.length) add("RELATION_SPLIT", `the claim asserts a ${relation.kind} between ${split.map((p) => `${p.a} and ${p.b}`).join("; ")}, and each is drawn in its own exhibit, so the reader computes the ${relation.kind} across panels. ${RELATION_KINDS[relation.kind][0].toUpperCase()}${RELATION_KINDS[relation.kind].slice(1)} (\`node runtime/author-deck.mjs <pages> --repair-relation ${id}\` prints the merged exhibit); where each really is read alone, declare kind "separate" with its \`reason\``, split);
  return out;
}

// Keys of a page that are not something it says to the reader about a number: what the page rests on and how it is
// built, and the names along an axis (a category, a column head, a series), which are labels whatever digits they hold.
export const NOT_PROSE = new Set(["id", "type", "form", "kind", "commentary", "why", "adds", "evidence", "settles", "source", "basis", "measure", "format", "select", "role", "relevance",
  "icon", "treatment", "variant", "arrangement", "placement", "tone", "categories", "labels", "columns", "category", "name", "unit", "secondaryUnit", "indexBase", "subject",
  "focusSeries", "forecastFrom", "from", "to", "at", "period", "alt", "src", "image", "photo", "player", "logo", "url", "key", "highlight", "series", "values"]);

/**
 * Every number typed on a page that states no value of `pool` (the measures
 * of the insights the page rests on): `[{ field, shown }]`. Tokens are taken
 * out first - the runtime wrote those - and so is a metric's `value` where its
 * `basis` already holds it to a measure.
 *
 * What is traced is a number written as a measurement: one with a decimal
 * point, a thousands separator, a sign, a currency, a percent sign, a scale
 * or a unit ("12.2", "1,750", "+4", "CHF26m", "57%", "49 million", "2.9x"),
 * and a number that is a figure on its own - a table cell or a tile's value
 * that is nothing but the number. A bare whole number in a sentence ("8
 * carriers", "phase 2", "30 options") is a count or a name as often as a
 * measurement and is not traced; nor is a year, a date, or digits inside a
 * label ("FY26", "Q3", "M25", "500-4", "15th").
 */
function untracedNumbers(page, pool) {
  return typedNumbers(page).filter(({ number }) => !pool.some((m) => traces(number, m))).map(({ field, number }) => ({ field, shown: number.shown }));
}

// With no measure named, a number is matched across every measure the page rests on, so the units must agree: a
// percentage states a percentage (or a recorded ratio or fraction, a hundred times over), and money or a scaled count states
// neither. A number that prints a scale is held to the scale the unit names ("1,600bn" is not 1.6 kept in billions).
const tracesValue = (number, m, value, { rounded = false } = {}) => {
  const percent = percentUnit(m.unit);
  if (percent && (number.scaled || number.currency)) return false;
  if (!number.percent || percent) return states(number, value, { unit: m.unit, rounded });
  return isRatioUnit(m.unit) && typeof value === "number" && states({ ...number, percent: false, scaled: false, scale: null }, value * 100, { rounded });
};
const traces = (number, m, options) => valuesOf(m).some((value) => tracesValue(number, m, value, options));

/**
 * Is a title's typed number one its evidence holds: a value of a measure the
 * page rests on, rounded at the precision the title prints it ("4%" for 4.3%,
 * never "13%" for 13.7%), or a figure an evidence finding states ("£7bn" where
 * the finding says "£7 billion"), at its scale and on the same footing - a
 * percentage for a percentage.
 */
function titleHolds(number, pool, findings) {
  if (pool.some((m) => traces(number, m, { rounded: true }))) return true;
  const size = (n) => n.n * (n.scale ?? 1);
  return findings.flatMap((finding) => measurementsIn(finding)).some((said) => Boolean(said.percent) === Boolean(number.percent)
    && Math.abs(number.n - size(said) / (number.scale ?? 1)) <= 0.5 * 10 ** -number.decimals + 1e-9);
}

/**
 * The cells of `measures` (registry entries) a typed number states: each
 * `{ ref, label, value }`, the period or member whose recorded value the
 * number is at the precision it is printed (null for a single value). A
 * number that states one cell and no other has said what it is.
 */
export function statedCells(number, measures) {
  return measures.flatMap((m) => { const axis = axisOf(m); return valuesOf(m).flatMap((value, at) => (typeof value === "number" && tracesValue(number, m, value) ? [{ ref: m.ref, label: axis.kind === "scalar" ? null : axis.labels[at], value }] : [])); });
}

/** The measures a page's typed numbers can state: those of the insights it rests on and what they were computed from. */
export function pagePool(page, registry) {
  const evidence = Array.isArray(page?.evidence) ? page.evidence : [];
  const rested = [...registry.values()].filter((m) => evidence.includes(m.owner));
  return [...new Set([...rested, ...rested.flatMap((m) => [...lineage(m.ref, registry)].map((ref) => registry.get(ref)).filter(Boolean))])];
}

/**
 * Every piece of text a page says to its reader, with where it stands:
 * `[{ field, text, written, figure }]` - `text` with what the runtime wrote
 * (tokens) taken out, `written` as it stands, `figure` where the text is a
 * figure on its own (a table cell, a tile's value). What a page rests on and
 * how it is built, and the names along an axis, are not text of this kind
 * (NOT_PROSE); nor is a metric's `value` where its `basis` already holds it to
 * a measure.
 */
export function pageTexts(page) {
  const found = [];
  const read = (value, field, figure) => found.push({ field, text: typeof value === "number" ? String(value) : withoutTokens(value), written: String(value), figure });
  const walk = (node, field, figure) => {
    if (typeof node === "string" || (typeof node === "number" && figure)) return read(node, field, figure);
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach((child, i) => walk(child, `${field}[${i}]`, figure));
    // A table's cells are figures; the first of each row names the row.
    const table = Array.isArray(node.rows) && (isTable(node) || node.rows.every((row) => rowCells(row).length));
    if (table) node.rows.forEach((row, r) => rowCells(row).forEach((cell, c) => { if (c > 0 || !Array.isArray(row)) read(cell && typeof cell === "object" ? cellText(cell) : cell, `${field ? `${field}.` : ""}rows[${r}][${c}]`, true); }));
    for (const [key, child] of Object.entries(node)) {
      if (NOT_PROSE.has(key) || (key === "rows" && table)) continue;
      // A typed metric with a basis is already held to its measure, number for number.
      if (key === "value" && node.basis) continue;
      walk(child, field ? `${field}.${key}` : key, key === "value");
    }
  };
  walk(page, "", false);
  return found;
}

/**
 * Every number typed on a page as a measurement, with where it stands:
 * `[{ field, number }]` (printed-numbers.mjs measurementsIn: a figure on its
 * own is the one number its text holds, with no word beside it - "648m",
 * "37", "~50" - not "104 of 219 clinics" or "Line 2").
 */
export const typedNumbers = (page) => pageTexts(page).flatMap(({ field, text, written, figure }) => measurementsIn(text, figure, written).map((number) => ({ field, number })));

/**
 * What a page's title states of its measures: each token's measure and label,
 * and each typed number that is one value of one measure of `pool` -
 * `[{ ref, label, shown }]`, the label null for a measure of one value.
 * `page` is the page as bound (its tokens written out), `title` the title as
 * authored, `bound` the binding's record.
 */
export function titleCells(page, title, bound, pool) {
  return [...(bound.stated.get(page) ?? []).filter((entry) => entry.how === "token" && /`title`$/.test(entry.field)).map((entry) => ({ ref: entry.ref, label: entry.label, shown: entry.shown })),
    ...typedNumbers({ title }).flatMap(({ number }) => { const cells = statedCells(number, pool); return new Set(cells.map((cell) => `${cell.ref}@${cell.label}`)).size === 1 ? [{ ...cells[0], shown: number.shown }] : []; })];
}

/**
 * The registry keys a page's source line names in every form the footer may
 * set it in (page-types.mjs citationForms): the sources of the measures the
 * title prints (`titled`, titleCells), then each exhibit's primary source -
 * the key most of the measures it plots cite, both where two tie, none
 * where more do (a ranking whose every member is read from its own report
 * has no one document behind it). Only the rest may go to the notes as "+k
 * more"; the title's sources are always named. On the BA retest eleven source
 * lines deferred the whole citation: o01 and fd01 named a few sources and
 * sent ten and eleven to the notes, fd04 and fd05 printed only "N records,
 * listed in the notes", and a reader of the page could look up neither the
 * title's figures nor the chart's.
 */
// The most keys an exhibit may hold as its primary sources when they tie: two records read together (a release and its
// restatement, two halves of a year). Past that the exhibit has no primary of its own; the title's sources still stand.
const PRIMARY_TIES_MAX = 2;
export function primaryCitations(page, registry, titled = []) {
  const citeOf = (ref) => registry.get(ref)?.cite ?? [];
  // A title's number is one cell of its measure: the source of that cell where the measure records each cell's
  // (`citeBy`), else the measure's own - where that is more than two records (a ranking's every member's report) it does
  // not say which one holds this number, and none is taken for it.
  const title = titled.flatMap((cell) => { const m = registry.get(cell.ref), own = m?.citeBy?.[String(cell.label ?? "")];
    const keys = Array.isArray(own) ? own : citeOf(cell.ref); return keys.length > PRIMARY_TIES_MAX ? [] : keys; });
  const exhibits = [...exhibitsOf(page), ...metricsOf(page)].flatMap((item) => {
    const tally = new Map();
    for (const ref of refsOf(item.basis).filter((r) => registry.has(r))) for (const key of new Set(citeOf(ref))) tally.set(key, (tally.get(key) ?? 0) + 1);
    const most = Math.max(0, ...tally.values());
    const tied = [...tally].filter(([, n]) => most > 0 && n === most).map(([key]) => key);
    // A ranking whose every member is read from its own report has no primary document: more than PRIMARY_TIES_MAX keys
    // tied for most go with the secondaries. Held as primaries, fd01's ten groups' results ran no footer could fit.
    return tied.length > PRIMARY_TIES_MAX ? [] : tied;
  });
  return [...new Set([...title, ...exhibits])];
}

// A headline figure is the large number set over or beside a page's exhibit: a hero's `kpi`, a strip's `metrics`.
const headlineTiles = (page) => [...(page?.kpi && typeof page.kpi === "object" ? [page.kpi] : []), ...(Array.isArray(page?.metrics) ? page.metrics : [])].filter((tile) => tile && typeof tile === "object");
const sameFigure = (a, b) => a.n === b.n && Boolean(a.percent) === Boolean(b.percent) && (a.scale ?? 1) === (b.scale ?? 1);
const figureIn = (value) => measurementsIn(String(value ?? ""), true, String(value ?? ""))[0] ?? null;
// The numbers an exhibit draws at its marks, by series, and whether it labels them.
const markValues = (ex) => [...(Array.isArray(ex?.series) ? ex.series.flatMap((s) => (Array.isArray(s?.values) ? s.values : [])) : []), ...(Array.isArray(ex?.values) ? ex.values : [])].filter((v) => typeof v === "number" && Number.isFinite(v));
const labelsMarks = (ex) => ex?.dataLabels !== false && ex?.showDataLabels !== false;

/**
 * Headline figures that say the title's number again (HEADLINE_REPEATS): one
 * that prints the value the title states and a labelled mark of the exhibit
 * prints too, and one that prints the title's number beside an exhibit of
 * another measure, where the figure stands in for the comparison the chart
 * never draws. Read by structure first - the cell a figure prints by
 * reference against the cells the title states (titleCells) and the cells
 * each exhibit draws (the binding's views) - and by the printed number where
 * a figure, a title or a chart was typed. Never by words. On the BA retest a
 * headline figure stood on twelve pages: on na03, na07, pr01, pr02, pr05 and
 * sh01 the reader met one figure three times, and on na14, hb06, lc06, lc08,
 * fd10 and hw03 the title's number stood over a chart of something else.
 */
function headlineRepeats(page, authored, bound, registry, titled) {
  const charts = exhibitsOf(page).filter((ex) => markValues(ex).length || refsOf(ex.basis).length);
  const tiles = headlineTiles(page), written = headlineTiles(authored);
  if (!charts.length || !tiles.length) return [];
  const titleNumbers = measurementsIn(String(page.title ?? ""));
  return tiles.flatMap((tile, at) => {
    const cell = written[at] ? recordedCell(written[at], registry) : null, figure = figureIn(tile.value);
    const inTitle = (cell && titled.some((c) => c.ref === cell.ref && String(c.label ?? "") === String(cell.label ?? ""))) || (figure && titleNumbers.some((n) => sameFigure(n, figure)));
    if (!inTitle) return [];
    const drawn = (ex) => cell && (bound.views.get(ex)?.get(cell.ref)?.has(cell.label ?? null) ?? false);
    const printedAt = (ex) => figure && markValues(ex).some((v) => Math.abs(v - figure.n) <= 0.5 * 10 ** -figure.decimals + 1e-9);
    const onMark = charts.some((ex) => labelsMarks(ex) && (drawn(ex) || printedAt(ex)));
    const plotsIt = charts.some((ex) => (cell ? refsOf(ex.basis).includes(cell.ref) : printedAt(ex)));
    const what = `the ${tile === page.kpi ? "headline figure" : "metric"} ${tile.value}${tile.label ? ` ("${tile.label}")` : ""}`;
    if (onMark) return [{ tile: at, value: String(tile.value), repeats: "title and mark",
      repair: `${what} prints the number the title states, and the exhibit labels the same value on its mark: the reader meets one figure three times. Drop the figure and give its band to the exhibit (form or placement without \`kpi\`/\`metrics\`), or make it carry what neither the title nor the chart does - the change, the gap, the rate, a share of the total` }];
    if (!plotsIt) return [{ tile: at, value: String(tile.value), repeats: "title beside another measure",
      repair: `${what} prints the number the title states, over an exhibit of another measure: the title's comparison is never drawn. Drop the figure and give its band to the exhibit - plotting what the title compares where the chart does not - or make the figure carry what neither the title nor the chart does` }];
    return [];
  });
}

/**
 * The figures a page sets in boxes for the reader to read across: a strip's
 * metrics, a hero's `kpi`, and the items of a fact grid or a stat list - by
 * its own `type`, or the kind its page's form draws the first exhibit as.
 */
export function tilesOf(page) {
  if (!page || typeof page !== "object") return [];
  const first = page.exhibit ?? (Array.isArray(page.exhibits) ? page.exhibits[0] : undefined);
  const grids = exhibitsOf(page).filter((ex) => ["fact-grid", "stat-list"].includes(String(ex.type ?? (ex === first ? kindOfForm(page.type, page.form) ?? "" : ""))));
  return [...(Array.isArray(page.metrics) ? page.metrics : []), page.kpi, ...grids.flatMap((ex) => (Array.isArray(ex.items) ? ex.items : []))].filter((tile) => tile && typeof tile === "object");
}

// A tile's whole value one `{{...}}` token.
const TOKEN_ALONE = /^\s*\{\{([^{}]+)\}\}\s*$/;
/** `<insight>/<measure>[@<period or member>]` as `{ ref, label }`, the label null for a measure of one value. */
const cellOfReference = (reference) => { const text = String(reference ?? "").trim(), at = text.indexOf("@"); return { ref: at < 0 ? text : text.slice(0, at).trim(), label: at < 0 ? null : text.slice(at + 1).trim() }; };
/** The recorded measure and the period or member a tile prints by reference - its `measure`, or a value that is one token - or null. */
function recordedCell(tile, registry) {
  const named = typeof tile.measure === "string" ? tile.measure : TOKEN_ALONE.exec(typeof tile.value === "string" ? tile.value : "")?.[1]?.split("|")[0];
  if (named === undefined) return null;
  const cell = cellOfReference(named);
  return registry.has(cell.ref) ? cell : null;
}

/**
 * Two tiles of `authored` that print one recorded measure at two periods or
 * for two members: `{ ref, tiles: [{ label, value, at }] }`, or null. That is
 * the reference, not a reading: on the BA retest hb10's 2027 cap and hw03's
 * carbon bill for two halves each cost a judge round (tiles-one-measure)
 * where both tiles named the same `<insight>/<measure>`. `bound` is the page
 * with its references written out, for the values as printed.
 */
function sameMeasureTiles(authored, bound, registry) {
  const shown = tilesOf(bound), byRef = new Map();
  tilesOf(authored).forEach((tile, at) => {
    const cell = recordedCell(tile, registry);
    if (!cell) return;
    const seen = byRef.get(cell.ref) ?? [];
    if (!seen.some((other) => other.label === cell.label)) seen.push({ label: cell.label, value: String(shown[at]?.value ?? tile.value ?? ""), name: String(shown[at]?.label ?? tile.label ?? "").trim(), at });
    byRef.set(cell.ref, seen);
  });
  const [ref, tiles] = [...byRef].find(([, list]) => list.length >= 2) ?? [];
  return ref ? { ref, tiles } : null;
}

// The decimal places one number carries as written, at most twelve significant figures (so 0.1 x 3 is not 0.30000000000000004).
const placesOf = (x) => { const [digits, exponent = "0"] = String(Number(Math.abs(x).toPrecision(12))).split(/e/i); return Math.max(0, (digits.split(".")[1] || "").length - Number(exponent)); };
/**
 * The decimal places a measure's record carries, scaled by `factor` (a
 * format's `/1000` or `x100`): the most any of its recorded values has. Null
 * where it records no number.
 */
export function recordedPlaces(measure, factor = 1) {
  const numbers = valuesOf(measure).filter((value) => typeof value === "number" && Number.isFinite(value));
  return numbers.length ? Math.max(...numbers.map((value) => placesOf(value * factor))) : null;
}
/** `format` with its digits written to `places` decimal places, its prefix, suffix and modifiers as they were. */
const formatAtPlaces = (format, places) => {
  const [pattern = "", ...modifiers] = String(format).split("|").map((part) => part.trim());
  return [pattern.replace(/(0(?:,0)?)\.0+/, places ? `$1.${"0".repeat(places)}` : "$1"), ...modifiers.filter(Boolean)].join(" | ");
};

/**
 * Every number a page prints by reference at more decimal places than the
 * record of its measure carries: a token, or a bound figure (a metric, a
 * hero's `kpi`, a row's metric, an item). On the BA retest the OAG seat
 * shares were recorded as 34, 16 and 14 and printed "34.0%", a precision
 * nobody measured, because the writer brief offered `| 0.0` for every token.
 * Each is `{ where, ref, label, printed, as }` - `as` the format that prints the
 * record as recorded.
 */
function overPrecise(page, registry) {
  const found = [];
  const check = (reference, format, where) => {
    const { ref, label } = cellOfReference(reference), measure = registry.get(ref);
    const read = measure ? readFormat(format) : null;
    if (!read || typeof read === "string" || read.decimals === null) return;
    const places = recordedPlaces(measure, read.factor);
    if (places === null || read.decimals <= places) return;
    const axis = axisOf(measure), value = label === null ? valuesOf(measure)[0] : valuesOf(measure)[axis.labels.indexOf(label)];
    found.push({ where, ref: label === null ? ref : `${ref}@${label}`, printed: typeof value === "number" ? renderValue(value, read) : null, recorded: value, as: formatAtPlaces(format, places) });
  };
  const figures = [...(Array.isArray(page.metrics) ? page.metrics : []), page.kpi, ...(Array.isArray(page.blocks) ? page.blocks.map((block) => block?.metric) : []),
    ...exhibitsOf(page).flatMap((ex) => (Array.isArray(ex.items) ? ex.items : []))];
  for (const figure of figures) if (figure && typeof figure === "object" && typeof figure.measure === "string" && typeof figure.format === "string") check(figure.measure, figure.format, `the figure "${String(figure.label ?? figure.measure).trim()}"`);
  const walk = (node, field) => {
    if (typeof node === "string") { for (const [token, inner] of node.matchAll(/\{\{([^{}]+)\}\}/g)) { const [reference, ...format] = inner.split("|"); if (format.length) check(reference, format.join("|"), `the token ${token} in \`${field}\``); } return; }
    if (Array.isArray(node)) return node.forEach((child, i) => walk(child, `${field}[${i}]`));
    if (node && typeof node === "object") for (const [key, child] of Object.entries(node)) if (key !== "measure" && key !== "format") walk(child, field ? `${field}.${key}` : key);
  };
  walk(page, "");
  return found;
}

/**
 * The dependency findings of a pages document against its insight log (with
 * the analyses computed from it): every reference bound (bind.mjs), every
 * typed page's claim and exhibits held to the measures they name, and every
 * number typed into a page's text traced to a measure the page rests on.
 * `doc` is the document as authored; `insights` the Map by id author-deck
 * reads. Beyond the bindings, empty when the log records no measures: the
 * contract begins where the log does.
 */
export function dependencyFindings(doc, insights) {
  const registry = measureRegistry(insights);
  const { doc: written, findings, bound } = bindDeck(doc, insights);
  const out = [...findings];
  if (!registry.size) return out;
  const authored = [...(doc.pages || []), ...(doc.appendix || [])];
  for (const [index, page] of [...(written.pages || []), ...(written.appendix || [])].entries()) {
    if (!page || typeof page !== "object" || !page.type) continue;
    const id = page.id ?? `page-${index + 1}`;
    // A page whose references could not be bound has no numbers to hold yet: the binding's finding is its finding.
    if (bound.failed.has(id)) continue;
    const add = (code, repair, measured) => out.push({ code: registered(DEPENDENCY_CODES, code), id, severity: "blocker", ...(measured === undefined ? {} : { measured }), repair: `${id}: ${repair}` });
    const evidence = Array.isArray(page.evidence) ? page.evidence : [];
    // The measures a typed number can state: those of the insights the page rests on, what they were computed from, and the assumptions they state.
    const pool = [...pagePool(page, registry),
      ...evidence.flatMap((owner) => (insights.get?.(owner)?.assumptions || []).filter((a) => typeof a?.value === "number").map((a) => ({ value: a.value, unit: a.unit })))];
    const typed = pool.length ? untracedNumbers(authored[index], pool) : [];
    // The title is the claim the critique reads and the reader keeps: a number in it that no record holds is refused
    // where the spine is drafted, before the critique reads it and while it is one word to change.
    const findings = evidence.map((owner) => insights.get?.(owner)?.finding).filter((f) => typeof f === "string");
    const titled = !pool.length ? [] : typedNumbers({ title: authored[index]?.title }).filter(({ number }) => !titleHolds(number, pool, findings)).map(({ number }) => ({ field: "title", shown: number.shown }));
    const untraced = typed.filter((u) => u.field !== "title" || !titled.some((t) => t.shown === u.shown));
    if (titled.length) out.push({ code: registered(BINDING_CODES, "TITLE_NUMBER_UNTRACED"), id, severity: "blocker", measured: titled.map((u) => u.shown), repair: `${id}: the title states ${titled.map((u) => u.shown).join(", ")}, which is no value of a measure the page rests on at the precision it is printed - ` +
      "a rounding that is not the record's (\"about 13%\" for 13.7%), a scale the unit does not name, or a number nobody recorded. Print the recorded value by reference - \`{{<insight id>/<measure>@<period or member> | 0.0}}\` - or at its own precision, " +
      "say it in words the record holds (\"a third\"), or record the measure it comes from in the insight the page rests on" });
    if (untraced.length) out.push({ code: registered(BINDING_CODES, "NUMBER_UNTRACED"), id, severity: "advisory", measured: untraced.map((u) => `${u.field}: ${u.shown}`),
      repair: `${id}: ${untraced.length} typed number${untraced.length === 1 ? " is" : "s are"} no value of a measure the page rests on - ${untraced.slice(0, 8).map((u) => `${u.shown} in \`${u.field}\``).join(", ")}${untraced.length > 8 ? ", ..." : ""}. ` +
        "Print a recorded or computed number by reference - `{{<insight id>/<measure>@<period or member> | 0.0}}` - so the runtime writes it; a number nobody recorded is a measure to add to the insight, an analysis to run, or an assumption to state" });
    // One recorded measure in two tiles is one measure at two dates or for two members, whatever the labels say: the references
    // say it, so no judge is asked (page-types.mjs chartFormDefect asks only of tiles of different measures).
    const twice = sameMeasureTiles(authored[index] ?? page, page, registry);
    if (twice) {
      const [a, b] = twice.tiles, at = (tile) => (tile.label === null ? "" : ` at ${tile.label}`);
      out.push({ code: registered(RECORD_CODES, "TILES_SAME_MEASURE"), id, severity: "blocker", measured: { measure: twice.ref, labels: twice.tiles.map((tile) => tile.label) },
        repair: `${id}: the tiles ${a.value} ("${a.name}") and ${b.value} ("${b.name}") print one recorded measure, ${twice.ref}${at(a)} and${at(b)}${twice.tiles.length > 2 ? ` (and ${twice.tiles.length - 2} more of its ${axisOf(registry.get(twice.ref)).kind})` : ""}, which the reader has to compare in separate boxes. ` +
          `Plot the measure on one axis - a \`trend\` page across the periods, a \`ranking\` across the members, or the chart the page already carries - or keep one tile and say the other in the copy (\`{{${twice.ref}${b.label === null ? "" : `@${b.label}`} | ...}}\` in its text); keep tiles for measures that differ` });
    }
    // A decimal the record does not carry is a precision nobody measured: advised, with the format that prints the record as it is.
    const precise = overPrecise(authored[index] ?? page, registry);
    if (precise.length) out.push({ code: registered(RECORD_CODES, "PRECISION_UNRECORDED"), id, severity: "advisory", measured: precise.map((p) => `${p.ref}: "${p.as}"`),
      repair: `${id}: ${precise.length} number${precise.length === 1 ? " is" : "s are"} printed at more decimal places than the record carries - ${precise.slice(0, 8).map((p) => `${p.where} prints ${p.printed ?? p.ref} where ${p.ref} records ${p.recorded}: write "${p.as}"`).join("; ")}${precise.length > 8 ? "; ..." : ""}. Print each at the record's own precision` });
    const exhibits = exhibitsOf(page), metrics = metricsOf(page);
    // Each exhibit as the author wrote it, tokens and all: what is typed in it is told apart from what the runtime wrote.
    const typedExhibits = authored[index] && typeof authored[index] === "object" ? exhibitsOf(authored[index]) : [];
    const numeric = exhibits.map((ex) => plottedValues(ex) > 0);
    const claimed = Array.isArray(page.settles?.measures) ? page.settles.measures.filter((ref) => typeof ref === "string") : [];
    const declared = exhibits.some((ex) => ex.basis) || metrics.some((m) => m.basis) || claimed.length > 0;
    if (!numeric.some(Boolean) && !declared) continue;
    exhibits.forEach((ex, i) => {
      // An exhibit whose every measurement is written by reference has its basis written from the references (bind.mjs); one that also types a measurement says what those are.
      const mixed = bound.shown.get(ex)?.size && bound.typed.get(ex)?.length ? `${nameOf(ex, i)} writes numbers of ${[...bound.shown.get(ex)].join(", ")} by reference and still types ${bound.typed.get(ex).slice(0, 6).join(", ")}${bound.typed.get(ex).length > 6 ? ", ..." : ""}: write ${bound.typed.get(ex).length === 1 ? "that" : "those"} by reference too (\`{{<insight id>/<measure>@<period or member> | 0.0}}\`, a figure's \`measure\`) and the basis is written from the references, or give the exhibit \`basis: { measures: [...], role }\` naming every measure it shows. A change, a gap or a share worked out from recorded measures is an analysis: add it to the analysis plan (\`growth\`, \`gap\`, \`share\`) and print its result by its own token, so the number is computed and not typed. A year, a period label, an ordinal and a count in a phrase are not measurements and need neither` : null;
      if (!ex.basis && mixed) { add("BASIS_MISSING", mixed, bound.typed.get(ex)); return; }
      if (!ex.basis) { if (numeric[i]) add("BASIS_MISSING", `${nameOf(ex, i)} plots ${plottedValues(ex)} number${plottedValues(ex) === 1 ? "" : "s"} and names no measure: name the measures in its series and let the runtime write the values - \`series: [{ measure: "<insight id>/<measure>", name }]\` - or keep the typed values and give it \`basis: { measures: ["<insight id>/<measure>"], role }\`: the measures it plots, from the insights the page rests on, and whether it is "proof" of the claim or "context" beside it`); return; }
      out.push(...basisFindings(id, nameOf(ex, i), ex, ex.basis, { registry, evidence, plots: true, bound, typed: typedExhibits[i] }));
    });
    metrics.forEach((metric, i) => { if (metric.basis) out.push(...basisFindings(id, `metric ${i + 1} ("${metric.label ?? metric.value ?? ""}")`, metric, metric.basis, { registry, evidence, plots: false, bound })); });
    if (!claimed.length) { add("CLAIM_MEASURES_MISSING", `say which measures the claim is about in \`settles.measures\` - ["<insight id>/<measure>", ...], from the insights the page rests on - so each exhibit can be held to the claim it is on the page to prove`); continue; }
    const unknown = claimed.filter((ref) => !registry.has(ref));
    if (unknown.length) add("BASIS_UNKNOWN", `\`settles.measures\` names ${unknown.join(", ")}, which the insight log's measures do not hold`, unknown);
    const unrested = [...new Set(claimed.filter((ref) => registry.has(ref)).map((ref) => registry.get(ref).owner))].filter((owner) => !evidence.includes(owner));
    if (unrested.length) add("BASIS_UNKNOWN", `the claim is about a measure of ${unrested.join(", ")}, which the page does not name in \`evidence\``, unrested);
    const known = claimed.filter((ref) => registry.has(ref));
    const proving = [...exhibits.map((ex, i) => ({ what: nameOf(ex, i), basis: ex.basis, exhibit: true })), ...metrics.map((m, i) => ({ what: `metric ${i + 1}`, basis: m.basis, exhibit: false }))]
      .filter((item) => item.basis && refsIn(item.basis, "proof").some((ref) => registry.has(ref)));
    let proved = false;
    // Roles are read measure by measure: an exhibit proves the claim through the measures it shows as proof, whatever it shows beside them as context.
    for (const item of proving) {
      const offered = refsIn(item.basis, "proof");
      const on = offered.filter((ref) => registry.has(ref)).some((ref) => known.some((c) => bearsOn(ref, c, registry)));
      if (on) proved = true;
      else if (item.exhibit) add("PROOF_OFF_CLAIM", `${item.what} is on the page as proof and plots ${offered.join(", ")}; the claim is about ${known.join(", ")}. Plot a measure of the claim (or one computed from it), move this exhibit to the page whose claim it proves, or - where it informs this claim without proving it - mark it \`role: "context"\` and say why in \`relevance\``, { plots: offered, claim: known });
    }
    if (!proved && known.length && !out.some((f) => f.id === id && f.code === "PROOF_OFF_CLAIM"))
      add("PROOF_MISSING", `nothing on the page proves its claim: ${exhibits.some((ex) => ex.basis && refsIn(ex.basis, "context").length) && !proving.length ? "every measure its exhibits show is context" : "no exhibit or metric names a measure of the claim as proof"}. Plot ${known.join(", ")}, or name it in the metric that states it (a strip's \`metrics\`, a hero's \`kpi\`, a row block's \`metric\`, a fact-grid item: \`{ measure, format, label }\`, or a typed \`value\` with its \`basis\`), or the page argues from an exhibit about something else`, { claim: known });
    out.push(...relationFindings(page, id, registry));
    for (const repeat of headlineRepeats(page, authored[index], bound, registry, titleCells(page, authored[index]?.title, bound, pagePool(page, registry))))
      out.push({ code: "HEADLINE_REPEATS", id, severity: "blocker", measured: { value: repeat.value, repeats: repeat.repeats }, repair: `${id}: ${repeat.repair}` });
    const cites = requiredCitations(page, registry, [...(bound.printed.get(page) ?? [])]);
    if (cites.length && page.source !== undefined) {
      // A typed line is refused here whoever typed it. Where it is the line the slide a revision's page stands for already
      // carried, unchanged, over numbers that slide already showed, the one decision on what a deck is held to says so
      // (weight.mjs notHeldOn, from what the compile checked against the inventory: revision.mjs keptFromSlide).
      if (!Array.isArray(page.source)) add("SOURCE_UNCITED", `the page's \`source\` is typed, and the insights it rests on carry their citations (${cites.join(", ")}): leave \`source\` out and the citation is written from them, or list the registry keys - a typed line is how a page comes to cite one record while plotting another`, cites);
      else { const missing = cites.filter((key) => !page.source.includes(key)); if (missing.length) add("SOURCE_UNCITED", `\`source\` leaves out ${missing.join(", ")}, which the measures the page plots or its claim is about are cited to`, missing); }
    }
  }
  return out;
}

