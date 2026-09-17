# Composition

Composition is an open tree, not a catalogue of page silhouettes. Start from the approved title, list the content items the page needs, and choose the smallest tree that makes their relationships legible. Each item declares its semantic job, registered component, content, relationship to its peers and relative weight.

The executable contract is `runtime/core.mjs`; the content-to-composition planner is `runtime/planner.mjs`.

## Primitives

| Primitive | Use | Behaviour |
| --- | --- | --- |
| row flow | peer comparison, sequence, dominant exhibit plus rail | fractional, fixed, fill and content-hugging widths |
| column flow | title/body/source shell, stacked reasoning | deterministic heights and named gaps |
| grid | four or more peers, repeated modules, matrices | explicit tracks, cells and spans |
| overlay | annotations and labels over a common plot or image | controlled stacking on shared coordinates |
| absolute | page chrome or geometry that is part of the meaning | every child declares its frame |
| section | optional semantic grouping | owns heading, treatment, padding and a nested tree |
| component | reusable visual and semantic unit | owns internal geometry and token consumption |

A section may contain any other composition, including more sections. A slide may have no sections, one, several peers, a progressive sequence or a layered exhibit. Section names stay content-defined (`market signal`, `implementation risk`, `source basis`) rather than being forced into two universal page regions.

## Selection

`auto` infers the tree when the relationship is unambiguous:

- one item becomes a column flow;
- two or three peers become a row flow;
- four or more peers become a grid;
- layered items become an overlay;
- framed items become an absolute composition;
- an explicit sequence becomes a row flow.

An explicit sequence outranks the peer-count rule; framed and layered relationships outrank both, because they declare the coordinate system. Override the selection when reading order, density or a reference design calls for a different relationship, and record the reason in the slide plan.

Row and column plans, including nested sections, declare `gap` as a spacing token - `space.2` for a tight heading-and-body group, `space.4` for peer sections. Choose the gap from the relationship.

## Recipes

| Question | Composition | Required reasoning |
| --- | --- | --- |
| Which option is better under which conditions? | Paired evidence plus synthesis | Comparable basis, decisive difference, the condition that changes the choice |
| Why did the result change? | Trend above drivers | Actual periods, decomposition, interpretation grounded in the decomposition |
| What does this evidence imply? | Evidence beside developed explanation | Mechanism, significance, material qualification |
| Is the recommendation robust? | Decision table plus sensitivity | Explicit criteria, economics, sensitivity, countercase |

Write these as the deck spec describes them: the composition is the shape of the slide's keys, not a call into a second builder. The four heavy shapes have names the composer knows - `shape: "findings-matrix" | "measure-table" | "model-page" | "half-and-half"` - and everything else is the exhibit, the points and the arrangement.

Worked patterns:

- **Map plus comparison.** The map answers *where* using verified locations; an adjacent table answers *why it matters* using the same option IDs and labels in the same order.
- **Detail linked to a parent set.** Reuse the parent's IDs and order in the detail exhibit, and align the columns that change the choice.
- **Observation plus scenario.** Compare matched attributes and observed values in one exhibit, then use a separate, explicitly assumed scenario for the derived cash or capacity implication, attached to the calculation.
- **Recommendation plus trade-offs.** Show the qualifying alternatives, the evidence favouring each, and the condition that reverses the choice.

## Synthesis variations

| Reading task | Composition |
| --- | --- |
| Develop a connected case | Column of claims, each with its own nested proof or options |
| Pair short themes with developed evidence | Column of rows with a consistent label track and a flexible body track |
| Compare independent domains | Row or grid of peer sections with comparable heading and body anchors |
| Explain situation, outlook and response | Explicit sequence of nested sections, with the condition linking response to outlook |
| Summarize a diagnostic | One qualitative matrix, chart or coordinated exhibit with an answer title and its qualifiers |
| Compare conditional choices | Shared-criteria table or aligned option groups, decisive condition attached to each choice |
| Relate benefits, investment and requirements | Grouped rows with separate measures and visible dependencies |
| Organize discussion or teaching | Questions, alternatives or concepts in the order the session needs |

A theme-and-evidence composition is conceptually `column(row(label, body), row(label, body))`; a nested case is `column(claim, column(proof, options))`. Keep each claim and its dependent material in the same semantic group, and use declared tracks, padding and gaps for indentation.

Split a synthesis at a logical branch or exhibit boundary when the measured content needs more room. Each claim keeps its decisive evidence and condition, the continuation carries the same hierarchy, and only the labels, units and keys needed to read that page are repeated.

## Before compiling

- the action title states the answer;
- every item has one explicit job;
- the selected component matches the item's content and comparison;
- chart annotations are serialized in the chart props with stable data keys;
- copy fits the declared density, measured at the allocated width;
- required provenance has a source component.

If the items cannot fit while keeping hierarchy and legibility, split the slide.

## Adapter invariant

HTML and PowerPoint consume the same resolved scene. HTML serializes canonical tokens as CSS variables; PowerPoint maps the same tokens to theme slots or resolved native values, converts pixels to inches once, and names every object from its scene ID. Compilation rejects undeclared component token use. A reader-back of the exported file recovers every named object, its frame within one pixel, and the canonical theme.
