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

`identity.primary` is a subject-sourced `#RRGGBB` color; `identity.accent` is optional. The runtime maps them to component and chart roles and adjusts text colors for contrast. Explicit deck `palette` (`midnight`, `evergreen`, `crimson` or `graphite`), `chrome`, and `tracker` settings can override design defaults. Before a user's first deck, the skill runs a short design intake - a reference deck to infer from, or the look, colours, tracker, title treatment, surfaces and density, each shown as a sheet of real rendered options from `skills/professional-slides/assets/design-options/` - and stores the answers per user (`runtime/preferences.mjs`), so later decks ask only what is missing. Each new deck also takes a fresh `variation` (`node skills/professional-slides/runtime/variation.mjs`), so two runs of one brief differ in their secondary styles and page shapes; reuse a seed only to reproduce a deck. See the [design reference](skills/professional-slides/references/design.md) and [theming reference](skills/professional-slides/references/theming.md).

## What the runtime produces

Node composes and measures the deck; Python and `python-pptx` write and read back the PowerPoint; LibreOffice renders it for inspection. Eligible charts are native PowerPoint charts with embedded workbooks. Charts whose semantics need custom annotations, reference lines, icons, or other unsupported native features remain editable grouped shapes. Meaning-bearing text, tables, diagrams, and sources should remain separately addressable in the saved deck. See the [runtime guide](skills/professional-slides/runtime/README.md).

Google Slides is a downstream import workflow. Verify the imported native Slides deck separately because the PowerPoint render does not establish font, wrapping, crop, chart, or object-order fidelity there.

## Install and run

This skills-only package contains the local slide runtime, references, examples and assets. It contains no MCP server or connected app. Portable, Codex and Claude Code manifests are included.

Use Node 20.9 or newer and a Python environment with the packages declared in `requirements.txt`. From this plugin directory run `python3 -m pip install -r requirements.txt`. Full rendering requires LibreOffice (`soffice`) and poppler (`pdftoppm` and `pdftotext`). Set `RUNTIME_PYTHON` to the appropriate interpreter. The committed runtime uses bundled font metrics.

Resolve skill commands from `skills/professional-slides/` and write outputs outside the installed plugin. Codex and Claude reviewer command-line tools are optional; review packets allow the host to provide an independent reader. See the [production guide](skills/professional-slides/references/tools/production.md).

Development tooling is in the [source repository](https://github.com/96imranahmed/professional-slides). Inspect the exact final PPTX and render; package validation does not certify deck quality or factual accuracy.
