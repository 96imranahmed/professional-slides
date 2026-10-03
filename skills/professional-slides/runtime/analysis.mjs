#!/usr/bin/env node
// Cross-record analysis, executed by the runtime before the outline is written.
//
//   node runtime/analysis.mjs <id>.pages.json      runs <id>.analysis.json over the measures of <id>.insights.json,
//                                                  writes <id>.analysis-results.json and prints what was computed
//
// An insight log is a list of records, and a storyline written from it page by
// page is a walk through those records: each page restates one, and the
// findings that need two of them - every alternative on the same measures, the
// gap between two series, the headroom to a threshold - have no record, so
// they get no page. This module is the step between the records and the
// outline. The author says which analysis to run, over which measures
// (measures.mjs), and the runtime computes it: no derived number is typed.
//
//   { "schema": "professional-slides.analysis/v1",
//     "analyses": [
//       { "id": "A-peers", "op": "compare", "inputs": ["i-profit/pat", "i-traffic/passengers"], "strength": "strong",
//         "soWhat": "The lead holds on three of four measures and reverses only on margin" },
//       { "id": "A-net-debt", "op": "gap", "inputs": ["i-balance/liabilities", "i-balance/cash"], ... },
//       { "id": "A-renewal", "op": "scenario", "inputs": ["i-fleet/aircraft"], "method": "linear", "drivers": ["net retirements a year"],
//         "assumptions": [{ "name": "net retirements a year", "value": -8, "unit": "aircraft", "rationale": "..." }], "horizon": ["FY27", "FY28"], ... } ] }
//
// Every result says what it is: `computed` from records, `assumed` where an
// assumption entered it (each one listed, with its rationale), or `unavailable`
// with the inputs that are missing. A computed or assumed result joins the
// insight log as a derived insight - with its own measures - so a page can
// rest on it and an exhibit can plot it; an unavailable one cannot carry a
// page, and is shown to the storyline critic as the gap it is.
import path from "node:path";
import { createHash } from "node:crypto";
import { EXIT, UsageError, isMain, parseCli, readJson, runCli, writeJson } from "./cli.mjs";
import { SHAPES } from "./evidence.mjs";
import { axisOf, measureRegistry, normalUnit, valuesOf } from "./measures.mjs";

/** The operations an analysis can be: what each computes, and from how many measures. */
export const ANALYSIS_OPS = Object.freeze({
  compare: { inputs: [1, 12], does: "every alternative on the same measures: one row a member, one column a measure, n/a where a member is undisclosed, the leader and rank on each measure, and who leads under each priority" },
  gap: { inputs: [2, 2], does: "the first measure less the second, label by label, on one unit" },
  ratio: { inputs: [2, 2], does: "the first measure over the second, label by label (`percent: true` for a percentage)" },
  index: { inputs: [1, 8], does: "each series rebased to 100 at `base` (the first period by default), so series in different units share a scale" },
  growth: { inputs: [1, 1], does: "the change, the percentage change and the compound rate between `from` and `to` (the first and last period by default)" },
  rank: { inputs: [1, 1], does: "the members in order on one measure, with each one's rank" },
  share: { inputs: [1, 1], does: "each part as a percentage of the whole" },
  threshold: { inputs: [1, 1], does: "the headroom between a value (`at` a period or member, the last by default) and a `threshold` - a measure, or a stated assumption" },
  scenario: { inputs: [1, 1], does: "a value carried over a `horizon` under stated `assumptions` (`method` linear or compound, `drivers` naming the assumptions applied each step), and where it crosses a `threshold`" },
});

const round = (value) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : null);
const words = (text) => String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
const show = (value) => (value === null || value === undefined ? "n/a" : (Math.abs(value) >= 100 ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100).toLocaleString("en-US"));
const sameUnit = (a, b) => normalUnit(a.unit) === normalUnit(b.unit);
const at = (measure, label) => { const i = axisOf(measure).labels.indexOf(String(label)); return i < 0 ? null : valuesOf(measure)[i] ?? null; };
const noteOf = (measure, label) => measure.boundaries?.[label] ?? null;
const whyNull = (measure, label) => measure.unavailable?.[label] ?? null;

class Unavailable extends Error {}
const unavailable = (reason) => { throw new Unavailable(reason); };

/** The labels two measures share, in the first one's order; refused when they run over different axes. */
function sharedAxis(a, b) {
  const [x, y] = [axisOf(a), axisOf(b)];
  if (x.kind !== y.kind) unavailable(`${a.ref} runs over ${x.kind} and ${b.ref} over ${y.kind}: the two cannot be set label against label`);
  if (x.kind === "scalar") return { kind: "scalar", labels: ["value"], dropped: [] };
  const labels = x.labels.filter((label) => y.labels.includes(label));
  if (!labels.length) unavailable(`${a.ref} and ${b.ref} share no ${x.kind === "periods" ? "period" : "member"}`);
  return { kind: x.kind, labels, dropped: [...x.labels.filter((l) => !labels.includes(l)).map((l) => `${l} is not in ${b.ref}`), ...y.labels.filter((l) => !labels.includes(l)).map((l) => `${l} is not in ${a.ref}`)] };
}
const cell = (measure, axis, label) => (axis.kind === "scalar" ? valuesOf(measure)[0] ?? null : at(measure, label));
const axisFields = (axis, a) => (axis.kind === "periods" ? { periods: axis.labels } : axis.kind === "members" ? { members: axis.labels, period: a.period } : { period: a.period });
const boundariesOf = (measures, labels) => labels.flatMap((label) => measures.flatMap((m) => (noteOf(m, label) ? [`${m.ref} ${label}: ${noteOf(m, label)}`] : [])));
const populationOf = (measures) => [...new Set(measures.map((m) => m.population))].join(" vs ");

function pairwise(inputs, plan, compute, unit, sign) {
  const [a, b] = inputs;
  const axis = sharedAxis(a, b);
  const gaps = {};
  const values = axis.labels.map((label) => {
    const [x, y] = [cell(a, axis, label), cell(b, axis, label)];
    if (x === null || y === null) { gaps[label] = whyNull(x === null ? a : b, label) ?? "an input is undisclosed"; return null; }
    const out = compute(x, y);
    if (!Number.isFinite(out)) { gaps[label] = `${b.ref} is zero here, so nothing is divided by it`; return null; }
    return round(out);
  });
  const shown = values.filter((v) => v !== null);
  if (!shown.length) unavailable(Object.values(gaps).some((why) => /is zero here/.test(why)) ? `${b.ref} is zero wherever ${a.ref} has a value` : `no ${axis.kind === "periods" ? "period" : "label"} has both ${a.ref} and ${b.ref}`);
  // Two records for different periods can be subtracted, and the reader is told they were.
  const periods = axis.kind !== "periods" && a.period && b.period && a.period !== b.period ? [`${a.ref} is for ${a.period} and ${b.ref} for ${b.period}: the two are not one period`] : [];
  const first = axis.labels[values.findIndex((v) => v !== null)], last = axis.labels[values.length - 1 - [...values].reverse().findIndex((v) => v !== null)];
  return {
    measures: { result: { unit, population: populationOf([a, b]), ...axisFields(axis, a), ...(axis.kind === "scalar" ? { value: values[0] } : { values }), ...(Object.keys(gaps).length ? { unavailable: gaps } : {}) } },
    boundaries: [...axis.dropped, ...periods, ...boundariesOf([a, b], axis.labels)],
    finding: axis.kind === "scalar" ? `${a.ref} ${sign} ${b.ref} is ${show(values[0])} ${unit}`
      : `${a.ref} ${sign} ${b.ref} runs from ${show(at({ ...axisFields(axis, a), values }, first))} (${first}) to ${show(at({ ...axisFields(axis, a), values }, last))} (${last}) ${unit}`,
    calculation: `${plan.op}(${a.ref}, ${b.ref}): ${a.ref} ${sign} ${b.ref} for each of ${axis.labels.length} ${axis.kind === "scalar" ? "value" : axis.kind}, computed by the runtime`,
  };
}

const OPS = {
  gap(inputs, plan) {
    const [a, b] = inputs;
    if (!sameUnit(a, b)) unavailable(`${a.ref} is in ${a.unit} and ${b.ref} in ${b.unit}: a gap needs one unit - convert one, or index both (op "index")`);
    return pairwise(inputs, plan, (x, y) => x - y, a.unit, "less");
  },
  ratio(inputs, plan) {
    const [a, b] = inputs;
    const unit = plan.percent ? "%" : sameUnit(a, b) ? "ratio" : `${a.unit} per ${b.unit}`;
    return pairwise(inputs, plan, (x, y) => (y === 0 ? NaN : (plan.percent ? 100 : 1) * x / y), unit, "over");
  },
  index(inputs, plan) {
    const first = axisOf(inputs[0]);
    if (first.kind !== "periods") unavailable(`${inputs[0].ref} is not a series: an index rebases measures that run over periods`);
    const labels = first.labels.filter((label) => inputs.every((m) => axisOf(m).labels.includes(label)));
    const base = String(plan.base ?? labels[0]);
    if (!labels.includes(base)) unavailable(`the base period ${base} is not shared by every input`);
    const measures = {};
    for (const m of inputs) {
      if (axisOf(m).kind !== "periods") unavailable(`${m.ref} is not a series`);
      const anchor = at(m, base);
      if (anchor === null || anchor === 0) unavailable(`${m.ref} has no value at the base period ${base}`);
      measures[m.name in measures ? `${m.owner}.${m.name}` : m.name] = { from: [m.ref], unit: `index, ${base} = 100`, population: m.population, periods: labels, values: labels.map((label) => { const v = at(m, label); return v === null ? null : round(100 * v / anchor); }),
        ...(labels.some((label) => at(m, label) === null) ? { unavailable: Object.fromEntries(labels.filter((label) => at(m, label) === null).map((label) => [label, whyNull(m, label) ?? "undisclosed"])) } : {}) };
    }
    const last = labels.at(-1);
    return { measures, boundaries: boundariesOf(inputs, labels),
      finding: `Indexed to ${base} = 100, ${Object.entries(measures).map(([name, m]) => `${name} reaches ${show(m.values.at(-1))}`).join(" and ")} by ${last}`,
      calculation: `index(${inputs.map((m) => m.ref).join(", ")}): 100 x value / value at ${base}, per period, computed by the runtime` };
  },
  growth(inputs, plan) {
    const [m] = inputs, axis = axisOf(m);
    if (axis.kind !== "periods") unavailable(`${m.ref} is not a series: growth is read between two periods`);
    const from = String(plan.from ?? axis.labels[0]), to = String(plan.to ?? axis.labels.at(-1));
    const [x, y] = [at(m, from), at(m, to)];
    if (x === null || y === null) unavailable(`${m.ref} has no value at ${x === null ? from : to}`);
    const steps = axis.labels.indexOf(to) - axis.labels.indexOf(from);
    if (steps <= 0) unavailable(`${to} does not come after ${from} in ${m.ref}`);
    const percent = x === 0 ? null : round(100 * (y - x) / Math.abs(x)), rate = x > 0 && y > 0 ? round(100 * ((y / x) ** (1 / steps) - 1)) : null;
    const period = `${from} to ${to}`;
    return { measures: { change: { unit: m.unit, population: m.population, period, value: round(y - x) },
        ...(percent === null ? {} : { percent: { unit: "%", population: m.population, period, value: percent } }),
        ...(rate === null ? {} : { rate: { unit: "% a period", population: m.population, period, value: rate } }) },
      boundaries: boundariesOf([m], [from, to]),
      finding: `${m.ref} moves from ${show(x)} (${from}) to ${show(y)} (${to}) ${m.unit}${percent === null ? "" : `, ${percent >= 0 ? "+" : ""}${show(percent)}%`}${rate === null ? "" : `, ${show(rate)}% a period over ${steps}`}`,
      calculation: `growth(${m.ref}): value at ${to} less value at ${from}, as a percentage of the first, and compounded over ${steps} period${steps === 1 ? "" : "s"}, computed by the runtime` };
  },
  rank(inputs, plan) {
    const [m] = inputs, axis = axisOf(m);
    if (axis.kind !== "members") unavailable(`${m.ref} does not run over members: a rank orders a peer set`);
    const order = rankOf(m, axis.labels, plan.better ?? m.better ?? "up");
    const ordered = [...axis.labels].filter((label) => order[label] !== null).sort((x, y) => order[x] - order[y]);
    if (!ordered.length) unavailable(`${m.ref} has no disclosed member`);
    return { measures: { value: { unit: m.unit, population: m.population, period: m.period, members: ordered, values: ordered.map((label) => at(m, label)) },
        rank: { unit: "rank, 1 = best", population: m.population, period: m.period, members: ordered, values: ordered.map((label) => order[label]) } },
      boundaries: boundariesOf([m], axis.labels), undisclosed: axis.labels.filter((label) => order[label] === null),
      finding: `${ordered[0]} ranks first of ${ordered.length} on ${m.ref} at ${show(at(m, ordered[0]))} ${m.unit}${ordered[1] ? `, ahead of ${ordered[1]} at ${show(at(m, ordered[1]))}` : ""}`,
      calculation: `rank(${m.ref}): members ordered ${(plan.better ?? m.better ?? "up") === "up" ? "highest" : "lowest"} first, ties sharing a rank, computed by the runtime` };
  },
  share(inputs) {
    const [m] = inputs, axis = axisOf(m);
    if (axis.kind !== "members") unavailable(`${m.ref} does not run over members: a share splits a whole into its parts`);
    const values = axis.labels.map((label) => at(m, label));
    if (values.some((v) => v === null)) unavailable(`${m.ref} has an undisclosed part (${axis.labels.filter((label) => at(m, label) === null).join(", ")}): the whole cannot be shared out`);
    if (values.some((v) => v < 0)) unavailable(`${m.ref} has a negative part (${axis.labels.filter((label) => at(m, label) < 0).join(", ")}): parts of a whole are not negative`);
    const total = values.reduce((sum, v) => sum + v, 0);
    if (!(total > 0)) unavailable(`${m.ref} sums to ${total}`);
    const shares = values.map((v) => round(100 * v / total));
    const top = axis.labels[shares.indexOf(Math.max(...shares))];
    return { measures: { share: { unit: "% of total", population: m.population, period: m.period, members: axis.labels, values: shares } }, boundaries: boundariesOf([m], axis.labels),
      finding: `${top} is ${show(Math.max(...shares))}% of ${show(total)} ${m.unit} across ${axis.labels.length} parts`,
      calculation: `share(${m.ref}): each part over the sum of the ${axis.labels.length} parts, computed by the runtime` };
  },
  compare(inputs, plan, context) {
    for (const m of inputs) if (axisOf(m).kind !== "members") unavailable(`${m.ref} does not run over members: a comparison sets members against measures`);
    const members = (Array.isArray(plan.members) && plan.members.length ? plan.members : [...new Set([...(context.alternatives || []), ...inputs.flatMap((m) => axisOf(m).labels)])]).map(String);
    const columns = inputs.map((m) => {
      const better = m.better ?? "up", order = rankOf(m, members, better);
      const ranked = members.filter((label) => order[label] !== null).sort((x, y) => order[x] - order[y]);
      const tied = ranked.filter((label) => order[label] === 1);
      return { ref: m.ref, name: m.name, unit: m.unit, period: m.period ?? null, better, leader: tied.length === 1 ? tied[0] : null, tied: tied.length > 1 ? tied : [],
        cells: Object.fromEntries(members.map((label) => [label, { value: at(m, label), rank: order[label], ...(at(m, label) === null ? { unavailable: whyNull(m, label) ?? (axisOf(m).labels.includes(label) ? "undisclosed" : "not in this record") } : {}), ...(noteOf(m, label) ? { boundary: noteOf(m, label) } : {}) }])) };
    });
    const coverage = Object.fromEntries(members.map((label) => [label, columns.filter((c) => c.cells[label].value !== null).length]));
    const leadsOn = Object.fromEntries(members.map((label) => [label, columns.filter((c) => c.leader === label).map((c) => c.name)]));
    const most = Math.max(...members.map((label) => leadsOn[label].length));
    const front = members.filter((label) => leadsOn[label].length === most && most > 0);
    // Who leads when each measure in turn is the priority: no weights are invented,
    // so the answer is shown to depend on the priority rather than averaged away.
    const sensitivity = { byPriority: columns.map((c) => ({ priority: c.name, leader: c.leader, tied: c.tied, qualified: Boolean(c.leader && c.cells[c.leader].boundary) })),
      leadsOn: Object.fromEntries(members.map((label) => [label, leadsOn[label].length])), mostLeads: front.length === 1 ? front[0] : null,
      holdsUnderEveryPriority: front.length === 1 && most === columns.length };
    const measures = {};
    for (const [i, m] of inputs.entries()) measures[m.name in measures ? `${m.owner}.${m.name}` : m.name] = { from: [m.ref], unit: m.unit, population: m.population, period: m.period, members, values: members.map((label) => columns[i].cells[label].value),
      ...(m.better ? { better: m.better } : {}),
      ...(members.some((label) => columns[i].cells[label].value === null) ? { unavailable: Object.fromEntries(members.filter((label) => columns[i].cells[label].value === null).map((label) => [label, columns[i].cells[label].unavailable])) } : {}),
      ...(members.some((label) => columns[i].cells[label].boundary) ? { boundaries: Object.fromEntries(members.filter((label) => columns[i].cells[label].boundary).map((label) => [label, columns[i].cells[label].boundary])) } : {}) };
    const empty = members.filter((label) => coverage[label] === 0);
    return { measures, table: { members, columns }, coverage, sensitivity, uncovered: empty,
      boundaries: columns.flatMap((c) => members.flatMap((label) => (c.cells[label].boundary ? [`${c.ref} ${label}: ${c.cells[label].boundary}`] : []))),
      finding: `${members.length} members on ${columns.length} measure${columns.length === 1 ? "" : "s"}: ${sensitivity.mostLeads ? `${sensitivity.mostLeads} leads on ${most} of ${columns.length}` : "no member leads on more measures than every other"}` +
        `${columns.filter((c) => c.leader && c.leader !== sensitivity.mostLeads).map((c) => `; ${c.leader} leads on ${c.name}`).join("")}` +
        `${members.some((label) => coverage[label] < columns.length) ? `; ${members.filter((label) => coverage[label] < columns.length).length} member(s) undisclosed on at least one measure` : ""}`,
      calculation: `compare(${inputs.map((m) => m.ref).join(", ")}): members x measures with n/a kept, rank and leader per measure, leader under each priority; computed by the runtime` };
  },
  threshold(inputs, plan, context) {
    const [m] = inputs, axis = axisOf(m);
    const label = axis.kind === "scalar" ? null : String(plan.at ?? axis.labels.at(-1));
    const value = axis.kind === "scalar" ? valuesOf(m)[0] ?? null : at(m, label);
    if (value === null) unavailable(`${m.ref} has no value${label ? ` at ${label}` : ""}`);
    const t = plan.threshold;
    if (!t || typeof t !== "object") unavailable("a threshold analysis names its `threshold`: { ref } for a recorded measure, or { value, unit, rationale } for a stated assumption");
    let limit, assumptions = [], tested;
    if (t.ref) {
      tested = context.registry.get(t.ref);
      if (!tested) { const error = new Unavailable(`the threshold ${t.ref} is not a recorded measure`); error.missing = [t.ref]; throw error; }
      const ax = axisOf(tested);
      limit = ax.kind === "scalar" ? valuesOf(tested)[0] ?? null : at(tested, t.at ?? label ?? ax.labels.at(-1));
      if (limit === null) unavailable(`${t.ref} has no value to test against`);
      if (!sameUnit(m, tested)) unavailable(`${m.ref} is in ${m.unit} and the threshold ${t.ref} in ${tested.unit}`);
      if (tested.assumed) assumptions = [{ name: t.ref, value: limit, unit: tested.unit, rationale: tested.rationale ?? "an assumed measure" }];
    } else {
      if (typeof t.value !== "number" || !Number.isFinite(t.value)) unavailable("a threshold that is not a recorded measure states its `value`");
      if (words(t.rationale) < 4) unavailable("a threshold that is not a recorded measure is an assumption: say why that number in `rationale`");
      if (t.unit !== undefined && normalUnit(t.unit) !== normalUnit(m.unit)) unavailable(`${m.ref} is in ${m.unit} and the threshold in ${t.unit}`);
      limit = t.value;
      assumptions = [{ name: t.name ?? "threshold", value: t.value, unit: t.unit ?? m.unit, rationale: t.rationale.trim() }];
    }
    const safe = (plan.safe ?? "above") === "above";
    const headroom = round(safe ? value - limit : limit - value);
    const period = label && axis.kind === "periods" ? label : m.period;
    return { assumptions, boundaries: boundariesOf(tested ? [m, tested] : [m], label ? [label] : []),
      measures: { headroom: { unit: m.unit, population: m.population, period, value: headroom },
        ...(value !== 0 ? { headroomPercent: { unit: "% of the value", population: m.population, period, value: round(100 * headroom / Math.abs(value)) } } : {}),
        value: { unit: m.unit, population: m.population, period, value }, threshold: { unit: m.unit, population: m.population, period, value: limit } },
      breached: headroom < 0,
      finding: `${m.ref}${label ? ` at ${label}` : ""} is ${show(value)} ${m.unit} against a ${assumptions.length ? "stated" : "recorded"} threshold of ${show(limit)}: ${headroom < 0 ? "breached by" : "headroom of"} ${show(Math.abs(headroom))}${value !== 0 ? ` (${show(Math.abs(100 * headroom / value))}% of the value)` : ""}`,
      calculation: `threshold(${m.ref}${t.ref ? `, ${t.ref}` : ""}): ${safe ? "value less threshold" : "threshold less value"}, and as a percentage of the value, computed by the runtime` };
  },
  scenario(inputs, plan, context) {
    const [m] = inputs, axis = axisOf(m);
    const start = axis.kind === "scalar" ? null : String(plan.at ?? axis.labels.at(-1));
    const base = axis.kind === "scalar" ? valuesOf(m)[0] ?? null : at(m, start);
    if (base === null) unavailable(`${m.ref} has no value${start ? ` at ${start}` : ""} to start the scenario from`);
    const assumptions = Array.isArray(plan.assumptions) ? plan.assumptions : [];
    const bad = assumptions.find((a) => !a || typeof a.name !== "string" || typeof a.value !== "number" || !Number.isFinite(a.value) || words(a.rationale) < 4);
    if (!assumptions.length || bad) unavailable("a scenario states its `assumptions`, each { name, value, unit, rationale }: a number nobody recorded is an assumption, said as one");
    const horizon = (Array.isArray(plan.horizon) ? plan.horizon : []).map(String);
    if (!horizon.length) unavailable("a scenario names the `horizon` it runs over, as period labels");
    const method = plan.method ?? "linear";
    if (!["linear", "compound"].includes(method)) unavailable("a scenario's `method` is linear (each driver added every period) or compound (each driver a percentage applied every period)");
    const drivers = (Array.isArray(plan.drivers) && plan.drivers.length ? plan.drivers : assumptions.map((a) => a.name)).map(String);
    const unknown = drivers.filter((name) => !assumptions.some((a) => a.name === name));
    if (unknown.length) unavailable(`the drivers ${unknown.join(", ")} are not among the stated assumptions`);
    const applied = assumptions.filter((a) => drivers.includes(a.name));
    const off = applied.find((a) => a.unit !== undefined && (method === "linear" ? normalUnit(String(a.unit).replace(/\s+(a|per)\s+\w+$/i, "")) !== normalUnit(m.unit) : !/%/.test(String(a.unit))));
    if (off) unavailable(`the driver ${off.name} is in ${off.unit}; a ${method} scenario on ${m.ref} takes drivers in ${method === "linear" ? `${m.unit} a period` : "% a period"}`);
    let current = base;
    const values = horizon.map(() => { current = method === "linear" ? current + applied.reduce((sum, a) => sum + a.value, 0) : current * applied.reduce((f, a) => f * (1 + a.value / 100), 1); return round(current); });
    let crossing = null, limit = null;
    if (plan.threshold && typeof plan.threshold === "object") {
      const t = plan.threshold;
      if (t.ref) { const tested = context.registry.get(t.ref); if (!tested) { const error = new Unavailable(`the threshold ${t.ref} is not a recorded measure`); error.missing = [t.ref]; throw error; }
        if (!sameUnit(m, tested)) unavailable(`${m.ref} is in ${m.unit} and the threshold ${t.ref} in ${tested.unit}`);
        limit = valuesOf(tested).at(-1) ?? null; }
      else {
        if (words(t.rationale) < 4) unavailable("a threshold that is not a recorded measure is an assumption: say why that number in `rationale`");
        if (t.unit !== undefined && normalUnit(t.unit) !== normalUnit(m.unit)) unavailable(`${m.ref} is in ${m.unit} and the threshold in ${t.unit}`);
        limit = typeof t.value === "number" ? t.value : null;
      }
      if (limit === null) unavailable("the scenario's threshold has no value");
      const below = base >= limit;
      const index = values.findIndex((v) => (below ? v < limit : v > limit));
      crossing = index < 0 ? null : horizon[index];
    }
    const listed = [...assumptions.map((a) => ({ name: a.name, value: a.value, unit: a.unit ?? m.unit, rationale: String(a.rationale).trim() })),
      ...(plan.threshold && !plan.threshold.ref ? [{ name: plan.threshold.name ?? "threshold", value: limit, unit: plan.threshold.unit ?? m.unit, rationale: String(plan.threshold.rationale).trim() }] : [])];
    return { assumptions: listed, boundaries: boundariesOf([m], start ? [start] : []), crossesAt: crossing,
      measures: { path: { unit: m.unit, population: m.population, periods: [start ?? "base", ...horizon], values: [base, ...values], assumed: true, rationale: `${method} path under ${applied.map((a) => `${a.name} = ${a.value}`).join(", ")}` } },
      finding: `From ${show(base)} ${m.unit}${start ? ` at ${start}` : ""}, ${method === "linear" ? "adding" : "compounding"} ${applied.map((a) => `${a.name} (${a.value}${method === "compound" ? "%" : ""})`).join(" and ")} each period gives ${show(values.at(-1))} by ${horizon.at(-1)}` +
        `${limit === null ? "" : crossing ? `, crossing ${show(limit)} at ${crossing}` : `, not crossing ${show(limit)} within the horizon`} - under stated assumptions, not a forecast`,
      calculation: `scenario(${m.ref}): ${method} path over ${horizon.length} period${horizon.length === 1 ? "" : "s"} from the recorded value, under ${listed.length} stated assumption${listed.length === 1 ? "" : "s"}, computed by the runtime` };
  },
};

/** Each label's rank on a measure (1 = best, ties share), null where it is undisclosed or not in the record. */
function rankOf(measure, labels, better) {
  const values = Object.fromEntries(labels.map((label) => [label, at(measure, label)]));
  const ahead = (other, label) => values[other] !== null && (better === "down" ? values[other] < values[label] : values[other] > values[label]);
  return Object.fromEntries(labels.map((label) => [label, values[label] === null ? null : 1 + labels.filter((other) => ahead(other, label)).length]));
}

/** Every problem with an analysis plan's form, as sentences: what a run would refuse before computing anything. */
export function planProblems(plan) {
  if (plan === null || plan === undefined) return [];
  if (typeof plan !== "object" || !Array.isArray(plan.analyses)) return ["an analysis plan is { analyses: [{ id, op, inputs, soWhat, strength }] }"];
  const problems = [], seen = new Set();
  for (const [i, a] of plan.analyses.entries()) {
    const id = a?.id ?? `analyses[${i}]`;
    if (!a || typeof a !== "object") { problems.push(`${id}: an analysis is { id, op, inputs, soWhat, strength }`); continue; }
    if (typeof a.id !== "string" || !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(a.id)) problems.push(`${id}: give the analysis an \`id\` (letters, digits, dots, dashes, underscores)`);
    else if (seen.has(a.id)) problems.push(`${id}: the id is used twice`);
    seen.add(a.id);
    const op = ANALYSIS_OPS[a.op];
    if (!op) { problems.push(`${id}: \`op\` is one of ${Object.keys(ANALYSIS_OPS).join(", ")}`); continue; }
    const inputs = Array.isArray(a.inputs) ? a.inputs : [];
    if (inputs.length < op.inputs[0] || inputs.length > op.inputs[1] || inputs.some((ref) => typeof ref !== "string" || !ref.includes("/")))
      problems.push(`${id}: ${a.op} reads ${op.inputs[0] === op.inputs[1] ? op.inputs[0] : `${op.inputs[0]} to ${op.inputs[1]}`} measure${op.inputs[1] === 1 ? "" : "s"}, each named \`<insight id>/<measure>\` in \`inputs\``);
    if (words(a.soWhat) < 4) problems.push(`${id}: \`soWhat\` says what follows for the decision, in a sentence`);
    if (!["strong", "supporting", "context"].includes(a.strength)) problems.push(`${id}: \`strength\` is one of strong, supporting, context`);
    if (a.missing !== undefined && !(Array.isArray(a.missing) && a.missing.every((item) => typeof item === "string" && item.trim()))) problems.push(`${id}: \`missing\` lists the inputs the analysis needs and the records do not hold, as text`);
  }
  return problems;
}

const hashOf = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/**
 * Run a plan over the insight log's measures. `insights` is the log (a Map by
 * id, or its array); `alternatives` the deck's declared players, which a
 * comparison covers whether or not a record names them. Each result is
 * `{ id, op, status, inputs, missing, assumptions, boundaries, measures,
 * finding, calculation, hash }`; later analyses can read earlier results'
 * measures as `<analysis id>/<name>`.
 */
export function runAnalyses(plan, insights, { alternatives = [] } = {}) {
  const problems = planProblems(plan);
  if (problems.length || !plan) return { results: [], problems };
  const registry = measureRegistry(insights);
  const results = [];
  for (const a of plan.analyses) {
    const inputs = a.inputs.map((ref) => registry.get(ref));
    const absent = a.inputs.filter((ref, i) => !inputs[i]);
    const declared = Array.isArray(a.missing) ? a.missing.map((item) => item.trim()) : [];
    const result = { id: a.id, op: a.op, inputs: [...a.inputs], soWhat: a.soWhat.trim(), strength: a.strength, missing: [...absent, ...declared], assumptions: [], boundaries: [] };
    if (result.missing.length) {
      Object.assign(result, { status: "unavailable", reason: `${absent.length ? `no recorded measure ${absent.join(", ")}` : ""}${absent.length && declared.length ? "; " : ""}${declared.length ? `needs ${declared.join("; ")}` : ""}` });
    } else {
      try {
        const out = OPS[a.op](inputs, a, { alternatives: alternatives.map(String), registry });
        const assumed = (out.assumptions || []).length > 0 || inputs.some((m) => m.assumed);
        Object.assign(result, out, { status: assumed ? "assumed" : "computed",
          assumptions: [...(out.assumptions || []), ...inputs.filter((m) => m.assumed && !(out.assumptions || []).some((x) => x.name === m.ref)).map((m) => ({ name: m.ref, value: valuesOf(m).at(-1) ?? null, unit: m.unit, rationale: m.rationale ?? "an assumed measure" }))],
          sources: [...new Set(inputs.flatMap((m) => m.sources || []))], cite: [...new Set(inputs.flatMap((m) => m.cite || []))] });
      } catch (error) {
        if (!(error instanceof Unavailable)) throw error;
        Object.assign(result, { status: "unavailable", reason: error.message, missing: error.missing ?? [] });
      }
    }
    result.hash = hashOf({ op: a.op, inputs: a.inputs.map((ref) => registry.get(ref) ?? ref), plan: a, measures: result.measures ?? null });
    results.push(result);
    // A computed result is a record later analyses can read.
    if (result.measures) for (const [name, m] of Object.entries(result.measures)) registry.set(`${a.id}/${name}`, { ...m, ref: `${a.id}/${name}`, owner: a.id, name, sources: result.sources, cite: result.cite, inputs: Array.isArray(m.from) ? m.from : result.inputs, derived: true, assumed: result.status === "assumed" || Boolean(m.assumed) });
  }
  return { results, problems: [] };
}

// The evidence shape a result has, by what its measures run over: what decides
// the page types it can carry (evidence.mjs SHAPES).
function shapeOf(result) {
  const measures = Object.values(result.measures || {});
  if (result.op === "compare") return { shape: "roster", breadth: { members: result.table.members.length } };
  const series = measures.filter((m) => Array.isArray(m.periods));
  if (series.length) { const breadth = { periods: series[0].periods.length, series: series.length }; return SHAPES.series.needs(breadth) ? { shape: "series", breadth } : { shape: "fact", breadth: {} }; }
  const sets = measures.filter((m) => Array.isArray(m.members));
  if (sets.length) {
    const members = sets[0].members.length;
    if (result.op === "share") return SHAPES.mix.needs({ parts: members }) ? { shape: "mix", breadth: { parts: members } } : { shape: "fact", breadth: {} };
    return SHAPES["peer-set"].needs({ members }) ? { shape: "peer-set", breadth: { members } } : { shape: "fact", breadth: {} };
  }
  return { shape: "fact", breadth: {} };
}

/** The computed and assumed results as derived insights: what a page names in `evidence` and an exhibit plots. */
export function analysisInsights(results) {
  return (results || []).filter((r) => r.status !== "unavailable").map((r) => ({ id: r.id, derived: true, status: r.status, op: r.op, finding: r.finding, calculation: r.calculation,
    ...shapeOf(r), strength: r.strength, soWhat: r.soWhat, sources: r.sources ?? [], cite: r.cite ?? [], measures: r.measures, inputs: r.inputs, assumptions: r.assumptions, boundaries: r.boundaries }));
}

/** One line per result, for the author's summary and the critic's packet. */
export const analysisLine = (r) => `${r.id} [${r.op}, ${r.status}] ${r.status === "unavailable" ? `cannot run: ${r.reason}` : r.finding}` +
  `${(r.assumptions || []).length ? ` | assumes ${r.assumptions.map((a) => `${a.name} = ${a.value}${a.unit ? ` ${a.unit}` : ""}`).join("; ")}` : ""}` +
  `${(r.boundaries || []).length ? ` | boundaries: ${r.boundaries.slice(0, 4).join("; ")}${r.boundaries.length > 4 ? "; ..." : ""}` : ""}`;

/**
 * The analysis plan beside a pages file, run over its insight log: `{ plan,
 * results, problems }`, with `plan: null` when the deck has none. `log` is the
 * parsed `<id>.insights.json`.
 */
export async function readAnalysis(baseDir, stem, log, { alternatives = [] } = {}) {
  const plan = await readJson(path.join(baseDir, `${stem}.analysis.json`), { optional: true });
  if (plan === null) return { plan: null, results: [], problems: [] };
  return { plan, ...runAnalyses(plan, log?.insights || [], { alternatives }) };
}

/** The players a deck declares, by name: the alternatives a comparison covers. */
export const alternativesOf = (deck) => (Array.isArray(deck?.players) ? deck.players.map((p) => (p && typeof p === "object" ? p.name : p)).filter((name) => typeof name === "string" && name.trim()) : []);

const USAGE = "Usage: analysis.mjs <id>.pages.json";

async function main(argv) {
  const { positionals: [file] } = parseCli(argv, {}, { usage: USAGE });
  if (!file) throw new UsageError(USAGE);
  const doc = await readJson(path.resolve(file));
  const dir = path.dirname(path.resolve(file)), stem = doc.deck?.id ?? path.basename(file).replace(/\.pages\.json$/, "");
  const log = await readJson(path.join(dir, `${stem}.insights.json`), { optional: true });
  if (!log) { console.error(`${stem}.insights.json is not beside the pages file: the analyses run over its measures`); return EXIT.refused; }
  const { plan, results, problems } = await readAnalysis(dir, stem, log, { alternatives: alternativesOf(doc.deck) });
  if (!plan) { console.error(`${stem}.analysis.json is not beside the pages file: write the analyses to run - ${Object.entries(ANALYSIS_OPS).map(([op, about]) => `${op} (${about.does})`).join("; ")}`); return EXIT.refused; }
  if (problems.length) { console.error(`The analysis plan is not valid:\n- ${problems.join("\n- ")}`); return EXIT.refused; }
  await writeJson(path.join(dir, `${stem}.analysis-results.json`), { schema: "professional-slides.analysis-results/v1", id: stem, results });
  console.log(JSON.stringify({ results: `${stem}.analysis-results.json`, computed: results.filter((r) => r.status === "computed").length, assumed: results.filter((r) => r.status === "assumed").length,
    unavailable: results.filter((r) => r.status === "unavailable").map((r) => `${r.id}: ${r.reason}`), lines: results.map(analysisLine) }, null, 1));
  return EXIT.ok;
}

if (isMain(import.meta.url)) runCli(main);
