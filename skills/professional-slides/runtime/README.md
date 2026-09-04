# Deterministic slide runtime

This runtime is the executable owner for slide composition. It separates content intent, layout, visual tokens, rendering, and observation so that one slide definition produces matching editable PowerPoint and HTML output.

## Pipeline

1. `planner.mjs` validates audience copy and assigns each content item a registered component. Every item states its job. The planner selects a composition from content count and relationship, or honors an explicit composition.
2. `core.mjs` resolves the open composition tree to a canonical 1280 by 720 scene. It owns sizing, nested sections, deterministic IDs, token resolution, and the design-provenance manifest.
3. `registry.mjs` and `charts.mjs` own reusable component geometry. `page-template.mjs` owns page furniture and the available body frame; content components remain independent of page layout. Renderers never emit adapter-specific values.
4. `adapters/html.mjs` emits an inspection and preview surface from the resolved scene. CSS variables are a serialization of the canonical token registry, not the layout source of truth.
5. `adapters/pptxgenjs.mjs` emits editable PowerPoint primitives through PptxGenJS, adds deterministic object names, and materializes the canonical native theme.
6. `adapters/artifact-tool.mjs` imports the saved PPTX as a downstream adapter and observer. It verifies that Artifact Tool can interpret the PptxGenJS output without losing slides, objects, names, geometry, theme colors, or fonts.

## Composition model

The root can be any nested combination of:

- `flow({ direction: "row" | "column" })`
- `grid({ columns, rows })`
- `overlay({ children })`
- `absolute({ children })`
- `section({ heading, treatment, composition })`
- `component({ component, props })`

Sizes may be fixed pixels, `fill`, `hug`, fractional `{ fr: n }`, or percentage `{ percent: n }`. `hug` is resolved recursively from nested content, and the compiler rejects track, cross-axis, absolute, overlay, and final-scene overflow instead of silently clipping it. Only the native adapter converts pixels to inches. A section accepts another composition tree, so it can contain any number or arrangement of charts, tables, text, processes, or nested sections. No fixed page-level region taxonomy is required.

## Content planning

`planSlide()` consumes an answer-first title plus arbitrary items:

```js
const plan = {
  id: "market-priority",
  title: "Enterprise demand is growing fastest in two segments",
  density: "pre-read",
  source: "Source: CRM and customer research",
  provenanceRequired: true,
  items: [
    {
      id: "growth",
      job: "quantify segment growth",
      component: "chart.column",
      props: chartData,
      relationship: "peer",
      weight: 2,
    },
    {
      id: "implication",
      job: "state the allocation consequence",
      component: "insight",
      props: { text: "Concentrate near-term capacity in the two proven segments." },
      relationship: "peer",
      weight: 1,
    },
  ],
};
```

The planner rejects missing item jobs, unregistered components, generic decorative headings, excess copy, missing required provenance, and Unicode em dashes. It does not invent labels or content. Use explicit `layout` only when the content relationship requires it; otherwise `auto` selects a row, column, grid, overlay, or absolute composition deterministically.

## Page templates

`compileDeck()` and `planDeck()` accept one deck-level `pageTemplate`:

```js
pageTemplate: {
  rules: "none",                  // "bottom" or "top-and-bottom"
  branding: "footer-company",     // "top-right-logo" or "none"
  companyName: "Company Name",
  sourcePlacement: "inline",      // "separate" for an explicit reference treatment
}
```

A slide's `chrome.pageTemplate` overrides only named settings; content plans use `pageTemplate` on the slide record. The resolved deck and slide templates are recorded in the design manifest. `titleVariant` remains independent. `slide-chrome`, standalone `page-template`, and section-divider footers share the furniture renderer. The planner uses that same shell instead of creating a second source row.

For top-right branding, provide `logo: { component: "registered-company-logo", props: { ... } }`. The referenced component must be registered in the supplied registry and render within the reserved 180 by 64 slot. The compiler retains its own token declarations, stable names, and component identity. No logo is fabricated or fetched. Golden examples use the text-only company-name fallback because no corporate logo asset was supplied.

Sources, company name, and page number share a baseline. Sources wrap upward within the remaining left width, and notes consume a measured row above them. The body receives the remaining height: the default single-row footer permits a 518 px body rather than the former 492 px frame. More than three source/note lines, wrapped company names, and competing inline source/footer-left labels fail rather than clip or shrink. Full provenance belongs in notes or an appendix.

`page-template` registers every rule/branding combination, plus wrapped-source, note, and separate-source examples. Full-page fixtures also prove title clearance and body allocation. Standard golden slides use current defaults; reference-fidelity fixtures explicitly retain the source deck's ruled, separate-source treatment.

## Component contract

Every registry definition declares:

- stable ID and version;
- category and semantic role;
- consumed design tokens;
- preferred isolated size;
- representative fixture props;
- registered variants and their default, when applicable;
- a renderer that returns canonical scene primitives and, for composition owners, registered child placements.

Compilation rejects any component that consumes a token absent from its declaration. This makes HTML and PowerPoint inherit the same resolved design instead of relying on adapter defaults.

### Title variants

`action-title` and `section-title` accept `props.variant: "with-line" | "without-line"`. Built-in slide titles use `chrome.titleVariant`. `planSlide()` accepts `titleVariant`; `planDeck()` also accepts a deck-level default, overridden only by an explicit slide value. The default is `without-line`.

The registry exposes each title's variants, default, and property name. The scene and design manifest record the resolved selection. The optional separator sits `space.2` (8 px) below the measured text block, including wrapped titles. Both variants use the same title geometry and tokens; omitting the separator does not shift the text or content. Legacy `rule: true | false` remains an alias for standalone titles (`titleRule` for chrome); conflicting or unknown inputs fail. See the [title owner](../references/components/index.md#action-title-block) for selection guidance.

`text-layout.mjs` measures headings using the installed resolved font through `@napi-rs/canvas` (located through `RUNTIME_NODE_MODULES`, or normal Node module resolution). It freezes line breaks for both adapters. Ruled peers on the same top guide share the tallest measured band, bottom-align their text, and keep an eight-pixel token-bound rule gap. A wrapped heading never shrinks to preserve an obsolete single-line box.

The current registry includes a shared section heading, titles, cover and divider pages, sources, footnotes, page numbers, prose, compact content-driven bullets, insights, panels, quotes, metrics, legends, chart annotations, tables, comparison tables, heatmaps, status lists, image frames, icons, logos, processes, roadmaps, timelines, journeys, trend rows, initiative rollouts, highlight strips, trees, multi-level organizations, matrices, maps, funnels, connectors, rails, contents, and twelve chart families.

## Chart contract

Charts are deterministic editable vectors built from the same scene primitives as other components. Their data model binds annotations and highlights to stable category and series keys before layout. The runtime therefore avoids native-chart reflow separating a label from its mark. Bar, column, stacked, line, area, waterfall, scatter, bubble, pie, donut, and combo charts share axes, scales, tokens, labels, reference lines, highlights, and callout behavior.

`chart-title` owns graph headings. Its `underlined` default shares the section-heading typography and eight-pixel rule gap. Supplying `unit` selects a light-grey unit line below the heading and removes the rule. A chart's optional `heading` and `unit` props, standalone chart titles, and every `chart-group` child use this same owner.

Pie/donut variants are `legend-top-right`, `outside-labels`, and `shared-legend`. The circle stays centred within its allocated plot area. `chart-group` allocates two or three equal chart sections, reserves aligned title bands, and centres one shared legend below them. The category/series key controls colour even when input arrays are reordered. Example data never enters production rendering implicitly.

## Palette and company fonts

Set `palette: "mckinsey" | "bcg" | "bain"` on `compileDeck` or `planDeck`. These are documented presentation presets, not official firm templates. `consulting-toolkit` is retained for reference comparisons.

Fonts are independent of palette. Optional deck-level `typography` accepts `body`, `display`, `serif`, and `semibold: { family, nativeBold, effectiveWeight }`. A company body font must declare its semibold face mapping. `weight.semibold` always requests 600 for direct chart annotations; the native face identifies the actual glyphs, and `nativeBold` states whether the writer must apply its bold flag. A true semibold face uses `effectiveWeight: 600`. A font without that face may explicitly map to 700; this becomes a fallback finding in the design manifest. The current Arial default records that fallback rather than claiming Arial has semibold.

The compiler resolves font variables before text measurement in a scoped context, preserving concurrent deck isolation. HTML and PowerPoint consume the same resolved face and weight. Company fonts must be installed in each consuming renderer; font names alone do not embed or distribute them.

## Acceptance

Run `npm run golden` or `npm run validate:runtime` with the bundled runtime paths. Each run regenerates three palette decks containing every component, registered variant, layout example, and standard composition. The registry drives coverage. Each candidate must pass isolated HTML/PPTX rendering, native text-face/size/weight checks, theme and Artifact Tool readback, overlap checks, and image parity. `output/golden/index.html` shows paired renders; its manifest binds accepted files and reports to source hashes. `npm run golden:check` rejects stale evidence. Failed runs cannot replace the last accepted set.

Use `evals/scripts/validate_component_runtime.mjs` only for a single-palette diagnostic probe. It does not satisfy golden-set release coverage.

The report is `professional-slides.component-validation/v1`. Each fixture records full-frame, blurred-structure, and foreground similarity because a sparse slide can otherwise hide a broken chart. Run `evals/scripts/validate_reference_fidelity.mjs` for eighteen source-mapped composition families. It compares source, HTML, and exact PPTX renders at 3840 by 2160 against both source-image sets, enforces native-only output, and verifies Artifact Tool readback. `import_consulting_toolkit.mjs` separately proves that all 205 source-gallery slides map to registered components and open composition primitives while ignoring the obsolete hand-picked gallery that precedes the source gallery.

Both reports require `validate-overlap.mjs`: browser line-box clipping, text/rule and text/text intersections, visible shape/shape intersections, and heading-gap consistency. It repeats the check with Artifact Tool's recovered PPTX frames and verifies text/explicit wraps; this geometry check complements, rather than replaces, exact-PPTX image comparison. Touching boundaries and subpixel font rounding are tolerated. `overlap-policy.mjs` declares specific containment, masking, and chart/diagram junctions; it cannot exempt text/text or an entire component. `evals/tests/test_overlap.py` injects defects to prove rejection. Repair the owner or composition and rerender; do not add a blanket exception to turn a failed report green.
