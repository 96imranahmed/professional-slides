// The specialty charts drawn as shapes on their own layouts: the waterfall
// bridge, waffle, bubble grid, marimekko and range (low-high) charts. The
// waffle, bubble grid and marimekko measure their height from the same layout
// they draw (`*Layout`), which their registry entries answer measureContent from.
import { linePrimitive, rectPrimitive, stableId, textPrimitive, token, tokenValue, ellipsePrimitive, TOKENS, onFill } from "./core.mjs";
import { formatValue } from "./value-format.mjs";
import { measureText, ENGINE_RESERVE } from "./text-layout.mjs";
import { FONT, INK, SECONDARY, PRIMARY, CHART_LABEL, AXIS_LABEL, LABEL_BAND, chartFrame, labelBold, textStyle, lineStyle, fillStyle,
  assertGridlineOption, resolveValueAxis, numericBounds, axes, tableSpan, GRID, legendRowsFor, SERIES, topLegend } from "./chart-axes.mjs";
import { withReferenceValues, withDecorations, normalizedHighlights } from "./chart-decorations.mjs";

// A bridge's steps narrower than this share of their top are drawn on a broken scale (see `broken` below).
const WATERFALL_BREAK_SHARE = 1 / 7;

export function waterfall({ id, frame, props }) {
  assertGridlineOption(props);
  if (!Array.isArray(props.categories) || !props.categories.length || props.categories.some(category => typeof category !== "string" || !category.trim()) || new Set(props.categories).size !== props.categories.length) throw new Error("Waterfall charts require unique non-empty categories");
  if (!Array.isArray(props.values) || props.values.length !== props.categories.length || props.values.some(value => !Number.isFinite(value))) throw new Error("Waterfall values must contain one finite value per category");
  if (props.totals !== undefined && (!Array.isArray(props.totals) || props.totals.some(index => !Number.isInteger(index) || index < 0 || index >= props.categories.length) || new Set(props.totals).size !== props.totals.length)) throw new Error("Waterfall totals must contain unique valid category indices");
  const showValueAxis = resolveValueAxis(props, { valueCount: props.values.length, dataLabelsVisible: true });
  const running = [];
  let total = 0;
  props.values.forEach((value, index) => {
    if (props.totals?.includes(index)) total = value;
    else total += value;
    running.push(total);
  });
  // A bridge whose steps are a sliver of its totals - a population of 1.66m moved by four steps of a few thousand - drawn
  // from zero is two tall bars and four hairlines: the steps it exists to show cannot be seen. It is drawn as strong decks
  // draw it: the totals cut by a break mark near their foot and the scale opened on the band the steps move through, so
  // the steps take the upper half of the plot. Only on a chart with no value axis to misread, where every level is
  // positive and no bound is set, and only where the steps' band is under a seventh of its top.
  const steps = props.values.map((value, index) => (props.totals?.includes(index) ? null : [running[index] - value, running[index]])).filter(Boolean);
  const stepLow = steps.length ? Math.min(...steps.flat()) : 0, stepHigh = steps.length ? Math.max(...steps.flat()) : 0;
  const broken = !showValueAxis && props.yMin === undefined && props.yMax === undefined && steps.length > 0 && stepLow > 0 && running.every((level) => level > 0)
    && stepHigh - stepLow < WATERFALL_BREAK_SHARE * stepHigh ? Math.max(0, stepLow - (stepHigh - stepLow)) : null;
  const bounds = numericBounds(withReferenceValues(broken === null ? [0, ...running] : [broken, ...running], props), { min: broken ?? props.yMin, max: props.yMax, axis: "y", includeZero: broken === null, tight: !showValueAxis && props.gridlines !== true });
  // A label row below negative endpoints, above the category labels. It is
  // laid out with the frame (its bottom inset), so the frame's own fallbacks -
  // compact callout bands, callouts moved beside their marks - see it too. It
  // is reserved only when a falling step's label - set under the step's end -
  // would reach past the baseline; a bridge whose falls all end well above
  // zero would otherwise carry a 30px stripe of air between its bars and their
  // names.
  // The category labels are measured against the slot they have and wrap into
  // it. Set unmeasured at the slot's width, a label longer than its slot prints
  // straight over its neighbours, and the band below the plot has to be as
  // tall as the labels that go in it.
  const labelsAt = (width) => props.categories.map((category) => measureText(String(category), width / props.categories.length - 10, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL) }));
  const frameFor = (row) => chartFrame(frame, { topInset: props.plotTopInset, annotations: props.annotations, changeAnnotations: props.changeAnnotations,
    annotationRail: props.annotationRail, centerPlot: !showValueAxis, bottomInset: LABEL_BAND + row,
    labels: { gap: 8 + row, height: (width) => Math.max(...labelsAt(width).map((layout) => layout.height)) } });
  let plot = frameFor(0), labelRow = 0;
  const categorySpan = plot.width / props.categories.length;
  const categoryLayouts = labelsAt(plot.width);
  const NEGATIVE_LABEL = 27;
  if (props.values.some((value, index) => value < 0 && (running[index] - bounds.min) / bounds.span * plot.height < NEGATIVE_LABEL)) { labelRow = 30; plot = frameFor(labelRow); }
  if (plot.height < 100) throw new Error("Waterfall category labels leave no room for the plot; shorten them or use fewer steps");
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
    const start = isTotal ? (broken ?? 0) : previous;
    const end = isTotal ? value : previous + value;
    const top = Math.max(start, end);
    const bottom = Math.min(start, end);
    const bar = { x: plot.x + index * span + span * 0.2, y: yScale(top), width: span * 0.6, height: Math.max(2, yScale(bottom) - yScale(top)) };
    const fill = isTotal ? PRIMARY : value >= 0 ? token("color.chartSeries2") : token("color.chartSeries3");
    nodes.push(rectPrimitive({ id: stableId(id, "bar", category), role: "chart-mark", frame: bar, style: fillStyle(fill), ...(isTotal && broken !== null ? { data: { axisBreak: broken } } : {}) }));
    // The break: two strokes of the page across the bar's foot, so the cut is read as a cut and not as a short bar.
    if (isTotal && broken !== null) for (const [at, dy] of [[0, 0], [1, 7]]) {
      const y = bar.y + bar.height - 26 - dy;
      nodes.push(linePrimitive({ id: stableId(id, "axis-break", category, at), role: "chart-axis-break", x1: bar.x - 4, y1: y + 5, x2: bar.x + bar.width + 4, y2: y - 5, style: lineStyle(token("color.surface"), token("line.medium")) }));
    }
    nodes.push(textPrimitive({ id: stableId(id, "value-label", category), role: "data-label", frame: { x: bar.x - 10, y: value < 0 ? yScale(end) + 3 : yScale(end) - 26, width: bar.width + 20, height: 24 }, text: isTotal ? formatValue(value, props) : `${value >= 0 ? "+" : ""}${formatValue(value, props)}`, style: textStyle(CHART_LABEL, INK, labelBold(), "center") }));
    if (index > 0) nodes.push(linePrimitive({ id: stableId(id, "connector", index), role: "chart-connector", x1: plot.x + (index - 1) * span + span * 0.8, y1: yScale(previous), x2: plot.x + index * span + span * 0.2, y2: yScale(previous), style: lineStyle(SECONDARY, token("line.hairline"), "dash") }));
    const point = { x: bar.x + bar.width / 2, y: bar.y, changeX: bar.x + bar.width / 2, changeY: bar.y - 38 };
    pointMap.set(`value:${category}`, point);
    pointMap.set(`category:${category}`, point);
    categoryMap.set(category, { x: bar.x, y: plot.y, width: bar.width, height: plot.height });
    const layout = categoryLayouts[index];
    nodes.push(textPrimitive({ id: stableId(id, "category", category), role: "category-label", frame: { x: plot.x + index * span + 5, y: plot.y + plot.height + 8 + labelRow, width: span - 10, height: layout.height }, text: layout.text, style: { ...textStyle(AXIS_LABEL, INK, false, "center"), valign: "top", lineHeight: layout.lineHeight, wrap: false }, data: { textLayout: layout } }));
    previous = end;
  });
  return withDecorations(nodes, { id, plot, props, pointMap, categoryMap, yScale });
}

/**
 * Floating range bars: one horizontal bar per category from `low` to `high`
 * with both values labelled at the ends (pay bands, ranges, min–max).
 * props: categories, low[], high[], unit?, highlights? ({category, style:"bar"}).
 */
/**
 * Unit chart (the survey-deck dot pictogram): one dot per respondent, grouped
 * by category, the count above each block and the category below. `percent:
 * true` draws a 10x10 block per category with `value` dots filled. Single series.
 */
/**
 * The category a chart was told to pick out, for the plot types that draw their
 * own marks (a waffle, a bubble grid, a marimekko): one member of `members`, or
 * null.
 *
 * A recoloured category is the commonest mark in a strong deck and the only
 * one that costs a plot no layout, so it is the one these types get.
 */
function highlightedCategory(props, members, id) {
  const highlights = props.highlights || [];
  // One member recoloured: a second would be dropped unseen, and a name the
  // chart does not draw would light nothing.
  if (highlights.length > 1) throw new Error(`${id}: this chart picks out one member in the accent; highlights names ${highlights.length} - keep the one the page is about and say the rest in the commentary`);
  const first = highlights[0];
  if (first === undefined || first === null) return null;
  const name = typeof first === "string" ? first : first.category;
  if (name === undefined || name === null) return null;
  if (!members.map(String).includes(String(name))) throw new Error(`${id}: highlights names "${name}", which this chart does not draw; name one of ${members.slice(0, 8).map((m) => `"${m}"`).join(", ")}`);
  return String(name);
}

// A unit dot grows to about three lines of label type; past that it stops
// reading as one of many and starts reading as a bubble with a size to read.
const WAFFLE_DOT_MAX = 48;

export function waffleLayout(frameIn, props) {
  // A hug measurement passes no height: size the dots from the width alone.
  const frame = Number.isFinite(frameIn.height) ? frameIn : { ...frameIn, height: 400 };
  const categories = props.categories || [];
  const series = Array.isArray(props.series) ? props.series : [];
  if (!categories.length || series.length !== 1 || !Array.isArray(series[0].values) || series[0].values.length !== categories.length) throw new Error("Unit chart requires categories and one series with a count per category");
  const values = series[0].values.map((v) => Number(v));
  if (values.some((v) => !(Number.isInteger(v) && v >= 0))) throw new Error("Unit chart counts are non-negative integers");
  const percent = props.percent === true;
  if (percent && values.some((v) => v > 100)) throw new Error("Unit chart percent values run 0–100");
  const plot = chartFrame(frame, { topInset: props.plotTopInset, leftInset: 0, valueLabelInset: 0, centerPlot: false, span: tableSpan(props, frame, categories.length) });
  const slot = plot.width / categories.length;
  const gapRatio = 0.45;
  const categoryLayouts = categories.map((c) => measureText(String(c), slot - 12, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL), wrapWidthRatio: ENGINE_RESERVE }));
  const labelBand = 30, categoryBand = Math.max(...categoryLayouts.map((l) => l.height)) + 16;
  const most = Math.max(1, ...values);
  const shape = (columns) => {
    const rows = Math.max(1, ...values.map((v) => Math.ceil(v / columns)));
    const cell = Math.max(4, Math.min(WAFFLE_DOT_MAX, (slot - 24) / (columns + (columns - 1) * gapRatio), (plot.height - labelBand - categoryBand) / (rows + (rows - 1) * gapRatio)));
    return { columns, rows, cell };
  };
  // The block takes the shape that gives its dots the most room in the plot,
  // up to WAFFLE_DOT_MAX; among shapes that reach it, the widest. Four columns
  // or more fixed from the count alone would draw fourteen dots in four groups
  // as rows of two 21px dots across a 400px plot - a strip centred in air,
  // where two columns of four give dots twice the size.
  let best = null;
  if (!percent) for (let columns = Math.min(10, most); columns >= 1; columns -= 1) {
    const next = shape(columns);
    if (!best || next.cell > best.cell + 0.5) best = next;
  }
  const { columns, rows, cell } = best ?? shape(10);
  const pitch = cell * (1 + gapRatio);
  const blockWidth = columns * cell + (columns - 1) * cell * gapRatio, blockHeight = rows * cell + (rows - 1) * cell * gapRatio;
  return { categories, values, percent, plot, slot, columns, rows, categoryLayouts, labelBand, categoryBand, cell, pitch, blockWidth, blockHeight, height: (plot.y - frame.y) + labelBand + blockHeight + categoryBand + 8 };
}
export function waffleChart({ id, frame, props }) {
  const { categories, values, percent, plot, slot, columns, categoryLayouts, labelBand, categoryBand, cell, pitch, blockWidth, blockHeight } = waffleLayout(frame, props);
  const nodes = [];
  const fill = props.color ? token(props.color) : PRIMARY, empty = GRID;
  const picked = highlightedCategory(props, categories, id);
  categories.forEach((category, index) => {
    const lit = picked !== null && String(category) === picked;
    const dotFill = lit ? token("color.accent") : fill;
    const x0 = plot.x + index * slot + (slot - blockWidth) / 2;
    // Under the heading, not centred in the plot: what the dots leave is one
    // band at the foot, which a column gives to the block under it
    // (measureCeiling), rather than a band above the counts and another below.
    const y0 = plot.y + labelBand;
    const count = values[index];
    const total = percent ? 100 : count;
    for (let i = 0; i < total; i += 1) {
      const r = Math.floor(i / columns), c = i % columns;
      // Percent blocks fill from the bottom-left, row by row, as a tally.
      const y = percent ? y0 + blockHeight - cell - r * pitch : y0 + r * pitch;
      const on = !percent || i < count;
      nodes.push(ellipsePrimitive({ id: stableId(id, "dot", category, i), role: on ? "chart-mark" : "chart-unit-empty", frame: { x: x0 + c * pitch, y, width: cell, height: cell }, style: fillStyle(on ? dotFill : empty), data: { category, index: i, on, ...(lit && on ? { highlighted: true, highlightStyle: "bar" } : {}) } }));
    }
    // `dataLabels: false`: the counts are printed elsewhere (a data table under the block).
    if (props.dataLabels !== false) nodes.push(textPrimitive({ id: stableId(id, "value", category), role: "data-label", frame: { x: plot.x + index * slot, y: y0 - labelBand + 2, width: slot, height: 24 }, text: percent ? `${count}%` : formatValue(count, props), style: textStyle(CHART_LABEL, INK, labelBold(), "center") }));
    const layout = categoryLayouts[index];
    nodes.push(textPrimitive({ id: stableId(id, "category", category), role: "category-label", frame: { x: plot.x + index * slot + 6, y: y0 + blockHeight + 12, width: slot - 12, height: layout.height }, text: layout.text, style: { ...textStyle(AXIS_LABEL, SECONDARY, false, "center"), valign: "top", lineHeight: layout.lineHeight, wrap: false }, data: { textLayout: layout } }));
  });
  return nodes;
}

/**
 * Bubble grid (the survey deck's matrix of counts): `rows` by `columns`, one
 * bubble per cell sized by its value with the value printed inside, row labels
 * at the left and column labels along the foot. Zero cells print a small "0".
 */
export function bubbleGridLayout(frameIn, props) {
  const frame = Number.isFinite(frameIn.height) ? frameIn : { ...frameIn, height: 400 };
  const rows = props.rows || [], columns = props.columns || [], values = props.values || [];
  if (!rows.length || !columns.length || values.length !== rows.length || values.some((r) => !Array.isArray(r) || r.length !== columns.length)) throw new Error("Bubble grid requires rows, columns and a values matrix of that shape");
  const flat = values.flat();
  if (flat.some((v) => !(Number.isFinite(v) && v >= 0))) throw new Error("Bubble grid values are non-negative numbers");
  const labelWidth = Math.min(200, Math.max(80, ...rows.map((r) => Math.ceil(measureText(String(r), 200, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL) }).width) + 16)));
  const plot = chartFrame(frame, { topInset: props.plotTopInset, leftInset: labelWidth, valueLabelInset: 0, centerPlot: false });
  const columnLabelWidth = Math.max(plot.width / columns.length - 12, 72);
  const columnLayouts = columns.map((c) => measureText(String(c), columnLabelWidth, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL), wrapWidthRatio: ENGINE_RESERVE }));
  const footBand = Math.max(...columnLayouts.map((l) => l.height)) + 16;
  const cellW = plot.width / columns.length, cellH = (plot.height - footBand) / rows.length;
  const max = Math.max(1, ...flat);
  const maxDiameter = Math.min(cellW, cellH) * 0.86;
  return { rows, columns, values, plot, labelWidth, columnLayouts, columnLabelWidth, footBand, cellW, cellH, max, maxDiameter, height: (plot.y - frame.y) + rows.length * Math.max(40, Math.min(cellH, 90)) + footBand };
}
export function bubbleGrid({ id, frame, props, tokens = TOKENS }) {
  const L = bubbleGridLayout(frame, props);
  const nodes = [];
  const fill = PRIMARY;
  const picked = highlightedCategory(props, L.rows, id);
  // Values inside the bubbles read in white on a dark fill, ink on a light one.
  const insideColor = onFill(fill);
  L.rows.forEach((row, r) => {
    const cy = L.plot.y + r * L.cellH + L.cellH / 2;
    nodes.push(textPrimitive({ id: stableId(id, "row", row), role: "category-label", frame: { x: L.plot.x - L.labelWidth, y: cy - 20, width: L.labelWidth - 12, height: 40 }, text: String(row), style: textStyle(AXIS_LABEL, INK, true, "right") }));
    if (r) nodes.push(linePrimitive({ id: stableId(id, "row-rule", r), role: "chart-gridline", x1: L.plot.x - L.labelWidth, y1: L.plot.y + r * L.cellH, x2: L.plot.x + L.plot.width, y2: L.plot.y + r * L.cellH, style: lineStyle(GRID, token("line.hairline")) }));
    L.columns.forEach((column, c) => {
      const value = L.values[r][c];
      const cx = L.plot.x + c * L.cellW + L.cellW / 2;
      const d = value > 0 ? Math.max(14, L.maxDiameter * Math.sqrt(value / L.max)) : 0;
      const lit = picked !== null && String(row) === picked;
      if (d) nodes.push(ellipsePrimitive({ id: stableId(id, "bubble", row, column), role: "chart-mark", frame: { x: cx - d / 2, y: cy - d / 2, width: d, height: d }, style: fillStyle(lit ? token("color.accent") : fill), data: { row, column, value, ...(lit ? { highlighted: true, highlightStyle: "bar" } : {}) } }));
      const inside = d >= 24;
      nodes.push(textPrimitive({ id: stableId(id, "value", row, column), role: "data-label", frame: inside || !d ? { x: cx - Math.max(d, 48) / 2, y: cy - 10, width: Math.max(d, 48), height: 20 } : { x: cx - 24, y: cy - d / 2 - 22, width: 48, height: 20 }, text: formatValue(value, props), style: textStyle(CHART_LABEL, inside ? insideColor : INK, labelBold(), "center") }));
    });
  });
  L.columns.forEach((column, c) => {
    const layout = L.columnLayouts[c];
    nodes.push(textPrimitive({ id: stableId(id, "column", column), role: "category-label", frame: { x: L.plot.x + c * L.cellW + L.cellW / 2 - L.columnLabelWidth / 2, y: L.plot.y + L.plot.height - L.footBand + 12, width: L.columnLabelWidth, height: layout.height }, text: layout.text, style: { ...textStyle(AXIS_LABEL, INK, true, "center"), valign: "top", lineHeight: layout.lineHeight, wrap: false }, data: { textLayout: layout } }));
  });
  return nodes;
}

/**
 * Marimekko: columns as wide as their totals (or `widths`), each a 100% stack
 * of its series, the column total above and the category below; segment
 * values print inside where they fit. Drawn, never native.
 */
export function marimekkoLayout(frameIn, props) {
  const frame = Number.isFinite(frameIn.height) ? frameIn : { ...frameIn, height: 400 };
  const categories = props.categories || [], series = Array.isArray(props.series) ? props.series : [];
  if (!categories.length || !series.length || series.some((sr) => !Array.isArray(sr.values) || sr.values.length !== categories.length || sr.values.some((v) => !(Number.isFinite(v) && v >= 0)))) throw new Error("Marimekko requires categories and series of non-negative values, one per category");
  const totals = categories.map((_, i) => series.reduce((sum, sr) => sum + sr.values[i], 0));
  const widths = Array.isArray(props.widths) ? props.widths : totals;
  if (widths.length !== categories.length || widths.some((w) => !(Number.isFinite(w) && w > 0))) throw new Error("Marimekko widths must be positive, one per category; give every category a positive total");
  const showLegend = props.legend !== false && series.length > 1;
  // Callouts take their bands above the column totals, as on any chart.
  const plot = chartFrame(frame, { topInset: props.plotTopInset, topLegend: showLegend ? legendRowsFor(series.map((sr) => sr.name), frame) : false, leftInset: 8, valueLabelInset: 8, totalLabelInset: 26, centerPlot: false, annotations: props.annotations });
  const categoryLayouts = categories.map((c, i) => measureText(String(c), Math.max(72, plot.width * widths[i] / widths.reduce((a, b) => a + b, 0) - 6), { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL), wrapWidthRatio: ENGINE_RESERVE }));
  const footBand = Math.max(...categoryLayouts.map((l) => l.height)) + 12;
  return { categories, series, totals, widths, plot, showLegend, categoryLayouts, footBand, height: (plot.y - frame.y) + plot.height + footBand };
}
export function marimekko({ id, frame, props, tokens = TOKENS }) {
  const L = marimekkoLayout(frame, props);
  const { categories, series, totals, widths, plot } = L;
  const gap = 4, sumW = widths.reduce((a, b) => a + b, 0);
  const usable = plot.width - gap * (categories.length - 1);
  const bodyH = plot.height - L.footBand;
  const nodes = [...(L.showLegend ? topLegend({ id, frame, items: series.map((sr, i) => ({ label: sr.name, colorIndex: props.colorIndices?.[i] ?? i })) }) : [])];
  const picked = highlightedCategory(props, categories, id);
  // A callout names a column and, for one segment, its series: it points at
  // that segment's middle, or without a series at the column's top.
  const pointMap = new Map();
  let x = plot.x;
  categories.forEach((category, ci) => {
    const w = usable * widths[ci] / sumW;
    const total = totals[ci] || 1;
    let y = plot.y;
    series.forEach((sr, si) => {
      const v = sr.values[ci];
      const h = bodyH * v / total;
      if (h <= 0) return;
      const colorIndex = props.colorIndices?.[si] ?? si % SERIES.length;
      const lit = picked !== null && String(category) === picked;
      pointMap.set(`${sr.name}:${category}`, { x: x + w / 2, y: y + h / 2 });
      nodes.push(rectPrimitive({ id: stableId(id, "segment", category, sr.name), role: "chart-mark", frame: { x, y, width: w, height: h }, style: fillStyle(SERIES[colorIndex], lit ? token("color.accent") : token("color.surface")), data: { category, series: sr.name, value: v, share: v / total, colorIndex, ...(lit ? { highlighted: true, highlightStyle: "column" } : {}) } }));
      const text = props.percentLabels === false ? formatValue(v, props) : `${Math.round(100 * v / total)}%`;
      const label = measureText(text, Math.max(20, w - 6), { fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL), bold: labelBold() });
      if (h >= label.height + 4 && w >= label.width + 6) {
        nodes.push(textPrimitive({ id: stableId(id, "segment-label", category, sr.name), role: "data-label", frame: { x: x + 2, y: y + (h - label.height) / 2, width: w - 4, height: label.height }, text, style: textStyle(CHART_LABEL, onFill(SERIES[colorIndex]), labelBold(), "center"), data: { category, series: sr.name } }));
      }
      y += h;
    });
    pointMap.set(`value:${category}`, { x: x + w / 2, y: plot.y });
    // Column total above, category (and its width when widths are given) below.
    nodes.push(textPrimitive({ id: stableId(id, "total", category), role: "data-label", frame: { x: x - 10, y: plot.y - 24, width: w + 20, height: 20 }, text: formatValue(Array.isArray(props.widths) ? widths[ci] : totals[ci], props), style: textStyle(CHART_LABEL, INK, true, "center"), data: { category, total: true } }));
    const layout = L.categoryLayouts[ci];
    const lw = Math.max(72, w - 6);
    nodes.push(textPrimitive({ id: stableId(id, "category", category), role: "category-label", frame: { x: x + w / 2 - lw / 2, y: plot.y + bodyH + 8, width: lw, height: layout.height }, text: layout.text, style: { ...textStyle(AXIS_LABEL, SECONDARY, false, "center"), valign: "top", lineHeight: layout.lineHeight, wrap: false }, data: { category, textLayout: layout } }));
    x += w + gap;
  });
  nodes.push(linePrimitive({ id: stableId(id, "baseline"), role: "chart-axis", x1: plot.x, y1: plot.y + bodyH, x2: plot.x + plot.width, y2: plot.y + bodyH, style: lineStyle(INK, token("line.hairline")) }));
  // The picked column is recoloured above, so highlights are not drawn twice.
  return withDecorations(nodes, { id, plot, props: { ...props, highlights: [] }, pointMap, allowAnnotationRail: false });
}

export function rangeChart({ id, frame, props }) {
  assertGridlineOption(props);
  const categories = props.categories || [];
  if (!categories.length || !Array.isArray(props.low) || !Array.isArray(props.high) || props.low.length !== categories.length || props.high.length !== categories.length) throw new Error("Range chart requires categories with one low and one high value each");
  categories.forEach((c, i) => { if (!(Number.isFinite(props.low[i]) && Number.isFinite(props.high[i]) && props.high[i] >= props.low[i])) throw new Error(`Range chart ${c}: high must be a finite value at or above low`); });
  const highlights = normalizedHighlights(props, { categories, series: [{ name: "range" }], allowBar: true });
  const barHighlight = highlights.find((h) => h.style === "bar");
  const labelWidth = Math.max(56, ...[...props.low, ...props.high].map((value) => Math.ceil(measureText(formatValue(value, props), 300, { fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL), bold: true }).width) + 12));
  const categoryWidth = Math.max(90, ...categories.map((c) => Math.ceil(measureText(c, 260, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL) }).width) + 12));
  const plot = chartFrame(frame, { topInset: props.plotTopInset, leftInset: categoryWidth + labelWidth, valueLabelInset: labelWidth, centerPlot: false });
  const bounds = numericBounds(withReferenceValues([...props.low, ...props.high], props), { min: props.xMin, max: props.xMax, axis: "x", includeZero: props.includeZero === true });
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
    nodes.push(textPrimitive({ id: stableId(id, "low-label", category), role: "data-label", frame: { x: x0 - labelWidth - 4, y: y - 2, width: labelWidth, height: barHeight + 4 }, text: formatValue(low, props), style: textStyle(CHART_LABEL, INK, labelBold(), "right"), data: { category, end: "low" } }));
    nodes.push(textPrimitive({ id: stableId(id, "high-label", category), role: "data-label", frame: { x: x1 + 4, y: y - 2, width: labelWidth, height: barHeight + 4 }, text: formatValue(high, props), style: textStyle(CHART_LABEL, INK, labelBold(), "left"), data: { category, end: "high" } }));
    nodes.push(textPrimitive({ id: stableId(id, "category", category), role: "category-label", frame: { x: frame.x, y: y - 2, width: categoryWidth, height: barHeight + 4 }, text: category, style: textStyle(AXIS_LABEL, INK, false, "left"), data: { category } }));
    if (index) nodes.push(linePrimitive({ id: stableId(id, "row-rule", index), role: "chart-gridline", x1: frame.x, y1: plot.y + index * rowSpan, x2: plot.x + plot.width + labelWidth, y2: plot.y + index * rowSpan, style: lineStyle() }));
    const point = { x: x1, y: y + barHeight / 2, changeX: x1 + 12, changeY: y + barHeight / 2 };
    pointMap.set(`value:${category}`, point); pointMap.set(`range:${category}`, point);
    categoryMap.set(category, { x: plot.x, y: plot.y + index * rowSpan, width: plot.width, height: rowSpan });
  });
  return withDecorations(nodes, { id, plot, props, pointMap, categoryMap, xScale, allowAnnotationRail: false, allowBarHighlight: true });
}
