import {
  chartAnnotationStyle,
  ellipsePrimitive,
  linePrimitive,
  rectPrimitive,
  stableId,
  textPrimitive,
  token,
  tokenValue
} from "./core.mjs";
import { measureText } from "./text-layout.mjs";

export const CHANGE_ANNOTATION_STYLES = Object.freeze(["arrow", "bracket", "construction"]);
export const EVIDENCE_ANNOTATION_TREATMENTS = Object.freeze(["callout", "orthogonal-dot"]);
// Keep a full label-height gap between the observation box and the plot. The
// chart reserves this band before calculating marks, so value labels remain
// readable instead of tucking under the annotation surface.
export const EVIDENCE_CALLOUT_BAND = 88;
export const CHANGE_ANNOTATION_BAND = 84;
export const ANNOTATION_RAIL_BAND = 52;

const PRIMARY = token("color.componentPrimary");
const PRIMARY_TINT = token("color.componentPrimaryTint");
const ON_PRIMARY = token("color.onPrimary");
const RULE = token("color.rule");
const INK = token("color.ink");
const SURFACE = token("color.surface");
const ANNOTATION = token("type.chartAnnotation");
const HAIRLINE = token("line.hairline");
const STANDARD = token("line.standard");
const NONE_RADIUS = token("radius.none");

const EVIDENCE_BOX_WIDTH = 260;
const EVIDENCE_BOX_HEIGHT = 56;
const ORTHOGONAL_GAP = 28;
const ENDPOINT_DIAMETER = 8;
const COLLISION_ROLES = new Set(["chart-mark", "chart-marker", "chart-point-highlight", "data-label", "chart-reference-label"]);

function textStyle(size, color, bold = false, align = "center") {
  return {
    ...(bold ? chartAnnotationStyle() : { fontFamily: token("font.body") }),
    fontSize: size,
    color,
    bold,
    align,
    valign: "mid"
  };
}

function normalizeAnchor(anchor, field) {
  const value = typeof anchor === "string" ? { category: anchor } : anchor;
  if (!value || typeof value.category !== "string" || !value.category.trim()) {
    throw new Error(`Chart change annotation ${field} must name a category`);
  }
  if (value.series !== undefined && (typeof value.series !== "string" || !value.series.trim())) {
    throw new Error(`Chart change annotation ${field} series must be a non-empty string`);
  }
  return { category: value.category, ...(value.series ? { series: value.series } : {}) };
}

export function normalizeEvidenceAnnotations(props = {}) {
  const annotations = props.annotations || [];
  if (!Array.isArray(annotations)) throw new Error("Chart annotations must be an array");
  if (annotations.length > 6) throw new Error("Use no more than six evidence annotations on one chart");
  return annotations.map((annotation, index) => {
    if (!annotation || typeof annotation.category !== "string" || !annotation.category.trim()) {
      throw new Error(`Chart evidence annotation ${index + 1} must name a category`);
    }
    if (annotation.series !== undefined && (typeof annotation.series !== "string" || !annotation.series.trim())) {
      throw new Error(`Chart evidence annotation ${index + 1} series must be a non-empty string`);
    }
    if (typeof annotation.text !== "string" || !annotation.text.trim()) {
      throw new Error(`Chart evidence annotation ${index + 1} needs concise text`);
    }
    // Retired takeaway-box inputs resolve to the retained callout construction.
    const treatment = !annotation.treatment || annotation.treatment === "takeaway-box" ? "callout" : annotation.treatment;
    if (annotation.border !== undefined && typeof annotation.border !== "boolean") throw new Error("Chart annotation border must be a boolean");
    if (!EVIDENCE_ANNOTATION_TREATMENTS.includes(treatment)) throw new Error(`Unknown chart evidence annotation treatment: ${treatment}`);
    if (treatment !== "orthogonal-dot" && (annotation.orientation !== undefined || annotation.side !== undefined)) {
      throw new Error("Only an orthogonal-dot chart annotation accepts orientation or side");
    }
    const orientation = treatment === "orthogonal-dot" ? annotation.orientation || "vertical" : null;
    if (orientation && !["horizontal", "vertical"].includes(orientation)) throw new Error(`Unknown orthogonal chart annotation orientation: ${orientation}`);
    const side = annotation.side || "auto";
    if (orientation !== "horizontal" && annotation.side !== undefined) throw new Error("Chart annotation side applies only to a horizontal orthogonal-dot treatment");
    if (orientation === "horizontal" && !["auto", "left", "right"].includes(side)) throw new Error(`Unknown horizontal chart annotation side: ${side}`);
    return { ...annotation, treatment, orientation, side };
  });
}

export function evidenceAnnotationTopBandCount(props = {}) {
  return normalizeEvidenceAnnotations(props).filter((annotation) => annotation.treatment !== "orthogonal-dot" || annotation.orientation !== "horizontal").length;
}

function resolveEvidenceAnchor(pointMap, annotation, id) {
  const target = pointMap.get(`${annotation.series || "value"}:${annotation.category}`);
  if (!target) {
    const series = annotation.series ? ` in series ${annotation.series}` : "";
    throw new Error(`${id} evidence annotation references unknown category ${annotation.category}${series}`);
  }
  return target;
}

function frameInside(inner, outer) {
  return inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function pointInsideFrame(point, frame, padding = 0) {
  return point.x >= frame.x - padding
    && point.x <= frame.x + frame.width + padding
    && point.y >= frame.y - padding
    && point.y <= frame.y + frame.height + padding;
}

function annotationObstacleFrames(obstacles) {
  return obstacles.filter((node) => COLLISION_ROLES.has(node.role) && node.frame?.width !== undefined && node.frame?.height !== undefined).map(node => {
    if (node.type !== "text") return node;
    // Text allocations often span a whole bar/category. Collision routing uses
    // the measured ink box rather than treating its empty margins as ink.
    const measured = measureText(node.text, node.frame.width, { fontFamily: tokenValue(node.style.fontFamily), fontSize: tokenValue(node.style.fontSize), bold: node.style.bold, wrapWidthRatio: 1 });
    const x = node.frame.x + (node.style.align === "center" ? (node.frame.width - measured.width) / 2 : node.style.align === "right" ? node.frame.width - measured.width : 0);
    const y = node.frame.y + (node.style.valign === "mid" ? (node.frame.height - measured.height) / 2 : node.style.valign === "bottom" ? node.frame.height - measured.height : 0);
    return { ...node, frame: { x, y, width: measured.width, height: measured.height } };
  });
}

function clearSurface(frame, obstacles, placements) {
  return obstacles.every((node) => !overlaps(frame, node.frame, 6))
    && placements.every((placement) => !overlaps(frame, placement.frame, 10));
}

function clearLeader(x1, y1, x2, y2, target, obstacles) {
  const corridor = {
    x: Math.min(x1, x2) - 3,
    y: Math.min(y1, y2) - 3,
    width: Math.abs(x2 - x1) + 6,
    height: Math.abs(y2 - y1) + 6
  };
  return obstacles.every((node) => pointInsideFrame(target, node.frame, 1) || !overlaps(corridor, node.frame, 1));
}

function assertEvidenceTextFits(annotation) {
  const measured = measureText(annotation.text, EVIDENCE_BOX_WIDTH - 16, {
    fontFamily: tokenValue(token("font.bodySemibold")),
    fontSize: tokenValue(ANNOTATION),
    bold: true,
    wrapWidthRatio: 1
  });
  if (measured.height > EVIDENCE_BOX_HEIGHT - 14) throw new Error(`Chart evidence annotation for ${annotation.category} is too long for its body-sized box`);
}

function horizontalPlacement({ annotation, index, target, plot, obstacles, placements, id }) {
  const y = Math.max(plot.y, Math.min(plot.y + plot.height - EVIDENCE_BOX_HEIGHT, target.y - EVIDENCE_BOX_HEIGHT / 2));
  const candidates = {
    right: {
      side: "right",
      frame: { x: target.x + ORTHOGONAL_GAP, y, width: EVIDENCE_BOX_WIDTH, height: EVIDENCE_BOX_HEIGHT },
      leader: { x1: target.x + ORTHOGONAL_GAP, y1: target.y, x2: target.x, y2: target.y }
    },
    left: {
      side: "left",
      frame: { x: target.x - ORTHOGONAL_GAP - EVIDENCE_BOX_WIDTH, y, width: EVIDENCE_BOX_WIDTH, height: EVIDENCE_BOX_HEIGHT },
      leader: { x1: target.x - ORTHOGONAL_GAP, y1: target.y, x2: target.x, y2: target.y }
    }
  };
  const order = annotation.side === "auto" ? ["right", "left"] : [annotation.side];
  const selected = order.map((side) => candidates[side]).find((candidate) => frameInside(candidate.frame, plot)
    && clearSurface(candidate.frame, obstacles, placements)
    && clearLeader(candidate.leader.x1, candidate.leader.y1, candidate.leader.x2, candidate.leader.y2, target, [...obstacles, ...placements.map((placement) => ({ frame: placement.frame }))]));
  if (!selected) throw new Error(`${id} has insufficient clearance for a horizontal orthogonal-dot annotation at ${annotation.category}; use a vertical or standard takeaway annotation`);
  return { annotation, index, target, frame: selected.frame, leader: selected.leader, side: selected.side };
}

function verticalPlacement({ annotation, index, target, plot, bandIndex, topBandCount, obstacles, placements, id }) {
  const frame = {
    x: target.x - EVIDENCE_BOX_WIDTH / 2,
    y: plot.y - (topBandCount - bandIndex) * EVIDENCE_CALLOUT_BAND,
    width: EVIDENCE_BOX_WIDTH,
    height: EVIDENCE_BOX_HEIGHT
  };
  const leader = { x1: target.x, y1: frame.y + frame.height, x2: target.x, y2: target.y };
  if (frame.x < plot.x || frame.x + frame.width > plot.x + plot.width || !clearLeader(leader.x1, leader.y1, leader.x2, leader.y2, target, [...obstacles, ...placements.map((placement) => ({ frame: placement.frame }))])) {
    throw new Error(`${id} has insufficient clearance for a vertical orthogonal-dot annotation at ${annotation.category}; use a horizontal or standard takeaway annotation`);
  }
  if (!clearSurface(frame, [], placements)) throw new Error(`${id} orthogonal-dot annotation boxes overlap; widen the exhibit or reduce the annotations`);
  return { annotation, index, target, frame, leader, side: "above" };
}

function standardPlacement({ annotation, index, target, plot, bandIndex, topBandCount, obstacles, placements, id }) {
  const targetX = target.leaderX ?? target.x;
  const targetY = target.leaderY ?? target.y;
  const frame = {
    x: Math.max(plot.x - 12, Math.min(plot.x + plot.width + 12 - EVIDENCE_BOX_WIDTH, targetX - EVIDENCE_BOX_WIDTH / 2)),
    y: plot.y - (topBandCount - bandIndex) * EVIDENCE_CALLOUT_BAND,
    width: EVIDENCE_BOX_WIDTH,
    height: EVIDENCE_BOX_HEIGHT
  };
  const leader = {
    x1: Math.max(frame.x, Math.min(frame.x + frame.width, targetX)),
    y1: frame.y + frame.height,
    x2: targetX,
    y2: targetY
  };
  if (!clearSurface(frame, obstacles, placements) || !clearLeader(leader.x1, leader.y1, leader.x2, leader.y2, { x: targetX, y: targetY }, [...obstacles, ...placements.map(placement => ({ frame: placement.frame }))])) {
    throw new Error(`${id} has insufficient clearance for a callout at ${annotation.category}; move the annotation or use an orthogonal-dot treatment`);
  }
  return {
    annotation,
    index,
    target,
    frame,
    leader,
    side: "above"
  };
}

function evidenceNodes(id, placement) {
  const { annotation, index, frame, leader } = placement;
  const callout = annotation.treatment === "callout";
  const dotEnded = annotation.treatment === "orthogonal-dot";
  const data = {
    annotationTreatment: annotation.treatment,
    border: annotation.border !== false,
    orientation: annotation.orientation,
    targetCategory: annotation.category,
    targetSeries: annotation.series ?? null
  };
  const nodes = [
    linePrimitive({
      id: stableId(id, "annotation-leader", index),
      role: "annotation-leader",
      ...leader,
      style: { stroke: callout ? PRIMARY : RULE, lineWidth: HAIRLINE, dash: "solid" },
      data: { ...data, endArrow: callout, ...(callout ? { endArrowType: "triangle" } : {}), endpoint: dotEnded ? "dot" : "arrow" }
    }),
    rectPrimitive({
      id: stableId(id, "annotation-box", index),
      role: "annotation-surface",
      frame,
      style: { fill: callout ? SURFACE : PRIMARY_TINT, stroke: annotation.border === false ? "none" : callout ? PRIMARY : RULE, lineWidth: HAIRLINE, radius: NONE_RADIUS, opacity: 1 },
      data
    }),
    textPrimitive({
      id: stableId(id, "annotation-text", index),
      role: "annotation-text",
      frame: { x: frame.x + 8, y: frame.y + 6, width: frame.width - 16, height: frame.height - 12 },
      text: annotation.text,
      style: textStyle(ANNOTATION, INK, true),
      data
    })
  ];
  if (dotEnded) nodes.push(ellipsePrimitive({
    id: stableId(id, "annotation-endpoint", index),
    role: "annotation-endpoint",
    frame: { x: leader.x2 - ENDPOINT_DIAMETER / 2, y: leader.y2 - ENDPOINT_DIAMETER / 2, width: ENDPOINT_DIAMETER, height: ENDPOINT_DIAMETER },
    style: { fill: PRIMARY, stroke: PRIMARY, lineWidth: HAIRLINE, opacity: 1 },
    data
  }));
  return nodes;
}

// Standalone and chart-attached callouts share typography, surfaces and arrows.
export function renderChartCallout({ id, frame, props }) {
  if (typeof props.text !== "string" || !props.text.trim()) throw new Error("Chart callout requires text");
  if (props.border !== undefined && typeof props.border !== "boolean") throw new Error("Chart annotation border must be a boolean");
  const direction = props.direction ?? "down";
  if (!["left", "right", "up", "down"].includes(direction)) throw new Error(`Unknown callout direction: ${direction}`);
  // Frame includes the protruding arrow, as every component allocation must.
  frame = { ...frame,
    x: frame.x + (direction === "left" ? 24 : 0),
    y: frame.y + (direction === "up" ? 24 : 0),
    width: frame.width - (["left", "right"].includes(direction) ? 24 : 0),
    height: frame.height - (["up", "down"].includes(direction) ? 24 : 0)
  };
  const cx = frame.x + frame.width / 2, cy = frame.y + frame.height / 2;
  const leaders = {
    down: { x1: cx, y1: frame.y + frame.height, x2: cx, y2: frame.y + frame.height + 24 },
    up: { x1: cx, y1: frame.y, x2: cx, y2: frame.y - 24 },
    left: { x1: frame.x, y1: cy, x2: frame.x - 24, y2: cy },
    right: { x1: frame.x + frame.width, y1: cy, x2: frame.x + frame.width + 24, y2: cy }
  };
  if (!Object.hasOwn(leaders, direction)) throw new Error(`Unknown callout direction: ${direction}`);
  const measured = measureText(props.text, frame.width - 16, { fontFamily: tokenValue(token("font.bodySemibold")), fontSize: tokenValue(ANNOTATION), bold: true, wrapWidthRatio: 1 });
  if (measured.height > frame.height - 14) throw new Error("Chart callout text does not fit its frame");
  return { nodes: evidenceNodes(id, { index: 0, frame, leader: leaders[direction], annotation: { ...props, treatment: "callout" } }) };
}

export function renderEvidenceAnnotations({ id, plot, props, pointMap, obstacles = [] }) {
  const annotations = normalizeEvidenceAnnotations(props);
  if (!annotations.length) return { placements: [], nodes: [] };
  annotations.forEach(assertEvidenceTextFits);
  const collisionObstacles = annotationObstacleFrames(obstacles);
  const topBandCount = evidenceAnnotationTopBandCount(props);
  let bandIndex = 0;
  const placements = [];
  annotations.forEach((annotation, index) => {
    const target = resolveEvidenceAnchor(pointMap, annotation, id);
    let placement;
    if (annotation.treatment === "orthogonal-dot" && annotation.orientation === "horizontal") {
      placement = horizontalPlacement({ annotation, index, target, plot, obstacles: collisionObstacles, placements, id });
    } else {
      placement = annotation.treatment === "orthogonal-dot"
        ? verticalPlacement({ annotation, index, target, plot, bandIndex, topBandCount, obstacles: collisionObstacles, placements, id })
        : standardPlacement({ annotation, index, target, plot, bandIndex, topBandCount, obstacles: collisionObstacles, placements, id });
      bandIndex += 1;
    }
    placements.push(placement);
  });
  return { placements, nodes: placements.flatMap((placement) => evidenceNodes(id, placement)) };
}

export function normalizeChangeAnnotations(props = {}) {
  const annotations = props.changeAnnotations || [];
  if (!Array.isArray(annotations)) throw new Error("Chart changeAnnotations must be an array");
  if (annotations.length > 8) throw new Error("Use no more than eight change annotations on one chart");
  return annotations.map((annotation, index) => {
    if (!annotation || typeof annotation.text !== "string" || !annotation.text.trim()) {
      throw new Error(`Chart change annotation ${index + 1} needs concise text`);
    }
    const style = annotation.style || "arrow";
    if (!CHANGE_ANNOTATION_STYLES.includes(style)) throw new Error(`Unknown chart change annotation style: ${style}`);
    return {
      ...annotation,
      style,
      start: normalizeAnchor(annotation.start, "start"),
      end: normalizeAnchor(annotation.end, "end")
    };
  });
}

export function normalizeAnnotationRail(props = {}) {
  if (!props.annotationRail) return { items: [] };
  const rail = Array.isArray(props.annotationRail) ? { items: props.annotationRail } : props.annotationRail;
  if (!rail || !Array.isArray(rail.items)) throw new Error("Chart annotationRail must contain an items array");
  if (rail.items.length > 12) throw new Error("Use no more than twelve entries in one chart annotation rail");
  const items = rail.items.map((item, index) => {
    if (!item || typeof item.category !== "string" || !item.category.trim()) throw new Error(`Chart annotation rail item ${index + 1} must name a category`);
    if (typeof item.text !== "string" || !item.text.trim()) throw new Error(`Chart annotation rail item ${index + 1} needs concise text`);
    return { ...item };
  });
  return { ...rail, items };
}

export function chartAnnotationBands(props = {}) {
  const changes = normalizeChangeAnnotations(props);
  const rail = normalizeAnnotationRail(props);
  return {
    top: changes.length ? CHANGE_ANNOTATION_BAND : 0,
    bottom: rail.items.length ? ANNOTATION_RAIL_BAND : 0
  };
}

function resolveAnchor(pointMap, anchor, id) {
  const target = anchor.series
    ? pointMap.get(`${anchor.series}:${anchor.category}`)
    : pointMap.get(`category:${anchor.category}`) || pointMap.get(`value:${anchor.category}`);
  if (!target) {
    const series = anchor.series ? ` in series ${anchor.series}` : "";
    throw new Error(`${id} change annotation references unknown category ${anchor.category}${series}`);
  }
  return {
    x: target.changeX ?? target.x,
    y: target.changeY ?? target.y,
    category: anchor.category,
    series: anchor.series
  };
}

function labelFrame(text, centerX, centerY, plot) {
  const measured = measureText(text, 168, {
    fontFamily: tokenValue(token("font.bodySemibold")),
    fontSize: tokenValue(ANNOTATION),
    bold: true,
    wrapWidthRatio: 1
  });
  const width = Math.max(66, Math.min(180, Math.ceil(measured.width) + 24));
  const height = 34;
  if (measureText(text, width - 20, {
    fontFamily: tokenValue(token("font.bodySemibold")),
    fontSize: tokenValue(ANNOTATION),
    bold: true,
    wrapWidthRatio: 1
  }).height > 24) throw new Error("Chart change annotation text is too long for its body-sized label; shorten it or use an evidence callout");
  return {
    x: Math.max(plot.x, Math.min(plot.x + plot.width - width, centerX - width / 2)),
    y: centerY - height / 2,
    width,
    height
  };
}

function overlaps(a, b, padding = 6) {
  return !(
    a.x + a.width + padding <= b.x
    || b.x + b.width + padding <= a.x
    || a.y + a.height + padding <= b.y
    || b.y + b.height + padding <= a.y
  );
}

function line(id, index, part, x1, y1, x2, y2, endArrow = false, style = "arrow") {
  const directional = style === "arrow" || style === "construction";
  return linePrimitive({
    id: stableId(id, "change", index, part),
    role: "annotation-leader",
    x1,
    y1,
    x2,
    y2,
    style: { stroke: RULE, lineWidth: directional ? STANDARD : HAIRLINE, dash: "solid" },
    data: {
      endArrow,
      ...(endArrow ? { endArrowType: "triangle" } : {}),
      annotationStyle: style,
      annotationKey: `${index}:${style}`,
      annotationPart: part
    }
  });
}

function labelNodes(id, index, frame, text, style) {
  return [
    ellipsePrimitive({
      id: stableId(id, "change-label-surface", index),
      role: "annotation-surface",
      frame,
      style: { fill: PRIMARY, stroke: PRIMARY, lineWidth: HAIRLINE, opacity: 1 },
      data: { annotationStyle: style }
    }),
    textPrimitive({
      id: stableId(id, "change-label", index),
      role: "annotation-text",
      frame: { x: frame.x + 10, y: frame.y + 4, width: frame.width - 20, height: frame.height - 8 },
      text,
      style: textStyle(ANNOTATION, ON_PRIMARY, true),
      data: { annotationStyle: style }
    })
  ];
}

export function renderChangeAnnotations({ id, plot, props, pointMap }) {
  const annotations = normalizeChangeAnnotations(props);
  if (!annotations.length) return [];
  const nodes = [];
  const labels = [];
  const evidenceBand = evidenceAnnotationTopBandCount(props) * EVIDENCE_CALLOUT_BAND;

  annotations.forEach((annotation, index) => {
    const start = resolveAnchor(pointMap, annotation.start, id);
    const end = resolveAnchor(pointMap, annotation.end, id);
    if (Math.hypot(end.x - start.x, end.y - start.y) < 20) throw new Error(`${id} change annotation endpoints are too close to show clearly`);

    if (annotation.style === "arrow") {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      const ux = dx / length;
      const uy = dy / length;
      const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      const frame = labelFrame(annotation.text, midpoint.x, midpoint.y, plot);
      const gap = Math.abs(ux) * frame.width / 2 + Math.abs(uy) * frame.height / 2 + 5;
      if (length <= gap * 2 + 16) throw new Error(`${id} change annotation interval is too short for its label`);
      nodes.push(line(id, index, "arrow-start", start.x, start.y, midpoint.x - ux * gap, midpoint.y - uy * gap, false, annotation.style));
      nodes.push(line(id, index, "arrow-end", midpoint.x + ux * gap, midpoint.y + uy * gap, end.x, end.y, true, annotation.style));
      labels.push({ frame, annotation, index });
      return;
    }

    const bracketY = plot.y - evidenceBand - 34;
    const leftX = Math.min(start.x, end.x);
    const rightX = Math.max(start.x, end.x);
    const frame = labelFrame(annotation.text, (leftX + rightX) / 2, bracketY - 24, plot);
    nodes.push(line(id, index, "span", leftX, bracketY, rightX, bracketY, false, annotation.style));
    nodes.push(line(id, index, "start-drop", start.x, bracketY, start.x, start.y, false, annotation.style));
    nodes.push(line(id, index, "end-drop", end.x, bracketY, end.x, end.y, annotation.style === "construction", annotation.style));
    labels.push({ frame, annotation, index });
  });

  for (let index = 0; index < labels.length; index += 1) {
    for (let peer = index + 1; peer < labels.length; peer += 1) {
      if (overlaps(labels[index].frame, labels[peer].frame)) throw new Error("Chart change annotation labels overlap; widen the exhibit or reduce the annotations");
    }
  }
  labels.forEach(({ frame, annotation, index }) => nodes.push(...labelNodes(id, index, frame, annotation.text, annotation.style)));
  return nodes;
}

export function renderAnnotationRail({ id, plot, props, categoryMap, allow = true }) {
  const rail = normalizeAnnotationRail(props);
  if (!rail.items.length) return [];
  if (!allow) throw new Error("A bottom annotation rail requires a horizontal category axis");
  const nodes = [];
  const y = plot.y + plot.height + 40;
  rail.items.forEach((item, index) => {
    const category = categoryMap.get(item.category);
    if (!category) throw new Error(`${id} annotation rail references unknown category ${item.category}`);
    const center = category.x + category.width / 2;
    const measured = measureText(item.text, Math.max(32, category.width - 20), {
      fontFamily: tokenValue(token("font.bodySemibold")),
      fontSize: tokenValue(ANNOTATION),
      bold: true,
      wrapWidthRatio: 1
    });
    const width = Math.min(category.width - 10, Math.max(52, Math.ceil(measured.width) + 20));
    if (width < 48 || measured.height > 24) throw new Error(`Annotation rail text for ${item.category} does not fit its category span`);
    const frame = { x: center - width / 2, y, width, height: 30 };
    nodes.push(ellipsePrimitive({
      id: stableId(id, "annotation-rail-surface", index),
      role: "annotation-surface",
      frame,
      style: { fill: PRIMARY, stroke: PRIMARY, lineWidth: HAIRLINE, opacity: 1 },
      data: { category: item.category, annotationStyle: "rail" }
    }));
    nodes.push(textPrimitive({
      id: stableId(id, "annotation-rail-text", index),
      role: "annotation-text",
      frame: { x: frame.x + 8, y: frame.y + 3, width: frame.width - 16, height: frame.height - 6 },
      text: item.text,
      style: textStyle(ANNOTATION, ON_PRIMARY, true),
      data: { category: item.category, annotationStyle: "rail" }
    }));
  });
  if (rail.label) {
    nodes.push(textPrimitive({
      id: stableId(id, "annotation-rail-label"),
      role: "annotation-text",
      frame: { x: plot.x - 88, y, width: 78, height: 30 },
      text: rail.label,
      style: textStyle(ANNOTATION, INK, true, "right"),
      data: { annotationStyle: "rail-label" }
    }));
  }
  return nodes;
}
