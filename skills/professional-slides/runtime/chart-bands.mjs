// Bands set behind a chart's marks, as strong decks shade what a chart is
// read against: a target range or a tolerance on the value axis, a run of
// categories - a recession on a line, the forecast years boxed, the quarters
// a policy ran - and, on a scatter, the cluster a page is about ringed.
//
//   bands: [{ from, to, label, style }]
//
// Numbers make a value band and category names a category band (`axis` says
// it outright: "value", "category", and on a scatter "x" or "y"). `style`
// "tint" (the default) fills the band in the muted surface; "box" draws it as
// a dashed outline, which reads as "these" without greying what it holds.
// A scatter takes `{ points: [names], label, style: "ellipse" }`: an ellipse
// round the named points.
//
// The band is part of the comparison, so a value band's ends are in the
// chart's domain (chart-decorations.mjs withReferenceValues), and its label is
// set where it reads as the band's name: a value band's inside it, in the
// first corner clear of the marks and their labels; a category band's above
// the plot over its run, in the row periods use (periodBandHeight); a ring's
// beside the ring.
import { linePrimitive, ellipsePrimitive, rectPrimitive, shapePrimitive, stableId, textPrimitive, token, tokenValue } from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { FONT, SECONDARY, CHART_LABEL, textStyle, lineStyle, labelBold } from "./chart-axes.mjs";

export const BAND_STYLES = Object.freeze(["tint", "box", "ellipse"]);
// Past three a chart is shaded more than it is drawn: the bands are the
// chart's subject, and another encoding says it.
export const BANDS_MAX = 3;
// The row a category band's label takes above the plot: the period band's.
export const BAND_LABEL_ROW = 34 + 26;
const LABEL_WIDTH = 220;

const isValue = (band) => band?.axis === "value" || band?.axis === "x" || band?.axis === "y" || (band?.axis === undefined && Number.isFinite(band?.from) && Number.isFinite(band?.to));
/** What a band names: "value", "category", "x", "y" or "points" (a scatter's ring). */
export const bandAxis = (band) => (Array.isArray(band?.points) ? "points" : band?.axis ?? (isValue(band) ? "value" : "category"));

/**
 * The bands a chart's props ask for, checked against what the chart plots:
 * `{ axis, from, to, label, style, index }`, `from` and `to` category indices
 * on a category band and values on a value band. `scatter` allows the x and y
 * axes and rings of named points; a categorical chart allows value and
 * category bands.
 */
export function normalizeBands(props = {}, categories = [], { scatter = false, points = [] } = {}) {
  if (props.bands === undefined) return [];
  if (!Array.isArray(props.bands) || !props.bands.length) throw new Error("bands must be a nonempty array of { from, to, label, style }");
  if (props.bands.length > BANDS_MAX) throw new Error(`a chart carries ${BANDS_MAX} bands at most (this one has ${props.bands.length}); past that the shading is the subject - draw it as its own series or panels`);
  const names = categories.map(String);
  return props.bands.map((band, index) => {
    if (!band || typeof band !== "object") throw new Error(`band ${index + 1} is { from, to, label, style }`);
    const axis = bandAxis(band);
    const style = band.style ?? (axis === "points" ? "ellipse" : "tint");
    if (!BAND_STYLES.includes(style)) throw new Error(`band ${index + 1}: style is one of ${BAND_STYLES.map((s) => `"${s}"`).join(", ")} (got ${JSON.stringify(band.style)})`);
    if ((style === "ellipse") !== (axis === "points")) throw new Error(`band ${index + 1}: an ellipse rings named points on a scatter (\`points: [...]\`), and named points are ringed by one - a range or a run of categories is "tint" or "box"`);
    if (band.label !== undefined && (typeof band.label !== "string" || !band.label.trim())) throw new Error(`band ${index + 1}: label is the band's name, a nonempty phrase ("Target range", "Recession")`);
    const label = band.label?.trim();
    if (axis === "points") {
      if (!scatter) throw new Error(`band ${index + 1}: a ring of named points is drawn on a scatter or bubble chart`);
      const known = new Set(points.map(String));
      const unknown = band.points.filter((name) => !known.has(String(name)));
      if (band.points.length < 2 || unknown.length) throw new Error(`band ${index + 1}: a ring names two or more of the chart's points${unknown.length ? ` ("${unknown[0]}" is not one)` : ""}`);
      return { axis, points: band.points.map(String), label, style, index };
    }
    if (["x", "y"].includes(axis) && !scatter) throw new Error(`band ${index + 1}: axis "${axis}" is a scatter's; on this chart a band is on the "value" axis or a run of categories`);
    if (axis === "value" && scatter) throw new Error(`band ${index + 1}: a scatter has two value axes - say which with axis "x" or "y"`);
    if (axis === "value" || axis === "x" || axis === "y") {
      if (!Number.isFinite(band.from) || !Number.isFinite(band.to) || !(band.from < band.to)) throw new Error(`band ${index + 1}: a value band runs from a lower value to a higher one (\`from\` < \`to\`)`);
      return { axis, from: band.from, to: band.to, label, style, index };
    }
    if (axis !== "category") throw new Error(`band ${index + 1}: axis is "value" or "category"${scatter ? ', or on a scatter "x" or "y"' : ""}`);
    const from = names.indexOf(String(band.from)), to = names.indexOf(String(band.to ?? band.from));
    if (from < 0 || to < 0 || to < from) throw new Error(`band ${index + 1}: from and to name two of the chart's categories in order (${names.slice(0, 8).join(", ")}${names.length > 8 ? ", ..." : ""})`);
    if (from === 0 && to === names.length - 1) throw new Error(`band ${index + 1} covers every category, which marks none of them; shade the run the claim is about`);
    return { axis, from, to, label, style, index };
  });
}

/** The values a chart's value bands reach, for its domain. */
export function bandValues(props = {}) {
  return (Array.isArray(props.bands) ? props.bands : []).filter((band) => ["value", "y"].includes(bandAxis(band))).flatMap((band) => [band?.from, band?.to]).filter(Number.isFinite);
}
/** The values a scatter's bands reach on its x axis. */
export const bandXValues = (props = {}) => (Array.isArray(props.bands) ? props.bands : []).filter((band) => bandAxis(band) === "x").flatMap((band) => [band?.from, band?.to]).filter(Number.isFinite);

// A horizontal bar chart names a value band over the plot, above the bars it spans, as it names a reference line.
const OVER_BARS_ROW = 24;
/**
 * The row above the plot a chart's band labels take: a vertical chart's
 * labelled category band names its run there, in the row periods use; a bar
 * chart's labelled value band names its range over the bars. None on a chart
 * without them.
 */
export function bandLabelRow(props = {}, categories = [], { horizontal = false } = {}) {
  if (props.bands === undefined) return 0;
  const bands = normalizeBands(props, categories);
  if (horizontal) return bands.some((band) => band.axis === "value" && band.label) ? OVER_BARS_ROW : 0;
  const labelled = bands.some((band) => band.axis === "category" && band.label);
  if (labelled && (props.periods || props.events)) throw new Error("a labelled category band takes the row above the plot that periods and events use; name the run in the band or bracket it as a period, not both");
  return labelled ? BAND_LABEL_ROW : 0;
}

const face = () => ({ fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL), bold: labelBold() });
const measured = (text, width = LABEL_WIDTH) => measureText(text, width, face());
const overlaps = (a, b, pad = 3) => a.x < b.x + b.width + pad && a.x + a.width + pad > b.x && a.y < b.y + b.height + pad && a.y + a.height + pad > b.y;

/** Each category's centre along the category axis, in order, from the anchors the chart set (`category:<name>`). */
function categoryCentres(categories, pointMap, vertical) {
  return categories.map((category) => { const point = pointMap.get(`category:${category}`); return point ? (vertical ? point.x : point.y) : null; });
}

/** The span a run of categories takes along the category axis: halfway to its neighbours, the plot's edge at either end. */
function runSpan(band, centres, start, end) {
  const at = (i) => centres[i];
  const lo = band.from > 0 && Number.isFinite(at(band.from - 1)) ? (at(band.from - 1) + at(band.from)) / 2
    : Math.max(start, at(band.from) - (Number.isFinite(at(band.from + 1)) ? (at(band.from + 1) - at(band.from)) / 2 : 24));
  const hi = band.to < centres.length - 1 && Number.isFinite(at(band.to + 1)) ? (at(band.to) + at(band.to + 1)) / 2
    : Math.min(end, at(band.to) + (Number.isFinite(at(band.to - 1)) ? (at(band.to) - at(band.to - 1)) / 2 : 24));
  return [lo, hi];
}

/** A band's shape: a tinted rectangle, or a dashed outline as four rules (a dashed rectangle has no editable equivalent in the file). */
function bandShape(id, index, frame, style) {
  if (style === "tint") return [rectPrimitive({ id: stableId(id, "band", index), role: "chart-band", frame, style: { fill: token("color.surfaceMuted"), stroke: "none", lineWidth: token("line.hairline"), opacity: 0.85 }, data: { band: index } })];
  const { x, y, width, height } = frame, edge = lineStyle(token("color.componentPrimary"), token("line.standard"), "dash");
  return [[x, y, x + width, y], [x + width, y, x + width, y + height], [x, y + height, x + width, y + height], [x, y, x, y + height]]
    .map(([x1, y1, x2, y2], side) => linePrimitive({ id: stableId(id, "band-edge", index, side), role: "chart-band-edge", x1, y1, x2, y2, style: edge, data: { band: index } }));
}

const labelNode = (id, index, frame, layout, align) => textPrimitive({ id: stableId(id, "band-label", index), role: "chart-band-label", frame, text: layout.text,
  style: { ...textStyle(CHART_LABEL, SECONDARY, labelBold(), align), valign: "top", lineHeight: layout.lineHeight, wrap: false }, data: { band: index, textLayout: layout } });

/**
 * The bands' shapes (under the marks) and labels (over them). `obstacles` are
 * the chart's nodes, which a value band's label keeps clear of; a label that
 * finds no clear corner is refused, naming the band.
 */
export function bandNodes({ id, plot, props, categories = [], pointMap = new Map(), yScale = null, xScale = null, scatterX = null, obstacles = [], changeBand = 0 }) {
  const scatter = Boolean(scatterX);
  const pointNames = scatter ? [...pointMap.keys()].filter((key) => key.startsWith("category:")).map((key) => key.slice(9)) : [];
  const bands = normalizeBands(props, categories, { scatter, points: pointNames });
  const underlay = [], overlay = [];
  if (!bands.length) return { underlay, overlay };
  const vertical = Boolean(yScale);
  const taken = obstacles.filter((node) => ["chart-mark", "chart-marker", "data-label", "category-label", "chart-reference-label", "annotation-text", "annotation-surface", "chart-line"].includes(node.role)).map((node) => node.frame);
  const placeIn = (band, frame, candidates) => {
    const layout = measured(band.label, Math.min(LABEL_WIDTH, Math.max(60, frame.width - 12)));
    const width = Math.ceil(layout.width) + 2, height = Math.ceil(layout.height);
    // Inside the chart's own frame - a label just over the plot's top edge is the band's as much as one inside it - and
    // clear of every mark and label the chart set.
    const within = plot.limits ?? plot;
    const spot = candidates(width, height).find((box) => box.x >= within.x - 1 && box.x + box.width <= within.x + within.width + 1 && box.y >= within.y - 1 && box.y + box.height <= plot.y + plot.height + 1
      && [...taken, ...overlay.map((node) => node.frame)].every((other) => !overlaps(box, other)));
    if (!spot) throw new Error(`band "${band.label}" has no clear place for its label inside the plot - its marks and their labels fill every corner of the band; shorten the label, or name the band in the heading or a callout and drop its label`);
    overlay.push(labelNode(id, band.index, spot, layout, spot.align));
  };
  for (const band of bands) {
    if (band.axis === "points") {
      // A ring round the named points and their names, clear of both, and its label just outside it.
      const anchors = band.points.map((name) => pointMap.get(`category:${name}`)).filter(Boolean);
      const names = obstacles.filter((node) => node.role === "data-label" && band.points.includes(String(node.text))).map((node) => node.frame);
      const boxes = [...anchors.map((p) => ({ x: p.x - 6, y: p.y - 6, width: 12, height: 12 })), ...names];
      const pad = 8, x0 = Math.min(...boxes.map((b) => b.x)) - pad, y0 = Math.min(...boxes.map((b) => b.y)) - pad;
      const frame = { x: x0, y: y0, width: Math.max(...boxes.map((b) => b.x + b.width)) + pad - x0, height: Math.max(...boxes.map((b) => b.y + b.height)) + pad - y0 };
      // An ellipse inscribed in that box would cut its corners: it grows by a fifth each way, which clears a name set at a
      // corner, and it is moved - never squashed - to stay inside the chart's frame.
      // Inside the plot where the ring still holds every point and name there, so it crosses no axis label; inside the chart's frame otherwise.
      const ringIn = (within, grow) => { const width = Math.min(within.width, frame.width * grow), height = Math.min(within.height, frame.height * grow);
        return { x: Math.max(within.x, Math.min(frame.x + frame.width / 2 - width / 2, within.x + within.width - width)), y: Math.max(within.y, Math.min(frame.y + frame.height / 2 - height / 2, within.y + within.height - height)), width, height }; };
      const holds = (ring) => boxes.every((b) => [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
        .every(([x, y]) => ((x - ring.x - ring.width / 2) / (ring.width / 2)) ** 2 + ((y - ring.y - ring.height / 2) / (ring.height / 2)) ** 2 <= 1.02));
      const clipped = [1.22, 1.3, 1.4].map((grow) => ringIn(plot, grow)).find(holds) ?? ringIn(plot.limits ?? plot, 1.22);
      overlay.push(ellipsePrimitive({ id: stableId(id, "band-ring", band.index), role: "chart-band-ring", frame: clipped, style: { fill: "none", stroke: token("color.componentPrimary"), lineWidth: token("line.standard") }, data: { band: band.index, points: band.points } }));
      if (band.label) placeIn(band, { width: LABEL_WIDTH }, (w, h) => [
        { x: clipped.x + clipped.width - w, y: clipped.y - h - 4, width: w, height: h, align: "right" },
        { x: clipped.x, y: clipped.y - h - 4, width: w, height: h, align: "left" },
        { x: clipped.x + clipped.width + 6, y: clipped.y + clipped.height / 2 - h / 2, width: w, height: h, align: "left" },
        { x: clipped.x - w - 6, y: clipped.y + clipped.height / 2 - h / 2, width: w, height: h, align: "right" },
        { x: clipped.x, y: clipped.y + clipped.height + 4, width: w, height: h, align: "left" },
      ]);
      continue;
    }
    let frame;
    if (band.axis === "category") {
      const centres = categoryCentres(categories, pointMap, vertical);
      if (centres.some((c) => !Number.isFinite(c))) throw new Error("this chart does not place its categories for a category band; band a value range instead");
      const [lo, hi] = vertical ? runSpan(band, centres, plot.x, plot.x + plot.width) : runSpan(band, centres, plot.y, plot.y + plot.height);
      frame = vertical ? { x: lo, y: plot.y, width: hi - lo, height: plot.height } : { x: plot.x, y: lo, width: plot.width, height: hi - lo };
    } else if (band.axis === "x") {
      const [a, b] = [scatterX(band.from), scatterX(band.to)];
      frame = { x: Math.max(plot.x, Math.min(a, b)), y: plot.y, width: Math.min(plot.x + plot.width, Math.max(a, b)) - Math.max(plot.x, Math.min(a, b)), height: plot.height };
    } else if (vertical) {
      const [a, b] = [yScale(band.to), yScale(band.from)];
      frame = { x: plot.x, y: Math.max(plot.y, a), width: plot.width, height: Math.min(plot.y + plot.height, b) - Math.max(plot.y, a) };
    } else {
      const [a, b] = [xScale(band.from), xScale(band.to)];
      frame = { x: Math.max(plot.x, a), y: plot.y, width: Math.min(plot.x + plot.width, b) - Math.max(plot.x, a), height: plot.height };
    }
    if (!(frame.width > 1 && frame.height > 1)) throw new Error(`band ${band.index + 1} falls outside the plot; its range is in the chart's domain only where the axis is set to hold it`);
    underlay.push(...bandShape(id, band.index, frame, band.style));
    if (!band.label) continue;
    if (band.axis === "category" && vertical) {
      // Over the plot, centred on the run, in the row the plot frame reserved for it (bandLabelRow) - the row a period's
      // label takes, its rule 26px over the plot's top so the tallest column's value label stays under it.
      const layout = measured(band.label, 100000);
      const width = Math.ceil(layout.width) + 2, centre = frame.x + frame.width / 2;
      const left = plot.limits?.x ?? plot.x, right = plot.limits ? plot.limits.x + plot.limits.width : plot.x + plot.width;
      if (width > right - left) throw new Error(`band "${band.label}" is wider than the chart; name the run in a few words`);
      const x = Math.max(left, Math.min(centre - width / 2, right - width));
      const top = plot.y - changeBand - BAND_LABEL_ROW;
      overlay.push(labelNode(id, band.index, { x, y: top, width, height: layout.height }, layout, "center"));
      // The run named over the plot is joined to its band by a tick at each end, as a period's bracket is.
      const y = top + 26;
      overlay.push(linePrimitive({ id: stableId(id, "band-bracket", band.index), role: "chart-band-edge", x1: frame.x + 2, y1: y, x2: frame.x + frame.width - 2, y2: y, style: lineStyle(SECONDARY, token("line.hairline")), data: { band: band.index } }));
      for (const [side, x] of [["a", frame.x + 2], ["b", frame.x + frame.width - 2]]) overlay.push(linePrimitive({ id: stableId(id, "band-bracket", band.index, side), role: "chart-band-edge", x1: x, y1: y, x2: x, y2: y + 6, style: lineStyle(SECONDARY, token("line.hairline")), data: { band: band.index } }));
      continue;
    }
    // A bar chart's value band is named over the bars, at the band's end, in the row the frame reserved (bandLabelRow).
    if (band.axis === "value" && !vertical) {
      placeIn(band, frame, (w, h) => [
        { x: frame.x + frame.width - w, y: plot.y - h - 4, width: w, height: h, align: "right" },
        { x: frame.x, y: plot.y - h - 4, width: w, height: h, align: "left" },
        { x: frame.x + frame.width / 2 - w / 2, y: plot.y - h - 4, width: w, height: h, align: "center" },
      ]);
      continue;
    }
    // Inside the band: its upper corners, then its lower ones, then just outside its top and bottom edges.
    placeIn(band, frame, (w, h) => [
      { x: frame.x + frame.width - w - 6, y: frame.y + 4, width: w, height: h, align: "right" },
      { x: frame.x + 6, y: frame.y + 4, width: w, height: h, align: "left" },
      { x: frame.x + frame.width - w - 6, y: frame.y + frame.height - h - 4, width: w, height: h, align: "right" },
      { x: frame.x + 6, y: frame.y + frame.height - h - 4, width: w, height: h, align: "left" },
      { x: frame.x + frame.width - w - 6, y: frame.y - h - 4, width: w, height: h, align: "right" },
      { x: frame.x + 6, y: frame.y - h - 4, width: w, height: h, align: "left" },
      { x: frame.x + frame.width - w - 6, y: frame.y + frame.height + 4, width: w, height: h, align: "right" },
      { x: frame.x + 6, y: frame.y + frame.height + 4, width: w, height: h, align: "left" },
    ]);
  }
  return { underlay, overlay };
}

// A line's intervals: the range a forecast or a scenario runs in, drawn as a
// shaded envelope round its line - nested, a fan chart's 50%, 80% and 95%
// bands, each lighter as it widens.
//
//   intervals: [{ low: [...], high: [...], label }]
//
// `low` and `high` run one value a category, `null` where the interval has not
// begun (a fan opens where the record ends); a label names the interval at its
// right end ("80% interval", "Scenario range").
export const INTERVALS_MAX = 3;
const finiteOrNull = (value) => value === null || Number.isFinite(value);

/** A line chart's intervals, checked: `{ low, high, label, from, to, index }`, from-to the run of categories it covers, widest first. */
export function normalizeIntervals(props = {}, categories = []) {
  if (props.intervals === undefined) return [];
  if (!Array.isArray(props.intervals) || !props.intervals.length) throw new Error("intervals must be a nonempty array of { low, high, label }");
  if (props.intervals.length > INTERVALS_MAX) throw new Error(`a line carries ${INTERVALS_MAX} intervals at most (a fan's 50%, 80% and 95%); this one has ${props.intervals.length}`);
  const n = categories.length;
  const checked = props.intervals.map((interval, index) => {
    const where = `interval ${index + 1}${interval?.label ? ` ("${interval.label}")` : ""}`;
    if (!interval || !Array.isArray(interval.low) || !Array.isArray(interval.high) || interval.low.length !== n || interval.high.length !== n || ![...interval.low, ...interval.high].every(finiteOrNull))
      throw new Error(`${where}: \`low\` and \`high\` carry one value a category (${n}), null where the interval has not begun`);
    const runs = interval.low.map((low, at) => Number.isFinite(low) && Number.isFinite(interval.high[at]));
    const from = runs.indexOf(true), to = runs.lastIndexOf(true);
    if (from < 0 || to - from < 1) throw new Error(`${where} spans two or more categories`);
    if (runs.slice(from, to + 1).some((ok) => !ok)) throw new Error(`${where} runs unbroken from its first category to its last; a gap in it is two intervals`);
    if (interval.low.some((low, at) => Number.isFinite(low) && !(low <= interval.high[at]))) throw new Error(`${where}: each \`low\` is at or under its \`high\``);
    if (interval.label !== undefined && (typeof interval.label !== "string" || !interval.label.trim())) throw new Error(`${where}: its label names it ("80% interval", "Scenario range")`);
    const width = interval.low.reduce((sum, low, at) => (Number.isFinite(low) ? sum + interval.high[at] - low : sum), 0) / (to - from + 1);
    return { low: interval.low, high: interval.high, label: interval.label?.trim(), from, to, index, width };
  });
  return checked.sort((a, b) => b.width - a.width);
}

/** The values a line's intervals reach, for its domain. */
export const intervalValues = (props = {}) => (Array.isArray(props.intervals) ? props.intervals : []).flatMap((interval) => [...(interval?.low || []), ...(interval?.high || [])]).filter(Number.isFinite);

/** The gutter at a line's right its interval labels need, measured. */
export function intervalLabelWidth(props = {}) {
  const labels = (Array.isArray(props.intervals) ? props.intervals : []).map((interval) => interval?.label).filter((label) => typeof label === "string" && label.trim());
  return labels.length ? Math.ceil(Math.max(...labels.map((label) => measured(label.trim(), 160).width))) + 14 : 0;
}

/**
 * The envelopes under a line chart's series (`under`) and their labels at the
 * right end (`labels`), the widest palest: `xAt(i)` and `yAt(v)` place a
 * category and a value. The tint is the subject line's colour.
 */
export function intervalNodes({ id, plot, props, categories, xAt, yAt, color, offset = 10 }) {
  const intervals = normalizeIntervals(props, categories);
  const under = [], labels = [];
  // Drawn widest first, each over the last, so the tints add up towards the line: the outer band palest.
  const opacity = (rank) => ({ 1: [0.22], 2: [0.16, 0.24], 3: [0.12, 0.18, 0.24] })[intervals.length][rank];
  intervals.forEach((interval, rank) => {
    const at = Array.from({ length: interval.to - interval.from + 1 }, (_, k) => interval.from + k);
    const top = at.map((i) => [xAt(i), yAt(interval.high[i])]), bottom = at.map((i) => [xAt(i), yAt(interval.low[i])]).reverse();
    const path = [...top, ...bottom].map(([x, y]) => [Number(((x - plot.x) / plot.width).toFixed(6)), Number(((y - plot.y) / plot.height).toFixed(6))]);
    under.push(shapePrimitive({ id: stableId(id, "interval", interval.index), role: "chart-interval", geometry: "customPolygon", frame: { x: plot.x, y: plot.y, width: plot.width, height: plot.height },
      style: { fill: color, stroke: "none", lineWidth: token("line.hairline"), opacity: opacity(rank) }, data: { paths: [path], interval: interval.index, ...(interval.label ? { label: interval.label } : {}) } }));
    if (interval.label) {
      const layout = measured(interval.label, 160);
      const mid = (yAt(interval.high[interval.to]) + yAt(interval.low[interval.to])) / 2, outer = yAt(interval.high[interval.to]);
      labels.push({ interval, layout, y: rank === intervals.length - 1 ? mid - layout.height / 2 : outer - layout.height / 2 });
    }
  });
  // Labels at the right end, in order down the page and pushed apart, as a line's end labels are.
  labels.sort((a, b) => a.y - b.y);
  for (let k = 1; k < labels.length; k++) labels[k].y = Math.max(labels[k].y, labels[k - 1].y + labels[k - 1].layout.height + 2);
  const nodes = labels.map(({ interval, layout, y }) => labelNode(id, `interval-${interval.index}`, { x: xAt(interval.to) + offset, y, width: Math.ceil(layout.width) + 2, height: layout.height }, layout, "left"));
  return { under, labels: nodes };
}
