# Waterfall Charts

## Best for

Bridges from start to finish, including price-volume-mix, margin, cash, headcount, and variance drivers.

## Guidance note

- Use when an opening value must reconcile to a closing value through signed drivers.
- Why: the bridge makes every positive and negative contribution auditable.
- Action title: state the net movement and name the largest driver or offset.

## Data contract

Opening total, ordered positive and negative contributions, optional subtotals, closing total, one unit system, rounding rule, and a residual policy. The bridge must reconcile exactly before rendering.

## Construction

- Anchor opening, subtotal, and closing columns to zero.
- Use consistent semantics for positive, negative, and total columns.
- Order drivers causally, chronologically, or by contribution and state why.
- Label each contribution and the closing total.
- Keep connector lines quiet and consistent.
- Surface an unexplained residual rather than hiding it in `Other`.
- Keep the plot field blank. Waterfall connectors already provide the construction logic, so add gridlines only when intermediate scale lookup is necessary.

Apply the shared [direct-label gate](index.md#direct-label-gate). Use the shared [chart legend](../components/chart-legends.md) only when positive, negative, subtotal, total, actual, forecast, or scenario states remain ambiguous after eligible labels and consistent non-colour cues. Use the shared [chart callout](../components/chart-callouts.md) for one decisive driver, interval, or focal span rather than drawing a chart-specific annotation system.

## Registered variants

### Standard bridge

This is the core encoding: one opening total, ordered contributions, optional subtotals, and one closing total. It owns the arithmetic and connector geometry. When the net start-to-end movement is the decision point, add one shared construction above the bridge: a horizontal span, a start drop, an arrow to the closing endpoint, and one calculated label. Omit it when the opening, drivers, closing label, and action title already make the net movement obvious.

### Contribution bridge without an opening total

Use when each contribution starts from zero conceptually and accumulates to one final total, such as business-unit contributions to group profit. Begin the first contribution at zero, preserve running connectors, and label the closing total distinctly. Do not describe it as a start-to-finish change when no opening state exists.

### Bridge with subtotals

Use for grouped drivers whose intermediate reconciled totals matter. Anchor every subtotal to zero, label the group boundary, and limit the number of groups so the causal or chronological order remains legible.

### Bridge with auxiliary metric rail

Use when one compact category-level measure materially qualifies each contribution, such as margin beneath business-unit profit. Align one [metric field](../components/metric-fields.md) to every column center, label its separate unit once, and bind its selected or total state through the theme. The rail never participates in the waterfall arithmetic, never shares its axis, and should be omitted when it merely restates a contribution.

## Construction details

Add one quiet connector between adjacent contribution endpoints and use positive or negative only because sign is the encoded semantic state.

### State and annotation geometry

An auxiliary metric rail is a separate aligned component below the reconciled bridge.

Each rail entry must resolve to the exact plotted category ID after sorting or filtering. The adapter lays the rail on the same category centers as the waterfall columns, but validates its values, unit, and selected state independently from the bridge arithmetic.

## Platform mapping

Freeze opening, contribution, subtotal, and closing roles before layout, then reconcile the displayed labels independently against the bridge arithmetic.

## Failure modes

Non-reconciling bridges, mixed percentage-point and absolute contributions, hidden residuals, inconsistent sign conventions, and labels that imply rounded values sum when they do not.

## Acceptance test

Opening plus all contributions equals closing under the documented rounding rule, and the largest driver supporting the title is visually dominant.
