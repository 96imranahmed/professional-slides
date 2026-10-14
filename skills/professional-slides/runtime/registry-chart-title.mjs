// The chart heading every chart draws over its plot (`chart-title`): its
// copy checked, its variants (an underlined heading, a unit line under it or
// the unit inline), and the ruled band peers in a row share. Registered after
// the core components, before the charts that draw it.
import { houseStyle, token, tokenValue, rectPrimitive, stableId, textPrimitive, STYLE_TOKENS } from "./core.mjs";
import { ENGINE_RESERVE, measureText } from "./text-layout.mjs";
import { textWordList } from "./text-contract.mjs";
import { FONT, COMPACT, INK, SECONDARY, WHITE, HAIRLINE, textStyle, boxStyle, openLine, SECTION_HEADING_TOKENS } from "./registry-shared.mjs";
import { iconMarker, markerSize, MARK_TOKENS } from "./marks.mjs";
import { iconDefinition, unknownIcon } from "./icons.mjs";

// A heading's icon is a card's outline icon at the size a column of icon cards sets it (panels.mjs cardsLayout): 1.5 discs.
const HEADING_ICON = () => Math.round(markerSize() * 1.5);

function resolveChartTitleVariant(props = {}) {
  if (props.unit !== undefined && (typeof props.unit !== "string" || !props.unit.trim())) throw new Error("Chart title unit must be nonempty text");
  const variant = props.variant ?? "underlined";
  if (!["underlined", "unit"].includes(variant)) throw new Error(`Unknown chart-title variant: ${variant}`);
  if (variant === "unit" && (typeof props.unit !== "string" || !props.unit.trim())) throw new Error("Chart title unit variant requires a unit");
  return variant;
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
  const measureHeading = (text) => measureText(text, frame.width - 2 * padX, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")), bold: !band, wrapWidthRatio: ENGINE_RESERVE });
  let heading = measureHeading(headingText);
  // The stacked unit line is compact grey under the heading; the inline unit
  // sits on the heading's line at the heading's size, after a comma in the heading.
  // The inline unit is tried first and falls back to the stacked line — at the
  // compact size — when the heading wraps or the pair will not fit on the line.
  const inlineGap = tokenValue(token("space.2"));
  const measureUnit = (size) => props.unit ? measureText(props.unit, frame.width, { fontFamily: tokenValue(FONT), fontSize: tokenValue(size) }) : null;
  // A ruled heading takes the unit inline wherever the pair fits: a second
  // line under the heading pushes the rule down (peers then share the taller
  // band, below). The stacked unit line otherwise belongs to headings that
  // carry no rule.
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
  // `icon`: a line icon in a ring over the heading, as a card sets one over its title - the panel named by its picture
  // before its words. It stands in the band, so peers that share the band keep their headings and rules level.
  if (props.icon !== undefined && !iconDefinition(props.icon)) throw new Error(unknownIcon(props.icon, "chart heading icon"));
  const iconSize = props.icon ? HEADING_ICON() : 0, iconBand = props.icon ? iconSize + tokenValue(token("space.2")) : 0;
  const block = iconBand + heading.height + 2 * padY + (unit && !inline ? unitGap + unit.height : 0);
  const bandHeight = Math.max(block, props.headerBandHeight || 0);
  const ruled = variant === "underlined" && !band;
  const ruleGap = tokenValue(token("space.1")), contentGap = tokenValue(token("space.3"));
  const height = bandHeight + (ruled ? ruleGap : 0) + contentGap;
  // A hero chart's banner is one line. When the composer asked for the inline
  // unit and the pair will not fit, the band becomes two lines. A real unit
  // ("% y/y", "$bn") beside a one-line heading is the runtime's to resolve: it
  // moves under the heading, and peers share the taller band, so their rules
  // still line up; reported as HEADING_WRAPS, it would name the heading when
  // the unit is what breaks the line. What the runtime cannot resolve is
  // recorded with its measure: a heading that wraps on its own, or a unit
  // written as a phrase ("$k, published base-salary band") carrying a
  // qualification that belongs in the note.
  const available = frame.width - 2 * padX;
  const oneLine = (text, bold = !band) => Math.ceil(measureText(text, 1e5, { fontFamily: tokenValue(FONT), fontSize: tokenValue(token("type.heading")), bold }).width);
  const phrase = Boolean(unit) && textWordList(props.unit).filter((word) => /[A-Za-z]{3,}/.test(word)).length >= 3;
  const reason = band || !(props.unitPlacement === "inline" || underlined) ? null
    : heading.lines.length > 1 ? "heading" : unit && !inline && phrase ? "unit" : null;
  // What of a heading that wraps fits its one line, measured as it is set: its first words, and their characters. "Shorten
  // the heading" sent an author cutting a word a compile; the room in words and characters is the cut to make.
  const fits = (() => { const words = String(headingText).trim().split(/\s+/); let n = 0;
    while (n < words.length && oneLine(words.slice(0, n + 1).join(" ")) <= available) n += 1;
    return { words: n, characters: words.slice(0, n).join(" ").length }; });
  const wrapped = reason ? { reason, text: reason === "heading" ? headingText : `${headingText}, ${props.unit}`,
    width: reason === "heading" ? oneLine(headingText) : oneLine(`${headingText},`) + inlineGap + oneLine(props.unit, false), available: Math.floor(available), ...(reason === "heading" ? { fits: fits() } : {}) } : false;
  return { heading, unit, unitSize, unitGap, inline, inlineGap, unitPlacement: unit ? (inline ? "inline" : "stacked") : "none", wrapped, block, bandHeight, ruleGap, contentHeight: bandHeight, ruled, variant, height, band, padX, padY, iconSize, iconBand };
}
function chartTitleNodes({ id, frame, props }) {
  const layout = chartTitleLayout(frame, props);
  if (layout.height > frame.height) throw new Error(`Chart title ${id} exceeds its allocated height; shorten the heading or unit, or allocate more height`);
  // The heading's own top: under the icon where it has one.
  const top = frame.y + layout.iconBand, blockTop = top + layout.padY;
  const nodes = props.icon ? iconMarker({ id: stableId(id, "icon"), role: "chart-heading-icon", x: frame.x + layout.padX, y: frame.y, size: layout.iconSize, icon: props.icon, tone: "outline", data: { headingIcon: true } }) : [];
  if (layout.band) nodes.push(rectPrimitive({ id: stableId(id, "band"), role: "chart-heading-band", frame: { x: frame.x, y: top, width: frame.width, height: layout.heading.height + 2 * layout.padY }, style: boxStyle(SECONDARY, "none", HAIRLINE, token("radius.none")) }));
  nodes.push(textPrimitive({
    id: stableId(id, "heading"),
    role: "section-heading",
    frame: { x: frame.x + layout.padX, y: blockTop, width: frame.width - 2 * layout.padX, height: layout.heading.height },
    text: layout.heading.text,
    style: { ...textStyle(token("type.heading"), layout.band ? WHITE : INK, !layout.band, "left", "top"), lineHeight: layout.heading.lineHeight, wrap: false },
    data: { textLayout: layout.heading, headerTop: frame.y, headerBandHeight: layout.bandHeight, ruleGap: layout.ruleGap, chartTitleVariant: layout.variant, chartUnitPlacement: layout.unitPlacement, ...(layout.wrapped ? { headingWrapped: layout.wrapped } : {}) }
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
    const badge = measureText(String(props.badge), frame.width * 0.5, { fontFamily: tokenValue(FONT), fontSize: tokenValue(COMPACT), bold: true });
    if (badge.lines.length === 1) {
      const pad = tokenValue(token("space.2")), w = Math.ceil(badge.width) + 2 * pad, h = badge.height + tokenValue(token("space.1"));
      const bx = frame.x + frame.width - w, by = top + (layout.heading.height - h) / 2;
      nodes.push(rectPrimitive({ id: stableId(id, "badge-surface"), role: "chart-badge-surface", frame: { x: bx, y: by, width: w, height: h }, style: boxStyle(token("color.accent"), "none", HAIRLINE, token("radius.round")) }));
      nodes.push(textPrimitive({ id: stableId(id, "badge"), role: "chart-badge", frame: { x: bx + pad, y: by + (h - badge.height) / 2, width: w - 2 * pad, height: badge.height }, text: badge.text, style: { ...textStyle(COMPACT, WHITE, true, "center", "top"), lineHeight: badge.lineHeight, wrap: false }, data: { textLayout: badge } }));
    }
  }
  if (layout.ruled) nodes.push(openLine(stableId(id, "rule"), frame.x, frame.y + layout.bandHeight + layout.ruleGap, frame.x + frame.width, frame.y + layout.bandHeight + layout.ruleGap, "section-heading-rule", INK, HAIRLINE, { chartTitleVariant: layout.variant }));
  return nodes;
}

/** The chart heading every chart draws over its plot, registered after the core components. */
export function registerChartTitle(registry) {
  registry.set("chart-title", {
    id: "chart-title", version: "2.1.0", category: "shared", role: "chart-title",
    tokens: [...SECTION_HEADING_TOKENS, ...MARK_TOKENS, "color.chartUnit", "color.accent", "color.textSecondary", "color.onPrimary", "type.compact", "space.1", "space.2", "space.3", "radius.round", "radius.none", ...STYLE_TOKENS],
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
