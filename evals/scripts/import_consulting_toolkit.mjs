#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REGISTRY } from "../../skills/professional-slides/runtime/registry.mjs";

const COMPOSITIONS = Object.freeze(["flow.row", "flow.column", "grid", "overlay", "absolute", "section"]);
const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const asPath = (value) => value.startsWith("file:") ? fileURLToPath(value) : path.resolve(value);
const sourceInput = argValue("--source", process.env.CONSULTING_TOOLKIT_ROOT);
if (!sourceInput) throw new Error("Pass --source <consulting-toolkit/index.html> or set CONSULTING_TOOLKIT_ROOT");
const sourceArgument = asPath(sourceInput);
if (path.extname(sourceArgument).toLowerCase() === ".html" && path.basename(sourceArgument) !== "index.html") {
  throw new Error("The consulting-toolkit gallery must be index.html");
}
const sourceRoot = path.extname(sourceArgument).toLowerCase() === ".html" ? path.dirname(sourceArgument) : sourceArgument;
const outputPath = path.resolve(argValue("--output", path.join(process.cwd(), "tmp", "component-validation", "consulting-toolkit-coverage.json")));

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const unique = (items) => [...new Set(items)];

function selectCapabilities(slide) {
  const semantic = String(slide.ai_semantic_component || slide.semantic_component || "text").toLowerCase();
  const title = String(slide.derived_title || slide.working_title || "").toLowerCase();
  const text = `${title} ${semantic}`;
  const components = [];
  let composition = "flow.column";

  if (semantic === "cover") {
    components.push("cover");
    composition = "absolute";
  } else if (semantic === "divider") {
    components.push("section-divider");
    composition = "absolute";
  } else {
    components.push("action-title");
  }

  if (/contents|agenda|context of this/.test(text)) components.push("contents");
  if (/organisation|organizational|organisational|project team|team chart|management overview|functions/.test(text)) components.push("organization");
  if (/decision tree|hypothesis|profitability framework/.test(text)) components.push("tree");
  if (/customer journey|touchpoint/.test(text)) components.push("journey");
  if (/roadmap|implementation plan|roll out|rollout|phases|workplan/.test(text)) components.push("roadmap");
  if (/timeline|milestone|meeting cadence|key meetings/.test(text)) components.push("timeline");
  if (/process|drop-down|deep-dive|lifecycle|life cycle/.test(text)) components.push("process");
  if (/map|geograph|country|countries/.test(text) && !/roadmap/.test(text)) components.push("map");
  if (/funnel|pipeline/.test(text)) components.push("funnel");
  if (/strategy house|7-s|framework|growth-share matrix|portfolio matrix/.test(text) && !/horizon/.test(text)) components.push("matrix");

  if (/three horizons|horizon model|growth horizons/.test(text)) components.push("chart.horizons");
  else if (/waterfall/.test(text) || semantic === "waterfall") components.push("chart.waterfall");
  else if (/bubble/.test(text)) components.push("chart.bubble");
  else if (/scatter/.test(text) || semantic === "scatter") components.push("chart.scatter");
  else if (/donut|doughnut/.test(text) || semantic === "donut") components.push("chart.donut");
  else if (/pie/.test(text)) components.push("chart.pie");
  else if (/area chart/.test(text)) components.push("chart.area");
  else if (/line chart/.test(text) || semantic === "line") components.push("chart.line");
  else if (/stacked/.test(text) && /column/.test(text)) components.push("chart.stacked-column");
  else if (/stacked/.test(text) || /100%/.test(text)) components.push("chart.stacked-bar");
  else if (/column/.test(text)) components.push("chart.column");
  else if (/bar/.test(text) || semantic === "bar") components.push("chart.bar");

  if (/assessment|status|traffic light/.test(text)) components.push("status-list");
  if (/heatmap|scorecard|evaluation|criteria|comparison|scenario|pros|issues/.test(text)) components.push(/heatmap|scorecard/.test(text) ? "heatmap" : "comparison-table");
  else if (semantic === "table" || /table|target list|balanced scorecard/.test(text)) components.push("table");

  if (/quote|interview/.test(text)) components.push("quote-cluster");
  if (/logo/.test(text)) components.push("logo");
  if (/picture|image|photo/.test(text)) components.push("image-frame");
  if (/key trend|key point|takeaway|insight|conclusion/.test(text)) components.push("insight");

  if (semantic === "two-column") {
    components.push("panel");
    composition = "flow.row";
  } else if (semantic === "chart-text") {
    components.push("content-rail");
    composition = "flow.row";
  } else if (["scatter", "matrix"].includes(semantic)) {
    composition = "overlay";
  } else if (semantic === "table") {
    composition = "grid";
  }

  const substantive = components.filter((component) => !["action-title", "source"].includes(component));
  if (!substantive.length && !["cover", "divider"].includes(semantic)) components.push(semantic === "text" ? "paragraph" : "panel");
  if (!["cover", "divider"].includes(semantic)) components.push("source");
  return { composition, components: unique(components) };
}

async function main() {
  const inventoryPath = path.join(sourceRoot, "slide-inventory.json");
  const galleryPath = path.join(sourceRoot, "index.html");
  const [inventoryBytes, galleryBytes] = await Promise.all([fs.readFile(inventoryPath), fs.readFile(galleryPath)]);
  const inventory = JSON.parse(inventoryBytes.toString("utf8"));
  const gallery = galleryBytes.toString("utf8");
  const marker = '<h2 id="source-gallery-title">';
  const markerOffset = gallery.indexOf(marker);
  if (markerOffset < 0) throw new Error("Source slide gallery marker is missing");
  const sourceGallery = gallery.slice(markerOffset);
  const gallerySlideNumbers = [...sourceGallery.matchAll(/<span>(\d{3})<\/span>/g)].map((match) => Number(match[1]));
  const records = inventory.slides.map((slide) => {
    const selected = selectCapabilities(slide);
    return {
      slide: slide.slide,
      sourceImage: slide.hq_image,
      sourceHtml: slide.fidelity_html || slide.html,
      sourceClassification: slide.ai_semantic_component || slide.semantic_component,
      composition: selected.composition,
      components: selected.components
    };
  });
  const unknownComponents = records.flatMap((record) => record.components.filter((component) => !REGISTRY.has(component)).map((component) => ({ slide: record.slide, component })));
  const unknownCompositions = records.filter((record) => !COMPOSITIONS.includes(record.composition)).map((record) => ({ slide: record.slide, composition: record.composition }));
  const uncoveredSlides = records.filter((record) => record.components.length === 0).map((record) => record.slide);
  const missingGallerySlides = records.map((record) => record.slide).filter((slide) => !gallerySlideNumbers.includes(slide));
  const extraGallerySlides = gallerySlideNumbers.filter((slide) => !records.some((record) => record.slide === slide));
  const usage = {};
  for (const record of records) for (const component of record.components) usage[component] = (usage[component] || 0) + 1;
  const accepted = records.length === 205
    && gallerySlideNumbers.length === 205
    && unknownComponents.length === 0
    && unknownCompositions.length === 0
    && uncoveredSlides.length === 0
    && missingGallerySlides.length === 0
    && extraGallerySlides.length === 0;
  const report = {
    schema: "professional-slides.reference-coverage/v1",
    generatedAt: new Date().toISOString(),
    accepted,
    source: {
      root: sourceRoot,
      inventorySha256: sha256(inventoryBytes),
      sourceGallerySha256: sha256(sourceGallery),
      sourceGalleryOffset: markerOffset,
      ignoredPrefixBytes: markerOffset
    },
    coverage: {
      inventorySlides: records.length,
      sourceGallerySlides: gallerySlideNumbers.length,
      coveredSlides: records.length - uncoveredSlides.length,
      registryComponents: REGISTRY.size,
      compositionPrimitives: COMPOSITIONS,
      unknownComponents,
      unknownCompositions,
      uncoveredSlides,
      missingGallerySlides,
      extraGallerySlides,
      componentUsage: Object.fromEntries(Object.entries(usage).sort(([a], [b]) => a.localeCompare(b)))
    },
    slides: records
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify({ accepted, output: outputPath, ...report.coverage }, null, 2)}\n`);
  if (!accepted) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
