import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadArtifactTool() {
  const root = process.env.RUNTIME_NODE_MODULES;
  if (!root) throw new Error("RUNTIME_NODE_MODULES is required");
  return import(pathToFileURL(path.join(root, "@oai", "artifact-tool", "dist", "artifact_tool.mjs")).href);
}

function parseNdjson(value) {
  return String(value || "").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

export async function observePptx(pptxPath, { renderDirectory = null } = {}) {
  const { FileBlob, PresentationFile } = await loadArtifactTool();
  const presentation = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
  const inspection = await presentation.inspect({
    kind: "deck,slide,textbox,shape,image,table,chart,notes,layout",
    maxChars: 10_000_000
  });
  const records = parseNdjson(inspection.ndjson);
  const layouts = [];
  if (renderDirectory) await fs.mkdir(renderDirectory, { recursive: true });
  for (const [index, slide] of presentation.slides.items.entries()) {
    const layout = await slide.export({ format: "layout" });
    layouts.push(JSON.parse(await layout.text()));
    if (renderDirectory) {
      const png = await presentation.export({ slide, format: "png", scale: 1 });
      await fs.writeFile(path.join(renderDirectory, `slide-${index + 1}.png`), new Uint8Array(await png.arrayBuffer()));
    }
  }
  return {
    records,
    layouts,
    proto: presentation.toProto(),
    counts: records.reduce((counts, record) => {
      counts[record.kind] = (counts[record.kind] || 0) + 1;
      return counts;
    }, {})
  };
}

export function normalizeObservedDeck(observed) {
  const objects = observed.records
    .filter((record) => ["shape", "textbox", "image", "table", "chart"].includes(record.kind))
    .map((record) => ({
      id: record.id,
      slide: record.slide,
      kind: record.kind,
      name: record.name,
      roleName: String(record.name || "").replace(/^ps:/, ""),
      bbox: record.bbox,
      text: record.text,
      chartType: record.chartType
    }));
  const themeColors = {};
  for (const entry of observed.proto?.theme?.colorScheme?.colors || []) {
    themeColors[entry.name] = `#${entry.color.lastColor || entry.color.value}`.toUpperCase();
  }
  return {
    schema: "professional-slides.observed-deck/v1",
    slides: observed.records.filter((record) => record.kind === "slide"),
    layouts: observed.records.filter((record) => record.kind === "layout"),
    renderLayouts: observed.layouts,
    objects,
    theme: {
      name: observed.proto?.theme?.colorScheme?.name,
      colors: themeColors,
      fonts: {
        heading: observed.proto?.theme?.fontScheme?.majorFont?.latinTypeface,
        body: observed.proto?.theme?.fontScheme?.minorFont?.latinTypeface
      }
    }
  };
}
