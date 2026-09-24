import {
  CHROME,
  DEFAULT_TITLE_VARIANT,
  SLIDE,
  TITLE_VARIANTS,
  TOKENS,
  assertSectionHeadingProps,
  ellipsePrimitive,
  insetFrame,
  linePrimitive,
  normalizeInsets,
  rectPrimitive,
  primitive,
  resolveTitleVariant,
  STYLE_TOKENS,
  shapePrimitive,
  stableId,
  houseStyle,
  textPrimitive,
  token,
  tokenValue,
  wedgePrimitive
} from "./core.mjs";
import { renderPhaseWorkstreams, measurePhaseWorkstreams, PHASE_WORKSTREAM_TOKENS, PHASE_WORKSTREAM_VARIANTS } from "./phase-workstreams.mjs";
import { renderQualitativeFunnel, measureQualitativeFunnel, renderPhaseHierarchy, measurePhaseHierarchy, QUALITATIVE_TOPOLOGY_TOKENS, QUALITATIVE_FUNNEL_SAMPLE, PHASE_HIERARCHY_SAMPLE } from './qualitative-topology.mjs';
import { timeGrid, datedLanes, SCHEDULE_TOKENS, SCHEDULE_VARIANTS } from "./schedules.mjs";
import { registerSegmentedEvidence } from "./segmented-evidence.mjs";
import { registerMedia } from "./media.mjs";
import { registerCharts } from "./charts.mjs";
import { renderTable, measureTable, TABLE_TOKENS } from "./tables.mjs";
import { fitText, textStyle as baseTextStyle, measuredTextNode } from "./text-style.mjs";
import { TABLE_VARIANTS } from "./table-fixtures.mjs";
import { measureText, measureTextRuns, accentRuns } from "./text-layout.mjs";
import { routeConnector } from "./routing.mjs";
import { legendNodes, LEGEND_TOKENS, LEGEND_VARIANTS, LEGEND_PLACEMENTS, QUANTITATIVE_LEGEND_SAMPLE } from "./legends.mjs";
import { registerChartGroup } from "./chart-group.mjs";
import { contrastRatio } from "./palettes.mjs";
import { renderChartCallout } from "./chart-annotations.mjs";
import { PAGE_RULES, PAGE_BRANDING, PAGE_TEMPLATE_TOKENS, pageTemplateLayout, renderPageTemplate, resolvePageTemplate } from "./page-template.mjs";
import { TRACKER_TOKENS, registerTrackers, trackerLabelNodes } from "./trackers.mjs";
import { registerRelationshipNetwork } from "./relationship-network.mjs";
import { registerQuoteCluster } from "./quote-cluster.mjs";
import { CUSTOM_MAP_SAMPLE, CHOROPLETH_MAP_SAMPLE, MAP_GUIDANCE, MAP_PRESET_IDS, MAP_TOKENS, mapNodes, resolveGeography } from "./maps.mjs";
import { registerInsightTreeTable } from "./insight-tree-table.mjs";
import { MARK_TOKENS, markerSize, numberMarker, iconMarker, stateMarker } from "./marks.mjs";
import { registerPanels } from "./panels.mjs";
import { registerExtras } from "./extras.mjs";
import { registerFigures } from "./figures.mjs";
import { registerGantt } from "./gantt.mjs";
import { registerFramework } from "./framework.mjs";

const FONT = token("font.body");
const DISPLAY = token("font.display");
const INK = token("color.ink");
const SECONDARY = token("color.textSecondary");
const PRIMARY = token("color.componentPrimary");
const PRIMARY_TINT = token("color.componentPrimaryTint");
const SURFACE = token("color.surface");
const MUTED_SURFACE = token("color.surfaceMuted");
const RULE = token("color.rule");
const WHITE = token("color.onPrimary");
const HAIRLINE = token("line.hairline");
const STANDARD = token("line.standard");
const SMALL_RADIUS = token("radius.small");
const BODY = token("type.body");
const COMPACT = token("type.compact");
const LABEL = token("type.label");
const SOURCE = token("type.source");
const SECTION_HEADING_TOKENS = ["color.componentPrimary", "color.ink", "color.onPrimary", "font.body", "type.heading", "line.hairline", "space.1", "space.2", "space.3", "space.4"];

// The registry's own argument order and defaults, over the shared builders.
const textStyle = (size = BODY, color = INK, bold = false, align = "left", valign = "mid") =>
  baseTextStyle({ fontFamily: FONT, fontSize: size, color, bold, align, valign });

const boxStyle = (fill = SURFACE, stroke = RULE, lineWidth = HAIRLINE, radius = SMALL_RADIUS) => ({
  fill,
  stroke,
  lineWidth,
  radius
});

const openLine = (id, x1, y1, x2, y2, role = "rule", stroke = RULE, lineWidth = HAIRLINE, data = {}) => linePrimitive({
  id,
  role,
  x1,
  y1,
  x2,
  y2,
  style: { stroke, lineWidth },
  data
});

const component = ({ id, category, role = category, tokens, preferredSize, sample, variants, defaultVariant, render, measureContent }) => ({
  id,
  version: "2.0.0",
  category,
  role,
  tokens: [...new Set(tokens)].sort(),
  preferredSize,
  sample,
  ...(variants ? { variants, defaultVariant } : {}),
  render,
  ...(measureContent ? { measureContent } : {})
});

/** Body copy never runs wider than ≈ 80 characters (item 6, measure cap). */
function paragraphMeasure(frameWidth, props = {}) {
  if (props.maxMeasure === false) return frameWidth;
  return Math.min(frameWidth, Math.round(tokenValue(BODY) * 96 / 72 * 0.47 * 80));
}

// `fitText` and the measured node now live in text-style.mjs, beside the
// style object they measure; re-exported here because this is where callers
// have always found it.
export { fitText };



function insightLayout(frame, props) {
  // `items`: the closing block as two or three square-bulleted findings on the
  // band rather than one sentence running across it. A strong deck closes
  // a dense table this way - each line carries its own finding, and the reader
  // can take them one at a time.
  const list = Array.isArray(props.items) ? props.items.map((item) => String(item ?? "").trim()).filter(Boolean) : null;
  if (list && !list.length) throw new Error("Insight items need nonempty text");
  if (!list && (typeof props.text !== "string" || !props.text.trim())) throw new Error("Insight requires a nonempty synthesis sentence");
  if (props.align !== undefined && !["left", "center"].includes(props.align)) throw new Error("Insight alignment must be left or center");
  // A takeaway band: 16 px side padding, 12 px above and below one or two lines
  // of semibold body text, left-aligned (the gallery's grey band). The primary
  // variant carries a chevron disc at the left and reserves its width.
  // `plain` is the statement with no box around it: the label that sits above a
  // boxed takeaway. With no surface there is nothing to inset it from, so it
  // sits flush with the column and keeps only the reading gap under it.
  // `rule` (the editorial and journal close) is the statement under a hairline
  // with no box; `statement` (the keynote close) sets it a size larger beside
  // an accent bar. Both are open: nothing to inset the text from.
  const plain = ["plain", "rule", "statement"].includes(props.variant);
  const paddingX = plain ? 0 : tokenValue(token("space.4"));
  const paddingY = props.variant === "rule" ? tokenValue(token("space.3")) : plain ? tokenValue(token("space.2")) : tokenValue(token(!list && props.text.includes("\n\n") ? "space.5" : "space.3"));
  const bar = props.variant === "statement" ? 5 : 0;
  const marker = bar || ((props.variant ?? "tonal") === "primary" || props.marker === "chevron" ? tokenValue(token("icon.medium")) : 0);
  const markerGap = marker ? tokenValue(token("space.3")) : 0;
  const bodySize = props.variant === "statement" ? token("type.heading") : BODY;
  const width = frame.width - 2 * paddingX - marker - markerGap;
  if (width <= 0) throw new Error("Insight width cannot contain its theme padding; give the insight a wider frame");
  const options = { fontFamily: tokenValue(FONT), wrapWidthRatio: 1 };
  const heading = props.heading ? measureText(props.heading, width, { ...options, fontSize: tokenValue(token("type.heading")), bold: true }) : null;
  const gap = heading ? tokenValue(token("space.2")) : 0;
  if (list) {
    const bulletGap = tokenValue(token("space.3"));
    const indent = tokenValue(token("space.4"));
    const rowGap = tokenValue(token("space.2"));
    const lines = list.map((text) => measureText(text, width - indent, { ...options, fontSize: tokenValue(BODY), bold: true }));
    const listHeight = lines.reduce((sum, line) => sum + line.height, 0) + rowGap * (lines.length - 1);
    const contentHeight = listHeight + (heading?.height ?? 0) + gap;
    return { body: null, lines, indent, bulletGap, rowGap, heading, width, paddingX, paddingY, gap, marker, markerGap, contentHeight, height: Math.max(contentHeight, marker) + 2 * paddingY };
  }
  const body = measureText(props.text, width, { ...options, ...(props.variant === "rule" ? { fontFamily: tokenValue(DISPLAY) } : {}), fontSize: tokenValue(bodySize), bold: true });
  const contentHeight = body.height + (heading?.height ?? 0) + gap;
  return { body, bodySize, bar, lines: null, heading, width, paddingX, paddingY, gap, marker, markerGap, contentHeight, height: (bar ? contentHeight : Math.max(contentHeight, marker)) + 2 * paddingY };
}

/**
 * The height an insight box needs at a width, in its own face and padding.
 * The composer's row of captioned panels shares one caption height; measured
 * with this rather than an Arial-14 estimate it never under-allocates the box.
 */
export const measureInsight = (frame, props) => insightLayout(frame, props);

// A reading note: the cream box a consulting page carries top-right to say how
// to read it, or to flag a caveat. Compact type, hairline caution border.
function calloutLayout(frame, props) {
  if (typeof props.text !== "string" || !props.text.trim()) throw new Error("Callout requires text");
  // `outline`: the insight box of the modern survey deck, an accent outline
  // with semibold accent copy at body size; otherwise a quiet cream note.
  const outline = props.tone === "outline";
  const paddingX = tokenValue(token(outline ? "space.4" : "space.3")), paddingY = tokenValue(token(outline ? "space.4" : "space.2"));
  const width = frame.width - 2 * paddingX;
  if (width <= 0) throw new Error("Callout has no text width; give the callout a wider frame");
  const options = { fontFamily: tokenValue(FONT), fontSize: tokenValue(outline ? BODY : COMPACT), wrapWidthRatio: 1 };
  const lead = props.lead?.trim() ? measureText(props.lead, width, { ...options, bold: true }) : null;
  const body = measureText(props.text, width, { ...options, bold: outline });
  const gap = lead ? tokenValue(token("space.2")) / 2 : 0;
  return { lead, body, paddingX, paddingY, gap, outline, height: (lead?.height ?? 0) + gap + body.height + 2 * paddingY };
}

function calloutNodes({ id, frame, props }) {
  let layout = calloutLayout(frame, props);
  // As with the insight: a box a few pixels short closes its vertical padding
  // (to a 4px floor) instead of failing.
  if (layout.height > frame.height + 0.01) {
    const paddingY = layout.paddingY - (layout.height - frame.height) / 2;
    if (paddingY < tokenValue(token("space.1")) - 0.01) throw new Error(`Callout overflows its ${frame.height}px box by ${Math.ceil(layout.height - frame.height)}px; give it the space or shorten the note`);
    layout = { ...layout, paddingY, height: frame.height };
  }
  const height = layout.outline && props.fill ? frame.height : layout.height;
  const color = layout.outline ? token("color.accent") : INK;
  const nodes = [rectPrimitive({ id: stableId(id, "surface"), role: "callout-surface", frame: { ...frame, height }, style: layout.outline ? boxStyle(SURFACE, token("color.accent"), HAIRLINE, token("radius.none")) : boxStyle(token("color.calloutTint"), props.tone === "caution" ? token("color.caution") : "none", HAIRLINE, token("radius.none")) })];
  let y = frame.y + layout.paddingY;
  if (layout.lead) { nodes.push(textPrimitive({ id: stableId(id, "lead"), role: "callout-lead", frame: { x: frame.x + layout.paddingX, y, width: frame.width - 2 * layout.paddingX, height: layout.lead.height }, text: layout.lead.text, style: { ...textStyle(layout.outline ? BODY : COMPACT, color, true, "left", "top"), lineHeight: layout.lead.lineHeight, wrap: false }, data: { textLayout: layout.lead } })); y += layout.lead.height + layout.gap; }
  nodes.push(textPrimitive({ id: stableId(id, "text"), role: "callout-text", frame: { x: frame.x + layout.paddingX, y, width: frame.width - 2 * layout.paddingX, height: layout.body.height }, text: layout.body.text, style: { ...textStyle(layout.outline ? BODY : COMPACT, color, layout.outline, "left", "top"), lineHeight: layout.body.lineHeight, wrap: false }, data: { textLayout: layout.body } }));
  return nodes;
}

function insightNodes({ id, frame, props }) {
  const layout = insightLayout(frame, props), variant = props.variant ?? "tonal";
  // The content is centred in the frame, so a box a few pixels short of the
  // measured height gives the difference up from its padding rather than
  // failing: a caption sized by an estimate (a row of captioned panels shares
  // one height, measured in a different face) overflowed its 80px box by 2px.
  // The padding keeps a 4px floor on each side; only content taller than the
  // box less that floor is a sentence the box cannot hold.
  const floor = tokenValue(token("space.1"));
  const content = layout.bar ? layout.contentHeight : Math.max(layout.contentHeight, layout.marker);
  if (layout.height > frame.height && content + 2 * Math.min(floor, layout.paddingY) > frame.height) throw new Error(`Insight overflows its ${frame.height}px box by ${Math.ceil(layout.height - frame.height)}px even with its padding closed to ${floor}px; give it ${Math.ceil(layout.height - frame.height)}px more height or shorten the sentence`);
  const fill = variant === "primary" ? PRIMARY : variant === "neutral" ? MUTED_SURFACE : variant === "dotted" ? "none" : PRIMARY_TINT;
  const foreground = variant === "primary" ? WHITE : INK;
  const nodes = ["plain", "rule", "statement"].includes(variant) ? [] : [rectPrimitive({ id: stableId(id, "surface"), role: "insight-surface", frame, style: boxStyle(fill, "none", HAIRLINE, SMALL_RADIUS) })];
  if (variant === "rule") nodes.push(openLine(stableId(id, "rule"), frame.x, frame.y, frame.x + frame.width, frame.y, "insight-rule", RULE, HAIRLINE));
  if (variant === "statement") nodes.push(rectPrimitive({ id: stableId(id, "bar"), role: "insight-bar", frame: { x: frame.x, y: frame.y + layout.paddingY, width: layout.bar, height: layout.contentHeight }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.none")) }));
  if (variant === "dotted") {
    // Native renderers collapse hairline dash presets into solid borders.
    // Resolve editable dots once so every adapter receives identical geometry.
    const diameter = tokenValue(HAIRLINE), gap = tokenValue(token("space.2")), seen = new Set();
    for (const [x, y, dx, dy, length] of [[frame.x, frame.y, 1, 0, frame.width], [frame.x, frame.y + frame.height - diameter, 1, 0, frame.width], [frame.x, frame.y, 0, 1, frame.height], [frame.x + frame.width - diameter, frame.y, 0, 1, frame.height]]) {
      const count = Math.max(1, Math.floor((length - diameter) / gap));
      for (let i = 0; i <= count; i++) {
        const dotX = x + dx * i * (length - diameter) / count, dotY = y + dy * i * (length - diameter) / count;
        const key = `${dotX.toFixed(5)}:${dotY.toFixed(5)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        nodes.push(ellipsePrimitive({ id: stableId(id, "border-dot", seen.size), role: "insight-border-dot", frame: { x: dotX, y: dotY, width: diameter, height: diameter }, style: boxStyle(RULE, "none", HAIRLINE, SMALL_RADIUS) }));
      }
    }
  }
  let y = frame.y + (frame.height - layout.contentHeight) / 2;
  const textX = frame.x + layout.paddingX + layout.marker + layout.markerGap;
  if (layout.marker && !layout.bar) {
    // Chevron disc: reversed on the primary band, primary on a tinted band.
    const size = layout.marker, mx = frame.x + layout.paddingX, my = frame.y + (frame.height - size) / 2;
    const discFill = variant === "primary" ? WHITE : PRIMARY, chevron = variant === "primary" ? PRIMARY : WHITE;
    nodes.push(ellipsePrimitive({ id: stableId(id, "marker"), role: "insight-marker", frame: { x: mx, y: my, width: size, height: size }, style: boxStyle(discFill, discFill, HAIRLINE, token("radius.round")) }));
    nodes.push(shapePrimitive({ id: stableId(id, "marker-chevron"), role: "insight-marker-glyph", geometry: "iconPath", frame: { x: mx + size * 0.3, y: my + size * 0.28, width: size * 0.4, height: size * 0.44 }, style: { fill: "none", stroke: chevron, lineWidth: token("line.standard"), lineCap: "round" }, data: { paths: [{ points: [[0.2, 0], [0.8, 0.5], [0.2, 1]], closed: false }] } }));
  }
  if (layout.lines) {
    if (layout.heading) {
      nodes.push(textPrimitive({ id: stableId(id, "heading"), role: "insight-heading", frame: { x: textX, y, width: layout.width, height: layout.heading.height }, text: layout.heading.text, style: { ...textStyle(token("type.heading"), foreground, true, props.align ?? "left", "top"), lineHeight: layout.heading.lineHeight }, data: { textLayout: layout.heading } }));
      y += layout.heading.height + layout.gap;
    }
    const square = tokenValue(token("space.1"));
    layout.lines.forEach((line, index) => {
      nodes.push(rectPrimitive({ id: stableId(id, "bullet", index), role: "insight-bullet", frame: { x: textX, y: y + line.lineHeight / 2 - square / 2, width: square, height: square }, style: boxStyle(foreground, foreground, HAIRLINE, token("radius.none")) }));
      nodes.push(textPrimitive({ id: stableId(id, "item", index), role: "insight-text", frame: { x: textX + layout.indent, y, width: layout.width - layout.indent, height: line.height }, text: line.text, style: { ...textStyle(BODY, foreground, true, "left", "top"), lineHeight: line.lineHeight }, data: { textLayout: line } }));
      y += line.height + layout.rowGap;
    });
    return nodes;
  }
  for (const [part, measured] of [["heading", layout.heading], ["body", layout.body]]) {
    if (!measured) continue;
    // `highlight`: the phrase the reader should see first, set in the accent
    // inside the sentence. Accent only, never bold - an insight body is already
    // semibold, so the emphasis is colour and the measured width is unchanged.
    const accented = part === "body" && props.highlight && variant !== "primary"
      // `strict: false`: a page-level highlight is offered to every piece of the
      // page's prose, and most of them will not contain it. A phrase that is not
      // there is simply not emphasised - it is not an error.
      ? accentRuns(measured.text, props.highlight, { bold: false, accent: true, strict: false })
      : null;
    // The runs above are cut from the wrapped text, so they carry its line
    // breaks, and the PowerPoint emitter reads a break inside runs as a new
    // paragraph: a highlight that fell just after a wrap split the band into two
    // paragraphs on export. The emitter prefers runs over the unwrapped source,
    // so those travel with the layout.
    const emphasised = accented && accented.some((run) => run.accent);
    const sourceRuns = emphasised && measured.source !== undefined
      ? accentRuns(measured.source, props.highlight, { bold: false, accent: true, strict: false }).map((run) => ({ ...run, bold: true }))
      : null;
    nodes.push(textPrimitive({ id: stableId(id, part), role: `insight-${part}`, frame: { x: textX, y, width: layout.width, height: measured.height }, text: measured.text,
      ...(emphasised ? { runs: accented.map((run) => ({ ...run, bold: true })) } : {}),
      style: { ...textStyle(part === "heading" ? token("type.heading") : layout.bodySize ?? BODY, part === "heading" && variant !== "primary" ? PRIMARY : foreground, true, props.align ?? "left", "top"), ...(variant === "rule" && part === "body" ? { fontFamily: DISPLAY } : {}), lineHeight: measured.lineHeight, wrap: false }, data: { textLayout: sourceRuns ? { ...measured, sourceRuns } : measured } }));
    y += measured.height + layout.gap;
  }
  return nodes;
}

// The covers of the non-consulting design systems. Each is a whole
// construction, not a recolouring: the editorial cover is typographic on paper,
// the journal cover a masthead over a rule, the keynote cover a colour field.
function designedCoverNodes(layout, { id, frame, props }) {
  const nodes = [];
  const keynote = layout === "keynote";
  const ground = keynote ? PRIMARY : token("color.canvas");
  const ink = keynote ? WHITE : INK, secondary = keynote ? WHITE : SECONDARY;
  const x = frame.x + CHROME.left, width = Math.min(frame.width - CHROME.left - CHROME.right, frame.width * (layout === "editorial" ? 0.8 : 0.74));
  const bold = layout !== "editorial";
  const title = measureText(props.title, width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.deckTitle")), bold, wrapWidthRatio: 1 });
  const subtitle = props.subtitle?.trim() ? measureText(props.subtitle, width, { fontFamily: tokenValue(layout === "editorial" ? DISPLAY : FONT), fontSize: tokenValue(token("type.heading")), wrapWidthRatio: 1 }) : null;
  const date = props.date?.trim() ? measureText(props.date, 360, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.compact")), bold: true, wrapWidthRatio: 1 }) : null;
  if (title.lines.length > 3 || subtitle?.lines.length > 2) throw new Error("Cover text exceeds its allocated space; shorten the title or subtitle");
  const gap = tokenValue(token("space.5"));
  nodes.push(rectPrimitive({ id: stableId(id, "surface"), role: "cover-surface", frame, style: boxStyle(ground, ground, HAIRLINE, token("radius.none")) }));
  const text = (part, measured, y, style, family = FONT, w = width, px = x) => nodes.push(textPrimitive({ id: stableId(id, part), role: `cover-${part}`, frame: { x: px, y, width: w, height: measured.height }, text: measured.text, style: { ...style, fontFamily: family, lineHeight: measured.lineHeight, wrap: false }, data: { textLayout: measured } }));
  if (layout === "editorial") {
    // Title on the upper-middle line, a full-measure hairline under it, the
    // standfirst in the serif below; the date is a small label at the top.
    const top = frame.y + frame.height * 0.3;
    if (date) text("date", date, frame.y + CHROME.titleTop, textStyle(token("type.compact"), token("color.accent"), true, "left", "top"), FONT, 360);
    text("title", title, top, textStyle(token("type.deckTitle"), ink, false, "left", "top"), DISPLAY);
    const ruleY = top + title.height + gap;
    nodes.push(openLine(stableId(id, "accent"), x, ruleY, frame.x + frame.width - CHROME.right, ruleY, "cover-accent", RULE, HAIRLINE));
    if (subtitle) text("subtitle", subtitle, ruleY + gap, textStyle(token("type.heading"), secondary, false, "left", "top"), DISPLAY);
  } else if (layout === "journal") {
    // A masthead: the accent tab top-left, the title set large above a full
    // primary rule, the subtitle and date beneath it.
    nodes.push(rectPrimitive({ id: stableId(id, "tab"), role: "cover-tab", frame: { x, y: frame.y, width: 96, height: 14 }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.none")) }));
    const ruleY = frame.y + frame.height * 0.58;
    text("title", title, ruleY - gap - title.height, textStyle(token("type.deckTitle"), ink, true, "left", "top"), DISPLAY);
    nodes.push(rectPrimitive({ id: stableId(id, "accent"), role: "cover-accent", frame: { x, y: ruleY, width: frame.width - CHROME.left - CHROME.right, height: 3 }, style: boxStyle(PRIMARY, "none", HAIRLINE, token("radius.none")) }));
    let y = ruleY + 3 + gap;
    if (subtitle) { text("subtitle", subtitle, y, textStyle(token("type.heading"), secondary, false, "left", "top")); y += subtitle.height + tokenValue(token("space.3")); }
    if (date) text("date", date, y, textStyle(token("type.compact"), SECONDARY, true, "left", "top"), FONT, 360);
  } else {
    // Keynote: the title large and reversed on the primary field, centred on
    // the page's middle line, an accent bar leading it.
    const block = title.height + (subtitle ? gap + subtitle.height : 0);
    const top = frame.y + (frame.height - block) / 2;
    nodes.push(rectPrimitive({ id: stableId(id, "accent"), role: "cover-accent", frame: { x, y: top - gap - 8, width: 96, height: 8 }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.none")) }));
    text("title", title, top, textStyle(token("type.deckTitle"), ink, true, "left", "top"), DISPLAY);
    if (subtitle) text("subtitle", subtitle, top + title.height + gap, textStyle(token("type.heading"), secondary, false, "left", "top"));
    if (date) text("date", date, frame.y + frame.height - CHROME.left - date.height, textStyle(token("type.compact"), secondary, true, "left", "top"), FONT, 360);
  }
  if (props.logo?.trim()) {
    const logo = measureText(props.logo, 320, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.heading")), bold: true, wrapWidthRatio: 1 });
    nodes.push(textPrimitive({ id: stableId(id, "logo"), role: "cover-logo", frame: { x: frame.x + frame.width - CHROME.right - 320, y: frame.y + CHROME.titleTop, width: 320, height: logo.height }, text: logo.text, style: { ...textStyle(token("type.heading"), ink, true, "right", "top"), fontFamily: DISPLAY, lineHeight: logo.lineHeight, wrap: false }, data: { textLayout: logo } }));
  }
  return nodes;
}

function titleNodes({ id, frame, props, section = false, chrome = false }) {
  // The house style decides the title's weight and whether a hairline runs under
  // it: a palette's `style.titleWeight` / `style.titleRule` unless the page says.
  const houseRule = chrome && !section && props.variant === undefined && props.rule === undefined && houseStyle("style.titleRule") === "rule";
  const variant = houseRule ? "with-line" : resolveTitleVariant(props);
  const titleBold = houseStyle("style.titleWeight") !== "regular";
  const ruleGap = tokenValue(token("space.2"));
  const size = section ? token("type.sectionTitle") : token("type.actionTitle");
  const baseTextFrame = chrome
    ? { x: frame.x + CHROME.left, y: frame.y + (props.titleTop ?? CHROME.titleTop), width: props.availableTitleWidth ?? frame.width - CHROME.left - CHROME.right, height: CHROME.titleHeight }
    : { x: frame.x, y: frame.y, width: frame.width, height: frame.height - ruleGap };
  // Fit ladder: the action title is set at 24pt; a title that needs a third line
  // is retried at 22pt. Beyond that the page gate (TITLE_LINES) reports it.
  // An optional lead-in ("Why", "Drive") is set in the accent colour as a run.
  const lead = typeof props.lead === "string" && props.lead.trim() && props.text.startsWith(props.lead) ? props.lead : null;
  // The house decides how a lead reads: in the accent before the rest
  // ("South Korea: …"), or as "Topic | statement" with the topic in bold, a pipe,
  // and the statement in the title weight. The pipe replaces a colon or dash
  // after the lead while retaining a single title hierarchy.
  const pipe = lead && chrome && houseStyle("style.titleLead") === "pipe";
  const restOf = (text) => pipe ? text.slice(lead.length).replace(/^\s*[:\-–—|]?\s*/, "") : text.slice(lead.length);
  const runsFor = () => pipe
    ? [{ text: lead, bold: true }, { text: " | ", bold: false }, { text: restOf(props.text), bold: titleBold }]
    : [{ text: lead, bold: titleBold, accent: true }, { text: props.text.slice(lead.length), bold: titleBold }];
  const measureTitle = (fontSize, width = baseTextFrame.width) => lead
    ? measureTextRuns(runsFor(), width, { fontFamily: tokenValue(DISPLAY), fontSize, wrapWidthRatio: 0.98 })
    : measureText(props.text, width, { fontFamily: tokenValue(DISPLAY), fontSize, bold: titleBold, wrapWidthRatio: 0.98 });
  let fontSize = tokenValue(size), textLayout = measureTitle(fontSize);
  if (chrome && !section && textLayout.lines.length > 2) {
    const long = tokenValue(token("type.actionTitleLong"));
    const retry = measureTitle(long);
    if (retry.lines.length < textLayout.lines.length) { fontSize = long; textLayout = retry; }
  }
  let titleWidth = baseTextFrame.width;
  if (chrome && !section && !String(props.text).includes("\n") && textLayout.lines.length === 2 && textLayout.lines[1].trim().split(/\s+/).length === 1) {
    for (const ratio of [.95, .9, .85, .8, .75, .7, .65, .6]) {
      const width = baseTextFrame.width * ratio, balanced = measureTitle(fontSize, width);
      if (balanced.lines.length > 2) break;
      if (balanced.lines[1].trim().split(/\s+/).length >= 3) { titleWidth = width; textLayout = balanced; break; }
    }
  }
  const textFrame = chrome ? { ...baseTextFrame, width: titleWidth, height: Math.max(baseTextFrame.height, textLayout.height) } : baseTextFrame;
  const ruleY = textFrame.y + textLayout.height + ruleGap;
  if (!chrome && textLayout.height > textFrame.height) throw new Error(`Title ${id} exceeds its allocated height; shorten it or allocate more space`);
  const nodes = [textPrimitive({
    id: stableId(id, chrome ? "title" : "text"),
    role: section ? "section-title" : "action-title",
    frame: textFrame,
    text: textLayout.text,
    ...(lead ? { runs: textLayout.runs } : {}),
    style: { ...textStyle(fontSize === tokenValue(size) ? size : token("type.actionTitleLong"), INK, titleBold), fontFamily: DISPLAY, valign: "top", lineHeight: textLayout.lineHeight, wrap: false },
    data: { titleVariant: variant, textLayout, ruleGap, ...(lead ? { lead } : {}) }
  })];
  if (TITLE_VARIANTS[variant].rule) nodes.push(openLine(stableId(id, chrome ? "title-rule" : "rule"), textFrame.x, ruleY, textFrame.x + textFrame.width, ruleY, "title-rule", RULE, HAIRLINE, { titleVariant: variant }));
  return nodes;
}

function headingLayout(frame, props = {}) {
  assertSectionHeadingProps(props);
  const headingWidth = frame.width;
  const heading = measureText(props.heading || props.text || "", headingWidth, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")), bold: true });
  const bandHeight = Math.max(heading.height, props.headerBandHeight || 0);
  // Row rule: peers in a row share one band. Every heading sits on the band's
  // top line (so a heading beside a chart heading reads on the same line) and
  // the rule sits under the band, one baseline unit below its bottom; the body
  // sits a clear step below the rule.
  // The gap is reserved whether or not the rule is inked. Panels in a row are
  // read across, and a panel whose ground does the separating (muted, tint) or
  // whose band is blank would otherwise start its contents one baseline unit
  // above its neighbour's - four pixels of drift down a row of tables, which is
  // enough to see and impossible to explain. What is drawn in the band is a
  // question about the ground; how tall the band is, is a question about the
  // row.
  const ruleGap = tokenValue(token("space.1"));
  const contentGap = tokenValue(token("space.4"));
  return { heading, headingWidth, bandHeight, ruleGap, height: bandHeight + ruleGap + contentGap };
}

function sectionHeadingNodes({ id, frame, props = {} }) {
  const variant = props.variant || "standard";
  const color = variant === "inverse" ? WHITE : variant === "accent" ? PRIMARY : INK;
  const layout = headingLayout(frame, props);
  const { heading, headingWidth, bandHeight, ruleGap } = layout;
  // A blank heading is the row rule's doing: a panel whose neighbour is named
  // keeps an empty band of the same height so the two start their content on
  // one line. The band is space, not a heading - so it prints nothing, and a
  // rule under nothing is a rule under nothing. The height stays reserved
  // either way, which is the whole reason the blank band exists.
  if (!String(props.heading ?? props.text ?? "").trim()) return [];
  const showRule = props.rule !== false && props.headingRule !== false;
  const nodes = [textPrimitive({
    id: stableId(id, "heading"),
    role: "section-heading",
    frame: { x: frame.x, y: frame.y, width: headingWidth, height: heading.height },
    text: heading.text,
    style: { ...textStyle(token("type.heading"), color, true, "left", "top"), lineHeight: heading.lineHeight, wrap: false },
    data: { textLayout: heading, headerTop: frame.y, headerBandHeight: bandHeight, ruleGap }
  })];
  if (showRule) nodes.push(openLine(stableId(id, "rule"), frame.x, frame.y + bandHeight + ruleGap, frame.x + frame.width, frame.y + bandHeight + ruleGap, "section-heading-rule", color, HAIRLINE));
  return nodes;
}

function contentRailInsets(props = {}) {
  return props.treatment === "open"
    ? { top: 0, right: 18, bottom: 18, left: 18 }
    : 18;
}

/** Boxed sections pad on all sides; open sections keep the grid's left and right edges. */
function sectionPadding(props = {}) {
  if (props.padding !== undefined) return normalizeInsets(props.padding);
  const treatment = props.treatment || "open";
  // A filled panel breathes: a well-made panel sets its copy a full gutter off
  // every edge, not the four pixels a tint can get away with.
  const value = tokenValue(token("space.5"));
  return treatment === "open" ? { top: 0, right: 0, bottom: 0, left: 0 } : { top: value, right: value, bottom: value, left: value };
}

function sectionContentInsets(frame, props = {}) {
  const padding = sectionPadding(props);
  const headerFrame = insetFrame(frame, padding);
  const header = props.heading ? headingLayout(headerFrame, { ...props, rule: props.treatment !== "muted" && props.treatment !== "tint" }).height : 0;
  return { ...padding, top: padding.top + header };
}

function resolveChartTitleVariant(props = {}) {
  assertChartTitleCopy(props);
  if (props.unit !== undefined && (typeof props.unit !== "string" || !props.unit.trim())) throw new Error("Chart title unit must be nonempty text");
  const variant = props.variant ?? "underlined";
  if (!["underlined", "unit"].includes(variant)) throw new Error(`Unknown chart-title variant: ${variant}`);
  if (variant === "unit" && (typeof props.unit !== "string" || !props.unit.trim())) throw new Error("Chart title unit variant requires a unit");
  return variant;
}
// Chart titles identify the measure, population and period. Values and changes
// belong on chart marks/annotations, never in this shared title band. Keep this
// fail-closed: numeric context must use an unambiguous period or unit spelling.
function assertChartTitleCopy(props = {}) {
  for (const [field, value] of [["heading", props.heading || props.text], ["unit", props.unit]]) {
    if (typeof value !== "string") continue;
    let copy = value.normalize("NFKC");
    // A complete index-scale definition may use a scenario baseline rather
    // than a calendar year. Anchor the whole unit so appended results reject.
    if (field === "unit" && /^(?:index\s*[,;:]?\s*)?(?:base|baseline)\s*=\s*(?:1|100)\s*$/i.test(copy.trim())) continue;
    const year = "(?:19|20)\\d{2}";
    const fiscalYear = `(?:${year}|\\d{2})`;
    const month = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
    // "March 2026" is the date the measure is taken at, as "FY26" is.
    // "31 March 2026", "calendar 2025": the date or year the measure is taken at.
    copy = copy.replace(new RegExp(`\\b(?:\\d{1,2}\\s+)?${month}\\.?\\s+${year}\\b`, "gi"), "period");
    copy = copy.replace(new RegExp(`\\b(?:calendar|fiscal|financial)\\s+(?:year\\s+)?${year}\\b`, "gi"), "period");
    const period = `(?:FY\\s*${fiscalYear}(?:\\s*[-–/]\\s*(?:FY\\s*)?${fiscalYear})?|[QH][1-4](?:\\s+${year})?|${month}\\.?\\s+${year}|${year}\\s*[-–/]\\s*(?:${year}|\\d{2}))`;
    copy = copy.replace(new RegExp(`\\bindex(?:ed)?\\b[^\\d]*${year}\\s*=\\s*100\\b`, "gi"), "index base"); // "Index, 2021 = 100" names the base, not a result
    copy = copy.replace(/\b[nN]\s*=\s*[\d,.]+\b/g, "sample size"); // "n = 240" is the population, not a result
    copy = copy.replace(new RegExp(`\\b${period}\\b(?![\\d.%])`, "gi"), "period");
    copy = copy.replace(new RegExp(`\\b(?:in|during|for|since|through|to|versus|vs\\.?|year)\\s+${year}\\b(?![\\d.%])`, "gi"), "period");
    copy = copy.replace(new RegExp(`([,(]\\s*)${year}(?=\\s*(?:$|[,) ;]))`, "g"), "$1period");
    copy = copy.replace(new RegExp(`^\\s*${year}(?=\\s*(?:$|[,;) ]))`), "period"); // a unit line that opens with its period
    // A bounded observation window describes the measure. Mask only the
    // complete duration phrase so adjoining result values still reject.
    copy = copy.replace(/\bwithin\s+(?:one|1)\s+year\b/gi, "within observation period");
    // Scale denominators and named budgets/thresholds describe the measure, not a result.
    copy = copy.replace(/\bper\s+(?:100[,. ]?000|100k|1[,. ]?000|1k|100|10|1)\b(?:\s+(?:residents|people|employees|units|capita))?/gi, "per population");
    copy = copy.replace(/\b\d+(?:\.\d+)?\s*(?:-|–)\s*(?:minute|min|hour|day|week|month|year)\b/gi, "duration"); // "45-minute limit" names a threshold
    copy = copy.replace(/\b(?:above|below|under|over|at least|at most)\s+[$€£]?\d+(?:[.,]\d+)?\s*(?:bn|billion|million|m|k|%|hours?|minutes?)\b/gi, "population threshold");
    // Model and product designations name a thing, not a result: A350-1000,
    // A321neo, 787-9, 737 MAX 8, iPhone 15. A token that mixes letters and
    // digits, or a three-digit model with a short variant, is masked.
    copy = copy.replace(/\b(?=[A-Za-z]*\d)(?=\d*[A-Za-z])[A-Za-z0-9]{2,}(?:-[A-Za-z0-9]+)*\b/g, "designation");
    copy = copy.replace(/\b\d{3}(?:-\d{1,2}[A-Za-z]*|\s+MAX(?:\s+\d{1,2})?)\b/g, "designation");
    const numberWords = "(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)";
    // A number word is a result only when it quantifies a change or share ("twenty percent", "one point"),
    // not when it counts things the chart shows ("three monthly budgets").
    if (/\p{N}/u.test(copy) || /\b(?:doubled|tripled|halved)\b/i.test(copy) || new RegExp(`\\b${numberWords}\\s+(?:percent|per\\s*cent|points?|pts|x|times|fold|percentage)`, "i").test(copy)) {
      throw new Error(`Chart title ${field} must not contain statistics or chart results: ${JSON.stringify(value)}. Use a descriptive measure/population heading and explicit period; move values and changes to chart labels or annotations.`);
    }
  }
}
// Chart headings default to measure plus inline unit in one ruled band.
// Explicit legacy layouts may stack the unit; peers reserve a shared band.
function chartTitleLayout(frame, props) {
  const variant = resolveChartTitleVariant(props);
  // The house style `band` sets the heading in white on a filled grey band with
  // side padding; the unit line then sits under the band.
  const band = houseStyle("style.chartHeading") === "band";
  const padX = band ? tokenValue(token("space.3")) : 0, padY = band ? tokenValue(token("space.2")) : 0;
  const rawHeading = String(props.heading || props.text || "").trimEnd();
  const headingText = props.unit ? rawHeading.replace(/,\s*$/, "") : rawHeading;
  const measureHeading = (text) => measureText(text, frame.width - 2 * padX, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")), bold: !band });
  let heading = measureHeading(headingText);
  // The stacked unit line is compact grey under the heading; the inline unit
  // sits on the heading's line at the heading's size, after a comma in the heading.
  // The inline unit is tried first and falls back to the stacked line — at the
  // compact size — when the heading wraps or the pair will not fit on the line.
  const inlineGap = tokenValue(token("space.2"));
  const measureUnit = (size) => props.unit ? measureText(props.unit, frame.width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(size), wrapWidthRatio: 1 }) : null;
  // A ruled heading always takes the unit inline: a second line under the
  // heading pushes the rule down, and then no two panels in a row share a rule.
  // The stacked unit line belongs to headings that carry no rule.
  const underlined = resolveChartTitleVariant(props) === "underlined" && !band;
  const wanted = (props.unitPlacement === "inline" || underlined) && !band && heading.lines.length === 1;
  const inlineHeading = wanted ? measureHeading(`${headingText},`) : null;
  const inlineMeasure = wanted ? measureUnit(token("type.heading")) : null;
  const inline = Boolean(inlineMeasure) && inlineHeading.lines.length === 1 && inlineMeasure.lines.length === 1 && inlineHeading.width + inlineGap + inlineMeasure.width <= frame.width - 2 * padX;
  if (inline) heading = inlineHeading;
  const unitSize = inline ? token("type.heading") : COMPACT;
  const unit = inline ? inlineMeasure : measureUnit(COMPACT);
  if (unit && unit.lines.length !== 1) throw new Error("Chart unit must fit on one line; shorten the unit (e.g. \"$m\" not \"millions of US dollars\")");
  // `unitPlacement: "inline"` (the composer's choice for a chart beside a text
  // column) sets the unit after the heading on the same line, in grey, so the
  // heading band is one line and level with the side column's heading. It
  // falls back to the stacked unit line when the heading wraps or the unit
  // would not fit beside it.
  const unitGap = unit && !inline ? (band ? tokenValue(token("space.2")) : tokenValue(token("space.1")) / 2) : 0;
  const block = heading.height + 2 * padY + (unit && !inline ? unitGap + unit.height : 0);
  const bandHeight = Math.max(block, props.headerBandHeight || 0);
  const ruled = variant === "underlined" && !band;
  const ruleGap = tokenValue(token("space.1")), contentGap = tokenValue(token("space.3"));
  const height = bandHeight + (ruled ? ruleGap : 0) + contentGap;
  // A hero chart's banner is one line. When the composer asked for the inline
  // unit and the pair would not fit — a heading that wraps, or a unit carrying
  // a qualification that belongs in the note — the band silently becomes two
  // lines, so the fallback is recorded and the page gates report it.
  const wrapped = !band && (props.unitPlacement === "inline" || underlined) && (heading.lines.length > 1 || (unit && !inline));
  return { heading, unit, unitSize, unitGap, inline, inlineGap, unitPlacement: unit ? (inline ? "inline" : "stacked") : "none", wrapped, block, bandHeight, ruleGap, contentHeight: bandHeight, ruled, variant, height, band, padX, padY };
}
function chartTitleNodes({ id, frame, props }) {
  const layout = chartTitleLayout(frame, props);
  if (layout.height > frame.height) throw new Error(`Chart title ${id} exceeds its allocated height; shorten the heading or unit, or allocate more height`);
  const blockTop = frame.y + layout.padY;
  const nodes = [];
  if (layout.band) nodes.push(rectPrimitive({ id: stableId(id, "band"), role: "chart-heading-band", frame: { x: frame.x, y: frame.y, width: frame.width, height: layout.heading.height + 2 * layout.padY }, style: boxStyle(SECONDARY, "none", HAIRLINE, token("radius.none")) }));
  nodes.push(textPrimitive({
    id: stableId(id, "heading"),
    role: "section-heading",
    frame: { x: frame.x + layout.padX, y: blockTop, width: frame.width - 2 * layout.padX, height: layout.heading.height },
    text: layout.heading.text,
    style: { ...textStyle(token("type.heading"), layout.band ? WHITE : INK, !layout.band, "left", "top"), lineHeight: layout.heading.lineHeight, wrap: false },
    data: { textLayout: layout.heading, headerTop: frame.y, headerBandHeight: layout.bandHeight, ruleGap: layout.ruleGap, chartTitleVariant: layout.variant, chartUnitPlacement: layout.unitPlacement, ...(layout.wrapped ? { headingWrapped: true } : {}) }
  }));
  if (layout.unit) nodes.push(textPrimitive({
    id: stableId(id, "unit"),
    role: "chart-unit",
    frame: layout.inline
      ? { x: frame.x + layout.padX + layout.heading.width + layout.inlineGap, y: blockTop, width: Math.max(layout.unit.width + 4, frame.width - layout.padX - layout.heading.width - layout.inlineGap), height: layout.unit.height }
      : { x: frame.x, y: blockTop + layout.heading.height + layout.padY + layout.unitGap, width: frame.width, height: layout.unit.height },
    text: props.unit,
    style: { ...textStyle(layout.unitSize, token("color.chartUnit"), false, "left", "top"), lineHeight: layout.unit.lineHeight, wrap: false },
    data: { textLayout: layout.unit, chartTitleVariant: layout.variant, chartUnitPlacement: layout.unitPlacement }
  }));
  if (props.badge) {
    // A right-aligned statistic pill on the heading line ("CAGR 2024–30: +13%").
    const badge = measureText(String(props.badge), frame.width * 0.5, { fontFamily: tokenValue(FONT), fontSize: tokenValue(COMPACT), bold: true, wrapWidthRatio: 1 });
    if (badge.lines.length === 1) {
      const pad = tokenValue(token("space.2")), w = Math.ceil(badge.width) + 2 * pad, h = badge.height + tokenValue(token("space.1"));
      const bx = frame.x + frame.width - w, by = frame.y + (layout.heading.height - h) / 2;
      nodes.push(rectPrimitive({ id: stableId(id, "badge-surface"), role: "chart-badge-surface", frame: { x: bx, y: by, width: w, height: h }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.round")) }));
      nodes.push(textPrimitive({ id: stableId(id, "badge"), role: "chart-badge", frame: { x: bx + pad, y: by + (h - badge.height) / 2, width: w - 2 * pad, height: badge.height }, text: badge.text, style: { ...textStyle(COMPACT, WHITE, true, "center", "top"), lineHeight: badge.lineHeight, wrap: false }, data: { textLayout: badge } }));
    }
  }
  if (layout.ruled) nodes.push(openLine(stableId(id, "rule"), frame.x, frame.y + layout.bandHeight + layout.ruleGap, frame.x + frame.width, frame.y + layout.bandHeight + layout.ruleGap, "section-heading-rule", INK, HAIRLINE, { chartTitleVariant: layout.variant }));
  return nodes;
}

function estimatedLines(text, width) {
  const charactersPerLine = Math.max(12, Math.floor(width / 7));
  return String(text).split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
}

/**
 * Body list items are strings or { lead?, text?, icon?, state?, number? }. The
 * marker is one of: dot (a small ink square), number (the deck's numbered disc),
 * icon (a line icon in a ring), check (green tick / red cross by `state`).
 * "auto" picks number when any item carries a lead, dot otherwise.
 */
export function normalizeListItems(items) {
  if (!Array.isArray(items) || !items.length) throw new Error("Body bullet list needs nonempty text items");
  return items.map((item, index) => {
    const o = typeof item === "string" ? { text: item } : item && typeof item === "object" ? { ...item } : null;
    if (!o) throw new Error("Body bullet list needs nonempty text items");
    const lead = typeof o.lead === "string" && o.lead.trim() ? o.lead.trim() : null;
    const text = typeof o.text === "string" && o.text.trim() ? o.text.trim() : null;
    if (!lead && !text) throw new Error("Body bullet list needs nonempty text items");
    // `highlight`: the phrase (or phrases) inside the point that reads in the
    // house colour, which is how a well-made page emphasises the finding
    // inside a sentence rather than bolding the whole line.
    const highlight = o.highlight === undefined || o.highlight === null ? null : o.highlight;
    // `points`: sub-points under the item, each a short line set at an indent
    // with a dash - the way a strong executive summary develops a statement
    // into its parts ("the vision includes: - better data - planning ...").
    if (o.points !== undefined && (!Array.isArray(o.points) || o.points.some((sub) => typeof sub !== "string" || !sub.trim()))) {
      throw new Error("A point's sub-points are a list of nonempty strings");
    }
    const points = (o.points || []).map((sub) => sub.trim());
    return { lead, text, icon: o.icon ?? null, state: o.state ?? null, highlight, number: o.number ?? index + 1, points };
  });
}

export function resolveListMarker(props) {
  const items = normalizeListItems(props.items);
  const marker = props.marker ?? "auto";
  // The plain marker follows the house style: a square dot, or a short dash.
  if (marker === "auto") return items.some((i) => i.icon) ? "icon" : items.some((i) => i.state !== null) ? "check" : items.some((i) => i.lead) ? "number" : houseStyle("style.listMarker") === "dash" ? "dash" : "dot";
  // `none` is the prose column (a bold lead and its paragraph, nothing in the
  // gutter), `rule` separates items with a hairline instead of marking them,
  // and `letter` is A / B / C for options rather than steps - the devices a
  // strong deck uses where we only ever reached for the numbered disc.
  if (!["dot", "dash", "number", "letter", "icon", "icon-ring", "check", "none", "rule"].includes(marker)) throw new Error(`Unknown list marker: ${marker}`);
  return marker;
}

function bodyListLayout(frame, itemsIn, props = {}) {
  const items = normalizeListItems(itemsIn);
  const marker = resolveListMarker({ ...props, items: itemsIn });
  const disc = markerSize();
  // A well-made icon list sets the glyph alone in the house colour, about
  // twice the text line, with the text beside it and room between the rows -
  // not a small icon in a ring. `marker: "icon-ring"` keeps the ringed marker.
  const ringed = marker === "icon-ring";
  const iconSize = Math.round(disc * (ringed ? 1.5 : 1.75));
  const iconList = marker === "icon" || ringed;
  const plain = marker === "dot" || marker === "dash";
  // A prose or ruled column has nothing in its gutter, so the text starts at
  // the frame edge and the space goes to the measure instead of the marker.
  const bare = marker === "none" || marker === "rule";
  const markerWidth = plain || bare ? 0 : iconList ? iconSize : disc;
  const offset = bare ? 0 : plain ? tokenValue(token("space.4")) : markerWidth + tokenValue(token(iconList && !ringed ? "space.4" : "space.3"));
  const gap = tokenValue(token(marker === "rule" ? "space.4" : plain ? "space.2" : iconList && !ringed ? "space.4" : "space.3"));
  const leadGap = tokenValue(token("space.1"));
  const markerSquare = tokenValue(token("space.1"));
  if (frame.width <= offset) throw new Error("Body bullet list has no text width; give the list a wider frame");
  const width = frame.width - offset;
  const font = { fontFamily: tokenValue(FONT), fontSize: tokenValue(BODY), wrapWidthRatio: 1 };
  const subIndent = tokenValue(token("space.5"));
  // `inlineLead`: the lead runs *into* the sentence in the house accent rather
  // than sitting above it in bold - the way a well-made icon list sets the
  // phrase that carries the finding. The item then measures as one block.
  const inlineLead = props.inlineLead === true;
  const measured = items.map((item) => {
    if (inlineLead && item.lead && item.text) {
      const joined = `${item.lead} ${item.text}`;
      const runs = accentRuns(joined, item.highlight ?? [item.lead], { bold: true, accent: true, strict: false })
        || [{ text: joined }];
      const block = measureTextRuns(runs, width, font);
      const subs = item.points.map((sub) => measureText(sub, Math.max(1, width - subIndent), font));
      const subHeight = subs.reduce((sum, sub) => sum + sub.height, 0) + (subs.length ? leadGap * subs.length : 0);
      return { item, lead: null, text: block, subs, textHeight: block.height + subHeight, height: Math.max(block.height + subHeight, markerWidth) };
    }
    // A highlight inside the lead is set in the accent on the lead's own line;
    // inside the text it flows with the sentence.
    // `strict: false`: the page's own highlight is offered to every point, and
    // a point that does not say the phrase simply does not emphasise it. Before
    // a page-level highlight existed this threw, which was right when the only
    // way to set one was to write it on the point that already said it.
    const leadRuns = item.lead ? accentRuns(item.lead, item.highlight, { bold: true, strict: false }) : null;
    const textRuns = item.text && !(leadRuns && leadRuns.some((run) => run.accent)) ? accentRuns(item.text, item.highlight, { bold: houseStyle("style.labelWeight") !== "regular", strict: false }) : null;
    const lead = item.lead ? (leadRuns && leadRuns.some((run) => run.accent) ? measureTextRuns(leadRuns.map((run) => ({ ...run, bold: true })), width, font) : measureText(item.lead, width, { ...font, bold: true })) : null;
    const text = item.text ? (textRuns ? measureTextRuns(textRuns, width, font) : measureText(item.text, width, font)) : null;
    const subs = item.points.map((sub) => measureText(sub, Math.max(1, width - subIndent), font));
    const subHeight = subs.reduce((sum, sub) => sum + sub.height, 0) + (subs.length ? leadGap * subs.length : 0);
    const textHeight = (lead?.height ?? 0) + (lead && text ? leadGap : 0) + (text?.height ?? 0) + subHeight;
    return { item, lead, text, subs, textHeight, height: Math.max(textHeight, markerWidth) };
  });
  return { marker, offset, gap, leadGap, subIndent, ringed, markerSize: plain ? markerSquare : markerWidth, measured, height: measured.reduce((sum, m) => sum + m.height, 0) + gap * (items.length - 1) };
}

function bodyListNodes({ id, frame, props }) {
  const layout = bodyListLayout(frame, props.items, props);
  if (layout.height > frame.height + 0.01) throw new Error(`${id} body bullets exceed the allocated height; allocate space or edit copy, never shrink type`);
  // `distribute: true` (a side column on any deck that is not airy) spreads the
  // rows down the frame instead of stacking them at the top. The gap is capped
  // near the height of a two-line item: past that the list reads as a menu, and
  // the answer to a column that still ends early is more content or a narrower
  // column, not more air.
  const spare = Math.max(0, frame.height - layout.height);
  // The spread opens a reading gap, not a chasm: past about a line of text the
  // points stop reading as one column and start reading as three labels adrift
  // in it. A column that still ends high wants another point, not more air -
  // which is what the column and page floors ask for.
  const extraGap = props.distribute === true && layout.measured.length > 1 ? Math.min(spare / (layout.measured.length - 1), 24) : 0;
  // Whatever the cap leaves over is split above and below the list rather than
  // dropped under it. A column that opens its gaps to the cap and then hugs the
  // top still ends two fifths up the track, with all the slack in one band at
  // the foot - which reads as an unfinished page, not as air. Centred, the same
  // leftover reads as the margin around a block. The gap does the reading work;
  // the centring stops the remainder pooling in one place.
  // On a dark or primary panel the list reads in white: white text, white markers,
  // reversed number discs.
  const inverse = props.tone === "inverse";
  if (props.tone !== undefined && !["standard", "inverse"].includes(props.tone)) throw new Error(`Unknown bullet-list tone: ${props.tone}`);
  const INK_ = inverse ? WHITE : INK;
  // `centre: false` keeps the block at the top of its track. The leftover is
  // only a margin when the list owns the track: under a kpi or an insight it
  // reads as a gap between the two, and in a two-column split it lands the
  // halves on different tops.
  const centred = props.centre !== false;
  let y = frame.y + (centred && extraGap > 0 ? Math.max(0, spare - extraGap * (layout.measured.length - 1)) / 2 : 0);
  const nodes = [];
  layout.measured.forEach((m, index) => {
    const first = m.lead ?? m.text;
    const lineCentre = y + first.lineHeight / 2;
    const mid = y + m.height / 2;
    if (layout.marker === "dot") {
      nodes.push(rectPrimitive({ id: stableId(id, "marker", index), role: "list-marker", frame: { x: frame.x, y: lineCentre - layout.markerSize / 2, width: layout.markerSize, height: layout.markerSize }, style: boxStyle(INK_, INK_, HAIRLINE, token("radius.none")) }));
    } else if (layout.marker === "dash") {
      nodes.push(rectPrimitive({ id: stableId(id, "marker", index), role: "list-marker", frame: { x: frame.x, y: lineCentre - 0.5, width: tokenValue(token("space.2")), height: 1 }, style: boxStyle(INK_, INK_, HAIRLINE, token("radius.none")) }));
    } else if (layout.marker === "number" || layout.marker === "letter") {
      // `state: "open"` hollows the disc: a well-made ledger runs solid discs
      // for what is done and outlined ones for what is not, on one list.
      const hollow = m.item.state === "open";
      const label = layout.marker === "letter" ? String.fromCharCode(64 + Number(m.item.number || index + 1)) : m.item.number;
      nodes.push(...numberMarker({ id: stableId(id, "marker", index), role: "list-marker", x: frame.x, y: Math.max(y, lineCentre - layout.markerSize / 2), size: layout.markerSize, number: label, reverse: inverse || hollow }));
    } else if (layout.marker === "rule") {
      // Nothing. This style used to draw a hairline between every item, with a
      // full item gap either side of it, so three sentences came out as three
      // ruled boxes with more rule than reason. The gap already separates them;
      // the rule only adds noise and the extra air makes the page read loose.

    } else if (layout.marker === "none") {
      // Nothing in the gutter; the lead carries the item.
    } else if (layout.marker === "check") {
      nodes.push(...stateMarker({ id: stableId(id, "marker", index), role: "list-marker", x: frame.x, y: Math.max(y, lineCentre - layout.markerSize / 2), size: layout.markerSize, state: m.item.state ?? "yes" }));
    } else {
      // A ringed icon centres on the item block, as on a feature row. A plain
      // glyph sits on the first line, the way a well-made icon list reads down
      // a column whose items run to three and four lines.
      const iconY = layout.ringed ? mid - layout.markerSize / 2 : Math.max(y, lineCentre - layout.markerSize / 2);
      // A RINGED marker is a marker, not the finding. Drawn in the house
      // primary it is a column of blue discs down the left of three sentences,
      // louder than the highlighted phrase inside them and saying nothing - so
      // the ring is a hairline and its glyph secondary. A bare glyph with no
      // ring keeps the accent: there it is the only mark the item has - but
      // only where the author named it. An item with no icon of its own falls
      // back to an "i" in a circle, and three of those down a column in the
      // house accent are three blue marks louder than the phrase they sit
      // beside, saying nothing the list did not already say. Unauthored, the
      // fallback is secondary.
      nodes.push(...iconMarker({ id: stableId(id, "marker", index), role: "list-icon", x: frame.x, y: iconY, size: layout.markerSize, icon: m.item.icon || "info", tone: inverse ? "inverse" : layout.ringed || !m.item.icon ? "muted" : "accent" }));
    }
    let ty = layout.ringed && m.textHeight < m.height ? y + (m.height - m.textHeight) / 2 : y;
    if (m.lead) {
      nodes.push(textPrimitive({ id: stableId(id, "lead", index), role: "list-lead", frame: { x: frame.x + layout.offset, y: ty, width: frame.width - layout.offset, height: m.lead.height }, text: m.lead.text, ...(m.lead.runs && m.lead.runs.some((run) => run.accent) && !inverse ? { runs: m.lead.runs } : {}), style: { ...textStyle(BODY, INK_, true, "left", "top"), lineHeight: m.lead.lineHeight }, data: { textLayout: m.lead } }));
      ty += m.lead.height + (m.text ? layout.leadGap : 0);
    }
    if (m.text) nodes.push(textPrimitive({ id: stableId(id, "item", index), role: "list-item", frame: { x: frame.x + layout.offset, y: ty, width: frame.width - layout.offset, height: m.text.height }, text: m.text.text, ...(m.text.runs && m.text.runs.some((run) => run.accent) && !inverse ? { runs: m.text.runs } : {}), style: { ...textStyle(BODY, INK_, false, "left", "top"), lineHeight: m.text.lineHeight }, data: { textLayout: m.text } }));
    if (m.text) ty += m.text.height;
    m.subs.forEach((sub, k) => {
      ty += layout.leadGap;
      const x = frame.x + layout.offset;
      nodes.push(rectPrimitive({ id: stableId(id, "sub-marker", index, k), role: "list-submarker", frame: { x: x + 4, y: ty + sub.lineHeight / 2 - 0.5, width: tokenValue(token("space.2")), height: 1 }, style: boxStyle(INK_, INK_, HAIRLINE, token("radius.none")) }));
      nodes.push(textPrimitive({ id: stableId(id, "sub", index, k), role: "list-subitem", frame: { x: x + layout.subIndent, y: ty, width: frame.width - layout.offset - layout.subIndent, height: sub.height }, text: sub.text, style: { ...textStyle(BODY, INK_, false, "left", "top"), lineHeight: sub.lineHeight }, data: { textLayout: sub } }));
      ty += sub.height;
    });
    y += m.height + layout.gap + extraGap;
  });
  return nodes;
}

function simpleList({ id, frame, items, numbered = false, markerColor = PRIMARY, marker = "circle", distribute = false, rolePrefix = "list" }) {
  const defaultGap = tokenValue(token("space.3"));
  const minimumGap = tokenValue(token("space.1"));
  const markerSize = numbered ? 24 : ["square", "circle"].includes(marker) ? 6 : 18;
  const textOffset = numbered ? 36 : ["square", "circle"].includes(marker) ? 18 : 36;
  const textWidth = Math.max(1, frame.width - textOffset);
  let heights = items.map((item) => Math.max(28, estimatedLines(item, textWidth) * 20));
  let gap = defaultGap;
  if (distribute) {
    const distributedHeight = (frame.height - defaultGap * Math.max(0, items.length - 1)) / Math.max(1, items.length);
    heights = items.map(() => distributedHeight);
  } else {
    const desiredHeight = heights.reduce((sum, value) => sum + value, 0) + gap * Math.max(0, items.length - 1);
    if (desiredHeight > frame.height && items.length > 1) {
      gap = minimumGap;
      const available = Math.max(items.length * 20, frame.height - gap * (items.length - 1));
      const scale = Math.min(1, available / heights.reduce((sum, value) => sum + value, 0));
      heights = heights.map((value) => Math.max(20, value * scale));
    }
  }
  const nodes = [];
  let cursor = frame.y;
  items.forEach((item, index) => {
    const height = heights[index];
    const y = cursor;
    if (numbered) {
      nodes.push(ellipsePrimitive({ id: stableId(id, "marker", index), role: `${rolePrefix}-marker`, frame: { x: frame.x, y: y + 2, width: markerSize, height: markerSize }, style: boxStyle(markerColor, markerColor, HAIRLINE, token("radius.round")) }));
      nodes.push(textPrimitive({ id: stableId(id, "marker-label", index), role: `${rolePrefix}-marker-label`, frame: { x: frame.x, y: y + 2, width: markerSize, height: markerSize }, text: String(index + 1), style: textStyle(LABEL, WHITE, true, "center") }));
    } else if (marker === "circle") {
      const firstLineHeight = tokenValue(COMPACT) * 1.2;
      nodes.push(ellipsePrimitive({ id: stableId(id, "marker", index), role: `${rolePrefix}-marker`, frame: { x: frame.x + 2, y: y + (firstLineHeight - markerSize) / 2, width: markerSize, height: markerSize }, style: boxStyle(markerColor, markerColor, HAIRLINE, token("radius.round")) }));
    } else if (marker === "square") {
      nodes.push(rectPrimitive({ id: stableId(id, "marker", index), role: `${rolePrefix}-marker`, frame: { x: frame.x + 2, y: y + 9, width: markerSize, height: markerSize }, style: boxStyle(markerColor, markerColor, HAIRLINE, token("radius.none")) }));
    } else {
      nodes.push(shapePrimitive({ id: stableId(id, "marker", index), role: `${rolePrefix}-marker`, geometry: "rightArrow", frame: { x: frame.x + 2, y: y + 5, width: markerSize, height: markerSize }, style: boxStyle(markerColor, markerColor, HAIRLINE, token("radius.none")) }));
    }
    nodes.push(textPrimitive({ id: stableId(id, "item", index), role: `${rolePrefix}-item`, frame: { x: frame.x + textOffset, y, width: textWidth, height }, text: item, style: textStyle(COMPACT, INK, false, "left", "top") }));
    cursor += height + gap;
  });
  return nodes;
}


function processNodes({ id, frame, props, roadmap = false, journey = false }) {
  const items = props.items;
  if (!Array.isArray(items) || !items.length) throw new Error(`${id} requires ordered stages`);
  const nodes = [];
  const span = frame.width / items.length;
  const railY = frame.y + frame.height * (roadmap ? 0.32 : 0.48);
  nodes.push(openLine(stableId(id, "rail"), frame.x + span * 0.35, railY, frame.x + frame.width - span * 0.35, railY, "process-rail", PRIMARY, STANDARD));
  items.forEach((item, index) => {
    if (typeof item.label !== "string" || !item.label.trim()) throw new Error(`${id} stage ${index + 1} requires a label`);
    const center = frame.x + span * (index + 0.5);
    const active = props.active === index;
    nodes.push(ellipsePrimitive({ id: stableId(id, "step-marker", index), role: "process-marker", frame: { x: center - 18, y: railY - 18, width: 36, height: 36 }, style: boxStyle(active ? PRIMARY : SURFACE, PRIMARY, STANDARD, token("radius.round")) }));
    nodes.push(textPrimitive({ id: stableId(id, "step-number", index), role: "process-number", frame: { x: center - 18, y: railY - 18, width: 36, height: 36 }, text: String(index + 1), style: textStyle(LABEL, active ? WHITE : PRIMARY, true, "center") }));
    const inset = tokenValue(token("space.2"));
    const label = [item.label || item, item.period, item.maturity, item.detail].filter(value => value !== undefined && value !== null && value !== "").join("\n");
    const labelWidth = span - (roadmap ? 20 + 2 * inset : 12);
    const measured = measureText(label, labelWidth, { fontFamily: tokenValue(FONT), fontSize: tokenValue(COMPACT), bold: true });
    const bandTop = railY + 28;
    const bandHeight = Math.max(frame.height * 0.24, measured.height + 2 * inset);
    const labelTop = roadmap ? bandTop + (bandHeight - measured.height) / 2 : bandTop;
    if (labelWidth <= 0 || (roadmap ? bandTop + bandHeight : labelTop + measured.height) > frame.y + frame.height) throw new Error(`${id} stage ${index + 1} needs more room for its complete label`);
    if (roadmap) nodes.push(rectPrimitive({ id: stableId(id, "phase-band", index), role: "roadmap-phase", frame: { x: frame.x + span * index + 10, y: bandTop, width: span - 20, height: bandHeight }, style: boxStyle(MUTED_SURFACE, RULE, HAIRLINE, SMALL_RADIUS) }));
    nodes.push(textPrimitive({ id: stableId(id, "step-label", index), role: "process-label", frame: { x: center - labelWidth / 2, y: labelTop, width: labelWidth, height: measured.height }, text: measured.text, style: { ...textStyle(COMPACT, INK, true, "center", "top"), lineHeight: measured.lineHeight, wrap: false }, data: { textLayout: measured } }));
    if (journey) nodes.push(textPrimitive({ id: stableId(id, "touchpoint", index), role: "journey-touchpoint", frame: { x: frame.x + span * index + 8, y: frame.y + 14, width: span - 16, height: 42 }, text: item.touchpoint || "Touchpoint", style: textStyle(LABEL, SECONDARY, false, "center") }));
  });
  return nodes;
}

function treeNodes({ id, frame, props, organization = false }) {
  if (organization && Array.isArray(props.nodes)) {
    const nodeFrames = new Map(props.nodes.map((node) => [node.id, {
      x: frame.x + node.x * frame.width,
      y: frame.y + node.y * frame.height,
      width: node.width * frame.width,
      height: node.height * frame.height
    }]));
    const nodes = [];
    for (const [index, connector] of (props.connectors || []).entries()) {
      const from = nodeFrames.get(connector.from);
      const to = nodeFrames.get(connector.to);
      if (!from || !to) throw new Error(`${id} connector references an unknown organization node`);
      const fromX = from.x + from.width / 2;
      const fromY = from.y + from.height;
      const toX = to.x + to.width / 2;
      const toY = to.y;
      // Reserve a visible vertical port at both ends: a horizontal route along
      // a box edge is covered by its fill and appears to land on a corner.
      const obstacles = [...nodeFrames.values()];
      const portAt = (x, y, direction) => {
        const gaps = obstacles.filter(r => x > r.x && x < r.x + r.width)
          .map(r => direction > 0 ? r.y - y : y - r.y - r.height).filter(gap => gap > 0.01);
        return Math.min(tokenValue(token("space.4")), Math.min(...gaps) / 2);
      };
      const route = [{ x: fromX, y: fromY },
        ...routeConnector({ x: fromX, y: fromY + portAt(fromX, fromY, 1) }, { x: toX, y: toY - portAt(toX, toY, -1) }, obstacles),
        { x: toX, y: toY }];
      route.slice(1).forEach((point, segment) => nodes.push(openLine(stableId(id, "connector", index, segment), route[segment].x, route[segment].y, point.x, point.y, "tree-connector", SECONDARY, HAIRLINE, { from: connector.from, to: connector.to })));
    }
    for (const [index, node] of props.nodes.entries()) {
      const nodeFrame = nodeFrames.get(node.id);
      const tone = node.tone || "muted";
      const fill = tone === "primary" ? PRIMARY : tone === "dark" ? INK : MUTED_SURFACE;
      const textColor = tone === "primary" || tone === "dark" ? WHITE : INK;
      nodes.push(rectPrimitive({ id: stableId(id, "node", node.id || index), role: "organization-node", frame: nodeFrame, style: boxStyle(fill, fill, HAIRLINE, token("radius.none")) }));
      const content = insetFrame(nodeFrame, 8), font = token("type.body");
      const label = measureText(node.label, content.width, { fontSize: tokenValue(font), bold: true });
      const detail = node.detail ? measureText(node.detail, content.width, { fontSize: tokenValue(font) }) : null;
      const gap = detail ? tokenValue(token("space.2")) : 0;
      const height = label.height + gap + (detail?.height || 0);
      if (height > content.height) throw new Error("Organization node needs more room for its complete label and detail");
      const top = content.y + (content.height - height) / 2;
      nodes.push(textPrimitive({ id: stableId(id, "node-text", node.id || index), role: "node-label", frame: { ...content, y: top, height: label.height }, text: label.text, style: textStyle(font, textColor, true, "center", "top"), data: { textLayout: label } }));
      if (detail) nodes.push(textPrimitive({ id: stableId(id, "node-detail", node.id || index), role: "node-text", frame: { ...content, y: top + label.height + gap, height: detail.height }, text: detail.text, style: textStyle(font, textColor, false, "center", "top"), data: { textLayout: detail } }));
    }
    return nodes;
  }
  const nodes = [];
  const root = { x: frame.x + frame.width / 2 - 90, y: frame.y + 14, width: 180, height: 58 };
  nodes.push(rectPrimitive({ id: stableId(id, "root"), role: organization ? "organization-root" : "tree-root", frame: root, style: boxStyle(PRIMARY, PRIMARY, STANDARD, SMALL_RADIUS) }));
  nodes.push(textPrimitive({ id: stableId(id, "root-text"), role: "node-label", frame: insetFrame(root, 8), text: props.root, style: textStyle(COMPACT, WHITE, true, "center") }));
  const span = frame.width / props.children.length;
  props.children.forEach((child, index) => {
    const childFrame = { x: frame.x + span * index + 18, y: frame.y + frame.height * 0.52, width: span - 36, height: 74 };
    const centerX = childFrame.x + childFrame.width / 2;
    nodes.push(openLine(stableId(id, "connector", index), root.x + root.width / 2, root.y + root.height, centerX, childFrame.y, "tree-connector", SECONDARY, HAIRLINE));
    nodes.push(rectPrimitive({ id: stableId(id, "child", index), role: organization ? "organization-node" : "tree-node", frame: childFrame, style: boxStyle(index === 0 ? PRIMARY_TINT : SURFACE, RULE, HAIRLINE, SMALL_RADIUS) }));
    nodes.push(textPrimitive({ id: stableId(id, "child-text", index), role: "node-label", frame: insetFrame(childFrame, 8), text: child, style: textStyle(COMPACT, INK, true, "center") }));
  });
  return nodes;
}


function initiativeRolloutNodes({ id, frame, props }) {
  const years = props.years || ["20xx", "20xx", "20xx"];
  const rows = props.rows || [];
  const labelWidth = 72;
  const contentX = frame.x + labelWidth;
  const contentWidth = frame.width - labelWidth;
  const span = contentWidth / years.length;
  const nodes = [];
  years.forEach((year, index) => {
    const x = contentX + index * span;
    nodes.push(textPrimitive({ id: stableId(id, "year", index), role: "rollout-year", frame: { x: x + 8, y: frame.y, width: span - 16, height: 30 }, text: year, style: textStyle(token("type.heading"), INK, true, "left") }));
    nodes.push(openLine(stableId(id, "year-rule", index), x + 8, frame.y + 34, x + span - 8, frame.y + 34, "rollout-year-rule", INK, STANDARD));
  });
  const rowsTop = frame.y + 52;
  const rowGap = 12;
  const rowHeight = (frame.height - 52 - rowGap * Math.max(0, rows.length - 1)) / Math.max(1, rows.length);
  const fills = [INK, token("color.chartSeries2"), MUTED_SURFACE];
  rows.forEach((row, rowIndex) => {
    const y = rowsTop + rowIndex * (rowHeight + rowGap);
    const markerSize = Math.min(48, rowHeight * 0.68);
    nodes.push(ellipsePrimitive({ id: stableId(id, "row-marker", rowIndex), role: "rollout-row-marker", frame: { x: frame.x + (labelWidth - markerSize) / 2, y: y + (rowHeight - markerSize) / 2, width: markerSize, height: markerSize }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")) }));
    nodes.push(textPrimitive({ id: stableId(id, "row-label", rowIndex), role: "rollout-row-label", frame: { x: frame.x + (labelWidth - markerSize) / 2, y: y + (rowHeight - markerSize) / 2, width: markerSize, height: markerSize }, text: row.label, style: textStyle(token("type.heading"), WHITE, true, "center") }));
    years.forEach((_, phaseIndex) => {
      const x = contentX + phaseIndex * span;
      const cell = row.phases?.[phaseIndex] || "";
      const dark = phaseIndex < 2;
      nodes.push(shapePrimitive({ id: stableId(id, "phase", rowIndex, phaseIndex), role: "rollout-phase", geometry: "chevron", frame: { x: x + 2, y, width: span + (phaseIndex < years.length - 1 ? 10 : -2), height: rowHeight }, style: boxStyle(fills[phaseIndex % fills.length], SURFACE, STANDARD, token("radius.none")) }));
      nodes.push(textPrimitive({ id: stableId(id, "phase-label", rowIndex, phaseIndex), role: "rollout-phase-label", frame: { x: x + 30, y: y + 6, width: span - 50, height: rowHeight - 12 }, text: cell, style: textStyle(LABEL, dark ? WHITE : INK, false, "center") }));
    });
  });
  return nodes;
}

function waveRoadmapLayout(frame, props) {
  const items = props.items || [];
  if (!Array.isArray(items) || !items.length) throw new Error("Wave roadmap requires at least one stage");
  const span = frame.width / items.length, inset = tokenValue(token("space.2"));
  const width = span - 2 * inset, gap = tokenValue(token("space.4"));
  const markerSize = tokenValue(token("icon.medium"));
  const measure = (value, size, bold = false) => value ? measureText(value, width, { fontSize: tokenValue(size), bold }) : null;
  const list = (label, values) => {
    if (values !== undefined && !Array.isArray(values)) throw new Error(`Roadmap ${label} must be an array`);
    return values?.length ? `${label}\n${values.map(value => `▪  ${value}`).join("\n")}` : "";
  };
  const cells = items.map((item, index) => ({
    range: measure(item.range || "", COMPACT, true),
    heading: measure(item.heading || item.label || `Wave ${index + 1}`, token("type.heading"), true),
    activities: measure(list("Key activities", item.activities), COMPACT),
    deliverables: measure(list("Main deliverables", item.deliverables), COMPACT)
  }));
  const maximum = key => Math.max(0, ...cells.map(cell => cell[key]?.height ?? 0));
  const rangeHeight = maximum("range"), headingHeight = maximum("heading");
  const headingTop = rangeHeight ? rangeHeight + tokenValue(token("space.3")) : 0;
  const railY = headingTop + headingHeight + gap + markerSize / 2;
  const activitiesTop = railY + markerSize / 2 + gap;
  const activitiesHeight = maximum("activities"), deliverablesHeight = maximum("deliverables");
  const deliverablesTop = activitiesTop + activitiesHeight + (activitiesHeight && deliverablesHeight ? gap : 0);
  const height = (deliverablesHeight ? deliverablesTop + deliverablesHeight : activitiesHeight ? activitiesTop + activitiesHeight : railY + markerSize / 2) + inset;
  return { cells, span, inset, width, markerSize, rangeHeight, headingTop, headingHeight, railY, activitiesTop, deliverablesTop, height };
}

function waveRoadmapNodes({ id, frame, props }) {
  const layout = waveRoadmapLayout(frame, props);
  if (layout.height > frame.height) throw new Error(`Roadmap ${id} complete activity and deliverable rows need ${layout.height.toFixed(1)}px, but only ${frame.height}px is allocated; widen, regroup or split the stages`);
  const railY = frame.y + layout.railY;
  const nodes = [openLine(stableId(id, "rail"), frame.x, railY, frame.x + frame.width, railY, "roadmap-rail", RULE, STANDARD, { endArrow: true })];
  layout.cells.forEach((cell, index) => {
    const x = frame.x + index * layout.span, center = x + layout.span / 2;
    for (const [key, y, size, color, bold, align] of [
      ["range", layout.rangeHeight - (cell.range?.height ?? 0), COMPACT, SECONDARY, true, "center"],
      ["heading", layout.headingTop + layout.headingHeight - cell.heading.height, token("type.heading"), INK, true, "center"],
      ["activities", layout.activitiesTop, COMPACT, INK, false, "left"],
      ["deliverables", layout.deliverablesTop, COMPACT, INK, false, "left"]
    ]) {
      const text = cell[key];
      if (!text) continue;
      nodes.push(textPrimitive({ id: stableId(id, key, index), role: `roadmap-${key}`, frame: { x: x + layout.inset, y: frame.y + y, width: layout.width, height: text.height }, text: text.text, style: { ...textStyle(size, color, bold, align, "top"), lineHeight: text.lineHeight, wrap: false }, data: { textLayout: text } }));
    }
    nodes.push(ellipsePrimitive({ id: stableId(id, "marker", index), role: "roadmap-marker", frame: { x: center - layout.markerSize / 2, y: railY - layout.markerSize / 2, width: layout.markerSize, height: layout.markerSize }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")) }));
  });
  return nodes;
}

function highlightStripNodes({ id, frame, props }) {
  const items = props.items || [];
  const span = frame.width / Math.max(1, items.length);
  const nodes = [];
  items.forEach((item, index) => {
    const x = frame.x + index * span;
    const size = 40;
    nodes.push(ellipsePrimitive({ id: stableId(id, "marker", index), role: "highlight-marker", frame: { x: x + span / 2 - size / 2, y: frame.y, width: size, height: size }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")) }));
    nodes.push(textPrimitive({ id: stableId(id, "number", index), role: "highlight-number", frame: { x: x + span / 2 - size / 2, y: frame.y, width: size, height: size }, text: item.number || String(index + 1), style: textStyle(token("type.heading"), WHITE, false, "center") }));
    nodes.push(textPrimitive({ id: stableId(id, "heading", index), role: "highlight-heading", frame: { x: x + 6, y: frame.y + 48, width: span - 12, height: 28 }, text: item.heading || "Start highlight", style: textStyle(token("type.heading"), INK, true, "center") }));
    nodes.push(textPrimitive({ id: stableId(id, "description", index), role: "highlight-description", frame: { x: x + 6, y: frame.y + 80, width: span - 12, height: frame.height - 80 }, text: item.description || "(Insert description)", style: textStyle(COMPACT, INK, false, "center", "top") }));
  });
  return nodes;
}

function matrixNodes({ id, frame, props }) {
  for (const axis of ["xAxis", "yAxis"]) {
    if (!["label", "minLabel", "maxLabel"].every(key => typeof props[axis]?.[key] === "string" && props[axis][key].trim()) ) throw new Error(`Matrix ${axis} requires label, minLabel, and maxLabel`);
  }
  const nodes = [];
  // The 2x2: four tinted cells with a slit between, the axis titles along the
  // left (rotated) and the foot, the end labels at the corners, optional
  // quadrant names in the cell corners, and named points with their labels.
  const left = 44, bottom = 44, gap = 4, endLabel = 22;
  const plot = { x: frame.x + left, y: frame.y + endLabel, width: frame.width - left - 8, height: frame.height - bottom - endLabel };
  const quadrants = ["topLeft", "topRight", "bottomLeft", "bottomRight"];
  const cellFrame = (q) => ({ x: plot.x + (q.endsWith("Right") ? plot.width / 2 + gap / 2 : 0), y: plot.y + (q.startsWith("bottom") ? plot.height / 2 + gap / 2 : 0), width: plot.width / 2 - gap / 2, height: plot.height / 2 - gap / 2 });
  for (const q of quadrants) {
    const highlighted = props.highlightQuadrant === q;
    nodes.push(rectPrimitive({ id: stableId(id, "cell", q), role: highlighted ? "matrix-highlight" : "matrix-cell", frame: cellFrame(q), style: boxStyle(highlighted ? token("color.accentTint") : MUTED_SURFACE, "none", HAIRLINE, token("radius.none")), data: { quadrant: q, highlighted } }));
    const name = props.quadrantLabels?.[q];
    if (typeof name === "string" && name.trim()) {
      const c = cellFrame(q);
      const measured = measureText(name, c.width - 24, { fontSize: tokenValue(LABEL), bold: true, wrapWidthRatio: 1 });
      nodes.push(textPrimitive({ id: stableId(id, "cell-label", q), role: "matrix-quadrant-label", frame: { x: c.x + 12, y: q.startsWith("top") ? c.y + 8 : c.y + c.height - 8 - measured.height, width: c.width - 24, height: measured.height }, text: measured.text, style: { ...textStyle(LABEL, SECONDARY, true, q.endsWith("Right") ? "right" : "left", "top"), lineHeight: measured.lineHeight, wrap: false }, data: { quadrant: q, textLayout: measured } }));
    }
  }
  // Axis titles and end labels.
  const yTitle = props.yAxis.label, xTitle = props.xAxis.label;
  nodes.push(textPrimitive({ id: stableId(id, "y-title"), role: "matrix-axis-label", frame: { x: frame.x - plot.height / 2 + 12, y: plot.y + plot.height / 2 - 12, width: plot.height, height: 24 }, text: yTitle, style: { ...textStyle(LABEL, INK, true, "center"), rotate: -90 } }));
  nodes.push(textPrimitive({ id: stableId(id, "y-max"), role: "matrix-axis-label", frame: { x: frame.x, y: plot.y - endLabel, width: left + 60, height: endLabel }, text: props.yAxis.maxLabel, style: textStyle(LABEL, SECONDARY, false, "left") }));
  nodes.push(textPrimitive({ id: stableId(id, "y-min"), role: "matrix-axis-label", frame: { x: frame.x, y: plot.y + plot.height + 4, width: left + 60, height: endLabel }, text: props.yAxis.minLabel, style: textStyle(LABEL, SECONDARY, false, "left") }));
  nodes.push(textPrimitive({ id: stableId(id, "x-title"), role: "matrix-axis-label", frame: { x: plot.x, y: plot.y + plot.height + bottom - 24, width: plot.width, height: 24 }, text: xTitle, style: textStyle(LABEL, INK, true, "center") }));
  nodes.push(textPrimitive({ id: stableId(id, "x-min"), role: "matrix-axis-label", frame: { x: plot.x + 4, y: plot.y + plot.height + 4, width: 120, height: endLabel }, text: props.xAxis.minLabel, style: textStyle(LABEL, SECONDARY, false, "left") }));
  nodes.push(textPrimitive({ id: stableId(id, "x-max"), role: "matrix-axis-label", frame: { x: plot.x + plot.width - 120, y: plot.y + plot.height + 4, width: 120, height: endLabel }, text: props.xAxis.maxLabel, style: textStyle(LABEL, SECONDARY, false, "right") }));
  nodes.push(openLine(stableId(id, "x-axis"), plot.x, plot.y + plot.height, plot.x + plot.width, plot.y + plot.height, "matrix-axis", INK, STANDARD));
  nodes.push(openLine(stableId(id, "y-axis"), plot.x, plot.y, plot.x, plot.y + plot.height, "matrix-axis", INK, STANDARD));
  props.points.forEach((point, index) => {
    const x = plot.x + point.x * plot.width;
    const y = plot.y + (1 - point.y) * plot.height;
    const size = point.size || (props.bubbles ? 76 : 18);
    const color = point.state === "positive" ? token("color.positive") : point.state === "caution" ? token("color.caution") : point.state === "negative" ? token("color.negative") : index === props.highlight ? token("color.accent") : PRIMARY;
    nodes.push(ellipsePrimitive({ id: stableId(id, "point", index), role: "matrix-point", frame: { x: x - size / 2, y: y - size / 2, width: size, height: size }, style: boxStyle(color, SURFACE, HAIRLINE, token("radius.round")) }));
    // Labels sit to the right of the point, or to the left near the right edge.
    const labelWidth = Math.min(150, Math.max(80, plot.width * 0.22));
    const right = x + 12 + labelWidth <= plot.x + plot.width;
    nodes.push(textPrimitive({ id: stableId(id, "point-label", index), role: "matrix-point-label", frame: props.bubbles ? { x: x - size * 0.4, y: y - size * 0.32, width: size * 0.8, height: size * 0.64 } : { x: right ? x + 12 : x - 12 - labelWidth, y: y - 10, width: labelWidth, height: 22 }, text: point.label, style: textStyle(LABEL, props.bubbles ? WHITE : INK, true, props.bubbles ? "center" : right ? "left" : "right") }));
  });
  return nodes;
}

function lightChevronNode(id, frame) {
  const height = tokenValue(token("icon.medium")), width = height * 0.75;
  if (frame.width < width || frame.height < height) throw new Error("Chevron needs room for its canonical optical size; widen its gutter");
  return shapePrimitive({ id: stableId(id, "chevron"), role: "relationship-chevron", geometry: "chevron", frame: { x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - height) / 2, width, height }, style: { fill: PRIMARY, stroke: "none", lineWidth: HAIRLINE }, data: { relation: "implies", arrowVariant: "chevron" } });
}

function registerCore(registry) {
  const definitions = [
    component({
      id: "section-boundary", category: "relationship", role: "section-boundary",
      tokens: ["color.rule", "color.componentPrimary", "color.onPrimary", "line.hairline", "line.standard", "space.1", "icon.medium", "radius.round"],
      preferredSize: { width: 54, height: 400 }, sample: { variant: "related" },
      render: ({ id, frame, props }) => {
        const variant = props.variant ?? "related", x = frame.x + frame.width / 2, y = frame.y + frame.height / 2;
        if (variant === "subsection") return { nodes: [openLine(stableId(id, "separator"), frame.x, y, frame.x + frame.width, y, "subsection-rule")] };
        if (variant === "related") return { nodes: [linePrimitive({ id: stableId(id, "separator"), role: "section-separator", x1: x, y1: frame.y, x2: x, y2: frame.y + frame.height, style: { stroke: RULE, lineWidth: HAIRLINE, dash: "dash" } })] };
        const diameter = tokenValue(token("icon.medium")), clearance = tokenValue(token("space.1"));
        if (frame.width < diameter + clearance * 2 || frame.height < diameter + clearance * 4) throw new Error("Inference boundary needs room for its marker and clear divider segments");
        const radius = diameter / 2;
        if (variant === "inference-chevron") return { nodes: [
          linePrimitive({ id: stableId(id, "before"), role: "section-separator", x1: x, y1: frame.y, x2: x, y2: y - radius - clearance, style: { stroke: RULE, lineWidth: HAIRLINE, dash: "dash" } }),
          linePrimitive({ id: stableId(id, "after"), role: "section-separator", x1: x, y1: y + radius + clearance, x2: x, y2: frame.y + frame.height, style: { stroke: RULE, lineWidth: HAIRLINE, dash: "dash" } }),
          lightChevronNode(id, frame)
        ] };
        return { nodes: [
          openLine(stableId(id, "before"), x, frame.y, x, y - radius - clearance, "section-separator"),
          openLine(stableId(id, "after"), x, y + radius + clearance, x, frame.y + frame.height, "section-separator"),
          ellipsePrimitive({ id: stableId(id, "disc"), role: "relationship-disc", frame: { x: x - radius, y: y - radius, width: diameter, height: diameter }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")) }),
          openLine(stableId(id, "chevron-top"), x - diameter / 8, y - diameter / 4, x + diameter / 8, y, "relationship-chevron", WHITE, STANDARD),
          openLine(stableId(id, "chevron-bottom"), x + diameter / 8, y, x - diameter / 8, y + diameter / 4, "relationship-chevron", WHITE, STANDARD)
        ] };
      }
    }),
    component({
      id: "slide-chrome", category: "shared", role: "slide-chrome",
      tokens: ["color.canvas", "color.ink", "color.componentPrimary", "color.accent", "color.onPrimary", "color.surfaceMuted", "color.textSecondary", "font.display", "font.body", "type.source", "type.compact", "type.heading", "type.actionTitle", "type.actionTitleLong", "layout.titleContentGap", "space.2", "space.4", "radius.small", "radius.none", ...STYLE_TOKENS, ...PAGE_TEMPLATE_TOKENS, ...TRACKER_TOKENS],
      preferredSize: { width: SLIDE.width, height: SLIDE.height },
      sample: { title: "(Insert action title)", source: "Source: (Insert source)", footerRight: "(Insert company name)", pageNumber: 7 },
      render: ({ id, frame, props }) => {
        const page = renderPageTemplate({ id, frame, props });
        const tracker = props.tracker ? trackerLabelNodes({ id: stableId(id, "tracker"), frame: { x: frame.x + CHROME.left, y: frame.y + 30, width: page.titleWidth, height: 20 }, props: props.tracker }) : [];
        // `kicker`: the small label above the title that says what part of the
        // argument this page belongs to ("People", "Commercial evidence"). A
        // well-made page carries a dozen words of this band furniture against our
        // four, and it shares the tracker's row: kicker left, pills right.
        const kickerText = typeof props.kicker === "string" && props.kicker.trim() ? props.kicker.trim() : null;
        const kicker = [];
        if (kickerText) {
          const measured = measureText(kickerText, 420, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.compact")), bold: true, wrapWidthRatio: 1 });
          if (measured.lines.length > 1) throw new Error("A kicker must fit on one line");
          // Pill trackers hug the right margin, so the kicker keeps the left of
          // that row. A left-anchored tracker (label, breadcrumb, number strip)
          // already names the section, so it wins the slot and the kicker drops.
          const trackerLeft = tracker.reduce((min, node) => Math.min(min, node.frame ? node.frame.x : Math.min(node.x1 ?? Infinity, node.x2 ?? Infinity)), Infinity);
          const kickerRight = frame.x + CHROME.left + Math.ceil(measured.width) + 2 + tokenValue(token("space.4"));
          if (kickerRight <= trackerLeft) kicker.push(textPrimitive({
            id: stableId(id, "kicker"), role: "kicker",
            frame: { x: frame.x + CHROME.left, y: frame.y + 30, width: Math.ceil(measured.width) + 2, height: measured.height },
            text: kickerText,
            style: { ...textStyle(token("type.compact"), token("color.accent"), true, "left", "top"), lineHeight: measured.lineHeight, wrap: false },
            data: { textLayout: measured }
          }));
        }
        // `subtitle`: the standfirst under the action title - what the page
        // measures, over what population, for what period ("Employment, growth
        // and specialization by subsector"). A well-made title band carries
        // twenty words against our fourteen, and this line is the difference.
        const subtitleText = typeof props.subtitle === "string" && props.subtitle.trim() ? props.subtitle.trim() : null;
        const tagPlacement = props.tag ? houseStyle("style.tagPlacement") : "top-right";
        // An above-title tag (a small accent label, as in a country or section spotlight) sits in the title's top margin.
        const titles = titleNodes({ id, frame, props: { text: props.title, lead: props.titleLead, variant: props.titleVariant, rule: props.titleRule, availableTitleWidth: page.titleWidth, titleTop: props.tracker || kicker.length ? 58 : CHROME.titleTop }, chrome: true });
        const title = titles.find((node) => node.role === "action-title");
        let titleBottom = title.frame.y + title.data.textLayout.height;
        // Page tag: PRELIMINARY, ILLUSTRATIVE, CONFIDENTIAL, Exhibit 3. The house
        // style places it: small caps top-right, an accent pill under the title
        // (a survey date), or an accent label above the title (a spotlight).
        if (props.tag) {
          const pill = tagPlacement === "below-title";
          const text = pill || tagPlacement === "above-title" ? String(props.tag).trim() : String(props.tag).trim().toUpperCase();
          const tag = measureText(text, 320, { fontFamily: tokenValue(FONT), fontSize: tokenValue(SOURCE), bold: pill || tagPlacement === "above-title", wrapWidthRatio: 1 });
          if (tag.lines.length > 1) throw new Error("Page tag must fit on one line");
          if (pill) {
            const padX = tokenValue(token("space.2")), h = tag.height + 4, y = titleBottom + tokenValue(token("space.2"));
            titles.push(rectPrimitive({ id: stableId(id, "tag-pill"), role: "page-tag-pill", frame: { x: title.frame.x, y, width: Math.ceil(tag.width) + 2 * padX, height: h }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.small")) }));
            titles.push(textPrimitive({ id: stableId(id, "tag"), role: "page-tag", frame: { x: title.frame.x + padX, y: y + 2, width: Math.ceil(tag.width) + 2, height: tag.height }, text, style: { ...textStyle(SOURCE, WHITE, true, "left", "top"), lineHeight: tag.lineHeight, wrap: false }, data: { textLayout: tag, tag: text } }));
            titleBottom = y + h;
          } else if (tagPlacement === "above-title") {
            titles.push(textPrimitive({ id: stableId(id, "tag"), role: "page-tag", frame: { x: title.frame.x, y: title.frame.y - tag.height - 2, width: Math.ceil(tag.width) + 2, height: tag.height }, text, style: { ...textStyle(SOURCE, token("color.accent"), true, "left", "top"), lineHeight: tag.lineHeight, wrap: false }, data: { textLayout: tag, tag: text } }));
          } else {
            titles.push(textPrimitive({ id: stableId(id, "tag"), role: "page-tag", frame: { x: frame.x + frame.width - CHROME.right - Math.ceil(tag.width) - 2, y: frame.y + 22, width: Math.ceil(tag.width) + 2, height: tag.height }, text, style: { ...textStyle(SOURCE, SECONDARY, false, "right", "top"), lineHeight: tag.lineHeight, wrap: false }, data: { textLayout: tag, tag: text } }));
          }
        }
        if (subtitleText) {
          const measured = measureText(subtitleText, page.titleWidth, { fontFamily: tokenValue(FONT), fontSize: tokenValue(BODY), wrapWidthRatio: 1 });
          if (measured.lines.length > 2) throw new Error("A subtitle runs to at most two lines; it names the measure, not the finding");
          // A rule and a standfirst do the same job - they close the title band
          // and separate it from the page - so a page takes one or the other,
          // never both. The standfirst carries the measure and the rule carries
          // nothing, so the standfirst wins and the rule is dropped. A page
          // with no standfirst keeps its house rule.
          const ruleIndex = titles.findIndex((node) => node.role === "title-rule");
          if (ruleIndex >= 0) titles.splice(ruleIndex, 1);
          const y = titleBottom + tokenValue(token("space.2"));
          titles.push(textPrimitive({
            id: stableId(id, "subtitle"), role: "action-subtitle",
            frame: { x: frame.x + CHROME.left, y, width: page.titleWidth, height: measured.height },
            text: measured.text,
            style: { ...textStyle(BODY, SECONDARY, false, "left", "top"), lineHeight: measured.lineHeight, wrap: false },
            data: { textLayout: measured }
          }));
          titleBottom = y + measured.height;
        }
        // A tinted title band (the house style `band`) runs from the page top to just under the title.
        const titleRule = props.titleVariant === undefined ? houseStyle("style.titleRule") : "none";
        if (titleRule === "band") {
          titles.unshift(rectPrimitive({ id: stableId(id, "title-band"), role: "title-band", frame: { x: frame.x, y: frame.y, width: frame.width, height: titleBottom + tokenValue(token("space.4")) }, style: boxStyle(MUTED_SURFACE, "none", HAIRLINE, token("radius.none")) }));
        }
        // `block` (keynote): the title reversed out of a full-width block of the
        // primary, which the tracker and kicker share. Everything set on it turns
        // to the reversed colour, so nothing on the block is ink on navy.
        if (titleRule === "block") {
          // The block is its own margin: its contents sit 8px higher than on an
          // open page, and the body starts a small step (space.4) below its edge
          // rather than the standard space.5 below the title.
          const lift = 8;
          for (const node of [...titles, ...tracker, ...kicker]) if (node.frame) node.frame = { ...node.frame, y: node.frame.y - lift };
          titleBottom -= lift;
          const blockBottom = titleBottom + tokenValue(token("space.3"));
          titles.unshift(rectPrimitive({ id: stableId(id, "title-band"), role: "title-band", frame: { x: frame.x, y: frame.y, width: frame.width, height: blockBottom }, style: boxStyle(PRIMARY, "none", HAIRLINE, token("radius.none")), data: { block: true } }));
          for (const node of [...titles, ...tracker, ...kicker]) {
            if (node.type === "text" && node.frame && node.frame.y < blockBottom) {
              node.style = { ...node.style, color: WHITE };
              // An accent lead ("Sector outlook:") keeps its weight but reverses too.
              const plain = (runs) => Array.isArray(runs) ? runs.map((run) => ({ ...run, accent: false })) : runs;
              if (Array.isArray(node.runs)) node.runs = plain(node.runs);
              const layout = node.data?.textLayout;
              if (layout && (layout.runs || layout.sourceRuns)) node.data = { ...node.data, textLayout: { ...layout, runs: plain(layout.runs), sourceRuns: plain(layout.sourceRuns) } };
            }
            else if (node.type === "rect" && node.role !== "title-band" && node.frame?.y < blockBottom) node.style = { ...node.style, fill: token("color.accent") };
          }
          titleBottom = blockBottom - (tokenValue(token("space.5")) - tokenValue(token("space.4")));
        }
        // `tab` (journal): a short thick bar in the accent at the top-left
        // corner, the mark a data briefing is recognised by.
        if (titleRule === "tab") titles.unshift(rectPrimitive({ id: stableId(id, "title-tab"), role: "title-tab", frame: { x: frame.x + CHROME.left, y: frame.y, width: 64, height: 10 }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.none")) }));
        const baseBottom = page.contentFrame.y + page.contentFrame.height;
        // One content top for the whole deck: the body starts at CHROME.bodyTop whether
        // the title takes one line or two. Only a three-line title pushes it down.
        const gap = tokenValue(token("space.5"));
        // A tracker above the title (pill tabs, a label) sits in the same band as
        // the title, so the body starts a step lower to keep it off the content.
        const trackerGap = tracker.length || kicker.length ? tokenValue(token("space.3")) : 0;
        const contentTop = Math.max(CHROME.bodyTop + trackerGap, titleBottom + gap + trackerGap, page.logoFrame ? page.logoFrame.y + page.logoFrame.height + gap : 0);
        const contentFrame = { ...page.contentFrame, y: contentTop, height: baseBottom - contentTop };
        if (contentFrame.height <= 0) throw new Error("Action title leaves no room for slide content; shorten the title or split the slide");
        // The rule belongs to the content, not to the title. Hung under the
        // title it tracked the title's height while the body stayed pinned at
        // `bodyTop`: a one-line title left 52px of nothing beneath the rule and
        // a two-line title left 16px, so the same band read differently on
        // every page. Dropping it to a fixed gap above the content makes that
        // distance constant and lets the title float in whatever height it
        // needs. It never rises above where the title leaves it.
        const ruleGap = tokenValue(token("space.3"));
        for (const node of titles) {
          if (node.role !== "title-rule" || !node.frame) continue;
          node.frame = { ...node.frame, y: Math.max(node.frame.y, contentTop - ruleGap) };
        }
        // The title band paints first; the tracker sits on it, above the title.
        const band = titles.filter((n) => n.role === "title-band" || n.role === "title-tab"), rest = titles.filter((n) => n.role !== "title-band" && n.role !== "title-tab");
        return { ...page, contentFrame, nodes: [...band, ...tracker, ...kicker, ...rest, ...page.nodes] };
      }
    }),
    component({ id: "page-template", category: "shared", role: "page-template", tokens: PAGE_TEMPLATE_TOKENS,
      preferredSize: { ...SLIDE }, sample: { source: "Source: (Insert source)", companyName: "(Insert company name)", pageNumber: 7 }, render: renderPageTemplate }),
    component({
      id: "section", category: "structure", role: "section", tokens: ["color.surface", "color.surfaceMuted", "color.rule", "color.ink", "color.accentTint", "color.onPrimary", "space.4", "space.5", "line.standard", "radius.none", "radius.small", ...SECTION_HEADING_TOKENS], preferredSize: { width: 520, height: 300 }, sample: { treatment: "open", heading: "(Insert section heading)" },
      render: ({ id, frame, props }) => {
        const treatment = props.treatment || "open";
        const edge = props.edge || "contained";
        if(!["contained","full-bleed"].includes(edge))throw new Error("Unknown section edge treatment");
        // `card`: a plain surface with padding and no rule - the white card an
        // exhibit sits on over a photograph, where `open` draws nothing at all.
        if (!["open", "muted", "primary", "dark", "tint", "card"].includes(treatment)) throw new Error(`Unknown section treatment: ${treatment}`);
        const padding = sectionPadding(props);
        // Side panels from the 2020–24 decks: a navy "Key insights" column (dark),
        // a grey commentary column (muted) and an accent-tinted message column (tint).
        const fill = treatment === "muted" ? MUTED_SURFACE : treatment === "primary" ? PRIMARY : treatment === "dark" ? INK : treatment === "tint" ? token("color.accentTint") : SURFACE;
        const stroke = treatment === "open" ? RULE : fill;
        const nodes = [];
        const headerFrame = { x: frame.x + padding.left, y: frame.y + padding.top, width: frame.width - padding.left - padding.right, height: frame.height };
        const headerProps = { ...props, variant: treatment === "primary" || treatment === "dark" ? "inverse" : "standard", rule: treatment !== "muted" && treatment !== "tint" };
        if (props.heading) nodes.push(...sectionHeadingNodes({ id: stableId(id, "header"), frame: headerFrame, props: headerProps }));
        const contentFrame = insetFrame(frame, sectionContentInsets(frame, props));
        if (treatment !== "open") nodes.unshift(rectPrimitive({ id: stableId(id, "surface"), role: "section-surface", frame, style: boxStyle(fill, stroke, treatment === "primary" ? STANDARD : HAIRLINE, edge === "full-bleed" ? token("radius.none") : SMALL_RADIUS), data: { edge, contentFrame } }));
        return { nodes, contentFrame };
      }
    }),
    component({ id: "section-heading", category: "shared", role: "section-heading", tokens: SECTION_HEADING_TOKENS, preferredSize: { width: 720, height: 52 }, sample: { heading: "(Insert section heading)", rule: true }, render: ({ id, frame, props }) => ({ nodes: sectionHeadingNodes({ id, frame, props }) }) }),
    component({ id: "action-title", category: "shared", role: "title", tokens: ["font.display", "type.actionTitle", "color.ink", "color.rule", "line.hairline", "space.2"], preferredSize: { width: 1136, height: 86 }, sample: { text: "(Insert action title)" }, render: ({ id, frame, props }) => ({ nodes: titleNodes({ id, frame, props }) }) }),
    component({ id: "section-title", category: "shared", role: "title", tokens: ["font.display", "type.sectionTitle", "color.ink", "color.rule", "line.hairline", "space.2"], preferredSize: { width: 720, height: 64 }, sample: { text: "(Insert section title)" }, render: ({ id, frame, props }) => ({ nodes: titleNodes({ id, frame, props, section: true }) }) }),
    component({ id: "cover", category: "navigation", role: "cover", tokens: ["style.coverLayout", "type.metric", "type.actionTitle", "color.accent", "color.rule", "color.ink", "color.canvas", "color.onPrimary", "color.textSecondary", "color.componentPrimary", "color.chartSeries4", "color.accentTint", "font.display", "font.body", "type.deckTitle", "type.heading", "type.body", "type.compact", "space.2", "space.5", "line.hairline", "line.standard", "radius.none"], preferredSize: { width: 1280, height: 720 }, sample: { title: "(Insert presentation title)", subtitle: "(Insert subtitle)" }, render: ({ id, frame, props }) => {
      if (typeof props.title !== "string" || !props.title.trim()) throw new Error("Cover requires a deck title");
      if (props.subtitle !== undefined && typeof props.subtitle !== "string") throw new Error("Cover subtitle must be text");
      // The compiler supplies headerBandHeight to every component as layout metadata.
      if (Object.keys(props).some(key => !["title", "subtitle", "date", "logo", "tone", "headerBandHeight"].includes(key))) throw new Error("Cover supports title, subtitle, date, logo and tone; use the page template for other furniture");
      // A design system other than the consulting block builds its own cover.
      const coverLayout = houseStyle("style.coverLayout");
      // A cover drawn into a card or a half page (a photograph beside it) keeps
      // the block construction in the system's type and colours.
      if (coverLayout !== "block" && frame.width >= SLIDE.width) return { nodes: designedCoverNodes(coverLayout, { id, frame, props }) };
      // Dark tone is the gallery default: navy full bleed, title block in the
      // lower third, a logo slot top-left, a date line under the subtitle.
      const dark = (props.tone ?? "dark") === "dark";
      // On navy the subtitle takes the accent tint when it reads (a dark green
      // fourth series does not), white otherwise.
      const tint = token("color.accentTint");
      const ink = dark ? WHITE : INK, secondary = dark ? (contrastRatio(tokenValue(INK), tokenValue(tint)) >= 4.5 ? tint : WHITE) : SECONDARY;
      const width = Math.min(frame.width - CHROME.left - CHROME.right, frame.width * 0.72);
      // Fit ladder: a design system's large cover title steps down through the
      // metric and action-title sizes when the cover is a card or a half page.
      let titleSize = token("type.deckTitle"), title;
      for (const id of ["type.deckTitle", "type.metric", "type.actionTitle"]) {
        if (id !== "type.deckTitle" && tokenValue(token(id)) >= tokenValue(titleSize)) continue;
        titleSize = token(id);
        title = measureText(props.title, width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(titleSize), bold: true, wrapWidthRatio: 1 });
        if (title.lines.length <= 3 && title.height <= frame.height * 0.36) break;
      }
      const subtitle = props.subtitle?.trim() ? measureText(props.subtitle, width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")), wrapWidthRatio: 1 }) : null;
      const date = props.date?.trim() ? measureText(props.date, width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(BODY), wrapWidthRatio: 1 }) : null;
      const gap = tokenValue(token("space.5")), small = tokenValue(token("space.2"));
      const height = title.height + (subtitle ? gap + subtitle.height : 0) + (date ? gap + date.height : 0);
      if (title.lines.length > 3 || subtitle?.lines.length > 2 || height > frame.height * 0.6) throw new Error("Cover text exceeds its allocated space; shorten the title or subtitle");
      const x = frame.x + CHROME.left;
      // Anchor the block so its bottom sits at 78% of the page; a taller block grows upward.
      let y = frame.y + frame.height * 0.78 - height;
      const nodes = [];
      if (dark) nodes.push(rectPrimitive({ id: stableId(id, "surface"), role: "cover-surface", frame, style: boxStyle(INK, INK, HAIRLINE, token("radius.none")) }));
      // Accent rule above the title: the one graphic element on a text cover.
      nodes.push(openLine(stableId(id, "accent"), x, y - gap, x + 72, y - gap, "cover-accent", PRIMARY, token("line.standard")));
      if (props.logo?.trim()) {
        const logo = measureText(props.logo, 320, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.heading")), bold: true, wrapWidthRatio: 1 });
        nodes.push(textPrimitive({ id: stableId(id, "logo"), role: "cover-logo", frame: { x, y: frame.y + CHROME.titleTop, width: 320, height: logo.height }, text: logo.text, style: { ...textStyle(token("type.heading"), ink, true, "left", "top"), fontFamily: DISPLAY, lineHeight: logo.lineHeight, wrap: false }, data: { textLayout: logo } }));
      }
      nodes.push(textPrimitive({ id: stableId(id, "title"), role: "cover-title", frame: { x, y, width, height: title.height }, text: title.text, style: { ...textStyle(titleSize, ink, true, "left", "top"), fontFamily: DISPLAY, lineHeight: title.lineHeight, wrap: false }, data: { textLayout: title } }));
      y += title.height;
      if (subtitle) { y += gap; nodes.push(textPrimitive({ id: stableId(id, "subtitle"), role: "cover-subtitle", frame: { x, y, width, height: subtitle.height }, text: subtitle.text, style: { ...textStyle(token("type.heading"), secondary, false, "left", "top"), lineHeight: subtitle.lineHeight, wrap: false }, data: { textLayout: subtitle } })); y += subtitle.height; }
      if (date) { y += gap; nodes.push(textPrimitive({ id: stableId(id, "date"), role: "cover-date", frame: { x, y, width, height: date.height }, text: date.text, style: { ...textStyle(BODY, secondary, false, "left", "top"), lineHeight: date.lineHeight, wrap: false }, data: { textLayout: date } })); }
      return { nodes };
    } }),
    component({ id: "section-divider", category: "navigation", role: "divider", tokens: ["style.dividerLayout", "color.rule", "type.metric", "type.compact", "color.canvas", "color.ink", "color.componentPrimary", "color.onPrimary", "color.accent", "color.chartGrid", "color.componentPrimaryTint", "color.textSecondary", "font.display", "font.body", "type.deckTitle", "type.heading", "type.body", "type.sectionNumber", "line.hairline", "radius.none", "radius.small", "space.3", "space.4", ...PAGE_TEMPLATE_TOKENS], preferredSize: { ...SLIDE }, sample: { title: "(Insert section title)" }, render: ({ id, frame, props }) => {
      if (typeof props.title !== "string" || !props.title.trim()) throw new Error("Section divider requires a section title");
      for (const key of Object.keys(props)) if (!["title", "subtitle", "sectionId", "style", "mode", "contents", "contentsActive", "pageTemplate", "source", "note", "companyName", "pageNumber", "footerLeft", "footerRight", "headerBandHeight", "panelWidth"].includes(key)) throw new Error(`Unknown section-divider setting: ${key}; dividers have one title, an optional subtitle and section id, the deck's contents, and page furniture`);
      // The design system decides the chapter page's ground: the consulting
      // panel is dark, the editorial and journal pages sit on the canvas, the
      // keynote page is a field of the primary.
      const dividerLayout = houseStyle("style.dividerLayout");
      const inverse = dividerLayout === "panel" ? (props.mode ?? "dark") === "dark" : dividerLayout === "keynote";
      const dividerStyle = props.style ?? "plain";
      if (!["plain", "numbered"].includes(dividerStyle)) throw new Error(`Unknown section-divider style: ${dividerStyle}`);
      if (dividerStyle === "numbered" && !String(props.sectionId ?? "").trim()) throw new Error("Numbered section divider requires sectionId");
      const page = renderPageTemplate({ id: stableId(id, "page"), frame, props: { ...props, inverse } });
      // With a photograph beside it (media.mjs) the divider keeps a left panel of
      // `panelWidth`; the numeral then sits above the title instead of at the right.
      const panelWidth = props.panelWidth ?? null;
      const surfaceFrame = panelWidth ? { ...frame, width: panelWidth } : frame;
      // The deck's contents down the right, the section this page opens on a
      // band: a reader who met the contents page at the front sees the same
      // list again with the band one row lower. A tracker that never moves is
      // not a tracker, and a contents page shown once and never again leaves
      // the reader to keep the place themselves. With a photograph beside the
      // divider there is no room for it, and it is dropped.
      const contents = !panelWidth && Array.isArray(props.contents) && props.contents.length >= 2
        ? props.contents.map((entry) => String(entry?.label ?? entry ?? "").trim()).filter(Boolean) : [];
      const contentsActive = Number.isInteger(props.contentsActive) ? props.contentsActive : -1;
      const railX = frame.x + Math.round(frame.width * 0.62), railWidth = frame.width - railX - CHROME.right;
      const width = contents.length ? railX - CHROME.left - frame.x - 48
        : panelWidth ? panelWidth - CHROME.left - 24 : dividerStyle === "numbered" ? frame.width * 0.58 - CHROME.left : frame.width - CHROME.left - CHROME.right;
      const titleBold = dividerLayout !== "editorial";
      const title = measureText(props.title, width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.deckTitle")), bold: titleBold, wrapWidthRatio: 1 });
      if (title.lines.length > (panelWidth ? 3 : 2) || title.height > frame.height - 2 * CHROME.bodyTop) throw new Error("Section divider title exceeds its allocated space; shorten the section title");
      const background = dividerLayout === "keynote" ? PRIMARY : inverse ? INK : token("color.canvas"), foreground = inverse ? WHITE : INK;
      if (contrastRatio(tokenValue(background), tokenValue(foreground)) < 4.5) throw new Error("Section divider title contrast must be at least 4.5:1");
      // A short accent rule above the title and the section's one-line summary
      // below it, in the same block, so the divider says what the section shows.
      if (props.subtitle !== undefined && typeof props.subtitle !== "string") throw new Error("Section divider subtitle must be text");
      const subtitle = typeof props.subtitle === "string" && props.subtitle.trim() ? measureText(props.subtitle.trim(), width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")), wrapWidthRatio: 1 }) : null;
      const ruleGap = tokenValue(token("space.4")), subGap = tokenValue(token("space.3"));
      // The title holds the page's centre line; the accent bar sits above it and the summary below.
      const titleTop = frame.y + (frame.height - title.height) / 2;
      const rail = [];
      if (contents.length) {
        const rowGap = 10, muted = inverse ? token("color.chartGrid") : SECONDARY;
        const measured = contents.map((label, index) => measureText(label, railWidth - 24, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.body")), bold: index === contentsActive, wrapWidthRatio: 1 }));
        const heights = measured.map((m) => m.height + 14);
        const block = heights.reduce((sum, h) => sum + h, 0) + rowGap * (contents.length - 1);
        let rowY = frame.y + (frame.height - block) / 2;
        contents.forEach((label, index) => {
          const active = index === contentsActive, rid = stableId(id, "contents", index);
          if (active) rail.push(rectPrimitive({ id: stableId(rid, "band"), role: "divider-contents-active", frame: { x: railX - 12, y: rowY, width: railWidth + 12, height: heights[index] }, style: boxStyle(inverse ? token("color.componentPrimaryTint") : PRIMARY_TINT, "none", HAIRLINE, token("radius.small")), data: { index } }));
          rail.push(textPrimitive({ id: stableId(rid, "label"), role: "divider-contents", frame: { x: railX, y: rowY + 7, width: railWidth - 24, height: measured[index].height }, text: measured[index].text, style: { ...textStyle(token("type.body"), active ? INK : muted, active, "left", "top"), lineHeight: measured[index].lineHeight, wrap: false }, data: { index, active, textLayout: measured[index] } }));
          rowY += heights[index] + rowGap;
        });
      }
      // Each system marks the chapter its own way: an accent bar over the title
      // (panel, keynote), a full-measure hairline under it with the section's
      // number set small in the accent above (editorial), the accent tab at the page's top
      // edge with the section number set in the accent (journal).
      const surfaceRight = surfaceFrame.x + surfaceFrame.width - (panelWidth ? 24 : CHROME.right);
      const marker = dividerLayout === "editorial"
        ? [openLine(stableId(id, "accent-rule"), frame.x + CHROME.left, titleTop + title.height + subGap / 2, surfaceRight, titleTop + title.height + subGap / 2, "divider-accent", RULE, HAIRLINE)]
        : dividerLayout === "journal"
          ? [rectPrimitive({ id: stableId(id, "accent-bar"), role: "divider-accent", frame: { x: frame.x + CHROME.left, y: frame.y, width: 96, height: 14 }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.none")) })]
          : [rectPrimitive({ id: stableId(id, "accent-bar"), role: "divider-accent", frame: { x: frame.x + CHROME.left, y: titleTop - ruleGap - 4, width: 64, height: 4 }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.none")) })];
      const partLabel = String(props.sectionId ?? "").trim() && ["editorial", "journal"].includes(dividerLayout)
        ? measureText(String(props.sectionId).trim().padStart(2, "0"), width, { fontFamily: tokenValue(dividerLayout === "editorial" ? FONT : DISPLAY), fontSize: tokenValue(token(dividerLayout === "editorial" ? "type.compact" : "type.metric")), bold: true, wrapWidthRatio: 1 })
        : null;
      if (partLabel) marker.push(textPrimitive({ id: stableId(id, "part"), role: "divider-number", frame: { x: frame.x + CHROME.left, y: titleTop - ruleGap - partLabel.height, width, height: partLabel.height }, text: partLabel.text, style: { ...textStyle(dividerLayout === "editorial" ? token("type.compact") : token("type.metric"), token("color.accent"), true, "left", "top"), fontFamily: dividerLayout === "editorial" ? FONT : DISPLAY, lineHeight: partLabel.lineHeight, wrap: false }, data: { sectionId: String(props.sectionId), dividerStyle, textLayout: partLabel } }));
      const bigNumeral = dividerStyle === "numbered" && !partLabel;
      return { ...page, nodes: [
        rectPrimitive({ id: stableId(id, "surface"), role: "divider-surface", frame: surfaceFrame, style: boxStyle(background, background, HAIRLINE, token("radius.none")) }),
        ...marker,
        textPrimitive({ id: stableId(id, "title"), role: "divider-title", frame: { x: frame.x + CHROME.left, y: titleTop, width, height: title.height }, text: title.text, style: { ...textStyle(token("type.deckTitle"), foreground, titleBold, "left", "top"), fontFamily: DISPLAY, lineHeight: title.lineHeight, wrap: false }, data: { textLayout: title } }),
        ...(subtitle ? [textPrimitive({ id: stableId(id, "subtitle"), role: "divider-subtitle", frame: { x: frame.x + CHROME.left, y: titleTop + title.height + subGap, width, height: subtitle.height }, text: subtitle.text, style: { ...textStyle(token("type.heading"), foreground, false, "left", "top"), lineHeight: subtitle.lineHeight, wrap: false }, data: { textLayout: subtitle } })] : []),
        ...(bigNumeral && (panelWidth || contents.length) ? [textPrimitive({ id: stableId(id, "number"), role: "divider-number", frame: { x: frame.x + CHROME.left, y: frame.y + 48, width, height: Math.max(80, titleTop - ruleGap - 24 - (frame.y + 48)) }, text: String(props.sectionId), style: { ...textStyle(token("type.sectionNumber"), inverse ? WHITE : PRIMARY, true, "left", "bottom"), fontFamily: DISPLAY }, data: { sectionId: String(props.sectionId), dividerStyle } })] : []),
        ...(bigNumeral && !panelWidth && !contents.length ? [textPrimitive({ id: stableId(id, "number"), role: "divider-number", frame: { x: frame.x + frame.width * 0.67, y: frame.y + 110, width: frame.width * 0.25, height: frame.height - 220 }, text: String(props.sectionId), style: { ...textStyle(token("type.sectionNumber"), inverse ? WHITE : PRIMARY, true, "center", "mid"), fontFamily: DISPLAY }, data: { sectionId: String(props.sectionId), dividerStyle } })] : []),
        ...rail,
        ...page.nodes
      ] };
    } }),
    // A closing page: navy, "Key takeaways", the
    // three or four messages as big serif numerals with bold copy, an optional
    // photograph on the right (media.mjs). Structural, like a divider.
    component({ id: "takeaways", category: "navigation", role: "takeaways", tokens: ["color.canvas", "color.ink", "color.onPrimary", "color.accent", "color.rule", "font.display", "font.body", "type.deckTitle", "type.heading", "type.sectionTitle", "type.body", "line.hairline", "radius.none", "space.3", "space.4", ...PAGE_TEMPLATE_TOKENS], preferredSize: { ...SLIDE }, sample: { title: "Key takeaways", items: ["(Insert takeaway 1)", "(Insert takeaway 2)", "(Insert takeaway 3)"] }, render: ({ id, frame, props }) => {
      for (const key of Object.keys(props)) if (!["title", "items", "mode", "panelWidth", "pageTemplate", "source", "note", "companyName", "pageNumber", "footerLeft", "footerRight", "headerBandHeight"].includes(key)) throw new Error(`Unknown takeaways setting: ${key}`);
      if (!Array.isArray(props.items) || props.items.length < 2 || props.items.length > 5) throw new Error("Takeaways take two to five messages");
      const inverse = (props.mode ?? "dark") === "dark";
      const page = renderPageTemplate({ id: stableId(id, "page"), frame, props: { ...props, inverse } });
      const background = inverse ? INK : token("color.canvas"), foreground = inverse ? WHITE : INK;
      const panelWidth = props.panelWidth ?? frame.width;
      const x = frame.x + CHROME.left, width = panelWidth - CHROME.left - (props.panelWidth ? 32 : CHROME.right);
      const title = measureText(props.title || "Key takeaways", width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.sectionTitle")), bold: true, wrapWidthRatio: 1 });
      const titleTop = frame.y + CHROME.titleTop + 8;
      const numeralWidth = 64, gap = tokenValue(token("space.4"));
      const items = props.items.map((item) => { if (typeof item !== "string" || !item.trim()) throw new Error("Takeaways are text"); return measureText(item.trim(), width - numeralWidth, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")), bold: true, wrapWidthRatio: 1 }); });
      const listTop = titleTop + title.height + gap + 12, listBottom = frame.y + frame.height - CHROME.bodyTop - 24;
      // Dividing the whole track by the item count gave three one-line messages
      // a 150px row each and left the bottom half of the page empty. The rows
      // take their own height plus a reading gap, the slack opens that gap up
      // to about a line and a half, and whatever is still left over centres the
      // block rather than stretching it.
      const naturalHeights = items.map((item) => item.height + 8);
      const natural = naturalHeights.reduce((sum, height) => sum + height, 0);
      const track = listBottom - listTop;
      if (natural > track) throw new Error("Takeaways exceed the page; shorten them or use fewer");
      const spread = items.length > 1 ? Math.min((track - natural) / (items.length - 1), 56) : 0;
      const block = natural + spread * (items.length - 1);
      const top = listTop + Math.max(0, (track - block) / 2);
      const nodes = [
        rectPrimitive({ id: stableId(id, "surface"), role: "takeaways-surface", frame: { ...frame, width: panelWidth }, style: boxStyle(background, background, HAIRLINE, token("radius.none")) }),
        textPrimitive({ id: stableId(id, "title"), role: "takeaways-title", frame: { x, y: titleTop, width, height: title.height }, text: title.text, style: { ...textStyle(token("type.sectionTitle"), foreground, true, "left", "top"), fontFamily: DISPLAY, lineHeight: title.lineHeight, wrap: false }, data: { textLayout: title } }),
        openLine(stableId(id, "rule"), x, titleTop + title.height + gap / 2, x + width, titleTop + title.height + gap / 2, "takeaways-rule", inverse ? WHITE : RULE, HAIRLINE),
      ];
      let rowY = top;
      items.forEach((item, index) => {
        const y = rowY + (naturalHeights[index] - item.height) / 2;
        rowY += naturalHeights[index] + spread;
        nodes.push(textPrimitive({ id: stableId(id, "numeral", index), role: "takeaways-numeral", frame: { x, y: y - 6, width: numeralWidth - 12, height: item.height + 12 }, text: String(index + 1), style: { ...textStyle(token("type.deckTitle"), inverse ? WHITE : token("color.accent"), true, "left", "top"), fontFamily: DISPLAY, wrap: false } }));
        nodes.push(textPrimitive({ id: stableId(id, "item", index), role: "takeaways-item", frame: { x: x + numeralWidth, y, width: width - numeralWidth, height: item.height }, text: item.text, style: { ...textStyle(token("type.heading"), foreground, true, "left", "top"), lineHeight: item.lineHeight, wrap: false }, data: { textLayout: item } }));
      });
      return { ...page, nodes: [...nodes, ...page.nodes] };
    }, measureContent: ({ frame, props }) => {
      const width = (props.panelWidth ?? frame.width) - CHROME.left - CHROME.right;
      const title = measureText(props.title || "Key takeaways", width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.sectionTitle")), bold: true, wrapWidthRatio: 1 });
      const items = (Array.isArray(props.items) ? props.items : []).map((item) => measureText(String(item), width - 64, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")), bold: true, wrapWidthRatio: 1 }));
      return { height: CHROME.titleTop + 8 + title.height + tokenValue(token("space.4")) + 12 + items.reduce((sum, item) => sum + item.height + 16, 0) };
    } }),
    // The statement page: one sentence set large and
    // centred, its key phrase in the accent (bold white on navy), a short accent
    // rule above; with a photograph (media.mjs) the sentence sits on a navy card.
    component({ id: "statement", category: "navigation", role: "statement", tokens: ["color.canvas", "color.ink", "color.onPrimary", "color.accent", "font.display", "font.body", "type.deckTitle", "type.heading", "line.hairline", "line.standard", "radius.none", "space.4", "space.5", ...PAGE_TEMPLATE_TOKENS], preferredSize: { ...SLIDE }, sample: { text: "The pandemic has been a catalyst for existing digital users to adopt new online services.", accent: ["adopt new online services"] }, render: ({ id, frame, props }) => {
      for (const key of Object.keys(props)) if (!["text", "accent", "subtext", "mode", "card", "pageTemplate", "source", "note", "companyName", "pageNumber", "footerLeft", "footerRight", "headerBandHeight"].includes(key)) throw new Error(`Unknown statement setting: ${key}`);
      if (typeof props.text !== "string" || !props.text.trim()) throw new Error("Statement requires text");
      const inverse = (props.mode ?? "light") === "dark";
      const page = renderPageTemplate({ id: stableId(id, "page"), frame, props: { ...props, inverse } });
      const phrases = (Array.isArray(props.accent) ? props.accent : props.accent ? [props.accent] : []).filter((p) => typeof p === "string" && p.trim());
      // Split the sentence into runs at each accent phrase, in order of appearance.
      const runs = [];
      let rest = props.text.trim();
      while (rest.length) {
        const hits = phrases.map((p) => ({ p, at: rest.indexOf(p) })).filter((h) => h.at >= 0).sort((a, b) => a.at - b.at);
        if (!hits.length) { runs.push({ text: rest, bold: false }); break; }
        const { p, at } = hits[0];
        if (at > 0) runs.push({ text: rest.slice(0, at), bold: false });
        runs.push({ text: p, bold: true, ...(inverse ? {} : { accent: true }) });
        rest = rest.slice(at + p.length);
      }
      const card = props.card ?? null;
      const width = card ? card.width - 2 * tokenValue(token("space.5")) : Math.round(frame.width * 0.72);
      const fontSize = tokenValue(token("type.deckTitle"));
      const layout = measureTextRuns(runs, width, { fontFamily: tokenValue(DISPLAY), fontSize, wrapWidthRatio: 1 });
      if (layout.lines.length > 5) throw new Error("Statement runs to more than five lines; shorten it");
      const sub = typeof props.subtext === "string" && props.subtext.trim() ? measureText(props.subtext.trim(), width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")), wrapWidthRatio: 1 }) : null;
      const gap = tokenValue(token("space.4"));
      const blockHeight = 4 + gap + layout.height + (sub ? gap + sub.height : 0);
      const cx = card ? card.x + card.width / 2 : frame.x + frame.width / 2;
      const top = card ? card.y + (card.height - blockHeight) / 2 : frame.y + (frame.height - blockHeight) / 2;
      const background = inverse ? INK : token("color.canvas"), foreground = inverse || card ? WHITE : INK;
      const nodes = [];
      if (!card) nodes.push(rectPrimitive({ id: stableId(id, "surface"), role: "statement-surface", frame, style: boxStyle(background, background, HAIRLINE, token("radius.none")) }));
      nodes.push(rectPrimitive({ id: stableId(id, "accent-bar"), role: "divider-accent", frame: { x: cx - 32, y: top, width: 64, height: 4 }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.none")) }));
      nodes.push(textPrimitive({ id: stableId(id, "text"), role: "statement-text", frame: { x: cx - width / 2, y: top + 4 + gap, width, height: layout.height }, text: layout.text, runs: layout.runs, style: { ...textStyle(token("type.deckTitle"), foreground, false, "center", "top"), fontFamily: DISPLAY, lineHeight: layout.lineHeight, wrap: false }, data: { textLayout: layout } }));
      if (sub) nodes.push(textPrimitive({ id: stableId(id, "subtext"), role: "statement-subtext", frame: { x: cx - width / 2, y: top + 4 + gap + layout.height + gap, width, height: sub.height }, text: sub.text, style: { ...textStyle(token("type.heading"), foreground, false, "center", "top"), lineHeight: sub.lineHeight, wrap: false }, data: { textLayout: sub } }));
      return { ...page, nodes: [...nodes, ...page.nodes] };
    }, measureContent: ({ frame, props }) => {
      const width = Math.round(frame.width * 0.72);
      const layout = measureText(String(props.text ?? ""), width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.deckTitle")), wrapWidthRatio: 1 });
      return { height: 4 + 2 * tokenValue(token("space.4")) + layout.height };
    } }),
    component({ id: "source", category: "shared", role: "source", tokens: ["font.body", "type.source", "color.textSecondary", "color.rule", "line.hairline"], preferredSize: { width: 920, height: 26 }, sample: { text: "Source: (Insert source)" }, render: ({ id, frame, props }) => {
      const variant = resolveTitleVariant(props);
      return { nodes: [...(variant === "with-line" ? [openLine(stableId(id, "rule"), frame.x, frame.y, frame.x + frame.width, frame.y, "source-rule", RULE, HAIRLINE)] : []), textPrimitive({ id: stableId(id, "text"), role: "source-text", frame: { x: frame.x, y: frame.y + 4, width: frame.width, height: frame.height - 4 }, text: props.text, style: textStyle(SOURCE, SECONDARY, false, "left") })] };
    } }),
    component({ id: "footnote", category: "shared", role: "footnote", tokens: ["font.body", "type.source", "color.textSecondary"], preferredSize: { width: 600, height: 34 }, sample: { text: "Note: (Insert note)" }, render: ({ id, frame, props }) => ({ nodes: [textPrimitive({ id: stableId(id, "text"), role: "footnote-text", frame, text: props.text, style: textStyle(SOURCE, SECONDARY, false, "left", "top") })] }) }),
    component({ id: "page-number", category: "shared", role: "page-number", tokens: ["font.body", "type.source", "color.textSecondary"], preferredSize: { width: 48, height: 24 }, sample: { value: 7 }, render: ({ id, frame, props }) => ({ nodes: [textPrimitive({ id: stableId(id, "text"), role: "page-number", frame, text: String(props.value), style: textStyle(SOURCE, SECONDARY, false, "right") })] }) }),
    component({ id: "paragraph", category: "text", tokens: ["font.body", "type.body", "type.compact", "color.ink", "color.textSecondary"], preferredSize: { width: 520, height: 180 }, sample: { text: "(Insert supporting statement)" }, render: ({ id, frame, props }) => {
      if (typeof props.text !== "string" || !props.text.trim()) throw new Error(`paragraph ${id} requires a non-empty text string; keep geometry in the component frame`);
      const width = paragraphMeasure(frame.width, props);
      // `variant: "caption"` is the line under a panel: compact, secondary, the
      // finding this panel carries. A well-made page captions every panel in a row
      // instead of closing the page with one shared so-what.
      const caption = props.variant === "caption";
      return { nodes: [measuredTextNode({ id: stableId(id, "text"), role: caption ? "panel-caption" : "paragraph", frame: { ...frame, width }, text: props.text, ...(props.runs?{runs:props.runs}:{}), style: textStyle(caption ? COMPACT : BODY, caption ? SECONDARY : INK, false, props.align || "left", "top") })] };
    } }),
    component({ id: "bullet-list", category: "text", tokens: ["font.body", "type.compact", "type.label", "color.ink", "color.accent", "color.componentPrimary", "color.onPrimary", "color.rule", "space.1", "space.2", "space.3", "space.4", "space.5", "line.hairline", "radius.none", "radius.round"], preferredSize: { width: 540, height: 240 }, sample: { items: ["(Insert supporting point 1)", "(Insert supporting point 2)", "(Insert supporting point 3)"] }, render: ({ id, frame, props }) => ({ nodes: simpleList({ id, frame, items: props.items, numbered: false, marker: "circle" }) }) }),
    component({ id: "insight", category: "section", role: "insight", tokens: ["color.accent", "font.display", "radius.none", "color.componentPrimaryTint", "color.componentPrimary", "color.surfaceMuted", "color.rule", "color.onPrimary", "color.ink", "font.body", "type.heading", "type.body", "space.2", "space.3", "space.4", "space.5", "space.6", "line.hairline", "line.standard", "radius.small", "radius.round", "icon.medium"], preferredSize: { width: 1160, height: 100 }, sample: { text: "(Insert decision-relevant synthesis)" }, render: input => ({ nodes: insightNodes(input) }) }),
    component({ id: "callout", category: "section", role: "callout", tokens: ["color.calloutTint", "color.caution", "color.accent", "color.surface", "color.ink", "font.body", "type.compact", "type.body", "space.2", "space.3", "space.4", "line.hairline", "radius.none"], preferredSize: { width: 360, height: 72 }, sample: { text: "(Insert reading note)" }, render: input => ({ nodes: calloutNodes(input) }) }),
    component({ id: "evidence-note", category: "section", role: "evidence-note", tokens: ["color.componentPrimaryTint", "color.componentPrimary", "color.surfaceMuted", "color.rule", "color.onPrimary", "color.ink", "font.body", "type.heading", "type.body", "space.2", "space.3", "space.4", "space.5", "space.6", "line.hairline", "line.standard", "radius.small", "radius.round", "icon.medium"], preferredSize: { width: 1160, height: 150 }, sample: { heading: "Measurement basis", text: "(Insert scope, period or scenario assumptions)" }, render: input => { if (!input.props.heading || !input.props.text) throw new Error("Evidence note requires heading and body"); return { nodes: insightNodes({...input, props:{...input.props, variant:"neutral", align:"left"}}).map(node => ({...node, role:node.role.replace("insight-", "evidence-note-")})) }; } }),
    component({ id: "panel", category: "section", role: "panel", tokens: ["color.surface", "color.surfaceMuted", "color.componentPrimary", "color.rule", "color.ink", "color.onPrimary", "font.body", "type.heading", "type.compact", "line.hairline", "radius.none", ...[1, 2, 3, 4, 5, 6].map(index => `color.chartSeries${index}`)], preferredSize: { width: 400, height: 240 }, sample: { heading: "(Insert panel heading)", text: "(Insert panel description)" }, render: ({ id, frame, props, tokens = TOKENS }) => {
      const tone = props.tone || "open";
      const seriesColorIndex = props.seriesColorIndex;
      if (seriesColorIndex !== undefined && (!Number.isInteger(seriesColorIndex) || seriesColorIndex < 0 || seriesColorIndex > 5)) throw new Error("Panel seriesColorIndex must be an integer from zero to five");
      const fill = seriesColorIndex !== undefined ? token(`color.chartSeries${seriesColorIndex + 1}`) : tone === "primary" ? PRIMARY : tone === "dark" ? INK : tone === "muted" ? MUTED_SURFACE : SURFACE;
      const foreground = seriesColorIndex !== undefined
        ? (contrastRatio(tokens[fill.tokenId].value, tokens[WHITE.tokenId].value) >= contrastRatio(tokens[fill.tokenId].value, tokens[INK.tokenId].value) ? WHITE : INK)
        : tone === "primary" || tone === "dark" ? WHITE : INK;
      const data = seriesColorIndex === undefined ? {} : { seriesKey: props.seriesKey ?? props.heading, colorIndex: seriesColorIndex };
      return { nodes: [rectPrimitive({ id: stableId(id, "surface"), role: "panel-surface", frame, style: boxStyle(fill, tone === "open" && seriesColorIndex === undefined ? RULE : fill, HAIRLINE, token("radius.none")), data }), textPrimitive({ id: stableId(id, "heading"), role: "panel-heading", frame: { x: frame.x + 10, y: frame.y + 10, width: frame.width - 20, height: 30 }, text: props.heading, style: textStyle(token("type.heading"), foreground, true), data }), textPrimitive({ id: stableId(id, "body"), role: "panel-body", frame: { x: frame.x + 10, y: frame.y + 44, width: frame.width - 20, height: frame.height - 54 }, text: props.text, style: textStyle(COMPACT, foreground, false, "left", "top"), data })] };
    } }),
    component({ id: "metric", category: "data", role: "metric", tokens: ["color.componentPrimary", "color.textSecondary", "font.display", "font.body", "type.metric", "type.deckTitle", "type.body", "type.label"], preferredSize: { width: 240, height: 140 }, sample: { value: "74%", label: "(Insert metric label)", delta: "+8 pts" }, render: ({ id, frame, props }) => ({ nodes: [textPrimitive({ id: stableId(id, "value"), role: "metric-value", frame: { x: frame.x, y: frame.y + 6, width: frame.width, height: frame.height * 0.48 }, text: props.value, style: { ...textStyle(token(props.variant === "prominent" ? "type.deckTitle" : "type.metric"), PRIMARY, true, "center"), fontFamily: DISPLAY } }), textPrimitive({ id: stableId(id, "label"), role: "metric-label", frame: { x: frame.x + 8, y: frame.y + frame.height * 0.52, width: frame.width - 16, height: 28 }, text: props.label, style: textStyle(props.variant === "prominent" ? BODY : LABEL, SECONDARY, false, "center") }), textPrimitive({ id: stableId(id, "delta"), role: "metric-delta", frame: { x: frame.x + 8, y: frame.y + frame.height - 30, width: frame.width - 16, height: 24 }, text: props.delta || "", style: textStyle(LABEL, PRIMARY, true, "center") })] }) }),
    component({ id: "legend", category: "data", role: "legend", tokens: LEGEND_TOKENS, preferredSize: { width: 420, height: 44 }, sample: { items: ["Actual", "Forecast", "Target"] }, render: input => ({ nodes: legendNodes(input) }) }),
    component({
      id: "chart-callout", category: "data", role: "annotation",
      tokens: ["color.surface", "color.rule", "color.componentPrimary", "color.ink", "color.onPrimary", "font.body", "font.bodySemibold", "weight.semibold", "type.chartAnnotation", "line.hairline", "line.standard", "radius.none", "radius.small"],
      preferredSize: { width: 260, height: 90 },
      sample: { text: "(Insert evidence annotation)", direction: "down" },
      variants: { bordered: {}, borderless: { props: { border: false } } },
      defaultVariant: "bordered", render: renderChartCallout
    }),
    component({ id: "table", category: "data", role: "table", tokens: ["color.ink", "color.componentPrimary", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "font.body", "type.label", "line.hairline", "radius.none"], preferredSize: { width: 760, height: 320 }, sample: { columns: ["Metric", "Period A", "Period B"], rows: [["Metric 1", "42", "55"], ["Metric 2", "24%", "29%"], ["Metric 3", "180", "236"]] }, render: renderTable }),
    component({ id: "trend-rows", category: "data", role: "trend-rows", tokens: ["color.ink", "color.surface", "color.rule", "color.onPrimary", "font.body", "type.heading", "type.compact", "line.hairline", "line.standard", "radius.none"], preferredSize: { width: 1160, height: 440 }, sample: { columns: ["Trend", "Description", "Examples"], rows: [["(Insert trend 1)", "• (Insert supporting point 1)\n• (Insert supporting point 2)", "• (Insert example)"], ["(Insert trend 2)", "• (Insert supporting point 1)", "• (Insert example)"], ["(Insert trend 3)", "• (Insert supporting point 1)", "• (Insert example)"]] }, render: renderTable }),
    component({ id: "comparison-table", category: "data", role: "comparison", tokens: ["color.ink", "color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "font.body", "type.label", "line.hairline", "radius.none"], preferredSize: { width: 820, height: 340 }, sample: { columns: ["Criterion", "Option A", "Option B", "Option C"], rows: [["Criterion 1", "Medium", "High", "High"], ["Criterion 2", "Low", "Medium", "Low"], ["Criterion 3", "Medium", "Medium", "High"]], selectedColumn: 3 }, render: renderTable }),
    component({ id: "heatmap", category: "data", role: "heatmap", tokens: ["color.ink", "color.componentPrimary", "color.componentPrimaryTint", "color.chartSeries1", "color.chartSeries2", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "font.body", "type.label", "line.hairline", "radius.none"], preferredSize: { width: 760, height: 320 }, sample: { columns: ["Capability", "A", "B", "C", "D"], rows: [["Capability 1", 2, 4, 5, 3], ["Capability 2", 3, 3, 4, 2], ["Capability 3", 1, 4, 5, 2]] }, render: renderTable }),
    component({ id: "status-list", category: "data", role: "status", tokens: ["color.positive", "color.caution", "color.negative", "color.onPrimary", "color.ink", "font.body", "type.compact", "type.label", "line.hairline", "radius.round"], preferredSize: { width: 600, height: 260 }, sample: { items: [{ label: "(Insert item 1)", status: "positive" }, { label: "(Insert item 2)", status: "caution" }, { label: "(Insert item 3)", status: "negative" }] }, render: ({ id, frame, props }) => ({ nodes: props.items.flatMap((item, index) => {
      const height = frame.height / props.items.length;
      const fill = item.status === "positive" ? token("color.positive") : item.status === "negative" ? token("color.negative") : token("color.caution");
      return [ellipsePrimitive({ id: stableId(id, "status", index), role: "status-marker", frame: { x: frame.x, y: frame.y + index * height + (height - 20) / 2, width: 20, height: 20 }, style: boxStyle(fill, fill, HAIRLINE, token("radius.round")) }), textPrimitive({ id: stableId(id, "status-cue", index), role: "status-cue", frame: { x: frame.x, y: frame.y + index * height + (height - 20) / 2, width: 20, height: 20 }, text: item.status === "positive" ? "✓" : item.status === "negative" ? "×" : "!", style: textStyle(LABEL, WHITE, true, "center") }), textPrimitive({ id: stableId(id, "label", index), role: "status-label", frame: { x: frame.x + 34, y: frame.y + index * height, width: frame.width - 34, height }, text: item.label, style: textStyle(COMPACT, INK, false, "left") })];
    }) }) }),
    component({ id: "image-frame", category: "media", role: "image", tokens: ["color.surfaceMuted", "color.rule", "color.textSecondary", "font.body", "type.label", "line.hairline", "radius.small"], preferredSize: { width: 520, height: 300 }, sample: { alt: "(Insert image)" }, render: ({ id, frame, props }) => { if (props.dataUri) {
      if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(props.dataUri) || !props.alt?.trim() || !props.authorization?.trim()) throw new Error("Image requires embedded PNG/JPEG, alt text and authorization");
      return { nodes: [primitive({ type: "image", id: stableId(id, "image"), role: "image", frame, data: { dataUri: props.dataUri, alt: props.alt, authorization: props.authorization, circular: false } })] };
    } return ({ nodes: [rectPrimitive({ id: stableId(id, "frame"), role: "image-frame", frame, style: boxStyle(MUTED_SURFACE, RULE, HAIRLINE, SMALL_RADIUS), data: { alt: props.alt } }), textPrimitive({ id: stableId(id, "alt"), role: "image-alt", frame: { x: frame.x + 24, y: frame.y + frame.height / 2 - 18, width: frame.width - 48, height: 36 }, text: props.alt, style: textStyle(LABEL, SECONDARY, true, "center") })] }); } }),
    component({ id: "icon", category: "media", role: "icon", tokens: ["color.componentPrimary", "color.onPrimary", "color.ink", "color.surface", "font.body", "type.heading", "type.compact", "type.label", "line.hairline", "line.standard", "radius.round", "icon.medium"], preferredSize: { width: 90, height: 90 }, sample: { icon: "target", label: "(Insert label)" }, render: ({ id, frame, props }) => {
      // A line icon in a ring (the deck's one icon treatment) with a label under
      // it. `symbol` (a glyph) is honoured for backwards compatibility.
      const size = Math.min(frame.width, props.label ? frame.height * 0.62 : frame.height);
      const x = frame.x + (frame.width - size) / 2;
      const nodes = iconMarker({ id: stableId(id, "mark"), role: "icon", x, y: frame.y, size, icon: props.icon || props.symbol, tone: props.tone || "outline" });
      if (props.label) nodes.push(textPrimitive({ id: stableId(id, "label"), role: "icon-label", frame: { x: frame.x, y: frame.y + size + 8, width: frame.width, height: frame.height - size - 8 }, text: props.label, style: textStyle(LABEL, INK, true, "center", "top") }));
      return { nodes };
    } }),
    component({ id: "logo", category: "media", role: "logo", tokens: ["color.surface", "color.rule", "color.ink", "font.display", "type.heading", "line.hairline", "radius.small"], preferredSize: { width: 220, height: 90 }, sample: { text: "(Insert logo)" }, render: ({ id, frame, props }) => ({ nodes: [rectPrimitive({ id: stableId(id, "backing"), role: "logo-backing", frame, style: boxStyle() }), textPrimitive({ id: stableId(id, "text"), role: "logo-text", frame: insetFrame(frame, 12), text: props.text, style: { ...textStyle(token("type.heading"), INK, true, "center"), fontFamily: DISPLAY } })] }) }),
    component({ id: "process", category: "relationship", role: "process", tokens: ["color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "font.body", "type.compact", "type.label", "line.standard", "line.hairline", "radius.round"], preferredSize: { width: 900, height: 280 }, sample: { items: ["(Insert step 1)", "(Insert step 2)", "(Insert step 3)", "(Insert step 4)"], active: 2 }, render: ({ id, frame, props }) => ({ nodes: processNodes({ id, frame, props: { ...props, items: props.items.map((label) => typeof label === "string" ? { label } : label) } }) }) }),
    component({ id: "chevron-process", category: "relationship", role: "process", tokens: ["color.ink", "color.componentPrimary", "color.surface", "color.surfaceMuted", "color.onPrimary", "font.body", "type.heading", "type.compact", "type.label", "line.hairline", "radius.none", "radius.round", "space.1", "space.3", "space.4"], preferredSize: { width: 1160, height: 360 }, sample: { items: [{ heading: "Phase 1", label: "(Insert phase 1)", details: ["(Insert activity 1)", "(Insert activity 2)"] }, { heading: "Phase 2", label: "(Insert phase 2)", details: ["(Insert activity 1)", "(Insert activity 2)"] }, { heading: "Phase 3", label: "(Insert phase 3)", details: ["(Insert activity 1)", "(Insert activity 2)"] }] }, render: ({ id, frame, props }) => {
      const items = props.items;
      const span = frame.width / items.length;
      const headingHeight = items.some(item => item.heading?.trim()) ? 42 : 0;
      const nodes = [];
      items.forEach((item, index) => {
        const x = frame.x + index * span;
        if (item.heading?.trim()) nodes.push(textPrimitive({ id: stableId(id, "heading", index), role: "process-heading", frame: { x: x + 8, y: frame.y, width: span - 16, height: 34 }, text: item.heading, style: textStyle(token("type.heading"), INK, true, "left") }));
        nodes.push(shapePrimitive({ id: stableId(id, "band", index), role: "process-band", geometry: "chevron", frame: { x, y: frame.y + headingHeight, width: span + (index < items.length - 1 ? tokenValue(token("space.4")) : 0), height: 70 }, style: boxStyle(index === 0 && props.emphasizeFirst ? PRIMARY : INK, SURFACE, HAIRLINE, token("radius.none")) }));
        const label = measureText(item.label, span - 72, { fontSize: tokenValue(token("type.heading")), bold: true });
        if (label.height > 64) throw new Error("Process label exceeds its band; enlarge the component or shorten the copy");
        nodes.push(textPrimitive({ id: stableId(id, "label", index), role: "process-label", frame: { x: x + 36, y: frame.y + headingHeight + 35 - label.height / 2, width: span - 72, height: label.height }, text: label.text, style: { ...textStyle(token("type.heading"), WHITE, true, "center", "top"), lineHeight: label.lineHeight, wrap: false }, data: { textLayout: label } }));
        const details = item.details || [];
        nodes.push(...simpleList({ id: stableId(id, "details", index), frame: { x: x + 10, y: frame.y + headingHeight + 90, width: span - 26, height: frame.height - headingHeight - 94 }, items: details, numbered: props.detailStyle === "circled-number", marker: "circle", rolePrefix: "process-detail" }));
      });
      return { nodes };
    } }),
    component({ id: "initiative-rollout", category: "relationship", role: "initiative-rollout", tokens: ["color.ink", "color.componentPrimary", "color.chartSeries2", "color.surfaceMuted", "color.surface", "color.onPrimary", "font.body", "type.heading", "type.compact", "type.label", "line.hairline", "line.standard", "radius.none", "radius.round"], preferredSize: { width: 1160, height: 450 }, sample: { years: ["Year 1", "Year 2", "Year 3"], rows: [{ label: "A", phases: ["(Insert phase 1)", "(Insert phase 2)", "(Insert phase 3)"] }, { label: "B", phases: ["(Insert phase 1)", "(Insert phase 2)", "(Insert phase 3)"] }] }, render: ({ id, frame, props }) => ({ nodes: initiativeRolloutNodes({ id, frame, props }) }) }),
    component({ id: "highlight-strip", category: "relationship", role: "highlight-strip", tokens: ["color.componentPrimary", "color.ink", "color.onPrimary", "font.body", "type.heading", "type.compact", "line.hairline", "radius.round"], preferredSize: { width: 1160, height: 126 }, sample: { items: [{ number: "1", heading: "(Insert highlight)", description: "(Insert description)" }, { number: "2", heading: "(Insert highlight)", description: "(Insert description)" }, { number: "3", heading: "(Insert highlight)", description: "(Insert description)" }] }, render: ({ id, frame, props }) => ({ nodes: highlightStripNodes({ id, frame, props }) }) }),
    component({ id: "roadmap", category: "relationship", role: "roadmap", tokens: ["color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.heading", "type.compact", "type.label", "line.standard", "line.hairline", "radius.round", "radius.small"], preferredSize: { width: 980, height: 360 }, sample: { items: ["(Insert stage 1)", "(Insert stage 2)", "(Insert stage 3)", "(Insert stage 4)"], active: 1 }, render: ({ id, frame, props }) => ({ nodes: props.variant === "wave-columns" ? waveRoadmapNodes({ id, frame, props }) : processNodes({ id, frame, props: { ...props, items: props.items.map((label) => typeof label === "string" ? { label } : label) }, roadmap: true }) }) }),
    component({ id: "timeline", category: "relationship", role: "timeline", tokens: ["color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "font.body", "type.compact", "type.label", "line.standard", "line.hairline", "radius.round"], preferredSize: { width: 920, height: 250 }, sample: { items: ["Q1", "Q2", "Q3", "Q4"], active: 2 }, render: ({ id, frame, props }) => ({ nodes: processNodes({ id, frame, props: { ...props, items: props.items.map((label) => ({ label })) } }) }) }),
    component({ id: "journey", category: "relationship", role: "journey", tokens: ["color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.compact", "type.label", "line.standard", "line.hairline", "radius.round"], preferredSize: { width: 960, height: 300 }, sample: { items: [{ label: "(Insert stage 1)", touchpoint: "(Insert touchpoint 1)" }, { label: "(Insert stage 2)", touchpoint: "(Insert touchpoint 2)" }, { label: "(Insert stage 3)", touchpoint: "(Insert touchpoint 3)" }, { label: "(Insert stage 4)", touchpoint: "(Insert touchpoint 4)" }], active: 3 }, render: ({ id, frame, props }) => ({ nodes: processNodes({ id, frame, props, journey: true }) }) }),
    component({ id: "tree", category: "relationship", role: "tree", tokens: ["color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.rule", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.compact", "line.hairline", "line.standard", "radius.small"], preferredSize: { width: 900, height: 360 }, sample: { root: "(Insert root question)", children: ["(Insert branch 1)", "(Insert branch 2)", "(Insert branch 3)", "(Insert branch 4)"] }, render: ({ id, frame, props }) => ({ nodes: treeNodes({ id, frame, props }) }) }),
    component({ id: "organization", category: "relationship", role: "organization", tokens: ["color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.compact", "type.body", "space.2", "space.4", "line.hairline", "line.standard", "radius.none", "radius.small"], preferredSize: { width: 900, height: 360 }, sample: { root: "(Insert parent role)", children: ["(Insert role 1)", "(Insert role 2)", "(Insert role 3)", "(Insert role 4)"] }, render: ({ id, frame, props }) => ({ nodes: treeNodes({ id, frame, props, organization: true }) }) }),
    component({ id: "matrix", category: "relationship", role: "matrix", tokens: ["color.componentPrimary", "color.accent", "color.accentTint", "color.surfaceMuted", "color.textSecondary", "color.chartSeries2", "color.surface", "color.rule", "color.ink", "color.positive", "color.caution", "color.negative", "color.onPrimary", "font.body", "type.label", "line.hairline", "line.standard", "radius.none", "radius.round"], preferredSize: { width: 720, height: 410 }, sample: { xAxis: { label: "Effort", minLabel: "Low", maxLabel: "High" }, yAxis: { label: "Impact", minLabel: "Low", maxLabel: "High" }, points: [{ label: "A", x: 0.24, y: 0.35 }, { label: "B", x: 0.56, y: 0.62 }, { label: "C", x: 0.76, y: 0.82 }], highlight: 2 }, render: ({ id, frame, props }) => ({ nodes: matrixNodes({ id, frame, props }) }) }),
    component({ id: "map", category: "relationship", role: "map", tokens: MAP_TOKENS, preferredSize: { width: 920, height: 440 }, sample: { geography: "world", markers: [{ label: "Americas", x: 0.2, y: 0.45, fraction: 0.75 }, { label: "Europe", x: 0.5, y: 0.34, fraction: 0.5 }, { label: "Asia", x: 0.77, y: 0.44, fraction: 0.25 }] }, render: ({ id, frame, props }) => ({ nodes: mapNodes({ id, frame, props }) }) }),
    component({ id: "funnel", category: "relationship", role: "funnel", tokens: ["color.componentPrimary", "color.chartSeries2", "color.chartSeries3", "color.chartSeries4", "color.onPrimary", "color.ink", "font.body", "type.compact", "line.hairline", "radius.small"], preferredSize: { width: 700, height: 360 }, sample: { stages: [{ label: "Market", value: 100 }, { label: "Qualified", value: 62 }, { label: "Engaged", value: 38 }, { label: "Won", value: 18 }] }, render: ({ id, frame, props, tokens = TOKENS }) => {
      const colors = [PRIMARY, token("color.chartSeries2"), token("color.chartSeries3"), token("color.chartSeries4")];
      if (!Array.isArray(props.stages) || !props.stages.length || !(props.stages[0].value > 0) || props.stages.some(stage => !Number.isFinite(stage.value) || stage.value < 0 || stage.value > props.stages[0].value)) throw new Error("Funnel stages require non-negative values within a positive denominator");
      const max = props.stages[0].value;
      const height = frame.height / props.stages.length;
      return { nodes: props.stages.flatMap((stage, index) => {
        const plotWidth = frame.width * 0.6;
        const width = plotWidth * stage.value / max, x = frame.x + (plotWidth - width) / 2;
        const fill = colors[index % colors.length];
        return [...(width > 0 ? [rectPrimitive({ id: stableId(id, "stage", index), role: "funnel-stage", frame: { x, y: frame.y + index * height + 3, width, height: height - 6 }, style: boxStyle(fill, fill, HAIRLINE, SMALL_RADIUS) })] : []), textPrimitive({ id: stableId(id, "label", index), role: "funnel-label", frame: { x: frame.x + plotWidth + 12, y: frame.y + index * height + 3, width: frame.width - plotWidth - 12, height: height - 6 }, text: `${stage.label}  ${stage.value}`, style: textStyle(COMPACT, INK, true, "left") })];
      }) };
    } }),
    component({ id: "connector", category: "relationship", role: "connector", tokens: ["color.componentPrimary", "color.onPrimary", "font.body", "type.label", "color.rule", "line.standard", "line.hairline", "icon.medium", "icon.large", "space.2", "radius.none", "radius.round"], preferredSize: { width: 360, height: 90 }, sample: { label: "therefore", variant: "labelled-line" }, render: ({ id, frame, props }) => {
      const variant = props.variant ?? (props.label ? "labelled-line" : "disc-chevron"), centerY = frame.y + frame.height / 2;
      if (variant === "chevron") return { nodes: [lightChevronNode(id, frame)] };
      // `divider`: the quiet end of the range - one solid hairline down the
      // gutter and nothing on it. It separates the evidence from what is read
      // off it without asserting an inference, which is what most well-made
      // pages do when the right-hand heading already says "as a
      // result". Reach for it whenever the relation is carried in the words.
      // `arrow`: a filled block arrow pointing from the evidence at what
      // follows from it. Where the disc is a small punctuation mark in the
      // gutter, this is a shape the page can see from across a room, and a
      // strong deck spends it on the page's own conclusion - dropped into the
      // line that closes the page, or fanned from a model into what each
      // function becomes. It points
      // the way the argument runs: across a gutter between two columns, down a
      // band drawn across the page.
      if (variant === "arrow") {
        // It points the way the argument runs, and so takes its direction from
        // the frame the same way the divider chevron does: down a gutter
        // between two columns it points across at the meaning beside it, and on
        // a band drawn across the page it points down at what follows.
        const across = frame.width > frame.height;
        const thickness = Math.min(props.size ?? tokenValue(token("icon.large")), frame.width, frame.height);
        const length = thickness * 1.1;
        const width = across ? thickness : length, height = across ? length : thickness;
        return { nodes: [shapePrimitive({
          id: stableId(id, "arrow"), role: "relationship-arrow", geometry: across ? "downArrow" : "rightArrow",
          frame: { x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - height) / 2, width, height },
          style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.none")),
          data: { relation: "implies", arrowVariant: variant },
        })] };
      }
      if (variant === "divider") {
        const across = frame.width > frame.height;
        const centerX = frame.x + frame.width / 2;
        return { nodes: [linePrimitive({
          id: stableId(id, "rule"), role: "relationship-divider",
          x1: across ? frame.x : centerX, y1: across ? centerY : frame.y,
          x2: across ? frame.x + frame.width : centerX, y2: across ? centerY : frame.y + frame.height,
          style: { stroke: RULE, lineWidth: HAIRLINE },
          data: { relation: "adjacent", orientation: across ? "horizontal" : "vertical" },
        })] };
      }
      // `divider-chevron`: a dashed rule down the gutter with the disc centred
      // on it, for a right-hand column that runs full bleed (a toned panel, a
      // photograph) where a floating disc would have nothing to sit against.
      if (variant === "divider-chevron") {
        // The dashed rule with the disc sitting on it, broken around the disc.
        // It takes the orientation of the frame it is given: down a gutter
        // between two columns, or across the page between a row of measures and
        // what follows from them. The chevron points down either way - it is
        // the same device saying the same thing, and "therefore" reads
        // downwards on a page whatever direction the rule runs.
        const across = frame.width > frame.height;
        const diameter = Math.min(props.size ?? tokenValue(token("icon.large")), frame.width, frame.height);
        const centerX = frame.x + frame.width / 2;
        const gap = diameter / 2 + tokenValue(token("space.2"));
        const start = across ? frame.x : frame.y, end = across ? frame.x + frame.width : frame.y + frame.height;
        const middle = across ? centerX : centerY;
        const segment = (suffix, from, to) => linePrimitive({
          id: stableId(id, suffix), role: "relationship-divider",
          x1: across ? from : centerX, y1: across ? centerY : from,
          x2: across ? to : centerX, y2: across ? centerY : to,
          style: { stroke: RULE, lineWidth: HAIRLINE, dash: "dash" }, data: { relation: "implies", orientation: across ? "horizontal" : "vertical" },
        });
        // The chevron points the way the argument runs: along a vertical gutter
        // it points across to the meaning beside it, and on a rule drawn across
        // the page it points down, at what follows from the row above.
        const chevron = across
          ? [[centerX - diameter / 4, centerY - diameter / 8, centerX, centerY + diameter / 8],
             [centerX, centerY + diameter / 8, centerX + diameter / 4, centerY - diameter / 8]]
          : [[centerX - diameter / 8, centerY - diameter / 4, centerX + diameter / 8, centerY],
             [centerX + diameter / 8, centerY, centerX - diameter / 8, centerY + diameter / 4]];
        return { nodes: [
          segment("rule-top", start, Math.max(start, middle - gap)),
          segment("rule-bottom", Math.min(end, middle + gap), end),
          ellipsePrimitive({ id: stableId(id, "disc"), role: "relationship-disc", frame: { x: centerX - diameter / 2, y: centerY - diameter / 2, width: diameter, height: diameter }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")), data: { relation: "implies", arrowVariant: variant } }),
          openLine(stableId(id, "chevron-top"), ...chevron[0], "relationship-chevron", WHITE, STANDARD, { relation: "implies", arrowVariant: variant, arrowPart: 1 }),
          openLine(stableId(id, "chevron-bottom"), ...chevron[1], "relationship-chevron", WHITE, STANDARD, { relation: "implies", arrowVariant: variant, arrowPart: 2 })
        ] };
      }
      if (variant === "disc-chevron") {
        const diameter = Math.min(props.size ?? tokenValue(token("icon.large")), frame.width, frame.height), centerX = frame.x + frame.width / 2;
        return { nodes: [
          ellipsePrimitive({ id: stableId(id, "disc"), role: "relationship-disc", frame: { x: centerX - diameter / 2, y: centerY - diameter / 2, width: diameter, height: diameter }, style: boxStyle(PRIMARY, PRIMARY, HAIRLINE, token("radius.round")), data: { relation: "implies", arrowVariant: variant, arrowPart: 0 } }),
          openLine(stableId(id, "chevron-top"), centerX - diameter / 8, centerY - diameter / 4, centerX + diameter / 8, centerY, "relationship-chevron", WHITE, STANDARD, { relation: "implies", arrowVariant: variant, arrowPart: 1 }),
          openLine(stableId(id, "chevron-bottom"), centerX + diameter / 8, centerY, centerX - diameter / 8, centerY + diameter / 4, "relationship-chevron", WHITE, STANDARD, { relation: "implies", arrowVariant: variant, arrowPart: 2 })
        ] };
      }
      const line = openLine(stableId(id, "line"), frame.x, centerY, frame.x + frame.width - 2, centerY, "relationship-arrow", PRIMARY, STANDARD, { relation: "implies", arrowVariant: "line", endArrow: true, endArrowType: "triangle" });
      if (variant === "line") return { nodes: [line] };
      return { nodes: [line, textPrimitive({ id: stableId(id, "label"), role: "connector-label", frame: { x: frame.x + frame.width * 0.28, y: frame.y, width: frame.width * 0.44, height: frame.height / 2 - 4 }, text: props.label, style: textStyle(LABEL, PRIMARY, true, "center") })] };
    } }),
    component({ id: "content-rail", category: "section", role: "rail", tokens: ["color.surface", "color.surfaceMuted", "color.rule", "type.compact", "space.1", "space.3", "radius.none", "radius.round", ...SECTION_HEADING_TOKENS], preferredSize: { width: 330, height: 360 }, sample: { heading: "(Insert takeaway heading)", items: ["(Insert evidence-backed takeaway 1)", "(Insert evidence-backed takeaway 2)", "(Insert evidence-backed takeaway 3)"] }, render: ({ id, frame, props }) => {
      const treatment = props.treatment || "muted";
      const inset = normalizeInsets(contentRailInsets(props));
      const nodes = [];
      if (treatment === "muted") nodes.push(rectPrimitive({ id: stableId(id, "surface"), role: "rail-surface", frame, style: boxStyle(MUTED_SURFACE, MUTED_SURFACE, HAIRLINE, token("radius.none")) }));
      if (props.dividerLeft) nodes.push(openLine(stableId(id, "divider"), frame.x, frame.y, frame.x, frame.y + frame.height, "rail-divider", RULE, HAIRLINE));
      const headerFrame = { x: frame.x + inset.left, y: frame.y + inset.top, width: frame.width - inset.left - inset.right, height: 52 };
      const headerProps = { ...props, variant: treatment === "muted" ? "accent" : "standard", rule: treatment === "open" };
      nodes.push(...sectionHeadingNodes({ id: stableId(id, "header"), frame: headerFrame, props: headerProps }));
      const listTop = headerFrame.y + headingLayout(headerFrame, headerProps).height + tokenValue(token("space.2"));
      nodes.push(...simpleList({ id: stableId(id, "list"), frame: { x: frame.x + inset.left, y: listTop, width: frame.width - inset.left - inset.right, height: frame.y + frame.height - listTop - 12 }, items: props.items, marker: "circle", rolePrefix: "rail" }));
      return { nodes };
    } }),
  ];
  for (const definition of definitions) {
    if (["process", "roadmap", "timeline", "journey"].includes(definition.id)) {
      definition.tokens.push("space.2");
      definition.version = "2.1.0";
    }
    if (["table", "comparison-table", "heatmap", "trend-rows"].includes(definition.id)) {
      definition.version = "3.2.0";
      definition.tokens = TABLE_TOKENS;
      const normalize = props => {
        if (definition.id === "heatmap") return { ...props, columns: props.columns.map((label,index)=>({label,type:index?'heatmap':'text',scale:index?'score':undefined})), rows: props.rows.map(row=>row.map((value,index)=>index?{value}:value)), scales: {score:{type:'heatmap',label:'Assessment',min:1,max:5,anchors:{1:'Low',3:'Medium',5:'High'}}} };
        if (definition.id === "trend-rows") return { ...props, columns: props.columns.map((label,index)=>({label,type:index?'text':'category',width:[.18,.52,.3][index]})) };
        if (definition.id === "comparison-table") {
          if (props.selectedColumn !== undefined && (!Number.isInteger(props.selectedColumn) || props.selectedColumn < 0 || props.selectedColumn >= props.columns.length)) throw new Error("Invalid comparison selectedColumn");
          return { ...props, rows: props.rows.map(row => {
            const cells = (Array.isArray(row) ? row : row.cells).map((value, index) => {
              if (index !== props.selectedColumn || value === null) return value;
              return typeof value === "object" && !Array.isArray(value)
                ? { ...value, highlight: true }
                : { text: String(value), value, highlight: true };
            });
            return Array.isArray(row) ? cells : { ...row, cells };
          }) };
        }
        return props;
      };
      definition.render = input => renderTable({...input,props:normalize(input.props)});
      definition.measureContent = input => measureTable({...input,props:normalize(input.props)});
      definition.measureHeader = ({ frame, props = {} }) => {
        if (props.headerShape === "chevron") return null;
        const measured = measureTable({ frame: { ...frame, height: Infinity }, props: { ...normalize(props), fillHeight: false, headerBandHeight: undefined } });
        return measured.headerHeight ? { top: frame.y, ruled: true, height: measured.headerHeight - tokenValue(token("space.1")) } : null;
      };
      if (definition.id === "table") {
        definition.variants = TABLE_VARIANTS;
        definition.defaultVariant = "open";
        definition.variantProp = "variant";
        definition.resolveVariant = props => props.variant ?? (props.treatment === "standard" ? "standard" : "open");
        const render=definition.render;
        definition.render=input=>{if(!Object.hasOwn(TABLE_VARIANTS,definition.resolveVariant(input.props)))throw new Error('Unknown table variant');return render(input);};
      }
    }
    const axes = { section: ["treatment", ["open", "muted", "primary", "dark", "tint", "card"]], panel: ["tone", ["open", "muted", "primary", "dark"]], "content-rail": ["treatment", ["muted", "open"]], roadmap: ["variant", ["process", "wave-columns"]], "section-heading": ["variant", ["standard", "accent", "inverse"]] };
    axes["section-boundary"] = ["variant", ["related", "inference", "inference-chevron", "subsection"]];
    axes.metric = ["variant", ["default", "prominent"]];
    axes.connector = ["variant", ["disc-chevron", "divider-chevron", "divider", "arrow", "chevron", "line", "labelled-line"]];
    axes["bullet-list"] = ["variant", ["compact", "body"]];
    axes.insight = ["variant", ["tonal", "neutral", "dotted", "primary", "plain", "rule", "statement"]];
    if (axes[definition.id]) {
      const [prop, choices] = axes[definition.id];
      definition.variants = Object.fromEntries(choices.map(choice => [choice, {}]));
      definition.defaultVariant = choices[0];
      definition.variantProp = prop;
      definition.resolveVariant = (props = {}) => {
        const value = props[prop] ?? choices[0];
        if (!choices.includes(value)) throw new Error(`Unknown ${definition.id} variant: ${value}`);
        return value;
      };
      const render = definition.render;
      definition.render = input => { definition.resolveVariant(input.props); return render(input); };
    }
    if (definition.id === "timeline") {
      definition.version = "2.2.0";
      definition.tokens = [...new Set([...definition.tokens, ...SCHEDULE_TOKENS])];
      definition.variants = { process: {}, ...SCHEDULE_VARIANTS, "phase-hierarchy": { preferredSize:{width:1160,height:380}, props:{...PHASE_HIERARCHY_SAMPLE,items:undefined} } };
      definition.tokens = [...new Set([...definition.tokens,...QUALITATIVE_TOPOLOGY_TOKENS])];
      definition.version = "2.3.0";
      definition.defaultVariant = "process";
      definition.variantProp = "variant";
      definition.resolveVariant = (props = {}) => {
        const variant = props.variant ?? "process";
        if (!Object.hasOwn(definition.variants, variant)) throw new Error(`Unknown timeline variant: ${variant}`);
        return variant;
      };
      const render = definition.render;
      const schedule = input => definition.resolveVariant(input.props) === "phase-hierarchy" ? renderPhaseHierarchy(input) : definition.resolveVariant(input.props) === "time-grid" ? timeGrid(input) : datedLanes(input);
      definition.render = input => definition.resolveVariant(input.props) === "process" ? render(input) : schedule(input);
      definition.measureIntrinsic = input => definition.resolveVariant(input.props) === "process" ? null : schedule({ ...input, id: input.id ?? "measure", frame: { ...input.frame, height: input.frame.height ?? Number.MAX_SAFE_INTEGER } });
    }
    if (definition.id === "funnel") {
      definition.version = "2.0.0";
      definition.tokens = [...new Set([...definition.tokens,...QUALITATIVE_TOPOLOGY_TOKENS])];
      definition.variants = { quantitative:{}, qualitative:{preferredSize:{width:1160,height:480},props:QUALITATIVE_FUNNEL_SAMPLE} };
      definition.defaultVariant = "quantitative"; definition.variantProp = "variant";
      definition.resolveVariant = (props={}) => {const variant=props.variant??"quantitative";if(!Object.hasOwn(definition.variants,variant))throw new Error(`Unknown funnel variant: ${variant}`);return variant;};
      const render = definition.render;
      definition.render = input => definition.resolveVariant(input.props)==="qualitative" ? renderQualitativeFunnel(input) : render(input);
      definition.measureIntrinsic = input => definition.resolveVariant(input.props)==="qualitative" ? measureQualitativeFunnel(input) : null;
    }
    if (definition.id === "roadmap") {
      definition.version = "2.2.0";
      definition.tokens.push("space.2", "space.3", "space.4", "icon.medium");
      definition.variants["wave-columns"] = { preferredSize: { width: 1160, height: 480 }, props: { items: [1, 2, 3].map((index) => ({ heading: `(Insert wave ${index} heading)`, range: `(Insert time range ${index})`, activities: ["(Insert activity)"], deliverables: ["(Insert deliverable)"] })) } };
      definition.version = "2.3.0";
      definition.tokens = [...new Set([...definition.tokens, ...PHASE_WORKSTREAM_TOKENS])];
      Object.assign(definition.variants, PHASE_WORKSTREAM_VARIANTS);
      const priorResolve = definition.resolveVariant;
      definition.resolveVariant = props => props?.variant === "phase-workstreams" ? "phase-workstreams" : priorResolve(props);
      const priorRender = definition.render;
      definition.render = input => definition.resolveVariant(input.props) === "phase-workstreams" ? renderPhaseWorkstreams(input) : priorRender(input);
      definition.measureIntrinsic = ({ frame, props }) => definition.resolveVariant(props) === "phase-workstreams" ? measurePhaseWorkstreams({frame,props}) : definition.resolveVariant(props) === "wave-columns" ? waveRoadmapLayout(frame, props) : null;
    }
    if (definition.id === "bullet-list") {
      definition.tokens.push("type.body", "space.2", "space.4", ...MARK_TOKENS, "color.positive", "color.negative");
      const render = definition.render;
      definition.render = input => definition.resolveVariant(input.props) === "body" ? { nodes: bodyListNodes(input) } : render(input);
      definition.measureContent = ({ frame, props }) => {
        if (definition.resolveVariant(props) !== "body") throw new Error("Content measurement requires the body bullet-list variant");
        return bodyListLayout(frame, props.items, props);
      };
      definition.measureIntrinsic = input => definition.resolveVariant(input.props) === "body" ? definition.measureContent(input) : null;
    }
    if (definition.id === "paragraph") definition.measureContent = ({ frame, props }) => {
      // Geometry-only layout probes have no copy yet; rendering still requires it.
      if (!Object.hasOwn(props ?? {}, "text")) return null;
      if (typeof props.text !== "string" || !props.text.trim()) throw new Error("paragraph requires a non-empty text string for measurement");
      if(props.runs && props.runs.map(r=>r.text).join("")!==props.text)throw new Error("Paragraph emphasis must preserve exact text");
      return (props.runs?measureTextRuns:measureText)(props.runs||props.text, paragraphMeasure(frame.width, props), { fontFamily: tokenValue(FONT), fontSize: tokenValue(BODY), bold: false, wrapWidthRatio: 1 });
    };
    if (definition.id === "section") definition.measureInsets = ({ frame, props }) => sectionContentInsets(frame, props);
    if (definition.id === "section-heading") definition.variants.inverse = { backdrop: "primary" };
    if (["insight", "evidence-note"].includes(definition.id)) definition.measureContent = ({ frame, props }) => { definition.resolveVariant(props); return insightLayout(frame, props); };
    if (definition.id === "callout") definition.measureContent = ({ frame, props }) => calloutLayout(frame, props);
    if (definition.id === "section-boundary") definition.variants.subsection = { preferredSize: { width: 520, height: 24 } };
    if (definition.id === "map") {
      definition.version = "3.1.0";
      definition.variants = Object.fromEntries(MAP_PRESET_IDS.map((geography) => [geography, { props: { geography, markers: [] } }]));
      definition.defaultVariant = "world";
      definition.variantProp = "geography";
      definition.resolveVariant = (props = {}) => resolveGeography(props.geography ?? "world").id;
      definition.guidance = MAP_GUIDANCE;
      const render = definition.render;
      definition.render = input => { definition.resolveVariant(input.props); return render(input); };
      definition.examples = {
        "quantitative-regions": { props: {...CHOROPLETH_MAP_SAMPLE, highlightCountries:undefined, markers:undefined}, preferredSize: {width:600,height:400} },
        "imported-geometry": { props: { geography: CUSTOM_MAP_SAMPLE, highlightCountries: ["DEU"], markers: [{longitude:13.4,latitude:52.5,label:"Berlin",size:14}] } },
        "world-country-highlight": { props: { geography: "world", markers: [], highlightCountries: ["USA", "DEU", "CHN"] } },
        "country-marker-anchor": { props: { geography: "europe", markers: [{ country: "GBR", label: "United Kingdom", fraction: 1 }] } }
      };
    }
    if (definition.id === "legend") {
      definition.version = "2.1.0";
      const visuallyDistinctPlacements = LEGEND_PLACEMENTS.filter(placement => placement !== "inline");
      definition.variants = Object.fromEntries(Object.keys(LEGEND_VARIANTS).filter(mark => mark !== "quantitative-scale").flatMap(mark => visuallyDistinctPlacements.map(placement => [`${mark}-${placement}`, { props: { variant: mark, placement, items: [{ label: "Actual", state: "actual" }, { label: "Forecast", state: "forecast" }, { label: "Target", state: "target" }] }, preferredSize: { width: 540, height: placement === "right" ? 120 : 44 } }])));
      definition.variants["quantitative-scale-top"] = {props: {...QUANTITATIVE_LEGEND_SAMPLE, items:undefined, placement:"top"}, preferredSize:{width:540,height:64}};
      definition.defaultVariant = "swatch-top";
      definition.resolveVariant = (props = {}) => `${props.variant ?? "swatch"}-${props.placement ?? "top"}`;
    }
    if (["action-title", "section-title", "slide-chrome"].includes(definition.id)) {
      definition.variants = TITLE_VARIANTS;
      definition.defaultVariant = DEFAULT_TITLE_VARIANT;
      definition.variantProp = definition.id === "slide-chrome" ? "titleVariant" : "variant";
      definition.resolveVariant = definition.id === "slide-chrome"
        ? (props = {}) => props.titleVariant === undefined && props.titleRule === undefined ? (houseStyle("style.titleRule") === "rule" ? "with-line" : DEFAULT_TITLE_VARIANT) : resolveTitleVariant({ variant: props.titleVariant, rule: props.titleRule })
        : resolveTitleVariant;
    }
    if (definition.id === "slide-chrome") {
      definition.version = "2.1.0";
      definition.examples = { "compact-content-spacing": { props: { pageTemplate: { contentSpacing: "compact" } } } };
    }
    if (definition.id === "source") {
      definition.variants = TITLE_VARIANTS; definition.defaultVariant = DEFAULT_TITLE_VARIANT;
      definition.variantProp = "variant"; definition.resolveVariant = resolveTitleVariant;
    }
    if (definition.id === "page-template") {
      const logo = { component: "paragraph", props: { text: "Company name" } };
      definition.variants = Object.fromEntries(PAGE_RULES.flatMap(rules => PAGE_BRANDING.map(branding => [`${rules}-${branding}`, { props: { pageTemplate: { rules, branding, ...(branding === "top-right-logo" ? { logo } : {}) } } }])));
      definition.defaultVariant = "none-footer-company";
      definition.resolveVariant = props => { const t = resolvePageTemplate(props?.pageTemplate); return `${t.rules}-${t.branding}`; };
      definition.resolveTemplate = resolvePageTemplate;
      definition.measurePage = pageTemplateLayout;
      definition.examples = {
        "wrapped-sources": { props: { source: "Source: Company operating data for the twelve months ended June 2026, customer research and team analysis of the regional growth outlook and delivery capacity by market. Values include analyst calculations based on the stated reporting perimeter." } },
        "source-and-note": { props: { note: "Note: Figures may not sum due to rounding." } },
        "separate-sources": { props: { footerLeft: "Report title", pageTemplate: { rules: "bottom", sourcePlacement: "separate" } } }
      };
    }
    if (definition.id === "section-divider") {
      definition.variants = Object.fromEntries(["plain", "numbered"].flatMap(style => ["dark", "light"].flatMap(mode => PAGE_RULES.map(rules => [`${style}-${mode}-${rules}`, { props: { style, mode, ...(style === "numbered" ? { sectionId: "1" } : {}), pageTemplate: { rules } } }]))));
      definition.defaultVariant = "plain-dark-none";
      definition.resolveVariant = (props = {}) => {
        const mode = props.mode ?? "dark";
        const style = props.style ?? "plain";
        if (!["light", "dark"].includes(mode)) throw new Error(`Unknown section-divider mode: ${mode}`);
        if (!["plain", "numbered"].includes(style)) throw new Error(`Unknown section-divider style: ${style}`);
        return `${style}-${mode}-${resolvePageTemplate(props.pageTemplate).rules}`;
      };
      const render = definition.render;
      definition.render = input => { definition.resolveVariant(input.props); return render(input); };
    }
    if (definition.id === "trend-rows") definition.tokens = [...new Set([...definition.tokens, ...SECTION_HEADING_TOKENS])].sort();
    if (["section", "section-heading", "content-rail"].includes(definition.id)) {
      if (definition.id === "content-rail") definition.version = "2.1.0";
      const render = definition.render;
      definition.render = (input) => {
        assertSectionHeadingProps(input.props);
        return render(input);
      };
      definition.measureHeader = ({ frame, props = {} }) => {
        assertSectionHeadingProps(props);
        if (!(props.heading || props.text)) return null;
        const rail = definition.id === "content-rail";
        const padding = normalizeInsets(rail ? contentRailInsets(props) : definition.id === "section" ? props.padding ?? token("space.4") : 0);
        const headerFrame = insetFrame(frame, padding);
        const ruled = rail ? props.treatment === "open" : props.rule !== false && props.treatment !== "muted";
        return { top: headerFrame.y, ruled, height: headingLayout(headerFrame, { ...props, rule: ruled }).bandHeight };
      };
      if (definition.id === "section-heading") definition.measureIntrinsic = ({ frame = {}, props = {} }) => {
        const measured = definition.measureHeader({ frame: { x: 0, y: 0, height: Number.MAX_SAFE_INTEGER, ...frame }, props });
        return { height: measured?.height ?? 0 };
      };
    }
    registry.set(definition.id, definition);
  }
  registry.set("chart-title", {
    id: "chart-title", version: "2.1.0", category: "shared", role: "chart-title",
    tokens: [...SECTION_HEADING_TOKENS, "color.chartUnit", "color.accent", "color.textSecondary", "color.onPrimary", "type.compact", "space.1", "space.2", "space.3", "radius.round", "radius.none", ...STYLE_TOKENS],
    preferredSize: { width: 540, height: 76 }, sample: { heading: "(Insert chart title)", unit: "(Insert unit)" },
    variants: { underlined: {}, unit: { props: { unit: "Revenue share, %" } } }, defaultVariant: "underlined", variantProp: "variant", resolveVariant: resolveChartTitleVariant,
    measureContent: ({ frame, props }) => chartTitleLayout(frame, props),
    measureHeader: ({ frame, props }) => {
      const layout = chartTitleLayout(frame, props);
      return { top: frame.y, ruled: layout.ruled, height: layout.contentHeight };
    },
    render: input => ({ nodes: chartTitleNodes(input) })
  });
  return registry;
}

export function createRegistry() {
  return registerFigures(registerFramework(registerGantt(registerExtras(registerPanels(registerRelationshipNetwork(registerSegmentedEvidence(registerMedia(registerChartGroup(registerCharts(registerQuoteCluster(registerInsightTreeTable(registerTrackers(registerCore(new Map()))))))))))))));
}

export const REGISTRY = createRegistry();

export const COMPONENT_IDS = Object.freeze([...REGISTRY.values()].filter((definition) => definition.category !== "chart").map((definition) => definition.id));

export function registryManifest() {
  return {
    schema: "professional-slides.component-registry/v1",
    components: [...REGISTRY.values()].map((definition) => ({
      id: definition.id,
      version: definition.version,
      category: definition.category,
      role: definition.role,
      ...(definition.variants ? { variants: definition.variants, defaultVariant: definition.defaultVariant, variantProp: definition.variantProp } : {}),
      ...(definition.examples ? { examples: definition.examples } : {}),
      tokens: definition.tokens,
      preferredSize: definition.preferredSize,
      sample: definition.sample,
      ...(definition.guidance ? { guidance: definition.guidance } : {})
    }))
  };
}
