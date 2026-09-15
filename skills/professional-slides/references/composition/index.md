# Composition

Composition is an open tree, not a catalogue of page silhouettes. Start from the approved answer-first title and list the necessary content items. Each item states its semantic job, registered component, content, relationship to its peers, and relative weight. Then choose or infer the smallest tree that makes those relationships legible.

The executable contract is [`runtime/core.mjs`](../../runtime/core.mjs), and the content-to-composition planner is [`runtime/planner.mjs`](../../runtime/planner.mjs). Read [`runtime/README.md`](../../runtime/README.md) for the complete pipeline.

## Primitives

| Primitive | Use | Key behavior |
| --- | --- | --- |
| row flow | peer comparison, sequence, dominant exhibit plus rail | deterministic fractional, fixed, fill, and content-hugging widths |
| column flow | title/body/source shell, stacked reasoning, vertical sequence | deterministic heights and named gaps |
| grid | four or more peers, repeated modules, matrices of sections | explicit tracks, cells, and spans |
| overlay | annotations, highlights, labels over a common plot or image | controlled stacking with shared coordinates |
| absolute | page chrome or geometry whose anchors are part of the meaning | every child declares its frame |
| section | optional semantic grouping | owns only heading, treatment, padding, and a nested composition tree |
| component | reusable visual/semantic unit | owns internal geometry and token consumption |

A section may contain any other composition, including more sections. It does not imply a particular semantic role. A slide may have no sections, one section, several peer sections, a progressive sequence, or a layered exhibit. Names such as `market signal`, `implementation risk`, `decision`, and `source basis` remain content-defined rather than being forced into a universal pair of page regions.

## Selection

For exhibit/interpretation splits, declare whether the right follows from the left or supplies related context. Apply the [split-section boundary grammar](../components/guidelines.md#split-section-relationships); the layout does not infer a causal arrow from reading order.

Use `auto` when the relationship can be inferred safely:

- one item becomes a column flow;
- two or three peers become a row flow;
- four or more peers become a grid;
- layered items become an overlay;
- framed items become an absolute composition;
- an explicit sequence becomes a row flow.

Row and column plans, including nested sections, may declare `gap` as a canonical spacing token such as `space.2` for a tight heading/body group. Peer sections default to `space.4`. A hugged section heading reserves its measured lines and any declared rule band; its specimen preferred height must not create invisible padding between the heading and its related body. Numeric gaps and gaps on other layout kinds reject; choose spacing from the relationship rather than tightening every level.

An explicit sequence takes precedence over the peer-count grid rule. Framed and layered relationships retain higher precedence because they declare the required coordinate system.

Override the selection when reading order, density, or a reference design requires a different relationship. Record the reason in the slide plan. A layout must never be selected from a topic label or source-gallery classification alone.

## Shared structure

Titles, sources, footnotes, page numbers, dividers, trackers, and other recurring objects are components in the same registry. Deck code reuses their component IDs and canonical tokens. The renderer never recreates these objects with slide-local values.

Data-driven components accept arbitrary-length collections. Trend rows, initiative rollouts, organization levels, wave roadmaps, tables, and content rails derive their internal tracks from the supplied items; they do not encode fixed evidence or synthesis regions.

For an [executive synthesis](../components/copy.md#executive-summary-narrative), declare the relationship and reading order explicitly. A column of developed claims is a useful default for a connected argument; peer columns, nested rows or an evidence-bearing exhibit may better express another relationship. Item count alone must not select the summary's geometry. Keep an action or condition with its supporting argument; add a detached close only when it contributes distinct meaning.

## Synthesis variation selector

These are composition choices, not new slide types or runtime variants. Reuse registered text, chart, table and relationship components inside the existing tree. The synthesis scope and sequence belong to the [story plan](../storylining/pre-authoring-contract.md).

| Reading task | Composition using existing primitives | Avoid |
| --- | --- | --- |
| Develop a connected case | Column of claims, each with its own nested proof or options | Flattening subordinate evidence into peer claims; padding each claim to a fixed bullet count |
| Pair short themes with developed evidence | Column of rows, each with a consistent label track and a flexible body track | Independent label and body lists whose wrapping breaks the association |
| Compare independent domains | Row or grid of peer sections with comparable heading and body anchors | Implying causality or sequence merely because columns read left to right |
| Explain situation, outlook and response | Explicit sequence of nested sections; preserve the condition linking response to outlook | Treating sequential stages as interchangeable peers or drawing an unsupported causal arrow |
| Summarize a diagnostic or several impact dimensions | One qualitative matrix, chart or coordinated exhibit with an answer title and necessary qualifiers | Adding paragraph branches solely to qualify the exhibit as a summary; inventing numeric maturity scores |
| Compare conditional choices | Shared-criteria table or aligned option groups, with the decisive condition attached to each choice | Promoting an explored alternative to an approved decision; relegating the condition to a distant footer |
| Relate benefits, investment and requirements | Grouped rows or sections with separate measures and visible dependencies | Summing annual benefits with one-off costs or making execution requirements look like additional benefits |
| Organize discussion or teaching | Questions, alternatives or concepts in the order needed for the session | Inventing a recommendation or approval request to fill a closing region |

For example, a theme/evidence composition is conceptually `column(row(label, body), row(label, body))`; a nested case is `column(claim, column(proof, options))`. These sketches describe trees, not serialized API shorthand. Keep each claim and its dependent material in the same semantic group. Use declared tracks, padding and gaps for indentation and alignment; do not insert spaces into text or create a card for every nesting level.

Split a synthesis at a logical branch or exhibit boundary when actual measured content cannot fit. Preserve each claim with its decisive evidence and condition, carry a shared hierarchy into the continuation, and repeat only the labels, units or keys needed to interpret that page. A synthesis sequence may interleave narrative and exhibits; it need not use identical slide templates. Do not shrink local type or truncate a branch to preserve a one-page silhouette.

## Content preparation

Pass the [analytical substance check](../components/copy.md#analytical-substance) before allocating regions. Size the exhibit and interpretation from the supported argument; a preset chart-and-rail split must not determine how much reasoning the author supplies.

Before composition, verify that:

- the action title states the answer;
- every item has one explicit job;
- the selected component matches the item’s content and comparison;
- the [annotation decision](../components/chart-callouts.md#authoring-decision) is serialized in chart props with stable data keys;
- generic labels and decorative containers have been removed;
- copy fits the declared delivery density;
- required provenance has a source component.

If the items cannot fit without weakening hierarchy or legibility, split the slide. Do not reduce type, invent extra labels, or force unrelated items into a familiar silhouette.

## Adapter invariant

Both HTML and PowerPoint consume the same resolved scene. HTML serializes canonical tokens as CSS variables. PowerPoint maps those same tokens to theme slots or resolved native values, converts pixels to inches once, and names every object from the scene ID. Compilation rejects undeclared component token use. Artifact Tool imports the final PPTX as an observer and must recover every named object, its frame within one pixel, and the canonical theme.

## Golden component set

`npm run golden` (also `npm run validate:runtime`) regenerates one canonical McKinsey PowerPoint. Every run includes each registered component, every registered variant, layout stress fixtures, and all standard reference compositions. Compatible variants share paginated grid boards; dense or full-frame variants stay isolated. Coverage remains instance-level, so combining slides cannot hide a missing default or non-default branch. Registry additions enter the set automatically. Variants declare representative props, preferred fixture size, and any required backdrop; do not hide a new rendering branch outside that contract.

Each slide is rendered independently as HTML and from the saved editable PPTX. Acceptance requires token/theme agreement, Artifact Tool import and geometry readback, no unexpected overlaps or text overflow, and image-parity thresholds. Component and chart thresholds also apply to their variant fixtures. Standard compositions exercise the same components in context.

Accepted runs are retained under `output/golden/runs/`. `output/golden/index.html` orders the review from standard compositions through layout examples to component families, pairs the HTML and PowerPoint images, and links the McKinsey deck. Its manifest binds source hashes, complete coverage, candidate hashes, and report hashes. `npm run golden:check` rejects stale or altered evidence. A failed run does not replace the previous accepted set. Never claim that an older accepted set validates changed sources.


### Review density within the composition family

Compare content-start anchors within a coherent composition family. A full-height chart, a compact chart with a measured insight, and a vertically centered icon row need not start at the same vertical position. Honor explicit user centering requirements. Both visual and consistency reviews must identify missing reasoning, an incomplete component, illegibility, or unexplained drift within a repeated family before rejecting density. Outer whitespace alone is not evidence of incompleteness; adding filler or inflating insight panels does not fix it.
