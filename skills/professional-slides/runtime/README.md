# Deterministic slide runtime

This runtime is the executable owner for slide composition. It separates content intent, layout, visual tokens, rendering, and observation so that one slide definition produces matching editable PowerPoint and HTML output.

## Pipeline

1. `planner.mjs` validates audience copy and assigns each content item a registered component. Every item states its job. The planner selects a composition from content count and relationship, or honors an explicit composition.
2. `core.mjs` resolves the open composition tree to a canonical 1280 by 720 scene. It owns sizing, nested sections, deterministic IDs, token resolution, and the design-provenance manifest.
3. `registry.mjs` and `charts.mjs` own reusable component geometry; `chart-annotations.mjs` owns keyed change arrows, interval brackets, start-to-end constructions, and aligned annotation rails across compatible chart families. `page-template.mjs` owns page furniture and the available body frame; content components remain independent of page layout. Renderers never emit adapter-specific values.
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
      props: { variant: "tonal", text: "Near-term capacity should focus on the two proven segments because their adoption and economics support sustainable expansion." },
      relationship: "peer",
      weight: 1,
    },
  ],
};
```

The planner rejects missing item jobs, unregistered components, generic decorative headings, excess copy, missing required provenance, and Unicode em dashes. It does not invent labels or content. Use explicit `layout` only when the content relationship requires it; otherwise `auto` selects a row, column, grid, overlay, or absolute composition deterministically.

A justified slide-specific `copyBudget: { maxWordsPerSlide, rationale }` overrides only that slide's density ceiling. Both fields are required; the planner records the effective and default limits in its decision. Copy the effective limit into the exported-file acceptance manifest. This changes neither type tokens nor geometry and never certifies narrative quality; follow the [executive-summary copy owner](../references/components/copy.md#executive-summary-narrative).

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

### Split-section boundaries

`section-boundary` accepts `variant: "inference" | "related" | "subsection"`. Choose the relation explicitly using the [component guideline](../references/components/guidelines.md#split-section-relationships): inference gives a vertical divider and right-pointing marker; related gives a dashed vertical divider; subsection gives a horizontal internal separator. The default is non-directional `related`. Its frame is the reserved content gap, not either content section. An inference frame must fit the token-sized marker and clearance; it never shrinks the marker to fit.

For enclosed context, compose a `section({ treatment: "muted" })` with ordinary `section-heading` (`rule: false`), `paragraph`, and subsection boundaries. Nested groups reuse the same heading and body type tokens. `fixture-layout-context-panel` demonstrates this composition; no separate evidence/synthesis slots or reduced panel font are needed.

Every registry definition declares:

- stable ID and version;
- category and semantic role;
- consumed design tokens;
- preferred isolated size;
- representative fixture props;
- registered variants and their default, when applicable;
- a renderer that returns canonical scene primitives and, for composition owners, registered child placements.

Compilation rejects any component that consumes a token absent from its declaration. This makes HTML and PowerPoint inherit the same resolved design instead of relying on adapter defaults.

### Bullet-list variants

`bullet-list` has `compact` (the existing 12pt role) and `body` variants. Executive summaries use `body`: it resolves the company body font/size, measures every bullet, aligns wrapped lines to a shared hanging inset, and uses a fixed token gap rather than stretching to fill. `measureContent({ frame, props })` returns the body's required height. Insufficient space rejects; it never shrinks type. The [summary copy owner](../references/components/copy.md#executive-summary-narrative) requires multiple distinct bullets per titled theme.

### Title variants

`action-title` and `section-title` accept `props.variant: "with-line" | "without-line"`. Built-in slide titles use `chrome.titleVariant`. `planSlide()` accepts `titleVariant`; `planDeck()` also accepts a deck-level default, overridden only by an explicit slide value. The default is `without-line`.

The registry exposes each title's variants, default, and property name. The scene and design manifest record the resolved selection. The optional separator sits `space.2` (8 px) below the measured text block, including wrapped titles. Both variants use the same title geometry and tokens; omitting the separator does not shift the text or content. Legacy `rule: true | false` remains an alias for standalone titles (`titleRule` for chrome); conflicting or unknown inputs fail. See the [title owner](../references/components/index.md#action-title-block) for selection guidance.

### Section dividers

`section-divider` accepts one `title`, `mode: "dark" | "light"`, and `style: "plain" | "numbered"`. The plain default generates no subtitle or number. The numbered transition requires `sectionId` and places the large identifier in the right field. Rules and optional branding/sources remain `pageTemplate` settings; every style, mode, and rule combination is registered. See the [divider owner](../references/components/index.md#section-dividers).

`tracker-page` is the reusable full navigation state. It accepts one stable `trackerId`, three to eleven `{ id, label }` items, an optional `selectedId`, and registered sequential-circles or split-contents variants in light and dark modes. Split contents also registers regular and long density states. Its selected row defaults to `selectionTreatment: "tint"`, keeping dark text on a light theme-bound surface; `"inverse"` is the explicit stronger alternative and inverts the circular marker outline as well as its label. `tracker-label` is the associated analytical-page state with compact label, breadcrumb, and number-strip variants. `planSlide({ tracker })` renders that compact state above the action title; use the same item objects and selected id as the full page. The runtime rejects stale or unmatched selections, preserves peer geometry, and records tracker and section ids on native nodes for continuity checks.

`text-layout.mjs` measures headings using the installed resolved font through `@napi-rs/canvas` (located through `RUNTIME_NODE_MODULES`, or normal Node module resolution). It freezes line breaks for both adapters. Ruled peers on the same top guide share the tallest measured band, bottom-align their text, and keep an eight-pixel token-bound rule gap. A wrapped heading never shrinks to preserve an obsolete single-line box.

The current registry includes a shared section heading, titles, cover and divider pages, full and compact trackers, sources, footnotes, page numbers, prose, compact content-driven bullets, insights, panels, one-to-five quote clusters, metrics, legends, chart annotations, tables, comparison tables, heatmaps, status lists, image frames, icons, logos, processes, roadmaps, timelines, journeys, trend rows, initiative rollouts, highlight strips, trees, tree-based insight and implication tables, multi-level organizations, matrices, maps, funnels, connectors, rails, and thirteen chart families. The shared [`map` owner](../references/components/maps.md) uses pinned Natural Earth country geometry for standard world, regional, and country presets; common aliases such as US, USA, Europe, MENA, APAC, and EMEA resolve to one canonical geography. Country highlights and crop-relative or country-anchored markers remain editable native shapes in PowerPoint.

`insight` implements the [shared insight box](../references/components/insight-box.md): tonal by default, with neutral, dotted and primary variants. Supply a complete sentence in `text`; omit `heading` for a single conclusion. `align` defaults to center and may be left for long full-width copy. Use `measureContent` before allocating the frame; the renderer preserves regular body type and rejects overflow.

Paragraphs and tables freeze measured line breaks for both adapters. The canonical [`typed table`](../references/charts/heatmap-table.md) uses `tables.mjs` for text, bullets, categories, highlights, exact numbers, binary indicators, Harvey balls, heatmaps, bars, and implication columns. Rows and columns are entirely data-driven rather than capped by a business-specific schema. Columns supply defaults; cells may override them, and category cells may span grouped rows. `treatment: "open"` is the default header style. Dense cardinalities select the compact rhythm for the table as a whole; callers may still explicitly choose `density: "body"` or `"compact"`. Numeric cells default to centred theme-bound circles and accept `numberDisplay: "plain"` for ordinary right-aligned values. Named scales generate shared legends below the exhibit.

`planSlide` resolves a page-level capacity density for extensible exhibits. Four-branch or six-leaf `insight-tree-table` pages, charts with nine to twelve categories or points, and tables beyond five rows or four columns promote to `pre-read`; charts beyond twelve marks and tables beyond eight rows or six columns promote to `appendix`. The compiler applies the resolved profile to every `type.*` token on the page, so titles, bodies, legends, datapoints, annotations, and table text step down together. The decision records requested, required, resolved, and the triggering capacity evidence. A component-specific compact variant may still change internal geometry, but it does not replace page-level density resolution.

Category fills and inference markers share `color.componentPrimary`, which resolves to dark navy in the McKinsey preset. Binary confirmation cells default to compact `icon.small` check, cross, or missing marks without repeated state text; `labelDisplay: "state"` enables the labelled variant. A grouped category may add a unique natural `sectionNumber`; its disc is centered on and protrudes above the category block rather than attaching to the top-left corner. Table implication arrows use compact `icon.medium` discs and editable chevron strokes in both adapters. Compose the table first and one shared insight below it; do not build separate table renderers for business topics. The table registry's 18 variants and two complete table/insight compositions are included in every golden run.

`insight-tree-table` is the composite relationship owner for a root that branches through named drivers into two to seven leaf rows. Each leaf carries one aligned insight and one to four implications. The runtime lays out the tree against the row centers, routes orthogonal connectors behind the node boxes, uses a disc-chevron for leaf-to-insight support, and uses a native line with a triangular arrowhead for insight-to-implication direction. `rowTreatment: "tonal"` is the default; `"open"` preserves the geometry while removing the neutral row fill. See the [relationship owner](../references/components/relationships.md#tree-based-insight-and-implication-tables).

## Chart contract

Charts are deterministic editable vectors built from the same scene primitives as other components. Their data model binds annotations and highlights to stable category and series keys before layout. The runtime therefore avoids native-chart reflow separating a label from its mark. Bar, column, stacked, line, area, waterfall, scatter, bubble, pie, donut, combo, and horizons charts share the applicable axes, scales, tokens, labels, reference lines, highlights, and callout behavior. `chart.horizons` adds curve, annotated-step, and minimal-step variants over one ordered horizon record; its conceptual axes use explicit native triangular arrowheads.

`chart-title` owns graph headings. Its `underlined` default shares the section-heading typography and eight-pixel rule gap. Supplying `unit` selects a light-grey body-sized unit or subtitle line below the heading and removes the rule. Cover subtitles use that same standard body size. A chart's optional `heading` and `unit` props, standalone chart titles, and every `chart-group` child use this same owner.

`valueFormat: { decimals, prefix, suffix }` formats visible values without rounding the source data or mark geometry. Axis labels retain fractional ticks. Waterfalls support signed `yMin`/`yMax` domains and negative closing totals; lines accept `directLabels: "end"` to replace a legend with semibold series-and-value endpoints. Both have isolated golden variants. Speaker notes pass through the planner, canonical scene and PowerPoint adapter unchanged; use them for derivations and methodology, following the [copy owner](../references/components/copy.md#insight-versus-speaker-notes).

Pie/donut variants are `legend-top-right`, `outside-labels`, and `shared-legend`. The circle stays centred within its allocated plot area. `chart-group` allocates two or three equal chart sections, reserves aligned title bands, and centres one shared legend below them. A paired group accepts `divider: true` for one quiet rule centered in the gutter; three-chart groups reject it.

Bar and column charts accept one `highlights` entry. `style: "bar"` focuses one category in an unstacked one-series chart using component primary against neutral peers. `style: "region-box"` draws a primary outline around the complete category, while `style: "region-tint"` uses a light neutral field. Both region styles add symmetric breathing room beyond the plot rails and keep the category label clear. A missing style retains the neutral-tint behavior. Grouped bars use a region style so their series mapping remains intact. Exactly two unstacked marks use the strongest contrasting pair from the active chart palette unless `colorIndices` explicitly owns the series mapping. The category/series key controls colour even when input arrays are reordered. Example data never enters production rendering implicitly.

Compatible categorical, line, waterfall, scatter, and combo charts accept `changeAnnotations`. Each entry declares exact `start` and `end` category keys, optional series keys, concise `text`, and `style: "arrow" | "bracket" | "construction"`. Arrow is directional A-to-B movement, bracket is a selected interval, and construction is a reconciled opening-to-closing bridge. Chronological column, stacked-column, line, waterfall, and combo charts may also use `annotationRail: { items: [{ category, text }] }` for one secondary row below the category labels. Pie, donut, scatter, and horizontal category axes reject that rail. Datapoint labels and legends use `type.chartLabel`; callouts and change labels use `type.chartAnnotation`. Both roles resolve to `type.body` by default, while their regular or semibold weights remain distinct. Every label uses the active component primary rather than a local accent.

Charts omit gridlines by default. Set `gridlines: true` only when dense or multiseries evidence requires intermediate scale lookup; axes and tick labels remain available on the clean plot.

## Palette and company fonts

Set `palette: "mckinsey" | "bcg" | "bain"` on `compileDeck` or `planDeck`. These are documented presentation presets, not official firm templates. `consulting-toolkit` is retained for reference comparisons.

Fonts are independent of palette. Optional deck-level `typography` accepts `body`, `display`, `serif`, and `semibold: { family, nativeBold, effectiveWeight }`. A company body font must declare its semibold face mapping. `weight.semibold` always requests 600 for direct chart annotations; the native face identifies the actual glyphs, and `nativeBold` states whether the writer must apply its bold flag. A true semibold face uses `effectiveWeight: 600`. A font without that face may explicitly map to 700; this becomes a fallback finding in the design manifest. The current Arial default records that fallback rather than claiming Arial has semibold.

The compiler resolves font variables before text measurement in a scoped context, preserving concurrent deck isolation. HTML and PowerPoint consume the same resolved face and weight. Company fonts must be installed in each consuming renderer; font names alone do not embed or distribute them.

## Acceptance

Run `npm run check` once after the implementation batch is written; it resolves the bundled Node/Python runtime automatically, runs the source-quality gate, and executes the complete regression suite. Then run `npm run golden` or `npm run validate:runtime` with the bundled presentation paths. Each run regenerates one canonical McKinsey deck containing every component and registered variant, all standard compositions, and a curated set of composition fixtures; fast contract tests cover the other supported palette inputs and the exhaustive non-golden layout suite without repeating the expensive gallery. Compatible variants share paginated grid boards, while dense or full-frame variants remain isolated. Coverage is recorded for every rendered component instance, including each default and non-default branch. The deck is ordered as standard compositions, composition examples, then component families with adjacent variants. The registry drives coverage. The candidate must pass isolated HTML/PPTX rendering, native text-face/size/weight checks, theme and Artifact Tool readback, overlap checks, and image parity. `output/golden/index.html` shows the same hierarchy with paired renders; its manifest binds accepted files, reports, the gallery index, and all runtime/evaluation sources to hashes. `npm run golden:check` rejects stale evidence. Failed runs cannot replace the last accepted set.

Use `evals/scripts/validate_component_runtime.mjs` only for a single-palette diagnostic probe. It does not satisfy golden-set release coverage.

The gallery groups page furniture with composed chrome, section containers with heading leaves, and both title levels as one family. Independent fixtures remain for each API layer and variant; grouping does not hide or remove test coverage.

The report is `professional-slides.component-validation/v1`. Each fixture records full-frame, blurred-structure, and foreground similarity because a sparse slide can otherwise hide a broken chart. Run `evals/scripts/validate_reference_fidelity.mjs` for sixteen source-mapped composition families. It compares source, HTML, and exact PPTX renders at 3840 by 2160 against both source-image sets, enforces native-only output, and verifies Artifact Tool readback. The replacement [plain deck cover](../references/components/index.md#deck-cover) and [single-title dividers](../references/components/index.md#section-dividers) remain in the golden set; they are not compared to retired decorative or labelled artwork. `import_consulting_toolkit.mjs` separately proves that all 205 source-gallery slides map to registered components and open composition primitives while ignoring the obsolete hand-picked gallery that precedes the source gallery.

Both reports require `validate-overlap.mjs`: browser line-box clipping, text/rule and text/text intersections, visible shape/shape intersections, and heading-gap consistency. It repeats the check with Artifact Tool's recovered PPTX frames and verifies text/explicit wraps; this geometry check complements, rather than replaces, exact-PPTX image comparison. Touching boundaries and subpixel font rounding are tolerated. `overlap-policy.mjs` declares specific containment, masking, and chart/diagram junctions; it cannot exempt text/text or an entire component. `evals/tests/test_overlap.py` injects defects to prove rejection. Repair the owner or composition and rerender; do not add a blanket exception to turn a failed report green.
