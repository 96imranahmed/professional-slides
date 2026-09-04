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

Use `auto` when the relationship can be inferred safely:

- one item becomes a column flow;
- two or three peers become a row flow;
- four or more peers become a grid;
- layered items become an overlay;
- framed items become an absolute composition;
- an explicit sequence becomes a row flow.

An explicit sequence takes precedence over the peer-count grid rule. Framed and layered relationships retain higher precedence because they declare the required coordinate system.

Override the selection when reading order, density, or a reference design requires a different relationship. Record the reason in the slide plan. A layout must never be selected from a topic label or source-gallery classification alone.

## Shared structure

Titles, sources, footnotes, page numbers, dividers, trackers, and other recurring objects are components in the same registry. Deck code reuses their component IDs and canonical tokens. The renderer never recreates these objects with slide-local values.

Data-driven components accept arbitrary-length collections. Trend rows, initiative rollouts, organization levels, wave roadmaps, tables, and content rails derive their internal tracks from the supplied items; they do not encode fixed evidence or synthesis regions.

## Content preparation

Before composition, verify that:

- the action title states the answer;
- every item has one explicit job;
- the selected component matches the item’s content and comparison;
- annotations identify stable data keys;
- generic labels and decorative containers have been removed;
- copy fits the declared delivery density;
- required provenance has a source component.

If the items cannot fit without weakening hierarchy or legibility, split the slide. Do not reduce type, invent extra labels, or force unrelated items into a familiar silhouette.

## Adapter invariant

Both HTML and PowerPoint consume the same resolved scene. HTML serializes canonical tokens as CSS variables. PowerPoint maps those same tokens to theme slots or resolved native values, converts pixels to inches once, and names every object from the scene ID. Compilation rejects undeclared component token use. Artifact Tool imports the final PPTX as an observer and must recover every named object, its frame within one pixel, and the canonical theme.

## Golden component set

`npm run golden` (also `npm run validate:runtime`) regenerates a PowerPoint for each of `mckinsey`, `bcg`, and `bain`. Every run includes each registered component, every registered variant, layout stress fixtures, and all standard reference compositions. Registry additions enter the set automatically. Variants declare representative props, preferred fixture size, and any required backdrop; do not hide a new rendering branch outside that contract.

Each slide is rendered independently as HTML and from the saved editable PPTX. Acceptance requires token/theme agreement, Artifact Tool import and geometry readback, no unexpected overlaps or text overflow, and image-parity thresholds. Component and chart thresholds also apply to their variant fixtures. Standard compositions exercise the same components in context.

Accepted runs are retained under `output/golden/runs/`. `output/golden/index.html` pairs the HTML and PowerPoint images and links the three decks. Its manifest binds source hashes, complete coverage, candidate hashes, and report hashes. `npm run golden:check` rejects stale or altered evidence. A failed run does not replace the previous accepted set. Never claim that an older accepted set validates changed sources.
