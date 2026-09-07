import { contrastRatio } from "./palettes.mjs";
import {
  rectPrimitive,
  linePrimitive,
  textPrimitive,
  stableId,
  token,
  tokenValue,
} from "./core.mjs";
import { measureText } from "./text-layout.mjs";

const TOKENS = [
  "font.body",
  "type.body",
  "type.heading",
  "color.ink",
  "color.onPrimary",
  "color.componentPrimary",
  "color.chartSeries3",
  "color.surfaceMuted",
  "color.rule",
  "line.hairline",
  "radius.none",
];
function text(
  id,
  frame,
  value,
  { white = false, bold = false, role = "segment-copy" } = {},
) {
  const style = {
    fontFamily: token("font.body"),
    fontSize: token(bold ? "type.heading" : "type.body"),
    color: token(white ? "color.onPrimary" : "color.ink"),
    bold,
    valign: "middle",
  };
  const layout = measureText(value, frame.width, {
    fontFamily: tokenValue(style.fontFamily),
    fontSize: tokenValue(style.fontSize),
    bold,
    wrapWidthRatio: 1,
  });
  if (layout.height > frame.height)
    throw new Error(`${id} needs more text space`);
  return textPrimitive({
    id,
    role,
    frame,
    text: layout.text,
    style: { ...style, lineHeight: layout.lineHeight, wrap: false },
    data: { textLayout: layout },
  });
}
function box(id, frame, fill, role) {
  return rectPrimitive({
    id,
    role,
    frame,
    style: { fill: token(fill), stroke:"none", radius: token("radius.none") },
  });
}
const whiteOn = fill => contrastRatio(tokenValue(token(fill)),tokenValue(token("color.ink"))) < 4.5;
function band(id, frame, heading, items, fill) {
  if (
    !heading ||
    !Array.isArray(items) ||
    !items.length ||
    items.some((v) => typeof v !== "string" || !v.trim())
  )
    throw new Error("Implication bands need a heading and substantive items");
  return [
    box(`${id}-surface`, frame, "color.surfaceMuted", "segment-surface"),
    box(`${id}-band`, { ...frame, height: 40 }, fill, "segment-header-band"),
    text(
      `${id}-heading`,
      { x: frame.x + 12, y: frame.y, width: frame.width - 24, height: 40 },
      heading,
      { white: whiteOn(fill), bold: true },
    ),
    text(
      `${id}-body`,
      {
        x: frame.x + 12,
        y: frame.y + 52,
        width: frame.width - 24,
        height: frame.height - 64,
      },
      items.join("\n"),
    ),
  ];
}
export function registerSegmentedEvidence(registry) {
  const tree = registry.get("tree");
  tree.tokens = [...new Set([...tree.tokens, ...TOKENS])];
  tree.variants = {
    "decision-conclusions": {
      preferredSize: { width: 1160, height: 500 },
      props: {
        root: "(Insert decision question)",
        branches: [
          {
            id: "a",
            label: "(Insert path A)",
            conclusions: [
              { id: "a1", text: "(Insert conclusion A1)" },
              { id: "a2", text: "(Insert conclusion A2)" },
            ],
          },
          {
            id: "b",
            label: "(Insert path B)",
            conclusions: [
              { id: "b1", text: "(Insert conclusion B1)" },
              { id: "b2", text: "(Insert conclusion B2)" },
            ],
          },
        ],
        conclusion: "(Insert overall conclusion)",
      },
    },
  };
  tree.defaultVariant = "decision-conclusions";
  tree.preferredSize = { width: 1160, height: 500 };
  tree.sample = structuredClone(tree.variants["decision-conclusions"].props);
  tree.variantProp = "variant";
  tree.resolveVariant = (props = {}) => {
    const v = props.variant ?? "decision-conclusions";
    if (!Object.hasOwn(tree.variants, v))
      throw new Error("Decision trees require multiple levels: root, decision branches and terminal conclusions");
    return v;
  };
  tree.render = (input) => {
    const { id, frame, props } = input;
    tree.resolveVariant(props);
    const branches = props.branches;
    if (
      !props.root ||
      !props.conclusion ||
      !Array.isArray(branches) ||
      branches.length !== 2
    )
      throw new Error(
        "Decision tree requires a root, two branches and overall conclusion",
      );
    const ids = [];
    for (const b of branches) {
      ids.push(b.id);
      if (
        !b.label ||
        !Array.isArray(b.conclusions) ||
        b.conclusions.length < 1 ||
        b.conclusions.length > 3
      )
        throw new Error("Each branch needs one to three conclusions");
      for (const c of b.conclusions) {
        ids.push(c.id);
        if (!c.text) throw new Error("Empty conclusion");
      }
    }
    if (
      ids.some((v) => typeof v !== "string" || !v.trim()) ||
      new Set(ids).size !== ids.length
    )
      throw new Error("Decision IDs must be unique and nonempty");
    if (frame.width < 900 || frame.height < 440)
      throw new Error("Decision tree requires 900 by 440");
    const nodes = [],
      root = {
        x: frame.x + frame.width / 2 - 150,
        y: frame.y,
        width: 300,
        height: 70,
      };
    const nodeBox = (key, f, value, fill) =>
      nodes.push(
        box(`${key}-box`, f, fill, "decision-box"),
        text(
          `${key}-text`,
          {
            x: f.x + 12,
            y: f.y + 8,
            width: f.width - 24,
            height: f.height - 16,
          },
          value,
          { white: whiteOn(fill), bold: true, role: "decision-label" },
        ),
      );
    const connect = (key, x1, y1, x2, y2, from, to) =>
      nodes.push(
        linePrimitive({
          id: key,
          role: "decision-connector",
          x1,
          y1,
          x2,
          y2,
          style: {
            stroke: token("color.rule"),
            lineWidth: token("line.hairline"),
          },
          data: { endArrow: true, dependencies: [from, to] },
        }),
      );
    nodeBox(`${id}-root`, root, props.root, "color.ink");
    const width = (frame.width - 40) / 2;
    branches.forEach((b, i) => {
      const x = frame.x + i * (width + 40),
        fill = i ? "color.componentPrimary" : "color.surfaceMuted",
        center = x + width / 2;
      connect(
        stableId(id, b.id, "link"),
        frame.x + frame.width / 2,
        frame.y + 70,
        center,
        frame.y + 140,
        `${id}-root-box`, `${stableId(id,b.id)}-box`,
      );
      nodeBox(
        stableId(id, b.id),
        { x: center - 140, y: frame.y + 140, width: 280, height: 70 },
        b.label,
        fill,
      );
      const leafWidth =
        (width - 20 * (b.conclusions.length - 1)) / b.conclusions.length;
      b.conclusions.forEach((c, j) => {
        const lx = x + j * (leafWidth + 20);
        connect(
          stableId(id, c.id, "link"),
          center,
          frame.y + 210,
          lx + leafWidth / 2,
          frame.y + 280,
          `${stableId(id,b.id)}-box`, `${stableId(id,c.id)}-box`,
        );
        nodeBox(
          stableId(id, c.id),
          { x: lx, y: frame.y + 280, width: leafWidth, height: 80 },
          c.text,
          fill,
        );
      });
    });
    const f = {
      x: frame.x,
      y: frame.y + frame.height - 64,
      width: frame.width,
      height: 64,
    };
    nodes.push(
      box(
        `${id}-conclusion-surface`,
        f,
        "color.surfaceMuted",
        "decision-conclusion-surface",
      ),
      text(
        `${id}-conclusion`,
        { ...f, x: f.x + 16, width: f.width - 32 },
        props.conclusion,
        { bold: true, role: "decision-conclusion" },
      ),
    );
    for (const node of nodes) {
      if (node.role === 'decision-label') node.data.dependencies = [node.id.replace(/-text$/, '-box')];
      if (node.role === 'decision-box') node.data.dependencies = [node.id.replace(/-box$/, '-text')];
    }
    return { nodes };
  };
  const chart = registry.get("chart.column"),
    render = chart.render;
  chart.tokens = [...new Set([...chart.tokens, ...TOKENS])];
  chart.examples = {
    ...chart.examples,
    "segment-implications": {
      preferredSize: { width: 1160, height: 540 },
      props: {
        categories: ["A", "B", "C", "D", "E", "F"],
        series: [{ name: "Measure", values: [120, 105, 90, 75, 50, 40] }],
        highlights: [],
        annotations: [],
        referenceLines: [],
        segments: [
          {
            id: "focus",
            label: "(Insert focus group)",
            categories: ["A", "B", "C", "D"],
            heading: "(Insert focus implication)",
            items: [
              "(Insert first implication)",
              "(Insert second implication)",
            ],
          },
          {
            id: "other",
            label: "(Insert other group)",
            categories: ["E", "F"],
            heading: "(Insert other implication)",
            items: ["(Insert implication)"],
          },
        ],
      },
    },
  };
  chart.variants = {
    standard: {},
    "segment-implications": chart.examples["segment-implications"],
  };
  chart.defaultVariant = "standard";
  chart.variantProp = "variant";
  chart.resolveVariant = (props = {}) => {
    const v = props.segments ? "segment-implications" : "standard";
    if (props.variant !== undefined && props.variant !== v)
      throw new Error("Column variant must match segment inputs");
    return v;
  };
  chart.render = (input) => {
    const { props, frame, id } = input;
    chart.resolveVariant(props);
    if (!props.segments) return render(input);
    const segments = props.segments;
    if (
      !Array.isArray(segments) ||
      segments.length < 2 ||
      segments.length > 3 ||
      new Set(segments.map((s) => s.id)).size !== segments.length ||
      segments.some(
        (s) =>
          !s.id ||
          !s.label ||
          !Array.isArray(s.categories) ||
          !s.categories.length,
      )
    )
      throw new Error("Segmented columns need two or three identified groups");
    if (
      JSON.stringify(segments.flatMap((s) => s.categories)) !==
      JSON.stringify(props.categories)
    )
      throw new Error(
        "Segments must partition every category exactly once in plot order",
      );
    if (props.series?.length !== 1 || props.highlights?.length)
      throw new Error(
        "Segment colour requires one measure and no competing highlights",
      );
    if (frame.height < 450)
      throw new Error("Segment implications need at least 450 height");
    const { segments: _, ...chartProps } = props;
    const result = render({
      ...input,
      frame: { ...frame, y: frame.y + 36, height: frame.height - 236 },
      props: { ...chartProps, legend: false },
    });
    const marks = result.nodes.filter((n) => n.role === "chart-mark");
    segments.forEach((s, i) => {
      const fill =
        i === segments.length - 1 ? "color.chartSeries3" : "color.ink";
      const group = marks.filter((n) => s.categories.includes(n.data.category));
      if (group.length !== s.categories.length)
        throw new Error("Cannot align segment to chart marks");
      for (const n of group) {
        n.style.fill = token(fill);
        n.data.segmentId = s.id;
      }
      const left = Math.min(...group.map((n) => n.frame.x)),
        right = Math.max(...group.map((n) => n.frame.x + n.frame.width));
      result.nodes.push(
        text(
          stableId(id, s.id, "label"),
          { x: left, y: frame.y, width: right - left, height: 32 },
          s.label,
          { bold: true },
        ),
      );
      const gap = 12,
        x =
          frame.x +
          (frame.width * props.categories.indexOf(s.categories[0])) /
            props.categories.length;
      const width =
        (frame.width * s.categories.length) / props.categories.length -
        (i < segments.length - 1 ? gap : 0);
      result.nodes.push(
        ...band(
          stableId(id, s.id),
          { x, y: frame.y + frame.height - 172, width, height: 172 },
          s.heading,
          s.items,
          fill,
        ),
      );
      if (i)
        result.nodes.push(
          linePrimitive({
            id: stableId(id, s.id, "divider"),
            role: "segment-divider",
            x1: left - 8,
            y1: frame.y + 36,
            x2: left - 8,
            y2: frame.y + frame.height - 206,
            style: {
              stroke: token("color.rule"),
              lineWidth: token("line.hairline"),
              dash: "dash",
            },
          }),
        );
    });
    return result;
  };
  return registry;
}
