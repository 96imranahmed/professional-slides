// Page assembly: one slide of the v3 deck to one page of the planner's
// deckPlan (`composeSlide`). The slide's keys are checked (`SLIDE_KEYS`), the
// rewrite passes run (compose-passes.mjs), the non-analytical kinds take their
// fixed shapes (`KINDS`), and an analytical page takes the layout chosen for it
// (compose-layouts.mjs) built from the arrangements (compose-arrangements.mjs).
import { SIZE, HUG, LAYOUT } from "./compose-body.mjs";
import { imageProps, normalizePictures } from "./compose-pictures.mjs";
import { proseOf, bridgeVariant, resolvePointsStyle, pointsItem, sideTreatment, soWhatItem } from "./compose-points.mjs";
import { metricsStrip, metricsBesideExhibit } from "./compose-metrics.mjs";
import { SLIDE_PASSES } from "./compose-passes.mjs";
import { chooseLayout } from "./compose-layouts.mjs";
import { peerExhibitsRow, exhibitOverCommentary, labelledRows, centredCards, centredFigure, exhibitBesideCommentary, figureWithPoints,
  fullWidthExhibit, tableHalves, heroNumber, splitTone, exhibitStack, exhibitGrid } from "./compose-arrangements.mjs";
import { picturesAcross, pictureHero, photoBackdrop } from "./compose-picture-pages.mjs";
import { sidebarPage, textPage } from "./compose-text-pages.mjs";

/** Walk the composed tree and join every chart's unit to its heading. */
function inlineChartUnits(items) {
  for (const item of items || []) {
    if (item?.component && String(item.component).startsWith("chart.") && item.props?.unit && !item.props.unitPlacement) {
      item.props.unitPlacement = "inline";
    }
    if (Array.isArray(item?.items)) inlineChartUnits(item.items);
  }
}

/**
 * Every key a slide may carry, with the one line that says what it is for.
 *
 * Without it, a misspelled key - `subtitile`, `footnote`, `insite` - would
 * compose silently and the page would miss the thing the author wrote. The
 * check is a spelling check, not a schema: the value's shape is still the
 * business of whichever pass reads it.
 */
export const SLIDE_KEYS = Object.freeze({
  // what the page is
  id: "the page's own id; one is derived from its position when absent",
  kind: "statement, takeaways, section, agenda or cover; absent means an analytical page",
  shape: "one of the four heavy-page shapes: findings-matrix, measure-table, model-page, half-and-half",
  layout: "force a layout instead of letting the composer choose one",
  arrange: "row, stack, grid or sequence (a row joined by arrows), when the page carries more than one exhibit",
  density: "this page's density profile, overriding the deck's",
  // the title band
  title: "the action title: the finding, not the subject",
  titleLead: "a lead-in phrase set before the title in the accent",
  highlight: "the phrase the reader should see first, set in the accent wherever the page says it",
  subtitle: "the standfirst under the title: the measure, the population and the period",
  kicker: "the small label above the title naming the part of the argument",
  tag: "PRELIMINARY, ILLUSTRATIVE, Exhibit 3 - the page's badge",
  tracker: "the section tracker shown on this page",
  // the evidence
  exhibit: "the page's one exhibit",
  exhibits: "two or more exhibits, arranged by `arrange`",
  rows: "a label-and-text table written at slide level",
  blocks: "on a labelled-rows page, the rows down the page: each { label, points, metric | exhibit }",
  columns: "the headers for that table",
  photo: "a photograph beside the copy",
  pictures: "one to five photographs, each with its label and line: the picture-led pages",
  image: "a full-bleed picture, on the fixed-shape pages",
  metrics: "a strip of measured tiles",
  metricsPosition: "top (the default) or bottom",
  metricsTone: "the tiles' treatment",
  kpi: "the one big number the exhibit proves, at the top of the side column",
  // the commentary
  points: "the commentary column: a lead and a sentence per point",
  pointsHeading: "the heading over that column, or false for none",
  pointsStyle: "how the column is marked: icon-lead, icon-framed, prose, ruled, lettered, numbered, bulleted or checklist",
  pointsTone: "open, dark, muted, tint or primary",
  pointsAlign: "middle to centre the points on the exhibit",
  paragraphs: "body prose, on a text page",
  textColumns: "1, 2 or 3: how many columns a text page sets its paragraphs in (default by length)",
  panel: "on a sidebar page, { text, kicker, tone }: the statement the side panel carries",
  photoSide: "on a photo-backdrop page, which side of the photograph the card leaves clear: left (default) or right",
  text: "the sentence a statement page carries",
  subtext: "the line under that sentence",
  insight: "the so-what as a box in the side column",
  insights: "two statements in that column: a plain one above a boxed one",
  callout: "a boxed aside beside the evidence",
  soWhat: "the page's close, under everything else; { text, style: \"bar\" } is the filled so-what bar",
  implication: "the gutter mark joining evidence to meaning: \"divider-chevron\", \"chevron\", \"rule\", or false when the words carry it",
  items: "the entries on an agenda or takeaways page",
  active: "which agenda entry the deck is on",
  summary: "the line under a section divider's title",
  role: "semantic page role, including executive-summary",
  evidenceStatus: "evidence qualifier in the shared subtitle band",
  number: "a section divider's number",
  contents: "the deck's sections, listed down a divider with this one banded",
  contentsActive: "which of those sections the divider opens",
  // the footer
  source: "where the numbers came from",
  sourceForms: "written by the compiler for a citation it derived from registry keys: the forms the footer may show, fullest first",
  note: "the footnote line, or a list of numbered notes",
  footnotes: "notes tied to a label, printed with a superscript marker",
  notes: "the speaker notes, which print in the file and never on the page",
  hidden: "true keeps the slide in the file but out of the slide show (PowerPoint's Hide Slide); it is still rendered and reviewed. An imported hidden slide carries it",
  // the rest
  serves: "which ranked criteria this page answers",
  pageType: "the page type and choices the page was compiled from (author-deck.mjs); the build checks the structure still matches",
  tone: "dark or light, on the fixed-shape pages",
  accent: "an accent phrase inside a statement",
  style: "a per-kind style switch (an agenda in columns, say)",
  stackWeights: "the height shares of stacked exhibits",
  pairedWeights: "the width shares of paired exhibits",
});

function assertKnownSlideKeys(slide, id) {
  const known = Object.keys(SLIDE_KEYS);
  for (const key of Object.keys(slide)) {
    if (key in SLIDE_KEYS) continue;
    const lower = key.toLowerCase();
    // The nearest known key by a cheap edit distance: a misspelling is almost
    // always a transposition, a doubled letter or a dropped one.
    const near = known.filter((candidate) => {
      const other = candidate.toLowerCase();
      if (Math.abs(other.length - lower.length) > 2) return false;
      const shared = [...new Set(lower)].filter((ch) => other.includes(ch)).length;
      return shared >= Math.max(3, Math.min(other.length, lower.length) - 2);
    });
    const hint = near.length ? ` Did you mean ${near.slice(0, 3).map((k) => `\`${k}\``).join(" or ")}?` : "";
    throw new Error(`${id}: unknown slide key \`${key}\`.${hint} The page keys are ${known.join(", ")}.`);
  }
}

/**
 * The four pages that are not analytical pages.
 *
 * Each is a fixed shape with no layout to negotiate, so each is one function
 * from the spec to the plan rather than an early return buried in the
 * composer. They share the picture and the speaker notes, which is what
 * `chrome` carries.
 */
const KINDS = {
  statement: (slide, { id }) => ({ kind: "statement", text: slide.text || slide.title,
    ...(slide.accent ? { accent: slide.accent } : {}),
    ...(slide.subtext ? { subtext: slide.subtext } : {}),
    ...(slide.tone === "dark" ? { mode: "dark" } : {}) }),
  takeaways: (slide) => ({ kind: "takeaways",
    ...(slide.title ? { title: slide.title } : {}),
    items: slide.points || slide.items,
    ...(slide.tone === "light" ? { mode: "light" } : {}) }),
  section: (slide) => ({ kind: "divider", title: slide.title,
    ...(slide.summary ? { subtitle: slide.summary } : {}),
    ...(Array.isArray(slide.contents) ? { contents: slide.contents, contentsActive: slide.contentsActive } : {}),
    ...(slide.number !== undefined ? { number: slide.number } : {}) }),
  agenda: (slide, { id }) => ({ title: slide.title || "Contents", layout: "flow.column",
    items: [{ id: `${id}-agenda`, component: "agenda", props: { items: slide.items,
      ...(slide.active !== undefined ? { active: slide.active } : {}),
      ...(slide.style === "columns" ? { variant: "columns" } : {}) }, size: SIZE }] }),
};

/**
 * Compose one page, and say which page when it cannot.
 *
 * Most of the runtime's error messages do not name the page they came from -
 * "A soWhat list needs at least one line" names no page, no title and no
 * field. This is the only place a slide is composed and the only place that
 * knows both the id and the title, so the page is named here rather than in
 * every throw.
 *
 * A message that already names its page keeps its own wording.
 */
export function composeSlide(slide, index, baseDir, fill = "balanced", elements = 1, recent = [], recentStyles = []) {
  const id = slide?.id || `s${String(index + 1).padStart(2, "0")}`;
  try {
    return composePage(slide, index, baseDir, fill, elements, recent, recentStyles);
  } catch (error) {
    if (!(error instanceof Error) || error.composedPage) throw error;
    const title = typeof slide?.title === "string" && slide.title.trim() ? ` ("${slide.title.trim()}")` : "";
    const named = error.message.startsWith(`${id}:`) || error.message.includes(`${id} `);
    const next = new Error(named ? error.message : `${id}${title}: ${error.message}`);
    next.composedPage = id;
    next.cause = error;
    throw next;
  }
}

/**
 * One slide to one page. Every page runs the first three passes; a page of a
 * fixed kind (section, agenda, statement, takeaways) then takes its own shape,
 * and an analytical page runs the remaining passes, takes the layout chosen
 * for it, and is arranged, closed and given its footer in that order.
 */
function composePage(slide, index, baseDir, fill = "balanced", elements = 1, recent = [], recentStyles = []) {
  const id = slide.id || `s${String(index + 1).padStart(2, "0")}`;
  assertKnownSlideKeys(slide, id);
  const ctx = { id, baseDir, fill };

  // The first three passes run for every page; the fixed-shape pages then take
  // their own route and the rest go on through the pipeline.
  for (const [, run] of SLIDE_PASSES.slice(0, 3)) slide = run(slide, ctx);
  if (KINDS[slide.kind]) {
    return { id, ...KINDS[slide.kind](slide, ctx),
      ...(slide.image ? { image: imageProps(slide.image, baseDir) } : {}),
      ...(slide.notes ? { notes: slide.notes } : {}) };
  }
  let slideIn;
  ({ slide, slideIn } = analyticalPasses(slide, id, ctx));
  const { pictures, layout, pointsStyle, exhibits } = pagePlan(slide, id, recent, recentStyles);
  const items = [];
  const { metricsBelow, metricsBeside } = measuresOverPage(items, { id, slide, layout, exhibits });
  const pointsPlaced = arrangePage(items, { id, slide, layout, exhibits, baseDir, fill, pointsStyle, pictures, metricsBeside });
  closePage(items, { id, slide, layout, fill, pointsStyle, metricsBelow, pointsPlaced });
  return pageRecord(items, { id, slide, slideIn });
}

/** The passes after the first three, with the standfirst read off first; returns the slide they produce and the slide they started from. */
function analyticalPasses(slide, id, ctx) {
  if (slide.evidenceStatus) slide = { ...slide, subtitle: [slide.evidenceStatus, slide.subtitle].filter(Boolean).join(" · ") };
  // The journal sets the finding as the standfirst under the title, where a
  // reader of a data briefing looks for it, instead of closing the page on it.
  // It is still the page's takeaway, so it keeps a takeaway's role and counts
  // as body; an authored standfirst (the scope) is title-band furniture.
  if (LAYOUT.takeaway === "standfirst" && typeof slide.soWhat === "string" && !slide.subtitle && slide.soWhat.length <= 200) {
    const { soWhat, ...rest } = slide;
    slide = { ...rest, subtitle: soWhat, _standfirstTakeaway: true };
  }
  const slideIn = slide;
  for (const [name, run] of SLIDE_PASSES.slice(3)) {
    try {
      slide = run(slide, ctx);
    } catch (error) {
      throw new Error(`${id} (${name}): ${error.message}`, { cause: error });
    }
  }
  return { slide, slideIn };
}

/** The page's pictures, its layout (recorded in `recent`), its points style (recorded in `recentStyles`) and its exhibits. */
function pagePlan(slide, id, recent, recentStyles) {
  const pictures = normalizePictures(slide, id);
  const chosen = chooseLayout(slide, recent);
  // Editorial pages read commentary first: the mirror, on every page of the
  // deck, so the reading order is still one the reader can rely on.
  const layout = chosen === "exhibit-left" && !slide.layout && LAYOUT.commentary === "left" ? "exhibit-right" : chosen;
  if (Array.isArray(recent)) recent.unshift(chosen);
  const columnPoints = slide.points;
  const pointsStyle = columnPoints?.length ? resolvePointsStyle(slide, columnPoints) : null;
  if (pointsStyle && Array.isArray(recentStyles)) recentStyles.unshift(pointsStyle);
  const exhibits = [...(slide.exhibits || (slide.exhibit ? [slide.exhibit] : []))];
  // A lone table whose density the composer chose (a findings matrix defaults
  // to compact, pagination picks the lightest step its estimate fits) may be
  // set a type step up when its frame holds it (`fillDensity` in tables.mjs).
  // An author's density is kept, and so are peer tables, which must share one
  // type size, and the pages of a split table, which must match each other.
  if (exhibits.length === 1 && ["table", "rows", "compare", "phase-table"].includes(exhibits[0]?.type) && ["exhibit-full", "metrics-over-exhibit", "exhibit-top", "exhibit-left", "exhibit-right"].includes(layout)
      && (exhibits[0]?.density === undefined || exhibits[0]?._densityChosen === true)) exhibits[0] = { ...exhibits[0], _typeStep: true };
  return { pictures, layout, pointsStyle, exhibits };
}

/** The measures over the page, with the bridge across under them; returns where the measures go instead when they do not. */
function measuresOverPage(items, { id, slide, layout, exhibits }) {
  // Explicit layouts must preserve their author's commentary too. Side-only
  // fields cannot be silently dropped by a layout that has no side track.
  if ((slide.insight || slide.insights?.length || slide.kpi) && !["exhibit-left", "exhibit-right", "hero-number", "stack", "picture-hero"].includes(layout)) {
    throw new Error(`${id}: ${layout} cannot place insight/insights/kpi; choose an exhibit-left or exhibit-right layout`);
  }
  const metricsBelow = slide.metricsPosition === "bottom";
  const metricsBeside = metricsBesideExhibit(slide, exhibits, layout);
  if (Array.isArray(slide.metrics) && slide.metrics.length && !metricsBelow && !metricsBeside) {
    items.push(metricsStrip(slide.metrics, `${id}-metrics`, slide.metricsTone));
    // `implication` draws the marker across the page, between the measures and
    // what follows from them: the same mark the gutter carries between an
    // exhibit and its meaning, turned on its side, in the variant asked for.
    // Off unless asked for - a page that puts numbers above their own detail is
    // not making an inference, and a chevron on every metrics page is a device
    // that has stopped meaning anything.
    const acrossBridge = bridgeVariant(slide, id);
    if (acrossBridge) items.push({ id: `${id}-implication`, component: "connector", props: { variant: acrossBridge }, size: { width: { fr: 1 }, height: 32 } });
  }
  return { metricsBelow, metricsBeside };
}

/** The page's evidence and words, in the layout chosen for it; returns whether the points were placed under a figure. */
function arrangePage(items, page) {
  const { id, slide, layout, exhibits, baseDir, fill, pointsStyle, pictures } = page;
  // A full-width table needs no heading of its own: the action title and the
  // header row already say what it is. Heading bands exist for the row rule only.

  // A staircase, a cycle and a chevron process are all figures with a natural
  // size: a three-step staircase wants about 230px whatever the page offers it,
  // and handed the whole body it spreads into small islands with a hundred
  // pixels of nothing between them. They hug their natural size at the top of
  // the body with the points directly under them, and the frame's slack is
  // its foot: centred in it, the staircase would carry as much air above as
  // below, and the points would sit under the lower band.

  // `metrics-over-exhibit` is `exhibit-full` with the measures above it: the
  // exhibit still takes the whole width and the height the strip leaves.
  const fullWidth = layout === "exhibit-full" || layout === "metrics-over-exhibit";
  if (fullWidth && (centredCards(exhibits[0]) || centredFigure(exhibits[0]))) return figureWithPoints(items, page);
  if (fullWidth) fullWidthExhibit(items, page);
  else if (layout === "table-halves") tableHalves(items, page);
  else if (layout === "exhibit-left" || layout === "exhibit-right") exhibitBesideCommentary(items, { id, slide, layout, exhibits, baseDir, fill, pointsStyle });
  else if (layout === "exhibit-top") exhibitOverCommentary(items, { id, slide, exhibits, baseDir, fill, pointsStyle });
  else if (layout === "hero-number") heroNumber(items, page);
  else if (layout === "split-tone") splitTone(items, page);
  else if (layout === "stack") exhibitStack(items, page);
  else if (layout === "grid") exhibitGrid(items, page);
  else if (layout === "two-up" || layout === "two-up-contrast" || layout === "sequence") peerExhibitsRow(items, { id, slide, layout, exhibits, baseDir, fill, pointsStyle, pictures });
  else if (layout === "labelled-rows") labelledRows(items, { id, slide, baseDir, fill });
  else if (layout === "picture-pair" || layout === "picture-strip") picturesAcross(items, page);
  else if (layout === "picture-hero") pictureHero(items, page);
  else if (layout === "sidebar") sidebarPage(items, page);
  else if (layout === "photo-backdrop") photoBackdrop(items, page);
  else textPage(items, page);
  return false;
}

/** What every page closes with: points and prose under full-width evidence, measures at the foot, the reading note, the so-what. */
function closePage(items, { id, slide, layout, fill, pointsStyle, metricsBelow, pointsPlaced }) {
  // These full-width/paired layouts keep supplied points in a measured track
  // below the evidence, just like the two-up recipe.
  if (["exhibit-full", "table-halves", "split-tone"].includes(layout) && slide.points?.length && !pointsPlaced) {
    items.push(pointsItem(slide.points, `${id}-points`, sideTreatment(slide), fill, false, pointsStyle));
  }
  // Authored prose on a full-width page goes under the evidence, for the same
  // reason the points do: the page was given the words, so the page prints them.
  if (["exhibit-full", "metrics-over-exhibit", "table-halves", "split-tone", "exhibit-top"].includes(layout)) {
    items.push(...proseOf(slide, id));
  }
  // A reading note sits at the top of the side column when there is one,
  // otherwise as a full-width band above the content.
  if (Array.isArray(slide.metrics) && slide.metrics.length && metricsBelow) items.push(metricsStrip(slide.metrics, `${id}-metrics`, slide.metricsTone));
  if (slide.callout) {
    const note = { id: `${id}-callout`, component: "callout", props: typeof slide.callout === "string" ? { text: slide.callout } : slide.callout, size: HUG };
    const row = items.find((it) => it.id === `${id}-row`);
    const at = row?.items?.findIndex((it) => it.id === `${id}-side`) ?? -1;
    if (at >= 0) row.items[at] = { id: `${id}-side-column`, layout: "flow.column", size: row.items[at].size, items: [note, { ...row.items[at], size: { width: { fr: 1 }, height: "fill" } }] };
    else items.push(note); // full-width pages: the reading aid sits under the exhibit, above the takeaway
  }
  if (slide.soWhat) items.push(soWhatItem(slide.soWhat, `${id}-sowhat`, slide.highlight, !slide.callout));
  if (!items.length) throw new Error(`${id}: a slide needs an exhibit, points, paragraphs or a soWhat`);
}

/** The page record the planner reads: the slide's furniture, its footer lines, and the items. */
function pageRecord(items, { id, slide, slideIn }) {
  // A chart's unit joins its heading on one line, on every architecture. A
  // page's shape decides where things sit, never what they are.
  inlineChartUnits(items);
  // Footer: "Source:" and "Note:" lead their lines, as on a consulting page.
  const prefixed = (label, text) => (text && !/^(source|sources|note|notes)\s*:/i.test(text) ? `${label}: ${text}` : text);
  // `note` takes a list as well as a line: a well-made page carries two to four
  // numbered notes under the page, and a numbered note is what a superscript in
  // a label or a heading ("Revenue¹") points at.
  const noteLine = Array.isArray(slide.note)
    ? (slide.note.length ? `Notes: ${slide.note.map((item, index) => `${index + 1}. ${String(item).trim().replace(/^\d+\.\s*/, "")}`).join("   ")}` : null)
    : prefixed("Note", slide.note);
  return { id, role: slide.role ?? (slideIn.shape === "executive-summary" ? "executive-summary" : undefined), title: slide.title, layout: "flow.column", ...(slide.titleLead ? { titleLead: slide.titleLead } : {}), ...(slide.tag ? { tag: slide.tag } : {}), ...(slide.kicker ? { kicker: slide.kicker } : {}), ...(slide.subtitle ? { subtitle: slide.subtitle } : {}), ...(slide._standfirstTakeaway ? { subtitleRole: "takeaway-standfirst" } : {}), ...(slide.density ? { density: slide.density } : {}), ...(slide.source ? { source: prefixed("Source", slide.source) } : {}), ...(slide.source && Array.isArray(slide.sourceForms) && slide.sourceForms.length ? { sourceForms: slide.sourceForms } : {}), ...(noteLine ? { note: noteLine } : {}), ...(slide.notes ? { notes: slide.notes } : {}), ...(slide.tracker ? { tracker: slide.tracker } : {}), items };
}
