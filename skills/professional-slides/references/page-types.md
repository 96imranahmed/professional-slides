# Page types

A deck is authored page by page as **page types**, in `<id>.pages.json`, and compiled into the deck spec. Each type is a reading task; each has choices with no defaults. The choices decide the page's structure, so variety is decided where it is cheap to change - in the pages file, before anything is drawn - not discovered in the render.

```bash
node runtime/author-deck.mjs --types                       # the catalogue: every type, its forms, placements, limits and data
node runtime/author-deck.mjs --example <type>[/<form>]     # the worked pages of a type, or of one form, to copy the shape of
node runtime/author-deck.mjs --scaffold <type> [--evidence <insight-id>]   # a page of that type that compiles, to fill in
node runtime/author-deck.mjs --schema [type]               # JSON Schema for a pages file, or for one type's page
node runtime/author-deck.mjs --icons                       # the icon names a point, card or row label can ask for
node runtime/author-deck.mjs <id>.pages.json --draft       # the spine: titles, claims, types, insights; write the deck for the critique
node runtime/author-deck.mjs <id>.pages.json --check       # compile and gate, print the page budgets, write nothing
node runtime/author-deck.mjs <id>.pages.json               # compile, compose in memory, gate; write <id>.deck.json, .plan.json and .content.json, or refuse (exit 2)
node runtime/author-deck.mjs <id>.pages.json --log         # the findings that came back run after run
```

Start a page from `--example <type>` (or `--example <type>/<form>`, such as `ranking/boxplot`) or `--scaffold <type>` rather than from the whole worked example file: each prints one page, with the keys and the data shape its form reads. Every code the compiler raises, with its repair, is in [Codes and their repairs](#codes-and-their-repairs).

## Why types, not layouts

A deck written straight into the spec takes the composer's defaults on every page. Fifty pages written through one helper - title, three points, a closing line, one exhibit - come out as one page: a closing line on every page and bullets under the exhibit on nearly all of them, though the composer can draw callouts on the chart, captions under panels, findings matrices, coded scorecards and side rails.

Strong decks spread the same decisions across the deck. On 123 of their content pages:

| Decision | Strong decks | One helper for every page |
| --- | --- | --- |
| Commonest page type | 23% (single annotated chart), then panels side by side 21% | one skeleton throughout |
| Where the explanation lives | nowhere beyond the title 27%, in the table 20%, on the chart 16%, under each panel 16%, beside the exhibit 13%, in a band 7%, bullets under the exhibit 2% | bullets under the exhibit on nearly every page |
| Closing takeaway line | 9% (a standfirst under the title on another 15%, see [the standfirst](#the-standfirst)) | every page |
| Two or more exhibits | 24% | about one page in ten |
| Chart pages marking something on the plot | 80% | under half |

## Writing a page

```json
{ "id": "p03", "type": "trend", "form": "line", "commentary": "on-exhibit", "takeaway": false,
  "why": "The claim is the shape of the recovery - a rebound, then a plateau short of the FY20 peak - so the break and the stall are marked where they happen",
  "settles": { "kind": "rate", "what": "annual journeys FY17-FY26 and the slowing of growth after FY24" },
  "adds": "The callouts say why the series broke and why it has stalled, which the line alone cannot",
  "title": "Journeys recovered to 48 million but stalled 4 million below peak",
  "exhibit": { "heading": "Northvale Rail passenger journeys", "unit": "million",
    "categories": ["FY17", "FY18", "FY19", "FY20", "FY21", "FY22", "FY23", "FY24", "FY25", "FY26"], "series": [{ "name": "Journeys", "values": [47.2, 49, 51.8, 52.4, 14.9, 31.6, 42.8, 46.1, 47.5, 48.3] }],
    "referenceLines": [{ "value": 52.4, "label": "FY20 peak 52.4m" }],
    "annotations": [{ "category": "FY21", "text": "Pandemic low of 14.9m while offices and schools were closed" }, { "category": "FY26", "text": "Growth slowed to 1.7%: peak trains are full, off-peak trains are not" }] },
  "source": "Source: illustrative data for a fictional operator; financial years ending March" }
```

With an insight log, `evidence: ["i3"]` names the insights and `settles` is derived from them.

Every analytical page carries:

- `type` - the reading task (below);
- `form` - which exhibit or construction carries it; the form sets the exhibit's `type`;
- `commentary` - where the explanation lives: `beside`, `beside-left` (a column), `below` (points under the exhibit), `rail` (one claim in a filled side panel, written as `rail`), `on-exhibit` (callouts on the chart, `annotations`), `in-exhibit` (in the table's cells, the matrix, the cards, the row blocks), `captions` (a `caption` under every panel), `so-what-bar` (one implication in a filled bar under the exhibit, written as `bar`) or `none` (the exhibit and title carry it);
- `why` - one sentence on why this type fits this claim;
- `settles: { kind, what }` - what settles the claim and what kind of thing it is (`count`, `share`, `rank`, `rate`, `sequence`, `comparison`, `structure`, `qualitative`). With an insight log, name the insights instead - `evidence: ["i3", "i7"]` - and `settles` is derived from them. A chart or table page measures something, so `qualitative` is refused there; a findings matrix may rest on statements;
- `adds` - what the commentary says that the exhibit cannot, one sentence. Required on a page with commentary - `beside`, `beside-left`, `below`, `captions` and `on-exhibit` - where `adds: null` is refused (it says the commentary adds nothing - then the placement is `none`); a `rail` or `bar` is its own answer; leave it out elsewhere;
- the content: `title`, `exhibit` or `exhibits`, `points`, `rows`, `kpi`, `metrics`, `pictures`, `source`, `highlight` and the other slide keys;
- optionally `takeaway` - the closing sentence, one or two lines, kept for the page whose implication goes beyond its title; left out, the page closes on its exhibit (a `so-what-bar` page takes none: the bar is its close);
- optionally `subtitle` - the standfirst (below);
- optionally `better: "up" | "down"` - the direction that is good news for a measure, on a metric (a strip's `metrics`, a hero's `kpi`, a row block's `metric`), a table column, a table row or one trend cell. `"up"` is the default (revenue, share, retention); `"down"` is for a cost, churn or a wait. A delta and a trend arrow are coloured by it, not by their sign ([Status colour](design.md#status-colour)).

**Sources are written once.** A `sources` registry beside `deck` and `pages` - `{ "reports": { "name": "Northvale Rail annual reports, FY19-FY26", "url": "...", "status": "audited" } }` - lets a page cite by key: `"source": ["reports", "survey"]` is set as "Sources: Northvale Rail annual reports, FY19-FY26 (audited); ...". `status` says how far the source can be relied on (audited, company-reported, press report, estimate). An unknown key is refused with the keys the registry holds; `source` as text still works.

**Nothing is stamped.** Metadata written the same on most pages - one `why`, one `settles`, one `adds` - was written by a loop, not chosen for the page; past 60% of the pages it is refused (`GENERATOR_SIGNATURE`). Leave optional fields out rather than stamping a default, and write the required ones page by page.

### The standfirst

`subtitle` is one line under the title, 16 words at most, set small and in the secondary colour above the title rule. A fifth of strong analytical pages carry one. It says what the title leaves out so the title can stay a claim:

- the measure and its unit - "Share of seats filled on weekday trains";
- the population - "all five lines", "Gulf carriers with 50 or more widebodies";
- the period - "FY19 to FY26", "year to March 2026";
- the scope or basis - "30-year appraisal at a 3.5% discount rate", "illustrative, before synergies".

Use it when the page's evidence needs one of these and no exhibit heading already carries it: a page of several exhibits that share a population or period, a table or matrix with no heading of its own, a page whose numbers rest on a stated basis. Leave it off when the chart heading already names the measure, unit and period ([charts](charts.md)); the same scope said twice is noise. It never restates or paraphrases the title (a subtitle that shares most of the title's words is refused), carries no second finding, and runs to one line (a longer one is refused). It counts with the title, not toward the page's body word floor, so it cannot stand in for the commentary. Statement and takeaways pages have no title band and take none.

The compiler owns `layout`, `shape`, `arrange` and `soWhat`, and writes a `pageType` record on each compiled slide: the type, its choices and the structure they produced. Writing those keys by hand is refused. The build recomputes each page's structure and refuses a deck whose compiled structure was edited after compiling (`PAGE_TYPE_EDITED`): change the choice in the pages file and recompile.

Structural pages stay as they are: `{ "kind": "section", "title": ..., "summary": ... }` or `{ "kind": "agenda", ... }`.

## The types

| Type | Reading task | Forms |
| --- | --- | --- |
| `trend` | a measure over four or more periods, its rate or break marked | line, column, stacked-column, area, stacked-area, combo, slope, indexed, sparklines, model |
| `ranking` | the whole set on one measure, the subject marked | bar, column, lollipop, dumbbell, bullet, distribution, aligned-bars, boxplot |
| `composition` | what a whole is made of | stacked-bar, stacked-column, marimekko, waffle, donut, treemap, pie, pictogram |
| `relationship` | two measures across the members | scatter, bubble, bubble-grid |
| `bridge` | what a change between totals is made of | waterfall |
| `panels` | one question for two to four cuts, side by side | row, grid, stack, sequence |
| `scorecard` | members judged against criteria, cells coded | harvey, heatmap, rag, lights, check, bars, progress, dot, trend, binary |
| `lookup` | measures to look up under their units | measure-table, table |
| `matrix` | findings down the side, evidence across | findings-matrix |
| `mechanism` | how a system works | flow, tree, cycle, steps, framework, layers, funnel, sankey, quadrants, ... |
| `schedule` | what happens when | timeline, gantt, roadmap, horizons |
| `numbers` | a few numbers that carry the claim | hero-number, metric-strip, fact-grid, stat-list |
| `parallel` | three to six parallel ideas (give each card an `icon` for icon columns) | cards, capsules, arrow-rows, labelled-rows |
| `profiles` | who the players are, with their marks | logos, people, logo-table, cards, radar |
| `place` | where things are ([Geography](geography.md)) | map |
| `picture` | what the subject looks like | picture-hero, picture-pair, picture-strip, photo-backdrop |
| `options` | options compared on the same terms | compare, table-halves, two-up |
| `argument` | reasoning in prose | memo, sidebar |
| `statement` | one sentence, or the voices behind it | statement, quotes |
| `summary` | the answer and its proof | executive-summary, takeaways |

### Forms with rules of their own

These forms narrow their type's commentary placements and carry checks of their own; `--types` prints their data and `--example <type>/<form>` a worked page.

| Form | Choose it for | Data and limits | Commentary | Refused when |
| --- | --- | --- | --- | --- |
| `ranking/boxplot` | each member's spread - range, middle half, median - where one figure per member would hide how far its values run | `categories` (4 to 12 members), `boxes` (one `{ min, q1, median, q3, max }` per member), `highlights` naming the subject | `beside`, `beside-left`, `below`, `rail`, `so-what-bar`; no callouts | the subject is not highlighted; it carries `annotations` |
| `trend/sparklines` | which of many series moved, one small line per member over one window | `items` (2 to 12, each `{ label, values }` over the same four or more periods), `highlights` naming the subject's label, `unit` | as boxplot; no callouts | an item has fewer than four periods, or items differ in length (a missing period is `null`); no subject highlighted; `annotations` |
| `trend/model` | a forecast read with its numbers: the series over its own data table | `categories`, `series`, the chart's `type` (`chart.column` by default; line, area, stacked-column or combo) | `beside`, `on-exhibit` | no chart, another chart type, or no `series` |
| `composition/pictogram` | a population's share counted in figures - six in ten - where a percentage reads as precision | `rows` (1 to 5, each `{ label, value, text }`, filled out of `of`), `of` (10 or 20), `icon` (a person by default) | as boxplot | no `rows` |
| `profiles/radar` | each player's profile across three to eight attributes on one scale, where the shape is the comparison | `categories` (3 to 8 attributes), `series` (1 to 4 players, one value per attribute), `max` (the scale's top), `focusSeries` | `below`, `none` | more than four players; a player missing a value; no `max`; several players and no `focusSeries` |
| `schedule/horizons` | the portfolio of bets by when each pays - the core now, growth next, options later | `horizons` (2 to 5, each `{ label, title, description }`, in the order they pay), `variant` (`curves`, `stepped`, `stepped-minimal`, `stepped-bands`) | `beside`, `below`, `so-what-bar`, `none` | fewer than two horizons |

## Beyond one exhibit and a column

Strong decks draw about one page in eight as one exhibit with a text column beside it, and put a quarter of their pages on two or more exhibits; a deck that reaches for the column by habit draws two pages in five that way. Three pages carry what those columns usually hold:

| Page | Choose it for | Write |
| --- | --- | --- |
| Labelled row blocks - `parallel`, form `labelled-rows` | three challenges, what changed in each area, a diagnosis: parallel ideas that each have evidence | `blocks`: two to five `{ label, points }`, and on every row or none a `metric` `{ value, label }` or a small `exhibit` at the right |
| Exhibits joined by arrows - `panels`, form `sequence` | cause and effect, before and after, input to adjustment to result | two or three `exhibits`, each with its `heading`; commentary `captions`, `below`, `so-what-bar` or `none` |
| So-what bar - commentary `so-what-bar` | an exhibit whose implication goes beyond the title and is one sentence | `bar`: eight words or more, two lines at most; `takeaway: false` |

The variety contract holds the deck to this (`VARIETY_PANELS`, `VARIETY_COLUMN`, below). When a page reaches for a column, these are what it usually is. The contract's repairs are built from this list (`runtime/gates/variety_gates.mjs`), so they offer the same pages:

| The column was holding | Draw it as | Two or more exhibits (`VARIETY_PANELS`) |
| --- | --- | --- |
| a second cut of the same evidence - another measure, another member, the other period | two or more panels, each headed, its finding under it as a `caption` (`panels`, form `row`, `grid` or `stack`, commentary `captions`) | yes |
| the three numbers that carry the claim | the exhibit under a strip of them (`numbers`, form `metric-strip`, commentary `none`) | yes |
| notes on particular marks | callouts on the plot (commentary `on-exhibit`, three at most, about ten words each) | no |
| one implication | a so-what bar under the exhibit (commentary `so-what-bar`) | no |
| a point per area, each with its own evidence | labelled row blocks, a number or a small exhibit at the right of each (`parallel`, form `labelled-rows`) | with a small `exhibit` on each row |
| a point per row of a table | the table's last column, the implication of each row (`lookup` or `scorecard`, commentary `in-exhibit`) | no |
| a cause and its effect | two or three exhibits joined by arrows (`panels`, form `sequence`) | yes |
| the case for each of two options | the two options side by side, each with its exhibit (`options`, form `two-up`) | yes |
| what the subject looks like | the exhibit on a card over its subject's photograph (`picture`, form `photo-backdrop`) | yes |

Each row block is a filled label on the house colour - five words at most, read down the left edge as the page's outline - with two to four bullets beside it. The label names the area the row is about (the measure, the question), never its figures: a label that repeats what its `metric` or `exhibit` prints beside it is refused. The rows share the body height, so the page fills to its foot. The commentary is `in-exhibit`, since the bullets are the explanation, or `so-what-bar` to close the rows on what they add up to. A headed chart at the right of a row keeps its plot only on a page of two blocks; on three or more, give each row a number or a two-row table.

The bar is drawn in the house colour with the implication in bold white, in every design system. It is a close, so it counts toward the closing share with the takeaway line: a deck cannot close every page by moving the line into a bar.

The compiler then composes the deck in memory, as the build will, filling logos, photographs and places from what is already on disk. Every page that fails to compose is reported in the same run (`PAGE_DOES_NOT_COMPOSE`), not one per build.

## The pages file is the dot-dash

Write it in two passes. `--draft` compiles the spine and writes the deck for the [storyline critique](storylining.md#stress-test-the-storyline): the rules that block are the spine's - each page's type and choices, its title (length, gaps), what settles it and the insights it rests on, the deck's `request`, the claims and the answer they carry. The exhibit's data, the copy, the word floors, the page gates and the variety contract are reported, not enforced: a page whose exhibit is not ready compiles with the refusal it will meet recorded (`deferred to the full compile`). With an insight log, `--draft` prints the page types each insight's shape can carry (`insightTypes`). The copy - callouts, captions, points - is written after the critique, and the full compile holds it to every rule. A new deck cannot be built from a draft: the build holds its content plan to the complete text contract.

The spine rules and every other code the compiler raises, each with its repair, are in [Codes and their repairs](#codes-and-their-repairs). The deck-level keys `request`, `waivers` and `rulesVersion` pass into the deck spec unchanged; a deck that records no `rulesVersion` is stamped with the version it was authored under, and a revision stamped with an older one hears the rules added since as advisories ([Rules versions](evaluation/index.md#rules-versions)).

### Rebuilding an existing deck

`$RUNTIME_PYTHON runtime/import-deck.py deck.pptx <work>/` writes the inventory and a starter pages file whose pages carry stable ids, `sourceSlide` and the old copy as `draft` (`workflow: "existing_deck_revision"`, `inventory` on `deck`). Map each slide to a page type in place; the compiled plan records the inventory and each page's `sourceSlide`. A hidden slide's page carries `hidden: true` beside its `draft`, which mapping keeps ([hidden slides](composition.md#page-and-deck-keys)). The procedure is in [Storylining](storylining.md#revising-an-existing-deck).

There is one authored record of the deck. `author-deck.mjs` writes the other three from it: the deck spec, the plan, and the content plan (`<id>.content.json`). The content plan's claim is each page's title; its `settles` and `adds` come from the page; its text plan is the page's copy as composed, so chart labels, formatted values and cells no longer have to be listed by hand; its reading task is the page type's exhibit family (chart, table, diagram, exhibit, text) and whether the composed page has a commentary column.

The [content gates](#the-content-plan) then run in the same pass - claims that are topics, commentary that restates the exhibit, an answer no claim carries - and every page is held to its reading task's word floor and ceiling, set once when the page composes: a chart carrying its own callouts from about 42 words, a table with commentary from about 149 ([Word measures](evaluation/index.md#word-measures) says how the floor, the ceiling and the density checks relate). Do not edit the three written files; change the pages file and run it again.

## Evidence shapes

Each insight in `<id>.insights.json` records the `shape` of the data behind it, and a page type can only rest on evidence of its shape:

| Shape | Means | Carries |
| --- | --- | --- |
| `series` | one measure over six or more periods, or four for two or more series | trend, numbers, panels, lookup |
| `peer-set` | one measure for every member of the set, six or more | ranking, scorecard, profiles, numbers, panels, lookup |
| `mix` | the parts of a whole, three or more | composition, numbers, panels, lookup |
| `measure-pair` | two measures for each of eight or more members | relationship, scorecard, numbers, panels, lookup |
| `bridge` | three or more steps between two totals | bridge, numbers, panels, lookup |
| `geography` | places with coordinates or regions | place |
| `schedule` | dated phases, milestones or workstreams | schedule |
| `roster` | the named members and their attributes | profiles, scorecard, lookup |
| `fact` | a few measured numbers | numbers, panels, lookup |
| `qualitative` | sourced statements, judgements or mechanisms | scorecard and the text and diagram types |

With an insight log beside the pages file, every data-bearing page names its insights in `evidence`, and a ranking whose insights hold no peer set is refused: the missing data is a research task, found before the page is written rather than by the storyline critic or the review.

Each chart-bearing shape also records its breadth - `breadth: { periods, series }` for a series, `{ members }` for a peer set or measure pair, `{ parts }` for a mix, `{ steps }` for a bridge - or the `data` itself, from which the counts are read. A recorded `breadth` wins over the count read from `data`.

A mix's parts are what its chart splits the whole into. With one series, or none, each category, label, item or row is a part: a donut, pie, waffle, treemap, pictogram or one-series stacked bar over A, B and C is three parts. Where two or more series stack over the categories (stacked bar or column, marimekko), each category is a whole and the series are its parts. Where neither reading fits the data, record `breadth: { parts }`.

The log is refused when a shape is narrower than the table above says (a four-year series of one measure, a peer set of four), naming every such insight at once with what to find: the longer window, the peers' series, the rest of the set. An insight with no breadth recorded is refused with the keys to add; `fact`, `qualitative`, `roster`, `schedule` and `geography` need none.

`--check` and `--draft` print each page's budget as it composes - body words against the floor and ceiling for its reading task, the footer's share, how much of the body the page fills - with a `!` on every line to act on, so a fix does not push a page across a line unseen.

On a page split into columns the line also gives the room at the foot of each column that sets text, in lines of the page's body type (`room: left full, right 91px ≈ 4 lines`), and a column over its height is refused with the overflow in pixels and lines, so one edit lands rather than a point added and removed by trial.

A page that does not compile (`COMPILE`) is reported with the rest: the pages that do are still composed, gated and budgeted in the same run. Every run is logged beside the pages file; `--log` lists the findings that came back run after run, which are the limits or messages the skill should publish better.

Each budget line also gives the floor the page would carry with its commentary placed the other way (`with points beside or below floor 96`, `with no points (rail, captions, callouts) floor 42`): the reading task follows the placement, so moving a rail below can take a chart page's floor from 42 words to 96 or more, and the cost is seen before the move. The summary prints the types in page order (`sequence`), a run of one type folded to its ends.

`--icons` lists the icon names a point, a card or a row label can ask for (plane, ship, train, car, cart, home, heart and education among the business ones), with the other words each answers to - `aircraft`, `airport` and `flight` are `plane`. An unknown name is refused at compile with the nearest names.

`--types` prints the data each form reads (a pie or donut takes `labels` and `values`, a treemap `items`, a flow `nodes` and `edges`); the compiler names the missing keys, and refuses any page key the composer does not read, on every page at once.

The compiler checks what each type implies. A trend runs over four or more periods; a ranking shows four or more members; trend and ranking charts mark their finding on the plot; a scorecard codes at least one column in its form; `on-exhibit` needs `annotations`; `captions` needs a `caption` on every panel; a text-free placement refuses `points`, because it says the text lives somewhere else. Two or three numbers are a `numbers` page, not a chart, and not a panel either: a panel plotting two numbers is refused. A pie or donut with a part under 5% is refused for a waffle or a stacked bar; a metric strip sits over exactly one exhibit and takes commentary `none`, since its numbers and exhibit fill the page.

A period is a date (2025, FY25, Q1 2025, Jan 2025), a quarter or half within its year (Q1, H2), a span (2020-24, Jan-Mar) or a period with its qualifier (FY25 LTM, 2024 YTD); a trend's axis and the craft floor's chart over time are read by the same recogniser (`runtime/time-axis.mjs` isPeriodLabel), so "H3 2024" is a member, not a period, to both.

Each component's limits are published in `--types` (`holds:` - a donut takes two to five parts, cards two to six, steps three to six, a stat-list value nine characters and a fact-grid value ten) and checked at compile, with the capacities the renderer measures: a chart callout about ten words and a chart three callouts (a fourth note is commentary), a rail about 42 words (eight lines at heading size). Every `numbers` form sets its figures against one exhibit - the proof beside a hero number, the tiles of a grid, the chart under a strip.

The text limits the page gates enforce are published in `--types` too, so they are met by reading rather than by failing:

| Text | Limit | Code | Checked |
| --- | --- | --- | --- |
| `title` | [Action titles](copy.md#action-titles) owns the limit | `TITLE_WORDS` | at compile |
| `title` | two lines | `TITLE_LINES` | as the page composes |
| `subtitle` | one line, 16 words; not the title or an exhibit's heading restated | refused at compile | at compile |
| chart or panel `heading` | one line at the frame's width, unit inline | `HEADING_WRAPS` - a short unit moves under the heading on its own; a heading that wraps, or a unit written as a phrase, is reported with its measured width against the frame's | as the page composes |
| `takeaway` | one or two lines | `TAKEAWAY_LONG` | at compile, and as the page composes |
| `bar` | eight words or more, two lines | refused at compile | at compile |
| prose | 35 to 90 characters a line; points no wider than 90 | `CPL` | as the page composes |

A chart `heading` or `unit` names the measure, the population and the period, never a result. The numbers it may carry describe the measure: a period ("FY26", "2 August 2026"), a sample ("n = 240"), a set size ("top 40"), an index base ("2019 = 100") or a rank scale ("rank, 1 = best"). A refusal names the figure it read as a result ("53.2m"), which belongs on the mark or in an annotation.

What the runtime resolves and what it cannot, also printed in `--types` under "Chart limits":

- A highlighted member of a one-series bar chart - a `distribution`, every column of `aligned-bars`, a bar panel - is drawn as its bar in the accent, in PowerPoint's native chart too; columns keep the tint behind the category.
- A `distribution` names every member while its rows hold a line - at 10pt, then at 8pt - and past that every second or third row at full size; the highlighted member and any member a callout names are always named. `--types` prints how many members each size holds. It takes one callout, set beside its bar.
- A bridge carries three callouts beside a column or rail; over commentary `below` it is a third shorter and carries two.
- Panels in the same unit share one value scale, computed from every panel's values, negatives, reference lines and targets; they also share the tallest panel's callout band, so their plots stay one height. Panels in different units keep their own bands: annotate one and leave its neighbours plain.
- In a row of three or four, column panels thin period labels (FY17, 2019, Q1) to every second or third, and two-series lines name their series in a legend. Named columns are never dropped: `--types` prints how many a panel holds in a row of two, three and four.
- A callout takes free space inside the plot first - above a short mark, beside a line, in an empty corner, with its leader - and reserves a band above the plot only when the plot has none: each band took 88px of the plot's height. If one callout needs the band, they all take it, so their leaders stay clear of each other. Panels sharing one scale keep their shared band.
- Bar panels that read across (the same members) in different units take a callout in its bar's row - past the bar's end, past the axis for a bar below zero, or set inside a long bar - not in a band above the plot, which stood empty over the neighbour. Where the row has no room it takes a rail at its own panel's right; a panel in a row of three or four cannot spare one, so annotate a shorter bar there or say it in the caption.
- Points under a row of panels run in columns: one to a panel when they are as many, otherwise up to three across and four two by two. A single point is a paragraph at the prose measure.
- A combo's line on a second scale is drawn in a band above the bars; when that band leaves its change under 48px (callout bands take the plot's height) the page is refused for two panels, each on its own scale.

Each type also has a minimum it needs to be worth a page: a composition shows three or more parts, or the mix across two or more members or periods - a share of one thing is a numbers page; a timeline or roadmap has four or more dated items; a mechanism three or more parts; a relationship five or more members; a bridge a start, two steps and an end - and every chart page the evidence floor below. Small counts are counted, not shared out: fourteen cities as percentages of a pie overstates what the count can say - use form `waffle`, with the parts as `categories` and one series of whole counts.

On a page with commentary points, the finding in each point is marked: `highlight` takes a list, with the number or claim from each point the reader should see first, or a point carries its own `highlight`. A point left unmarked is marked on its own figure - its first percentage, amount or count, never a year - and a point with no figure is named in the advisories (`POINT_UNMARKED`), since the phrase that carries a qualitative point is the author's to choose.

The page's `highlight` is set wherever the page writes it: points and row blocks, paragraphs, a rail or side panel, the so-what bar and the takeaway, panel captions, and the cells of a table, a findings matrix (bulleted cells too) or a comparison. On a dark or filled panel where the accent does not read, the phrase is set bold in a regular sentence. A phrase that lands nowhere the page draws an accent - only in the title, a heading or a chart's callout - is refused.

Moving the explanation off the page's text column is a choice to write it somewhere else, not to drop it. Callouts on a chart carry ten or more words between them - the mechanism and the qualification, not labels - and each is measured against the chart's callout box, which holds about ten words (`--types` prints the capacity); every caption is a sentence of eight words or more that says what its panel shows and does not repeat the title or the panel heading; a rail is a developed claim of ten words or more. An executive summary with no exhibit renders as a list; give it `metrics` or an exhibit when the page would otherwise be half empty.

Choose the type from the claim, then the placement from where the reader's eye already is. The same evidence can take different pages: a peer comparison can be a ranking with callouts, panels of the same measure for three periods, or a scorecard. Pick the one whose reading task is the claim's, and then look at the neighbours - the page before and after should ask the reader to do something different.

## Evidence depth

Strong decks' chart pages plot a median of about 22 values (the middle half 10 to 48); a deck whose every chart is one series at its type's minimum plots about 5. The compiler counts what each page plots (`plottedValues`: bars, points on lines, dots, slices, a box's five figures, numeric cells; a waffle counts its parts, a chart group and a panels page the sum) and records it as `pageType.values`.

| Rule | Where | Threshold |
| --- | --- | --- |
| A chart page's floor | compile | 8 values on trend, ranking, composition, relationship and panels with a chart; a bridge 5 (its steps are the drivers it has); pie, donut, treemap and waffle not floored (one whole's parts) |
| `EVIDENCE_DEPTH` | variety contract | from eight chart pages, the median chart page plots 15 or more |

The refusal names how to deepen: the peer set, a prior period or a benchmark as a second series, a longer window. Three forms are built for many values:

| Form | What it draws | Holds |
| --- | --- | --- |
| trend `indexed` | the raw series, rebased by the compiler to 100 at `indexBase`, the `subject` in colour and its peers grey | 4 to 8 series |
| ranking `distribution` | the whole field sorted, the subject marked in `highlights` | 15 to 40 members, one series |
| ranking `aligned-bars` | several measures for the same members on one category axis, one headed bar column per measure (`series: [{ name, unit, values }]`) | 2 to 4 measures; 2 beside a text column; no callouts |

`--check` prints `plotted`: the chart pages, their median, range and the five thinnest.

## Codes and their repairs

A blocking code stops `author-deck.mjs` at exit 2 and nothing is written; an advisory is listed in the run's summary. Every refusal the page-type compiler raises is also printed by `--types`, and a finding's message names the page and the repair. Gate codes the build raises are in [Evaluation](evaluation/index.md#page-gates); a review's codes are in [Taste review](taste-review.md#the-rubric).

### Spine rules

| Code | Rule | Checked | Repair |
| --- | --- | --- | --- |
| `REQUEST_MISSING` | a new deck records the user's request verbatim as `request` on `deck` | draft and full | paste the user's words, not a restatement |
| `TITLE_GAP_SHARE` | titles stating what the evidence lacks, cannot settle or leaves undisclosed on more than 15% of the analytical pages | draft and full | lead with the way the evidence leans; the gap goes in the `subtitle` ([Answer under uncertainty](storylining.md#answer-under-uncertainty)) |
| `GENERATOR_SIGNATURE` | one non-trivial value of `why`, `settles`, `adds`, `takeaway`, `subtitle`, `rail` or `bar` on more than 60% of the pages | draft and full | write the field page by page, or leave an optional one out |
| `PILLAR_UNSUPPORTED` | a section whose pages rest on no `strong` insight | draft and full, with an insight log | find the evidence the pillar needs, or merge the pillar into one that has it |
| `MEASURES_MISSING` | an insight whose evidence is numbers (`series`, `peer-set`, `mix`, `measure-pair`, `bridge`, `fact`) records them only as a sentence | draft and full, with an insight log | give the insight its `measures`: the unit, the population, the periods or members, and the values ([Measures](storylining.md#extract-the-insights-before-the-titles)) |
| `ANALYSIS_REQUIRED` | the deck declares two or more `players` and no computed `compare` sets them all on common measures | draft and full, with an insight log | write `<id>.analysis.json` and run `node runtime/analysis.mjs <id>.pages.json` ([Run the analyses before the outline](storylining.md#run-the-analyses-before-the-outline)) |
| `ANALYSIS_UNRESTED` | a computed analysis no page names in `evidence` | advised | give the result its page, or cut the analysis |
| `WAIVERS_INVALID` | `waivers` on `deck` is a list of `{ code, reason }` naming a `BAR_*` code once each, each reason a sentence the reviewer can check | draft and full | fix the list, or drop the waiver and clear the bar |
| `REVISION_UNMAPPED` | a revision's imported slide still carrying only its `draft` copy | reported in a draft, refused in the full compile | give the slide a `type` and its choices, or delete it from `pages` |
| `REVISION_INVENTORY_MISSING` | a revision's `inventory` is not beside the pages file | draft and full | keep `<id>.inventory.json` where `import-deck.py` wrote it, beside the pages file |
| `TITLE_COUNT_ONLY` | a title that states a count with no comparator or consequence | advised | add what the count is against: a peer, a target, a prior period, or what follows from it |
| `POINT_UNMARKED` | a commentary point with no figure to mark and no `highlight` | advised | name the phrase the reader should see first in `highlight` |

### The evidence contract

Where the insight log records `measures`, every page with numbers on it says what its claim and its exhibits rest on, and the compile holds each to it (`runtime/gates/dependency_gates.mjs`). The rules read declared fields and numbers; no title is parsed. They block in the full compile and are reported in a draft, whose exhibits are not yet written.

```json
"settles": { "kind": "comparison", "what": "...", "measures": ["i-results/ocf", "i-results/pat"], "relation": { "kind": "gap" } },
"exhibit": { "type": "chart.line", "unit": "GBP m", "categories": ["FY24", "FY25", "FY26"], "series": [{ "name": "Operating cash flow", "values": [81, 84, 66] }],
             "basis": { "measures": ["i-results/ocf"], "role": "proof" } },
"metrics": [{ "value": "-21.4%", "label": "Operating cash flow", "basis": { "measures": ["A-ocf/percent"] } }]
```

`settles.measures` are the measures the claim is about. `basis` on an exhibit, a block's exhibit or a metric names the measures it plots and its `role`: `"proof"` of the claim (the default), or `"context"` beside it with the `relevance` a reviewer judges. A measure is named `<insight id>/<measure>`, or `<analysis id>/<measure>` for a result the runtime computed. `settles.relation` says what the reader reads between two of the claim's measures: `gap`, `ratio`, `levels`, `index`, or `separate` with its `reason`. A page that writes no `source` takes its citation from the `cite` keys of the insights it plots.

| Code | Rule | Repair |
| --- | --- | --- |
| `CLAIM_MEASURES_MISSING` | a page with a plotted exhibit does not say which measures its claim is about | name them in `settles.measures` |
| `BASIS_MISSING` | an exhibit that plots numbers names no measure | give it `basis: { measures, role }` |
| `BASIS_UNKNOWN` | a `basis` or `settles.measures` names a measure the log does not hold, or one from an insight the page does not name in `evidence` | name a recorded measure, and rest the page on the insight it comes from |
| `BASIS_UNIT` | the exhibit's `unit` is not the unit of any measure it names | plot the measure it names, or name the measure it plots |
| `BASIS_AXIS` | the exhibit's `categories` are not periods or members the measure runs over | plot the measure's own periods or members |
| `BASIS_VALUES` | a plotted series is not the values of any measure the exhibit names, at the precision the page prints | plot the recorded values; a number nobody recorded is an analysis to run or an assumption to state |
| `PROOF_OFF_CLAIM` | a `proof` exhibit plots no measure of the claim, nor one computed from it or it is computed from | plot the claim's measure, move the exhibit to the page it proves, or mark it `context` with its `relevance` |
| `PROOF_MISSING` | every exhibit is context and no metric names a measure of the claim | plot the claim's measure, or give the metrics that state it their `basis` |
| `CONTEXT_UNEXPLAINED` | a `context` exhibit with no `relevance` of six words or more | say what it tells the reader about this claim; the reviewer judges that sentence |
| `SOURCE_UNCITED` | `source` leaves out a `cite` key of an insight the page plots, or is typed text where the insights carry their citation | leave `source` out, or list the registry keys |
| `RELATION_UNDECLARED` | two measures of the claim, in one unit over the same periods or members, are drawn in separate exhibits and no `settles.relation` says what is read between them | declare the relation and draw it |
| `RELATION_SPLIT` | the claim asserts a `gap`, `levels`, `ratio` or `index` and each measure sits in its own exhibit; or `separate` gives no `reason` | set them on one scale or plot the computed result (`author-deck.mjs <pages> --repair-relation <page-id>` prints the merged exhibit), or declare `separate` with its reason |

### The content plan

The content gates run on the content plan the compile derives. They block unless marked advisory.

| Code | Rule | Repair |
| --- | --- | --- |
| `CONTENT_NO_CLAIM` | a title that names a topic rather than proving something | state the finding: subject, verb, magnitude or comparator ([Action titles](copy.md#action-titles)) |
| `CONTENT_ADDS_NOTHING` | `adds` empty, or built from the words of the exhibit it adds to | say what the commentary adds - the mechanism, the qualification, the consequence - or set commentary `none` |
| `CONTENT_CLAIM_REPEATS` | two pages make the same claim | merge them, or make the second prove the next step |
| `CONTENT_UNMEASURED` | more than a third of the pages settle on `qualitative` evidence (advisory); more than half blocks | research the pages whose claim is a quantity - a share, a rate, a rank, a count - and record what settles it |
| `CONTENT_ANSWER_UNCARRIED` | from eight pages, no claim carries the deck's `answer`, or the claims between them leave part of it unproved | state the answer in the opening page's title, or narrow it to what the deck settles |
| `CONTENT_ANSWER_CONTRADICTED` | a page recommends what the deck's unconditional answer rules out | name the condition in the answer, or change the page |
| `CONTENT_NO_HIGHLIGHT` | no page names the phrase its reader should see first (advisory) | set `highlight` where a claim names its exact target |
| `TEXT_COVERAGE_LOW` | a page's body under its reading task's floor | develop the missing reasoning, or move the page to the task it performs ([Word measures](evaluation/index.md#word-measures)) |
| `TEXT_BLOCK_TOO_LONG` | one run of prose past 152 words | split it where it stops proving one thing, and give the second half its own lead |

### Compile and compose

| Code | Rule | Repair |
| --- | --- | --- |
| `COMPILE` | a page whose type refuses its choices; the rest of the deck is still checked | the message names the key and the choice; `--scaffold <type>` prints a page that compiles |
| `PAGE_DOES_NOT_COMPOSE` | a page that compiles but cannot be laid out; every such page is reported in one run | the message names the overflow or the frame; shorten, split the exhibit or choose another form |
| `MAP_COARSE` | a place page whose markers span under twenty degrees on the built-in 1:110m coastline (advisory) | import a 1:10m or 1:50m geography with `runtime/import-geography.mjs` and pass it as the map's `geography` |

### Chart and figure forms

A chart or figure drawn where another form says the finding is refused with that form.

| Code | Rule | Repair |
| --- | --- | --- |
| `SCATTER_OVER_TIME` | a scatter whose x axis is time | a `trend` page, form `line`: the dates as categories, each series a line, a `referenceLines` entry for the level it is read against |
| `SCATTER_CURVE` | six or more points running one way as x grows, drawn as loose dots | `connect: true`, the series named at its end, and `referenceLines` for the break-even, parity line or hurdle |
| `LABELS_OFF` | `dataLabels: false` on twelve marks or fewer with no gridlines | drop `dataLabels: false`, or set `gridlines: true` where the shape is the point |
| `GUTTER_UNEARNED` | `implication: true` before a column whose header names another fact | drop `implication`, or head the column with the inference: "Implication", "What it means", "Verdict", "Decision" |
| `PILL_NO_VERDICT` | a status colour on a pill whose words say there is no verdict ("Split", "Unranked") | `value: "neutral"`, a grey pill ([Status colour](design.md#status-colour)) |
| `TILES_ONE_MEASURE` | one measure at two dates or for two members, set in separate tiles | plot it on one axis: a `trend` across the dates, a `ranking` across the members, or the chart the page carries; tiles are for measures that differ |
| `STRIP_REPEATS_CHART` | a metric strip that prints what its chart already prints | the strip carries what the chart does not - the change, the rate, the gap, a share of the total - or the page is the chart alone |
| `NUMBER_CARDS` | a one-column fact grid whose tiles carry no sentence | run the facts across (`columns` 2 to 4), or give every tile its `text` |

### What a review found, refused where the page is written

These defects pass every page gate and show only when the deck is read whole, so each is refused, or resolved by the runtime, where the page is written:

| Code | Where | Rule | What to do instead |
| --- | --- | --- | --- |
| `TABLE_PANELS_MERGE` | compile | two tables on one page with the same columns - a measure and its value, one table per member; when their rows name different measures the refusal lists each table's and every measure between them, since then nothing reads across | one table, the members as columns and every measure as a row, "n/a" where a member does not disclose one: each member is compared on the same measures, and the gap is the finding a substitute metric would hide |
| `TABLE_STACK` | compile | two or more tables with different columns set one above another - `panels` form `stack`, or tables in both rows of a `grid`. Side by side in a row they pass | one table with the members as columns, or one table with the other evidence as a chart or a strip of numbers beside or above it (`panels` form `row` with a chart, `numbers` form `metric-strip` over the table) |
| `TABLE_TOO_SHORT` | compile | a table of fewer than three body rows; a `profiles` logo table introducing two players, and a row block's small table, are exempt | set two or three figures as a numbers page (fact-grid, stat-list, metric strip), or two members side by side as profile cards or a compare |
| `COMPARISON_MEASURES_DIFFER` | compile | panels headed by different declared players, each on its own unit | one panel per measure, with the players as its bars or series and "n/a" where one does not publish it |
| `TOTAL_ROW_BLANK` | compile, compose | a table row labelled Total, Sum or Overall (or `style: "total"`) with nothing in its result cells; `total: true` on a table where no column adds up | a total row carries its computed total, or it is deleted. A measure table adds its own total only where a column sums - counts and amounts, not rates, shares, scores or text |
| `TIME_AXIS_UNEVEN` | compile | a column chart of four or more dated categories at uneven gaps (Jan, Mar, Jun, Aug; 2015, 2018, 2019, 2020) | a line or an area: the runtime places dated categories by the time between them, with a marker at every observation and the labels that fit. Or fill the missing periods, or name the columns as snapshots in the heading ("selected years") |
| `VERDICT_TABLE_PLAIN` | compile | on a `lookup`, `options` or `matrix` page, a column headed lead, leads, leader, winner, wins, edge, verdict, confidence, status, rating, score, ahead, behind, rag or assessment whose cells are short words ("Firm A", "Medium", "No verdict"); a header "A / B" over cells "a \| b" is read as two columns | give the column a `type` - `rag` (a status pill), `harvey` (a rating), `check`, `lights`, `dot` - or make the page a `scorecard`. Words the composer codes on its own (on track, wins, ✓) pass; where the column names who leads, declare the companies as `players` - a cell naming a player (its `name`, `short` or `aliases`) is drawn as its logo |
| `SCENARIO_PROSE` | compile | two to four alternatives - scenarios, options, paths, market structures - written as paragraphs, points, cards or row blocks of 60 words or more each | set them side by side on the same terms: `options` (compare, table-halves), `parallel` form `labelled-rows`, or a table whose columns are the trigger, who captures the value, the test that would show it and the signal against it |
| `SHARES_IN_TILES` | compile, advisory | two shares of one measure (their labels share two words) more than five times apart, set as metrics, fact-grid or stat-list tiles or cards | the shares on one 0-100% scale: a bar, a dumbbell or a slope |
| `VARIETY_TABLES` | variety contract | more than five of any ten consecutive analytical pages carry one table construction: the first column filled or open, the cells coded or text, a short or long grid, a band at the foot or none | draw each as its evidence: funding stages as a bridge or flow, commitments as bars aligned on their durations, verdicts as a scorecard, measures as a chart |
| `PLAYERS_UNMARKED` | variety contract | the deck declares two or more `players` - or, without them, two names recur in a fifth of its titles - and the cover and first three analytical pages do not show each one's logo | a `profiles` page (form `logos` or `logo-table`) or a `logo` column early; `{ alt: "<Name> logo" }` is fetched from the player's Wikipedia infobox |
| `PROFILE_UNPICTURED` | variety contract | a `profiles` page of cards with no logo or picture on any card | each card's `logo` or a credited `image` (`{ alt, search }`) |

Two word rules belong with them. An executive summary (`summary` form `executive-summary`) is held to the text page's upper quartile, 204 body words, rather than its outlier fence of 329 (`WORDS`): the summary is read first and in full. And `TEXT_BLOCK_TOO_LONG` reads a block as the reader meets it - a point's bold lead and its text are one run, and a card's text or a table cell is prose too - so a 171-word scenario no longer passes as a 40-word lead and a 131-word point.

### The variety contract

`author-deck.mjs` refuses to write a deck of twelve or more content pages that breaks these rules (exit 2, nothing written). The build refuses it too, because the rules run from the same code (`runtime/gates/variety_gates.mjs`):

| Code | Rule | Repair |
| --- | --- | --- |
| `PAGE_TYPE_UNDECLARED` | every content page has a page type | author the page in the pages file with its `type`, `form` and `commentary` |
| `PAGE_TYPE_EDITED` | the compiled structure is what the choices produce; the build recomputes it | change the choice in the pages file and recompile; never edit `<id>.deck.json` |
| `VARIETY_TYPE_SHARE` | no type is more than 25% of the pages | reread the commonest type's claims: a position in the set is a `ranking`, a mix a `composition`, one cut per member `panels` |
| `VARIETY_TYPE_RANGE` | at least one type per five pages, up to eight | find the claims the deck states in another type's shape - a rate, a mix, a mechanism, a schedule - and give them that type |
| `VARIETY_TYPE_RUN` | no three pages of one type in a row, unless they share a `series` (one template on purpose) | the finding names the run, the page to change, what its evidence could become and a page of another type it could trade places with |
| `VARIETY_COMMENTARY` | no placement is more than 30% of the pages; `beside` and `beside-left` count as one | move the explanation where the reader's eye already is: callouts on the chart, captions, the table's cells, or `none` |
| `VARIETY_TAKEAWAY` | at most 25% of pages close on a takeaway line or a so-what bar | drop the closes that restate the title; keep them where the implication goes beyond it |
| `VARIETY_PANELS` | from fifteen pages, at least 20% carry two or more exhibits, counted on the page as drawn: each panel of a row, grid, stack or sequence, a metric strip over its exhibit, the photograph under a `photo-backdrop` exhibit, the exhibit on each labelled row (aligned bars are one exhibit) | [Beyond one exhibit and a column](#beyond-one-exhibit-and-a-column) |
| `VARIETY_COLUMN` | from fifteen pages, at most 20% are one exhibit with a text column beside it - points beside or before it (`beside`, `beside-left`), a `rail`, or a hero number with its points beside its proof | [Beyond one exhibit and a column](#beyond-one-exhibit-and-a-column) |
| `VARIETY_SIGNATURE` | no one drawn page - its layout, how many exhibits of which family, a text column or points, a rail, its close - is more than 20% of the pages | the finding names the pages that share it; redraw those whose claim asks the reader something else |
| `EVIDENCE_DEPTH` | from eight chart pages, the median chart page plots 15 values or more | [Evidence depth](#evidence-depth): the peer set, a prior period or a benchmark as a second series, a longer window |
| `VARIETY_EXHIBIT_MIX` | each evidence family - chart, table, diagram, numbers, picture, text - within its band across the compiled pages (`runtime/weight.json` `plan.mixEnforced`) | move pages out of the family over its band into the form their evidence reads as: a table of a trend is a chart, a list of steps a mechanism |
| `VARIETY_EXHIBIT_RANGE` | enough kinds of exhibit for the deck's length: a floor of distinct exhibits per ten pages | draw each claim in the form its evidence is, from `--types`, rather than one exhibit restyled |

The limits sit outside what strong decks measure, so a deck that chose each page for its claim passes them with room. Placement and repetition are counted on the page as drawn, not as declared: a column on the left and one on the right are one placement to a reader, and a trend beside its points and a stat list beside its points are one page. The compiler records each page's drawn skeleton in its `pageType` (`skeleton`, and `drawn`: how many exhibits and whether it is an exhibit beside a column), and `VARIETY_SIGNATURE` names the pages that share the commonest.

Strong decks carry two or more exhibits on a quarter to a third of their pages and draw one exhibit beside a column on about one in eight; the floor sits under the first so a deck that chose its pages passes with room, and the cap sits half as high again as the second. `author-deck.mjs` prints the deck as drawn on every run - `structure`: the share on two or more exhibits, the share beside a column with the pages named, and every skeleton with its count - so a deck drifting toward one exhibit and a column is seen before it is refused. Do not rotate choices to meet them: a deck that breaks one has pages whose type was not chosen from the claim, and the fix is to ask of each such page what it has to show.

## Worked examples

`examples/page-types.pages.json` is a complete pages file - a fictional regional rail operator's growth plan, with illustrative numbers - that uses every page type at least once, with its `form`, `commentary`, `takeaway`, `why`, `settles` and `adds` filled in and each page's explanation written where its commentary says it lives. Do not read it whole: `author-deck.mjs --example <type>` prints the pages of one type. Copy the shape of the one you need and replace the content: the keys, the data shape its form reads and the length of its callouts, captions and points are the ones that compile and build.

Page `p10b` is labelled row blocks with a number on each row and `p24b` the same with a headed chart on each of two rows, `p13b` a ranking closed by a so-what bar, `p16b` three exhibits joined by arrows, `p07c` four panels of one indexed measure with a caption under each, `p06b` a chart on a card over the photograph of its subject (`photo-backdrop`), and `p25` a scorecard whose last column is each row's implication.
