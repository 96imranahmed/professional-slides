# Scatter and Bubble Charts

## Best for

Relationships between two measures, segmentation, prioritization, and a third magnitude encoded by bubble area.

## Data contract

One observation per point, x and y measures with units, optional size measure, stable observation IDs, missing-value policy, and documented thresholds for any quadrants. Record transformations and the basis of any fitted line.

## Construction

- Label axes with units and direction of desirability where relevant.
- Encode magnitude by bubble area, not diameter.
- Add quadrant lines only when thresholds are meaningful.
- Label highlighted points and provide a key or appendix for the rest.
- Use transparency or disclosed jitter only to reveal overlap.
- Add a trend line only with an appropriate method.
- Use association language unless the analysis supports causality.
- Use logos admitted by the [asset authorization record](../components/icons-and-logos.md#asset-authorization-record) inside points when entity recognition materially improves a market map or competitor landscape. Preserve the analytical position and bubble area; the logo does not become the mark's size encoding.
- Give every logo equal clear-space rules and a neutral backing when needed. Fall back to a short text label when the logo is absent from that record.
- When all bubbles are equal size, state that position alone is the encoding. Do not vary diameter decoratively.

Apply the shared [direct-label gate](index.md#direct-label-gate) to point labels. Use the shared [chart legend](../components/chart-legends.md) for category, scenario, marker, or highlight semantics that are not directly labelled. Use the shared [chart callout grammar](../components/chart-callouts.md) for thresholds, outliers, focal regions, and evidence leaders.

## Registered variants

### Labelled scatter

This is the core encoding. Position encodes x and y, marker area is constant, and decisive observations are directly labelled. Use when the relationship and outliers matter more than density.

### Quadrant or segmented scatter

Add vertical and horizontal thresholds only when both cut points have a documented decision basis. Label each region with the implication of being there, not merely `high` or `low`. Use one quiet background or edge treatment and keep points above every region fill.

### Bubble scatter

Add a third magnitude through marker area. Declare the size measure and legend, calculate area rather than diameter, and keep minimum and maximum bubbles legible without occluding decisive peers.

### Concentric distance bands

Use nested radial bands only when distance from one declared origin or ideal point is itself a valid calculated measure. Normalize x and y before calculating distance when their units or ranges differ, disclose the distance function and band thresholds, and label the direction of better or worse performance. The bands are one background segmentation layer, not another series. Do not use concentric bands merely to decorate a competitor map or imply equal tradeoffs between unrelated dimensions.

### Scatter with attached synthesis

Keep the scatter chart itself unchanged. When the plotted relationship remains understandable and one separate consequence is needed, compose a weighted row with the registered insight box or use evidence-attached leaders. When several prose bullets are required to explain the mechanism, give the prose its own content job and relative weight rather than naming a new scatter variant.

### Linked assessment map

When a parameter list or table uses stable IDs that map to points in the scatter, preserve those IDs, colours, and labels in both regions. `Assessment overview` is content, not a chart type or layout instruction.

## Structural HTML reference

```html
<figure class="chart-field scatter-plot" data-variant="concentric-distance-bands">
  <svg viewBox="0 0 900 500" role="img" aria-labelledby="scatter-title scatter-desc">
    <title id="scatter-title">Capability breadth and depth</title>
    <desc id="scatter-desc">Two peers and one highlighted company positioned on two normalized dimensions with three documented distance bands.</desc>
    <path class="scatter-plot__band scatter-plot__band--3" d="M70 430 A760 760 0 0 1 830 0 L830 430 Z"></path>
    <path class="scatter-plot__band scatter-plot__band--2" d="M260 430 A570 570 0 0 1 830 65 L830 430 Z"></path>
    <path class="scatter-plot__band scatter-plot__band--1" d="M450 430 A380 380 0 0 1 830 210 L830 430 Z"></path>
    <path class="scatter-plot__axis" d="M70 30 V430 H840"></path>
    <g class="scatter-plot__peer"><rect x="350" y="260" width="12" height="12"></rect><text x="370" y="272">Northstar</text></g>
    <g class="scatter-plot__peer"><rect x="530" y="180" width="12" height="12"></rect><text x="550" y="192">Beacon</text></g>
    <g class="scatter-plot__highlight"><rect x="720" y="320" width="14" height="14"></rect><text x="742" y="333">Atlas</text></g>
  </svg>
  <figcaption>Capability breadth and depth, 0 to 100 normalized index, selected UK enterprise vendors, FY2026; Euclidean distance bands at 20-point intervals</figcaption>
</figure>
```

```css
.chart-field {
  --chart-bg: var(--canvas);
  --chart-axis: var(--page-guideline);
  --chart-grid: var(--chart-gridline);
  --chart-label-font: var(--type-chart-label);
  --chart-label-color: var(--text-secondary);
  --chart-neutral: var(--chart-segment);
}
.scatter-plot { margin: 0; display: grid; grid-template-rows: 1fr auto; gap: var(--space-2); background: var(--chart-bg); }
.scatter-plot svg { inline-size: 100%; block-size: 100%; overflow: visible; }
.scatter-plot__axis { fill: none; stroke: var(--chart-axis); stroke-width: var(--line-standard); }
.scatter-plot__band--1 { fill: var(--surface-2); }
.scatter-plot__band--2 { fill: var(--surface-1); }
.scatter-plot__band--3 { fill: var(--chart-bg); }
.scatter-plot__peer rect { fill: var(--chart-neutral); }
.scatter-plot__highlight rect { fill: var(--chart-series-1); }
.scatter-plot text { fill: var(--chart-label-color); font: var(--chart-label-font); }
.scatter-plot figcaption { color: var(--chart-label-color); font: var(--chart-label-font); }
```

### Attached-synthesis HTML composition

The attached synthesis is a slide-layout choice around the core labelled scatter, not another chart encoding:

```html
<section class="slide-layout" data-layout="implication-split" data-content="competitor-positioning">
  <figure class="scatter-plot" data-role="evidence" data-variant="labelled-scatter">
    <svg role="img" aria-labelledby="position-title position-desc">
      <title id="position-title">Peer positions on breadth and depth</title>
      <desc id="position-desc">Seven directly labelled peers and one highlighted leader on two sourced dimensions.</desc>
      <g class="scatter-plot__peer" data-id="peer-a"><rect></rect><text>Peer A</text></g>
      <g class="scatter-plot__highlight" data-id="leader"><rect></rect><text>Leader</text></g>
    </svg>
  </figure>
  <aside class="insight-box" data-role="implication">
    <p>The leader is exceptional on both measures; the central cluster needs a different comparison basis.</p>
  </aside>
</section>
```

`data-content` names the business topic only. `data-variant` remains the chart encoding and `data-layout` remains page geometry. Use one implication or a compact proof chain in the attached section; a longer argument becomes additional registered items in the open composition tree or a separate slide.

## Logo-bubble structural reference

Start from the [labelled-scatter specimen](#structural-html-reference) and follow the [entity-logo contract](../components/icons-and-logos.md#entity-logos). When a third measure controls size, replace each fixed point with one native circle whose area is bound to that measure, fit the admitted logo inside the same circular bounds with equal clear space, and retain the entity text as an external direct label and fallback. Bind peer bubbles to the chart's neutral or base series role and use the declared highlight only for the entity named as exceptional in the title or annotation.

## Platform mapping

Normalize bubble size to area before layout when a target API accepts diameter or radius. Preserve observation-to-label mapping through sorting and filtering.

## Failure modes

Reject decorative bubble sizes, unauthorized or distorted logos, logos that replace area encoding, unlabeled decisive outliers, arbitrary quadrants, occluded points, unsupported causal claims, or platform-specific sizing.

## Acceptance test

Verify the relationship and outliers remain clear when logos become text labels. Every label maps to the correct observation. Every bubble area and position reconciles to the declared measures.
