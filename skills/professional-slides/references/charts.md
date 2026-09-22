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

Every chart defines: the question and intended conclusion; categories, series, values, units, period and population; sort order and scale domain; the status of each value (actual, estimate, forecast, target or scenario); highlight and annotation targets; visible source plus calculation provenance. Reconcile the result before designing the visual, so data, labels, heading and source agree on basis and precision. An index base defines the scale and belongs with the unit; it is not a chart result. Unequally spaced numerical scenarios need a numeric axis or discrete scenario bars, not equally spaced points on a continuous-looking line.

Name a derived measure's accounting basis where its values are read, including table headers. Distinguish a period flow, cumulative-to-date amount, outstanding balance and peak requirement; a footnote cannot rescue an ambiguous heading such as "Gap" when several of these exist on the page. For example, delayed receipts can create an outstanding year-end funding gap whose peak is meaningful but whose annual balances must not be summed as separate costs.

Signed columns must preserve the zero baseline and keep negative labels readable. Reserve space beyond the negative endpoint when the domain is automatic; if an authored bound places a label inside a mark, use adequate contrast against that mark. Verify the saved render, since the presence of a label in the scene does not establish its visibility.

Calculate from unrounded inputs and round for display; keep independently rounded source parts and totals as published, with a rounding note. A total that disagrees with its stated formula is a source conflict: show the reported figure and limit the conclusions that depend on it. Keep actuals, forecasts and sensitivities distinct, including scenario name, baseline, period, population and gross or net state.

## Construction

1. Match the encoding to the comparison task and use an honest scale.
2. The chart header defaults to plain text and a rule, with `unitPlacement: "inline"`: the measure heading, a comma, and the unit in `color.chartUnit` on the same line. Use this default for full-width charts and peer panels alike. Do not introduce a separate unit tile, a filled heading band or a second unit line to distinguish layouts. Shorten the measure heading and place unique period or sample context beside the relevant labels or in a concise note when the pair will not fit; do not shrink type. The runtime can fall back to a stacked unit for an explicitly retained legacy layout, but that is not the authoring default. The heading carries no results; put values, changes and conclusions on the marks or in an attached annotation. A `cagr: {from, to}` puts the compound rate on the growth arrow.
3. Resolve every series, highlight, plot band and legend key through the theme tokens, and keep those properties editable in the exported file.
4. Direct-label values when they pass the label gate; otherwise use the shared legend. In the saved chart, a series endpoint label retains its value, and adding it must not suppress requested intermediate values.
5. Default to a blank plot field, adding quiet gridlines when a dense scale needs intermediate lookup. When every mark carries its value, omit the quantitative axis, keep the category axis, and let the domain fit the data (zero-anchored for bars, padded for lines) so the tallest mark uses the plot; the axis returns with `showValueAxis: true` or `gridlines: true`.
6. Decide the annotation before plotting: attach the growth, gap, threshold or observation to exact evidence and reserve its geometry.

**Focus and comparator colours.** For a focal measure against a baseline, benchmark or peer set, use `component-primary` for focus and `chart-comparator` for the light-grey comparators, choosing the focal category from the argument and keeping its exact-key mapping across slides. One-series bars request `highlights: [{category, style: "bar"}]` and the highlighted bar takes the palette accent (`color.accent`) while the rest keep the series colour; the author selects the exact category only when it supports the argument. Grouped bars request `focusSeries`. Target 3:1 contrast between the two fills, in colour and in greyscale.

**Growth indicators.** Change annotations require an explicit request. Use `change: {from, to}` for the exact interval the claim compares, `change: true` for the full interval or paired-series gaps, or `change: "steps"` for adjacent changes. A period axis or a gap word in the title never chooses endpoints by itself. The computed change must support the claim, not merely be mathematically valid. `changeAnnotations` written by hand take the same styles (`arrow`, `bracket`, `construction`, `end-bubble`, `interval-label`) with one scalar per bubble (`+21%`, `+8 pp`, `+13% p.a.`).

**Survey-deck furniture.** `deltas: [n, …]` (aligned with the categories, or `[{category, value, significant}]`) adds a column of signed change discs to the right of a horizontal bar chart under a `deltasLabel` heading, on a neutral surface with the signed value printed inside; direction does not imply a good/bad outcome. `stackBracket: [series…]` brackets the named segments of each stacked column and prints their sum beside it. `change: "steps"` puts a compact bracket with the change between every adjacent pair of a period series, for small multiples. Legends wrap onto further rows when their items outrun the chart, and peer charts reserve the same rows.

**Reference lines and label space.** Use `referenceLines: [{value, label}]` for a named quantitative comparator; automatic domains include its value, and explicit domains must contain it. Plan space for the actual label alongside mark/value labels before plotting. On a column chart with a crowded in-plot reference, `placement: "outside-end"` reserves a right-hand gutter; this placement is not supported by horizontal bars. An explicit domain may need modest annotation clearance. Keep common physical scales across peers and do not remove a decisive comparator merely to make a page fit. If the label cannot fit without distorting the comparison, change the encoding or move supporting copy.

**Category sub-labels.** `categoryNotes: ["n=412", "n=388", …]`, one entry per category in category order (`null` or a short array leaves the rest alone), prints a second line under the category label at label size in secondary ink: the base of the measure, the year, the unit of that column. On a bar chart the label and its note are measured and placed as one two-line block centred on the bar; on a column chart the note takes the line under the label and the plot gives up that line. A chart carrying them is assembled as shapes, because a native PowerPoint chart places its own category axis and the note would float free of it.

**Time-series furniture.** `periods: [{ from, to, label }]` brackets runs of categories above a column or line chart, the label centred over a hairline bracket and a dashed divider dropped between adjacent periods to the baseline; the band sits above the value labels and any growth arrow. `events: [{ at, label }]` drops a dashed line at a category from a two-line flag above the plot, flags alternating between two rows; a flag near the right edge sits left of its line. Both reserve their band in the plot frame and are drawn as shapes, never as a native chart. A drawn line chart with more periods than label slots labels every nth category and keeps the first and last. **Paired bars** (`paired: true` on `chart.bar`, two or three series) become a row of drawn panels, one per series, the first carrying the category labels and the later ones `categoryLabels: false`, each headed by its series name and on its own scale; the panels share one top band so their rows align. **`chart.bubble-grid`** takes `rows`, `columns` and a `values` matrix of non-negative numbers: a bubble per nonzero cell with diameter proportional to the square root of the value (the largest at 86% of the cell), the value inside from 24px up and above the bubble below that, hairlines between rows, bold row labels at the left and column labels along the foot. **`segmentGrowth: { from, to, label? }`** on a stacked column adds a column right of the plot headed "CAGR from–to" (or "Change from–to" when the categories are not years) with one signed rate per series, level with that series' segment in the `to` stack; the composer drops the implied first-to-last arrow when the column is present. **`chart.marimekko`** takes `categories`, `series` of non-negative values and optional `widths`: each column is as wide as its total (or its width) and stacks its series to 100%, the share printed inside every segment that holds it (`percentLabels: false` prints the values instead), the column total (or width) above and the category below; drawn, never native. **`chart.waffle`** is the unit chart: one series of integer counts, one dot per unit in a block per category (columns from the square root of the largest count, ten for `percent: true`, where unfilled dots stay grey), the count above and the category below.

**Forecast, labels and companions.** `forecastFrom: "<category>"` shades every bar from that category on in the forecast tint and marks the boundary. Value labels are 11pt semibold and sit **outside** the mark - past the end of a bar, above a column - in ink. The plot reserves a gutter for them and the native emitter stops the value scale short of the plot edge (`LABEL_HEADROOM`), so the longest bar's label has room; outside labels align with each other, survive projection and printing, and read the same on a short bar as on a long one. Inside the mark in white is for a stacked segment and a treemap tile, which have no outside, and for a range band, which prints its span between its ends. `dataTable: [[...]]` hugs a value table under the chart, its columns aligned to the categories, and `dataTable: true` builds that table from the chart's own series (one row per series, values printed to the same precision as the labels) - the second element a thin page is usually missing; `center: "value"` prints a KPI in a donut's hole; multi-series lines drop the legend and carry `endLabels` (the series name at the end of each line). Native charts keep these as per-point fills and data labels in the exported workbook chart.

**Direct-label gate.** A direct label stays at the body-sized chart-label role, sits inside the plot or the declared gutter, reaches 4.5:1 text contrast, and clears every mark, label, axis and leader by four pixels. It identifies the category or series, and the value when the value is not already printed. Labels and annotations use the semibold role; legend rows and axis ticks stay regular. When a required label cannot fit, keep the decisive non-colliding labels and use the shared legend.

**Alignment and capacity.** Align neighbouring content to the plot area, hold axis ranges, zero baselines, category order and plot dimensions constant across small multiples, and reserve space for long labels before setting the plot guide. Comparable panels reserve the same label gutters, including space for negative values present in only one panel, so equal amounts occupy equal physical lengths. A chart that outgrows its page changes orientation, aggregates, becomes small multiples, or splits.

## Bar and column

Category comparison, ranking, discrete periods, actual-versus-benchmark pairs. One categorical dimension, one or a few series, explicit units, a declared order, one finite value per category per series, bounds containing every value and zero. Horizontal bars for long labels or rankings, vertical columns for up to eight ordered periods. Sort by value unless another order carries meaning, start the axis at zero, plot signed values from the baseline and verify their sign and direction in the saved render, emphasise only the authored comparison set, if any, and reserve `space.3` beyond each endpoint for outside labels. Variants: ranked bar or discrete column; clustered comparison, for two or three series when within-category comparison is the job; actual-and-forecast columns on one scale with the interval marked once plus a non-colour cue; column with reference line; endpoint growth; annotation rail of secondary period values bound to exact category keys.

*Example:* six locations, door-to-door minutes each, sorted ascending, a 45-minute reference line, the two qualifying bars in primary and the rest in comparator grey.

## Range

`chart.range` draws one horizontal floating band per category between `low` and `high` arrays (pay bands, scenario ranges, confidence intervals), with the low value in ink outside the band's left end and the high value in ink outside its right; `highlights` accent the explicitly selected bands. It is assembled as shapes rather than a native stacked bar: PowerPoint can only place a label inside a stacked segment, and a band's ends belong beside the band, not written over it. Use it when the spread is the finding; when only the midpoints matter, use a bar.

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

Relationships between two measures, segmentation, prioritization, and a third magnitude as bubble area. One observation per point, x and y measures with units, an optional size measure, stable IDs, documented quadrant thresholds. Label axes with units and the direction of desirability, encode magnitude by area, label the decisive points, and use association language unless the analysis supports causation. `quadrants: {x, y, style, titles, focus, xLabel?}` accepts `threshold-lines`, `alternating-tint` or `focus-tint`, both thresholds inside the bounds, each region labelled with the implication of being there. Use `xLabel` for a named vertical threshold such as `Required reserve 5`; it is anchored above the fixed line, distinct from region titles. Include it in the complete text plan. `sizeLegend: {label, markerSize}` renders a neutral grey key without rescaling the data. Add a trend line when the sample supports the named method, and report its basis.

*Example:* twenty films, gross on x and audience rating on y from the same title record, four outliers labelled, no trend line because the sample is not modelled.

## Heatmaps and analytical tables

Comparisons with shared row or column dimensions: qualitative evidence, options, assessments, exact values, in-cell charts. A table is one exhibit whose columns may use different encodings. Declare ordered columns, typed cells, row groups, missing states, and any scales, units, anchors and precision; row and column counts come from the supplied arrays.

For separate tables comparing the same cases, declare `rowAlignment: {group: "cases", keys: ["case-a", "case-b"]}` on each peer, with one unique key per row in identical order. Align their body starts and allocate enough height for the tallest cell in each shared row. The compiler shares those measured row heights, reserves each table's own legend, and preserves authored density; it rejects mismatched keys or insufficient space. Use this only for a real row correspondence, not unrelated side-by-side tables. Heading alignment alone does not align body rows.

Cell types: `text`; `bullets`; `category` (primary fill with contrasting text, or `surface: plain`); `highlight`; `number` (`numberDisplay: circle | oval | plain`); `binary`, `harvey` and `heatmap`, each referencing a named record in `scales`; `bars` (one declared scale containing zero, shared across rows - the in-cell bar chart, which reads a magnitude down a column faster than the figures do and keeps the figure beside it); `implication` (with `relation: implies`).

**Column treatments.** Three flags on a column object write those cell types for a whole column rather than cell by cell. `implication: true` names the column that concludes from the columns before it and inserts a gutter of `implication` chevrons in front of it; `implicationStyle` is `per-row` or `single` (the default follows the row count, `per-row` at four rows or fewer). `single` is not one chevron on the middle row — that reads as a verdict on that row — but a dashed rule down the gutter carrying one disc centred on the rows it spans, which stops above a total: a total is the same evidence added up, not another line of it. The gutter carries the argument's direction, so the column cannot be first. `heat: true` gives every cell in the column `type: "heatmap"` on the shared sequential scale. `bubble: true` sets every value in a filled pill (`surface: "bubble"`), the table's counterpart to the chart's change bubble. `bar: true` gives every cell `type: "bars"` and derives the scale record the bars share from the column's own numbers — zero (or the lowest negative, rounded down) to a round number above the largest — taking its `label` and `unit` from the column, which both must be set. The bar is drawn from the number and the label beside it is the figure as written, so a column of `14.8` prints 14.8 rather than the house rounding's 15; a single-series bar column carries the scale line and no swatch, because the column header already names it. A column takes one treatment, not two, and the flags mark where the reader should look — a table that marks every column marks nothing.

Choose a table treatment from its reading task and retain it across comparable pages. A joined verdict is ordinary table content. An explicit inference may use a centred gutter arrow; category cells may instead organize an unordered taxonomy. No treatment depends on neighbouring slides or on whether a column label was written as a string or object.

For an exact observation in a single-series bar column, set that cell's `markFocus: true` (shorthand example: `{text: "6", markFocus: true}`). It accents the bar and, where contrast permits, its value; it adds no cell or row fill and leaves peer marks and the common scale unchanged. Use a bold corresponding entity label when helpful. Multi-series bar cells reject this override so series identity survives; attach a local annotation instead. This is distinct from `highlight: true`, which retains the existing cell-background treatment.

Apply **Categories > Dimensions > Items**: with real category groups organizing the rows, use `treatment: categories` and highlight the left category cells; with rows as items compared across distinct dimensions, use `treatment: dimensions` and fill the dimension headers. Declare `comparisonAxis: rows` or `columns` so the fill lands on the dimension axis. Bind the deck's one table-header treatment to a single `tableHeader` record, and distinguish columns through width, alignment, wording and data. Left-align text, right-align comparable numbers, and let row height follow the tallest measured cell. More than five rows or four columns suggest `pre-read`; more than eight or six suggest `appendix`.

Give each case that will be discussed individually a stable circular `sectionNumber` on its category cell and keep it through sorting and across every exhibit. Order rows by a deliberate logic - chronology, dependency, ordinal outcome, magnitude or grouping. Prefer a compact comparative encoding when rows share a real criterion (exact metrics, Harvey balls, anchored 1-5 scores, feasibility checks) beside the evidence that explains it, and keep prose columns when rows cannot fairly share a measure. Distinguish "not assessed" from zero or poor performance.

*Example:* six locations as rows, four ranked criteria as columns in the client's ranked order, a struck cell where an option fails a hard screen, and a rationale column in plain text.

## Combo

`chart.combo` draws the first series as columns and the second as a line with markers, both labelled. On one scale the line reads against the bars (actual against plan); with `secondaryAxis: true` the line floats in the band above the bars on its own padded scale (a margin over a revenue) and `secondaryUnit` suffixes its labels. The chart heading names both units inline.

## Pie and donut

One total divided into two to five mutually exclusive parts, when approximate share is enough. One reconciled total, positive parts, stable labels, explicit units, one period and population, and shares summing to 100% within the disclosed rounding tolerance. Start at twelve o'clock and order slices by value. Variants: `legend-top-right` (default - one swatch row above the plot supplies identity, percentages inside the slices), `outside-labels`, `shared-legend` for a coordinated group. Every internal percentage fits its slice with four pixels of clearance; when it cannot, enlarge the chart or switch to bars.

*Example:* revenue by three product lines for one year, largest slice from twelve o'clock, percentages inside, legend above right.

## Horizons

How a portfolio moves from the current core through emerging plays to future options - a conceptual encoding of sequence, maturity and expected contribution. `chart.horizons` takes one ordered `horizons` array; each horizon has a stable `id` and `label` and may add `title`, `timeframe`, `description`, `summary`, up to four `{label, value}` details, a `colorIndex`, and normalized `start` and `end`. Variants: `curves`, `stepped`, `stepped-minimal`, `stepped-bands`; the first two take two to five horizons, `stepped-minimal` up to ten.

*Example:* three horizons - core mail, parcels, data services - with timeframes and two details each, `stepped` variant.

## Number formatting

Default to compact large numbers - `k`, `m`, `bn`, usually one decimal - shared across peer charts, tables, metrics and annotations, so `8.3m` sits beside `0.8m`. Declare one `valueFormat.compactUnit` for peer charts; `decimals` defaults to one; `sign: always` adds a plus to positive values. Formatting changes labels only: marks retain the raw values, and growth is calculated before rounding.

Name the resource and state in rate/allowance labels. On a financing page, a bare “budget” naturally reads as money; an import-day allowance, remaining volume or crew-hour limit needs its own quantity and unit. Label exhaustion as such rather than making the reader infer whether zero means remaining allowance, delivered rate or spending.

For a same-page comparison of two exhibits, declare `comparison: {kind: "matched", unit}` with identical chart types, periods, domains and value formats on both sides. The `chart-group` component lays out two to four coordinated children with one shared legend.

## Acceptance

Before styling, write the one visual comparison the audience should verify and name the exact datum, endpoint, gap, benchmark or threshold that proves it; the finished plot makes that comparison visible without the action title. Reconcile the data and the calculation first. Then check the title: it states the intended pattern. Then check the chart: the pattern is visible without the title. Every visible value matches the source after rounding, every tick and label uses the active body size, and every requested annotation appears in the final render.

## The wider catalogue (`charts-extra.mjs`)

All drawn, never native; each measures its intrinsic height from its width so it can hug.

**`chart.slope`** takes two to four period `categories` and up to twelve `series`; each series is a line between the period columns with "Name value" at the left end and "value Name" at the right, the `focusSeries` (or `highlights`) in the accent at the standard line weight, the rest in grey hairlines; end labels push apart by 20px when series finish close together. **`chart.lollipop`** takes one series over many categories: a stem from zero to the value with a 14px dot and the value beside it, rows filling the plot up to 72px each; a highlighted category takes the accent. **`chart.dumbbell`** takes exactly two series: two dots per category joined by a grey bar, the smaller value labelled to its left and the larger to its right, a marker legend above. Reserve measured value gutters separately from category labels; fit the unlabelled numeric domain to the data while preserving any explicit bounds. **`chart.bullet`** takes one series of actuals, `targets` (one per category) and optional `ranges` (`[poor, ok, good]` per category): a graded grey band, a thick measure bar in the primary when the target is met and in ink when missed, an accent target tick, and "actual / target" beside the row. **`chart.treemap`** takes `items` (`label`, `value`; two to twenty), squarified largest-first from the top left, tiles in the series colours by rank when colour only distinguishes categories; an explicitly highlighted item uses the accent and all other tiles use the comparator colour, the label and "value (share)" inside tiles that hold them. **`chart.radar`** takes three to eight axes and up to four series, rings at quarter steps, the focus series filled at 25% and comparators outlined, `max` fixing the scale. **`chart.boxplot`** takes `boxes` (`min`, `q1`, `median`, `q3`, `max` per category): whiskers with caps, the interquartile box in the primary (accent when highlighted), a white median line with its value beside the box, a value axis. **`chart.stacked-area`** takes two to six non-negative series: cumulative layers in series order with hairline seams, a value axis, a legend, and the last category's segment values at the right. **`chart.sparklines`** takes `items` (`label`, `values`, optional `note`; two to twelve) in a grid (`columns`, default three or four): a small line per item on a baseline with the last value beside the end dot, `sharedScale: true` for one scale across the grid, a highlighted item in the accent.

Scatter and bubble labels must clear fixed threshold lines as well as neighboring marks and labels. Move the label within the existing plot; never move a point, change the quantitative domain or hide a threshold to make its name fit. If no readable placement exists, enlarge the exhibit or reduce labeled cases deliberately.

### Combo scales and label precision

With `secondaryAxis: true`, bars and the secondary line share categories but use
separate vertical fields. Reserve label clearance before computing their scales;
a line or marker must not cross a primary value label. Set primary `valueFormat`
and secondary `secondaryValueFormat` independently when the units differ—for
example, films per year at one decimal and gross in millions at zero decimals.
Never round a rate to an integer merely because the underlying items are counts.

### Category and verdict semantics

In a category table, a total is an aggregate, not another category: give its label cell the house accent blue with white text, and its remaining values a continuous light-grey background with dark bold text. Preserve the category column boundary; do not reverse the entire total row onto a dark fill. Use the semantic `style: "total"` row so this treatment survives composition and export.

Choose the relationship before styling the cells. Rows that describe transfers between named actors may read more clearly as a directional network, with the transferred information and approval boundary attached to its nodes. Keep a table when the task is comparing categories or looking up records. Adjacent tables may serve different roles: share their typography and alignment while preserving each authored category, status or record treatment.

When a dedicated column organizes the evidence into distinct types or stages, use filled category cells with white text. A trace-event column containing Assignment, Availability, Evidence, Interaction and Outcome is a category axis even with only one row per category; row spans are not required. Author it as `treatment: "categories"` with `{label: "Trace event", type: "category"}` on that column. Distinct record IDs or individual entities are items, and repeated membership attributes remain plain. Use plain text for repeated publisher, region or team values, or one spanning category cell for an actual grouped hierarchy. Explicit good/bad verdicts may use `{type: "text", text: "Cleared", tone: "positive"}` and `{type: "text", text: "Missed", tone: "negative"}`; keep the label so colour is supplementary. Yes/no observations and signed changes stay neutral: use, presence and increase do not by themselves mean good or bad. Do not infer desirability from identity or the word “winner”.

The slide subtitle is optional. Remove it if the chart heading already owns its measure, population and period, including semantic paraphrases. Preserve unique scope once in the heading or note. Tables and non-chart exhibits do not require an extra exhibit heading.

Positive/negative status colours belong only to short text labels (such as Cleared or Missed) and compact check/cross icons. Do not apply them to chart marks, stacked segments, areas, series swatches or annotation backgrounds. Chart series use the deck palette even when their names describe success/failure; `series[].tone` is invalid. Signed waterfall contributions use chart-series colours and retain their signs, without interpreting increase/decrease as good/bad. Red or green may occur as ordinary house-series colours, but never as an automatic status mapping.

Continuation tables share the numeric domain and physical column/plot widths derived before pagination. Equal values must occupy equal lengths across pages. Footnote markers, repeated headers and display labels must not change the identity of that scale. Check the printed common range on every continuation page, not only the first.

In mixed quantitative tables, allocate useful width to the measure that carries the claim before allocating spare space to long item labels. Wrap those labels as needed. A continuation shares label reserve as well as its numeric domain, column widths and plot length.

Peer bars with the same unit require the same numeric domain and the same pixels per unit. This includes directly compared bar columns within one table: use typed `bars` cells referencing one declared scale, rather than independently auto-scaled shorthand columns. Confirm the printed common range and equal physical plot lengths; a pair of numerically correct labels can still show the smaller quantity as the longer bar. Align category gutters, value-label gutters and plot dimensions; matching axis maxima alone is insufficient. The composer uses shared editable geometry when native auto-layout cannot preserve the comparison. Keep the same row set/order for matched categories; show a benchmark as a reference line rather than adding an unmatched row to one panel. Zero-valued stacked segments retain their data but carry no in-mark label. Visible native axes retain the composed numeric bounds and major tick interval; do not let the office renderer select a different scale or new labels after the dot-dash text check. Saved-file readback and PDF text retention both verify this boundary.

For time-series commentary, a named contribution can explain the composition of a peak without claiming causality. Reconcile its numerator and denominator to the same population and snapshot. Retain all observations, label the few anchors needed for reading, and use the existing keyed numeric-x line when selective labels are needed. Evidence callouts must leave the trajectory readable; choose placement from actual free space rather than reserving a large empty band.

An explicit chart domain must retain readable tick intervals; adjust the number of ticks before padding the domain into excessive empty space. Callout clearance includes the connecting segments as well as point markers: do not cover the trajectory being explained. For review aggregates, identify platform, edition and observation date before comparing. A generic source label or an unexplained “lead platform” does not establish comparability.

Numeric-x lines with keyed observations stay as editable shapes automatically. Do not hand them to the categorical native-line exporter: it cannot preserve the explicit x positions and selected point labels. Ordinary categorical lines remain eligible for native charts when their other features permit it.
