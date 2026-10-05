// The wider chart catalogue: slope, lollipop, dumbbell, bullet, treemap, radar,
// box plot, stacked area and a sparkline grid. Every chart here is drawn as
// shapes (never a native chart), shares the plot frame, axes, legend and label
// helpers of chart-axes.mjs and the decorations of chart-decorations.mjs, and
// answers measureContent from its layout so a hug measurement responds to width.
import { ellipsePrimitive, linePrimitive, rectPrimitive, shapePrimitive, stableId, textPrimitive, token, onFill } from "./core.mjs";
import { formatValue } from "./value-format.mjs";
import { AXIS_LABEL, CHART_LABEL, FONT, GRID, INK, MIN_PLOT_HEIGHT, PRIMARY, SECONDARY, SERIES, axes, axisLabelWidth, chartFrame, fillStyle,
  labelBold, legendRowsFor, lineStyle, markWeight, numericBounds, textStyle, topLegend } from "./chart-axes.mjs";
import { withDecorations, withReferenceValues } from "./chart-decorations.mjs";
import { TOKENS } from "./core.mjs";
import { measureAt } from "./draw.mjs";
import { timePositions, spacedLabelIndices } from "./time-axis.mjs";

const ACCENT = token("color.accent");
const measure = (text, width, { bold = false, size = CHART_LABEL } = {}) => measureAt(text, width, { size, bold, font: FONT });
const norm = (frame, x, y) => [Number(((x - frame.x) / frame.width).toFixed(6)), Number(((y - frame.y) / frame.height).toFixed(6))];
const probe = (frame) => (Number.isFinite(frame.height) ? frame : { ...frame, height: 400 });
// Intrinsic heights answer a hug measurement from the width (a plot wants
// roughly a 16:9 share of its width; a row chart wants a row per category).
const aspectHeight = (frame, plot) => (plot.y - frame.y) + Math.round(frame.width * 0.55) + 40;
// Intrinsic row charts must be renderable without captions or a taller parent.
const rowsHeight = (frame, plot, n) => (plot.y - frame.y) + Math.max(MIN_PLOT_HEIGHT, n * Math.max(24, Math.min(72, Math.round(frame.width * 0.05)))) + 60;
const seriesOf = (props, min = 1, max = 6) => {
  const series = Array.isArray(props.series) ? props.series : [];
  const categories = props.categories || [];
  if (!categories.length || series.length < min || series.length > max || series.some((sr) => !Array.isArray(sr.values) || sr.values.length !== categories.length || sr.values.some((v) => !Number.isFinite(v)))) throw new Error(`Chart requires categories and ${min === max ? min : `${min} to ${max}`} series with one finite value per category`);
  return { series, categories };
};
const colorFor = (props, index) => SERIES[props.colorIndices?.[index] ?? index % SERIES.length];
const highlighted = (props, name) => props.focusSeries === name || (props.highlights || []).some((h) => h.series === name || h.category === name || h === name);
// A highlight (or a subject series) names a member the chart draws - a
// series, a row, a tile. One naming anything else lights nothing, so it is
// refused rather than passed.
function assertHighlighted(id, props, members, what) {
  if (props.focusSeries !== undefined && !members.includes(String(props.focusSeries))) throw new Error(`${id}: focusSeries names ${what} - "${props.focusSeries}" is not one of ${members.slice(0, 8).map((m) => `"${m}"`).join(", ")}`);
  for (const h of props.highlights || []) {
    const name = typeof h === "string" ? h : h?.series ?? h?.category;
    if (!members.includes(String(name))) throw new Error(`${id}: highlights name ${what} - "${name}" is not one of ${members.slice(0, 8).map((m) => `"${m}"`).join(", ")}`);
  }
}

/* ------------------------------------------------------------- slope */
// Two to four periods as columns, each series a line between them with its
// name and value at both ends; the focus series in the accent, the rest grey.
function slopeLayout(frameIn, props) {
  const frame = probe(frameIn);
  const { series, categories } = seriesOf(props, 1, 12);
  if (categories.length < 2 || categories.length > 4) throw new Error("Slope chart takes two to four periods");
  const labelWidth = Math.max(90, ...series.map((sr) => Math.ceil(measure(`${sr.name}  ${formatValue(sr.values.at(-1), props)}`, 220, { bold: true }).width) + 8));
  // Callouts take their bands above the plot, as on any chart.
  const plot = chartFrame(frame, { topInset: props.plotTopInset, leftInset: labelWidth, valueLabelInset: labelWidth, centerPlot: false, annotations: props.annotations });
  const bounds = numericBounds(withReferenceValues(series.flatMap((sr) => sr.values), props), { min: props.yMin, max: props.yMax, axis: "y", tight: true });
  return { series, categories, plot, bounds, labelWidth, height: aspectHeight(frame, plot) };
}
function slopeChart({ id, frame, props }) {
  const { series, categories, plot, bounds } = slopeLayout(frame, props);
  // A slope's lines are its series, so a highlight names one of them.
  assertHighlighted(id, props, series.map((sr) => sr.name), "the series a slope draws");
  const subjects = series.filter((sr) => highlighted(props, sr.name));
  const subject = series.length === 1 ? series[0] : subjects.length === 1 ? subjects[0] : null;
  // A callout points at one series in one period; with several lines and no
  // single subject, a period alone does not say which.
  for (const note of props.annotations || []) if (note && note.series === undefined && !subject)
    throw new Error(`${id}: a slope callout names the series it points at (\`series\`) as well as the period - "${note.category}" alone could be any of ${series.length} lines`);
  const xAt = (i) => plot.x + plot.width * i / (categories.length - 1);
  const yAt = (v) => plot.y + plot.height - (v - bounds.min) / bounds.span * plot.height;
  const nodes = [];
  categories.forEach((c, i) => {
    nodes.push(linePrimitive({ id: stableId(id, "column", c), role: "chart-gridline", x1: xAt(i), y1: plot.y, x2: xAt(i), y2: plot.y + plot.height, style: lineStyle(GRID, token("line.hairline")) }));
    nodes.push(textPrimitive({ id: stableId(id, "category", c), role: "category-label", frame: { x: xAt(i) - 60, y: plot.y + plot.height + 12, width: 120, height: 20 }, text: c, style: textStyle(AXIS_LABEL, INK, true, "center") }));
  });
  // End labels push apart when series finish close together.
  const place = (side) => {
    const rows = series.map((sr, si) => ({ si, y: yAt(side === "left" ? sr.values[0] : sr.values.at(-1)) - 10 })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < rows.length; i++) rows[i].y = Math.max(rows[i].y, rows[i - 1].y + 20);
    const overflow = rows.length ? rows.at(-1).y + 20 - (plot.y + plot.height) : 0;
    if (overflow > 0) for (const r of rows) r.y -= overflow;
    for (let i = rows.length - 2; i >= 0; i--) rows[i].y = Math.min(rows[i].y, rows[i + 1].y - 20);
    return new Map(rows.map((r) => [r.si, r.y]));
  };
  const left = place("left"), right = place("right");
  const pointMap = new Map();
  series.forEach((sr) => categories.forEach((c, i) => {
    const point = { x: xAt(i), y: yAt(sr.values[i]) };
    pointMap.set(`${sr.name}:${c}`, point);
    if (sr === subject) pointMap.set(`value:${c}`, point);
  }));
  series.forEach((sr, si) => {
    const focus = highlighted(props, sr.name) || (series.length === 1);
    const color = focus ? (series.length === 1 ? PRIMARY : ACCENT) : token("color.chartGrid");
    const width = focus ? token("line.standard") : token("line.hairline");
    for (let i = 1; i < categories.length; i++) nodes.push(linePrimitive({ id: stableId(id, "segment", sr.name, i), role: "chart-line", x1: xAt(i - 1), y1: yAt(sr.values[i - 1]), x2: xAt(i), y2: yAt(sr.values[i]), style: lineStyle(color, width), data: { series: sr.name, highlighted: focus } }));
    categories.forEach((c, i) => nodes.push(ellipsePrimitive({ id: stableId(id, "point", sr.name, c), role: "chart-mark", frame: { x: xAt(i) - 4, y: yAt(sr.values[i]) - 4, width: 8, height: 8 }, style: fillStyle(color), data: { series: sr.name, category: c, value: sr.values[i] } })));
    const ink = focus ? INK : SECONDARY;
    nodes.push(textPrimitive({ id: stableId(id, "start-label", sr.name), role: "data-label", frame: { x: frame.x, y: left.get(si), width: plot.x - 8 - frame.x, height: 20 }, text: `${sr.name}  ${formatValue(sr.values[0], props)}`, style: textStyle(CHART_LABEL, ink, focus && labelBold(), "right"), data: { series: sr.name } }));
    nodes.push(textPrimitive({ id: stableId(id, "end-label", sr.name), role: "data-label", frame: { x: plot.x + plot.width + 8, y: right.get(si), width: frame.x + frame.width - plot.x - plot.width - 8, height: 20 }, text: `${formatValue(sr.values.at(-1), props)}  ${sr.name}`, style: textStyle(CHART_LABEL, ink, focus && labelBold(), "left"), data: { series: sr.name } }));
  });
  // Callouts and reference lines are the shared chart decorations; the subject
  // series is already drawn in the accent above, so highlights are not drawn twice.
  return withDecorations(nodes, { id, plot, props: { ...props, highlights: [] }, pointMap, yScale: yAt, allowAnnotationRail: false });
}

/* ---------------------------------------------------------- lollipop */
// A ranked single series as thin stems with a dot at the value: the bar
// chart's quieter cousin for many categories.
function lollipopLayout(frameIn, props) {
  const frame = probe(frameIn);
  const { series, categories } = seriesOf(props, 1, 1);
  const labelWidth = Math.min(200, Math.max(72, ...categories.map((c) => Math.ceil(measure(c, 200).width) + 12)));
  const valueWidth = Math.max(40, ...series[0].values.map((v) => Math.ceil(measure(formatValue(v, props), 120, { bold: true }).width) + 12));
  // A negative value's label sits left of its dot, off the stem that runs back to zero, so the plot leaves it room there.
  const negative = series[0].values.some((v) => v < 0);
  const plot = chartFrame(frame, { topInset: props.plotTopInset, leftInset: labelWidth + 8 + (negative ? valueWidth + 4 : 0), valueLabelInset: valueWidth + 12, centerPlot: false });
  const bounds = numericBounds(series[0].values, { min: props.xMin, max: props.xMax, axis: "x", includeZero: true });
  const rowHeight = Math.min(72, (plot.height + 24) / categories.length);
  return { series, categories, plot, bounds, labelWidth, valueWidth, rowHeight, height: rowsHeight(frame, plot, categories.length) };
}
function lollipopChart({ id, frame, props }) {
  const { series, categories, plot, bounds, labelWidth, valueWidth, rowHeight } = lollipopLayout(frame, props);
  assertHighlighted(id, props, categories, "the members a lollipop ranks");
  const xAt = (v) => plot.x + (v - bounds.min) / bounds.span * plot.width;
  const zero = xAt(Math.max(bounds.min, Math.min(0, bounds.max)));
  const nodes = [linePrimitive({ id: stableId(id, "axis"), role: "chart-axis", x1: zero, y1: plot.y, x2: zero, y2: plot.y + rowHeight * categories.length, style: lineStyle(INK, token("line.hairline")) })];
  const pointMap = new Map(), categoryMap = new Map();
  categories.forEach((c, i) => {
    const v = series[0].values[i], y = plot.y + i * rowHeight + rowHeight / 2;
    pointMap.set(`value:${c}`, { x: xAt(v), y });
    pointMap.set(`${series[0].name}:${c}`, { x: xAt(v), y });
    categoryMap.set(c, { x: plot.x, y: y - rowHeight / 2, width: plot.width, height: rowHeight });
    const focus = highlighted(props, c);
    const color = focus ? ACCENT : PRIMARY;
    nodes.push(textPrimitive({ id: stableId(id, "category", c), role: "category-label", frame: { x: plot.x - labelWidth - 8, y: y - 10, width: labelWidth, height: 20 }, text: c, style: textStyle(AXIS_LABEL, INK, focus, "right") }));
    nodes.push(linePrimitive({ id: stableId(id, "stem", c), role: "chart-line", x1: zero, y1: y, x2: xAt(v), y2: y, style: lineStyle(color, token("line.standard")), data: { category: c, value: v } }));
    nodes.push(ellipsePrimitive({ id: stableId(id, "dot", c), role: "chart-mark", frame: { x: xAt(v) - 7, y: y - 7, width: 14, height: 14 }, style: fillStyle(color), data: { category: c, value: v, highlighted: focus } }));
    const label = v < 0
      ? { frame: { x: xAt(v) - 12 - valueWidth, y: y - 10, width: valueWidth, height: 20 }, align: "right" }
      : { frame: { x: xAt(v) + 12, y: y - 10, width: Math.max(20, frame.x + frame.width - xAt(v) - 12), height: 20 }, align: "left" };
    nodes.push(textPrimitive({ id: stableId(id, "value", c), role: "data-label", frame: label.frame, text: formatValue(v, props), style: textStyle(CHART_LABEL, INK, labelBold(), label.align), data: { category: c } }));
  });
  // Callouts and reference lines are the shared chart decorations; the subject
  // is already drawn in the accent above, so highlights are not drawn twice.
  return withDecorations(nodes, { id, plot, props: { ...props, highlights: [] }, pointMap, categoryMap, xScale: xAt, allowAnnotationRail: false });
}

/* ---------------------------------------------------------- dumbbell */
// Two states per category (before and after, two segments) as two dots
// joined by a bar, the change readable as the bar's length.
export function dumbbellLayout(frameIn, props) {
  const frame = probe(frameIn);
  const { series, categories } = seriesOf(props, 2, 2);
  const labelWidth = Math.min(200, Math.max(72, ...categories.map((c) => Math.ceil(measure(c, 200).width) + 12)));
  const valueWidth = Math.max(40, ...series.flatMap(s => s.values).map(value => Math.ceil(measure(formatValue(value, props), 1000, { bold: labelBold() }).width) + 2));
  // The value sits a dot's radius and 5px off its dot.
  const valueGutter = valueWidth + Math.round(14 * markWeight().dot) / 2 + 5;
  const plot = chartFrame(frame, { topInset: props.plotTopInset, topLegend: props.legend !== false ? legendRowsFor(series.map((s) => s.name), frame) : false, leftInset: labelWidth + 8 + valueGutter, valueLabelInset: valueGutter, centerPlot: false });
  const bounds = numericBounds(series.flatMap((s) => s.values), { min: props.xMin, max: props.xMax, axis: "x", includeZero: props.includeZero === true, tight: true });
  const rowHeight = Math.min(80, (plot.height + 24) / categories.length);
  return { series, categories, plot, bounds, labelWidth, valueWidth, valueGutter, rowHeight, height: rowsHeight(frame, plot, categories.length) };
}
export function dumbbellChart({ id, frame, props }) {
  const { series, categories, plot, bounds, labelWidth, valueWidth, valueGutter, rowHeight } = dumbbellLayout(frame, props);
  assertHighlighted(id, props, categories, "the rows a dumbbell draws");
  const xAt = (v) => plot.x + (v - bounds.min) / bounds.span * plot.width;
  const nodes = props.legend !== false ? topLegend({ id, frame, items: series.map((s, i) => ({ label: s.name, colorIndex: props.colorIndices?.[i] ?? i })), variant: "marker" }) : [];
  // Mark weight (chart-axes.mjs markWeight): the dots a quarter larger and the bar
  // between them a visible rule rather than a grid-grey hairline, so a change
  // of two ranks still shows as a bar; alternate rows on a muted band carry
  // the eye from a label across the empty half of the plot to its dots.
  const weight = markWeight(), dot = Math.round(14 * weight.dot), r = dot / 2;
  const pointMap = new Map(), categoryMap = new Map();
  categories.forEach((c, i) => {
    const y = plot.y + i * rowHeight + rowHeight / 2, a = series[0].values[i], b = series[1].values[i];
    // A callout names a state by its series; naming the category alone, it
    // points at the later state, where the change arrives.
    pointMap.set(`${series[0].name}:${c}`, { x: xAt(a), y });
    pointMap.set(`${series[1].name}:${c}`, { x: xAt(b), y });
    pointMap.set(`value:${c}`, { x: xAt(b), y });
    categoryMap.set(c, { x: plot.x, y: y - rowHeight / 2, width: plot.width, height: rowHeight });
    if (weight.bands && i % 2 === 0) {
      const left = plot.x - labelWidth - 8 - valueGutter, band = Math.min(rowHeight - 2, Math.max(dot + 8, rowHeight * 0.8));
      nodes.push(rectPrimitive({ id: stableId(id, "row-band", c), role: "chart-row-band", frame: { x: left, y: y - band / 2, width: plot.x + plot.width + valueGutter - left, height: band }, style: fillStyle(token("color.surfaceMuted")), data: { category: c } }));
    }
    // The subject's row (`highlights: [{ category }]`): its name set bold and
    // the change between its states drawn in the accent.
    const focus = (props.highlights || []).some((h) => h?.category === c || h === c);
    nodes.push(textPrimitive({ id: stableId(id, "category", c), role: "category-label", frame: { x: plot.x - labelWidth - 8 - valueGutter, y: y - 10, width: labelWidth, height: 20 }, text: c, style: textStyle(AXIS_LABEL, INK, focus, "right"), data: { category: c } }));
    nodes.push(linePrimitive({ id: stableId(id, "bar", c), role: "chart-line", x1: xAt(a), y1: y, x2: xAt(b), y2: y, style: lineStyle(focus ? ACCENT : weight.bands ? token("color.rule") : GRID, weight.connector), data: { category: c, ...(focus ? { highlighted: true } : {}) } }));
    [a, b].forEach((v, si) => {
      nodes.push(ellipsePrimitive({ id: stableId(id, "dot", c, series[si].name), role: "chart-mark", frame: { x: xAt(v) - r, y: y - r, width: dot, height: dot }, style: fillStyle(colorFor(props, si)), data: { category: c, series: series[si].name, value: v, ...(focus ? { highlighted: true } : {}) } }));
      const leftMost = si === (a <= b ? 0 : 1);
      nodes.push(textPrimitive({ id: stableId(id, "value", c, series[si].name), role: "data-label", frame: { x: leftMost ? xAt(v) - r - 5 - valueWidth : xAt(v) + r + 5, y: y - 10, width: valueWidth, height: 20 }, text: formatValue(v, props), style: textStyle(CHART_LABEL, INK, labelBold(), leftMost ? "right" : "left"), data: { category: c, series: series[si].name } }));
    });
  });
  // Callouts and reference lines are the shared chart decorations (chart-decorations.mjs):
  // authored on a dumbbell they were dropped unseen. The subject's row is drawn
  // above, so highlights are not drawn twice.
  return withDecorations(nodes, { id, plot, props: { ...props, highlights: [] }, pointMap, categoryMap, xScale: xAt, allowAnnotationRail: false });
}

/* ------------------------------------------------------------ bullet */
// Actual against target on a graded background band per row: the KPI
// scorecard chart. `targets` one per category; optional `ranges` [[poor, ok, good]].
export function bulletLayout(frameIn, props) {
  const frame = probe(frameIn);
  const { series, categories } = seriesOf(props, 1, 1);
  const targets = props.targets || [];
  if (targets.length !== categories.length || targets.some((t) => !Number.isFinite(t))) throw new Error("Bullet chart requires one finite target per category");
  const ranges = props.ranges || [];
  if (ranges.length && (ranges.length !== categories.length || ranges.some((r) => !Array.isArray(r) || r.length !== 3))) throw new Error("Bullet ranges are [poor, ok, good] per category");
  const labelWidth = Math.min(200, Math.max(72, ...categories.map((c) => Math.ceil(measure(c, 200).width) + 12)));
  const plot = chartFrame(frame, { topInset: props.plotTopInset, leftInset: labelWidth + 8, valueLabelInset: 64, centerPlot: false });
  const all = [...series[0].values, ...targets, ...ranges.flat()];
  const bounds = numericBounds(all, { min: props.xMin ?? 0, max: props.xMax, axis: "x", includeZero: true });
  const rowHeight = Math.min(96, (plot.height + 24) / categories.length);
  return { series, categories, targets, ranges, plot, bounds, labelWidth, rowHeight, height: rowsHeight(frame, plot, categories.length) };
}
function bulletChart({ id, frame, props }) {
  const { series, categories, targets, ranges, plot, bounds, labelWidth, rowHeight } = bulletLayout(frame, props);
  const xAt = (v) => plot.x + (v - bounds.min) / bounds.span * plot.width;
  const nodes = [];
  const bandShades = [token("color.surfaceMuted"), token("color.chartGrid"), token("color.chartSeries6")];
  categories.forEach((c, i) => {
    const y = plot.y + i * rowHeight, band = Math.max(14, rowHeight * 0.6), y0 = y + (rowHeight - band) / 2;
    const v = series[0].values[i], t = targets[i];
    nodes.push(textPrimitive({ id: stableId(id, "category", c), role: "category-label", frame: { x: plot.x - labelWidth - 8, y: y + rowHeight / 2 - 10, width: labelWidth, height: 20 }, text: c, style: textStyle(AXIS_LABEL, INK, false, "right") }));
    const stops = ranges.length ? ranges[i] : [bounds.max];
    let from = bounds.min;
    stops.forEach((stop, k) => {
      nodes.push(rectPrimitive({ id: stableId(id, "band", c, k), role: "chart-band", frame: { x: xAt(from), y: y0, width: Math.max(0, xAt(Math.min(stop, bounds.max)) - xAt(from)), height: band }, style: fillStyle(bandShades[Math.min(k, 2)]), data: { category: c, band: k } }));
      from = Math.min(stop, bounds.max);
    });
    const met = v >= t;
    nodes.push(rectPrimitive({ id: stableId(id, "measure", c), role: "chart-mark", frame: { x: xAt(bounds.min), y: y0 + band * 0.3, width: Math.max(0, xAt(v) - xAt(bounds.min)), height: band * 0.4 }, style: fillStyle(met ? PRIMARY : INK), data: { category: c, value: v, target: t, met } }));
    nodes.push(linePrimitive({ id: stableId(id, "target", c), role: "chart-reference-line", x1: xAt(t), y1: y0 - 3, x2: xAt(t), y2: y0 + band + 3, style: lineStyle(ACCENT, token("line.standard")), data: { category: c, target: t } }));
    nodes.push(textPrimitive({ id: stableId(id, "value", c), role: "data-label", frame: { x: xAt(Math.max(v, t)) + 10, y: y + rowHeight / 2 - 10, width: Math.max(20, frame.x + frame.width - xAt(Math.max(v, t)) - 10), height: 20 }, text: `${formatValue(v, props)} / ${formatValue(t, props)}`, style: textStyle(CHART_LABEL, INK, labelBold(), "left"), data: { category: c } }));
  });
  return nodes;
}

/* ----------------------------------------------------------- treemap */
// Squarified tiles for a part-to-whole with many parts; the largest tile in
// the primary, the rest in the series colours or shades by rank.
function squarify(items, frame) {
  const total = items.reduce((s, it) => s + it.value, 0);
  const rects = [];
  let x = frame.x, y = frame.y, w = frame.width, h = frame.height;
  let remaining = items.slice(), area = w * h;
  while (remaining.length) {
    const scale = area / remaining.reduce((s, it) => s + it.value, 0);
    const horizontal = w >= h;
    const side = horizontal ? h : w;
    let row = [], best = Infinity;
    for (const it of remaining) {
      const trial = [...row, it];
      const sum = trial.reduce((s, t) => s + t.value * scale, 0);
      const thickness = sum / side;
      const worst = Math.max(...trial.map((t) => { const len = t.value * scale / thickness; return Math.max(len / thickness, thickness / len); }));
      if (worst <= best) { row = trial; best = worst; } else break;
    }
    const sum = row.reduce((s, t) => s + t.value * scale, 0), thickness = sum / side;
    let offset = 0;
    for (const it of row) {
      const len = it.value * scale / thickness;
      rects.push({ item: it, frame: horizontal ? { x, y: y + offset, width: thickness, height: len } : { x: x + offset, y, width: len, height: thickness } });
      offset += len;
    }
    if (horizontal) { x += thickness; w -= thickness; } else { y += thickness; h -= thickness; }
    remaining = remaining.slice(row.length);
    area = w * h;
  }
  return rects;
}
// A measurement that answers "does not fit" instead of throwing: one word
// wider than a small tile ("Telecommunications" in a 90px tile) is a tile
// that takes the key, not a chart that fails.
const measureIfFits = (text, width, options) => {
  try { return measure(text, width, options); } catch (error) { if (/Unbreakable/.test(error.message)) return null; throw error; }
};
// What a tile can show: its name and value (two blocks), its name alone, or
// nothing - in which case it takes a number and its entry in the key below.
function tileText(item, tile, total, props) {
  const label = measureIfFits(item.label, Math.max(10, tile.width - 12), { bold: true });
  const value = `${formatValue(item.value, props)} (${Math.round(100 * item.value / total)}%)`;
  const valueLayout = measureIfFits(value, Math.max(10, tile.width - 12));
  if (label && valueLayout && tile.width >= label.width + 12 && tile.height >= label.height + valueLayout.height + 12) return { label, valueLayout };
  if (label && tile.width >= label.width + 12 && tile.height >= label.height + 12) return { label, valueLayout: null };
  return null;
}
const tileOf = (r) => ({ x: r.x + 1, y: r.y + 1, width: Math.max(0, r.width - 2), height: Math.max(0, r.height - 2) });
const keyEntry = (number, item, total, props) => `${number} ${item.label} ${formatValue(item.value, props)} (${Math.round(100 * item.value / total)}%)`;
function treemapLayout(frameIn, props) {
  const frame = probe(frameIn);
  const items = (props.items || []).map((it) => ({ label: it?.label, value: Number(it?.value) }));
  if (items.length < 2 || items.length > 20 || items.some((it) => typeof it.label !== "string" || !it.label.trim() || !(it.value > 0))) throw new Error("Treemap takes two to twenty items with a label and a positive value");
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, it) => sum + it.value, 0);
  const plot = chartFrame(frame, { topInset: props.plotTopInset, leftInset: 0, valueLabelInset: 0, centerPlot: false });
  // Tiles too small for their name are numbered and named in a key under the
  // map; the key's height comes out of the map, which can only make more tiles
  // small, so the split is settled over a few passes.
  let keyed = [], key = null, body = null, rects = null;
  for (let pass = 0; pass < 4; pass += 1) {
    const keyHeight = key ? key.height + 8 : 0;
    body = { x: plot.x, y: plot.y, width: plot.width, height: plot.height + 40 - keyHeight };
    rects = squarify(sorted, body);
    const next = rects.filter(({ item, frame: r }) => !tileText(item, tileOf(r), total, props)).map(({ item }) => item);
    const nextKey = next.length ? measure(next.map((item, index) => keyEntry(index + 1, item, total, props)).join("  ·  "), plot.width) : null;
    const settled = next.length === keyed.length && next.every((item, index) => item === keyed[index]);
    keyed = next; key = nextKey;
    if (settled) break;
  }
  return { items: sorted, plot, body, rects, keyed, key, height: aspectHeight(frame, plot) };
}
function treemapChart({ id, frame, props, tokens = TOKENS }) {
  const { items, rects, keyed, key, body } = treemapLayout(frame, props);
  assertHighlighted(id, props, items.map((item) => item.label), "the tiles a treemap draws");
  const total = items.reduce((s, it) => s + it.value, 0);
  const hasFocus = items.some(item => highlighted(props, item.label));
  const nodes = [];
  rects.forEach(({ item, frame: r }, index) => {
    const fill = highlighted(props, item.label) ? ACCENT : hasFocus ? token("color.chartComparator") : colorFor(props, Math.min(index, 5));
    const tile = tileOf(r);
    nodes.push(rectPrimitive({ id: stableId(id, "tile", item.label), role: "chart-mark", frame: tile, style: fillStyle(fill, token("color.surface")), data: { label: item.label, value: item.value, share: item.value / total } }));
    const color = onFill(fill);
    const text = tileText(item, tile, total, props);
    if (text) {
      const { label, valueLayout } = text;
      nodes.push(textPrimitive({ id: stableId(id, "label", item.label), role: "data-label", frame: { x: tile.x + 6, y: tile.y + 6, width: tile.width - 12, height: label.height }, text: label.text, style: { ...textStyle(CHART_LABEL, color, true, "left"), valign: "top", lineHeight: label.lineHeight, wrap: false }, data: { label: item.label, textLayout: label } }));
      if (valueLayout) nodes.push(textPrimitive({ id: stableId(id, "value", item.label), role: "data-label", frame: { x: tile.x + 6, y: tile.y + 6 + label.height + 2, width: tile.width - 12, height: valueLayout.height }, text: valueLayout.text, style: { ...textStyle(CHART_LABEL, color, false, "left"), valign: "top", lineHeight: valueLayout.lineHeight, wrap: false }, data: { label: item.label, textLayout: valueLayout } }));
      return;
    }
    // A keyed tile carries its number when the tile can hold it.
    const number = keyed.indexOf(item) + 1;
    const numeral = measure(String(number), 100, { bold: true });
    if (tile.width >= numeral.width + 6 && tile.height >= numeral.height + 4) nodes.push(textPrimitive({ id: stableId(id, "key-number", item.label), role: "data-label", frame: { x: tile.x + (tile.width - numeral.width - 2) / 2, y: tile.y + (tile.height - numeral.height) / 2, width: numeral.width + 2, height: numeral.height }, text: String(number), style: { ...textStyle(CHART_LABEL, color, true, "center"), valign: "top", lineHeight: numeral.lineHeight, wrap: false }, data: { label: item.label, keyNumber: number, textLayout: numeral } }));
  });
  if (key) nodes.push(textPrimitive({ id: stableId(id, "key"), role: "chart-annotation", frame: { x: body.x, y: body.y + body.height + 8, width: body.width, height: key.height }, text: key.text, style: { ...textStyle(CHART_LABEL, SECONDARY, false, "left"), valign: "top", lineHeight: key.lineHeight, wrap: false }, data: { keyedItems: keyed.map(item => item.label), textLayout: key } }));
  return nodes;
}

/* ------------------------------------------------------------- radar */
// Three to eight axes from a centre, one polygon per series; the focus
// series filled, comparators outlined.
function radarLayout(frameIn, props) {
  const frame = probe(frameIn);
  const { series, categories } = seriesOf(props, 1, 4);
  if (categories.length < 3 || categories.length > 8) throw new Error("Radar chart takes three to eight axes");
  const plot = chartFrame(frame, { topInset: props.plotTopInset, topLegend: props.legend !== false && series.length > 1 ? legendRowsFor(series.map((s) => s.name), frame) : false, leftInset: 0, valueLabelInset: 0, centerPlot: false });
  const radius = Math.max(40, Math.min(plot.width, plot.height + 40) / 2 - 30);
  const max = props.max ?? Math.max(...series.flatMap((s) => s.values));
  return { series, categories, plot, radius, max, centre: { x: plot.x + plot.width / 2, y: plot.y + plot.height / 2 }, height: aspectHeight(frame, plot) };
}
function radarChart({ id, frame, props }) {
  const { series, categories, plot, radius, max, centre } = radarLayout(frame, props);
  assertHighlighted(id, props, series.map((sr) => sr.name), "the players a radar draws");
  const angle = (i) => -Math.PI / 2 + 2 * Math.PI * i / categories.length;
  const at = (i, r) => ({ x: centre.x + r * Math.cos(angle(i)), y: centre.y + r * Math.sin(angle(i)) });
  const nodes = props.legend !== false && series.length > 1 ? topLegend({ id, frame, items: series.map((s, i) => ({ label: s.name, colorIndex: props.colorIndices?.[i] ?? i })), variant: "line" }) : [];
  for (const ring of [0.25, 0.5, 0.75, 1]) {
    const pts = categories.map((_, i) => at(i, radius * ring));
    nodes.push(shapePrimitive({ id: stableId(id, "ring", ring), role: "chart-gridline", geometry: "customPolygon", frame: { x: plot.x, y: plot.y, width: plot.width, height: plot.height }, style: { fill: "none", stroke: GRID, lineWidth: token("line.hairline") }, data: { paths: [pts.map((p) => norm(plot, p.x, p.y))] } }));
  }
  categories.forEach((c, i) => {
    const end = at(i, radius), label = at(i, radius + 20);
    nodes.push(linePrimitive({ id: stableId(id, "axis", c), role: "chart-gridline", x1: centre.x, y1: centre.y, x2: end.x, y2: end.y, style: lineStyle(GRID, token("line.hairline")) }));
    const align = Math.abs(Math.cos(angle(i))) < 0.2 ? "center" : Math.cos(angle(i)) > 0 ? "left" : "right";
    nodes.push(textPrimitive({ id: stableId(id, "category", c), role: "category-label", frame: { x: align === "center" ? label.x - 60 : align === "left" ? label.x : label.x - 120, y: label.y - 10, width: 120, height: 20 }, text: c, style: textStyle(AXIS_LABEL, INK, false, align) }));
  });
  series.forEach((sr, si) => {
    const focus = highlighted(props, sr.name) || series.length === 1;
    const color = colorFor(props, si);
    const pts = sr.values.map((v, i) => at(i, radius * Math.max(0, Math.min(1, v / max))));
    nodes.push(shapePrimitive({ id: stableId(id, "polygon", sr.name), role: "chart-area", geometry: "customPolygon", frame: { x: plot.x, y: plot.y, width: plot.width, height: plot.height }, style: { fill: focus ? color : "none", stroke: color, lineWidth: token("line.standard"), ...(focus ? { opacity: 0.25 } : {}) }, data: { paths: [pts.map((p) => norm(plot, p.x, p.y))], series: sr.name } }));
    pts.forEach((p, i) => nodes.push(ellipsePrimitive({ id: stableId(id, "point", sr.name, categories[i]), role: "chart-mark", frame: { x: p.x - 4, y: p.y - 4, width: 8, height: 8 }, style: fillStyle(color), data: { series: sr.name, category: categories[i], value: sr.values[i] } })));
  });
  return nodes;
}

/* ---------------------------------------------------------- box plot */
// Distributions per category: `boxes: [{ min, q1, median, q3, max }]`.
function boxPlotLayout(frameIn, props) {
  const frame = probe(frameIn);
  const categories = props.categories || [], boxes = props.boxes || [];
  if (!categories.length || boxes.length !== categories.length || boxes.some((b) => !b || ["min", "q1", "median", "q3", "max"].some((k) => !Number.isFinite(b[k])) || !(b.min <= b.q1 && b.q1 <= b.median && b.median <= b.q3 && b.q3 <= b.max))) throw new Error("Box plot requires one ordered { min, q1, median, q3, max } per category");
  const bounds = numericBounds(boxes.flatMap((b) => [b.min, b.max]), { min: props.yMin, max: props.yMax, axis: "y" });
  const labelWidth = axisLabelWidth(bounds);
  const plot = chartFrame(frame, { topInset: props.plotTopInset, leftInset: Math.max(labelWidth + 8, 54), valueLabelInset: 0, centerPlot: false });
  return { categories, boxes, bounds, labelWidth, plot, height: aspectHeight(frame, plot) };
}
function boxPlotChart({ id, frame, props }) {
  const { categories, boxes, bounds, labelWidth, plot } = boxPlotLayout(frame, props);
  assertHighlighted(id, props, categories, "the members a box plot draws");
  const yAt = (v) => plot.y + plot.height - (v - bounds.min) / bounds.span * plot.height;
  const slot = plot.width / categories.length, boxW = Math.min(60, slot * 0.5);
  const nodes = [...axes(id, plot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true, showValueAxis: true, labelWidth })];
  categories.forEach((c, i) => {
    const b = boxes[i], cx = plot.x + slot * i + slot / 2, focus = highlighted(props, c);
    const color = focus ? ACCENT : PRIMARY;
    nodes.push(linePrimitive({ id: stableId(id, "whisker", c), role: "chart-line", x1: cx, y1: yAt(b.max), x2: cx, y2: yAt(b.min), style: lineStyle(INK, token("line.hairline")), data: { category: c } }));
    for (const [k, v] of [["cap-max", b.max], ["cap-min", b.min]]) nodes.push(linePrimitive({ id: stableId(id, k, c), role: "chart-line", x1: cx - boxW / 4, y1: yAt(v), x2: cx + boxW / 4, y2: yAt(v), style: lineStyle(INK, token("line.hairline")) }));
    nodes.push(rectPrimitive({ id: stableId(id, "box", c), role: "chart-mark", frame: { x: cx - boxW / 2, y: yAt(b.q3), width: boxW, height: Math.max(1, yAt(b.q1) - yAt(b.q3)) }, style: fillStyle(color, token("color.surface")), data: { category: c, ...b } }));
    nodes.push(linePrimitive({ id: stableId(id, "median", c), role: "chart-line", x1: cx - boxW / 2, y1: yAt(b.median), x2: cx + boxW / 2, y2: yAt(b.median), style: lineStyle(token("color.onPrimary"), token("line.standard")), data: { category: c, median: b.median } }));
    nodes.push(textPrimitive({ id: stableId(id, "median-label", c), role: "data-label", frame: { x: cx + boxW / 2 + 4, y: yAt(b.median) - 10, width: 60, height: 20 }, text: formatValue(b.median, props), style: textStyle(CHART_LABEL, INK, labelBold(), "left"), data: { category: c } }));
    nodes.push(textPrimitive({ id: stableId(id, "category", c), role: "category-label", frame: { x: cx - slot / 2 + 4, y: plot.y + plot.height + 12, width: slot - 8, height: 20 }, text: c, style: textStyle(AXIS_LABEL, INK, false, "center") }));
  });
  return nodes;
}

/* ------------------------------------------------------ stacked area */
// Cumulative areas from the baseline, full fills in series order, the last
// category's segment values at the right.
function stackedAreaLayout(frameIn, props) {
  const frame = probe(frameIn);
  const { series, categories } = seriesOf(props, 2, 6);
  if (series.some((s) => s.values.some((v) => v < 0))) throw new Error("Stacked area takes non-negative values");
  const totals = categories.map((_, i) => series.reduce((s, sr) => s + sr.values[i], 0));
  const bounds = numericBounds([0, ...totals], { min: 0, max: props.yMax, axis: "y" });
  const labelWidth = axisLabelWidth(bounds);
  // Callouts take their bands above the plot, as on any chart.
  const plot = chartFrame(frame, { topInset: props.plotTopInset, topLegend: props.legend !== false ? legendRowsFor(series.map((s) => s.name), frame) : false, leftInset: Math.max(labelWidth + 8, 54), valueLabelInset: 70, centerPlot: false, annotations: props.annotations });
  return { series, categories, totals, bounds, labelWidth, plot, height: aspectHeight(frame, plot) };
}
function stackedAreaChart({ id, frame, props }) {
  // Opaque layers fill the plot from the baseline: a reference line drawn
  // behind them shows only above the stack, and its label sits on the fills.
  if ((props.referenceLines || []).length) throw new Error(`${id}: a stacked area's layers fill the plot and would hide a reference line behind them - state the level in a callout at the period the total reaches it, or draw the total as a line chart with its reference line`);
  const { series, categories, totals, bounds, labelWidth, plot } = stackedAreaLayout(frame, props);
  // Uneven dated observations sit where they fall in time (time-axis.mjs), and
  // only the labels whose 80px slots clear their neighbours' are set.
  const spacing = timePositions(categories);
  const xAt = (i) => plot.x + plot.width * (spacing ? spacing[i] : i / Math.max(1, categories.length - 1));
  const labelled = spacing ? spacedLabelIndices(categories.map((_, i) => xAt(i)), 84) : categories.map((_, i) => i);
  const yAt = (v) => plot.y + plot.height - (v - bounds.min) / bounds.span * plot.height;
  const nodes = [
    ...(props.legend !== false ? topLegend({ id, frame, items: series.map((s, i) => ({ label: s.name, colorIndex: props.colorIndices?.[i] ?? i })) }) : []),
    ...axes(id, plot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true, showValueAxis: true, labelWidth }),
  ];
  const cumulative = categories.map(() => 0);
  const layers = series.map((sr) => {
    const lower = [...cumulative];
    sr.values.forEach((v, i) => { cumulative[i] += v; });
    return { sr, lower, upper: [...cumulative] };
  });
  layers.forEach(({ sr, lower, upper }, si) => {
    const top = upper.map((v, i) => norm(plot, xAt(i), yAt(v)));
    const bottom = lower.map((v, i) => norm(plot, xAt(i), yAt(v))).reverse();
    nodes.push(shapePrimitive({ id: stableId(id, "layer", sr.name), role: "chart-area", geometry: "customPolygon", frame: { x: plot.x, y: plot.y, width: plot.width, height: plot.height }, style: { fill: colorFor(props, si), stroke: token("color.surface"), lineWidth: token("line.hairline") }, data: { paths: [[...top, ...bottom]], series: sr.name } }));
    const last = categories.length - 1, mid = (upper[last] + lower[last]) / 2;
    if (upper[last] - lower[last] > 0) nodes.push(textPrimitive({ id: stableId(id, "end-label", sr.name), role: "data-label", frame: { x: plot.x + plot.width + 6, y: yAt(mid) - 10, width: 64, height: 20 }, text: formatValue(sr.values[last], props), style: textStyle(CHART_LABEL, INK, labelBold(), "left"), data: { series: sr.name } }));
  });
  categories.forEach((c, i) => labelled.includes(i) && nodes.push(textPrimitive({ id: stableId(id, "category", c), role: "category-label", frame: { x: xAt(i) - 40, y: plot.y + plot.height + 12, width: 80, height: 20 }, text: c, style: textStyle(AXIS_LABEL, INK, false, "center") })));
  // A callout names a period and, for one band, its series: it points at the
  // middle of that band there; without a series, at the top of the stack -
  // the period's total.
  const pointMap = new Map();
  categories.forEach((c, i) => {
    pointMap.set(`value:${c}`, { x: xAt(i), y: yAt(totals[i]) });
    layers.forEach(({ sr, lower, upper }) => pointMap.set(`${sr.name}:${c}`, { x: xAt(i), y: yAt((lower[i] + upper[i]) / 2) }));
  });
  return withDecorations(nodes, { id, plot, props, pointMap, yScale: yAt, allowAnnotationRail: false });
}

/* --------------------------------------------------------- sparklines */
// A grid of small lines, one per item, each with its label and last value:
// the scenario matrix and the KPI dashboard row.
function sparklinesLayout(frameIn, props) {
  const frame = probe(frameIn);
  const items = props.items || [];
  if (items.length < 2 || items.length > 12 || items.some((it) => typeof it?.label !== "string" || !it.label.trim() || !Array.isArray(it.values) || it.values.length < 2 || it.values.some((v) => !Number.isFinite(v)))) throw new Error("Sparklines take two to twelve items with a label and at least two values");
  const columns = props.columns || (items.length <= 4 ? items.length : items.length <= 6 ? 3 : 4);
  const rows = Math.ceil(items.length / columns);
  const plot = chartFrame(frame, { topInset: props.plotTopInset, leftInset: 0, valueLabelInset: 0, centerPlot: false });
  const cellW = plot.width / columns, cellH = Math.min(220, (plot.height + 40) / rows);
  return { items, columns, rows, plot, cellW, cellH, height: (plot.y - frame.y) + rows * Math.max(80, Math.min(220, Math.round(frame.width / columns * 0.55))) };
}
function sparklinesChart({ id, frame, props }) {
  const { items, columns, plot, cellW, cellH } = sparklinesLayout(frame, props);
  assertHighlighted(id, props, items.map((item) => item.label), "the items a small multiple draws");
  const nodes = [];
  const shared = props.sharedScale === true ? numericBounds(items.flatMap((it) => it.values), { axis: "y", tight: true }) : null;
  items.forEach((it, index) => {
    const col = index % columns, row = Math.floor(index / columns);
    const cell = { x: plot.x + col * cellW, y: plot.y + row * cellH, width: cellW, height: cellH };
    const inner = { x: cell.x + 8, y: cell.y + 28, width: cell.width - 16 - 48, height: cell.height - 48 };
    const bounds = shared || numericBounds(it.values, { axis: "y", tight: true });
    const xAt = (i) => inner.x + inner.width * i / (it.values.length - 1);
    const yAt = (v) => inner.y + inner.height - (v - bounds.min) / bounds.span * inner.height;
    const focus = highlighted(props, it.label);
    const color = focus ? ACCENT : PRIMARY;
    nodes.push(textPrimitive({ id: stableId(id, "label", it.label), role: "category-label", frame: { x: cell.x + 8, y: cell.y + 6, width: cell.width - 16, height: 18 }, text: it.label, style: textStyle(AXIS_LABEL, INK, true, "left") }));
    nodes.push(linePrimitive({ id: stableId(id, "baseline", it.label), role: "chart-gridline", x1: inner.x, y1: inner.y + inner.height, x2: inner.x + inner.width, y2: inner.y + inner.height, style: lineStyle(GRID, token("line.hairline")) }));
    for (let i = 1; i < it.values.length; i++) nodes.push(linePrimitive({ id: stableId(id, "segment", it.label, i), role: "chart-line", x1: xAt(i - 1), y1: yAt(it.values[i - 1]), x2: xAt(i), y2: yAt(it.values[i]), style: lineStyle(color, token("line.standard")), data: { item: it.label } }));
    const last = it.values.at(-1);
    nodes.push(ellipsePrimitive({ id: stableId(id, "end", it.label), role: "chart-mark", frame: { x: xAt(it.values.length - 1) - 4, y: yAt(last) - 4, width: 8, height: 8 }, style: fillStyle(color), data: { item: it.label, value: last } }));
    nodes.push(textPrimitive({ id: stableId(id, "value", it.label), role: "data-label", frame: { x: inner.x + inner.width + 6, y: yAt(last) - 10, width: 44, height: 20 }, text: formatValue(last, props), style: textStyle(CHART_LABEL, INK, labelBold(), "left"), data: { item: it.label } }));
    if (it.note) nodes.push(textPrimitive({ id: stableId(id, "note", it.label), role: "chart-annotation", frame: { x: cell.x + 8, y: cell.y + cell.height - 18, width: cell.width - 16, height: 16 }, text: it.note, style: textStyle(CHART_LABEL, SECONDARY, false, "left") }));
  });
  return nodes;
}

export const EXTRA_CHARTS = [
  { id: "chart.slope", render: slopeChart, layout: slopeLayout, draws: ["annotations", "referenceLines", "highlights", "focusSeries"], sample: { heading: "(Insert measure and population)", categories: ["2019", "2024"], series: [{ name: "Retail", values: [42, 51] }, { name: "Corporate", values: [30, 28] }, { name: "Wealth", values: [12, 21] }], focusSeries: "Wealth", unit: "$B" } },
  { id: "chart.lollipop", render: lollipopChart, layout: lollipopLayout, draws: ["annotations", "referenceLines", "highlights"], refuses: ["annotationRail"], sample: { heading: "(Insert measure and population)", categories: ["Portland", "Washington", "San Francisco", "Seattle", "Boston", "Denver"], series: [{ name: "Share", values: [5.2, 4.0, 3.8, 3.7, 2.5, 2.4] }], highlights: [{ category: "Washington" }], unit: "%" } },
  { id: "chart.dumbbell", render: dumbbellChart, layout: dumbbellLayout, draws: ["annotations", "referenceLines", "highlights"], refuses: ["annotationRail"], sample: { heading: "(Insert measure and population)", categories: ["Healthcare", "Manufacturing", "Energy", "Consumer", "IT"], series: [{ name: "2022", values: [1.8, 3.2, 2.3, 5.2, 6.3] }, { name: "2023", values: [5.5, 3.9, 3.1, 4.4, 2.2] }], unit: "$B" } },
  { id: "chart.bullet", render: bulletChart, layout: bulletLayout, draws: [], sample: { heading: "(Insert measure and population)", categories: ["Revenue", "Margin", "NPS", "Churn"], series: [{ name: "Actual", values: [82, 61, 44, 70] }], targets: [90, 55, 50, 60], ranges: [[50, 75, 100], [40, 60, 100], [30, 45, 100], [50, 80, 100]], unit: "% of plan" } },
  { id: "chart.treemap", render: treemapChart, layout: treemapLayout, draws: ["highlights"], sample: { heading: "(Insert measure and population)", items: [{ label: "Retail", value: 60 }, { label: "Corporate", value: 55 }, { label: "Markets", value: 30 }, { label: "Wealth", value: 22 }, { label: "Payments", value: 18 }, { label: "Other", value: 9 }], unit: "$B" } },
  { id: "chart.radar", render: radarChart, layout: radarLayout, draws: ["highlights", "focusSeries"], sample: { heading: "(Insert measure and population)", categories: ["Scale", "Cost", "Speed", "Quality", "Talent", "Data"], series: [{ name: "Us", values: [4, 3, 5, 4, 2, 3] }, { name: "Best peer", values: [5, 4, 3, 5, 4, 4] }], focusSeries: "Us", max: 5 } },
  { id: "chart.boxplot", render: boxPlotChart, layout: boxPlotLayout, draws: ["highlights"], sample: { heading: "(Insert measure and population)", categories: ["Retail", "Tech", "Energy", "Health"], boxes: [{ min: -40, q1: -12, median: -2, q3: 8, max: 30 }, { min: -55, q1: -25, median: -10, q3: 4, max: 20 }, { min: -30, q1: -8, median: 3, q3: 14, max: 35 }, { min: -20, q1: -5, median: 5, q3: 12, max: 28 }], unit: "% TSR" } },
  { id: "chart.stacked-area", render: stackedAreaChart, layout: stackedAreaLayout, draws: ["annotations"], refuses: ["referenceLines"], sample: { heading: "(Insert measure and population)", categories: ["2020", "2021", "2022", "2023", "2024"], series: [{ name: "Mobility", values: [220, 600, 1400, 2400, 3800] }, { name: "Storage", values: [48, 90, 190, 300, 450] }, { name: "Electronics", values: [20, 40, 100, 150, 200] }], unit: "GWh" } },
  { id: "chart.sparklines", render: sparklinesChart, layout: sparklinesLayout, draws: ["highlights"], sample: { heading: "(Insert measure and population)", items: [{ label: "A1 Virus contained", values: [100, 92, 96, 101, 104] }, { label: "A2 Muted recovery", values: [100, 90, 92, 95, 99] }, { label: "A3 Resurgence", values: [100, 88, 84, 90, 94] }, { label: "B1 Slow growth", values: [100, 85, 86, 88, 90] }, { label: "B2 Prolonged", values: [100, 82, 78, 80, 84] }, { label: "B3 Depression", values: [100, 78, 70, 72, 74] }], columns: 3, highlights: [{ category: "A1 Virus contained" }], unit: "Real GDP, index" } },
];
