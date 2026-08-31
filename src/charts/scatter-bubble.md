# Scatter and Bubble Charts

## Best for

Relationships between two measures, segmentation, prioritization, and a third magnitude encoded by bubble area.

## Data contract

One observation per point, x and y measures with units, optional size measure, stable observation IDs, missing-value policy, and documented thresholds for any quadrants. Record transformations and the basis of any fitted line.

## Construction

- Label axes with units and direction of desirability where relevant.
- Encode magnitude by bubble area, not diameter.
- Add quadrant lines only when thresholds are meaningful.
- Label highlighted points and provide a key or appendix for the rest.
- Use transparency or disclosed jitter only to reveal overlap.
- Add a trend line only with an appropriate method.
- Use association language unless the analysis supports causality.
- Use authorized logos inside points when entity recognition materially improves a market map or competitor landscape. Preserve the analytical position and bubble area; the logo does not become the mark's size encoding.
- Give every logo equal clear-space rules and a neutral backing when needed. Fall back to a short text label when an authorized asset is unavailable.
- When all bubbles are equal size, state that position alone is the encoding. Do not vary diameter decoratively.

## Logo-bubble structural reference

Use the standalone specimen and construction rules in [`market-landscape`](../slide-types/market-landscape.md#structural-html-reference). Bind peer bubbles to the chart's neutral or base series role and use the declared highlight only for the entity named as exceptional in the title or annotation.

## Platform mapping

Verify whether the target API interprets bubble size as area or diameter and normalize input accordingly. Preserve observation-to-label mapping during sort or filtering. Check axes, quadrants, bubble sizing, and highlighted labels in the final render.

## Failure modes

Decorative bubble sizes, unauthorized or distorted logos, logo size that replaces the documented area encoding, unlabeled decisive outliers, arbitrary quadrants, occluded points, unsupported causal claims, and sizing behavior that differs between PowerPoint and Google Slides.

## Acceptance test

The highlighted relationship and outliers remain identifiable when logos are replaced by text labels, every displayed label maps to the correct observation, and every bubble area and position reconciles to the declared measures.
