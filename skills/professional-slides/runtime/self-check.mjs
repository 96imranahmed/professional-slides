#!/usr/bin/env node
// The author's self-check, recorded from the sections' checks.
//
//   node runtime/self-check.mjs <id>.pages.json out/ [--spine "<the title-spine pass>"]
//   node runtime/self-check.mjs --validate <answer.json> <id>.pages.json
//
// Each section is self-checked once, after its last structural change (author-deck.mjs --brief selfcheck --section <part>):
// its checker reproduces the section's claims from the records and saves out/self-check/<part>.json, a verdict per page bound
// to the hash of the claims it read (claim-sheet.mjs sheetHash), and for each problem the field it is in and the field's whole
// new text. The same reader answers the questions the rules ask of the section's copy (judgements.mjs), which the brief lists
// beside the claims - those `judge.mjs --page` would stage for a reader of their own - in a `judgements` block in the judge
// answer format: one reading a line, so a line both readings mend gets one fix that passes both. A question on a line the
// answer replaces is answered of the replacement (`"on": "replacement"`).
//
// `--validate` refuses an answer that leaves a page without a verdict, a replacement past its slot or printing a number no
// record holds, a problem in a field the page does not have, a question unanswered or answered as judge.mjs would refuse it,
// or answered on the text a replacement removes - and composes every page a replacement touches with all of them in place,
// runs the page check the writer runs (author-deck.mjs checkPages), and refuses a replacement under which a page has a
// blocking finding it did not have before, with the finding's repair. All before the checker hands back. An answer that
// passes is recorded: its judgements go into <id>.judgements.json, as judge.mjs records a packet's.
//
// Delivery wants out/self-check.json bound to the build's own claim ledger (claims.mjs validateSelfCheck), which only exists
// after the build. This joins the two: a page whose claims are what its checker read, or what it read with every replacement
// applied word for word, keeps its verdict under the ledger's hash; a page changed besides, or never checked, or with a fix
// not applied, is named for another check, with the lines that changed.
//
// Exit codes (EXIT in errors.mjs): 0 every page that makes claims has a current verdict and the record is complete (with
// --validate, the answer is recorded), 2 pages or findings are still to check (with --validate, the answer is refused),
// 1 a crash or bad usage.
//
// On the BA retest the whole deck was self-checked after the build, by five readers at once: 64 problems on 41 of 95 pages,
// each a rewrite after the deck was drawn and judged, and 20 more in the rewrites. Checked per section beside the judges,
// the same problems are fixed before the build. On ba4 that first reading found about 115 problems, and still a second
// reading found 44 more and 70 of 89 pages were read again: the sheet had left out cells and labels, fixes overran their
// slots and were trimmed, and applying a checker's own fix voided its page's verdict. A replacement that fits, traces and is
// applied word for word now closes its problem, and the page keeps its verdict without a second reading.
import fs from "node:fs/promises";
import path from "node:path";
import { EXIT, UsageError, isMain, parseCli, readJson, runCli, schemaErrors, writeJson } from "./cli.mjs";
import { readPagesFileSync } from "./pages-file.mjs";
import { checkPages, loggedSources, readInsights } from "./author-deck.mjs";
import { alternativesOf } from "./analysis.mjs";
import { bindDeck } from "./bind.mjs";
import { sectionPages } from "./brief.mjs";
import { askedWithReplacements, claimSheet, overruns, readQuestions, readSheets, roomText, sheetHash, withReplacements } from "./claim-sheet.mjs";
import { findingKey, validateSelfCheck } from "./claims.mjs";
import { JUDGEMENT_KINDS, answerProblems as judgementAnswerProblems, judgementKey, judgementSession, judgementsBlockSchema, pendingRequests, readJudgementStore, verdictRecord, withJudgements, writeVerdicts } from "./judgements.mjs";

const USAGE = "Usage: self-check.mjs <id>.pages.json out/ [--spine \"<which pages the title-spine pass merged or cut, or why none>\"]\n       self-check.mjs --validate <answer.json> <id>.pages.json";
const PARTS = "self-check";
const TOKEN = "{{<insight>/<measure>@<period or member> | <format>}}";

/** The sections' answers in out/self-check/, each page's latest verdict first: a later file's verdict on a page replaces an earlier one's. */
async function readSectionChecks(out) {
  const dir = path.join(out, PARTS);
  const names = (await fs.readdir(dir).catch(() => [])).filter((name) => name.endsWith(".json")).sort();
  const parts = [];
  for (const name of names) {
    const part = await readJson(path.join(dir, name), { optional: true }).catch(() => null);
    if (part && typeof part === "object") parts.push({ name, ...part });
  }
  return parts;
}

/** A problem the writer can apply word for word: the field it is in and the field's whole new text. */
const closable = (problem) => typeof problem?.field === "string" && typeof problem?.replacement === "string";

/**
 * A page's lines now against the sheet its checker read (`checked`, kept by the brief) with each problem's replacement in
 * place: `{ changed, unapplied }`, the fields whose text is neither what was read nor its replacement, and the fields whose
 * replacement is not applied yet (they still read as checked). Both empty: the page says what the checker read, with its fixes.
 */
function linesAgainst(checked, current, problems) {
  const fixes = new Map(problems.filter(closable).map((problem) => [problem.field, problem.replacement]));
  const was = new Map(checked.claims.map((claim) => [claim.field, claim])), is = new Map(current.claims.map((claim) => [claim.field, claim]));
  const changed = [], unapplied = [];
  for (const field of new Set([...was.keys(), ...is.keys(), ...fixes.keys()])) {
    const before = was.get(field), after = is.get(field);
    if (fixes.has(field) && after?.written === fixes.get(field)) continue;
    if (fixes.has(field) && before && after?.text === before.text) unapplied.push(field);
    else if (fixes.has(field) || before?.text !== after?.text) changed.push(field);
  }
  return { changed, unapplied };
}

/**
 * The record delivery reads, from the build's ledger, the pages as they stand and the sections' answers: `{ record,
 * toCheck: [{ slide, why, lines? }], findingsOpen }`. A verdict carries over where the checker read the claims the page makes
 * now, or where the page makes them with each of the checker's replacements applied word for word (`sheets`: the sheets the
 * checkers were shown, by hash - claim-sheet.mjs readSheets); a page that differs from both is named with its lines.
 */
export function joinSelfChecks(ledger, sheet, parts, { previous = null, spine = null, sheets = new Map() } = {}) {
  const now = new Map(sheet.map((page) => [String(page.id), page]));
  // Each page's latest verdict, with the problems its own answer raised on it: a later reading's verdict supersedes an earlier one's problems.
  const verdicts = new Map();
  for (const part of parts) {
    const problems = Array.isArray(part.problems) ? part.problems : [];
    for (const [id, verdict] of Object.entries(part.pages ?? {})) verdicts.set(String(id), { verdict, problems: problems.filter((problem) => String(problem?.slide) === String(id)) });
  }
  const pages = {}, toCheck = [];
  for (const [slide, claims] of Object.entries(ledger.pageHashes ?? {})) {
    const entry = verdicts.get(slide), current = now.get(slide), sheetNow = current ? sheetHash(current) : null;
    // A verdict already bound to the build's hash stays (an earlier run of this, or the author's own record) while the page's
    // sheet is the one it was joined at: the ledger hashes a page's sentences, not its cells and labels, so a changed label
    // leaves the ledger's hash as it was and only the sheet's moves.
    const before = previous?.pages?.[slide];
    if (before?.claims === claims && before.verified === true && (before.sheet === undefined || before.sheet === sheetNow)) { pages[slide] = before; continue; }
    let why = null, lines = null;
    if (!entry) why = "never checked";
    else if (current && entry.verdict.sheet === sheetNow) {
      if (entry.problems.length || entry.verdict.verified !== true) { why = "a problem is open on it: its replacements are not applied"; lines = entry.problems.map((problem) => problem.field).filter(Boolean); }
    } else {
      const checked = sheets.get(entry.verdict.sheet);
      const read = checked && current ? linesAgainst(checked, current, entry.problems) : null;
      if (!read) why = "its claims changed since it was checked";
      else if (read.changed.length) { why = "its claims changed since it was checked"; lines = read.changed; }
      else if (read.unapplied.length || !entry.problems.every(closable)) { why = "a problem is open on it: its replacements are not applied"; lines = read.unapplied; }
      else if (!entry.problems.length && entry.verdict.verified !== true) why = "a problem is open on it: its replacements are not applied";
    }
    if (why) toCheck.push({ slide, why, ...(lines?.length ? { lines } : {}) });
    else pages[slide] = { claims, verified: true, ...(sheetNow ? { sheet: sheetNow } : {}) };
  }
  const answers = { ...(previous?.findings ?? {}), ...Object.assign({}, ...parts.map((part) => part.findings ?? {})) };
  const findingsOpen = (ledger.findings ?? []).filter((f) => typeof answers[findingKey(f)] !== "string" || answers[findingKey(f)].trim().length < 20).map(findingKey);
  const spineNote = spine ?? previous?.spine ?? (parts.map((part) => part.spine).filter((note) => typeof note === "string" && note.trim()).join(" ") || null);
  return { record: { pages, findings: answers, ...(spineNote ? { spine: spineNote } : {}) }, toCheck, findingsOpen };
}

/**
 * Every reason a section's answer would be refused, read against the pages as they stand: `{ reasons, expect }`. A page of the
 * sheet with no verdict, or one for other claims than the page's; a verdict and its problems that disagree; a problem whose
 * field the page does not have, or whose `claim` is not that field's text; and each `replacement` written in place and read as
 * the page would then read - past the room of its slot (the one the brief printed, `sheets`), printing a number no record
 * holds at its precision, or a token that does not bind. `expect` is each page's hash with its replacements applied.
 */
export function answerProblems(doc, insights, answer, { sheets = new Map() } = {}) {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return { reasons: ["the answer is not a JSON object: { \"section\", \"pages\", \"problems\" }"], expect: {} };
  const spine = answer.scope === "spine";
  const found = sectionPages(doc, answer.section && answer.section !== "deck" ? answer.section : null);
  if (found.why) return { reasons: [`"section": ${found.why}`], expect: {} };
  const ids = found.pages.map((page) => String(page.id));
  const sheet = claimSheet(doc, insights, ids, { spine });
  const byId = new Map(sheet.map((page) => [String(page.id), page]));
  const verdicts = answer.pages && typeof answer.pages === "object" ? answer.pages : {};
  const problems = Array.isArray(answer.problems) ? answer.problems : [];
  const reasons = [];
  if (answer.problems !== undefined && !Array.isArray(answer.problems)) reasons.push("\"problems\" is a list");
  for (const page of sheet) {
    const id = String(page.id), hash = sheetHash(page), verdict = verdicts[id], own = problems.filter((problem) => String(problem?.slide) === id);
    if (!verdict || typeof verdict !== "object") { reasons.push(`${id}: no verdict - record { "sheet": "${hash}", "verified": true }, or false with its problems`); continue; }
    if (verdict.sheet !== hash) reasons.push(`${id}: the verdict is for sheet ${verdict.sheet ?? "(none)"}, and the page's claims hash to ${hash} now: read the page as the brief prints it again`);
    if (typeof verdict.verified !== "boolean") reasons.push(`${id}: "verified" is true or false`);
    else if (verdict.verified && own.length) reasons.push(`${id}: verified with ${own.length} problem(s) on it - a page with a problem is "verified": false`);
    else if (!verdict.verified && !own.length) reasons.push(`${id}: not verified, and no problem names it - say what is wrong as a problem, with its replacement`);
  }
  for (const id of Object.keys(verdicts)) if (!byId.has(id)) reasons.push(`${id}: a verdict for a page this ${spine ? "spine sheet" : "section's sheet"} does not hold`);
  const usable = [];
  problems.forEach((problem, i) => {
    const at = `problem ${i + 1}${problem?.slide ? ` (${problem.slide}${problem.field ? ` ${problem.field}` : ""})` : ""}`;
    const page = byId.get(String(problem?.slide));
    if (!page) { reasons.push(`${at}: "slide" names no page of this sheet`); return; }
    const claim = page.claims.find((c) => c.field === problem.field);
    if (!claim) { reasons.push(`${at}: ${page.id} has no claim at "field" ${JSON.stringify(problem.field ?? null)} - name the field as the sheet prints it (${page.claims.slice(0, 6).map((c) => c.field).join(", ")}${page.claims.length > 6 ? ", ..." : ""})`); return; }
    if (problem.claim !== claim.text && problem.claim !== claim.written) reasons.push(`${at}: "claim" is not the field's text - copy it as the sheet prints it: ${JSON.stringify(claim.text)}`);
    if (typeof problem.record !== "string" || !problem.record.trim()) reasons.push(`${at}: "record" says what the record holds`);
    if (typeof problem.replacement !== "string" || !problem.replacement.trim()) { reasons.push(`${at}: no "replacement" - give the field's whole new text, which the writer applies word for word`); return; }
    if (problem.replacement === claim.written) { reasons.push(`${at}: the replacement is the text as written`); return; }
    usable.push({ problem, at, claim });
  });
  // The page as the writer will leave it, every replacement applied: each fixed line read as its reader will read it.
  const { doc: fixed } = withReplacements(doc, usable.map(({ problem }) => problem));
  const after = new Map(claimSheet(fixed, insights, ids, { spine }).map((page) => [String(page.id), page]));
  const unbound = new Map(bindDeck({ ...fixed, pages: [...(fixed.pages || []), ...(fixed.appendix || [])].filter((page) => usable.some(({ problem }) => String(problem.slide) === String(page?.id))), appendix: [] }, insights).findings
    .map((finding) => [String(finding.id), finding.repair]));
  for (const { problem, at, claim } of usable) {
    const slide = String(problem.slide), line = after.get(slide)?.claims.find((c) => c.field === problem.field);
    if (unbound.has(slide) && problem.replacement.includes("{{")) { reasons.push(`${at}: the replacement's tokens do not bind - ${unbound.get(slide)}`); continue; }
    if (!line) { reasons.push(`${at}: the replacement leaves nothing a reader reads at ${problem.field}`); continue; }
    const limit = sheets.get(sheetHash(byId.get(slide)))?.claims?.find((c) => c.field === problem.field)?.limit ?? claim.limit;
    const over = overruns(line.text, limit);
    if (over) reasons.push(`${at}: the replacement runs to ${over} - the slot holds ${roomText(limit)} (${limit.from}): write it to fit, the writer applies it as it stands`);
    for (const number of line.numbers.filter((n) => !n.states.length)) {
      reasons.push(`${at}: the replacement prints ${number.shown}, which no record holds at that precision - print it by token (${TOKEN}) at the record's precision, or state a value the record holds`);
    }
  }
  const expect = Object.fromEntries([...new Set(usable.map(({ problem }) => String(problem.slide)))].filter((id) => after.has(id)).map((id) => [id, sheetHash(after.get(id))]));
  // What the writer leaves once it applies them: the pages with every usable replacement in place, and each replaced line as
  // the sheet read it beside the text its replacement reads as - what the questions it answers are asked of then.
  const swaps = usable.map(({ problem, at, claim }) => ({ slide: String(problem.slide), at, claim, written: problem.replacement, to: after.get(String(problem.slide))?.claims.find((c) => c.field === problem.field)?.text ?? null }))
    .filter((swap) => swap.to !== null);
  return { reasons, expect, part: found.part, replaced: { doc: fixed, swaps } };
}

// The verdicts of a kind whose failure a replacement mends (judgement-kinds.json `fix.by: "replace"`), which a self-check does
// not give on a line it leaves standing: the line's one fix is the self-check's own replacement.
const failsByLine = (kind, verdict) => JUDGEMENT_KINDS[kind]?.fix?.by === "replace" && JUDGEMENT_KINDS[kind].fix.for.includes(verdict);
const linesOf = (swaps) => swaps.map((swap) => swap.at).join(", ");
const whereOf = (item) => (item.where ?? []).join(", ") || "the deck";

/**
 * Every reason the answer's `judgements` would be refused, read against the questions its brief listed (`questions`, kept
 * by claim-sheet.mjs recordQuestions) and the replacements the same answer makes (`swaps`): `{ reasons, verdicts, extra }`.
 * Each question is answered once, in the judge answer format, and checked as judge.mjs checks a packet's answer
 * (judgements.mjs answerProblems: a verdict of its kind, its reason, its quote words of its subject, the fields its verdict
 * needs). A question that reads a line one of the answer's problems replaces is asked again of the replacement once the
 * writer applies it, so its answer judges the replacement (`"on": "replacement"`) and is checked and recorded as that
 * question; an answer given on the line as it stands is refused, since the writer's fix leaves it reading nothing. A line
 * is mended once, so no answer carries a `replacement` of its own and none fails a question its replacement is to pass.
 * Whether a replacement moves a question is read off the line's text (claim-sheet.mjs askedWithReplacements) and settled by
 * the page check of the pages with the replacements in place (`pending`: the keys they ask that no answer judges, null where
 * no page was checked): a question the page still asks of the text as it stands is answered of it.
 * `verdicts` are the answers as the judgements file keeps them, by key; `extra` the entries keyed by no question listed,
 * which may answer a question the pages ask only with the replacements in place (extraProblems); `foreseen` the keys the
 * listed questions are asked under once the replacements are in place, which this has said all there is to say of.
 */
export function judgementProblems(questions, answer, swaps, { by = null, pending = null } = {}) {
  const reasons = [], verdicts = {}, extra = [], foreseen = new Set();
  const entries = answer?.judgements ?? [];
  if (!Array.isArray(entries)) return { reasons: ["\"judgements\" is a list: one answer for each question the brief lists"], verdicts, extra, foreseen };
  if (questions === null) {
    if (entries.length) reasons.push(`"judgements": no questions were kept for this ${answer?.scope === "spine" ? "spine reading - the spine's questions are judge.mjs --draft's" : "section: run its brief again (author-deck.mjs --brief selfcheck --section <part>), which lists them"}`);
    return { reasons, verdicts, extra, foreseen };
  }
  const staged = stagedQuestions(questions, swaps);
  for (const { asked, question } of staged.values()) if (asked) foreseen.add(question.key);
  const shape = judgementsBlockSchema(questions).items, given = new Map();
  entries.forEach((entry, i) => {
    if (!staged.has(entry?.key)) { extra.push({ entry, i }); return; }
    const { item, asked, question } = staged.get(entry.key);
    if (given.has(entry.key)) { reasons.push(`judgement ${i + 1} (${entry.key}): answered twice - one answer a question`); return; }
    given.set(entry.key, entry);
    const at = `judgement ${i + 1} (${entry.key} ${item.kind}, on ${whereOf(item)})`;
    const malformed = schemaErrors(entry, shape, at, { absentIsNull: true, enums: false });
    if (malformed.length) { reasons.push(...malformed); return; }
    if (entry.on === "replacement" && !asked) { reasons.push(`${at}: "on": "replacement", and none of your problems replaces a line this question reads - answer it of the text as it stands, "on" null`); return; }
    // Answered of the replacement, and asked of the text as it stands still: the page reads that text where the sheet did not.
    if (entry.on === "replacement" && pending?.has(item.key)) { reasons.push(`${at}: with your replacements in place the page still asks this of the text as it stands - ${JSON.stringify(item.subject)} - so answer it of that text, "on" null`); return; }
    // Answered of the line as it stands, which the page with the replacements in place no longer asks.
    const moved = asked && (pending === null || pending.has(question.key));
    if (entry.on !== "replacement" && moved) { reasons.push(`${at}: ${ofReplacement(asked)}`); return; }
    const own = entry.on === "replacement" ? question : item;
    reasons.push(...entryProblems(own, entry, at, { mine: entry.on === "replacement" ? asked.swapped : null }));
    if (Object.hasOwn(JUDGEMENT_KINDS[item.kind].verdicts, entry.verdict)) verdicts[own.key] = { ...verdictRecord(own, entry, { by, omit: OMITTED }), ...(own !== item ? { replaces: item.key } : {}) };
  });
  for (const [key, { item, asked, question }] of staged) if (!given.has(key))
    reasons.push(`${key} (${item.kind}, on ${whereOf(item)}): not answered - ${asked && (pending === null || pending.has(question.key)) ? ofReplacement(asked) : "answer every question the brief lists, once, in \"judgements\""}`);
  return { reasons, verdicts, extra, foreseen };
}

/** Each listed question as the compile asks it once the replacements are in place, by its key: itself, or asked of the replacement (`asked`). */
function stagedQuestions(questions, swaps) {
  return new Map(questions.map((item) => {
    const asked = askedWithReplacements(item, swaps);
    return [item.key, { item, asked, question: asked ? { ...item, subject: asked.subject, context: asked.context, key: judgementKey(item.kind, asked.subject, asked.context) } : item }];
  }));
}

/**
 * The answer's judgements as the page check reads them, before they are checked: each entry of a listed question with a
 * verdict its kind takes, under the key of the question it says it judges - the one asked of the replacement where it is
 * answered `on` it. The page with the replacements in place is read under them, so a rule its own reading fails is seen.
 */
export function answeredVerdicts(questions, answer, swaps) {
  const staged = stagedQuestions(questions ?? [], swaps), verdicts = {};
  for (const entry of Array.isArray(answer?.judgements) ? answer.judgements : []) {
    const { item, asked, question } = staged.get(entry?.key) ?? {};
    if (!item || !Object.hasOwn(JUDGEMENT_KINDS[item.kind].verdicts, entry.verdict)) continue;
    const own = entry.on === "replacement" && asked ? question : item;
    verdicts[own.key] = verdictRecord(own, entry, { omit: OMITTED });
  }
  return verdicts;
}

/** What a question that reads a replaced line is answered of: the line as the replacement leaves it, said with the replacement. */
const ofReplacement = (asked) => {
  const one = asked.swapped.length === 1;
  return `your ${linesOf(asked.swapped)} ${one ? "replaces" : "replace"} the text this question reads, so an answer on the text as it stands reads nothing once the writer applies ${one ? "it" : "them"}: judge it as it reads with ${one ? "the replacement" : "them"} in place - ${JSON.stringify(asked.subject)} - and set "on": "replacement"`;
};

// The fields an entry carries that the judgements file does not keep from a self-check: where it was answered, and a judge's own mend.
const OMITTED = ["on", "replacement", "replacementReason"];

/** Every problem with one entry against the question it answers (`mine`: the answer's own replacements it is asked of). */
function entryProblems(question, entry, at, { mine = null } = {}) {
  const fix = JUDGEMENT_KINDS[question.kind].fix;
  if (typeof entry.replacement === "string" && entry.replacement.trim()) return [`${at}: a line's fix goes in "problems" - its field and its whole replacement - with this question answered of it ("on": "replacement"); leave \`replacement\` null`];
  if (failsByLine(question.kind, entry.verdict)) return [mine
    ? `${at}: your ${linesOf(mine)} ${mine.length === 1 ? "fails" : "fail"} this question ("${entry.verdict}"): write ${mine.length === 1 ? "the replacement" : "them"} so that, asked of ${mine.length === 1 ? "it" : "them"}, it answers "${fix.passes}"`
    : `${at}: "${entry.verdict}" is mended once, as one of your problems: give the ${fix.slot === "title" ? "title" : "line"} its whole replacement in "problems" (\`record\` naming this question and what it found), and answer this question of the replacement, "on": "replacement", as "${fix.passes}"`];
  const { on: _on, ...said } = entry;
  return judgementAnswerProblems(question, said).map((problem) => `${at}: ${problem.replace(/^\S+ \([^)]*\): /, "")}`);
}

/**
 * The entries keyed by no question the brief listed (`extra`), read against the questions the pages ask only once the
 * replacements are in place that no answer judges (`open`, from the page check pageProblems runs): `{ reasons, verdicts }`.
 * A question the substitution of a replacement did not foresee - a line the composer sets otherwise than the sheet reads it -
 * is named by the validation under its key, and answered under it; one left open is named again.
 */
export function extraProblems(extra, open, { questions = [], by = null } = {}) {
  const reasons = [], verdicts = {}, asked = new Map(open.map((item) => [item.key, item])), answered = new Set();
  const shape = judgementsBlockSchema([...questions, ...open]).items;
  for (const { entry, i } of extra) {
    const question = asked.get(entry?.key), at = `judgement ${i + 1} (${entry?.key ?? "no key"}${question ? ` ${question.kind}, on ${whereOf(question)}` : ""})`;
    if (!question) { reasons.push(`${at}: no question of this section's brief has that key, nor one its pages ask with your replacements in place - answer the questions the brief lists, under their keys`); continue; }
    if (answered.has(question.key)) { reasons.push(`${at}: answered twice - one answer a question`); continue; }
    answered.add(question.key);
    const malformed = schemaErrors(entry, shape, at, { absentIsNull: true, enums: false });
    if (malformed.length) { reasons.push(...malformed); continue; }
    if (entry.on === "replacement") { reasons.push(`${at}: this question is asked of the page with your replacements in place already: set "on" null`); continue; }
    reasons.push(...entryProblems(question, entry, at, { mine: [{ at: "replacement" }] }));
    if (Object.hasOwn(JUDGEMENT_KINDS[question.kind].verdicts, entry.verdict)) verdicts[question.key] = verdictRecord(question, entry, { by, omit: OMITTED });
  }
  for (const question of open.filter((item) => !answered.has(item.key)))
    reasons.push(`${question.key} (${question.kind}, on ${whereOf(question)}): with your replacements in place the rules ask this of ${JSON.stringify(question.subject)}${question.context ? ` (context ${JSON.stringify(question.context)})` : ""}, and no answer judges it - add it to "judgements" under this key, judged as the page reads with your replacements`);
  return { reasons, verdicts };
}

/**
 * The pages the replacements touch, checked as the writer's page check checks them (author-deck.mjs checkPages): once as
 * they stand and once with every replacement in place, each under the deck's recorded judgements and the answer's
 * (`verdicts`). `{ reasons, pending }`: a blocking finding a page has with the replacements and not without them, named with
 * its repair and the replacements on the page - a callout past its box, a page past its share of notes, under its word floor
 * or past its ceiling, a title over its lines, a table past its frame - and the questions the pages ask then that nothing
 * answers (`pending`, null where no page was checked). A replacement checked against its slot alone still broke the page it
 * was applied to: a callout of ten words did not fit its box, qualifications pushed notes past their share, and corrected
 * points cut a page below its word floor.
 */
export async function pageProblems(doc, { replaced, verdicts, dir, stem, insights, also = [] }) {
  // The pages the replacements are on, and any other a question they move is asked on (`also`): the same line of text on
  // two pages is one question, and the page left as it stands still asks it.
  const touched = [...new Set(replaced.swaps.map((swap) => swap.slide))];
  if (!touched.length) return { reasons: [], pending: null };
  touched.push(...[...new Set(also.map(String))].filter((id) => !touched.includes(id)));
  const store = await readJudgementStore(dir, stem);
  const session = () => judgementSession({ verdicts: { ...(store.verdicts ?? {}), ...verdicts } });
  const check = { dir, stem, insights, fit: false, fill: false };
  const now = await withJudgements(session(), () => checkPages(doc, touched, check));
  const fixedSession = session();
  const then = await withJudgements(fixedSession, () => checkPages(replaced.doc, touched, check));
  const keyOf = (f) => `${f.code}|${f.id ?? ""}`, had = new Map();
  for (const f of now.blocking) had.set(keyOf(f), (had.get(keyOf(f)) ?? 0) + 1);
  // A page's body words as the page gates count them, with the replacements and without: how far a fix moved the page.
  const bodyOf = (compiled, id) => (compiled.budget ?? []).find((row) => String(row.id ?? "") === id);
  const words = (id) => {
    const before = bodyOf(now.compiled, id), after = bodyOf(then.compiled, id);
    return Number.isFinite(before?.body) && Number.isFinite(after?.body) && before.body !== after.body
      ? ` Its body runs to ${after.body} words with them and ${before.body} as it stands${Number.isFinite(after.floor) && Number.isFinite(after.ceiling) ? `, and the page holds ${Math.ceil(after.floor)} to ${Math.floor(after.ceiling)}` : ""}.` : "";
  };
  const reasons = [];
  for (const f of then.blocking) {
    if (had.get(keyOf(f))) { had.set(keyOf(f), had.get(keyOf(f)) - 1); continue; }
    const page = f.id !== undefined && f.id !== null ? String(f.id) : null, mine = replaced.swaps.filter((swap) => !page || swap.slide === page);
    const shown = mine.length ? mine : replaced.swaps;
    reasons.push(`${page ?? "the deck"}: with your ${linesOf(shown)} in place, ${page ? "the page" : "the deck"} has ${f.code}, which it does not have as the pages stand - ${String(f.repair ?? f.reason ?? "").trim().replace(/[.\s]+$/, "")}.${page ? words(page) : ""} Write ${shown.length === 1 ? "the replacement" : "the replacements"} so the page passes as it does now`);
  }
  const named = new Set(touched);
  return { reasons, pending: pendingRequests(fixedSession).filter((item) => (item.where ?? []).some((id) => named.has(String(id)))) };
}

async function validate(answerFile, pagesFile) {
  const file = path.resolve(pagesFile), dir = path.dirname(file), stem = path.basename(file).replace(/\.pages\.json$/, "");
  // The brief names the answer beside the pages file (out/self-check/<part>.json): read it there where it is not found from here.
  const named = [path.resolve(answerFile), path.resolve(dir, answerFile)];
  let answer;
  for (const candidate of named) { answer = await readJson(candidate, { optional: true }).catch((error) => ({ unreadable: error.message })); if (answer) break; }
  if (!answer) { console.error(`No answer at ${named[0]}`); return EXIT.refused; }
  if (answer.unreadable) { console.log(JSON.stringify({ recorded: false, reasons: [`the answer does not parse: ${answer.unreadable}`] }, null, 1)); return EXIT.refused; }
  const doc = readPagesFileSync(file);
  // The deck as the writer's page check reads it, under the name the compile and judge.mjs give its files (the deck's id): a
  // pages file with no `sources` registry reads the one the insight log records.
  const deck = doc.deck?.id ?? stem;
  const logged = await loggedSources(doc, dir, deck);
  if (logged && !logged.problems.length) doc.sources = logged.registry;
  const insights = await readInsights(dir, stem, { alternatives: alternativesOf(doc.deck) });
  if (!insights) { console.error(`No insight log beside ${path.basename(file)}: the claims are checked against ${stem}.insights.json`); return EXIT.refused; }
  const out = path.join(dir, "out"), by = { selfCheck: String(answer.section ?? "deck") };
  const claims = answerProblems(doc, insights, answer, { sheets: await readSheets(out) });
  const replaced = claims.replaced ?? { doc, swaps: [] };
  // The questions the section's brief listed beside its claims, answered in the same answer; a spine reading has none.
  const questions = answer.scope === "spine" || claims.part === undefined ? null : await readQuestions(out, claims.part);
  // Every page a replacement touches, composed with all of them in place and checked as the writer will check it, under the
  // answer's own judgements: then each judgement is read against what that page asks.
  const also = (questions ?? []).filter((item) => askedWithReplacements(item, replaced.swaps)).flatMap((item) => item.where ?? []);
  const pages = await pageProblems(doc, { replaced, verdicts: answeredVerdicts(questions, answer, replaced.swaps), dir, stem: deck, insights, also });
  const judged = judgementProblems(questions, answer, replaced.swaps, { by, pending: pages.pending && new Set(pages.pending.map((item) => item.key)) });
  const listed = new Set([...(questions ?? []).map((item) => item.key), ...judged.foreseen]);
  const extra = extraProblems(judged.extra, (pages.pending ?? []).filter((item) => !listed.has(item.key)), { questions: questions ?? [], by });
  const reasons = [...claims.reasons, ...judged.reasons, ...extra.reasons, ...pages.reasons], { expect } = claims;
  // An answer that passes is recorded: its judgements go where judge.mjs records a packet's (<id>.judgements.json), so the
  // writer's check after the replacements are applied finds every question answered.
  const verdicts = { ...judged.verdicts, ...extra.verdicts };
  if (!reasons.length) writeVerdicts(dir, deck, verdicts);
  console.log(JSON.stringify(reasons.length ? { recorded: false, reasons } : { recorded: true, pages: Object.keys(answer.pages ?? {}).length, problems: (answer.problems ?? []).length, judgements: Object.keys(verdicts).length,
    ...(Object.keys(expect).length ? { expect, note: "each page's claims hash to `expect` once its replacements are applied word for word: the join carries its verdict then, with no second reading, and the compile finds each of its questions answered" } : {}) }, null, 1));
  return reasons.length ? EXIT.refused : EXIT.ok;
}

async function record(pagesFile, outputDirectory, { spine = null } = {}) {
  const file = path.resolve(pagesFile), out = path.resolve(outputDirectory);
  const dir = path.dirname(file), stem = path.basename(file).replace(/\.pages\.json$/, "");
  const ledger = await readJson(path.join(out, "claims.json"), { optional: true });
  if (!ledger) { console.error(`No ${path.join(out, "claims.json")}: build the deck first (build-deck.mjs), which writes the claim ledger the record is bound to`); return EXIT.refused; }
  const doc = readPagesFileSync(file);
  const insights = await readInsights(dir, stem, { alternatives: alternativesOf(doc.deck) });
  const sheet = claimSheet(doc, insights);
  const previous = await readJson(path.join(out, "self-check.json"), { optional: true }).catch(() => null);
  const { record: joined, toCheck, findingsOpen } = joinSelfChecks(ledger, sheet, await readSectionChecks(out), { previous, spine, sheets: await readSheets(out) });
  await writeJson(path.join(out, "self-check.json"), joined);
  const errors = validateSelfCheck(joined, ledger);
  // The pages still to check, grouped by why, and the lines of each that changed: the list a lead hands back to each section's checker.
  const byWhy = {}, lines = {};
  for (const entry of toCheck) { (byWhy[entry.why] ??= []).push(entry.slide); if (entry.lines) lines[entry.slide] = entry.lines; }
  const other = errors.filter((error) => !error.startsWith("self-check has no current verdict"));
  console.log(JSON.stringify({ verified: Object.keys(joined.pages).length, of: Object.keys(ledger.pageHashes ?? {}).length,
    ...(toCheck.length ? { toCheck: byWhy } : {}), ...(Object.keys(lines).length ? { lines } : {}), ...(findingsOpen.length ? { findingsOpen } : {}), ...(other.length ? { errors: other } : {}) }, null, 1));
  return errors.length ? EXIT.refused : EXIT.ok;
}

async function main(argv) {
  const { values, positionals: [pagesFile, outputDirectory] } = parseCli(argv, { spine: { type: "string", valueName: "a sentence" }, validate: { type: "string", valueName: "an answer file" } }, { usage: USAGE, strict: true });
  if (values.validate !== undefined) {
    if (!pagesFile || outputDirectory || values.spine !== undefined || !/\.pages\.json$/.test(pagesFile)) throw new UsageError(`--validate checks one answer against the pages file, and records only its judgements once it passes\n${USAGE}`);
    return validate(values.validate, pagesFile);
  }
  if (!pagesFile || !outputDirectory || !/\.pages\.json$/.test(pagesFile)) throw new UsageError(USAGE);
  return record(pagesFile, outputDirectory, { spine: values.spine ?? null });
}

if (isMain(import.meta.url)) runCli(main);
