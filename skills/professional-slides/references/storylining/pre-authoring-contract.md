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
- the mandatory executive-summary slide, its complete approved copy, and a recorded pass of the [standalone argument and evidence test](dot-dash.md#standalone-argument-and-evidence-test);
- an evidence mapping from each decisive claim to its source, actual values or examples, comparator, inference limits, and proof slide IDs;
- slide count and ordered slide records;
- each slide's title, job, hypothesis branch or concept dependency, `sourceRole`, and arbitrary ordered `items`;
- the decisive inference and any assumption or qualification the reader must see, mapped to its visible content item rather than left only in notes;
- each item's stable ID, semantic job, registered component, content props, relationship to peers, and optional weight, frame, layer, or cell placement;
- each slide's open composition tree, or `auto` when the deterministic planner should select row, column, grid, overlay, or absolute composition from item relationships;
- each chart slide's `exhibitHeadingVariant`, using the registered `chart-title` value `underlined` by default, including for inline or stacked units, or `unit` for the explicit borderless unit treatment. Pass this value to `chart-title.props.variant`; chart components use `titleVariant`, and `open-underlined` is a legacy contract alias for `underlined`, not a runtime variant. Also record canonical `legendTreatment`, including `direct-labelled` or `none-not-needed` when applicable;
- a `dominantContentPlan` with 60% to 90% target canvas share and at least two completeness elements when a new executive pre-read has one dominant analytical item;
- for every slide whose job is executive synthesis, an `executiveSynthesis` record containing the governing answer, ordered section items, and optional overall action or condition; its content must satisfy [executive-summary narrative](../components/copy.md#executive-summary-narrative);
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

Use tracker.system hierarchical-segmented only when deck sections and analytical subgroups both need orientation. Map parent and chapter items to exact approved IDs, labels, order, and contiguous ranges. Governed slides record both IDs; tracked headers require `parent-tracker-label`, `chapter-tracker-label`, and `action-title`.

When a visible tracker is approved, record `fullStateVariant`, `compactStateVariant`, and `transitionVariant`. The native standard is sequential-circles plus compact-label showing the section name only. Number strips are explicit opt-in. Use `none` for an unused state. The allowed constructions and their HTML references live in [Trackers and Navigation](../components/trackers/index.md). A contents progress page also records the selected item ID; a hierarchical progress page records both the parent ID and selected child ID.

## New deck

The contract must cover every approved dot and all required structural pages. It must validate before any slide document is created. `custom` is not a template ID or a visual-mode escape hatch; custom visual direction requires explicit approval evidence.

## Existing deck

The initial inventory includes `sourceSlideCount` and one record for every source slide. After an approved structural change, preserve `sourceSlideCount` and record every target slide under `plannedSlideCount`; differing counts require `approval.dotDashApproved: true`. Include a missing executive summary in the target plan for every full-deck revision or recreation. A bounded individual-slide edit does not authorize restructuring the whole deck; flag the missing summary for that broader revision. Contents and trackers remain conditional on the communication need.

Validate before the first mutation and after an approved structural change.

## Gate

Before production, verify all required fields and reconcile slide counts. Each approved dot maps to one slide record. Tracker labels, ranges, and full states are consistent. The theme manifest and treatment ledger cover every slide. Reserve the PowerPoint acceptance manifest when required. Match executive-summary disposition to the workflow. Link approval evidence to the exact reviewed dot-dash table artifact, including its version or hash and slide design plans. Before production, reconcile every section and material layout choice with the planner inputs; an `auto` composition must still satisfy the approved arrangement. Follow the dot-dash owner for material design changes and reapproval.

An executive synthesis uses the same open item and composition contract as any other slide. Validate its serialized fields against [executive-summary narrative](../components/copy.md#executive-summary-narrative) and the [Insight Box owner](../components/insight-box.md).

Each analytical slide declares arbitrary items inside one open composition tree. Evidence, interpretation, implication, action, navigation, and source elements are semantic jobs, not fixed regions. Any item may be absent, repeated when the argument requires it, or nested inside a substantive section. Record each detached or attached interpretation with its registered component and declared job.

Do not begin production while any check fails. Preserve the approved dot-dash and the completed contract with the run evidence. Repository evaluations may additionally run a deterministic validator, but normal skill use does not require a packaged script.

Before export, reconcile the resolved scene's text and exhibits to those visible-content commitments. Check the rendered content bounds, not merely the allocated frames: a short table inside a full-height frame is still a short table. Resolve missing reasoning, oversized gaps, and redundant conclusion surfaces before treating the handoff as implemented.

Read every claim-bearing label against its source, including chart categories and abbreviated annotations. Preserve the source's population, classification, comparator and causal limits; a footnote cannot excuse a stronger visible label. Check the exhibit's arithmetic relationship too: independent comparisons, additive contributions and multiplicative drivers require different constructions.
