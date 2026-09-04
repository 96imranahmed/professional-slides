#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildGoldenDeck } from "../../skills/professional-slides/runtime/golden-fixtures.mjs";
import { SLIDE, TOKENS, TITLE_VARIANTS } from "../../skills/professional-slides/runtime/core.mjs";
import { renderSlideHtml } from "../../skills/professional-slides/runtime/adapters/html.mjs";
import { auditSlideOverlaps, auditObservedOverlaps, summarizeOverlapAudits } from "../../skills/professional-slides/runtime/validate-overlap.mjs";
import { writePptx } from "../../skills/professional-slides/runtime/adapters/pptxgenjs.mjs";
import { normalizeObservedDeck, observePptx } from "../../skills/professional-slides/runtime/adapters/artifact-tool.mjs";

const require = createRequire(import.meta.url);
const runtimeModules = process.env.RUNTIME_NODE_MODULES;
if (!runtimeModules) throw new Error("RUNTIME_NODE_MODULES is required");
const { chromium } = require(require.resolve("playwright", { paths: [runtimeModules] }));
const sharp = require(require.resolve("sharp", { paths: [runtimeModules] }));
const JSZip = require(require.resolve("jszip", { paths: [runtimeModules] }));

const argv = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
};

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceInput = argValue("--source-root", process.env.CONSULTING_TOOLKIT_ROOT);
if (!sourceInput) throw new Error("Pass --source-root <consulting-toolkit> or set CONSULTING_TOOLKIT_ROOT");
const sourceRoot = path.resolve(sourceInput);
const outputDirectory = path.resolve(argValue("--output", path.join(repositoryRoot, "tmp", "reference-fidelity-validation")));
const browserPath = argValue("--browser", process.env.PLAYWRIGHT_BROWSER_PATH);
const runtimePython = process.env.RUNTIME_PYTHON;
const presentationSkillDirectory = process.env.PRESENTATION_SKILL_DIR;
const WIDTH = 640;
const HEIGHT = 360;
const RUNTIME_SOURCE_PATHS = Object.freeze([
  "skills/professional-slides/runtime/core.mjs",
  "skills/professional-slides/runtime/page-template.mjs",
  "skills/professional-slides/runtime/text-layout.mjs",
  "skills/professional-slides/runtime/routing.mjs",
  "skills/professional-slides/runtime/overlap-policy.mjs",
  "skills/professional-slides/runtime/validate-overlap.mjs",
  "skills/professional-slides/runtime/registry.mjs",
  "skills/professional-slides/runtime/charts.mjs",
  "skills/professional-slides/runtime/chart-group.mjs",
  "skills/professional-slides/runtime/legends.mjs",
  "skills/professional-slides/runtime/palettes.mjs",
  "skills/professional-slides/runtime/typography.mjs",
  "skills/professional-slides/runtime/design-context.mjs",
  "skills/professional-slides/runtime/golden-set.mjs",
  "evals/scripts/generate_golden_set.mjs",
  "skills/professional-slides/runtime/planner.mjs",
  "skills/professional-slides/runtime/fixtures.mjs",
  "skills/professional-slides/runtime/golden-fixtures.mjs",
  "skills/professional-slides/runtime/adapters/html.mjs",
  "skills/professional-slides/runtime/adapters/pptxgenjs.mjs",
  "skills/professional-slides/runtime/adapters/artifact-tool.mjs",
  "evals/run_evals.py",
  "evals/scripts/validate_component_runtime.mjs",
  "evals/scripts/validate_reference_fidelity.mjs",
  "package.json"
]);

const THRESHOLDS = Object.freeze({
  parity: {
    fullFrameSimilarity: 0.94,
    materialMismatchRatio: 0.12,
    blurredStructureSimilarity: 0.965
  },
  reference: {
    fullFrameSimilarity: 0.82,
    blurredStructureSimilarity: 0.88,
    blockSsim: 0.35,
    edgeDensityDelta: 0.10
  },
  normalizedReference: {
    fullFrameSimilarity: 0.90,
    blurredStructureSimilarity: 0.90,
    blockSsim: 0.58
  },
  nativeGeometry: {
    maximumObjectDeltaPx: 1,
    chromeDeltaPx: 0.01
  }
});

function assertSafeOutputDirectory(directory) {
  const relative = path.relative(repositoryRoot, directory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !directory.includes("reference-fidelity-validation")) {
    throw new Error(`Unsafe reference-fidelity output directory: ${directory}`);
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${command} exited ${code}\n${stderr || stdout}`)));
  });
}

async function sha256(filePath) {
  return crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

async function sourceHashes() {
  return Object.fromEntries(await Promise.all(RUNTIME_SOURCE_PATHS.map(async (relative) => [relative, await sha256(path.join(repositoryRoot, relative))])));
}

const fileName = (index) => `slide-${String(index + 1).padStart(3, "0")}`;
const referenceName = (slide) => `slide-${String(slide).padStart(3, "0")}.png`;

async function resolveRenderedSlide(directory, index) {
  const entries = await fs.readdir(directory);
  const candidates = [`slide-${index + 1}.png`, `${index + 1}.png`, `slide${index + 1}.png`];
  for (const candidate of candidates) if (entries.includes(candidate)) return path.join(directory, candidate);
  const pngs = entries.filter((entry) => entry.endsWith(".png")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!pngs[index]) throw new Error(`Missing rendered slide ${index + 1} in ${directory}`);
  return path.join(directory, pngs[index]);
}

async function raster(filePath, blur = 0) {
  let pipeline = sharp(filePath).resize(WIDTH, HEIGHT, { fit: "fill" }).removeAlpha();
  if (blur > 0) pipeline = pipeline.blur(blur);
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

function luminance(data, pixel) {
  const offset = pixel * 3;
  return 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
}

function pixelSimilarity(reference, candidate) {
  let absoluteDifference = 0;
  let material = 0;
  for (let offset = 0; offset < reference.length; offset += 3) {
    const difference = (Math.abs(reference[offset] - candidate[offset]) + Math.abs(reference[offset + 1] - candidate[offset + 1]) + Math.abs(reference[offset + 2] - candidate[offset + 2])) / 3;
    absoluteDifference += difference;
    if (difference > 40) material += 1;
  }
  const pixels = reference.length / 3;
  return {
    fullFrameSimilarity: Number((1 - absoluteDifference / (pixels * 255)).toFixed(6)),
    materialMismatchRatio: Number((material / pixels).toFixed(6))
  };
}

function pearson(left, right) {
  const meanLeft = left.reduce((sum, value) => sum + value, 0) / left.length;
  const meanRight = right.reduce((sum, value) => sum + value, 0) / right.length;
  let numerator = 0;
  let leftSquare = 0;
  let rightSquare = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] - meanLeft;
    const b = right[index] - meanRight;
    numerator += a * b;
    leftSquare += a * a;
    rightSquare += b * b;
  }
  return numerator / Math.sqrt(Math.max(1e-9, leftSquare * rightSquare));
}

function edgeFeatures(data) {
  const gray = new Float64Array(WIDTH * HEIGHT);
  for (let pixel = 0; pixel < gray.length; pixel += 1) gray[pixel] = luminance(data, pixel);
  const rows = new Array(HEIGHT).fill(0);
  const columns = new Array(WIDTH).fill(0);
  let edges = 0;
  for (let y = 1; y < HEIGHT - 1; y += 1) {
    for (let x = 1; x < WIDTH - 1; x += 1) {
      const p = y * WIDTH + x;
      const gx = -gray[p - WIDTH - 1] + gray[p - WIDTH + 1] - 2 * gray[p - 1] + 2 * gray[p + 1] - gray[p + WIDTH - 1] + gray[p + WIDTH + 1];
      const gy = -gray[p - WIDTH - 1] - 2 * gray[p - WIDTH] - gray[p - WIDTH + 1] + gray[p + WIDTH - 1] + 2 * gray[p + WIDTH] + gray[p + WIDTH + 1];
      if (Math.hypot(gx, gy) >= 95) {
        rows[y] += 1;
        columns[x] += 1;
        edges += 1;
      }
    }
  }
  const normalize = (values) => {
    const peak = Math.max(1, ...values);
    return values.map((value) => value / peak);
  };
  return { rows: normalize(rows), columns: normalize(columns), edgeDensity: edges / (WIDTH * HEIGHT) };
}

function blockSsim(reference, candidate, block = 8) {
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  const scores = [];
  for (let y = 0; y < HEIGHT; y += block) {
    for (let x = 0; x < WIDTH; x += block) {
      const left = [];
      const right = [];
      for (let by = y; by < Math.min(HEIGHT, y + block); by += 1) {
        for (let bx = x; bx < Math.min(WIDTH, x + block); bx += 1) {
          const pixel = by * WIDTH + bx;
          left.push(luminance(reference, pixel));
          right.push(luminance(candidate, pixel));
        }
      }
      const meanLeft = left.reduce((sum, value) => sum + value, 0) / left.length;
      const meanRight = right.reduce((sum, value) => sum + value, 0) / right.length;
      let varianceLeft = 0;
      let varianceRight = 0;
      let covariance = 0;
      for (let index = 0; index < left.length; index += 1) {
        const a = left[index] - meanLeft;
        const b = right[index] - meanRight;
        varianceLeft += a * a;
        varianceRight += b * b;
        covariance += a * b;
      }
      const divisor = Math.max(1, left.length - 1);
      varianceLeft /= divisor;
      varianceRight /= divisor;
      covariance /= divisor;
      scores.push(((2 * meanLeft * meanRight + c1) * (2 * covariance + c2)) / ((meanLeft ** 2 + meanRight ** 2 + c1) * (varianceLeft + varianceRight + c2)));
    }
  }
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function ruleAnchor(data, startRow, endRow, dark = true) {
  let bestRow = startRow;
  let bestCount = -1;
  for (let y = startRow; y <= endRow; y += 1) {
    let count = 0;
    for (let x = 20; x < WIDTH - 20; x += 1) {
      const value = luminance(data, y * WIDTH + x);
      if (dark ? value < 175 : value > 170) count += 1;
    }
    if (count > bestCount) {
      bestCount = count;
      bestRow = y;
    }
  }
  return bestRow / HEIGHT;
}

async function compare(referencePath, candidatePath, { anchors = true } = {}) {
  const [reference, candidate, referenceBlurred, candidateBlurred] = await Promise.all([
    raster(referencePath), raster(candidatePath), raster(referencePath, 6), raster(candidatePath, 6)
  ]);
  const direct = pixelSimilarity(reference.data, candidate.data);
  const blurred = pixelSimilarity(referenceBlurred.data, candidateBlurred.data);
  const leftEdges = edgeFeatures(reference.data);
  const rightEdges = edgeFeatures(candidate.data);
  const metrics = {
    ...direct,
    blurredStructureSimilarity: blurred.fullFrameSimilarity,
    blockSsim: Number(blockSsim(reference.data, candidate.data).toFixed(6)),
    rowProjectionCorrelation: Number(pearson(leftEdges.rows, rightEdges.rows).toFixed(6)),
    columnProjectionCorrelation: Number(pearson(leftEdges.columns, rightEdges.columns).toFixed(6)),
    edgeDensityDelta: Number(Math.abs(leftEdges.edgeDensity - rightEdges.edgeDensity).toFixed(6))
  };
  if (anchors) {
    metrics.titleRuleDelta = Number(Math.abs(ruleAnchor(reference.data, 48, 80) - ruleAnchor(candidate.data, 48, 80)).toFixed(6));
    metrics.footerRuleDelta = Number(Math.abs(ruleAnchor(reference.data, 325, 350) - ruleAnchor(candidate.data, 325, 350)).toFixed(6));
  }
  return metrics;
}

function accepted(metrics, thresholds) {
  return metrics.fullFrameSimilarity >= thresholds.fullFrameSimilarity
    && metrics.blurredStructureSimilarity >= thresholds.blurredStructureSimilarity
    && (thresholds.materialMismatchRatio === undefined || metrics.materialMismatchRatio <= thresholds.materialMismatchRatio)
    && (thresholds.blockSsim === undefined || metrics.blockSsim >= thresholds.blockSsim)
    && (thresholds.edgeDensityDelta === undefined || metrics.edgeDensityDelta <= thresholds.edgeDensityDelta);
}

function evaluateReferenceFidelity(metrics, referenceAgreement) {
  const candidates = [metrics.htmlRestored, metrics.pptxRestored, metrics.htmlUpscaled, metrics.pptxUpscaled];
  const minimum = (key) => Math.min(...candidates.map((candidate) => candidate[key]));
  const ratios = {
    fullFrameSimilarity: Number((minimum("fullFrameSimilarity") / referenceAgreement.fullFrameSimilarity).toFixed(6)),
    blurredStructureSimilarity: Number((minimum("blurredStructureSimilarity") / referenceAgreement.blurredStructureSimilarity).toFixed(6)),
    blockSsim: Number((minimum("blockSsim") / referenceAgreement.blockSsim).toFixed(6))
  };
  const rawAccepted = candidates.every((candidate) => accepted(candidate, THRESHOLDS.reference));
  const normalizedAccepted = ratios.fullFrameSimilarity >= THRESHOLDS.normalizedReference.fullFrameSimilarity
    && ratios.blurredStructureSimilarity >= THRESHOLDS.normalizedReference.blurredStructureSimilarity
    && ratios.blockSsim >= THRESHOLDS.normalizedReference.blockSsim;
  return { accepted: rawAccepted && normalizedAccepted, rawAccepted, normalizedAccepted, ratios };
}

async function makeTriptychRows(rows, outputPath) {
  const tileWidth = 320;
  const tileHeight = 180;
  const composites = [];
  for (const [row, images] of rows.entries()) {
    for (const [column, imagePath] of images.entries()) {
      composites.push({
        input: await sharp(imagePath).resize(tileWidth, tileHeight, { fit: "fill" }).png().toBuffer(),
        left: column * tileWidth,
        top: row * tileHeight
      });
    }
  }
  await sharp({ create: { width: tileWidth * 3, height: tileHeight * rows.length, channels: 3, background: "#FFFFFF" } }).composite(composites).png().toFile(outputPath);
}

async function inspectPackage(pptxPath) {
  const zip = await JSZip.loadAsync(await fs.readFile(pptxPath));
  const files = Object.keys(zip.files);
  return {
    media: files.filter((name) => /^ppt\/media\//.test(name) && !zip.files[name].dir),
    nativeChartParts: files.filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name) && !zip.files[name].dir),
    slideParts: files.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name) && !zip.files[name].dir)
  };
}

function expectedBbox(node) {
  return [node.frame.x, node.frame.y, node.frame.width, node.frame.height];
}

function auditArtifactGeometry(deck, observed) {
  const observedByName = new Map(observed.objects.map((object) => [object.roleName, object]));
  const mismatches = [];
  let maximumDeltaPx = 0;
  for (const [slideIndex, slide] of deck.slides.entries()) {
    for (const node of slide.nodes) {
      const object = observedByName.get(node.id);
      if (!object || !Array.isArray(object.bbox) || object.bbox.length !== 4) continue;
      const expected = expectedBbox(node);
      const deltas = expected.map((value, index) => Math.abs(value - Number(object.bbox[index])));
      const delta = Math.max(...deltas);
      maximumDeltaPx = Math.max(maximumDeltaPx, delta);
      if (delta > THRESHOLDS.nativeGeometry.maximumObjectDeltaPx) mismatches.push({ slide: slideIndex + 1, node: node.id, expected, observed: object.bbox, maximumDeltaPx: delta });
    }
  }
  return { accepted: mismatches.length === 0, maximumDeltaPx: Number(maximumDeltaPx.toFixed(6)), mismatches };
}

function auditChromeGeometry(deck, fixtures) {
  const mismatches = [];
  for (const [index, fixture] of fixtures.entries()) {
    if (fixture.visualFamily === "cover" || fixture.visualFamily === "section-divider") continue;
    const slide = deck.slides[index];
    const title = slide.nodes.find((node) => node.role === "action-title");
    const titleRule = slide.nodes.find((node) => node.role === "title-rule");
    const footerRule = slide.nodes.find((node) => node.role === "footer-rule");
    const checks = [
      ["action-title", title, [60, 48, 1160, 58]],
      ["footer-rule", footerRule, [60, 680, 1160, 0]]
    ];
    if (TITLE_VARIANTS[title?.data.titleVariant]?.rule) {
      checks.push(["title-rule", titleRule, [60, 48 + title.data.textLayout.height + TOKENS["space.2"].value, 1160, 0]]);
    } else if (titleRule) {
      mismatches.push({ slide: index + 1, role: "title-rule", reason: "unexpected rule in line-free title" });
    }
    for (const [role, node, expected] of checks) {
      if (!node) {
        mismatches.push({ slide: index + 1, role, reason: "missing" });
        continue;
      }
      const actual = expectedBbox(node);
      const delta = Math.max(...actual.map((value, position) => Math.abs(value - expected[position])));
      if (delta > THRESHOLDS.nativeGeometry.chromeDeltaPx) mismatches.push({ slide: index + 1, role, expected, actual, maximumDeltaPx: delta });
    }
  }
  return { accepted: mismatches.length === 0, mismatches };
}

async function main() {
  assertSafeOutputDirectory(outputDirectory);
  if (!runtimePython || !presentationSkillDirectory) throw new Error("RUNTIME_PYTHON and PRESENTATION_SKILL_DIR are required");
  await fs.rm(outputDirectory, { recursive: true, force: true });
  const htmlDirectory = path.join(outputDirectory, "html");
  const htmlRenderDirectory = path.join(outputDirectory, "html-renders");
  const pptxRenderDirectory = path.join(outputDirectory, "pptx-renders");
  await Promise.all([htmlDirectory, htmlRenderDirectory, pptxRenderDirectory].map((directory) => fs.mkdir(directory, { recursive: true })));

  const { deck, fixtures } = buildGoldenDeck();
  const pptxPath = path.join(outputDirectory, "consulting-toolkit-golden.pptx");
  await fs.writeFile(path.join(outputDirectory, "scene.json"), JSON.stringify(deck, null, 2));
  await fs.writeFile(path.join(outputDirectory, "design-manifest.json"), JSON.stringify(deck.manifest, null, 2));
  await fs.writeFile(path.join(outputDirectory, "golden-fixtures.json"), JSON.stringify(fixtures, null, 2));

  const forbiddenHtml = [];
  for (const [index, slide] of deck.slides.entries()) {
    const html = renderSlideHtml(slide);
    if (/(<img\b|<image\b|data:image|slides-ai|slides-hq)/i.test(html)) forbiddenHtml.push(index + 1);
    await fs.writeFile(path.join(htmlDirectory, `${fileName(index)}.html`), html);
  }

  const browser = await chromium.launch({ headless: true, executablePath: browserPath, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: SLIDE.width, height: SLIDE.height }, deviceScaleFactor: 1 });
  const browserErrors = [];
  const overlapAudits = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  for (let index = 0; index < deck.slides.length; index += 1) {
    await page.goto(pathToFileURL(path.join(htmlDirectory, `${fileName(index)}.html`)).href, { waitUntil: "load" });
    overlapAudits.push(await auditSlideOverlaps(page, deck.slides[index]));
    await page.screenshot({ path: path.join(htmlRenderDirectory, `${fileName(index)}.png`) });
  }
  const overlapAudit = summarizeOverlapAudits(overlapAudits);

  const pptx = await writePptx(deck, pptxPath);
  await run(runtimePython, [
    path.join(presentationSkillDirectory, "container_tools", "render_slides.py"),
    pptxPath,
    "--output_dir", pptxRenderDirectory,
    "--width", String(SLIDE.width),
    "--height", String(SLIDE.height)
  ], { env: process.env });
  const overflow = await run(runtimePython, [path.join(presentationSkillDirectory, "container_tools", "slides_test.py"), pptxPath], { env: process.env });

  const packageAudit = await inspectPackage(pptxPath);
  const observed = normalizeObservedDeck(await observePptx(pptxPath));
  overlapAudit.nativeGeometry = await auditObservedOverlaps(page, deck, observed);
  overlapAudit.accepted &&= overlapAudit.nativeGeometry.accepted;
  await browser.close();
  await fs.writeFile(path.join(outputDirectory, "artifact-observation.json"), JSON.stringify(observed, null, 2));
  const expectedNames = new Set(deck.slides.flatMap((slide) => slide.nodes.map((node) => node.id)));
  const observedNames = new Set(observed.objects.map((object) => object.roleName));
  const missingNames = [...expectedNames].filter((name) => !observedNames.has(name));
  const artifactGeometry = auditArtifactGeometry(deck, observed);
  const chromeGeometry = auditChromeGeometry(deck, fixtures);

  const comparisons = [];
  const triptychs = [];
  for (const [index, fixture] of fixtures.entries()) {
    const restoredPath = path.join(sourceRoot, "slides-ai", referenceName(fixture.sourceSlide));
    const upscaledPath = path.join(sourceRoot, "slides-hq", referenceName(fixture.sourceSlide));
    const restoredMeta = await sharp(restoredPath).metadata();
    const upscaledMeta = await sharp(upscaledPath).metadata();
    if (restoredMeta.width !== 3840 || restoredMeta.height !== 2160 || upscaledMeta.width !== 3840 || upscaledMeta.height !== 2160) {
      throw new Error(`Reference slide ${fixture.sourceSlide} is not 3840 by 2160`);
    }
    const htmlPath = path.join(htmlRenderDirectory, `${fileName(index)}.png`);
    const pptxPathForSlide = await resolveRenderedSlide(pptxRenderDirectory, index);
    const anchors = fixture.visualFamily !== "cover" && fixture.visualFamily !== "section-divider";
    const [htmlPptx, htmlRestored, pptxRestored, htmlUpscaled, pptxUpscaled, referenceAgreement] = await Promise.all([
      compare(htmlPath, pptxPathForSlide, { anchors: false }),
      compare(restoredPath, htmlPath, { anchors }),
      compare(restoredPath, pptxPathForSlide, { anchors }),
      compare(upscaledPath, htmlPath, { anchors }),
      compare(upscaledPath, pptxPathForSlide, { anchors }),
      compare(upscaledPath, restoredPath, { anchors })
    ]);
    const parityAccepted = accepted(htmlPptx, THRESHOLDS.parity);
    const referenceFidelity = evaluateReferenceFidelity({ htmlRestored, pptxRestored, htmlUpscaled, pptxUpscaled }, referenceAgreement);
    comparisons.push({
      ...fixture,
      anchorsRequired: anchors,
      restoredReference: { path: path.relative(sourceRoot, restoredPath), sha256: await sha256(restoredPath) },
      upscaledReference: { path: path.relative(sourceRoot, upscaledPath), sha256: await sha256(upscaledPath) },
      htmlVsPptx: { ...htmlPptx, accepted: parityAccepted },
      htmlVsRestored: { ...htmlRestored, accepted: accepted(htmlRestored, THRESHOLDS.reference) },
      pptxVsRestored: { ...pptxRestored, accepted: accepted(pptxRestored, THRESHOLDS.reference) },
      htmlVsUpscaled: { ...htmlUpscaled, accepted: accepted(htmlUpscaled, THRESHOLDS.reference) },
      pptxVsUpscaled: { ...pptxUpscaled, accepted: accepted(pptxUpscaled, THRESHOLDS.reference) },
      referenceAgreement,
      normalizedReferenceFidelity: referenceFidelity,
      accepted: parityAccepted && referenceFidelity.accepted
    });
    triptychs.push([restoredPath, htmlPath, pptxPathForSlide]);
  }
  await makeTriptychRows(triptychs, path.join(outputDirectory, "reference-html-pptx-contact-sheet.png"));

  const nativeOnly = forbiddenHtml.length === 0
    && packageAudit.media.length === 0
    && packageAudit.nativeChartParts.length === 0
    && deck.slides.every((slide) => slide.nodes.every((node) => node.type !== "image"));
  const artifactAccepted = observed.slides.length === deck.slides.length
    && observed.objects.length >= expectedNames.size
    && missingNames.length === 0
    && artifactGeometry.accepted
    && observed.theme.name === "Professional Slides";
  const report = {
    schema: "professional-slides.reference-fidelity/v1",
    generatedAt: new Date().toISOString(),
    accepted: browserErrors.length === 0 && nativeOnly && artifactAccepted && chromeGeometry.accepted && comparisons.every((comparison) => comparison.accepted) && overlapAudit.accepted,
    inputs: {
      runtimeSources: await sourceHashes(),
      sourceIndexSha256: await sha256(path.join(sourceRoot, "index.html"))
    },
    source: {
      root: sourceRoot,
      restoredSet: "slides-ai",
      upscaledSet: "slides-hq",
      referenceCount: fixtures.length
    },
    deck: {
      slideCount: deck.slides.length,
      sceneNodeCount: expectedNames.size,
      designSystemVersion: deck.manifest.designSystemVersion,
      designHash: deck.manifest.designHash,
      pptxPath,
      pptxSha256: pptx.sha256
    },
    thresholds: THRESHOLDS,
    gates: {
      browser: { accepted: browserErrors.length === 0, errors: browserErrors },
      nativeOnly: { accepted: nativeOnly, forbiddenHtmlSlides: forbiddenHtml, pptxMedia: packageAudit.media, nativeChartParts: packageAudit.nativeChartParts },
      overflow: { accepted: true, output: overflow.stdout.trim() },
      overlap: overlapAudit,
      declaredTokenInheritance: { accepted: true, note: "compileDeck rejects undeclared component token use before rendering" },
      chromeGeometry,
      artifactTool: { accepted: artifactAccepted, slideCount: observed.slides.length, objectCount: observed.objects.length, expectedObjectCount: expectedNames.size, missingNamedObjects: missingNames, geometry: artifactGeometry, theme: observed.theme },
      visual: {
        accepted: chromeGeometry.accepted && comparisons.every((comparison) => comparison.accepted),
        minimumHtmlPptxSimilarity: Math.min(...comparisons.map((comparison) => comparison.htmlVsPptx.fullFrameSimilarity)),
        minimumNormalizedFullFrameSimilarity: Math.min(...comparisons.map((comparison) => comparison.normalizedReferenceFidelity.ratios.fullFrameSimilarity)),
        minimumNormalizedBlurredStructureSimilarity: Math.min(...comparisons.map((comparison) => comparison.normalizedReferenceFidelity.ratios.blurredStructureSimilarity)),
        minimumNormalizedBlockSsim: Math.min(...comparisons.map((comparison) => comparison.normalizedReferenceFidelity.ratios.blockSsim)),
        minimumRestoredBlurredSimilarity: Math.min(...comparisons.flatMap((comparison) => [comparison.htmlVsRestored.blurredStructureSimilarity, comparison.pptxVsRestored.blurredStructureSimilarity])),
        minimumUpscaledBlurredSimilarity: Math.min(...comparisons.flatMap((comparison) => [comparison.htmlVsUpscaled.blurredStructureSimilarity, comparison.pptxVsUpscaled.blurredStructureSimilarity])),
        minimumRestoredBlockSsim: Math.min(...comparisons.flatMap((comparison) => [comparison.htmlVsRestored.blockSsim, comparison.pptxVsRestored.blockSsim])),
        minimumUpscaledBlockSsim: Math.min(...comparisons.flatMap((comparison) => [comparison.htmlVsUpscaled.blockSsim, comparison.pptxVsUpscaled.blockSsim]))
      }
    },
    fixtures: comparisons
  };
  await fs.writeFile(path.join(outputDirectory, "reference-fidelity-report.json"), JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify({ accepted: report.accepted, report: path.join(outputDirectory, "reference-fidelity-report.json"), deck: report.deck, gates: report.gates }, null, 2)}\n`);
  if (!report.accepted) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
