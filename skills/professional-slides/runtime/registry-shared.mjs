// What the core component families (registry-*.mjs) share: the design tokens
// they draw with, the registry's text and box styles, an open rule, the
// `component` constructor every core definition is built by, the variant axes
// the core components are refined with, the section header the section, its
// heading and the content rail draw and measure alike, the plain list and the
// chevron that more than one family sets.
import { token, linePrimitive, assertSectionHeadingProps, tokenValue, stableId, textPrimitive, insetFrame, normalizeInsets, ellipsePrimitive,
  rectPrimitive, shapePrimitive, reversedType } from "./core.mjs";
import { textStyle as baseTextStyle } from "./text-style.mjs";
import { ENGINE_RESERVE, measureText } from "./text-layout.mjs";
import { setText, drawText } from "./text-roles.mjs";

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

// `sizing: "fill"`: the component draws to whatever frame it is given (a chart, a picture, a toned panel); without it, it
// has a size of its own, which it measures or the engine reads off what it draws.
// `takes`: the page content the component can set, and how many items of it ({ points: [1, 1] } - one point, no more);
// `reads`: the widths it reads at ({ minWidth, maxWidth }, px). Both are requirements the engine weighs when it chooses
// between ways of setting a page (tasteful-layout), so a new way to set content is a component that says what it takes.
// `anchor: "top"`: the component is read from its head (a table from its header row), so where it leaves height it
// keeps the top of its frame and the page's own top line from one such page to the next.
export const component = ({ id, sizing, takes, reads, anchor, category, role = category, tokens, preferredSize, sample, variants, defaultVariant, render, measureContent }) => ({
  id,
  ...(sizing ? { sizing } : {}),
  ...(takes ? { takes } : {}),
  ...(reads ? { reads } : {}),
  ...(anchor ? { anchor } : {}),
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
  const color = variant === "inverse" ? reversedType() : variant === "accent" ? PRIMARY : INK;
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

/**
 * A plain list measured in a column `frame.width` wide: each item body text at its reading measure (text-roles.mjs), its
 * marker - a dot, a square, a small arrow or a numbered disc - at its first line, the items a gap apart. Returns the
 * measured texts (`sets`), each row's height and the height the list draws.
 */
export function listLayout(frame, items, { numbered = false, marker = "circle" } = {}) {
  const dot = ["square", "circle"].includes(marker);
  const markerSize = numbered ? 24 : dot ? 6 : 18;
  const textOffset = numbered ? 36 : dot ? 18 : 36;
  const textWidth = Math.max(1, frame.width - textOffset);
  const sets = items.map((item) => setText("body", String(item), textWidth));
  const rows = sets.map((set) => Math.max(numbered ? markerSize + 4 : 0, set.height)), gap = tokenValue(token("space.3"));
  return { numbered, marker, markerSize, textOffset, textWidth, sets, rows, gap, height: rows.reduce((sum, row) => sum + row, 0) + gap * Math.max(0, rows.length - 1) };
}

/** The list `listLayout` measured, drawn from (`x`, `y`). */
export function listNodes({ id, x, y, layout, markerColor = PRIMARY, rolePrefix = "list" }) {
  const nodes = [], { markerSize } = layout;
  let cursor = y;
  layout.sets.forEach((set, index) => {
    const top = cursor, line = set.lineHeight;
    if (layout.numbered) {
      const disc = { x, y: top + 2, width: markerSize, height: markerSize };
      nodes.push(ellipsePrimitive({ id: stableId(id, "marker", index), role: `${rolePrefix}-marker`, frame: disc, style: boxStyle(markerColor, markerColor, HAIRLINE, token("radius.round")) }));
      const number = setText("mark", String(index + 1), markerSize);
      nodes.push(drawText(stableId(id, "marker-label", index), `${rolePrefix}-marker-label`, { x, y: disc.y + (markerSize - number.height) / 2, width: markerSize }, number, { color: WHITE, align: "center" }));
    } else if (layout.marker === "circle") {
      nodes.push(ellipsePrimitive({ id: stableId(id, "marker", index), role: `${rolePrefix}-marker`, frame: { x: x + 2, y: top + (line - markerSize) / 2, width: markerSize, height: markerSize }, style: boxStyle(markerColor, markerColor, HAIRLINE, token("radius.round")) }));
    } else if (layout.marker === "square") {
      nodes.push(rectPrimitive({ id: stableId(id, "marker", index), role: `${rolePrefix}-marker`, frame: { x: x + 2, y: top + (line - markerSize) / 2, width: markerSize, height: markerSize }, style: boxStyle(markerColor, markerColor, HAIRLINE, token("radius.none")) }));
    } else {
      nodes.push(shapePrimitive({ id: stableId(id, "marker", index), role: `${rolePrefix}-marker`, geometry: "rightArrow", frame: { x: x + 2, y: top + (line - markerSize) / 2, width: markerSize, height: markerSize }, style: boxStyle(markerColor, markerColor, HAIRLINE, token("radius.none")) }));
    }
    nodes.push(drawText(stableId(id, "item", index), `${rolePrefix}-item`, { x: x + layout.textOffset, y: top, width: layout.textWidth }, set));
    cursor += layout.rows[index] + layout.gap;
  });
  return nodes;
}

/**
 * A plain list in `frame`, measured and drawn (listLayout, listNodes). A list taller than its frame is refused with what
 * it needs: its text is never squeezed into rows shorter than its lines.
 */
export function simpleList({ id, frame, items, numbered = false, markerColor = PRIMARY, marker = "circle", rolePrefix = "list" }) {
  const layout = listLayout(frame, items, { numbered, marker });
  if (layout.height > frame.height + 0.01) throw new Error(`${id}: the list needs ${Math.ceil(layout.height)}px and its frame has ${Math.floor(frame.height)}px; cut an item or give the list more height`);
  return listNodes({ id, x: frame.x, y: frame.y, layout, markerColor, rolePrefix });
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
