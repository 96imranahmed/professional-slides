# Rubric: classifying a published consulting page

Each image is one page from a published client deck by McKinsey, BCG, Bain, Accenture,
Deloitte, PwC/Strategy&, LEK, EY, KPMG, AT Kearney or Booz Allen. One page per deck,
264 decks. You are measuring what these firms actually put on a page — not judging it.

Read each image. Emit **one JSON object per page**, nothing else, in page order.

## Fields

- `page` — integer, from the filename (`page-042.jpg` → 42).
- `kind` — what the page is for, one of:
  - `"content"` — an ordinary argument page. **Only these get the rest of the fields.**
  - `"cover"`, `"divider"` (section break), `"agenda"` (contents / roadmap),
    `"backmatter"` (contacts, disclaimer, appendix marker, thank-you), `"unreadable"`.
- `family` — the page's dominant evidence, one of:
  - `"chart"` — any plotted data: bars, lines, pie, scatter, waterfall, bubble, map,
    gauge, area, radar, treemap, funnel drawn to scale.
  - `"table"` — a grid of rows and columns, ruled or unruled.
  - `"diagram"` — a drawn structure: boxes and arrows, matrix/2×2, framework, process
    chain, timeline, pyramid, venn, org chart, journey. Not plotted to scale.
  - `"picture"` — a photograph, screenshot, or product image carrying the page.
  - `"text"` — no exhibit at all: prose, bullets, quote blocks, numbered points,
    tinted cards of type. Icon-plus-label rows with no structure count as text.
  - `"mixed"` — two or more families of comparable weight (e.g. a chart and a table).
- `families` — array of every family present on the page (same vocabulary, no `mixed`).
- `exhibits` — integer: how many distinct exhibits the page carries (0 for a text page).

Then, judged only on what you can see:

- `titleIsClaim` — `true` when the headline asserts something that could be argued with
  ("Margin fell 4 points as freight repriced"), `false` when it labels a topic
  ("Margin overview", "Our approach", "Market size"). A title with a number in it is
  not automatically a claim; a title with a verb making a point is.
- `hasCommentary` — `true` when a text column, side panel, takeaway bar or annotation
  block sits alongside or under the exhibit and comments on it.
- `highlightedPhrase` — `true` when any phrase in the body is bolded, coloured,
  underlined or boxed for emphasis (not headings, not the title).
- `chartAnnotated` — for pages with a chart: `true` when the chart carries a callout
  box, leader line, arrow, bracket, CAGR pill, shaded band or emphasised mark beyond
  plain axes and a legend. `null` when there is no chart.
- `chartValues` — for pages with a chart: `true` when values are printed on or beside
  the marks (data labels), `false` when the reader must read the axis. `null` if none.
- `tableRows` — for pages with a table: the number of body rows (exclude the header).
  `null` when there is no table. If several tables, the largest.
- `tableTreated` — for pages with a table: `true` when the table does something beyond
  plain text in cells — shaded bands, colour-coded or traffic-light cells, harvey balls,
  icons, arrows, in-cell bars, a highlighted row or column, a total row set apart.
  `null` when there is no table.
- `sourceLine` — `true` when a source or note line appears at the foot of the page.
- `note` — at most 12 words, only when something is worth flagging. Otherwise `""`.

## Rules

- Judge the page as printed. Do not infer what the deck intended.
- When a page is genuinely ambiguous between two families, use `"mixed"` and list both
  in `families`.
- Do not skip a page. If an image will not open, emit `{"page": N, "kind": "unreadable"}`.
- Return **only** a JSON array of the objects — no prose, no markdown fence.
