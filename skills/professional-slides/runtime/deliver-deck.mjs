#!/usr/bin/env node
// Build, gate, review, and hand over — or refuse.
//
//   node runtime/deliver-deck.mjs spec.json out/ [--reviewer auto|codex|claude|packet] [--model m]
//                                              [--review review.json|parts-dir] [--skip-build] [--brief "…"]
//                                              [--full-review] [--max-passes n]
//
// The order is fixed. The storyline critique must be ready for the deck's current
// title spine (storyline-review.json, bound to it) before a deck review is prepared or
// accepted; then the author's self-check must cover the claim ledger (claims.json).
// Review pass 1 reads the whole deck exhaustively; after a rejection, each later pass
// verifies: a status for every open finding, new findings only where serious and
// additive (reviewer.mjs, review-passes.mjs). The loop stops at --max-passes (3): a
// deck still rejected then goes back to the user with its open findings. A deck is
// accepted when no major or blocker finding from any pass is open. --full-review starts
// a new lineage with an exhaustive pass, for a repair that changed the argument itself.
//
// Exit 0: accepted; the deliverable is out/<id>-DELIVERED.pptx. Exit 2: rejected; no
// deliverable is written, out/REJECTED.md lists the blockers, and any earlier deliverable
// copy is removed so a stale file can never be mistaken for an accepted one. Exit 1: crash.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deckStem } from "./artifact-path.mjs";
import { assertOutputDirectory } from "./output-path.mjs";
import { buildDeck } from "./build-deck.mjs";
import { runReview, validateReview, validateReviewBinding, validateDensityReview, reviewOutcome, slideHashes, latestReview, verificationScope, withInheritedDensity, recordReview, ledgerOf, mergeReviewParts, MAX_PASSES } from "./reviewer.mjs";
import { capMessage } from "./review-passes.mjs";
import { writeLedger, validateSelfCheck } from "./claims.mjs";
import { storylineGate } from "./storyline.mjs";

export async function deliverDeck(specPath, outputDirectory, { reviewer = "auto", model, reviewFile, skipBuild = false, brief, answer, fullReview = false, maxPasses = MAX_PASSES } = {}) {
  const directory = await assertOutputDirectory(outputDirectory);
  const spec = JSON.parse(await fs.readFile(specPath, "utf8"));
  brief = brief ?? spec.brief ?? spec.context?.originalBrief ?? "";
  answer = answer ?? spec.answer ?? spec.context?.governingAnswer ?? "";
  const stem = deckStem(spec);
  const delivered = path.join(directory, `${stem}-DELIVERED.pptx`);
  const rejectedNote = path.join(directory, "REJECTED.md");
  await fs.rm(delivered, { force: true });
  await fs.rm(rejectedNote, { force: true });

  const build = skipBuild ? JSON.parse(await fs.readFile(path.join(directory, "build-result.json"), "utf8")) : await buildDeck(specPath, directory);
  const report = { accepted: false, stage: "build", build: { status: build.status, pptx: build.pptxPath, montage: build.montagePath } };
  const blockers = [];
  if (build.gates?.passed !== true) blockers.push({ slide: null, code: "MISSING_RENDERED_GATES", severity: "blocker", reason: "Delivery requires passing rendered page gates", repair: "Rebuild with rendering enabled before delivery" });
  if (build.readback && build.readback.accepted !== true) blockers.push(...(build.readback.findings || []).slice(0, 20).map((f) => ({ slide: f.slide ?? null, code: "BROKEN_GEOMETRY", severity: "blocker", reason: `readback ${f.code} on ${f.shape || ""}`, repair: "Fix the emitter or the scene so the saved file matches the scene" })));
  if (build.gates && build.gates.passed === false) blockers.push(...(build.gates.findings || []).map((f) => ({ slide: f.slide ?? null, code: f.code, severity: "major", reason: `gate ${f.code}: measured ${f.measured}, threshold ${f.threshold}`, repair: f.repair || "" })));
  if (build.preflight?.passed === false) blockers.push(...(build.preflight.findings || []).map(f => ({ slide: f.slide ?? null, code: f.code, severity: "major", reason: f.reason || `preflight ${f.code}: measured ${f.measured}, threshold ${f.threshold}`, repair: f.repair || "" })));
  // The build names what else held it back - text lost from the rendered
  // pages, most often - rather than leaving "not complete" to be diagnosed.
  if (build.status !== "built" && !blockers.length) blockers.push(...(build.blockers || []).filter((b) => b.source !== "page gates" && b.source !== "readback").slice(0, 20)
    .map((b) => ({ slide: b.slide ?? null, code: b.code, severity: "blocker", reason: `${b.source} ${b.code}${b.id ? ` on ${b.id}` : ""}${b.text ? `: "${b.text}"` : ""}`, repair: b.repair || "Fix the page so the saved deck carries every planned text, then rebuild" })));
  if (build.status !== "built" && !blockers.length) blockers.push({slide:null, code:"BROKEN_GEOMETRY", severity:"blocker", reason:`Build is not complete: ${build.status}`, repair:"Complete the build and all gates before delivery"});
  if (blockers.length) return reject(report, directory, rejectedNote, "page gates", blockers);

  // The storyline was stress-tested before it was drawn: an independent
  // critique of the dot-dash, bound to its current structure, says it is ready.
  // Checked before any deck review is prepared or accepted, so a deck review is
  // never spent on an argument that is about to change.
  report.stage = "storyline";
  const storyErrors = await storylineGate(spec, directory);
  if (storyErrors.length) return reject(report, directory, rejectedNote, "storyline", storyErrors.map((reason) => ({ slide: null, code: "STORYLINE_UNREVIEWED", severity: "blocker", reason,
    repair: "Run node runtime/storyline.mjs on the deck, give its prompt to a fresh critic, save the JSON as out/storyline-review.json and rerun until it says ready for the current spine; then request the deck review" })));

  // The author reproduces every claim before anyone reviews the deck: a review
  // spent finding a mistyped figure is a round the deck did not need.
  report.stage = "self-check";
  const ledger = await fs.readFile(path.join(directory, "claims.json"), "utf8").then(JSON.parse).catch(() => writeLedger(directory));
  const selfCheck = await fs.readFile(path.join(directory, "self-check.json"), "utf8").then(JSON.parse).catch(() => null);
  const unchecked = validateSelfCheck(selfCheck, ledger);
  if (unchecked.length) return reject(report, directory, rejectedNote, "self-check", unchecked.map((reason) => ({ slide: null, code: "SELF_CHECK_INCOMPLETE", severity: "blocker", reason,
    repair: "Work through out/claims.json against the source records, fix what fails, and record out/self-check.json (references/taste-review.md#self-check)" })));

  report.stage = "review";
  const prior = fullReview ? null : await latestReview(directory);
  const scope = prior ? verificationScope(prior, await slideHashes(directory), { maxPasses }) : null;
  const priorLedger = scope ? ledgerOf(prior) : [];
  report.reviewMode = scope ? "verification" : "full";
  report.pass = scope ? scope.pass : 1;
  // The cap: a loop that has not converged in three passes will not converge
  // in a fourth by itself. What is open goes to the user, who may ask for more.
  if (scope?.capped) return reject(report, directory, rejectedNote, "review cap", [{ slide: null, code: "REVIEW_PASS_CAP", severity: "blocker",
    reason: capMessage("deck review", scope.pass, maxPasses, priorLedger), repair: "Report the open findings to the user; run another pass only when they ask for it, with --max-passes" }]);
  const slideIds = slideIdsOf(await fs.readFile(path.join(directory, "scene.json"), "utf8"));
  let review;
  if (reviewFile) {
    // A directory is the parts of a split first pass, merged as `reviewer.mjs merge` would.
    if ((await fs.stat(reviewFile)).isDirectory()) {
      const files = (await fs.readdir(reviewFile)).filter((f) => f.endsWith(".json") && !f.includes("last-message")).sort();
      const merged = mergeReviewParts(await Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(reviewFile, f), "utf8")))), slideIds);
      if (merged.errors.length) return reject(report, directory, rejectedNote, "invalid review", merged.errors.map((e) => ({ slide: null, code: "EDITORIAL", severity: "blocker", reason: `review parts invalid: ${e}`, repair: "Return every section and the spine part to the schema, covering every page" })));
      review = merged.review;
    } else review = JSON.parse(await fs.readFile(reviewFile, "utf8"));
  } else {
    const run = await runReview({ outputDirectory: directory, spec, brief, answer, backend: reviewer, model, scope });
    if (run.status === "packet-written") {
      report.review = { status: "pending", mode: report.reviewMode, pass: report.pass, maxPasses, pages: scope ? scope.mustInspect.length : slideIds.length, sections: run.sections, packet: run.packetDir, note: run.note };
      await fs.writeFile(path.join(directory, "delivery.json"), JSON.stringify(report, null, 2) + "\n");
      return report;
    }
    review = run.review;
  }
  const profile = await fs.readFile(path.join(directory, "density-profile.json"), "utf8").then(JSON.parse).catch(() => null);
  review = withInheritedDensity(review, scope);
  const errors = [...validateReview(review, slideIds, { scope, ledger: priorLedger }), ...await validateReviewBinding(review, directory), ...validateDensityReview(review, profile)];
  if (errors.length) return reject(report, directory, rejectedNote, "invalid review", errors.map((e) => ({ slide: null, code: "EDITORIAL", severity: "blocker", reason: `review record invalid: ${e}`, repair: "Return a review that matches the schema; this is a transport problem, not a deck defect" })));
  await recordReview(directory, review, priorLedger);
  const outcome = reviewOutcome(review, priorLedger);
  report.review = { accepted: outcome.accepted, pass: review.pass, maxPasses, verifies: review.verifies ?? null, summary: review.summary, findings: review.findings.length,
    open: outcome.ledger.filter((e) => e.status !== "fixed" && e.severity !== "none").length, blocking: outcome.blocking.length, newBlockers: outcome.newBlockers,
    file: reviewFile ? path.resolve(reviewFile) : path.join(directory, "review.json") };
  if (!outcome.accepted) return reject(report, directory, rejectedNote, review.pass >= maxPasses ? `review pass ${review.pass} of ${maxPasses}, the cap - report the open findings to the user` : `review pass ${review.pass} of ${maxPasses}`, outcome.blocking);

  await fs.copyFile(build.pptxPath, delivered);
  report.accepted = true; report.stage = "delivered"; report.deliverable = delivered;
  await fs.writeFile(path.join(directory, "delivery.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}

const slideIdsOf = (sceneText) => JSON.parse(sceneText).slides.map((s) => s.id);

async function reject(report, directory, notePath, stage, blockers) {
  report.accepted = false; report.rejectedAt = stage; report.blockers = blockers;
  const lines = [`# REJECTED at ${stage}`, "", `${blockers.length} blocking finding(s). No deliverable was written.`, ""];
  for (const b of blockers) lines.push(`- slide ${b.slide ?? "deck"} · ${b.code} · ${b.severity}: ${b.reason}${b.repair ? ` → ${b.repair}` : ""}`);
  await fs.writeFile(notePath, lines.join("\n") + "\n");
  await fs.writeFile(path.join(directory, "delivery.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [spec, out, ...args] = process.argv.slice(2);
  const get = (k) => { const i = args.indexOf("--" + k); return i < 0 ? undefined : args[i + 1]; };
  if (!spec || !out) { console.error("Usage: deliver-deck.mjs spec.json output-directory [--reviewer auto|codex|claude|packet] [--model m] [--review review.json|parts-dir] [--skip-build] [--brief text] [--full-review] [--max-passes n]"); process.exit(1); }
  try {
    const report = await deliverDeck(path.resolve(spec), path.resolve(out), { reviewer: get("reviewer") || "auto", model: get("model"), reviewFile: get("review"), skipBuild: args.includes("--skip-build"), brief: get("brief"), fullReview: args.includes("--full-review"), maxPasses: get("max-passes") ? Number(get("max-passes")) : MAX_PASSES });
    console.log(JSON.stringify(report));
    process.exit(report.accepted ? 0 : report.review?.status === "pending" ? 3 : 2);
  } catch (error) {
    console.error(error.stack || error.message);
    process.exit(1);
  }
}
