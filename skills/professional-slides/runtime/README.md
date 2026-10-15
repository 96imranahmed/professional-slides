# Runtime

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
node runtime/build-deck.mjs <id>.deck.json out/ [--no-fetch] [--no-render] [--preflight]
node runtime/variation.mjs [seed] [--design <system>]
```

`author-deck.mjs <id>.pages.json` compiles every page, binds its numbers to `<id>.insights.json`, composes the deck, runs the page checks and writes `<id>.deck.json`; `--check` does the same and writes nothing, and `--render` also renders the pages through the build's own stages. Every finding is listed in one run. `build-deck.mjs` emits `out/<id>.pptx`, renders it to `out/rendered/` (`<id>.pdf`, `slide-N.png`, `montage.png`), reads the saved file back and writes `out/build-result.json`.

Every Node command reads its command line the same way (`cli.mjs`): an option's value is never another option; a refusal prints `Refused (CODE): <message>` with no stack; every JSON file the runtime writes is indented two spaces with a trailing newline.

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
| Overlap and legibility | `TEXT_ON_TEXT`, `TEXT_OFF_GROUND`, `TEXT_ON_LINE`, `TEXT_ON_EDGE`, `DESCENDER_ON_RULE`, `MAP_LABEL_ASTRAY`, `GROUND_CONTRAST`, `RENDER_CONTRAST`, `TYPE_RANGE`, `SCATTER_UNKEYED`; `SCENE_VOID` advised |
| A chart drawn wrongly | `AREA_BASELINE`, `RANK_FILLED`, `UNSCALED_FIGURE` |
| A chart that compares nothing | `NO_COMPARISON` (also a treemap of near-equal parts), `SERIES_FLAT`, `ONE_COMPARISON` (chart-sense.mjs) |
| The saved file differs from the scene | the readback codes (`MISSING_SHAPE`, `FRAME_DRIFT`, `TEXT_MISMATCH`, `SLIDE_COUNT`, ...), `TEXT_EXPORT_LOST`, `TEXT_EXPORT_PAGE_COUNT`, `TEXT_PLAN_PAGINATION`, `TEXT_PLAN_INCOMPLETE`, `MISSING_RENDER`, `RENDER_DRIFT`, `CONTENT_LOST`, `MISSING_VISUAL_INTENT` |
| A number | `BINDING_UNRESOLVED`, `NUMBERS_DISAGREE`, `BRIDGE_UNRECONCILED`, `MEASURES_CONFLICT`; `NUMBER_UNTRACED` advised |
| Pictures and assets | `UNSOURCED_PICTURE`, `PICTURE_UNREADABLE` (a screenshot drawn too small to read), `ASSETS_NEEDED`, `ASSETS_OFFLINE` |
| A revision | `REVISION_INVENTORY_MISSING`, `REVISION_SOURCE_MISSING`, `REVISION_UNMAPPED`, `REVISION_SLIDE_SIZE`, `REVISION_CARRY_INVALID`, `REVISION_CARRY_DRIFT`, `NUMBER_STALE`, `WORDING_STALE` |
| The build | `DECK_OLDER_THAN_PAGES`, `GATES_FAILED` |

## Modules

```
doctor.mjs           Node, a Python that imports the emitter's packages (RUNTIME_PYTHON), soffice, pdftoppm, pdftotext; an install line per missing piece
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
registry*.mjs        the component registry; charts*.mjs, chart-*.mjs the charts; tables.mjs, panels.mjs, maps.mjs, ... the rest
text-layout.mjs      text measurement (font-metrics.mjs, fonts/); text-contract.mjs the one word count and the export text check
derive-content.mjs   the text plan read off the composed pages; the footer's room for a citation
validate-overlap.mjs the scene's overlap and legibility checks
fetch-*.mjs          logos, flags, photographs, places and public series, with their credits; asset-needs.mjs what a build would fetch

build-deck.mjs       compose -> emit -> render -> readback -> page gates -> export text check
gates/page_gates.py  the page gates on the scene and the renders; gate_config.py their thresholds
gates/consistency_gates.mjs  what the pages state between them: one number, one value
emit/emit_pptx.py    scene -> editable PPTX; render_pptx.py PPTX -> PDF -> PNG; readback_pptx.py the saved file read back
emit/assemble_pptx.py  a revision's deck: the source PPTX with its composed pages set in
```
