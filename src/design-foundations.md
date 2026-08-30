# Design Foundations

This file owns platform-neutral visual composition. Argument structure and
wording belong in [`storylining/`](storylining/index.md), visual tokens in
[`theming/`](theming/index.md), recurring furniture in
[`components.md`](components.md), and delivery checks in
[`evals/`](../evals/quality-assurance.md).

Explicit user direction and an approved reference deck override these defaults.

## Choose the exhibit and archetype

Choose the composition from the slide's narrative job using the
[slide-type router](slide-types/index.md). Use:

- a chart for magnitude, trend, composition, change, or relationship;
- a table for exact lookup or multi-criteria comparison;
- a process for ordered actions, stages, or decisions;
- a tree for decomposition or causality;
- a map only when geography changes the conclusion;
- quotations only when stakeholder voice is evidence.

Select quantitative encodings through the [chart router](charts/index.md).
Do not turn a straightforward list into a decorative diagram or add an exhibit
that merely repeats the title.

## Establish hierarchy

Create one obvious first read, one clear second read, and quiet supporting
detail. Build hierarchy in this order:

1. position and scale;
2. whitespace and grouping;
3. typography weight;
4. color emphasis;
5. rules, fills, or enclosures.

The action title and dominant exhibit should form one vertical argument. Keep
annotations close to the evidence they explain and secondary metadata within
the component safe zones.

## Control density

Use one dominant visual rather than a dashboard of cards. Keep live-presentation
pages sparse, allow more evidence in executive pre-reads, and reserve dense
methods or lookup material for the appendix. Change the composition, split the
slide, or shorten copy before shrinking type.

Limit indentation to two levels. Keep bullet, column, and label grammar
parallel. Move paragraphs, production detail, and extended methodology to notes
or the appendix.

## Align and group

Use a small set of shared horizontal and vertical anchors. Align related
objects, maintain consistent internal padding, and use proximity before boxes
or divider lines to express grouping. Preserve clear separation between the
title, analytical canvas, and footer/source zones.

Vary silhouettes when the narrative job changes, while keeping the underlying
grid, title zone, and recurring components stable across the deck.

## Preserve restraint and editability

Default to flat, editable shapes and restrained color. Avoid pseudo-UI cards,
3D effects, gradients without meaning, ornamental icons, decorative photos,
and diagrams that do not improve comprehension.

Keep text, charts, tables, and simple diagrams editable when the target
platform can preserve them reliably. Use raster fallbacks only when fidelity
requires them and the user accepts the editability tradeoff.
