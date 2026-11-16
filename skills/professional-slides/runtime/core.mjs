import crypto from "node:crypto";
import { resolvePalette, heatScaleTokens, groundTokens, GROUNDS } from "./palettes.mjs";
import { contrastRatio, relativeLuminance } from "./color.mjs";
import { activeDesignTokens, withDesignTokens } from "./design-context.mjs";
import { resolveTypography } from "./typography.mjs";
import { lineBox, accentRuns } from "./text-layout.mjs";
import { timePositions } from "./time-axis.mjs";
import { citationRoomOf } from "./derive-content.mjs";
import { readFileSync } from "node:fs";
import { initSync, TaffyTree, Style, Display, AlignContent, AlignSelf, Position } from "./vendor/taffy-layout/taffy_wasm.mjs";
import { arrange } from "./tasteful-layout/index.mjs";

initSync({ module: readFileSync(new URL("./vendor/taffy-layout/taffy_wasm_bg.wasm", import.meta.url)) });

export const DESIGN_SYSTEM_VERSION = "2.0.0";
export const SCENE_SCHEMA = "professional-slides.scene/v1";
export const MANIFEST_SCHEMA = "professional-slides.design-provenance/v1";
export const DEFAULT_TITLE_VARIANT = "without-line";
export const TITLE_VARIANTS = Object.freeze({
  "with-line": Object.freeze({ rule: true }),
  "without-line": Object.freeze({ rule: false })
});

export function resolveTitleVariant({ variant, rule } = {}) {
  if (variant !== undefined && (typeof variant !== "string" || !Object.hasOwn(TITLE_VARIANTS, variant))) throw new Error(`Unknown title variant: ${variant}`);
  if (rule !== undefined && typeof rule !== "boolean") throw new Error("Title rule must be a boolean");
  const resolved = variant ?? (rule === true ? "with-line" : DEFAULT_TITLE_VARIANT);
  if (rule !== undefined && TITLE_VARIANTS[resolved].rule !== rule) throw new Error("Title variant conflicts with rule");
  return resolved;
}
export const SLIDE = Object.freeze({ width: 1280, height: 720 });
export const CONTENT_FRAME = Object.freeze({ x: 60, y: 46, width: 1160, height: 632 });
const DEFAULT_CHROME = Object.freeze({
  left: 60,
  right: 60,
  titleTop: 44,
  titleHeight: 36,      // one 24pt line box; a second line adds 36
  titleRail: 0.2,       // right share of the title band reserved for a tracker or sticker
  bodyTop: 140,         // 44 + 2 × 36 + 24: identical for one- and two-line titles
  sourceTop: 648,
  footerRuleY: 680,
  footerTop: 684
});
// The page chrome is read at call time everywhere, so a deck built from a
// template can move the margins: `configureChrome({ left, right, titleTop,
// bodyTop, footerTop })` for the build, `configureChrome(null)` to restore.
export const CHROME = { ...DEFAULT_CHROME };
export function configureChrome(overrides) {
  const next = { ...DEFAULT_CHROME };
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (!Object.hasOwn(DEFAULT_CHROME, key)) throw new Error(`Unknown chrome setting: ${key}`);
      if (!Number.isFinite(value)) throw new Error(`Chrome ${key} must be a number`);
      next[key] = value;
    }
    if (next.left < 24 || next.right < 24 || next.left + next.right > 400) throw new Error("Chrome margins must be between 24px and a combined 400px");
    if (next.titleTop < 16 || next.bodyTop < next.titleTop + 48) throw new Error("Chrome bodyTop must sit at least 48px under titleTop");
    if (next.footerTop <= next.bodyTop + 200 || next.footerTop > 700) throw new Error("Chrome footerTop leaves no body height");
    if (overrides.footerTop !== undefined && overrides.sourceTop === undefined) next.sourceTop = next.footerTop - 36;
    if (overrides.footerTop !== undefined && overrides.footerRuleY === undefined) next.footerRuleY = next.footerTop - 4;
  }
  Object.assign(CHROME, next);
  return { ...CHROME };
}

const colour = (cssVar, value, themeSlot = null) => ({ kind: "color", cssVar, value, themeSlot });
const length = (cssVar, value) => ({ kind: "lengthPx", cssVar, value });
const point = (cssVar, value) => ({ kind: "fontSizePt", cssVar, value });
const font = (cssVar, value) => ({ kind: "fontFamily", cssVar, value });
const keyword = (cssVar, value) => ({ kind: "keyword", cssVar, value });

export const TOKENS = Object.freeze({
  ...heatScaleTokens({'color.canvas':'#FFFFFF','color.componentPrimary':'#00A6E6','color.negative':'#C53030','color.positive':'#198754'}),
  "color.canvas": colour("--canvas", "#FFFFFF"),
  "color.surface": colour("--surface-1", "#FFFFFF", "lt1"),
  "color.surfaceMuted": colour("--surface-2", "#EEF0F2", "lt2"),
  "color.ink": colour("--ink", "#06233B", "dk1"),
  "color.textSecondary": colour("--text-secondary", "#405263", "dk2"),
  "color.chartUnit": colour("--chart-unit-color", "#757575"),
  "color.componentPrimary": colour("--component-primary", "#00A6E6", "accent1"),
  "color.componentPrimaryTint": colour("--component-primary-tint", "#DCEEF8"),
  // The filled surface a structure sits on: a table's label column, a card, a
  // phase block. The ink mixed 86% toward the canvas (resolvePalette derives it
  // for every palette that does not set it), so it reads as a surface at a
  // glance - about 30 grey levels under the page - where a 6-12% tint of the
  // primary vanishes on a projector and in the page's measured weight.
  "color.surfaceTint": colour("--surface-tint", "#DADEE1"),
  // The surface type is reversed out of on a page whose type is pale - a header
  // band, a dark panel, the so-what bar (reversedFill): a step off a dark or a
  // primary ground. On a light page those surfaces keep the ink or the primary
  // they are drawn in, so its value there is the ink's (resolvePalette).
  "color.band": colour("--band", "#06233B"),
  "color.calloutTint": colour("--callout-tint", "#FFF6DC"),
  "color.accent": colour("--accent", "#00A6E6"),
  "color.accentTint": colour("--accent-tint", "#DCF3FD"),
  "color.rule": colour("--rule", "#929BA3"),
  "color.chartGrid": colour("--chart-gridline", "#D4D8DC"),
  "color.chartComparator": colour("--chart-comparator", "#D9DDE0"),
  // The subject a chart marks - a highlighted member, a focus series - in one colour on every kind, derived per palette and
  // ground (palettes.mjs subjectOf); the toolkit's own is its accent.
  "color.chartSubject": colour("--chart-subject", "#00A6E6"),
  "color.chartPeer": colour("--chart-peer", "#2251FF"),
  "color.chartSeries1": colour("--chart-series-1", "#06233B", "dk1"),
  "color.chartSeries2": colour("--chart-series-2", "#0B4F7D", "accent2"),
  "color.chartSeries3": colour("--chart-series-3", "#00A6E6", "accent3"),
  "color.chartSeries4": colour("--chart-series-4", "#9ACCE8", "accent4"),
  "color.chartSeries5": colour("--chart-series-5", "#D9DDE0", "accent5"),
  "color.chartSeries6": colour("--chart-series-6", "#7B8791", "accent6"),
  "color.positive": colour("--status-positive", "#198754"),
  "color.caution": colour("--status-caution", "#C47B00"),
  "color.negative": colour("--status-negative", "#C53030"),
  "color.negativeTint": colour("--status-negative-tint", "#F6DADA"),
  "color.info": colour("--status-info", "#0877BE"),
  "color.onPrimary": colour("--on-primary", "#FFFFFF"),
  "font.body": font("--font-body", "Arial"),
  "font.bodySemibold": { ...font("--font-body-semibold", "Arial"), nativeBold: true, effectiveWeight: 700 },
  "weight.semibold": { kind: "fontWeight", cssVar: "--weight-semibold", value: 600 },
  "font.display": font("--font-display", "Arial"),
  "font.serif": font("--font-serif", "Georgia"),
  "type.deckTitle": point("--type-deck-title", 32),
  // The consulting cover's title: a step over the deck title, so the cover
  // reads as the deck's first statement rather than an action title set low.
  "type.coverTitle": point("--type-cover-title", 40),
  // A figure that is the page's point, set as large as the room it has: a lone number in a column takes the largest of
  // these that sets on one line there (panels.mjs figureSize).
  "type.figureLarge": point("--type-figure-large", 64),
  "type.figureHero": point("--type-figure-hero", 88),
  "type.actionTitle": point("--type-action-title", 24),
  "type.actionTitleLong": point("--type-action-title-long", 22),
  "type.sectionTitle": point("--type-section-title", 24),
  "type.sectionNumber": point("--type-section-number", 170),
  "type.quoteMark": point("--type-quote-mark", 48),
  "type.quoteMarkHero": point("--type-quote-mark-hero", 76),
  "type.heading": point("--type-heading", 14),
  "type.body": point("--type-body", 12),
  // Modular scale 8 / 9 / 10 / 12 / 14 / 18 / 24 / 32 (about 1.2). Chart furniture
  // sits two steps below body, as on a consulting page.
  // The sizes under body (`type.compact`, `type.label`, `type.source`) are for furniture only: the source line, the
  // footer and page number, a chart's axis, legend, unit and data labels, a diagram's node and axis labels, and dense
  // table cells. Words that are a page's content - what a figure measures and its sub-line, a caption under a panel,
  // a point, a description in a list or a card - are set at `type.body` or larger.
  "type.chartLabel": point("--type-chart-label", 10),
  "type.chartAnnotation": point("--type-chart-annotation", 10),
  "type.compact": point("--type-compact", 10),
  "type.label": point("--type-label", 9),
  "type.source": point("--type-source", 8),
  "type.metric": point("--type-metric", 28),
  "space.1": length("--space-1", 4),
  "space.2": length("--space-2", 8),
  "space.3": length("--space-3", 12),
  "space.4": length("--space-4", 16),
  "space.5": length("--space-5", 24),
  "space.6": length("--space-6", 32),
  "space.8": length("--space-8", 48),
  // The page's rhythm, which the layout engine arranges to (tasteful-layout): the least air between the major components
  // of a page - an exhibit and its commentary - and between the blocks inside one, and the widths a line of body text
  // is read at. They are tokens like any other: a density scales the gaps, a house style or a design system sets its own.
  "space.major": length("--space-major", 32),
  "space.minor": length("--space-minor", 16),
  // The most air between the blocks of one group: a column with height to spare opens its gaps this far and no further,
  // and sets what is still left above and below the group (a flow's `leftover: "spread"`).
  "space.loose": length("--space-loose", 48),
  "measure.min": length("--measure-min", 240),
  "measure.max": length("--measure-max", 480),
  "layout.titleContentGap": length("--title-content-gap", 56),
  // The air on either side of the title rule: title (or standfirst) to rule, rule to body.
  "layout.titleRuleGap": length("--title-rule-gap", 12),
  "icon.small": length("--icon-sm", 16),
  "icon.medium": length("--icon-md", 24),
  "icon.large": length("--icon-lg", 36),
  "line.hairline": length("--line-hairline", 1),
  "line.titleRule": length("--line-title-rule", 1),
  "line.standard": length("--line-standard", 2),
  "line.medium": length("--line-medium", 3.5),   // map routes: the middle volume class
  "line.heavy": length("--line-heavy", 5),       // map routes: the largest volume class
  "radius.none": length("--radius-none", 0),
  "radius.small": length("--radius-small", 4),
  "radius.round": length("--radius-round", 999),
  // Design profile: the house style a palette carries beyond its colours. Each
  // palette sets these to what its house style does; components read them.
  "style.titleWeight": keyword("--style-title-weight", "bold"),        // bold | regular
  "style.titleRule": keyword("--style-title-rule", "none"),            // none | rule (a rule closing the title band) | band (tinted title band) | block (primary title block, reversed type) | tab (accent tab at the top edge)
  // How the house draws its title rule: most well-made pages close the title
  // band with a thin rule margin to margin or edge to edge, some with a short
  // accent bar. Colour names a palette role, so a subject's identity recolours it.
  "style.titleRuleLength": keyword("--style-title-rule-length", "content"), // content (margin to margin) | full (page edge to edge) | short (an accent bar under the title)
  "style.titleRuleColor": keyword("--style-title-rule-color", "rule"),      // rule | ink | accent | primary
  "style.tagPlacement": keyword("--style-tag-placement", "top-right"), // top-right | below-title (accent pill) | above-title (accent label)
  "style.chartHeading": keyword("--style-chart-heading", "text"),      // text | band (filled grey band)
  // A bullet unless the house explicitly sets a dash: the marker is a dot in
  // a well-made deck, and a hyphen reads as a sentence fragment.
  "style.listMarker": keyword("--style-list-marker", "dot"),           // dot | dash
  "style.tableRows": keyword("--style-table-rows", "rules"),           // rules | zebra
  "style.labelWeight": keyword("--style-label-weight", "bold"),        // bold | regular (chart value labels)
  "style.titleLead": keyword("--style-title-lead", "accent"),          // accent (lead in the accent) | pipe ("Topic | statement", the statement in the accent)
  // The design system's page frame (design-systems.mjs): how the takeaway, the
  // cover and the chapter pages are built. Each value is a whole construction.
  "style.takeaway": keyword("--style-takeaway", "band"),               // band (tinted box) | rule (serif close over a hairline) | statement (accent bar, large type)
  "style.coverLayout": keyword("--style-cover-layout", "block"),       // block | editorial | journal | keynote
  "style.dividerLayout": keyword("--style-divider-layout", "panel"),    // panel | editorial | journal | keynote
  // Surface treatments: how much of a page's structure is drawn as filled
  // surface rather than as type on the canvas with hairlines. The defaults are
  // the weight of a well-made analytical page; a design system that is light
  // by character opts out of single treatments (design-systems.mjs SURFACES).
  "style.tableHeader": keyword("--style-table-header", "band"),        // band (filled header, reversed type) | rule (bold type over a rule)
  "style.tableLabels": keyword("--style-table-labels", "tint"),        // tint (the row-label column on color.surfaceTint) | plain
  "style.cards": keyword("--style-cards", "tint"),                    // tint (filled card, no outline) | outline (hairline card on the canvas)
  "style.marks": keyword("--style-marks", "reference"),               // reference (heavier lines and dots, a lone line's area) | light
  "style.timeline": keyword("--style-timeline", "blocks")              // blocks (filled phase blocks on a heavy spine) | dots (markers on a rail)
});
export const STYLE_TOKENS = Object.freeze(["style.titleWeight", "style.titleRule", "style.titleRuleLength", "style.titleRuleColor", "style.tagPlacement", "style.chartHeading", "style.listMarker", "style.tableRows", "style.labelWeight", "style.titleLead", "style.takeaway", "style.coverLayout", "style.dividerLayout", "style.tableHeader", "style.tableLabels", "style.cards", "style.marks", "style.timeline"]);
/** The active design profile value for a style token ("style.titleWeight" → "bold"). */
export function houseStyle(id) { return tokenValue(token(id)); }
/**
 * `color` when it reads at `ratio` against `surface`, else the ink. A filled
 * surface is drawn for weight, and the type on it keeps its role colour only
 * where the fill leaves it legible: an evergreen secondary grey or a bright
 * accent that passes on white can fall under 4.5:1 on the tint.
 */
export function readableOn(color, surface, ratio = 4.5) {
  return contrastRatio(tokenValue(color), tokenValue(surface)) >= ratio ? color : token("color.ink");
}

/**
 * The reversed white or the ink, whichever reads better on `fill` (a token or
 * a "#rrggbb" colour): type set on a mark, a tile or a band. One rule for every
 * caller, so a fill never takes white in a chart and ink in the table beside
 * it.
 */
export function onFill(fill) {
  const value = typeof fill === "string" && fill.startsWith("#") ? fill : tokenValue(fill);
  const white = token("color.onPrimary"), ink = token("color.ink");
  return contrastRatio(value, tokenValue(white)) >= contrastRatio(value, tokenValue(ink)) ? white : ink;
}

/**
 * Whether the page's type is lighter than its ground: a page set on the dark or
 * the primary ground (palettes.mjs groundTokens), where the ink is the pale type.
 */
export function reversedGround() {
  return relativeLuminance(tokenValue("color.ink")) > relativeLuminance(tokenValue("color.canvas"));
}
/**
 * The fill of a surface type is reversed out of - a table's header band, a total
 * row, a dark or primary panel, the so-what bar: `fill` (the ink or the primary)
 * on a light page; on a reversed ground the band (`color.band`), a step off the
 * ground. There the ink and the primary are the pale type and the light marks,
 * and a header band drawn in them was a white block with navy type on a navy
 * page. A diagram's boxes and a chart's marks are marks, not surfaces: they keep
 * their colours and turn light as the bars do.
 */
export const reversedFill = (fill) => (reversedGround() ? token("color.band") : fill);
/** The type on a reversedFill surface: the reversed white on a light page, the pale ink on a reversed ground. */
export const reversedType = () => (reversedGround() ? token("color.ink") : token("color.onPrimary"));

/**
 * `phrases` inside `text` as runs on a filled surface: in the accent where the
 * accent reads on `fill` at `ratio` (no fill: it always does), else by weight -
 * the sentence regular and the phrase bold, which is the emphasis reversed
 * type can carry (a red accent on a red bar loses the phrase outright).
 * `accent` says which was chosen; null when no phrase occurs.
 */
export function emphasisRuns(text, phrases, fill = null, ratio = 4.5) {
  const runs = accentRuns(text, phrases, { strict: false });
  if (!runs?.some((run) => run.accent)) return null;
  const accent = !fill || contrastRatio(tokenValue(token("color.accent")), tokenValue(fill)) >= ratio;
  return { accent, runs: runs.map((run) => (accent ? { text: run.text, bold: true, ...(run.accent ? { accent: true } : {}) } : { text: run.text, bold: Boolean(run.accent) })) };
}

/**
 * A card's surface (`style.cards`). White cards outlined in a hairline on a
 * cream page are the page colour with a pencil line round them, and a row of
 * four read as an empty page with text on it; under the reference weight a
 * card is a filled block with no outline - a pillar, a label block, a fact
 * tile, a quotation. `fill` and `stroke` are the open construction's.
 */
export const cardFill = (fill = token("color.surface"), stroke = token("color.rule")) =>
  houseStyle("style.cards") === "tint" ? { fill: token("color.surfaceTint"), stroke: "none" } : { fill, stroke };
/** The muted panel inside a card (a stat card, a copy band, a fact tile): the same surface, so one card set carries one fill. */
export const cardMuted = () => cardFill(token("color.surfaceMuted")).fill;

// The layout engine's taste, global to the runtime and passed to tasteful-layout whole (it holds no numbers itself):
// how sharply each measure of an arrangement bites, the fill a page should reach, and what an exhibit wants of its frame - its share of it, the least
// height it reads at, and the proportions (width over height) between which a chart is neither stood on end nor a strip.
// The gaps and the text measure are tokens (`space.major`, `space.minor`, `measure.min`, `measure.max`); a density
// overrides weights (`taste`, below).
export const TASTE = Object.freeze({
  weights: Object.freeze({ whitespace: 1, balance: 0.6, uniformity: 1.5, regularity: 0.8, proportion: 1, simplicity: 0.1, variety: 1 }),
  // `page`: the share of its frame a page's ink should reach before the rest is counted as empty.
  fill: Object.freeze({ page: 0.55, share: 0.4, minHeight: 240, aspect: Object.freeze([1, 2.4]) }),
});
const tastePresets = (taste) => ({ gap: { major: tokenValue(token("space.major")), minor: tokenValue(token("space.minor")) },
  measure: { min: tokenValue(token("measure.min")), max: tokenValue(token("measure.max")) }, fill: TASTE.fill, weights: { ...TASTE.weights, ...taste } });

export const DENSITY_PROFILES = Object.freeze({
  // `taste`: how the layout engine weighs an arrangement at this density (`TASTE.weights`; what is not named
  // keeps its weight). Presented live, a page is one idea with air around it: empty frame costs little and every extra
  // column costs more. Read alone - the consulting pre-read, the appendix - a page is used: empty frame costs more,
  // columns cost nothing, and uneven columns show.
  "live-pitch": Object.freeze({ typeScale: 1.15, taste: Object.freeze({ whitespace: 0.5, simplicity: 0.3, uniformity: 2 }) }),
  executive: Object.freeze({ typeScale: 1, taste: Object.freeze({}) }),
  "pre-read": Object.freeze({ typeScale: 0.92, taste: Object.freeze({ whitespace: 1.5, simplicity: 0.03, regularity: 1 }) }),
  appendix: Object.freeze({ typeScale: 0.84, taste: Object.freeze({ whitespace: 2, simplicity: 0, regularity: 1 }) })
});
// Page chrome keeps its size at every density so hierarchy ratios survive the knob.
const DENSITY_FIXED = new Set(["type.deckTitle", "type.coverTitle", "type.actionTitle", "type.actionTitleLong", "type.sectionTitle", "type.sectionNumber", "type.source", "type.quoteMark", "type.quoteMarkHero"]);
const snapHalfPoint = (value) => Math.round(value * 2) / 2;

export function resolveDensityTokens(baseTokens, density = "executive") {
  if (typeof density !== "string" || !Object.hasOwn(DENSITY_PROFILES, density)) throw new Error(`Unknown density profile: ${density}`);
  const scale = DENSITY_PROFILES[density].typeScale;
  return Object.fromEntries(Object.entries(baseTokens).map(([tokenId, definition]) => [
    tokenId,
    tokenId.startsWith("type.") && !DENSITY_FIXED.has(tokenId)
      ? { ...definition, value: snapHalfPoint(definition.value * scale) }
      : tokenId.startsWith("space.")
        ? { ...definition, value: Math.max(2, Math.round(definition.value * scale)) }
        : { ...definition }
  ]));
}

export const THEME_SLOT_TOKENS = Object.freeze({
  dk1: "color.ink",
  lt1: "color.surface",
  dk2: "color.textSecondary",
  lt2: "color.surfaceMuted",
  accent1: "color.componentPrimary",
  accent2: "color.chartSeries2",
  accent3: "color.chartSeries3",
  accent4: "color.chartSeries4",
  accent5: "color.chartSeries5",
  accent6: "color.chartSeries6",
  hlink: "color.info",
  folHlink: "color.chartSeries4"
});

export function token(tokenId) {
  if (!TOKENS[tokenId]) throw new Error(`Unknown design token: ${tokenId}`);
  return Object.freeze({ tokenId });
}

export function isTokenReference(value) {
  return Boolean(value && typeof value === "object" && typeof value.tokenId === "string");
}

export function tokenDefinition(tokenOrId) {
  const tokenId = typeof tokenOrId === "string" ? tokenOrId : tokenOrId?.tokenId;
  const definition = (activeDesignTokens() || TOKENS)[tokenId];
  if (!definition) throw new Error(`Unknown design token: ${tokenId}`);
  return { tokenId, ...definition };
}

export function tokenValue(tokenOrId) {
  return tokenDefinition(tokenOrId).value;
}

export const chartAnnotationStyle = () => ({ fontFamily: token("font.bodySemibold"), fontWeight: token("weight.semibold") });

export function resolveStyle(style = {}) {
  return Object.fromEntries(
    Object.entries(style).map(([key, value]) => [
      key,
      isTokenReference(value) ? tokenDefinition(value) : value
    ])
  );
}

export function styleValue(value) {
  return value && typeof value === "object" && "value" in value ? value.value : value;
}

export function stableId(...parts) {
  return parts
    .filter((part) => part !== undefined && part !== null && String(part).length)
    .map((part) => String(part).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join(":");
}

export function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** A frame with each of its lengths rounded as the scene writes them (`px`). */
const pxFrame = (frame) => Object.fromEntries(Object.entries(frame).map(([key, value]) => [key, px(value)]));

export function px(value) {
  return Number(Number(value).toFixed(4));
}

export function insetFrame(frame, inset) {
  const value = normalizeInsets(inset);
  return {
    x: px(frame.x + value.left),
    y: px(frame.y + value.top),
    width: px(Math.max(0, frame.width - value.left - value.right)),
    height: px(Math.max(0, frame.height - value.top - value.bottom))
  };
}

export function normalizeInsets(inset = 0) {
  if (isTokenReference(inset)) {
    const value = tokenValue(inset);
    return { top: value, right: value, bottom: value, left: value };
  }
  if (typeof inset === "number") return { top: inset, right: inset, bottom: inset, left: inset };
  const resolve = (value) => isTokenReference(value) ? tokenValue(value) : Number(value || 0);
  const x = resolve(inset.x);
  const y = resolve(inset.y);
  return {
    top: resolve(inset.top ?? y),
    right: resolve(inset.right ?? x),
    bottom: resolve(inset.bottom ?? y),
    left: resolve(inset.left ?? x)
  };
}

export function primitive({ type, id, role, frame, style = {}, text = null, data = {}, tokens = [] }) {
  if (!type || !id || !frame) throw new Error("A scene primitive requires type, id, and frame");
  return {
    type,
    id,
    role: role || type,
    frame: Object.fromEntries(Object.entries(frame).map(([key, value]) => [key, px(value)])),
    style: resolveStyle(style),
    text,
    data,
    tokens: [...new Set([
      ...tokens,
      ...Object.values(style).filter(isTokenReference).map((value) => value.tokenId)
    ])].sort()
  };
}

export function textPrimitive({ id, role = "text", frame, text, runs, style = {}, data = {}, tokens = [] }) {
  const value = String(text ?? "");
  if (runs !== undefined && (!Array.isArray(runs) || !runs.length || runs.some(run => !run || typeof run.text !== 'string' || typeof run.bold !== 'boolean' || (run.accent !== undefined && typeof run.accent !== 'boolean') || Object.keys(run).some(key => !['text', 'bold', 'accent'].includes(key))) || runs.map(run => run.text).join('') !== value)) throw new Error('Measured text runs must reconstruct the exact text and may vary only bold and accent');
  const node = primitive({ type: "text", id, role, frame, text: value, style, data, tokens });
  return runs === undefined ? node : { ...node, runs: runs.map(run => ({ ...run })) };
}

export function rectPrimitive({ id, role = "surface", frame, style = {}, data = {}, tokens = [] }) {
  return primitive({ type: "rect", id, role, frame, style, data, tokens });
}

export function ellipsePrimitive({ id, role = "marker", frame, style = {}, data = {}, tokens = [] }) {
  return primitive({ type: "ellipse", id, role, frame, style, data, tokens });
}

export function portraitPrimitive({ id, frame, portrait, data = {} }) {
  if (!portrait || typeof portrait.dataUri !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(portrait.dataUri)) throw new Error("Portrait requires an embedded PNG data URI");
  if (typeof portrait.alt !== "string" || !portrait.alt.trim() || typeof portrait.authorization !== "string" || !portrait.authorization.trim()) throw new Error("Portrait requires alt text and an asset authorization record");
  const bytes = Buffer.from(portrait.dataUri.split(",")[1], "base64");
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.readUInt32BE(16) < 1 || bytes.readUInt32BE(16) !== bytes.readUInt32BE(20)) throw new Error("Portrait PNG must be square; crop the authorized source before embedding");
  return primitive({ type: "image", id, role: "quote-avatar", frame, data: { ...data, ...portrait, circular: true } });
}

export function linePrimitive({ id, role = "rule", x1, y1, x2, y2, style = {}, data = {}, tokens = [] }) {
  return primitive({
    type: "line",
    id,
    role,
    frame: { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) },
    style,
    data: { ...data, x1: px(x1), y1: px(y1), x2: px(x2), y2: px(y2) },
    tokens
  });
}

export function wedgePrimitive({ id, role = "segment", frame, startAngle, endAngle, style = {}, data = {}, tokens = [] }) {
  return primitive({ type: "wedge", id, role, frame, style, data: { ...data, startAngle, endAngle }, tokens });
}

export function shapePrimitive({ id, role = "shape", geometry = "rect", frame, style = {}, data = {}, tokens = [] }) {
  return primitive({ type: "shape", id, role, frame, style, data: { ...data, geometry }, tokens });
}

export const FLOW_LEFTOVER_POLICIES = Object.freeze(["start", "distribute", "center", "end", "spread"]);

/**
 * `leftover` names what happens to main-axis space no child claimed. Every child
 * hugging its content leaves `fractionTotal === 0`, so without a policy the
 * remainder is silently abandoned at the far end of the frame. "start" packs and
 * "end" packs at the far end; "center" keeps the blocks one group at their own
 * gaps in the middle of the frame, with the free length split either side - what
 * a slide's body takes, so a short column is a group with air above and below it
 * rather than a stack over an empty foot. "spread" is what a column of a page's
 * grid takes: the gaps open evenly as far as the page's loosest (`space.loose`)
 * and what is still left sits above and below the group, so a list is neither
 * left tight in a tall column nor stretched edge to edge. "distribute" pins the
 * first and last blocks to the two ends and shares everything between them.
 */
export function flow({ id, direction = "row", gap = token("space.4"), padding = 0, size = {}, cell = null, frame = null, children = [], leftover = "start" }) {
  if (!FLOW_LEFTOVER_POLICIES.includes(leftover)) throw new Error(`${id}.leftover must be one of ${FLOW_LEFTOVER_POLICIES.join(", ")}`);
  return { nodeType: "flow", id, direction, gap, padding, size, cell, frame, children, leftover };
}

/** Several ways of realising the same content, each `{ label, node }`: the engine draws the one that reads best where it lands (tasteful-layout), or the one a judge chose. */
export function choice({ id, kind = null, options }) {
  if (!Array.isArray(options) || !options.length) throw new Error(`${id}: a choice offers one or more options`);
  // Outside a flow the engine arranges, a choice stands as its first option, in that option's cell and at its size.
  return { nodeType: "choice", id, kind, options, cell: options[0].node.cell ?? null, size: options[0].node.size };
}

export function grid({ id, columns, rows, columnGap = token("space.4"), rowGap = token("space.4"), padding = 0, size = {}, cell = null, frame = null, children = [] }) {
  return { nodeType: "grid", id, columns, rows, columnGap, rowGap, padding, size, cell, frame, children };
}

export function overlay({ id, padding = 0, size = {}, cell = null, frame = null, children = [] }) {
  return { nodeType: "overlay", id, padding, size, cell, frame, children };
}

export function absolute({ id, size = {}, cell = null, frame = null, children = [] }) {
  return { nodeType: "absolute", id, size, cell, frame, children };
}

export function component({ id, component: componentId, props = {}, size = {}, cell = null, frame = null, role = null }) {
  return { nodeType: "component", id, component: componentId, props, size, cell, frame, role };
}

export function assertSectionHeadingProps(props = {}) {
  if (Object.hasOwn(props, "subtitle")) throw new Error("Section headings do not support subtitle metadata; use heading text only");
}

export function section(options) {
  assertSectionHeadingProps(options);
  // Open sections keep the grid's left and right edges; boxed sections pad inward.
  const { id, treatment = "open", edge = "contained", heading = null, headingRule, padding = treatment === "open" ? 0 : token("space.4"), children = [], composition = null, size = {}, cell = null, frame = null } = options;
  return { nodeType: "section", id, treatment, edge, heading, headingRule, padding, children, composition, size, cell, frame };
}

function placementProps(node) {
  if (node.nodeType !== "section") return node.props || {};
  assertSectionHeadingProps(node);
  return { treatment: node.treatment, edge: node.edge, heading: node.heading,
           ...(node.headingRule === false ? { headingRule: false } : {}),
           padding: node.padding, headerBandHeight: node.headerBandHeight };
}

// Shared heading baselines consume real height. Measure that shared band before
// allocating hugged peers, rather than growing it only after their frames lock.
function alignPeerHeaders(children, widths, registry, group = () => 0) {
  const headers = children.map((node, index) => registry.get(node.nodeType === "section" ? "section" : node.component)?.measureHeader?.({
    frame: { x: 0, y: 0, width: widths[index], height: 0 }, props: placementProps(node)
  }));
  return children.map((node, index) => {
    const own = headers[index];
    // A heading band is shared by every peer that starts where this one does,
    // whether or not it inks a rule. A panel on a ground does its separating
    // with the ground and draws no rule; that is a decision about what is
    // drawn, not about the band: out of it, a heading that wraps beside the
    // panel would leave the two panels' contents on different lines.
    if (!own) return node;
    const peers = headers.filter((header, i) => header && group(children[i]) === group(node) && Math.abs(header.top - own.top) < 0.01);
    const headerBandHeight = Math.max(own.height, ...peers.map(header => header.height));
    return node.nodeType === "section" ? { ...node, headerBandHeight } : { ...node, props: { ...node.props, headerBandHeight } };
  });
}

/** Whether a component draws to whatever frame it is given (`sizing: "fill"` on its definition) rather than having a size of its own. */
const fillsFrame = (definition) => definition?.sizing === "fill";
const PROBE_HEIGHT = 1400;
const renderMeasurements = new Map();
function measureByRender(node, definition, width) {
  if (!definition?.render || fillsFrame(definition)) {
    // scale the sample size with the width so a half-width chart is not as tall as a full one
    const size = definition?.preferredSize;
    if (size?.width && size?.height && fillsFrame(definition) && width) return Math.round(Math.min(size.height, size.height * (width / size.width) * 1.1));
    return null;
  }
  const key = hashJson({ id: definition.id, width, props: node.props, tokens: activeDesignTokens() ? Object.keys(activeDesignTokens()).length : 0 });
  if (renderMeasurements.has(key)) return renderMeasurements.get(key);
  let height = null;
  try {
    const rendered = definition.render({ id: `probe:${node.id}`, frame: { x: 0, y: 0, width, height: PROBE_HEIGHT }, props: node.props });
    const nodes = rendered?.nodes || [];
    if (nodes.length) {
      const bottom = Math.max(...nodes.map((n) => (n.frame?.y ?? 0) + (n.frame?.height ?? 0)));
      // a component that stretched a surface to the whole probe is a frame-filler
      height = bottom >= PROBE_HEIGHT * 0.9 ? null : Math.ceil(bottom);
    }
  } catch { height = null; }
  renderMeasurements.set(key, height);
  return height;
}

// The box a placed component or section was given, by its composition node.
const LAYOUT_BOXES = new WeakMap();
const layoutBoxOf = (node) => LAYOUT_BOXES.get(node) ?? null;

/** A track as written, in CSS grid's vocabulary: `1.5fr`, `auto` (hug), `240px`, `40%`. */
function trackTemplate(spec) {
  if (typeof spec === "number") return `${px(spec)}px`;
  if (isTokenReference(spec)) return `${px(tokenValue(spec))}px`;
  if (spec === "hug") return "auto";
  if (spec && typeof spec === "object" && typeof spec.percent === "number") return `${px(spec.percent * 100)}%`;
  return `${fraction(spec)}fr`;
}

/**
 * One box of the scene's layout tree. Every container is a grid - a row is a
 * grid of columns, a column a grid of rows, a stack one shared cell - so one
 * vocabulary describes the page to every emitter: tracks, gaps, padding and
 * the cell (`area`) each child sits in. The frames are the resolved ones the
 * primitives were drawn to; the HTML emitter writes the tree as CSS grid and
 * the PowerPoint emitter reads the same frames.
 */
function layoutBox(layout, parent, box) {
  const clean = Object.fromEntries(Object.entries(box).filter(([, value]) => value !== null && value !== undefined));
  clean.frame = pxFrame(clean.frame);
  if (parent) (parent.children ??= []).push(clean);
  else layout.root = clean;
  return clean;
}

// ---------------------------------------------------------------------------
// Layout: the composition tree solved by Taffy (vendor/taffy-layout), a CSS grid
// and flexbox engine. Every container is written to it as a CSS grid - a row is
// a grid of columns, a column a grid of rows, a stack one shared cell - so the
// track sizing, the spans and the alignment are the standard's own, and a
// template an author writes in CSS grid's words means what it means in a
// browser. What is this runtime's and not CSS's stays here, around the solve:
// how tall a component is at a width (its own measure), heading bands shared by
// the peers of a row, the ceiling a component grows to, where a column's free
// height goes (a flow's `leftover`), and the refusals that say by how much content
// overruns its frame.
// ---------------------------------------------------------------------------

const FIXED = (value) => ({ min: value, max: value });
const FRACTION = (value) => ({ min: 0, max: `${value}fr` });
const CONTENT = Object.freeze({ min: "auto", max: "auto" });
const NO_PADDING = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });
const lengthOf = (spec) => (typeof spec === "number" ? spec : isTokenReference(spec) ? Number(tokenValue(spec)) : null);
const percentOf = (spec) => (spec && typeof spec === "object" && typeof spec.percent === "number" ? `${spec.percent * 100}%` : null);

/** How much of a container's free length a size takes: 1 for "fill" (or none written), `fr` for `{ fr }`, 0 for a fixed or hugged one. */
function fraction(value) {
  if (value === "fill" || value === undefined || value === null) return 1;
  if (typeof value === "object" && typeof value.fr === "number") return value.fr;
  return 0;
}

/**
 * A size as a grid track: a number or a token is fixed, "hug" is the content's
 * own size (CSS `auto`), "fill" and `{ fr }` share what is left (`minmax(0, Nfr)`,
 * or `minmax(min, Nfr)` for `{ min, fr }`). In a container whose own length is
 * its content's (`definite` false), a sharing track is its content's too.
 */
function gridTrack(spec, definite) {
  const fixed = lengthOf(spec);
  if (fixed !== null) return FIXED(fixed);
  if (spec === "hug" || !definite) return CONTENT;
  if (percentOf(spec)) return FIXED(percentOf(spec));
  return Number.isFinite(spec?.min) ? { min: spec.min, max: `${fraction(spec)}fr` } : FRACTION(fraction(spec));
}

let naturalHeights = new WeakMap();
/** How tall a node is at `width` when nothing but its content sizes it. */
function naturalHeight(node, registry, width) {
  if (node.nodeType === "choice") return naturalHeight(node.options[0].node, registry, width);
  let known = naturalHeights.get(node);
  if (!known) naturalHeights.set(node, known = new Map());
  if (!known.has(width)) known.set(width, node.nodeType === "component" ? componentHeight(node, registry, width)
    : node.nodeType === "section" ? sectionHeight(node, registry, width)
    : solve(node, { x: 0, y: 0, width, height: null }, registry).height);
  return known.get(width);
}

function componentHeight(node, registry, width) {
  const definition = registry.get(node.component);
  const measure = definition?.measureIntrinsic ?? definition?.measureContent;
  let measured;
  try {
    measured = measure?.({ frame: { x: 0, y: 0, width }, props: node.props });
  } catch (error) {
    throw new Error(`Cannot measure ${node.id} (${node.component}) at ${width}px wide: ${error.message}`, { cause: error });
  }
  if (measured?.height !== undefined) {
    if (!Number.isFinite(measured.height) || measured.height < 0) throw new Error(`Invalid intrinsic height for ${node.id}`);
    return measured.height;
  }
  // Components that draw to a frame are measured by rendering them once at this
  // width into a tall probe and taking the ink extent; ones that scale to whatever
  // frame they get (charts, images, dividers) keep their declared size.
  return measureByRender(node, definition, width) ?? (definition?.preferredSize?.height || 0);
}

const sectionContent = (node) => node.composition || (node.children?.length ? flow({ id: `${node.id}-intrinsic`, direction: "column", gap: token("space.3"), children: node.children }) : null);

function sectionHeight(node, registry, width) {
  const padding = normalizeInsets(node.padding), nested = sectionContent(node);
  const content = nested ? naturalHeight(nested, registry, width - padding.left - padding.right) : 0;
  const insets = registry.get("section")?.measureInsets?.({ frame: { x: 0, y: 0, width }, props: node });
  return insets ? content + insets.top + insets.bottom : content + padding.top + padding.bottom + (node.heading ? 46 : 0);
}

/** How wide a node is when nothing but its content sizes it: a component's declared width, a container's content. */
function naturalWidth(node, registry) {
  if (node.nodeType === "choice") return naturalWidth(node.options[0].node, registry);
  if (node.nodeType === "component") return registry.get(node.component)?.preferredSize?.width || 0;
  if (node.nodeType !== "section") return solve(node, { x: 0, y: 0, width: null, height: null }, registry).width;
  const padding = normalizeInsets(node.padding), nested = sectionContent(node);
  return (nested ? naturalWidth(nested, registry) : 0) + padding.left + padding.right;
}

/**
 * The most height a node can use at this width, or null when it can use any.
 *
 * A component with a natural height - a table, a wave roadmap, a row of cards,
 * a gantt - drawn at its size at the top of a `fill` frame leaves the rest as a
 * band between the exhibit and the commentary under it; stretching the drawing
 * to the frame is worse - table rows at 2.5x. So a component that knows how far
 * it can grow legibly says so (`measureCeiling`), the column gives it that
 * much, and the slack is the column's free height, placed like any other (the
 * group in the middle, air above and below) rather than a gap in the middle of
 * the reading. A section or a flow carries a ceiling only when
 * something inside it declared one; a flow that places its own free height, or
 * a toned panel whose surface is drawn to its frame, uses whatever it is given.
 */
function ceilingOf(node, registry, width, available) {
  if (!Number.isFinite(width) || !Number.isFinite(available)) return null;
  if (node.nodeType === "component") {
    const definition = registry.get(node.component);
    if (!definition?.measureCeiling) return null;
    try {
      const ceiling = definition.measureCeiling({ frame: { x: 0, y: 0, width, height: available }, props: node.props });
      return Number.isFinite(ceiling) && ceiling > 0 ? { value: ceiling, bounded: true } : null;
    } catch {
      return null;
    }
  }
  if (node.nodeType === "section") {
    // A section set as its own group in whatever frame it is given (`placeSection`) needs that group's height and no more.
    if (standsAsGroup(node, registry)) return { value: groupHeight(node, registry, width, available), bounded: false };
    if (!node.composition || (node.treatment && node.treatment !== "open")) return null;
    const insets = registry.get("section")?.measureInsets?.({ frame: { x: 0, y: 0, width }, props: node }) ?? normalizeInsets(node.padding);
    const inner = ceilingOf(node.composition, registry, width - insets.left - insets.right, available - insets.top - insets.bottom);
    return inner && { value: inner.value + insets.top + insets.bottom, bounded: inner.bounded };
  }
  if (node.nodeType === "grid") {
    // A grid's rows are a column of rows, each as tall as the tallest of its cells: a cell as tall as its content
    // (a `hug` row, or a block that says where it sits, `alignSelf`) at its own height, any other at its ceiling.
    // A cell over several rows has no one row to size, so a grid with one uses whatever it is given.
    if (!node.children.length || node.children.some((child) => (child.cell?.rowSpan ?? 1) > 1 && node.rows.length > 1)) return null;
    const padding = normalizeInsets(node.padding), rowGap = lengthOf(node.rowGap) ?? Number(node.rowGap || 0);
    const widths = solve(node, { x: 0, y: 0, width, height: null }, registry).children.map((child) => child.width);
    let bounded = false;
    const heights = node.rows.map((spec) => lengthOf(spec) ?? 0);
    for (const [index, child] of node.children.entries()) {
      const at = child.cell?.row ?? 0;
      if (lengthOf(node.rows[at]) !== null) continue;
      const inner = node.rows[at] === "hug" || child.alignSelf !== undefined ? { value: naturalHeight(child, registry, widths[index]) } : ceilingOf(child, registry, widths[index], available - padding.top - padding.bottom);
      if (!inner) return null;
      bounded ||= Boolean(inner.bounded);
      heights[at] = Math.max(heights[at], inner.value);
    }
    return { value: heights.reduce((sum, value) => sum + value, 0) + Math.max(0, heights.length - 1) * rowGap + padding.top + padding.bottom, bounded };
  }
  if (node.nodeType !== "flow" || !node.children.length || (node.leftover && node.leftover !== "start")) return null;
  const padding = normalizeInsets(node.padding), row = node.direction === "row";
  const innerWidth = width - padding.left - padding.right, innerHeight = available - padding.top - padding.bottom;
  const gap = lengthOf(node.gap) ?? Number(node.gap || 0);
  const widths = row ? solve(node, { x: 0, y: 0, width, height: null }, registry).children.map((child) => child.width)
    : node.children.map((child) => lengthOf(child.size?.width) ?? (child.size?.width === "hug" ? naturalWidth(child, registry) : innerWidth));
  let bounded = false;
  const heights = [];
  for (const [index, child] of node.children.entries()) {
    const spec = child.size?.height;
    // A child's height: its fixed or hugged length, else its own ceiling.
    let value = lengthOf(spec) ?? (spec === "hug" ? naturalHeight(child, registry, widths[index]) : null);
    if (value === null) {
      const inner = ceilingOf(child, registry, widths[index], innerHeight);
      if (!inner) return null;
      bounded ||= inner.bounded;
      value = inner.value;
    }
    heights.push(value);
  }
  const content = row ? Math.max(0, ...heights) : heights.reduce((sum, value) => sum + value, 0) + Math.max(0, heights.length - 1) * gap;
  return { value: content + padding.top + padding.bottom, bounded };
}

/** How far a node's ink runs at a width: a component's own natural width where it has one narrower than the width; else the width. */
function inkWidth(node, registry, width) {
  if (node.nodeType !== "component") return width;
  // A component that cannot say how wide it is on its own inks the width it is given: the estimate is for scoring, and the solve raises what is wrong.
  try { const natural = naturalWidth(node, registry); return Number.isFinite(natural) && natural > 0 ? Math.min(width, natural) : width; } catch { return width; }
}

/**
 * How far a node gets with what it is there to make large (a display figure's size against the largest it could be), at
 * a width; null where it holds no such thing. A component says so itself (`emphasis` on its definition); a container
 * passes on its children's, each at its own share of the width.
 */
function emphasisOf(node, registry, width) {
  if (node.nodeType === "component") return registry.get(node.component).emphasis?.({ props: node.props, width }) ?? null;
  if (node.nodeType === "choice") return emphasisOf(node.options[0].node, registry, width);
  if (node.nodeType === "section") return node.composition ? emphasisOf(node.composition, registry, width) : null;
  const shares = node.nodeType === "grid" ? node.columns : node.direction === "row" ? node.children.map((child) => child.size?.width) : null;
  const total = shares ? shares.reduce((sum, share) => sum + (fraction(share) || 0), 0) : 0;
  const found = (node.children || []).map((child, at) => emphasisOf(child, registry, shares && total ? width * (fraction(shares[node.nodeType === "grid" ? child.cell?.column ?? at : at]) || 0) / total : width)).filter((value) => value !== null);
  return found.length ? Math.max(...found) : null;
}

/** Whether a node is read from its head: a component that says so (`anchor: "top"`), or a section or flow holding one. */
function anchorsTop(node, registry) {
  if (node.nodeType === "component") return registry.get(node.component).anchor === "top";
  return [...(node.children || []), ...(node.composition ? [node.composition] : [])].some((inside) => anchorsTop(inside, registry));
}

/** Whether a node chooses its own arrangement: a flow left to (`direction: "best"`), or a section around one. */
const arrangesItself = (node) => node.direction === "best" || (node.nodeType === "section" && Boolean(node.composition) && arrangesItself(node.composition));

/**
 * A judge's choices (`{ <flow id>: <candidate label> }`, a page's `choices`) written onto the flows they name, so a
 * flow is arranged one way wherever it is asked about - measured inside another, or placed. `refused` is the
 * candidates a flow may not take: the ones the page could not be drawn with; `taste`, how the page's density weighs
 * an arrangement; `recent`, how the deck's earlier pages last set each kind of content, for the page to differ from.
 */
function hold(node, choices, refused, taste, recent) {
  if (node.direction === "best") Object.assign(node, { held: choices[node.id], refused: refused[node.id], taste, recent });
  for (const inside of [...(node.children || []), ...(node.composition ? [node.composition] : []), ...(node.options || []).map((option) => option.node)]) hold(inside, choices, refused, taste, recent);
}

/** Whether a node draws to whatever frame it is given: a fill component, or a section or flow holding one in a track that fills. */
function fillsNode(node, registry) {
  if (node.nodeType === "choice") return fillsNode(node.options[0].node, registry);
  if (node.nodeType === "component") return fillsFrame(registry.get(node.component));
  const inside = node.nodeType === "section" ? (node.composition ? [node.composition] : node.children || []) : node.children || [];
  return inside.some((child) => fillsNode(child, registry));
}

/** Whether a section is as tall as its own blocks, set as one group in the frame it is given: a column of blocks whose free height is spread, none of them drawn to its frame. */
const standsAsGroup = (node, registry) => node.composition?.nodeType === "flow" && node.composition.leftover === "spread" && node.composition.direction !== "row" && !fillsNode(node, registry);

/** How much of `available` such a section takes: its blocks at their own heights, the gaps between them opened evenly as far as the page's loosest (`space.loose`). */
function groupHeight(node, registry, width, available) {
  const natural = sectionHeight(node, registry, width), inner = node.composition, between = Math.max(0, inner.children.length - 1), gap = lengthOf(inner.gap) ?? Number(inner.gap || 0);
  return natural + (between ? Math.max(0, Math.min((available - natural) / between, tokenValue(token("space.loose")) - gap)) * between : 0);
}

/**
 * A flow as the arrangement tasteful-layout chose for it: a stack, a row, equal columns, or its first block beside the
 * rest. Side by side, a block that fills takes the row's height and so does a section, which sets its own blocks as one
 * group in the middle of it; stacked, a block that fills takes the height the others leave.
 */
function arrangedFlow(node, choice, registry) {
  const tall = (child, beside) => (fillsNode(child, registry) || (beside && child.nodeType === "section") ? "fill" : "hug");
  const sized = (child, width, beside = true) => ({ ...child, size: { width, height: tall(child, beside) } });
  const base = { id: node.id, gap: node.gap, padding: node.padding, size: node.size, cell: node.cell, frame: node.frame };
  const { children } = node;
  if (choice.kind === "column") return flow({ ...base, direction: "column", children: children.map((child) => sized(child, child.size?.width ?? { fr: 1 }, false)), leftover: node.leftover });
  if (choice.kind === "row") return flow({ ...base, direction: "row", children: children.map((child, at) => sized(child, { fr: choice.shares[at] })) });
  if (choice.kind === "lead") return flow({ ...base, direction: "row", children: [sized(children[0], { fr: choice.share }),
    flow({ id: `${node.id}-rest`, direction: "column", gap: node.gap, leftover: "center", size: { width: { fr: 1 }, height: "fill" }, children: children.slice(1) })] });
  return grid({ ...base, columns: Array.from({ length: choice.columns }, () => ({ fr: 1 })), rows: Array.from({ length: Math.ceil(children.length / choice.columns) }, () => "hug"), columnGap: node.gap, rowGap: node.gap,
    children: children.map((child, at) => ({ ...child, cell: { column: at % choice.columns, row: Math.floor(at / choice.columns) } })) });
}

/**
 * Resolve a composition into the frames of its components and sections.
 *
 * `frame` is where the composition sits; a null `width` or `height` leaves that
 * length to the content, which is how a node's natural size is asked for.
 * Returns the placements in reading order, the composition's own size and its
 * children's. `layout`, when a caller passes one, receives the resolved tree as
 * `layout.root` (see `layoutBox`): what the scene keeps of the structure the
 * frames came from. `inRow`: the composition sits in a row of peers, which
 * share one height and their bottom blocks one line, so a column there keeps
 * every pixel it is given - ceilings apply only to the page's own vertical
 * reading. `fitted`: the frame's height is the composition's own content's, so it does not bound how the
 * composition may be arranged - a taller way to set it is still a candidate, and whoever sized the frame measures it
 * the same way.
 */
function solve(root, frame, registry, { inRow = false, layout = null, arranged = new Map(), decisions = null, fitted = false } = {}) {
  const tree = new TaffyTree();
  tree.disableRounding();
  let failure = null;
  const node = (style, children, context) => {
    const made = new Style(style);
    try { return children ? tree.newWithChildren(made, children) : tree.newLeafWithContext(made, context); } finally { made.free(); }
  };
  const restyle = (m) => { const made = new Style(m.style); try { tree.setStyle(m.t, made); } finally { made.free(); } };
  const cell = (column, row, columnSpan = 1, rowSpan = 1) => ({ gridColumn: { start: column + 1, end: { span: columnSpan } }, gridRow: { start: row + 1, end: { span: rowSpan } } });

  /** One node as a Taffy node: `place` is how its parent sets it, `wide` and `tall` whether its width and height are given or its content's. */
  const build = (itemIn, place, wide, tall, withinRow) => {
    if (!itemIn || !itemIn.nodeType) throw new Error("Every composition node requires nodeType");
    // A flow left to arrange itself (`direction: "best"`) stands as a stack until its frame is known, then as the arrangement chosen for it.
    if (itemIn.nodeType === "choice") return build(itemIn.options[0].node, place, wide, tall, withinRow);
    const open = itemIn.nodeType === "flow" && itemIn.direction === "best";
    const item = open ? arranged.get(itemIn) ?? { ...itemIn, direction: "column", children: itemIn.children.map((child) => (child.nodeType === "choice" ? child.options[0].node : child)) } : itemIn;
    if (open && !arranged.has(itemIn)) { const stood = build(item, place, wide, tall, withinRow); stood.arrange = itemIn; return stood; }
    const m = { node: item, sizing: item, withinRow, wide, tall };
    if (item.nodeType === "component" || item.nodeType === "section") { m.t = node(place, null, m); return m; }
    const kind = item.nodeType === "flow" ? item.direction : item.nodeType;
    if (item.nodeType === "flow" && !["row", "column"].includes(kind)) throw new Error(`Unsupported flow direction: ${item.direction}`);
    if (!["row", "column", "grid", "overlay", "absolute"].includes(kind)) throw new Error(`Unsupported composition node type: ${item.nodeType}`);
    const padding = kind === "absolute" ? NO_PADDING : normalizeInsets(item.padding);
    const gap = lengthOf(item.gap) ?? Number(item.gap || 0);
    Object.assign(m, { kind, padding, gap });
    const sized = (spec, axis, start) => (lengthOf(spec) !== null ? { [axis]: lengthOf(spec), ...start } : spec === "hug" ? start : {});
    const given = (spec, definite) => definite && spec !== "hug";
    if (kind === "row") {
      m.specs = item.children.map((child) => child.size?.width);
      m.tracks = { gridTemplateColumns: m.specs.map((spec) => gridTrack(spec, wide)), gridTemplateRows: [tall ? FRACTION(1) : CONTENT], gap: { width: gap, height: 0 } };
      m.children = item.children.map((child, index) => { const high = sized(child.size?.height, "height", { alignSelf: AlignSelf.Start });
        return build(child, { ...cell(index, 0), ...high }, given(m.specs[index], wide), given(child.size?.height, tall), true); });
    } else if (kind === "column") {
      m.specs = item.children.map((child) => child.size?.height);
      m.tracks = { gridTemplateColumns: [wide ? FRACTION(1) : CONTENT], gridTemplateRows: m.specs.map((spec) => gridTrack(spec, tall)), gap: { width: 0, height: gap } };
      m.children = item.children.map((child, index) => { const across = sized(child.size?.width, "width", { justifySelf: AlignSelf.Start });
        return build(child, { ...cell(0, index), ...across }, given(child.size?.width, wide), given(m.specs[index], tall), withinRow); });
    } else if (kind === "grid") {
      const columnGap = lengthOf(item.columnGap) ?? Number(item.columnGap || 0), rowGap = lengthOf(item.rowGap) ?? Number(item.rowGap || 0);
      Object.assign(m, { columnGap, rowGap });
      m.tracks = { gridTemplateColumns: item.columns.map((spec) => gridTrack(spec, wide)), gridTemplateRows: item.rows.map((spec) => gridTrack(spec, tall)), gap: { width: columnGap, height: rowGap } };
      m.children = item.children.map((child) => {
        const { column = 0, row = 0, columnSpan = 1, rowSpan = 1 } = child.cell || {};
        if (columnSpan < 1 || rowSpan < 1 || column < 0 || row < 0 || column + columnSpan > item.columns.length || row + rowSpan > item.rows.length) throw new Error(`Grid child ${child.id} has an invalid cell`);
        // A cell's length is given when the grid's is and no track it spans is its content's.
        const spans = (specs, from, count, definite) => definite && specs.slice(from, from + count).every((spec) => spec !== "hug");
        // A child that says where it sits in its cell (`alignSelf`: "start" or "center") is as tall as its content there; any other takes the cell's height.
        const hugs = child.alignSelf !== undefined;
        return Object.assign(build(child, { ...cell(column, row, columnSpan, rowSpan), ...(hugs ? { alignSelf: child.alignSelf === "center" ? AlignSelf.Center : AlignSelf.Start } : {}) },
          spans(item.columns, column, columnSpan, wide), !hugs && spans(item.rows, row, rowSpan, tall), true), { area: { column, row, columnSpan, rowSpan, ...(child.alignSelf === "center" ? { self: "center" } : {}) } });
      });
    } else {
      // A stack's layers share one cell; a layer with a frame of its own, and every child of an absolute node, is set at that frame.
      m.tracks = { gridTemplateColumns: [wide ? FRACTION(1) : CONTENT], gridTemplateRows: [tall ? FRACTION(1) : CONTENT] };
      m.children = item.children.map((child) => {
        if (kind === "absolute" && !child.frame) throw new Error(`Absolute child ${child.id} requires a frame`);
        const at = child.frame ? { position: Position.Absolute, inset: { left: padding.left + child.frame.x, top: padding.top + child.frame.y, right: "auto", bottom: "auto" }, size: { width: child.frame.width, height: child.frame.height } } : cell(0, 0);
        return build(child, at, true, true, withinRow);
      });
      // Set at their own frames, the children size nothing: a node left to its content is as large as they reach.
      const reach = (axis, from, lead) => Math.max(0, ...item.children.filter((child) => child.frame).map((child) => child.frame[from] + child.frame[axis])) + lead;
      m.reach = { width: wide ? "auto" : reach("width", "x", padding.left + padding.right), height: tall ? "auto" : reach("height", "y", padding.top + padding.bottom) };
    }
    const { width, height, ...placed } = place;
    m.style = { display: Display.Grid, alignContent: AlignContent.Start, justifyContent: AlignContent.Start, padding, ...m.tracks, ...placed,
      size: { width: width ?? place.size?.width ?? "auto", height: height ?? place.size?.height ?? "auto" }, ...(m.reach ? { minSize: m.reach } : {}) };
    m.t = node(m.style, m.children.map((child) => child.t));
    return m;
  };

  const measure = (known, available, _id, m, style) => {
    style.free();
    if (!m) return { width: known.width ?? 0, height: known.height ?? 0 };
    try {
      // A node that takes its track's width is measured at it; one that hugs is as wide as its content.
      const width = known.width ?? (m.wide && typeof available.width === "number" ? available.width : naturalWidth(m.sizing, registry));
      // One whose height its parent gives is not asked for its own: a component in a fill track need not know how to measure itself.
      return { width, height: known.height ?? (m.tall ? 0 : naturalHeight(m.sizing, registry, width)) };
    } catch (error) {
      // An error cannot cross the engine: it is kept, and thrown once the solve returns.
      failure ??= error;
      return { width: known.width ?? 0, height: known.height ?? 0 };
    }
  };
  const compute = () => {
    tree.computeLayoutWithMeasure(top.t, { width: frame.width ?? "max-content", height: frame.height ?? "max-content" }, measure);
    if (failure) throw failure;
  };
  const read = (m) => { const at = tree.getLayout(m.t); try { return { x: at.x, y: at.y, width: at.width, height: at.height }; } finally { at.free(); } };
  const each = (m, visit) => { visit(m); (m.children || []).forEach((child) => each(child, visit)); };

  const sizeOf = (place, axis) => (place.size?.[axis] ?? "auto");
  let top;
  try {
    const leafPlace = { size: { width: frame.width ?? "auto", height: frame.height ?? "auto" } };
    top = build(root, root.nodeType === "component" || root.nodeType === "section" ? leafPlace : { width: sizeOf(leafPlace, "width"), height: sizeOf(leafPlace, "height") }, frame.width !== null, frame.height !== null, inRow);
    compute();

    // A flow left to arrange itself is arranged now its frame is known (tasteful-layout: every arrangement that keeps the
    // reading order is laid out and scored, and the best one stands), and the composition is solved again with it.
    // The outermost first: what a flow inside one is given depends on how the one around it was arranged, so it is arranged on the solve after.
    let chose = false;
    const outermost = (m, visit) => (m.arrange ? visit(m) : (m.children || []).forEach((child) => outermost(child, visit)));
    outermost(top, (m) => {
      // A block is its node, whether it fills, and the widths it reads at: its component's own (`reads`), or what its composer said of it (`hints`). A choice is its options, each a block.
      // A block that arranges itself reads at any width: its own blocks carry what a width costs them.
      const blockOf = (child) => ({ id: child.id, node: child, ...(fillsNode(child, registry) ? { sizing: "fill" } : {}), ...(child.nodeType === "section" ? { major: true } : {}), ...(child.nodeType === "component" ? registry.get(child.component).reads : arrangesItself(child) ? { maxWidth: Infinity } : null), ...(child.hints || {}) });
      const at = read(m), blocks = m.arrange.children.map((child) => (child.nodeType === "choice" ? { id: child.id, ...(child.kind ? { kind: child.kind } : {}), options: child.options.map((option) => ({ ...blockOf(option.node), label: option.label, ...(option.family ? { family: option.family } : {}) })) } : blockOf(child)));
      const best = arrange({ id: m.arrange.id, blocks, ...(m.arrange.rhythm ? {} : { gap: m.gap }) }, { width: at.width - m.padding.left - m.padding.right, height: m.tall && !(fitted && m === top) ? at.height - m.padding.top - m.padding.bottom : null },
        // A block that cannot be measured at a width (its component refuses it) rules out the arrangements that set it there, not the page.
        (block, width) => { try { return naturalHeight(block.node, registry, width); } catch { return NaN; } }, tastePresets(m.arrange.taste), { extent: (block, width) => inkWidth(block.node, registry, width), emphasis: (block, width) => emphasisOf(block.node, registry, width), recent: m.arrange.recent, ...(m.arrange.held ? { choices: { [m.arrange.id]: m.arrange.held } } : {}), ...(m.arrange.refused ? { refused: { [m.arrange.id]: m.arrange.refused } } : {}) });
      // What was chosen and what it was chosen over, for whoever judges the page (`decisions`): the candidates a judge could have instead, best first.
      const open = best.scores.filter((entry) => Number.isFinite(entry.total));
      if (decisions && (open.length > 1 || m.arrange.held)) decisions.push({ id: m.arrange.id, chosen: best.label, ...(m.arrange.held === best.label ? { held: true } : {}), ...(Object.keys(best.families).length ? { families: best.families } : {}),
        candidates: open.slice(0, 6).map(({ label, total, kind: _kind, shares: _shares, columns: _columns, share: _share, picks: _picks, ...measures }) => ({ label, score: px(total), ...Object.fromEntries(Object.entries(measures).map(([name, value]) => [name, px(value)])) })) });
      const taken = { ...m.arrange, gap: best.gap, children: m.arrange.children.map((child) => (child.nodeType === "choice" ? child.options.find((option) => option.label === best.picks[child.id]).node : child)) };
      arranged.set(m.arrange, arrangedFlow(taken, best, registry));
      chose = true;
    });
    if (chose) return solve(root, frame, registry, { inRow, layout, arranged, decisions, fitted });

    // Peers that share a top share a heading band: once the widths are known, each row's (and each grid row's) headed
    // peers are measured with the tallest band among them, and the solve runs again with what that changes.
    let again = false;
    each(top, (m) => {
      if (m.kind !== "row" && m.kind !== "grid") return;
      const widths = m.children.map((child) => read(child).width);
      const aligned = alignPeerHeaders(m.children.map((child) => child.node), widths, registry, m.kind === "grid" ? (child) => child.cell?.row ?? 0 : undefined);
      m.children.forEach((child, index) => {
        if (aligned[index] === child.node) return;
        child.sizing = aligned[index];
        // A row sets its peers as it measured them; a grid's cells are set as written (the page aligns their bands when it draws them).
        if (m.kind === "row") child.node = aligned[index];
        tree.markDirty(child.t);
        again = true;
      });
    });
    if (again) compute();

    // A column's fill tracks stop at their ceilings (`ceilingOf`): what a held track gives up goes to the fill tracks that
    // can still grow, and what nobody can take is free height, the column's to place.
    for (let pass = 0; pass < 8; pass += 1) {
      let held = false;
      each(top, (m) => {
        if (m.kind !== "column" || m.withinRow || !m.tall) return;
        m.children.forEach((child, index) => {
          if (m.held?.has(index) || fraction(m.specs[index]) <= 0 || lengthOf(m.specs[index]) !== null) return;
          const at = read(child);
          m.ceilings ??= new Map();
          if (!m.ceilings.has(index)) { const found = ceilingOf(child.sizing, registry, at.width, at.height); m.ceilings.set(index, found?.bounded ? found.value : null); }
          const ceiling = m.ceilings.get(index);
          if (ceiling === null || at.height <= ceiling + 0.01) return;
          (m.held ??= new Set()).add(index);
          m.style.gridTemplateRows = m.style.gridTemplateRows.map((track, at2) => (at2 === index ? FIXED(ceiling) : track));
          restyle(m);
          held = true;
        });
      });
      if (!held) break;
      compute();
    }

    const placements = [];
    /** A node's frame on the page, its children's after it: the free length placed, the refusals raised, the layout box recorded. */
    const emit = (m, origin, parent, area) => {
      const at = read(m);
      const placedAt = { x: origin.x + at.x, y: origin.y + at.y, width: at.width, height: at.height };
      if (!m.kind) {
        const placed = { node: m.node, frame: pxFrame(placedAt) };
        if (layout) LAYOUT_BOXES.set(m.node, layoutBox(layout, parent, { kind: m.node.nodeType, id: m.node.id, frame: placed.frame, area }));
        placements.push({ ...placed, ...(m.withinRow ? { inRow: true } : {}) });
        return;
      }
      const { node: item, kind, padding } = m;
      const inner = { x: placedAt.x + padding.left, y: placedAt.y + padding.top, width: Math.max(0, placedAt.width - padding.left - padding.right), height: Math.max(0, placedAt.height - padding.top - padding.bottom) };
      const frames = m.children.map(read);
      if (kind === "row" || kind === "column") {
        const row = kind === "row", main = row ? "width" : "height", cross = row ? "height" : "width";
        const lengths = frames.map((child) => child[main]), gaps = Math.max(0, lengths.length - 1) * m.gap;
        const definite = row ? m.wide : m.tall;
        // What the fixed and hugged tracks need is the author's to cut, so a column over its height says by how much, in lines of body text.
        const required = lengths.reduce((sum, length, index) => sum + (fraction(m.specs[index]) > 0 && !m.held?.has(index) ? 0 : length), 0), usable = Math.max(0, inner[main] - gaps);
        if (definite && required > usable + 0.01) {
          if (row) throw new Error(`Fixed and content-sized tracks require ${required}px; only ${usable}px is available`);
          const over = Math.ceil(required - usable), line = lineBox(activeDesignTokens()?.["type.body"]?.value ?? 12);
          throw new Error(`${String(item.id).replace(/-flow-(?:column|row)$/, "")}: the column holds ${Math.ceil(required)}px of content in ${Math.floor(usable)}px - over by ${over}px, about ${Math.ceil(over / line)} line${Math.ceil(over / line) === 1 ? "" : "s"} of body text (${line}px a line); cut that much from its points or labels, or move a point elsewhere`);
        }
        frames.forEach((child, index) => { if ((row ? m.tall : m.wide) && child[cross] > inner[cross] + 0.01) throw new Error(`Flow child ${item.children[index].id} exceeds its cross axis`); });
        // Space no child claimed. Abandoning it is what leaves a dead band below an all-hug body; the policy says where it
        // goes instead. What a ceiling returns is free height like any other: a block that stops short of the height it is
        // offered is part of the group, and the group is placed, not the block pinned to the top over an empty foot. Only a
        // column pinned to its two ends (`distribute`) keeps it at the foot, where it is a margin and not a gap in the reading.
        const claimed = lengths.reduce((sum, length) => sum + length, 0) + gaps;
        const leftover = definite ? Math.max(0, inner[main] - claimed) : 0;
        const policy = item.leftover || "start";
        // A block read from its head (a table) keeps the top where it stops short: a run of table pages shares one top line,
        // where centring each by its own height would move the header from page to page.
        const pinned = [...(m.held ?? [])].some((index) => anchorsTop(m.children[index].node, registry));
        const slack = (policy === "distribute" || pinned) && m.held?.size && !lengths.some((_, index) => fraction(m.specs[index]) > 0 && !m.held.has(index)) ? leftover : 0;
        // `spread`: the gaps open evenly as far as the page's loosest (`space.loose`), so points that divide the height
        // neatly run its length; what is left past that sits above and below the group, which stays one group.
        const free = Math.max(0, leftover - slack), between = lengths.length - 1;
        const extraGap = between < 1 ? 0 : policy === "distribute" ? free / between : policy === "spread" ? Math.min(free / between, Math.max(0, tokenValue(token("space.loose")) - m.gap)) : 0;
        // A near miss reads as a mistake: an exhibit that stops at its ceiling less than a major gap short of the top
        // starts at the top, as a section's group does (`placeSection`). Blocks centred in a small cell are aligned, not missed.
        const middle = policy === "center" ? free / 2 : policy === "spread" ? (free - extraGap * between) / 2 : 0;
        const lead = policy === "end" ? leftover : m.held?.size && middle <= tokenValue(token("space.major")) ? 0 : middle;
        const box = layout && layoutBox(layout, parent, { kind, id: item.id, frame: placedAt, area, padding,
          tracks: lengths.map(px), template: m.specs.map(trackTemplate), gap: px(m.gap + extraGap), baseGap: px(m.gap),
          content: lead && policy !== "end" ? "center" : policy === "end" ? "end" : "start", ...(policy === "distribute" ? { spread: true } : {}) });
        m.children.forEach((child, index) => {
          const shift = lead + index * extraGap;
          emit(child, { x: placedAt.x + (row ? shift : 0), y: placedAt.y + (row ? 0 : shift) }, box, row ? { column: index } : { row: index });
        });
        return;
      }
      if (kind === "grid") {
        const info = tree.detailedLayoutInfo(m.t);
        const widths = info.columns.sizes, heights = info.rows.sizes;
        for (const [axis, sizes, specs, room, gap] of [["width", widths, item.columns, inner.width, m.columnGap], ["height", heights, item.rows, inner.height, m.rowGap]]) {
          const required = sizes.reduce((sum, size, index) => sum + (fraction(specs[index]) > 0 ? 0 : size), 0), usable = Math.max(0, room - Math.max(0, sizes.length - 1) * gap);
          if ((axis === "width" ? m.wide : m.tall) && required > usable + 0.01) throw new Error(`Fixed and content-sized tracks require ${required}px; only ${usable}px is available`);
        }
        m.children.forEach((child) => { if (!widths[child.area.column] || !heights[child.area.row]) throw new Error(`Grid child ${child.node.id} has an invalid cell`); });
        const box = layout && layoutBox(layout, parent, { kind, id: item.id, frame: placedAt, area, padding,
          columns: widths.map(px), rows: heights.map(px), template: { columns: item.columns.map(trackTemplate), rows: item.rows.map(trackTemplate) }, columnGap: px(m.columnGap), rowGap: px(m.rowGap) });
        m.children.forEach((child) => emit(child, placedAt, box, child.area));
        return;
      }
      const within = kind === "absolute" ? placedAt : inner;
      for (const child of item.children) {
        if (child.frame && (child.frame.x < 0 || child.frame.y < 0 || child.frame.width < 0 || child.frame.height < 0 || child.frame.x + child.frame.width > within.width + 0.01 || child.frame.y + child.frame.height > within.height + 0.01)) {
          throw new Error(`${kind === "absolute" ? "Absolute" : "Overlay"} child ${child.id} exceeds its parent frame`);
        }
      }
      // Layers share one cell: a one-track grid whose children all sit in it.
      const box = layout && layoutBox(layout, parent, { kind: kind === "overlay" ? "stack" : kind, id: item.id, frame: placedAt, area, ...(kind === "overlay" ? { padding } : {}) });
      m.children.forEach((child) => emit(child, placedAt, box, null));
    };
    emit(top, { x: frame.x, y: frame.y }, null, null);
    const size = read(top);
    return { placements, width: size.width, height: size.height, children: (top.children || []).map(read) };
  } finally {
    tree.free();
  }
}

export function resolveLayout(root, frame, registry, options = {}) {
  return solve(root, frame, registry, options).placements;
}

export function assertNoLegacyPageTaxonomy(value, path = "root") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoLegacyPageTaxonomy(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase().includes("archetype")) throw new Error(`${path}.${key} uses deleted fixed-page taxonomy`);
    assertNoLegacyPageTaxonomy(child, `${path}.${key}`);
  }
}

export function assertUniqueIds(nodes) {
  const seen = new Set();
  for (const node of nodes) {
    if (seen.has(node.id)) throw new Error(`Duplicate scene node id: ${node.id}`);
    seen.add(node.id);
  }
}

export function assertStyleProvenance(nodes) {
  const visualKeys = new Set(["fill", "stroke", "color", "fontFamily", "fontSize", "lineWidth", "radius"]);
  for (const node of nodes) {
    for (const [key, value] of Object.entries(node.style || {})) {
      if (!visualKeys.has(key) || value === null || value === "none") continue;
      if (!value || typeof value !== "object" || !value.tokenId || value.value === undefined) {
        throw new Error(`${node.id}.${key} lacks design-token provenance`);
      }
    }
  }
}

export function assertDeclaredComponentTokens(definition, nodes, instanceId) {
  const declared = new Set(definition.tokens || []);
  for (const node of nodes) {
    for (const tokenId of node.tokens || []) {
      if (!declared.has(tokenId)) throw new Error(`${instanceId} uses undeclared token ${tokenId} in ${node.id}`);
    }
  }
}

/** The frame a rotated node occupies on the page (a quarter turn swaps its sides about its centre). */
export function visibleFrame(node) {
  const rotate = Number(node.style?.rotate || 0) % 180;
  if (Math.abs(rotate) !== 90) return node.frame;
  const { x, y, width, height } = node.frame;
  return { x: x + width / 2 - height / 2, y: y + height / 2 - width / 2, width: height, height: width };
}

export function assertSceneBounds(nodes, bounds = SLIDE) {
  for (const node of nodes) {
    const values = [node.frame.x, node.frame.y, node.frame.width, node.frame.height];
    if (values.some((value) => !Number.isFinite(value))) throw new Error(`${node.id} has a non-finite frame`);
    if (node.frame.width < 0 || node.frame.height < 0) throw new Error(`${node.id} has a negative frame dimension`);
    const frame = visibleFrame(node);
    if (frame.x < -0.01 || frame.y < -0.01 || frame.x + frame.width > bounds.width + 0.01 || frame.y + frame.height > bounds.height + 0.01) {
      throw new Error(`${node.id} exceeds the ${bounds.width} by ${bounds.height} slide`);
    }
  }
}

export function buildManifest(deck) {
  const manifest = {
    schema: MANIFEST_SCHEMA,
    designSystemVersion: DESIGN_SYSTEM_VERSION,
    sceneSchema: SCENE_SCHEMA,
    slideSize: SLIDE,
    palette: deck.palette,
    typography: deck.typography,
    pageTemplate: deck.pageTemplate,
    templateSequences: deck.templateSequences || [],
    tokens: deck.tokens || TOKENS,
    slides: deck.slides.map((slide, index) => ({
      id: slide.id,
      number: index + 1,
      density: slide.density,
      template: slide.template,
      componentInstances: slide.componentInstances,
      pageTemplate: slide.pageTemplate,
      contentFrame: slide.contentFrame,
      nodes: slide.nodes.map((node) => ({
        id: node.id,
        role: node.role,
        type: node.type,
        frame: node.frame,
        tokens: node.tokens,
        text: node.text,
        data: node.data,
        style: node.style
      }))
    }))
  };
  manifest.designHash = hashJson(manifest);
  return manifest;
}

const NATIVE_CHART_TYPES = Object.freeze({
  "chart.column": "column", "chart.bar": "bar", "chart.stacked-column": "stacked-column",
  "chart.stacked-bar": "stacked-bar", "chart.line": "line", "chart.pie": "pie", "chart.donut": "donut",
  "chart.scatter": "scatter", "chart.area": "area", "chart.range": "range"
});
/** Every plotted value a chart's props carry, however the series are written. */
function seriesValues(props = {}) {
  if (Array.isArray(props.series)) return props.series.flatMap((item) => item?.values || []);
  if (Array.isArray(props.values)) return props.values;
  return [];
}

/**
 * How a highlight with no `style` is drawn. On a one-series bar chart it is
 * the bar itself in the accent: a pale band behind a dark bar leaves the subject
 * of a forty-member ranking - and of every column of an aligned-bars page -
 * hard to find, where the same row painted in the accent is the first thing
 * seen. Elsewhere (grouped or stacked bars and columns) the band behind the
 * category stays the default. The drawn chart (charts.mjs), the native chart
 * spec below and the composer's row rules all read this one rule.
 */
export function defaultHighlightStyle(componentId, props = {}) {
  // Columns follow bars: a year marked by a tint behind a dark column reads as
  // the same colour as its neighbours.
  return ["chart.bar", "chart.column"].includes(componentId) && Array.isArray(props.series) && props.series.length === 1 ? "bar" : "region-tint";
}

/** Data an emitter needs for a native chart. Types outside NATIVE_CHART_TYPES keep shapes. */
export function nativeChartSpec(componentId, props = {}, frame, renderedNodes) {
  const type = NATIVE_CHART_TYPES[componentId];
  if (!type) return null;
  // Reference lines and annotations need the plot scale; PowerPoint does not
  // expose it, so those charts stay as assembled, grouped shapes. A single-bar
  // highlight is a per-point fill and stays native.
  const highlights = (props.highlights || []).map((h) => ({ ...h, style: h?.style ?? defaultHighlightStyle(componentId, props) }));
  // A floating range band prints its low value left of the band and its high
  // value right of it, in ink. PowerPoint's stacked-bar stand-in can only put a
  // label inside the band, so the range chart is assembled as shapes.
  // A sub-label under a category ("n=412") is placed against the plot we
  // measured; PowerPoint draws its own category axis wherever it likes, so a
  // chart that carries category notes is assembled as shapes.
  if (props.native === false || type === "scatter" || type === "range") return null;
  // Labels set outside the wedges with leaders are placed against the drawn
  // circle; PowerPoint cannot reproduce them, so that variant stays drawn.
  if (["pie", "donut"].includes(type) && (props.outsideLabels || props.variant === "outside-labels")) return null;
  // Likewise a share too wide for its slice, which the scene sets beyond the
  // rim beside it: PowerPoint's outside-end label is placed and wrapped by the
  // renderer, and LibreOffice squeezes it into the frame margin.
  if (["pie", "donut"].includes(type) && renderedNodes?.some(node => node.role === "data-label" && node.data?.placement === "outside")) return null;
  // Explicit numeric x positions and keyed point labels are not a categorical
  // native line. Preserve their spacing and selected labels as editable shapes.
  if (type === "line" && (props.xAxis !== undefined || props.series?.some(item => item.points !== undefined))) return null;
  // Dated observations at uneven gaps are drawn where they fall in time
  // (chart-line.mjs, time-axis.mjs). PowerPoint's category axis would set them one
  // slot apart again, so those lines and areas stay drawn, as the sparse line does.
  if (["line", "area"].includes(type) && timePositions(props.categories)) return null;
  // A gap in a series is drawn as no mark; a native chart would plot it as zero or join across it, so that chart stays drawn.
  if (Array.isArray(props.series) && props.series.some((item) => (item?.values || []).some((value) => value === null))) return null;
  // A native area carries no value labels in the saved file (LibreOffice drops them), and the probe's area of slot sales
  // lost every figure it printed (TEXT_EXPORT_LOST): an area that prints its values stays drawn.
  if (type === "area" && renderedNodes?.some((node) => node.role === "data-label")) return null;
  // So are columns over uneven dates (chart-categorical.mjs rowLabelling), unless a broken axis or a data table keeps their slots.
  if (["column", "stacked-column"].includes(type) && !props.categoryColumns && !(props.categoryBreaks || []).length && timePositions(props.categories)) return null;
  // A rank's line runs with 1 at the top, which the native line's axis does not say (chart-line.mjs): that chart stays drawn.
  if (Array.isArray(props.series) && props.series.some((item) => item?.rank === true)) return null;
  // A series that says it is assumed or a reference is drawn dashed, lighter or as a reference line (chart-decorations.mjs
  // SERIES_STATES), which a native series cannot say: that chart stays drawn.
  if (Array.isArray(props.series) && props.series.some((item) => item?.state !== undefined || item?.assumedFrom !== undefined)) return null;
  // External stack labels and their leaders use measured scene coordinates;
  // Office repositioning the labels would detach those leaders from the text.
  if (renderedNodes?.some(node => node.role === "data-label" && node.data?.external)) return null;
  // The forecast key and its dashed boundary are placed against the measured
  // plot; PowerPoint keeps the per-point tint but has no legend entry for part
  // of a series and would float the divider, so a keyed forecast stays drawn.
  if (renderedNodes?.some(node => node.role === "chart-forecast-divider" || (node.role === "legend-swatch" && node.data?.categoryKey === "forecast"))) return null;
  if (Array.isArray(props.categoryNotes) && props.categoryNotes.some((note) => typeof note === "string" && note.trim())) return null;
  // Signed bars need the measured zero baseline and label gutters. Native
  // horizontal axes can move category labels into the bars; native columns
  // also lose negative signs/direction in the LibreOffice render. Preserve
  // the signed comparison as editable shapes in either orientation.
  if (["bar", "stacked-bar", "column", "stacked-column"].includes(type) && seriesValues(props).some((value) => value < 0)) return null;
  // Keep named scatter points and rich value labels editable as scene shapes
  // until the native exporter can preserve their complete semantics.
  if (props.valueFormat && (typeof props.valueFormat !== "object" ||
      Object.keys(props.valueFormat).some(key => key !== "decimals"))) return null;
  // Stack totals and category groups are drawn by the runtime; PowerPoint has no native total label.
  if ((props.stackTotals || []).length || (props.categoryGroups || []).length || (props.secondaryLabels || []).length || (props.stackBracket || []).length || (props.deltas || []).length || (props.periods || []).length || (props.events || []).length || props.categoryLabels === false || props.segmentGrowth) return null;
  // Category icons and a growth column are placed against the plot we
  // measured; PowerPoint lays out its own axes, so they would float free.
  if (props.categoryIcons || props.seriesGrowth) return null;
  if ((props.referenceLines || []).length || (props.annotations || []).length || (props.changeAnnotations || []).length || highlights.some((h) => h?.style !== "bar")) return null;
  // Bands are placed against the plot we measured (chart-bands.mjs); a native chart has no band behind its marks.
  // A survey question is set over the plot (chart-question.mjs), which a native chart frame would cover.
  if (props.question || props.trendLine || props.diverging || props.categoryLabel === "above" || props.rowNotes || (props.bands || []).length || (props.intervals || []).length || props.valueBreak || (props.categoryBreaks || []).length || (props.groupBrackets || []).length || (props.valueLabels || []).length) return null;
  const categories = [...(props.categories || props.labels || [])];
  // The category labels the scene drew are the ones PowerPoint prints: a
  // ten-year line the scene labels FY17, FY20, FY23, FY26 would otherwise come
  // out of the native chart with all ten, rotated. `tickLblSkip` says the same
  // to PowerPoint but LibreOffice ignores it, so the labels the scene left out
  // are blank in the chart's categories (emit_pptx.py); the values keep their
  // rows.
  const drawnCategories = new Set((renderedNodes || []).filter(node => node.role === "category-label").map(node => String(node.data?.category ?? node.text)));
  const hiddenCategoryIndices = renderedNodes && drawnCategories.size && drawnCategories.size < categories.length
    ? categories.map((category, index) => drawnCategories.has(String(category)) ? -1 : index).filter(index => index >= 0) : [];
  // Likewise the values: a forty-row ranking labels the rows it names, where
  // the native chart would print all forty values over one another.
  const labelledCategories = new Set((renderedNodes || []).filter(node => node.role === "data-label" && node.data?.category !== undefined).map(node => String(node.data.category)));
  const hiddenLabelIndices = renderedNodes && labelledCategories.size && labelledCategories.size < categories.length && Array.isArray(props.series) && props.series.length === 1
    ? categories.map((category, index) => labelledCategories.has(String(category)) ? -1 : index).filter(index => index >= 0) : [];
  // The size the scene set its row names at, when crowding took it under the
  // chart's 10pt (chart-categorical.mjs ROW_LABEL_MIN): the native chart prints the same.
  const labelPt = Math.min(10, ...(renderedNodes || []).filter(node => node.role === "category-label").map(node => Number(node.style?.fontSize?.value)).filter(Number.isFinite));
  const series = type === "range"
    ? [{ name: "low", values: [...(props.low || [])], hidden: true }, { name: "range", values: (props.high || []).map((h, i) => h - (props.low || [])[i]) }]
    : Array.isArray(props.series) ? props.series.map(s => ({ name: s.name, values: [...(s.values || [])] }))
    : Array.isArray(props.values) ? [{ name: props.name || "", values: [...props.values] }] : [];
  const forecastIndex = props.forecastFrom !== undefined ? categories.indexOf(props.forecastFrom) : -1;
  const labelBold = houseStyle("style.labelWeight") !== "regular";
  // Use the actual scene's resolved visibility (dense charts can omit direct
  // labels by default), so the native axes follow the same decision.
  const dataLabels = renderedNodes
    ? renderedNodes.some(node => node.role === "data-label") : props.dataLabels !== false;
  const showValueAxis = renderedNodes
    ? renderedNodes.some(node => node.role === "axis-label")
    : props.showValueAxis ?? (props.gridlines === true || !dataLabels);
  // The drawn chart has already chosen one precision for its labels; the
  // native chart prints the same, rather than re-deriving it and drifting.
  const drawnLabels = (renderedNodes || []).filter(node => node.role === "data-label" && typeof node.text === "string");
  const places = drawnLabels.map(node => node.text.match(/\d\.(\d+)/)?.[1].length ?? 0);
  // A label printed to the precision the page's copy quotes (value-format.mjs
  // quotedDecimals) differs from its neighbours; a series carries one number
  // format natively, so that chart stays drawn.
  if (new Set(places).size > 1 && Array.isArray(props.quotedFigures) && props.quotedFigures.length) return null;
  const labelDecimals = drawnLabels.length ? Math.max(...places) : null;
  // So does its thousands separator. `valueFormat: { decimals: 0 }` draws 5035 (a declared format groups only when it says
  // `grouping`), the native chart grouped every chart past a thousand and printed 5,035, and the text plan, read off the
  // drawn label, lost 5035 from the saved page (TEXT_EXPORT_LOST, the BA deck's slot ranking). Said only where a label is
  // drawn four figures with no separator, which is the one case the emitter's own rule (any value past a thousand) misreads.
  const ungrouped = drawnLabels.some(node => /\d{4}/.test(node.text.replace(/\.\d+/g, "")));
  const ticks = (renderedNodes || []).filter(node => node.role === "axis-label" && Number.isFinite(node.data?.value)).map(node => node.data.value).sort((a,b)=>a-b);
  // A two-mark contrast paints one peer in the primary and the other grey, and
  // which one is the scene's decision (chart-categorical.mjs defaultFocusIndex: the named
  // focus, else the latest period, else the first). The emitter paints the mark
  // the scene painted, so a "2019 | 2024" chart reads the same way round in
  // PowerPoint.
  const marks = (renderedNodes || []).filter(node => node.role === "chart-mark");
  const primaryMark = marks.some(node => node.style?.fill?.tokenId === "color.chartComparator") ? marks.find(node => node.style?.fill?.tokenId === "color.chartSubject") : undefined;
  const focusIndex = primaryMark ? (series.length === 2 ? series.findIndex(item => item.name === primaryMark.data?.series) : categories.indexOf(primaryMark.data?.category)) : -1;
  // A highlighted mark takes the subject's colour (chart-axes.mjs SUBJECT): the emitter paints the token the scene painted it in.
  const litMark = marks.find(node => highlights.some((h) => String(h.category) === String(node.data?.category)));
  const highlightToken = litMark?.style?.fill?.tokenId;
  // Its peers in the colour the scene drew them in: the peer colour, calmer than the subject where the lead outshouts it.
  const peerToken = litMark && marks.some((node) => node.style?.fill?.tokenId === "color.chartPeer") ? "color.chartPeer" : undefined;
  return {
    ...(focusIndex >= 0 ? { focusIndex } : {}),
    ...(highlightToken ? { highlightToken } : {}),
    ...(peerToken ? { peerToken } : {}),
    labelBold,
    type,
    categories,
    series,
    highlightIndices: highlights.map((h) => categories.indexOf(h.category)).filter((i) => i >= 0),
    ...(hiddenCategoryIndices.length ? { hiddenCategoryIndices } : {}),
    ...(hiddenLabelIndices.length ? { hiddenLabelIndices } : {}),
    ...(labelPt < 10 ? { labelPt } : {}),
    forecastIndex,
    endLabels: props.directLabels === "end" || props.endLabels === true || (type === "line" && series.length > 1 && props.legend !== true && props.endLabels !== false),
    ...(type === "line" ? { pointDataLabels: renderedNodes
      ? renderedNodes.some(node => node.role === "data-label" && node.data?.labelKind === "point")
      : props.dataLabels !== false } : {}),
    center: props.center ?? null,
    ...(type === "range" ? { low: [...(props.low || [])], high: [...(props.high || [])] } : {}),
    ...(Array.isArray(props.points) ? { points: props.points.map(p => ({ ...p })) } : {}),
    unit: props.unit ?? null,
    // An area fills from its baseline, so its native axis starts at zero as the drawn one does (chart-line.mjs).
    yMin: ticks.length ? ticks[0] : props.yMin ?? (["bar", "column", "stacked-bar", "stacked-column", "area"].includes(type) && series.every(item => item.values.every(value => value >= 0)) ? 0 : null),
    yMax: ticks.length ? ticks.at(-1) : props.yMax ?? null,
    ...(ticks.length>1 ? {yMajorUnit:ticks[1]-ticks[0]} : {}),
    dataLabels,
    ...(labelDecimals !== null ? { labelDecimals } : {}),
    ...(ungrouped ? { labelGrouped: false } : {}),
    showValueAxis,
    // A pie or donut names its categories in its legend (the drawn chart's
    // "legend-top-right"); without one the native chart shows unlabelled wedges.
    legend: props.legend === true || (["pie", "donut"].includes(type)
      ? props.legend !== false && (props.variant ?? "legend-top-right") === "legend-top-right"
      : series.length > 1 && props.legend !== false && !(type === "line" && props.endLabels !== false) && type !== "range"),
    gridlines: props.gridlines === true,
    valueFormat: props.valueFormat ?? null,
    colorIndices: Array.isArray(props.colorIndices) ? [...props.colorIndices] : null,
    frame: { ...frame }
  };
}

/**
 * Map every item, collecting every failure rather than stopping at the first,
 * so one run names every broken page, not one a build. `label(item, index)`
 * names the page.
 */
export function mapAll(items, fn, label = (item, index) => item?.id ?? `slide-${index + 1}`) {
  const results = [], errors = [];
  items.forEach((item, index) => {
    try { results.push(fn(item, index)); }
    catch (error) {
      for (const message of error.pageErrors ?? [error.message]) {
        const name = label(item, index);
        errors.push(message.startsWith(`${name}:`) || message.includes(`${name}:`) ? message : `${name}: ${message}`);
      }
    }
  });
  if (errors.length) {
    const error = new Error(errors.length === 1 ? errors[0] : `${errors.length} pages could not be composed:\n- ${errors.join("\n- ")}`);
    error.pageErrors = errors;
    throw error;
  }
  return results;
}

export function compileDeck(deckSpec, registry, {slideCache}={}) {
  configureChrome(deckSpec.chrome || null);
  try { return compileDeckInner(deckSpec, registry, {slideCache}); } finally { configureChrome(null); }
}
// Actual ink geometry belongs to the component instance, separately from its
// allocation frame. Parents/reviewers can compare visible reading anchors.
export function componentGeometry(nodes) {
  const visible = nodes.filter(node => node.frame && [node.frame.x, node.frame.y, node.frame.width, node.frame.height].every(Number.isFinite));
  if (!visible.length) return { occupiedFrame: null, anchors: {} };
  const x = Math.min(...visible.map(node => node.frame.x)), y = Math.min(...visible.map(node => node.frame.y));
  const right = Math.max(...visible.map(node => node.frame.x + node.frame.width));
  const bottom = Math.max(...visible.map(node => node.frame.y + node.frame.height));
  const headings = visible.filter(node => node.type === "text" && /header|heading|period|chart-title/.test(node.role));
  return { occupiedFrame: { x, y, width: right - x, height: bottom - y },
    anchors: { contentTop: y, contentBottom: bottom, ...(headings.length ? { headerTop: Math.min(...headings.map(node => node.frame.y)) } : {}) } };
}

/**
 * The ground each page is set on, and its tokens. The palette resolves once,
 * for its light page; a page set on another ground (`tone` on the page, else on
 * the deck: `ground` here) takes the same palette resolved for that ground
 * (palettes.mjs groundTokens), chrome and body alike, so its title, rules,
 * marks and footer all read on it and the rest of the deck is untouched. A
 * fixed-shape page that paints its own ground - a dark cover, a navy divider, a
 * dark takeaways page (a component's `ownGround`) - is drawn in the light
 * page's tokens on any deck, as it was designed: on a dark deck its navy is the
 * ground the deck's pages are set on.
 */
function groundsOf(lightTokens) {
  const resolved = new Map([["light", lightTokens]]);
  return (ground) => {
    if (!resolved.has(ground)) resolved.set(ground, groundTokens(lightTokens, ground, THEME_SLOT_TOKENS));
    return resolved.get(ground);
  };
}
function groundOf(slideSpec, deckGround, registry, lightTokens) {
  if (slideSpec.ground !== undefined) {
    if (!GROUNDS.includes(slideSpec.ground)) throw new Error(`Unknown tone: ${JSON.stringify(slideSpec.ground)}; a page is set on ${GROUNDS.map((g) => `"${g}"`).join(", ")}`);
    return slideSpec.ground;
  }
  if (deckGround === "light") return "light";
  const children = slideSpec.composition?.children;
  const sole = Array.isArray(children) && children.length === 1 ? children[0] : null;
  const own = sole?.component && registry.get(sole.component)?.ownGround;
  return own && withDesignTokens(lightTokens, () => own(sole.props || {})) ? "light" : deckGround;
}

function compileDeckInner(deckSpec, registry, {slideCache}={}) {
  assertNoLegacyPageTaxonomy(deckSpec);
  const { tokens: lightTokens, ...palette } = resolvePalette(deckSpec.palette, TOKENS, THEME_SLOT_TOKENS);
  const typography = resolveTypography(deckSpec.typography, lightTokens);
  const deckGround = deckSpec.ground ?? "light";
  if (!["light", "dark"].includes(deckGround)) throw new Error(`Unknown deck tone: ${JSON.stringify(deckGround)}; a deck is set on "light" (the default) or "dark", and a single page on "primary"`);
  const tokensOn = groundsOf(lightTokens);
  // The deck's tokens are its own ground's: the manifest, the theme the PowerPoint carries and the chrome of every page on it.
  const designTokens = tokensOn(deckGround);
  const pageTemplate = registry.get("page-template")?.resolveTemplate(deckSpec.pageTemplate);
  return withDesignTokens(designTokens, () => {
  // How the deck last set each kind of content the engine chose a setting for (a figure, a list of points): each page is
  // weighed against it, so two pages running do not set the same thing the same way where another way is sound.
  const recent = {};
  const slides = mapAll(deckSpec.slides, (slideSpec, slideIndex) => {
    const ground = groundOf(slideSpec, deckGround, registry, lightTokens);
    const compiled = compileSlide(slideSpec, slideIndex, { registry, designTokens: tokensOn(ground), ground, typography, pageTemplate, palette, slideCache, recent: { ...recent } });
    for (const decision of compiled.decisions ?? []) Object.assign(recent, decision.families);
    return compiled;
  });
  const templateSequences = templateSequencesOf(slides);
  const deck = { schema: SCENE_SCHEMA, id: deckSpec.id || "deck", slides, palette, typography, pageTemplate, ...(deckSpec.fill ? { fill: deckSpec.fill } : {}), tokens: designTokens, templateSequences };
  deck.manifest = buildManifest(deck);
  return deck;
  });
}

/**
 * One slide spec compiled to its scene slide, with the citation the runtime
 * derived fitted to its footer. The footer as drawn counts toward the note bar
 * (`NOTE_HEAVY`), and a citation written from registry keys is the runtime's
 * to fit under it: once the page is composed its words are counted
 * (derive-content.mjs citationRoomOf), and a derived citation with more words
 * than the footer has room for is set again in the fullest form that has
 * (page-template.mjs). The room is recounted after each fit, since a shorter
 * footer can move the body; a fit that finds no more room stops.
 */
function compileSlide(slideSpec, slideIndex, context) {
  let compiled = compileSlideAsWritten(slideSpec, slideIndex, context);
  let room = Infinity;
  for (let fit = 0; fit < 3; fit += 1) {
    const next = citationRoomOf(compiled);
    if (next === null || next >= room) break;
    room = next;
    compiled = compileSlideAsWritten({ ...slideSpec, chrome: { ...slideSpec.chrome, sourceWordsMax: room } }, slideIndex, context);
  }
  return compiled;
}

/**
 * A page as it was written. Where the engine chose its arrangement and a component cannot draw in the frame that
 * arrangement gives it - a chart with too little height for its plot - the arrangement was not a candidate after all:
 * it is ruled out and the page is drawn the next best way. What a component needs is found by asking it to draw, so no
 * arrangement has to know any component's limits. A judge's choice is not second-guessed: its error is the page's.
 */
function compileSlideAsWritten(slideSpec, slideIndex, context) {
  const refused = {};
  for (let first = null, tries = 0; ; tries += 1) {
    const decisions = [];
    try { return drawSlide(slideSpec, slideIndex, context, decisions, refused); } catch (error) {
      first ??= error;
      const open = decisions.find((decision) => !decision.held && decision.candidates.length > 1);
      if (!open || tries >= 8) throw first;
      (refused[open.id] ??= []).push(open.chosen);
      naturalHeights = new WeakMap();
    }
  }
}

/**
 * One slide spec compiled to its scene slide, under its density's tokens: the
 * chrome, then every placement the layout resolves - a section places its
 * children as it renders, so the list grows while it is walked - then the
 * nodes' tokens resolved and the scene's invariants asserted. A slide found in
 * `slideCache` is returned as a copy.
 */
function drawSlide(slideSpec, slideIndex, { registry, designTokens, ground = "light", typography, pageTemplate, palette, slideCache, recent = {} }, decisions, refused) {
  const cacheKey=slideCache ? hashJson({slideSpec,slideIndex,designTokens,typography,pageTemplate,chrome:CHROME,recent}) : null;
  if(slideCache?.has(cacheKey))return structuredClone(slideCache.get(cacheKey));
  const slideId = slideSpec.id || `slide-${slideIndex + 1}`;
  const density = slideSpec.density ?? "executive";
  // A chart that steps its labels down (planner.mjs chartDensity) takes the
  // chart sizes of that step; the page's other type keeps the page's.
  const chartTokens = slideSpec.chartDensity ? resolveDensityTokens(designTokens, slideSpec.chartDensity) : null;
  const slideTokens = Object.fromEntries(Object.entries(resolveDensityTokens(designTokens, density))
    .map(([tokenId, definition]) => [tokenId, chartTokens && tokenId.startsWith("type.chart") ? chartTokens[tokenId] : definition]));
  return withDesignTokens(slideTokens, () => {
  if (slideSpec.palette !== undefined) throw new Error("Palette belongs to the deck, not individual slides");
  if (slideSpec.typography !== undefined) throw new Error("Typography belongs to the deck, not individual slides");
  const nodes = [];
  const componentInstances = [];
  const templatePlacements = [];
  const chromeBoxes = [];
  // Page furniture belongs to the deck's visual system. Evidence density
  // may change by slide without resizing titles, trackers or footers.
  const chromeOwners = new Set();
  let contentFrame = CONTENT_FRAME;
  let resolvedPageTemplate;
  if (slideSpec.chrome) {
    const rendered = renderSlideChrome({ slideSpec, slideIndex, slideId, registry, pageTemplate, designTokens, nodes, componentInstances, templatePlacements, chromeOwners });
    chromeBoxes.push({ kind: "component", id: "chrome", instance: stableId(slideId, "chrome"), component: "slide-chrome", frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height } });
    contentFrame = rendered.contentFrame;
    resolvedPageTemplate = rendered.pageTemplate;
  }
  // The page's layout tree (`layoutBox`): the chrome over the whole page, then the body as it resolved.
  const body = {};
  // What the engine chose between on this page (`decisions`), and the choices a judge recorded for it (`choices` on the page).
  hold(slideSpec.composition, slideSpec.choices ?? {}, refused, DENSITY_PROFILES[density].taste, recent);
  const placements = [...templatePlacements, ...resolveLayout(slideSpec.composition, slideSpec.frame || contentFrame, registry, { layout: body, decisions })];
  const page = { kind: "page", id: slideId, frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height }, children: [...chromeBoxes, ...(body.root ? [body.root] : [])] };
  const instanceBoxes = new Map(chromeBoxes.map((box) => [box.instance, box]));
  // A placement a component made itself (the chrome's title, a panel's parts) has no cell in a grid: it is laid over the instance that placed it.
  const boxOf = ({ node, frame, ancestors = [] }) => layoutBoxOf(node) ?? (() => {
    const owner = instanceBoxes.get(ancestors.at(-1)) ?? page;
    const box = { kind: node.nodeType, id: node.id || node.component, frame: pxFrame(frame), placed: true };
    (owner.children ??= []).push(box);
    return box;
  })();
  const headerBandHeight = (placement) => {
    const measure = ({ node, frame }) => registry.get(node.nodeType === "section" ? "section" : node.component)?.measureHeader?.({ frame, props: placementProps(node) });
    const own = measure(placement);
    if (!own) return undefined;
    // Peers sharing a top guide share a bottom-aligned text band, whether or
    // not they ink a rule: a panel on a ground separates with the ground, and
    // it is still a panel in the row. Longer headings increase the band;
    // neither adapter may shrink or invent wraps.
    const peers = placements.map(measure).filter((peer) => peer && Math.abs(peer.top - own.top) < 0.01);
    return Math.max(own.height, ...peers.map((peer) => peer.height));
  };
  const sharedTableRows = (placement) => {
    const alignment = placement.node.props?.rowAlignment;
    if (placement.node.component !== "table" || !alignment) return undefined;
    const peers = placements.filter(({ node }) => node.component === "table" && node.props?.rowAlignment?.group === alignment.group);
    if (peers.length < 2) throw new Error(`Table rowAlignment group ${alignment.group} needs at least two peers`);
    if (peers.some(({ node }) => JSON.stringify(node.props.rowAlignment.keys) !== JSON.stringify(alignment.keys)))
      throw new Error(`Table rowAlignment group ${alignment.group} must use identical ordered row keys`);
    const measured = peers.map(peer => ({ ...peer, measurement: registry.get("table").measureContent({
      frame: { ...peer.frame, height: Infinity },
      props: { ...peer.node.props, fillHeight: false, headerBandHeight: headerBandHeight(peer) }
    }) }));
    const bodyTop = measured[0].frame.y + measured[0].measurement.headerHeight;
    if (measured.some(peer => Math.abs(peer.frame.y + peer.measurement.headerHeight - bodyTop) > 0.01))
      throw new Error(`Table rowAlignment group ${alignment.group} requires a shared body-start anchor`);
    const heights = alignment.keys.map((_, r) => Math.max(...measured.map(peer => peer.measurement.heights[r])));
    const total = heights.reduce((sum, height) => sum + height, 0);
    const capacity = Math.min(...measured.map(({ frame, measurement: m }) => frame.height - (m.height - m.heights.reduce((sum, height) => sum + height, 0))));
    if (total > capacity + 0.01)
      throw new Error(`Table rowAlignment group ${alignment.group} needs ${total.toFixed(1)}px of body space; only ${capacity.toFixed(1)}px is available`);
    if (peers.every(({ node }) => node.props.fillHeight === true) && Number.isFinite(capacity) && heights.length) {
      const extra = Math.min(capacity - total, total * 1.5) / heights.length;
      heights.forEach((height, r) => { heights[r] = height + Math.max(0, extra); });
    }
    return heights;
  };
  const scene = { slideId, registry, pageTemplate, designTokens, slideTokens, nodes, componentInstances, chromeOwners, placements, headerBandHeight, sharedTableRows, instanceBoxes, decisions };
  // A component that draws between other components - a breakout's fan from a
  // mark to the panel that splits it - reads where they were drawn
  // (`readsScene`), so it is placed after everything else on the slide.
  const reads = (node) => node.nodeType !== "section" && registry.get(node.component)?.readsScene === true;
  const deferred = [];
  for (const placement of placements) {
    const { node, frame, ancestors = [], inRow: inRowPlacement = false } = placement;
    if (reads(node)) { deferred.push(placement); continue; }
    if (node.nodeType === "section") {
      placeSection(scene, { node, frame, ancestors, inRowPlacement, box: boxOf(placement) });
      continue;
    }
    placeComponent(scene, { node, frame, ancestors, box: boxOf(placement) });
  }
  for (const placement of deferred) placeComponent(scene, { node: placement.node, frame: placement.frame, ancestors: placement.ancestors ?? [], box: boxOf(placement) });
  assertUniqueIds(nodes);
  for (const node of nodes) {
    const nodeTokens = chromeOwners.has(node.data.componentInstance) || node.data.componentAncestors?.some(owner => chromeOwners.has(owner)) ? designTokens : slideTokens;
    node.style = Object.fromEntries(Object.entries(node.style).map(([key, value]) => [key,
      isTokenReference(value) ? (node.data.referenceSource && value.reference === node.data.referenceSource && value.tokenId.startsWith("reference.")
        ? value : { tokenId: value.tokenId, ...nodeTokens[value.tokenId] }) : value]));
  }
  assertStyleProvenance(nodes);
  assertSceneBounds(nodes);
  // A derived citation the footer set in a shorter form is kept whole in the
  // speaker notes, so no source a page rests on is lost to the fit.
  const fullCitation = nodes.find((node) => node.data?.fullCitation)?.data.fullCitation;
  const compiled = { id: slideId, notes: [slideSpec.notes, fullCitation].filter(Boolean).join("\n\n"), nodes, componentInstances, tokens: slideTokens, density, ...(slideSpec.template ? { template: structuredClone(slideSpec.template) } : {}), palette: palette.id, pageTemplate: resolvedPageTemplate, contentFrame: slideSpec.frame || contentFrame, layout: page, ...(decisions.length ? { decisions } : {}), ...(ground !== "light" ? { ground } : {}) };
  if (slideSpec.sourceSlideId) compiled.sourceSlideId = slideSpec.sourceSlideId;
  slideCache?.set(cacheKey,structuredClone(compiled));
  return compiled;
  });
}

/** The slide chrome rendered over the whole slide, its nodes and instance recorded; returns it, with the content frame and page template it resolves. */
function renderSlideChrome({ slideSpec, slideIndex, slideId, registry, pageTemplate, designTokens, nodes, componentInstances, templatePlacements, chromeOwners }) {
  const chromeDefinition = registry.get("slide-chrome");
  if (!chromeDefinition) throw new Error("The component registry must define slide-chrome");
  const chromeId = stableId(slideId, "chrome");
  chromeOwners.add(chromeId);
  const chromeProps = { ...slideSpec.chrome, pageTemplate: { ...pageTemplate, ...slideSpec.chrome.pageTemplate }, pageNumber: slideSpec.chrome.pageNumber ?? slideIndex + 1 };
  const rendered = withDesignTokens(designTokens, () => chromeDefinition.render({
    id: chromeId,
    tokens: designTokens,
    frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height },
    props: chromeProps
  }));
  templatePlacements.push(...(rendered.placements || []).map(placement => ({ ...placement, ancestors: [chromeId] })));
  assertDeclaredComponentTokens(chromeDefinition, rendered.nodes, chromeId);
  rendered.nodes.forEach((item) => { item.data.componentInstance = chromeId; });
  nodes.push(...rendered.nodes);
  componentInstances.push({
    id: "chrome",
    instanceId: chromeId,
    component: "slide-chrome",
    version: chromeDefinition.version,
    category: chromeDefinition.category,
    role: chromeDefinition.role,
    variant: chromeDefinition.resolveVariant?.(slideSpec.chrome),
    frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height },
    tokens: chromeDefinition.tokens
  });
  return rendered;
}

/** A section placement: the section drawn with its shared header band, and its children's placements added to the slide's. */
function placeSection({ slideId, registry, slideTokens, nodes, componentInstances, placements, headerBandHeight, instanceBoxes, decisions }, { node, frame: given, ancestors, inRowPlacement, box }) {
  // A heading belongs to what it heads. Where the section's blocks open to the page's loosest gap and still leave height
  // (`leftover: "spread"`), the section is as tall as that group and sits in the middle of the frame it was given,
  // heading and ground with it: a heading left at the top over centred points is a label over a band of air.
  let frame = given;
  if (standsAsGroup(node, registry)) {
    const tall = groupHeight(node, registry, frame.width, frame.height), lead = (frame.height - tall) / 2;
    // A near miss reads as a mistake: where the group would start less than a major gap down, it starts at the top, level with what stands beside it.
    if (lead > tokenValue(token("space.major"))) { frame = { ...frame, y: frame.y + lead, height: tall }; if (box) Object.assign(box, { frame: pxFrame(frame), ...(box.area ? { area: { ...box.area, self: "center" } } : {}) }); }
  }
  const sectionDefinition = registry.get("section");
  if (!sectionDefinition) throw new Error("The component registry must define section");
  const instanceId = stableId(slideId, node.id);
  const rendered = sectionDefinition.render({
    id: instanceId,
    tokens: slideTokens,
    frame,
    props: { ...placementProps(node), headerBandHeight: headerBandHeight({ node, frame }) }
  });
  assertDeclaredComponentTokens(sectionDefinition, rendered.nodes, node.id);
  rendered.nodes.forEach((item) => {
    item.data.componentInstance = instanceId;
    item.data.componentAncestors = [...ancestors];
  });
  nodes.push(...rendered.nodes);
  componentInstances.push({
    id: node.id,
    instanceId,
    component: "section",
    version: sectionDefinition.version,
    variant: sectionDefinition.resolveVariant?.(placementProps(node)),
    role: "section",
    frame,
    tokens: sectionDefinition.tokens
  });
  Object.assign(box, { instance: instanceId, component: "section", variant: sectionDefinition.resolveVariant?.(placementProps(node)) });
  instanceBoxes.set(instanceId, box);
  if (node.composition || node.children.length) {
    const nestedRoot = node.composition || flow({
      id: `${node.id}-content`,
      direction: "column",
      gap: token("space.3"),
      children: node.children
    });
    const nested = {};
    const nestedPlacements = resolveLayout(nestedRoot, rendered.contentFrame, registry, { inRow: inRowPlacement, layout: nested, decisions, fitted: node.size?.height === "hug" });
    placements.push(...nestedPlacements.map(placement => ({ ...placement, ancestors: [...ancestors, instanceId] })));
    if (nested.root) (box.children ??= []).push(nested.root);
  }
}

/**
 * A component placement: rendered under the chrome's or the slide's tokens,
 * with its shared header band and table rows, its nested placements added, and
 * its instance recorded (with its native chart spec, for a chart).
 */
function placeComponent({ slideId, registry, pageTemplate, designTokens, slideTokens, nodes, componentInstances, chromeOwners, placements, headerBandHeight, sharedTableRows, instanceBoxes }, { node, frame, ancestors, box }) {
  const definition = registry.get(node.component);
  if (!definition) throw new Error(`Unknown component: ${node.component}`);
  const instanceId = stableId(slideId, node.id || node.component);
  const chromePlacement = ["page-template", "slide-chrome"].includes(node.component) || ancestors.some(owner => chromeOwners.has(owner));
  if (chromePlacement) chromeOwners.add(instanceId);
  const props = { ...node.props, headerBandHeight: headerBandHeight({ node, frame }) };
  const sharedRows = sharedTableRows({ node, frame });
  if (sharedRows) props._sharedRowHeights = sharedRows;
  if (["page-template", "slide-chrome", "section-divider"].includes(node.component)) props.pageTemplate = { ...pageTemplate, ...node.props?.pageTemplate };
  let rendered;
  try {
    const placementTokens = chromePlacement ? designTokens : slideTokens;
    const drawn = definition.readsScene ? { scene: { nodes: nodes.map((item) => ({ ...item })), instances: componentInstances.map(({ id, instanceId, component, frame: at }) => ({ id, instanceId, component, frame: at })) } } : {};
    rendered = withDesignTokens(placementTokens, () => definition.render({ id: instanceId, frame, tokens: placementTokens, props, ...drawn }));
  } catch (error) {
    throw new Error(`Cannot render ${instanceId} (${definition.id}): ${error.message}`, { cause: error });
  }
  placements.push(...(rendered.placements || []).map(placement => ({ ...placement, ancestors: [...ancestors, instanceId] })));
  Object.assign(box, { instance: instanceId, component: definition.id, category: definition.category, variant: definition.resolveVariant?.(props) });
  instanceBoxes.set(instanceId, box);
  assertDeclaredComponentTokens(definition, rendered.nodes, instanceId);
  // A chart the emitter writes as a native, workbook-backed chart keeps
  // its data editable, and that is worth more than a lone line's area
  // (chart-axes.mjs markWeight), which PowerPoint's line chart cannot carry. The
  // scene drops the area too, so the scene and the file agree.
  const native = String(definition.id).startsWith("chart.") ? nativeChartSpec(definition.id, props, frame, rendered.nodes) : null;
  if (native) rendered.nodes = rendered.nodes.filter((item) => !(item.role === "chart-area" && item.data?.lone));
  rendered.nodes.forEach((item) => {
    item.data.componentInstance = instanceId;
    item.data.componentAncestors = [...ancestors];
  });
  nodes.push(...rendered.nodes);
  componentInstances.push({
    id: node.id || instanceId,
    instanceId,
    component: definition.id,
    version: definition.version,
    category: definition.category,
    role: node.role || definition.role,
    ...(props.semantic ? {relationships: props.semantic} : {}),
    variant: definition.resolveVariant?.(props),
    frame,
    ...componentGeometry(rendered.nodes),
    tokens: definition.tokens,
    // Chart data travels with the instance so an emitter can write a native,
    // workbook-backed chart object in this frame instead of loose shapes.
    ...(String(definition.id).startsWith("chart.") ? { nativeChart: native } : {})
  });
}

/** The template sequences the slides declare, checked contiguous and structurally identical; each slide's reference gains its structural hash. */
function templateSequencesOf(slides) {
  const templateSequences = [];
  const closed = new Set();
  let active = null;
  for (const [position, slide] of slides.entries()) {
    const reference = slide.template;
    if (!reference) {
      if (active) { closed.add(active.id); active = null; }
      continue;
    }
    if (!reference || typeof reference.id !== "string" || !reference.id.trim() || !Number.isInteger(reference.index) || !Number.isInteger(reference.total) || reference.index < 1 || reference.total < 2 || reference.index > reference.total) throw new Error(`Slide ${slide.id} has invalid template sequence metadata`);
    if (!active || active.id !== reference.id) {
      if (active) closed.add(active.id);
      if (closed.has(reference.id)) throw new Error(`Template sequence ${reference.id} must remain contiguous`);
      active = { id: reference.id, total: reference.total, slides: [], positions: [], signature: null };
      templateSequences.push(active);
    }
    if (reference.total !== active.total || reference.index !== active.slides.length + 1) throw new Error(`Template sequence ${reference.id} has inconsistent index or total`);
    const structure = {
      density: slide.density,
      contentFrame: slide.contentFrame,
      pageTemplate: slide.pageTemplate,
      // A sequence signature describes reusable structure. Instance IDs are
      // intentionally slide-scoped provenance, so including them would make
      // two structurally identical sequence slides compare as different.
      components: slide.componentInstances.map(instance => ({ id: instance.id, component: instance.component, variant: instance.variant ?? null, role: instance.role, frame: instance.frame }))
    };
    const signature = hashJson(structure);
    if (active.signature && active.signature !== signature) throw new Error(`Template sequence ${reference.id} changed layout, component frames or variants on slide ${slide.id}`);
    active.signature = signature;
    active.slides.push(slide.id);
    active.positions.push(position + 1);
    slide.template = { ...reference, structuralHash: signature };
  }
  for (const sequence of templateSequences) {
    if (sequence.slides.length !== sequence.total) throw new Error(`Template sequence ${sequence.id} declares ${sequence.total} slides but contains ${sequence.slides.length}`);
  }
  return templateSequences;
}
