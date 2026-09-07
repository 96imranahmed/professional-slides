import { linePrimitive, stableId, token } from "./core.mjs";
import { legendNodes, LEGEND_TOKENS } from "./legends.mjs";
import { CHART_GUIDANCE } from "./guidance.mjs";

export function assertEquivalentComparisons(props) {
  if (!props.comparison) return;
  if (props.comparison.kind !== "matched" || typeof props.comparison.unit !== "string" || !props.comparison.unit.trim()) throw new Error("Matched comparison requires a shared unit");
  const charts = props.charts || [];
  const signature = chart => {
    const p=chart.props || {}, horizontal=chart.component.endsWith("bar");
    const min=p[horizontal?"xMin":"yMin"], max=p[horizontal?"xMax":"yMax"];
    if (!Number.isFinite(min) || !Number.isFinite(max) || max<=min) throw new Error("Matched comparison requires an explicit common scale");
    return JSON.stringify({component:chart.component,unit:chart.unit || props.comparison.unit,categories:p.categories,min,max,format:p.valueFormat || {},legend:p.legend ?? false,dataLabels:p.dataLabels ?? null});
  };
  const expected=charts.length ? signature(charts[0]) : null;
  for(const chart of charts) if(signature(chart)!==expected) throw new Error("Matched comparison charts must use equivalent encodings, units, categories, periods, scales and label treatments");
}

export function registerChartGroup(registry) {
  const SUPPORTED = [...registry.keys()].filter(id => id.startsWith("chart."));
  registry.set("chart-group", {
    id: "chart-group", version: "2.0.0", category: "data", role: "chart-group",
    tokens: [...new Set(["color.rule", "line.hairline", ...LEGEND_TOKENS, ...SUPPORTED.flatMap(id => registry.get(id).tokens), ...registry.get("chart-title").tokens])],
    preferredSize: { width: 1160, height: 460 },
    guidance: CHART_GUIDANCE["chart-group"],
    sample: { charts: [
      { heading: "Current mix", component: "chart.pie", props: { labels: ["Core", "Growth", "New"], values: [50, 30, 20] } },
      { heading: "Future mix", component: "chart.pie", props: { labels: ["New", "Core", "Growth"], values: [30, 40, 30] } }
    ] },
    render({ id, frame, props, tokens }) {
      assertEquivalentComparisons(props);
      const charts = props.charts;
      if (!Array.isArray(charts) || charts.length < 2 || charts.length > 4) throw new Error("A chart group needs two to four charts");
      if (props.divider !== undefined && typeof props.divider !== "boolean") throw new Error("Chart-group divider must be a boolean");
      if (props.divider && charts.length !== 2) throw new Error("An inter-chart divider is available only for a paired chart group");
      registry.get("chart-group").resolveVariant(props);
      const keysFor = chart => chart.component === "chart.pie" || chart.component === "chart.donut" ? chart.props.labels : chart.props.series?.map(series => series.name);
      for (const chart of charts) if (!SUPPORTED.includes(chart.component) || !chart.props) throw new Error(`Unsupported chart: ${chart.component}`);
      const mode = props.legendMode ?? (charts.every(chart => keysFor(chart)?.length) ? "shared" : "independent");
      if (!["shared", "independent"].includes(mode)) throw new Error("Unknown chart-group legend mode");
      if (mode === "shared" && charts.some(chart => !keysFor(chart)?.length)) throw new Error("Shared legends require keyed categories or series");
      if (mode === "independent" && props.categoryKeys) throw new Error("Independent charts cannot declare a shared category map");
      const used = [...new Set(charts.flatMap(chart => keysFor(chart) || []))];
      const keys = props.categoryKeys || used;
      if (mode === "shared" && (keys.length > 6 || new Set(keys).size !== keys.length || keys.length !== used.length || used.some(key => !keys.includes(key)))) throw new Error("Shared legend must contain each used category exactly once, with at most six categories");
      const showLegend = mode === "shared" && keys.length > 1;
      const legendHeight = showLegend ? 48 : 0;
      const grid = charts.length === 4, columns = grid ? 2 : charts.length;
      const gap = 32, span = (frame.width - gap * (columns - 1)) / columns;
      const cellHeight = grid ? (frame.height - legendHeight - gap) / 2 : frame.height - legendHeight;
      const title = registry.get("chart-title");
      const titleProps = chart => ({ heading: chart.heading, unit: chart.unit, variant: chart.titleVariant });
      const headerBandHeight = Math.max(0, ...charts.filter(chart => chart.heading).map(chart => title.measureContent({ frame: { width: span }, props: titleProps(chart) }).bandHeight));
      const headingHeight = Math.max(0, ...charts.filter(chart => chart.heading).map(chart => title.measureContent({ frame: { width: span }, props: { ...titleProps(chart), headerBandHeight } }).height));
      const nodes = [];
      if (props.divider) {
        const x = frame.x + span + gap / 2;
        nodes.push(linePrimitive({
          id: stableId(id, "divider"),
          role: "chart-group-divider",
          x1: x,
          y1: frame.y + headingHeight + 8,
          x2: x,
          y2: frame.y + frame.height - legendHeight,
          style: { stroke: token("color.rule"), lineWidth: token("line.hairline"), dash: "solid" },
          data: { betweenCharts: [0, 1] }
        }));
      }
      charts.forEach((chart, index) => {
        const childId = stableId(id, "chart", index), x = frame.x + (index % columns) * (span + gap);
        const y = frame.y + (grid ? Math.floor(index / columns) * (cellHeight + gap) : 0);
        if (chart.heading) nodes.push(...title.render({ id: `${childId}-heading`, frame: { x, y, width: span, height: headingHeight }, props: { ...titleProps(chart), headerBandHeight }, tokens }).nodes);
        const part = ["chart.pie", "chart.donut"].includes(chart.component);
        const localKeys = keysFor(chart) || [];
        const sharedProps = mode === "shared" ? { legend: false, ...(part ? {variant:"shared-legend", outsideLabels:false, categoryKeys:keys} : {colorIndices:localKeys.map(key => keys.indexOf(key))}) } : localKeys.length <= 1 ? {legend:false,...(part?{variant:"shared-legend",outsideLabels:false,categoryKeys:localKeys}:{})} : part ? {variant:"outside-labels",outsideLabels:true,legend:false} : {};
        const rendered = registry.get(chart.component).render({ id: childId, frame: { x, y: y + headingHeight, width: span, height: cellHeight - headingHeight }, props: { ...chart.props, ...sharedProps }, tokens });
        for (const node of rendered.nodes) {
          node.data = { ...node.data, chartGroup: id, childChart: childId };
          nodes.push(node);
        }
      });
      if (showLegend) nodes.push(...legendNodes({ id: stableId(id, "shared-legend"), frame: { x: frame.x, y: frame.y + frame.height - 32, width: frame.width, height: 24 }, props: { items: keys, placement: "bottom-center" } }));
      return { nodes };
    }
  });
  const definition = registry.get("chart-group");
  definition.variants = {
    paired: {},
    "four-way": { preferredSize: { width: 1160, height: 570 }, props: { charts: [1,2,3,4].map(i => ({ heading: `Trend ${String.fromCharCode(64 + i)}`, component: "chart.line", props: { categories: ["2023", "2024", "2025"], series: [{ name: "Observed", values: [20+i*5, 30+i*3, 40+i*6] }] } })) } },
    triple: { props: { charts: [...definition.sample.charts, { heading: "Target mix", component: "chart.pie", props: { labels: ["Growth", "New", "Core"], values: [30, 30, 40] } }] } }
  };
  definition.examples = {
    "four-way-mixed": { preferredSize: {width:1160,height:620}, props: {legendMode:"independent",charts:[
      {heading:"Trend",component:"chart.line",props:{categories:["2023","2024","2025"],series:[{name:"Value",values:[30,40,50]}]}},
      {heading:"Category comparison",component:"chart.bar",props:{categories:["A","B","C"],series:[{name:"Value",values:[70,50,30]}]}},
      {heading:"Change bridge",component:"chart.waterfall",props:{categories:["Start","Change","End"],values:[60,20,80],totals:[0,2]}},
      {heading:"Relationship",component:"chart.scatter",props:{points:[{name:"A",x:20,y:30},{name:"B",x:40,y:55},{name:"C",x:70,y:65}]}}
    ]}},
    "paired-donuts": { props: { charts: definition.sample.charts.map(chart => ({ ...chart, component: "chart.donut" })) } },
    "paired-units": { props: { charts: definition.sample.charts.map(chart => ({ ...chart, unit: "Revenue share, %" })) } },
    "paired-columns": { props: { charts: ["Current", "Future"].map(heading => ({ heading, component: "chart.column", props: { categories: ["Q1", "Q2"], series: [{ name: "Core", values: [40, 50] }, { name: "Growth", values: [30, 40] }] } })) } },
    "paired-with-divider": { props: { divider: true } }
  };
  definition.defaultVariant = "paired";
  definition.variantProp = "variant";
  definition.resolveVariant = (props = {}) => {
    const derived = props.charts?.length === 4 ? "four-way" : props.charts?.length === 3 ? "triple" : "paired";
    if (props.variant !== undefined && props.variant !== derived) throw new Error("Chart-group variant must match its chart count");
    return derived;
  };
  return registry;
}
