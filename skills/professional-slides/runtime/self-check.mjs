#!/usr/bin/env node
// The author's self-check, recorded from the sections' checks.
//
//   node runtime/self-check.mjs <id>.pages.json out/ [--spine "<the title-spine pass>"]
//
// Each section is self-checked as soon as it checks clean (author-deck.mjs --brief selfcheck --section <part>): its
// checker reproduces the section's claims from the records and saves out/self-check/<part>.json, a verdict per page bound to
// the hash of the claims it read (claim-sheet.mjs sheetHash). Delivery wants out/self-check.json bound to the build's own
// claim ledger (claims.mjs validateSelfCheck), which only exists after the build. This joins the two: a page whose title and
// sentences are what its checker read keeps its verdict, under the ledger's hash; a page changed since, or never checked, or
// with a problem open, is named for another check.
//
// Exit codes (EXIT in errors.mjs): 0 every page that makes claims has a current verdict and the record is complete, 2 pages
// or findings are still to check (the record holds what is current), 1 a crash or bad usage.
//
// On the BA retest the whole deck was self-checked after the build, by five readers at once: 64 problems on 41 of 95 pages,
// each a rewrite after the deck was drawn and judged, and 20 more in the rewrites. Checked per section beside the judges,
// the same problems are fixed before the build, and the build keeps the verdicts of the pages that did not change.
import fs from "node:fs/promises";
import path from "node:path";
import { EXIT, UsageError, isMain, parseCli, readJson, runCli, writeJson } from "./cli.mjs";
import { readPagesFileSync } from "./pages-file.mjs";
import { readInsights } from "./author-deck.mjs";
import { alternativesOf } from "./analysis.mjs";
import { claimSheet, sheetHash } from "./claim-sheet.mjs";
import { findingKey, validateSelfCheck } from "./claims.mjs";

const USAGE = "Usage: self-check.mjs <id>.pages.json out/ [--spine \"<which pages the title-spine pass merged or cut, or why none>\"]";
const PARTS = "self-check";

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

/**
 * The record delivery reads, from the build's ledger, the pages as they stand and the sections' answers: `{ record,
 * toCheck: [{ slide, why }], findingsOpen }`. A verdict carries over only where the checker read the claims the page makes now.
 */
export function joinSelfChecks(ledger, sheet, parts, { previous = null, spine = null } = {}) {
  const now = new Map(sheet.map((page) => [String(page.id), sheetHash(page)]));
  const verdicts = new Map();
  for (const part of parts) for (const [id, verdict] of Object.entries(part.pages ?? {})) verdicts.set(String(id), verdict);
  const open = new Set(parts.flatMap((part) => (Array.isArray(part.problems) ? part.problems : []).map((problem) => String(problem.slide))));
  const pages = {}, toCheck = [];
  for (const [slide, claims] of Object.entries(ledger.pageHashes ?? {})) {
    const verdict = verdicts.get(slide);
    // A verdict already bound to the build's hash stays (an earlier run of this, or the author's own record).
    if (previous?.pages?.[slide]?.claims === claims && previous.pages[slide].verified === true) { pages[slide] = previous.pages[slide]; continue; }
    const why = !verdict ? "never checked" : verdict.sheet !== now.get(slide) ? "its claims changed since it was checked"
      : verdict.verified !== true || open.has(slide) ? "a problem is open on it" : null;
    if (why) toCheck.push({ slide, why });
    else pages[slide] = { claims, verified: true };
  }
  const answers = { ...(previous?.findings ?? {}), ...Object.assign({}, ...parts.map((part) => part.findings ?? {})) };
  const findingsOpen = (ledger.findings ?? []).filter((f) => typeof answers[findingKey(f)] !== "string" || answers[findingKey(f)].trim().length < 20).map(findingKey);
  const spineNote = spine ?? previous?.spine ?? (parts.map((part) => part.spine).filter((note) => typeof note === "string" && note.trim()).join(" ") || null);
  return { record: { pages, findings: answers, ...(spineNote ? { spine: spineNote } : {}) }, toCheck, findingsOpen };
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
  const { record: joined, toCheck, findingsOpen } = joinSelfChecks(ledger, sheet, await readSectionChecks(out), { previous, spine });
  await writeJson(path.join(out, "self-check.json"), joined);
  const errors = validateSelfCheck(joined, ledger);
  // The pages still to check, grouped by why: the list a lead hands back to each section's checker.
  const byWhy = {};
  for (const entry of toCheck) (byWhy[entry.why] ??= []).push(entry.slide);
  const other = errors.filter((error) => !error.startsWith("self-check has no current verdict"));
  console.log(JSON.stringify({ verified: Object.keys(joined.pages).length, of: Object.keys(ledger.pageHashes ?? {}).length,
    ...(toCheck.length ? { toCheck: byWhy } : {}), ...(findingsOpen.length ? { findingsOpen } : {}), ...(other.length ? { errors: other } : {}) }, null, 1));
  return errors.length ? EXIT.refused : EXIT.ok;
}

async function main(argv) {
  const { values, positionals: [pagesFile, outputDirectory] } = parseCli(argv, { spine: { type: "string", valueName: "a sentence" } }, { usage: USAGE, strict: true });
  if (!pagesFile || !outputDirectory || !/\.pages\.json$/.test(pagesFile)) throw new UsageError(USAGE);
  return record(pagesFile, outputDirectory, { spine: values.spine ?? null });
}

if (isMain(import.meta.url)) runCli(main);
