// The claims of a page set out for its writer to check against the record
// before anyone else does (`author-deck.mjs <pages> --claims <ids>`): every
// text the page says, as the reader meets it, beside the findings of the
// insights it rests on, with the recorded value each number in it states and
// the room of the slot it sits in. What a sentence asserts beyond its numbers -
// a rank, a universal, a cause - is the writer's to read against those
// findings, and the self-check's after them.
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { bindDeck } from "./bind.mjs";
import { axisOf, measureRegistry } from "./measures.mjs";
import { measurementsIn } from "./printed-numbers.mjs";
import { NOT_PROSE, pagePool, statedCells } from "./gates/dependency_gates.mjs";
import { isTable, rowCells } from "./evidence.mjs";
import { textWords } from "./text-contract.mjs";
import { deckLimits, pageLimits } from "./limits.mjs";
import { TEXT_LIMITS } from "./page-types.mjs";

// Of the keys that say how a page is built, a table's column heads are read as claims: a head names the period or member its
// column holds, and a wrong one misdates every cell under it.
const HEADS = new Set(["columns"]);
// A title, subtitle, heading, divider summary, label or table cell states a claim at any length: a row label names the member
// its row is read as, a column head the period its cells hold. Any other text is a claim where it runs to three words or carries
// a number, a token, or a period or member the record holds. On ba4 the sheet left out every text under three words, and with it
// na02's row labels ("Latin America" for the record's South America) and pr13's two-line matrix cells: the first reading never
// saw them, and the second found them wrong.
const STATES_AT_ANY_LENGTH = new Set(["title", "subtitle", "heading", "summary", "label", "sublabel", "columns"]);
// A label or a figure is sized to its text as written: nothing measures its room, so a fix to one is held to the characters it has.
const LABELS = new Set(["label", "sublabel", "columns"]);
const PATH = /([^.[\]]+)|\[(\d+)\]/g;
const steps = (field) => [...String(field).matchAll(PATH)].map(([, key, index]) => (index === undefined ? key : Number(index)));
const roleOf = (field) => steps(field).filter((step) => typeof step === "string").at(-1) ?? "";
// A table's row label: an object row's `label`, or an array row's first cell (`rows[2][0]`).
const rowLabel = (route) => route.at(-1) === 0 && Number.isInteger(route.at(-2)) && route.at(-3) === "rows";

/** The value at `field` of `node` (a path as the sheet names it: `exhibit.rows[2].label`), undefined where there is none. */
export const fieldAt = (node, field) => atSteps(node, steps(field));
const atSteps = (node, route) => route.reduce((at, step) => (at && typeof at === "object" ? at[step] : undefined), node);

/**
 * Every text the author wrote on `page` that its reader reads, as `[{ field, written, figure }]`: `field` the path to it in the
 * page, `figure` where it is a figure on its own (a table cell, a tile's value). What the page rests on and how it is built are
 * not read (dependency_gates NOT_PROSE), nor a metric's `value` where its `basis` holds it to a measure; a table's column heads,
 * its row labels and each line of a cell of several lines are.
 */
function writtenTexts(page) {
  const found = [];
  const walk = (node, field, figure) => {
    if (typeof node === "string" || (typeof node === "number" && figure)) { found.push({ field, written: String(node), figure }); return; }
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach((child, i) => walk(child, `${field}[${i}]`, figure)); return; }
    const table = Array.isArray(node.rows) && (isTable(node) || node.rows.every((row) => rowCells(row).length));
    for (const [key, child] of Object.entries(node)) {
      if ((NOT_PROSE.has(key) && !HEADS.has(key)) || (key === "value" && node.basis)) continue;
      walk(child, field ? `${field}.${key}` : key, (figure && !LABELS.has(key)) || key === "value" || (key === "rows" && table));
    }
  };
  walk(page, "", false);
  return found;
}

/**
 * The room of the slot `field` sits in, `{ words?, characters?, from }`, or null where the page sets none: the title's word cap
 * (and the characters its band holds where the brief measured it), and for every other slot what the writer brief prints - the
 * slot's measured words (`slots`, author-deck slotLimits), else the page's limits block - and a label's characters as written.
 */
function slotLimit(field, text, figure, page, { rules, slots }) {
  const route = steps(field), role = roleOf(field), max = (...values) => { const held = values.filter(Number.isFinite); return held.length ? Math.min(...held) : undefined; };
  const asWritten = { characters: text.length, from: "as written" };
  const room = (words, characters, from) => (Number.isFinite(words) || Number.isFinite(characters) ? { ...(Number.isFinite(words) ? { words } : {}), ...(Number.isFinite(characters) ? { characters } : {}), from } : null);
  if (field === "title") return page.type ? room(TEXT_LIMITS.titleWords, slots?.title?.characters?.max, slots?.title ? "title cap, measured band" : "title cap")
    : room(deckLimits().sectionTitle.words.max, undefined, "divider title");
  if (!page.type) return asWritten;
  // An exhibit's heading and caption are measured by the exhibit's place among the page's exhibits (fill-guidance.mjs exhibitsOf).
  const exhibitAt = route[0] === "exhibit" ? 0 : route[0] === "exhibits" && Number.isInteger(route[1]) ? route[1] + (page.exhibit ? 1 : 0) : null;
  if (route.length === (route[0] === "exhibit" ? 2 : 3) && exhibitAt !== null && ["heading", "caption"].includes(role)) {
    const slot = slots?.[`${role} ${exhibitAt}`];
    return slot ? room(slot.words?.max, slot.characters?.max, "measured") : asWritten;
  }
  if (route.length === 1 && ["subtitle", "rail", "bar", "takeaway"].includes(role)) {
    return room(max(slots?.[role]?.words?.max, rules?.[role]?.words?.max), undefined, slots?.[role] ? "measured" : "limits") ?? asWritten;
  }
  if (route[0] === "points" && route.length <= 3) return room(max(slots?.points?.wordsEach?.max, rules?.textBlock?.words?.max), undefined, slots?.points ? "measured" : "limits");
  if (figure || LABELS.has(role) || rowLabel(route)) return asWritten;
  return room(rules?.textBlock?.words?.max, undefined, "limits") ?? asWritten;
}

/**
 * Each named page (all of them where `ids` is empty) as `{ id, title, evidence: [{ id, finding }], claims: [{ field, text,
 * written, limit, numbers }] }`: `text` as the reader reads it (tokens written out), `written` as the author wrote it, `limit`
 * the room of its slot, and `numbers` each `{ shown, states }` - the cells (`ref@label = value`) the number is a value of at
 * its printed precision, empty where it is no recorded value. A divider is read with the evidence of the pages it opens.
 * `spine` keeps the titles and the dividers' text alone (`--brief selfcheck --spine`); `slotsOf` is each page's measured
 * slots by id, as the writer brief prints them.
 */
export function claimSheet(doc, insights, ids = [], { spine = false, slotsOf = null } = {}) {
  const registry = measureRegistry(insights);
  const { doc: bound } = bindDeck(doc, insights);
  const wanted = new Set(ids);
  const authored = [...(doc.pages || []), ...(doc.appendix || [])], read = [...(bound.pages || []), ...(bound.appendix || [])];
  // The evidence a divider stands for: that of the pages it opens, up to the next divider.
  const opens = new Map();
  let divider = null;
  for (const page of authored) {
    if (page?.kind === "section" && !page.type) { divider = page; opens.set(page, []); }
    else if (divider && Array.isArray(page?.evidence)) opens.get(divider).push(...page.evidence);
  }
  return authored.map((page, at) => [page, read[at]]).filter(([page]) => (page?.type || page?.kind === "section") && (!wanted.size || wanted.has(String(page.id)))).map(([page, said]) => {
    const evidenceIds = page.type ? (Array.isArray(page.evidence) ? page.evidence : []) : [...new Set(opens.get(page) ?? [])];
    const evidence = evidenceIds.map((id) => ({ id, finding: insights.get?.(id)?.finding ?? null }));
    const pool = pagePool({ evidence: evidenceIds }, registry);
    const members = [...new Set(pool.flatMap((m) => { const axis = axisOf(m); return axis.kind === "scalar" ? [] : axis.labels.map(String); }))].filter((label) => label.length > 1);
    let rules = null;
    try { rules = page.type ? pageLimits(page.type, page.form, { commentary: page.commentary, density: doc.deck?.density }) : null; } catch { /* a type the catalogue refuses: its compile says so */ }
    const slots = slotsOf?.get?.(String(page.id)) ?? null;
    const claims = writtenTexts(page).map(({ field, written, figure }) => {
      const shown = fieldAt(said, field);
      return { field, written, figure, text: typeof shown === "string" || typeof shown === "number" ? String(shown) : written };
    }).filter(({ field, written, figure, text }) => text.trim() && (!spine || field === "title" || !page.type)
      && (STATES_AT_ANY_LENGTH.has(roleOf(field)) || figure || rowLabel(steps(field)) || textWords(text) >= 3 || /\d/.test(text) || written.includes("{{") || members.some((member) => text.includes(member))))
      .map(({ field, written, figure, text }) => ({
        field, text, written, limit: slotLimit(field, text, figure, page, { rules, slots }),
        numbers: measurementsIn(text, figure).map((number) => ({ shown: number.shown, states: statedCells(number, pool).map((cell) => `${cell.ref}${cell.label === null ? "" : `@${cell.label}`} = ${cell.value}`) })),
      }));
    return { id: page.id, title: said?.title ?? page.title, evidence, claims };
  });
}

/**
 * A page's claims as a section's self-checker read them: a verdict recorded against this hash stays current while every text
 * the sheet reads of the page - its title, sentences, cells and labels - is unchanged, so a section checked before the build
 * keeps its verdicts through it (self-check.mjs), and a changed cell or label re-opens its page.
 */
export const sheetHash = (page) => createHash("sha256").update(JSON.stringify([page.title ?? null, page.claims.map((c) => [c.field, c.text])])).digest("hex").slice(0, 16);

// Where the sheets a self-checker was shown are kept, one file a page's hash: out/self-check/sheets/<hash>.json.
const SHEETS = path.join("self-check", "sheets");

/** Keep each page of `sheet` as its checker is shown it, under its hash in `out` (the join reads them back: readSheets). */
export async function recordSheets(out, sheet) {
  const dir = path.join(out, SHEETS);
  await fs.mkdir(dir, { recursive: true });
  await Promise.all(sheet.map((page) => fs.writeFile(path.join(dir, `${sheetHash(page)}.json`),
    `${JSON.stringify({ id: page.id, title: page.title, claims: page.claims.map(({ field, text, written, limit }) => ({ field, text, written, limit })) }, null, 1)}\n`)));
}

/** The sheets kept in `out`, as a Map from hash to `{ id, title, claims }`; empty where none was kept. */
export async function readSheets(out) {
  const dir = path.join(out, SHEETS), sheets = new Map();
  for (const name of (await fs.readdir(dir).catch(() => [])).filter((entry) => /^[0-9a-f]{16}\.json$/.test(entry))) {
    try { sheets.set(name.slice(0, 16), JSON.parse(await fs.readFile(path.join(dir, name), "utf8"))); } catch { /* a file cut short is a sheet not kept */ }
  }
  return sheets;
}

/** A slot's room as a line says it: "15 words", "56 characters". */
export const roomText = (limit) => [limit.words !== undefined ? `${limit.words} word${limit.words === 1 ? "" : "s"}` : null, limit.characters !== undefined ? `${limit.characters} character${limit.characters === 1 ? "" : "s"}` : null].filter(Boolean).join(", ");

/** Does `text` fit `limit`: null where it does, else what it runs to against the room. */
export function overruns(text, limit) {
  if (!limit) return null;
  const words = textWords(String(text)), characters = String(text).length;
  if (limit.words !== undefined && words > limit.words) return `${words} words against ${limit.words}`;
  if (limit.characters !== undefined && characters > limit.characters) return `${characters} characters against ${limit.characters}`;
  return null;
}

/**
 * `doc` with each `{ slide, field, replacement }` written in place - what the pages are once the writer applies a self-check's
 * replacements word for word - and the problems whose field the page does not have, as `{ doc, missing }`.
 */
export function withReplacements(doc, problems) {
  const copy = structuredClone(doc), missing = [];
  const pages = new Map([...(copy.pages || []), ...(copy.appendix || [])].filter((page) => page && typeof page === "object").map((page) => [String(page.id), page]));
  for (const problem of problems) {
    const page = pages.get(String(problem.slide)), route = steps(problem.field ?? "");
    const holder = route.length ? atSteps(page, route.slice(0, -1)) : undefined;
    if (!holder || typeof holder !== "object" || !["string", "number"].includes(typeof holder[route.at(-1)])) { missing.push(problem); continue; }
    holder[route.at(-1)] = problem.replacement;
  }
  return { doc: copy, missing };
}

/** The sheet as lines to read: each page, its evidence findings, then each claim with the room of its slot, its text as written where tokens print its numbers, and the record behind each number - "CHECK" where a number has none. */
export function claimSheetLines(sheet) {
  return sheet.flatMap((page) => [
    `${page.id}  ${page.title}  (sheet ${sheetHash(page)})`,
    ...page.evidence.map((e) => `  evidence ${e.id}: ${e.finding ?? "(no finding recorded)"}`),
    ...page.claims.flatMap((claim) => [`  ${claim.numbers.some((n) => !n.states.length) ? "CHECK" : "ok   "} ${claim.field}: ${claim.text}`,
      ...(claim.limit ? [`        fits: ${roomText(claim.limit)} (${claim.limit.from})`] : []),
      ...(claim.written !== claim.text ? [`        as written: ${claim.written}`] : []),
      ...claim.numbers.map((n) => `        ${n.shown}: ${n.states.length ? n.states.slice(0, 3).join("; ") : "no recorded value at this precision"}`)]),
    "",
  ]);
}
