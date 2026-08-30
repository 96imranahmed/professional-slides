# Heatmaps and Highlight Tables

## Best for

Patterns across two categorical dimensions, assessments, capability gaps,
risks, priorities, schedule intensity, and exact values with selective emphasis.

## Data contract

Row and column categories, numeric or ordinal cell values, missing-value state,
scale domain, midpoint if meaningful, sort order, units, and label precision.

## Construction

- Use a sequential scale for magnitude.
- Use a diverging scale only around a meaningful documented midpoint.
- Keep cell size and row/column order consistent.
- Provide legend endpoints and units.
- Sort to reveal structure when no natural order exists.
- Use a highlight table when exact values matter more than color pattern.
- Add symbols or values where accessibility requires redundant encoding.

## Platform mapping

Prefer editable cell shapes or tables with tokenized fills when native heatmap
support is weak. Generate colors from the declared domain, not row-relative
defaults. Render in both targets to verify contrast, text color, cell padding,
and missing-value treatment.

## Failure modes

Rainbow scales, red/green-only meaning, an arbitrary midpoint, row-relative
coloring presented as absolute, excessive precision, and differences too subtle
for projection or export.

## Acceptance test

The same high/low pattern remains visible in grayscale or with redundant
labels, and the legend reproduces every cell color from its value.
