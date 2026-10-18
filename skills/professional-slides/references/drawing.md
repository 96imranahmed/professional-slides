# Drawing

Each page draws its evidence once, in the form a reader expects for the claim. The catalogue of page types, their forms and the fields each reads comes from the CLI, not from this guide:

```bash
node runtime/author-deck.mjs --types                    # every type, its forms, what each holds
node runtime/author-deck.mjs --example ranking/bar      # a worked page
node runtime/author-deck.mjs --schema trend/line        # every field the form reads
node runtime/author-deck.mjs --scaffold composition     # a page that compiles, to fill in
node runtime/author-deck.mjs --icons                    # the icon names a page can use
```

A page names its `type`; its `form` defaults to the type's first and its `commentary` to the placement its own text asks for. Set either when the default is not what the page needs.

## Pick the obvious chart

Choose the chart a reader of this kind of document expects for this kind of claim. The obvious one is usually right: one scatter of runtime against score, one table of every category's scores, one waterfall for a change between two totals.

| The reader's question | Draw | Type, form |
| --- | --- | --- |
| Which is larger, and by how much? | Sorted bars | `ranking`, `bar` |
| How did a measure move over time? | A line; columns for a few periods | `trend`, `line` or `column` |
| How did members of different sizes move against their own starting point? | Indexed lines, the base period at 100 | `trend`, `indexed` |
| How does a total divide into parts, and how does the mix differ? | Stacked bars | `composition`, `stacked-bar` |
| What makes up the change between two totals? | Waterfall | `bridge`, `waterfall` |
| How do two measures move together? | Scatter; bubble for a third measure | `relationship`, `scatter` or `bubble` |
| Exact values a reader looks up and compares | A table | `lookup`, `table` or `measure-table` |
| Options judged against criteria | A scorecard | `scorecard`, `harvey`, `rag`, `check` |
| Which of many series moved? | Small multiples | `panels`, `small-multiples`; `trend`, `sparklines` |
| How a system works: stages, flows, causes | A diagram | `mechanism`, `flow`, `process`, `tree` |
| What happens when | A timeline or roadmap | `schedule`, `timeline`, `roadmap`, `gantt` |
| A few numbers that carry the claim | Figures, with the exhibit that proves them | `numbers`, `hero-number`, `metric-strip`, `fact-grid` |
| Several cuts of one question side by side | Panels | `panels`, `row` or `grid` |
| An argument in prose | A memo with its conclusion beside it | `argument`, `memo` |

Keep one table whole: a table of every category's scores reads better as one table than as three. Do not split a chart to make pages, and do not add a chart where a sentence says it.

## Show a comparison

A chart earns its page by showing a comparison the reader can see. Name it before drawing - what against what - and draw that comparison, not the data around it. These compare nothing, and `author-deck` refuses them (`runtime/chart-sense.mjs`):

- **A run that barely moves** (`SERIES_FLAT`): every series moves less than a tenth of the axis it is drawn on - often because a zero baseline or a second series at another level blew the axis out. The chart reads as a level. Say the level in the title or as figures; set the latest period's values side by side as bars where the point is how they compare; or plot what moves - the change on the period before, each series indexed to its first period, or a line whose axis starts near its values. A level set against a target line or band is exempt: it compares.
- **One comparison drawn as a long series** (`ONE_COMPARISON`): six periods or more whose only number marks are one change between the same two periods, while the periods between stay within those two and close to the straight line between them. Draw the two periods (two columns, or a `slope`) with the change on them, or give the periods between a mark of their own (a callout, an event, a band) where what happens there is the point.

One value drawn as a chart, or one period on a chart that joins periods, compares nothing either (`NO_COMPARISON`): two figures for one year are two columns side by side, or the figures themselves.

## Draw it honestly

- **Every position encodes a measure.** A scatter's axes are two measured quantities with their units; categories sit at fixed positions as labels. Do not jitter or offset marks to separate them; label them instead.
- **Bars and areas start at zero.** A line may start above zero when the change is the point; say so in the axis.
- **Show what was measured, no more.** Only a start and an end known: two bars or a slope, not a line with invented points. A rate repeated over years is a scenario, not a trend.
- **Keep kinds apart.** Actuals, estimates, forecasts and targets look different (`forecastFrom`, `assumedFrom`, `targets`); say the basis of each in the heading or a note.
- **Round for display, not before.** Compute from unrounded inputs; a total that disagrees with its parts as published keeps the published figures and a note.
- **Totals are the runtime's.** A waterfall bound to a measure marks its first and last members as totals; stacked charts print each stack's total unless `stackTotals: false`.

## Mark what matters

- **Highlight the subject.** `highlights: [{ category }]` lights the bar or point the page is about; `focusSeries` the line or the slope's line. The subject takes the palette's accent - the contrasting colour strong decks draw it in - on every chart; its peers keep the series colour where the subject stands out from it, and otherwise go to a neutral grey, lighter or darker than the subject so it is found without seeing hue. Other lines and points go grey.
- **Put the number on the chart** where it carries the claim: a growth rate (`cagr`), a change bracketed (`changeAnnotations`), a target line (`referenceLines`), a band (`bands`). A sentence callout (`annotations`) explains a mechanism at a mark; a chart holds three.
- **Treat a table's columns by what they hold.** A column of one kind of figure the rows are compared on - a CAGR, a margin, a growth rate - sits in matching bubbles (`columns[].bubble: true`); a column of amounts takes bars in its cells (`bar: true`); a grid of scores takes heat (`heat`); a closing "what it means" column is `implication: true`. `--schema lookup/table` lists every column treatment.
- **Colour means something.** Status red, amber and green mark a state or a verdict - on track, behind, met, missed - in a pill, a light, a check or a cross. Never colour a chart series, a player or a surface by status. A delta and a trend arrow are coloured by whether the move is good news: set `better: "down"` for a cost, churn or a wait.
- **Players carry their marks.** Declare the companies, places or products the deck compares in `players` on `deck`; a table cell naming one is drawn as its logo, outline or photograph.

## Where the words go

`commentary` places the explanation:

| `commentary` | Draws |
| --- | --- |
| `beside`, `beside-left` | a column of points beside the exhibit |
| `below` | points in a band under the exhibit |
| `rail` | one claim in a filled side panel (`rail`) |
| `on-exhibit` | the chart's own number marks and callouts |
| `in-exhibit` | the explanation in the exhibit's cells |
| `captions` | a finding under each panel (`caption` on each exhibit) |
| `so-what-bar` | one implication in a filled bar under the exhibit (`bar`) |
| `none` | the exhibit carries the page (types that hold one; `--types` lists each type's placements) |

**The point goes on the exhibit.** Strong decks annotate four chart pages in five and set a column of points beside under one in five: the title states the finding, and the mark it rests on carries a callout (`annotations`), a change mark (`changeAnnotations`, `cagr`) or a labelled reference line, with `commentary: "on-exhibit"`; a table carries it in an implication column (`in-exhibit`). Points over a chart or a table go where the page says - `beside` or `below` - and a page that writes them without saying is refused (`COMMENTARY_UNCHOSEN`): ask for the column where the page needs one, for instance two or three mechanisms the chart cannot show.

**A table carries its explanation in a column of the table, not a band under it.** Strong decks set nothing under a table but its notes: what a row means goes in a closing column (`implication: true`, with `commentary: "in-exhibit"`) or a description column, and a claim the whole table supports goes in its title, or in points beside the table (`beside`) where it needs more than the title holds.

A page closes on its exhibit unless it has a `takeaway` (one sentence, two lines at most). Most pages do not need one: the title carries the message. A filled bar under the exhibit (`so-what-bar`) is rarer still - one strong page in ten - and belongs to the page whose implication its title cannot hold, such as the deck's last.

## What a page holds

The frame sets hard limits - a chart's three callouts, a rail's eight lines, a pie's five parts, a labelled-rows page's five rows - and `--types` and `--limits <type>/<form>` print them. A page that does not fit is refused with what to change; a table past the rows a page holds continues on the next page with its header repeated (`PAGE_SPLITS`, advised). Text that overlaps, a heading that wraps where it should fit, type too small for its role or set where it cannot be read is refused at the build with the page and the element.

A band of the page left empty is advised (`SCENE_VOID`). On cards, tiles and small multiples the first lever is the count a row, `exhibit.columns`: fewer a row stand taller and take the height, more a row take the width. Elsewhere, give the exhibit the height or move the commentary beside it.

**Components without a page form.** Seven components are strips or bands that cannot fill a page; each reaches one as an exhibit of a `panels` page: `journey` (stages and their touchpoints) and `highlight-strip` (numbered findings) across a short row of a dashboard; `icon-trends`, `speech` and `status-list` beside the exhibit they explain; `logo-collage` naming a set's members in a dashboard cell; and `worksheet`, blank by design, beside its worked example in a `panels` row.

## Pictures and maps

A recognisable subject - a product, a place, a company - carries its pictures: `picture` pages, a photograph behind a statement, logos in tables. The build fetches the logos and photographs a deck plans, with their credits, unless the deck says `assets: { fetch: "none", reason }`; a frame left empty is refused (`UNSOURCED_PICTURE`). `place` form `map` draws a footprint, a network or a regional pattern; [Geography](geography.md) covers maps of regions the runtime does not ship.

## Look at the result

The checks catch what a program can count. They do not see a chart that answers the wrong question, a page that repeats the last one, or a label that reads oddly. Open every rendered page in `out/rendered/` and read it as the reader would.
