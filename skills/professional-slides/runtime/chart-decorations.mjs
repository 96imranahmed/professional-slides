// What a chart sets over its data: reference lines (and the room their labels
// need in the value domain), highlights, periods and events, callouts and the
// change annotations (chart-annotations.mjs), data labels, and the CAGR column
// beside the plot - drawn by `withDecorations` after the chart's own marks.
//
// CHART_DECORATIONS declares every mark an author can ask a chart for; each
// chart definition says which it `draws` and which it `refuses`, and
// `refuseUndrawn` refuses any other before the chart is laid out, so nothing
// authored is dropped unseen.
import { linePrimitive, stableId, textPrimitive, token, tokenValue, rectPrimitive, isTokenReference } from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { chartAnnotationBands, renderAnnotationRail, renderChangeAnnotations, renderEvidenceAnnotations } from "./chart-annotations.mjs";
import { FONT, INK, SECONDARY, GRID, CHART_LABEL, textStyle, lineStyle, CHART_ANNOTATION, labelBold } from "./chart-axes.mjs";
import { formatValue } from "./value-format.mjs";

// A target or capacity is part of the quantitative comparison. Include it in
// automatic domains; numericBounds also rejects it outside an explicit domain.
// A reference line at or near the top of the data - "FY19 peak", a target the
// last bar reaches - needs room above it for its label and the bars' value
// labels, so the domain reaches 15% past such a line, as an author setting
// yMax would. On a line's own scale, which need not start at zero, the 15% is
// of the data's span, not of the value: 15% of a 2.66m-tonne peak over a floor
// of 1.85m would take the domain to 3.06 and leave a void above the line.
// A line's domain fitted to its data (`padded`: no value axis) already runs a
// quarter of its span past the top, which holds the label; the 15% added again
// on top of it left a quarter of the plot empty over a peak line.
export const withReferenceValues = (values, props, { base = 0, padded = false } = {}) => {
  const references = (props.referenceLines || []).map(reference => reference.value).filter(Number.isFinite);
  const top = Math.max(...values.filter(Number.isFinite));
  const headroom = props.yMax === undefined && props.xMax === undefined && !padded ? references.filter(v => v > 0 && v >= base + (top - base) * 0.9).map(v => v + (v - base) * 0.15) : [];
  return [...values, ...references, ...headroom];
};

const HIGHLIGHT_STYLES = Object.freeze(["bar", "region-box", "region-tint"]);
export const REGION_HIGHLIGHT_INLINE_PAD = 12;
const REGION_HIGHLIGHT_BLOCK_PAD = 12;

export function normalizedHighlights(props, { categories = [], series = [], allowBar = false, defaultStyle = "region-tint" } = {}) {
  const highlights = props.highlights || [];
  if (!Array.isArray(highlights)) throw new Error("Chart highlights must be an array");
  // Several marks may express one comparison or set; they share one treatment.
  if (new Set(highlights.map(h => h.style ?? defaultStyle)).size > 1)
    throw new Error("Use one coherent chart highlight treatment for the selected set");
  if (new Set(highlights.map(h => h.category)).size !== highlights.length)
    throw new Error("Chart highlights must name distinct categories");
  const seriesNames = series.map(item => typeof item === "string" ? item : item.name);
  return highlights.map((highlight) => {
    if (!highlight || typeof highlight.category !== "string" || !categories.includes(highlight.category)) throw new Error("Chart highlight references an unknown category");
    const style = highlight.style ?? defaultStyle;
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

/**
 * Period bands and event flags, as the 2020–24 decks annotate a time series:
 * `periods: [{ from, to, label }]` brackets runs of categories above the plot
 * ("Maturing market", "Covid-19 stimulus") with dashed dividers between them;
 * `events: [{ at, label }]` drops a dashed line at a category from a flag above
 * the plot ("Mar 9: lockdown"). Both reserve their band in chartFrame.
 */
const PERIOD_BAND = 34, EVENT_LABEL_WIDTH = 150;
export function normalizePeriods(props = {}, categories = []) {
  if (props.periods === undefined) return [];
  if (!Array.isArray(props.periods) || !props.periods.length) throw new Error("periods must be a nonempty array of { from, to, label }");
  return props.periods.map((period) => {
    const from = categories.indexOf(period?.from), to = categories.indexOf(period?.to);
    if (from < 0 || to < 0 || to < from) throw new Error("period from and to must name two categories in order");
    if (typeof period.label !== "string" || !period.label.trim()) throw new Error("period requires a label");
    return { from, to, label: period.label.trim() };
  });
}
export function normalizeEvents(props = {}, categories = []) {
  if (props.events === undefined) return [];
  if (!Array.isArray(props.events) || !props.events.length) throw new Error("events must be a nonempty array of { at, label }");
  return props.events.map((event) => {
    const index = categories.indexOf(event?.at);
    if (index < 0) throw new Error("event at must name a chart category");
    if (typeof event.label !== "string" || !event.label.trim()) throw new Error("event requires a label");
    return { index, label: event.label.trim() };
  });
}
const PERIOD_LABEL_GAP = 26;
// Event flags stand in two staggered rows above the plot, each as deep as its tallest label: a band of fixed depth held a
// one-line flag over some fifty pixels of nothing, which read as a strip left empty above the chart.
const EVENT_ROW_GAP = 6;
const eventLabel = (label) => measureText(label, EVENT_LABEL_WIDTH, { fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL) });
function eventRows(events) {
  const rows = [0, 0];
  events.forEach((event, index) => { rows[index % 2] = Math.max(rows[index % 2], eventLabel(event.label).height); });
  return rows;
}
const eventBandHeight = (events) => { if (!events.length) return 0; const [first, second] = eventRows(events); return first + EVENT_ROW_GAP + (events.length > 1 ? second + EVENT_ROW_GAP : 0); };
export function periodBandHeight(props = {}, categories = []) {
  // The period band clears the value labels above the tallest column (26px).
  return (normalizePeriods(props, categories).length ? PERIOD_BAND + PERIOD_LABEL_GAP : 0) + eventBandHeight(normalizeEvents(props, categories));
}
function periodAndEventNodes({ id, plot, props, categoryMap, categories }) {
  const periods = normalizePeriods(props, categories), events = normalizeEvents(props, categories);
  const underlay = [], overlay = [];
  if (!periods.length && !events.length) return { underlay, overlay };
  const frames = categories.map((c) => categoryMap.get(c));
  const left = (i) => frames[i].labelCenter !== undefined ? frames[i].labelCenter - frames[i].labelSpan / 2 : frames[i].x;
  const right = (i) => frames[i].labelCenter !== undefined ? frames[i].labelCenter + frames[i].labelSpan / 2 : frames[i].x + frames[i].width;
  const centre = (i) => frames[i].labelCenter !== undefined ? frames[i].labelCenter : frames[i].x + frames[i].width / 2;
  // Above the plot, in order: value labels, any growth-arrow band, event flags, then periods.
  const changeBand = chartAnnotationBands({ changeAnnotations: props.changeAnnotations || [], annotationRail: null }).top;
  const eventsTop = plot.y - eventBandHeight(events), rows = eventRows(events);
  const periodsTop = eventsTop - changeBand - (periods.length ? PERIOD_BAND + PERIOD_LABEL_GAP : 0);
  periods.forEach((period, index) => {
    const x1 = left(period.from) + 4, x2 = right(period.to) - 4, y = periodsTop + PERIOD_BAND - 8;
    overlay.push(textPrimitive({ id: stableId(id, "period-label", index), role: "chart-period-label", frame: { x: x1, y: periodsTop, width: x2 - x1, height: 22 }, text: period.label, style: textStyle(CHART_LABEL, SECONDARY, true, "center") }));
    overlay.push(linePrimitive({ id: stableId(id, "period-rule", index), role: "chart-period-rule", x1, y1: y, x2, y2: y, style: lineStyle(SECONDARY, token("line.hairline")) }));
    for (const x of [x1, x2]) overlay.push(linePrimitive({ id: stableId(id, "period-tick", index, x === x1 ? "a" : "b"), role: "chart-period-rule", x1: x, y1: y, x2: x, y2: y + 6, style: lineStyle(SECONDARY, token("line.hairline")) }));
    if (index) {
      const divider = (right(periods[index - 1].to) + left(period.from)) / 2;
      underlay.push(linePrimitive({ id: stableId(id, "period-divider", index), role: "chart-period-divider", x1: divider, y1: periodsTop + 4, x2: divider, y2: plot.y + plot.height, style: lineStyle(GRID, token("line.hairline"), "dash") }));
    }
  });
  events.forEach((event, index) => {
    const x = centre(event.index);
    const row = index % 2, labelTop = eventsTop + (row ? rows[0] + EVENT_ROW_GAP : 0);
    const label = eventLabel(event.label);
    if (label.lines.length > 2) throw new Error(`event label "${event.label}" exceeds two lines; shorten it`);
    // The flag sits to the right of its line, or to the left near the plot's edge.
    const fits = x + 6 + label.width <= plot.x + plot.width;
    const lx = fits ? x + 6 : x - 6 - label.width;
    overlay.push(textPrimitive({ id: stableId(id, "event-label", index), role: "chart-event-label", frame: { x: lx, y: labelTop, width: label.width + 2, height: label.height }, text: label.text, style: { ...textStyle(CHART_LABEL, INK, true, fits ? "left" : "right"), valign: "top", lineHeight: label.lineHeight, wrap: false }, data: { textLayout: label } }));
    underlay.push(linePrimitive({ id: stableId(id, "event-line", index), role: "chart-event-line", x1: x, y1: labelTop, x2: x, y2: plot.y + plot.height, style: lineStyle(INK, token("line.hairline"), "dash") }));
  });
  return { underlay, overlay };
}

function decorations({ id, plot, props, pointMap = new Map(), categoryMap = new Map(), yScale = null, xScale = null, obstacles = [], allowBarHighlight = false, allowAnnotationRail = true, arrowOnly = false, allowOutsideReferenceLabels = false }) {
  const underlay = [];
  const overlay = [];
  if (props.categories && categoryMap.size && (props.periods || props.events)) {
    const bands = periodAndEventNodes({ id, plot, props, categoryMap, categories: props.categories });
    underlay.push(...bands.underlay); overlay.push(...bands.overlay);
  }
  drawHorizontalReferenceLines({ id, plot, props, yScale, xScale, obstacles, underlay, overlay });
  const evidenceAnnotations = renderEvidenceAnnotations({ id, plot, props, pointMap, obstacles });
  const annotationPlacements = evidenceAnnotations.placements;
  const overlaps = (a, b, padding = 4) => !(
    a.x + a.width + padding <= b.x
    || b.x + b.width + padding <= a.x
    || a.y + a.height + padding <= b.y
    || b.y + b.height + padding <= a.y
  );
  drawRegionHighlights({ id, plot, props, categoryMap, allowBarHighlight, underlay });
  drawVerticalReferenceLines({ id, plot, props, yScale, obstacles, allowOutsideReferenceLabels, underlay, overlay, annotationPlacements, overlaps });
  overlay.push(...evidenceAnnotations.nodes);
  // A change arrow keeps clear of what is set above the marks before it - reference and threshold labels, callouts - as it
  // does of the marks themselves.
  overlay.push(...renderChangeAnnotations({ id, plot, props, pointMap, obstacles: [...obstacles, ...overlay], arrowOnly }));
  overlay.push(...renderAnnotationRail({ id, plot, props, categoryMap, allow: allowAnnotationRail }));
  return { underlay, overlay };
}

// Horizontal charts carry a value axis along x: a reference is a vertical line
// with its label set above the plot, clear of the bars.
function drawHorizontalReferenceLines({ id, plot, props, yScale, xScale, obstacles, underlay, overlay }) {
  if (!yScale && xScale) {
    for (const [index, reference] of (props.referenceLines || []).entries()) {
      const x = xScale(reference.value);
      // Interrupt the exact-value guide around direct labels, rather than
      // drawing through a value near the threshold. Its x position is unchanged.
      const gaps = obstacles.filter(node => node.role === "data-label" && x >= node.frame.x - 4 && x <= node.frame.x + node.frame.width + 4)
        .map(node => [Math.max(plot.y - 4, node.frame.y - 4), Math.min(plot.y + plot.height, node.frame.y + node.frame.height + 4)])
        .sort((a, b) => a[0] - b[0]);
      let cursor = plot.y - 4, segment = 0;
      for (const [start, end] of [...gaps, [plot.y + plot.height, plot.y + plot.height]]) {
        if (start > cursor) underlay.push(linePrimitive({ id: stableId(id, "reference-line", index, segment++), role: "chart-reference-line", x1: x, y1: cursor, x2: x, y2: start, style: lineStyle(token("color.componentPrimary"), token("line.standard"), "dash") }));
        cursor = Math.max(cursor, end);
      }
      if (reference.label) {
        const measured = measureText(reference.label, 260, { fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL), bold: true });
        const left = Math.min(plot.x + plot.width - measured.width, x + 6);
        overlay.push(textPrimitive({ id: stableId(id, "reference-label", index), role: "chart-reference-label", frame: { x: left, y: plot.y - measured.height - 6, width: measured.width, height: measured.height }, text: measured.text, style: { ...textStyle(CHART_LABEL, token("color.componentPrimary"), labelBold(), "left"), valign: "top", lineHeight: measured.lineHeight, wrap: false }, data: { textLayout: measured, value: reference.value } }));
      }
    }
  }
}

// Each region highlight's box or tint behind its category (a bar highlight is the bar's own colour).
function drawRegionHighlights({ id, plot, props, categoryMap, allowBarHighlight, underlay }) {
  const highlights = normalizedHighlights(props, { categories: [...categoryMap.keys()], allowBar: allowBarHighlight });
  for (const [index, highlight] of highlights.entries()) {
    if (highlight.style === "bar") continue;
    const target = categoryMap.get(highlight.category);
    if (!target) throw new Error(`${id} highlight references unknown category ${highlight.category}`);
    // Nothing to point at. A category at or near zero draws a mark of a few
    // pixels, and the full-height tint standing where that mark would have
    // been is 38 times its height: the largest object in the plot is an empty
    // grey box, which on a page arguing that this one costs nothing is the
    // opposite of the finding. Under a twelfth of the chart's largest value
    // the band is dropped and the printed figure carries the emphasis.
    const at = [...categoryMap.keys()].indexOf(highlight.category);
    const values = (props.series || []).map((item) => item?.values?.[at]).filter((value) => Number.isFinite(value));
    const largest = Math.max(0, ...(props.series || []).flatMap((item) => (item?.values || []).map((value) => Math.abs(Number(value) || 0))));
    if (values.length && largest > 0 && Math.max(...values.map((value) => Math.abs(value))) <= largest * 0.08) continue;
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
    // A region highlight says "this category", and it has to stop at the axis:
    // twelve pixels of tint below the baseline reads as a bar that starts
    // under the chart, and twelve to the left of a value axis crosses it.
    const clipped = {
      x: Math.max(frame.x, plot.x),
      y: frame.y,
      width: Math.min(frame.x + frame.width, plot.x + plot.width) - Math.max(frame.x, plot.x),
      height: Math.min(frame.y + frame.height, plot.y + plot.height) - frame.y,
    };
    underlay.push(rectPrimitive({
      id: stableId(id, "highlight", index),
      role: "chart-highlight",
      frame: clipped,
      style: box
        ? { fill: "none", stroke: token("color.componentPrimary"), lineWidth: token("line.standard"), opacity: 1 }
        : { fill: token("color.surfaceMuted"), stroke: "none", lineWidth: token("line.hairline"), opacity: 0.8 },
      data: { category: highlight.category, highlightStyle: highlight.style }
    }));
  }
}

// A value axis up the page: each reference is a dashed line across the plot,
// broken around value labels left on it, with its label in the first place
// clear of the callouts, the marks and the plotted series.
function drawVerticalReferenceLines({ id, plot, props, yScale, obstacles, allowOutsideReferenceLabels, underlay, overlay, annotationPlacements, overlaps }) {
  if (yScale) {
    for (const [index, reference] of (props.referenceLines || []).entries()) {
      if(reference.placement === "outside-end" && !allowOutsideReferenceLabels) throw new Error("Outside reference labels are supported only on column charts");
      const y = yScale(reference.value);
      // A value label the chart left in place across this line (its column
      // too short to take the label inside) interrupts the line, as the
      // horizontal guide already does around a bar's value.
      const gaps = obstacles.filter(node => node.role === "data-label" && node.data?.referenceGap)
        .map(node => { const ink = measureDataLabel(node.text), top = node.frame.y + (node.frame.height - ink.height) / 2, left = node.frame.x + (node.frame.width - ink.width) / 2; return { top, bottom: top + ink.height, left: left - 4, right: left + ink.width + 4 }; })
        .filter(gap => y >= gap.top - 3 && y <= gap.bottom + 3)
        .sort((a, b) => a.left - b.left);
      let cursor = plot.x, segment = 0;
      for (const [start, end] of [...gaps.map(gap => [gap.left, gap.right]), [plot.x + plot.width, plot.x + plot.width]]) {
        if (start > cursor) underlay.push(linePrimitive({
          id: segment ? stableId(id, "reference-line", index, segment) : stableId(id, "reference-line", index),
          role: "chart-reference-line",
          x1: cursor,
          y1: y,
          x2: Math.min(start, plot.x + plot.width),
          y2: y,
          style: lineStyle(token("color.componentPrimary"), token("line.standard"), "dash")
        })), segment += 1;
        cursor = Math.max(cursor, end);
      }
      const text = reference.label || String(reference.value);
      const measured = measureText(text, Math.min(240, plot.width * 0.45), { fontFamily: tokenValue(token("font.body")), fontSize: tokenValue(CHART_ANNOTATION), bold: true });
      const labelWidth = Math.ceil(measured.width) + 2;
      const labelHeight = measured.height;
      // Outside, the gutter holds nothing else, so a line at the very top or
      // foot of the plot (a target equal to the tallest column, on a tight
      // scale) keeps its label inside the plot's height rather than losing it.
      const labelCandidates = reference.placement === "outside-end" ? [
        { x: plot.x + plot.width + tokenValue(token("space.3")), y: Math.max(plot.y, Math.min(plot.y + plot.height - labelHeight, y - labelHeight / 2)), width: labelWidth, height: labelHeight, align: "left" }
      ] : [
        { x: plot.x + plot.width - labelWidth - 4, y: y - labelHeight - 8, width: labelWidth, height: labelHeight, align: "right" },
        { x: plot.x + 8, y: y - labelHeight - 8, width: labelWidth, height: labelHeight, align: "left" },
        { x: plot.x + plot.width - labelWidth - 4, y: y + 8, width: labelWidth, height: labelHeight, align: "right" },
        { x: plot.x + 8, y: y + 8, width: labelWidth, height: labelHeight, align: "left" },
        // Then along the line: a designer sets the label wherever the line
        // runs clear - between two columns, over a dip - before giving up on
        // the plot, which a line chart (with no outside gutter) cannot leave.
        ...[0.5, 0.25, 0.75, 0.375, 0.625, 0.125, 0.875].flatMap(at => [y - labelHeight - 8, y + 8].map(top => ({ x: plot.x + (plot.width - labelWidth) * at, y: top, width: labelWidth, height: labelHeight, align: "center" })))
      ];
      const fits = (candidate) => candidate.y >= plot.y && candidate.y + candidate.height <= plot.y + plot.height && annotationPlacements.every(({ frame }) => !overlaps(candidate, frame)) && [...obstacles, ...overlay].filter((node) => ["chart-mark", "data-label", "chart-reference-label"].includes(node.role)).every((node) => !overlaps(candidate, node.frame)) && (reference.placement === "outside-end" || (props.referenceLines || []).every(other => yScale(other.value) < candidate.y - 4 || yScale(other.value) > candidate.y + candidate.height + 4));
      // A label the series runs through is read as part of the line: the
      // first place clear of every plotted line and point is taken, and only
      // where there is none does the label settle for clear of the marks.
      const series = obstacles.filter((node) => node.role === "chart-line" && node.type === "line");
      const points = obstacles.filter((node) => node.role === "chart-marker");
      const clearOfSeries = (candidate) => points.every((node) => !overlaps(candidate, node.frame)) && series.every(({ data: { x1, y1, x2, y2 } = {} }) => {
        if (![x1, y1, x2, y2].every(Number.isFinite)) return true;
        const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 3));
        for (let i = 0; i <= steps; i++) {
          const px = x1 + (x2 - x1) * i / steps, py = y1 + (y2 - y1) * i / steps;
          if (px > candidate.x - 2 && px < candidate.x + candidate.width + 2 && py > candidate.y - 2 && py < candidate.y + candidate.height + 2) return false;
        }
        return true;
      });
      // A reference that was written as a series (referenceSeriesAsLines) takes a label only where it is clear of the lines:
      // with none, the chart is drawn again with it as a dashed series, which needs no label in the plot.
      const labelFrame = labelCandidates.find((candidate) => fits(candidate) && clearOfSeries(candidate)) ?? (reference.fromSeries ? undefined : labelCandidates.find(fits));
      if (!labelFrame) throw Object.assign(new Error(`No collision-free reference-line label position${reference.placement === "outside-end" ? " outside the plot" : allowOutsideReferenceLabels ? "; set placement: \"outside-end\" or revise the chart composition" : "; revise the chart composition"}`), { referenceIndex: index });
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
}

// Exported for the wider catalogue (charts-extra.mjs): a chart there that sets
// its marks by category and series takes callouts, highlights and reference
// lines from here rather than dropping them.
export function withDecorations(nodes, options) {
  const { underlay, overlay } = decorations({ ...options, obstacles: nodes });
  const backings = [];
  for (const label of nodes.filter((node) => node.role === "data-label")) {
    const resolve = (value, fallback) => isTokenReference(value) ? tokenValue(value) : (value?.value ?? value ?? fallback);
    const measured = measureText(label.text, label.frame.width + 0.5, { fontFamily: resolve(label.style.fontFamily, "Arial"), fontSize: resolve(label.style.fontSize, tokenValue(CHART_LABEL)), bold: label.style.bold });
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

export const measureDataLabel = (text, width = 1000) => {
  const measured = measureText(text, width, {
    fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL), bold: true
  });
  // Keep the same font-engine clearance used by ordinary text wrapping, and
  // survive the scene's coordinate rounding without creating a spurious wrap.
  return { ...measured, width: Math.ceil(measured.width / 0.97) + 2 };
};

/**
 * The growth of each series between two categories: a compound annual rate
 * when both name years, otherwise the change. Stacked columns set it beside the
 * last stack (`segmentGrowth`), lines beside their end labels (`seriesGrowth`).
 */
export function growthColumn(g, categories, series, name) {
  const a = categories.indexOf(g?.from), b = categories.indexOf(g?.to);
  if (a < 0 || b <= a) throw new Error(`${name}.from and .to must name two categories in order`);
  const year = (c) => { const m = String(c).match(/(?:19|20)\d{2}/); return m ? Number(m[0]) : null; };
  const years = year(g.from) !== null && year(g.to) !== null && year(g.to) > year(g.from) ? year(g.to) - year(g.from) : null;
  const rates = series.map((item) => {
    const v0 = item.values[a], v1 = item.values[b];
    if (!(v0 > 0 && v1 > 0)) return null;
    return years ? (Math.pow(v1 / v0, 1 / years) - 1) * 100 : (v1 / v0 - 1) * 100;
  });
  // The column is read down, so it takes one precision: a decimal when any
  // rate is under ten - chosen per rate, "+4.2%" would sit above "+12%".
  const decimals = rates.some((rate) => rate !== null && Math.abs(rate) < 10) ? 1 : 0;
  const rows = series.map((item, index) => {
    const rate = rates[index];
    if (rate === null) return { name: item.name, text: "n/a" };
    return { name: item.name, text: `${rate >= 0 ? "+" : "−"}${Math.abs(rate).toFixed(decimals)}%` };
  });
  return { to: g.to, label: g.label || (years ? `CAGR ${g.from}–${String(g.to).slice(-2)}` : `Change ${g.from}–${g.to}`), rows };
}

/**
 * The marks an author asks a chart to set over its data, by prop. Every chart
 * says which of them it draws (`draws`) and which its renderer refuses in its
 * own words (`refuses`); one authored on a chart that does neither is refused
 * when the chart renders - at compile, where it is cheap to change - naming
 * the charts that draw it. Nothing an author asks a chart to mark is dropped
 * unseen. (`focus` on a column, bar, line, area or lollipop chart is read by
 * the composer into `focusSeries` or `highlights` before the chart sees it.)
 */
export const CHART_DECORATIONS = Object.freeze({
  annotations: "callouts (`annotations`)",
  referenceLines: "reference lines (`referenceLines`)",
  highlights: "highlights (`highlights`)",
  focus: "a subject (`focus`)",
  focusSeries: "a subject series (`focusSeries`)",
  changeAnnotations: "change annotations (`changeAnnotations`)",
  annotationRail: "an annotation rail (`annotationRail`)",
  periods: "periods (`periods`)",
  events: "events (`events`)",
  pointHighlights: "point highlights (`pointHighlights`)",
});
const authoredDecoration = (value) => Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== false;
// What a chart on a vertical category axis draws through the shared decorations.
export const CATEGORY_DECORATIONS = ["annotations", "referenceLines", "highlights", "changeAnnotations", "annotationRail", "periods", "events"];

// An authored mark the chart neither draws nor refuses in its own words:
// refused before anything is laid out, naming the charts (of `catalogue`, the
// registered chart definitions) that draw it.
export function refuseUndrawn(chart, props, id, catalogue) {
  const handled = new Set([...chart.draws, ...(chart.refuses || [])]);
  for (const key of Object.keys(CHART_DECORATIONS)) {
    if (handled.has(key) || !authoredDecoration(props[key])) continue;
    const drawers = catalogue.filter((other) => other.draws.includes(key)).map((other) => other.id.replace("chart.", ""));
    const name = chart.id.replace("chart.", "");
    throw new Error(`${id}: ${/^[aeiou]/.test(name) ? "an" : "a"} ${name} chart does not draw ${CHART_DECORATIONS[key]}, and set here it would be dropped unseen - remove it and say it in the commentary or a caption${drawers.length ? `, or show the evidence as a chart that draws it (${drawers.join(", ")})` : ""}`);
  }
}

// What a series is, beside its numbers: `state` on a series of any chart that
// plots series against categories.
//
//   recorded   a record, drawn as a series is (the default)
//   assumed    an assumption, a scenario's path or a forecast: a line is
//              dashed with open markers, a bar or column a lighter fill, and
//              the key says "(assumed)". `assumedFrom: "<category>"` says the
//              same of the run from that category on - a recorded series
//              carried forward - and the rest is drawn as recorded.
//   reference  a threshold, a target or a constant the data is read against:
//              where it is one value across the axis and the chart draws
//              reference lines, it is drawn as one - a dashed rule across the
//              plot, named and valued at the line's end, with no markers and
//              no place in the legend - and otherwise as a thin dashed line
//              or a lighter bar keyed "(reference)".
//
// A bound exhibit is given these by the runtime, which knows which of its
// measures are assumed and which are a single value (bind.mjs); a typed one
// says them itself. Drawn as recorded data, an assumed constant and a
// threshold read as two more measured series.
export const SERIES_STATES = Object.freeze(["recorded", "assumed", "reference"]);
const constant = (values) => Array.isArray(values) && values.length > 0 && values.every((value) => Number.isFinite(value) && value === values[0]);
// A name that already says what the series is needs no "(assumed)" or "(reference)" after it.
const SAYS = Object.freeze({ assumed: /assum|forecast|project|scenario|estimate|plan\b|outlook/i, reference: /reference|target|threshold|standard|limit|floor|ceiling|\bcap\b|test|benchmark|covenant|required/i });

/** What a series says of itself, checked: `{ state, from }`, `from` the index of the first assumed category (0 for a series assumed throughout, -1 for none). */
export function seriesState(item, categories = []) {
  const state = item?.state ?? (item?.assumedFrom !== undefined ? "assumed" : "recorded");
  if (!SERIES_STATES.includes(state)) throw new Error(`series "${item?.name ?? ""}": \`state\` is one of ${SERIES_STATES.map((name) => `"${name}"`).join(", ")}`);
  if (item?.assumedFrom === undefined) return { state, from: state === "assumed" ? 0 : -1 };
  const from = categories.map(String).indexOf(String(item.assumedFrom));
  if (state !== "assumed" || from < 0) throw new Error(`series "${item?.name ?? ""}": \`assumedFrom\` names the category its assumed run starts at${state !== "assumed" ? ", on a series whose `state` is \"assumed\" or left out" : ` (${categories.slice(0, 12).join(", ")})`}`);
  return { state, from };
}

/** A series' name as its key or end label prints it: with what it is, where the name does not say. A run assumed from part-way is said by its bracket, not its name. */
export function stateLabel(item, categories = []) {
  const { state, from } = seriesState(item, categories);
  return state === "recorded" || (state === "assumed" && from > 0) || SAYS[state].test(item.name) ? item.name : `${item.name} (${state})`;
}

/** Does any series of `props` say what it is: a chart that draws them all as recorded data needs none of this. */
export const statesSeries = (props) => Array.isArray(props?.series) && props.series.some((item) => item && typeof item === "object" && (item.state !== undefined || item.assumedFrom !== undefined));

/**
 * `props` with each constant reference series drawn as a reference line: taken
 * out of the series and set in `referenceLines`, named and valued. Null where
 * there is nothing to convert - no such series, a chart that draws no
 * reference lines, or no other series left to plot - and the series are then
 * drawn as the chart draws a reference kept among its series.
 */
export function referenceSeriesAsLines(props, draws = []) {
  if (!statesSeries(props) || !draws.includes("referenceLines")) return null;
  const categories = props.categories || [];
  const lines = props.series.filter((item) => seriesState(item, categories).state === "reference" && constant(item.values));
  const kept = props.series.filter((item) => !lines.includes(item));
  if (!lines.length || !kept.length) return null;
  const named = (item) => { const value = formatValue(item.values[0], props); return item.name.includes(value) ? item.name : `${item.name} ${value}`; };
  const { focusSeries, ...rest } = props;
  return { ...rest, series: kept, referenceLines: [...(props.referenceLines || []), ...lines.map((item) => ({ value: item.values[0], label: named(item), fromSeries: true }))],
    // What named a series by its place or its name follows the series that are left: a focus needs two of them, and one that is not now a line.
    ...(Array.isArray(props.colorIndices) ? { colorIndices: props.colorIndices.filter((_, at) => !lines.includes(props.series[at])) } : {}),
    ...(focusSeries !== undefined && kept.length > 1 && kept.some((item) => item.name === focusSeries) ? { focusSeries } : {}) };
}

/**
 * `props` with the turn from record to assumption bracketed above the plot:
 * where its series are assumed from one category on (`assumedFrom`) and the
 * chart says nothing of periods itself, the recorded run and the assumed run
 * are named over the axis, as the binding names them for a measure joined to
 * a scenario (bind.mjs). Null where there is nothing to bracket - no such
 * series, two series that turn at different categories, a chart that draws no
 * period bands, or one that already marks its periods or its forecast.
 */
export function assumedRunBracketed(props, draws = []) {
  if (!statesSeries(props) || !draws.includes("periods") || props.periods !== undefined || props.forecastFrom !== undefined) return null;
  const categories = (props.categories || []).map(String);
  const turns = [...new Set(props.series.filter((item) => item?.assumedFrom !== undefined).map((item) => categories.indexOf(String(item.assumedFrom))))];
  if (turns.length !== 1 || turns[0] <= 0) return null;
  return { ...props, periods: [{ from: categories[0], to: categories[turns[0] - 1], label: "Recorded" }, { from: categories[turns[0]], to: categories.at(-1), label: "Assumed" }] };
}
