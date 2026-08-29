# Charts

Choose a chart from the analytical question, not from visual variety. The
action title states the conclusion; the chart makes that conclusion easy to
verify.

## Router

| Analytical question | Default | Read |
| --- | --- | --- |
| Which category is larger or smaller? | Sorted bar/column | [Bar and column](bar-column.md) |
| How has a measure changed over time? | Line | [Line](line.md) |
| How does a total divide into parts? | Stacked bars/areas | [Stacked](stacked.md) |
| What explains a change from start to finish? | Waterfall | [Waterfall](waterfall.md) |
| How do two or three variables relate? | Scatter/bubble | [Scatter and bubble](scatter-bubble.md) |
| Where are concentrations, gaps, or priorities? | Heatmap/highlight table | [Heatmap and table](heatmap-table.md) |

Avoid pie and donut charts by default. Use them only for a small number of
parts, one total, and an audience that benefits from the familiar form. Never
use them for precise comparison.

## Universal chart contract

Every chart must define:

- question and intended conclusion;
- categories, series, values, units, period, and population;
- sort order and scale domain;
- actual/estimate/forecast/target/scenario status;
- highlight and annotation targets;
- visible source plus calculation provenance;
- editability and fallback policy for each target platform.

Compute and reconcile the result before designing the visual. The visible
data, labels, title, and source ledger must agree after rounding.

## Construction rules

1. Match the encoding to the comparison task and use an honest scale.
2. Put metric, unit, population, and period in the exhibit subtitle or labels.
3. Use one accent for decisive evidence and neutral colors for context.
4. Direct-label when practical; remove redundant legends and decoration.
5. Reduce gridlines, ticks, borders, decimals, and effects that do not aid use.
6. Keep annotations close to evidence and avoid covering data marks.
7. Preserve data and semantic chart properties in editable form when reliable.
8. Render and inspect the final PowerPoint or native Google Slides state.

## Cross-platform adapter contract

The blueprint should remain platform-neutral and provide chart type, plot data,
axis rules, labels, highlights, annotations, and source IDs. The PowerPoint and
Google Slides adapters map those semantics to supported native chart APIs. If
a native chart cannot preserve the intended result, prefer editable primitives;
use a raster fallback only with explicit user approval and retain source data.

Read [PowerPoint](../../tools/powerpoint/index.md) and [Google Slides](../../tools/google-slides/index.md)
for integration and rendering routes.

## Annotation grammar

- short analytical claim followed by the value or cause;
- one annotation style throughout the deck;
- explicit visual distinction between events, targets, and analysis;
- short leader line that never crosses another label;
- no annotation that merely repeats an already visible value.

## Universal acceptance test

Check source values, calculations, sort order, scale, labels, series, legend,
and annotations in the final rendered artifact. Then cover the title: the
pattern should still be visible. Cover the chart: the title should state that
same pattern.
