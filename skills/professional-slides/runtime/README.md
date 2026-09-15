# Runtime

Node lays the page out; Python writes and checks the file. No vendor runtime.

```
compose.mjs        deck/v3 spec → planner items: layouts (hero/side/two-up/stack/grid/text), exhibit aliases (cards, quadrants, swot, compare, phase-table, rows), table styling and verdict inference, pagination and splitting, metrics strips, agenda pages, chart rules (highlight from title, CAGR badge, end labels)
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
reviewer.mjs       one review prompt + schema; backends codex | claude | packet
build-deck.mjs     plan → scene → pptx → render → readback → gates
deliver-deck.mjs   build → gates must pass → review → <id>-DELIVERED.pptx or REJECTED.md
```

Component contract: `render({ id, frame, props }) → { nodes }` with frames in canvas px (1280×720); `measureContent({ frame, props })` returns the natural height at a width — components without it fall back to `preferredSize`, and `evals/tests/test_measure_vs_preferred.py` reports the list. Chart components expose `nativeChart` on their instance so the emitter can write a workbook-backed chart; charts with reference lines, annotations or highlights stay as grouped shapes.

Adding a component: register it in `registry.mjs` with `tokens`, `preferredSize`, `sample`, `render` and `measureContent`; the golden gallery (`evals/scripts/golden_reference.py`) and the measurement test pick it up.
