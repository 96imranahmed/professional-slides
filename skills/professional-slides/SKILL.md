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

**Deck.** `footer` is the document title printed beside the page number on every page. `agenda: true` inserts a Contents page before the first section and an Agenda page (current section tinted) before each later one; `"once"` inserts only the Contents page. Section slides take a `summary` that becomes the agenda detail column. `logo` names the mark for the cover's top-left corner.

**Cover.** `title`, `subtitle`, `date`, `logo`; dark by default, `tone: "light"` for the plain cover. `image` (`{ path, alt, credit }`) sets the photo cover: the photograph fills the right half, cropped to fit, beside a white title half (`tone: "dark"` paints it navy, the 2020 McKinsey/BCG cover); `layout: "full"` runs the photograph across the page with the title on a white or navy card in the lower left (the 2023–24 BCG/Bain cover). A section slide takes the same `image`: the title panel keeps the left 42%, the photo the rest, and a numbered divider sets its numeral above the title. `kind: "takeaways"` closes the deck with the messages as big numerals on navy (`points`, two to five; optional `title`, `image`, `tone: "light"`); `kind: "statement"` sets one sentence large and centred (`text`, `accent` phrase or phrases in the accent, optional `subtext`, `tone: "dark"`, or `image` for the sentence on a navy card over a photograph); `agendaStyle: "columns"` sets the Contents page as 01 / 02 / 03 columns with the current section in the accent; `sectionTabs` puts the section pill tabs above the title of every page under a section, the current one filled - on by default once a deck has two sections and no `agenda`, and `sectionTabs: false` takes them off.

**Page.** `title` (two lines at 24pt; a third line drops to 22pt and the page gate reports it), one `exhibit` or several `exhibits`, `points`, `soWhat`, `source` and `note` (the "Source:" and "Note:" prefixes are added; `note` also takes a list, which prints as numbered notes), `tag` (a small right-aligned label above the title: *Preliminary*, *Illustrative*, *Draft*), `titleLead` (a word the title starts with, set in the accent colour), `callout` (a cream reading aid, `"text"` or `{ "lead", "text", "tone": "caution" }`, placed above the points in a side column or under a full-width exhibit), `metrics` (a KPI strip above the exhibit, or below it with `metricsPosition: "bottom"`: `[{ "value", "label", "sublabel", "delta" }]`), `rows` (a label + text table with no other exhibit; `columns: ["Occupation", "What the data shows"]` heads its two columns), `kicker` (a two- or three-word label above the title naming the part of the argument this page belongs to - *People*, *Commercial evidence* - which the reference pages carry and we mostly do not; it takes the left of the tracker row, so a left-anchored tracker wins the slot and the kicker drops), `footnotes`, `arrange` (`stack`, `grid` or `row` when the automatic layout picks wrongly), `density`, `notes`, `tracker`. A section slide's `summary` is printed on its divider and in the agenda.

Points are strings or `{ "lead", "text", "icon", "state" }`: a lead is set semibold before the text, an `icon` (from the 48-name vocabulary: target, rocket, people, gear, shield, clock, money, lightbulb, checklist, warning, growth, …) draws an outline marker, and `state: "yes"|"no"` draws a green tick or red cross. Points with leads and no icons get numbered discs; plain strings get dots. `insight` sets one tonal box in the side column: `"text"` or `{ heading, text }`, centred on the exhibit, with no filler heading above it; `insights: ["…", "…"]` sets two: the first plain in the column, the second in the box under it - a reading and then its consequence, which is how a page carries two findings without a heading and three-word bullets. Two equal boxes with a gap between them read as two unrelated labels, so the composer does not make them. Use `points` for two or more distinct insights; the singular `insight` field is a component choice, not a limit on the page's reasoning. It may sit above points when their content is complementary. `pointsHeading` (default "What it means") heads the side column, `pointsHeading: false` drops the heading; `pointsAlign: "middle"` centres the points on the exhibit instead. `pointsTone` renders the side column as a panel the way the 2020–24 decks do: `dark` (the navy "Key insights" column, white text and reversed discs), `muted` (grey commentary), `tint` (an accent-tinted message) or `primary`. `photo` (`{ path, alt, credit }`) adds a photograph strip at the right edge of a chart page, or the right half of a text page, cropped to fill its column.

`soWhat` draws a separate closing strip only when supplied. Leave it out when the page already communicates its conclusion. `callout`, `insight`, `points` and `soWhat` are alternative placements, not a checklist of boxes to fill; use more than one only for distinct messages that benefit from those placements.

**Implication.** Evidence on the left, what it means on the right, and a marker between them: a filled disc with a chevron when the right column is a short centred insight, and a dashed vertical rule with that disc centred on it when the column runs the body's height (a heading, a toned panel, a photo strip). It is on by default on every exhibit-plus-column page; `implication: false` removes it.

**Density.** The firm pages are full: a chart, a full commentary column and the chart's own annotations, or a table of a dozen rows with a reading aid under it. Give every page enough content to fill its frame (three to five points beside a chart, not one; a `kpi` or `metrics` row where the story has a number; a `callout` under a full-width table) and let the page gates (ink coverage, dead band, internal void) report the pages that fall short.

**Exhibits.** `exhibit.type` is any registered component (`chart.column`, `chart.bar`, `chart.stacked-column`, `chart.line`, `chart.pie`, `chart.donut`, `chart.waterfall`, `chart.range`, `table`, `image` with a `path`, `metrics`, `timeline`, `matrix`, `gantt`, `cycle`, `steps`, `people`, `logos`, `framework`, `relationship-network`, `map`, …) or one of the composer aliases: `cards` (`items: [{ title, text|points, icon, value }]`, `tone: outline|header|numbered|plain|disc|big-number|dark|columns`), `quadrants` (`quadrants: [{ title, points }]`), `swot` (`strengths`, `weaknesses`, `opportunities`, `threats`), `compare` (`left`/`right` with `heading` and `points`; the after column is tinted, and `winner: "left" | "right" | "<heading>"` tints the side the page decides for instead, `winner: false` neither), `phase-table` (`phases`, `rows: [{ label, cells }]`, chevron header), `rows` (`[{ label, text|points, number, icon }]`). `chart.waffle`, `chart.bubble-grid`, `chart.marimekko`, `chart.slope`, `chart.lollipop`, `chart.dumbbell`, `chart.bullet`, `chart.treemap`, `chart.radar`, `chart.boxplot`, `chart.stacked-area`, `chart.sparklines`; `chart.combo` pairs bars with a line (`secondaryAxis: true` floats the line on its own scale above the bars, `secondaryUnit` suffixes its labels); `percent: true` on a stacked chart re-expresses each category as shares of 100. A `table` cell may be `{ "type": "harvey", "value": 0–4 }`, `{ "type": "binary", "value": "yes|no" }` or `{ "type": "heatmap", "value": 1–5 }` with default scales and their legend supplied. A `matrix` takes `xAxis`/`yAxis` (`label`, `minLabel`, `maxLabel`), `points` (`label`, `x`, `y` in 0–1), optional `quadrantLabels` and `highlightQuadrant`. Charts take `forecastFrom` (lighter fills from that category), `dataTable` (a value table hugged under the chart; `true` builds it from the chart's own series, and a document-weight deck - `elements: 2` or more - offers it automatically to a small chart that carries no other second element), `center` (a KPI in a donut's hole), `highlights`; a `chart.range` takes `low` and `high` series. Tables take `recommended: "<column>"` to tint the winning column in the accent, and infer status pills, progress bars and ticks from their cells (see the table menu above).

**Time-series furniture.** `periods: [{ from, to, label }]` brackets runs of categories above a column or line chart ("Maturing market", "Covid-19 stimulus", "Market correction") with dashed dividers between them; `events: [{ at, label }]` drops a dashed line at a category from a short flag above the plot ("Mar 9: mask rationing introduced"). A dense line chart labels every nth period and keeps the first and last. `paired: true` on a `chart.bar` with two or three series sets one panel per series side by side, each on its own scale and headed by the series name, sharing the first panel's category column (the "share of commuters | share of residents" pair). `chart.bubble-grid` is the survey matrix: `rows` by `columns` with a `values` matrix, one bubble per cell sized by its count with the count inside. `segmentGrowth: { from, to }` on a stacked column prints the rate per segment beside the last stack (a CAGR when the categories are years, else the change) under a "CAGR 2019–23" heading. `chart.waffle` is the survey-deck dot pictogram: one dot per respondent per category with the count above (`percent: true` fills a 10×10 block per category). A table takes `highlightRow: "<first-cell label>"` to band the subject's row in the accent tint, and paginates by a line budget (a ranking table keeps a dozen one-line rows on a page). `metricsTone` sets the stat row: `ink` (black tiles, the value in the accent), `rule` (accent values left-aligned behind hairlines, the McKinsey "51 | 443 | 39" row), `ring` (a share as an accent arc around the value), `dark` or `tint`. A `metrics` exhibit with more than four `items` becomes a grid of equal rows (three by three for nine tiles; `columns` fixes the count). `chart.marimekko` draws columns as wide as their totals (or `widths`), each a 100% stack of its series with the total above. Table cells under an *Outlook* / *Trend* heading (`up`, `flat`, `down`, or arrows) become arrow rings, and signed values under a *Change* / *YoY* / *Growth* heading read in green or red. Under the BCG palette a `titleLead` sets the title as "Topic | statement".

**Growth indicators.** A chart that measures a change carries the change on the chart, the way the reference decks do. A single series over periods (years, FY, quarters, months, "Current/Future") gets an arrow from its first to its last mark with the change in a bubble (`+21%`, or `+8 pp` when the unit is a share); a line gets the bubble beside its last point; a stacked column gets the arrow across its totals; two series get a bracket per category with the gap (`+10 pp`) when the title names one (*beat*, *gap*, *points*, *vs*, *ahead*, *below*…). `cagr: { from, to }` puts the compound rate in the bubble (`+13% p.a.`); `change: { from, to, text? }` or `change: true` asks for the arrow explicitly; `change: false` turns it off. When a mark carries its value the value axis is dropped and the plot fits the data.

**Layout is derived.** One exhibit plus `points` gives a hero beside a headed side column (2:1 for a chart, 3:2 for a table) whose rule sits on the chart heading's rule; a diagram (cycle, steps, framework, network, cards, map…) carries no filler heading, so its points centre beside it instead; a single-series chart with three categories or fewer becomes a column of KPI tiles instead of a thin chart; two exhibits give a two-up row on one value scale and one plot frame, two charts on the same categories over `points` stack, four or more form a grid; `points` alone give a text page, and points with leads become a numbered ledger of rows; a table paginates when its rows exceed the page's line budget and two tables of different treatment split, each page titled `(1/2)`, `(2/2)`. `layout` overrides all of this (`exhibit-full`, `exhibit-left`, `exhibit-right`, `two-up`, `stack`, `grid`, `text`).

```bash
node runtime/build-deck.mjs deck.json out/ --preflight   # story gates only: titles, hedges, words, monotony
node runtime/build-deck.mjs deck.json out/               # scene → editable pptx → LibreOffice render → readback → page gates
node runtime/deliver-deck.mjs deck.json out/             # + review; hands over out/<id>-DELIVERED.pptx only if accepted
```

Build takes a few seconds; the render is the slow step (LibreOffice, ~3 s for ten pages). Delivery refuses a deck that fails the page gates or the review and writes `out/REJECTED.md` with the blockers instead of a deliverable. In an agent session the review runs as a packet: read `out/review-packet/prompt.md` and the renders, write `out/review.json` to its schema, then rerun delivery with `--review out/review.json`. Flags and gate thresholds are in [production](references/tools/production.md).

## House style

The palette carries a house style, taken from the firms' 2022–24 published decks, so one deck reads as one house: `mckinsey` sets serif titles on a hairline rule, electric-blue accents, dash bullets and zebra tables; `bcg` sets regular-weight titles on a light grey band, a green pill for the page tag, grey chart-heading bands and green bar families; `bain` sets light titles, grey bars with the answer in red and regular value labels; `deloitte` sets black ink with the signature green. The style is a set of tokens (`style.titleWeight`, `style.titleRule`, `style.tagPlacement`, `style.chartHeading`, `style.listMarker`, `style.tableRows`, `style.labelWeight`) that components read; a deck's `typography` block still overrides the faces.

Modern pages carry their numbers as furniture, not prose: a delta column beside a ranked bar (`deltas: [+2, +14, …]` with `deltasLabel`), a bracketed subtotal beside a stack (`stackBracket: ["Somewhat agree", "Strongly agree"]`), period-to-period brackets on small multiples (`change: "steps"`), a hero number beside the chart (`kpi: { value: "80%", label: "…" }`), stat cards (`cards`, `tone: "stat"`, each `value` | statement, with an optional `question` panel at the left) and an accent-outlined insight (`callout: { tone: "outline", text }`).

## Choosing among 26 chart types

The catalogue covers the consulting repertoire; pick by the reader's question. *How much, by category:* `chart.column` (few categories, periods), `chart.bar` (many categories, long labels; `paired: true` for two measures on one category column), `chart.lollipop` (a ranked list of many). *How it is composed:* `chart.stacked-column` / `chart.stacked-bar` (`percent: true` for shares, `stackBracket`, `segmentGrowth`), `chart.marimekko` (composition and size together), `chart.treemap` (many parts of a whole), `chart.pie` / `chart.donut` (up to five parts). *How it changed:* `chart.line` / `chart.area` (`periods`, `events`), `chart.stacked-area` (a growing total by part), `chart.waterfall` (from one figure to another), `chart.slope` (two periods, many series), `chart.dumbbell` (before and after by category), `chart.combo` (a level and a rate). *How it is distributed:* `chart.boxplot`, `chart.range`, `chart.scatter` / `chart.bubble`, `chart.bubble-grid` (counts in a matrix), `chart.waffle` (one dot per unit). *Against a target:* `chart.bullet` (actual, target, graded band), `metrics` with `metricsTone: "ring"`. *A profile:* `chart.radar` (three to eight dimensions, a focus series against a peer). *Many small series:* `chart.sparklines` (a grid of small lines with the last value), `chart.horizons`. Every chart takes `heading` and `unit`, `highlights` / `focusSeries` for the answer, and draws the value on the mark rather than on an axis when every mark is labelled.

## Building from a template deck

When the client or the firm supplies a template `.pptx`, read it first and let the deck inherit its house: `python3 runtime/import-template.py template.pptx --base bcg` writes `template.house.json`, a `professional-slides.house/v1` profile, and prints what it inferred. The profile carries a palette overlay on the nearest built-in base (ink, primary, accent and their tints, the six chart series, the muted surface, taken from the theme's colour scheme or, when the theme is stock Office, from the fills the slides actually use), the display and body faces (installed faces only; an uninstalled face is reported), the chrome (left and right margins, title top, body top and footer top on the 1280 × 720 page, read from the title and body placeholders), the repeated footer copy as the deck's `footer`, a density profile from the median words and shapes per slide (`live-pitch` / `executive` / `pre-read`) and a complexity reading. The profile also carries the house's **weight**: the importer measures the template's own median words a slide, shapes a slide and body coverage, and writes `fill` plus the `weight` block, so a deck built on a dense house is held to that house's density and a deck built on a sparse one is not. Read the `observations` before building: they say which values were measured and which were guessed, including how the weight was derived. Then set `"template": "template.house.json"` on the deck; the profile fills `palette`, `typography`, `chrome`, `pageTemplate`, `density` and `footer` wherever the spec leaves them unset, and a hand-set `palette` or `chrome` still wins. Edit the profile when a guess is wrong (an accent the importer took from a highlight, a body top set by a subtitle placeholder the deck will not use); it is plain JSON.

## Density is not the enemy

A full page is not a crowded page. Published McKinsey, BCG and Bain client decks - 1,832 pages measured for text, 192 of them measured page by page - run like this, against our own decks:

| Per analytical page | Reference | Ours today |
| --- | --- | --- |
| Ink on the page | 19% (quartiles 12% and 32%) | 15% |
| Words of page text | 181 | 108 |
| Discrete text blocks | 135 | 82 |
| Words set at 9pt or smaller (labels, units, notes) | 27 | 17 |
| Numeric tokens | 18 | 14 |
| Drawn objects (marks, rules, brackets) | 38 | 29 |

Read it carefully: our *body prose* already matches theirs. The gap is everything around the evidence - the labels on the marks, the units, the row headers, the numbered notes, the second cut of the measure. A ten-row table with four quantitative columns and four footnote markers is a normal page. Three charts side by side, each with its heading and unit, flanked by two statements that carry the numbers in words, is a normal page.

So the instinct to "keep it clean" is usually the instinct to hand the reader less evidence than the analysis produced. Give the page everything that is *load-bearing*:

- **The rows behind the summary.** If the table has four rows because you summarised twelve, show the twelve and band the three that decide it.
- **The second cut.** The same measure by segment, by region, by year - beside the first, on the same scale, so the reader can see that the finding holds. `dataTable: true` on a chart tabulates its own series underneath it: the same numbers, printed, which is the cheapest second element a page can carry.
- **The numbers on the marks.** A labelled bar is one reading; a bar plus an axis is two.
- **The commentary column in full sentences.** A lead and a sentence per point, not a three-word label. Three labels in a 360px column leave two fifths of it white. Two findings and no list is `insights: ["…", "…"]`, a plain statement above a boxed one, not one box floating in the middle of the track.
- **The band furniture.** The reference pages name the part of the argument above the title (`kicker: "People"`), head every column of a label table (`columns: ["Occupation", "What the data shows"]`) and unit every measure. It is a dozen words a page, set small, and it is most of the gap between their text-block count and ours.
- **The basis.** A footnote that says what is included, what is excluded, and as at when. It costs a line and it is the difference between a claim and an assertion. `footnotes: [{ on: "2022", text: "2022 includes two $4B+ deals that did not repeat" }, { text: "Values are announced enterprise values" }]` prints a superscript against that label - a category, a series, a column, a cell, a point - and the numbered notes under the page. `note` also takes a plain list when nothing needs marking. The reference pages carry two to four.

What does *not* belong is padding: a sentence that transcribes the chart, a caption that names what the reader can see, a heading that says "What it means" above three words, a fourth decorative photograph. Every gate in this skill is a floor on evidence and a ceiling on prose, in that order: `THIN_PAGE`, `THIN_COLUMN`, `POINT_DEPTH`, `THIN_TABLE`, `PLOT_SPAN` and `NUMBERS_ON_MARKS` fire when the page is carrying less than the deck said it would; `WORDS`, `CPL` and `TITLE_TOO_LONG` fire when prose is doing an exhibit's job. A page that trips none of them is dense in evidence and lean in words, which is what a firm page is.

## How full a page reads

Emptiness is right for some decks and wrong for others, so the deck says which it is. `fill` takes `full`, `balanced` or `airy`; absent, it follows the density (`pre-read` and `appendix` fill, `live-pitch` is airy, `executive` is balanced). On a `full` deck the side column's points spread down the column instead of hugging its top, and the page gates tighten: ink coverage 10%, trailing band 6%, internal void 16%, and a new COLUMN_VOID finding when the right column stops more than a fifth of the page above the footer — the commonest way a page reads empty while the page-wide bands stay inside their limits. On an `airy` deck the same three thresholds relax (4%, 14%, 32%) and the column gate is off, so a live-pitch page can carry one chart and three words without argument.

## The weight contract

`fill` says how full the pages read; `weight` says what a page must carry, and it is the same contract for every page of the deck, so one template governs density the way it governs colour.

```json
{ "fill": "full",
  "weight": { "pageWords": 130, "columnFill": 0.68, "plotSpan": 0.60, "pointWords": 10, "tableFill": 0.45, "elements": 2 } }
```

| Key | What it floors |
| --- | --- |
| `pageWords` | words of page text - everything printed - on a content page (`THIN_PAGE`) |
| `columnFill` | how far down its own track the commentary column must reach (`THIN_COLUMN`) |
| `pointWords` | mean words per point in that column, so points are findings and not labels (`POINT_DEPTH`) |
| `plotSpan` | how much of the exhibit frame the marks must span (`PLOT_SPAN`) |
| `tableFill` | how much of the page's row budget a table should use (`THIN_TABLE`) |
| `elements` | evidence elements on an analytical page; 2 on a document-weight deck (`THIN_EVIDENCE`) |

It resolves in three steps: the deck's own `weight`, then the `weight` in the house profile a `template` produced, then the defaults for the deck's `fill` (full 130 / 0.68 / 0.60, balanced 95 / 0.55 / 0.52, airy off). Every number is a floor, never a ceiling: the ceiling on prose is the `WORDS` gate and it has not moved. A catalogue of components or chart types declares `fill: "airy"` and the floors switch off - a page that exists to show one encoding is not carrying an argument.

Both the gates and the runtime read the same block, so a change to it moves the composed page as well as the finding: on a deck that is not airy the side column spreads its points down its track, its width is negotiated against what it holds (a short column narrows and gives the width to the exhibit; a long one widens), and the bars thicken when there are few categories.

## Density

`executive` is the default. Use `pre-read` when the document is read unattended and the page must stand without narration. Use `live-pitch` only when the deck is presented and the words are spoken aloud; an analytical brief uses `executive` or `pre-read`. `appendix` is for source-rich support behind the main story. Choose once per coherent family of pages and keep type, spacing and chrome on that one profile.

## Further detail

[Storylining](references/storylining.md) - hypothesis trees, the dot-dash, the Australia Post worked example.
[Charts](references/charts.md) - per-encoding data contracts and construction rules.
[Components](references/components.md) - the registered component set, props and when to use each.
[Copy](references/copy.md) - titles, body, labels, decision closes.
[Design](references/design.md) - grid, type, spacing, composition choices.
[Composition](references/composition.md) - layout primitives and recipes.
[Theming](references/theming.md) - palettes, tokens, density profiles.
[Templates](references/templates/index.md) - due diligence, progress update, pitch deck.
[Production](references/tools/production.md) - commands, gates, delivery.
[Evaluation](references/evaluation/index.md) - page gates and review codes.
