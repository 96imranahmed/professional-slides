// What each page's claim and exhibits rest on, checked as data.
//
// A page names the insights it rests on (`evidence`), and until now that was
// the whole dependency: a list of ids on the page. Nothing said which measure
// the claim is about or which measure each exhibit plots, so an exhibit copied
// from another page - a fleet-age chart under a title about cash flow, its id
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
//   the `relevance` a reviewer judges.
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
// Everything here reads declared fields and numbers. No title is parsed.
import { plottedValues } from "../evidence.mjs";
import { axisOf, measureRegistry, normalUnit, parseRef, valuesOf } from "../measures.mjs";
import { registered } from "../errors.mjs";

export const DEPENDENCY_CODES = Object.freeze({
  CLAIM_MEASURES_MISSING: "a page with numbers on it does not say which measures its claim is about",
  BASIS_MISSING: "an exhibit that plots numbers names no measure it plots",
  BASIS_UNKNOWN: "a `basis` or `settles.measures` names a measure the insight log does not hold, or one from an insight the page does not rest on",
  BASIS_UNIT: "an exhibit's unit is not the unit of any measure it says it plots",
  BASIS_AXIS: "an exhibit's periods or members are not those of the measure it says it plots",
  BASIS_VALUES: "an exhibit's plotted numbers are not the values of the measure it says it plots",
  PROOF_OFF_CLAIM: "an exhibit offered as proof plots no measure of the page's claim",
  PROOF_MISSING: "a page whose exhibits are all context: nothing on it proves the claim",
  CONTEXT_UNEXPLAINED: "a context exhibit that does not say why it is on the page",
  SOURCE_UNCITED: "the page's citation leaves out a source its exhibits or its claim rest on, or is typed where it can be derived",
  RELATION_UNDECLARED: "two measures of the claim in one unit sit in separate exhibits and the page does not say what the reader is to read between them",
  RELATION_SPLIT: "the claim asserts a relation between two measures and no exhibit shows them on one basis",
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
const metricsOf = (page) => [...(Array.isArray(page.metrics) ? page.metrics : []), ...(page.kpi && typeof page.kpi === "object" ? [page.kpi] : [])].filter((m) => m && typeof m === "object");
const nameOf = (ex, i) => (typeof ex.heading === "string" && ex.heading.trim() ? `"${ex.heading.trim()}"` : `exhibit ${i + 1}${ex.type ? ` (${ex.type})` : ""}`);
const refsOf = (basis) => (Array.isArray(basis?.measures) ? basis.measures : typeof basis?.measure === "string" ? [basis.measure] : []).filter((ref) => typeof ref === "string");
const roleOf = (basis) => basis?.role ?? "proof";

/** The measures a measure is computed from, through every analysis between: its lineage. */
function lineage(ref, registry, seen = new Set()) {
  for (const input of registry.get(ref)?.inputs || []) if (!seen.has(input)) { seen.add(input); lineage(input, registry, seen); }
  return seen;
}
/** Does plotting `shown` bear on `claimed`: the same measure, or one computed from the other. */
const bearsOn = (shown, claimed, registry) => shown === claimed || lineage(shown, registry).has(claimed) || lineage(claimed, registry).has(shown);

// A plotted number matches a recorded one when it is that number at the
// precision the page prints: 54.9 plots 54.93, and 55 plots 54.9.
function matches(plotted, recorded) {
  if (recorded === null || recorded === undefined) return false;
  const decimals = (String(plotted).split(".")[1] || "").length;
  return Math.abs(plotted - recorded) <= 0.5 * 10 ** -decimals + 1e-9;
}

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
  const recorded = valuesOf(measure);
  for (const [i, value] of values.entries()) {
    if (value === null || value === undefined) continue;
    if (typeof value !== "number") return { label: categories[i], value };
    const at = axis.kind === "scalar" ? 0 : axis.labels.indexOf(categories[i]);
    if (at < 0 || !matches(value, recorded[at])) return { label: categories[i], value, recorded: at < 0 ? undefined : recorded[at] };
  }
  return null;
}

function basisFindings(id, what, item, basis, { registry, evidence, plots }) {
  const out = [];
  const add = (code, repair, measured) => out.push({ code: registered(DEPENDENCY_CODES, code), id, severity: "blocker", ...(measured === undefined ? {} : { measured }), repair: `${id}: ${repair}` });
  if (basis.role !== undefined && !ROLES.includes(basis.role)) add("BASIS_UNKNOWN", `${what}'s \`basis.role\` is "proof" (it proves the claim; the default) or "context" (it sits beside the claim, with its \`relevance\`)`);
  const refs = refsOf(basis);
  const unknown = refs.filter((ref) => !registry.has(ref));
  if (unknown.length) add("BASIS_UNKNOWN", `${what} names ${unknown.join(", ")}, which the insight log's measures do not hold${unknown.some((ref) => !parseRef(ref)) ? " - a measure is named `<insight id>/<measure>`" : ""}`, unknown);
  const unrested = [...new Set(refs.filter((ref) => registry.has(ref)).map((ref) => registry.get(ref).owner))].filter((owner) => !evidence.includes(owner));
  if (unrested.length) add("BASIS_UNKNOWN", `${what} plots a measure of ${unrested.join(", ")}, which the page does not name in \`evidence\`: a page rests on the insights its exhibits are drawn from - name ${unrested.length === 1 ? "it" : "them"}, or plot what the page does rest on`, unrested);
  const measures = refs.map((ref) => registry.get(ref)).filter(Boolean);
  if (!measures.length) return out;
  if (roleOf(basis) === "context" && words(basis.relevance) < RELEVANCE_WORDS)
    add("CONTEXT_UNEXPLAINED", `${what} is context, not proof of the claim: say in \`basis.relevance\` what it tells the reader about this claim (${RELEVANCE_WORDS} words or more); the reviewer judges it on that sentence`);
  if (!plots) return out;
  if (typeof item.unit === "string" && item.unit.trim() && !measures.some((m) => normalUnit(m.unit) === normalUnit(item.unit)))
    add("BASIS_UNIT", `${what} is drawn in ${item.unit}, and the measure${measures.length === 1 ? "" : "s"} it names ${measures.length === 1 ? "is" : "are"} in ${[...new Set(measures.map((m) => m.unit))].join(", ")} (${refs.join(", ")}): the exhibit plots something other than what it says it plots`, { exhibit: item.unit, measures: measures.map((m) => m.unit) });
  const plotted = plottedSeries(item);
  if (!plotted) return out;
  const axes = measures.map(axisOf).filter((axis) => axis.kind !== "scalar");
  const outside = axes.length ? plotted.categories.filter((label) => !axes.some((axis) => axis.labels.includes(label))) : [];
  if (outside.length) { add("BASIS_AXIS", `${what} plots ${outside.slice(0, 6).join(", ")}${outside.length > 6 ? ", ..." : ""}, which ${refs.join(", ")} ${measures.length === 1 ? "does" : "do"} not run over (${[...new Set(axes.flatMap((axis) => axis.labels))].slice(0, 12).join(", ")})`, outside); return out; }
  for (const series of plotted.series) {
    const strays = measures.map((m) => strayValue(plotted.categories, series.values, m));
    if (strays.every(Boolean)) {
      const nearest = strays.reduce((a, b) => (b.recorded !== undefined && a.recorded === undefined ? b : a));
      add("BASIS_VALUES", `${what} plots ${series.name} = ${nearest.value} at ${nearest.label}, and ${refs.join(", ")} record${measures.length === 1 ? "s" : ""} ${nearest.recorded === undefined ? "no value there" : nearest.recorded}: the numbers drawn are not the measure's - plot the recorded values, or name the measure these are`, { series: series.name, label: nearest.label, plotted: nearest.value, recorded: nearest.recorded ?? null });
    }
  }
  return out;
}

/**
 * The citation keys a page's dependencies need: every `cite` key of the
 * insights its claim and its exhibits rest on (an analysis carries its
 * inputs'). Empty when those insights name no registry key.
 */
export function requiredCitations(page, registry) {
  const refs = [...(Array.isArray(page.settles?.measures) ? page.settles.measures : []), ...exhibitsOf(page).flatMap((ex) => refsOf(ex.basis)), ...metricsOf(page).flatMap((m) => refsOf(m.basis))];
  return [...new Set(refs.flatMap((ref) => registry.get(ref)?.cite || []))];
}

/** The pairs of the claim's measures a reader has to hold against each other across exhibits. */
function splitPairs(page, registry) {
  const proof = exhibitsOf(page).filter((ex) => ex.basis && roleOf(ex.basis) === "proof").map((ex) => refsOf(ex.basis).filter((ref) => registry.has(ref)));
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

/**
 * The dependency findings of a pages document against its insight log (with
 * the analyses computed from it): every typed page's claim and exhibits held
 * to the measures they name. `insights` is the Map by id author-deck reads.
 * Empty when the log records no measures: the contract begins where the log
 * does.
 */
export function dependencyFindings(doc, insights) {
  const registry = measureRegistry(insights);
  if (!registry.size) return [];
  const out = [];
  for (const [index, page] of [...(doc.pages || []), ...(doc.appendix || [])].entries()) {
    if (!page || typeof page !== "object" || !page.type) continue;
    const id = page.id ?? `page-${index + 1}`;
    const add = (code, repair, measured) => out.push({ code: registered(DEPENDENCY_CODES, code), id, severity: "blocker", ...(measured === undefined ? {} : { measured }), repair: `${id}: ${repair}` });
    const evidence = Array.isArray(page.evidence) ? page.evidence : [];
    const exhibits = exhibitsOf(page), metrics = metricsOf(page);
    const numeric = exhibits.map((ex) => plottedValues(ex) > 0);
    const claimed = Array.isArray(page.settles?.measures) ? page.settles.measures.filter((ref) => typeof ref === "string") : [];
    const declared = exhibits.some((ex) => ex.basis) || metrics.some((m) => m.basis) || claimed.length > 0;
    if (!numeric.some(Boolean) && !declared) continue;
    exhibits.forEach((ex, i) => {
      if (!ex.basis) { if (numeric[i]) add("BASIS_MISSING", `${nameOf(ex, i)} plots ${plottedValues(ex)} number${plottedValues(ex) === 1 ? "" : "s"} and names no measure: give it \`basis: { measures: ["<insight id>/<measure>"], role }\` - the measures it plots, from the insights the page rests on, and whether it is "proof" of the claim or "context" beside it`); return; }
      out.push(...basisFindings(id, nameOf(ex, i), ex, ex.basis, { registry, evidence, plots: true }));
    });
    metrics.forEach((metric, i) => { if (metric.basis) out.push(...basisFindings(id, `metric ${i + 1} ("${metric.label ?? metric.value ?? ""}")`, metric, metric.basis, { registry, evidence, plots: false })); });
    if (!claimed.length) { add("CLAIM_MEASURES_MISSING", `say which measures the claim is about in \`settles.measures\` - ["<insight id>/<measure>", ...], from the insights the page rests on - so each exhibit can be held to the claim it is on the page to prove`); continue; }
    const unknown = claimed.filter((ref) => !registry.has(ref));
    if (unknown.length) add("BASIS_UNKNOWN", `\`settles.measures\` names ${unknown.join(", ")}, which the insight log's measures do not hold`, unknown);
    const unrested = [...new Set(claimed.filter((ref) => registry.has(ref)).map((ref) => registry.get(ref).owner))].filter((owner) => !evidence.includes(owner));
    if (unrested.length) add("BASIS_UNKNOWN", `the claim is about a measure of ${unrested.join(", ")}, which the page does not name in \`evidence\``, unrested);
    const known = claimed.filter((ref) => registry.has(ref));
    const proving = [...exhibits.map((ex, i) => ({ what: nameOf(ex, i), basis: ex.basis, exhibit: true })), ...metrics.map((m, i) => ({ what: `metric ${i + 1}`, basis: m.basis, exhibit: false }))]
      .filter((item) => item.basis && roleOf(item.basis) === "proof" && refsOf(item.basis).some((ref) => registry.has(ref)));
    let proved = false;
    for (const item of proving) {
      const on = refsOf(item.basis).filter((ref) => registry.has(ref)).some((ref) => known.some((c) => bearsOn(ref, c, registry)));
      if (on) proved = true;
      else if (item.exhibit) add("PROOF_OFF_CLAIM", `${item.what} is on the page as proof and plots ${refsOf(item.basis).join(", ")}; the claim is about ${known.join(", ")}. Plot a measure of the claim (or one computed from it), move this exhibit to the page whose claim it proves, or - where it informs this claim without proving it - mark it \`role: "context"\` and say why in \`relevance\``, { plots: refsOf(item.basis), claim: known });
    }
    if (!proved && known.length && !out.some((f) => f.id === id && f.code === "PROOF_OFF_CLAIM"))
      add("PROOF_MISSING", `nothing on the page proves its claim: ${exhibits.some((ex) => ex.basis && roleOf(ex.basis) === "context") ? "its exhibits are context" : "no exhibit or metric names a measure of the claim"}. Plot ${known.join(", ")} (or give the metrics that state it their \`basis\`), or the page argues from an exhibit about something else`, { claim: known });
    out.push(...relationFindings(page, id, registry));
    const cites = requiredCitations(page, registry);
    if (cites.length && page.source !== undefined) {
      if (!Array.isArray(page.source)) add("SOURCE_UNCITED", `the page's \`source\` is typed, and the insights it rests on carry their citations (${cites.join(", ")}): leave \`source\` out and the citation is written from them, or list the registry keys - a typed line is how a page comes to cite one record while plotting another`, cites);
      else { const missing = cites.filter((key) => !page.source.includes(key)); if (missing.length) add("SOURCE_UNCITED", `\`source\` leaves out ${missing.join(", ")}, which the measures the page plots are cited to`, missing); }
    }
  }
  return out;
}

/** The context exhibits and declared relations of a page, in a line each: what a reviewer is asked to judge. */
export function dependencyNotes(page) {
  const notes = [];
  exhibitsOf(page).forEach((ex, i) => { if (ex.basis && roleOf(ex.basis) === "context") notes.push(`context exhibit ${nameOf(ex, i)} plots ${refsOf(ex.basis).join(", ")} - relevance claimed: "${String(ex.basis.relevance ?? "").trim()}"`); });
  const relation = page.settles?.relation;
  if (relation?.kind === "separate") notes.push(`the claim's measures are drawn separately by choice - reason given: "${String(relation.reason ?? "").trim()}"`);
  else if (relation?.kind) notes.push(`the claim asserts a ${relation.kind} between its measures`);
  return notes;
}

/**
 * One exhibit showing a split pair on one basis, built from the page's own
 * exhibits: the two series on one scale where they share a unit. Every plotted
 * number, category, heading and caption of the originals is kept (`kept` says
 * so, number for number); null where the page has no pair this can merge.
 */
export function relationRepair(page, insights) {
  const registry = measureRegistry(insights);
  const pair = splitPairs(page, registry).find((p) => p.sameUnit);
  if (!pair) return null;
  const holders = [pair.a, pair.b].map((ref) => exhibitsOf(page).find((ex) => ex.basis && roleOf(ex.basis) === "proof" && refsOf(ex.basis).includes(ref)));
  const plotted = holders.map((ex) => plottedSeries(ex));
  if (plotted.some((p) => !p)) return null;
  const categories = [...plotted[0].categories, ...plotted[1].categories.filter((label) => !plotted[0].categories.includes(label))];
  const series = holders.flatMap((ex, i) => plotted[i].series.map((s) => ({ name: plotted[i].series.length === 1 && ex.heading ? ex.heading : s.name, values: categories.map((label) => { const at = plotted[i].categories.indexOf(label); return at < 0 ? null : s.values[at]; }) })));
  const exhibit = { type: "chart.line", heading: holders.map((ex) => ex.heading).filter(Boolean).join(" and "), unit: registry.get(pair.a).unit, categories, series,
    caption: holders.map((ex) => ex.caption).filter(Boolean).join(" "), basis: { measures: [...new Set(holders.flatMap((ex) => refsOf(ex.basis)))], role: "proof" } };
  const numbers = (list) => list.flatMap((s) => s.values).filter((v) => typeof v === "number").sort((a, b) => a - b);
  const before = numbers(plotted.flatMap((p) => p.series)), after = numbers(series);
  return { pair: [pair.a, pair.b], replaces: holders.map((ex) => exhibitsOf(page).indexOf(ex)), exhibit,
    kept: { numbers: before.length === after.length && before.every((v, i) => v === after[i]), categories: plotted.every((p) => p.categories.every((label) => categories.includes(label))) } };
}
