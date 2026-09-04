# Line Charts

## Best for

Trends, inflection points, trajectory comparisons, and actual-versus-forecast over continuous ordered time.

## Data contract

A consistently spaced temporal or ordered x-axis, numeric measures, explicit units, a missing-value policy, and status boundaries for forecast or target.

## Construction

- Preserve chronological order and honest interval spacing.
- Emphasize no more than four series; use small multiples for more.
- Apply the shared [direct-label gate](index.md#direct-label-gate) to endpoints and crossings; retain the legend when identity remains ambiguous.
- Show forecast with a dashed line or an explicit boundary or band. A lighter tone may supplement, never replace, the non-colour cue.
- Annotate only decisive peaks, troughs, crossings, or external events.
- Use shared scales for small multiples intended for comparison.
- Do not smooth in a way that changes the apparent data.

## Structural HTML reference

```html
<figure class="line-chart" data-role="chart-field"><svg viewBox="0 0 900 420" role="img"><path class="grid" d="M80 80H840M80 190H840M80 300H840"/><path class="series series--actual" d="M80 310L270 265L460 230L650 145"/><path class="series series--forecast" d="M650 145L840 95"/><path class="forecast-boundary" d="M650 60V330"/><text x="665" y="78">Forecast begins</text><text x="80" y="360">2023</text><text x="620" y="360">2025A</text><text x="810" y="360">2026F</text></svg><figcaption>Revenue, $m, UK enterprise accounts, FY2023 to FY2026F</figcaption></figure>
```

```css
.line-chart { margin: 0; display: grid; grid-template-rows: 1fr auto; gap: var(--space-2); }
.line-chart svg { width: 100%; height: 100%; }
.grid { stroke: var(--divider-rule); stroke-width: 1; }
.series { fill: none; stroke: var(--chart-series-1); stroke-width: 4; }
.series--forecast { stroke-dasharray: 10 8; }
.forecast-boundary { stroke: var(--page-guideline); stroke-width: 1.5; }
.line-chart text, .line-chart figcaption { font: var(--type-label); color: var(--text-secondary); }
```

Attach supported growth, inflection, or threshold annotations through [`chart callouts`](../components/chart-callouts.md) rather than a detached generic insight box.

For small multiples, repeat the same plot height, time anchors, direct-label rule, and value format. Print each value once: never combine an automatic point label with a second manually placed copy. If only three observations exist and slope is not the message, prefer compact columns to a pseudo-line whose geometry is visually fragile.

## Platform mapping

Normalize date intervals, missing-value gaps, series order, forecast boundaries, markers, and dash semantics in the scene because application defaults vary.

## Failure modes

Irregular periods presented as equal, markers on every point, duplicate direct labels, broken pseudo-lines, unexplained dual axes, too many similar series, and a trend line described causally without supporting analysis.

## Acceptance test

The direction, inflection, and status boundary remain clear in grayscale and all plotted points reconcile to the source.
