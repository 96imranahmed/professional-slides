# Line Charts

## Best for

Trends, inflection points, trajectory comparisons, and actual-versus-forecast over continuous ordered time.

## Guidance note

- Use when direction, pace, inflection, or divergence across continuous ordered time is the evidence.
- Why: connected observations preserve trajectory and make turning points visible.
- Action title: state the trend, inflection, or gap that matters over the declared period.

## Data contract

A consistently spaced temporal or ordered x-axis, numeric measures, explicit units, and status boundaries for forecast or target. The current runtime rejects missing observations: every series must contain exactly one finite value per category; nulls, mismatched arrays, and bounds excluding values fail before layout. Do not replace missing data with zero, interpolate silently, or drop a period and connect across it. If gaps are material, extend the canonical chart owner with an explicit gap policy before authoring or choose an exhibit that preserves the unavailable observations.

## Construction

- Preserve chronological order and honest interval spacing.
- Emphasize no more than four series; use small multiples for more.
- Apply the shared [direct-label gate](index.md#direct-label-gate) to endpoints and crossings; retain the legend when identity remains ambiguous.
- Show forecast with a dashed line or an explicit boundary or band. A lighter tone may supplement, never replace, the non-colour cue.
- Annotate only decisive peaks, troughs, crossings, or external events.
- Use shared scales for small multiples intended for comparison.
- Do not smooth in a way that changes the apparent data.
- A filled area is one closed polygon following the series and baseline, not a stack of overlapping rectangles or independent point fills.
- Apply the [shared plot-field rule](index.md); trajectory lookup may justify quiet gridlines.

## Construction details

Attach supported growth, inflection, or threshold annotations through [`chart callouts`](../components/chart-callouts.md) rather than a detached generic insight box.

Use one endpoint arrow for directional change across a short or long declared range. Use a bracket when the interval matters more than direction. When a secondary period-by-period metric is necessary, place one aligned annotation rail below the time labels instead of floating repeated labels inside the plot.

For small multiples, repeat the same plot height, time anchors, direct-label rule, and value format. Print each value once: never combine an automatic point label with a second manually placed copy. If only three observations exist and slope is not the message, prefer compact columns to a pseudo-line whose geometry is visually fragile.

## Platform mapping

Normalize date intervals, series order, forecast boundaries, markers, and dash semantics in the scene because application defaults vary. Apply the missing-observation restriction above before platform conversion.

## Failure modes

Irregular periods presented as equal, markers on every point, duplicate direct labels, broken pseudo-lines, unexplained dual axes, too many similar series, and a trend line described causally without supporting analysis.

## Acceptance test

The direction, inflection, and status boundary remain clear in grayscale and all plotted points reconcile to the source.
