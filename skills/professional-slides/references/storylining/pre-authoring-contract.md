# Pre-Authoring Deck Contract

The contract makes the approved story reviewable.

## Workflow mode

Use one mode:

- new_deck;
- existing_deck_revision.

slide_revision does not use this contract unless the task is reclassified.

## Required fields

Record:

- version and workflow mode;
- template ID: registered ID, or `none` for direct storylining;
- visual-system mode: clean-native-standard, reference-led, or custom-user-directed, with approval evidence for the latter two;
- `mainQuestion` and `governingAnswer`;
- the [argument brief](dot-dash.md#ask-questions-that-sharpen-the-argument): intended audience and outcome, whose criteria apply, decisive priorities and constraints, material answers or unresolved questions, and their effect on the thesis and proof; distinguish supplied context from author assumptions and record when the user requests a general treatment;
- the synthesis disposition under the [communication-job policy](index.md#synthesis-scope-and-requirement), complete approved content for any included summary section, and a recorded pass of the [standalone argument and evidence test](dot-dash.md#standalone-argument-and-evidence-test);
- an evidence mapping from each decisive claim to its source, actual values or examples, comparator, inference limits, and proof slide IDs;
- slide count and ordered slide records;
- each slide's title, job, hypothesis branch or concept dependency, `sourceRole`, and arbitrary ordered `items`;
- the decisive inference and any assumption or qualification the reader must see, mapped to its visible content item rather than left only in notes;
- each item's stable ID, semantic job, registered component, content props, relationship to peers, and optional weight, frame, layer, or cell placement;
- each slide's open composition tree, or `auto` when the deterministic planner should select row, column, grid, overlay, or absolute composition from item relationships;
- each chart slide's `exhibitHeadingVariant`, using the registered `chart-title` value `underlined` by default, including for inline or stacked units, or `unit` for the explicit borderless unit treatment. Pass this value to `chart-title.props.variant`; chart components use `titleVariant`, and `open-underlined` is a legacy contract alias for `underlined`, not a runtime variant. Also record canonical `legendTreatment`, including `direct-labelled` or `none-not-needed` when applicable;
- a `dominantContentPlan` with 60% to 90% target canvas share and at least two completeness elements when a new executive pre-read has one dominant analytical item;
- for every slide whose job is executive synthesis, an `executiveSynthesis` record containing the scoped answer, supporting branches or referenced evidence items, and optional overall action or condition; its content must satisfy [executive-summary narrative](../components/copy.md#executive-summary-narrative);
- tracker system, contents slide, transition slides, labels, and analytical-header range;
- for a hierarchical tracker, parent items, chapter trackers, governed slides, and each analytical slide's parent and chapter item IDs;
- required opening and closing states;
- canonical `themeManifestPath` and `treatmentLedgerPath`, following the [theme manifest](../theming/index.md#theme-manifest);
- `assetAuthorizationRecord`: source, permission evidence, permitted use, attribution, stored path, and fallback for each external visual, following [asset authorization](../components/icons-and-logos.md#asset-authorization-record); use an empty array when no external visuals are reused;
- PowerPoint acceptance-manifest path when PPTX is an output;
- approval evidence;
- validation timing.

Use tracker.system none when no tracker is needed. In that state, contents and transition slides are empty, and the analytical header is untracked.

Copy each `title` verbatim from its dot. The job is planning metadata. Map the approved dot-dash design plan into the same slide's `items` and composition: preserve section order, semantic jobs, component types and variants, arguments, evidence, material props, and peer relationships. Retain the reviewed plan version or hash with approval evidence and a section-to-item mapping so the authoring model receives the complete approved design, not only the title spine. Do not introduce a separate runtime layout schema.

Record source identity and review disposition using [source evidence](source-evidence.md), keeping source-native numbering distinct from target slide IDs.

For source-grounded copy review, serialize the source mapping as optional `copySources` entries with a unique `id`, local `path`, exact `sha256`, and one-based target `slides`. PDF entries also require the exact one-based source `pages`; text, Markdown, CSV, or JSON evidence uses the complete file and omits `pages`. Paths resolve relative to the contract. Supply the relevant source pages or verified evidence packet, not an author-written acceptance rationale. The copy reviewer receives the selected text as grounding context, and its report binds both the source bytes and slide mapping. Image-only PDFs need a verified transcription. This context can substantiate a necessary fact or client deliverable; it does not excuse recap, unsupported inference, or an audience-facing methodology block.

Use tracker.system hierarchical-segmented only when deck sections and analytical subgroups both need orientation. Map parent and chapter items to exact approved IDs, labels, order, and contiguous ranges. Governed slides record both IDs; tracked headers require `parent-tracker-label`, `chapter-tracker-label`, and `action-title`.

When a visible tracker is approved, record `fullStateVariant`, `compactStateVariant`, and `transitionVariant`. The native standard is sequential-circles plus compact-label showing the section name only. Number strips are explicit opt-in. Use `none` for an unused state. The allowed constructions and their HTML references live in [Trackers and Navigation](../components/trackers/index.md). A contents progress page also records the selected item ID; a hierarchical progress page records both the parent ID and selected child ID.

## Synthesis metadata

Use the existing `executiveSummaryDecision` with `status` and `rationale`; optionally record `purpose` as `decision`, `explanation`, `workshop` or `pitch`. A reasoned `not_required` disposition for explanation, workshop or pitch expresses the purpose exception in the storyline policy. A user-required synthesis remains required. Existing source omissions and recommendations remain explicit rather than silently adding pages.

An `executiveSynthesis` contains a non-empty `answer` and either developed `branches` or `itemIds` naming exact items in that slide's open item tree. The branch form retains `heading`, `proof` and `consequence`; there is no fixed branch count. The item form supports an evidence-bearing exhibit or another composition without fabricated prose branches. Include the referenced items in the contract, not only in an external builder. `overallAction` is optional; if present it must be substantive and faithfully emitted. The visible content must preserve the answer and necessary qualifications regardless of representation.

For a multi-page or explicitly scoped synthesis, optionally add `synthesisGroups`. Each record has a unique `id`, `scope` (`deck`, `workstream`, `diagnostic`, `chapter`, `teaching`, `closing`), ordered `slides` using the contract's one-based target slide numbers, a `governingAnswer`, and `decisionStage` (`diagnosis`, `options`, `recommendation`, `endorsement`, `authorization`, `explanation`). Optional `proofSlides` reference the body evidence; optional `conditions` retain material decision-changing qualifications. A group can include supporting exhibits as well as synthesis pages. Source page numbers belong in the source record, not these target references.

These fields describe semantic scope and sequence; they do not create a new slide type, replace the approved dot-dash or dictate a renderer. Existing contracts can omit the optional metadata. When supplied, identifiers and references must reconcile with the actual plan. A group should not be split or padded to satisfy a theme count; qualify its completeness according to the communication job.

## Optional source register

`sourceDocuments` carries reusable provenance independently of `copySources` excerpts. A record uses unique `id`, `format` (`pdf`, `pptx`, `text`), `form`, `accessStatus` (`available`, `inaccessible`, `missing`), `identityStatus` (`verified`, `provisional`, `mismatch`) and `reviewStatus` (`reviewed`, `not-reviewed`, `uncertain`). Available verified files include `path` and exact `sha256`. Preserve title/version, URLs, aliases, parent or companion relationships and limitations in the evidence register described by [source evidence](source-evidence.md).

For page references, record `pageCount` for a PDF or `slideCount` for a native PPTX. Optional `reviewedRanges` use `numbering` (`physical-pdf-page`, `native-slide`), `start` and `end`; they must fit the declared count and format. Printed labels are citation annotations rather than array offsets. Metadata validation cannot establish that a source is authentic or that a declared count matches the file; perform the identity and native-format checks before declaring verification. `copySources` remains the actual source-grounding input to the copy reviewer.

## New deck

The contract must cover every approved dot and all required structural pages. It must validate before any slide document is created. `custom` is not a template ID or a visual-mode escape hatch; custom visual direction requires explicit approval evidence.

## Existing deck

The initial inventory includes `sourceSlideCount` and one record for every source slide. After an approved structural change, preserve `sourceSlideCount` and record every target slide under `plannedSlideCount`; differing counts require `approval.dotDashApproved: true`. Apply the [synthesis policy](index.md#synthesis-scope-and-requirement) to the approved revision scope. A bounded individual-slide edit does not authorize restructuring the whole deck; flag a useful missing synthesis for a broader revision. Contents and trackers remain conditional on the communication need.

Validate before the first mutation and after an approved structural change.

## Gate

Before production, verify all required fields and reconcile slide counts. Each approved dot maps to one slide record. Tracker labels, ranges, and full states are consistent. The theme manifest and treatment ledger cover every slide. Reserve the PowerPoint acceptance manifest when required. Match executive-summary disposition to the workflow. Link approval evidence to the exact reviewed dot-dash table artifact, including its version or hash and slide design plans. Before production, reconcile every section and material layout choice with the planner inputs; an `auto` composition must still satisfy the approved arrangement. Follow the dot-dash owner for material design changes and reapproval.

An executive synthesis uses the same open item and composition contract as any other slide. Validate its serialized fields against [executive-summary narrative](../components/copy.md#executive-summary-narrative) and the [Insight Box owner](../components/insight-box.md).

Each analytical slide declares arbitrary items inside one open composition tree. Evidence, interpretation, implication, action, navigation, and source elements are semantic jobs, not fixed regions. Any item may be absent, repeated when the argument requires it, or nested inside a substantive section. Record each detached or attached interpretation with its registered component and declared job.

Do not begin production while any check fails. Preserve the approved dot-dash and the completed contract with the run evidence. Repository evaluations may additionally run a deterministic validator, but normal skill use does not require a packaged script.

Before export, reconcile the resolved scene's text and exhibits to those visible-content commitments. Check the rendered content bounds, not merely the allocated frames: a short table inside a full-height frame is still a short table. Resolve missing reasoning, oversized gaps, and redundant conclusion surfaces before treating the handoff as implemented.

Read every claim-bearing label against its source, including chart categories and abbreviated annotations. Preserve the source's population, classification, comparator and causal limits; a footnote cannot excuse a stronger visible label. Check the exhibit's arithmetic relationship too: independent comparisons, additive contributions and multiplicative drivers require different constructions.


## Continuity and planning review record

Carry `argument.buildsOn`, `argument.newContribution` and `argument.decisionConsequence` from the dot-dash into the authoritative spec. `context.claimLedger` records primary proof and summary ownership. Existing section/tracker metadata remains the navigation owner. Optional `context.planningReview` records consolidated continuity, repetition, criteria coverage and exhibit findings with their dispositions before export. Do not create a new approval gate or alternative renderer. Legacy specifications remain readable; new planning must supply substantive continuity rather than generic boilerplate.
