// The numbers a page prints and where each comes from.
//
// A page may name the measure and leave the number to the runtime (bind.mjs);
// what the author still typed is traced here to a value of a measure the
// insight log records - the measures of the insights the page rests on
// (`evidence`), or every measure in the log where it names none - and a number
// no record holds is advised (NUMBER_UNTRACED). The same reading of a page's
// typed numbers serves the checks across pages (gates/consistency_gates.mjs)
// and the citation the footer writes from the measures a page prints.
import { cellText, isTable, rowCells } from "./evidence.mjs";
import { axisOf, isRatioUnit, measureRegistry, valuesOf } from "./measures.mjs";
import { bindDeck, withoutTokens } from "./bind.mjs";
import { measurementsIn, percentUnit, states } from "./printed-numbers.mjs";

const exhibitsOf = (page) => [page.exhibit, ...(Array.isArray(page.exhibits) ? page.exhibits : []), ...(Array.isArray(page.blocks) ? page.blocks.map((block) => block?.exhibit) : [])].filter((ex) => ex && typeof ex === "object");
// Every figure a page prints as a number with its label: a strip's metrics, a hero's `kpi`, the metric at the right
// of a labelled row, and an item of a fact grid or a stat list that carries a `basis` of its own.
const itemsOf = (page) => exhibitsOf(page).flatMap((ex) => (Array.isArray(ex.items) ? ex.items : [])).filter((item) => item && typeof item === "object" && item.basis);
export const metricsOf = (page) => [...(Array.isArray(page.metrics) ? page.metrics : []), page.kpi, ...(Array.isArray(page.blocks) ? page.blocks.map((block) => block?.metric) : []), ...itemsOf(page)].filter((m) => m && typeof m === "object");
export const refsOf = (basis) => (Array.isArray(basis?.measures) ? basis.measures : typeof basis?.measure === "string" ? [basis.measure] : []).filter((ref) => typeof ref === "string");

/** The measures a measure is computed from, through every analysis between: its lineage. */
function lineage(ref, registry, seen = new Set()) {
  for (const input of registry.get(ref)?.inputs || []) if (!seen.has(input)) { seen.add(input); lineage(input, registry, seen); }
  return seen;
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

// Keys of a page that are not something it says to the reader about a number: what the page rests on and how it is
// built, and the names along an axis (a category, a column head, a series), which are labels whatever digits they hold.
const NOT_PROSE = new Set(["id", "type", "form", "kind", "commentary", "why", "adds", "evidence", "settles", "source", "basis", "measure", "format", "select", "role", "relevance",
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

/**
 * Every number typed into a page's text that no recorded value holds, as an
 * advisory NUMBER_UNTRACED for each page: traced to the measures of the
 * insights the page rests on (and what they were computed from, and the
 * assumptions they state), or to every measure the log records where the page
 * names none. `doc` is the document as authored; `insights` the Map by id
 * author-deck reads. Empty when the log records no measures.
 */
export function untracedFindings(doc, insights) {
  const registry = measureRegistry(insights);
  if (!registry.size) return [];
  const { doc: written, bound } = bindDeck(doc, insights);
  const authored = [...(doc.pages || []), ...(doc.appendix || [])];
  const out = [];
  for (const [index, page] of [...(written.pages || []), ...(written.appendix || [])].entries()) {
    if (!page || typeof page !== "object" || !page.type) continue;
    const id = page.id ?? `page-${index + 1}`;
    // A page whose references could not be bound has no numbers to hold yet: the binding's finding is its finding.
    if (bound.failed.has(id)) continue;
    const evidence = Array.isArray(page.evidence) ? page.evidence : [];
    const pool = evidence.length ? [...pagePool(page, registry),
      ...evidence.flatMap((owner) => (insights.get?.(owner)?.assumptions || []).filter((a) => typeof a?.value === "number").map((a) => ({ value: a.value, unit: a.unit })))]
      : [...registry.values()];
    const untraced = untracedNumbers(authored[index], pool);
    if (untraced.length) out.push({ code: "NUMBER_UNTRACED", id, severity: "advisory", measured: untraced.map((u) => `${u.field}: ${u.shown}`),
      repair: `${id}: ${untraced.length} typed number${untraced.length === 1 ? " is" : "s are"} no value of a measure ${evidence.length ? "the page rests on" : "the insight log records"} - ${untraced.slice(0, 8).map((u) => `${u.shown} in \`${u.field}\``).join(", ")}${untraced.length > 8 ? ", ..." : ""}. ` +
        "Print a recorded number by reference - `{{<insight id>/<measure>@<period or member> | 0.0}}` - so the runtime writes it; a number nobody recorded is a measure to add to the insight log" });
  }
  return out;
}
