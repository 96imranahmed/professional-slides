# Bar and Column Charts

## Best for

Category comparison, ranking, discrete periods, and paired actual-versus-benchmark comparisons.

## Guidance note

- Use when discrete categories, ranks, or a short period sequence must be compared on one quantitative baseline.
- Why: bar length makes relative magnitude and distance easy to verify.
- Action title: state the leading, lagging, changing, or threshold-crossing category and quantify the decision-relevant gap when possible.

## Data contract

One categorical dimension, one or a small number of numeric series, explicit units, and a declared order. Every series must contain exactly one finite value per category; mismatched arrays fail before layout. Record whether the order is value, chronological, natural, or strategic. Explicit bounds must contain every value and zero.

## Selection and construction

- Use horizontal bars for long labels or rankings.
- Use vertical columns for up to eight ordered periods. Exceed eight only when labels are unusually short and spacing remains readable.
- Sort by value unless another order carries meaning.
- Start the quantitative axis at zero unless a truncated scale is essential, clearly signaled, and does not overstate differences.
- Plot signed values from the zero baseline: negatives extend left or down, and their labels sit beyond the negative endpoint rather than inside a positive sliver.
- Keep gaps consistent and narrower than bars.
- Use direct labels only when they pass the shared [direct-label gate](index.md#direct-label-gate). Fewer than eight directly labelled values remove the quantitative axis by default; keep the category axis and its body-sized labels.
- Highlight one bar or group and keep the rest neutral.
- Use clustered bars only when within-category comparison is central.
- Follow the universal [plot-field and gridline rule](index.md#construction-rules); this owner adds no bar-specific exception.
- Apply the shared [focus and comparator colour rule](index.md#focus-and-comparator-colours); preserve labels or category positions as the non-colour cue.
- Use `bar` to focus one mark in a one-series chart. Use `region-box` or `region-tint` to focus a complete category across grouped bars; the box uses the theme primary and the tint uses the light neutral surface. Give either region treatment symmetric breathing room beyond the marks and plot rails, then keep the category label clear of its lower edge.

## Registered variants

### Ranked bar or discrete column

This is the core encoding. One categorical position and one aligned length or height encode magnitude. Use ranked horizontal bars for many categories or long labels, and chronological columns for a small ordered period set.

### Clustered comparison

Use two or at most three peer series when the audience must compare the series inside each category. Keep series order constant and use one shared [chart legend](../components/chart-legends.md) unless every series is directly labelled. Do not cluster when the more important question is total composition; use [stacked](stacked.md).

### Actual and forecast columns

Use when one measure continues across a clear status boundary. Keep one quantitative scale and category rhythm, preserve the underlying series mapping, and mark the full forecast interval with the shared [forecast band](../components/chart-callouts.md#shared-highlight-and-change-grammar), a non-colour state cue, and one label. Do not recolour each future year as a new series.

### Column with reference line

Use when columns show the primary measure and one line supplies a meaningful benchmark, reference, or directly related rate. Prefer one shared axis when units match. A second axis is allowed only when the units differ, both scales are explicit, the relationship is analytically necessary, and the visual cannot imply that vertical proximity means equality. Use the shared line legend key and apply the [direct-label gate](index.md#direct-label-gate) to the reference endpoint.

### Endpoint growth

Use when the chart's decision point is the change between two declared endpoints. Keep the underlying bars or columns and serialize the shared [annotation decision](../components/chart-callouts.md#authoring-decision). In clustered columns, the same bracket construction may repeat across categories when each compares the same two series.

### Annotation rail

Use one aligned row below chronological category labels when a secondary period-by-period change, such as year-on-year growth, materially changes interpretation. Bind every rail item to an exact category key and keep its unit separate from the plotted measure. Omit the rail when it only repeats the bar labels.

## Construction details

Place outside value labels a full `space.3` token beyond each bar endpoint. Reserve the measured label width plus this gap in the chart gutter; never clamp a label back onto its bar to fit. Apply the same clear gap to positive and negative bars. Category labels also need visible separation from the baseline.


When the title does not explain an exception, render every row with the peer series role. Do not combine a selected bar, region box, and region tint on one chart.

### State and annotation geometry

Keep actual, forecast, reference, and endpoint annotations as state or component slots around the same categorical column encoding.

The adapter calculates all column heights, line points, forecast bounds, and endpoint geometry from the declared values and periods. The variant changes state treatment and attached components only; it does not create a second bar or column family.

## Platform mapping

Orientation changes label capacity. If the declared labels do not fit their reserved measure, switch orientation or shorten them before shrinking text.

## Failure modes

Too many categories, rotated labels, non-zero baselines that exaggerate gaps, decorative pictograms, and stacked bars used for precise segment comparison.

## Acceptance test

The rank or comparison should be clear before reading labels, every visible value must match the source after rounding, and horizontal charts follow the same value-axis suppression and optional-gridline contract as vertical charts. Every visible numeric or category tick uses the active body size.
