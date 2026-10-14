// The argument reading: what the storyline critique's first pass reads beside its own checks, on the deck review's argument
// codes (review-passes.mjs ARGUMENT_CODES), item by item.
//
// On ba4 the storyline critique rated the spine 8 and closed; the deck review then rejected the deck at 5/10, and 34 of its
// findings were visible from the spine alone: "outrank" with no common measure, a record 2025 margin set against 2018 (before
// IFRS 16, with BA Holidays inside BA), North Atlantic unit revenue on the reported basis where the page's own caption said
// currency turned it negative, IAG's orders over a fleet with long-haul aircraft beside rivals flying only narrowbodies, a seat
// share across all ventures beside IAG's own share. The critic read for flow, structure and the answer up front, and it was
// never shown what a comparison across bases needs: each measure's unit, population, periods or members, its boundaries and
// basis, and the sources' dates.
//
// So the first pass now carries the records behind every page - one line per measure, the sources it cites with their dates,
// the deck's declared conventions - and a list of items: every page's title, and every comparison a page's `settles` names.
// The critic returns a verdict on each (validation refuses an answer that leaves one out), and a failing item carries its
// fix as the full replacement of the field it changes, checked here before the answer is accepted: a title that fits and
// prints only recorded values, insights and measures that exist, a declared peer set, a basis note for `boundaries`. The lead
// applies the fix word for word; the next run of the loop finds it applied and closes the item with no second reading
// (storyline.mjs closeAppliedFixes), as the self-check carries a verdict across its own replacements.
import { axisOf, valuesOf } from "./measures.mjs";
import { measurementsIn, percentUnit, states } from "./printed-numbers.mjs";
import { ARGUMENT_CODES } from "./review-passes.mjs";
import { titleErrors } from "./review-floors.mjs";
import { titleWords } from "./page-types.mjs";

/**
 * The codes an argument item fails on: the deck review's argument codes, and MISSING_EVIDENCE, the build check's code for a
 * ranked criterion with no comparative exhibit, which the reviewer keeps for the same defect read on the drawn page and which
 * the spine shows first, as a claim with no comparison among what it rests on.
 */
export const SPINE_ARGUMENT_CODES = Object.freeze({ ...ARGUMENT_CODES,
  MISSING_EVIDENCE: "the comparison or record a claim turns on is not among what the page rests on: a ranked criterion with no comparative measure, a judgement with no record behind it" });
export const ARGUMENT_VERDICTS = Object.freeze(["holds", "fails"]);
/** What a fix may replace, each field whole: the lead applies it as given. */
export const ARGUMENT_FIXES = Object.freeze({
  title: "the page's (or divider's) whole new title, inside the title limits, every number in it a value the page's measures record at that precision",
  evidence: "the page's whole new list of insights and analyses to rest on (its `evidence`), each an id in the log",
  measures: "the whole new list of measures its `settles` names (`settles.measures`), each an `<insight>/<measure>` the log records",
  peerSet: "the peer set the comparison uses: a name `conventions.peerSets` declares, or { name, members } to declare there, each member one the page's measures record",
  basis: "a basis note: { measure, at, note }, written to that measure's `boundaries[at]` in the insight log, `at` one of its periods or members",
});
const FIX_KEYS = Object.keys(ARGUMENT_FIXES);
// The least a failing item's `problem` says: which record shows the defect.
const PROBLEM_MIN = 20;
const NOTE_WORDS = 3;
// A measure over more periods than this is printed by its ends and the values a title states.
const SERIES_SHOWN = 12;
export const ARGUMENT_SEVERITY = "major";

const fmt = (v) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : "n/a");
const settlesOf = (page) => (page.settles && typeof page.settles === "object" ? page.settles : null);
const refsOfPage = (page) => [...new Set((page.measures || []).map((m) => (typeof m === "string" ? m : m.ref)).filter(Boolean))];
const isComparison = (settles, records) => {
  const refs = Array.isArray(settles?.measures) ? settles.measures : [];
  return refs.length > 1 || refs.some((ref) => records[ref]?.kind === "members");
};

/**
 * The records a fix is checked against, as data the packet keeps: every measure of the log by ref, with its unit, axis and
 * values, its boundaries and which population it covers. The validator reads these, not the log, so it judges an answer
 * against the records its critic was shown.
 */
export function argumentRecords(registry) {
  return Object.fromEntries([...registry].map(([ref, m]) => {
    const axis = axisOf(m);
    return [ref, { unit: m.unit ?? null, population: m.population ?? null, kind: axis.kind, labels: axis.labels, values: valuesOf(m),
      boundaries: m.boundaries && typeof m.boundaries === "object" ? m.boundaries : {} }];
  }));
}

// The periods or members of a measure whose recorded value a number of `text` states.
function statedBy(text, record) {
  const numbers = measurementsIn(String(text ?? ""));
  const reading = { unit: record.unit, percent: percentUnit(record.unit) };
  const at = (record.kind === "scalar" ? [null] : record.labels).map((label, i) => [label, record.values[i]]);
  return { labels: at.filter(([, v]) => typeof v === "number" && numbers.some((n) => states(n, v, reading))), numbers };
}

/** Each number a title prints that none of `refs` records at its precision, as printed. */
export function unrecordedNumbers(text, refs, records) {
  const numbers = measurementsIn(String(text ?? ""));
  return numbers.filter((n) => !refs.some((ref) => { const r = records[ref]; return r && r.values.some((v) => typeof v === "number" && states(n, v, { unit: r.unit, percent: percentUnit(r.unit) })); }))
    .map((n) => n.shown ?? String(n.n));
}

/**
 * The items the first pass returns a verdict on, in deck order: `title:<page>` for every page with a title, and
 * `compare:<page>` for every page whose `settles` sets two or more measures, or one measure's members, against each other.
 */
export function argumentItems(pages, records) {
  return pages.filter((p) => p.kind !== "carried" && String(p.title ?? "").trim()).flatMap((p) => {
    const settles = settlesOf(p);
    return [{ id: `title:${p.id}`, page: String(p.id), kind: "title", text: String(p.title) },
      ...(settles && isComparison(settles, records) ? [{ id: `compare:${p.id}`, page: String(p.id), kind: "comparison", text: String(settles.what ?? ""), measures: settles.measures }] : [])];
  });
}

// The recorded measures a computed one is computed from: an input named by ref, or the input insight's measure of the same name.
const inputsOf = (registry, ref) => { const m = registry.get(ref); return m?.derived ? (m.inputs || []).map((x) => (registry.has(x) ? x : registry.has(`${x}/${m.name}`) ? `${x}/${m.name}` : null)).filter(Boolean) : []; };

// One measure, compactly: what it counts, over what, its values, and what bounds and bases them.
function measureRecordLine(ref, m, cited) {
  const axis = axisOf(m), values = valuesOf(m), unit = m.unit ?? "";
  const pairs = axis.kind === "scalar" ? [[m.period ?? "value", values[0]]] : axis.labels.map((label, i) => [label, values[i]]);
  const said = new Set(cited.get(ref) || []);
  const shown = axis.kind === "periods" && pairs.length > SERIES_SHOWN
    ? pairs.filter(([label], i) => i === 0 || i === pairs.length - 1 || said.has(label)) : pairs;
  const valuesText = shown.map(([label, v]) => `${label} ${fmt(v)}`).join(", ") + (shown.length < pairs.length ? ` (${pairs.length} periods; ends and cited shown)` : "");
  const over = axis.kind === "scalar" ? `period ${m.period ?? "unstated"}` : axis.kind === "periods" ? `${pairs.length} periods` : `${pairs.length} members${m.period ? `, ${m.period}` : ""}`;
  const parts = [`${ref}: ${unit} | ${m.population ?? "population unstated"} | ${over}: ${valuesText}`];
  const bounds = m.boundaries && typeof m.boundaries === "object" ? Object.entries(m.boundaries) : [];
  if (bounds.length) parts.push(`boundaries: ${bounds.map(([k, v]) => `${k}: ${v}`).join("; ")}`);
  const gaps = m.unavailable && typeof m.unavailable === "object" ? Object.entries(m.unavailable) : [];
  if (gaps.length) parts.push(`unavailable: ${gaps.map(([k, v]) => `${k}: ${v}`).join("; ")}`);
  if (typeof m.computed === "string" && m.computed.trim()) parts.push(`basis: ${m.computed.trim()}`);
  if (m.assumed) parts.push(`ASSUMED: ${m.rationale ?? "no rationale recorded"}`);
  const events = m.events && typeof m.events === "object" ? Object.entries(m.events) : [];
  if (events.length) parts.push(`events: ${events.map(([k, v]) => `${k} ${v}`).join("; ")}`);
  if (m.derived && (m.inputs || []).length) parts.push(`computed from ${m.inputs.join(", ")}`);
  if ((m.cite || []).length) parts.push(`cites ${m.cite.join(", ")}`);
  else if ((m.sources || []).length) parts.push(`files ${m.sources.join(", ")}`);
  return `- ${parts.join(" | ")}`;
}

/**
 * The argument reading's packet: `{ items, lines, records, conventions, peerSets, pages }` (`pages`: each page's title and
 * the measures it rests on, which a fix is checked against). `pages` are the packet's pages (each
 * with `id`, `kind`, `title`, `settles`, `measures`, `evidence`), `registry` the log's measures (measures.mjs
 * measureRegistry), `insights` the log by id, `sources` the deck's source registry, `conventions` the deck's raw. `lines` are
 * the prompt's records: the conventions as written, each page with its items, what it rests on and what its title states,
 * each measure once, each insight's finding once, each cited source with its date.
 */
export function argumentPacket(pages, { registry, insights = new Map(), sources = {}, conventions = null }) {
  const records = argumentRecords(registry);
  const items = argumentItems(pages, records);
  const byPage = new Map();
  for (const item of items) byPage.set(item.page, [...(byPage.get(item.page) || []), item]);
  const usedRefs = new Set(), usedInsights = new Set(), cited = new Map();
  const pageLines = [], held = {};
  for (const p of pages) {
    const own = byPage.get(String(p.id));
    if (!own) continue;
    const refs = refsOfPage(p).filter((ref) => registry.has(ref));
    held[String(p.id)] = { title: String(p.title), refs, settlesRefs: Array.isArray(settlesOf(p)?.measures) ? settlesOf(p).measures : [] };
    const evidence = (p.evidence || []).map((e) => (typeof e === "string" ? e : e.id)).filter(Boolean);
    refs.forEach((ref) => usedRefs.add(ref));
    // A computed measure is read with the records it is computed from: their boundaries and sources are its own.
    refs.forEach((ref) => inputsOf(registry, ref).forEach((input) => usedRefs.add(input)));
    evidence.forEach((id) => usedInsights.add(id));
    const stated = refs.flatMap((ref) => { const { labels } = statedBy(p.title, records[ref]); if (labels.length) cited.set(ref, [...(cited.get(ref) || []), ...labels.map(([l]) => l)]); return labels.map(([label, v]) => `${ref}${label === null ? "" : `@${label}`} ${fmt(v)}`); });
    const loose = unrecordedNumbers(p.title, refs, records);
    const settles = settlesOf(p);
    // The title and the insights are on the page's line in THE SPINE: here only what that line does not say. A page that rests
    // on no measure and settles nothing has no line here, and its title item is read off its line there.
    if (!settles && !refs.length && !loose.length) continue;
    pageLines.push([`[${p.id}] ${own.map((i) => i.id).join(", ")}`,
      ...(settles ? [`settles${settles.kind ? ` (${settles.kind})` : ""}: ${settles.what ?? ""}${settles.relation ? ` | relation ${settles.relation.kind ?? ""}: ${settles.relation.reason ?? ""}` : ""}`] : []),
      ...(refs.length ? [`measures ${refs.join(", ")}`] : []), ...(stated.length ? [`title states ${stated.join("; ")}`] : []),
      ...(loose.length ? [`title prints ${loose.join(", ")}, which no measure of the page records`] : [])].join(" | "));
  }
  const insightLines = [...usedInsights].map((id) => { const item = insights.get(id); return item ? `- ${id}${item.strength ? ` [${item.strength}]` : ""}: ${item.finding ?? "(no finding)"}` : `- ${id}: NOT IN THE LOG`; });
  const measureLines = [...usedRefs].map((ref) => measureRecordLine(ref, registry.get(ref), cited));
  const keys = [...new Set([...usedRefs].flatMap((ref) => registry.get(ref)?.cite || []))];
  const sourceLines = keys.map((key) => { const s = sources?.[key]; return s ? `- ${key}: ${s.name ?? s.short ?? key}${s.retrieved ? ` (retrieved ${s.retrieved})` : ""}${s.status ? ` [${s.status}]` : ""}` : `- ${key}: NOT IN THE SOURCES REGISTRY`; });
  const peerSets = conventions?.peerSets && typeof conventions.peerSets === "object" ? conventions.peerSets : {};
  return { items, records, conventions: conventions ?? null, peerSets, pages: held,
    lines: { pages: pageLines, measures: measureLines, insights: insightLines, sources: sourceLines } };
}

/** The argument reading as the prompt prints it. */
export function argumentPrompt(argument) {
  if (!argument?.items?.length) return "";
  const codes = Object.entries(SPINE_ARGUMENT_CODES).map(([code, means]) => `- ${code}: ${means}`).join("\n");
  const fixes = Object.entries(ARGUMENT_FIXES).map(([key, means]) => `- \`${key}\`: ${means}`).join("\n");
  return `
THE ARGUMENT READING. This is the deck review's argument rubric, read now, on the records behind each page, so nothing it would reject is drawn. ${argument.items.length} items follow: every page's title (title:<id>) and every comparison a page's \`settles\` names (compare:<id>). Return \`argument\` with one entry for EVERY item, in any order: { "item": "<id>", "verdict": "holds" } or { "item", "verdict": "fails", "code", "problem", "fix" }. Validation refuses an answer that leaves an item out. An item fails when the deck review would file one of these codes on it, in these words:
${codes}
Read each title against what its page rests on: every number it prints is a recorded value (the line says which, and which it prints that no measure records); a comparison's sides share a unit, a population, a period and a basis - read the boundaries, basis and dates - or the title says how they differ; a ranking or a "more than" has a common measure across the things ranked; the set compared is the one the claim names or the conventions declare; a record the page rests on that cuts against its claim is not left out.
A failing item's \`problem\` names the records that show the defect (the measure, the period or member, the boundary). Its \`fix\` is the full replacement - the lead applies it word for word and the item closes with no second reading - one or more of:
${fixes}
A fix is checked before the answer is accepted: a title outside the limits, or printing a number the page's measures (after the fix) do not record at that precision, an id the log does not hold, an undeclared peer set or a member no measure of the page records, a basis note on a period or member its measure does not have - each refuses the whole answer. An item that holds needs nothing more. The argument items are not findings and do not count against the items cap; do not file the same defect again as a finding.

CONVENTIONS (the deck's declared subject, sections' subjects, names and peer sets, as written): ${argument.conventions ? JSON.stringify(argument.conventions) : "none declared"}

PAGES AND THEIR ITEMS (id and its items | what settles it | the measures it rests on | the values its title states; the title and insights are on the page's line in THE SPINE, and a page with no line here rests on no measure):
${argument.lines.pages.join("\n")}

MEASURE RECORDS (one line each: unit | population | periods or members: values | boundaries | basis | events | sources cited):
${argument.lines.measures.join("\n") || "- none"}

INSIGHTS THE PAGES REST ON (id [strength]: finding):
${argument.lines.insights.join("\n") || "- none"}

SOURCES CITED (key: name, with its date, and when retrieved):
${argument.lines.sources.join("\n") || "- none cited by key"}
`;
}

const ITEM_ID = /^(?:title|compare):/;
/**
 * Every reason an answer's `argument` would be refused against the packet's items: an item left out or answered twice, an id
 * the packet does not hold, a failing item with no code of the rubric, no problem or no fix, and each fix checked as the lead
 * will apply it - `limits`, `dividers` and `sectionFits` as the storyline's own retitle check reads them (review-floors.mjs
 * titleErrors), `records` the log's measures, `insightIds` the log's insights and analyses, `peerSets` the declared sets.
 */
export function argumentErrors(answer, { items, records = {}, insightIds = null, peerSets = {}, limits = null, dividers = [], sectionFits = null, pages = {} }) {
  if (!items?.length) return answer === undefined || (Array.isArray(answer) && !answer.length) ? [] : ["`argument` answers the first pass's argument items, and this packet has none: leave it out"];
  if (!Array.isArray(answer)) return [`\`argument\` is missing: one verdict for each of the ${items.length} argument items (title:<id>, compare:<id>) - "holds", or "fails" with its code, problem and fix`];
  const errors = [], byId = new Map(items.map((item) => [item.id, item])), seen = new Set();
  answer.forEach((entry, i) => {
    const at = `argument[${i}]${entry?.item ? ` (${entry.item})` : ""}`;
    if (!entry || typeof entry !== "object") { errors.push(`${at}: an entry is { item, verdict, code?, problem?, fix? }`); return; }
    const item = byId.get(entry.item);
    if (!item) { errors.push(`${at}: ${ITEM_ID.test(String(entry.item)) ? "no such item in this packet" : "`item` names an item by its id, title:<page> or compare:<page>"}`); return; }
    if (seen.has(item.id)) { errors.push(`${at}: ${item.id} is answered twice`); return; }
    seen.add(item.id);
    if (!ARGUMENT_VERDICTS.includes(entry.verdict)) { errors.push(`${at}: verdict is "holds" or "fails"`); return; }
    if (entry.verdict === "holds") { if (entry.fix !== undefined || entry.code !== undefined) errors.push(`${at}: an item that holds carries no code and no fix - say "fails" where something needs fixing`); return; }
    if (!Object.hasOwn(SPINE_ARGUMENT_CODES, entry.code)) errors.push(`${at}: a failing item carries the code the deck review would file, one of ${Object.keys(SPINE_ARGUMENT_CODES).join(", ")}`);
    if (typeof entry.problem !== "string" || entry.problem.trim().length < PROBLEM_MIN) errors.push(`${at}: \`problem\` names the records that show the defect - the measure, the period or member, the boundary`);
    errors.push(...fixErrors(entry.fix, item, at, { records, insightIds, peerSets, limits, dividers, sectionFits, page: pages[item.page] ?? null }));
  });
  const missing = items.filter((item) => !seen.has(item.id)).map((item) => item.id);
  if (missing.length) errors.push(`\`argument\` leaves out ${missing.length} of the ${items.length} items (${missing.slice(0, 12).join(", ")}${missing.length > 12 ? ", ..." : ""}): every item gets a verdict, "holds" where nothing is wrong`);
  return errors;
}

/** The refs a page rests on once `fix` is applied: its measures, with `settles.measures` replaced where the fix replaces it. */
const refsAfter = (fix, page) => [...new Set([...(page?.refs || []).filter((ref) => !(page?.settlesRefs || []).includes(ref) || !Array.isArray(fix?.measures)), ...(Array.isArray(fix?.measures) ? fix.measures : [])])];

function fixErrors(fix, item, at, { records, insightIds, peerSets, limits, dividers, sectionFits, page }) {
  if (!fix || typeof fix !== "object" || Array.isArray(fix)) return [`${at}: a failing item carries \`fix\`, the full replacement - one or more of ${FIX_KEYS.join(", ")}`];
  const errors = [], extra = Object.keys(fix).filter((key) => !FIX_KEYS.includes(key));
  if (extra.length) errors.push(`${at}: fix holds ${extra.join(", ")}; a fix replaces one or more of ${FIX_KEYS.join(", ")}`);
  if (!FIX_KEYS.some((key) => fix[key] !== undefined)) errors.push(`${at}: fix replaces nothing - give one or more of ${FIX_KEYS.join(", ")}, each whole`);
  const refs = refsAfter(fix, page);
  if (fix.title !== undefined) {
    const title = typeof fix.title === "string" ? fix.title.trim() : "";
    if (!title) errors.push(`${at}: fix.title is the whole new title, as it will print`);
    else {
      const divider = dividers.includes(item.page);
      errors.push(...titleErrors([{ page: item.page, title }], limits, `${at}: fix.title`, { dividers, sectionFits }));
      if (!divider && limits?.title?.words?.min && titleWords(title) < limits.title.words.min) errors.push(`${at}: fix.title runs to ${titleWords(title)} words and a page title runs to ${limits.title.words.min} at least: state the finding and its comparator`);
      if (title === String(page?.title ?? "").trim()) errors.push(`${at}: fix.title is the title as it stands`);
      const loose = unrecordedNumbers(title, refs, records);
      if (loose.length) errors.push(`${at}: fix.title prints ${loose.join(", ")}, which no measure the page rests on${Array.isArray(fix.measures) ? " after the fix" : ""} records at that precision - state a recorded value at its precision, or name the measure that holds it in fix.measures`);
    }
  }
  for (const key of ["evidence", "measures"]) {
    if (fix[key] === undefined) continue;
    const list = fix[key];
    if (!Array.isArray(list) || !list.length || !list.every((id) => typeof id === "string" && id.trim())) { errors.push(`${at}: fix.${key} is the whole new list of ids`); continue; }
    const unknown = key === "evidence" ? (insightIds ? list.filter((id) => !insightIds.has(id)) : []) : list.filter((ref) => !Object.hasOwn(records, ref));
    if (unknown.length) errors.push(`${at}: fix.${key} names ${unknown.join(", ")}, which the log does not ${key === "evidence" ? "hold (an insight or analysis id)" : "record (an <insight>/<measure> ref)"}`);
  }
  if (fix.peerSet !== undefined) {
    const set = fix.peerSet;
    if (typeof set === "string") { if (!Object.hasOwn(peerSets || {}, set)) errors.push(`${at}: fix.peerSet names "${set}", which conventions.peerSets does not declare${Object.keys(peerSets || {}).length ? ` (it declares ${Object.keys(peerSets).join(", ")})` : ""} - give { name, members } to declare it`); }
    else if (!set || typeof set !== "object" || typeof set.name !== "string" || !set.name.trim() || !Array.isArray(set.members) || set.members.length < 2) errors.push(`${at}: fix.peerSet is a declared set's name, or { name, members } with two members or more`);
    else {
      const declared = peerSets?.[set.name];
      if (declared && JSON.stringify(declared) !== JSON.stringify(set.members)) errors.push(`${at}: fix.peerSet declares "${set.name}" as ${set.members.join(", ")}, and conventions.peerSets already declares it as ${declared.join(", ")}: name it alone, or give the set another name`);
      const recorded = new Set(refs.flatMap((ref) => (records[ref]?.kind === "members" ? records[ref].labels : [])));
      const outside = set.members.filter((member) => !recorded.has(member));
      if (outside.length) errors.push(`${at}: fix.peerSet names ${outside.join(", ")}, which no measure the page rests on records as a member - rest it on a measure that does (fix.measures), or leave the member out`);
    }
  }
  if (fix.basis !== undefined) {
    const b = fix.basis;
    if (!b || typeof b !== "object" || typeof b.measure !== "string" || typeof b.at !== "string" || typeof b.note !== "string") errors.push(`${at}: fix.basis is { measure, at, note }`);
    else {
      const record = records[b.measure];
      if (!record) errors.push(`${at}: fix.basis names ${b.measure}, which the log does not record`);
      else if (record.kind === "scalar" ? b.at !== "value" && b.at !== String(record.labels[0] ?? "") : !record.labels.includes(b.at)) errors.push(`${at}: fix.basis puts its note at "${b.at}", which ${b.measure} does not have - one of its ${record.kind === "scalar" ? "value" : record.labels.join(", ")}`);
      else if (String(record.boundaries?.[b.at] ?? "").trim() === b.note.trim()) errors.push(`${at}: fix.basis is the note ${b.measure} already holds at ${b.at}`);
      if (b.note.trim().split(/\s+/).length < NOTE_WORDS) errors.push(`${at}: fix.basis.note says the basis in ${NOTE_WORDS} words or more`);
    }
  }
  return errors;
}

/** The ledger items of an answer's failing argument items: each blocks, at major, until its fix is applied. */
export function argumentLedgerItems(answer) {
  return (Array.isArray(answer) ? answer : []).filter((entry) => entry?.verdict === "fails").map((entry) => {
    const page = String(entry.item).slice(String(entry.item).indexOf(":") + 1);
    return { id: entry.item, code: entry.code, dimension: "argument", scope: "page", severity: ARGUMENT_SEVERITY, pages: [page], reason: entry.problem, repair: fixWords(entry.fix), fix: entry.fix,
      ...(typeof entry.fix?.title === "string" ? { retitle: [{ page, title: entry.fix.title.trim() }] } : {}) };
  });
}

/** A fix in words, as the author is shown it beside the item. */
export function fixWords(fix) {
  if (!fix || typeof fix !== "object") return "";
  const said = [];
  if (fix.title !== undefined) said.push(`set the title to "${fix.title}"`);
  if (fix.evidence !== undefined) said.push(`rest the page on ${[].concat(fix.evidence).join(", ")} (its whole evidence list)`);
  if (fix.measures !== undefined) said.push(`set settles.measures to ${[].concat(fix.measures).join(", ")}`);
  if (fix.peerSet !== undefined) said.push(typeof fix.peerSet === "string" ? `compare on the declared peer set "${fix.peerSet}"` : `declare conventions.peerSets["${fix.peerSet?.name}"] as ${[].concat(fix.peerSet?.members || []).join(", ")} and compare on it`);
  if (fix.basis !== undefined) said.push(`add to ${fix.basis?.measure}'s boundaries at "${fix.basis?.at}": "${fix.basis?.note}"`);
  return `Apply word for word: ${said.join("; ")}.`;
}

/**
 * The pages document as it reads with each fix applied: titles, evidence and `settles.measures` written where the binding
 * reads them (a deck spec's slide, or its page type's content). A peer set and a basis note are the deck's and the log's,
 * which the binding does not read; they are checked applied by `fixApplied`.
 */
export function withArgumentFixes(spec, entries) {
  const fixed = structuredClone(spec);
  const pages = new Map([...(fixed.slides || []), ...(fixed.appendix || [])].map((s) => [String(s.id), s]));
  for (const entry of entries) {
    const page = pages.get(String(entry.pages?.[0])), fix = entry.fix;
    if (!page || !fix) continue;
    const content = page.pageType?.content;
    // The compiled claim is the title where the author set none (author-deck.mjs): it moves with it.
    if (typeof fix.title === "string") { if (content && content.claim === page.title) content.claim = fix.title.trim(); page.title = fix.title.trim(); }
    if (Array.isArray(fix.evidence)) { if (content) content.evidence = [...fix.evidence]; else page.evidence = [...fix.evidence]; }
    if (Array.isArray(fix.measures)) {
      const holder = content?.settles ? content : page.settles ? page : content ?? page;
      holder.settles = { ...(holder.settles || {}), measures: [...fix.measures] };
    }
  }
  return fixed;
}

const sameSet = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x) => b.includes(x));
/**
 * Whether an item's fix stands applied word for word in the spec and the log as they are now: the title as given, the
 * evidence and `settles.measures` lists as given, the peer set declared with its members, the basis note in `boundaries`.
 */
export function fixApplied(entry, spec, registry) {
  const fix = entry?.fix;
  if (!fix) return false;
  const page = [...(spec.slides || []), ...(spec.appendix || [])].find((s) => String(s.id) === String(entry.pages?.[0]));
  if (!page) return false;
  const content = page.pageType?.content ?? {};
  if (typeof fix.title === "string" && String(page.title ?? "").trim() !== fix.title.trim()) return false;
  if (Array.isArray(fix.evidence) && !sameSet(content.evidence ?? page.evidence, fix.evidence)) return false;
  if (Array.isArray(fix.measures) && !sameSet((content.settles ?? page.settles)?.measures, fix.measures)) return false;
  if (fix.peerSet !== undefined) {
    const sets = (spec.conventions ?? spec.deck?.conventions)?.peerSets ?? {};
    const name = typeof fix.peerSet === "string" ? fix.peerSet : fix.peerSet?.name;
    if (!Object.hasOwn(sets, name) || (typeof fix.peerSet === "object" && !sameSet(sets[name], fix.peerSet.members))) return false;
  }
  if (fix.basis !== undefined) {
    const m = registry.get(fix.basis.measure);
    if (!m || String(m.boundaries?.[fix.basis.at] ?? "").trim() !== String(fix.basis.note).trim()) return false;
  }
  return true;
}
