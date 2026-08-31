# Charts

Choose a chart from the analytical question, not from visual variety. The chart must make the storyboard's governing claim easy to verify.

## Router

| Analytical question | Default | Read |
| --- | --- | --- |
| Which category is larger or smaller? | Sorted bar/column | [Bar and column](bar-column.md) |
| How has a measure changed over time? | Line | [Line](line.md) |
| How does a total divide into parts? | Stacked bars/areas | [Stacked](stacked.md) |
| How does a survey response mix differ across user groups? | Percentage segments by group | [Percentage segments by user group](percentage-segment-by-group.md) |
| What explains a change from start to finish? | Waterfall | [Waterfall](waterfall.md) |
| How do two or three variables relate? | Scatter/bubble | [Scatter and bubble](scatter-bubble.md) |
| Where are concentrations, gaps, or priorities? | Heatmap/highlight table | [Heatmap and table](heatmap-table.md) |

Avoid pie and donut charts by default. Use them only for a small number of parts, one total, and an audience that benefits from the familiar form. Never use them for precise comparison.

## Universal chart contract

Every chart must define:

- question and intended conclusion;
- categories, series, values, units, period, and population;
- sort order and scale domain;
- actual/estimate/forecast/target/scenario status;
- highlight and annotation targets;
- visible source plus calculation provenance;
- editability and fallback policy for each target platform.

Compute and reconcile the result before designing the visual. The visible data, labels, title, and source ledger must agree after rounding.

## Exhibit-resolution gate

A chart is not complete because marks, axes, and labels exist. Before styling, write the one visual comparison the audience should verify and identify the exact datum, endpoint, gap, benchmark, threshold, distribution, or inflection that proves it. The final plot must make that comparison visible without relying on the action title or a detached takeaway box.

Reject a chart as under-resolved when it is a default chart frame, an isolated bar or metric dressed as a plot, a set of small multiples with inconsistent scales or geometry, a decorative mix of encodings, or a large empty plot with too little evidence to justify the chart form. When the evidence is only one or two endpoint facts, use a metric field, slope, indexed comparison, or annotated range instead of pretending a fuller time series exists.

## Construction rules

1. Match the encoding to the comparison task and use an honest scale.
2. Put metric, unit, population, and period in the exhibit subtitle or labels.
3. Resolve every series, highlight, plot band, and legend key through the [theme token registry](../theming/tokens.md). Use the chart palette only for data-required series, use the light neutral chart-segment role for inactive or comparator segments, and keep all non-chart emphasis on the single structural primary. Never recolour a peer merely because of its order or position.
4. Direct-label when practical; retain a visible legend when hue encodes categories or series unless every mark is labelled unambiguously, and remove legends that merely repeat labels.
5. Reduce gridlines, ticks, borders, decimals, and effects that do not aid use.
6. Use the canonical [chart-callout grammar](../components/chart-callouts.md), keep growth, threshold, gap, and observation annotations attached to evidence, and avoid covering data marks.
7. Bind chart and small-multiple headers to the deck's selected [`section treatment`](../components/guidelines.md); use the preferred open underlined treatment unless the registered slide family requires another mode.
8. Preserve data and semantic chart properties in editable form when reliable.
9. Render and inspect the final PowerPoint or native Google Slides state.

## Cross-platform adapter contract

The storyboard should remain platform-neutral and provide chart type, plot data, axis rules, labels, highlights, annotations, and source IDs. The PowerPoint and Google Slides adapters map those semantics to supported native chart APIs. If a native chart cannot preserve the intended result, prefer editable primitives; use a raster fallback only with explicit user approval and retain source data.

Read [PowerPoint](../tools/powerpoint/index.md) and [Google Slides](../tools/google-slides/index.md) for integration and rendering routes.

## Universal chart alignment

- Treat the plot area, axes, labels, legend, title, annotations, and source as separate regions. Align nearby content to the plot area when analytical comparison matters, not automatically to the outer chart frame.
- Align plot areas across small multiples so equal values occupy comparable positions. Hold axis ranges, zero baselines, category order, and plot dimensions constant unless a declared analytical reason requires a difference.
- Align the zero baseline of adjacent charts whenever the audience will compare magnitude. Do not vertically center charts with different baselines and imply false comparability.
- Reserve space for long category labels before setting the plot guide. If labels require a larger inset, apply the same plot-area inset to comparable charts or choose another construction.
- Place legends, units, periods, actual/forecast keys, and source markers on shared guides. Do not let automatic legend placement change the plot width from page to page.
- Attach annotations to the datum or region they explain. Use consistent leader-line endpoints and offsets; avoid crossing data marks, labels, or other leaders.
- Use the [`design` grid](../design/index.md#canvas-guides-and-grid) and [theming spacing tokens](../theming/tokens.md#primitive-and-role-tokens) for the chart container and the [`component` callout grammar](../components/index.md#callouts-and-annotations) for annotations.
- Render the chart in every final platform and inspect both the object frame and the visible plot, because native chart padding can differ after conversion.

Use the structural HTML specimen in each chart-family owner when it exists. It demonstrates plot, label, annotation, and legend geometry only; the chart's data contract and the active theme tokens remain authoritative.

## Universal acceptance test

Check source values, calculations, sort order, scale, labels, series, legend, annotations, plot-area alignment, and comparable baselines in the final rendered artifact. Then cover the title: the pattern should still be visible. Cover the chart: the title should state that same pattern. Compare the rendered exhibit against recent reference pages of the same analytical job; if the candidate still looks like chart scaffolding, a metric dashboard, or a default office chart, it does not pass even when technically correct.
