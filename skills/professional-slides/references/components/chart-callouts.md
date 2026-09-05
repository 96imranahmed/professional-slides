# Chart Callouts

Chart callouts attach interpretation to a specific mark, interval, gap, threshold, or outlier inside quantitative evidence. They are distinct from a detached slide-level synthesis or action, which is governed by the [`Insight Box`](insight-box.md).

## Growth-rate callout

Use a bracket, interval line, arrow, or endpoint label to show a supported absolute change, percentage-point change, CAGR, or index movement. Name the period and basis. Distinguish `%` from percentage points and do not calculate CAGR across inconsistent periods.

## Key-observation callout

Use one short sentence placed beside the decisive mark, with a leader line that terminates at the exact evidence. State the pattern and its implication only when the action title does not already make both obvious. Avoid generic headings such as “Key takeaway,” “What it means,” or “Read the outliers.”

Choose one supported treatment:

- `callout` is the default: a canvas surface with a primary outline and a defined arrowhead. Set `border: false` for the borderless variant; retain the same text, spacing, and connector. Prefer a straight horizontal or vertical connector, using a diagonal only when the available space requires it.
- The former tinted `takeaway-box` treatment is retired. Legacy inputs resolve to `callout`; new specimens use the retained callout construction.
- `orthogonal-dot` uses a horizontal or vertical leader with no arrowhead and a small primary endpoint dot on the exact evidence. Prefer it when the plot provides a clear straight corridor. If the box or corridor would cover a mark, marker, point highlight, data label, reference label, or peer annotation, reject the treatment and use another orientation or `callout`; do not bend or diagonalize it silently. It also accepts `border: false`.

Keep the endpoint dot subordinate to the data mark. A straight leader attaches to the nearest box edge and ends at the keyed data coordinate, never merely near the series.

## Threshold and outlier callout

Draw the threshold in the plot area and label its source or decision meaning. Label an outlier directly with its value and identity. Do not recolour unrelated points to create contrast; use the registered peer base and one declared highlight.

## Shared highlight and change grammar

Use these constructions across chart families rather than redrawing one-off treatments:

- `endpoint arrow`: a directional line with an explicit native triangular end arrowhead connects exact A and B evidence. Put the calculated absolute, percentage-point, percentage, CAGR, or index change in one compact label centered on the line. It may span two bars, two line points, or two declared series within one category.
- `interval bracket`: a quiet span and two drops connect exact endpoints when the selected range matters more than direction. It may cover a long time range or repeat across grouped categories when every bracket compares the same series pair.
- `start-to-end construction`: a quiet horizontal span, start drop, and terminal line with an explicit native triangular end arrowhead connect an opening state to a reconciled closing state. Use it for a waterfall or total stack bridge, not as a decorative roof over unrelated categories.
- `annotation rail`: one aligned row below chronological category labels carries a necessary period-level secondary measure. Bind each entry to an exact category key, label the separate unit once, and omit the rail when it repeats plotted values.
- `forecast band`: one open plot region marks the complete estimate or forecast interval. Bind its boundary and tint to the forecast state, label it once, and keep the underlying marks in the same series mapping as history unless scenario identity changes.
- `focal span`: one theme-primary outline or light-neutral tint identifies a decision-relevant period, category, or group while leaving every mark and label readable. Give the span symmetric cross-axis breathing room and keep labels clear of its edge. Use the outline when the boundary matters and the tint when the whole region matters. The span must name the selection basis and must not recolour peers into false categories.
- `segment emphasis`: retain the segment's category hue, strengthen only its approved intensity or outline, and mute peer segments through theme bindings. Use when one segment, rather than the whole row or column, proves the title.
- `evidence leader`: one short leader terminates at the exact mark, boundary, or gap. Use for outliers, thresholds, and decisive values, not for decorative arrows that merely point toward a chart.
- `orthogonal evidence leader`: one straight horizontal or vertical leader leaves a light takeaway box and ends in a small dot at the exact keyed mark. Use it only when a clear corridor exists; it never carries an arrowhead and never changes into a diagonal leader as a fallback.

Choose one primary highlight mechanism. A forecast band may coexist with one evidence leader because forecast is a data state. Do not surround one fact with several competing marks.

Change labels use the active theme's component primary and on-primary text; leaders use the quiet rule role. Never introduce a bright local colour. Change lines must stop clear of data labels and terminate at their exact keyed evidence.

Typography, contrast, clearance, and fit follow the canonical [direct-label gate](../charts/index.md#direct-label-gate). This owner adds only callout geometry: surfaces, leaders, endpoint binding, and the highlight or change mechanism.

For an unstacked bar or column chart with exactly one series, a single-bar highlight may instead set the selected bar to `component-primary` and all peer bars to the chart-neutral role. Use a region outline or tint for grouped bars so the series mapping and legend remain intact. Bind every selection to an exact category key; never infer the focus from position alone.

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

```html
<aside class="chart-callout" data-component="chart-callout" data-variant="borderless" data-target="2025">
  <p>Adoption accelerates after launch</p>
  <span class="leader" aria-hidden="true"></span>
</aside>

<aside class="chart-callout orthogonal-dot" data-component="chart-callout" data-variant="orthogonal-dot" data-orientation="horizontal" data-side="left" data-target="priority">
  <p>Scale the proven priority</p>
  <span class="leader"><i class="endpoint-dot" aria-hidden="true"></i></span>
</aside>
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
  --chart-callout-muted-region: var(--surface-2);
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
.orthogonal-dot { background: var(--chart-callout-forecast-region); border: var(--chart-callout-line-width) solid var(--chart-callout-border); color: var(--chart-callout-color); padding: var(--chart-callout-padding); }
.chart-callout[data-variant="borderless"] { border: none; }
.orthogonal-dot .leader { border-color: var(--chart-callout-leader); border-style: solid; border-width: 0 0 var(--chart-callout-line-width); }
.orthogonal-dot .endpoint-dot { background: var(--chart-callout-highlight); border-radius: 50%; display: block; inline-size: 0.5rem; block-size: 0.5rem; }
.chart-with-callout figcaption { font: var(--type-label); color: var(--text-secondary); }
```

## Acceptance check

Verify every callout terminates at its evidence. A dot-ended leader is exactly horizontal or vertical, has no arrowhead, clears every protected chart element, and places its dot on the keyed target. Calculations reconcile to plotted values and periods. Forecast and focal regions state their basis. Wording adds meaning. Marks survive without colour. One primary highlight leads. Apply the [`Insight Box`](insight-box.md) limits to any detached synthesis or terminal action.
