# Pre-Authoring Deck Contract

This file owns the machine-checkable handoff between story planning and slide production. [`dot-dash.md`](dot-dash.md) owns the narrative blueprint and approval logic; this contract proves that the complete slide sequence, required structural states, tracker behavior, analytical-header range, density mode, and slide-level support have been resolved before production begins. Validate the contract with [`scripts/validate_deck_contract.py`](../../scripts/validate_deck_contract.py).

## Choose the workflow mode

Use `new_deck` when no editable source deck exists or when the owner has authorized a structural rebuild. The selected template and delivery mode determine which opening states are mandatory. Do not create the first slide document, ghost deck, layout, or exhibit until the complete dot-dash is approved, compiled into the contract, and the validator succeeds.

Use `existing_deck_revision` when modifying an existing editable deck without authorization to rebuild its architecture. Before the first mutation, inspect the complete deck and compile an as-is dot-dash with exactly one sequenced dot for every existing slide. The contract must enumerate the source deck slide-for-slide, including weak, redundant, or structurally missing states. Do not force a new executive summary, contents page, chapter transition, or other structural page into the deck merely because a new-deck template would require it. If the existing deck lacks an executive summary, record a specific `add_executive_summary` recommendation with status `recommended_not_forced`; implement it only when the requested scope or later owner approval authorizes the structural change.

If an existing-deck revision later receives approval for a structural rebuild, preserve the as-is contract as evidence, switch to `new_deck`, create and approve the target dot-dash, and validate a separate target contract before rebuilding.

## Contract fields

Preserve the contract as JSON with these top-level fields:

- `schemaVersion`: `1`;
- `workflowMode`: `new_deck` or `existing_deck_revision`;
- `templateId`: the selected template filename without `.md`, or `custom`;
- `deliveryMode`: the resolved delivery context, such as `executive_pre_read`, `executive_presentation`, `live_pitch`, `live_monthly_update`, or `analytical_appendix`;
- `plannedSlideCount`: the exact number of enumerated slide records;
- `sourceSlideCount`: required in `existing_deck_revision` and equal to the complete source deck count;
- `chapters`: ordered records with unique `id` and exact approved `label`;
- `executiveSummaryDecision`: `status` plus a non-empty `rationale`;
- `structuralRecommendations`: explicit recommendations that are not authorized mutations;
- `tracker`: the selected system, contents and transition page numbers, and analytical-header contract;
- `approval`: proof that a new-deck dot-dash is approved or that an existing-deck as-is dot-dash is complete;
- `slides`: one record per slide in exact order.

Each slide record contains `slide`, `dotId`, `pageType`, `title`, `communicationJob`, `chapterId`, `hypothesisIds`, `dashes`, `evidenceRegions`, `terminalSurfacePosition`, `headerVariant`, and `trackerLabel`. Use `NAV` in `hypothesisIds` for a purely structural page. `chapterId` and `trackerLabel` may be null only when the page does not belong to a chapter or its registered header variant does not expose a tracker label. Use `densityException` only when a new executive pre-read analytical page deliberately uses fewer than two or more than four evidence regions; name why that composition is stronger for the communication job.

## New-deck structural enforcement

For a new `commercial-due-diligence` deck, slides 1–3 are `cover`, `executive_synthesis`, and `contents_tracker`. For a new multi-chapter `project-progress-update` in `executive_pre_read` mode, apply the same sequence. For a new multi-chapter `custom` executive pre-read, apply the same default. `startup-pitch-deck` does not force an executive summary or contents page: its contract may use `not_required` when the live investment story is stronger without them.

For every required executive-synthesis page, use `required_present` and render the visible structural label `Executive summary` under the owning slide-type guidance. For a new deck where an executive summary is not required, use `present` when one is deliberately included or `not_required` with a communication-job rationale when omitted.

The contract also proves that:

- slide numbers are sequential and reconcile exactly to `plannedSlideCount`;
- every slide has one dot, at least one substantive dash, a communication job, and a hypothesis or `NAV` mapping;
- every declared chapter and tracker page refers to a real slide;
- every analytical slide governed by the tracked header variant contains both the tracker-label and action-title fields, uses the exact chapter label, and appears in the declared governed range;
- new executive pre-read analytical pages normally use two to four mutually supporting evidence regions and place any terminal action surface at the bottom after the evidence;
- structural exceptions are explicit rather than inferred from absent pages or blank fields.

## Existing-deck enforcement

The existing-deck contract is an inventory and diagnosis, not permission to redesign. It must prove that every source slide was inspected and represented by one as-is dot. It may record current weaknesses, including a missing executive summary, weak tracker system, incomplete evidence, or inconsistent header grammar, without failing merely because those weaknesses exist outside the authorized scope.

When the source deck has no `executive_synthesis` page, set `executiveSummaryDecision.status` to `missing_recommended` and add a `structuralRecommendations` entry whose `type` is `add_executive_summary`, whose `status` is `recommended_not_forced`, and whose rationale explains the audience benefit. When the page already exists, use `present`. Do not use `not_required` to hide the omission in an existing executive deck.

## Minimal example

```json
{
  "schemaVersion": 1,
  "workflowMode": "new_deck",
  "templateId": "commercial-due-diligence",
  "deliveryMode": "executive_pre_read",
  "plannedSlideCount": 4,
  "chapters": [{"id": "market", "label": "Market attractiveness"}],
  "executiveSummaryDecision": {"status": "required_present", "rationale": "The investment committee needs the answer before the evidence."},
  "structuralRecommendations": [],
  "tracker": {
    "system": "segmented_full_state",
    "contentsSlide": 3,
    "transitionSlides": [],
    "analyticalHeader": {"variant": "tracked", "governedSlides": [4], "requiredFields": ["tracker-label", "action-title"]}
  },
  "approval": {"dotDashApproved": true, "reviewArtifact": "story/dot-dash.md"},
  "slides": [
    {"slide": 1, "dotId": "D01", "pageType": "cover", "title": "Target commercial diligence", "communicationJob": "Identify the decision document", "chapterId": null, "hypothesisIds": ["NAV"], "dashes": ["State target, audience, scope, and cutoff"], "evidenceRegions": 0, "terminalSurfacePosition": "none", "headerVariant": "structural", "trackerLabel": null},
    {"slide": 2, "dotId": "D02", "pageType": "executive_synthesis", "title": "Proceed only if retention and unit economics clear the investment threshold", "communicationJob": "State the answer and governing conditions", "chapterId": null, "hypothesisIds": ["H1", "H2"], "dashes": ["Synthesize the decisive evidence and unresolved gates"], "evidenceRegions": 3, "terminalSurfacePosition": "bottom", "headerVariant": "structural", "trackerLabel": null},
    {"slide": 3, "dotId": "D03", "pageType": "contents_tracker", "title": "The diligence tests market quality before plan credibility", "communicationJob": "Orient the committee to the analytical sequence", "chapterId": null, "hypothesisIds": ["NAV"], "dashes": ["Show the complete approved chapter sequence"], "evidenceRegions": 1, "terminalSurfacePosition": "none", "headerVariant": "structural", "trackerLabel": null},
    {"slide": 4, "dotId": "D04", "pageType": "analytical", "title": "Reachable demand supports the base case only in the enterprise segment", "communicationJob": "Test market attractiveness", "chapterId": "market", "hypothesisIds": ["H1.1"], "dashes": ["Triangulate reachable demand", "Show the enterprise concentration", "State the investment implication"], "evidenceRegions": 3, "terminalSurfacePosition": "bottom", "headerVariant": "tracked", "trackerLabel": "Market attractiveness"}
  ]
}
```

## Gate

Run `python scripts/validate_deck_contract.py path/to/deck-contract.json`. Preserve the successful validator output with the project evidence. For `new_deck`, success must predate slide-document creation. For `existing_deck_revision`, success must predate the first mutation. Revalidate after any approved change to the thesis, page count, sequence, chapter map, tracker state, analytical-header range, or slide communication job.
