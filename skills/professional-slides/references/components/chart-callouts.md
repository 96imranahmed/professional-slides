# Chart Callouts

Chart callouts attach interpretation to a specific mark, interval, gap, threshold, or outlier inside quantitative evidence. They are distinct from a detached slide-level synthesis or action, which is governed by the [`Insight Box`](insight-box.md).

## Growth-rate callout

Use a bracket, interval line, arrow, or endpoint label to show a supported absolute change, percentage-point change, CAGR, or index movement. Name the period and basis. Distinguish `%` from percentage points and do not calculate CAGR across inconsistent periods.

## Key-observation callout

Use one short sentence placed beside the decisive mark, with a leader line that terminates at the exact evidence. State the pattern and its implication only when the action title does not already make both obvious. Avoid generic headings such as “Key takeaway,” “What it means,” or “Read the outliers.”

## Threshold and outlier callout

Draw the threshold in the plot area and label its source or decision meaning. Label an outlier directly with its value and identity. Do not recolour unrelated points to create contrast; use the registered peer base and one declared highlight.

## Shared highlight and change grammar

Use these constructions across chart families rather than redrawing one-off treatments:

- `endpoint change`: a thin arrow or bracket connects the exact start and end evidence. Put the calculated absolute, percentage-point, percentage, CAGR, or index change in one compact label centered on the interval. Use the arrow only when direction matters; use a bracket when the interval itself matters.
- `forecast band`: one open plot region marks the complete estimate or forecast interval. Bind its boundary and tint to the forecast state, label it once, and keep the underlying marks in the same series mapping as history unless scenario identity changes.
- `focal span`: one bounded band, row tint, or edge marker identifies a decision-relevant period, category, or group while leaving every mark and label readable. The span must name the selection basis and must not recolour peers into false categories.
- `segment emphasis`: retain the segment's category hue, strengthen only its approved intensity or outline, and mute peer segments through theme bindings. Use when one segment, rather than the whole row or column, proves the title.
- `evidence leader`: one short leader terminates at the exact mark, boundary, or gap. Use for outliers, thresholds, and decisive values, not for decorative arrows that merely point toward a chart.

Choose one primary highlight mechanism. A forecast band may coexist with one evidence leader because forecast is a data state. Do not surround one fact with several competing marks.

## Theme contract

The component consumes `--chart-callout-font`, `--chart-callout-color`, `--chart-callout-bg`, `--chart-callout-border`, `--chart-callout-leader`, `--chart-callout-padding`, `--chart-callout-series`, `--chart-callout-highlight`, `--chart-callout-muted-region`, `--chart-callout-forecast-region`, `--chart-callout-forecast-border`, `--chart-callout-line-width`, `--chart-callout-emphasis-width`, and `--chart-callout-label-radius`. [Component bindings](../theming/component-bindings.md#evidence-components) owns every resolved default.

## Structural HTML reference

```html
<figure class="chart-with-callout" data-role="chart-field">
  <div class="plot" aria-label="Illustrative line chart">
    <svg viewBox="0 0 900 420" role="img">
      <path class="series" d="M80 330 L250 280 L420 245 L590 160 L760 105"/>
      <rect class="forecast-region" x="570" y="36" width="220" height="322"/>
      <path class="growth-bracket" d="M590 145 V90 H760 V90"/>
      <text class="growth-label" x="675" y="72" text-anchor="middle">+18% CAGR, 2022-25</text>
      <circle class="highlight" cx="760" cy="105" r="7"/>
      <path class="leader" d="M755 112 L700 170"/>
      <text class="observation" x="690" y="194" text-anchor="end">Growth accelerates after enterprise launch</text>
    </svg>
  </div>
  <figcaption>Revenue, $m, UK enterprise accounts, FY2022 to FY2025</figcaption>
</figure>
```

```css
.chart-with-callout {
  --chart-callout-font: var(--type-chart-annotation);
  --chart-callout-color: var(--ink);
  --chart-callout-bg: var(--canvas);
  --chart-callout-border: var(--rule-quiet);
  --chart-callout-leader: var(--page-guideline);
  --chart-callout-padding: var(--space-2);
  --chart-callout-series: var(--chart-series-1);
  --chart-callout-highlight: var(--component-primary);
  --chart-callout-muted-region: var(--surface-1);
  --chart-callout-forecast-region: var(--component-primary-tint);
  --chart-callout-forecast-border: var(--rule-emphasis);
  --chart-callout-line-width: var(--line-hairline);
  --chart-callout-emphasis-width: var(--line-standard);
  --chart-callout-label-radius: var(--radius-round);
  margin: 0;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: var(--space-2);
}
.plot svg { width: 100%; height: 100%; overflow: visible; }
.forecast-region { fill: var(--chart-callout-forecast-region); stroke: var(--chart-callout-highlight); stroke-width: var(--chart-callout-line-width); }
.series { fill: none; stroke: var(--chart-callout-series); stroke-width: var(--chart-callout-emphasis-width); }
.growth-bracket, .leader { fill: none; stroke: var(--chart-callout-leader); stroke-width: var(--chart-callout-line-width); }
.growth-label, .observation { font: var(--chart-callout-font); fill: var(--chart-callout-color); }
.highlight { fill: var(--chart-callout-highlight); }
.chart-with-callout figcaption { font: var(--type-label); color: var(--text-secondary); }
```

## Acceptance check

Verify every callout terminates at its evidence. Calculations reconcile to plotted values and periods. Forecast and focal regions state their basis. Wording adds meaning. Marks survive without colour. One primary highlight leads. Apply the [`Insight Box`](insight-box.md) limits to any detached synthesis or terminal action.
