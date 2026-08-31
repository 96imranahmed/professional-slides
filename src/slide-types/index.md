# Slide Types

Choose a slide in two passes. First select exactly one narrative archetype from the job the audience must perform. Then select exactly one composition variant from [evidence compositions](evidence-compositions.md), using `single evidence field` as the default when no sectioning is needed. Media count does not define a slide type: a page with two charts, four charts, or a chart and map still inherits one narrative archetype.

Theme tokens, component treatments, platform APIs, and master/layout mechanics are handled elsewhere. The archetypes below are mutually exclusive narrative contracts, not rigid visual templates.

## Narrative-archetype router

| Primary audience job | Archetype | Boundary |
| --- | --- | --- |
| Understand the whole answer and its sufficient supporting logic | [Executive synthesis](executive-synthesis.md) | summarizes the answer; it does not operationalize owners and timing |
| Understand how one problem, outcome, or system breaks into parts | [Decomposition](decomposition.md) | organizes a whole; it does not compare alternatives or encode sequence |
| Verify a conclusion from quantitative evidence that remains interpretable with minimal prose | [Chart-led insight](chart-led-insight.md) | the exhibit system carries the proof; media count is only a composition choice |
| Follow qualitative reasoning and see its distinct consequence | [Text-led implication](text-led-implication.md) | no quantitative exhibit is required to establish the reasoning |
| Understand a verbal mechanism or qualification that is necessary before quantitative evidence can be interpreted | [Argument with chart](argument-with-chart.md) | the argument and evidence are jointly necessary; the chart cannot carry the page alone |
| Choose among alternatives, scenarios, entities, or states on a common basis | [Comparison and options](comparison-options.md) | evaluates peers; it does not decompose one whole or show a time sequence |
| Understand order, phases, dependencies, handoffs, or operating flow | [Process and roadmap](process-roadmap.md) | sequence is primary; named accountability and approval are not the main message |
| Commit to a decision and translate it into owners, milestones, value, and immediate action | [Recommendation and action plan](recommendation-action-plan.md) | accountability is primary; sequence may be subordinate but does not define the page |

Title, section-divider, agenda, and appendix-divider slides are cross-deck components; read [components](../components/index.md).

## Composition-variant router

Choose exactly one of these after selecting the narrative archetype:

| Evidence structure | Composition |
| --- | --- |
| one exhibit answers the evidence question | [Single evidence field](evidence-compositions.md#single-evidence-field) |
| two to four peer exhibits answer the same question | [Parallel evidence field](evidence-compositions.md#parallel-evidence-field) |
| peer exhibits establish the pattern and a separate region synthesizes its consequence | [Parallel evidence with synthesis](evidence-compositions.md#parallel-evidence-with-synthesis) |
| two or three non-peer sections build the proof through a deliberate sequence or level change | [Progressive evidence path](evidence-compositions.md#progressive-evidence-path) |

A section may be decomposed once into comparable child panels under the [nested-section contract](evidence-compositions.md#nested-section-decomposition). Do not create a new archetype for a chart count, grid, rail, map, table, or source-template silhouette.

## Specialized composition profiles

These profiles provide additional geometry for recurring page forms without creating overlapping narrative archetypes. Select the parent archetype first, then read the profile only when its visual job applies.

| Recurring page form | Profile | Parent archetype boundary |
| --- | --- | --- |
| one to three headline values | [Metric page](metric-page.md) | normally `chart-led insight`; use `executive synthesis` only when the values summarize several branches |
| three to five icon-led categories | [Category overview](category-overview.md) | inherits `decomposition` when the categories are parts of one whole or `comparison and options` when they are peers being evaluated |
| entity map with logos, bubbles, or capability bands | [Market landscape](market-landscape.md) | inherits `chart-led insight`, `comparison and options`, or `decomposition` according to the analytical question |
| milestone, workstream, completeness, and risk status | [Project status](project-status.md) | inherits `process and roadmap`, `comparison and options`, or `recommendation and action plan` according to whether sequence, assessment, or accountability dominates |

Do not treat a specialized profile as permission to add a second action title, second callout, decorative card grid, or unowned colour system. Its complete page still follows one parent narrative contract and one evidence composition.

## MECE selection tests

- If the exhibit remains the argument after explanatory prose is removed, select `chart-led insight`; if the prose supplies a mechanism or qualification without which the exhibit is incomplete, select `argument with chart`.
- If the slide classifies parts of one whole, select `decomposition`; if it evaluates peers against common criteria, select `comparison and options`.
- If time or dependency is the primary relationship, select `process and roadmap`; if the primary requirement is who will do what by when and what approval is needed, select `recommendation and action plan`.
- If the page states the complete answer and sufficient reasons, select `executive synthesis`; if it develops one reasoning chain and isolates a consequence, select `text-led implication`.
- If two descriptions still appear valid, identify what the audience must be able to do after a ten-second scan and choose the archetype that owns that action. Do not combine two archetype contracts on one page.

## Universal slide contract

Every analytical slide must preserve the approved [`storyboard contract`](../storylining/index.md#build-the-storyboard) without redefining it. In addition, every archetype requires:

- one dominant evidence structure using exactly one composition variant;
- the selected source exemplar/layout when template-following, chosen through [`design` reference intake](../design/index.md#reference-intake).

Use the selected archetype to render the storyboard's claim, evidence, and implication as one legible vertical argument; do not alter their narrative roles here.

## Diagram and connector alignment

Apply these rules to processes, roadmaps, decompositions, trees, and other connected-node archetypes:

- Establish node centers or edges on the [`design` grid](../design/index.md#canvas-guides-and-grid) before drawing connectors. Derive node padding and peer gaps from the design spacing scale.
- Align peers on the axis that communicates their relationship: horizontal for sequence, vertical for hierarchy, and radial only when a cycle is essential to the claim.
- Use equal inter-node gaps for equal transitions. A larger gap must signal a real phase break, handoff, uncertainty, or elapsed-time difference.
- Create connectors behind nodes, attach them to defined ports, and keep them orthogonal or consistently angled. Do not hand-draw independent segments that separate when nodes move.
- Keep arrowheads, line weights, corner radii, label offsets, and semantic states consistent within the diagram family.
- Place connector labels in reserved whitespace and align them to the transition or connector midpoint. Never route a connector through text, data, or another node.
- For decomposition trees, align each child group with its parent, keep sibling spacing consistent at each depth, and size branches according to logic rather than decorative balance.
- For processes and roadmaps, align gates to the time or stage axis and keep a single direction of travel. Equal-width phases imply schematic—not proportional—duration unless explicitly labeled otherwise.
- If a diagram needs overlapping connectors, more than three visible hierarchy levels, or a smaller text role to fit, simplify it or move detail to the appendix.
