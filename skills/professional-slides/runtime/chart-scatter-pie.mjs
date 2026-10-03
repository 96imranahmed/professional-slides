// Scatter and bubble charts (`scatter`: points on two value axes, with
// quadrants, a legend for grouped points and sized bubbles) and the
// part-to-whole charts, pie and donut (`partToWhole`, with its legend variants).
import { linePrimitive, rectPrimitive, stableId, textPrimitive, token, ellipsePrimitive, tokenDefinition, tokenValue, TOKENS,
  chartAnnotationStyle, wedgePrimitive, onFill } from "./core.mjs";
import { ENGINE_RESERVE, measureText } from "./text-layout.mjs";
import { legendRowCount, legendNodes } from "./legends.mjs";
import { contrastRatio } from "./color.mjs";
import { SECONDARY, CHART_ANNOTATION, textStyle, lineStyle, topLegend, tickCount, FONT, INK, CHART_LABEL, AXIS_LABEL, SERIES, MIN_PLOT_HEIGHT,
  markWeight, chartFrame, fillStyle, assertGridlineOption, numericBounds, axisTickText, axes, labelBold } from "./chart-axes.mjs";
import { chartAnnotationBands, evidenceAnnotationTopBandCount } from "./chart-annotations.mjs";
import { withReferenceValues, withDecorations } from "./chart-decorations.mjs";

const SCATTER_QUADRANT_STYLES = Object.freeze(["threshold-lines", "alternating-tint", "focus-tint"]);
const SCATTER_QUADRANT_KEYS = Object.freeze(["topLeft", "topRight", "bottomLeft", "bottomRight"]);

function normalizedQuadrants(quadrants, xBounds, yBounds) {
  if (quadrants === undefined) return null;
  if (!quadrants || typeof quadrants !== "object" || Array.isArray(quadrants)) throw new Error("Scatter quadrants must be an object");
  const style = quadrants.style ?? "threshold-lines";
  if (!SCATTER_QUADRANT_STYLES.includes(style)) throw new Error(`Unknown scatter quadrant style: ${style}`);
  if (!Number.isFinite(quadrants.x) || quadrants.x <= xBounds.min || quadrants.x >= xBounds.max) throw new Error("Scatter quadrant x threshold must sit inside the x bounds");
  if (!Number.isFinite(quadrants.y) || quadrants.y <= yBounds.min || quadrants.y >= yBounds.max) throw new Error("Scatter quadrant y threshold must sit inside the y bounds");
  const titles = quadrants.titles ?? {};
  if (!titles || typeof titles !== "object" || Array.isArray(titles) || Object.keys(titles).some(key => !SCATTER_QUADRANT_KEYS.includes(key)) || Object.values(titles).some(value => typeof value !== "string" || !value.trim())) throw new Error("Scatter quadrant titles must use non-empty named quadrant labels");
  if (quadrants.xLabel !== undefined && (typeof quadrants.xLabel !== "string" || !quadrants.xLabel.trim())) throw new Error("Scatter x threshold label must be non-empty text");
  const focus = quadrants.focus ?? "topRight";
  if (style === "focus-tint" && !SCATTER_QUADRANT_KEYS.includes(focus)) throw new Error("Scatter focus quadrant must name a valid quadrant");
  return { x: quadrants.x, y: quadrants.y, style, titles, focus, xLabel: quadrants.xLabel };
}

function scatterQuadrantNodes({ id, plot, quadrants, xScale, yScale }) {
  if (!quadrants) return [];
  const splitX = xScale(quadrants.x);
  const splitY = yScale(quadrants.y);
  const frames = {
    topLeft: { x: plot.x, y: plot.y, width: splitX - plot.x, height: splitY - plot.y },
    topRight: { x: splitX, y: plot.y, width: plot.x + plot.width - splitX, height: splitY - plot.y },
    bottomLeft: { x: plot.x, y: splitY, width: splitX - plot.x, height: plot.y + plot.height - splitY },
    bottomRight: { x: splitX, y: splitY, width: plot.x + plot.width - splitX, height: plot.y + plot.height - splitY }
  };
  const nodes = [];
  const tinted = quadrants.style === "alternating-tint" ? ["topLeft", "bottomRight"] : quadrants.style === "focus-tint" ? [quadrants.focus] : [];
  for (const key of tinted) nodes.push(rectPrimitive({
    id: stableId(id, "quadrant", key), role: "chart-quadrant", frame: frames[key],
    style: { fill: quadrants.style === "focus-tint" ? token("color.componentPrimaryTint") : token("color.surfaceMuted"), stroke: "none", lineWidth: token("line.hairline"), opacity: 0.72 },
    data: { quadrant: key, quadrantStyle: quadrants.style }
  }));
  nodes.push(linePrimitive({ id: stableId(id, "quadrant", "vertical"), role: "chart-threshold-line", x1: splitX, y1: plot.y, x2: splitX, y2: plot.y + plot.height, style: lineStyle(token("color.rule"), token("line.hairline")), data: { thresholdAxis: "x", threshold: quadrants.x } }));
  nodes.push(linePrimitive({ id: stableId(id, "quadrant", "horizontal"), role: "chart-threshold-line", x1: plot.x, y1: splitY, x2: plot.x + plot.width, y2: splitY, style: lineStyle(token("color.rule"), token("line.hairline")), data: { thresholdAxis: "y", threshold: quadrants.y } }));
  for (const key of SCATTER_QUADRANT_KEYS) {
    const title = quadrants.titles[key];
    if (!title) continue;
    const region = frames[key];
    nodes.push(textPrimitive({
      id: stableId(id, "quadrant-title", key), role: "chart-quadrant-title",
      frame: { x: region.x + 8, y: region.y + 6, width: Math.max(1, region.width - 16), height: 22 }, text: title,
      style: textStyle(CHART_ANNOTATION, SECONDARY, true, key.endsWith("Right") ? "right" : "left"),
      data: { quadrant: key, quadrantStyle: quadrants.style }
    }));
  }
  return nodes;
}

function scatterLegend({ id, frame, props, bubble, seriesNames }) {
  if (props.legend === false) return [];
  const items = seriesNames.length > 1 ? seriesNames.map((name, index) => ({ label: name, colorIndex: props.colorIndices?.[index] ?? index })) : [];
  if (props.sizeLegend !== undefined) {
    if (!bubble) throw new Error("Only bubble charts accept a size legend");
    if (!props.sizeLegend || typeof props.sizeLegend !== "object" || typeof props.sizeLegend.label !== "string" || !props.sizeLegend.label.trim()) throw new Error("Bubble size legend requires a non-empty label");
    const markerSize = props.sizeLegend.markerSize ?? 16;
    items.push({ label: props.sizeLegend.label, colorIndex: 0, color: token("color.surfaceMuted"), stroke: token("color.rule"), markerSize });
  }
  return topLegend({ id: stableId(id, "legend"), frame, items, variant: "marker" });
}

function scaleTicks(scale, bounds) {
  const count = Number.isFinite(scale?.step) && scale.step > 0 ? bounds.span / scale.step : NaN;
  return Number.isInteger(Math.round(count * 1e6) / 1e6) && count >= 2 && count <= 10 ? Math.round(count) : tickCount(bounds.min, bounds.max);
}

/**
 * A scatter or bubble chart: its options read, the plot framed, the two
 * scales set, then the axes, the points, the joined series and the points'
 * labels drawn in that order, sharing one record (`chart`) the way
 * categoricalChart's steps do.
 */
export function scatter({ id, frame, props, bubble = false }) {
  const chart = { id, frame, props, bubble };
  Object.assign(chart, scatterOptions(chart));
  Object.assign(chart, scatterPlot(chart));
  Object.assign(chart, scatterScales(chart));
  Object.assign(chart, scatterAxes(chart));
  Object.assign(chart, drawScatterPoints(chart));
  Object.assign(chart, drawConnectedSeries(chart));
  placeScatterLabels(chart);
  const { nodes, plot, pointMap, categoryMap, yScale } = chart;
  // `referenceLines` on the value axis: the break-even, the parity line, the
  // 50% hurdle a curve is read against.
  return withDecorations(nodes, { id, plot, props, pointMap, categoryMap, yScale, allowAnnotationRail: false });
}

/** The points checked, and what the props decide: the focus, the series, whether they are joined and named at their ends, and the legend. */
function scatterOptions(chart) {
  const { props, bubble } = chart;
  assertGridlineOption(props);
  if (!Array.isArray(props.points) || !props.points.length || props.points.some(point => !point || typeof point.name !== "string" || !point.name.trim() || !Number.isFinite(point.x) || !Number.isFinite(point.y))) throw new Error("Scatter charts require named points with finite x and y values");
  if (new Set(props.points.map(point => point.name)).size !== props.points.length) throw new Error("Scatter point names must be unique");
  if (bubble && props.points.some(point => !Number.isFinite(point.size) || point.size <= 0)) throw new Error("Bubble charts require a positive finite size for every point");
  if (!bubble && props.sizeLegend !== undefined) throw new Error("Only bubble charts accept a size legend");
  // `focus: ["name", ...]` sets the named points in the accent and the rest in
  // the comparator grey. Without it the one observation a page is about looks
  // exactly like the eight it is measured against, and the reader has to find
  // it by reading labels.
  const focus = props.focus === undefined ? [] : Array.isArray(props.focus) ? props.focus : [props.focus];
  if (focus.some(name => typeof name !== "string" || !props.points.some(point => point.name === name))) {
    throw new Error("Scatter focus must name exact points on the chart");
  }
  if (focus.length && focus.length === props.points.length) {
    throw new Error("Scatter focus marks the points a page is about; marking every point marks none");
  }
  const focused = new Set(focus);
  const declaredSeries = props.points.filter(point => typeof point.series === "string" && point.series.trim()).length;
  if (declaredSeries && declaredSeries !== props.points.length) throw new Error("Scatter points must either all declare a series or all use the default series");
  const seriesNames = [...new Set(props.points.map(point => point.series).filter(value => typeof value === "string" && value.trim()))];
  // `connect: true` joins each series' points in x order: a curve computed
  // from a formula, or one measure swept across another, is a line, and as
  // loose dots it reads as a sample of observations. Connected series carry
  // their names at their right-hand ends, so they need no key.
  if (props.connect !== undefined && typeof props.connect !== "boolean") throw new Error("Scatter connect is true or false");
  const connected = props.connect === true;
  const seriesEnds = connected && seriesNames.length > 1 && props.seriesLabels !== false;
  // Points coloured by series are read against the names of the series: a
  // key, or the names at the ends of connected series. With neither, three
  // colours of dot say nothing about which is which.
  if (seriesNames.length > 1 && !focus.length && props.legend === false && !seriesEnds)
    throw new Error(`The scatter colours ${seriesNames.length} series (${seriesNames.join(", ")}) and names none of them; keep its legend, or connect each series (connect: true) so its name sits at its end`);
  const showLegend = props.legend !== false && !seriesEnds && (seriesNames.length > 1 || props.sizeLegend !== undefined);
  // Named series ends sit in a gutter right of the plot, as a line chart's do,
  // clear of the curves they name.
  const endFace = { fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL), bold: true };
  const endGutter = seriesEnds ? Math.ceil(Math.max(...seriesNames.map((name) => measureText(name, 400, endFace).width))) + 18 : 0;
  return { focus, focused, seriesNames, connected, seriesEnds, showLegend, endFace, endGutter };
}

/** The plot inside the frame, after the legend, the x threshold's label and the axis titles. */
function scatterPlot(chart) {
  const { frame, props, showLegend, endGutter } = chart;
  let plot = chartFrame(frame, {
    topInset: props.plotTopInset,
    topLegend: showLegend,
    annotations: props.annotations,
    changeAnnotations: props.changeAnnotations,
    annotationRail: props.annotationRail,
    valueLabelInset: endGutter
  });
  let thresholdLabelLayout = null;
  if (props.quadrants?.xLabel !== undefined) {
    if (typeof props.quadrants.xLabel !== "string" || !props.quadrants.xLabel.trim()) throw new Error("Scatter x threshold label must be non-empty text");
    thresholdLabelLayout = measureText(props.quadrants.xLabel, Math.min(220, plot.width), { fontSize: tokenValue(CHART_ANNOTATION), bold: true, wrapWidthRatio: ENGINE_RESERVE });
    const occupiedTop = showLegend || evidenceAnnotationTopBandCount({ annotations: props.annotations || [] }) || chartAnnotationBands({ changeAnnotations: props.changeAnnotations || [], annotationRail: props.annotationRail }).top;
    const extra = occupiedTop ? thresholdLabelLayout.height + 6 : Math.max(0, thresholdLabelLayout.height + 6 - (plot.y - frame.y));
    if (plot.height - extra < MIN_PLOT_HEIGHT) throw new Error("Scatter threshold label leaves insufficient plot height; enlarge the exhibit");
    plot = { ...plot, y: plot.y + extra, height: plot.height - extra };
  }
  // Axis titles: a scatter's two measures are its whole argument, so it names
  // both (`xLabel`, `yLabel`). The x title sits under the tick labels, the y
  // title above the value axis.
  const xTitle = typeof props.xLabel === "string" && props.xLabel.trim() ? props.xLabel.trim() : null;
  const yTitle = typeof props.yLabel === "string" && props.yLabel.trim() ? props.yLabel.trim() : null;
  if (xTitle) plot = { ...plot, height: plot.height - 24 };
  if (yTitle && plot.y - frame.y < 26) plot = { ...plot, y: plot.y + 26 - (plot.y - frame.y), height: plot.height - (26 - (plot.y - frame.y)) };
  if (plot.height < MIN_PLOT_HEIGHT) throw new Error("Scatter axis titles leave insufficient plot height; enlarge the exhibit");
  return { plot, thresholdLabelLayout, xTitle, yTitle };
}

/** Both value scales and the quadrants laid on them. */
function scatterScales(chart) {
  const { props, plot } = chart;
  // `xScale` / `yScale: { min, max }` name the same domain as xMin/xMax.
  const xBounds = numericBounds(props.points.map(point => point.x), { min: props.xMin ?? props.xScale?.min, max: props.xMax ?? props.xScale?.max, axis: "x" });
  const yBounds = numericBounds(withReferenceValues(props.points.map(point => point.y), props), { min: props.yMin ?? props.yScale?.min, max: props.yMax ?? props.yScale?.max, axis: "y" });
  const xScale = (value) => plot.x + (value - xBounds.min) / xBounds.span * plot.width;
  const yScale = (value) => plot.y + plot.height - (value - yBounds.min) / yBounds.span * plot.height;
  const quadrants = normalizedQuadrants(props.quadrants, xBounds, yBounds);
  return { xBounds, yBounds, xScale, yScale, quadrants };
}

/** The quadrants, the axes with their ticks and titles, the threshold label and the legend. */
function scatterAxes(chart) {
  const { id, frame, props, bubble, seriesNames, plot, thresholdLabelLayout, xTitle, yTitle, xBounds, yBounds, xScale, yScale, quadrants } = chart;
  const nodes = [
    ...scatterQuadrantNodes({ id, plot, quadrants, xScale, yScale }),
    ...axes(id, plot, yBounds.min, yBounds.max, scaleTicks(props.yScale, yBounds), { gridlines: props.gridlines === true }),
    ...scatterLegend({ id, frame, props, bubble, seriesNames })
  ];
  if (thresholdLabelLayout) {
    const width = Math.min(plot.width, Math.ceil(thresholdLabelLayout.width) + 2);
    nodes.push(textPrimitive({ id: stableId(id, "x-threshold-label"), role: "chart-threshold-label",
      frame: { x: Math.max(plot.x, Math.min(plot.x + plot.width - width, xScale(quadrants.x) - width / 2)), y: plot.y - thresholdLabelLayout.height - 6, width, height: thresholdLabelLayout.height },
      text: quadrants.xLabel, style: { ...textStyle(CHART_ANNOTATION, INK, true, "center"), valign: "top" },
      data: { thresholdAxis: "x", threshold: quadrants.x, textLayout: thresholdLabelLayout } }));
  }
  if (xTitle) nodes.push(textPrimitive({ id: stableId(id, "x-axis-title"), role: "axis-title", frame: { x: plot.x, y: plot.y + plot.height + 46, width: plot.width, height: 20 }, text: xTitle, style: textStyle(AXIS_LABEL, INK, true, "center"), data: { axis: "x" } }));
  // The y title's box is its text's width, not the plot's: a full-width box
  // above the plot would be an obstacle no callout leader could route around.
  if (yTitle) {
    const measured = measureText(yTitle, plot.width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL), bold: true });
    nodes.push(textPrimitive({ id: stableId(id, "y-axis-title"), role: "axis-title", frame: { x: Math.max(frame.x, plot.x - 54), y: plot.y - 26, width: Math.min(plot.width, Math.ceil(measured.width) + 4), height: 20 }, text: yTitle, style: textStyle(AXIS_LABEL, INK, true, "left"), data: { axis: "y" } }));
  }
  // Both quantitative dimensions need a visible scale, even without point labels.
  // A declared step sets the ticks when it divides the domain; four quarters
  // otherwise, which on a 40-90 axis read 52.5 and 77.5.
  const xTicks = scaleTicks(props.xScale, xBounds);
  for (let index = 0; index <= xTicks; index++) {
    const value = xBounds.min + xBounds.span * index / xTicks;
    nodes.push(textPrimitive({ id: stableId(id, "x-axis-label", index), role: "axis-label", frame: { x: xScale(value) - (index === 0 ? 0 : index === xTicks ? 64 : 32), y: plot.y + plot.height + 20, width: 64, height: 28 }, text: axisTickText(xBounds.min, xBounds.max, index, xTicks), style: textStyle(AXIS_LABEL, SECONDARY, false, index === 0 ? "left" : index === xTicks ? "right" : "center"), data: { axis: "x" } }));
  }
  if (props.yTickLabels) {
    for (let index = nodes.length - 1; index >= 0; index--) if (nodes[index].role === "axis-label" && !nodes[index].id.includes("x-axis-label")) nodes.splice(index, 1);
    for (const [index, tick] of props.yTickLabels.entries()) {
      if (!Number.isFinite(tick.value) || typeof tick.label !== "string") throw new Error("Scatter yTickLabels require finite values and text labels");
      nodes.push(textPrimitive({ id: stableId(id, "category-axis-label", index), role: "axis-label", frame: { x: plot.x - 54, y: yScale(tick.value) - 14, width: 48, height: 28 }, text: tick.label, style: textStyle(AXIS_LABEL, SECONDARY, false, "right"), data: { axis: "y" } }));
    }
  }
  return { nodes };
}

/** Each point (sized, for a bubble chart) and its label, and the maps callouts anchor to. */
function drawScatterPoints(chart) {
  const { id, props, bubble, focus, focused, seriesNames, xScale, yScale, nodes } = chart;
  const pointMap = new Map();
  const categoryMap = new Map();
  const bubbleSizes = bubble ? props.points.map(point => point.size) : [];
  const minBubble = bubble ? Math.min(...bubbleSizes) : 0;
  const maxBubble = bubble ? Math.max(...bubbleSizes) : 0;
  const bubbleDiameter = value => {
    // A plain point is a line's marker and a little more, so it grows with
    // the mark weight: 14px under the reference weight, 12px light.
    if (!bubble) return markWeight().marker + 2;
    if (minBubble === maxBubble) return 34;
    const areaScale = (Math.sqrt(value) - Math.sqrt(minBubble)) / (Math.sqrt(maxBubble) - Math.sqrt(minBubble));
    return 18 + areaScale * 54;
  };
  props.points.forEach((point, index) => {
    const size = bubbleDiameter(point.size);
    const x = xScale(point.x);
    const y = yScale(point.y);
    const seriesIndex = seriesNames.length ? seriesNames.indexOf(point.series) : 0;
    const marked = focused.has(point.name);
    const pointColor = focus.length
      ? (marked ? token("color.accent") : token("color.chartComparator"))
      : SERIES[props.colorIndices?.[seriesIndex] ?? seriesIndex % SERIES.length];
    nodes.push(ellipsePrimitive({ id: stableId(id, "point", point.name), role: "chart-marker", frame: { x: x - size / 2, y: y - size / 2, width: size, height: size }, style: fillStyle(pointColor), data: { series: point.series ?? null, sizeValue: bubble ? point.size : null, ...(marked ? { highlighted: true } : {}) } }));
    if (point.showLabel !== false && props.dataLabels !== false) nodes.push(textPrimitive({ id: stableId(id, "label", point.name), role: "data-label", frame: { x: x + size / 2 + 4, y: y - 12, width: 96, height: 24 }, text: point.name, style: textStyle(CHART_LABEL, marked ? token("color.accent") : INK, marked, "left") }));
    const mappedPoint = { x, y, changeX: x, changeY: y - 16 };
    pointMap.set(`value:${point.name}`, mappedPoint);
    pointMap.set(`${point.series || "value"}:${point.name}`, mappedPoint);
    pointMap.set(`category:${point.name}`, mappedPoint);
    categoryMap.set(point.name, { x: x - size, y: y - size, width: size * 2, height: size * 2 });
  });
  return { pointMap, categoryMap };
}

/** `connect`: each series joined in x order, its name at its last point; returns the label boxes placed so far. */
function drawConnectedSeries(chart) {
  const { id, props, focus, seriesNames, connected, seriesEnds, endFace, plot, xScale, yScale, nodes } = chart;
  const placed = [];
  if (connected) {
    const weight = markWeight();
    const groups = seriesNames.length ? seriesNames.map((name) => props.points.filter((point) => point.series === name)) : [props.points];
    groups.forEach((group, seriesIndex) => {
      const ordered = [...group].sort((a, b) => a.x - b.x);
      const color = focus.length ? token("color.chartComparator") : SERIES[props.colorIndices?.[seriesIndex] ?? seriesIndex % SERIES.length];
      ordered.slice(1).forEach((point, at) => nodes.unshift(linePrimitive({ id: stableId(id, "segment", seriesNames[seriesIndex] ?? "value", at), role: "chart-line",
        x1: xScale(ordered[at].x), y1: yScale(ordered[at].y), x2: xScale(point.x), y2: yScale(point.y), style: lineStyle(color, weight.line) })));
      if (seriesEnds) {
        const last = ordered.at(-1);
        placed.push({ series: seriesNames[seriesIndex], x: xScale(last.x), y: yScale(last.y), color });
      }
    });
    // Series names in the gutter right of the plot, level with each series'
    // last point and pushed apart as a line chart's end labels are.
    const ends = placed.splice(0).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 22);
    for (const end of ends) {
      const width = Math.ceil(measureText(end.series, 400, endFace).width) + 2;
      nodes.push(textPrimitive({ id: stableId(id, "series-label", end.series), role: "data-label", frame: { x: plot.x + plot.width + 10, y: end.y - 12, width, height: 24 }, text: end.series, style: textStyle(CHART_LABEL, end.color, true, "left"), data: { series: end.series, labelKind: "series-end" } }));
    }
  }
  return { placed };
}

/**
 * Each point's label, set where it collides with no mark, line or other
 * label: beside the point, inside a bubble wide enough, or further out on a
 * leader in a crowd.
 */
function placeScatterLabels(chart) {
  const { id, props, bubble, plot, yScale, nodes, pointMap, placed } = chart;
  // Lines a point's label may not sit on: the joined series and the
  // reference lines drawn over the plot.
  const segments = [
    ...nodes.filter((node) => node.role === "chart-line").map((node) => ({ x1: node.data.x1, y1: node.data.y1, x2: node.data.x2, y2: node.data.y2 })),
    ...(props.referenceLines || []).filter((reference) => Number.isFinite(reference?.value)).map((reference) => ({ x1: plot.x, y1: yScale(reference.value), x2: plot.x + plot.width, y2: yScale(reference.value) })),
  ];
  const onSegment = (box) => segments.some(({ x1, y1, x2, y2 }) => {
    const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 3));
    for (let i = 0; i <= steps; i++) {
      const px = x1 + (x2 - x1) * i / steps, py = y1 + (y2 - y1) * i / steps;
      if (px > box.x - 2 && px < box.x + box.width + 2 && py > box.y - 2 && py < box.y + box.height + 2) return true;
    }
    return false;
  });
  const marks = nodes.filter((node) => node.role === "chart-marker");
  // Thresholds are fixed evidence; move outside labels, never their points or bounds.
  const labelObstacles = nodes.filter((node) => ["chart-marker", "chart-threshold-line", "chart-quadrant-title", "axis-title"].includes(node.role)).map((node) => node.frame);
  const intersects = (a, b) => a.x < b.x + b.width + 3 && a.x + a.width + 3 > b.x && a.y < b.y + b.height + 3 && a.y + a.height + 3 > b.y;
  for (const label of nodes.filter((node) => node.role === "data-label" && node.data?.labelKind !== "series-end")) {
    const point = pointMap.get(`value:${label.text}`);
    const mark = marks.find((node) => node.id === stableId(id, "point", label.text));
    // Measured in the face it prints in - a focus label is bold - and at the
    // width it needs: a fixed 96px box failed "Scarborough" in bold as
    // unbreakable text. A name up to 220px sets on one line; a longer one
    // wraps at 220px and the box takes its lines.
    const face = { fontFamily: tokenValue(label.style.bold ? token("font.bodySemibold") : FONT), fontSize: tokenValue(CHART_LABEL), bold: label.style.bold === true };
    const single = measureText(label.text, 100000, face);
    const measured = single.width <= 220 ? single : measureText(label.text, 220, face);
    const width = Math.ceil(measured.width) + 2, height = Math.max(24, Math.ceil(measured.height));
    if (measured.lines?.length > 1) label.text = measured.text;
    label.style = { ...label.style, ...(measured.lines?.length > 1 ? { lineHeight: measured.lineHeight } : {}), wrap: false };
    // A bubble wide enough to carry its name takes the label inside, in white,
    // as on a positioning matrix; the smaller ones keep an outside label.
    if (bubble && mark.frame.width >= width + 12 && mark.frame.height >= height + 4) {
      label.frame = { x: point.x - width / 2, y: point.y - height / 2, width, height };
      label.style = { ...label.style, color: tokenDefinition(token("color.onPrimary")), bold: true, align: "center" };
      label.data = { ...label.data, inside: true };
      continue;
    }
    const gap = 5;
    const candidates = [
      { x: mark.frame.x + mark.frame.width + gap, y: point.y - height / 2, width, height },
      { x: mark.frame.x - width - gap, y: point.y - height / 2, width, height },
      { x: point.x - width / 2, y: mark.frame.y - height - gap, width, height },
      { x: point.x - width / 2, y: mark.frame.y + mark.frame.height + gap, width, height },
      { x: mark.frame.x + mark.frame.width + gap, y: mark.frame.y - height - gap, width, height },
      { x: mark.frame.x - width - gap, y: mark.frame.y - height - gap, width, height },
      { x: mark.frame.x + mark.frame.width + gap, y: mark.frame.y + mark.frame.height + gap, width, height },
      { x: mark.frame.x - width - gap, y: mark.frame.y + mark.frame.height + gap, width, height },
      { x: mark.frame.x + mark.frame.width + gap * 3, y: point.y - height / 2, width, height },
      { x: mark.frame.x - width - gap * 3, y: point.y - height / 2, width, height }
    ];
    const free = (candidate) => candidate.x >= plot.x && candidate.x + width <= plot.x + plot.width && candidate.y >= plot.y && candidate.y + height <= plot.y + plot.height && [...placed, ...labelObstacles].every((other) => !intersects(candidate, other)) && !onSegment(candidate);
    let candidate = candidates.find(free);
    // In a cluster every position touching the point is taken. The label then
    // moves further out - rings at growing distances, sixteen directions each,
    // nearest first - and a hairline leader runs from the point's edge to it,
    // as a designer labels a crowded scatter, instead of the chart failing.
    // The leader may not cross another point or label on its way.
    let leader = null;
    if (!candidate) {
      const r = mark.frame.width / 2;
      const clearPath = (x1, y1, x2, y2) => {
        const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 3));
        for (let i = 1; i < steps; i++) {
          const x = x1 + (x2 - x1) * i / steps, y = y1 + (y2 - y1) * i / steps;
          if ([...placed, ...labelObstacles.filter((frame) => frame !== mark.frame)].some((f) => x > f.x - 1 && x < f.x + f.width + 1 && y > f.y - 1 && y < f.y + f.height + 1)) return false;
        }
        return true;
      };
      search: for (const distance of [14, 26, 42, 62, 88]) {
        for (const degrees of [0, 180, -45, -135, 45, 135, -90, 90, -22.5, -157.5, 22.5, 157.5, -67.5, -112.5, 67.5, 112.5]) {
          const angle = degrees * Math.PI / 180;
          const ux = Math.cos(angle), uy = Math.sin(angle);
          // The box's nearest edge sits `distance` beyond the mark's rim.
          const cx = point.x + ux * (r + distance + width / 2 * Math.abs(ux)), cy = point.y + uy * (r + distance + height / 2 * Math.abs(uy));
          const box = { x: cx - width / 2, y: cy - height / 2, width, height };
          if (!free(box)) continue;
          const x1 = point.x + ux * (r + 2), y1 = point.y + uy * (r + 2);
          // Walk out along the ray and stop 3px short of the label's ink box.
          const inkBox = { x: box.x + (width - measured.width) / 2 - 3, y: cy - measured.height / 2 - 3, width: measured.width + 6, height: measured.height + 6 };
          let t = 0;
          while (t < distance + width && !(x1 + ux * t > inkBox.x && x1 + ux * t < inkBox.x + inkBox.width && y1 + uy * t > inkBox.y && y1 + uy * t < inkBox.y + inkBox.height)) t += 1;
          const x2 = x1 + ux * Math.max(0, t - 1), y2 = y1 + uy * Math.max(0, t - 1);
          if (t < 6 || !clearPath(x1, y1, x2, y2)) continue;
          candidate = box; leader = { x1, y1, x2, y2 };
          break search;
        }
      }
    }
    if (!candidate) throw new Error(`No collision-free position for scatter label ${label.text}, even with a leader up to 88px from its point; enlarge the exhibit, set showLabel: false on points the page does not discuss, or reduce labelled points`);
    label.frame = candidate;
    if (leader) {
      label.data = { ...label.data, leader: true };
      nodes.push(linePrimitive({ id: stableId(label.id, "leader"), role: "data-label-leader", ...leader, style: lineStyle(SECONDARY, token("line.hairline")), data: { point: label.text } }));
    }
    placed.push(candidate);
  }
}

export const PART_TO_WHOLE_VARIANTS = Object.freeze({ "legend-top-right": {}, "outside-labels": { props: { labels: ["Category 1", "Category 2", "Category 3", "Category 4"], values: [25, 25, 25, 25] } }, "shared-legend": {} });
export function resolvePartToWholeVariant(props = {}) {
  const variant = props.variant ?? (props.outsideLabels ? "outside-labels" : props.legend === false ? "shared-legend" : "legend-top-right");
  if (!Object.hasOwn(PART_TO_WHOLE_VARIANTS, variant)) throw new Error(`Unknown pie/donut variant: ${variant}`);
  if (props.legend === true && variant !== "legend-top-right" || props.legend === false && variant === "legend-top-right" || props.outsideLabels === true && variant !== "outside-labels") throw new Error("Pie/donut variant conflicts with legend or outsideLabels");
  return variant;
}

/**
 * A pie or donut. The circle is the largest that holds every percentage -
 * inside its slice, or outside at the rim, stacked in a column when thin
 * neighbours collide - and failing that the percentages that do not fit go
 * into the key. The layout search below owns that state; the drawing steps
 * after it read the settled layout from one record, `pie`.
 */
export function partToWhole({ id, frame, props, donut = false, tokens = TOKENS }) {
  if ((props.changeAnnotations || []).length || props.annotationRail) throw new Error("Pie and donut charts do not support ordered change annotations; use direct segment labels or another encoding");
  const variant = resolvePartToWholeVariant(props);
  const showLegend = variant === "legend-top-right";
  // A key that outruns one row wraps (26px a row) rather than failing to fit.
  const legendRowsOf = (labels) => showLegend ? legendRowCount(labels, frame.width - 32) : 0;
  let legendRows = legendRowsOf(Array.isArray(props.labels) ? props.labels.filter(label => typeof label === "string") : []);
  let legendHeight = showLegend ? 48 + Math.max(0, legendRows - 1) * 26 : 0;
  if (!Array.isArray(props.labels) || !Array.isArray(props.values) || props.values.length < 2 || props.values.length > 5 || props.labels.length !== props.values.length || props.labels.some(label => typeof label !== "string" || !label.trim()) || new Set(props.labels).size !== props.labels.length || props.values.some(v => !Number.isFinite(v) || v < 0) || props.values.filter(v => v > 0).length < 2) throw new Error("Pie/donut needs two to five unique categories and at least two positive finite values");
  let availableHeight = frame.height - legendHeight;
  const outside = variant === "outside-labels";
  let labelWidth = outside ? Math.max(...props.labels.map(label => measureText(label, frame.width, { fontSize: tokenValue(CHART_ANNOTATION), fontFamily: tokenValue(token("font.bodySemibold")), bold: tokenDefinition("font.bodySemibold").nativeBold }).width)) : 0;
  const total = props.values.reduce((sum, value) => sum + value, 0);
  const sweeps = [];
  props.values.reduce((start, value) => { sweeps.push({ mid: (start + 180 * value / total) * Math.PI / 180, half: Math.PI * value / total }); return start + 360 * value / total; }, -90);
  const percentages = props.values.map(value => Math.round(100 * value / total));
  // A slice under half a percent rounds to "0%", which reads as no slice at
  // all; it prints as "<1%" instead of failing the chart.
  const percentText = (index) => percentages[index] ? `${percentages[index]}%` : "<1%";
  // Each percentage is measured at its own width, so its frame says how wide
  // its text is; the fit test below and the box drawn share one measurement.
  const labelMetrics = percentages.map((_, index) => measureText(percentText(index), 1000, { fontSize: tokenValue(CHART_LABEL), bold: true }));
  let plotBounds = { x: frame.x, y: frame.y + legendHeight, width: frame.width, height: availableHeight };
  const boxesMeet = (a, b) => !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
  const inBounds = (box) => box.x >= plotBounds.x && box.y >= plotBounds.y && box.x + box.width <= plotBounds.x + plotBounds.width && box.y + box.height <= plotBounds.y + plotBounds.height;
  const placeLabels = (size, cx, cy) => percentagePlacements({ props, donut, sweeps, labelMetrics }, size, cx, cy);
  // Reads the plot's bounds when called: the key can grow and move them.
  const columns = (labels, circle) => stackOutsidePercentages(labels, circle, sweeps, plotBounds);
  const layoutAt = (size, stacked = false) => {
    const circle = { x: frame.x + (frame.width - size) / 2, y: frame.y + legendHeight + (availableHeight - size) / 2, width: size, height: size };
    let labels = props.dataLabels === false ? [] : placeLabels(size, circle.x + size / 2, circle.y + size / 2).map(label => label && { ...label, natural: { ...label.frame } });
    if (stacked) labels = columns(labels, circle);
    return { size, circle, labels };
  };
  const layout = (gutterX, gutterY) => layoutAt(Math.min(frame.width - 2 * gutterX, availableHeight - 2 * gutterY));
  const fits = ({ labels }) => labels.every((label, index) => !label || label.placement === "inside" || (!outside && inBounds(label.frame) && labels.every((other, j) => j === index || !other || !boxesMeet(label.frame, other.frame))));
  let { size, circle, labels } = layout(outside ? labelWidth + 24 : 16, 16);
  // Percentages the chart could not place beside their slices go into the key
  // instead ("Other 2%"), the way a designer abbreviates a crowded pie.
  let keyed = new Set();
  if (!fits({ labels })) {
    // A slice too thin for its percentage takes it outside, and the circle
    // gives up the margin that label needs: the largest circle, stepping down,
    // whose outside labels all sit inside the frame and clear of each other.
    // Shrinking the circle can only make slices thinner, so each step places
    // every label again.
    const largest = size;
    let found = null;
    for (let trial = Math.floor(largest); trial >= 140 && !found; trial -= 4) {
      for (const stacked of [false, true]) {
        const candidate = layoutAt(trial, stacked);
        if (!found && fits(candidate)) found = candidate;
      }
    }
    if (found) ({ size, circle, labels } = found);
    else if (showLegend || outside) {
      keyed = new Set(labels.map((label, index) => label && label.placement === "outside" ? index : -1).filter(index => index >= 0));
      if (showLegend) {
        // The key's items grow by their percentage; a key that now wraps takes its extra row from the circle.
        legendRows = legendRowsOf(props.labels.map((label, index) => keyed.has(index) ? `${label} ${percentText(index)}` : label));
        legendHeight = 48 + Math.max(0, legendRows - 1) * 26;
        availableHeight = frame.height - legendHeight;
        plotBounds = { x: frame.x, y: frame.y + legendHeight, width: frame.width, height: availableHeight };
      }
      if (outside) labelWidth = Math.max(...props.labels.map((label, index) => measureText(keyed.has(index) ? `${label} ${percentText(index)}` : label, frame.width, { fontSize: tokenValue(CHART_ANNOTATION), fontFamily: tokenValue(token("font.bodySemibold")), bold: tokenDefinition("font.bodySemibold").nativeBold }).width));
      ({ size, circle, labels } = layout(outside ? labelWidth + 24 : 16, 16));
      labels = labels.map((label, index) => keyed.has(index) || (label && label.placement === "outside") ? null : label);
      keyed = new Set([...keyed, ...labels.map((label, index) => !label && props.values[index] && props.dataLabels !== false ? index : -1).filter(index => index >= 0)]);
    }
  }
  if (size < 140) throw new Error(`Pie/donut circle would be ${Math.floor(size)}px across (minimum 140px) in a ${Math.floor(frame.width)}x${Math.floor(frame.height)}px frame; give the chart more room, drop the legend for a shared one, or use a bar encoding`);
  const pie = { id, frame, props, donut, tokens, variant, showLegend, legendRows, total, sweeps, percentText, size, circle, keyed, outside, boxesMeet,
    inBounds, labels, labelWidth, plotBounds };
  Object.assign(pie, drawPieSlices(pie));
  drawPiePercentages(pie);
  drawOutsideNames(pie);
  return pie.nodes;
}

// The gap between a pie's rim and a label set beyond it.
const OUTSIDE_GAP = 8;

// Where each percentage goes for a circle of `size` centred at (cx, cy):
// inside its slice when the slice holds the text plus clearance, otherwise
// just beyond the rim at the slice's mid-angle. Outside is not available to
// the outside-labels variant, whose rim already carries the category names.
function percentagePlacements({ props, donut, sweeps, labelMetrics }, size, cx, cy) {
  return props.values.map((value, index) => {
    if (!value) return null;
    const measured = labelMetrics[index], { mid, half } = sweeps[index];
    const labelRadius = donut ? 0.365 : 0.29;
    const dx = Math.cos(mid) * size * labelRadius, dy = Math.sin(mid) * size * labelRadius;
    // Test visible text plus clearance against its own sector, not the circular
    // bounding box shared by every slice. Donuts must also clear the inner hole.
    const halfWidth = measured.width / 2 + 4, halfHeight = Math.max(28, measured.height) / 2 + 4;
    const cornersFit = [-1, 1].every(sx => [-1, 1].every(sy => {
      const x = dx + sx * halfWidth, y = dy + sy * halfHeight;
      const delta = Math.atan2(y, x) - mid;
      return Math.hypot(x, y) <= size / 2 && Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta))) <= half;
    }));
    const holeClear = !donut || Math.hypot(Math.max(0, Math.abs(dx) - halfWidth), Math.max(0, Math.abs(dy) - halfHeight)) >= size * 0.23;
    const width = Math.ceil(measured.width) + 8, height = Math.max(28, Math.ceil(measured.height));
    if (cornersFit && holeClear) return { placement: "inside", frame: { x: cx + dx - width / 2, y: cy + dy - height / 2, width, height } };
    // Beyond the rim the box sits tangent to the circle: its centre moves out
    // by half its own extent along the mid-angle, so a label at the top clears
    // the rim by the gap and one at the side starts the gap from it.
    const rx = cx + Math.cos(mid) * (size / 2 + OUTSIDE_GAP), ry = cy + Math.sin(mid) * (size / 2 + OUTSIDE_GAP);
    const inkHeight = Math.ceil(measured.height);
    return { placement: "outside", frame: { x: rx + Math.cos(mid) * width / 2 - width / 2, y: ry + Math.sin(mid) * inkHeight / 2 - inkHeight / 2, width, height: inkHeight } };
  });
}

// When thin neighbouring slices put their outside percentages on the same
// spot at the rim, those labels move to a column beside the circle - right
// of it for slices on the right half, left for the left - stacked in reading
// order, each with a leader back to its slice's rim.
function stackOutsidePercentages(labels, circle, sweeps, plotBounds) {
  const cx = circle.x + circle.width / 2, r = circle.width / 2;
  for (const side of [-1, 1]) {
    const group = labels.filter((label, index) => label?.placement === "outside" && (Math.cos(sweeps[index].mid) >= 0 ? 1 : -1) === side).sort((a, b) => a.frame.y - b.frame.y);
    for (const label of group) label.frame = { ...label.frame, x: side > 0 ? cx + r + OUTSIDE_GAP * 2 : cx - r - OUTSIDE_GAP * 2 - label.frame.width, y: Math.max(plotBounds.y, Math.min(plotBounds.y + plotBounds.height - label.frame.height, label.frame.y)) };
    for (let i = 1; i < group.length; i++) group[i].frame.y = Math.max(group[i].frame.y, group[i - 1].frame.y + group[i - 1].frame.height + 2);
    for (let i = group.length - 1; i >= 0; i--) group[i].frame.y = Math.min(group[i].frame.y, (i === group.length - 1 ? plotBounds.y + plotBounds.height : group[i + 1].frame.y - 2) - group[i].frame.height);
  }
  return labels;
}

/** The key, the slices and the donut's hole; returns the slices' colours and mid-angles and the circle's centre. */
function drawPieSlices(pie) {
  const { id, frame, props, donut, variant, showLegend, legendRows, total, sweeps, percentText, size, circle, keyed } = pie;
  const colorIndices = props.labels.map((label, index) => props.categoryKeys ? props.categoryKeys.indexOf(label) : index);
  if (colorIndices.some(i => i < 0 || i >= SERIES.length)) throw new Error("Pie/donut category is missing from the shared legend mapping");
  const nodes = showLegend ? legendNodes({ id: stableId(id, "legend"), frame: { x: frame.x + 16, y: frame.y + 7, width: frame.width - 32, height: 28 + Math.max(0, legendRows - 1) * 26 }, props: { placement: "top-right", items: props.labels.map((label, index) => ({ label: keyed.has(index) ? `${label} ${percentText(index)}` : label, colorIndex: colorIndices[index], ...(keyed.has(index) ? { key: label } : {}) })) } }) : [];
  let angle = -90;
  const labelAngles = sweeps.map(sweep => sweep.mid);
  props.values.forEach((value, index) => {
    const sweep = 360 * value / total;
    if (!value) return;
    nodes.push(wedgePrimitive({
      id: stableId(id, "segment", index, props.labels[index]),
      role: "chart-segment",
      frame: circle,
      startAngle: angle,
      endAngle: angle + sweep,
      style: fillStyle(SERIES[colorIndices[index]], token("color.surface"), token("line.hairline")),
      data: { value, label: props.labels[index], categoryKey: props.labels[index], colorIndex: colorIndices[index], variant, plotFrame: circle }
    }));
    angle += sweep;
  });
  if (donut) nodes.push(ellipsePrimitive({ id: stableId(id, "donut-hole"), role: "chart-hole", frame: { x: circle.x + size * 0.27, y: circle.y + size * 0.27, width: size * 0.46, height: size * 0.46 }, style: fillStyle(token("color.canvas")) }));
  const cx = circle.x + circle.width / 2;
  const cy = circle.y + circle.height / 2;
  return { colorIndices, nodes, labelAngles, cx, cy };
}

/** Each slice's percentage where the layout placed it, with a leader when it was moved off its rim point. */
function drawPiePercentages(pie) {
  const { id, props, tokens, outside, percentText, boxesMeet, inBounds, size, labels, colorIndices, nodes, labelAngles, cx, cy } = pie;
  labels.forEach((label, index) => {
    if (!label) return;
    const background = tokens[SERIES[colorIndices[index]].tokenId].value;
    const inside = label.placement === "inside";
    const foreground = inside ? onFill(background) : INK;
    const text = percentText(index), { frame: box } = label;
    // Every label reaching here was placed by the layout above: inside its
    // slice, outside at the rim clear of the frame edge and its neighbours, or
    // keyed. Only a variant with no key and no room at the rim is left.
    if (!inside && (outside || !inBounds(box) || labels.some((other, j) => j !== index && other && boxesMeet(box, other.frame))))
      throw new Error(`Pie/donut percentage for ${props.labels[index]} fits neither its slice nor the rim beside it, and the shared-legend variant has no key to carry it; enlarge the chart, merge thin slices into "Other", or use a bar encoding`);
    // A label the layout stepped away from its slice's rim point gets a leader back to the slice.
    const natural = label.natural;
    if (!inside && natural && Math.hypot(natural.x - box.x, natural.y - box.y) > 3) {
      const mid = labelAngles[index], r = size / 2 + 3;
      const x1 = cx + Math.cos(mid) * r, y1 = cy + Math.sin(mid) * r;
      const x2 = Math.cos(mid) >= 0 ? box.x : box.x + box.width, y2 = box.y + box.height / 2;
      nodes.push(linePrimitive({ id: stableId(id, "percentage-leader", index), role: "data-label-leader", x1, y1, x2, y2, style: lineStyle(SECONDARY, token("line.hairline")), data: { categoryKey: props.labels[index] } }));
    }
    nodes.push(textPrimitive({ id: stableId(id, "percentage", index), role: "data-label", frame: box, text, style: textStyle(CHART_LABEL, foreground, labelBold(), inside ? "center" : Math.abs(Math.cos(labelAngles[index])) < 0.2 ? "center" : Math.cos(labelAngles[index]) > 0 ? "left" : "right"), data: { categoryKey: props.labels[index], placement: label.placement, contrast: contrastRatio(inside ? background : tokens["color.canvas"].value, tokens[foreground.tokenId].value) } }));
  });
}

/** The outside-labels variant: each slice's name at the rim, stacked clear of its neighbours. */
function drawOutsideNames(pie) {
  const { id, props, outside, labelWidth, percentText, plotBounds, size, circle, keyed, nodes, labelAngles, cx, cy } = pie;
  if (outside) {
    // Names of neighbouring thin slices fall on the same height at the rim;
    // on each side they stack 28px apart in reading order, and one moved off
    // its slice's height takes a leader back to the rim.
    const rows = props.values.map((value, index) => value ? { index, right: Math.cos(labelAngles[index]) >= 0, y: cy + Math.sin(labelAngles[index]) * size * 0.48 - 14 } : null).filter(Boolean);
    for (const right of [true, false]) {
      const group = rows.filter(row => row.right === right).sort((a, b) => a.y - b.y);
      for (let i = 1; i < group.length; i++) group[i].y = Math.max(group[i].y, group[i - 1].y + 28);
      for (let i = group.length - 1; i >= 0; i--) group[i].y = Math.max(plotBounds.y, Math.min(group[i].y, (i === group.length - 1 ? plotBounds.y + plotBounds.height : group[i + 1].y) - 28));
    }
    for (const { index, right, y } of rows) {
      const name = keyed.has(index) ? `${props.labels[index]} ${percentText(index)}` : props.labels[index];
      const natural = cy + Math.sin(labelAngles[index]) * size * 0.48 - 14;
      const x = right ? circle.x + size + 16 : circle.x - labelWidth - 16;
      if (Math.abs(natural - y) > 6) {
        const r = size / 2 + 3;
        nodes.push(linePrimitive({ id: stableId(id, "outside-leader", index), role: "data-label-leader", x1: cx + Math.cos(labelAngles[index]) * r, y1: cy + Math.sin(labelAngles[index]) * r, x2: right ? x - 4 : x + labelWidth + 4, y2: y + 14, style: lineStyle(SECONDARY, token("line.hairline")), data: { categoryKey: props.labels[index] } }));
      }
      nodes.push(textPrimitive({ id: stableId(id, "outside-label", index), role: "category-label", frame: { x, y, width: labelWidth, height: 28 }, text: name, style: { ...textStyle(CHART_ANNOTATION, INK, false, right ? "left" : "right"), ...chartAnnotationStyle(), wrap: false }, data: { directAnnotation: true, textLayout: { lines: [name] }, ...(keyed.has(index) ? { keyedPercentage: percentText(index) } : {}) } }));
    }
  }
}
