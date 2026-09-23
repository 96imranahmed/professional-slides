# Professional Slides

Professional Slides is one Codex plugin for planning, creating, and revising decision-ready slide decks. Its single skill, `$professional-slides`, starts with the audience's question and the evidence needed to answer it, then carries the approved story through an editable PowerPoint file and rendered review. The repository root is the plugin root; there is no second plugin wrapper.

## Use the skill

Invoke `$professional-slides` with the audience, decision or learning objective, evidence and source limits, delivery context, output format, and any reference deck. The [skill entrypoint](skills/professional-slides/SKILL.md) selects one of three workflows:

| Workflow | What it does |
| --- | --- |
| New deck (`new_deck`) | Builds a hypothesis tree, exact title spine and complete dot-dash before layout. The authorized dot-dash becomes the content and design contract. |
| Existing deck revision (`existing_deck_revision`) | Inventories the source deck slide by slide, then updates the affected claims and shared dependencies by stable slide ID. |
| Individual slide revision | Edits the requested page and its dependencies while preserving unrelated slides. |

A new deck starts from data: the skill finds and downloads the series, peer sets, shares, geography and pipeline the question turns on before writing titles, and declares the organisations it compares as `players` so the deck introduces them, with their logos, before comparing them. For a new deck, keep `<id>.content.json`, `<id>.plan.json`, and `<id>.deck.json` together. The build checks their stable IDs, titles, visible copy, evidence design, and opening executive summary before export. An existing authorization to proceed covers work within its scope; structural changes outside that scope need an approved dot-dash. See [Storylining](skills/professional-slides/references/storylining.md) and the [template catalogue](skills/professional-slides/references/templates/index.md). Templates seed a decision architecture rather than a fixed slide layout; the registered choices are commercial due diligence, startup pitch, and project progress update.

The standard pipeline runs from the repository root (or from the installed skill with paths resolved to its `runtime/` directory):

```bash
node skills/professional-slides/runtime/build-deck.mjs path/to/deck.deck.json output/my-deck/ --preflight
node skills/professional-slides/runtime/build-deck.mjs path/to/deck.deck.json output/my-deck/
# Reproduce the claims in output/my-deck/claims.json against their source records,
# then record the result in output/my-deck/self-check.json.
node skills/professional-slides/runtime/deliver-deck.mjs path/to/deck.deck.json output/my-deck/ --skip-build
```

The build writes an editable PPTX, slide renders, saved-file readback, and gate reports. It also applies deck craft floors to what was built: a deck whose charts mostly plot two numbers, whose tables are mostly plain grids, whose charts carry no annotations, that leans on step diagrams, carries no icons, or compares players it never introduces is built for inspection but not delivered. Delivery requires passing rendered gates, a current claim self-check, and a review bound to the exact PPTX, scene, and renders. The first review inspects the whole deck; after a rejected candidate is rebuilt, verification focuses on changed and previously blocked pages. If no review backend is available, delivery writes a review packet for the calling agent to assess and submit. An accepted delivery writes `<id>-DELIVERED.pptx`; a rejection retains the build for repair without leaving a stale delivered copy. See [Production](skills/professional-slides/references/tools/production.md) and [Taste review](skills/professional-slides/references/taste-review.md).

Ordinary decks follow the requested length. A reusable-skill evaluation marked `purpose: "evaluation"` requires at least 50 rendered pages unless the user explicitly overrides that evaluation length; shorter component probes remain diagnostics.

## Design systems and subject identity

A deck can declare a `design` to set its page grammar, not just its colors. The runtime currently offers `consulting`, `editorial`, `journal`, and `keynote`. Each sets defaults for typography, title treatment, margins, cover and section pages, takeaway placement, commentary side, and suitable page shapes. Choose the system for the reading context; use `identity` for colors that belong to the subject:

| Design | Reading context and page treatment |
| --- | --- |
| `consulting` | Board and steering papers with a familiar consulting hierarchy and compact evidence pages. |
| `editorial` | Narrative pre-reads with wider margins, serif titles, and commentary before the exhibit. |
| `journal` | Chart-led briefings with a short finding below the title and full-width evidence. |
| `keynote` | Live presentations with large statement titles, strong section pages, and simpler at-a-glance exhibits. |

```json
{
  "design": "editorial",
  "identity": { "primary": "#740001", "accent": "#D3A625" }
}
```

`identity.primary` is a subject-sourced `#RRGGBB` color; `identity.accent` is optional. The runtime maps them to component and chart roles and adjusts text colors for contrast. Explicit deck `palette` (`midnight`, `evergreen`, `crimson` or `graphite`), `chrome`, and `tracker` settings can override design defaults. Before a new deck, the skill asks for a reference deck to infer the system from, or for a pick from `skills/professional-slides/assets/design-systems.png`. Each new deck also takes a fresh `variation` (`node skills/professional-slides/runtime/variation.mjs`), so two runs of one brief differ in their secondary styles and page shapes; reuse a seed only to reproduce a deck. See the [design reference](skills/professional-slides/references/design.md) and [theming reference](skills/professional-slides/references/theming.md).

## What the runtime produces

Node composes and measures the deck; Python and `python-pptx` write and read back the PowerPoint; LibreOffice renders it for inspection. Eligible charts are native PowerPoint charts with embedded workbooks. Charts whose semantics need custom annotations, reference lines, icons, or other unsupported native features remain editable grouped shapes. Meaning-bearing text, tables, diagrams, and sources should remain separately addressable in the saved deck. See the [runtime guide](skills/professional-slides/runtime/README.md).

Google Slides is a downstream import workflow. Verify the imported native Slides deck separately because the PowerPoint render does not establish font, wrapping, crop, chart, or object-order fidelity there.

## Repository and distribution

- [`.codex-plugin/plugin.json`](.codex-plugin/plugin.json) declares the plugin and exposes the one skill.
- [`skills/professional-slides/SKILL.md`](skills/professional-slides/SKILL.md) routes the workflows. Its `references/`, `runtime/`, `examples/`, and `assets/` hold guidance, executable components, examples, and reusable media.
- `evals/` (source repository only) holds repository checks, fixtures, reference renders, and regression tests. `evals/scripts/` owns packaging and validation utilities.
- `output/`, `outputs/`, `tmp/`, and `dist/` are generated or staged directories, not source inputs.

Build the installable package with `python3 evals/scripts/package_plugin.py`. It writes `dist/professional-slides` and a SHA-256 `package-manifest.json`; the package contains the plugin manifest, README, assets and the skill (guidance, runtime, examples and its assets). It excludes `evals/`, working outputs, dependencies, local research, and Git metadata. The personal marketplace entry points to the packaged directory, so after source changes rebuild it before running `codex plugin add professional-slides@personal`.

Installed plugin files are read-only. Write deck artifacts to a task-owned directory outside the installed plugin. A developer checkout may write under its own `output/`; clearing generated outputs must preserve `dist/professional-slides`, the repository, and the marketplace source.

## Develop and verify

Use Node 20.9 or newer and install test dependencies with `npm ci`. For the PowerPoint export and image gates, install Python dependencies with `python3 -m pip install -r requirements.txt`; full rendering also needs `soffice` and `pdftoppm` on `PATH`. Set `RUNTIME_PYTHON` if the Python packages live in another environment. The layout engine and fast tests can run without the render binaries.

```bash
npm run check          # source checks and fast regression tests
evals/run.sh           # tests plus fixture page-gate diagnostics
evals/run.sh --slow    # also exercise the LibreOffice end-to-end render
npm run check:release  # emit, render, and compare the committed reference pages
python3 evals/scripts/package_plugin.py
```

The release check compares fresh renders of the committed fixture with four accepted reference images. Other tests cover component and scene behavior; none of these checks alone proves the deck's argument, factual accuracy, visual quality, or Google Slides fidelity. Inspect every final slide render and the exact saved PPTX before claiming acceptance. After changing plugin source, reinstall it and compare the packaged and installed `.codex-plugin` and `skills` files with the source.
