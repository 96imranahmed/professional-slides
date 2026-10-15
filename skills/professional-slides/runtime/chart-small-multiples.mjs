// Small multiples: one small chart a member, all of one kind on one scale, in
// a trellis of up to twelve - the regions' trends side by side, each segment's
// mix, every line's punctuality by month - where a single chart of twelve
// series is a tangle and twelve pages are eleven too many.
//
//   chart.small-multiples
//     mark        "column" (the default), "bar" or "line": every panel draws the same mark; "stacked-column" or
//                 "stacked-bar": each panel a stack of the same parts; "donut": each panel one whole shared out
//     categories  the axis every panel shares - periods for columns and lines, members for bars; for donuts, the parts
//     items       2 to 12 panels, each { label, values, focus?, reference?, note? }: `values` one a category (null for a
//                 gap in a line), `focus` the category to set in the accent, `reference` a value to rule across the panel.
//                 A stacked panel is { label, series: [{ name, values }] } - every panel the same parts in the same order
//     percent     true: each stack re-expressed as shares of its total, on one 0 to 100 scale (stacked marks only)
//     centre      a donut's part whose share is printed in every hole - the part the page is about
//     highlights  [{ category: "<item label>" }]: the panel the page is about, its marks in the accent, the rest navy;
//                 a stack or a donut keeps a colour a part, so its panel is set on a tint under an accent title
//     reference   "average": each panel's own mean ruled across it and named "Ø" - a value the reader compares the
//                 marks with (a stack's mean total); or one number for every panel
//     scale       "shared" (the default): one domain for every panel, so equal heights are equal values; "own" gives
//                 each panel its own, for members of different sizes whose shapes are compared
//     rowLabels, columnLabels
//                 header labels for a grid read both ways - regions down, segments across - the items in reading
//                 order, a row at a time
//
// Every panel's axis is the same, so the category labels are set once: under
// the bottom row (columns, lines) or beside the left column (bars). Values
// print on the marks while they are few enough to read in a panel - six
// columns or bars, or a line's last value - and the shared scale says the rest.
// A stack's or a donut's parts are keyed once, over the trellis, each part in
// one colour in every panel, and a part's value prints inside its segment
// where the segment holds it.
import { ellipsePrimitive, linePrimitive, onFill, rectPrimitive, stableId, textPrimitive, token, wedgePrimitive } from "./core.mjs";
import { formatValue } from "./value-format.mjs";
import { measureAt } from "./draw.mjs";
import { legendNodes, legendRowCount } from "./legends.mjs";
import { AXIS_LABEL, CHART_LABEL, FONT, GRID, INK, SECONDARY, SERIES, fillStyle, highlightAmongSeries, labelBold, lineStyle, numericBounds, sharesOfWhole, textStyle } from "./chart-axes.mjs";

export const SMALL_MULTIPLES = Object.freeze({ min: 2, max: 12, marks: Object.freeze(["column", "bar", "line", "stacked-column", "stacked-bar", "donut"]), parts: Object.freeze({ min: 2, max: SERIES.length }) });
const STACKED = new Set(["stacked-column", "stacked-bar"]);
// The marks that run their categories down the page, and the ones that key their parts in colour.
const sideways = (mark) => mark === "bar" || mark === "stacked-bar";
const keyed = (mark) => STACKED.has(mark) || mark === "donut";
const ACCENT = token("color.accent");
const GAP_X = 18, GAP_Y = 16, TITLE = 18, AXIS = 16, HEADER = 20;
// Values print on a panel's marks while they are this few: past it a panel's figures crowd its plot.
const LABELLED_MARKS = 6;
// A donut narrower than this cannot be read as a ring: its hole and its segments' shares are lost.
const DONUT_LEAST = 64;
// The shape each mark reads best in, as a cell's width over its height.
const ASPECT = { bar: 1.1, "stacked-bar": 1.1, donut: 1 };
const aspectOf = (mark) => ASPECT[mark] ?? 1.6;
const measure = (text, width, bold = false, size = CHART_LABEL) => measureAt(String(text), width, { size, bold, font: FONT });

/** A stacked panel's parts, checked against the first panel's: one key serves the trellis only while every panel stacks the same parts. */
function stackedParts(items, categories) {
  const first = items[0]?.series;
  if (!Array.isArray(first) || !first.length) throw new Error(`a stacked trellis draws each panel's parts: panel "${items[0]?.label}" carries \`series: [{ name, values }]\`, one a part`);
  const parts = first.map((part) => String(part?.name ?? ""));
  if (parts.length < SMALL_MULTIPLES.parts.min || parts.length > SMALL_MULTIPLES.parts.max)
    throw new Error(`a stacked trellis keys each part in its own colour: ${SMALL_MULTIPLES.parts.min} to ${SMALL_MULTIPLES.parts.max} parts (this has ${parts.length}) - fold the smallest into "Other"`);
  for (const item of items) {
    if (item.values !== undefined) throw new Error(`panel "${item.label}" is a stack: its numbers are its parts' \`series\`, not \`values\``);
    const names = Array.isArray(item.series) ? item.series.map((part) => String(part?.name ?? "")) : [];
    if (names.join("\u0000") !== parts.join("\u0000")) throw new Error(`panel "${item.label}" stacks ${names.length ? names.map((n) => `"${n}"`).join(", ") : "no parts"}; every panel stacks the same parts in the same order (${parts.map((n) => `"${n}"`).join(", ")}), so each keeps one colour`);
    for (const part of item.series) {
      if (!Array.isArray(part.values) || part.values.length !== categories.length || part.values.some((v) => !Number.isFinite(v)))
        throw new Error(`panel "${item.label}": part "${part.name}" carries one value a category (${categories.length}); a part a category lacks is 0`);
      if (part.values.some((v) => v < 0)) throw new Error(`panel "${item.label}": part "${part.name}" falls below zero, and a stack's parts add up to its total; a signed change is a column panel or a diverging bar`);
    }
  }
  if (new Set(parts).size !== parts.length || parts.some((name) => !name.trim())) throw new Error("a stacked trellis names each part once, in `name`");
  return parts;
}

/** The props checked: the mark, the categories, the panels, the grid and the scale. */
function normalized(props = {}) {
  const mark = props.mark ?? "column";
  if (!SMALL_MULTIPLES.marks.includes(mark)) throw new Error(`small multiples draw one mark in every panel: mark is ${SMALL_MULTIPLES.marks.map((m) => `"${m}"`).join(", ")}`);
  const stacked = STACKED.has(mark), donut = mark === "donut";
  const categories = (props.categories || []).map(String);
  if (categories.length < 2) throw new Error(donut ? "a donut trellis names the parts each donut shares out in `categories`, two or more" : "small multiples share one axis of two or more `categories`");
  if (donut && categories.length > SMALL_MULTIPLES.parts.max) throw new Error(`a donut trellis keys each part in its own colour: ${SMALL_MULTIPLES.parts.max} parts at most (this has ${categories.length}) - fold the smallest into "Other"`);
  const items = props.items || [];
  if (!Array.isArray(items) || items.length < SMALL_MULTIPLES.min || items.length > SMALL_MULTIPLES.max)
    throw new Error(`small multiples hold ${SMALL_MULTIPLES.min} to ${SMALL_MULTIPLES.max} panels (\`items\`); this has ${Array.isArray(items) ? items.length : 0} - past twelve, group the members or show the field as a distribution`);
  const labels = new Set();
  for (const [at, item] of items.entries()) {
    if (!item || typeof item.label !== "string" || !item.label.trim()) throw new Error(`panel ${at + 1} needs its \`label\``);
    if (labels.has(item.label)) throw new Error(`two panels are labelled "${item.label}"`);
    labels.add(item.label);
    if (keyed(mark) && item.focus !== undefined) throw new Error(`panel "${item.label}" focuses "${item.focus}", but a ${mark} keeps one colour a part; mark the panel the page is about with \`highlights\``);
    if (item.reference !== undefined && !Number.isFinite(item.reference)) throw new Error(`panel "${item.label}": reference is a value to rule across it`);
    if (donut && item.reference !== undefined) throw new Error(`panel "${item.label}": a donut has no scale to rule a reference across; say the comparison in its \`note\` or the commentary`);
    if (stacked) continue;
    if (item.series !== undefined) throw new Error(`panel "${item.label}" carries \`series\`, which only a stacked mark draws; a ${mark} panel carries its \`values\``);
    if (!Array.isArray(item.values) || item.values.length !== categories.length || item.values.some((v) => v !== null && !Number.isFinite(v)))
      throw new Error(`panel "${item.label}" carries one value a ${donut ? "part" : "category"} (${categories.length})${mark === "line" ? ", null for a gap" : ""}`);
    if (mark !== "line" && item.values.some((v) => v === null)) throw new Error(`panel "${item.label}" leaves a ${donut ? "part" : mark} empty; a missing value is 0${donut ? "" : ", or the panel draws a line"}`);
    if (donut && (item.values.some((v) => v < 0) || item.values.filter((v) => v > 0).length < 2)) throw new Error(`panel "${item.label}" shares out a whole: every part 0 or more, and two or more above 0`);
    if (item.focus !== undefined && !categories.includes(String(item.focus))) throw new Error(`panel "${item.label}" focuses "${item.focus}", which is not a category`);
  }
  const parts = stacked ? stackedParts(items, categories) : donut ? categories : null;
  // A rank is a place, 1 the top (measures.mjs isRankMeasure, set by bind.mjs): its line runs with 1 at the top of every
  // panel, as chart.line draws it, and a column's or bar's length would draw the worst place as the largest. pr07 drew
  // BA's fall from 13th to 23rd as a rise.
  const ranked = items.filter((item) => item?.rank === true);
  if (ranked.length && ranked.length !== items.length) throw new Error(`${ranked.map((item) => item.label).join(", ")} ${ranked.length === 1 ? "is a rank" : "are ranks"} and the other panels quantities: a trellis is one measure on one scale`);
  if (ranked.length && mark !== "line") throw new Error(`RANK_FILLED: the panels are ranks, places with 1 at the top, and a ${mark}'s length would draw the worst place as the largest - draw the trellis as "line"`);
  const rank = ranked.length > 0;
  for (const h of props.highlights || []) if (!labels.has(String(h?.category ?? h))) throw new Error(`small multiples highlight a panel by its label; "${h?.category ?? h}" is not one`);
  if ((props.highlights || []).length >= items.length) throw new Error("highlighting every panel marks none of them");
  const percent = props.percent === true;
  if (props.percent !== undefined && typeof props.percent !== "boolean") throw new Error("percent is true (each stack as shares of its total) or left out");
  if (percent && !stacked) throw new Error(`percent re-expresses each stack as shares of its total, and a ${mark} trellis draws no stack; ${donut ? "a donut is already a share of its whole" : "enter the shares as the values, with the unit saying so"}`);
  const reference = props.reference;
  if (reference !== undefined && reference !== "average" && !Number.isFinite(reference)) throw new Error("reference is \"average\" (each panel's own mean) or one value for every panel");
  if (donut && reference !== undefined) throw new Error("a donut has no scale to rule a reference across; say the comparison in the commentary");
  const scale = props.scale ?? "shared";
  if (!["shared", "own"].includes(scale)) throw new Error("scale is \"shared\" (one domain, the default) or \"own\" (each panel its own)");
  if (scale === "own" && (donut || percent)) throw new Error(`${donut ? "every donut is a whole" : "every 100% stack runs 0 to 100"}, one scale already; leave \`scale\` out`);
  const centre = props.centre === undefined ? null : String(props.centre);
  if (centre !== null && !donut) throw new Error("centre names the part a donut prints in its hole; this trellis draws no donut");
  if (centre !== null && !categories.includes(centre)) throw new Error(`centre names the part whose share every hole prints; "${centre}" is not one of the categories`);
  const rowLabels = props.rowLabels, columnLabels = props.columnLabels;
  if ((rowLabels === undefined) !== (columnLabels === undefined)) throw new Error("a grid read both ways names its rows and its columns: rowLabels and columnLabels together");
  if (rowLabels && (!Array.isArray(rowLabels) || !Array.isArray(columnLabels) || rowLabels.length * columnLabels.length !== items.length))
    throw new Error(`rowLabels and columnLabels head a grid of ${rowLabels?.length ?? 0} by ${columnLabels?.length ?? 0}; the items fill it in reading order, so there are ${(rowLabels?.length ?? 0) * (columnLabels?.length ?? 0)} of them (this has ${items.length})`);
  // A 100% stack is drawn from its shares: each category's parts shared out of their total.
  const drawn = percent ? items.map((item) => {
    const shares = categories.map((_, i) => sharesOfWhole(item.series.map((part) => part.values[i])));
    return { ...item, series: item.series.map((part, k) => ({ ...part, values: categories.map((_, i) => shares[i][k]) })) };
  }) : items;
  return { mark, stacked, donut, rank, categories, items: drawn, parts, percent, centre, reference, scale, rowLabels: rowLabels?.map(String), columnLabels: columnLabels?.map(String) };
}

/** A panel's values on its scale: a stack's totals, category by category, or the values themselves. */
// A total is rounded to the millionth: shares of 33.3, 33.3 and 33.4 add to 100.00000000000001 in floating point, past a 100% stack's top.
const scaled = (item, stacked) => (stacked ? item.series[0].values.map((_, i) => Math.round(item.series.reduce((sum, part) => sum + part.values[i], 0) * 1e6) / 1e6) : item.values.filter(Number.isFinite));

/** How many panels a row holds: the count whose cells come closest to the shape the mark reads best in. */
function columnsFor(count, frame, mark, given) {
  if (given) return given;
  const aspect = aspectOf(mark);
  let best = 1, error = Infinity;
  for (let c = 1; c <= Math.min(6, count); c += 1) {
    const rows = Math.ceil(count / c), w = frame.width / c, h = (frame.height ?? frame.width * 0.45) / rows;
    const miss = Math.abs(Math.log((w / h) / aspect)) + (rows * c - count) * 0.15;
    if (miss < error) { best = c; error = miss; }
  }
  return best;
}

/** The trellis laid out: the key, the grid, each cell's frame and its plot, and the scale. */
export function smallMultiplesLayout(frameIn, props = {}) {
  const spec = normalized(props);
  const { mark, stacked, donut, categories, items, parts, rowLabels, columnLabels } = spec;
  const across = sideways(mark);
  // The parts' key runs over the trellis: one row a line of swatches, 26px a row it wraps to.
  const legendRows = parts ? legendRowCount(parts, frameIn.width) : 0;
  const legend = legendRows ? 24 + (legendRows - 1) * 26 + 6 : 0;
  // Measured at a width alone, the trellis is as tall as its rows need at the shape its mark reads best in, and no shorter.
  const measuring = !Number.isFinite(frameIn.height);
  const guess = { ...frameIn, height: Math.round(frameIn.width * 0.45) };
  const columns = columnLabels ? columnLabels.length : columnsFor(items.length, measuring ? guess : frameIn, mark, props.columns);
  const rows = Math.ceil(items.length / columns);
  const least = across ? categories.length * 10 + TITLE + 24 : donut ? DONUT_LEAST + TITLE + 24 : 96;
  const frame = measuring ? { ...frameIn, height: legend + (columnLabels ? HEADER : 0) + (across || donut ? 0 : AXIS) + rows * Math.max(least, ((frameIn.width - (columns - 1) * GAP_X) / columns) / aspectOf(mark)) + (rows - 1) * GAP_Y } : frameIn;
  const rowGutter = rowLabels ? Math.min(140, Math.ceil(Math.max(...rowLabels.map((l) => measure(l, 140, true).width))) + 12) : 0;
  const categoryGutter = across ? Math.min(120, Math.ceil(Math.max(...categories.map((c) => measure(c, 120, false, AXIS_LABEL).width))) + 8) : 0;
  const top = frame.y + legend + (columnLabels ? HEADER : 0);
  const left = frame.x + rowGutter + categoryGutter;
  const bottomAxis = across || donut ? 0 : AXIS;
  const cellW = (frame.x + frame.width - left - (columns - 1) * GAP_X) / columns;
  const cellH = (frame.y + frame.height - top - bottomAxis - (rows - 1) * GAP_Y) / rows;
  const titled = !rowLabels;
  const minPlot = across ? categories.length * 8 : donut ? DONUT_LEAST : 40;
  if (cellW < (donut ? DONUT_LEAST : 90) || cellH - (titled ? TITLE : 0) - 16 < minPlot) throw new Error(`${items.length} panels in ${rows} rows of ${columns} leave each ${Math.floor(cellW)} by ${Math.floor(cellH)}px - too small to read${donut ? ` (a donut needs ${DONUT_LEAST}px across)` : ""}; give the chart the page's height (commentary "none" or "below"), fewer panels, or ${across ? "fewer categories" : donut ? "fewer rows" : "fewer rows"}`);
  // One domain for every panel: a 100% stack's is 0 to 100; a donut has none, each one a whole.
  const ruledValue = Number.isFinite(spec.reference) ? [spec.reference] : [];
  const bounds = (values) => (spec.percent ? numericBounds([...values, ...ruledValue], { axis: "y", min: 0, max: 100 }) : numericBounds([...values, ...ruledValue], { axis: "y", includeZero: mark !== "line", tight: true }));
  const shared = donut ? null : bounds(items.flatMap((item) => scaled(item, stacked)));
  const cells = items.map((item, at) => {
    const col = at % columns, row = Math.floor(at / columns);
    const cell = { x: left + col * (cellW + GAP_X), y: top + row * (cellH + GAP_Y), width: cellW, height: cellH };
    // Columns that print their values keep a line over the tallest for its figure.
    const headroom = mark === "column" && (categories.length <= LABELLED_MARKS || item.focus !== undefined) ? 16 : 0;
    const plot = { x: cell.x, y: cell.y + (titled ? TITLE : 0) + 4 + headroom, width: cell.width - (mark === "line" ? 40 : mark === "bar" ? 34 : stacked && across ? 4 : 0), height: cell.height - (titled ? TITLE : 0) - 8 - headroom };
    // An own scale still holds the rule the panel draws: its own reference, or else the chart's.
    const ruled = Number.isFinite(item.reference) ? item.reference : Number.isFinite(spec.reference) ? spec.reference : null;
    const own = spec.scale === "own" ? numericBounds([...scaled(item, stacked), ...(ruled === null ? [] : [ruled])], { axis: "y", includeZero: mark !== "line", tight: true }) : shared;
    return { item, at, col, row, cell, plot, bounds: own };
  });
  return { ...spec, frame, columns, rows, cells, rowGutter, categoryGutter, legend, legendRows, top, left, height: frame.height };
}

/** A value printed inside its mark where the mark holds it, in the ink or the white that reads on the mark's fill. */
function insideLabel({ id, frame, value, fill, props, data, text = formatValue(value, props) }) {
  const size = measure(text, 400, labelBold());
  if (frame.width < size.width + 6 || frame.height < size.height + 2) return null;
  return textPrimitive({ id, role: "data-label", frame: { x: frame.x, y: frame.y + (frame.height - size.height) / 2, width: frame.width, height: size.height }, text, style: textStyle(CHART_LABEL, onFill(fill), labelBold(), "center"), data: { ...data, placement: "inside" } });
}

/** One stacked panel: each category's parts laid end to end, a colour a part, each value inside its segment where it fits. */
function stackNodes({ layout, panel, key, props }) {
  const { mark, categories, parts } = layout;
  const { item, plot, bounds } = panel, across = sideways(mark);
  const nodes = [];
  const n = categories.length, slot = (across ? plot.height : plot.width) / n, weight = n <= 4 ? 0.7 : 0.62;
  const span = (v) => (v - bounds.min) / bounds.span;
  categories.forEach((category, i) => {
    const at = i * slot + (slot * (1 - weight)) / 2, size = slot * weight;
    let base = 0;
    parts.forEach((part, k) => {
      const v = item.series[k].values[i];
      if (!v) return;
      const a = span(base), b = span(base + v);
      base += v;
      const frame = across
        ? { x: plot.x + a * plot.width, y: plot.y + at, width: (b - a) * plot.width, height: Math.max(2, size) }
        : { x: plot.x + at, y: plot.y + plot.height - b * plot.height, width: Math.max(2, size), height: (b - a) * plot.height };
      const data = { item: item.label, category, part, value: v };
      // A hairline of the page's ground between segments, so two parts of one stack never run together.
      nodes.push(rectPrimitive({ id: key("segment", i, k), role: "chart-segment", frame, style: fillStyle(SERIES[k], token("color.canvas"), token("line.hairline")), data: { ...data, colorIndex: k } }));
      const label = insideLabel({ id: key("segment-value", i, k), frame, value: v, fill: SERIES[k], props, data });
      if (label) nodes.push(label);
    });
  });
  return nodes;
}

/** One donut: the parts round the ring from twelve o'clock, each share inside its segment where it fits, the centre part's share in the hole. */
function donutNodes({ layout, panel, key, props, highlighted }) {
  const { categories, centre } = layout;
  const { item, plot } = panel;
  const nodes = [];
  const size = Math.min(plot.width, plot.height);
  const circle = { x: plot.x + (plot.width - size) / 2, y: plot.y + (plot.height - size) / 2, width: size, height: size };
  const cx = circle.x + size / 2, cy = circle.y + size / 2;
  const total = item.values.reduce((sum, v) => sum + v, 0);
  const share = (v) => { const pct = Math.round((100 * v) / total); return pct ? `${pct}%` : "<1%"; };
  // The ring is the outer quarter of the circle each side: the hole is the pie module's, 46% across.
  const hole = size * 0.46, ring = (size - hole) / 2, middle = hole / 2 + ring / 2;
  let angle = -90;
  item.values.forEach((v, k) => {
    if (!v) return;
    const sweep = (360 * v) / total;
    const data = { item: item.label, category: categories[k], part: categories[k], value: v, colorIndex: k };
    nodes.push(wedgePrimitive({ id: key("segment", k), role: "chart-segment", frame: circle, startAngle: angle, endAngle: angle + sweep, style: fillStyle(SERIES[k], token("color.canvas"), token("line.hairline")), data: { ...data, plotFrame: circle } }));
    // The share sits on the ring's middle at the segment's mid-angle while the chord there holds it and the ring is deep enough.
    // The centre part's share is the hole's, and is not printed twice.
    const mid = ((angle + sweep / 2) * Math.PI) / 180, text = share(v), m = measure(text, 400, labelBold());
    const chord = 2 * middle * Math.sin(Math.min(Math.PI / 2, (sweep * Math.PI) / 360));
    if (categories[k] !== centre && chord >= m.width + 6 && ring >= m.height) {
      const x = cx + Math.cos(mid) * middle, y = cy + Math.sin(mid) * middle;
      nodes.push(textPrimitive({ id: key("segment-value", k), role: "data-label", frame: { x: x - (m.width + 6) / 2, y: y - m.height / 2, width: m.width + 6, height: m.height }, text, style: textStyle(CHART_LABEL, onFill(SERIES[k]), labelBold(), "center"), data: { ...data, placement: "inside" } }));
    }
    angle += sweep;
  });
  // The hole is the ground the donut stands on: the page's, or the subject panel's tint.
  nodes.push(ellipsePrimitive({ id: key("hole"), role: "chart-hole", frame: { x: cx - hole / 2, y: cy - hole / 2, width: hole, height: hole }, style: fillStyle(token(highlighted ? "color.accentTint" : "color.canvas")), data: { item: item.label } }));
  if (centre !== null) {
    const k = categories.indexOf(centre), text = share(item.values[k]);
    // Set at the heading size where the hole holds it, else at the label size; a hole too small for either is a donut too
    // small for its trellis. It is the panel's figure, set large as a callout's figure is, not a label on a mark.
    const fits = [token("type.heading"), CHART_LABEL].map((size) => ({ size, m: measure(text, 400, true, size) })).find(({ m }) => m.width + 4 <= hole * 0.86 && m.height <= hole * 0.7);
    if (!fits) throw new Error(`panel "${item.label}": a hole ${Math.floor(hole)}px across cannot print "${text}"; give the trellis more room, fewer panels a row, or leave \`centre\` out`);
    nodes.push(textPrimitive({ id: key("centre"), role: "chart-centre-value", frame: { x: cx - hole / 2, y: cy - fits.m.height / 2, width: hole, height: fits.m.height }, text, style: textStyle(fits.size, SERIES[k], true, "center"), data: { item: item.label, category: centre, part: centre, value: item.values[k], centre: true } }));
  }
  return nodes;
}

/** One panel's marks: its columns, bars or line, their labels where few, its focus and its reference rule; or its stacks, or its donut. */
function panelNodes({ id, layout, panel, highlighted, props }) {
  const { mark, categories, reference } = layout;
  const { item, plot, bounds } = panel;
  const nodes = [];
  const key = (...parts) => stableId(id, "panel", panel.at, ...parts);
  if (layout.donut) return donutNodes({ layout, panel, key, props, highlighted });
  // The rest in the lead series, as a single-series chart is drawn, and the panel the page is about apart from them: in the
  // accent, or the primary where the accent is the lead's own colour (chart-axes.mjs subjectToken). In the house's primary,
  // every panel of the BA deck's small multiples was near-black and its subject the lighter of the two.
  const subject = highlightAmongSeries(), color = highlighted ? subject : SERIES[0];
  const n = categories.length;
  const along = sideways(mark) ? plot.height : plot.width;
  const slot = along / n;
  // A rank's line and its rule run with 1 at the top.
  const span = layout.rank ? (v) => 1 - (v - bounds.min) / bounds.span : (v) => (v - bounds.min) / bounds.span;
  const labelled = n <= LABELLED_MARKS && mark !== "line";
  // The axis the marks stand on, or the baseline under a line; a stack's is drawn over its first segments, which would
  // otherwise cover it and leave a stub at either end.
  const axis = sideways(mark)
    ? linePrimitive({ id: key("axis"), role: "chart-axis", x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height, style: lineStyle(INK) })
    : linePrimitive({ id: key("axis"), role: "chart-axis", x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height, style: lineStyle(mark === "line" ? GRID : INK) });
  if (layout.stacked) nodes.push(...stackNodes({ layout, panel, key, props }), axis);
  else if (mark === "line") {
    nodes.push(axis);
    const x =(i) => plot.x + (n === 1 ? plot.width / 2 : (plot.width * i) / (n - 1));
    const y = (v) => plot.y + plot.height - span(v) * plot.height;
    item.values.forEach((v, i) => {
      const next = item.values[i + 1];
      if (Number.isFinite(v) && Number.isFinite(next)) nodes.push(linePrimitive({ id: key("segment", i), role: "chart-line", x1: x(i), y1: y(v), x2: x(i + 1), y2: y(next), style: lineStyle(color, token("line.standard")), data: { item: item.label } }));
    });
    const last = item.values.map((v, i) => [v, i]).filter(([v]) => Number.isFinite(v)).at(-1);
    if (last) {
      nodes.push(ellipsePrimitive({ id: key("end"), role: "chart-marker", frame: { x: x(last[1]) - 3.5, y: y(last[0]) - 3.5, width: 7, height: 7 }, style: fillStyle(color), data: { item: item.label, category: categories[last[1]], value: last[0] } }));
      nodes.push(textPrimitive({ id: key("value"), role: "data-label", frame: { x: x(last[1]) + 6, y: y(last[0]) - 10, width: 40, height: 20 }, text: formatValue(last[0], props), style: textStyle(CHART_LABEL, INK, labelBold(), "left"), data: { item: item.label, category: categories[last[1]], value: last[0] } }));
    }
    if (item.focus !== undefined) {
      const i = categories.indexOf(String(item.focus)), v = item.values[i];
      if (Number.isFinite(v)) nodes.push(ellipsePrimitive({ id: key("focus"), role: "chart-marker", frame: { x: x(i) - 4.5, y: y(v) - 4.5, width: 9, height: 9 }, style: fillStyle(subject), data: { item: item.label, category: item.focus, value: v, focus: true } }));
    }
  } else {
    nodes.push(axis);
    const weight = n <= 4 ? 0.7 : 0.62;
    item.values.forEach((v, i) => {
      const at = i * slot + (slot * (1 - weight)) / 2, size = slot * weight;
      const zero = span(Math.max(bounds.min, Math.min(bounds.max, 0))), end = span(v);
      const focus = item.focus !== undefined && String(item.focus) === categories[i];
      const frame = mark === "bar"
        ? { x: plot.x + Math.min(zero, end) * plot.width, y: plot.y + at, width: Math.max(1, Math.abs(end - zero) * plot.width), height: Math.max(2, size) }
        : { x: plot.x + at, y: plot.y + plot.height - Math.max(zero, end) * plot.height, width: Math.max(2, size), height: Math.max(1, Math.abs(end - zero) * plot.height) };
      nodes.push(rectPrimitive({ id: key("mark", i), role: "chart-mark", frame, style: fillStyle(focus ? subject : color), data: { item: item.label, category: categories[i], value: v, ...(focus ? { focus: true } : {}) } }));
      if (labelled || focus) {
        const text = formatValue(v, props);
        const box = mark === "bar"
          ? { x: frame.x + frame.width + 4, y: frame.y + frame.height / 2 - 9, width: 32, height: 18 }
          : { x: frame.x - 8, y: frame.y - 18, width: frame.width + 16, height: 16 };
        nodes.push(textPrimitive({ id: key("value", i), role: "data-label", frame: box, text, style: textStyle(CHART_LABEL, INK, labelBold(), mark === "bar" ? "left" : "center"), data: { item: item.label, category: categories[i], value: v } }));
      }
    });
  }
  // The reference: a value given for the panel or the chart, or the panel's own mean, ruled across it and named.
  const values = scaled(item, layout.stacked);
  const ref = Number.isFinite(item.reference) ? item.reference : reference === "average" ? values.reduce((a, b) => a + b, 0) / values.length : Number.isFinite(reference) ? reference : null;
  if (ref !== null) {
    const at = span(ref);
    const text = reference === "average" && !Number.isFinite(item.reference) ? `Ø ${formatValue(ref, props)}` : formatValue(ref, props);
    if (sideways(mark)) {
      const x = plot.x + at * plot.width;
      nodes.push(linePrimitive({ id: key("reference"), role: "chart-reference-line", x1: x, y1: plot.y - 2, x2: x, y2: plot.y + plot.height, style: lineStyle(SECONDARY, token("line.hairline"), "dash"), data: { item: item.label, value: ref } }));
    } else {
      const y = plot.y + plot.height - at * plot.height;
      nodes.push(linePrimitive({ id: key("reference"), role: "chart-reference-line", x1: plot.x, y1: y, x2: plot.x + plot.width, y2: y, style: lineStyle(SECONDARY, token("line.hairline"), "dash"), data: { item: item.label, value: ref } }));
    }
    const width = Math.ceil(measure(text, 200).width) + 2;
    // Named where it reads as the panel's own figure and touches no mark: a bar panel's under the rule's foot; a column or
    // line panel's at the right of its title, or over its plot where the grid's headers stand in for titles.
    const titled = !layout.rowLabels;
    nodes.push(textPrimitive({ id: key("reference-label"), role: "chart-reference-label", frame: sideways(mark)
      ? { x: Math.min(plot.x + at * plot.width + 3, plot.x + plot.width + 30 - width), y: plot.y + plot.height - 2, width, height: 14 }
      : { x: panel.cell.x + panel.cell.width - width, y: titled ? panel.cell.y + 2 : plot.y - 16, width, height: 14 },
    text, style: { ...textStyle(token("type.compact"), SECONDARY, false, "right"), valign: "top" }, data: { item: item.label, value: ref, reference: true } }));
  }
  return nodes;
}

/** The trellis: the parts' key, headers, each panel's title and marks, and the shared category labels. */
export function smallMultiplesChart({ id, frame, props }) {
  const layout = smallMultiplesLayout(frame, props);
  const { mark, categories, cells, columns, rowLabels, columnLabels, top, left, parts } = layout;
  const highlighted = new Set((props.highlights || []).map((h) => String(h?.category ?? h)));
  const nodes = [];
  // One key over the trellis: a part keeps its colour in every panel, so it is named once.
  if (parts) nodes.push(...legendNodes({ id: stableId(id, "legend"), frame: { x: frame.x + layout.rowGutter + layout.categoryGutter, y: frame.y, width: frame.width - layout.rowGutter - layout.categoryGutter, height: layout.legend }, props: { placement: "top", items: parts.map((label, k) => ({ label, colorIndex: k })) } }));
  const headerTop = frame.y + layout.legend;
  if (columnLabels) columnLabels.forEach((label, c) => {
    const cell = cells[c].cell;
    nodes.push(textPrimitive({ id: stableId(id, "column-header", c), role: "category-label", frame: { x: cell.x, y: headerTop, width: cell.width, height: HEADER - 4 }, text: label, style: textStyle(AXIS_LABEL, INK, true, "left"), data: { header: "column" } }));
    nodes.push(linePrimitive({ id: stableId(id, "column-header-rule", c), role: "chart-gridline", x1: cell.x, y1: headerTop + HEADER - 3, x2: cell.x + cell.width, y2: headerTop + HEADER - 3, style: lineStyle(INK, token("line.hairline")) }));
  });
  if (rowLabels) rowLabels.forEach((label, r) => {
    const cell = cells[r * columns].cell, layoutText = measure(label, layout.rowGutter - 12, true);
    nodes.push(textPrimitive({ id: stableId(id, "row-header", r), role: "category-label", frame: { x: frame.x, y: cell.y + cell.height / 2 - layoutText.height / 2, width: layout.rowGutter - 12, height: layoutText.height }, text: layoutText.text,
      style: { ...textStyle(AXIS_LABEL, INK, true, "left"), valign: "top", lineHeight: layoutText.lineHeight, wrap: false }, data: { header: "row", textLayout: layoutText } }));
  });
  for (const panel of cells) {
    const subject = highlighted.has(panel.item.label);
    // A stack or a donut keeps a colour a part, so the subject's panel is set on the accent's tint, its title in the accent.
    if (subject && parts) nodes.push(rectPrimitive({ id: stableId(id, "panel", panel.at, "highlight"), role: "chart-panel-highlight", frame: { x: panel.cell.x - 6, y: panel.cell.y - 4, width: panel.cell.width + 12, height: panel.cell.height + 8 }, style: fillStyle(token("color.accentTint"), "none"), data: { item: panel.item.label, highlight: true } }));
    if (!rowLabels) nodes.push(textPrimitive({ id: stableId(id, "panel", panel.at, "title"), role: "category-label", frame: { x: panel.cell.x, y: panel.cell.y, width: panel.cell.width, height: TITLE }, text: panel.item.label,
      style: textStyle(AXIS_LABEL, subject ? ACCENT : INK, true, layout.donut ? "center" : "left"), data: { item: panel.item.label, panelTitle: true } }));
    nodes.push(...panelNodes({ id, layout, panel, highlighted: subject, props }));
  }
  // The shared axis, named once: under the bottom row's panels, or beside the left column's. A donut's parts are the key's.
  const n = categories.length;
  if (layout.donut) return nodes;
  if (sideways(mark)) {
    for (const panel of cells.filter((p) => p.col === 0)) {
      const slot = panel.plot.height / n;
      categories.forEach((category, i) => nodes.push(textPrimitive({ id: stableId(id, "category", panel.at, i), role: "category-label", frame: { x: left - layout.categoryGutter, y: panel.plot.y + i * slot + slot / 2 - 8, width: layout.categoryGutter - 6, height: 16 }, text: category, style: textStyle(AXIS_LABEL, SECONDARY, false, "right"), data: { category } })));
    }
  } else {
    const bottom = Math.max(...cells.map((p) => p.row));
    for (const panel of cells.filter((p) => p.row === bottom || (p.row === bottom - 1 && !cells.some((q) => q.row === bottom && q.col === p.col)))) {
      const { plot } = panel, slot = plot.width / n;
      const x = (i) => (mark === "line" ? plot.x + (n === 1 ? plot.width / 2 : (plot.width * i) / (n - 1)) : plot.x + (i + 0.5) * slot);
      const widest = Math.max(...categories.map((c) => measure(c, 400, false, AXIS_LABEL).width));
      const every = Math.max(1, Math.ceil((widest + 6) / Math.max(1, mark === "line" ? plot.width / Math.max(1, n - 1) : slot)));
      categories.forEach((category, i) => {
        if (i % every !== 0 && i !== n - 1) return;
        if (i === n - 1 && i % every !== 0 && (i - Math.floor(i / every) * every) * (plot.width / n) < widest + 6) return;
        const width = Math.ceil(measure(category, 400, false, AXIS_LABEL).width) + 4;
        nodes.push(textPrimitive({ id: stableId(id, "category", panel.at, i), role: "category-label", frame: { x: Math.max(panel.cell.x - 4, Math.min(x(i) - width / 2, panel.cell.x + panel.cell.width - width + 4)), y: plot.y + plot.height + 3, width, height: AXIS - 2 },
          text: category, style: textStyle(AXIS_LABEL, SECONDARY, false, "center"), data: { category } }));
      });
    }
  }
  return nodes;
}
