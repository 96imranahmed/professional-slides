#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { GOLDEN_PALETTES } from "../../skills/professional-slides/runtime/palettes.mjs";
import { auditGoldenCoverage } from "../../skills/professional-slides/runtime/golden-set.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const destination = path.join(root, "output/golden");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
async function sourceState() {
  const files = ["package.json", "evals/scripts/generate_golden_set.mjs", "evals/scripts/validate_component_runtime.mjs"];
  async function walk(directory) {
    for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
      const name = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await walk(name); else if (name.endsWith(".mjs")) files.push(name);
    }
  }
  await walk("skills/professional-slides/runtime");
  const hashes = Object.fromEntries(await Promise.all(files.sort().map(async file => [file, sha(await fs.readFile(path.join(root, file)))])));
  return { files: hashes, sha256: sha(JSON.stringify(hashes)) };
}
async function check() {
  const report = JSON.parse(await fs.readFile(path.join(destination, "manifest.json")));
  if (!report.accepted || report.source.sha256 !== (await sourceState()).sha256) throw new Error("Golden set is missing or stale; run npm run golden");
  if (JSON.stringify(report.palettes.map(item => item.id)) !== JSON.stringify(GOLDEN_PALETTES)) throw new Error("Golden palette coverage mismatch");
  for (const item of report.palettes) {
    if (sha(await fs.readFile(path.join(destination, item.pptx))) !== item.sha256) throw new Error(`Golden PPTX hash mismatch: ${item.id}`);
    const bytes = await fs.readFile(path.join(destination, item.report));
    if (sha(bytes) !== item.reportSha256) throw new Error(`Golden report hash mismatch: ${item.id}`);
    const validation = JSON.parse(bytes);
    if (!validation.accepted || validation.deck.pptxSha256 !== item.sha256 || !auditGoldenCoverage(validation.fixtures).accepted) throw new Error(`Golden validation rejected: ${item.id}`);
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
    palettes.push({ id, pptx: path.relative(destination, pptx), sha256: sha(await fs.readFile(pptx)), report: path.relative(destination, reportPath), reportSha256: sha(reportBytes), coverage: auditGoldenCoverage(report.fixtures) });
  }
  if (source.sha256 !== (await sourceState()).sha256) throw new Error("Sources changed while golden set was generating; rerun on stable sources");
  const manifest = { schema: "professional-slides.golden-set/v1", accepted: true, runId, generatedAt: new Date().toISOString(), source, coverage: palettes[0].coverage, palettes };
  await fs.writeFile(path.join(runDirectory, "manifest.json"), JSON.stringify(manifest, null, 2));
  const rows = [];
  for (const item of palettes) {
    const validation = JSON.parse(await fs.readFile(path.join(destination, item.report)));
    const folder = path.dirname(item.report);
    rows.push(`<h2>${item.id}</h2><p><a href="${item.pptx}">Download editable PowerPoint</a> · <a href="${item.report}">Validation report</a></p>`);
    rows.push(...validation.fixtures.map(fixture => `<details><summary>${fixture.slide}. ${fixture.id}</summary><div class="pair"><figure><figcaption>HTML</figcaption><img loading="lazy" src="${folder}/${fixture.htmlRender}"></figure><figure><figcaption>PowerPoint render</figcaption><img loading="lazy" src="${folder}/${fixture.pptxRender}"></figure></div></details>`));
  }
  const html = `<!doctype html><meta charset="utf-8"><title>Professional Slides golden set</title><style>body{font:16px Arial;margin:32px;color:#222}a{color:#034b6f}.pair{display:flex}figure{margin:12px 8px;width:50%}img{width:100%}summary{padding:8px;cursor:pointer}h2{margin-top:40px}</style><h1>Golden component set</h1><p>${manifest.coverage.slides} slides per palette · ${manifest.coverage.components} components · ${manifest.coverage.variants} variants · ${manifest.coverage.layouts} layouts · ${manifest.coverage.standards} standard compositions. Brand-inspired palette mappings, not official firm templates.</p>${rows.join("\n")}`;
  await fs.writeFile(path.join(destination, "index.next.html"), html);
  await fs.writeFile(path.join(destination, "manifest.next.json"), JSON.stringify(manifest, null, 2));
  await fs.rename(path.join(destination, "index.next.html"), path.join(destination, "index.html"));
  await fs.rename(path.join(destination, "manifest.next.json"), path.join(destination, "manifest.json"));
  await check();
  console.log(JSON.stringify({ accepted: true, index: path.join(destination, "index.html"), ...manifest.coverage, palettes: palettes.map(item => path.join(destination, item.pptx)) }, null, 2));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
