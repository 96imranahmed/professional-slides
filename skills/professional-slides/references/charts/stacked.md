# Stacked Bars and Areas

## Best for

Composition across categories or time, contribution to a total, and share shifts with a stable category set.

Use [percentage segments by user group](percentage-segment-by-group.md) for survey response distributions compared across respondent groups; that subtype owns the five-row cap, `Category A` ordering, calculated `Other`, segment emphasis, and adjacent insight extraction.

## Guidance note

- Use when the audience must understand both a total and the contribution or share of its stable segments.
- Why: the common baseline preserves the total while repeated segment order exposes composition change.
- Action title: state the total or mix shift and identify the segment that drives the relevant change.

## Data contract

Each stack must reconcile to its total. Every series must contain exactly one finite value per category. Declare absolute versus percentage mode, segment order, treatment of negative values, and the threshold for any grouped `Other` category.

## Total and secondary labels

For nonnegative stacked bars or columns, use `stackTotals: [{category, value}]` to attach an authoritative total to each named stack. Values must reconcile to the plotted components. An independently rounded source total may declare `roundingTolerance` plus a nonempty `roundingReason`; the label preserves the reported value while its attachment remains at the actual component sum. Do not silently recompute an authoritative label. Signed stacks remain supported by the core encoding, but these total attachments reject them until the intended positive, negative or net endpoint is explicit.

Use `secondaryLabels: [{category, series, value, unit, valueFormat}]` for another source measure attached to a segment, or replace `series` with `anchor: "stack-total"` to attach it to a declared total. For example, percentages can retain their independently sourced worker counts. Each secondary value prints with its own unit on the next line; it is not inferred from rounded percentages. Use the shared numeric `valueFormat` instead of arbitrary `formattedValue` copy.

Labels use the shared body role and measured geometry. Total labels reserve space beyond the plot; internal labels must fit their segment. A small column segment may use a short native leader and external label within its category lane; retain the true mark size. A crowded lane or stacked-bar segment rejects rather than shrinking text or discarding a required count. Enlarge or recompose the exhibit before export. Keep total and segment units, source precision and all attachment keys in the dot-dash.

## Construction

- Use 100% stacking for share and absolute stacking for magnitude.
- For signed absolute data, accumulate positive and negative segments independently from zero. Never place a negative segment on top of a positive cumulative total.
- Put the most important or stable segment on the baseline.
- Keep segment order constant across stacks.
- Use no more than five segments and disclose the rule for `Other`; exceed five only when labels pass the shared [direct-label gate](index.md#direct-label-gate) and the comparison does not require middle-segment precision.
- Add total labels when both magnitude and mix matter.
- Prefer bars to areas when exact category comparison matters.
- Use direct segment labels only when they pass the shared [direct-label gate](index.md#direct-label-gate).

Use the shared [chart legend](../components/chart-legends.md) whenever segment identity is not printed unambiguously inside every stack. The ordinary multi-series stacked-bar and stacked-column treatment may place one horizontal legend row at the top right of the chart field; it does not require a narrative rail. Use the shared [change and highlight grammar](../components/chart-callouts.md#shared-highlight-and-change-grammar) for forecast bands, endpoint change, focal spans, and segment emphasis.

When a narrative category rail explains the stack, bind each rail item and its corresponding segment to the same declared series key and colour index. Never recolour the right-hand stack independently. Bind the explanatory rail through alignment and matching series keys. Add a shared [implication arrow](../components/arrows.md) only at a selected deck-level emphasis point.

Keep the plot field blank by default. Add gridlines only when total or segment values cannot be read reliably from labels and baselines.

## Registered variants

### Absolute stacked bar or column

This is the core encoding. Segment lengths reconcile to an absolute total, the baseline segment is stable, and an optional total label sits outside the stack. Use when both total magnitude and contribution matter.

### Top-right legend

Use the standard absolute stack with `legend: true` when the segment names are not already direct-labelled. Keep the legend horizontal, above the plot, aligned to its top-right edge, and in the exact series order used by the stack.

### 100% stacked bar

Normalize every row to one shared 0% to 100% width when mix is the question and total magnitude is not. Keep segment order and legend order fixed. Use the specialized [percentage segments by user group](percentage-segment-by-group.md) when the rows are respondent groups and its selection, sorting, sample, and `Other` rules apply.

### Two-period mix shift

Use two stacks when the audience must compare a start and end state. Keep equal bar width, one segment order, and direct internal values where they fit. Add total labels above the stacks when magnitude also changes, segment-share labels outside when the mix change is material, and at most one shared start-to-end construction for the total. A repeated same-basis bracket may compare corresponding segments across several grouped stacks, but do not give every segment a different annotation.

### Cumulative stacked progression

Use chronological absolute stacks when both total growth and component contribution matter. Direct-label totals. Preserve one baseline, stack order, and column spacing. Optional connectors may trace the same segment boundary across adjacent periods. Keep them quiet and never imply interpolation across irregular time.

### Stacked chart with auxiliary metric rail

Use only when one compact metric per stack materially changes interpretation, such as margin beneath revenue mix. Align one [metric field](../components/metric-fields.md) to every stack center, keep a separate label and unit for the auxiliary measure, and preserve one metric grammar across all categories. The rail does not share the stack axis, does not replace source data, and should be removed when it merely repeats a segment or total.

## Construction details

Choose accessible text colour for each resolved segment fill and apply the shared [direct-label gate](index.md#direct-label-gate); retain a failed internal label through an eligible external label or the legend.

### State and annotation geometry

The cumulative and two-period variants reuse one segment order and one shared legend. Connector and endpoint geometry are calculated attachments, not new data series.

The adapter draws connector segments only through the gaps between peer columns, one line per stable boundary. It derives total and share labels independently so a change in magnitude never silently changes the stated mix.

## Platform mapping

Freeze series order and stack mode in the scene. Normalize percentage stacks before layout and suppress a narrow-segment label only through the declared label rule, never an application default.

## Failure modes

Comparing many middle segments, inconsistent series order, irregular time in an area chart, too many colors, narrow segments with unreadable labels, and totals that do not reconcile.

## Acceptance test

Each total or 100% stack reconciles after rounding, explicit bounds contain both stacks and zero, and the composition change supporting the title can be found without consulting a legend repeatedly.

Secondary-unit label text wraps at the measured segment width using the shared label role. If a small segment cannot contain its label vertically, the owner reserves an external column within every category lane and uses a common narrower mark width. Stack heights and values do not change. External labels pack without overlap; unsupported category density rejects. Category labels, grouping brackets and metric rails share the actual stack centers after an external-label gutter changes mark geometry. Rails may use the full category width for readable values, with measured separation from peers. Reserve their measured final row and a trailing theme gap rather than an extra empty row band.

When the chart heading explicitly names a shared secondary unit, use `secondaryLabelStyle: "parenthetical"` with `secondaryUnit` and matching per-record units: `9% (296k)`. This preserves two measures in one attached label without repeating the same unit on every segment. A missing heading decode or inconsistent unit rejects. The default `stacked` treatment retains explicit per-label units.

A column-family chart may declare `categoryGroups: [{id,label,categories}]` to preserve a source grouping such as highest- versus lowest-adoption regions. Each group spans at least two exact, contiguous, ordered categories; groups cannot overlap. The shared owner reserves a measured bracket-and-label band between category labels and any metric rail. The bracket encodes category membership, never change over time.
