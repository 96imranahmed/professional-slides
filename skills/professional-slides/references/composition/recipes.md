# Substantive composition recipes

Choose the analytical relationship before geometry. The executable owner is `runtime/composition-recipes.mjs`. `retrieveRecipes({question,density})` ranks by question type and reading depth. `composeRecipe` accepts supplied exhibits; it never adds facts.

| Question | Composition | Required reasoning |
| --- | --- | --- |
| Which option is better under which conditions? | Paired evidence plus synthesis | Comparable basis, decisive difference, condition that changes the choice |
| Why did the result change? | Trend plus drivers | Actual periods, decomposition, interpretation; do not invent causal attribution |
| What does this evidence imply? | Evidence beside developed explanation | Explain mechanism, significance and material qualification |
| Is the recommendation robust? | Decision table plus sensitivity | Explicit criteria, economics, sensitivity and countercase |

## Dense example and sparse counterexample

`examples/decision-pre-read.json` is a synthetic, editable three-page decision narrative. It combines a comparison, developed explanation and condition rather than devoting a separate slide to each fact. The evidence records explicitly label invented demonstration data; never use these numbers as real-world evidence.

Sparse failure: a page with two prices and a generic “Choose the cheaper option” box cannot establish value. Improvement: show what each price includes, capacity differences, the relevant demand scenario, and the condition under which the premium earns its cost. If those inputs are missing, request/research them or narrow the claim; do not manufacture detail.

Overpacked failure: shrinking a six-column table to make room for a second redundant paragraph. Improvement: preserve readable type, group comparable columns, remove duplicate prose or split a genuinely separate question.

Interpretation can repeat a decisive value to explain its consequence. Visual hierarchy, complete premises and meaningful comparisons determine density; there is no minimum ink coverage or fixed bullet count.

## Predictable variants

Use table `treatment: dimensions` for plain category cells, or explicit typed category-cell `surface: plain`. Table `variant: open` historically describes the header, not every cell; retain this compatibility meaning. Select the new `plain` variant when the entire table should be open. Insight surfaces remain `tonal`, `neutral`, `dotted`, and `primary`; plain prose needs no surface. Inspect registered samples before inventing component options.

## Executable source structures

`runtime/composition-recipes.mjs` provides paired evidence, trend above drivers, decision terms above sensitivity, evidence/explanation, label/prose rows, parallel domains, claim/proof paragraphs and a complete evidence matrix. Supply actual registered exhibits or complete source-backed groups. Detached synthesis is optional; integrated interpretation is valid. These recipes share existing components rather than introducing a parallel renderer.

Use `selectComposition({slide, deckContext, candidates})` to compile at most six proposed arrangements at the requested typography. It returns measured viable candidates, failures and a recommended selection without editing the plan. `evidenceExplanationCandidates()` tests three width allocations against complete prose and exhibit content. Failed fit removes a candidate; blank space remains a ranking diagnostic, not a release failure. Preserve semantic reading order when choosing among viable candidates.


## Choose exhibits from the decision relationship

Select the principal exhibit before drafting supporting prose. Use maps when spatial relationships drive the decision; aligned comparison tables for repeated dimensions; charts for meaningful quantitative differences; and diagrams for sequences or dependencies. A text-led page is valid when reasoning itself is the exhibit: record that reason rather than treating prose as the fallback for an unresolved design.

Compare options on consistent dimensions in the same exhibit rather than disconnected profiles. Place the decisive interpretation next to its marks, location or comparison row. Do not turn every numerical fact into a chart. Preserve complete evidence and actual comparators when retrieving or adapting examples.

Worked composition patterns:
- Map + neighborhood comparison: map supplied verified neighborhood/school/transit locations; use the same option IDs and labels in an adjacent access/amenity/constraint table. Map position answers where; the table answers why it matters. Clearly label office proxies and unmeasured journeys.
- Schools linked to neighborhoods: reuse the neighborhood IDs from the introductory map; align school program, access, outcome basis and family implication columns. Compare within supported reporting systems; do not invent a common score. Put the choice-changing distinction beside the relevant row.
- Housing + budget sensitivity: compare matched dwelling attributes and observed asking rents, then use a separate explicitly assumed household cash scenario. Attach the annual cost implication to the calculation rather than transcribing the chart into prose.
- Recommendation + trade-offs: show qualifying alternatives, the evidence favoring each and the conditions that reverse the choice. The close synthesizes the proof instead of repeating the opening.

Implement these patterns with registered map, table, chart and diagram components through the canonical planner. They are relationships, not fixed slot templates or licenses to fabricate inputs.
