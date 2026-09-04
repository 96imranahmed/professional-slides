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
- Use progress circles only for true `0-100%` completion and use one-to-five score cells only for an anchored reproducible rubric. Follow [`comparison indicators`](../components/comparison-indicators.md) for the mark construction and missing-value treatment.

## Platform mapping

Generate editable cell fills from the declared domain, not row-relative application defaults. Bind text contrast, padding, and missing-value treatment to each resolved scale stop before serialization.

## Table header contract

Use one deck-wide header treatment for every analytical table: one fill role, one text role, one rule treatment, one row height, and one internal padding system. Bind it to the exact [`tableHeader` record](../design/index.md#semantic-treatment-registry) in the deck treatment ledger and reuse its `variantId` without slide-local recolouring.

Do not give peer column headers different colours, colour the first header differently merely because it contains row labels, or use chart-series hues to make a header row appear more designed. Distinguish columns through width, alignment, wording, grouping, and data in the body. If colour is the data encoding, place that encoding in the body cells, marks, direct labels, or legend rather than in decorative header fills.

A table may use one secondary neutral header level only for a real nested hierarchy. That level must repeat with the same treatment in every comparable table and remain subordinate to the primary header. Use status colours only in the body cells or markers that carry the named status; they do not redefine the header palette.

## Table alignment

- Align the table's outer edge to deck or column guides, then define column boundaries from the comparison task rather than dividing the width evenly by default.
- Left-align descriptive text, right-align comparable numbers, and use decimal alignment when precision matters. Center only compact categorical markers whose labels have similar length.
- Keep headers aligned with their columns and apply the same internal padding token to every cell in the same role. Do not use spaces, tabs, or manual line breaks to force values into position.
- Align row labels and values to a consistent baseline. Increase row height for necessary wrapping rather than compressing the type role.
- Align subtotal and total rules across the full relevant comparison span. Use indentation, weight, whitespace, and fill consistently to show hierarchy.
- When two tables share a page, align their header baselines, comparable column boundaries, row rhythm, and bottom edge. Permit different bottom edges only when row counts differ materially, equal height would narrow a decisive column, or equal height would add avoidable wrapping; in those cases, top-align the tables.
- Use the [`theming` spacing and typography tokens](../theming/tokens.md) rather than local cell font sizes or padding.

## Table composition quality

Treat the table as an analytical exhibit, not a pasted spreadsheet. Set one reading direction. Prefer whitespace and selective horizontal rules to boxes. Group related columns. Emphasize only the evidence that carries the argument. Reserve filled cells for semantic status. Avoid equal dark borders, saturated headers with dense gridlines, and uniform row weight. These treatments flatten hierarchy even when alignment is correct.

For a qualitative diligence matrix, use an open table with a thin header rule. Add row bands only when they improve tracking. Keep one narrow label column, one decisive evidence column, and one consequence column. Place the implication below the table, not in a slogan row.

## Structural HTML reference

Use the table, progress-circle, and one-to-five score specimen in [`comparison-indicators`](../components/comparison-indicators.md#structural-html-reference). For a pure heatmap, retain the same table geometry, replace only the indicator cells with accessible sequential fills, and keep the printed value or symbol visible.

## Failure modes

Rainbow scales, red/green-only meaning, an arbitrary midpoint, row-relative coloring presented as absolute, excessive precision, and differences too subtle for projection or export.

## Acceptance test

The high/low pattern survives grayscale through redundant labels. The legend reproduces each value colour. Headers use the deck-wide treatment without per-column variation. Headers, values, boundaries, and padding align in the final render. The montage must preserve hierarchy and the highlighted conclusion.
