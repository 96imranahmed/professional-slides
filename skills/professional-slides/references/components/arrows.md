# Arrows

Arrows communicate a real directional relationship: inference, transfer, handoff, movement, or transition. They are not decoration and must not be added merely because content reads from left to right.

## Selection

Choose the preferred relationship treatment unless density or semantics require another supported variant:

- `disc-chevron`: one white or on-primary chevron inside a filled primary-colour disc. This is the preferred default for row-level implication and other clear one-step relationships.
- `chevron`: one small shaftless primary-colour chevron without a disc. Prefer this visually light treatment between two open reasoning lists.
- `line`: an open shaft and arrowhead. Use as the compact fallback when a dense mapping cannot support the preferred disc without crowding.
- `labelled-line`: the line treatment with a necessary relationship label.

The shared `connector` component exposes these four variants through `props.variant`. `wedge` and `disc-multi-chevron` are not selectable runtime variants. If an authorized reference requires either, extend and test the canonical connector owner first rather than drawing an ad-hoc slide-local arrow.

Use one arrow variant for one semantic relationship across a slide family. Do not mix variants merely for visual variety. Use `disc-chevron` for a repeated description-to-consequence row by default. Use `line` only as a controlled compact exception when the repeated row geometry cannot support the disc at a readable size.

## Geometry and placement

- Align the arrow to the centers of the two fields it connects.
- For adjacent reasoning lists, center the chevron vertically on the measured bullet-content span, not the slide, section heading, oversized container, or last text baseline. With unequal list heights, use the midpoint of their combined content extent and keep it within the shared reading field.
- The shaftless chevron uses the canonical `icon.medium` height and three-quarter-width proportion; a wider gutter does not enlarge the mark.
- Keep disc arrows compact. Bind the standard disc diameter to `icon-md`; this token is the sole normative size rule.
- Keep repeated arrows on one axis and use one optical size, stroke, and arrowhead.
- Reserve whitespace for the arrow. Do not place it over a heading, label, or body copy. A [split-section inference divider](guidelines.md#split-section-relationships) may terminate above and below a disc-chevron; never run the divider through its marker.
- Connector lines terminate at object boundaries. They do not run through text or unrelated nodes.
- Never draw a heading rule over an empty arrow slot. An unlabeled arrow column has no header line.
- Use editable native geometry or inline SVG. Do not use a text glyph, emoji, raster screenshot, or improvised symbol font.

## Theme contract

| Component | Consumed custom properties | Canonical source |
| --- | --- | --- |
| arrow | `--arrow-color`, `--arrow-surface`, `--arrow-on-surface`, `--arrow-connector`, `--arrow-size`, `--arrow-emphasis-size`, `--arrow-wide-size`, `--arrow-stroke`, `--arrow-connector-stroke` | [component bindings](../theming/component-bindings.md#text-and-section-components) |

## Native translation

Build each arrow from editable native line and shape geometry, preserving the registered runtime proportions and optical size. Keep the shaft and arrowhead grouped. For disc variants, place connector lines behind the disc and chevrons. Resolve fill, stroke, and contrast from the active theme rather than storing local colours.

## Acceptance check

- The arrow expresses a named relationship that is not already obvious from proximity.
- One relationship uses one registered variant throughout its slide family.
- The preferred implication treatment is the filled `disc-chevron` with an on-primary chevron; `line` is a compact fallback rather than the ordinary default.
- Disc arrows use the resolved `icon-md` size and never become a competing focal object in a repeated row.
- Repeated arrows share one axis, size, stroke, and alignment.
- The selected variant has enough emphasis for its job without competing with the evidence.
- Empty arrow header slots have no visible rule.
- Every arrow remains editable and uses theme-bound colours and dimensions.
