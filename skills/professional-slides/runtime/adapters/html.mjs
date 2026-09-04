import { TOKENS, SLIDE, styleValue } from "../core.mjs";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cssBinding(value) {
  if (value && typeof value === "object" && value.cssVar) return `var(${value.cssVar})`;
  return String(styleValue(value));
}

function svgStyle(style) {
  const fill = style.fill === "none" ? "none" : cssBinding(style.fill || "none");
  const stroke = style.stroke === "none" ? "none" : cssBinding(style.stroke || "none");
  const width = style.lineWidth ? cssBinding(style.lineWidth) : 0;
  const dash = style.dash === "dash" ? "8 6" : "none";
  const opacity = style.opacity ?? 1;
  return `fill:${fill};stroke:${stroke};stroke-width:${width};stroke-dasharray:${dash};opacity:${opacity}`;
}

function polar(cx, cy, radius, angle) {
  const radians = angle * Math.PI / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function wedgePath(frame, startAngle, endAngle) {
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  const radius = Math.min(frame.width, frame.height) / 2;
  const start = polar(cx, cy, radius, endAngle);
  const end = polar(cx, cy, radius, startAngle);
  const large = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

const SHAPE_POINTS = Object.freeze({
  notchedRightArrow: [[0, 0], [0.78, 0], [1, 0.5], [0.78, 1], [0, 1], [0.18, 0.5]],
  rightArrow: [[0, 0.18], [0.72, 0.18], [0.72, 0], [1, 0.5], [0.72, 1], [0.72, 0.82], [0, 0.82]],
  leftArrow: [[1, 0.18], [0.28, 0.18], [0.28, 0], [0, 0.5], [0.28, 1], [0.28, 0.82], [1, 0.82]],
  triangle: [[0.5, 0], [1, 1], [0, 1]],
  rtTriangle: [[0, 0], [1, 1], [0, 1]],
  diamond: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
  pentagon: [[0.5, 0], [1, 0.38], [0.82, 1], [0.18, 1], [0, 0.38]],
  hexagon: [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]],
  parallelogram: [[0.18, 0], [1, 0], [0.82, 1], [0, 1]],
  trapezoid: [[0.18, 0], [0.82, 0], [1, 1], [0, 1]],
  downArrow: [[0.25, 0], [0.75, 0], [0.75, 0.58], [1, 0.58], [0.5, 1], [0, 0.58], [0.25, 0.58]],
  upArrow: [[0.5, 0], [1, 0.42], [0.75, 0.42], [0.75, 1], [0.25, 1], [0.25, 0.42], [0, 0.42]]
});

function polygonPoints(frame, geometry) {
  // PresentationML's default chevron inset is half the shorter dimension,
  // not a fixed fraction of width. Wide rollout bands expose the difference.
  const inset = Math.min(frame.width, frame.height) / (2 * frame.width);
  const points = geometry === "chevron" ? [[0, 0], [1 - inset, 0], [1, 0.5], [1 - inset, 1], [0, 1], [inset, 0.5]] : SHAPE_POINTS[geometry];
  if (!points) throw new Error(`Unsupported HTML scene geometry: ${geometry}`);
  return points.map(([x, y]) => `${frame.x + x * frame.width},${frame.y + y * frame.height}`).join(" ");
}

function svgNode(node) {
  const { frame, style, data } = node;
  const common = `data-node-id="${escapeHtml(node.id)}" data-role="${escapeHtml(node.role)}" style="${svgStyle(style)}"`;
  if (node.type === "rect") {
    const radius = Math.min(styleValue(style.radius || 0), frame.width / 2, frame.height / 2);
    return `<rect ${common} x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="${radius}"/>`;
  }
  if (node.type === "ellipse") return `<ellipse ${common} cx="${frame.x + frame.width / 2}" cy="${frame.y + frame.height / 2}" rx="${frame.width / 2}" ry="${frame.height / 2}"/>`;
  if (node.type === "line") {
    const marker = data.endArrow ? ' marker-end="url(#arrowhead)"' : "";
    return `<line ${common} x1="${data.x1}" y1="${data.y1}" x2="${data.x2}" y2="${data.y2}"${marker}/>`;
  }
  if (node.type === "wedge") return `<path ${common} d="${wedgePath(frame, data.startAngle, data.endAngle)}"/>`;
  if (node.type === "shape") return `<polygon ${common} points="${polygonPoints(frame, data.geometry)}"/>`;
  return "";
}

function textNode(node) {
  const { frame, style } = node;
  const align = style.align || "left";
  const justify = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
  const textAlign = align;
  const valign = style.valign || "mid";
  const alignItems = valign === "top" ? "flex-start" : valign === "bottom" ? "flex-end" : "center";
  const fontSize = `${styleValue(style.fontSize)}pt`;
  const fontFamily = escapeHtml(styleValue(style.fontFamily));
  const color = cssBinding(style.color);
  const layoutStyle = `${style.lineHeight ? `line-height:${style.lineHeight}px;` : ""}${style.wrap === false ? "white-space:pre;" : ""}`;
  const nativeBold = style.fontWeight ? style.fontFamily.nativeBold : style.bold;
  return `<div class="text-node" data-node-id="${escapeHtml(node.id)}" data-role="${escapeHtml(node.role)}" style="left:${frame.x}px;top:${frame.y}px;width:${frame.width}px;height:${frame.height}px;justify-content:${justify};align-items:${alignItems};text-align:${textAlign};font-family:${fontFamily};font-size:${fontSize};font-weight:${nativeBold ? 700 : 400};color:${color};${layoutStyle}"><span>${escapeHtml(node.text)}</span></div>`;
}

export function renderSlideHtml(slide, { title = slide.id } = {}) {
  const variables = Object.values(slide.tokens || TOKENS).map((definition) => `${definition.cssVar}:${definition.value}`).join(";");
  const shapes = slide.nodes.filter((node) => node.type !== "text").map(svgNode).join("\n");
  const text = slide.nodes.filter((node) => node.type === "text").map(textNode).join("\n");
  const tokenMetadata = escapeHtml(JSON.stringify(slide.nodes.map((node) => ({ id: node.id, tokens: node.tokens }))));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${SLIDE.width},initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{${variables}}
*{box-sizing:border-box}
html,body{margin:0;width:${SLIDE.width}px;height:${SLIDE.height}px;overflow:hidden;background:var(--canvas)}
.slide{position:relative;width:${SLIDE.width}px;height:${SLIDE.height}px;overflow:hidden;background:var(--canvas)}
.scene{position:absolute;inset:0;width:100%;height:100%}
.text-node{position:absolute;display:flex;white-space:pre-wrap;overflow:hidden;line-height:1.12;padding:0;margin:0}
</style>
</head>
<body>
<main class="slide" data-scene-schema="professional-slides.scene/v1">
<svg class="scene" viewBox="0 0 ${SLIDE.width} ${SLIDE.height}" aria-hidden="true">
<defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="var(--component-primary)"/></marker></defs>
${shapes}
</svg>
${text}
<script type="application/json" id="design-provenance">${tokenMetadata}</script>
</main>
</body>
</html>`;
}
