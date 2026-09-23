import {
  chartAnnotationStyle,
  ellipsePrimitive,
  linePrimitive,
  rectPrimitive,
  shapePrimitive,
  stableId,
  textPrimitive,
  token,
  tokenValue
} from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { textStyle as baseTextStyle } from "./text-style.mjs";

const CHANGE_ANNOTATION_STYLES = Object.freeze(["arrow", "bracket", "construction", "interval-label", "end-bubble"]);
const EVIDENCE_ANNOTATION_TREATMENTS = Object.freeze(["callout", "orthogonal-dot", "speech"]);
// Keep a full label-height gap between the observation box and the plot. The
// chart reserves this band before calculating marks, so value labels remain
// readable instead of tucking under the annotation surface.
export const EVIDENCE_CALLOUT_BAND = 88;
const CHANGE_ANNOTATION_BAND = 84;
const ANNOTATION_RAIL_BAND = 52;
const annotationRailLineHeight = () => measureText("0",1000,{fontSize:tokenValue(token("type.chartAnnotation"))}).height;
const annotationRailBand = () => Math.max(ANNOTATION_RAIL_BAND,annotationRailLineHeight()+tokenValue(token("space.4"))*2);

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
// Past this reach a speech tail stops reading as a taper, and the bubble takes
// a plain leader with a dot instead.
const TAIL_REACH = 40;

// The cap a callout wraps at and the tallest it is allowed to grow, not the
// size it always is: `evidenceBoxSize` fits the box to its own text within
// these. The band above the plot is reserved from the height, so a box that
// comes out shorter keeps its foot where the leader expects it.
const EVIDENCE_BOX_WIDTH = 260;
const EVIDENCE_BOX_HEIGHT = 56;
const EVIDENCE_BOX_MIN_WIDTH = 96;
const EVIDENCE_BOX_MIN_HEIGHT = 32;
const EVIDENCE_PAD_X = 16;
const EVIDENCE_PAD_Y = 14;
const ORTHOGONAL_GAP = 28;
const ENDPOINT_DIAMETER = 8;
const COLLISION_ROLES = new Set(["chart-mark", "chart-marker", "chart-point-highlight", "data-label", "chart-reference-label"]);
const SCALAR_BUBBLE = /^(?:[~≈]?\s*[+−\-£$€¥]{0,2}\s*\d+(?:,\d{3})*(?:\.\d+)?\s*(?:%|pp|bps|x|×|bn|mn|[kKmMbBtT])?(?:\s*p\.a\.)?|N\/A)$/;

// An annotation centres on the mark it points at, and its bold face is the
// annotation face rather than the body bold. Over the shared builder.
function textStyle(size, color, bold = false, align = "center") {
  const face = bold ? chartAnnotationStyle() : { fontFamily: token("font.body") };
  return { ...baseTextStyle({ fontSize: size, color, bold, align, valign: "mid" }), ...face };
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

function normalizeEvidenceAnnotations(props = {}) {
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

function measureEvidenceText(annotation) {
  return measureText(annotation.text, EVIDENCE_BOX_WIDTH - EVIDENCE_PAD_X, {
    fontFamily: tokenValue(token("font.bodySemibold")),
    fontSize: tokenValue(ANNOTATION),
    bold: true,
    wrapWidthRatio: 1
  });
}

/**
 * The box is the size of what it says.
 *
 * 260x56 was the size of every callout whatever it carried, so "$46m, 11-month
 * filing" - one short line - arrived as a rectangle two and a half times its
 * own text with a leader dropping out of the empty half. A reader reads that as
 * an unfinished box, not as a note. The width now closes on the longest laid
 * line and the height on the lines themselves; 260 is the cap it wraps at, and
 * `EVIDENCE_BOX_MIN_WIDTH` keeps a two-word note from shrinking to a stamp.
 */
function evidenceBoxSize(annotation) {
  const measured = measureEvidenceText(annotation);
  return {
    width: Math.min(EVIDENCE_BOX_WIDTH, Math.max(EVIDENCE_BOX_MIN_WIDTH, Math.ceil(measured.width) + EVIDENCE_PAD_X)),
    height: Math.max(EVIDENCE_BOX_MIN_HEIGHT, Math.ceil(measured.height) + EVIDENCE_PAD_Y),
  };
}

function assertEvidenceTextFits(annotation) {
  if (measureEvidenceText(annotation).height > EVIDENCE_BOX_HEIGHT - EVIDENCE_PAD_Y) throw new Error(`Chart evidence annotation for ${annotation.category} is too long for its body-sized box`);
}

function horizontalPlacement({ annotation, index, target, plot, obstacles, placements, id }) {
  const { width, height } = evidenceBoxSize(annotation);
  const y = Math.max(plot.y, Math.min(plot.y + plot.height - height, target.y - height / 2));
  const candidates = {
    right: {
      side: "right",
      frame: { x: target.x + ORTHOGONAL_GAP, y, width, height },
      leader: { x1: target.x + ORTHOGONAL_GAP, y1: target.y, x2: target.x, y2: target.y }
    },
    left: {
      side: "left",
      frame: { x: target.x - ORTHOGONAL_GAP - width, y, width, height },
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
  const { width, height } = evidenceBoxSize(annotation);
  const frame = {
    x: target.x - width / 2,
    // The band reserves `EVIDENCE_BOX_HEIGHT`; a shorter box sits on the foot of
    // that reservation rather than floating at the top of it, which would just
    // trade an empty box for a longer leader.
    y: plot.y - (topBandCount - bandIndex) * EVIDENCE_CALLOUT_BAND + (EVIDENCE_BOX_HEIGHT - height),
    width,
    height
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
  const { width, height } = evidenceBoxSize(annotation);
  const frame = {
    x: Math.max(plot.x - 12, Math.min(plot.x + plot.width + 12 - width, targetX - width / 2)),
    y: plot.y - (topBandCount - bandIndex) * EVIDENCE_CALLOUT_BAND + (EVIDENCE_BOX_HEIGHT - height),
    width,
    height
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

/**
 * The filled bubble with a pointed tail, drawn where the placement put the box.
 *
 * The tail replaces the leader line: it leaves the edge of the bubble the
 * leader starts from and closes on the mark the leader ends at, so the bubble
 * points at its evidence without a second rule crossing the plot.
 */
function speechNodes(id, placement, data) {
  const { index, frame, leader } = placement;
  const fill = INK, tail = 14;
  const near = (a, b) => Math.abs(a - b) < 1.5;
  const reach = Math.hypot(leader.x2 - leader.x1, leader.y2 - leader.y1);
  // A tail is a tail only while it is short. Stretched across half the plot a
  // 14px wedge stops tapering and reads as a filled bar, so past that reach the
  // bubble keeps a plain leader ending in a dot on the mark - the same
  // terminator every other annotation uses.
  const tailed = reach <= TAIL_REACH;
  // Which edge of the box the leader leaves from: the placement has already
  // decided where the bubble sits relative to its mark.
  const horizontal = near(leader.x1, frame.x) || near(leader.x1, frame.x + frame.width);
  const base = horizontal
    ? [[leader.x1, leader.y1 - tail / 2], [leader.x1, leader.y1 + tail / 2]]
    : [[leader.x1 - tail / 2, leader.y1], [leader.x1 + tail / 2, leader.y1]];
  const points = [...base, [leader.x2, leader.y2]];
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const width = Math.max(1, Math.max(...xs) - minX), height = Math.max(1, Math.max(...ys) - minY);
  const measured = measureText(placement.annotation.text, frame.width - 16, {
    fontFamily: tokenValue(token("font.bodySemibold")), fontSize: tokenValue(ANNOTATION), bold: true, wrapWidthRatio: 1,
  });
  return [
    tailed
      ? shapePrimitive({
          id: stableId(id, "annotation-tail", index), role: "annotation-surface", geometry: "iconPath",
          frame: { x: minX, y: minY, width, height },
          style: { fill, stroke: fill, lineWidth: HAIRLINE },
          data: { ...data, paths: [{ points: points.map(([x, y]) => [(x - minX) / width, (y - minY) / height]), closed: true }] },
        })
      : linePrimitive({
          id: stableId(id, "annotation-leader", index), role: "annotation-leader", ...leader,
          style: { stroke: fill, lineWidth: HAIRLINE, dash: "solid" },
          data: { ...data, endArrow: false, endpoint: "dot" },
        }),
    rectPrimitive({
      id: stableId(id, "annotation-box", index), role: "annotation-surface", frame,
      style: { fill, stroke: fill, lineWidth: HAIRLINE, radius: token("radius.small"), opacity: 1 },
      data,
    }),
    textPrimitive({
      id: stableId(id, "annotation-text", index), role: "annotation-text",
      frame: { x: frame.x + 8, y: frame.y + (frame.height - measured.height) / 2, width: frame.width - 16, height: measured.height },
      text: measured.text,
      style: { ...textStyle(ANNOTATION, ON_PRIMARY, true, "center"), lineHeight: measured.lineHeight },
      data: { ...data, textLayout: measured, annotationStyle: "speech" },
    }),
    ...(tailed ? [] : [ellipsePrimitive({
      id: stableId(id, "annotation-endpoint", index), role: "annotation-endpoint",
      frame: { x: leader.x2 - ENDPOINT_DIAMETER / 2, y: leader.y2 - ENDPOINT_DIAMETER / 2, width: ENDPOINT_DIAMETER, height: ENDPOINT_DIAMETER },
      style: { fill, stroke: fill, lineWidth: HAIRLINE, opacity: 1 },
      data,
    })]),
  ];
}

function evidenceNodes(id, placement) {
  const { annotation, index, frame, leader } = placement;
  const callout = annotation.treatment === "callout";
  const dotEnded = annotation.treatment === "orthogonal-dot";
  // `speech` is the filled bubble the reference decks put on a busy plot, where
  // an outlined surface on a canvas ground disappears into the gridlines. It is
  // the loudest of the three, so it carries one short phrase and no border of
  // its own: the fill is the emphasis.
  const speech = annotation.treatment === "speech";
  const data = {
    annotationKey: `${id}:evidence:${index}`,
    annotationTreatment: annotation.treatment,
    border: annotation.border !== false,
    orientation: annotation.orientation,
    targetCategory: annotation.category,
    targetSeries: annotation.series ?? null
  };
  if (speech) return speechNodes(id, placement, data);
  const nodes = [
    linePrimitive({
      id: stableId(id, "annotation-leader", index),
      role: "annotation-leader",
      ...leader,
      // A leader points at a mark; it does not attack it. An arrowhead landing
      // on a data point covers the point it is identifying and reads as a
      // second mark on the plot, so every leader ends in the small filled dot
      // the orthogonal treatment already used.
      style: { stroke: callout ? PRIMARY : RULE, lineWidth: callout ? STANDARD : HAIRLINE, dash: "solid" },
      data: { ...data, endArrow: false, endpoint: "dot" }
    }),
    rectPrimitive({
      id: stableId(id, "annotation-box", index),
      role: "annotation-surface",
      frame,
      style: { fill: callout ? SURFACE : PRIMARY_TINT, stroke: annotation.border === false ? "none" : RULE, lineWidth: HAIRLINE, radius: NONE_RADIUS, opacity: 1 },
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
  nodes.push(ellipsePrimitive({
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
  // `variant: "speech"` is the filled bubble with a pointed tail the reference
  // decks put over a chart - an aside in the deck's voice, rather than a
  // bordered note with a leader line to a mark.
  if (props.variant === "speech") {
    const leader = leaders[direction];
    const fill = token("color.ink");
    const tail = 18;
    // The tail is a triangle from the bubble's edge to the point it names.
    const points = direction === "down"
      ? [[leader.x1 - tail / 2, frame.y + frame.height], [leader.x1 + tail / 2, frame.y + frame.height], [leader.x2, leader.y2]]
      : direction === "up"
        ? [[leader.x1 - tail / 2, frame.y], [leader.x1 + tail / 2, frame.y], [leader.x2, leader.y2]]
        : direction === "left"
          ? [[frame.x, leader.y1 - tail / 2], [frame.x, leader.y1 + tail / 2], [leader.x2, leader.y2]]
          : [[frame.x + frame.width, leader.y1 - tail / 2], [frame.x + frame.width, leader.y1 + tail / 2], [leader.x2, leader.y2]];
    const minX = Math.min(...points.map((pt) => pt[0])), minY = Math.min(...points.map((pt) => pt[1]));
    const maxX = Math.max(...points.map((pt) => pt[0])), maxY = Math.max(...points.map((pt) => pt[1]));
    const width = Math.max(1, maxX - minX), height = Math.max(1, maxY - minY);
    return { nodes: [
      rectPrimitive({ id: stableId(id, "bubble"), role: "annotation-surface", frame, style: { fill, stroke: fill, lineWidth: HAIRLINE, radius: token("radius.small") } }),
      shapePrimitive({ id: stableId(id, "bubble-tail"), role: "annotation-surface", geometry: "iconPath",
        frame: { x: minX, y: minY, width, height },
        style: { fill, stroke: fill, lineWidth: HAIRLINE },
        data: { paths: [{ points: points.map(([x, y]) => [(x - minX) / width, (y - minY) / height]), closed: true }] } }),
      textPrimitive({ id: stableId(id, "bubble-text"), role: "annotation-text",
        frame: { x: frame.x + 8, y: frame.y + (frame.height - measured.height) / 2, width: frame.width - 16, height: measured.height },
        text: measured.text, style: { ...textStyle(ANNOTATION, token("color.onPrimary"), true, "center"), lineHeight: measured.lineHeight },
        data: { textLayout: measured, annotationStyle: "speech" } }),
    ] };
  }
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
    if (style === "interval-label") {
      if (!["exact-source", "approximate-source-readings"].includes(annotation.basis)) throw new Error("Qualitative interval needs an explicit exact-source or approximate-source-readings basis");
      if (typeof annotation.qualification !== "string" || !annotation.qualification.trim()) throw new Error("Qualitative interval needs a qualification");
      if (annotation.showQualification !== undefined && typeof annotation.showQualification !== "boolean") throw new Error("showQualification must be boolean");
      if (annotation.basis === "approximate-source-readings" && !/approximate|estimated|rough|~|≈/i.test(annotation.qualification)) throw new Error("Approximate interval qualification must explicitly identify approximate readings");
    } else if (!SCALAR_BUBBLE.test(annotation.text.trim()) || annotation.text.trim() === "N/A") throw new Error("Chart change bubbles require one numeric value; put the measure and period outside the bubble");
    return {
      ...annotation,
      style,
      start: normalizeAnchor(annotation.start, "start"),
      end: normalizeAnchor(annotation.end, "end")
    };
  });
}

export function normalizeAnnotationRail(props = {}) {
  if (!props.annotationRail) return { rows: [] };
  const rail = Array.isArray(props.annotationRail) ? { items: props.annotationRail } : props.annotationRail;
  if (!rail || typeof rail !== "object" || (rail.rows !== undefined && rail.items !== undefined)) throw new Error("Chart annotationRail needs items or rows, not both");
  const rows = rail.rows === undefined ? [rail] : rail.rows;
  if (!Array.isArray(rows)) throw new Error("Chart annotationRail rows must be an array");
  const labels = new Set();
  return { rows: rows.map((row, rowIndex) => {
    if (!row || !Array.isArray(row.items)) throw new Error("Chart annotationRail must contain an items array per row");
    if (row.items.length > 12) throw new Error("Use no more than twelve entries in one chart annotation rail");
    if (rail.rows !== undefined && (typeof row.label !== "string" || !row.label.trim())) throw new Error("Each annotation rail row requires a left-hand measure label");
    let labelWidth = 0;
    if (row.label !== undefined) {
      if (typeof row.label !== "string" || !row.label.trim() || labels.has(row.label)) throw new Error("Annotation rail measure labels must be non-empty and unique");
      labels.add(row.label);
      const measured = measureText(row.label, 160, { fontFamily: tokenValue(token("font.bodySemibold")), fontSize: tokenValue(ANNOTATION), bold: true, wrapWidthRatio: 1 });
      if (measured.height > 30) throw new Error("Shorten the annotation rail measure label to one line");
      labelWidth = Math.ceil(measured.width) + 4;
    }
    const categories = new Set();
    const items = row.items.map((item, index) => {
      if (!item || typeof item.category !== "string" || !item.category.trim() || categories.has(item.category)) throw new Error(`Chart annotation rail row ${rowIndex + 1} item ${index + 1} must name a unique category`);
      categories.add(item.category);
      // A bubble carries one scalar, never a metric name or an expression.
      if (typeof item.text !== "string" || !SCALAR_BUBBLE.test(item.text.trim())) throw new Error("Annotation rail bubbles require one numeric value (or N/A); move metric names to row labels and separate multiple metrics into rows");
      return { ...item, text: item.text.trim() };
    });
    return { ...row, labelWidth, items };
  }).filter(row => row.items.length) };
}

export function chartAnnotationBands(props = {}) {
  const changes = normalizeChangeAnnotations(props);
  const rail = normalizeAnnotationRail(props);
  return {
    top: changes.some(a => a.style !== "end-bubble") ? Math.max(CHANGE_ANNOTATION_BAND, ...changes.filter(a => a.style === "interval-label").map(a => measureIntervalLabel(a, 260).height + 44)) : 0,
    right: changes.some(a => a.style === "end-bubble") ? 150 : 0,
    bottom: rail.rows.length ? (rail.rows.length-1)*annotationRailBand()+Math.max(30,annotationRailLineHeight()+6) : 0,
    left: Math.max(0, ...rail.rows.map(row => row.labelWidth ? row.labelWidth + 12 : 0))
  };
}

function measureIntervalLabel(annotation, width) {
  const measured = measureText(annotation.text.trim() + (annotation.showQualification ? `\n${annotation.qualification.trim()}` : ""), width, {
    fontFamily: tokenValue(token("font.body")), fontSize: tokenValue(ANNOTATION), wrapWidthRatio: 1
  });
  if (measured.lines.length > 3) throw new Error("Qualitative interval label exceeds three measured lines; shorten its text or qualification");
  return measured;
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

/** A compact change label: the text alone, no bubble, for step brackets on small multiples. */
function compactLabelFrame(text, centerX, centerY, plot) {
  const measured = measureText(text, 120, { fontFamily: tokenValue(token("font.bodySemibold")), fontSize: tokenValue(ANNOTATION), bold: true, wrapWidthRatio: 1 });
  const width = Math.ceil(measured.width) + 6, height = 20;
  return { x: Math.max(plot.x - 10, Math.min(plot.x + plot.width + 10 - width, centerX - width / 2)), y: centerY - height / 2, width, height };
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
  const directional = style === "arrow" || style === "construction" || style === "interval-label";
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
      annotationKey: `${id}:${index}:${style}`,
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
      data: { annotationStyle: style, annotationKey: `${id}:${index}:${style}` }
    }),
    textPrimitive({
      id: stableId(id, "change-label", index),
      role: "annotation-text",
      frame: { x: frame.x + 10, y: frame.y + 4, width: frame.width - 20, height: frame.height - 8 },
      text,
      style: textStyle(ANNOTATION, ON_PRIMARY, true),
      data: { annotationStyle: style, annotationKey: `${id}:${index}:${style}` }
    })
  ];
}

/**
 * How far to lift a change arrow so nothing it spans sits under it.
 *
 * The arrow is drawn between two marks and its bubble rides the midpoint, so
 * on a falling series it crosses the interior bars and the values printed
 * above them. Rather than guess a gap from the mark geometry, this measures
 * the frames the chart has actually drawn - marks and data labels - inside the
 * arrow's horizontal span, and returns the lift that puts the shaft and the
 * bubble above all of them.
 *
 * The ceiling is not the plot's top edge but the top of the band the chart
 * already reserved for change annotations (CHANGE_ANNOTATION_BAND, which the
 * bracket styles draw in): an arrow that has to climb out of a plot full of
 * tall bars climbs into that band rather than sitting on a value label. A
 * partial lift still moves the bubble off the label it was sitting on.
 */
function arrowLift({ start, end, plot, obstacles = [], text, band = 0 }) {
  const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x);
  if (right - left < 1) return 0;
  const bubble = labelFrame(text, (start.x + end.x) / 2, (start.y + end.y) / 2, plot);
  const half = bubble.height / 2;
  const spans = obstacles
    .filter((node) => node.role === "chart-mark" || node.role === "data-label")
    .map((node) => node.frame)
    .filter((frame) => frame && frame.x + frame.width > left + 1 && frame.x < right - 1);
  if (!spans.length) return 0;
  // The arrow is a straight line, so the shaft's height over an obstacle is
  // read at the obstacle's own x; the bubble is a box around the midpoint and
  // has to clear whatever it overlaps horizontally.
  const shaftY = (x) => start.y + ((x - start.x) / (end.x - start.x)) * (end.y - start.y);
  const bubbleLeft = bubble.x, bubbleRight = bubble.x + bubble.width;
  let lift = 0;
  for (const frame of spans) {
    const overlapsBubble = frame.x + frame.width > bubbleLeft && frame.x < bubbleRight;
    const nearest = Math.min(Math.max(frame.x + frame.width / 2, left), right);
    const clearance = overlapsBubble ? half + 6 : 6;
    lift = Math.max(lift, shaftY(nearest) + clearance - frame.y);
  }
  const headroom = Math.min(start.y, end.y) - (plot.y - band + half);
  return Math.max(0, Math.min(lift, headroom));
}

export function renderChangeAnnotations({ id, plot, props, pointMap, obstacles = [] }) {
  const annotations = normalizeChangeAnnotations(props);
  if (!annotations.length) return [];
  const nodes = [];
  const labels = [];
  const evidenceBand = evidenceAnnotationTopBandCount(props) * EVIDENCE_CALLOUT_BAND;
  // The band the chart frame already held back above the plot for these
  // annotations; an arrow may climb into it rather than overlap the marks.
  const changeBand = chartAnnotationBands(props).top;

  annotations.forEach((annotation, index) => {
    const start = resolveAnchor(pointMap, annotation.start, id);
    const end = resolveAnchor(pointMap, annotation.end, id);
    if (Math.hypot(end.x - start.x, end.y - start.y) < 20) throw new Error(`${id} change annotation endpoints are too close to show clearly`);

    if (annotation.style === "interval-label") {
      if (Math.abs(end.x - start.x) < 20) throw new Error("Qualitative interval needs distinct horizontal category positions");
      const width = Math.min(260, plot.width);
      const measured = measureIntervalLabel(annotation, width);
      if (measured.height > measureIntervalLabel(annotation, 260).height) throw new Error("Qualitative interval label needs the full measured annotation width");
      const bracketY = plot.y - evidenceBand - 24;
      const frame = {x:Math.max(plot.x,Math.min(plot.x+plot.width-width,(start.x+end.x)/2-width/2)),y:bracketY-8-measured.height,width,height:measured.height};
      const data = {annotationStyle:annotation.style,annotationKey:`${id}:${index}:${annotation.style}`,basis:annotation.basis,qualification:annotation.qualification,start:annotation.start,end:annotation.end};
      for (const [part,x1,y1,x2,y2,arrow] of [["span",start.x,bracketY,end.x,bracketY,true],["start-drop",start.x,bracketY,start.x,start.y,false],["end-drop",end.x,bracketY,end.x,end.y,false]]) {
        const primitive = line(id,index,part,x1,y1,x2,y2,arrow,annotation.style);
        primitive.data = {...primitive.data,...data};
        nodes.push(primitive);
      }
      labels.push({frame,annotation,index,measured,data});
      return;
    }

    if (annotation.style === "end-bubble") {
      // The change sits beside the last point: a short leader from the end
      // mark to a bubble in the right gutter, at the end mark's height.
      const measured = labelFrame(annotation.text, 0, 0, plot);
      const mark = pointMap.get(`${annotation.end.series ? `${annotation.end.series}:` : "value:"}${annotation.end.category}`) || pointMap.get(`category:${annotation.end.category}`);
      const y = mark?.y ?? end.y;
      // Clear the end mark and its value label, then a short leader and the bubble.
      const x0 = end.x + 44, x1 = x0 + 14;
      const frame = { x: x1, y: y - measured.height / 2, width: measured.width, height: measured.height };
      nodes.push(line(id, index, "leader", x0, y, x1, y, false, annotation.style));
      labels.push({ frame, annotation, index });
      return;
    }
    if (annotation.style === "arrow") {
      // The arrow runs from the first mark to the last and its bubble sits at
      // the midpoint, so on a descending series the bubble lands on whatever
      // the interior categories put there - a bar top, or the value printed
      // above it. Lift the whole arrow until both the shaft and the bubble
      // clear every mark and every printed value in the span.
      const lift = arrowLift({ start, end, plot, obstacles, text: annotation.text, band: changeBand });
      if (lift > 0) { start.y -= lift; end.y -= lift; }
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

    const leftX = Math.min(start.x, end.x);
    const rightX = Math.max(start.x, end.x);
    // Stay above every mark in the interval, including an interior line peak,
    // while avoiding empty full-height leaders for small values on shared scales.
    const intervalTop = Math.min(start.y, end.y, ...[...pointMap.values()]
      .filter(point => point.x >= leftX && point.x <= rightX)
      .map(point => point.changeY ?? point.y));
    const compact = annotation.compact === true;
    const bracketY = evidenceBand ? plot.y - evidenceBand - (compact ? 18 : 34) : Math.max(plot.y - (compact ? 18 : 34), intervalTop - (compact ? 18 : 34));
    const frame = compact ? compactLabelFrame(annotation.text, (leftX + rightX) / 2, bracketY - 10, plot) : labelFrame(annotation.text, (leftX + rightX) / 2, bracketY - 24, plot);
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
  labels.forEach(({ frame, annotation, index, measured, data }) => {
    if (annotation.style === "interval-label") nodes.push(textPrimitive({id:stableId(id,"change-label",index),role:"annotation-text",frame,text:measured.text,style:textStyle(ANNOTATION,INK),data:{...data,textLayout:{lines:measured.lines,lineHeight:measured.lineHeight}}}));
    else if (annotation.compact === true) nodes.push(textPrimitive({ id: stableId(id, "change-label", index), role: "annotation-text", frame, text: annotation.text, style: textStyle(ANNOTATION, INK, true), data: { annotationStyle: annotation.style, annotationKey: `${id}:${index}:${annotation.style}`, compact: true } }));
    else nodes.push(...labelNodes(id, index, frame, annotation.text, annotation.style));
  });
  return nodes;
}

export function renderAnnotationRail({ id, plot, props, categoryMap, allow = true }) {
  const rail = normalizeAnnotationRail(props);
  if (!rail.rows.length) return [];
  if (!allow) throw new Error("A bottom annotation rail requires a horizontal category axis");
  const nodes = [];
  rail.rows.forEach((row, rowIndex) => {
  const railId = rowIndex ? stableId(id, "rail-row", rowIndex) : id;
  const y = plot.y + plot.height + Math.max(40,(plot.categoryLabelHeight ?? 0)+16) + (plot.categoryGroupHeight ?? 0) + rowIndex * annotationRailBand();
  row.items.forEach((item, index) => {
    const category = categoryMap.get(item.category);
    if (!category) throw new Error(`${id} annotation rail references unknown category ${item.category}`);
    const center = category.labelCenter ?? category.x + category.width / 2;
    const labelSpan=category.labelSpan ?? category.width;
    const measured = measureText(item.text, Math.max(32, labelSpan - 20), {
      fontFamily: tokenValue(token("font.bodySemibold")),
      fontSize: tokenValue(ANNOTATION),
      bold: true,
      wrapWidthRatio: 1
    });
    const width = Math.min(labelSpan - 10, Math.max(52, Math.ceil(measured.width) + 20));
    if (width < 48 || measured.height > annotationRailLineHeight()) throw new Error(`Annotation rail text for ${item.category} does not fit its category span`);
    const frame = { x: center - width / 2, y, width, height: Math.max(30,measured.height+6) };
    nodes.push(ellipsePrimitive({
      id: stableId(railId, "annotation-rail-surface", index),
      role: "annotation-surface",
      frame,
      style: { fill: PRIMARY, stroke: PRIMARY, lineWidth: HAIRLINE, opacity: 1 },
      data: { category: item.category, annotationStyle: "rail", annotationKey: `${railId}:rail:${item.category}` }
    }));
    nodes.push(textPrimitive({
      id: stableId(railId, "annotation-rail-text", index),
      role: "annotation-text",
      frame: { x: frame.x + 8, y: frame.y + 3, width: frame.width - 16, height: frame.height - 6 },
      text: item.text,
      style: textStyle(ANNOTATION, ON_PRIMARY, true),
      data: { category: item.category, annotationStyle: "rail", annotationKey: `${railId}:rail:${item.category}` }
    }));
  });
  if (row.label) {
    nodes.push(textPrimitive({
      id: stableId(railId, "annotation-rail-label"),
      role: "annotation-text",
      frame: { x: plot.x - row.labelWidth - 12, y, width: row.labelWidth, height: 30 },
      text: row.label,
      style: textStyle(ANNOTATION, INK, true, "right"),
      data: { annotationStyle: "rail-label" }
    }));
  }
  });
  return nodes;
}
