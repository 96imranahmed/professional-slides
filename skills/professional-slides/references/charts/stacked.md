# Stacked Bars and Areas

## Best for

Composition across categories or time, contribution to a total, and share shifts with a stable category set.

Use [percentage segments by user group](percentage-segment-by-group.md) for survey response distributions compared across respondent groups; that subtype owns the five-row cap, `Category A` ordering, calculated `Other`, segment emphasis, and adjacent insight extraction.

## Data contract

Each stack must reconcile to its total. Declare absolute versus percentage mode, segment order, treatment of negative values, and the threshold for any grouped `Other` category.

## Construction

- Use 100% stacking for share and absolute stacking for magnitude.
- Put the most important or stable segment on the baseline.
- Keep segment order constant across stacks.
- Limit segments and disclose the rule for `Other`.
- Add total labels when both magnitude and mix matter.
- Prefer bars to areas when exact category comparison matters.
- Use direct segment labels only where space and contrast support them.

## Structural HTML reference

```html
<figure class="stacked-chart" data-role="chart-field"><div class="stack-row"><span>Group A</span><div class="stack"><i style="--share:48%;--series:var(--chart-series-1)">48%</i><i style="--share:32%;--series:var(--chart-series-2)">32%</i><i style="--share:20%;--series:var(--chart-segment)">20%</i></div></div><div class="stack-row"><span>Group B</span><div class="stack"><i style="--share:35%;--series:var(--chart-series-1)">35%</i><i style="--share:39%;--series:var(--chart-series-2)">39%</i><i style="--share:26%;--series:var(--chart-segment)">26%</i></div></div><figcaption>Share of respondents; segment order fixed across groups</figcaption></figure>
```

```css
.stacked-chart { display: grid; gap: var(--space-4); margin: 0; }
.stack-row { display: grid; grid-template-columns: 120px 1fr; gap: var(--space-3); align-items: center; }
.stack { display: flex; height: 34px; overflow: hidden; }
.stack i { width: var(--share); display: grid; place-items: center; background: var(--series); font: var(--type-chart-label); font-style: normal; }
.stacked-chart figcaption { font: var(--type-label); color: var(--text-secondary); }
```

Choose accessible text colour for each resolved segment fill and suppress an internal label when the segment is too narrow; retain the value through a direct label or legend.

## Platform mapping

Map series order and stack mode explicitly; do not trust application defaults. Read back totals and category order. Verify that percentage charts normalize correctly and that labels do not disappear or move after conversion.

## Failure modes

Comparing many middle segments, inconsistent series order, irregular time in an area chart, too many colors, narrow segments with unreadable labels, and totals that do not reconcile.

## Acceptance test

Each total or 100% stack reconciles after rounding, and the composition change supporting the title can be found without consulting a legend repeatedly.
