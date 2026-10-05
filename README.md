# Professional Slides

Professional Slides is one plugin for planning and building decision-ready slide decks. Its single skill (`$professional-slides` in Codex, `professional-slides` in Claude Code) starts with the audience's question and the evidence needed to answer it, then carries the approved story through a new editable PowerPoint file and an independent rendered review. It also rebuilds or restructures an existing deck: the user's PPTX is imported and read, never edited, and the result is a new editable PPTX. It is a staged pipeline with checkpoints, not a quick editor: a typo, a colour or one chart in an arbitrary PPTX suits a generic pptx tool. The repository root is the plugin root; there is no second plugin wrapper.

## Use the skill

Invoke the skill with the audience, the decision or learning objective, the evidence and source limits, the delivery context and any reference deck. The [skill entrypoint](skills/professional-slides/SKILL.md) selects the workflow:

| Workflow | What it does |
| --- | --- |
| New deck (`new_deck`) | Builds a governing answer, MECE pillars and an exact title spine before layout, from data the skill finds and works into insights first. The approved ghost dot-dash becomes the content and design contract. |
| Existing deck revision (`existing_deck_revision`) | Imports the user's PPTX (`runtime/import-deck.py`) into an inventory and a starter pages file with stable slide IDs, maps each slide to a page type, revises the affected claims and their dependencies, and builds a new editable PPTX. |
| One page of a deck the skill built | Changes the page in the deck's pages file and rebuilds, preserving unrelated pages. |

The pipeline - numbered steps from `node runtime/doctor.mjs` to delivery, each with its command, the condition that ends it and the reference that owns it - is in the [skill entrypoint](skills/professional-slides/SKILL.md#pipeline); this README does not repeat it. It stops for the user twice: at the design intake when answers are missing, and at the ghost dot-dash once the spine critique is ready. A deck is delivered only when its rendered gates, build bars, claim self-check and an independent review (confirmed by a fresh blind read when a verification pass accepted it) all pass; the rules live in [Taste review](skills/professional-slides/references/taste-review.md).

Templates seed a decision architecture rather than a fixed slide layout: commercial due diligence, competitive position, startup pitch and project progress update ([template catalogue](skills/professional-slides/references/templates/index.md)). Design systems (`consulting`, `editorial`, `journal`, `keynote`) set a deck's page grammar, and `identity` carries a subject's colours onto any of them ([theming](skills/professional-slides/references/theming.md)). The design intake asks once per user, with rendered option sheets from `skills/professional-slides/assets/design-options/`, and stores the answers (`runtime/preferences.mjs`).

## What the runtime produces

Node composes and measures the deck; Python and `python-pptx` write and read back the PowerPoint; LibreOffice renders it for inspection. Eligible charts are native PowerPoint charts with embedded workbooks; charts whose semantics need custom annotations, reference lines or icons remain editable grouped shapes. Meaning-bearing text, tables, diagrams and sources remain separately addressable in the saved deck. See the [runtime guide](skills/professional-slides/runtime/README.md).

The output is PowerPoint. Google Slides is a downstream import the user makes; verify the imported deck separately, because the PowerPoint render does not establish font, wrapping, crop, chart or object-order fidelity there.

## Package and install

`python3 evals/scripts/package_plugin.py` writes `dist/professional-slides` and a SHA-256 `package-manifest.json`; `--verify DIR` checks a staged package against its manifest. The package is an allowlist:

| Ships | Stays out |
| --- | --- |
| `plugin.json` (portable), `.codex-plugin/plugin.json` (Codex), `.claude-plugin/plugin.json` (Claude Code), `README.md`, `requirements.txt`, `assets/icon.png` | `package.json` and `node_modules/` (development only) |
| `skills/professional-slides/`: `SKILL.md`, `agents/`, `references/`, `runtime/`, `assets/`, and the example decks in `examples/` | `*.author-log.jsonl` logs, `examples/gallery-acceptance.deck.json` (a component-gallery fixture for the tests, `purpose: "catalogue"`, which builds with blockers by design), `evals/`, and every build or output directory |

The three manifests carry the same name, version, description and author. Codex installs the package from a marketplace entry (`codex plugin add professional-slides@personal` after rebuilding it); Claude Code loads it from `.claude-plugin/plugin.json`, for one session with `claude --plugin-dir dist/professional-slides`. Installed plugin files are read-only: write deck artifacts to a task-owned directory outside the installed plugin.

## Develop and verify

Use Node 20.9 or newer and install development dependencies with `npm ci`. `node skills/professional-slides/runtime/doctor.mjs` checks the rest and prints the install lines this machine needs: a Python with python-pptx, lxml, Pillow, numpy and pypdf (`python3 -m pip install -r requirements.txt`), and `soffice`, `pdftoppm` and `pdftotext` for rendering. Set `RUNTIME_PYTHON` if the Python packages live in another environment.

```bash
npm run check                                  # source checks (syntax, probes, dead exports) and the unit suite
node evals/scripts/run_tests.mjs [--jobs N] [--serial] [--strict] [--slow]
evals/run.sh [--slow]                          # the suite plus the example decks' content stage and the source checks
node evals/quality/run.mjs --set dev --runs 3  # headless agent runs, judged blind against the previous version
python3 evals/scripts/package_plugin.py
```

`--slow` adds the LibreOffice end-to-end render; `--strict` fails when a test was skipped for a missing dependency. [evals/README.md](evals/README.md) covers the quality runner, calibration and the page gates. None of these checks alone proves a deck's argument, factual accuracy or visual quality: inspect every final render and the saved PPTX before claiming acceptance, and after changing plugin source, reinstall it and compare the installed files with the source.
