// scene -> HTML: the same composed scene the PowerPoint emitter reads, written
// as one self-contained page.
//
// The scene is the single source both emitters draw from. Its layout tree
// (`slide.layout`, core.mjs layoutBox) is written here as real CSS grid - a row
// is a grid of columns, a column a grid of rows, a stack one shared cell - with
// the tracks as the layout engine resolved them, so the browser sets every box
// exactly where PowerPoint has it, and someone editing the markup finds
// containers, gaps and tokens rather than a page of absolute coordinates. Each
// component is one element holding the primitives it drew, placed against the
// component's own corner; colours and sizes are CSS custom properties named by
// the design tokens.
//
// Paint order is the scene's node order. No container makes a stacking context
// (none carries z-index, opacity or a transform), so each primitive's z-index
// orders it against every other primitive on the page, wherever it nests.
import { SLIDE, styleValue } from "../core.mjs";
import { escapeHtml, wedgePath, quoteCalloutPath, customPolygonPath, iconPathD, polygonPoints } from "./html-shapes.mjs";

const HTML_SCHEMA = "professional-slides.html/v1";

const num = (value) => Number(Number(value).toFixed(3));
const attrs = (object) => Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== false)
  .map(([key, value]) => ` ${key}="${escapeHtml(value === true ? "" : value)}"`).join("");
const css = (object) => Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== "")
  .map(([key, value]) => `${key}:${value}`).join(";");

/**
 * A style value as CSS: the token's custom property where the page defines it
 * with this value, else the value itself. A page's chrome keeps the deck's type
 * sizes while its body takes the page's density, so one property name can carry
 * two values on a page; the literal keeps the drawing exact.
 */
function binder(tokens) {
  const defined = new Map(Object.values(tokens || {}).map((definition) => [definition.cssVar, definition.value]));
  return (value, unit = "") => {
    if (value && typeof value === "object" && "value" in value) {
      return value.cssVar && defined.get(value.cssVar) === value.value ? `var(${value.cssVar})` : `${value.value}${unit}`;
    }
    return `${styleValue(value)}${unit}`;
  };
}

/** A token's value as its custom property carries it: a size with its unit, a family with its fallback. */
const cssValue = (definition) => definition.kind === "fontFamily" ? fontStack(definition.value)
  : definition.kind === "fontSizePt" ? `${definition.value}pt` : definition.kind === "lengthPx" ? `${definition.value}px` : definition.value;

const FALLBACK_FONTS = { serif: /georgia|times|garamond|serif|playfair|tiempos|canela/i };
const fontStack = (family) => `${/[^a-z0-9-]/i.test(family) ? `'${String(family).replaceAll("'", "")}'` : family},${FALLBACK_FONTS.serif.test(family) ? "serif" : "sans-serif"}`;

function paint(style, bind) {
  const none = (value) => value === undefined || value === null || value === "none";
  return { fill: none(style.fill) ? "none" : bind(style.fill), stroke: none(style.stroke) ? "none" : bind(style.stroke),
    width: none(style.stroke) ? 0 : Number(styleValue(style.lineWidth ?? 0)) || 0,
    dashed: Boolean(style.dash || style.lineDash) && !["solid", "none", "false"].includes(String(style.dash || style.lineDash).toLowerCase()) };
}

/**
 * A shape as SVG in the scene's own coordinates, inside an element set at the node's frame. The geometry element
 * carries the node's id, so a point in scene coordinates can be tested against its fill and stroke (the overlap audit).
 */
function svgElement(node, at, z, bind) {
  const { frame } = node;
  const p = paint(node.style, bind);
  const stroke = `fill:${p.fill};stroke:${p.stroke};stroke-width:${p.width}${p.dashed ? ";stroke-dasharray:8 6" : ""}${node.style.lineCap === "round" ? ";stroke-linecap:round;stroke-linejoin:round" : ""}`;
  const style = css({ left: `${num(at.x)}px`, top: `${num(at.y)}px`, width: `${num(Math.max(frame.width, 1))}px`, height: `${num(Math.max(frame.height, 1))}px`, "z-index": z, opacity: node.style.opacity !== undefined && Number(node.style.opacity) < 1 ? node.style.opacity : undefined });
  const geometry = shapeMarkup(node).replace(/^<(\w+)/, `<$1${attrs({ "data-node-id": node.id, "data-role": node.role, style: stroke })}`);
  return `<svg class="ps-node ps-shape" style="${style}" aria-hidden="true"><g transform="translate(${num(-frame.x)} ${num(-frame.y)})">${geometry}</g></svg>`;
}

function shapeMarkup(node) {
  const { frame, style, data } = node;
  if (node.type === "line") {
    const marker = (data.endArrow ? ' marker-end="url(#ps-arrow)"' : "") + (data.startArrow ? ' marker-start="url(#ps-arrow-start)"' : "");
    return `<line x1="${data.x1}" y1="${data.y1}" x2="${data.x2}" y2="${data.y2}"${marker}/>`;
  }
  if (node.type === "wedge") return `<path d="${wedgePath(frame, data.startAngle, data.endAngle)}"/>`;
  if (node.type === "rect") {
    const radius = Math.min(Number(styleValue(style.radius || 0)) || 0, frame.width / 2, frame.height / 2);
    return `<rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="${radius}"/>`;
  }
  if (node.type === "ellipse") return `<ellipse cx="${frame.x + frame.width / 2}" cy="${frame.y + frame.height / 2}" rx="${frame.width / 2}" ry="${frame.height / 2}"/>`;
  const rotate = Number(style.rotate || 0), cx = frame.x + frame.width / 2, cy = frame.y + frame.height / 2;
  // PowerPoint flips a shape in its own box and then turns it, so the turn is written first here (an SVG transform
  // list applies its last entry to the shape first): a flipped, turned shape is the same one in both outputs.
  const transforms = [...(rotate ? [`rotate(${rotate} ${cx} ${cy})`] : []), ...(style.flipH ? [`translate(${2 * cx} 0) scale(-1 1)`] : []), ...(style.flipV ? [`translate(0 ${2 * cy}) scale(1 -1)`] : [])];
  const transform = transforms.length ? ` transform="${transforms.join(" ")}"` : "";
  if (data.geometry === "quoteCallout") return `<path${transform} d="${quoteCalloutPath(frame, data)}"/>`;
  if (data.geometry === "customPolygon") return `<path${transform} d="${customPolygonPath(frame, data)}"/>`;
  if (data.geometry === "iconPath") return `<path${transform} d="${iconPathD(frame, data)}"/>`;
  if (!data.geometry || data.geometry === "rect") return `<rect${transform} x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}"/>`;
  return `<polygon${transform} points="${polygonPoints(frame, data.geometry)}"/>`;
}

function imageElement(node, at, z, bind) {
  const { frame, data, style } = node;
  const uri = data.dataUri || node.dataUri || data.src;
  if (!uri) return "";
  const crop = data.crop || {};
  const left = Number(crop.left || 0), right = Number(crop.right || 0), top = Number(crop.top || 0), bottom = Number(crop.bottom || 0);
  const cropped = left || right || top || bottom;
  // PowerPoint's crop names the share of the picture cut from each edge: the picture is set larger than its frame and moved so the kept part fills it.
  const picture = cropped
    ? css({ position: "absolute", width: `${num(100 / (1 - left - right))}%`, height: `${num(100 / (1 - top - bottom))}%`, left: `${num(-left / (1 - left - right) * 100)}%`, top: `${num(-top / (1 - top - bottom) * 100)}%` })
    : css({ width: "100%", height: "100%", "object-fit": data.fit === "cover" ? "cover" : "fill" });
  const p = paint(style || {}, bind);
  return `<div class="ps-node ps-image"${attrs({ "data-node-id": node.id, "data-role": node.role, style: css({ left: `${num(at.x)}px`, top: `${num(at.y)}px`, width: `${num(frame.width)}px`, height: `${num(frame.height)}px`, "z-index": z, overflow: "hidden",
    "border-radius": data.circular ? "50%" : undefined, "box-shadow": p.stroke !== "none" && p.width > 0 ? `0 0 0 ${num(p.width)}px ${p.stroke}` : undefined }) })}><img src="${escapeHtml(uri)}" alt="${escapeHtml(data.alt || "")}" style="${picture}"></div>`;
}

const HEADING_ROLES = /^(action-title|cover-title|deck-title|section-title)$/;

function textElement(node, at, z, bind) {
  const { frame, style } = node;
  const align = style.align || "left", valign = style.valign || "mid";
  const bold = style.fontWeight ? Boolean(style.fontFamily?.nativeBold) : Boolean(style.bold);
  const content = node.runs
    ? node.runs.map((run) => `<span${attrs({ style: css({ "font-weight": run.bold ? 700 : undefined, color: run.accent ? "var(--accent)" : undefined }) || undefined })}>${escapeHtml(run.text)}</span>`).join("")
    : escapeHtml(node.text);
  const rotate = Number(style.rotate || 0);
  return `<div class="ps-node ps-text"${attrs({ "data-node-id": node.id, "data-role": node.role, role: HEADING_ROLES.test(node.role) ? "heading" : undefined, "aria-level": HEADING_ROLES.test(node.role) ? 1 : undefined,
    style: css({ left: `${num(at.x)}px`, top: `${num(at.y)}px`, width: `${num(frame.width)}px`, height: `${num(frame.height)}px`, "z-index": z,
      "justify-content": align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start", "align-items": valign === "top" ? "flex-start" : valign === "bottom" ? "flex-end" : "center", "text-align": align,
      "font-family": style.fontFamily?.cssVar ? `var(${style.fontFamily.cssVar})` : fontStack(styleValue(style.fontFamily)), "font-size": bind(style.fontSize, "pt"), "font-weight": bold ? 700 : 400, color: bind(style.color),
      "line-height": style.lineHeight ? `${style.lineHeight}px` : undefined, "white-space": style.wrap === false ? "pre" : undefined, transform: rotate ? `rotate(${rotate}deg)` : undefined }) })}><span>${content}</span></div>`;
}

function nodeElement(node, origin, z, bind) {
  const at = { x: node.frame.x - origin.x, y: node.frame.y - origin.y };
  if (node.type === "text") return textElement(node, at, z, bind);
  if (node.type === "image") return imageElement(node, at, z, bind);
  return svgElement(node, at, z, bind);
}

const tracks = (values) => values.map((value) => `${num(value)}px`).join(" ");
const padding = (insets) => (insets && (insets.top || insets.right || insets.bottom || insets.left) ? `${num(insets.top)}px ${num(insets.right)}px ${num(insets.bottom)}px ${num(insets.left)}px` : undefined);

/** How a box sits in its parent: a grid cell, or laid over the parent at its own offset. */
function placementCss(box, parent) {
  const size = { width: `${num(box.frame.width)}px`, height: `${num(box.frame.height)}px` };
  if (!parent || parent.kind === "page" || parent.kind === "absolute" || box.placed || !box.area || ["component", "section"].includes(parent.kind)) {
    const origin = parent ? parent.frame : { x: 0, y: 0 };
    return { position: "absolute", left: `${num(box.frame.x - origin.x)}px`, top: `${num(box.frame.y - origin.y)}px`, ...size };
  }
  if (parent.kind === "stack") {
    const inner = { x: parent.frame.x + (parent.padding?.left || 0), y: parent.frame.y + (parent.padding?.top || 0) };
    return { "grid-area": "1 / 1", position: "relative", "margin-left": `${num(box.frame.x - inner.x)}px`, "margin-top": `${num(box.frame.y - inner.y)}px`, ...size };
  }
  const { column = 0, row = 0, columnSpan = 1, rowSpan = 1, self } = box.area;
  // A child set in the middle of its cell (`self`) is as tall as its content there, as CSS `align-self` has it.
  return { "grid-column": `${column + 1} / span ${columnSpan}`, "grid-row": `${row + 1} / span ${rowSpan}`, position: "relative", ...(self ? { "align-self": self } : {}), ...size };
}

function containerCss(box) {
  if (box.kind === "row") return { display: "grid", "grid-template-columns": tracks(box.tracks), "column-gap": `${num(box.gap)}px`, "justify-content": box.content, "align-items": "start", padding: padding(box.padding) };
  if (box.kind === "column") return { display: "grid", "grid-template-rows": tracks(box.tracks), "row-gap": `${num(box.gap)}px`, "align-content": box.content, "justify-items": "start", padding: padding(box.padding) };
  if (box.kind === "grid") return { display: "grid", "grid-template-columns": tracks(box.columns), "grid-template-rows": tracks(box.rows), "column-gap": `${num(box.columnGap)}px`, "row-gap": `${num(box.rowGap)}px`, padding: padding(box.padding) };
  if (box.kind === "stack") return { display: "grid", "grid-template": "100% / 100%", padding: padding(box.padding) };
  return {};
}

/** The tracks as the page's author or template wrote them (`1.5fr auto`), kept beside the resolved ones. */
function templateOf(box) {
  if (!box.template) return undefined;
  return Array.isArray(box.template) ? box.template.join(" ") : `${box.template.rows.join(" ")} / ${box.template.columns.join(" ")}`;
}

function boxElementTree(box, parent, context) {
  const own = box.instance ? (context.byInstance.get(box.instance) || []).map(({ node, z }) => nodeElement(node, box.frame, z, context.bind)).join("") : "";
  const children = (box.children || []).map((child) => boxElementTree(child, box, context)).join("");
  const style = css({ ...placementCss(box, parent), ...containerCss(box) });
  return `<div class="ps-${box.kind}"${attrs({ "data-layout": ["component", "section"].includes(box.kind) ? undefined : box.kind, "data-id": box.id, "data-component": box.component, "data-variant": box.variant, "data-template": templateOf(box), "data-spread": box.spread, style })}>${own}${children}</div>`;
}

/** One slide as a `<section>`: its tokens as custom properties, its layout tree as CSS grid, its primitives inside their components. */
export function slideHtml(slide, { index = 0 } = {}) {
  const bind = binder(slide.tokens);
  const byInstance = new Map();
  slide.nodes.forEach((node, at) => {
    const owner = node.data?.componentInstance;
    if (!byInstance.has(owner)) byInstance.set(owner, []);
    byInstance.get(owner).push({ node, z: at + 1 });
  });
  const context = { bind, byInstance };
  const page = slide.layout ?? { kind: "page", id: slide.id, frame: { x: 0, y: 0, ...SLIDE }, children: [] };
  const placed = new Set();
  const collect = (box) => { if (box.instance) placed.add(box.instance); (box.children || []).forEach(collect); };
  collect(page);
  // A primitive whose component the tree does not hold is drawn against the page, so nothing composed is ever left out.
  const loose = [...byInstance].filter(([owner]) => !placed.has(owner)).flatMap(([, list]) => list).map(({ node, z }) => nodeElement(node, page.frame, z, bind)).join("");
  const body = (page.children || []).map((child) => boxElementTree(child, page, context)).join("");
  const variables = Object.values(slide.tokens || {}).filter((definition) => definition?.cssVar).map((definition) => `${definition.cssVar}:${cssValue(definition)}`).join(";");
  const notes = slide.notes ? `<aside class="ps-notes" hidden>${escapeHtml(slide.notes)}</aside>` : "";
  return `<section class="ps-slide"${attrs({ id: `slide-${index + 1}`, "data-slide-id": slide.id, "data-source-slide-id": slide.sourceSlideId, "data-ground": slide.ground, "aria-label": `Slide ${index + 1}`, style: variables })}><div class="ps-page">${body}${loose}</div>${notes}</section>`;
}

const SHELL_CSS = `*{box-sizing:border-box}
html,body{margin:0;background:#1b1c1e}
.ps-deck{display:flex;flex-direction:column;align-items:center;gap:24px;padding:24px 0}
.ps-slide{position:relative;width:calc(${SLIDE.width}px*var(--ps-scale,1));height:calc(${SLIDE.height}px*var(--ps-scale,1));overflow:hidden;background:var(--canvas,#fff);flex:none}
.ps-page{position:absolute;left:0;top:0;width:${SLIDE.width}px;height:${SLIDE.height}px;transform:scale(var(--ps-scale,1));transform-origin:0 0;background:var(--canvas,#fff)}
.ps-node{position:absolute;margin:0;padding:0}
.ps-text{display:flex;white-space:pre-wrap;line-height:1.12}
.ps-shape{overflow:visible}
.ps-image img{display:block}
@media print{@page{size:${SLIDE.width}px ${SLIDE.height}px;margin:0}html,body{background:none}.ps-deck{display:block;padding:0}.ps-slide{--ps-scale:1!important;break-after:page}}`;

const FIT_SCRIPT = `<script>(()=>{const fit=()=>document.documentElement.style.setProperty("--ps-scale",Math.min(1,(window.innerWidth-48)/${SLIDE.width}));fit();addEventListener("resize",fit)})();</script>`;
const ACTUAL_CSS = "html,body{background:none}.ps-deck{gap:0;padding:0;align-items:flex-start}";

const ARROW_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><marker id="ps-arrow" markerWidth="3" markerHeight="3" refX="3" refY="1.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L3,1.5 L0,3 Z" fill="context-stroke"/></marker><marker id="ps-arrow-start" markerWidth="3" markerHeight="3" refX="3" refY="1.5" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0,0 L3,1.5 L0,3 Z" fill="context-stroke"/></marker></defs></svg>`;

/**
 * The deck as one HTML document: every slide a 1280 by 720 page scaled to the
 * window, printing one slide to a page. `actual` sets the slides at their own
 * size from the page's corner with nothing between them, which is how the
 * build photographs them and the suite measures them.
 */
export function deckHtml(deck, { title = deck.id, actual = false } = {}) {
  const slides = deck.slides.map((slide, index) => slideHtml(slide, { index })).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="professional-slides">
<title>${escapeHtml(title)}</title>
<style>
${SHELL_CSS}${actual ? `\n${ACTUAL_CSS}` : ""}
</style>
</head>
<body>
${ARROW_DEFS}
<main class="ps-deck" data-schema="${HTML_SCHEMA}" data-scene-schema="${escapeHtml(deck.schema || "")}" data-deck-id="${escapeHtml(deck.id || "")}">
${slides}
</main>
${actual ? "" : FIT_SCRIPT}
</body>
</html>
`;
}
