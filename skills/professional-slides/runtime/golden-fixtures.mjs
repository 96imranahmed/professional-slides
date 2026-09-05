import { SLIDE, absolute, compileDeck, component } from "./core.mjs";
import { REGISTRY } from "./registry.mjs";

const fullFrame = { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height };
const at = (id, componentId, frame, props) => component({ id, component: componentId, frame, props });
const chrome = (title, pageNumber, overrides = {}) => ({
  title,
  // These source-reference pages explicitly use ruled titles; production defaults remain line-free.
  titleVariant: "with-line",
  pageTemplate: { rules: "bottom", sourcePlacement: "separate" },
  source: "Source: (Insert source)",
  footerLeft: "(Insert report title)",
  footerRight: "(Insert company name)",
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
      sourceSlide: null,
      visualFamily: "cover",
      capabilities: ["cover"],
      frame: fullFrame,
      composition: absolute({ id: "cover-composition", children: [at("cover", "cover", fullFrame, {
        title: "(Insert presentation title)",
        subtitle: "(Insert subtitle)"
      })] })
    },
    analytical({
      id: "golden-chart-rail",
      sourceSlide: 2,
      visualFamily: "chart-and-takeaway-rail",
      capabilities: ["slide-chrome", "chart.column", "content-rail"],
      title: "(Insert action title)",
      pageNumber: 2,
      children: [
        at("description", "chart-title", { x: 60, y: 174, width: 760, height: 68 }, { heading: "(Insert chart title)" }),
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
          heading: "(Insert takeaway heading)",
          items: ["(Insert evidence-backed takeaway 1)", "(Insert evidence-backed takeaway 2)", "(Insert evidence-backed takeaway 3)"]
        })
      ]
    }),
    analytical({
      id: "golden-stacked-and-narrative",
      sourceSlide: 3,
      visualFamily: "narrative-and-stacked-chart",
      capabilities: ["slide-chrome", "panel", "connector", "chart.stacked-column"],
      title: "(Insert action title)",
      pageNumber: 3,
      children: [
        at("stacked-label", "paragraph", { x: 60, y: 190, width: 310, height: 28 }, { text: "(Insert category heading)" }),
        at("narrative-a", "panel", { x: 60, y: 236, width: 300, height: 120 }, { seriesKey: "Category 1", seriesColorIndex: 2, heading: "(Insert category 1)", text: "(Insert description)" }),
        at("narrative-b", "panel", { x: 60, y: 384, width: 300, height: 120 }, { seriesKey: "Category 2", seriesColorIndex: 1, heading: "(Insert category 2)", text: "(Insert description)" }),
        at("narrative-c", "panel", { x: 60, y: 532, width: 300, height: 116 }, { seriesKey: "Category 3", seriesColorIndex: 0, heading: "(Insert category 3)", text: "(Insert description)" }),
        at("connector", "connector", { x: 368, y: 386, width: 68, height: 68 }, { variant: "disc-chevron" }),
        at("axis-label", "paragraph", { x: 478, y: 190, width: 160, height: 54 }, { text: "(Insert chart title)\n(Insert unit)" }),
        at("chart", "chart.stacked-column", { x: 458, y: 230, width: 762, height: 406 }, {
          categories: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"],
          series: [{ name: "Category 3", values: [3, 9, 12, 20, 21] }, { name: "Category 2", values: [1, 4, 12, 20, 27] }, { name: "Category 1", values: [2, 4, 10, 14, 19] }],
          colorIndices: [0, 1, 2],
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
      visualFamily: "line-with-bottom-highlights",
      capabilities: ["slide-chrome", "chart-title", "chart.line", "highlight-strip"],
      title: "(Insert action title)",
      pageNumber: 4,
      children: [
        at("description", "chart-title", { x: 60, y: 166, width: 1160, height: 52 }, { heading: "(Insert chart title)" }),
        at("chart", "chart.line", { x: 60, y: 224, width: 1160, height: 300 }, {
        categories: ["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028", "2029"],
        series: [{ name: "Value", values: [25, 32, 40, 48, 56, 38, 46, 58, 72, 88, 100] }],
        yMax: 120,
        dataLabels: false,
        annotations: [],
        pointHighlights: [{ category: "2020", label: "1" }, { category: "2023", label: "2" }, { category: "2024", label: "3" }, { category: "2027", label: "4" }, { category: "2029", label: "5" }],
        highlights: [],
        referenceLines: []
      }),
        at("highlights", "highlight-strip", { x: 160, y: 550, width: 1040, height: 116 }, { items: [1, 2, 3, 4, 5].map((number) => ({ number: String(number), heading: `(Insert highlight ${number})`, description: "(Insert description)" })) })
      ]
    }),
    analytical({
      id: "golden-scatter-rail",
      sourceSlide: 5,
      visualFamily: "scatter-and-takeaway-rail",
      capabilities: ["slide-chrome", "chart.scatter", "content-rail"],
      title: "(Insert action title)",
      pageNumber: 5,
      children: [
        at("description", "chart-title", { x: 60, y: 184, width: 770, height: 52 }, { heading: "(Insert chart title)" }),
        at("scatter", "chart.scatter", { x: 60, y: 232, width: 770, height: 390 }, {
          points: [{ name: "Player Y", x: 1400, y: 2300 }, { name: "Player X", x: 2000, y: 1200 }, { name: "Player", x: 2700, y: 2750 }, { name: "Player W", x: 2750, y: 1350 }, { name: "Player Z", x: 2750, y: 700 }, { name: "Player B", x: 3150, y: 1550 }, { name: "Player S", x: 4400, y: 1500 }, { name: "Player t", x: 4550, y: 1400 }, { name: "Player 1", x: 5600, y: 2800 }, { name: "Player I", x: 7200, y: 2800 }],
          xMin: 0,
          xMax: 8000,
          yMin: 0,
          yMax: 3000,
          annotations: []
        }),
        at("rail", "content-rail", { x: 840, y: 166, width: 380, height: 456 }, { treatment: "open", dividerLeft: true, heading: "(Insert takeaway heading)", items: ["(Insert evidence-backed takeaway 1)", "(Insert evidence-backed takeaway 2)", "(Insert evidence-backed takeaway 3)"] })
      ]
    }),
    analytical({
      id: "golden-structured-rows",
      sourceSlide: 6,
      visualFamily: "structured-rows",
      capabilities: ["slide-chrome", "trend-rows"],
      title: "(Insert action title)",
      pageNumber: 6,
      children: [at("rows", "trend-rows", { x: 60, y: 174, width: 1160, height: 456 }, {
        columns: ["Trend", "Description", "Examples"],
        rows: [
          ["(Insert trend 1)", "•  (Insert supporting point 1)\n•  (Insert supporting point 2)\n•  (Insert supporting point 3)", "•  (Insert example)"],
          ["(Insert trend 2)", "•  (Insert supporting point 1)\n•  (Insert supporting point 2)\n•  (Insert supporting point 3)", "•  (Insert example)"],
          ["(Insert trend 3)", "•  (Insert supporting point 1)\n•  (Insert supporting point 2)\n•  (Insert supporting point 3)", "•  (Insert example)"]
        ]
      })]
    }),
    analytical({
      id: "golden-process",
      sourceSlide: 99,
      visualFamily: "chevron-process",
      capabilities: ["slide-chrome", "chevron-process"],
      title: "(Insert action title)",
      pageNumber: 7,
      children: [at("process", "chevron-process", { x: 60, y: 204, width: 1160, height: 330 }, {
        items: [
          { heading: "Phase 1", label: "(Insert phase name)", details: ["(Insert activity 1)", "(Insert activity 2)", "(Insert activity 3)"] },
          { heading: "Phase 2", label: "(Insert phase name)", details: ["(Insert activity 1)", "(Insert activity 2)", "(Insert activity 3)"] },
          { heading: "Phase 3", label: "(Insert phase name)", details: ["(Insert activity 1)", "(Insert activity 2)", "(Insert activity 3)"] },
          { heading: "Phase 4", label: "(Insert phase name)", details: ["(Insert activity 1)", "(Insert activity 2)", "(Insert activity 3)"] },
          { heading: "Phase 5", label: "(Insert phase name)", details: ["(Insert activity 1)", "(Insert activity 2)", "(Insert activity 3)"] }
        ]
      })]
    }),
    analytical({
      id: "golden-organization",
      sourceSlide: 8,
      visualFamily: "organization-network",
      capabilities: ["slide-chrome", "organization"],
      title: "(Insert action title)",
      pageNumber: 8,
      children: [at("organization", "organization", { x: 60, y: 176, width: 1160, height: 470 }, {
        nodes: [
          { id: "left-1", label: "(Insert role)", x: 0, y: 0.04, width: 0.14, height: 0.15, tone: "dark" },
          { id: "left-2", label: "(Insert role)", x: 0, y: 0.25, width: 0.14, height: 0.15, tone: "dark" },
          { id: "left-3", label: "(Insert role)", x: 0, y: 0.46, width: 0.14, height: 0.15, tone: "dark" },
          { id: "left-4", label: "(Insert role)", x: 0, y: 0.67, width: 0.14, height: 0.15, tone: "dark" },
          { id: "root", label: "(Insert role)", x: 0.51, y: 0.04, width: 0.14, height: 0.15, tone: "primary" },
          { id: "a", label: "(Insert role)", x: 0.34, y: 0.25, width: 0.14, height: 0.15, tone: "primary" },
          { id: "b", label: "(Insert role)", x: 0.51, y: 0.25, width: 0.14, height: 0.15, tone: "primary" },
          { id: "c", label: "(Insert role)", x: 0.68, y: 0.25, width: 0.14, height: 0.15, tone: "primary" },
          { id: "d", label: "(Insert role)", x: 0.85, y: 0.25, width: 0.14, height: 0.15, tone: "primary" },
          { id: "a1", label: "(Insert role)", x: 0.16, y: 0.46, width: 0.14, height: 0.15, tone: "primary" },
          { id: "a2", label: "(Insert role)", x: 0.16, y: 0.67, width: 0.14, height: 0.13 },
          { id: "a3", label: "(Insert role)", x: 0.16, y: 0.82, width: 0.14, height: 0.13 },
          { id: "b1", label: "(Insert role)", x: 0.34, y: 0.46, width: 0.14, height: 0.15 },
          { id: "c1", label: "(Insert role)", x: 0.51, y: 0.46, width: 0.14, height: 0.15 },
          { id: "c2", label: "(Insert role)", x: 0.51, y: 0.67, width: 0.14, height: 0.13 },
          { id: "c3", label: "(Insert role)", x: 0.68, y: 0.67, width: 0.14, height: 0.13 },
          { id: "c4", label: "(Insert role)", x: 0.68, y: 0.82, width: 0.14, height: 0.13 },
          { id: "d1", label: "(Insert role)", x: 0.85, y: 0.67, width: 0.14, height: 0.13 }
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
      title: "(Insert action title)",
      pageNumber: 10,
      children: [
        at("subtitle", "paragraph", { x: 60, y: 150, width: 1160, height: 38 }, { text: "(Insert table subtitle)" }),
        at("table", "table", { x: 60, y: 188, width: 1160, height: 456 }, {
        columns: ["Segment", "Markers or instance type", "Number of customers", "Sales per year", "H-2", "H-1", "H"],
        columnWidths: [0.11, 0.22, 0.15, 0.15, 0.15, 0.12, 0.10],
        headerTone: "dark",
        alternating: false,
        rows: [
          ["Segment 1", "•  (Insert description)\n•  (Insert supporting point)", "–", "–", "–", "–", "●"],
          ["Segment 2", "•  (Insert description)\n•  (Insert supporting point)", "–", "–", "–", "–", "◕"],
          ["Segment 3", "•  (Insert description)\n•  (Insert supporting point)", "–", "–", "–", "–", "◑"],
          ["Segment 4", "•  (Insert description)\n•  (Insert supporting point)", "–", "–", "–", "–", "◔"]
        ]
      })]
    }),
    analytical({
      id: "golden-rollout",
      sourceSlide: 11,
      visualFamily: "phased-rollout",
      capabilities: ["slide-chrome", "initiative-rollout"],
      title: "(We plan to roll-out across Y years)",
      pageNumber: 11,
      children: [at("rollout", "initiative-rollout", { x: 60, y: 188, width: 1160, height: 452 }, {
        years: ["20xx", "20xx", "20xx"],
        rows: ["A", "B", "C", "D"].map((label) => ({ label, phases: ["(Insert phase 1 initiatives)\n(Insert execution focus)", "(Insert phase 2 initiatives)\n(Insert execution focus)", "(Insert phase 3 initiatives)\n(Insert execution focus)"] }))
      })]
    }),
    {
      id: "golden-divider",
      sourceSlide: null,
      visualFamily: "section-divider",
      capabilities: ["section-divider"],
      frame: fullFrame,
      composition: absolute({ id: "divider-composition", children: [at("divider", "section-divider", fullFrame, { title: "(Insert section title)", companyName: "(Insert company name)", pageNumber: 12 })] })
    },
    analytical({
      id: "golden-text",
      sourceSlide: 14,
      visualFamily: "text-led-list",
      capabilities: ["slide-chrome", "paragraph", "bullet-list"],
      title: "(Insert section title)",
      pageNumber: 14,
      chromeOverrides: { footerRight: "(Insert section name)" },
      children: [
        at("intro", "paragraph", { x: 60, y: 166, width: 1160, height: 86 }, { text: "(Insert a short introductory sentence that frames the section and the intended decision.)" }),
        at("list", "bullet-list", { x: 60, y: 266, width: 1160, height: 326 }, { items: ["(Insert supporting point 1 and its decision relevance.)", "(Insert supporting point 2 and its decision relevance.)", "(Insert supporting point 3 and its decision relevance.)", "(Insert supporting point 4 and its decision relevance.)", "(Insert supporting point 5 and its decision relevance.)"] })
      ]
    }),
    analytical({
      id: "golden-matrix",
      sourceSlide: 160,
      visualFamily: "prioritization-matrix",
      capabilities: ["slide-chrome", "matrix", "legend"],
      title: "(Insert action title)",
      pageNumber: 13,
      children: [
        at("legend", "legend", { x: 490, y: 154, width: 700, height: 34 }, { items: ["Short-term / quick", "Medium-term / gradual", "Long-term / transformational"] }),
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
      title: "(Insert action title)",
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
      title: "(Insert action title)",
      pageNumber: 15,
      children: [
        at("description", "chart-title", { x: 60, y: 188, width: 770, height: 52 }, { heading: "(Insert chart title)" }),
        at("pie", "chart.pie", { x: 60, y: 230, width: 770, height: 390 }, { labels: ["Category 1", "Category 2", "Category 3", "Category 4"], values: [25, 25, 25, 25], legend: true }),
        at("rail", "content-rail", { x: 840, y: 170, width: 380, height: 460 }, { treatment: "open", dividerLeft: true, heading: "(Insert takeaway heading)", items: ["(Insert evidence-backed takeaway 1)", "(Insert evidence-backed takeaway 2)", "(Insert evidence-backed takeaway 3)"] })
      ]
    }),
    analytical({
      id: "golden-donut",
      sourceSlide: 96,
      visualFamily: "donut-and-takeaways",
      capabilities: ["slide-chrome", "chart.donut", "content-rail"],
      title: "(Insert action title)",
      pageNumber: 16,
      children: [
        at("description", "chart-title", { x: 60, y: 188, width: 770, height: 52 }, { heading: "(Insert chart title)" }),
        at("donut", "chart.donut", { x: 60, y: 230, width: 770, height: 390 }, { labels: ["Category 1", "Category 2", "Category 3", "Category 4"], values: [25, 25, 25, 25], legend: true }),
        at("rail", "content-rail", { x: 840, y: 170, width: 380, height: 460 }, { treatment: "open", dividerLeft: true, heading: "(Insert takeaway heading)", items: ["(Insert evidence-backed takeaway 1)", "(Insert evidence-backed takeaway 2)", "(Insert evidence-backed takeaway 3)"] })
      ]
    }),
    analytical({
      id: "golden-map",
      sourceSlide: 174,
      visualFamily: "map-and-takeaways",
      capabilities: ["slide-chrome", "map", "content-rail"],
      title: "(Insert action title)",
      pageNumber: 17,
      children: [
        at("map", "map", { x: 60, y: 180, width: 880, height: 430 }, { markers: [{ x: 0.11, y: 0.43, fraction: 0.75 }, { x: 0.29, y: 0.7, fraction: 0.25 }, { x: 0.48, y: 0.38, fraction: 1 }, { x: 0.59, y: 0.28, fraction: 0.5 }, { x: 0.74, y: 0.62, fraction: 0.5 }, { x: 0.81, y: 0.38, fraction: 0.25 }, { x: 0.86, y: 0.78, fraction: 0.75 }] }),
        at("rail", "content-rail", { x: 952, y: 184, width: 268, height: 420 }, { heading: "(Insert takeaway heading)", items: ["(Insert evidence-backed takeaway 1)", "(Insert evidence-backed takeaway 2)", "(Insert evidence-backed takeaway 3)"] })
      ]
    }),
    analytical({
      id: "golden-roadmap",
      sourceSlide: 140,
      visualFamily: "wave-roadmap",
      capabilities: ["slide-chrome", "roadmap"],
      title: "(Insert action title)",
      pageNumber: 18,
      children: [at("roadmap", "roadmap", { x: 60, y: 202, width: 1160, height: 420 }, { variant: "wave-columns", items: [
        { range: "(Insert time range)", heading: "Wave 1\n(Insert heading)", activities: ["(Insert activity)", "(Insert activity)", "(Insert activity)"], deliverables: ["(Insert deliverable or indicator)"] },
        { range: "(Insert time range)", heading: "Wave 2\n(Insert heading)", activities: ["(Insert activity)", "(Insert activity)", "(Insert activity)"], deliverables: ["(Insert deliverable or indicator)"] },
        { range: "(Insert time range)", heading: "Wave 3\n(Insert heading)", activities: ["(Insert activity)", "(Insert activity)", "(Insert activity)"], deliverables: ["(Insert deliverable or indicator)"] },
        { range: "(Insert time range)", heading: "Wave 4\n(Insert heading)", activities: ["(Insert activity)", "(Insert activity)", "(Insert activity)"], deliverables: ["(Insert deliverable or indicator)"] }
      ] })]
    })
  ];
}

export function buildGoldenDeck({ referenceOnly = false } = {}) {
  // The standard cover was deliberately replaced; it is validated in the
  // component/golden suite, not against the retired external cover artwork.
  const specs = goldenFixtureSpecs().filter(spec => !referenceOnly || spec.sourceSlide !== null);
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
