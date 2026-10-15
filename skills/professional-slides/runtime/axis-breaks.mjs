// Axis jumps, one place for every chart. A period axis that sets its periods one slot apart - columns or a line over a data
// table, a combo, a set of multiples - says where it skips: a "//" after each long gap, and no line drawn across a period the
// record does not have. A value axis may cut one run out, so one outlier does not flatten the rest, with a slanted gap across
// every mark that crosses the cut. Each kind kept its own before: columns broke their axis while a combo's line ran straight
// from 2019 to 2023 and small multiples set 2019 and 2023 one slot apart, joined.
import { linePrimitive, rectPrimitive, shapePrimitive, stableId, token } from "./core.mjs";
import { INK, lineStyle } from "./chart-axes.mjs";
import { gapBreaks, missingPeriods, periodTimes } from "./time-axis.mjs";

/**
 * The categories a period axis set one slot apart breaks after, in axis order: those the author names (`categoryBreaks`) and
 * each whose next date lies further off than the run's shortest step (time-axis.mjs gapBreaks).
 */
export function slotBreaks(categories, authored = []) {
  const breaks = new Set([...(authored || []), ...gapBreaks(categories)].map(String));
  return categories.map(String).filter((category, index) => breaks.has(category) && index < categories.length - 1);
}

/** Whether a run of labels is dates, and so whether a slotted axis over them can skip. */
export const datedRun = (categories) => Boolean(periodTimes(categories));

/**
 * The segments a line over these periods leaves undrawn, by the index of the earlier point: those across a period the run
 * leaves out at its own cadence (time-axis.mjs missingPeriods). A segment drawn across 2020-21 states values the record does
 * not have.
 */
export function unjoined(categories) {
  return new Set(missingPeriods(categories).map((gap) => gap.after));
}

/**
 * A "//" across the category axis after each break, `{ after, at }`: the category the axis breaks after and the position
 * along the axis midway to the next one, on the axis line at the plot's foot (or its left edge, `horizontal`).
 */
export function categoryBreakNodes(id, plot, breaks, horizontal = false) {
  const axisAt = horizontal ? plot.x : plot.y + plot.height;
  return breaks.flatMap(({ after, at }) => [
    rectPrimitive({ id: stableId(id, "category-break", after), role: "chart-break", frame: horizontal ? { x: axisAt - 6, y: at - 4, width: 12, height: 8 } : { x: at - 4, y: axisAt - 6, width: 8, height: 12 },
      style: { fill: token("color.canvas"), stroke: "none", lineWidth: token("line.hairline") }, data: { after } }),
    ...[[0, -3], [1, 3]].map(([k, offset]) => linePrimitive({ id: stableId(id, "category-break", after, k), role: "chart-break-mark",
      ...(horizontal ? { x1: axisAt - 6, y1: at + offset + 3, x2: axisAt + 6, y2: at + offset - 3 } : { x1: at + offset - 3, y1: axisAt + 6, x2: at + offset + 3, y2: axisAt - 6 }),
      style: lineStyle(INK, token("line.standard")), data: { after } }))
  ]);
}

// The cut a broken value axis draws across a mark: wide enough to read as a gap, short of a value's worth of plot.
export const BREAK_PX = 14;

/**
 * `valueBreak: { from, to }`: the run of the value axis from `from` to `to` cut out, so an outlier - one mark ten times its
 * neighbours - keeps its place without flattening the rest. `ends` are where the marks end. The values stay printed on the
 * marks: a broken axis cannot be read off a scale, so it takes no value axis or gridlines. A mark ending inside the cut would
 * be drawn at a length that is neither its value nor the cut's, a cut no mark crosses breaks nothing, and a reference past
 * the cut sits where the scale is no longer one; each is refused. Returns `{ valueBreak, compress }`: the cut, whose `gap`
 * is set once the plot's length is known (cutGap), and the map from a value to its place on the compressed scale.
 */
export function valueCut(props, ends, { showValueAxis, showDataLabels }) {
  const identity = { valueBreak: null, compress: (v) => v };
  if (props.valueBreak === undefined || props.valueBreak === null) return identity;
  const { from, to } = props.valueBreak ?? {};
  if (!Number.isFinite(from) || !Number.isFinite(to) || !(from > 0 && to > from)) throw new Error("valueBreak cuts the axis from one positive value to a higher one: { from, to }, 0 < from < to");
  if (showValueAxis || props.gridlines === true) throw new Error("a broken axis cannot be read off a scale - its values are printed on its marks; drop showValueAxis and gridlines, or draw the outlier unbroken");
  if (!showDataLabels) throw new Error("a broken axis prints every value on its mark, since the cut leaves no scale to read; drop dataLabels: false");
  const inside = ends.find((v) => v > from && v < to);
  if (inside !== undefined) throw new Error(`valueBreak cuts ${from} to ${to}, and a mark ends at ${inside}, inside the cut; move the cut so every mark ends below it or past it`);
  if (!ends.some((v) => v >= to)) throw new Error(`valueBreak cuts ${from} to ${to}, which no mark crosses; a cut is for a mark that would flatten the rest - drop it`);
  for (const reference of [...(props.referenceLines || []).map((r) => r?.value), ...(props.bands || []).flatMap((b) => [b?.from, b?.to])].filter(Number.isFinite))
    if (reference > from) throw new Error(`a reference or band at ${reference} sits at or past the cut (${from} to ${to}), where the scale is no longer one; keep references under the cut`);
  const valueBreak = { from, to, gap: 0 };
  // Below the cut the scale is the data's; past it every value moves down by the run cut out, plus the cut's own few pixels.
  const compress = (v) => (v <= from ? v : v >= to ? v - (to - from) + valueBreak.gap : from + (v - from) / (to - from) * valueBreak.gap);
  return { valueBreak, compress };
}

/** The cut's width in value units, a fixed few pixels whatever the scale, once the plot's `length` and the domain's `span` are known. */
export function cutGap(valueBreak, length, span) {
  if (valueBreak) valueBreak.gap = BREAK_PX / length * span;
}

/** The slanted gap, in the page's colour, across every mark that crosses the cut; `scale` places a value on the compressed axis. */
export function valueBreakNodes(marks, valueBreak, scale, horizontal = false) {
  if (!valueBreak) return [];
  const [lo, hi] = horizontal ? [scale(valueBreak.from), scale(valueBreak.to)] : [scale(valueBreak.to), scale(valueBreak.from)];
  const slant = 5;
  return marks.filter((mark) => {
    const f = mark.frame;
    return horizontal ? f.x < lo + 0.5 && f.x + f.width > hi - 0.5 : f.y < lo + 0.5 && f.y + f.height > hi - 0.5;
  }).map((mark) => {
    const f = mark.frame;
    // A parallelogram laid across the mark, leaning as a hand-drawn "//" does.
    const points = horizontal
      ? [[lo - slant, f.y + f.height + 2], [lo + slant, f.y - 2], [hi + slant, f.y - 2], [hi - slant, f.y + f.height + 2]]
      : [[f.x - 2, hi + slant], [f.x + f.width + 2, hi - slant], [f.x + f.width + 2, lo - slant], [f.x - 2, lo + slant]];
    const box = { x: Math.min(...points.map((p) => p[0])), y: Math.min(...points.map((p) => p[1])) };
    box.width = Math.max(...points.map((p) => p[0])) - box.x; box.height = Math.max(...points.map((p) => p[1])) - box.y;
    return shapePrimitive({ id: stableId(mark.id, "break"), role: "chart-break", geometry: "customPolygon", frame: box, style: { fill: token("color.canvas"), stroke: "none", lineWidth: token("line.hairline") },
      data: { paths: [points.map(([x, y]) => [Number(((x - box.x) / box.width).toFixed(6)), Number(((y - box.y) / box.height).toFixed(6))])], from: valueBreak.from, to: valueBreak.to, category: mark.data?.category, series: mark.data?.series } });
  });
}
