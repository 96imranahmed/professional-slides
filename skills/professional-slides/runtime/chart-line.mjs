// Charts that draw a line across their categories: line and area
// (`lineChart`, which hands a long sparse series to `sparseLineChart`) and the
// combo chart, columns with a line over them.
import { ellipsePrimitive, linePrimitive, stableId, textPrimitive, token, tokenValue, shapePrimitive, rectPrimitive } from "./core.mjs";
import { formatValue } from "./value-format.mjs";
import { ENGINE_RESERVE, measureText } from "./text-layout.mjs";
import { timePositions, spacedLabelIndices, monthlyLabelStep } from "./time-axis.mjs";
import { FONT, INK, SECONDARY, CHART_LABEL, AXIS_LABEL, SERIES, chartFrame, labelBold, textStyle, lineStyle, fillStyle, topLegend,
  assertGridlineOption, numericBounds, axisLabelWidth, axes, labelBand, markWeight, tableSpan, resolveValueAxis, normalizedCategoricalData,
  periodLabelStep } from "./chart-axes.mjs";
import { withReferenceValues, withDecorations, periodBandHeight, measureDataLabel, growthColumn, seriesState, stateLabel, statesSeries } from "./chart-decorations.mjs";

const SPARSE_DIRECT_LABEL_LIMIT = 8;

// Explicit sparse observations use numeric positions; no category slot or invented value.
function sparseLineChart({ id, frame, props }) {
  const fail = message => { throw new Error(`Sparse line: ${message}`); };
  const textRequired = value => typeof value === "string" && value.trim();
  let assumptionNode = null;
  if (props.assumption !== undefined) {
    if (!textRequired(props.assumption)) fail("assumption must contain substantive text");
    const measured = measureText(props.assumption, frame.width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL), wrapWidthRatio: ENGINE_RESERVE });
    const height = measured.height + tokenValue(token("space.3"));
    assumptionNode = textPrimitive({ id: stableId(id, "assumption"), role: "chart-assumption", frame: { x: frame.x, y: frame.y, width: frame.width, height: measured.height }, text: measured.text, style: { ...textStyle(AXIS_LABEL, SECONDARY), align: "left", valign: "top", lineHeight: measured.lineHeight, wrap: false }, data: { textLayout: measured } });
    frame = { ...frame, y: frame.y + height, height: frame.height - height };
  }
  const axis = props.xAxis;
  if (!axis || !textRequired(axis.unit) || !Number.isFinite(axis.min) || !Number.isFinite(axis.max) || axis.max <= axis.min) fail("xAxis requires a unit and finite increasing min/max");
  if (props.categories !== undefined || props.values !== undefined || props.xMin !== undefined || props.xMax !== undefined) fail("numeric xAxis cannot be mixed with categorical data or alternate domains");
  if (!textRequired(props.unit)) fail("a shared quantitative unit is required");
  if (!["connect-observations", "explicit-breaks"].includes(props.gapPolicy)) fail("declare connect-observations or explicit-breaks; no implicit interpolation or filling");
  if (!Array.isArray(axis.ticks) || axis.ticks.length < 2 || axis.ticks.length > 12) fail("supply two to twelve explicit numeric axis ticks");
  const ticks = axis.ticks;
  if (ticks.some((tick, i) => !tick || !Number.isFinite(tick.value) || tick.value < axis.min || tick.value > axis.max || !textRequired(tick.label) || (i && tick.value <= ticks[i - 1].value))) fail("ticks must have unique increasing in-domain values and labels");
  const series = props.series;
  if (!Array.isArray(series) || !series.length || series.length > 6) fail("one to six named sparse series required");
  const names = new Set(), boundary = props.statusBoundary;
  if (props.statusBoundary !== undefined && !boundary) fail("statusBoundary cannot be null");
  if (props.directLabels !== undefined) fail("sparse lines use a legend and explicit point label flags, not categorical endpoint labels");
  if (boundary && (!Number.isFinite(boundary.x) || boundary.x <= axis.min || boundary.x >= axis.max || !textRequired(boundary.beforeLabel) || !textRequired(boundary.afterLabel))) fail("statusBoundary requires an interior x and both status labels");
  for (const item of series) {
    if (!textRequired(item?.name) || names.has(item.name)) fail("series names must be unique");
    names.add(item.name);
    if (item.values !== undefined || item.unit !== undefined && item.unit !== props.unit || item.xUnit !== undefined && item.xUnit !== axis.unit) fail("do not mix value arrays or incompatible units with keyed observations");
    if (!Array.isArray(item.points) || !item.points.length) fail("each series needs explicit keyed points");
    if (boundary && !["before", "after"].includes(item.status)) fail("every series must declare before/after status when a boundary is supplied");
    if (!boundary && item.status !== undefined) fail("series status requires a status boundary");
    const keys = new Set();
    for (const [i, point] of item.points.entries()) {
      if (!point || !textRequired(point.key) || keys.has(point.key) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) fail("points require unique exact keys and finite x/y; null is never a value or gap");
      keys.add(point.key);
      if (point.x < axis.min || point.x > axis.max || i && point.x <= item.points[i - 1].x) fail("series x positions must increase within the shared domain");
      if (point.xUnit !== undefined && point.xUnit !== axis.unit || point.unit !== undefined && point.unit !== props.unit) fail("point units must match the shared axes");
      if (point.breakBefore !== undefined && (typeof point.breakBefore !== "boolean" || props.gapPolicy !== "explicit-breaks" || i === 0)) fail("breakBefore requires explicit-breaks and a preceding observation");
      if (point.label !== undefined && typeof point.label !== "boolean") fail("point label must be boolean");
      if (boundary && (item.status === "before" ? point.x > boundary.x : point.x < boundary.x)) fail("historical and modelled coverage cannot cross the declared boundary");
    }
  }
  if (props.annotationRail || props.changeAnnotations?.length || props.highlights?.length || props.pointHighlights?.length) fail("sparse lines require exact keyed point labels or evidence annotations; categorical decorations are unsupported");
  assertGridlineOption(props);
  const values = series.flatMap(item => item.points.map(point => point.y));
  const bounds = numericBounds(withReferenceValues(values, props), { min: props.yMin, max: props.yMax, axis: "y" });
  const showLegend = props.legend !== false && series.length > 1;
  const showValueAxis = props.showValueAxis !== false;
  const labelWidth = axisLabelWidth(bounds);
  const plot = chartFrame(frame, { topInset: props.plotTopInset, topLegend: showLegend, leftInset: showValueAxis ? Math.max(labelWidth + 8, 54) : 54, annotations: props.annotations });
  const statusHeight = boundary ? Math.max(...[boundary.beforeLabel, boundary.afterLabel].map(label => measureText(label, plot.width / 2 - 16, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL), wrapWidthRatio: ENGINE_RESERVE }).height)) + tokenValue(token("space.3")) : 0;
  plot.y += statusHeight; plot.height -= statusHeight;
  if (plot.height < 100) fail("status labels leave insufficient plot height");
  const xScale = value => plot.x + (value - axis.min) / (axis.max - axis.min) * plot.width;
  const yScale = value => plot.y + plot.height - (value - bounds.min) / bounds.span * plot.height;
  const nodes = [...(showLegend ? topLegend({ id, frame, items: series.map((item, index) => ({ label: item.name, colorIndex: props.colorIndices?.[index] ?? index })) }) : []), ...axes(id, plot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true, showValueAxis, labelWidth })];
  const tickFrames = [];
  for (const tick of ticks) {
    const measured = measureText(tick.label, 200, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL), wrapWidthRatio: ENGINE_RESERVE });
    const width = measured.width, x = Math.max(plot.x, Math.min(xScale(tick.value) - width / 2, plot.x + plot.width - width));
    const tickFrame = { x, y: plot.y + plot.height + 12, width, height: measured.height };
    if (tickFrames.some(other => other.x + other.width + 8 > x)) fail("numeric axis labels overlap; choose fewer explicit ticks");
    tickFrames.push(tickFrame);
    nodes.push(textPrimitive({ id: stableId(id, "x-tick", tick.value), role: "category-label", frame: tickFrame, text: measured.text, style: { ...textStyle(AXIS_LABEL, SECONDARY), align: "left", valign: "top", lineHeight: measured.lineHeight, wrap: false }, data: { xValue: tick.value, xUnit: axis.unit, textLayout: measured } }));
  }
  if (boundary) {
    const x = xScale(boundary.x), boundaryId = stableId(id, "status-boundary");
    nodes.push(linePrimitive({ id: boundaryId, role: "chart-status-boundary", x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height, style: { ...lineStyle(SECONDARY, token("line.hairline")), dash: "dash" }, data: { xValue: boundary.x, xUnit: axis.unit, beforeLabel: boundary.beforeLabel, afterLabel: boundary.afterLabel } }));
    for (const [side, label, left, width] of [["before", boundary.beforeLabel, plot.x, x - plot.x - 8], ["after", boundary.afterLabel, x + 8, plot.x + plot.width - x - 8]]) {
      const measured = measureText(label, width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL), wrapWidthRatio: ENGINE_RESERVE });
      if (width <= 0 || measured.height > statusHeight) fail("status label does not fit its true time span");
      nodes.push(textPrimitive({ id: stableId(boundaryId, side), role: "chart-status-label", frame: { x: left, y: plot.y - statusHeight, width, height: measured.height }, text: measured.text, style: { ...textStyle(AXIS_LABEL, SECONDARY), align: "center", valign: "top", lineHeight: measured.lineHeight, wrap: false }, data: { status: side, textLayout: measured, dependencies: [boundaryId] } }));
    }
  }
  const pointMap = new Map(), categoryMap = new Map(), labelFrames = [];
  for (const [seriesIndex, item] of series.entries()) {
    const color = SERIES[props.colorIndices?.[seriesIndex] ?? seriesIndex % SERIES.length];
    const points = item.points.map(point => ({ ...point, px: xScale(point.x), py: yScale(point.y), nodeId: stableId(id, "point", item.name, point.key) }));
    points.forEach((point, index) => {
      const data = { series: item.name, category: point.key, pointKey: point.key, xValue: point.x, value: point.y, xUnit: axis.unit, unit: props.unit, gapPolicy: props.gapPolicy, ...(item.status ? { status: item.status } : {}) };
      if (index && !point.breakBefore) {
        const from = points[index - 1];
        nodes.push(linePrimitive({ id: stableId(id, "segment", item.name, from.key, point.key), role: "chart-line", x1: from.px, y1: from.py, x2: point.px, y2: point.py, style: lineStyle(color, token("line.standard")), data: { ...data, from: from.nodeId, to: point.nodeId, dependencies: [from.nodeId, point.nodeId], connection: "explicit-observation-join" } }));
      }
      nodes.push(ellipsePrimitive({ id: point.nodeId, role: "chart-marker", frame: { x: point.px - 3, y: point.py - 3, width: 6, height: 6 }, style: fillStyle(color), data }));
      pointMap.set(`${item.name}:${point.key}`, { x: point.px, y: point.py, value: point.y, category: point.key, nodeId: point.nodeId });
      if (series.length === 1) pointMap.set(`value:${point.key}`, pointMap.get(`${item.name}:${point.key}`));
      if (props.dataLabels === true || point.label) {
        const label = formatValue(point.y, props), measured = measureText(label, 200, { fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL), bold: true, wrapWidthRatio: ENGINE_RESERVE });
        const labelFrame = { x: Math.max(plot.x, Math.min(point.px - measured.width / 2, plot.x + plot.width - measured.width)), y: point.py - measured.height - 8, width: measured.width, height: measured.height };
        if (labelFrame.y < plot.y - 1 || labelFrames.some(other => other.x < labelFrame.x + labelFrame.width + 4 && other.x + other.width + 4 > labelFrame.x && other.y < labelFrame.y + labelFrame.height + 4 && other.y + other.height + 4 > labelFrame.y)) fail("selected point labels overlap or exceed plot; allocate height or label fewer anchors");
        labelFrames.push(labelFrame);
        nodes.push(textPrimitive({ id: stableId(point.nodeId, "label"), role: "data-label", frame: labelFrame, text: measured.text, style: { ...textStyle(CHART_LABEL, INK, labelBold()), valign: "top", lineHeight: measured.lineHeight, wrap: false }, data: { ...data, textLayout: measured, dependencies: [point.nodeId] } }));
      }
    });
  }
  if (assumptionNode) {
    assumptionNode.data.dependencies = nodes.filter(node => node.role === "chart-marker").map(node => node.id);
    nodes.unshift(assumptionNode);
  }
  if (new Set(nodes.map(node => node.id)).size !== nodes.length) fail("keys produce colliding native IDs; use distinct stable keys");
  const rendered = withDecorations(nodes, { id, plot, props, pointMap, categoryMap, yScale, allowAnnotationRail: false });
  for (const node of rendered) if (node.data?.targetCategory) {
    const target = pointMap.get(`${node.data.targetSeries || "value"}:${node.data.targetCategory}`);
    if (target) node.data.dependencies = [...new Set([...(node.data.dependencies || []), target.nodeId])];
  }
  return rendered;
}

// Where each point's label goes: a peak's above, a trough's below, a point on a
// rise or fall on the side of its gentler segment, and an end point whose one
// segment climbs over it beside the point, outward. Every label above its
// marker set a trough's value on the two segments meeting under it.
// emit_pptx.py line_label_sides applies the same rule to the native chart.
export function lineLabelSides(values) {
  return values.map((v, j) => {
    const prev = j > 0 ? values[j - 1] : null, next = j + 1 < values.length ? values[j + 1] : null;
    if (prev === null && next === null) return "above";
    if (prev === null) return next <= v ? "above" : "left";
    if (next === null) return prev <= v ? "above" : "right";
    if (v >= prev && v >= next) return "above";
    if (v <= prev && v <= next) return "below";
    if (prev < v) return next - v < v - prev ? "above" : "below";
    return prev - v < v - next ? "above" : "below";
  });
}

/**
 * A line or area chart over categories (a series of dated observations goes
 * to sparseLineChart). The steps share one record, `chart`, as
 * categoricalChart's do: the options and value scale, the plot, the axes and
 * period labels, the lines with their markers and labels, the end labels,
 * and the point highlights.
 */
export function lineChart({ id, frame, props, area = false }) {
  if (props.xAxis !== undefined || props.series?.some(item => item.points !== undefined)) {
    if (area) throw new Error("Sparse observations are supported by chart.line only; areas require complete categorical observations");
    return sparseLineChart({ id, frame, props });
  }
  const chart = { id, frame, props, area };
  Object.assign(chart, lineOptions(chart));
  Object.assign(chart, linePlot(chart));
  Object.assign(chart, lineAxes(chart));
  Object.assign(chart, drawLines(chart));
  placeEndLabels(chart);
  drawPointHighlights(chart);
  const { plot, nodes, pointMap, categoryMap, yScale } = chart;
  // A line read off its value axis takes its change as the diagonal arrow only (LINE_AXIS_CHANGE_STYLE): no bracket fallback.
  return withDecorations(nodes, { id, plot, props, pointMap, categoryMap, yScale, arrowOnly: chart.showValueAxis === true });
}

/** The data checked, and what the props decide: the line colours, end labels or a legend, data labels, the value axis and its scale. */
function lineOptions(chart) {
  const { id, frame, props, area } = chart;
  assertGridlineOption(props);
  const { categories, series } = normalizedCategoricalData(props);
  // `focusSeries`: one line in the primary, the others a muted grey, so the
  // subject reads first among its peers.
  if (props.focusSeries !== undefined && !series.some((item) => item.name === props.focusSeries)) throw new Error("focusSeries must name an exact chart series");
  const lineColor = (seriesIndex) => props.focusSeries !== undefined
    ? (series[seriesIndex].name === props.focusSeries ? token("color.componentPrimary") : token("color.rule"))
    : SERIES[props.colorIndices?.[seriesIndex] ?? seriesIndex % SERIES.length];
  if (area && categories.length < 2) throw new Error("Area charts require at least two categories");
  const endLabels = props.directLabels === "end" || props.endLabels === true;
  const showLegend = !endLabels && props.legend !== false && series.length > 1;
  const values = series.flatMap((item) => item.values);
  // `seriesGrowth: { from, to, label? }`: each line's growth in a column beside
  // its end label (a "CAGR 2020–30" column at the right
  // of a forecast). It rides on the end labels, which name the rows.
  if (props.seriesGrowth && !endLabels) throw new Error("seriesGrowth sits beside the end labels; set directLabels: \"end\"");
  const seriesGrowth = props.seriesGrowth ? growthColumn(props.seriesGrowth, categories, series, "seriesGrowth") : null;
  // Dated observations at uneven gaps (Jan, Mar, Jun, Aug) sit where they fall
  // in time: one slot apart, a run-rate line steepens where the observations
  // bunch rather than where the growth does (time-axis.mjs). Two a month apart
  // on a year-and-a-half axis sit closer than a value label is wide - the label
  // of the second lands on the segment climbing into it, and thinned labels
  // leave the first one on the value axis - so such a line is read off its
  // value axis, with the latest value labelled at its end.
  const spacing = timePositions(categories);
  // A table's columns are even; points on an uneven time axis would drift
  // off them, the further the more uneven the gaps.
  if (spacing && props.categoryColumns) throw new Error(`${id}: a data table sets its periods in even columns, and these dates are unevenly spaced (${categories[0]} to ${categories.at(-1)}) - their points cannot sit over the columns; drop the table and label the points, or plot evenly spaced periods`);
  const crowded = Boolean(spacing) && spacing.slice(1).some((v, i) => (v - spacing[i]) * (frame.width - 120) < 64);
  const labelAt = (index) => !crowded || index === categories.length - 1;
  const showDataLabels = props.dataLabels === true || (props.dataLabels !== false && !endLabels && values.length <= 8);
  const showValueAxis = resolveValueAxis(props, { valueCount: values.length, dataLabelsVisible: showDataLabels && !crowded });
  if (showValueAxis && (props.changeAnnotations || []).some(annotation => annotation.style !== "arrow")) throw new Error("LINE_AXIS_CHANGE_STYLE: a visible value axis requires the diagonal arrow with its circular growth badge; omit the value axis for bracket annotations");
  const tight = !showValueAxis && props.gridlines !== true;
  const bounds = numericBounds(withReferenceValues(values, props, { base: props.yMin ?? Math.min(...values), padded: tight }), { min: props.yMin, max: props.yMax, axis: "y", tight });
  const labelWidth = axisLabelWidth(bounds);
  const labelHeightAt = (slot) => Math.max(...categories.map((c) => { try { return measureText(String(c), slot, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL), wrapWidthRatio: ENGINE_RESERVE }).height; } catch { return 28; } }));
  return { categories, series, lineColor, endLabels, showLegend, seriesGrowth, spacing, labelAt, showDataLabels, showValueAxis, bounds,
    labelWidth, labelHeightAt };
}

/** The plot inside the frame, the period labels' slot and height at its width, and the two scales. */
function linePlot(chart) {
  const { frame, props, categories, endLabels, showLegend, seriesGrowth, spacing, showDataLabels, showValueAxis, bounds, labelWidth,
    labelHeightAt } = chart;
  // The period labels sit 16px under the plot, clear of the markers on its
  // floor; the band keeps their measured height and no more, estimated at the
  // narrowest slot a label gets and settled once the plot is laid out.
  const labelSlotAt = (width) => Math.min(120, Math.max(76, width / Math.max(1, categories.length) * 0.82));
  const plot = chartFrame(frame, {
    topInset: props.plotTopInset,
    leftInset: showValueAxis ? Math.max(labelWidth + 8, showDataLabels ? 68 : 0) : showDataLabels ? 68 : 54,
    valueLabelInset: seriesGrowth ? 186 + 96 : showDataLabels ? 68 : 0,
    topLegend: showLegend,
    annotations: props.annotations,
    changeAnnotations: props.changeAnnotations,
    annotationRail: props.annotationRail,
    periodBand: periodBandHeight(props, categories),
    endLabels,
    bottomInset: labelBand(16, labelHeightAt(76)),
    labels: { gap: 16, height: (width) => labelHeightAt(labelSlotAt(width)) },
    span: tableSpan(props, frame, categories.length, { points: true })
  });
  const labelSlot = labelSlotAt(plot.width);
  const labelHeight = labelHeightAt(labelSlot);
  const yScale = (value) => plot.y + plot.height - (value - bounds.min) / bounds.span * plot.height;
  const xScale = (index) => plot.x + (categories.length === 1 ? plot.width / 2 : spacing ? plot.width * spacing[index] : plot.width * index / (categories.length - 1));
  return { plot, labelSlot, labelHeight, yScale, xScale };
}

/** The legend, the axes and the period labels - every nth when they are dense, the ones clear of their neighbours on a time axis. */
function lineAxes(chart) {
  const { id, frame, props, categories, series, showLegend, spacing, showValueAxis, bounds, labelWidth, plot, labelSlot, labelHeight, xScale } = chart;
  const nodes = [
    // Where a series says it is assumed or a reference, the key is a line - solid for a record, dashed for the rest - and says which.
    ...(showLegend ? topLegend({ id, frame, variant: statesSeries(props) ? "line" : "swatch", items: series.map((item, index) => ({ label: stateLabel(item, categories), colorIndex: props.colorIndices?.[index] ?? index,
      ...(seriesState(item, categories).state !== "recorded" ? { state: "forecast" } : {}) })) }) : []),
    ...axes(id, plot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true, showValueAxis, labelWidth })
  ];
  const pointMap = new Map();
  const categoryMap = new Map();
  const categorySlot = labelSlot;
  const slotX = (index) => Math.max(frame.x, Math.min(frame.x + frame.width - categorySlot, xScale(index) - categorySlot / 2));
  // On a time-spaced axis the labels are the ones whose slots clear their
  // neighbours' (time-axis.mjs spacedLabelIndices).
  const spacedLabels = spacing ? spacedLabelIndices(categories.map((_, index) => slotX(index)), categorySlot + 4) : null;
  // Dense periods (more categories than the plot has label slots) label every
  // nth point, always keeping the first and last, as a strong deck does.
  const pitch = categories.length > 1 ? (xScale(1) - xScale(0)) : plot.width;
  const widest = Math.max(...categories.map((c) => measureText(String(c), 400, { fontFamily: tokenValue(token("font.body")), fontSize: tokenValue(AXIS_LABEL) }).width));
  const { every, fromFirst } = periodLabelStep(categories.length, Math.max(monthlyLabelStep(categories), Math.ceil((widest + 10) / Math.max(1, pitch))));
  categories.forEach((category, index) => {
    // Every label is centred on its point; the first and last may reach into
    // the chart's own insets so the spacing stays even.
    const categoryX = slotX(index);
    categoryMap.set(category, { x: categoryX, y: plot.y, width: categorySlot, height: plot.height });
    const shown = spacedLabels ? spacedLabels.includes(index) : every === 1 || index % every === 0 || (!fromFirst && index === categories.length - 1);
    // The label is held inside the frame by its own width, not its slot's: a last point at the plot's edge, its slot clamped
    // in by half a slot, pushed "Q3-2026" into "Q3-2025" where its own ink needed a few pixels.
    const ink = Math.min(categorySlot, Math.ceil(measureText(String(category), 400, { fontFamily: tokenValue(token("font.body")), fontSize: tokenValue(AXIS_LABEL) }).width) + 4);
    const labelX = Math.max(frame.x, Math.min(frame.x + frame.width - ink, xScale(index) - ink / 2));
    if (shown && !(!spacedLabels && every > 1 && index === categories.length - 1 && (index % every) !== 0 && (categories.length - 1 - Math.floor((categories.length - 1) / every) * every) * pitch < widest + 10)) nodes.push(textPrimitive({ id: stableId(id, "category", category), role: "category-label", frame: { x: labelX, y: plot.y + plot.height + 16, width: ink, height: Math.min(40, Math.ceil(labelHeight) + 4) }, text: category, style: textStyle(AXIS_LABEL, INK, false, "center") }));
  });
  return { nodes, pointMap, categoryMap };
}

/** Each series: its area or lone fill, segments, markers and value labels; returns the end labels still to place. */
function drawLines(chart) {
  const { id, props, area, categories, series, lineColor, endLabels, labelAt, showDataLabels, bounds, plot, yScale, xScale, nodes, pointMap } = chart;
  const pendingEndLabels = [];
  const weight = markWeight();
  // A line alone on its plot takes a light fill beneath it (markWeight); two
  // or more lines keep bare strokes, where fills would stack into mud.
  // The fill is the weight of a record: a line that is an assumption, in whole or from part-way, stays a bare stroke.
  const lone = !area && series.length === 1 && weight.loneArea > 0 && props.area !== false && categories.length > 1 && seriesState(series[0], categories).state === "recorded";
  series.forEach((item, seriesIndex) => {
    const points = item.values.map((value, index) => ({ x: xScale(index), y: yScale(value), value, category: categories[index] }));
    if (area || lone) {
      const baselineValue = bounds.min <= 0 && bounds.max >= 0 ? 0 : bounds.min;
      const baselineY = yScale(baselineValue);
      const polygonPoints = [
        ...points.map(point => [Number(((point.x - plot.x) / plot.width).toFixed(6)), Number(((point.y - plot.y) / plot.height).toFixed(6))]),
        [Number(((points.at(-1).x - plot.x) / plot.width).toFixed(6)), Number(((baselineY - plot.y) / plot.height).toFixed(6))],
        [Number(((points[0].x - plot.x) / plot.width).toFixed(6)), Number(((baselineY - plot.y) / plot.height).toFixed(6))]
      ];
      nodes.push(shapePrimitive({
        id: stableId(id, "area", item.name),
        role: "chart-area",
        geometry: "customPolygon",
        frame: { x: plot.x, y: plot.y, width: plot.width, height: plot.height },
        style: { fill: lineColor(seriesIndex), stroke: "none", lineWidth: token("line.hairline"), opacity: area ? 0.18 : weight.loneArea },
        data: { paths: [polygonPoints], series: item.name, baselineValue, ...(lone ? { lone: true } : {}) }
      }));
    }
    // What the series is decides its stroke (chart-decorations.mjs SERIES_STATES): a record is solid with filled markers; an
    // assumed run - the whole series, or from `assumedFrom` on - dashed and lighter, its markers open; a reference kept
    // among the series a thin dashed rule with no markers at all.
    const { state, from: assumedAt } = seriesState(item, categories);
    const reference = state === "reference", assumed = (index) => state === "assumed" && index >= assumedAt;
    points.slice(1).forEach((point, index) => nodes.push(linePrimitive({
      id: stableId(id, "segment", item.name, index),
      role: "chart-line",
      x1: points[index].x,
      y1: points[index].y,
      x2: point.x,
      y2: point.y,
      style: reference || assumed(index + 1) ? lineStyle(lineColor(seriesIndex), token("line.standard"), "dash") : lineStyle(lineColor(seriesIndex), weight.line),
      ...(reference || assumed(index + 1) ? { data: { series: item.name, state } } : {})
    })));
    const labelSides = lineLabelSides(points.map(point => point.value));
    const radius = weight.marker / 2;
    points.forEach((point, pointIndex) => {
      if (!reference) nodes.push(ellipsePrimitive({
        id: stableId(id, "point", item.name, point.category),
        role: "chart-marker",
        frame: { x: point.x - radius, y: point.y - radius, width: weight.marker, height: weight.marker },
        style: assumed(pointIndex) ? fillStyle(token("color.canvas"), lineColor(seriesIndex), token("line.standard")) : fillStyle(lineColor(seriesIndex)),
        ...(assumed(pointIndex) ? { data: { series: item.name, state } } : {})
      }));
      const mappedPoint = { ...point, changeX: point.x, changeY: point.y - (showDataLabels ? 30 : 16) };
      pointMap.set(`${item.name}:${point.category}`, mappedPoint);
      if (series.length === 1) pointMap.set(`value:${point.category}`, mappedPoint);
      const categoryPoint = pointMap.get(`category:${point.category}`);
      if (!categoryPoint || mappedPoint.y < categoryPoint.y) pointMap.set(`category:${point.category}`, mappedPoint);
      if (showDataLabels && !reference && labelAt(points.indexOf(point)) && !(endLabels && point.category === categories.at(-1))) {
        const first = point.category === categories[0];
        const last = point.category === categories.at(-1);
        nodes.push(textPrimitive({
          id: stableId(id, "value-label", item.name, point.category),
          role: "data-label",
          frame: first
            ? { x: point.x - 68, y: point.y - 12, width: 60, height: 24 }
            : last ? { x: point.x + 8, y: point.y - 12, width: 60, height: 24 }
            : { x: point.x - 30, y: labelSides[points.indexOf(point)] === "below" ? point.y + radius : point.y - 22 - radius, width: 60, height: 24 },
          text: formatValue(point.value, props),
          data: { series: item.name, category: point.category, value: point.value, labelKind: "point" },
          style: textStyle(CHART_LABEL, INK, labelBold(), first ? "right" : last ? "left" : "center")
        }));
      }
    });
    if (endLabels) {
      const point = points.at(-1);
      // The label starts clear of the 10px marker, not on it.
      pendingEndLabels.push({ id: stableId(id, "end-label", item.name), x: point.x + 9, y: point.y - 12, text: `${stateLabel(item, categories)} ${formatValue(point.value, props)}`, data: { series: item.name, category: point.category, value: point.value, labelKind: "series-end" }, color: lineColor(seriesIndex) });
    }
  });
  return { pendingEndLabels };
}

/** The series' end labels, pushed apart, and the growth column beside them. */
function placeEndLabels(chart) {
  const { id, seriesGrowth, plot, nodes, pendingEndLabels } = chart;
  // End labels of lines that finish close together push apart (22px minimum)
  // inside the plot, in y order, so no series name sits on another.
  if (pendingEndLabels.length) {
    const step = 22, sorted = [...pendingEndLabels].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i++) sorted[i].y = Math.max(sorted[i].y, sorted[i - 1].y + step);
    const overflow = sorted.at(-1).y + 24 - (plot.y + plot.height);
    if (overflow > 0) for (const label of sorted) label.y -= overflow;
    for (let i = sorted.length - 2; i >= 0; i--) sorted[i].y = Math.min(sorted[i].y, sorted[i + 1].y - step);
    for (const label of pendingEndLabels) nodes.push(textPrimitive({ id: label.id, role: "data-label", frame: { x: label.x, y: label.y, width: 176, height: 24 }, text: label.text, data: label.data, style: textStyle(CHART_LABEL, label.color, true, "left") }));
    if (seriesGrowth) {
      // The column starts a gap after the longest end label, so the rates read
      // as that label's next word rather than a column across the page.
      const longest = Math.max(...pendingEndLabels.map((label) => measureDataLabel(label.text).width));
      const x = plot.x + plot.width + 9 + Math.min(176, longest) + 16, width = 76;
      nodes.push(textPrimitive({ id: stableId(id, "growth-heading"), role: "chart-delta-label", frame: { x, y: sorted[0].y - 22, width, height: 20 }, text: seriesGrowth.label, style: textStyle(token("type.compact"), SECONDARY, false, "left"), data: { growthHeading: true } }));
      for (const label of pendingEndLabels) {
        const row = seriesGrowth.rows.find((entry) => entry.name === label.data.series);
        nodes.push(textPrimitive({ id: stableId(id, "growth", row.name), role: "chart-delta-label", frame: { x, y: label.y, width, height: 24 }, text: row.text, style: textStyle(CHART_LABEL, INK, true, "left"), data: { series: row.name, growth: row.text } }));
      }
    }
  }
}

/** `pointHighlights`: a numbered disc over each named point. */
function drawPointHighlights(chart) {
  const { id, props, series, nodes, pointMap } = chart;
  for (const [index, highlight] of (props.pointHighlights || []).entries()) {
    const target = pointMap.get(`${highlight.series || series[0].name}:${highlight.category}`)
      || pointMap.get(`value:${highlight.category}`);
    if (!target) throw new Error(`${id} point highlight references unknown category ${highlight.category}`);
    const size = highlight.size || 48;
    nodes.push(ellipsePrimitive({
      id: stableId(id, "point-highlight", index),
      role: "chart-point-highlight",
      frame: { x: target.x - size / 2, y: target.y - size / 2, width: size, height: size },
      style: fillStyle(INK, INK)
    }));
    nodes.push(textPrimitive({
      id: stableId(id, "point-highlight-label", index),
      role: "chart-point-highlight-label",
      frame: { x: target.x - size / 2, y: target.y - size / 2, width: size, height: size },
      text: highlight.label || String(index + 1),
      style: textStyle(token("type.heading"), token("color.onPrimary"), false, "center")
    }));
  }
}

// A combo's line on its own scale drawn under this many pixels of rise: its
// change is refused, and the two measures sent to two panels.
const LINE_RISE_MIN = 48;
export function comboChart({ id, frame, props }) {
  assertGridlineOption(props);
  const { categories, series } = normalizedCategoricalData(props, { seriesCount: 2 });
  const plot = chartFrame(frame, {
    topInset: props.plotTopInset,
    periodBand: periodBandHeight(props, categories),
    topLegend: true,
    annotations: props.annotations,
    changeAnnotations: props.changeAnnotations,
    annotationRail: props.annotationRail,
    span: tableSpan(props, frame, categories.length)
  });
  // Labelled marks need no value axis; the bars take a zero-anchored domain and,
  // with `secondaryAxis`, the line takes its own padded domain (a margin over a revenue).
  const showDataLabels = props.dataLabels !== false;
  const showValueAxis = resolveValueAxis(props, { valueCount: categories.length * 2, dataLabelsVisible: showDataLabels });
  const barSeries = series[0];
  const lineSeries = series[1];
  const lineRange = Math.max(...lineSeries.values) - Math.min(...lineSeries.values);
  const secondary = props.secondaryAxis === true;
  // Independent units get separate vertical fields on the same categories.
  // Reserve their label clearance before scaling, including when the primary
  // value axis is visible; padding its domain alone lets the line cross labels.
  // The line's band is a third of the plot, and half when a third leaves its
  // change under LINE_RISE_MIN: under two callout bands a fleet age that
  // doubles (5.2 to 10.8 years) can rise 14px, a flat line over the bars.
  const lineBounds = secondary ? numericBounds(lineSeries.values, { min: props.y2Min, max: props.y2Max, axis: "y", tight: true }) : null;
  // A line that does not move is drawn flat because it is flat - a margin
  // held level while revenue grew is the finding - so only a line that changes
  // is held to the rise its change needs.
  const riseAt = (share) => lineRange / lineBounds.span * Math.max(0, plot.height * share - 30);
  const flat = lineRange === 0;
  const lineShare = !secondary || flat || riseAt(0.35) >= LINE_RISE_MIN ? 0.35 : 0.5;
  if (secondary && !flat && riseAt(lineShare) < LINE_RISE_MIN)
    throw new Error(`The combo's line (${lineSeries.name}) rises ${Math.round(riseAt(lineShare))}px in the band a second scale leaves it above the bars - under the ${LINE_RISE_MIN}px its change needs to read, so it draws flat. Two measures in different units read as two panels, each on its own scale: type "panels", form "row", a column panel for ${barSeries.name} and a line panel for ${lineSeries.name}${(props.annotations || []).length ? " (or drop a callout, whose band takes the plot's height)" : ""}`);
  const barPlot = secondary ? { ...plot, y: plot.y + plot.height * lineShare + 40, height: plot.height * (1 - lineShare) - 40 } : plot;
  if (barPlot.height < 40) throw new Error("Combo chart needs more height for separate scales and labels; give it more height or drop secondaryAxis");
  const bounds = numericBounds(withReferenceValues(secondary ? barSeries.values : series.flatMap(item => item.values), props), { min: props.yMin, max: props.yMax, axis: "y", includeZero: true, tight: !showValueAxis && props.gridlines !== true });
  const yScale = (value) => barPlot.y + barPlot.height - (value - bounds.min) / bounds.span * barPlot.height;
  const lineBand = { top: plot.y + 30, height: Math.max(0, plot.height * lineShare - 30) };
  const y2Scale = (value) => lineBand.top + lineBand.height - (value - lineBounds.min) / lineBounds.span * lineBand.height;
  const lineScale = secondary ? y2Scale : yScale;
  const categorySpan = plot.width / categories.length;
  const barWidth = categorySpan * 0.58;
  const nodes = [
    ...topLegend({ id, frame, items: series.map((item, index) => ({ label: stateLabel(item, categories), colorIndex: index, ...(item === lineSeries ? { mark: "line" } : {}) })) }),
    ...axes(id, barPlot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true, showValueAxis })
  ];
  const pointMap = new Map();
  const categoryMap = new Map();
  const linePoints = [];
  // A currency leads its figure: suffixed, "$m" prints "888$m" on a deck that
  // writes "$878m" on every other page. The unit decides which end it goes on.
  const secondaryCurrency = String(props.secondaryUnit ?? "").trim().match(/^([$£€¥₹])\s*(.*)$/);
  const secondaryFormat = props.secondaryValueFormat ?? props.valueFormat ?? {};
  // A word unit ("listings", "msf") is set off by a space; a symbol or a scale ("%", "x", "m", "bn") is not.
  const spaced = (unit) => (/^[A-Za-z]{3,}/.test(unit) ? ` ${unit}` : unit);
  const unitFormat = secondaryCurrency
    ? { prefix: secondaryCurrency[1], suffix: spaced(secondaryCurrency[2]) }
    : props.secondaryUnit ? { prefix: "", suffix: spaced(String(props.secondaryUnit).trim()) } : {};
  const lineFormat = secondary
    ? { ...props, valueFormat: { ...secondaryFormat, ...unitFormat,
        ...props.secondaryValueFormat, grouping: secondaryFormat.grouping ?? true } }
    : props;
  categories.forEach((category, index) => {
    const x = plot.x + categorySpan * index + categorySpan / 2;
    const barValueY = yScale(barSeries.values[index]);
    const zeroY = yScale(0);
    const bar = {
      x: x - barWidth / 2,
      y: Math.min(barValueY, zeroY),
      width: barWidth,
      height: Math.max(1, Math.abs(zeroY - barValueY))
    };
    nodes.push(rectPrimitive({
      id: stableId(id, "bar", category),
      role: "chart-mark",
      frame: bar,
      style: fillStyle(SERIES[0])
    }));
    nodes.push(textPrimitive({
      id: stableId(id, "category", category),
      role: "category-label",
      frame: { x: x - categorySpan / 2, y: plot.y + plot.height + 16, width: categorySpan, height: 40 },
      text: category,
      style: textStyle(AXIS_LABEL)
    }));
    const barPoint = { x, y: barValueY, changeX: x, changeY: barValueY + (barSeries.values[index] >= 0 ? -16 : 16) };
    const lineY = lineScale(lineSeries.values[index]);
    const linePoint = { x, y: lineY, changeX: x, changeY: lineY - 16 };
    if (showDataLabels) {
      // The bar's value sits inside its top in white when the bar is tall enough, else above it;
      // the line's value sits above its point, clear of the bar label.
      const inside = !secondary && bar.height >= 40;
      nodes.push(textPrimitive({ id: stableId(id, "value-label", barSeries.name, category), role: "data-label", frame: { x: bar.x, y: inside ? bar.y + 6 : bar.y - 26, width: bar.width, height: 24 }, text: formatValue(barSeries.values[index], props), style: textStyle(CHART_LABEL, inside ? token("color.onPrimary") : INK, true, "center"), data: { category, series: barSeries.name } }));
      const text = formatValue(lineSeries.values[index], lineFormat);
      // Above its point, unless a steep neighbour's segment runs through that box: then under the point, where it clears the bar label.
      const above = Math.min(lineY - 30, inside ? bar.y - 26 : bar.y - 52), under = lineY + 8;
      const half = Math.min(categorySpan, text.length * 7 + 8) / 2;
      const crossed = (top) => [index - 1, index + 1].filter((j) => j >= 0 && j < categories.length).some((j) => {
        const jx = plot.x + categorySpan * j + categorySpan / 2, jy = lineScale(lineSeries.values[j]);
        return Array.from({ length: 21 }, (_, k) => k / 20).some((t) => { const px = x + (jx - x) * t, py = lineY + (jy - lineY) * t; return px > x - half && px < x + half && py > top && py < top + 24; });
      });
      const roomUnder = under + 24 <= (inside ? bar.y : bar.y - 28);
      // A callout keyed to this category takes the space by its mark, so the label stays above there.
      const called = (props.annotations || []).some((note) => String(note?.category) === String(category));
      const ly = crossed(above) && roomUnder && !called && !crossed(under) ? under : above;
      nodes.push(textPrimitive({ id: stableId(id, "value-label", lineSeries.name, category), role: "data-label", frame: { x: x - categorySpan / 2, y: ly, width: categorySpan, height: 24 }, text, style: textStyle(CHART_LABEL, SERIES[1], true, "center"), data: { category, series: lineSeries.name } }));
    }
    categoryMap.set(category, { x: x - categorySpan / 2, y: plot.y, width: categorySpan, height: plot.height });
    pointMap.set(`${barSeries.name}:${category}`, barPoint);
    pointMap.set(`${lineSeries.name}:${category}`, linePoint);
    pointMap.set(`category:${category}`, barPoint.y < linePoint.y ? barPoint : linePoint);
    linePoints.push({ ...linePoint, category });
  });
  linePoints.slice(1).forEach((point, index) => nodes.push(linePrimitive({
    id: stableId(id, "segment", lineSeries.name, index),
    role: "chart-line",
    x1: linePoints[index].x,
    y1: linePoints[index].y,
    x2: point.x,
    y2: point.y,
    style: lineStyle(SERIES[1], token("line.standard"), seriesState(lineSeries, categories).state === "recorded" || index + 1 < seriesState(lineSeries, categories).from ? "solid" : "dash")
  })));
  linePoints.forEach((point) => nodes.push(ellipsePrimitive({
    id: stableId(id, "point", lineSeries.name, point.category),
    role: "chart-marker",
    frame: { x: point.x - 5, y: point.y - 5, width: 10, height: 10 },
    style: fillStyle(SERIES[1])
  })));
  return withDecorations(nodes, { id, plot, props, pointMap, categoryMap, yScale });
}
