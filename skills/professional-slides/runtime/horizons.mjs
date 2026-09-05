import {
  linePrimitive,
  stableId,
  textPrimitive,
  token,
  tokenValue
} from "./core.mjs";
import { measureText } from "./text-layout.mjs";

const BODY_FONT = token("font.body");
const INK = token("color.ink");
const SECONDARY = token("color.textSecondary");
const PRIMARY = token("color.componentPrimary");
const STANDARD = token("line.standard");
const BODY = token("type.body");
const HEADING = token("type.heading");
const SERIES = [
  token("color.chartSeries1"),
  token("color.chartSeries2"),
  token("color.chartSeries3"),
  token("color.chartSeries4"),
  token("color.chartSeries5"),
  token("color.chartSeries6")
];
const DEFAULT_CURVE_COLORS = Object.freeze([5, 0, 1, 2, 3, 4]);
const VARIANT_CAPACITY = Object.freeze({ curves: 5, stepped: 5, "stepped-minimal": 10 });

export const HORIZONS_TOKENS = Object.freeze([
  "font.body",
  "type.heading",
  "type.body",
  "type.label",
  "color.ink",
  "color.textSecondary",
  "color.componentPrimary",
  "color.rule",
  "line.hairline",
  "line.standard",
  "space.3",
  ...SERIES.map(item => item.tokenId)
]);

const CURVE_SAMPLE_HORIZONS = Object.freeze([
  Object.freeze({ id: "horizon-1", label: "Horizon 1", title: "Strengthen core", description: "Improve core economics." }),
  Object.freeze({ id: "horizon-2", label: "Horizon 2", title: "Scale growth plays", description: "Scale proven opportunities." }),
  Object.freeze({ id: "horizon-3", label: "Horizon 3", title: "Create options", description: "Explore future options." })
]);

const STEPPED_SAMPLE_HORIZONS = Object.freeze(CURVE_SAMPLE_HORIZONS.map((item, index) => Object.freeze({
  ...item,
  timeframe: ["Near term", "Medium term", "Long term"][index],
  details: Object.freeze([{ label: "Focus", value: ["Core performance", "Repeatable growth", "Option creation"][index] }])
})));

const MINIMAL_SAMPLE_HORIZONS = Object.freeze(CURVE_SAMPLE_HORIZONS.map((item, index) => Object.freeze({
  id: item.id,
  label: item.label,
  title: item.title,
  timeframe: ["2026-27", "2027-28", "2028+"][index],
  summary: item.description
})));

export const HORIZONS_VARIANTS = Object.freeze({
  curves: Object.freeze({}),
  stepped: Object.freeze({ props: Object.freeze({ xLabel: undefined, yLabel: undefined, horizons: STEPPED_SAMPLE_HORIZONS }) }),
  "stepped-minimal": Object.freeze({ props: Object.freeze({ xLabel: undefined, yLabel: undefined, horizons: MINIMAL_SAMPLE_HORIZONS }) })
});

export const HORIZONS_SAMPLE = Object.freeze({
  variant: "curves",
  xLabel: "Time",
  yLabel: "Value",
  horizons: CURVE_SAMPLE_HORIZONS
});

function textStyle(fontSize = BODY, color = INK, bold = false, align = "left", valign = "top") {
  return { fontFamily: BODY_FONT, fontSize, color, bold, align, valign };
}

function measuredTextNode({ id, role, frame, text, style, data = {} }) {
  const textLayout = measureText(text, frame.width, {
    fontFamily: tokenValue(style.fontFamily),
    fontSize: tokenValue(style.fontSize),
    bold: style.bold,
    wrapWidthRatio: 1
  });
  if (textLayout.height > frame.height) throw new Error(`${id} exceeds its allocated text height`);
  return textPrimitive({
    id,
    role,
    frame,
    text: textLayout.text,
    style: { ...style, lineHeight: textLayout.lineHeight, wrap: false },
    data: { ...data, textLayout }
  });
}

function finiteUnitInterval(value, path) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${path} must be between zero and one`);
  return value;
}

export function resolveHorizonsVariant(props = {}) {
  const variant = props.variant ?? "curves";
  if (!Object.hasOwn(HORIZONS_VARIANTS, variant)) throw new Error(`Unknown horizons variant: ${variant}`);
  return variant;
}

function normalizedHorizons(props) {
  const variant = resolveHorizonsVariant(props);
  for (const key of ["xLabel", "yLabel"]) if (props[key] !== undefined && (typeof props[key] !== "string" || !props[key].trim())) throw new Error(`${key} must be a nonempty string`);
  if (variant !== "curves" && (props.xLabel !== undefined || props.yLabel !== undefined)) throw new Error(`${variant} does not accept xLabel or yLabel; only the curve variant renders axes`);
  if (!Array.isArray(props.horizons)) throw new Error("Horizons chart requires a horizons array");
  if (props.horizons.length < 2) throw new Error("Horizons chart requires at least two horizons");
  if (props.horizons.length > VARIANT_CAPACITY[variant]) {
    throw new Error(`${variant} supports at most ${VARIANT_CAPACITY[variant]} horizons; use stepped-minimal or split the exhibit`);
  }
  const ids = new Set();
  const horizons = props.horizons.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`horizons[${index}] must be an object`);
    const id = String(item.id || "").trim();
    const label = String(item.label || "").trim();
    if (!id || !label) throw new Error(`horizons[${index}] requires nonempty id and label`);
    if (ids.has(id)) throw new Error(`Horizons chart has duplicate id: ${id}`);
    ids.add(id);
    for (const key of ["title", "timeframe", "summary", "description"]) {
      if (item[key] !== undefined && typeof item[key] !== "string") throw new Error(`horizons[${index}].${key} must be a string`);
    }
    if (item.colorIndex !== undefined && (!Number.isInteger(item.colorIndex) || item.colorIndex < 0 || item.colorIndex >= SERIES.length)) {
      throw new Error(`horizons[${index}].colorIndex must identify a registered chart colour`);
    }
    const details = item.details ?? [];
    if (!Array.isArray(details) || details.length > 4 || details.some(detail => !detail || typeof detail !== "object" || Array.isArray(detail)
      || typeof detail.label !== "string" || !detail.label.trim() || typeof detail.value !== "string" || !detail.value.trim())) {
      throw new Error(`horizons[${index}].details must contain zero to four labelled values`);
    }
    if (variant === "curves" && (String(item.timeframe || "").trim() || String(item.summary || "").trim() || details.length)) throw new Error(`horizons[${index}] uses stepped-only timeframe, summary or details in the curve variant`);
    if (variant === "stepped" && String(item.summary || "").trim()) throw new Error(`horizons[${index}].summary is only available in stepped-minimal`);
    if (variant === "stepped-minimal" && details.length) throw new Error(`horizons[${index}].details are not available in stepped-minimal`);
    if (variant !== "curves" && ["start", "end", "colorIndex"].some(key => item[key] !== undefined)) throw new Error(`horizons[${index}] start, end and colorIndex are available only in curves`);
    const start = item.start === undefined ? index / (props.horizons.length * 1.05) : finiteUnitInterval(item.start, `horizons[${index}].start`);
    const end = item.end === undefined ? Math.min(1, start + 1.15 / props.horizons.length) : finiteUnitInterval(item.end, `horizons[${index}].end`);
    if (end <= start) throw new Error(`horizons[${index}].end must be greater than start`);
    return {
      id,
      label,
      title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : label,
      timeframe: typeof item.timeframe === "string" ? item.timeframe.trim() : "",
      summary: typeof item.summary === "string" ? item.summary.trim() : "",
      description: typeof item.description === "string" ? item.description.trim() : "",
      details: details.map(detail => ({ label: detail.label.trim(), value: detail.value.trim() })),
      colorIndex: item.colorIndex ?? DEFAULT_CURVE_COLORS[index % DEFAULT_CURVE_COLORS.length],
      start,
      end
    };
  });
  for (let index = 1; index < horizons.length; index++) {
    if (horizons[index].start < horizons[index - 1].start) throw new Error("Horizon starts must follow the declared array order");
  }
  return { variant, horizons };
}

function renderCurves({ id, frame, props, horizons }) {
  if (frame.width < 560 || frame.height < 300) throw new Error("Curve horizons require at least a 560 by 300 frame");
  const nodes = [];
  const plot = { x: frame.x + 88, y: frame.y + 18, width: frame.width - 116, height: frame.height - 62 };
  const bottom = plot.y + plot.height;
  nodes.push(
    linePrimitive({
      id: stableId(id, "axis", "x"), role: "horizon-axis", x1: plot.x, y1: bottom, x2: plot.x + plot.width, y2: bottom,
      style: { stroke: INK, lineWidth: STANDARD },
      data: { axis: "x", endArrow: true, endArrowType: "triangle", label: props.xLabel || "Time" }
    }),
    linePrimitive({
      id: stableId(id, "axis", "y"), role: "horizon-axis", x1: plot.x, y1: bottom, x2: plot.x, y2: plot.y,
      style: { stroke: INK, lineWidth: STANDARD },
      data: { axis: "y", endArrow: true, endArrowType: "triangle", label: props.yLabel || "Value" }
    }),
    measuredTextNode({ id: stableId(id, "axis-label", "x"), role: "axis-label", frame: { x: plot.x + plot.width - 90, y: bottom + 12, width: 90, height: 28 }, text: props.xLabel || "Time", style: textStyle(HEADING, INK, true, "right", "top"), data: { axis: "x" } }),
    measuredTextNode({ id: stableId(id, "axis-label", "y"), role: "axis-label", frame: { x: frame.x, y: plot.y + 2, width: 74, height: 28 }, text: props.yLabel || "Value", style: textStyle(HEADING, INK, true, "right", "top"), data: { axis: "y" } })
  );

  const bandHeight = plot.height * 0.94 / horizons.length;
  horizons.forEach((horizon, index) => {
    const startX = plot.x + horizon.start * plot.width;
    const endX = plot.x + horizon.end * plot.width;
    const baseY = bottom - index * bandHeight;
    const peakY = bottom - (index + 1) * bandHeight;
    const segments = 18;
    for (let segment = 0; segment < segments; segment++) {
      const u1 = segment / segments;
      const u2 = (segment + 1) / segments;
      const rise = u => 1 - Math.pow(1 - u, 2.35);
      nodes.push(linePrimitive({
        id: stableId(id, horizon.id, "curve", segment),
        role: "horizon-curve",
        x1: startX + (endX - startX) * u1,
        y1: baseY - (baseY - peakY) * rise(u1),
        x2: startX + (endX - startX) * u2,
        y2: baseY - (baseY - peakY) * rise(u2),
        style: { stroke: SERIES[horizon.colorIndex], lineWidth: STANDARD },
        data: { horizonId: horizon.id, order: index + 1, segment, start: horizon.start, end: horizon.end }
      }));
    }
    const span = endX - startX;
    if (span < 96) throw new Error(`${horizon.id} leaves insufficient horizontal curve span; widen its start and end interval or enlarge the exhibit`);
    const annotationX = startX + span * 0.4;
    const annotationWidth = Math.max(92, span - (annotationX - startX) - 12);
    const labelY = Math.max(frame.y, peakY - 28);
    nodes.push(measuredTextNode({
      id: stableId(id, horizon.id, "label"), role: "horizon-label",
      frame: { x: startX + 8, y: labelY, width: Math.max(88, span - 16), height: 28 },
      text: horizon.label,
      style: textStyle(HEADING, SERIES[horizon.colorIndex], true),
      data: { horizonId: horizon.id, order: index + 1 }
    }));
    const titleY = baseY - bandHeight * 0.66;
    nodes.push(measuredTextNode({
      id: stableId(id, horizon.id, "title"), role: "horizon-title",
      frame: { x: annotationX, y: titleY, width: annotationWidth, height: 24 },
      text: horizon.title,
      style: textStyle(BODY, INK, true),
      data: { horizonId: horizon.id, order: index + 1 }
    }));
    if (horizon.description) {
      nodes.push(measuredTextNode({
        id: stableId(id, horizon.id, "description"), role: "horizon-description",
        frame: { x: annotationX, y: titleY + 24, width: annotationWidth, height: Math.max(22, baseY - titleY - 26) },
        text: horizon.description,
        style: textStyle(BODY, INK),
        data: { horizonId: horizon.id, order: index + 1 }
      }));
    }
  });
  return nodes;
}

function renderDetailRow({ id, horizon, index, frame, label, value }) {
  const labelLayout = measureText(`${label}:`, frame.width, { fontFamily: tokenValue(BODY_FONT), fontSize: tokenValue(BODY), bold: true, wrapWidthRatio: 1 });
  const labelWidth = Math.min(frame.width * 0.48, labelLayout.width + 5);
  if (frame.width - labelWidth < 24) throw new Error(`${id} detail label leaves insufficient value width`);
  return [
    measuredTextNode({ id: stableId(id, horizon.id, "detail-label", index), role: "horizon-detail-label", frame: { ...frame, width: labelWidth }, text: `${label}:`, style: textStyle(BODY, INK, true), data: { horizonId: horizon.id, detail: label } }),
    measuredTextNode({ id: stableId(id, horizon.id, "detail-value", index), role: "horizon-detail-value", frame: { x: frame.x + labelWidth, y: frame.y, width: frame.width - labelWidth, height: frame.height }, text: value, style: textStyle(BODY, INK), data: { horizonId: horizon.id, detail: label } })
  ];
}

function renderStepped({ id, frame, horizons, minimal }) {
  if (frame.width < 520 || frame.height < 260) throw new Error("Stepped horizons require at least a 520 by 260 frame");
  const nodes = [];
  const gutter = 24;
  const sectionGap = tokenValue(token("space.3"));
  const columnWidth = (frame.width - gutter * (horizons.length - 1)) / horizons.length;
  if (columnWidth < 72) throw new Error("Stepped horizons leave insufficient width per horizon; enlarge or split the exhibit");
  const contentReserve = minimal ? 92 : 180;
  const rise = Math.min(66, frame.height * 0.14, (frame.height - 22 - contentReserve) / Math.max(1, horizons.length - 1));
  if (rise < 14) throw new Error("Stepped horizons leave insufficient vertical progression; enlarge or split the exhibit");
  const top = frame.y + 22;
  horizons.forEach((horizon, index) => {
    const x = frame.x + index * (columnWidth + gutter);
    const lineY = top + (horizons.length - 1 - index) * rise;
    nodes.push(linePrimitive({
      id: stableId(id, horizon.id, "step"), role: "horizon-step-line",
      x1: x, y1: lineY, x2: x + columnWidth, y2: lineY,
      style: { stroke: PRIMARY, lineWidth: STANDARD },
      data: { horizonId: horizon.id, order: index + 1, minimal }
    }));
    let cursor = lineY + 18;
    const bottom = frame.y + frame.height;
    nodes.push(measuredTextNode({
      id: stableId(id, horizon.id, "title"), role: "horizon-title",
      frame: { x: x + 8, y: cursor, width: columnWidth - 16, height: 28 },
      text: horizon.title,
      style: textStyle(HEADING, INK, true),
      data: { horizonId: horizon.id, order: index + 1, label: horizon.label }
    }));
    cursor += 28;
    if (horizon.timeframe) {
      nodes.push(measuredTextNode({
        id: stableId(id, horizon.id, "timeframe"), role: "horizon-timeframe",
        frame: { x: x + 8, y: cursor, width: columnWidth - 16, height: 24 },
        text: horizon.timeframe,
        style: textStyle(BODY, SECONDARY),
        data: { horizonId: horizon.id, order: index + 1 }
      }));
      cursor += !minimal && horizon.details.length ? 24 : 28;
    }
    if (!minimal) {
      if (horizon.details.length) cursor += sectionGap;
      horizon.details.forEach((detail, detailIndex) => {
        nodes.push(...renderDetailRow({ id, horizon, index: detailIndex, frame: { x: x + 8, y: cursor, width: columnWidth - 16, height: 24 }, label: detail.label, value: detail.value }));
        cursor += detailIndex === horizon.details.length - 1 ? 24 : 26;
      });
      if (horizon.details.length) cursor += sectionGap;
    }
    const narrative = minimal ? (horizon.summary || horizon.description) : horizon.description;
    if (narrative) {
      const available = bottom - cursor - 6;
      if (available < 24) throw new Error(`${horizon.id} has no room for its horizon narrative`);
      nodes.push(measuredTextNode({
        id: stableId(id, horizon.id, minimal ? "summary" : "description"),
        role: minimal ? "horizon-summary" : "horizon-description",
        frame: { x: x + 8, y: cursor, width: columnWidth - 16, height: available },
        text: narrative,
        style: textStyle(BODY, INK),
        data: { horizonId: horizon.id, order: index + 1, minimal }
      }));
    }
  });
  return nodes;
}

export function renderHorizons({ id, frame, props = {} }) {
  const { variant, horizons } = normalizedHorizons(props);
  if (variant === "curves") return renderCurves({ id, frame, props, horizons });
  return renderStepped({ id, frame, props, horizons, minimal: variant === "stepped-minimal" });
}
