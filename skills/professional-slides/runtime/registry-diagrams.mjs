// The diagrams: the two-by-two matrix, the map (preset geographies, imported
// geometry, highlighted countries and markers) and the funnel, quantitative
// or qualitative.
import { ellipsePrimitive, rectPrimitive, stableId, textPrimitive, token, tokenValue, TOKENS } from "./core.mjs";
import { measureText } from "./text-layout.mjs";
import { MAP_TOKENS, mapNodes, CUSTOM_MAP_SAMPLE, CHOROPLETH_MAP_SAMPLE, MAP_GUIDANCE, MAP_PRESET_IDS, resolveGeography } from "./maps.mjs";
import { renderQualitativeFunnel, measureQualitativeFunnel, QUALITATIVE_TOPOLOGY_TOKENS, QUALITATIVE_FUNNEL_SAMPLE } from "./qualitative-topology.mjs";
import { INK, SECONDARY, PRIMARY, SURFACE, MUTED_SURFACE, WHITE, HAIRLINE, STANDARD, LABEL, textStyle, boxStyle, openLine, component,
  SMALL_RADIUS, COMPACT } from "./registry-shared.mjs";

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
      const measured = measureText(name, c.width - 24, { fontSize: tokenValue(LABEL), bold: true });
      nodes.push(
        textPrimitive({
          id: stableId(id, "cell-label", q),
          role: "matrix-quadrant-label",
          frame: {
            x: c.x + 12,
            y: q.startsWith("top") ? c.y + 8 : c.y + c.height - 8 - measured.height,
            width: c.width - 24,
            height: measured.height
          },
          text: measured.text,
          style: {
            ...textStyle(LABEL, SECONDARY, true, q.endsWith("Right") ? "right" : "left", "top"),
            lineHeight: measured.lineHeight,
            wrap: false
          },
          data: { quadrant: q, textLayout: measured }
        })
      );
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
    nodes.push(
      textPrimitive({
        id: stableId(id, "point-label", index),
        role: "matrix-point-label",
        frame: props.bubbles
          ? { x: x - size * 0.4, y: y - size * 0.32, width: size * 0.8, height: size * 0.64 }
          : { x: right ? x + 12 : x - 12 - labelWidth, y: y - 10, width: labelWidth, height: 22 },
        text: point.label,
        style: textStyle(LABEL, props.bubbles ? WHITE : INK, true, props.bubbles ? "center" : right ? "left" : "right")
      })
    );
  });
  return nodes;
}

function defineMatrix() {
  return component({
    id: "matrix",
    category: "relationship",
    role: "matrix",
    tokens: [
      "color.componentPrimary", "color.accent", "color.accentTint", "color.surfaceMuted", "color.textSecondary", "color.chartSeries2",
      "color.surface", "color.rule", "color.ink", "color.positive", "color.caution", "color.negative", "color.onPrimary", "font.body",
      "type.label", "line.hairline", "line.standard", "radius.none", "radius.round"
    ],
    preferredSize: { width: 720, height: 410 },
    sample: {
      xAxis: { label: "Effort", minLabel: "Low", maxLabel: "High" },
      yAxis: { label: "Impact", minLabel: "Low", maxLabel: "High" },
      points: [{ label: "A", x: 0.24, y: 0.35 }, { label: "B", x: 0.56, y: 0.62 }, { label: "C", x: 0.76, y: 0.82 }],
      highlight: 2
    },
    render: ({ id, frame, props }) => ({ nodes: matrixNodes({ id, frame, props }) })
  });
}

function defineMap() {
  return component({
    id: "map",
    category: "relationship",
    role: "map",
    tokens: MAP_TOKENS,
    preferredSize: { width: 920, height: 440 },
    sample: {
      geography: "world",
      markers: [
        { label: "Americas", x: 0.2, y: 0.45, fraction: 0.75 },
        { label: "Europe", x: 0.5, y: 0.34, fraction: 0.5 },
        { label: "Asia", x: 0.77, y: 0.44, fraction: 0.25 }
      ]
    },
    render: ({ id, frame, props }) => ({ nodes: mapNodes({ id, frame, props }) })
  });
}

function defineFunnel() {
  return component({
    id: "funnel",
    category: "relationship",
    role: "funnel",
    tokens: [
      "color.componentPrimary", "color.chartSeries2", "color.chartSeries3", "color.chartSeries4", "color.onPrimary", "color.ink",
      "font.body", "type.compact", "line.hairline", "radius.small"
    ],
    preferredSize: { width: 700, height: 360 },
    sample: {
      stages: [
        { label: "Market", value: 100 },
        { label: "Qualified", value: 62 },
        { label: "Engaged", value: 38 },
        { label: "Won", value: 18 }
      ]
    },
    render: ({ id, frame, props, tokens = TOKENS }) => {
      const colors = [PRIMARY, token("color.chartSeries2"), token("color.chartSeries3"), token("color.chartSeries4")];
      if (!Array.isArray(props.stages) || !props.stages.length || !(props.stages[0].value > 0) || props.stages.some(stage => !Number.isFinite(stage.value) || stage.value < 0 || stage.value > props.stages[0].value))
        throw new Error("Funnel stages require non-negative values within a positive denominator");
      const max = props.stages[0].value;
      const height = frame.height / props.stages.length;
      return {
        nodes: props.stages.flatMap((stage, index) => {
          const plotWidth = frame.width * 0.6;
          const width = plotWidth * stage.value / max, x = frame.x + (plotWidth - width) / 2;
          const fill = colors[index % colors.length];
          return [
            ...(width > 0
              ? [
                rectPrimitive({
                  id: stableId(id, "stage", index),
                  role: "funnel-stage",
                  frame: { x, y: frame.y + index * height + 3, width, height: height - 6 },
                  style: boxStyle(fill, fill, HAIRLINE, SMALL_RADIUS)
                })
              ]
              : []),
            textPrimitive({
              id: stableId(id, "label", index),
              role: "funnel-label",
              frame: {
                x: frame.x + plotWidth + 12,
                y: frame.y + index * height + 3,
                width: frame.width - plotWidth - 12,
                height: height - 6
              },
              text: `${stage.label}  ${stage.value}`,
              style: textStyle(COMPACT, INK, true, "left")
            })
          ];
        })
      };
    }
  });
}

/** Diagrams: the matrix, the map and the funnel. */
export function registerDiagrams(registry) {
  const definitions = [defineMatrix(), defineMap(), defineFunnel()];
  for (const definition of definitions) {
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
    registry.set(definition.id, definition);
  }
  return registry;
}
