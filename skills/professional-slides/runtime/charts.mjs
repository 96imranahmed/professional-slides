import { formatValue } from "./value-format.mjs";
export { formatValue } from "./value-format.mjs";
import {
  ellipsePrimitive,
  TOKENS,
  chartAnnotationStyle,
  isTokenReference,
  tokenDefinition,
  linePrimitive,
  rectPrimitive,
  shapePrimitive,
  stableId,
  textPrimitive,
  token,
  tokenValue,
  wedgePrimitive
} from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { legendNodes, LEGEND_TOKENS } from "./legends.mjs";
import { contrastRatio } from "./palettes.mjs";
import { CHART_GUIDANCE } from "./guidance.mjs";
import {
  HORIZONS_SAMPLE,
  HORIZONS_TOKENS,
  HORIZONS_VARIANTS,
  renderHorizons,
  resolveHorizonsVariant
} from "./horizons.mjs";
import {
  chartAnnotationBands,
  EVIDENCE_CALLOUT_BAND,
  evidenceAnnotationTopBandCount,
  renderAnnotationRail,
  renderChangeAnnotations,
  renderEvidenceAnnotations
} from "./chart-annotations.mjs";

const FONT = token("font.body");
const INK = token("color.ink");
const SECONDARY = token("color.textSecondary");
const GRID = token("color.chartGrid");
const PRIMARY = token("color.chartSeries1");
const CHART_LABEL = token("type.chartLabel");
const CHART_ANNOTATION = token("type.chartAnnotation");
const AXIS_LABEL = token("type.chartLabel");
const SPARSE_DIRECT_LABEL_LIMIT = 8;
const SERIES = [
  token("color.chartSeries1"),
  token("color.chartSeries2"),
  token("color.chartSeries3"),
  token("color.chartSeries4"),
  token("color.chartSeries5"),
  token("color.chartSeries6")
];

function chartFrame(frame, { topLegend = false, annotations = [], changeAnnotations = [], annotationRail = null, endLabels = false, leftInset = 54, centerPlot = false, valueLabelInset = 0, totalLabelInset = 0 } = {}) {
  const bands = chartAnnotationBands({ changeAnnotations, annotationRail });
  leftInset = Math.max(leftInset, bands.left);
  const top = (topLegend ? 52 : 28) + totalLabelInset + evidenceAnnotationTopBandCount({ annotations }) * EVIDENCE_CALLOUT_BAND + bands.top;
  // Reserve the actual last metric row plus a trailing theme gap, not another full row band.
  const bottom = bands.bottom ? 40 + bands.bottom + tokenValue(token("space.3")) : 68;
  const rightInset = Math.max(valueLabelInset, endLabels ? 186 : centerPlot && !bands.left ? leftInset : 16);
  if (frame.height - bottom - top < 100) throw new Error("Chart annotation bands leave insufficient plot height; enlarge or split the exhibit");
  if (frame.width - leftInset - rightInset < 120) throw new Error("Chart has insufficient plot width; enlarge or split the exhibit");
  return {
    x: frame.x + leftInset,
    y: frame.y + top,
    width: frame.width - leftInset - rightInset,
    height: Math.max(100, frame.height - bottom - top)
  };
}


function textStyle(size = CHART_LABEL, color = SECONDARY, bold = false, align = "center") {
  return { ...(bold ? chartAnnotationStyle() : { fontFamily: FONT }), fontSize: size, color, bold, align, valign: "mid" };
}

function lineStyle(stroke = GRID, width = token("line.hairline"), dash = "solid") {
  return { stroke, lineWidth: width, dash };
}

function fillStyle(fill, stroke = fill, width = token("line.hairline"), opacity = 1) {
  return { fill, stroke, lineWidth: width, opacity };
}

function topLegend({ id, frame, items, align = "right", variant = "swatch" }) {
  if (!items.length) return [];
  return legendNodes({ id, frame: { x: frame.x + 54, y: frame.y + 7, width: frame.width - 70, height: 28 }, props: { items, placement: align === "right" ? "top-right" : "top", variant } });
}

/**
 * Tick steps a reader recognises: 1, 2, 2.5 or 5 times a power of ten.
 * Interpolating the raw data extrema instead yields axes reading 14.025 or
 * 22.75, which is the loudest amateur tell a chart can carry.
 */
const STEP_LADDER = Object.freeze([1, 2, 2.5, 5]);

/** Candidate steps in ascending order, starting a decade below the rough step. */
function* stepCandidates(rough) {
  const start = Math.floor(Math.log10(rough > 0 && Number.isFinite(rough) ? rough : 1)) - 1;
  for (let exponent = start; exponent <= start + 4; exponent += 1) {
    const magnitude = Math.pow(10, exponent);
    for (const rung of STEP_LADDER) yield rung * magnitude;
  }
}

function range(values, includeZero, steps = 4) {
  let min = Math.min(...values), max = Math.max(...values);
  if (includeZero) { min = Math.min(0, min); max = Math.max(0, max); }
  if (min === max) {
    const padding = Math.abs(min) * 0.05 || 1;
    min -= padding; max += padding;
  }
  // Round the domain outward so that it spans exactly `steps` whole steps. Only
  // then is every tick a nice number; rounding the endpoints alone still leaves
  // a span like 50 divided into four parts of 12.5.
  const dataMin = min, dataMax = max;
  // Smallest ladder step whose `steps` whole increments, anchored at or below the
  // data minimum, still reach the data maximum. Smallest keeps the plot full.
  let step = null, niceMin = 0;
  for (const candidate of stepCandidates((dataMax - dataMin) / steps)) {
    const start = Math.floor(dataMin / candidate + 1e-9) * candidate;
    if (start + candidate * steps >= dataMax - 1e-9) { step = candidate; niceMin = start; break; }
  }
  if (step === null) { step = (dataMax - dataMin) / steps; niceMin = dataMin; }
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + (STEP_LADDER.includes(step / Math.pow(10, Math.floor(Math.log10(step)))) && String(step / Math.pow(10, Math.floor(Math.log10(step)))) === "2.5" ? 1 : 0));
  const round = (value) => Number(value.toFixed(Math.min(10, decimals)));
  min = round(niceMin);
  max = round(niceMin + step * steps);
  return { min, max, span: max - min || 1, step: round(step) };
}

function assertGridlineOption(props) {
  if (props.gridlines !== undefined && typeof props.gridlines !== "boolean") throw new Error("Chart gridlines must be true or false");
  if (props.showValueAxis !== undefined && typeof props.showValueAxis !== "boolean") throw new Error("Chart showValueAxis must be true or false");
  if (props.showValueAxis === false && props.gridlines === true) throw new Error("Chart gridlines require a visible value axis");
}

function resolveValueAxis(props, { valueCount, dataLabelsVisible }) {
  if (props.showValueAxis !== undefined) return props.showValueAxis;
  if (props.gridlines === true) return true;
  return !(dataLabelsVisible && valueCount < SPARSE_DIRECT_LABEL_LIMIT);
}

function normalizedCategoricalData(props, { seriesCount = null } = {}) {
  if (!Array.isArray(props.categories) || !props.categories.length || props.categories.some(category => typeof category !== "string" || !category.trim()) || new Set(props.categories).size !== props.categories.length) {
    throw new Error("Categorical charts require one or more unique non-empty categories");
  }
  if (!Array.isArray(props.series) || !props.series.length || (seriesCount !== null && props.series.length !== seriesCount)) {
    throw new Error(seriesCount === null ? "Categorical charts require one or more series" : `This chart requires exactly ${seriesCount} series`);
  }
  const names = new Set();
  const series = props.series.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.name !== "string" || !item.name.trim()) throw new Error(`series[${index}] requires a non-empty name`);
    if (names.has(item.name)) throw new Error(`Chart series names must be unique: ${item.name}`);
    names.add(item.name);
    if (!Array.isArray(item.values) || item.values.length !== props.categories.length || item.values.some(value => !Number.isFinite(value))) {
      throw new Error(`series[${index}].values must contain one finite value per category`);
    }
    return { ...item, values: [...item.values] };
  });
  return { categories: [...props.categories], series };
}

function numericBounds(values, { min, max, axis = "y", includeZero = false } = {}) {
  if (!Array.isArray(values) || !values.length || values.some(value => !Number.isFinite(value))) throw new Error(`${axis}-axis values must be finite`);
  const computed = range(values, includeZero);
  const bounds = { min: min ?? computed.min, max: max ?? computed.max };
  if (!Number.isFinite(bounds.min) || !Number.isFinite(bounds.max) || bounds.max <= bounds.min) throw new Error(`${axis}-axis maximum must be greater than its minimum`);
  if (includeZero && (bounds.min > 0 || bounds.max < 0)) throw new Error(`${axis}-axis bounds for bars must include zero`);
  if (values.some(value => value < bounds.min || value > bounds.max)) throw new Error(`${axis}-axis bounds must contain every plotted value`);
  return { ...bounds, span: bounds.max - bounds.min };
}

const HIGHLIGHT_STYLES = Object.freeze(["bar", "region-box", "region-tint"]);
const REGION_HIGHLIGHT_INLINE_PAD = 12;
const REGION_HIGHLIGHT_BLOCK_PAD = 12;

function normalizedHighlights(props, { categories = [], series = [], allowBar = false } = {}) {
  const highlights = props.highlights || [];
  if (!Array.isArray(highlights)) throw new Error("Chart highlights must be an array");
  if (highlights.length > 1) throw new Error("Use one primary chart highlight mechanism");
  const seriesNames = series.map(item => typeof item === "string" ? item : item.name);
  return highlights.map((highlight) => {
    if (!highlight || typeof highlight.category !== "string" || !categories.includes(highlight.category)) throw new Error("Chart highlight references an unknown category");
    const style = highlight.style ?? "region-tint";
    if (!HIGHLIGHT_STYLES.includes(style)) throw new Error(`Unknown chart highlight style: ${style}`);
    if (style === "bar") {
      if (!allowBar) throw new Error("A single-bar highlight is available only for an unstacked one-series bar or column chart");
      if (seriesNames.length && seriesNames.length !== 1) throw new Error("A single-bar highlight requires exactly one series; use a region highlight for grouped bars");
      if (seriesNames.length && highlight.series !== undefined && highlight.series !== seriesNames[0]) throw new Error("Single-bar highlight references an unknown series");
    } else if (highlight.series !== undefined) {
      throw new Error("A region highlight applies to the complete category and does not accept a series");
    }
    return { ...highlight, style };
  });
}

function axisTickText(min, max, index, steps = 4) {
  const value = min + (max - min) * index / steps;
  // The domain is already rounded to whole steps, so the tick is exact; trim the
  // binary-float tail rather than inventing precision.
  const decimals = Math.max(0, ...[min, max, (max - min) / steps].map((entry) => {
    const text = String(Number(entry.toPrecision(12)));
    return text.includes(".") ? text.split(".")[1].length : 0;
  }));
  return String(Number(value.toFixed(Math.min(10, decimals))));
}

function axisLabelWidth(bounds) {
  return Math.max(48, ...Array.from({ length: 5 }, (_, index) => Math.ceil(measureText(axisTickText(bounds.min, bounds.max, index), 1000, { fontSize: tokenValue(AXIS_LABEL), wrapWidthRatio: 1 }).width)));
}

function axes(id, plot, yMin, yMax, steps = 4, { gridlines = false, showValueAxis = true, labelWidth = 48 } = {}) {
  const nodes = [];
  if (showValueAxis) {
    for (let index = 0; index <= steps; index += 1) {
      const y = plot.y + plot.height - plot.height * index / steps;
      if (gridlines) {
        nodes.push(linePrimitive({
          id: stableId(id, "grid", index),
          role: "chart-gridline",
          x1: plot.x,
          y1: y,
          x2: plot.x + plot.width,
          y2: y,
          style: lineStyle()
        }));
      }
      nodes.push(textPrimitive({
        id: stableId(id, "axis-label", index),
        role: "axis-label",
        frame: { x: plot.x - labelWidth - 8, y: y - 12, width: labelWidth, height: 24 },
        // Labels describe the actual tick, not a rounded neighbouring value.
        text: axisTickText(yMin, yMax, index, steps),
        style: textStyle(AXIS_LABEL, SECONDARY, false, "right")
      }));
    }
    nodes.push(linePrimitive({
      id: stableId(id, "y-axis"), role: "chart-axis",
      x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height,
      style: lineStyle(INK)
    }));
  }
  nodes.push(linePrimitive({
    id: stableId(id, "x-axis"), role: "chart-axis",
    x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height,
    style: lineStyle(INK)
  }));
  return nodes;
}

function horizontalAxes(id, plot, xMin, xMax, steps = 4, { gridlines = false, showValueAxis = true } = {}) {
  const nodes = [];
  if (showValueAxis) {
    for (let index = 0; index <= steps; index += 1) {
      const x = plot.x + plot.width * index / steps;
      if (gridlines) nodes.push(linePrimitive({
        id: stableId(id, "grid", index), role: "chart-gridline",
        x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height,
        style: lineStyle()
      }));
      nodes.push(textPrimitive({
        id: stableId(id, "axis-label", index), role: "axis-label",
        frame: { x: x - 28, y: plot.y + plot.height + 8, width: 56, height: 24 },
        text: String(Number((xMin + (xMax - xMin) * index / steps).toPrecision(6))),
        style: textStyle(AXIS_LABEL, SECONDARY, false, "center")
      }));
    }
  }
  const zeroX = plot.x + (0-xMin)/(xMax-xMin)*plot.width;
  nodes.push(linePrimitive({ id: stableId(id, "y-axis"), role: "chart-axis", x1: zeroX, y1: plot.y, x2: zeroX, y2: plot.y + plot.height, style: lineStyle(INK) }));
  if (showValueAxis) nodes.push(linePrimitive({ id: stableId(id, "x-axis"), role: "chart-axis", x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height, style: lineStyle(INK) }));
  return nodes;
}

function decorations({ id, plot, props, pointMap = new Map(), categoryMap = new Map(), yScale = null, xScale = null, obstacles = [], allowBarHighlight = false, allowAnnotationRail = true, allowOutsideReferenceLabels = false }) {
  const underlay = [];
  const overlay = [];
  // Horizontal charts carry a value axis along x: a reference is a vertical line
  // with its label set above the plot, clear of the bars.
  if (!yScale && xScale) {
    for (const [index, reference] of (props.referenceLines || []).entries()) {
      const x = xScale(reference.value);
      underlay.push(linePrimitive({ id: stableId(id, "reference-line", index), role: "chart-reference-line", x1: x, y1: plot.y - 4, x2: x, y2: plot.y + plot.height, style: lineStyle(token("color.componentPrimary"), token("line.standard"), "dash") }));
      if (reference.label) {
        const measured = measureText(reference.label, 260, { fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL), bold: true, wrapWidthRatio: 1 });
        const left = Math.min(plot.x + plot.width - measured.width, x + 6);
        overlay.push(textPrimitive({ id: stableId(id, "reference-label", index), role: "chart-reference-label", frame: { x: left, y: plot.y - measured.height - 6, width: measured.width, height: measured.height }, text: measured.text, style: { ...textStyle(CHART_LABEL, token("color.componentPrimary"), true, "left"), valign: "top", lineHeight: measured.lineHeight, wrap: false }, data: { textLayout: measured, value: reference.value } }));
      }
    }
  }
  const evidenceAnnotations = renderEvidenceAnnotations({ id, plot, props, pointMap, obstacles });
  const annotationPlacements = evidenceAnnotations.placements;
  const overlaps = (a, b, padding = 4) => !(
    a.x + a.width + padding <= b.x
    || b.x + b.width + padding <= a.x
    || a.y + a.height + padding <= b.y
    || b.y + b.height + padding <= a.y
  );
  const highlights = normalizedHighlights(props, { categories: [...categoryMap.keys()], allowBar: allowBarHighlight });
  for (const [index, highlight] of highlights.entries()) {
    if (highlight.style === "bar") continue;
    const target = categoryMap.get(highlight.category);
    if (!target) throw new Error(`${id} highlight references unknown category ${highlight.category}`);
    const box = highlight.style === "region-box";
    const frame = target.height === plot.height
      ? {
          x: target.x - REGION_HIGHLIGHT_INLINE_PAD,
          y: plot.y - REGION_HIGHLIGHT_BLOCK_PAD,
          width: target.width + REGION_HIGHLIGHT_INLINE_PAD * 2,
          height: plot.height + REGION_HIGHLIGHT_BLOCK_PAD * 2
        }
      : target.width === plot.width
        ? {
            x: plot.x - REGION_HIGHLIGHT_INLINE_PAD,
            y: target.y - REGION_HIGHLIGHT_BLOCK_PAD,
            width: plot.width + REGION_HIGHLIGHT_INLINE_PAD * 2,
            height: target.height + REGION_HIGHLIGHT_BLOCK_PAD * 2
          }
        : {
            x: target.x - REGION_HIGHLIGHT_BLOCK_PAD,
            y: target.y - REGION_HIGHLIGHT_BLOCK_PAD,
            width: target.width + REGION_HIGHLIGHT_BLOCK_PAD * 2,
            height: target.height + REGION_HIGHLIGHT_BLOCK_PAD * 2
          };
    underlay.push(rectPrimitive({
      id: stableId(id, "highlight", index),
      role: "chart-highlight",
      frame,
      style: box
        ? { fill: "none", stroke: token("color.componentPrimary"), lineWidth: token("line.standard"), opacity: 1 }
        : { fill: token("color.surfaceMuted"), stroke: "none", lineWidth: token("line.hairline"), opacity: 0.8 },
      data: { category: highlight.category, highlightStyle: highlight.style }
    }));
  }
  if (yScale) {
    for (const [index, reference] of (props.referenceLines || []).entries()) {
      if(reference.placement === "outside-end" && !allowOutsideReferenceLabels) throw new Error("Outside reference labels are supported only on column charts");
      const y = yScale(reference.value);
      underlay.push(linePrimitive({
        id: stableId(id, "reference-line", index),
        role: "chart-reference-line",
        x1: plot.x,
        y1: y,
        x2: plot.x + plot.width,
        y2: y,
        style: lineStyle(token("color.componentPrimary"), token("line.standard"), "dash")
      }));
      const text = reference.label || String(reference.value);
      const measured = measureText(text, Math.min(240, plot.width * 0.45), { fontFamily: tokenValue(token("font.body")), fontSize: tokenValue(CHART_ANNOTATION), bold: true, wrapWidthRatio: 1 });
      const labelWidth = Math.ceil(measured.width) + 2;
      const labelHeight = measured.height;
      const labelCandidates = reference.placement === "outside-end" ? [
        { x: plot.x + plot.width + tokenValue(token("space.3")), y: y-labelHeight/2, width: labelWidth, height: labelHeight, align: "left" }
      ] : [
        { x: plot.x + plot.width - labelWidth - 4, y: y - labelHeight - 8, width: labelWidth, height: labelHeight, align: "right" },
        { x: plot.x + 8, y: y - labelHeight - 8, width: labelWidth, height: labelHeight, align: "left" },
        { x: plot.x + plot.width - labelWidth - 4, y: y + 8, width: labelWidth, height: labelHeight, align: "right" },
        { x: plot.x + 8, y: y + 8, width: labelWidth, height: labelHeight, align: "left" }
      ];
      const labelFrame = labelCandidates.find((candidate) => candidate.y >= plot.y && candidate.y + candidate.height <= plot.y + plot.height && annotationPlacements.every(({ frame }) => !overlaps(candidate, frame)) && [...obstacles, ...overlay].filter((node) => ["chart-mark", "data-label", "chart-reference-label"].includes(node.role)).every((node) => !overlaps(candidate, node.frame)) && (reference.placement === "outside-end" || (props.referenceLines || []).every(other => yScale(other.value) < candidate.y - 4 || yScale(other.value) > candidate.y + candidate.height + 4)));
      if (!labelFrame) throw new Error("No collision-free reference-line label position; revise the chart composition");
      overlay.push(textPrimitive({
        id: stableId(id, "reference-label", index),
        role: "chart-reference-label",
        frame: { x: labelFrame.x, y: labelFrame.y, width: labelFrame.width, height: labelFrame.height },
        text: measured.text,
        style: { ...textStyle(CHART_ANNOTATION, token("color.componentPrimary"), true, labelFrame.align), lineHeight: measured.lineHeight, wrap: false },
        data: { textLayout: measured }
      }));
    }
  }
  overlay.push(...evidenceAnnotations.nodes);
  overlay.push(...renderChangeAnnotations({ id, plot, props, pointMap }));
  overlay.push(...renderAnnotationRail({ id, plot, props, categoryMap, allow: allowAnnotationRail }));
  return { underlay, overlay };
}

function withDecorations(nodes, options) {
  const { underlay, overlay } = decorations({ ...options, obstacles: nodes });
  const backings = [];
  for (const label of nodes.filter((node) => node.role === "data-label")) {
    const resolve = (value, fallback) => isTokenReference(value) ? tokenValue(value) : (value?.value ?? value ?? fallback);
    const measured = measureText(label.text, label.frame.width + 0.5, { fontFamily: resolve(label.style.fontFamily, "Arial"), fontSize: resolve(label.style.fontSize, tokenValue(CHART_LABEL)), bold: label.style.bold, wrapWidthRatio: 1 });
    const width = measured.width + 4, height = measured.height + 2;
    const x = label.style.align === "left" ? label.frame.x - 2 : label.style.align === "right" ? label.frame.x + label.frame.width - width + 2 : label.frame.x + (label.frame.width - width) / 2;
    const frame = { x, y: label.frame.y + (label.frame.height - height) / 2, width, height };
    const insideMark = nodes.some((node) => node.role === "chart-mark" && frame.x >= node.frame.x && frame.y >= node.frame.y && frame.x + width <= node.frame.x + node.frame.width && frame.y + height <= node.frame.y + node.frame.height);
    const crossesGrid = nodes.some((node) => node.role === "chart-gridline" && node.frame.y > frame.y && node.frame.y < frame.y + height && node.frame.x < frame.x + width && node.frame.x + node.frame.width > frame.x);
    if (!insideMark && crossesGrid) backings.push(rectPrimitive({ id: stableId(label.id, "backing"), role: "chart-label-surface", frame, style: { fill: token("color.surface"), stroke: "none", lineWidth: token("line.hairline") }, data: { forNode: label.id } }));
  }
  // Shared by columns, bars and waterfalls: opaque marks cannot cover axes.
  // Gridlines remain in the background; annotations remain in the foreground.
  const foregroundAxes = nodes.filter(node => node.role === "chart-axis");
  const layeredNodes = [...nodes.filter(node => node.role !== "chart-axis"), ...foregroundAxes];
  return [...underlay, ...layeredNodes.flatMap((node) => [...backings.filter((backing) => backing.data.forNode === node.id), node]), ...overlay];
}

function stackLabelPlan(props, categories, series, stacked) {
  const totals = new Map(), secondary = new Map();
  if(props.secondaryLabelStyle !== undefined && !["stacked", "parenthetical"].includes(props.secondaryLabelStyle)) throw new Error("Unknown secondary label style");
  if(props.secondaryLabelStyle === "parenthetical" && (typeof props.secondaryUnit !== "string" || !props.secondaryUnit.trim() || !String(props.heading || "").toLowerCase().includes(props.secondaryUnit.toLowerCase()))) throw new Error("Parenthetical secondary labels require a shared unit explicitly decoded in the chart heading");
  if (props.stackTotals === undefined && props.secondaryLabels === undefined) return { totals, secondary };
  if (!stacked || series.some(item => item.values.some(value => value < 0)))
    throw new Error("Stack attachments require nonnegative stacked data; signed endpoints need an explicit interpretation");
  if (props.dataLabels === false) throw new Error("Stack attachments require visible data labels");
  for (const [name, records] of [["stackTotals", props.stackTotals], ["secondaryLabels", props.secondaryLabels]]) {
    if (records !== undefined && !Array.isArray(records)) throw new Error(`${name} must be an array`);
    for (const record of records || []) {
      if (!record || !categories.includes(record.category) || !Number.isFinite(record.value))
        throw new Error(`${name} requires exact category keys and finite values`);
      if (name === "stackTotals") {
        if (totals.has(record.category)) throw new Error("Duplicate stack total category");
        const sum = series.reduce((value, item) => value + item.values[categories.indexOf(record.category)], 0);
        const tolerance = record.roundingTolerance ?? 0;
        if (!Number.isFinite(tolerance) || tolerance < 0 || (tolerance > 0 && !record.roundingReason?.trim()))
          throw new Error("Stack total rounding tolerance requires a finite nonnegative value and an explanation");
        if (Math.abs(sum - record.value) > tolerance + 1e-9) throw new Error("Stack total does not reconcile to its components");
        totals.set(record.category, { ...record, endpoint: sum });
      } else {
        if ((record.anchor === "stack-total") === (record.series !== undefined) ||
            (record.anchor !== undefined && record.anchor !== "stack-total") ||
            (record.series !== undefined && !series.some(item => item.name === record.series)) ||
            typeof record.unit !== "string" || !record.unit.trim())
          throw new Error("Secondary labels require an exact series or stack-total anchor and a unit");
        if (record.formattedValue !== undefined) throw new Error("Secondary labels use valueFormat, not unvalidated formattedValue");
        const key = `${record.category}:${record.series ?? "stack-total"}`;
        if (secondary.has(key)) throw new Error("Duplicate secondary label anchor");
        if(props.secondaryLabelStyle === "parenthetical" && record.unit !== props.secondaryUnit) throw new Error("Secondary label unit differs from the shared unit");
        secondary.set(key, props.secondaryLabelStyle === "parenthetical" ? formatValue(record.value, record) : `${formatValue(record.value, record)} ${record.unit}`);
      }
    }
  }
  for (const category of categories) if (secondary.has(`${category}:stack-total`) && !totals.has(category))
    throw new Error("A secondary total label requires its primary stack total");
  return { totals, secondary };
}

const attachedLabelText = (primary,secondary,props) => secondary
  ? props.secondaryLabelStyle === "parenthetical" ? `${primary} (${secondary})` : `${primary}\n${secondary}`
  : primary;
const measureDataLabel = (text, width = 1000) => {
  const measured = measureText(text, width, {
    fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL), bold: true, wrapWidthRatio: 1
  });
  // Keep the same font-engine clearance used by ordinary text wrapping, and
  // survive the scene's coordinate rounding without creating a spurious wrap.
  return { ...measured, width: Math.ceil(measured.width / 0.97) + 2 };
};

function categoricalChart({ id, frame, props, horizontal = false, stacked = false, tokens = TOKENS }) {
  assertGridlineOption(props);
  const { categories, series } = normalizedCategoricalData(props);
  const stackLabels = stackLabelPlan(props, categories, series, stacked);
  const highlights = normalizedHighlights(props, { categories, series, allowBar: !stacked });
  const barHighlight = highlights.find(highlight => highlight.style === "bar");
  const regionHighlight = highlights.find(highlight => highlight.style === "region-box" || highlight.style === "region-tint");
  if (props.focusSeries !== undefined) {
    if (stacked || series.length !== 2) throw new Error("focusSeries requires two unstacked series; preserve distinct colours for multiple peer series");
    if (!series.some(item => item.name === props.focusSeries)) throw new Error("focusSeries must name an exact chart series");
    if (props.colorIndices !== undefined) throw new Error("focusSeries conflicts with an explicit colour-index mapping");
  }
  const chartProps = { ...props, highlights };
  const showLegend = props.legend !== false && series.length > 1;
  const values = series.flatMap((item) => item.values);
  const showDataLabels = props.dataLabels === true || stackLabels.totals.size > 0 || stackLabels.secondary.size > 0 || (props.dataLabels !== false && series.length === 1);
  const showValueAxis = resolveValueAxis(props, { valueCount: values.length, dataLabelsVisible: showDataLabels });
  const barLabelGap = tokenValue(token("space.3"));
  const barLabelWidth = Math.max(50, ...values.map(value => Math.ceil(measureText(formatValue(value, props), 300, {fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL), bold: true, wrapWidthRatio: 1}).width)));
  const horizontalCategoryLabelWidth = horizontal
    ? Math.min(180, Math.max(72, Math.ceil(Math.max(...categories.map(category => measureText(category, 180, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL), wrapWidthRatio: 1 }).width))) + 12))
    : 0;
  const negativeLabelGutter = horizontal && !stacked && showDataLabels && values.some(v=>v<0) ? barLabelWidth + barLabelGap : 0;
  const totalTexts = new Map([...stackLabels.totals].map(([category, record]) => [category,
    attachedLabelText(formatValue(record.value, props), stackLabels.secondary.get(`${category}:stack-total`),props)]));
  const totalMetrics = [...totalTexts.values()].map(text => measureDataLabel(text));
  const totalHeight = totalMetrics.length ? Math.max(...totalMetrics.map(item => item.height)) + barLabelGap : 0;
  const totalWidth = totalMetrics.length ? Math.max(...totalMetrics.map(item => item.width)) + barLabelGap : 0;
  for(const reference of props.referenceLines || []) if(reference.placement !== undefined && !["inside", "outside-end"].includes(reference.placement)) throw new Error("Unknown reference-line label placement");
  if(horizontal && (props.referenceLines || []).some(r=>r.placement === "outside-end")) throw new Error("Outside reference labels require a vertical quantitative axis");
  const referenceGutter = Math.max(0,...(props.referenceLines || []).filter(r=>r.placement === "outside-end").map(r=>measureDataLabel(r.label || String(r.value)).width + barLabelGap));
  const plot = chartFrame(frame, {
    topLegend: showLegend,
    annotations: props.annotations,
    changeAnnotations: props.changeAnnotations,
    annotationRail: props.annotationRail,
    leftInset: horizontal ? horizontalCategoryLabelWidth + negativeLabelGutter + 16 + (regionHighlight ? REGION_HIGHLIGHT_INLINE_PAD : 0) : 54,
    valueLabelInset: horizontal ? (stacked ? totalWidth : showDataLabels ? barLabelWidth + barLabelGap : 0) : referenceGutter,
    totalLabelInset: horizontal ? 0 : totalHeight,
    centerPlot: !horizontal && !showValueAxis
  });
  const categoryLayouts = horizontal ? [] : categories.map(category => measureText(category, plot.width/categories.length-8, {fontFamily:tokenValue(FONT),fontSize:tokenValue(AXIS_LABEL)}));
  if(!horizontal) {
    plot.categoryLabelHeight=Math.max(...categoryLayouts.map(label=>label.height));
    plot.height-=Math.max(0,plot.categoryLabelHeight-28);
    if(plot.height<100)throw new Error("Category labels leave insufficient plot height");
  }
  const categoryGroups=props.categoryGroups ?? [];
  if(!Array.isArray(categoryGroups) || (horizontal && categoryGroups.length)) throw new Error("Category groups require an array on a horizontal category axis");
  const groupedCategories=new Set(),groupIds=new Set();
  for(const group of categoryGroups) {
    if(!group || typeof group.id!=="string" || !group.id.trim() || groupIds.has(group.id) || typeof group.label!=="string" || !group.label.trim() || !Array.isArray(group.categories) || group.categories.length<2) throw new Error("Category groups require unique IDs, labels and at least two categories");
    groupIds.add(group.id);
    const indices=group.categories.map(category=>categories.indexOf(category));
    if(indices.some((n,i)=>n<0 || i>0&&n!==indices[i-1]+1) || group.categories.some(category=>groupedCategories.has(category))) throw new Error("Category groups require exact contiguous ordered non-overlapping categories");
    group.categories.forEach(category=>groupedCategories.add(category));
  }
  const groupLayouts=categoryGroups.map(group=>measureText(group.label,plot.width/categories.length*group.categories.length-16,{fontFamily:tokenValue(FONT),fontSize:tokenValue(AXIS_LABEL)}));
  plot.categoryGroupHeight=categoryGroups.length?Math.max(...groupLayouts.map(m=>m.height))+tokenValue(token("space.3"))*2:0;
  plot.height-=plot.categoryGroupHeight;
  if(plot.height<100)throw new Error("Category groups leave insufficient plot height");
  const stackExtents = categories.flatMap((_, categoryIndex) => {
    if (!stacked) return series.map(item => item.values[categoryIndex]);
    const categoryValues = series.map(item => item.values[categoryIndex]);
    return [
      categoryValues.filter(value => value < 0).reduce((sum, value) => sum + value, 0),
      categoryValues.filter(value => value > 0).reduce((sum, value) => sum + value, 0)
    ];
  });
  const bounds = numericBounds(stacked ? stackExtents : values, { min: horizontal ? (props.xMin ?? props.yMin) : props.yMin, max: horizontal ? (props.xMax ?? props.yMax) : props.yMax, axis: horizontal ? "x" : "y", includeZero: true });
  const twoMarkContrast = !stacked && !barHighlight && props.colorIndices === undefined && categories.length * series.length === 2;
  const twoSeriesContrast = !stacked && !barHighlight && props.colorIndices === undefined && series.length === 2;
  const colorIndexFor = (seriesIndex, categoryIndex) => {
    const explicit = props.colorIndices?.[seriesIndex];
    if (explicit !== undefined) {
      if (!Number.isInteger(explicit) || explicit < 0 || explicit >= SERIES.length) throw new Error("Chart colour index must be between zero and five");
      return explicit;
    }
    return seriesIndex % SERIES.length;
  };
  const forecastIndex = props.forecastFrom !== undefined ? categories.indexOf(props.forecastFrom) : -1;
  if (props.forecastFrom !== undefined && forecastIndex < 0) throw new Error("forecastFrom must name a chart category");
  const colorFor = (seriesIndex, categoryIndex) => {
    const accent = token("color.accent"), primary = token("color.componentPrimary"), comparator = token("color.chartComparator");
    // Highlight the answer: the bar the title is about takes the accent; the
    // others keep their series colour (navy), never grey. Forecast periods are lighter.
    if (barHighlight && categories[categoryIndex] === barHighlight.category) return accent;
    if (forecastIndex >= 0 && categoryIndex >= forecastIndex && !stacked && series.length === 1) return token("color.chartSeries6");
    if (barHighlight) return SERIES[colorIndexFor(seriesIndex, categoryIndex)];
    if (props.colorIndices !== undefined || stacked) return SERIES[colorIndexFor(seriesIndex, categoryIndex)];
    if (twoSeriesContrast) return series[seriesIndex].name === (props.focusSeries ?? series[0].name) ? primary : comparator;
    if (twoMarkContrast) return categoryIndex === 0 ? primary : comparator;
    return SERIES[colorIndexFor(seriesIndex, categoryIndex)];
  };
  const legendItems = series.map((item, seriesIndex) => ({ label: item.name, colorIndex: colorIndexFor(seriesIndex, 0), color: colorFor(seriesIndex, 0) }));
  const nodes = showLegend ? topLegend({ id, frame, items: legendItems }) : [];
  const pointMap = new Map();
  const categoryMap = new Map();
  const yScale = (value) => plot.y + plot.height - (value - bounds.min) / bounds.span * plot.height;
  const xScale = (value) => plot.x + (value - bounds.min) / bounds.span * plot.width;

  nodes.push(...(horizontal
    ? horizontalAxes(id, plot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true, showValueAxis })
    : axes(id, plot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true, showValueAxis })));
  if (!horizontal && bounds.min < 0 && bounds.max > 0) nodes.push(linePrimitive({
    id: stableId(id, "zero-baseline"), role: "chart-axis",
    ...(horizontal
      ? { x1: xScale(0), y1: plot.y, x2: xScale(0), y2: plot.y + plot.height }
      : { x1: plot.x, y1: yScale(0), x2: plot.x + plot.width, y2: yScale(0) }),
    style: lineStyle(INK)
  }));
  const categorySpan = (horizontal ? plot.height : plot.width) / categories.length;
  let groupSpan = categorySpan * 0.7;
  let stackExternalWidth = 0;
  if (stacked && !horizontal && showDataLabels) {
    for (const category of categories) for (const item of series) {
      const value=item.values[categories.indexOf(category)];
      const text=attachedLabelText(formatValue(value,props),stackLabels.secondary.get(`${category}:${item.name}`),props);
      const label=measureDataLabel(text,Math.max(1,groupSpan-8));
      if(label.height>Math.abs(value)/bounds.span*plot.height) stackExternalWidth=Math.max(stackExternalWidth,measureDataLabel(text,categorySpan*.45).width);
    }
    if(stackExternalWidth) {
      groupSpan=Math.min(groupSpan,categorySpan-stackExternalWidth-tokenValue(token("space.3"))*2);
      if(groupSpan<tokenValue(token("space.4"))) throw new Error("External stack label leaves insufficient mark width; enlarge the chart or reduce categories");
    }
  }
  const barSpan = stacked ? groupSpan : groupSpan / series.length;
  categories.forEach((category, categoryIndex) => {
    const categoryStart = (horizontal ? plot.y : plot.x) + categoryIndex * categorySpan + (stackExternalWidth ? tokenValue(token("space.2")) : (categorySpan - groupSpan) / 2);
    categoryMap.set(category, horizontal
      ? { x: plot.x, y: categoryStart, width: plot.width, height: groupSpan }
      : { x: categoryStart, y: plot.y, width: groupSpan, height: plot.height, labelSpan: categorySpan, labelCenter: stacked ? categoryStart+(groupSpan-4)/2 : plot.x+(categoryIndex+.5)*categorySpan });
    let positiveCumulative = 0;
    let negativeCumulative = 0;
    series.forEach((item, seriesIndex) => {
      const value = item.values[categoryIndex];
      const selected = barHighlight?.category === category;
      const colorIndex = colorIndexFor(seriesIndex, categoryIndex);
      const markColor = colorFor(seriesIndex, categoryIndex);
      const start = stacked ? (value >= 0 ? positiveCumulative : negativeCumulative) : 0;
      const end = start + value;
      let bar;
      if (horizontal) {
        const startX = xScale(start), endX = xScale(end);
        bar = {
          x: Math.min(startX, endX),
          y: categoryStart + (stacked ? 0 : seriesIndex * barSpan),
          width: Math.max(1, Math.abs(endX - startX)),
          height: Math.max(4, barSpan - 4)
        };
      } else {
        const startY = yScale(start), endY = yScale(end);
        bar = {
          x: categoryStart + (stacked ? 0 : seriesIndex * barSpan),
          y: Math.min(startY, endY),
          width: Math.max(4, barSpan - 4),
          height: Math.max(1, Math.abs(endY - startY))
        };
      }
      nodes.push(rectPrimitive({
        id: stableId(id, "series", item.name, category),
        role: "chart-mark",
        frame: bar,
        style: fillStyle(markColor),
        data: { category, categoryKey: category, series: item.name, seriesKey: item.name, colorIndex, highlighted: Boolean(selected), ...(barHighlight ? { highlightStyle: "bar" } : {}) }
      }));
      if (showDataLabels) {
        let labelText = attachedLabelText(formatValue(value, props), stackLabels.secondary.get(`${category}:${item.name}`),props);
        const labelMetrics = measureDataLabel(labelText, stacked && !horizontal ? Math.max(1,bar.width-4) : 1000);
        labelText = labelMetrics.text;
        const labelFrame = horizontal
          ? stacked
            ? { x: bar.x + 2, y: bar.y - 2, width: Math.max(1, bar.width - 4), height: bar.height + 4 }
            : value >= 0
              ? { x: bar.x + bar.width + barLabelGap, y: bar.y - 2, width: barLabelWidth, height: bar.height + 4 }
              : { x: bar.x - barLabelGap - barLabelWidth, y: bar.y - 2, width: barLabelWidth, height: bar.height + 4 }
          : stacked
            ? { x: bar.x + 2, y: bar.y + (bar.height - labelMetrics.height) / 2, width: bar.width - 4, height: labelMetrics.height }
            : value >= 0
              ? { x: bar.x - 10, y: value < 0 ? yScale(end) + 3 : yScale(end) - 26, width: bar.width + 20, height: 24 }
              : { x: bar.x - 10, y: Math.min(plot.y + plot.height - 24, bar.y + bar.height + 2), width: bar.width + 20, height: 24 };
        nodes.push(textPrimitive({
          id: stableId(id, "value-label", item.name, category),
          role: "data-label",
          frame: labelFrame,
          text: labelText,
          style: textStyle(CHART_LABEL, stacked && contrastRatio(tokens[SERIES[colorIndex].tokenId].value, tokens["color.onPrimary"].value) >= contrastRatio(tokens[SERIES[colorIndex].tokenId].value, tokens["color.ink"].value) ? token("color.onPrimary") : INK, true, horizontal && !stacked ? (value >= 0 ? "left" : "right") : "center"),
          data: { category, series: item.name }
        }));
      }
      const point = horizontal
        ? { x: xScale(end), y: bar.y + bar.height / 2, changeX: xScale(end) + (value >= 0 ? 12 : -12), changeY: bar.y + bar.height / 2, leaderY: bar.y }
        : { x: bar.x + bar.width / 2, y: yScale(end), changeX: bar.x + bar.width / 2, changeY: yScale(end) + (value >= 0 ? -(showDataLabels ? 38 : 16) : (showDataLabels ? 38 : 16)), leaderX: bar.x + bar.width };
      pointMap.set(`${item.name}:${category}`, point);
      if (series.length === 1) pointMap.set(`value:${category}`, point);
      if (stacked) {
        if (value >= 0) positiveCumulative = end;
        else negativeCumulative = end;
      }
    });
    const categoryValues = series.map(item => item.values[categoryIndex]);
    const categoryValue = stacked
      ? (Math.abs(positiveCumulative) >= Math.abs(negativeCumulative) ? positiveCumulative : negativeCumulative)
      : categoryValues.reduce((best, value) => Math.abs(value) > Math.abs(best) ? value : best, 0);
    pointMap.set(`category:${category}`, horizontal
      ? {
          x: xScale(categoryValue),
          y: categoryStart + groupSpan / 2,
          changeX: xScale(categoryValue) + (categoryValue >= 0 ? 12 : -12),
          changeY: categoryStart + groupSpan / 2
        }
      : {
          x: categoryStart + groupSpan / 2,
          y: yScale(categoryValue),
          changeX: categoryStart + groupSpan / 2,
          changeY: yScale(categoryValue) - (showDataLabels ? 38 : 16)
        });
    if (stacked && showDataLabels) {
      const labels = nodes.filter(node => node.role === "data-label" && node.data.category === category);
      const marks = nodes.filter(node => node.role === "chart-mark" && node.data.category === category);
      for (const label of labels) {
        const mark = marks.find(mark => mark.data.series === label.data.series);
        const metrics = measureDataLabel(label.text);
        if (metrics.width <= mark.frame.width - 4 && metrics.height <= mark.frame.height) continue;
        if (horizontal) throw new Error("Stacked bar label does not fit its segment; enlarge the chart or use stacked columns with external labels");
        const x = mark.frame.x + mark.frame.width + 6;
        const boundary = plot.x + (categoryIndex + 1) * categorySpan;
        if (x + metrics.width > boundary) throw new Error("External stack label exceeds its category lane; enlarge the chart or reduce categories");
        label.frame = { x, y: Math.max(plot.y, Math.min(mark.frame.y + (mark.frame.height - metrics.height) / 2, plot.y + plot.height - metrics.height)), width: metrics.width, height: metrics.height };
        Object.assign(label, textPrimitive({ id: label.id, role: label.role, frame: label.frame, text: label.text, data: { ...label.data, external: true }, style: textStyle(CHART_LABEL, INK, true, "left") }));
        nodes.push(linePrimitive({ id: stableId(label.id, "leader"), role: "data-label-leader", x1: mark.frame.x + mark.frame.width, y1: mark.frame.y + mark.frame.height / 2, x2: x - 2, y2: label.frame.y + metrics.height / 2, style: lineStyle(INK) }));
      }
      const external = labels.filter(label => label.data.external).sort((a,b) => a.frame.y-b.frame.y);
      const separation = tokenValue(token("space.1"));
      if (external.reduce((sum,label)=>sum+label.frame.height,0) + Math.max(0,external.length-1)*separation > plot.height)
        throw new Error("External stack labels exceed the plot height; enlarge the chart or reduce categories");
      for (let i=1;i<external.length;i++) external[i].frame.y = Math.max(external[i].frame.y,external[i-1].frame.y+external[i-1].frame.height+separation);
      for (let i=external.length-1;i>=0;i--) {
        const limit=i===external.length-1 ? plot.y+plot.height : external[i+1].frame.y-separation;
        external[i].frame.y=Math.min(external[i].frame.y,limit-external[i].frame.height);
      }
      for (const label of external) {
        const mark=marks.find(mark=>mark.data.series===label.data.series);
        Object.assign(label,textPrimitive({id:label.id,role:label.role,frame:label.frame,text:label.text,data:label.data,style:textStyle(CHART_LABEL,INK,true,"left")}));
        const leader=nodes.find(node=>node.id===stableId(label.id,"leader"));
        Object.assign(leader,linePrimitive({id:leader.id,role:"data-label-leader",x1:mark.frame.x+mark.frame.width,y1:mark.frame.y+mark.frame.height/2,x2:label.frame.x-2,y2:label.frame.y+label.frame.height/2,style:lineStyle(INK)}));
      }
    }
    if (totalTexts.has(category)) {
      const text = totalTexts.get(category), metrics = measureDataLabel(text);
      if ((!horizontal && metrics.width > categorySpan - 8) || (horizontal && metrics.height > groupSpan))
        throw new Error("Stack total label does not fit its category lane");
      const endpoint = stackLabels.totals.get(category).endpoint;
      nodes.push(textPrimitive({ id: stableId(id, "stack-total", category), role: "data-label",
        frame: horizontal
          ? { x: xScale(endpoint)+barLabelGap, y: categoryStart+(groupSpan-metrics.height)/2, width: metrics.width, height: metrics.height }
          : { x: categoryStart+(barSpan-4-metrics.width)/2, y: yScale(endpoint)-barLabelGap-metrics.height, width: metrics.width, height: metrics.height },
        text, style: textStyle(CHART_LABEL, INK, true, horizontal ? "left" : "center"),
        data: { category, anchor: "stack-total", value: stackLabels.totals.get(category).value, endpoint }
      }));
    }
    nodes.push(textPrimitive({
      id: stableId(id, "category", category),
      role: "category-label",
      frame: horizontal
        ? { x: plot.x - horizontalCategoryLabelWidth - negativeLabelGutter - 8 - (regionHighlight ? REGION_HIGHLIGHT_INLINE_PAD : 0), y: categoryStart, width: horizontalCategoryLabelWidth, height: groupSpan }
        : { x: categoryMap.get(category).labelCenter-(categorySpan-8)/2, y: plot.y + plot.height + (regionHighlight ? 18 : 8), width: categorySpan-8, height: categoryLayouts[categoryIndex].height },
      text: horizontal ? category : categoryLayouts[categoryIndex].text,
      style: { ...textStyle(AXIS_LABEL, SECONDARY, false, horizontal ? "right" : "center"), ...(!horizontal ? {valign:"top",lineHeight:categoryLayouts[categoryIndex].lineHeight,wrap:false} : {}) },
      data: {category,...(!horizontal ? {textLayout:categoryLayouts[categoryIndex]} : {})}
    }));
  });
  for(const [i,group] of categoryGroups.entries()) {
    const start=categories.indexOf(group.categories[0]),end=start+group.categories.length;
    const x1=categoryMap.get(categories[start]).labelCenter-categorySpan/2+8,x2=categoryMap.get(categories[end-1]).labelCenter+categorySpan/2-8;
    const y=plot.y+plot.height+plot.categoryLabelHeight+tokenValue(token("space.4"));
    const data={groupId:group.id,dependencies:group.categories.map(category=>stableId(id,"category",category))};
    for(const [part,a,b,c,d] of [["span",x1,y,x2,y],["left",x1,y-4,x1,y],["right",x2,y-4,x2,y]])nodes.push(linePrimitive({id:stableId(id,"category-group",group.id,part),role:"category-group-rule",x1:a,y1:b,x2:c,y2:d,style:lineStyle(SECONDARY),data}));
    nodes.push(textPrimitive({id:stableId(id,"category-group",group.id,"label"),role:"category-group-label",frame:{x:x1,y:y+4,width:x2-x1,height:groupLayouts[i].height},text:groupLayouts[i].text,style:{...textStyle(AXIS_LABEL,SECONDARY),valign:"top",lineHeight:groupLayouts[i].lineHeight,wrap:false},data:{...data,textLayout:groupLayouts[i]}}));
  }
  if(!horizontal && !stacked) for(const label of nodes.filter(n=>n.role === "data-label")) {
    const lines=(props.referenceLines||[]).map(r=>yScale(r.value)).sort((a,b)=>b-a);
    for(const y of lines) if(y>=label.frame.y-4&&y<=label.frame.y+label.frame.height+4) label.frame.y=y-label.frame.height-6;
    if(label.frame.y<frame.y)throw new Error("Reference lines leave no room for value labels");
  }
  return withDecorations(nodes, {
    id,
    plot,
    props: chartProps,
    pointMap,
    categoryMap,
    yScale: horizontal ? null : yScale,
    xScale: horizontal ? xScale : null,
    allowBarHighlight: true,
    allowAnnotationRail: !horizontal,
    allowOutsideReferenceLabels: !horizontal
  });
}

// Explicit sparse observations use numeric positions; no category slot or invented value.
function sparseLineChart({ id, frame, props }) {
  const fail = message => { throw new Error(`Sparse line: ${message}`); };
  const textRequired = value => typeof value === "string" && value.trim();
  let assumptionNode = null;
  if (props.assumption !== undefined) {
    if (!textRequired(props.assumption)) fail("assumption must contain substantive text");
    const measured = measureText(props.assumption, frame.width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL) });
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
  const bounds = numericBounds(values, { min: props.yMin, max: props.yMax, axis: "y" });
  const showLegend = props.legend !== false && series.length > 1;
  const showValueAxis = props.showValueAxis !== false;
  const labelWidth = axisLabelWidth(bounds);
  const plot = chartFrame(frame, { topLegend: showLegend, leftInset: showValueAxis ? Math.max(labelWidth + 8, 54) : 54, annotations: props.annotations });
  const statusHeight = boundary ? Math.max(...[boundary.beforeLabel, boundary.afterLabel].map(label => measureText(label, plot.width / 2 - 16, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL) }).height)) + tokenValue(token("space.3")) : 0;
  plot.y += statusHeight; plot.height -= statusHeight;
  if (plot.height < 100) fail("status labels leave insufficient plot height");
  const xScale = value => plot.x + (value - axis.min) / (axis.max - axis.min) * plot.width;
  const yScale = value => plot.y + plot.height - (value - bounds.min) / bounds.span * plot.height;
  const nodes = [...(showLegend ? topLegend({ id, frame, items: series.map((item, index) => ({ label: item.name, colorIndex: props.colorIndices?.[index] ?? index })) }) : []), ...axes(id, plot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true, showValueAxis, labelWidth })];
  const tickFrames = [];
  for (const tick of ticks) {
    const measured = measureText(tick.label, 200, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL) });
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
      const measured = measureText(label, width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL) });
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
        const label = formatValue(point.y, props), measured = measureText(label, 200, { fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL), bold: true });
        const labelFrame = { x: Math.max(plot.x, Math.min(point.px - measured.width / 2, plot.x + plot.width - measured.width)), y: point.py - measured.height - 8, width: measured.width, height: measured.height };
        if (labelFrame.y < plot.y - 1 || labelFrames.some(other => other.x < labelFrame.x + labelFrame.width + 4 && other.x + other.width + 4 > labelFrame.x && other.y < labelFrame.y + labelFrame.height + 4 && other.y + other.height + 4 > labelFrame.y)) fail("selected point labels overlap or exceed plot; allocate height or label fewer anchors");
        labelFrames.push(labelFrame);
        nodes.push(textPrimitive({ id: stableId(point.nodeId, "label"), role: "data-label", frame: labelFrame, text: measured.text, style: { ...textStyle(CHART_LABEL, INK, true), valign: "top", lineHeight: measured.lineHeight, wrap: false }, data: { ...data, textLayout: measured, dependencies: [point.nodeId] } }));
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

function lineChart({ id, frame, props, area = false }) {
  if (props.xAxis !== undefined || props.series?.some(item => item.points !== undefined)) {
    if (area) throw new Error("Sparse observations are supported by chart.line only; areas require complete categorical observations");
    return sparseLineChart({ id, frame, props });
  }
  assertGridlineOption(props);
  const { categories, series } = normalizedCategoricalData(props);
  if (area && categories.length < 2) throw new Error("Area charts require at least two categories");
  const endLabels = props.directLabels === "end" || props.endLabels === true;
  const showLegend = !endLabels && props.legend !== false && series.length > 1;
  const values = series.flatMap((item) => item.values);
  const showDataLabels = props.dataLabels === true || (props.dataLabels !== false && !endLabels && values.length < 6);
  const showValueAxis = resolveValueAxis(props, { valueCount: values.length, dataLabelsVisible: showDataLabels });
  if (showValueAxis && (props.changeAnnotations || []).some(annotation => annotation.style !== "arrow")) throw new Error("LINE_AXIS_CHANGE_STYLE: a visible value axis requires the diagonal arrow with its circular growth badge; omit the value axis for bracket annotations");
  const bounds = numericBounds(values, { min: props.yMin, max: props.yMax, axis: "y" });
  const labelWidth = axisLabelWidth(bounds);
  const plot = chartFrame(frame, {
    leftInset: showValueAxis ? Math.max(labelWidth + 8, showDataLabels ? 68 : 0) : showDataLabels ? 68 : 54,
    valueLabelInset: showDataLabels ? 68 : 0,
    topLegend: showLegend,
    annotations: props.annotations,
    changeAnnotations: props.changeAnnotations,
    annotationRail: props.annotationRail,
    endLabels
  });
  const yScale = (value) => plot.y + plot.height - (value - bounds.min) / bounds.span * plot.height;
  const xScale = (index) => plot.x + (categories.length === 1 ? plot.width / 2 : plot.width * index / (categories.length - 1));
  const nodes = [
    ...(showLegend ? topLegend({ id, frame, items: series.map((item, index) => ({ label: item.name, colorIndex: props.colorIndices?.[index] ?? index })) }) : []),
    ...axes(id, plot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true, showValueAxis, labelWidth })
  ];
  const pointMap = new Map();
  const categoryMap = new Map();
  const categorySlot = Math.min(120, Math.max(76, plot.width / Math.max(1, categories.length) * 0.82));
  categories.forEach((category, index) => {
    const x = xScale(index);
    const categoryX = Math.max(plot.x, Math.min(plot.x + plot.width - categorySlot, x - categorySlot / 2));
    categoryMap.set(category, { x: categoryX, y: plot.y, width: categorySlot, height: plot.height });
    nodes.push(textPrimitive({ id: stableId(id, "category", category), role: "category-label", frame: { x: categoryX, y: plot.y + plot.height + 16, width: categorySlot, height: 40 }, text: category, style: textStyle(AXIS_LABEL, INK, false, index === 0 ? "left" : index === categories.length - 1 ? "right" : "center") }));
  });
  series.forEach((item, seriesIndex) => {
    const points = item.values.map((value, index) => ({ x: xScale(index), y: yScale(value), value, category: categories[index] }));
    if (area) {
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
        frame: plot,
        style: { fill: SERIES[props.colorIndices?.[seriesIndex] ?? seriesIndex % SERIES.length], stroke: "none", lineWidth: token("line.hairline"), opacity: 0.18 },
        data: { paths: [polygonPoints], series: item.name, baselineValue }
      }));
    }
    points.slice(1).forEach((point, index) => nodes.push(linePrimitive({
      id: stableId(id, "segment", item.name, index),
      role: "chart-line",
      x1: points[index].x,
      y1: points[index].y,
      x2: point.x,
      y2: point.y,
      style: lineStyle(SERIES[props.colorIndices?.[seriesIndex] ?? seriesIndex % SERIES.length], token("line.standard"))
    })));
    points.forEach((point) => {
      nodes.push(ellipsePrimitive({
        id: stableId(id, "point", item.name, point.category),
        role: "chart-marker",
        frame: { x: point.x - 5, y: point.y - 5, width: 10, height: 10 },
        style: fillStyle(SERIES[props.colorIndices?.[seriesIndex] ?? seriesIndex % SERIES.length])
      }));
      const mappedPoint = { ...point, changeX: point.x, changeY: point.y - (showDataLabels ? 30 : 16) };
      pointMap.set(`${item.name}:${point.category}`, mappedPoint);
      if (series.length === 1) pointMap.set(`value:${point.category}`, mappedPoint);
      const categoryPoint = pointMap.get(`category:${point.category}`);
      if (!categoryPoint || mappedPoint.y < categoryPoint.y) pointMap.set(`category:${point.category}`, mappedPoint);
      if (showDataLabels) {
        const first = point.category === categories[0];
        const last = point.category === categories.at(-1);
        nodes.push(textPrimitive({
          id: stableId(id, "value-label", item.name, point.category),
          role: "data-label",
          frame: first
            ? { x: point.x - 68, y: point.y - 12, width: 60, height: 24 }
            : last ? { x: point.x + 8, y: point.y - 12, width: 60, height: 24 }
            : { x: point.x - 30, y: point.y - 27, width: 60, height: 24 },
          text: formatValue(point.value, props),
          style: textStyle(CHART_LABEL, INK, true, first ? "right" : last ? "left" : "center")
        }));
      }
    });
    if (endLabels) {
      const point = points.at(-1);
      nodes.push(textPrimitive({ id: stableId(id, "end-label", item.name), role: "data-label", frame: { x: point.x + 4, y: point.y - 12, width: 180, height: 24 }, text: `${item.name} ${formatValue(point.value, props)}`, style: textStyle(CHART_LABEL, SERIES[props.colorIndices?.[seriesIndex] ?? seriesIndex % SERIES.length], true, "left") }));
    }
  });
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
  return withDecorations(nodes, { id, plot, props, pointMap, categoryMap, yScale });
}

function waterfall({ id, frame, props }) {
  assertGridlineOption(props);
  if (!Array.isArray(props.categories) || !props.categories.length || props.categories.some(category => typeof category !== "string" || !category.trim()) || new Set(props.categories).size !== props.categories.length) throw new Error("Waterfall charts require unique non-empty categories");
  if (!Array.isArray(props.values) || props.values.length !== props.categories.length || props.values.some(value => !Number.isFinite(value))) throw new Error("Waterfall values must contain one finite value per category");
  if (props.totals !== undefined && (!Array.isArray(props.totals) || props.totals.some(index => !Number.isInteger(index) || index < 0 || index >= props.categories.length) || new Set(props.totals).size !== props.totals.length)) throw new Error("Waterfall totals must contain unique valid category indices");
  const showValueAxis = resolveValueAxis(props, { valueCount: props.values.length, dataLabelsVisible: true });
  const plot = chartFrame(frame, {
    annotations: props.annotations,
    changeAnnotations: props.changeAnnotations,
    annotationRail: props.annotationRail,
    centerPlot: !showValueAxis
  });
  // Reserve a label row below negative endpoints, above category labels.
  plot.height -= 30;
  if (plot.height < 100) throw new Error("Waterfall needs room for endpoint labels");
  const running = [];
  let total = 0;
  props.values.forEach((value, index) => {
    if (props.totals?.includes(index)) total = value;
    else total += value;
    running.push(total);
  });
  const bounds = numericBounds([0, ...running], { min: props.yMin, max: props.yMax, axis: "y", includeZero: true });
  const yScale = (value) => plot.y + plot.height - (value - bounds.min) / bounds.span * plot.height;
  const nodes = axes(id, plot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true, showValueAxis });
  if (bounds.min < 0 && bounds.max > 0) nodes.push(linePrimitive({ id: stableId(id, "zero-baseline"), role: "chart-axis", x1: plot.x, y1: yScale(0), x2: plot.x + plot.width, y2: yScale(0), style: lineStyle(INK) }));
  const pointMap = new Map();
  const categoryMap = new Map();
  const span = plot.width / props.categories.length;
  let previous = 0;
  props.categories.forEach((category, index) => {
    const value = props.values[index];
    const isTotal = props.totals?.includes(index);
    const start = isTotal ? 0 : previous;
    const end = isTotal ? value : previous + value;
    const top = Math.max(start, end);
    const bottom = Math.min(start, end);
    const bar = { x: plot.x + index * span + span * 0.2, y: yScale(top), width: span * 0.6, height: Math.max(2, yScale(bottom) - yScale(top)) };
    const fill = isTotal ? PRIMARY : value >= 0 ? token("color.chartSeries2") : token("color.negative");
    nodes.push(rectPrimitive({ id: stableId(id, "bar", category), role: "chart-mark", frame: bar, style: fillStyle(fill) }));
    nodes.push(textPrimitive({ id: stableId(id, "value-label", category), role: "data-label", frame: { x: bar.x - 10, y: value < 0 ? yScale(end) + 3 : yScale(end) - 26, width: bar.width + 20, height: 24 }, text: isTotal ? formatValue(value, props) : `${value >= 0 ? "+" : ""}${formatValue(value, props)}`, style: textStyle(CHART_LABEL, INK, true, "center") }));
    if (index > 0) nodes.push(linePrimitive({ id: stableId(id, "connector", index), role: "chart-connector", x1: plot.x + (index - 1) * span + span * 0.8, y1: yScale(previous), x2: plot.x + index * span + span * 0.2, y2: yScale(previous), style: lineStyle(SECONDARY, token("line.hairline"), "dash") }));
    const point = { x: bar.x + bar.width / 2, y: bar.y, changeX: bar.x + bar.width / 2, changeY: bar.y - 38, leaderX: bar.x + bar.width };
    pointMap.set(`value:${category}`, point);
    pointMap.set(`category:${category}`, point);
    categoryMap.set(category, { x: bar.x, y: plot.y, width: bar.width, height: plot.height });
    nodes.push(textPrimitive({ id: stableId(id, "category", category), role: "category-label", frame: { x: plot.x + index * span, y: plot.y + plot.height + 38, width: span, height: 28 }, text: category, style: textStyle(AXIS_LABEL) }));
    previous = end;
  });
  return withDecorations(nodes, { id, plot, props, pointMap, categoryMap, yScale });
}

/**
 * Floating range bars: one horizontal bar per category from `low` to `high`
 * with both values labelled at the ends (pay bands, ranges, min–max).
 * props: categories, low[], high[], unit?, highlights? ({category, style:"bar"}).
 */
function rangeChart({ id, frame, props }) {
  assertGridlineOption(props);
  const categories = props.categories || [];
  if (!categories.length || !Array.isArray(props.low) || !Array.isArray(props.high) || props.low.length !== categories.length || props.high.length !== categories.length) throw new Error("Range chart requires categories with one low and one high value each");
  categories.forEach((c, i) => { if (!(Number.isFinite(props.low[i]) && Number.isFinite(props.high[i]) && props.high[i] >= props.low[i])) throw new Error(`Range chart ${c}: high must be a finite value at or above low`); });
  const highlights = normalizedHighlights(props, { categories, series: [{ name: "range" }], allowBar: true });
  const barHighlight = highlights.find((h) => h.style === "bar");
  const labelWidth = Math.max(56, ...[...props.low, ...props.high].map((value) => Math.ceil(measureText(formatValue(value, props), 300, { fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL), bold: true, wrapWidthRatio: 1 }).width) + 12));
  const categoryWidth = Math.max(90, ...categories.map((c) => Math.ceil(measureText(c, 260, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL), wrapWidthRatio: 1 }).width) + 12));
  const plot = chartFrame(frame, { leftInset: categoryWidth + labelWidth, valueLabelInset: labelWidth, centerPlot: false });
  const bounds = numericBounds([...props.low, ...props.high], { min: props.xMin, max: props.xMax, axis: "x", includeZero: props.includeZero === true });
  const xScale = (value) => plot.x + (value - bounds.min) / bounds.span * plot.width;
  const nodes = [];
  const rowSpan = plot.height / categories.length;
  const barHeight = Math.min(28, Math.max(10, rowSpan * 0.45));
  const pointMap = new Map(), categoryMap = new Map();
  categories.forEach((category, index) => {
    const low = props.low[index], high = props.high[index];
    const y = plot.y + index * rowSpan + (rowSpan - barHeight) / 2;
    const x0 = xScale(low), x1 = Math.max(xScale(high), x0 + 2);
    const fill = barHighlight ? (barHighlight.category === category ? token("color.accent") : SERIES[0]) : SERIES[0];
    nodes.push(rectPrimitive({ id: stableId(id, "range", category), role: "chart-mark", frame: { x: x0, y, width: x1 - x0, height: barHeight }, style: fillStyle(fill), data: { category, low, high, highlighted: barHighlight?.category === category } }));
    nodes.push(textPrimitive({ id: stableId(id, "low-label", category), role: "data-label", frame: { x: x0 - labelWidth - 4, y: y - 2, width: labelWidth, height: barHeight + 4 }, text: formatValue(low, props), style: textStyle(CHART_LABEL, INK, true, "right"), data: { category, end: "low" } }));
    nodes.push(textPrimitive({ id: stableId(id, "high-label", category), role: "data-label", frame: { x: x1 + 4, y: y - 2, width: labelWidth, height: barHeight + 4 }, text: formatValue(high, props), style: textStyle(CHART_LABEL, INK, true, "left"), data: { category, end: "high" } }));
    nodes.push(textPrimitive({ id: stableId(id, "category", category), role: "category-label", frame: { x: frame.x, y: y - 2, width: categoryWidth, height: barHeight + 4 }, text: category, style: textStyle(AXIS_LABEL, INK, false, "left"), data: { category } }));
    if (index) nodes.push(linePrimitive({ id: stableId(id, "row-rule", index), role: "chart-gridline", x1: frame.x, y1: plot.y + index * rowSpan, x2: plot.x + plot.width + labelWidth, y2: plot.y + index * rowSpan, style: lineStyle() }));
    const point = { x: x1, y: y + barHeight / 2, changeX: x1 + 12, changeY: y + barHeight / 2, leaderY: y };
    pointMap.set(`value:${category}`, point); pointMap.set(`range:${category}`, point);
    categoryMap.set(category, { x: plot.x, y: plot.y + index * rowSpan, width: plot.width, height: rowSpan });
  });
  return withDecorations(nodes, { id, plot, props, pointMap, categoryMap, xScale, allowAnnotationRail: false, allowBarHighlight: true });
}

function comboChart({ id, frame, props }) {
  assertGridlineOption(props);
  const { categories, series } = normalizedCategoricalData(props, { seriesCount: 2 });
  const plot = chartFrame(frame, {
    topLegend: true,
    annotations: props.annotations,
    changeAnnotations: props.changeAnnotations,
    annotationRail: props.annotationRail
  });
  const bounds = numericBounds(series.flatMap(item => item.values), { min: props.yMin, max: props.yMax, axis: "y", includeZero: true });
  const yScale = (value) => plot.y + plot.height - (value - bounds.min) / bounds.span * plot.height;
  const categorySpan = plot.width / categories.length;
  const barWidth = categorySpan * 0.58;
  const nodes = [
    ...topLegend({ id, frame, items: series.map((item) => item.name) }),
    ...axes(id, plot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true })
  ];
  const pointMap = new Map();
  const categoryMap = new Map();
  const barSeries = series[0];
  const lineSeries = series[1];
  const linePoints = [];
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
    const barPoint = { x, y: barValueY, leaderX: bar.x + bar.width, changeX: x, changeY: barValueY + (barSeries.values[index] >= 0 ? -16 : 16) };
    const lineY = yScale(lineSeries.values[index]);
    const linePoint = { x, y: lineY, changeX: x, changeY: lineY - 16 };
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
    style: lineStyle(SERIES[1], token("line.standard"))
  })));
  linePoints.forEach((point) => nodes.push(ellipsePrimitive({
    id: stableId(id, "point", lineSeries.name, point.category),
    role: "chart-marker",
    frame: { x: point.x - 5, y: point.y - 5, width: 10, height: 10 },
    style: fillStyle(SERIES[1])
  })));
  return withDecorations(nodes, { id, plot, props, pointMap, categoryMap, yScale });
}

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
  const focus = quadrants.focus ?? "topRight";
  if (style === "focus-tint" && !SCATTER_QUADRANT_KEYS.includes(focus)) throw new Error("Scatter focus quadrant must name a valid quadrant");
  return { x: quadrants.x, y: quadrants.y, style, titles, focus };
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

function scatter({ id, frame, props, bubble = false }) {
  assertGridlineOption(props);
  if (!Array.isArray(props.points) || !props.points.length || props.points.some(point => !point || typeof point.name !== "string" || !point.name.trim() || !Number.isFinite(point.x) || !Number.isFinite(point.y))) throw new Error("Scatter charts require named points with finite x and y values");
  if (new Set(props.points.map(point => point.name)).size !== props.points.length) throw new Error("Scatter point names must be unique");
  if (bubble && props.points.some(point => !Number.isFinite(point.size) || point.size <= 0)) throw new Error("Bubble charts require a positive finite size for every point");
  if (!bubble && props.sizeLegend !== undefined) throw new Error("Only bubble charts accept a size legend");
  const declaredSeries = props.points.filter(point => typeof point.series === "string" && point.series.trim()).length;
  if (declaredSeries && declaredSeries !== props.points.length) throw new Error("Scatter points must either all declare a series or all use the default series");
  const seriesNames = [...new Set(props.points.map(point => point.series).filter(value => typeof value === "string" && value.trim()))];
  const showLegend = props.legend !== false && (seriesNames.length > 1 || props.sizeLegend !== undefined);
  const plot = chartFrame(frame, {
    topLegend: showLegend,
    annotations: props.annotations,
    changeAnnotations: props.changeAnnotations,
    annotationRail: props.annotationRail
  });
  const xBounds = numericBounds(props.points.map(point => point.x), { min: props.xMin, max: props.xMax, axis: "x" });
  const yBounds = numericBounds(props.points.map(point => point.y), { min: props.yMin, max: props.yMax, axis: "y" });
  const xScale = (value) => plot.x + (value - xBounds.min) / xBounds.span * plot.width;
  const yScale = (value) => plot.y + plot.height - (value - yBounds.min) / yBounds.span * plot.height;
  const quadrants = normalizedQuadrants(props.quadrants, xBounds, yBounds);
  const nodes = [
    ...scatterQuadrantNodes({ id, plot, quadrants, xScale, yScale }),
    ...axes(id, plot, yBounds.min, yBounds.max, 4, { gridlines: props.gridlines === true }),
    ...scatterLegend({ id, frame, props, bubble, seriesNames })
  ];
  // Both quantitative dimensions need a visible scale, even without point labels.
  for (let index = 0; index <= 4; index++) {
    const value = xBounds.min + xBounds.span * index / 4;
    nodes.push(textPrimitive({ id: stableId(id, "x-axis-label", index), role: "axis-label", frame: { x: xScale(value) - (index === 0 ? 0 : index === 4 ? 64 : 32), y: plot.y + plot.height + 20, width: 64, height: 28 }, text: String(Number(value.toFixed(2))), style: textStyle(AXIS_LABEL, SECONDARY, false, index === 0 ? "left" : index === 4 ? "right" : "center") }));
  }
  if (props.yTickLabels) {
    for (let index = nodes.length - 1; index >= 0; index--) if (nodes[index].role === "axis-label" && !nodes[index].id.includes("x-axis-label")) nodes.splice(index, 1);
    for (const [index, tick] of props.yTickLabels.entries()) {
      if (!Number.isFinite(tick.value) || typeof tick.label !== "string") throw new Error("Scatter yTickLabels require finite values and text labels");
      nodes.push(textPrimitive({ id: stableId(id, "category-axis-label", index), role: "axis-label", frame: { x: plot.x - 54, y: yScale(tick.value) - 14, width: 48, height: 28 }, text: tick.label, style: textStyle(AXIS_LABEL, SECONDARY, false, "right") }));
    }
  }
  const pointMap = new Map();
  const categoryMap = new Map();
  const bubbleSizes = bubble ? props.points.map(point => point.size) : [];
  const minBubble = bubble ? Math.min(...bubbleSizes) : 0;
  const maxBubble = bubble ? Math.max(...bubbleSizes) : 0;
  const bubbleDiameter = value => {
    if (!bubble) return 12;
    if (minBubble === maxBubble) return 34;
    const areaScale = (Math.sqrt(value) - Math.sqrt(minBubble)) / (Math.sqrt(maxBubble) - Math.sqrt(minBubble));
    return 18 + areaScale * 54;
  };
  props.points.forEach((point, index) => {
    const size = bubbleDiameter(point.size);
    const x = xScale(point.x);
    const y = yScale(point.y);
    const seriesIndex = seriesNames.length ? seriesNames.indexOf(point.series) : 0;
    nodes.push(ellipsePrimitive({ id: stableId(id, "point", point.name), role: "chart-marker", frame: { x: x - size / 2, y: y - size / 2, width: size, height: size }, style: fillStyle(SERIES[props.colorIndices?.[seriesIndex] ?? seriesIndex % SERIES.length]), data: { series: point.series ?? null, sizeValue: bubble ? point.size : null } }));
    if (point.showLabel !== false && props.dataLabels !== false) nodes.push(textPrimitive({ id: stableId(id, "label", point.name), role: "data-label", frame: { x: x + size / 2 + 4, y: y - 12, width: 96, height: 24 }, text: point.name, style: textStyle(CHART_LABEL, INK, false, "left") }));
    const mappedPoint = { x, y, changeX: x, changeY: y - 16 };
    pointMap.set(`value:${point.name}`, mappedPoint);
    pointMap.set(`${point.series || "value"}:${point.name}`, mappedPoint);
    pointMap.set(`category:${point.name}`, mappedPoint);
    categoryMap.set(point.name, { x: x - size, y: y - size, width: size * 2, height: size * 2 });
  });
  const placed = [];
  const marks = nodes.filter((node) => node.role === "chart-marker");
  const intersects = (a, b) => a.x < b.x + b.width + 3 && a.x + a.width + 3 > b.x && a.y < b.y + b.height + 3 && a.y + a.height + 3 > b.y;
  for (const label of nodes.filter((node) => node.role === "data-label")) {
    const point = pointMap.get(`value:${label.text}`);
    const mark = marks.find((node) => node.id === stableId(id, "point", label.text));
    const measured = measureText(label.text, label.frame.width, { fontSize: tokenValue(CHART_LABEL) });
    const width = Math.ceil(measured.width) + 2, height = 24;
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
    const candidate = candidates.find((candidate) => candidate.x >= plot.x && candidate.x + width <= plot.x + plot.width && candidate.y >= plot.y && candidate.y + height <= plot.y + plot.height && [...placed, ...marks.map((node) => node.frame)].every((other) => !intersects(candidate, other)));
    if (!candidate) throw new Error(`No collision-free position for scatter label ${label.text}; enlarge the exhibit or reduce labelled points`);
    label.frame = candidate;
    placed.push(candidate);
  }
  return withDecorations(nodes, { id, plot, props, pointMap, categoryMap, allowAnnotationRail: false });
}

export const PART_TO_WHOLE_VARIANTS = Object.freeze({ "legend-top-right": {}, "outside-labels": { props: { labels: ["Category 1", "Category 2", "Category 3", "Category 4"], values: [25, 25, 25, 25] } }, "shared-legend": {} });
export function resolvePartToWholeVariant(props = {}) {
  const variant = props.variant ?? (props.outsideLabels ? "outside-labels" : props.legend === false ? "shared-legend" : "legend-top-right");
  if (!Object.hasOwn(PART_TO_WHOLE_VARIANTS, variant)) throw new Error(`Unknown pie/donut variant: ${variant}`);
  if (props.legend === true && variant !== "legend-top-right" || props.legend === false && variant === "legend-top-right" || props.outsideLabels === true && variant !== "outside-labels") throw new Error("Pie/donut variant conflicts with legend or outsideLabels");
  return variant;
}

function partToWhole({ id, frame, props, donut = false, tokens = TOKENS }) {
  if ((props.changeAnnotations || []).length || props.annotationRail) throw new Error("Pie and donut charts do not support ordered change annotations; use direct segment labels or another encoding");
  const variant = resolvePartToWholeVariant(props);
  const showLegend = variant === "legend-top-right";
  const legendHeight = showLegend ? 48 : 0;
  if (!Array.isArray(props.labels) || !Array.isArray(props.values) || props.values.length < 2 || props.values.length > 5 || props.labels.length !== props.values.length || props.labels.some(label => typeof label !== "string" || !label.trim()) || new Set(props.labels).size !== props.labels.length || props.values.some(v => !Number.isFinite(v) || v < 0) || props.values.filter(v => v > 0).length < 2) throw new Error("Pie/donut needs two to five unique categories and at least two positive finite values");
  const availableHeight = frame.height - legendHeight;
  const outside = variant === "outside-labels";
  const labelWidth = outside ? Math.max(...props.labels.map(label => measureText(label, frame.width, { fontSize: tokenValue(CHART_ANNOTATION), fontFamily: tokenValue(token("font.bodySemibold")), bold: tokenDefinition("font.bodySemibold").nativeBold, wrapWidthRatio: 1 }).width)) : 0;
  const gutter = outside ? labelWidth + 24 : 16;
  const size = Math.min(frame.width - 2 * gutter, availableHeight - 32);
  if (size < 140) throw new Error("Pie/donut and labels do not fit; enlarge the section or use a legend");
  const circle = { x: frame.x + (frame.width - size) / 2, y: frame.y + legendHeight + (availableHeight - size) / 2, width: size, height: size };
  const total = props.values.reduce((sum, value) => sum + value, 0);
  const colorIndices = props.labels.map((label, index) => props.categoryKeys ? props.categoryKeys.indexOf(label) : index);
  if (colorIndices.some(i => i < 0 || i >= SERIES.length)) throw new Error("Pie/donut category is missing from the shared legend mapping");
  const nodes = showLegend ? legendNodes({ id: stableId(id, "legend"), frame: { x: frame.x + 16, y: frame.y + 7, width: frame.width - 32, height: 28 }, props: { placement: "top-right", items: props.labels.map((label, index) => ({ label, colorIndex: colorIndices[index] })) } }) : [];
  let angle = -90;
  const labelAngles = [];
  props.values.forEach((value, index) => {
    const sweep = 360 * value / total;
    labelAngles.push((angle + sweep / 2) * Math.PI / 180);
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
  if (props.dataLabels !== false) props.values.forEach((value, index) => {
    if (!value) return;
    const labelRadius = donut ? 0.365 : 0.29;
    const insideX = cx + Math.cos(labelAngles[index]) * size * labelRadius;
    const insideY = cy + Math.sin(labelAngles[index]) * size * labelRadius;
    const background = tokens[SERIES[colorIndices[index]].tokenId].value;
    const foreground = contrastRatio(background, tokens["color.onPrimary"].value) >= contrastRatio(background, tokens["color.ink"].value) ? token("color.onPrimary") : INK;
    const percentage = Math.round(100 * value / total), text = `${percentage}%`;
    const measured = measureText(text, 64, { fontSize: tokenValue(CHART_LABEL), bold: true, wrapWidthRatio: 1 });
    // Test visible text plus clearance against its own sector, not the circular
    // bounding box shared by every slice. Donuts must also clear the inner hole.
    const halfWidth = measured.width / 2 + 4, halfHeight = Math.max(28, measured.height) / 2 + 4;
    const dx = insideX - cx, dy = insideY - cy, halfSweep = Math.PI * value / total;
    const cornersFit = [-1, 1].every(sx => [-1, 1].every(sy => {
      const x = dx + sx * halfWidth, y = dy + sy * halfHeight;
      const delta = Math.atan2(y, x) - labelAngles[index];
      return Math.hypot(x, y) <= size / 2 && Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta))) <= halfSweep;
    }));
    const holeClear = !donut || Math.hypot(Math.max(0, Math.abs(dx) - halfWidth), Math.max(0, Math.abs(dy) - halfHeight)) >= size * 0.23;
    if (!percentage || measured.height > 28 || !cornersFit || !holeClear) throw new Error(`Pie/donut percentage for ${props.labels[index]} does not fit its slice; enlarge the chart or use a bar/stacked-bar encoding`);
    nodes.push(textPrimitive({ id: stableId(id, "percentage", index), role: "data-label", frame: { x: insideX - 32, y: insideY - 14, width: 64, height: 28 }, text, style: textStyle(CHART_LABEL, foreground, true, "center"), data: { categoryKey: props.labels[index], contrast: contrastRatio(background, tokens[foreground.tokenId].value) } }));
  });
  if (outside) {
    props.values.forEach((value, index) => {
      if (!value) return;
      const right = Math.cos(labelAngles[index]) >= 0;
      const outsideY = cy + Math.sin(labelAngles[index]) * size * 0.48;
      nodes.push(textPrimitive({ id: stableId(id, "outside-label", index), role: "category-label", frame: { x: right ? circle.x + size + 16 : circle.x - labelWidth - 16, y: outsideY - 14, width: labelWidth, height: 28 }, text: props.labels[index], style: { ...textStyle(CHART_ANNOTATION, INK, false, right ? "left" : "right"), ...chartAnnotationStyle(), wrap: false }, data: { directAnnotation: true, textLayout: { lines: [props.labels[index]] } } }));
    });
  }
  return nodes;
}

const chartDefinitions = [
  {
    id: "chart.column", render: (context) => categoricalChart(context),
    sample: { categories: ["2023", "2024", "2025", "2026"], series: [{ name: "value", values: [32, 46, 61, 74] }], highlights: [{ category: "2026" }], annotations: [], referenceLines: [{ value: 60, label: "Target" }] }
  },
  {
    id: "chart.bar", render: (context) => categoricalChart({ ...context, horizontal: true }),
    sample: { categories: ["North", "West", "South", "East"], series: [{ name: "value", values: [74, 62, 48, 35] }], highlights: [{ category: "North" }], annotations: [{ category: "North", text: "Scale leader" }] }
  },
  {
    id: "chart.stacked-column", render: (context) => categoricalChart({ ...context, stacked: true }),
    sample: { categories: ["2024", "2025", "2026"], series: [{ name: "Core", values: [30, 32, 35] }, { name: "Growth", values: [12, 20, 30] }, { name: "New", values: [5, 9, 14] }], annotations: [{ series: "New", category: "2026", text: "New scales" }] }
  },
  {
    id: "chart.stacked-bar", render: (context) => categoricalChart({ ...context, horizontal: true, stacked: true }),
    sample: { categories: ["Segment A", "Segment B", "Segment C"], series: [{ name: "Core", values: [45, 35, 25] }, { name: "Growth", values: [35, 40, 45] }, { name: "New", values: [20, 25, 30] }] }
  },
  {
    id: "chart.line", render: (context) => lineChart(context),
    sample: { categories: ["Q1", "Q2", "Q3", "Q4"], series: [{ name: "Actual", values: [22, 31, 43, 55] }, { name: "Plan", values: [25, 34, 42, 48] }], highlights: [{ category: "Q4" }], annotations: [{ series: "Actual", category: "Q4", text: "Ahead of plan" }] }
  },
  {
    id: "chart.area", render: (context) => lineChart({ ...context, area: true }),
    sample: { categories: ["Jan", "Feb", "Mar", "Apr", "May"], series: [{ name: "value", values: [18, 28, 34, 47, 59] }], annotations: [{ category: "May", text: "Demand builds" }] }
  },
  {
    id: "chart.waterfall", render: waterfall,
    sample: { categories: ["Start", "Price", "Volume", "Cost", "End"], values: [80, 18, 12, -9, 101], totals: [0, 4], annotations: [{ category: "End", text: "+21 net" }] }
  },
  {
    id: "chart.scatter", render: (context) => scatter(context),
    sample: { points: [{ name: "A", x: 20, y: 36 }, { name: "B", x: 42, y: 58 }, { name: "C", x: 68, y: 74 }, { name: "D", x: 82, y: 44 }], annotations: [{ category: "C", text: "Best position" }] }
  },
  {
    id: "chart.bubble", render: (context) => scatter({ ...context, bubble: true }),
    sample: { points: [{ name: "A", x: 18, y: 38, size: 12 }, { name: "B", x: 43, y: 66, size: 36 }, { name: "C", x: 72, y: 76, size: 58 }, { name: "D", x: 84, y: 42, size: 20 }] }
  },
  {
    id: "chart.pie", render: (context) => partToWhole(context),
    sample: { labels: ["Direct", "Partner", "Digital", "Other"], values: [42, 28, 18, 12] }
  },
  {
    id: "chart.donut", render: (context) => partToWhole({ ...context, donut: true }),
    sample: { labels: ["Core", "Growth", "New"], values: [52, 31, 17] }
  },
  {
    id: "chart.range", render: rangeChart,
    sample: { heading: "(Insert measure and population)", categories: ["Research", "Labs", "Core Models", "API Agents"], low: [305, 385, 347, 300], high: [385, 460, 490, 400], unit: "$k", highlights: [{ category: "Core Models", style: "bar" }] }
  },
  {
    id: "chart.combo", render: comboChart,
    sample: { categories: ["2023", "2024", "2025", "2026"], series: [{ name: "Revenue", values: [42, 55, 68, 82] }, { name: "Plan", values: [45, 58, 70, 85] }], annotations: [{ series: "Revenue", category: "2026", text: "Revenue reaches $82m" }] }
  },
  {
    id: "chart.horizons",
    render: renderHorizons,
    sample: HORIZONS_SAMPLE,
    tokens: HORIZONS_TOKENS
  }
];

function chartExamples(id) {
  if (["chart.column", "chart.bar"].includes(id)) {
    const examples = {
      "single-bar-highlight": { props: { categories: ["Category A", "Category B", "Category C"], series: [{ name: "Measure", values: [48, 72, 56] }], highlights: [{ category: "Category B", style: "bar" }], annotations: [], referenceLines: [] } },
      "region-box-highlight": { props: { categories: ["Category A", "Category B", "Category C"], series: [{ name: "Measure A", values: [52, 68, 74] }, { name: "Measure B", values: [44, 61, 63] }], highlights: [{ category: "Category C", style: "region-box" }], annotations: [], referenceLines: [] } },
      "region-tint-highlight": { props: { categories: ["Category A", "Category B", "Category C"], series: [{ name: "Measure A", values: [52, 68, 74] }, { name: "Measure B", values: [44, 61, 63] }], highlights: [{ category: "Category C", style: "region-tint" }], annotations: [], referenceLines: [] } },
      "two-mark-contrast": { props: { categories: ["Current", "Future"], series: [{ name: "Measure", values: [80, 150] }], highlights: [], annotations: [], referenceLines: [] } },
      "focal-series": { props: { categories: ["Area 1", "Area 2"], series: [{ name: "Baseline", values: [40, 55] }, { name: "Actual", values: [60, 70] }], focusSeries: "Actual", legend: true, dataLabels: true, highlights: [], annotations: [], referenceLines: [] } }
    };
    if (id === "chart.column") {
      Object.assign(examples, {
        "qualitative-interval": { props: { categories: ["Initial estimate", "Revised estimate", "Current estimate"], series: [{ name: "Approximate level", values: [80, 50, 45] }], valueFormat: { prefix: "~" }, dataLabels: true, annotations: [], highlights: [], referenceLines: [], changeAnnotations: [{ style: "interval-label", start: "Initial estimate", end: "Revised estimate", text: "Assumptions revised", basis: "approximate-source-readings", qualification: "Approximate illustrative levels" }] } },
        "multi-row-annotation-rail": { props: { categories: ["Case A", "Case B", "Case C"], series: [{ name: "Value", values: [230,338,459] }], dataLabels: true, annotationRail: { rows: [{ label: "EPS, $", items: [{ category: "Case A", text: "10.48" }, { category: "Case B", text: "12.52" }, { category: "Case C", text: "14.34" }] }, { label: "P/E", items: [{ category: "Case A", text: "22x" }, { category: "Case B", text: "27x" }, { category: "Case C", text: "32x" }] }] }, highlights: [], annotations: [], referenceLines: [] } },
        "wrapped-reference-label": { props: { categories: ["Case A", "Case B", "Case C"], series: [{ name: "Value", values: [231,338,459] }], dataLabels: true, yMax:520, annotations: [], highlights: [], referenceLines: [{ value:335.02, label:"Reference close\n$335.02" }] } },
        "a-vs-b-change": { props: { categories: ["Current", "Future"], series: [{ name: "Measure", values: [80, 150] }], dataLabels: true, highlights: [{ category: "Future", style: "bar" }], annotations: [], changeAnnotations: [{ start: "Current", end: "Future", style: "arrow", text: "+87.5%" }], referenceLines: [] } },
        "grouped-series-change": { props: { categories: ["Area 1", "Area 2", "Area 3"], series: [{ name: "Baseline", values: [24, 22, 35] }, { name: "Future", values: [47, 58, 40] }], focusSeries: "Future", dataLabels: true, highlights: [], annotations: [], changeAnnotations: [
          { start: { category: "Area 1", series: "Baseline" }, end: { category: "Area 1", series: "Future" }, style: "bracket", text: "+23" },
          { start: { category: "Area 2", series: "Baseline" }, end: { category: "Area 2", series: "Future" }, style: "bracket", text: "+36" },
          { start: { category: "Area 3", series: "Baseline" }, end: { category: "Area 3", series: "Future" }, style: "bracket", text: "+5" }
        ], referenceLines: [] } },
        "annotation-rail": { props: { categories: ["2022", "2023", "2024", "2025"], series: [{ name: "Measure", values: [42, 55, 71, 86] }], dataLabels: true, highlights: [], annotations: [], annotationRail: { items: [{ category: "2022", text: "+8%" }, { category: "2023", text: "+13%" }, { category: "2024", text: "+29%" }, { category: "2025", text: "+21%" }] }, referenceLines: [] } }
      });
    }
    return examples;
  }
  if (["chart.stacked-column", "chart.stacked-bar"].includes(id)) {
    const examples = {
      "legend-top-right": { props: { categories: ["2023", "2024", "2025", "2026"], series: [{ name: "Core", values: [34, 38, 43, 48] }, { name: "Recurring", values: [18, 24, 31, 39] }, { name: "New", values: [6, 8, 11, 15] }], legend: true, dataLabels: true, annotations: [], highlights: [], referenceLines: [] } }
    };
    examples["totals-and-secondary-units"] = { props: {
      categories: ["Group A", "Group B"], series: [{name:"Core",values:[24,32]},{name:"Additional",values:[36,28]}],
      dataLabels:true, yMin:0, yMax:80, valueFormat:{suffix:"%"},
      stackTotals:[{category:"Group A",value:60},{category:"Group B",value:60}],
      secondaryLabels:[{category:"Group B",series:"Core",value:32000,unit:"people",valueFormat:{compactUnit:"k",decimals:0}},{category:"Group B",anchor:"stack-total",value:60000,unit:"people",valueFormat:{compactUnit:"k",decimals:0}}],
      annotations:[], highlights:[], referenceLines:[]
    } };
    examples["parenthetical-secondary-units"] = { props: {
      heading:"Workers by scenario", categories:["Group A","Group B"],series:[{name:"Core",values:[24,32]},{name:"Additional",values:[36,28]}],
      dataLabels:true,yMin:0,yMax:80,valueFormat:{suffix:"%"},secondaryLabelStyle:"parenthetical",secondaryUnit:"workers",
      secondaryLabels:[{category:"Group B",series:"Core",value:32000,unit:"workers",valueFormat:{compactUnit:"k",decimals:0}}],annotations:[],highlights:[],referenceLines:[]
    } };
    if(id === "chart.stacked-column") examples["category-groups"] = { props: {
      categories:["Group A","Group B","Group C","Group D"],series:[{name:"Core",values:[20,30,40,50]},{name:"Additional",values:[30,25,20,15]}],
      dataLabels:true,yMin:0,yMax:80,categoryGroups:[{id:"first",label:"First cohort",categories:["Group A","Group B"]},{id:"second",label:"Second cohort",categories:["Group C","Group D"]}],annotations:[],highlights:[],referenceLines:[]
    } };
    if (id === "chart.stacked-column") examples["small-segment-external-label"] = { props: {
      categories:["Late","Midpoint","Early"], series:[{name:"Adopted",values:[2,21,41]},{name:"Remaining",values:[39,39,38]}],
      stackTotals:[{category:"Late",value:41},{category:"Midpoint",value:60},{category:"Early",value:79}],
      dataLabels:true, yMin:0, yMax:80, valueFormat:{suffix:"%"}, annotations:[], highlights:[], referenceLines:[]
    } };
    if (id === "chart.stacked-column") examples["total-construction"] = { props: { categories: ["Current", "Future"], series: [{ name: "Core", values: [40, 46] }, { name: "Growth", values: [22, 38] }, { name: "New", values: [8, 20] }], dataLabels: true, annotations: [], changeAnnotations: [{ start: "Current", end: "Future", style: "construction", text: "+34" }], highlights: [], referenceLines: [] } };
    return examples;
  }
  if (id === "chart.waterfall") return {
    "end-to-end-construction": { props: { categories: ["Opening", "Cost", "Mix", "Capacity", "Closing"], values: [70, -20, -15, -10, 25], totals: [0, 4], yMax: 80, annotations: [], changeAnnotations: [{ start: "Opening", end: "Closing", style: "construction", text: "-45" }], highlights: [], referenceLines: [] } }
  };
  if (id === "chart.line") return {
    "numeric-sparse-observations": { preferredSize: { width: 1160, height: 480 }, props: {
      categories: undefined, heading: "(Insert source-qualified trajectory)", unit: "%", gapPolicy: "explicit-breaks",
      xAxis: { unit: "year", min: 2000, max: 2030, ticks: [{value:2000,label:"2000"},{value:2010,label:"2010"},{value:2020,label:"2020"},{value:2030,label:"2030"}] },
      statusBoundary: { x: 2018, beforeLabel: "Historical", afterLabel: "Modelled" },
      series: [
        { name: "Historical", status: "before", points: [{key:"start",x:2000,y:3},{key:"turn",x:2005,y:5},{key:"resume",x:2014,y:4,breakBefore:true},{key:"boundary",x:2018,y:4.5}] },
        { name: "Scenario", status: "after", points: [{key:"boundary",x:2018,y:4.5},{key:"peak",x:2025,y:6,label:true},{key:"end",x:2030,y:5}] }
      ], yMin: 0, yMax: 8, valueFormat: {decimals:1,prefix:"~",suffix:"%"}, dataLabels: false, legend: true, annotations: [], highlights: [], referenceLines: []
    } },
    "callout-borderless": { props: { categories: ["2021", "2022", "2023", "2024", "2025"], series: [{ name: "Measure", values: [0.8, 1.5, 2.2, 2.6, 3.1] }], yMax: 4, dataLabels: false, legend: false, annotations: [{ category: "2024", text: "Adoption accelerates after launch", treatment: "callout", border: false }], highlights: [], referenceLines: [] } },
    "orthogonal-dot-vertical": { props: { categories: ["Q1", "Q2", "Q3", "Q4"], series: [{ name: "Measure", values: [22, 31, 48, 55] }], yMax: 60, dataLabels: false, legend: false, annotations: [{ category: "Q3", text: "The launch creates a clear inflection", treatment: "orthogonal-dot", orientation: "vertical" }], highlights: [], referenceLines: [] } },
    "long-range-growth": { props: { categories: ["2021", "2022", "2023", "2024", "2025"], series: [{ name: "Measure", values: [0.8, 1.5, 2.2, 2.6, 3.1] }], yMax: 4, dataLabels: true, legend: false, annotations: [], changeAnnotations: [{ start: "2021", end: "2025", style: "bracket", text: "+288%" }], highlights: [], referenceLines: [] } },
    "annotation-rail": { props: { categories: ["2021", "2022", "2023", "2024", "2025"], series: [{ name: "Measure", values: [0.8, 1.5, 2.2, 2.6, 3.1] }], yMax: 4, dataLabels: true, legend: false, annotations: [], annotationRail: { items: [{ category: "2021", text: "N/A" }, { category: "2022", text: "+88%" }, { category: "2023", text: "+47%" }, { category: "2024", text: "+18%" }, { category: "2025", text: "+19%" }] }, highlights: [], referenceLines: [] } },
    "gridlines-for-dense-scale": { props: { categories: ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"], series: [{ name: "Actual", values: [18, 29, 34, 46, 53, 68] }, { name: "Plan", values: [22, 27, 38, 44, 58, 64] }], yMax: 80, gridlines: true, annotations: [], highlights: [], referenceLines: [] } }
  };
  if (id === "chart.scatter") return {
    "orthogonal-dot-horizontal": { props: { points: [{ name: "Priority", x: 76, y: 72 }, { name: "Monitor", x: 18, y: 24 }], xMin: 0, xMax: 100, yMin: 0, yMax: 100, annotations: [{ category: "Priority", text: "Scale the proven priority", treatment: "orthogonal-dot", orientation: "horizontal", side: "left" }], legend: false } },
    "quadrant-lines": { props: { points: [{ name: "Item A", x: 18, y: 76 }, { name: "Item B", x: 34, y: 28 }, { name: "Item C", x: 68, y: 72 }, { name: "Item D", x: 82, y: 34 }], xMin: 0, xMax: 100, yMin: 0, yMax: 100, quadrants: { x: 50, y: 50, style: "threshold-lines", titles: { topLeft: "High value, lower ease", topRight: "Priority", bottomLeft: "Defer", bottomRight: "Quick wins" } }, annotations: [], legend: false } },
    "quadrant-alternating-tint": { props: { points: [{ name: "Item A", x: 18, y: 76 }, { name: "Item B", x: 34, y: 28 }, { name: "Item C", x: 68, y: 72 }, { name: "Item D", x: 82, y: 34 }], xMin: 0, xMax: 100, yMin: 0, yMax: 100, quadrants: { x: 50, y: 50, style: "alternating-tint", titles: { topLeft: "Build", topRight: "Scale", bottomLeft: "Monitor", bottomRight: "Simplify" } }, annotations: [], legend: false } }
  };
  if (id === "chart.bubble") return {
    "size-legend-top-right": { props: { points: [{ name: "Item A", x: 18, y: 38, size: 12 }, { name: "Item B", x: 43, y: 66, size: 36 }, { name: "Item C", x: 72, y: 76, size: 58 }, { name: "Item D", x: 84, y: 42, size: 20 }], xMin: 0, xMax: 100, yMin: 0, yMax: 100, sizeLegend: { label: "Bubble area = relative magnitude", markerSize: 12 }, annotations: [] } },
    "quadrant-focus-tint": { props: { points: [{ name: "Item A", series: "Near term", x: 18, y: 76, size: 14 }, { name: "Item B", series: "Long term", x: 34, y: 28, size: 28 }, { name: "Item C", series: "Near term", x: 68, y: 72, size: 48 }, { name: "Item D", series: "Long term", x: 82, y: 34, size: 20 }], xMin: 0, xMax: 100, yMin: 0, yMax: 100, quadrants: { x: 50, y: 50, style: "focus-tint", focus: "topRight", titles: { topLeft: "Selective", topRight: "Priority", bottomLeft: "Monitor", bottomRight: "Streamline" } }, sizeLegend: { label: "Bubble area = relative magnitude", markerSize: 12 }, annotations: [] } }
  };
  return {};
}

export function registerCharts(registry) {
  for (const chart of chartDefinitions) {
    const examples = chartExamples(chart.id);
    const tokens = [
      "font.body", "type.heading", "type.body", "type.chartLabel", "type.chartAnnotation", "type.compact", "type.label", "type.source", "color.ink", "color.textSecondary",
      "font.bodySemibold", "weight.semibold",
      "color.chartGrid", "color.chartComparator", "color.componentPrimary", "color.componentPrimaryTint", "color.accent", "color.rule",
      "color.canvas", "color.surface", "color.surfaceMuted", "color.onPrimary", "color.negative", "line.hairline", "line.standard", "radius.none",
      ...SERIES.map((item) => item.tokenId), ...LEGEND_TOKENS, ...(chart.tokens || [])
    ];
    registry.set(chart.id, {
      id: chart.id,
      version: "2.6.0",
      category: "chart",
      role: "chart",
      tokens: [...new Set([...tokens, ...registry.get("chart-title").tokens])].sort(),
      preferredSize: chart.id === "chart.horizons" ? { width: 1160, height: 460 } : { width: 760, height: 420 },
      sample: chart.sample,
      guidance: CHART_GUIDANCE[chart.id],
      ...(Object.keys(examples).length ? { examples } : {}),
      ...(chart.id === "chart.waterfall" ? { variants: { standard: {}, "negative-close": { props: { categories: ["Operating cash", "Capex", "Free cash flow"], values: [39.069, -44.924, -5.855], totals: [0, 2], yMin: -10, yMax: 50, annotations: [], valueFormat: { decimals: 1 } } } }, defaultVariant: "standard", resolveVariant: props => props.values?.some(value => value < 0) && props.values?.at(-1) < 0 ? "negative-close" : "standard" } : {}),
      ...(chart.id === "chart.line" ? { variants: { standard: {}, "direct-end-labels": { props: { categories: ["Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026"], series: [{ name: "Operating cash", values: [48.414, 52.402, 45.790, 39.069] }, { name: "Capex", values: [23.953, 27.851, 35.674, 44.924] }], yMax: 60, annotations: [], highlights: [], directLabels: "end", valueFormat: { decimals: 1 } } } }, defaultVariant: "standard", resolveVariant: props => props.directLabels === "end" ? "direct-end-labels" : "standard" } : {}),
      ...(["chart.pie", "chart.donut"].includes(chart.id) ? { variants: PART_TO_WHOLE_VARIANTS, defaultVariant: "legend-top-right", variantProp: "variant", resolveVariant: resolvePartToWholeVariant } : {}),
      ...(chart.id === "chart.horizons" ? { variants: HORIZONS_VARIANTS, defaultVariant: "curves", variantProp: "variant", resolveVariant: resolveHorizonsVariant } : {}),
      // Samples belong exclusively to fixtures. Never inject example annotations,
      // targets or data into a production chart with partially supplied props.
      render: ({ id, frame, props = {}, tokens }) => {
        if (!String(props.heading ?? "").trim()) {
          if (String(props.unit ?? "").trim()) throw new Error(`${id}: chart unit requires a nonempty chart heading; render both together or declare both visibly in the parent exhibit`);
          return { nodes: chart.render({ id, frame, tokens, props }) };
        }
        const title = registry.get("chart-title"), titleProps = { heading: props.heading, unit: props.unit, variant: props.titleVariant, ...(props.badge ? { badge: props.badge } : {}) };
        const height = title.measureContent({ frame, props: titleProps }).height;
        return { nodes: [...title.render({ id: stableId(id, "heading"), frame: { ...frame, height }, props: titleProps, tokens }).nodes, ...chart.render({ id, frame: { ...frame, y: frame.y + height, height: frame.height - height }, tokens, props })] };
      }
    });
  }
  return registry;
}

export const CHART_IDS = Object.freeze(chartDefinitions.map((chart) => chart.id));
