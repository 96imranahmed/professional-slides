# Composition

Composition is an open tree, not a catalogue of page silhouettes. Start from the approved title, list the content items the page needs, and choose the smallest tree that makes their relationships legible. Each item declares its semantic job, registered component, content, relationship to its peers and relative weight.

The executable contract is `runtime/core.mjs`; the content-to-composition planner is `runtime/planner.mjs`. Decks are authored as [page types](page-types.md): the page type's `commentary` and `form` choices set `layout`, `shape`, `arrange` and the exhibit's type. Those four keys are listed under [What the compiler writes](#what-the-compiler-writes), for reading a compiled deck; an author never writes them. Read this reference when a composition finding points here.

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

A column flow gives a `fill` child no more than its ceiling. A component with a natural height declares one (`measureCeiling`: tables, wave roadmaps, processes, timelines and dated stages, cards, profile cards, gantts, a waffle's block, a single row of fact tiles): its natural height plus the rhythm it can add legibly - one type step and capped row padding for a table, wider stage gaps for a roadmap or a dated timeline, larger gaps and centred copy for a card, a step of padding for a row of profile cards (drawn as tall as their copy, not as their frame). Past the ceiling the slack goes after the last block as one bottom margin, whatever the flow's `leftover` policy, so the commentary or takeaway stays against its exhibit instead of a band opening between them. Flows inside a row or grid are exempt: peers share one height and their bottom blocks one line.

A section may contain any other composition, including more sections. A slide may have no sections, one, several peers, a progressive sequence or a layered exhibit. Section names stay content-defined (`market signal`, `implementation risk`, `source basis`) rather than being forced into two universal page regions.

## Selection

`auto` infers the tree when the relationship is unambiguous:

- one item becomes a column flow;
- two or three peers become a row flow;
- four or more peers become a grid;
- layered items become an overlay;
- framed items become an absolute composition;
- an explicit sequence becomes a row flow.

Automatic composition allocates the authored content; it does not convert charts to metrics, prose to cards or add a duplicate data table. Author these alternatives when their reading task warrants them.

An explicit sequence outranks the peer-count rule; framed and layered relationships outrank both, because they declare the coordinate system. When reading order, density or a reference design calls for a different relationship, choose another page type or form and record the reason in the page's `why`.

Row and column plans, including nested sections, declare `gap` as a spacing token - `space.2` for a tight heading-and-body group, `space.4` for peer sections. Choose the gap from the relationship.

## Recipes

| Question | Composition | Required reasoning |
| --- | --- | --- |
| Which option is better under which conditions? | Paired evidence plus synthesis | Comparable basis, decisive difference, the condition that changes the choice |
| Why did the result change? | Trend above drivers | Actual periods, decomposition, interpretation grounded in the decomposition |
| What does this evidence imply? | Evidence beside developed explanation | Mechanism, significance, material qualification |
| Is the recommendation robust? | Decision table plus sensitivity | Explicit criteria, economics, sensitivity, countercase |

Author each as page types, not as a call into a second builder: paired evidence is `panels` or `options`, a trend above its drivers `panels` form `stack` or a `bridge`, evidence beside its explanation an exhibit with commentary `beside`, a decision table a `scorecard` or a `lookup` with an implication column. The compiled presets they produce are listed under [What the compiler writes](#what-the-compiler-writes).

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

If items do not fit, remove duplication, rebalance tracks or choose a coherent density first. Split at a meaningful evidence boundary only when the proof genuinely needs another page; return to Storylining if several pages repeat one job.

## Adapter invariant

HTML and PowerPoint consume the same resolved scene. HTML serializes canonical tokens as CSS variables; PowerPoint maps the same tokens to theme slots or resolved native values, converts pixels to inches once, and names every object from its scene ID. Compilation rejects undeclared component token use. A reader-back of the exported file recovers every named object, its frame within one pixel, and the canonical theme.

## Shared geometry and visual intent

[Design](design.md) owns semantic relationships and treatment decisions. Composition preserves them while assigning width, height and reading order. A parent may align peers without rewriting their category, focus, icon or verdict props.

Use content-hugging groups where a sparse object is complete. A short group starts at the top of its region, headed or not, and the height or width it cannot use goes to the neighbour that can: a short commentary column narrows so the chart beside it widens, a waffle's dots grow to their cap under its heading. Centred, a group carries a band of air above it as tall as the one below, which the band gates read by column. When a natural-height schedule shares a row with a table, explicitly align their visible evidence tops; do not allow independent vertical-centering defaults to imply different reading levels. Quantitative alignment uses common physical scales and entity order, not equal outside boxes alone.

Components expose occupied bounds and comparison/header anchors where supported. Use those anchors to inspect group relationships after composition; allocation frames alone cannot establish alignment. Optional surface, focus or divider treatments must preserve unrelated geometry. References participate in chart domains. [Production](tools/production.md) owns saved-artifact checks.

At the handoff compare authored intent with scene and rendered output: each nested category axis, icon set, exact focus, heading owner, status and evidence qualification must appear as intended. Make any deliberate revision in the pages file and recompile before rebuilding. A visible icon can still be semantically wrong; deterministic checks preserve declared choices but cannot choose them.

## Page and deck keys

The keys an author writes on a page or the deck, beyond its type's choices.

`density` is set once, on the deck ([Density profiles](theming.md#density-profiles)); a page type refuses it on a page. A chart's mark count steps its own labels down one size at most and never the page's prose, so a role keeps one size across the deck; a page that still does not fit is an authoring finding, not a smaller font. A `panels` page carries its panels in `exhibits`; `stackWeights` sets their height shares and `pairedWeights` their width shares. Keep matched measures on matched scales.

A lone implication beneath a full-width exhibit (commentary `below`, one point) owns that support region and takes the exhibit's own track: its heading sits at the body's left margin and runs the paragraph to the same right edge as the exhibit above, a band the width of the thing it is read off; a narrower centred measure would float in an empty region, joined to its exhibit by nothing. Two or more implications keep their shared column widths and the line-length check. This is the close under one exhibit, not licence to run sustained prose across the canvas elsewhere; inspect the relationship to the exhibit above.

Geometry that leaves a page empty is corrected where the page is composed:

- A flow starts at the top of its frame and grows its steps and gaps to fill it (up to about twice their measured height); its arrow labels sit in the gutter clear of every arrow and step, outside a branch's wedge.
- On a page whose page type placed the commentary `beside` a chart or a flow, a column of points that stays under about seven tenths of the body's height even at its narrowest runs under the exhibit instead, in columns, and the exhibit takes the width. A number, a statement box or prose in the column keeps it beside, as does a `layout` written on a deck built outside the pages file.
- Developed points (twenty words or more each) that each carry a `lead` run as a ledger on an executive summary of three or four, and on a text page of four: each lead set beside its statement at a reading measure, a hairline between rows, the rows spread to the body's foot so the page reads in order. Otherwise a text page's developed points run in columns: three across, four two by two, more in two columns.
- The small tables of a page's row blocks share one treatment and one type size: where one cannot carry its inferred bars at the width it is drawn, none does, and where one steps down a size, all do.
- A chart prints a value to the precision the page's copy quotes it (at most two places): a bar beside a sentence saying 11.6 is labelled 11.6, not 12; every other label keeps the chart's own precision.
- Panel captions are compact, left-aligned text under their panels at the panel's width; the statement box is the page's takeaway alone.

`tracker` names the navigation construction: `pills` (every section, the current one filled), `label` (the current section's name alone, at the left above the title), `breadcrumb` (the section under its parent) or `number-strip`. Left unset it is chosen from the section map rather than always taken as pills: six sections or more, or any name past fourteen characters, takes `label`; four or more with medium-length names takes `number-strip`.

`pictures` carries one to five labelled photographs. A `metrics` strip uses `metricsPosition: "top" | "bottom"`; omit it when it duplicates the argument. 

A `sidebar` page (`argument` form `sidebar`) sets `panel: { text, kicker, tone }` - a question, claim or figure in heading type down a filled left column - beside its exhibit, points or paragraphs.

A memo (a text page of `paragraphs` with a `panel`) sets the prose first and the panel down the right in the tint, carrying the conclusion or the figures the reader keeps. Prose beside a panel is sized to the text: one column, or two past about 280 words, each as narrow as lets the prose reach the foot of the body and never wider than a paragraph's measure, and the panel takes the width left. So 150 to 330 words make a full page; a column handed a fixed share wider than the measure leaves a strip down its right edge. A `photo-backdrop` page (`picture` form `photo-backdrop`) sets one exhibit on a white card over a full-bleed `photo`, the card on the right unless `photoSide: "right"` keeps the right of the photograph clear.

`paragraphs` carries body prose; on a text page with no points it flows from the top as a report page does, opening a second column past about 110 words and a third past about 220, and `textColumns: 1 | 2 | 3` fixes the count. `pointsHeading: false` omits a commentary heading, while `pointsAlign: "middle"` centres the group; headed commentary normally begins at the top. A column that runs less than four fifths down its track starts at the top and narrows instead - beside a chart down to 280px, the width a line of prose needs; beside a table by a fifth at most, since a wider table ends higher. `pointsAlign: "middle"` centres it when the author asks. `insights` holds a reading followed by its consequence, while `insight` holds a single developed implication.

`implication` names the mark in the gutter between evidence and its meaning: `"divider-chevron"` (the dashed rule broken around a disc), `"arrow"` (a filled block arrow), `"chevron"` (the disc alone), `"rule"` (one quiet hairline) or `false`, the default. The gutter is one of several ways to carry that relation and the most emphatic; [Design](design.md) holds the repertoire and when each is earned.

`pointsStyle` supports `icon-lead` (inline lead beside an authored icon), `icon-framed` (ringed icon with separate lead), `prose` (lead plus paragraph), `ruled` (separated observations), `lettered` (labelled options), `numbered` (ordered items), `bulleted` (unordered items) and `checklist` (a box per item: questions to answer or criteria to meet, each ticked or crossed once judged with `state: "yes" | "no"` and open until then). Choose markings for their meaning; they do not add architecture variety. Where a page sets none and its three or more points each carry a `lead`, how they relate is read by a model (`items-relation`, recorded with `judge.mjs`): steps in order, priorities or a set the title counts are `numbered`, options `lettered`, parallel findings the deck's own lead style (`prose` or `ruled`).

For a planned icon list, supply a supported `icon` on each peer and choose `pointsStyle: "icon-lead"` or `"icon-framed"`. An explicit `"prose"` treatment suppresses markers even if the records contain icons. Inspect the rendered glyphs against the plan; icon metadata alone does not establish that the chosen treatment reached the page.

`tracker` controls section navigation independently of the deck's `contents` page. On a section divider, `contents` lists sections and `contentsActive` identifies the current one. `kicker` is an optional structural label above the title; use `evidenceStatus` for qualifications such as Judgement in the shared subtitle band instead. `subtitle` is the page's standfirst: one line under the title naming the measure, population, period or scope, set above the title rule and counted with the title rather than the body ([page types](page-types.md#the-standfirst)); the rule, the title's balanced break and where the body starts are the design system's ([theming](theming.md#the-title-band)). `footnotes: [{on, text}]` attaches numbered scope notes to exact labels. `notes` stores speaker notes without putting them on the page.

`hidden: true` keeps a slide in the file but out of the slide show (PowerPoint's Hide Slide): it is still rendered, gated and reviewed, and `readback.hidden` in build-result.json lists it; the readback reports a slide hidden in the file and not in the scene, or the other way, as `HIDDEN_STATE`. An imported deck's hidden slides arrive with `hidden: true` beside their `draft`; keep it when mapping the page, or set it to `false` to show the slide. A cover cannot be hidden, so an imported hidden title slide stays a page rather than becoming the cover. This paragraph owns hidden slides.

## What the compiler writes

`author-deck.mjs` writes `layout`, `shape`, `arrange` and `soWhat` into `<id>.deck.json` from each page's type, form and commentary, and records the choices in the page's `pageType`. Writing them on a page is refused, and editing them after compiling is `PAGE_TYPE_EDITED`: change the choice in the pages file and recompile. They are listed here to read a compiled deck, a finding that names one, or a deck built outside the pages file.

### Named presets

A preset follows from the page's type, form and commentary; its name does not establish a distinct evidence relationship.

| `shape` | What it is | What it needs | Written by |
| --- | --- | --- | --- |
| `executive-summary` | the opening answer, proof, consequence and action | two to seven developed `points`, each with optional sub-`points`; optional `metrics` | `summary` form `executive-summary` |
| `findings-matrix` | findings down the left, two or three columns of short bulleted evidence across | `rows` with `cells` | `matrix` form `findings-matrix` |
| `measure-table` | grouped measures under grouped headers with their units, footnote markers on the cells that need a basis | a `table` exhibit, `derive`, `total` | `lookup` form `measure-table` |
| `model-page` | a forecast's series over its data table | a chart plus its `dataTable` | `trend` form `model` |
| `half-and-half` | a chart with icon-led points beside it | an exhibit and `points` | internal: a page type writes it as commentary `beside` with `pointsStyle: "icon-lead"` |

`layout` presets: `exhibit-full` (full-width evidence; commentary `none`, `on-exhibit` or `in-exhibit`), `exhibit-left` (evidence beside support; commentary `beside`), `exhibit-right` (commentary `beside-left`), `exhibit-top` (evidence above support; commentary `below`), `sidebar` (commentary `rail`), `hero-number` and `metrics-over-exhibit` (`numbers` forms `hero-number` and `metric-strip`), `two-up-contrast` and `table-halves` (`options` forms `two-up` and `table-halves`), `picture-pair`, `picture-strip`, `picture-hero` and `photo-backdrop` (`picture` forms), `two-up` (`panels` form `row` with commentary `below`), and `split-tone`, which is internal: it draws the same page as `options` form `two-up`.

### Arrangement

`arrange: "row" | "stack" | "grid" | "sequence"` is a `panels` page's form: it sets how its `exhibits` relate, and `sequence` draws an arrow between each exhibit and the next. `layout: "two-up-contrast"` holds two peer exhibits without shared commentary (`options` form `two-up`); `layout: "stack"` reads them vertically. `soWhat` is the filled bar a `so-what-bar` page writes from its `bar`.
