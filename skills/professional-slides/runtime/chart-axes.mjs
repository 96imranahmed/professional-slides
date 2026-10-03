// The ground every chart stands on: the chart type and colour tokens, the plot
// frame and the bands it reserves (legend, headroom, category labels), the
// value scale (bounds and nice ticks) and the axes drawn from it.
//
// Invariant: nothing here imports a chart module. Every chart module
// (chart-*.mjs, charts-extra.mjs) imports from here and charts.mjs registers
// them all, so the chart modules form no import cycle - each one imports on
// its own (evals/scripts/check_source_quality.mjs).
import { token, tokenValue, houseStyle, chartAnnotationStyle, linePrimitive, stableId, textPrimitive } from "./core.mjs";
import { legendRowCount, legendNodes } from "./legends.mjs";
import { STEP_LADDER, decade, stepCandidates, onLadder } from "./nice-numbers.mjs";
import { measureText } from "./text-layout.mjs";
import { chartAnnotationBands, evidenceAnnotationTopBandCount, evidenceBandSpan, evidenceRailWidth } from "./chart-annotations.mjs";

export const FONT = token("font.body");
export const INK = token("color.ink");
export const SECONDARY = token("color.textSecondary");
export const GRID = token("color.chartGrid");
export const PRIMARY = token("color.chartSeries1");
export const CHART_LABEL = token("type.chartLabel");
export const CHART_ANNOTATION = token("type.chartAnnotation");
export const AXIS_LABEL = token("type.chartLabel");

export const SERIES = [
  token("color.chartSeries1"),
  token("color.chartSeries2"),
  token("color.chartSeries3"),
  token("color.chartSeries4"),
  token("color.chartSeries5"),
  token("color.chartSeries6")
];

export const MIN_PLOT_HEIGHT = 100;

// The air a plot keeps above its tallest mark for the value label printed on
// it: a column's or a point's label sits over the mark. A horizontal bar
// prints its value at the bar's end, so nothing rides above the first bar and
// the 28px only pushed the bars away from their heading; it keeps enough for
// a highlight's box around the first bar.
export const VALUE_HEADROOM = 28, BAR_HEADROOM = 12;
/** Charts whose categories run down the page as rows of bars. */
export const horizontalChart = (type) => ["chart.bar", "chart.stacked-bar"].includes(type);
export const plotHeadroom = (type) => (horizontalChart(type) ? BAR_HEADROOM : VALUE_HEADROOM);
/**
 * The band above a plot for its legend - 24px for the first row, 26 for each
 * row it wraps to - and its headroom. chartFrame reserves it, and a row of
 * peer charts shares the tallest (compose.mjs): the two must agree, or peers
 * handed the row's band start their plots on different lines.
 */
export const topBand = (legendRows, headroom = VALUE_HEADROOM) => (legendRows ? 24 + headroom + (legendRows - 1) * 26 : headroom);
// The band under a plot that only its category labels use: the gap to the
// labels, their measured height and the theme's trailing gap. A fixed 56px
// leaves a one-line row of period labels 34px of air above the frame's foot.
export const LABEL_BAND = 56;
export const labelBand = (gap, labelHeight) => gap + labelHeight + tokenValue(token("space.3"));

// Mark weight (core.mjs `style.marks`). One 2px line with 10px dots across a
// full-width plot inks 6% of the page's body, where a strong deck's line is
// about 2.5pt with a marker a reader can find and, when the line is alone, a
// light fill beneath it that gives the plot a body. `light` keeps the thin
// construction for a house that draws that way.
export const MARK_WEIGHT_TOKENS = Object.freeze(["line.medium", "color.surfaceTint"]);
export function markWeight() {
  return houseStyle("style.marks") === "light"
    ? { line: token("line.standard"), marker: 10, loneArea: 0, dot: 1, connector: token("line.standard"), bands: false, bars: 0.7 }
    : { line: token("line.medium"), marker: 12, loneArea: 0.16, dot: 1.25, connector: token("line.medium"), bands: true, bars: 0.76 };
}

/**
 * The plot's insets for a chart set over its own data table
 * (`categoryColumns: { label }`, which the composer sets): the table's label
 * column, `label` px wide, then one equal column per category across the rest
 * of the shared width. Bars and columns centre each category in its slot, so
 * the plot spans the value columns exactly; points (`points`) sit at the
 * plot's edges first and last, so the plot runs from the first column's
 * centre to the last's. Null for a chart with no table under it.
 */
export function tableSpan(props, frame, count, { points = false } = {}) {
  const columns = props.categoryColumns;
  if (columns === undefined || columns === null) return null;
  if (!Number.isFinite(columns.label) || columns.label < 0 || columns.label >= frame.width) throw new Error("categoryColumns gives the width in px of the data table's label column (`label`)");
  const column = (frame.width - columns.label) / Math.max(1, count);
  return points ? { left: columns.label + column / 2, right: column / 2 } : { left: columns.label, right: 0 };
}

/**
 * The plot rectangle inside a chart's frame, after the bands above it (legend,
 * callouts, change annotations, periods) and the gutters beside it.
 *
 * When full-height callout bands would leave the plot under its minimum, the
 * bands close up to the boxes' own measured heights (`plot.evidenceCompact`)
 * before the chart gives up: in a 300px panel, two 88px bands holding one-line
 * notes take 176px of plot. Only a plot that is short even with compact bands
 * throws, naming what to change.
 *
 * `labels: { gap, height(width) }`: the band under the plot is its category
 * labels', estimated at `bottomInset` so the checks here count the room it
 * leaves, and settled on the labels measured at the plot's width - shorter
 * labels give the difference back to the plot, taller ones take it. A band
 * a change annotation's rows widened keeps its measure and gives up only what
 * the labels need past one line.
 *
 * `span: { left, right }` (tableSpan): the insets of a chart set over its own
 * data table, taken exactly.
 */
export function chartFrame(frame, { topLegend = false, annotations = [], changeAnnotations = [], annotationRail = null, endLabels = false, leftInset = 54, centerPlot = false, valueLabelInset = 0, totalLabelInset = 0, topInset = 0, bottomInset = LABEL_BAND, periodBand = 0, headroom = VALUE_HEADROOM, labels = null, span = null } = {}) {
  const bands = chartAnnotationBands({ changeAnnotations, annotationRail });
  leftInset = span ? span.left : Math.max(leftInset, bands.left);
  // Peer charts in a row pass the row's tallest top band as topInset so their
  // plots start (and end) on the same lines and one value scale means one pixel scale.
  // topLegend may be a row count (a wrapped legend takes 24px per extra row).
  const legendRows = topLegend === true ? 1 : Number(topLegend) || 0;
  const topFor = (compact) => Math.max(Number(topInset) || 0, topBand(legendRows, headroom) + totalLabelInset + evidenceBandSpan({ annotations }, { compact }) + bands.top + periodBand);
  // Reserve the actual last metric row plus a trailing theme gap, not another full row band.
  const bottom = bands.bottom ? Math.max(bottomInset, 40 + bands.bottom + tokenValue(token("space.3"))) : bottomInset;
  // Callouts the chart moved into a right-hand rail (see renderEvidenceAnnotations) take their width from the plot.
  const railWidth = evidenceRailWidth({ annotations });
  // A chart over its own data table (`span`, tableSpan) keeps its plot over
  // the table's value columns. A gutter it would take beside the plot - a
  // callout rail, end labels, an outside reference label, a rail of values -
  // would pull its categories off their columns, so it is refused instead.
  if (span) {
    const wanted = Math.max(valueLabelInset, bands.right || 0, endLabels ? 186 : 0) + railWidth;
    if (bands.left > span.left + 0.5 || wanted > span.right + 0.5) throw new Error(`A chart over its own data table keeps its categories over the table's columns, and has no room beside its plot for ${railWidth ? "a callout moved into a rail - shorten the note or annotate a mark with room above it" : endLabels ? "end labels - the table names the series" : "labels in a gutter - put them in the callouts or the table"}`);
  }
  const rightInset = span ? span.right : Math.max(valueLabelInset, bands.right || 0, endLabels ? 186 : centerPlot && !bands.left ? leftInset : 16) + railWidth;
  let top = topFor(false), compact = false;
  // A peer in a row is given the row's top band; when its full bands would
  // overrun that budget and compact ones fit it, it closes them and keeps the
  // shared top line.
  const shared = Number(topInset) || 0;
  if (shared && top > shared && evidenceAnnotationTopBandCount({ annotations }) && topFor(true) <= shared) { top = topFor(true); compact = true; }
  if (frame.height - bottom - top < MIN_PLOT_HEIGHT && evidenceAnnotationTopBandCount({ annotations })) { top = topFor(true); compact = true; }
  // Still short with compact bands: the last callout holding a band gives it
  // up and goes beside its mark, inside it, or into a rail at the plot's right
  // (renderEvidenceAnnotations), and the chart renders again (renderResolved),
  // one callout at a time, so the rest keep the band while it fits. Only a
  // plot that is short with no band at all asks the author for less. Three
  // callouts on a bridge under a full-width text band failed here with "give
  // the chart more height", which an author cannot do; releasing all three at
  // once failed too, the first having no room beside its mark.
  const released = (annotations || []).findLastIndex((item) => item && !item._placement);
  if (frame.height - bottom - top < MIN_PLOT_HEIGHT && released >= 0 && evidenceAnnotationTopBandCount({ annotations }) && frame.height - bottom - topFor(true) + evidenceBandSpan({ annotations }, { compact: true }) >= MIN_PLOT_HEIGHT)
    throw Object.assign(new Error("Chart annotation bands leave insufficient plot height"), { retry: (current) => ({ ...current, annotations: (current.annotations || []).map((item, at) => at === released ? { ...item, _placement: "beside" } : item) }) });
  if (frame.height - bottom - top < MIN_PLOT_HEIGHT) throw new Error(`Chart annotation bands leave insufficient plot height (${Math.max(0, Math.floor(frame.height - bottom - top))}px of the ${MIN_PLOT_HEIGHT}px minimum, even with compact callout bands); give the chart ${Math.ceil(MIN_PLOT_HEIGHT - (frame.height - bottom - top))}px more height, drop an annotation, or split the exhibit`);
  const width = frame.width - leftInset - rightInset;
  if (width < 120) throw new Error(`Chart has insufficient plot width (${Math.max(0, Math.floor(width))}px of the 120px minimum after its labels and gutters); widen the chart, shorten category labels, or split the exhibit`);
  const labelHeight = labels ? labels.height(width) : 0;
  const settled = !labels ? 0 : bottom === bottomInset ? labelBand(labels.gap, labelHeight) - bottomInset : Math.max(0, labelHeight - 28);
  return {
    x: frame.x + leftInset,
    y: frame.y + top,
    width,
    height: Math.max(MIN_PLOT_HEIGHT, frame.height - bottom - top) - settled,
    // Where a callout moved beside its mark may reach: the chart's own frame.
    limits: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
    ...(railWidth ? { railWidth } : {}),
    ...(compact ? { evidenceCompact: true } : {})
  };
}

/** Value labels follow the house style: bold by default, regular where the house sets them light. */
export const labelBold = () => houseStyle("style.labelWeight") !== "regular";
export function textStyle(size = CHART_LABEL, color = SECONDARY, bold = false, align = "center") {
  return { ...(bold ? chartAnnotationStyle() : { fontFamily: FONT }), fontSize: size, color, bold, align, valign: "mid" };
}

export function lineStyle(stroke = GRID, width = token("line.hairline"), dash = "solid") {
  return { stroke, lineWidth: width, dash };
}

export function fillStyle(fill, stroke = fill, width = token("line.hairline"), opacity = 1) {
  return { fill, stroke, lineWidth: width, opacity };
}

export function topLegend({ id, frame, items, align = "right", variant = "swatch" }) {
  if (!items.length) return [];
  const rows = legendRowCount(items, frame.width - 70);
  return legendNodes({ id, frame: { x: frame.x + 54, y: frame.y + 7, width: frame.width - 70, height: 28 + (rows - 1) * 26 }, props: { items, placement: align === "right" ? "top-right" : "top", variant } });
}
/** Rows a chart's top legend needs, for the plot inset. */
export const legendRowsFor = (items, frame) => items.length ? legendRowCount(items, frame.width - 70) : 0;

function tightRange(values, includeZero) {
  let min = Math.min(...values), max = Math.max(...values);
  if (includeZero) { min = Math.min(0, min); max = Math.max(0, max); return { min, max, span: max - min || 1, step: (max - min) / 4 || 1 }; }
  const pad = (max - min || Math.abs(max) || 1) * 0.25;
  min -= pad; max += pad;
  return { min, max, span: max - min || 1, step: (max - min) / 4 || 1 };
}

// A domain may be divided into three to six whole steps. Held to four, a
// series running 132 to 313 took 100 to 500 - the next four-step ladder past
// 313 - and its line filled the lower half of the plot; five steps of 50 reach
// 350 and the line fills three quarters. The tightest division wins, and four
// wins a tie.
const TICK_COUNTS = Object.freeze([4, 3, 5, 6]);

function range(values, includeZero) {
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
  // For each tick count, the smallest ladder step whose whole increments,
  // anchored at or below the data minimum, still reach the data maximum.
  let best = null;
  for (const steps of TICK_COUNTS) {
    for (const candidate of stepCandidates((dataMax - dataMin) / steps)) {
      const start = Math.floor(dataMin / candidate + 1e-9) * candidate;
      if (start + candidate * steps >= dataMax - 1e-9) {
        if (!best || candidate * steps < best.step * best.steps - 1e-9) best = { step: candidate, niceMin: start, steps };
        break;
      }
    }
  }
  const { step, niceMin, steps } = best ?? { step: (dataMax - dataMin) / 4, niceMin: dataMin, steps: 4 };
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + (STEP_LADDER.includes(step / decade(step)) && String(step / decade(step)) === "2.5" ? 1 : 0));
  const round = (value) => Number(value.toFixed(Math.min(10, decimals)));
  min = round(niceMin);
  max = round(niceMin + step * steps);
  return { min, max, span: max - min || 1, step: round(step) };
}

/**
 * How many ticks divide a domain into ladder steps: the preferred count if it
 * does, else three, five, six or two. An explicit domain keeps a readable
 * interval (four intervals on 0-6 print 1.5 steps and fail the tick gate),
 * and an automatic one is built on one of these counts (range above).
 */
export function tickCount(min, max, preferred = 4) {
  return [preferred, 3, 5, 6, 2].find((count) => onLadder((max - min) / count)) ?? preferred;
}

export function assertGridlineOption(props) {
  if (props.gridlines !== undefined && typeof props.gridlines !== "boolean") throw new Error("Chart gridlines must be true or false");
  if (props.showValueAxis !== undefined && typeof props.showValueAxis !== "boolean") throw new Error("Chart showValueAxis must be true or false");
  if (props.showValueAxis === false && props.gridlines === true) throw new Error("Chart gridlines require a visible value axis");
}

export function resolveValueAxis(props, { valueCount, dataLabelsVisible }) {
  if (props.showValueAxis !== undefined) return props.showValueAxis;
  if (props.gridlines === true) return true;
  // Direct labels replace the value axis: a labelled mark needs no scale to read.
  return !dataLabelsVisible;
}

export function normalizedCategoricalData(props, { seriesCount = null } = {}) {
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

export function numericBounds(values, { min, max, axis = "y", includeZero = false, tight = false } = {}) {
  if (!Array.isArray(values) || !values.length || values.some(value => !Number.isFinite(value))) throw new Error(`${axis}-axis values must be finite`);
  // With no value axis the marks carry their values, so the domain fits the
  // data (zero-anchored for bars, padded for lines) instead of the tick ladder,
  // and the tallest mark uses the plot.
  const computed = tight ? tightRange(values, includeZero) : range(values, includeZero);
  const bounds = { min: min ?? computed.min, max: max ?? computed.max };
  if (!Number.isFinite(bounds.min) || !Number.isFinite(bounds.max) || bounds.max <= bounds.min) throw new Error(`${axis}-axis maximum must be greater than its minimum`);
  if (includeZero && (bounds.min > 0 || bounds.max < 0)) throw new Error(`${axis}-axis bounds for bars must include zero`);
  if (values.some(value => value < bounds.min || value > bounds.max)) throw new Error(`${axis}-axis bounds must contain every plotted value`);
  return { ...bounds, span: bounds.max - bounds.min };
}

/**
 * Which labels a crowded period axis keeps, given how many slots one label
 * needs: the first, then every nth, at a step - the one needed, or one more -
 * that lands on the latest period, so both ends of the series are named and
 * the gaps are even. Ten years at every second slot are labelled FY17, FY20,
 * FY23, FY26; every second from the first would leave FY26 bare, and the line
 * chart's old rule (every second plus the last) set FY25 and FY26 side by
 * side. Only when neither step reaches the latest does the chart fall back to
 * its own pattern. The native chart prints the same labels (core.mjs
 * nativeChartSpec reads the ones the scene drew).
 */
export function periodLabelStep(count, needed) {
  if (needed <= 1) return { every: 1, fromFirst: true };
  for (const every of [needed, needed + 1]) if ((count - 1) % every === 0) return { every, fromFirst: true };
  return { every: needed, fromFirst: false };
}

export function axisTickText(min, max, index, steps = 4) {
  const value = min + (max - min) * index / steps;
  // The domain is already rounded to whole steps, so the tick is exact; trim the
  // binary-float tail rather than inventing precision.
  const decimals = Math.max(0, ...[min, max, (max - min) / steps].map((entry) => {
    const text = String(Number(entry.toPrecision(12)));
    return text.includes(".") ? text.split(".")[1].length : 0;
  }));
  // Every tick prints that one precision: 0.0, 2.5, 5.0, not 0, 2.5, 5.
  return (value + 0).toFixed(Math.min(10, decimals)).replace(/^-(0(\.0+)?)$/, "$1");
}

export function axisLabelWidth(bounds) {
  const steps = tickCount(bounds.min, bounds.max);
  return Math.max(48, ...Array.from({ length: steps + 1 }, (_, index) => Math.ceil(measureText(axisTickText(bounds.min, bounds.max, index, steps), 1000, { fontSize: tokenValue(AXIS_LABEL) }).width)));
}

export function axes(id, plot, yMin, yMax, steps = 4, { gridlines = false, showValueAxis = true, labelWidth = 48 } = {}) {
  steps = tickCount(yMin, yMax, steps);
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
        data: { axis: "y", value: yMin + (yMax - yMin) * index / steps },
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

export function horizontalAxes(id, plot, xMin, xMax, steps = 4, { gridlines = false, showValueAxis = true } = {}) {
  steps = tickCount(xMin, xMax, steps);
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
        data: { axis: "x", value: xMin + (xMax - xMin) * index / steps },
        frame: { x: x - 28, y: plot.y + plot.height + 8, width: 56, height: 24 },
        text: axisTickText(xMin, xMax, index, steps),
        style: textStyle(AXIS_LABEL, SECONDARY, false, "center")
      }));
    }
  }
  const zeroX = plot.x + (0-xMin)/(xMax-xMin)*plot.width;
  nodes.push(linePrimitive({ id: stableId(id, "y-axis"), role: "chart-axis", x1: zeroX, y1: plot.y, x2: zeroX, y2: plot.y + plot.height, style: lineStyle(INK) }));
  if (showValueAxis) nodes.push(linePrimitive({ id: stableId(id, "x-axis"), role: "chart-axis", x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height, style: lineStyle(INK) }));
  return nodes;
}
