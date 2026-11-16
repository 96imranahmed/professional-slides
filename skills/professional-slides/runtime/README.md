# Runtime

The public entry point is `node runtime/command.mjs --help`, also exposed as `professional-slides` by npm. Prefer it for ordinary agent work; the lower-level commands below remain available for development. A local PowerPoint or LibreOffice installation and Poppler are required for public builds. See the root README for setup, slide options/redesign, image reconstruction and brand template flows.

Node lays the page out; Python writes, renders and checks the file. The order the commands run in is the [process](../SKILL.md#the-process); this page is the command and module map.

## Commands

```
node runtime/doctor.mjs [--json] [--no-render]
node runtime/preferences.mjs show | get [key] | set key=value ... | clear [key] | deck-keys | apply <id>.pages.json | path | from-site <url>
$RUNTIME_PYTHON runtime/import-deck.py deck.pptx out/ [--id <id>] [--carry] [--force]
$RUNTIME_PYTHON runtime/import-template.py template.pptx [--out house.json]
node runtime/author-deck.mjs --types | --icons | --schema [<type>[/<form>] | <kind> | kinds | deck]
node runtime/author-deck.mjs [<id>.pages.json] --example <type>[/<form>] | --scaffold <type>[/<form>] [--id <page-id>] | --limits [<type>[/<form>]]
node runtime/author-deck.mjs <id>.pages.json [--check [--render] [--page <id>[,<id>...]]] [--fetch-assets]
node runtime/build-deck.mjs <id>.deck.json out/ [--format pptx|html|both] [--no-fetch] [--no-render] [--preflight]
node runtime/variation.mjs [seed] [--design <system>]
```

`author-deck.mjs <id>.pages.json` compiles every page, binds its numbers to `<id>.insights.json`, composes the deck, runs the page checks and writes `<id>.deck.json`; `--check` does the same and writes nothing, and `--render` also renders the pages through the build's own stages. Every finding is listed in one run. `build-deck.mjs` emits `out/<id>.pptx`, renders it to `out/rendered/` (`<id>.pdf`, `slide-N.png`, `montage.png`), reads the saved file back and writes `out/build-result.json`. `--format html` writes `out/<id>.html` from the same scene instead, photographed by a headless browser into `out/rendered-html/` and held to the same page gates (`gates-html.json`), with no Office and no PowerPoint emitter involved; `--format both` writes the two side by side.

Every Node command reads its command line the same way (`cli.mjs`): an option's value is never another option; a refusal prints `Refused (CODE): <message>` with no stack; every JSON file the runtime writes is indented two spaces with a trailing newline.

## One scene, two outputs

The composed scene (`scene.json`) is the single source every output is written from. Each slide carries its primitives with resolved frames (`nodes`) and the layout tree those frames came from (`layout`), in CSS grid's vocabulary: a `row` is a grid of columns, a `column` a grid of rows, a `stack` one shared cell, a `grid` both, each with its resolved `tracks`, the tracks as written (`template`: `2fr 1fr`, `auto`), its `gap` and `padding`; a `component` or `section` box names the instance whose primitives it holds. The PowerPoint emitter reads the frames; the HTML emitter writes the tree as real `display:grid` containers and sets each component's primitives inside it, so a browser places every element where PowerPoint does (evals/tests/test_html_emit.py holds them within half a pixel) and the markup is containers, gaps and tokens rather than a page of coordinates. Neither output is converted from the other: a deck built as HTML and later as PowerPoint is the same scene emitted twice.

A column's unclaimed height is placed by one rule (`leftover: "spread"`): the gaps between its blocks open evenly as far as `space.loose`, and what is still left is split above and below, so the blocks stay one group in the middle of the column. A list is as tall as its content; the column it sits in places it with whatever else it holds. Peers that read across - a page's paragraphs under a wide exhibit - are a flow the engine arranges (`flow.best`): side by side where each keeps a readable width, stacked where it does not. A toned area of a page's grid wraps its content rather than stretching down its cell.

The layout itself is solved by Taffy, a CSS grid and flexbox engine, vendored under `vendor/taffy-layout` (its version and checksums in `VERSION.json`; the runtime has no other dependency and needs no install). `core.mjs` writes each container to it as a CSS grid and keeps what is this runtime's rather than CSS's around the solve: a component's own measure, heading bands shared by the peers of a row, the ceiling a component grows to, where a column's free height goes, and the refusals that say by how much content overruns its frame. A component says how it is sized on its definition: `sizing: "fill"` draws to whatever frame it is given; without it, it has a size of its own.

## Chosen, not ruled

How a page's blocks are arranged is not written as a rule for each case. Three things decide it, each general:

- **Components say what they need.** A definition declares the content it can set and how much of it (`takes: { points: [1, 1] }`: an insight sets one point as a statement) and the widths it reads at (`reads`). A composer offers a page's content every way a component takes it (compose-points.mjs `pointWays`: a list, a block a point, the blocks centred, a statement) as a `choice` node, never picking one itself.
- **The engine proposes, lays out and scores** (`tasteful-layout/`). A flow left to it (`flow.best`) is tried as a stack, a row at several shares, equal columns and a lead beside the rest, with every option of every choice inside it, each laid out by Taffy. The measures are the published vocabulary of automated document layout (Harrington 2004; Ngo, Teo and Byrne 2003), read off the ink each block lays down: white-space fraction (`whitespace`), `balance`, `uniformity`, `regularity`, `proportion` and `simplicity`, and one of the deck's own, `variety` (a kind of content set the way the deck last set it, where another way is about as good). They are not summed: the score is `1 - product((1 - measure) ^ weight)`, so one bad feature costs the page whatever the rest say. Flows are arranged outermost first, and one inside another is measured as it will be arranged. A candidate whose components cannot be measured or drawn in the frames it gives them is ruled out by trying it, so no arrangement carries a component's limits. What was chosen, and over what, is kept on the slide (`decisions` in `scene.json`).
- **Free height has one rule** (a flow's `leftover: "spread"`, the default for a column of commentary): the gaps between its blocks open evenly as far as `space.loose` and no further, and what is still left sits above and below the group, heading and ground with it.
- **A judge settles what a score cannot.** `judge WORK` (public/judge.mjs) takes every arrangement the engine chose between two or more drawable candidates, not only the close ones, draws the best three side by side and returns them to the calling agent with a rubric, one decision a page a round and at most three rounds a page; its choices are recorded on the page (`choices: { <decision id>: <candidate label> }`) and held by every later build, so the judgement is made once and the build stays deterministic.

The page's rhythm is tokens, not numbers in the engine: `space.major` (the least air between a page's major components), `space.minor` (between the blocks inside one), `space.loose` (the most a column's gaps open when it has height to spare), `measure.min` and `measure.max` (the widths a line of body text is read at); `TASTE` holds how sharply each measure bites, the fill a page's ink should reach (0.55) and what an exhibit wants of its frame. The layout module holds none of these numbers. A density scales the gaps, and a house style or design system can set its own. How an arrangement is weighed also follows the density (`DENSITY_PROFILES[...].taste`): presented live, air is cheap and columns are not; read alone, the page is used.

A new way to set content is a component that says what it takes and one line where that content is offered; a new arrangement is one candidate in tasteful-layout. Neither needs a rule about a page.

## A page's own grid

Any analytical page can be set on a grid written as CSS grid writes one (`layout-templates.mjs`), with commentary `"grid"`:

```json
{ "grid": { "columns": "2fr 1fr", "rows": "auto 1fr", "gap": "space.4",
            "areas": ["exhibit kpi", "exhibit side"],
            "place": { "side": { "content": ["insight", "points"], "heading": "What it means", "align": "space-between" } } } }
```

The page keeps its content in the fields every page has, and each named area takes the content of its name - `exhibit` (`exhibit-2` and on for a page of several), `points`, `paragraphs`, `kpi`, `insight`, `metrics`, `callout`, `takeaway`, `photo` - or what `place` gives it: one slot, or several stacked, with a `heading`, a `tone` and an `align` (`start`, `center`, `end`, `space-between`, or the house rule) of the area's own. Tracks are `<n>fr`, `auto`, a length in px or `minmax(<px>, <n>fr)`. A deck keeps its own grids under `layouts` and a page takes one by name (`grid: "<name>"`). Content the page carries and the grid gives no area is refused by name, and so is an area whose content the page does not have: a grid never drops or invents anything. A dashboard page reads the same template for its exhibits' cells. The runtime's own arrangements are templates too (`compose-arrangements.mjs builtInGrid`): the exhibit beside its commentary, the hero number, the stack, the grid of four and the split pair are grids read by the same composer as an author's.

The composer draws commentary where the page placed it and keeps each layout's column shares; it does not narrow a column or move points to cover a short one. A column the content leaves short opens its gaps as far as `space.loose` and sets the rest above and below the group; how full the page reads is weighed by the layout engine where it arranges the page, and is no finding.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | done: the machine ready, the deck compiled or built (`built`, or `built-unrendered` without a renderer) |
| 1 | a crash or bad usage |
| 2 | refused: a finding that blocks, listed with its page and repair; the deck is still written by the build so it can be inspected |

## What is checked

Each check is about one page or about the saved file. A blocking finding stops the deck; an advisory is listed and does not.

| Group | Codes |
| --- | --- |
| The page cannot be drawn | `COMPILE`, `EXHIBIT_KEY_UNREAD`, `PAGE_DOES_NOT_COMPOSE`, `TITLE_LINES`, `HEADING_WRAPS`, `TOTAL_ROW_BLANK`; `PAGE_SPLITS` and `PAGE_ADJUSTED` advised |
| Overlap and legibility | `TEXT_ON_TEXT`, `TEXT_OFF_GROUND`, `TEXT_ON_LINE`, `TEXT_ON_EDGE`, `DESCENDER_ON_RULE`, `MAP_LABEL_ASTRAY`, `GROUND_CONTRAST`, `RENDER_CONTRAST`, `TYPE_RANGE`, `SCATTER_UNKEYED` |
| A chart drawn wrongly | `AREA_BASELINE`, `RANK_FILLED`, `UNSCALED_FIGURE` |
| Points over a chart or table with no placement | `COMMENTARY_UNCHOSEN` (page-types.mjs defaultCommentary) |
| A chart that compares nothing | `NO_COMPARISON` (also a treemap of near-equal parts), `SERIES_FLAT`, `ONE_COMPARISON` (chart-sense.mjs) |
| The saved file differs from the scene | the readback codes (`MISSING_SHAPE`, `FRAME_DRIFT`, `TEXT_MISMATCH`, `SLIDE_COUNT`, ...), `TEXT_EXPORT_LOST`, `TEXT_EXPORT_PAGE_COUNT`, `TEXT_PLAN_PAGINATION`, `TEXT_PLAN_INCOMPLETE`, `MISSING_RENDER`, `RENDER_DRIFT`, `CONTENT_LOST`, `MISSING_VISUAL_INTENT` |
| A number | `BINDING_UNRESOLVED`, `NUMBERS_DISAGREE`, `BRIDGE_UNRECONCILED`, `MEASURES_CONFLICT`; `NUMBER_UNTRACED` advised |
| Pictures and assets | `UNSOURCED_PICTURE`, `PICTURE_UNREADABLE` (a screenshot drawn too small to read), `ASSETS_NEEDED`, `ASSETS_OFFLINE` |
| A revision | `REVISION_INVENTORY_MISSING`, `REVISION_SOURCE_MISSING`, `REVISION_UNMAPPED`, `REVISION_SLIDE_SIZE`, `REVISION_CARRY_INVALID`, `REVISION_CARRY_DRIFT`, `NUMBER_STALE`, `WORDING_STALE` |
| The build | `DECK_OLDER_THAN_PAGES`, `GATES_FAILED` |

## Modules

```
doctor.mjs           Node, a Python that imports the emitter's packages (RUNTIME_PYTHON), PowerPoint or LibreOffice, pdftoppm, pdftotext; an install line per missing piece
preferences.mjs      the design intake's answers, stored once per user outside any project
design-options.mjs   one labelled contact sheet per intake question (emit/contact_sheet.py lays them out)
import-template.py   a template deck -> house profile; infer-style.py the same from a PDF or screenshots
import-deck.py       an existing PPTX, read and never written -> inventory, starter pages file, assets and the source deck kept
revision.mjs         a revision's carried slides, edits in place, the assembly order and the stale-words check
variation.mjs        a deck's variation seed and what it draws

author-deck.mjs      pages file -> deck: compile, bind, compose, check; the catalogue commands
page-types.mjs       the page types and forms, their defaults, and the compile of a typed page to a slide
form-fields.mjs      every field a form and an exhibit kind reads (--schema)
limits.mjs           what a page's frames hold (--limits)
deck-keys.mjs        the keys `deck` takes
pages-file.mjs       the pages file read whole, its parts (`include`) spliced in
measures.mjs         the insight log's measures; bind.mjs numbers by reference; printed-numbers.mjs numbers read off text
page-numbers.mjs     a page's typed numbers traced to the record (NUMBER_UNTRACED) and the citations its numbers need
sources-registry.mjs the `sources` registry and the citation line written from it
players.mjs          the entities a deck compares, and the mark each is drawn by
evidence.mjs         tables and cells read without the layout engine; how many values an exhibit plots

compose-all.mjs      composition that reports every failing page in one run
compose-*.mjs        the composer: deck -> planner items, exhibits, charts, tables, points, pictures, arrangements
chart-axes.mjs       what every chart shares: scales and axes, the subject's and its peers' colours, row labels thinned when crowded
axis-breaks.mjs      axis jumps for every chart: a period axis broken after a gap, no line across a missing period, a value cut
label-placement.mjs  value labels placed clear of one another and the lines, a rule broken around labels, labels pushed apart
chart-sense.mjs      whether a chart shows a comparison: NO_COMPARISON, SERIES_FLAT, ONE_COMPARISON
planner.mjs          items -> composition tree; core.mjs tokens, grid, layout and the scene
layout-templates.mjs a page's own grid, written as CSS grid writes one; the built-in arrangements are templates too
tasteful-layout/     the arrangement of a group of blocks, proposed, laid out and scored; vendor/taffy-layout the CSS grid engine both solves run on
public/judge.mjs     the engine's choices drawn side by side for a judge, and its choices recorded on their pages
registry*.mjs        the component registry; charts*.mjs, chart-*.mjs the charts; tables.mjs, panels.mjs, maps.mjs, ... the rest
text-layout.mjs      text measurement (font-metrics.mjs, fonts/); text-contract.mjs the one word count and the export text check
derive-content.mjs   the text plan read off the composed pages; the footer's room for a citation
validate-overlap.mjs the scene's overlap and legibility checks
fetch-*.mjs          logos, flags, photographs, places and public series, with their credits; asset-needs.mjs what a build would fetch

build-deck.mjs       compose -> emit (pptx, html or both) -> render -> readback -> page gates -> export text check
gates/page_gates.py  the page gates on the scene and the renders; gate_config.py their thresholds
gates/consistency_gates.mjs  what the pages state between them: one number, one value
emit/emit_html.mjs   scene -> one HTML page: the layout tree as CSS grid, each component holding its primitives, tokens as custom properties
emit/render_html.mjs HTML -> PNG a slide in a headless browser (Playwright Chromium, optional); html-shapes.mjs the shape geometry both HTML renderers share; shape-outlines.json every named geometry's outline, which html-shapes.mjs and emit_pptx.py both draw
emit/emit_pptx.py    scene -> editable PPTX; render_pptx.py PPTX -> PDF (PowerPoint or LibreOffice) -> PNG; readback_pptx.py the saved file read back
emit/renderer_backends.py  the renderer discovery the doctor shares; the macOS AppleScript and Windows PowerShell COM exporters (the probe never launches an office app)
emit/assemble_pptx.py  a revision's deck: the source PPTX with its composed pages set in
```
