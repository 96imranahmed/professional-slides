# Source Guide

This index describes the content under `src/`. Each concept has one owner so the guidance remains mutually exclusive and collectively exhaustive (MECE).

## Ownership

- [`templates/`](templates/index.md) owns deck-type decision architecture, default question trees, chapter spines, tracker contracts, and type-specific completeness tests.
- [`storylining/`](storylining/index.md) owns the problem hypothesis tree, governing thought, dot-dash, chapter sequence, storyboard, action-title spine, and narrative QA.
- [`design/`](design/index.md) owns composition, hierarchy, visual tokens, theme modes, reference intake, and cross-platform design fallbacks.
- [`slide-types/`](slide-types/index.md) owns the narrative contract for each supported slide archetype.
- [`charts/`](charts/index.md) owns quantitative encodings and chart-specific construction rules.
- [`components/`](components/index.md) owns slide copy, text containers, line and section treatments, and recurring deck furniture such as titles, navigation, footers, sources, and appendix behavior.
- [`tools/`](tools/index.md) owns PowerPoint and Google Slides implementation and rendering mechanics.

Evaluation and release evidence live outside this document section under `evals/`.

## Reading order

### For a new or materially revised deck

1. Classify the deck by the audience's primary decision. When a named deck type applies, read [`templates/`](templates/index.md) and only the selected template; otherwise continue without forcing a template.
2. Read storylining and construct the problem hypothesis tree, governing thought, mapped slide-by-slide dot-dash, chapter sequence, action-title spine, and tracker map. Do not create a slide document until the complete dot-dash passes narrative QA and receives the explicit owner approval required by its approval gate.
3. Once the dot-dash passes storylining QA, read design and outline the deck-wide design system. Consult components to identify techniques or recurring structures that may affect pagination or cause additional slides to be added, such as section dividers, tracker transitions, sequential "revealed" slides for clarity of communication, or content that must be split to maintain readable spacing (e.g., 1/2, 2/2).
4. Only then consult the relevant slide types and, when applicable, the associated chart guidance. Choose the archetype and encoding that best prove each action title; do not force the story into a preferred template.
5. Compile the detailed deck design, including the slide sequence, slide family, content hierarchy, alignment guides, component states, sources, and platform fallbacks for every page.
6. Consult the target-platform tools to understand how to build, render, validate, and deliver the deck in PowerPoint, Google Slides, or both.

### For modifications to an existing deck

1. Inspect the complete existing deck before editing: read the action-title spine, render all pages, identify the active master and layouts, inventory recurring components, and distinguish deliberate exceptions from broken consistency.
2. Classify the change as narrative, design-system, slide-type, chart, component, or platform-specific work, then read only the owners required for that scope. Read adjacent owners when the modification changes page count, chapter order, tracker state, source treatment, or cross-platform behavior.
3. Preserve the existing deck's approved visual system and closest valid layout unless the request explicitly authorizes a redesign. Reuse established anchors, guides, spacing, component states, chart grammar, and page rhythm rather than introducing a parallel convention.
4. Update the hypothesis tree, dot-dash, and action-title spine when the change alters the argument, slide order, or evidence. Recompute chapter boundaries, page numbers, trackers, cross-references, appendix references, and transitions after slides are added, removed, or reordered.
5. Repair any resulting incompleteness, including orphaned titles, repeated claims, missing evidence, broken alignment, inconsistent component states, stale sources, clipped objects, empty placeholders, or platform-conversion defects.
6. Render and inspect the entire affected deck, not only the edited pages. A local change is complete only when surrounding slides, the title spine, the montage, and the requested final platform remain coherent.

#### Targeted-change consistency protocol

Classify the requested change by owner, inspect every analogous instance, and distinguish a broken instance from a broken shared definition before editing.

Repair the owning definition when the behavior should be shared. Create a named variant only for a real semantic difference, and state its applicability in the owner's file rather than documenting it here.

After a targeted change, inspect adjacent pages, analogous instances, shared component state, and the complete render through the relevant owners. Do not call the change complete if it introduces a one-off convention or makes the deck less coherent.

For a narrow repair, read this index and only the owner of the affected behavior. Expand the scope only when direct inspection shows the defect propagates into another owner or another slide.

## Alignment and layout routing

Alignment crosses subsystems, but its rules remain singly owned. Read the owner that governs the object instead of creating a second alignment convention in this guide.

- [`design/`](design/index.md) defines the canvas, grid, typography, spacing tokens, page zones, guide hierarchy, image and icon treatment, and platform-neutral visual tolerances.
- [`components/`](components/index.md) routes text-box geometry, copy, section treatments, action panels, callouts, trackers, sources, footers, sequential-reveal states, component padding, and internal component alignment.
- [`slide-types/`](slide-types/index.md) defines alignment for diagrams, processes, decompositions, and archetype-specific compositions.
- [`charts/`](charts/index.md) defines plot-area, axis, legend, annotation, and table alignment.
- [`tools/`](tools/index.md) defines named geometry constants, unit conversion, rounding, API operations, master/layout implementation, readback, and rendered verification for PowerPoint and Google Slides.

## Anti-slop principles

Apply one deletion test to the complete deck: if removing a slide, sentence, or visual element does not weaken the argument, evidence, interpretation, decision, navigation, provenance, or delivery, remove it.

Reject work that uses volume, repetition, decoration, jargon, or production complexity to imitate substance. The subsystem owners below define the concrete tests; this index does not duplicate them.

Apply the standard through the relevant owner rather than restating its rules here:

| Anti-slop question | Owner |
| --- | --- |
| Does the deck start from a real audience decision, follow a necessary claim sequence, and omit redundant pages? | [`storylining`](storylining/index.md) |
| Does each sentence contribute, use direct language, and avoid repeated or formulaic AI copy? | [`components/copy`](components/copy.md) |
| Does hierarchy allocate space and emphasis according to meaning rather than template symmetry or decoration? | [`design`](design/index.md) |
| Does the chosen slide type or chart encode a real relationship without decorative geometry or fragmented evidence? | [`slide-types`](slide-types/index.md) and [`charts`](charts/index.md) |
| Does each recurring element have a necessary job, consistent state, and valid container behavior? | [`components`](components/index.md) |
| Does the delivered artifact survive native rendering and the complete release audit? | [`tools`](tools/index.md) and [`evals`](../evals/index.md) |

## Maintenance rule

Every directory under `src/` must contain an `index.md`. An index owns shared rules and routing for that directory; child files contain only type-specific or platform-specific detail. Update the owner instead of repeating a rule in a second subsystem.
