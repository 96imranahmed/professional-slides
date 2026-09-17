# Evaluation

A deck is ready when the deterministic page gates pass, the review accepts it, and the exported file renders as intended. Keep generated decks, renders, plans and review reports in one task-owned `output/` directory.

## Page gates

Measured on the rendered page, before any model is consulted. Each is a blocking result.

| Gate | Code | Threshold |
| --- | --- | --- |
| Ink coverage | `INK_COVERAGE` | at least 8% of the content area (10% on a `full` deck, 4% on an `airy` one) |
| Trailing dead band | `DEAD_BAND` | at most 8% (6% full, 14% airy) |
| Internal void | `INTERNAL_VOID` | at most 22% between two content blocks (16% full, 32% airy) |
| Right column stops short | `COLUMN_VOID` | at most 20% of the page, `full` decks only |
| Action title | `TITLE_LINES`, `TITLE_WORDS`, `HEDGED_TITLE` | at most two lines, within 14 words, no hedge lexicon |
| Body type | `TYPE_RANGE` | 10 to 14 pt body, 8 to 11 pt chart furniture, 20 to 26 pt titles |
| Characters per line | `CPL` | 35 to 90 |
| Body words, exhibit page | `WORDS` | at most 100 prose words (`pre-read` 160, `appendix` 200; table cells and chart furniture are evidence, not prose) |
| Hero exhibit, analytical page | `HERO_EXHIBIT` | at least 40% of the content area, carrying ink |
| Layout repetition | `LAYOUT_MONOTONY` | no layout signature on more than 35% of content pages |
| Page families | `PAGE_VARIETY` | at least three families across ten pages or more |
| Measured pages | `EVIDENCE_MIX` | at least 45% of analytical pages carry a chart, a table or measured tiles |
| Photographs | `IMAGE_BUDGET`, `IMAGE_RUN` | at most 30% of analytical pages, never more than two running |
| Argument on a picture or comparison page | `MISSING_ARGUMENT` | an insight, a so-what or a points column |
| One number over a table | `METRIC_STACK` | a lone tile belongs beside its evidence |
| Sections and tracker | `NO_SECTIONS` | required past twelve analytical pages |
| Label punctuation | `DOT_SEPARATOR` | no bullet or middle dot joining two labels |
| Body text floor | `THIN_PAGE` | the deck's `weight.pageWords`, counted in the body alone (95 balanced, 120 full); reference client slides carry 128 body words |
| Notes carrying the page | `NOTE_HEAVY` | the footer stays under a third of the page's text |
| Plan-time shortfall | `THIN_PLAN` | preflight: what the page will carry against the floor, with the remedy its own data offers |
| Chart annotation | `UNANNOTATED` | a bracket, a flag, a change bubble, a base or an observation on any plot of three marks or more |
| Page architecture | `PAGE_SHAPE_FLAT` | at least three distinct page architectures per ten analytical pages, none past 40% (reference decks run about five per ten, commonest 23%) |
| Commentary column | `COLUMN_MONOTONY` | at most three consecutive pages marked with the same device (icon, numbered disc, hairline, prose) |
| Deck shape | `DECK_FLAT` | past eight analytical pages, one page carries the detail: 282+ words, or a p80 a third above the median |
| Commentary column | `THIN_COLUMN`, `POINT_DEPTH` | reaches `weight.columnFill` of its track; points average `weight.pointWords` |
| Marks in the exhibit | `PLOT_SPAN` | marks span `weight.plotSpan` of the exhibit frame (annotated and peer-aligned charts exempt) |
| Table against its budget | `THIN_TABLE` | uses `weight.tableFill` of the page's row budget |
| Values printed | `NUMBERS_ON_MARKS` | every mark while a chart has twelve or fewer, three otherwise |
| Evidence elements | `THIN_EVIDENCE` | `weight.elements` (2 on a document-weight deck) |
| Heading fit | `HEADING_WRAPS` | a heading that wraps where the frame could hold it on one line |
| Numbers printed on the page | `NUMBERS_ON_PAGE` | at least 8 numeric tokens on a measured page (reference client pages carry 17) |
| Axis ticks | `NICE_TICKS` | nice numbers |
| Page did not render | `MISSING_RENDER` | every page the gates are asked to measure has a render |

Two more findings share the shape but fire before the page is rendered, from the composer rather than the gates: `THIN_PLAN` (what the page will carry against its floor, with the remedy that page's own data offers) and `MISSING_EVIDENCE` (a ranked criterion with no comparative exhibit across all options).

`page_gates.GATE_CODES` is the list this table is checked against — a code cannot be renamed in the gates without this table failing, and a gate cannot emit a code that is not in it.

## Review codes

The model review reads each rendered page together with its text, layout roles, mapped evidence and the deck question, and receives that page's gate measurements as inputs. It may block with these codes:

`FACTUAL_ERROR`, `UNSUPPORTED_CLAIM`, `MISLEADING_COMPARISON`, `MISSING_EVIDENCE`, `MISSING_ARGUMENT`, `UNREADABLE`, `OVERFLOW`, `BROKEN_GEOMETRY`, `PROVENANCE`.

Design defects block too, and carry their own codes: `DEAD_SPACE`, `LAYOUT_MONOTONY`, `NO_HERO_EXHIBIT`, `OVERSIZED_TYPE`, `WALL_OF_TEXT`, `BURIED_NUMBER`, `HEDGED_TITLE`, `TITLE_TOO_LONG`, `INCONSISTENT_ENCODING`. `EDITORIAL` is the advisory one.

Every blocking finding names the exact defect and a repair that is a sentence a person can act on. Findings without one of these codes are advisory and settle within the bounded repair pass. `runtime/reviewer.mjs` holds the vocabulary — it is the schema the review is validated against, so a code that is not there cannot be raised — and `rules.json` holds the rule IDs, severities and which of these codes are material.

## Review dimensions

**Story.** The deck answers the brief and has one governing thought. The title spine reads as an executive memo, or as a coherent explanatory progression. Each page has one job and one dominant exhibit, every decisive case maps to visible proof, and the close follows from the evidence. Missing data is explicit and counts as a gap rather than as completed analysis.

**Evidence.** Claims reconcile with their exhibits and sources; facts, estimates and inferences stay distinguishable; charts use the correct scale, units, labels and series; every plotted coordinate encodes a real measure, calculation or named category position; requested annotations appear in the render; focal marks separate from comparators in colour and in greyscale.

**Design.** The exported file and its full-size renders match the declared theme, colour ledger and treatment ledger. The composition fits the evidence and keeps one dominant exhibit, deck rhythm passes separately from style consistency, and labels sit beside the content they name.

**Platform.** The requested editable format opens, native objects stay editable, fonts, charts, tables, notes and sources survive export, and the output directory contains only the requested deliverables.

## Per-deck self-review

1. Render every slide.
2. Review the montage for story, rhythm and repetition.
3. Inspect every slide at full size.
4. Check titles, evidence, sources and uncertainty.
5. Check clipping, overlap, broken assets and unreadable text.
6. Apply the deletion test to every page.

## Comparing against a reference deck

Inspect every source page and every candidate render at full size, record the page mappings including deliberate consolidations and splits, and normalize type size against the source's visible crop. For each exhibit, identify the source's strongest analytical device and show how the candidate preserves or improves its function. Keeping every word and number does not pass when the reader must reconstruct a grouping the source made visible.
