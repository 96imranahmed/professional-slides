import { CONTENT_FRAME, SLIDE, absolute, compileDeck, component, flow, grid, overlay, section, token } from "./core.mjs";
import { REGISTRY } from "./registry.mjs";
import { planSlide } from "./planner.mjs";

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

export function componentFixtureSpecs() {
  return [...REGISTRY.values()].map((definition) => {
    const frame = centeredFrame(definition.preferredSize || CONTENT_FRAME);
    return {
      id: `fixture-${definition.id}`,
      target: definition.id,
      kind: definition.category === "chart" ? "chart" : "component",
      composition: absolute({
        id: "fixture-root",
        children: [component({ id: definition.id, component: definition.id, props: definition.sample, frame })]
      }),
      frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height }
    };
  });
}

export function componentVariantFixtureSpecs() {
  return [...REGISTRY.values()].flatMap((definition) => Object.keys(definition.variants || {}).map((variant) => ({
    id: `fixture-${definition.id}-${variant}`,
    target: definition.id,
    variant,
    kind: "variant",
    composition: absolute({
      id: "fixture-root",
      children: [...(definition.variants[variant].backdrop ? [component({ id: "backdrop", component: "section", props: { treatment: definition.variants[variant].backdrop, padding: 0 }, frame: centeredFrame(definition.preferredSize || CONTENT_FRAME) })] : []), component({
        id: definition.id,
        component: definition.id,
        props: { ...definition.sample, ...(definition.variantProp ? { [definition.variantProp]: variant } : {}), ...definition.variants[variant].props },
        frame: centeredFrame(definition.variants[variant].preferredSize || definition.preferredSize || CONTENT_FRAME)
      })]
    }),
    frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height }
  })));
}

export function layoutFixtureSpecs() {
  const planned = planSlide({
    id: "fixture-planner-auto",
    title: "Two sections connect the market signal to action",
    density: "pre-read",
    source: "Source: Component runtime fixture",
    provenanceRequired: true,
    items: [
      {
        id: "market-signal",
        job: "quantify momentum",
        heading: "Market momentum",
        treatment: "open",
        layout: "flow.column",
        items: [
          { id: "growth-chart", job: "show the measured change", component: "chart.column", props: REGISTRY.get("chart.column").sample, size: { width: "fill", height: "fill" } }
        ]
      },
      {
        id: "decision",
        job: "state the resulting action",
        heading: "Capacity allocation",
        treatment: "muted",
        layout: "flow.column",
        items: [
          { id: "decision-copy", job: "name the priority", component: "paragraph", props: { text: "Prioritize the segment where demand and execution readiness already align." }, size: { width: "fill", height: "fill" } }
        ]
      }
    ]
  });
  return [
    ...["none", "bottom", "top-and-bottom"].map(rules => ({
      ...planSlide({ id: `fixture-page-template-${rules}-composition`, title: "Growth follows demand", source: "Source: Company operating data", pageNumber: 7,
        pageTemplate: { rules, branding: "top-right-logo", logo: { component: "paragraph", props: { text: "Company name" } } },
        items: [{ id: "mix", job: "Show the revenue mix", component: "chart.pie", props: { heading: "Revenue mix", labels: ["Core", "Growth", "New"], values: [50, 30, 20] } }]
      }).spec,
      target: "page-template", kind: "layout"
    })),
    ...[...REGISTRY.values()].flatMap(definition => Object.entries(definition.examples || {}).map(([name, example]) => ({
      id: `fixture-${definition.id}-${name}`, target: definition.id, kind: "layout", example: name,
      frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height },
      composition: absolute({ id: "example-root", children: [component({ id: definition.id, component: definition.id, props: { ...definition.sample, ...example.props }, frame: centeredFrame(example.preferredSize || definition.preferredSize) })] })
    }))),
    {
      id: "fixture-layout-wrapped-headings",
      target: "layout.wrapped-headings",
      kind: "layout",
      frame: { x: 0, y: 0, width: SLIDE.width, height: SLIDE.height },
      composition: absolute({ id: "headers", children: [
        component({ id: "one-line", component: "section-heading", frame: { x: 60, y: 240, width: 330, height: 140 }, props: { heading: "Description" } }),
        component({ id: "two-lines", component: "section-heading", frame: { x: 450, y: 240, width: 330, height: 140 }, props: { heading: "Key takeaway/(Insert key takeaway)" } }),
        component({ id: "three-lines", component: "section-heading", frame: { x: 840, y: 240, width: 330, height: 140 }, props: { heading: "Delivery capacity\nconstrains growth\nin the priority segment" } })
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
      composition: grid({ id: "grid", columns: [{ fr: 1 }, { fr: 1 }], rows: [{ fr: 1 }, { fr: 1 }], children: [0, 1, 2, 3].map((index) => component({ id: `panel-${index}`, component: "panel", props: { heading: `Section ${index + 1}`, text: "A reusable section inside an arbitrary grid cell." }, cell: { column: index % 2, row: Math.floor(index / 2) } })) })
    },
    {
      id: "fixture-layout-overlay",
      target: "layout.overlay",
      kind: "layout",
      frame: CONTENT_FRAME,
      composition: overlay({ id: "overlay", children: [component({ id: "image", component: "image-frame", props: { alt: "Background evidence" } }), component({ id: "callout", component: "chart-callout", props: { text: "Overlay remains anchored" }, frame: { x: 760, y: 80, width: 280, height: 90 } })] })
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
      composition: flow({ id: "sections", direction: "row", gap: token("space.5"), children: [section({ id: "narrative", treatment: "open", heading: "Narrative section", size: { width: { fr: 1 }, height: "fill" }, children: [component({ id: "paragraph", component: "paragraph", props: REGISTRY.get("paragraph").sample, size: { width: "fill", height: "fill" } })] }), section({ id: "status", treatment: "muted", heading: "Status section", size: { width: { fr: 1 }, height: "fill" }, children: [component({ id: "status-list", component: "status-list", props: REGISTRY.get("status-list").sample, size: { width: "fill", height: "fill" } })] })] })
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
          props: { text: "Capacity limits growth\nInvest in delivery", variant }
        }))
      ) })
    }
  ];
}

export function buildFixtureDeck({ includeLayouts = true, palette } = {}) {
  const fixtureSlides = [...componentFixtureSpecs(), ...(includeLayouts ? layoutFixtureSpecs() : []), ...componentVariantFixtureSpecs()];
  const deck = compileDeck({ id: "component-validation", palette, slides: fixtureSlides }, REGISTRY);
  return { deck, fixtures: fixtureSlides.map((fixture, index) => ({ id: fixture.id, target: fixture.target, kind: fixture.kind, ...(fixture.variant ? { variant: fixture.variant } : {}), slide: index + 1 })) };
}
