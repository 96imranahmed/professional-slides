# Google Slides Implementation

Use these rules for native Google Slides delivery and for dual-format decks.

## Choose the route

- For an existing native Google Slides deck, edit it natively when the available
  toolchain can preserve its theme and object structure.
- For a new native deck, create and fully verify the PPTX when that is the most
  reliable authoring route, then import it as native Google Slides.
- Do not provide a PPTX link as if it were a native Google Slides deliverable.
- For dual-format delivery, treat the imported native deck as a separate final
  artifact and QA it separately.

## Design for conversion

- Use fonts available in Google Slides or define a tested fallback.
- Prefer rectangles, lines, circles, native tables, and native charts.
- Avoid unsupported custom geometry, fragile masks, exotic gradients, uncommon
  dash styles, and effects whose semantics depend on PowerPoint.
- Use standard image formats and test SVG/EMF/TIFF conversion.
- Keep groups shallow and connectors simple.
- Keep text boxes comfortably within their bounds; import changes metrics.
- Avoid line breaks inserted only to fit PowerPoint.

## Theme behavior

Recreate or preserve the same semantic roles:

- action title;
- body and micro text;
- dark and light canvas;
- accent and contextual series;
- section tracker;
- footer, source, and page number;
- title/divider/content/appendix layouts.

Native Google Slides themes and layouts should carry repeated furniture. Do not
duplicate global elements onto every page unless the native API has no
appropriate theme capability and the limitation is documented.

## Charts and tables

- Prefer editable native charts when reliable.
- Verify data labels, axis bounds, legends, and series colors after import.
- If a chart becomes a static image, disclose the editability tradeoff.
- Recheck table row heights, cell padding, and font substitution.
- Keep source text and footnotes within the visible canvas.

## Notes, links, and collaboration

- Preserve speaker notes and source blocks where the import route supports them.
- Verify hyperlinks after import.
- Use a clear file name and avoid duplicate working copies in the user's Drive.
- Confirm the returned URL opens the native Google Slides file, not an upload
  preview or converted Office attachment.

## Google Slides QA

After native import or editing:

1. Open the final native deck.
2. Render or inspect every slide in the native environment.
3. Compare representative title, divider, summary, chart, table, process, and
   appendix slides with the verified PPTX renders.
4. Fix font substitution, wrapping, alignment, crops, line weights, chart
   semantics, and object-order changes.
5. Recheck page numbers, section tracker state, sources, notes, and links.
6. Verify requested collaborators or sharing settings only when the user has
   asked for them.

Do not claim platform parity until the native deck has been inspected.

