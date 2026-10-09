// The connector drawn between columns - the gutter's bridge from evidence to
// what is read off it (a chevron, a disc, a divider, an arrow, a labelled
// line) - and the content rail beside a page's body.
import { ellipsePrimitive, linePrimitive, shapePrimitive, stableId, textPrimitive, token, tokenValue, normalizeInsets, rectPrimitive } from "./core.mjs";
import { PRIMARY, RULE, WHITE, HAIRLINE, STANDARD, LABEL, textStyle, boxStyle, openLine, component, lightChevronNode, MUTED_SURFACE,
  SECTION_HEADING_TOKENS, headingLayout, sectionHeadingNodes, contentRailInsets, simpleList, refineVariantAxes, refineSectionHeader } from "./registry-shared.mjs";

function defineConnector() {
  return component({
    id: "connector",
    category: "relationship",
    role: "connector",
    tokens: [
      "color.componentPrimary", "color.onPrimary", "font.body", "type.label", "color.rule", "line.standard", "line.hairline", "icon.medium",
      "icon.large", "space.2", "radius.none", "radius.round"
    ],
    preferredSize: { width: 360, height: 90 },
    sample: { label: "therefore", variant: "labelled-line" },
    render: ({ id, frame, props }) => {
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
    }
  });
}

function defineContentRail() {
  return component({
    id: "content-rail",
    category: "section",
    role: "rail",
    tokens: [
      "color.surface",
      "color.surfaceMuted",
      "color.rule",
      "type.compact",
      "space.1",
      "space.3",
      "radius.none",
      "radius.round",
      ...SECTION_HEADING_TOKENS
    ],
    preferredSize: { width: 330, height: 360 },
    sample: {
      heading: "(Insert takeaway heading)",
      items: ["(Insert evidence-backed takeaway 1)", "(Insert evidence-backed takeaway 2)", "(Insert evidence-backed takeaway 3)"]
    },
    render: ({ id, frame, props }) => {
      const treatment = props.treatment || "muted";
      const inset = normalizeInsets(contentRailInsets(props));
      const nodes = [];
      if (treatment === "muted")
        nodes.push(
          rectPrimitive({
            id: stableId(id, "surface"),
            role: "rail-surface",
            frame,
            style: boxStyle(MUTED_SURFACE, MUTED_SURFACE, HAIRLINE, token("radius.none"))
          })
        );
      if (props.dividerLeft)
        nodes.push(openLine(stableId(id, "divider"), frame.x, frame.y, frame.x, frame.y + frame.height, "rail-divider", RULE, HAIRLINE));
      const headerFrame = { x: frame.x + inset.left, y: frame.y + inset.top, width: frame.width - inset.left - inset.right, height: 52 };
      const headerProps = { ...props, variant: treatment === "muted" ? "accent" : "standard", rule: treatment === "open" };
      nodes.push(...sectionHeadingNodes({ id: stableId(id, "header"), frame: headerFrame, props: headerProps }));
      const listTop = headerFrame.y + headingLayout(headerFrame, headerProps).height + tokenValue(token("space.2"));
      nodes.push(
        ...simpleList({
          id: stableId(id, "list"),
          frame: {
            x: frame.x + inset.left,
            y: listTop,
            width: frame.width - inset.left - inset.right,
            height: frame.y + frame.height - listTop - 12
          },
          items: props.items,
          marker: "circle",
          rolePrefix: "rail"
        })
      );
      return { nodes };
    }
  });
}

/** The connector between columns and the content rail. */
export function registerConnectors(registry) {
  const definitions = [defineConnector(), defineContentRail()];
  for (const definition of definitions) {
    refineVariantAxes(definition);
    refineSectionHeader(definition);
    registry.set(definition.id, definition);
  }
  return registry;
}
