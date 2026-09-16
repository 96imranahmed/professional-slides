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

Deterministic, per page, before any model is consulted:

- ink coverage at least 8% of the canvas unless a qualifying hero exhibit carries the page (dense is fine; emptiness is the defect); tinted surfaces count as designed space for the band gates;
- trailing dead band at most 8%, and no internal empty band over 22% of the page height;
- the largest exhibit on an analytical page covers at least 40% of the content area and its frame carries ink (at least 2%, which a line chart clears);
- action title at most two lines;
- body type between 10 and 14 pt;
- 45 to 90 characters per line;
- at most 100 body words of prose on an exhibit page, 140 on a text page (table cells are evidence, not prose);
- no single layout on more than 35% of pages;
- photographs on at most 30% of analytical pages and never more than two running (`IMAGE_BUDGET`, `IMAGE_RUN`);
- at least 45% of analytical pages carrying a chart, a table or measured tiles, and at least three families of page across a deck of ten or more (`EVIDENCE_MIX`, `PAGE_VARIETY`);
- a page carried by photographs, or by two peer panels, saying what it means in an insight, a so-what or a points column (`MISSING_ARGUMENT`);
- no lone metric tile stacked above a table (`METRIC_STACK`);
- sections and a tracker past twelve analytical pages (`NO_SECTIONS`);
- no bullet or middle dot joining two labels, on any page including the cover (`DOT_SEPARATOR`);
- the deck's weight contract, which a template's house profile can set: page text at or above `weight.pageWords` (`THIN_PAGE`), the commentary column reaching `weight.columnFill` of its track with points averaging `weight.pointWords` (`THIN_COLUMN`, `POINT_DEPTH`), marks spanning `weight.plotSpan` of the exhibit (`PLOT_SPAN`), a table using `weight.tableFill` of its row budget (`THIN_TABLE`), three numeric labels on an exhibit page (`NUMBERS_ON_MARKS`) and `weight.elements` pieces of evidence (`THIN_EVIDENCE`); every one is a floor, and an `airy` deck switches them off;
- axis ticks on nice numbers;
- every object inside its resolved frame, with no unintended overlap;
- titles: within 14 words (a trailing `(1/2)` page marker is not counted), free of the hedge lexicon, no two sharing more than 60% of their tokens;
- structural pages - cover, agenda, section divider, tracker - are exempt from the ink, dead-band and hero gates; chart furniture (status labels, progress labels, badges, page tags, cover date and logo) is exempt from the body type range;
- coverage: every ranked criterion in the brief has at least one comparative exhibit across all options.

## What delivery refuses

Delivery hands over a deck when the page gates pass and the review accepts it. When either fails, the findings are the result: the file is named `*-REJECTED.pptx` and the blocking findings are reported directly, rather than attached as a note beside a delivered deck.

Blocking findings are factual errors, unsupported claims, misleading comparisons, missing evidence on a ranked criterion, missing argument, unreadable text, overflow, broken geometry, broken dependencies and provenance failures; editorial preferences are advisory. A missing-argument finding names the absent premise and a concrete repair, because blank space or a low word count on its own is a diagnostic.

## Repairs

Consolidate findings by cause with their affected slide IDs and one coordinated repair. A wrong value returns to the evidence and the specification; a missing comparison returns to the argument plan; clipping returns to the composition. A shared change invalidates every page that uses it, so recheck those renders. When the repair allowance ends with a defect unresolved, report that defect precisely rather than recording it as accepted.
