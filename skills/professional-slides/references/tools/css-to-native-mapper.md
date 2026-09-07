# Scene-to-native mapper

The canonical scene is the contract. HTML/CSS and PowerPoint are sibling adapters that consume the same resolved nodes, frames, tokens, text, and semantic metadata. CSS is not the authoring or templating language.

## Mapping pipeline

1. Validate the content plan. Every item states its job and references a registered component.
2. Resolve the open composition tree on the canonical 1280 by 720 canvas.
3. Resolve every visual value through the canonical token registry and attach token provenance to each scene node.
4. Serialize the scene to HTML for inspection. The adapter emits CSS variables from the tokens and positions SVG/text nodes from the resolved frames.
5. Serialize the same scene to editable PowerPoint through PptxGenJS. Convert pixels to inches once; keep font and line values in native point units.
6. Materialize the canonical PowerPoint theme and deterministic `ps:<scene-node-id>` object names.
7. Import the exact PPTX with Artifact Tool. Verify slides, named objects, geometry records, fonts, and theme values.
8. Render both outputs and compare full-frame and foreground pixels for every isolated fixture.

## Portable layout record

The executable record supports row and column flow, grid tracks, overlay, absolute placement, nested sections, and components. Sizes may be fixed, fill, hug, fractional, or percentage-based. Parent nodes own gaps and padding. Components own only their internal geometry.

Do not turn flex, grid, intrinsic size, or content-driven tracks into scattered page coordinates. Do not read browser layout and then independently approximate it in PowerPoint. Resolve layout once in the scene compiler.

## Token mapping

HTML uses each token’s canonical CSS custom-property name. PowerPoint uses a native theme slot when the token has one and a resolved native value when the standard theme has no independent slot. Both adapters retain the same token ID and resolved value in the design-provenance manifest.

Every component declares the tokens it consumes. Scene compilation rejects undeclared consumption before either adapter runs, so an adapter fallback cannot mask broken inheritance.

PowerPoint color-map aliases differ from theme-palette entries: `dk1`, `lt1`, `dk2`, and `lt2` become `tx1`, `bg1`, `tx2`, and `bg2` when referenced by slide objects. The adapter owns this translation. Components never do.

Materialize resolved corner radii explicitly. PowerPoint's default round-rectangle preset does not inherit the scene radius; validate its native geometry adjustment against the token value.

## Chart mapping

Charts compile to editable vector marks, labels, axes, legends, highlights, reference lines, and annotations. Bind callouts to stable category and series keys before layout. Use the [shared chart-legend owner](../components/chart-legends.md) for placement and variants. Pie and donut geometry uses mathematical angles in every representation: zero degrees is three o'clock and minus ninety degrees is twelve o'clock. HTML and PowerPoint consume those angles directly, and data labels use each segment midpoint. Do not rotate angles again at an adapter boundary.

The current PowerPoint runtime always uses deterministic editable vectors and rejects native chart parts. This keeps plot geometry, annotations, and theme mappings under the same scene contract through export and Artifact Tool import.

Use a raster fallback only with explicit owner approval. Preserve the source data and semantic chart model so the visual can be regenerated or replaced.

## Acceptance

- The HTML DOM contains every expected named scene node.
- The PPTX package contains every `ps:` object name and the complete native theme.
- The PPTX package contains no rasterized component media or native chart parts.
- Artifact Tool recovers every slide and every named object from the PptxGenJS output, with frame drift no greater than one pixel.
- Full-frame and foreground comparison pass for every component and chart fixture.
- A sparse canvas cannot hide a broken local component.
- No adapter introduces a visual literal, label, or component that is absent from the scene.
- Explicit heading wraps, measured heights, and text-to-rule gaps survive both adapters without shrink-to-fit. The [overlap gate](../evaluation/index.md#component-runtime-gate) accepts every slide before release.
