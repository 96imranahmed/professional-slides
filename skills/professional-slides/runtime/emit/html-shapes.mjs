// Shape geometry for the HTML emitter: every scene geometry name as SVG path or
// polygon data, in the scene's own coordinates. The named polygons come from
// shape-outlines.json, the table the PowerPoint emitter draws from too; what
// each emitter finally writes is compared by evals/tests/test_shape_outlines.py.

import { readJsonSync } from "../cli.mjs";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function polar(cx, cy, radius, angle) {
  const radians = angle * Math.PI / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

export function wedgePath(frame, startAngle, endAngle) {
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  const radius = Math.min(frame.width, frame.height) / 2;
  const start = polar(cx, cy, radius, endAngle);
  const end = polar(cx, cy, radius, startAngle);
  const large = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

export function quoteCalloutPath(frame, data) {
  const bodyHeight = frame.height * data.bodyRatio;
  const caretCenter = frame.x + frame.width * data.caretCenterRatio;
  const caretHalf = frame.width * data.caretWidthRatio / 2;
  // A callout that names no corner radius has square corners; without the default the radius is NaN, the path is
  // not one a browser can draw, and the bubble is missing from the HTML page while the PowerPoint file has it.
  const radius = Math.max(0, Math.min(frame.width, frame.height) * (Number(data.cornerRadiusRatio) || 0));
  const left = frame.x, right = frame.x + frame.width, top = frame.y, bottom = frame.y + bodyHeight, tip = frame.y + frame.height;
  return [
    `M ${left + radius} ${top}`,
    `L ${right - radius} ${top}`,
    `Q ${right} ${top} ${right} ${top + radius}`,
    `L ${right} ${bottom - radius}`,
    `Q ${right} ${bottom} ${right - radius} ${bottom}`,
    `L ${caretCenter + caretHalf} ${bottom}`,
    `L ${caretCenter} ${tip}`,
    `L ${caretCenter - caretHalf} ${bottom}`,
    `L ${left + radius} ${bottom}`,
    `Q ${left} ${bottom} ${left} ${bottom - radius}`,
    `L ${left} ${top + radius}`,
    `Q ${left} ${top} ${left + radius} ${top}`,
    "Z"
  ].join(" ");
}

export function customPolygonPath(frame, data) {
  if (!Array.isArray(data.paths) || !data.paths.length) throw new Error("Custom polygon requires one or more paths");
  return data.paths.map((path) => {
    if (!Array.isArray(path) || path.length < 3) throw new Error("Custom polygon paths require at least three points");
    return path.map(([x, y], index) => `${index ? "L" : "M"} ${frame.x + Number(x) * frame.width} ${frame.y + Number(y) * frame.height}`).join(" ") + " Z";
  }).join(" ");
}

export function iconPathD(frame, data) {
  return (data.paths || []).map((path) => path.points.map(([x, y], index) => `${index ? "L" : "M"} ${frame.x + Number(x) * frame.width} ${frame.y + Number(y) * frame.height}`).join(" ") + (path.closed ? " Z" : "")).join(" ");
}

// The outline of every named geometry lives in shape-outlines.json, which the PowerPoint emitter draws from as well:
// one table, so a name cannot be one polygon here and another shape there (the file says how a coordinate is written).
const OUTLINES = Object.freeze(readJsonSync(new URL("./shape-outlines.json", import.meta.url)).outlines);

/**
 * A named geometry's outline in the unit square of `frame`. A coordinate written as a pair [a, b] is a + b times the
 * frame's shorter side over that axis's length - a chevron's point is inset by half the shorter side, so it keeps its
 * angle on a wide band instead of stretching with it.
 */
function outlinePoints(frame, geometry) {
  const outline = OUTLINES[geometry];
  if (!outline) throw new Error(`Unsupported HTML scene geometry: ${geometry}`);
  const short = Math.min(frame.width, frame.height);
  const along = (value, length) => Array.isArray(value) ? value[0] + (length ? value[1] * short / length : 0) : value;
  return outline.map(([x, y]) => [along(x, frame.width), along(y, frame.height)]);
}

export function polygonPoints(frame, geometry) {
  return outlinePoints(frame, geometry).map(([x, y]) => `${frame.x + x * frame.width},${frame.y + y * frame.height}`).join(" ");
}
