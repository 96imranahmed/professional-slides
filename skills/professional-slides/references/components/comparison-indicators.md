# Comparison Indicators

Comparison indicators compress completeness, progress, readiness, or a bounded score inside a table or comparison field. They must expose the underlying scale and remain subordinate to the row evidence.

Use the semantic row and cell icon contract in [`icons-and-logos`](icons-and-logos.md#row-and-cell-icons) when a compact library icon improves scanning or replaces a repeated low-information word. Keep numeric progress and rubric scores in the constructions below; do not replace an auditable value with a decorative icon.

## Progress circles

Use a progress circle when the encoded quantity is a true share of completion from `0%` to `100%`. Print the percentage or numerator and denominator inside or beside the mark. Use one neutral track and one component-primary progress arc; reserve positive, caution, or negative colours for explicitly named status thresholds.

Do not use a progress circle for a qualitative confidence label, arbitrary maturity stage, or decorative status. When the percentage is more important than the shape, print the value and use a thin horizontal bar instead.

## One-to-five scores

Use a one-to-five heatmap score only when the scale has named anchors and a reproducible scoring rule. Print the score as a number, dot count, or compact cell label. A sequential primary tint may encode intensity; do not use five unrelated hues or imply precision beyond the rubric.

Place score definitions, weights, and missing-value treatment in the slide or notes. Use `N/A` for non-applicable and `Not available` for a genuinely unavailable value inside a data table; do not use an em dash or silently score missing evidence as zero.

## Structural HTML reference

```html
<table class="score-table" data-role="comparison-scorecard">
  <thead><tr><th>Workstream</th><th>Completeness</th><th>Evidence quality</th><th>Decision implication</th></tr></thead>
  <tbody>
    <tr><th>Customer retention</th><td><span class="progress" style="--value:72"><span>72%</span></span></td><td><span class="score" data-score="4">4 / 5</span></td><td>Enough for base case; cohort depth still required</td></tr>
    <tr><th>Pricing</th><td><span class="progress" style="--value:38"><span>38%</span></span></td><td><span class="score" data-score="2">2 / 5</span></td><td>Open diligence gate</td></tr>
  </tbody>
</table>
```

```css
.score-table { width: 100%; border-collapse: collapse; font: var(--type-body-compact); color: var(--ink); }
.score-table thead { background: var(--component-primary); color: var(--on-primary); }
.score-table th, .score-table td { padding: var(--space-3); border-bottom: var(--rule-quiet); text-align: left; }
.progress { --value: 0; width: 52px; aspect-ratio: 1; display: grid; place-items: center; border-radius: 50%; background: conic-gradient(var(--component-primary) calc(var(--value) * 1%), var(--chart-segment) 0); position: relative; }
.progress::after { content: ""; width: 38px; aspect-ratio: 1; border-radius: 50%; background: var(--canvas); position: absolute; }
.progress span { position: relative; z-index: 1; font: var(--type-label); }
.score { display: inline-block; min-width: 48px; padding: var(--space-1) var(--space-2); text-align: center; background: color-mix(in srgb, var(--component-primary) calc(attr(data-score type(<number>)) * 12%), var(--canvas)); }
```

The `color-mix` expression is illustrative. Production adapters must calculate accessible tints from the declared score domain because presentation platforms do not evaluate browser CSS.

## Acceptance check

Every indicator maps to a declared numeric domain, the printed value remains visible without colour, peer marks use one construction, missing values are explicit, status colours appear only at defined thresholds, and the table remains readable when the indicators are removed.
