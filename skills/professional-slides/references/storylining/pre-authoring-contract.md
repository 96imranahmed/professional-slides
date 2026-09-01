# Pre-Authoring Deck Contract

The contract turns the approved story into a small reviewable handoff. The required fields and gate below are authoritative.

## Workflow mode

Use one mode:

- new_deck;
- existing_deck_revision.

slide_revision does not use this contract unless the task is reclassified.

## Required fields

Record:

- version and workflow mode;
- template ID or none;
- main question and governing answer;
- slide count and ordered slide records;
- each slide's type, title, job, hypothesis branch, and source role;
- tracker system, contents slide, transition slides, labels, and analytical-header range;
- for a hierarchical tracker, parent items, chapter trackers, governed slides, and each analytical slide's parent and chapter item IDs;
- required opening and closing states;
- theme manifest and deck treatment ledger paths;
- approval evidence;
- validation timing.

Use tracker.system none when no visible tracker is needed. In that state, contents and transition slides are empty, and the analytical header is untracked.

Copy each slide record's `title` verbatim from its approved dot. The slide's job remains separate planning metadata; it does not replace or paraphrase the dot.

Use tracker.system hierarchical-segmented when the approved dot-dash contains deck-level sections and analytical subgroups that both need visible orientation. Record `parentItems` in section order and one entry in `chapterTrackers` for each parent. Every parent and chapter item must map to the exact approved dot-dash ID, label, order, and contiguous governed-slide range. Each governed analytical slide records `trackerParentId` and `trackerChapterId`; the tracked header requires `parent-tracker-label`, `chapter-tracker-label`, and `action-title`.

When a visible tracker is approved, record `fullStateVariant`, `compactStateVariant`, and `transitionVariant`. Use `none` for an unused state. The allowed constructions and their HTML references live in [Trackers and Navigation](../components/trackers/index.md). A contents progress page also records the selected item ID; a hierarchical progress page records both the parent ID and selected child ID.

## New deck

The contract must cover every approved dot and all required structural pages. It must validate before any slide document is created.

## Existing deck

The contract must include sourceSlideCount and one record for every source slide. Record a missing executive summary as recommended_not_forced. Do not force a new executive summary, contents page, or tracker outside the authorized scope.

The as-is contract validates before the first mutation. Revalidate after an approved structural change.

## Gate

Before production, confirm that every required field is present, slide counts reconcile, every approved dot maps to exactly one slide record, tracker labels and ranges are internally consistent, every full tracker state contains the complete approved item set, the theme manifest and treatment ledger cover every slide, the executive-summary disposition matches the workflow, and approval evidence points to the reviewed dot-dash.

Do not begin production while any check fails. Preserve the approved dot-dash and the completed contract with the run evidence. Repository evaluations may additionally run a deterministic validator, but normal skill use does not require a packaged script.
