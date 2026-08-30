# Scatter and Bubble Charts

## Best for

Relationships between two measures, segmentation, prioritization, and a third
magnitude encoded by bubble area.

## Data contract

One observation per point, x and y measures with units, optional size measure,
stable observation IDs, missing-value policy, and documented thresholds for any
quadrants. Record transformations and the basis of any fitted line.

## Construction

- Label axes with units and direction of desirability where relevant.
- Encode magnitude by bubble area, not diameter.
- Add quadrant lines only when thresholds are meaningful.
- Label highlighted points and provide a key or appendix for the rest.
- Use transparency or disclosed jitter only to reveal overlap.
- Add a trend line only with an appropriate method.
- Use association language unless the analysis supports causality.

## Platform mapping

Verify whether the target API interprets bubble size as area or diameter and
normalize input accordingly. Preserve observation-to-label mapping during sort
or filtering. Check axes, quadrants, bubble sizing, and highlighted labels in
the final render.

## Failure modes

Decorative bubble sizes, unlabeled decisive outliers, arbitrary quadrants,
occluded points, unsupported causal claims, and sizing behavior that differs
between PowerPoint and Google Slides.

## Acceptance test

The highlighted relationship and outliers remain identifiable when labels are
hidden, and every displayed label maps to the correct observation.
