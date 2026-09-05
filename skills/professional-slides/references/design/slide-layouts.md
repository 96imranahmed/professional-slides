# Slide layouts

The open [composition model](../composition/index.md) owns page geometry. Layout is a nested tree of row flow, column flow, grid, overlay, absolute positioning, section, and component nodes. It is selected after the content items and their relationships are known.

## Layout-specific constraints

The [composition selection router](../composition/index.md#selection) and [`runtime/planner.mjs`](../../runtime/planner.mjs) own the deterministic layout decision. This design owner adds only visual constraints: keep one dominant exhibit uninterrupted, do not use repeated cells to disguise unrelated claims, and use the quietest section boundary that makes a real grouping legible. An explicit source-design, reading-order, or density exception records its reason in the slide plan.

## Sizing

The [composition owner](../composition/index.md#primitives) defines sizing modes and the adapter boundary. Design assigns relative visual weight and protects readable measures; it does not create another sizing algorithm.

## Boundaries

Region width communicates rhetorical weight. Equal tracks imply peer importance; a narrow track implies support. Surface change is stronger than a rule, and a rule is stronger than whitespace. Use the quietest boundary that makes the relationship clear.

Two peer charts may use one quiet vertical divider centered in their gutter when whitespace alone does not preserve the panel boundary. Omit it when alignment and spacing already make the comparison clear. Do not use an inter-chart divider for three-panel small multiples or as a decorative extension of chart-title rules.

A child is not a miniature slide. Do not give it another action title, footer, page number, or source system. Optional section headings must name substantive groups rather than generic roles.

## Shared anchors

Action title, source, footer, page number, and navigation are registered components. The standard planner shell allocates these once and passes the remaining body frame to the composition tree. A custom cover or section divider can use an absolute tree, but still consumes the same theme and component registry.

## Full half-section layout

Use `section-split-50-50` when one half frames a question, title or content area and the other half develops directly related examples, criteria or evidence. It requires exactly two populated nested sections, gives both halves equal page-level weight, removes the central gutter, and uses full-bleed square section surfaces. The first half defaults to open and the second to a light muted surface; either treatment may be changed when the source design or reading order requires it. Reverse the item order to move the framing half to the right.

This is a full half-page composition, not two detached cards. Keep one framing statement on the context side and one coherent list or exhibit on the detail side. Use matched top and bottom page rules only when they belong to the deck-wide page template. Split unrelated examples into separate slides rather than using the second half as a miscellaneous container.

## Repeated slide-template sequences

Use a repeated slide template when consecutive pages enumerate comparable use cases, options, markets, workstreams or checklist sections through the same visual grammar. Define the complete base slide once, then instantiate it with `instantiateSlideTemplate`. Each instance may change the action title, furniture values and content props for declared item IDs. It may not change layout, frames, component IDs, components, variants, density or page treatment.

The compiler requires at least two contiguous instances, validates natural sequence indices and a shared total, and records one structural hash across the sequence. A sequence that disappears and later resumes, changes a component variant, or moves a content region is rejected. This makes slide 1 of 3, 2 of 3 and 3 of 3 a genuine template family rather than three approximately similar pages.

Grid templates work well for use-case enumeration. Give each grid region one stable analytical job, such as context, objective, scope, evidence and outcomes. A region may contain prose, a list, a table or a chart, but comparable instances keep the same component in that region. Vary the evidence, not the page grammar. If one use case needs materially different evidence or more space, split it from the template sequence and explain the transition.

## Morphing

To change a layout, preserve component IDs, content jobs, title, source, and semantic relationships. Change only the composition tree or size constraints. Recompile, render HTML and PowerPoint, and compare both exact outputs. If the change alters the claim or removes necessary proof, it is a content-plan change rather than a layout morph.

## Acceptance

- Every item fits inside its resolved frame.
- Reading order follows tree order unless an explicit overlay requires controlled stacking.
- Repeated components use the same tokens and internal geometry.
- No blank region, heading, label, box, or connector exists only to complete a silhouette.
- Nested sections can be added, removed, or rearranged without changing the runtime schema.
- HTML and the exact saved PPTX pass the component-runtime parity gate.
