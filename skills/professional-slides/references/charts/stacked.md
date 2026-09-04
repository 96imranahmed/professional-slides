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
- Use no more than five segments and disclose the rule for `Other`; exceed five only when labels pass the shared [direct-label gate](index.md#direct-label-gate) and the comparison does not require middle-segment precision.
- Add total labels when both magnitude and mix matter.
- Prefer bars to areas when exact category comparison matters.
- Use direct segment labels only when they pass the shared [direct-label gate](index.md#direct-label-gate).

Use the shared [chart legend](../components/chart-legends.md) whenever segment identity is not printed unambiguously inside every stack. Use the shared [change and highlight grammar](../components/chart-callouts.md#shared-highlight-and-change-grammar) for forecast bands, endpoint change, focal spans, and segment emphasis.

## Registered variants

### Absolute stacked bar or column

This is the core encoding. Segment lengths reconcile to an absolute total, the baseline segment is stable, and an optional total label sits outside the stack. Use when both total magnitude and contribution matter.

### 100% stacked bar

Normalize every row to one shared 0% to 100% width when mix is the question and total magnitude is not. Keep segment order and legend order fixed. Use the specialized [percentage segments by user group](percentage-segment-by-group.md) when the rows are respondent groups and its selection, sorting, sample, and `Other` rules apply.

### Two-period mix shift

Use two stacks when the audience must compare a start and end state. Keep equal bar width, one segment order, and direct internal values where they fit. Add total labels above the stacks when magnitude also changes, segment-share labels outside when the mix change is material, and at most one shared endpoint-change bracket for the total. Do not use separate brackets for every segment.

### Cumulative stacked progression

Use chronological absolute stacks when both total growth and component contribution matter. Direct-label totals. Preserve one baseline, stack order, and column spacing. Optional connectors may trace the same segment boundary across adjacent periods. Keep them quiet and never imply interpolation across irregular time.

### Stacked chart with auxiliary metric rail

Use only when one compact metric per stack materially changes interpretation, such as margin beneath revenue mix. Align one [metric field](../components/metric-fields.md) to every stack center, keep a separate label and unit for the auxiliary measure, and preserve one metric grammar across all categories. The rail does not share the stack axis, does not replace source data, and should be removed when it merely repeats a segment or total.

## Structural HTML reference

```html
<figure class="stacked-chart" data-role="chart-field"><ul class="chart-legend" data-component="chart-legend" data-variant="swatch" data-placement="top" aria-label="Purchase priorities"><li><span class="chart-legend__key" data-series="1"></span>Reliability</li><li><span class="chart-legend__key" data-series="2"></span>Ease of use</li><li><span class="chart-legend__key" data-series="3"></span>Price</li></ul><div class="stack-row"><span>Enterprise</span><div class="stack"><i style="--share:48%;--series:var(--chart-series-1)">48%</i><i style="--share:32%;--series:var(--chart-series-2)">32%</i><i style="--share:20%;--series:var(--chart-segment)">20%</i></div></div><div class="stack-row"><span>Mid-market</span><div class="stack"><i style="--share:35%;--series:var(--chart-series-1)">35%</i><i style="--share:39%;--series:var(--chart-series-2)">39%</i><i style="--share:26%;--series:var(--chart-segment)">26%</i></div></div><figcaption>Purchase priority, % of UK software buyers, Q2 2026, n = 420</figcaption></figure>
```

```css
.stacked-chart { display: grid; gap: var(--space-4); margin: 0; }
.stack-row { display: grid; grid-template-columns: 120px 1fr; gap: var(--space-3); align-items: center; }
.stack { display: flex; height: 34px; overflow: hidden; }
.stack i { width: var(--share); display: grid; place-items: center; background: var(--series); font: var(--type-chart-label); font-style: normal; }
.stacked-chart figcaption { font: var(--type-label); color: var(--text-secondary); }
```

Choose accessible text colour for each resolved segment fill and apply the shared [direct-label gate](index.md#direct-label-gate); retain a failed internal label through an eligible external label or the legend.

### Variant HTML slots

The cumulative and two-period variants reuse one segment order and one shared legend. Connector and endpoint geometry are calculated attachments, not new data series:

```html
<figure class="stacked-chart" data-role="chart-field" data-variant="cumulative-stacked-progression">
  <ul class="chart-legend" data-component="chart-legend" data-variant="swatch" aria-label="Components"></ul>
  <ol class="stacked-progression" aria-label="Component progression by year">
    <li data-period="year-1" data-total="17"><span data-series="base" data-value="9">9</span><span data-series="expansion" data-value="4">4</span><span data-series="new" data-value="4">4</span></li>
    <li data-period="year-2" data-total="34"><span data-series="base" data-value="12">12</span><span data-series="expansion" data-value="12">12</span><span data-series="new" data-value="10">10</span></li>
    <li data-period="year-3" data-total="67"><span data-series="base" data-value="21">21</span><span data-series="expansion" data-value="27">27</span><span data-series="new" data-value="19">19</span></li>
  </ol>
  <svg class="stack-boundary-connectors" data-component="boundary-connectors" aria-hidden="true"></svg>
</figure>

<figure class="stacked-chart" data-role="chart-field" data-variant="two-period-mix-shift">
  <ol class="stacked-endpoints">
    <li data-period="current" data-total="80"><span data-series="core" data-value="40">40</span><span data-series="growth" data-value="40">40</span></li>
    <li data-period="future" data-total="85"><span data-series="core" data-value="40">40</span><span data-series="growth" data-value="45">45</span></li>
  </ol>
  <div class="chart-callout" data-component="chart-callout" data-variant="endpoint-change" data-start="current" data-end="future"><span>+5 total; growth share rises from 50% to 53%</span></div>
</figure>
```

The adapter draws connector segments only through the gaps between peer columns, one line per stable boundary. It derives total and share labels independently so a change in magnitude never silently changes the stated mix.

## Platform mapping

Freeze series order and stack mode in the scene. Normalize percentage stacks before layout and suppress a narrow-segment label only through the declared label rule, never an application default.

## Failure modes

Comparing many middle segments, inconsistent series order, irregular time in an area chart, too many colors, narrow segments with unreadable labels, and totals that do not reconcile.

## Acceptance test

Each total or 100% stack reconciles after rounding, and the composition change supporting the title can be found without consulting a legend repeatedly.
