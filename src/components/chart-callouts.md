# Chart Callouts

Chart callouts attach interpretation to a specific mark, interval, gap, threshold, or outlier. They are part of the quantitative evidence field and do not automatically consume the slide's separate terminal-action surface. A detached insight box that summarizes the entire page does consume the slide's single visually distinct callout budget.

## Growth-rate callout

Use a bracket, interval line, arrow, or endpoint label to show a supported absolute change, percentage-point change, CAGR, or index movement. Name the period and basis. Distinguish `%` from percentage points and do not calculate CAGR across inconsistent periods.

## Key-observation callout

Use one short sentence placed beside the decisive mark, with a leader line that terminates at the exact evidence. State the pattern and its implication only when the action title does not already make both obvious. Avoid generic headings such as “Key takeaway,” “What it means,” or “Read the outliers.”

## Threshold and outlier callout

Draw the threshold in the plot area and label its source or decision meaning. Label an outlier directly with its value and identity. Do not recolour unrelated points to create contrast; use the registered peer base and one declared highlight.

## Structural HTML reference

```html
<figure class="chart-with-callout" data-role="chart-field">
  <div class="plot" aria-label="Illustrative line chart">
    <svg viewBox="0 0 900 420" role="img">
      <path class="series" d="M80 330 L250 280 L420 245 L590 160 L760 105"/>
      <path class="growth-bracket" d="M590 145 V90 H760 V90"/>
      <text class="growth-label" x="675" y="72" text-anchor="middle">+18% CAGR, 2022-25</text>
      <circle class="highlight" cx="760" cy="105" r="7"/>
      <path class="leader" d="M770 100 L825 68"/>
      <text class="observation" x="835" y="62">Growth accelerates after enterprise launch</text>
    </svg>
  </div>
  <figcaption>Metric, unit, population, and period</figcaption>
</figure>
```

```css
.chart-with-callout { margin: 0; display: grid; grid-template-rows: 1fr auto; gap: var(--space-2); }
.plot svg { width: 100%; height: 100%; overflow: visible; }
.series { fill: none; stroke: var(--chart-series-1); stroke-width: 4; }
.growth-bracket, .leader { fill: none; stroke: var(--page-guideline); stroke-width: 1.5; }
.growth-label, .observation { font: var(--type-chart-annotation); fill: var(--ink); }
.highlight { fill: var(--component-primary); }
.chart-with-callout figcaption { font: var(--type-label); color: var(--text-secondary); }
```

## Acceptance check

Every callout terminates at the evidence it interprets, calculations reconcile to the plotted values and periods, the wording adds meaning rather than repeating a label, the mark remains legible without colour, and the complete slide still has no more than one detached callout region and one terminal-action surface.
