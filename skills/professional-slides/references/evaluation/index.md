# Evaluation

A deck is ready when the deterministic page gates pass, the review accepts it, and the exported file renders as intended. Keep generated decks, renders, plans and review reports in one task-owned `output/` directory.

## Page gates

Measured on the rendered page before review, and on the composed scene before that. The report records each finding's severity; `runtime/gates/gate_config.py` owns the advisory-code set. Ink, density, exhibit area, label counts and decoration/mix statistics prompt visual review; they do not prescribe furniture. A compact process or centred commentary can be complete, and a line chart can establish its claim through an axis and selected anchors. Keep these diagnostics visible for independent review; their count is not proof of a defect. Empty space is the exception: a void gate is a question at mild values and blocks past its bar, because a band that deep is space no reading of the page explains. Schema, title/evidence contradictions, text fit, clipping, collisions, scales and provenance block too. An independent reviewer may reject an actual visual defect even where its numeric diagnostic is advisory.

Every number the gates hold a page to is in [Gate thresholds](#gate-thresholds), printed from the code; the table below says what each gate measures.

| Diagnostic or blocking gate | Code | What it measures |
| --- | --- | --- |
| Ink coverage | `INK_COVERAGE` | the content area's ink on the render, advisory. A page with an exhibit is held to the fill's floor, set in the tail of well-made pages; a page with **no** exhibit to the ink its own word floor produces (`inkPerWord` in `runtime/weight.json`, measured by rendering text pages), because a page of type cannot reach the exhibit floor at any honest length |
| Trailing dead band | `DEAD_BAND` | the empty band from the last content to the footer: advisory past the fill's bar, blocking past its `_block` bar |
| Internal void | `INTERNAL_VOID` | the tallest empty band between two content blocks, the air under the title included: advisory, then blocking, as `DEAD_BAND` |
| Half-empty column | `COLUMN_VOID` | `INTERNAL_VOID` and `DEAD_BAND` measured per column where the page's rows pass: the composer's columns (component frames grouped into rows, each row split where no frame crosses), each band a share of its column's height scaled as the body is to the page. A hole inside a column is held to the internal-void bar; a column that stops short to the column bar, set in the tail of well-made right columns. Blocks past the column's `_block` bar, except in a column that is a chart's own frame (`plot` on the finding), where the air may be the scale's headroom - the smaller panel of a row on one scale - and stays a question. The finding names the column and the band |
| Action title | `TITLE_LINES`, `TITLE_WORDS` | lines and words of the action title; [Action titles](../copy.md#action-titles) owns the limit, and the compile refuses a long title before the build measures it |
| Body type | `TYPE_RANGE` | point size by role: body, dense table cells, chart furniture, titles, sources |
| Characters per line | `CPL` | the longest laid-out line of a prose node |
| Takeaway band length | `TAKEAWAY_LONG` | the takeaway band's lines: the reading said once |
| Body words | `WORDS` | a page composed from a page type: its reading task's outlier fence (upper quartile plus 1.5 times the spread) on the same body count as its floor. Otherwise the body band by density profile, higher for a page of type than for one whose evidence is an exhibit. Table cells and chart furniture are evidence, not prose. An executive summary's ceiling is the text page's upper quartile |
| Hero exhibit, analytical page | `HERO_EXHIBIT` | the largest exhibit's share of the content area, and ink in its frame |
| Layout repetition | `LAYOUT_MONOTONY` | content pages on one layout signature |
| Page families | `PAGE_VARIETY` | distinct page families across the deck |
| Measured pages | `EVIDENCE_MIX` | analytical pages carrying a chart, a table or measured tiles |
| Values a chart page plots | `EVIDENCE_DEPTH` | blocks at authoring and in the build's preflight (the variety contract): from eight chart pages, the median chart page plots 15 values or more - strong decks plot about 22 (the middle half 10 to 48). Each chart page is also floored at 8 when it compiles (a bridge 5); see [Page types](../page-types.md#evidence-depth) |
| Structure as drawn | `VARIETY_PANELS`, `VARIETY_COLUMN` | block at authoring and in the build's preflight (the variety contract), from fifteen pages, counted on each page's drawn skeleton rather than its declared type: at least 20% of pages carry two or more exhibits (strong decks: a quarter to a third), and at most 20% are one exhibit with a text column, rail or hero number beside it (strong decks: about one in eight). `author-deck` prints both shares and the skeleton mix on every run; see [Page types](../page-types.md#the-variety-contract) |
| Exhibit mix and range | `VARIETY_EXHIBIT_MIX`, `VARIETY_EXHIBIT_RANGE` | block at authoring and in the build's preflight (the variety contract), read on the compiled pages, where each page's family is the exhibit it draws: the bands `plan.mixEnforced` names in `runtime/weight.json` (charts at least a quarter of the pages; tables, diagrams, numbers and cards, pictures and pages of type each under their caps), and at least `plan.craft.exhibitVarietyPerTen.min` distinct exhibits per ten pages. The plan's own mix (`PLAN_EXHIBIT_MIX`, `PLAN_EXHIBIT_VARIETY`) reads the families the author declared, which can be wrong, and only advises |
| Photographs | `IMAGE_BUDGET`, `IMAGE_RUN` | analytical pages carrying a photograph, and the longest run of them |
| Argument on a picture or comparison page | `MISSING_ARGUMENT` | an insight, a so-what or a points column |
| One number over a table | `METRIC_STACK` | a lone tile belongs beside its evidence |
| Sections and tracker | `NO_SECTIONS` | required on a long deck |
| Contents page | `NO_CONTENTS` | a long sectioned deck says what its sections are |
| Opening summary | `NO_SUMMARY` | the first analytical page declares `role: "executive-summary"` before the first section; the shape preset is optional and metrics do not establish the role |
| Body text floor | `THIN_PAGE` | the deck's `weight.pageWords`, counted in the body alone |
| Notes carrying the page | `NOTE_HEAVY` | the footer's share of the page's text, as drawn - a citation the runtime writes from the `sources` registry counts like a typed one, and the runtime fits it to the room this bar leaves |
| Chart annotation | `UNANNOTATED` | a bracket, a flag, a change bubble, a base or an observation on any plot of three marks or more |
| Page architecture | `PAGE_SHAPE_FLAT` | distinct evidence relationships per ten analytical pages, and the commonest's share. Chart/table above two or three commentary columns, with or without an insight strip, counts once; mirrored arrangements also count once. The finding reports `constrainedPages` to locate evidence that needs redesign. Change the relationship when the argument warrants it; adding commentary or furniture does not create a new architecture |
| Commentary column | `COLUMN_MONOTONY` | consecutive pages whose commentary column is marked with the same device (icon, numbered disc, hairline, prose) |
| Deck shape | `DECK_FLAT` | one page carries the detail: the text page's upper-quartile words, or a p80 a third above the median |
| Thin pages | `DECK_THIN_PAGES` | on a rendered deck, blocks when its share of content pages (and at least five) carry a thin or half-empty page finding (`THIN_PAGE`, `HERO_EXHIBIT`, `INK_COVERAGE`, `INTERNAL_VOID`, `DEAD_BAND`, `COLUMN_VOID`). One count of one habit: before the render it is `DECK_SCENE_VOID`, and once the render is measured the build's count is this one alone |
| Half-empty body, from the scene | `SCENE_VOID` | `INTERNAL_VOID` and `DEAD_BAND`'s own definition and bars, read off the rows the scene will draw (text by its glyph lines, fills where they show against the canvas, the band under the title included); card and panel interiors read by what they hold; where the page's rows pass, its columns are read the same way (`COLUMN_VOID`'s measure) and the finding names the column. It blocks past the `_block` bar of the band it measured (`kind`: internal, dead or column), so the author hears at authoring the page the build would refuse; runs with no render, and the `author-deck --check` budget line marks the page with `!` and the band |
| Visual weight, from the scene | `SCENE_INK` | advisory: a page with an exhibit whose scene will ink too little of its body, estimated before the render ([ink estimate](#ink-estimate)). Runs at authoring; the `author-deck --check` budget line carries the estimate, marked `!`, only when the page is under the floor. Pages of prose are left to their word floor. The repair is construction - the house surfaces left on, loose text set as a table or cards, a lone chart paired - never more words |
| Visual weight across the deck | `DECK_INK` | advisory: the median analytical page's estimated ink. Printed at authoring with the page advisories |
| An empty band the scene does not draw | `RENDER_DRIFT` | advisory, on a rendered page: a page-wide band the render shows past its bar while the scene's estimate does not (the two differ by more than 4% of the page height), and text the scene holds has no ink in the render where the scene put it: missing, or drawn elsewhere. The finding names that text. The repair is the export's - a shape not emitted, a font the renderer could not set, a native chart the renderer laid out differently from the scene - and no change to the page's content closes it. A band only the render shows with every run of text in place is `inside-object`, not drift |
| Half-empty pages across the deck | `DECK_SCENE_VOID` | before the render (at authoring), the same count on the scene's own findings (`SCENE_VOID`, `THIN_PAGE`, `HERO_EXHIBIT`) |
| Commentary column | `THIN_COLUMN`, `POINT_DEPTH` | reaches `weight.columnFill` of its track; points average `weight.pointWords` |
| Marks in the exhibit | `PLOT_SPAN` | marks span `weight.plotSpan` of the exhibit frame (annotated and peer-aligned charts exempt) |
| Table against its budget | `THIN_TABLE` | uses `weight.tableFill` of the page's row budget |
| Values printed | `NUMBERS_ON_MARKS` | advisory count: every mark while a chart has twelve or fewer, three otherwise; review the values required by the claim against labels, axes and annotations |
| Exhibit multiplicity | `THIN_EVIDENCE` | `weight.elements` is a review diagnostic, not a proof quota; a single exhibit or developed bullet synthesis can carry the complete argument |
| Heading fit | `HEADING_WRAPS` | a heading that wraps where the frame could hold it on one line |
| Axis ticks | `NICE_TICKS` | nice numbers |
| Page did not render | `MISSING_RENDER` | every page the gates are asked to measure has a render |
| Picture frame with no picture in it | `UNSOURCED_PICTURE` | a photograph written as `alt` with no `path` never reaches a reader |
| A count the exhibit does not show | `TITLE_COUNT` | where a title says "three of four", the page draws three of the four |
| A figure its own numbers contradict | `UNSCALED_FIGURE` | where a figure draws a baseline and blocks of one size, the quantities printed on those blocks stay within half as much again of each other |
| Copy broken into labels | `TEXT_FRAGMENTED` | blocks at the build (`gates/density_profile.py`): the prose pages' median words a block, read off the rendered PDF by column as the band was read off the reference PDFs (`gates/text_blocks.py` over `pdftotext -bbox-layout`: a block is a run of lines in one column with no gap between them), the title, page numbers and source lines dropped, blocks under three words dropped, and a chart's heading, unit, axis rows, category and data labels and legend counted as the blocks they make, because the reference pages' were - less one thing a reference page does not carry, the runtime's section tracker, taken out by scene role; a page carries prose when it sets sixty words with one block of fifteen, the rule the reference pages were chosen by; outside the middle half of the reference pages' words per block (`plan.textForm.wordsPerBlock` quartiles, 10 to 23), once the deck has `deckLength.density` prose pages. Before a render the standing is an estimate: the same reading applied to each composed page's text nodes (`scene_blocks`), marked `estimated`, within about two words of the rendered median on the deck it was calibrated on, and never blocking - `--plan` and the fit search use it to avoid arrangements that take the deck out of the band, and the render decides. A page's own density flags remain questions for the review's density pass ([Word measures](#word-measures)) |
| Label on a line or an edge | `TEXT_ON_LINE`, `TEXT_ON_EDGE` | read on the composed scene (`runtime/validate-overlap.mjs` sceneDesignFindings): at authoring with the page gates, and in the build's `preflight-gates.json` and `gates.json`. A line running through a label's ink blocks; a label within 2px of the frame of a box it is not inside is advisory |
| Numeral on a rule | `DESCENDER_ON_RULE` | blocks: a display-face numeral whose old-style descender sits on a rule under it; set figures in the body face |
| Scatter with no key | `SCATTER_UNKEYED` | blocks: a scatter coloured by series with no legend and no named ends; keep the legend or `connect: true` |

### Gate thresholds

Printed by `python3 runtime/gates/page_gates.py --thresholds-markdown` from the values the gates apply (`runtime/weight.json` and `runtime/gates/gate_config.py`); the eval suite holds this block equal to that output, so a threshold cannot move in the code without moving here. The first table moves with the deck's `fill`, the second with its density profile.

<!-- thresholds:begin -->
| Code | Threshold | `full` | `balanced` | `airy` |
| --- | --- | --- | --- | --- |
| `INK_COVERAGE` | ink share of the content area, a page with an exhibit, at least | 11.8% | 7.7% | 5% |
| `INK_COVERAGE` | the same, a page with no exhibit: the ink its word floor puts on the page | 5.6% | 4.4% | 0% |
| `DEAD_BAND` | trailing empty band under the content, advisory above | 6% | 8% | 14% |
| `DEAD_BAND` | blocks above | 10% | 12% | 20% |
| `INTERNAL_VOID` | empty band between two content blocks, advisory above | 12% | 13% | 18% |
| `INTERNAL_VOID` | blocks above | 14% | 14% | 22% |
| `COLUMN_VOID` | a column that stops short of its row, advisory above (a hole inside one: INTERNAL_VOID's bar) | 13% | 20% | 20% |
| `COLUMN_VOID` | blocks above | 20% | 20% | 25% |
| `THIN_PAGE` | body words, at least (`weight.pageWords`) | 120 | 95 | 0 |
| `THIN_COLUMN` | share of its track the commentary column reaches (`weight.columnFill`) | 68% | 55% | 0% |
| `POINT_DEPTH` | mean words per point (`weight.pointWords`) | 10 | 8 | 0 |
| `PLOT_SPAN` | share of the exhibit frame the marks span (`weight.plotSpan`) | 60% | 52% | 0% |
| `THIN_TABLE` | share of the page's row budget a table uses (`weight.tableFill`) | 55% | 45% | 0% |
| `THIN_EVIDENCE` | evidence elements on an analytical page (`weight.elements`) | 2 | 1 | 1 |

| Code | Body words, at most, on a page not composed from a page type | `live-pitch` | `executive` | `pre-read` | `appendix` |
| --- | --- | --- | --- | --- | --- |
| `WORDS` | a page whose evidence is an exhibit | 89 | 148 | 207 | 259 |
| `WORDS` | a page of type | 126 | 189 | 267 | 334 |

| Code | Threshold | Value |
| --- | --- | --- |
| `TITLE_LINES` | action title lines, at most | 2 |
| `TITLE_WORDS` | action title words, at most | 15 |
| `TYPE_RANGE` | point sizes by role | body 10-14; table-dense 8.5-14; chart-furniture 8-11; action-title 20-26; source 7-9 |
| `CPL` | characters per line of prose | 35-90 |
| `TAKEAWAY_LONG` | takeaway band lines, at most | 2 |
| `HERO_EXHIBIT` | largest exhibit's share of the content area, at least; ink in its frame, at least | 40%; 2% |
| `NOTE_HEAVY` | footer's share of the page's text, at most | 30% |
| `LAYOUT_MONOTONY` | content pages on one layout signature, at most | 35% |
| `EVIDENCE_MIX` | analytical pages carrying a chart, a table or measured tiles, at least (from 8 pages) | 45% |
| `PAGE_VARIETY` | page families, at least (from 10 pages) | 3 |
| `IMAGE_BUDGET` | analytical pages carrying a photograph, at most | 30% |
| `IMAGE_RUN` | consecutive analytical pages carrying photographs, at most | 2 |
| `NO_SECTIONS` | analytical pages from which a deck needs sections and a tracker | 12 |
| `NO_CONTENTS` | analytical pages from which a sectioned deck needs a contents page | 12 |
| `NO_SUMMARY` | analytical pages from which a deck opens on its executive summary | 12 |
| `DECK_FLAT` | analytical pages from which one page must carry the detail | 8 |
| `PAGE_SHAPE_FLAT` | from 10 analytical pages: architectures per ten pages, at least; the commonest's share, at most | 3; 40% |
| `COLUMN_MONOTONY` | consecutive pages whose commentary column shares one device, at most | 3 |
| `RESTATEMENT` | commentary content words already in the exhibit, at most: the column (from 12 words); one block (from 6 words) | 47%; 66% |
| `CAVEAT_HEAVY` | caveat lines a page, at most | 2 |
| `CAVEAT_DENSE` | caveat words a hundred above the footer, deck-wide, advisory over (from 12 pages) | 0.52 |
| `TABLE_SCHEMA_FLAT` | tables opening on the same headers, at most (from 6 tables) | 3 |
| `DECK_CRAFT` | advisory rates across analytical pages (from 5 pages), at least: a phrase emphasised; a source line; drawn marks a page; tables treated; charts annotated | 35%; 50%; 11; 75%; 65% |
| `DECK_CRAFT` | and at most: one table device's share of the tables (from 4 tables); pages drawing a mark between exhibit and commentary (from 5) | 60%; 40% |
| `DECK_VOCABULARY` | device families drawn, at least (from 12 analytical pages) | 4 |
| `SCENE_INK` | estimated ink share of the body, a page with an exhibit, advisory under | 10% |
| `DECK_INK` | median analytical page's estimated ink, advisory under (from 12 pages) | 20% |
| `DECK_THIN_PAGES` | content pages with a thin or half-empty finding, blocks at (and at least 5 pages, from 12) | 30% |
| `DECK_SCENE_VOID` | the same count on the scene before the render | 30% |
<!-- thresholds:end -->

### Rules versions

`author-deck.mjs` stamps each new deck with the rules version it was authored under (`rulesVersion`, `runtime/weight.json`). A deck revised under `workflow: "existing_deck_revision"` that records an older version hears every rule introduced after that version as an advisory (`rules.introduced`), so a rule added today does not refuse a deck accepted under yesterday's: a compile refusal the deck predates becomes a page advisory (`predatedRule` in `runtime/weight.mjs`), and a gate finding keeps its code with advisory severity. Where a version lowered a bar (`rules.tightened`), a finding between the old bar and the new is the new rule, and past the old bar the old one. A deck that records no version, and every new deck, is held to the current rules.

Version 7 holds two shares to strong decks': points under the exhibit on at most 12% of the pages (`VARIETY_COMMENTARY.below`), and the numbers family - tiles, fact grids, cards, labelled rows - on at most 10%, lowered from 25% (a share between the two is `VARIETY_EXHIBIT_MIX.numbers.max.tightened`). Version 6 holds the deck's own consistency at the compile ([Page types](../page-types.md#what-the-pages-say-between-them)): `NUMBERS_DISAGREE`, `NUMBER_STALE`, `WORDING_STALE` and the one-page-twice variant of `PROOF_REPEATS`; and it holds the build bars where the deck is authored and built (`BAR_EXHIBIT_VARIETY`, `BAR_TABLES_TREATED`, `BAR_CHARTS_ANNOTATED`, `BAR_DRAWINGS_PER_PAGE`, `BAR_UNSOURCED_PICTURES`, each as its compile variant). No bar moved, and delivery has refused a missed bar since version 3: the compile and the build now read the same numbers on the same scene and refuse the same misses, so a deck is not first told of a bar at delivery. Every run prints each bar's standing - "chart pages marking something on the plot 4 of 8, 50%; delivery floor 65%: short by 2 chart pages" - and a miss names the pages that hold the rate down and the waiver that covers it, as `REJECTED.md` does (`waivers: [{ code, reason }]` on `deck`: the miss is then an advisory at the compile, and the reviewer confirms the waiver at delivery). Where a rate is also under its craft floor (`CRAFT_TABLES_PLAIN`, `CRAFT_CHARTS_BARE`) the one finding is the floor's, which no waiver lifts, and it says what the bar asks beyond it. The bars are read over the pages the runtime drew. A revision that carries slides from its source deck is held to them on the pages it composed - at the compile, the build and delivery alike, a floor from as many analytical pages as any deck's and a cap from the first - and every stage says they are not held on the carried slides; a rebuild, which carries none, is held to them in full. Version 5 introduced `MEASURES_CONFLICT`, one measure recorded twice in the insight log with different numbers, and the answer held up front: the executive summary as a whole carries the `answer`, and its title the answer's leading clause and 35% of the answer's content words or the seven a full-length title holds, whichever is fewer (the up-front variant of `CONTENT_ANSWER_UNCARRIED`). It replaces the uncapped 35% some one title had to carry - which a revision recorded under version 3 or 4 is still held to, since it hears the up-front rule as an advisory and no deck is held to neither; and `CONTENTS_UNFIT`, a named contents style that cannot hold the deck's sections ([Page types](../page-types.md#spine-rules)). Version 4 introduced the evidence contract: `MEASURES_MISSING` and `ANALYSIS_REQUIRED` at the spine, and the dependency rules of [Page types](../page-types.md#the-evidence-contract) (`CLAIM_MEASURES_MISSING`, `BASIS_MISSING` and the others). Version 3 introduced: the void codes blocking past their bars (`SCENE_VOID`, `COLUMN_VOID`, `INTERNAL_VOID`, `DEAD_BAND`); `VARIETY_EXHIBIT_MIX` and `VARIETY_EXHIBIT_RANGE`; `CONTENT_UNMEASURED` and `CONTENT_ANSWER_UNCARRIED` blocking; `TEXT_FRAGMENTED`; the tighter `TITLE_WORDS` (from 14 to 12; raised to 15 since, so no longer a version's rule) and `TAKEAWAY_LONG` (from 3 lines to 2); the spine rules `TITLE_GAP_SHARE`, `GENERATOR_SIGNATURE` and `PILLAR_UNSUPPORTED`; the build bars (`BAR_EXHIBIT_VARIETY` and its siblings); the chart-form refusals (`SCATTER_OVER_TIME` and the others in [Page types](../page-types.md#chart-and-figure-forms)); and the blocking scene codes `TEXT_ON_LINE`, `DESCENDER_ON_RULE` and `SCATTER_UNKEYED`. Version 2 introduced the refusals in [What a review found](../page-types.md#what-a-review-found-refused-where-the-page-is-written).

**What the page says.** Everything above measures how a page is drawn. A deck can clear all of it with pages headed `Interpretation:`, lines saying what the evidence does not establish on every page, every table on one invented schema, and a comparison whose two columns carry identical sentences. These measure the other half; the example decks stay clean on all of them, because a content gate that fires on good work gets switched off. They read the page's commentary - its points, paragraphs, insight, statement and the caption under each panel - and not a chart's callouts, which are reading notes fixed to the exhibit.

| What is measured | Code | The bar |
| --- | --- | --- |
| Compared columns that agree | `TWIN_CELLS` | two or more rows, over 40% of the table, where two compared cells are the same words |
| Commentary against its exhibit | `RESTATEMENT` | at most 47% of the column's content words already in the exhibit (well-made decks run 25–36%), and at most 66% of any one block's - a column does not average out the block a reader stops at |
| Planning language on the page | `PLANNING_VOICE` | no sentence opens `Interpretation:`, `Takeaway:`, `So what:` or `Key insight —` |
| Limits against findings | `CAVEAT_HEAVY` | at most 2 caveat lines a page; a finding in contrastive form ("not X; it Y") is not a caveat |
| Limits across the deck | `CAVEAT_DENSE` | advisory: caveat words (not, cannot, neither, undisclosed, unverified, unproven...) a hundred words above the footer, deck-wide, at most 0.52 - strong decks' p90 (median 0.27). A footnote's words are not counted: that is where a qualification goes |
| The same table, repeated | `TABLE_SCHEMA_FLAT` | at most 3 tables in a deck open with the same column headers |
| A share the page's own counts do not give | `CONTRADICTED_SHARE` | where a page prints "N of M", every percentage on it is a subset of those counts over M, within one count |
| What the deck draws, by device family | `DECK_VOCABULARY` | advisory: how many of ten device families (icon, picture, score, value pill, in-cell bar, heat, state, growth, reference, annotation) a long deck draws somewhere. A vocabulary floor, not a target rate: what share of pages carry a harvey ball cannot be read off a render. Measured on the composed scene, because a plan can record a treatment the page never draws |
| What the deck does, page after page | `DECK_CRAFT` | advisory legacy screen: how often the deck emphasises a phrase, sources a page, draws marks, treats its tables (a treated table as [Charts](../charts.md#heatmaps-and-analytical-tables) defines it) and annotates its charts (well-made decks run 51% emphasis, 67% sourced and a median of 32 drawn elements a page), how far one table device dominates its tables, and how often a drawn mark in the gutter between an exhibit and its commentary stands in for a relation well-made decks state in words. These counts never require decoration |

One more finding shares the shape but fires before the page is rendered, from the composer rather than the gates: `MISSING_EVIDENCE` (a ranked criterion with no comparative exhibit across all options).

Defects that show only when a deck is read whole are refused when the page is authored, and each carries its own code (`runtime/gates/variety_gates.mjs` holds the vocabulary; [Page types](../page-types.md#what-a-review-found-refused-where-the-page-is-written) the rules): `TOTAL_ROW_BLANK` (a total row with nothing in it), `TIME_AXIS_UNEVEN` (dated columns at uneven gaps drawn one slot apart; lines and areas are spaced by elapsed time instead), `VERDICT_TABLE_PLAIN` (a judgement column set as words), `SCENARIO_PROSE` (alternatives written as paragraphs), `VARIETY_TABLES` (one table construction on more than half of ten consecutive pages), `PLAYERS_UNMARKED` (named players with no early logos) and `PROFILE_UNPICTURED` block; `SHARES_IN_TILES` (shares of one measure far apart in tiles of one size) advises. An executive summary's `WORDS` ceiling is the text page's upper quartile, 204 body words.

**One band, one cause.** The scene's gate and the render's gates measure the same empty band with two instruments, so a half-empty page is reported as `SCENE_VOID` and again as `DEAD_BAND`, `INTERNAL_VOID` or `COLUMN_VOID`. Every finding is kept, and each void finding carries the `cause` it shares (`<slide>:<kind>`); the report's `voidCauses` lists each band once with the codes that reported it, and the build lists one blocker a cause. On a rendered page each page-wide band also carries its `origin`, read by setting the scene's measure against the render's: `authored` (the scene draws the band and the render shows it - the repair is the page's content or composition), `inside-object` (the render shows a band the scene's estimate does not, and all the scene's text reached the page: the air is inside something the scene counts as drawn, a chart whose marks sit in a corner of its plot or a card deeper than its text, so it is authored), `render` (the same, with text the scene holds missing from the render - `RENDER_DRIFT`, the export's to repair) or `scene-estimate` (the scene's estimate shows a band the render does not). Text on a dark fill, or with other ink across its box, cannot be told missing this way, and a column's band carries no origin. A passing readback says the saved file holds the scene's shapes where the scene put them; it does not say the page they make is full, which is what these measure.

`page_gates.GATE_CODES` is the list this table is checked against — a code cannot be renamed in the gates without this table failing, and a gate cannot emit a code that is not in it.

**Three classes, one order.** Every code has a class (`runtime/gates/gate_classes.mjs`), and `author-deck.mjs` reports them in class order ([Page types](../page-types.md#one-run-in-order)):

- deck structure: `PAGE_SHAPE_FLAT`, `NO_SECTIONS`, `NO_CONTENTS` and `NO_SUMMARY`. They follow from what each page is, so they are read first and, for a page that has not composed, from its declared choices;
- deck aggregates, measured across the composed or rendered pages: `LAYOUT_MONOTONY`, `PAGE_VARIETY`, `COLUMN_MONOTONY`, `EVIDENCE_MIX`, `IMAGE_BUDGET`, `IMAGE_RUN`, `DECK_FLAT`, `TABLE_SCHEMA_FLAT`, `DECK_CRAFT`, `DECK_VOCABULARY`, `DECK_SCENE_VOID`, `DECK_THIN_PAGES`, `DECK_INK` and the density profile's `TEXT_FRAGMENTED`;
- every other gate reads one page.

The gate report says where the deck stands against each deck-level rule whether or not it is broken (`standings`: the value, the bar, the pages counted and, for a median, each page's own figure), and the author's run prints one line a rule from it.

**The check is the build.** `author-deck.mjs <id>.pages.json --check --render` runs the build's stages - emit, readback, render, the gates on the renders, the density profile - on the compiled deck in a temporary folder, without fetching, and reports their findings with the compile's. Its blocking findings are those of a build that does not fetch; the scene's estimate of a band and the render's measure of it are one blocker, as in the build.

## Word measures

Five checks count words, and each answers a different question. A word is one definition everywhere: `textWords` in `runtime/text-contract.mjs` (the text normalised, then split on whitespace, so "12%", "$1.2B" and a bullet are one word each), which `runtime/gates/text_stats.py` ports for the Python gates. The density profile alone counts printed words - tokens that carry a letter or a digit - because it reads the rendered PDF, where bullets and dashes are tokens of their own, and its targets were calibrated on that count. A page composed from a page type carries one budget, set once when it composes (`wordFloor` and `wordCeiling` on the scene, `derive-content.mjs` wordBudgetOf), and every check that counts its body reads that budget, so they cannot disagree about a page.

| Check | Counts | Against | Blocks? |
| --- | --- | --- | --- |
| `TEXT_COVERAGE_LOW` | the planned body words of the page | its floor: the lower quartile of pages doing its reading task (`runtime/reading-tasks.json`: a chart with its own callouts about 42, a table with commentary 149, a text page 121), scaled by the deck's `density` and cut by the share of the body a photograph holds | yes, at compile and in the build's text contract |
| `THIN_PAGE` | the rendered body words, title band and footer excluded | the same floor; a page with no page type falls back to its task's floor, else to `weight.pageWords` for the deck's fill | advisory on the page; `DECK_THIN_PAGES` blocks when too many pages are thin |
| `WORDS` | the same body count | the ceiling: the task's upper quartile plus one and a half times the spread; an executive summary the text page's upper quartile, 204. A page with no page type takes the density profile's cap in [Gate thresholds](#gate-thresholds) | yes |
| `TEXT_BLOCK_TOO_LONG` | the longest run of prose on a page | 127 words, the longest block nine strong prose pages in ten keep under | yes |
| `TEXT_FRAGMENTED` | words per block on the rendered PDF read by column, pages that carry prose only, measured as the reference pages were (chart headings, legends, axis and data labels counted; the runtime's tracker excluded) | the deck's median held inside 10 to 23 | yes, deck-wide; each page outside the band is a question for the review's [density pass](../taste-review.md#density-pass) |

The design intake's `density` answer moves three of these at once: `live-pitch` cuts every floor to a quarter and sets the fill `airy`, `executive` sets it `balanced`, `pre-read` `full` (the fill sets `THIN_PAGE`'s fallback and the void bars). The body word figures of a well-made page - 148 words in the body at the median, ten blocks read by column of which three are developed (about 25 words each), the longest block 44 at the median and never past 127 - are descriptions, not targets: [Copy](../copy.md#how-much-prose-in-one-run) says how to write to them.

## Review codes

The model review reads each rendered page together with its text, layout roles, mapped evidence and the deck question, and receives that page's gate measurements as inputs. It may block with these codes:

`FACTUAL_ERROR`, `UNSUPPORTED_CLAIM`, `MISLEADING_COMPARISON`, `UNCLEAR_ARGUMENT`, `UNREADABLE`, `OVERFLOW`, `BROKEN_GEOMETRY`, `PROVENANCE`.

Design defects block too, and carry their own codes: `DEAD_SPACE`, `NO_HERO_EXHIBIT`, `OVERSIZED_TYPE`, `WALL_OF_TEXT`, `BURIED_NUMBER`, `HEDGED_TITLE`, `INCONSISTENT_ENCODING`. `EDITORIAL` is the advisory one and never blocks. A defect a build check already names keeps that check's code when the review confirms it: `MISSING_EVIDENCE` (the composer's), `LAYOUT_MONOTONY`, `TITLE_LINES` and `TITLE_WORDS` (the gates').

Every finding names the exact defect and a repair that a person can act on. `runtime/reviewer.mjs` owns the review schema and suggested vocabulary; a precise new upper-case code is also allowed. Each code is registered in exactly one vocabulary - the gates', the composer's, a stage's, the reviewer's, the build bars' (`BAR_EXHIBIT_VARIETY`, `BAR_TABLES_TREATED`, `BAR_CHARTS_ANNOTATED`, `BAR_DRAWINGS_PER_PAGE`, `BAR_UNSOURCED_PICTURES` in `runtime/build-bars.mjs`), or delivery's own (`DELIVERY_CODES` in `runtime/deliver-deck.mjs`: `MISSING_RENDERED_GATES`, `STORYLINE_UNREVIEWED`, `REVIEW_PASS_CAP`, `REVIEW_RATING`, `REVIEW_PROVENANCE`, `REVIEW_UNCONFIRMED`, `LINEAGE_RESTART`, and `INVALID_REVIEW` for a review that does not validate, which is a transport problem rather than a deck defect) - and the eval suite fails on a code emitted but registered nowhere, or registered twice. Severity determines acceptance: major and blocker findings must be resolved before delivery, including findings with new codes. `rules.json` holds the deterministic rule IDs and severities; it does not limit what independent visual review can discover.

## Review dimensions

**Story.** The deck answers the brief and has one governing thought. The title spine reads as an executive memo, or as a coherent explanatory progression. Each page has one job and one dominant exhibit, every decisive case maps to visible proof, and the close follows from the evidence. Missing data is explicit and counts as a gap rather than as completed analysis.

**Evidence.** Claims reconcile with their exhibits and sources; facts, estimates and inferences stay distinguishable; charts use the correct scale, units, labels and series; every plotted coordinate encodes a real measure, calculation or named category position; requested annotations appear in the render; focal marks separate from comparators in colour and in greyscale.

**Design.** The exported file and its full-size renders match the declared theme, colour ledger and treatment ledger. The composition fits the evidence and keeps one dominant exhibit, deck rhythm passes separately from style consistency, and labels sit beside the content they name.

**Platform.** The requested editable format opens, native objects stay editable, fonts, charts, tables, notes and sources survive export, and the output directory contains only the requested deliverables.

## Reader review

[Taste review](../taste-review.md) is the authoritative procedure for title/original/spread review, adversarial consolidation, independent scoring and literal reference coverage. Schema/mix statistics cannot certify semantic quality. Preserve the exact artifact binding and the complete page coverage record; a rebuild requires a new review pass.

`PLAN_STYLE_ENTROPY` and `PAGE_SHAPE_FLAT` remain blocking repetition screens. [Design](../design.md#page-architecture-and-repetition) owns normalized relationships and deliberate comparison series. Advisory counts must not provoke template rotation or invented content.

## Forward-testing the skill

For a substantial reusable-skill change, give an independent author the revised installed skill, a realistic new request and the minimum raw artifacts, without the expected answer, prior scores or repair list. Keep generated output in a separate task-owned evaluation directory. Default to at least 50 total rendered pages unless the user explicitly overrides the evaluation length. Select a sufficiently broad brief first; do not grow a small diagnostic through repeated calculations.

Use new domains, source structures and realistic input ambiguity to test transfer. A wholly synthetic case can test mechanisms, but cannot validate research quality or empirical depth. Record that limit. Include relevant positive/counterexample opportunities without telling the author the expected styling: taxonomy versus repeated membership, actual mechanism versus generic process, supported focus versus none, explicit good/bad text versus ordinary chart series. Do not add quotas.

An independent whole-deck reader follows Taste review. Inspect whether the revised decision rule helped an unseen case, not only whether the last defect vanished. Short export/component probes remain diagnostics and never establish the full-deck taste result. Retain failures and repair the earliest shared owner; do not rewrite the score to meet a requested target.

## Ink estimate

The page census measures visual weight on the render: the share of the body (15-92% of the page height) that sits more than 25 grey levels from the page's median grey when the page is rendered 200 px wide, where a line of body type is a two-pixel smear and a hairline disappears. It is not `INK_COVERAGE`'s measure, which counts single pixels darker than the page on the full 1280x720 render and so reads lower on the same pages (a median of 18%, [Target calibration](#target-calibration)); `SCENE_INK` and `DECK_INK` estimate this one. Strong analytical pages carry a median visual weight of 0.26 (lower quartile 0.195); pages drawn as type on the canvas with hairlines carried 0.18 at the same word count. `runtime/gates/scene_ink.py` estimates the same number from the scene: every node painted onto a grid of that size by the area it covers - fills as drawn (discs, sectors, chevrons and polygons as their outlines), rules and outlines by stroke width along their length, pictures whole - and each line of type as a band across its glyphs and measured width at a fitted coverage of its colour.

The estimate is fitted against rendered pages of built decks (R² about 0.98, mean absolute error about 0.01) and checked on the worked example, which the fit did not see. Its misses are pages with a large tint within a few grey levels of the threshold, where the render's median grey itself moves; that is why `color.surfaceTint` sits about 30 grey levels under the page. Both codes stay advisory: a per-page error of 0.02-0.04 makes the estimate a prompt, and a bar that blocked would invite fills drawn to pass it.

## Target calibration

The targets describe a typical analytical page, with covers, dividers, back matter and portrait documents excluded. A working deck is one read in a meeting or as a pre-read; a narrative deck is a longer-form report set as slides, shown for contrast. These are descriptive distributions, not content or decoration quotas. The values come from `runtime/weight.json`.

| Per analytical page | Working deck | Narrative deck | What the gate does with it |
| --- | --- | --- | --- |
| Ink on the page, as `INK_COVERAGE` reads it (pixels darker than the page on the 1280x720 render) | median 18%, quartiles 12% and 27% | 19% | `INK_COVERAGE` reports the active fill profile’s diagnostic threshold; the census's visual weight, a different measure, is in [Ink estimate](#ink-estimate) |
| Words of page text | 189 (p20 110, p80 290) | 198 | `WORDS` caps, by profile |
| - in the title band | 18 | 17 | `TITLE_LINES`, `TITLE_WORDS` |
| - **in the body** | **148** | 157 | `THIN_PAGE` floors the body alone |
| - in the footer, source and notes | 13 | 12 | `NOTE_HEAVY` |
| Numeric tokens | 13 overall - 26 on a chart page, 20 on a table, 4 on a diagram | 11 | `NUMBERS_ON_MARKS`: inspect claim-relevant labels and scales |
| Drawn objects (marks, rules, brackets) | median 32 (p25 11, p75 88) | - | the build bars' `drawingsPerPage` (`runtime/build-bars.mjs`) |
| Pages carrying 186+ words | 51% | 54% | `DECK_FLAT` prompts review of whether detail is missing |
| Pages carried by a chart | 30% | 37% | advisory chart-mix comparison |
| Pages carried by a table | 20% | 11% | advisory table-mix comparison |
| Pages carrying no exhibit at all | 25% | 30% | advisory text-page comparison |
| Titles that state a claim | 65% (89% on chart pages, 38% on table pages) | 55% | the house rule is every page; this is the gap to close |
| Pages with a commentary column | 33% (13% on pages of type) | 43% | it is not the default - see `storylining.md` |
| Charts carrying an annotation | **80%** | 63% | descriptive reference; no annotation quota |
| Tables carrying a treatment | **100%** | 89% | descriptive reference; treatment follows meaning |
