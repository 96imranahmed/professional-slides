# Storylining

Storylining owns the decision, the answer, the proof and the page sequence. Design begins only when those are coherent. The one-page core below is the method; the sections after it are how each part is done. The records the runtime derives (the content plan, the plan file, the text contract) are documented in [Storyline records](storyline-records.md).

## The one-page core

| Part | What it is | Where it lives |
| --- | --- | --- |
| Request | The user's words, verbatim, and every sub-question in them | `request` on `deck`; reviewers judge against it |
| Governing thought | One sentence that answers the request, sharp enough to be wrong | `answer` on `deck`, with the reasons, rivals and thresholds it turns on; the executive summary's title leads with its verdict and the summary's points carry the rest (`CONTENT_ANSWER_UNCARRIED`) |
| Pillars | Three to five reasons that together prove the governing thought: mutually exclusive, collectively exhaustive (MECE) | One section per pillar; the section title states the pillar's claim |
| Titles | Each page title is a child of its section's claim: it proves part of it | `title` on each page, within the title limit (`TITLE_WORDS`, see [Action titles](copy.md#action-titles)) |
| Situation, complication, question | The executive summary opens on what the reader knows, what changed, and the question that raises, then answers it | The summary's first two statements ([Copy](copy.md#executive-summary)) |
| Signposting | The tracker names the pillars in order, so the reader always knows which claim a page is proving | `tracker` labels are the section titles |

**Vertical logic.** Read down: governing thought → pillar → page title. Each level answers "why?" or "how do we know?" of the level above. A page whose title does not prove its section's claim is in the wrong section, or the pillar is missing a claim.

**Horizontal logic.** Read across a level: the pillars do not overlap (MECE) and together leave nothing needed to accept the answer. For a comparison, one pillar per criterion that decides it, the same criteria for every player; for a recommendation, one per condition the choice depends on.

**Length follows the evidence.** The body carries about one page per strong insight in each pillar; pillars × strong insights sets the body, and everything else - supporting detail, method, reference schedules - goes to the appendix. A requested length is met with appendix pages and a wider evidence base, never with generic pages padding the body: an evaluation's 50 pages count the appendix.

| Audience and occasion | Body | Appendix |
| --- | --- | --- |
| Board or steering committee, presented | 8-15 pages | as needed for questions |
| Decision pre-read, read alone | 15-30 pages | reference schedules, method, sources |
| Diligence or evaluation pack | 25-40 pages | 10-25 pages; counts toward a requested total |
| Live pitch | 10-15 pages, one idea each | none, or a short backup |

### Answer under uncertainty

A deck that will not answer is not finished. Every sub-question in the request gets a directional answer:

- **The lean** - which way the evidence points, in the title, with its magnitude.
- **The confidence** - high, medium or low, and why, in the subtitle, a note or the summary.
- **The reversal trigger** - the observation that would flip the lean, named so the reader can watch for it.

"Cannot rank" is allowed at most once in a deck, and only when it names the decisive missing evidence and what the reader would need to see. An evidence gap is a finding about the evidence, not a title: lead with what the evidence does show and put the limitation in the `subtitle` or a note. `author-deck.mjs` refuses a deck whose titles state gaps - lacks, unproven, undisclosed, cannot settle, neither - on more than 15% of its analytical pages (`TITLE_GAP_SHARE`).

| Instead of | Write |
| --- | --- |
| Long-run leadership remains unranked | Firm A leans ahead on paid work (medium confidence); matched retention would reverse it |
| Headline run rates cannot settle the revenue race | Firm B's run rate is about twice Firm A's on company-reported figures |
| Neither firm has a provably better capital structure | Firm B has the deeper funding access; Firm A the lower committed burn |

A judgement that is sharp enough to be wrong is the standard for the governing thought and every pillar. Where the evidence is thin, narrow the claim's scope (a segment, a period, a measure) rather than dropping its direction.

## Define the communication job

Above the dot-dash, record the audience, the actual choice or learning objective, the baseline and alternatives, the horizon, the ranked criteria, the fixed constraints, the evidence gaps and the condition that changes the answer. Distinguish the user's preferences from assumptions. Resolve the decision stage: diagnosis, option selection, recommendation, authorization or explanation. A sourced annual comparison cannot answer a three-year commitment merely by being labelled correctly.

Pick the decision architecture from the [templates](templates/index.md) when one matches the audience's primary decision - commercial due diligence, a competitive position, a startup pitch, a project update - and write the storyline directly when none does.

For authorization, keep one approval unit - the workflow, population, exposure, resources and permission requested - and carry the same unit into the summary and the close. Preparation, testing, live exposure and expansion are different commitments. Ask only for missing information that would change the argument; an existing authorization persists.

## Find the data before the dot-dash

A dot-dash written from what the author already knows produces pages of two numbers each: one company against another on a count. The rich page - a trend with its growth rate, the whole peer set ranked, a share shifting, a network on a map - needs a dataset, and the datasets decide which titles can be proved, so they are found first.

For a subject with public records, search for and download:

- **Series over time** for the measures the question turns on, five or more periods, from annual reports, investor presentations, regulators, statistics offices and industry bodies. Country series come in one call: `node runtime/fetch-series.mjs worldbank NY.GDP.MKTP.CD NOR,SWE,DNK --from 2010` or `... owid <grapher-slug> "Norway,Sweden"` writes the CSV, its source and retrieval date, each series' CAGR and a chart block.
- **The whole peer set** on the same measures and the same basis, not the subject against one rival.
- **Composition and share**: segments, regions, product lines, and how they have shifted.
- **Geography**: locations, networks and routes, with coordinates ([Geography](geography.md)).
- **Pipeline and commitments**: orders, plans, announcements, each with its status (announced, firm, delivered).
- **Ratios that remove size**: per unit, per head, per route, per asset.

Save what is downloaded under the task's `sources/` with its URL and retrieval date. Where a series is not published, say so and use the nearest defensible one. Declare the compared organisations as `players` on the deck so the deck introduces them, with their logos, before it compares them ([Design](design.md#make-every-exhibit-earn-its-page)). Research a comparison on the same measures for every member; `n/a` in a table is a finding where a substitute metric would hide it.

A 50-page deck on a competitive question normally carries several trends with their rates, a ranked peer comparison, a share or mix, a players page with logos, a map where the subject has geography, and scorecard tables that judge. If the candidate exhibits are mostly single-period comparisons of two entities, the research is not finished.

## Extract the insights before the titles

Data is not yet a finding. Work each dataset the way an analyst would and record what it says in `<id>.insights.json`:

```json
{ "schema": "professional-slides.insights/v1",
  "insights": [
    { "id": "i-launch-ramp",
      "finding": "Northvale Rail opened 14 routes in its first 16 months, faster than any of four peers in their first two years",
      "shape": "series",
      "breadth": { "periods": 16, "series": 5 },
      "calculation": "routes in service by month since first timetabled service, per operator",
      "measures": { "northvale": { "unit": "routes", "population": "Northvale Rail", "periods": ["M1", "M4", "M8", "M12", "M16"], "values": [2, 5, 8, 11, 14] } },
      "sources": ["sources/northvale-routes-2026-09.csv", "sources/peer-routes-2004-2012.csv"], "cite": ["northvale-timetable"],
      "soWhat": "the ramp, not the size, is the evidence that the entrant is gaining ground",
      "strength": "strong",
      "exhibit": "trend: routes by month since launch, five operators, Northvale highlighted" } ] }
```

Ask of every dataset:

- **Rate:** how fast is it growing, over what span? What rate would the target need?
- **Rank:** where does the subject sit in the whole set, and who is nearest?
- **Share and mix:** what share does it take, and how has the share moved?
- **Ratio:** what does it look like with size removed?
- **Gap:** how far is it from the benchmark, the target or the leader, and is the gap closing?
- **Break:** where does the series change direction, and what explains it?
- **Counter:** what in the data argues against the answer?

Keep the insights that are specific, surprising or decisive. Each records its `shape` - `series`, `peer-set`, `mix`, `measure-pair`, `bridge`, `geography`, `schedule`, `roster`, `fact` or `qualitative` - which decides the [page types](page-types.md#evidence-shapes) it can carry, and the `breadth` of its data. The log is refused when an insight is ungraded (`strength` is `strong`, `supporting` or `context`), has no `soWhat`, or is too narrow for its shape: a series under six periods (four with peers beside it), a peer set under six members. Widen the dataset while it is still research.

An insight whose evidence is numbers records them as `measures` as well as in its sentence: `{ name: { unit, population, periods | members | period, values | value } }`, with `better: "down"` where less is good news, `boundaries: { label: "..." }` where a member's period or entity differs, and `null` with its reason in `unavailable` where a value is undisclosed. A sentence cannot be joined to another record, subtracted from one, or checked against the chart drawn from it; a measure can, and the compile holds each exhibit to the measure it says it plots ([The evidence contract](page-types.md#the-evidence-contract)). `cite` names the `sources` registry keys the insight is cited to, so a page's citation is written from what it plots. A log that leaves a number-bearing insight as a sentence is refused (`MEASURES_MISSING`).

A page then writes its numbers by reference, not by hand: an exhibit names the measure and the runtime draws it (`series: [{ "measure": "i-launch-ramp/northvale" }]`), and `{{i-launch-ramp/northvale@M16}}` in a title prints the recorded value. Whatever is still typed is held to the measure it names, or traced to the measures the page rests on.

A single value that is a limit, target or covenant other measures are tested against says so with `standard: true`: the analysis catalogue then offers every measure in its unit a `threshold` against it.

Write the titles from the insights. Every analytical page names the insights it rests on in `evidence`, and each pillar rests on at least one `strong` insight (`PILLAR_UNSUPPORTED` otherwise). An insight with no page is either cut or missing a page; a page with no insight is either cut or missing its analysis. `author-deck.mjs --draft` prints, for each insight, the page types its shape can carry.

## Run the analyses before the outline

An insight log is a list of records, and a storyline written from it record by record is a walk through them: each page restates one, and the findings that need two - every alternative on the same measures, the gap between two series, the headroom to a threshold - have no record, so they get no page. Before the titles are written, say which analyses the answer turns on in `<id>.analysis.json` and let the runtime compute them over the log's measures:

```json
{ "schema": "professional-slides.analysis/v1",
  "analyses": [
    { "id": "A-peers", "op": "compare", "inputs": ["i-profit/pat", "i-volume/customers", "i-product/rank"],
      "soWhat": "The lead holds on two of three measures and reverses on the third", "strength": "strong" },
    { "id": "A-net-debt", "op": "gap", "inputs": ["i-balance/liabilities", "i-balance/cash"], "soWhat": "...", "strength": "strong" },
    { "id": "A-crews", "op": "scenario", "inputs": ["i-crews/on-shift"], "method": "linear", "horizon": ["FY27", "FY28", "FY29"],
      "assumptions": [{ "name": "net leavers a year", "value": -8, "unit": "crews a year", "rationale": "leavers continue at the last two years' pace and recruitment stays frozen" }],
      "soWhat": "...", "strength": "supporting" } ] }
```

`node runtime/analysis.mjs <id>.pages.json` runs the plan and writes `<id>.analysis-results.json`; the compile runs it again on every pass, so a result is never typed and never stale. The operations are `compare` (members by measures, n/a kept where a member is undisclosed, the rank and leader on each measure, and who leads when each measure in turn is the priority - no weights are invented), `gap`, `ratio`, `sum` (two or more measures in one unit, or the periods or members of one), `product` (two or more measures multiplied, divided by each measure in `over`), `index`, `growth`, `rank`, `share`, `threshold` (the headroom between a value and a recorded or stated limit) and `scenario` (a value carried over a horizon under stated assumptions, and where it crosses a threshold).

Two defaults are the plan's to override. A `compare` sets the deck's declared `players` against each other where it declares them, and every member the measures record where it does not; `members: ["...", "..."]` names the members to compare instead, a player or not, and the finding says how many recorded members were left out. A scenario's path starts at the series' last period, or the one `at` names, and for a measure of one value at its recorded `period` - "base" only where it records none, or the horizon already uses that label.

**Start from the catalogue.** `node runtime/analysis.mjs <id>.pages.json --catalogue` lists the analyses the recorded measures already allow, each as a plan entry to paste (`entry`: a suggested id, the op, its inputs) with the finding it computes and the plan's analyses that already run it (`inPlan`):

- `growth` over the span of every series;
- the `gap` and `ratio` of two measures in one unit over one axis: any two of one insight, and across insights one quantity for two populations or two quantities of one population - but never two differently named percentages (a margin less an occupancy rate is no quantity, whoever each describes); a pair with the same numbers at every label the two share is one number recorded twice, and is not listed;
- the `rank` of every peer set and the `share` of every `mix`;
- the `compare` over the declared players on every measure that lists two of them;
- a `threshold` for every measure against a single value marked `standard: true` in its unit.

Pairs are capped (six an insight, thirty across insights, pairs between two declared players first) and `capped` says what was left out. Choose the entries the answer turns on, give each its `soWhat` and `strength`, and leave the rest: the catalogue is what a critic would otherwise call missing but computable, not a list to run in full. A scenario is never listed, since its assumptions are the author's to state. The draft's summary points here (`catalogue`) when the plan runs none of the listed analyses about the declared players beyond the comparison itself.

**One calculation is one analysis.** `gap`, `ratio`, `sum` and `product` set their inputs label against label. A single value stands against every period or member of the others. Two measures that run over different axes, or share no label, are not aligned for you: say which value of each to read in `at`, and the result records the choice among its boundaries.

```json
{ "id": "A-clinics-with-planned", "op": "sum", "inputs": ["i-clinics/open", "i-clinics/planned"], "soWhat": "...", "strength": "supporting" },
{ "id": "A-newcomer-ceiling", "op": "product", "inputs": ["A-clinics-with-planned/result", "i-largest/visits"], "over": ["i-largest/clinics"],
  "at": { "A-clinics-with-planned/result": "Newcomer", "i-largest/visits": "FY26", "i-largest/clinics": "FY26" },
  "assumptions": [{ "name": "the newcomer sees the largest group's visits per clinic", "rationale": "the newcomer publishes no visit count, so the largest group's throughput stands in as a ceiling" }],
  "soWhat": "...", "strength": "strong" }
```

Units are composed from the inputs and cancelled: clinics times visits per clinic is visits, a ratio of one unit is a `ratio` (or `%` with `percent: true`), and a percentage in a `product` is applied as the fraction it is (45% of 140 m is 63 m). Where the composed unit does not simplify the result says so; state the result's `unit` with a `unitRationale` where it has a plainer name. A premise nobody recorded - one entity's ratio standing in for another's - goes in `assumptions` as `{ name, rationale }`, and makes the result `assumed`. `growth` on a measure in % reports the change in percentage points and nothing else: a margin moving from 9.4% to -6.1% is 15.5 points down, and the percentage of a percentage is computed only with `relative: true`, labelled as one.

What a result did with its inputs is said among its boundaries:

- a unit is a percentage wherever it says so (`%`, `margin %`, `share (%)`, `per cent`, `percentage points`); a `product` applies it as a fraction, where a `ratio` divides by the number as recorded (140 m over 45% is 3.1 m per point) and says that it did;
- a result that combines measures of different populations names them;
- a `sum` of one measure over its periods says how many periods it adds: right for a flow, wrong for a stock or a level.

Every result says what it is. `computed` rests on records alone. `assumed` rests on an assumption, each listed with its value and rationale: a number nobody recorded is said as one. `unavailable` names the input the records do not hold - list what is needed in the analysis's `missing` where no measure exists to point at - and carries no page; the critic is shown it as the gap it is. A computed or assumed result joins the log as a derived insight under its id: a page names it in `evidence`, an exhibit names its measure (`series: [{ "measure": "A-net-debt/result" }]`) and a sentence prints its number (`{{A-net-debt/result@FY26}}`).

Two results are drawn without typing a number. An `index` result's measures carry their base, so a `trend` of form `indexed` names them and nothing else. A scenario's `path` joins the recorded series it starts from as one line (`"measure": ["i-crews/on-shift", "A-crews/path"]`), with the assumed run marked on the chart.

A deck that declares two or more `players` compares them: without a computed `compare` that places every declared player, the spine is refused (`ANALYSIS_REQUIRED`). A player is placed when a compared measure lists it - with its number, or with `null` and the reason in `unavailable`, which is a finding - and at least two players have a number on one measure. A comparison over measures that name none of the players has not compared them. A deck that compares nothing is asked for no matrix.

## Prove the governing answer

Build a hypothesis tree for a decision, or a concept map for an explanation, with stable node IDs. For each terminal branch keep the provisional answer, the confirming and disconfirming evidence, the consequence, the evidence status and its disposition (body, appendix, or the one allowed unranked question). Siblings divide the same parent question. Stop expanding when more detail cannot change the answer.

Name the actual competing route and the constraint it can or cannot change. "Test whether ownership helps" is a research question, not evidence of a mechanism. State the common outcome and the observation that would reject the proposed advantage. Where a difference is not measured, the page states the lean the evidence supports and names the missing measure as its reversal trigger ([Answer under uncertainty](#answer-under-uncertainty)); it does not replace the gap with invented precision, and it does not make the gap its title.

Under each title state the evidence that settles it, what it builds on, what is new and the audience consequence. A comparative title needs comparable proof on both sides. A selected example establishes an instance; a median establishes location, not consistency; a correlation or arithmetic bridge does not establish causality. A decomposition states its baseline and allocation order.

Place a governing prerequisite before the first comparison that relies on it, or show its decisive proof locally in that comparison. Keep a constraint beside its first consequential use rather than in a later section that forces the reader to reconstruct it.

**Merge before layout.** Compare every page with its closest sibling and draft the merged alternative. Keep separate pages only when joining them materially harms a necessary comparison, explanation or lookup; different titles, extra caveats and another arithmetic step are not enough. A ratio, its distance from a threshold and the same distance in currency normally belong in one comparison. Consolidate preview scorecards and repeated endings. Audit detail earns its appendix place, but it is not another persuasive premise.

Give secondary obstacles proportionate space: if an option already fails an essential prerequisite, attach a further cost to that option unless it could reopen the choice. Adjacent schedules that repeat the same activities under different headings join on one time axis. When deletion takes a deck below a requested length, return to evidence breadth - a genuinely unanswered question the sources support - or move reference material to the appendix; never split a page to recover the count.

## Work in parallel with subagents

Research and analysis split cleanly, so when the harness can spawn subagents, fan them out. The lead keeps the request, the answer, the players and the title spine; subagents do bounded work and return files.

| Stage | Fan out by | Each subagent returns |
| --- | --- | --- |
| Find the data | Workstream: the subject's series; each player group; market and demand; geography; pipeline; the counter-case | Files under `sources/<workstream>/` with URL and retrieval date, and what it could not find |
| Extract the insights | The same workstreams | `insights/<workstream>.json` in the insight-log format - `{ "insights": [...] }` - every finding with its calculation, sources and `measures` |
| Lay out the pages | Section, once the spine critique is `ready` | The section's pages, drawn only from the merged insight log |
| Critique | A fresh subagent every pass; one per section plus a spine critic for a long storyline | `storyline-review.json` ([stress-test](#stress-test-the-storyline)) |

The lead does not paste the parts together: `<id>.insights.json` lists them - `{ "include": ["insights/subject.json", "insights/peers.json"], "insights": [...] }`, paths beside the log, the log's own insights first - and every reader of the log merges them in that order. Give each workstream its own id prefix. A part is a file in the log's folder or under it (one outside it - `../`, an absolute path, a link that leads out of it - is refused), and a file that is not JSON is named in one line.

An id recorded twice - in two parts, or twice in one file - is refused with both places named, and one measure recorded twice - the same name, population and unit in two insights - is reported (`MEASURES_CONFLICT`): it blocks where the two records hold different numbers for one period or member, and is advised where they agree or differ only in rounding. The check reads structure only, and does not catch:

- one quantity under two measure names, or one population spelled two ways;
- one quantity in two scales (millions in one record, billions in the other);
- one period under two labels (a two-digit year and a four-digit one);
- an entity's own record against its row in a peer set.

Agree the measure names, populations, units and period labels in the brief.

Use at most four workstreams, each with a budget of about fifteen searches and a list of the decisive series to find; tell it to stop when those are found and to record what it could not find. Brief each subagent completely - the request, the answer so far, exactly what to find, the file formats and folders, the evidence date, and to record rather than invent what it cannot find. Only the lead edits the title spine. A harness with no subagents runs the same stages in sequence.

## Stress-test the storyline

Before any page is laid out, the spine goes through a mock problem-solving session with a reader who did not write it. The order is fixed: evidence, analyses, the draft spine, the critique brought to `ready`, then one layout pass and the build. Do not draw exhibits or write copy to prepare for the critique: it does not read them, and every pass that sends the spine back would send the layout back with it.

`node runtime/storyline.mjs <id>.deck.json out/` (on the deck `author-deck.mjs --draft` wrote) stages a packet - the request, the answer, the pillars, the titles with their one-line claims, the page types, what settles each claim, the insight ids and the measures each page shows with their recorded values - and a prompt for a senior, adversarial reader, and exits 3. The default is this spine critique, which returns at most ten items. `--full` adds the page-level checks (claim, shape, sourcing, restatement, consequence on every content page); above 30 content pages a full critique splits into section prompts of at most 16 pages plus a spine prompt, whose answers `storyline.mjs merge <id>.deck.json out/` joins.

1. **Spawn a fresh subagent** as the critic - the harness's agent or task tool, or `--run codex` / `--run claude`. Give it only the path to the printed `prompt.md`. A critic that knows what the author meant forgives what the page fails to show.
2. **Save** its JSON as `out/storyline-review.json` and run `storyline.mjs` again: it validates the critique against the packet it answered and records it under `<deck dir>/.reviews/<id>/storyline-history/`.
3. **Revise at the root.** A missing analysis means the analysis, not a new sentence: each one names its `remedy` - `computable` from the measures already in the log, runnable under a stated `assumption`, or needing `retrieval` of data the packet does not hold - and closes on its artifact, the computed analysis or insight a page now rests on: one that is new, changed, or newly rested on since the pass that left the item open - an analysis that already stood there, unchanged, is what the critic judged insufficient. A finding closes as `fixed` where the argument moved: on a page it names, on the page the status names in `artifact`, or in the answer - a redrawn exhibit or reworded copy moves nothing. These are checks that something changed; whether the change answers the item is the critic's judgement. A page that says what the evidence does not establish has qualified the gap, not closed it. A two-number chart becomes the whole peer set or the trend; an unranked question becomes a lean with its confidence and reversal trigger; an obvious page is cut or merged.
4. **Verify.** With the argument changed, `storyline.mjs` writes a verification packet: the critic gives every open item a status and may add only a major or blocker item that the revision introduced.
5. **Stop at `ready` (exit 0), or at three passes.** A storyline still sent back after the third pass goes to the user with its open items. Where the evidence scope is closed, a retrieval the team may not make is `scope-limited`: it stays open at its severity, and the loop can end as `provisional` (also exit 0) only when nothing else is open and the deck offers its answer as provisional. An item the answer no longer needs, because the answer now claims less, closes as `narrowed`; the runtime checks only that the answer changed, and the critic judges that it claims less.

The loop's rules - exhaustive first pass, verification passes, the cap, lineage, provenance, and restarts with `--reason` (switching between the spine and `--full` is one) - are the deck review's, owned by [Taste review](taste-review.md#order-of-the-reviews). Each pass records the version of the binding it was made under. A lineage whose latest pass was recorded under an older version cannot say which pages changed since, so the next `storyline.mjs` run archives it (`storyline-history/retired-<n>/`, logged in `lineage.json` with the reason) and writes a first pass: not a restart, and nothing of the old lineage counts against the cap.

What was open in a retired lineage is not dropped with it. Its blocking items still open are listed in the new packet as open when the earlier lineage was retired, each with its text, and `lineage.json` records how many were carried. The critic says of each, in `carried`, whether it still stands on the spine as it is now, and files the ones that do as items of the new pass; a critique that leaves one unanswered is refused.

The critic holds the deck to the request: every sub-question answered with a lean, pillars MECE with their counter-arguments, pages carrying evidence a reader could not assemble in five minutes. No deck review is prepared, and no deck delivered (`STORYLINE_UNREVIEWED`), until the gate is `ready` for the current spine. A revision whose titles, order and source slides are unchanged needs no critique. Set `targetPages` on the deck when the user asked for a length; the appendix counts toward it.

### What the critique is bound to

The gate binds to the argument, so that the layout is done once, after `ready`, and a layout repair that leaves what each page shows as the critic read it does not reopen the critique.

| Bound: changing it needs a verification pass | Not bound: the layout, free after `ready` |
| --- | --- |
| The `request`, its provenance and the evidence scope; the `answer` and its status | The brief, the audience, the design and every other deck setting |
| The pages and sections, in order: a page added, cut or moved | - |
| A page's `title` (its claim) and its `type`, the reading task; a section's title | Its `form`, where its `commentary` sits, `takeaway`, `why`, `adds`, the subtitle; a section's `summary` |
| `settles`: its `kind`, `what`, `measures` and `relation` - as written, or, on a page that leaves `settles` out, as derived from the findings of the insights it names | A chart's form within its class (a line redrawn as columns, a bar as a lollipop, a row as a stack), headings, captions, highlights, annotations |
| `evidence`: the insights and analyses the page rests on | Points, the rail, the so-what bar, table cells and every other piece of copy |
| The measures the page shows, each as proof or context, measure by measure (one chart can show both): the claim's measures, and every `basis` on an exhibit, block or metric | A second exhibit that shows a measure the same way as the first |
| What the page shows of each measure, exhibit by exhibit: which of its periods or members (a window, a dropped period or member), and the exhibit's class - a plotted chart, a table, or a figure (a metric, a hero figure, a fact grid, a stat list) | The numbers a chart plots on its category axis for a measure it names: the evidence contract holds them to the record |
| In a table, or any exhibit with no category axis: the recorded number each period or member it names is stated with, and every value it types (a bar cell's `value`, a scatter's points) | A cell's wording, so long as the cell still states the recorded number its header and row name |
| The numbers drawn by an exhibit that names no recorded measure, with its class - every numeric exhibit of a deck with no insight log | A number written into a label or a cell's text |
| The recorded values, unit and periods or members of each measure the page shows, from the insight log and the analyses | The insights' wording, and measures no page shows |

So the spine says, before anything is drawn, what each page will show. `settles.measures` names the claim's measures, which count as shown; a page that will show more - further members of a peer set, a context measure - declares it at the spine as an exhibit holding only its `basis` (`"exhibits": [{ "basis": { "measures": ["i-efficiency/branches"], "role": "context", "relevance": "..." } }]`), which `--draft` accepts and the layout pass fills in. A measure first shown at layout is a changed argument on that page: the gate names the page, and the next `storyline.mjs` run writes a verification pass that reads it.

**State at the spine what each page shows of each measure** - a window, a subset of members, a table or a single figure - because that is part of the argument the critic reads, and the layout is held to it:

- A page that will show the whole measure plotted needs nothing. Undrawn and undeclared, a measure is read as shown whole - every period or member - plotted, or tabulated where its page type's exhibit is a table (`lookup`, `scorecard`, `matrix`, `options`), a measure of one value as a figure.
- Any other view is written at the spine. The normal way is the bound exhibit, one line the layout keeps: `{ "series": [{ "measure": "i-cash/ocf", "name": "Cash flow" }], "select": { "from": "FY21" } }`. Where the exhibit is not written yet, its `basis` stub states the view: `{ "basis": { "measures": ["i-cash/ocf"], "as": "table", "labels": ["FY25", "FY26"] } }` ([the fields](page-types.md#the-evidence-contract)).
- `--draft` and `--plan` print, for every page, how each measure it does not draw yet will be read (`readings`: "p12 i-cash/ocf: read as plotted, every one of its 8 periods"), and the packet says the same in brackets after the measure ("tabulated, 2 of its 8 periods: FY25, FY26"). Read the list before staging the critique.

**Bound titles are proven layable before the critique.** `--draft` and `--plan` compose every section title on its divider, the contents page, the tracker and each page's title band under the deck's own design, and refuse one that does not fit with the room it has (`SPINE_UNFIT`, [the rule](page-types.md#spine-rules)). A title is never first found too long after `ready`, when shortening it would cost a pass.

**So is everything else whose repair would change a bound fact.** A draft holds every finding that only a change to this table's left column can mend, and defers only what the copy, the layout or the fit settles ([the split](page-types.md#the-pages-file-is-the-dot-dash)):

- every exhibit the spine determines - a bound or typed chart, a stub's view, a measure read whole - is composed with placeholder copy and refused where no chart can draw it, such as a measure with an undisclosed member plotted whole (`SPINE_UNDRAWABLE`; the repair names the choice, `select: { members: [...] }` over the disclosed ones or a table);
- the dependency contract on what the page has declared - a relation left undeclared, context nothing explains, a claim's measures not shown - blocks in the draft, not after `ready`;
- the executive summary is composed at its word ceiling and refused where it cannot fill its page (`SPINE_UNFILLED`): write its answer table at the spine.

Laid out to the view the critic read, the page keeps the critique. Another window, a dropped period or member, or another class first drawn at layout reopens that page alone.

How a drawn exhibit is read: a chart shows the periods or members on its category axis. A table - any exhibit with no axis - shows the ones its column headers and row labels name, where a number under that header or in that row states the recorded value (what a cell says in passing is copy); with none named, the ones whose recorded value it states. A header kept over other numbers shows nothing of the measure. The values such an exhibit types - a bar cell's `value`, a scatter's points - are bound as themselves, so an exhibit that types values is written at the spine, bound, not declared by a stub.

The critic is shown the same thing it is bound to: the spine packet lists no exhibit form and no drawn number, and the `--full` packet shows a drafted exhibit or sentence marked as a draft, which the critic is told not to file items on.

### What the reviews are told

The critic and the deck's reviewer judge against the request, so they are told what it is. `requestProvenance` on the deck says how the `request` came to be - `verbatim` (the default), `reconstructed` or `paraphrased` - and a request that is not the user's own words is read for what it asks, not held to its wording or to an answer its phrasing presumes. `evidenceScope: { retrieval: "closed", note, quote }` says the author may use only the evidence supplied: a missing analysis that needs other data then keeps its severity and cannot be asked of the team. The limit is the user's to set, so `quote` gives the words of a verbatim `request` that set it (the runtime checks only that the words are in the request - a reconstructed or paraphrased request cannot close the scope - and the critic, shown them, says whether they set a limit). A provisional pass is a pass the earlier rules did not have: a storyline with a decisive retrieval open can reach the deck review, as provisional, where before it was sent back or closed on a search log. `answerStatus: "provisional"` with `answerLimits` offers the answer as provisional and says what it leaves open; delivery records a deck accepted on a provisional storyline as provisional, with the items left open.

The critique returns two judgements beside its verdict, held to its own ledger: `compliance` (has the team done everything the evidence in scope allows - `complete` only when nothing it could still act on is open) and `sufficiency` (does the evidence support the answer as stated - `sufficient` only when nothing is open at all). A team can comply and the answer still not be sufficient. The rating is on one anchored scale, capped at 5 with a blocker open and 7 with a major open, so a number means the same thing on every pass.

## Reconcile evidence before design

Verify factual premises and dated source status: rumour, announcement, agreement, approval and completion are distinct. Track whether research is resolved, uncertain, unavailable after lookup, not yet performed or needs the user's input; do not describe unperformed research as unavailable.

Keep one record for each reused measure: definition, member values, exclusions, population, unit, period, evidence state, inputs, formula and rounding. Sum members before drafting totals, and derive shares and distributions from the records. A parameter's identity travels with its values into labels, notes and summaries; changing it reopens every page that uses it.

Match alternatives on the same horizon and feasible commitment, and separate economic value from cash, one-off from annual, gross from net. When sensitivities govern the same outcome, join them into one feasible case rather than a series of isolated calculations. Match uncertainty to the sampling unit: repeated observations are not independent cases. Synthetic or illustrative records demonstrate a mechanism; they do not establish demand or uplift. [Production](tools/production.md#portable-evidence-and-release) owns reproduction.

Take a picture inventory with the evidence. List every subject a reader would recognise on sight - a product, a brand, a place, a person, a site - and give each a source: a cleared asset with its credit, one only the user can supply (ask for it), or none because the subject has nothing to look at. Plan the pictures still to come as `{ alt }`; the build lays them out and `UNSOURCED_PICTURE` holds delivery until they are filled.

## Approve it

The ghost dot-dash - the title spine in order, with each page's type and the insights it rests on - is the one point where the user approves the argument before copy is written ([pipeline step 5](../SKILL.md#pipeline)). A standing instruction to proceed satisfies it; a requested change authorizes that change and its dependencies. Internal reviews are not approval steps.

## Revising an existing deck

The rebuild is a new editable PPTX from the user's deck, not an edit of the original file.

1. **Inventory.** `$RUNTIME_PYTHON runtime/import-deck.py deck.pptx <work>/` writes `<id>.inventory.json` - every slide's layout, hidden flag, title, text with its levels, table cells, chart series, pictures and notes - and a starter `<id>.pages.json` with stable ids (`s01`, `s02`, ...), `workflow: "existing_deck_revision"`, `inventory` on `deck`, each page's `sourceSlide`, and each slide's old copy as `draft`. It refuses to overwrite an existing pages file unless given `--force`. The inventory records each slide as it shows: paragraphs in the order their displayed positions read, through turned and mirrored groups, and each picture's `width` and `height` as the box it covers on the slide, its `rotation` in degrees clockwise net of every group's turns, and `mirrored` when an odd number of flips shows it reversed.
2. **Map.** Give each slide a page type by its stable id: its claim decides the type, and the inventory holds the data its exhibit needs (`author-deck.mjs --scaffold <type>` prints a page to fill). A slide that is dropped is deleted from `pages`; a slide not yet mapped is `REVISION_UNMAPPED`, reported by `--draft` and refused by the full compile. A hidden slide's starter page carries `hidden: true` beside its `draft`: keep it when mapping, or set it to `false` to show the slide; a hidden title slide stays a page rather than becoming the cover ([Composition](composition.md#page-and-deck-keys)).
3. **Revise the affected claims and their dependencies.** A changed number reopens every page, summary line and close that states it; unaffected slides keep their claims and wording.
4. **Critique and review what changed.** Changing a title, moving a page or cutting one changes the spine and sends the revision through the storyline critique (pipeline step 5); a revision with its spine unchanged skips it. The deck review's first pass reads the pages whose copy changed or that are drawn unlike their source slide, and every page of a restyle ([Taste review](taste-review.md#acceptance-confirmation-and-build-bars) owns the scope). Then build and deliver from pipeline step 6.

## Worked example: who is better positioned

A comparison of two firms on four criteria. The request asks who is better positioned now, in the long run, and on capital.

| Part | Content |
| --- | --- |
| Governing thought | Firm A is better positioned today on paid enterprise work; the long-run lead turns on retention, which currently favours A at medium confidence |
| Pillars | Demand (who wins paid work), capability (whose models lead on the tasks buyers pay for), distribution (who reaches buyers), capital (who can fund the build-out) |
| Near-term | A leads paid enterprise adoption, 44% to 40% of panel firms buying (high confidence; a reversal in the panel's next two months would flip it) |
| Long-run | A leans ahead because its cohorts retain better (medium confidence; matched net retention published by B would reverse it) |
| Capital | B has the deeper funding access, twice A's committed capital (high confidence); A's lower burn narrows the gap only if its growth holds |
| Unranked | None: every sub-question carries a lean, a confidence and a reversal trigger |

Each pillar is a section whose title states its claim, and each page title proves part of it. The [competitive position template](templates/competitive-position.md) sets the criteria, their weights and the scorecard that makes the call.
