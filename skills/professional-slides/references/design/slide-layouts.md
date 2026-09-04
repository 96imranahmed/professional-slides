# Slide layouts

The open [composition model](../composition/index.md) owns page geometry. Layout is a nested tree of row flow, column flow, grid, overlay, absolute positioning, section, and component nodes. It is selected after the content items and their relationships are known.

## Layout-specific constraints

The [composition selection router](../composition/index.md#selection) and [`runtime/planner.mjs`](../../runtime/planner.mjs) own the deterministic layout decision. This design owner adds only visual constraints: keep one dominant exhibit uninterrupted, do not use repeated cells to disguise unrelated claims, and use the quietest section boundary that makes a real grouping legible. An explicit source-design, reading-order, or density exception records its reason in the slide plan.

## Sizing

The [composition owner](../composition/index.md#primitives) defines sizing modes and the adapter boundary. Design assigns relative visual weight and protects readable measures; it does not create another sizing algorithm.

## Boundaries

Region width communicates rhetorical weight. Equal tracks imply peer importance; a narrow track implies support. Surface change is stronger than a rule, and a rule is stronger than whitespace. Use the quietest boundary that makes the relationship clear.

A child is not a miniature slide. Do not give it another action title, footer, page number, or source system. Optional section headings must name substantive groups rather than generic roles.

## Shared anchors

Action title, source, footer, page number, and navigation are registered components. The standard planner shell allocates these once and passes the remaining body frame to the composition tree. A custom cover or section divider can use an absolute tree, but still consumes the same theme and component registry.

## Morphing

To change a layout, preserve component IDs, content jobs, title, source, and semantic relationships. Change only the composition tree or size constraints. Recompile, render HTML and PowerPoint, and compare both exact outputs. If the change alters the claim or removes necessary proof, it is a content-plan change rather than a layout morph.

## Acceptance

- Every item fits inside its resolved frame.
- Reading order follows tree order unless an explicit overlay requires controlled stacking.
- Repeated components use the same tokens and internal geometry.
- No blank region, heading, label, box, or connector exists only to complete a silhouette.
- Nested sections can be added, removed, or rearranged without changing the runtime schema.
- HTML and the exact saved PPTX pass the component-runtime parity gate.
