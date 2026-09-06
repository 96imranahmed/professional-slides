# Chart Legends

Chart legends decode series, categories, statuses, and line or marker semantics shared by a chart or coordinated exhibit. They are one reusable component, not a chart-family variant.

## Use when

Use a legend when hue, pattern, line style, or symbol carries meaning that is not printed beside every mark. Prefer direct labels when they remain unambiguous and do not collide. Remove a legend that only repeats visible axis labels or direct labels.

## Contract

- preserve the exact series or category order used in the chart;
- use the same token-bound key geometry and label grammar across peer charts;
- show every active encoding and no unused item;
- keep one shared legend for coordinated small multiples;
- pair actual, estimate, forecast, target, scenario, or missing states with a non-colour cue such as line style, outline, hatch, or explicit text;
- never let automatic native placement change the plot width or peer alignment.

## Registered variants

- `swatch`: filled square or short bar for categorical or stacked series. Default for bars, columns, pies, and areas.
- `line`: short line sample with the plotted stroke, dash, and optional marker. Default for line and combo charts.
- `marker`: point symbol for scatter or bubble categories when the shapes differ or hue requires decoding. An optional neutral light-gray circle may describe bubble-area magnitude in the same row; its marker size is a legend key only and does not alter the data scale.
- `state`: explicit actual, forecast, target, scenario, or missing key with both text and a non-colour cue.

Placement is independent of variant. Use a horizontal `top-right` legend by default for multi-series analytical charts so series decoding precedes the plot, the row ends on the chart region's right guide, and related slides preserve a stable plot width. Use the same horizontal `top-right` placement for a pie or donut: render one row of square swatches and labels above the plot. Use `top` only when a nearby left-aligned chart heading or explicit reference geometry makes that alignment more coherent. Use `right` only when the plot stays wide enough. Use `inline` beside a local section heading only when peer plot geometry remains unchanged.

For multiple coordinated charts, use `bottom-center`: one horizontal row centred across their combined width, without a surrounding highlight box. Use the [chart-group contract](#coordinated-chart-groups) below. A legend must fit at its declared font size; fail instead of shrinking or distributing labels across arbitrary equal-width cells.

Legend labels use the chart-label role at the active body size. Keep them regular even when direct labels or annotations use semibold. If a body-sized row does not fit, shorten the labels, widen the chart region, use direct labels, or select another encoding; do not introduce a smaller local legend size.

The standalone legend primitive permits all twenty combinations of its four key variants and five placements; the golden set tests that capability matrix. The chart-situation router above selects the appropriate combination for an actual exhibit. Isolation coverage does not authorize ignoring that router or require displaying every combination in a deck.

## Coordinated chart groups

`chart-group` is registered by [`runtime/chart-group.mjs`](../../runtime/chart-group.mjs). Supply `charts`, an array of two (`paired`) or three (`triple`) children, each with `component`, `props`, and optional `heading` and `unit`. Supported children are pie, donut, bar, column, stacked bar/column, line, and area charts. An explicit group variant must match the child count.

Optional `categoryKeys` gives the exact shared key order. Otherwise the first occurrence across children determines order. Pie/donut `props.labels` and other charts' `props.series[].name` supply the keys; every used key must occur exactly once in the shared mapping, with at most six keys. Reordering a child's input never changes its category colours.

The group allocates equal-width children, a common measured [chart-title band](index.md#chart-titles), and a reserved bottom legend band. It disables local legends and outside pie labels, then renders one bottom-centred legend. Geometry and token declarations live in the executable owner. Child nodes retain stable group/child IDs and remain editable primitives in both adapters; this does not promise a native PowerPoint chart or group object. Golden fixtures cover paired and triple groups, donuts, unit headings, and columns. Reject legend overflow, unsupported children, or inconsistent keys before export.

## Theme contract

| Component | Consumed custom properties | Canonical source |
| --- | --- | --- |
| chart legend | `--chart-legend-font`, `--chart-legend-color`, `--chart-legend-gap`, `--chart-legend-item-gap`, `--chart-legend-key-size`, `--chart-legend-line-length`, `--chart-legend-series-1` through `--chart-legend-series-6`, `--chart-legend-neutral`, `--chart-legend-forecast-border` | [component bindings](../theming/component-bindings.md#evidence-components) |

## Native translation

Use the canonical [scene-to-native chart mapping](../tools/css-to-native-mapper.md#chart-mapping). Group the legend with the chart or coordinated exhibit, never with page furniture.

## Acceptance check

Verify each key maps to one visible encoding and follows chart order. Actual and forecast remain distinct without colour. Peer exhibits share one mapping. Legends do not shift comparable plots. A default `top-right` legend remains one row above the plot and ends on the chart region's right guide. Every label is readable in the final render.
