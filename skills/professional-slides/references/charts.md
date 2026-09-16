# Charts

Choose the chart from the analytical question. The chart makes the page's governing claim easy to verify.

## Router

| The reader's question | Default |
| --- | --- |
| Which category is larger or smaller? | Sorted bar or column |
| How does an observed or modeled trajectory evolve across meaningful periods? | Line, when the trajectory is the question |
| How does a total divide into parts? | Stacked bars or areas |
| How does one small total divide into a few familiar parts? | Pie or donut, by exception |
| How does a survey response mix differ across user groups? | Percentage segments by group |
| What explains a change from start to finish? | Waterfall |
| How do two or three variables relate? | Scatter, or bubble with a meaningful third measure |
| Where are concentrations, gaps or priorities? | Heatmap or typed table |
| How do current, emerging and future growth plays mature over time? | Horizons |

## Choose from the evidence you have

| Available evidence and question | Encoding | Instead of |
| --- | --- | --- |
| One comparable value per category, including a common future endpoint | Bars on a common basis | A line joining categories |
| One observed rate mechanically repeated over future years | One bar per category for the common endpoint, with the implication beside it | A cumulative straight line shown as temporal insight |
| Only start and finish are known | Paired or grouped bars; a slope when direction is the actual question | Fabricated intermediate points |
| Multiple observed periods, or a published model with a path | A line, when turning points, acceleration or volatility matter | A line chosen because the labels are years |
| Ordered stages with reconciled contributions to a total | Waterfall | Unreconciled causal claims |
| Shares of the same total across matched groups | 100% stacked bars | Separate pies compared precisely |
| Paired observations of two measured variables | Scatter; bubble with a third variable | Causation read from association |
| Distribution across many observations | Histogram or empirical cumulative distribution | An average alone when spread is the question |
| Mixed qualitative criteria, or exact lookup values | Typed table | Text categories forced into a graph |

A straight observed series is legitimate; the distinction is provenance. Measured or modeled points establish a path; multiplying one fixed rate by 1, 2, 3, 4, 5 adds none. Record `constant-rate-scenario` for an accumulated rate and `endpoint-only` for endpoint evidence.

## Meaningful-position gate

Every plotted coordinate encodes a sourced measure, a documented calculation or an exact named category position. Category membership sits at one fixed position: it is a label, not a second quantitative variable. For scatter and bubble charts, both axes carry real quantitative measures with units and observation-level provenance.

Resolve overlapping observations with transparency, explicit multiplicity labels, aggregation or a different encoding, each of which preserves the true coordinates. Jitter, index-cycled offsets and beeswarm layouts place marks where no observation exists, and disclosing that does not restore the evidence. Record the meaning and source of both axes before approval, reconcile representative marks to source records before release, and treat an arbitrary coordinate as a blocker whatever the visual scores say.

## Universal contract

Every chart defines: the question and intended conclusion; categories, series, values, units, period and population; sort order and scale domain; the status of each value (actual, estimate, forecast, target or scenario); highlight and annotation targets; visible source plus calculation provenance. Reconcile the result before designing the visual, so data, labels, heading and source agree on basis and precision.

Calculate from unrounded inputs and round for display; keep independently rounded source parts and totals as published, with a rounding note. A total that disagrees with its stated formula is a source conflict: show the reported figure and limit the conclusions that depend on it. Keep actuals, forecasts and sensitivities distinct, including scenario name, baseline, period, population and gross or net state.

## Construction

1. Match the encoding to the comparison task and use an honest scale.
2. The exhibit header is a heading naming measure, population and period, with the unit beside it or under it. `unitPlacement: "inline"` (what the composer asks for beside a text column and on a full-width chart) sets a comma after the heading, then the unit on the same line at the heading's size in `color.chartUnit` and the band is one line deep; it falls back to the stacked line when the heading wraps or the pair will not fit. The stacked form — compact grey on a second line inside the same band, carrying a base year or sample size where the reader needs it — is for charts that share a row with peers, where the two-line band aligns across them. The heading carries no statistics; values live on the marks. A `cagr: {from, to}` on the spec puts the compound rate on the growth arrow (`+13% p.a.`); a `badge` prop prints a pill at the band's right.
3. Resolve every series, highlight, plot band and legend key through the theme tokens, and keep those properties editable in the exported file.
4. Direct-label values when they pass the label gate; otherwise use the shared legend.
5. Default to a blank plot field, adding quiet gridlines when a dense scale needs intermediate lookup. When every mark carries its value, omit the quantitative axis, keep the category axis, and let the domain fit the data (zero-anchored for bars, padded for lines) so the tallest mark uses the plot; the axis returns with `showValueAxis: true` or `gridlines: true`.
6. Decide the annotation before plotting: attach the growth, gap, threshold or observation to exact evidence and reserve its geometry.

**Focus and comparator colours.** For a focal measure against a baseline, benchmark or peer set, use `component-primary` for focus and `chart-comparator` for the light-grey comparators, choosing the focal category from the argument and keeping its exact-key mapping across slides. One-series bars request `highlights: [{category, style: "bar"}]` and the highlighted bar takes the palette accent (`color.accent`) while the rest keep the series colour; the composer sets that highlight itself when the action title names a category. Grouped bars request `focusSeries`. Target 3:1 contrast between the two fills, in colour and in greyscale.

**Growth indicators.** The composer adds the change a chart measures: a first-to-last arrow with a bubble on a period series (columns) or across stacked totals, a bubble beside the last point of a line, and per-category brackets between two series when the title names a gap. `changeAnnotations` written by hand take the same styles (`arrow`, `bracket`, `construction`, `end-bubble`, `interval-label`) with one scalar per bubble (`+21%`, `+8 pp`, `+13% p.a.`).

**Survey-deck furniture.** `deltas: [n, …]` (aligned with the categories, or `[{category, value, significant}]`) adds a column of signed change discs to the right of a horizontal bar chart under a `deltasLabel` heading, filled in the accent or negative colour when the change clears `deltaThreshold` (5). `stackBracket: [series…]` brackets the named segments of each stacked column and prints their sum beside it. `change: "steps"` puts a compact bracket with the change between every adjacent pair of a period series, for small multiples. Legends wrap onto further rows when their items outrun the chart, and peer charts reserve the same rows.

**Time-series furniture.** `periods: [{ from, to, label }]` brackets runs of categories above a column or line chart, the label centred over a hairline bracket and a dashed divider dropped between adjacent periods to the baseline; the band sits above the value labels and any growth arrow. `events: [{ at, label }]` drops a dashed line at a category from a two-line flag above the plot, flags alternating between two rows; a flag near the right edge sits left of its line. Both reserve their band in the plot frame and are drawn as shapes, never as a native chart. A drawn line chart with more periods than label slots labels every nth category and keeps the first and last. **Paired bars** (`paired: true` on `chart.bar`, two or three series) become a row of drawn panels, one per series, the first carrying the category labels and the later ones `categoryLabels: false`, each headed by its series name and on its own scale; the panels share one top band so their rows align. **`chart.bubble-grid`** takes `rows`, `columns` and a `values` matrix of non-negative numbers: a bubble per nonzero cell with diameter proportional to the square root of the value (the largest at 86% of the cell), the value inside from 24px up and above the bubble below that, hairlines between rows, bold row labels at the left and column labels along the foot. **`segmentGrowth: { from, to, label? }`** on a stacked column adds a column right of the plot headed "CAGR from–to" (or "Change from–to" when the categories are not years) with one signed rate per series, level with that series' segment in the `to` stack; the composer drops the implied first-to-last arrow when the column is present. **`chart.marimekko`** takes `categories`, `series` of non-negative values and optional `widths`: each column is as wide as its total (or its width) and stacks its series to 100%, the share printed inside every segment that holds it (`percentLabels: false` prints the values instead), the column total (or width) above and the category below; drawn, never native. **`chart.waffle`** is the unit chart: one series of integer counts, one dot per unit in a block per category (columns from the square root of the largest count, ten for `percent: true`, where unfilled dots stay grey), the count above and the category below.

**Forecast, labels and companions.** `forecastFrom: "<category>"` shades every bar from that category on in the forecast tint and marks the boundary. Value labels are 11pt semibold: inside the bar in white when the bar is wide enough, outside it otherwise. `dataTable: [[...]]` hugs a value table under the chart, its columns aligned to the categories; `center: "value"` prints a KPI in a donut's hole; multi-series lines drop the legend and carry `endLabels` (the series name at the end of each line). Native charts keep these as per-point fills and data labels in the exported workbook chart.

**Direct-label gate.** A direct label stays at the body-sized chart-label role, sits inside the plot or the declared gutter, reaches 4.5:1 text contrast, and clears every mark, label, axis and leader by four pixels. It identifies the category or series, and the value when the value is not already printed. Labels and annotations use the semibold role; legend rows and axis ticks stay regular. When a required label cannot fit, keep the decisive non-colliding labels and use the shared legend.

**Alignment and capacity.** Align neighbouring content to the plot area, hold axis ranges, zero baselines, category order and plot dimensions constant across small multiples, and reserve space for long labels before setting the plot guide. A chart that outgrows its page changes orientation, aggregates, becomes small multiples, or splits.

## Bar and column

Category comparison, ranking, discrete periods, actual-versus-benchmark pairs. One categorical dimension, one or a few series, explicit units, a declared order, one finite value per category per series, bounds containing every value and zero. Horizontal bars for long labels or rankings, vertical columns for up to eight ordered periods. Sort by value unless another order carries meaning, start the axis at zero, plot signed values from the baseline, highlight one bar, and reserve `space.3` beyond each endpoint for outside labels. Variants: ranked bar or discrete column; clustered comparison, for two or three series when within-category comparison is the job; actual-and-forecast columns on one scale with the interval marked once plus a non-colour cue; column with reference line; endpoint growth; annotation rail of secondary period values bound to exact category keys.

*Example:* six locations, door-to-door minutes each, sorted ascending, a 45-minute reference line, the two qualifying bars in primary and the rest in comparator grey.

## Range

`chart.range` draws one horizontal floating band per category between `low` and `high` arrays (pay bands, scenario ranges, confidence intervals), with the low value labelled at the band's left end and the high value at its right; `highlights` accent one band. It is emitted as a native stacked bar with an invisible base, so the bands stay editable. Use it when the spread is the finding; when only the midpoints matter, use a bar.

## Line

Trends, inflections, trajectory comparison, actual against forecast over ordered time. A consistently spaced temporal axis, numeric measures, explicit units, status boundaries for forecast or target, one finite value per category per series; a real gap stays a visible gap. Preserve honest interval spacing, emphasize at most four series and use shared-scale small multiples beyond that, direct-label endpoints and crossings, mark forecast with a dash or band plus a non-colour cue, and annotate the decisive turning points. With fewer than six points, label every dot and omit the left value axis.

Irregular observations use the numeric contract: `xAxis: {unit, min, max, ticks}`, a visible heading and shared unit, and series of `points: [{key, x, y, label?, breakBefore?}]` with strictly increasing in-domain x. `gapPolicy: "connect-observations"` joins only supplied observations; `"explicit-breaks"` with `breakBefore: true` leaves a gap open. `statusBoundary: {x, beforeLabel, afterLabel}` draws a measured boundary and each series declares its side.

*Example:* ten years of reported homicides, heading `NYPD reported homicides, 2015-2025`, endpoints labelled, one annotation on the 2020 inflection.

## Stacked

Composition across categories or time, contribution to a total, share shifts with a stable category set. Each stack reconciles to its total; declare absolute or percentage mode, segment order, negative treatment and the `Other` threshold. Use 100% stacking for share and absolute for magnitude, put the most stable segment on the baseline, keep segment order constant, use at most five segments, and add total labels when magnitude and mix both matter. `stackTotals: [{category, value}]` attaches a total that reconciles to its components; `secondaryLabels: [{category, series, value, unit, valueFormat}]` attaches another sourced measure to a segment or, with `anchor: "stack-total"`, to the total; `categoryGroups: [{id, label, categories}]` brackets a source grouping. Variants: absolute stack, top-right legend, 100% stacked bar, two-period mix shift, cumulative progression, stack with an auxiliary metric rail.

*Example:* door-to-door commute per location as walk, wait, ride, walk segments, one segment order across all six bars, totals labelled outside.

## Percentage segments by group

Mutually exclusive response distributions compared across groups: one horizontal bar per group, each resolving to 100%, same segments in the same order. Name one focal response as `Category A` before sorting - the response the title is about - and assign it `chart-series-1`. Show at most five rows: with more source groups, keep four named groups and calculate a fifth `Other` by weighting each omitted group by its respondent count. Sort named groups by descending `Category A`, keep `Other` last, give every row its respondent count, and disclose question wording, period, population and sample.

*Example:* four buyer roles plus `Other`, five responses in fixed order, the focal "already deployed" segment leftmost and in primary.

## Waterfall

Bridges from start to finish: price-volume-mix, margin, cash, headcount, variance. Opening total, ordered signed contributions, optional subtotals, closing total, one unit system, a rounding rule and a residual policy; the bridge reconciles before it renders. Anchor opening, subtotal and closing columns to zero, order drivers causally, chronologically or by contribution and say which, label every contribution and the closing total, and show an unexplained residual as a residual. Variants: standard bridge with an optional start-to-end construction; contribution bridge without an opening total; bridge with subtotals; bridge with an auxiliary metric rail.

*Example:* reported to normalized income, five signed drivers, a subtotal after the operating group, heading `Q2 2026 reported-to-normalized income bridge, $B`.

## Scatter and bubble

Relationships between two measures, segmentation, prioritization, and a third magnitude as bubble area. One observation per point, x and y measures with units, an optional size measure, stable IDs, documented quadrant thresholds. Label axes with units and the direction of desirability, encode magnitude by area, label the decisive points, and use association language unless the analysis supports causation. `quadrants: {x, y, style, titles, focus}` accepts `threshold-lines`, `alternating-tint` or `focus-tint`, both thresholds inside the bounds, each region labelled with the implication of being there. `sizeLegend: {label, markerSize}` renders a neutral grey key without rescaling the data. Add a trend line when the sample supports the named method, and report its basis.

*Example:* twenty films, gross on x and audience rating on y from the same title record, four outliers labelled, no trend line because the sample is not modelled.

## Heatmaps and analytical tables

Comparisons with shared row or column dimensions: qualitative evidence, options, assessments, exact values, in-cell charts. A table is one exhibit whose columns may use different encodings. Declare ordered columns, typed cells, row groups, missing states, and any scales, units, anchors and precision; row and column counts come from the supplied arrays.

Cell types: `text`; `bullets`; `category` (primary fill with contrasting text, or `surface: plain`); `highlight`; `number` (`numberDisplay: circle | oval | plain`); `binary`, `harvey` and `heatmap`, each referencing a named record in `scales`; `bars` (one declared scale containing zero, shared across rows); `implication` (with `relation: implies`).

Apply **Categories > Dimensions > Items**: with real category groups organizing the rows, use `treatment: categories` and highlight the left category cells; with rows as items compared across distinct dimensions, use `treatment: dimensions` and fill the dimension headers. Declare `comparisonAxis: rows` or `columns` so the fill lands on the dimension axis. Bind the deck's one table-header treatment to a single `tableHeader` record, and distinguish columns through width, alignment, wording and data. Left-align text, right-align comparable numbers, and let row height follow the tallest measured cell. More than five rows or four columns suggest `pre-read`; more than eight or six suggest `appendix`.

Give each case that will be discussed individually a stable circular `sectionNumber` on its category cell and keep it through sorting and across every exhibit. Order rows by a deliberate logic - chronology, dependency, ordinal outcome, magnitude or grouping. Prefer a compact comparative encoding when rows share a real criterion (exact metrics, Harvey balls, anchored 1-5 scores, feasibility checks) beside the evidence that explains it, and keep prose columns when rows cannot fairly share a measure. Distinguish "not assessed" from zero or poor performance.

*Example:* six locations as rows, four ranked criteria as columns in the client's ranked order, a struck cell where an option fails a hard screen, and a rationale column in plain text.

## Combo

`chart.combo` draws the first series as columns and the second as a line with markers, both labelled. On one scale the line reads against the bars (actual against plan); with `secondaryAxis: true` the line floats in the band above the bars on its own padded scale (a margin over a revenue) and `secondaryUnit` suffixes its labels. The heading's unit line names both units.

## Pie and donut

One total divided into two to five mutually exclusive parts, when approximate share is enough. One reconciled total, positive parts, stable labels, explicit units, one period and population, and shares summing to 100% within the disclosed rounding tolerance. Start at twelve o'clock and order slices by value. Variants: `legend-top-right` (default - one swatch row above the plot supplies identity, percentages inside the slices), `outside-labels`, `shared-legend` for a coordinated group. Every internal percentage fits its slice with four pixels of clearance; when it cannot, enlarge the chart or switch to bars.

*Example:* revenue by three product lines for one year, largest slice from twelve o'clock, percentages inside, legend above right.

## Horizons

How a portfolio moves from the current core through emerging plays to future options - a conceptual encoding of sequence, maturity and expected contribution. `chart.horizons` takes one ordered `horizons` array; each horizon has a stable `id` and `label` and may add `title`, `timeframe`, `description`, `summary`, up to four `{label, value}` details, a `colorIndex`, and normalized `start` and `end`. Variants: `curves`, `stepped`, `stepped-minimal`, `stepped-bands`; the first two take two to five horizons, `stepped-minimal` up to ten.

*Example:* three horizons - core mail, parcels, data services - with timeframes and two details each, `stepped` variant.

## Number formatting

Default to compact large numbers - `k`, `m`, `bn`, usually one decimal - shared across peer charts, tables, metrics and annotations, so `8.3m` sits beside `0.8m`. Declare one `valueFormat.compactUnit` for peer charts; `decimals` defaults to one; `sign: always` adds a plus to positive values. Formatting changes labels only: marks retain the raw values, and growth is calculated before rounding.

For a same-page comparison of two exhibits, declare `comparison: {kind: "matched", unit}` with identical chart types, periods, domains and value formats on both sides. The `chart-group` component lays out two to four coordinated children with one shared legend.

## Acceptance

Before styling, write the one visual comparison the audience should verify and name the exact datum, endpoint, gap, benchmark or threshold that proves it; the finished plot makes that comparison visible without the action title. Reconcile the data and the calculation first. Then check the title: it states the intended pattern. Then check the chart: the pattern is visible without the title. Every visible value matches the source after rounding, every tick and label uses the active body size, and every requested annotation appears in the final render.

## The wider catalogue (`charts-extra.mjs`)

All drawn, never native; each measures its intrinsic height from its width so it can hug.

**`chart.slope`** takes two to four period `categories` and up to twelve `series`; each series is a line between the period columns with "Name value" at the left end and "value Name" at the right, the `focusSeries` (or `highlights`) in the accent at the standard line weight, the rest in grey hairlines; end labels push apart by 20px when series finish close together. **`chart.lollipop`** takes one series over many categories: a stem from zero to the value with a 14px dot and the value beside it, rows filling the plot up to 72px each; a highlighted category takes the accent. **`chart.dumbbell`** takes exactly two series: two dots per category joined by a grey bar, the smaller value labelled to its left and the larger to its right, a marker legend above. **`chart.bullet`** takes one series of actuals, `targets` (one per category) and optional `ranges` (`[poor, ok, good]` per category): a graded grey band, a thick measure bar in the primary when the target is met and in ink when missed, an accent target tick, and "actual / target" beside the row. **`chart.treemap`** takes `items` (`label`, `value`; two to twenty), squarified largest-first from the top left, tiles in the series colours by rank (a highlighted item in the accent), the label and "value (share)" inside tiles that hold them. **`chart.radar`** takes three to eight axes and up to four series, rings at quarter steps, the focus series filled at 25% and comparators outlined, `max` fixing the scale. **`chart.boxplot`** takes `boxes` (`min`, `q1`, `median`, `q3`, `max` per category): whiskers with caps, the interquartile box in the primary (accent when highlighted), a white median line with its value beside the box, a value axis. **`chart.stacked-area`** takes two to six non-negative series: cumulative layers in series order with hairline seams, a value axis, a legend, and the last category's segment values at the right. **`chart.sparklines`** takes `items` (`label`, `values`, optional `note`; two to twelve) in a grid (`columns`, default three or four): a small line per item on a baseline with the last value beside the end dot, `sharedScale: true` for one scale across the grid, a highlighted item in the accent.
