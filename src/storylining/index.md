# Storylining

Storylining turns a brief and evidence base into an answer-first argument before layout begins. This index owns the shared narrative workflow, governing thought, narrative sequence, storyboard, action-title spine, evidence attachment, and narrative QA. [`hypothesis-tree.md`](hypothesis-tree.md) owns problem decomposition and analytical prioritization, [`dot-dash.md`](dot-dash.md) owns the mapped storyline blueprint and ghost-deck handoff, [`pre-authoring-contract.md`](pre-authoring-contract.md) owns the machine-checkable handoff into production, and visual composition belongs to [`design/`](../design/index.md).

## Classify the workflow

Use `new_deck` when creating a deck from a brief or when the owner authorizes a structural rebuild. Use `existing_deck_revision` when an editable source deck exists and the request does not authorize rebuilding its architecture. A new deck follows the selected template's required structural sequence. An existing-deck revision begins with a complete as-is dot-dash that enumerates every source slide, but it does not force an absent executive summary or other new-deck page into the file; recommend the missing state and seek approval before adding it.

## Define the communication job

Resolve the audience, decision or outcome, governing question, evidence state, delivery context, and output platforms. State the job in one sentence:

> By the end, **[audience]** should **[decide / understand / approve / do]** because **[governing thought]**.

For exploratory work, state the exact questions the analysis must resolve instead of forcing a recommendation before the evidence supports one.

## Build the problem logic

Follow [`hypothesis-tree.md`](hypothesis-tree.md) to frame the root question, construct testable MECE branches, record evidence states and dispositions, and prioritize the decision-critical work. Do not form the governing thought from a preferred page sequence or an untested assumption.

## Form the governing thought

Write the shortest defensible answer to the root question after reviewing the prioritized hypothesis tree. It must be specific enough to guide inclusion and exclusion, qualified wherever the evidence is incomplete, and traceable to the supported or explicitly unresolved branches. Do not force a preferred answer by suppressing a contradicted hypothesis or promoting an untested assumption.

Treat the governing thought as the thesis contract for the complete deck. State what is true, why it matters to the audience's decision, and which condition or uncertainty limits the conclusion. The executive synthesis when required or present, chapter conclusions, recommendation, and close must preserve this meaning; they may add evidence or precision but must not silently replace the thesis.

## Choose the narrative arc

Select an arc that matches the decision rather than following a generic agenda:

- context -> tension -> evidence -> recommendation -> action;
- question -> analysis -> answer -> implication;
- current state -> root causes -> future state -> transition;
- options -> criteria -> evaluation -> recommendation;
- investment thesis -> market -> company -> risks -> valuation -> decision.

Create three to five chapters unless the argument genuinely requires another shape. Each chapter should answer a distinct sub-question and make the next chapter necessary.

## Write and approve the dot-dash

For a new deck, follow [`dot-dash.md`](dot-dash.md) to convert the prioritized hypothesis tree into a mapped text-only storyline with one supported dot per planned slide, test the dots as an executive memo, and secure explicit owner approval before any slide document, layout, or exhibit is created. When the runtime supports interactive feedback gathering, use it to present the complete outline, iterate on requested changes, and obtain approval of the revised version.

For an existing-deck revision, write the as-is dot-dash from the inspected source deck before editing: every current slide appears exactly once and weaknesses remain visible rather than being silently repaired in the outline. Owner approval of the as-is inventory is not a prerequisite for a narrow edit, but any proposed change to the argument, page count, sequence, or structural architecture requires an updated target dot-dash and explicit approval before that structural change is made.

Bind every dot to one approved chapter and every chapter to the tracker record in [`components/trackers`](../components/trackers/index.md). The chapter sequence should be visible in the dot-dash before any contents page, heading page, or running label is designed.

## Build the storyboard

Convert the approved dot-dash into one storyboard record per slide. Capture:

- dot ID and mapped hypothesis-tree node or `NAV` status;
- chapter and narrative role;
- action title and primary claim;
- evidence and source state;
- dominant exhibit and intended slide archetype;
- audience implication or decision consequence;
- unresolved question, caveat, or appendix dependency;
- reference layout when a supplied template is being followed.

The storyboard is a working contract, not an audience-facing artifact. It can be a table, outline, or structured object; no repository-specific schema is required. Keep it synchronized with the dot-dash rather than maintaining a second narrative. Use the optional [`ghost-deck handoff`](dot-dash.md#ghost-deck-handoff) when a low-fidelity visual review is needed before production.

## Validate the production handoff

Compile the dot-dash and structural decisions into the [`pre-authoring deck contract`](pre-authoring-contract.md). For a new deck, validate it before slide-document creation. For an existing-deck revision, validate the complete as-is inventory before the first mutation. Revalidate after an approved structural change; the contract is the executable proof that the page sequence reconciles to the story rather than an additional audience-facing document.

## Write the action-title spine

Give every analytical slide one narrative job, one primary claim, and one audience-facing conclusion. Begin with its approved dot, decide what the title must communicate and how it advances the spine, then use the [`copy` guide](../components/copy.md#action-title-wording) to phrase it. Prefer the most decision-relevant supported number, comparison, threshold, segment, or period in the title when it makes the conclusion more precise. The governing claim should answer at least one question:

- What changed?
- Why does it matter?
- What explains it?
- What choice follows?
- What must happen next?

Read only the chapter headlines and action titles in order. They should form a concise executive memo with an explicit beginning, logical progression, and decision-oriented ending.

## Attach evidence and implication

The title states the claim, the exhibit proves or explains it, and the implication tells the audience what follows. Label actual, estimate, forecast, scenario, and illustrative values honestly. State material units, periods, populations, exclusions, calculations, and evidence gaps. Never invent facts, quotes, sources, people, logos, benchmarks, or results.

Use concise on-slide citations and retain fuller provenance in notes or a source ledger. Move essential proof into the core story; use the appendix for method, lookup detail, and supporting analyses rather than unresolved logic.

## Narrative QA

Before layout:

1. pass the [`hypothesis-tree` acceptance check](hypothesis-tree.md#acceptance-check);
2. pass the [`dot-dash` acceptance check](dot-dash.md#acceptance-check);
3. remove dots or slides that repeat a claim or do not change the decision;
4. split dots or slides with two unrelated claims;
5. confirm every claim has evidence or an explicit unresolved state;
6. verify chapter order and transitions by reading the dots and action titles as a memo;
7. confirm every chapter has an exact tracker label and every core slide maps to one active tracker state;
8. for a new deck whose selected template and delivery mode require an executive synthesis, test whether it states the governing thought and faithfully represents the full story; for an existing deck without one, record the recommendation without inserting the page outside the authorized scope;
9. confirm recommendations and the closing decision restate the same thesis with evidence-supported conditions rather than introducing a new answer;
10. validate the pre-authoring contract at the stage required by the workflow mode;
11. confirm additional analysis is likely to change the decision before extending the workplan.

After rendering, repeat the title-spine test and verify that the visual evidence still supports the wording without contradiction or overclaiming.
