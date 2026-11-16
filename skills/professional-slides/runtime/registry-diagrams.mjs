// The diagrams: the two-by-two matrix, the map (preset geographies, imported
// geometry, highlighted countries and markers) and the funnel, quantitative
// or qualitative.
import { ellipsePrimitive, rectPrimitive, stableId, token, tokenValue, TOKENS } from "./core.mjs";
import { setText, drawText, TEXT_ROLE_TOKENS } from "./text-roles.mjs";
import { MAP_TOKENS, mapNodes, CUSTOM_MAP_SAMPLE, CHOROPLETH_MAP_SAMPLE, MAP_GUIDANCE, MAP_PRESET_IDS, resolveGeography } from "./maps.mjs";
import { renderQualitativeFunnel, measureQualitativeFunnel, QUALITATIVE_TOPOLOGY_TOKENS, QUALITATIVE_FUNNEL_SAMPLE } from "./qualitative-topology.mjs";
import { INK, SECONDARY, PRIMARY, SURFACE, MUTED_SURFACE, WHITE, HAIRLINE, STANDARD, boxStyle, openLine, component,
  SMALL_RADIUS } from "./registry-shared.mjs";

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
      const c = cellFrame(q), set = setText("tag", name, c.width - 24, { bold: true });
      nodes.push(drawText(stableId(id, "cell-label", q), "matrix-quadrant-label", { x: c.x + 12, y: q.startsWith("top") ? c.y + 8 : c.y + c.height - 8 - set.height, width: c.width - 24 }, set,
        { align: q.endsWith("Right") ? "right" : "left", data: { quadrant: q } }));
    }
  }
  // Axis titles and end labels are the plot's axis (furniture, text-roles.mjs): the titles in ink and bold, the ends in
  // the secondary colour. The y title is set along the axis, turned a quarter.
  const yTitle = props.yAxis.label, xTitle = props.xAxis.label;
  const axis = (key, text, at, { bold = false, align = "left", color = SECONDARY } = {}) => drawText(stableId(id, key), "matrix-axis-label", at, setText("axis", text, at.width, { bold }), { color, align });
  const yTitleNode = axis("y-title", yTitle, { x: frame.x - plot.height / 2 + 12, y: plot.y + plot.height / 2 - 12, width: plot.height }, { bold: true, align: "center", color: INK });
  nodes.push({ ...yTitleNode, frame: { ...yTitleNode.frame, x: frame.x - plot.height / 2 + 12, y: plot.y + (plot.height - yTitleNode.frame.height) / 2, width: plot.height }, style: { ...yTitleNode.style, rotate: -90 } });
  nodes.push(axis("y-max", props.yAxis.maxLabel, { x: frame.x, y: plot.y - endLabel, width: left + 60 }));
  nodes.push(axis("y-min", props.yAxis.minLabel, { x: frame.x, y: plot.y + plot.height + 4, width: left + 60 }));
  nodes.push(axis("x-title", xTitle, { x: plot.x, y: plot.y + plot.height + bottom - 24, width: plot.width }, { bold: true, align: "center", color: INK }));
  nodes.push(axis("x-min", props.xAxis.minLabel, { x: plot.x + 4, y: plot.y + plot.height + 4, width: 120 }));
  nodes.push(axis("x-max", props.xAxis.maxLabel, { x: plot.x + plot.width - 120, y: plot.y + plot.height + 4, width: 120 }, { align: "right" }));
  nodes.push(openLine(stableId(id, "x-axis"), plot.x, plot.y + plot.height, plot.x + plot.width, plot.y + plot.height, "matrix-axis", INK, STANDARD));
  nodes.push(openLine(stableId(id, "y-axis"), plot.x, plot.y, plot.x, plot.y + plot.height, "matrix-axis", INK, STANDARD));
  props.points.forEach((point, index) => {
    const x = plot.x + point.x * plot.width;
    const y = plot.y + (1 - point.y) * plot.height;
    const size = point.size || (props.bubbles ? 76 : 18);
    const color = point.state === "positive" ? token("color.positive") : point.state === "caution" ? token("color.caution") : point.state === "negative" ? token("color.negative") : index === props.highlight ? token("color.accent") : PRIMARY;
    nodes.push(ellipsePrimitive({ id: stableId(id, "point", index), role: "matrix-point", frame: { x: x - size / 2, y: y - size / 2, width: size, height: size }, style: boxStyle(color, SURFACE, HAIRLINE, token("radius.round")) }));
    // A point's name is read off the plot as a data label is (furniture), measured where it is set: to the right of the
    // point, or to its left near the right edge, centred on it; inside a bubble, centred in it.
    const labelWidth = Math.min(150, Math.max(80, plot.width * 0.22));
    const right = x + 12 + labelWidth <= plot.x + plot.width;
    const width = props.bubbles ? size * 0.8 : labelWidth;
    const set = setText("datum", point.label, width, { bold: true });
    if (props.bubbles && set.height > size * 0.64 + 0.5) throw new Error(`Matrix point "${point.label}" needs ${Math.ceil(set.height)}px inside its ${size}px bubble; shorten its name or give the point a larger size`);
    nodes.push(drawText(stableId(id, "point-label", index), "matrix-point-label", { x: props.bubbles ? x - width / 2 : right ? x + 12 : x - 12 - labelWidth, y: y - set.height / 2, width }, set,
      { color: props.bubbles ? WHITE : INK, align: props.bubbles ? "center" : right ? "left" : "right" }));
  });
  return nodes;
}

function defineMatrix() {
  return component({
    id: "matrix", sizing: "fill",
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
    id: "map", sizing: "fill",
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
    id: "funnel", sizing: "fill",
    category: "relationship",
    role: "funnel",
    tokens: [
      "color.componentPrimary", "color.chartSeries2", "color.chartSeries3", "color.chartSeries4", "color.onPrimary", "color.ink", "color.textSecondary",
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
      // Each stage after the first says what it kept: its share of the stage before it (`rates: "previous"`, the default), of
      // the first stage (`"first"`), or nothing (`"none"`) - a narrowing the reader would otherwise have to divide out.
      const rates = props.rates ?? "previous";
      if (!["previous", "first", "none"].includes(rates)) throw new Error("Funnel rates are \"previous\" (each stage's share of the one before), \"first\" (of the first stage) or \"none\"");
      const share = (index) => { const base = rates === "first" ? max : props.stages[index - 1].value; return base > 0 ? props.stages[index].value / base * 100 : null; };
      const rateText = (index) => { const pct = share(index); if (pct === null) return null; const basis = rates === "first" ? props.stages[0].label : props.stages[index - 1].label;
        return `${pct >= 10 ? Math.round(pct) : pct.toFixed(1)}% of ${String(basis).toLowerCase()}`; };
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
            ...(() => {
              // A funnel is a chart: each stage's name and count, and what it kept, are read off it as data labels are
              // (furniture), measured in the band beside the stage and refused where the band is too low for them.
              const labelFrame = { x: frame.x + plotWidth + 12, y: frame.y + index * height + 3, width: frame.width - plotWidth - 12, height: height - 6 };
              const rate = index > 0 && rates !== "none" ? rateText(index) : null;
              const data = rate ? { rate: share(index), basis: rates } : {};
              const name = setText("datum", `${stage.label}  ${stage.value}`, labelFrame.width, { bold: true });
              const under = rate ? setText("legend", rate, labelFrame.width) : null;
              // The rate takes the line under the label where the stage's band holds both, else it follows the value in brackets.
              if (under && name.height + under.height <= labelFrame.height + 0.01) {
                const top = labelFrame.y + (labelFrame.height - name.height - under.height) / 2;
                return [drawText(stableId(id, "label", index), "funnel-label", { ...labelFrame, y: top }, name, { color: INK }),
                  drawText(stableId(id, "rate", index), "funnel-rate", { ...labelFrame, y: top + name.height }, under, { data })];
              }
              const one = rate ? setText("datum", `${stage.label}  ${stage.value} (${rate})`, labelFrame.width, { bold: true }) : name;
              if (one.height > labelFrame.height + 0.01) throw new Error(`Funnel stage "${stage.label}" needs ${Math.ceil(one.height)}px for its label and its band has ${Math.floor(labelFrame.height)}px; shorten the stage's name, use fewer stages, or give the funnel more height`);
              return [drawText(stableId(id, "label", index), "funnel-label", { ...labelFrame, y: labelFrame.y + (labelFrame.height - one.height) / 2 }, one, { color: INK, data })];
            })()
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
    definition.tokens = [...new Set([...definition.tokens, ...TEXT_ROLE_TOKENS])];
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
