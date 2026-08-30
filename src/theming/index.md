# Theme System

This directory owns visual tokens, masters and layouts, reference-derived theme
decisions, and cross-platform fallbacks. Narrative principles live in
[`design-foundations.md`](../design-foundations.md), component behavior in
[`components.md`](../components.md), and platform API mechanics in `tools/`.

## Choose the source of truth

1. When the user supplies a reference deck, follow
   [`template-intake.md`](template-intake.md) and derive one explicit theme.
2. When brand guidance is supplied, translate it into the theme contract.
3. Otherwise use [`theme-spec.example.json`](theme-spec.example.json), the
   neutral consulting default derived from the approved references recorded in
   [`source-manifest.json`](source-manifest.json).

Do not alternate between multiple visual systems. Resolve conflicts once when
defining the theme and record the chosen source for each design dimension.

## Theme contract

Define and validate a JSON theme against
[`theme-spec.schema.json`](theme-spec.schema.json) before implementation. It
must specify:

- canvas, safe zones, grid, spacing unit, and common anchors;
- display, action-title, body, and micro typography roles plus fallbacks;
- semantic colors and approved combinations;
- fills, strokes, corners, connectors, icons, and callout treatment;
- chart series order, axes, gridlines, labels, and forecast states;
- table header, body, subtotal, total, and selected states;
- title, divider, light-content, dark-content, chart, table, and appendix layouts;
- recurring component anchors and dark/light states;
- target-platform fallbacks for fonts, charts, images, and geometry.

Use tokens through masters, layouts, and styles rather than recreating them on
individual slides.

## Token semantics

Define colors by role rather than by slide: `ink`, `mutedInk`, `paper`,
`panel`, `rule`, `accent`, `accentSecondary`, `positive`, `caution`,
`negative`, `darkCanvas`, and `onDark`. Reserve the strongest accent for the
evidence that proves the title; contextual items should recede.

Use a primary type family available or safely substitutable on both target
platforms. Document fallbacks and re-render every affected slide after
substitution. Never rely on application defaults for font metrics, chart
styles, text insets, or line behavior.

Keep the layout family small. Preserve a supplied template's master hierarchy
when editing it; for a new deck, vary archetypes within stable title, body, and
footer zones.

## Neutral consulting default

The approved Slideworks and Umbrex references share a restrained grammar:

- white or very light analytical pages and dark navy title/divider pages;
- dark structural ink with one cyan or teal argumentative highlight;
- quiet gray rules, panels, sources, and navigation;
- a stable action-title zone and broad analytical canvas;
- flat editable charts, tables, shapes, and connectors;
- repeated layout families without visible authoring furniture.

Use these default roles when no source has priority:

| Role | Default | Reference range |
| --- | --- | --- |
| structural ink | `#051C2C` | Slideworks `#051C2C` / `#061F32` |
| dark canvas | `#16207B` | Umbrex `#16207B` / `#0A1A49` |
| argument accent | `#19D3C5` | Cyan/teal across both references |
| comparison blue | `#629CD0` | Umbrex light blue |
| paper | `#FFFFFF` | Shared light canvas |
| rule/panel | `#D7DCE5` / `#F2F4F7` | Shared neutral furniture |

Warm colors are semantic exceptions, not default series colors. Hide source
construction grids, template indexes, tutorials, sample copy, placeholder
branding, and unused library layouts in delivered decks.

## Cross-platform fallbacks

Define the fallback for every non-system font, chart feature, transparency,
SVG, mask, connector, and custom geometry. Favor native editable objects that
survive the requested platform. When fidelity and editability conflict, follow
the user's priority and record the limitation.

## Theme QA

Render a representative set containing title, divider, synthesis, chart,
table, process, and appendix pages in every requested final platform. Check
font substitution, text reflow, color, master inheritance, anchors, chart and
table styling, component states, and dark/light continuity.

Final delivery QA and effectiveness scoring remain exclusively under
[`evals/`](../../evals/quality-assurance.md).
