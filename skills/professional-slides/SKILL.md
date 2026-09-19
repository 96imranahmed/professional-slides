---
name: professional-slides
description: Build, restructure or rewrite a slide deck as an argument - board decks, steerco and project updates, investor and pitch decks, commercial due diligence, executive summaries and pre-reads - and produce an editable .pptx. Covers storyline and action titles, the ghost deck, chart and table selection, page layout, and rendered verification. Use for "make me a deck/slides/presentation", "turn this analysis into slides", "restructure/rewrite/fix an existing deck", "write the storyline", "sharpen the titles", "build a pptx".
---

# Professional Slides

A deck is an argument that happens to be paginated. The reader gets the answer from the titles alone, read top to bottom like a memo, and verifies it from the exhibits. Everything else on the page exists to make one of those two jobs easier. So the order of work is: settle the answer, write the titles that carry it, choose the exhibit that proves each title, then draw the page.

## The one-minute version

1. Write the governing answer in one sentence: *After this deck the audience should decide ___ because ___.*
2. Write the title of every page, in order. Read them alone. If they do not resolve the question, the deck is not ready to build.
3. For each title, name the exhibit that proves it and the two or three numbers it carries.
4. Get that table approved. It is the ghost deck, and it is the only approval gate.
5. Build, render, verify, deliver.

Always generate PowerPoint through `runtime/build-deck.mjs` and deliver through
`runtime/deliver-deck.mjs`, using the skill's standard emitter. If the pipeline
fails, diagnose and repair its shared implementation or the invalid deck input,
then rebuild and verify. Never substitute a task-local exporter or bypass a
failed gate to produce a deliverable.

## Write the action title first

An action title states the finding, not the subject. Use the formula:

**[subject] [verb of change or state] [magnitude or comparator] [period or condition]**

Keep it to 14 words and two lines. The page proves the title; the title never exceeds what the page shows.

| Weak | Strong |
| --- | --- |
| Financial performance, 2015-2022 | Costs grew 9% a year against revenue's 5%, turning profit into loss by 2022 |
| Workforce and productivity | Workforce fell from 26,000 to 22,000 while mail per employee neared the 330,000 ceiling |
| Unit cost benchmarking | Processing and delivery unit costs already sit below benchmark, at 0.63 and 0.29 per piece |
| Next steps | Quantify revenue options before approving the recovery plan |
| The 45-minute limit looks plausible for some central-office journeys | Transit rides use only 15-28 of the 45 minutes; walking and waiting decide which locations qualify |
| Four neighborhoods offer distinct combinations of schools and everyday activity | All six locations clear the school screen; commute and rent cut the list to two |

**Match the verb to the evidence.** Measured exposure supports *is exposed*. A sensitivity supports *could reach*. A board minute supports *will proceed*. Two endpoints support *fell from A to B*; they do not support *is accelerating*, which needs the intervening periods. When the strongest verb the evidence supports is weaker than the one you want, either get the evidence or narrow the title.

**Replace hedges with the measured fact.** These words appear when the finding has not been written yet: *looks plausible, some, may, offers, distinct combinations, requires verification, potentially, a range of, various, considerations, insights, several factors*. Each one marks a place where a number, a comparator or a decision belongs.

**Give every page a distinct title.** Two titles that share most of their words describe one page; merge them. A title that restates the brief's question tells the reader nothing they did not bring with them.

**Chart headings are not titles.** A chart heading names the measure, the population and the period: `NYPD reported homicides, 2015-2025`. The statistics live on the marks and in the action title, so the heading stays true when the data updates. `NYPD: 382 to 305` belongs on the bars.

**The banner is one line.** Heading plus unit sit on a single line, the unit inline after the heading in grey: *Published annual pay for PM roles at AI labs, $k*. Two lines means the heading is carrying a qualification or the unit has become a sentence - `unit: "$k, published base-salary band"` is a note wearing a unit's clothes. Keep the unit to the unit (`$k`, `%`, `minutes`, `$m`), put the basis in `note`, and let the page gates tell you when the band fell back to two lines (`HEADING_WRAPS`). The two-line band exists for one case: peer charts in a row, where the stacked unit line keeps their headings aligned.

## Test the story before you build

Run these on the title list, before any page exists.

- **Vertical test.** Each title states a finding, and the page under it contains the proof of that finding and nothing that proves something else.
- **Horizontal test.** Read the titles alone as a memo. They must move from answer to proof to action and resolve the governing question. If the last title restates the first, the deck spent its pages without moving.
- **MECE test.** Sibling pages divide their parent question without overlap and without a gap that changes the answer. Enterprise, SMB and high-growth overlap: a high-growth enterprise account lands in two buckets, so a number counted once appears twice. Split by employee count, or by contract value, or by motion - one axis per level.
- **Deletion test.** Remove the page. If understanding and the ability to act are unchanged, merge it into its neighbour or drop it.
- **Scorecard-first rule.** When the brief is "choose among N options on K criteria", page 3 is the N x K scorecard. Column order follows the client's own ranking of the criteria; cells that fail a hard screen are struck. Every later page is one row or one column of that scorecard, expanded. This keeps the recommendation traceable to a comparison the reader has already seen.
- **Coverage rule.** Every criterion the client ranked gets at least one exhibit that compares all options on it. Page count follows the ranking: the first-ranked criterion gets the most pages. A criterion that decides the recommendation gets measured, not asserted.

## Ghost the deck

The ghost deck is one table, one row per page, and it is the approval gate. Write it before any file exists and revise it in place.

| # | Action title | Exhibit | Numbers it carries | So what | Criterion |
| --- | --- | --- | --- | --- | --- |
| 3 | All six locations clear the school screen; commute and rent cut the list to two | 6 x 4 scorecard, criteria in ranked order | 6 options, 4 criteria, 2 survivors | The decision is a commute-rent trade, not a schools question | all four |
| 4 | Transit rides use only 15-28 of the 45 minutes; walking and waiting decide which locations qualify | Stacked door-to-door bar, 6 locations, 45-min reference line | 15-28 min ride, 12-19 min walk+wait, 45-min limit | Two locations clear the limit door-to-door; the rest fail on access, not rail | commute (2nd) |
| 5 | Three of the six sit in districts above the citywide proficiency median | Dot plot, 6 locations against citywide median | 6 district scores, 1 median, 3 above | Schools do not separate the shortlist; stop spending pages on them | schools (1st) |
| 9 | Take Location B: it clears the commute limit at the lowest rent of the two survivors | Decision table, 2 survivors x 4 criteria, with the reversing condition | $3,950 vs $4,600 rent, 38 vs 43 min | Location A wins only if the office moves downtown | all four |

Record in the Exhibit column *why* that encoding was chosen when the choice is not obvious - "stacked, because the components are the finding". That sentence is the whole chart-selection record; it lives here and nowhere else.

## Choose the exhibit from the reader's question

| The reader's question | Exhibit |
| --- | --- |
| Which category is larger or smaller? | Sorted bar or column |
| How did this evolve across meaningful periods? | Line, when the trajectory is the finding |
| How does a total divide into parts? | Stacked bar or column |
| How does one small total split into a few familiar parts? | Pie or donut, two to five parts, by exception |
| How does a response mix differ across groups? | 100% stacked bars, one row per group |
| What explains the change from start to finish? | Waterfall that reconciles |
| How do two or three measures relate? | Scatter; bubble when a third measure sets the area |
| Where are the concentrations, gaps or priorities? | Heatmap or typed table |
| Which option wins on which criteria? | Typed comparison table, one row per option |
| Where is this happening? | Map, when position is the evidence |
| How do stages, phases or dependencies follow each other? | Process, roadmap, timeline or tree |
| How do current, emerging and future plays mature? | Horizons |

**Choose from the evidence you actually have.** One value per category, including a common future endpoint: bars on a common basis. One observed rate repeated forward: one bar per category, with the implication beside it. Only start and finish known: paired bars. Several observed periods or a published model: a line. Paired observations of two measured variables: a scatter. A calendar axis alone is not evidence of a trajectory.

**Meaningful-position gate.** Every plotted coordinate encodes a sourced measure, a documented calculation or an exact named category position. Both scatter axes carry real quantitative measures with units. Overlapping observations are resolved with transparency, multiplicity labels, aggregation or a different encoding, each of which preserves the true coordinates. A fabricated offset inside a category band is a blocking evidence defect, whatever the page looks like.

**Numbers go on marks, not in sentences.** A sentence that transcribes the chart doubles the reading and halves the exhibit. Replace *"Processing cost per piece fell from 0.70 to 0.63 and delivery from 0.34 to 0.29"* with two labelled endpoints on the bars and a title that carries the consequence: *Unit costs already sit below benchmark*.

**The number sits outside the mark.** A value label belongs past the end of its bar or above its column, in ink, on the page. Inside the bar in white it stops being a number the reader can scan and becomes part of the fill: the labels no longer line up, the shortest bars cannot hold one, and a printed or projected page loses them in the ink. The runtime stops the scale short of the plot edge so the longest bar's label has somewhere to go. Inside is for a stacked segment, which has no outside, and for a treemap tile, where the tile is the label's frame.

## Make the comparison decide something

Most weak pages are comparisons that never reach a verdict: two columns of examples, one per side, each labelled and captioned, and nothing that says which side is stronger on this criterion or what follows if it is. The reader leaves knowing the page was about X and Y, which the title had already told them.

A comparison page carries four things. Missing any one of them, it is a catalogue.

1. **The criterion**, named in the exhibit heading - *lifetime domestic gross*, *time to first response*, *cost per claim*. "Better" is not a criterion.
2. **The measure**, on marks: the same number for both sides on the same basis, with the basis stated where it is not obvious.
3. **The verdict**, in the action title: which side wins, by how much. *DC's standalone films outgross the MCU's by 12% per release* is a verdict; *Both publishers have strong standalone films* is a shrug.
4. **The condition that flips it**, in the so-what: how fragile the verdict is. *The lead reverses if the 2025 slate repeats.*

Where the evidence is genuinely qualitative - a tone, a mechanism, a style - the page still reaches a verdict: pick the dimension, describe both sides in the same words in the same order, and say which one the decision should follow. Two captions under two pictures state that both things exist; they do not compare them.

## Pictures are not evidence

A photograph earns its place when the picture is the thing being judged: the store format, the damaged asset, the packaging the customer sees, the site under discussion. Everywhere else it is decoration, and decoration is expensive - it takes the half of the page where the measurement belonged, and a reader who meets three picture pages in a row stops expecting an argument.

- Keep photographs to about three analytical pages in ten, and never two running. Covers, section dividers and the closing statement are free; a photograph is the right material for those.
- One picture beside the analysis is a figure. Four in a row with captions under them is a mood board. When the four pictures are examples of one claim, the claim is the page and the examples are a list.
- A picture page still argues: it carries a `soWhat`, an `insight` or a points column saying what the pictures prove. A caption names what you are looking at, which is not the same thing.
- Half the analytical pages or more should carry measurement - a chart, a table, measured tiles. When a claim seems unmeasurable, look again: scale, frequency, duration, cost and count almost always are.

**Where a picture does belong, three shapes hold it.** `pictures` is a list of one to five, each `{ path, alt, credit, label, text }`: one picture gives `picture-hero` (the subject on one side, the argument beside it), two give `picture-pair` (the two things side by side, a card each underneath), three to five give `picture-strip` (the cast, the market set, the product range). The `label` and the `text` are the card, and they are where the page argues - *Rent at 62% of the New York figure* is a card, *London* alone is a caption. The pictures take the height the cards do not, so they are the page rather than a band across the top of it. `photo` is the older spelling of the same hero page and still works.

**Where the pictures come from.** A picture is an authorized file beside the spec, registered with its source and rights, and `credit` points at that registration - the media component refuses a picture with no `alt` and no authorization, so an unregistered photograph cannot reach a page by accident. A `path` that does not resolve is an error, never a silent grey box. A picture you have not cleared yet is written as `{ alt: "what it will show", label, text }` with **no `path`**: it composes as the empty frame carrying that line, so the page lays out, measures and gates now and the gap is visible on the page instead of invisible in the plan. Where no picture is ever going to exist, the thing is not depictable after all - give the page icons instead, which need no rights at all, and say so in the plan with `anchors: false` or an icon name per item.

A picture page is held to a word floor scaled by the body its pictures leave it (`weight.json`'s `picture.shareMax` caps the relief at 60%), so `THIN_PAGE` does not ask a photograph page for a table's word count - and does not let a page grow its photograph instead of making its argument.

## Write the page

- Keep body copy to 100 words on an exhibit page and 140 on a text page. Beyond that the exhibit has stopped being the evidence.
- Add interpretation only where the title and exhibit leave something useful unsaid. A separate `soWhat` is optional. Two distinct insights may belong on one page; give each a clear relationship to its evidence and avoid repeating either in another callout or footer.
- Use one methodology footnote at source size, once per page, instead of repeating the caveat beside every number.
- Put instructions to the reader on the action page only. "First verify, then scout" is the close of a deck, not a caption on page 6.
- Write in full sentences with the connective words the reasoning needs.

| Instead of | Write |
| --- | --- |
| Further work may be required | Public evidence does not show retention |
| Hold. Wait for cash recovery. | We recommend holding the position until cash generation improves. |
| Simplify accelerated training | Make accelerated training easier to adopt |
| $8-12M annual potential over 18-24 months | $8-12M annually; 18-24 months to implement |
| 1939 • Marvel Comics #1 | Marvel Comics #1 (1939) |
| SUPERMAN • Hope | Superman, on hope |
| Sources: NYPD • 8 Sep 2026 • links in notes | Sources: NYPD, 8 Sep 2026; links in notes |

**No dot separators.** A bullet or middle dot between two labels - `1939 • Marvel Comics #1`, `Anthropic · Research`, `Investor pulse · Q4` - is a tic that spreads: once one eyebrow has it, every eyebrow gets it, and the deck reads as a menu. Put the qualifier in brackets, after a comma, on its own eyebrow line, or in a column of its own. Bullets open list items; they do not join words. The page gates report every line that uses one.

## The page

**Tables are not all the same table.** The runtime picks a treatment from the content and you can force one with `treatment`/`variant` or object columns:

| Content | Treatment | What it draws |
| --- | --- | --- |
| Sequence: rows numbered, or a Stage / Step / Phase first column | `categories` | filled first-column boxes, each with a numbered disc at its left edge on the label's centre line |
| Scorecard: criteria × options, four or more columns | `standard` | filled header row, bold criteria column |
| Decision: last column is Decision / Then / So what | `standard` + `highlight` cells | filled header, tinted decision column |
| Listing: everything else | `open` | rules only |
| Ratings or scores across options | `comparison-table` with `selectedColumn`; `harvey`, `binary`, `heatmap` or `bars` cell types | Harvey balls, ticks, heat or in-cell bars |

**A table goes denser before it splits.** The runtime measures the table at body, compact and dense type against the page's own budget and takes the first that fits: a fourteen-row table is one page set compact, not two pages of seven, and the reference decks run tables to twenty and thirty rows rather than halving them. A cell at dense density sets at 9pt, which the type gate allows for table text and nothing else. `density` on the exhibit still wins, and a table past what the densest page can hold paginates as before, header repeated and title marked (1/2), (2/2).

Vary deliberately across the deck, never within a page: every table in the deck drawn the same way is wrong, and so are two treatments side by side. Two tables share a page only when they read as one design and both are light (five rows or fewer, no cell over 60 characters); otherwise the composer gives each table its own page under the same title marked (1/2), (2/2), with the points on the first page. An explicitly supplied `soWhat` is copied to each generated page; omit it when that repetition adds nothing. Prefer writing separate pages yourself. Columns are weighted by their longest content, so a "Year 1" column stays narrow; a table that fills its frame stretches its rows into bands and centres every cell on the row.

**Row rule.** Every panel that sits beside another carries a heading band, and all the bands in a row share one rule line; content starts level below it. A chart brings its own heading; a table, image or list beside it gets a `panelHeading`, and without one the band stays blank so the rule still lines up - it never repeats the table's own first column label back at the reader. The blank band is only ever there for that alignment: when nothing beside the exhibit carries a heading either, there is no band and no rule, because an empty band is a line and a gap that say nothing. A table on its own gets no heading: the action title and its header row are enough. Tables in one row share one type size. Nothing in a row aligns to the heading *text* of its neighbour, only to the rule.

- Canvas 1280 x 720 px, 60 px outer margins.
- 12-column grid: 82 px columns, 16 px gutters.
- Action title 24 pt, at most two lines, with the right 20% of the title band reserved for a tracker or sticker.
- Headings 14-16 pt. Body 12-14 pt. Chart furniture - axis ticks, direct labels, legends - 9-10 pt. Source 8 pt.
- A hero exhibit occupies at least 40% of the content area on an analytical page.
- At most 35% of pages share one layout; a run longer than that means several pages are asking the same question.
- Build the deck from at least three families of page - a chart page, a table or scorecard, a two-column comparison, a framework, a picture page - and let the mix follow the questions, not the template. Ten pages of the same construction is one page shown ten times.
- A lone big number belongs beside the evidence that proves it (`kpi` in the side column), not stacked above a table, where it floats in air and the table starts the page again underneath. Three or more tiles read as a strip of measures and can sit above the exhibit.
- The commentary column is a track, not a shelf: it reaches the bottom of the exhibit beside it. Write three to five points as a lead and a sentence each (a three-word label in a 360px column leaves two fifths of it white), add the number the chart proves as a `kpi` and the consequence as `soWhat`. A column that still has nothing to say should be narrower - the runtime narrows it and gives the width to the exhibit - or absent.
- Past a dozen analytical pages the reader needs to know where they are: two to five sections, and a tracker. Decks with sections get the section pills above the title by default; `agenda: true` tracks instead by repeating the contents page, current section tinted, before each section.
- Trailing empty band at the bottom of the content area: 8% or less. More than that means the exhibit should be larger or the page should merge with its neighbour.

## One page, rewritten

**Before.** Title: *The 45-minute limit looks plausible for some central-office journeys.* Body: four paragraphs, 210 words, explaining that transit times vary, that walking times were not measured, and that the reader should verify their own commute. Exhibit: a 180 px bar chart of rail travel time for three of the six locations, no reference line.

**After.** Title: *Transit rides use only 15-28 of the 45 minutes; walking and waiting decide which locations qualify.* Exhibit: one stacked horizontal bar per location, all six, segments for walk-to-station, wait, ride, walk-to-office, with a vertical 45-minute reference line and the two qualifying bars in the primary colour. The bar occupies 60% of the content area. Body, 60 words: the ride is the smallest segment in every location; access adds 12-19 minutes; two locations clear the limit door-to-door; the rank changes from the rail-only view, which is why the rail-only view is not the screen. One footnote: schedule basis and time of day. The page ends on the consequence, not on the caveat.

## Write the spec, then build

The runtime takes `professional-slides.deck/v3`: content and intent only, about ten fields per page. Layout, sizes, density and nesting are derived from what the page carries.

```json
{ "schema": "professional-slides.deck/v3", "id": "australia-post", "palette": "mckinsey",
  "brief": "…the client's brief…", "answer": "…the governing answer in one sentence…",
  "footer": "Australia Post, steering committee", "agenda": "once",
  "cover": { "title": "Returning Australia Post to profit", "subtitle": "Steering committee", "date": "March 2023", "logo": "Australia Post" },
  "slides": [
    { "kind": "section", "title": "Where the money goes", "summary": "Costs, volumes and the network" },
    { "title": "Costs grew 9% against 5% revenue growth, moving FY22 into a $13bn loss", "tag": "Preliminary",
      "exhibit": { "type": "chart.line", "heading": "Revenue and cost, FY15–FY22", "unit": "$bn",
                   "categories": ["FY15", "FY18", "FY22"],
                   "series": [{ "name": "Revenue", "values": [6.4, 6.9, 8.4] }, { "name": "Cost", "values": [6.2, 6.8, 8.6] }] },
      "points": ["Letters volume fell 8% a year while the network was kept whole", "Parcels grew but at half the margin"],
      "soWhat": "The gap is structural: no revenue scenario closes it without a network decision.",
      "note": "FY22 excludes the one-off restructuring charge", "source": "Australia Post annual reports FY15–FY22" },
    { "title": "…", "exhibits": [ { "type": "table", "panelHeading": "…", "columns": ["…"], "rows": [["…"]] }, { "type": "chart.column", "panelHeading": "…", "…": "…" } ], "soWhat": "…" },
    { "kind": "section", "title": "What it would take" }
  ] }
```

**Deck.** `appendix: [ … ]` carries the source pages behind the story - the model grid, the table in full, the survey instrument - behind an Appendix divider at `density: "appendix"`, where the reference decks keep their densest pages. `footer` is the document title printed beside the page number on every page. `agenda: true` inserts a Contents page before the first section and an Agenda page (current section tinted) before each later one; `"once"` inserts only the Contents page. Section slides take a `summary` that becomes the agenda detail column. `logo` names the mark for the cover's top-left corner.

**Cover.** `title`, `subtitle`, `date`, `logo`; dark by default, `tone: "light"` for the plain cover. `image` (`{ path, alt, credit }`) sets the photo cover: the photograph fills the right half, cropped to fit, beside a white title half (`tone: "dark"` paints it navy, the 2020 McKinsey/BCG cover); `layout: "full"` runs the photograph across the page with the title on a white or navy card in the lower left (the 2023–24 BCG/Bain cover). A section slide takes the same `image`: the title panel keeps the left 42%, the photo the rest, and a numbered divider sets its numeral above the title. `kind: "takeaways"` closes the deck with the messages as big numerals on navy (`points`, two to five; optional `title`, `image`, `tone: "light"`); `kind: "statement"` sets one sentence large and centred (`text`, `accent` phrase or phrases in the accent, optional `subtext`, `tone: "dark"`, or `image` for the sentence on a navy card over a photograph); `agendaStyle: "columns"` sets the Contents page as 01 / 02 / 03 columns with the current section in the accent; `sectionTabs` puts the section pill tabs above the title of every page under a section, the current one filled - on by default once a deck has two sections and no `agenda`, and `sectionTabs: false` takes them off.

**Page.** `title` (two lines at 24pt; a third line drops to 22pt and the page gate reports it), one `exhibit` or several `exhibits`, `points`, `soWhat`, `source` and `note` (the "Source:" and "Note:" prefixes are added; `note` also takes a list, which prints as numbered notes), `tag` (a small right-aligned label above the title: *Preliminary*, *Illustrative*, *Draft*), `titleLead` (a word the title starts with, set in the accent colour), `callout` (a cream reading aid, `"text"` or `{ "lead", "text", "tone": "caution" }`, placed above the points in a side column or under a full-width exhibit), `metrics` (a KPI strip above the exhibit, or below it with `metricsPosition: "bottom"`: `[{ "value", "label", "sublabel", "delta" }]`), `rows` (a label + text table with no other exhibit; `columns: ["Occupation", "What the data shows"]` heads its two columns, and a row that carries `cells` instead of `text` builds the findings matrix below), `subtitle` (the standfirst under the action title: what the page measures, over what population, for what period - *"Employment, growth and specialization by subsector, Washington DC, 2019-24"*. With one exhibit on the page the standfirst **is** the chart's title, so the exhibit's own heading band is dropped and its unit joins the standfirst), `kicker` (a two- or three-word label above the title naming the part of the argument this page belongs to - *People*, *Commercial evidence* - which the reference pages carry and we mostly do not; it takes the left of the tracker row, so a left-anchored tracker wins the slot and the kicker drops), `footnotes`, `arrange` (`stack`, `grid` or `row` when the automatic layout picks wrongly), `density`, `notes`, `tracker`. `paragraphs` carries body prose on a text page, as a list of paragraphs above whatever `points` the page also holds. `serves` names which of the deck's ranked criteria this page answers, so a reviewer can see which question is still unanswered. A section slide's `summary` is printed on its divider and in the agenda.

Points are strings or `{ "lead", "text", "icon", "state", "highlight" }`: a lead is set semibold before the text, an `icon` (from the 48-name vocabulary: target, rocket, people, gear, shield, clock, money, lightbulb, checklist, warning, growth, …) draws an outline marker, and `state: "yes"|"no"` draws a green tick or red cross. Points with leads and no icons get numbered discs; plain strings get dots. A list where every point carries an icon is set as an icon list: the glyph alone in the accent at nearly twice the text line, the text beside it, and a reading gap between the rows (`marker: "icon-ring"` keeps the older ringed marker). `highlight` names the phrase inside the point that reads in the house accent - *"**Improved quality of care** for patients"* - which is how the reference pages emphasise the finding inside a sentence instead of bolding the line or splitting it onto its own. It takes one phrase or several, and a phrase that does not occur in the point is an error rather than a silent no-op. `insight` sets one tonal box in the side column: `"text"` or `{ heading, text }`, centred on the exhibit, with no filler heading above it; `insights: ["…", "…"]` sets two: the first plain in the column, the second in the box under it - a reading and then its consequence, which is how a page carries two findings without a heading and three-word bullets. Two equal boxes with a gap between them read as two unrelated labels, so the composer does not make them. Use `points` for two or more distinct insights; the singular `insight` field is a component choice, not a limit on the page's reasoning. It may sit above points when their content is complementary. `pointsHeading` (default "What it means") heads the side column, `pointsHeading: false` drops the heading; `pointsAlign: "middle"` centres the points on the exhibit instead — which an unheaded column of two or three points now does by default, because three bullets hugging the top of a 500px track with the bottom half empty is the page that reads as unfinished. A headed column keeps its top, since the heading is what the eye starts from. `pointsStyle` sets how the column is marked, and the numbered disc is one of seven shapes rather than the default: `icon-lead` (an outline icon, then the lead running into its sentence in the accent), `icon-framed` (the icon in a ring, the lead on its own line above its evidence), `prose` (a bold lead and its paragraph, nothing in the gutter), `ruled` (a hairline between items instead of a mark beside them), `lettered` (A / B / C, for options rather than steps), `numbered` (the disc, which the reference decks reserve for an ordered ledger) and `bulleted` (the plain house bullet). Left unset the composer reads the content first - any point with an `icon` gives `icon-lead`, points that all carry a `number` or any `state` give `numbered`, points with no leads give `bulleted` - and where the content does not decide it rotates through `icon-lead`, `ruled`, `prose` and `numbered` by which was used longest ago, so a section does not run five identical numbered lists. `pointsTone` renders the side column as a panel the way the 2020–24 decks do: `dark` (the navy "Key insights" column, white text and reversed discs), `muted` (grey commentary), `tint` (an accent-tinted message) or `primary`. `photo` (`{ path, alt, credit }`) adds a photograph strip at the right edge of a chart page, or the right half of a text page, cropped to fill its column.

`soWhat` draws a separate closing strip only when supplied. Leave it out when the page already communicates its conclusion. `callout`, `insight`, `points` and `soWhat` are alternative placements, not a checklist of boxes to fill; use more than one only for distinct messages that benefit from those placements.

**Implication.** Evidence on the left, what it means on the right, and a marker between them: a filled disc with a chevron when the right column is a short centred insight, and a dashed vertical rule with that disc centred on it when the column runs the body's height (a heading, a toned panel, a photo strip). It is on by default on every exhibit-plus-column page; `implication: false` removes it. The same device turns on its side: on a page whose `metrics` sit above the evidence, `implication: true` draws the dashed rule *across* the page between the row of measures and what follows from them, with the chevron pointing down — the McKinsey "and therefore" band. That one is off unless asked for, because a page that puts numbers above their own detail is not making an inference.

**Density.** The firm pages are full: a chart, a full commentary column and the chart's own annotations, or a table of a dozen rows with a reading aid under it. Give every page enough content to fill its frame (three to five points beside a chart, not one; a `kpi` or `metrics` row where the story has a number; a `callout` under a full-width table) and let the page gates (ink coverage, dead band, internal void) report the pages that fall short.

**Exhibits.** `exhibit.type` is any registered component (`chart.column`, `chart.bar`, `chart.stacked-column`, `chart.line`, `chart.pie`, `chart.donut`, `chart.waterfall`, `chart.range`, `table`, `image` with a `path`, `metrics`, `timeline`, `matrix`, `gantt`, `cycle`, `steps`, `people`, `logos`, `framework`, `relationship-network`, `map`, …) or one of the composer aliases: `cards` (`items: [{ title, text|points, icon, value }]`, `tone: outline|header|numbered|plain|disc|big-number|dark|columns`), `quadrants` (`quadrants: [{ title, points }]`), `swot` (`strengths`, `weaknesses`, `opportunities`, `threats`), `compare` (`left`/`right` with `heading` and `points`; the after column is tinted, and `winner: "left" | "right" | "<heading>"` tints the side the page decides for instead, `winner: false` neither. A side may also carry an `image` (`{ path, alt, credit }`): the two pictures then sit above the two columns, aligned to them and sharing one height, which is how a comparison of two named things — two characters, two cities, two products — lets the reader tell them apart before reading a word. `imageHeight` sets the band, 180px by default), `phase-table` (`phases`, `rows: [{ label, cells }]`, chevron header), `rows` (`[{ label, text|points, number, icon }]`), and the **findings matrix**: `rows: [{ label, icon, cells: [ { lead, points, highlight }, … ] }]` with `columns: ["Challenge", "What 2023 showed", "What has to be true"]` - findings down the left with a numbered disc and an icon, two or three columns across, each cell a short bulleted list under a bold lead. It is the reference deck's densest page, 300-500 words of structured evidence and no chart, and it is what a deck of identical chart pages is missing. `chart.waffle`, `chart.bubble-grid`, `chart.marimekko`, `chart.slope`, `chart.lollipop`, `chart.dumbbell`, `chart.bullet`, `chart.treemap`, `chart.radar`, `chart.boxplot`, `chart.stacked-area`, `chart.sparklines`; `chart.combo` pairs bars with a line (`secondaryAxis: true` floats the line on its own scale above the bars, `secondaryUnit` suffixes its labels); `percent: true` on a stacked chart re-expresses each category as shares of 100. A table takes `derive: ["share", "rank", "change", "index"]`, which computes those columns from the table's own numbers (`deriveFrom` names the measure column, `deriveAgainst` the earlier column a change is measured against) and `total: true`, which closes it with the column sums. Ten rows and one derived column is ten more blocks of evidence and a second reading of the same data - the cheapest honest density a page can carry. A cell may carry `sub`, the qualifier printed under the measure in label type (*"10,156"* over *"+18% since 2014"*), which is blocks without another column. A `table` cell may be `{ "type": "harvey", "value": 0–4 }`, `{ "type": "binary", "value": "yes|no" }` or `{ "type": "heatmap", "value": 1–5 }` with default scales and their legend supplied. A `matrix` takes `xAxis`/`yAxis` (`label`, `minLabel`, `maxLabel`), `points` (`label`, `x`, `y` in 0–1), optional `quadrantLabels` and `highlightQuadrant`. Charts take `forecastFrom` (lighter fills from that category), `dataTable` (a value table hugged under the chart; `true` builds it from the chart's own series, and a document-weight deck - `elements: 2` or more - offers it automatically to a small chart that carries no other second element), `center` (a KPI in a donut's hole), `highlights`; a `chart.range` takes `low` and `high` series. Tables take `recommended: "<column>"` to tint the winning column in the accent, and infer status pills, progress bars and ticks from their cells (see the table menu above). A column may be an object: `{ group, label, unit, align }`. `group` bands a contiguous run of columns under one heading with its own rule (*Size | Growth | Specialization*), `unit` prints under the label at label size so the cells carry the number alone (*Jobs, 2019* over *#*), and a column that names either still takes its width from what it holds. Three flags on a column object treat it rather than describe it. `implication: true` marks the column that is the *conclusion* drawn from the columns before it - a "Verdict", a "So what" - and inserts a gutter of chevrons before it, so the page reads "evidence, then verdict" instead of offering a verdict as one more fact in an identical cell; `implicationStyle` picks `per-row` (a chevron on every row, where the eye can follow each line across) or `single` (a dashed rule down the gutter with one disc centred on the evidence it spans, stopping above a total row), defaulting to `per-row` at four rows or fewer and `single` at five or more — on a twelve-row scorecard a chevron parked on the middle row reads as a verdict on that row. An implication column cannot be the first column. `heat: true` fills every cell in the column on the sequential scale, which is how a benchmark table lets a reader find the leader without reading a number. `bubble: true` sets each value in a filled pill - the same device the chart's change annotation uses - so one column of a flat table carries the emphasis. A column headed *Verdict*, *Implication*, *So what*, *Recommendation*, *Decision* or *Takeaway* is marked as the implication automatically — the gutter of chevrons rather than one more identically-shaped cell — and a short table (four rows or fewer) whose last numeric column holds short values sets them in bubbles without being asked, because on a two-row table the figures are the page. Both are defaults the header and the data already implied; `implication: true` and `bubble: true` still say it by hand. `bar: true` draws the in-cell bar chart: a bar per row on one scale running from zero to a round number above the column's largest value, with the figure still printed beside it, so a magnitude reads down the column at a glance. A bar column needs a `label` and a `unit` (a bar without one is a length, not a measure), and a column takes one of the three treatments, not two. A cell takes `accent: "phrase"` for the phrase it sets in the house colour, and `footnotes` marks column headers and cells as readily as it marks points.

**Small multiples and captions.** `split: true` on a chart of two to four series sets one panel per series, each headed by its series name, all on one value scale, with the measure moving to the page's standfirst. `caption` on an exhibit prints that panel's finding in a statement box under it, and peers share one box height so their plots keep one baseline; a page captions its panels or carries a points column, not both.

**Category sub-labels.** `categoryNotes: ["n=412", "n=388", …]` prints a second line under each category label at label size: the base of the measure, the year, the unit of that column. The reference charts carry it and it is most of what separates their label band from ours. A chart that carries them is assembled as shapes rather than a native PowerPoint chart, because PowerPoint places its own category axis.

**The annotated map.** A `map` exhibit with `choropleth.labels.placement: "external"` sets each region's name in a lane beside the map with a leader drawn to it. Give a value a `note` and that lane carries the region's *sentence* under a bold name, and the lane widens to hold it: the map then is the page — boundary, value and what it means, keyed to the region — instead of a picture beside a column of paragraphs the reader has to match up. Any geography works, including one imported from your own GeoJSON (`import-geography.mjs`), which is how a page about boroughs, districts or territories gets real boundaries: [geography](references/geography.md) covers where to get them, converting a shapefile with `ogr2ogr` or `mapshaper`, simplifying them to slide size, the `id`/`name`/`labelPoint` each feature must carry, and the palettes they are coloured with.

**Time-series furniture.** `periods: [{ from, to, label }]` brackets runs of categories above a column or line chart ("Maturing market", "Covid-19 stimulus", "Market correction") with dashed dividers between them; `events: [{ at, label }]` drops a dashed line at a category from a short flag above the plot ("Mar 9: mask rationing introduced"). A dense line chart labels every nth period and keeps the first and last. `paired: true` on a `chart.bar` with two or three series sets one panel per series side by side, each on its own scale and headed by the series name, sharing the first panel's category column (the "share of commuters | share of residents" pair). `chart.bubble-grid` is the survey matrix: `rows` by `columns` with a `values` matrix, one bubble per cell sized by its count with the count inside. `segmentGrowth: { from, to }` on a stacked column prints the rate per segment beside the last stack (a CAGR when the categories are years, else the change) under a "CAGR 2019–23" heading. `chart.waffle` is the survey-deck dot pictogram: one dot per respondent per category with the count above (`percent: true` fills a 10×10 block per category). A column whose every cell is a scale word - Full, Strong, Partial, Weak, None, and the High/Medium/Low and Yes/Partial/No families - is drawn as **harvey balls** without being asked: a scale is compared by looking, not by reading five words to find the one that differs. It fires only when every cell in the column is accounted for and they are not all the same, so a column of prose containing "Strong" stays prose, and an authored treatment is left alone. A cell may instead be an explicit unknown — *Open*, *N/A*, *TBD*, *Unassessed*, *Pending*, an em dash — and up to a third of the column may be: those rows keep the author's own word as text beside the discs, because "not assessed" and "assessed at zero" are different findings and a page that mixes rated and unrated markets turns on the difference. Past a third the column is mostly blanks and is left as prose. A `cards` exhibit takes `columns: n` to wrap into rows - a set of named things has three shapes, not one: down the page as an icon list, across it as a row of cards, or as a grid. Points that all carry an `icon` and a `lead` take that route by count: three across, four to six as a grid of three, and otherwise the list. A table takes `highlightRow: "<first-cell label>"` to band the subject's row in the accent tint, and paginates by a line budget (a ranking table keeps a dozen one-line rows on a page). `metricsTone` sets the stat row: `ink` (black tiles, the value in the accent), `rule` (accent values left-aligned on no tile, the McKinsey "51 | 443 | 39" row; no hairline before the tile — the gap between peers on one baseline is what makes them a row), `ring` (a share as an accent arc around the value), `dark` or `tint`. A `metrics` exhibit with more than four `items` becomes a grid of equal rows (three by three for nine tiles; `columns` fixes the count). `chart.marimekko` draws columns as wide as their totals (or `widths`), each a 100% stack of its series with the total above. Table cells under an *Outlook* / *Trend* heading (`up`, `flat`, `down`, or arrows) become arrow rings, and signed values under a *Change* / *YoY* / *Growth* heading read in green or red. Under the BCG palette a `titleLead` sets the title as "Topic | statement".

**Growth indicators.** A chart that measures a change carries the change on the chart, the way the reference decks do. A single series over periods (years, FY, quarters, months, "Current/Future") gets an arrow from its first to its last mark with the change in a bubble (`+21%`, or `+8 pp` when the unit is a share); a line gets the bubble beside its last point; a stacked column gets the arrow across its totals; two series get a bracket per category with the gap (`+10 pp`) when the title names one (*beat*, *gap*, *points*, *vs*, *ahead*, *below*…). `cagr: { from, to }` puts the compound rate in the bubble (`+13% p.a.`); `change: { from, to, text? }` or `change: true` asks for the arrow explicitly; `change: false` turns it off. When a mark carries its value the value axis is dropped and the plot fits the data.

**Layout is derived.** One exhibit plus `points` gives a hero beside a headed side column (2:1 for a chart, 3:2 for a table) whose rule sits on the chart heading's rule; a diagram (cycle, steps, framework, network, cards, map…) carries no filler heading, so its points centre beside it instead; a single-series chart with three categories or fewer becomes a column of KPI tiles instead of a thin chart; two exhibits give a two-up row on one value scale and one plot frame, two charts on the same categories over `points` stack, four or more form a grid — but only between peers: a row the composer chose for itself never mixes a **figure** (a staircase, a cycle, a framework, a journey) with a **measured** exhibit (a chart, a table, tiles), because the two are read in different ways and the page ends up with a join down the middle. Such a page splits, each half keeping its own grammar, titled `(1/2)`, `(2/2)`; `arrange` or an explicit `layout` is the author overriding that on purpose; a `metrics` strip above a single exhibit and no commentary is `metrics-over-exhibit` — the measures across the top, the exhibit taking the full width and the height they leave, which is as much a chart as a table; `points` alone give a text page, and points with leads become a numbered ledger of rows; a table paginates when its rows exceed the page's line budget and two tables of different treatment split, each page titled `(1/2)`, `(2/2)`. `stackWeights` sets the height shares of stacked exhibits and `pairedWeights` the width shares of paired ones, when an even split is the wrong reading.

**The page repertoire.** The shapes above are scored, not fallen through: every shape says whether it fits the page, and among the shapes that fit, the one used longest ago wins. That rotation is the deck's variety, and it is measured - the reference corpus runs about five distinct page architectures per ten analytical pages with no single shape over a quarter of them, and a deck that flattens below that is reported as `PAGE_SHAPE_FLAT`. The repertoire is `exhibit-left` (the workhorse: one exhibit, commentary beside it), `exhibit-right` (its mirror, for a page whose exhibit confirms a claim the commentary makes first), `exhibit-top` (the exhibit across the full width with two to four points in columns beneath it - the commonest reference shape, and the right one for a wide exhibit or parallel commentary), `hero-number` (one enormous `kpi` with its explanation and one supporting exhibit, for the page whose whole argument is a single figure), `split-tone` (two captioned exhibits, half the page on a tinted ground, for a comparison that genuinely has two sides), `two-up-contrast` (two captioned exhibits, no shared column), `two-up`, `stack`, `grid`, `exhibit-full`, `table-halves` (a ranking of ten rows or more and at most three short columns, cut down the middle and set as two panels side by side, each repeating the header, so the list still reads 1 to 12 from top left to bottom right instead of running down the centre of an empty page) and `text`. `layout` names one of them outright when the automatic choice is wrong, and `arrange` (`stack`, `grid`, `row`) settles only how multiple exhibits sit.

```bash
node runtime/build-deck.mjs deck.json out/ --preflight   # story gates only: titles, hedges, words, monotony
node runtime/build-deck.mjs deck.json out/               # scene → editable pptx → LibreOffice render → readback → page gates
node runtime/deliver-deck.mjs deck.json out/             # + review; hands over out/<id>-DELIVERED.pptx only if accepted
```

Build takes a few seconds; the render is the slow step (LibreOffice, ~3 s for ten pages). Delivery refuses a deck that fails the page gates or the review and writes `out/REJECTED.md` with the blockers instead of a deliverable. In an agent session the review runs as a packet: read `out/review-packet/prompt.md` and the renders, write `out/review.json` to its schema, then rerun delivery with `--review out/review.json`. Flags and gate thresholds are in [production](references/tools/production.md).

## Look at it before you ship it

The build ends with `rendered/spread-N.png`: the deck at reading size, four pages
to a sheet, each page's number in its corner. **Open them.** Every defect this
skill has caught that mattered was caught by a person looking at rendered pages,
and never by a threshold — the gates found the geometry and a reader found that
the deck said nothing.

Then run the taste review: **one** subagent, one pass over the spreads, one
report back. Not a loop, not a page at a time — a reviewer who sees four pages
together sees the deck's grammar, which is where the damage is.

```
Read every spread in <out>/rendered/. Follow
skills/professional-slides/references/taste-review.md and references/design.md.
Return the JSON described there and nothing else.
```

It returns a rating out of ten, what the titles alone argue, the worst page, the
pages that could be deleted, and findings with page numbers. Treat `blocker` as a
build failure and `major` as fix-before-delivery, exactly like a gate finding.
Three decks in this repository passed every numeric gate and were rated 2 to 4
out of 10 by a first reader; the montage is what shows you which one you built.

## House style

The palette carries a house style, taken from the firms' 2022–24 published decks, so one deck reads as one house: `mckinsey` sets serif titles on a hairline rule, electric-blue accents, dash bullets and zebra tables; `bcg` sets regular-weight titles on a light grey band, a green pill for the page tag, grey chart-heading bands and green bar families; `bain` sets light titles, grey bars with the answer in red and regular value labels; `deloitte` sets black ink with the signature green. The style is a set of tokens (`style.titleWeight`, `style.titleRule`, `style.tagPlacement`, `style.chartHeading`, `style.listMarker`, `style.tableRows`, `style.labelWeight`) that components read; a deck's `typography` block still overrides the faces.

Modern pages carry their numbers as furniture, not prose: a delta column beside a ranked bar (`deltas: [+2, +14, …]` with `deltasLabel`), a bracketed subtotal beside a stack (`stackBracket: ["Somewhat agree", "Strongly agree"]`), period-to-period brackets on small multiples (`change: "steps"`), a hero number beside the chart (`kpi: { value: "80%", label: "…" }`), stat cards (`cards`, `tone: "stat"`, each `value` | statement, with an optional `question` panel at the left) and an accent-outlined insight (`callout: { tone: "outline", text }`).

## Choosing among 26 chart types

The catalogue covers the consulting repertoire; pick by the reader's question. *How much, by category:* `chart.column` (few categories, periods), `chart.bar` (many categories, long labels; `paired: true` for two measures on one category column), `chart.lollipop` (a ranked list of many). *How it is composed:* `chart.stacked-column` / `chart.stacked-bar` (`percent: true` for shares, `stackBracket`, `segmentGrowth`), `chart.marimekko` (composition and size together), `chart.treemap` (many parts of a whole), `chart.pie` / `chart.donut` (up to five parts). *How it changed:* `chart.line` / `chart.area` (`periods`, `events`), `chart.stacked-area` (a growing total by part), `chart.waterfall` (from one figure to another), `chart.slope` (two periods, many series), `chart.dumbbell` (before and after by category), `chart.combo` (a level and a rate). *How it is distributed:* `chart.boxplot`, `chart.range`, `chart.scatter` / `chart.bubble`, `chart.bubble-grid` (counts in a matrix), `chart.waffle` (one dot per unit). *Against a target:* `chart.bullet` (actual, target, graded band), `metrics` with `metricsTone: "ring"`. *A profile:* `chart.radar` (three to eight dimensions, a focus series against a peer). *Many small series:* `chart.sparklines` (a grid of small lines with the last value), `chart.horizons`. Every chart takes `heading` and `unit`, `highlights` / `focusSeries` for the answer, and draws the value on the mark rather than on an axis when every mark is labelled.

## Building from a template deck

When the client or the firm supplies a template `.pptx`, read it first and let the deck inherit its house: `python3 runtime/import-template.py template.pptx --base bcg` writes `template.house.json`, a `professional-slides.house/v1` profile, and prints what it inferred. The profile carries a palette overlay on the nearest built-in base (ink, primary, accent and their tints, the six chart series, the muted surface, taken from the theme's colour scheme or, when the theme is stock Office, from the fills the slides actually use), the display and body faces (installed faces only; an uninstalled face is reported), the chrome (left and right margins, title top, body top and footer top on the 1280 × 720 page, read from the title and body placeholders), the repeated footer copy as the deck's `footer`, a density profile from the median words and shapes per slide (`live-pitch` / `executive` / `pre-read`) and a complexity reading. The profile also carries the house's **weight**: the importer measures the template's own median words a slide, shapes a slide and body coverage, and writes `fill` plus the `weight` block, so a deck built on a dense house is held to that house's density and a deck built on a sparse one is not. Read the `observations` before building: they say which values were measured and which were guessed, including how the weight was derived. Then set `"template": "template.house.json"` on the deck; the profile fills `palette`, `typography`, `chrome`, `pageTemplate`, `density` and `footer` wherever the spec leaves them unset, and a hand-set `palette` or `chrome` still wins. Edit the profile when a guess is wrong (an accent the importer took from a highlight, a body top set by a subtitle placeholder the deck will not use); it is plain JSON.

## How full a page reads

A full page is not a crowded page. The floors come from **real client-project decks** - 3,606 analytical pages from 28 BCG, McKinsey and Bain engagement decks, with covers, dividers, back matter and portrait documents excluded. Published thought leadership is measured beside them (12,678 pages, twelve firms) and recorded as a contrast, not as the bar: its page geometry is almost identical, its craft is looser.

| Per analytical page | Client decks | Published work | What the gate does with it |
| --- | --- | --- | --- |
| Ink on the page | median 18%, quartiles 12% and 27% | 19% | `INK_COVERAGE` floors at a percentile of this: 11% for a deck that declares `full`, 8% for `balanced`, 5% for `airy` |
| Words of page text | 189 (p20 110, p80 290) | 198 | `WORDS` caps, by profile |
| - in the title band | 18 | 17 | `TITLE_LINES`, `TITLE_WORDS` |
| - **in the body** | **148** | 157 | `THIN_PAGE` floors the body alone |
| - in the footer, source and notes | 13 | 12 | `NOTE_HEAVY` |
| Numeric tokens | 13 overall - 26 on a chart page, 20 on a table, 4 on a diagram | 11 | `NUMBERS_ON_PAGE`, by exhibit family |
| Drawn objects (marks, rules, brackets) | median 32 (p25 11, p75 88) | - | the cold-run scorer's `drawingsPerPage` |
| Pages carrying 186+ words | 51% | 54% | `DECK_FLAT`: a deck of uniformly light pages has not chosen |
| Pages carried by a chart | 30% | 37% | `plan.mix.chart` floors at 25% |
| Pages carried by a table | 20% | 11% | `plan.mix.table` caps at 30% - client work tables more than published work does |
| Pages carrying no exhibit at all | 25% | 30% | a page of type is a real page; `plan.mix.text` caps it at 35% |
| Titles that state a claim | 65% (89% on chart pages, 38% on table pages) | 55% | the house rule is every page; this is the gap to close |
| Pages with a commentary column | 33% (13% on pages of type) | 43% | it is not the default - see `storylining.md` |
| Charts carrying an annotation | **80%** | 63% | `plan.craft.chartAnnotated` floors at 65% |
| Tables carrying a treatment | **100%** (32 of 32) | 89% | `plan.craft.tableTreated` floors at 75% |

Those numbers are not prose: they live in `runtime/weight.json`, which the composer and the gates both read, this table is checked against that file, and `evals/corpus/` holds the script that measured them and the README that says what the measurement cannot see.

**The floor counts the body.** The title band, the source and the notes are not evidence, and a page that clears a page-wide floor on the strength of a third note has padded the wrong band: `THIN_PAGE` measures the body alone, and `NOTE_HEAVY` reports a page whose footer runs past a third of its text.

**Their pages are not more complex; their elements hold more.** Measured side by side, our pages carry the same number of panels (four vertical clusters of drawn objects against their four), the same number of bold headings in the body (19 against 19) and the same mix of labels, phrases and sentences. What differs is the count: 40 label blocks a page against our 25. That is more rows in the table, more categories in the chart, a value on every mark, a second line in the measure cell, a base under each category, one more point in the column - not a different page.

Read it carefully: our *body prose* already matches theirs. The gap is everything around the evidence - the labels on the marks, the units, the row headers, the numbered notes, the second cut of the measure. A ten-row table with four quantitative columns and four footnote markers is a normal page. Three charts side by side, each with its heading and unit, flanked by two statements that carry the numbers in words, is a normal page.

Look at the distribution rather than the median and the real gap appears: page text runs 104 words at the lower quintile, 185 at the median and 278 at the upper - and **two pages in five carry 200 words or more**. Our pages are not thin; our *decks* had no heavy page at all. A deck whose pages all weigh the same has not decided which pages matter, which is what the `DECK_FLAT` finding says.

### Four heavy-page shapes

The heavy page is usually one of four, and each is a `shape` the composer will build:

| `shape` | What it is | What it needs |
| --- | --- | --- |
| `executive-summary` | the opening page: the measures the answer rests on, then the findings that carry them | `metrics` and two to five `points` |
| `findings-matrix` | findings down the left, two or three columns of short bulleted evidence across; 300-500 words and no chart | `rows` with `cells` |
| `measure-table` | ten to fifteen rows, four to six measures under grouped headers with their units, footnote markers on the cells that need a basis | a `table` exhibit, `derive`, `total` |
| `model-page` | the assumptions grid behind a forecast | a chart plus its `dataTable` |
| `half-and-half` | a chart with its own callout on one side, six icon-led points on the other | an exhibit and `points` |

Write the `executive-summary` first: a deck of twelve analytical pages or more that opens with evidence instead of with its answer is reported as `NO_SUMMARY`, and one with sections and no contents page as `NO_CONTENTS`. `contents` and `tracker` are separate settings — the contents page says what the deck covers, the tracker says where you are in it — so a deck can have section pills *and* a contents page, which is what almost every reference deck does. `tracker` takes `"pills"` (every section as a pill at the right of the title band, the current one filled — the default, and the only one that shows the sections you are not in), `"label"` (the current section's name alone at the left), `"breadcrumb"` (*Contents / Where the value is*, also at the left), `"number-strip"` (1 2 3 4 on a rail at the left, the current one filled, for sections whose titles are too long to set as pills), `"repeat-contents"` (the contents page reprinted before each section) or `false`. The three left-anchored trackers take the slot the `kicker` would have used, so a page with both drops the kicker; a number strip needs three sections, and the rest work from two.

Naming the shape sets the page's own weight and the defaults that shape needs, so a page that means to be the deck's heavy one does not have to be assembled key by key.

### What belongs on a full page

So the instinct to "keep it clean" is usually the instinct to hand the reader less evidence than the analysis produced. Give the page everything that is *load-bearing*:

- **The rows behind the summary.** If the table has four rows because you summarised twelve, show the twelve and band the three that decide it.
- **The second cut.** The same measure by segment, by region, by year - beside the first, on the same scale, so the reader can see that the finding holds. `dataTable: true` on a chart tabulates its own series underneath it: the same numbers, printed, which is the cheapest second element a page can carry.
- **The numbers on the marks.** A labelled bar is one reading; a bar plus an axis is two.
- **The commentary column in full sentences.** A lead and a sentence per point, not a three-word label. Three labels in a 360px column leave two fifths of it white. Two findings and no list is `insights: ["...", "..."]`, a plain statement above a boxed one, not one box floating in the middle of the track.
- **The second reading of the same numbers.** `derive: ["share", "rank", "change"]` on a table, `total: true` under it, `sub` inside the measure cell, `dataTable: true` under a chart. None of it invents data: it prints what the table already holds, which is where a reference page finds its fifth and sixth columns.
- **The band furniture.** The reference pages name the part of the argument above the title (`kicker: "People"`), head every column of a label table (`columns: ["Occupation", "What the data shows"]`) and unit every measure. It is a dozen words a page, set small, and it is most of the gap between their text-block count and ours.
- **The basis.** A footnote that says what is included, what is excluded, and as at when. It costs a line and it is the difference between a claim and an assertion. `footnotes: [{ on: "2022", text: "2022 includes two $4B+ deals that did not repeat" }, { text: "Values are announced enterprise values" }]` prints a superscript against that label - a category, a series, a column, a cell, a point - and the numbered notes under the page. `note` also takes a plain list when nothing needs marking. The reference pages carry two to four.

What does *not* belong is padding: a sentence that transcribes the chart, a caption that names what the reader can see, a heading that says "What it means" above three words, a fourth decorative photograph. Every gate in this skill is a floor on evidence and a ceiling on prose, in that order: `THIN_PAGE`, `THIN_COLUMN`, `POINT_DEPTH`, `THIN_TABLE`, `PLOT_SPAN`, `NUMBERS_ON_MARKS` (every mark carries its value while a chart has twelve marks or fewer) and `UNANNOTATED` (a plot with no bracket, flag, change bubble or base) fire when the page is carrying less than the deck said it would; `DECK_FLAT` when no page in the deck carries the detail; `THIN_PLAN` reports the same shortfall at plan time, with the remedy that page's own data offers; `WORDS`, `CPL`, `NOTE_HEAVY` and `TITLE_WORDS` fire when prose, or a note block, is doing an exhibit's job. A page that trips none of them is dense in evidence and lean in words, which is what a firm page is.

## Density, fill and the weight contract

Three settings govern how full a deck reads, from coarsest to finest, and each falls back to the one above it.

**`density`** sets type, spacing and chrome. `executive` is the default. Use `pre-read` when the document is read unattended and the page must stand without narration. Use `live-pitch` only when the deck is presented and the words are spoken aloud; an analytical brief uses `executive` or `pre-read`. `appendix` is for source-rich support behind the main story. Choose once per coherent family of pages.

**`fill`** takes `full`, `balanced` or `airy`, and follows the density when unset (`pre-read` and `appendix` fill, `live-pitch` is airy, `executive` is balanced). On a `full` deck the side column's points spread down the column instead of hugging its top, and the geometric gates tighten: ink coverage 14%, trailing band 6%, internal void 16%, and a `COLUMN_VOID` finding when the right column stops more than a fifth of the page above the footer - the commonest way a page reads empty while the page-wide bands stay inside their limits. On an `airy` deck the same thresholds relax (5%, 14%, 32%) and the column gate is off, so a live-pitch page can carry one chart and three words without argument.

**`weight`** says what a page must carry, and it is the same contract for every page of the deck, so one template governs density the way it governs colour.

```json
{ "fill": "full",
  "weight": { "pageWords": 130, "columnFill": 0.68, "plotSpan": 0.60, "pointWords": 10, "tableFill": 0.45, "elements": 2 } }
```

| Key | What it floors |
| --- | --- |
| `pageWords` | words in the **body** of a content page - the title band, source and notes excluded (`THIN_PAGE`) |
| `columnFill` | how far down its own track the commentary column must reach (`THIN_COLUMN`) |
| `pointWords` | mean words per point in that column, so points are findings and not labels (`POINT_DEPTH`) |
| `plotSpan` | how much of the exhibit frame the marks must span (`PLOT_SPAN`) |
| `tableFill` | how much of the page's row budget a table should use (`THIN_TABLE`) |
| `elements` | evidence elements on an analytical page; 2 on a document-weight deck (`THIN_EVIDENCE`) |

One floor is not a page's but the deck's: `DECK_FLAT` reports a deck of eight analytical pages or more where none carries 282 words (the corpus's upper quartile) and the eightieth percentile sits within a third of the median. The repair is a page that carries the detail, not a sentence added to every page.

`weight` resolves in three steps: the deck's own block, then the `weight` in the house profile a `template` produced, then the defaults for the deck's `fill` (full 120 / 0.68 / 0.60, balanced 95 / 0.55 / 0.52, airy off). The floors are body words against the reference corpus's own body median of 128. A deck that is not carrying a client argument - a style specimen, a component catalogue - says so with its own `weight` rather than being held to a client deck's floor. Every number is a floor, never a ceiling: the ceiling on prose is the `WORDS` gate and it has not moved. A catalogue of components or chart types declares `fill: "airy"` and the floors switch off.

Both the gates and the runtime read the same `runtime/weight.json`, so a change to a floor moves the composed page as well as the finding that reports it: on a deck that is not airy the side column spreads its points down its track, its width is negotiated against what it holds (a short column narrows and gives the width to the exhibit; a long one widens), and the bars thicken when there are few categories.

## Further detail

[Storylining](references/storylining.md) - hypothesis trees, the dot-dash, the Australia Post worked example.
[Taste review](references/taste-review.md) - the pass no threshold makes, as one subagent call over the rendered spreads.
[Charts](references/charts.md) - per-encoding data contracts and construction rules.
[Components](references/components.md) - the registered component set, props and when to use each.
[Copy](references/copy.md) - titles, body, labels, decision closes.
[Design](references/design.md) - grid, type, spacing, composition choices.
[Composition](references/composition.md) - layout primitives and recipes.
[Geography](references/geography.md) - where boundaries come from, shapefile to GeoJSON, what each feature must carry, and colouring it.
[Theming](references/theming.md) - palettes, tokens, density profiles.
[Templates](references/templates/index.md) - due diligence, progress update, pitch deck.
[Production](references/tools/production.md) - commands, gates, delivery.
[Evaluation](references/evaluation/index.md) - page gates and review codes.
