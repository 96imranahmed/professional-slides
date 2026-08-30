# Skill Pack Overview

`SKILL.md` is the base entrypoint and router. Everything below `references/`
belongs to a named subsystem; the references root intentionally contains no
loose files. Read this overview when changing the package structure or deciding
where new guidance belongs.

## Organization

| Subsystem | Responsibility | Extension rule |
| --- | --- | --- |
| [`overview/`](index.md) | Package organization and the machine-readable [deck blueprint contract](deck-blueprint.schema.json) | Keep only pack-level routing and orchestration contracts here |
| [`theming/`](../theming/index.md) | Design foundations, template intake, theme tokens, source-derived visual patterns, masters/layout behavior, and cross-platform fallbacks | Keep source-to-theme decisions together; do not duplicate them in slide archetypes or platform adapters |
| [`slide-types/`](../slide-types/index.md) | Slide archetype selection and one compositional contract per archetype | Add one file per genuinely distinct narrative job and route it from the index |
| [`charts/`](../charts/index.md) | Chart selection, semantics, data contracts, and one file per chart family | Add one file per analytical comparison family and route it from the index |
| [`components/`](../components/index.md) | Cross-deck title blocks, trackers, dividers, footers, sources, tables, and appendix furniture | Keep recurring deck-wide elements together; do not duplicate them inside slide types |

Platform implementation does not belong under `references/`. PowerPoint and
Google Slides adapters live under `tools/powerpoint/` and
`tools/google-slides/`, respectively. Evaluation cases, rubric, result schema,
runner, and [delivery QA](../../evals/quality-assurance.md) live under `evals/`.
Deterministic validators and inventory helpers live under `scripts/`.

## Placement rules

1. Keep `SKILL.md` concise: shared purpose, essential workflow, and links only.
2. Do not add loose files directly under `references/`; create or reuse the
   narrowest subsystem directory.
3. Every multi-file reference subsystem has an `index.md` that explains when its files
   should be read.
4. Slide types and charts use one file per supported type plus one universal
   index; do not build a monolithic catalog.
5. Keep theming independent from archetypes and adapters so one theme can be
   applied consistently to both PowerPoint and Google Slides.
6. Keep platform-neutral semantics in `references/` and host/API mechanics in
   `tools/`.
7. Link every new resource from `SKILL.md`, this overview, or the owning
   subsystem index so progressive disclosure remains navigable.
