# Deck-Type Templates

This directory owns reusable decision architecture for named deck types. A template defines the audience decision, governing question, default hypothesis branches, chapter spine, tracker contract, evidence obligations, and type-specific completeness tests. It does not own final wording, story proof, slide layouts, visual tokens, components, charts, or platform mechanics.

## Select by the primary decision

Read only one template when the brief clearly matches its primary decision:

- [`commercial-due-diligence.md`](commercial-due-diligence.md) for a buyer, seller, investor, or lender testing market attractiveness, customer quality, competitive position, commercial performance, and plan credibility;
- [`startup-pitch-deck.md`](startup-pitch-deck.md) for investors deciding whether to fund a startup and engage in the next stage of the process;
- [`project-progress-update.md`](project-progress-update.md) for a sponsor, steering committee, board, or public authority deciding whether a major programme remains on track and what intervention is required.

If no template matches, do not force one. Use [`storylining`](../storylining/index.md) directly. If two templates appear relevant, select the one that matches the audience's primary decision and treat the other as a bounded supporting workstream rather than combining two complete chapter systems.

## Instantiation contract

For a new deck, use the selected template to seed a problem-specific hypothesis tree and dot-dash. Before layout, resolve the actual audience and decision, root question, one-sentence governing thought, branch-specific evidence states, exact chapter labels, tracker system, chapter-to-dot mapping, and closing decision. Preserve this instantiated architecture with the storyboard, source ledger, and validated pre-authoring contract. For an existing-deck revision, inventory the current architecture slide-for-slide before editing and treat template gaps as recommendations unless the requested scope or owner approval authorizes a structural rebuild.

Template branches and chapters are defaults, not mandatory page titles or a canned slide count. Merge, split, rename, or omit them only when the brief and evidence justify the change and the final structure remains MECE. Do not copy placeholder claims, invent proof to fill a branch, or treat the template as permission to bypass [`hypothesis-tree`](../storylining/hypothesis-tree.md) and [`dot-dash`](../storylining/dot-dash.md) acceptance.

## Ownership boundary

- [`storylining`](../storylining/index.md) owns the actual governing thought, hypothesis tree, dot-dash, page sequence, transitions, and action-title spine for the assignment.
- [`components/trackers`](../components/trackers/index.md) owns tracker selection, full and compact states, placement, styling, visibility, and QA; the template supplies only the required chapter labels and recommended tracker behavior for the deck type.
- [`slide-types`](../slide-types/index.md) and [`charts`](../charts/index.md) own page and exhibit choices; the template names necessary analytical jobs and routes each job to those canonical owners through direct links. Do not create template-local slide-type codes, aliases, or abbreviated classification tables.
- [`design`](../design/index.md) and [`tools`](../tools/index.md) own visual and platform implementation.

## Acceptance check

- the chosen template matches the audience's primary decision;
- the instantiated governing thought directly answers the template's root question and names material conditions or uncertainty;
- every retained branch has evidence, an explicit unresolved test, or a declared disposition;
- exact chapter labels are frozen before tracker implementation and every core dot maps to one chapter;
- the chapter order accumulates toward the decision rather than cataloguing topics;
- for a new deck whose template and delivery mode require an executive synthesis, it and the closing decision express the same thesis at different levels of evidence and precision; for an existing deck without one, the omission is recorded and recommended without being force-added;
- deviations from the template improve fit to the actual brief and do not create duplicate or uncovered decision branches.
