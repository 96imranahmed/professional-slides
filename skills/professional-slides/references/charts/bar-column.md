# Bar and Column Charts

## Best for

Category comparison, ranking, discrete periods, and paired actual-versus-benchmark comparisons.

## Data contract

One categorical dimension, one or a small number of numeric series, explicit units, and a declared order. Record whether the order is value, chronological, natural, or strategic.

## Selection and construction

- Use horizontal bars for long labels or rankings.
- Use vertical columns for up to eight ordered periods. Exceed eight only when labels are unusually short and spacing remains readable.
- Sort by value unless another order carries meaning.
- Start the quantitative axis at zero unless a truncated scale is essential, clearly signaled, and does not overstate differences.
- Keep gaps consistent and narrower than bars.
- Use direct labels only when they pass the shared [direct-label gate](index.md#direct-label-gate) and remove the need for an axis.
- Highlight one bar or group and keep the rest neutral.
- Use clustered bars only when within-category comparison is central.

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

Use when the chart's decision point is the change between two declared endpoints. Keep the underlying bars or columns as the evidence and add one shared [endpoint change](../components/chart-callouts.md#shared-highlight-and-change-grammar) arrow or bracket with the period and basis. Do not add a growth pill when the title or endpoint labels already make the change obvious.

## Structural HTML reference

```html
<figure class="bar-chart" data-role="chart-field"><div class="bar-row"><span>Enterprise</span><i style="--value:82%"></i><b>82%</b></div><div class="bar-row bar-row--focus"><span>Mid-market</span><i style="--value:64%"></i><b>64%</b></div><div class="bar-row"><span>Small business</span><i style="--value:41%"></i><b>41%</b></div><figcaption>Renewal rate, %, UK customer accounts, FY2026, n = 420</figcaption></figure>
```

```css
.bar-chart { display: grid; gap: var(--space-3); margin: 0; }
.bar-row { display: grid; grid-template-columns: 180px 1fr 52px; gap: var(--space-3); align-items: center; font: var(--type-chart-label); }
.bar-row i { display: block; width: var(--value); height: 24px; background: var(--chart-segment); }
.bar-row--focus i { background: var(--chart-series-1); }
.bar-row b { text-align: right; }
.bar-chart figcaption { font: var(--type-label); color: var(--text-secondary); }
```

The specimen shows one declared highlight. When the title does not explain an exception, render every row with the peer series role.

### Variant HTML slots

Keep actual, forecast, reference, and endpoint annotations as state or component slots around the same categorical column encoding:

```html
<figure class="column-chart" data-role="chart-field" data-variant="actual-forecast-with-reference-line">
  <ul class="chart-legend" data-component="chart-legend" data-variant="state" aria-label="Series and status">
    <li><span class="chart-legend__key" data-series="1" aria-hidden="true"></span><span>Metric</span></li>
    <li data-state="forecast"><span class="chart-legend__key" data-state="forecast" aria-hidden="true"></span><span>Forecast</span></li>
    <li><span class="chart-legend__key" data-variant="line" aria-hidden="true"></span><span>Reference</span></li>
  </ul>
  <div class="chart-field" data-status-boundary="2025">
    <div class="forecast-region" data-component="chart-callout" data-variant="forecast-band"><span>Forecast period</span></div>
    <ol class="column-series" aria-label="Metric by year">
      <li data-state="actual" data-value="80"><span>2024</span><b>80</b></li>
      <li data-state="forecast" data-value="120"><span>2025</span><b>120</b></li>
      <li data-state="forecast" data-value="150"><span>2026</span><b>150</b></li>
    </ol>
    <svg class="reference-line" data-series="reference" data-values="88,112,140" role="img" aria-label="Reference metric over the same periods"></svg>
  </div>
</figure>

<figure class="column-chart" data-role="chart-field" data-variant="endpoint-growth">
  <ol class="column-series"><li data-value="100">Current</li><li data-value="187.5">Future</li></ol>
  <div class="chart-callout" data-component="chart-callout" data-variant="endpoint-change" data-start="current" data-end="future"><span>+87.5%, current to future</span></div>
</figure>
```

The adapter calculates all column heights, line points, forecast bounds, and endpoint geometry from the declared values and periods. The variant changes state treatment and attached components only; it does not create a second bar or column family.

## Platform mapping

Orientation changes label capacity. If the declared labels do not fit their reserved measure, switch orientation or shorten them before shrinking text.

## Failure modes

Too many categories, rotated labels, non-zero baselines that exaggerate gaps, decorative pictograms, and stacked bars used for precise segment comparison.

## Acceptance test

The rank or comparison should be clear before reading labels, and every visible value must match the source after rounding.
