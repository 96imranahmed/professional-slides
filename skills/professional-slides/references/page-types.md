# Page types

A deck is authored page by page as **page types**, in `<id>.pages.json`, and compiled into the deck spec. Each type is a reading task; each has choices with no defaults. The choices decide the page's structure, so variety is decided where it is cheap to change - in the pages file, before anything is drawn - not discovered in the render.

```bash
node runtime/author-deck.mjs --types              # the catalogue: every type, its forms and placements
node runtime/author-deck.mjs --schema             # JSON Schema for a pages file
node runtime/author-deck.mjs <id>.pages.json      # compile, compose in memory, gate; write <id>.deck.json, .plan.json and .content.json, or refuse
```

## Why types, not layouts

A deck written straight into the spec takes the composer's defaults on every page. Fifty pages written through one helper - title, three points, a closing line, one exhibit - all came out as one page: a closing line on every page and bullets under the exhibit on nearly all of them. The composer could draw callouts on the chart, captions under panels, findings matrices, coded scorecards and side rails; nothing asked the author to choose them.

Strong consulting decks spread the same decisions across the deck. On 123 of their content pages:

| Decision | Strong decks | The deck that prompted this |
| --- | --- | --- |
| Commonest page type | 23% (single annotated chart), then panels side by side 21% | one skeleton throughout |
| Where the explanation lives | nowhere beyond the title 27%, in the table 20%, on the chart 16%, under each panel 16%, beside the exhibit 13%, in a band 7%, bullets under the exhibit 2% | bullets under the exhibit on ~95% |
| Closing takeaway line | 9% (a standfirst under the title on another 15%) | 100% |
| Two or more exhibits | 24% | 9% |
| Chart pages marking something on the plot | 80% | under half |

## Writing a page

```json
{ "id": "p07", "type": "trend", "form": "line", "commentary": "on-exhibit", "takeaway": false,
  "why": "The recovery's shape is the claim; the break and the plateau are marked where they happen",
  "title": "Passenger recovery plateaued near 53 million rather than returning to 59 million",
  "exhibit": { "heading": "Emirates passengers", "unit": "million",
    "categories": ["FY19", "FY20", "FY21", "FY22", "FY23", "FY24", "FY25", "FY26"], "series": [{ "name": "Passengers", "values": [58.6, 56.2, 6.6, 19.6, 43.6, 51.9, 53.7, 53.2] }],
    "annotations": [{ "category": "FY21", "text": "Pandemic low of 6.6m as the network was grounded" }, { "category": "FY26", "text": "Still 5.4m below FY19: seats, not demand, now bind" }] },
  "source": "Source: Emirates Group annual reports, FY2018-19 to FY2025-26" }
```

Every analytical page carries:

- `type` - the reading task (below);
- `form` - which exhibit or construction carries it; the form sets the exhibit's `type`;
- `commentary` - where the explanation lives: `beside`, `beside-left` (a column), `below` (points under the exhibit), `rail` (one claim in a filled side panel, written as `rail`), `on-exhibit` (callouts on the chart, `annotations`), `in-exhibit` (in the table's cells, the matrix, the cards, the row blocks), `captions` (a `caption` under every panel), `so-what-bar` (one implication in a filled bar under the exhibit, written as `bar`) or `none` (the exhibit and title carry it);
- `takeaway` - `false`, or the closing sentence, kept for the page whose implication goes beyond its title (`false` on a `so-what-bar` page: the bar is its close);
- `why` - one sentence on why this type fits this claim;
- `settles: { kind, what }` - what settles the claim and what kind of thing it is (`count`, `share`, `rank`, `rate`, `sequence`, `comparison`, `structure`, `qualitative`). With an insight log, name the insights instead - `evidence: ["i3", "i7"]` - and `settles` is derived from them;
- `adds` - what the commentary says that the exhibit cannot, or `null`;
- the content: `title`, `exhibit` or `exhibits`, `points`, `rows`, `kpi`, `metrics`, `pictures`, `source`, `highlight`, `subtitle` and the other slide keys.

The compiler owns `layout`, `shape`, `arrange` and `soWhat`, and writes a `pageType` record on each compiled slide: the type, its choices and the structure they produced. Writing those keys by hand is refused. The build recomputes each page's structure and refuses a deck whose compiled structure was edited after compiling (`PAGE_TYPE_EDITED`): change the choice in the pages file and recompile.

Structural pages stay as they are: `{ "kind": "section", "title": ..., "summary": ... }` or `{ "kind": "agenda", ... }`.

## The types

| Type | Reading task | Forms |
| --- | --- | --- |
| `trend` | a measure over four or more periods, its rate or break marked | line, column, stacked-column, area, stacked-area, combo, slope |
| `ranking` | the whole set on one measure, the subject marked | bar, column, lollipop, dumbbell, bullet |
| `composition` | what a whole is made of | stacked-bar, stacked-column, marimekko, waffle, donut, treemap, pie |
| `relationship` | two measures across the members | scatter, bubble, bubble-grid |
| `bridge` | what a change between totals is made of | waterfall |
| `panels` | one question for two to four cuts, side by side | row, grid, stack, sequence |
| `scorecard` | members judged against criteria, cells coded | harvey, heatmap, rag, lights, check, bars, progress, dot, trend, binary |
| `lookup` | measures to look up under their units | measure-table, table |
| `matrix` | findings down the side, evidence across | findings-matrix |
| `mechanism` | how a system works | flow, tree, cycle, steps, framework, layers, funnel, sankey, quadrants, ... |
| `schedule` | what happens when | timeline, gantt, roadmap |
| `numbers` | a few numbers that carry the claim | hero-number, metric-strip, fact-grid, stat-list |
| `parallel` | three to six parallel ideas (give each card an `icon` for icon columns) | cards, capsules, arrow-rows, labelled-rows |
| `profiles` | who the players are, with their marks | logos, people, logo-table, cards |
| `place` | where things are | map |
| `picture` | what the subject looks like | picture-hero, picture-pair, picture-strip, photo-backdrop |
| `options` | options compared on the same terms | compare, table-halves, two-up |
| `argument` | reasoning in prose | memo, sidebar |
| `statement` | one sentence, or the voices behind it | statement, quotes |
| `summary` | the answer and its proof | executive-summary, takeaways |

## Beyond one exhibit and a column

A generated deck drew two pages in five as one exhibit with a text column beside it; strong decks draw about one in eight that way and put a quarter of their pages on two or more exhibits. Three pages carry what those columns were holding:

| Page | Choose it for | Write |
| --- | --- | --- |
| Labelled row blocks - `parallel`, form `labelled-rows` | three challenges, what changed in each area, a diagnosis: parallel ideas that each have evidence | `blocks`: two to five `{ label, points }`, and on every row or none a `metric` `{ value, label }` or a small `exhibit` at the right |
| Exhibits joined by arrows - `panels`, form `sequence` | cause and effect, before and after, input to adjustment to result | two or three `exhibits`, each with its `heading`; commentary `captions`, `below`, `so-what-bar` or `none` |
| So-what bar - commentary `so-what-bar` | an exhibit whose implication goes beyond the title and is one sentence | `bar`: eight words or more, two lines at most; `takeaway: false` |

Each row block is a filled label on the house colour - five words at most, read down the left edge as the page's outline - with two to four bullets beside it; the rows share the body height, so the page fills to its foot. The commentary is `in-exhibit`, since the bullets are the explanation, or `so-what-bar` to close the rows on what they add up to. A headed chart at the right of a row keeps its plot only on a page of two blocks; on three or more, give each row a number or a two-row table.

The bar is drawn in the house colour with the implication in bold white, in every design system. It is a close, so it counts toward the closing share with the takeaway line: a deck cannot close every page by moving the line into a bar.

The compiler then composes the deck in memory, as the build will, filling logos, photographs and places from what is already on disk. Every page that fails to compose is reported in the same run, not one per build.

## The pages file is the dot-dash

Write it in two passes. `--draft` compiles the title spine with its page types, data and evidence, and writes the deck for the [storyline critique](storylining.md#stress-test-the-storyline) with the word floors reported rather than enforced; the copy - callouts, captions, points - is written after the critique, and the full compile holds it to every rule. A new deck cannot be built from a draft: the build holds its content plan to the complete text contract.

There is one authored record of the deck. `author-deck.mjs` writes the other three from it: the deck spec, the plan, and the content plan (`<id>.content.json`). The content plan's claim is each page's title; its `settles` and `adds` come from the page; its text plan is the page's copy as composed, so chart labels, formatted values and cells no longer have to be listed by hand; its reading task is the page type's exhibit family (chart, table, diagram, exhibit, text) and whether the composed page has a commentary column.

The content gates then run in the same pass - claims that are topics, commentary that restates the exhibit, an answer no claim carries - and every page is held to the lower quartile of body words for its reading task (`TEXT_COVERAGE_LOW`): a chart carrying its own callouts from about 42 words, a table with commentary from about 149, less the share of the body a photograph holds. The ceiling (`WORDS`) is the task's outlier fence on the same count - the upper quartile plus one and a half times the spread. Both are set once, when the page composes (`wordFloor`, `wordCeiling` on the scene), and every check reads them: the budget line, `THIN_PAGE`, `WORDS` and the text contract cannot disagree about a page. Do not edit the three written files; change the pages file and run it again.

## Evidence shapes

Each insight in `<id>.insights.json` records the `shape` of the data behind it, and a page type can only rest on evidence of its shape:

| Shape | Means | Carries |
| --- | --- | --- |
| `series` | one measure over four or more periods | trend, numbers, panels, lookup |
| `peer-set` | one measure for every member of the set | ranking, scorecard, profiles, numbers, panels, lookup |
| `mix` | the parts of a whole | composition, numbers, panels, lookup |
| `measure-pair` | two measures for each member | relationship, scorecard, numbers, panels, lookup |
| `bridge` | the steps between two totals | bridge, numbers, panels, lookup |
| `geography` | places with coordinates or regions | place |
| `schedule` | dated phases, milestones or workstreams | schedule |
| `roster` | the named members and their attributes | profiles, scorecard, lookup |
| `fact` | a few measured numbers | numbers, panels, lookup |
| `qualitative` | sourced statements, judgements or mechanisms | scorecard and the text and diagram types |

With an insight log beside the pages file, every data-bearing page names its insights in `evidence`, and a ranking whose insights hold no peer set is refused: the missing data is a research task, found before the page is written rather than by the storyline critic or the review.

The summary lists advisories the compiler can see without blocking: `MAP_COARSE` names a place page whose markers span under twenty degrees on the built-in 1:110m coastline, which is coarse at that scale - import a 1:10m or 1:50m geography with `runtime/import-geography.mjs` and pass it as the map's `geography`.

`--check` and `--draft` print each page's budget as it composes - body words against the floor and ceiling for its reading task, the footer's share, how much of the body the page fills - with a `!` on every line to act on, so a fix does not push a page across a line unseen. A page that does not compile is reported with the rest: the pages that do are still composed, gated and budgeted in the same run. Every run is logged beside the pages file; `--log` lists the findings that came back run after run, which are the limits or messages the skill should publish better.

`--types` prints the data each form reads (a pie or donut takes `labels` and `values`, a treemap `items`, a flow `nodes` and `edges`); the compiler names the missing keys, and refuses any page key the composer does not read, on every page at once.

The compiler checks what each type implies. A trend runs over four or more periods; a ranking shows four or more members; trend and ranking charts mark their finding on the plot; a scorecard codes at least one column in its form; `on-exhibit` needs `annotations`; `captions` needs a `caption` on every panel; a text-free placement refuses `points`, because it says the text lives somewhere else. Two or three numbers are a `numbers` page, not a chart, and not a panel either: a panel plotting two numbers is refused. A pie or donut with a part under 5% is refused for a waffle or a stacked bar; a metric strip sits over exactly one exhibit and takes commentary `none`, since its numbers and exhibit fill the page.

Each component's limits are published in `--types` (`holds:` - a donut takes two to five parts, cards two to six, steps three to six, a stat-list value nine characters and a fact-grid value ten) and checked at compile, with the capacities the renderer measures: a chart callout about ten words and a chart three callouts (a fourth note is commentary), a rail about forty words (eight lines at heading size). Every `numbers` form sets its figures against one exhibit - the proof beside a hero number, the tiles of a grid, the chart under a strip.

Each type also has a minimum it needs to be worth a page: a composition shows three or more parts, or the mix across two or more members or periods - a share of one thing is a numbers page; a timeline or roadmap has four or more dated items; a mechanism three or more parts; a relationship five or more members; a bridge a start, two steps and an end. Small counts are counted, not shared out: fourteen cities as percentages of a pie overstates what the count can say - use form `waffle`, with the parts as `categories` and one series of whole counts.

On a page with commentary points, mark the finding in each point: `highlight` takes a list, with the number or claim from each point the reader should see first, or a point carries its own `highlight`. A single phrase lights one point and leaves the rest grey. A phrase that appears in no point is refused in a draft too, once the points are written.

Moving the explanation off the page's text column is a choice to write it somewhere else, not to drop it. Callouts on a chart carry ten or more words between them - the mechanism and the qualification, not labels - and each is measured against the chart's callout box, which holds about twelve words; every caption is a sentence of eight words or more that says what its panel shows and does not repeat the title or the panel heading; a rail is a developed claim of ten words or more. An executive summary with no exhibit renders as a list; give it `metrics` or an exhibit when the page would otherwise be half empty.

Choose the type from the claim, then the placement from where the reader's eye already is. The same evidence can take different pages: a peer comparison can be a ranking with callouts, panels of the same measure for three periods, or a scorecard. Pick the one whose reading task is the claim's, and then look at the neighbours - the page before and after should ask the reader to do something different.

## The variety contract

`author-deck.mjs` refuses to write a deck of twelve or more content pages that breaks these rules. The build refuses it too, because the rules run from the same code (`runtime/gates/variety_gates.mjs`):

| Code | Rule |
| --- | --- |
| `PAGE_TYPE_UNDECLARED` | every content page has a page type |
| `VARIETY_TYPE_SHARE` | no type is more than 25% of the pages |
| `VARIETY_TYPE_RANGE` | at least one type per five pages, up to eight |
| `VARIETY_TYPE_RUN` | no three pages of one type in a row, unless they share a `series` (one template on purpose) |
| `VARIETY_COMMENTARY` | no placement is more than 30% of the pages; `beside` and `beside-left` count as one |
| `VARIETY_TAKEAWAY` | at most 25% of pages close on a takeaway line or a so-what bar |
| `VARIETY_PANELS` | from fifteen pages, at least 12% set two or more exhibits side by side |
| `VARIETY_SIGNATURE` | no one drawn page - its layout, how many exhibits of which family, a text column or points, a rail, its close - is more than 20% of the pages |

The limits sit outside what strong decks measure, so a deck that chose each page for its claim passes them with room. Placement and repetition are counted on the page as drawn, not as declared: a column on the left and one on the right are one placement to a reader, and a trend beside its points and a stat list beside its points are one page. The compiler records each page's drawn skeleton in its `pageType`, and `VARIETY_SIGNATURE` names the pages that share the commonest. Do not rotate choices to meet them: a deck that breaks one has pages whose type was not chosen from the claim, and the fix is to ask of each such page what it has to show.

## Worked examples

`examples/page-types.pages.json` is a complete pages file - a fictional regional rail operator's growth plan, with illustrative numbers - that uses every page type at least once, with its `form`, `commentary`, `takeaway`, `why`, `settles` and `adds` filled in and each page's explanation written where its commentary says it lives. Before writing a page, find the example page of the type you are writing, copy its shape, and replace the content: the keys, the data shape its form reads and the length of its callouts, captions and points are the ones that compile and build. Page `p10b` is labelled row blocks with a number on each row, `p13b` a ranking closed by a so-what bar, and `p16b` three exhibits joined by arrows.
