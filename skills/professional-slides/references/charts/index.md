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

## Meaningful-position gate

Hard requirement: every plotted coordinate must encode a sourced measure, a documented calculation, or an exact named category position. Reject random, pseudo-random, index-cycled, or decorative within-category offsets, including jittered strip plots and beeswarm layouts. Disclosure of jitter does not waive this rule. Category membership belongs at one fixed position; it is not a second quantitative variable.

For scatter and bubble charts, both axes must represent meaningful quantitative measures with units and observation-level provenance. Never encode a category as a numeric band and fabricate variation inside it. Resolve overlapping observations with transparency, explicit multiplicity labels, aggregation, or a different encoding while preserving their true coordinates.

Choose the replacement from the analytical question: a line chart requires a meaningful ordered axis such as release date or year; a scatter can compare gross with IMDb rating when both values belong to the same film. A summary comparison may use bars, and a distribution may use a histogram or empirical cumulative distribution with a defined count or proportion. Do not connect unordered films merely to replace dots with a line.

Before approval, record the meaning and source or calculation of both axes in the dot-dash design cell. Before release, reconcile representative marks to source records and inspect the authoring transformation for artificial offsets. Any arbitrary coordinate is a release-blocking evidence defect, regardless of visual scores.

## Extension and capacity

Chart data arrays are extensible, but the layout is not allowed to clip, overlap, or make a local type exception as categories or points are added. Up to eight horizontal categories or plotted points use the selected page density. Nine to twelve promote the complete page to `pre-read`; more than twelve promote it to `appendix` and still require the encoding-specific fit checks. The threshold applies to the longest category, label, point, or series-value array. A chart that remains illegible after promotion must change orientation, aggregate, use small multiples, or split across pages.

The same principle applies to every chart family: capacity changes the page-level density profile, while the chart retains its semantic label, legend, datapoint, and annotation roles. The planner records the requested, required, and resolved density plus the triggering extent.

## Exhibit-resolution gate

A chart is not complete because marks, axes, and labels exist. Before styling, write the one visual comparison the audience should verify and identify the exact datum, endpoint, gap, benchmark, threshold, distribution, or inflection that proves it. The final plot must make that comparison visible without relying on the action title or a detached takeaway box.

Reject default chart frames, isolated metrics dressed as plots, inconsistent small multiples, and decorative mixed encodings. Also reject a plot when it does not reveal a distinct comparison beyond what a metric field, annotated range, or compact columns would show.

## Construction rules

1. Match the encoding to the comparison task and use an honest scale.
2. Bias the exhibit header to one line: put a material period in a concise chart heading and append the short unit through the shared same-size heading-and-unit treatment. Keep the unit in its secondary colour. Use the measured second-line fallback only after shortening the heading; place population or longer basis text in labels when it would make the header unwieldy.
3. Apply [focus and comparator colours](#focus-and-comparator-colours) and resolve every series, highlight, plot band, and legend key through the [theme token registry](../theming/tokens.md).
4. Apply the [direct-label gate](#direct-label-gate); otherwise use the shared [chart legend](../components/chart-legends.md). Its owner defines placement, variants, exceptions, and the non-colour state cues.
5. Default to a blank plot field without gridlines. Enable quiet gridlines only when a dense scale or several series require intermediate value lookup; never add them as generic chart furniture. When a chart contains fewer than eight plotted values and every value is shown directly, omit the quantitative axis and its ticks by default. Retain the category axis and labels. An explicit scale-reading requirement may retain the value axis, but must not leave redundant value labels and gridlines as generic furniture.
6. Complete the [annotation decision](../components/chart-callouts.md#authoring-decision); attach the selected growth, gap, threshold, or observation to exact evidence and reserve its geometry before plotting.
7. Use the shared [chart-title component](../components/index.md#chart-titles) for graph and small-multiple headings; its owner defines inline units, stacked fallback, underlines, peer alignment, and fit checks. Keep chart-title rules; neighbouring non-chart regions may omit headings and rules when their purpose is clear from content and grouping.
8. Preserve data and semantic chart properties in editable form when reliable.

## Focus and comparator colours

For a focal measure versus a baseline, prior period, benchmark, or peer set, use the deck's `component-primary` for focus and `chart-comparator` for light-grey comparators. Choose the focal category or series from the argument and retain its exact-key mapping across slides, even when arrays are reordered. Do not use dark text grey as the comparator or select two neighbouring brand shades merely because both are in the palette.

In unstacked one-series bars or columns, request `highlights: [{ category: "Current", style: "bar" }]`. For a focal series repeated across grouped bars, request `focusSeries: "Actual"`; its legend must use the same primary/grey mapping. A neutral comparator is background evidence, not a second accent. Use a region outline or tint when the focus is an entire category and existing series identities must remain intact.

Preserve an explicit semantic series mapping when several coequal categories, status meanings, or an authorized reference require it. Use the minimum additional distinguishable colours; a multi-series chart must not collapse different identities into one grey. Record the exception in the treatment ledger. Palette membership alone does not prove contrast.

Check focus against comparator at normal rendered size and in greyscale. Target at least `3:1` luminance contrast between their fills. If the theme or thin marks prevent clear separation, use a theme-bound outline, marker, or direct label and record the exception. Check text against its actual background separately under the [direct-label gate](#direct-label-gate). Never make a pale bar disappear into the canvas to increase its contrast with the focus.

## Direct-label gate

Direct category or series labels and interpretation annotations use the theme's semibold role (weight 600). Direct values, datapoint labels, legends, annotations, category ticks, and quantitative-axis ticks all resolve to the active body size; legend rows and axis ticks remain regular. Company typography supplies the native semibold face; record any explicit fallback when that font lacks one. Do not hard-code Arial or synthesize a different weight in only one adapter.

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

Use the registered chart runtime and its generated previews for geometry. Chart-family guides own data contracts and construction rules; runtime components resolve geometry through the active theme tokens.

## Analytical acceptance test

Reconcile the chart data and calculation before platform QA. Check the title: it states the intended pattern. Check the chart: the pattern remains visible and verifiable without the title. Chart scaffolding, metric dashboards, and default office styling fail even when technically correct. The [evaluation owner](../evaluation/index.md) and platform tools own rendered-file acceptance.

## Segment-linked implications

`chart.column` accepts `segments` for one measure grouped into two or three contiguous category sets. Each segment supplies `id`, `label`, `categories`, `heading` and `items` (multiple implications). Segments must partition every plotted category exactly once in plot order. The renderer retains the common scale, adds segment headings and dividers, and associates each group with a matching coloured header band above a light neutral explanation body. These are group-specific analytical sections, not repeated detached insight boxes.

Use the treatment when distinct groups imply different actions or consequences. Preserve category labels and values; bar colour identifies group membership. Competing category highlights and multiple series are rejected because they would make the colour meaning ambiguous. Keep unsupported deductions out of the explanation bodies.
