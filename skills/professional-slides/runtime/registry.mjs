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
import { TABLE_VARIANTS } from "./table-fixtures.mjs";
import { measureText, measureTextRuns } from "./text-layout.mjs";
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

const textStyle = (size = BODY, color = INK, bold = false, align = "left", valign = "mid") => ({
  fontFamily: FONT,
  fontSize: size,
  color,
  bold,
  align,
  valign
});

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

// Degradation ladder for measured text: fit at the token size; otherwise step the
// size down in 0.5pt steps to a floor of 80% (never below 9pt) and record the step.
// Only when the floor still overflows does the component refuse, naming the overflow.
export function fitText({ text, runs, width, height, fontFamily, fontSize, bold, minScale = 0.8, floorPt = 9 }) {
  const measure = (size) => runs ? measureTextRuns(runs, width, { fontFamily, fontSize: size, wrapWidthRatio: 1 }) : measureText(text, width, { fontFamily, fontSize: size, bold, wrapWidthRatio: 1 });
  let size = fontSize, layout = measure(size);
  const floor = Math.max(floorPt, Math.round(fontSize * minScale * 2) / 2);
  while (height !== undefined && layout.height > height && size - 0.5 >= floor) { size -= 0.5; layout = measure(size); }
  return { layout, fontSize: size, stepped: size !== fontSize, overflow: height !== undefined && layout.height > height ? layout.height - height : 0 };
}

function measuredTextNode(input) {
  if(input.runs && input.runs.map(r=>r.text).join("")!==input.text)throw new Error("Paragraph emphasis must preserve exact text");
  const fit = fitText({ text: input.text, runs: input.runs, width: input.frame.width, height: input.frame.height, fontFamily: tokenValue(input.style.fontFamily), fontSize: tokenValue(input.style.fontSize), bold: input.style.bold });
  if (fit.overflow > 0) throw new Error(`${input.id} overflows its ${input.frame.height}px box by ${Math.ceil(fit.overflow)}px even at ${fit.fontSize}pt; split the page or cut the copy`);
  const textLayout = fit.layout;
  const style = { ...input.style, lineHeight: textLayout.lineHeight, wrap: false, ...(fit.stepped ? { fontSize: { tokenId: input.style.fontSize.tokenId ?? "type.body", kind: "fontSizePt", value: fit.fontSize } } : {}) };
  return textPrimitive({ ...input, text: textLayout.text, ...(textLayout.runs?{runs:textLayout.runs}:{}), style, data: { ...input.data, textLayout, ...(fit.stepped ? { fitStep: fit.fontSize } : {}) } });
}

function insightLayout(frame, props) {
  if (typeof props.text !== "string" || !props.text.trim()) throw new Error("Insight requires a nonempty synthesis sentence");
  if (props.align !== undefined && !["left", "center"].includes(props.align)) throw new Error("Insight alignment must be left or center");
  // A takeaway band: 16 px side padding, 12 px above and below one or two lines
  // of semibold body text, left-aligned (the gallery's grey band). The primary
  // variant carries a chevron disc at the left and reserves its width.
  const paddingX = tokenValue(token("space.4")), paddingY = tokenValue(token(props.text.includes("\n\n") ? "space.5" : "space.3"));
  const marker = (props.variant ?? "tonal") === "primary" || props.marker === "chevron" ? tokenValue(token("icon.medium")) : 0;
  const markerGap = marker ? tokenValue(token("space.3")) : 0;
  const width = frame.width - 2 * paddingX - marker - markerGap;
  if (width <= 0) throw new Error("Insight width cannot contain its theme padding");
  const options = { fontFamily: tokenValue(FONT), wrapWidthRatio: 1 };
  const body = measureText(props.text, width, { ...options, fontSize: tokenValue(BODY), bold: true });
  const heading = props.heading ? measureText(props.heading, width, { ...options, fontSize: tokenValue(token("type.heading")), bold: true }) : null;
  const gap = heading ? tokenValue(token("space.2")) : 0;
  const contentHeight = body.height + (heading?.height ?? 0) + gap;
  return { body, heading, width, paddingX, paddingY, gap, marker, markerGap, contentHeight, height: Math.max(contentHeight, marker) + 2 * paddingY };
}

// A reading note: the cream box a consulting page carries top-right to say how
// to read it, or to flag a caveat. Compact type, hairline caution border.
function calloutLayout(frame, props) {
  if (typeof props.text !== "string" || !props.text.trim()) throw new Error("Callout requires text");
  // `outline`: the insight box of the modern survey deck, an accent outline
  // with semibold accent copy at body size; otherwise a quiet cream note.
  const outline = props.tone === "outline";
  const paddingX = tokenValue(token(outline ? "space.4" : "space.3")), paddingY = tokenValue(token(outline ? "space.4" : "space.2"));
  const width = frame.width - 2 * paddingX;
  if (width <= 0) throw new Error("Callout has no text width");
  const options = { fontFamily: tokenValue(FONT), fontSize: tokenValue(outline ? BODY : COMPACT), wrapWidthRatio: 1 };
  const lead = props.lead?.trim() ? measureText(props.lead, width, { ...options, bold: true }) : null;
  const body = measureText(props.text, width, { ...options, bold: outline });
  const gap = lead ? tokenValue(token("space.2")) / 2 : 0;
  return { lead, body, paddingX, paddingY, gap, outline, height: (lead?.height ?? 0) + gap + body.height + 2 * paddingY };
}

function calloutNodes({ id, frame, props }) {
  const layout = calloutLayout(frame, props);
  if (layout.height > frame.height + 0.01) throw new Error(`Callout overflows its ${frame.height}px box; shorten the note`);
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
  if (layout.height > frame.height) throw new Error(`Insight overflows its ${frame.height}px box by ${Math.ceil(layout.height - frame.height)}px; give it the space or shorten the sentence`);
  const fill = variant === "primary" ? PRIMARY : variant === "neutral" ? MUTED_SURFACE : variant === "dotted" ? "none" : PRIMARY_TINT;
  const foreground = variant === "primary" ? WHITE : INK;
  const nodes = [rectPrimitive({ id: stableId(id, "surface"), role: "insight-surface", frame, style: boxStyle(fill, "none", HAIRLINE, SMALL_RADIUS) })];
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
  if (layout.marker) {
    // Chevron disc: reversed on the primary band, primary on a tinted band.
    const size = layout.marker, mx = frame.x + layout.paddingX, my = frame.y + (frame.height - size) / 2;
    const discFill = variant === "primary" ? WHITE : PRIMARY, chevron = variant === "primary" ? PRIMARY : WHITE;
    nodes.push(ellipsePrimitive({ id: stableId(id, "marker"), role: "insight-marker", frame: { x: mx, y: my, width: size, height: size }, style: boxStyle(discFill, discFill, HAIRLINE, token("radius.round")) }));
    nodes.push(shapePrimitive({ id: stableId(id, "marker-chevron"), role: "insight-marker-glyph", geometry: "iconPath", frame: { x: mx + size * 0.3, y: my + size * 0.28, width: size * 0.4, height: size * 0.44 }, style: { fill: "none", stroke: chevron, lineWidth: token("line.standard"), lineCap: "round" }, data: { paths: [{ points: [[0.2, 0], [0.8, 0.5], [0.2, 1]], closed: false }] } }));
  }
  for (const [part, measured] of [["heading", layout.heading], ["body", layout.body]]) {
    if (!measured) continue;
    nodes.push(textPrimitive({ id: stableId(id, part), role: `insight-${part}`, frame: { x: textX, y, width: layout.width, height: measured.height }, text: measured.text,
      style: { ...textStyle(part === "heading" ? token("type.heading") : BODY, part === "heading" && variant !== "primary" ? PRIMARY : foreground, true, props.align ?? "left", "top"), lineHeight: measured.lineHeight, wrap: false }, data: { textLayout: measured } }));
    y += measured.height + layout.gap;
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
  const measureTitle = (fontSize) => lead
    ? measureTextRuns([{ text: lead, bold: titleBold, accent: true }, { text: props.text.slice(lead.length), bold: titleBold }], baseTextFrame.width, { fontFamily: tokenValue(DISPLAY), fontSize, wrapWidthRatio: 0.98 })
    : measureText(props.text, baseTextFrame.width, { fontFamily: tokenValue(DISPLAY), fontSize, bold: titleBold, wrapWidthRatio: 0.98 });
  let fontSize = tokenValue(size), textLayout = measureTitle(fontSize);
  if (chrome && !section && textLayout.lines.length > 2) {
    const long = tokenValue(token("type.actionTitleLong"));
    const retry = measureTitle(long);
    if (retry.lines.length < textLayout.lines.length) { fontSize = long; textLayout = retry; }
  }
  const textFrame = chrome ? { ...baseTextFrame, height: Math.max(baseTextFrame.height, textLayout.height) } : baseTextFrame;
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
  const ruleGap = tokenValue(token("space.1"));
  const contentGap = tokenValue(token("space.4"));
  return { heading, headingWidth, bandHeight, ruleGap, height: bandHeight + (props.rule === false ? 0 : ruleGap) + contentGap };
}

function sectionHeadingNodes({ id, frame, props = {} }) {
  const variant = props.variant || "standard";
  const color = variant === "inverse" ? WHITE : variant === "accent" ? PRIMARY : INK;
  const showRule = props.rule !== false;
  const layout = headingLayout(frame, props);
  const { heading, headingWidth, bandHeight, ruleGap } = layout;
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
  const value = tokenValue(token("space.4"));
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
    const year = "(?:19|20)\\d{2}";
    const fiscalYear = `(?:${year}|\\d{2})`;
    const period = `(?:FY\\s*${fiscalYear}(?:\\s*[-–/]\\s*(?:FY\\s*)?${fiscalYear})?|[QH][1-4](?:\\s+${year})?|${year}\\s*[-–/]\\s*(?:${year}|\\d{2}))`;
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
    const numberWords = "(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)";
    // A number word is a result only when it quantifies a change or share ("twenty percent", "one point"),
    // not when it counts things the chart shows ("three monthly budgets").
    if (/\p{N}/u.test(copy) || /\b(?:doubled|tripled|halved)\b/i.test(copy) || new RegExp(`\\b${numberWords}\\s+(?:percent|per\\s*cent|points?|pts|x|times|fold|percentage)`, "i").test(copy)) {
      throw new Error(`Chart title ${field} must not contain statistics or chart results: ${JSON.stringify(value)}. Use a descriptive measure/population heading and explicit period; move values and changes to chart labels or annotations.`);
    }
  }
}
// A chart heading is two lines: the measure in semibold, then the unit and
// period in grey compact type ("$B, annual run rate"). Both sit inside the
// heading band, so a peer panel's rule lines up with this one (row rule).
function chartTitleLayout(frame, props) {
  const variant = resolveChartTitleVariant(props);
  // The house style `band` sets the heading in white on a filled grey band with
  // side padding; the unit line then sits under the band.
  const band = houseStyle("style.chartHeading") === "band";
  const padX = band ? tokenValue(token("space.3")) : 0, padY = band ? tokenValue(token("space.2")) : 0;
  const heading = measureText(props.heading || props.text || "", frame.width - 2 * padX, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")), bold: !band });
  const unit = props.unit ? measureText(props.unit, frame.width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(COMPACT), wrapWidthRatio: 1 }) : null;
  if (unit && unit.lines.length !== 1) throw new Error("Chart unit must fit on one line");
  const unitGap = unit ? (band ? tokenValue(token("space.2")) : tokenValue(token("space.1")) / 2) : 0;
  const block = heading.height + 2 * padY + (unit ? unitGap + unit.height : 0);
  const bandHeight = Math.max(block, props.headerBandHeight || 0);
  const ruled = variant === "underlined" && !band;
  const ruleGap = tokenValue(token("space.1")), contentGap = tokenValue(token("space.3"));
  const height = bandHeight + (ruled ? ruleGap : 0) + contentGap;
  return { heading, unit, unitGap, unitPlacement: unit ? "stacked" : "none", block, bandHeight, ruleGap, contentHeight: bandHeight, ruled, variant, height, band, padX, padY };
}
function chartTitleNodes({ id, frame, props }) {
  const layout = chartTitleLayout(frame, props);
  if (layout.height > frame.height) throw new Error(`Chart title ${id} exceeds its allocated height`);
  const blockTop = frame.y + layout.padY;
  const nodes = [];
  if (layout.band) nodes.push(rectPrimitive({ id: stableId(id, "band"), role: "chart-heading-band", frame: { x: frame.x, y: frame.y, width: frame.width, height: layout.heading.height + 2 * layout.padY }, style: boxStyle(SECONDARY, "none", HAIRLINE, token("radius.none")) }));
  nodes.push(textPrimitive({
    id: stableId(id, "heading"),
    role: "section-heading",
    frame: { x: frame.x + layout.padX, y: blockTop, width: frame.width - 2 * layout.padX, height: layout.heading.height },
    text: layout.heading.text,
    style: { ...textStyle(token("type.heading"), layout.band ? WHITE : INK, !layout.band, "left", "top"), lineHeight: layout.heading.lineHeight, wrap: false },
    data: { textLayout: layout.heading, headerTop: frame.y, headerBandHeight: layout.bandHeight, ruleGap: layout.ruleGap, chartTitleVariant: layout.variant, chartUnitPlacement: layout.unitPlacement }
  }));
  if (layout.unit) nodes.push(textPrimitive({
    id: stableId(id, "unit"),
    role: "chart-unit",
    frame: { x: frame.x, y: blockTop + layout.heading.height + layout.padY + layout.unitGap, width: frame.width, height: layout.unit.height },
    text: props.unit,
    style: { ...textStyle(COMPACT, token("color.chartUnit"), false, "left", "top"), lineHeight: layout.unit.lineHeight, wrap: false },
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
    return { lead, text, icon: o.icon ?? null, state: o.state ?? null, number: o.number ?? index + 1 };
  });
}

export function resolveListMarker(props) {
  const items = normalizeListItems(props.items);
  const marker = props.marker ?? "auto";
  // The plain marker follows the house style: a square dot, or a short dash.
  if (marker === "auto") return items.some((i) => i.icon) ? "icon" : items.some((i) => i.state !== null) ? "check" : items.some((i) => i.lead) ? "number" : houseStyle("style.listMarker") === "dash" ? "dash" : "dot";
  if (!["dot", "dash", "number", "icon", "check"].includes(marker)) throw new Error(`Unknown list marker: ${marker}`);
  return marker;
}

function bodyListLayout(frame, itemsIn, props = {}) {
  const items = normalizeListItems(itemsIn);
  const marker = resolveListMarker({ ...props, items: itemsIn });
  const disc = markerSize();
  const iconSize = Math.round(disc * 1.5);
  const plain = marker === "dot" || marker === "dash";
  const markerWidth = plain ? 0 : marker === "icon" ? iconSize : disc;
  const offset = plain ? tokenValue(token("space.4")) : markerWidth + tokenValue(token("space.3"));
  const gap = tokenValue(token(plain ? "space.2" : "space.3"));
  const leadGap = tokenValue(token("space.1"));
  const markerSquare = tokenValue(token("space.1"));
  if (frame.width <= offset) throw new Error("Body bullet list has no text width");
  const width = frame.width - offset;
  const font = { fontFamily: tokenValue(FONT), fontSize: tokenValue(BODY), wrapWidthRatio: 1 };
  const measured = items.map((item) => {
    const lead = item.lead ? measureText(item.lead, width, { ...font, bold: true }) : null;
    const text = item.text ? measureText(item.text, width, font) : null;
    const textHeight = (lead?.height ?? 0) + (lead && text ? leadGap : 0) + (text?.height ?? 0);
    return { item, lead, text, textHeight, height: Math.max(textHeight, markerWidth) };
  });
  return { marker, offset, gap, leadGap, markerSize: plain ? markerSquare : markerWidth, measured, height: measured.reduce((sum, m) => sum + m.height, 0) + gap * (items.length - 1) };
}

function bodyListNodes({ id, frame, props }) {
  const layout = bodyListLayout(frame, props.items, props);
  if (layout.height > frame.height + 0.01) throw new Error(`${id} body bullets exceed the allocated height; allocate space or edit copy, never shrink type`);
  // On a dark or primary panel the list reads in white: white text, white markers,
  // reversed number discs.
  const inverse = props.tone === "inverse";
  if (props.tone !== undefined && !["standard", "inverse"].includes(props.tone)) throw new Error(`Unknown bullet-list tone: ${props.tone}`);
  const INK_ = inverse ? WHITE : INK;
  let y = frame.y;
  const nodes = [];
  layout.measured.forEach((m, index) => {
    const first = m.lead ?? m.text;
    const lineCentre = y + first.lineHeight / 2;
    const mid = y + m.height / 2;
    if (layout.marker === "dot") {
      nodes.push(rectPrimitive({ id: stableId(id, "marker", index), role: "list-marker", frame: { x: frame.x, y: lineCentre - layout.markerSize / 2, width: layout.markerSize, height: layout.markerSize }, style: boxStyle(INK_, INK_, HAIRLINE, token("radius.none")) }));
    } else if (layout.marker === "dash") {
      nodes.push(rectPrimitive({ id: stableId(id, "marker", index), role: "list-marker", frame: { x: frame.x, y: lineCentre - 0.5, width: tokenValue(token("space.2")), height: 1 }, style: boxStyle(INK_, INK_, HAIRLINE, token("radius.none")) }));
    } else if (layout.marker === "number") {
      nodes.push(...numberMarker({ id: stableId(id, "marker", index), role: "list-marker", x: frame.x, y: Math.max(y, lineCentre - layout.markerSize / 2), size: layout.markerSize, number: m.item.number, reverse: inverse }));
    } else if (layout.marker === "check") {
      nodes.push(...stateMarker({ id: stableId(id, "marker", index), role: "list-marker", x: frame.x, y: Math.max(y, lineCentre - layout.markerSize / 2), size: layout.markerSize, state: m.item.state ?? "yes" }));
    } else {
      // Icons centre on the item block, as on a feature row.
      nodes.push(...iconMarker({ id: stableId(id, "marker", index), role: "list-icon", x: frame.x, y: mid - layout.markerSize / 2, size: layout.markerSize, icon: m.item.icon || "info", tone: inverse ? "inverse" : "outline" }));
    }
    let ty = layout.marker === "icon" && m.textHeight < m.height ? y + (m.height - m.textHeight) / 2 : y;
    if (m.lead) {
      nodes.push(textPrimitive({ id: stableId(id, "lead", index), role: "list-lead", frame: { x: frame.x + layout.offset, y: ty, width: frame.width - layout.offset, height: m.lead.height }, text: m.lead.text, style: { ...textStyle(BODY, INK_, true, "left", "top"), lineHeight: m.lead.lineHeight }, data: { textLayout: m.lead } }));
      ty += m.lead.height + (m.text ? layout.leadGap : 0);
    }
    if (m.text) nodes.push(textPrimitive({ id: stableId(id, "item", index), role: "list-item", frame: { x: frame.x + layout.offset, y: ty, width: frame.width - layout.offset, height: m.text.height }, text: m.text.text, style: { ...textStyle(BODY, INK_, false, "left", "top"), lineHeight: m.text.lineHeight }, data: { textLayout: m.text } }));
    y += m.height + layout.gap;
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
    if (roadmap) nodes.push(rectPrimitive({ id: stableId(id, "phase-band", index), role: "roadmap-phase", frame: { x: frame.x + span * index + 10, y: bandTop, width: span - 20, height: bandHeight }, style: boxStyle(index % 2 ? MUTED_SURFACE : PRIMARY_TINT, RULE, HAIRLINE, SMALL_RADIUS) }));
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
      const route = routeConnector({ x: fromX, y: fromY }, { x: toX, y: toY }, [...nodeFrames.values()]);
      route.slice(1).forEach((point, segment) => nodes.push(openLine(stableId(id, "connector", index, segment), route[segment].x, route[segment].y, point.x, point.y, "tree-connector", SECONDARY, HAIRLINE, { from: connector.from, to: connector.to })));
    }
    for (const [index, node] of props.nodes.entries()) {
      const nodeFrame = nodeFrames.get(node.id);
      const tone = node.tone || "muted";
      const fill = tone === "primary" ? PRIMARY : tone === "dark" ? INK : MUTED_SURFACE;
      const textColor = tone === "primary" || tone === "dark" ? WHITE : INK;
      nodes.push(rectPrimitive({ id: stableId(id, "node", node.id || index), role: "organization-node", frame: nodeFrame, style: boxStyle(fill, fill, HAIRLINE, token("radius.none")) }));
      nodes.push(textPrimitive({ id: stableId(id, "node-text", node.id || index), role: "node-label", frame: insetFrame(nodeFrame, 5), text: node.label, style: textStyle(COMPACT, textColor, false, "center") }));
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
  if (frame.width < width || frame.height < height) throw new Error("Chevron needs room for its canonical optical size");
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
      tokens: ["color.canvas", "color.ink", "color.componentPrimary", "color.accent", "color.onPrimary", "color.surfaceMuted", "font.display", "font.body", "type.source", "type.actionTitle", "type.actionTitleLong", "layout.titleContentGap", "space.2", "space.4", "radius.small", "radius.none", ...STYLE_TOKENS, ...PAGE_TEMPLATE_TOKENS, ...TRACKER_TOKENS],
      preferredSize: { width: SLIDE.width, height: SLIDE.height },
      sample: { title: "(Insert action title)", source: "Source: (Insert source)", footerRight: "(Insert company name)", pageNumber: 7 },
      render: ({ id, frame, props }) => {
        const page = renderPageTemplate({ id, frame, props });
        const tracker = props.tracker ? trackerLabelNodes({ id: stableId(id, "tracker"), frame: { x: frame.x + CHROME.left, y: frame.y + 30, width: page.titleWidth, height: 20 }, props: props.tracker }) : [];
        const tagPlacement = props.tag ? houseStyle("style.tagPlacement") : "top-right";
        // An above-title tag (a small accent label, as in a country or section spotlight) sits in the title's top margin.
        const titles = titleNodes({ id, frame, props: { text: props.title, lead: props.titleLead, variant: props.titleVariant, rule: props.titleRule, availableTitleWidth: page.titleWidth, titleTop: props.tracker ? 58 : CHROME.titleTop }, chrome: true });
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
        // A tinted title band (the house style `band`) runs from the page top to just under the title.
        if (houseStyle("style.titleRule") === "band" && props.titleVariant === undefined) {
          titles.unshift(rectPrimitive({ id: stableId(id, "title-band"), role: "title-band", frame: { x: frame.x, y: frame.y, width: frame.width, height: titleBottom + tokenValue(token("space.4")) }, style: boxStyle(MUTED_SURFACE, "none", HAIRLINE, token("radius.none")) }));
        }
        const baseBottom = page.contentFrame.y + page.contentFrame.height;
        // One content top for the whole deck: the body starts at CHROME.bodyTop whether
        // the title takes one line or two. Only a three-line title pushes it down.
        const gap = tokenValue(token("space.5"));
        const contentTop = Math.max(CHROME.bodyTop, titleBottom + gap, page.logoFrame ? page.logoFrame.y + page.logoFrame.height + gap : 0);
        const contentFrame = { ...page.contentFrame, y: contentTop, height: baseBottom - contentTop };
        if (contentFrame.height <= 0) throw new Error("Action title leaves no room for slide content; shorten the title or split the slide");
        return { ...page, contentFrame, nodes: [...tracker, ...titles, ...page.nodes] };
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
        if (!["open", "muted", "primary", "dark", "tint"].includes(treatment)) throw new Error(`Unknown section treatment: ${treatment}`);
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
    component({ id: "cover", category: "navigation", role: "cover", tokens: ["color.ink", "color.canvas", "color.onPrimary", "color.textSecondary", "color.componentPrimary", "color.chartSeries4", "color.accentTint", "font.display", "font.body", "type.deckTitle", "type.heading", "type.body", "type.compact", "space.2", "space.5", "line.hairline", "line.standard", "radius.none"], preferredSize: { width: 1280, height: 720 }, sample: { title: "(Insert presentation title)", subtitle: "(Insert subtitle)" }, render: ({ id, frame, props }) => {
      if (typeof props.title !== "string" || !props.title.trim()) throw new Error("Cover requires a deck title");
      if (props.subtitle !== undefined && typeof props.subtitle !== "string") throw new Error("Cover subtitle must be text");
      // The compiler supplies headerBandHeight to every component as layout metadata.
      if (Object.keys(props).some(key => !["title", "subtitle", "date", "logo", "tone", "headerBandHeight"].includes(key))) throw new Error("Cover supports title, subtitle, date, logo and tone; use the page template for other furniture");
      // Dark tone is the gallery default: navy full bleed, title block in the
      // lower third, a logo slot top-left, a date line under the subtitle.
      const dark = (props.tone ?? "dark") === "dark";
      // On navy the subtitle takes the accent tint when it reads (BCG's fourth
      // series is dark green), white otherwise.
      const tint = token("color.accentTint");
      const ink = dark ? WHITE : INK, secondary = dark ? (contrastRatio(tokenValue(INK), tokenValue(tint)) >= 4.5 ? tint : WHITE) : SECONDARY;
      const width = Math.min(frame.width - CHROME.left - CHROME.right, frame.width * 0.72);
      const title = measureText(props.title, width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.deckTitle")), bold: true, wrapWidthRatio: 1 });
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
      nodes.push(textPrimitive({ id: stableId(id, "title"), role: "cover-title", frame: { x, y, width, height: title.height }, text: title.text, style: { ...textStyle(token("type.deckTitle"), ink, true, "left", "top"), fontFamily: DISPLAY, lineHeight: title.lineHeight, wrap: false }, data: { textLayout: title } }));
      y += title.height;
      if (subtitle) { y += gap; nodes.push(textPrimitive({ id: stableId(id, "subtitle"), role: "cover-subtitle", frame: { x, y, width, height: subtitle.height }, text: subtitle.text, style: { ...textStyle(token("type.heading"), secondary, false, "left", "top"), lineHeight: subtitle.lineHeight, wrap: false }, data: { textLayout: subtitle } })); y += subtitle.height; }
      if (date) { y += gap; nodes.push(textPrimitive({ id: stableId(id, "date"), role: "cover-date", frame: { x, y, width, height: date.height }, text: date.text, style: { ...textStyle(BODY, secondary, false, "left", "top"), lineHeight: date.lineHeight, wrap: false }, data: { textLayout: date } })); }
      return { nodes };
    } }),
    component({ id: "section-divider", category: "navigation", role: "divider", tokens: ["color.canvas", "color.ink", "color.componentPrimary", "color.onPrimary", "color.accent", "font.display", "font.body", "type.deckTitle", "type.heading", "type.sectionNumber", "line.hairline", "radius.none", "space.3", "space.4", ...PAGE_TEMPLATE_TOKENS], preferredSize: { ...SLIDE }, sample: { title: "(Insert section title)" }, render: ({ id, frame, props }) => {
      if (typeof props.title !== "string" || !props.title.trim()) throw new Error("Section divider requires a section title");
      for (const key of Object.keys(props)) if (!["title", "subtitle", "sectionId", "style", "mode", "pageTemplate", "source", "note", "companyName", "pageNumber", "footerLeft", "footerRight", "headerBandHeight", "panelWidth"].includes(key)) throw new Error(`Unknown section-divider setting: ${key}; dividers have one title, an optional subtitle and section id, and page furniture`);
      const inverse = (props.mode ?? "dark") === "dark";
      const dividerStyle = props.style ?? "plain";
      if (!["plain", "numbered"].includes(dividerStyle)) throw new Error(`Unknown section-divider style: ${dividerStyle}`);
      if (dividerStyle === "numbered" && !String(props.sectionId ?? "").trim()) throw new Error("Numbered section divider requires sectionId");
      const page = renderPageTemplate({ id: stableId(id, "page"), frame, props: { ...props, inverse } });
      // With a photograph beside it (media.mjs) the divider keeps a left panel of
      // `panelWidth`; the numeral then sits above the title instead of at the right.
      const panelWidth = props.panelWidth ?? null;
      const surfaceFrame = panelWidth ? { ...frame, width: panelWidth } : frame;
      const width = panelWidth ? panelWidth - CHROME.left - 24 : dividerStyle === "numbered" ? frame.width * 0.58 - CHROME.left : frame.width - CHROME.left - CHROME.right;
      const title = measureText(props.title, width, { fontFamily: tokenValue(DISPLAY), fontSize: tokenValue(token("type.deckTitle")), bold: true, wrapWidthRatio: 1 });
      if (title.lines.length > (panelWidth ? 3 : 2) || title.height > frame.height - 2 * CHROME.bodyTop) throw new Error("Section divider title exceeds its allocated space");
      const background = inverse ? INK : token("color.canvas"), foreground = inverse ? WHITE : INK;
      if (contrastRatio(tokenValue(background), tokenValue(foreground)) < 4.5) throw new Error("Section divider title contrast must be at least 4.5:1");
      // A short accent rule above the title and the section's one-line summary
      // below it, in the same block, so the divider says what the section shows.
      if (props.subtitle !== undefined && typeof props.subtitle !== "string") throw new Error("Section divider subtitle must be text");
      const subtitle = typeof props.subtitle === "string" && props.subtitle.trim() ? measureText(props.subtitle.trim(), width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")), wrapWidthRatio: 1 }) : null;
      const ruleGap = tokenValue(token("space.4")), subGap = tokenValue(token("space.3"));
      // The title holds the page's centre line; the accent bar sits above it and the summary below.
      const titleTop = frame.y + (frame.height - title.height) / 2;
      return { ...page, nodes: [
        rectPrimitive({ id: stableId(id, "surface"), role: "divider-surface", frame: surfaceFrame, style: boxStyle(background, background, HAIRLINE, token("radius.none")) }),
        rectPrimitive({ id: stableId(id, "accent-bar"), role: "divider-accent", frame: { x: frame.x + CHROME.left, y: titleTop - ruleGap - 4, width: 64, height: 4 }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.none")) }),
        textPrimitive({ id: stableId(id, "title"), role: "divider-title", frame: { x: frame.x + CHROME.left, y: titleTop, width, height: title.height }, text: title.text, style: { ...textStyle(token("type.deckTitle"), foreground, true, "left", "top"), fontFamily: DISPLAY, lineHeight: title.lineHeight, wrap: false }, data: { textLayout: title } }),
        ...(subtitle ? [textPrimitive({ id: stableId(id, "subtitle"), role: "divider-subtitle", frame: { x: frame.x + CHROME.left, y: titleTop + title.height + subGap, width, height: subtitle.height }, text: subtitle.text, style: { ...textStyle(token("type.heading"), foreground, false, "left", "top"), lineHeight: subtitle.lineHeight, wrap: false }, data: { textLayout: subtitle } })] : []),
        ...(dividerStyle === "numbered" && panelWidth ? [textPrimitive({ id: stableId(id, "number"), role: "divider-number", frame: { x: frame.x + CHROME.left, y: frame.y + 48, width, height: Math.max(80, titleTop - ruleGap - 24 - (frame.y + 48)) }, text: String(props.sectionId), style: { ...textStyle(token("type.sectionNumber"), inverse ? WHITE : PRIMARY, true, "left", "bottom"), fontFamily: DISPLAY }, data: { sectionId: String(props.sectionId), dividerStyle } })] : []),
        ...(dividerStyle === "numbered" && !panelWidth ? [textPrimitive({ id: stableId(id, "number"), role: "divider-number", frame: { x: frame.x + frame.width * 0.67, y: frame.y + 110, width: frame.width * 0.25, height: frame.height - 220 }, text: String(props.sectionId), style: { ...textStyle(token("type.sectionNumber"), inverse ? WHITE : PRIMARY, true, "center", "mid"), fontFamily: DISPLAY }, data: { sectionId: String(props.sectionId), dividerStyle } })] : []),
        ...page.nodes
      ] };
    } }),
    // The closing page of the 2022 McKinsey decks: navy, "Key takeaways", the
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
      const rowHeight = (listBottom - listTop) / items.length;
      if (items.some((item) => item.height + 8 > rowHeight)) throw new Error("Takeaways exceed the page; shorten them or use fewer");
      const nodes = [
        rectPrimitive({ id: stableId(id, "surface"), role: "takeaways-surface", frame: { ...frame, width: panelWidth }, style: boxStyle(background, background, HAIRLINE, token("radius.none")) }),
        textPrimitive({ id: stableId(id, "title"), role: "takeaways-title", frame: { x, y: titleTop, width, height: title.height }, text: title.text, style: { ...textStyle(token("type.sectionTitle"), foreground, true, "left", "top"), fontFamily: DISPLAY, lineHeight: title.lineHeight, wrap: false }, data: { textLayout: title } }),
        openLine(stableId(id, "rule"), x, titleTop + title.height + gap / 2, x + width, titleTop + title.height + gap / 2, "takeaways-rule", inverse ? WHITE : RULE, HAIRLINE),
      ];
      items.forEach((item, index) => {
        const y = listTop + index * rowHeight + (rowHeight - item.height) / 2;
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
    component({ id: "source", category: "shared", role: "source", tokens: ["font.body", "type.source", "color.textSecondary", "color.rule", "line.hairline"], preferredSize: { width: 920, height: 26 }, sample: { text: "Source: (Insert source)" }, render: ({ id, frame, props }) => {
      const variant = resolveTitleVariant(props);
      return { nodes: [...(variant === "with-line" ? [openLine(stableId(id, "rule"), frame.x, frame.y, frame.x + frame.width, frame.y, "source-rule", RULE, HAIRLINE)] : []), textPrimitive({ id: stableId(id, "text"), role: "source-text", frame: { x: frame.x, y: frame.y + 4, width: frame.width, height: frame.height - 4 }, text: props.text, style: textStyle(SOURCE, SECONDARY, false, "left") })] };
    } }),
    component({ id: "footnote", category: "shared", role: "footnote", tokens: ["font.body", "type.source", "color.textSecondary"], preferredSize: { width: 600, height: 34 }, sample: { text: "Note: (Insert note)" }, render: ({ id, frame, props }) => ({ nodes: [textPrimitive({ id: stableId(id, "text"), role: "footnote-text", frame, text: props.text, style: textStyle(SOURCE, SECONDARY, false, "left", "top") })] }) }),
    component({ id: "page-number", category: "shared", role: "page-number", tokens: ["font.body", "type.source", "color.textSecondary"], preferredSize: { width: 48, height: 24 }, sample: { value: 7 }, render: ({ id, frame, props }) => ({ nodes: [textPrimitive({ id: stableId(id, "text"), role: "page-number", frame, text: String(props.value), style: textStyle(SOURCE, SECONDARY, false, "right") })] }) }),
    component({ id: "paragraph", category: "text", tokens: ["font.body", "type.body", "color.ink"], preferredSize: { width: 520, height: 180 }, sample: { text: "(Insert supporting statement)" }, render: ({ id, frame, props }) => {
      if (typeof props.text !== "string" || !props.text.trim()) throw new Error(`paragraph ${id} requires a non-empty text string; keep geometry in the component frame`);
      const width = paragraphMeasure(frame.width, props);
      return { nodes: [measuredTextNode({ id: stableId(id, "text"), role: "paragraph", frame: { ...frame, width }, text: props.text, ...(props.runs?{runs:props.runs}:{}), style: textStyle(BODY, INK, false, props.align || "left", "top") })] };
    } }),
    component({ id: "bullet-list", category: "text", tokens: ["font.body", "type.compact", "type.label", "color.ink", "color.componentPrimary", "color.onPrimary", "space.1", "space.3", "line.hairline", "radius.none", "radius.round"], preferredSize: { width: 540, height: 240 }, sample: { items: ["(Insert supporting point 1)", "(Insert supporting point 2)", "(Insert supporting point 3)"] }, render: ({ id, frame, props }) => ({ nodes: simpleList({ id, frame, items: props.items, numbered: false, marker: "circle" }) }) }),
    component({ id: "insight", category: "section", role: "insight", tokens: ["color.componentPrimaryTint", "color.componentPrimary", "color.surfaceMuted", "color.rule", "color.onPrimary", "color.ink", "font.body", "type.heading", "type.body", "space.2", "space.3", "space.4", "space.5", "space.6", "line.hairline", "line.standard", "radius.small", "radius.round", "icon.medium"], preferredSize: { width: 1160, height: 100 }, sample: { text: "(Insert decision-relevant synthesis)" }, render: input => ({ nodes: insightNodes(input) }) }),
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
      tokens: ["color.surface", "color.rule", "color.componentPrimary", "color.ink", "font.body", "font.bodySemibold", "weight.semibold", "type.chartAnnotation", "line.hairline", "line.standard", "radius.none"],
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
      const nodes = [];
      items.forEach((item, index) => {
        const x = frame.x + index * span;
        nodes.push(textPrimitive({ id: stableId(id, "heading", index), role: "process-heading", frame: { x: x + 8, y: frame.y, width: span - 16, height: 34 }, text: item.heading || `Phase ${index + 1}`, style: textStyle(token("type.heading"), INK, true, "left") }));
        nodes.push(shapePrimitive({ id: stableId(id, "band", index), role: "process-band", geometry: "chevron", frame: { x, y: frame.y + 42, width: span + (index < items.length - 1 ? tokenValue(token("space.4")) : 0), height: 70 }, style: boxStyle(index === 0 && props.emphasizeFirst ? PRIMARY : INK, SURFACE, HAIRLINE, token("radius.none")) }));
        const label = measureText(item.label, span - 72, { fontSize: tokenValue(token("type.heading")), bold: true });
        if (label.height > 64) throw new Error("Process label exceeds its band; enlarge the component or shorten the copy");
        nodes.push(textPrimitive({ id: stableId(id, "label", index), role: "process-label", frame: { x: x + 36, y: frame.y + 77 - label.height / 2, width: span - 72, height: label.height }, text: label.text, style: { ...textStyle(token("type.heading"), WHITE, true, "center", "top"), lineHeight: label.lineHeight, wrap: false }, data: { textLayout: label } }));
        const details = item.details || [];
        nodes.push(...simpleList({ id: stableId(id, "details", index), frame: { x: x + 10, y: frame.y + 132, width: span - 26, height: frame.height - 136 }, items: details, numbered: props.detailStyle === "circled-number", marker: "circle", rolePrefix: "process-detail" }));
      });
      return { nodes };
    } }),
    component({ id: "initiative-rollout", category: "relationship", role: "initiative-rollout", tokens: ["color.ink", "color.componentPrimary", "color.chartSeries2", "color.surfaceMuted", "color.surface", "color.onPrimary", "font.body", "type.heading", "type.compact", "type.label", "line.hairline", "line.standard", "radius.none", "radius.round"], preferredSize: { width: 1160, height: 450 }, sample: { years: ["Year 1", "Year 2", "Year 3"], rows: [{ label: "A", phases: ["(Insert phase 1)", "(Insert phase 2)", "(Insert phase 3)"] }, { label: "B", phases: ["(Insert phase 1)", "(Insert phase 2)", "(Insert phase 3)"] }] }, render: ({ id, frame, props }) => ({ nodes: initiativeRolloutNodes({ id, frame, props }) }) }),
    component({ id: "highlight-strip", category: "relationship", role: "highlight-strip", tokens: ["color.componentPrimary", "color.ink", "color.onPrimary", "font.body", "type.heading", "type.compact", "line.hairline", "radius.round"], preferredSize: { width: 1160, height: 126 }, sample: { items: [{ number: "1", heading: "(Insert highlight)", description: "(Insert description)" }, { number: "2", heading: "(Insert highlight)", description: "(Insert description)" }, { number: "3", heading: "(Insert highlight)", description: "(Insert description)" }] }, render: ({ id, frame, props }) => ({ nodes: highlightStripNodes({ id, frame, props }) }) }),
    component({ id: "roadmap", category: "relationship", role: "roadmap", tokens: ["color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.heading", "type.compact", "type.label", "line.standard", "line.hairline", "radius.round", "radius.small"], preferredSize: { width: 980, height: 360 }, sample: { items: ["(Insert stage 1)", "(Insert stage 2)", "(Insert stage 3)", "(Insert stage 4)"], active: 1 }, render: ({ id, frame, props }) => ({ nodes: props.variant === "wave-columns" ? waveRoadmapNodes({ id, frame, props }) : processNodes({ id, frame, props: { ...props, items: props.items.map((label) => typeof label === "string" ? { label } : label) }, roadmap: true }) }) }),
    component({ id: "timeline", category: "relationship", role: "timeline", tokens: ["color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "font.body", "type.compact", "type.label", "line.standard", "line.hairline", "radius.round"], preferredSize: { width: 920, height: 250 }, sample: { items: ["Q1", "Q2", "Q3", "Q4"], active: 2 }, render: ({ id, frame, props }) => ({ nodes: processNodes({ id, frame, props: { ...props, items: props.items.map((label) => ({ label })) } }) }) }),
    component({ id: "journey", category: "relationship", role: "journey", tokens: ["color.componentPrimary", "color.surface", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.compact", "type.label", "line.standard", "line.hairline", "radius.round"], preferredSize: { width: 960, height: 300 }, sample: { items: [{ label: "(Insert stage 1)", touchpoint: "(Insert touchpoint 1)" }, { label: "(Insert stage 2)", touchpoint: "(Insert touchpoint 2)" }, { label: "(Insert stage 3)", touchpoint: "(Insert touchpoint 3)" }, { label: "(Insert stage 4)", touchpoint: "(Insert touchpoint 4)" }], active: 3 }, render: ({ id, frame, props }) => ({ nodes: processNodes({ id, frame, props, journey: true }) }) }),
    component({ id: "tree", category: "relationship", role: "tree", tokens: ["color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.rule", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.compact", "line.hairline", "line.standard", "radius.small"], preferredSize: { width: 900, height: 360 }, sample: { root: "(Insert root question)", children: ["(Insert branch 1)", "(Insert branch 2)", "(Insert branch 3)", "(Insert branch 4)"] }, render: ({ id, frame, props }) => ({ nodes: treeNodes({ id, frame, props }) }) }),
    component({ id: "organization", category: "relationship", role: "organization", tokens: ["color.componentPrimary", "color.componentPrimaryTint", "color.surface", "color.surfaceMuted", "color.rule", "color.onPrimary", "color.ink", "color.textSecondary", "font.body", "type.compact", "line.hairline", "line.standard", "radius.none", "radius.small"], preferredSize: { width: 900, height: 360 }, sample: { root: "(Insert parent role)", children: ["(Insert role 1)", "(Insert role 2)", "(Insert role 3)", "(Insert role 4)"] }, render: ({ id, frame, props }) => ({ nodes: treeNodes({ id, frame, props, organization: true }) }) }),
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
    component({ id: "connector", category: "relationship", role: "connector", tokens: ["color.componentPrimary", "color.onPrimary", "font.body", "type.label", "line.standard", "line.hairline", "icon.medium", "radius.round"], preferredSize: { width: 360, height: 90 }, sample: { label: "therefore", variant: "labelled-line" }, render: ({ id, frame, props }) => {
      const variant = props.variant ?? (props.label ? "labelled-line" : "disc-chevron"), centerY = frame.y + frame.height / 2;
      if (variant === "chevron") return { nodes: [lightChevronNode(id, frame)] };
      if (variant === "disc-chevron") {
        const diameter = tokenValue(token("icon.medium")), centerX = frame.x + frame.width / 2;
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
      if (definition.id === "table") {
        definition.variants = TABLE_VARIANTS;
        definition.defaultVariant = "open";
        definition.variantProp = "variant";
        definition.resolveVariant = props => props.variant ?? (props.treatment === "standard" ? "standard" : "open");
        const render=definition.render;
        definition.render=input=>{if(!Object.hasOwn(TABLE_VARIANTS,definition.resolveVariant(input.props)))throw new Error('Unknown table variant');return render(input);};
      }
    }
    const axes = { section: ["treatment", ["open", "muted", "primary", "dark", "tint"]], panel: ["tone", ["open", "muted", "primary", "dark"]], "content-rail": ["treatment", ["muted", "open"]], roadmap: ["variant", ["process", "wave-columns"]], "section-heading": ["variant", ["standard", "accent", "inverse"]] };
    axes["section-boundary"] = ["variant", ["related", "inference", "inference-chevron", "subsection"]];
    axes.metric = ["variant", ["default", "prominent"]];
    axes.connector = ["variant", ["disc-chevron", "chevron", "line", "labelled-line"]];
    axes["bullet-list"] = ["variant", ["compact", "body"]];
    axes.insight = ["variant", ["tonal", "neutral", "dotted", "primary"]];
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
  return registerFramework(registerGantt(registerExtras(registerPanels(registerRelationshipNetwork(registerSegmentedEvidence(registerMedia(registerChartGroup(registerCharts(registerQuoteCluster(registerInsightTreeTable(registerTrackers(registerCore(new Map())))))))))))));
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
