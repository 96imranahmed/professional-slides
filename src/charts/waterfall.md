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

## Structural HTML reference

```html
<figure class="waterfall" data-role="chart-field"><div class="waterfall__plot"><div class="wf-col wf-col--total" style="--bottom:0%;--height:56%"><b>100</b><span>Opening</span></div><div class="wf-col wf-col--positive" style="--bottom:56%;--height:18%"><b>+32</b><span>Volume</span></div><div class="wf-col wf-col--negative" style="--bottom:42%;--height:14%"><b>-25</b><span>Price</span></div><div class="wf-col wf-col--total" style="--bottom:0%;--height:60%"><b>107</b><span>Closing</span></div></div><figcaption>Opening plus contributions equals closing</figcaption></figure>
```

```css
.waterfall { margin: 0; display: grid; grid-template-rows: 1fr auto; gap: var(--space-2); }
.waterfall__plot { display: grid; grid-template-columns: repeat(4, 1fr); align-items: end; gap: var(--space-5); min-height: 420px; border-bottom: var(--rule-page); }
.wf-col { position: relative; bottom: var(--bottom); height: var(--height); min-height: 10px; background: var(--chart-segment); }
.wf-col--total { background: var(--page-guideline); }
.wf-col--positive { background: var(--positive); }
.wf-col--negative { background: var(--negative); }
.wf-col b { position: absolute; bottom: calc(100% + var(--space-1)); width: 100%; text-align: center; font: var(--type-chart-label); }
.wf-col span { position: absolute; top: calc(100% + var(--space-2)); width: 100%; text-align: center; font: var(--type-label); }
.waterfall figcaption { font: var(--type-label); color: var(--text-secondary); }
```

The specimen omits connector lines for brevity; production waterfalls add one quiet connector between adjacent contribution endpoints and use positive or negative only because sign is the encoded semantic state.

## Platform mapping

Use a native waterfall only if subtotal flags, connector behavior, colors, and labels are controllable and survive export. Otherwise build editable columns and connectors from primitives. In either route, run an independent arithmetic reconciliation against the final labels.

## Failure modes

Non-reconciling bridges, mixed percentage-point and absolute contributions, hidden residuals, inconsistent sign conventions, and labels that imply rounded values sum when they do not.

## Acceptance test

Opening plus all contributions equals closing under the documented rounding rule, and the largest driver supporting the title is visually dominant.
