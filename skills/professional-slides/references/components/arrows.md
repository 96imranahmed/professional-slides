# Arrows

Arrows communicate a real directional relationship: inference, transfer, handoff, movement, or transition. They are not decoration and must not be added merely because content reads from left to right.

## Selection

Choose the preferred relationship treatment unless density or semantics require another registered variant:

- `disc-chevron`: one white or on-primary chevron inside a filled primary-colour disc. This is the preferred default for row-level implication and other clear one-step relationships.
- `line`: an open shaft and arrowhead. Use as the compact fallback when a dense mapping cannot support the preferred disc without crowding.
- `wedge`: a filled triangular mark without a container. Use for a stronger compact transfer when a line arrow would disappear, but avoid it when it could be mistaken for media playback.
- `disc-multi-chevron`: repeated chevrons inside a filled disc with a through-line. Reserve for a major transition, acceleration, or boundary crossing. Do not repeat it in every row of a dense ledger.

Use one arrow variant for one semantic relationship across a slide family. Do not mix variants merely for visual variety. Use `disc-chevron` for a repeated description-to-consequence row by default. Use `line` only as a controlled compact exception when the repeated row geometry cannot support the disc at a readable size.

## Geometry and placement

- Align the arrow to the centers of the two fields it connects.
- Keep disc arrows compact. Bind the standard disc diameter to `icon-md`, roughly one-third of a large emphasis disc, so it sits near the body-text line height rather than dominating the row.
- Keep repeated arrows on one axis and use one optical size, stroke, and arrowhead.
- Reserve whitespace for the arrow. Do not place it over a rule, heading, label, or body copy.
- Connector lines terminate at object boundaries. They do not run through text or unrelated nodes.
- Never draw a heading rule over an empty arrow slot. An unlabeled arrow column has no header line.
- Use editable native geometry or inline SVG. Do not use a text glyph, emoji, raster screenshot, or improvised symbol font.

## Theme contract

| Component | Consumed custom properties | Canonical source |
| --- | --- | --- |
| arrow | `--arrow-color`, `--arrow-surface`, `--arrow-on-surface`, `--arrow-connector`, `--arrow-size`, `--arrow-emphasis-size`, `--arrow-wide-size`, `--arrow-stroke`, `--arrow-connector-stroke` | [component bindings](../theming/component-bindings.md#text-and-section-components) |

## Structural HTML reference

```html
<div class="deck" data-theme="executive-light" data-density="executive">
  <section class="arrow-gallery" aria-label="Registered arrow variants">
    <figure class="arrow-sample">
    <svg class="arrow" data-variant="line" viewBox="0 0 48 24" aria-hidden="true">
      <path d="M2 12h40"/><path d="m32 2 10 10-10 10"/>
    </svg>
    <figcaption>Line</figcaption>
    </figure>

    <figure class="arrow-sample">
    <svg class="arrow" data-variant="wedge" viewBox="0 0 36 36" aria-hidden="true">
      <path d="M5 3 31 18 5 33Z"/>
    </svg>
    <figcaption>Wedge</figcaption>
    </figure>

    <figure class="arrow-sample">
    <svg class="arrow" data-variant="disc-chevron" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="29"/>
      <path d="m25 17 15 15-15 15"/>
    </svg>
    <figcaption>Disc chevron</figcaption>
    </figure>

    <figure class="arrow-sample">
    <svg class="arrow" data-variant="disc-multi-chevron" viewBox="0 0 96 64" aria-hidden="true">
      <path class="arrow__connector" d="M0 32h96"/>
      <circle cx="48" cy="32" r="29"/>
      <path class="arrow__mark" d="m23 18 14 14-14 14m14-28 14 14-14 14m14-28 14 14-14 14"/>
    </svg>
    <figcaption>Disc multi-chevron</figcaption>
    </figure>
  </section>
</div>
```

```css
.arrow {
  --arrow-color: var(--component-primary);
  --arrow-surface: var(--component-primary);
  --arrow-on-surface: var(--on-primary);
  --arrow-connector: var(--page-guideline);
  --arrow-size: var(--icon-md);
  --arrow-emphasis-size: var(--icon-lg);
  --arrow-wide-size: var(--space-6);
  --arrow-stroke: var(--line-standard);
  --arrow-connector-stroke: var(--line-hairline);

  display: block;
  width: var(--arrow-size);
  height: var(--arrow-size);
  overflow: visible;
}

.arrow[data-variant="line"] {
  fill: none;
  stroke: var(--arrow-color);
  stroke-width: var(--arrow-stroke);
  stroke-linecap: round;
  stroke-linejoin: round;
}

.arrow[data-variant="wedge"] {
  fill: var(--arrow-color);
  stroke: none;
}

.arrow[data-variant="disc-chevron"] {
  width: var(--arrow-emphasis-size);
  height: var(--arrow-emphasis-size);
}

.arrow[data-variant="disc-chevron"] circle,
.arrow[data-variant="disc-multi-chevron"] circle {
  fill: var(--arrow-surface);
}

.arrow[data-variant="disc-chevron"] path,
.arrow[data-variant="disc-multi-chevron"] .arrow__mark {
  fill: none;
  stroke: var(--arrow-on-surface);
  stroke-width: var(--arrow-stroke);
  stroke-linecap: round;
  stroke-linejoin: round;
}

.arrow[data-variant="disc-multi-chevron"] {
  width: var(--arrow-wide-size);
  height: var(--arrow-emphasis-size);
}

.arrow[data-variant="disc-multi-chevron"] .arrow__connector {
  fill: none;
  stroke: var(--arrow-connector);
  stroke-width: var(--arrow-connector-stroke);
}

.arrow-gallery {
  box-sizing: border-box;
  width: var(--slide-width);
  height: var(--slide-height);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-8);
  align-items: center;
  padding: var(--slide-margin-block) var(--slide-margin-inline);
  background: var(--canvas);
  color: var(--ink);
}

.arrow-sample {
  margin: 0;
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  color: var(--text-secondary);
  font: var(--type-label);
}
```

## Native translation

Build each arrow from editable native line and shape geometry, preserving the registered viewBox proportions and optical size. Keep the shaft and arrowhead grouped. For disc variants, place connector lines behind the disc and chevrons. Resolve fill, stroke, and contrast from the active theme rather than storing local colours.

## Acceptance check

- The arrow expresses a named relationship that is not already obvious from proximity.
- One relationship uses one registered variant throughout its slide family.
- The preferred implication treatment is the filled `disc-chevron` with an on-primary chevron; `line` is a compact fallback rather than the ordinary default.
- Disc arrows remain compact at approximately the body-text line height and never become a competing focal object in a repeated row.
- Repeated arrows share one axis, size, stroke, and alignment.
- The selected variant has enough emphasis for its job without competing with the evidence.
- Empty arrow header slots have no visible rule.
- Every arrow remains editable and uses theme-bound colours and dimensions.
