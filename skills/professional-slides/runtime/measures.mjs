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
import { SHAPES } from "./evidence.mjs";

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
export const normalUnit = (unit) => String(unit ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "").trim();

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
 * arrive as derived insights), keyed `owner/name`. Each entry carries what the
 * insight says for all its measures - its source files and citation keys - so
 * a check reading one measure needs nothing else.
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
