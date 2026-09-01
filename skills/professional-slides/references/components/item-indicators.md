# Item Indicators

Item indicators identify or order repeated categories, rows, or sections. They carry a short number or letter, not a score or status. Use [`comparison indicators`](comparison-indicators.md) when the mark encodes progress, readiness, or another measured state, and use [`arrows`](arrows.md) when the mark expresses a relationship.

## Selection

- `square` is the default for compact numbered ledgers and formal ordered lists.
- `circle` supports either a number or a letter and works well when the marker sits on a line or overlaps the edge of a category field.
- `column` places the indicator in a dedicated layout slot. Center it horizontally within the indicator column and vertically within its row.
- `embedded-start` places the indicator on the leading edge of the label or trend field. Center it vertically and let approximately half of the shape jut outside the field.
- `inverse-keyline` is the preferred embedded number or letter treatment. It keeps the circle on the field's inverse surface and adds a hairline in `on-inverse`, producing the slight white border used against a coloured label field.
- `accent-fill` is the secondary contrast option. It separates an embedded circle from its backing field with a different theme primary plus the matching `on-primary` text.

Use one shape, content pattern, size, placement mode, and contrast treatment for every peer in the component. Embedded circles use `inverse-keyline` by default. Use `accent-fill` only when the theme provides a clearly distinct primary and the category hierarchy benefits from the extra contrast. An indicator supplements the category label; it does not replace meaningful label text.

## Theme contract

| Component | Consumed custom properties | Default binding |
| --- | --- | --- |
| item indicator | `--item-indicator-bg`, `--item-indicator-color`, `--item-indicator-border`, `--item-indicator-accent-bg`, `--item-indicator-accent-color`, `--item-indicator-keyline`, `--item-indicator-size`, `--item-indicator-font`, `--item-indicator-radius-square`, `--item-indicator-radius-circle` | inverse surface, on-inverse text, no border, component primary, on-primary text, hairline in on-inverse, icon-lg, label role, square radius, round radius |

## Structural HTML reference

~~~html
<div class="deck" data-theme="executive-light" data-density="executive">
  <div class="item-indicator-gallery" aria-label="Item indicator variants">
    <span class="item-indicator" data-shape="square" data-placement="column">01</span>
    <span class="item-indicator" data-shape="circle" data-placement="column">2</span>
    <span class="item-indicator" data-shape="circle" data-placement="column">A</span>
    <div class="item-indicator-field">
      <span class="item-indicator" data-shape="circle" data-placement="embedded-start" data-contrast="accent-fill">3</span>
      <span>Accent fill</span>
    </div>
    <div class="item-indicator-field" data-surface="inverse">
      <span class="item-indicator" data-shape="circle" data-placement="embedded-start" data-contrast="inverse-keyline">4</span>
      <span>Inverse keyline</span>
    </div>
  </div>
</div>
~~~

~~~css
.item-indicator {
  --item-indicator-bg: var(--surface-inverse);
  --item-indicator-color: var(--on-inverse);
  --item-indicator-border: 0;
  --item-indicator-accent-bg: var(--component-primary);
  --item-indicator-accent-color: var(--on-primary);
  --item-indicator-keyline: var(--line-hairline) solid var(--on-inverse);
  --item-indicator-size: var(--icon-lg);
  --item-indicator-font: var(--type-label);
  --item-indicator-radius-square: var(--radius-0);
  --item-indicator-radius-circle: var(--radius-round);

  box-sizing: border-box;
  width: var(--item-indicator-size);
  height: var(--item-indicator-size);
  display: grid;
  place-items: center;
  flex: none;
  border: var(--item-indicator-border);
  background: var(--item-indicator-bg);
  color: var(--item-indicator-color);
  font: var(--item-indicator-font);
  line-height: 1;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.item-indicator[data-shape="square"] { border-radius: var(--item-indicator-radius-square); }
.item-indicator[data-shape="circle"] { border-radius: var(--item-indicator-radius-circle); }

.item-indicator[data-contrast="accent-fill"] {
  --item-indicator-bg: var(--item-indicator-accent-bg);
  --item-indicator-color: var(--item-indicator-accent-color);
}

.item-indicator[data-contrast="inverse-keyline"] {
  --item-indicator-border: var(--item-indicator-keyline);
}

.item-indicator[data-placement="column"] {
  place-self: center;
}

.item-indicator-field {
  position: relative;
  display: flex;
  align-items: center;
  min-height: var(--space-9);
  padding-inline-start: var(--space-6);
  background: var(--surface-1);
}

.item-indicator-field[data-surface="inverse"] {
  background: var(--surface-inverse);
  color: var(--on-inverse);
}

.item-indicator[data-placement="embedded-start"] {
  position: absolute;
  inset-inline-start: 0;
  top: 50%;
  transform: translate(-50%, -50%);
}

.item-indicator-gallery {
  width: var(--slide-width);
  height: var(--slide-height);
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: center;
  gap: var(--space-6);
  padding: var(--slide-margin-block) var(--slide-margin-inline);
  background: var(--canvas);
  color: var(--ink);
  font: var(--type-section-heading);
}
~~~

## Native translation

Build every indicator as editable native shape plus editable text. Center the text box horizontally and vertically inside the shape; do not rely on the surrounding row's baseline. In a dedicated column, align the indicator center to both the column center and the row center. In `embedded-start`, align the indicator center to the field boundary and the row center, then reserve enough inset so the label never collides with it. Materialize `accent-fill` with the resolved primary fill and on-primary text. Materialize `inverse-keyline` with the inverse field fill and a hairline in the resolved on-inverse color. Preserve the same optical size across square and circle variants.

## Acceptance check

Every mark identifies or orders a peer rather than encoding a score, each number or letter is horizontally and vertically centered within its shape, dedicated-column indicators are horizontally and vertically centered, embedded indicators overlap the leading edge consistently without clipping, the preferred embedded treatment is the inverse fill with an on-inverse keyline, the accent-fill alternative remains visibly distinct from its backing field, every peer uses one construction, and deleting the indicator does not remove the category's semantic label.
