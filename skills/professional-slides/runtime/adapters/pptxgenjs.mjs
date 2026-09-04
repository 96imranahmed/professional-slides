import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { SLIDE, THEME_SLOT_TOKENS, TOKENS, styleValue } from "../core.mjs";

const require = createRequire(import.meta.url);

function runtimeModules() {
  const root = process.env.RUNTIME_NODE_MODULES;
  if (!root) throw new Error("RUNTIME_NODE_MODULES is required");
  return root;
}

function loadPptxGenJS() {
  const resolved = require.resolve("pptxgenjs", { paths: [runtimeModules()] });
  return require(resolved);
}

async function loadJsZip() {
  try {
    const resolved = require.resolve("jszip", { paths: [runtimeModules()] });
    return require(resolved);
  } catch {
    const resolved = path.join(runtimeModules(), "pptxgenjs", "node_modules", "jszip", "lib", "index.js");
    return require(resolved);
  }
}

const inch = (value) => Number((value / 96).toFixed(6));
const points = (value) => Number((value * 0.75).toFixed(3));
const hex = (value) => String(value).replace(/^#/, "").toUpperCase();

const COLOR_MAP_ALIAS = Object.freeze({ dk1: "tx1", lt1: "bg1", dk2: "tx2", lt2: "bg2" });

function colorValue(binding) {
  if (binding && typeof binding === "object") return COLOR_MAP_ALIAS[binding.themeSlot] || binding.themeSlot || hex(binding.value);
  return hex(styleValue(binding));
}

function lineOptions(style, data = {}) {
  const styleType = style.dash === "dash" ? "dash" : "solid";
  return {
    color: colorValue(style.stroke),
    width: style.lineWidth ? points(styleValue(style.lineWidth)) : 0,
    dashType: styleType,
    ...(data.endArrow ? { endArrowType: "triangle" } : {})
  };
}

function shapeOptions(node) {
  const { frame, style } = node;
  const transparency = style.opacity === undefined ? 0 : Math.round((1 - style.opacity) * 100);
  return {
    x: inch(frame.x),
    y: inch(frame.y),
    w: inch(frame.width),
    h: inch(frame.height),
    objectName: `ps:${node.id}`,
    fill: style.fill === "none" ? { color: "FFFFFF", transparency: 100 } : { color: colorValue(style.fill), transparency },
    line: style.stroke === "none" ? { color: "FFFFFF", transparency: 100, width: 0 } : lineOptions(style)
  };
}

function addNode(slide, node, pptx) {
  const { frame, style, data } = node;
  if (node.type === "text") {
    slide.addText(node.text, {
      x: inch(frame.x), y: inch(frame.y), w: inch(frame.width), h: inch(frame.height),
      objectName: `ps:${node.id}`,
      fontFace: styleValue(style.fontFamily),
      fontSize: styleValue(style.fontSize),
      color: colorValue(style.color),
      bold: Boolean(style.fontWeight ? style.fontFamily.nativeBold : style.bold),
      align: style.align || "left",
      valign: style.valign === "top" ? "top" : style.valign === "bottom" ? "bottom" : "mid",
      margin: 0,
      breakLine: false,
      ...(style.wrap === false ? { wrap: false } : {}),
      ...(style.lineHeight ? { lineSpacing: points(style.lineHeight) } : { lineSpacingMultiple: 1.0 }),
      paraSpaceAfterPt: 0,
      paraSpaceBeforePt: 0
    });
    return;
  }
  if (node.type === "line") {
    const x1 = Number(data.x1);
    const y1 = Number(data.y1);
    const x2 = Number(data.x2);
    const y2 = Number(data.y2);
    slide.addShape(pptx.ShapeType.line, {
      x: inch(Math.min(x1, x2)),
      y: inch(Math.min(y1, y2)),
      w: inch(Math.abs(x2 - x1)),
      h: inch(Math.abs(y2 - y1)),
      flipH: x2 < x1,
      flipV: y2 < y1,
      objectName: `ps:${node.id}`,
      line: lineOptions(style, data)
    });
    return;
  }
  if (node.type === "ellipse") {
    slide.addShape(pptx.ShapeType.ellipse, shapeOptions(node));
    return;
  }
  if (node.type === "wedge") {
    // The scene, SVG, and PowerPoint pie preset all use mathematical angles:
    // 0 degrees at three o'clock and -90 degrees at twelve o'clock.
    const normalizeAngle = (angle) => ((Number(angle) % 360) + 360) % 360;
    slide.addShape(pptx.ShapeType.pie, {
      ...shapeOptions(node),
      angleRange: [normalizeAngle(data.startAngle), normalizeAngle(data.endAngle)]
    });
    return;
  }
  if (node.type === "shape") {
    const shapeType = pptx.ShapeType[data.geometry];
    if (!shapeType) throw new Error(`Unsupported PptxGenJS scene geometry: ${data.geometry}`);
    slide.addShape(shapeType, shapeOptions(node));
    return;
  }
  if (node.type === "rect") {
    const radius = styleValue(style.radius || 0);
    slide.addShape(radius > 0 ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, { ...shapeOptions(node), ...(radius > 0 ? { rectRadius: inch(Math.min(radius, frame.width / 2, frame.height / 2)) } : {}) });
    return;
  }
  throw new Error(`Unsupported PPTX scene primitive: ${node.type}`);
}

function themeXmlColor(name, tokenId, tokens) {
  return `<a:${name}><a:srgbClr val="${hex(tokens[tokenId].value)}"/></a:${name}>`;
}

async function applyTheme(pptxPath, tokens) {
  const JSZip = await loadJsZip();
  const zip = await JSZip.loadAsync(await fs.readFile(pptxPath));
  const themeNames = Object.keys(zip.files).filter((name) => /^ppt\/theme\/theme\d+\.xml$/.test(name));
  if (!themeNames.length) throw new Error("PptxGenJS output did not contain a PowerPoint theme");
  for (const name of themeNames) {
    let xml = await zip.file(name).async("string");
    xml = xml.replace(/<a:theme ([^>]*?)name="[^"]+"/, '<a:theme $1name="Professional Slides"');
    xml = xml.replace(/<a:clrScheme name="[^"]+">/, '<a:clrScheme name="Professional Slides">');
    xml = xml.replace(/<a:fontScheme name="[^"]+">/, '<a:fontScheme name="Professional Slides">');
    for (const [slot, tokenId] of Object.entries(THEME_SLOT_TOKENS)) {
      const pattern = new RegExp(`<a:${slot}>[\\s\\S]*?<\\/a:${slot}>`);
      if (pattern.test(xml)) xml = xml.replace(pattern, themeXmlColor(slot, tokenId, tokens));
    }
    const xmlText = value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
    for (const [role, font] of [["majorFont", "font.display"], ["minorFont", "font.body"]]) {
      xml = xml.replace(new RegExp(`(<a:${role}>[\\s\\S]*?<a:latin typeface=")[^"]*("\\s*\\/>)`), (_, before, after) => before + xmlText(tokens[font].value) + after);
    }
    zip.file(name, xml);
  }
  // PptxGenJS 4 emits one master but declares one master content type per
  // slide. Remove only these known phantom declarations, never real parts.
  const types = await zip.file("[Content_Types].xml").async("string");
  zip.file("[Content_Types].xml", types.replace(/<Override\b[^>]*PartName="\/ppt\/slideMasters\/(slideMaster\d+\.xml)"[^>]*\/>/g,
    (entry, name) => zip.file(`ppt/slideMasters/${name}`) ? entry : ""));
  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await fs.writeFile(pptxPath, bytes);
}

export async function writePptx(deck, pptxPath) {
  const tokens = deck.manifest.tokens;
  const PptxGenJS = loadPptxGenJS();
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "PS_16_9", width: inch(SLIDE.width), height: inch(SLIDE.height) });
  pptx.layout = "PS_16_9";
  pptx.author = "Professional Slides runtime";
  pptx.subject = "Deterministic component fixture";
  pptx.title = deck.id;
  pptx.company = "Professional Slides";
  pptx.lang = "en-US";
  pptx.theme = { headFontFace: tokens["font.display"].value, bodyFontFace: tokens["font.body"].value };
  pptx.defineSlideMaster({
    title: "PS_BASE",
    background: { color: hex(tokens["color.canvas"].value) },
    objects: []
  });
  deck.slides.forEach((sceneSlide) => {
    const slide = pptx.addSlide("PS_BASE");
    slide.background = { color: hex(tokens["color.canvas"].value) };
    sceneSlide.nodes.forEach((node) => addNode(slide, node, pptx));
    slide.addNotes(`Professional Slides scene ${sceneSlide.id}\nPalette ${deck.palette.id}\nDesign hash ${deck.manifest.designHash}\n[Sources]\n${deck.palette.source || deck.palette.basis}\n[/Sources]`);
  });
  await fs.mkdir(path.dirname(pptxPath), { recursive: true });
  await pptx.writeFile({ fileName: pptxPath });
  await applyTheme(pptxPath, tokens);
  const bytes = await fs.readFile(pptxPath);
  return { pptxPath, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
}

export async function artifactToolModule() {
  const entry = path.join(runtimeModules(), "@oai", "artifact-tool", "dist", "artifact_tool.mjs");
  return import(pathToFileURL(entry).href);
}
