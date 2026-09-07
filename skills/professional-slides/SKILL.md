---
name: professional-slides
description: Create or revise presentations, slide decks, PowerPoint files, or Google Slides using answer-first storylines, evidence-led pages, extensible deck templates, restrained design, and rendered QA. Use for new decks, structural revisions, or bounded individual-slide edits.
---

# Professional Slides

The singular design goal is to avoid slide noise. Noise comes from inconsistent standards, dangling labels or commentary, weak grouping, and poorly constructed text, not from text density itself. Dense slides are welcome when the evidence needs them and the writing, hierarchy, spacing and recurring treatments remain clear and consistent. Preserve substance; do not chase empty space or shorten complete reasoning into abrupt fragments. Use only the guidance needed for this task.

## Structural requirements

Every rendered object must carry a semantic ID, role, owner and exact dependency IDs through the scene and PowerPoint `cNvPr` description. The compiler and exported-file provenance gate reject missing tags or dependencies. Detached analytical prose must use an `insight` component or a deliberately headed content section; a generic paragraph under an exhibit is invalid. Pair standalone section headings and bodies with `props.semantic: {kind: "section-member", relatedTo: ["exact-peer-id"]}`. Never create a fake heading or tag to bypass grouping.

Highlight every growth or change comparison with a keyed `changeAnnotations` callout and declare `changeIntent` on its chart. State the interval and unit, distinguish percent from percentage points, and use absolute changes when a percentage is undefined or misleading. Do not label a cross-sectional city gap as growth.

For a same-page category comparison, use one grouped/segmented exhibit or equivalent left/right charts. Matched peers must share encoding, unit, category/period coverage, quantitative domain, label treatment and plot geometry. Declare `chart-group.comparison: {kind: "matched", unit: "..."}` and explicit common axis bounds. Mixed four-chart grids remain valid for different analytical questions, not inconsistent renderings of the same comparison.

For comparison tables, declare `comparisonAxis: rows` when the first column contains dimensions and `comparisonAxis: columns` when the top row contains dimensions. Emphasize the dimensions: use category cells in the first case and `treatment: dimensions` in the second. NYC/SF, products, companies and scenarios are comparison items, not dimensions.

An analytical page must add substantive evidence, a developed explanation or a usable decision instrument. A caveat, generic warning, unmatched pair of policy targets or decorative timeline alone is not a page. Replace it with a common-period comparison, a transparently calculated scenario, or consolidate it into the relevant exhibit. Never imply that matching the chart styling reconciles incompatible measures.

## Start with the brief

Know the audience, decision, question, evidence limits, delivery mode, and format.

Distinguish a decision from an explanation or learning objective. Do not invent a recommendation when the audience needs to understand a mechanism. If the requested deliverable stops at storylining or proposed structure, read Templates, Storylining and the relevant copy/composition/design owners, then deliver the plan. Defer platform implementation and export gates until a slide document is requested.

## Choose the workflow

Use one mode:

- `new_deck`: create a new deck.
- `existing_deck_revision`: change the argument, structure, or several slides in an existing deck.
- `slide_revision`: edit named slides without changing the deck structure or narrative.

For `slide_revision`, render every slide first. Edit only the requested slides, reuse the existing system, and do not alter unrelated slides. Skip the hypothesis tree, dot-dash, contract, and structural gate. Reclassify structural or narrative changes as `existing_deck_revision`.

## Read only the relevant owners

For `new_deck`, read Templates and Storylining first. For `existing_deck_revision`, read Storylining first and read a template only when the authorized target structure uses one. For `slide_revision`, do not read Templates or Storylining unless the scope changes enough to reclassify the task.

For every production mode, read the relevant Composition, Design, Theming, Components, platform Tools, and Evaluation guidance. Planning-only work uses the scope-specific route above and defers production contracts. Read Charts for quantitative exhibits or analytical tables.

- [Templates](references/templates/index.md): deck-specific decision structure and the extension contract.
- [Storylining](references/storylining/index.md): hypothesis tree, governing thought, dot-dash, storyboard, and titles.
- [Composition](references/composition/index.md): open page tree, content-item jobs, layout selection, nesting, and executable runtime.
- [Design](references/design/index.md): visual system and page composition. Read [Slide layouts](references/design/slide-layouts.md) when the canvas needs a deliberate open composition or an existing design must change the relationship among its items.
- [Theming](references/theming/index.md): palettes, typography, spacing, component bindings, variants, and shared token bindings.
- [Components](references/components/index.md): copy, titles, trackers, sources, and recurring elements.
- [Charts](references/charts/index.md): quantitative exhibits.
- [Tools](references/tools/index.md): PowerPoint and Google Slides implementation.
- [Evaluation](references/evaluation/index.md): final QA and release evidence.

Do not repeat owner rules. Use the registered runtime component and its generated preview when prose does not resolve geometry.

## Workspace and installation boundary

Treat the installed plugin as read-only. Resolve its references and runtime from the skill location, but place all task-generated plans, downloaded evidence, scratch files, renders, reports and final decks under one `output/<task>/` directory in the user’s working project, outside the plugin. Do not create parallel top-level `tmp/` or `deliverables/` folders. Never run the developer golden suite for an ordinary deck; validate that deck only. Developer packaging and full golden runs belong to a source checkout. See [artifact lifecycle](references/tools/artifact-lifecycle.md).

## Build a new deck

1. Select one matching template when available.
2. Build and explain the problem logic: a hypothesis tree for a decision under uncertainty, or a concept/dependency map for an explanatory brief, following [Storylining](references/storylining/index.md).
3. Write the complete dot-dash as a table artifact in production order, using a Markdown table when the host has no table artifact. Each planned slide has one supported dot, and that dot is the exact proposed audience-facing slide title or structural heading. Include the cover, mandatory executive summary, navigation pages when used, close, and authored appendix pages. Include each slide’s explicit key insight, direct links to the underlying data and sources, proposed layout, ordered sections and component types, and the arguments and evidence assigned to them, following the [dot-dash design plan](references/storylining/dot-dash.md#slide-design-plan).
4. Require an executive summary in every full deck, including recreations. Apply the [standalone argument test](references/storylining/dot-dash.md#standalone-argument-and-evidence-test): the written executive summary plus dot-dash must answer the main question with sufficient evidence, reasoning, and qualifications before construction. Validate the proposed story and slide designs together, then show the complete dot-dash table to the owner and obtain approval before creating any slide document.
5. Compile and validate the [pre-authoring contract](references/storylining/pre-authoring-contract.md).
6. Use the clean native standard visual system unless an approved reference or explicit owner direction authorizes another visual mode. Select registered component variants rather than inventing slide-local treatments.
7. Pass the [analytical substance check](references/components/copy.md#analytical-substance) before choosing layout, then compile every planned slide through the [content and composition planner](runtime/README.md#content-planning). Every content item must state its job and use a registered component. Use the approved per-slide design plan as authoring-model input and reconcile it with the planner input rather than choosing the slide design again during generation.
8. Build the complete deck without inventing facts.

## Revise an existing deck

Render the deck and create one sequenced as-is dot per source slide before the first mutation. Argument, order, page-count, or structural changes need an approved target dot-dash and revalidated contract.

Preserve the design unless a redesign is requested. Recommend missing new-deck structures but do not add them without authorization.

## Remove noise, preserve substance

Use compact large-number labels (for example `8.3m` and `0.8m`) with one shared magnitude and precision across a comparison. Keep full values in data and notes; round only display text. Select a relevant, verified photograph from Pexels or another licensed source for dedicated image panels; embed the actual asset and inspect its crop. Do not reuse a generic sample gradient or icon as subject photography.


- One slide, one main claim, one dominant exhibit.
- Keep rules above charts, but choose non-chart heading rules only when substantial content needs separation. Prefer open headings and whitespace; a compact implication may use only one box and an arrow, beside or below the evidence. Delete generic verdict labels and title-restating paragraphs. A companion analytical deep dive into a selected chart period or category uses a substantive ruled heading aligned with the chart heading; distinguish it from an unheaded implication. Omit umbrella headings such as “What the evidence establishes” when substantive child headings already explain the content.
- Keep the [cover](references/components/index.md#deck-cover) title very short and its subtitle to a succinct statement of the deck’s scope or purpose, such as “Market performance and prospects”; do not place a thesis or provenance paragraph beneath it.
- A dominant exhibit must use its allocated canvas and include the comparison, qualifier, labels, and attached interpretation needed to prove the title. Whitespace is not evidence; do not leave an executive pre-read under-composed.
- Use enough substantive interpretation to make the decision clear. Remove repetition, not the reasoning that connects evidence to consequence; follow the [copy owner](references/components/copy.md).
- Executive summaries need multiple substantive bullets under each titled section, not one compressed point per theme. Apply the [executive-summary completeness contract](references/components/copy.md#executive-summary-narrative), keep shared body type, and close with one recommendation and change condition.
- Hard requirement: never recap content already shown on the slide, especially graph content. Do not narrate plotted values, repeat a table in prose, or repackage the title as a takeaway. Moving a recap into bullets or a box does not make it useful. Delete it.
- An insight must add a supported new deduction from the presented evidence, not a summary, observation, calculation recap, or methodology note. Enforce the [copy gate](references/components/copy.md#no-recap-and-new-deduction-gate) before layout and on the exact final render; any recap or non-deductive insight blocks release, regardless of visual scores. If no defensible deduction exists, omit the insight rather than inventing one.
- Place a genuine detached deduction in the [shared insight box](references/components/insight-box.md). Developed explanation or additional evidence belongs in a deliberately grouped section beside or beneath the exhibit. Prefer point-specific annotations for observations tied to chart marks; never leave detached paragraphs or labels floating around an exhibit. Both treatments must pass the no-recap gate. Composites may place a chart in one half and a table with the single insight box below it in the other. Follow [slide layouts](references/design/slide-layouts.md#analytical-composites) for grouping and centering.
- Use the [shared Quote Cluster](references/components/quote-cluster.md) for sourced voices. Keep quote count, full-field or sectional placement, enclosure, attribution alignment, and optional avatars as component inputs rather than slide-local drawings.
- Use the title to state the supported answer or orient the explanatory page, following [Storylining](references/storylining/index.md#write-the-title-spine).
- Match the exhibit to the evidence. Do not force a card grid or table. Audit table reliance across the dot-dash using [deck rhythm](references/design/index.md#deck-rhythm); allocate dedicated evidence slides when a claim needs a graph, distribution, or relationship test before synthesis.
- On analytical table pages, put the exhibit before its insight and develop the row reasoning. Follow the [typed table owner](references/charts/heatmap-table.md) for content-led header orientation, mixed typed columns and evidence-supported comparison encodings; do not build a topic-specific table template.
- Give referenceable cases circular identifiers in the case/category field and order every comparison exhibit by a deliberate logical progression, following [case identifiers and ordering](references/charts/heatmap-table.md#case-identifiers-and-logical-order). Preserve case identity when reordering; never leave scenarios in arbitrary authoring order.
- In split analytical layouts, if one peer section has a title, every peer needs a substantive section title, including tables. Column headers do not count as the table's section title. Follow [analytical composites](references/design/slide-layouts.md#analytical-composites) for matched title anchors and underline baselines.
- Select layout from the content items and their relationship. Do not classify a topic into a fixed page template.
- Use one accent colour plus neutrals unless the data needs more.
- Resolve visual values through the active theme. Do not tune individual slides with local literals.
- Hard requirement: select every main and secondary section design from its content and job. Consider suitable registered alternatives; never default to the first variant, repeat an insight box, or reuse “two metrics plus insight” merely because the previous slide did. Audit the whole sequence and nested sections for unjustified repetition. Preserve recurring table schemas, encodings, navigation and typography when consistency improves comparison. Variety must improve the argument; do not rotate variants randomly. Record each section’s component, variant and content-specific reason in the story plan, including intentional consistency exceptions.
- Use trackers only for navigation. Omit them when the title sequence is enough. When used, compile the registered full tracker page and its associated compact analytical header from the same exact item map and selected id; do not hand-build either state.
- Use the shared [map component](references/components/maps.md) for geographic evidence. Select a sourced standard geography, explicit country crop or imported arbitrary-location GeoJSON; do not approximate continents with generic shapes.
- Use the shared chart-title component. Keep the heading and differently coloured unit on one line when they fit; shorten the heading before allowing the measured stacked fallback. Put a material period in the heading rather than the unit. Analytical peers share one top anchor and underline baseline, so an underlined right-hand rail requires an underlined chart title with the same frame top. Use the shared legend or direct-label grammar unless the approved contract records a justified exception.
- Apply the shared [chart focus and contrast rule](references/charts/index.md#focus-and-comparator-colours): default to deck-primary focus against light-grey comparators. Two peer charts may use one quiet gutter divider when whitespace alone does not separate them.
- Make the [chart annotation decision](references/components/chart-callouts.md#authoring-decision) before layout. Serialize the selected change or gap into chart props; a growth claim in the title does not request an annotation from the renderer.
- Use implication chevrons at only one or two deliberate emphasis points per deck, following [arrow restraint](references/components/arrows.md#deck-level-restraint). Elsewhere, express the relationship through compact grouping and reading order; do not attach a chevron to every insight. Actual process stages are a separate use.
- Keep simple plot fields blank. Gridlines are off by default and should be enabled only when a dense or multiseries chart requires intermediate scale reading.
- In reusable template specimens, use neutral parenthetical prompts such as `(Insert action title)` or `(Insert section title)`. Never use square-bracket placeholder copy. Put brief guidance on when to use the slide or chart, why the form is appropriate, and what the action title should reflect in speaker notes rather than on the canvas.
- Keep supporting text and its following insight in one compact, content-sized group. Use the smallest readable theme gap after the measured text bottom; never push the insight away with a fixed lower anchor or flexible spacer.
- Delete labels, boxes, strips, icons, and copy that do not add meaning.
- Never invent evidence or hide uncertainty. Enforce the [meaningful-position gate](references/charts/index.md#meaningful-position-gate): no arbitrary within-category scatter or jitter; every coordinate must have a defensible data meaning. Violations block release.

## Lock deck-wide consistency

Before authoring, map every slide or range in one deck treatment ledger to its visual family, density, header, tracker, layout, component variants, and colour roles. Build recurring values from shared constants.

When navigation is used, the tracker map defines the complete approved item set, exact IDs, labels, order, ranges, selected items, and shared constructions. Follow the [tracker owner](references/components/trackers/index.md): show every planned section page, bias circular numbers, keep split-content left fields title-only, and vertically center the list in a full-height right backdrop. Apply the declared compact state continuously.

After rendering, compare the full montage and every slide against the treatment ledger. Verify title and content anchors, typography, spacing, component variants, semantic colour use, tracker completeness, and tracker continuity. Separately check [deck rhythm](references/design/index.md#deck-rhythm): consistent styling must still support varied analytical questions and developed evidence. Record and justify intentional exceptions; repair every unexplained drift before release.

## Verify and deliver

Apply the deletion test: remove anything whose absence does not weaken the argument, evidence, decision, navigation, or provenance.

For net-new PowerPoint, use `runtime/generation.mjs` as the only production entrypoint. `writeCanonicalDeckPlan()` compiles the approved content plan through the same planner, scene, registry, token system, HTML observer, PptxGenJS adapter, and Artifact Tool observer used by the golden set. Do not create a parallel PptxGenJS builder, duplicate shared components, or recreate theme values as slide-local constants. Keep the canonical generation receipt beside the exact PPTX; an output-only visual score does not prove that the required mechanism was used.

For plugin development only, finish the complete implementation batch before running `npm run validate:runtime`; do not restart the expensive render-and-readback suite after each intermediate edit. The final run regenerates the [golden set](references/composition/index.md#golden-component-set) in the canonical McKinsey palette; fast contract tests retain coverage of other supported palette inputs. A single-component probe is not release evidence.

Run the [evaluation guide](references/evaluation/index.md) on the exact final artifact. Render every slide, review the full montage, inspect every slide at full size, check overflow and sources, and verify the editable file itself. For PowerPoint, verify the canonical generation receipt, compile the hard acceptance manifest, run the exported-PPTX validator, then run the independent visual validator with every exact slide render and the exact generation script. A rejection from any structural, adapter, component, provenance, or visual gate requires a source repair, fresh export, fresh render, and another review. Repeat until the exact candidate is accepted. For dual-format work, validate PowerPoint and Google Slides separately.

Deliver only verified artifacts and state any real limitation.

### Required structural defaults

- Decision trees must have at least three node layers: a root question, substantive decision branches, and terminal conclusions. Root-to-outcome single-level trees are invalid, regardless of available space. Use `tree` with `decision-conclusions`; allocate a full body region and do not invent branches to fill space. If the content has only one decision, choose another composition.
- Compact analytical-slide trackers show the section name only by default. Number strips require explicit selection; full chapter tracker pages remain separate.
- Icon and image trend columns are vertically centered as one content group within the available body frame by default, preserving aligned headings and internal spacing.
- A detached heading and paragraph are still dangling even when linked with semantic tags. Scope, measurement bases and assumptions beside exhibits use a containing `evidence-note` surface with an actual exhibit dependency; deductions use `insight`. Tags must validate visible structure, never excuse its absence.

- Diagnose graph choice in the dot-dash using actual data provenance, available periods and the analytical question. Record chosen encoding, rejected alternative and rationale before approval. Constant-rate extrapolations use endpoint bars, not artificial line trajectories. Assumptions and chart restatements are not insights; put essential method in source notes and reserve the secondary insight for a derived consequence. See the mandatory chart-choice diagnosis in Storylining and the evidence-based chart router.

- Executive summaries use substantive headings, evidence-dense developed arguments and an actual recommendation. Never print chapter numbers or navigation labels as summary headings. Store semantic theme-to-body mapping in the plan; themes may consolidate related chapters. A generic instruction to compare or verify is not the recommendation.
