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

