#!/usr/bin/env node
// Build, gate, review, confirm, and hand over — or refuse.
//
//   node runtime/deliver-deck.mjs <id>.deck.json out/ [--reviewer auto|codex|claude|packet] [--model m]
//                                              [--review review.json|confirmation.json|parts-dir] [--skip-build]
//                                              [--full-review --reason "<why>" [--user-approved]] [--max-passes n]
//
// A finding keeps the severity its gate gave it. Delivery blocks on the
// build's blockers and on a missed build bar the deck has not waived, and says
// which is which; the build's advisories are listed as advisories and never
// block. REJECTED.md and delivery.json keep the three apart.
//
// The order is fixed. The build and its page gates; the deck's verbatim
// `request` (a new deck must carry it) and its build-bar waivers; the storyline
// critique ready for the deck's current spine; the build bars measured on the
// composed scene (build-bars.mjs), where a miss blocks unless the deck waives
// that bar and the review confirms the waiver; the author's self-check over the
// claim ledger (claims.json). Then the review: pass 1 reads the whole deck
// exhaustively; after a rejection, each later pass verifies (reviewer.mjs,
// review-passes.mjs). A pass accepts at a rating of 8 or more with no major or
// blocker finding from any pass open and every waiver confirmed. When the
// accepting pass is a verification, one fresh, blind read of the final
// artifact - no ledger, no earlier rating, no earlier findings - must accept it
// too; its rating is the deck's score in delivery.json. The cost is bounded:
// --max-passes (3) review passes and one confirmation; a deck still rejected
// then goes back to the user with its open findings.
//
// Both loops keep their history beside the deck file, keyed by deck id
// (<dir of deck.json>/.reviews/<id>/), so another output directory continues
// the same lineage. --full-review starts a new lineage with an exhaustive pass,
// for a repair that changed the argument itself; it needs --reason, which is
// logged, and a second restart needs --user-approved.
//
// A lineage that has accepted the current build is done: a rerun hands the
// approved build over again, with the same deliverable and delivery.json, and
// starts no further read.
//
// Exit codes (EXIT in errors.mjs): 0 accepted - the deliverable is
// out/<id>-DELIVERED.pptx; 2 rejected or refused - no deliverable is written,
// out/REJECTED.md lists the blockers, and any earlier deliverable copy is
// removed so a stale file can never be mistaken for an accepted one; 3 a review
// or confirmation packet is waiting for its reviewer, and any earlier
// deliverable copy is removed likewise; 1 a crash or bad usage, which reaches
// no outcome and leaves the last one's deliverable, REJECTED.md and
// delivery.json as they were.
import fs from "node:fs/promises";
import path from "node:path";
import { deckStem } from "./artifact-path.mjs";
import { assertOutputDirectory } from "./output-path.mjs";
import { buildDeck, isBlocking } from "./build-deck.mjs";
import { isRefusal, registered } from "./errors.mjs";
import { EXIT, UsageError, isMain, parseCli, readJson, runCli, writeJson } from "./cli.mjs";
import { barOutcome } from "./build-bars.mjs";
import {
  runReview, validateReview, validateConfirmation, validateReviewBinding, validateDensityReview, reviewOutcome, confirmationOutcome, reviewBinding,
  slideHashes, latestReview, lineageLedger, verificationScope, withInheritedDensity, recordReview, mergeReviewDirectory, readPacketRecord, reviewHistory,
  downgradeRule, pageTexts, MAX_PASSES, MAX_CONFIRMATIONS,
} from "./reviewer.mjs";
import { capMessage, deckStatementFindings, requestOf, provenanceErrors, lineageStore, restartLineage, readConfirmations, recordConfirmation, readInventory, revisionChanges } from "./review-passes.mjs";
import { writeLedger, validateSelfCheck, CLAIM_CODES } from "./claims.mjs";
import { storylineGate, storylineOutcome } from "./storyline.mjs";

// Delivery's own findings: why a deck was refused around its review, as
// opposed to a defect a gate or the reviewer found on a page. A review that
// does not validate is INVALID_REVIEW, not an EDITORIAL blocker: EDITORIAL is
// the advisory wording code and can never block (reviewer.mjs findingErrors).
export const DELIVERY_CODES = Object.freeze({
  MISSING_RENDERED_GATES: "the build carries no passing rendered page gates to deliver on",
  STORYLINE_UNREVIEWED: "no ready storyline critique for the deck's current title spine",
  REVIEW_PASS_CAP: "the review loop reached its cap - its passes or its confirmation read - with findings open; only the user asks for another pass",
  INVALID_REVIEW: "the supplied review does not validate against its schema, its pass or the build: a transport problem, not a deck defect",
  REVIEW_RATING: "the reviewer rated the deck below the acceptance bar of 8",
  REVIEW_PROVENANCE: "the review does not say which backend and model wrote it, or does not echo the prompt hash of the packet delivery wrote for it",
  REVIEW_UNCONFIRMED: "the fresh confirmation read of the final artifact did not accept it",
  LINEAGE_RESTART: "a new review lineage asked for without a reason, or a second one without the user's approval",
});

// What a gate measured, or the bar it measured against, in words: a number or
// a phrase as it is, and a structured value by its parts ("players 5,
// logoPages 0") rather than as "[object Object]".
function measuredText(value) {
  if (value === null || value === undefined) return "?";
  if (Array.isArray(value)) return value.map(measuredText).join(", ");
  if (typeof value === "object") return Object.entries(value).map(([key, part]) => `${key} ${part !== null && typeof part === "object" ? `(${measuredText(part)})` : measuredText(part)}`).join(", ");
  return String(value);
}

// A refusal's findings as delivery blockers: the build refused the deck for a
// rule the author can repair, and REJECTED.md says which.
const refusalBlockers = (error) => (error.findings?.length ? error.findings : [{ code: error.code, reason: error.message }]).map((f) => ({
  slide: f.slide ?? null, code: f.code ?? error.code, severity: "blocker",
  reason: f.reason ?? f.message ?? `${f.code}: measured ${measuredText(f.measured)}, threshold ${measuredText(f.threshold)}`, repair: f.repair ?? "" }));

/**
 * The build's gate findings as delivery reads them: each with the severity its
 * gate gave it, once - the scene's gates run before the render and again after
 * it, and report the same finding twice. `blockers` are those that block
 * (build-deck.mjs isBlocking), from a report that failed; `advisories` are the
 * rest, which delivery lists and never blocks on.
 */
function gateFindings(build) {
  const seen = new Set(), blockers = [], advisories = [];
  for (const [stage, report] of [["gate", build.gates], ["preflight", build.preflight]]) for (const f of report?.findings || []) {
    const key = `${f.code}|${f.slide ?? f.id ?? ""}|${JSON.stringify(f.measured ?? "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const finding = { slide: f.slide ?? null, code: f.code, severity: f.severity ?? "blocker", reason: f.reason || `${stage} ${f.code}: measured ${measuredText(f.measured)}, threshold ${measuredText(f.threshold)}`, repair: f.repair || "" };
    if (!isBlocking(f)) advisories.push(finding);
    else if (report.passed === false) blockers.push(finding);
  }
  return { blockers, advisories };
}

export async function deliverDeck(specPath, outputDirectory, { reviewer = "auto", model, reviewFile, skipBuild = false, fullReview = false, reason, userApproved = false, maxPasses = MAX_PASSES } = {}) {
  const directory = await assertOutputDirectory(outputDirectory);
  const spec = await readJson(specPath);
  const stem = deckStem(spec);
  // The deliverable and REJECTED.md of an earlier run stay until this run
  // reaches an outcome of its own: deliver, reject and pending each replace them.
  const delivered = path.join(directory, `${stem}-DELIVERED.pptx`);
  const rejectedNote = path.join(directory, "REJECTED.md");
  const report = { accepted: false, stage: "build" };
  // `advisories` are the build's, set once it is read: a refusal at the page gates or the build bars lists them beside what blocks.
  const context = { specPath, spec, directory, delivered, rejectedNote, report, advisories: [] };
  try {
    return await deliverSteps(context, { reviewer, model, reviewFile, skipBuild, fullReview, reason, userApproved, maxPasses });
  } catch (error) {
    if (!isRefusal(error)) throw error;
    return reject(context, report.stage, refusalBlockers(error));
  }
}

async function deliverSteps(context, { reviewer, model, reviewFile, skipBuild, fullReview, reason, userApproved, maxPasses }) {
  const { specPath, spec, directory, report } = context;
  const refuse = (stage, blockers) => reject(context, stage, blockers);
  const build = skipBuild ? await readJson(path.join(directory, "build-result.json")) : await buildDeck(specPath, directory);
  report.build = { status: build.status, pptx: build.pptxPath, montage: build.montagePath };
  // What the build could not obtain, and the deck's declaration that it was built without the network (asset-needs.mjs): the delivery record says so.
  if (build.assets) report.assets = build.assets;
  const blockers = [];
  if (build.gates?.passed !== true) blockers.push({ slide: null, code: "MISSING_RENDERED_GATES", severity: "blocker", reason: "Delivery requires passing rendered page gates", repair: "Rebuild with rendering enabled before delivery" });
  if (build.readback && build.readback.accepted !== true) blockers.push(...(build.readback.findings || []).slice(0, 20).map((f) => ({ slide: f.slide ?? null, code: "BROKEN_GEOMETRY", severity: "blocker", reason: `readback ${f.code} on ${f.shape || ""}`, repair: "Fix the emitter or the scene so the saved file matches the scene" })));
  // The gates' findings at the severity each gate gave them: only a blocker blocks here, and the advisories are carried as advisories.
  const gated = gateFindings(build);
  context.advisories = gated.advisories;
  blockers.push(...gated.blockers);
  // The build names what else held it back - text lost from the rendered
  // pages, most often - rather than leaving "not complete" to be diagnosed.
  if (build.status !== "built" && !blockers.length) blockers.push(...(build.blockers || []).slice(0, 20)
    .map((b) => ({ slide: b.slide ?? null, code: b.code, severity: "blocker", reason: `${b.source} ${b.code}${b.id ? ` on ${b.id}` : ""}${b.text ? `: "${b.text}"` : ""}`, repair: b.repair || "Fix the page so the saved deck carries every planned text, then rebuild" })));
  if (build.status !== "built" && !blockers.length) blockers.push({slide:null, code:"BROKEN_GEOMETRY", severity:"blocker", reason:`Build is not complete: ${build.status}`, repair:"Complete the build and all gates before delivery"});
  if (blockers.length) return refuse("page gates", blockers);

  // The deck's own statements the reviews rest on - the user's request, word
  // for word, and the build bars it says it is right to miss - checked as the
  // authoring compile checks them (deckStatementFindings).
  report.stage = "request";
  const statements = deckStatementFindings(spec);
  if (statements.length) return refuse(statements[0].code === "REQUEST_MISSING" ? "request" : "waivers", statements.map((f) => ({ slide: null, code: f.code, severity: f.severity, reason: f.repair,
    repair: "Fix it in <id>.pages.json, recompile with author-deck.mjs, rebuild and rerun" })));

  // The storyline was stress-tested before it was drawn: an independent
  // critique of the spine, bound to its current structure, says it is ready.
  // Checked before any deck review is prepared or accepted, so a deck review is
  // never spent on an argument that is about to change.
  report.stage = "storyline";
  const storyErrors = await storylineGate(spec, directory, { deckPath: specPath });
  if (storyErrors.length) return refuse("storyline", storyErrors.map((reason) => ({ slide: null, code: "STORYLINE_UNREVIEWED", severity: "blocker", reason,
    repair: "Run node runtime/storyline.mjs on the deck, give its prompt to a fresh critic, save the JSON as out/storyline-review.json and rerun until it says ready for the current spine; then request the deck review" })));

  // A storyline that passed as provisional is delivered as provisional: the
  // record keeps the items the evidence scope left open and the limits the
  // answer declares, so an accepted deck is never read as a settled answer.
  const story = await storylineOutcome(spec, directory, { deckPath: specPath });
  if (story.verdict === "provisional") report.provisional = { open: story.open, answerLimits: story.answerLimits };

  // What was drawn, against the bars the plan promised: a miss is refused here,
  // before a review is spent on it, unless the deck waives the bar - and then
  // the reviewer is shown the waiver and must confirm it.
  report.stage = "build bars";
  const scene = await readJson(path.join(directory, "scene.json"));
  const bars = barOutcome(scene, spec.waivers || [], { purpose: spec.purpose ?? null });
  report.bars = { statistics: bars.statistics, misses: bars.misses.map((f) => f.code), waived: bars.waived.map((f) => f.code) };
  if (bars.unwaived.length) return refuse("build bars", bars.unwaived.map((f) => ({ slide: null, code: f.code, severity: "blocker", kind: BUILD_BAR,
    reason: `${f.measure} measured ${f.measured} against ${f.floor !== undefined ? `a floor of ${f.floor}` : `a ceiling of ${f.ceiling}`} (strong decks: ${JSON.stringify(f.reference ?? null)})`,
    repair: "Rework the pages that hold the measure down and rebuild",
    waiver: `if the deck is right to miss this bar, record \`waivers: [{ "code": "${f.code}", "reason": "<a sentence saying why>" }]\` on \`deck\` in <id>.pages.json, recompile and rebuild - the reviewer is shown the waiver and must confirm it` })));
  const waivers = bars.waived;

  // The author reproduces every claim before anyone reviews the deck: a review
  // spent finding a mistyped figure is a round the deck did not need.
  report.stage = "self-check";
  const ledger = (await readJson(path.join(directory, "claims.json"), { optional: true })) ?? await writeLedger(directory);
  const selfCheck = await readJson(path.join(directory, "self-check.json"), { optional: true });
  const unchecked = validateSelfCheck(selfCheck, ledger);
  if (unchecked.length) return refuse("self-check", unchecked.map((reason) => ({ slide: null, code: registered(CLAIM_CODES, "SELF_CHECK_INCOMPLETE"), severity: "blocker", reason,
    repair: "Work through out/claims.json against the source records, fix what fails, and record out/self-check.json (references/taste-review.md#self-check)" })));

  report.stage = "review";
  const store = await lineageStore(spec, directory, specPath);
  const historyDir = reviewHistory(store);
  if (fullReview) {
    const restart = await restartLineage(historyDir, { reason, userApproved });
    const errors = restart.errors.length ? restart.errors : typeof reason === "string" && reason.trim().length >= 10 ? [] : ["--full-review starts a new lineage and needs --reason \"<why the argument itself changed>\", which is logged"];
    if (errors.length) return refuse("review lineage", errors.map((reason) => ({ slide: null, code: "LINEAGE_RESTART", severity: "blocker", reason,
      repair: "Verify the repairs in the current lineage instead; restart only when the argument itself changed, with --reason, and a second time only when the user asks (--user-approved)" })));
    if (restart.restarted) report.restarted = { reason, archived: restart.archived };
  }
  const request = requestOf(spec);
  const slideIds = scene.slides.map((s) => s.id);
  const binding = await reviewBinding(directory, { request });
  const downgrade = downgradeRule(scene);
  const pageText = pageTexts(scene);
  const prior = await latestReview(store);
  const confirmations = await readConfirmations(historyDir);
  // Each pass the user adds beyond the cap adds one confirmation read with it.
  const maxConfirmations = MAX_CONFIRMATIONS + Math.max(0, maxPasses - MAX_PASSES);
  const shared = { ...context, refuse, store, historyDir, slideIds, binding, waivers, reviewer, model, reviewFile, maxPasses, maxConfirmations, confirmations, request };

  // A lineage that has approved this very build is done: a rerun hands it over
  // again rather than starting another read of it.
  const approved = approval(prior, confirmations, binding);
  if (approved) return redeliver(shared, build, approved);
  // An accepted verification of this very build that no confirmation read has
  // judged yet: the answer now expected is that read.
  if (prior?.accepted === true && prior.pass >= 2 && prior.binding === binding && !confirmations.some((c) => c.afterPass === prior.pass && c.confirms === prior.binding))
    return confirm(shared, prior);

  const ledger0 = prior ? await lineageLedger(store, prior) : [];
  const scope = prior ? verificationScope(prior, await slideHashes(directory), { maxPasses, ledger: ledger0 }) : null;
  // A revision's first pass reads the pages it changed, in what they say or in
  // how they are drawn; a revision that changed no page's words or numbers is
  // a restyle, and every page is read.
  const changes = scope ? null : revisionChanges(spec, await readInventory(spec, specPath));
  const revision = changes && !changes.restyle && changes.content.length < changes.pages.length ? { changed: changes.content } : null;
  if (revision) report.revision = { changed: revision.changed.length, of: changes.pages.length };
  const priorLedger = scope ? ledger0 : [];
  report.reviewMode = scope ? "verification" : revision ? "revision" : "full";
  report.pass = scope ? scope.pass : 1;
  // The cap: a loop that has not converged in three passes will not converge
  // in a fourth by itself. What is open goes to the user, who may ask for more.
  if (scope?.capped) return refuse("review cap", [{ slide: null, code: "REVIEW_PASS_CAP", severity: "blocker",
    reason: capMessage("deck review", scope.pass, maxPasses, priorLedger), repair: "Report the open findings to the user; run another pass only when they ask for it, with --max-passes" }]);
  let review;
  if (reviewFile) {
    // A directory is the parts of a split first pass, merged as `reviewer.mjs merge` merges them.
    if ((await fs.stat(reviewFile)).isDirectory()) {
      const merged = await mergeReviewDirectory(directory, reviewFile, { spec, deckPath: specPath });
      if (merged.errors) return refuse("invalid review", merged.errors.map((e) => ({ slide: null, code: "INVALID_REVIEW", severity: "blocker", reason: `review parts invalid: ${e}`, repair: "Return every section and the spine part to the schema, covering every page" })));
      review = merged.review;
    } else review = await readJson(reviewFile);
  } else {
    const run = await runReview({ outputDirectory: directory, spec, deckPath: specPath, backend: reviewer, model, scope, waivers, revision });
    if (run.status === "packet-written") return pending(shared, run, { mode: report.reviewMode, pass: report.pass, pages: scope ? scope.mustInspect.length : revision ? revision.changed.length : slideIds.length });
    review = run.review;
  }
  const profile = await readJson(path.join(directory, "density-profile.json"), { optional: true });
  review = withInheritedDensity(review, scope);
  const errors = [...validateReview(review, slideIds, { scope, ledger: priorLedger, waivers, downgrade, pageText, revision }), ...await validateReviewBinding(review, directory, { request }), ...validateDensityReview(review, profile, scope, pageText)];
  if (errors.length) return refuse("invalid review", errors.map((e) => ({ slide: null, code: "INVALID_REVIEW", severity: "blocker", reason: `review record invalid: ${e}`, repair: "Return a review that matches the schema; this is a transport problem, not a deck defect" })));
  const unproven = await answerProvenance(store, review, { kind: scope ? "verification" : "review", pass: review.pass });
  if (unproven.length) return refuse("review provenance", unproven.map((reason) => ({ slide: null, code: "REVIEW_PROVENANCE", severity: "blocker", reason,
    repair: "Request the review through deliver-deck (it writes the packet and its prompt hash) and return the reviewer's answer with its provenance unedited" })));
  const outcome = reviewOutcome(review, priorLedger, { waivers, downgrade });
  await recordReview(store, directory, review, priorLedger, { downgrade, accepted: outcome.accepted });
  report.review = { accepted: outcome.accepted, pass: review.pass, maxPasses, verifies: review.verifies ?? null, rating: review.rating, summary: review.summary, findings: review.findings.length,
    open: outcome.ledger.filter((e) => !["fixed", "unavailable"].includes(e.status) && e.severity !== "none").length, blocking: outcome.blocking.length, newBlockers: outcome.newBlockers,
    provenance: review.provenance, file: reviewFile ? path.resolve(reviewFile) : path.join(directory, "review.json") };
  if (!outcome.accepted) return refuse(review.pass >= maxPasses ? `review pass ${review.pass} of ${maxPasses}, the cap - report the open findings to the user` : `review pass ${review.pass} of ${maxPasses}`, outcome.blocking);
  // A verification pass sees what it is shown; a fresh reader confirms the deck it accepted.
  if (review.pass >= 2) return confirm({ ...shared, reviewFile: null, reviewer: reviewFile && reviewer === "auto" ? "packet" : reviewer }, { pass: review.pass, binding: review.binding });
  return deliver(shared, build, { rating: review.rating, from: "review pass 1" });
}

// The answer's provenance against the packet delivery wrote for it: that packet
// is the latest one for this deck, of the kind and pass the answer claims, and
// the answer echoes its prompt hash.
async function answerProvenance(store, answer, { kind, pass = null }) {
  const record = await readPacketRecord(store);
  if (!record) return ["no review packet was written for this deck: request the review through deliver-deck, which writes the packet the answer must echo"];
  if (record.kind !== kind || (pass !== null && record.pass !== pass) || record.binding !== answer.binding) return [`the answer does not answer the latest packet (a ${record.kind}${record.pass ? ` for pass ${record.pass}` : ""} of this build): rerun deliver-deck without --review to write the packet this ${kind} answers`];
  return provenanceErrors(answer, record.promptHash);
}

/**
 * The confirmation read of an accepted verification pass (`accepted`: its pass
 * and binding): one fresh reader, told nothing of the lineage, reads the final
 * artifact whole. It must accept at the same bar; a rejection sends its
 * findings into the ledger for the next pass, and a spent confirmation budget
 * goes to the user.
 */
async function confirm(shared, accepted) {
  const { report, refuse, store, historyDir, directory, slideIds, waivers, reviewer, model, reviewFile, maxConfirmations, confirmations, spec, specPath, request } = shared;
  report.stage = "confirmation";
  report.reviewMode = "confirmation";
  if (confirmations.length >= maxConfirmations) return refuse("confirmation cap", [{ slide: null, code: "REVIEW_PASS_CAP", severity: "blocker",
    reason: `Pass ${accepted.pass} accepted the deck, but this lineage has spent its ${maxConfirmations} confirmation read${maxConfirmations === 1 ? "" : "s"}${confirmations.some((c) => c.accepted !== true) ? " and the last did not accept it" : ""}. Report the deck and the confirmation's findings to the user; another read runs only when they ask for it (--max-passes ${shared.maxPasses + 1}).`,
    repair: "Report to the user; do not start a new lineage to get another read" }]);
  let review;
  if (reviewFile) review = await readJson(reviewFile);
  else {
    const run = await runReview({ outputDirectory: directory, spec, deckPath: specPath, backend: reviewer, model, confirmation: { confirms: accepted.binding }, waivers });
    if (run.status === "packet-written") return pending(shared, run, { mode: "confirmation", pass: accepted.pass, pages: slideIds.length });
    review = run.review;
  }
  const errors = [...validateConfirmation(review, slideIds, { confirms: accepted.binding, waivers }), ...await validateReviewBinding(review, directory, { request })];
  if (errors.length) return refuse("invalid confirmation", errors.map((e) => ({ slide: null, code: "INVALID_REVIEW", severity: "blocker", reason: `confirmation record invalid: ${e}`, repair: "Return a confirmation that matches the schema; this is a transport problem, not a deck defect" })));
  const unproven = await answerProvenance(store, review, { kind: "confirmation" });
  if (unproven.length) return refuse("confirmation provenance", unproven.map((reason) => ({ slide: null, code: "REVIEW_PROVENANCE", severity: "blocker", reason,
    repair: "Request the confirmation through deliver-deck (it writes the packet and its prompt hash) and return the reader's answer with its provenance unedited" })));
  const outcome = confirmationOutcome(review, { waivers });
  await recordConfirmation(historyDir, { review, binding: review.binding, confirms: accepted.binding, afterPass: accepted.pass, accepted: outcome.accepted });
  report.confirmation = { accepted: outcome.accepted, rating: review.rating, summary: review.summary, findings: review.findings.length, blocking: outcome.blocking.length, provenance: review.provenance,
    file: reviewFile ? path.resolve(reviewFile) : path.join(directory, "confirmation.json") };
  if (!outcome.accepted) return refuse("confirmation", [{ slide: null, code: "REVIEW_UNCONFIRMED", severity: "blocker",
    reason: `A fresh read of the final artifact rated it ${review.rating}/10 and did not accept it after pass ${accepted.pass} did: ${review.summary}`,
    repair: "Repair its findings and rebuild; the next pass verifies them, within the cap" }, ...outcome.blocking]);
  return deliver(shared, null, { rating: review.rating, from: `confirmation read after pass ${accepted.pass}` });
}

/**
 * The score of the delivery a lineage has approved for this build (`binding`),
 * or null: its latest pass accepted the build at pass 1, or accepted it as a
 * verification that the confirmation read of the same build accepted too.
 */
function approval(prior, confirmations, binding) {
  if (prior?.accepted !== true || prior.binding !== binding) return null;
  if (prior.pass < 2) return { rating: prior.review.rating, from: "review pass 1" };
  const read = confirmations.filter((c) => c.afterPass === prior.pass && c.confirms === prior.binding).at(-1);
  return read?.accepted === true && read.binding === binding ? { rating: read.review.rating, from: `confirmation read after pass ${prior.pass}` } : null;
}

/**
 * Hand over a build the lineage already approved: the deliverable copied from
 * the build again, and the delivery.json that recorded this build's delivery
 * kept as it is - or, when there is none, written anew with the same score.
 */
async function redeliver(shared, build, score) {
  const { directory, delivered, binding } = shared;
  const recorded = await readJson(path.join(directory, "delivery.json"), { optional: true }).catch(() => null);
  if (!(recorded?.accepted === true && recorded.binding === binding && recorded.deliverable === delivered
    && recorded.score?.rating === score.rating && recorded.score?.from === score.from)) return deliver(shared, build, score);
  await handOver(shared, build);
  return recorded;
}

// The build's PPTX as the deliverable; a rejection note from an earlier run no longer stands.
async function handOver({ directory, delivered, rejectedNote }, build) {
  const pptx = build?.pptxPath ?? (await readJson(path.join(directory, "build-result.json"))).pptxPath;
  await fs.copyFile(pptx, delivered);
  await fs.rm(rejectedNote, { force: true });
}

async function deliver(shared, build, score) {
  const { report, directory, delivered, binding } = shared;
  await handOver(shared, build);
  report.accepted = true; report.stage = "delivered"; report.binding = binding; report.deliverable = delivered; report.score = score;
  await writeJson(path.join(directory, "delivery.json"), report);
  return report;
}

// A read is waiting: no deliverable stands for this build until it answers.
async function pending({ report, directory, delivered, rejectedNote, maxPasses }, run, { mode, pass, pages }) {
  await fs.rm(delivered, { force: true });
  await fs.rm(rejectedNote, { force: true });
  report.review = { status: "pending", mode, pass, maxPasses, pages, sections: run.sections, packet: run.packetDir, answer: run.reviewPath, note: run.note };
  await writeJson(path.join(directory, "delivery.json"), report);
  return report;
}

// What a refusal lists, kept apart: a blocker (a gate's, a stage's or the
// review's finding at the severity it was given), a build bar the deck misses
// and has not waived, and the build's advisories, which do not block.
const BUILD_BAR = "build bar";
// The stages whose repair is to the pages as drawn: a refusal there lists the build's advisories too, since they are repaired in the same pass.
const DRAWN_STAGES = ["page gates", "build bars"];

async function reject({ report, directory, delivered, rejectedNote, advisories = [] }, stage, blockers) {
  await fs.rm(delivered, { force: true });
  const listed = DRAWN_STAGES.includes(stage) ? advisories : [];
  report.accepted = false; report.rejectedAt = stage; report.blockers = blockers;
  if (listed.length) report.advisories = listed;
  const where = (b) => ((b.slides || []).length > 1 ? `slides ${b.slides.join(", ")}` : `slide ${b.slide ?? "deck"}`);
  const line = (b, label = b.severity) => `- ${where(b)} · ${b.code} · ${label}: ${b.reason}${b.repair ? ` → ${b.repair}` : ""}`;
  const bars = blockers.filter((b) => b.kind === BUILD_BAR), blocking = blockers.filter((b) => b.kind !== BUILD_BAR);
  const lines = [`# REJECTED at ${stage}`, "", `${blockers.length} blocking finding(s)${bars.length ? `, ${bars.length} of them a build bar missed` : ""}${listed.length ? `; ${listed.length} advisor${listed.length === 1 ? "y" : "ies"}, which do not block` : ""}. No deliverable was written.`, ""];
  if (blocking.length) lines.push("## Blockers", "", ...blocking.map((b) => line(b)), "");
  if (bars.length) lines.push("## Build bars missed (waivable)", "", ...bars.map((b) => `${line(b, "build bar missed")}; or waive it: ${b.waiver}`), "");
  if (listed.length) lines.push("## Advisories (not blocking)", "", "The build raised these as advisories and delivery does not block on them; the reviewer may still judge the pages.", "", ...listed.map((b) => line(b)), "");
  await fs.writeFile(rejectedNote, lines.join("\n"));
  await writeJson(path.join(directory, "delivery.json"), report);
  return report;
}

const USAGE = "Usage: deliver-deck.mjs <id>.deck.json output-directory [--reviewer auto|codex|claude|packet] [--model m] [--review review.json|confirmation.json|parts-dir] [--skip-build] [--full-review --reason text [--user-approved]] [--max-passes n]";

async function main(argv) {
  if (argv.some((a) => a === "--brief" || a.startsWith("--brief="))) throw new UsageError(`--brief was removed: the reviews read the deck's verbatim \`request\` (set it in <id>.pages.json).\n${USAGE}`);
  const { values, positionals: [spec, out] } = parseCli(argv, { reviewer: { type: "string" }, model: { type: "string" }, review: { type: "string" }, "skip-build": { type: "boolean" },
    "full-review": { type: "boolean" }, reason: { type: "string" }, "user-approved": { type: "boolean" }, "max-passes": { type: "string" } }, { usage: USAGE });
  if (!spec || !out) throw new UsageError(USAGE);
  if (values["full-review"] && !values.reason) throw new UsageError(`--full-review starts a new lineage and needs --reason "<why the argument itself changed>", which is logged.\n${USAGE}`);
  // A refusal is a rule the author can repair: its message, not a stack (runCli).
  const report = await deliverDeck(path.resolve(spec), path.resolve(out), { reviewer: values.reviewer || "auto", model: values.model, reviewFile: values.review, skipBuild: values["skip-build"],
    fullReview: values["full-review"], reason: values.reason, userApproved: values["user-approved"], maxPasses: values["max-passes"] ? Number(values["max-passes"]) : MAX_PASSES });
  console.log(JSON.stringify(report));
  return report.accepted ? EXIT.ok : report.review?.status === "pending" ? EXIT.waiting : EXIT.refused;
}

if (isMain(import.meta.url)) runCli(main);
