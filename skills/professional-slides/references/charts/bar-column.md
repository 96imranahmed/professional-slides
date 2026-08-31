# Bar and Column Charts

## Best for

Category comparison, ranking, discrete periods, and paired actual-versus- benchmark comparisons.

## Data contract

One categorical dimension, one or a small number of numeric series, explicit units, and a declared order. Record whether the order is value, chronological, natural, or strategic.

## Selection and construction

- Use horizontal bars for long labels or rankings.
- Use vertical columns for a small number of ordered periods.
- Sort by value unless another order carries meaning.
- Start the quantitative axis at zero unless a truncated scale is essential, clearly signaled, and does not overstate differences.
- Keep gaps consistent and narrower than bars.
- Use direct labels when they remove the need for an axis.
- Highlight one bar or group and keep the rest neutral.
- Use clustered bars only when within-category comparison is central.

## Structural HTML reference

```html
<figure class="bar-chart" data-role="chart-field"><div class="bar-row" data-state="peer"><span>Segment A</span><i style="--value:82%"></i><b>82</b></div><div class="bar-row" data-state="highlight"><span>Segment B</span><i style="--value:64%"></i><b>64</b></div><div class="bar-row" data-state="peer"><span>Segment C</span><i style="--value:41%"></i><b>41</b></div><figcaption>Metric, unit, population, and period</figcaption></figure>
```

```css
.bar-chart { display: grid; gap: var(--space-3); margin: 0; }
.bar-row { display: grid; grid-template-columns: 180px 1fr 52px; gap: var(--space-3); align-items: center; font: var(--type-chart-label); }
.bar-row i { display: block; width: var(--value); height: 24px; background: var(--chart-segment); }
.bar-row[data-state="highlight"] i { background: var(--chart-series-1); }
.bar-row b { text-align: right; }
.bar-chart figcaption { font: var(--type-label); color: var(--text-secondary); }
```

The specimen shows one declared highlight. When the title does not explain an exception, render every row with the peer series role.

## Platform mapping

Map to a native bar/column chart when axis, gap width, data labels, and ordering survive export. Read back category order and values. If label wrapping differs between platforms, switch orientation or shorten labels before shrinking text.

## Failure modes

Too many categories, rotated labels, non-zero baselines that exaggerate gaps, decorative pictograms, and stacked bars used for precise segment comparison.

## Acceptance test

The rank or comparison should be clear before reading labels, and every visible value must match the source after rounding.
