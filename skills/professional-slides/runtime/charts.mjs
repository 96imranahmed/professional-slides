import {
  ellipsePrimitive,
  TOKENS,
  chartAnnotationStyle,
  tokenDefinition,
  linePrimitive,
  rectPrimitive,
  stableId,
  textPrimitive,
  token,
  tokenValue,
  wedgePrimitive
} from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { legendNodes, LEGEND_TOKENS } from "./legends.mjs";
import { contrastRatio } from "./palettes.mjs";

const FONT = token("font.body");
const INK = token("color.ink");
const SECONDARY = token("color.textSecondary");
const GRID = token("color.chartGrid");
const PRIMARY = token("color.chartSeries1");
const SERIES = [
  token("color.chartSeries1"),
  token("color.chartSeries2"),
  token("color.chartSeries3"),
  token("color.chartSeries4"),
  token("color.chartSeries5"),
  token("color.chartSeries6")
];

function chartFrame(frame, { topLegend = false, annotations = [] } = {}) {
  const top = (topLegend ? 52 : 28) + annotations.length * 64;
  if (frame.height - 52 - top < 100) throw new Error("Chart annotation bands leave insufficient plot height; enlarge or split the exhibit");
  return {
    x: frame.x + 54,
    y: frame.y + top,
    width: Math.max(120, frame.width - 70),
    height: Math.max(100, frame.height - 52 - top)
  };
}

function textStyle(size = token("type.label"), color = SECONDARY, bold = false, align = "center") {
  return { fontFamily: FONT, fontSize: size, color, bold, align, valign: "mid" };
}

function lineStyle(stroke = GRID, width = token("line.hairline"), dash = "solid") {
  return { stroke, lineWidth: width, dash };
}

function fillStyle(fill, stroke = fill, width = token("line.hairline"), opacity = 1) {
  return { fill, stroke, lineWidth: width, opacity };
}

function topLegend({ id, frame, items, align = "left" }) {
  if (!items.length) return [];
  return legendNodes({ id, frame: { x: frame.x + 54, y: frame.y + 7, width: frame.width - 70, height: 28 }, props: { items, placement: align === "right" ? "top-right" : "top" } });
}

function range(values) {
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  return { min, max, span: max - min || 1 };
}

function axes(id, plot, yMin, yMax, steps = 4) {
  const nodes = [];
  for (let index = 0; index <= steps; index += 1) {
    const y = plot.y + plot.height - plot.height * index / steps;
    nodes.push(linePrimitive({
      id: stableId(id, "grid", index),
      role: "chart-gridline",
      x1: plot.x,
      y1: y,
      x2: plot.x + plot.width,
      y2: y,
      style: lineStyle()
    }));
    nodes.push(textPrimitive({
      id: stableId(id, "axis-label", index),
      role: "axis-label",
      frame: { x: plot.x - 56, y: y - 10, width: 48, height: 20 },
      text: String(Math.round(yMin + (yMax - yMin) * index / steps)),
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

function decorations({ id, plot, props, pointMap = new Map(), categoryMap = new Map(), yScale = null, obstacles = [] }) {
  const underlay = [];
  const overlay = [];
  const annotationPlacements = (props.annotations || []).map((annotation, index) => {
    const target = pointMap.get(`${annotation.series || "value"}:${annotation.category}`);
    if (!target) throw new Error(`${id} annotation references an unknown data point`);
    const width = 142;
    const height = 44;
    const x = Math.max(plot.x, Math.min(plot.x + plot.width - width, target.x - width / 2));
    const gap = 20;
    const y = plot.y - (props.annotations.length - index) * (height + gap);
    return { annotation, index, target, frame: { x, y, width, height }, above: true };
  });
  const overlaps = (a, b, padding = 4) => !(
    a.x + a.width + padding <= b.x
    || b.x + b.width + padding <= a.x
    || a.y + a.height + padding <= b.y
    || b.y + b.height + padding <= a.y
  );
  for (const [index, highlight] of (props.highlights || []).entries()) {
    const target = categoryMap.get(highlight.category);
    if (!target) throw new Error(`${id} highlight references unknown category ${highlight.category}`);
    underlay.push(rectPrimitive({
      id: stableId(id, "highlight", index),
      role: "chart-highlight",
      frame: { x: target.x - 6, y: plot.y, width: target.width + 12, height: plot.height },
      style: { fill: token("color.componentPrimaryTint"), stroke: token("color.componentPrimaryTint"), lineWidth: token("line.hairline"), opacity: 0.55 }
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
        { x: plot.x + plot.width - labelWidth - 4, y: y - 24, width: labelWidth, height: 20, align: "right" },
        { x: plot.x + 8, y: y - 24, width: labelWidth, height: 20, align: "left" },
        { x: plot.x + plot.width - labelWidth - 4, y: y + 4, width: labelWidth, height: 20, align: "right" },
        { x: plot.x + 8, y: y + 4, width: labelWidth, height: 20, align: "left" }
      ];
      const labelFrame = labelCandidates.find((candidate) => annotationPlacements.every(({ frame }) => !overlaps(candidate, frame)) && obstacles.filter((node) => ["chart-mark", "data-label"].includes(node.role)).every((node) => !overlaps(candidate, node.frame)));
      if (!labelFrame) throw new Error("No collision-free reference-line label position; revise the chart composition");
      overlay.push(textPrimitive({
        id: stableId(id, "reference-label", index),
        role: "chart-reference-label",
        frame: { x: labelFrame.x, y: labelFrame.y, width: labelFrame.width, height: labelFrame.height },
        text: reference.label || String(reference.value),
        style: textStyle(token("type.source"), token("color.componentPrimary"), true, labelFrame.align)
      }));
    }
  }
  for (const { annotation, index, target, frame, above } of annotationPlacements) {
    const { x, y, width, height } = frame;
    overlay.push(linePrimitive({
      id: stableId(id, "annotation-leader", index),
      role: "annotation-leader",
      x1: Math.max(x + 4, Math.min(x + width - 4, target.leaderX ?? target.x)),
      y1: above ? y + height : y,
      x2: target.leaderX ?? target.x,
      y2: target.leaderY ?? target.y,
      style: lineStyle(token("color.componentPrimary"), token("line.hairline"))
    }));
    overlay.push(rectPrimitive({
      id: stableId(id, "annotation-box", index),
      role: "annotation-surface",
      frame: { x, y, width, height },
      style: { fill: token("color.surface"), stroke: token("color.componentPrimary"), lineWidth: token("line.hairline"), radius: token("radius.none") }
    }));
    overlay.push(textPrimitive({
      id: stableId(id, "annotation-text", index),
      role: "annotation-text",
      frame: { x: x + 8, y: y + 6, width: width - 16, height: height - 12 },
      text: annotation.text,
      style: { ...textStyle(token("type.label"), INK), ...chartAnnotationStyle() }
    }));
  }
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
  const categories = props.categories;
  const series = props.series;
  const showLegend = props.legend !== false && series.length > 1;
  const plot = chartFrame(frame, { topLegend: showLegend, annotations: props.annotations });
  const values = series.flatMap((item) => item.values);
  const totals = categories.map((_, index) => stacked ? series.reduce((sum, item) => sum + item.values[index], 0) : Math.max(...series.map((item) => item.values[index])));
  const computedBounds = range(stacked ? totals : values);
  const bounds = { min: props.yMin ?? computedBounds.min, max: props.yMax ?? computedBounds.max };
  bounds.span = bounds.max - bounds.min || 1;
  const nodes = showLegend ? topLegend({ id, frame, items: series.map((item) => item.name) }) : [];
  const pointMap = new Map();
  const categoryMap = new Map();
  const yScale = (value) => plot.y + plot.height - (value - bounds.min) / bounds.span * plot.height;

  if (!horizontal) nodes.push(...axes(id, plot, bounds.min, bounds.max));
  const categorySpan = (horizontal ? plot.height : plot.width) / categories.length;
  const groupSpan = categorySpan * 0.7;
  const barSpan = stacked ? groupSpan : groupSpan / series.length;
  const showDataLabels = props.dataLabels === true || (props.dataLabels !== false && series.length === 1);

  categories.forEach((category, categoryIndex) => {
    const categoryStart = (horizontal ? plot.y : plot.x) + categoryIndex * categorySpan + (categorySpan - groupSpan) / 2;
    categoryMap.set(category, horizontal
      ? { x: plot.x, y: categoryStart, width: plot.width, height: groupSpan }
      : { x: categoryStart, y: plot.y, width: groupSpan, height: plot.height });
    let cumulative = 0;
    series.forEach((item, seriesIndex) => {
      const value = item.values[categoryIndex];
      let bar;
      if (horizontal) {
        const width = Math.max(1, plot.width * value / bounds.max);
        bar = {
          x: plot.x + (stacked ? plot.width * cumulative / bounds.max : 0),
          y: categoryStart + (stacked ? 0 : seriesIndex * barSpan),
          width,
          height: Math.max(4, barSpan - 4)
        };
      } else {
        const height = Math.max(1, plot.height * value / bounds.max);
        bar = {
          x: categoryStart + (stacked ? 0 : seriesIndex * barSpan),
          y: plot.y + plot.height - height - (stacked ? plot.height * cumulative / bounds.max : 0),
          width: Math.max(4, barSpan - 4),
          height
        };
      }
      nodes.push(rectPrimitive({
        id: stableId(id, "series", item.name, category),
        role: "chart-mark",
        frame: bar,
        style: fillStyle(SERIES[props.colorIndices?.[seriesIndex] ?? seriesIndex % SERIES.length])
      }));
      if (showDataLabels) {
        const labelFrame = horizontal
          ? { x: stacked ? bar.x + 2 : Math.min(plot.x + plot.width - 52, bar.x + bar.width + 4), y: bar.y - 2, width: stacked ? bar.width - 4 : 50, height: bar.height + 4 }
          : stacked
            ? { x: bar.x + 2, y: bar.y + (bar.height - 20) / 2, width: bar.width - 4, height: 20 }
            : { x: bar.x - 10, y: Math.max(plot.y - 2, bar.y - 23), width: bar.width + 20, height: 22 };
        nodes.push(textPrimitive({
          id: stableId(id, "value-label", item.name, category),
          role: "data-label",
          frame: labelFrame,
          text: String(value),
          style: textStyle(token("type.source"), stacked && contrastRatio(tokens[SERIES[props.colorIndices?.[seriesIndex] ?? seriesIndex % SERIES.length].tokenId].value, tokens["color.onPrimary"].value) >= contrastRatio(tokens[SERIES[props.colorIndices?.[seriesIndex] ?? seriesIndex % SERIES.length].tokenId].value, tokens["color.ink"].value) ? token("color.onPrimary") : INK, true, horizontal && !stacked ? "left" : "center"),
          data: { category, series: item.name }
        }));
      }
      const point = horizontal
        ? { x: bar.x + bar.width, y: bar.y + bar.height / 2, leaderY: bar.y - 4 }
        : { x: bar.x + bar.width / 2, y: bar.y, leaderX: bar.x + bar.width + 6 };
      pointMap.set(`${item.name}:${category}`, point);
      if (series.length === 1) pointMap.set(`value:${category}`, point);
      if (stacked) cumulative += value;
    });
    if (stacked && !horizontal && showDataLabels) {
      const labels = nodes.filter((node) => node.role === "data-label" && node.data.category === category).sort((a, b) => a.frame.y - b.frame.y);
      const marks = nodes.filter((node) => node.role === "chart-mark" && node.id.endsWith(`:${stableId(category)}`));
      if (marks.some((mark) => mark.frame.height < 20)) {
        const startY = Math.min(labels[0].frame.y, plot.y + plot.height - labels.length * 22);
        labels.forEach((label, index) => {
          const mark = marks.find((mark) => mark.id === stableId(id, "series", label.data.series, category));
          const x = mark.frame.x + mark.frame.width + 6;
          label.frame = { x, y: startY + index * 22, width: 24, height: 20 };
          // Resolve a new inherited binding through the primitive constructor.
          Object.assign(label, textPrimitive({ id: label.id, role: label.role, frame: label.frame, text: label.text, data: label.data, style: textStyle(token("type.source"), INK, true, "left") }));
          nodes.push(linePrimitive({ id: stableId(label.id, "leader"), role: "data-label-leader", x1: mark.frame.x + mark.frame.width, y1: mark.frame.y + mark.frame.height / 2, x2: x - 2, y2: label.frame.y + 10, style: lineStyle(INK) }));
        });
      }
    }
    nodes.push(textPrimitive({
      id: stableId(id, "category", category),
      role: "category-label",
      frame: horizontal
        ? { x: plot.x - 62, y: categoryStart, width: 56, height: groupSpan }
        : { x: categoryStart - 8, y: plot.y + plot.height + 8, width: groupSpan + 16, height: 28 },
      text: category,
      style: textStyle(token("type.source"), SECONDARY, false, horizontal ? "right" : "center")
    }));
  });
  if (horizontal) {
    nodes.push(linePrimitive({ id: stableId(id, "axis"), role: "chart-axis", x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height, style: lineStyle(INK) }));
  }
  return withDecorations(nodes, { id, plot, props, pointMap, categoryMap, yScale: horizontal ? null : yScale });
}

function lineChart({ id, frame, props, area = false }) {
  const showLegend = props.legend !== false && props.series.length > 1;
  const plot = chartFrame(frame, { topLegend: showLegend, annotations: props.annotations });
  const values = props.series.flatMap((item) => item.values);
  const computedBounds = range(values);
  const bounds = { min: props.yMin ?? computedBounds.min, max: props.yMax ?? computedBounds.max };
  bounds.span = bounds.max - bounds.min || 1;
  const yScale = (value) => plot.y + plot.height - (value - bounds.min) / bounds.span * plot.height;
  const xScale = (index) => plot.x + (props.categories.length === 1 ? plot.width / 2 : plot.width * index / (props.categories.length - 1));
  const nodes = [
    ...(showLegend ? topLegend({ id, frame, items: props.series.map((item) => item.name) }) : []),
    ...axes(id, plot, bounds.min, bounds.max)
  ];
  const pointMap = new Map();
  const categoryMap = new Map();
  props.categories.forEach((category, index) => {
    const x = xScale(index);
    categoryMap.set(category, { x: x - 26, y: plot.y, width: 52, height: plot.height });
    nodes.push(textPrimitive({ id: stableId(id, "category", category), role: "category-label", frame: { x: x - 34, y: plot.y + plot.height + 8, width: 68, height: 24 }, text: category, style: textStyle(token("type.source")) }));
  });
  props.series.forEach((item, seriesIndex) => {
    const points = item.values.map((value, index) => ({ x: xScale(index), y: yScale(value), value, category: props.categories[index] }));
    if (area) {
      const segmentWidth = plot.width / Math.max(1, props.categories.length - 1);
      points.forEach((point, index) => nodes.push(rectPrimitive({
        id: stableId(id, "area", item.name, index),
        role: "chart-area",
        frame: { x: Math.max(plot.x, point.x - segmentWidth / 2), y: point.y, width: Math.min(segmentWidth, plot.x + plot.width - Math.max(plot.x, point.x - segmentWidth / 2)), height: plot.y + plot.height - point.y },
        style: { fill: token("color.componentPrimaryTint"), stroke: token("color.componentPrimaryTint"), lineWidth: token("line.hairline"), opacity: 0.7 }
      })));
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
      pointMap.set(`${item.name}:${point.category}`, point);
      if (props.series.length === 1) pointMap.set(`value:${point.category}`, point);
      if (props.dataLabels === true) nodes.push(textPrimitive({
        id: stableId(id, "value-label", item.name, point.category),
        role: "data-label",
        frame: { x: point.x - 30, y: Math.max(plot.y, point.y - 25), width: 60, height: 20 },
        text: String(point.value),
        style: textStyle(token("type.source"), INK, true, "center")
      }));
    });
  });
  for (const [index, highlight] of (props.pointHighlights || []).entries()) {
    const target = pointMap.get(`${highlight.series || props.series[0].name}:${highlight.category}`)
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
  const plot = chartFrame(frame, { annotations: props.annotations });
  const running = [];
  let total = 0;
  props.values.forEach((value, index) => {
    if (props.totals?.includes(index)) total = value;
    else total += value;
    running.push(total);
  });
  const computedBounds = range([0, ...running]);
  const bounds = { min: props.yMin ?? computedBounds.min, max: props.yMax ?? computedBounds.max };
  bounds.span = bounds.max - bounds.min || 1;
  const yScale = (value) => plot.y + plot.height - value / bounds.max * plot.height;
  const nodes = axes(id, plot, 0, bounds.max);
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
    nodes.push(textPrimitive({ id: stableId(id, "value-label", category), role: "data-label", frame: { x: bar.x - 10, y: Math.max(plot.y - 2, bar.y - 24), width: bar.width + 20, height: 22 }, text: isTotal ? String(value) : `${value >= 0 ? "+" : ""}${value}`, style: textStyle(token("type.label"), INK, true, "center") }));
    if (index > 0) nodes.push(linePrimitive({ id: stableId(id, "connector", index), role: "chart-connector", x1: plot.x + (index - 1) * span + span * 0.8, y1: yScale(previous), x2: plot.x + index * span + span * 0.2, y2: yScale(previous), style: lineStyle(SECONDARY, token("line.hairline"), "dash") }));
    const point = { x: bar.x + bar.width / 2, y: bar.y, leaderX: bar.x + bar.width + 6 };
    pointMap.set(`value:${category}`, point);
    categoryMap.set(category, { x: bar.x, y: plot.y, width: bar.width, height: plot.height });
    nodes.push(textPrimitive({ id: stableId(id, "category", category), role: "category-label", frame: { x: plot.x + index * span, y: plot.y + plot.height + 8, width: span, height: 28 }, text: category, style: textStyle(token("type.source")) }));
    previous = end;
  });
  return withDecorations(nodes, { id, plot, props, pointMap, categoryMap, yScale });
}

function comboChart({ id, frame, props }) {
  if (!Array.isArray(props.series) || props.series.length !== 2) {
    throw new Error(`${id} combo chart requires exactly two series on one declared scale`);
  }
  const plot = chartFrame(frame, { topLegend: true, annotations: props.annotations });
  const bounds = range(props.series.flatMap((item) => item.values));
  const yScale = (value) => plot.y + plot.height - (value - bounds.min) / bounds.span * plot.height;
  const categorySpan = plot.width / props.categories.length;
  const barWidth = categorySpan * 0.58;
  const nodes = [
    ...topLegend({ id, frame, items: props.series.map((item) => item.name) }),
    ...axes(id, plot, bounds.min, bounds.max)
  ];
  const pointMap = new Map();
  const categoryMap = new Map();
  const barSeries = props.series[0];
  const lineSeries = props.series[1];
  const linePoints = [];
  props.categories.forEach((category, index) => {
    const x = plot.x + categorySpan * index + categorySpan / 2;
    const barTop = yScale(barSeries.values[index]);
    const bar = {
      x: x - barWidth / 2,
      y: barTop,
      width: barWidth,
      height: Math.max(1, plot.y + plot.height - barTop)
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
    const barPoint = { x, y: barTop };
    const linePoint = { x, y: yScale(lineSeries.values[index]) };
    categoryMap.set(category, { x: x - categorySpan / 2, y: plot.y, width: categorySpan, height: plot.height });
    pointMap.set(`${barSeries.name}:${category}`, barPoint);
    pointMap.set(`${lineSeries.name}:${category}`, linePoint);
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

function scatter({ id, frame, props, bubble = false }) {
  const plot = chartFrame(frame, { annotations: props.annotations });
  const computedXBounds = range(props.points.map((point) => point.x));
  const computedYBounds = range(props.points.map((point) => point.y));
  const xBounds = { min: props.xMin ?? computedXBounds.min, max: props.xMax ?? computedXBounds.max };
  const yBounds = { min: props.yMin ?? computedYBounds.min, max: props.yMax ?? computedYBounds.max };
  xBounds.span = xBounds.max - xBounds.min || 1;
  yBounds.span = yBounds.max - yBounds.min || 1;
  const xScale = (value) => plot.x + (value - xBounds.min) / xBounds.span * plot.width;
  const yScale = (value) => plot.y + plot.height - (value - yBounds.min) / yBounds.span * plot.height;
  const nodes = axes(id, plot, yBounds.min, yBounds.max);
  const pointMap = new Map();
  const categoryMap = new Map();
  props.points.forEach((point, index) => {
    const size = bubble ? 12 + Math.sqrt(point.size || 1) * 4 : 12;
    const x = xScale(point.x);
    const y = yScale(point.y);
    nodes.push(ellipsePrimitive({ id: stableId(id, "point", point.name), role: "chart-marker", frame: { x: x - size / 2, y: y - size / 2, width: size, height: size }, style: fillStyle(SERIES[index % SERIES.length]) }));
    nodes.push(textPrimitive({ id: stableId(id, "label", point.name), role: "data-label", frame: { x: x + size / 2 + 4, y: y - 10, width: 96, height: 20 }, text: point.name, style: textStyle(token("type.source"), INK, false, "left") }));
    pointMap.set(`value:${point.name}`, { x, y });
    pointMap.set(`${point.series || "value"}:${point.name}`, { x, y });
    categoryMap.set(point.name, { x: x - size, y: y - size, width: size * 2, height: size * 2 });
  });
  const placed = [];
  const marks = nodes.filter((node) => node.role === "chart-marker");
  const intersects = (a, b) => a.x < b.x + b.width + 3 && a.x + a.width + 3 > b.x && a.y < b.y + b.height + 3 && a.y + a.height + 3 > b.y;
  for (const label of nodes.filter((node) => node.role === "data-label")) {
    const point = pointMap.get(`value:${label.text}`);
    const mark = marks.find((node) => node.id === stableId(id, "point", label.text));
    const measured = measureText(label.text, label.frame.width, { fontSize: tokenValue(token("type.source")) });
    const width = Math.ceil(measured.width) + 2, height = 20;
    const candidates = [
      { x: mark.frame.x + mark.frame.width + 4, y: point.y - 10, width, height },
      { x: mark.frame.x - width - 4, y: point.y - 10, width, height },
      { x: point.x - width / 2, y: mark.frame.y - height - 4, width, height },
      { x: point.x - width / 2, y: mark.frame.y + mark.frame.height + 4, width, height }
    ];
    const candidate = candidates.find((candidate) => candidate.x >= frame.x && candidate.x + width <= frame.x + frame.width && candidate.y >= frame.y && candidate.y + height <= frame.y + frame.height && [...placed, ...marks.map((node) => node.frame)].every((other) => !intersects(candidate, other)));
    if (!candidate) throw new Error(`No collision-free position for scatter label ${label.text}; enlarge the exhibit or reduce labelled points`);
    label.frame = candidate;
    placed.push(candidate);
  }
  return withDecorations(nodes, { id, plot, props, pointMap, categoryMap });
}

export const PART_TO_WHOLE_VARIANTS = Object.freeze({ "legend-top-right": {}, "outside-labels": { props: { labels: ["Category 1", "Category 2", "Category 3", "Category 4"], values: [25, 25, 25, 25] } }, "shared-legend": {} });
export function resolvePartToWholeVariant(props = {}) {
  const variant = props.variant ?? (props.outsideLabels ? "outside-labels" : props.legend === false ? "shared-legend" : "legend-top-right");
  if (!Object.hasOwn(PART_TO_WHOLE_VARIANTS, variant)) throw new Error(`Unknown pie/donut variant: ${variant}`);
  if (props.legend === true && variant !== "legend-top-right" || props.legend === false && variant === "legend-top-right" || props.outsideLabels === true && variant !== "outside-labels") throw new Error("Pie/donut variant conflicts with legend or outsideLabels");
  return variant;
}

function partToWhole({ id, frame, props, donut = false, tokens = TOKENS }) {
  const variant = resolvePartToWholeVariant(props);
  const showLegend = variant === "legend-top-right";
  const legendHeight = showLegend ? 48 : 0;
  if (!Array.isArray(props.labels) || !Array.isArray(props.values) || props.values.length < 2 || props.values.length > 5 || props.labels.length !== props.values.length || props.labels.some(label => typeof label !== "string" || !label.trim()) || new Set(props.labels).size !== props.labels.length || props.values.some(v => !Number.isFinite(v) || v < 0) || props.values.filter(v => v > 0).length < 2) throw new Error("Pie/donut needs two to five unique categories and at least two positive finite values");
  const availableHeight = frame.height - legendHeight;
  const outside = variant === "outside-labels";
  const labelWidth = outside ? Math.max(...props.labels.map(label => measureText(label, frame.width, { fontSize: tokenValue(token("type.compact")), fontFamily: tokenValue(token("font.bodySemibold")), bold: tokenDefinition("font.bodySemibold").nativeBold, wrapWidthRatio: 1 }).width)) : 0;
  const gutter = outside ? labelWidth + 24 : 16;
  const size = Math.min(frame.width - 2 * gutter, availableHeight - 32);
  if (size < 100) throw new Error("Pie/donut and labels do not fit; enlarge the section or use a legend");
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
    const measured = measureText(text, 64, { fontSize: tokenValue(token("type.heading")), bold: true, wrapWidthRatio: 1 });
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
    nodes.push(textPrimitive({ id: stableId(id, "percentage", index), role: "data-label", frame: { x: insideX - 32, y: insideY - 14, width: 64, height: 28 }, text, style: textStyle(token("type.heading"), foreground, true, "center"), data: { categoryKey: props.labels[index], contrast: contrastRatio(background, tokens[foreground.tokenId].value) } }));
  });
  if (outside) {
    props.values.forEach((value, index) => {
      if (!value) return;
      const right = Math.cos(labelAngles[index]) >= 0;
      const outsideY = cy + Math.sin(labelAngles[index]) * size * 0.48;
      nodes.push(textPrimitive({ id: stableId(id, "outside-label", index), role: "category-label", frame: { x: right ? circle.x + size + 16 : circle.x - labelWidth - 16, y: outsideY - 14, width: labelWidth, height: 28 }, text: props.labels[index], style: { ...textStyle(token("type.compact"), INK, false, right ? "left" : "right"), ...chartAnnotationStyle(), wrap: false }, data: { directAnnotation: true, textLayout: { lines: [props.labels[index]] } } }));
    });
  }
  return nodes;
}

const chartDefinitions = [
  {
    id: "chart.column", render: (context) => categoricalChart(context),
    sample: { categories: ["2023", "2024", "2025", "2026"], series: [{ name: "value", values: [32, 46, 61, 74] }], highlights: [{ category: "2026" }], annotations: [{ category: "2026", text: "+13 vs 2025" }], referenceLines: [{ value: 60, label: "Target" }] }
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
  }
];

export function registerCharts(registry) {
  for (const chart of chartDefinitions) {
    const tokens = [
      "font.body", "type.heading", "type.body", "type.compact", "type.label", "type.source", "color.ink", "color.textSecondary",
      "font.bodySemibold", "weight.semibold",
      "color.chartGrid", "color.componentPrimary", "color.componentPrimaryTint",
      "color.canvas", "color.surface", "color.onPrimary", "color.negative", "line.hairline", "line.standard", "radius.none",
      ...SERIES.map((item) => item.tokenId), ...LEGEND_TOKENS
    ];
    registry.set(chart.id, {
      id: chart.id,
      version: "2.0.0",
      category: "chart",
      role: "chart",
      tokens: [...new Set([...tokens, ...registry.get("chart-title").tokens])].sort(),
      preferredSize: { width: 760, height: 420 },
      sample: chart.sample,
      ...(["chart.pie", "chart.donut"].includes(chart.id) ? { variants: PART_TO_WHOLE_VARIANTS, defaultVariant: "legend-top-right", variantProp: "variant", resolveVariant: resolvePartToWholeVariant } : {}),
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
