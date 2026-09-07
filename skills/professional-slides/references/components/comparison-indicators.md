# Table Cell Status and Comparison Indicators

This component owns compact completion, binary confirmation, traffic-light status, bounded heatmap scores, and ordinal fill discs inside tables. It keeps the indicator subordinate to the row evidence, preserves an explicit value, registered symbol, or label, and resolves every colour through the active theme.

Use the semantic row and cell icon contract in [`icons-and-logos`](icons-and-logos.md#row-and-cell-icons) when a compact library icon improves scanning or replaces a repeated low-information word. Use this component when the cell encodes measured completion, a threshold-based status, or an ordered score.

The shared component's five variants below are not all typed-table cell types. For current `table` serialization, use `binary`, `harvey`, or `heatmap` with the [table owner's scale contract](../charts/heatmap-table.md#typed-table-model). Completion spinners and traffic-light dots have no typed-table cell adapter yet: use a plain percentage `number` or a `bars` cell for completion, and explicit state `text` for traffic lights. Preserve their measurement or trigger definitions. If literal spinner/dot cells are required, extend and test the canonical table adapter; do not invent unsupported props or overlay marks manually.

## Select the encoding

Prefer a compact comparative encoding when rows share a meaningful criterion and the evidence supports consistent assessment. Choose the measure before the mark: exact values for measured differences, Harvey balls for bounded ordinal assessments, 1–5 scores for anchored ratings, and checks/crosses for a defined feasibility or confirmation test. Keep enough adjacent evidence to explain the assessment. Do not manufacture scores, erase caveats, or treat unavailable evidence as failure.

Distinguish rating from rank. A 1–5 rating applies the same anchored rubric to every item; a rank orders a declared comparison set, with direction and ties stated. Render rank as an ordinary number, not as a maturity score or completion disc. Label analyst assessments as judgments and retain their criterion-level basis.

### Graded alignment and multi-ticks

Use repeated ticks only for a defined ordinal alignment scale, such as one/two/three ticks for limited/partial/full alignment. Define every level and its evidence test in a same-slide legend; more ticks mean a higher assessed level, not greater certainty or several binary approvals. Keep not assessed and non-applicable distinct from the lowest level. If ticks instead count met requirements, show the denominator and use the same requirement set for every row.

Do not overload a binary cell with repeated check characters. The current typed-table runtime supports `binary`, `harvey`, and `heatmap`, but has no multi-tick variant. Use an equivalent anchored Harvey/score encoding unless literal multi-ticks are requested; then extend the canonical indicator owner and test native rendering before use. Separate binary criteria may use separate check/cross columns when that exposes which requirements align better than a composite score.

### Completion spinner

Use the circular completion spinner only for a true share from `0%` to `100%`. The filled sector uses component-primary and the remainder uses the theme's neutral chart segment. Print the percentage or numerator and denominator beside the mark. A declared threshold may rebind the fill to positive, caution, or negative, but a spinner does not become a traffic light merely because its value is low.

Do not use the spinner for a qualitative confidence label, arbitrary maturity stage, or decorative status. When the number is the first read, print it and use a thin horizontal bar instead.

### Traffic-light cell

Use a traffic-light cell only when positive, caution, negative, or missing states have written triggers. Show a dot plus a text label such as `On track`, `Watch`, or `Off track`; colour never stands alone. The dot consumes the active theme's status palette, so a reference-derived deck may change the swatches without changing the state names.

A traffic-light table must include one visible legend on the same slide. The legend repeats every state used in the table and states the threshold or trigger. Do not rely on a legend from an earlier slide.

### Binary confirmation

Use a compact check for a defined positive state, a compact cross for a defined negative state, and a short horizontal mark for not assessed. The symbol-only `none` label display is the default because a repeated state word usually adds clutter. Use `labelDisplay: "state"` only when the audience may not recognize the symbols or when the cells are read outside the table context. The marker binds to `icon.small`, uses a hairline stroke, and stays close to the compact body-text scale.

The symbol is the primary non-colour cue; colour may reinforce it through the existing positive and negative theme roles. Never leave a missing state blank. Define the confirmation test in the column heading, a concise same-slide note, or accessible metadata, and do not use a check merely to signal preference.

### One-to-five heatmap cell

Use a one-to-five heatmap only when the domain has named anchors and a reproducible scoring rule. Print the score in every cell. The complete cell may receive the fill when this improves scanning; the number remains the non-colour cue.

Choose one palette for the complete table:

- `theme-sequential`: low to high intensity in component-primary. This is the default for completeness, evidence quality, maturity, or another one-direction score.
- `red-white-green`: negative through neutral to positive. Use only when the midpoint is genuinely neutral and both directions have meaning.
- `red-white`: negative through neutral. Use when the red endpoint is an adverse condition and the white endpoint means no identified concern, not when white could be mistaken for missing data.

The legend is mandatory, sits on the same slide, uses the same palette, and names the anchors. Use `N/A` for non-applicable and `Not available` for unavailable evidence. Missing cells use the registered missing treatment and never inherit a score colour.

### Ordinal fill disc

Use the ordinal fill disc, sometimes called a Harvey ball, for a compact bounded rating whose anchors are explicitly defined. The standard domain is `0` through `4`, rendered as empty, quarter, half, three-quarter, and full. Print the score or named level beside the disc and provide one same-slide legend that defines the anchors. The filled sector uses component-primary and the track uses the neutral chart segment.

Do not use an ordinal disc for percentages, confidence, or measured completion. Use a spinner for a true `0%` to `100%` share. Use a heatmap for table-wide scanning. Use checks or crosses only for defined binary states.

## Theme contract

| Component | Consumed custom properties | Canonical source |
| --- | --- | --- |
| completion spinner | `--table-cell-completion-fill`, `--table-cell-completion-track`, `--table-cell-completion-size`, `--table-cell-completion-gap`, `--table-cell-completion-font` | [component bindings](../theming/component-bindings.md#evidence-components) |
| traffic-light and binary cell | `--table-cell-status-positive`, `--table-cell-status-caution`, `--table-cell-status-negative`, `--table-cell-status-missing`, `--table-cell-status-marker-size`, `--table-cell-status-gap`, `--table-cell-status-font`, `--table-cell-binary-line` | [component bindings](../theming/component-bindings.md#evidence-components) |
| heatmap cell | `--table-cell-heat-1` through `--table-cell-heat-5`, `--table-cell-heat-on-low`, `--table-cell-heat-on-high`, `--table-cell-heat-missing`, `--table-cell-heat-missing-color`, `--table-cell-heat-font`, `--table-cell-heat-min-size`, `--table-cell-heat-padding` | [component bindings](../theming/component-bindings.md#evidence-components) |
| ordinal fill disc | `--table-cell-rating-fill`, `--table-cell-rating-track`, `--table-cell-rating-size`, `--table-cell-rating-gap`, `--table-cell-rating-font` | [component bindings](../theming/component-bindings.md#evidence-components) |
| indicator legend | `--table-cell-legend-font`, `--table-cell-legend-color`, `--table-cell-legend-gap`, `--table-cell-legend-item-gap`, `--table-cell-legend-swatch-size`, `--table-cell-legend-rule` | [component bindings](../theming/component-bindings.md#evidence-components) |

## Construction details

Cells and their legend share one declared scale and palette. Completion values and ordinal ratings are content data. The runtime calculates sector geometry and registered heatmap swatches before creating native objects.

## Variants and states

- `completion` accepts a value from `0` to `100`. Its default palette is component-primary plus the neutral track. A semantic state may rebind the fill only when a written threshold exists.
- `traffic-light` accepts `positive`, `caution`, `negative`, or `missing`. Every cell includes a visible label and every table includes a same-slide legend.
- `binary` accepts `positive`, `negative`, or `missing`. `labelDisplay: "none"` is the compact default and centers the check, cross, or missing mark in the cell. `labelDisplay: "state"` places the registered state wording beside the same mark. Both variants retain a written confirmation test in the table contract.
- `heatmap` accepts scores `1` through `5` and `missing`. A different bounded domain is allowed only when the score labels, scale anchors, and legend are changed together.
- `ordinal-disc` accepts ratings `0` through `4` and `missing`. Every disc prints a score or named level and the table includes one same-slide legend defining the anchors.
- `theme-sequential`, `red-white-green`, and `red-white` are the registered heatmap palettes. Palette names describe the scale construction, while the actual swatches resolve through the active theme.

## Native translation

Build completion and ordinal discs as one editable neutral circle plus one editable filled sector, with the value or level in a separate text box. Build traffic lights as editable circles and adjacent text. Build binary confirmation from two editable hairline strokes for a check or cross and one for the missing mark. Add the adjacent state text only for the labelled variant. Build a heatmap as editable table-cell fills plus editable centered values. Resolve every fill and text colour from the active theme before creating the native objects.

Group each legend with its table, not with page furniture. Preserve the legend in PowerPoint and Google Slides as editable shapes and text. Keep the table's accessible description, cell labels, and legend wording in speaker notes or object metadata when the platform cannot retain those relationships.

## Acceptance check

- Every spinner maps to a declared `0%` to `100%` quantity and prints the value.
- Every traffic-light state has a written trigger, a visible text label, and a same-slide legend.
- Every binary state has a written confirmation test and an explicit compact symbol; the labelled variant also shows the registered state text. Blanks are never interpreted as negative.
- Every heatmap has named scale anchors, a printed value in each cell, and a same-slide legend using the exact same palette.
- Every ordinal disc maps to a declared bounded scale, prints a score or named level, and has a same-slide legend; it never represents a percentage or probabilistic confidence.
- `red-white-green` has a real neutral midpoint; `red-white` does not use white for missing data.
- Missing and non-applicable values are explicit and never scored as zero.
- Peer marks use one construction, palette, size, and threshold contract.
- The table remains readable without colour, and the final rendered legend is large enough to read.
