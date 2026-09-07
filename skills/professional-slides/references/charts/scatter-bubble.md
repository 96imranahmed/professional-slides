# Scatter and Bubble Charts

## Best for

Relationships between two measures, segmentation, prioritization, and a third magnitude encoded by bubble area.

## Guidance note

- Use when relationships, clusters, or outliers across two measures matter; use bubble area only for a necessary third quantitative measure.
- Why: position reveals association and separation without implying causality, while area adds scale.
- Action title: state the observed relationship, cluster, or outlier and explain its decision relevance.

## Data contract

One observation per point, x and y measures with units, optional size measure, stable observation IDs, missing-value policy, and documented thresholds for any quadrants. Record transformations and the basis of any fitted line.

## Construction

- Label axes with units and direction of desirability where relevant.
- Encode magnitude by bubble area, not diameter.
- Add quadrant lines only when thresholds are meaningful.
- Label highlighted points and provide a key or appendix for the rest.
- Use transparency or disclosed jitter only to reveal overlap.
- Add a trend line only when the data type and sample support the named fitting method; report its basis or diagnostic and otherwise omit the line.
- Use association language unless the analysis supports causality.
- Use logos admitted by the [asset authorization record](../components/icons-and-logos.md#asset-authorization-record) inside points when entity recognition materially improves a market map or competitor landscape. Preserve the analytical position and bubble area; the logo does not become the mark's size encoding.
- Give every logo equal clear-space rules and a neutral backing when needed. Fall back to a short text label when the logo is absent from that record.
- When all bubbles are equal size, state that position alone is the encoding. Do not vary diameter decoratively.
- Put multi-series marker legends in one horizontal row at the plot's top right. When bubble area carries a third measure, optionally append one neutral light-gray circle labelled with the size meaning; omit it when the size is already self-evident or directly labelled.

Apply the shared [direct-label gate](index.md#direct-label-gate) to point labels. Use the shared [chart legend](../components/chart-legends.md) for category, scenario, marker, or highlight semantics that are not directly labelled. Use the shared [chart callout grammar](../components/chart-callouts.md) for thresholds, outliers, focal regions, and evidence leaders.

## Registered variants

### Labelled scatter

This is the core encoding. Position encodes x and y, marker area is constant, and decisive observations are directly labelled. Use when the relationship and outliers matter more than density.

### Quadrant or segmented scatter

Add vertical and horizontal thresholds only when both cut points have a documented decision basis. Label each region with the implication of being there, not merely `high` or `low`. Choose one theme-bound treatment: `threshold-lines` for the lightest segmentation, `alternating-tint` for two opposed neutral regions, or `focus-tint` for one decision-critical quadrant. Keep points and labels above every region fill.

### Bubble scatter

Add a third magnitude through marker area. Declare the size measure and legend, calculate area rather than diameter, and keep minimum and maximum bubbles legible without occluding decisive peers.

The executable owner accepts `sizeLegend: { label, markerSize }`. The marker is a neutral light-gray circle with a quiet rule, while coloured circles continue to identify series. `markerSize` is an optional visual key size from 8 to 20 pixels; it does not rescale the data bubbles.

### Executable quadrant contract

Use `quadrants: { x, y, style, titles, focus }`. Both thresholds must sit strictly inside the declared x and y bounds. `titles` may name `topLeft`, `topRight`, `bottomLeft`, and `bottomRight`; omitted titles collapse. `focus` is required only to override the default top-right focus for `focus-tint`. Unsupported styles, title keys, or out-of-range thresholds fail before export. Point names must be unique, series identity is either present on every point or on none, and all coordinates must fit the declared bounds.

### Concentric distance bands

Use nested radial bands only when distance from one declared origin or ideal point is itself a valid calculated measure. Normalize x and y before calculating distance when their units or ranges differ, disclose the distance function and band thresholds, and label the direction of better or worse performance. The bands are one background segmentation layer, not another series. Do not use concentric bands merely to decorate a competitor map or imply equal tradeoffs between unrelated dimensions.

### Scatter with attached synthesis

Keep the scatter chart itself unchanged. When the plotted relationship remains understandable and one separate consequence is needed, compose a weighted row with the registered insight box or use evidence-attached leaders. When several prose bullets are required to explain the mechanism, give the prose its own content job and relative weight rather than naming a new scatter variant.

### Linked assessment map

When a parameter list or table uses stable IDs that map to points in the scatter, preserve those IDs, colours, and labels in both regions. `Assessment overview` is content, not a chart type or layout instruction.

## Attached synthesis

The attached synthesis is a slide-layout choice around the core labelled scatter, not another chart encoding.

Keep the business topic separate from the chart encoding and page geometry. Use one implication or a compact proof chain in the attached section; a longer argument becomes additional registered items in the open composition tree or a separate slide.

## Logo-bubble structural reference

Use the registered labelled-scatter geometry and follow the [entity-logo contract](../components/icons-and-logos.md#entity-logos). When a third measure controls size, replace each fixed point with one native circle whose area is bound to that measure, fit the admitted logo inside the same circular bounds with equal clear space, and retain the entity text as an external direct label and fallback. Bind peer bubbles to the chart's neutral or base series role and use the declared highlight only for the entity named as exceptional in the title or annotation.

## Platform mapping

Normalize bubble size to area before layout when a target API accepts diameter or radius. Preserve observation-to-label mapping through sorting and filtering. Render quadrant fills first, then threshold lines, axes, points, and labels. Keep the optional size key inside the shared top-right marker legend rather than creating a second floating legend.

## Failure modes

Reject decorative bubble sizes, unauthorized or distorted logos, logos that replace area encoding, unlabeled decisive outliers, arbitrary quadrants, multiple competing quadrant treatments, occluded points, unsupported causal claims, or platform-specific sizing. Bubble data controls area through a bounded square-root scale; labels clamp to the plot frame rather than the outer chart frame.

## Acceptance test

Verify the relationship and outliers remain clear when logos become text labels. Every label maps to the correct observation. Every bubble area and position reconciles to the declared measures. When present, the size legend is neutral, named, and top-right; quadrant titles remain readable without becoming a substitute for the action title.


For dense point sets, use `dataLabels: false` to suppress all point labels or `showLabel: false` on individual points; retain each point’s stable name for data identity and annotations. Use `colorIndices` to preserve the deck’s series mapping in both marks and legends. Do not force labels onto every observation when they hide the distribution.


Centre an x-axis title on the actual plot bounds, excluding the y-label gutter and any side rail. Keep correlation coefficients and sample definitions in the linked analysis or notes unless they change the visible argument. A side table that merely lists calculations fails the insight test; use the supported consequence of the relationship instead, and distinguish related measures from independent evidence.
