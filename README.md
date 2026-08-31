# Professional Slides

`professional-slides` is a Codex plugin for building and revising executive, answer-first decks in PowerPoint and Google Slides. It keeps the full workflow in one distributable product: storylining, approval gates, design, components, slide types, charts, platform-specific implementation, deck templates, and rendered QA.

The project is independent and is not affiliated with or endorsed by McKinsey & Company. “McKinsey-style” describes concise, evidence-led executive consulting communication.

## Plugin structure

```text
.
|-- .codex-plugin/plugin.json
|-- skills/
|   `-- professional-slides/
|       |-- SKILL.md
|       |-- agents/openai.yaml
|       `-- references/
`-- evals/
    |-- cases.json
    |-- run_evals.py
    |-- scripts/
    `-- tests/
```

The plugin contains one canonical `professional-slides` skill. `SKILL.md` selects `new_deck`, `existing_deck_revision`, or `slide_revision`, then routes directly to the relevant owner files. The distributable skill contains instructions and references only. Deterministic validators, evaluation tooling, and tests stay under the repository's `evals/` boundary.

## Validate the plugin

From the repository root:

```bash
python /path/to/plugin-creator/scripts/validate_plugin.py .
python evals/scripts/validate_template_registry.py
python -m unittest discover -s evals/tests -v
```

The plugin validator checks the Codex manifest and skill metadata. The template validator checks registration, filenames, required decision sections, and owner links. The test suite checks the full source architecture and deterministic contracts.

## Use the skill

Use an explicit invocation for the first task:

```text
$professional-slides Explain which guidance you would load for a 10-slide market-entry deck. Do not create files yet.
```

For a deck request, state the audience, decision, evidence limits, delivery context, output platform, and any authorized reference deck. For example:

```text
$professional-slides Create a due-diligence deck evaluating whether Company A should acquire Company B.

Audience: investment committee
Decision: proceed, pause, or reject
Evidence: attached materials only; label unresolved diligence questions
Delivery: executive pre-read
Output: editable PowerPoint and native Google Slides, rendered and checked separately
```

The skill is an authoring and verification system, not a renderer. The active agent still uses the available PowerPoint or Google Slides tools. A completed task must be supported by the final editable artifact, full-deck renders, montage review, slide-level inspection, and any stated platform limitations.

## Extend themes and components

The canonical theming specification lives under `skills/professional-slides/references/theming/`. It separates visual families, density profiles, component variants, and semantic states; defines the complete CSS-variable token registry; and assigns a namespaced variable interface to each reusable slide component.

When a component gains raw HTML and CSS guidance, keep that specimen in the component's existing Markdown owner. List the variables it consumes, bind its namespaced aliases to the canonical registry, and translate the specimen into editable native objects. Do not copy palettes or spacing scales into each component file.

## Extend deck templates

Templates are a first-class extension point under `skills/professional-slides/references/templates/`:

- `registry.json` is the machine-readable canonical catalogue;
- `authoring.md` defines the admission, structure, ownership, and validation contract;
- each registered Markdown file owns one recurring audience decision architecture;
- shared storylining, design, components, charts, slide types, tools, and QA remain canonical and are linked rather than copied.

To add a template, create its Markdown contract, register it, run the registry validator, add source-structure coverage, and add an evaluation case before claiming mature support. This allows the catalogue to grow without turning `SKILL.md` into a large prompt or creating conflicting rules.

## Portable skill use

The directory `skills/professional-slides/` remains a self-contained `SKILL.md` package. Agents that support compatible local skills can link or copy that directory into their own skill location. Plugin metadata, installation, and discovery are Codex-specific; the slide guidance itself remains portable.

## Development evaluation

Every evaluation run starts with a new workspace and a complete reset of only this repository's `output/` directory:

```bash
python evals/scripts/prepare_eval_run.py --run-id <unique-run-id>
```

The run manifest hashes the complete plugin manifest, skill package, template registry, and evaluation cases. Generated storylines, contracts, builders, artifacts, renders, and QA packages must stay inside that run workspace and may not be copied from prior runs.

Validate a result package with:

```bash
python evals/run_evals.py --mode self --results path/to/results.json
```

Passing schema checks does not replace reviewing the actual editable artifact and renders.

## Hooks

The plugin deliberately does not bundle lifecycle hooks. Plugin hooks load whenever the plugin is enabled, not only when this skill is active, and changed hooks require a new trust review. The slide gates also depend on task-specific state such as owner approval, artifact type, and requested scope, so a global hook would either be noisy or require another transcript-parsing script.

Add a hook only when a future check is deterministic, fast, safe for every enabled-plugin session, and cannot be expressed as skill guidance or repository evaluation. Follow the [official OpenAI hooks documentation](https://learn.chatgpt.com/docs/hooks) and use the default `hooks/hooks.json` plugin location when that standard is met.
