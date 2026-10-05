// The measures an insight records: what was measured, in which unit, for whom
// and when, with the numbers themselves.
//
// An insight's `finding` and `calculation` are sentences. A sentence cannot be
// checked against the chart drawn from it, joined to another record, or
// subtracted from one: a page titled on one measure can carry a chart of another
// and every check that reads sentences passes it. A measure is the same
// evidence as data - `unit`, `population`, the `periods` or `members` it runs
// over, and its `values` - so the runtime can compute with it (analysis.mjs)
// and hold each exhibit to the measure it says it plots
// (gates/dependency_gates.mjs).
//
//   "measures": {
//     "cash":   { "unit": "GBP m", "population": "the subject", "periods": ["FY24", "FY25", "FY26"], "values": [42.9, 49.7, 54.9] },
//     "margin": { "unit": "%", "population": "the peer set", "period": "latest reported year", "members": ["A", "B"], "values": [15.0, null],
//                 "unavailable": { "B": "reports in another currency at group level" }, "boundaries": { "A": "fiscal year to March" } }
//   }
//
// A measure is named `<insight id>/<measure name>` wherever it is referred to.
// It may carry its own `cite` (keys of the pages file's `sources` registry) and
// `sources` where the insight draws on several records and this number on one:
// a page's source line is derived from the measures it shows.
//
// A log extracted by several workers at once is assembled from parts:
//
//   { "schema": "professional-slides.insights/v1", "include": ["insights/subject.json", "insights/peers.json"], "insights": [...] }
//
// Each part is `{ "insights": [...] }` beside the log (paths relative to it).
// Each part is a file in the log's folder or under it; one outside it is
// refused. The parts are merged in the order listed, after the log's own
// insights; an id recorded twice - across the parts, or twice in one file - is
// refused with both places, and two records of one measure are reported
// (measureConflicts).
import path from "node:path";
import { readJson } from "./cli.mjs";
import { inside, notJson } from "./pages-file.mjs";
import { SHAPES, breadthProblem } from "./evidence.mjs";
import { textWords } from "./text-contract.mjs";

// Shapes whose evidence is numbers: an insight of one of these records its measures.
const MEASURED_SHAPES = Object.freeze(["series", "peer-set", "mix", "measure-pair", "bridge", "fact"]);
const NAME = /^[A-Za-z][A-Za-z0-9_.-]*$/;
const POLARITIES = ["up", "down"];

/** `owner/name` split into its insight (or analysis) id and its measure name, or null. */
export function parseRef(ref) {
  const at = typeof ref === "string" ? ref.indexOf("/") : -1;
  if (at <= 0 || at === ref.length - 1) return null;
  return { owner: ref.slice(0, at), name: ref.slice(at + 1) };
}

/** A unit as it is compared: case, spacing and a trailing full stop do not make two units. */
export const normalUnit = (unit) => { const key = String(unit ?? ""); if (!NORMAL_UNITS.has(key)) NORMAL_UNITS.set(key, key.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "").trim()); return NORMAL_UNITS.get(key); };
// A deck has a few dozen units and sets every printed number against every measure: each unit is read once.
const NORMAL_UNITS = new Map(), PERCENT_UNITS = new Map();

// A percentage wherever the unit says so: "%", "margin %", "share (%)", "per cent", "percent of seats", "percentage points", "pp".
const PERCENT_WORD = /%|\bper ?cent\b|\bpercentage|\bpp\b|\bppts?\b/;
/**
 * Is the unit a percentage or percentage points: a share or a rate, whose
 * change is read in points and which is applied as a fraction. It is one
 * where what is measured is a percentage ("% a period" is; "m per %" is a
 * quantity for each point, and is not).
 */
export function isPercentUnit(unit) {
  const key = String(unit ?? "");
  if (!PERCENT_UNITS.has(key)) { const { num, den } = factorsOf(normalUnit(unit)); PERCENT_UNITS.set(key, num.some((factor) => PERCENT_WORD.test(factor)) && !den.some((factor) => PERCENT_WORD.test(factor))); }
  return PERCENT_UNITS.get(key);
}


/** Is the unit a bare ratio, fraction or multiple: a number that a hundred times over is a percentage. */
export const isRatioUnit = (unit) => /^(ratio|fraction|proportion|multiple|times|x)\b/.test(normalUnit(unit));

// A unit as its factors: "x per y per z" is x over y and z, "x a year" is x
// over year, and a unit this module composed ("x x y") is its two numerators.
// A unit that says nothing is measured ("ratio") has no factor.
function factorsOf(unit) {
  let text = String(unit ?? "").trim().replace(/\.$/, "");
  const den = [];
  const rate = text.match(/^(.*\S)\s+an?\s+(\w+)$/i);
  if (rate) { text = rate[1]; den.push(rate[2]); }
  // "per cent" is a unit's name, not a division.
  const PER = /\s+per\s+(?!cent\b)/i, LEADING = /^per\s+(?!cent\b)/i;
  const [head, ...rest] = LEADING.test(text) ? ["", ...text.replace(LEADING, "").split(PER)] : text.split(PER);
  const num = head.split(/\s+x\s+/).map((f) => f.trim()).filter((f) => f && normalUnit(f) !== "ratio");
  return { num, den: [...rest.map((f) => f.trim()).filter(Boolean), ...den] };
}

/**
 * The unit of a product of measures over other measures, with what cancels
 * cancelled: clinics times (m per clinic) is m, x over x is a ratio.
 * `{ unit, simple, scale }`: `simple` is false where more than one factor is
 * left above or below the line - a unit nobody would say, which the caller
 * reports rather than prints as if it were one. With `fractions`, a
 * percentage is applied as the fraction it is (46% of 140 m is 64.4 m): it
 * leaves the unit, and `scale` is what the value is multiplied by.
 */
export function composeUnit(multiplied, divided = [], { fractions = false } = {}) {
  let num = [], den = [], scale = 1;
  for (const [units, flip] of [[multiplied, false], [divided, true]]) for (const unit of units) {
    const f = factorsOf(unit);
    (flip ? den : num).push(...f.num);
    (flip ? num : den).push(...f.den);
  }
  if (fractions) {
    scale = 0.01 ** (num.filter(isPercentUnit).length - den.filter(isPercentUnit).length);
    num = num.filter((f) => !isPercentUnit(f)); den = den.filter((f) => !isPercentUnit(f));
  }
  for (const f of [...num]) {
    const i = den.findIndex((d) => normalUnit(d) === normalUnit(f));
    if (i >= 0) { den.splice(i, 1); num.splice(num.indexOf(f), 1); }
  }
  const unit = !num.length && !den.length ? "ratio" : `${num.join(" x ")}${den.length ? `${num.length ? " " : ""}per ${den.join(" per ")}` : ""}`;
  return { unit, simple: num.length <= 1 && den.length <= 1, scale };
}

/** The axis a measure runs over: its periods, its members, or neither (one value). */
export function axisOf(measure) {
  if (Array.isArray(measure?.periods)) return { kind: "periods", labels: measure.periods.map(String) };
  if (Array.isArray(measure?.members)) return { kind: "members", labels: measure.members.map(String) };
  return { kind: "scalar", labels: [] };
}

/** A measure's numbers in axis order; a scalar measure's one `value` as a list of one. */
export const valuesOf = (measure) => (Array.isArray(measure?.values) ? measure.values : measure?.value === undefined ? [] : [measure.value]);

const finite = (value) => typeof value === "number" && Number.isFinite(value);

/** Every problem with one insight's `measures`, as sentences. */
export function measureProblems(insight) {
  const id = insight?.id ?? "?";
  const measures = insight?.measures;
  if (measures === undefined) return [];
  if (!measures || typeof measures !== "object" || Array.isArray(measures)) return [`${id}: \`measures\` is { name: { unit, population, periods | members | period, values | value } }`];
  const problems = [];
  // What a measure is computed from is the runtime's to say (analysis.mjs), never the log's.
  if (insight.derived !== undefined || insight.inputs !== undefined) problems.push(`${id}: \`derived\` and \`inputs\` belong to analyses the runtime computed; a recorded insight carries neither`);
  for (const [name, m] of Object.entries(measures)) {
    const at = `${id}/${name}`;
    if (m && typeof m === "object" && m.from !== undefined) problems.push(`${at}: \`from\` is set by the runtime on a computed measure; a recorded measure carries none`);
    if (!NAME.test(name)) problems.push(`${at}: a measure's name is letters, digits, dots, dashes and underscores, starting with a letter`);
    if (!m || typeof m !== "object" || Array.isArray(m)) { problems.push(`${at}: a measure is { unit, population, periods | members | period, values | value }`); continue; }
    if (typeof m.unit !== "string" || !m.unit.trim()) problems.push(`${at}: say the \`unit\` the numbers are in ("GBP m", "%", "months", "journeys m")`);
    if (typeof m.population !== "string" || !m.population.trim()) problems.push(`${at}: say the \`population\` measured - the entity, set or scope the numbers describe`);
    if (Array.isArray(m.periods) && Array.isArray(m.members)) problems.push(`${at}: a measure runs over \`periods\` or over \`members\`, not both - record the second axis as another measure`);
    const axis = axisOf(m);
    if (axis.kind !== "periods" && (typeof m.period !== "string" || !m.period.trim())) problems.push(`${at}: say the \`period\` the numbers are for (a series lists its \`periods\`)`);
    if (new Set(axis.labels).size !== axis.labels.length) problems.push(`${at}: a ${axis.kind === "periods" ? "period" : "member"} is listed twice`);
    const values = valuesOf(m);
    if (axis.kind === "scalar" ? values.length !== 1 : values.length !== axis.labels.length)
      problems.push(`${at}: ${axis.kind === "scalar" ? "a measure with no axis carries one `value`" : `${axis.labels.length} ${axis.kind} need ${axis.labels.length} \`values\` (it has ${values.length})`}`);
    const unavailable = m.unavailable && typeof m.unavailable === "object" ? m.unavailable : {};
    values.forEach((value, i) => {
      const label = axis.labels[i] ?? "value";
      if (value === null) { if (typeof unavailable[label] !== "string" || !unavailable[label].trim()) problems.push(`${at}: ${label} is null - say why in \`unavailable: { "${label}": "..." }\`, so the gap is a disclosed one`); }
      else if (!finite(value)) problems.push(`${at}: ${label} is ${JSON.stringify(value)}; a value is a number, or null with its reason in \`unavailable\``);
    });
    if (m.better !== undefined && !POLARITIES.includes(m.better)) problems.push(`${at}: \`better\` is "up" or "down" - the direction that is good news for this measure`);
    if (m.standard !== undefined && (m.standard !== true || axis.kind !== "scalar")) problems.push(`${at}: \`standard\` is true on a single value that is a limit, target or covenant other measures are tested against, or left out`);
    // A measure may be cited on its own, where its insight draws on several sources and this number on one of them.
    for (const field of ["cite", "sources"]) if (m[field] !== undefined && !(Array.isArray(m[field]) && m[field].length && m[field].every((entry) => typeof entry === "string" && entry.trim())))
      problems.push(`${at}: \`${field}\` on a measure is a list of ${field === "cite" ? "keys of the pages file's `sources` registry" : "source files"} - the ones this number comes from, where the insight draws on more - or left out, and the insight's own apply`);
    if (m.assumed !== undefined && m.assumed !== true) problems.push(`${at}: \`assumed\` is true for a number that is an assumption rather than a record, or left out`);
    if (m.assumed === true && (typeof m.rationale !== "string" || m.rationale.trim().split(/\s+/).length < 4)) problems.push(`${at}: an assumed measure says why that number in \`rationale\``);
  }
  return problems;
}

/** The ids of the number-bearing insights that record no measures. */
export function unmeasuredInsights(insights) {
  return [...(insights?.values?.() ?? insights ?? [])].filter((item) => !item?.derived && MEASURED_SHAPES.includes(item?.shape) && SHAPES[item.shape]
    && !(item.measures && typeof item.measures === "object" && Object.keys(item.measures).length)).map((item) => item.id ?? "?");
}

/** Does any insight of the log record measures: the log then holds every page to them. */
export const hasMeasures = (insights) => [...(insights?.values?.() ?? insights ?? [])].some((item) => item?.measures && typeof item.measures === "object" && Object.keys(item.measures).length > 0);

/**
 * Every measure of the insight log (and of the analyses computed from it, which
 * arrive as derived insights), keyed `owner/name`. Each entry carries its
 * source files and citation keys - the measure's own `sources` and `cite`
 * where it records them, otherwise what its insight says for all its measures
 * - so a check reading one measure needs nothing else, and a page that shows
 * one measure of an insight drawn from several sources cites that measure's.
 */
export function measureRegistry(insights) {
  const registry = new Map();
  for (const item of insights?.values?.() ?? insights ?? []) {
    if (!item?.measures || typeof item.measures !== "object" || Array.isArray(item.measures)) continue;
    for (const [name, m] of Object.entries(item.measures)) {
      if (!m || typeof m !== "object") continue;
      registry.set(`${item.id}/${name}`, { ...m, ref: `${item.id}/${name}`, owner: item.id, name,
        sources: m.sources ?? item.sources ?? [], cite: m.cite ?? item.cite ?? [], inputs: item.derived ? (Array.isArray(m.from) ? m.from : item.inputs ?? []) : [], derived: Boolean(item.derived), assumed: Boolean(m.assumed || item.status === "assumed") });
    }
  }
  return registry;
}

const key = (text) => String(text ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
const decimals = (value) => (String(value).split(".")[1] ?? "").length;
// Two records of one number agree when the finer one rounds to the coarser: 53.22 and 53.2 are one figure, 53.2 and 41.8 are two.
const agree = (a, b) => { const d = Math.min(decimals(a), decimals(b)); return Number(a.toFixed(d)) === Number(b.toFixed(d)); };

/**
 * Where the log records one measure twice, read from its structure alone. Two
 * measures of different insights are the same measure when they share a name,
 * a population and a unit; they are set label against label - a period of a
 * series, a member in the measure's period, a single value in its period:
 *
 *   contradiction  the two hold values at one label that are not roundings of one number
 *   precision      the two hold one number at different precision
 *   duplicate      the two hold the same values at every label they share
 *
 * Measures of one insight never conflict (their names differ). What the
 * structure does not say is not detected - these are the check's limits:
 *
 *   - one quantity under two measure names ("revenue" and "sales")
 *   - one population spelled two ways ("Harbour" and "Harbour Credit Union")
 *   - one quantity in two scales ("GBP m" and "GBP bn"): the units differ
 *   - one period under two labels ("FY25" and "FY2025")
 *   - an entity's own record against its row in a peer set: the populations
 *     differ (the entity, the set)
 *
 * Each is `{ kind, refs: [a, b], at: [{ label, values: [x, y], labels: [inA, inB] }], where: [fileA, fileB] }`:
 * `label` is the label the two were compared under, `labels` the period or
 * member each record writes it as.
 */
export function measureConflicts(insights) {
  const groups = new Map();
  for (const item of insights?.values?.() ?? insights ?? []) {
    if (!item || item.derived || !item.measures || typeof item.measures !== "object" || Array.isArray(item.measures)) continue;
    for (const [name, m] of Object.entries(item.measures)) {
      if (!m || typeof m !== "object") continue;
      const group = `${key(name)}|${key(m.population)}|${normalUnit(m.unit)}`;
      groups.set(group, [...(groups.get(group) || []), { ref: `${item.id}/${name}`, item, cells: comparedCells(m), part: item.part ?? null }]);
    }
  }
  const out = [];
  for (const records of groups.values()) for (const [i, a] of records.entries()) for (const b of records.slice(i + 1)) {
    // One insight's measures have different names; the same id met twice is two records, and they are compared.
    if (a.item === b.item) continue;
    const held = (record, label) => record.cells.get(label).value;
    const shared = [...a.cells.keys()].filter((label) => b.cells.has(label) && typeof held(a, label) === "number" && typeof held(b, label) === "number");
    if (!shared.length) continue;
    // Each cell with the label each record writes it under (`labels`; null for a single value): what a page that states it names.
    const cellsAt = (labels) => labels.map((label) => ({ label, values: [held(a, label), held(b, label)], labels: [a.cells.get(label).label, b.cells.get(label).label] }));
    const apart = shared.filter((label) => !agree(held(a, label), held(b, label)));
    const rounded = shared.filter((label) => held(a, label) !== held(b, label) && !apart.includes(label));
    out.push({ kind: apart.length ? "contradiction" : rounded.length ? "precision" : "duplicate", refs: [a.ref, b.ref], at: cellsAt(apart.length ? apart : rounded.length ? rounded : shared), where: [a.part, b.part] });
  }
  return out;
}

// A measure's numbers by the label each is compared under - a period of a series, a member in the measure's period, a
// single value in its period - each with the label the measure itself writes (null for a single value).
function comparedCells(m) {
  const axis = axisOf(m), values = valuesOf(m);
  const labels = axis.kind === "scalar" ? [[key(m.period), null]] : axis.labels.map((label) => [axis.kind === "members" ? `${key(label)} @ ${key(m.period)}` : key(label), label]);
  return new Map(labels.map(([compared, label], i) => [compared, { label, value: values[i] ?? null }]));
}

/** Do two stated values agree: is the finer one the coarser rounded (53.22 and 53.2), as two records of one number are read. */
export const valuesAgree = (a, b) => agree(a, b);

// Words that say nothing of what a measure measures.
const QUIET_WORDS = new Set(["a", "an", "the", "of", "in", "on", "at", "by", "per", "for", "to", "and", "about", "total", "number", "count"]);
const wordsOf = (text) => new Set(String(text ?? "").normalize("NFKC").replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word && !QUIET_WORDS.has(word)));
const namesWhole = (text, name) => { const hay = ` ${[...String(text ?? "").normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u)].join(" ")} `, needle = ` ${[...String(name).normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u)].filter(Boolean).join(" ")} `; return needle.trim().length > 0 && hay.includes(needle); };

// Two measures over the same members or periods are read as one measure recorded twice once they hold one number at this
// many of the labels they share, and at half of them or more: coincidence does not give two different quantities the same
// value for three members out of five.
const TWIN_AGREE = Object.freeze({ min: 2, share: 0.5 });

/**
 * Where the log may record one quantity as two measures that measureConflicts
 * cannot pair, because their names or populations differ: the first and the
 * last of that check's limits, read as far as structure allows. Two readings:
 *
 *   twin     two measures in one unit, both over members or both over
 *            periods, that hold the same number at most of the labels they
 *            share (TWIN_AGREE) and different numbers at the rest. Whatever
 *            they are called, they are one measure recorded twice, and each
 *            label where they differ is a number the deck may state two ways.
 *   entity   a single-value measure E and a member M of a measure S over
 *            members, in one unit, where E's population names M as whole
 *            words and no other member of S, every word of S's name is a word
 *            of E's name or population ("sites" in "Northside, sites (about)"),
 *            and E says nothing S does not beyond the member and the unit -
 *            "summer visits", "active clinics" and "margin threshold"
 *            are narrower or other quantities - and the two values are not
 *            roundings of one number.
 *
 * Both are readings of structure and names, so each is a question for the
 * author, never a refusal: the two may be one quantity at two dates or on two
 * definitions. What neither sees is one quantity under two unrelated names
 * where no other value coincides ("backlog", "work in hand"), and a population
 * that does not name the member.
 *
 * Each is `{ kind, cells: [x, y], shared }`, a cell `{ ref, label, value,
 * period }` (`label` null for a single value); `shared` says, for a twin, how
 * many labels the two measures share and at how many they agree.
 */
export function measureNeighbours(insights) {
  const records = [];
  for (const item of insights?.values?.() ?? insights ?? []) {
    if (!item || item.derived || !item.measures || typeof item.measures !== "object" || Array.isArray(item.measures)) continue;
    for (const [name, m] of Object.entries(item.measures)) if (m && typeof m === "object") records.push({ ref: `${item.id}/${name}`, owner: item.id, name, m, axis: axisOf(m), values: valuesOf(m) });
  }
  const cell = (record, label) => ({ ref: record.ref, label, value: label === null ? record.values[0] : record.values[record.axis.labels.indexOf(label)], period: record.axis.kind === "periods" ? null : record.m.period ?? null });
  const out = [];
  const axed = records.filter((r) => r.axis.kind !== "scalar");
  for (const [i, a] of axed.entries()) for (const b of axed.slice(i + 1)) {
    // Measures of one insight are different quantities by construction: its author named them apart.
    if (a.owner === b.owner || a.axis.kind !== b.axis.kind || normalUnit(a.m.unit) !== normalUnit(b.m.unit)) continue;
    const shared = a.axis.labels.filter((label) => b.axis.labels.includes(label) && typeof cell(a, label).value === "number" && typeof cell(b, label).value === "number");
    const same = shared.filter((label) => agree(cell(a, label).value, cell(b, label).value));
    if (same.length < TWIN_AGREE.min || same.length < shared.length * TWIN_AGREE.share || same.length === shared.length) continue;
    for (const label of shared.filter((item) => !same.includes(item))) out.push({ kind: "twin", cells: [cell(a, label), cell(b, label)], shared: { labels: shared.length, agree: same.length, kind: a.axis.kind } });
  }
  const single = records.filter((r) => r.axis.kind === "scalar" && typeof r.values[0] === "number");
  for (const set of records.filter((r) => r.axis.kind === "members")) {
    const what = [...wordsOf(set.name)];
    if (!what.length) continue;
    for (const one of single) {
      if (one.ref === set.ref || normalUnit(one.m.unit) !== normalUnit(set.m.unit)) continue;
      const named = set.axis.labels.filter((member) => namesWhole(one.m.population, member));
      const said = new Set([...wordsOf(one.name), ...wordsOf(one.m.population)]);
      if (named.length !== 1 || !what.every((word) => said.has(word))) continue;
      const known = new Set([...what, ...wordsOf(set.m.population), ...wordsOf(named[0]), ...wordsOf(one.m.unit)]);
      if (![...said].every((word) => known.has(word))) continue;
      const row = cell(set, named[0]);
      if (typeof row.value !== "number" || agree(one.values[0], row.value)) continue;
      out.push({ kind: "entity", cells: [cell(one, null), row] });
    }
  }
  return out;
}

/**
 * The insight log beside a pages file, with its parts merged: `{ ...log,
 * insights, parts }`, or null when there is no log. Each insight read from a
 * part carries the part's path as `part`, so a finding about it says where to
 * look. An id recorded twice is refused, with both places.
 */
export async function readInsightLog(baseDir, stem) {
  const name = `${stem}.insights.json`;
  // A file that does not parse is named in one line: the parser's message quotes the file, and is not repeated.
  const read = async (file) => { try { return await readJson(path.join(baseDir, file), { optional: true }); } catch (error) { if (error instanceof SyntaxError) throw new Error(notJson(file, error)); throw error; } };
  const log = await read(name);
  if (log === null) return null;
  // One id is one record, in one file as across the parts.
  const own = Array.isArray(log.insights) ? log.insights : [];
  const repeated = [...new Set(own.map((item) => item?.id).filter((id, i, ids) => id !== undefined && ids.indexOf(id) !== i))];
  if (repeated.length) throw new Error(`${name} records ${repeated.length === 1 ? "an insight" : "insights"} twice: ${repeated.map((id) => `${id} (entries ${own.map((item, i) => (item?.id === id ? i + 1 : null)).filter(Boolean).join(" and ")})`).join(", ")}. Keep one record of each (merge what the two say into it), or give the second its own id if it is another finding`);
  if (log.include === undefined) return log;
  if (!Array.isArray(log.include) || log.include.some((file) => typeof file !== "string" || !file.trim()))
    throw new Error(`${name}: \`include\` lists the parts of the log as paths beside it - ["insights/subject.json", "insights/peers.json"] - each a file of { "insights": [...] }`);
  const outside = log.include.filter((file) => path.isAbsolute(file) || !inside(path.resolve(baseDir), path.resolve(baseDir, file)));
  if (outside.length) throw new Error(`${name}: \`include\` names ${outside.map((file) => `"${file}"`).join(", ")}, outside the folder of the log (a link that leads out of it is outside it too): a part is a file in that folder or under it, named by a relative path`);
  const twice = log.include.filter((file, i) => log.include.findIndex((other) => path.resolve(baseDir, other) === path.resolve(baseDir, file)) !== i);
  if (twice.length) throw new Error(`${name}: \`include\` lists ${[...new Set(twice)].join(", ")} twice`);
  const insights = [...own], parts = [];
  const seen = new Map(insights.map((item) => [item?.id, name]));
  const clashes = [];
  for (const file of log.include) {
    const part = await read(file);
    if (part === null) throw new Error(`${name}: the part ${file} is not beside the log; write it, or take it out of \`include\``);
    if (!part || typeof part !== "object" || !Array.isArray(part.insights)) throw new Error(`${file}: a part of the insight log is { "insights": [...] }`);
    if (part.include !== undefined) throw new Error(`${file}: a part does not include other parts; list every part in ${name}`);
    for (const item of part.insights) {
      if (item?.id !== undefined && seen.has(item.id)) clashes.push(`${item.id} is recorded in ${seen.get(item.id)} and in ${file}`);
      else { seen.set(item?.id, file); insights.push(item && typeof item === "object" ? { ...item, part: file } : item); }
    }
    parts.push({ file, insights: part.insights.length });
  }
  if (clashes.length) throw new Error(`The parts of the insight log record ${clashes.length === 1 ? "an insight" : "insights"} twice:\n- ${clashes.join("\n- ")}\nKeep one record of each (merge what the two say into it), or give the second its own id if it is another finding`);
  return { ...log, insights, parts };
}

// How an insight is graded, and what makes a measurement a finding: one
// definition, read wherever the insight log is read (insightLogRefusal) and
// where the critic is shown it (storyline.mjs).
const INSIGHT_STRENGTHS = Object.freeze(["strong", "supporting", "context"]);
export function insightGradeProblems(item) {
  const id = item?.id ?? "?";
  return [...(INSIGHT_STRENGTHS.includes(item?.strength) ? [] : [`${id}: \`strength\` is one of ${INSIGHT_STRENGTHS.join(", ")}${item?.strength === undefined ? "" : ` (got ${JSON.stringify(item.strength)})`}`]),
    ...(typeof item?.soWhat === "string" && textWords(item.soWhat) >= 4 ? [] : [`${id}: \`soWhat\` says what follows for the decision, in a sentence`])];
}

/**
 * Why a log's insights cannot be compiled over, as the message every command
 * that reads the log refuses with, or null: its measures are well formed, each
 * insight records the shape of its data and is graded, and no chart-bearing
 * shape is too narrow to carry a page. One function, so a log the analyses run
 * over (analysis.mjs) is a log the pages compile over (author-deck.mjs
 * readInsights): the first command to read a log says everything any later
 * one would refuse it for. Each kind of problem lists every insight that has it.
 */
export function insightLogRefusal(items) {
  const measured = items.flatMap(measureProblems);
  if (measured.length) return `The insight log's measures are not valid:\n- ${measured.join("\n- ")}`;
  const unshaped = items.filter((item) => !SHAPES[item.shape]).map((item) => item.id ?? "?");
  if (unshaped.length) return `The insight log records no data shape for ${unshaped.join(", ")}: give each insight a \`shape\` - one of ${Object.keys(SHAPES).join(", ")} - so the pages can be checked against the evidence they rest on`;
  const graded = items.flatMap(insightGradeProblems);
  if (graded.length) return `The insight log's findings are not graded:\n- ${graded.join("\n- ")}`;
  // A shape is only as good as its breadth: a four-year "series" or a three-member "peer set" becomes a chart page too thin
  // to argue anything. Every narrow insight is named at once, before a page rests on it.
  const narrow = items.map(breadthProblem).filter(Boolean);
  if (narrow.length) return `The insight log's data is too narrow for ${narrow.length} insight${narrow.length === 1 ? "" : "s"}:\n- ${narrow.join("\n- ")}`;
  return null;
}
