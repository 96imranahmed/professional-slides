# Professional Slides

Professional Slides is one plugin for planning and building decision-ready slide decks. Its single skill (`$professional-slides` in Codex, `professional-slides` in Claude Code) starts with who will read the deck and what they already know, then carries the approved storyline through a new editable PowerPoint file, rendered and checked page by page. It also rebuilds or restructures an existing deck: the user's PPTX is imported and read, never edited, and the result is a new editable PPTX. It is a short pipeline with one checkpoint, not a quick editor: a typo, a colour or one chart in an arbitrary PPTX suits a generic pptx tool. The repository root is the plugin root; there is no second plugin wrapper.

## Use the skill

Invoke the skill with the evidence and, if you have them, the audience, what they already know, the decision and any reference deck; it asks for what is missing. The [skill entrypoint](skills/professional-slides/SKILL.md) selects the workflow:

| Workflow | What it does |
| --- | --- |
| New deck (`new_deck`) | Asks who reads the deck and what they know, writes the storyline that reader needs as titles in order, and draws each page once the user approves it. |
| Existing deck revision (`existing_deck_revision`) | Imports the user's PPTX (`runtime/import-deck.py`) into an inventory and a starter pages file with stable slide IDs, maps each slide to a page type, revises the affected claims and their dependencies, and builds a new editable PPTX. |
| One page of a deck the skill built | Changes the page in the deck's pages file and rebuilds, preserving unrelated pages. |

The process - from the reader questions to delivery, each step with its command - is in the [skill entrypoint](skills/professional-slides/SKILL.md#the-process); this README does not repeat it. It stops for the user at the start (the reader and, when no answers are stored, the design) and at the storyline. Every page is rendered and looked at before delivery; an independent review runs when the user asks for one.

Design systems (`consulting`, `editorial`, `journal`, `keynote`) set a deck's page grammar, and `identity` carries a subject's colours onto any of them. The design intake asks once per user, with rendered option sheets from `skills/professional-slides/assets/design-options/`, and stores the answers (`runtime/preferences.mjs`; [Design intake](skills/professional-slides/references/design-intake.md)).

## What the runtime produces

Node composes and measures the deck; Python and `python-pptx` write and read back the PowerPoint; desktop PowerPoint or LibreOffice renders it for inspection. Eligible charts are native PowerPoint charts with embedded workbooks; charts whose semantics need custom annotations, reference lines or icons remain editable grouped shapes. Meaning-bearing text, tables, diagrams and sources remain separately addressable in the saved deck. See the [runtime guide](skills/professional-slides/runtime/README.md).

The output is PowerPoint. Google Slides is a downstream import the user makes; verify the imported deck separately, because the PowerPoint render does not establish font, wrapping, crop, chart or object-order fidelity there.

## Install and run

This distribution contains one skill and its local runtime, references, examples and assets. It has no MCP server or connected app. The portable manifest is `plugin.json`; Codex and Claude Code compatibility manifests are included.

Use Node 20.9 or newer. From this plugin directory, install the Python dependencies with `python3 -m pip install -r requirements.txt`. Full rendering needs desktop PowerPoint or LibreOffice, plus poppler (`pdftoppm` and `pdftotext`). Automatic selection prefers installed PowerPoint on macOS and Windows, with LibreOffice as fallback; Linux uses LibreOffice. PowerPoint needs activation and local automation access. Set `PROFESSIONAL_SLIDES_RENDERER=libreoffice` for jobs without a desktop session, or choose `powerpoint` explicitly to require its renderer. Explicit selections never fall back. Run `node skills/professional-slides/runtime/doctor.mjs` and use the `RUNTIME_PYTHON` it recommends. Optional `@napi-rs/canvas` enables font measurements; bundled metrics are available without it.

Follow the [skill process](skills/professional-slides/SKILL.md#the-process), resolving its commands from the skill directory. Write deck outputs to a task-owned directory outside the installed plugin.

Development tests and packaging tools are in the [source repository](https://github.com/96imranahmed/professional-slides), outside this distribution. Automated checks do not certify a deck's argument, factual accuracy or visual quality; inspect the final render and saved PPTX before accepting it.
