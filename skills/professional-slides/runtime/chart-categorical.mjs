// Charts on a category axis: column, bar, stacked column and stacked bar
// (`categoricalChart`), with what only they set beside their categories - the
// row labels of a bar chart, icons and logos under or beside a category,
// deltas, stack labels and the period a chart focuses on by default.
import { token, rectPrimitive, stableId, ellipsePrimitive, TOKENS, defaultHighlightStyle, linePrimitive, textPrimitive, tokenValue, onFill, shapePrimitive } from "./core.mjs";
import { formatValue, withUnit } from "./value-format.mjs";
import { iconDefinition, unknownIcon } from "./icons.mjs";
import { iconMarker } from "./marks.mjs";
import { mediaNode, logoFrame, markDrawable, flagFrame, flagPlaceholder, isFlag, FLAG_ASPECT } from "./media.mjs";
import { ENGINE_RESERVE, measureText } from "./text-layout.mjs";
import { FONT, INK, SECONDARY, CHART_LABEL, AXIS_LABEL, SERIES, SUBJECT, CONTEXT_FILL, rowLabels, VALUE_HEADROOM, BAR_HEADROOM, LABEL_BAND, labelBand, markWeight, tableSpan,
  chartFrame, labelBold, textStyle, lineStyle, fillStyle, topLegend, legendRowsFor, assertGridlineOption, resolveValueAxis,
  normalizedCategoricalData, numericBounds, periodLabelStep, axes, horizontalAxes, axisLabelWidth } from "./chart-axes.mjs";
import { withReferenceValues, REGION_HIGHLIGHT_INLINE_PAD, normalizedHighlights, periodBandHeight, withDecorations, measureDataLabel,
  growthColumns, seriesState, stateLabel, markerGutter, isMarker, MARKER_ROW } from "./chart-decorations.mjs";
import { bandAxis } from "./chart-bands.mjs";
import { spacedLabelIndices, timePositions } from "./time-axis.mjs";
import { categoryBreakNodes, cutGap, datedRun, slotBreaks, valueBreakNodes, valueCut } from "./axis-breaks.mjs";
import { assertComparison } from "./chart-sense.mjs";
import { placeLabels } from "./label-placement.mjs";
import { normalizeGroupBrackets, bracketGutter, bracketNodes, BRACKET_BAND, normalizeValueLabels, labelRings, normalizeRowNotes, rowNoteNodes, ROW_NOTE_GAP } from "./chart-marks.mjs";

// The smallest a crowded row of bars sets its names and values at (8pt)
// before it labels every nth row instead.

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
        secondary.set(key, props.secondaryLabelStyle === "parenthetical" ? formatValue(record.value, record) : withUnit(formatValue(record.value, record), record.unit));
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

/**
 * `categoryIcons`: a mark beside each category's label - an icon name from
 * runtime/icons.mjs, `{ image }` for a brand logo, or `{ flag: "France" }`
 * for a country's flag (planned by the compile as `{ image: { flag, alt } }`,
 * flags.mjs). A well-made page sets logos under columns and flags beside bars
 * where the reader knows the mark before the name. An image not yet supplied
 * is planned as `{ image: { alt } }` and draws an empty frame the picture
 * gate holds. A declared player's mark planned as `{ image: { alt: "<Name> logo" } }` is
 * the mark it declares (players.mjs): a place's is its outline, drawn from
 * the geography data. Takes a map from category to entry, or an array in
 * category order.
 */
function normalizeCategoryIcons(props, categories) {
  if (props.categoryIcons === undefined || props.categoryIcons === null) return null;
  const source = props.categoryIcons;
  if (typeof source !== "object") throw new Error("categoryIcons takes a map from category to icon, or an array in category order");
  const entries = Array.isArray(source) ? source.map((entry, index) => [categories[index], entry]) : Object.entries(source);
  const map = new Map();
  for (const [category, entry] of entries) {
    if (!categories.includes(category)) throw new Error(`categoryIcons names "${category}", which is not a chart category`);
    if (entry === null || entry === undefined) continue;
    const record = typeof entry === "string" ? { icon: entry } : entry;
    if (record.icon !== undefined && !iconDefinition(record.icon)) throw new Error(unknownIcon(record.icon, "category icon"));
    // A country's name is read into its flag where the page compiles (flags.mjs planFlags); a spec written by hand plans the picture itself.
    if (record.flag !== undefined) throw new Error(`Category mark for "${category}" names a flag, which is planned when its page compiles from the pages file; in a spec written by hand, write { image: { flag: "<ISO code>", alt: "Flag of ..." } }`);
    if (record.icon === undefined && !record.image) throw new Error(`Category icon for "${category}" needs an icon name or an image`);
    if (record.image && !record.image.dataUri && !String(record.image.alt ?? "").trim()) throw new Error(`Category image for "${category}" needs a file, or alt text naming the one to come`);
    map.set(category, record);
  }
  return map.size ? map : null;
}

function categoryIconNodes(id, category, record, box, { area, align } = {}) {
  if (record.icon !== undefined) return iconMarker({ id: stableId(id, "category-icon", category), role: "category-icon", x: box.x, y: box.y, size: box.width, icon: record.icon, tone: record.tone ?? "plain", data: { category } });
  // A flag stands at the slot's height at its own proportions, level with its neighbours; one not yet fetched keeps a
  // flag-shaped slot.
  if (isFlag(record.image)) {
    const drawable = markDrawable(record.image);
    const frame = flagFrame(box, drawable ? record.image.width : FLAG_ASPECT, drawable ? record.image.height : 1, { align });
    return [drawable ? mediaNode({ id: stableId(id, "category-logo", category), frame, props: record.image, role: "category-logo" })
      : flagPlaceholder({ id: stableId(id, "category-logo-placeholder", category), role: "category-logo-placeholder", frame, data: { category, alt: record.image.alt, flag: record.image.flag } })];
  }
  // A place's outline is drawn as its mark; a logo or photograph not yet fetched keeps its slot as a placeholder.
  if (!markDrawable(record.image)) return [rectPrimitive({ id: stableId(id, "category-logo-placeholder", category), role: "category-logo-placeholder", frame: box, style: { fill: token("color.surfaceMuted"), stroke: token("color.rule"), lineWidth: token("line.hairline"), radius: token("radius.none") }, data: { category, alt: record.image.alt } })];
  const frame = area ? logoFrame(box, record.image.width, record.image.height, { area, align }) : box;
  return [mediaNode({ id: stableId(id, "category-logo", category), frame, props: record.image, role: "category-logo" })];
}

/** deltas: [n, …] aligned with the categories, or [{ category, value, significant? }]. */
function normalizeDeltas(props, categories) {
  if (props.deltas === undefined || props.deltas === null) return null;
  if (!Array.isArray(props.deltas)) throw new Error("Chart deltas must be an array");
  const map = new Map();
  props.deltas.forEach((entry, index) => {
    const record = typeof entry === "number" ? { category: categories[index], value: entry } : entry;
    if (!record || !categories.includes(record.category) || !Number.isFinite(record.value)) throw new Error("Each chart delta needs a known category and a finite value");
    map.set(record.category, { value: record.value, significant: record.significant ?? Math.abs(record.value) >= (props.deltaThreshold ?? 5) });
  });
  return map;
}

// Words that place a series in time without a date: the early ones name the
// reference a change is measured from, the late ones the state the page is
// about. "Actual" sits late because it is read against a plan or a budget.
const PERIOD_EARLY = /\b(?:before|pre|prior|previous|baseline|base year|historic(?:al)?|old|original|plan|budget|last year)\b/i;
const PERIOD_LATE = /\b(?:after|post|current|today|now|latest|forecast|projected|projection|outlook|estimate|future|target|new|next|actual|this year|pro forma)\b/i;

/** Where a name sits in time, or null when it does not read as a period. */
function periodKey(name) {
  const text = String(name ?? "");
  const full = text.match(/(?<!\d)((?:19|20)\d{2})(?!\d)/)?.[1], short = text.match(/\b(?:FY|CY)\s*'?(\d{2})(?!\d)/i)?.[1];
  const year = full ? Number(full) : short ? 2000 + Number(short) : 0;
  const sub = Number(text.match(/\bQ([1-4])\b/i)?.[1] ?? 0) || Number(text.match(/\bH([12])\b/i)?.[1] ?? 0) * 2;
  if (year) return year * 10 + sub;
  if (sub) return sub;
  if (PERIOD_LATE.test(text)) return 1e6;
  if (PERIOD_EARLY.test(text)) return -1e6;
  return null;
}

/**
 * The peer a two-mark contrast paints in the primary when the author named
 * none. A comparison written in time order ("2019", "2024"; "FY2024-25",
 * "FY2025-26"; "Pre-COVID", "Current") is about its latest period, so when
 * every name reads as a period, the latest is the point (the last on a tie);
 * otherwise the first stays the subject, as peers are written subject first
 * ("Emirates", "Qatar"). An explicit
 * `focusSeries` always wins. The change bracket reads focus minus the other,
 * so it follows the same choice (compose-charts.mjs).
 */
export function defaultFocusIndex(names, focus) {
  if (focus !== undefined) return names.indexOf(focus);
  const keys = names.map(periodKey);
  if (keys.length < 2 || keys.some((key) => key === null)) return 0;
  const latest = Math.max(...keys);
  return keys.filter((key) => key === latest).length === 1 ? keys.indexOf(latest) : names.length - 1;
}

/**
 * A reference label that finds no free corner inside the plot moves outside.
 *
 * Callouts take the band above the plot and drop leaders through it, value
 * labels ride the column tops, and a target line near the tallest column can
 * find all four inside corners taken. `placement: "outside-end"` sets the
 * label in a right gutter, level with its line, but the gutter narrows the
 * plot, so it has to be decided before the marks are laid out. The chart
 * renders once as authored; a line whose label was left to the chart (no
 * `placement`) and failed inside is set outside-end and the chart renders
 * again, one line at a time. A horizontal chart has no right gutter on its
 * value axis, and an author who asked for "inside" meant it, so both keep the
 * error. Stack totals the page did not write are dropped before any error is kept.
 */
export function categoricalChart(context) {
  let props = context.props;
  for (;;) {
    try { return categoricalChartOnce({ ...context, props }); }
    catch (error) {
      const reference = props.referenceLines?.[error.referenceIndex];
      if (reference && !context.horizontal && reference.placement === undefined) {
        props = { ...props, referenceLines: props.referenceLines.map((line, index) => index === error.referenceIndex ? { ...line, placement: "outside-end" } : line) };
        continue;
      }
      // Columns too narrow for their values are read off a value axis instead (columnLabelsFit).
      if (error.labelsCrowded && !(props.dataLabels === false && props.showValueAxis === true)) { props = { ...props, dataLabels: false, showValueAxis: true }; continue; }
      // Stack totals the composer computed (compose-exhibits.mjs withStackTotals) give way to what the page wrote.
      if (!props.stackTotalsComputed) throw error;
      const { stackTotals: _totals, stackTotalsComputed: _computed, ...rest } = props;
      props = rest;
    }
  }
}

/**
 * One layout of a column, bar, stacked column or stacked bar chart. The steps
 * run in the order the layout depends on them - the props read, the gutters
 * beside and under the plot measured, the plot framed, the value scale and
 * colours chosen, the marks drawn category by category, then what is set over
 * them - and share one record, `chart`: each step reads what the steps before
 * it settled and adds its own. The props are refused in the order the checks
 * appear, step by step.
 */
function categoricalChartOnce({ id, frame, props, horizontal = false, stacked = false, tokens = TOKENS }) {
  const chart = { id, frame, props, horizontal, stacked, tokens };
  Object.assign(chart, categoricalData(chart));
  Object.assign(chart, divergingPlan(chart));
  Object.assign(chart, valueBreakPlan(chart));
  Object.assign(chart, labelGutters(chart));
  Object.assign(chart, attachmentGutters(chart));
  Object.assign(chart, columnLabelPlan(chart));
  Object.assign(chart, categoricalPlot(chart));
  Object.assign(chart, categoryGroupLayouts(chart));
  Object.assign(chart, categoricalBounds(chart));
  // Columns over periods show a change a reader can see (chart-sense.mjs): a stack's in its parts, since a mix can move while
  // its total holds; a cut axis answers to the cut's own rule.
  if (!chart.valueBreak && !chart.diverging) assertComparison({ id, categories: chart.categories, props, dated: !horizontal && datedRun(chart.categories), span: chart.bounds.span, series: chart.recorded });
  Object.assign(chart, categoricalColors(chart));
  Object.assign(chart, categoricalAxes(chart));
  Object.assign(chart, brokenScales(chart));
  Object.assign(chart, rowLabelling(chart));
  columnLabelsFit(chart);
  Object.assign(chart, barSpans(chart));
  drawDeltaHeadings(chart);
  // Unstacked bars and columns place their values together once every bar is drawn (placeBarLabels).
  chart.barLabels = !stacked && !chart.diverging && !chart.valueBreak && chart.showDataLabels ? [] : null;
  chart.categories.forEach((category, categoryIndex) => drawCategory(chart, category, categoryIndex));
  placeBarLabels(chart);
  drawValueBreaks(chart);
  drawCategoryBreaks(chart);
  drawDivergingCentre(chart);
  drawForecastDivider(chart);
  drawCategoryGroups(chart);
  keepValueLabelsOffReferenceLines(chart);
  drawSegmentGrowth(chart);
  drawGroupBrackets(chart);
  chart.nodes.push(...labelRings({ id, nodes: chart.nodes, valueLabels: chart.valueLabels }));
  drawRowNotes(chart);
  const { nodes, chartProps, plot, pointMap, categoryMap, yScale, xScale } = chart;
  return withDecorations(nodes, {
    id,
    plot,
    props: chartProps,
    pointMap,
    categoryMap,
    yScale: horizontal ? null : yScale,
    xScale: horizontal ? xScale : null,
    allowBarHighlight: true,
    allowMarkers: true,
    allowAnnotationRail: !horizontal,
    allowOutsideReferenceLabels: !horizontal
  });
}

/**
 * The chart's data and what its props decide before anything is measured:
 * the highlights, the subject series, the forecast key, the legend, data
 * labels and the value axis.
 */
function categoricalData(chart) {
  const { id, props, horizontal, stacked } = chart;
  assertGridlineOption(props);
  if (horizontal && props.categoryColumns) throw new Error(`${id}: a data table's columns run across the page, and a bar chart's categories run down it - set the table beside the bars as a column, or draw columns`);
  // A gap in a series (null) draws no bar and no label, and counts as nothing in a stack (drawCategoryMarks); the series as
  // recorded, gaps and all, is what the sense check reads.
  const { categories, series: recorded } = normalizedCategoricalData(props, { gaps: true });
  const gaps = new Set(recorded.flatMap((item, si) => item.values.flatMap((value, ci) => (value === null ? [`${si}:${ci}`] : []))));
  if (gaps.size && props.diverging) throw new Error(`${id}: a diverging scale sets every answer of a row side by side, and ${[...gaps].length} have no value - give each row its answers, or leave the row out`);
  const series = recorded.map((item) => ({ ...item, values: item.values.map((value) => value ?? 0) }));
  // A rank (measures.mjs isRankMeasure) is a place with 1 at the top: a bar's length would draw the worst place as the
  // most. The BA retest's Skytrax panel drew 23rd as a longer bar than 2nd. Dots on a rank axis, or a table, say it.
  const ranks = series.filter((item) => item.rank === true);
  if (ranks.length) throw new Error(`RANK_FILLED: ${ranks.map((item) => item.name).join(", ")} is a rank, and a ${horizontal ? "bar" : "column"}'s length would draw the worst place as the largest - set the places in a table (a ranking page), or draw a change of rank over time as chart.line, which sets 1 at the top`);
  const stackLabels = stackLabelPlan(props, categories, series, stacked);
  const highlights = normalizedHighlights(props, { categories, series, allowBar: !stacked,
    defaultStyle: stacked ? "region-tint" : defaultHighlightStyle(horizontal ? "chart.bar" : "chart.column", { series }) });
  // Every highlighted bar takes the accent, not only the first: a fleet page
  // marking two aircraft variants lights both.
  const barHighlighted = new Set(highlights.filter(highlight => highlight.style === "bar").map(highlight => highlight.category));
  const barHighlight = barHighlighted.size > 0;
  const regionHighlight = highlights.find(highlight => highlight.style === "region-box" || highlight.style === "region-tint");
  if (props.focusSeries !== undefined) {
    if (stacked || series.length < 2) throw new Error("focusSeries needs two unstacked series or more; a stack keeps a colour per part");
    if (!series.some(item => item.name === props.focusSeries)) throw new Error("focusSeries must name an exact chart series");
    if (props.colorIndices !== undefined) throw new Error("focusSeries conflicts with an explicit colour-index mapping");
  }
  const chartProps = { ...props, highlights };
  // `forecastFrom` greys every column from that category on, and grey alone
  // is a colour the reader has to decode with nothing to decode it against:
  // three dark and three grey columns never say what grey means. Where the tint
  // applies (one unstacked series) the chart keys it - a legend naming the
  // actual and forecast runs (`actualLabel`/`forecastLabel`, "Actual" and
  // "Forecast" by default) - and draws a dashed divider at the boundary, so
  // the split survives greyscale printing and a reader who cannot tell the
  // tints apart. The key is not the series legend: the composer sets `legend:
  // false` on every single-series chart, which says there is no series list
  // to show, not that the forecast needs no key; `forecastKey: false` drops it.
  const forecastKeyed = props.forecastFrom !== undefined && !stacked && series.length === 1;
  if (forecastKeyed && [props.actualLabel, props.forecastLabel].some(label => label !== undefined && (typeof label !== "string" || !label.trim()))) throw new Error("actualLabel and forecastLabel must be nonempty text");
  const forecastLegend = forecastKeyed ? [...(categories.indexOf(props.forecastFrom) > 0 ? [props.actualLabel?.trim() || "Actual"] : []), props.forecastLabel?.trim() || "Forecast"] : [];
  const showLegend = forecastKeyed ? props.forecastKey !== false : props.legend !== false && series.length > 1;
  const values = series.flatMap((item) => item.values);
  // Every mark carries its value while the marks are countable: a well-made
  // page prints twelve labels as readily as four, and a labelled mark is a
  // block of evidence where an axis is a lookup table. `dataLabels: false`
  // still declines, and a dense chart falls back to the axis.
  const markCount = series.length * categories.length;
  // A broken axis (valueBreak) leaves no scale to read, and a diverging scale's answers are read share by share, so their
  // marks carry their values however many there are.
  const showDataLabels = props.dataLabels === true || stackLabels.totals.size > 0 || stackLabels.secondary.size > 0 || (props.dataLabels !== false && (series.length === 1 || markCount <= 12 || Boolean(props.valueBreak) || Boolean(props.diverging)));
  const showValueAxis = resolveValueAxis(props, { valueCount: values.length, dataLabelsVisible: showDataLabels });
  // A label said another way - a range, an approximation - or ringed (chart-marks.mjs).
  const valueLabels = normalizeValueLabels(props, categories, series);
  if (valueLabels.size && !showDataLabels) throw new Error("valueLabels change the values printed on the marks, and this chart prints none; drop dataLabels: false, or say it in a callout");
  return { categories, series, recorded, gaps, stackLabels, barHighlighted, barHighlight, regionHighlight, chartProps, forecastKeyed, forecastLegend,
    showLegend, values, showDataLabels, showValueAxis, valueLabels };
}

/**
 * The label gutters: the width of the bars' value labels, the category label
 * column of a bar chart with its icons or logos and its notes (or the note
 * column at the right, when the lanes are too thin for a two-line block), and
 * the room left of zero for negative bars' labels.
 */
function labelGutters(chart) {
  const { frame, props, horizontal, stacked, categories, values, showDataLabels } = chart;
  const barLabelGap = tokenValue(token("space.3"));
  const barLabelWidth = Math.max(50, ...(props.comparisonDomain?.values ?? values).map(value => Math.ceil(measureText(formatValue(value, props), 300, {fontFamily: tokenValue(FONT), fontSize: tokenValue(CHART_LABEL), bold: true}).width)));
  // `categoryLabels: false`: the right panel of a paired bar chart shares the
  // left panel's category column and draws none of its own.
  const hideCategoryLabels = horizontal && props.categoryLabels === false;
  const categoryIcons = hideCategoryLabels ? null : normalizeCategoryIcons(props, categories);
  const iconSize = categoryIcons ? (horizontal ? 22 : 28) : 0;
  // A logo is a wordmark, not a glyph: it takes a wide box (letterboxed, so a
  // square mark keeps its shape) where an icon takes a square one.
  const logoMarks = categoryIcons ? [...categoryIcons.values()].some((record) => record.image) : false;
  // Flags alone take a slot of a flag's own size: at a logo's 64px a row of
  // 3:2 flags 24px tall would push the bars a third of the way in for nothing.
  // The slot runs to 2:1, the United Kingdom's; a longer flag is narrowed.
  const flagMarks = logoMarks && [...categoryIcons.values()].every((record) => isFlag(record.image));
  const iconW = flagMarks ? (horizontal ? 32 : 40) : logoMarks ? (horizontal ? 64 : 72) : iconSize, iconH = flagMarks ? (horizontal ? 16 : 20) : logoMarks ? (horizontal ? 24 : 28) : iconSize;
  const iconSlot = categoryIcons ? (horizontal ? iconW : iconH) + 6 : 0;
  // Category notes on a bar chart sit under their label as a two-line block
  // centred on the bar. When the lanes are too thin for that block, the notes
  // move to a column of their own at the right of the bars - one line each,
  // level with its bar - rather than wrapping into the next bar's lane.
  const axisText = (text, width) => measureText(text, width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL) });
  const noteTexts = horizontal && !hideCategoryLabels ? (props.categoryNotes || []).filter((n) => typeof n === "string" && n.trim()) : [];
  const baseLabelWidth = barLabelColumn(props.comparisonDomain?.categories ?? categories);
  const noteWidth = noteTexts.length ? Math.min(220, Math.ceil(Math.max(...noteTexts.map((n) => axisText(n, 400).width))) + 12) : 0;
  const estimatedLane = horizontal ? Math.max(1, (frame.height - 56) / Math.max(1, categories.length)) : Infinity;
  const blockHeight = noteTexts.length ? Math.max(...noteTexts.map((n) => axisText(n, Math.max(baseLabelWidth, Math.min(240, noteWidth))).height)) + axisText("Ag", 180).height : 0;
  const noteColumn = noteTexts.length > 0 && blockHeight > estimatedLane;
  // `categoryLabel: "above"`: a long statement set over its bar across the plot's width, as a survey sets it, where a
  // label column at the left would hold three words a line.
  if (props.categoryLabel !== undefined && props.categoryLabel !== "above" && props.categoryLabel !== "beside") throw new Error("categoryLabel is \"above\" (each label over its bar) or \"beside\" (the label column, the default)");
  const labelAbove = props.categoryLabel === "above";
  if (labelAbove && !horizontal) throw new Error("categoryLabel \"above\" sets a bar's label over it; a column chart names its columns under them - draw the statements as bars");
  if (labelAbove && noteTexts.length) throw new Error("a label set above its bar has no line for a category note; put the note in the label, or in rowNotes beside the bar");
  const horizontalCategoryLabelWidth = horizontal && !hideCategoryLabels
    ? iconSlot + (labelAbove ? 0 : noteTexts.length && !noteColumn ? Math.max(baseLabelWidth, Math.min(240, noteWidth)) : baseLabelWidth)
    : 0;
  const noteColumnWidth = noteColumn ? noteWidth + 8 : 0;
  const negativeLabelGutter = horizontal && !stacked && showDataLabels && (props.comparisonDomain?.values ?? values).some(v=>v<0) ? barLabelWidth + barLabelGap : 0;
  // A bar chart's category groups name their runs of rows in a column left of the row labels, each against a bracket.
  const groupColumnWidth = horizontal && !hideCategoryLabels && Array.isArray(props.categoryGroups) && props.categoryGroups.length
    ? Math.min(GROUP_LABEL_WIDTH, Math.ceil(Math.max(...props.categoryGroups.map((group) => axisText(String(group?.label ?? ""), GROUP_LABEL_WIDTH).width)))) + 18 : 0;
  const rowNotes = normalizeRowNotes(props, categories, { horizontal, frame });
  return { barLabelGap, barLabelWidth, hideCategoryLabels, categoryIcons, logoMarks, iconW, iconH, iconSlot, axisText, noteWidth,
    noteColumn, horizontalCategoryLabelWidth, noteColumnWidth: noteColumnWidth + (rowNotes ? rowNotes.width + ROW_NOTE_GAP : 0), negativeLabelGutter, groupColumnWidth, labelAbove, rowNotes };
}

// The widest a bar chart's group label sets before it wraps.
const GROUP_LABEL_WIDTH = 120;
// A label set over its bar starts this far in from the axis the bar stands on.
const ABOVE_INSET = 6;

/**
 * The room the marks' attachments take around the plot: stack totals,
 * reference labels set outside the plot, the delta column (bars) or band
 * (columns), the segment-growth column and the stack bracket.
 */
function attachmentGutters(chart) {
  const { props, horizontal, stacked, categories, series, stackLabels, barLabelGap } = chart;
  const totalTexts = new Map([...stackLabels.totals].map(([category, record]) => [category,
    attachedLabelText(formatValue(record.value, props), stackLabels.secondary.get(`${category}:stack-total`),props)]));
  const totalMetrics = [...totalTexts.values()].map(text => measureDataLabel(text));
  const totalHeight = totalMetrics.length ? Math.max(...totalMetrics.map(item => item.height)) + barLabelGap : 0;
  const totalWidth = totalMetrics.length ? Math.max(...totalMetrics.map(item => item.width)) + barLabelGap : 0;
  for(const reference of props.referenceLines || []) if(reference.placement !== undefined && !["inside", "outside-end"].includes(reference.placement)) throw new Error("Unknown reference-line label placement");
  if(horizontal && (props.referenceLines || []).some(r=>r.placement === "outside-end")) throw new Error("Outside reference labels require a vertical quantitative axis");
  // Average markers (chart-decorations.mjs) on a column chart sit at the plot's right, past any outside reference label.
  const referenceGutter = Math.max(0,...(props.referenceLines || []).filter(r=>r.placement === "outside-end").map(r=>measureDataLabel(r.label || String(r.value)).width + barLabelGap)) + (horizontal ? 0 : markerGutter(props));
  if (horizontal && (props.referenceLines || []).some(isMarker) && props.showValueAxis === true) throw new Error("an average marker sits under the bars, where a value axis sets its ticks; with the values on the bars drop showValueAxis, or draw the average as a reference line");
  // A delta column (change versus the previous survey) sits to the right of
  // horizontal bars: a signed value in a tinted disc per category.
  const deltas = normalizeDeltas(props, categories);
  // `segmentGrowth: { from, to, label? }` on a stacked column: the rate per
  // segment between two categories in a column at the right, aligned to the
  // last stack's segments (a "CAGR 2019–23" column); a list of up to three sets
  // their columns side by side, level with the last stack.
  const segmentGrowth = stacked && !horizontal && props.segmentGrowth ? growthColumns(props.segmentGrowth, categories, series, "segmentGrowth") : null;
  const deltaWidth = (deltas && horizontal ? 64 : 0) + (segmentGrowth ? 76 * segmentGrowth.length : 0);
  // On columns the deltas are pills in a band above the plot, one over each
  // column, clear of the value labels and any stack totals, under a heading.
  if (deltas && !horizontal && (props.periods || props.events || (props.bands || []).some((band) => band?.label && bandAxis(band) === "category"))) throw new Error("Column deltas take the band periods, events and a labelled category band use; show one or the other");
  const deltaClear = deltas && !horizontal ? Math.max(26, totalHeight + 4) : 0;
  // A bar chart's delta column is headed just over the plot; under a legend that heading takes a row of its own, where the
  // legend's right-hand keys would otherwise print across it.
  const deltaBand = deltas && !horizontal ? deltaClear + 22 + 20 : deltas && horizontal && chart.showLegend ? 22 : 0;
  // A bracket subtotal on a stacked column spans the named segments and prints their sum beside the stack.
  const stackBracket = stacked && !horizontal && Array.isArray(props.stackBracket) && props.stackBracket.length ? props.stackBracket : null;
  if (stackBracket && stackBracket.some((name) => !series.some((item) => item.name === name))) throw new Error("stackBracket must name series of the chart");
  if (horizontal && (props.periods || props.events)) throw new Error("periods and events annotate vertical columns and lines, not horizontal bars");
  // Group brackets (chart-marks.mjs): a column of brackets right of a bar chart's values, a band over a column chart's.
  const brackets = normalizeGroupBrackets(props, categories, series, { stacked });
  if (brackets.length && !horizontal && (deltas || props.periods || props.events)) throw new Error("group brackets take the band over the columns that deltas, periods and events use; show one or the other");
  const bracketWidth = horizontal ? bracketGutter(brackets) : 0, bracketBand = !horizontal && brackets.length ? BRACKET_BAND : 0;
  return { totalTexts, totalHeight, totalWidth, referenceGutter, deltas, segmentGrowth, deltaWidth, deltaClear, deltaBand, stackBracket, brackets, bracketWidth, bracketBand };
}

/** The column labels' face, the category notes, and `columnLabels(width)`: the labels laid out at a plot width. */
function columnLabelPlan(chart) {
  const { frame, props, horizontal, categories, iconSlot } = chart;
  // Periods too many for their slots are labelled every nth, counted back from
  // the latest so it keeps its label, each label free to use the slots it
  // skips - as the line chart does. Three ten-year column panels in a row
  // leave 25px a slot, narrower than an unbreakable "FY17" (29px).
  // Only periods thin: every category carries a digit, so a skipped label is
  // one the reader counts to. Named categories keep every label, and a name
  // wider than its slot still fails, for the author to shorten.
  const axisFont = { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL), wrapWidthRatio: ENGINE_RESERVE };
  const widestWord = horizontal ? 0 : Math.max(...categories.flatMap(category => String(category).split(/\s+/).map(word => measureText(word, 1000, axisFont).width)));
  const periodic = !horizontal && categories.length > 2 && categories.every(category => /\d/.test(String(category))) && !(props.categoryNotes || []).some(Boolean);
  // One note per category, in category order; `null` or a missing entry leaves
  // that category with its label alone.
  if (props.categoryNotes !== undefined && (!Array.isArray(props.categoryNotes) || props.categoryNotes.length > categories.length)) throw new Error("categoryNotes takes one entry per category, in category order");
  const categoryNotes = categories.map((_, index) => {
    const note = (props.categoryNotes || [])[index];
    return typeof note === "string" && note.trim() ? note.trim() : null;
  });
  // The column labels at a plot width, and the height of their band: the
  // frame settles the band on it (chartFrame `labels`), and the columns are
  // named from the same measure.
  const columnLabels = (width) => {
    const labelStep = periodLabelStep(categories.length, periodic ? Math.max(1, Math.ceil((widestWord + 8) / (width / categories.length))) : 1);
    const labelSpan = width / categories.length * labelStep.every - 8;
    const layouts = categories.map(category => {
      try { return measureText(category, labelSpan, axisFont); }
      catch (error) {
        if (!/Unbreakable text/.test(error.message)) throw error;
        const word = Math.max(...String(category).split(/\s+/).map(part => measureText(part, 1000, axisFont).width));
        const fit = Math.max(1, Math.floor(width / (widestWord + 8)));
        throw new Error(`Column names are wider than their columns: "${String(category)}" needs ${Math.ceil(word)}px and each of ${categories.length} columns has ${Math.floor(labelSpan)}px in this ${Math.round(frame.width)}px chart, which holds about ${fit} columns named this long; shorten the names, use a bar chart, or give the chart a wider panel (author-deck --types lists the columns a panel holds)`);
      }
    });
    const height = iconSlot + Math.max(...layouts.map(label => label.height)) + (categoryNotes.some(Boolean) ? Math.max(...layouts.map(label => label.lineHeight)) : 0);
    return { labelStep, labelSpan, layouts, height };
  };
  return { axisFont, categoryNotes, columnLabels };
}

/** The plot inside the frame, after every band and gutter, and the column labels laid out at its width. */
function categoricalPlot(chart) {
  const { frame, props, horizontal, stacked, categories, series, regionHighlight, forecastKeyed, forecastLegend, showLegend,
    showDataLabels, showValueAxis, barLabelGap, barLabelWidth, iconSlot, axisText, horizontalCategoryLabelWidth, noteColumnWidth,
    negativeLabelGutter, totalHeight, totalWidth, referenceGutter, deltaWidth, deltaBand, columnLabels, bracketWidth, bracketBand, groupColumnWidth, values } = chart;
  // The band under the columns is their labels': estimated at the slot the
  // plot will give each column, so the frame's own height checks count the
  // room it leaves, and settled on the measured labels once the plot is laid
  // out. A grid of small column panels failed its minimum plot height on the
  // fixed 56px when one-line period labels needed 34.
  const labelGap = regionHighlight ? 18 : 8;
  const estimatedSlot = (frame.width - 2 * (showValueAxis ? 54 : 16)) / Math.max(1, categories.length) - 8;
  const categoryBand = horizontal || (props.categoryNotes || []).some(Boolean) ? LABEL_BAND
    : labelBand(labelGap, iconSlot + Math.max(...categories.map((c) => { try { return axisText(String(c), Math.max(1, estimatedSlot)).height; } catch { return 28; } })));
  const plot = chartFrame(frame, {
    topInset: props.plotTopInset,
    // Horizontal categories live to the left; only an exposed value axis
    // needs a bottom label band. The column-chart gutter left bars floating.
    bottomInset: horizontal ? (showValueAxis ? 32 : 12) + ((props.referenceLines || []).some(isMarker) ? MARKER_ROW : 0) : categoryBand,
    ...(horizontal ? {} : { labels: { gap: labelGap, height: (width) => columnLabels(width).height } }),
    headroom: horizontal ? BAR_HEADROOM : VALUE_HEADROOM,
    topLegend: showLegend ? legendRowsFor(forecastKeyed ? forecastLegend : series.map((item) => item.name), frame) : false,
    annotations: props.annotations,
    changeAnnotations: props.changeAnnotations,
    annotationRail: props.annotationRail,
    periodBand: periodBandHeight(props, categories, { horizontal }) + deltaBand + bracketBand,
    // The left gutter is the value axis's: 54px holds "1,200" and its tick, and wider ticks ("2,500,000") take what they need,
    // read off the scale the values will take (the final scale is set once the plot's height is known, categoricalBounds).
    // With the numbers on the marks there is no axis to hold, and a vertical
    // category label never leaves its own slot, so the plot keeps the width the
    // axis would have taken and only a reading margin is reserved. The gutter
    // also mirrors to the right when the plot is centred, so this is twice the
    // width back on every labelled column chart.
    leftInset: horizontal ? horizontalCategoryLabelWidth + negativeLabelGutter + 16 + (regionHighlight ? REGION_HIGHLIGHT_INLINE_PAD : 0) + groupColumnWidth : showValueAxis ? Math.max(54, axisLabelWidth(numericBounds([0, ...(stacked ? categories.map((_, i) => series.reduce((sum, item) => sum + Math.max(0, item.values[i]), 0)) : values)], { axis: "y" })) + 8) : 16,
    valueLabelInset: (horizontal ? (stacked ? totalWidth : showDataLabels ? barLabelWidth + barLabelGap : 0) : referenceGutter) + deltaWidth + noteColumnWidth + bracketWidth,
    totalLabelInset: horizontal ? 0 : totalHeight,
    centerPlot: !horizontal && !showValueAxis,
    span: horizontal ? null : tableSpan(props, frame, categories.length)
  });
  const { labelStep, labelSpan, layouts: categoryLayouts, height: categoryLabelHeight } = horizontal ? { layouts: [] } : columnLabels(plot.width);
  const labelEvery = labelStep?.every;
  const labelShown = (index) => labelStep.fromFirst ? index % labelEvery === 0 : (categories.length - 1 - index) % labelEvery === 0;
  if(!horizontal) {
    plot.categoryLabelHeight = categoryLabelHeight;
    if(plot.height<100)throw new Error(`Category labels leave insufficient plot height (${Math.floor(plot.height)}px of 100px): they wrap to ${Math.max(...categoryLayouts.map(label=>label.lines?.length??1))} lines in ${Math.floor(plot.width/categories.length-8)}px slots; shorten them, use a bar chart for long names, or give the chart more height`);
  }
  return { plot, labelSpan, categoryLayouts, labelShown };
}

/** `categoryGroups`: checked, their labels laid out, and the band they take off the plot's foot. */
function categoryGroupLayouts(chart) {
  const { props, horizontal, categories, plot } = chart;
  const categoryGroups=props.categoryGroups ?? [];
  if(!Array.isArray(categoryGroups)) throw new Error("Category groups require an array of { id, label, categories }");
  const groupedCategories=new Set(),groupIds=new Set();
  for(const group of categoryGroups) {
    if(!group || typeof group.id!=="string" || !group.id.trim() || groupIds.has(group.id) || typeof group.label!=="string" || !group.label.trim() || !Array.isArray(group.categories) || group.categories.length<2) throw new Error("Category groups require unique IDs, labels and at least two categories");
    groupIds.add(group.id);
    const indices=group.categories.map(category=>categories.indexOf(category));
    if(indices.some((n,i)=>n<0 || i>0&&n!==indices[i-1]+1) || group.categories.some(category=>groupedCategories.has(category))) throw new Error("Category groups require exact contiguous ordered non-overlapping categories");
    group.categories.forEach(category=>groupedCategories.add(category));
  }
  // A bar chart's groups sit in the column left of the row labels (labelGutters), and take nothing off the plot.
  if (horizontal) return { categoryGroups, groupLayouts: categoryGroups.map(group=>measureText(group.label,GROUP_LABEL_WIDTH,{fontFamily:tokenValue(FONT),fontSize:tokenValue(AXIS_LABEL),wrapWidthRatio:ENGINE_RESERVE})) };
  const groupLayouts=categoryGroups.map(group=>measureText(group.label,plot.width/categories.length*group.categories.length-16,{fontFamily:tokenValue(FONT),fontSize:tokenValue(AXIS_LABEL),wrapWidthRatio:ENGINE_RESERVE}));
  plot.categoryGroupHeight=categoryGroups.length?Math.max(...groupLayouts.map(m=>m.height))+tokenValue(token("space.3"))*2:0;
  plot.height-=plot.categoryGroupHeight;
  if(plot.height<100)throw new Error(`Category groups leave insufficient plot height (${Math.floor(plot.height)}px of 100px); shorten the group labels or give the chart more height`);
  return { categoryGroups, groupLayouts };
}

/** The value scale: the data's extents (each stack's, when stacked), with clearance under negative columns' labels. */
function categoricalBounds(chart) {
  const { props, horizontal, stacked, categories, series, values, showDataLabels, showValueAxis, plot, valueBreak } = chart;
  const stackExtents = categories.flatMap((_, categoryIndex) => {
    if (!stacked) return series.map(item => item.values[categoryIndex]);
    if (chart.diverging) return chart.diverging.ends[categoryIndex];
    const categoryValues = series.map(item => item.values[categoryIndex]);
    return [
      categoryValues.filter(value => value < 0).reduce((sum, value) => sum + value, 0),
      categoryValues.filter(value => value > 0).reduce((sum, value) => sum + value, 0)
    ];
  });
  // A broken axis (valueBreak) lays the marks out on its compressed scale: the run it cuts takes a few pixels, and
  // an explicit bound is compressed with them, or a top past the cut would flatten the marks as if nothing were cut.
  const explicitMin = horizontal ? (props.xMin ?? props.yMin) : props.yMin, explicitMax = horizontal ? (props.xMax ?? props.yMax) : props.yMax;
  const bounds = numericBounds(withReferenceValues((stacked ? stackExtents : values).map(chart.compress), props), { min: explicitMin === undefined ? undefined : chart.compress(explicitMin), max: explicitMax === undefined ? undefined : chart.compress(explicitMax), axis: horizontal ? "x" : "y", includeZero: true, tight: !showValueAxis && props.gridlines !== true });
  // Reserve measured clearance below negative columns with direct labels.
  // Only automatic unlabelled domains expand; explicit bounds stay authoritative.
  if (!horizontal && !stacked && showDataLabels && !showValueAxis && props.gridlines !== true && props.yMin === undefined && values.some(value => value < 0)) {
    const minimum = Math.min(...values);
    const clearance = Math.max(24, ...values.filter(value => value < 0).map(value => measureDataLabel(formatValue(value, props), 1000).height)) + 6;
    bounds.min = Math.min(bounds.min, (minimum * plot.height - clearance * bounds.max) / (plot.height - clearance));
    bounds.span = bounds.max - bounds.min;
  }
  // The cut is a fixed few pixels whatever the scale: set now the plot's length is known, and the domain reaches the
  // compressed top once the cut has its width.
  if (valueBreak) {
    cutGap(valueBreak, horizontal ? plot.width : plot.height, bounds.span);
    const top = Math.max(...(stacked ? stackExtents : values).map(chart.compress));
    if (explicitMax !== undefined) { bounds.max = chart.compress(explicitMax); bounds.span = bounds.max - bounds.min; }
    else if (top > bounds.max) { bounds.max = top; bounds.span = bounds.max - bounds.min; }
  }
  return { bounds };
}


/**
 * `diverging: { neutral }` on a stacked bar or column: a Likert scale. The
 * series are the scale's answers in order, most negative first, each a share
 * of the respondents (none below zero). The answers before the neutral one
 * stack out to the left of zero, nearest the centre first; the neutral answer
 * straddles zero; the answers after it stack out to the right. So the bars
 * line up on the centre and their lengths each way are the disagreement and
 * the agreement. Values print unsigned, and the colours run from one pole to
 * the other on the red-white-green scale - genuinely polar answers round a
 * neutral middle, the use that scale is kept for - with the neutral answer in
 * the comparator grey. A scale with no neutral answer splits in half.
 */
function divergingPlan(chart) {
  const { props, stacked, series, categories } = chart;
  if (props.diverging === undefined || props.diverging === false) return { diverging: null };
  if (!stacked) throw new Error("diverging lays a Likert scale's answers out each side of zero, as a stacked bar or column; draw it as chart.stacked-bar");
  const spec = props.diverging === true ? {} : props.diverging;
  if (!spec || typeof spec !== "object") throw new Error("diverging is true or { neutral: \"<the middle answer>\" }");
  if (series.some((item) => item.values.some((v) => v < 0))) throw new Error("a diverging scale's answers are shares of the respondents, none below zero; the chart sets the disagreeing ones left of zero itself");
  const names = series.map((item) => item.name);
  const neutral = spec.neutral === undefined ? -1 : names.indexOf(spec.neutral);
  if (spec.neutral !== undefined && neutral < 0) throw new Error(`diverging.neutral names the middle answer, one of the series (${names.join(", ")})`);
  if (neutral < 0 && series.length % 2) throw new Error(`a scale of ${series.length} answers has a middle one: name it in diverging.neutral, and it straddles zero`);
  const split = neutral >= 0 ? neutral : series.length / 2;
  const negative = names.slice(0, split).map((_, i) => i), positive = names.map((_, i) => i).slice(neutral >= 0 ? neutral + 1 : split);
  if (!negative.length || !positive.length) throw new Error("a diverging scale has answers on both sides of its middle");
  // Most negative is the outer pole: levels 0 to 3 of the scale on that side, 7 to 10 on the other.
  const level = (k, n, low) => (n === 1 ? (low ? 2 : 8) : low ? Math.round((k / (n - 1)) * 3) : 10 - Math.round(((n - 1 - k) / (n - 1)) * 3));
  const colors = new Map([...negative.map((i, k) => [i, token(`color.heat.red-white-green.${level(k, negative.length, true)}`)]), ...positive.map((i, k) => [i, token(`color.heat.red-white-green.${level(k, positive.length, false)}`)]), ...(neutral >= 0 ? [[neutral, token("color.chartComparator")]] : [])]);
  // Drawn from the centre out: the neutral answer, then each side nearest the centre first.
  const order = [...(neutral >= 0 ? [neutral] : []), ...[...negative].reverse(), ...positive];
  const sign = (i) => (negative.includes(i) ? -1 : 1);
  const ends = categories.map((_, at) => { const middle = neutral >= 0 ? series[neutral].values[at] / 2 : 0;
    return [-(middle + negative.reduce((sum, i) => sum + series[i].values[at], 0)), middle + positive.reduce((sum, i) => sum + series[i].values[at], 0)]; });
  return { diverging: { neutral, order, sign, colors, ends } };
}

/** `valueBreak: { from, to }` on a bar or column chart, stacked or not (axis-breaks.mjs valueCut): stacks end at their sums. */
function valueBreakPlan(chart) {
  const { props, stacked, categories, series, values, showDataLabels, showValueAxis } = chart;
  const ends = stacked
    ? categories.flatMap((_, at) => { let sum = 0; return series.map((item) => (sum += Math.max(0, item.values[at]))); })
    : values;
  return valueCut(props, ends, { showValueAxis, showDataLabels });
}

/** On a broken axis the scales place a value by its compressed position. */
function brokenScales(chart) {
  const { valueBreak, compress, yScale, xScale } = chart;
  if (!valueBreak) return {};
  return { yScale: (v) => yScale(compress(v)), xScale: (v) => xScale(compress(v)) };
}

/** The centre line a diverging scale's bars line up on, behind them: it shows between the rows, clear of the neutral answer's figures. */
function drawDivergingCentre(chart) {
  const { id, horizontal, diverging, plot, nodes, xScale, yScale } = chart;
  if (!diverging) return;
  // The axis at zero, which the chart sets in front of its marks, gives way to it.
  for (const axis of [stableId(id, "y-axis"), stableId(id, "zero-baseline")]) { const at = nodes.findIndex((node) => node.id === axis && (horizontal ? axis.endsWith("y-axis") : true)); if (at >= 0) nodes.splice(at, 1); }
  // A hairline rectangle, not a connector: a renderer may draw a connector over the shapes before it, and this line belongs behind the bars.
  const width = 1.5;
  nodes.unshift(rectPrimitive({ id: stableId(id, "diverging-centre"), role: "chart-diverging-centre",
    frame: horizontal ? { x: xScale(0) - width / 2, y: plot.y - 4, width, height: plot.height + 8 } : { x: plot.x - 4, y: yScale(0) - width / 2, width: plot.width + 8, height: width },
    style: { fill: INK, stroke: "none", lineWidth: token("line.hairline") }, data: { diverging: true } }));
}

/** The slanted gap across every mark that crosses a broken axis's cut (axis-breaks.mjs valueBreakNodes). */
function drawValueBreaks(chart) {
  const { horizontal, valueBreak, nodes, yScale, xScale } = chart;
  nodes.push(...valueBreakNodes(nodes.filter((node) => node.role === "chart-mark"), valueBreak, horizontal ? xScale : yScale, horizontal));
}

/**
 * `categoryBreaks: ["<category>", ...]`: the category axis broken after each
 * named category - the periods either side are not adjacent (FY10 beside FY20)
 * - drawn as a "//" across the axis line midway to the next category.
 */
function drawCategoryBreaks(chart) {
  const { id, props, horizontal, categories, plot, nodes, categorySpan, slotStart } = chart;
  if (props.categoryBreaks === undefined) return;
  if (!Array.isArray(props.categoryBreaks) || !props.categoryBreaks.length) throw new Error("categoryBreaks names the categories the axis breaks after: a nonempty list");
  for (const name of props.categoryBreaks) {
    const at = categories.indexOf(name);
    if (at < 0 || at === categories.length - 1) throw new Error(`categoryBreaks names "${name}", which is not a category the axis continues past (${categories.slice(0, 8).join(", ")})`);
    nodes.push(...categoryBreakNodes(id, plot, [{ after: name, at: slotStart(at) + categorySpan }], horizontal));
  }
}

/** Each mark's colour - the highlight, the forecast tint, the subject against its comparators - and the legend's items. */
function categoricalColors(chart) {
  const { props, stacked, categories, series, barHighlighted, barHighlight, forecastKeyed, forecastLegend } = chart;
  const twoMarkContrast = !stacked && !barHighlight && props.colorIndices === undefined && categories.length * series.length === 2;
  // Two series contrast by default; three or more contrast once one is named
  // the subject (`focusSeries`), the peers all in the comparator grey: four
  // saturated series side by side give the eye nowhere to start.
  const twoSeriesContrast = !stacked && !barHighlight && props.colorIndices === undefined && (series.length === 2 || (series.length > 2 && props.focusSeries !== undefined));
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
  const focusSeriesIndex = twoSeriesContrast ? defaultFocusIndex(series.map((item) => item.name), props.focusSeries) : -1;
  const focusCategoryIndex = twoMarkContrast ? defaultFocusIndex(categories) : -1;
  const colorFor = (seriesIndex, categoryIndex) => {
    if (chart.diverging) return chart.diverging.colors.get(seriesIndex);
    // Highlight the answer: the bar the title is about takes the subject's colour; the others keep their series colour,
    // never grey. Forecast periods are lighter. A two-mark or two-series contrast sets the point against the grey (SUBJECT).
    if (barHighlighted.has(categories[categoryIndex])) return SUBJECT;
    if (forecastIndex >= 0 && categoryIndex >= forecastIndex && !stacked && series.length === 1) return token("color.chartSeries6");
    if (barHighlight) return SERIES[colorIndexFor(seriesIndex, categoryIndex)];
    if (props.colorIndices !== undefined || stacked) return SERIES[colorIndexFor(seriesIndex, categoryIndex)];
    if (twoSeriesContrast) return seriesIndex === focusSeriesIndex ? SUBJECT : CONTEXT_FILL;
    if (twoMarkContrast) return categoryIndex === focusCategoryIndex ? SUBJECT : CONTEXT_FILL;
    return SERIES[colorIndexFor(seriesIndex, categoryIndex)];
  };
  const legendItems = forecastKeyed
    ? forecastLegend.map((label, index) => index === forecastLegend.length - 1
      ? { label, key: "forecast", colorIndex: SERIES.findIndex(color => color.tokenId === "color.chartSeries6"), color: token("color.chartSeries6") }
      : { label, key: "actual", colorIndex: colorIndexFor(0, 0), color: SERIES[colorIndexFor(0, 0)] })
    : series.map((item, seriesIndex) => ({ label: stateLabel(item, categories), colorIndex: colorIndexFor(seriesIndex, 0), color: colorFor(seriesIndex, 0) }));
  // A mark that is an assumption or a reference, not a record (chart-decorations.mjs SERIES_STATES): a whole series, or an assumed run from its `assumedFrom` on. It keeps its series colour at a lighter fill.
  const states = series.map((item) => seriesState(item, categories));
  const lighter = (seriesIndex, categoryIndex) => states[seriesIndex].state === "reference" || (states[seriesIndex].state === "assumed" && categoryIndex >= states[seriesIndex].from);
  return { colorIndexFor, forecastIndex, colorFor, legendItems, lighter };
}

/** The legend, the axes and the zero baseline, and the scales and maps the marks are placed by. */
function categoricalAxes(chart) {
  const { id, frame, props, horizontal, showLegend, showValueAxis, plot, bounds, legendItems } = chart;
  const nodes = showLegend ? topLegend({ id, frame, items: legendItems }) : [];
  const pointMap = new Map();
  const categoryMap = new Map();
  const yScale = (value) => plot.y + plot.height - (value - bounds.min) / bounds.span * plot.height;
  const xScale = (value) => plot.x + (value - bounds.min) / bounds.span * plot.width;

  nodes.push(...(horizontal
    ? horizontalAxes(id, plot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true, showValueAxis })
    : axes(id, plot, bounds.min, bounds.max, 4, { gridlines: props.gridlines === true, showValueAxis, labelWidth: Math.max(48, axisLabelWidth(bounds)) })));
  if (!horizontal && bounds.min < 0 && bounds.max > 0) nodes.push(linePrimitive({
    id: stableId(id, "zero-baseline"), role: "chart-axis",
    ...(horizontal
      ? { x1: xScale(0), y1: plot.y, x2: xScale(0), y2: plot.y + plot.height }
      : { x1: plot.x, y1: yScale(0), x2: plot.x + plot.width, y2: yScale(0) }),
    style: lineStyle(INK)
  }));
  return { nodes, pointMap, categoryMap, yScale, xScale };
}

/** How a crowded bar chart labels its rows: the size its names are set at, and which rows are named. */
function rowLabelling(chart) {
  const { horizontal, stacked, categories, barHighlighted, axisFont, plot } = chart;
  let { props } = chart;
  // Columns over dates at uneven gaps stand where the dates fall (time-axis.mjs timePositions): the BA retest set 2019, 2024
  // and a 2027 plan one slot apart, so five years and three drew as one step each. Each lane is as wide as the closest two
  // dates allow, and the even run is the case where every lane is a plot's width over the count. A data table's columns
  // and a broken axis (`categoryBreaks`, which says outright that it skips) keep their slots.
  // A data table under the columns sets its periods one slot each, so dates at uneven gaps cannot stand where they fall, and
  // an axis broken at some gaps sets the rest one slot apart: either way the axis is broken after every long gap (time-axis.mjs
  // gapBreaks), which says outright that it skips.
  if (!horizontal && (props.categoryColumns || (props.categoryBreaks || []).length) && timePositions(categories)) {
    chart.props = props = { ...props, categoryBreaks: slotBreaks(categories, props.categoryBreaks) };
  }
  const spacing = !horizontal && !props.categoryColumns && !(props.categoryBreaks || []).length ? timePositions(categories) : null;
  const closest = spacing ? Math.min(...spacing.slice(1).map((at, i) => at - spacing[i])) : 0;
  const categorySpan = spacing ? plot.width * closest / (1 + closest) : (horizontal ? plot.height : plot.width) / categories.length;
  const slotStart = (index) => (spacing ? plot.x + spacing[index] * (plot.width - categorySpan) : (horizontal ? plot.y : plot.x) + index * categorySpan);
  // Forty members down a 420px plot give each row 10px, under the 13px line of
  // the chart's label face, and every name and value set in a box that tall
  // prints at six pixels, the subject's among them. When a row is thinner
  // than a line, the rows are labelled every nth from the top at full size,
  // the highlighted member always, and the rows beside it that its label
  // would touch go unlabelled: the reader finds the subject by its colour and
  // its name, and reads the field's shape from the bars.
  //
  // Before any name is dropped the rows' labels step down to 8pt, the
  // smallest the page sets type at, when that line fits the row: 32 members
  // that all fit at 8pt are all named, not every second one at 10pt. And a
  // member a callout names keeps its label as the subject does: a note on an
  // unnamed bar says nothing. page-types.mjs describeTypes publishes the rule.
  // Rows thinner than a label's line are named by the shared rule (chart-axes.mjs rowLabels), stacked or not.
  const named = new Set([...barHighlighted, ...(props.annotations || []).map((a) => a?.category).filter(Boolean)]);
  const rows = horizontal && !chart.labelAbove ? rowLabels({ categories, span: categorySpan, named, font: axisFont }) : null;
  const rowSize = rows?.size ?? AXIS_LABEL, rowLine = rows?.line ?? measureText("Ag", 1000, axisFont).height;
  const rowShown = (index) => !rows || rows.shown(index);
  // Columns where their dates fall stand closer than an even run's, so the periods named are those whose labels clear their
  // neighbours' (time-axis.mjs spacedLabelIndices), as on a line: 2017, 2018 and 2019 a lane of 28px apart printed on each other.
  const widest = spacing ? Math.max(...categories.map((category) => measureText(String(category), 1000, axisFont).width)) : 0;
  const kept = spacing ? new Set(spacedLabelIndices(categories.map((_, index) => slotStart(index) + categorySpan / 2), widest + 8)) : null;
  return { categorySpan, slotStart, timeSpaced: Boolean(spacing), rowSize, rowLine, rowShown, ...(kept ? { labelShown: (index) => kept.has(index) } : {}) };
}

/**
 * Whether the values over a run of columns fit their columns: forty columns in a panel give each 7px, and their values,
 * printed over them, ran into one another. Where the widest value is wider than its column, the chart is drawn again with
 * a value axis and no labels (categoricalChart). A chart that asks for its labels (`dataLabels: true`) keeps them.
 */
function columnLabelsFit(chart) {
  const { props, horizontal, stacked, series, values, showDataLabels, categorySpan } = chart;
  if (horizontal || stacked || !showDataLabels || props.dataLabels === true || props.valueBreak || chart.diverging) return;
  const room = categorySpan / Math.max(1, series.length) - 2;
  const widest = Math.max(...values.filter(Number.isFinite).map((value) => measureDataLabel(formatValue(value, props)).width));
  if (widest > room) throw Object.assign(new Error(`the columns' values (${Math.ceil(widest)}px) are wider than their columns (${Math.floor(room)}px)`), { labelsCrowded: true });
}

/**
 * A stack's value wider than its column - or, set beside the stack, leaving the column too thin to draw - is read off a
 * value axis instead (categoricalChart), unless the chart asks for every value; any other error stands.
 */
function stackCrowded(error, props, text, width) {
  if (error && !/^Unbreakable text/.test(error.message)) return error;
  return props.dataLabels === true
    ? new Error(`${text} does not fit its ${Math.max(0, Math.floor(width))}px column, and the chart asks for every value (dataLabels: true): drop dataLabels to read the stacks off a value axis, or give the chart fewer members or more width`)
    : Object.assign(new Error(`a stack's values do not fit its ${Math.max(0, Math.floor(width))}px columns`), { labelsCrowded: true });
}

/**
 * An unstacked chart's values, placed together clear of each other and of every other bar (label-placement.mjs): each past
 * its bar's end where that is clear, else inside the bar. A value with no clear place is left out, and the chart is drawn
 * again read off a value axis (categoricalChart); a chart that asks for every value (`dataLabels: true`) is refused instead.
 */
function placeBarLabels(chart) {
  const { nodes, frame, props, barLabels } = chart;
  if (!barLabels) return;
  const bars = nodes.filter((node) => node.role === "chart-mark").map((node) => node.frame);
  const { placed, dropped } = placeLabels(barLabels, { style: () => null, keepOut: bars, within: frame, pad: 1 });
  if (dropped && props.dataLabels !== true) throw Object.assign(new Error(`${dropped} of the chart's values have no clear place beside or inside their bars`), { labelsCrowded: true });
  // A page that asks for every value (`dataLabels: true`) is not given two printed on each other.
  if (dropped) throw new Error(`${dropped} of the chart's ${barLabels.length} values have no clear place beside or inside their bars, and the chart asks for every one (dataLabels: true): drop dataLabels to read them off a value axis, label fewer series, or give the chart fewer members or more width`);
  for (const label of placed) nodes.push(textPrimitive({ id: label.id, role: "data-label", frame: label.frame, text: label.text, style: label.style, data: label.data }));
}

/** Each category's group of bars: its width (narrowed for stack labels set outside, or a bracket) and each bar's. */
function barSpans(chart) {
  const { props, horizontal, stacked, categories, series, stackLabels, showDataLabels, stackBracket, plot, bounds, categorySpan } = chart;
  // Bar weight follows the category count. Four categories drawn at the
  // many-category gap read as ribbons with the page showing through; a well-made
  // page sets few, fat bars and many, thinner ones - but not ribbons: ten bars
  // at 0.7 leave a gap nearly as wide as each bar (markWeight).
  const barWeight = categories.length <= 3 ? 0.86 : categories.length <= 6 ? 0.78 : markWeight().bars;
  let groupSpan = categorySpan * barWeight;
  // A label set over its bar takes the top of the lane; the bar takes what is left, a little air under the label.
  const aboveLayouts = chart.labelAbove ? categories.map((category) => measureText(String(category), plot.width - ABOVE_INSET, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL) })) : null;
  const labelBlock = aboveLayouts ? Math.max(...aboveLayouts.map((layout) => layout.height)) + 3 : 0;
  if (aboveLayouts) {
    groupSpan = Math.min(groupSpan, categorySpan - labelBlock - 6);
    if (groupSpan < 8) throw new Error(`labels set above their bars leave each bar ${Math.max(0, Math.floor(groupSpan))}px of a ${Math.floor(categorySpan)}px lane; give the chart the page's height, fewer statements, or labels of one line`);
  }
  let stackExternalWidth = 0;
  if (stacked && !horizontal && showDataLabels) {
    for (const category of categories) for (const item of series) {
      const value=item.values[categories.indexOf(category)];
      const text=attachedLabelText(formatValue(value,props),stackLabels.secondary.get(`${category}:${item.name}`),props);
      try {
        const label=measureDataLabel(text,Math.max(1,groupSpan-8));
        if(label.height>Math.abs(value)/bounds.span*plot.height) stackExternalWidth=Math.max(stackExternalWidth,measureDataLabel(text,categorySpan*.45).width);
      } catch (error) { throw stackCrowded(error, props, text, groupSpan); }
    }
    if(stackExternalWidth) {
      groupSpan=Math.min(groupSpan,categorySpan-stackExternalWidth-tokenValue(token("space.3"))*2);
      if(groupSpan<tokenValue(token("space.4"))) throw stackCrowded(null, props, "a value set beside its stack", groupSpan);
    }
  }
  if (stackBracket) groupSpan = Math.min(groupSpan, categorySpan * 0.5);
  const segmentMids = new Map();
  const barSpan = stacked ? groupSpan : groupSpan / series.length;
  return { groupSpan, stackExternalWidth, segmentMids, barSpan, aboveLayouts, labelBlock };
}

/** The heading over the delta column (bars) or band (columns). */
function drawDeltaHeadings(chart) {
  const { id, props, horizontal, deltas, deltaWidth, deltaClear, plot, nodes } = chart;
  if (deltas && !horizontal && props.deltasLabel !== false) nodes.push(textPrimitive({ id: stableId(id, "deltas-heading"), role: "chart-delta-label", frame: { x: plot.x, y: plot.y - deltaClear - 22 - 20, width: Math.min(plot.width, 260), height: 18 }, text: props.deltasLabel || "Change vs. prior", style: textStyle(token("type.compact"), SECONDARY, false, "left"), data: { deltasHeading: true } }));
  if (deltas && horizontal) {
    // The delta column's heading ("Change vs. June"), right-aligned above the discs.
    const heading = props.deltasLabel || "Change vs. prior";
    nodes.push(textPrimitive({ id: stableId(id, "deltas-heading"), role: "chart-delta-label", frame: { x: plot.x + plot.width + deltaWidth - 150, y: plot.y - 22, width: 150 - 4, height: 18 }, text: heading, style: textStyle(token("type.compact"), SECONDARY, false, "right"), data: { deltasHeading: true } }));
  }
}

/**
 * One category: its marks with their value labels, then what is set against
 * them - the stack's bracket, the delta, the point callouts anchor to, stack
 * labels moved clear of thin segments, the stack's total - and the category's
 * label, note and icon.
 */
function drawCategory(chart, category, categoryIndex) {
  const { horizontal, stacked, plot, categoryMap, categorySpan, groupSpan, stackExternalWidth, slotStart } = chart;
  const categoryStart = slotStart(categoryIndex) + (stackExternalWidth ? tokenValue(token("space.2")) : (categorySpan - groupSpan) / 2) + (chart.labelBlock || 0) / 2;
  categoryMap.set(category, horizontal
    ? { x: plot.x, y: categoryStart, width: plot.width, height: groupSpan }
    : { x: categoryStart, y: plot.y, width: groupSpan, height: plot.height, labelSpan: categorySpan, labelCenter: stacked ? categoryStart+(groupSpan-4)/2 : slotStart(categoryIndex)+categorySpan/2 });
  const { positiveCumulative, negativeCumulative } = drawCategoryMarks(chart, category, categoryIndex, categoryStart);
  drawStackBracket(chart, category, categoryIndex);
  drawCategoryDelta(chart, category, categoryStart);
  setCategoryPoint(chart, category, categoryIndex, categoryStart, positiveCumulative, negativeCumulative);
  placeStackLabels(chart, category, categoryIndex);
  drawStackTotal(chart, category, categoryStart);
  drawCategoryLabel(chart, category, categoryIndex, categoryStart);
  drawCategoryIcon(chart, category, categoryStart);
}

// The fill of a mark that is an assumption or a reference: its series colour, light enough to read as not a record and dark enough to carry an ink label.
const LIGHTER_FILL = 0.4;

/** A category's bars or segments and their value labels; returns the stack's running ends. */
function drawCategoryMarks(chart, category, categoryIndex, categoryStart) {
  const { id, props, horizontal, stacked, series, stackLabels, barHighlighted, barHighlight, showDataLabels, barLabelGap, barLabelWidth,
    segmentGrowth, plot, colorIndexFor, colorFor, lighter: lighterState, nodes, pointMap, yScale, xScale, rowSize, rowLine, rowShown, segmentMids, barSpan, valueLabels } = chart;
  // An estimate (a value said as a range or an approximation) is drawn lighter, as an assumption is.
  const said = (seriesIndex) => valueLabels.get(`${series[seriesIndex].name}:${category}`);
  const lighter = (seriesIndex, at) => lighterState(seriesIndex, at) || Boolean(said(seriesIndex)?.estimate);
  let positiveCumulative = 0;
  let negativeCumulative = 0;
  // A diverging scale is drawn from the centre out, its disagreeing answers to the left of zero (divergingPlan).
  const diverging = chart.diverging;
  const order = diverging ? diverging.order : series.map((_, i) => i);
  order.forEach((seriesIndex) => {
    if (chart.gaps.has(`${seriesIndex}:${categoryIndex}`)) return;
    const item = series[seriesIndex];
    const value = diverging ? diverging.sign(seriesIndex) * item.values[categoryIndex] : item.values[categoryIndex];
    const selected = barHighlighted.has(category);
    const colorIndex = colorIndexFor(seriesIndex, categoryIndex);
    const markColor = colorFor(seriesIndex, categoryIndex);
    const middle = diverging && seriesIndex === diverging.neutral;
    const start = middle ? -value / 2 : stacked ? (value >= 0 ? positiveCumulative : negativeCumulative) : 0;
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
    if (!stacked || value !== 0) nodes.push(rectPrimitive({
      id: stableId(id, "series", item.name, category),
      role: "chart-mark",
      frame: bar,
      style: lighter(seriesIndex, categoryIndex) ? fillStyle(markColor, markColor, token("line.hairline"), LIGHTER_FILL) : fillStyle(markColor),
      data: { category, categoryKey: category, series: item.name, seriesKey: item.name, colorIndex, highlighted: Boolean(selected), ...(barHighlight ? { highlightStyle: "bar" } : {}), ...(lighterState(seriesIndex, categoryIndex) ? { state: seriesState(item, chart.categories).state } : said(seriesIndex)?.estimate ? { state: "estimate" } : {}) }
    }));
    // A zero segment has no area in a stack. Printing its label inside a
    // one-pixel placeholder both invents a visible segment and fails fit.
    if (showDataLabels && (!stacked || value !== 0) && (!horizontal || rowShown(categoryIndex))) {
      // A diverging scale's answers print unsigned: a share of respondents, whichever side of zero it is drawn.
      let labelText = attachedLabelText(said(seriesIndex)?.display ?? formatValue(diverging ? Math.abs(value) : value, props), stackLabels.secondary.get(`${category}:${item.name}`),props);
      let labelMetrics;
      try { labelMetrics = measureDataLabel(labelText, stacked && !horizontal ? Math.max(1, bar.width - 4) : 1000); }
      catch (error) { throw stackCrowded(error, props, labelText, bar.width); }
      labelText = labelMetrics.text;
      const labelFrame = horizontal
        ? stacked
          ? { x: bar.x + 2, y: bar.y - 2, width: Math.max(1, bar.width - 4), height: bar.height + 4 }
          : value >= 0
            ? { x: bar.x + bar.width + barLabelGap, y: Math.min(bar.y - 2, bar.y + bar.height / 2 - rowLine / 2), width: barLabelWidth, height: Math.max(bar.height + 4, rowLine) }
            : { x: bar.x - barLabelGap - barLabelWidth, y: Math.min(bar.y - 2, bar.y + bar.height / 2 - rowLine / 2), width: barLabelWidth, height: Math.max(bar.height + 4, rowLine) }
        : stacked
          ? { x: bar.x + 2, y: bar.y + (bar.height - labelMetrics.height) / 2, width: bar.width - 4, height: labelMetrics.height }
          : value >= 0
            ? { x: bar.x - 10, y: value < 0 ? yScale(end) + 3 : yScale(end) - 26, width: bar.width + 20, height: 24 }
            : { x: bar.x - 10, y: Math.min(plot.y + plot.height - 24, bar.y + bar.height + 2), width: bar.width + 20, height: 24 };
      // A fixed minimum may force an in-bar label; contrast against its fill.
      const labelOnFill = stacked || (!horizontal && value < 0 && labelFrame.y < bar.y + bar.height);
      const labelData = { category, series: item.name, ...(said(seriesIndex)?.display ? { display: said(seriesIndex).display, value } : {}), ...(said(seriesIndex)?.estimate ? { estimate: true } : {}) };
      // An unstacked bar's value offers two places - past the bar's end, then inside it in the colour that reads on its fill -
      // and the chart's values are placed together (placeBarLabels, label-placement.mjs).
      if (chart.barLabels) {
        const size = horizontal ? rowSize : CHART_LABEL, align = horizontal ? (value >= 0 ? "left" : "right") : "center";
        const insideFrame = horizontal
          ? { x: value >= 0 ? bar.x + bar.width - barLabelWidth - 6 : bar.x + 6, y: labelFrame.y, width: barLabelWidth, height: labelFrame.height }
          : { x: bar.x - 10, y: value >= 0 ? bar.y + 4 : bar.y + bar.height - 28, width: bar.width + 20, height: 24 };
        chart.barLabels.push({ id: stableId(id, "value-label", item.name, category), text: labelText, data: labelData, own: bar, frames: [
          { frame: labelFrame, align, style: textStyle(size, labelOnFill && !lighter(seriesIndex, categoryIndex) ? onFill(markColor) : INK, labelBold(), align) },
          { frame: insideFrame, align: horizontal ? (value >= 0 ? "right" : "left") : "center", style: textStyle(size, lighter(seriesIndex, categoryIndex) ? INK : onFill(markColor), labelBold(), horizontal ? (value >= 0 ? "right" : "left") : "center") }] });
      } else nodes.push(textPrimitive({
        id: stableId(id, "value-label", item.name, category),
        role: "data-label",
        frame: labelFrame,
        text: labelText,
        style: textStyle(horizontal && !stacked ? rowSize : CHART_LABEL, labelOnFill && !lighter(seriesIndex, categoryIndex) ? onFill(markColor) : INK, labelBold(), horizontal && !stacked ? (value >= 0 ? "left" : "right") : "center"),
        data: { category, series: item.name, ...(said(seriesIndex)?.display ? { display: said(seriesIndex).display, value } : {}), ...(said(seriesIndex)?.estimate ? { estimate: true } : {}) }
      }));
    }
    const point = horizontal
      ? { x: xScale(end), y: bar.y + bar.height / 2, changeX: xScale(end) + (value >= 0 ? 12 : -12), changeY: bar.y + bar.height / 2 }
      : { x: bar.x + bar.width / 2, y: yScale(end), changeX: bar.x + bar.width / 2, changeY: yScale(end) + (value >= 0 ? -(showDataLabels ? 38 : 16) : (showDataLabels ? 38 : 16)) };
    pointMap.set(`${item.name}:${category}`, point);
    if (segmentGrowth && category === (segmentGrowth.length > 1 ? chart.categories.at(-1) : segmentGrowth[0].to)) segmentMids.set(item.name, bar.y + bar.height / 2);
    if (series.length === 1) pointMap.set(`value:${category}`, point);
    if (middle) { positiveCumulative = end; negativeCumulative = start; }
    else if (stacked) {
      if (value >= 0) positiveCumulative = end;
      else negativeCumulative = end;
    }
  });
  return { positiveCumulative, negativeCumulative };
}

/** `stackBracket`: a bracket over the named segments of the stack, with their sum. */
function drawStackBracket(chart, category, categoryIndex) {
  const { id, props, series, stackBracket, nodes, categorySpan, groupSpan } = chart;
  if (stackBracket) {
    // Bracket the named segments and print their sum at the bracket's middle.
    const marks = nodes.filter(node => node.role === "chart-mark" && node.data.category === category && stackBracket.includes(node.data.series));
    if (marks.length) {
      const top = Math.min(...marks.map(m => m.frame.y)), bottom = Math.max(...marks.map(m => m.frame.y + m.frame.height));
      const right = Math.max(...marks.map(m => m.frame.x + m.frame.width)), bx = right + 6, tick = 5;
      const sum = stackBracket.reduce((acc, name) => acc + series.find(item => item.name === name).values[categoryIndex], 0);
      nodes.push(linePrimitive({ id: stableId(id, "bracket", category), role: "chart-bracket", x1: bx, y1: top, x2: bx, y2: bottom, style: lineStyle(INK, token("line.hairline")) }));
      nodes.push(linePrimitive({ id: stableId(id, "bracket-top", category), role: "chart-bracket", x1: bx - tick, y1: top, x2: bx, y2: top, style: lineStyle(INK, token("line.hairline")) }));
      nodes.push(linePrimitive({ id: stableId(id, "bracket-bottom", category), role: "chart-bracket", x1: bx - tick, y1: bottom, x2: bx, y2: bottom, style: lineStyle(INK, token("line.hairline")) }));
      nodes.push(textPrimitive({ id: stableId(id, "bracket-label", category), role: "chart-bracket-label", frame: { x: bx + 4, y: (top + bottom) / 2 - 12, width: Math.max(28, categorySpan - groupSpan - 14), height: 24 }, text: formatValue(sum, props), style: textStyle(CHART_LABEL, INK, true, "left"), data: { category, bracket: true } }));
    }
  }
}

/** The category's delta: a pill in the band over a column, a disc in the column right of a bar. */
function drawCategoryDelta(chart, category, categoryStart) {
  const { id, props, horizontal, deltas, deltaWidth, deltaClear, plot, nodes, categoryMap, categorySpan, groupSpan } = chart;
  if (deltas && !horizontal && deltas.get(category)) {
    const record = deltas.get(category), cx = categoryMap.get(category).labelCenter;
    const text = `${record.value > 0 ? "+" : record.value < 0 ? "−" : ""}${formatValue(Math.abs(record.value), props)}`;
    const width = Math.min(categorySpan - 6, Math.max(44, measureDataLabel(text).width + 14)), top = plot.y - deltaClear - 22;
    nodes.push(rectPrimitive({ id: stableId(id, "delta", category), role: "chart-delta", frame: { x: cx - width / 2, y: top, width, height: 22 }, style: { ...fillStyle(token("color.surfaceMuted")), radius: token("radius.round") }, data: { category, delta: record.value } }));
    nodes.push(textPrimitive({ id: stableId(id, "delta-label", category), role: "chart-delta-label", frame: { x: cx - width / 2, y: top + 1, width, height: 20 }, text, style: textStyle(token("type.compact"), INK, record.significant, "center"), data: { category, delta: record.value } }));
  }
  if (deltas && horizontal) {
    const record = deltas.get(category);
    if (record) {
      const size = 26, cx = plot.x + plot.width + deltaWidth - size - 4, cy = categoryStart + groupSpan / 2 - size / 2;
      const fill = token("color.surfaceMuted"), fg = INK;
      nodes.push(ellipsePrimitive({ id: stableId(id, "delta", category), role: "chart-delta", frame: { x: cx, y: cy, width: size, height: size }, style: fillStyle(fill), data: { category, delta: record.value } }));
      nodes.push(textPrimitive({ id: stableId(id, "delta-label", category), role: "chart-delta-label", frame: { x: cx - 4, y: cy + 1, width: size + 8, height: size - 2 }, text: `${record.value > 0 ? "+" : record.value < 0 ? "−" : ""}${formatValue(Math.abs(record.value), props)}`, style: textStyle(token("type.compact"), fg, true, "center"), data: { category, delta: record.value } }));
    }
  }
}

/** The point a callout on the category (not on one series) anchors to: the end of its largest mark, or the stack's. */
function setCategoryPoint(chart, category, categoryIndex, categoryStart, positiveCumulative, negativeCumulative) {
  const { horizontal, stacked, series, showDataLabels, pointMap, yScale, xScale, groupSpan } = chart;
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
}

/**
 * A stacked chart's value labels that do not fit their segments: over or
 * under a bar, or beside a column on a leader, spread so none overlap.
 */
function placeStackLabels(chart, category, categoryIndex) {
  const { frame, horizontal, stacked, showDataLabels, showValueAxis, barLabelGap, plot, nodes, categorySpan, slotStart } = chart;
  if (stacked && showDataLabels) {
    const labels = nodes.filter(node => node.role === "data-label" && node.data.category === category);
    const marks = nodes.filter(node => node.role === "chart-mark" && node.data.category === category);
    for (const label of labels) {
      const mark = marks.find(mark => mark.data.series === label.data.series);
      const metrics = measureDataLabel(label.text);
      if (metrics.width <= mark.frame.width - 4 && metrics.height <= mark.frame.height) continue;
      if (horizontal) {
        // A segment too thin for its value prints it just above the bar (or
        // below, at the foot of the lane), centred on the segment, in the
        // gap between bars - a designer's move, rather than failing the chart.
        const centre = Math.max(plot.x, Math.min(plot.x + plot.width + barLabelGap - metrics.width, mark.frame.x + mark.frame.width / 2 - metrics.width / 2));
        const taken = [...nodes.filter(node => node.role === "chart-mark").map(node => node.frame), ...nodes.filter(node => node.role === "data-label" && node !== label && node.data.outside).map(node => node.frame)];
        const clearOf = (f, o) => f.x + f.width + 2 <= o.x || o.x + o.width + 2 <= f.x || f.y + f.height + 1 <= o.y || o.y + o.height + 1 <= f.y;
        const spot = [{ x: centre, y: mark.frame.y - metrics.height - 2 }, { x: centre, y: mark.frame.y + mark.frame.height + 2 }]
          .map(p => ({ ...p, width: metrics.width, height: metrics.height }))
          .find(f => f.y >= frame.y && f.y + f.height <= plot.y + plot.height + (showValueAxis ? 0 : 10) && taken.every(o => clearOf(f, o)));
        if (!spot) throw new Error("Stacked bar label fits neither its segment nor the gap beside its bar; enlarge the chart, merge the thin segments, or use stacked columns with external labels");
        Object.assign(label, textPrimitive({ id: label.id, role: label.role, frame: spot, text: label.text, data: { ...label.data, outside: true }, style: textStyle(CHART_LABEL, INK, labelBold(), "center") }));
        continue;
      }
      const laneStart = slotStart(categoryIndex), boundary = laneStart + categorySpan;
      // Right of the column, or - when the lane ends first - left of it.
      let x = mark.frame.x + mark.frame.width + 6;
      if (x + metrics.width > boundary && mark.frame.x - 6 - metrics.width >= laneStart) x = mark.frame.x - 6 - metrics.width;
      if (x + metrics.width > boundary) throw new Error("External stack label fits neither side of its column within the category lane; enlarge the chart or reduce categories");
      label.frame = { x, y: Math.max(plot.y, Math.min(mark.frame.y + (mark.frame.height - metrics.height) / 2, plot.y + plot.height - metrics.height)), width: metrics.width, height: metrics.height };
      const leftSide = x < mark.frame.x;
      Object.assign(label, textPrimitive({ id: label.id, role: label.role, frame: label.frame, text: label.text, data: { ...label.data, external: true, ...(leftSide ? { side: "left" } : {}) }, style: textStyle(CHART_LABEL, INK, labelBold(), leftSide ? "right" : "left") }));
      nodes.push(linePrimitive({ id: stableId(label.id, "leader"), role: "data-label-leader", x1: leftSide ? mark.frame.x : mark.frame.x + mark.frame.width, y1: mark.frame.y + mark.frame.height / 2, x2: leftSide ? x + metrics.width + 2 : x - 2, y2: label.frame.y + metrics.height / 2, style: lineStyle(INK) }));
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
      const leftSide=label.data.side==="left";
      Object.assign(label,textPrimitive({id:label.id,role:label.role,frame:label.frame,text:label.text,data:label.data,style:textStyle(CHART_LABEL,INK,true,leftSide?"right":"left")}));
      const leader=nodes.find(node=>node.id===stableId(label.id,"leader"));
      Object.assign(leader,linePrimitive({id:leader.id,role:"data-label-leader",x1:leftSide?mark.frame.x:mark.frame.x+mark.frame.width,y1:mark.frame.y+mark.frame.height/2,x2:leftSide?label.frame.x+label.frame.width+2:label.frame.x-2,y2:label.frame.y+label.frame.height/2,style:lineStyle(INK)}));
    }
  }
}

/** The stack's total, past its end. */
function drawStackTotal(chart, category, categoryStart) {
  const { id, horizontal, stackLabels, barLabelGap, totalTexts, nodes, yScale, xScale, categorySpan, groupSpan, barSpan } = chart;
  if (totalTexts.has(category)) {
    const text = totalTexts.get(category), metrics = measureDataLabel(text);
    if ((!horizontal && metrics.width > categorySpan - 8) || (horizontal && metrics.height > groupSpan))
      throw new Error("Stack total label does not fit its category lane; shorten the value format (fewer decimals, a compact unit), reduce categories, or widen the chart");
    const endpoint = stackLabels.totals.get(category).endpoint;
    nodes.push(textPrimitive({ id: stableId(id, "stack-total", category), role: "data-label",
      frame: horizontal
        ? { x: xScale(endpoint)+barLabelGap, y: categoryStart+(groupSpan-metrics.height)/2, width: metrics.width, height: metrics.height }
        : { x: categoryStart+(barSpan-4-metrics.width)/2, y: yScale(endpoint)-barLabelGap-metrics.height, width: metrics.width, height: metrics.height },
      text, style: textStyle(CHART_LABEL, INK, labelBold(), horizontal ? "left" : "center"),
      data: { category, anchor: "stack-total", value: stackLabels.totals.get(category).value, endpoint }
    }));
  }
}

/** The category's label and its note. */
function drawCategoryLabel(chart, category, categoryIndex, categoryStart) {
  const { id, frame, horizontal, regionHighlight, hideCategoryLabels, iconSlot, noteWidth, noteColumn, horizontalCategoryLabelWidth,
    negativeLabelGutter, categoryNotes, plot, labelSpan, categoryLayouts, labelShown, nodes, categoryMap, categorySpan, rowSize, rowLine,
    rowShown, groupSpan } = chart;
  // A label set over its bar runs the plot's width, the bar under it.
  if (chart.labelAbove && !hideCategoryLabels) {
    const layout = chart.aboveLayouts[categoryIndex];
    // Clear of the axis the bars stand on, so the line does not touch the label's first letter.
    nodes.push(textPrimitive({ id: stableId(id, "category", category), role: "category-label", frame: { x: plot.x + ABOVE_INSET, y: categoryStart - chart.labelBlock, width: plot.width - ABOVE_INSET, height: layout.height }, text: layout.text,
      style: { ...textStyle(AXIS_LABEL, INK, false, "left"), valign: "top", lineHeight: layout.lineHeight, wrap: false }, data: { category, textLayout: layout, placement: "above" } }));
    return;
  }
  // `categoryNotes`: a second line under the category label - the base of the
  // measure ("n=412"), the year, the unit of that column. A well-made chart
  // carries it and it is most of what separates its label band from a bare one.
  const noteText = hideCategoryLabels ? null : categoryNotes[categoryIndex];
  const noteLayout = noteText ? measureText(noteText, Math.max(40, horizontal ? (noteColumn ? noteWidth : horizontalCategoryLabelWidth) : categorySpan - 8), { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL) }) : null;
  // With a note under it, a bar's label stops being a box centred on the bar
  // and becomes the first line of a two-line block, measured and placed.
  // In the note column the label keeps its own place and the note is level
  // with the bar at the right.
  const barLabelLayout = horizontal && noteLayout && !noteColumn ? measureText(category, horizontalCategoryLabelWidth, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL) }) : null;
  const barBlockTop = barLabelLayout ? categoryStart + (groupSpan - barLabelLayout.height - noteLayout.height) / 2 : 0;
  if (horizontal && noteLayout && (noteColumn ? noteLayout.height : barLabelLayout.height + noteLayout.height) > categorySpan + 2)
    throw new Error(`Category "${category}" and its note do not fit its ${Math.floor(categorySpan)}px lane even in a note column: shorten the note or give the chart more height`);
  if (noteLayout) {
    // The label and its note read as one block: on a bar chart the pair sits
    // centred on the bar, on a column chart the note takes the line under the
    // label.
    nodes.push(textPrimitive({
      id: stableId(id, "category-note", category),
      role: "category-note",
      frame: horizontal && noteColumn
        ? { x: frame.x + frame.width - noteWidth, y: categoryStart + (groupSpan - noteLayout.height) / 2, width: noteWidth, height: noteLayout.height }
        : horizontal
        ? { x: plot.x - horizontalCategoryLabelWidth - negativeLabelGutter - 8 - (regionHighlight ? REGION_HIGHLIGHT_INLINE_PAD : 0), y: barBlockTop + barLabelLayout.height, width: horizontalCategoryLabelWidth - iconSlot, height: noteLayout.height }
        : { x: categoryMap.get(category).labelCenter - (categorySpan - 8) / 2, y: plot.y + plot.height + (regionHighlight ? 18 : 8) + iconSlot + categoryLayouts[categoryIndex].height, width: categorySpan - 8, height: noteLayout.height },
      text: noteLayout.text,
      style: { ...textStyle(AXIS_LABEL, SECONDARY, false, horizontal ? (noteColumn ? "left" : "right") : "center"), valign: "top", lineHeight: noteLayout.lineHeight, wrap: false },
      data: { category, textLayout: noteLayout, note: true, ...(noteColumn ? { column: true } : {}) }
    }));
  }
  // A name wider than the label column (capped at barLabelColumn's 180px) wraps within it, centred on its bar, rather than
  // running past the frame on a single line: "Lufthansa Group mainline and regional airlines" set 70px off the page.
  const rowWrap = horizontal && !barLabelLayout && !hideCategoryLabels ? measureText(String(category), horizontalCategoryLabelWidth - iconSlot, { fontFamily: tokenValue(FONT), fontSize: tokenValue(rowSize) }) : null;
  const wrapped = rowWrap && rowWrap.lines.length > 1 ? rowWrap : null;
  const blockLayout = barLabelLayout ?? wrapped;
  if (!hideCategoryLabels && (horizontal ? rowShown(categoryIndex) : labelShown(categoryIndex))) nodes.push(textPrimitive({
    id: stableId(id, "category", category),
    role: "category-label",
    frame: horizontal
      ? { x: plot.x - horizontalCategoryLabelWidth - negativeLabelGutter - 8 - (regionHighlight ? REGION_HIGHLIGHT_INLINE_PAD : 0), y: barLabelLayout ? barBlockTop : wrapped ? categoryStart + groupSpan / 2 - wrapped.height / 2 : Math.min(categoryStart, categoryStart + groupSpan / 2 - rowLine / 2), width: horizontalCategoryLabelWidth - iconSlot, height: blockLayout ? blockLayout.height : Math.max(groupSpan, rowLine) }
      : { x: categoryMap.get(category).labelCenter-labelSpan/2, y: plot.y + plot.height + (regionHighlight ? 18 : 8) + iconSlot, width: labelSpan, height: categoryLayouts[categoryIndex].height },
    text: horizontal ? (blockLayout ? blockLayout.text : category) : categoryLayouts[categoryIndex].text,
    style: { ...textStyle(horizontal && !barLabelLayout ? rowSize : AXIS_LABEL, SECONDARY, false, horizontal ? "right" : "center"), ...(!horizontal ? {valign:"top",lineHeight:categoryLayouts[categoryIndex].lineHeight,wrap:false} : blockLayout ? {valign:"top",lineHeight:blockLayout.lineHeight,wrap:false} : {}) },
    data: {category,...(!horizontal ? {textLayout:categoryLayouts[categoryIndex]} : blockLayout ? {textLayout:blockLayout} : {})}
  }));
}

/** The category's icon or logo. */
function drawCategoryIcon(chart, category, categoryStart) {
  const { id, horizontal, regionHighlight, categoryIcons, logoMarks, iconW, iconH, negativeLabelGutter, plot, nodes, categoryMap,
    categorySpan, groupSpan } = chart;
  // The category's icon or logo: under the column above its label, or
  // between a bar's label and the bar.
  const iconRecord = categoryIcons?.get(category);
  // A placeholder keeps the nominal slot; a logo may grow taller than it,
  // up to the lane, so a square mark gets the same ink as a wordmark. A flag
  // keeps the slot's height, which every flag shares.
  const slotH = horizontal ? (logoMarks && markDrawable(iconRecord?.image) && !isFlag(iconRecord.image) ? Math.min(iconH + 8, groupSpan - 2) : Math.min(iconH, groupSpan)) : iconH;
  if (iconRecord) nodes.push(...categoryIconNodes(id, category, iconRecord, horizontal
    ? { x: plot.x - negativeLabelGutter - 8 - (regionHighlight ? REGION_HIGHLIGHT_INLINE_PAD : 0) - iconW, y: categoryStart + (groupSpan - slotH) / 2, width: iconW, height: slotH }
    : { x: categoryMap.get(category).labelCenter - Math.min(iconW, categorySpan - 8) / 2, y: plot.y + plot.height + (regionHighlight ? 18 : 8), width: Math.min(iconW, categorySpan - 8), height: iconH },
    logoMarks ? { area: iconW * iconH * 0.6, align: horizontal ? "right" : "center" } : {}));
}

/** The dashed divider between the actual and the forecast categories. */
function drawForecastDivider(chart) {
  const { id, props, horizontal, forecastKeyed, plot, forecastIndex, nodes, categorySpan, slotStart } = chart;
  if (forecastKeyed && forecastIndex > 0) {
    // Midway between the last actual and the first forecast mark, across the
    // plot, dashed as the period dividers are: the non-colour half of the key.
    const at = (slotStart(forecastIndex - 1) + categorySpan + slotStart(forecastIndex)) / 2;
    nodes.push(linePrimitive({ id: stableId(id, "forecast-divider"), role: "chart-forecast-divider",
      ...(horizontal ? { x1: plot.x, y1: at, x2: plot.x + plot.width, y2: at } : { x1: at, y1: plot.y, x2: at, y2: plot.y + plot.height }),
      style: lineStyle(SECONDARY, token("line.hairline"), "dash"), data: { forecastFrom: props.forecastFrom } }));
  }
}

/** Each category group's bracket and label under the column labels. */
function drawCategoryGroups(chart) {
  const { id, categories, plot, categoryGroups, groupLayouts, nodes, categoryMap, categorySpan, horizontal } = chart;
  if (horizontal) return drawBarGroups(chart);
  for(const [i,group] of categoryGroups.entries()) {
    const start=categories.indexOf(group.categories[0]),end=start+group.categories.length;
    const x1=categoryMap.get(categories[start]).labelCenter-categorySpan/2+8,x2=categoryMap.get(categories[end-1]).labelCenter+categorySpan/2-8;
    const y=plot.y+plot.height+plot.categoryLabelHeight+tokenValue(token("space.4"));
    const data={groupId:group.id,dependencies:group.categories.map(category=>stableId(id,"category",category))};
    for(const [part,a,b,c,d] of [["span",x1,y,x2,y],["left",x1,y-4,x1,y],["right",x2,y-4,x2,y]])nodes.push(linePrimitive({id:stableId(id,"category-group",group.id,part),role:"category-group-rule",x1:a,y1:b,x2:c,y2:d,style:lineStyle(SECONDARY),data}));
    nodes.push(textPrimitive({id:stableId(id,"category-group",group.id,"label"),role:"category-group-label",frame:{x:x1,y:y+4,width:x2-x1,height:groupLayouts[i].height},text:groupLayouts[i].text,style:{...textStyle(AXIS_LABEL,SECONDARY),valign:"top",lineHeight:groupLayouts[i].lineHeight,wrap:false},data:{...data,textLayout:groupLayouts[i]}}));
  }
}

/** A bar chart's category groups: a bracket against each run of rows, its label at the left, centred on the run. */
function drawBarGroups(chart) {
  const { id, plot, categoryGroups, groupLayouts, nodes, categoryMap, horizontalCategoryLabelWidth, negativeLabelGutter, regionHighlight, groupColumnWidth } = chart;
  const labelsLeft = plot.x - horizontalCategoryLabelWidth - negativeLabelGutter - 8 - (regionHighlight ? REGION_HIGHLIGHT_INLINE_PAD : 0);
  const x = labelsLeft - 6, arm = 5;
  for (const [i, group] of categoryGroups.entries()) {
    const rows = group.categories.map((category) => categoryMap.get(category));
    const top = Math.min(...rows.map((r) => r.y)) + 1, bottom = Math.max(...rows.map((r) => r.y + r.height)) - 1;
    const data = { groupId: group.id, dependencies: group.categories.map((category) => stableId(id, "category", category)) };
    for (const [part, a, b, c, d] of [["span", x, top, x, bottom], ["top", x, top, x + arm, top], ["bottom", x, bottom, x + arm, bottom]])
      nodes.push(linePrimitive({ id: stableId(id, "category-group", group.id, part), role: "category-group-rule", x1: a, y1: b, x2: c, y2: d, style: lineStyle(SECONDARY), data }));
    const layout = groupLayouts[i], width = groupColumnWidth - 18;
    nodes.push(textPrimitive({ id: stableId(id, "category-group", group.id, "label"), role: "category-group-label", frame: { x: x - 6 - width, y: (top + bottom) / 2 - layout.height / 2, width, height: layout.height }, text: layout.text,
      style: { ...textStyle(AXIS_LABEL, INK, true, "right"), valign: "top", lineHeight: layout.lineHeight, wrap: false }, data: { ...data, textLayout: layout } }));
  }
}

/** Column value labels a reference line runs through: nudged clear, moved inside the column, or left for the line to break around. */
function keepValueLabelsOffReferenceLines(chart) {
  const { frame, props, horizontal, stacked, categories, series, colorFor, nodes, yScale } = chart;
  // A value label a reference line runs through stays on its column: lifted
  // above the line, a label on a column just under a target would float 45px
  // over its own mark, or leave the frame. In order: a line through the
  // label's edge nudges it a few pixels clear; a column tall enough takes the
  // label inside its top, under the line; otherwise the label keeps its place
  // and the reference line is broken around it (see `referenceGaps` in
  // decorations).
  if(!horizontal && !stacked && (props.referenceLines||[]).length) for(const label of nodes.filter(n=>n.role === "data-label" && n.data?.series !== undefined)) {
    const lines=(props.referenceLines||[]).filter(r=>!isMarker(r)).map(r=>yScale(r.value));
    const ink=measureDataLabel(label.text), pad=(label.frame.height-ink.height)/2;
    const clear=(top)=>lines.every(y=>y<top-3||y>top+ink.height+3);
    const inkTop=label.frame.y+pad;
    if(clear(inkTop)) continue;
    const categoryIndex=categories.indexOf(label.data.category), seriesIndex=series.findIndex(item=>item.name===label.data.series);
    const value=series[seriesIndex]?.values[categoryIndex];
    const mark=nodes.find(n=>n.role==="chart-mark"&&n.data.category===label.data.category&&n.data.series===label.data.series);
    const upward=value>=0;
    // 1. A nudge of up to eight pixels away from the mark's end.
    const crossing=lines.filter(y=>y>=inkTop-3&&y<=inkTop+ink.height+3);
    const nudged=upward?Math.min(...crossing)-3-ink.height:Math.max(...crossing)+3;
    if(Math.abs(nudged-inkTop)<=8&&clear(nudged)&&nudged>=frame.y){ label.frame={...label.frame,y:nudged,height:ink.height}; label.data={...label.data,referenceNudge:Math.round(nudged-inkTop)}; continue; }
    // 2. Inside the column's end, on the far side of the line from the label's old place.
    if(mark&&upward){
      // Six pixels under the column's top: a callout leader landing on that top keeps its corridor clear of the figure.
      const top=Math.max(mark.frame.y+6,Math.max(...crossing)+4);
      if(top+ink.height+4<=mark.frame.y+mark.frame.height&&clear(top)&&ink.width<=mark.frame.width-4){
        const fill=colorFor(seriesIndex,categoryIndex);
        Object.assign(label,textPrimitive({id:label.id,role:label.role,frame:{x:mark.frame.x,y:top-pad,width:mark.frame.width,height:label.frame.height},text:label.text,style:textStyle(CHART_LABEL,chart.lighter(seriesIndex,categoryIndex)?INK:onFill(fill),labelBold(),"center"),data:{...label.data,placement:"inside",referenceInside:true}}));
        continue;
      }
    }
    // 3. Stay put; the reference line breaks around the label.
    label.data={...label.data,referenceGap:true};
  }
}

/** `groupBrackets`: each run of categories bracketed with its sum or share (chart-marks.mjs). */
function drawGroupBrackets(chart) {
  const { id, horizontal, stacked, brackets, plot, categories, nodes, showDataLabels, barLabelWidth, barLabelGap, totalWidth, deltaWidth } = chart;
  if (!brackets.length) return;
  const rightOf = plot.x + plot.width + (stacked ? totalWidth : showDataLabels ? barLabelWidth + barLabelGap : 0) + deltaWidth + 6;
  nodes.push(...bracketNodes({ id, brackets, horizontal, plot, categories, nodes, rightOf }));
}

/** `rowNotes`: the note column at a bar chart's right, past its values, deltas and brackets (chart-marks.mjs). */
function drawRowNotes(chart) {
  const { id, rowNotes, stacked, plot, categories, categoryMap, nodes, showDataLabels, barLabelWidth, barLabelGap, totalWidth, deltaWidth, bracketWidth } = chart;
  if (!rowNotes) return;
  const left = plot.x + plot.width + (stacked ? totalWidth : showDataLabels ? barLabelWidth + barLabelGap : 0) + deltaWidth + bracketWidth + ROW_NOTE_GAP;
  nodes.push(...rowNoteNodes({ id, rowNotes, categories, categoryMap, nodes, left }));
}

/** `segmentGrowth`: the column of per-segment rates right of the plot. */
function drawSegmentGrowth(chart) {
  const { id, horizontal, deltas, segmentGrowth, plot, nodes, segmentMids } = chart;
  // Heading and one rate per segment, right of the plot, level with the last stack's segments; a column a period.
  for (const [k, growth] of (segmentGrowth || []).entries()) {
    const x = plot.x + plot.width + (deltas && horizontal ? 64 : 0) + 8 + k * 76, width = 66;
    const key = (...parts) => (k ? stableId(id, ...parts, k) : stableId(id, ...parts));
    nodes.push(textPrimitive({ id: key("growth-heading"), role: "chart-delta-label", frame: { x, y: plot.y - 22, width, height: 18 }, text: growth.label, style: textStyle(token("type.compact"), SECONDARY, false, "left"), data: { growthHeading: true } }));
    for (const row of growth.rows) {
      const mid = segmentMids.get(row.name);
      if (mid === undefined) continue;
      nodes.push(textPrimitive({ id: key("growth", row.name), role: "chart-delta-label", frame: { x, y: mid - 10, width, height: 20 }, text: row.text, style: textStyle(CHART_LABEL, INK, true, "left"), data: { series: row.name, growth: row.text } }));
    }
  }
}

/** The width a horizontal bar chart gives its category labels: shared with a chart group that aligns bars on one axis. */
export function barLabelColumn(categories) {
  const width = (text) => measureText(String(text), 180, { fontFamily: tokenValue(FONT), fontSize: tokenValue(AXIS_LABEL) }).width;
  return Math.min(180, Math.max(72, Math.ceil(Math.max(...categories.map(width))) + 12));
}
