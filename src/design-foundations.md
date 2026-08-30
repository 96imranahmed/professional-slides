# Design Foundations

This file owns platform-neutral narrative and composition principles. Theme
tokens belong in [`theming/`](theming/index.md), recurring furniture in
[`components.md`](components.md), exhibit-specific rules in
[`charts/`](charts/index.md), and delivery checks in
[`evals/quality-assurance.md`](../evals/quality-assurance.md).

Explicit user direction and an approved reference deck override these defaults.

## Decision and governing thought

Define the communication job before storyboarding:

> By the end, **[audience]** should **[outcome]** because **[governing thought]**.

The governing thought is the shortest defensible answer to the central
question. If the work is exploratory, state the exact questions the analysis
will resolve instead of forcing a recommendation.

Break the governing thought into three to five mutually distinct supporting
claims that are collectively sufficient. Sequence them through an arc suited
to the brief, such as:

- context -> tension -> evidence -> recommendation -> action;
- question -> analysis -> answer -> implication;
- current state -> root causes -> future state -> transition;
- options -> criteria -> evaluation -> recommendation.

An agenda is navigation, not a storyline. Reading only chapter headlines and
slide titles should reveal the argument.

## Slide logic and action titles

Give every analytical slide one narrative job, one primary claim, and one
dominant exhibit. The title states the claim, the exhibit proves or explains
it, and the implication tells the audience what follows. Split slides that
retain two unrelated claims.

Write action titles as complete audience-facing conclusions, not topics or
visual descriptions. Keep them within the theme's designed title zone and use
sentence case unless the approved reference establishes another convention.

A title should answer at least one question:

- What changed?
- Why does it matter?
- What explains it?
- What choice follows?
- What must happen next?

Read all titles in sequence; they should function as a concise executive memo.

## Exhibit and archetype choice

Choose the composition from the narrative job using the
[slide-type router](slide-types/index.md). Use:

- a chart for magnitude, trend, composition, change, or relationship;
- a table for exact lookup or multi-criteria comparison;
- a process for ordered actions, stages, or decisions;
- a tree for decomposition or causality;
- a map only when geography changes the conclusion;
- quotations only when stakeholder voice is evidence.

Select quantitative encodings through the [chart router](charts/index.md).
Do not convert a straightforward list into a decorative diagram, and do not
add an exhibit that merely repeats the title.

## Hierarchy, density, and restraint

Create one obvious first read, one clear second read, and quiet supporting
detail. Build hierarchy in this order:

1. position and scale;
2. whitespace and grouping;
3. typography weight;
4. color emphasis;
5. rules, fills, or enclosures.

Use one dominant visual rather than a dashboard of cards. Align objects to a
small set of shared anchors. Keep live-presentation pages sparse, allow more
evidence in executive pre-reads, and reserve dense methods or lookup material
for the appendix. Change the composition or shorten copy before shrinking type.

Default to flat, editable shapes and restrained color. Avoid decorative
photos, pseudo-UI cards, 3D effects, gradients without meaning, ornamental
icons, and diagrams that do not improve comprehension.

## Writing and evidence

- Lead with the conclusion and support it with specific evidence.
- Keep bullet and column grammar parallel.
- Use active verbs and nouns familiar to the audience.
- Limit indentation to two levels; move paragraphs to notes or the appendix.
- Never expose production instructions or template copy on slides.
- Label actual, estimate, forecast, scenario, and illustrative values honestly.
- State material units, periods, populations, exclusions, and calculations.
- Never invent facts, quotes, sources, people, logos, or results.

Use the canonical [source component](components.md#sources) for visible and
notes-level provenance. Source integrity is verified by the evaluation gates,
not redefined here.
