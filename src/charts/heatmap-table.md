# Heatmaps and Highlight Tables

## Best for

Patterns across two categorical dimensions, assessments, capability gaps, risks, priorities, schedule intensity, and exact values with selective emphasis.

## Data contract

Row and column categories, numeric or ordinal cell values, missing-value state, scale domain, midpoint if meaningful, sort order, units, and label precision.

## Construction

- Use a sequential scale for magnitude.
- Use a diverging scale only around a meaningful documented midpoint.
- Keep cell size and row/column order consistent.
- Provide legend endpoints and units.
- Sort to reveal structure when no natural order exists.
- Use a highlight table when exact values matter more than color pattern.
- Add symbols or values where accessibility requires redundant encoding.

## Platform mapping

Prefer editable cell shapes or tables with tokenized fills when native heatmap support is weak. Generate colors from the declared domain, not row-relative defaults. Render in both targets to verify contrast, text color, cell padding, and missing-value treatment.

## Table header contract

Use one deck-wide header treatment for every analytical table: one fill role, one text role, one rule treatment, one row height, and one internal padding system. Bind it to the table-header entry in the design system's semantic treatment registry and reuse it without slide-local recolouring.

Do not give peer column headers different colours, colour the first header differently merely because it contains row labels, or use chart-series hues to make a header row appear more designed. Distinguish columns through width, alignment, wording, grouping, and data in the body. If colour is the data encoding, place that encoding in the body cells, marks, direct labels, or legend rather than in decorative header fills.

A table may use one secondary neutral header level only for a real nested hierarchy. That level must repeat with the same treatment in every comparable table and remain subordinate to the primary header. Use status colours only in the body cells or markers that carry the named status; they do not redefine the header palette.

## Table alignment

- Align the table's outer edge to deck or column guides, then define column boundaries from the comparison task rather than dividing the width evenly by default.
- Left-align descriptive text, right-align comparable numbers, and use decimal alignment when precision matters. Center only compact categorical markers whose labels have similar length.
- Keep headers aligned with their columns and apply the same internal padding token to every cell in the same role. Do not use spaces, tabs, or manual line breaks to force values into position.
- Align row labels and values to a consistent baseline. Increase row height for necessary wrapping rather than compressing the type role.
- Align subtotal and total rules across the full relevant comparison span. Use indentation, weight, whitespace, and fill consistently to show hierarchy.
- When two tables share a page, align their header baselines, comparable column boundaries, row rhythm, and bottom edge when practical. If row counts differ materially, top-align them and do not stretch one table merely to equalize height.
- Use the [`design` spacing tokens](../design/index.md#spacing-system) and the `body-compact`, `label`, or `micro` typography roles rather than local cell font sizes or padding.

## Failure modes

Rainbow scales, red/green-only meaning, an arbitrary midpoint, row-relative coloring presented as absolute, excessive precision, and differences too subtle for projection or export.

## Acceptance test

The same high/low pattern remains visible in grayscale or with redundant labels, the legend reproduces every cell color from its value, table headers use the registered deck-wide treatment without per-column colour variation, and headers, values, column boundaries, and padding remain aligned in the final render.
