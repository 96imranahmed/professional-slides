# Design

Design owns the evidence relationship, attention, treatment and visual hierarchy. [Storylining](storylining.md) owns whether the claim is supported and deserves a page; [Composition](composition.md) owns its geometry.

## Pick the page type from what the page says

Decide what the page has to make the reader see, then take the page type and form that show exactly that. A deck built this way is varied because its messages are, not because it rotates templates; one that reaches for a column chart and a table on every page has skipped this step. `author-deck.mjs --types` lists every type with its forms, placements, limits and data; this table is the choice between them.

| The page has to show | Page type, form | Not |
| --- | --- | --- |
| A level compared across a few categories | `ranking`, form `column`, or `bar` when labels are long | A table of the same numbers |
| A ranking where the order is the finding | `ranking`, form `bar` sorted or `lollipop`; the whole field, `distribution` | A pie |
| Several measures for the same members | `ranking`, form `aligned-bars` | Four charts with the members in four orders |
| Change over time | `trend`, form `line`; `column` for a handful of periods; `indexed` for peers of different sizes | Unconnected bars for a trend |
| Two measures on one time axis | `trend`, form `combo` | Twin axes without a reason |
| Before against after, per category | `ranking`, form `dumbbell`; `trend`, form `slope` for two to four dates | Grouped bars with ten pairs |
| Spread within each member of a set | `ranking`, form `boxplot` | An average alone |
| Which of many series moved | `trend`, form `sparklines` | Twelve lines on one plot |
| A forecast read with its numbers | `trend`, form `model`, the chart over its data table | A chart and a separate table of the same figures |
| Parts of a whole, one period | `composition`, form `donut` for two to four parts, `waffle` for a share read as counts, `treemap` for many | A pie with eight slices |
| A population share read as "six in ten" | `composition`, form `pictogram` | A single bar at 60% |
| Composition changing over time | `composition`, form `stacked-column`; `trend`, form `stacked-area` | Side-by-side pies |
| Size and share together | `composition`, form `marimekko` | Two separate charts |
| A bridge from one total to another | `bridge`, form `waterfall` | A stacked bar |
| A relationship between two measures | `relationship`, form `scatter`; `bubble` when a third measure matters | A table of pairs |
| One question for two to four cuts | `panels`, form `row`, `grid` or `stack`, a `caption` under each | One chart per page, four pages running |
| Cause and effect, before and after | `panels`, form `sequence` | Two pages the reader has to join |
| Where on a map, a network from a hub, flows between places | `place`, form `map` ([Geography](geography.md)) | A list of countries, or countries filled to stand for cities |
| The players the deck compares | `profiles`, form `logo-table` with the numbers the deck will use, or `logos` with a line each | Names in a bullet list |
| Each player's profile across three to eight attributes | `profiles`, form `radar` | A table whose shape the reader must picture |
| One number that is the whole point | `numbers`, form `hero-number` with the evidence that produced it | A bullet |
| Three to six headline numbers | `numbers`, form `metric-strip` over its exhibit; `stat-list` or `fact-grid` when each needs its sentence | Numbers buried in prose |
| Exact values looked up across fields | `lookup`, form `measure-table` or `table`, each column's cell `type` coding what it holds | A chart that hides the digits |
| Members judged against criteria | `scorecard`, form `harvey`, `rag`, `lights`, `check`, `heatmap` or `bars` | Prose pros and cons |
| Findings down the side, evidence across | `matrix`, form `findings-matrix` | A table of sentences |
| Options compared on the same terms | `options`, form `compare`, `table-halves` or `two-up` | Before and after in prose |
| A sequence of steps | `mechanism`, form `process`, `chevron-process`, or `steps` when each builds on the last | A numbered list |
| Steps with branches or merges | `mechanism`, form `flow` | Chevrons that pretend it is linear |
| Something that repeats | `mechanism`, form `cycle` | A process with an arrow drawn back |
| A decision with branches | `mechanism`, form `tree` | Nested bullets |
| A hierarchy, a dependency stack, an ambition on levers | `mechanism`, form `layers` or `framework` | Three unrelated boxes |
| Quantities moving from one set to another | `mechanism`, form `sankey` | Two tables |
| Rank movement across periods | `mechanism`, form `rank-flow` | A table of ranks |
| Two things judged on two axes | `mechanism`, form `matrix`; `quadrants` when each box holds a list | A ranked list |
| Position between two poles, or a judged grade on a named scale | `mechanism`, form `spectrum` | A 1-to-5 score nobody measured |
| A hub and what depends on it | `mechanism`, form `relationship-network` | A list of dependencies |
| Dated milestones, durations, waves | `schedule`, form `timeline`, `gantt` or `roadmap` | A table of dates |
| A portfolio of bets by when each pays | `schedule`, form `horizons` | A timeline that dates bets as tasks |
| Three to six parallel ideas | `parallel`, form `cards` (an `icon` each), `capsules` or `arrow-rows` | Plain bullets |
| A point per area, each with its evidence | `parallel`, form `labelled-rows` | A column of bullets beside a chart |
| A thing worth seeing: a product, a place, a person | `picture`, form `picture-hero`, `picture-pair`, `picture-strip` or `photo-backdrop` | A description of it |
| Report-style argument with no single exhibit | `argument`, form `memo` or `sidebar` | A single wide block |
| What people said | `statement`, form `quotes` | Quotes inside bullets |
| One sentence the deck turns on | `statement`, form `statement`, over a photograph when there is one | A title on an empty page |

A chart that is no type's form - a range, radial bars - reaches a page as a panel's `type` on a `panels` page, which compiles any registered exhibit ([Charts](charts.md), [Components](components.md)). Reach for one only when no form in the table says the finding.

When two rows fit, the message decides: "China rose from sixth to first" is movement, so `rank-flow`; "China is first" is a level, so a sorted bar. Record the choice and the rejected alternative in the page's `why`. A deck that finds itself using one chart form for most of its charts should go back through this table page by page; `PLAN_CHART_MONOTONY` reports it.

### Which form carries which claim

The table above is also held as data, in `runtime/claim-fit.mjs`, so the programs that propose a form read the same choice an author makes. For a page it reads the **reading task** off the measures the page shows - the axis they run over, how many periods or members the page shows of them, how many series, their units, a threshold among them, whether they are parts of a whole or the steps of a bridge - and off the claim (`settles.kind`, and the relation it asserts between its measures: a gap, levels, an index, or each read separately). Every form of the page's type is then graded against that task:

| Grade | Means | Example, for two dates of each of ten members |
| --- | --- | --- |
| best fit | the form shows the very thing the reader is asked to read, and the measures fill it | `dumbbell`: the gap is the mark |
| serves | the values are there and the reader works the relation out | `bar` with twenty bars in ten pairs |
| weak | the form draws the measures and not what the claim says of them | `distribution` |

`author-deck.mjs --types` prints the whole table by reading task ("Which form carries which claim"), and each type's forms whose content is a judgement or the subject's own shape - a Harvey ball, a cycle, a gantt - with what the page has to show for the form to be right; those are never proposed or questioned from measures.

One definition, read everywhere a form is chosen or judged:

- **`--plan`** gives a page that declares no form one of its best-fit forms, and never a weaker one. A structure rule those forms cannot meet between them is reported unmet with the pages that pin it, and with what meeting it would cost - the pages a search over every form would move off their best fit - which the plan does not propose. A declared form is always kept.
- **Where several forms fit equally** the choice is free, and the plan makes it in this order, saying which on each page's line ("3 forms fit equally (lollipop, bar, column); lollipop chosen by this deck's draw for the reading task"):
  1. a form the deck's draw features from its design system's repertoire;
  2. the deck's own hand. The `variation` draws, once for the deck, an order of the kinds that can be a best fit for each reading task - this deck's rankings lead with dot plots, its trends with columns - and no two tasks lead with one kind where the table gives them another. A page takes the mark whose turn it is: the lead until the deck has drawn it twice for each time it has drawn the second, three times for the third. So one deck is mostly one mark for one reading task, with its equals among them, and the next deck from the same spine leads with another.

  A deck with no `variation` has no hand: it takes the kind it has drawn least, then the room under the structure rules' caps, then the catalogue's order.

  The exhibits of a page whose form leaves their kind to the author (`panels`, the chart under a `metric-strip` or beside a `hero-number`) are chosen the same way, one kind for every cut that can take it. So two decks planned from one spine under different seeds differ on the pages with a free choice and agree on the rest.
- **An exhibit the spine declares by a `basis` stub with no `type`** is given its kind the same way. The plan prints it on the page's line ("exhibits chart.lollipop, chart.lollipop - 3 kinds fit equally"), every run reads the stub as that kind, and that is the `type` to write on it. A stub that says `as: "table"` or `"figure"` has said what it is.
- **A form or a kind you have already declared** is kept. Where it is one of several equals, the line says which the deck's draw would take ("this deck's draw takes lollipop"), for you to take or leave before the critique.
- **How much is free** is a property of the evidence, not of the plan. On three decks written from one brief, four exhibits in ten were a table, a grid of figures or a diagram whose page type the evidence set; a quarter were charts one form carries best; a third had a free choice, mostly between two or three kinds, and seven in ten of those sat on pages of open kinds. Two seeds therefore differ on about a fifth of a deck's exhibit pages and no more: the rest is the same evidence asking for the same form. The page type is not a second source of variety - a type rests on one shape of evidence, so almost no chart page has an equal in another type its evidence can rest under (the plan says so where one has: "another type carries it as directly"). `evals/quality/variability.mjs` measures all of this on any spine.
- **`--scaffold <type> --evidence <insight-id>`** tries the forms best fit first, binds the first that binds completely, and says which others fit as well, which only serve, and which would fit and what the measures lack for them. With `--id <page-id>` it takes the form that page declares - the plan's allocation, once copied in.
- **`--draft`** lists, for each page with a choice to make or mend, the forms that are its best fit (`fits`).
- **The fit search** tries a misfit page's other forms best fit first, and marks an alternative that fits the layout and carries the claim less directly than the form the page has.
- **Where the deck stands** shows two readings on every run, neither a refusal: `VARIETY_KIND_SHARE`, the share of the deck's exhibits its three commonest kinds carry, with the pages among them that another form carries as directly; and `VARIETY_FIT_UNUSED`, the pages drawn in a form that only serves their claim while another of their type is its best fit. The deck reviewer is shown both, and the storyline critic is told where a page's type has no best-fit form and another type has one.

What this does not do is rotate. A page whose claim one form carries best gets that form in every deck; a deck whose evidence is twenty trends is twenty line charts, and the remedy the standing names then is evidence of another shape, not another chart of the same one.

**On a revision** none of this restyles the user's deck. An imported page keeps the form it declares, and one that declares none takes the form that draws what its source slide drew (the inventory's chart type), whatever the fit says of it; the plan never changes either to mend a rule. A page the revision adds takes, among the forms that carry its claim best, the one the source deck draws most - an exhibit it declares by an untyped stub the same - so consistency with the user's deck comes before the deck's own hand, the draw's features are not consulted, the seed breaks only what is left, and no line tells a revision what its draw would take. The two standings count the imported pages and judge only the pages the revision added or redrew; `VARIETY_KIND_SHARE` is a standing there and never an advisory.

## Make every exhibit earn its page

A chart earns its page by showing a relationship the reader could not get from the numbers in the title. Two bars of one series are a metric pair with a chart drawn round it: set them as metrics with the delta, or widen the evidence until the chart shows something. `CRAFT_TRIVIAL_CHARTS` stops a deck where more than a quarter of the charts are two-number charts. The forms that carry an implication:

- **A trend with its rate.** Five or more periods, the CAGR on an arrow over the span (`change`, `cagr`), eras bracketed (`periods`), the latest periods in the accent. Most strategic questions have a history - revenue, volume, capacity, share, users - and the series is usually public.
- **The whole set, ranked.** Every peer, sorted, the subject highlighted and the rest neutral, rather than the subject against one rival. The tail or the gap is the finding: bracket it.
- **Share and mix.** A composition over time with the share of the part that matters marked on each column.
- **Gap to a benchmark.** A reference line for the target or the average, or a bracket with the gap value between two bars.
- **A normalised ratio.** Per seat, per head, per site, per unit: size removed so the comparison is fair.
- **A network or flow.** Routes from a hub on a map, widths by volume, planned routes dashed.
- **Rank movement.** Who moved over four dates, as a rank-flow.

Mark the finding on the plot where the eye already is; the annotation carries the page's claim. Keep one accent series and the rest muted.

**Tables judge as well as list.** A table that rates or judges is a `scorecard` page, or a `lookup` whose judgement column carries a cell `type`; either way it shows the judgement in the cells: Harvey balls or ratings in a single accent with a legend, check and cross states, bars growing from a shared baseline with the value at the end, up/flat/down impact arrows, an implication column of a quarter of the width. A plain grid is right for a record lookup and little else. `CRAFT_TABLES_PLAIN` stops a deck where most tables are plain, by the one definition of a treated table in [Charts](charts.md#heatmaps-and-analytical-tables) - under which an implication column or zebra bands alone leave a table plain. A table also earns its page with content: every player on every criterion, with the numbers in the cells - fleet, orders, destinations, revenue, growth, share - rather than three rows of phrases a paragraph would say better.

**Introduce the players.** A deck that compares named companies, brands or products opens that comparison with one `profiles` page that introduces them: each player's logo as the row header, what it is, and the two or three numbers the rest of the deck compares (size, revenue, network, founding year), with ratings or a status column where the deck will judge them. Logos are always logo plus evidence, never a bare wall; keep them in colour, evened by optical weight. Declare the set as `players` on the deck; `CRAFT_PLAYERS_UNINTRODUCED` stops a deck that compares them without the page.

Logos load themselves: plan each as `{ alt: "<Name> logo" }` and the build fetches it from the player's Wikipedia infobox into `assets/logos/` beside the deck file (never into the skill's own folder, which is read-only), reuses it on later builds, and records its source (`node runtime/fetch-logos.mjs <id>.deck.json` does the same ahead of the build; set a player's `wikipedia` title, or `playersHint` on the deck such as "airline", when a name is ambiguous; `--no-fetch` builds offline). A logo that cannot be fetched stays a placeholder and `UNSOURCED_PICTURE` names it.

**Decide the network at the compile.** `author-deck.mjs` - a `--draft` too - prints what the build would fetch and the deck's folder does not hold (`ASSETS_NEEDED`: the players' logos, planned photographs, places), with three choices:

- **Supply the files:** `assets/logos/<name>.png` or `.jpg`, `assets/pictures/<alt>.jpg`, coordinates on the marker. The compile prints each name.
- **Let the build fetch:** the default, which needs the network when the build runs.
- **Declare the deck is built without the network:** `"assets": { "fetch": "none", "reason": "<a sentence saying why>" }` on `deck` (`ASSETS_OFFLINE`).

Under the declaration the build fetches nothing and a `logo` cell that names its `player` prints the name. The missing logos do not block the build: `CRAFT_PLAYERS_UNINTRODUCED` is advised, and still blocks a player named on no page - named as whole words ("Rus" is not named by "Russia") in a page's content, its title, exhibit cells and labels or body, not in a source line, a footer or a note. The build result (`assets`), the reviewer's packet and `delivery.json` say which files were not available and why. Nothing verifies the `reason`: the runtime checks only that it is a sentence and cannot tell whether the machine had a network. It is a declaration the reviewer is shown, not a waiver of their judgement.

The declaration covers photographs as it covers logos. With none supplied in `assets/pictures/`, the deck is expected to carry no picture page: `CRAFT_NO_PICTURES` is advised, not held, and the compile, the build result (`assets.photographs`) and the reviewer's packet say so. A photograph a page still plans as `{ alt }` is an empty frame, and is still refused at delivery (`BAR_UNSOURCED_PICTURES`): supply its file or take it off the page.

**Steps are for procedures.** A staircase or chevron process is a sequence the reader follows step by step. A set of options is a table with ratings; a plan over time is a timeline or gantt; parallel priorities are icon cards; a path with gates is a roadmap; conditions are a checklist. `CRAFT_STEP_OVERUSE` allows two per deck, or one per 25 pages in a longer one.

**Pictures show the subject.** A long deck about recognisable things - products, sites, buildings, cities, people - carries photographs: on the cover, the dividers and the pages about them. Logos identify; they do not count. `CRAFT_NO_PICTURES` stops a 20-page deck with none unless `noPictures` says in a sentence why its subject has nothing to look at. That is all `noPictures` is for: a deck built with no network and no photograph supplied declares `assets: { fetch: "none", reason }` instead.

Photographs load themselves too. Plan each as `{ alt: "what it shows", search: "Boeing 787-9 cabin" }` (the search defaults to the alt): the build takes the first freely licensed Commons photograph - JPEG, at least 1200px, landscape preferred, CC0, CC BY, CC BY-SA or public domain, no maps, diagrams or logos - saves it to `assets/pictures/` beside the deck file with its author and licence in `sources.json`, and lists every attributed picture on a generated **Picture credits** page at the end, which is what CC BY asks of a deck. `node runtime/fetch-pictures.mjs <id>.deck.json --dry-run` names what each placeholder would get before anything is downloaded - the same photograph the fetch takes, by the same choice in the same order - and `author-deck.mjs <id>.pages.json --check --render --fetch-assets` fetches them at the compile, so the render shows them.

A photograph is used once a deck: a file another picture took is passed over for the next best. Among photographs that name as much of the subject, the latest dated wins. Where the subject has changed - an aircraft's livery, a terminal rebuilt - say so on the picture: `after: 2019` takes none dated before that year; and where its words also name another place, `without: ["Ataturk"]` takes none naming those words.

Look at what came back: a search can return the right subject in the wrong livery or year, and a better `search` or the user's own file fixes it. Mark `fetch: false` on a picture that must come from the user. Places named on a map are looked up the same way and cached in `assets/places.json` beside the deck file.

**Icons mark parallel categories.** Three or four parallel items - the pillars of a case, the risks, the levers - read faster with an icon each in one line style and the accent, beside a bold lead and a line or two of text (`pointsStyle: "icon-lead"`), or as a `parallel` page of `cards` with an `icon` each (`author-deck.mjs --icons` lists the names). Never icons alone.

**Maps show places, not countries standing in for them.** Put a city at its longitude and latitude (a country marker labelled with a city is refused), crop to the network (`crop: "fit"`, or a regional preset), keep land a flat grey and fill a country only when the fill means something, with a legend. Dots are small - the default is 10px; a hub is a ring. Routes are curved lines from the hub, their width by volume when the volume is known, planned routes dashed. Label places in small plain type beside the dot; the commentary beside the map says what the network adds up to.

## Allocate evidence before geometry

Name what each mark, row, panel and arrow represents. Count the actual observations, stages, comparison fields and longest labels. Choose the relationship that makes the title inspectable before choosing a component. Use the [illustrated reference atlas](reference-atlas.md) for candidate structures and counterexamples.

- Magnitudes, distributions and change use supported chart encodings; exact lookup across mixed fields can use a table, even with only two columns. If the finding is an allocation, reconcile the full total and make relative sizes visible. Equal prose boxes can classify components but do not show their quantitative contribution.
- Shared entities across several measures can use common rows, scales or linked annotations rather than detached exhibits. For alternative allocations of a conserved total, keep entities in the same positions and show the fixed and movable amounts directly across cases. A tree can explain the governing branches, but equal prose boxes containing numerical tuples still leave the allocation to mental reconstruction. Use a tree for actual decisions or dependencies; use aligned quantitative cases when redistribution is the finding.
- A mechanism needs an actual input/output, dependency, constraint or failure path. Attach conditions to the stream, step or state they govern. A separate train of generic approval verbs adds no proof when the same boundaries are already visible. Combine overview and local bottleneck on a keyed route before explaining that bottleneck again elsewhere.
- Independent alternatives are peers; an ordered route is a sequence; unequal durations require a quantitative time axis. An accumulation keeps earlier stages' contributions and is different from ordinary sequence.
- A joined scenario exposes interacting constraints. Do not distribute its premises across separate generic charts when their interaction is the finding. Competing numerical bounds should share a comparison scale or aligned constraint rows that expose which bound governs; retain exact expressions and attach consequences to their bases. A network diagram earns its geometry through routes and flows, not by putting several inequalities in connected boxes. When the route is already established and the new claim is a numerical shortfall, show available local supply plus constrained transfer against required demand directly. Keep a separate regional balance on its own explicit basis; repeating the topology must not make readers reconstruct the decisive comparison from prose.
- Qualitative evidence can be a visible specimen, annotated example or named choice/consequence comparison. Never invent numerical axes to make preference look measured.

For hard pages, sketch two plausible evidence structures at low fidelity - two page types, or two forms of one; select on reading effort and preserved proof. Change the structure when it improves the relationship, not to rotate templates. Record the reason and rejected alternative in the page's `why`. Two regions must add different necessary evidence; a second component is not a variety token.

When a small changed input governs the result, compare that input with its required level and capacity ceiling. Keep an unchanged large baseline as compact context if it otherwise dominates the page. For example, a warehouse's existing throughput may dwarf the small route increase that resolves its bottleneck; compare required route throughput with old and new route capacity, then reconcile the total locally.

Prefer one primary chart or table with developed implications when it can carry the argument. A separate chart-plus-table pair is an uncommon, deliberate exception: specify what necessary relationship each contributes and why neither one exhibit nor local labels suffice. A chart of a total beside a table decomposing the same authority usually belongs in one table with interpretation. A compact data strip directly aligned to chart categories can instead be part of that chart. For an evidence-to-implication layout, choose the bridge from the repertoire below rather than reaching for the same one each time; when the gutter does carry a mark, one arrow is centred on the evidence body and focus rows never move it. Keep this an appropriate inference treatment, not a new layout quota, and retain varied mechanisms, sequences and comparisons elsewhere.

### How the page carries "therefore"

Every page that sets evidence against what is read off it has to join the two. Well-made decks do this five or six different ways and draw it in the gutter on very few pages; a deck that uses one device everywhere has chosen once, and by the fourth page the reader has stopped seeing it. Choose per page from what the relation actually is - the page's `commentary` placement first, then these keys on the page - and record the choice in the page's `why`.

| Bridge | Spec | Use it when |
| --- | --- | --- |
| Words alone | `pointsHeading` naming the relation; nothing in the gutter | The commentary's heading can state the consequence - "As a result of piracy and internationalization", "What this costs to hold" |
| Named panels | `pointsHeading` plus `pointsTone` (`muted`, `tint`, `dark`) | Evidence and interpretation are two standing categories the reader will meet again - "Key facts and data" against a bordered "Perspectives" |
| Nothing | no heading, no mark, plain gutter | The points are read straight off the marks beside them and need no announcing |
| Closing band | commentary `so-what-bar`, its sentence in `bar` | One sentence closes the page under everything on it, at the exhibit's own width |
| Keyed callouts | numbered marks on the exhibit with `pointsStyle: "numbered"` | The commentary speaks to named points in the evidence rather than to the whole of it |
| Quiet rule | `implication: "rule"` | The two columns need separating but no inference is being asserted |
| Disc chevron | `implication: "chevron"` | A short centred column concludes from the exhibit and the disc has content to sit against |
| Dashed gutter | `implication: "divider-chevron"` (or the legacy `true`) | A full-height column carries a genuinely authored inference and the page should say so |
| Block arrow | `implication: "arrow"` | The page's own conclusion, said loudly - a shape read from across a room rather than punctuation in the gutter |

The last three assert an inference. Spend them where the inference is the page's work, not on every chart that happens to have commentary beside it: in a deck of fifty pages that is a handful, not every page with commentary `beside`. `implication: false` is the default and is the right answer on most pages, because the heading, the panel or the words have already done the joining.

### Reach past the first device that works

The runtime carries ten families of mark. A deck that draws two of them has not chosen between them, and no per-page gate sees it: every page is individually fine and the deck reads as one page reprinted. `DECK_VOCABULARY` measures this on the composed scene, because a plan can record a treatment the page never draws.

| Family | Draws | Reach for it when |
| --- | --- | --- |
| Icon | One mark per named category | A page enumerates named things: media, options, workstreams, categories |
| Picture | A sourced photograph | The subject is something a reader would want to see; colour and variety are not decoration |
| Score | Harvey balls on a declared scale | A cell is a rating, a percentage of a maximum, or a judged level |
| Value pill | The figure in a filled pill | A column of counts, money or volumes where magnitude should read before the digits |
| In-cell bar | A bar behind the figure | A column of magnitudes on a shared scale, read down |
| Heat | A sequential fill per cell | A matrix whose pattern is the finding |
| State | A coloured status or verdict pill | A cell adjudicates: on track, at risk, wins, ties, loses |
| Growth | A CAGR or change badge on a chart | The rate between two periods is the claim, not the levels |
| Reference | A line at a threshold, target or floor | The claim is a distance from a named value |
| Annotation | A callout bound to an exact mark | The finding lives at one point, not across the series |

Do not add a rating to a page to satisfy a count. Look instead for the pages whose evidence already is a score, a count, a named set or a subject worth showing, and which are currently setting all four as plain text.

**A number column is not automatically a pill.** Counts, money and volumes read better in one; years, identifiers, ranks and scores out of a maximum do not, because the pill asserts a magnitude the number does not carry.

## Choose visual treatments during planning

Make each choice with the page's own keys and say why in its `why`: `highlight` for the phrase, `annotations` and `highlights` on a chart, a cell `type` on a table column, an `icon` on a point or card, `pictures` or `{ alt }` for images. `author-deck.mjs` derives the plan record's `treatment`, `anchors`, `annotation` and `insight` from them ([The plan file](storyline-records.md#the-plan-file)); do not write those. In a page of several exhibits, name each child's treatment. The table below is the semantic owner for these decisions; [Charts](charts.md) and [Components](components.md) own the executable props.

| Decision | Use it when | Keep it plain when |
| --- | --- | --- |
| Category axis | A column names distinct classes whose attributes follow: Assignment, Availability, Evidence, Interaction, Outcome; or award classes. Fill category cells with white labels, not whole rows. | Individual records, dates or repeated membership such as A/A/B. Editorial conclusions are not peer categories. |
| Icons | Parallel concepts have distinct recognizable meanings, such as population, comparison, analysis and data quality. Select supported names, retain labels and one coherent style. | They decorate IDs, repeat a number, imply an order or suggest evidence that is absent. |
| Focus | The claim names an exact observation or coherent set whose emphasis reduces reading effort. Select exact keys with `focus`; the set can have several members. A title that names exactly one mark highlights it without `focus` ([Charts](charts.md#construction)). | No item has a special role. Neutral is valid; maxima, midpoint, neighboring pages and arrow location never infer focus. |
| Count pills | A selected count field benefits from distinct scanning and a common pill size. | The value is a date, score, arbitrary label or unsupported metric. |
| Status | A cell states a state or a verdict ([Status colour](#status-colour)). | Identity, preference and ordinary category membership are not status. |
| Closing insight | A supported consequence is otherwise buried and deserves a closing band. Write it before reserving space. | It paraphrases the title, rereads the rows or fills whitespace. |
| Image | The subject has a visual identity a reader recognises: a film, a product, a brand, a place, a person, a physical site or specimen. Plan a picture for each such subject while drafting, and say where each comes from. A picture the author must supply - a poster, a product shot, a logo - is planned as `{ alt }` and asked for; the author supplies the file and the use they are entitled to make of it, which becomes its `credit`. | The subject is a number, a process or an abstraction with nothing to look at. Imagery cannot establish performance, safety or causality, and a stock photograph of a generic scene is decoration. |

Resolve focus from the claim before selecting a palette. Record the exact subject keys and affected measures in the page's `why`, then carry that focus coherently through corresponding marks or labels in a composite. For example, a district driving demand growth should be easy to find in both the level comparison and its aligned change strip. A title naming two failure cases needs readable names on those selected marks; single-letter project codes that require a separate lookup weaken the join even when the table decodes them correctly. Use the smallest sufficient cue: an accent mark, bold direct label or local annotation. Do not color an unrelated measure, override established series identity, or highlight the largest item merely because it is largest. A balanced comparison of peers can remain neutral.

Review omission as well as misuse. Temporarily ignore category fills, zebra bands and totals: can the reader immediately locate the observation named in the title? A meaningful icon or focus recorded in metadata but suppressed in the image is still missing. Verify both classification (was the choice useful?) and handoff (did it render?). When repairing one instance, repeat this claim-to-mark check across all exhibits, including auxiliary plots in composites. Do not increase treatment counts to meet a percentage.

### Status colour

This is the one statement of the rule; other references link here. Status red, amber and green say that something is on track or behind, won or lost, met or missed. They mark a state or a verdict, and nothing else.

| A cell or mark that states | The runtime draws it as |
| --- | --- |
| a delivery status or an adjudication: on track, behind, at risk, wins, ties, loses | a state pill: scorecard form `rag`, or a column of cells of `type: "rag"`; the composer pills those words on its own |
| a traffic-light judgement | scorecard form `lights` |
| a verdict in words: Cleared, Missed | a text cell with `tone: "positive"` or `"negative"`, the word kept so colour is supplementary |
| met or missed, yes or no against a criterion | a check or a cross (scorecard form `check` or `binary`; a `checklist` point's `state`) |
| an outlook | a trend arrow in a table cell, grey when flat, green when it moves the good way and red when it moves the bad way |
| a change | a metric tile's signed `delta`, green or red by the same test |
| a diverging level | a `red-white-green` heat or map scale, only with a named neutral midpoint |

Never colour by status a chart series, bar, line, area, stacked segment, legend swatch or annotation background (chart marks take the series palette even when a series is named for success or failure), an identity - a player, a brand, a product - or a page or panel surface. A pill whose words carry no verdict ("Split", "Unranked", "Measured only") is `value: "neutral"`, grey (`PILL_NO_VERDICT`); who leads is not a state, so declare the `players` and let their logos say it.

The good way is the measure's `better` - `"up"` by default, `"down"` for a cost, churn, a wait or emissions - set on the metric, the table column, the row or the one trend cell ([Writing a page](page-types.md#writing-a-page)). A rising cost with `better: "down"` shows red; a delta's sign alone never decides its colour.

## Put the comparison where it is used

The comparator that makes a title true belongs in the exhibit: a labelled target, shared basis, named contributors, delta, interval or local annotation. Do not make the reader remember a threshold from another slide or count marks to find the named observation. Show series names through a legend or direct labels. Label the decision horizon where alternatives diverge; automatic endpoint labels must not give a later common outcome more weight than the consequential earlier gap. Align supporting values to their corresponding categories; attach event-specific interpretation to its event.

Use local annotations for point-specific observations, and a separate commentary region only for developed mechanism, qualification or consequence. Preserve scope where it changes interpretation. Visible records establish the displayed result; speaker notes cannot carry a missing premise in a pre-read.

## One heading owner per exhibit

The action title states the finding. Each distinct chart owns one descriptive measure heading, inline unit and rule by default. A section wrapping one chart stays untitled. A parent heading is warranted only when it groups genuinely different child exhibits. Tables and non-chart exhibits normally need no extra heading when their title and labels identify them. An established consistent unruled reference style can be retained as a deck-wide exception.

Remove subtitles that duplicate chart headings by meaning, not merely shared words. Keep each unique measure, unit, period and population once in the appropriate label or source note. Do not use separate filled/newline unit tiles. Evidence qualifications such as Judgement or Estimate use the common subtitle band via `evidenceStatus`, not ad hoc text above the title. Mixed states are qualified locally.

## Table grammar

Use [Charts: category and verdict semantics](charts.md#category-and-verdict-semantics) for exact props. A plain verdict joins the table with continuous row fills; a gutter belongs only to an authored inference-arrow variant. A table-wide arrow centers in the evidence body independently of highlighted rows. Per-row arrows are a distinct choice. Chevron headers have no redundant underline. Unordered classes get no sequence numbering. Heat scales and Harvey balls need a defined rubric; conclusion/total rows keep their own role.

Paired tables can share column widths and row anchors while retaining different semantic treatment. Parent alignment must not erase a child's category or verdict choice. When splitting a comparison, repeat the needed schema, units and common physical scale; do not split simply to change the silhouette.

For a justified chart/table pair, declare the shared heading-rule or evidence-start anchor and allow for the chart's heading and legend before placing the table. Do not independently centre a headed table in the chart's full frame: its header then floats below the neighbouring heading and its rows start arbitrarily. Align shared categories row by row when that is the actual relationship. Examples: a chart and its implication column share one heading rule, with a numeric strip attached to the chart's categories; peer exhibits align their heading rules; one table joins amounts, drivers and methodology. These are alignment and reading-order examples, not permission to add headings to every table.

## Space, type and boundaries

The shell owns title, source, footer, page number and navigation once. Base canvas: 1280×720; margins 60px; 12-column guide with 82px tracks and 16px gutters. At the adapter boundary 96px=1in and 1px=0.75pt. Registered theme/density roles govern type: action title normally 24pt, section 14–16pt, body 12–14pt, chart furniture 9–10pt, sources 8pt. Do not locally shrink unrelated text to rescue a layout.

The consulting cover sets its title a step over the deck title (`type.coverTitle`, 40pt) and, when the deck declares `players` whose logos are on disk (the player's `logo`, or `assets/logos/` beside the deck file, where the build fetches them), shows their marks on white tiles above the title. A section is numbered once: the divider's numeral (set, like every figure, in the body face) and the tracker's marker; "01 / " written at the head of a section title is stripped at compile, and the contents rail lists the names alone. The closing takeaways set each message's lead clause - the words before its colon, or a short first sentence - in bold and the rest regular, with a hairline between messages spread down the page.

Region width expresses weight: equal tracks imply peers; a narrow rail supports a dominant exhibit. Size actual content before assigning space. A few short labels should not acquire the largest dark region. Give the limiting mechanism the dominant region: nearly equal aggregate bars or a three-number identity may be compact context when a local constraint or funding condition actually proves the title. Sparse unheaded content centers as one measured group with natural internal gaps. Headed peers align to common reading baselines. Inspect the relationship between groups, not only each component's fit. [Composition](composition.md#shared-geometry-and-visual-intent) owns how that intent reaches the runtime.

Use whitespace, then a rule, then a surface when a stronger boundary is needed. Every line has one job: separator, boundary, leader or state. Keep padding, rule spacing and repeated row rhythm consistent. Chart-heading rules sit below measured heading text; peer rules align. Prefer open analytical regions. Box the smallest true group rather than building a dashboard of unrelated cards.

Resolve palette and typography through the theme. Color roles distinguish structural emphasis, chart series and short status labels. Body/compact text contrast is at least 4.5:1; large type and meaningful graphics 3:1. Embedded marks keep series identity on total/category surfaces using readable foreground or boundary. Use concise titles and numeric notation; [Copy](copy.md) owns sentence hierarchy, bold leads and redundancy.

## Page architecture and repetition

Record the dominant encoding, shared entity/axis, nesting and attachment of support in each page's `why`. Review this beside the title sequence. Test repeated informational jobs as well as shapes: several different charts can repeat one calculation; a composite can still be two redundant panels.

Normalize chart/table with detached commentary beside or below it, two/three commentary columns, cards/prose and optional insight as **evidence with commentary**. A neighboring table whose main job is to explain plotted cases remains commentary: borders, repeated values and a case key do not make it independent evidence. A true pair adds a necessary comparison on its own measured basis, such as stock depletion alongside rate and duration limits. Moving the same explanation between lateral and lower regions does not add variety. Category fills, icons, color, markers and titles never create a new relationship.

The compiled plan names each page's architecture from its type and form, in this vocabulary: `evidence-with-commentary`, `evidence-only` (including shared rows), `paired-evidence`, `evidence-stack`, `evidence-grid`, `reconciliation`, `metrics-over-evidence`, `hero-number-with-evidence`, `metrics-with-text`, `picture-led`, `card-grid`, `text`, or the actual mechanism (`gantt`, `relationship-network`, `flow`, `tree`, `matrix`, `timeline`, `steps`, `cycle`, `journey`, `process`, `chevron-process`, `roadmap`, `organization`, `quadrants`, `horizons`).

`author-deck.mjs` writes the architecture; put specific task names in the page's `why`. The variety contract counts each page as drawn, so a new name cannot count as new variety. Geometry checks cannot decide whether table prose adds independent evidence: reconcile the semantic plan count with the rendered count during review, using the more conservative classification where they differ.

Inspect repeated diagram geometry too. A central oval with surrounding boxes remains the same visual arrangement when its labels change from topology to allocation to inequalities. Keep it where the actual topology earns it; use quantitative allocation or a direct constraint comparison when those are the reading tasks. Replacing repeated tables with repeated prose diagrams does not establish richer visual explanation.

The existing blocking repetition screens remain: no architecture over 40% of analytical pages; ten-page windows contain at least three meaningful relationships. These are alarms, not a template-rotation recipe. A repeated comparison series needs an actual comparability reason; naming `series` alone is not editorial acceptance. Preserve common scales and geometry when repetition helps comparison. A 50-page minimum does not exempt a repetitive or deletable sequence.

Alternatives must differ with colors and fonts ignored. Use different questions, orders or evidence relationships; retain comparable tasks where appropriate. After composition inspect the actual montage and the rendered pages at full size because plan labels cannot certify the pixels.

## Working from a reference deck

For faithful reference transformation, inspect the whole supplied reference and map consolidations/splits. For benchmarking against decks the user supplied, select strong comparable pages from each and state literal page coverage. Only the user's own references count; never search for others. Extract analytical device, evidence payload, hierarchy, emphasis and readable type size before adopting a structure. Compare at equal viewing size. The [atlas](reference-atlas.md) describes devices; it is not a list of documents to find. Do not copy reference quirks that contradict user preferences.

## Visual review

Use [Taste review](taste-review.md) for the independent reader pass. At design handoff inspect: claim-to-exhibit relation; useful or misplaced focus; field semantics; heading ownership; unique commentary; group balance; actual process dependencies; consistency across repeated families. Check both missing cues and inappropriate cues. Keep fit, clipping, collision and truthful scale failures blocking; use whitespace, ink and treatment counts as prompts, never decoration quotas. Repeated defects return to their shared owner.

## Review the whole evidence region

Before rendering, check how the compiled plan classifies the whole page (`architecture`). Multiple charts, a chart/table pair and a standalone diagram followed by detached explanatory prose all remain evidence-with-commentary. Count that arrangement before naming the individual devices. A local label, condition or annotation inside the evidence region is different from a separate commentary panel.

Preserve necessary explanation while joining it to the exact asset, year, event, flow or case it explains. For example, align energy inputs and results by asset, spending and service by year, and staffing with installation on the same quarter axis. Show duration-dependent quantities over their actual time intervals; join a changed input, its resulting demand and the binding reserve on one keyed sensitivity comparison. Attaching prose means tying it visibly to that exact mark, interval or row, not placing an unchanged prose panel inside a larger frame. Do not repair a repeated reading task by moving the same paragraph from bottom to side.
