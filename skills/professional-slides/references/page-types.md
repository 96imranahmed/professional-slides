# Page types

A deck is authored page by page as **page types**, in `<id>.pages.json`, and compiled into the deck spec. Each type is a reading task; each has choices with no defaults. The choices decide the page's structure, so variety is decided where it is cheap to change - in the pages file, before anything is drawn - not discovered in the render.

```bash
node runtime/author-deck.mjs --types                       # the catalogue: every type, its forms, placements, limits and data
node runtime/author-deck.mjs --example <type>[/<form>]     # the worked pages of a type, or of one form, to copy the shape of
node runtime/author-deck.mjs --scaffold <type>[/<form>] [--evidence <insight-id>]   # a page of that type that compiles, to fill in; with an insight, bound to its measures
node runtime/author-deck.mjs --schema [type]               # JSON Schema for a pages file, or for one type's page (with its limits as `x-limits`)
node runtime/author-deck.mjs --schema deck                 # every deck-level key `deck` takes: its type and what it is for
node runtime/author-deck.mjs [<id>.pages.json] --limits [<type>[/<form>]]   # every countable limit: the deck's, or one type's or form's
node runtime/author-deck.mjs --icons                       # the icon names a point, card or row label can ask for
node runtime/author-deck.mjs <id>.pages.json --plan        # before the pages are written: a form and placement for each page that satisfies the deck's structure rules as far as the pages declare what they draw
node runtime/author-deck.mjs <id>.pages.json --draft       # the spine: titles, claims, types, insights, and that every exhibit it declares can be drawn; write the deck for the critique
node runtime/author-deck.mjs <id>.pages.json --check       # compile and gate, print where the deck stands and the page budgets; no deck is written (the run log and the fit cache are)
node runtime/author-deck.mjs <id>.pages.json --check --page <id>[,<id>...]   # the same, reported for those pages against the whole deck
node runtime/author-deck.mjs <id>.pages.json --check --render   # the final check: the build's own render and gates, in a temporary folder
node runtime/author-deck.mjs <id>.pages.json               # compile, compose in memory, gate; write <id>.deck.json, .plan.json and .content.json, or refuse (exit 2)
node runtime/author-deck.mjs <id>.pages.json --log         # what the compile and plan runs so far cost: runs and refusals by mode, code and page, and what recurred
```

Start a page from `--example <type>` (or `--example <type>/<form>`, such as `ranking/boxplot`) or `--scaffold <type>` rather than from the whole worked example file: each prints one page, with the keys and the data shape its form reads. Every form in the catalogue has a worked page, and a test holds each to compiling and composing as the only page of a deck and passing the scene's page gates and its own text plan. That is a check with no insight log and no render: a worked page declares no measures, so the evidence contract and the render's gates are not part of it.

`--scaffold <type> --evidence <insight-id>` binds the page to the insight wherever its measures fill a form of the type - the first form they fill, or the one `<type>/<form>` asks for - and says on stderr what it bound (`Bound to ...`, with any figure still the example's own) or that it fell back to the worked example and why, form by form (`Not bound to ...`).

**Limits before writing.** Each page `--example` and `--scaffold` print ends in a `limits` block: every countable limit that page is held to, read from the constants the checks read (`runtime/limits.mjs`).

- On every page: title words (and the fewest a claim takes) and lines, subtitle words, takeaway, source and note lines, the longest block of text, and the body-word floor and ceiling for the reading task its commentary placement makes it.
- Where they apply: what its exhibit holds (items, series, value characters), the fewest plotted values, periods and members, the rail's, bar's, captions' and callouts' words, a labelled row's points.
- `--limits` prints the deck's: the same copy limits, a section title's lines, how many sections each contents style holds, the answer's shares and every reading task's word budget. `--limits <type>[/<form>]` prints one page's without a scaffold, and `--schema <type>` carries them as `x-limits`.
- Named after a pages file, the limits are that deck's: the word budgets under its `density`, and `sectionTitle` as the composer measures it on the deck's own dividers - its design, variation, tracker and sections - in words and characters. A numbered divider with the contents beside it holds fewer words than the house default.
- An entry marked `measured` is a pixel capacity given in words of ordinary prose, to write to rather than to count against.

The compiler reads past a page's `limits` block, so a scaffold pasted whole still compiles; delete it once the page is written.

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

**Sources are written once.** A `sources` registry beside `deck` and `pages` - `{ "reports": { "name": "Northvale Rail annual reports, FY19-FY26", "url": "...", "status": "audited" } }` - lets a page cite by key: `"source": ["reports", "survey"]` is set as "Sources: Northvale Rail annual reports, FY19-FY26 (audited); ...". `status` says how far the source can be relied on (audited, company-reported, press report, estimate). An unknown key is refused with the keys the registry holds; `source` as text still works. A `name` is a title - the publisher, the publication and its year - of 16 words at most, and a `short` of 8 (`--limits` prints both); a longer one is refused at the compile, because a caveat, a scope or a method is a `note`, where it is counted.

A citation written from keys is the runtime's to fit. The footer as drawn counts toward `NOTE_HEAVY` whoever wrote it, so the runtime sets its own line in the fullest form that keeps the footer's three lines and the words the page's footer has room for under that bar, given the page's `note` and footnotes:

1. the full names with their statuses;
2. each source's `short` name where the registry gives one (`"short": "Annual reports"`);
3. the statuses dropped;
4. the leading names with the rest counted ("+3 more in the notes");
5. the count alone ("4 records, listed in the notes").

The full citation goes to the page's speaker notes. Such a line never fails a page to compose, and only a page whose body is a handful of words can be `NOTE_HEAVY` on it alone. What the author writes in the footer (a typed `source`, `note`, `footnotes`) is counted in full and is not shortened; a typed citation past three lines is still refused. A registry `name` and `short` are a title and `status` a label, each refused past its word limit (`--limits`). The compiled slide carries the forms as `sourceForms`, which the compiler writes and a page does not.

**A pages file can be assembled from parts.** An entry of `pages` or `appendix` written as `{ "include": "pages/economics.pages.json" }` stands for the pages of that file, spliced in at that place and in order, so the sections of a deck can be written by several workers at once without one JSON file between them.

- A part is `{ "pages": [...] }`. It may include further parts, and may carry the `sources` its pages cite, which join the registry (one key, one source: the same key with a different entry is refused, with both files). Paths are relative to the file that names them and stay inside the folder of the pages file: a part outside it (`../`, an absolute path, a link that leads out of it) is refused, as is one part included twice. A part that is not JSON is named in one line. The deck-level keys (`deck`) stay in the main file.
- A page id is written once across the parts - a second is refused with both places - and a finding on a page from a part names the part file to edit.
- Every command that compiles a pages file reads it this way; `preferences.mjs apply` and `analysis.mjs` read only `deck` and leave the includes as written.

**Nothing is stamped.** Metadata written the same on most pages - one `why`, one `settles`, one `adds` - was written by a loop, not chosen for the page; past 60% of the pages it is refused (`GENERATOR_SIGNATURE`). Leave optional fields out rather than stamping a default, and write the required ones page by page.

### The standfirst

`subtitle` is one line under the title, 16 words at most, set small and in the secondary colour above the title rule. A fifth of strong analytical pages carry one. It says what the title leaves out so the title can stay a claim:

- the measure and its unit - "Share of seats filled on weekday trains";
- the population - "all five lines", "regional operators with 50 or more depots";
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

Write it in two passes. `--draft` compiles the spine and writes the deck for the [storyline critique](storylining.md#stress-test-the-storyline): a draft refuses everything the full compile would refuse whose repair changes what the critique is bound to, and leaves the rest to the layout. Each finding code records what its repair writes (the repairs table in `runtime/gates/gate_classes.mjs`), set against the binding's own field list (in `runtime/storyline.mjs`: the request, the answer, the pages, and each page's title, type, `settles`, `evidence`, `basis`, view and record):

- **held in a draft**: a finding every repair of which changes a bound field - the spine rules, the dependency contract on declared facts (`RELATION_UNDECLARED`, `RELATION_SPLIT`, `PROOF_OFF_CLAIM`, `CONTEXT_UNEXPLAINED`, `CLAIM_MEASURES_MISSING`, the `BASIS_*` codes, `BINDING_UNRESOLVED`), a structure rule only the page types can mend (`VARIETY_TYPE_SHARE`, `VARIETY_TYPE_RANGE`, `NO_SUMMARY`, `NO_SECTIONS`, `NO_CONTENTS`), and a structure rule no allocation of forms and placements satisfies (the plan's search says so);
- **left to the full compile**: a finding the copy, the layout or the fit can settle - word floors and ceilings, the page gates' bands, a missing callout or caption, a structure rule some allocation still satisfies. They are printed last, grouped as `settled by the copy` (or the layout, or the fit) with a count a code and the pages, and are `deferred` in the JSON summary; nothing on those lines is a fact the critique binds;
- **decided by proof** where a code can be either: a page that does not compose is refused as `SPINE_UNDRAWABLE` when an exhibit the spine fully determines cannot be drawn (below), and `PROOF_MISSING` is held once the page's exhibits are all drawn and still prove nothing of the claim.

A page whose exhibit is not written yet compiles with the refusal it will meet recorded (`deferred to the full compile`), and is read for the structure rules as its choices declare it, the way `--plan` reads it.

With an insight log, `--draft` prints the page types each insight's shape can carry (`insightTypes`). The copy - callouts, captions, points - is written after the critique, and the full compile holds it to every rule. A new deck cannot be built from a draft: the build holds its content plan to the complete text contract.

**What the critique binds is proven layable first.** Every run - `--draft` and `--plan` among them - composes each title the critique is bound to where this deck's design, variation, tracker and sections set it: every section's divider, the contents page, the tracker's labels and each page's title band, and the cover with them. One that does not fit is refused (`SPINE_UNFIT`) with the room it has, in words and characters of the title as written. So a spine that passes its draft meets no later refusal whose repair is to change a title. A statement page's sentence and every other piece of copy are the layout's.

**So is every exhibit the spine determines.** A bound or typed chart, a `basis` stub's view and a measure read whole are fixed by the insight log, so `--draft` and `--plan` prove each drawable before the critique reads it (`SPINE_UNDRAWABLE`):

- a drawn chart is compiled and composed alone under the deck's settings, with placeholder copy at a developed length; one the form refuses is tried as the type's other chart forms, and the refusal names the measure and its members or periods with no value;
- a view not yet drawn is read as `readings` reads it: one that would plot a member or period the measure does not disclose is refused, and the repair names the bound choice - `select: { members: [...] }` (or `periods`) naming the disclosed ones, a stub's `labels`, or a table, which shows an undisclosed cell as a dash;
- a page whose exhibit the compile refuses on its evidence is tried in every form of its type; where none holds what the spine draws there, the type or the view is wrong for the evidence;
- the executive summary is composed at its word ceiling with the exhibit the spine declares for it, and refused where a band of the page still stands empty (`SPINE_UNFILLED`): words alone do not fill that page, so its table or metrics are written at the spine, where the critique reads them (a `basis` stub declares the exhibit too, and is proven once its rows are written).

The probes compose with placeholder copy, so what they refuse no copy can mend. A spine that passes `--draft` is laid out by adding copy, layout and unbound content only.

**The deck-level keys** are listed by `--schema deck`, each with its type and what it is for, from the table the compile holds `deck` to: a key the table does not hold is refused with the keys nearest it, a value of the wrong kind with what the key takes, and a key that begins with `$` is a comment. `template` names a house profile `.json`; a note of the author's own goes in `brief`.

The spine rules and every other code the compiler raises, each with its repair, are in [Codes and their repairs](#codes-and-their-repairs). The deck-level keys `request`, `waivers` and `rulesVersion` pass into the deck spec unchanged; a deck that records no `rulesVersion` is stamped with the version it was authored under, and a revision stamped with an older one hears the rules added since as advisories ([Rules versions](evaluation/index.md#rules-versions)).

### Rebuilding an existing deck

`$RUNTIME_PYTHON runtime/import-deck.py deck.pptx <work>/` writes the inventory and a starter pages file whose pages carry stable ids, `sourceSlide` and the old copy as `draft` (`workflow: "existing_deck_revision"`, `inventory` on `deck`). Map each slide to a page type in place; the compiled plan records the inventory and each page's `sourceSlide`. A hidden slide's page carries `hidden: true` beside its `draft`, which mapping keeps ([hidden slides](composition.md#page-and-deck-keys)). The procedure is in [Storylining](storylining.md#revising-an-existing-deck).

There is one authored record of the deck. `author-deck.mjs` writes the other three from it: the deck spec, the plan, and the content plan (`<id>.content.json`). The content plan's claim is each page's title; its `settles` and `adds` come from the page; its text plan is the page's copy as composed, so chart labels, formatted values and cells no longer have to be listed by hand; its reading task is the page type's exhibit family (chart, table, diagram, exhibit, text) and whether the composed page has a commentary column.

The [content gates](#the-content-plan) then run in the same pass - claims that are topics, commentary that restates the exhibit, an answer no claim carries - and every page is held to its reading task's word floor and ceiling, set once when the page composes: a chart carrying its own callouts from about 42 words, a table with commentary from about 149 ([Word measures](evaluation/index.md#word-measures) says how the floor, the ceiling and the density checks relate). Do not edit the three written files; change the pages file and run it again.

### One run, in order

Every run reports its findings in three classes, in the order they are best fixed (`runtime/gates/gate_classes.mjs` gives every code its class; a test holds it to the vocabularies):

| Class | What it reads | When |
| --- | --- | --- |
| S, deck structure | the pages' declared choices - type, form, commentary placement, exhibit kinds, sections, the summary and players pages, the insights each rests on: the [variety contract](#the-variety-contract), the [spine rules](#spine-rules), the page architectures (`PAGE_SHAPE_FLAT`), the plan record | first, and on every run - in a draft, and for a page that did not compile, from the choices it declares (marked `provisional`) |
| P, page-local | one page, its evidence and the deck's constants: compile refusals, composition, the scene's bands, ink and words, the [evidence contract](#the-evidence-contract), the chart forms | per page, in page order |
| G, deck aggregates | what the composed or rendered pages measure between them: `EVIDENCE_DEPTH`, the half-empty habit, the deck's ink and craft rates, `TEXT_FRAGMENTED` | last, from the pages that composed |

Settle S first: a structure finding changes which page takes which form, and copy polished on a page that then changes form is thrown away. A page that fails to compile or compose still gets every check that does not need its composition, and is counted in S as the type, form and placement it declares; a page left out for a reference that does not bind is compiled all the same, with a number standing for each token, and its refusal is reported beside the binding's. So fixing what one run reports reveals nothing that run could have reported, with three exceptions, each said where it applies:

- a page with a bound exhibit or metric that cannot be filled has only its spine compiled (its choices, `why`, title, what settles it): its exhibit and copy are checked once the measure binds;
- a page that does not compose has no layout findings yet - bands, word floors, the fit search - and gets them once it composes;
- an aggregate (G) is measured on the pages that composed (its line says on how many), so its verdict can change when a missing page comes in.

A section or agenda page written without an `id` is given one from its kind and its place (`section-12`), so every stage names it alike.

Under the findings every run prints **where the deck stands** against every S and G rule: the value, the bar and the room left, counted in pages where the rule counts pages ("pages carried by a table 13 of 44 pages, 29.5%; cap 30%: at the cap, 1 more blocks"). The broken come first, then the rules at their bar, and the same lines are in the JSON summary (`standing`). Read them before writing a page: a rule at its cap is the next refusal.

A G line whose rule is read page by page names the pages on the wrong side of its bar (`EVIDENCE_DEPTH`; `TEXT_FRAGMENTED` once rendered), and one that counts pages lists the pages it counted once it is at or past its bar. A rate measured over the deck's exhibits or marks - the craft rates (`DECK_CRAFT`), the ink - gives the rate and names no page.

Of the two aggregates only a render measures, the half-empty habit says so until `--render` measures it, and `TEXT_FRAGMENTED` is shown as an estimate read off the composed scene - the render's block reading applied to each page's text nodes, marked `estimated`, never blocking, and within about four words of the rendered median on the decks it was calibrated on ("inside the estimate's margin: the render decides" where it is that close to a bar). A finding that waits on a file the build fetches (`CRAFT_PLAYERS_UNINTRODUCED` while the planned logos are not on disk) is an advisory until then. Under `assets: { fetch: "none" }` nothing waits: the compile decides it as the build does.

**The fit search.** For a page with a blocking layout finding - it does not compose, a band of it stands empty, its words miss the floor its placement sets - the compiler tries the type's other forms and commentary placements itself, from the page as written (a bound exhibit stays bound):

- each alternative that compiles is composed in the deck, run through the same page gates and checked against the structure rules with the page swapped;
- an alternative that clears them is then asked whether it draws what the page wrote: each field the page's own form uses is taken out in turn, and a field whose removal changes nothing of the alternative's composed page is one it ignores (a cycle's `center` under a row of steps). Only an alternative that draws every such field is the same content;
- the finding lists which `passes the scene checks` with the same content - composed and gated in this deck, not rendered - which `fits, dropping content` and the fields it drops, which `fails` and on what (the band left, in pixels), and which `needs` content the page does not carry, in the compiler's own sentence; its repair leads with the alternatives that pass;
- an alternative that would take the deck's estimated words a block out of its band (`TEXT_FRAGMENTED`) is listed under `fails`, not proposed;
- under `--check --render` every alternative the search passed is emitted and rendered through the build's own gates: one the render refuses moves to `fails` with what the render found, and the rest read `passes, rendered`. Nothing is called verified that was not rendered;
- nothing is applied: choose one, or repair the page as it stands;
- at most six alternatives a page are composed (`--fit-cap <n>`; 0 switches the search off) and what was left untried is listed; the bound is a count, never the clock, so a run gives the same answer on a loaded machine;
- verdicts are remembered in `<id>.author-cache.json` beside the pages file, keyed by the page as written and what around it decides its layout. The file is safe to delete, and an entry whose key does not match is never used.

**One page at a time.** `--page <id>[,<id>...]` (with `--check` or `--draft`) compiles the whole deck as context and reports only those pages: their own findings and advisories (the part file each came from, its unbound references and untraced numbers among them), every blocking finding that names them - a claim two pages share names both - or that they count towards (a page holding a bare chart answers for `CRAFT_CHARTS_BARE`), their part in each aggregate, the craft rates among them, and where the deck stands. The exit code answers for those pages: it counts those findings and no other, and the deck findings the pages have no part in are listed apart. No deck is written - the deck is written by a whole-deck run.

**The final check.** `--check --render` emits and renders the compiled deck with the build's own stages in a temporary folder, and files what the build would report with the rest: the render's bands (`COLUMN_VOID`, `INTERNAL_VOID`, `DEAD_BAND`), the readback, `TEXT_FRAGMENTED`. Nothing is fetched, and nothing is written beside the pages file but what every run writes there: a line of the run log (`<id>.author-log.jsonl`) and the fit search's cache (`<id>.author-cache.json`), both safe to delete. Its blocking findings are those of a build that does not fetch. Make it the last check before the build wherever a renderer is installed (`node runtime/doctor.mjs` says); with `--page` it renders only the named pages.

**Plan the structure first.** `--plan` reads a spine - each page its `id`, `title`, `type` and `evidence`; `form` and `commentary` may be absent - and evaluates the structure rules on what the pages declare:

- what a page declares is read wherever it is declared: a page that compiles is read as the compile reads it, so a deck that compiles clean gets the standings its compile reports, and a declared form sets its exhibit's kind where the form does;
- a `basis` stub is a declaration, not an exhibit drawn with nothing in it: it is read as the exhibit it declares - its kind from the form, else from its `type`, its `as` or the axis of the measure it names - plotting the values its measures hold in the view it states. A stub that names no recorded measure leaves the page's depth unread (`EVIDENCE_DEPTH`), never at zero, and a `profiles` stub still introduces the deck's `players`;
- only what is absent is estimated: a page with no exhibit yet whose form leaves the kind to the author (panels, a metric strip's proof) has its exhibits' kinds estimated from the measures it names and the shape of its evidence, and is marked `estimated`;
- where a page declares no form or placement, or a rule is broken, it proposes an allocation that satisfies every structure rule as far as the declared descriptors go, found by a deterministic search over the catalogue bounded by a count of steps (never by the clock), and prints where the proposed deck would stand;
- a declared form is kept where only its placement is missing: the plan proposes the placement (`form declared, placement proposed`; `placed` in the JSON) and counts those pages apart from the ones it gives both;
- a declared choice is changed only to mend a broken rule, as the last resort, and is listed as a change with what it was;
- each page that composes with placeholder copy under its placement gives the plan an estimate of the deck's words a block (`TEXT_FRAGMENTED`, printed under `Estimated`): the free choices are steered to keep it in its band - points below a chart, whose labels read as blocks, are not proposed where another placement meets the same rules - and no declared choice is changed for it, nor a plan refused on it;
- it proves every exhibit the spine determines drawable, as a draft does, and holds the dependency contract on declared facts: what it refuses is listed as `unlayable`;
- where no allocation exists it names the unsatisfied rule, and says when the page types alone break it;
- it composes the titles the critique will bind, as a draft does, and is refused on one that does not fit (`SPINE_UNFIT`);
- it prints a proposal and writes nothing but a line of the run log. A spine is done when `--plan` and `--draft` both exit 0, which a spine of stubs can reach.

A plan is not a guarantee: a rule that counts exhibit kinds can still be met or broken by the exhibits the estimated pages are given, and a change the plan proposes to a declared choice while pages are estimated mends a rule broken on the estimate - write those exhibits, or give each its `type`, and run it again. A form built for particular data (an indexed trend, a distribution, small multiples, aligned bars, labelled rows) and a diagram or schedule other than the type's first are the author's: the plan proposes one only where no other allocation meets a rule, and marks it with the data the form reads. Where a proposed form asks more of the data than the evidence holds (a dumbbell wants two series), declare the form the evidence can carry and run `--plan` again: it keeps declared choices and re-allocates the rest. Every compile reads the pages as written again.

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

A page that does not compile (`COMPILE`) is reported with the rest: the pages that do are still composed, gated and budgeted in the same run. Every compile and every plan is logged beside the pages file with its mode (draft, check, full, page for a `--page` run, or plan) and whether it rendered; `--log` counts them - compile runs and refused runs by mode, the plan runs beside them, refusals by code and by page, the longest streak of refused runs on one page - and lists the findings that came back run after run, which are the limits or messages the skill should publish better. It says what it counts (`counted`): the catalogue commands, the analysis, the critique, the build and delivery are not logged, so a session's command count is larger.

A page of prose beside its panel (an `argument` memo, a rail page of paragraphs) that leaves a band empty or passes its word ceiling is told the words of prose that fill the column it is set in ("194 to 292 words of prose fill the column"), read off the measurement that sets the column at the page's own type size - an appendix page's is smaller, and takes more words.

Each budget line also gives the floor the page would carry with its commentary placed the other way (`with points beside or below floor 96`, `with no points (rail, captions, callouts) floor 42`): the reading task follows the placement, so moving a rail below can take a chart page's floor from 42 words to 96 or more, and the cost is seen before the move. The summary prints the types in page order (`sequence`), a run of one type folded to its ends.

`--icons` lists the icon names a point, a card or a row label can ask for (plane, ship, train, car, cart, home, heart and education among the business ones), with the other words each answers to - `aircraft`, `airport` and `flight` are `plane`. An unknown name is refused at compile with the nearest names.

`--types` prints the data each form reads (a pie or donut takes `labels` and `values`, a treemap `items`, a flow `nodes` and `edges`); the compiler names the missing keys, and refuses any page key the composer does not read, on every page at once.

The compiler checks what each type implies. A trend runs over four or more periods; a ranking shows four or more members; trend and ranking charts mark their finding on the plot; a scorecard codes at least one column in its form; `on-exhibit` needs `annotations`; `captions` needs a `caption` on every panel; a text-free placement refuses `points`, because it says the text lives somewhere else. Two or three numbers are a `numbers` page, not a chart, and not a panel either: a panel plotting two numbers is refused. A pie or donut with a part under 5% is refused for a waffle or a stacked bar; a metric strip sits over exactly one exhibit and takes commentary `none`, since its numbers and exhibit fill the page.

A period is a date (2025, FY25, Q1 2025, Jan 2025), a quarter or half within its year (Q1, H2), a span (2020-24, Jan-Mar) or a period with its qualifier (FY25 LTM, 2024 YTD); a trend's axis and the craft floor's chart over time are read by the same recogniser (`runtime/time-axis.mjs` isPeriodLabel), so "H3 2024" is a member, not a period, to both.

Each component's limits are published in `--types` (`holds:` - a donut takes two to five parts, cards two to six, steps three to six, a stat-list value nine characters and a fact-grid value ten) and checked at compile, with the capacities the renderer measures: a chart callout about ten words and a chart three callouts (a fourth note is commentary), a rail about 42 words (eight lines at heading size). A callout the plot has no clear position for is refused with where one fits: the marks a note of that size still has a clear position at, with the callouts already placed, or that none has and how many callouts the plot has room for. Every `numbers` form sets its figures against one exhibit - the proof beside a hero number, the tiles of a grid, the chart under a strip.

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

Each type also has a minimum it needs to be worth a page: a composition shows three or more parts, or the mix across two or more members or periods - a share of one thing is a numbers page; a timeline or roadmap has four or more dated items (`{ date | period, label, text }`, set as [dated stages](components.md) that fill their frame); a mechanism three or more parts; a relationship five or more members; a bridge a start, two steps and an end - and every chart page the evidence floor below. Small counts are counted, not shared out: fourteen cities as percentages of a pie overstates what the count can say - use form `waffle`, with the parts as `categories` and one series of whole counts.

On a page with commentary points, the finding in each point is marked: `highlight` takes a list, with the number or claim from each point the reader should see first, or a point carries its own `highlight`. A point left unmarked is marked on its own figure - its first percentage, amount or count, never a year - and a point with no figure is named in the advisories (`POINT_UNMARKED`), since the phrase that carries a qualitative point is the author's to choose.

The page's `highlight` is set wherever the page writes it: points and row blocks, paragraphs, a rail or side panel, the so-what bar and the takeaway, panel captions, and the cells of a table, a findings matrix (bulleted cells too) or a comparison. On a dark or filled panel where the accent does not read, the phrase is set bold in a regular sentence. A phrase that lands nowhere the page draws an accent - only in the title, a heading or a chart's callout - is refused.

Moving the explanation off the page's text column is a choice to write it somewhere else, not to drop it. Callouts on a chart carry ten or more words between them - the mechanism and the qualification, not labels - and each is measured against the chart's callout box, which holds about ten words (`--types` prints the capacity); every caption is a sentence of eight words or more that says what its panel shows and does not repeat the title or the panel heading; a rail is a developed claim of ten words or more. An executive summary with no exhibit renders as a list, and words alone do not fill the page inside its ceiling: declare its exhibit - the answer table, or `metrics` - at the spine, where the critique reads it and the draft proves the page fills (`SPINE_UNFILLED`). Its worked example and scaffold carry the table.

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

A blocking code stops `author-deck.mjs` at exit 2 and nothing is written; an advisory is listed in the run's summary. Findings are reported [in class order](#one-run-in-order): the deck's structure, each page, the deck's aggregates. Every refusal the page-type compiler raises is also printed by `--types`, and a finding's message names the page and the repair. Gate codes the build raises are in [Evaluation](evaluation/index.md#page-gates); a review's codes are in [Taste review](taste-review.md#the-rubric).

### Spine rules

| Code | Rule | Checked | Repair |
| --- | --- | --- | --- |
| `REQUEST_MISSING` | a new deck records the user's request verbatim as `request` on `deck` | draft and full | paste the user's words, not a restatement |
| `CONTENTS_UNFIT` | the deck names `agendaStyle: "columns"` and has more than six sections, or has more than ten (the appendix divider counts as one) | draft and full | remove `agendaStyle` (a style the deck does not name is fitted by the runtime: columns hold two to six sections, the list two to ten, and a list too tall for its page drops the section summaries), or merge sections |
| `SPINE_UNFIT` | a title the critique is bound to does not fit where the deck's design, variation, tracker and sections set it: a section title on its divider, the section titles on the contents page or in the tracker, a page's title in its title band (the build's `TITLE_LINES`), or the cover's title | draft, plan and full; a full compile reports a composed page's title as `TITLE_LINES`, with the same room | shorten the title to the room the finding gives (the words and characters of it that fit), before the critique; a section's detail goes in its `summary`, a page's in its `subtitle` |
| `SPINE_UNDRAWABLE` | an exhibit the spine fully determines cannot be drawn: a bound or typed chart no chart form of its type composes, a view that would plot a member or period its measure does not disclose, or a page whose evidence no form of its type holds | draft and plan; the full compile reports the same page as `PAGE_DOES_NOT_COMPOSE` or the form's own refusal | change the bound choice the finding names, before the critique: `select` the disclosed members or periods, give the stub its `labels`, show the measure as a table, or take the type the evidence can carry |
| `SPINE_UNFILLED` | an executive summary that leaves a band of its page empty at its word ceiling, with the exhibit the spine declares for it | draft and plan; the full compile reports the band itself (`SCENE_VOID`), and a revision under an older rules version hears it as an advisory | write the summary's exhibit at the spine - the answer table, its cells the calls in words or numbers by reference, or `metrics` - so the critique reads it |
| `TITLE_GAP_SHARE` | titles stating what the evidence lacks, cannot settle or leaves undisclosed on more than 15% of the analytical pages | draft and full | lead with the way the evidence leans; the gap goes in the `subtitle` ([Answer under uncertainty](storylining.md#answer-under-uncertainty)) |
| `GENERATOR_SIGNATURE` | one non-trivial value of `why`, `settles`, `adds`, `takeaway`, `subtitle`, `rail` or `bar` on more than 60% of the pages | draft and full | write the field page by page, or leave an optional one out |
| `PILLAR_UNSUPPORTED` | a section whose pages rest on no `strong` insight | draft and full, with an insight log | find the evidence the pillar needs, or merge the pillar into one that has it |
| `MEASURES_MISSING` | an insight whose evidence is numbers (`series`, `peer-set`, `mix`, `measure-pair`, `bridge`, `fact`) records them only as a sentence | draft and full, with an insight log | give the insight its `measures`: the unit, the population, the periods or members, and the values ([Measures](storylining.md#extract-the-insights-before-the-titles)) |
| `ANALYSIS_REQUIRED` | the deck declares two or more `players` and no computed `compare` sets them all on common measures | draft and full, with an insight log | write `<id>.analysis.json` and run `node runtime/analysis.mjs <id>.pages.json` ([Run the analyses before the outline](storylining.md#run-the-analyses-before-the-outline)) |
| `ANALYSIS_UNRESTED` | a computed analysis no page names in `evidence` | advised | give the result its page, or cut the analysis |
| `MEASURES_CONFLICT` | one measure - one name, population and unit - recorded in two insights: with different numbers at one period or member it blocks; with the same numbers, or one number at two precisions, it is advised. It reads structure only, and does not see one quantity under two names, one population spelled two ways, two scales of one unit (millions and billions), one period under two labels (a two-digit and a four-digit year), or an entity's own record against its row in a peer set | draft and full, with an insight log | keep the number the source gives in one record; where the two are different quantities, say so in the `population` or the measure's name ([Extract in parallel](storylining.md#work-in-parallel-with-subagents)) |
| `WAIVERS_INVALID` | `waivers` on `deck` is a list of `{ code, reason }` naming a `BAR_*` code once each, each reason a sentence the reviewer can check | draft and full | fix the list, or drop the waiver and clear the bar |
| `STATEMENT_INVALID` | what the deck says of its request, its evidence scope, its answer's status or its assets is not in form: `requestProvenance`, `evidenceScope`, `answerStatus` with `answerLimits`, and `assets: { fetch: "build" \| "none", reason }` | draft and full | write the statement in the form the message gives; `assets.fetch: "none"` needs its `reason` in a sentence |
| `ASSETS_NEEDED` | the deck plans logos (its declared `players`), photographs (`{ alt }`) or places (a marker's `place`) whose files are not in `assets/` beside the pages file, so the build will fetch them | advised, draft and full; the compile prints the list and the choices | supply the files under the names the compile prints, let the build fetch them, or declare `assets: { fetch: "none", reason }` on `deck` ([Design](design.md#make-every-exhibit-earn-its-page)) |
| `ASSETS_OFFLINE` | the deck declares `assets: { fetch: "none", reason }`: the build fetches nothing, players are introduced by name, a deck supplied no photograph is expected to carry none (`CRAFT_NO_PICTURES` is advised), and the build result, the reviewer's packet and `delivery.json` say which files were not available | advised, draft and full | nothing to repair; supply the files to show the marks and the photographs |
| `REVISION_UNMAPPED` | a revision's imported slide still carrying only its `draft` copy | reported in a draft, refused in the full compile | give the slide a `type` and its choices, or delete it from `pages` |
| `REVISION_INVENTORY_MISSING` | a revision's `inventory` is not beside the pages file | draft and full | keep `<id>.inventory.json` where `import-deck.py` wrote it, beside the pages file |
| `TITLE_COUNT_ONLY` | a title that states a count with no comparator or consequence | advised | add what the count is against: a peer, a target, a prior period, or what follows from it |
| `POINT_UNMARKED` | a commentary point with no figure to mark and no `highlight` | advised | name the phrase the reader should see first in `highlight` |

### The evidence contract

Where the insight log records `measures`, every page with numbers on it says what its claim and its exhibits rest on, and the compile holds each to it (`runtime/gates/dependency_gates.mjs`). The rules read declared fields and numbers; no title is parsed for its claim. They block in the full compile and are reported in a draft, whose exhibits are not yet written; a reference that cannot be bound is refused in a draft too.

**Name the measure and the runtime writes the number** (`runtime/bind.mjs`). Nothing is typed twice, so nothing can disagree with its record:

```json
"evidence": ["i-results", "A-ocf"],
"settles": { "kind": "comparison", "what": "...", "measures": ["i-results/ocf", "i-results/pat"], "relation": { "kind": "gap" } },
"title": "Operating cash flow fell {{A-ocf/percent | 0% | abs}} to {{i-results/ocf@FY26}} million",
"exhibit": { "type": "chart.line", "heading": "Operating cash flow", "series": [{ "measure": "i-results/ocf", "name": "Operating cash flow" }], "role": "proof" },
"metrics": [{ "measure": "A-ocf/percent", "format": "+0.0%", "label": "Operating cash flow" }]
```

- **A bound exhibit** names a measure in each series (`series: [{ measure, name }]`), or one `measure` on an exhibit that plots a single list, such as a donut. The runtime writes its `categories` (a donut's `labels`), each series' `values`, its `unit` and its `basis`: leave all four out. `role` and `relevance` sit on the exhibit. `select` narrows the axis - `{ from, to }` or `{ periods: [...] }` over time, `{ members: [...], order }` over a peer set, the members in the order written or by the first series' value (`"descending"`, `"ascending"`); unselected, the axis is every period or member all the series share. A measure of one value among the series is drawn as a rule across the plot.
- **Recorded, then assumed.** `"measure": ["i-crews/on-shift", "A-crews/path"]` joins a recorded series and the scenario's path that starts from it as one line. The axis runs in period order whichever measure is listed first, a recorded value is kept wherever both hold a period, and the assumed run is bracketed on the chart ("Recorded", "Assumed"); it has to be one run at the end of the axis, and a join that would put a recorded period after an assumed one is refused. An exhibit's own `forecastFrom` or `periods` is kept where it starts at the first assumed period.
- **An assumption is said where it is shown.** A metric drawn from an assumed measure gets the sublabel "Assumed", and a chart of an assumed peer set or an assumed rule across the plot gets a note line ("Assumed, not recorded: ..."), unless the author's own words on it already say so. A token only prints a number, so nothing is drawn for it: the page's declared notes, which the storyline critic reads, list every assumed measure the page shows and where the page says so, and every negative value printed without its sign.
- **Indexed.** A `trend` of form `indexed` names the measures of an `index` analysis (`A-index/cash`, ...): the base comes with them and only `subject` is added. Or it names raw series, in any units, with the `indexBase` the runtime rebases them at. Either way no index number is typed.
- **A bound figure.** A strip's `metrics`, a hero's `kpi`, a row block's `metric` and a fact-grid or stat-list item take `{ measure, format, label }` in place of `value`. A measure of one value is named alone; one value of a longer measure is `<measure>@<period or member>`.
- **A token**, `{{<measure>[@<period or member>] | <format> | <modifier>}}`, in any text of the page - title, subtitle, points, rail, bar, takeaway, a caption, an annotation, a metric's value or sublabel, a table cell - is replaced by that number; an undisclosed value prints as n/a. Only braces round a measure reference are a token: `{{client}}` in copy is left as written.
- **A table of tokens, or a grid of bound figures, needs no `basis`**: it is written from the references, where every measurement in the exhibit is one. Measurements are read as the number trace reads them: a year, a period label ("FY26"), an ordinal ("3rd") and a count in a phrase ("3 of 8 sites") are not, so they sit beside the tokens freely. A cell that types a measurement - "5.7%", a bare number alone in its cell, a bar cell's `value` - makes the exhibit a typed one, and `BASIS_MISSING` names what is typed.
- **Format.** The digits are written `0`, `0.0` (a 0 for each decimal place) or `0,0` (thousands separated), with what is printed round them kept: `"+0.0%"` (the leading `+` prints the sign of a rise too), `"CHF 0.0bn"`, `"0.0x"`. Modifiers follow a `|`: `abs` prints the size without its sign, for a sentence that words the direction (the deck records each negative value printed this way); `/1000`, `/1e6` or `x100` rescale by a power of ten, so a record kept in millions prints in billions and a ratio as a percentage. With no format the number prints to one decimal place at most.
- **A printed number states its value**, by the rule a typed one is held to, or the binding is refused (`BINDING_UNRESOLVED`) with the format that would state it. It keeps two significant figures of the value - `0%` does not print 3.4, nor `0.0` 0.04 - with one exception: a percentage or percentage points may be printed to one decimal place (-0.86% as "-0.9%").
- **A printed scale is the unit's.** Where the format, or the word typed straight after the token, names a scale (k, thousand, m, mn, million, bn, billion), the modifier is exactly the factor between the unit's scale and it: a unit in `m` printed as `bn` takes `/1000`, the same scale takes none, and a unit that names no scale is whole units - 126,604 `employees` prints as `0.0k | /1000`, never as `0.0m | /1000`. A letter meant as the unit itself ("m" for metres on a measure kept in km) reads as a scale: record the measure in the unit the page prints. `x100` prints a ratio or a fraction as a percentage and is refused on any other unit; a percentage is printed as recorded, with no scaling modifier.

A reference, like a `basis`, names a measure of an insight the page names in `evidence`.

**Typed numbers stay allowed, and are checked.** A typed exhibit or metric carries its `basis`:

```json
"exhibit": { "type": "chart.line", "unit": "GBP m", "categories": ["FY24", "FY25", "FY26"], "series": [{ "name": "Operating cash flow", "values": [81, 84, 66] }],
             "basis": { "measures": ["i-results/ocf"], "role": "proof" } },
"metrics": [{ "value": "-21.4%", "label": "Operating cash flow", "basis": { "measures": ["A-ocf/percent"] } }]
```

`settles.measures` are the measures the claim is about. `basis` on an exhibit, a block's exhibit or a figure (a metric, a `kpi`, a row block's `metric`, a fact-grid item) names the measures it plots and its `role`: `"proof"` of the claim (the default), or `"context"` beside it with the `relevance` a reviewer judges. A measure is named `<insight id>/<measure>`, or `<analysis id>/<measure>` for a result the runtime computed. `settles.relation` says what the reader reads between two of the claim's measures: `gap`, `ratio`, `levels`, `index`, or `separate` with its `reason`. A page that writes no `source` takes its citation from the `cite` keys of the insights it plots and prints.

**Roles are each measure's own**, so one exhibit can show the claim's measure and a context measure together; the exhibit's `role` is the default for the rest:

- a bound series says its own: `"series": [{ "measure": "i-calls/answered" }, { "measure": "i-calls/target", "role": "context", "relevance": "..." }]`;
- a typed exhibit's `basis` gives it in `roles`: `{ "measures": [...], "roles": { "i-calls/target": { "role": "context", "relevance": "..." } } }`;
- the dependency rules, the critique's binding (`shows`) and the critic's notes read roles measure by measure, and a context measure still says its `relevance`.

**At the spine, say what the page will show of each measure.** The storyline critique reads, and the layout is then held to, which periods or members of a measure a page shows and whether it is plotted, tabulated or stated as a figure. A page that will show the whole measure plotted needs nothing. Any other view is stated before the critique, one of two ways:

- **The bound exhibit, which is the normal way**: `"exhibit": { "series": [{ "measure": "i-results/ocf", "name": "Cash flow" }], "select": { "from": "FY21" } }`, or a metric's `{ "measure": "A-ocf/percent" }`. It is the line the layout keeps.
- **A `basis` stub that states the view**, for an exhibit or a figure not written yet: `"exhibit": { "basis": { "measures": ["i-results/ocf", "i-peers/margin"], "as": "table", "labels": { "from": "FY25", "to": "FY26" }, "members": ["Harbour"] } }`. `as` is `"chart"`, `"table"` or `"figure"` (a metric, a `kpi`, a fact grid); `labels` is a list of periods or members, a window `{ from, to }`, or one of either per measure (`{ "i-results/ocf": ["FY26"] }`); `members` is a list. Each applies to the measures it runs over, and a measure none applies to is shown whole. A class that is not one is `BASIS_UNKNOWN`, a period or member no named measure runs over `BASIS_AXIS`.

A stub is read exactly as a drawn exhibit showing that view, so a page laid out to it keeps the critique; once the exhibit is drawn, the critique reads the exhibit. An exhibit with no category axis that types values - a table's bar cells, a scatter - is bound to those values too, which a stub cannot state: write it at the spine. `--draft` and `--plan` print how each measure a page does not draw yet will be read ("read as plotted, every one of its 8 periods"), under `readings`.

A typed number states a recorded one at the precision it is printed to: two significant figures of the value, with one exception - a percentage or percentage points may be printed to one decimal place (-0.86% prints as -0.9%). A sign is held, a figure with none states either direction, and a scale is read against the unit's: "CHF1.3bn" states 1,300 kept in CHF m, and "126.6m staff" does not state 126,604 kept in employees, a unit that names no scale.

Every other number typed on the page - in a title, a point, a caption, a table cell - is traced: one that is no value of any measure of the insights the page rests on (or of the records and stated assumptions behind them) is listed by `--check` under `untracedNumbers`, with its page and field (`NUMBER_UNTRACED`, advised). What is traced is a number written as a measurement - with a decimal point, a thousands separator, a sign, a currency, a percent sign, a scale or a unit ("12.2", "1,750", "CHF26m", "57%", "49 million", "2.9x") - and a table cell or figure that is nothing but a number. A year, a date, a period or type name ("FY26", "Q3", "M25", "500-4"), an ordinal and a bare whole number in a sentence ("8 branches") are not. A percentage is matched only to a percentage or a recorded ratio, and money or a scaled count never to a percentage.

| Code | Rule | Repair |
| --- | --- | --- |
| `CLAIM_MEASURES_MISSING` | a page with a plotted exhibit does not say which measures its claim is about | name them in `settles.measures` |
| `BINDING_UNRESOLVED` | an exhibit, a figure or a token names a measure the log does not hold, one from an insight the page does not name in `evidence`, or one that cannot fill it: two units on one scale, a period the measure does not run over, typed values beside the reference, a format with no number. Refused in a draft too, once for each fault | correct the reference as the message says; the page is compiled once it binds |
| `BASIS_MISSING` | an exhibit that plots typed numbers names no measure; or one that writes numbers by reference still types a measurement beside them | name the measures in its series and leave the numbers out, write the typed measurement by reference too, or give it `basis: { measures, role }` |
| `BASIS_UNKNOWN` | a `basis` or `settles.measures` names a measure the log does not hold, or one from an insight the page does not name in `evidence`; or a `basis` gives a `role` or a class (`as`) that is not one | name a recorded measure, and rest the page on the insight it comes from |
| `BASIS_UNIT` | the exhibit's `unit` is not the unit of any measure it names | plot the measure it names, or name the measure it plots |
| `BASIS_AXIS` | the exhibit's `categories`, or the `labels` or `members` a spine's `basis` declares, are not periods or members the measure runs over | plot, or declare, the measure's own periods or members |
| `BASIS_VALUES` | a typed series is not the values of any measure the exhibit names, a typed metric prints no number of its measure, or a table names a measure none of its cells states - each at the precision the page prints | name the measure and let the runtime write it; a number nobody recorded is an analysis to run or an assumption to state |
| `PROOF_OFF_CLAIM` | a `proof` exhibit plots no measure of the claim, nor one computed from it or it is computed from | plot the claim's measure, move the exhibit to the page it proves, or mark it `context` with its `relevance` |
| `PROOF_MISSING` | every measure the exhibits show is context and no figure - a strip's metric, a `kpi`, a row block's `metric`, a fact-grid item - names a measure of the claim as proof | plot the claim's measure, or name it in the figure that states it (`{ measure, format, label }`, or a typed `value` with its `basis`) |
| `CONTEXT_UNEXPLAINED` | a `context` exhibit, or a context measure in an exhibit that also shows proof, with no `relevance` of six words or more | say what it tells the reader about this claim - on the exhibit, the bound series or `basis.roles` - and the reviewer judges that sentence |
| `SOURCE_UNCITED` | `source` leaves out a `cite` key of an insight the page plots, or is typed text where the insights carry their citation | leave `source` out, or list the registry keys |
| `RELATION_UNDECLARED` | two measures of the claim, in one unit over the same periods or members, are drawn in separate exhibits and no `settles.relation` says what is read between them | declare the relation and draw it |
| `NUMBER_UNTRACED` | advised: a number typed on the page is no value of any measure the page rests on | print it by reference (`{{<measure>@<period or member> | 0.0}}`); a number nobody recorded is a measure to add, an analysis to run or an assumption to state |
| `RELATION_SPLIT` | the claim asserts a `gap`, `levels`, `ratio` or `index` and each measure sits in its own exhibit; or `separate` gives no `reason` | set them on one scale or plot the computed result (`author-deck.mjs <pages> --repair-relation <page-id>` prints the merged exhibit, bound to its measures), or declare `separate` with its reason |

### The content plan

The content gates run on the content plan the compile derives. They block unless marked advisory.

| Code | Rule | Repair |
| --- | --- | --- |
| `CONTENT_NO_CLAIM` | a title that names a topic rather than proving something | state the finding: subject, verb, magnitude or comparator ([Action titles](copy.md#action-titles)) |
| `CONTENT_ADDS_NOTHING` | `adds` empty, or built from the words of the exhibit it adds to | say what the commentary adds - the mechanism, the qualification, the consequence - or set commentary `none` |
| `CONTENT_CLAIM_REPEATS` | two pages make the same claim | merge them, or make the second prove the next step |
| `CONTENT_UNMEASURED` | more than a third of the pages settle on `qualitative` evidence (advisory); more than half blocks | research the pages whose claim is a quantity - a share, a rate, a rank, a count - and record what settles it |
| `CONTENT_ANSWER_UNCARRIED` | from eight pages: the page titles between them carry under 60% of the content words of the deck's `answer`; or the answer is not up front - the executive summary (the first analytical page of a deck without one) carries, across its title, points, highlight and exhibit cells, under 60% of those words, or its title carries under half of the answer's leading clause (the verdict: see below), or its title carries fewer of the answer's content words than 35% of them - or than the seven a full-length title holds, where that is fewer | write the verdict in the summary's title and the reasons, rivals and thresholds in its points, in the answer's own words; the answer may be as long as its reasons need. Give a reason no title claims its page, or narrow the answer to what the deck settles. The deck's question is `question` (or `brief`) on `deck` |
| `CONTENT_ANSWER_CONTRADICTED` | a page recommends what the deck's unconditional answer rules out | name the condition in the answer, or change the page |
| `CONTENT_NO_HIGHLIGHT` | no page names the phrase its reader should see first (advisory) | set `highlight` where a claim names its exact target |
| `TEXT_COVERAGE_LOW` | a page's body under its reading task's floor | develop the missing reasoning, or move the page to the task it performs ([Word measures](evaluation/index.md#word-measures)) |
| `TEXT_BLOCK_TOO_LONG` | one run of prose past 152 words | split it where it stops proving one thing, and give the second half its own lead |

The answer's leading clause is its verdict: the text up to the first full stop, colon, semicolon, dash or "because", "unless", "if". It is a clause with a verdict in it, not the subject it is about: a lead of under three content words, and a label before a colon that is only a noun phrase, is read on with the next clause, so "Northfield: expand in the north now" leads with both halves and a title that only names Northfield does not carry it.

Whether the text before a colon says something of its subject is read off its shape, not off a list of verbs: it holds an auxiliary, a negation or the "than" of a comparison ("is", "should", "not"); or a second noun phrase opens inside it that no preposition governs, the object of its verb ("remains the strongest system", "keeps its lead"); or the clause after the colon takes its subject up with a pronoun ("...: it leads every rival"). A lead that shows none of the three - a bare verb over a bare noun - is read on, the stricter reading.

A lead can still be a clause that states no verdict ("The board has a clear decision ahead: ..."), and a title that repeats it leads with nothing; so the opening title also carries, of the whole answer's content words, at least min(35% of them, the content words a full-length title holds). That second number is the title word limit times 0.6, the content-word share of a title's words - seven of twelve - so a long answer is asked for no more than a title can say.

A revision recorded under rules version 3 or 4 hears the up-front rule as an advisory and is held to the rule it was recorded under instead: one title carries 35% of the answer's content words. No deck is held to neither.

### Compile and compose

| Code | Rule | Repair |
| --- | --- | --- |
| `COMPILE` | a page whose type refuses its choices; the rest of the deck is still checked | the message names the key and the choice; `--scaffold <type>` prints a page that compiles |
| `PAGE_DOES_NOT_COMPOSE` | a page that compiles but cannot be laid out; every such page is reported in one run | the finding lists the other forms and placements of its type that fit with the same content ([the fit search](#one-run-in-order)); otherwise the message names the overflow or the frame: shorten, or split the exhibit |
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
| `PLAYERS_UNMARKED` | variety contract | the deck declares two or more `players` - or, without them, two names recur in a fifth of its titles - and the cover and first three analytical pages do not show each one's logo | a `profiles` page (form `logos` or `logo-table`) or a `logo` column early; `{ alt: "<Name> logo" }` is fetched from the player's Wikipedia infobox, or drawn as the player's name under `assets: { fetch: "none", reason }` |
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
| `VARIETY_COLUMN` | from fifteen pages, at most 20% are one exhibit with a text column beside it - points beside or before it (`beside`, `beside-left`), a `rail`, or a hero number with its points beside its proof. A rail counts: the rule reads how the page is drawn, and a rail is a column beside the exhibit. `PAGE_SHAPE_FLAT` reads what the page argues with, and there a rail - like a so-what bar or a takeaway - is one claim and leaves the page evidence-only, where points, paragraphs, captions and cards make it evidence-with-commentary. So moving points into a rail keeps the page under this rule and changes its architecture under that one; both standings lines say which reading they take | [Beyond one exhibit and a column](#beyond-one-exhibit-and-a-column) |
| `VARIETY_SIGNATURE` | no one drawn page - its layout, how many exhibits of which family, a text column or points, a rail, its close - is more than 20% of the pages | the finding names the pages that share it; redraw those whose claim asks the reader something else |
| `EVIDENCE_DEPTH` | from eight chart pages, the median chart page plots 15 values or more | [Evidence depth](#evidence-depth): the peer set, a prior period or a benchmark as a second series, a longer window |
| `VARIETY_EXHIBIT_MIX` | each evidence family - chart, table, diagram, numbers, picture, text - within its band across the compiled pages (`runtime/weight.json` `plan.mixEnforced`) | move pages out of the family over its band into the form their evidence reads as: a table of a trend is a chart, a list of steps a mechanism |
| `VARIETY_EXHIBIT_RANGE` | enough kinds of exhibit for the deck's length: a floor of distinct exhibits per ten pages | draw each claim in the form its evidence is, from `--types`, rather than one exhibit restyled |

The limits sit outside what strong decks measure, so a deck that chose each page for its claim passes them with room. Placement and repetition are counted on the page as drawn, not as declared: a column on the left and one on the right are one placement to a reader, and a trend beside its points and a stat list beside its points are one page. The compiler records each page's drawn skeleton in its `pageType` (`skeleton`, and `drawn`: how many exhibits and whether it is an exhibit beside a column), and `VARIETY_SIGNATURE` names the pages that share the commonest.

Strong decks carry two or more exhibits on a quarter to a third of their pages and draw one exhibit beside a column on about one in eight; the floor sits under the first so a deck that chose its pages passes with room, and the cap sits half as high again as the second. `author-deck.mjs` prints the deck as drawn on every run - `structure`: the share on two or more exhibits, the share beside a column with the pages named, and every skeleton with its count - so a deck drifting toward one exhibit and a column is seen before it is refused. Do not rotate choices to meet them: a deck that breaks one has pages whose type was not chosen from the claim, and the fix is to ask of each such page what it has to show.

## Worked examples

`examples/page-types.pages.json` is a complete pages file - a fictional regional rail operator's growth plan, with illustrative numbers - that uses every page type at least once, with its `form`, `commentary`, `takeaway`, `why`, `settles` and `adds` filled in and each page's explanation written where its commentary says it lives. Do not read it whole: `author-deck.mjs --example <type>` prints the pages of one type. Copy the shape of the one you need and replace the content: the keys, the data shape its form reads and the length of its callouts, captions and points are the ones that compile and build.

Page `p10b` is labelled row blocks with a number on each row and `p24b` the same with a headed chart on each of two rows, `p13b` a ranking closed by a so-what bar, `p16b` three exhibits joined by arrows, `p07c` four panels of one indexed measure with a caption under each, `p06b` a chart on a card over the photograph of its subject (`photo-backdrop`), and `p25` a scorecard whose last column is each row's implication.
