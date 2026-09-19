# Storylining

Storylining turns a brief into an approved slide sequence before any page is drawn. It produces three things: a governing answer, a hypothesis tree that proves it, and a dot-dash the owner approves.

## Define the communication job

Write one sentence:

> After this deck, the audience should understand or decide ______ because ______.

Then write the main question and the governing answer. When the answer is not yet supported, write it as a hypothesis and mark what would confirm or reject it.

Resolve the decision stage as well as the topic:

- **Diagnosis** - establish what is happening and why.
- **Option selection** - establish which options merit detailed design.
- **Recommendation** - name the supported choice and its conditions.
- **Authorization** - request a defined action, with scope, resources, owner and the condition that reverses it.
- **Explanation** - build understanding; the close delivers the promised understanding rather than a decision.

Carry the stage into the summary and the close. An options diagnostic concludes which levers merit design; it leaves implementation, savings and staffing unapproved.

## Sharpen the brief before drafting

Ask the questions whose answers would change the argument, grouped into one interaction, and carry forward answers already given:

- Who decides, and whose preferences matter? For a client engagement, establish the client's context rather than assuming your own.
- What decision or change in belief should the deck enable?
- Which criteria matter most, in what order, and which constraints are fixed?
- What alternatives, baseline or current position are in play?
- What time horizon or circumstance could change the answer?
- What is the strongest counterargument, and what evidence would move the audience?

**Specificity check.** Could this title spine and recommendation be reused unchanged for a different audience or decision? If so, name what is missing and ask one useful follow-up. The remedy is a sharper supported thesis, not extra personalization labels.

Summarize the resulting brief above the dot-dash: audience, intended outcome, decisive criteria in the client's own ranked order, constraints, unresolved questions. Separate what the user said from what you assumed. Say how the answers changed the provisional thesis and what now falls outside the story.

## Organize the evidence

For every material fact retain: source location, population or business boundary, measure, unit, period, reported precision, and evidence state - observed, source-modeled, supplied assumption, or analyst-derived. For a calculation retain its inputs and formula. For a qualitative fact retain the mechanism, condition or named example.

Record research requirements explicitly: criterion, status (`resolved`, `uncertain`, `unavailable`, `needs-user`, `unperformed`), the evidence that closes it, and the remaining limit. Distinguish information that was unavailable after a genuine lookup from research not yet undertaken; an honest "not yet investigated" answers a different question from the one the brief asked.

Build an alternatives-by-criteria coverage matrix before drafting. Every shortlisted option needs evidence on every decisive criterion, or an explicit open status. Choose the geography, period, unit and population first, then collect.

Keep comparable observations apart from adjacent ones: an annual benefit and an implementation duration describe different dimensions; cash expenditure and after-tax earnings use different bases; national net employment and regional gross job flows answer different questions. Preserve source totals and independently rounded inputs as published, with a concise rounding note.

## Build the problem logic

For a decision under uncertainty, decompose the root question into a hypothesis tree. An issue tree asks what must be investigated; a hypothesis tree records what is currently believed and what evidence would confirm, refine or reject it. Give nodes stable IDs (`H1`, `H1.1`) so the tree survives changes to the story.

For every terminal hypothesis record:

- the provisional answer and its relationship to the parent;
- the decision consequence if true and if false;
- the confirming or disconfirming analysis;
- the evidence state: supported, contradicted, mixed, untested or blocked;
- the source or data dependency and its material limitation;
- priority and disposition: core story, appendix, parked, unresolved.

Siblings use one decomposition logic and divide the parent without overlap. Every leaf is falsifiable. Prioritize the small number of branches most likely to change the decision, and keep the others in the tree with an explicit disposition so focus stays visible as focus. Stop expanding a branch when more work will not change the governing answer at the required confidence.

For explanatory work, map concepts and dependencies instead: what the audience must already understand, what each page supplies, and how the parts answer the communication question.

## Prove the governing answer

Trace each decisive conclusion back through its assumptions to evidence. A sourced input and a correct calculation do not validate the model between them. Explain why the chosen drivers, scope, horizon and comparison answer the audience's question, and carry a constraint found in one branch into the branches it affects.

For modeled outcomes, distinguish an evidence-anchored estimate from a sensitivity or an illustrative case. State the decision rule that turns a range into an action, say whether its thresholds are supplied policy or your own assumption, and show when sensitivity changes the action. A conditional model supports a conditional recommendation.

Compare alternatives on the same decision axis and horizon. Distinguish the audience's requested decision, the authorized approver and the execution owner when they differ. Uncosted work and missing authority remain a further decision.

**Claim-to-proof check.** Before choosing a layout, write the exact premises that make the proposed title reasonable. A comparative verdict needs comparable evidence for both sides on the stated criterion. One example, one favourable period or one attractive photograph establishes an instance, not a general result. Where quantitative evidence can test the claim, show the values, comparison basis, period, units and sample sizes; check whether a total reflects volume and whether an average hides a distribution. Where the claim is inherently qualitative, use specific comparable examples and explain the mechanism.

Then hide the title and remove decorative imagery. The remaining exhibit must let a reader reconstruct the argument. If it cannot, repair the reasoning before changing the spacing.

## Choose the narrative arc

- answer, proof, decision - for a short, already-framed decision;
- situation, complication, resolution - when a changed condition creates the need to act;
- problem, solution, evidence, ask - for a proposal or funding request;
- baseline, variance, cause, action - for performance diagnosis;
- question, tests, synthesis, recommendation - for hypothesis-led analysis;
- concept, mechanism, worked example, limits, application - for teaching.

## Stage one: content design

**Nothing in this stage may name a component, an architecture or a variant.**
There is nowhere to put one, and that is the point.

A 50-page deck once recorded thirteen page architectures, 0.93 style entropy and
a stated reason on all fifty pages — the best layout numbers ever measured
here — and carried one chart, twenty-eight pages opening with the literal word
"Interpretation:", and eighteen tables on two invented schemas. A reader rated it
2 out of 10. Layout planning passed with distinction; content design never
happened. They were one artefact, so choosing a shape *felt* like choosing the
evidence, and nothing noticed that the evidence had not been chosen.

Write `deck.content.json`. One entry per page, four fields:

```json
{ "schema": "professional-slides.content/v1", "id": "rollout",
  "question": "Which markets go first, and what opens the second wave?",
  "answer": "Three markets whose data is ready, a gate at month seven, one owner per wave.",
  "pages": [
    { "n": 4,
      "claim": "Start with the three markets whose data is ready; file Germany now",
      "settles": { "kind": "count", "what": "markets clearing the four-point readiness assessment" },
      "adds": "Filing Germany in month one is what makes a month-12 launch reachable at all",
      "highlight": "three of twelve" }
  ] }
```

- **`claim`** — the sentence this page proves. A topic label is not a claim:
  "Origins" is a section name, "DC's foundational icons predate Marvel's defining
  1960s ensemble" is a page. If it has no verb, the page has no argument yet.
- **`settles`** — what settles the claim, and of what **kind**: `count`, `share`,
  `rank`, `rate`, `sequence`, `comparison`, `structure`, `qualitative`. This is
  the only field the layout stage reads, and the only bridge between the two
  stages. A deck that writes `qualitative` on more than a third of its pages has
  decided to draw boxes; the gate says so before a shape exists. The deck that
  failed had twelve issues, twenty-two films, a thirty-year gap and two
  billion-dollar grosses in its own prose, and drew every one of them as a diagram.
- **`adds`** — what the commentary says that the exhibit *cannot*. This field did
  not exist, and its absence is those twenty-eight "Interpretation:" pages: with
  nowhere to record what the commentary was for, the commentary became a second
  reading of the exhibit. If the honest answer is "nothing", the page does not
  need a commentary column and the exhibit should have the width. A commentary
  column is not the house default: measured over 264 published client pages, 73%
  of chart pages carry one, 56% of diagram pages, 31% of table pages and **4% of
  pages that are type alone**. Leaving it off is the commonest choice on the
  commonest page.
- **`highlight`** — the phrase the reader should see first, set in the accent
  inside a sentence.

Present it to the person as one block per page, not as a table. A table gives
every field a cell the width of a phrase, and `adds` answered in a phrase is how
"Interpretation:" gets written.

```bash
node runtime/gates/content_gates.mjs deck.content.json
```

Get this accepted before writing a single exhibit name. **Name the file
`<stem>.content.json` beside the deck spec** and `build-deck.mjs` runs the gate
itself, before it composes anything — a rejected content plan stops the build
with no scene written. A build with no content plan beside it still runs, and
says `stages: { content: "absent" }` in its output, because a stage that was
skipped and a stage that does not exist should not look the same.

## Stage two: layout planning

Now, and only now, decide what each page looks like. Read `settles.kind` and
nothing else from stage one: the evidence has been chosen, and this stage serves
it.

One row per page — here a table is right, because these are all short fields:

| # | Exhibit | Variant | Why | Architecture | Anchors | Insight |
| --- | --- | --- | --- | --- | --- | --- |

- **Exhibit.** The encoding, taken from `settles.kind` — see the table below.
- **Variant.** How that exhibit is treated: `heat`, `bubble`, `bar`, `harvey`, `verdict column`, `stacked`, `sorted`, `grid`, `paginated`, and a table's size as `12×5`. Two pages both reading `table` may be a twelve-row heat matrix and a three-row grid; counted as one kind they make a deck look more varied than it is, and the variety gate counts `exhibit/variant` where the variant is recorded. This is also where a table stops being a plain grid: across ten tables in a generated deck, not one named a treatment and not one got one.
- **Why.** One phrase saying what made this the exhibit — "magnitude over time", "ranking, sorted", "genuinely a matrix: three dimensions over the same rows". Required on the exhibits a plan reaches for when it has not decided anything (a table, a column or bar chart, a staircase, a list), because that is where a default hides. A page that cannot produce the phrase has not chosen its exhibit yet.
- **Architecture.** `exhibit-left`, `exhibit-top`, `hero-number`, `two-up`, `split-tone`, `grid`, `exhibit-full`, `metrics-over-exhibit`, `picture-hero`, `picture-pair`, `picture-strip`, `table-halves`, `text`. The evidence goes on the left and what it means on the right — `exhibit-right` exists but is never chosen for you, because a reading order a reader can rely on is worth more than the variety of not having one. A deck built from two architectures reads as one page repeated; the plan gates measure the spread as entropy and cannot measure it at all when this column is blank. Where a run of pages is one template on purpose — six use-cases, eight market profiles — name the run as `series: <name>` and the gates count it once instead of punishing a deliberate decision. **Variety belongs in the exhibit, not in which side of the page the table sits on.**
- **Anchors.** One visual anchor per named thing, and the form follows the thing: a **photograph** where it is depictable (a character, a city, a product, a person), an **icon** where it is a category or a concept. Write `none` where the page is deliberately unanchored. This is the column that keeps a deck from becoming a wall of tables: most two-column qualitative tables are "five categories and what each means", which is an icon list, not a matrix. The two halves then have different homes: icons go into `cards`, a `rows` list or an icon-led points column, and photographs go into `picture-hero` (one subject), `picture-pair` (two) or `picture-strip` (three to five) — where each picture carries a `label` and a `text`, because a picture with a name under it and nothing else is a caption, not an argument. Name the photograph you intend to use, or write it as `alt` only: a picture with no file composes as its empty frame, so a page can be planned, laid out and gated before the picture has been cleared.
- **Insight.** `filled`, `outline` or `none` — whether the page closes with its conclusion in a band, and in which treatment.

Keep planning language out of the rendered deck. `adds` is a field in a file,
never a label on a page: a sentence that reaches a reader starting
"Interpretation:" is the plan showing through, and `PLANNING_VOICE` reports it.

**Choose the exhibit from the shape of the evidence.**

| The evidence is | The encoding is |
| --- | --- |
| A magnitude over time | `chart.column`, or `chart.line` past about eight periods |
| A ranking | `chart.bar`, sorted |
| A composition | `chart.stacked-column`, `chart.marimekko`, `chart.waffle` |
| A relationship between two measures | `chart.scatter`, `chart.bubble` |
| A sequence whose stages have dates | `timeline` — the dates are the axis |
| A sequence whose stages have durations | `gantt` — length is the finding |
| A sequence a subject moves through | `journey` — the stages happen to someone |
| A strictly ordered process with no dates | `chevron-process` |
| A sequence that accumulates, each stage keeping the last | `steps` — the staircase, and only here |
| A sequence that returns to its start | `cycle` |
| A structure or set of relations | `framework`, `relationship-network`, `tree` |
| Two named, depictable things | `picture-pair` — images side by side, the comparison as cards beneath |
| One named, depictable subject | `picture-hero` — the picture on one side, the argument beside it |
| Three to five depictable things | `picture-strip` — the pictures across the page, a card under each |
| Named places, regions or territories | `map` with a choropleth and a `note` per region — the annotated map |
| A set of named categories | `cards` or `rows`, one icon per category |
| A comparison across three or more dimensions | `table` |
| One number that carries the page | `metrics` with a `kpi` |

**Put the two numbers the title compares next to each other.** A title that
compares Marvel with DC, drawn as two bar groups of median and gross, makes the
reader jump between groups to find the comparison it already stated. Exchange
the category and the series — publisher as the category, measure as the series —
and the two numbers sit adjacent. The encoding follows the sentence: whatever
the title puts side by side, the chart puts side by side.

**The staircase is for accumulation, not for sequence.** It says each stage
keeps what the last one built. A sequence with dates is a timeline, with
durations a gantt, with a subject moving through it a journey, and a strictly
ordered process with neither is a chevron process. A deck that draws five
staircases has used one shape for five different relationships.

**A table is the answer only when the content is genuinely a matrix.** It is the container that accepts anything without thought, which is exactly why it becomes the default: two columns of sentences is a comparison panel, a rows list with an icon per category, or a chart — not a table. Reference decks run about 13% tables; a plan past 25% is reported.

**Titles set on one line.** Target eight to twelve words. The page gate's fourteen-word limit is a ceiling, not a target, and a plan written to it makes two-line titles the norm — which is what makes the title band, its rule and the content beneath sit differently on every page.

### The plan file the gates read

The table above is how a plan is *read*; `<stem>.plan.json` beside the spec is
how it is *checked*, and the build runs the gates over it automatically. One
object per page, in deck order. Every field is optional except `n` - a plan that
records less is judged on less, never punished for the blank.

```json
{
  "schema": "professional-slides.plan/v1",
  "noPictures": "Every subject is a trademarked character; the deck anchors on icons instead",
  "pages": [
    { "n": 1, "kind": "cover" },
    { "n": 4, "title": "Marvel's ordered run reaches a payoff DC has no equivalent for",
      "exhibit": "chart.column", "variant": "sorted, annotated", "why": "magnitude over time",
      "architecture": "exhibit-left", "anchors": [{ "icon": "timeline" }], "insight": "filled",
      "highlight": "eleven hours", "rows": 8, "items": 4, "series": "market profiles" }
  ]
}
```

| Field | What it is | Which gate reads it |
| --- | --- | --- |
| `n` | the page number, matching the spec | every finding is reported against it |
| `kind` | `cover`, `section`, `agenda`, `takeaways`; absent or `content` for an analytical page | all of them - only content pages are measured |
| `title` | the action title you intend to write | `PLAN_TITLE_LENGTH` |
| `exhibit` | the encoding, from the table above | `PLAN_EXHIBIT_MIX`, `PLAN_EXHIBIT_RUN`, `PLAN_EXHIBIT_VARIETY` |
| `variant` (or `exhibitVariant`) | how it is treated: `heat`, `bubble`, `bar`, `harvey`, `verdict column`, `sorted`, `12x5` | the variety count, and `PLAN_TABLE_MONOTONY` |
| `why` (or `reason`, `exhibitReason`) | the phrase that chose the exhibit, twelve characters or more | `PLAN_EXHIBIT_REASON`, on defaulted exhibits |
| `architecture` (or `layout`) | `exhibit-left`, `exhibit-top`, `two-up`, `grid`, `hero-number`, … | `PLAN_STYLE_ENTROPY` |
| `anchors` | one entry per named thing: `{ "photo": "the Bucharest centre" }` or `{ "icon": "growth" }`; `false` where the page is unanchored on purpose | `PLAN_VISUAL_ANCHOR`, `PLAN_NO_PICTURES`, `PLAN_NO_ICONS` |
| `insight` | `filled`, `outline` or `none` | `PLAN_NO_INSIGHT` |
| `highlight` | the phrase the reader should see first | `PLAN_NO_HIGHLIGHT` |
| `rows` (or `shape: "8x4"`) | how deep the table is | `PLAN_TABLE_DEPTH` |
| `items` (or `points`) | how many named things the page enumerates | `PLAN_VISUAL_ANCHOR` |
| `treatment`, `annotation` | named table treatments and chart annotations, when they are not in `variant` | `PLAN_TABLE_MONOTONY`, `PLAN_UNANNOTATED_CHARTS` |
| `series` | a run of pages that is one template on purpose | `PLAN_EXHIBIT_RUN`, `PLAN_STYLE_ENTROPY` - counted once |
| `noPictures` (deck level) | why this deck carries no photograph, in a sentence | excuses `PLAN_NO_PICTURES` |

`noPictures` is the honest way out of the picture floor, and the only one. A
deck whose subjects are trademarked, confidential or abstract says so once and
is not asked again; what it must not do is draw an empty frame and explain on
the page that the frame stands in for a picture nobody could supply.

Run `node runtime/gates/plan_gates.mjs deck.plan.json` over the machine-readable plan before writing any page. It answers in under a second, and named `<stem>.plan.json` beside the spec the build runs it for you.

**Title spine test.** Read the dots alone. A decision deck should read as a clear executive memo; an explanatory deck as a coherent account. Titles state supported conclusions; explanatory headings may name a mechanism or distinction when a takeaway would overstate the page. Remove repeated claims, topic labels and unsupported certainty.

**Standalone evidence test.** Read any synthesis together with the dot-dash, without slides or narration. Every decisive branch has proof, the proof supports the inference, the strongest countercase is addressed, and the verdict follows. For each analytical case record the actual values, source, population, period, comparator, inference limit and the slide that presents the proof.

**Measurement before encoding.** Name the measurement basis for every exhibit: `native`, `percentage-change`, `per-capita`, `rebased-index` or `published-index`. Prefer native units with direct values, and labelled percentage change when relative change is the question. A rebased index earns its place only when a common-base trajectory answers a question native units cannot; record the base period and keep the absolute values in view.

**Continuity.** For each analytical dot record what it builds on, what is new here, and what changes for the audience. Introduce an entity through its role in the parent comparison before its detailed statistics. Merge adjacent pages that share a decision consequence unless each supplies distinct necessary evidence.

**Navigation.** When a visible tracker helps, map one parent tracker ID to each section and one chapter ID to each analytical subgroup, and record the applicable IDs on every dot. The section map is the only source of labels, order and membership.

## Approve it

For a new deck or a structural change, present the dot-dash and get the owner's confirmation before creating a slide file. Record the confirmation and the version it applies to. A standing instruction to proceed satisfies this within its stated scope.

Revise the affected rows in the same artifact so changes are easy to compare. An explicit user request to change an item authorizes that change directly. Seek approval again only for a material change outside the authorized scope.

For an existing deck, first write an as-is dot-dash with one dot per current slide, recording each slide's exact current title. A faithful authorized revision proceeds from that inventory when titles, order and structure stay the same; changing any of those returns to the approval step.

## Worked example: Australia Post

Public figures adapted from [SlideScience's dot-dash guide](https://slidescience.co/storytelling-in-powerpoint/). They demonstrate grammar, not a current view of Australia Post.

**Decision setup.** Communication job: decide whether further cost reduction can restore profitability. Governing answer: productivity is near its stated limits, so management must quantify revenue options before approving the recovery plan. Tracker: a compact number strip on analytical slides 3 to 5, because the plan has three named sections and consecutive evidence pages; none on the cover, summary or close.

**Section map.**

| Section | Slides | Purpose |
| --- | --- | --- |
| Answer | 1-2 | Frame the decision and answer it. |
| Evidence | 3-5 | Establish the gap and test cost headroom. |
| Action | 6 | Set the next decision gate. |

**Stage one — content.** `deck.content.json`, presented one block per page.
Nothing here names a shape.

```json
{ "schema": "professional-slides.content/v1", "id": "australia-post",
  "question": "Can further cost reduction restore profitability?",
  "answer": "Productivity is near its stated limits, so quantify revenue options before approving the plan.",
  "pages": [
    { "n": 3,
      "claim": "Costs grew 9% against 5% revenue growth, moving FY22 into a $13bn loss",
      "settles": { "kind": "rate", "what": "annual revenue and cost growth, FY15-FY22, and the profit endpoints" },
      "adds": "No revenue scenario in the plan closes a gap of this shape without a network decision",
      "highlight": "$13bn loss" },
    { "n": 4,
      "claim": "Workforce reduction lifted output per employee close to the stated ceiling",
      "settles": { "kind": "comparison", "what": "workforce and mail per employee at FY19, FY22 and the stated ceiling" },
      "adds": "Only 5,000 pieces of headroom remain, so the next cost programme cannot come from labour",
      "highlight": "330,000 ceiling" },
    { "n": 5,
      "claim": "Processing and delivery unit costs already sit below the cited benchmarks",
      "settles": { "kind": "comparison", "what": "cost per piece at baseline, current and benchmark, for two activities" },
      "adds": "Beating the benchmark twice means the credible unit-cost case is exhausted, not that it is working",
      "highlight": "below benchmark" },
    { "n": 6,
      "claim": "Quantify revenue options before approving the recovery plan",
      "settles": { "kind": "structure", "what": "what each option must supply: contribution, feasibility, service impact, timing, owner, downside" },
      "adds": "Pause the approval if the options do not reconcile to the residual gap",
      "highlight": "reconcile to the residual gap" }
  ] }
```

Page 3's `adds` is the test to apply to every one of them. "Revenue grew 5% and
costs 9%" would have been the chart read back; "no revenue scenario closes a gap
of this shape" is what the chart cannot draw.

**Stage two — layout.** Only now, and reading `settles.kind`:

| # | Exhibit | Variant | Why | Architecture | Anchors | Insight |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | — | — | cover | `cover` | photo: a delivery round | none |
| 2 | `cards` | numbered, 3 | the answer, its proof and its condition | `exhibit-full` | icons: gap, ceiling, decision | filled |
| 3 | `chart.combo` | growth bars, profit line, bracket on the crossing | `rate` over eight years with two measures on one category set | `exhibit-left` | none | filled |
| 4 | `table` | harvey on headroom, 3×4 | `comparison` across three named states | `exhibit-left` | icons: workforce, output | outline |
| 5 | `table` | bar column on cost per piece, 2×4 | `comparison` of two activities against one benchmark | `exhibit-left` | none | outline |
| 6 | `framework` | six required inputs around the decision | `structure`: what an option owes before it is approved | `exhibit-top` | icons per input | filled |

Two things the pairing shows. Page 3's `rate` sends it to a combo rather than to
the two peer column charts an earlier version of this example specified — the
kind chose the exhibit, not the other way round. And pages 4 and 5 are both
`comparison` and both tables, so the variant column has to do the work of
telling them apart: harvey balls against a ceiling, an in-cell bar against a
benchmark. Two tables with the same columns and no variant is
`TABLE_SCHEMA_FLAT`.

**Parallelism check.** Each slide has one dot and substantive support. The spine moves answer, evidence, action. The section map matches the sequence. The tracker decision matches the length of the story.

## Narrative QA

- one governing answer;
- branches distinct and collectively sufficient;
- one job per slide, and every slide earns its place;
- evidence supports the title, verb for verb;
- uncertainty explicit and attached to the claim it limits;
- synthesis and close agree in scope, authority and qualification;
- navigation, when used, follows the story;
- every authored title traceable to its approved dot.
