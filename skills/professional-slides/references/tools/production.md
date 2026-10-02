# Production

## Commands

The pipeline, in order, with each step's stop condition, is in [SKILL.md](../../SKILL.md#pipeline); follow it rather than calling the build directly. The flags of every command and the exit codes (0 done, 1 crash, 2 refused, 3 waiting on a reviewer) are in the [runtime guide](../../runtime/README.md#commands).

`build-deck.mjs` composes the deck/v3 spec, lays it out against measured text, emits an editable PPTX with python-pptx, renders it with LibreOffice, reads the saved file back and runs the page gates and the density profile. Only a blocker fails the build: exit 0 with status `built` (or `built-unrendered` under `--no-render`) when nothing blocks, with the advisories counted for the review; exit 2 with `built-with-blockers` and every blocker listed with its source (the deck is still written for inspection), or `Refused (CODE): ...` when the input breaks a stage contract before anything is built. `--preflight` runs the plan and story gates without export; it is a check, not a step toward delivery. A new deck is built from the full compile's deck, content and plan: a draft's content plan does not meet the text contract the build holds a new deck to ([Planning contract](../storyline-records.md#planning-contract)).

`deliver-deck.mjs` hands over `out/<id>-DELIVERED.pptx` only when, in this order:

- a rendered build's gates and readback pass (`MISSING_RENDERED_GATES`);
- the deck carries its verbatim `request` and any `waivers` are well formed (`REQUEST_MISSING`, `WAIVERS_INVALID`);
- the storyline critique is `ready` for the deck's current spine (`STORYLINE_UNREVIEWED`; [Storylining](../storylining.md#stress-test-the-storyline));
- every build bar passes, or the deck's `waivers` name it (`BAR_EXHIBIT_VARIETY` and its siblings in `runtime/build-bars.mjs`, measured once the deck has 12 analytical pages; an empty picture frame always counts);
- `out/self-check.json` covers the build's claim ledger (`SELF_CHECK_INCOMPLETE`);
- the review loop accepts, and confirms each waiver ([Taste review](../taste-review.md#acceptance-confirmation-and-build-bars) owns the passes, the confirmation read, the caps and the lineage).

A rejection writes `out/REJECTED.md` and `delivery.json` with the blockers and removes any earlier deliverable. A packet waiting for a reader leaves `delivery.json` with `review.status: "pending"`, the staged packet's path and a `note` saying which prompt to give and where to save the answer.

## Environment

Run `node runtime/doctor.mjs` first (pipeline step 0). It checks Node 20.9 or newer; finds a Python that imports python-pptx, lxml, Pillow, numpy and pypdf, trying `RUNTIME_PYTHON`, `python3`, `/usr/bin/python3` and `/opt/homebrew/bin/python3`, and prints the `export RUNTIME_PYTHON=...` line when the one it finds is not the default; checks `soffice` (LibreOffice), `pdftoppm` and `pdftotext` (poppler); and reports the optional `@napi-rs/canvas`. Each missing piece gets an install line for the platform. It exits 0 when ready and 2 when not; `--no-render` checks for authoring and unrendered builds only, and `--json` prints the result as one object.

```bash
python3 -m pip install -r requirements.txt          # python-pptx, lxml, Pillow, numpy, pypdf
brew install --cask libreoffice && brew install poppler                  # macOS
sudo apt-get install -y libreoffice-impress poppler-utils                # Debian, Ubuntu
```

Set `RUNTIME_PYTHON` when the packages live in an environment of their own. No Codex runtime and no PptxGenJS are needed; `@napi-rs/canvas`, when installed, measures text against the real fonts instead of the bundled metrics.

## Rendering

The build renders with LibreOffice headless by default: exported PPTX to PNG per slide, plus a python-pptx readback that recovers each shape's frame, text and line count from the saved file.

The exported file is the candidate of record. Keep meaning-bearing content native and separately addressable: one paragraph per real paragraph, `wrap="square"`, autofit on the body, title and body placeholders on a real layout set, native charts with embedded workbooks, and grouped diagram geometry. Then a reader can edit the deck, Reset Slide works, and a template swap keeps the content.

Inspect every rendered slide for title wrapping, overflow, font substitution, chart labels and number formats, image crops, master furniture and source notes, connector routing, tracker states and page numbers. After a structural repair, render the whole deck again.

The skill writes PowerPoint only. Google Slides is a downstream import the user makes: finish and verify the PPTX, import it, then verify the native deck separately. Import can change fonts, wrapping, crops, connectors, line weights, charts and object order, so parity stays unverified until the native render is inspected.

## What the gates check

The thresholds live in `runtime/gates/gate_config.py` and `runtime/weight.json`,
and `runtime/gates/page_gates.py` is the command that runs the gates; the
code catalogue is in [Evaluation](../evaluation/index.md). Reports distinguish
blocking findings from advisory distribution, whitespace and decoration counts.
Do not add content or visual devices to satisfy advisory percentages. Review the
rendered argument and retain purposeful neutral exhibits and open space.

For complete-copy decks, the dot-dash's matched-reference coverage and wording
checks persist through composition and export. Global body-word, whitespace and
annotation diagnostics are additional review prompts; they do not replace that
contract or justify padding a page. Name the missing reasoning before adding
text, and preserve complete compact comparisons when no premise is missing.

What a new deck and a rebuilt deck must carry - the workflow, stable IDs, title
parity, the executive summary before the first section - is the
[planning contract](../storyline-records.md#planning-contract).

## What delivery refuses

Delivery hands over a deck only when the checks under [Commands](#commands) pass for the exact current PPTX, scene and renders; every rebuild invalidates the previous review, and the next pass verifies the changed pages. When a check fails, the findings are the result: `REJECTED.md` and `delivery.json` report the blocking findings and no `*-DELIVERED.pptx` remains. The build artifact is retained for inspection.

Blocking findings are factual errors, unsupported claims, misleading comparisons, missing evidence on a ranked criterion, missing argument, unreadable text, overflow, broken geometry, broken dependencies and provenance failures; editorial preferences are advisory. A missing-argument finding names the absent premise and a concrete repair, because blank space or a low word count on its own is a diagnostic.

## Repairs

Consolidate findings by cause with their affected slide IDs and one coordinated repair. A wrong value returns to the evidence and the specification; a missing comparison returns to the argument plan; clipping returns to the composition. A shared change invalidates every page that uses it, so recheck those renders. When the repair allowance ends with a defect unresolved, report that defect precisely rather than recording it as accepted.


## Portable evidence and release

Keep the model/fixture generator and declared inputs with the evidence package. Before acceptance, run its documented command in an isolated directory containing only those inputs, and compare regenerated records with the plotted values. Historical authoring scripts remain provenance, not portable generators, when they require earlier iteration folders. Include designed thresholds, resources and numerical rehearsals in the cited record; [Storylining](../storylining.md#reconcile-evidence-before-design) owns their meaning.

For shared changes, run the smallest relevant semantic export probes before a full build: signed values, unequal time intervals, equal physical peer scales, references, labels and nested treatments. These checks concern visual truth, not screenshot resemblance. Inspect the exact saved PPTX/PDF/PNGs after export; no scene-only assertion certifies the adapter.

When releasing a changed skill, package and install the source version, verify source/package/cache hashes, and regenerate the evaluation through that installed standard runtime. Record the skill version/hash and candidate identity in the evaluation report. Acceptance belongs to the exact reviewed artifact; older or unrendered authored repairs remain unverified. Keep technical checks, independent taste judgment and user acceptance separate.
