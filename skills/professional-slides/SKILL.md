---
name: professional-slides
description: Create or revise presentations, slide decks, PowerPoint files, or Google Slides using answer-first storylines, evidence-led pages, extensible deck templates, restrained design, and rendered QA. Use for new decks, structural revisions, or bounded individual-slide edits.
---

# Professional Slides

Create clear, decision-ready decks. Use only the guidance needed for the current task.

## Start with the brief

Know the audience, decision, main question, evidence limits, delivery mode, and output format. Ask only when a missing answer would change the work.

## Choose the workflow

Use one mode:

- `new_deck`: create a new deck.
- `existing_deck_revision`: change the argument, structure, or several slides in an existing deck.
- `slide_revision`: edit named slides without changing the deck structure or narrative.

For `slide_revision`, render and inspect every slide before editing. Edit only the requested slides, reuse the existing system, and do not introduce a new design system. Do not create a hypothesis tree, dot-dash, pre-authoring contract, or structural approval gate. Render the complete deck again and do not alter unrelated slides. If the request changes structure or narrative, reclassify it as `existing_deck_revision`.

## Read only the relevant owners

For `new_deck`, read Templates and Storylining first. For `existing_deck_revision`, read Storylining first and read a template only when the authorized target structure uses one. For `slide_revision`, do not read Templates or Storylining unless the scope changes enough to reclassify the task.

For every mode, read the relevant Design, Theming, Components, and Slide types guidance. Read Charts only for quantitative exhibits. Read Tools for the requested platform. Finish with Evaluation. Within each owner, follow its links only when the task needs that detail.

- [Templates](references/templates/index.md): deck-specific decision structure and the extension contract.
- [Storylining](references/storylining/index.md): hypothesis tree, governing thought, dot-dash, storyboard, and titles.
- [Design](references/design/index.md): visual system and page composition.
- [Theming](references/theming/index.md): palettes, typography, spacing, component bindings, variants, and HTML/CSS variables.
- [Components](references/components/index.md): copy, titles, trackers, sources, and recurring elements.
- [Slide types](references/slide-types/index.md): narrative page archetypes.
- [Charts](references/charts/index.md): quantitative exhibits.
- [Tools](references/tools/index.md): PowerPoint and Google Slides implementation.
- [Evaluation](references/evaluation/index.md): final QA and release evidence.

Do not repeat an owner's rules in another file. A structural HTML specimen is optional and should be read only when prose does not make the geometry clear.

## Build a new deck

1. Select one matching template when available.
2. Build the hypothesis tree and explain its logic.
3. Write the complete dot-dash in production order, with one supported dot per planned slide. Include the cover, executive summary when required, navigation pages when used, close, and authored appendix pages.
4. Show the dot-dash to the owner and obtain approval before creating any slide document.
5. Compile and validate the [pre-authoring contract](references/storylining/pre-authoring-contract.md).
6. Choose the simplest design, components, slide types, charts, and platform tools that prove the approved story.
7. Build the complete deck without inventing facts.

## Revise an existing deck

Inspect and render the full deck first. Create an as-is dot-dash with exactly one sequenced dot for every source slide before the first mutation. Owner approval of the inventory is not required for a faithful edit, but any change to the argument, order, page count, or structure needs an approved target dot-dash and a revalidated contract.

Preserve the existing design unless the user asks for a redesign. Recommend missing new-deck structures, such as an executive summary, but do not add them without authorization.

## Keep slides simple

- One slide, one main claim, one dominant exhibit.
- Use the action title to state the answer.
- Match the exhibit to the evidence. Do not force a card grid or table.
- Use one accent colour plus neutrals unless the data needs more.
- Resolve visual values through the active theme. Do not tune individual slides with local literals.
- Use trackers only for navigation. Omit them when the title sequence is enough.
- Delete labels, boxes, strips, icons, and copy that do not add meaning.
- Never invent evidence or hide uncertainty.

## Verify and deliver

Apply the deletion test: remove anything whose absence does not weaken the argument, evidence, decision, navigation, or provenance.

Run the [evaluation guide](references/evaluation/index.md) on the exact final artifact. Render every slide, review the full montage, inspect repaired slides at full size, check overflow and sources, and verify the editable file itself. For dual-format work, validate PowerPoint and Google Slides separately.

Deliver only verified artifacts and state any real limitation.
