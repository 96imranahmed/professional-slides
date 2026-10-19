# Storylining

A storyline is the order in which one reader needs to hear an argument. Write it for the person who will read the deck, starting from what they already know, and settle it with the user before any page is drawn.

## Start from the reader

Ask before writing a title:

- **Who reads it, and how.** A board walked through it in twenty minutes, a team reading it alone, a room watching it presented. This sets how many pages and how much a page carries: its `density` is `live-pitch` for a room, `executive` for a deck presented or sent ahead, `pre-read` for one read alone (a reference deck's import may set it instead).
- **What they already know.** Their source, its terms, the method, the players. A benchmark summary for people who have never seen the benchmark first says what was measured and how it was scored; for the benchmark's own team it goes straight to the findings.
- **What it is for.** A decision, a recommendation, an update, an explanation.

Unless the request says, ask these three in one message, each with a recommended default. Do not guess the reader. The answers go in the storyline's `reader` (`audience`, `readerKnows`, `decision`, `density`), which `--scaffold` copies onto `deck`.

## The shape of a storyline

1. **The setup the reader needs.** Only what this reader lacks: what the subject is, how the evidence was gathered, what the terms mean. One to three pages for a reader new to the source; none for one who knows it. It opens on what is true and agreed (the situation), then what changed and why now (the complication): an answer to a question the reader has not been shown is a claim without a reason.
2. **The answer.** One sentence that answers the question, sharp enough to be wrong, and sized in the reader's terms - money, units or share, with a range; "considerable" is not yet an answer. It opens the deck as the executive summary's title, or the first finding's.
3. **The findings that prove it.** Three to five sections, each a claim that holds part of the answer up. Together they leave nothing needed to accept it; no two say the same thing. For a comparison, one section per criterion that decides it; for a recommendation, one per condition the choice depends on.
4. **Pages under each finding.** Each page title proves part of its section's claim. A page whose title does not prove its section's claim is in the wrong section, or the section is missing a claim.
5. **What follows.** The implication, the recommendation, the limits of the evidence and what would change the answer. Limits the source states itself take a page, not a footnote. The deck ends on the implication: its last page says what the reader should take away or do, not only what comes next.

Read the titles down the deck alone, as the reader in `readerKnows`: they should tell the whole argument, each following from the ones before. A term, actor or mechanism the reader first meets in a finding - "replacement" before anything says what is replaced, by when and why - is a missing setup page or a missing clause. Read each level across: the sections should not overlap and together should be enough.

## How many pages

Count them from the storyline: the executive summary; the setup this reader lacks; one page per distinct analysis each section's claim needs, usually two to four (a one-page section is a claim with one piece of evidence; a six-page section is two sections); one or two closing pages; and an appendix for method, sources and full tables. Then hold the count to the occasion - eight to fifteen body pages presented live, fifteen to thirty for a pre-read, thirty or more for a reference or diligence deck. A tree longer than the occasion moves detail to the appendix; a shorter one is missing analyses, not pages. When the user names a length, plan the analyses that fill it and say where it would pad. Never split one table or chart to make pages. The approval message states the count, its breakdown and one alternative length with what it drops or adds.

## Find the data first

The titles a deck can prove depend on the data it has. Before writing them, name for each section's claim the analyses that would convince a sceptic: **size** it in the reader's units; **split** it by segment, type, customer or region; **compare** it with every alternative the reader would name, not one; **trend** it, history and forecast; **explain** it - the drivers, as a bridge, a tree or a process. A claim with one analysis behind it is a hypothesis: give it a second cut, or narrow it. A chart of the deck's own arithmetic - one input times assumed rates - is a sensitivity, not evidence.

Read the source fully and collect what it measures: series over time, the whole set of members compared, shares, the steps of a change. With no source, research is the source, in two batches: one scan before the storyline, enough to form the answer and know what data exists; after approval, the datasets the approved analyses need, searched for together in a few parallel rounds, never page by page. Prefer the whole set - every type, every customer, every year - to a headline figure, and two independent sources for the figures the answer rests on. An analysis whose data cannot be found is dropped, and its claim narrows. Record each set of numbers in `<id>.insights.json` as a measure, and give every measure its `unit`, the `population` it describes and the `period` it is for (a series lists its `periods`); the compile refuses a measure without them:

```json
{ "schema": "professional-slides.insights/v1", "insights": [
  { "id": "i-scores", "finding": "Agent A scored highest on every task family",
    "measures": { "score": { "unit": "points", "population": "seven agents", "period": "pilot run",
      "members": ["A", "B", "C"], "values": [71, 64, 58] } }, "cite": ["benchmark"] } ] }
```

A page then prints the numbers by reference - an exhibit's `series: [{ "measure": "i-scores/score", "name": "Score" }]`, or `{{i-scores/score@A | 0}}` in any text - and the runtime writes them, so a number is typed once. A number typed on a page that matches no recorded value is advised (`NUMBER_UNTRACED`). Cite each source once in the pages file's `sources` registry and name it on the page by key (`source: ["benchmark"]`); the runtime writes the footer line from it, at the fullest form that fits.

## Titles

Each title states the finding, not the topic: the subject, what it did, and by how much or against what - in two lines at most, about ten words as the norm. The period, population and unit go in the exhibit's heading or its column heads. A page takes a `subtitle` only where the deck the user gave as the style to follow sets a line under its titles; otherwise it has none.

| Instead of | Write |
| --- | --- |
| Financial performance, 2015-2022 | Costs grew 9% a year against revenue's 5%, turning profit into loss by 2022 |
| Agent results | Agent A completed four tasks in five; the next best completed three |
| Runtime and score | The fastest agents scored no lower than the slowest |

Match the verb to the evidence: a measured result *is*, a sensitivity *could reach*, an approved plan *will*. Where the evidence is thinner than the wording, narrow the claim - a segment, a period, a softer verb - and keep its direction; the limitation goes in a note (or the subtitle, where the deck uses them), not in place of the finding. Hedges (*may*, *potentially*, *various*, *considerations*) mark a finding not yet written: replace each with the measured fact.

Structural pages keep their fixed heading: a contents page, a section divider, `Executive summary` or `Executive summary: <answer>`. A section divider (`kind: "section"`) is its title and numeral beside the deck's contents, with no paragraph; a `summary` is printed only as the section's detail on the contents page.

## The executive summary

A summary carries the answer and the case for it, in four to six developed statements: each a claim, the evidence for it, and what follows. The first states the situation and the question; the rest answer it, one per section, with the material limitation and what would change the answer. Read alone, it should let the reader explain the answer and the strongest case against it. Choose its form by what each statement carries. Statements of two or three lines, each read in turn as part of one argument, are `summary` form `executive-summary`. Statements that each have a short handle - a section, a criterion, a finding in four words - with two or three supporting points, or a figure, beside it are `parallel` form `labelled-rows`: the reader scans the labels, then reads the row that matters to them. Short statements set as developed points leave the foot of the page empty; labelled rows give each its own band.

## Body copy

- **A page says one thing.** The title is the claim; the exhibit is the evidence; the commentary says what the exhibit cannot - the mechanism, the cause, the consequence. It does not read the chart back.
- **Points are sentences**, each a claim with its evidence: "Agent A finished in half the time on the long tasks, where the others timed out" rather than "Agent A: faster".
- **Prose runs in short paragraphs**, each under a bold `lead` the reader can scan: `{ "lead": "Timing is the real exposure", "text": "..." }`.
- **Numbers are exact and consistent.** One figure has one value on every page, at one precision. Say the unit once, in the exhibit's heading.
- **Notes carry method and caveats**, in `note` or a footnote, not in the title or the points.
- **Labels are short**: a chart's heading names the measure and the population; an axis names its unit; a table's header names what its column holds.

## Approve the storyline

The `storyline` block of the pages file holds the argument (`catalog --type storyline --schema`); `storyline WORK` prints it as the approval message - the count and its breakdown, the reader, the tree, each page's comparison, candidate charts and data. Show it to the user and wait: they can reorder, cut, merge or add pages there, where it is cheap. A chart page's candidates are the charts that draw its claim, best first ([Drawing](drawing.md#pick-the-obvious-chart)); where the deck needs variety, take a page's next candidate, not a chart that draws its claim less directly.

A request to make a deck is not approval: approval is the user's reply to the storyline, or their explicit words that they do not want to see it, recorded verbatim with `--approve`. Once approved, write each page once; change a title afterwards only when the evidence changes. A page added or dropped is a new storyline to approve.

## Revising a deck

A change to an existing deck keeps everything the user did not ask to change. When a figure changes, every page that states it changes with it: the compile names the other pages that still state the old value (`NUMBER_STALE`) or the old words (`WORDING_STALE`). When the user's request reopens the argument - a new finding, a different answer - go back to the storyline, show the new titles, and only then redraw the pages.
