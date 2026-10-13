#!/usr/bin/env node
// The author's self-check, recorded from the sections' checks.
//
//   node runtime/self-check.mjs <id>.pages.json out/ [--spine "<the title-spine pass>"]
//   node runtime/self-check.mjs --validate <answer.json> <id>.pages.json
//
// Each section is self-checked once, after its last structural change (author-deck.mjs --brief selfcheck --section <part>):
// its checker reproduces the section's claims from the records and saves out/self-check/<part>.json, a verdict per page bound
// to the hash of the claims it read (claim-sheet.mjs sheetHash), and for each problem the field it is in and the field's whole
// new text. `--validate` refuses an answer that leaves a page without a verdict, a replacement past its slot or printing a
// number no record holds, or a problem in a field the page does not have - before the checker hands back. Delivery wants
// out/self-check.json bound to the build's own claim ledger (claims.mjs validateSelfCheck), which only exists after the build.
// This joins the two: a page whose claims are what its checker read, or what it read with every replacement applied word for
// word, keeps its verdict under the ledger's hash; a page changed besides, or never checked, or with a fix not applied, is
// named for another check, with the lines that changed.
//
// Exit codes (EXIT in errors.mjs): 0 every page that makes claims has a current verdict and the record is complete (with
// --validate, the answer would be recorded), 2 pages or findings are still to check (with --validate, the answer is refused),
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
import { EXIT, UsageError, isMain, parseCli, readJson, runCli, writeJson } from "./cli.mjs";
import { readPagesFileSync } from "./pages-file.mjs";
import { readInsights } from "./author-deck.mjs";
import { alternativesOf } from "./analysis.mjs";
import { bindDeck } from "./bind.mjs";
import { sectionPages } from "./brief.mjs";
import { claimSheet, overruns, readSheets, roomText, sheetHash, withReplacements } from "./claim-sheet.mjs";
import { findingKey, validateSelfCheck } from "./claims.mjs";

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
  return { reasons, expect };
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
  const insights = await readInsights(dir, stem, { alternatives: alternativesOf(doc.deck) });
  if (!insights) { console.error(`No insight log beside ${path.basename(file)}: the claims are checked against ${stem}.insights.json`); return EXIT.refused; }
  const { reasons, expect } = answerProblems(doc, insights, answer, { sheets: await readSheets(path.join(dir, "out")) });
  console.log(JSON.stringify(reasons.length ? { recorded: false, reasons } : { recorded: true, pages: Object.keys(answer.pages ?? {}).length, problems: (answer.problems ?? []).length,
    ...(Object.keys(expect).length ? { expect, note: "each page's claims hash to `expect` once its replacements are applied word for word: the join carries its verdict then, with no second reading" } : {}) }, null, 1));
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
    if (!pagesFile || outputDirectory || values.spine !== undefined || !/\.pages\.json$/.test(pagesFile)) throw new UsageError(`--validate checks one answer against the pages file and records nothing\n${USAGE}`);
    return validate(values.validate, pagesFile);
  }
  if (!pagesFile || !outputDirectory || !/\.pages\.json$/.test(pagesFile)) throw new UsageError(USAGE);
  return record(pagesFile, outputDirectory, { spine: values.spine ?? null });
}

if (isMain(import.meta.url)) runCli(main);
