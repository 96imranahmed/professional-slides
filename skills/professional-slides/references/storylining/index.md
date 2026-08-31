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

Use the [hypothesis tree](hypothesis-tree.md) to split the main question into distinct tests. Explain why each branch matters and how the branches combine into the decision.

Keep only branches that could change the conclusion.

## Choose the narrative arc

Use the simplest arc that fits:

- answer, proof, decision;
- situation, complication, resolution;
- problem, solution, evidence, ask;
- baseline, variance, cause, action;
- question, tests, synthesis, recommendation.

## Write and approve the dot-dash

Use [dot-dash.md](dot-dash.md).

For a new multi-chapter deck, group dots under the same parent and chapter IDs used by navigation. The [grounded worked example](dot-dash-example.md) shows the complete parallel structure from cover through close.

For a new deck, represent every planned slide in production order and obtain owner approval before any slide document is created.

For an existing-deck revision, create an as-is inventory with one dot per source slide before editing. Owner approval of the as-is inventory is not a prerequisite for a faithful change. Obtain approval only when the target story changes.

## Build the storyboard

For each slide record:

- communication job;
- action title;
- decisive evidence;
- exhibit form;
- source or evidence gap;
- decision implication;
- hypothesis branch;
- navigation state when used.

Do not prescribe decorative layout details here.

## Keep hierarchical trackers parallel

When navigation materially improves orientation, model it as one hierarchy rather than unrelated tracker pages:

1. The parent tracker is the deck-level chapter map. Its IDs, labels, and order equal the dot-dash section groups.
2. Each parent may own one chapter tracker containing the analytical subgroups inside that chapter. Its IDs, labels, order, and governed slide ranges equal the dot-dash subgroups.
3. The contents page shows the full parent tracker. A chapter transition repeats that parent state and may preview only its own chapter tracker. Analytical pages keep the parent label and the active chapter item visible through one consistent header variant.
4. Cover, executive summary, and close remain untracked unless an authorized reference requires otherwise.

Do not create a parent or chapter tracker that has no matching dot-dash group. Do not rename, reorder, skip, or intermittently display an approved tracker item during authoring. If the title spine already provides sufficient orientation, declare `tracker.system` as `none` instead.

## Write the title spine

Read the titles alone. They should form a clear executive memo. Each title states a conclusion or action and is supported by its page.

Remove repeated claims, topic labels, and unsupported certainty.

## Validate the handoff

Compile the approved story into the [pre-authoring contract](pre-authoring-contract.md) and validate it before production or the first authorized structural mutation.

## Narrative QA

Check:

- one governing answer;
- distinct and complete branches;
- one job per slide;
- every slide earns its place;
- evidence supports the title;
- uncertainty is explicit;
- the executive summary and close agree;
- navigation, when used, follows the story.
