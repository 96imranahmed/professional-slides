# Professional Slides

`professional-slides` is a portable agent skill for building executive-grade,
answer-first consulting decks in PowerPoint and Google Slides. It combines
storylining, design foundations, slide archetypes, chart standards, theming,
platform implementation guidance, and rendered quality gates.

The project is designed for Codex and other `SKILL.md`-compatible coding agents,
including Claude Code. It is independent and is not affiliated with or endorsed
by McKinsey & Company. "McKinsey-style" describes the general category of
concise, evidence-led executive consulting communication.

## Structure

The repository is organized by responsibility rather than by workflow stage:

```text
.
|-- agents/
|-- src/
|   |-- storylining/
|   |-- slide-types/
|   |-- charts/
|   |-- theming/
|   `-- tools/
|       |-- powerpoint/
|       `-- google-slides/
|-- evals/
|-- scripts/
`-- tests/
```

The `src/` root also contains shared design and cross-deck component guidance.
Every directory under `src/` has an `index.md`: start with the root index, then
read only the relevant subsystem indexes and specialized pages.

- `storylining/` owns the argument, narrative arc, storyboard, and title spine.
- `slide-types/` owns supported slide archetypes.
- `charts/` owns quantitative exhibit selection and construction.
- `theming/` owns the single visual theme source and reference-intake rules.
- `tools/` owns PowerPoint and Google Slides implementation and rendering.
- `evals/` owns self-review and blinded skill-effectiveness evaluation.
- `scripts/` contains deterministic repository utilities.
- `tests/` verifies the maintained evaluation and utility behavior.

## Use

Install or clone the repository into the skill location used by your agent, then
invoke `$professional-slides` with the audience, decision, evidence, source
material, delivery context, output format, and any authorized reference deck.

Reference decks remain external and read-only unless the user explicitly
authorizes inclusion. The skill retains generalized design guidance, not named
template provenance or source files.
