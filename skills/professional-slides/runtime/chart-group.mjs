import { stableId } from "./core.mjs";
import { legendNodes, LEGEND_TOKENS } from "./legends.mjs";

const SUPPORTED = ["chart.pie", "chart.donut", "chart.column", "chart.bar", "chart.stacked-column", "chart.stacked-bar", "chart.line", "chart.area"];
export function registerChartGroup(registry) {
  registry.set("chart-group", {
    id: "chart-group", version: 1, category: "data", role: "chart-group",
    tokens: [...new Set([...LEGEND_TOKENS, ...SUPPORTED.flatMap(id => registry.get(id).tokens), ...registry.get("chart-title").tokens])],
    preferredSize: { width: 1160, height: 460 },
    sample: { charts: [
      { heading: "Current mix", component: "chart.pie", props: { labels: ["Core", "Growth", "New"], values: [50, 30, 20] } },
      { heading: "Future mix", component: "chart.pie", props: { labels: ["New", "Core", "Growth"], values: [30, 40, 30] } }
    ] },
    render({ id, frame, props, tokens }) {
      const charts = props.charts;
      if (!Array.isArray(charts) || charts.length < 2 || charts.length > 3) throw new Error("A chart group needs two or three charts");
      registry.get("chart-group").resolveVariant(props);
      const keysFor = chart => chart.component === "chart.pie" || chart.component === "chart.donut" ? chart.props.labels : chart.props.series?.map(series => series.name);
      for (const chart of charts) if (!SUPPORTED.includes(chart.component) || !keysFor(chart)?.length) throw new Error(`Unsupported shared-legend chart: ${chart.component}`);
      const used = [...new Set(charts.flatMap(keysFor))];
      const keys = props.categoryKeys || used;
      if (keys.length > 6 || new Set(keys).size !== keys.length || keys.length !== used.length || used.some(key => !keys.includes(key))) throw new Error("Shared legend must contain each used category exactly once, with at most six categories");
      const gap = 32, span = (frame.width - gap * (charts.length - 1)) / charts.length;
      const title = registry.get("chart-title");
      const headerBandHeight = Math.max(0, ...charts.filter(chart => chart.heading).map(chart => title.measureContent({ frame: { width: span }, props: chart }).bandHeight));
      const headingHeight = Math.max(0, ...charts.filter(chart => chart.heading).map(chart => title.measureContent({ frame: { width: span }, props: { ...chart, headerBandHeight } }).height));
      const nodes = [];
      charts.forEach((chart, index) => {
        const childId = stableId(id, "chart", index), x = frame.x + index * (span + gap);
        if (chart.heading) nodes.push(...title.render({ id: `${childId}-heading`, frame: { x, y: frame.y, width: span, height: headingHeight }, props: { heading: chart.heading, unit: chart.unit, headerBandHeight }, tokens }).nodes);
        const part = ["chart.pie", "chart.donut"].includes(chart.component);
        const localKeys = keysFor(chart);
        const rendered = registry.get(chart.component).render({ id: childId, frame: { x, y: frame.y + headingHeight, width: span, height: frame.height - headingHeight - 48 }, props: { ...chart.props, legend: false, ...(part ? { variant: "shared-legend", outsideLabels: false, categoryKeys: keys } : { colorIndices: localKeys.map(key => keys.indexOf(key)) }) }, tokens });
        for (const node of rendered.nodes) {
          node.data = { ...node.data, chartGroup: id, childChart: childId };
          nodes.push(node);
        }
      });
      nodes.push(...legendNodes({ id: stableId(id, "shared-legend"), frame: { x: frame.x, y: frame.y + frame.height - 32, width: frame.width, height: 24 }, props: { items: keys, placement: "bottom-center" } }));
      return { nodes };
    }
  });
  const definition = registry.get("chart-group");
  definition.variants = {
    paired: {},
    triple: { props: { charts: [...definition.sample.charts, { heading: "Target mix", component: "chart.pie", props: { labels: ["Growth", "New", "Core"], values: [30, 30, 40] } }] } }
  };
  definition.examples = {
    "paired-donuts": { props: { charts: definition.sample.charts.map(chart => ({ ...chart, component: "chart.donut" })) } },
    "paired-units": { props: { charts: definition.sample.charts.map(chart => ({ ...chart, unit: "Revenue share, %" })) } },
    "paired-columns": { props: { charts: ["Current", "Future"].map(heading => ({ heading, component: "chart.column", props: { categories: ["Q1", "Q2"], series: [{ name: "Core", values: [40, 50] }, { name: "Growth", values: [30, 40] }] } })) } }
  };
  definition.defaultVariant = "paired";
  definition.variantProp = "variant";
  definition.resolveVariant = (props = {}) => {
    const derived = props.charts?.length === 3 ? "triple" : "paired";
    if (props.variant !== undefined && props.variant !== derived) throw new Error("Chart-group variant must match its chart count");
    return derived;
  };
  return registry;
}
