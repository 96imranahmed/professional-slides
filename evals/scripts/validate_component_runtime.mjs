#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildFixtureDeck } from "../../skills/professional-slides/runtime/fixtures.mjs";
import { buildGoldenSetDeck, auditGoldenCoverage } from "../../skills/professional-slides/runtime/golden-set.mjs";
import { registryManifest } from "../../skills/professional-slides/runtime/registry.mjs";
import { SLIDE, THEME_SLOT_TOKENS, TOKENS } from "../../skills/professional-slides/runtime/core.mjs";
import { writeCanonicalDeck } from "../../skills/professional-slides/runtime/generation.mjs";
import { auditSlideOverlaps, auditObservedOverlaps, summarizeOverlapAudits } from "../../skills/professional-slides/runtime/validate-overlap.mjs";

const require = createRequire(import.meta.url);
const runtimeModules = process.env.RUNTIME_NODE_MODULES;
if (!runtimeModules) throw new Error("RUNTIME_NODE_MODULES is required");
const { chromium } = require(require.resolve("playwright", { paths: [runtimeModules] }));
const sharp = require(require.resolve("sharp", { paths: [runtimeModules] }));
const JSZip = require(require.resolve("jszip", { paths: [runtimeModules] }));

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outputDirectory = path.resolve(argValue("--output", path.join(repositoryRoot, "tmp", "component-validation")));
const browserPath = argValue("--browser", process.env.PLAYWRIGHT_BROWSER_PATH);
const runtimePython = process.env.RUNTIME_PYTHON;
const presentationSkillDirectory = process.env.PRESENTATION_SKILL_DIR;

function assertSafeOutputDirectory(directory) {
  const relative = path.relative(repositoryRoot, directory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Validation output must be a child of the repository: ${directory}`);
  }
  if (!directory.includes("component-validation")) {
    throw new Error(`Validation output must contain component-validation: ${directory}`);
  }
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}\n${stderr || stdout}`));
    });
  });
}

const fileName = (index) => `slide-${String(index + 1).padStart(3, "0")}`;
const renderNameCandidates = (index) => [
  `slide-${index + 1}.png`,
  `${index + 1}.png`,
  `slide${index + 1}.png`
];

async function resolveRenderedSlide(directory, index) {
  const entries = await fs.readdir(directory);
  for (const candidate of renderNameCandidates(index)) {
    if (entries.includes(candidate)) return path.join(directory, candidate);
  }
  const pngs = entries.filter((entry) => entry.endsWith(".png")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!pngs[index]) throw new Error(`Missing rendered slide ${index + 1} in ${directory}`);
  return path.join(directory, pngs[index]);
}

async function compareImages(referencePath, candidatePath) {
  const width = 640;
  const height = 360;
  const reference = await sharp(referencePath).resize(width, height, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const candidate = await sharp(candidatePath).resize(width, height, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const [referenceBlurred, candidateBlurred] = await Promise.all([
    sharp(referencePath).resize(width, height, { fit: "fill" }).removeAlpha().blur(1.5).raw().toBuffer(),
    sharp(candidatePath).resize(width, height, { fit: "fill" }).removeAlpha().blur(1.5).raw().toBuffer()
  ]);
  let absoluteDifference = 0;
  let blurredDifference = 0;
  let materialPixels = 0;
  let foregroundDifference = 0;
  let foregroundMaterialPixels = 0;
  let foregroundPixels = 0;
  const referenceBackground = [reference[0], reference[1], reference[2]];
  const candidateBackground = [candidate[0], candidate[1], candidate[2]];
  for (let offset = 0; offset < reference.length; offset += 3) {
    const difference = (
      Math.abs(reference[offset] - candidate[offset])
      + Math.abs(reference[offset + 1] - candidate[offset + 1])
      + Math.abs(reference[offset + 2] - candidate[offset + 2])
    ) / 3;
    absoluteDifference += difference;
    blurredDifference += (
      Math.abs(referenceBlurred[offset] - candidateBlurred[offset])
      + Math.abs(referenceBlurred[offset + 1] - candidateBlurred[offset + 1])
      + Math.abs(referenceBlurred[offset + 2] - candidateBlurred[offset + 2])
    ) / 3;
    if (difference > 40) materialPixels += 1;
    const referenceForeground = Math.max(
      Math.abs(reference[offset] - referenceBackground[0]),
      Math.abs(reference[offset + 1] - referenceBackground[1]),
      Math.abs(reference[offset + 2] - referenceBackground[2])
    ) > 12;
    const candidateForeground = Math.max(
      Math.abs(candidate[offset] - candidateBackground[0]),
      Math.abs(candidate[offset + 1] - candidateBackground[1]),
      Math.abs(candidate[offset + 2] - candidateBackground[2])
    ) > 12;
    if (referenceForeground || candidateForeground) {
      foregroundPixels += 1;
      const foregroundPixelDifference = (
        Math.abs(referenceBlurred[offset] - candidateBlurred[offset])
        + Math.abs(referenceBlurred[offset + 1] - candidateBlurred[offset + 1])
        + Math.abs(referenceBlurred[offset + 2] - candidateBlurred[offset + 2])
      ) / 3;
      foregroundDifference += foregroundPixelDifference;
      if (foregroundPixelDifference > 40) foregroundMaterialPixels += 1;
    }
  }
  const pixels = width * height;
  return {
    meanAbsoluteSimilarity: Number((1 - absoluteDifference / (pixels * 255)).toFixed(6)),
    blurredStructureSimilarity: Number((1 - blurredDifference / (pixels * 255)).toFixed(6)),
    materialMismatchRatio: Number((materialPixels / pixels).toFixed(6)),
    foregroundPixelCount: foregroundPixels,
    foregroundSimilarity: Number((1 - foregroundDifference / (Math.max(1, foregroundPixels) * 255)).toFixed(6)),
    foregroundMismatchRatio: Number((foregroundMaterialPixels / Math.max(1, foregroundPixels)).toFixed(6))
  };
}

function expectedTheme(tokens = TOKENS) {
  return Object.fromEntries(Object.entries(THEME_SLOT_TOKENS).map(([slot, tokenId]) => [slot, tokens[tokenId].value.replace("#", "").toUpperCase()]));
}

async function inspectPackage(pptxPath, deck) {
  const zip = await JSZip.loadAsync(await fs.readFile(pptxPath));
  const presentationXml = await zip.file("ppt/presentation.xml").async("string");
  const slideSize = presentationXml.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
  const slideNames = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const namesBySlide = [];
  const lineDirectionMismatches = [];
  const cornerRadiusMismatches = [];
  const textStyleMismatches = [];
  const schemeReferences = new Set();
  for (const [slideIndex, slideName] of slideNames.entries()) {
    const xml = await zip.file(slideName).async("string");
    namesBySlide.push([...xml.matchAll(/<p:cNvPr[^>]*name="([^"]+)"/g)].map((match) => match[1]));
    for (const match of xml.matchAll(/<a:schemeClr val="([^"]+)"/g)) schemeReferences.add(match[1]);
    const shapeBlocks = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map((match) => match[0]);
    for (const node of deck.slides[slideIndex].nodes.filter(item => item.type === "text" && item.text)) {
      const block = shapeBlocks.find(candidate => candidate.includes(`name="ps:${node.id}"`));
      const run = block?.match(/<a:rPr\b([^>]*)>([\s\S]*?)<\/a:rPr>/);
      const actualFace = run?.[2].match(/<a:latin typeface="([^"]+)"/)?.[1];
      const actualSize = Number(run?.[1].match(/\bsz="(\d+)"/)?.[1]);
      const actualBold = /\bb="1"/.test(run?.[1] || "");
      const expectedBold = Boolean(node.style.fontWeight ? node.style.fontFamily.nativeBold : node.style.bold);
      if (actualFace !== node.style.fontFamily.value || actualSize !== Math.round(node.style.fontSize.value * 100) || actualBold !== expectedBold) textStyleMismatches.push({ id: node.id, actualFace, expectedFace: node.style.fontFamily.value, actualSize, expectedSize: node.style.fontSize.value * 100, actualBold, expectedBold });
    }
    for (const node of deck.slides[slideIndex].nodes.filter((item) => item.type === "rect" && item.style.radius?.value > 0)) {
      const block = shapeBlocks.find((candidate) => candidate.includes(`name="ps:${node.id}"`));
      const actual = Number(block?.match(/<a:gd name="adj" fmla="val (\d+)"/)?.[1]);
      const radius = Math.min(node.style.radius.value, node.frame.width / 2, node.frame.height / 2);
      const expected = Math.round(radius / Math.min(node.frame.width, node.frame.height) * 100000);
      if (!Number.isFinite(actual) || Math.abs(actual - expected) > 2) cornerRadiusMismatches.push({ id: node.id, expected, actual });
    }
    for (const node of deck.slides[slideIndex].nodes.filter((item) => item.type === "line")) {
      const expectedName = `ps:${node.id}`;
      const block = shapeBlocks.find((candidate) => candidate.includes(`name="${expectedName}"`));
      const transform = block?.match(/<a:xfrm([^>]*)>/)?.[1] || "";
      const actualFlipH = /\bflipH="1"/.test(transform);
      const actualFlipV = /\bflipV="1"/.test(transform);
      const expectedFlipH = Number(node.data.x2) < Number(node.data.x1);
      const expectedFlipV = Number(node.data.y2) < Number(node.data.y1);
      if (!block || actualFlipH !== expectedFlipH || actualFlipV !== expectedFlipV) {
        lineDirectionMismatches.push({ slide: slideIndex + 1, name: expectedName, expectedFlipH, expectedFlipV, actualFlipH, actualFlipV });
      }
    }
  }
  const themeName = Object.keys(zip.files).find((name) => /^ppt\/theme\/theme\d+\.xml$/.test(name));
  const themeXml = await zip.file(themeName).async("string");
  const themeColors = {};
  for (const slot of Object.keys(THEME_SLOT_TOKENS)) {
    const match = themeXml.match(new RegExp(`<a:${slot}>\\s*<a:srgbClr val="([A-Fa-f0-9]{6})"\\s*\\/>\\s*<\\/a:${slot}>`));
    if (match) themeColors[slot] = match[1].toUpperCase();
  }
  const expectedNamesBySlide = deck.slides.map((slide) => slide.nodes.map((node) => `ps:${node.id}`));
  const missingNames = expectedNamesBySlide.flatMap((expected, index) => expected.filter((name) => !namesBySlide[index]?.includes(name)).map((name) => ({ slide: index + 1, name })));
  const expectedWidth = Math.round(SLIDE.width / 96 * 914400);
  const expectedHeight = Math.round(SLIDE.height / 96 * 914400);
  return {
    slideCount: slideNames.length,
    expectedSlideCount: deck.slides.length,
    slideSize: slideSize ? { widthEmu: Number(slideSize[1]), heightEmu: Number(slideSize[2]) } : null,
    expectedSlideSize: { widthEmu: expectedWidth, heightEmu: expectedHeight },
    themeName: themeXml.match(/<a:theme[^>]*name="([^"]+)"/)?.[1],
    colorSchemeName: themeXml.match(/<a:clrScheme[^>]*name="([^"]+)"/)?.[1],
    fontSchemeName: themeXml.match(/<a:fontScheme[^>]*name="([^"]+)"/)?.[1],
    themeColors,
    expectedThemeColors: expectedTheme(deck.manifest.tokens),
    schemeReferences: [...schemeReferences].sort(),
    namedObjectCount: namesBySlide.reduce((sum, names) => sum + names.filter((name) => name.startsWith("ps:")).length, 0),
    expectedObjectCount: deck.slides.reduce((sum, slide) => sum + slide.nodes.length, 0),
    missingNames,
    lineDirectionMismatches,
    cornerRadiusMismatches,
    textStyleMismatches,
    chartPartCount: Object.keys(zip.files).filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name) && !zip.files[name].dir).length,
    mediaPartCount: Object.keys(zip.files).filter((name) => /^ppt\/media\//.test(name) && !zip.files[name].dir).length
  };
}

function auditArtifactGeometry(deck, observed, tolerance = 1) {
  const objects = new Map(observed.objects.map((object) => [object.roleName, object]));
  const mismatches = [];
  let maximumDeltaPx = 0;
  for (const [slideIndex, slide] of deck.slides.entries()) {
    for (const node of slide.nodes) {
      const object = objects.get(node.id);
      if (!object || !Array.isArray(object.bbox) || object.bbox.length !== 4) continue;
      const expected = [node.frame.x, node.frame.y, node.frame.width, node.frame.height];
      const delta = Math.max(...expected.map((value, index) => Math.abs(value - Number(object.bbox[index]))));
      maximumDeltaPx = Math.max(maximumDeltaPx, delta);
      if (delta > tolerance) mismatches.push({ slide: slideIndex + 1, node: node.id, expected, observed: object.bbox, maximumDeltaPx: delta });
    }
  }
  return { accepted: mismatches.length === 0, maximumDeltaPx: Number(maximumDeltaPx.toFixed(6)), mismatches };
}

async function makeMontage(imagePaths, outputPath) {
  const columns = 4;
  const tileWidth = 320;
  const tileHeight = 180;
  const rows = Math.ceil(imagePaths.length / columns);
  const composites = [];
  for (const [index, imagePath] of imagePaths.entries()) {
    composites.push({
      input: await sharp(imagePath).resize(tileWidth, tileHeight, { fit: "fill" }).png().toBuffer(),
      left: (index % columns) * tileWidth,
      top: Math.floor(index / columns) * tileHeight
    });
  }
  await sharp({ create: { width: columns * tileWidth, height: rows * tileHeight, channels: 3, background: "#FFFFFF" } }).composite(composites).png().toFile(outputPath);
}

async function main() {
  assertSafeOutputDirectory(outputDirectory);
  if (!runtimePython || !presentationSkillDirectory) {
    throw new Error("RUNTIME_PYTHON and PRESENTATION_SKILL_DIR are required for the PowerPoint render gate");
  }
  await fs.rm(outputDirectory, { recursive: true, force: true });
  const htmlDirectory = path.join(outputDirectory, "html");
  const htmlRenderDirectory = path.join(outputDirectory, "html-renders");
  const pptxRenderDirectory = path.join(outputDirectory, "pptx-renders");
  await Promise.all([htmlDirectory, htmlRenderDirectory, pptxRenderDirectory].map((directory) => fs.mkdir(directory, { recursive: true })));

  const golden = args.includes("--golden");
  const { deck, fixtures } = (golden ? buildGoldenSetDeck : buildFixtureDeck)({ palette: argValue("--palette", "mckinsey") });
  const coverage = golden ? auditGoldenCoverage(fixtures) : { accepted: true };
  const generated = await writeCanonicalDeck({
    deck,
    outputDirectory,
    fileStem: "component-validation",
    authoringScriptPath: fileURLToPath(import.meta.url)
  });
  const pptxPath = generated.pptxPath;
  const registry = registryManifest();

  const browser = await chromium.launch({ headless: true, executablePath: browserPath, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: SLIDE.width, height: SLIDE.height }, deviceScaleFactor: 1 });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const htmlNodeCounts = [];
  const overlapAudits = [];
  for (const [index, slide] of deck.slides.entries()) {
    const htmlPath = path.join(htmlDirectory, `${fileName(index)}.html`);
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    htmlNodeCounts.push(await page.locator("[data-node-id]").count());
    overlapAudits.push(await auditSlideOverlaps(page, slide));
    await page.screenshot({ path: path.join(htmlRenderDirectory, `${fileName(index)}.png`) });
    if (htmlNodeCounts[index] !== slide.nodes.length) {
      browserErrors.push(`Slide ${index + 1} has ${htmlNodeCounts[index]} DOM nodes; expected ${slide.nodes.length}`);
    }
  }
  const overlapAudit = summarizeOverlapAudits(overlapAudits);

  await run(runtimePython, [
    path.join(presentationSkillDirectory, "container_tools", "render_slides.py"),
    pptxPath,
    "--output_dir", pptxRenderDirectory,
    "--width", String(SLIDE.width),
    "--height", String(SLIDE.height)
  ], { env: process.env });
  let overflowAudit;
  try {
    const overflow = await run(runtimePython, [
      path.join(presentationSkillDirectory, "container_tools", "slides_test.py"),
      pptxPath
    ], { env: process.env });
    overflowAudit = { accepted: true, output: overflow.stdout.trim() };
  } catch (error) {
    overflowAudit = { accepted: false, error: String(error.message || error) };
  }

  const observed = generated.observation;
  overlapAudit.nativeGeometry = await auditObservedOverlaps(page, deck, observed);
  overlapAudit.accepted &&= overlapAudit.nativeGeometry.accepted;
  await browser.close();
  const packageAudit = await inspectPackage(pptxPath, deck);
  const artifactGeometry = auditArtifactGeometry(deck, observed);

  const visualResults = [];
  const pptxRenderPaths = [];
  const htmlRenderPaths = [];
  for (const [index, fixture] of fixtures.entries()) {
    const htmlRender = path.join(htmlRenderDirectory, `${fileName(index)}.png`);
    const pptxRender = await resolveRenderedSlide(pptxRenderDirectory, index);
    htmlRenderPaths.push(htmlRender);
    pptxRenderPaths.push(pptxRender);
    const similarity = await compareImages(htmlRender, pptxRender);
    const focusedThresholds = fixture.target.startsWith("chart.") || fixture.target === "chart-group"
      ? { blurredStructureSimilarity: 0.985, foregroundSimilarity: 0.94, foregroundMismatchRatio: 0.12 }
      : { blurredStructureSimilarity: 0.98, foregroundSimilarity: 0.62, foregroundMismatchRatio: 0.8 };
    visualResults.push({
      ...fixture,
      sceneNodeCount: deck.slides[index].nodes.length,
      htmlNodeCount: htmlNodeCounts[index],
      htmlRender: path.relative(outputDirectory, htmlRender),
      pptxRender: path.relative(outputDirectory, pptxRender),
      ...similarity,
      thresholds: focusedThresholds,
      accepted: similarity.meanAbsoluteSimilarity >= 0.94
        && similarity.materialMismatchRatio <= 0.12
        && similarity.blurredStructureSimilarity >= focusedThresholds.blurredStructureSimilarity
        && similarity.foregroundSimilarity >= focusedThresholds.foregroundSimilarity
        && similarity.foregroundMismatchRatio <= focusedThresholds.foregroundMismatchRatio
    });
  }

  await makeMontage(htmlRenderPaths, path.join(outputDirectory, "html-contact-sheet.png"));
  await makeMontage(pptxRenderPaths, path.join(outputDirectory, "pptx-contact-sheet.png"));

  const expectedRoleNames = new Set(deck.slides.flatMap((slide) => slide.nodes.map((node) => node.id)));
  const observedRoleNames = new Set(observed.objects.map((object) => object.roleName));
  const artifactMissingNames = [...expectedRoleNames].filter((name) => !observedRoleNames.has(name));
  const artifactInterpretsAdapter = observed.slides.length === deck.slides.length
    && observed.objects.length >= deck.slides.reduce((sum, slide) => sum + slide.nodes.length, 0)
    && artifactMissingNames.length === 0
    && artifactGeometry.accepted
    && Object.entries(expectedTheme(deck.manifest.tokens)).every(([slot, color]) => observed.theme.colors[slot] === `#${color}`)
    && observed.theme.fonts.body === deck.manifest.tokens["font.body"].value
    && observed.theme.fonts.heading === deck.manifest.tokens["font.display"].value;
  const packageAccepted = packageAudit.slideCount === packageAudit.expectedSlideCount
    && packageAudit.slideSize?.widthEmu === packageAudit.expectedSlideSize.widthEmu
    && packageAudit.slideSize?.heightEmu === packageAudit.expectedSlideSize.heightEmu
    && packageAudit.themeName === "Professional Slides"
    && packageAudit.colorSchemeName === "Professional Slides"
    && packageAudit.fontSchemeName === "Professional Slides"
    && JSON.stringify(packageAudit.themeColors) === JSON.stringify(packageAudit.expectedThemeColors)
    && packageAudit.namedObjectCount === packageAudit.expectedObjectCount
    && packageAudit.missingNames.length === 0
    && packageAudit.lineDirectionMismatches.length === 0
    && packageAudit.cornerRadiusMismatches.length === 0
    && packageAudit.textStyleMismatches.length === 0
    && packageAudit.schemeReferences.length > 0
    && packageAudit.chartPartCount === 0
    && packageAudit.mediaPartCount === 0;
  const report = {
    schema: "professional-slides.component-validation/v1",
    generatedAt: new Date().toISOString(),
    accepted: coverage.accepted && browserErrors.length === 0 && visualResults.every((result) => result.accepted) && packageAccepted && artifactInterpretsAdapter && overflowAudit.accepted && overlapAudit.accepted,
    deck: {
      id: deck.id,
      palette: deck.palette,
      typography: deck.typography,
      slideCount: deck.slides.length,
      componentCount: registry.components.length,
      chartCount: registry.components.filter((item) => item.category === "chart").length,
      layoutFixtureCount: fixtures.filter((item) => item.kind === "layout").length,
      variantFixtureCount: fixtures.filter((item) => item.kind === "variant").length,
      componentBoardCount: fixtures.filter((item) => item.kind === "board").length,
      componentCoverageCount: fixtures.flatMap((item) => item.coverage || []).length,
      sceneNodeCount: deck.slides.reduce((sum, slide) => sum + slide.nodes.length, 0),
      designHash: deck.manifest.designHash,
      pptxSha256: generated.candidateSha256,
      canonicalGenerationReceipt: path.relative(outputDirectory, generated.receiptPath)
    },
    gates: {
      coverage,
      html: { accepted: browserErrors.length === 0, errors: browserErrors },
      overflow: overflowAudit,
      overlap: overlapAudit,
      package: { accepted: packageAccepted, ...packageAudit },
      artifactTool: {
        accepted: artifactInterpretsAdapter,
        slideCount: observed.slides.length,
        objectCount: observed.objects.length,
        missingNamedObjects: artifactMissingNames,
        geometry: artifactGeometry,
        theme: observed.theme
      },
      visualParity: {
        accepted: visualResults.every((result) => result.accepted),
        thresholds: {
          fullFrame: { meanAbsoluteSimilarity: 0.94, materialMismatchRatio: 0.12 },
          charts: { blurredStructureSimilarity: 0.985, foregroundSimilarity: 0.94, foregroundMismatchRatio: 0.12 },
          otherComponents: { blurredStructureSimilarity: 0.98, foregroundSimilarity: 0.62, foregroundMismatchRatio: 0.8 }
        },
        minimumSimilarity: Math.min(...visualResults.map((result) => result.meanAbsoluteSimilarity)),
        minimumBlurredStructureSimilarity: Math.min(...visualResults.map((result) => result.blurredStructureSimilarity)),
        maximumMismatchRatio: Math.max(...visualResults.map((result) => result.materialMismatchRatio)),
        minimumForegroundSimilarity: Math.min(...visualResults.map((result) => result.foregroundSimilarity)),
        maximumForegroundMismatchRatio: Math.max(...visualResults.map((result) => result.foregroundMismatchRatio))
      }
    },
    fixtures: visualResults
  };
  await fs.writeFile(path.join(outputDirectory, "validation-report.json"), JSON.stringify(report, null, 2));
  await new Promise((resolve, reject) => {
    process.stdout.write(
      `${JSON.stringify({ accepted: report.accepted, report: path.join(outputDirectory, "validation-report.json"), ...report.deck, gates: report.gates }, null, 2)}\n`,
      (error) => error ? reject(error) : resolve()
    );
  });
  if (!report.accepted) process.exitCode = 1;
}

main().then(
  () => process.exit(process.exitCode || 0),
  (error) => {
    console.error(error.stack || error);
    process.exit(1);
  }
);
