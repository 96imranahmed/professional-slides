#!/usr/bin/env node
// Build, gate, review, and hand over — or refuse.
//
//   node runtime/deliver-deck.mjs spec.json out/ [--reviewer auto|codex|claude|packet] [--model m]
//                                              [--review review.json] [--skip-build] [--brief "…"]
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
import { runReview, validateReview, reviewOutcome } from "./reviewer.mjs";

export async function deliverDeck(specPath, outputDirectory, { reviewer = "auto", model, reviewFile, skipBuild = false, brief, answer } = {}) {
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
  if (build.status !== "built" && !blockers.length) blockers.push({slide:null, code:"BROKEN_GEOMETRY", severity:"blocker", reason:`Build is not complete: ${build.status}`, repair:"Complete the build and all gates before delivery"});
  if (blockers.length) return reject(report, directory, rejectedNote, "page gates", blockers);

  report.stage = "review";
  let review;
  if (reviewFile) review = JSON.parse(await fs.readFile(reviewFile, "utf8"));
  else {
    const run = await runReview({ outputDirectory: directory, brief, answer, backend: reviewer, model });
    if (run.status === "packet-written") {
      report.review = { status: "pending", packet: run.packetDir, note: run.note };
      await fs.writeFile(path.join(directory, "delivery.json"), JSON.stringify(report, null, 2) + "\n");
      return report;
    }
    review = run.review;
  }
  const slideIds = JSON.parse(await fs.readFile(path.join(directory, "scene.json"), "utf8")).slides.map((s) => s.id);
  const errors = validateReview(review, slideIds);
  if (errors.length) return reject(report, directory, rejectedNote, "invalid review", errors.map((e) => ({ slide: null, code: "EDITORIAL", severity: "blocker", reason: `review record invalid: ${e}`, repair: "Return a review that matches the schema; this is a transport problem, not a deck defect" })));
  const outcome = reviewOutcome(review);
  report.review = { accepted: outcome.accepted, summary: review.summary, findings: review.findings.length, blocking: outcome.blocking.length, file: path.join(directory, "review.json") };
  if (!outcome.accepted) return reject(report, directory, rejectedNote, "review", outcome.blocking);

  await fs.copyFile(build.pptxPath, delivered);
  report.accepted = true; report.stage = "delivered"; report.deliverable = delivered;
  await fs.writeFile(path.join(directory, "delivery.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}

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
  if (!spec || !out) { console.error("Usage: deliver-deck.mjs spec.json output-directory [--reviewer auto|codex|claude|packet] [--model m] [--review review.json] [--skip-build] [--brief text]"); process.exit(1); }
  try {
    const report = await deliverDeck(path.resolve(spec), path.resolve(out), { reviewer: get("reviewer") || "auto", model: get("model"), reviewFile: get("review"), skipBuild: args.includes("--skip-build"), brief: get("brief") });
    console.log(JSON.stringify(report));
    process.exit(report.accepted ? 0 : report.review?.status === "pending" ? 3 : 2);
  } catch (error) {
    console.error(error.stack || error.message);
    process.exit(1);
  }
}
