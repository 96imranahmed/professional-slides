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
- main question and governing answer;
- slide count and ordered slide records;
- each slide's title, job, hypothesis branch, source role, and arbitrary ordered `items`;
- each item's stable ID, semantic job, registered component, content props, relationship to peers, and optional weight, frame, layer, or cell placement;
- each slide's open composition tree, or `auto` when the deterministic planner should select row, column, grid, overlay, or absolute composition from item relationships;
- each chart slide's `exhibitHeadingVariant`, defaulting to `open-underlined`; an alternative must name a registered analytical-header family rule or an approved-reference exception. Also record canonical `legendTreatment`, including `direct-labelled` or `none-not-needed` when applicable;
- a `dominantContentPlan` with 60% to 90% target canvas share and at least two completeness elements when a new executive pre-read has one dominant analytical item;
- for every slide whose job is executive synthesis, the governing answer, two to four substantive section items with a heading, proof, and consequence, and one overall action or condition;
- tracker system, contents slide, transition slides, labels, and analytical-header range;
- for a hierarchical tracker, parent items, chapter trackers, governed slides, and each analytical slide's parent and chapter item IDs;
- required opening and closing states;
- theme manifest and deck treatment ledger paths;
- `assetAuthorizationRecord`: source, permission evidence, permitted use, attribution, stored path, and fallback for each external visual, following [asset authorization](../components/icons-and-logos.md#asset-authorization-record); use an empty array when no external visuals are reused;
- PowerPoint acceptance-manifest path when PPTX is an output;
- approval evidence;
- validation timing.

Use tracker.system none when no tracker is needed. In that state, contents and transition slides are empty, and the analytical header is untracked.

Copy each `title` verbatim from its dot. The job is planning metadata.

Use tracker.system hierarchical-segmented only when deck sections and analytical subgroups both need orientation. Map parent and chapter items to exact approved IDs, labels, order, and contiguous ranges. Governed slides record both IDs; tracked headers require `parent-tracker-label`, `chapter-tracker-label`, and `action-title`.

When a visible tracker is approved, record `fullStateVariant`, `compactStateVariant`, and `transitionVariant`. The native standard is sequential-circles plus compact-number-strip. Use `none` for an unused state. The allowed constructions and their HTML references live in [Trackers and Navigation](../components/trackers/index.md). A contents progress page also records the selected item ID; a hierarchical progress page records both the parent ID and selected child ID.

## New deck

The contract must cover every approved dot and all required structural pages. It must validate before any slide document is created. `custom` is not a template ID or a visual-mode escape hatch; custom visual direction requires explicit approval evidence.

## Existing deck

The contract must include sourceSlideCount and one record for every source slide. Record a missing executive summary as recommended_not_forced. Do not force a new executive summary, contents page, or tracker outside the authorized scope.

Validate before the first mutation and after an approved structural change.

## Gate

Before production, verify all required fields and reconcile slide counts. Each approved dot maps to one slide record. Tracker labels, ranges, and full states are consistent. The theme manifest and treatment ledger cover every slide. Reserve the PowerPoint acceptance manifest when required. Match executive-summary disposition to the workflow. Link approval evidence to the reviewed dot-dash.

An executive synthesis uses the same open item and composition contract as any other slide. Each synthesis section item contains a substantive heading, proof, and consequence; the optional overall action is one registered `insight` item. Generic rhetorical headings such as `Answer`, `Operating proof`, `What holds back a buy`, or `Action` do not satisfy the section contract.

Each analytical slide declares arbitrary items inside one open composition tree. Evidence, interpretation, implication, action, navigation, and source elements are semantic jobs, not fixed regions. Any item may be absent, repeated when the argument requires it, or nested inside a substantive section. Detached slide-level synthesis uses at most one registered `insight` component; attached interpretation uses a chart annotation, label, or another registered component with a declared job. Metrics belong only where their values carry the proof.

Do not begin production while any check fails. Preserve the approved dot-dash and the completed contract with the run evidence. Repository evaluations may additionally run a deterministic validator, but normal skill use does not require a packaged script.
