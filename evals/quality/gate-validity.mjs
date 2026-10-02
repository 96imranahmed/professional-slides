#!/usr/bin/env node
/**
 * How well the gates find what people found.
 *
 *   node evals/quality/gate-validity.mjs [--json] [--overlap] [--renders NAME=DIR ...]
 *                                        [--defects FILE] [--specimens DIR]
 *
 * Every stored cold-run specimen is replayed through the gates as they are
 * today - page gates on its scene (and on renders, when given), plan gates on
 * its plan, variety and craft gates on its compiled deck spec, the build bars
 * on its scene, and with --overlap the Chromium overlap audit - and every
 * finding is set against the labelled table in defects.json.
 *
 * Per gate: `labelled` defects expect it, `caught` of those it fired on,
 * `fired` findings it raised on the replayed specimens, `onLabel` of those that
 * land on a defect labelled for it. Recall is caught/labelled; precision is
 * onLabel/fired. The table is not exhaustive, so precision is a floor: a
 * finding on an unlabelled page may be right and simply unrecorded. Defects
 * with no expected gate are listed with what fired on their pages, which is
 * where a new gate's code should come from.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPlanGates } from "../../skills/professional-slides/runtime/gates/plan_gates.mjs";
import { varietyFindings } from "../../skills/professional-slides/runtime/gates/variety_gates.mjs";
import { craftFindings } from "../../skills/professional-slides/runtime/gates/craft_gates.mjs";
import { structureOf, drawnOf, chartFormFindings } from "../../skills/professional-slides/runtime/page-types.mjs";
import { sceneCollisions, sceneChartFindings } from "../../skills/professional-slides/runtime/validate-overlap.mjs";
import { scoreBuild } from "../cold-run/score.mjs";
import { SPECIMENS, loadSpecimen, listSpecimens } from "../cold-run/specimens.mjs";
import { isMain, pythonBin } from "../../skills/professional-slides/runtime/cli.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const PAGE_GATES = path.join(ROOT, "skills", "professional-slides", "runtime", "gates", "page_gates.py");

/**
 * Rendered page numbers for whatever a finding points at: a 1-based slide
 * number, a page or slide id, a plan page number, or a list of any of these.
 */
export function pageResolver({ scene, plan }) {
  const byId = new Map((scene?.slides ?? []).map((slide, i) => [slide.id, i + 1]));
  const planById = new Map((plan?.pages ?? []).map((page) => [page.id, page.n]));
  const planByN = new Map((plan?.pages ?? []).map((page) => [page.n, page.id]));
  const one = (ref, kind) => {
    if (ref === null || ref === undefined) return [];
    if (typeof ref === "number") {
      if (kind === "plan" && scene) return byId.has(planByN.get(ref)) ? [byId.get(planByN.get(ref))] : [];
      return [ref];
    }
    if (byId.has(ref)) return [byId.get(ref)];
    if (!scene && planById.has(ref)) return [planById.get(ref)];
    return [];
  };
  return (refs, kind) => [...new Set((Array.isArray(refs) ? refs : [refs]).flatMap((r) => one(r, kind)))].sort((a, b) => a - b);
}

function pageGateFindings(scene, renders) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ps-gate-validity-"));
  try {
    const scenePath = path.join(dir, "scene.json");
    const report = path.join(dir, "report.json");
    writeFileSync(scenePath, JSON.stringify(scene));
    const python = pythonBin();
    const out = spawnSync(python, [PAGE_GATES, scenePath, ...(renders ? [renders] : []), "--report", report], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (![0, 2].includes(out.status)) throw new Error(`page_gates.py exited ${out.status}: ${out.stderr.slice(-800)}`);
    const parsed = JSON.parse(readFileSync(report, "utf8"));
    return { findings: parsed.findings, pixelGatesSkipped: parsed.pixelGatesSkipped ?? null };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The Chromium overlap audit, one RENDERED_OVERLAP finding per slide it refuses. */
export async function overlapFindings(scene) {
  const runtime = path.join(ROOT, "skills", "professional-slides", "runtime");
  const { renderSlideHtml } = await import(path.join(runtime, "adapters", "html.mjs"));
  const { auditSlideOverlaps } = await import(path.join(runtime, "validate-overlap.mjs"));
  const require = createRequire(import.meta.url);
  const modules = process.env.RUNTIME_NODE_MODULES || path.join(ROOT, "node_modules");
  const { chromium } = require(require.resolve("playwright", { paths: [modules] }));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_BROWSER_PATH });
  const findings = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    for (const [i, slide] of scene.slides.entries()) {
      await page.setContent(renderSlideHtml(slide));
      const audit = await auditSlideOverlaps(page, slide);
      if (!audit.accepted) findings.push({ slide: i + 1, code: "RENDERED_OVERLAP", measured: { unexpected: audit.unexpected.length, textOverflow: audit.textOverflow.length } });
    }
  } finally {
    await browser.close();
  }
  return findings;
}

/** Every finding the gates raise on one specimen, as {source, code, pages}; empty pages is deck-level. */
export async function replay(specimen, { renders = null, overlap = false } = {}) {
  const resolve = pageResolver(specimen);
  const findings = [];
  const ran = [];
  if (specimen.scene) {
    const page = pageGateFindings(specimen.scene, renders);
    ran.push(renders ? "page (scene and renders)" : "page (scene)");
    for (const f of page.findings) findings.push({ source: "page", code: f.code, pages: resolve(f.slide, "scene") });
    const build = scoreBuild(specimen.scene);
    ran.push("build");
    for (const f of build.findings) findings.push({ source: "build", code: `BUILD:${f.measure}`, pages: [] });
    // The design checks read the scene's own geometry: labels on lines and
    // edges, display numerals on rules, scatters with no series key.
    ran.push("design (scene)");
    for (const f of specimen.scene.slides.flatMap((slide) => [...sceneCollisions(slide), ...sceneChartFindings(slide)]))
      findings.push({ source: "design", code: f.code, pages: resolve(f.slide, "id") });
    if (overlap) {
      ran.push("overlap");
      for (const f of await overlapFindings(specimen.scene)) findings.push({ source: "overlap", code: f.code, pages: [f.slide] });
    }
  }
  if (specimen.plan) {
    ran.push("plan");
    for (const f of runPlanGates(specimen.plan).findings) {
      const refs = Array.isArray(f.measured?.pages) ? f.measured.pages : f.page;
      findings.push({ source: "plan", code: f.code, pages: resolve(refs, "plan") });
    }
  }
  if (specimen.deck) {
    ran.push("variety", "craft");
    for (const f of varietyFindings(specimen.deck, { structureOf, drawnOf })) findings.push({ source: "variety", code: f.code, pages: resolve(f.slide, "id") });
    // The compile's chart-form refusals, read off the stored deck spec.
    ran.push("chart form");
    for (const f of chartFormFindings(specimen.deck)) findings.push({ source: "compile", code: f.code, pages: resolve(f.slide, "id") });
    if (specimen.scene) for (const f of craftFindings(specimen.deck, specimen.scene)) findings.push({ source: "craft", code: f.code, pages: resolve(f.slide ?? null, "id") });
  }
  return { ran, findings };
}

const overlaps = (a, b) => a.some((page) => b.includes(page));

/** Does `finding` land on `defect`: same page for a page defect, anywhere for a deck-level one. */
export function lands(finding, defect) {
  if (!defect.pages) return true;
  return overlaps(finding.pages, defect.pages);
}

/**
 * Per-gate recall and precision of `findingsBySpecimen` against `defects`.
 * Only defects on replayed specimens, labelled page by page for the stored
 * build, are scored; the rest are reported as not replayed.
 */
export function validity(defects, findingsBySpecimen) {
  const scored = [];
  const notReplayed = [];
  for (const defect of defects) {
    const replayed = findingsBySpecimen[defect.specimen];
    if (!replayed || defect.revision === "earlier") { notReplayed.push(defect); continue; }
    const here = replayed.findings.filter((f) => lands(f, defect) && (defect.pages ? f.pages.length : true));
    const caught = defect.expectedGate ? replayed.findings.some((f) => f.code === defect.expectedGate && lands(f, defect)) : null;
    scored.push({ ...defect, caught, firedHere: [...new Set(here.map((f) => f.code))].sort() });
  }
  const gates = {};
  for (const defect of scored.filter((d) => d.expectedGate)) {
    const gate = (gates[defect.expectedGate] ??= { labelled: 0, caught: 0, fired: 0, onLabel: 0 });
    gate.labelled += 1;
    if (defect.caught) gate.caught += 1;
  }
  for (const [code, gate] of Object.entries(gates)) {
    for (const [specimen, replayed] of Object.entries(findingsBySpecimen)) {
      const labels = scored.filter((d) => d.specimen === specimen && d.expectedGate === code);
      for (const finding of replayed.findings.filter((f) => f.code === code)) {
        gate.fired += 1;
        if (labels.some((d) => lands(finding, d))) gate.onLabel += 1;
      }
    }
    gate.recall = gate.labelled ? Math.round((gate.caught / gate.labelled) * 100) / 100 : null;
    gate.precision = gate.fired ? Math.round((gate.onLabel / gate.fired) * 100) / 100 : null;
  }
  const ungated = {};
  for (const defect of scored.filter((d) => !d.expectedGate)) {
    const entry = (ungated[defect.class] ??= { defects: 0, firedHere: {} });
    entry.defects += 1;
    for (const code of defect.firedHere) entry.firedHere[code] = (entry.firedHere[code] ?? 0) + 1;
  }
  return { gates, ungated, defects: scored, notReplayed: notReplayed.length };
}

export async function measure({ defectsFile = path.join(HERE, "defects.json"), specimensDir = SPECIMENS, renders = {}, overlap = false } = {}) {
  const defects = JSON.parse(readFileSync(defectsFile, "utf8")).defects;
  const findingsBySpecimen = {};
  const specimens = {};
  for (const name of listSpecimens(specimensDir)) {
    const specimen = loadSpecimen(name, specimensDir);
    if (!specimen.scene && !specimen.plan) { specimens[name] = { replayed: false, reason: "no stored scene or plan" }; continue; }
    findingsBySpecimen[name] = await replay(specimen, { renders: renders[name] ?? null, overlap });
    specimens[name] = { replayed: true, ran: findingsBySpecimen[name].ran, findings: findingsBySpecimen[name].findings.length };
  }
  for (const defect of defects) specimens[defect.specimen] ??= { replayed: false, reason: "specimen stores numbers, not inputs" };
  return { specimens, ...validity(defects, findingsBySpecimen) };
}

function table(result) {
  const lines = ["specimens"];
  for (const [name, s] of Object.entries(result.specimens)) {
    lines.push(`  ${name.padEnd(30)} ${s.replayed ? `replayed: ${s.ran.join(", ")} (${s.findings} findings)` : `not replayed: ${s.reason}`}`);
  }
  lines.push("", `  ${"gate".padEnd(28)}${"labelled".padStart(9)}${"caught".padStart(8)}${"fired".padStart(7)}${"on label".padStart(10)}${"recall".padStart(8)}${"precision".padStart(11)}`);
  for (const [code, g] of Object.entries(result.gates).sort()) {
    lines.push(`  ${code.padEnd(28)}${String(g.labelled).padStart(9)}${String(g.caught).padStart(8)}${String(g.fired).padStart(7)}`
      + `${String(g.onLabel).padStart(10)}${String(g.recall ?? "-").padStart(8)}${String(g.precision ?? "-").padStart(11)}`);
  }
  lines.push("  precision is a floor: the table is not exhaustive", "", "no gate yet");
  for (const [cls, u] of Object.entries(result.ungated).sort()) {
    const fired = Object.entries(u.firedHere).map(([c, n]) => `${c}${n > 1 ? ` x${n}` : ""}`).join(", ") || "nothing";
    lines.push(`  ${cls.padEnd(20)} ${String(u.defects).padStart(3)} defects; fired on their pages: ${fired}`);
  }
  lines.push("", `${result.notReplayed} labelled defects are on specimens that store no inputs or on an earlier revision; not scored.`);
  return lines.join("\n");
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const renders = {};
  args.forEach((arg, i) => { if (arg === "--renders") { const [name, dir] = String(args[i + 1]).split("="); renders[name] = path.resolve(dir); } });
  measure({ defectsFile: value("--defects"), specimensDir: value("--specimens"), renders, overlap: args.includes("--overlap") })
    .then((result) => console.log(args.includes("--json") ? JSON.stringify(result, null, 2) : table(result)))
    .catch((error) => { console.error(error.message); process.exit(1); });
}
