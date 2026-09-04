import { SLIDE, absolute, compileDeck, component } from "./core.mjs";
import { REGISTRY } from "./registry.mjs";

const fullFrame = { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height };
const at = (id, componentId, frame, props) => component({ id, component: componentId, frame, props });
const chrome = (title, pageNumber, overrides = {}) => ({
  title,
  // These source-reference pages explicitly use ruled titles; production defaults remain line-free.
  titleVariant: "with-line",
  pageTemplate: { rules: "bottom", sourcePlacement: "separate" },
  source: "Source: x.x",
  footerLeft: "Report title",
  footerRight: "Company Name",
  pageNumber,
  ...overrides
});

function analytical({ id, sourceSlide, visualFamily, capabilities, title, pageNumber, children, chromeOverrides = {} }) {
  return {
    id,
    sourceSlide,
    visualFamily,
    capabilities,
    chrome: chrome(title, pageNumber, chromeOverrides),
    frame: fullFrame,
    composition: absolute({ id: `${id}-composition`, children })
  };
}

export function goldenFixtureSpecs() {
  return [
    {
      id: "golden-cover",
      sourceSlide: 1,
      visualFamily: "cover",
      capabilities: ["cover"],
      frame: fullFrame,
      composition: absolute({ id: "cover-composition", children: [at("cover", "cover", fullFrame, {
        title: "Business & Consulting\nToolkit",
        subtitle: "Powerful templates with a library of best-practice slide layouts,\nchart examples, frameworks and more",
        brand: "Slideworks"
      })] })
    },
    analytical({
      id: "golden-chart-rail",
      sourceSlide: 2,
      visualFamily: "chart-and-takeaway-rail",
      capabilities: ["slide-chrome", "chart.column", "content-rail"],
      title: "[Columns chart with split growth and takeaways / insert action title]",
      pageNumber: 2,
      children: [
        at("description", "chart-title", { x: 60, y: 174, width: 760, height: 68 }, { heading: "Description]" }),
        at("chart", "chart.column", { x: 60, y: 224, width: 760, height: 390 }, {
          categories: ["2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023"],
          series: [{ name: "Column", values: [100, 108, 116, 114, 120, 128, 134, 134, 156] }],
          yMax: 180,
          dataLabels: true,
          annotations: [],
          highlights: [],
          referenceLines: []
        }),
        at("rail", "content-rail", { x: 842, y: 156, width: 378, height: 480 }, {
          treatment: "open",
          dividerLeft: true,
          heading: "Key takeaway/(Insert key takeaway)",
          items: ["(Text key)(Set as 1~max key takeaway)", "(Text key)(Set as 1~max key takeaway)", "(Text key)(Set as 1~max key takeaway)", "..."]
        })
      ]
    }),
    analytical({
      id: "golden-stacked-and-narrative",
      sourceSlide: 3,
      visualFamily: "narrative-and-stacked-chart",
      capabilities: ["slide-chrome", "panel", "chart.stacked-column"],
      title: "[Bar chart with descriptions / Insert action title]",
      pageNumber: 3,
      children: [
        at("stacked-label", "paragraph", { x: 60, y: 190, width: 310, height: 28 }, { text: "[Stacked bars]" }),
        at("narrative-a", "panel", { x: 60, y: 236, width: 300, height: 120 }, { tone: "primary", heading: "[Stackings] category [1]", text: "[insert description]" }),
        at("narrative-b", "panel", { x: 60, y: 384, width: 300, height: 120 }, { tone: "muted", heading: "[Stackings] category [2]", text: "[insert description]" }),
        at("narrative-c", "panel", { x: 60, y: 532, width: 300, height: 116 }, { tone: "dark", heading: "[Stackings] category [3]", text: "[insert description]" }),
        at("connector", "connector", { x: 368, y: 386, width: 68, height: 68 }, { label: "" }),
        at("axis-label", "paragraph", { x: 478, y: 190, width: 160, height: 54 }, { text: "[Axis]\n[unit]" }),
        at("chart", "chart.stacked-column", { x: 458, y: 230, width: 762, height: 406 }, {
          categories: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"],
          series: [{ name: "Category 3", values: [3, 9, 12, 20, 21] }, { name: "Category 2", values: [1, 4, 12, 20, 27] }, { name: "Category 1", values: [2, 4, 10, 14, 19] }],
          yMax: 90,
          legend: false,
          dataLabels: true,
          annotations: [],
          highlights: [],
          referenceLines: []
        })
      ]
    }),
    analytical({
      id: "golden-line-annotations",
      sourceSlide: 4,
      visualFamily: "line-with-top-annotations",
      capabilities: ["slide-chrome", "chart.line"],
      title: "[Line chart with insights / insert action title]",
      pageNumber: 4,
      children: [
        at("highlights", "highlight-strip", { x: 160, y: 176, width: 1040, height: 116 }, { items: [1, 2, 3, 4, 5].map((number) => ({ number: String(number), heading: "Start highlight", description: "[Insert description]" })) }),
        at("chart", "chart.line", { x: 60, y: 304, width: 1160, height: 318 }, {
        categories: ["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2027", "2028", "2029"],
        series: [{ name: "Value", values: [25, 100, 34, 60, 10, 25, 100, 36, 69, 28] }],
        yMax: 120,
        dataLabels: false,
        annotations: [],
        pointHighlights: [{ category: "2020", label: "1" }, { category: "2022", label: "2" }, { category: "2024", label: "3" }, { category: "2025", label: "4" }, { category: "2029", label: "5" }],
        highlights: [],
        referenceLines: []
      })]
    }),
    analytical({
      id: "golden-scatter-rail",
      sourceSlide: 5,
      visualFamily: "scatter-and-takeaway-rail",
      capabilities: ["slide-chrome", "chart.scatter", "content-rail"],
      title: "[Scatter plot with takeaways / insert action title]",
      pageNumber: 5,
      children: [
        at("description", "chart-title", { x: 60, y: 184, width: 770, height: 52 }, { heading: "[Description]" }),
        at("scatter", "chart.scatter", { x: 60, y: 232, width: 770, height: 390 }, {
          points: [{ name: "Player Y", x: 1400, y: 2300 }, { name: "Player X", x: 2000, y: 1200 }, { name: "Player", x: 2700, y: 2750 }, { name: "Player W", x: 2750, y: 1350 }, { name: "Player Z", x: 2750, y: 700 }, { name: "Player B", x: 3150, y: 1550 }, { name: "Player S", x: 4400, y: 1500 }, { name: "Player t", x: 4550, y: 1400 }, { name: "Player 1", x: 5600, y: 2800 }, { name: "Player I", x: 7200, y: 2800 }],
          xMin: 0,
          xMax: 8000,
          yMin: 0,
          yMax: 3000,
          annotations: []
        }),
        at("rail", "content-rail", { x: 840, y: 166, width: 380, height: 456 }, { treatment: "open", dividerLeft: true, heading: "[Key takeaways/conclusion]", items: ["[Key takeaway/conclusion point supported takeaway]", "[Key takeaway/conclusion point supported takeaway]", "[Key takeaway/conclusion point supported takeaway]", "..."] })
      ]
    }),
    analytical({
      id: "golden-structured-rows",
      sourceSlide: 6,
      visualFamily: "structured-rows",
      capabilities: ["slide-chrome", "trend-rows"],
      title: "[Three key trends slide / insert actions title]",
      pageNumber: 6,
      children: [at("rows", "trend-rows", { x: 60, y: 174, width: 1160, height: 456 }, {
        columns: ["Trend", "Description", "Examples"],
        rows: [
          ["[Trend 1]", "•  [Short description of trend in 2-4 bullet points]\n•  [Short description of trend in 2-4 bullet points]\n•  [Short description of trend in 2-4 bullet points]", "•  [Select examples]"],
          ["[Trend 2]", "•  [Short description of trend in 2-4 bullet points]\n•  [Short description of trend in 2-4 bullet points]\n•  [Short description of trend in 2-4 bullet points]", "•  [Select examples]"],
          ["[Trend 3]", "•  [Short description of trend in 2-4 bullet points]\n•  [Short description of trend in 2-4 bullet points]\n•  [Short description of trend in 2-4 bullet points]", "•  [Select examples]"]
        ]
      })]
    }),
    analytical({
      id: "golden-process",
      sourceSlide: 99,
      visualFamily: "chevron-process",
      capabilities: ["slide-chrome", "chevron-process"],
      title: "[Process overview / insert action title]",
      pageNumber: 7,
      children: [at("process", "chevron-process", { x: 60, y: 204, width: 1160, height: 330 }, {
        items: [
          { heading: "Phase 1", label: "Insert phase name", details: ["[insert key activity]", "[insert key activity]", "[insert key activity]", "[insert key activity]", "[insert key activity]", "..."] },
          { heading: "Phase 2", label: "Insert phase name", details: ["[insert key activity]", "[insert key activity]", "[insert key activity]", "[insert key activity]", "[insert key activity]", "..."] },
          { heading: "Phase 3", label: "Insert phase name", details: ["[insert key activity]", "[insert key activity]", "[insert key activity]", "[insert key activity]", "[insert key activity]", "..."] },
          { heading: "Phase 4", label: "Insert phase name", details: ["[insert key activity]", "[insert key activity]", "[insert key activity]", "[insert key activity]", "[insert key activity]", "..."] },
          { heading: "Phase 5", label: "Insert phase name", details: ["[insert key activity]", "[insert key activity]", "[insert key activity]", "[insert key activity]", "[insert key activity]", "..."] }
        ]
      })]
    }),
    analytical({
      id: "golden-organization",
      sourceSlide: 8,
      visualFamily: "organization-network",
      capabilities: ["slide-chrome", "organization"],
      title: "[Organisational chart / Insert action title]",
      pageNumber: 8,
      children: [at("organization", "organization", { x: 60, y: 176, width: 1160, height: 470 }, {
        nodes: [
          { id: "left-1", label: "Parent/Board", x: 0, y: 0.04, width: 0.14, height: 0.15, tone: "dark" },
          { id: "left-2", label: "Parent/Board", x: 0, y: 0.25, width: 0.14, height: 0.15, tone: "dark" },
          { id: "left-3", label: "Parent/Board", x: 0, y: 0.46, width: 0.14, height: 0.15, tone: "dark" },
          { id: "left-4", label: "Parent/Board", x: 0, y: 0.67, width: 0.14, height: 0.15, tone: "dark" },
          { id: "root", label: "Parent/Board", x: 0.51, y: 0.04, width: 0.14, height: 0.15, tone: "primary" },
          { id: "a", label: "Parent/Board", x: 0.34, y: 0.25, width: 0.14, height: 0.15, tone: "primary" },
          { id: "b", label: "Parent/Board", x: 0.51, y: 0.25, width: 0.14, height: 0.15, tone: "primary" },
          { id: "c", label: "Parent/Board", x: 0.68, y: 0.25, width: 0.14, height: 0.15, tone: "primary" },
          { id: "d", label: "Parent/Board", x: 0.85, y: 0.25, width: 0.14, height: 0.15, tone: "primary" },
          { id: "a1", label: "Parent/Board", x: 0.16, y: 0.46, width: 0.14, height: 0.15, tone: "primary" },
          { id: "a2", label: "Parent/Board", x: 0.16, y: 0.67, width: 0.14, height: 0.13 },
          { id: "a3", label: "Parent/Board", x: 0.16, y: 0.82, width: 0.14, height: 0.13 },
          { id: "b1", label: "Parent/Board", x: 0.34, y: 0.46, width: 0.14, height: 0.15 },
          { id: "c1", label: "Parent/Board", x: 0.51, y: 0.46, width: 0.14, height: 0.15 },
          { id: "c2", label: "Parent/Board", x: 0.51, y: 0.67, width: 0.14, height: 0.13 },
          { id: "c3", label: "Parent/Board", x: 0.68, y: 0.67, width: 0.14, height: 0.13 },
          { id: "c4", label: "Parent/Board", x: 0.68, y: 0.82, width: 0.14, height: 0.13 },
          { id: "d1", label: "Parent/Board", x: 0.85, y: 0.67, width: 0.14, height: 0.13 }
        ],
        connectors: [
          { from: "root", to: "a" }, { from: "root", to: "b" }, { from: "root", to: "c" },
          { from: "a", to: "a1" }, { from: "a1", to: "a2" }, { from: "a1", to: "a3" },
          { from: "b", to: "b1" }, { from: "b", to: "c3" },
          { from: "c", to: "c1" }, { from: "c1", to: "c2" }, { from: "c", to: "c3" }, { from: "c", to: "c4" },
          { from: "d", to: "d1" }
        ]
      })]
    }),
    analytical({
      id: "golden-table",
      sourceSlide: 10,
      visualFamily: "dense-table",
      capabilities: ["slide-chrome", "table"],
      title: "[Customer analysis slide / insert actions title]",
      pageNumber: 10,
      children: [
        at("subtitle", "paragraph", { x: 60, y: 150, width: 1160, height: 38 }, { text: "Customer segments and key characteristics" }),
        at("table", "table", { x: 60, y: 188, width: 1160, height: 456 }, {
        columns: ["Segment", "Markers or instance type", "Number of customers", "Sales per year", "H-2", "H-1", "H"],
        columnWidths: [0.11, 0.22, 0.15, 0.15, 0.15, 0.12, 0.10],
        headerTone: "dark",
        alternating: false,
        rows: [
          ["Segment 1", "•  [Placeholder]\n•  ...\n•  ...", "–", "–", "–", "–", "●"],
          ["Segment 2", "•  [Placeholder]\n•  ...\n•  ...", "–", "–", "–", "–", "◕"],
          ["Segment 3", "•  [Placeholder]\n•  ...\n•  ...", "–", "–", "–", "–", "◑"],
          ["Segment 4", "•  [Placeholder]\n•  ...\n•  ...", "–", "–", "–", "–", "◔"]
        ]
      })]
    }),
    analytical({
      id: "golden-rollout",
      sourceSlide: 11,
      visualFamily: "phased-rollout",
      capabilities: ["slide-chrome", "initiative-rollout"],
      title: "We plan to roll out the initiatives over next xx [years/months]",
      pageNumber: 11,
      children: [at("rollout", "initiative-rollout", { x: 60, y: 188, width: 1160, height: 452 }, {
        years: ["20xx", "20xx", "20xx"],
        rows: ["A", "B", "C", "D"].map((label) => ({ label, phases: ["phase1: e.g. a set of particular initiatives\n(execution focus)", "phase2: e.g. a set of particular initiatives\n(execution focus)", "phase3: e.g. a set of particular initiatives\n(execution focus)"] }))
      })]
    }),
    {
      id: "golden-divider",
      sourceSlide: 12,
      visualFamily: "section-divider",
      capabilities: ["section-divider"],
      frame: fullFrame,
      composition: absolute({ id: "divider-composition", children: [at("divider", "section-divider", fullFrame, { number: "Appendix A", title: "Common frameworks and tools used in\nmanagement consulting", footerRight: "Company Name     01", dividerRule: true, pageTemplate: { rules: "bottom" } })] })
    },
    analytical({
      id: "golden-text",
      sourceSlide: 14,
      visualFamily: "text-led-list",
      capabilities: ["slide-chrome", "paragraph", "bullet-list"],
      title: "Objectives of this template",
      pageNumber: 14,
      chromeOverrides: { footerRight: "Template overview" },
      children: [
        at("intro", "paragraph", { x: 60, y: 166, width: 1160, height: 86 }, { text: "The Business & Consulting Toolkit includes a library of ready-to-use best-practice slides, frameworks, and tools developed to help you:" }),
        at("list", "bullet-list", { x: 60, y: 266, width: 1160, height: 326 }, { items: ["Quickly create professional-looking slides", "Find inspiration for slide layouts and designs", "Present analyses and data in the most compelling way", "Access common frameworks and tools", "Structure a clear answer and storyline"] })
      ]
    }),
    analytical({
      id: "golden-matrix",
      sourceSlide: 160,
      visualFamily: "prioritization-matrix",
      capabilities: ["slide-chrome", "matrix", "legend"],
      title: "[Prioritization or assessment matrix / insert action title]",
      pageNumber: 13,
      children: [
        at("legend", "legend", { x: 560, y: 154, width: 620, height: 34 }, { items: ["Short-term / quick", "Medium-term / gradual", "Long-term / transformational"] }),
        at("matrix", "matrix", { x: 90, y: 188, width: 1100, height: 420 }, {
          bubbles: true,
          highlightQuadrant: "topRight",
          points: [
            { label: "A", x: 0.31, y: 0.8, state: "positive", size: 74 },
            { label: "B", x: 0.43, y: 0.79, state: "positive", size: 80 },
            { label: "C", x: 0.67, y: 0.56, state: "caution", size: 78 },
            { label: "D", x: 0.82, y: 0.39, state: "negative", size: 80 },
            { label: "E", x: 0.93, y: 0.72, state: "positive", size: 76 },
            { label: "F", x: 0.27, y: 0.2, state: "caution", size: 78 },
            { label: "G", x: 0.58, y: 0.32, state: "positive", size: 76 },
            { label: "H", x: 0.93, y: 0.18, state: "caution", size: 74 }
          ]
        })
      ]
    }),
    analytical({
      id: "golden-waterfall",
      sourceSlide: 43,
      visualFamily: "waterfall",
      capabilities: ["slide-chrome", "chart.waterfall"],
      title: "[Waterfall chart / insert action title]",
      pageNumber: 14,
      children: [at("waterfall", "chart.waterfall", { x: 60, y: 170, width: 1160, height: 448 }, {
        categories: ["Segment 1", "Segment 2", "Segment 3", "Segment 4", "Segment 5", "Segment 6", "Segment 7", "Total"],
        values: [40, 30, 25, 20, 15, 8, 4, 142],
        yMax: 160,
        totals: [0, 7],
        annotations: [],
        highlights: [],
        referenceLines: []
      })]
    }),
    analytical({
      id: "golden-pie",
      sourceSlide: 70,
      visualFamily: "pie-and-takeaways",
      capabilities: ["slide-chrome", "chart.pie", "content-rail"],
      title: "[Single pie chart / insert action title]",
      pageNumber: 15,
      children: [
        at("description", "chart-title", { x: 60, y: 188, width: 770, height: 52 }, { heading: "[Description]" }),
        at("pie", "chart.pie", { x: 60, y: 230, width: 770, height: 390 }, { labels: ["Category 1", "Category 2", "Category 3", "Category 4"], values: [25, 25, 25, 25], legend: true }),
        at("rail", "content-rail", { x: 840, y: 170, width: 380, height: 460 }, { treatment: "open", dividerLeft: true, heading: "[Key takeaways/conclusion]", items: ["[Short description and most important takeaway]", "[Short description and most important takeaway]", "[Short description and most important takeaway]", "..."] })
      ]
    }),
    analytical({
      id: "golden-donut",
      sourceSlide: 96,
      visualFamily: "donut-and-takeaways",
      capabilities: ["slide-chrome", "chart.donut", "content-rail"],
      title: "[Single doughnut chart / Insert action title]",
      pageNumber: 16,
      children: [
        at("description", "chart-title", { x: 60, y: 188, width: 770, height: 52 }, { heading: "[Description]" }),
        at("donut", "chart.donut", { x: 60, y: 230, width: 770, height: 390 }, { labels: ["Category 1", "Category 2", "Category 3", "Category 4"], values: [25, 25, 25, 25], legend: true }),
        at("rail", "content-rail", { x: 840, y: 170, width: 380, height: 460 }, { treatment: "open", dividerLeft: true, heading: "[Key takeaways]", items: ["[Key takeaway and most important takeaway]", "[Key takeaway and most important takeaway]", "[Key takeaway and most important takeaway]", "..."] })
      ]
    }),
    analytical({
      id: "golden-map",
      sourceSlide: 174,
      visualFamily: "map-and-takeaways",
      capabilities: ["slide-chrome", "map", "content-rail"],
      title: "[World map with Harvey Balls / insert action title]",
      pageNumber: 17,
      children: [
        at("map", "map", { x: 60, y: 180, width: 880, height: 430 }, { markers: [{ x: 0.11, y: 0.43, fraction: 0.75 }, { x: 0.29, y: 0.7, fraction: 0.25 }, { x: 0.48, y: 0.38, fraction: 1 }, { x: 0.59, y: 0.28, fraction: 0.5 }, { x: 0.74, y: 0.62, fraction: 0.5 }, { x: 0.81, y: 0.38, fraction: 0.25 }, { x: 0.86, y: 0.78, fraction: 0.75 }] }),
        at("rail", "content-rail", { x: 952, y: 184, width: 268, height: 420 }, { heading: "Key takeaway", items: ["Short description and read-out takeaway", "Short description and read-out takeaway", "Short description and read-out takeaway"] })
      ]
    }),
    analytical({
      id: "golden-roadmap",
      sourceSlide: 140,
      visualFamily: "wave-roadmap",
      capabilities: ["slide-chrome", "roadmap"],
      title: "[Project] will be built in four main waves",
      pageNumber: 18,
      children: [at("roadmap", "roadmap", { x: 60, y: 202, width: 1160, height: 420 }, { variant: "wave-columns", items: [
        { range: "[MONTH RANGE]", heading: "Wave 1\n(Insert heading e.g. Core to foundations logic)", activities: ["Insert key activity", "Insert key activity", "Insert key activity"], deliverables: ["Insert main deliverable\nand/or indicator to be met"] },
        { range: "[MONTH RANGE]", heading: "Wave 2\n(Insert heading)", activities: ["Insert key activity", "Insert key activity", "Insert key activity"], deliverables: ["Insert main deliverable\nand/or indicator to be met"] },
        { range: "[MONTH RANGE]", heading: "Wave 3\n(Insert heading)", activities: ["Insert key activity", "Insert key activity", "Insert key activity"], deliverables: ["Insert main deliverable\nand/or indicator to be met"] },
        { range: "[MONTH RANGE]", heading: "Wave 4\n(Insert heading)", activities: ["Insert key activity", "Insert key activity", "Insert key activity"], deliverables: ["Insert main deliverable\nand/or indicator to be met"] }
      ] })]
    })
  ];
}

export function buildGoldenDeck() {
  const specs = goldenFixtureSpecs();
  const deck = compileDeck({ id: "consulting-toolkit-golden", palette: "consulting-toolkit", slides: specs }, REGISTRY);
  return {
    deck,
    fixtures: specs.map((spec, index) => ({
      id: spec.id,
      slide: index + 1,
      sourceSlide: spec.sourceSlide,
      visualFamily: spec.visualFamily,
      capabilities: spec.capabilities
    }))
  };
}
