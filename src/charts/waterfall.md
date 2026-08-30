# Waterfall Charts

## Best for

Bridges from start to finish, including price-volume-mix, margin, cash, headcount, and variance drivers.

## Data contract

Opening total, ordered positive and negative contributions, optional subtotals, closing total, one unit system, rounding rule, and a residual policy. The bridge must reconcile exactly before rendering.

## Construction

- Anchor opening, subtotal, and closing columns to zero.
- Use consistent semantics for positive, negative, and total columns.
- Order drivers causally, chronologically, or by contribution and state why.
- Label each contribution and the closing total.
- Keep connector lines quiet and consistent.
- Surface an unexplained residual rather than hiding it in `Other`.

## Platform mapping

Use a native waterfall only if subtotal flags, connector behavior, colors, and labels are controllable and survive export. Otherwise build editable columns and connectors from primitives. In either route, run an independent arithmetic reconciliation against the final labels.

## Failure modes

Non-reconciling bridges, mixed percentage-point and absolute contributions, hidden residuals, inconsistent sign conventions, and labels that imply rounded values sum when they do not.

## Acceptance test

Opening plus all contributions equals closing under the documented rounding rule, and the largest driver supporting the title is visually dominant.
