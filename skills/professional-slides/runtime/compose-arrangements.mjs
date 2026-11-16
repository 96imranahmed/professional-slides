// The arrangements a page's evidence is laid out in, each one function from
// the page (its slide, layout and exhibits) to the layout-tree regions it
// pushes onto the page's items: peer exhibits in a row (`peerExhibitsRow`), an
// exhibit over its commentary (`exhibitOverCommentary`, with the staircase
// variant `commentaryOverSteps`), labelled rows of blocks (`labelledRows`), the
// points set under a row of panels, a figure with its points and a table in
// halves. The arrangements that are grids - an exhibit beside its commentary,
// a hero number, a split-tone pair, a stack, a grid of exhibits, a picture
// beside its argument - are written as templates (`builtInGrid`) and set by
// the one composer an author's own `grid` takes (`templatePage`).
import { defaultHighlightStyle } from "./core.mjs";
import { isSlot, resolveTemplate } from "./layout-templates.mjs";
import { measureCaption, proseMeasure } from "./registry-text.mjs";
import { chartAnnotationBands, evidenceBandSpan } from "./chart-annotations.mjs";
import { plotHeadroom, topBand, horizontalChart, oneMagnitude } from "./chart-axes.mjs";
import { FLAT_SHARE } from "./chart-sense.mjs";
import { legendRowCount } from "./legends.mjs";
import { stepsLayout } from "./extras.mjs";
import { detailedStages, stagesLayout } from "./schedule-stages.mjs";
import { renderTable, withoutInferredBars } from "./tables.mjs";
import { SIZE, HUG, BODY_WIDTH, COLUMN_GAP, CONNECTOR_WIDTH, LINK_GUTTER, BODY_HEIGHT } from "./compose-body.mjs";
import { heavyTable, styleTable } from "./compose-tables.mjs";
import { sharedBound } from "./compose-charts.mjs";
import { exhibitItem, headedPanel } from "./compose-exhibits.mjs";
import { paragraph, pointColumns, pointsItem, pointWays, sideTreatment, listDepth, proseOf, bridgeVariant, pointBullets, soWhatItem } from "./compose-points.mjs";
import { pictureFrame, photoStrip } from "./compose-pictures.mjs";
import { metricsColumn, metricsStrip } from "./compose-metrics.mjs";
import { hasCommentary, needsFullWidth } from "./compose-layouts.mjs";
import { fitsQuarter } from "./compose-text-pages.mjs";
import { REGISTRY } from "./registry.mjs";

/** A link's end by the exhibit's place on the page: `1`, or `{ exhibit: 1, ... }` as the compile writes it. */
const placeOf = (end) => (typeof end === "number" ? end : end?.exhibit ?? 0);

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
  // A breakout's detail is the overview's mark enlarged: on its own scale its
  // split fills the panel and the fan opens to it, where on the overview's
  // scale it stood the mark's height and the lines ran flat.
  if (layout !== "breakout") {
    shareValueScales(charts);
    shareBarDomain(charts, { id, slide });
  }
  sharePlotFrame(charts);
  // Chart beside a narrow table (three columns or fewer): the chart takes 3:2.
  const panelSize = (ex, index) => {
    if (slide.pairedWeights) return { width: { fr: slide.pairedWeights[index] }, height: "fill" };
    // The overview reads across its members; the detail is one mark split, a narrow panel.
    if (layout === "breakout") return { width: { fr: index === placeOf(slide.breakout?.to ?? 1) ? 1 : 2 }, height: "fill" };
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
    : layout === "breakout" || slide.spread
    // A breakout's fan and a spread's bracket cross the gutter: the panel after
    // the first is set in from it, so the lines have the room to read as lines.
    ? panels.map((panel, i) => (i ? { id: `${id}-set-in-${i}`, layout: "flow.column", padding: { left: LINK_GUTTER }, size: panel.size, items: [{ ...panel, size: SIZE }] } : panel))
    : panels;
  const exhibitId = (end) => `${id}-exhibit-${placeOf(end)}`;
  const links = [
    ...(slide.breakout ? [{ kind: "breakout", from: { ...slide.breakout.from, exhibit: exhibitId(slide.breakout.from ?? 0) }, to: { exhibit: exhibitId(slide.breakout.to ?? 1) } }] : []),
    ...(slide.spread ? [{ kind: "spread", label: slide.spread.label, from: { ...slide.spread.from, exhibit: exhibitId(slide.spread.from) }, to: { ...slide.spread.to, exhibit: exhibitId(slide.spread.to) } }] : []),
  ];
  const rowItem = { id: `${id}-row`, layout: "flow.row", size: SIZE, items: row };
  // The lines are drawn over the row once its charts are drawn (exhibit-links.mjs).
  items.push(links.length
    ? { id: `${id}-linked`, layout: "overlay", size: SIZE, items: [rowItem, ...links.map((props, k) => ({ id: `${id}-link-${k}`, component: "exhibit-link", props, size: SIZE }))] }
    : rowItem);
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
// It is shared only between panels whose values run the same way. A bar's
// length across and a line's height up are not read against each other, so a
// shared scale buys no comparison, and it costs the bars their width: the BA
// retest's margin ranking (2.5% to 15.8%) took the -60 floor of the line
// beside it, a 2020 Covid loss, and drew its ten bars in the last quarter of
// their panel.
// And only between panels of one magnitude (chart-axes.mjs oneMagnitude).
// Stacks extend separately above and below zero: netting signed
// segments or forcing zero as the minimum truncates real evidence.
const extent = ex => ["chart.stacked-column", "chart.stacked-bar"].includes(ex.type)
  ? (ex.categories || []).flatMap((_, i) => [
    ex.series.reduce((sum, se) => sum + Math.min(0, se.values[i] || 0), 0),
    ex.series.reduce((sum, se) => sum + Math.max(0, se.values[i] || 0), 0),
  ])
  : ex.series.flatMap(se => se.values);
function shareValueScales(charts) {
  const byUnit = new Map();
  for (const ex of charts) { const key = `${ex.unit}|${horizontalChart(ex.type) ? "across" : "up"}`; byUnit.set(key, [...(byUnit.get(key) || []), ex]); }
  for (const group of byUnit.values()) {
    if (group.length < 2 || group.some((ex) => ex.yMax !== undefined) || !oneMagnitude(group.map(extent))) continue;
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
    // Whether any peer moves on the shared scale: a flat panel beside one that does is read against it (chart-sense.mjs).
    const moves = group.some((ex) => ex.series.some((se) => { const v = se.values.filter(Number.isFinite); return v.length > 1 && (Math.max(...v) - Math.min(...v)) / (sharedMax - sharedMin) >= FLAT_SHARE; }));
    for (const ex of group) { ex.yMin = ex.yMin ?? sharedMin; ex.yMax = sharedMax; ex.peerScale = { moves }; }
  }
}

// Equal numerical limits alone do not make equal bar lengths: different
// category gutters and Office auto-layout change the pixels per unit.
// Compare horizontal peers in the shared editable scene coordinate system.
function shareBarDomain(charts, { id, slide }) {
  const horizontalPeers = charts.filter(ex => horizontalChart(ex.type));
  if (horizontalPeers.length >= 2 && !slide.pairedWeights && horizontalPeers.every(ex => ex.unit === horizontalPeers[0].unit) && oneMagnitude(horizontalPeers.map(extent))) {
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
  const column = (list, at, size) => ({ id: `${id}-points-${at}`, layout: "flow.column", size, items: [pointsItem(list, `${id}-points-${at}-list`, tone, fill, pointsStyle)] });
  // One point is a paragraph, at the capped measure paragraphs keep, its lead
  // running into the sentence in bold and its phrase in the accent.
  if (points.length === 1 && !pointBullets(points[0])) {
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
  const list = pointsItem(slide.points, `${id}-points`, "open", fill, pointsStyle);
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

// `halves`: the exhibit is a table set in halves (`split: "halves"`), and its points run in columns under the two panels
// as they do under one: set as one list across the page, they ran past the measure a line is read at.
// A point's bullets under it, dashed as they are beside an exhibit; a `{ lead, text }` bullet runs its bold lead in after a colon.
const dashed = (list) => ({ ...list, props: { ...list.props, marker: "dash", inlineLead: true, leadStop: ":", leadAccent: false } });
/**
 * A dated timeline over commentary runs across the page.
 *
 * Left to its frame, a timeline whose columns would not fill most of the body's height takes rows down the page: under a
 * band of points that set its dates and sentences in the left half and left the right half empty, with the points pressed
 * under its last row (the A350F deck's window and orderbook pages). Over commentary the page is a band of stages and a band
 * of points, so the stages take the columns wherever each keeps a readable measure; an author's `orientation` stands, and a
 * schedule too long for the columns keeps its rows. The columns take the height the points leave and sit in its middle
 * (`centre`), so the points close the page at its foot rather than under a strip of air.
 */
const ACROSS_COLUMN_MIN = 150;
export function acrossOverCommentary(ex) {
  if (ex?.type !== "timeline" || ex.orientation !== undefined || (ex.variant && ex.variant !== "process")) return ex;
  if (!detailedStages(ex.items) || BODY_WIDTH / ex.items.length < ACROSS_COLUMN_MIN) return ex;
  try { stagesLayout({ x: 0, y: 0, width: BODY_WIDTH, height: undefined }, { ...ex, orientation: "across" }); }
  catch { return ex; }
  const stagger = !ex.eras && ex.items.length >= 3;
  return { ...ex, orientation: "across", ...(stagger ? { stagger: true, centre: true } : {}) };
}
export function exhibitOverCommentary(items, { id, slide, exhibits, baseDir, fill, pointsStyle, halves = false }) {
  const stair = slide.pageType && !halves ? commentaryOverSteps({ id, slide, exhibits, baseDir, fill, pointsStyle }) : null;
  if (stair) { items.push(stair); return; }
  // The exhibit across the full width, its commentary in columns beneath it.
  // A wide exhibit - ten categories, a twelve-row table - has no width to
  // give a side column, and three findings read better as three columns than
  // as three stacked paragraphs in a 360px gutter.
  const item = halves ? null : exhibitItem(acrossOverCommentary(exhibits[0]), `${id}-exhibit`, baseDir, { width: { fr: 1 }, height: "fill" });
  if (String(exhibits[0].type).startsWith("chart.") && item?.props?.unit && !item.props.unitPlacement) item.props.unitPlacement = "inline";
  // A point's lead becomes the column's heading only when its sentence can
  // stand without it. Points are often written to run on from the lead ("Core
  // regionals carry the most activity" + "with 54 use cases in ideation"),
  // and hoisting the lead into a heading leaves the column starting mid
  // sentence - so those join back into one paragraph instead.
  const standsAlone = (text) => /^[A-Z0-9"“(]/.test(String(text).trim());
  // A lone implication takes the exhibit's track, its heading at the body's
  // left margin; its sentence keeps the reading measure every paragraph keeps
  // (text-roles.mjs) and the rest of the track is air at its right.
  // Prose written in place of points (`paragraphs`) is set the same way: a column a paragraph.
  const written = slide.points ?? slide.paragraphs ?? [];
  // One style for the row: decided point by point, a sentence that begins in
  // lower case ("flydubai is ...") would run its lead inline while its
  // neighbour's lead stood as a heading, and one band would read as two
  // devices.
  const entries = written.map((point) => (typeof point === "string" ? { text: point } : point));
  // A lead over bullets always stands as its column's heading: the bullets are its parts, not a sentence it runs into.
  // `pointsStyle: "inline"` keeps each lead in its sentence, bold and before a colon, as the style says.
  const inline = pointsStyle === "inline", boxed = pointsStyle === "boxed";
  const hoistAll = !inline && entries.every((entry) => entry.lead && (pointBullets(entry) || standsAlone(entry.text)));
  const columns = entries.map((entry, at) => {
    const hoist = hoistAll;
    const runIn = inline && entry.lead ? (/[.:;!?\u2013\u2014-]$/.test(entry.lead) ? entry.lead : `${entry.lead}:`) : entry.lead;
    const text = hoist ? entry.text : [runIn, entry.text].filter(Boolean).join(" ");
    // A lead that stays in the sentence still leads it: it runs in bold, the
    // way a well-made page sets the phrase that carries the finding.
    // The page's highlight is set in the accent too.
    const lead = !hoist && entry.lead ? { lead: runIn } : {};
    // `rule: false`: the block above already carries one under "What it
    // means". A hairline under each of three sub-headings as well turns one
    // divided idea into four ruled boxes, and the reader reads the rules
    // before the words.
    // One implication under a full-width exhibit takes the exhibit's track:
    // hugging its own measure and centring, it would float in the middle of
    // the support region, related to the table above it by nothing. In the
    // track its first word sits under the exhibit's left edge.
    // `boxed`: each point in a tinted panel, its lead the panel's heading - the third way the band under an exhibit is
    // set, beside a lead over its sentence and a lead run in before a colon (compose-points.mjs resolvePointsStyle).
    return { id: `${id}-col-${at}`, layout: "flow.column", size: { width: { fr: 1 }, height: boxed ? HUG : "fill" },
      ...(boxed ? { treatment: "tint" } : {}),
      ...(hoist ? { heading: entry.lead, headingRule: false } : {}),
      items: [...(text ? [paragraph(`${id}-col-${at}-text`, text, entry.highlight, lead)] : []),
        // Dashed, as a point's bullets are beside an exhibit: the same device on every page, whatever the house's list marker.
        ...(pointBullets(entry) ? [dashed(pointsItem(pointBullets(entry), `${id}-col-${at}-list`, "open", fill, "bulleted"))] : [])] };
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
    halves ? halvesRow(id, exhibits[0], baseDir) : headedPanel(exhibits[0], item, `${id}-exhibit`, false),
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
    const label = { id: `${id}-label-${at}`, component: "side-statement", props: { text: String(block.label).trim(), tone: "primary", ...(block.icon ? { icon: block.icon } : {}) },
      size: { width: BLOCK_LABEL_WIDTH, height: "fill" } };
    const text = { id: `${id}-text-${at}`, layout: "flow.column", leftover: "center", size: { width: { fr: 1 }, height: "fill" },
      items: [pointsItem(block.points, `${id}-points-${at}`, "open", fill, null)] };
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

// Icon cards with a line each hug their content at the top of the body,
// like the figures, with the points under them; centred, they would carry
// as much air above the row as below it. Header and numbered cards fill the
// page as columns.
export function figureWithPoints(items, { id, slide, layout, exhibits, baseDir, fill, pointsStyle }) {
  const below = layout === "exhibit-full" && slide.points?.length
    ? [pointsItem(slide.points, `${id}-points`, sideTreatment(slide), fill, pointsStyle)] : [];
  items.push({ id: `${id}-figure-frame`, layout: "flow.column", size: SIZE, items: [exhibitItem(exhibits[0], `${id}-exhibit`, baseDir, HUG), ...below] });
  return below.length > 0;
}


// One table, two panels. The rows split in reading order - the first half
// down the left, the second down the right - so the ranking still reads 1
// to 12 top-left to bottom-right, and both panels repeat the header, which
// is what makes them readable as halves of one table rather than two.
export function tableHalves(items, { id, exhibits, baseDir }) {
  items.push(halvesRow(id, exhibits[0], baseDir));
}

/** The two panels of a halved table, side by side in one row. */
function halvesRow(id, ex, baseDir) {
  const rows = ex.rows || [];
  if (rows.length < 2) throw new Error(`${id}: a halved table needs rows to halve`);
  const at = Math.ceil(rows.length / 2);
  // Both panels take the whole table's column widths, not their own half's.
  // Widths derived per half can put a column nine pixels further right on
  // the right-hand panel, and two tables that nearly line up read worse than
  // two that plainly do not.
  const styled = styleTable(ex), shared = styled.columns;
  // A column of bars - the author's (`bar: true` on a table asked to halve) or the one the composer draws on a measure with
  // a unit - is drawn to one scale across both panels: the halves take the whole table's bar cells and its scale, as a
  // table cut across pages does (compose-deck.mjs paginateTable). Set over the raw rows, each half met a bar column with
  // no scale, and a ranking of twenty stations with its journeys in millions did not compose.
  const barred = shared.some((column) => column?.type === "bars");
  const body = barred ? styled.rows : rows;
  const half = (part, suffix) => exhibitItem({ ...ex, columns: shared, rows: part, heading: suffix === "a" ? ex.heading : undefined, ...(barred ? { scales: styled.scales } : {}) },
    `${id}-exhibit-${suffix}`, baseDir, { width: { fr: 1 }, height: "fill" });
  return { id: `${id}-row`, layout: "flow.row", size: SIZE, items: [half(body.slice(0, at), "a"), half(body.slice(at), "b")] };
}

/**
 * The built-in arrangements, as the grids they are (layout-templates.mjs): an author's `grid` and the runtime's own
 * layouts are the same thing, read by the same composer. Each takes whichever of its slots the page carries.
 *
 * - `exhibit-left`, `exhibit-right`: the exhibit beside its commentary - the number, the statements, the prose and the
 *   points in one headed column. A chart takes 2 to the column's 1, a table 3 to 2, a pair of values half the row, as
 *   strong decks set them (chart-sense.mjs comparesTooLittle); the marker between them and a photograph strip at the
 *   right take tracks of their own where the page asks for them.
 * - `hero-number`: one figure carries the page, set large over its explanation, the exhibit beside it as the proof.
 * - `grid`: two rows of two headed exhibits, the points in a band under them.
 * - `split-tone`: two exhibits side by side, the left on a tinted ground, so the page reads as two halves.
 * - `stack`: the exhibits stacked in the hero column, the commentary beside them; a value table under a chart hugs its
 *   rows and carries no heading band.
 */
export function builtInGrid(layout, slide, exhibits, id) {
  const commentary = { content: ["kpi", "insight", "paragraphs", "points"], optional: true };
  if (layout === "exhibit-left" || layout === "exhibit-right") {
    const first = exhibits[0], pair = String(first.type).startsWith("chart.") && Array.isArray(first.categories) && first.categories.length <= 2 && Array.isArray(first.series) && first.series.length === 1;
    const hero = ["table", "rows", "compare"].includes(first.type) ? 3 : pair ? 1 : 2;
    const bridge = bridgeVariant(slide, id) ? ["implication"] : [];
    const row = layout === "exhibit-left" ? ["exhibit", ...bridge, "side"] : ["side", ...bridge, "exhibit"];
    // The side column's share is offered at the house share, half again wider and a quarter narrower: commentary that
    // breaks badly in the house column takes the wider one, and an exhibit whose steps need the width takes the narrower
    // (layout-templates.mjs, alternatives). A pair of values already has half.
    const sides = hero === 3 ? [2, 3, 1.5] : hero === 2 ? [1, 1.5, 0.75] : [1];
    const areas = [...row, ...(slide.photo ? ["photo"] : [])];
    const tracks = (side) => areas.map((name) => ({ exhibit: `${hero}fr`, side: `${side}fr`, implication: `${CONNECTOR_WIDTH}px`, photo: "1fr" })[name]).join(" ");
    // A reading note sits over the side column, in a row of its own that the exhibit and the rest span.
    const lines = slide.callout ? [areas.map((name) => (name === "side" ? "callout" : name)).join(" "), areas.join(" ")] : [areas.join(" ")];
    return resolveTemplate({ columns: sides.map(tracks), ...(slide.callout ? { rows: "auto 1fr" } : {}), areas: lines,
      place: { side: { ...commentary, heading: "commentary", ...(slide.pointsAlign === "middle" ? { align: "center" } : {}) } } }, null, id, { name: "row" });
  }
  // `arranged`: the exhibit and its commentary are two blocks the engine sets beside each other or one over the other,
  // whichever reads better at what they measure (tasteful-layout); the points are blocks of their own, so under a wide
  // exhibit they run across and beside it they stack.
  if (layout === "arranged") return resolveTemplate({ areas: ["exhibit side"], place: { side: { ...commentary, heading: "commentary" } } }, null, id, { name: "row", arrange: true });
  // The figure's column is a third of the page by preference; a statement under it that a third breaks badly takes
  // two fifths or a half.
  if (layout === "hero-number") return resolveTemplate({ columns: ["1fr 2fr", "2fr 3fr", "1fr 1fr"], areas: ["side exhibit"], place: { side: { content: ["kpi", "points"], optional: true }, exhibit: { content: "exhibit", unit: false } } }, null, id, { name: "row" });
  if (layout === "split-tone") return resolveTemplate({ areas: ["left right"], place: { left: { content: "exhibit", tone: "muted" }, right: "exhibit-2" } }, null, id, { name: "row" });
  // The measures in a column at the left, the exhibit the other two thirds.
  if (layout === "metrics-beside") return resolveTemplate({ columns: ["1fr 2fr", "2fr 3fr"], gap: "space.6", areas: ["metrics exhibit"], place: { metrics: { content: "metrics", metrics: "column" }, exhibit: { content: "exhibit", panel: false } } }, null, id, { name: "row" });
  // One subject, the argument beside it: the copy takes the left column (a toned panel when `pointsTone` says so), the picture the right, both full height.
  if (layout === "picture-hero") return resolveTemplate({ columns: ["1.2fr 1fr", "1.5fr 1fr", "1fr 1fr"], areas: ["side picture"],
    place: { side: { ...commentary, ...(slide.pointsHeading ? { heading: slide.pointsHeading } : {}), ...(slide.pointsAlign === "middle" ? { align: "center" } : {}) },
      picture: { content: slide.pictures?.length ? "picture" : "photo", gap: "space.3" } } }, null, id, { name: "row" });
  if (layout === "stack") {
    const beside = hasCommentary(slide);
    return resolveTemplate({ columns: beside ? `2fr ${slide.kpi || slide.insight || slide.insights?.length ? 1.5 : 1}fr` : "1fr", areas: [beside ? "stack side" : "stack"],
      place: { stack: { content: exhibits.map((_, at) => (at ? `exhibit-${at + 1}` : "exhibit")), ...(slide.stackWeights ? { tables: "hug" } : {}) }, ...(beside ? { side: { content: ["kpi", "insight", "points"], optional: true, heading: true } } : {}) } }, null, id, { name: "row" });
  }
  if (layout === "grid") {
    // Three panels: the third takes the second row whole.
    const cells = ["exhibit", "exhibit-2", "exhibit-3", exhibits.length > 3 ? "exhibit-4" : "exhibit-3"];
    // Panels of one exhibit are peers, a minor gap apart: the major gap is between a page's different parts.
    return resolveTemplate({ gap: "space.minor", rows: slide.points?.length ? "1fr 1fr auto" : "1fr 1fr", areas: [cells.slice(0, 2).join(" "), cells.slice(2).join(" "), ...(slide.points?.length ? ["points points"] : [])] }, null, id, { name: "grid" });
  }
  return null;
}

/**
 * A page set on a grid (`grid`, layout-templates.mjs): each area takes the content its template gives it, drawn by the
 * same builders whatever the arrangement, and the layout engine resolves the tracks. An area of several slots stacks
 * them; one with a name, a heading, a ground or an alignment of its own is a section. Content the page carries and
 * its own grid gives no area is refused by name: a grid never drops what the page wrote.
 */
export function templatePage(items, { id, slide, exhibits, baseDir, fill, pointsStyle, pictures = [] }) {
  const { name: gridName, columns, rows, gap, areas } = slide.grid;
  const insights = (Array.isArray(slide.insights) ? slide.insights : slide.insight !== undefined ? [slide.insight] : []).filter((entry) => entry != null);
  if (insights.length > 2) throw new Error(`${id}: a column carries at most two insights`);
  const carries = { exhibit: exhibits.length > 0, points: Boolean(slide.points?.length), paragraphs: Boolean(slide.paragraphs?.length), kpi: Boolean(slide.kpi), insight: insights.length > 0,
    metrics: Boolean(slide.metrics?.length), callout: Boolean(slide.callout), takeaway: Boolean(slide.soWhat), photo: Boolean(slide.photo), picture: pictures.length > 0, implication: Boolean(bridgeVariant(slide, id)) };
  exhibits.slice(1).forEach((_, at) => { carries[`exhibit-${at + 2}`] = true; });
  const placed = new Set(areas.flatMap((area) => area.content));
  // The furniture the page sets itself where no area takes it (a strip of figures over the grid, the close under it) needs no area.
  const unplaced = gridName === "template" ? Object.keys(carries).filter((slot) => carries[slot] && !placed.has(slot) && !["metrics", "callout", "takeaway", "implication"].includes(slot)) : [];
  if (unplaced.length) throw new Error(`${id}: the page carries ${unplaced.map((slot) => `\`${slot}\``).join(", ")} and its grid gives ${unplaced.length === 1 ? "it" : "them"} no area (the areas are ${areas.map((area) => area.name).join(", ")}) - name an area for each, or stack it in one with \`place\``);
  // "What it means" earns its line over a column of plain points, where nothing else says what the column is. Over
  // points that carry their own leads it is a label on labelled things, and a column that is one number or one box
  // takes no heading at all, unless the page names one (`pointsHeading`).
  const led = carries.points && slide.points.every((point) => point && typeof point === "object" && point.lead);
  const headingOf = (area) => (area.heading === "commentary" ? (slide.pointsHeading === false || ((carries.insight || !carries.points || led) && !slide.pointsHeading) ? null : slide.pointsHeading || "What it means")
    : area.heading === true ? (slide.pointsHeading === false ? null : slide.pointsHeading || "What it means") : area.heading || null);
  // An exhibit's blank heading band exists to line its content up with a heading beside it; with none, it starts at the top of the body.
  const headed = areas.some((area) => headingOf(area));
  // A panel wraps what it holds. An area on a ground of its own whose content has a height of its own - a number, a
  // statement, points - is as tall as that content and no taller, set in the middle of a cell it has to itself: a
  // tinted box stretched down a column around three points is mostly empty box.
  const takesFrame = (name) => name.startsWith("exhibit") || ["photo", "picture", "implication"].includes(name);
  for (const area of areas) if (area.tone && area.tone !== "open" && gridName === "template" && !area.content.some(takesFrame)) Object.assign(area, { hug: true, wraps: true });
  const slot = (name, area) => {
    if (!carries[name]) { if (area.optional) return []; throw new Error(`${id}: area "${area.name}" places \`${name}\`, and the page has none`); }
    if (name.startsWith("exhibit")) {
      const at = name === "exhibit" ? 0 : Number(name.slice(8)) - 1, eid = exhibits.length > 1 || gridName !== "row" && gridName !== "template" ? `${id}-exhibit-${at}` : `${id}-exhibit`;
      // `tables: "hug"`: a table in the area is as tall as its rows and carries no heading band (a value table under its chart).
      const bare = area.tables === "hug" && exhibits[at].type === "table";
      const item = exhibitItem(exhibits[at], eid, baseDir, area.hug || bare ? HUG : SIZE);
      if (bare) return [{ ...item, size: HUG }];
      // What the exhibit reads at, for an arrangement the engine chooses: one that needs the page's width says so.
      const hints = { minWidth: needsFullWidth(exhibits[at]) ? 900 : 420 };
      if (slide.grid.arrange) return [{ ...headedPanel(exhibits[at], item, eid, false), hints }];
      // A chart beside a text column keeps a one-line heading with the unit inline; the two-line heading is for peers in a row, where the bands align.
      if (exhibits.length === 1 && area.unit !== false && String(exhibits[at].type).startsWith("chart.") && item.props?.unit && !item.props.unitPlacement) item.props.unitPlacement = "inline";
      return [area.panel === false ? item : headedPanel(exhibits[at], item, eid, exhibits.length > 1 || headed)];
    }
    // An area the engine arranges takes its points every way they can be set (compose-points.mjs pointWays), and the engine chooses; elsewhere they are a list.
    if (name === "points") { const ways = pointWays(slide.points, { id: `${id}-points`, tone: area.tone ?? sideTreatment(slide), fill, style: pointsStyle, highlight: slide.highlight }, REGISTRY);
      if (slide.grid.arrange) return [ways.length > 1 ? { id: `${id}-points`, kind: "points", options: ways } : ways[0]];
      // In a column the points are blocks of the column itself, so its free height opens between them (`leftover: "spread"`) rather than around one list.
      const blocks = ways.find((way) => way.label === "blocks");
      return blocks && !["lettered"].includes(pointsStyle) ? blocks.items : [ways[0]]; }
    // Several paragraphs are one group, arranged by the engine: side by side where the area is wide enough for each to be read, stacked where it is not.
    if (name === "paragraphs") { const prose = proseOf(slide, id); return prose.length > 1 ? [{ id: `${id}-prose`, layout: "flow.best", size: HUG, items: prose }] : prose; }
    if (name === "kpi") {
      // One figure can be set several ways, and none is right everywhere: the engine weighs them where the figure lands
      // (tasteful-layout: balance, uniformity, simplicity) and a judge sees them side by side. Each sets the figure at
      // the largest display size its room allows (panels.mjs figureSize).
      const { value, label, sublabel, ...rest } = slide.kpi, says = sublabel || label;
      const figure = { ...rest, value, tone: "hero", variant: "display" };
      // The figure over what it measures: the plainest, and the largest figure.
      const stacked = { id: `${id}-kpi`, component: "metric", props: { ...slide.kpi, tone: "hero", variant: "display", ...(area.justify === "center" ? { align: "center" } : {}) }, size: HUG };
      if (!says || area.justify === "center") return [stacked];
      // The figure with its explanation beside it, level with its middle - open, or on a ground of its own (a box, which
      // counts as a part of the page: `chrome`).
      const row = (extra) => ({ id: `${id}-kpi`, layout: "grid", gridColumns: [{ fr: 2 }, { fr: 3 }], gridRows: ["hug"], size: HUG, ...extra, items: [
        { id: `${id}-kpi-figure`, component: "metric", props: figure, size: { width: { fr: 1 }, height: "hug" }, cell: { column: 0, row: 0 }, alignSelf: "center" },
        { ...paragraph(`${id}-kpi-says`, says, slide.highlight, sublabel && label ? { heading: label } : {}), cell: { column: 1, row: 0 }, alignSelf: "center" }] });
      return [{ id: `${id}-kpi`, kind: "figure", options: [{ label: "stacked", ...stacked }, { label: "stacked-smaller", family: "stacked", ...stacked, props: { ...stacked.props, ceiling: "type.figureLarge" } }, { label: "beside", ...row({}) }, { label: "boxed", family: "beside", ...row({ treatment: "tint", hints: { chrome: 1 } }) }] }];
    }
    if (name === "insight") return insights.map((entry, at) => ({ id: insights.length > 1 ? `${id}-insight-${at + 1}` : `${id}-insight`, component: "insight",
      props: { variant: insights.length > 1 && at === 0 ? "plain" : "tonal", ...(slide.highlight === undefined ? {} : { highlight: slide.highlight }), ...(typeof entry === "string" ? { text: entry } : entry) }, size: HUG }));
    if (name === "metrics") return [(area.metrics === "column" ? metricsColumn : metricsStrip)(slide.metrics, `${id}-metrics`, slide.metricsTone)];
    // The picture's own line sits under it as a statement box, the way a captioned panel does: naming the subject is the picture's job, not the argument's.
    if (name === "picture") return [pictureFrame(pictures[0], `${id}-picture`, baseDir, SIZE), ...(pictures[0].label || pictures[0].text
      ? [{ id: `${id}-picture-caption`, component: "insight", props: { text: [pictures[0].label, pictures[0].text].filter(Boolean).join(" — "), variant: "neutral", align: "center" }, size: HUG }] : [])];
    if (name === "callout") return [{ id: `${id}-callout`, component: "callout", props: typeof slide.callout === "string" ? { text: slide.callout } : slide.callout, size: HUG }];
    if (name === "takeaway") return [soWhatItem(slide.soWhat, `${id}-sowhat`, slide.highlight, !slide.callout)];
    if (name === "photo") return [{ ...photoStrip(slide, `${id}-photo`, baseDir, 1), size: SIZE }];
    if (name === "implication") return [{ id: `${id}-implication`, component: "connector", props: { variant: bridgeVariant(slide, id) }, size: SIZE }];
    throw new Error(`${id}: area "${area.name}" places \`${name}\`, which this page cannot draw`);
  };
  const cells = areas.map((area) => {
    const content = area.content.flatMap((name) => slot(name, area));
    if (!content.length) throw new Error(`${id}: a ${area.name} column needs points, an insight or a kpi`);
    const heading = headingOf(area), size = area.hug ? HUG : SIZE;
    const tone = area.tone ?? (area.content.includes("points") ? sideTreatment(slide) : null);
    // An area named for the one block it holds, with nothing of its own around it, is that block in its cell.
    if (content.length === 1 && isSlot(area.name) && !heading && !area.tone && !area.leftover) return { ...content[0], size: area.metrics === "column" ? content[0].size : size, cell: area.cell };
    return { id: `${id}-${area.name}${isSlot(area.name) ? "-area" : ""}`, ...(heading ? { heading } : {}), ...(tone ? { treatment: tone } : {}), layout: area.content.some(takesFrame) ? "flow.column" : "flow.best", leftover: area.leftover ?? "spread", ...(area.gap ? { gap: area.gap } : {}), size, cell: area.cell, items: content,
      ...(area.wraps ? { alignSelf: area.cell.rowSpan === rows.length ? "center" : "start" } : {}) };
  });
  // The engine sets the page's major gap between the areas: they are sections (core.mjs TASTE, `space.major`).
  if (slide.grid.arrange) { items.push({ id: `${id}-${gridName}`, layout: "flow.best", size: SIZE, items: cells.map(({ cell: _cell, ...block }) => block) }); return; }
  // The page's areas are its major components: they stand a major gap apart unless the template names its own.
  // A template that offers alternative tracks carries them (`tracks`, the preference as `gridColumns` and `gridRows`): the
  // grid is a choice between those grids, which the planner hands the engine (planner.mjs makeItem).
  items.push({ id: `${id}-${gridName}`, layout: "grid", gridColumns: columns, gridRows: rows, ...(slide.grid.tracks ? { tracks: slide.grid.tracks } : {}), gap: gap ?? "space.major", size: SIZE, items: cells });
}

/**
 * A dashboard: two to six headed exhibits on a grid of areas - a hero chart
 * over two columns beside two satellites, a map beside a table - each in the
 * cell its `area` names (page-types.mjs dashboardGrid), the tracks as wide
 * and as tall as their weights. The strip of figures over it is the page's
 * (measuresOverPage); the rail, where the page has one, stands at its right
 * as a boxed column. A text `panel` heads itself, so it takes no band.
 */
export function exhibitDashboard(items, { id, slide, exhibits, baseDir }) {
  const grid = slide.grid;
  if (!grid) throw new Error(`${id}: a dashboard carries its grid (page-types.mjs dashboardGrid)`);
  const cells = exhibits.map((exhibit, i) => {
    const { area, ...ex } = exhibit;
    const item = { ...exhibitItem(ex, `${id}-exhibit-${i}`, baseDir), size: SIZE };
    return { ...(ex.type === "panel" ? item : headedPanel(ex, item, `${id}-exhibit-${i}`)), cell: grid.areas[i] };
  });
  const board = { id: `${id}-dashboard`, layout: "grid", gridColumns: grid.columns, gridRows: grid.rows, size: SIZE, items: cells };
  if (slide.panel?.text) {
    const rail = { id: `${id}-rail`, component: "side-statement", props: { text: slide.panel.text, tone: slide.panel.tone ?? "muted" }, size: { width: { fr: 1 }, height: "fill" } };
    // A quarter of the row where the statement fits there, a third where it does not, as a sidebar page's panel (compose-text-pages.mjs).
    items.push({ id: `${id}-row`, layout: "flow.row", size: SIZE, items: [{ ...board, size: { width: { fr: fitsQuarter(rail.props) ? 3 : 2 }, height: "fill" } }, rail] });
  } else items.push(board);
}

