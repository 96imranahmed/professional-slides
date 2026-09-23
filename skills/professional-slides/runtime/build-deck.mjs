#!/usr/bin/env node
// spec → plan → scene → editable PPTX → renders → readback → page gates.
//
//   node runtime/build-deck.mjs spec.json out/ [--preflight] [--no-render] [--python python3]
//
// Vendor-neutral: node for layout, python-pptx to emit, LibreOffice to render. Writes
// scene.json, planning.json, deck.pptx, rendered/slide-N.png, montage.png, readback.json,
// gates.json and build-result.json into out/. Exit 0 when the gates pass, 2 when they
// report findings (the deck is still written so it can be inspected), 1 on a crash.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planDeck } from "./planner.mjs";
import { toDeckPlan, coverageFindings, budgetFindings } from "./compose.mjs";
import { metricsBackend } from "./font-metrics.mjs";
import { runProcess, lastJson } from "./process.mjs";

import { deckStem } from "./artifact-path.mjs";
import { assertOutputDirectory } from "./output-path.mjs";
import { auditContent } from "./content-audit.mjs";
import { runContentGates } from "./gates/content_gates.mjs";
import { runPlanGates } from "./gates/plan_gates.mjs";
import { auditTextPlan, auditExportText } from "./text-contract.mjs";
import { writeLedger } from "./claims.mjs";

const runtime = path.dirname(fileURLToPath(import.meta.url));

// New work must retain its approved storyline through authoring. Revisions can
// carry partial plans; they still transfer semantic fields by stable ID only.
export function validateStageContract(spec, stages) {
  if (spec.workflow !== "new_deck") return;
  const pages = [...(spec.cover ? [{...spec.cover,id:"cover",kind:"cover"}] : []), ...spec.slides, ...(spec.appendix || [])];
  if (pages.some(s => !s.id) || new Set(pages.map(s => s.id)).size !== pages.length)
    throw new Error("New decks require unique stable slide ids before composition");
  for (const stage of ["content", "plan"]) {
    const expected = stage === "content" && stages.content?.textContract !== "complete" ? spec.slides.filter(s => !s.kind || s.kind === "content") : pages;
    const records = stages[stage]?.pages || [];
    const byId = new Map(records.map(r => [r.id, r]));
    if (records.some(r => !r.id) || byId.size !== records.length
        || records.some(r => !pages.some(s => s.id === r.id)))
      throw new Error(`${stage} plan requires unique known stable slide ids`);
    for (const slide of expected) {
      const record = byId.get(slide.id);
      if (!record || record[stage === "content" ? "claim" : "title"] !== slide.title)
        throw new Error(`${stage} plan is missing or has a changed title for ${slide.id}; reconcile the storyline before composition`);
    }
  }
  const first = spec.slides.find(s => !s.kind || s.kind === "content");
  const summary = s => s.role === "executive-summary" || s.shape === "executive-summary";
  const section = spec.slides.findIndex(s => s.kind === "section" || s.kind === "divider");
  if (!first || !summary(first) || (section >= 0 && spec.slides.indexOf(first) > section))
    throw new Error("New decks require an opening executive summary before the first section");
}

export async function buildDeck(specPath, outputDirectory, { preflight = false, render = true, timeoutMs = 300000, python = process.env.RUNTIME_PYTHON || "python3" } = {}) {
  const started = Date.now();
  const spec = JSON.parse(await fs.readFile(specPath, "utf8"));
  const stem = deckStem(spec);
  const baseDir = path.dirname(path.resolve(specPath));
  const directory = await assertOutputDirectory(outputDirectory);
  await fs.mkdir(directory, { recursive: true });
  // Every report this build is about to write, removed before anything that can
  // throw. A deck that fails to compose leaves no output of its own, so whatever
  // is on disk afterwards is the *previous* run - and a build loop that reads
  // gates.json after the build reads a pass that belongs to a deck that no
  // longer exists. That masked a broken example deck here for four commits.
  await clearReports(directory);

  // The stages before this one, gated - and, when they are absent, said to be
  // absent.
  //
  // `content_gates.mjs` and `plan_gates.mjs` were wired into nothing: a grep for
  // either returned one hit, a sentence in a reference file. A gate nobody runs
  // on a file nobody writes is not a gate, and that is how a deck reached a
  // reader with one chart in fifty pages while the gate that measures exactly
  // that sat in the repository, passing, unrun.
  //
  // So the build looks for them beside the spec, runs whichever it finds, and
  // records `absent` for whichever it does not. A deck built with no content
  // plan is allowed - not every page of a rebuild needs one - but the build
  // output says so, which is the difference between a stage that was skipped
  // and a stage that does not exist.
  const result = { status: "planned", outputDirectory: directory, timings: {}, stages: {} };
  const stages = {};
  for (const [stage, suffix, run] of [["content", ".content.json", runContentGates],
                                      ["plan", ".plan.json", runPlanGates]]) {
    const at = path.join(baseDir, `${stem}${suffix}`);
    const raw = await fs.readFile(at, "utf8").catch(() => null);
    if (raw === null && spec.workflow === "new_deck") throw new Error(`New decks require ${at} before composition`);
    if (raw === null) { result.stages[stage] = { state: "absent", expectedAt: at }; continue; }
    const parsed = JSON.parse(raw);
    if (stage === "content" && spec.workflow === "new_deck") parsed.textContract = "complete";
    const report = run(parsed, {required:stage === "content" && spec.workflow === "new_deck"});
    const reportAt = path.join(directory, `${stage}-gates.json`);
    await fs.writeFile(reportAt, JSON.stringify(report, null, 2) + "\n");
    result.stages[stage] = { state: report.accepted ? "accepted" : "rejected", report: reportAt,
                             countsByCode: report.countsByCode ?? {} };
    if (!report.accepted) {
      throw new Error(`${stage} gates rejected ${path.basename(at)}: `
        + `${JSON.stringify(report.countsByCode)}. See ${reportAt}.`);
    }
    stages[stage] = parsed;
  }
  validateStageContract(spec, stages);

  // The content stage stops being a checkpoint and becomes an input.
  //
  // It records one highlight per page - "the phrase the reader should see
  // first" - and the build gated the file and then discarded it, so the phrase
  // reached nothing. A page that does not name its own highlight takes the one
  // its content plan named, matched by stable ID so insertions cannot move emphasis to another slide.
  if (stages.content?.pages?.length) {
    const byId = new Map([...(spec.cover ? [{...spec.cover,id:"cover",kind:"cover"}] : []), ...spec.slides, ...(spec.appendix || [])].filter(s => s.id).map(s => [s.id, s]));
    const seen = new Set();
    for (const page of stages.content.pages) {
      if (!page.id) continue; // Legacy plans are audited but never transferred by position.
      if (seen.has(page.id) || !byId.has(page.id)) throw new Error(`Content plan has duplicate or unknown slide id: ${page.id}`);
      seen.add(page.id);
      const slide = byId.get(page.id);
      const phrase = String(page.highlight ?? "").trim();
      if (phrase && slide.highlight === undefined) slide.highlight = phrase;
    }
  }

  const deckPlan = toDeckPlan(spec, baseDir);
  const { deck, decisions } = planDeck(deckPlan);
  // An evaluation of the skill is judged on a deck long enough to show its
  // rhythm, repetition and weakest page; a short one is a diagnostic. The rule
  // lived in the skill's prose and nothing held a deck to it, so three
  // evaluation decks in a row came out at twenty pages.
  if (spec.purpose === "evaluation" && deck.slides.length < EVALUATION_MIN_PAGES) {
    throw new Error(`EVALUATION_TOO_SHORT: an evaluation deck renders at least ${EVALUATION_MIN_PAGES} pages, cover and appendix included; this one composes ${deck.slides.length}. Widen the evidence, not the repetition, or drop purpose: "evaluation" for a diagnostic.`);
  }
  const contentAudit = auditContent(spec, deck);
  const textAudit = auditTextPlan(stages.content || {}, deck);
  await fs.writeFile(path.join(directory, "text-coverage.json"), JSON.stringify(textAudit, null, 2) + "\n");
  if (!textAudit.accepted) throw new Error(`Composition changed the dot-dash text: ${JSON.stringify(textAudit.findings)}`);
  await fs.writeFile(path.join(directory, "content-audit.json"), JSON.stringify(contentAudit, null, 2) + "\n");
  if (!contentAudit.accepted) throw new Error(`Composition lost authored content or visual intent: ${JSON.stringify(contentAudit.findings)}`);
  const scenePath = path.join(directory, "scene.json");
  await fs.writeFile(scenePath, JSON.stringify(deck));
  await fs.writeFile(path.join(directory, "planning.json"), JSON.stringify(decisions, null, 2) + "\n");
  Object.assign(result, { scenePath, slides: deck.slides.length, metrics: metricsBackend() });
  // The claim ledger the author works through before the review (references/taste-review.md#self-check).
  result.claims = (await writeLedger(directory)).counts;
  result.timings.planMs = Date.now() - started;

  // Story gates need only the scene (titles, words, hedges, monotony).
  const gates = path.join(runtime, "gates", "page_gates.py");
  const preflightReport = path.join(directory, "preflight-gates.json");
  const pre = await runProcess(python, [gates, scenePath, "--report", preflightReport], { timeoutMs, expect: [0, 2] });
  result.preflight = { ...(await readJson(preflightReport)), report: preflightReport, passed: pre.code === 0 };
  const coverage = coverageFindings(spec);
  if (coverage.length) { result.preflight.findings = [...(result.preflight.findings || []), ...coverage]; result.preflight.passed = false; result.preflight.accepted = false; result.preflight.countsByCode = { ...(result.preflight.countsByCode || {}), MISSING_EVIDENCE: coverage.length }; }
  // The page budget: what each page plans to carry, and the remedy that page's
  // own data offers. Advisory - it reads the spec, not the rendered page - so it
  // reports without failing the preflight.
  const budget = budgetFindings(spec);
  if (budget.length) { result.preflight.findings = [...(result.preflight.findings || []), ...budget]; result.preflight.countsByCode = { ...(result.preflight.countsByCode || {}), THIN_PLAN: budget.length }; }
  await fs.writeFile(preflightReport, JSON.stringify(result.preflight, null, 2) + "\n");
  if (preflight) { result.status = result.preflight.passed ? "preflight-passed" : "preflight-findings"; return finish(result, directory); }

  const pptxPath = path.join(directory, `${stem}.pptx`);
  const t1 = Date.now();
  const emitted = await runProcess(python, [path.join(runtime, "emit", "emit_pptx.py"), scenePath, pptxPath], { timeoutMs });
  result.emit = lastJson(emitted.stdout);
  result.pptxPath = pptxPath;
  result.timings.emitMs = Date.now() - t1;

  const t2 = Date.now();
  const readback = await runProcess(python, [path.join(runtime, "emit", "readback_pptx.py"), scenePath, pptxPath], { timeoutMs, expect: [0, 2] });
  result.readback = lastJson(readback.stdout);
  await fs.writeFile(path.join(directory, "readback.json"), JSON.stringify(result.readback, null, 2) + "\n");
  result.timings.readbackMs = Date.now() - t2;

  if (render) {
    const t3 = Date.now();
    const renderDirectory = path.join(directory, "rendered");
    const rendered = await runProcess(python, [path.join(runtime, "emit", "render_pptx.py"), pptxPath, renderDirectory, "--montage"], { timeoutMs });
    result.render = lastJson(rendered.stdout);
    result.textCoverage = auditExportText(stages.content || {}, deck, await readJson(result.render.pageText));
    await fs.writeFile(path.join(directory, "rendered-text-coverage.json"), JSON.stringify(result.textCoverage, null, 2) + "\n");
    result.renderDirectory = renderDirectory;
    result.montagePath = result.render?.montage;
    result.timings.renderMs = Date.now() - t3;
    const t4 = Date.now();
    const gateReport = path.join(directory, "gates.json");
    const gated = await runProcess(python, [gates, scenePath, renderDirectory, "--report", gateReport], { timeoutMs, expect: [0, 2] });
    result.gates = { ...(await readJson(gateReport)), report: gateReport, passed: gated.code === 0 };
    result.timings.gatesMs = Date.now() - t4;
    // The density profile: the rendered pages measured against the skill's
    // density targets. It fails nothing; the review's density pass
    // reads it and judges every page it flags (references/taste-review.md).
    const profileReport = path.join(directory, "density-profile.json");
    const contentAt = path.join(baseDir, `${stem}.content.json`);
    const withContent = result.stages.content?.state === "accepted" ? [contentAt] : [];
    const profiled = await runProcess(python, [path.join(runtime, "gates", "density_profile.py"), result.render.pdf, scenePath, ...withContent, "--report", profileReport], { timeoutMs });
    result.densityProfile = { report: profileReport, ...lastJson(profiled.stdout) };
  }
  // The deck's budget, in one block: what its pages carry against the
  // reference targets, so a regression is a number in the build output
  // rather than a screenshot somebody notices later.
  const density = result.gates?.density;
  if (density) {
    result.budget = {
      bodyWords: density.bodyWords?.median ?? null,
      bodyFloor: density.bodyWords?.floor ?? null,
      referenceBodyWords: density.bodyWords?.referenceMedian ?? null,
      footerWords: density.footerWords?.median ?? null,
      referenceFooterWords: density.footerWords?.referenceMedian ?? null,
      columnFill: density.columnFill?.median ?? null,
      plotSpan: density.plotSpan?.median ?? null,
      plannedShortfalls: (result.preflight?.countsByCode || {}).THIN_PLAN || 0,
    };
  }
  const readbackOk = result.readback?.accepted === true && result.textCoverage?.accepted !== false;
  result.status = result.preflight.passed && readbackOk
    ? (result.gates?.passed === true ? "built" : render ? "built-with-findings" : "built-unrendered")
    : "built-with-findings";
  return finish(result, directory);
}

async function readJson(file) { try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return {}; } }

// The build's own outputs, in the order it writes them. Nothing else in the
// directory is touched: the renders keep their own folder and a spec sitting
// beside its build is the author's.
export const BUILD_REPORTS = Object.freeze([
  "scene.json", "planning.json", "preflight-gates.json", "content-audit.json",
  "readback.json", "gates.json", "build-result.json", "text-coverage.json", "rendered-text-coverage.json",
  "density-profile.json", "claims.json",
]);

// Skill evaluations are judged on at least this many rendered pages
// (SKILL.md "Evaluation and delivery"); `purpose: "evaluation"` enforces it.
export const EVALUATION_MIN_PAGES = 50;

async function clearReports(directory) {
  await Promise.all(BUILD_REPORTS.map((name) => fs.rm(path.join(directory, name), { force: true })));
}

async function finish(result, directory) {
  result.timings.totalMs = Object.values(result.timings).reduce((a, b) => a + b, 0);
  await fs.writeFile(path.join(directory, "build-result.json"), JSON.stringify(result, null, 2) + "\n");
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length < 2) { console.error("Usage: build-deck.mjs spec.json output-directory [--preflight] [--no-render]"); process.exit(1); }
  try {
    const pythonIndex = args.indexOf("--python");
    if (pythonIndex >= 0 && (!args[pythonIndex + 1] || args[pythonIndex + 1].startsWith("--"))) throw new Error("--python requires an executable");
    const result = await buildDeck(path.resolve(args[0]), path.resolve(args[1]), { preflight: args.includes("--preflight"), render: !args.includes("--no-render"), python: pythonIndex < 0 ? undefined : args[pythonIndex + 1] });
    console.log(JSON.stringify({ status: result.status, stages: Object.fromEntries(Object.entries(result.stages || {}).map(([k, v]) => [k, v.state])), pptx: result.pptxPath, montage: result.montagePath, gates: result.gates ? { passed: result.gates.passed, counts: result.gates.countsByCode } : undefined, budget: result.budget, readback: result.readback?.accepted, timings: result.timings }));
    process.exit(["built", "built-unrendered", "preflight-passed"].includes(result.status) ? 0 : 2);
  } catch (error) {
    console.error(error.stack || error.message);
    process.exit(1);
  }
}
