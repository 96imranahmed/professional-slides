# Production

## Commands

```bash
node runtime/build-deck.mjs deck.json out/ --preflight     # plan + story gates, no export
node runtime/build-deck.mjs deck.json out/ [--no-render]   # scene.json, <id>.pptx, rendered/, readback.json, gates.json
node runtime/deliver-deck.mjs deck.json out/ [--reviewer auto|codex|claude|packet] [--model m] [--review review.json] [--skip-build]
```

`build-deck.mjs` composes the deck/v3 spec into a plan, lays it out against measured text (bundled Arial-compatible metrics; no native dependencies), emits an editable PPTX with python-pptx, renders it with LibreOffice, reads the saved file back and runs the page gates. Exit 0 when the gates pass, 2 with findings (the deck is still written for inspection), 1 on a crash. `deliver-deck.mjs` builds, requires the gates and readback to pass, runs the review through the selected backend, and copies `out/<id>-DELIVERED.pptx` only when the review accepts; a rejection writes `out/REJECTED.md` and `delivery.json` with the blockers and removes any earlier deliverable. With `--reviewer packet` (the default when no `codex` or `claude` CLI is on the path) delivery writes `out/review-packet/` and exits 3; the calling agent reviews it and reruns with `--review out/review.json`.

Environment: `python3` with `python-pptx` and Pillow, LibreOffice (`soffice`) and `pdftoppm` on the path; `RUNTIME_PYTHON` overrides the interpreter. No Codex runtime, no `@napi-rs/canvas`, no PptxGenJS.

## Rendering

The build renders with LibreOffice headless by default: exported PPTX to PNG per slide, plus a python-pptx readback that recovers each shape's frame, text and line count from the saved file.

The exported file is the candidate of record. Keep meaning-bearing content native and separately addressable: one paragraph per real paragraph, `wrap="square"`, autofit on the body, title and body placeholders on a real layout set, native charts with embedded workbooks, and grouped diagram geometry. Then a reader can edit the deck, Reset Slide works, and a template swap keeps the content.

Inspect every rendered slide for title wrapping, overflow, font substitution, chart labels and number formats, image crops, master furniture and source notes, connector routing, tracker states and page numbers. After a structural repair, render the whole deck again.

Google Slides is a downstream import: finish and verify the PPTX, import it, then verify the native deck separately. Import can change fonts, wrapping, crops, connectors, line weights, charts and object order, so parity stays unverified until the native render is inspected.

## What the gates check

The canonical code and thresholds live in `runtime/gates/page_gates.py`; the
code catalogue is in [Evaluation](../evaluation/index.md). Reports distinguish
blocking findings from advisory distribution, whitespace and decoration counts.
Do not add content or visual devices to satisfy advisory percentages. Review the
rendered argument and retain purposeful neutral exhibits and open space.

For new work, `workflow: "new_deck"` requires content and design sidecars, stable
IDs, title parity and an executive summary before the first section. Revisions
may use partial plans. Content transfers by ID rather than by page position.

## What delivery refuses

Delivery hands over a deck when blocking page gates pass and the review accepts the exact current PPTX, scene and renders. The review hash and inspected-slide coverage are required; every rebuild invalidates the previous review. When either fails, the findings are the result: `REJECTED.md` and `delivery.json` report the blocking findings and no `*-DELIVERED.pptx` remains. The build artifact is retained for inspection.

Blocking findings are factual errors, unsupported claims, misleading comparisons, missing evidence on a ranked criterion, missing argument, unreadable text, overflow, broken geometry, broken dependencies and provenance failures; editorial preferences are advisory. A missing-argument finding names the absent premise and a concrete repair, because blank space or a low word count on its own is a diagnostic.

## Repairs

Consolidate findings by cause with their affected slide IDs and one coordinated repair. A wrong value returns to the evidence and the specification; a missing comparison returns to the argument plan; clipping returns to the composition. A shared change invalidates every page that uses it, so recheck those renders. When the repair allowance ends with a defect unresolved, report that defect precisely rather than recording it as accepted.
