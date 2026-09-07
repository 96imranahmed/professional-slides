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

Display ordinary ordinal numbers as natural integers without leading zeros. Use `1`, `2`, and `3`, not `01`, `02`, and `03`. Preserve meaningful hierarchical numbers and exact source-required identifiers.

## Theme contract

| Component | Consumed custom properties | Canonical source |
| --- | --- | --- |
| item indicator | `--item-indicator-bg`, `--item-indicator-color`, `--item-indicator-border`, `--item-indicator-accent-bg`, `--item-indicator-accent-color`, `--item-indicator-keyline`, `--item-indicator-size`, `--item-indicator-font`, `--item-indicator-radius-square`, `--item-indicator-radius-circle` | [component bindings](../theming/component-bindings.md#text-and-section-components) |

## Native translation

Build every indicator as editable native shape plus editable text. Center the text box horizontally and vertically inside the shape; do not rely on the surrounding row's baseline. In a dedicated column, align the indicator center to both the column center and the row center. In `embedded-start`, align the indicator center to the field boundary and the row center, then reserve enough inset so the label never collides with it. Materialize `accent-fill` with the resolved primary fill and on-primary text. Materialize `inverse-keyline` with the inverse field fill and a hairline in the resolved on-inverse color. Preserve the same optical size across square and circle variants.

## Acceptance check

Verify each mark identifies or orders a peer instead of scoring it. Centre every glyph within its shape and every dedicated indicator within its column. Embedded indicators overlap the leading edge consistently without clipping. Prefer inverse fill with an on-inverse keyline. Keep accent-fill alternatives distinct from their backing field. Peers use one construction. Deleting an indicator must not remove the semantic label.
