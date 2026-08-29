# PowerPoint Implementation

Use these rules for new or edited `.pptx` deliverables.

## Preserve presentation structure

- Use the requested source deck when one is designated as the template.
- Preserve theme parts, masters, layouts, placeholders, and notes.
- Put global typography, color, footer, logo, and tracker behavior in the theme,
  master, or layout at the correct level.
- Use slide-local objects only for slide-specific content.
- Keep inherited placeholders editable and fill or delete them intentionally.
- Do not flatten the deck into images or slide-local overlays.

## Author editable content

- Use native PowerPoint text, shapes, tables, charts, and connectors for simple
  structures.
- Keep chart data and series names editable.
- Use real tables when users need to update values; avoid tabbed text as a table.
- Use authentic raster assets for photography and screenshots.
- Preserve vector artwork only when it renders reliably and is authorized.
- Provide alt text for meaningful visuals when the authoring API supports it.

## Theme and master requirements

Create or preserve layouts for title, divider, standard content, chart-led,
table-led, and appendix pages. Centralize:

- title and content placeholders;
- font families and levels;
- palette and chart colors;
- footer/source/page-number anchors;
- section tracker states;
- logo slots;
- dark/light variants.

If editing a reference deck, do not replace its theme with a generated one.
Preserve its `ppt/theme/theme*.xml` parts where the authoring path supports exact
round-trip fidelity.

## Numeric and chart integrity

- Recompute totals and variances before rendering.
- Verify displayed labels against the underlying values after export.
- Inspect number formats, units, and rounding.
- Confirm category and series order.
- Confirm actual/forecast styling and legend semantics.
- Check that chart data remains editable in desktop PowerPoint.

## Object-order rules

- Create connectors before nodes when generating diagrams so edges sit behind
  objects.
- Keep decorative background objects at the back.
- Keep callouts and labels above their evidence without covering data.
- Use groups only when they improve editing and survive the toolchain.

## Notes and sources

Preserve existing speaker notes unless explicitly replacing them. Add a
consistent source block for externally sourced claims and assets. Keep detailed
calculation and provenance notes outside audience-facing slide content.

## PowerPoint QA

1. Open/export the final PPTX with a compatible renderer.
2. Render every slide to PNG or PDF.
3. Inspect every slide at full size and the deck as a montage.
4. Detect overflow, clipping, accidental title wrapping, and out-of-bounds
   objects.
5. Inspect the final PPTX package for empty inherited placeholders.
6. Open representative slides in desktop PowerPoint when live application
   verification is available.
7. Confirm masters/layouts remain intact and charts/tables are editable.
8. Confirm no authoring grids, template indexes, instructions, sample logos, or
   placeholder copy remain.

Do not claim live PowerPoint behavior from a file export alone.

