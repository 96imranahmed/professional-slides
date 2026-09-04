# Pie and Donut Charts

## Best for

One total divided into two to five mutually exclusive parts when approximate share is enough and the audience benefits from the familiar circular form. Use [stacked bars](stacked.md) when the audience must compare parts across totals or estimate differences precisely.

## Data contract

One reconciled total, two to five positive parts, stable category labels, explicit units, one period and population, a rounding rule, and a declared treatment for missing or residual values. The visible shares must sum to 100% within the disclosed rounding tolerance.

## Core encoding

The core pie is one circle whose angle encodes share of one whole. Start at twelve o'clock, order slices by value unless a natural order matters, and proceed consistently around the circle. Use direct labels containing category and value only when they pass the shared [direct-label gate](index.md#direct-label-gate). Never use perspective, gradients, exploded slices, or several nearly identical hues.

## Registered variants

- `legend-top-right` (default): one horizontal row of square keys in the section's upper-right corner, percentages inside, and no outside category labels. Centre the circle horizontally in the full section and vertically in the remaining plot area below the legend band.
- `outside-labels`: centre the circle in the section, place category labels to its left and right near their slices, and retain percentages inside. Omit the legend. Equal quarters produce the four-corner label arrangement. Reject labels that do not fit or collide; enlarge the region or choose the legend variant.
- `shared-legend`: omit local category labels and legends. Use inside `chart-group` for two or three charts with equal plot space and one bottom-centred horizontal legend. Category keys, not array positions, own colour mapping; reordered inputs keep the same colours. Prefer 100% stacked bars for precise comparisons across totals.

Both `chart.pie` and `chart.donut` expose these three runtime variants. The golden set renders each separately in every palette. A donut centre remains empty unless a separately registered, tested component supplies meaningful content.

Every internal percentage must fit its own slice with four pixels of clearance from its boundaries and any donut hole. The runtime measures the active font and rejects small-slice labels, positive shares that round to zero, and insufficient text height. Enlarge the chart or switch to bar/stacked-bar encoding; do not shrink labels, hide required values, or move percentages outside within these variants.

## Executable examples

Use the registered samples and variants in [`runtime/charts.mjs`](../../runtime/charts.mjs), rendered through the [golden set](../composition/index.md#golden-component-set). There is no separate hand-drawn HTML geometry: both adapters consume the calculated angles, centred circle frame, category anchors, and inside percentage labels from the same scene.

## Platform mapping

Translate the declared twelve-o'clock start angle to the target coordinate origin. Preserve slice order and label anchors, and resolve leader collisions before serialization.

## Failure modes

Reject more than five parts, similar shares needing precise comparison, or changing category-colour mappings across pies. Also reject unrelated centre values, exploded slices, 3D effects, colour-only labels, and pies chosen only because values sum to 100%.

## Acceptance test

Verify the whole and denominator are explicit. Shares reconcile to 100% after rounding. The focal share needs no exploded slice. Labels and legend use one order. A rail-paired chart has one top-right legend row, square swatches, internal percentages, and no duplicate outside labels. A sorted or 100% stacked bar would not make the comparison clearer.
