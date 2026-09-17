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

const runtime = path.dirname(fileURLToPath(import.meta.url));

export async function buildDeck(specPath, outputDirectory, { preflight = false, render = true, timeoutMs = 300000, python = process.env.RUNTIME_PYTHON || "python3" } = {}) {
  const started = Date.now();
  const spec = JSON.parse(await fs.readFile(specPath, "utf8"));
  const stem = deckStem(spec);
  const baseDir = path.dirname(path.resolve(specPath));
  const directory = path.resolve(outputDirectory);
  await fs.mkdir(directory, { recursive: true });
  // Every report this build is about to write, removed before anything that can
  // throw. A deck that fails to compose leaves no output of its own, so whatever
  // is on disk afterwards is the *previous* run - and a build loop that reads
  // gates.json after the build reads a pass that belongs to a deck that no
  // longer exists. That masked a broken example deck here for four commits.
  await clearReports(directory);

  const deckPlan = toDeckPlan(spec, baseDir);
  const { deck, decisions } = planDeck(deckPlan);
  const scenePath = path.join(directory, "scene.json");
  await fs.writeFile(scenePath, JSON.stringify(deck));
  await fs.writeFile(path.join(directory, "planning.json"), JSON.stringify(decisions, null, 2) + "\n");
  const result = { status: "planned", outputDirectory: directory, scenePath, slides: deck.slides.length, metrics: metricsBackend(), timings: { planMs: Date.now() - started } };

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
    result.renderDirectory = renderDirectory;
    result.montagePath = result.render?.montage;
    result.timings.renderMs = Date.now() - t3;
    const t4 = Date.now();
    const gateReport = path.join(directory, "gates.json");
    const gated = await runProcess(python, [gates, scenePath, renderDirectory, "--report", gateReport], { timeoutMs, expect: [0, 2] });
    result.gates = { ...(await readJson(gateReport)), report: gateReport, passed: gated.code === 0 };
    result.timings.gatesMs = Date.now() - t4;
  }
  // The deck's budget, in one block: what its pages carry against what the
  // reference corpus carries, so a regression is a number in the build output
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
  const readbackOk = result.readback?.accepted === true;
  result.status = result.preflight.passed && readbackOk && (result.gates?.passed ?? true) ? "built" : "built-with-findings";
  return finish(result, directory);
}

async function readJson(file) { try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return {}; } }

// The build's own outputs, in the order it writes them. Nothing else in the
// directory is touched: the renders keep their own folder and a spec sitting
// beside its build is the author's.
export const BUILD_REPORTS = Object.freeze([
  "scene.json", "planning.json", "preflight-gates.json",
  "readback.json", "gates.json", "build-result.json",
]);

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
    console.log(JSON.stringify({ status: result.status, pptx: result.pptxPath, montage: result.montagePath, gates: result.gates ? { passed: result.gates.passed, counts: result.gates.countsByCode } : undefined, budget: result.budget, readback: result.readback?.accepted, timings: result.timings }));
    process.exit(result.status === "built" || result.status === "preflight-passed" ? 0 : 2);
  } catch (error) {
    console.error(error.stack || error.message);
    process.exit(1);
  }
}
