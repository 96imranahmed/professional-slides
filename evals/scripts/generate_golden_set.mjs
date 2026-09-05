#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { GOLDEN_PALETTES } from "../../skills/professional-slides/runtime/palettes.mjs";
import { auditGoldenCoverage, goldenGalleryGroups } from "../../skills/professional-slides/runtime/golden-set.mjs";
import { hashRenderFiles, verifyRenderFiles } from "./render_integrity.mjs";
import { verifyRuntimeLock } from "./runtime_lock.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const destination = path.join(root, "output/golden");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
async function sourceState() {
  const files = ["package.json", ".codex-plugin/plugin.json", "evals/cases.json", "evals/runtime-lock.json"];
  async function walk(directory) {
    for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
      const name = `${directory}/${entry.name}`;
      if (entry.name === "__pycache__" || entry.name === ".DS_Store") continue;
      if (entry.isDirectory()) await walk(name); else files.push(name);
    }
  }
  await walk("skills/professional-slides");
  await walk("evals/scripts");
  const hashes = Object.fromEntries(await Promise.all(files.sort().map(async file => [file, sha(await fs.readFile(path.join(root, file)))])));
  return { files: hashes, sha256: sha(JSON.stringify(hashes)) };
}
async function check() {
  const report = JSON.parse(await fs.readFile(path.join(destination, "manifest.json")));
  if (!report.accepted || report.source.sha256 !== (await sourceState()).sha256) throw new Error("Golden set is missing or stale; run npm run golden");
  if (sha(await fs.readFile(path.join(destination, "index.html"))) !== report.indexSha256) throw new Error("Golden gallery index hash mismatch");
  if (JSON.stringify(report.palettes.map(item => item.id)) !== JSON.stringify(GOLDEN_PALETTES)) throw new Error("Golden palette coverage mismatch");
  for (const item of report.palettes) {
    if (sha(await fs.readFile(path.join(destination, item.pptx))) !== item.sha256) throw new Error(`Golden PPTX hash mismatch: ${item.id}`);
    const bytes = await fs.readFile(path.join(destination, item.report));
    if (sha(bytes) !== item.reportSha256) throw new Error(`Golden report hash mismatch: ${item.id}`);
    const validation = JSON.parse(bytes);
    if (!validation.accepted || validation.deck.pptxSha256 !== item.sha256 || !auditGoldenCoverage(validation.fixtures, { requireSignatures: true }).accepted) throw new Error(`Golden validation rejected: ${item.id}`);
    await verifyRenderFiles(path.dirname(path.join(destination, item.report)), validation.fixtures, item.renderHashes);
  }
  return report;
}
function validate(palette, directory) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, "evals/scripts/validate_component_runtime.mjs"), "--golden", "--palette", palette, "--output", directory], { cwd: root, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", async code => {
      await fs.writeFile(`${directory}.log`, stdout + stderr);
      if (code) reject(new Error(`${palette} rejected; inspect ${directory}/validation-report.json and ${directory}.log`)); else resolve();
    });
  });
}
async function main() {
  await verifyRuntimeLock();
  if (process.argv.includes("--check")) { const report = await check(); console.log(JSON.stringify({ accepted: true, runId: report.runId, coverage: report.coverage })); return; }
  const source = await sourceState(), runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const runDirectory = path.join(destination, "runs", runId);
  await fs.mkdir(runDirectory, { recursive: true });
  const palettes = [];
  for (const id of GOLDEN_PALETTES) {
    console.log(`Validating ${id}: isolated components, variants, layouts and standard slides`);
    const directory = path.join(runDirectory, `${id}-component-validation`);
    await validate(id, directory);
    const reportPath = path.join(directory, "validation-report.json");
    const reportBytes = await fs.readFile(reportPath), report = JSON.parse(reportBytes);
    if (!report.accepted || !auditGoldenCoverage(report.fixtures).accepted) throw new Error(`${id}: incomplete golden coverage`);
    const pptx = path.join(runDirectory, `${id}.pptx`);
    const skillDirectory = process.env.PRESENTATION_SKILL_DIR;
    if (!skillDirectory) throw new Error("PRESENTATION_SKILL_DIR is required for finalization");
    const { finalizePresentation } = await import(pathToFileURL(path.join(skillDirectory, "container_tools/artifact_tool_utils.mjs")).href);
    const fonts = report.deck.typography;
    await finalizePresentation({
      workspaceDir: root, candidatePath: path.join(directory, "component-validation.pptx"), finalPath: pptx,
      pythonExecutable: process.env.RUNTIME_PYTHON,
      integrityValidatorPath: path.join(skillDirectory, "container_tools/inspect_presentation_package_integrity.py"),
      layoutValidatorPath: path.join(skillDirectory, "container_tools/inspect_presentation_layout_geometry.py"),
      layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit"],
      explicitTotalSlideCount: report.deck.slideCount, requiredNativeTableOwnerSlides: [], requiredNativeChartOwnerSlides: [],
      fontPolicy: { basis: "design", families: [...new Set([fonts.body, fonts.display, fonts.serif, fonts.semibold.family])] },
      verifyArtifactToolImport: true, receiptPath: path.join(root, "tmp", `golden-${runId}-${id}-finalization.json`)
    });
    palettes.push({ id, pptx: path.relative(destination, pptx), sha256: sha(await fs.readFile(pptx)), report: path.relative(destination, reportPath), reportSha256: sha(reportBytes), renderHashes: await hashRenderFiles(directory, report.fixtures), coverage: auditGoldenCoverage(report.fixtures) });
  }
  if (source.sha256 !== (await sourceState()).sha256) throw new Error("Sources changed while golden set was generating; rerun on stable sources");
  const manifest = { schema: "professional-slides.golden-set/v2", accepted: true, runId, generatedAt: new Date().toISOString(), source, coverage: palettes[0].coverage, palettes };
  const rows = [];
  const escape = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  for (const item of palettes) {
    const validation = JSON.parse(await fs.readFile(path.join(destination, item.report)));
    const folder = path.dirname(item.report);
    const groups = goldenGalleryGroups(validation.fixtures);
    const sections = [...new Map(groups.map(group => [group.section.id, group.section])).values()];
    rows.push(`<div class="downloads"><strong>McKinsey validation set</strong><a href="${item.pptx}">Download editable PowerPoint</a><a href="${item.report}">Validation report</a></div>`);
    rows.push(`<nav aria-label="Validation sections">${sections.map(section => `<a href="#${escape(section.id)}">${escape(section.title)}</a>`).join("")}</nav>`);
    let currentSection = null;
    for (const group of groups) {
      if (group.section.id !== currentSection) {
        currentSection = group.section.id;
        rows.push(`<h2 id="${escape(group.section.id)}">${escape(group.section.title)}</h2>`);
      }
      rows.push(`<section><h3>${escape(group.title)}</h3>${group.description ? `<p>${escape(group.description)}</p>` : ""}`);
      rows.push(...group.fixtures.map(fixture => `<details id="${item.id}-${escape(fixture.id)}"><summary>${fixture.slide}. ${escape(fixture.label)} <small>${escape(fixture.id)}</small></summary><div class="pair"><figure><figcaption>HTML</figcaption><img loading="lazy" src="${folder}/${fixture.htmlRender}"></figure><figure><figcaption>PowerPoint render</figcaption><img loading="lazy" src="${folder}/${fixture.pptxRender}"></figure></div></details>`));
      rows.push("</section>");
    }
  }
  const html = `<!doctype html><meta charset="utf-8"><title>Professional Slides validation set</title><style>:root{color-scheme:light}body{font:16px Arial;margin:32px auto;max-width:1440px;color:#051c2c;padding:0 24px}a{color:#034b6f}.summary,.downloads,nav{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.summary{margin:16px 0 24px}.summary span{background:#f0f0f0;border-radius:4px;padding:10px 14px}.downloads{border:1px solid #d7dce0;padding:14px 16px}.downloads strong{margin-right:auto}nav{margin:18px 0 34px}nav a{background:#e6e8ea;border-radius:3px;padding:8px 12px;text-decoration:none}.pair{display:flex;gap:16px}figure{margin:12px 0;width:50%}img{width:100%;border:1px solid #d7dce0}summary{padding:10px 8px;cursor:pointer;border-top:1px solid #e6e8ea}summary small{color:#68727a;margin-left:8px}h2{margin-top:44px;border-bottom:2px solid #051c2c;padding-bottom:8px;scroll-margin-top:20px}h3{margin:28px 0 6px}section>p{color:#4d4d4d;max-width:850px}@media(max-width:800px){.pair{display:block}figure{width:100%}}</style><h1>Golden component validation</h1><p>One canonical McKinsey review set, ordered from complete compositions to isolated component evidence. Compatible variants share paginated review boards; dense or full-frame variants remain isolated.</p><div class="summary"><span><strong>${manifest.coverage.slides}</strong> slides</span><span><strong>${manifest.coverage.componentSlides}</strong> component boards</span><span><strong>${manifest.coverage.components}</strong> components</span><span><strong>${manifest.coverage.variants}</strong> variants covered</span><span><strong>${manifest.coverage.omittedDefaultDuplicates}</strong> duplicate defaults removed</span><span><strong>${manifest.coverage.layouts}</strong> layouts</span><span><strong>${manifest.coverage.standards}</strong> standard compositions</span></div>${rows.join("\n")}`;
  manifest.indexSha256 = sha(html);
  await fs.writeFile(path.join(runDirectory, "manifest.json"), JSON.stringify(manifest, null, 2));
  await fs.writeFile(path.join(destination, "index.next.html"), html);
  await fs.writeFile(path.join(destination, "manifest.next.json"), JSON.stringify(manifest, null, 2));
  await fs.rename(path.join(destination, "index.next.html"), path.join(destination, "index.html"));
  await fs.rename(path.join(destination, "manifest.next.json"), path.join(destination, "manifest.json"));
  await check();
  console.log(JSON.stringify({ accepted: true, index: path.join(destination, "index.html"), ...manifest.coverage, palettes: palettes.map(item => path.join(destination, item.pptx)) }, null, 2));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
