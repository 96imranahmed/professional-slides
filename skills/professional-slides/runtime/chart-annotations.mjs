import {
  chartAnnotationStyle,
  ellipsePrimitive,
  linePrimitive,
  rectPrimitive,
  shapePrimitive,
  stableId,
  textPrimitive,
  token,
  tokenValue,
  onFill
} from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { SCALAR_FIGURE } from "./value-format.mjs";
import { textStyle as baseTextStyle } from "./text-style.mjs";
import { judged } from "./judgements.mjs";
import { contrastRatio } from "./color.mjs";

const CHANGE_ANNOTATION_STYLES = Object.freeze(["arrow", "bracket", "construction", "interval-label", "end-bubble"]);
const EVIDENCE_ANNOTATION_TREATMENTS = Object.freeze(["callout", "orthogonal-dot", "speech"]);
/** A callout's treatment, the retired "takeaway-box" read as the callout it became: one place knows the alias. */
export const evidenceTreatment = (annotation) => (!annotation?.treatment || annotation.treatment === "takeaway-box" ? "callout" : annotation.treatment);
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
const SECONDARY = token("color.textSecondary");
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
// An axis title is ink a callout box or its leader must clear - the y title
// set above a scatter's plot among them.
// The looks a callout takes (`style`, on an annotation of the callout treatment), each one drawn on the strong pages the
// calibration was read from: the outlined note (`box`, the default); a tinted note with no outline (`tint`); the note in
// the accent with no box at all, its leader a hairline (`plain`); a white bubble whose accent tail points at its mark
// (`bubble`); a pill holding one value, +12% or 2.3x (`pill`); and a figure set large with its line under it (`figure`).
// Every one is placed as a callout is - in the plot's open space beside its mark, the band only where the plot has none.
export const CALLOUT_STYLES = Object.freeze(["box", "tint", "plain", "bubble", "pill", "figure"]);
const styleOf = (annotation) => annotation?.style ?? "box";
const ACCENT = token("color.accent");
const FIGURE_TYPE = token("type.heading");
const PILL_PAD_X = 8;
const PILL_MAX_WIDTH = 200;
const FIGURE_CAPTION_WIDTH = 200;
// A pill or a figure this near its mark is read as its mark's, with no leader.
const LEADER_ADJACENT = 18;
const COLLISION_ROLES = new Set(["chart-mark", "chart-marker", "chart-point-highlight", "data-label", "chart-reference-label", "axis-title"]);

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
    const treatment = evidenceTreatment(annotation);
    if (annotation.border !== undefined && typeof annotation.border !== "boolean") throw new Error("Chart annotation border must be a boolean");
    if (annotation.style !== undefined && !CALLOUT_STYLES.includes(annotation.style)) throw new Error(`Chart evidence annotation ${index + 1}: \`style\` is one of ${CALLOUT_STYLES.join(", ")} (got ${JSON.stringify(annotation.style)})`);
    if (annotation.style !== undefined && treatment !== "callout") throw new Error(`Chart evidence annotation ${index + 1}: a \`style\` belongs to a callout; a ${treatment} note keeps its own look`);
    if (annotation.style === "figure" && (typeof annotation.figure !== "string" || !annotation.figure.trim())) throw new Error(`Chart evidence annotation ${index + 1}: a figure callout sets one value large - give it \`figure\` ("+32%", "$1.3T") and \`text\`, the line under it`);
    if (annotation.figure !== undefined && annotation.style !== "figure") throw new Error(`Chart evidence annotation ${index + 1}: \`figure\` is the value a \`style: "figure"\` callout sets large`);
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

// A callout the chart has already moved beside its mark (or into a right-hand
// rail) on an earlier pass holds no band above the plot: reserving 88px for a
// box that is not there would leave an empty stripe over the chart.
const RELEASED_PLACEMENTS = new Set(["beside", "rail", "on-bar", "plot"]);
const holdsBand = (annotation) => (annotation.treatment !== "orthogonal-dot" || annotation.orientation !== "horizontal") && !RELEASED_PLACEMENTS.has(annotation._placement);

// The bands the callouts above the plot sit in, as lanes: lane 0 is the band
// on the plot, each lane above it the next band up. A callout holds its own
// lane, in order - the first callout highest - until a render has placed them
// (`_lane`, set by packedEvidenceProps): callouts whose boxes do not meet across
// the plot then share a lane, and the plot keeps the height a stacked band
// would have taken. Each entry is { annotation, index, lane }, `index` its place
// in the chart's annotations.
function bandLanes(props) {
  const banded = normalizeEvidenceAnnotations(props).map((annotation, index) => ({ annotation, index })).filter((entry) => holdsBand(entry.annotation));
  const packed = banded.length && banded.every((entry) => Number.isInteger(entry.annotation._lane) && entry.annotation._lane >= 0);
  return banded.map((entry, order) => ({ ...entry, lane: packed ? entry.annotation._lane : banded.length - 1 - order }));
}
const laneCount = (lanes) => (lanes.length ? Math.max(...lanes.map((entry) => entry.lane)) + 1 : 0);

export function evidenceAnnotationTopBandCount(props = {}) {
  return laneCount(bandLanes(props));
}

// In a compact band each box takes its own measured height plus a small gap,
// and only the lowest keeps the full foot that clears the value labels riding
// the tallest marks. It is what the chart falls back to when the full 88px
// bands would leave the plot under its minimum height. A shared band is as tall
// as its tallest box.
const COMPACT_BAND_GAP = 8;
const BAND_FOOT = EVIDENCE_CALLOUT_BAND - EVIDENCE_BOX_HEIGHT;
function bandHeights(props, compact) {
  const lanes = bandLanes(props), count = laneCount(lanes);
  // Indexed as the bands stack, band 0 the highest: band b holds lane count-1-b.
  return Array.from({ length: count }, (_, band) => {
    if (!compact) return EVIDENCE_CALLOUT_BAND;
    const lane = count - 1 - band;
    const tallest = Math.max(...lanes.filter((entry) => entry.lane === lane).map((entry) => evidenceBoxSize(entry.annotation).height), EVIDENCE_BOX_MIN_HEIGHT);
    return tallest + (lane === 0 ? BAND_FOOT : COMPACT_BAND_GAP);
  });
}

/** The height the evidence bands take above the plot, full or compact. */
export function evidenceBandSpan(props = {}, { compact = false } = {}) {
  return bandHeights(props, compact).reduce((sum, height) => sum + height, 0);
}

// The top of the box in band `bandIndex`: band 0 is the highest. A shorter box
// sits on the foot of its band rather than floating at the top of it.
function bandBoxY(plot, props, bandIndex, height) {
  const heights = bandHeights(props, plot.evidenceCompact === true);
  const below = heights.slice(bandIndex + 1).reduce((sum, h) => sum + h, 0);
  const foot = plot.evidenceCompact === true ? (bandIndex === heights.length - 1 ? BAND_FOOT : COMPACT_BAND_GAP) : BAND_FOOT;
  return plot.y - below - foot - height;
}

// A callout with no `series` on a chart of several series (a stacked or
// grouped chart keys its marks by series) points at the category as a whole:
// the top of the stack, or the category's largest mark.
function resolveEvidenceAnchor(pointMap, annotation, id) {
  const target = pointMap.get(`${annotation.series || "value"}:${annotation.category}`)
    ?? (annotation.series ? null : pointMap.get(`category:${annotation.category}`));
  if (!target) {
    const categories = [...new Set([...pointMap.keys()].map((key) => key.slice(key.indexOf(":") + 1)))];
    const known = categories.includes(annotation.category);
    if (annotation.series && known) throw new Error(`${id} evidence annotation names series "${annotation.series}", which has no mark at ${annotation.category}; use one of the chart's series names or omit series to point at the category as a whole`);
    throw new Error(`${id} evidence annotation references unknown category ${annotation.category}; use one of: ${categories.slice(0, 12).join(", ")}`);
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

function annotationObstacleFrames(obstacles, roles = COLLISION_ROLES) {
  return obstacles.filter((node) => roles.has(node.role) && node.frame?.width !== undefined && node.frame?.height !== undefined).map(node => {
    if (node.type !== "text") return node;
    // Text allocations often span a whole bar/category. Collision routing uses
    // the measured ink box rather than treating its empty margins as ink.
    const measured = measureText(node.text, node.frame.width, { fontFamily: tokenValue(node.style.fontFamily), fontSize: tokenValue(node.style.fontSize), bold: node.style.bold });
    const x = node.frame.x + (node.style.align === "center" ? (node.frame.width - measured.width) / 2 : node.style.align === "right" ? node.frame.width - measured.width : 0);
    const y = node.frame.y + (node.style.valign === "mid" ? (node.frame.height - measured.height) / 2 : node.style.valign === "bottom" ? node.frame.height - measured.height : 0);
    return { ...node, frame: { x, y, width: measured.width, height: measured.height } };
  });
}

// Two boxes keep the compact band's gap apart, not more: at 10px, two compact
// boxes that overlap across - a bridge's staff-cost and other-cost notes,
// neighbours on the axis, stacked 8px apart by their bands - fail each other
// by two pixels, and the second goes to a rail that squeezes the category
// labels off the page.
function clearSurface(frame, obstacles, placements) {
  return obstacles.every((node) => !meets(node, frame, 6))
    && placements.every((placement) => !overlaps(frame, placement.frame, COMPACT_BAND_GAP));
}

// A line's segment is read as the segment, not its box: a callout placed in
// the plot sits above or beside a rising line, inside the box its diagonal
// spans; read as a box, every such place would be refused.
function meets(node, frame, pad) {
  const d = node.type === "line" ? node.data : null;
  if (!d || ![d.x1, d.y1, d.x2, d.y2].every(Number.isFinite)) return overlaps(frame, node.frame, pad);
  // Every point walked below lies in the segment's box: a frame that box cannot reach meets none of them.
  const EPS = 1e-6;
  if (Math.max(d.x1, d.x2) < frame.x - pad - EPS || Math.min(d.x1, d.x2) > frame.x + frame.width + pad + EPS
    || Math.max(d.y1, d.y2) < frame.y - pad - EPS || Math.min(d.y1, d.y2) > frame.y + frame.height + pad + EPS) return false;
  const steps = Math.max(1, Math.ceil(Math.hypot(d.x2 - d.x1, d.y2 - d.y1) / 4));
  for (let i = 0; i <= steps; i += 1) if (pointInsideFrame({ x: d.x1 + (d.x2 - d.x1) * i / steps, y: d.y1 + (d.y2 - d.y1) * i / steps }, frame, pad)) return true;
  return false;
}

// A leader's last few pixels lie under its endpoint dot, on the mark it
// names, so its corridor stops at the dot's edge. Run on past the mark's
// centre, it caught a neighbouring series' point that overlaps the mark - two
// lines a point and a half apart where they cross - and the callout lost the
// band it could share with another, the chart giving up 88px of plot to a
// second band (packedEvidenceProps).
function clearLeader(x1, y1, x2, y2, target, obstacles) {
  const length = Math.hypot(x2 - x1, y2 - y1), trim = length ? Math.min(length, ENDPOINT_DIAMETER / 2) / length : 0;
  const ex = x2 - (x2 - x1) * trim, ey = y2 - (y2 - y1) * trim;
  const corridor = {
    x: Math.min(x1, ex) - 3,
    y: Math.min(y1, ey) - 3,
    width: Math.abs(ex - x1) + 6,
    height: Math.abs(ey - y1) + 6
  };
  return obstacles.every((node) => pointInsideFrame(target, node.frame, 1) || !meets(node, corridor, 1));
}

function measureEvidenceText(annotation) {
  return measureText(annotation.text, EVIDENCE_BOX_WIDTH - EVIDENCE_PAD_X, {
    fontFamily: tokenValue(token("font.bodySemibold")),
    fontSize: tokenValue(ANNOTATION),
    bold: true
  });
}

/**
 * The box is the size of what it says.
 *
 * At a fixed 260x56, "$46m, 11-month filing" - one short line - would arrive as
 * a rectangle two and a half times its own text with a leader dropping out of
 * the empty half, which a reader reads as an unfinished box, not as a note. The
 * width closes on the longest laid line and the height on the lines
 * themselves; 260 is the cap it wraps at, and
 * `EVIDENCE_BOX_MIN_WIDTH` keeps a two-word note from shrinking to a stamp.
 */
const annotationFace = (bold = true) => ({ fontFamily: tokenValue(token(bold ? "font.bodySemibold" : "font.body")), fontSize: tokenValue(ANNOTATION), bold });

/**
 * A styled callout's layout: the lines it sets and the box they close on. A
 * plain note and a figure have no box, so the frame is their ink; a pill is
 * one line, a half-height round either side.
 */
function styleLayout(annotation) {
  const style = styleOf(annotation);
  if (style === "plain") {
    const text = measureText(annotation.text, EVIDENCE_BOX_WIDTH - 4, annotationFace());
    return { text, width: Math.ceil(text.width) + 4, height: Math.ceil(text.height) + 2 };
  }
  if (style === "pill") {
    const text = measureText(annotation.text, 100000, annotationFace());
    return { text, width: Math.ceil(text.width) + 2 * PILL_PAD_X, height: Math.max(20, Math.ceil(text.height) + 8) };
  }
  if (style === "figure") {
    const figure = measureText(annotation.figure, 100000, { fontFamily: tokenValue(token("font.bodySemibold")), fontSize: tokenValue(FIGURE_TYPE), bold: true });
    const text = measureText(annotation.text, FIGURE_CAPTION_WIDTH, annotationFace(false));
    return { figure, text, width: Math.ceil(Math.max(figure.width, text.width)) + 4, height: Math.ceil(figure.height + text.height) + 2 };
  }
  return null;
}

function evidenceBoxSize(annotation) {
  const styled = styleLayout(annotation);
  if (styled) return { width: styled.width, height: styled.height };
  const measured = measureEvidenceText(annotation);
  return {
    width: Math.min(EVIDENCE_BOX_WIDTH, Math.max(EVIDENCE_BOX_MIN_WIDTH, Math.ceil(measured.width) + EVIDENCE_PAD_X)),
    height: Math.max(EVIDENCE_BOX_MIN_HEIGHT, Math.ceil(measured.height) + EVIDENCE_PAD_Y),
  };
}

function assertEvidenceTextFits(annotation) {
  const style = styleOf(annotation);
  if (style === "pill") {
    const { text, width } = styleLayout(annotation);
    if (text.lines?.length > 1 || width > PILL_MAX_WIDTH) throw new Error(`Chart evidence annotation for ${annotation.category} is a pill, which holds one value - "+12%", "2.3x", "No. 1" - in one short line; "${annotation.text}" is a note: give it \`style: "box"\` or "plain"`);
    return;
  }
  if (style === "figure") {
    const { figure, text } = styleLayout(annotation);
    if (figure.width > PILL_MAX_WIDTH) throw new Error(`Chart evidence annotation for ${annotation.category}: a figure callout sets one value large ("$1.3T", "+32%"); "${annotation.figure}" is longer than a value`);
    if ((text.lines?.length ?? 1) > 2) throw new Error(`Chart evidence annotation for ${annotation.category}: the line under a figure is two lines at most; cut "${annotation.text}" to a few words, the figure says the rest`);
    return;
  }
  // Three lines at the callout's 260px cap is what a note on a mark can carry
  // and still read as a note; past that it is a paragraph, and no placement
  // makes a paragraph legible over a plot.
  if (measureEvidenceText(annotation).height > EVIDENCE_BOX_HEIGHT - EVIDENCE_PAD_Y) throw new Error(`Chart evidence annotation for ${annotation.category} is too long for its body-sized box; cut it to three short lines (about 90 characters) or move the reasoning into the page's insight`);
}

const leaderObstacles = (obstacles, placements) => [...obstacles, ...placements.map((placement) => ({ frame: placement.frame }))];

function horizontalPlacement({ annotation, index, target, plot, obstacles, placements }) {
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
    && clearLeader(candidate.leader.x1, candidate.leader.y1, candidate.leader.x2, candidate.leader.y2, target, leaderObstacles(obstacles, placements)));
  if (!selected) return null;
  return { annotation, index, target, frame: selected.frame, leader: selected.leader, side: selected.side, placement: "orthogonal" };
}

function verticalPlacement({ annotation, index, target, plot, props, bandIndex, obstacles, placements }) {
  const { width, height } = evidenceBoxSize(annotation);
  const frame = { x: target.x - width / 2, y: bandBoxY(plot, props, bandIndex, height), width, height };
  const leader = { x1: target.x, y1: frame.y + frame.height, x2: target.x, y2: target.y };
  if (frame.x < plot.x || frame.x + frame.width > plot.x + plot.width || !clearLeader(leader.x1, leader.y1, leader.x2, leader.y2, target, leaderObstacles(obstacles, placements))) return null;
  if (!clearSurface(frame, [], placements)) return null;
  return { annotation, index, target, frame, leader, side: "above", placement: "band" };
}

// Roles a box set beside its mark must also stay clear of: a beside box can
// reach the category column, the value-label gutter and the delta column,
// which a box in the band above the plot never meets.
const BESIDE_ROLES = new Set([...COLLISION_ROLES, "chart-line", "category-label", "category-note", "category-icon", "category-logo", "category-logo-placeholder", "chart-delta", "chart-delta-label", "chart-bracket-label", "data-label-leader", "chart-period-label", "chart-event-label", "chart-quadrant-title", "chart-threshold-label", "axis-label"]);

// The mark's own value label, when it prints one next to the point: a box set
// beside the mark sits beyond that label, and its leader stops at the label's
// edge instead of striking through the number.
function ownLabel(target, annotation, obstacles) {
  const distance = (frame) => Math.hypot(Math.max(0, frame.x - target.x, target.x - frame.x - frame.width), Math.max(0, frame.y - target.y, target.y - frame.y - frame.height));
  return obstacles
    .filter((node) => node.role === "data-label" && node.data?.category === annotation.category
      && (!annotation.series || !node.data?.series || node.data.series === annotation.series)
      && distance(node.frame) <= 40)
    .sort((a, b) => distance(a.frame) - distance(b.frame))[0] ?? null;
}

/**
 * A box beside its mark, inside the plot (or the right-hand rail the chart
 * made room for): the fallback when the band above the plot has no clear
 * corridor to the mark.
 *
 * On a horizontal bar chart a callout on any bar but the first drops its
 * leader from the band through every longer bar above it, and the orthogonal
 * treatment puts its box 28px from the bar end - on top of the value label
 * printed there. A designer sets
 * the note level with its bar, just past the value, and that is the first
 * candidate here; then the other side, then the same two nudged half a box up
 * or down, then directly above or below the mark. The leader runs from the
 * box to the mark's end, stopping short of its value label.
 */
function besidePlacement({ annotation, index, target, bounds, obstacles, placements }) {
  const { width, height } = evidenceBoxSize(annotation);
  const label = ownLabel(target, annotation, obstacles);
  const anchor = label
    ? { x: Math.min(label.frame.x, target.x), y: Math.min(label.frame.y, target.y), width: Math.max(label.frame.x + label.frame.width, target.x) - Math.min(label.frame.x, target.x), height: Math.max(label.frame.y + label.frame.height, target.y) - Math.min(label.frame.y, target.y) }
    : { x: target.x, y: target.y, width: 0, height: 0 };
  const reach = ENDPOINT_DIAMETER / 2 + 3;
  const beyond = { right: label ? anchor.x + anchor.width + reach : target.x, left: label ? anchor.x - reach : target.x };
  const above = label && label.frame.y + label.frame.height <= target.y + 2 ? anchor.y - reach : target.y;
  const below = label && label.frame.y >= target.y - 2 ? anchor.y + anchor.height + reach : target.y;
  const candidates = [];
  for (const dy of [0, -(height / 2 + 6), height / 2 + 6]) {
    const y = target.y - height / 2 + dy;
    const mid = Math.max(y + 4, Math.min(y + height - 4, target.y));
    candidates.push({ side: "right", frame: { x: beyond.right + ORTHOGONAL_GAP - reach, y, width, height }, leader: { x1: beyond.right + ORTHOGONAL_GAP - reach, y1: mid, x2: beyond.right, y2: target.y } });
    candidates.push({ side: "left", frame: { x: beyond.left - ORTHOGONAL_GAP + reach - width, y, width, height }, leader: { x1: beyond.left - ORTHOGONAL_GAP + reach, y1: mid, x2: beyond.left, y2: target.y } });
  }
  // A bar below zero leaves its row empty past the axis: the note goes there,
  // in the bar's own row, its leader to the bar's foot. Beside the value end
  // alone, the box would meet the bar itself and a note on the "only region
  // that shrank" would have nowhere to go.
  const bar = obstacles.find((node) => node.role === "chart-mark" && node.data?.category === annotation.category
    && (!annotation.series || !node.data?.series || node.data.series === annotation.series) && node.frame.width > node.frame.height);
  if (bar && label && label.frame.x + label.frame.width <= bar.frame.x + 2) {
    const foot = bar.frame.x + bar.frame.width, y = target.y - height / 2;
    candidates.push({ side: "right", frame: { x: foot + ORTHOGONAL_GAP, y, width, height }, leader: { x1: foot + ORTHOGONAL_GAP, y1: target.y, x2: foot, y2: target.y } });
  }
  const centred = Math.max(bounds.x, Math.min(bounds.x + bounds.width - width, target.x - width / 2));
  const leaderX = Math.max(centred + 4, Math.min(centred + width - 4, target.x));
  candidates.push({ side: "above", frame: { x: centred, y: above - ORTHOGONAL_GAP - height, width, height }, leader: { x1: leaderX, y1: above - ORTHOGONAL_GAP, x2: target.x, y2: above } });
  // Above a short mark among taller ones: the box clears the tallest thing
  // under its width, the leader drops to the mark. A pandemic-year column
  // between two tall years has empty plot over it, but a box set just above
  // the mark meets its neighbours.
  // Slid sideways, over the lowest neighbours, it finds the empty corner
  // between two tall ones.
  for (const shift of [0, -0.25, 0.25, -0.5, 0.5, -0.75, 0.75]) {
    const x = Math.max(bounds.x, Math.min(bounds.x + bounds.width - width, target.x - width / 2 + shift * width));
    const under = obstacles.filter((node) => node.frame.x < x + width + 6 && node.frame.x + node.frame.width > x - 6 && node.frame.y < above);
    if (!under.length) continue;
    const top = Math.min(...under.map((node) => node.frame.y)) - ORTHOGONAL_GAP / 2 - height;
    const lx = Math.max(x + 4, Math.min(x + width - 4, target.x));
    candidates.push({ side: "above", frame: { x, y: top, width, height }, leader: { x1: lx, y1: top + height, x2: target.x, y2: above } });
  }
  candidates.push({ side: "below", frame: { x: centred, y: below + ORTHOGONAL_GAP, width, height }, leader: { x1: leaderX, y1: below + ORTHOGONAL_GAP, x2: target.x, y2: below } });
  const others = leaderObstacles(obstacles, placements);
  const selected = candidates.find((candidate) => frameInside(candidate.frame, bounds)
    && clearSurface(candidate.frame, obstacles, placements)
    && clearLeader(candidate.leader.x1, candidate.leader.y1, candidate.leader.x2, candidate.leader.y2, { x: candidate.leader.x2, y: candidate.leader.y2 }, others));
  if (!selected) return null;
  return { annotation, index, target, frame: selected.frame, leader: selected.leader, side: selected.side, placement: "beside" };
}

/**
 * A callout set inside its own bar: the step between beside and the rail. A
 * long, thick bar has plain area past its start, and a note set there needs no
 * leader - it is on the thing it describes. Only its own mark (same category
 * and series), fully inside with a margin, clear of its value label and every
 * other obstacle; the suite's rendered overlap audit accepts exactly this
 * construction and nothing looser (evals/support/overlap-policy.mjs).
 */
function insidePlacement({ annotation, index, target, marks, obstacles, placements }) {
  if (annotation.treatment === "speech") return null; // a speech bubble points with its tail
  const mark = marks.find((node) => node.data?.category === annotation.category && (annotation.series === undefined || node.data?.series === annotation.series));
  if (!mark?.frame) return null;
  const { width, height } = evidenceBoxSize(annotation);
  const pad = 6, f = mark.frame;
  const room = { x: f.x + pad, y: f.y + pad, width: f.width - 2 * pad, height: f.height - 2 * pad };
  const others = obstacles.filter((node) => node.id !== mark.id);
  for (const at of [{ x: room.x, y: f.y + (f.height - height) / 2 }, { x: f.x + (f.width - width) / 2, y: room.y + room.height - height }]) {
    const frame = { ...at, width, height };
    if (frameInside(frame, room) && clearSurface(frame, others, placements))
      return { annotation, index, target, frame, leader: null, placement: "inside", insideOf: { category: mark.data.category, series: mark.data.series ?? null } };
  }
  // The note alone, reversed out of the bar at its end. The longest bar of a
  // six-bar panel is about 34px thick and 300px long: too thin for the boxed
  // note (32px plus its margins), too long to leave room past its end, and a
  // rail can take the panel's plot below its minimum - yet it is often the bar
  // the page is about. A line or two of the
  // annotation face fits along it, set without a box: it sits on its mark.
  // It is the last resort, after the rail (`_placement: "on-bar"`, set by the
  // chart's render loop when the rail left the plot too narrow): a boxed note
  // reads louder, and a chart with width to spare keeps it. A column's segment
  // can be wider than tall too; the note must fit its words on the mark.
  const text = annotation._placement === "on-bar" && f.width > f.height ? (() => { try { return measureText(annotation.text, Math.max(1, f.width - 2 * pad), { fontFamily: tokenValue(token("font.bodySemibold")), fontSize: tokenValue(ANNOTATION), bold: true }); } catch { return null; } })() : null;
  if (text) {
    const w = Math.ceil(text.width) + 2, h = text.height;
    const frame = { x: f.x + f.width - pad - w, y: f.y + (f.height - h) / 2, width: w, height: h };
    if (h <= f.height - 4 && frame.x >= f.x + pad && clearSurface(frame, others.filter((node) => node.role !== "chart-highlight"), placements))
      return { annotation, index, target, frame, leader: null, placement: "inside", textOnly: { layout: text, fill: mark.style?.fill }, insideOf: { category: mark.data.category, series: mark.data.series ?? null } };
  }
  return null;
}

// What a box set in the plot's open space stays off, beyond what a box beside its mark does: the rules a value is read
// against and the labels of bands and guides. A leader may cross a rule; it may not cross a mark, a label or another note.
const OPEN_ROLES = new Set([...BESIDE_ROLES, "chart-reference-line", "chart-threshold-line", "chart-trend-line", "chart-event-line", "chart-band-label", "chart-band-edge", "chart-band-ring", "data-label-leader"]);
const LEADER_ROLES = new Set([...COLLISION_ROLES, "chart-line", "category-label", "chart-quadrant-title", "chart-threshold-label", "chart-band-label", "chart-event-label", "chart-period-label", "data-label-leader"]);
// The grid the open space is searched on, the shortest leader that reads as a leader rather than a box touching its mark,
// and the cost a slanted leader carries against a straight one of the same length.
const OPEN_STEP = 6;
const OPEN_LEADER_MIN = 14;
const SLANT_COST = 48;

/**
 * A pill or a figure set on its mark, as a value label is: centred over the
 * mark's own label (a column, a point), or past the end of a bar's label - no
 * leader, read as the mark's. Null where that place is taken.
 */
function adjacentPlacement({ annotation, index, target, bounds, obstacles, leaderStops, placements }) {
  const { width, height } = evidenceBoxSize(annotation);
  const end = leaderTarget(target, leaderStops, annotation);
  const label = ownLabel(target, annotation, leaderStops);
  const candidates = [{ x: end.x - width / 2, y: end.y - ENDPOINT_DIAMETER / 2 - 2 - height }];
  if (label && label.frame.x >= target.x - 2) candidates.push({ x: label.frame.x + label.frame.width + 6, y: label.frame.y + label.frame.height / 2 - height / 2 });
  for (const at of candidates) {
    const frame = { ...at, width, height };
    if (frameInside(frame, bounds) && clearSurface(frame, obstacles, placements)) return { annotation, index, target, frame, leader: null, side: "on", placement: "open" };
  }
  return null;
}

/** What a leader costs a reader: its length, and more where it slants. */
function leaderCost(placement) {
  if (!placement) return Infinity;
  if (!placement.leader) return 0;
  const { x1, y1, x2, y2 } = placement.leader, length = Math.hypot(x2 - x1, y2 - y1);
  return length + (Math.abs(x2 - x1) < 1 || Math.abs(y2 - y1) < 1 ? 0 : SLANT_COST + length * 0.25);
}

/** Two segments cross (their interiors meet). */
function segmentsCross([ax, ay, bx, by], [cx, cy, dx, dy]) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (!d) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
}

/**
 * A leader read as the line it is, not the box its diagonal spans: every few
 * pixels of it clear of every obstacle but what touches its own mark - a
 * series line read as its segments, so a leader to the lowest of three lines
 * may not cross the two above it.
 */
function segmentClear(x1, y1, x2, y2, target, obstacles) {
  const length = Math.hypot(x2 - x1, y2 - y1), end = Math.max(0, length - ENDPOINT_DIAMETER / 2 - 2);
  const others = obstacles.filter((node) => !pointInsideFrame(target, node.frame, 1));
  for (let t = 0; t <= end; t += 3) {
    const probe = { x: x1 + (x2 - x1) * t / (length || 1) - 1, y: y1 + (y2 - y1) * t / (length || 1) - 1, width: 2, height: 2 };
    if (others.some((node) => meets(node, probe, 1))) return false;
  }
  return true;
}

/**
 * A box anywhere in the plot's open space, its leader run straight to the mark.
 *
 * Next to its mark is where a note reads best (besidePlacement), but in a
 * cluster - the best room of a scatter among its neighbours, a peak among
 * peaks - every position touching the mark is taken, and the band above the
 * plot was the next resort: 88px off the plot's height, the chart shrunk to
 * make room for a note while the plot's corners stood empty. The open space
 * is searched instead, on a 6px grid across the plot: a box clear of every
 * mark, label, rule and note, joined to its mark by a leader that crosses
 * none of them. The nearest wins, a level or upright leader before a slanted
 * one of the same length; a box over its own mark is never chosen, nor one
 * so near that the leader is a stub. Only a note that has no such place
 * anywhere in the plot takes the band.
 */
const OPEN_MEMO = new Map();
function openPlacement(args) {
  const { annotation, index, target: mark, obstacles, leaderStops, placements, marks = [], bounds } = args;
  // A chart composed again with the same notes, marks and room - the fit search and the proofs compose one page many
  // times - finds the same place: the search is a function of these alone, and of the box the note measures to in the
  // deck's type, which is part of the key so two designs never share a place.
  const { width, height } = evidenceBoxSize(annotation);
  const key = JSON.stringify([annotation, width, height, mark, bounds, obstacles.map((o) => [o.role, o.type, o.frame, o.type === "line" ? o.data : null]), leaderStops.map((o) => [o.role, o.type, o.frame]), placements.map((o) => [o.frame, o.leader]), marks.map((o) => [o.type, o.frame, o.data?.category, o.data?.series])]);
  if (OPEN_MEMO.has(key)) { const hit = OPEN_MEMO.get(key); return hit && { annotation, index, target: mark, frame: { ...hit.frame }, leader: { ...hit.leader }, side: hit.side, placement: "open" }; }
  const found = openPlacementSearch(args);
  if (OPEN_MEMO.size > 5000) OPEN_MEMO.clear();
  OPEN_MEMO.set(key, found && { frame: { ...found.frame }, leader: { ...found.leader }, side: found.side });
  return found;
}

function openPlacementSearch({ annotation, index, target: mark, bounds, obstacles, leaderStops, placements, marks = [] }) {
  const { width, height } = evidenceBoxSize(annotation);
  // From above, the leader lands where a band's would: on the mark's value end, stopping short of its own value label.
  const valueEnd = leaderTarget(mark, leaderStops, annotation);
  // A bar or a step has a body: a box under a floating step, or beside a bar, points at the edge that faces it - the
  // step's underside, the bar's side - rather than crossing its own mark to reach the value end.
  // Its marks by category where the chart keys them, else the one its value end sits on (a bridge's steps carry no keys).
  const keyed = marks.filter((node) => node.type === "rect" && node.data?.category === annotation.category && (annotation.series === undefined || node.data?.series === annotation.series));
  const own = keyed.length ? keyed : marks.filter((node) => node.type === "rect" && node.frame && pointInsideFrame(mark, node.frame, 1)).slice(0, 1);
  const body = own.length ? { x: Math.min(...own.map((n) => n.frame.x)), y: Math.min(...own.map((n) => n.frame.y)), right: Math.max(...own.map((n) => n.frame.x + n.frame.width)), bottom: Math.max(...own.map((n) => n.frame.y + n.frame.height)) } : null;
  // Only the underside, and only its middle: a dot on a column's side or corner leads the reader to the gap between two
  // bars (leaderTarget), so a box beside a mark still points at its value end.
  const endFor = (frame) => {
    if (!body || frame.y < body.bottom + OPEN_LEADER_MIN) return valueEnd;
    const inset = (body.right - body.x) * 0.2, x = Math.max(body.x + inset, Math.min(body.right - inset, Math.max(frame.x + 10, Math.min(frame.x + frame.width - 10, (body.x + body.right) / 2))));
    return x >= frame.x + 10 && x <= frame.x + frame.width - 10 ? { x, y: body.bottom } : valueEnd;
  };
  const taken = placements.filter((placement) => placement.leader).map((placement) => [placement.leader.x1, placement.leader.y1, placement.leader.x2, placement.leader.y2]);
  const stops = [...leaderStops, ...placements.map((placement) => ({ frame: placement.frame }))];
  // Every cell's leader and its cost come from geometry alone, so the cells are ranked by cost (scan order breaking ties,
  // as the scan's strict "cheaper than the best" did) and tested in that order: the first clear cell is the scan's answer.
  const cells = [];
  for (let y = bounds.y; y + height <= bounds.y + bounds.height; y += OPEN_STEP) {
    for (let x = bounds.x; x + width <= bounds.x + bounds.width; x += OPEN_STEP) {
      const frame = { x, y, width, height };
      const target = endFor(frame);
      if (pointInsideFrame(target, frame, OPEN_LEADER_MIN)) continue;
      // The leader leaves the edge facing the mark: straight down or up where the mark is under the box, straight across where
      // it is level with it, from the nearest corner otherwise.
      const under = target.x >= x + 10 && target.x <= x + width - 10, level = target.y >= y + 6 && target.y <= y + height - 6;
      const x1 = under ? target.x : level ? (target.x < x ? x : x + width) : Math.max(x, Math.min(x + width, target.x));
      const y1 = under ? (target.y < y ? y : y + height) : level ? target.y : Math.max(y, Math.min(y + height, target.y));
      const length = Math.hypot(target.x - x1, target.y - y1);
      if (length < OPEN_LEADER_MIN) continue;
      const leader = { x1, y1, x2: target.x, y2: target.y };
      cells.push({ order: cells.length, cost: leaderCost({ leader }), frame, leader, target, side: under ? (target.y < y ? "below" : "above") : level ? (target.x < x ? "right" : "left") : "open" });
    }
  }
  cells.sort((a, b) => a.cost - b.cost || a.order - b.order);
  let best = null;
  for (const cell of cells) {
    const { frame, leader, target } = cell;
    if (!clearSurface(frame, obstacles, placements)) continue;
    if (!segmentClear(leader.x1, leader.y1, target.x, target.y, target, stops) || taken.some((other) => segmentsCross([leader.x1, leader.y1, target.x, target.y], other))) continue;
    best = cell;
    break;
  }
  return best && { annotation, index, target: mark, frame: best.frame, leader: best.leader, side: best.side, placement: "open" };
}

/**
 * Where a callout's leader lands: the mark's centre on the category axis, at
 * its value end - the top-centre of a column, the end-centre of a bar.
 *
 * The target is the point itself, not a corner of the bar: on a page of six
 * columns a dot on a corner leads the reader to the gap between two bars, not
 * to the one the note is about. The leader stops short of the mark's own value
 * label - the label sits on the same centre line directly above the mark, so
 * ending the leader at its top keeps the dot on the mark's axis without
 * striking through the number. The label is
 * found by its category, not only by sitting on the mark: a reference line
 * through a label lifts it clear of the line, and a lifted label is still the
 * one the leader would strike. A negative
 * column's value end is its foot, and a leader from the band above would run
 * down the whole bar to reach it, so it lands on the column's top (the
 * baseline) instead.
 */
function leaderTarget(target, obstacles, annotation) {
  const x = target.x;
  const hanging = obstacles.find((node) => node.role === "chart-mark"
    && x >= node.frame.x && x <= node.frame.x + node.frame.width
    && Math.abs(node.frame.y + node.frame.height - target.y) <= 1 && node.frame.height > 2);
  if (hanging) return { x, y: hanging.frame.y };
  // A range band prints its high value four pixels past its end, level with
  // the centre, so a dot on the end-centre sits on the number. When the mark's
  // own label is closer to the end than the dot's radius, the dot steps back
  // inside the bar by its radius and a gap - still the end of the bar, clear
  // of the figure. (A bar's label keeps a wider gap and needs no step.)
  const reach = ENDPOINT_DIAMETER / 2 + 3;
  const beside = obstacles.find((node) => node.role === "data-label" && node.data?.category === annotation.category
    && target.y >= node.frame.y && target.y <= node.frame.y + node.frame.height
    && (Math.abs(node.frame.x - x) <= ENDPOINT_DIAMETER / 2 + 1 || Math.abs(node.frame.x + node.frame.width - x) <= ENDPOINT_DIAMETER / 2 + 1));
  const stepped = beside && { x: beside.frame.x >= x - 1 ? x - reach : x + reach, y: target.y };
  if (stepped && obstacles.some((node) => node.role === "chart-mark" && pointInsideFrame(stepped, node.frame))) return stepped;
  const ownLabel = obstacles
    .filter((node) => node.role === "data-label"
      && x >= node.frame.x && x <= node.frame.x + node.frame.width
      && node.frame.y + node.frame.height <= target.y + 2
      && (node.data?.category === annotation.category || node.frame.y + node.frame.height >= target.y - 16))
    .sort((a, b) => a.frame.y - b.frame.y)[0];
  return { x, y: ownLabel ? ownLabel.frame.y - ENDPOINT_DIAMETER / 2 - 3 : target.y };
}

function standardPlacement({ annotation, index, target, plot, props, bandIndex, obstacles, placements }) {
  const { x: targetX, y: targetY } = leaderTarget(target, obstacles, annotation);
  const { width, height } = evidenceBoxSize(annotation);
  const frame = {
    x: Math.max(plot.x - 12, Math.min(plot.x + plot.width + 12 - width, targetX - width / 2)),
    y: bandBoxY(plot, props, bandIndex, height),
    width,
    height
  };
  const leader = {
    x1: Math.max(frame.x, Math.min(frame.x + frame.width, targetX)),
    y1: frame.y + frame.height,
    x2: targetX,
    y2: targetY
  };
  if (!clearSurface(frame, obstacles, placements) || !clearLeader(leader.x1, leader.y1, leader.x2, leader.y2, { x: targetX, y: targetY }, leaderObstacles(obstacles, placements))) return null;
  return { annotation, index, target, frame, leader, side: "above", placement: "band" };
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
    fontFamily: tokenValue(token("font.bodySemibold")), fontSize: tokenValue(ANNOTATION), bold: true,
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

function evidenceTextNode(id, index, frame, text, data) {
  const measured = measureText(text, Math.min(EVIDENCE_BOX_WIDTH - EVIDENCE_PAD_X, Math.max(frame.width - 16, 1)), { fontFamily: tokenValue(token("font.bodySemibold")), fontSize: tokenValue(ANNOTATION), bold: true });
  const width = Math.max(frame.width - 16, Math.ceil(measured.width) + 2);
  return textPrimitive({
    id: stableId(id, "annotation-text", index),
    role: "annotation-text",
    frame: { x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - measured.height) / 2, width, height: measured.height },
    text: measured.text,
    style: { ...textStyle(ANNOTATION, INK, true), lineHeight: measured.lineHeight, wrap: false },
    data: { ...data, textLayout: measured }
  });
}

function evidenceNodes(id, placement) {
  const { annotation, index, frame, leader } = placement;
  const callout = annotation.treatment === "callout";
  const dotEnded = annotation.treatment === "orthogonal-dot";
  // `speech` is the filled bubble a strong deck puts on a busy plot, where
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
    targetSeries: annotation.series ?? null,
    ...(placement.placement ? { evidencePlacement: annotation._placement === "rail" ? "rail" : placement.placement, evidenceIndex: index } : {}),
    ...(placement.released ? { evidenceReleased: true } : {}),
    ...(placement.insideOf ? { insideMark: true, category: placement.insideOf.category, ...(placement.insideOf.series !== null ? { series: placement.insideOf.series } : {}) } : {})
  };
  if (speech) return speechNodes(id, placement, data);
  if (callout && styleOf(annotation) !== "box") return styledNodes(id, placement, { ...data, calloutStyle: styleOf(annotation) });
  // Set on its own bar: the text alone, in whichever of the reversed or the
  // ink colour reads on the bar's fill.
  if (placement.textOnly) {
    const fill = placement.textOnly.fill, surface = fill && typeof fill === "object" ? tokenValue(fill) : fill;
    const color = typeof surface === "string" && /^#[0-9a-f]{6}$/i.test(surface) ? onFill(surface) : ON_PRIMARY;
    const layout = placement.textOnly.layout;
    return [textPrimitive({ id: stableId(id, "annotation-text", index), role: "annotation-text", frame, text: layout.text,
      style: { ...textStyle(ANNOTATION, color, true, "right"), lineHeight: layout.lineHeight, wrap: false }, data: { ...data, textLayout: layout } })];
  }
  const nodes = [
    // A callout set inside its own bar has no leader: it sits on its mark.
    ...(leader ? [linePrimitive({
      id: stableId(id, "annotation-leader", index),
      role: "annotation-leader",
      ...leader,
      // A leader points at a mark; it does not attack it. An arrowhead landing
      // on a data point covers the point it is identifying and reads as a
      // second mark on the plot, so every leader ends in the small filled dot
      // the orthogonal treatment already used.
      style: { stroke: callout ? PRIMARY : RULE, lineWidth: callout ? STANDARD : HAIRLINE, dash: "solid" },
      data: { ...data, endArrow: false, endpoint: "dot" }
    })] : []),
    rectPrimitive({
      id: stableId(id, "annotation-box", index),
      role: "annotation-surface",
      frame,
      style: { fill: callout ? SURFACE : PRIMARY_TINT, stroke: annotation.border === false ? "none" : RULE, lineWidth: HAIRLINE, radius: NONE_RADIUS, opacity: 1 },
      data
    }),
    // The box closes on its measured lines, so the text carries those lines
    // rather than re-wrapping in a frame exactly its own width, where a
    // trailing space pushed the last word of a line past the box edge.
    evidenceTextNode(id, index, frame, annotation.text, data)
  ];
  if (leader) nodes.push(ellipsePrimitive({
    id: stableId(id, "annotation-endpoint", index),
    role: "annotation-endpoint",
    frame: { x: leader.x2 - ENDPOINT_DIAMETER / 2, y: leader.y2 - ENDPOINT_DIAMETER / 2, width: ENDPOINT_DIAMETER, height: ENDPOINT_DIAMETER },
    style: { fill: PRIMARY, stroke: PRIMARY, lineWidth: HAIRLINE, opacity: 1 },
    data
  }));
  return nodes;
}


/** The leader and its dot, in a stroke and a weight, or nothing where the note sits on its mark. */
function leaderNodes(id, index, leader, stroke, weight, data) {
  if (!leader) return [];
  return [
    linePrimitive({ id: stableId(id, "annotation-leader", index), role: "annotation-leader", ...leader, style: { stroke, lineWidth: weight, dash: "solid" }, data: { ...data, endArrow: false, endpoint: "dot" } }),
    ellipsePrimitive({ id: stableId(id, "annotation-endpoint", index), role: "annotation-endpoint",
      frame: { x: leader.x2 - ENDPOINT_DIAMETER / 2, y: leader.y2 - ENDPOINT_DIAMETER / 2, width: ENDPOINT_DIAMETER, height: ENDPOINT_DIAMETER },
      style: { fill: stroke, stroke, lineWidth: HAIRLINE, opacity: 1 }, data }),
  ];
}

/** The accent where it reads as text on the canvas, the ink where it does not (a pale accent fails 4.5:1). */
function accentText() {
  return contrastRatio(tokenValue(ACCENT), tokenValue(SURFACE)) >= 4.5 ? ACCENT : INK;
}

/**
 * A callout in one of its styles (CALLOUT_STYLES), drawn in the frame its
 * placement found. A pill or a figure set beside its mark - within a few
 * pixels - drops its leader: it is read as its mark's, as a value label is.
 */
function styledNodes(id, placement, data) {
  const { annotation, index, frame, leader } = placement;
  const style = data.calloutStyle;
  const layout = styleLayout(annotation);
  const reach = leader ? Math.hypot(leader.x2 - leader.x1, leader.y2 - leader.y1) : 0;
  const near = !leader || reach <= LEADER_ADJACENT;
  const text = (key, at, measured, color, bold, align = "center") => textPrimitive({ id: stableId(id, key, index), role: "annotation-text", frame: at, text: measured.text,
    style: { ...textStyle(key === "annotation-figure" ? FIGURE_TYPE : ANNOTATION, color, bold, align), lineHeight: measured.lineHeight, wrap: false }, data: { ...data, textLayout: measured } });
  if (style === "tint") {
    return [...leaderNodes(id, index, leader, PRIMARY, STANDARD, data),
      rectPrimitive({ id: stableId(id, "annotation-box", index), role: "annotation-surface", frame, style: { fill: PRIMARY_TINT, stroke: "none", lineWidth: HAIRLINE, radius: NONE_RADIUS, opacity: 1 }, data }),
      evidenceTextNode(id, index, frame, annotation.text, data)];
  }
  if (style === "plain") {
    const color = accentText();
    return [...leaderNodes(id, index, leader, color, HAIRLINE, data),
      text("annotation-text", { x: frame.x + 2, y: frame.y + 1, width: frame.width - 4, height: layout.text.height }, layout.text, color, true, leader && leader.x1 <= frame.x + 1 ? "left" : leader && leader.x1 >= frame.x + frame.width - 1 ? "right" : "center")];
  }
  if (style === "pill") {
    const ink = onFill(ACCENT);
    return [...(near ? [] : leaderNodes(id, index, leader, SECONDARY, HAIRLINE, data)),
      rectPrimitive({ id: stableId(id, "annotation-box", index), role: "annotation-surface", frame, style: { fill: ACCENT, stroke: ACCENT, lineWidth: HAIRLINE, radius: token("radius.round"), opacity: 1 }, data }),
      text("annotation-text", { x: frame.x + PILL_PAD_X, y: frame.y + (frame.height - layout.text.height) / 2, width: frame.width - 2 * PILL_PAD_X, height: layout.text.height }, layout.text, ink, true)];
  }
  if (style === "figure") {
    const color = accentText();
    return [...(near ? [] : leaderNodes(id, index, leader, SECONDARY, HAIRLINE, data)),
      text("annotation-figure", { x: frame.x + 2, y: frame.y + 1, width: frame.width - 4, height: layout.figure.height }, layout.figure, color, true),
      text("annotation-text", { x: frame.x + 2, y: frame.y + 1 + layout.figure.height, width: frame.width - 4, height: layout.text.height }, layout.text, INK, false)];
  }
  // A bubble: the outlined note with a solid accent tail closing on its mark, while the mark is near; past that reach, a leader.
  const tailed = leader && reach <= TAIL_REACH;
  const nodes = [];
  if (tailed) {
    const horizontal = Math.abs(leader.x1 - frame.x) < 1.5 || Math.abs(leader.x1 - frame.x - frame.width) < 1.5, tail = 14;
    const points = [...(horizontal ? [[leader.x1, leader.y1 - tail / 2], [leader.x1, leader.y1 + tail / 2]] : [[leader.x1 - tail / 2, leader.y1], [leader.x1 + tail / 2, leader.y1]]), [leader.x2, leader.y2]];
    const xs = points.map(([x]) => x), ys = points.map(([, y]) => y), minX = Math.min(...xs), minY = Math.min(...ys);
    const width = Math.max(1, Math.max(...xs) - minX), height = Math.max(1, Math.max(...ys) - minY);
    nodes.push(shapePrimitive({ id: stableId(id, "annotation-tail", index), role: "annotation-surface", geometry: "iconPath", frame: { x: minX, y: minY, width, height },
      style: { fill: ACCENT, stroke: ACCENT, lineWidth: HAIRLINE }, data: { ...data, paths: [{ points: points.map(([x, y]) => [(x - minX) / width, (y - minY) / height]), closed: true }] } }));
  } else nodes.push(...leaderNodes(id, index, leader, ACCENT, HAIRLINE, data));
  nodes.push(rectPrimitive({ id: stableId(id, "annotation-box", index), role: "annotation-surface", frame, style: { fill: SURFACE, stroke: ACCENT, lineWidth: HAIRLINE, radius: NONE_RADIUS, opacity: 1 }, data }),
    evidenceTextNode(id, index, frame, annotation.text, data));
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
  const measured = measureText(props.text, frame.width - 16, { fontFamily: tokenValue(token("font.bodySemibold")), fontSize: tokenValue(ANNOTATION), bold: true });
  // The box's 7px vertical padding closes to a 4px floor before the note is
  // refused; past that the frame cannot hold the note at the annotation size.
  if (measured.height > frame.height - 8) throw new Error(`Chart callout text needs ${Math.ceil(measured.height + 8)}px and its frame has ${Math.floor(frame.height)}px; give the callout more height or shorten the note`);
  // `variant: "speech"` is the filled bubble with a pointed tail a strong
  // deck puts over a chart - an aside in the deck's voice, rather than a
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

/**
 * The width a right-hand annotation rail needs for these callouts: the widest
 * box plus the leader's reach.
 */
function railWidth(annotations) {
  return Math.max(0, ...annotations.map((annotation) => evidenceBoxSize(annotation).width)) + ORTHOGONAL_GAP + 8;
}

/**
 * Place every evidence annotation, falling back as a designer would.
 *
 * The treatment the author chose is tried first and, where it has a clear
 * corridor, is what renders - the geometry is unchanged from before. When it
 * has none the chart tries the other positions in turn rather than failing
 * with a message that recommends a different treatment (which, on a long bar,
 * failed in turn and recommended the first): a band callout tries the box
 * beside its mark; an orthogonal box tries beside, then the band. A callout
 * that fits nowhere in the plot asks the chart for a right-hand annotation
 * rail: the error carries `retry`, which the chart's render loop applies and
 * renders again with the plot narrowed by the rail. Only a note that has no
 * position even in the rail throws for the author.
 *
 * Each placement records where it went (`data.evidencePlacement`) and whether
 * it gave up a band reserved above the plot, so the chart can render once
 * more with that band released instead of leaving an empty stripe.
 */
export function renderEvidenceAnnotations({ id, plot, props, pointMap, obstacles = [], guides = [] }) {
  const annotations = normalizeEvidenceAnnotations(props);
  if (!annotations.length) return { placements: [], nodes: [] };
  annotations.forEach(assertEvidenceTextFits);
  const collisionObstacles = annotationObstacleFrames(obstacles);
  const besideObstacles = annotationObstacleFrames(obstacles, BESIDE_ROLES);
  // The open space is read against everything the chart has drawn so far, the rules and bands set over the marks included.
  const openObstacles = annotationObstacleFrames([...obstacles, ...guides], OPEN_ROLES);
  const leaderStops = annotationObstacleFrames([...obstacles, ...guides], LEADER_ROLES);
  // A box beside its mark may use the chart's whole frame across (the value
  // gutter, the rail) but stays within the plot's height.
  const limits = plot.limits ?? { x: plot.x - 12, y: plot.y, width: plot.width + 24, height: plot.height };
  const besideBounds = { x: limits.x, y: plot.y, width: limits.width, height: plot.height };
  // Each banded callout's band, highest first, from its lane.
  const lanes = bandLanes(props), count = laneCount(lanes);
  const bandOf = new Map(lanes.map((entry) => [entry.index, count - 1 - entry.lane]));
  const placements = [];
  annotations.forEach((annotation, index) => {
    const target = resolveEvidenceAnchor(pointMap, annotation, id);
    const banded = holdsBand(annotation);
    const bandIndex = bandOf.get(index) ?? 0;
    const context = { annotation, index, target, plot, props, bandIndex, obstacles: collisionObstacles, placements };
    const beside = () => besidePlacement({ ...context, bounds: besideBounds, obstacles: besideObstacles });
    const inside = () => insidePlacement({ ...context, marks: obstacles.filter((node) => node.role === "chart-mark") });
    const open = () => openPlacement({ ...context, bounds: plot, obstacles: openObstacles, leaderStops, marks: obstacles.filter((node) => node.role === "chart-mark") });
    // Beside its mark first; where that leader runs long - a box lifted over every taller neighbour - the open space is
    // searched too, and the shorter leader wins.
    const nearest = () => {
      const near = beside();
      if (near && leaderCost(near) <= OPEN_LEADER_MIN * 3) return near;
      const far = open();
      return leaderCost(far) < leaderCost(near) ? far : near;
    };
    // In the plot's free space a callout sits near its mark with a leader - above
    // a short mark, beside a line - or, where its neighbours crowd it, in the
    // plot's open space with a longer leader; never inside a mark that the band
    // would have left clear.
    // A pill or a figure is set on its mark first, as a value label is.
    const onMark = ["pill", "figure"].includes(styleOf(annotation)) ? [() => adjacentPlacement({ ...context, bounds: plot, obstacles: openObstacles, leaderStops })] : [];
    const chain = annotation._placement === "plot" ? [...onMark, nearest]
      : RELEASED_PLACEMENTS.has(annotation._placement)
      ? [...onMark, nearest, inside]
      : annotation.treatment === "orthogonal-dot" && annotation.orientation === "horizontal"
        ? [() => horizontalPlacement(context), beside, inside]
        : annotation.treatment === "orthogonal-dot"
          ? [() => verticalPlacement(context), () => standardPlacement(context), beside, inside]
          : [() => standardPlacement(context), beside, inside];
    let placement = null;
    for (const attempt of chain) if ((placement = attempt())) break;
    if (!placement) {
      // Where a note of this size does have a clear position, with the callouts already placed: the other marks of the same
      // series, each tried as this one was. Said with the refusal, so the author moves the note or cuts one, not guesses.
      const where = () => {
        const prefix = `${annotation.series || "value"}:`, own = [...pointMap.keys()].filter((key) => key.startsWith(prefix));
        const keys = own.length ? own : [...pointMap.keys()].filter((key) => key.startsWith("category:"));
        const taken = new Set(annotations.map((item) => String(item.category)));
        const free = keys.map((key) => key.slice(key.indexOf(":") + 1)).filter((category) => !taken.has(String(category))).filter((category) => {
          const moved = { ...annotation, category };
          const at = { ...context, annotation: moved, target: resolveEvidenceAnchor(pointMap, moved, id) };
          return Boolean(standardPlacement(at) ?? besidePlacement({ ...at, bounds: besideBounds, obstacles: besideObstacles }));
        });
        const placed = placements.length, of = annotations.length;
        return free.length ? ` - with ${placed} of the ${of} callouts placed, a note of this size has a clear position at ${free.slice(0, 8).join(", ")}${free.length > 8 ? ", ..." : ""}`
          : ` - no other mark has a clear position for a note of this size either: the plot has room for ${placed ? `no more than the ${placed} of its ${of} callouts already placed` : "no callout of this size"}`;
      };
      // No room in the plot: this callout takes its band above it after all,
      // and the chart renders again with the plot that much shorter.
      if (annotation._placement === "plot") {
        throw Object.assign(new Error(`${id} has no room in the plot for the callout at ${annotation.category}`), {
          retry: (current) => ({ ...current, annotations: (current.annotations || props.annotations).map((item, at) => { if (at !== index || !item) return item; const { _placement, ...rest } = item; return rest; }) })
        });
      }
      // A banded callout with no way to its mark past a neighbour placed in
      // the plot: every callout goes back to the band, as before, rather than
      // one being pushed into a rail by another's in-plot box.
      if ((props.annotations || []).some((item) => item?._placement === "plot")) {
        throw Object.assign(new Error(`${id} has no clear position for the callout at ${annotation.category} beside the callouts placed in the plot`), {
          retry: (current) => ({ ...current, annotations: (current.annotations || props.annotations).map((item) => { if (item?._placement !== "plot") return item; const { _placement, ...rest } = item; return rest; }) })
        });
      }
      if (annotation._placement !== "rail" && annotation._placement !== "on-bar") {
        const all = props.annotations;
        throw Object.assign(new Error(`${id} has no clear position for the callout at ${annotation.category} above, beside or in a rail beside the plot${where()}; shorten the note, move it to a position that is free, annotate fewer marks, or enlarge the exhibit`), {
          retry: (current) => ({ ...current, annotations: (current.annotations || all).map((item, at) => at === index || item?._placement === "rail" ? { ...item, _placement: "rail" } : item) })
        });
      }
      throw new Error(`${id} has no clear position for the callout at ${annotation.category} above, beside or in a rail beside the plot${where()}; shorten the note, move it to a position that is free, annotate fewer marks, or enlarge the exhibit`);
    }
    placements.push({ ...placement, released: banded && ["beside", "open"].includes(placement.placement) });
  });
  return { placements, nodes: placements.flatMap((placement) => evidenceNodes(id, placement)) };
}

/** The rail width a chart reserves at its right for callouts placed there. */
export function evidenceRailWidth(props = {}) {
  const railed = normalizeEvidenceAnnotations(props).filter((annotation) => annotation._placement === "rail");
  return railed.length ? railWidth(railed) : 0;
}

/**
 * Props with every callout that left its band for a place beside its mark
 * marked as placed there, so the next render reserves no band for it; null
 * when no callout moved. The chart renders once more with these props.
 */
export function releasedEvidenceProps(nodes, props = {}) {
  // A callout's surface, or the text of one drawn with no box (a plain note, a figure).
  const moved = new Set(nodes.filter((node) => ["annotation-surface", "annotation-text"].includes(node.role) && node.data?.evidenceReleased).map((node) => node.data.evidenceIndex));
  if (!moved.size || !Array.isArray(props.annotations)) return null;
  return { ...props, annotations: props.annotations.map((item, index) => moved.has(index) ? { ...item, _placement: "beside" } : item) };
}

/**
 * Props with the callouts that stayed in bands above the plot packed into as
 * few bands as their boxes allow; null when they already are. Two boxes share a
 * band when they do not meet across the plot (a box's position across depends
 * on its mark, not on the plot's height, so the next render keeps it); a box
 * that meets one set lower stays above it, as it was. Stacked one band per
 * callout, two notes over different years took 176px of the plot where one band
 * of 88 held both. The chart renders once more with these props.
 */
export function packedEvidenceProps(nodes, props = {}) {
  if (!Array.isArray(props.annotations)) return null;
  const lanes = bandLanes(props);
  if (lanes.length < 2) return null;
  const boxes = new Map();
  for (const node of nodes) {
    const data = node.data || {};
    if (data.evidencePlacement !== "band" || !Number.isInteger(data.evidenceIndex) || !node.frame) continue;
    const box = boxes.get(data.evidenceIndex);
    const left = Math.min(node.frame.x, box?.left ?? Infinity), right = Math.max(node.frame.x + node.frame.width, box?.right ?? -Infinity);
    boxes.set(data.evidenceIndex, { left, right });
  }
  // Every banded callout must be in its band: one placed elsewhere is
  // released first (releasedEvidenceProps).
  if (lanes.some((entry) => !boxes.has(entry.index))) return null;
  const meets = (a, b) => a.left < b.right + COMPACT_BAND_GAP && b.left < a.right + COMPACT_BAND_GAP;
  const placed = [];
  for (const entry of [...lanes].sort((a, b) => a.lane - b.lane)) {
    const box = boxes.get(entry.index);
    const below = placed.filter((other) => meets(box, other.box));
    placed.push({ index: entry.index, box, lane: below.length ? Math.max(...below.map((other) => other.lane)) + 1 : 0 });
  }
  if (laneCount(placed) >= laneCount(lanes)) return null;
  const laneAt = new Map(placed.map((entry) => [entry.index, entry.lane]));
  return { ...props, annotations: props.annotations.map((item, index) => (laneAt.has(index) ? { ...item, _lane: laneAt.get(index) } : item)) };
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
      // A qualification marked approximate by its sign says so; one in words is read (qualification-says-approximate).
      if (annotation.basis === "approximate-source-readings" && !/[~≈]/.test(annotation.qualification)
        && judged("qualification-says-approximate", annotation.qualification.trim())?.verdict === "unqualified") throw new Error("Approximate interval qualification must explicitly identify approximate readings");
    } else if (!SCALAR_FIGURE.test(annotation.text)) throw new Error("Chart change bubbles require one numeric value; put the measure and period outside the bubble");
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
      const measured = measureText(row.label, 160, { fontFamily: tokenValue(token("font.bodySemibold")), fontSize: tokenValue(ANNOTATION), bold: true });
      if (measured.height > 30) throw new Error("Shorten the annotation rail measure label to one line");
      labelWidth = Math.ceil(measured.width) + 4;
    }
    const categories = new Set();
    const items = row.items.map((item, index) => {
      if (!item || typeof item.category !== "string" || !item.category.trim() || categories.has(item.category)) throw new Error(`Chart annotation rail row ${rowIndex + 1} item ${index + 1} must name a unique category`);
      categories.add(item.category);
      // A bubble carries one scalar, never a metric name or an expression.
      if (typeof item.text !== "string" || !(SCALAR_FIGURE.test(item.text) || item.text.trim() === "N/A")) throw new Error("Annotation rail bubbles require one numeric value (or N/A); move metric names to row labels and separate multiple metrics into rows");
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
    fontFamily: tokenValue(token("font.body")), fontSize: tokenValue(ANNOTATION)
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
  const measured = measureText(text, 120, { fontFamily: tokenValue(token("font.bodySemibold")), fontSize: tokenValue(ANNOTATION), bold: true });
  const width = Math.ceil(measured.width) + 6, height = 20;
  return { x: Math.max(plot.x - 10, Math.min(plot.x + plot.width + 10 - width, centerX - width / 2)), y: centerY - height / 2, width, height };
}

function labelFrame(text, centerX, centerY, plot) {
  const measured = measureText(text, 168, {
    fontFamily: tokenValue(token("font.bodySemibold")),
    fontSize: tokenValue(ANNOTATION),
    bold: true
  });
  const width = Math.max(66, Math.min(180, Math.ceil(measured.width) + 24));
  const height = 34;
  if (measureText(text, width - 20, {
    fontFamily: tokenValue(token("font.bodySemibold")),
    fontSize: tokenValue(ANNOTATION),
    bold: true
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
 * what the chart has actually drawn inside the arrow's horizontal span - marks,
 * data labels, the series lines, the callouts and earlier annotations' shafts
 * and labels - and returns `{ lift, capped }`: the lift that puts the shaft and
 * the bubble above all of them, and whether the plot had the room for it.
 *
 * The ceiling is not the plot's top edge but the top of the band the chart
 * already reserved for change annotations (CHANGE_ANNOTATION_BAND, which the
 * bracket styles draw in): an arrow that has to climb out of a plot full of
 * tall bars climbs into that band rather than sitting on a value label. Where
 * even that is not room enough (`capped`), the change is drawn as a bracket.
 */
function arrowLift({ start, end, plot, obstacles = [], text, band = 0 }) {
  const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x);
  if (right - left < 1) return { lift: 0, capped: false };
  const bubble = labelFrame(text, (start.x + end.x) / 2, (start.y + end.y) / 2, plot);
  const half = bubble.height / 2;
  // A line - the series itself, or an earlier annotation's shaft - is read where it runs inside the span, not as the
  // box around it: a steep series line would otherwise lift the arrow to the top of the plot.
  const clipped = ({ data: d }) => {
    const x1 = Math.max(Math.min(d.x1, d.x2), left), x2 = Math.min(Math.max(d.x1, d.x2), right);
    if (x2 < x1) return null;
    const at = (x) => (d.x2 === d.x1 ? Math.min(d.y1, d.y2) : d.y1 + ((x - d.x1) / (d.x2 - d.x1)) * (d.y2 - d.y1));
    const top = Math.min(at(x1), at(x2)), bottom = d.x2 === d.x1 ? Math.max(d.y1, d.y2) : Math.max(at(x1), at(x2));
    return { x: x1, y: top, width: Math.max(1, x2 - x1), height: Math.max(1, bottom - top) };
  };
  const spans = obstacles
    .filter((node) => ["chart-mark", "data-label", "chart-line", "chart-reference-label", "chart-threshold-label", "annotation-leader", "annotation-surface", "annotation-text"].includes(node.role))
    .map((node) => (node.type === "line" && Number.isFinite(node.data?.x1) ? clipped(node) : node.frame))
    .filter((frame) => frame && frame.x + frame.width > left + 1 && frame.x < right - 1);
  if (!spans.length) return { lift: 0, capped: false };
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
  // `capped`: the plot has no room to lift it clear, and the arrow would still cross what it spans.
  return { lift: Math.max(0, Math.min(lift, headroom)), capped: lift > headroom + 0.5 };
}

export function renderChangeAnnotations({ id, plot, props, pointMap, obstacles = [], arrowOnly = false }) {
  const annotations = normalizeChangeAnnotations(props);
  if (!annotations.length) return [];
  const nodes = [];
  const labels = [];
  // The labels placed so far, which a later arrow keeps clear of as it does their shafts.
  const labelObstacles = () => labels.map((label) => ({ role: "annotation-surface", frame: label.frame }));
  const evidenceBand = evidenceBandSpan(props, { compact: plot.evidenceCompact === true });
  // The band the chart frame already held back above the plot for these
  // annotations; an arrow may climb into it rather than overlap the marks.
  const changeBand = chartAnnotationBands(props).top;

  annotations.forEach((annotation, index) => {
    const start = resolveAnchor(pointMap, annotation.start, id);
    const end = resolveAnchor(pointMap, annotation.end, id);
    if (Math.hypot(end.x - start.x, end.y - start.y) < 20) throw new Error(`${id} change annotation endpoints are too close to show clearly; annotate a longer interval or print the change as a data label`);

    if (annotation.style === "interval-label") {
      if (Math.abs(end.x - start.x) < 20) throw new Error("Qualitative interval needs distinct horizontal category positions");
      const width = Math.min(260, plot.width);
      const measured = measureIntervalLabel(annotation, width);
      if (measured.height > measureIntervalLabel(annotation, 260).height) throw new Error("Qualitative interval label needs the full measured annotation width (260px); widen the chart or shorten the label");
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
    // An arrow between two marks too close for its bubble becomes a bracket
    // over them: the same change, read from a label above the pair instead
    // of from a shaft too short to break around the number.
    let style = annotation.style;
    if (style === "arrow") {
      const probe = arrowLift({ start: { ...start }, end: { ...end }, plot, obstacles: [...obstacles, ...nodes, ...labelObstacles()], text: annotation.text, band: changeBand });
      const s0 = { x: start.x, y: start.y - probe.lift }, e0 = { x: end.x, y: end.y - probe.lift };
      const length = Math.hypot(e0.x - s0.x, e0.y - s0.y), ux = (e0.x - s0.x) / length, uy = (e0.y - s0.y) / length;
      const probeFrame = labelFrame(annotation.text, (s0.x + e0.x) / 2, (s0.y + e0.y) / 2, plot);
      // An arrow the plot cannot lift clear of what it spans would run its shaft or set its label on a mark, a value or a
      // line: the same change is read from a bracket in the band above the plot instead.
      if ((probe.capped && !arrowOnly) || length <= (Math.abs(ux) * probeFrame.width / 2 + Math.abs(uy) * probeFrame.height / 2 + 5) * 2 + 16) style = "bracket";
    }
    if (style === "arrow") {
      // The arrow runs from the first mark to the last and its bubble sits at
      // the midpoint, so on a descending series the bubble lands on whatever
      // the interior categories put there - a bar top, or the value printed
      // above it. Lift the whole arrow until both the shaft and the bubble
      // clear every mark and every printed value in the span.
      const { lift } = arrowLift({ start, end, plot, obstacles: [...obstacles, ...nodes, ...labelObstacles()], text: annotation.text, band: changeBand });
      if (lift > 0) { start.y -= lift; end.y -= lift; }
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      const ux = dx / length;
      const uy = dy / length;
      const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      const frame = labelFrame(annotation.text, midpoint.x, midpoint.y, plot);
      const gap = Math.abs(ux) * frame.width / 2 + Math.abs(uy) * frame.height / 2 + 5;
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
    nodes.push(line(id, index, "span", leftX, bracketY, rightX, bracketY, false, style));
    nodes.push(line(id, index, "start-drop", start.x, bracketY, start.x, start.y, false, style));
    nodes.push(line(id, index, "end-drop", end.x, bracketY, end.x, end.y, style === "construction", style));
    // A bracket's label may slide along its own span to clear a neighbour's.
    labels.push({ frame, annotation: style === annotation.style ? annotation : { ...annotation, style }, index, span: [leftX, rightX] });
  });

  // Neighbouring brackets whose labels meet slide them apart along their own
  // spans (a label stays over the interval it names) rather than failing.
  const movable = labels.filter(label => label.span).sort((a, b) => a.frame.x - b.frame.x);
  for (let i = 1; i < movable.length; i += 1) {
    const previous = movable[i - 1], current = movable[i];
    // Intervals that overlap draw their brackets through each other; no slide separates those.
    if (!overlaps(previous.frame, current.frame) || Math.max(previous.span[0], current.span[0]) <= Math.min(previous.span[1], current.span[1]) + 1) continue;
    const shift = previous.frame.x + previous.frame.width + 7 - current.frame.x;
    const room = (label, dx) => { const centre = label.frame.x + dx + label.frame.width / 2; return centre >= label.span[0] && centre <= label.span[1] && label.frame.x + dx >= plot.x - 10 && label.frame.x + dx + label.frame.width <= plot.x + plot.width + 10; };
    const half = shift / 2;
    if (room(current, half) && room(previous, -half)) { current.frame = { ...current.frame, x: current.frame.x + half }; previous.frame = { ...previous.frame, x: previous.frame.x - half }; }
    else if (room(current, shift)) current.frame = { ...current.frame, x: current.frame.x + shift };
    else if (room(previous, -shift)) previous.frame = { ...previous.frame, x: previous.frame.x - shift };
  }
  for (let index = 0; index < labels.length; index += 1) {
    for (let peer = index + 1; peer < labels.length; peer += 1) {
      if (overlaps(labels[index].frame, labels[peer].frame)) throw new Error("Chart change annotation labels overlap even after sliding along their brackets (overlapping intervals cannot share the band); widen the exhibit, shorten the labels, or annotate intervals that do not overlap");
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
      bold: true
    });
    const width = Math.min(labelSpan - 10, Math.max(52, Math.ceil(measured.width) + 20));
    if (width < 48 || measured.height > annotationRailLineHeight()) throw new Error(`Annotation rail text for ${item.category} does not fit its category span; shorten the value or show fewer categories`);
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

/** Whether an evidence callout's text fits its box: the renderer's own measure, for the page-type compiler. */
export function calloutFits(text) {
  return measureEvidenceText({ text: String(text ?? "") }).height <= EVIDENCE_BOX_HEIGHT - EVIDENCE_PAD_Y;
}

// The prose `calloutCapacity` fills a box with: ordinary words of ordinary length.
const CAPACITY_WORDS = "the operator added capacity on the busiest routes before demand returned in full".split(" ");
/**
 * How many words of ordinary prose a chart callout holds, by the renderer's
 * own measure. Every message that tells an author how long a callout may run
 * reads this number, so the catalogue, the compile refusal and the variety
 * repairs cannot drift from the box.
 */
export function calloutCapacity() {
  let n = 1;
  while (n < 40 && calloutFits(Array.from({ length: n + 1 }, (_, i) => CAPACITY_WORDS[i % CAPACITY_WORDS.length]).join(" "))) n += 1;
  return n;
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
  "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
/** A small count as a page prints it in prose: "ten", past twenty the figure. */
export const countInWords = (n) => NUMBER_WORDS[n] ?? String(n);
