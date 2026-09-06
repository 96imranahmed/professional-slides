# Storylining

Storylining turns a brief into an approved slide sequence before production.

## Choose the workflow

- new_deck: build a new story.
- existing_deck_revision: inventory the current story, then approve structural changes.
- slide_revision: handled by the main skill without a new storyline.

## Define the communication job

Write one sentence:

> After this deck, the audience should understand or decide ______ because ______.

Then define the main question and governing answer. If the answer is not yet supported, write it as a hypothesis.

## Build the problem logic

For decisions under uncertainty, use the [hypothesis tree](hypothesis-tree.md) to split the main question into distinct tests. Explain why each branch matters and how the branches combine into the decision.

For explanatory or instructional work, map the concepts and dependencies the audience must understand. Distinguish established mechanisms, illustrative assumptions, and unresolved questions rather than inventing provisional hypotheses for settled teaching material. Explain how the parts answer the communication question and what prerequisite understanding each page supplies.

Prioritize branches that could change the conclusion. Retain every other material branch with an explicit disposition such as appendix, parked, or unresolved.

## Prove the governing answer

Trace each decisive conclusion back through its assumptions to evidence. A sourced input and correct calculation do not validate the model between them. Explain why the chosen drivers, scope, time horizon, and comparison answer the audience's question. Carry constraints identified in one branch into the branches they affect; a cost, capacity, or risk concern cannot disappear from the model used to recommend action.

For modeled outcomes, distinguish an evidence-anchored estimate from a sensitivity or illustrative case. Justify consequential assumptions, reconcile included and excluded resources or obligations, and test whether a plausible alternative reverses the answer. If evidence cannot select a case, state a conditional conclusion or show what the desired outcome requires rather than presenting an arbitrary midpoint as an estimate.

State the decision rule that turns the range into an action, identify whether its thresholds are supplied policy or analyst assumptions, and show when sensitivity changes that action. Carry the qualification into the headline or adjacent decision copy; a conditional model cannot support an unconditional recommendation.

For decisions, compare alternatives on the same decision axis and time horizon. Separate independent choices and sequential approvals; a contingent later action is not a mutually exclusive alternative to today's operating state. Distinguish the audience's requested decision, the authorized approver, and the execution owner when they differ. Do not assume that a board, sponsor, or operating team has another party's decision rights. Bound proposed authority by the work, resources, conditions, and owner actually established. Uncosted work or missing authority remains a further decision, not an implied approval.

## Choose the narrative arc

Choose the arc from the communication job:

- answer, proof, decision for a short, already-framed decision;
- situation, complication, resolution when a changed condition creates the need to act;
- problem, solution, evidence, ask for a proposal or funding request;
- baseline, variance, cause, action for performance diagnosis;
- question, tests, synthesis, recommendation for hypothesis-led analysis.
- concept, mechanism, worked example, limits, application for explanation or teaching; adapt the order to the learner's prerequisites rather than inserting an executive summary or recommendation.

## Write and approve the dot-dash

Use [dot-dash.md](dot-dash.md).

For a new multi-chapter deck, group dots under the same parent and chapter IDs used by navigation. The [grounded worked example](dot-dash.md#grounded-worked-example) shows the complete parallel structure from cover through close.

For a new deck, represent every planned slide in production order and obtain owner approval before any slide document is created.

For an existing-deck revision, create an as-is inventory with one dot per source slide before editing. Owner approval of the as-is inventory is not a prerequisite for a faithful change. Obtain approval only when the target story changes.

## Build the storyboard

For each slide record:

- communication job;
- action title;
- decisive evidence;
- exhibit form;
- source or evidence gap;
- decision implication or learning consequence;
- hypothesis branch or concept dependency;
- navigation state when used.

For analytical slides, apply the [analytical substance check](../components/copy.md#analytical-substance) before selecting the exhibit. Preserve that reasoning in the storyboard so the production handoff contains more than a title and a list of values. Do not prescribe decorative layout details here.

## Keep hierarchical trackers parallel

When navigation materially improves orientation, map parent tracker IDs, labels, and order to the dot-dash section groups, then map chapter-item IDs, labels, order, and governed slide ranges to their analytical subgroups. The [tracker owner](../components/trackers/index.md) controls eligibility, hierarchy, variants, placement, and visibility.

When an executive summary and tracker both exist, map each summary proof branch to the corresponding chapter in the same semantic order and map the overall action to the decision chapter. Branch headings remain evidence-led conclusions, while tracker labels remain short navigation labels; any wording difference must preserve an obvious one-to-one bridge. Do not move from `Operating momentum` in the summary to an unexplained `Growth quality` chapter in the body.

Do not create a tracker item without a matching dot-dash group. Do not rename or reorder an approved item during authoring.

## Write the title spine

Read the titles alone. A decision deck should form a clear executive memo; an explanatory deck should form a coherent account of the subject. Analytical titles state supported conclusions or actions. Explanatory headings may name the mechanism or distinction when a takeaway would overstate the page.

Remove repeated claims, empty topic labels, and unsupported certainty.

## Validate the handoff

Compile the approved story into the [pre-authoring contract](pre-authoring-contract.md) and validate it before production or the first authorized structural mutation.

For a complex decision deck, obtain an independent challenge review of the complete brief, story, evidence ledger and calculation schedules before export when a reviewer is available. Resolve material findings, preserving the initial draft and review trail. In this repository use `evals/scripts/validate_story_plan.py`; keep the communication-job-sensitive rubric and thresholds in that evaluation owner rather than adding a deck-specific checklist. Without an independent reviewer, perform and disclose a separate skeptical review; do not claim independent acceptance.

## Narrative QA

Check:

- one governing answer;
- distinct and complete branches;
- one job per slide;
- every slide earns its place;
- evidence supports the title;
- uncertainty is explicit;
- the governing answer passes the proof and decision tests above;
- the executive summary and close agree;
- navigation, when used, follows the story.

For a teaching brief, test conceptual completeness and dependency order instead of recommendation completeness. The close should enable the promised understanding or application without introducing an unsupported decision.
