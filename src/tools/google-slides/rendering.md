# Google Slides Rendering and QA

Render the native final deck, even when it originated as a verified PPTX. Import
can change fonts, wrapping, crops, connectors, line weights, charts, and object
ordering.

## Preferred complete-deck render

Export the native presentation once as PDF, then rasterize every PDF page
locally at a fixed DPI:

```text
native presentation
  -> Drive/connector PDF export
  -> verify PDF bytes and page count
  -> pdftoppm at 120-150 DPI
  -> ordered slide PNGs mapped to native slide IDs
  -> full-size inspection + contact sheet
```

This is more efficient and internally consistent than requesting one thumbnail
per slide. Use a fresh output directory and refuse to overwrite prior evidence
from another candidate.

The Codex Google Slides integration provides a host helper that exports the
presentation as PDF, materializes it safely in the workspace, renders through
the bundled `pdftoppm`, and checks page count against the parsed design system.
Use the installed current helper rather than copying its implementation here.

## Thumbnail API

`presentations.pages.getThumbnail` generates a PNG or JPEG thumbnail for one
page and returns its dimensions plus a temporary content URL. Use it for a
targeted post-repair check or a small read-only inspection, not as the primary
full-deck render loop.

The returned URL is short-lived (Google's current sample documentation states a
default lifetime of 30 minutes). Download it promptly and do not persist it as
artifact provenance.

## Structural preflight

Before the first output render:

- read the final presentation resource;
- verify final slide IDs and order;
- remove unused template-library slides;
- scan for empty native bullet paragraphs;
- reject typed bullet glyphs used instead of native lists;
- detect unresolved placeholder text;
- detect empty text placeholders and structurally blank slides;
- verify minimum narrative font sizes against the active template;
- verify every meaning-bearing media slot was mapped.

Structural checks find candidates for review; they do not replace visual
inspection.

## Visual QA

Inspect every rendered slide at full size for:

- font substitution and changed text metrics;
- action-title wrapping;
- object movement, z-order, or connector changes;
- stretched or clipped images and screenshots;
- table row heights and cell padding;
- chart labels, legend, series colors, and axes;
- source/footer position and legibility;
- native theme and section-tracker continuity;
- stale exemplar text, media, or hidden placeholders.

Inspect a contact sheet for slide rhythm and density. Collect all defects before
one consolidated native repair batch. A structural rebuild invalidates prior
QA; render the complete final deck again.

## Cross-platform parity

For dual delivery, compare representative pairs for title, divider, executive
summary, chart, table, process, and appendix slides. Record intentional
differences. Do not require pixel identity when native editability produces a
better platform-appropriate result, but do require equivalent hierarchy,
meaning, and brand/theme behavior.

## Render manifest

Record:

- presentation ID and revision/readback timestamp;
- canonical native URL;
- exported PDF hash and page count;
- ordered mapping of page image to native slide ID;
- DPI and renderer version;
- output-issue report;
- QA ledger and repair batch count.

The native URL is the primary deliverable. The PDF and PNGs are QA evidence,
not substitutes for the editable deck.

## Official references

- [Generate slide thumbnails](https://developers.google.com/workspace/slides/api/samples/slides#generate_a_thumbnail)
- [Google Slides API pages](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations.pages)
- [Drive export formats](https://developers.google.com/workspace/drive/api/guides/ref-export-formats)
