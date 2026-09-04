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

Apply the shared [direct-label gate](index.md#direct-label-gate). Use the shared [chart legend](../components/chart-legends.md) only when positive, negative, subtotal, total, actual, forecast, or scenario states remain ambiguous after eligible labels and consistent non-colour cues. Use the shared [chart callout](../components/chart-callouts.md) for one decisive driver, interval, or focal span rather than drawing a chart-specific annotation system.

## Registered variants

### Standard bridge

This is the core encoding: one opening total, ordered contributions, optional subtotals, and one closing total. It owns the arithmetic and connector geometry.

### Contribution bridge without an opening total

Use when each contribution starts from zero conceptually and accumulates to one final total, such as business-unit contributions to group profit. Begin the first contribution at zero, preserve running connectors, and label the closing total distinctly. Do not describe it as a start-to-finish change when no opening state exists.

### Bridge with subtotals

Use for grouped drivers whose intermediate reconciled totals matter. Anchor every subtotal to zero, label the group boundary, and limit the number of groups so the causal or chronological order remains legible.

### Bridge with auxiliary metric rail

Use when one compact category-level measure materially qualifies each contribution, such as margin beneath business-unit profit. Align one [metric field](../components/metric-fields.md) to every column center, label its separate unit once, and bind its selected or total state through the theme. The rail never participates in the waterfall arithmetic, never shares its axis, and should be omitted when it merely restates a contribution.

## Structural HTML reference

```html
<figure class="waterfall" data-role="chart-field"><div class="waterfall__plot"><div class="wf-col wf-col--total" style="--bottom:0%;--height:56%"><b>100</b><span>Opening</span></div><div class="wf-col wf-col--positive" style="--bottom:56%;--height:18%"><b>+32</b><span>Volume</span></div><div class="wf-col wf-col--negative" style="--bottom:42%;--height:14%"><b>-25</b><span>Price</span></div><div class="wf-col wf-col--total" style="--bottom:0%;--height:60%"><b>107</b><span>Closing</span></div></div><figcaption>Annual recurring revenue, $m, UK enterprise segment, FY2025 to FY2026F; 100 + 32 - 25 = 107</figcaption></figure>
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

### Variant HTML slots

An auxiliary metric rail is a separate aligned component below the reconciled bridge:

```html
<figure class="waterfall" data-role="chart-field" data-variant="contribution-bridge-with-metric-rail">
  <ol class="waterfall__plot" data-opening="none" data-closing="200" aria-label="Business-unit contributions to total value">
    <li data-kind="contribution" data-value="120"><span>BU 1</span><b>120</b></li>
    <li data-kind="contribution" data-value="20"><span>BU 2</span><b>20</b></li>
    <li data-kind="contribution" data-value="60"><span>BU 3</span><b>60</b></li>
    <li data-kind="total" data-value="200"><span>Total</span><b>200</b></li>
  </ol>
  <div class="metric-rail" data-component="metric-field" aria-label="Profit margin by business unit">
    <span data-for="BU 1"><b>12%</b></span><span data-for="BU 2"><b>8%</b></span><span data-for="BU 3"><b>15%</b></span><span data-for="Total" data-state="selected"><b>13%</b></span>
  </div>
</figure>
```

`data-for` must resolve to the exact plotted category ID after sorting or filtering. The adapter lays the rail on the same category centers as the waterfall columns, but validates its values, unit, and selected state independently from the bridge arithmetic.

## Platform mapping

Freeze opening, contribution, subtotal, and closing roles before layout, then reconcile the displayed labels independently against the bridge arithmetic.

## Failure modes

Non-reconciling bridges, mixed percentage-point and absolute contributions, hidden residuals, inconsistent sign conventions, and labels that imply rounded values sum when they do not.

## Acceptance test

Opening plus all contributions equals closing under the documented rounding rule, and the largest driver supporting the title is visually dominant.
