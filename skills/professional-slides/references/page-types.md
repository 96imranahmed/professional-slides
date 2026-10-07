# Page types

A deck is authored page by page as **page types**, in `<id>.pages.json`, and compiled into the deck spec. Each type is a reading task; each has choices with no defaults. The choices decide the page's structure, so variety is decided where it is cheap to change - in the pages file, before anything is drawn - not discovered in the render.

```bash
node runtime/author-deck.mjs --types                       # the catalogue: every type, its forms, placements, limits and data
node runtime/author-deck.mjs --example <type>[/<form>]     # the worked pages of a type, or of one form, to copy the shape of
node runtime/author-deck.mjs [<id>.pages.json] --scaffold <type>[/<form>] [--evidence <insight-id>] [--id <page-id>]   # a page of that type that compiles, to fill in; with an insight, in a form that fits its measures and bound to them; with a page id, in the form that page declares
node runtime/author-deck.mjs --schema [type]               # JSON Schema for a pages file, or for one type's page (with its limits as `x-limits`)
node runtime/author-deck.mjs --schema deck                 # every deck-level key `deck` takes: its type and what it is for
node runtime/author-deck.mjs [<id>.pages.json] --limits [<type>[/<form>]]   # every countable limit: the deck's, or one type's or form's
node runtime/author-deck.mjs --icons                       # the icon names a point, card or row label can ask for
node runtime/author-deck.mjs <id>.pages.json --plan        # before the pages are written: for each page a form that carries its claim best and a placement, so the deck's structure rules are met as far as the pages declare what they draw
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

**A citation follows the measures.** Where the insight log records measures and `source` is left out, the line is derived from the measures the page shows - each measure's own `cite` where it records one, otherwise its insight's - so a page that plots one series of an insight drawn from several sources cites that series' source and not all of them.

**What a source does not name is declared once.** A record that names no publisher, no date or no document says so in the registry, with the reason:

```json
"ledger": { "name": "Order ledger supplied with the brief", "missing": ["publisher", "document"],
            "reason": "The client supplied it as one file, and it names neither who compiled it nor the system it came from" }
```

- `missing` lists one or more of `publisher`, `date`, `document`; `reason` runs 5 to 40 words. A record with a `url` has a publisher and cannot declare one missing.
- The deck states the limit once, on a page the runtime derives behind the appendix ("What the sources do not name": the source, what it does not name, why, and the pages that cite it).
- Every page that cites the source carries the declaration in the notes both critics read, as a declared limit to judge rather than a finding to file page by page.
- Each page's own source line is unchanged: it still names its sources.

A citation written from keys is the runtime's to fit. The footer as drawn counts toward `NOTE_HEAVY` whoever wrote it, so the runtime sets its own line in the fullest form that keeps the footer's three lines, the words the page's footer has room for under that bar (given the page's `note` and footnotes), and sixteen words - the footer strong pages set, a quarter over its median of thirteen - so a source's `short` name is what most pages print:

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

Write it in two passes. `--draft` compiles the spine and writes the deck for the [storyline critique](storylining.md#stress-test-the-storyline). **A draft is the full compile.** There is one compiler and one reading of what a page shows; a draft has no parser and no tolerance of its own. Each page of the spine is completed (`runtime/spine-witness.mjs`) - placeholder copy where its commentary placement asks for words, an exhibit written by reference where a `basis` stub or the claim's measures declare one, the worked page's unbound content where the form asks for rows or steps - and that completed page, its *witness*, is compiled and composed alone under the deck's settings by the same code a full compile runs. So:

- **a declaration the full compile refuses is refused in the draft**, in the compile's own words: a drawn exhibit with no `type` on a form that sets none (the type decides whether the critic is told the measure is plotted, tabulated or stated as a figure), a `basis` stub on a page type that carries no exhibit (`matrix`, `argument`), tiles that state one measure twice, a registry key the file does not hold;
- **what the critic is told is what the witness shows.** The record the critique binds (`runtime/storyline.mjs`: each page's title, type, `settles`, `evidence`, the measures it shows, the view of each - class and periods or members - and the numbers an exhibit draws that name no measure) is read off the spine and off its witness by the one function, and the two must be equal. Where they differ the page is refused as `SPINE_UNDETERMINED`, saying what the critic would have been told and what the laid-out page shows: declare the view (`as`, `labels` or `members` in the `basis`), write the exhibit by reference, or draw the exhibit whose numbers name no measure at the spine;
- **an untyped stub has one reading.** A `basis` stub with no `type`, where the form leaves the kind to the page (panels, the chart under a strip), is drawn in the witness as the kind `--plan` prints for it on the page's line ([how it is chosen](design.md#which-form-carries-which-claim)): the plan, the draft's count of exhibit kinds and the witness read the stub as that one kind, and the critic is told its class. Where the stub as written has the critic told another class than that kind's, or the kind cannot be written from the stub's measures, the page is refused and the kind named: write the `type` on the stub;
- **where the declared form or placement cannot hold the page and another of its type can**, the draft says which and why (`moved`), and the page keeps the critique: form and placement are the layout's;
- **where none can**, the page is refused: by its compile refusal, or as `SPINE_UNDRAWABLE` when the exhibit the spine determines does not compose.

What a draft defers is one closed list (the one `runtime/spine-witness.mjs` exports, printed with every draft), each mended without writing a bound field:

| Deferred | What it is |
| --- | --- |
| copy | the words a commentary placement asks for and the spine has not written - points, a rail, a bar, captions, callouts, headings, `adds` - and the mark a chart makes on its finding |
| content | the content of an exhibit or a page form that states no measure and draws no number: a matrix's rows, a timeline's items, the steps of a flow, a memo's paragraphs, a picture |
| layout | the page's form and commentary placement among those its type offers, and a chart's form within its class |
| fit | how much the composed page holds: bands left empty, words against a floor or a ceiling, a line that wraps |

Findings on that list are printed last, grouped as `settled by the copy` (or the layout, or the fit) with a count a code and the pages, and are `deferred` in the JSON summary; a page whose copy or content is not written says so on its record (`pageType.pending`). Everything else blocks: the spine rules, the dependency contract (`RELATION_UNDECLARED`, `RELATION_SPLIT`, `PROOF_OFF_CLAIM`, `PROOF_MISSING`, `CONTEXT_UNEXPLAINED`, `CLAIM_MEASURES_MISSING`, the `BASIS_*` codes, `BINDING_UNRESOLVED`) read on the witness, a structure rule only the page types can mend, and a structure rule no allocation of forms and placements satisfies. Each finding code records what its repair writes (the repairs table in `runtime/gates/gate_classes.mjs`).

A page with no exhibit drawn yet is read for the structure rules as its choices declare it, the way `--plan` reads it. `--plan` reads the same bound facts on the spine in the forms it proposes, so the two refuse the same spines.

With an insight log, `--draft` prints the page types each insight's shape can carry (`insightTypes`). The copy - callouts, captions, points - is written after the critique, and the full compile holds it to every rule. A new deck cannot be built from a draft: the build holds its content plan to the complete text contract.

**What the critique binds is proven layable first.** Every run - `--draft` and `--plan` among them - composes each title the critique is bound to where this deck's design, variation, tracker and sections set it: every section's divider, the contents page, the tracker's labels and each page's title band, and the cover with them. One that does not fit is refused (`SPINE_UNFIT`) with the room it has, in words and characters of the title as written. So a spine that passes its draft meets no later refusal whose repair is to change a title. A statement page's sentence and every other piece of copy are the layout's.

**So is every exhibit the spine determines.** A bound or typed chart, a `basis` stub's view and a measure read whole are fixed by the insight log, so `--draft` and `--plan` prove each drawable before the critique reads it (`SPINE_UNDRAWABLE`):

- a drawn chart is compiled and composed alone under the deck's settings, with placeholder copy at a developed length; one the form refuses is tried as the type's other chart forms, and the refusal names the measure and its members or periods with no value;
- a view not yet drawn is read as `readings` reads it: one that would plot a member or period the measure does not disclose is refused, and the repair names the bound choice - `select: { members: [...] }` (or `periods`) naming the disclosed ones, a stub's `labels`, or a table, which shows an undisclosed cell as a dash;
- a page whose exhibit the compile refuses on its evidence is tried in every form of its type; where none holds what the spine draws there, the type or the view is wrong for the evidence;
- the executive summary is composed at its word ceiling with the exhibit the spine declares for it, and refused where a band of the page still stands empty (`SPINE_UNFILLED`): words alone do not fill that page, so its table or metrics are written at the spine, where the critique reads them (a `basis` stub declares the exhibit too, and is proven once its rows are written).

The probes compose with placeholder copy, so what they refuse no copy can mend. A spine that passes `--draft` is laid out by adding copy, layout and unbound content only: the property is held over a generated grid of every page type, form, exhibit kind and container (`evals/tests/test_spine_witness.py`).

**The deck-level keys** are listed by `--schema deck`, each with its type and what it is for, from the table the compile holds `deck` to: a key the table does not hold is refused with the keys nearest it, a value of the wrong kind with what the key takes, and a key that begins with `$` is a comment. `template` names a house profile `.json`; a note of the author's own goes in `brief`.

The spine rules and every other code the compiler raises, each with its repair, are in [Codes and their repairs](#codes-and-their-repairs). The deck-level keys `request`, `waivers` and `rulesVersion` pass into the deck spec unchanged; a deck that records no `rulesVersion` is stamped with the version it was authored under, and a revision stamped with an older one hears the rules added since as advisories ([Rules versions](evaluation/index.md#rules-versions)).

### Rebuilding an existing deck

`$RUNTIME_PYTHON runtime/import-deck.py deck.pptx <work>/` writes the inventory and a starter pages file whose pages carry stable ids, `sourceSlide` and the old copy as `draft` (`workflow: "existing_deck_revision"`, `inventory` on `deck`). Map each slide to a page type in place; the compiled plan records the inventory and each page's `sourceSlide`. A hidden slide's page carries `hidden: true` beside its `draft`, which mapping keeps ([hidden slides](composition.md#page-and-deck-keys)). The procedure is in [Storylining](storylining.md#revising-an-existing-deck).

A revision usually has no insight log, so the compile reads it against the deck it was imported from ([What the pages say between them](#what-the-pages-say-between-them)), and a point change is judged on what it changes:

- a number the revision changed on one page that another page still states is `NUMBER_STALE`, found from the inventory and the pages alone; words or a title changed on one page and kept on another are `WORDING_STALE`. Both follow either kind of change: a text edit on a carried slide (`replace`, a new `title`) and a page composed where a slide stood;
- a slide the revision carries (`carry: true`) is never compiled: what it states is the inventory's record of it, as the revision's edits leave it. A disagreement between slides the revision did not touch is one advisory about the imported deck, and a repeated proof is reported only of the pages the revision composed;
- a build bar is held on the pages the runtime drew, at the compile, the build and delivery alike: over the composed pages of a revision that carries slides - each bar's line says it is not held on the carried ones - and over the whole deck of a rebuild;
- the fill measurement below is made for the changed pages alone, which on a revision that carries slides are the pages it composed;
- a page composed where a slide stood keeps what the slide already had and the revision did not change - its title, its source line - as the user's: the compile checks each against the inventory and records it on the compiled page, and the rule that judges it advises there (`CONTENT_NO_CLAIM` for the slide's own title; `SOURCE_UNCITED` for the slide's own source line, typed as the slide printed it over numbers the slide already showed). What the revision wrote instead is held in full: a new title is a claim, and a typed source line that is not the slide's own is refused as on a new deck;
- a rule that measures the deck is read over the pages the runtime composed, and held wherever they are themselves enough for it to be read - eight pages for a rule that counts across pages; those, and more composed pages than carried slides, for a rule on what the deck as a whole must have. Below that the rule is listed once as `Not held`, with why;
- the fit and the share of exhibit kinds count the carried slides, by what the inventory says each drew, and judge only the pages the revision added or redrew; a page it adds takes the form the source deck draws most.

One changed page costs the same steps as any compile - `--check`, then the build - and no step is repeated for the pages it left. A rebuild's page whose slide drew shapes the inventory does not hold is read as changed whether the revision changed it or not, and the run says so (`Read as changed`, with the pages and the reason); carrying the slide keeps it unchanged.

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

**One page at a time.** `--page <id>[,<id>...]` (with `--check` or `--draft`) compiles the whole deck as context and reports only those pages: their own findings and advisories (the part file each came from, its unbound references and untraced numbers among them), every blocking finding that names them - a claim two pages share names both - or that they count towards (a page holding a bare chart answers for `CRAFT_CHARTS_BARE`), their part in each aggregate, the craft rates among them, and where the deck stands. The exit code answers for those pages: it counts those findings and no other, and the deck findings the pages have no part in are listed apart - another writer's page whose argument moved (`SPINE_LOCKED`) among them, which does not refuse these pages. No deck is written - the deck is written by a whole-deck run.

With `--render`, the pages are rendered alone and each image is kept as `out/page-check/<id>.png`, so writers checking their own pages side by side each see theirs.

**The final check.** `--check --render` emits and renders the compiled deck with the build's own stages in a temporary folder, and files what the build would report with the rest: the render's bands (`COLUMN_VOID`, `INTERNAL_VOID`, `DEAD_BAND`), the readback, `TEXT_FRAGMENTED`. Nothing is fetched, and nothing is written beside the pages file but what every run writes there: a line of the run log (`<id>.author-log.jsonl`) and the fit search's cache (`<id>.author-cache.json`), both safe to delete. Its blocking findings are those of a build that does not fetch. Make it the last check before the build wherever a renderer is installed (`node runtime/doctor.mjs` says); with `--page` it renders only the named pages.

**Plan the structure first.** `--plan` reads a spine - each page its `id`, `title`, `type` and `evidence`; `form` and `commentary` may be absent - and evaluates the structure rules on what the pages declare:

- what a page declares is read wherever it is declared: a page that compiles is read as the compile reads it, so a deck that compiles clean gets the standings its compile reports, and a declared form sets its exhibit's kind where the form does;
- a `basis` stub is a declaration, not an exhibit drawn with nothing in it: it is read as the exhibit it declares - its kind from the form, else from its `type` or its `as`; where the form leaves the kind open and the stub names neither, the kind the plan gives it (one that carries its measures best, in the deck's draw: `--plan` prints it on the page's line, to write as the stub's `type`), and only where no reading task is told from its measures the axis of the measure it names - plotting the values its measures hold in the view it states. A stub that names no recorded measure leaves the page's depth unread (`EVIDENCE_DEPTH`), never at zero, and a `profiles` stub still introduces the deck's `players`;
- only what is absent is estimated: a page with no exhibit yet whose form leaves the kind to the author (panels, a metric strip's proof) has its exhibits' kinds estimated from the measures it names and the shape of its evidence, and is marked `estimated`;
- where a page declares no form or placement, or a rule is broken, it proposes an allocation that satisfies every structure rule as far as the declared descriptors go, found by a deterministic search over the catalogue bounded by a count of steps (never by the clock), and prints where the proposed deck would stand;
- a declared form is kept where only its placement is missing: the plan proposes the placement (`form declared, placement proposed`; `placed` in the JSON) and counts those pages apart from the ones it gives both;
- a declared choice is changed only to mend a broken rule, as the last resort, and is listed as a change with what it was;
- each page that carries its copy is composed as written under its placement, and the plan reads the deck's words a block from those scenes the way `--check` does (`TEXT_FRAGMENTED`, printed under `Read from the scene`): the free choices are steered to keep it in its band - points below a chart, whose labels read as blocks, are not proposed where another placement meets the same rules - and no declared choice is changed for it, nor a plan refused on it. Before the copy is written there is nothing to read: words a block are a property of the copy, so the plan of a spine prints the rule, its band and what a block is, and no number (a stand-in for copy to come read 48 words a block on a deck whose written pages measured 25);
- it proves every exhibit the spine determines drawable, as a draft does, and holds the dependency contract on declared facts: what it refuses is listed as `unlayable`;
- where no allocation exists it names the unsatisfied rule, and says when the page types alone break it;
- it composes the titles the critique will bind, as a draft does, and is refused on one that does not fit (`SPINE_UNFIT`);
- it prints a proposal and writes nothing but a line of the run log; with `--write`, once the allocation meets the structure rules, it writes its choices where a page declares none - the form and placement, and the kind of each untyped stub - into the file the page is written in (the pages file or its part), and leaves a declared choice it would change for the author. A spine is done when `--plan` and `--draft` both exit 0, which a spine of stubs can reach.

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

Every other page that leaves a band empty (`SCENE_VOID`), falls under its word floor (`TEXT_COVERAGE_LOW`) or passes its ceiling (`WORDS`) is told what fills it by the same kind of measurement (`runtime/fill-guidance.mjs`). The page is composed again, in the deck's own sections, with one of two things varied, and the finding ends on the result:

| What is varied | Pages | The finding says |
| --- | --- | --- |
| the words of each point | commentary beside or under an exhibit, the bullets of labelled rows, an executive summary's points | "Its 3 points beside its exhibit fill the page at 31 to 48 words each (93 to 144 in all)" |
| the rows of the table | a lookup, a scorecard, a findings matrix, the table under a strip of figures - where the page has no points, or no length of them fills it | "Its table fills the frame at 5 to 11 rows at the row height it is drawn at" |

- Each length of points is composed in shorter and in longer words; the range is the lengths at which both fill, stated a line inside each end, and a window too narrow for that is called narrow.
- Where the word ceiling stops the points short of the foot, the finding says text alone does not fill the page and names the exhibit that does, with its rows where they were measured to.
- A page with nothing to lengthen (a strip of figures over a chart) is told its exhibit fills it.
- At most six pages are measured in a run, each costing two compositions of a dozen variants; nothing is changed.

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

Prose is written to be scanned. A paragraph is a string or `{ "lead": "...", "text": "..." }`; the lead is a two-to-eight-word subheading saying what the paragraph establishes, set in bold on its own line above the prose, and a paragraph of thirty words or more carries one (`PROSE_UNSIGNPOSTED`). No paragraph runs past sixty words, its lead aside (`PROSE_PARAGRAPH_LONG`): two led paragraphs that each make their own claim read faster than one that makes both. A paragraph is marked as a point is - a phrase from the page's `highlight` or its own `highlight`, or else its own figure, the one a range reaches rather than the one it starts from - so every block of prose carries a bold lead and a phrase in colour.

The page's `highlight` is set wherever the page writes it: points and row blocks, paragraphs, a rail or side panel, the so-what bar and the takeaway, panel captions, and the cells of a table, a findings matrix (bulleted cells too) or a comparison. On a dark or filled panel where the accent does not read, the phrase is set bold in a regular sentence. A phrase that lands nowhere the page draws an accent - only in the title, a heading or a chart's callout - is refused.

Moving the explanation off the page's text column is a choice to write it somewhere else, not to drop it. On a chart the explanation is first a number on the plot: the change or growth rate on an arrow (`cagr`, `changeAnnotations`), the gap bracketed, a benchmark as a labelled reference line (`referenceLines`), a stack's total (`stackTotals`) - strong decks print a signed change on one chart page in eight and a total on one in ten, and a sentence on the plot far less often. A number mark carries commentary `on-exhibit` alone; a sentence callout is optional, and where the callouts are the commentary they carry ten or more words between them - the mechanism, not a label - each measured against the chart's callout box, which holds about ten words (`--types` prints the capacity).

Every caption is a sentence of eight words or more that says what its panel shows and does not repeat the title or the panel heading; a rail is a developed claim of ten words or more. An executive summary with no exhibit renders as a list, and words alone do not fill the page inside its ceiling: declare its exhibit - the answer table, or `metrics` - at the spine, where the critique reads it and the draft proves the page fills (`SPINE_UNFILLED`). Its worked example and scaffold carry the table.

Choose the type from the claim, then the placement from where the reader's eye already is. The same evidence can take different pages: a peer comparison can be a ranking with callouts, panels of the same measure for three periods, or a scorecard. Pick the one whose reading task is the claim's, and then look at the neighbours - the page before and after should ask the reader to do something different.

## Evidence depth

Strong decks' chart pages plot a median of about 22 values (the middle half 10 to 48); a deck whose every chart is one series at its type's minimum plots about 5. The compiler counts what each page plots (`plottedValues`: bars, points on lines, dots, slices, a box's five figures, numeric cells; a waffle counts its parts, a chart group and a panels page the sum) and records it as `pageType.values`.

| Rule | Where | Threshold |
| --- | --- | --- |
| A chart page's floor | compile | 8 values on trend, ranking, composition, relationship and panels with a chart; a bridge 5 (its steps are the drivers it has); pie, donut, treemap and waffle not floored (one whole's parts) |
| `EVIDENCE_DEPTH` | variety contract | from eight chart pages, the median chart page plots 15 or more; under 20 it is advised (strong decks' lower quartile) |

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
| `SPINE_UNDETERMINED` | a spine page leaves something the critique is bound to for the layout to decide: completed with placeholder copy and compiled, it shows a measure in another class or over other periods or members than the critic would be told, shows a measure the spine does not declare, or draws numbers that name no recorded measure; or what its `basis` declares cannot be written into a page of its type at all | draft and plan (a full compile has nothing left to determine; a revision is held to it on the pages it composes) | say it in the spine, before the critique: the view in the `basis` (`as`, `labels`, `members`), the exhibit written by reference (`series: [{ measure }]` with `select`, a table of tokens, a figure's `measure`), the typed exhibit drawn now, or the page type the evidence carries |
| `SPINE_UNFILLED` | an executive summary that leaves a band of its page empty at its word ceiling, with the exhibit the spine declares for it | draft and plan; the full compile reports the band itself (`SCENE_VOID`), and a revision under an older rules version hears it as an advisory | write the summary's exhibit at the spine - the answer table, its cells the calls in words or numbers by reference, or `metrics` - so the critique reads it |
| `TITLE_GAP_SHARE` | titles stating what the evidence lacks, cannot settle or leaves undisclosed on more than 15% of the analytical pages | draft and full | lead with the way the evidence leans; the gap goes in the `subtitle` ([Answer under uncertainty](storylining.md#answer-under-uncertainty)) |
| `GENERATOR_SIGNATURE` | one non-trivial value of `why`, `settles`, `adds`, `takeaway`, `subtitle`, `rail` or `bar` on more than 60% of the pages | draft and full | write the field page by page, or leave an optional one out |
| `PILLAR_UNSUPPORTED` | a section whose pages rest on no `strong` insight | draft and full, with an insight log | find the evidence the pillar needs, or merge the pillar into one that has it |
| `MEASURES_MISSING` | an insight whose evidence is numbers (`series`, `peer-set`, `mix`, `measure-pair`, `bridge`, `fact`) records them only as a sentence | draft and full, with an insight log | give the insight its `measures`: the unit, the population, the periods or members, and the values ([Measures](storylining.md#extract-the-insights-before-the-titles)) |
| `ANALYSIS_REQUIRED` | the deck declares two or more `players` and no computed `compare` sets them all on common measures | draft and full, with an insight log | write `<id>.analysis.json` and run `node runtime/analysis.mjs <id>.pages.json` ([Run the analyses before the outline](storylining.md#run-the-analyses-before-the-outline)) |
| `ANALYSIS_UNRESTED` | a computed analysis no page names in `evidence` | advised | give the result its page, or cut the analysis |
| `SOURCES_UNFILED` | an insight whose `sources` are not files under `sources/` beside the pages file - a publisher's name or a registry key where the path of the file belongs, or none | advised at every compile, a draft's too, with every such insight listed at once; the storyline critic is told the same as problems of the log | save the file under `sources/` and name its path (`"sources/accounts-fy26.csv"`); a citation goes on the measure (`cite`) or the page (`source`) |
| `MEASURES_CONFLICT` | one measure - one name, population and unit - recorded in two insights: with different numbers at one period or member it blocks; with the same numbers, or one number at two precisions, it is advised. It reads structure only, and does not see one quantity under two names, one population spelled two ways, two scales of one unit (millions and billions), one period under two labels (a two-digit and a four-digit year), or an entity's own record against its row in a peer set | draft and full, with an insight log | keep the number the source gives in one record; where the two are different quantities, say so in the `population` or the measure's name ([Extract in parallel](storylining.md#work-in-parallel-with-subagents)) |
| `WAIVERS_INVALID` | `waivers` on `deck` is a list of `{ code, reason }` naming a `BAR_*` code once each, each reason a sentence the reviewer can check | draft and full | fix the list, or drop the waiver and clear the bar |
| `STATEMENT_INVALID` | what the deck says of its request, its evidence scope, its answer's status or its assets is not in form: `requestProvenance`, `evidenceScope`, `answerStatus` with `answerLimits`, and `assets: { fetch: "build" \| "none", reason }` | draft and full | write the statement in the form the message gives; `assets.fetch: "none"` needs its `reason` in a sentence |
| `ASSETS_NEEDED` | the deck plans logos (its declared `players`), photographs (`{ alt }`) or places (a marker's `place`) whose files are not in `assets/` beside the pages file, so the build will fetch them | advised, draft and full; the compile prints the list and the choices | supply the files under the names the compile prints, let the build fetch them, or declare `assets: { fetch: "none", reason }` on `deck` ([Design](design.md#make-every-exhibit-earn-its-page)) |
| `ASSETS_OFFLINE` | the deck declares `assets: { fetch: "none", reason }`: the build fetches nothing, players are introduced by name, a deck supplied no photograph is expected to carry none (`CRAFT_NO_PICTURES` is advised), and the build result, the reviewer's packet and `delivery.json` say which files were not available | advised, draft and full | nothing to repair; supply the files to show the marks and the photographs |
| `REVISION_UNMAPPED` | a revision's imported slide still carrying only its `draft` copy, neither mapped nor marked to be carried | reported in a draft, refused in the full compile | keep the slide as it is (`carry: true` beside its `draft`), give it a `type` and its choices, or delete it from `pages` |
| `REVISION_INVENTORY_MISSING` | a revision's `inventory` is not beside the pages file | draft and full | keep `<id>.inventory.json` where `import-deck.py` wrote it, beside the pages file |
| `REVISION_CARRY_INVALID` | a carried page that cannot be carried as written: it names no slide of the source deck, or one another page already carries or redraws; its `title` differs and the slide has no title placeholder; a `replace` names words the slide's own text does not print (a chart's numbers are in the chart), words it prints only inside longer words or numbers ("12.4" in "£12.4m"), or words it prints more than once without `"all": true`; or an `only` names a page that is not another page of the deck | draft and full, on the page | correct the page - name the figure whole, narrow the words or say `"all": true`; change a chart's values, or anything but words, by giving the page a `type` in place of `carry` and `draft` |
| `REVISION_RULES_VERSION` | a revision's pages file records a `rulesVersion` below the one its import stamped on the inventory, and gives no reason | draft and full | put the stamped version back, or say why the deck is held to the older rules in a sentence the reviewer can check: `rulesVersionReason` on `deck` |
| `REVISION_SOURCE_MISSING` | the copy of the source deck (`<id>.source.pptx`) is not beside the inventory, or is not the deck the inventory was read from | draft and full | put the imported deck back under that name, or import it again |
| `REVISION_SLIDE_SIZE` | composed pages beside carried slides of a deck whose slides are not the 1280 x 720 px the runtime composes at | draft and full | make the change as a text edit on the carried slide, or rebuild the deck: import without `--carry` and map every slide |
| `REVISION_CARRY_DRIFT` | a carried slide whose parts in the built file are not the source deck's, byte for byte | refused by the build | a fault of the assembler, not of the pages file: report it with the source deck |
| `TITLE_COUNT_ONLY` | a title that states a count with no comparator or consequence | advised | add what the count is against: a peer, a target, a prior period, or what follows from it |
| `PAGE_SPLITS` | a page the composer draws as two slides or more: a table with more rows than one page holds at the densest setting a table takes (the composer steps the density down before it splits) | advised at every compile, with the rows one page holds; each part repeats the title as (1/2), (2/2), the commentary stays with the first and the deck is a slide longer than its pages | keep the split where the reader looks rows up, or cut the table to the rows the finding gives and move the rest to the appendix |
| `COMMENTARY_MOVED` | a page whose points are declared beside its exhibit and drawn under it: they fill too little of the column beside a chart that uses its width, so the composer sets them below | advised at every compile; the deck's placement rules count what a page declares | write the further developed point the evidence carries, so the column holds, or declare commentary `below` |
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

- **A bound exhibit** names a measure in each series (`series: [{ measure, name }]`), or one `measure` on an exhibit that plots a single list, such as a donut. The runtime writes its `categories` (a donut's `labels`), each series' `values`, its `unit` and its `basis`: leave all four out. Every form that plots measures is written this way, each in the shape its chart reads ([below](#every-chart-form-by-reference)). `role` and `relevance` sit on the exhibit. `select` narrows the axis - `{ from, to }` or `{ periods: [...] }` over time, `{ members: [...], order }` over a peer set, the members in the order written or by the first series' value (`"descending"`, `"ascending"`); unselected, the axis is every period or member all the series share. A measure of one value among the series is drawn as a rule across the plot.
- **Recorded, then assumed.** `"measure": ["i-crews/on-shift", "A-crews/path"]` joins a recorded series and the scenario's path that starts from it as one line. The axis runs in period order whichever measure is listed first, a recorded value is kept wherever both hold a period, and the assumed run is bracketed on the chart ("Recorded", "Assumed"); it has to be one run at the end of the axis, and a join that would put a recorded period after an assumed one is refused. An exhibit's own `forecastFrom` or `periods` is kept where it starts at the first assumed period.
- **An assumption is said where it is shown.** A metric drawn from an assumed measure gets the sublabel "Assumed", and a chart of an assumed peer set or an assumed rule across the plot gets a note line ("Assumed, not recorded: ..."), unless the author's own words on it already say so. A token only prints a number, so nothing is drawn for it: the page's declared notes, which the storyline critic reads, list every assumed measure the page shows and where the page says so, and every negative value printed without its sign.
- **Indexed.** A `trend` of form `indexed` names the measures of an `index` analysis (`A-index/cash`, ...): the base comes with them and only `subject` is added. Or it names raw series, in any units, with the `indexBase` the runtime rebases them at. Either way no index number is typed.
- **A bound figure.** A strip's `metrics`, a hero's `kpi`, a row block's `metric` and a fact-grid or stat-list item take `{ measure, format, label }` in place of `value`. A measure of one value is named alone; one value of a longer measure is `<measure>@<period or member>`.
- **A token**, `{{<measure>[@<period or member>] | <format> | <modifier>}}`, in any text of the page - title, subtitle, points, rail, bar, takeaway, a caption, an annotation, a metric's value or sublabel, a table cell - is replaced by that number; an undisclosed value prints as n/a. Only braces round a measure reference are a token: `{{client}}` in copy is left as written. Where it stands decides what it says of the page: in a table's cell, a figure's or a metric's `value`, the exhibit states that measure and is held to the claim as one that shows it; in the words beside - a metric's label or sublabel, an item's text or label in a timeline, a list or a set of cards, a heading, a caption, a callout - it is copy, a recorded number said in a sentence, and asks nothing of `settles.measures`.
- **A table of tokens, or a grid of bound figures, needs no `basis`**: it is written from the references, where every measurement in the exhibit is one. Measurements are read as the number trace reads them: a year, a period label ("FY26"), an ordinal ("3rd") and a count in a phrase ("3 of 8 sites") are not, so they sit beside the tokens freely. A cell that types a measurement - "5.7%", a bare number alone in its cell, a bar cell's `value` - makes the exhibit a typed one, and `BASIS_MISSING` names what is typed.
- **Format.** The digits are written `0`, `0.0` (a 0 for each decimal place) or `0,0` (thousands separated), with what is printed round them kept: `"+0.0%"` (the leading `+` prints the sign of a rise too), `"CHF 0.0bn"`, `"0.0x"`. Modifiers follow a `|`: `abs` prints the size without its sign, for a sentence that words the direction (the deck records each negative value printed this way); `/1000`, `/1e6` or `x100` rescale by a power of ten, so a record kept in millions prints in billions and a ratio as a percentage. With no format the number prints to one decimal place at most.
- **A printed number states its value**, by the rule a typed one is held to, or the binding is refused (`BINDING_UNRESOLVED`) with the format that would state it. It keeps two significant figures of the value - `0%` does not print 3.4, nor `0.0` 0.04 - with one exception: a percentage or percentage points may be printed to one decimal place (-0.86% as "-0.9%").
- **A printed scale is the unit's.** Where the format, or the word typed straight after the token, names a scale (k, thousand, m, mn, million, bn, billion), the modifier is exactly the factor between the unit's scale and it: a unit in `m` printed as `bn` takes `/1000`, the same scale takes none, and a unit that names no scale is whole units - 126,604 `employees` prints as `0.0k | /1000`, never as `0.0m | /1000`. A letter meant as the unit itself ("m" for metres on a measure kept in km) reads as a scale: record the measure in the unit the page prints. `x100` prints a ratio or a fraction as a percentage and is refused on any other unit; a percentage is printed as recorded, with no scaling modifier.

#### Every chart form by reference

| Form | Written as | The runtime writes |
| --- | --- | --- |
| `sparklines`, `bubble-grid`, `boxplot` | `series: [{ measure }]` - for a box plot the five measures named `min`, `q1`, `median`, `q3`, `max` over the same members | a small line a series; the members as rows and a measure a column; a box a member |
| `treemap`, `donut`, `pie`, `waffle` | `measure: "<ref>"` (a waffle `series: [{ measure }]`) over the parts | a tile, slice or block a part |
| `combo` | two series in two units | the second on its own axis, with its unit |
| `dumbbell`, paired bars | the members' series with `select: { periods: ["FY19", "FY26"] }` and `pivot: true`; or two measures over the same members | each series a row, the two dates its ends |
| `slope` | series with `select: { periods }` of two to four dates; or two dated measures over the members with `pivot: true` | a line a member between the dates |
| `scatter`, `bubble` | `points: { x: { measure }, y: { measure }, size: { measure } }` | a point a member, the axes titled by measure and unit; refused where a member lacks a value until `select: { members }` says which are plotted |
| `bullet` | `series: [{ measure }]` with `targets: { measure }` | one target for every row, or one a member |
| `waterfall` | one measure whose members are the opening total, the steps and the closing total; or `bridge: { from: { measure: "<ref>@<period>" }, steps: { measure } or [{ measure, name }], to: { measure } }` | the totals and steps; refused unless the steps reconcile the totals to the precision recorded (`residual: "<label>"` names the step that carries what they leave) |
| scorecard `heatmap`, `bars`, `progress`; a lookup table | a `{{<measure>@<member>}}` token a cell, under a coded column | each cell's number: a table is bound cell by cell, and `--scaffold` writes the whole table |

`pivot: true` turns a bound exhibit's table over: each measure becomes a category and each selected period or member a series. What is not written from measures is what no measure holds - a scorecard's judged cells (`harvey`, `rag`, `lights`, `check`, `dot`, `trend`, `binary`), a diagram's stages, a schedule's dates, a radar's judged attributes - and a `pictogram`, whose counted figures the author rounds from the share.

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
| `SOURCE_UNCITED` | `source` leaves out a `cite` key of a measure the page shows (the measure's own `cite`, otherwise its insight's), or is typed text where the measures carry their citation; on a revision an imported page's typed line is kept and the finding advises | leave `source` out, or list the registry keys |
| `RELATION_UNDECLARED` | two measures of the claim, in one unit over the same periods or members, are drawn in separate exhibits and no `settles.relation` says what is read between them | declare the relation and draw it |
| `TITLE_NUMBER_UNTRACED` | a number typed in a title is neither a value of a measure the page rests on, rounded at the precision the title prints it, nor a figure a finding of its evidence states - refused in a draft too | print it by reference, at the record's rounding ("4%" for 4.3%, never "13%" for 13.7%), or record the measure it comes from |
| `NUMBER_UNTRACED` | advised: a number typed on the page is no value of any measure the page rests on | print it by reference (`{{<measure>@<period or member> | 0.0}}`); a number nobody recorded is a measure to add, an analysis to run or an assumption to state |
| `RELATION_SPLIT` | the claim asserts a `gap`, `levels`, `ratio` or `index` and each measure sits in its own exhibit; or `separate` gives no `reason` | set them on one scale or plot the computed result (`author-deck.mjs <pages> --repair-relation <page-id>` prints the merged exhibit, bound to its measures), or declare `separate` with its reason |

### What the pages say between them

Every rule above reads one page against its evidence. These read the deck (`runtime/gates/consistency_gates.mjs`): what each page states - a bound exhibit's values, a bound figure, a token, a typed number that is exactly one value of the measures its page rests on, a count written with its unit ("158 clinics"), and every number an exhibit sets under a series or row name and a category or column label. They are deck-structure findings, reported on every run, a draft's included.

| Code | Rule | Repair |
| --- | --- | --- |
| `NUMBERS_DISAGREE` | blocks where two pages each print one of two records the log holds as one measure (the pair `MEASURES_CONFLICT` names), or a typed table gives another number under the series and label another page's exhibit of the same measure gives; advised where two pages print what reads as one quantity under two measures the log keeps apart - an entity's own record and its row in a peer set, or two measures that agree at most of the labels they share - and no page of the two prints both, and where two exhibits that name no measure give different numbers under one pair of names | keep one record and name it on both pages; print the typed number by reference; where they are two dates or two definitions, say which beside each number |
| `NUMBER_FORMATS_DIFFER` | refused: one value printed at different precision or scale in the prose of different pages - titles, points, captions, bars, figures; a table's cells keep the precision they were recorded to | one format for the value on every page, or say on the page that rounds that it does |
| `NUMBER_STALE` | a revision: a number changed on one page still stands in its old form elsewhere - on another slide, in a slide's speaker notes, or further down the edited slide. It blocks where the old figure is printed whole or stated as the same quantity, and advises where less than that says it is the same figure ([what blocks and what advises](#a-stale-figure-what-blocks-and-what-advises)). No recorded rules version excuses it | change it there too - `replace` on a carried page, naming the words as that slide prints them; the new value on a composed one; where the other page states a different thing, name it in `only` on the edit or on the composed page (`"only": ["s05"]`): it is not read for that change and is listed for the reviewer |
| `WORDING_STALE` | a revision, words changed on one page that another still carries. Blocks where the old words of a `replace` that drops no figure, or a title of four words or more - rewritten on a carried slide, by `title` or through `replace`, or on the page composed in its place - are still printed whole on another page; advised for a shorter title, and for a name replaced inside a sentence a composed page otherwise kept that another page still uses. No recorded rules version excuses it | make the same change there; where the words on the other slide are a different thing, name that slide in the edit's `only`; a name that is still right elsewhere is left |
| `PROOF_REPEATS` | advised: a page plots, as proof, a measure over the same periods or members as the page before, or shows nothing as proof that an earlier page does not; blocks where the two are one page twice - their claims are about the same `settles.measures` and each shows exactly the views the other shows. A threshold drawn on both, and a table or a figure of a measure another page plots, are not repeats | merge the two, or show what the other does not: another window (`select`), the relation computed in place of the levels, only the measures the first page does not show |

#### A stale figure: what blocks and what advises

| The change | Blocks where another slide | Advised where |
| --- | --- | --- |
| a text edit on a carried slide that drops a figure (`replace`, a new `title`) | prints the old words or that figure whole ("£12.4m"), or states the same quantity in another notation - the same value, kind and scale: "£12.4 million", "GBP 12.40m", a table's 12.4 under "Revenue (£m)" | the same amount stands at another scale ("£12,400k"), a chart's data rounds to it (12.43), or only the digits match |
| a page composed where a slide stood | states the old number of the same thing while the page shows the new one - under the same series and label, in the same words, or as the same stated quantity | the words are only alike, no replacement is shown, or only the digits match |

A number is matched across pages by what it is said of, conservatively. Under a measure, the match is exact. Under names, two exhibits are compared where the series or row name and the category or column label are the same. In text, a number is said of the words around it in its clause: two are the same thing where every word of the shorter label stands in the longer and they share two or more (a period both name must be the same period, and a whole number in a sentence must count the same thing). Three shared words that fall short of that are alike, which asks and never refuses. What is not seen: one thing under two spellings of its label, and a number that coincides with another value the changed page still prints.

The overlap `PROOF_REPEATS` finds is also written into the page's record, where the storyline critique and the deck review read it as a `declared` note ("plots ... over the same periods or members as p12 does"), so the critic judges whether the second page proves anything the first does not. On a revision only an overlap with a changed page is reported.

### The content plan

The content gates run on the content plan the compile derives. They block unless marked advisory.

| Code | Rule | Repair |
| --- | --- | --- |
| `CONTENT_NO_CLAIM` | a title that names a topic rather than proving something | state the finding: subject, verb, magnitude or comparator ([Action titles](copy.md#action-titles)) |
| `CONTENT_ADDS_NOTHING` | `adds` empty, or built from the words of the exhibit it adds to | say what the commentary adds - the mechanism, the consequence - or set commentary `none`; a qualification is a footnote, not commentary |
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
| `METRIC_WORD_VALUE` | a metric strip's tile or a headline figure (`kpi`) whose value has no digit in it - "Below plan", "Asia", "Strikes", "Seven" | bind it to the measure that holds its number (`{ measure, format, label }`), write a count in digits or a date, or say the word in the copy and give the tile a measured figure |

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
| `CLAIM_UNBACKED` | compile, draft | a rank, universal, exclusive or majority word - largest, second only to, every, never, no rival, only, only because, most of - in a title that no finding of the insights the page rests on says a word of the same kind; in the copy it is advised and listed under `unbackedClaims` | narrow it to the population, period and measure the record holds, or rest the page on the insight whose finding states it; `--claims <ids>` prints each sentence with what holds it |
| `FINDING_RANK_UNBACKED` | compile, draft | an insight's finding calls a member the largest or lowest and its own measure over members ranks another there; advised where the finding ranks with no measure over three or more members to rank in | correct the finding or the measure; record the population as a measure over its members, or say whose ranking it is |
| `PROSE_PARAGRAPH_LONG` | compile | a paragraph of more than 60 words (its lead aside) | split it into two paragraphs that each make their own claim under their own `lead`, or cut what the exhibit or panel already says |
| `PROSE_UNSIGNPOSTED` | compile | a paragraph of 30 words or more with no `lead`, or a lead under 2 or over 8 words | write the paragraph as `{ "lead": "...", "text": "..." }`: the lead is a subheading saying what the paragraph establishes, set in bold on its own line above the prose, so a column of prose reads by its leads before its sentences |
| `SHARES_IN_TILES` | compile, advisory | two shares of one measure (their labels share two words) more than five times apart, set as metrics, fact-grid or stat-list tiles or cards | the shares on one 0-100% scale: a bar, a dumbbell or a slope |
| `VARIETY_TABLES` | variety contract | more than five of any ten consecutive analytical pages carry one table construction: the first column filled or open, the cells coded or text, a short or long grid, a band at the foot or none | draw each as its evidence: funding stages as a bridge or flow, commitments as bars aligned on their durations, verdicts as a scorecard, measures as a chart |
| `PLAYERS_UNMARKED` | variety contract | the deck declares two or more `players` - or, without them, two names recur in a fifth of its titles - and the cover and first three analytical pages do not show each one's logo | a `profiles` page (form `logos` or `logo-table`) or a `logo` column early; `{ alt: "<Name> logo" }` is fetched from the player's Wikipedia infobox, or drawn as the player's name under `assets: { fetch: "none", reason }` |
| `PROFILE_UNPICTURED` | variety contract | a `profiles` page of cards with no logo or picture on any card | each card's `logo` or a credited `image` (`{ alt, search }`) |

Two word rules belong with them. An executive summary (`summary` form `executive-summary`) is held to the text page's upper quartile, 204 body words, rather than its outlier fence of 329 (`WORDS`): the summary is read first and in full. Where the answer has more parts than 204 words carry, the summary runs on to a second page of the same form, as strong decks' summaries often do: the two pages are read as one summary for the answer up front (`CONTENT_ANSWER_UNCARRIED.upfront`), the first page's title leads with the verdict, and each page is held to its own 204 words. And `TEXT_BLOCK_TOO_LONG` reads a block as the reader meets it - a point's bold lead and its text are one run, and a card's text or a table cell is prose too - so a 171-word scenario no longer passes as a 40-word lead and a 131-word point.

### The variety contract

`author-deck.mjs` refuses to write a deck of twelve or more content pages that breaks these rules (exit 2, nothing written). The build refuses it too, because the rules run from the same code (`runtime/gates/variety_gates.mjs`):

| Code | Rule | Repair |
| --- | --- | --- |
| `PAGE_TYPE_UNDECLARED` | every content page has a page type | author the page in the pages file with its `type`, `form` and `commentary` |
| `PAGE_TYPE_EDITED` | the compiled structure is what the choices produce; the build recomputes it | change the choice in the pages file and recompile; never edit `<id>.deck.json` |
| `VARIETY_TYPE_SHARE` | no type is more than 25% of the pages | reread the commonest type's claims: a position in the set is a `ranking`, a mix a `composition`, one cut per member `panels` |
| `VARIETY_TYPE_RANGE` | at least one type per five pages, up to eight | find the claims the deck states in another type's shape - a rate, a mix, a mechanism, a schedule - and give them that type |
| `VARIETY_TYPE_RUN` | no three pages of one type in a row, unless they share a `series` (one template on purpose) | the finding names the run, the page to change, what its evidence could become and a page of another type it could trade places with |
| `VARIETY_COMMENTARY` | no placement is more than 30% of the pages, and points `below` the exhibit no more than 12%; `beside` and `beside-left` count as one | move the explanation where the reader's eye already is: callouts on the chart, captions, the table's cells, or `none` |
| `VARIETY_TAKEAWAY` | at most 25% of pages close on a takeaway line or a so-what bar | drop the closes that restate the title; keep them where the implication goes beyond it |
| `VARIETY_PANELS` | from fifteen pages, at least 20% carry two or more exhibits, counted on the page as drawn: each panel of a row, grid, stack or sequence, a metric strip over its exhibit, the photograph under a `photo-backdrop` exhibit, the exhibit on each labelled row (aligned bars are one exhibit) | [Beyond one exhibit and a column](#beyond-one-exhibit-and-a-column) |
| `VARIETY_COLUMN` | from fifteen pages, at most 20% are one exhibit with a text column beside it - points beside or before it (`beside`, `beside-left`), a `rail`, or a hero number with its points beside its proof. A rail counts: the rule reads how the page is drawn, and a rail is a column beside the exhibit. `PAGE_SHAPE_FLAT` reads what the page argues with, and there a rail - like a so-what bar or a takeaway - is one claim and leaves the page evidence-only, where points, paragraphs, captions and cards make it evidence-with-commentary. So moving points into a rail keeps the page under this rule and changes its architecture under that one; both standings lines say which reading they take | [Beyond one exhibit and a column](#beyond-one-exhibit-and-a-column) |
| `VARIETY_SIGNATURE` | no one drawn page - its layout, how many exhibits of which family, a text column or points, a rail, its close - is more than 20% of the pages | the finding names the pages that share it; redraw those whose claim asks the reader something else |
| `EVIDENCE_DEPTH` | from eight chart pages, the median chart page plots 15 values or more, and is advised under 20 | [Evidence depth](#evidence-depth): the peer set, a prior period or a benchmark as a second series, a longer window |
| `VARIETY_EXHIBIT_MIX` | each evidence family - chart, table, diagram, numbers, picture, text - within its band across the compiled pages (`runtime/weight.json` `plan.mixEnforced`) | move pages out of the family over its band into the form their evidence reads as: a table of a trend is a chart, a list of steps a mechanism |
| `VARIETY_EXHIBIT_RANGE` | enough kinds of exhibit for the deck's length: a floor of distinct exhibits per ten pages | draw each claim in the form its evidence is, from `--types`, rather than one exhibit restyled |
| `VARIETY_KIND_SHARE` | advised, never refused: from two dozen exhibits, the share the three commonest exhibit kinds carry, read against a mark of 55%. The range floor counts kinds, and a deck meets it with a dozen kinds drawn once while three carry two thirds of its exhibits. The mark is not calibrated on the reference decks, which record families and not kinds; it is shown on every run in "Where the deck stands" | the standing names the pages in those kinds that another form carries as directly: take the form `--plan` allocates them. Where it names none, the mix follows from the claims, and a wider one needs evidence of another shape. A revision is shown the share and is never advised on it |
| `VARIETY_FIT_UNUSED` | advised, never refused: a page drawn in a form - or carrying an exhibit in a kind - that only serves its claim while another form of its type is its best fit ([Which form carries which claim](design.md#which-form-carries-which-claim)). A form whose content is a judgement, a table chosen for exact values and a revision's imported pages are not judged | take the best-fit form the standing names (a form within the type is the layout's to change, and keeps the critique), or keep the form where the page's point is something the measures do not say, and say so in `why` |

The limits sit outside what strong decks measure, so a deck that chose each page for its claim passes them with room. Placement and repetition are counted on the page as drawn, not as declared: a column on the left and one on the right are one placement to a reader, and a trend beside its points and a stat list beside its points are one page. The compiler records each page's drawn skeleton in its `pageType` (`skeleton`, and `drawn`: how many exhibits and whether it is an exhibit beside a column), and `VARIETY_SIGNATURE` names the pages that share the commonest.

Strong decks carry two or more exhibits on a quarter to a third of their pages and draw one exhibit beside a column on about one in eight; the floor sits under the first so a deck that chose its pages passes with room, and the cap sits half as high again as the second. `author-deck.mjs` prints the deck as drawn on every run - `structure`: the share on two or more exhibits, the share beside a column with the pages named, and every skeleton with its count - so a deck drifting toward one exhibit and a column is seen before it is refused. Do not rotate choices to meet them: a deck that breaks one has pages whose type was not chosen from the claim, and the fix is to ask of each such page what it has to show.

## Worked examples

`examples/page-types.pages.json` is a complete pages file - a fictional regional rail operator's growth plan, with illustrative numbers - that uses every page type at least once, with its `form`, `commentary`, `takeaway`, `why`, `settles` and `adds` filled in and each page's explanation written where its commentary says it lives. Do not read it whole: `author-deck.mjs --example <type>` prints the pages of one type. Copy the shape of the one you need and replace the content: the keys, the data shape its form reads and the length of its callouts, captions and points are the ones that compile and build.

Page `p10b` is labelled row blocks with a number on each row and `p24b` the same with a headed chart on each of two rows, `p13b` a ranking closed by a so-what bar, `p16b` three exhibits joined by arrows, `p07c` four panels of one indexed measure with a caption under each, `p06b` a chart on a card over the photograph of its subject (`photo-backdrop`), and `p25` a scorecard whose last column is each row's implication.
