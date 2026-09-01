# Component Theme Bindings

Every reusable component exposes namespaced custom properties. Its Markdown owner defines meaning and geometry. This file defines the visual interface and default binding. Component specimens consume the namespaced property, not a global colour or spacing literal.

## Binding rules

- Use `--<component>-<property>` for reusable component values.
- Bind aliases once on the component root.
- Use a modifier class or `data-variant` only for a named construction.
- Use `data-state` only for a semantic state with a documented non-colour cue.
- External position and size belong to the parent layout. Internal padding belongs to the component.
- An absent property inherits from the base binding. It does not receive a local literal.

## Canvas and repeated furniture

| Component | Required custom properties | Default binding |
| --- | --- | --- |
| slide canvas | `--slide-bg`, `--slide-color`, `--slide-padding-inline`, `--slide-padding-block`, `--slide-column-gap` | `canvas`, `ink`, density margins, density grid gutter |
| action-title block | `--action-title-font`, `--action-title-color`, `--action-title-rule`, `--action-title-gap`, `--action-title-width` | action-title role, `ink`, page rule, density separator gap and title width |
| section title | `--section-title-font`, `--section-title-color`, `--section-title-rule` | section-title role, `ink`, quiet rule |
| source and footer | `--source-font`, `--source-color`, `--source-rule`, `--source-gap` | source role, secondary text, quiet rule, `space-1` |
| tracker | `--tracker-font`, `--tracker-active`, `--tracker-inactive`, `--tracker-rule`, `--tracker-gap` | label role, component-primary, muted ink, quiet rule, `space-2` |

## Text and region components

| Component | Required custom properties | Default binding |
| --- | --- | --- |
| body copy | `--body-font`, `--body-color`, `--body-paragraph-gap` | body role, `ink`, `space-3` |
| compact label | `--label-font`, `--label-color`, `--label-gap` | label role, secondary text, `space-1` |
| open analytical region | `--region-bg`, `--region-color`, `--region-rule`, `--region-padding` | transparent, `ink`, quiet rule, `space-0` |
| neutral panel | `--panel-bg`, `--panel-color`, `--panel-border`, `--panel-radius`, `--panel-shadow`, `--panel-padding` | surface-1, `ink`, quiet rule, component radius, component shadow, `space-4` |
| highlighted header | `--section-header-bg`, `--section-header-color`, `--section-header-font`, `--section-header-padding`, `--section-header-rule` | primary tint, `ink`, section-heading role, `space-3`, no extra rule |
| terminal action surface | `--action-surface-bg`, `--action-surface-color`, `--action-surface-font`, `--action-surface-padding-x`, `--action-surface-padding-y`, `--action-surface-border`, `--action-surface-radius` | primary tint, `ink`, callout role, `space-5`, `space-4`, none, component radius |
| description slide | `--description-slide-gap`, `--description-slide-row-gap`, `--description-slide-row-rule`, `--description-slide-row-padding`, `--description-slide-columns`, `--description-slide-heading-font`, `--description-slide-heading-color`, `--description-slide-heading-rule`, `--description-slide-heading-gap`, `--description-slide-label-bg`, `--description-slide-label-color`, `--description-slide-label-font`, `--description-slide-label-padding`, `--description-slide-label-gap`, `--description-slide-label-embedded-padding`, `--description-slide-body-font`, `--description-slide-body-color`, `--description-slide-body-gap`, `--description-slide-list-indent`, `--description-slide-side-bg`, `--description-slide-side-color`, `--description-slide-side-font`, `--description-slide-side-padding`, `--description-slide-icon-color`, `--description-slide-icon-size`, `--description-slide-icon-stroke`, `--description-slide-dense-font` | density grid gutter, `space-2`, quiet rule, symmetric `space-1`, named layout variant, body-sized column-heading role, `ink`, page rule, `space-2`, inverse surface, on-inverse text, section-heading role, `space-4`, `space-3`, `space-6`, compact body role, `ink`, `space-2`, `space-5`, transparent, `ink`, compact body role, `space-4`, component primary, icon-lg, standard line, compact body role |
| description with implication extension | `--description-implication-columns`, `--description-implication-implication-bg`, `--description-implication-implication-subtle-bg`, `--description-implication-implication-color`, `--description-implication-implication-font`, `--description-implication-implication-padding` plus inherited `--description-slide-*` aliases | named extension grid, transparent, `surface-1`, `ink`, callout role, `space-0`, Description Slide bindings |
| arrow | `--arrow-color`, `--arrow-surface`, `--arrow-on-surface`, `--arrow-connector`, `--arrow-size`, `--arrow-emphasis-size`, `--arrow-wide-size`, `--arrow-stroke`, `--arrow-connector-stroke` | component primary, component primary, on-primary text, page guideline, icon-lg, icon-md, `space-6`, standard line, hairline |
| item indicator | `--item-indicator-bg`, `--item-indicator-color`, `--item-indicator-border`, `--item-indicator-accent-bg`, `--item-indicator-accent-color`, `--item-indicator-keyline`, `--item-indicator-size`, `--item-indicator-font`, `--item-indicator-radius-square`, `--item-indicator-radius-circle` | inverse surface, on-inverse text, none, component primary, on-primary text, hairline in on-inverse, icon-lg, label role, square radius, round radius |

## Evidence components

| Component | Required custom properties | Default binding |
| --- | --- | --- |
| metric field | `--metric-font`, `--metric-hero-font`, `--metric-color`, `--metric-label-font`, `--metric-label-color`, `--metric-divider`, `--metric-gap` | metric roles, component-primary, label role, secondary text, quiet rule, `space-3` |
| data table | `--table-font`, `--table-compact-font`, `--table-header-bg`, `--table-header-color`, `--table-row-rule`, `--table-cell-padding-x`, `--table-cell-padding-y` | body roles, component-primary, on-primary, quiet rule, `space-3`, `space-2` |
| chart plot | `--chart-bg`, `--chart-axis`, `--chart-grid`, `--chart-label-font`, `--chart-label-color`, `--chart-series-1` through `--chart-series-6`, `--chart-neutral` | canvas, page guideline, chart gridline, chart-label role, secondary text, semantic series, chart segment |
| chart callout | `--chart-callout-font`, `--chart-callout-color`, `--chart-callout-bg`, `--chart-callout-border`, `--chart-callout-leader`, `--chart-callout-padding` | chart-annotation role, `ink`, canvas, quiet rule, page guideline, `space-2` |
| comparison indicator | `--indicator-track`, `--indicator-fill`, `--indicator-positive`, `--indicator-caution`, `--indicator-negative`, `--indicator-font`, `--indicator-size` | chart segment, component-primary, status roles, label role, density-appropriate registered size |
| diagram node | `--node-bg`, `--node-color`, `--node-border`, `--node-font`, `--node-padding`, `--node-radius`, `--connector-color`, `--connector-width` | canvas, `ink`, quiet rule, body role, `space-3`, component radius, page guideline, hairline |

## Media and identity components

| Component | Required custom properties | Default binding |
| --- | --- | --- |
| semantic icon | `--icon-color`, `--icon-size`, `--icon-stroke`, `--icon-bg` | component-primary, icon-md, standard line, transparent |
| logo backing | `--logo-bg`, `--logo-border`, `--logo-padding`, `--logo-radius` | canvas, quiet rule, `space-2`, component radius |
| image frame | `--image-bg`, `--image-border`, `--image-radius`, `--image-caption-font`, `--image-caption-color`, `--image-caption-gap` | surface-1, none, component radius, source role, secondary text, `space-2` |

## Canonical alias layer

Use this pattern at the component root. The block is a binding example, not a second value registry.

```css
.slide {
  --slide-bg: var(--canvas);
  --slide-color: var(--ink);
  --slide-padding-inline: var(--slide-margin-inline);
  --slide-padding-block: var(--slide-margin-block);
  --slide-column-gap: var(--grid-gutter);
}

.action-title {
  --action-title-font: var(--type-action-title);
  --action-title-color: var(--ink);
  --action-title-rule: var(--rule-page);
  --action-title-gap: var(--title-separator-gap);
  --action-title-width: var(--title-width);
}

.source-line {
  --source-font: var(--type-source);
  --source-color: var(--text-secondary);
  --source-rule: var(--rule-quiet);
  --source-gap: var(--space-1);
}

.panel {
  --panel-bg: var(--surface-1);
  --panel-color: var(--ink);
  --panel-border: var(--rule-quiet);
  --panel-radius: var(--component-radius);
  --panel-shadow: var(--component-shadow);
  --panel-padding: var(--space-4);
}

.action-surface {
  --action-surface-bg: var(--surface-action);
  --action-surface-color: var(--ink);
  --action-surface-font: var(--type-callout);
  --action-surface-padding-x: var(--space-5);
  --action-surface-padding-y: var(--space-4);
  --action-surface-border: 0;
  --action-surface-radius: var(--component-radius);
}

.description-slide {
  --description-slide-gap: var(--grid-gutter);
  --description-slide-row-gap: var(--space-2);
  --description-slide-row-rule: var(--rule-quiet);
  --description-slide-row-padding: var(--space-1);
  --description-slide-columns: 3fr 9fr;
  --description-slide-heading-font: var(--type-column-heading);
  --description-slide-heading-color: var(--ink);
  --description-slide-heading-rule: var(--rule-page);
  --description-slide-heading-gap: var(--space-2);
  --description-slide-label-bg: var(--surface-inverse);
  --description-slide-label-color: var(--on-inverse);
  --description-slide-label-font: var(--type-section-heading);
  --description-slide-label-padding: var(--space-4);
  --description-slide-label-gap: var(--space-3);
  --description-slide-label-embedded-padding: var(--space-6);
  --description-slide-body-font: var(--type-body-compact);
  --description-slide-body-color: var(--ink);
  --description-slide-body-gap: var(--space-2);
  --description-slide-list-indent: var(--space-5);
  --description-slide-side-bg: transparent;
  --description-slide-side-color: var(--ink);
  --description-slide-side-font: var(--type-body-compact);
  --description-slide-side-padding: var(--space-4);
  --description-slide-icon-color: var(--component-primary);
  --description-slide-icon-size: var(--icon-lg);
  --description-slide-icon-stroke: var(--line-standard);
  --description-slide-dense-font: var(--type-body-compact);
}

.description-implication {
  --description-implication-gap: var(--description-slide-gap);
  --description-implication-row-gap: var(--description-slide-row-gap);
  --description-implication-row-rule: var(--description-slide-row-rule);
  --description-implication-row-padding: var(--description-slide-row-padding);
  --description-implication-columns: 2fr 5fr 1fr 4fr;
  --description-implication-heading-font: var(--description-slide-heading-font);
  --description-implication-heading-color: var(--description-slide-heading-color);
  --description-implication-heading-rule: var(--description-slide-heading-rule);
  --description-implication-heading-gap: var(--description-slide-heading-gap);
  --description-implication-label-bg: var(--description-slide-label-bg);
  --description-implication-label-color: var(--description-slide-label-color);
  --description-implication-label-font: var(--description-slide-label-font);
  --description-implication-label-padding: var(--description-slide-label-padding);
  --description-implication-label-embedded-padding: var(--description-slide-label-embedded-padding);
  --description-implication-body-font: var(--description-slide-body-font);
  --description-implication-body-color: var(--description-slide-body-color);
  --description-implication-body-gap: var(--description-slide-body-gap);
  --description-implication-list-indent: var(--description-slide-list-indent);
  --description-implication-implication-bg: transparent;
  --description-implication-implication-subtle-bg: var(--surface-1);
  --description-implication-implication-color: var(--ink);
  --description-implication-implication-font: var(--type-callout);
  --description-implication-implication-padding: var(--space-0);
  --description-implication-dense-font: var(--description-slide-dense-font);
}

.arrow {
  --arrow-color: var(--component-primary);
  --arrow-surface: var(--component-primary);
  --arrow-on-surface: var(--on-primary);
  --arrow-connector: var(--page-guideline);
  --arrow-size: var(--icon-lg);
  --arrow-emphasis-size: var(--icon-md);
  --arrow-wide-size: var(--space-6);
  --arrow-stroke: var(--line-standard);
  --arrow-connector-stroke: var(--line-hairline);
}

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
}

.metric {
  --metric-font: var(--type-metric);
  --metric-hero-font: var(--type-metric-hero);
  --metric-color: var(--component-primary);
  --metric-label-font: var(--type-label);
  --metric-label-color: var(--text-secondary);
  --metric-divider: var(--rule-quiet);
  --metric-gap: var(--space-3);
}

.data-table {
  --table-font: var(--type-body);
  --table-compact-font: var(--type-body-compact);
  --table-header-bg: var(--component-primary);
  --table-header-color: var(--on-primary);
  --table-row-rule: var(--rule-quiet);
  --table-cell-padding-x: var(--space-3);
  --table-cell-padding-y: var(--space-2);
}
```

## Registered variants

### Regions

- `open`: transparent surface, no outer boundary, optional quiet header underline. Default for analytical exhibits.
- `boxed-neutral`: surface-1, quiet border, standard panel padding. Use only for a true semantic boundary.
- `header-highlight`: open body with one primary-tint or neutral header band. Use for parallel peer regions.

### Terminal action surface

- `tonal`: primary tint with ink text. Default.
- `primary`: component-primary with on-primary text. Use only for the deck's decisive action or explicit stage moment.
- `open`: no fill, emphasis rule, ink text. Use when a filled band would compete with the exhibit.

### Tracker

- `label-line`: label role plus one quiet line and component-primary active state. Default when a visible tracker is justified.
- `compact-marker`: small markers with accessible labels in the master or nearby legend. Use only when the deck has very limited header height.

### Table

- `open`: no outer border, quiet row rules, unfilled or quiet header. Default for dense evidence.
- `primary-header`: component-primary header with on-primary text. Use for short comparison tables when the header aids scanning.
- `status`: open table plus explicit status text or symbols. Status tints may support, never replace, those cues.

## Semantic states

`active`, `selected`, `positive`, `caution`, `negative`, `forecast`, and `missing` are the only shared state names. A component may define a narrower domain. Each state must document its threshold or trigger and its non-colour cue. Do not create colour-only states such as `blue`, `green`, `highlight`, or `special`.
