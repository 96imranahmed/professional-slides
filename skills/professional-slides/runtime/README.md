# Runtime

Node lays the page out; Python writes and checks the file. No vendor runtime. The order the commands run in, and when each step is done, is the [pipeline](../SKILL.md#pipeline); this page is the module map.

## Commands

```
node runtime/doctor.mjs [--json] [--no-render]
$RUNTIME_PYTHON runtime/import-deck.py deck.pptx out/ [--id <id>] [--force]
node runtime/preferences.mjs show | get [key] | set key=value ... | clear [key] | deck-keys | apply <id>.pages.json | path
node runtime/author-deck.mjs <id>.pages.json [--draft | --check | --log]
node runtime/author-deck.mjs --types | --schema [<type>] | --example <type>[/<form>] | --icons
node runtime/author-deck.mjs [<id>.pages.json] --scaffold <type> [--evidence <insight-id>] [--id <page-id>]
node runtime/storyline.mjs [merge] <id>.deck.json out/ [--full | --spine] [--run codex|claude] [--model m] [--max-passes n] [--reason text] [--user-approved]
node runtime/build-deck.mjs <id>.deck.json out/ [--no-fetch] [--no-render] [--preflight]
node runtime/deliver-deck.mjs <id>.deck.json out/ [--reviewer auto|codex|claude|packet] [--model m]
    [--review review.json|confirmation.json|parts-dir] [--skip-build] [--full-review --reason text [--user-approved]] [--max-passes n]
node runtime/reviewer.mjs merge <id>.deck.json out/ [parts-dir]
```

`deliver-deck.mjs --brief` was removed: both reviews read the deck's verbatim `request`, set in the pages file.

Every Node command reads its command line the same way (`cli.mjs`, on `util.parseArgs`):

- an option's value is never another option: `--reason --user-approved` is a usage error, not a reason;
- an option a command does not know is ignored, except by `doctor.mjs` and `preferences.mjs`, which refuse it;
- a refusal prints `Refused (CODE): <message>` with no stack and exits 2; delivery also writes it to `REJECTED.md`;
- a JSON file that does not parse is an error naming the file;
- every JSON file the runtime writes is indented two spaces, with a trailing newline.

## Exit codes

One scheme for every command above (EXIT in `errors.mjs`):

| Code | Meaning |
| --- | --- |
| 0 | done: the machine ready, the deck compiled or built, the storyline ready, the parts merged, the deck delivered |
| 1 | a crash or bad usage |
| 2 | refused: a rule the author can repair (`Refused (CODE): ...` from the build, `REJECTED.md` from delivery), a critique or review that does not validate, a loop at its cap |
| 3 | waiting on a reviewer: a critique, review or confirmation packet was written for a fresh reader |

`build-deck.mjs --no-render` ends `built-unrendered` (exit 0) when planning and readback pass; delivery needs a `built` result with passing rendered gates, so rebuild without it before `deliver-deck.mjs --skip-build`. `--preflight` runs the plan and story gates without export.

## Modules

```
doctor.mjs         step 0: Node, a Python that imports the emitter's packages (RUNTIME_PYTHON), soffice, pdftoppm, pdftotext; an install line per missing piece
import-deck.py     an existing PPTX, read and never written -> <id>.inventory.json (each slide as it shows: hidden flag, paragraphs in displayed order, pictures with their displayed box, rotation and mirroring), a starter <id>.pages.json (workflow "existing_deck_revision", stable ids, old copy as `draft`, `hidden: true` on a hidden slide) and assets/<id>/
preferences.mjs    the design intake's answers, stored once per user outside any project
design-options.mjs one labelled contact sheet per intake question, each tile built with that answer (emit/contact_sheet.py lays them out)
import-template.py a template deck -> house profile (palette, faces, chrome, density); infer-style.py the same from a PDF or screenshots
variation.mjs      a deck's variation seed and draw
page-types.mjs     the page types: required choices, the structure they compile to, evidence shapes and breadth, the values each page plots, the chart-form refusals (CHART_FORM_CODES)
author-deck.mjs    pages file (the dot-dash) -> deck, plan and content plan; every finding in one run (AUTHORING_CODES); stamps `rulesVersion`
compose-all.mjs    composition that reports every failing page in one run, and each page's reading task
derive-content.mjs the content plan and text plan read off the composed pages; each page's word floor and ceiling
compose.mjs        deck/v3 spec -> planner items: layouts, exhibit aliases, table treatment, pagination and splitting, metrics strips, agenda pages, chart rules
planner.mjs        items -> composition tree; density; section headings; dividers, covers, page chrome
core.mjs           tokens (modular type scale, 12-column grid, 4px baseline), the composition solver, compileDeck -> scene
text-layout.mjs    wrap-once measurement; font-metrics.mjs uses @napi-rs/canvas when installed, bundled Arial/Georgia metrics otherwise
registry.mjs       components (charts.mjs, charts-extra.mjs, tables.mjs, trackers.mjs, panels.mjs, gantt.mjs, extras.mjs, framework.mjs, maps.mjs, figures.mjs, ...); fitText ladder
marks.mjs          the shared marker vocabulary: numberMarker, iconMarker, stateMarker (lists, cards, table cells, map pins, agenda)
icons.mjs          56 named icons as path data, emitted as editable freeforms; `author-deck.mjs --icons` lists them with their aliases
fetch-logos.mjs    player logos from Wikipedia infoboxes, trimmed to the mark (run by the build)
fetch-pictures.mjs photographs for `{ alt }` placeholders from Wikimedia Commons, free licences only (run by the build)
fetch-places.mjs   coordinates for map markers that name a place, cached in the deck folder's assets/places.json (run by the build)
fetch-series.mjs   public time series (World Bank, Our World in Data) into sources/ as CSV plus a chart block
build-deck.mjs     assets -> plan -> scene -> claims -> pptx -> render -> readback -> page gates -> density profile; refusals are REFUSAL_CODES
validate-overlap.mjs  scene design checks author-deck and the build run (OVERLAP_CODES: text on a line, text on a box edge, a descender on a rule, an unkeyed scatter); the rendered-DOM overlap audit the tests run
errors.mjs         EXIT (the exit codes), RefusalError (a repairable input, exit 2), UsageError (a command line it cannot read, exit 1) and registered() (a finding's code, checked against its module's code table)
cli.mjs            the plumbing every command shares: isMain, parseCli on util.parseArgs, runCli (exit codes and refusal printing), pythonBin, readJson and writeJson
color.mjs          colour arithmetic on #RRGGBB: mix, relative luminance, WCAG contrast (emit/color.py ports it)
nice-numbers.mjs   the values an axis, a shared scale or a size legend may land on (gates/nice_ticks.py ports it)
evidence.mjs       the evidence a page rests on, without the layout engine: SHAPES and breadth, the table vocabulary, plottedValues - so storyline.mjs and reviewer.mjs load about a dozen modules rather than fifty-five
table-variants.mjs the table variants a deck may name, in the component gallery's order
claims.mjs         the claim ledger (claims.json) for the author's self-check, and its validation
gates/page_gates.py     the page gates' command and facade: runs every gate on the scene and the render; `--thresholds-markdown` prints the threshold table
gates/gate_config.py    the thresholds, the weight floors, the code tables (GATE_CODES, ADVISORY_CODES, COMPOSE_CODES), severity rules and the scene readers every gate shares
gates/render_gates.py   the page's own gates: ink and bands on the render, and the title, type, measure, words and pictures
gates/scene_gates.py    the gates read off the composed scene, so they run at authoring as well as the build (SCENE_VOID, SCENE_INK)
gates/semantic_gates.py what the page says: restatement, planning voice, caveats, twin cells, contradicted shares, repeated table schemas
gates/deck_gates.py     the deck-wide gates: photographs, craft rates, device vocabulary, evidence mix, front matter, page weight, architectures, thin-page habit
gates/text_stats.py     the one word count (text-contract.mjs textWords, ported), printed words for the density profile, content words; stopwords.json the shared stopword lists
gates/density_profile.py  words as a reader meets them on the rendered PDF; TEXT_FRAGMENTED
gates/variety_gates.mjs, gates/content_gates.mjs, gates/plan_gates.mjs, gates/craft_gates.mjs  the variety contract, the content plan, the plan record, the craft floors
build-bars.mjs     the bars delivery measures on the built scene (BUILD_BAR_CODES) and the measures that let a partly fixed deck finding drop (DOWNGRADE_MEASURES)
storyline.mjs      the storyline critique: spine or full packet, validation, the gate the deck review and delivery wait for
reviewer.mjs       the deck review: rubric, pass-one, verification and confirmation schemas, section split and merge; backends codex | claude | packet
review-passes.mjs  the loop both reviews share: page lists, statuses, ledger, pass cap, lineage under <deck dir>/.reviews/<id>/, staging, provenance, exit codes
deliver-deck.mjs   build -> gates -> request and waivers -> storyline ready -> build bars -> self-check -> review passes -> confirmation read -> <id>-DELIVERED.pptx or REJECTED.md
emit/emit_pptx.py      scene -> editable PPTX (placeholders, native charts with workbooks, preset autoshapes and freeforms, palette -> theme)
emit/render_pptx.py    PPTX -> PDF (LibreOffice) -> PNG per slide + montage
emit/readback_pptx.py  the saved PPTX re-opened with python-pptx and compared to the scene; lists the hidden slides (`readback.hidden`) and reports HIDDEN_STATE when the file and the scene disagree
emit/color.py          WCAG luminance and contrast, as palettes.mjs and core.mjs compute them, for the emitter and the template importer
weight.json, weight.mjs  the numeric contract the composer and gates read: floors by fill, targets, deck lengths, rule versions
```

The review loop's rules - passes, confirmation, caps, lineage, provenance - are owned by [Taste review](../references/taste-review.md#order-of-the-reviews); the new-deck contract by [Storyline records](../references/storyline-records.md#planning-contract).

## Components

Component contract: `render({ id, frame, props }) → { nodes }` with frames in canvas px (1280×720); `measureContent({ frame, props })` returns the natural height at a width - components without it fall back to `preferredSize`, and `evals/tests/test_measure_vs_preferred.py` reports the list. Chart components expose `nativeChart` on their instance so the emitter can write a workbook-backed chart; charts with reference lines, annotations or highlights stay as grouped shapes.

Adding a component: register it in `registry.mjs` with `tokens`, `preferredSize`, `sample`, `render` and `measureContent`; the component and measurement tests pick it up.
