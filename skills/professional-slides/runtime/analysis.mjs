#!/usr/bin/env node
// Cross-record analysis, executed by the runtime before the outline is written.
//
//   node runtime/analysis.mjs <id>.pages.json      runs <id>.analysis.json over the measures of <id>.insights.json,
//                                                  writes <id>.analysis-results.json and prints what was computed
//   node runtime/analysis.mjs <id>.pages.json --catalogue
//                                                  the analyses the recorded measures allow, each a plan entry to
//                                                  paste with the finding it computes, and which the plan already runs
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
//       { "id": "A-crews", "op": "scenario", "inputs": ["i-crews/on-shift"], "method": "linear", "drivers": ["net leavers a year"],
//         "assumptions": [{ "name": "net leavers a year", "value": -8, "unit": "crews a year", "rationale": "..." }], "horizon": ["FY27", "FY28"], ... } ] }
//
// `gap`, `ratio`, `sum` and `product` set their inputs label against label. A
// single value stands against every label of the others; measures that run
// over different axes are aligned only where the plan says which value of
// each to read (`at: { "<ref>": "<label>" }`), and every such choice is a
// boundary note on the result - as is a combination across different
// populations, which names them, and a sum of one measure over its periods,
// which says how many it adds (a stock summed over time is a mistake the
// author has to see). Units are composed from the inputs' and cancelled
// (measures.mjs composeUnit), so one calculation is one analysis in a unit
// that means something. A percentage is read two ways, and the op says which:
// a `product` applies it as the fraction it is (46% of 140 m is 64.4 m), a
// `ratio` divides by the number as recorded (140 m over 46% is 3.04 m per
// point) - and says so in a boundary note.
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
import { axisOf, composeUnit, insightLogRefusal, isPercentUnit, measureRegistry, normalUnit, readInsightLog, valuesOf } from "./measures.mjs";
import { notJson } from "./pages-file.mjs";

/** The operations an analysis can be: what each computes, and from how many measures. */
export const ANALYSIS_OPS = Object.freeze({
  compare: { inputs: [1, 12], does: "every alternative on the same measures: one row a member, one column a measure, n/a where a member is undisclosed, the leader and rank on each measure, and who leads under each priority; over the deck's declared players, or the members named in `members`" },
  gap: { inputs: [2, 2], does: "the first measure less the second, label by label, on one unit" },
  ratio: { inputs: [2, 2], does: "the first measure over the second, label by label (`percent: true` for a percentage); a percentage among them is used as the number recorded, not as a fraction" },
  sum: { inputs: [1, 12], does: "two or more measures in one unit added label by label, or the periods or members of one measure added up" },
  product: { inputs: [2, 8], does: "two or more measures multiplied label by label, divided by each measure in `over`; the unit is composed from theirs (x per y times y is x) and a percentage is applied as a fraction" },
  index: { inputs: [1, 8], does: "each series rebased to 100 at `base` (the first period by default), so series in different units share a scale" },
  growth: { inputs: [1, 1], does: "the change, the percentage change and the compound rate between `from` and `to` (the first and last period by default); for a measure in % the change in points alone" },
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

// The ops that set measures against each other label by label: they read
// `at`, broadcast a single value, and take a stated `unit` and `assumptions`.
const COMBINING = Object.freeze(["gap", "ratio", "sum", "product"]);

/**
 * One input as a combining op reads it: the whole measure, or - where the plan
 * picks a label for it in `at` - the one value there, which then stands
 * against every label of the others.
 */
function operandOf(m, plan) {
  const axis = axisOf(m), label = plan.at && typeof plan.at === "object" ? plan.at[m.ref] : undefined;
  if (label === undefined) return { m, ref: m.ref, axis, value: axis.kind === "scalar" ? valuesOf(m)[0] ?? null : null, period: m.period ?? null };
  if (axis.kind === "scalar") unavailable(`${m.ref} is one value: \`at\` picks a period or member of a measure that runs over them`);
  if (!axis.labels.includes(String(label))) unavailable(`${m.ref} has no ${axis.kind === "periods" ? "period" : "member"} ${label}: \`at\` names one of ${axis.labels.join(", ")}`);
  const value = at(m, label);
  if (value === null) unavailable(`${m.ref} has no value at ${label}: ${whyNull(m, label) ?? "undisclosed"}`);
  return { m, ref: m.ref, axis: { kind: "scalar", labels: [] }, value, picked: String(label), period: axis.kind === "periods" ? String(label) : m.period ?? null };
}
const said = (o) => (o.picked ? `${o.ref} at ${o.picked}` : o.ref);

/**
 * The labels a set of operands is combined over, and what was done to set
 * them against each other, as notes the result carries: a label one input
 * lacks, a value read at a stated label, one value set against every label of
 * a series. Measures that run over different axes, or share no label, are not
 * aligned here: the plan says which value of each to read (`at`).
 */
function alignmentOf(operands) {
  const axes = operands.filter((o) => o.axis.kind !== "scalar");
  const picked = operands.filter((o) => o.picked).map((o) => `${o.ref} is read at ${o.picked}${noteOf(o.m, o.picked) ? ` (${noteOf(o.m, o.picked)})` : ""}, as the plan states`);
  const how = (o) => `\`at: { "${o.ref}": "<${o.axis.kind === "periods" ? "period" : "member"}>" }\``;
  if (!axes.length) return { kind: "scalar", labels: ["value"], first: operands[0], notes: [...picked, ...apartOf(operands)] };
  const other = axes.find((o) => o.axis.kind !== axes[0].axis.kind);
  if (other) unavailable(`${axes[0].ref} runs over ${axes[0].axis.kind} and ${other.ref} over ${other.axis.kind}: the two cannot be set label against label. Say which value of one to read - ${how(axes[0])} or ${how(other)} - and the result records the choice`);
  const kind = axes[0].axis.kind, noun = kind === "periods" ? "period" : "member";
  const labels = axes[0].axis.labels.filter((label) => axes.every((o) => o.axis.labels.includes(label)));
  if (!labels.length) unavailable(`${axes.map((o) => o.ref).join(" and ")} share no ${noun}. Say which ${noun} of each to read - \`at: { ${axes.map((o) => `"${o.ref}": "<${noun}>"`).join(", ")} }\` - and the result records the choice`);
  const dropped = axes.flatMap((o) => o.axis.labels.filter((label) => !labels.includes(label)).map((label) => `${label} is not in ${axes.filter((x) => !x.axis.labels.includes(label)).map((x) => x.ref).join(", ")}`));
  const single = operands.filter((o) => o.axis.kind === "scalar");
  const spread = single.map((o) => `${said(o)} is one value${o.period && !o.picked ? ` (${o.period})` : ""}, set against each of the ${labels.length} ${kind} of ${axes[0].ref}`);
  return { kind, labels, first: axes[0], notes: [...dropped, ...picked, ...spread, ...(kind === "members" ? apartOf(operands) : [])] };
}
// Records for different periods can be combined, and the reader is told they were.
function apartOf(operands) {
  const dated = operands.filter((o) => o.period);
  if (new Set(dated.map((o) => o.period)).size < 2) return [];
  return [`${dated.map((o, i) => `${o.ref} ${i ? "" : "is "}for ${o.period}`).join(" and ")}: ${dated.length === 2 ? "the two" : "these"} are not one period`];
}
const axisFields = (axis, first) => (axis.kind === "periods" ? { periods: axis.labels } : axis.kind === "members" ? { members: axis.labels, period: first.m.period } : { period: first.period ?? first.m.period });
const boundariesOf = (measures, labels) => labels.flatMap((label) => measures.flatMap((m) => (noteOf(m, label) ? [`${m.ref} ${label}: ${noteOf(m, label)}`] : [])));
const populationOf = (measures) => [...new Set(measures.map((m) => m.population))].join(" vs ");
// A combination of measures of different populations says so, naming them: the result describes neither.
function acrossOf(measures) {
  const peoples = new Map(measures.map((m) => [normalUnit(m.population), m.population]));
  return peoples.size < 2 ? [] : [`${measures.map((m) => `${m.ref} describes ${m.population}`).join(" and ")}: the result is across different populations`];
}

/**
 * The unit a combining op reports: the one composed from its inputs, or the
 * one the plan states with its reason. A composed unit that does not simplify
 * is reported as such, never printed as if it were a unit anyone uses.
 */
function unitOf(composed, plan) {
  if (plan.unit === undefined) return { unit: composed.unit, notes: composed.simple ? [] : [`the unit "${composed.unit}" is composed from the inputs' units and does not simplify: state the result's \`unit\` with a \`unitRationale\` where it has a plainer name`] };
  if (typeof plan.unit !== "string" || !plan.unit.trim() || words(plan.unitRationale) < 4) unavailable("a result `unit` the plan states is text, with why that unit in `unitRationale`: the runtime composes the unit from the inputs, and a stated one replaces it only with its reason");
  return { unit: plan.unit.trim(), notes: normalUnit(plan.unit) === normalUnit(composed.unit) ? [] : [`the unit "${plan.unit.trim()}" is stated by the plan (the inputs compose to "${composed.unit}"): ${plan.unitRationale.trim()}`] };
}

/**
 * Measures combined label by label. `fold` takes the operands' values at one
 * label and returns the result (not finite where a divisor is zero); `expr`
 * says the combination in words, for the finding and the calculation.
 */
function combined(measures, plan, fold, { unit, notes = [] }, expr, divisor = null) {
  const operands = measures.map((m) => operandOf(m, plan));
  const axis = alignmentOf(operands);
  const valueAt = (o, label) => (o.axis.kind === "scalar" ? o.value : at(o.m, label));
  const gaps = {};
  const values = axis.labels.map((label) => {
    const xs = operands.map((o) => valueAt(o, label));
    const hole = xs.indexOf(null);
    if (hole >= 0) { gaps[label] = whyNull(operands[hole].m, operands[hole].picked ?? label) ?? "an input is undisclosed"; return null; }
    const out = fold(xs);
    if (!Number.isFinite(out)) { gaps[label] = `${(divisor ?? operands.at(-1)).ref} is zero here, so nothing is divided by it`; return null; }
    return round(out);
  });
  const shown = values.filter((v) => v !== null);
  if (!shown.length) unavailable(Object.values(gaps).some((why) => /is zero here/.test(why)) ? `${(divisor ?? operands.at(-1)).ref} is zero wherever ${operands[0].ref} has a value` : `no ${axis.kind === "periods" ? "period" : "label"} has ${operands.length === 2 ? "both " : "all of "}${operands.map((o) => o.ref).join(operands.length === 2 ? " and " : ", ")}`);
  const expression = expr(operands.map(said));
  const first = axis.labels[values.findIndex((v) => v !== null)], last = axis.labels[values.length - 1 - [...values].reverse().findIndex((v) => v !== null)];
  const result = { ...axisFields(axis, axis.first), values };
  return {
    measures: { result: { unit, population: populationOf(measures), ...axisFields(axis, axis.first), ...(axis.kind === "scalar" ? { value: values[0] } : { values }), ...(Object.keys(gaps).length ? { unavailable: gaps } : {}) } },
    boundaries: [...acrossOf(measures), ...axis.notes, ...notes, ...boundariesOf(operands.filter((o) => o.axis.kind !== "scalar").map((o) => o.m), axis.labels), ...boundariesOf(operands.filter((o) => o.axis.kind === "scalar" && !o.picked).map((o) => o.m), ["value"])],
    // Over time a result runs from its first period to its last; across members it has no order, so its smallest and its largest are said.
    finding: axis.kind === "scalar" ? `${expression} is ${show(values[0])} ${unit}`
      : axis.kind === "members" ? `${expression} ranges from ${show(Math.min(...shown))} (${axis.labels[values.indexOf(Math.min(...shown))]}) to ${show(Math.max(...shown))} (${axis.labels[values.indexOf(Math.max(...shown))]}) ${unit}`
      : `${expression} runs from ${show(at(result, first))} (${first}) to ${show(at(result, last))} (${last}) ${unit}`,
    calculation: `${plan.op}(${measures.map((m) => m.ref).join(", ")}): ${expression} for each of ${axis.labels.length} ${axis.kind === "scalar" ? "value" : axis.kind}, computed by the runtime`,
  };
}

const OPS = {
  gap(inputs, plan) {
    const [a, b] = inputs;
    if (!sameUnit(a, b)) unavailable(`${a.ref} is in ${a.unit} and ${b.ref} in ${b.unit}: a gap needs one unit - convert one, or index both (op "index")`);
    return combined(inputs, plan, ([x, y]) => x - y, { unit: a.unit }, ([x, y]) => `${x} less ${y}`);
  },
  ratio(inputs, plan) {
    const [a, b] = inputs;
    // Units that cancel leave a ratio; a percentage of unlike units is the plan's statement, and is said to be.
    const composed = composeUnit([a.unit], [b.unit]);
    const unit = plan.percent ? { unit: "%", notes: composed.unit === "ratio" ? [] : [`${a.ref} is in ${a.unit} and ${b.ref} in ${b.unit}: the percentage is of unlike units, as the plan states`] } : unitOf(composed, plan);
    // A ratio reads a percentage as the number recorded; a product applies it as a fraction. The result says which was done.
    const asNumbers = sameUnit(a, b) ? [] : inputs.filter((m) => isPercentUnit(m.unit)).map((m) => `${m.ref} is a percentage, used as the number recorded (46% is 46, not 0.46): op "product" applies a percentage as a fraction`);
    return combined(inputs, plan, ([x, y]) => (y === 0 ? NaN : (plan.percent ? 100 : 1) * x / y), { unit: unit.unit, notes: [...unit.notes, ...asNumbers] }, ([x, y]) => `${x} over ${y}`);
  },
  sum(inputs, plan) {
    const [m] = inputs;
    const off = inputs.find((other) => !sameUnit(m, other));
    if (off) unavailable(`${m.ref} is in ${m.unit} and ${off.ref} in ${off.unit}: a sum needs one unit`);
    if (inputs.length > 1) return combined(inputs, plan, (xs) => xs.reduce((total, x) => total + x, 0), { unit: m.unit }, (names) => names.join(" plus "));
    // One measure: its periods or its members added up.
    const axis = axisOf(m), values = valuesOf(m);
    if (axis.kind === "scalar") unavailable(`${m.ref} is one value: a sum adds two or more measures, or the periods or members of one`);
    if (axis.kind === "periods" && isPercentUnit(m.unit)) unavailable(`${m.ref} is in ${m.unit}: the percentages of different periods do not add up to one`);
    const holes = axis.labels.filter((label) => at(m, label) === null);
    if (holes.length) unavailable(`${m.ref} has an undisclosed ${axis.kind === "periods" ? "period" : "member"} (${holes.join(", ")}): a total with a part missing is not the total`);
    const total = round(values.reduce((sum, v) => sum + v, 0));
    // Adding periods is right for a flow counted in each and wrong for a level held at each: the result says what was added.
    const over = axis.kind === "periods" ? [`adds the ${axis.labels.length} periods of ${m.ref} (${axis.labels[0]} to ${axis.labels.at(-1)}): a total over time is right for a flow counted in each period, and wrong for a stock or a level, which is not added across periods`] : [];
    return { measures: { result: { unit: m.unit, population: m.population, period: axis.kind === "periods" ? `${axis.labels[0]} to ${axis.labels.at(-1)}` : m.period, value: total } }, boundaries: [...over, ...boundariesOf([m], axis.labels)],
      finding: `${m.ref} adds up to ${show(total)} ${m.unit} over ${axis.labels.length} ${axis.kind}`,
      calculation: `sum(${m.ref}): the ${axis.labels.length} ${axis.kind} added up, computed by the runtime` };
  },
  product(inputs, plan, context) {
    const over = context.over || [];
    const composed = composeUnit(inputs.map((m) => m.unit), over.map((m) => m.unit), { fractions: true });
    // With every factor a percentage, or every unit cancelled, what is left is a number: a ratio, or - `percent` - a percentage.
    const bare = composed.unit === "ratio";
    if (plan.percent && !bare) unavailable(`the product is in ${composed.unit}, not a bare number: \`percent\` turns a ratio into a percentage, and this is not one`);
    const scale = composed.scale * (plan.percent ? 100 : 1);
    const unit = plan.percent ? { unit: "%", notes: [] } : unitOf(composed, plan);
    const fractions = [...inputs, ...over].filter((m) => isPercentUnit(m.unit)).map((m) => `${m.ref} is a percentage, applied as a fraction`);
    return combined([...inputs, ...over], plan, (xs) => { const below = xs.slice(inputs.length).reduce((f, x) => f * x, 1); return below === 0 ? NaN : scale * xs.slice(0, inputs.length).reduce((f, x) => f * x, 1) / below; },
      { unit: unit.unit, notes: [...unit.notes, ...fractions] }, (names) => `${names.slice(0, inputs.length).join(" times ")}${over.length ? ` over ${names.slice(inputs.length).join(" and ")}` : ""}`, over.length === 1 ? over[0] : over.length ? { ref: "a measure in `over`" } : null);
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
      // `base` says which period is 100, so an indexed trend bound to the result needs no base typed (bind.mjs).
      measures[m.name in measures ? `${m.owner}.${m.name}` : m.name] = { from: [m.ref], unit: `index, ${base} = 100`, base, population: m.population, periods: labels, values: labels.map((label) => { const v = at(m, label); return v === null ? null : round(100 * v / anchor); }),
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
    const period = `${from} to ${to}`;
    // A percentage moves in points: 9.4% to -6.1% is 15.5 points down, and a
    // percentage of a percentage (-165%) is a number nobody can read. It is
    // computed only where the plan asks for it (`relative: true`), and labelled.
    if (isPercentUnit(m.unit)) {
      const points = round(y - x), relative = plan.relative === true && x !== 0 ? round(100 * (y - x) / Math.abs(x)) : null;
      return { measures: { change: { unit: "percentage points", population: m.population, period, value: points },
          ...(relative === null ? {} : { percent: { unit: "% of the starting percentage", population: m.population, period, value: relative } }) },
        boundaries: boundariesOf([m], [from, to]),
        finding: `${m.ref} moves from ${show(x)} (${from}) to ${show(y)} (${to}) ${m.unit}, ${points >= 0 ? "+" : ""}${show(points)} points${relative === null ? "" : ` (${relative >= 0 ? "+" : ""}${show(relative)}% of the starting percentage)`}`,
        calculation: `growth(${m.ref}): value at ${to} less value at ${from}, in percentage points${relative === null ? "" : ", and as a percentage of the first"}, computed by the runtime` };
    }
    const percent = x === 0 ? null : round(100 * (y - x) / Math.abs(x)), rate = x > 0 && y > 0 ? round(100 * ((y / x) ** (1 / steps) - 1)) : null;
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
    // Who is compared: the members the plan names (`members`); otherwise the players the deck declares, since a deck that
    // declares players is comparing those and a measure that also lists twenty others would bury them; otherwise every member
    // any input runs over. A member left out by the default is named in the result (`others`), to be added by naming it.
    const recorded = [...new Set(inputs.flatMap((m) => axisOf(m).labels))], players = (context.alternatives || []).map(String);
    const members = (Array.isArray(plan.members) && plan.members.length ? plan.members : players.length ? players : recorded).map(String);
    const others = recorded.filter((label) => !members.includes(label));
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
    return { measures, table: { members, columns }, coverage, sensitivity, uncovered: empty, ...(others.length ? { others } : {}),
      boundaries: columns.flatMap((c) => members.flatMap((label) => (c.cells[label].boundary ? [`${c.ref} ${label}: ${c.cells[label].boundary}`] : []))),
      finding: `${members.length} members on ${columns.length} measure${columns.length === 1 ? "" : "s"}: ${sensitivity.mostLeads ? `${sensitivity.mostLeads} leads on ${most} of ${columns.length}` : "no member leads on more measures than every other"}` +
        `${columns.filter((c) => c.leader && c.leader !== sensitivity.mostLeads).map((c) => `; ${c.leader} leads on ${c.name}`).join("")}` +
        `${members.some((label) => coverage[label] < columns.length) ? `; ${members.filter((label) => coverage[label] < columns.length).length} member(s) undisclosed on at least one measure` : ""}` +
        `${others.length && !Array.isArray(plan.members) ? `; ${others.length} other member${others.length === 1 ? "" : "s"} of these measures ${others.length === 1 ? "is" : "are"} not compared (the comparison is over the deck's declared players: name the members to compare in \`members\` to add any)` : ""}`,
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
    // The path starts at the period the value is recorded for: a measure over periods at the one it starts from, a measure of
    // one value at its own `period` - "base" only where it records none, or where the horizon already uses that label.
    const dated = typeof m.period === "string" && m.period.trim() && !horizon.includes(m.period.trim()) ? m.period.trim() : "base";
    const origin = start ?? dated;
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
      measures: { path: { unit: m.unit, population: m.population, periods: [origin, ...horizon], values: [base, ...values], assumed: true, rationale: `${method} path under ${applied.map((a) => `${a.name} = ${a.value}`).join(", ")}` } },
      finding: `From ${show(base)} ${m.unit}${start ? ` at ${start}` : ""}, ${method === "linear" ? "adding" : "compounding"} ${applied.map((a) => `${a.name} (${a.value}${method === "compound" ? "%" : ""})`).join(" and ")} each period gives ${show(values.at(-1))} by ${horizon.at(-1)}` +
        `${limit === null ? "" : crossing ? `, crossing ${show(limit)} at ${crossing}` : `, not crossing ${show(limit)} within the horizon`} - under stated assumptions, not a forecast`,
      calculation: `scenario(${m.ref}): ${method} path over ${horizon.length} period${horizon.length === 1 ? "" : "s"} from the recorded value, under ${listed.length} stated assumption${listed.length === 1 ? "" : "s"}, computed by the runtime` };
  },
};

/** The premises a combining analysis states in `assumptions`, each { name, rationale } with its value where it has one. */
function premisesOf(plan) {
  if (plan.assumptions === undefined) return [];
  const list = Array.isArray(plan.assumptions) ? plan.assumptions : [null];
  if (!list.length || list.some((a) => !a || typeof a.name !== "string" || !a.name.trim() || words(a.rationale) < 4 || (a.value !== undefined && !(typeof a.value === "number" && Number.isFinite(a.value)))))
    unavailable("an analysis that rests on a premise nobody recorded states it in `assumptions`, each { name, rationale }: what is assumed, and why it is a fair stand-in");
  return list.map((a) => ({ name: a.name.trim(), ...(a.value === undefined ? {} : { value: a.value }), ...(a.unit === undefined ? {} : { unit: a.unit }), rationale: String(a.rationale).trim() }));
}

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
    if (a.members !== undefined && !(a.op === "compare" && Array.isArray(a.members) && a.members.length >= 2 && a.members.every((name) => typeof name === "string" && name.trim())))
      problems.push(`${id}: \`members\` lists the two or more members a \`compare\` sets side by side, as the measures name them; left out, the comparison is over the deck's declared \`players\`, or over every member of its inputs where the deck declares none`);
    if (a.over !== undefined && !(a.op === "product" && Array.isArray(a.over) && a.over.length >= 1 && a.over.length <= 4 && a.over.every((ref) => typeof ref === "string" && ref.includes("/"))))
      problems.push(`${id}: \`over\` lists the one to four measures a product is divided by, each named \`<insight id>/<measure>\``);
    if (COMBINING.includes(a.op) && a.at !== undefined) {
      const read = [...inputs, ...(Array.isArray(a.over) ? a.over : [])];
      if (!a.at || typeof a.at !== "object" || Array.isArray(a.at) || Object.entries(a.at).some(([ref, label]) => !read.includes(ref) || !["string", "number"].includes(typeof label)))
        problems.push(`${id}: \`at\` says which value of an input to read, as { "<insight id>/<measure>": "<period or member>" } over the measures ${a.op} reads`);
    }
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
    // What a product is divided by is read as its inputs are: it is part of the result's lineage, sources and assumptions.
    const overRefs = a.op === "product" && Array.isArray(a.over) ? a.over : [], over = overRefs.map((ref) => registry.get(ref));
    const read = [...inputs, ...over].filter(Boolean);
    const absent = [...a.inputs, ...overRefs].filter((ref) => !registry.get(ref));
    const declared = Array.isArray(a.missing) ? a.missing.map((item) => item.trim()) : [];
    const result = { id: a.id, op: a.op, inputs: [...a.inputs, ...overRefs], soWhat: a.soWhat.trim(), strength: a.strength, missing: [...absent, ...declared], assumptions: [], boundaries: [] };
    if (result.missing.length) {
      Object.assign(result, { status: "unavailable", reason: `${absent.length ? `no recorded measure ${absent.join(", ")}` : ""}${absent.length && declared.length ? "; " : ""}${declared.length ? `needs ${declared.join("; ")}` : ""}` });
    } else {
      try {
        const out = OPS[a.op](inputs, a, { alternatives: alternatives.map(String), registry, over });
        // A premise nobody recorded - one entity's ratio standing in for another's - is stated by the plan, and makes the result an assumed one.
        const stated = COMBINING.includes(a.op) ? premisesOf(a) : [];
        out.assumptions = [...(out.assumptions || []), ...stated];
        const assumed = out.assumptions.length > 0 || read.some((m) => m.assumed);
        Object.assign(result, out, { status: assumed ? "assumed" : "computed",
          assumptions: [...out.assumptions, ...read.filter((m) => m.assumed && !out.assumptions.some((x) => x.name === m.ref)).map((m) => ({ name: m.ref, value: valuesOf(m).at(-1) ?? null, unit: m.unit, rationale: m.rationale ?? "an assumed measure" }))],
          sources: [...new Set(read.flatMap((m) => m.sources || []))], cite: [...new Set(read.flatMap((m) => m.cite || []))] });
      } catch (error) {
        if (!(error instanceof Unavailable)) throw error;
        Object.assign(result, { status: "unavailable", reason: error.message, missing: error.missing ?? [] });
      }
    }
    result.hash = hashOf({ op: a.op, inputs: result.inputs.map((ref) => registry.get(ref) ?? ref), plan: a, measures: result.measures ?? null });
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
  `${(r.assumptions || []).length ? ` | assumes ${r.assumptions.map((a) => `${a.name}${a.value === undefined ? "" : ` = ${a.value}${a.unit ? ` ${a.unit}` : ""}`}`).join("; ")}` : ""}` +
  `${(r.boundaries || []).length ? ` | boundaries: ${r.boundaries.slice(0, 4).join("; ")}${r.boundaries.length > 4 ? "; ..." : ""}` : ""}`;

/** The analysis plan beside a pages file, or null; one that is not JSON is named in a line, without the parser's quote of its contents. */
async function readPlan(baseDir, stem) {
  try { return await readJson(path.join(baseDir, `${stem}.analysis.json`), { optional: true }); }
  catch (error) { if (error instanceof SyntaxError) throw new Error(notJson(`${stem}.analysis.json`, error)); throw error; }
}

/**
 * The analysis plan beside a pages file, run over its insight log: `{ plan,
 * results, problems }`, with `plan: null` when the deck has none. `log` is the
 * parsed `<id>.insights.json`.
 */
export async function readAnalysis(baseDir, stem, log, { alternatives = [] } = {}) {
  const plan = await readPlan(baseDir, stem);
  if (plan === null) return { plan: null, results: [], problems: [] };
  return { plan, ...runAnalyses(plan, log?.insights || [], { alternatives }) };
}

/** The players a deck declares, by name: the alternatives a comparison covers. */
export const alternativesOf = (deck) => (Array.isArray(deck?.players) ? deck.players.map((p) => (p && typeof p === "object" ? p.name : p)).filter((name) => typeof name === "string" && name.trim()) : []);

// How far the catalogue goes before it stops listing and says what it left
// out: pairs grow with the square of the measures, and a list nobody reads to
// the end hides the entries that matter.
const CATALOGUE = Object.freeze({ pairsPerInsight: 6, crossPairs: 30 });
// Units that are positions on a scale the runtime itself builds: no gap or ratio of them is a quantity.
const ordinal = (unit) => /^(rank|index)\b/.test(normalUnit(unit));

/**
 * The analyses the recorded measures allow, before the author thinks of them:
 * each a plan entry to paste (`entry`: a suggested id, the op, its inputs),
 * run, with its `status` and `finding`, and the plan's analyses that already
 * compute it (`inPlan`). The author chooses the ones the argument needs and
 * gives each its `soWhat` and `strength`; the rest are left where they are.
 *
 *   growth     every series, over the span it has values for
 *   gap, ratio two measures in one unit that run over the same axis (two
 *              percentages give a gap in points and no ratio): of one insight,
 *              any two but two percentages under different names (a margin less a
 *              load factor is no quantity); of different insights, one quantity for two
 *              populations (the same measure name) or two quantities of one
 *              population (not percentages), where they share two periods, two
 *              members, or - single values - their period. Two peer sets under
 *              one name are paired only across periods: in one period the
 *              overlap is a reconciliation, not a finding. A pair with the same
 *              numbers at every label they share is two records of one number, and
 *              is not listed (`counts.sameNumbers` says how many)
 *   rank       a measure over three or more members
 *   share      the members of a measure whose insight is a `mix`
 *   compare    the declared players on every measure that lists two of them,
 *              the measures that place the most players first
 *   threshold  every measure against a recorded standard - a single value
 *              marked `standard: true` - in its unit, in the same insight or
 *              for the same population
 *
 * `players` marks an entry whose every input is about a declared player (its
 * population names one, or two are among its members). Pairs are capped - a
 * few an insight, and the pairs across insights at a fixed number, those
 * between two declared players first - and `capped` says what was left out.
 * A scenario is not listed: it rests on assumptions only the author can state.
 */
export function analysisCatalogue(insights, { players = [], plan = null } = {}) {
  const recorded = [...(insights?.values?.() ?? insights ?? [])].filter((item) => item && !item.derived);
  const registry = measureRegistry(recorded);
  const shapeOfOwner = new Map(recorded.map((item) => [item.id, item.shape]));
  const named = (Array.isArray(players) ? players : []).map((p) => (p && typeof p === "object" ? { name: p.name, terms: [p.name, ...(Array.isArray(p.aliases) ? p.aliases : [])] } : { name: p, terms: [p] }))
    .filter((p) => typeof p.name === "string" && p.name.trim())
    .map((p) => ({ name: p.name, tests: p.terms.filter((t) => typeof t === "string" && t.trim()).map((t) => new RegExp(`(^|[^a-z0-9])${t.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`)) }));
  const playersIn = (text) => named.filter((p) => p.tests.some((test) => test.test(String(text ?? "").toLowerCase()))).map((p) => p.name);
  // The declared players a measure is about: the ones its population names, and the ones among its members.
  const about = (m) => [...new Set([...playersIn(m.population), ...(axisOf(m).kind === "members" ? axisOf(m).labels.flatMap(playersIn) : [])])];
  const involves = (m) => (axisOf(m).kind === "members" ? axisOf(m).labels.flatMap(playersIn).length >= 2 : playersIn(m.population).length > 0);
  const disclosed = (m) => axisOf(m).labels.filter((label) => at(m, label) !== null);
  const all = [...registry.values()];
  const entries = [], capped = [];
  const used = new Set();
  const idOf = (op, ...refs) => {
    const base = `C-${op}-${refs.join("-")}`.replace(/[^A-Za-z0-9_.-]+/g, "-");
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
  const add = (kind, op, measures, extra = {}) => entries.push({ kind, players: measures.every(involves), entry: { id: idOf(op, ...measures.map((m) => m.ref)), op, inputs: measures.map((m) => m.ref), ...extra } });

  for (const m of all) {
    const axis = axisOf(m), shown = disclosed(m);
    if (axis.kind === "periods" && shown.length >= 2) add("growth", "growth", [m], { ...(shown[0] === axis.labels[0] ? {} : { from: shown[0] }), ...(shown.at(-1) === axis.labels.at(-1) ? {} : { to: shown.at(-1) }) });
    if (axis.kind === "members" && shown.length >= 3 && !ordinal(m.unit) && !["mix", "bridge"].includes(shapeOfOwner.get(m.owner))) add("rank", "rank", [m]);
    if (axis.kind === "members" && shapeOfOwner.get(m.owner) === "mix" && shown.length === axis.labels.length && shown.length >= 2 && !isPercentUnit(m.unit) && !ordinal(m.unit) && valuesOf(m).every((v) => v >= 0)) add("share", "share", [m]);
  }

  // Two measures that can be set label against label without a choice.
  const sharedLabels = (a, b) => (axisOf(a).kind !== axisOf(b).kind ? -1 : axisOf(a).kind === "scalar" ? 1 : disclosed(a).filter((label) => disclosed(b).includes(label)).length);
  // Two percentages under different names - a margin and a load factor - share a unit and nothing else, whatever their populations are called.
  const unlike = (a, b) => isPercentUnit(a.unit) && isPercentUnit(b.unit) && a.name !== b.name;
  // The same numbers at every label the two share are one record written twice: their gap is zero and their ratio one, and neither is a finding.
  const close = (x, y) => Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
  const twice = (a, b) => {
    if (axisOf(a).kind === "scalar") return typeof valuesOf(a)[0] === "number" && typeof valuesOf(b)[0] === "number" && close(valuesOf(a)[0], valuesOf(b)[0]);
    const labels = disclosed(a).filter((label) => disclosed(b).includes(label));
    return labels.length > 0 && labels.every((label) => close(at(a, label), at(b, label)));
  };
  // How many entries were left out for it: the gap, and the ratio where one would have been listed.
  let sameNumbers = 0;
  const pairEntries = (kind, a, b) => {
    if (!sameUnit(a, b) || ordinal(a.unit) || unlike(a, b)) return [];
    if (twice(a, b)) { sameNumbers += isPercentUnit(a.unit) ? 1 : 2; return []; }
    return [[kind, "gap", [a, b]], ...(isPercentUnit(a.unit) ? [] : [[kind, "ratio", [a, b]]])];
  };
  // Pairs that set two declared players against each other come first, then pairs about one, then the rest.
  const rivalry = (a, b) => { const [pa, pb] = [about(a), about(b)]; return pa.length > 0 && pb.length > 0 && pa.some((name) => !pb.includes(name)) ? 0 : pa.length + pb.length > 0 ? 1 : 2; };
  const ordered = (pairs) => pairs.map(([a, b]) => ({ a, b, order: rivalry(a, b) })).sort((x, y) => x.order - y.order);
  for (const item of recorded) {
    const own = all.filter((m) => m.owner === item.id);
    const found = ordered(own.flatMap((a, i) => own.slice(i + 1).filter((b) => sharedLabels(a, b) >= 1).map((b) => [a, b]))).flatMap(({ a, b }) => pairEntries("pair", a, b));
    for (const args of found.slice(0, CATALOGUE.pairsPerInsight)) add(...args);
    if (found.length > CATALOGUE.pairsPerInsight) capped.push(`${item.id}: ${found.length - CATALOGUE.pairsPerInsight} more gaps and ratios between its ${own.length} measures are not listed (the first ${CATALOGUE.pairsPerInsight} are, pairs between two declared players first)`);
  }
  const cross = ordered(all.flatMap((a, i) => all.slice(i + 1).filter((b) => {
    if (a.owner === b.owner || !sameUnit(a, b)) return false;
    const kind = axisOf(a).kind, onePeriod = Boolean(a.period) && normalUnit(a.period) === normalUnit(b.period);
    if (kind === "scalar" ? !onePeriod : sharedLabels(a, b) < 2) return false;
    const oneName = a.name === b.name, onePopulation = normalUnit(a.population) === normalUnit(b.population);
    // One quantity for two populations, or two quantities of one population; two records of one measure are a conflict, not a pair (measures.mjs measureConflicts).
    if (oneName === onePopulation) return false;
    return oneName ? kind !== "members" || !onePeriod : !isPercentUnit(a.unit) && (kind !== "members" || onePeriod);
  }).map((b) => [a, b]))).flatMap(({ a, b }) => pairEntries("cross-pair", a, b));
  for (const args of cross.slice(0, CATALOGUE.crossPairs)) add(...args);
  if (cross.length > CATALOGUE.crossPairs) capped.push(`${cross.length - CATALOGUE.crossPairs} more gaps and ratios between measures of different insights in one unit are not listed (the first ${CATALOGUE.crossPairs} are, pairs between two declared players first)`);

  const listing = all.filter((m) => axisOf(m).kind === "members" && new Set(disclosed(m).flatMap(playersIn)).size >= 2)
    .sort((a, b) => new Set(disclosed(b).flatMap(playersIn)).size - new Set(disclosed(a).flatMap(playersIn)).size);
  const most = ANALYSIS_OPS.compare.inputs[1];
  // A compare reads so many measures: the ones that place the most players come first, and the rest make a second comparison.
  if (named.length >= 2) for (let i = 0; i < listing.length; i += most) add("compare", "compare", listing.slice(i, i + most));
  for (const limit of all.filter((m) => m.standard === true && axisOf(m).kind === "scalar"))
    for (const m of all) if (m !== limit && !m.standard && sameUnit(m, limit) && (m.owner === limit.owner || normalUnit(m.population) === normalUnit(limit.population)))
      add("threshold", "threshold", [m], { threshold: { ref: limit.ref }, ...((m.better ?? limit.better) === "down" ? { safe: "below" } : {}) });

  const refsOf = (a) => [...(a.inputs || []), ...(Array.isArray(a.over) ? a.over : []), ...(a.threshold?.ref ? [a.threshold.ref] : [])].sort().join(" ");
  const planned = (plan?.analyses || []).filter((a) => a && typeof a === "object");
  const { results } = runAnalyses({ analyses: entries.map((e) => ({ ...e.entry, soWhat: "a catalogue entry, not yet chosen", strength: "context" })) }, recorded, { alternatives: named.map((p) => p.name) });
  const listed = entries.map((e, i) => ({ ...e, status: results[i].status, finding: results[i].finding ?? null, boundaries: results[i].boundaries ?? [],
    // A compare is in the plan where one of the plan's compares reads any of the same measures; every other entry where the plan runs the same op over the same measures.
    inPlan: planned.filter((a) => a.op === e.entry.op && (e.entry.op === "compare" ? (a.inputs || []).some((ref) => e.entry.inputs.includes(ref)) : refsOf(a) === refsOf(e.entry))).map((a) => a.id) }))
    .filter((e) => e.status !== "unavailable");
  const kept = listed;
  const count = (list) => Object.fromEntries(Object.keys(ANALYSIS_OPS).map((op) => [op, list.filter((e) => e.entry.op === op).length]).filter(([, n]) => n));
  return { entries: kept, capped,
    counts: { entries: kept.length, byOp: count(kept), inPlan: kept.filter((e) => e.inPlan.length).length, aboutPlayers: kept.filter((e) => e.players).length, cannotRun: entries.length - listed.length, ...(sameNumbers ? { sameNumbers } : {}) } };
}

/**
 * What the draft's summary says of the catalogue, or null: said only when the
 * measures allow analyses about the declared players - other than the
 * comparison the spine already requires - and the plan runs none of them.
 */
export function catalogueHint(insights, { players = [], plan = null, stem = "<id>" } = {}) {
  const { entries } = analysisCatalogue(insights, { players, plan });
  const candidates = entries.filter((e) => e.players && e.entry.op !== "compare");
  if (!candidates.length || candidates.some((e) => e.inPlan.length)) return null;
  return `the measures allow ${candidates.length} analys${candidates.length === 1 ? "is" : "es"} about the declared players that the plan does not run (${candidates.slice(0, 3).map((e) => `${e.entry.op} of ${e.entry.inputs.join(" and ")}`).join("; ")}${candidates.length > 3 ? "; ..." : ""}): \`node runtime/analysis.mjs ${stem}.pages.json --catalogue\` lists each as a plan entry with its finding`;
}

const USAGE = "Usage: analysis.mjs <id>.pages.json [--catalogue]";

async function main(argv) {
  const { values, positionals: [file] } = parseCli(argv, { catalogue: { type: "boolean" } }, { usage: USAGE });
  if (!file) throw new UsageError(USAGE);
  // Only the deck-level keys are read here, so the file is read as written:
  // an analysis runs while the sections (its parts, pages-file.mjs) are still being authored.
  const doc = await readJson(path.resolve(file));
  const dir = path.dirname(path.resolve(file)), stem = doc.deck?.id ?? path.basename(file).replace(/\.pages\.json$/, "");
  let log;
  try { log = await readInsightLog(dir, stem); } catch (error) { console.error(error.message); return EXIT.refused; }
  if (!log) { console.error(`${stem}.insights.json is not beside the pages file: the analyses run over its measures`); return EXIT.refused; }
  // A log this command runs over is one the pages compile over: it is held to the compile's own reading of it, here, first.
  const unread = insightLogRefusal(log.insights || []);
  if (unread) { console.error(`${unread}\nThe analyses run over the log author-deck.mjs compiles the pages over, so it is refused here for what the compile would refuse it for.`); return EXIT.refused; }
  if (values.catalogue) {
    // The analyses the measures allow, whether or not a plan exists yet: an invalid plan is still read for what it already runs.
    let written;
    try { written = await readPlan(dir, stem); } catch (error) { console.error(error.message); return EXIT.refused; }
    const { entries, capped, counts } = analysisCatalogue(log.insights || [], { players: doc.deck?.players, plan: written });
    console.log(JSON.stringify({ catalogue: counts, capped, entries: entries.map((e) => ({ entry: e.entry, kind: e.kind, status: e.status, finding: e.finding, ...(e.boundaries.length ? { boundaries: e.boundaries } : {}), ...(e.players ? { players: true } : {}), inPlan: e.inPlan })) }, null, 1));
    return EXIT.ok;
  }
  let analysed;
  try { analysed = await readAnalysis(dir, stem, log, { alternatives: alternativesOf(doc.deck) }); } catch (error) { console.error(error.message); return EXIT.refused; }
  const { plan, results, problems } = analysed;
  if (!plan) { console.error(`${stem}.analysis.json is not beside the pages file: write the analyses to run - ${Object.entries(ANALYSIS_OPS).map(([op, about]) => `${op} (${about.does})`).join("; ")}`); return EXIT.refused; }
  if (problems.length) { console.error(`The analysis plan is not valid:\n- ${problems.join("\n- ")}`); return EXIT.refused; }
  await writeJson(path.join(dir, `${stem}.analysis-results.json`), { schema: "professional-slides.analysis-results/v1", id: stem, results });
  console.log(JSON.stringify({ results: `${stem}.analysis-results.json`, computed: results.filter((r) => r.status === "computed").length, assumed: results.filter((r) => r.status === "assumed").length,
    unavailable: results.filter((r) => r.status === "unavailable").map((r) => `${r.id}: ${r.reason}`), lines: results.map(analysisLine) }, null, 1));
  return EXIT.ok;
}

if (isMain(import.meta.url)) runCli(main);
