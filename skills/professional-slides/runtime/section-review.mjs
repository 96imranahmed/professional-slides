#!/usr/bin/env node
// The review of one section, read beside the other sections' writing.
//
//   node runtime/section-review.mjs <id>.pages.json out/ --section <part>
//   node runtime/section-review.mjs --validate <answer.json> <id>.pages.json [out/]
//
// On the BA retest (ba4) the deck was reviewed once, at the end: 102 pages in
// 12 packets, 19 minutes, 171 findings, 15 of them blockers. Most were page
// craft - a wrong exhibit form, no hero exhibit, dead space, an unannotated
// plot, a buried number, density - that a reader of one section could have
// seen as soon as it was drawn; found at the end, each cost a rewrite, a
// self-check, a judge and a render, often in a section whose writer had
// finished. A section is reviewed here as soon as every page of it checks
// clean on its render (author-deck.mjs --check --render --page <its ids>,
// which records out/page-check/<id>.json, and renders the section's pages
// whatever the other sections' pages are doing): on the page dimensions, the
// density of its flagged pages and the evidence each page shows. The answer
// binds to the drawings it read (page-check.mjs), and every finding carries
// its fix - the full replacement of each field its repair changes - which
// `--validate` applies and compiles before the answer is recorded, so the
// writer applies it word for word and the page keeps its verdict with no
// second reading. The final review then reads the deck for what needs the
// whole of it, and reads a page again only where it changed otherwise.
//
// Exit codes (EXIT in errors.mjs): staging, 3 the packet is written for its
// reviewer, 2 refused (a page with no clean, current page check); with
// --validate, 0 the answer would be recorded, 2 refused, with every reason;
// 1 a crash or bad usage.
import fs from "node:fs/promises";
import path from "node:path";
import { EXIT, UsageError, isMain, parseCli, readJson, runCli, writeJson } from "./cli.mjs";
import { readPagesFileSync, withPages } from "./pages-file.mjs";
import { sectionPages } from "./brief.mjs";
import { authorDeck, readInsights } from "./author-deck.mjs";
import { alternativesOf } from "./analysis.mjs";
import { classOf } from "./gates/gate_classes.mjs";
import { BOUND_FIELDS } from "./storyline.mjs";
import { withJudgements, loadJudgements } from "./judgements.mjs";
import { requestOf, requestProvenanceOf, evidenceScopeOf, answerStatusOf, sha256, stageReview, provenanceLine, provenanceErrors, groupErrors } from "./review-passes.mjs";
import { CODES, SECTION_REVIEW_SCHEMA, sectionPrompt, packetSlide, validatePart, formRules, PAGE_DIMENSIONS } from "./reviewer.mjs";
import { PAGE_CHECK, SECTION_REVIEW, applyFixes, readPageCheck, sourceHash } from "./page-check.mjs";

const USAGE = "Usage: section-review.mjs <id>.pages.json out/ --section <part>\n       section-review.mjs --validate <answer.json> <id>.pages.json [out/]";
const stemOf = (file) => path.basename(file).replace(/\.pages\.json$/, "");
const pagesById = (doc) => new Map([...doc.pages, ...(doc.appendix || [])].map((page, index) => [String(page?.id ?? `page-${index + 1}`), page]));
const recordPath = (out, part) => path.join(out, SECTION_REVIEW, `${part}.packet.json`);
const partOf = (name) => path.basename(name).replace(/\.pages\.json$/, "");

/**
 * Stage a section's review packet: `{ status: "packet-written", packetDir, answer, ... }`,
 * or `{ status: "refused", errors }` naming each page with no page check, one
 * that did not check clean (with the codes that held it) and one written
 * since it was checked. The packet is staged in a clean folder holding only
 * the renders, the prompt, the schema and each page's record as written.
 */
export async function stageSectionReview(file, out, section) {
  const doc = readPagesFileSync(file);
  const own = sectionPages(doc, section);
  if (own.why) return { status: "refused", errors: [own.why] };
  const part = partOf(own.part);
  const ids = own.pages.map((page) => String(page.id));
  if (!ids.length) return { status: "refused", errors: [`section ${part} holds no page yet`] };
  const checks = new Map(await Promise.all(ids.map(async (id) => [id, await readPageCheck(out, id)])));
  const errors = ids.flatMap((id) => {
    const check = checks.get(id), page = own.pages.find((p) => String(p.id) === id);
    if (!check) return [`${id} has no page check: run node runtime/author-deck.mjs ${path.basename(file)} --check --render --page ${ids.join(",")}`];
    if (!check.clean) return [`${id} did not check clean (${check.blocking.join(", ")}): fix it and check the section's pages again`];
    return check.source === sourceHash(page) ? [] : [`${id} was written after its page check: check the section's pages again (--check --render --page ${ids.join(",")})`];
  });
  if (errors.length) return { status: "refused", errors };
  const all = [...pagesById(doc).keys()];
  const binding = sha256(JSON.stringify([part, ...ids.map((id) => `${id}:${checks.get(id).drawn}`)]));
  const previous = await readJson(recordPath(out, part), { optional: true }).catch(() => null);
  const packetDir = await stageReview("section-review", Object.fromEntries(ids.map((id) => [`rendered/${id}.png`, path.join(out, PAGE_CHECK, `${id}.png`)])), { previous: previous?.staging });
  const slides = ids.map((id) => packetSlide(checks.get(id).slide, all.indexOf(id) + 1, { gateFindings: [], image: path.join(packetDir, "rendered", `${id}.png`) }));
  const answer = path.join(out, SECTION_REVIEW, `${part}.json`);
  const deck = doc.deck || {};
  const titled = [...pagesById(doc).entries()].map(([id, page], i) => `${i + 1}. [${id}] ${page?.title ?? page?.kind ?? ""}`);
  const packet = { binding, kind: "section-review", section: part, slides, titles: titled, codes: CODES, craft: [], fit: [], floors: null,
    density: { deck: {}, pages: ids.map((id) => checks.get(id).density).filter(Boolean) },
    request: requestOf(deck), requestProvenance: requestProvenanceOf(deck), evidenceScope: evidenceScopeOf(deck), answerStatus: answerStatusOf(deck), question: deck.question ?? null, answer: deck.answer ?? "",
    records: Object.fromEntries(ids.map((id) => [id, pagesById(doc).get(id)])),
    early: { records: path.join(packetDir, "packet.json"), validate: `node runtime/section-review.mjs --validate ${JSON.stringify(answer)} ${JSON.stringify(path.resolve(file))} ${JSON.stringify(path.resolve(out))}` } };
  const prompt = sectionPrompt(packet, { id: part, title: own.pages.find((p) => p.kind === "section")?.title ?? part, slides: ids });
  packet.promptHash = sha256(prompt);
  await writeJson(path.join(packetDir, "packet.json"), packet);
  await writeJson(path.join(packetDir, "schema.json"), SECTION_REVIEW_SCHEMA);
  await fs.writeFile(path.join(packetDir, "prompt.md"), `${prompt}${provenanceLine(packet.promptHash)}`);
  await fs.mkdir(path.join(out, SECTION_REVIEW), { recursive: true });
  await writeJson(recordPath(out, part), { part, binding, promptHash: packet.promptHash, staging: packetDir, writtenAt: new Date().toISOString(),
    pages: ids.map((id) => ({ id, drawn: checks.get(id).drawn, source: checks.get(id).source, page: pagesById(doc).get(id) })) });
  return { status: "packet-written", part, pages: ids.length, packetDir, answer,
    note: `Give ${path.join(packetDir, "prompt.md")} to a fresh reviewer (the images sit beside it; give it nothing else); it saves its JSON answer as ${answer} and runs ${packet.early.validate} until it passes. The section's writer then applies every fix word for word and checks its pages again with --check --render --page.` };
}

// A path is the field's own when every part before its last is there: a fix replaces a field, it does not invent a structure.
const reaches = (page, field) => { const keys = String(field).split("."); let at = page; for (const key of keys.slice(0, -1)) { at = at?.[key]; if (!at || typeof at !== "object") return false; } return true; };
// The fields the storyline critique is bound to (storyline.mjs BOUND_FIELDS), as a page record writes them: a fix to one reopens the critique.
const boundAt = (field) => String(field).split(".").find((key) => Object.hasOwn(BOUND_FIELDS, key) && !["pages", "request", "answer", "record"].includes(key)) ?? null;

/**
 * Every reason a section review's answer would be refused: the part's form
 * (reviewer.mjs validatePart: every page, every page dimension, the verdicts
 * agreeing with the findings), its binding to the packet it answers, and each
 * fix - on a page of the finding, at a field the page has and the critique
 * is not bound to - applied and compiled with the section, a fix that leaves
 * its page refused by a page rule named with the rule. A finding of severity
 * minor or worse with neither a fix nor a route is refused: it would be
 * found again at the end.
 */
export async function validateSectionReview(answer, file, out) {
  const doc = readPagesFileSync(file);
  const part = answer?.part?.id;
  const record = part ? await readJson(recordPath(out, part), { optional: true }).catch(() => null) : null;
  if (!record) return [`no section-review packet was staged for ${part ?? "this answer"}: run node runtime/section-review.mjs ${path.basename(file)} ${out} --section <part> first`];
  const errors = [];
  if (answer.binding !== record.binding) errors.push(`binding: the answer is bound to ${answer.binding ?? "nothing"}, the packet to ${record.binding}; answer the packet as staged`);
  errors.push(...provenanceErrors(answer, record.promptHash));
  const stripped = { ...answer, findings: (answer.findings || []).map(({ fix: _fix, route: _route, ...f }) => f) };
  errors.push(...validatePart(stripped, [...pagesById(doc).keys()]));
  const own = new Map(record.pages.map((p) => [p.id, p])), current = pagesById(doc);
  for (const p of record.pages) if (sourceHash(current.get(p.id)) !== p.source) errors.push(`${p.id} was written after the packet was staged: stage the section's review again`);
  const fixes = new Map();
  for (const f of answer.findings || []) {
    if (f.severity === "none") continue;
    if (!Array.isArray(f.fix) && !f.route) { errors.push(`${f.id}: give \`fix\`, the full replacement of each field the repair changes, or \`route\` (spine or research) where no fix of the page's fields closes it`); continue; }
    if (f.route && f.fix) errors.push(`${f.id}: a finding carries a fix or a route, not both`);
    for (const fix of f.fix || []) {
      const page = own.get(fix?.page);
      if (!page || !(f.slides || []).includes(fix.page)) { errors.push(`${f.id}: fix.page ${fix?.page} is not one of the finding's pages in this section`); continue; }
      const bound = boundAt(fix.field);
      if (bound) { errors.push(`${f.id}: ${fix.page}.${fix.field} writes \`${bound}\`, which the storyline critique is bound to (${BOUND_FIELDS[bound]}); give \`route: "spine"\` instead`); continue; }
      if (!reaches(page.page, fix.field)) { errors.push(`${f.id}: ${fix.page} has no ${String(fix.field).split(".").slice(0, -1).join(".")} to hold ${fix.field}; name a field the page's record has`); continue; }
      fixes.set(fix.page, [...(fixes.get(fix.page) ?? []), fix]);
    }
  }
  if (errors.length || !fixes.size) return errors;
  return compileErrors(doc, file, record, fixes);
}

// The deck with every fix in place, its section's pages compiled and composed as a page run checks them (author-deck.mjs
// --check --page): among the deck's structural pages, the rest of the deck read off what it declares, so another section
// mid-edit refuses nothing here. A page rule the fixed page trips is named.
async function compileErrors(doc, file, record, fixes) {
  const dir = path.dirname(path.resolve(file)), stem = stemOf(file);
  const ids = new Set(record.pages.map((p) => String(p.id)));
  const fixed = (page) => (fixes.has(String(page?.id)) ? applyFixes(page, fixes.get(String(page.id))) : page);
  const deck = withPages(doc, { pages: doc.pages.map(fixed), appendix: doc.appendix?.map(fixed) });
  const insights = await readInsights(dir, stem, { alternatives: alternativesOf(doc.deck) });
  const session = await loadJudgements(dir, stem);
  let compiled;
  try { compiled = await withJudgements(session, () => authorDeck(deck, { baseDir: dir, insights, fit: false, pages: ids })); }
  catch (error) { return (error.pageErrors ?? [error.message]).map((message) => `the section with its fixes does not compile: ${message}`); }
  const pageOf = (f) => String(f.id ?? "");
  return compiled.blocking.filter((f) => fixes.has(pageOf(f)) && classOf(f.code) === "P")
    .map((f) => `${pageOf(f)}: with its fixes the page is refused by ${f.code}${f.repair ? ` (${String(f.repair).split("\n")[0]})` : ""}; write the fix so the page stays clean`);
}

async function main(argv) {
  const { values, positionals } = parseCli(argv, { section: { type: "string" }, validate: { type: "string" } }, { usage: USAGE });
  if (values.validate) {
    const [file, outArg] = positionals;
    if (!file) throw new UsageError(USAGE);
    const out = path.resolve(outArg ?? path.join(path.dirname(path.resolve(file)), "out"));
    const answer = await readJson(path.resolve(values.validate));
    const errors = await validateSectionReview(answer, path.resolve(file), out);
    // Gathered by the rule each breaks, so the reviewer mends every place one rule is broken at once.
    console.log(JSON.stringify(errors.length ? { recorded: false, errors: groupErrors(errors, formRules(PAGE_DIMENSIONS)) } : { recorded: true, part: answer.part.id, findings: (answer.findings || []).length }));
    return errors.length ? EXIT.refused : EXIT.ok;
  }
  const [file, out] = positionals;
  if (!file || !out || !values.section) throw new UsageError(USAGE);
  const result = await stageSectionReview(path.resolve(file), path.resolve(out), values.section);
  console.log(JSON.stringify(result));
  return result.status === "packet-written" ? EXIT.waiting : EXIT.refused;
}

if (isMain(import.meta.url)) runCli(main);
