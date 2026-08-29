# Professional Slides

`professional-slides` is a portable agent skill for building executive-grade,
answer-first consulting decks in PowerPoint and Google Slides. It packages the
reasoning, design system, slide archetypes, chart standards, cross-deck
components, and QA gates needed to produce decision-ready presentations with a
consistent visual grammar.

The project is designed for Codex and other `SKILL.md`-compatible coding agents,
including Claude Code. It is independent and is not affiliated with, endorsed
by, or derived from confidential materials belonging to McKinsey & Company.
"McKinsey-style" describes the familiar category of concise, evidence-led,
executive consulting communication.

## What is included

- Answer-first storylining and deck architecture
- Six extensible slide archetypes
- Six decision-oriented chart families
- Reusable titles, trackers, section rails, footers, sources, and appendix
  components
- PowerPoint and Google Slides implementation guidance
- A workflow for learning from user-supplied reference decks
- A machine-checkable deck blueprint and validation script
- Render-based visual and editorial QA gates

## Repository layout

```text
.
|-- SKILL.md
|-- agents/openai.yaml
|-- references/
|   |-- design-foundations.md
|   |-- slide-types/
|   |   |-- index.md
|   |   `-- <one file per slide type>
|   |-- charts/
|   |   |-- index.md
|   |   `-- <one file per chart family>
|   |-- components.md
|   |-- template-intake.md
|   |-- powerpoint/
|   |   |-- index.md
|   |   |-- artifact-tool.md
|   |   |-- office-js-and-graph.md
|   |   `-- rendering.md
|   |-- google-slides/
|   |   |-- index.md
|   |   |-- api-integration.md
|   |   `-- rendering.md
|   |-- quality-assurance.md
|   |-- deck-blueprint.schema.json
|   `-- theming/
|       |-- index.md
|       |-- theme-system.md
|       |-- reference-derived-patterns.md
|       |-- theme-spec.schema.json
|       |-- theme-spec.example.json
|       `-- source-manifest.json
|-- examples/deck-blueprint.example.json
|-- evals/
|   |-- EVALS.md
|   |-- cases.json
|   |-- rubric.md
|   |-- evaluator-prompt.md
|   |-- result.schema.json
|   `-- run_evals.py
|-- scripts/
|   |-- validate_blueprint.py
|   |-- validate_theme.py
|   `-- inventory_pptx.py
`-- tests/
    |-- test_validate_blueprint.py
    `-- test_run_evals.py
```

## Use

Install or clone this directory into the skill location used by your agent,
then invoke `$professional-slides` with the deck brief, audience, desired
decision, data, source material, output format, and any reference deck.

Reference decks are intentionally not committed. The two approved source decks
used for this scaffold were inventoried by hash and package structure in
`references/theming/source-manifest.json`; only generalized, reusable design
observations are retained. For future sources, follow the inventory workflow in
`references/template-intake.md` and encode only rules and assets the user is
authorized to reuse.

Validate the skill package and example blueprint with:

```bash
python /path/to/skill-creator/scripts/quick_validate.py .
python scripts/validate_blueprint.py examples/deck-blueprint.example.json
python scripts/validate_theme.py references/theming/theme-spec.example.json
python evals/run_evals.py --check
python -m unittest discover -s tests
```
