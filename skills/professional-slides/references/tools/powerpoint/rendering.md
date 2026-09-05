# PowerPoint Rendering and QA

An authoring-time render is optional and accelerates iteration. A render of the exact saved PPTX is mandatory release evidence.

## Pipeline

```text
in-memory deck
  -> per-slide PNG + layout JSON
  -> PPTX export
  -> independent PPTX-to-PDF/PNG render
  -> per-slide inspection + montage
  -> consolidated repair
  -> re-export and complete re-render
```

## 1. Authoring-time render

With Artifact Tool, export each slide as PNG and layout JSON. Use layout data to detect out-of-bounds objects and to locate warnings, then confirm every finding visually. Create a montage for deck-level rhythm but never use the montage as a substitute for full-size review.

## 2. Exported-file render

Render the exact saved PPTX with the host's bundled renderer or a known PowerPoint-compatible headless office suite. In Codex, use the Presentations skill's current `container_tools/render_slides.py` and `slides_test.py`; resolve their paths from the installed skill instead of copying them here.

If the file is stored in OneDrive/SharePoint, Microsoft Graph may convert a supported PPTX to PDF through `content?format=pdf`. Treat the returned PDF as a rendering signal, then rasterize every page at a consistent DPI for inspection.

## 3. Native PowerPoint proof

When exact desktop behavior matters, open the final PPTX in the requested PowerPoint client and verify representative slides, animations, embedded media, font substitution, and editability. A LibreOffice, Graph, or Artifact Tool render does not prove live desktop behavior.

## Render manifest

Record:

- candidate PPTX path and SHA-256;
- renderer name and version;
- page count;
- ordered render filenames;
- slide width/height and DPI/scale;
- render timestamp;
- font substitutions or warnings;
- overflow/overlap findings;
- QA ledger status.

Fail if the page count differs from the storyboard or if renders cannot be unambiguously mapped to slide order.

## Visual inspection

Inspect every slide for:

- title wrapping and content overflow;
- unexpected font substitution;
- charts, labels, axes, legends, and number formats;
- image crops and resolution;
- master/layout furniture and source notes;
- empty placeholders or template sample content;
- connector routing and object order;
- dark/light theme continuity;
- section tracker and page number correctness.

After any structural repair, render the entire deck again. After a local repair, at minimum re-render the affected slide and the full montage; before delivery, the final complete deck must have one consistent render set.

## Hard acceptance loop

Use [PowerPoint hard acceptance](acceptance.md) for the validator and repair loop; the [evaluation owner](../../evaluation/index.md#powerpoint-reports) controls release evidence.

## Independent visual reports

When the evaluation owner requires independent PowerPoint reports, use these commands for the exact render set.

```bash
python3 evals/scripts/validate_pptx.py visual path/to/candidate.pptx \
  --render-dir path/to/rendered-slides \
  --contract path/to/deck-contract.json \
  --theme-manifest path/to/theme-manifest.json \
  --treatment-ledger path/to/treatment-ledger.json \
  --generation-script path/to/build-deck.cjs \
  --model gpt-5.6-terra \
  --report path/to/visual-review.json
```

Then run the cross-slide judge with a different approved model:

```bash
python3 evals/scripts/validate_pptx.py consistency path/to/candidate.pptx \
  --render-dir path/to/rendered-slides \
  --contract path/to/deck-contract.json \
  --theme-manifest path/to/theme-manifest.json \
  --treatment-ledger path/to/treatment-ledger.json \
  --generation-script path/to/build-deck.cjs \
  --model gpt-5.6-luna \
  --different-from-model gpt-5.6-terra \
  --report path/to/cross-slide-consistency-review.json
```

The [evaluation owner](../../evaluation/index.md#powerpoint-reports) defines report scope, acceptance, and rerun requirements.

## Rendering boundaries

- PDF is a QA derivative, not the editable deliverable unless requested.
- A thumbnail is insufficient for typography and source-note QA.
- A screenshot of the editor is not a stable final render.
