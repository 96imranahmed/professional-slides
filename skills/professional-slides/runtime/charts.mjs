import {
  ellipsePrimitive,
  TOKENS,
  chartAnnotationStyle,
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
import { contrastRatio, strongestContrastIndex as contrastIndex } from "./palettes.mjs";
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
const SERIES = [
  token("color.chartSeries1"),
  token("color.chartSeries2"),
  token("color.chartSeries3"),
  token("color.chartSeries4"),
  token("color.chartSeries5"),
  token("color.chartSeries6")
];

function chartFrame(frame, { topLegend = false, annotations = [], changeAnnotations = [], annotationRail = null, endLabels = false } = {}) {
  const bands = chartAnnotationBands({ changeAnnotations, annotationRail });
  const top = (topLegend ? 52 : 28) + evidenceAnnotationTopBandCount({ annotations }) * EVIDENCE_CALLOUT_BAND + bands.top;
  const bottom = 52 + bands.bottom;
  if (frame.height - bottom - top < 100) throw new Error("Chart annotation bands leave insufficient plot height; enlarge or split the exhibit");
  return {
    x: frame.x + 54,
    y: frame.y + top,
    width: Math.max(120, frame.width - (endLabels ? 240 : 70)),
    height: Math.max(100, frame.height - bottom - top)
  };
}

function formatValue(value, props) {
  const format = props.valueFormat;
  if (!format) return String(value);
  const decimals = format.decimals ?? 0;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) throw new Error("valueFormat.decimals must be an integer from zero to six");
  return `${format.prefix || ""}${Number(value).toFixed(decimals)}${format.suffix || ""}`;
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

function range(values) {
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  return { min, max, span: max - min || 1 };
}

function assertGridlineOption(props) {
  if (props.gridlines !== undefined && typeof props.gridlines !== "boolean") throw new Error("Chart gridlines must be true or false");
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
  const computed = range(values);
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

function strongestContrastIndex(tokens) {
  return contrastIndex(SERIES.map(series => tokens[series.tokenId].value));
}

function axes(id, plot, yMin, yMax, steps = 4, { gridlines = false } = {}) {
  const nodes = [];
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
      frame: { x: plot.x - 56, y: y - 10, width: 48, height: 20 },
      // Labels describe the actual tick, not a rounded neighbouring value.
      text: String(Number((yMin + (yMax - yMin) * index / steps).toPrecision(6))),
      style: textStyle(token("type.source"), SECONDARY, false, "right")
    }));
  }
  nodes.push(linePrimitive({
    id: stableId(id, "y-axis"), role: "chart-axis",
    x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height,
    style: lineStyle(INK)
  }));
  nodes.push(linePrimitive({
    id: stableId(id, "x-axis"), role: "chart-axis",
    x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height,
    style: lineStyle(INK)
  }));
  return nodes;
}

function horizontalAxes(id, plot, xMin, xMax, steps = 4, { gridlines = false } = {}) {
  const nodes = [];
  for (let index = 0; index <= steps; index += 1) {
    const x = plot.x + plot.width * index / steps;
    if (gridlines) nodes.push(linePrimitive({
      id: stableId(id, "grid", index), role: "chart-gridline",
      x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height,
      style: lineStyle()
    }));
    nodes.push(textPrimitive({
      id: stableId(id, "axis-label", index), role: "axis-label",
      frame: { x: x - 28, y: plot.y + plot.height + 8, width: 56, height: 20 },
      text: String(Number((xMin + (xMax - xMin) * index / steps).toPrecision(6))),
      style: textStyle(token("type.source"), SECONDARY, false, "center")
    }));
  }
  nodes.push(linePrimitive({ id: stableId(id, "y-axis"), role: "chart-axis", x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height, style: lineStyle(INK) }));
  nodes.push(linePrimitive({ id: stableId(id, "x-axis"), role: "chart-axis", x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height, style: lineStyle(INK) }));
  return nodes;
}

function decorations({ id, plot, props, pointMap = new Map(), categoryMap = new Map(), yScale = null, obstacles = [], allowBarHighlight = false, allowAnnotationRail = true }) {
  const underlay = [];
  const overlay = [];
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
      const labelWidth = 126;
      const labelCandidates = [
        { x: plot.x + plot.width - labelWidth - 4, y: y - 28, width: labelWidth, height: 24, align: "right" },
        { x: plot.x + 8, y: y - 28, width: labelWidth, height: 24, align: "left" },
        { x: plot.x + plot.width - labelWidth - 4, y: y + 4, width: labelWidth, height: 24, align: "right" },
        { x: plot.x + 8, y: y + 4, width: labelWidth, height: 24, align: "left" }
      ];
      const labelFrame = labelCandidates.find((candidate) => annotationPlacements.every(({ frame }) => !overlaps(candidate, frame)) && obstacles.filter((node) => ["chart-mark", "data-label"].includes(node.role)).every((node) => !overlaps(candidate, node.frame)));
      if (!labelFrame) throw new Error("No collision-free reference-line label position; revise the chart composition");
      overlay.push(textPrimitive({
        id: stableId(id, "reference-label", index),
        role: "chart-reference-label",
        frame: { x: labelFrame.x, y: labelFrame.y, width: labelFrame.width, height: labelFrame.height },
        text: reference.label || String(reference.value),
        style: textStyle(CHART_ANNOTATION, token("color.componentPrimary"), true, labelFrame.align)
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
    const measured = measureText(label.text, label.frame.width, { fontFamily: label.style.fontFamily.value, fontSize: label.style.fontSize.value, bold: label.style.bold });
    const width = measured.width + 4, height = measured.height + 2;
    const x = label.style.align === "left" ? label.frame.x - 2 : label.style.align === "right" ? label.frame.x + label.frame.width - width + 2 : label.frame.x + (label.frame.width - width) / 2;
    const frame = { x, y: label.frame.y + (label.frame.height - height) / 2, width, height };
    const insideMark = nodes.some((node) => node.role === "chart-mark" && frame.x >= node.frame.x && frame.y >= node.frame.y && frame.x + width <= node.frame.x + node.frame.width && frame.y + height <= node.frame.y + node.frame.height);
    const crossesGrid = nodes.some((node) => node.role === "chart-gridline" && node.frame.y > frame.y && node.frame.y < frame.y + height && node.frame.x < frame.x + width && node.frame.x + node.frame.width > frame.x);
    if (!insideMark && crossesGrid) backings.push(rectPrimitive({ id: stableId(label.id, "backing"), role: "chart-label-surface", frame, style: { fill: token("color.surface"), stroke: "none", lineWidth: token("line.hairline") }, data: { forNode: label.id } }));
  }
  return [...underlay, ...nodes.flatMap((node) => [...backings.filter((backing) => backing.data.forNode === node.id), node]), ...overlay];
}

function categoricalChart({ id, frame, props, horizontal = false, stacked = false, tokens = TOKENS }) {
  assertGridlineOption(props);
  const { categories, series } = normalizedCategoricalData(props);
  const highlights = normalizedHighlights(props, { categories, series, allowBar: !stacked });
  const barHighlight = highlights.find(highlight => highlight.style === "bar");
  const regionHighlight = highlights.find(highlight => highlight.style === "region-box" || highlight.style === "region-tint");
  const chartProps = { ...props, highlights };
  const showLegend = props.legend !== false && series.length > 1;
  const plot = chartFrame(frame, {
    topLegend: showLegend,
    annotations: props.annotations,
    changeAnnotations: props.changeAnnotations,
    annotationRail: props.annotationRail
  });
  const values = series.flatMap((item) => item.values);
  const stackExtents = categories.flatMap((_, categoryIndex) => {
    if (!stacked) return series.map(item => item.values[categoryIndex]);
    const categoryValues = series.map(item => item.values[categoryIndex]);
    return [
      categoryValues.filter(value => value < 0).reduce((sum, value) => sum + value, 0),
      categoryValues.filter(value => value > 0).reduce((sum, value) => sum + value, 0)
    ];
  });
  const bounds = numericBounds(stacked ? stackExtents : values, { min: props.yMin, max: props.yMax, axis: horizontal ? "x" : "y", includeZero: true });
  const twoMarkContrast = !stacked && !barHighlight && props.colorIndices === undefined && categories.length * series.length === 2;
  const twoSeriesContrast = !stacked && !barHighlight && props.colorIndices === undefined && series.length === 2;
  const contrastPair = twoMarkContrast || twoSeriesContrast ? [0, strongestContrastIndex(tokens)] : null;
  const colorIndexFor = (seriesIndex, categoryIndex) => {
    const explicit = props.colorIndices?.[seriesIndex];
    if (explicit !== undefined) {
      if (!Number.isInteger(explicit) || explicit < 0 || explicit >= SERIES.length) throw new Error("Chart colour index must be between zero and five");
      return explicit;
    }
    return contrastPair ? contrastPair[twoSeriesContrast ? seriesIndex : categoryIndex * series.length + seriesIndex] : seriesIndex % SERIES.length;
  };
  const legendItems = series.map((item, seriesIndex) => ({ label: item.name, colorIndex: colorIndexFor(seriesIndex, 0) }));
  const nodes = showLegend ? topLegend({ id, frame, items: legendItems }) : [];
  const pointMap = new Map();
  const categoryMap = new Map();
  const yScale = (value) => plot.y + plot.height - (value - bounds.min) / bounds.span * plot.height;
  const xScale = (value) => plot.x + (value - bounds.min) / bounds.span * plot.width;

  nodes.push(...(horizontal
    ? horizontalAxes(id, plot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true })
    : axes(id, plot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true })));
  if (bounds.min < 0 && bounds.max > 0) nodes.push(linePrimitive({
    id: stableId(id, "zero-baseline"), role: "chart-axis",
    ...(horizontal
      ? { x1: xScale(0), y1: plot.y, x2: xScale(0), y2: plot.y + plot.height }
      : { x1: plot.x, y1: yScale(0), x2: plot.x + plot.width, y2: yScale(0) }),
    style: lineStyle(INK)
  }));
  const categorySpan = (horizontal ? plot.height : plot.width) / categories.length;
  const groupSpan = categorySpan * 0.7;
  const barSpan = stacked ? groupSpan : groupSpan / series.length;
  const showDataLabels = props.dataLabels === true || (props.dataLabels !== false && series.length === 1);

  categories.forEach((category, categoryIndex) => {
    const categoryStart = (horizontal ? plot.y : plot.x) + categoryIndex * categorySpan + (categorySpan - groupSpan) / 2;
    categoryMap.set(category, horizontal
      ? { x: plot.x, y: categoryStart, width: plot.width, height: groupSpan }
      : { x: categoryStart, y: plot.y, width: groupSpan, height: plot.height });
    let positiveCumulative = 0;
    let negativeCumulative = 0;
    series.forEach((item, seriesIndex) => {
      const value = item.values[categoryIndex];
      const selected = barHighlight?.category === category;
      const colorIndex = colorIndexFor(seriesIndex, categoryIndex);
      const markColor = barHighlight ? (selected ? token("color.componentPrimary") : token("color.textSecondary")) : SERIES[colorIndex];
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
        const labelFrame = horizontal
          ? stacked
            ? { x: bar.x + 2, y: bar.y - 2, width: Math.max(1, bar.width - 4), height: bar.height + 4 }
            : value >= 0
              ? { x: Math.min(plot.x + plot.width - 52, bar.x + bar.width + 4), y: bar.y - 2, width: 50, height: bar.height + 4 }
              : { x: Math.max(plot.x, bar.x - 54), y: bar.y - 2, width: 50, height: bar.height + 4 }
          : stacked
            ? { x: bar.x + 2, y: bar.y + (bar.height - 24) / 2, width: bar.width - 4, height: 24 }
            : value >= 0
              ? { x: bar.x - 10, y: bar.y - 26, width: bar.width + 20, height: 24 }
              : { x: bar.x - 10, y: Math.min(plot.y + plot.height - 24, bar.y + bar.height + 2), width: bar.width + 20, height: 24 };
        nodes.push(textPrimitive({
          id: stableId(id, "value-label", item.name, category),
          role: "data-label",
          frame: labelFrame,
          text: formatValue(value, props),
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
    if (stacked && !horizontal && showDataLabels) {
      const labels = nodes.filter((node) => node.role === "data-label" && node.data.category === category).sort((a, b) => a.frame.y - b.frame.y);
      const marks = nodes.filter((node) => node.role === "chart-mark" && node.id.endsWith(`:${stableId(category)}`));
      if (marks.some((mark) => mark.frame.height < 24)) {
        const startY = Math.min(labels[0].frame.y, plot.y + plot.height - labels.length * 26);
        labels.forEach((label, index) => {
          const mark = marks.find((mark) => mark.id === stableId(id, "series", label.data.series, category));
          const x = mark.frame.x + mark.frame.width + 6;
          label.frame = { x, y: startY + index * 26, width: 34, height: 24 };
          // Resolve a new inherited binding through the primitive constructor.
          Object.assign(label, textPrimitive({ id: label.id, role: label.role, frame: label.frame, text: label.text, data: label.data, style: textStyle(CHART_LABEL, INK, true, "left") }));
          nodes.push(linePrimitive({ id: stableId(label.id, "leader"), role: "data-label-leader", x1: mark.frame.x + mark.frame.width, y1: mark.frame.y + mark.frame.height / 2, x2: x - 2, y2: label.frame.y + 12, style: lineStyle(INK) }));
        });
      }
    }
    nodes.push(textPrimitive({
      id: stableId(id, "category", category),
      role: "category-label",
      frame: horizontal
        ? { x: plot.x - 62 - (regionHighlight ? REGION_HIGHLIGHT_INLINE_PAD : 0), y: categoryStart, width: 56, height: groupSpan }
        : { x: categoryStart - 8, y: plot.y + plot.height + (regionHighlight ? 18 : 8), width: groupSpan + 16, height: 28 },
      text: category,
      style: textStyle(token("type.source"), SECONDARY, false, horizontal ? "right" : "center")
    }));
  });
  return withDecorations(nodes, {
    id,
    plot,
    props: chartProps,
    pointMap,
    categoryMap,
    yScale: horizontal ? null : yScale,
    allowBarHighlight: true,
    allowAnnotationRail: !horizontal
  });
}

function lineChart({ id, frame, props, area = false }) {
  assertGridlineOption(props);
  const { categories, series } = normalizedCategoricalData(props);
  if (area && categories.length < 2) throw new Error("Area charts require at least two categories");
  const endLabels = props.directLabels === "end";
  const showLegend = !endLabels && props.legend !== false && series.length > 1;
  const plot = chartFrame(frame, {
    topLegend: showLegend,
    annotations: props.annotations,
    changeAnnotations: props.changeAnnotations,
    annotationRail: props.annotationRail,
    endLabels
  });
  const values = series.flatMap((item) => item.values);
  const bounds = numericBounds(values, { min: props.yMin, max: props.yMax, axis: "y" });
  const yScale = (value) => plot.y + plot.height - (value - bounds.min) / bounds.span * plot.height;
  const xScale = (index) => plot.x + (categories.length === 1 ? plot.width / 2 : plot.width * index / (categories.length - 1));
  const nodes = [
    ...(showLegend ? topLegend({ id, frame, items: series.map((item) => item.name) }) : []),
    ...axes(id, plot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true })
  ];
  const pointMap = new Map();
  const categoryMap = new Map();
  const categorySlot = Math.min(120, Math.max(76, plot.width / Math.max(1, categories.length) * 0.82));
  categories.forEach((category, index) => {
    const x = xScale(index);
    categoryMap.set(category, { x: x - categorySlot / 2, y: plot.y, width: categorySlot, height: plot.height });
    nodes.push(textPrimitive({ id: stableId(id, "category", category), role: "category-label", frame: { x: x - 34, y: plot.y + plot.height + 8, width: 68, height: 24 }, text: category, style: textStyle(token("type.source")) }));
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
      const mappedPoint = { ...point, changeX: point.x, changeY: point.y - (props.dataLabels === true ? 30 : 16) };
      pointMap.set(`${item.name}:${point.category}`, mappedPoint);
      if (series.length === 1) pointMap.set(`value:${point.category}`, mappedPoint);
      const categoryPoint = pointMap.get(`category:${point.category}`);
      if (!categoryPoint || mappedPoint.y < categoryPoint.y) pointMap.set(`category:${point.category}`, mappedPoint);
      if (props.dataLabels === true) {
        const first = point.category === categories[0];
        nodes.push(textPrimitive({
          id: stableId(id, "value-label", item.name, point.category),
          role: "data-label",
          frame: first
            ? { x: point.x + 8, y: Math.min(plot.y + plot.height - 24, point.y + 8), width: 60, height: 24 }
            : { x: Math.max(plot.x + 4, Math.min(plot.x + plot.width - 64, point.x - 30)), y: point.y - 27, width: 60, height: 24 },
          text: formatValue(point.value, props),
          style: textStyle(CHART_LABEL, INK, true, first ? "left" : "center")
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
  const plot = chartFrame(frame, {
    annotations: props.annotations,
    changeAnnotations: props.changeAnnotations,
    annotationRail: props.annotationRail
  });
  const running = [];
  let total = 0;
  props.values.forEach((value, index) => {
    if (props.totals?.includes(index)) total = value;
    else total += value;
    running.push(total);
  });
  const bounds = numericBounds([0, ...running], { min: props.yMin, max: props.yMax, axis: "y", includeZero: true });
  const yScale = (value) => plot.y + plot.height - (value - bounds.min) / bounds.span * plot.height;
  const nodes = axes(id, plot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true });
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
    nodes.push(textPrimitive({ id: stableId(id, "value-label", category), role: "data-label", frame: { x: bar.x - 10, y: bar.y - 26, width: bar.width + 20, height: 24 }, text: isTotal ? formatValue(value, props) : `${value >= 0 ? "+" : ""}${formatValue(value, props)}`, style: textStyle(CHART_LABEL, INK, true, "center") }));
    if (index > 0) nodes.push(linePrimitive({ id: stableId(id, "connector", index), role: "chart-connector", x1: plot.x + (index - 1) * span + span * 0.8, y1: yScale(previous), x2: plot.x + index * span + span * 0.2, y2: yScale(previous), style: lineStyle(SECONDARY, token("line.hairline"), "dash") }));
    const point = { x: bar.x + bar.width / 2, y: bar.y, changeX: bar.x + bar.width / 2, changeY: bar.y - 38, leaderX: bar.x + bar.width };
    pointMap.set(`value:${category}`, point);
    pointMap.set(`category:${category}`, point);
    categoryMap.set(category, { x: bar.x, y: plot.y, width: bar.width, height: plot.height });
    nodes.push(textPrimitive({ id: stableId(id, "category", category), role: "category-label", frame: { x: plot.x + index * span, y: plot.y + plot.height + 8, width: span, height: 28 }, text: category, style: textStyle(token("type.source")) }));
    previous = end;
  });
  return withDecorations(nodes, { id, plot, props, pointMap, categoryMap, yScale });
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
      frame: { x: x - categorySpan / 2, y: plot.y + plot.height + 8, width: categorySpan, height: 24 },
      text: category,
      style: textStyle(token("type.source"))
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
  const items = seriesNames.length > 1 ? seriesNames.map((name, index) => ({ label: name, colorIndex: index })) : [];
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
    nodes.push(ellipsePrimitive({ id: stableId(id, "point", point.name), role: "chart-marker", frame: { x: x - size / 2, y: y - size / 2, width: size, height: size }, style: fillStyle(SERIES[seriesIndex % SERIES.length]), data: { series: point.series ?? null, sizeValue: bubble ? point.size : null } }));
    nodes.push(textPrimitive({ id: stableId(id, "label", point.name), role: "data-label", frame: { x: x + size / 2 + 4, y: y - 12, width: 96, height: 24 }, text: point.name, style: textStyle(CHART_LABEL, INK, false, "left") }));
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
      "two-mark-contrast": { props: { categories: ["Current", "Future"], series: [{ name: "Measure", values: [80, 150] }], highlights: [], annotations: [], referenceLines: [] } }
    };
    if (id === "chart.column") {
      Object.assign(examples, {
        "a-vs-b-change": { props: { categories: ["Current", "Future"], series: [{ name: "Measure", values: [80, 150] }], dataLabels: true, highlights: [], annotations: [], changeAnnotations: [{ start: "Current", end: "Future", style: "arrow", text: "+87.5%" }], referenceLines: [] } },
        "grouped-series-change": { props: { categories: ["Area 1", "Area 2", "Area 3"], series: [{ name: "Baseline", values: [24, 22, 35] }, { name: "Future", values: [47, 58, 40] }], dataLabels: true, highlights: [], annotations: [], changeAnnotations: [
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
    if (id === "chart.stacked-column") examples["total-construction"] = { props: { categories: ["Current", "Future"], series: [{ name: "Core", values: [40, 46] }, { name: "Growth", values: [22, 38] }, { name: "New", values: [8, 20] }], dataLabels: true, annotations: [], changeAnnotations: [{ start: "Current", end: "Future", style: "construction", text: "+34 total" }], highlights: [], referenceLines: [] } };
    return examples;
  }
  if (id === "chart.waterfall") return {
    "end-to-end-construction": { props: { categories: ["Opening", "Cost", "Mix", "Capacity", "Closing"], values: [70, -20, -15, -10, 25], totals: [0, 4], yMax: 80, annotations: [], changeAnnotations: [{ start: "Opening", end: "Closing", style: "construction", text: "-45 total" }], highlights: [], referenceLines: [] } }
  };
  if (id === "chart.line") return {
    "callout-borderless": { props: { categories: ["2021", "2022", "2023", "2024", "2025"], series: [{ name: "Measure", values: [0.8, 1.5, 2.2, 2.6, 3.1] }], yMax: 4, dataLabels: false, legend: false, annotations: [{ category: "2024", text: "Adoption accelerates after launch", treatment: "callout", border: false }], highlights: [], referenceLines: [] } },
    "orthogonal-dot-vertical": { props: { categories: ["Q1", "Q2", "Q3", "Q4"], series: [{ name: "Measure", values: [22, 31, 48, 55] }], yMax: 60, dataLabels: false, legend: false, annotations: [{ category: "Q3", text: "The launch creates a clear inflection", treatment: "orthogonal-dot", orientation: "vertical" }], highlights: [], referenceLines: [] } },
    "long-range-growth": { props: { categories: ["2021", "2022", "2023", "2024", "2025"], series: [{ name: "Measure", values: [0.8, 1.5, 2.2, 2.6, 3.1] }], yMax: 4, dataLabels: true, legend: false, annotations: [], changeAnnotations: [{ start: "2021", end: "2025", style: "bracket", text: "+288%" }], highlights: [], referenceLines: [] } },
    "annotation-rail": { props: { categories: ["2021", "2022", "2023", "2024", "2025"], series: [{ name: "Measure", values: [0.8, 1.5, 2.2, 2.6, 3.1] }], yMax: 4, dataLabels: true, legend: false, annotations: [], annotationRail: { items: [{ category: "2021", text: "Base" }, { category: "2022", text: "+88%" }, { category: "2023", text: "+47%" }, { category: "2024", text: "+18%" }, { category: "2025", text: "+19%" }] }, highlights: [], referenceLines: [] } },
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
      "color.chartGrid", "color.componentPrimary", "color.componentPrimaryTint", "color.rule",
      "color.canvas", "color.surface", "color.surfaceMuted", "color.onPrimary", "color.negative", "line.hairline", "line.standard", "radius.none",
      ...SERIES.map((item) => item.tokenId), ...LEGEND_TOKENS, ...(chart.tokens || [])
    ];
    registry.set(chart.id, {
      id: chart.id,
      version: "2.3.0",
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
        if (!props.heading) return { nodes: chart.render({ id, frame, tokens, props }) };
        const title = registry.get("chart-title"), titleProps = { heading: props.heading, unit: props.unit };
        const height = title.measureContent({ frame, props: titleProps }).height;
        return { nodes: [...title.render({ id: stableId(id, "heading"), frame: { ...frame, height }, props: titleProps, tokens }).nodes, ...chart.render({ id, frame: { ...frame, y: frame.y + height, height: frame.height - height }, tokens, props })] };
      }
    });
  }
  return registry;
}

export const CHART_IDS = Object.freeze(chartDefinitions.map((chart) => chart.id));
