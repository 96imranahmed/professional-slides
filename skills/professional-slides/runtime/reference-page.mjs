// Image reconstruction is an authored page, not an image-to-PPTX service.
// Its bounded nodes use the same scene, emitter, readback and pixel gates.
import fs from "node:fs";
import path from "node:path";
import { primitive, textPrimitive, linePrimitive, token, tokenValue } from "./core.mjs";
import { measureText } from "./text-layout.mjs";

const frame = { type: "object", required: ["x", "y", "width", "height"], additionalProperties: false,
  properties: Object.fromEntries(["x", "y", "width", "height"].map(k => [k, { type: "number", minimum: 0 }])) };
export const REFERENCE_SCHEMA = {
  type: "object", required: ["id", "type", "title", "reference", "nodes"], additionalProperties: false,
  properties: {
    id: { type: "string" }, type: { const: "reference" }, title: { type: "string" }, form: { const: "native" },
    reference: { type: "string", description: "Supplied source image, relative to the workspace. Canvas coordinates are 1280 x 720." },
    notes: { type: "string" }, sourceSlide: { type: "number" }, hidden: { type: "boolean" },
    uncertainties: { type: "array", items: { type: "string" } },
    nodes: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false,
      required: ["id", "kind", "frame"], properties: {
        id: { type: "string" }, kind: { enum: ["text", "rect", "ellipse", "line", "image"] }, frame,
        text: { type: "string" }, src: { type: "string" },
        style: { type: "object", additionalProperties: false, properties: {
          fill: { type: "string" }, stroke: { type: "string" }, color: { type: "string" },
          fontFamily: { type: "string" }, fontSize: { type: "number", minimum: 9, maximum: 96 },
          lineWidth: { type: "number", minimum: 0, maximum: 12 }, bold: { type: "boolean" },
          align: { enum: ["left", "center", "right"] }
        } }
      } } }
  }
};
export function referenceExample() {
  return { id: "reference-1", type: "reference", title: "Reconstructed reference", reference: "sources/reference.png", nodes: [
    { id: "title", kind: "text", text: "Replace with the source's exact text", frame: { x: 64, y: 54, width: 1152, height: 70 }, style: { fontSize: 28, bold: true } }
  ], uncertainties: [] };
}
export function validateReference(page) {
  for(const k of Object.keys(page))if(!(k in REFERENCE_SCHEMA.properties))throw new Error(`Unknown reference page key: ${k}`);
  if (typeof page.reference !== "string" || !page.reference.trim()) throw new Error("reference requires its source image path");
  if (!Array.isArray(page.nodes) || !page.nodes.length) throw new Error("reference needs reconstructed nodes; inspect the image and use catalog --type reference --schema");
  const ids = new Set();
  for (const n of page.nodes) {
    for(const k of Object.keys(n))if(!(k in REFERENCE_SCHEMA.properties.nodes.items.properties))throw new Error(`Unknown reference node key: ${k}`);
    if (!n.id || ids.has(n.id)) throw new Error("reference node ids must be unique and nonempty");
    ids.add(n.id);
    if (!["text", "rect", "ellipse", "line", "image"].includes(n.kind)) throw new Error(`unsupported reference node ${n.kind}`);
    const f = n.frame;
    if (!f || ![f.x, f.y, f.width, f.height].every(v => Number.isFinite(v) && v >= 0) || f.x + f.width > 1280.01 || f.y + f.height > 720.01) throw new Error(`${n.id}: frame must be inside 1280 x 720`);
    if (n.kind !== "line" && (!f.width || !f.height)) throw new Error(`${n.id}: frame must have area`);
    if (n.kind === "text" && (typeof n.text !== "string" || !n.text.trim())) throw new Error(`${n.id}: text is required`);
    if (n.kind === "image" && !n.src) throw new Error(`${n.id}: image src is required`);
    for (const [k, v] of Object.entries(n.style || {})) {
      if (!(k in REFERENCE_SCHEMA.properties.nodes.items.properties.style.properties)) throw new Error(`${n.id}: unknown style ${k}`);
      if (["fill", "stroke", "color"].includes(k) && v !== "none" && !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${n.id}: ${k} must be #RRGGBB or none`);
      if (k === "fontSize" && (!Number.isFinite(v) || v < 9 || v > 96)) throw new Error(`${n.id}: fontSize must be 9..96 pt`);
      if (k === "lineWidth" && (!Number.isFinite(v) || v < 0 || v > 12)) throw new Error(`${n.id}: lineWidth must be 0..12`);
      if (k === "bold" && typeof v !== "boolean") throw new Error(`${n.id}: bold must be boolean`);
      if (k === "align" && !["left","center","right"].includes(v)) throw new Error(`${n.id}: unknown text alignment`);
      if (k === "fontFamily" && (typeof v !== "string" || !v.trim())) throw new Error(`${n.id}: fontFamily must be a string`);
    }
  }
  return page;
}
export function referencePlan(slide, baseDir) {
  const source = path.resolve(baseDir, slide.reference);
  if (!fs.existsSync(source)) throw new Error(`reference source missing: ${source}`);
  const nodes = slide.nodes.map(n => {
    if (n.kind !== "image") return n;
    const src = path.resolve(baseDir, n.src);
    if (!fs.existsSync(src)) throw new Error(`reference image missing: ${src}`);
    if (src === source) throw new Error("The full source image cannot stand in for editable reconstruction; use cropped photographs only");
    if (fs.readFileSync(src).equals(fs.readFileSync(source))) throw new Error("A copy of the full source image cannot stand in for editable reconstruction");
    const ext = path.extname(src).slice(1).replace("jpg", "jpeg");
    if (!["png", "jpeg"].includes(ext)) throw new Error("reference pictures must be PNG or JPEG");
    return { ...n, src: `data:image/${ext};base64,${fs.readFileSync(src).toString("base64")}` };
  });
  return { id: slide.id, kind: "reference", title: slide.title, notes: [slide.notes, ...(slide.uncertainties || [])].filter(Boolean).join("\n"),
    reference: source, nodes };
}
export function registerReference(registry) {
  registry.set("reference-page", { id: "reference-page", version: "1.0.0", category: "reference", role: "reference",
    tokens: ["font.body", "type.body", "color.ink", "color.surface", "color.rule", "line.hairline"],
    preferredSize: { width: 1280, height: 720 }, sample: { reference: "supplied-image", nodes: referenceExample().nodes },
    render({ id, props }) {
      const nodes = props.nodes.map(n => {
        const own = `${id}-${n.id}`, s = n.style || {};
        // Measured source styling has explicit provenance, separate from house tokens.
        const style = {};
        // A picture takes no outline unless the source drew one; shapes and lines keep a visible default.
        const defaults = n.kind === "text" ? { fontFamily: tokenValue(token("font.body")), fontSize: tokenValue(token("type.body")), color: "#111418" }
          : n.kind === "image" ? {} : { fill: n.kind === "line" ? "none" : "#FFFFFF", stroke: "#808080", lineWidth: 1 };
        for (const [k, v] of Object.entries({ ...defaults, ...s })) style[k] = ["fill", "stroke", "color", "fontFamily", "fontSize", "lineWidth"].includes(k) && v !== "none"
          ? { tokenId: `reference.${own}.${k}`, value: v, reference: props.reference } : v;
        let node;
        const data = { referenceSource: props.reference };
        if (n.kind === "text") {
          const m = measureText(n.text, n.frame.width, { fontFamily: s.fontFamily || defaults.fontFamily, fontSize: s.fontSize || defaults.fontSize, bold: s.bold || false });
          if (m.height > n.frame.height + 1) throw new Error(`${n.id}: reference text needs ${m.height}px, frame has ${n.frame.height}px`);
          node = textPrimitive({ id: own, role: "text", frame: n.frame, text: n.text, data });
        } else if (n.kind === "line") node = linePrimitive({ id: own, ...{ x1: n.frame.x, y1: n.frame.y, x2: n.frame.x + n.frame.width, y2: n.frame.y + n.frame.height }, data });
        else node = primitive({ id: own, type: n.kind, frame: n.frame, data: n.kind === "image" ? { ...data, src: n.src } : data });
        node.style = style;
        return node;
      });
      return { nodes };
    }
  });
  return registry;
}
