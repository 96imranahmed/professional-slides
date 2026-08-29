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
|   |-- slide-archetypes.md
|   |-- charts.md
|   |-- components.md
|   |-- template-intake.md
|   |-- powerpoint.md
|   |-- google-slides.md
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
|-- scripts/
|   |-- validate_blueprint.py
|   |-- validate_theme.py
|   `-- inventory_pptx.py
`-- tests/test_validate_blueprint.py
```

## Use

Install or clone this directory into the skill location used by your agent,
then invoke `$professional-slides` with the deck brief, audience, desired
decision, data, source material, output format, and any reference deck.

Reference decks are intentionally not committed yet. When they are supplied,
add each approved source under `assets/reference-decks/<reference-name>/`, run
the inventory workflow in `references/template-intake.md`, and encode only the
reusable design rules and assets the user is authorized to reuse.

Validate the skill package and example blueprint with:

```bash
python /path/to/skill-creator/scripts/quick_validate.py .
python scripts/validate_blueprint.py examples/deck-blueprint.example.json
python scripts/validate_theme.py references/theming/theme-spec.example.json
python -m unittest discover -s tests
```
