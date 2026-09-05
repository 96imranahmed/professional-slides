import { CONTENT_FRAME, SLIDE, absolute, compileDeck, component, flow, grid, overlay, section, token } from "./core.mjs";
import { REGISTRY } from "./registry.mjs";
import { instantiateSlideTemplate, planSlide } from "./planner.mjs";
import { SLIDE_TYPE_GUIDANCE, guidanceNote } from "./guidance.mjs";
import { INSIGHT_TREE_TABLE_FOUR_BRANCH_SAMPLE } from "./insight-tree-table.mjs";

function centeredFrame(preferred) {
  if ((preferred.width || 0) >= SLIDE.width && (preferred.height || 0) >= SLIDE.height) {
    return { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height };
  }
  const width = Math.min(CONTENT_FRAME.width, preferred.width || CONTENT_FRAME.width);
  const height = Math.min(CONTENT_FRAME.height, preferred.height || CONTENT_FRAME.height);
  return {
    x: (SLIDE.width - width) / 2,
    y: (SLIDE.height - height) / 2,
    width,
    height
  };
}

function variantComponentNode(definition, variant, frame, id) {
  const child = component({
    id,
    component: definition.id,
    props: boardVariantProps(definition, variant),
    frame: definition.variants[variant]?.backdrop ? { x: 0, y: 0, width: frame.width, height: frame.height } : frame
  });
  const backdrop = definition.variants[variant]?.backdrop;
  if (!backdrop) return child;
  return section({
    id: `${id}-backdrop`, treatment: backdrop, padding: 0, frame,
    composition: absolute({ id: `${id}-backdrop-content`, children: [child] })
  });
}

export function componentFixtureSpecs() {
  return [...REGISTRY.values()].map((definition) => {
    const frame = centeredFrame(definition.preferredSize || CONTENT_FRAME);
    return {
      id: `fixture-${definition.id}`,
      target: definition.id,
      kind: definition.category === "chart" ? "chart" : "component",
      ...(definition.defaultVariant ? { variant: definition.defaultVariant, defaultVariant: true } : {}),
      ...((definition.guidance || SLIDE_TYPE_GUIDANCE[definition.id]) ? { notes: guidanceNote(definition.guidance || SLIDE_TYPE_GUIDANCE[definition.id]) } : {}),
      composition: absolute({
        id: "fixture-root",
        children: [component({ id: definition.id, component: definition.id, props: definition.sample, frame })]
      }),
      frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height }
    };
  });
}

export function componentVariantFixtureSpecs({ includeDefault = false } = {}) {
  return [...REGISTRY.values()].flatMap((definition) => Object.keys(definition.variants || {})
    .filter((variant) => includeDefault || variant !== definition.defaultVariant)
    .map((variant) => ({
    id: `fixture-${definition.id}-${variant}`,
    target: definition.id,
    variant,
    kind: "variant",
    ...((definition.guidance || SLIDE_TYPE_GUIDANCE[definition.id]) ? { notes: guidanceNote(definition.guidance || SLIDE_TYPE_GUIDANCE[definition.id]) } : {}),
    composition: absolute({
      id: "fixture-root",
      children: [variantComponentNode(definition, variant, centeredFrame(definition.variants[variant].preferredSize || definition.preferredSize || CONTENT_FRAME), definition.id)]
    }),
    frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height }
  })));
}

const VARIANT_BOARD_LAYOUTS = Object.freeze({
  "slide-chrome": { capacity: 1, columns: 1 },
  "page-template": { capacity: 1, columns: 1 },
  "section-boundary": { capacity: 3, columns: 3 },
  section: { capacity: 3, columns: 3 },
  "section-heading": { capacity: 3, columns: 1 },
  "action-title": { capacity: 2, columns: 1 },
  "section-title": { capacity: 2, columns: 1 },
  "section-divider": { capacity: 1, columns: 1 },
  source: { capacity: 2, columns: 1 },
  "bullet-list": { capacity: 2, columns: 2 },
  insight: { capacity: 4, columns: 1 },
  panel: { capacity: 4, columns: 2 },
  legend: { capacity: 4, columns: 2 },
  "chart-callout": { capacity: 2, columns: 2, fit: "preferred" },
  table: { capacity: 1, columns: 1 },
  roadmap: { capacity: 2, columns: 2 },
  map: { capacity: 4, columns: 2 },
  connector: { capacity: 3, columns: 3 },
  "content-rail": { capacity: 2, columns: 2 },
  "chart-title": { capacity: 2, columns: 1 },
  "tracker-label": { capacity: 3, columns: 1 },
  "tracker-page": { capacity: 1, columns: 1 },
  "quote-cluster": { capacity: 1, columns: 1 },
  "chart.line": { capacity: 2, columns: 2 },
  "chart.waterfall": { capacity: 2, columns: 2 },
  "chart.pie": { capacity: 2, columns: 2 },
  "chart.donut": { capacity: 2, columns: 2 },
  "chart.horizons": { capacity: 1, columns: 1 },
  "chart-group": { capacity: 2, columns: 2 }
});

function boardVariantProps(definition, variant) {
  return {
    ...definition.sample,
    ...(definition.variantProp ? { [definition.variantProp]: variant } : {}),
    ...(definition.variants?.[variant]?.props || {})
  };
}

function chunks(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

export function componentFixtureBoardSpecs() {
  return [...REGISTRY.values()].flatMap((definition) => {
    const variants = Object.keys(definition.variants || {});
    if (!variants.length) {
      const fixture = componentFixtureSpecs().find(item => item.target === definition.id);
      return [{ ...fixture, coverage: [{ target: definition.id, variant: null }] }];
    }
    const layout = VARIANT_BOARD_LAYOUTS[definition.id] || { capacity: 1, columns: 1 };
    if (!definition.defaultVariant || !Object.hasOwn(definition.variants, definition.defaultVariant)) throw new Error(`${definition.id} variants require a registered defaultVariant`);
    const ordered = [definition.defaultVariant, ...variants.filter(variant => variant !== definition.defaultVariant)];
    return chunks(ordered, layout.capacity).map((pageVariants, pageIndex, pages) => {
      if (layout.capacity === 1) {
        const variant = pageVariants[0];
        const fixture = variant === definition.defaultVariant
          ? componentFixtureSpecs().find(item => item.target === definition.id)
          : componentVariantFixtureSpecs().find(item => item.target === definition.id && item.variant === variant);
        return { ...fixture, coverage: [{ target: definition.id, variant }], ...(variant === definition.defaultVariant ? { defaultVariant: true } : {}) };
      }
      const columns = Math.min(layout.columns, pageVariants.length);
      const rows = Math.ceil(pageVariants.length / columns);
      const outer = { x: 36, y: 12, width: SLIDE.width - 72, height: SLIDE.height - 24 };
      const columnGap = 20, rowGap = 18, labelHeight = 22, labelGap = 4;
      const cellWidth = (outer.width - columnGap * (columns - 1)) / columns;
      const cellHeight = (outer.height - rowGap * (rows - 1)) / rows;
      const children = pageVariants.flatMap((variant, index) => {
        const column = index % columns, row = Math.floor(index / columns);
        const x = outer.x + column * (cellWidth + columnGap), y = outer.y + row * (cellHeight + rowGap);
        let frame = { x, y: y + labelHeight + labelGap, width: cellWidth, height: cellHeight - labelHeight - labelGap };
        if (layout.fit === "preferred") {
          const preferred = definition.variants[variant]?.preferredSize || definition.preferredSize;
          const width = Math.min(frame.width, preferred.width), height = Math.min(frame.height, preferred.height);
          frame = { x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - height) / 2, width, height };
        }
        const safeVariant = variant.replace(/[^a-z0-9]+/gi, "-");
        return [
          component({ id: `${definition.id}-${safeVariant}-label`, component: "paragraph", frame: { x, y, width: cellWidth, height: labelHeight }, props: { text: variant === definition.defaultVariant ? `Default · ${variant}` : variant } }),
          variantComponentNode(definition, variant, frame, `${definition.id}-${safeVariant}`)
        ];
      });
      return {
        id: `fixture-${definition.id}-variant-board${pages.length > 1 ? `-${pageIndex + 1}` : ""}`,
        target: definition.id,
        kind: "board",
        coverage: pageVariants.map(variant => ({ target: definition.id, variant, ...(variant === definition.defaultVariant ? { defaultVariant: true } : {}) })),
        ...((definition.guidance || SLIDE_TYPE_GUIDANCE[definition.id]) ? { notes: guidanceNote(definition.guidance || SLIDE_TYPE_GUIDANCE[definition.id]) } : {}),
        composition: absolute({ id: "fixture-root", children }),
        frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height }
      };
    });
  });
}

export function layoutFixtureSpecs() {
  const planned = planSlide({
    id: "fixture-planner-auto",
    title: "(Insert action title)",
    density: "pre-read",
    source: "Source: (Insert source)",
    provenanceRequired: true,
    items: [
      {
        id: "market-signal",
        job: "quantify momentum",
        heading: "(Insert evidence heading)",
        treatment: "open",
        layout: "flow.column",
        items: [
          { id: "growth-chart", job: "show the measured change", component: "chart.column", props: REGISTRY.get("chart.column").sample, size: { width: "fill", height: "fill" } }
        ]
      },
      {
        id: "decision",
        job: "state the resulting action",
        heading: "(Insert implication heading)",
        treatment: "muted",
        layout: "flow.column",
        items: [
          { id: "decision-copy", job: "name the priority", component: "paragraph", props: { text: "(Insert the action or implication supported by the evidence.)" }, size: { width: "fill", height: "fill" } }
        ]
      }
    ]
  });
  const useCaseBase = {
    title: "(Insert use-case action title)",
    titleVariant: "with-line",
    density: "pre-read",
    layout: "grid",
    copyBudget: { maxWordsPerSlide: 220, rationale: "A repeated use-case page develops five stable evidence regions" },
    items: [
      {
        id: "context", job: "state the use-case context", treatment: "muted", heading: "(Insert context heading)",
        items: [{ id: "context-copy", job: "develop the context", component: "bullet-list", props: { variant: "body", items: ["(Insert context point 1)", "(Insert context point 2)"] } }]
      },
      {
        id: "objective", job: "state the use-case objective", treatment: "muted", heading: "(Insert objective heading)",
        items: [{ id: "objective-copy", job: "develop the objective", component: "paragraph", props: { text: "(Insert the objective and success condition.)" } }]
      },
      {
        id: "outcomes", job: "state the expected outcomes", treatment: "muted", heading: "(Insert outcomes heading)", cell: { column: 2, row: 0, rowSpan: 2 },
        items: [{ id: "outcomes-copy", job: "develop the outcomes", component: "bullet-list", props: { variant: "body", items: ["(Insert outcome 1)", "(Insert outcome 2)", "(Insert outcome 3)"] } }]
      },
      {
        id: "scope", job: "bound the use case", treatment: "muted", heading: "(Insert scope heading)",
        items: [{ id: "scope-copy", job: "state inclusions and exclusions", component: "bullet-list", props: { variant: "body", items: ["(Insert in-scope element)", "(Insert out-of-scope element)"] } }]
      },
      {
        id: "evidence", job: "show the use-case evidence", treatment: "open",
        items: [{ id: "evidence-chart", job: "quantify the use-case evidence", component: "chart.column", props: { categories: ["Q1", "Q2", "Q3", "Q4"], series: [{ name: "Measure", values: [38, 52, 63, 76] }], valueFormat: { decimals: 0 } } }]
      }
    ]
  };
  const useCaseSequence = instantiateSlideTemplate({ id: "use-case-grid", template: useCaseBase, instances: [1, 2, 3].map(index => ({
    id: `fixture-layout-use-case-grid-${index}`,
    title: `(Insert use-case ${index} action title)`,
    itemContent: {
      "context-copy": { props: { items: [`(Insert use-case ${index} context point 1)`, `(Insert use-case ${index} context point 2)`] } },
      "objective-copy": { props: { text: `(Insert use-case ${index} objective and success condition.)` } },
      "outcomes-copy": { props: { items: [`(Insert use-case ${index} outcome 1)`, `(Insert use-case ${index} outcome 2)`, `(Insert use-case ${index} outcome 3)`] } },
      "evidence-chart": { props: { series: [{ name: "Measure", values: [34 + index * 4, 46 + index * 5, 58 + index * 6, 70 + index * 7] }] } }
    }
  })) });
  return [
    ...useCaseSequence.map(plan => ({ ...planSlide(plan).spec, target: "layout.template-sequence-use-case-grid", kind: "layout" })),
    {
      ...planSlide({
        id: "fixture-layout-section-split-50-50",
        title: "(Insert action title)",
        layout: "section-split-50-50",
        density: "pre-read",
        copyBudget: { maxWordsPerSlide: 120, rationale: "The half-section specimen shows one framing statement and a developed related-example list" },
        items: [
          {
            id: "framing-half",
            job: "frame the question or content area",
            treatment: "open",
            layout: "absolute",
            items: [
              { id: "framing-title", job: "state the framing question", component: "section-title", props: { text: "(Insert framing title)", variant: "without-line" }, frame: { x: 0, y: 130, width: 500, height: 120 } },
              { id: "framing-subtitle", job: "name the example set", component: "paragraph", props: { text: "(Insert description of the related examples)" }, frame: { x: 0, y: 270, width: 500, height: 80 } }
            ]
          },
          {
            id: "examples-half",
            job: "list examples related to the framing area",
            treatment: "muted",
            layout: "absolute",
            items: [
              { id: "examples-heading", job: "introduce the examples", component: "section-heading", props: { heading: "(Insert examples heading)", rule: true }, frame: { x: 0, y: 36, width: 500, height: 60 } },
              { id: "examples", job: "develop the related examples", component: "bullet-list", props: { variant: "body", items: ["(Insert related example 1)", "(Insert related example 2)", "(Insert related example 3)", "(Insert related example 4)"] }, frame: { x: 0, y: 126, width: 500, height: 250 } },
              { id: "examples-conclusion", job: "state when the examples apply", component: "paragraph", props: { text: "(Insert the condition that connects the examples to the framing area.)" }, frame: { x: 0, y: 402, width: 500, height: 74 } }
            ]
          }
        ]
      }).spec,
      target: "layout.section-split-50-50",
      kind: "layout"
    },
    {
      ...planSlide({
        id: "fixture-layout-insight-tree-table-four-branch",
        title: "(Insert action title)",
        source: "Source: (Insert source)",
        layout: "absolute",
        copyBudget: { maxWordsPerSlide: 140, rationale: "Four-branch capacity specimen repeats neutral prompts across seven aligned rows" },
        items: [{
          id: "four-branch-tree-table",
          job: "show an extended hierarchy with leaf-aligned insights and implications",
          component: "insight-tree-table",
          props: structuredClone(INSIGHT_TREE_TABLE_FOUR_BRANCH_SAMPLE),
          frame: { x: 0, y: 0, width: 1160, height: 490 }
        }]
      }).spec,
      target: "insight-tree-table",
      kind: "layout"
    },
    {
      id: "fixture-layout-context-panel", target: "layout.context-panel", kind: "layout",
      frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height },
      composition: absolute({ id: "context-example", children: [
        component({ id: "chart", component: "chart.column", props: REGISTRY.get("chart.column").sample, frame: { x: 60, y: 150, width: 650, height: 440 } }),
        section({ id: "context", treatment: "muted", frame: { x: 760, y: 150, width: 460, height: 440 }, composition: absolute({ id: "sections", children: [
          ...[
            ["(Insert context heading 1)", "(Insert the first context point needed to interpret the exhibit.)"],
            ["(Insert context heading 2)", "(Insert the second context point needed to interpret the exhibit.)"],
            ["(Insert context heading 3)", "(Insert the condition that would change the conclusion.)"]
          ].flatMap(([heading, text], index) => [
            component({ id: `heading-${index}`, component: "section-heading", props: { heading, rule: false }, frame: { x: 0, y: index * 140, width: 428, height: 28 } }),
            component({ id: `body-${index}`, component: "paragraph", props: { text }, frame: { x: 0, y: index * 140 + 36, width: 428, height: 88 } }),
            ...(index < 2 ? [component({ id: `separator-${index}`, component: "section-boundary", props: { variant: "subsection" }, frame: { x: 0, y: index * 140 + 124, width: 428, height: 8 } })] : [])
          ])
        ] }) })
      ] })
    },
    ...["none", "bottom", "top-and-bottom"].map(rules => ({
      ...planSlide({ id: `fixture-page-template-${rules}-composition`, title: "(Insert action title)", source: "Source: (Insert source)", pageNumber: 7,
        pageTemplate: { rules, branding: "top-right-logo", logo: { component: "paragraph", props: { text: "(Insert company name)" } } },
        items: [{ id: "mix", job: "Show the composition", component: "chart.pie", props: { heading: "(Insert chart title)", labels: ["Category A", "Category B", "Category C"], values: [50, 30, 20] } }]
      }).spec,
      target: "page-template", kind: "layout"
    })),
    ...[...REGISTRY.values()].flatMap(definition => Object.entries(definition.examples || {}).map(([name, example]) => ({
      id: `fixture-${definition.id}-${name}`, target: definition.id, kind: "layout", example: name,
      ...((definition.guidance || SLIDE_TYPE_GUIDANCE[definition.id]) ? { notes: guidanceNote(definition.guidance || SLIDE_TYPE_GUIDANCE[definition.id]) } : {}),
      frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height },
      composition: absolute({ id: "example-root", children: [component({ id: definition.id, component: definition.id, props: { ...definition.sample, ...example.props }, frame: centeredFrame(example.preferredSize || definition.preferredSize) })] })
    }))),
    {
      id: "fixture-layout-wrapped-headings",
      target: "layout.wrapped-headings",
      kind: "layout",
      frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height },
      composition: absolute({ id: "headers", children: [
        component({ id: "one-line", component: "section-heading", frame: { x: 60, y: 240, width: 330, height: 140 }, props: { heading: "(Insert heading)" } }),
        component({ id: "two-lines", component: "section-heading", frame: { x: 450, y: 240, width: 330, height: 140 }, props: { heading: "(Insert a two-line\nheading)" } }),
        component({ id: "three-lines", component: "section-heading", frame: { x: 840, y: 240, width: 330, height: 140 }, props: { heading: "(Insert a three-line\nsection heading\nwhen required)" } })
      ] })
    },
    {
      id: "fixture-layout-row",
      target: "layout.row",
      kind: "layout",
      frame: CONTENT_FRAME,
      composition: flow({ id: "row", direction: "row", gap: token("space.5"), children: [0, 1, 2].map((index) => component({ id: `metric-${index}`, component: "metric", props: { value: `${52 + index * 11}%`, label: `Metric ${index + 1}`, delta: `+${index + 2} pts` }, size: { width: { fr: 1 }, height: "fill" } })) })
    },
    {
      id: "fixture-layout-column",
      target: "layout.column",
      kind: "layout",
      frame: CONTENT_FRAME,
      composition: flow({ id: "column", direction: "column", gap: token("space.4"), children: [component({ id: "title", component: "action-title", props: REGISTRY.get("action-title").sample, size: { width: "fill", height: 86 } }), component({ id: "body", component: "panel", props: REGISTRY.get("panel").sample, size: { width: "fill", height: { fr: 1 } } }), component({ id: "source", component: "source", props: REGISTRY.get("source").sample, size: { width: "fill", height: 28 } })] })
    },
    {
      id: "fixture-layout-grid",
      target: "layout.grid",
      kind: "layout",
      frame: CONTENT_FRAME,
      composition: grid({ id: "grid", columns: [{ fr: 1 }, { fr: 1 }], rows: [{ fr: 1 }, { fr: 1 }], children: [0, 1, 2, 3].map((index) => component({ id: `panel-${index}`, component: "panel", props: { heading: `(Insert section ${index + 1} heading)`, text: "(Insert the supporting description.)" }, cell: { column: index % 2, row: Math.floor(index / 2) } })) })
    },
    {
      id: "fixture-layout-overlay",
      target: "layout.overlay",
      kind: "layout",
      frame: CONTENT_FRAME,
      composition: overlay({ id: "overlay", children: [component({ id: "image", component: "image-frame", props: { alt: "(Insert background evidence)" } }), component({ id: "callout", component: "chart-callout", props: { text: "(Insert anchored callout)" }, frame: { x: 760, y: 80, width: 280, height: 90 } })] })
    },
    {
      id: "fixture-layout-absolute",
      target: "layout.absolute",
      kind: "layout",
      frame: CONTENT_FRAME,
      composition: absolute({ id: "absolute", children: [component({ id: "roadmap", component: "roadmap", props: REGISTRY.get("roadmap").sample, frame: { x: 40, y: 70, width: 980, height: 360 } }), component({ id: "source", component: "source", props: REGISTRY.get("source").sample, frame: { x: 40, y: 520, width: 980, height: 28 } })] })
    },
    {
      id: "fixture-layout-nested-section",
      target: "layout.nested-section",
      kind: "layout",
      frame: CONTENT_FRAME,
      composition: flow({ id: "sections", direction: "row", gap: token("space.5"), children: [section({ id: "narrative", treatment: "open", heading: "(Insert section heading 1)", size: { width: { fr: 1 }, height: "fill" }, children: [component({ id: "paragraph", component: "paragraph", props: REGISTRY.get("paragraph").sample, size: { width: "fill", height: "fill" } })] }), section({ id: "status", treatment: "muted", heading: "(Insert section heading 2)", size: { width: { fr: 1 }, height: "fill" }, children: [component({ id: "status-list", component: "status-list", props: REGISTRY.get("status-list").sample, size: { width: "fill", height: "fill" } })] })] })
    },
    {
      id: planned.spec.id,
      target: "planner.auto",
      kind: "layout",
      frame: planned.spec.frame,
      chrome: planned.spec.chrome,
      composition: planned.spec.composition
    },
    {
      id: "fixture-layout-wrapped-titles",
      target: "layout.wrapped-titles",
      kind: "layout",
      frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height },
      composition: absolute({ id: "titles", children: ["action-title", "section-title"].flatMap((componentId, row) =>
        ["with-line", "without-line"].map((variant, column) => component({
          id: `${componentId}-${variant}`, component: componentId,
          frame: { x: 60 + column * 620, y: 200 + row * 230, width: 540, height: 140 },
          props: { text: "(Insert a two-line\naction title)", variant }
        }))
      ) })
    }
  ];
}

export function buildFixtureDeck({ includeLayouts = true, palette } = {}) {
  const fixtureSlides = [...componentFixtureBoardSpecs(), ...(includeLayouts ? layoutFixtureSpecs() : [])];
  const deck = compileDeck({ id: "component-validation", palette, slides: fixtureSlides }, REGISTRY);
  return { deck, fixtures: fixtureSlides.map((fixture, index) => ({ id: fixture.id, target: fixture.target, kind: fixture.kind, ...(fixture.variant ? { variant: fixture.variant } : {}), ...(fixture.defaultVariant ? { defaultVariant: true } : {}), ...(fixture.coverage ? { coverage: fixture.coverage } : {}), slide: index + 1 })) };
}
