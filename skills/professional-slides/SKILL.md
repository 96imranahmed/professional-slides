---
name: professional-slides
description: Create or revise presentations, slide decks, PowerPoint files, or Google Slides using answer-first storylines, evidence-led pages, extensible deck templates, restrained design, and rendered QA. Use for new decks, structural revisions, or bounded individual-slide edits.
---

# Professional Slides

Create clear, decision-ready decks. Use only the guidance needed for this task.

## Start with the brief

Know the audience, decision, question, evidence limits, delivery mode, and format.

## Choose the workflow

Use one mode:

- `new_deck`: create a new deck.
- `existing_deck_revision`: change the argument, structure, or several slides in an existing deck.
- `slide_revision`: edit named slides without changing the deck structure or narrative.

For `slide_revision`, render every slide first. Edit only the requested slides, reuse the existing system, and do not alter unrelated slides. Skip the hypothesis tree, dot-dash, contract, and structural gate. Reclassify structural or narrative changes as `existing_deck_revision`.

## Read only the relevant owners

For `new_deck`, read Templates and Storylining first. For `existing_deck_revision`, read Storylining first and read a template only when the authorized target structure uses one. For `slide_revision`, do not read Templates or Storylining unless the scope changes enough to reclassify the task.

For every mode, read the relevant Composition, Design, Theming, Components, platform Tools, and Evaluation guidance. Read Charts only for quantitative exhibits.

- [Templates](references/templates/index.md): deck-specific decision structure and the extension contract.
- [Storylining](references/storylining/index.md): hypothesis tree, governing thought, dot-dash, storyboard, and titles.
- [Composition](references/composition/index.md): open page tree, content-item jobs, layout selection, nesting, and executable runtime.
- [Design](references/design/index.md): visual system and page composition. Read [Slide layouts](references/design/slide-layouts.md) when the canvas needs a deliberate open composition or an existing design must change the relationship among its items.
- [Theming](references/theming/index.md): palettes, typography, spacing, component bindings, variants, and HTML/CSS variables.
- [Components](references/components/index.md): copy, titles, trackers, sources, and recurring elements.
- [Charts](references/charts/index.md): quantitative exhibits.
- [Tools](references/tools/index.md): PowerPoint and Google Slides implementation.
- [Evaluation](references/evaluation/index.md): final QA and release evidence.

Do not repeat owner rules. Read structural HTML only when prose does not resolve geometry.

## Build a new deck

1. Select one matching template when available.
2. Build the hypothesis tree and explain its logic.
3. Write the complete dot-dash as Markdown in production order. Each planned slide has one supported dot, and that dot is the exact proposed audience-facing slide title or structural heading. Include the cover, executive summary when required, navigation pages when used, close, and authored appendix pages.
4. Show the dot-dash to the owner and obtain approval before creating any slide document.
5. Compile and validate the [pre-authoring contract](references/storylining/pre-authoring-contract.md).
6. Use the clean native standard visual system unless an approved reference or explicit owner direction authorizes another visual mode. Select registered component variants rather than inventing slide-local treatments.
7. Compile every planned slide through the [content and composition planner](runtime/README.md#content-planning). Every content item must state its job and use a registered component.
8. Build the complete deck without inventing facts.

## Revise an existing deck

Render the deck and create one sequenced as-is dot per source slide before the first mutation. Argument, order, page-count, or structural changes need an approved target dot-dash and revalidated contract.

Preserve the design unless a redesign is requested. Recommend missing new-deck structures but do not add them without authorization.

## Keep slides simple

- One slide, one main claim, one dominant exhibit.
- A dominant exhibit must use its allocated canvas and include the comparison, qualifier, labels, and attached interpretation needed to prove the title. Whitespace is not evidence; do not leave an executive pre-read under-composed.
- Use enough substantive interpretation to make the decision clear. Remove repetition, not the reasoning that connects evidence to consequence; follow the [copy owner](references/components/copy.md).
- Executive summaries need multiple substantive bullets under each titled section, not one compressed point per theme. Apply the [executive-summary completeness contract](references/components/copy.md#executive-summary-narrative), keep shared body type, and close with one recommendation and change condition.
- Place detached bottom conclusions in the [shared insight box](references/components/insight-box.md): normally one complete sentence, without a separate title or arrow. Use its theme-bound tonal or primary surface, not a local text-strip design.
- Use the [shared Quote Cluster](references/components/quote-cluster.md) for sourced voices. Keep quote count, full-field or sectional placement, enclosure, attribution alignment, and optional avatars as component inputs rather than slide-local drawings.
- Use the action title to state the answer.
- Match the exhibit to the evidence. Do not force a card grid or table.
- On analytical table pages, put the exhibit before its insight and develop the row reasoning. Use the [typed table owner](references/charts/heatmap-table.md) for arbitrary columns, grouped rows, indicators and in-cell charts; do not build a topic-specific table template.
- Select layout from the content items and their relationship. Do not classify a topic into a fixed page template.
- Use one accent colour plus neutrals unless the data needs more.
- Resolve visual values through the active theme. Do not tune individual slides with local literals.
- Prefer one variant for each recurring component or semantic relationship across the deck. This is a consistency default, not a hard constraint: change variants when the content, hierarchy, or deliberate emphasis justifies it.
- Use trackers only for navigation. Omit them when the title sequence is enough. When used, compile the registered full tracker page and its associated compact analytical header from the same exact item map and selected id; do not hand-build either state.
- Use the shared [map component](references/components/maps.md) for geographic evidence. Select an authorized standard geography or explicit country crop; do not approximate continents with generic shapes.
- Use the shared chart-title component: underline the heading, or show a light-grey unit below it without a rule. Use the shared legend or direct-label grammar unless the approved contract records a justified exception.
- Use one declared chart highlight: one primary bar against neutral peers, one primary region outline, or one light-neutral region tint. Exactly two unstacked marks should use a strongly contrasting pair from the active chart palette unless an explicit series mapping applies. Two peer charts may use one quiet gutter divider when whitespace alone does not separate them.
- Use shared chart change annotations when the comparison needs them: an arrow for directional A-to-B movement, a bracket for a meaningful interval, a construction for a reconciled start-to-end bridge, or one aligned rail below period labels. Bind every endpoint to exact category and series keys.
- Keep simple plot fields blank. Gridlines are off by default and should be enabled only when a dense or multiseries chart requires intermediate scale reading.
- In reusable template specimens, use neutral parenthetical prompts such as `(Insert action title)` or `(Insert section title)`. Never use square-bracket placeholder copy. Put brief guidance on when to use the slide or chart, why the form is appropriate, and what the action title should reflect in speaker notes rather than on the canvas.
- Delete labels, boxes, strips, icons, and copy that do not add meaning.
- Never invent evidence or hide uncertainty.

## Lock deck-wide consistency

Before authoring, map every slide or range in one deck treatment ledger to its visual family, density, header, tracker, layout, component variants, and colour roles. Build recurring values from shared constants.

When navigation is used, the tracker map defines the complete approved item set, exact IDs, labels, order, ranges, selected items, and shared constructions. Follow the [tracker owner](references/components/trackers/index.md): show every planned section page, bias circular numbers, keep split-content left fields title-only, and vertically center the list in a full-height right backdrop. Apply the declared compact state continuously.

After rendering, compare the full montage and every slide against the treatment ledger. Verify title and content anchors, typography, spacing, component variants, semantic colour use, tracker completeness, and tracker continuity. Record and justify intentional exceptions; repair every unexplained drift before release.

## Verify and deliver

Apply the deletion test: remove anything whose absence does not weaken the argument, evidence, decision, navigation, or provenance.

For net-new PowerPoint, compile the canonical scene and design manifest, render the HTML observer, generate editable native objects with the PptxGenJS adapter, and re-import the exact PPTX through Artifact Tool. Finish the complete implementation batch before running `npm run validate:runtime`; do not restart the expensive render-and-readback suite after each intermediate edit. The final run regenerates the [golden set](references/composition/index.md#golden-component-set) in the canonical McKinsey palette; fast contract tests retain coverage of other supported palette inputs. A single-component probe is not release evidence.

Run the [evaluation guide](references/evaluation/index.md) on the exact final artifact. Render every slide, review the full montage, inspect every slide at full size, check overflow and sources, and verify the editable file itself. For PowerPoint, compile the hard acceptance manifest, run the exported-PPTX validator, then run the independent visual validator with every exact slide render and the exact generation script. A rejection from any structural, adapter, component, or visual gate requires a source repair, fresh export, fresh render, and another review. Repeat until the exact candidate is accepted. For dual-format work, validate PowerPoint and Google Slides separately.

Deliver only verified artifacts and state any real limitation.
