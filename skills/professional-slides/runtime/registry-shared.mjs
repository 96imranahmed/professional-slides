// What the core component families (registry-*.mjs) share: the design tokens
// they draw with, the registry's text and box styles, an open rule, the
// `component` constructor every core definition is built by, the variant axes
// the core components are refined with, the section header the section, its
// heading and the content rail draw and measure alike, the plain list and the
// chevron that more than one family sets.
import { token, linePrimitive, assertSectionHeadingProps, tokenValue, stableId, textPrimitive, insetFrame, normalizeInsets, ellipsePrimitive,
  rectPrimitive, shapePrimitive } from "./core.mjs";
import { textStyle as baseTextStyle } from "./text-style.mjs";
import { ENGINE_RESERVE, measureText } from "./text-layout.mjs";

export const FONT = token("font.body");
export const DISPLAY = token("font.display");
export const INK = token("color.ink");
export const SECONDARY = token("color.textSecondary");
export const PRIMARY = token("color.componentPrimary");
export const PRIMARY_TINT = token("color.componentPrimaryTint");
export const SURFACE = token("color.surface");
export const MUTED_SURFACE = token("color.surfaceMuted");
export const RULE = token("color.rule");
export const WHITE = token("color.onPrimary");
export const HAIRLINE = token("line.hairline");
export const STANDARD = token("line.standard");
export const SMALL_RADIUS = token("radius.small");
export const BODY = token("type.body");
export const COMPACT = token("type.compact");
export const LABEL = token("type.label");

export const SECTION_HEADING_TOKENS = ["color.componentPrimary", "color.ink", "color.onPrimary", "font.body", "type.heading", "line.hairline", "space.1", "space.2", "space.3", "space.4"];

// The registry's own argument order and defaults, over the shared builders.
export const textStyle = (size = BODY, color = INK, bold = false, align = "left", valign = "mid") =>
  baseTextStyle({ fontFamily: FONT, fontSize: size, color, bold, align, valign });

export const boxStyle = (fill = SURFACE, stroke = RULE, lineWidth = HAIRLINE, radius = SMALL_RADIUS) => ({
  fill,
  stroke,
  lineWidth,
  radius
});

export const openLine = (id, x1, y1, x2, y2, role = "rule", stroke = RULE, lineWidth = HAIRLINE, data = {}) => linePrimitive({
  id,
  role,
  x1,
  y1,
  x2,
  y2,
  style: { stroke, lineWidth },
  data
});

export const component = ({ id, category, role = category, tokens, preferredSize, sample, variants, defaultVariant, render, measureContent }) => ({
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

export function headingLayout(frame, props = {}) {
  assertSectionHeadingProps(props);
  const headingWidth = frame.width;
  const heading = measureText(props.heading || props.text || "", headingWidth, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")), bold: true, wrapWidthRatio: ENGINE_RESERVE });
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

export function sectionHeadingNodes({ id, frame, props = {} }) {
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

export function contentRailInsets(props = {}) {
  return props.treatment === "open"
    ? { top: 0, right: 18, bottom: 18, left: 18 }
    : 18;
}

function estimatedLines(text, width) {
  const charactersPerLine = Math.max(12, Math.floor(width / 7));
  return String(text).split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
}

export function simpleList({ id, frame, items, numbered = false, markerColor = PRIMARY, marker = "circle", distribute = false, rolePrefix = "list" }) {
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

export function lightChevronNode(id, frame) {
  const height = tokenValue(token("icon.medium")), width = height * 0.75;
  if (frame.width < width || frame.height < height) throw new Error("Chevron needs room for its canonical optical size; widen its gutter");
  return shapePrimitive({ id: stableId(id, "chevron"), role: "relationship-chevron", geometry: "chevron", frame: { x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - height) / 2, width, height }, style: { fill: PRIMARY, stroke: "none", lineWidth: HAIRLINE }, data: { relation: "implies", arrowVariant: "chevron" } });
}

/**
 * The variant axes of the core components: the prop each one's variants are
 * chosen by and the values it takes, the first the default. A component on an
 * axis gets its variants, its default and a render that refuses any other value.
 */
export function refineVariantAxes(definition) {
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
}

/**
 * The section, its heading and the content rail draw a ruled header whose
 * height peers in a row share: each refuses heading props it cannot draw and
 * measures that header (measureHeader) the way it renders it.
 */
export function refineSectionHeader(definition) {
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
}
