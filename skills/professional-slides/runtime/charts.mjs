// The chart catalogue: every chart the registry draws - its renderer, sample
// and the marks it draws and refuses (chart-decorations.mjs) - its examples,
// and `registerCharts`, which registers each one as a component. The charts
// themselves live in their own modules:
//
//   chart-axes.mjs         the tokens, plot frame, value scale and axes every chart shares
//   chart-decorations.mjs  reference lines, highlights, periods and events, callouts, data labels
//   chart-categorical.mjs  column, bar, stacked column and stacked bar
//   chart-line.mjs         line, area, sparse line and combo
//   chart-specialty.mjs    waterfall, waffle, bubble grid, marimekko and range
//   chart-scatter-pie.mjs  scatter, bubble, pie and donut
//   charts-extra.mjs       slope, lollipop, dumbbell, bullet, treemap, radar, box plot, ...
//
// The re-exports keep this module's import path for the names the evals read here.
import { stableId } from "./core.mjs";
import { LEGEND_TOKENS } from "./legends.mjs";
import { EXTRA_CHARTS } from "./charts-extra.mjs";
import { CHART_GUIDANCE } from "./guidance.mjs";
import { HORIZONS_SAMPLE, HORIZONS_TOKENS, HORIZONS_VARIANTS, renderHorizons, resolveHorizonsVariant } from "./horizons.mjs";
import { evidenceTreatment, releasedEvidenceProps, packedEvidenceProps } from "./chart-annotations.mjs";
import { SERIES, MARK_WEIGHT_TOKENS } from "./chart-axes.mjs";
import { CATEGORY_DECORATIONS, refuseUndrawn } from "./chart-decorations.mjs";
import { categoricalChart } from "./chart-categorical.mjs";
import { lineChart, comboChart } from "./chart-line.mjs";
import { waterfall, waffleLayout, waffleChart, bubbleGridLayout, bubbleGrid, marimekkoLayout, marimekko, rangeChart } from "./chart-specialty.mjs";
import { scatter, PART_TO_WHOLE_VARIANTS, resolvePartToWholeVariant, partToWhole } from "./chart-scatter-pie.mjs";
export { BAR_HEADROOM, axes, chartFrame, numericBounds, tickCount, topBand } from "./chart-axes.mjs";
export { CHART_DECORATIONS, normalizeEvents, normalizePeriods, periodBandHeight } from "./chart-decorations.mjs";
export { defaultFocusIndex } from "./chart-categorical.mjs";
export { lineLabelSides } from "./chart-line.mjs";
export { logoFrame } from "./media.mjs";

const chartDefinitions = [
  {
    id: "chart.column", render: (context) => categoricalChart(context), draws: [...CATEGORY_DECORATIONS, "focusSeries"],
    sample: { categories: ["2023", "2024", "2025", "2026"], series: [{ name: "value", values: [32, 46, 61, 74] }], highlights: [{ category: "2026" }], annotations: [], referenceLines: [{ value: 60, label: "Target" }] }
  },
  {
    id: "chart.bar", render: (context) => categoricalChart({ ...context, horizontal: true }), draws: ["annotations", "referenceLines", "highlights", "changeAnnotations", "focusSeries"], refuses: ["periods", "events", "annotationRail"],
    sample: { categories: ["North", "West", "South", "East"], series: [{ name: "value", values: [74, 62, 48, 35] }], highlights: [{ category: "North" }], annotations: [{ category: "North", text: "Scale leader" }] }
  },
  {
    id: "chart.stacked-column", render: (context) => categoricalChart({ ...context, stacked: true }), draws: CATEGORY_DECORATIONS, refuses: ["focusSeries"],
    sample: { categories: ["2024", "2025", "2026"], series: [{ name: "Core", values: [30, 32, 35] }, { name: "Growth", values: [12, 20, 30] }, { name: "New", values: [5, 9, 14] }], annotations: [{ series: "New", category: "2026", text: "New scales" }] }
  },
  {
    id: "chart.stacked-bar", render: (context) => categoricalChart({ ...context, horizontal: true, stacked: true }), draws: ["annotations", "referenceLines", "highlights", "changeAnnotations"], refuses: ["focusSeries", "periods", "events", "annotationRail"],
    sample: { categories: ["Segment A", "Segment B", "Segment C"], series: [{ name: "Core", values: [45, 35, 25] }, { name: "Growth", values: [35, 40, 45] }, { name: "New", values: [20, 25, 30] }] }
  },
  {
    id: "chart.line", render: (context) => lineChart(context), draws: [...CATEGORY_DECORATIONS, "focusSeries", "pointHighlights"],
    sample: { categories: ["Q1", "Q2", "Q3", "Q4"], series: [{ name: "Actual", values: [22, 31, 43, 55] }, { name: "Plan", values: [25, 34, 42, 48] }], highlights: [{ category: "Q4" }], annotations: [{ series: "Actual", category: "Q4", text: "Ahead of plan" }] }
  },
  {
    id: "chart.area", render: (context) => lineChart({ ...context, area: true }), draws: [...CATEGORY_DECORATIONS, "focusSeries", "pointHighlights"],
    sample: { categories: ["Jan", "Feb", "Mar", "Apr", "May"], series: [{ name: "value", values: [18, 28, 34, 47, 59] }], annotations: [{ category: "May", text: "Demand builds" }] }
  },
  {
    id: "chart.waterfall", render: waterfall, draws: CATEGORY_DECORATIONS,
    sample: { categories: ["Start", "Price", "Volume", "Cost", "End"], values: [80, 18, 12, -9, 101], totals: [0, 4], annotations: [{ category: "End", text: "+21 net" }] }
  },
  {
    id: "chart.scatter", render: (context) => scatter(context), draws: ["annotations", "referenceLines", "highlights", "changeAnnotations", "focus"], refuses: ["annotationRail"],
    sample: { points: [{ name: "A", x: 20, y: 36 }, { name: "B", x: 42, y: 58 }, { name: "C", x: 68, y: 74 }, { name: "D", x: 82, y: 44 }], annotations: [{ category: "C", text: "Best position" }] }
  },
  {
    id: "chart.bubble", render: (context) => scatter({ ...context, bubble: true }), draws: ["annotations", "referenceLines", "highlights", "changeAnnotations", "focus"], refuses: ["annotationRail"],
    sample: { points: [{ name: "A", x: 18, y: 38, size: 12 }, { name: "B", x: 43, y: 66, size: 36 }, { name: "C", x: 72, y: 76, size: 58 }, { name: "D", x: 84, y: 42, size: 20 }] }
  },
  {
    id: "chart.pie", render: (context) => partToWhole(context), draws: [], refuses: ["changeAnnotations", "annotationRail"],
    sample: { labels: ["Direct", "Partner", "Digital", "Other"], values: [42, 28, 18, 12] }
  },
  {
    id: "chart.donut", render: (context) => partToWhole({ ...context, donut: true }), draws: [], refuses: ["changeAnnotations", "annotationRail"],
    sample: { labels: ["Core", "Growth", "New"], values: [52, 31, 17] }
  },
  {
    id: "chart.marimekko", render: marimekko, draws: ["annotations", "highlights"],
    sample: { heading: "(Insert measure and population)", categories: ["Retail", "Corporate", "Wealth", "Markets"], series: [{ name: "Domestic", values: [42, 30, 12, 8] }, { name: "International", values: [18, 25, 10, 22] }], unit: "$B" }
  },
  {
    id: "chart.bubble-grid", render: bubbleGrid, draws: ["highlights"],
    sample: { heading: "(Insert measure and population)", rows: ["Mega banks", "Super regionals", "Core regionals", "Other"], columns: ["Ideation", "Concept", "Pilot", "Deployed"], values: [[30, 9, 9, 4], [15, 12, 9, 6], [54, 13, 13, 6], [8, 9, 9, 0]], unit: "Number of use cases" }
  },
  {
    id: "chart.waffle", render: waffleChart, draws: ["highlights"],
    sample: { heading: "(Insert measure and population)", categories: ["Underwriting", "Credit applications", "Portfolio monitoring", "Controls and reporting"], series: [{ name: "Respondents", values: [38, 42, 58, 42] }], unit: "Number of respondents" }
  },
  {
    id: "chart.range", render: rangeChart, draws: ["annotations", "referenceLines", "highlights", "changeAnnotations"], refuses: ["annotationRail"],
    sample: { heading: "(Insert measure and population)", categories: ["Research", "Labs", "Core Models", "API Agents"], low: [305, 385, 347, 300], high: [385, 460, 490, 400], unit: "$k", highlights: [{ category: "Core Models", style: "bar" }] }
  },
  {
    id: "chart.combo", render: comboChart, draws: CATEGORY_DECORATIONS,
    sample: { categories: ["2023", "2024", "2025", "2026"], series: [{ name: "Revenue", values: [42, 55, 68, 82] }, { name: "Plan", values: [45, 58, 70, 85] }], annotations: [{ series: "Revenue", category: "2026", text: "Revenue reaches $82m" }] }
  },
  {
    id: "chart.horizons",
    render: renderHorizons,
    draws: [],
    sample: HORIZONS_SAMPLE,
    tokens: HORIZONS_TOKENS
  },
  ...EXTRA_CHARTS.map(({ id, render, sample, draws, refuses }) => ({ id, render, sample, draws, refuses }))
];

function chartExamples(id) {
  if (["chart.column", "chart.bar"].includes(id)) {
    const examples = {
      "single-bar-highlight": { props: { categories: ["Category A", "Category B", "Category C"], series: [{ name: "Measure", values: [48, 72, 56] }], highlights: [{ category: "Category B", style: "bar" }], annotations: [], referenceLines: [] } },
      "region-box-highlight": { props: { categories: ["Category A", "Category B", "Category C"], series: [{ name: "Measure A", values: [52, 68, 74] }, { name: "Measure B", values: [44, 61, 63] }], highlights: [{ category: "Category C", style: "region-box" }], annotations: [], referenceLines: [] } },
      "region-tint-highlight": { props: { categories: ["Category A", "Category B", "Category C"], series: [{ name: "Measure A", values: [52, 68, 74] }, { name: "Measure B", values: [44, 61, 63] }], highlights: [{ category: "Category C", style: "region-tint" }], annotations: [], referenceLines: [] } },
      "two-mark-contrast": { props: { categories: ["Current", "Future"], series: [{ name: "Measure", values: [80, 150] }], highlights: [], annotations: [], referenceLines: [] } },
      "focal-series": { props: { categories: ["Area 1", "Area 2"], series: [{ name: "Baseline", values: [40, 55] }, { name: "Actual", values: [60, 70] }], focusSeries: "Actual", legend: true, dataLabels: true, highlights: [], annotations: [], referenceLines: [] } }
    };
    if (id === "chart.column") {
      Object.assign(examples, {
        "qualitative-interval": { props: { categories: ["Initial estimate", "Revised estimate", "Current estimate"], series: [{ name: "Approximate level", values: [80, 50, 45] }], valueFormat: { prefix: "~" }, dataLabels: true, annotations: [], highlights: [], referenceLines: [], changeAnnotations: [{ style: "interval-label", start: "Initial estimate", end: "Revised estimate", text: "Assumptions revised", basis: "approximate-source-readings", qualification: "Approximate illustrative levels" }] } },
        "multi-row-annotation-rail": { props: { categories: ["Case A", "Case B", "Case C"], series: [{ name: "Value", values: [230,338,459] }], dataLabels: true, annotationRail: { rows: [{ label: "EPS, $", items: [{ category: "Case A", text: "10.48" }, { category: "Case B", text: "12.52" }, { category: "Case C", text: "14.34" }] }, { label: "P/E", items: [{ category: "Case A", text: "22x" }, { category: "Case B", text: "27x" }, { category: "Case C", text: "32x" }] }] }, highlights: [], annotations: [], referenceLines: [] } },
        "wrapped-reference-label": { props: { categories: ["Case A", "Case B", "Case C"], series: [{ name: "Value", values: [231,338,459] }], dataLabels: true, yMax:520, annotations: [], highlights: [], referenceLines: [{ value:335.02, label:"Reference close\n$335.02" }] } },
        "a-vs-b-change": { props: { categories: ["Current", "Future"], series: [{ name: "Measure", values: [80, 150] }], dataLabels: true, highlights: [{ category: "Future", style: "bar" }], annotations: [], changeAnnotations: [{ start: "Current", end: "Future", style: "arrow", text: "+87.5%" }], referenceLines: [] } },
        "grouped-series-change": { props: { categories: ["Area 1", "Area 2", "Area 3"], series: [{ name: "Baseline", values: [24, 22, 35] }, { name: "Future", values: [47, 58, 40] }], focusSeries: "Future", dataLabels: true, highlights: [], annotations: [], changeAnnotations: [
          { start: { category: "Area 1", series: "Baseline" }, end: { category: "Area 1", series: "Future" }, style: "bracket", text: "+23" },
          { start: { category: "Area 2", series: "Baseline" }, end: { category: "Area 2", series: "Future" }, style: "bracket", text: "+36" },
          { start: { category: "Area 3", series: "Baseline" }, end: { category: "Area 3", series: "Future" }, style: "bracket", text: "+5" }
        ], referenceLines: [] } },
        "annotation-rail": { props: { categories: ["2022", "2023", "2024", "2025"], series: [{ name: "Measure", values: [42, 55, 71, 86] }], dataLabels: true, highlights: [], annotations: [], annotationRail: { items: [{ category: "2022", text: "+8%" }, { category: "2023", text: "+13%" }, { category: "2024", text: "+29%" }, { category: "2025", text: "+21%" }] }, referenceLines: [] } }
      });
    }
    return examples;
  }
  if (["chart.stacked-column", "chart.stacked-bar"].includes(id)) {
    const examples = {
      "legend-top-right": { props: { categories: ["2023", "2024", "2025", "2026"], series: [{ name: "Core", values: [34, 38, 43, 48] }, { name: "Recurring", values: [18, 24, 31, 39] }, { name: "New", values: [6, 8, 11, 15] }], legend: true, dataLabels: true, annotations: [], highlights: [], referenceLines: [] } }
    };
    examples["totals-and-secondary-units"] = { props: {
      categories: ["Group A", "Group B"], series: [{name:"Core",values:[24,32]},{name:"Additional",values:[36,28]}],
      dataLabels:true, yMin:0, yMax:80, valueFormat:{suffix:"%"},
      stackTotals:[{category:"Group A",value:60},{category:"Group B",value:60}],
      secondaryLabels:[{category:"Group B",series:"Core",value:32000,unit:"people",valueFormat:{compactUnit:"k",decimals:0}},{category:"Group B",anchor:"stack-total",value:60000,unit:"people",valueFormat:{compactUnit:"k",decimals:0}}],
      annotations:[], highlights:[], referenceLines:[]
    } };
    examples["parenthetical-secondary-units"] = { props: {
      heading:"Workers by scenario", categories:["Group A","Group B"],series:[{name:"Core",values:[24,32]},{name:"Additional",values:[36,28]}],
      dataLabels:true,yMin:0,yMax:80,valueFormat:{suffix:"%"},secondaryLabelStyle:"parenthetical",secondaryUnit:"workers",
      secondaryLabels:[{category:"Group B",series:"Core",value:32000,unit:"workers",valueFormat:{compactUnit:"k",decimals:0}}],annotations:[],highlights:[],referenceLines:[]
    } };
    if(id === "chart.stacked-column") examples["category-groups"] = { props: {
      categories:["Group A","Group B","Group C","Group D"],series:[{name:"Core",values:[20,30,40,50]},{name:"Additional",values:[30,25,20,15]}],
      dataLabels:true,yMin:0,yMax:80,categoryGroups:[{id:"first",label:"First cohort",categories:["Group A","Group B"]},{id:"second",label:"Second cohort",categories:["Group C","Group D"]}],annotations:[],highlights:[],referenceLines:[]
    } };
    if (id === "chart.stacked-column") examples["small-segment-external-label"] = { props: {
      categories:["Late","Midpoint","Early"], series:[{name:"Adopted",values:[2,21,41]},{name:"Remaining",values:[39,39,38]}],
      stackTotals:[{category:"Late",value:41},{category:"Midpoint",value:60},{category:"Early",value:79}],
      dataLabels:true, yMin:0, yMax:80, valueFormat:{suffix:"%"}, annotations:[], highlights:[], referenceLines:[]
    } };
    if (id === "chart.stacked-column") examples["total-construction"] = { props: { categories: ["Current", "Future"], series: [{ name: "Core", values: [40, 46] }, { name: "Growth", values: [22, 38] }, { name: "New", values: [8, 20] }], dataLabels: true, annotations: [], changeAnnotations: [{ start: "Current", end: "Future", style: "construction", text: "+34" }], highlights: [], referenceLines: [] } };
    return examples;
  }
  if (id === "chart.waterfall") return {
    "end-to-end-construction": { props: { categories: ["Opening", "Cost", "Mix", "Capacity", "Closing"], values: [70, -20, -15, -10, 25], totals: [0, 4], yMax: 80, annotations: [], changeAnnotations: [{ start: "Opening", end: "Closing", style: "construction", text: "-45" }], highlights: [], referenceLines: [] } }
  };
  if (id === "chart.line") return {
    "numeric-sparse-observations": { preferredSize: { width: 1160, height: 480 }, props: {
      categories: undefined, heading: "(Insert source-qualified trajectory)", unit: "%", gapPolicy: "explicit-breaks",
      xAxis: { unit: "year", min: 2000, max: 2030, ticks: [{value:2000,label:"2000"},{value:2010,label:"2010"},{value:2020,label:"2020"},{value:2030,label:"2030"}] },
      statusBoundary: { x: 2018, beforeLabel: "Historical", afterLabel: "Modelled" },
      series: [
        { name: "Historical", status: "before", points: [{key:"start",x:2000,y:3},{key:"turn",x:2005,y:5},{key:"resume",x:2014,y:4,breakBefore:true},{key:"boundary",x:2018,y:4.5}] },
        { name: "Scenario", status: "after", points: [{key:"boundary",x:2018,y:4.5},{key:"peak",x:2025,y:6,label:true},{key:"end",x:2030,y:5}] }
      ], yMin: 0, yMax: 8, valueFormat: {decimals:1,prefix:"~",suffix:"%"}, dataLabels: false, legend: true, annotations: [], highlights: [], referenceLines: []
    } },
    "callout-borderless": { props: { categories: ["2021", "2022", "2023", "2024", "2025"], series: [{ name: "Measure", values: [0.8, 1.5, 2.2, 2.6, 3.1] }], yMax: 4, dataLabels: false, legend: false, annotations: [{ category: "2024", text: "Adoption accelerates after launch", treatment: "callout", border: false }], highlights: [], referenceLines: [] } },
    "orthogonal-dot-vertical": { props: { categories: ["Q1", "Q2", "Q3", "Q4"], series: [{ name: "Measure", values: [22, 31, 48, 55] }], yMax: 60, dataLabels: false, legend: false, annotations: [{ category: "Q3", text: "The launch creates a clear inflection", treatment: "orthogonal-dot", orientation: "vertical" }], highlights: [], referenceLines: [] } },
    "long-range-growth": { props: { categories: ["2021", "2022", "2023", "2024", "2025"], series: [{ name: "Measure", values: [0.8, 1.5, 2.2, 2.6, 3.1] }], yMax: 4, dataLabels: true, legend: false, annotations: [], changeAnnotations: [{ start: "2021", end: "2025", style: "bracket", text: "+288%" }], highlights: [], referenceLines: [] } },
    "annotation-rail": { props: { categories: ["2021", "2022", "2023", "2024", "2025"], series: [{ name: "Measure", values: [0.8, 1.5, 2.2, 2.6, 3.1] }], yMax: 4, dataLabels: true, legend: false, annotations: [], annotationRail: { items: [{ category: "2021", text: "N/A" }, { category: "2022", text: "+88%" }, { category: "2023", text: "+47%" }, { category: "2024", text: "+18%" }, { category: "2025", text: "+19%" }] }, highlights: [], referenceLines: [] } },
    "gridlines-for-dense-scale": { props: { categories: ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"], series: [{ name: "Actual", values: [18, 29, 34, 46, 53, 68] }, { name: "Plan", values: [22, 27, 38, 44, 58, 64] }], yMax: 80, gridlines: true, annotations: [], highlights: [], referenceLines: [] } }
  };
  if (id === "chart.scatter") return {
    "orthogonal-dot-horizontal": { props: { points: [{ name: "Priority", x: 76, y: 72 }, { name: "Monitor", x: 18, y: 24 }], xMin: 0, xMax: 100, yMin: 0, yMax: 100, annotations: [{ category: "Priority", text: "Scale the proven priority", treatment: "orthogonal-dot", orientation: "horizontal", side: "left" }], legend: false } },
    "quadrant-lines": { props: { points: [{ name: "Item A", x: 18, y: 76 }, { name: "Item B", x: 34, y: 28 }, { name: "Item C", x: 68, y: 72 }, { name: "Item D", x: 82, y: 34 }], xMin: 0, xMax: 100, yMin: 0, yMax: 100, quadrants: { x: 50, y: 50, style: "threshold-lines", titles: { topLeft: "High value, lower ease", topRight: "Priority", bottomLeft: "Defer", bottomRight: "Quick wins" } }, annotations: [], legend: false } },
    "quadrant-alternating-tint": { props: { points: [{ name: "Item A", x: 18, y: 76 }, { name: "Item B", x: 34, y: 28 }, { name: "Item C", x: 68, y: 72 }, { name: "Item D", x: 82, y: 34 }], xMin: 0, xMax: 100, yMin: 0, yMax: 100, quadrants: { x: 50, y: 50, style: "alternating-tint", titles: { topLeft: "Build", topRight: "Scale", bottomLeft: "Monitor", bottomRight: "Simplify" } }, annotations: [], legend: false } }
  };
  if (id === "chart.bubble") return {
    "size-legend-top-right": { props: { points: [{ name: "Item A", x: 18, y: 38, size: 12 }, { name: "Item B", x: 43, y: 66, size: 36 }, { name: "Item C", x: 72, y: 76, size: 58 }, { name: "Item D", x: 84, y: 42, size: 20 }], xMin: 0, xMax: 100, yMin: 0, yMax: 100, sizeLegend: { label: "Bubble area = relative magnitude", markerSize: 12 }, annotations: [] } },
    "quadrant-focus-tint": { props: { points: [{ name: "Item A", series: "Near term", x: 18, y: 76, size: 14 }, { name: "Item B", series: "Long term", x: 34, y: 28, size: 28 }, { name: "Item C", series: "Near term", x: 68, y: 72, size: 48 }, { name: "Item D", series: "Long term", x: 82, y: 34, size: 20 }], xMin: 0, xMax: 100, yMin: 0, yMax: 100, quadrants: { x: 50, y: 50, style: "focus-tint", focus: "topRight", titles: { topLeft: "Selective", topRight: "Priority", bottomLeft: "Monitor", bottomRight: "Streamline" } }, sizeLegend: { label: "Bubble area = relative magnitude", markerSize: 12 }, annotations: [] } }
  };
  return {};
}

/**
 * Render a chart and let it resolve its own layout conflicts.
 *
 * A renderer that meets a conflict it can fix by laying the chart out again -
 * a callout with no clear position that needs a right-hand rail - throws an
 * error carrying `retry(props)`, the props to render with instead; this loop
 * applies it. A render that succeeds but moved a callout out of the band
 * reserved above the plot renders once more with that band released, keeping
 * the first result if the second cannot be laid out. Errors without `retry`
 * are the author's to fix and pass through unchanged.
 */
function renderResolved(render, context) {
  // A callout tries the plot's own free space first - above a short mark,
  // beside the line, in an empty corner - and reserves a band above the plot
  // only when it finds none there (chart-annotations renderEvidenceAnnotations,
  // `_placement: "plot"`). Each band took 88px off the plot's height: full-width
  // chart pages with two or three callouts filled about two fifths of the page.
  // Peers in a row whose band the composer shares (`calloutBand: "shared"`)
  // keep it, since their plots must stay one height; `calloutBand: "band"`
  // asks for the band outright.
  const inPlot = (item) => item && typeof item === "object" && !item._placement && evidenceTreatment(item) === "callout";
  let props = !["shared", "band"].includes(context.props?.calloutBand) && (context.props?.annotations || []).some(inPlot)
    ? { ...context.props, annotations: context.props.annotations.map((item) => (inPlot(item) ? { ...item, _placement: "plot" } : item)) }
    : context.props;
  let first = null, railed = null, narrow = null;
  const tooNarrow = (error) => /insufficient plot width|Unbreakable text|Column names are wider/.test(error.message);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    let nodes;
    try { nodes = render({ ...context, props }); }
    catch (error) {
      if (typeof error.retry === "function" && attempt < 10) {
        if (/no clear position for the callout/.test(error.message)) railed = error;
        props = error.retry(props); continue;
      }
      if (first) return first;
      // Too narrow for the rail: the note is set on its own bar instead, in
      // the annotation face without a box (chart-annotations insidePlacement).
      // The longest bar of a six-bar panel - often the bar the page is about -
      // can have no room past its end and no panel width to spare for a rail.
      if (railed && !narrow && (tooNarrow(error) || /no clear position for the callout/.test(error.message))) {
        narrow = error;
        props = { ...props, annotations: (props.annotations || []).map((item) => (item?._placement === "rail" ? { ...item, _placement: "on-bar" } : item)) };
        continue;
      }
      // The rail a callout asked for can narrow the plot until something else
      // fails - "insufficient plot width" on a bar panel, "Unbreakable text" on
      // a bridge - with an error that does not name the callout that caused
      // it. Report the callout, and why the rail could not hold it in this
      // chart.
      const cause = narrow && tooNarrow(narrow) ? narrow : tooNarrow(error) ? error : null;
      if (railed && cause)
        throw new Error(`${railed.message.replace(/; shorten the note.*$/, "")}: a rail beside the plot leaves it too narrow in this ${Math.round(context.frame?.width ?? 0)}px chart (${cause.message.replace(/[;:].*$/, "")}), and its bar has no room to carry it. Put the note in the commentary or caption, annotate a mark with clear space above or beside it, or give the chart a wider panel`);
      throw error;
    }
    const released = first ? null : releasedEvidenceProps(nodes, props);
    if (released) { first = nodes; props = released; continue; }
    // The callouts still in bands share them where their boxes do not meet
    // across (packedEvidenceProps), and the plot takes back the height of every
    // band that frees. Tried once; a packed layout that does not render keeps
    // this one.
    const packed = packedEvidenceProps(nodes, props);
    if (!packed) return nodes;
    try { return render({ ...context, props: packed }); } catch { return nodes; }
  }
  return first;
}

export function registerCharts(registry) {
  const headingProps = props => ({ heading: props.heading, unit: props.unit, variant: props.titleVariant,
    ...(props.unitPlacement ? { unitPlacement: props.unitPlacement } : {}),
    ...(props.badge ? { badge: props.badge } : {}),
    ...(props.headerBandHeight ? { headerBandHeight: props.headerBandHeight } : {}) });
  for (const chart of chartDefinitions) {
    const examples = chartExamples(chart.id);
    const tokens = [
      "font.body", "type.heading", "type.body", "type.chartLabel", "type.chartAnnotation", "type.compact", "type.label", "type.source", "color.ink", "color.textSecondary",
      "font.bodySemibold", "weight.semibold",
      "color.chartGrid", "color.chartComparator", "color.componentPrimary", "color.componentPrimaryTint", "color.accent", "color.rule",
      "color.canvas", "color.surface", "color.surfaceMuted", "color.onPrimary", "color.negative", "line.hairline", "line.standard", "radius.none", "radius.small", "radius.round", "icon.medium",
      ...SERIES.map((item) => item.tokenId), ...LEGEND_TOKENS, ...MARK_WEIGHT_TOKENS, ...(chart.tokens || []), "color.accent", "color.accentTint", "color.positive", "color.negative", "color.negativeTint", "color.surfaceMuted", "color.onPrimary", "type.compact"
    ];
    registry.set(chart.id, {
      id: chart.id,
      version: "2.6.0",
      category: "chart",
      role: "chart",
      // The marks it draws over its data and the ones its renderer refuses
      // itself (CHART_DECORATIONS); any other is refused at render.
      decorations: Object.freeze({ draws: Object.freeze([...chart.draws]), refuses: Object.freeze([...(chart.refuses || [])]) }),
      tokens: [...new Set([...tokens, ...registry.get("chart-title").tokens])].sort(),
      preferredSize: chart.id === "chart.horizons" ? { width: 1160, height: 460 } : { width: 760, height: 420 },
      sample: chart.sample,
      guidance: CHART_GUIDANCE[chart.id],
      ...(Object.keys(examples).length ? { examples } : {}),
      ...(chart.id === "chart.waterfall" ? { variants: { standard: {}, "negative-close": { props: { categories: ["Operating cash", "Capex", "Free cash flow"], values: [39.069, -44.924, -5.855], totals: [0, 2], yMin: -10, yMax: 50, annotations: [], valueFormat: { decimals: 1 } } } }, defaultVariant: "standard", resolveVariant: props => props.values?.some(value => value < 0) && props.values?.at(-1) < 0 ? "negative-close" : "standard" } : {}),
      ...(chart.id === "chart.line" ? { variants: { standard: {}, "direct-end-labels": { props: { categories: ["Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026"], series: [{ name: "Operating cash", values: [48.414, 52.402, 45.790, 39.069] }, { name: "Capex", values: [23.953, 27.851, 35.674, 44.924] }], yMax: 60, annotations: [], highlights: [], directLabels: "end", valueFormat: { decimals: 1 } } } }, defaultVariant: "standard", resolveVariant: props => props.directLabels === "end" ? "direct-end-labels" : "standard" } : {}),
      ...(["chart.pie", "chart.donut"].includes(chart.id) ? { variants: PART_TO_WHOLE_VARIANTS, defaultVariant: "legend-top-right", variantProp: "variant", resolveVariant: resolvePartToWholeVariant } : {}),
      ...(chart.id === "chart.horizons" ? { variants: HORIZONS_VARIANTS, defaultVariant: "curves", variantProp: "variant", resolveVariant: resolveHorizonsVariant } : {}),
      // Samples belong exclusively to fixtures. Never inject example annotations,
      // targets or data into a production chart with partially supplied props.
      // Row rule: a chart's heading band (heading + unit line) is a ruled header
      // like a section's, so peers beside it take the same band height and the
      // rules line up. The compiler passes the shared height back as headerBandHeight.
      // A waffle's height is its heading band and its block, measured in the
      // frame the block will get: the heading is drawn above the chart's own
      // frame (render, below), and left out the ceiling cut the block short.
      ...(chart.id === "chart.waffle" ? (() => {
        const height = ({ frame, props = {} }) => {
          const heading = String(props.heading ?? "").trim() ? registry.get("chart-title").measureContent({ frame, props: headingProps(props) }).height : 0;
          return heading + waffleLayout({ ...frame, y: frame.y + heading, height: Number.isFinite(frame.height) ? frame.height - heading : frame.height }, props).height;
        };
        return { measureContent: (input) => ({ height: height(input) }), measureCeiling: height };
      })() : {}),
      ...(EXTRA_CHARTS.some((c) => c.id === chart.id) ? { measureContent: ({ frame, props = {} }) => {
        const headingHeight = String(props.heading ?? "").trim()
          ? registry.get("chart-title").measureContent({ frame, props: headingProps(props) }).height : 0;
        return { height: headingHeight + EXTRA_CHARTS.find((c) => c.id === chart.id).layout({ ...frame, height: undefined }, props).height };
      } } : {}),
      ...(chart.id === "chart.marimekko" ? { measureContent: ({ frame, props = {} }) => ({ height: marimekkoLayout(frame, props).height }) } : {}),
      ...(chart.id === "chart.bubble-grid" ? { measureContent: ({ frame, props = {} }) => ({ height: bubbleGridLayout(frame, props).height }) } : {}),
      measureHeader: ({ frame, props = {} }) => {
        if (!String(props.heading ?? "").trim()) return null;
        const layout = registry.get("chart-title").measureHeader({ frame, props: { heading: props.heading, unit: props.unit, variant: props.titleVariant, ...(props.unitPlacement ? { unitPlacement: props.unitPlacement } : {}) } });
        return { top: frame.y, ruled: layout.ruled, height: layout.height };
      },
      render: ({ id, frame, props = {}, tokens }) => {
        refuseUndrawn(chart, props, id, chartDefinitions);
        if (Array.isArray(props.series) && props.series.some(item => item.tone !== undefined)) throw new Error("Chart series cannot use status tone; positive/negative colours belong to short text labels or check/cross icons. Use chart palette series colours for marks.");
        if (!String(props.heading ?? "").trim()) {
          if (String(props.unit ?? "").trim()) throw new Error(`${id}: chart unit requires a nonempty chart heading; render both together or declare both visibly in the parent exhibit`);
          return { nodes: renderResolved(chart.render, { id, frame, tokens, props }) };
        }
        const title = registry.get("chart-title"), titleProps = headingProps(props);
        const height = title.measureContent({ frame, props: titleProps }).height;
        return { nodes: [...title.render({ id: stableId(id, "heading"), frame: { ...frame, height }, props: titleProps, tokens }).nodes, ...renderResolved(chart.render, { id, frame: { ...frame, y: frame.y + height, height: frame.height - height }, tokens, props })] };
      }
    });
  }
  return registry;
}

export const CHART_IDS = Object.freeze(chartDefinitions.map((chart) => chart.id));

