# Source Guide

This index routes the instructional content under `src/`. Each concept has one
owner so the guidance remains mutually exclusive and collectively complete.

## Ownership map

- [`storylining/`](storylining/index.md) owns the governing thought, argument
  structure, chapter sequence, storyboard, action-title spine, and narrative QA.
- [`design/`](design/index.md) owns composition, hierarchy, visual tokens,
  theme modes, reference intake, and cross-platform design fallbacks.
- [`slide-types/`](slide-types/index.md) owns the narrative contract for each
  supported slide archetype.
- [`charts/`](charts/index.md) owns quantitative encodings and chart-specific
  construction rules.
- [`components/`](components/index.md) owns recurring deck furniture such as
  titles, navigation, footers, sources, and appendix behavior.
- [`tools/`](tools/index.md) owns PowerPoint and Google Slides implementation and
  rendering mechanics.

Evaluation and release evidence live outside this document section under
`evals/`.

## Reading order

For a new or materially revised deck, read storylining and design, then route
only to the relevant slide types, charts, design mode, components, and
target-platform tools. For a narrow repair, read this index and only the owner
of the affected behavior.

## Maintenance rule

Every directory under `src/` must contain an `index.md`. An index owns shared
rules and routing for that directory; child files contain only type-specific or
platform-specific detail. Update the owner instead of repeating a rule in a
second subsystem.
