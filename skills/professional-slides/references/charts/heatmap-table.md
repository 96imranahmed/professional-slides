# Analytical Tables and Heatmaps

## Best for

Comparisons with shared row or column dimensions, including qualitative evidence, options, assessments, exact values, and in-cell charts. A table is one exhibit whose columns can use different encodings.

## Guidance note

- Use when several items must be compared across repeated qualitative, quantitative, status, or implication fields.
- Why: a typed table aligns unlike evidence in one scan path while preserving exact values and developed reasoning.
- Action title: state the cross-row differentiator, trade-off, implication, or decision pattern rather than describing the table structure.

## Data contract

Declare ordered columns, typed cells, row groups, missing states, and any numeric scales, units, anchors and precision. Row and column cardinality come directly from the supplied arrays; the table has no fixed business-schema count. Column count and order follow the comparison, not a fixed category/evidence/consequence template.

## Typed table model

The canonical runtime owner is `table` in [`tables.mjs`](../../runtime/tables.mjs). `trend-rows`, `comparison-table`, and `heatmap` are compatibility presets that consume the same compiler. Do not create a second table renderer for a business topic.

Columns supply `label`, `type`, alignment and width defaults. Widths may be positive relative weights or `{px: number}`; `columnWidths` accepts positive fractions summing to one. Cells can override the column type, enabling options as columns with prose, bullets and ratings in different rows. Use these encodings:

Default to a filled category first column when row labels organize the adjacent evidence. Declare it as `category`, not bold `text`, and use theme-primary fill with contrasting text consistently. An unfilled category column (`surface: plain`) is a deliberate exception for an explicit reference requirement or a demonstrated readability benefit, not the neutral starting point. Record the reason in the treatment ledger. Ordinary identifiers and descriptive prose do not become categories merely because they occupy the first column.

| Cell type | Content and behavior |
| --- | --- |
| `text` | Natural clauses with enough detail to explain the comparison |
| `bullets` | An `items` array with compact hanging indents and measured wrapping |
| `category` | A row or group label; palette primary with contrasting text by default, or `surface: plain` |
| `highlight` | A light accent fill with normal dark text; stronger weight only when meaningful |
| `number` | An exact metric or formatted numeric value. `numberDisplay: circle` is the default for compact growth or change columns; `numberDisplay: oval` uses a wide primary bubble with centered on-primary text; use `numberDisplay: plain` for ordinary tabular values. |
| `binary` | Compact binary state using the registered [comparison-indicator](../components/comparison-indicators.md) contract |
| `harvey` | Ordinal disc using the registered [comparison-indicator](../components/comparison-indicators.md) contract |
| `heatmap` | Bounded score using the registered [comparison-indicator](../components/comparison-indicators.md) contract |
| `bars` | One or more labelled bars with one zero-based scale shared across rows |
| `implication` | With `relation: implies`, connect the preceding fact/condition to the following consequence in each row; use ordinary columns for non-causal comparisons |

Treat an implication column as clear connector space: omit its header rule and every row separator beneath the arrow, while the adjacent evidence and consequence columns retain their normal rules.

Indicator cells reference a named record in `scales`; the table compiler owns placement and puts the corresponding legend below the table. [`Comparison indicators`](../components/comparison-indicators.md) owns state meaning, labels, bounds, anchors, missing values, non-colour cues, and the mapping of other indicator requests to registered cell types. Bar records remain table-native and declare units, maximum, and ordered series.

Category fills consume `color.componentPrimary` (`--component-primary`), as do inference markers and primary insight surfaces. The named presets map this role to McKinsey dark navy, BCG green, and Bain red. Company themes may change its value while preserving the binding and text contrast; bright chart-series colours do not replace this role.

Rows accept `style: plain | accented`, independently of cell encodings. A category cell may set `rowSpan`; covered cells in subsequent rows must be `null`. Other missing values must be explicit. Row height follows the tallest measured cell, and a spanning category reserves enough space across its group. Do not stretch sparse rows to fill the page. There is no schema-level row or column cap: small and large tables use the same compiler. When page density is unspecified, more than five rows or four columns suggest `pre-read`; more than eight rows or six columns suggest `appendix`. An explicitly chosen family density takes precedence and must pass actual fit checks. The table itself defaults to `body` at every cardinality; select `compact` or `dense` deliberately for a coherent family. Do not combine automatic page promotion with another automatic type reduction. Widen, edit or split physical overflow instead of shrinking one cell or label.

Circular and oval numbers are presentation treatments, not rating scales. Keep the exact value inside the editable theme-bound bubble, centre it in its column and row, and use the same treatment down the complete metric column. Separate metric columns may demonstrate circle and oval variants. Use plain right-aligned numbers when bubbles would over-emphasize routine values or when the formatted value cannot fit without enlarging the column. In-cell bar values use the active table body size, including its shared density adjustment. Two-series bars default to a strongly contrasting theme-bound pair, with identical legend swatches.

A category may set `sectionNumber` to a unique positive integer for referenceable cases, numbered findings or discussion sections. On a filled category block, render the number in a compact circular marker centered on its top edge, with half protruding into reserved whitespace. On a plain category cell, place the marker inline beside the label, reserve its width before measuring text, and align its centre with the label. A floating edge marker needs a visible block to anchor it. Reserve clearance both above the group and inside the category so the inward half cannot cover its label, including short and spanning cells. Single-row labels and their numeric peers share the same vertical content centre; marker clearance must not push only the label below its values. Do not pin it to the top-left corner or let it collide with the preceding group. The marker's job is referenceability, not decoration; obvious reading order does not remove the need to identify cases that will be discussed individually.

Use one body density for the table: `body` by default or the registered `compact` role for a consistently dense table family. Headers retain the shared header role.

## Case identifiers and logical order

When cases need identifiers for discussion or cross-reference, attach a compact circular identifier to each case/category field. Distinct natural scenario names already provide identifiers; do not automatically add numbered badges to Late, Midpoint and Early or to ordinary named data rows. Default to natural integers `1`, `2`, `3`, not zero-padded numbers. Use the canonical category `sectionNumber` treatment rather than typing Unicode circled digits or drawing slide-local badges. Preserve established case names such as Case A and Case B; do not silently rename them to match a new row position. Identifiers distinguish cases and do not claim a score or rank. Omit markers on ordinary data rows with no referenceability need.

Every table and associated comparison chart must have a deliberate logical progression, never accidental input order. Select the order that serves the question: chronology, dependency, ordinal outcome, magnitude or meaningful grouped categories. Preserve a meaningful natural order rather than sorting it away. For decision cases, group by the ordered action states; for example, Avoid → Hold → Buy. Within a group, use a relevant secondary order such as ascending value/share, unless a baseline-first comparison is clearer. Document the sort keys in the content plan, not as extra audience-facing furniture.

Choose the progression before assigning new identifiers. Once a case has an established identifier, keep it stable through later sorting and across charts, tables and prose. Move the entire case record, including assumptions, values, qualifiers and references; never sort individual columns independently. Related exhibits must use the same case mapping and compatible order, except where an explicit analytical purpose requires another order.

Release checks must reject missing identifiers on referenceable case lists, arbitrary or unexplained outcome reversals, detached values after sorting, and mismatched case references. Verify marker contrast, reserved whitespace and collision-free placement in the final render.

## Scale construction

- Use a sequential scale for magnitude.
- Use a diverging scale only around a meaningful documented midpoint.
- Keep cell size and row/column order consistent.
- Provide legend endpoints and units.
- Apply the [logical ordering rule](#case-identifiers-and-logical-order) before layout.
- Use a [`table`](#typed-table-model) with `highlight` cells when exact values matter more than colour pattern.
- Every colour-encoded cell follows the value, symbol, and missing-state requirements in [`comparison indicators`](../components/comparison-indicators.md).

## Platform mapping

Generate editable cell fills from the declared domain, not row-relative application defaults. Bind text contrast, padding, and missing-value treatment to each resolved scale stop before serialization.

## Table header contract

A table in a split analytical layout follows the [peer section-title requirement](../design/slide-layouts.md#analytical-composites). Give the exhibit one substantive heading above the column-header row when the measure or scope needs it. Reuse an existing parent heading rather than adding another title for the same exhibit. Field labels remain necessary decoding information. Keep this heading separate from the column-header treatment below.

When every column label is intentionally empty, omit the header band and its rules entirely; do not reserve an empty header strip. A partially labelled header retains the shared band for column alignment. Omit labels only when the surrounding exhibit makes every field's meaning clear.

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

Treat the table as an analytical exhibit, not a pasted spreadsheet. Set one reading direction. Prefer whitespace and selective horizontal rules to boxes. Group related columns. Use fills for category hierarchy, meaningful emphasis, or encoded status, not decoration. Avoid equal dark borders, saturated headers with dense gridlines, and uniform row weight. These treatments flatten hierarchy even when alignment is correct.

Actively look for a useful comparison before settling for prose-only columns. Where evidence supports a common criterion, prefer exact metrics, Harvey balls, anchored 1–5 scores, feasibility checks/crosses, or graded alignment marks to repeated qualitative phrases. Put the comparative encoding beside the concise evidence that explains it; a symbol does not replace the reasoning. Follow [comparison indicators](../components/comparison-indicators.md#select-the-encoding) for scale choice and implementation. Keep prose-only tables when rows cannot fairly share a measure, such as distinct source definitions; do not invent ratings to make a table look analytical.

When a distinct slide-level synthesis is needed, place one [insight box](../components/insight-box.md) below the table; otherwise omit it. Reserve space for the legend and selected insight before measuring available table height. Omit generic introductions that merely announce a table, but retain the substantive section title required for split-layout peers. A methodology appendix may retain necessary definitions without an invented insight.

For qualitative comparisons, develop the evidence and consequence with complete clauses or two or three substantive bullets where needed. Labels and one-word consequences rarely explain an investment or diligence decision. Add reasoning, not repetition or routine calculations. Use the [copy contract](../components/copy.md) to distinguish useful detail from speaker notes.

## Construction details

Use the typed table model above and the shared [comparison indicators](../components/comparison-indicators.md). For a pure heatmap, retain the same table geometry, replace only the indicator cells with accessible sequential fills, and keep the printed value or symbol visible.

## Failure modes

Rainbow scales, red/green-only meaning, an arbitrary midpoint, row-relative coloring presented as absolute, excessive precision, and differences too subtle for projection or export.

## Acceptance test

Check every requested column and row, including span continuations and explicit missing states. Confirm the rendered row and column counts match the supplied arrays rather than a fixture-specific count. Verify that genuine category labels use the filled default or have a recorded exception, and that supported cross-row comparisons are visible rather than buried in prose. Bar lengths share one scale, heatmap legends reproduce the cell colours, and symbols remain interpretable without colour. Verify circular numbers are centred and remain exact, table-to-legend-to-insight reading order, content-sized rows, uniform header treatment, and consistent body fonts. Isolated variants and complete table pages must pass HTML/PPTX image, overlap, theme and Artifact Tool import checks.

## Dimension-led and full-field comparisons

Use table `treatment: dimensions` (registered `dimension-headers` variant) when rows are items compared across distinct dimensions. Fill the dimension headers across the top and leave the item/category header and cells plain. An explicitly declared category-cell surface remains an intentional emphasis. Declare `comparisonAxis: columns`. Conversely, when NYC/SF, products or scenarios are across the top and criteria are in the first column, declare `comparisonAxis: rows`, make the first column `type: category`, and use the open header treatment. Highlight the dimension axis, not the comparison-item axis. The runtime rejects a filled item header for declared row dimensions.

A table may occupy the full evidence field. Combine typed number, bar, Harvey-ball, binary and rationale columns when each answers a different part of the same comparison. Define units, scales and rating anchors; never substitute a Harvey ball for an exact value the decision needs. A total row must aggregate compatible quantities. Preserve a recurring schema across comparable slides instead of varying table treatments for decoration.
