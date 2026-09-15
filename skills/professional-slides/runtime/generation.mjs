import {writeMontage} from './montage.mjs';
import {createTimingReport,digest} from './production-policy.mjs';
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DESIGN_SYSTEM_VERSION, MANIFEST_SCHEMA, SCENE_SCHEMA, hashJson } from "./core.mjs";
import { assertOutputDirectory } from "./output-path.mjs";
import { planDeck } from "./planner.mjs";
import { REGISTRY, registryManifest } from "./registry.mjs";
import { renderSlideHtml } from "./adapters/html.mjs";
import { writePptx } from "./adapters/pptxgenjs.mjs";
import { normalizeObservedDeck, observePptx } from "./adapters/artifact-tool.mjs";

export const CANONICAL_GENERATION_SCHEMA = "professional-slides.canonical-generation/v1";
export const CANONICAL_GENERATION_PIPELINE = Object.freeze([
  "planDeck",
  "compileDeck",
  "renderSlideHtml",
  "writePptx",
  "observePptx"
]);

const runtimeDirectory = path.dirname(fileURLToPath(import.meta.url));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

async function walkRuntime(directory, prefix = "") {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await walkRuntime(path.join(directory, entry.name), relative));
    else if (/\.(mjs|py)$/.test(entry.name)) files.push(relative);
  }
  return files;
}

export async function canonicalRuntimeSourceState() {
  const names = (await walkRuntime(runtimeDirectory)).sort();
  const files = Object.fromEntries(await Promise.all(names.map(async (name) => [
    `skills/professional-slides/runtime/${name}`,
    sha256(await fs.readFile(path.join(runtimeDirectory, name)))
  ])));
  return { files, sha256: sha256(JSON.stringify(files)) };
}

function safeFileName(value, fallback) {
  const name = String(value || fallback).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!name || name === "." || name === "..") throw new Error("Canonical generation requires a safe output file name");
  return name;
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return { path: filePath, sha256: sha256(await fs.readFile(filePath)) };
}

/**
 * Export an already resolved canonical scene through the same HTML, PowerPoint,
 * and Artifact Tool adapters used by the golden set. Ordinary deck builders
 * should call writeCanonicalDeckPlan so planning cannot be bypassed.
 */
export async function writeCanonicalDeck({
  deck,
  decisions = [],
  outputDirectory,
  fileStem = deck?.id || "deck",
  authoringScriptPath
}) {
  if (!deck?.manifest || deck.schema !== SCENE_SCHEMA) throw new Error("writeCanonicalDeck requires a compiled canonical scene deck");
  if (!outputDirectory) throw new Error("writeCanonicalDeck requires outputDirectory");
  if (!authoringScriptPath) throw new Error("writeCanonicalDeck requires authoringScriptPath for provenance");
  const scriptPath = path.resolve(authoringScriptPath);
  const stem = safeFileName(fileStem, "deck");
  const directory = await assertOutputDirectory(outputDirectory);
  const htmlDirectory = path.join(directory, "html");
  await fs.mkdir(htmlDirectory, { recursive: true });

  const timing=createTimingReport();
  const scene = await writeJson(path.join(directory, "scene.json"), deck);
  const designManifest = await writeJson(path.join(directory, "design-manifest.json"), deck.manifest);
  const registry = await writeJson(path.join(directory, "registry.json"), registryManifest());
  const planning = await writeJson(path.join(directory, "planning-decisions.json"), decisions);
  const html = [];
  for (const [index, slide] of deck.slides.entries()) {
    const filePath = path.join(htmlDirectory, `slide-${String(index + 1).padStart(3, "0")}.html`);
    await fs.writeFile(filePath, renderSlideHtml(slide));
    html.push({ path: filePath, sha256: sha256(await fs.readFile(filePath)) });
  }

  const pptxPath = path.join(directory, `${stem}.pptx`);
  const candidate = await timing.time("pptx-export",()=>writePptx(deck, pptxPath));
  const renderDirectory=path.join(directory,"rendered");
  const observationValue = normalizeObservedDeck(await timing.time("artifact-observe-and-render",()=>observePptx(pptxPath,{renderDirectory})));
  const renders=await Promise.all(deck.slides.map(async(_,i)=>{const p=path.join(renderDirectory,`slide-${i+1}.png`);return {slide:i+1,path:p,sha256:sha256(await fs.readFile(p))};}));
  const montagePath=await writeMontage(renders,path.join(directory,"montage.png"));
  const montage={path:montagePath,sha256:sha256(await fs.readFile(montagePath))};
  const observation = await writeJson(path.join(directory, "artifact-observation.json"), observationValue);
  const runtime = await canonicalRuntimeSourceState();
  const authoringScript = { path: scriptPath, sha256: sha256(await fs.readFile(scriptPath)) };
  const receipt = {
    schema: CANONICAL_GENERATION_SCHEMA,
    accepted: true,
    mechanism: "canonical-scene",
    pipeline: [...CANONICAL_GENERATION_PIPELINE],
    candidate: { path: pptxPath, sha256: candidate.sha256 },
    deck: {
      id: deck.id,
      slideCount: deck.slides.length,
      palette: deck.palette.id,
      designHash: deck.manifest.designHash
    },
    runtime: {
      designSystemVersion: DESIGN_SYSTEM_VERSION,
      sceneSchema: SCENE_SCHEMA,
      manifestSchema: MANIFEST_SCHEMA,
      sourceFiles: runtime.files,
      sha256: runtime.sha256
    },
    registry: { ...registry, manifestHash: hashJson(registryManifest()) },
    planning,
    scene,
    designManifest,
    html,
    observation,
    renders,
    montage,
    authoringScript
  };
  const receiptPath = path.join(directory, "canonical-generation-receipt.json");
  await writeJson(receiptPath, receipt);
  await writeJson(path.join(directory,"generation-timings.json"),timing.finish({exports:1,imports:1,slides:deck.slides.length}));
  return { renderDirectory, deck, decisions, pptxPath, candidateSha256: candidate.sha256, receiptPath, receipt, observation: observationValue, htmlDirectory };
}

export async function writeCanonicalDeckPlan({ deckPlan, registry = REGISTRY, onPlanned, prepared, ...options }) {
  if(prepared && (prepared.planHash!==digest(deckPlan)||prepared.runtimeSha!==(await canonicalRuntimeSourceState()).sha256))throw new Error("Stale prepared compilation");
  const { deck, decisions } = prepared || planDeck(deckPlan, registry);
  if(onPlanned) await onPlanned({deck,decisions});
  return writeCanonicalDeck({ deck, decisions, ...options });
}
