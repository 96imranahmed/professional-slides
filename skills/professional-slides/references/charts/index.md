# Charts

Choose a chart from the analytical question, not from visual variety. The chart must make the storyboard's governing claim easy to verify.

## Router

| Analytical question | Default | Read |
| --- | --- | --- |
| Which category is larger or smaller? | Sorted bar/column | [Bar and column](bar-column.md) |
| How has a measure changed over time? | Line | [Line](line.md) |
| How does a total divide into parts? | Stacked bars/areas | [Stacked](stacked.md) |
| How does one small total divide into a few familiar parts? | Pie or donut, by exception | [Pie and donut](pie-donut.md) |
| How does a survey response mix differ across user groups? | Percentage segments by group | [Percentage segments by user group](percentage-segment-by-group.md) |
| What explains a change from start to finish? | Waterfall | [Waterfall](waterfall.md) |
| How do two or three variables relate? | Scatter/bubble | [Scatter and bubble](scatter-bubble.md) |
| Where are concentrations, gaps, or priorities? | Heatmap/highlight table | [Heatmap and table](heatmap-table.md) |
| How do current, emerging, and future growth plays mature over time? | Horizons | [Horizons](horizons.md) |

Avoid pie and donut charts by default. Use them only for a small number of parts, one total, and an audience that benefits from the familiar form. Never use them for precise comparison. Their complete exception contract lives in [Pie and donut](pie-donut.md).

## Core encodings and variants

A chart file owns one analytical encoding and its valid variants. Content labels such as `competitor`, `forecast`, or `survey` do not create chart families. Labelled quadrants and distance bands both inherit the scatter position contract. An auxiliary margin row still inherits the waterfall arithmetic bridge.

Each registered chart type also supplies fixture guidance for speaker notes: when to use the encoding, why it answers the analytical question, and what the page action title should reflect. Chart variants inherit that guidance unless the variant changes the analytical comparison. Do not place this instructional copy on the slide canvas.

Add a variant to an existing owner when the x/y marks, reconciliation rule, or comparison task remains the same. Create a new chart owner only when the base encoding or data contract is materially different. Shared legends, change arrows, interval brackets, start-to-end constructions, annotation rails, forecast bands, focal spans, and evidence leaders belong to reusable components and are referenced by chart owners rather than recoded inside each chart file.

## Universal chart contract

Every chart must define:

- question and intended conclusion;
- categories, series, values, units, period, and population;
- sort order and scale domain;
- each applicable actual, estimate, forecast, target, or scenario status, or an explicit actual-only state;
- highlight and annotation targets;
- visible source plus calculation provenance;
- editability and fallback policy for each target platform.

Compute and reconcile the result before designing the visual. The visible data, labels, title, and source ledger must agree after rounding.

## Extension and capacity

Chart data arrays are extensible, but the layout is not allowed to clip, overlap, or make a local type exception as categories or points are added. Up to eight horizontal categories or plotted points use the selected page density. Nine to twelve promote the complete page to `pre-read`; more than twelve promote it to `appendix` and still require the encoding-specific fit checks. The threshold applies to the longest category, label, point, or series-value array. A chart that remains illegible after promotion must change orientation, aggregate, use small multiples, or split across pages.

The same principle applies to every chart family: capacity changes the page-level density profile, while the chart retains its semantic label, legend, datapoint, and annotation roles. The planner records the requested, required, and resolved density plus the triggering extent.

## Exhibit-resolution gate

A chart is not complete because marks, axes, and labels exist. Before styling, write the one visual comparison the audience should verify and identify the exact datum, endpoint, gap, benchmark, threshold, distribution, or inflection that proves it. The final plot must make that comparison visible without relying on the action title or a detached takeaway box.

Reject default chart frames, isolated metrics dressed as plots, inconsistent small multiples, and decorative mixed encodings. Also reject a plot when it does not reveal a distinct comparison beyond what a metric field, annotated range, or compact columns would show.

## Construction rules

1. Match the encoding to the comparison task and use an honest scale.
2. Put metric, unit, population, and period in the exhibit subtitle or labels.
3. Resolve every series, highlight, plot band, and legend key through the [theme token registry](../theming/tokens.md). Use the chart palette only for data-required series, use the light neutral chart-segment role for inactive or comparator segments, and keep all non-chart emphasis on the single structural primary. Never recolour a peer merely because of its order or position.
   For exactly two unstacked bars or columns, or two series repeated across grouped categories, use a strongly contrasting pair from the active chart palette when no explicit series mapping exists. Keep legend colours identical to the marks. For focus, choose one mechanism: a primary single-bar highlight, a theme-primary region outline, or a light-neutral region tint. Both region treatments need visible padding around the marks on all sides, with category labels clear of the highlighted region.
4. Apply the [direct-label gate](#direct-label-gate); otherwise use the shared [chart legend](../components/chart-legends.md). Its owner defines placement, variants, exceptions, and the non-colour state cues.
5. Default to a blank plot field without gridlines. Enable quiet gridlines only when a dense scale or several series require intermediate value lookup; never add them as generic chart furniture.
6. Use the canonical [chart-callout grammar](../components/chart-callouts.md), keep growth, threshold, gap, and observation annotations attached to exact evidence, and avoid covering data marks or labels.
7. Use the shared [chart-title component](../components/index.md#chart-titles) for graph and small-multiple headings; its owner defines underlines, units, peer alignment, and fit checks.
8. Preserve data and semantic chart properties in editable form when reliable.

## Direct-label gate

Direct category or series labels and interpretation annotations use the theme's semibold role (weight 600). Direct values, datapoint labels, legends, and annotations all resolve to the active body size; legend rows remain regular, and axes may retain their separate compact furniture role. Company typography supplies the native semibold face; record any explicit fallback when that font lacks one. Do not hard-code Arial or synthesize a different weight in only one adapter.

Use a direct data label only when it remains at the registered body-sized chart-label role, stays inside the plot or declared label gutter, has at least `4.5:1` text contrast, and clears every mark, label, axis, and leader by at least four canonical pixels after deterministic collision resolution. A direct data label must identify the category or series and the value when the value is not already printed. Interpretation annotations instead follow the [chart-callout contract](../components/chart-callouts.md). If any required data label fails, keep only non-colliding decisive labels and use the shared legend; if the remaining legend-plus-plot relationship is still ambiguous, select another chart.

## Cross-platform adapter contract

The chart owner supplies the platform-neutral semantic model. The [scene-to-native mapper](../tools/css-to-native-mapper.md#chart-mapping) owns translation; [PowerPoint](../tools/powerpoint/index.md) and [Google Slides](../tools/google-slides/index.md) own platform operations and QA. Chart-family files add only encoding-specific conversion risks.

## Universal chart alignment

- Treat the plot area, axes, labels, legend, title, annotations, and source as separate regions. Align nearby content to the plot area when analytical comparison matters, not automatically to the outer chart frame.
- Align plot areas across small multiples so equal values occupy comparable positions. Hold axis ranges, zero baselines, category order, and plot dimensions constant unless a declared analytical reason requires a difference.
- Align the zero baseline of adjacent charts whenever the audience will compare magnitude. Do not vertically center charts with different baselines and imply false comparability.
- Reserve space for long category labels before setting the plot guide. If labels require a larger inset, apply the same plot-area inset to comparable charts or choose another construction.
- Place legends, units, periods, actual/forecast keys, and source markers on shared guides. Do not let automatic legend placement change the plot width from page to page.
- Attach annotations to the datum or region they explain. Use consistent leader-line endpoints and offsets; avoid crossing data marks, labels, or other leaders.
- Apply the [`design` grid](../design/index.md#canvas-guides-and-grid) to the chart container and the [`chart-callout` grammar](../components/chart-callouts.md) to annotations.
- Keep the chart's declared plot frame separate from its outer component frame so adapter-specific font metrics cannot silently change the analytical alignment.

Use the structural HTML specimen in each chart-family owner when it exists. It demonstrates plot, label, annotation, and legend geometry only; the chart's data contract and the active theme tokens remain authoritative.

## Analytical acceptance test

Reconcile the chart data and calculation before platform QA. Check the title: it states the intended pattern. Check the chart: the pattern remains visible and verifiable without the title. Chart scaffolding, metric dashboards, and default office styling fail even when technically correct. The [evaluation owner](../evaluation/index.md) and platform tools own rendered-file acceptance.
