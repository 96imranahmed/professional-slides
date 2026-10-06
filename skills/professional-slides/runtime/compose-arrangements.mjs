// The arrangements a page's evidence is laid out in, each one function from
// the page (its slide, layout and exhibits) to the layout-tree regions it
// pushes onto the page's items: peer exhibits in a row (`peerExhibitsRow`), an
// exhibit beside its commentary (`exhibitBesideCommentary`) or over it
// (`exhibitOverCommentary`, with the staircase variant `commentaryOverSteps`),
// labelled rows of blocks (`labelledRows`), the points set under a row of
// panels, and the single-layout pages: an exhibit across the page or a figure
// with its points, a table in halves, a hero number, a split-tone pair, a
// stack and a grid of exhibits.
import { defaultHighlightStyle } from "./core.mjs";
import { measureCaption, proseMeasure, measureProse, measureInsight } from "./registry-text.mjs";
import { chartAnnotationBands, evidenceBandSpan } from "./chart-annotations.mjs";
import { plotHeadroom, topBand, horizontalChart } from "./chart-axes.mjs";
import { legendRowCount } from "./legends.mjs";
import { stepsLayout } from "./extras.mjs";
import { factGridLayout } from "./figures.mjs";
import { renderTable, withoutInferredBars } from "./tables.mjs";
import { metricHeight } from "./panels.mjs";
import { SIZE, HUG, BODY_WIDTH, COLUMN_GAP, CONNECTOR_WIDTH, BODY_HEIGHT, SIDE_COLUMN_SHORT, SIDE_COLUMN_DEPTH, SIDE_COLUMN_MIN_WIDTH } from "./compose-body.mjs";
import { heavyTable, styleTable } from "./compose-tables.mjs";
import { sharedBound, SIDEWAYS_CATEGORIES } from "./compose-charts.mjs";
import { exhibitItem, headedPanel } from "./compose-exhibits.mjs";
import { paragraph, pointColumns, pointsItem, sideTreatment, listDepth, pointsPerRow, proseOf, bridgeVariant } from "./compose-points.mjs";
import { photoStrip } from "./compose-pictures.mjs";
import { metricsColumn } from "./compose-metrics.mjs";
import { hasCommentary } from "./compose-layouts.mjs";

/**
 * Two peer exhibits side by side: `two-up` and `two-up-contrast`.
 *
 * One of `composeSlide`'s layout branches, in a function of its own; it
 * pushes into the caller's `items`, so the page keeps the caller's order.
 */
export function peerExhibitsRow(items, { id, slide, layout, exhibits, baseDir, fill, pointsStyle, pictures }) {
  peerTypography(exhibits, layout);
  shareCaptionHeight(exhibits, { id, slide, layout });
  fitLineLabelsToPanels(exhibits, layout);
  const charts = exhibits.filter((ex) => String(ex.type).startsWith("chart.") && Array.isArray(ex.series));
  shareValueScales(charts);
  shareBarDomain(charts, { id, slide });
  sharePlotFrame(charts);
  // Chart beside a narrow table (three columns or fewer): the chart takes 3:2.
  const panelSize = (ex, index) => {
    if (slide.pairedWeights) return { width: { fr: slide.pairedWeights[index] }, height: "fill" };
    if (exhibits.length !== 2) return SIZE;
    const other = exhibits.find((_, i) => i !== index);
    const narrow = (t) => t?.type === "table" && (t.columns || []).length <= 3;
    if (String(ex.type).startsWith("chart.") && narrow(other)) return { width: { fr: 3 }, height: "fill" };
    if (narrow(ex) && String(other?.type).startsWith("chart.")) return { width: { fr: 2 }, height: "fill" };
    return SIZE;
  };
  const panels = exhibits.slice(0, 4).map((sourceEx, i) => {
    // A schedule paired with a table shares its evidence top. Preserve an
    // explicitly authored alternative; a standalone schedule stays centred.
    const ex = sourceEx.type === "gantt" && sourceEx.valign === undefined && exhibits.some(peer => peer.type === "table")
      ? { ...sourceEx, valign: "top" } : sourceEx;
    // A figure with a natural size hugs it at the top of its panel, level
    // with its peers' first lines, rather than centring in the panel's height.
    const panel = centredFigure(ex)
      ? { id: `${id}-figure-${i}`, layout: "flow.column", size: panelSize(ex, i), items: [exhibitItem(ex, `${id}-exhibit-${i}`, baseDir, HUG)] }
      : { ...exhibitItem(ex, `${id}-exhibit-${i}`, baseDir), size: panelSize(ex, i) };
    // Charts own their heading inside the component. An empty section above
    // an unheaded peer table would add a second, invisible heading band and
    // push that table's actual header below the chart's reading start.
    return headedPanel(ex, panel, `${id}-exhibit-${i}`,
      !exhibits.some(peer => String(peer.type).startsWith("chart.")));
  });
  // `sequence`: the same row read as steps, a block arrow in each gutter
  // pointing from one exhibit to the next - cause to effect, before to after.
  // The arrow is the relation; a row of peers without it is a comparison.
  const row = layout === "sequence"
    ? panels.flatMap((panel, i) => (i ? [{ id: `${id}-step-${i}`, component: "connector", props: { variant: "arrow" }, size: { width: CONNECTOR_WIDTH, height: "fill" } }, panel] : [panel]))
    : panels;
  items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: row });
  if (slide.points?.length) items.push(pointsUnderPanels(slide.points, { id, slide, layout, panels, fill, pointsStyle }));
}

// `two-up-contrast` is the same row with each panel carrying its own
// caption and no shared column: the page's commentary sits under the panel
// it belongs to, so neither exhibit is the subject and the other the proof.
//
// Peer tables share one density: a row with a text-heavy table steps every
// table in it to compact together, so type stays uniform across the row.
function peerTypography(exhibits, layout) {
  if (layout === "two-up-contrast") for (const ex of exhibits) if (ex.caption === undefined && ex.heading) ex.caption = undefined;
  const tables = exhibits.filter((ex) => ex.type === "table");
  if (tables.length >= 2) {
    if (tables.some(heavyTable)) for (const ex of tables) ex.density = ex.density || "compact";
    // An authored pair shares typography, not necessarily semantic roles.
    // Preserve each table's treatment: a category axis beside a record list
    // must retain its meaning in the saved page.
  }
}

// Captions in a row are measured together and given one height, so the
// panels above them keep one baseline.
function shareCaptionHeight(exhibits, { id, slide, layout }) {
  const captioned = exhibits.filter((ex) => typeof ex.caption === "string" && ex.caption.trim());
  if (captioned.length) {
    // The captions are the page's commentary. A points column under them
    // squeezes the page's own conclusion into whatever is left, so a page
    // captions its panels or carries a list, not both.
    if (slide.points?.length) throw new Error(`${id}: panel captions are the commentary; drop the page's points or the captions`);
    // A sequence gives each gutter to an arrow and its two gaps.
    const gutters = (exhibits.length - 1) * (layout === "sequence" ? CONNECTOR_WIDTH + 2 * COLUMN_GAP : COLUMN_GAP);
    const width = Math.max(160, (BODY_WIDTH - gutters) / exhibits.length);
    // Measured as the caption sets it, so the shared height never
    // under-allocates the caption it is for.
    const height = Math.max(...captioned.map((ex) => measureCaption(ex.caption.trim(), width)));
    for (const ex of captioned) ex.captionHeight = Math.ceil(height);
  }
}

// A two-series line names its series at the line ends, in a 186px column
// at the right of the plot. Three ten-year lines in a sequence leave each
// panel 332px, of which the names would take 186, leaving 90px of plot; in
// a panel under twice that column the names go to a legend above the plot
// instead. An author's explicit `endLabels` or `directLabels` holds.
function fitLineLabelsToPanels(exhibits, layout) {
  const panelWidth = (BODY_WIDTH - (exhibits.length - 1) * (layout === "sequence" ? CONNECTOR_WIDTH + 2 * COLUMN_GAP : COLUMN_GAP)) / exhibits.length;
  for (const ex of exhibits) {
    if (!["chart.line", "chart.area"].includes(ex.type) || (ex.series || []).length < 2 || panelWidth >= 2 * 186) continue;
    if (ex.endLabels === undefined && ex.directLabels === undefined) { ex.endLabels = false; ex.legend = ex.legend ?? true; }
  }
}

// Peer charts with one unit share one value scale, or the comparison lies.
// The scale is shared within each unit, not only when every panel has the
// same one: two "% y/y" bar panels beside a passenger column still share
// theirs, down to a -18% bar that a zero minimum would put outside the axis.
function shareValueScales(charts) {
  const byUnit = new Map();
  for (const ex of charts) byUnit.set(ex.unit, [...(byUnit.get(ex.unit) || []), ex]);
  for (const group of byUnit.values()) {
    if (group.length < 2 || group.some((ex) => ex.yMax !== undefined)) continue;
    // Stacks extend separately above and below zero: netting signed
    // segments or forcing zero as the minimum truncates real evidence.
    const extent = ex => ["chart.stacked-column", "chart.stacked-bar"].includes(ex.type)
      ? (ex.categories || []).flatMap((_, i) => [
        ex.series.reduce((sum, se) => sum + Math.min(0, se.values[i] || 0), 0),
        ex.series.reduce((sum, se) => sum + Math.max(0, se.values[i] || 0), 0),
      ])
      : ex.series.flatMap(se => se.values);
    // Every mark the scale has to hold, from every panel: reference lines and
    // targets too, each with the 15% the chart itself gives a line near the
    // top so its label has room (chart-decorations.mjs withReferenceValues).
    const marks = group.flatMap(extent);
    const top = Math.max(0, ...marks);
    const lines = group.flatMap(ex => [...(ex.referenceLines || []).map(reference => reference.value), ...(ex.targets || [])]).filter(Number.isFinite);
    const values = [...marks, ...lines, ...lines.filter(v => v > 0 && v >= top * 0.9).map(v => v * 1.15)];
    const min = Math.min(0, ...values), max = Math.max(0, ...values);
    const sharedMin = min < 0 ? -sharedBound(-min) : 0;
    const sharedMax = max > 0 ? sharedBound(max) : min < 0 ? 0 : 1;
    for (const ex of group) { ex.yMin = ex.yMin ?? sharedMin; ex.yMax = sharedMax; }
  }
}

// Equal numerical limits alone do not make equal bar lengths: different
// category gutters and Office auto-layout change the pixels per unit.
// Compare horizontal peers in the shared editable scene coordinate system.
function shareBarDomain(charts, { id, slide }) {
  const horizontalPeers = charts.filter(ex => horizontalChart(ex.type));
  if (horizontalPeers.length >= 2 && !slide.pairedWeights && horizontalPeers.every(ex => ex.unit === horizontalPeers[0].unit)) {
    // An unset minimum is the lowest bar of any peer, not zero: zero puts a
    // negative bar outside its own axis.
    const lowest = Math.min(0, ...horizontalPeers.flatMap(ex => ex.series.flatMap(series => series.values)));
    const floor = lowest < 0 ? -sharedBound(-lowest) : 0;
    const minima = new Set(horizontalPeers.map(ex => ex.yMin ?? floor));
    const maxima = new Set(horizontalPeers.map(ex => ex.yMax));
    if (minima.size !== 1 || maxima.size !== 1) throw new Error(`${id}: peer bars with the same unit require matching numeric domains`);
    const comparisonDomain = { categories: horizontalPeers.flatMap(ex => ex.categories), values: horizontalPeers.flatMap(ex => ex.series.flatMap(series => series.values)) };
    for (const ex of horizontalPeers) { ex.yMin = ex.yMin ?? floor; ex.comparisonDomain = comparisonDomain; ex.native = false; }
  }
}

// One scale needs one plot frame: peers share the row's tallest top band
// (legend, growth arrows), and when one peer must be drawn as shapes
// (annotations), all of them are, so their baselines coincide.
//
// Callout bands are shared only where the plots must be the same height:
// columns and lines on one value scale (one pixel per unit needs one plot
// height), and bars whose rows read across (the same categories). Shared
// across units, one panel's callout would leave its neighbour - another
// unit, another scale - under a band of air; unshared, each panel keeps its
// own band and the plots still meet at the baseline. Within one scale the
// band stays shared, callout or not: a callout beside its mark has no room
// on a short column between tall neighbours, and a shorter plot beside a
// taller one on the same scale draws the same value at two heights, which
// is the lie the shared scale exists to prevent.
// page-types.mjs describeTypes publishes this to the author.
function sharePlotFrame(charts) {
  if (charts.length >= 2) {
    const decorated = (ex) => (ex.referenceLines || []).length || (ex.annotations || []).length || (ex.changeAnnotations || []).length || (ex.highlights || []).some((h) => (h?.style ?? defaultHighlightStyle(ex.type, ex)) !== "bar");
    const baseBand = (ex) => {
      const line = ex.type === "chart.line" || ex.type === "chart.area", multi = (ex.series || []).length > 1;
      const legend = ex.legend === true || (ex.legend !== false && multi && !line);
      // The legend may wrap; the row's inset must cover the tallest one (1160px row, n panels).
      const rows = legend ? legendRowCount((ex.series || []).map((sr) => sr.name), Math.max(120, 1160 / Math.max(1, charts.length) - 70)) : 0;
      return topBand(rows, plotHeadroom(ex.type)) + chartAnnotationBands({ changeAnnotations: ex.changeAnnotations || [] }).top;
    };
    // Callouts counted at their compact height: the row's band is the budget,
    // and a peer whose full 88px bands would overrun it closes them to fit
    // (chart-axes.mjs chartFrame), so the plots still share one top line.
    const calloutBand = (ex) => evidenceBandSpan({ annotations: ex.annotations || [] }, { compact: true });
    // A plot with no value axis - a waffle's dots, a treemap's tiles, a pie -
    // has no baseline to share. Handed the row's band, a waffle beside an
    // annotated bar chart would draw its dots under a strip of air as tall as
    // its neighbour's callout.
    const aligned = charts.filter((ex) => !["chart.waffle", "chart.treemap", "chart.pie", "chart.donut"].includes(ex.type));
    const base = Math.max(0, ...aligned.map(baseBand));
    const scaleKey = (ex) => horizontalChart(ex.type) ? `rows:${JSON.stringify(ex.categories)}` : ex.yMax === undefined ? null : `scale:${ex.unit}:${ex.yMin}:${ex.yMax}`;
    const groups = new Map();
    for (const ex of aligned) { const key = scaleKey(ex); if (key) groups.set(key, [...(groups.get(key) || []), ex]); }
    for (const ex of aligned) {
      const key = scaleKey(ex), group = key && groups.get(key)?.length > 1 ? groups.get(key) : [];
      // Bars whose rows read across, each on its own scale (different units):
      // a callout goes in its bar's row - beside the bar end, or inside a long
      // bar - not in a band above the plot: shared to keep the rows level, the
      // band would stand empty over the panel without a callout. A callout
      // that finds no place in its row still falls back to a rail at its own
      // panel's right, which narrows that plot and keeps the rows level.
      if (horizontalChart(ex.type) && group.length > 1 && !ex.comparisonDomain && (ex.annotations || []).length) {
        ex.annotations = ex.annotations.map((a) => (a && typeof a === "object" && !a._placement ? { ...a, _placement: "beside" } : a));
        ex.plotTopInset = base;
        continue;
      }
      const shared = group.filter((peer) => !(horizontalChart(peer.type) && !peer.comparisonDomain));
      ex.plotTopInset = base + Math.max(0, ...shared.map(calloutBand));
      // The band is the row's: a callout here keeps it rather than moving into
      // the plot (charts.mjs renderResolved), or the plots would part.
      if (shared.some((peer) => (peer.annotations || []).length)) ex.calloutBand = "shared";
    }
    if (charts.some(decorated)) for (const ex of charts) ex.native = false;
  }
}

/**
 * Points under a row of panels, in columns. Set as one list across the body
 * they run about 150 characters a line, past any readable measure. One point
 * to a panel sits under its panel, at the panel's width; any other count runs
 * in rows (pointColumns), as the points under a single exhibit do. On a
 * photograph's card, a little over half the page wide, `most: 2`: three
 * across are 190px columns, and the card's points stay open type on the
 * card's own surface.
 */
export function pointsUnderPanels(points, { id, slide, layout, panels, fill, pointsStyle, tone = sideTreatment(slide), most }) {
  const column = (list, at, size) => ({ id: `${id}-points-${at}`, layout: "flow.column", size, items: [pointsItem(list, `${id}-points-${at}-list`, tone, fill, false, pointsStyle)] });
  // One point is a paragraph, at the capped measure paragraphs keep, its lead
  // running into the sentence in bold and its phrase in the accent.
  if (points.length === 1) {
    const entry = typeof points[0] === "string" ? { text: points[0] } : points[0] ?? {};
    return paragraph(`${id}-points`, [entry.lead, entry.text].filter(Boolean).join(" "), entry.highlight, entry.lead ? { lead: entry.lead } : {});
  }
  if (points.length === panels.length && layout !== "sequence")
    return { id: `${id}-points`, layout: "flow.row", size: HUG, items: points.map((point, at) => column([point], at, { width: panels[at].size?.width ?? { fr: 1 }, height: "hug" })) };
  return { id: `${id}-points`, size: HUG, ...pointColumns(points.map((point, at) => column([point], at, { width: { fr: 1 }, height: "hug" })), `${id}-points-row`, most) };
}

/**
 * The exhibit across the full width with its commentary beneath it: `exhibit-top`.
 *
 * One of `composeSlide`'s layout branches, in a function of its own; it
 * pushes into the caller's `items`, so the page keeps the caller's order.
 */
/**
 * A staircase's commentary set in the space it climbs into.
 *
 * A stair fills the lower right of its frame and leaves the upper left, over
 * its first steps, empty: under a band of points that is a triangle a third
 * of the page wide over a figure squeezed into what the band leaves. Where the
 * points fit over the lower steps at a reading measure, they are set there,
 * headed, and the stair stands on the body's foot and climbs the whole body
 * beside them (extras.mjs stepsRise, `reserve`). Where they do not, the page
 * keeps them under the figure.
 */
// The body the fit is judged against: a little under a two-line title's body,
// so a standfirst's line does not turn a fit into a refusal at render.
const STAIR_FIT_HEIGHT = BODY_HEIGHT - 44, STAIR_HEADING = 44;
function commentaryOverSteps({ id, slide, exhibits, baseDir, fill, pointsStyle }) {
  const ex = exhibits[0];
  if (ex?.type !== "steps" || exhibits.length !== 1 || !slide.points?.length || fill === "airy" || slide.pointsAlign === "middle") return null;
  let L;
  try { L = stepsLayout({ x: 0, y: 0, width: BODY_WIDTH, height: STAIR_FIT_HEIGHT }, ex); } catch { return null; }
  const n = L.items.length, heading = slide.pointsHeading === false ? null : slide.pointsHeading || "What it means";
  const list = pointsItem(slide.points, `${id}-points`, "open", fill, false, pointsStyle);
  for (let under = n - 1; under >= 1; under -= 1) {
    const width = under * L.width + (under - 1) * L.gap;
    // The points keep a reading measure: wider than it, they run past CPL.
    if (width > proseMeasure().widest) continue;
    const depth = Math.ceil((heading ? STAIR_HEADING : 0) + listDepth(list, width, slide.density));
    const reserve = { width: width + L.gap, height: depth + COLUMN_GAP };
    const clear = STAIR_FIT_HEIGHT - reserve.height;
    const rise = Math.min((STAIR_FIT_HEIGHT - L.base) / (n - 1), under > 1 ? (clear - L.base) / (under - 1) : Infinity);
    // The stair still climbs by at least its natural rise beside the points.
    if (clear < L.base || rise < L.rise) continue;
    return { id: `${id}-stair`, layout: "overlay", size: SIZE, items: [
      exhibitItem({ ...ex, reserve }, `${id}-exhibit`, baseDir, SIZE),
      { id: `${id}-over`, ...(heading ? { heading } : {}), treatment: "open", layout: "flow.column", frame: { x: 0, y: 0, width, height: depth }, items: [list] },
    ] };
  }
  return null;
}

export function exhibitOverCommentary(items, { id, slide, exhibits, baseDir, fill, pointsStyle }) {
  const stair = slide.pageType ? commentaryOverSteps({ id, slide, exhibits, baseDir, fill, pointsStyle }) : null;
  if (stair) { items.push(stair); return; }
  // Three or four facts in a row over two or three points are a strip of
  // tiles and a strip of text with a third of the page empty under them. When
  // the page type left the geometry to the composer and the stack would stop
  // that short, the facts run down a stat column at the left and the points
  // down the rest, both the body's height.
  const facts = exhibits[0];
  if (slide.pageType && facts?.type === "fact-grid" && facts.columns === undefined && (facts.items || []).length <= 4 && slide.points.length <= 3) {
    const row = factGridLayout({ x: 0, y: 0, width: BODY_WIDTH, height: BODY_HEIGHT }, facts);
    const across = pointsPerRow(slide.points.length);
    const below = Math.max(...slide.points.map((point) => measureProse(typeof point === "string" ? point : [point?.lead, point?.text].filter(Boolean).join(" "), (BODY_WIDTH - COLUMN_GAP * (across - 1)) / across)));
    if (row.rows === 1 && (row.height * 1.35 + COLUMN_GAP + 44 + below) / BODY_HEIGHT < SIDE_COLUMN_SHORT) {
      items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: [
        exhibitItem({ ...facts, columns: 1 }, `${id}-exhibit`, baseDir, { width: { fr: 1 }, height: "fill" }),
        { id: `${id}-side`, ...(slide.pointsHeading === false ? {} : { heading: slide.pointsHeading || "What it means" }), treatment: "open", layout: "flow.column",
          // Narrow enough to read: a line of body type under ninety characters.
          size: { width: { fr: 1.2 }, height: "fill" }, items: [pointsItem(slide.points, `${id}-points`, "open", fill, true, pointsStyle)] },
      ] });
      return;
    }
  }
  // The exhibit across the full width, its commentary in columns beneath it.
  // A wide exhibit - ten categories, a twelve-row table - has no width to
  // give a side column, and three findings read better as three columns than
  // as three stacked paragraphs in a 360px gutter.
  const item = exhibitItem(exhibits[0], `${id}-exhibit`, baseDir, { width: { fr: 1 }, height: "fill" });
  if (String(exhibits[0].type).startsWith("chart.") && item.props?.unit && !item.props.unitPlacement) item.props.unitPlacement = "inline";
  // A point's lead becomes the column's heading only when its sentence can
  // stand without it. Points are often written to run on from the lead ("Core
  // regionals carry the most activity" + "with 54 use cases in ideation"),
  // and hoisting the lead into a heading leaves the column starting mid
  // sentence - so those join back into one paragraph instead.
  const standsAlone = (text) => /^[A-Z0-9"“(]/.test(String(text).trim());
  // A lone implication takes the exhibit's track: heading at the body's left
  // margin, text reaching the same right edge as the last column above it.
  // The 80-character measure cap is for sustained prose in a column; a close
  // set under a full-width exhibit is a band, and a well-made page sets the
  // band to the width of the thing it is read off - under a chart, the width
  // of the chart; under a full-width table, the width of the page.
  const loneBand = slide.points.length === 1;
  // One style for the row: decided point by point, a sentence that begins in
  // lower case ("flydubai is ...") would run its lead inline while its
  // neighbour's lead stood as a heading, and one band would read as two
  // devices.
  const entries = slide.points.map((point) => (typeof point === "string" ? { text: point } : point));
  const hoistAll = entries.every((entry) => entry.lead && standsAlone(entry.text));
  const columns = entries.map((entry, at) => {
    const hoist = hoistAll;
    const text = hoist ? entry.text : [entry.lead, entry.text].filter(Boolean).join(" ");
    // A lead that stays in the sentence still leads it: it runs in bold, the
    // way a well-made page sets the phrase that carries the finding.
    // The page's highlight is set in the accent too.
    const lead = !hoist && entry.lead ? { lead: entry.lead } : {};
    // `rule: false`: the block above already carries one under "What it
    // means". A hairline under each of three sub-headings as well turns one
    // divided idea into four ruled boxes, and the reader reads the rules
    // before the words.
    // One implication under a full-width exhibit takes the exhibit's width:
    // hugging its own measure and centring, it would float in the middle of
    // the support region, related to the table above it by nothing. Set to
    // the same track, its first word sits under the first column and its last
    // under the last, which is how a well-made page closes an exhibit: the
    // finding runs as a band the width of the chart it is read off, or the
    // width of the page.
    return { id: `${id}-col-${at}`, layout: "flow.column", size: { width: { fr: 1 }, height: "fill" },
      ...(hoist ? { heading: entry.lead, headingRule: false } : {}),
      items: [paragraph(`${id}-col-${at}-text`, text, entry.highlight, { ...lead, ...(loneBand ? { maxMeasure: false } : {}) })] };
  });
  // The columns share one heading, the way the side column does: without it
  // the page drops straight from the plot into three paragraphs with nothing
  // saying what they are. `pointsHeading: false` suppresses it.
  const belowHeading = slide.pointsHeading === false ? null : slide.pointsHeading || "What it means";
  // Preserve authored prose. Cards can be authored as components; swapping
  // them in based on earlier pages does not create a new evidence relationship.
  const headBelow = !columns.every((column) => column.heading)
    ? belowHeading : slide.pointsHeading || null;
  items.push({ id: `${id}-stack`, layout: "flow.column", size: SIZE, items: [
    headedPanel(exhibits[0], item, `${id}-exhibit`, false),
    { id: `${id}-below`, ...(headBelow ? { heading: headBelow } : {}), size: HUG, ...pointColumns(columns, `${id}-below`) },
  ] });
}

/**
 * Labelled row blocks: `labelled-rows`.
 *
 * Two to five rows down the page, each a filled label block in the house
 * colour, its bullets beside it and, where the rows have evidence, a number or
 * a small exhibit at the right. It is how a strong deck sets out three
 * challenges, what changed in each area, or a diagnosis: the labels read down
 * the left edge as the page's outline, and each row is read across.
 *
 * The rows share the body height equally, so the page fills to its foot and
 * every label block is the same size - blocks of different heights read as
 * items of different weight. The label and the right-hand column take fixed
 * widths so they align from row to row; the bullets take the rest and centre
 * on their block.
 */
const BLOCK_LABEL_WIDTH = 228, BLOCK_SIDE_WIDTH = 300;
export function labelledRows(items, { id, slide, baseDir, fill }) {
  const blocks = slide.blocks || [];
  if (blocks.length < 2) throw new Error(`${id}: a labelled-rows page carries two or more \`blocks\`, each { label, points }`);
  const rows = blocks.map((block, at) => {
    if (!block?.label || !(block.points || []).length) throw new Error(`${id}: block ${at + 1} needs its \`label\` and \`points\``);
    const label = { id: `${id}-label-${at}`, component: "side-statement", props: { text: String(block.label).trim(), tone: "primary" },
      size: { width: BLOCK_LABEL_WIDTH, height: "fill" } };
    const text = { id: `${id}-text-${at}`, layout: "flow.column", leftover: "center", size: { width: { fr: 1 }, height: "fill" },
      items: [pointsItem(block.points, `${id}-points-${at}`, "open", fill, false, null)] };
    const side = block.metric
      ? { id: `${id}-metric-${at}`, component: "metric", props: { value: String(block.metric.value), label: block.metric.label, ...(block.metric.delta ? { delta: block.metric.delta } : {}), ...(block.metric.better ? { better: block.metric.better } : {}) },
          size: { width: BLOCK_SIDE_WIDTH, height: "fill" } }
      : block.exhibit ? { ...exhibitItem(block.exhibit, `${id}-exhibit-${at}`, baseDir), size: { width: BLOCK_SIDE_WIDTH, height: "fill" } } : null;
    return { id: `${id}-block-${at}`, layout: "flow.row", size: SIZE, items: [label, text, side].filter(Boolean) };
  });
  // Each block is its share of the body, less the gaps between blocks.
  const blockHeight = (BODY_HEIGHT - 12 * (rows.length - 1)) / rows.length;
  oneTableTreatment(rows.map((row) => row.items.find((item) => item.component === "table")).filter(Boolean), { width: BLOCK_SIDE_WIDTH, height: blockHeight });
  items.push({ id: `${id}-blocks`, layout: "flow.column", gap: "space.3", size: SIZE, items: rows });
}

/**
 * One page's tables share a treatment. Left to itself each small table takes
 * the in-cell bars the composer infers wherever its figures allow them, and a
 * page of three row tables draws bars on one and plain figures on another
 * whose cells are bounds (">500", "~12"): the same kind of evidence in two
 * visual languages. Where any of them cannot carry the bars at the width it
 * is drawn, none does.
 */
function oneTableTreatment(tables, { width, height }) {
  if (tables.length < 2) return;
  // Drawn as the page will draw it: a table short of height widens its label
  // column to keep its names on one line, and its bars give way to figures.
  const render = (props) => { try { return renderTable({ id: "probe", frame: { x: 0, y: 0, width, height: Math.floor(height) }, props }).nodes; } catch { return null; } };
  const barred = (item, props = item.props) => Boolean(render(props)?.some((node) => node.role === "table-bar"));
  // A table carries the bars when its figures took them (the composer infers
  // them only on exact figures, never on bounds like ">500") and the page draws
  // them at its width.
  const inferred = (item) => (item.props.columns || []).some((c) => c?.inferred === true && c.type === "bars");
  // A table of words ("None", "Not disclosed") has no figure to draw either
  // way; the tables that print figures are the ones that must agree.
  const cellsOf = (item) => (item.props.rows || []).flatMap((row) => (Array.isArray(row) ? row : row.cells || []).slice(1));
  const figured = tables.filter((item) => inferred(item) || cellsOf(item).some((cell) => /\d/.test(String(cell?.text ?? cell?.labels?.[0] ?? cell ?? ""))));
  if (figured.some(inferred) && !(figured.every(inferred) && figured.every((item) => barred(item)))) {
    // Where it is width alone that costs a table its bars, the page's tables
    // step to the compact size together and all keep them.
    if (figured.every(inferred) && figured.every((item) => barred(item, { ...item.props, density: "compact" }))) for (const item of tables) item.props = { ...item.props, density: "compact" };
    else for (const item of tables) item.props = withoutInferredBars(item.props);
  }
  // And one type size: a table whose unit line costs it the height steps down
  // with every table on the page, never a size under the ones beside it.
  const LADDER = ["body", "compact", "dense"];
  const size = (item) => {
    const nodes = render(item.props);
    const stepped = nodes?.find((node) => node.data?.fitStep)?.data.fitStep;
    return LADDER.indexOf(stepped ?? item.props.density ?? "body");
  };
  const densest = Math.max(...tables.map(size));
  if (densest > 0) for (const item of tables) item.props = { ...item.props, density: LADDER[densest] };
}

// Two predicates on an exhibit, shared by `composeSlide` and its layout
// branches.
//
// A staircase, a cycle and a chevron process are figures with a natural size: a
// three-step staircase wants about 230px whatever the page offers it, and
// handed the whole body it spreads into small islands with a hundred pixels of
// nothing between them. They hug their natural size at the top of their region.
export const centredCards = (ex) => ex.type === "cards" && ex.tone !== "header" && ex.tone !== "numbered" && (ex.items || []).every((i) => i.icon && !(i.points || []).length);
export const centredFigure = (ex) => ["steps", "cycle", "chevron-process"].includes(ex?.type)
  || (ex?.type === "roadmap" && ["phase-workstreams", "wave-columns"].includes(ex.variant));

/**
 * The evidence-beside-its-commentary row: `exhibit-left` and `exhibit-right`.
 *
 * One of `composeSlide`'s layout branches, in a function of its own: the
 * column's width is measured against what it holds, its vertical alignment
 * against how much of the track it fills, its heading against whether the
 * points carry their own leads. It pushes into the caller's `items`, so the
 * page keeps the caller's order.
 */
export function exhibitBesideCommentary(items, { id, slide, layout, exhibits, baseDir, fill, pointsStyle }) {
  // Side ratios: chart + points 2:1, table + points 3:2 — a starting point,
  // not a constant. The column is then measured against what it holds (below).
  const heroFr = exhibits[0].type === "table" || exhibits[0].type === "rows" || exhibits[0].type === "compare" ? 3 : 2;
  const baseSideFr = heroFr === 3 ? 2 : 1;
  // A chart beside a text column keeps a one-line heading with the unit
  // inline; the two-line heading is for peers in a row, where the bands align.
  const heroItem = exhibitItem(exhibits[0], `${id}-exhibit`, baseDir, { width: { fr: heroFr }, height: "fill" });
  if (String(exhibits[0].type).startsWith("chart.") && heroItem.props?.unit && !heroItem.props.unitPlacement) heroItem.props.unitPlacement = "inline";
  const { tone, list, kpiTile, insightBoxes, prose, sideItems, heading, hero } = sideColumnContents({ id, slide, exhibits, fill, pointsStyle, heroItem });
  const { sideExtras, trackHeight, sideFr } = sideColumnWidth({ slide, fill, heroFr, baseSideFr, list, kpiTile, insightBoxes, heading });
  // A column of points alone that stays short at its narrowest is set under
  // the exhibit instead, in columns across it, and the exhibit takes the row:
  // two or three points beside a scatter run 45-55% down the page and leave
  // the rest of the column empty. A number, a statement box or prose in the
  // column has no place below, so those columns stay where they are. Only a
  // layout the page type derived is rebalanced (its `commentary` says where
  // the explanation lives, beside the exhibit; the geometry is the
  // composer's); a layout written by hand is the author's.
  const pointsOnly = list && !kpiTile && !insightBoxes.length && !prose.length && !slide.photo && Boolean(slide.pageType);
  // Measured at the width the row will give it: no connector unless the page
  // asks for one, and one gap between the exhibit and the column.
  const drawnTrack = (fr) => (BODY_WIDTH - (bridgeVariant(slide, id) ? CONNECTOR_WIDTH + COLUMN_GAP : 0) - COLUMN_GAP) * (fr / (heroFr + fr));
  // The exhibit that takes the row is one that uses width: a chart whose
  // categories run across, or a flow read left to right. Bars read down their
  // rows and a table down its lines; set under points they lose the height
  // they are read by.
  const widens = (String(exhibits[0].type).startsWith("chart.") && !SIDEWAYS_CATEGORIES.has(exhibits[0].type)) || exhibits[0].type === "flow";
  if (pointsOnly && widens && fill !== "airy" && slide.pointsAlign !== "middle" && slide.points.length <= 4
      && (sideExtras + listDepth(list, drawnTrack(sideFr), slide.density)) / trackHeight < SIDE_COLUMN_SHORT) {
    exhibitOverCommentary(items, { id, slide, exhibits, baseDir, fill, pointsStyle });
    return;
  }
  besideRow(items, { id, slide, layout, baseDir, fill, tone, list, insightBoxes, sideItems, heading, hero, sideFr, exhibit: exhibits[0] });
}

/** What the side column holds - a number, statements, prose, the points - its heading, and the hero panel headed to match. */
function sideColumnContents({ id, slide, exhibits, fill, pointsStyle, heroItem }) {
  // The side column is a headed section so its rule shares the chart heading's
  // band and the points start level with the plot, not with the heading text.
  // `pointsAlign: "middle"` centres the points on the exhibit instead.
  const tone = sideTreatment(slide);
  // The list starts at the top of its track, level with the exhibit, and
  // spreads its gaps to their cap; what the cap leaves is the column's foot.
  // Centred in an unheaded track, a column carries a band of air above its
  // first point as tall as the one under its last, and the gates read by
  // column. The answer to a column that still ends high is a narrower column
  // (sideFr, below), not a centred one.
  const list = slide.points?.length ? pointsItem(slide.points, `${id}-points`, tone, fill, true, pointsStyle, false) : null;
  // `kpi: { value, label }`: the one big number the chart proves, in the accent
  // at the top of the side column, above the points.
  const kpiTile = slide.kpi ? { id: `${id}-kpi`, component: "metric", props: { value: slide.kpi.value, label: slide.kpi.label, ...(slide.kpi.sublabel ? { sublabel: slide.kpi.sublabel } : {}), tone: "hero", variant: "prominent" }, size: { width: { fr: 1 }, height: 110 } } : null;
  // `insight`: the so-what as a tonal box in the side column, centred on the
  // exhibit when it stands alone, above the points when there are some. The
  // column then carries no heading unless `pointsHeading` names one.
  // `insights: [a, b]` is the familiar pattern of flanking an exhibit with two
  // statements that carry the numbers in words; `insight` is the single box.
  const insightSpecs = (Array.isArray(slide.insights) ? slide.insights : slide.insight !== undefined ? [slide.insight] : []).filter((entry) => entry !== undefined && entry !== null);
  if (insightSpecs.length > 2) throw new Error(`${id}: a side column carries at most two insights`);
  // Two statements are a reading, then its consequence: the first set plain in
  // the column and the second in the box under it. Two equal boxes make the
  // column read as two unrelated labels with a gap between them.
  const insightBoxes = insightSpecs.map((entry, at) => {
    const variant = insightSpecs.length > 1 && at === 0 ? "plain" : "tonal";
    const accent = slide.highlight === undefined ? {} : { highlight: slide.highlight };
    return { id: insightSpecs.length > 1 ? `${id}-insight-${at + 1}` : `${id}-insight`, component: "insight",
      props: typeof entry === "string" ? { text: entry, variant, ...accent } : { variant, ...accent, ...entry }, size: HUG };
  });
  const insightBox = insightBoxes[0] ?? null;
  if (!list && !insightBox && !kpiTile && !(slide.paragraphs || []).length) throw new Error(`${id}: a side column needs points, an insight or a kpi`);
  // Authored prose belongs in the column too: `paragraphs` written next to a
  // chart are its commentary, and the content audit reports any the page
  // drops as MISSING_AUTHORED_CONTENT.
  const prose = proseOf(slide, id);
  const sideItems = [kpiTile, ...insightBoxes, ...prose, list].filter(Boolean);
  // "What it means" above three lines of text is a label on a mostly empty
  // column. The heading earns its line when the column holds a list; a column
  // that is one number or one box takes the blank band and keeps the rule.
  // "What it means" earns its line over a column of plain points, where
  // nothing else says what the column is. Over points that carry their own
  // leads it is a label on labelled things: the same three words, naming no
  // measure, no period and no question, over leads that name all three.
  const ledPoints = Boolean(list) && (slide.points || []).every((point) => point && typeof point === "object" && point.lead);
  const heading = slide.pointsHeading === false || (insightBox && !slide.pointsHeading)
    || (!list && !slide.pointsHeading) || (ledPoints && !slide.pointsHeading)
    ? null : slide.pointsHeading || "What it means";
  // The hero's blank heading band exists to line its content up with the
  // column's heading. With no heading beside it the band is an empty rule, so
  // the exhibit starts at the top of the body instead.
  const hero = headedPanel(exhibits[0], heroItem, `${id}-exhibit`, Boolean(heading));
  return { tone, list, kpiTile, insightBoxes, prose, sideItems, heading, hero };
}

/** The side column's width, negotiated with what it holds against the row's height. */
function sideColumnWidth({ slide, fill, heroFr, baseSideFr, list, kpiTile, insightBoxes, heading }) {
  // The column's width is negotiated with its content, not fixed by the
  // layout: forty words in a 361px track leave two fifths of the column
  // empty, and the exhibit beside it wants that width anyway. A short column
  // narrows until it runs SIDE_COLUMN_DEPTH down its track or reaches
  // SIDE_COLUMN_MIN_WIDTH (its text wraps to more lines, and the hero grows);
  // a column that would overrun widens. A single step to 0.8 leaves a
  // three-point column filling three fifths of its track and the rest of it
  // air.
  const sideColumns = heroFr + baseSideFr + (slide.photo ? 1 : 0);
  const sideTrack = (fr) => Math.max(140, (BODY_WIDTH - CONNECTOR_WIDTH - COLUMN_GAP * sideColumns) * (fr / (heroFr + fr + (slide.photo ? 1 : 0))));
  const sideExtras = (kpiTile ? 126 : 0) + insightBoxes.length * 104 + (heading ? 44 : 0);
  // The row's own height: the body less the closing band under it. Measured
  // against the whole body, a column beside an exhibit with a so-what bar
  // reads as deep enough and stops a fifth of the page short of its foot.
  const closingText = typeof slide.soWhat === "string" ? slide.soWhat : slide.soWhat?.text;
  const trackHeight = BODY_HEIGHT - (closingText ? measureInsight({ x: 0, y: 0, width: BODY_WIDTH, height: BODY_HEIGHT }, { text: closingText, variant: "tonal" }).height + COLUMN_GAP : 0);
  const sideFr = (() => {
    if (fill === "airy" || !list) return baseSideFr;
    const depth = (fr) => (sideExtras + listDepth(list, sideTrack(fr), slide.density)) / trackHeight;
    // A photograph strip takes a quarter of the row, which leaves the
    // commentary a 267px gutter that nothing reads comfortably. The column
    // keeps a floor of 300px; the photograph gives up the width.
    if (slide.photo && sideTrack(baseSideFr) < 300) return baseSideFr * 1.25;
    if (depth(baseSideFr) > 0.98) return baseSideFr * 1.2;
    // The width goes to an exhibit that can use it. A chart's plot scales with
    // its frame; a table set wider wraps less and ends higher, trading the
    // column's band for one under the table, so beside a table the column
    // gives up a fifth at most.
    const floor = heroFr === 3 ? baseSideFr * 0.8 : 0;
    let fr = baseSideFr;
    while (depth(fr) < SIDE_COLUMN_DEPTH && fr * 0.95 >= floor - 1e-9 && sideTrack(fr * 0.95) >= SIDE_COLUMN_MIN_WIDTH) fr *= 0.95;
    return fr;
  })();
  return { sideExtras, trackHeight, sideFr };
}

/** The row: the hero, the bridge and the side column in reading order, and a photograph strip at the right. */
function besideRow(items, { id, slide, layout, baseDir, fill, tone, list, insightBoxes, sideItems, heading, hero, sideFr, exhibit }) {
  // A column of statements and nothing else - one box, or a statement above a
  // box - has nothing that can spread down the track.
  const boxesOnly = sideItems.length > 0 && sideItems.every((item) => insightBoxes.includes(item));
  // A column of blocks starts at the top of its track, level with the exhibit;
  // `pointsAlign: "middle"` centres it on the exhibit when the author asks.
  // A list that owns its column - nothing above or below it, no heading -
  // spreads its points to the capped gap and centres what is left, so the
  // slack sits round the block rather than pooled under the last point. Beside
  // a process rail it keeps its top: the rail is a band across the middle of
  // its frame, and its column, mostly air, is the page's finding either way.
  // Centred whole, a short column of statements is a hole above as well as
  // below, and the band gates read by column. A headed column starts under its
  // heading, level with the exhibit's.
  const centre = slide.pointsAlign === "middle";
  // A toned panel is always a section (it needs a surface); it takes the
  // heading unless the author suppresses it with `pointsHeading: false`.
  // A column of several blocks (a number, a box, the points) spreads them down
  // the track rather than stacking them under the heading with the bottom
  // third left over.
  // Spreading blocks down the track works when one of them can absorb the
  // slack (a points list, which spreads its own items). Statements alone have
  // nothing to absorb it, so distributing would pin them to opposite ends of
  // an empty track; they sit together at the top instead.
  if (centre && list) { list.size = HUG; list.props = { ...list.props, distribute: false }; }
  else if (list && !heading && sideItems.length === 1 && sideItems[0] === list && list.props?.distribute && exhibit?.type !== "process") {
    list.props = { ...list.props, centre: true };
  }
  const spread = !centre && fill !== "airy" && sideItems.length > 1 && !boxesOnly ? "distribute" : null;
  const side = tone === "open" && centre && !heading
    ? { id: `${id}-side`, layout: "flow.column", size: { width: { fr: sideFr }, height: "fill" }, leftover: "center", items: sideItems }
    : { id: `${id}-side`, ...(heading ? { heading } : {}), treatment: tone, layout: "flow.column", ...(centre ? { leftover: "center" } : spread ? { leftover: spread } : {}), size: { width: { fr: sideFr }, height: "fill" }, items: sideItems };
  // The relationship is authored; adjacent slides cannot add or remove it.
  const bridge = bridgeVariant(slide, id);
  const chevron = bridge
    ? { id: `${id}-implication`, component: "connector", props: { variant: bridge }, size: { width: 44, height: "fill" } } : null;
  // `photo`: a photograph strip at the right edge, full body height, cropped
  // to fit (a familiar pattern: chart, commentary, photo).
  const photo = photoStrip(slide, `${id}-photo`, baseDir);
  const ordered = layout === "exhibit-left" ? [hero, chevron, side] : [side, chevron, hero];
  items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: [...ordered.filter(Boolean), ...(photo ? [photo] : [])] });
}

// Icon cards with a line each hug their content at the top of the body,
// like the figures, with the points under them; centred, they would carry
// as much air above the row as below it. Header and numbered cards fill the
// page as columns.
export function figureWithPoints(items, { id, slide, layout, exhibits, baseDir, fill, pointsStyle }) {
  const below = layout === "exhibit-full" && slide.points?.length
    ? [pointsItem(slide.points, `${id}-points`, sideTreatment(slide), fill, false, pointsStyle)] : [];
  items.push({ id: `${id}-figure-frame`, layout: "flow.column", size: SIZE, items: [exhibitItem(exhibits[0], `${id}-exhibit`, baseDir, HUG), ...below] });
  return below.length > 0;
}

// The exhibit across the page, with the measures in a column at its left when they stand beside it.
export function fullWidthExhibit(items, { id, slide, exhibits, baseDir, metricsBeside }) {
  const item = exhibitItem(exhibits[0], `${id}-exhibit`, baseDir);
  if (String(exhibits[0].type).startsWith("chart.") && item.props?.unit && !item.props.unitPlacement) item.props.unitPlacement = "inline";
  // The measures in a column at the left, the exhibit the other two thirds.
  if (metricsBeside) items.push({ id: `${id}-row`, layout: "flow.row", gap: "space.6", size: SIZE, items: [
    metricsColumn(slide.metrics, `${id}-metrics`, slide.metricsTone), { ...item, size: { width: { fr: 2 }, height: "fill" } }] });
  else items.push(item);
}

// One table, two panels. The rows split in reading order - the first half
// down the left, the second down the right - so the ranking still reads 1
// to 12 top-left to bottom-right, and both panels repeat the header, which
// is what makes them readable as halves of one table rather than two.
export function tableHalves(items, { id, exhibits, baseDir }) {
  const ex = exhibits[0];
  const rows = ex.rows || [];
  if (rows.length < 2) throw new Error(`${id}: a halved table needs rows to halve`);
  const at = Math.ceil(rows.length / 2);
  // Both panels take the whole table's column widths, not their own half's.
  // Widths derived per half can put a column nine pixels further right on
  // the right-hand panel, and two tables that nearly line up read worse than
  // two that plainly do not.
  const shared = styleTable(ex).columns;
  const half = (part, suffix) => exhibitItem({ ...ex, columns: shared, rows: part, heading: suffix === "a" ? ex.heading : undefined },
    `${id}-exhibit-${suffix}`, baseDir, { width: { fr: 1 }, height: "fill" });
  items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: [half(rows.slice(0, at), "a"), half(rows.slice(at), "b")] });
}

// One figure carries the page: the number set large with its explanation,
// the exhibit beside it as the proof rather than as the subject.
export function heroNumber(items, { id, slide, exhibits, baseDir, fill, pointsStyle }) {
  const kpiProps = { value: slide.kpi.value, label: slide.kpi.label, ...(slide.kpi.sublabel ? { sublabel: slide.kpi.sublabel } : {}),
    ...(slide.kpi.delta ? { delta: slide.kpi.delta } : {}), ...(slide.kpi.better ? { better: slide.kpi.better } : {}), tone: "hero", variant: "prominent" };
  // The column's width is negotiated with what it holds, as a column beside
  // an exhibit is: points that stop short of the foot at a third of the row
  // narrow it, their lines wrap longer, and the exhibit takes the width.
  const track = (fr) => (BODY_WIDTH - COLUMN_GAP) * (fr / (2 + fr));
  // The points hug: a column over its height is then the column's to report,
  // by how many lines, rather than a list's to fail on.
  const list = slide.points?.length ? pointsItem(slide.points, `${id}-points`, sideTreatment(slide), fill, false, pointsStyle) : null;
  const depth = (fr) => (metricHeight(track(fr), kpiProps) + COLUMN_GAP + listDepth(list, track(fr), slide.density)) / BODY_HEIGHT;
  let sideFr = 1;
  if (list && fill !== "airy") while (depth(sideFr) < SIDE_COLUMN_DEPTH && track(sideFr * 0.95) >= SIDE_COLUMN_MIN_WIDTH) sideFr *= 0.95;
  // The number is as tall as it is drawn and its points start under it. A
  // fixed 150px box would leave 70px of air between the figure and the first
  // thing said about it; the points' own spread carries the rest of the track.
  const kpi = { id: `${id}-kpi`, component: "metric", props: kpiProps,
    size: { width: { fr: 1 }, height: list ? Math.ceil(metricHeight(track(sideFr), kpiProps)) : "fill" } };
  const hero = exhibitItem(exhibits[0], `${id}-exhibit`, baseDir, { width: { fr: 2 }, height: "fill" });
  // The number and its points start at the top of the column, level with
  // the exhibit; centred, the column would carry air above the number as
  // tall as the band under its last point.
  items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: [
    { id: `${id}-side`, layout: "flow.column", size: { width: { fr: sideFr }, height: "fill" }, items: list ? [kpi, list] : [kpi] },
    headedPanel(exhibits[0], hero, `${id}-exhibit`, false),
  ] });
}

// A comparison with two genuine sides: each exhibit on its own ground, the
// left tinted so the page reads as two halves rather than as evidence and
// commentary.
export function splitTone(items, { id, exhibits, baseDir }) {
  const half = (ex, at) => {
    const panel = exhibitItem(ex, `${id}-exhibit-${at}`, baseDir, { width: { fr: 1 }, height: "fill" });
    return { id: `${id}-half-${at}`, layout: "flow.column", size: { width: { fr: 1 }, height: "fill" },
      ...(at === 0 ? { treatment: "muted" } : {}),
      items: [headedPanel(ex, panel, `${id}-exhibit-${at}`, true)] };
  };
  items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: exhibits.slice(0, 2).map(half) });
}

// Exhibits stacked in the hero column, points beside them.
// A value table under a chart hugs its rows and carries no heading band.
export function exhibitStack(items, { id, slide, exhibits, baseDir, fill, pointsStyle }) {
  const stackItem = (ex, i) => {
    const hug = Boolean(slide.stackWeights) && ex.type === "table";
    const item = { ...exhibitItem(ex, `${id}-exhibit-${i}`, baseDir, hug ? HUG : SIZE), size: hug ? HUG : SIZE };
    return hug ? item : headedPanel(ex, item, `${id}-exhibit-${i}`);
  };
  const stacked = { id: `${id}-stack`, layout: "flow.column", size: { width: { fr: 2 }, height: "fill" }, items: exhibits.map(stackItem) };
  if (hasCommentary(slide)) {
    const sideItems = [];
    if (slide.kpi) sideItems.push({ id: `${id}-kpi`, component: "metric", props: { ...slide.kpi, tone: "hero", variant: "prominent" }, size: { width: { fr: 1 }, height: 110 } });
    const insights = slide.insights || (slide.insight ? [slide.insight] : []);
    for (const [at, insight] of insights.entries()) sideItems.push({ id: `${id}-insight-${at}`, component: "insight", props: { variant: insights.length > 1 && at === 0 ? "plain" : "tonal", ...(slide.highlight === undefined ? {} : { highlight: slide.highlight }), ...(typeof insight === "string" ? { text: insight } : insight) }, size: HUG });
    if (slide.points?.length) sideItems.push(pointsItem(slide.points, `${id}-points`, sideTreatment(slide), fill, true, pointsStyle));
    // A column: the number over its points. With no layout the section sets
    // them side by side, and the number's half stands empty under it.
    const side = { id: `${id}-side`, ...(slide.pointsHeading === false ? {} : { heading: slide.pointsHeading || "What it means" }), treatment: sideTreatment(slide), layout: "flow.column", size: { width: { fr: slide.kpi || insights.length ? 1.5 : 1 }, height: "fill" }, items: sideItems };
    items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: [stacked, side] });
  } else items.push({ ...stacked, size: SIZE });
}

// Two rows of two small exhibits, every panel headed.
export function exhibitGrid(items, { id, slide, exhibits, baseDir, fill, pointsStyle }) {
  const panels = exhibits.slice(0, 4).map((ex, i) => headedPanel(ex, { ...exhibitItem(ex, `${id}-exhibit-${i}`, baseDir), size: SIZE }, `${id}-exhibit-${i}`));
  items.push({ id: `${id}-grid`, layout: "flow.column", size: SIZE, items: [{ id: `${id}-row-a`, layout: "flow.row", size: SIZE, items: panels.slice(0, 2) }, { id: `${id}-row-b`, layout: "flow.row", size: SIZE, items: panels.slice(2, 4) }] });
  if (slide.points?.length) items.push(pointsItem(slide.points, `${id}-points`, sideTreatment(slide), fill, false, pointsStyle));
}
