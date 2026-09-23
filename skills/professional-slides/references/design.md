# Design

Design owns the evidence relationship, attention, treatment and visual hierarchy. [Storylining](storylining.md) owns whether the claim is supported and deserves a page; [Composition](composition.md) owns its geometry.

## Pick the slide type from what the page says

Decide what the page has to make the reader see, then take the slide type that shows exactly that. A deck built this way is varied because its messages are, not because it rotates templates; one that reaches for a column chart and a table on every page has skipped this step. The catalogue below is the whole range: 86 styles, all of which compose, enough to cover any content page a deck needs.

| The page has to show | Take | Not |
| --- | --- | --- |
| A level compared across a few categories | `chart.column`, or `chart.bar` when labels are long or it is a ranking | A table of the same numbers |
| A ranking where the order is the finding | `chart.lollipop`, `chart.bar` sorted | A pie |
| Change over time | `chart.line`; `chart.column` for a handful of periods | Unconnected bars for a trend |
| Parts of a whole, one period | `chart.donut` for two to four parts, `chart.waffle` for a share read as counts, `chart.treemap` for many | A pie with eight slices |
| Composition changing over time | `chart.stacked-column`, `chart.stacked-area` | Side-by-side pies |
| Size and share together, two dimensions | `chart.marimekko` | Two separate charts |
| Two measures on one category set | `chart.combo` | Twin axes without a reason |
| A bridge from one total to another | `chart.waterfall` | A stacked bar |
| Before against after, per category | `chart.dumbbell`, `chart.slope` | Grouped bars with ten pairs |
| A relationship between two measures | `chart.scatter`; `chart.bubble` when a third measure matters | A table of pairs |
| Spread within groups | `chart.boxplot`, `chart.range` | An average alone |
| A population share read as "six in ten" | `pictogram` | A single bar at 60% |
| Two to six shares of different wholes as one figure, such as agreement with each survey statement | `radial-bars` | A pie of shares that do not add up |
| Rank movement across periods | `rank-flow` | A table of ranks |
| Quantities moving from one set to another | `sankey` | Two tables |
| Where on a map | `map` (highlight, markers, choropleth) | A list of countries |
| One number that is the whole point | `hero-number` layout with the evidence that produced it | A bullet |
| Three to six headline numbers | `metrics` strip; `stat-list` when each needs its sentence, dark for a side panel | Numbers buried in prose |
| Exact values looked up across fields | `table`, with the treatment the cells call for: `bar`, `heat`, `bubble`, harvey, state | A chart that hides the digits |
| Options judged on criteria | `table` with harvey or check cells and a verdict column | Prose pros and cons |
| A sequence of steps | `process`, `chevron-process`; `steps` when each builds on the last | A numbered list |
| Steps with branches or merges | `flow` | Chevrons that pretend it is linear |
| Something that repeats | `cycle` | A process with an arrow drawn back |
| Dated milestones | `timeline`; `gantt` for durations and parallel work; `roadmap` for waves | A table of dates |
| Stages across lanes or owners | `roadmap` phase-workstreams, a swimlane `table` | Separate lists per owner |
| A decision with branches | `tree` | Nested bullets |
| A hierarchy or dependency stack | `framework` pyramid, `layers` | A list with indents |
| An ambition resting on levers | `framework` house | Three unrelated boxes |
| Items sorted into categories | `placement` | A table with one column of ticks |
| Two things judged on two axes | `matrix` with plotted items; `quadrants` when each box holds a list | A ranked list |
| Position between two poles | `spectrum` | A 1-to-5 score nobody measured |
| A judged grade on a named scale (impact very low to very high, years to mainstream) | `spectrum` with `segments` and `scale` | A slider claiming a precision the judgement lacks |
| A hub and what depends on it | `relationship-network` hub-ring | A list of dependencies |
| Two to five priorities as equals | `capsules`, `cards` | A paragraph |
| Scenarios that each lead somewhere | `arrow-rows` | A table of scenarios |
| From one state to another | `compare`, `two-up-contrast` | Before and after in prose |
| Named categories, each with a meaning | `cards` with an icon each; `icon-trends` columns | Plain bullets |
| What people said | `quote-cluster` | Quotes inside bullets |
| The people involved | `people`, with portraits when supplied | Names in a table |
| Who is in a set | `logos`, `logo-collage` | A list of names |
| A thing worth seeing: a product, a place, a film, a person | a picture layout (`picture-hero`, `picture-strip`, `photo` beside text, or a table `photo` column, where a portrait picture such as a poster keeps its shape and the row's text centres on it) | A description of it |
| Report-style argument with no single exhibit | a text page of `paragraphs`, which sets in columns past about 110 words | A single wide block |
| One sentence the deck turns on | `statement`, over a photograph when there is one | A title on an empty page |

When two rows fit, the message decides: "China rose from sixth to first" is movement, so `rank-flow`; "China is first" is a level, so a sorted bar. Record the choice and the rejected alternative in the plan `why`. A deck that finds itself using one chart type for most of its charts should go back through this table page by page; `PLAN_CHART_MONOTONY` reports it.

## Allocate evidence before geometry

Name what each mark, row, panel and arrow represents. Count the actual observations, stages, comparison fields and longest labels. Choose the relationship that makes the title inspectable before choosing a component. Use the [illustrated reference atlas](reference-atlas.md) for candidate structures and counterexamples.

- Magnitudes, distributions and change use supported chart encodings; exact lookup across mixed fields can use a table, even with only two columns. If the finding is an allocation, reconcile the full total and make relative sizes visible. Equal prose boxes can classify components but do not show their quantitative contribution.
- Shared entities across several measures can use common rows, scales or linked annotations rather than detached exhibits. For alternative allocations of a conserved total, keep entities in the same positions and show the fixed and movable amounts directly across cases. A tree can explain the governing branches, but equal prose boxes containing numerical tuples still leave the allocation to mental reconstruction. Use a tree for actual decisions or dependencies; use aligned quantitative cases when redistribution is the finding.
- A mechanism needs an actual input/output, dependency, constraint or failure path. Attach conditions to the stream, step or state they govern. A separate train of generic approval verbs adds no proof when the same boundaries are already visible. Combine overview and local bottleneck on a keyed route before explaining that bottleneck again elsewhere.
- Independent alternatives are peers; an ordered route is a sequence; unequal durations require a quantitative time axis. An accumulation keeps earlier stages' contributions and is different from ordinary sequence.
- A joined scenario exposes interacting constraints. Do not distribute its premises across separate generic charts when their interaction is the finding. Competing numerical bounds should share a comparison scale or aligned constraint rows that expose which bound governs; retain exact expressions and attach consequences to their bases. A network diagram earns its geometry through routes and flows, not by putting several inequalities in connected boxes. When the route is already established and the new claim is a numerical shortfall, show available local supply plus constrained transfer against required demand directly. Keep a separate regional balance on its own explicit basis; repeating the topology must not make readers reconstruct the decisive comparison from prose.
- Qualitative evidence can be a visible specimen, annotated example or named choice/consequence comparison. Never invent numerical axes to make preference look measured.

For hard pages, sketch two plausible evidence structures at low fidelity; select on reading effort and preserved proof. Change the structure when it improves the relationship, not to rotate templates. Record the reason and rejected alternative in existing plan `why`. Two regions must add different necessary evidence; a second component is not a variety token.

When a small changed input governs the result, compare that input with its required level and capacity ceiling. Keep an unchanged large baseline as compact context if it otherwise dominates the page. For example, a warehouse's existing throughput may dwarf the small route increase that resolves its bottleneck; compare required route throughput with old and new route capacity, then reconcile the total locally.

Prefer one primary chart or table with developed implications when it can carry the argument. A separate chart-plus-table pair is an uncommon, deliberate exception: specify what necessary relationship each contributes and why neither one exhibit nor local labels suffice. A chart of a total beside a table decomposing the same authority usually belongs in one table with interpretation. A compact data strip directly aligned to chart categories can instead be part of that chart. For an evidence-to-implication layout, choose the bridge from the repertoire below rather than reaching for the same one each time; when the gutter does carry a mark, one arrow is centred on the evidence body and focus rows never move it. Keep this an appropriate inference treatment, not a new layout quota, and retain varied mechanisms, sequences and comparisons elsewhere.

### How the page carries "therefore"

Every page that sets evidence against what is read off it has to join the two. Well-made decks do this five or six different ways and draw it in the gutter on very few pages; a deck that uses one device everywhere has chosen once, and by the fourth page the reader has stopped seeing it. Choose per page from what the relation actually is, and record the choice in the plan `why`.

| Bridge | Spec | Use it when |
| --- | --- | --- |
| Words alone | `pointsHeading` naming the relation; nothing in the gutter | The commentary's heading can state the consequence - "As a result of piracy and internationalization", "What this costs to hold" |
| Named panels | `pointsHeading` plus `pointsTone` (`muted`, `tint`, `dark`) | Evidence and interpretation are two standing categories the reader will meet again - "Key facts and data" against a bordered "Perspectives" |
| Nothing | no heading, no mark, plain gutter | The points are read straight off the marks beside them and need no announcing |
| Closing band | `soWhat` | One sentence closes the page under everything on it, at the exhibit's own width |
| Keyed callouts | numbered marks on the exhibit with `pointsStyle: "numbered"` | The commentary speaks to named points in the evidence rather than to the whole of it |
| Quiet rule | `implication: "rule"` | The two columns need separating but no inference is being asserted |
| Disc chevron | `implication: "chevron"` | A short centred column concludes from the exhibit and the disc has content to sit against |
| Dashed gutter | `implication: "divider-chevron"` (or the legacy `true`) | A full-height column carries a genuinely authored inference and the page should say so |
| Block arrow | `implication: "arrow"` | The page's own conclusion, said loudly - a shape read from across a room rather than punctuation in the gutter |

The last three assert an inference. Spend them where the inference is the page's work, not on every chart that happens to have commentary beside it: in a deck of fifty pages that is a handful, not every `exhibit-left`. `implication: false` is the default and is the right answer on most pages, because the heading, the panel or the words have already done the joining.

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

Use the existing `why`, `treatment`, `anchors`, `highlight`, `annotation` and `insight` fields. A composite identifies the intended treatment of each child. The table below is the semantic owner for these decisions; chart/component references own executable props.

| Decision | Use it when | Keep it plain when |
| --- | --- | --- |
| Category axis | A column names distinct classes whose attributes follow: Assignment, Availability, Evidence, Interaction, Outcome; or award classes. Fill category cells with white labels, not whole rows. | Individual records, dates or repeated membership such as DC/DC/Marvel. Editorial conclusions are not peer categories. |
| Icons | Parallel concepts have distinct recognizable meanings, such as population, comparison, analysis and data quality. Select supported names, retain labels and one coherent style. | They decorate IDs, repeat a number, imply an order or suggest evidence that is absent. |
| Focus | The claim names an exact observation or coherent set whose emphasis reduces reading effort. Select exact keys; the set can have several members. | No item has a special role. Neutral is valid; maxima, midpoint, neighboring pages and arrow location never infer focus. |
| Count pills | A selected count field benefits from distinct scanning and a common pill size. | The value is a date, score, arbitrary label or unsupported metric. |
| Status | A short verdict explicitly means good/bad: color Cleared/Met or Missed, or use a labelled check/cross. | Identity, preference and ordinary category membership are not status. Positive/negative colors never map chart marks, swatches or backgrounds. |
| Closing insight | A supported consequence is otherwise buried and deserves a closing band. Write it before reserving space. | It paraphrases the title, rereads the rows or fills whitespace. |
| Image | The subject has a visual identity a reader recognises: a film, a product, a brand, a place, a person, a physical site or specimen. Plan a picture for each such subject while drafting, and say where each comes from. A picture the author must supply - a poster, a product shot, a logo - is planned as `{ alt }` and asked for; the author supplies the file and the use they are entitled to make of it, which becomes its `credit`. | The subject is a number, a process or an abstraction with nothing to look at. Imagery cannot establish performance, safety or causality, and a stock photograph of a generic scene is decoration. |

Resolve focus from the claim before selecting a palette. Record the exact subject keys and affected measures in `why`, then carry that focus coherently through corresponding marks or labels in a composite. For example, a district driving demand growth should be easy to find in both the level comparison and its aligned change strip. A title naming two failure cases needs readable names on those selected marks; single-letter project codes that require a separate lookup weaken the join even when the table decodes them correctly. Use the smallest sufficient cue: an accent mark, bold direct label or local annotation. Do not color an unrelated measure, override established series identity, or highlight the largest item merely because it is largest. A balanced comparison of peers can remain neutral.

Review omission as well as misuse. Temporarily ignore category fills, zebra bands and totals: can the reader immediately locate the observation named in the title? A meaningful icon or focus recorded in metadata but suppressed in the image is still missing. Verify both classification (was the choice useful?) and handoff (did it render?). When repairing one instance, repeat this claim-to-mark check across all exhibits, including auxiliary plots in composites. Do not increase treatment counts to meet a percentage.

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

Region width expresses weight: equal tracks imply peers; a narrow rail supports a dominant exhibit. Size actual content before assigning space. A few short labels should not acquire the largest dark region. Give the limiting mechanism the dominant region: nearly equal aggregate bars or a three-number identity may be compact context when a local constraint or funding condition actually proves the title. Sparse unheaded content centers as one measured group with natural internal gaps. Headed peers align to common reading baselines. Inspect the relationship between groups, not only each component's fit. [Composition](composition.md#shared-geometry-and-visual-intent) owns how that intent reaches the runtime.

Use whitespace, then a rule, then a surface when a stronger boundary is needed. Every line has one job: separator, boundary, leader or state. Keep padding, rule spacing and repeated row rhythm consistent. Chart-heading rules sit below measured heading text; peer rules align. Prefer open analytical regions. Box the smallest true group rather than building a dashboard of unrelated cards.

Resolve palette and typography through the theme. Color roles distinguish structural emphasis, chart series and short status labels. Body/compact text contrast is at least 4.5:1; large type and meaningful graphics 3:1. Embedded marks keep series identity on total/category surfaces using readable foreground or boundary. Use concise titles and numeric notation; [Copy](copy.md) owns sentence hierarchy, bold leads and redundancy.

## Page architecture and repetition

Record the dominant encoding, shared entity/axis, nesting and attachment of support in each plan's `why`. Review this beside the title sequence. Test repeated informational jobs as well as shapes: several different charts can repeat one calculation; a composite can still be two redundant panels.

Normalize chart/table with detached commentary beside or below it, two/three commentary columns, cards/prose and optional insight as **evidence with commentary**. A neighboring table whose main job is to explain plotted cases remains commentary: borders, repeated values and a case key do not make it independent evidence. A true pair adds a necessary comparison on its own measured basis, such as stock depletion alongside rate and duration limits. Moving the same explanation between lateral and lower regions does not add variety. Category fills, icons, color, markers and titles never create a new relationship.

Use the shared plan vocabulary: `evidence-with-commentary`, `evidence-only` (including shared rows), `paired-evidence`, `evidence-stack`, `evidence-grid`, `reconciliation`, `metrics-over-evidence`, `hero-number-with-evidence`, `metrics-with-text`, `picture-led`, `card-grid`, `text`, or the actual mechanism (`gantt`, `relationship-network`, `flow`, `tree`, `matrix`, `timeline`, `steps`, `cycle`, `journey`, `process`, `chevron-process`, `roadmap`, `organization`, `quadrants`, `horizons`). Composition preset aliases normalize to these families; put specific task names in `why`. Unknown names fail the plan gate rather than count as new variety. Geometry checks cannot decide whether table prose adds independent evidence: reconcile the semantic plan count with the rendered count during review, using the more conservative classification where they differ.

Inspect repeated diagram geometry too. A central oval with surrounding boxes remains the same visual arrangement when its labels change from topology to allocation to inequalities. Keep it where the actual topology earns it; use quantitative allocation or a direct constraint comparison when those are the reading tasks. Replacing repeated tables with repeated prose diagrams does not establish richer visual explanation.

The existing blocking repetition screens remain: no architecture over 40% of analytical pages; ten-page windows contain at least three meaningful relationships. These are alarms, not a template-rotation recipe. A repeated comparison series needs an actual comparability reason; naming `series` alone is not editorial acceptance. Preserve common scales and geometry when repetition helps comparison. A 50-page minimum does not exempt a repetitive or deletable sequence.

Alternatives must differ with colors and fonts ignored. Use different questions, orders or evidence relationships; retain comparable tasks where appropriate. After composition inspect the actual montage and the rendered pages at full size because plan labels cannot certify the pixels.

## Working from a reference deck

For faithful reference transformation, inspect the whole supplied reference and map consolidations/splits. For benchmarking against decks the user supplied, select strong comparable pages from each and state literal page coverage. Only the user's own references count; never search for others. Extract analytical device, evidence payload, hierarchy, emphasis and readable type size before adopting a structure. Compare at equal viewing size. The [atlas](reference-atlas.md) describes devices; it is not a list of documents to find. Do not copy reference quirks that contradict user preferences.

## Visual review

Use [Taste review](taste-review.md) for the independent reader pass. At design handoff inspect: claim-to-exhibit relation; useful or misplaced focus; field semantics; heading ownership; unique commentary; group balance; actual process dependencies; consistency across repeated families. Check both missing cues and inappropriate cues. Keep fit, clipping, collision and truthful scale failures blocking; use whitespace, ink and treatment counts as prompts, never decoration quotas. Repeated defects return to their shared owner.

## Review the whole evidence region

Before rendering, classify the whole page in the existing plan's `architecture` field. Multiple charts, a chart/table pair and a standalone diagram followed by detached explanatory prose all remain evidence-with-commentary. Count that arrangement before naming the individual devices. A local label, condition or annotation inside the evidence region is different from a separate commentary panel. Preserve necessary explanation while joining it to the exact asset, year, event, flow or case it explains. For example, align energy inputs and results by asset, spending and service by year, and staffing with installation on the same quarter axis. Show duration-dependent quantities over their actual time intervals; join a changed input, its resulting demand and the binding reserve on one keyed sensitivity comparison. Attaching prose means tying it visibly to that exact mark, interval or row, not placing an unchanged prose panel inside a larger frame. Do not repair a repeated reading task by moving the same paragraph from bottom to side.
