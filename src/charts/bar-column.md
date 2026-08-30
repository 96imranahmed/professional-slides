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

## Platform mapping

Map to a native bar/column chart when axis, gap width, data labels, and ordering survive export. Read back category order and values. If label wrapping differs between platforms, switch orientation or shorten labels before shrinking text.

## Failure modes

Too many categories, rotated labels, non-zero baselines that exaggerate gaps, decorative pictograms, and stacked bars used for precise segment comparison.

## Acceptance test

The rank or comparison should be clear before reading labels, and every visible value must match the source after rounding.
