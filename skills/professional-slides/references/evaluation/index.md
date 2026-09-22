# Evaluation

A deck is ready when the deterministic page gates pass, the review accepts it, and the exported file renders as intended. Keep generated decks, renders, plans and review reports in one task-owned `output/` directory.

## Page gates

Measured on the rendered page before review. The report records severity. `runtime/gates/page_gates.py` owns the exact advisory-code set. Ink, whitespace, density, exhibit area, label counts and decoration/mix statistics prompt visual review; they do not prescribe furniture. A compact process or centered commentary can be complete, and a line chart can establish its claim through an axis and selected anchors. Keep these diagnostics visible for independent review; their count is not proof of a defect. Schema, title/evidence contradictions, text fit, clipping, collisions, scales and provenance still block. An independent reviewer may reject an actual visual defect even where its numeric diagnostic is advisory.

| Diagnostic or blocking gate | Code | Screen (severity is reported by the runtime) |
| --- | --- | --- |
| Ink coverage | `INK_COVERAGE` | at least 11.5% of the content area (14% on a `full` deck, 5% on an `airy` one) — calibrated on pages with an exhibit, where the reference sample's first quartile is 12.1%. A page with **no** exhibit is held instead to the ink its own word floor produces (0.00052 per word, measured by rendering: 4.4% at the balanced 95-word floor), because a page of type cannot reach 11.5% at any honest length |
| Trailing dead band | `DEAD_BAND` | at most 8% (6% full, 14% airy) |
| Internal void | `INTERNAL_VOID` | at most 22% between two content blocks (16% full, 32% airy) |
| Right column stops short | `COLUMN_VOID` | at most 20% of the page, `full` decks only |
| Action title | `TITLE_LINES`, `TITLE_WORDS` | at most two lines, within 14 words |
| Body type | `TYPE_RANGE` | 10 to 14 pt body, 8 to 11 pt chart furniture, 20 to 26 pt titles |
| Characters per line | `CPL` | 35 to 90 |
| Body words, exhibit page | `WORDS` | the measured body band, 128 prose words (`live-pitch` 77, `pre-read` 179, `appendix` 224). A text page is held to the 1,832-page corpus instead: 196 words, `live-pitch` 127, `pre-read` 282, `appendix` 352. Table cells and chart furniture are evidence, not prose |
| Hero exhibit, analytical page | `HERO_EXHIBIT` | at least 40% of the content area, carrying ink |
| Layout repetition | `LAYOUT_MONOTONY` | no layout signature on more than 35% of content pages |
| Page families | `PAGE_VARIETY` | at least three families across ten pages or more |
| Measured pages | `EVIDENCE_MIX` | at least 45% of analytical pages carry a chart, a table or measured tiles |
| Photographs | `IMAGE_BUDGET`, `IMAGE_RUN` | at most 30% of analytical pages, never more than two running |
| Argument on a picture or comparison page | `MISSING_ARGUMENT` | an insight, a so-what or a points column |
| One number over a table | `METRIC_STACK` | a lone tile belongs beside its evidence |
| Sections and tracker | `NO_SECTIONS` | required past twelve analytical pages |
| Contents page | `NO_CONTENTS` | a sectioned deck past twelve analytical pages says what its sections are |
| Opening summary | `NO_SUMMARY` | the first analytical page declares `role: "executive-summary"` before the first section; the shape preset is optional and metrics do not establish the role |
| Body text floor | `THIN_PAGE` | the deck's `weight.pageWords`, counted in the body alone (95 balanced, 120 full); reference client slides carry 128 body words |
| Notes carrying the page | `NOTE_HEAVY` | the footer stays under a third of the page's text |
| Plan-time shortfall | `THIN_PLAN` | preflight: what the page will carry against the floor, with the remedy its own data offers |
| Chart annotation | `UNANNOTATED` | a bracket, a flag, a change bubble, a base or an observation on any plot of three marks or more |
| Page architecture | `PAGE_SHAPE_FLAT` | at least three distinct evidence relationships per ten analytical pages, none past 40%. Chart/table above two or three commentary columns, with or without an insight strip, counts once; mirrored arrangements also count once. The finding reports `constrainedPages` to locate evidence that needs redesign. Change the relationship when the argument warrants it; adding commentary or furniture does not create a new architecture |
| Commentary column | `COLUMN_MONOTONY` | at most three consecutive pages marked with the same device (icon, numbered disc, hairline, prose) |
| Deck shape | `DECK_FLAT` | past eight analytical pages, one page carries the detail: 282+ words, or a p80 a third above the median |
| Commentary column | `THIN_COLUMN`, `POINT_DEPTH` | reaches `weight.columnFill` of its track; points average `weight.pointWords` |
| Marks in the exhibit | `PLOT_SPAN` | marks span `weight.plotSpan` of the exhibit frame (annotated and peer-aligned charts exempt) |
| Table against its budget | `THIN_TABLE` | uses `weight.tableFill` of the page's row budget |
| Values printed | `NUMBERS_ON_MARKS` | advisory count: every mark while a chart has twelve or fewer, three otherwise; review the values required by the claim against labels, axes and annotations |
| Exhibit multiplicity | `THIN_EVIDENCE` | `weight.elements` (2 on a document-weight page) is a review diagnostic, not a proof quota; a single exhibit or developed bullet synthesis can carry the complete argument |
| Heading fit | `HEADING_WRAPS` | a heading that wraps where the frame could hold it on one line |
| Axis ticks | `NICE_TICKS` | nice numbers |
| Page did not render | `MISSING_RENDER` | every page the gates are asked to measure has a render |
| Picture frame with no picture in it | `UNSOURCED_PICTURE` | a photograph written as `alt` with no `path` never reaches a reader |
| A count the exhibit does not show | `TITLE_COUNT` | where a title says "three of four", the page draws three of the four |
| A figure its own numbers contradict | `UNSCALED_FIGURE` | where a figure draws a baseline and blocks of one size, the quantities printed on those blocks stay within half as much again of each other |

**What the page says.** Everything above measures how a page is drawn. A 50-page deck cleared all of it and was rated 2 out of 10 by the person who opened it: twenty-eight pages headed `Interpretation:`, fifty-nine lines saying what the evidence does not establish, eighteen tables on two invented schemas, one chart, and a comparison table whose two columns carried identical sentences in every row. These five measure the other half, and the example decks must stay clean on all of them — a content gate that fires on good work is one that gets switched off.

| What is measured | Code | The bar |
| --- | --- | --- |
| Compared columns that agree | `TWIN_CELLS` | two or more rows, over 40% of the table, where two compared cells are the same words |
| Commentary against its exhibit | `RESTATEMENT` | at most 47% of the column's content words already in the exhibit (reference decks run 25–36%), and at most 66% of any one block's - a column does not average out the block a reader stops at |
| Planning language on the page | `PLANNING_VOICE` | no sentence opens `Interpretation:`, `Takeaway:`, `So what:` or `Key insight —` |
| Limits against findings | `CAVEAT_HEAVY` | at most 2 caveat lines a page; a finding in contrastive form ("not X; it Y") is not a caveat |
| The same table, repeated | `TABLE_SCHEMA_FLAT` | at most 3 tables in a deck open with the same column headers |
| A share the page's own counts do not give | `CONTRADICTED_SHARE` | where a page prints "N of M", every percentage on it is a subset of those counts over M, within one count |
| What the deck does, page after page | `DECK_CRAFT` | advisory legacy screen: a phrase emphasised on at least 35% of pages (client decks run 51%), a source on at least 50% (they run 67%), at least 11 drawn elements a page (the corpus median is 32), and no single table device on more than 60% of the tables. These counts never require decoration |

Two more findings share the shape but fire before the page is rendered, from the composer rather than the gates: `THIN_PLAN` (what the page will carry against its floor, with the remedy that page's own data offers) and `MISSING_EVIDENCE` (a ranked criterion with no comparative exhibit across all options).

`page_gates.GATE_CODES` is the list this table is checked against — a code cannot be renamed in the gates without this table failing, and a gate cannot emit a code that is not in it.

## Review codes

The model review reads each rendered page together with its text, layout roles, mapped evidence and the deck question, and receives that page's gate measurements as inputs. It may block with these codes:

`FACTUAL_ERROR`, `UNSUPPORTED_CLAIM`, `MISLEADING_COMPARISON`, `MISSING_EVIDENCE`, `MISSING_ARGUMENT`, `UNREADABLE`, `OVERFLOW`, `BROKEN_GEOMETRY`, `PROVENANCE`.

Design defects block too, and carry their own codes: `DEAD_SPACE`, `LAYOUT_MONOTONY`, `NO_HERO_EXHIBIT`, `OVERSIZED_TYPE`, `WALL_OF_TEXT`, `BURIED_NUMBER`, `HEDGED_TITLE`, `TITLE_TOO_LONG`, `INCONSISTENT_ENCODING`. `EDITORIAL` is the advisory one.

Every finding names the exact defect and a repair that a person can act on. `runtime/reviewer.mjs` owns the review schema and suggested vocabulary; a precise new upper-case code is also allowed. Severity determines acceptance: major and blocker findings must be resolved before delivery, including findings with new codes. `rules.json` holds the deterministic rule IDs and severities; it does not limit what independent visual review can discover.

## Review dimensions

**Story.** The deck answers the brief and has one governing thought. The title spine reads as an executive memo, or as a coherent explanatory progression. Each page has one job and one dominant exhibit, every decisive case maps to visible proof, and the close follows from the evidence. Missing data is explicit and counts as a gap rather than as completed analysis.

**Evidence.** Claims reconcile with their exhibits and sources; facts, estimates and inferences stay distinguishable; charts use the correct scale, units, labels and series; every plotted coordinate encodes a real measure, calculation or named category position; requested annotations appear in the render; focal marks separate from comparators in colour and in greyscale.

**Design.** The exported file and its full-size renders match the declared theme, colour ledger and treatment ledger. The composition fits the evidence and keeps one dominant exhibit, deck rhythm passes separately from style consistency, and labels sit beside the content they name.

**Platform.** The requested editable format opens, native objects stay editable, fonts, charts, tables, notes and sources survive export, and the output directory contains only the requested deliverables.

## Reader review

[Taste review](../taste-review.md) is the authoritative procedure for title/original/spread review, adversarial consolidation, independent scoring and literal reference coverage. Schema/mix statistics cannot certify semantic quality. Preserve the exact artifact binding and complete inspected-slide IDs; a rebuild requires a new review.

`PLAN_STYLE_ENTROPY` and `PAGE_SHAPE_FLAT` remain blocking repetition screens. [Design](../design.md#page-architecture-and-repetition) owns normalized relationships and deliberate comparison series. Advisory counts must not provoke template rotation or invented content.

## Forward-testing the skill

For a substantial reusable-skill change, give an independent author the revised installed skill, a realistic new request and the minimum raw artifacts, without the expected answer, prior scores or repair list. Keep generated output in a separate task-owned evaluation directory. Default to at least 50 total rendered pages unless the user explicitly overrides the evaluation length. Select a sufficiently broad brief first; do not grow a small diagnostic through repeated calculations.

Use new domains, source structures and realistic input ambiguity to test transfer. A wholly synthetic case can test mechanisms, but cannot validate research quality or empirical depth. Record that limit. Include relevant positive/counterexample opportunities without telling the author the expected styling: taxonomy versus repeated membership, actual mechanism versus generic process, supported focus versus none, explicit good/bad text versus ordinary chart series. Do not add quotas.

An independent whole-deck reader follows Taste review. Inspect whether the revised decision rule helped an unseen case, not only whether the last defect vanished. Short export/component probes remain diagnostics and never establish the full-deck taste result. Retain failures and repair the earliest shared owner; do not rewrite the score to meet a requested target.

## Corpus calibration

The calibration sample contains 3,606 analytical pages from 28 client engagement decks, with covers, dividers, back matter and portrait documents excluded. Published thought leadership is a separate contrast. These are descriptive distributions, not content or decoration quotas. The values come from `runtime/weight.json`; repository-only acquisition and measurement evidence lives in `evals/corpus/`.

| Per analytical page | Client decks | Published work | What the gate does with it |
| --- | --- | --- | --- |
| Ink on the page | median 18%, quartiles 12% and 27% | 19% | `INK_COVERAGE` reports the active fill profile’s diagnostic threshold |
| Words of page text | 189 (p20 110, p80 290) | 198 | `WORDS` caps, by profile |
| - in the title band | 18 | 17 | `TITLE_LINES`, `TITLE_WORDS` |
| - **in the body** | **148** | 157 | `THIN_PAGE` floors the body alone |
| - in the footer, source and notes | 13 | 12 | `NOTE_HEAVY` |
| Numeric tokens | 13 overall - 26 on a chart page, 20 on a table, 4 on a diagram | 11 | `NUMBERS_ON_MARKS`: inspect claim-relevant labels and scales |
| Drawn objects (marks, rules, brackets) | median 32 (p25 11, p75 88) | - | the cold-run scorer's `drawingsPerPage` |
| Pages carrying 186+ words | 51% | 54% | `DECK_FLAT` prompts review of whether detail is missing |
| Pages carried by a chart | 30% | 37% | advisory chart-mix comparison |
| Pages carried by a table | 20% | 11% | advisory table-mix comparison |
| Pages carrying no exhibit at all | 25% | 30% | advisory text-page comparison |
| Titles that state a claim | 65% (89% on chart pages, 38% on table pages) | 55% | the house rule is every page; this is the gap to close |
| Pages with a commentary column | 33% (13% on pages of type) | 43% | it is not the default - see `storylining.md` |
| Charts carrying an annotation | **80%** | 63% | descriptive reference; no annotation quota |
| Tables carrying a treatment | **100%** (32 of 32) | 89% | descriptive reference; treatment follows meaning |
