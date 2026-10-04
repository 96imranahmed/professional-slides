// Binding: a page names the measure and the runtime writes the numbers.
//
// The evidence contract first asked the author to type an exhibit's numbers
// again - its categories, values and unit - beside a `basis` naming the measure
// they came from, and then checked the copy against the record. Most refusals
// of a real run were that check catching a retyped number, and the numbers
// typed into sentences, metrics and table cells were not read at all. A page
// can instead name the measure and leave the numbers to the runtime:
//
//   "exhibit": { "type": "chart.line", "heading": "Loan book at year end", "series": [{ "measure": "i-loans/loans", "name": "Loans" }] }
//   "exhibit": { "series": [{ "measure": ["i-crews/on-shift", "A-crews/path"], "name": "Crews" }], "select": { "from": "FY22" } }
//   "exhibit": { "series": [{ "measure": "i-calls/answered" }, { "measure": "i-calls/target", "role": "context", "relevance": "..." }] }
//   "metrics": [{ "measure": "A-ocf/percent", "format": "+0.0%", "label": "Operating cash flow" }]
//   "title": "Loans grew {{A-loans/percent | 0%}} in seven years to {{i-loans/loans@FY26}} million"
//
// - A bound exhibit takes its `categories`, each series' `values`, its `unit`
//   and its `basis` from the measures its series name. `select` narrows the
//   axis: `from` / `to` or `periods` over time, `members` (a subset, in the
//   order written) and `order` ("descending" or "ascending" by the first
//   series) over a peer set. A series naming a recorded measure and then a
//   scenario's path is drawn as one line, and the run of assumed periods is
//   bracketed on the chart.
// - A bound metric (a strip's `metrics`, a hero's `kpi`, a row block's
//   `metric`, an item of a fact grid) takes its `value` from one number of a
//   measure, printed in its `format`.
// - A token `{{<measure>[@<period or member>] | <format> | <modifier>}}` in
//   any text of the page is replaced by that number. Braces round anything
//   that is not a measure reference (`{{client}}`) are the author's own text
//   and are left as written.
//
// A number the runtime prints is held to the rule a typed one is
// (printed-numbers.mjs): the format keeps two significant figures of the
// value (a percentage, one decimal place), a scale the format names is the
// unit's scale (whole units where it names none) with exactly the modifier
// between them, and `x100` prints a ratio or a fraction as a percentage and
// nothing else. A format that
// would misstate its value is a binding the runtime refuses, with the format
// that states it.
//
// What rests on an assumption is said where it is shown: a joined series'
// assumed run is bracketed, a metric's sublabel says "assumed", and a chart of
// an assumed peer set or an assumed rule gets a note line - each unless the
// author's own words already say so. The assumed measures a page shows, and
// the tokens printed without their sign (`abs`), are recorded on the binding
// (`bound.assumed`, `bound.unsigned`) for the critic's and the reviewer's notes.
//
// Binding runs before the page is compiled, so everything after it reads an
// ordinary typed page; the dependency gate does not re-check what the runtime
// wrote, and reads every number that is still typed.
import { cellText, isTable, plottedValues, resultCells, rowCells } from "./evidence.mjs";
import { axisOf, isPercentUnit, isRatioUnit, measureRegistry, normalUnit, parseRef, valuesOf } from "./measures.mjs";
import { decimalsNeeded, leadingScale, matches, measurementsIn, unitScale } from "./printed-numbers.mjs";
import { registered } from "./errors.mjs";

export const BINDING_CODES = Object.freeze({
  BINDING_UNRESOLVED: "an exhibit, a metric or a `{{...}}` token names a measure the runtime cannot bind: one the insight log does not hold, one from an insight the page does not rest on, or one whose axis, unit or format cannot fill what names it",
  NUMBER_UNTRACED: "a number typed on the page that is no value of any measure of the insights the page rests on",
});

const TOKEN = /\{\{([^{}]*)\}\}/g;
// What stands between the braces is a token where it names a measure - `<insight id>/<measure>`, with a period or member
// after `@` - ahead of any `|`. Other braces are the author's own text.
const REFERENCE = /^[^\s/@|]+\/[^\s/@|]+(?:\s*@.*)?$/;
const isReference = (inner) => REFERENCE.test(String(inner).split("|")[0].trim());
// The author's own words say a figure is assumed where they state it: "assumed", "an assumption", "assumes 3% a year".
// A negation is not a statement of it - "audited, not assumed", "no assumption", "rather than assumed", "unassumed" - so
// the word is read with the three words before it in its clause, and one of them a negation leaves the runtime's mark to be drawn.
const NEGATION = /^(?:not|no|never|nor|neither|without|cannot|non|rather|instead|\w+n't)$/i;
const saysAssumed = (text) => String(text ?? "").split(/[.,;:!?()"]|\s[—–-]\s/).some((clause) => { const words = clause.split(/[^\p{L}']+/u).filter(Boolean);
  return words.some((word, at) => /^assum/i.test(word) && !words.slice(Math.max(0, at - 3), at).some((before) => NEGATION.test(before))); });
// Sign, a literal before the digits, the digits (with a thousands separator where `0,0`), the decimal places, a literal after.
const PATTERN = /^(\+)?([^0+]*)(0(?:,0)?)(?:\.(0+))?([^]*)$/;
const MODIFIER = /^(?:abs|[/x]\s*1(?:0+|e\d+))$/;
// Keys that say what a page rests on or how it is built: none is text the reader sees, so none carries a token.
const UNREAD = new Set(["id", "type", "form", "kind", "evidence", "settles", "basis", "measure", "format", "select", "source", "icon", "why"]);
const ORDERS = ["descending", "ascending"];

/** Does a page write a number by reference: a `measure` on an exhibit, series, metric or item, or a `{{...}}` token. */
const refers = (page) => { const text = JSON.stringify(page); return [...text.matchAll(TOKEN)].some(([, inner]) => isReference(inner)) || /"measure"\s*:/.test(text); };

/** `text` with every token taken out: what is left is what the author typed. */
export const withoutTokens = (text) => String(text ?? "").replace(TOKEN, (token, inner) => (isReference(inner) ? " " : token));

/**
 * A page with a number standing wherever a token stands: what the compiler can
 * check of a page whose references do not all bind yet. Nothing of it is drawn.
 */
export function withPlaceholders(page) {
  const fill = (node) => (typeof node === "string" ? node.replace(TOKEN, (token, inner) => (isReference(inner) ? "0" : token))
    : Array.isArray(node) ? node.map(fill) : node && typeof node === "object" ? Object.fromEntries(Object.entries(node).map(([key, value]) => [key, fill(value)])) : node);
  return fill(page);
}

/**
 * A format read: `{ sign, prefix, grouped, decimals, suffix, abs, factor, modifiers }`, or
 * a sentence saying what is wrong with it. `"+0.0%"`, `"CHF 0.0bn | /1000"`,
 * `"0,0"`, `"0.0% | abs"`.
 */
export function readFormat(format) {
  const [pattern = "", ...modifiers] = String(format ?? "").split("|").map((part) => part.trim());
  const read = { sign: false, prefix: "", grouped: false, decimals: null, suffix: "", abs: false, factor: 1, modifiers: modifiers.filter(Boolean) };
  if (pattern) {
    const m = PATTERN.exec(pattern);
    if (!m) return `the format "${pattern}" has no number in it: write the digits as 0, 0.0 or 0,0 with what is printed round them ("+0.0%", "CHF 0.0bn", "0,0")`;
    if (/^[\d.,]/.test(m[5])) return `the format "${pattern}" writes its digits as 0, 0.0 (one 0 for each decimal place) or 0,0 (with a thousands separator); "${m[3]}${m[4] ? `.${m[4]}` : ""}${m[5]}" is none of them`;
    Object.assign(read, { sign: Boolean(m[1]), prefix: m[2], grouped: m[3] === "0,0", decimals: (m[4] || "").length, suffix: m[5] });
  }
  for (const modifier of modifiers.filter(Boolean)) {
    if (!MODIFIER.test(modifier)) return `the format modifier "${modifier}" is not one of abs (the size without its sign), /1000 or x100 (a power of ten, to print a record kept in millions as billions or a ratio as a percentage)`;
    if (modifier === "abs") read.abs = true;
    else read.factor *= modifier[0] === "/" ? 1 / Number(modifier.slice(1)) : Number(modifier.slice(1));
  }
  return read;
}

/** The digits `format` prints for a value, unsigned: at its decimal places, or with no pattern to one decimal place at most. */
const digitsOf = (value, format) => { const scaled = Math.abs(value * format.factor); return format.decimals === null ? String(Math.round(scaled * 10) / 10) : scaled.toFixed(format.decimals); };

/** A recorded value as `format` prints it; an undisclosed one prints as n/a. With no pattern, the number to one decimal place at most. */
export function renderValue(value, format) {
  if (value === null || value === undefined) return "n/a";
  const scaled = (format.abs ? Math.abs(value) : value) * format.factor;
  const fixed = digitsOf(value, format);
  const [whole, fraction] = fixed.split(".");
  const digits = `${format.grouped ? Number(whole).toLocaleString("en-US") : whole}${fraction ? `.${fraction}` : ""}`;
  // A value that rounds to zero prints no sign: "-0.0" says nothing true.
  const sign = Number(fixed) === 0 ? "" : scaled < 0 ? "-" : format.sign ? "+" : "";
  return `${sign}${format.prefix}${digits}${format.suffix}`;
}

const sameFactor = (a, b) => Math.abs(a / b - 1) < 1e-9;
const modifierFor = (factor) => (sameFactor(factor, 1) ? null : factor < 1 ? `/${Math.round(1 / factor)}` : `x${Math.round(factor)}`);
const patternOf = (format, decimals, modifiers = format.modifiers) => [`${format.sign ? "+" : ""}${format.prefix}${format.grouped ? "0,0" : "0"}${decimals ? `.${"0".repeat(decimals)}` : ""}${format.suffix}`, ...modifiers].join(" | ");

/**
 * What is wrong with printing `value` of `measure` in `format`, as the end of
 * a sentence, or null where the printed number states the value. `following`
 * is the text set after a token, where the scale may be typed ("... million").
 *
 * - A percentage is printed as recorded: no modifier scales it.
 * - `x100` prints a ratio or a fraction as a percentage; it is refused on any other unit.
 * - Where the printed number names a scale, the modifier is exactly the factor between the unit's scale and it; a unit
 *   that names no scale is whole units (printed-numbers.mjs unitScale), so "0.0m" on a count of employees needs `/1000000`.
 * - The digits printed keep the value, by the rule a typed number is held to (printed-numbers.mjs matches).
 */
function misprint(measure, value, format, following = "") {
  if (value === null || value === undefined) return null;
  const { unit, ref } = measure, percent = isPercentUnit(unit);
  const scaling = format.modifiers.filter((modifier) => modifier !== "abs");
  const unscaled = format.modifiers.filter((modifier) => modifier === "abs");
  if (percent && scaling.length) return `scales ${ref} by "${scaling.join(" | ")}", and ${ref} is recorded in ${unit}: a percentage is printed as it is recorded - write "${patternOf(format, decimalsNeeded(value, { percent }), unscaled)}" (x100 prints a ratio or a fraction as a percentage)`;
  if (sameFactor(format.factor, 100) && !isRatioUnit(unit)) return `multiplies ${ref} by 100, and ${ref} is recorded in ${unit}: x100 prints a ratio or a fraction as a percentage and nothing else - leave the modifier out, or record the measure in the unit the page prints`;
  const kept = unitScale(unit), said = leadingScale(format.suffix) ?? leadingScale(following);
  if (kept && said && !sameFactor(format.factor, kept / said.factor)) {
    const needed = modifierFor(kept / said.factor);
    const whole = kept === 1 ? `, which names no scale and so is in whole units (if "${said.word}" is meant as the unit itself and not as a scale, record the measure in the unit the page prints)` : "";
    return `prints ${ref} as "${said.word}"${scaling.length ? ` with "${scaling.join(" | ")}"` : ""}, and ${ref} is recorded in ${unit}${whole}: ${needed ? `the modifier between the two scales is "${needed}"` : "the two are one scale, so no modifier scales it"} - write "${patternOf(format, format.decimals ?? 1, [...(needed ? [needed] : []), ...unscaled])}"`;
  }
  const digits = digitsOf(value, format), decimals = (digits.split(".")[1] || "").length, scaled = Math.abs(value * format.factor);
  if (matches(Number(digits), scaled, { decimals, percent })) return null;
  return `prints ${renderValue(value, format)} for ${value} ${unit}${scaling.length ? ` (${Math.round(scaled * 1e6) / 1e6} once scaled)` : ""}: a printed number keeps two significant figures of the value it states${percent ? " - a percentage, one decimal place" : ""}. The format "${patternOf(format, decimalsNeeded(scaled, { percent }))}" states it`;
}

/**
 * A pages document with every reference written out: `{ doc, findings, bound }`.
 * `doc` is the document the compiler and the gates read - a page that binds
 * nothing is the author's own object, and a page whose references cannot all
 * be bound is left as written and named in `findings`. `bound.filled` holds
 * the exhibits and metrics whose numbers the runtime wrote, `bound.shown` the
 * measures each exhibit or metric states through tokens, `bound.printed` the
 * measures each page's tokens print, `bound.assumed` the assumed measures each
 * page shows (with where each is said on the page), `bound.unsigned` the
 * negative values each page prints without their sign, `bound.failed` the
 * ids of the pages left unbound, and `bound.attempted` each such page with
 * the references that did bind written out. `insights` is the Map by id author-deck reads.
 */
export function bindDeck(doc, insights) {
  const registry = measureRegistry(insights);
  const bound = { filled: new WeakSet(), shown: new WeakMap(), typed: new WeakMap(), printed: new WeakMap(), assumed: new WeakMap(), unsigned: new WeakMap(), named: new WeakMap(), attempted: new WeakMap(), failed: new Set() };
  const findings = [];
  const bindAll = (list, offset = 0) => (Array.isArray(list) ? list : []).map((page, index) => {
    // A typed page that shows an assumed measure is read too: the assumption is said on it as on a bound one.
    if (!page || typeof page !== "object" || !page.type || !(refers(page) || showsAssumed(page, registry))) return page;
    const id = page.id ?? `page-${offset + index + 1}`;
    const copy = structuredClone(page);
    const problems = bindPage(copy, registry, bound);
    if (!problems.length) return copy;
    bound.failed.add(id);
    bound.attempted.set(page, copy);
    for (const problem of problems) findings.push({ code: registered(BINDING_CODES, "BINDING_UNRESOLVED"), id, severity: "blocker", measured: problem.refs, repair: `${id}: ${problem.message}` });
    return page;
  });
  const pages = bindAll(doc?.pages);
  const appendix = Array.isArray(doc?.appendix) ? bindAll(doc.appendix, pages.length) : undefined;
  return { doc: { ...doc, pages, ...(appendix ? { appendix } : {}) }, findings, bound };
}

/** One page's references written out in place; the problems with the ones that cannot be, as `[{ message, refs }]`. */
function bindPage(page, registry, bound) {
  // One problem for each thing wrong, however many references share it: twelve tokens of an insight the page does not rest on are one finding.
  const problems = new Map();
  const evidence = Array.isArray(page.evidence) ? page.evidence : [];
  const fail = (message, refs = [], key = message) => { const seen = problems.get(key); if (seen) seen.count += 1; else problems.set(key, { message, refs, count: 1 }); return null; };
  /** The measure a reference names, held to the page's evidence; null with the problem recorded. */
  const measureOf = (ref, what) => {
    const measure = registry.get(ref);
    if (!measure) return fail(`${what} names ${JSON.stringify(ref)}, which the insight log's measures do not hold${parseRef(String(ref)) ? "" : " - a measure is named `<insight id>/<measure>`"}${registry.size ? "" : " (no insight log with measures is beside the pages file)"}`, [ref], `unknown ${ref}`);
    if (!evidence.includes(measure.owner)) return fail(`${what} names a measure of ${measure.owner}, which the page does not name in \`evidence\`: a page rests on the insights its numbers come from - name it there, or name a measure the page does rest on`, [ref], `unrested ${measure.owner}`);
    return measure;
  };
  /** One number of a measure: `<ref>` for a measure of one value, `<ref>@<label>` for one period or member of a longer one. */
  const valueOf = (reference, what) => {
    const text = String(reference ?? "").trim(), at = text.indexOf("@");
    const ref = at < 0 ? text : text.slice(0, at).trim(), label = at < 0 ? null : text.slice(at + 1).trim();
    const measure = measureOf(ref, what);
    if (!measure) return null;
    const axis = axisOf(measure);
    if (axis.kind === "scalar") return label === null ? { ref, measure, value: valuesOf(measure)[0] ?? null } : fail(`${what} asks for ${ref} at "${label}", and ${ref} is one value with no periods or members: write ${ref} alone`, [ref]);
    if (label === null) return fail(`${what} names ${ref}, which runs over ${axis.labels.length} ${axis.labels.length === 1 ? axis.kind.slice(0, -1) : axis.kind}: say which one - \`${ref}@${axis.labels.at(-1)}\` (${axis.labels.slice(0, 8).join(", ")}${axis.labels.length > 8 ? ", ..." : ""})`, [ref]);
    const index = axis.labels.indexOf(label);
    if (index < 0) return fail(`${what} asks for ${ref} at "${label}", which it does not run over (${axis.labels.slice(0, 12).join(", ")}${axis.labels.length > 12 ? ", ..." : ""})`, [ref]);
    return { ref, measure, value: valuesOf(measure)[index] ?? null };
  };
  const formatOf = (format, what) => { const read = readFormat(format); return typeof read === "string" ? fail(`${what}: ${read}`) : read; };
  /** The number as the page prints it, or null with the problem recorded where the format would misstate it. */
  const printOf = (found, format, what, following) => {
    const wrong = misprint(found.measure, found.value, format, following);
    if (wrong) return fail(`${what} ${wrong}`, [found.ref]);
    const shown = renderValue(found.value, format);
    if (format.abs && typeof found.value === "number" && found.value < 0) bound.unsigned.set(page, [...(bound.unsigned.get(page) ?? []), { ref: found.ref, shown, recorded: found.value }]);
    return shown;
  };
  const context = { page, bound, fail, measureOf, valueOf, formatOf, printOf };

  const exhibits = [page.exhibit, ...(Array.isArray(page.exhibits) ? page.exhibits : []), ...(Array.isArray(page.blocks) ? page.blocks.map((block) => block?.exhibit) : [])].filter((ex) => ex && typeof ex === "object");
  exhibits.forEach((ex, i) => bindExhibit(ex, typeof ex.heading === "string" && ex.heading.trim() ? `"${ex.heading.trim()}"` : `exhibit ${i + 1}`, context));
  const metrics = [...(Array.isArray(page.metrics) ? page.metrics : []), page.kpi, ...(Array.isArray(page.blocks) ? page.blocks.map((block) => block?.metric) : [])].filter((m) => m && typeof m === "object");
  metrics.forEach((metric, i) => bindFigure(metric, `metric ${i + 1}${metric.label ? ` ("${metric.label}")` : ""}`, context, true));

  // Tokens last, over what is left: each is written out where it stands, and the exhibit or metric it stands in is recorded as stating that measure.
  const owners = new Set([...exhibits, ...metrics]);
  // The exhibits that still type a measurement of their own once what the runtime wrote is set aside.
  const typing = new Set(exhibits.filter((ex) => { const typed = typedMeasurements(ex, bound.filled); if (typed.length) bound.typed.set(ex, typed); return typed.length > 0; }));
  const write = (node, key, owner, field) => {
    const value = node[key];
    if (typeof value === "string") {
      if (!value.includes("{{")) return;
      node[key] = value.replace(TOKEN, (token, inner, offset, whole) => {
        if (!isReference(inner)) return token;
        const [reference, ...format] = inner.split("|");
        const found = valueOf(reference, `the token ${token} in \`${field}\``), read = formatOf(format.join("|"), `the token ${token} in \`${field}\``);
        if (!found || !read) return token;
        const shown = printOf(found, read, `the token ${token} in \`${field}\``, whole.slice(offset + token.length));
        if (shown === null) return token;
        bound.printed.set(page, (bound.printed.get(page) ?? new Set()).add(found.ref));
        // A metric states the measure its `value` prints; a token in its label or sublabel is commentary beside it.
        if (owner && (!metrics.includes(owner) || key === "value")) bound.shown.set(owner, (bound.shown.get(owner) ?? new Set()).add(found.ref));
        return shown;
      });
    } else if (value && typeof value === "object") {
      const inside = owners.has(value) ? value : owner;
      for (const child of Array.isArray(value) ? value.keys() : Object.keys(value)) if (!UNREAD.has(child)) write(value, child, inside, Array.isArray(value) ? `${field}[${child}]` : `${field}.${child}`);
    }
  };
  for (const key of Object.keys(page)) if (!UNREAD.has(key)) write(page, key, null, key);
  // An exhibit or a metric whose numbers are all written by reference has said what it shows: its basis is the measures
  // they name. One that also types a number says which measures those are in a `basis` of its own.
  for (const item of owners) if (bound.shown.has(item) && item.basis === undefined && !typing.has(item)) item.basis = basisOf(item, [...bound.shown.get(item)]);
  if (!problems.size) markAssumed(page, { exhibits, metrics, registry, bound });
  return [...problems.values()].map((problem) => ({ refs: problem.refs, message: `${problem.message}${problem.count > 1 ? ` (and ${problem.count - 1} more reference${problem.count === 2 ? "" : "s"} on the page with the same fault)` : ""}` }));
}

/**
 * The measurements an exhibit still types once what the runtime wrote is set
 * aside - its tokens, and the figures bound by `measure` (`filled`) - as the
 * page shows them. A table and a grid of figures are read cell by cell and item by
 * item, by the reading the number trace uses (printed-numbers.mjs
 * measurementsIn): a year, a period label, an ordinal and a count in a phrase
 * are not measurements, so a table whose every measurement is a token - or a
 * fact grid whose every figure names its measure - has said what it shows, and
 * its `basis` is written from them. A cell's typed `value` (a bar's length, a
 * score) and a bare number alone in a cell are measurements the author typed.
 * Any other exhibit types one where it plots a number.
 */
function typedMeasurements(ex, filled) {
  const figure = (value) => (typeof value === "number" ? (Number.isFinite(value) ? [String(value)] : []) : measurementsIn(withoutTokens(value), true, String(value ?? "")).map((number) => number.shown));
  if (Array.isArray(ex.rows) && (isTable(ex) || ex.rows.every((row) => rowCells(row).length)))
    return ex.rows.flatMap((row) => resultCells(row).flatMap((cell) => (cell && typeof cell === "object" ? (typeof cell.value === "number" ? [String(cell.value)] : figure(cellText(cell))) : figure(cell))));
  if (Array.isArray(ex.items) && !Array.isArray(ex.series))
    return ex.items.flatMap((item) => (!item || typeof item !== "object" || filled.has(item) ? [] : Array.isArray(item.values) ? item.values.filter((value) => typeof value === "number").map(String) : item.value === undefined || item.value === null ? [] : figure(item.value)));
  const plotted = plottedValues(JSON.parse(withoutTokens(JSON.stringify(ex))));
  return plotted ? [`${plotted} plotted value${plotted === 1 ? "" : "s"}`] : [];
}

/**
 * The basis the runtime writes for what it bound: the measures, with the
 * `role` and `relevance` the author gave - in a `basis` holding only those, or
 * on the item itself, since a bound item writes no `basis` for them to sit in.
 * `roles` are the roles its series gave their own measures (`{ measure, role,
 * relevance }`): one chart can draw the claim's measure and its context.
 */
function basisOf(item, measures, roles = null) {
  const written = item.basis && typeof item.basis === "object" ? item.basis : {};
  const role = written.role ?? item.role ?? "proof", relevance = written.relevance ?? item.relevance;
  delete item.role; delete item.relevance;
  // A measure's own role - a bound series', or one the author gave in `basis.roles` - beside the item's, which is the default for the rest.
  const own = { ...(written.roles && typeof written.roles === "object" && !Array.isArray(written.roles) ? written.roles : {}), ...(roles ?? {}) };
  return { measures, role, ...(relevance !== undefined ? { relevance } : {}), ...(Object.keys(own).length ? { roles: own } : written.roles !== undefined ? { roles: written.roles } : {}) };
}

/** A metric, a hero figure, a row's metric or a fact-grid item that names its number: `value` and `basis` written from it. */
function bindFigure(item, what, { bound, fail, valueOf, formatOf, printOf }, carriesBasis) {
  if (item.measure === undefined) return;
  if (item.value !== undefined) return void fail(`${what} names its \`measure\` and types a \`value\` as well: leave \`value\` out and the runtime prints the recorded number in the \`format\``);
  const found = valueOf(item.measure, what), format = formatOf(item.format, what);
  if (!found || !format) return;
  const shown = printOf(found, format, what);
  if (shown === null) return;
  item.value = shown;
  if (carriesBasis) item.basis = basisOf(item, [found.ref]);
  delete item.measure; delete item.format;
  bound.filled.add(item);
  return found.ref;
}

// A period label as a place in time, where it reads as one: a year ("FY26", "2031", "2024-25", "CY2025") with a half,
// a quarter or a month in it ("Q3 FY25", "H1 2024", "Mar 2025"). Null where it does not.
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function periodKey(label) {
  const text = String(label).toLowerCase();
  const year = /(?:^|[^\d])(\d{4})(?!\d)/.exec(text) ?? /(?:fy|cy|['\u2019])\s?(\d{2})(?!\d)/.exec(text) ?? /^(\d{2})$/.exec(text);
  if (!year) return null;
  const rest = text.replace(year[0], " ");
  const part = /\bq([1-4])\b/.exec(rest) ? Number(/\bq([1-4])\b/.exec(rest)[1]) * 3 : /\bh([12])\b/.exec(rest) ? Number(/\bh([12])\b/.exec(rest)[1]) * 6
    : MONTHS.some((month) => new RegExp(`\\b${month}`).test(rest)) ? MONTHS.findIndex((month) => new RegExp(`\\b${month}`).test(rest)) + 1 : 0;
  return Number(year[1]) * 100 + part;
}

/**
 * The periods of several measures as one axis in time order, whatever order
 * the measures are listed in, or null where they cannot be put in one order.
 * Each measure's own list is in order; the lists are merged by the time each
 * label names where every label names one, and otherwise by the lists alone -
 * a period comes after every period any measure puts before it.
 */
function joinedPeriods(axes) {
  const labels = [...new Set(axes.flatMap((axis) => axis.labels))];
  const keys = new Map(labels.map((label) => [label, periodKey(label)]));
  const keeps = (order) => axes.every((axis) => axis.labels.every((label, i) => i === 0 || order.indexOf(axis.labels[i - 1]) < order.indexOf(label)));
  if (labels.every((label) => keys.get(label) !== null) && new Set(keys.values()).size === labels.length) {
    const sorted = [...labels].sort((a, b) => keys.get(a) - keys.get(b));
    if (keeps(sorted)) return sorted;
  }
  // By the lists alone: of the periods no remaining period must precede, the first met.
  const after = new Map(labels.map((label) => [label, new Set()]));
  for (const axis of axes) axis.labels.forEach((label, i) => { if (i) after.get(label).add(axis.labels[i - 1]); });
  const order = [], left = new Set(labels);
  while (left.size) {
    const next = [...left].find((label) => [...after.get(label)].every((before) => !left.has(before)));
    if (next === undefined) return null;
    order.push(next); left.delete(next);
  }
  return order;
}

/** The labels a series runs over and its value at each, from the one measure or the joined run of measures it names. */
function seriesOf(refs, what, { fail, measureOf }) {
  const measures = refs.map((ref) => measureOf(ref, what));
  if (measures.some((m) => !m)) return null;
  const axes = measures.map(axisOf);
  let labels = axes[0].labels;
  if (measures.length > 1) {
    if (axes.some((axis) => axis.kind !== "periods")) return fail(`${what} joins ${refs.join(" and ")}, and a join runs measures over periods end to end - a recorded series and then a scenario's path; ${refs.filter((_, i) => axes[i].kind !== "periods").join(", ")} ${axes.filter((axis) => axis.kind !== "periods").length === 1 ? "does" : "do"} not run over periods`, refs);
    if (new Set(measures.map((m) => normalUnit(m.unit))).size > 1) return fail(`${what} joins ${refs.join(" and ")}, which are in ${[...new Set(measures.map((m) => m.unit))].join(" and ")}: one line is one unit`, refs);
    // The joined axis runs in time order whatever order the measures are listed in.
    labels = joinedPeriods(axes);
    if (!labels) return fail(`${what} joins ${refs.join(" and ")}, whose periods cannot be put in one order (${axes.map((axis) => axis.labels.join(", ")).join(" | ")}): each lists its periods in time order, and the two orders disagree`, refs);
  }
  // Where two joined measures both hold a period the record is kept, whichever is listed first: an assumption never replaces a recorded value.
  const holder = (label) => { const holding = measures.filter((m, i) => axes[i].labels.includes(label)); return holding.find((m) => !m.assumed) ?? holding[0]; };
  const at = new Map(labels.map((label) => { const m = holder(label); return [label, { value: valuesOf(m)[axisOf(m).labels.indexOf(label)] ?? null, assumed: Boolean(m.assumed) }]; }));
  return { refs, measures, kind: axes[0].kind, unit: measures[0].unit, at, scalar: axes[0].kind === "scalar" ? valuesOf(measures[0])[0] ?? null : undefined };
}

/** An exhibit that names its measures - in its series, as its one `measure`, or item by item - filled from them. */
function bindExhibit(ex, what, context) {
  const { page, bound, fail } = context;
  // A fact grid's or stat list's items each name one number.
  if (Array.isArray(ex.items) && ex.items.some((item) => item && typeof item === "object" && item.measure !== undefined)) {
    const refs = ex.items.map((item, i) => (item && typeof item === "object" ? bindFigure(item, `${what}, item ${i + 1}${item.label ? ` ("${item.label}")` : ""}`, context, false) : undefined)).filter(Boolean);
    if (refs.length) bound.shown.set(ex, new Set([...(bound.shown.get(ex) ?? []), ...refs]));
  }
  const bySeries = Array.isArray(ex.series) && ex.series.some((s) => s && typeof s === "object" && s.measure !== undefined);
  if (!bySeries && ex.measure === undefined) return;
  const typed = ["categories", "labels", "values", bySeries ? "measure" : "series"].filter((key) => ex[key] !== undefined);
  if (typed.length) return void fail(`${what} names its measures and also writes ${typed.map((k) => `\`${k}\``).join(", ")}: a bound exhibit leaves ${typed.length === 1 ? "that" : "those"} out - the runtime writes the axis and the values from the measures (\`select\` narrows or orders the axis)`);
  if (ex.basis && typeof ex.basis === "object" && (ex.basis.measures !== undefined || ex.basis.measure !== undefined)) return void fail(`${what} names its measures in its series, so its \`basis\` is written from them: keep only \`role\` and \`relevance\` there (a series that is context beside the claim's own says so itself: \`{ measure, role: "context", relevance }\`)`);
  const named = bySeries ? ex.series : [{ measure: ex.measure, name: ex.heading }];
  const untyped = named.findIndex((s) => !s || typeof s !== "object" || s.measure === undefined || s.values !== undefined);
  if (untyped >= 0) return void fail(`${what}: series ${untyped + 1} ${named[untyped]?.measure === undefined ? "types its values while others name a measure" : "names a measure and types `values` as well"} - every series of a bound exhibit is { measure, name }; typed values belong in an exhibit that carries its own \`basis\``);
  const series = named.map((s, i) => seriesOf([].concat(s.measure).map(String), `${what}, series ${i + 1}`, context));
  if (series.some((s) => !s)) return;
  const refs = series.flatMap((s) => s.refs);
  const axed = series.filter((s) => s.kind !== "scalar");
  if (!axed.length) return void fail(`${what} names only measures of one value (${refs.join(", ")}): a chart needs a measure that runs over periods or members - one number is a metric, or a token in the text`, refs);
  if (new Set(axed.map((s) => s.kind)).size > 1) return void fail(`${what} sets ${axed.filter((s) => s.kind === "periods").flatMap((s) => s.refs).join(", ")} (over periods) beside ${axed.filter((s) => s.kind === "members").flatMap((s) => s.refs).join(", ")} (over members): one axis is one or the other`, refs);
  const kind = axed[0].kind;
  // The axis every series has a place on, in the first one's order: no series is drawn with a hole the record does not have.
  let labels = [...axed[0].at.keys()].filter((label) => axed.every((s) => s.at.has(label)));
  if (!labels.length) return void fail(`${what}: ${refs.join(", ")} share no ${kind === "periods" ? "period" : "member"}`, refs);
  const select = ex.select;
  if (select !== undefined) {
    if (!select || typeof select !== "object" || Array.isArray(select)) return void fail(`${what}: \`select\` is { from, to } or { periods: [...] } over time, { members: [...], order } over a peer set`);
    const unknown = Object.keys(select).filter((key) => !(kind === "periods" ? ["from", "to", "periods"] : ["members", "order"]).includes(key));
    if (unknown.length) return void fail(`${what}: \`select\` over ${kind} takes ${kind === "periods" ? "`from` and `to`, or `periods`" : "`members` and `order`"}, not ${unknown.map((k) => `\`${k}\``).join(", ")}`);
    const listed = (kind === "periods" ? select.periods : select.members);
    const asked = [...(Array.isArray(listed) ? listed : []), ...[select.from, select.to].filter((label) => label !== undefined)].map(String);
    const absent = asked.filter((label) => !labels.includes(label));
    if (absent.length) return void fail(`${what}: \`select\` asks for ${absent.join(", ")}, which ${refs.join(", ")} ${refs.length === 1 ? "does" : "do"} not all run over (${labels.slice(0, 12).join(", ")}${labels.length > 12 ? ", ..." : ""})`, refs);
    if (select.order !== undefined && !ORDERS.includes(select.order)) return void fail(`${what}: \`select.order\` is "descending" or "ascending" - the members by the first series' value`);
    if (kind === "periods") {
      // Time keeps its order whatever order the periods are listed in.
      if (Array.isArray(select.periods)) labels = labels.filter((label) => select.periods.map(String).includes(label));
      const from = select.from === undefined ? 0 : labels.indexOf(String(select.from)), to = select.to === undefined ? labels.length - 1 : labels.indexOf(String(select.to));
      if (from < 0 || to < from) return void fail(`${what}: \`select\` runs from ${select.from ?? labels[0]} to ${select.to ?? labels.at(-1)}, which is no run of the periods ${labels.join(", ")}`);
      labels = labels.slice(from, to + 1);
    } else {
      if (Array.isArray(select.members)) labels = select.members.map(String);
      if (select.order) { const value = (label) => axed[0].at.get(label).value, up = select.order === "ascending" ? 1 : -1; labels = [...labels].sort((a, b) => (value(a) === null) - (value(b) === null) || up * (value(a) - value(b))); }
    }
  }
  const indexed = page.type === "trend" && page.form === "indexed";
  const units = [...new Map(series.map((s) => [normalUnit(s.unit), s.unit])).values()];
  const perSeries = page.type === "ranking" && page.form === "aligned-bars";
  // An indexed trend is rebased by the compiler: measures in different units are what it is for.
  if (units.length > 1 && !perSeries && !indexed) return void fail(`${what} sets ${refs.join(", ")} on one scale, and they are in ${units.join(", ")}: one scale is one unit. Plot the ones that share a unit, set the others in their own exhibit, or index them (an \`index\` analysis, drawn as a trend of form "indexed")`, refs);
  if (indexed) {
    // The base of an index the runtime computed is the base of the chart; raw series are rebased by the compiler at the `indexBase` the page names.
    const bases = series.flatMap((s) => s.measures.map((m) => m.base)), rebased = bases.filter((base) => base !== undefined).map(String);
    if (rebased.length && (rebased.length < bases.length || new Set(rebased).size > 1)) return void fail(`${what} is an indexed trend, and ${refs.join(", ")} are not on one base (${rebased.length < bases.length ? "some are raw series, some already indexed" : `indexed to ${[...new Set(rebased)].join(" and ")}`}): name the measures of one \`index\` analysis, or raw series with the \`indexBase\` the runtime rebases them at`, refs);
    if (rebased.length && ex.indexBase !== undefined && String(ex.indexBase) !== rebased[0]) return void fail(`${what} is indexed at ${ex.indexBase}, and ${refs.join(", ")} ${refs.length === 1 ? "is" : "are"} already indexed to ${rebased[0]} = 100: leave \`indexBase\` out`, refs);
    if (rebased.length) ex.indexBase = rebased[0];
    else if (ex.indexBase === undefined) return void fail(`${what} is an indexed trend over ${refs.join(", ")}: name the measures of an \`index\` analysis (the base comes with them), or keep these raw series and say the \`indexBase\` period the runtime sets to 100`, refs);
  }
  // Raw series on an indexed trend are drawn as an index, which the compiler names; every other bound exhibit is drawn in its measures' unit.
  const raw = indexed && series.every((s) => s.measures.every((m) => m.base === undefined));
  const written = raw ? undefined : units[0];
  if (typeof ex.unit === "string" && ex.unit.trim() && !perSeries && (written === undefined || normalUnit(ex.unit) !== normalUnit(written)))
    return void fail(`${what} types its unit as "${ex.unit}", and ${refs.join(", ")} ${refs.length === 1 ? "is" : "are"} recorded in ${units.join(", ")}${raw ? ` and drawn as an index` : ""}: leave \`unit\` out of a bound exhibit and the runtime writes it`, refs);
  const values = series.map((s) => labels.map((label) => (s.kind === "scalar" ? s.scalar : s.at.get(label).value)));
  // The run of periods that rest on an assumption is said on the chart: bracketed above the plot, beside the recorded run.
  const assumed = labels.map((label) => axed.some((s) => s.at.get(label).assumed));
  if (kind === "periods" && assumed.some(Boolean)) {
    const first = labels[assumed.indexOf(true)];
    // What is bracketed as assumed is one run at the end of the axis: a recorded period after an assumed one would be drawn inside the bracket.
    const recordedAfter = labels.filter((label, i) => i > assumed.indexOf(true) && !assumed[i]);
    if (recordedAfter.length) return void fail(`${what}: ${labels.filter((_, i) => assumed[i] && i < labels.indexOf(recordedAfter[0])).join(", ")} rest${assumed.indexOf(true) + 1 === labels.indexOf(recordedAfter[0]) ? "s" : ""} on an assumption (${axed.flatMap((s) => s.measures).filter((m) => m.assumed).map((m) => m.ref).join(", ")}) and ${recordedAfter.join(", ")} after ${recordedAfter.length === 1 ? "is" : "are"} recorded: the assumed periods of an exhibit are one run at the end of its axis, which the runtime brackets. Narrow the axis with \`select\` to a run that ends on the assumed periods, or draw the record and the assumption as two series`, refs);
    const marked = ex.forecastFrom !== undefined ? String(ex.forecastFrom) === first : Array.isArray(ex.periods) ? ex.periods.some((period) => String(period?.from) === first) : null;
    if (marked === false) return void fail(`${what}: the values from ${first} on rest on an assumption (${axed.flatMap((s) => s.measures).filter((m) => m.assumed).map((m) => m.ref).join(", ")}), and the exhibit's own \`${ex.forecastFrom !== undefined ? "forecastFrom" : "periods"}\` does not start there: start it at ${first}, or leave it out and the runtime brackets the assumed run`, refs);
    if (marked === null) ex.periods = [...(assumed[0] ? [] : [{ from: labels[0], to: labels[assumed.indexOf(true) - 1], label: "Recorded" }]), { from: first, to: labels.at(-1), label: "Assumed" }];
  }
  // A series that says its own role says it of every measure it draws; the exhibit's role stands for the rest.
  const roles = Object.fromEntries(bySeries ? named.flatMap((s, i) => (s.role !== undefined || s.relevance !== undefined ? series[i].refs.map((ref) => [ref, { ...(s.role !== undefined ? { role: s.role } : {}), ...(s.relevance !== undefined ? { relevance: s.relevance } : {}) }]) : [])) : []);
  if (bySeries) ex.series = named.map(({ measure: _measure, role: _role, relevance: _relevance, ...rest }, i) => ({ ...rest, name: rest.name ?? series[i].measures[0].name, ...(perSeries ? { unit: rest.unit ?? series[i].unit } : {}), values: values[i] }));
  else { ex.values = values[0]; delete ex.measure; }
  // A pie or a donut names its slices in `labels`; every other chart its axis in `categories`.
  ex[!bySeries && /pie|donut/.test(String(ex.type ?? page.form ?? "")) ? "labels" : "categories"] = labels;
  if (!perSeries && written !== undefined) ex.unit = written;
  ex.basis = basisOf(ex, [...new Set(refs)], roles);
  delete ex.select;
  bound.filled.add(ex);
  // Each measure by the name its series is drawn under: what a note about it calls it.
  bound.named.set(ex, new Map(series.flatMap((s, i) => s.refs.map((ref) => [ref, bySeries ? ex.series[i].name : ex.heading ?? s.measures[0].name]))));
}

const basisRefs = (item) => (Array.isArray(item?.basis?.measures) ? item.basis.measures : typeof item?.basis?.measure === "string" ? [item.basis.measure] : []).filter((ref) => typeof ref === "string");
const exhibitsIn = (page) => [page.exhibit, ...(Array.isArray(page.exhibits) ? page.exhibits : []), ...(Array.isArray(page.blocks) ? page.blocks.map((block) => block?.exhibit) : [])].filter((ex) => ex && typeof ex === "object");
const metricsIn = (page) => [...(Array.isArray(page.metrics) ? page.metrics : []), page.kpi, ...(Array.isArray(page.blocks) ? page.blocks.map((block) => block?.metric) : [])].filter((m) => m && typeof m === "object");

/** Does a typed page declare, in a `basis`, that an exhibit or a metric of it shows an assumed measure. */
const showsAssumed = (page, registry) => [...exhibitsIn(page), ...exhibitsIn(page).flatMap((ex) => (Array.isArray(ex.items) ? ex.items : [])), ...metricsIn(page)].some((item) => basisRefs(item).some((ref) => registry.get(ref)?.assumed));

/**
 * Every assumed measure a page shows, said on the page where the author's own
 * words do not say it, and recorded (`bound.assumed`) for the notes the critic
 * and the reviewer read:
 *
 *   a metric         its sublabel says "Assumed"
 *   an exhibit       over periods with the assumed run bracketed (the runtime's
 *                    bracket, or the author's `forecastFrom` or `periods`), it is
 *                    said already; otherwise - a peer set, a rule across the plot,
 *                    a figure in a grid or a cell - the page's note line names it
 *   a token in text  nothing is drawn: the notes list it
 */
function markAssumed(page, { exhibits, metrics, registry, bound }) {
  const assumedOf = (item) => [...new Set([...basisRefs(item), ...(bound.shown.get(item) ?? [])])].filter((ref) => registry.get(ref)?.assumed);
  const record = [];
  for (const metric of metrics) {
    const refs = assumedOf(metric);
    if (!refs.length) continue;
    const said = saysAssumed(`${metric.label ?? ""} ${metric.sublabel ?? ""}`);
    if (!said) metric.sublabel = typeof metric.sublabel === "string" && metric.sublabel.trim() ? `${metric.sublabel.trim()} (assumed)` : "Assumed";
    record.push(...refs.map((ref) => ({ ref, said: "a metric's label" })));
  }
  const noted = [];
  for (const ex of exhibits) {
    const refs = assumedOf(ex);
    if (!refs.length) continue;
    const bracketed = ex.forecastFrom !== undefined || (Array.isArray(ex.periods) && ex.periods.length > 0);
    // The exhibit's own words: every text it carries - its heading, a caption, a series' name, a cell - and the page's note.
    const words = `${JSON.stringify(ex)} ${[].concat(page.note ?? []).join(" ")}`;
    for (const ref of refs) {
      const overTime = axisOf(registry.get(ref)).kind === "periods";
      if (overTime && bracketed) { record.push({ ref, said: "the bracket over the assumed periods" }); continue; }
      if (saysAssumed(words)) { record.push({ ref, said: "the exhibit's own words" }); continue; }
      // Named as the page names it: the series drawn, or the exhibit's heading. A measure's own name is the log's, not the reader's.
      noted.push(bound.named.get(ex)?.get(ref) ?? (typeof ex.heading === "string" && ex.heading.trim() ? ex.heading.trim() : null));
      record.push({ ref, said: "the page's note" });
    }
  }
  if (noted.length) {
    const names = [...new Set(noted.filter(Boolean).map(String))];
    const line = names.length === new Set(noted).size ? `Assumed, not recorded: ${names.join(", ")}.` : "Some of the figures shown rest on an assumption, not a record.";
    if (Array.isArray(page.note)) page.note = [...page.note, line];
    else page.note = typeof page.note === "string" && page.note.trim() ? `${page.note.trim().replace(/([^.!?])$/, "$1.")} ${line}` : line;
  }
  const marked = new Set(record.map((item) => item.ref));
  for (const ref of bound.printed.get(page) ?? []) if (registry.get(ref)?.assumed && !marked.has(ref)) record.push({ ref, said: null });
  if (record.length) bound.assumed.set(page, [...new Map(record.map((item) => [item.ref, { ...item, rationale: registry.get(item.ref).rationale ?? null }])).values()]);
}
