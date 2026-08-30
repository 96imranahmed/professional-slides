# Line Charts

## Best for

Trends, inflection points, trajectory comparisons, and actual-versus-forecast over continuous ordered time.

## Data contract

A consistently spaced temporal or ordered x-axis, numeric measures, explicit units, a missing-value policy, and status boundaries for forecast or target.

## Construction

- Preserve chronological order and honest interval spacing.
- Emphasize no more than four series; use small multiples for more.
- Label endpoints when crossings do not create ambiguity.
- Show forecast with a dashed line, lighter tone, or band and a labeled boundary.
- Annotate only decisive peaks, troughs, crossings, or external events.
- Use shared scales for small multiples intended for comparison.
- Do not smooth in a way that changes the apparent data.

## Platform mapping

Map forecast styling, missing values, markers, line width, and axis dates explicitly because defaults vary. Verify series order and forecast boundary in the exported/rendered artifact. Prefer shapes for a short, highly annotated sparkline only when native chart behavior is unstable.

## Failure modes

Irregular periods presented as equal, markers on every point, unexplained dual axes, too many similar series, and a trend line described causally without supporting analysis.

## Acceptance test

The direction, inflection, and status boundary remain clear in grayscale and all plotted points reconcile to the source.
