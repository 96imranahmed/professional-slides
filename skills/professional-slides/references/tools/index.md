# Tools

This directory owns platform implementation and rendering mechanics. It does not redefine storylining, design, slide archetypes, charts, or components.

## Choose the route

- Read [`powerpoint/`](powerpoint/index.md) for editable PPTX authoring, PowerPoint-specific APIs, adapter selection, and saved-file rendering.
- Read [`google-slides/`](google-slides/index.md) for native Google Slides authoring, import/export, Slides API operations, and native rendering.
- For dual-format delivery, build and verify each final platform independently and keep a parity ledger for conversion-sensitive differences.

Use one authoring adapter for each candidate artifact. Object-tree inspection supports debugging, but final quality claims require renders from the exact editable artifact being delivered.

## Geometry adapter contract

Platform tools consume platform-neutral tokens and bindings from [`theming/`](../theming/index.md), composition and guide decisions from [`design/`](../design/index.md), and object contracts from [`components/`](../components/index.md). They implement those decisions; they do not invent a second type scale, spacing scale, grid, or component geometry.

- Define named constants for the canvas, margins, title, content, source, footer, columns, gutters, typography roles, spacing tokens, and component variants.
- Derive positions through helpers such as `columnStart(n)`, `columnSpan(start, count)`, `placeInRegion(region, inset)`, and `alignPeers(objects, edge)` instead of scattering literal coordinates through the builder.
- Keep one canonical design-unit model and convert once at the adapter boundary. Apply one rounding policy to final platform values rather than repeatedly rounding intermediate calculations.
- Use the platform's master, layout, placeholder, group, or reusable-style mechanism for repeated geometry wherever supported.
- Keep local optical offsets named and scoped to an asset or component family. Do not let one-off nudges become undocumented constants.
- Read back final object geometry and text styles when the platform supports it, then inspect the exact final render. Coordinate equality does not prove visible alignment after font substitution, chart padding, strokes, or image cropping.
- Recalculate trackers, page numbers, continuation states, cross-references, and component visibility after structural mutations.

Each platform folder owns its API operations, native units, transformation model, object targeting, and rendering path.

## Vector icon implementation

Consume the exact library and icon-name mapping selected by [`icons-and-logos`](../components/icons-and-logos.md). Load the available package export or official SVG definition, retain the source viewBox and path geometry, and apply deck colour and size at the adapter boundary. Do not trace, redraw, or approximate a named library icon from memory; do not substitute Unicode, emoji, or an icon font when a vector asset is expected.

Keep semantic icons as vectors when the selected platform and final renderer preserve them reliably. If vector support fails in the exact delivery path, rasterize the verified source SVG to a transparent high-resolution fallback while preserving the same box, optical size, and semantic mapping, then disclose the editability limitation. Group or name each icon with its associated label or cell for stable inspection, and verify the mark at full size in the exact final render; object presence alone does not prove that its strokes remain visible or aligned.
