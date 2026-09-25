# Runtime

Node lays the page out; Python writes and checks the file. No vendor runtime.

```
compose.mjs        deck/v3 spec → planner items: layouts (hero/side/two-up/stack/grid/text), exhibit aliases (cards, quadrants, swot, compare, phase-table, rows), explicit table treatment and inference variants, pagination and splitting, metrics strips, agenda pages, chart rules (descriptive headings, authored focus, CAGR badge, end labels)
planner.mjs        items → composition tree; density; section headings; dividers, covers, page chrome (tag, titleLead, callout, note/source)
core.mjs           tokens (modular type scale, 12-column grid, 4px baseline), the composition solver, compileDeck → scene
text-layout.mjs    wrap-once measurement; font-metrics.mjs uses @napi-rs/canvas when present, bundled Arial/Georgia tables otherwise
registry.mjs       components (charts.mjs, tables.mjs, trackers.mjs, panels.mjs, gantt.mjs, extras.mjs, framework.mjs, maps.mjs, …); fitText degradation ladder; paragraph measure cap
marks.mjs          the shared marker vocabulary: numberMarker, iconMarker, stateMarker (lists, cards, table category cells, map pins, agenda)
icons.mjs          48 named icons as path data, emitted as editable freeforms
panels.mjs         cards, quadrants, metric tiles, agenda
gantt.mjs          project plan (periods, tiers, groups, bars, milestones, today line)
extras.mjs         cycle, steps, people, logos
framework.mjs      strategy house and pyramid
emit/emit_pptx.py  scene → editable PPTX (title placeholders, wrap=square, autofit, native charts with per-point fills and labels, preset autoshapes and freeforms for chevrons/arrows/icons/polygons, palette → theme)
emit/render_pptx.py  PPTX → PDF (LibreOffice) → PNG per slide + montage
emit/readback_pptx.py  saved PPTX re-opened with python-pptx and compared to the scene
gates/page_gates.py  deterministic page gates (ink, dead band, internal void, hero, type range, cpl, words, titles, monotony, ticks)
reviewer.mjs       one full review prompt + schema + artifact binding; verification rounds scoped to changed/blocked slides; backends codex | claude | packet
claims.mjs         claim ledger (claims.json) for the author's self-check, and its validation
build-deck.mjs     assets → plan → scene → claims → pptx → render → readback → gates
page-types.mjs     the page types: required choices, the structure they compile to, evidence shapes and their breadth, the values each page plots
author-deck.mjs    pages file (the dot-dash) -> deck, plan and content plan; every finding in one run; --draft, --types, --schema
compose-all.mjs    composition that reports every failing page in one run, and each page's reading task
derive-content.mjs the content plan and text plan read off the composed pages
fetch-logos.mjs    player logos from Wikipedia infoboxes, trimmed to the mark (run by the build)
fetch-pictures.mjs photographs for `{ alt }` placeholders from Wikimedia Commons, free licences only (run by the build)
fetch-places.mjs   coordinates for map markers that name a place, cached in assets/places.json (run by the build)
fetch-series.mjs   public time series (World Bank, Our World in Data) into sources/ as CSV + a chart block
deliver-deck.mjs   build → gates must pass → self-check must cover claims → review → <id>-DELIVERED.pptx or REJECTED.md
```

Component contract: `render({ id, frame, props }) → { nodes }` with frames in canvas px (1280×720); `measureContent({ frame, props })` returns the natural height at a width — components without it fall back to `preferredSize`, and `evals/tests/test_measure_vs_preferred.py` reports the list. Chart components expose `nativeChart` on their instance so the emitter can write a workbook-backed chart; charts with reference lines, annotations or highlights stay as grouped shapes.

Adding a component: register it in `registry.mjs` with `tokens`, `preferredSize`, `sample`, `render` and `measureContent`; the component and measurement tests pick it up.

`build-deck.mjs --no-render` produces a `built-unrendered` result when planning
and readback pass (exit 0). It is useful for inspecting the editable file, but
delivery requires a `built` result with passing rendered page gates. Rebuild
without `--no-render` before using `deliver-deck.mjs --skip-build`.

New work declares `workflow: "new_deck"`. Content and design sidecars are required;
main analytical content and all authored design records use stable IDs and exact
final titles. A declared executive summary precedes the first section. Revision
work may carry partial plans. Semantic fields transfer by ID, never position.

Schema, argument completeness, text fit, collisions, clipping and scale checks block delivery.
Page-family mix, decoration frequency, empty bands and density statistics are advisory; neutral
exhibits and concise pages can be correct. Independent rendered review decides
whether those pages communicate well. A review is valid only for its hashed
scene, editable deck and renders, with every current slide explicitly inspected, or, for a
verification after a recorded review, every changed and previously blocked slide.
