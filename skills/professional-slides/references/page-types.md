# Page types

A deck is authored page by page as **page types**, in `<id>.pages.json`, and compiled into the deck spec. Each type is a reading task; each has choices with no defaults. The choices decide the page's structure, so variety is decided where it is cheap to change - in the pages file, before anything is drawn - not discovered in the render.

```bash
node runtime/author-deck.mjs --types              # the catalogue: every type, its forms and placements
node runtime/author-deck.mjs --schema             # JSON Schema for a pages file
node runtime/author-deck.mjs <id>.pages.json      # compile, compose in memory, gate; write <id>.deck.json and <id>.plan.json, or refuse
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
- `commentary` - where the explanation lives: `beside`, `beside-left` (a column), `below` (points under the exhibit), `rail` (one claim in a filled side panel, written as `rail`), `on-exhibit` (callouts on the chart, `annotations`), `in-exhibit` (in the table's cells, the matrix, the cards), `captions` (a `caption` under every panel) or `none` (the exhibit and title carry it);
- `takeaway` - `false`, or the closing sentence, kept for the page whose implication goes beyond its title;
- `why` - one sentence on why this type fits this claim;
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
| `panels` | one question for two to four cuts, side by side | row, grid, stack |
| `scorecard` | members judged against criteria, cells coded | harvey, heatmap, rag, lights, check, bars, progress, dot, trend, binary |
| `lookup` | measures to look up under their units | measure-table, table |
| `matrix` | findings down the side, evidence across | findings-matrix |
| `mechanism` | how a system works | flow, tree, cycle, steps, framework, layers, funnel, sankey, quadrants, ... |
| `schedule` | what happens when | timeline, gantt, roadmap |
| `numbers` | a few numbers that carry the claim | hero-number, metric-strip, fact-grid, stat-list |
| `parallel` | three to six parallel ideas (give each card an `icon` for icon columns) | cards, capsules, arrow-rows |
| `profiles` | who the players are, with their marks | logos, people, logo-table, cards |
| `place` | where things are | map |
| `picture` | what the subject looks like | picture-hero, picture-pair, picture-strip, photo-backdrop |
| `options` | options compared on the same terms | compare, table-halves, two-up |
| `argument` | reasoning in prose | memo, sidebar |
| `statement` | one sentence, or the voices behind it | statement, quotes |
| `summary` | the answer and its proof | executive-summary, takeaways |

The compiler then composes the deck in memory, as the build will, filling logos, photographs and places from what is already on disk. A composition error surfaces here rather than at the build, and the thin-page rule counts words on the composed pages with the build's own check, so the number the author sees is the number the build will see.

`--types` prints the data each form reads (a pie or donut takes `labels` and `values`, a treemap `items`, a flow `nodes` and `edges`); the compiler names the missing keys, and refuses any page key the composer does not read, on every page at once.

The compiler checks what each type implies. A trend runs over four or more periods; a ranking shows four or more members; trend and ranking charts mark their finding on the plot; a scorecard codes at least one column in its form; `on-exhibit` needs `annotations`; `captions` needs a `caption` on every panel; a text-free placement refuses `points`, because it says the text lives somewhere else. Two or three numbers are a `numbers` page, not a chart, and not a panel either: a panel plotting two numbers is refused. A pie or donut with a part under 5% is refused for a waffle or a stacked bar; a metric strip sits over exactly one exhibit and takes commentary `none`, since its numbers and exhibit fill the page.

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
| `VARIETY_COMMENTARY` | no placement is more than 40% of the pages |
| `VARIETY_TAKEAWAY` | at most 25% of pages close on a takeaway line |
| `VARIETY_PANELS` | from fifteen pages, at least 12% set two or more exhibits side by side |
| `VARIETY_SIGNATURE` | no one combination of type, placement and close is more than 15% of the pages |
| `THIN_PAGES_PLANNED` | fewer than 20% of pages (or fewer than five) fall under the deck's word floor on the composed page - a fifth, not the third the rendered deck is held to, because the render adds the empty-space findings words cannot see |

The limits sit outside what strong decks measure, so a deck that chose each page for its claim passes them with room. Do not rotate choices to meet them: a deck that breaks one has pages whose type was not chosen from the claim, and the fix is to ask of each such page what it has to show.
