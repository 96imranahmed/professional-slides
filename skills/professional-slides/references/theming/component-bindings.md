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
| slide layout frame | `--slide-layout-gap`, `--slide-layout-rule`, `--slide-layout-accent-bg`, `--slide-layout-accent-color`, `--slide-layout-soft-bg`, `--slide-layout-color`, `--slide-layout-heading-font`, `--slide-layout-heading-color`, `--slide-layout-heading-rule`, `--slide-layout-heading-gap`, `--slide-layout-region-padding` | density grid gutter, quiet rule, component primary, on-primary text, surface-1, `ink`, section-heading role, `ink`, page rule, `space-2`, `space-5` |
| action-title block | `--action-title-font`, `--action-title-color`, `--action-title-rule`, `--action-title-gap`, `--action-title-width` | action-title role, `ink`, page rule, density separator gap and title width |
| section title | `--section-title-font`, `--section-title-color`, `--section-title-rule` | section-title role, `ink`, quiet rule |
| source and footer | `--source-font`, `--source-color`, `--source-rule`, `--source-gap` | source role, secondary text, quiet rule, `space-1` |
| tracker | `--tracker-font`, `--tracker-heading-font`, `--tracker-item-font`, `--tracker-item-strong-font`, `--tracker-number-font`, `--tracker-section-number-font`, `--tracker-active`, `--tracker-active-text`, `--tracker-inactive`, `--tracker-ink`, `--tracker-canvas`, `--tracker-surface`, `--tracker-tint`, `--tracker-rule`, `--tracker-page-rule`, `--tracker-emphasis-rule`, `--tracker-gap`, `--tracker-item-gap`, `--tracker-list-gap`, `--tracker-list-width`, `--tracker-padding`, `--tracker-marker-size`, `--tracker-compact-marker-size`, `--tracker-radius`, `--tracker-edge-share` | label, section-title, body, callout, section-heading, and section-number roles; component primary and on-primary; muted ink and ink; canvas, surface-1, and primary tint; quiet, page, and emphasis rules; registered spacing; a bounded optical list measure; round radius; content-driven half-item share |

## Text and region components

| Component | Required custom properties | Default binding |
| --- | --- | --- |
| body copy | `--body-font`, `--body-color`, `--body-paragraph-gap` | body role, `ink`, `space-3` |
| compact label | `--label-font`, `--label-color`, `--label-gap` | label role, secondary text, `space-1` |
| open analytical region | `--region-bg`, `--region-color`, `--region-rule`, `--region-padding` | transparent, `ink`, quiet rule, `space-0` |
| neutral panel | `--panel-bg`, `--panel-color`, `--panel-border`, `--panel-radius`, `--panel-shadow`, `--panel-padding` | surface-1, `ink`, quiet rule, component radius, component shadow, `space-4` |
| highlighted header | `--section-header-bg`, `--section-header-color`, `--section-header-font`, `--section-header-padding`, `--section-header-rule` | primary tint, `ink`, section-heading role, `space-3`, no extra rule |
| insight box and terminal action surface | `--insight-box-bg`, `--insight-box-color`, `--insight-box-font`, `--insight-box-padding-x`, `--insight-box-padding-y`, `--insight-box-padding-y-multi`, `--insight-box-border`, `--insight-box-dotted-border`, `--insight-box-radius`, `--insight-box-min-height`, `--insight-box-text-align`, `--insight-box-align-items`, `--insight-box-section-gap`, `--insight-box-divider`, `--insight-box-header-font`, `--insight-box-header-color`, `--insight-box-header-gap`, `--insight-box-list-indent` | primary tint, `ink`, regular-weight callout size, `space-5`, `space-4`, `space-6`, none, quiet dotted boundary, component radius, `space-9`, center, center, `space-3`, quiet rule, section-heading role, component primary, `space-2`, `space-5` |
| executive synthesis | `--executive-synthesis-gap`, `--executive-synthesis-columns`, `--executive-synthesis-branch-gap`, `--executive-synthesis-heading-font`, `--executive-synthesis-heading-color`, `--executive-synthesis-heading-rule`, `--executive-synthesis-heading-rule-gap`, `--executive-synthesis-body-font`, `--executive-synthesis-body-color`, `--executive-synthesis-list-indent` | density grid gutter, named one-, two-, or three-column grid, `space-3`, callout role, component primary, emphasis rule, `space-2`, body role, `ink`, `space-5` |
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
| quote cluster | `--quote-cluster-columns`, `--quote-cluster-gap`, `--quote-item-gap`, `--quote-mark-gap`, `--quote-item-padding-x`, `--quote-item-padding-y`, `--quote-item-bg`, `--quote-item-color`, `--quote-item-border`, `--quote-item-radius`, `--quote-item-shadow`, `--quote-mark-font`, `--quote-mark-color`, `--quote-body-bg`, `--quote-body-border`, `--quote-body-radius`, `--quote-body-padding-x`, `--quote-body-padding-y`, `--quote-caret-size`, `--quote-caret-inline-position`, `--quote-caret-angle`, `--quote-text-font`, `--quote-text-color`, `--quote-attribution-gap`, `--quote-attribution-font`, `--quote-attribution-color`, `--quote-detail-font`, `--quote-detail-color`, `--quote-attribution-inline-offset`, `--quote-avatar-size`, `--quote-avatar-gap`, `--quote-avatar-bg`, `--quote-avatar-border`, `--quote-avatar-radius` | named count grid, density gutter, compact item and mark rhythm, zero outer inset and boundary before treatment rebinding, `ink`, component radius and shadow, section-title role, component primary, surface-1 enclosed body, quiet body border, component radius, registered body inset, `space-3` caret centered at `45deg`, body role, `ink`, `space-1`, label role, `ink`, source role, secondary text, `space-4` left-attribution inset, icon-lg circular avatar on surface-2 with quiet boundary |
| table-cell status and comparison indicator | `--table-cell-completion-fill`, `--table-cell-completion-track`, `--table-cell-completion-size`, `--table-cell-completion-gap`, `--table-cell-completion-font`, `--table-cell-status-positive`, `--table-cell-status-caution`, `--table-cell-status-negative`, `--table-cell-status-missing`, `--table-cell-status-marker-size`, `--table-cell-status-gap`, `--table-cell-status-font`, `--table-cell-heat-1` through `--table-cell-heat-5`, `--table-cell-heat-on-low`, `--table-cell-heat-on-high`, `--table-cell-heat-missing`, `--table-cell-heat-missing-color`, `--table-cell-heat-font`, `--table-cell-heat-min-size`, `--table-cell-heat-padding`, `--table-cell-legend-font`, `--table-cell-legend-color`, `--table-cell-legend-gap`, `--table-cell-legend-item-gap`, `--table-cell-legend-swatch-size`, `--table-cell-legend-rule` | component primary, chart segment, semantic status roles, registered heatmap scale, readable text roles, density row height, registered icon and spacing scales, quiet rule |
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

.slide-layout {
  --slide-layout-gap: var(--grid-gutter);
  --slide-layout-rule: var(--rule-quiet);
  --slide-layout-accent-bg: var(--component-primary);
  --slide-layout-accent-color: var(--on-primary);
  --slide-layout-soft-bg: var(--surface-1);
  --slide-layout-color: var(--ink);
  --slide-layout-heading-font: var(--type-section-heading);
  --slide-layout-heading-color: var(--ink);
  --slide-layout-heading-rule: var(--rule-page);
  --slide-layout-heading-gap: var(--space-2);
  --slide-layout-region-padding: var(--space-5);
}

.action-title {
  --action-title-font: var(--type-action-title);
  --action-title-color: var(--ink);
  --action-title-rule: var(--rule-page);
  --action-title-gap: var(--title-separator-gap);
  --action-title-width: var(--title-width);
}

.tracker {
  --tracker-font: var(--type-label);
  --tracker-heading-font: var(--type-section-title);
  --tracker-item-font: var(--type-body);
  --tracker-item-strong-font: var(--type-callout);
  --tracker-number-font: var(--type-section-heading);
  --tracker-section-number-font: var(--type-section-number);
  --tracker-active: var(--component-primary);
  --tracker-active-text: var(--on-primary);
  --tracker-inactive: var(--muted-ink);
  --tracker-ink: var(--ink);
  --tracker-canvas: var(--canvas);
  --tracker-surface: var(--surface-1);
  --tracker-tint: var(--component-primary-tint);
  --tracker-rule: var(--rule-quiet);
  --tracker-page-rule: var(--rule-page);
  --tracker-emphasis-rule: var(--rule-emphasis);
  --tracker-gap: var(--space-2);
  --tracker-item-gap: var(--space-5);
  --tracker-list-gap: var(--space-3);
  --tracker-list-width: 72%;
  --tracker-padding: var(--space-4);
  --tracker-marker-size: var(--space-9);
  --tracker-compact-marker-size: var(--icon-md);
  --tracker-radius: var(--radius-round);
  --tracker-edge-share: 0;
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

.insight-box {
  --insight-box-bg: var(--surface-action);
  --insight-box-color: var(--ink);
  --insight-box-font: var(--weight-regular) var(--size-callout) / var(--line-callout) var(--font-sans);
  --insight-box-padding-x: var(--space-5);
  --insight-box-padding-y: var(--space-4);
  --insight-box-padding-y-multi: var(--space-6);
  --insight-box-border: 0;
  --insight-box-dotted-border: var(--line-hairline) dotted var(--page-guideline);
  --insight-box-radius: var(--component-radius);
  --insight-box-min-height: var(--space-9);
  --insight-box-text-align: center;
  --insight-box-align-items: center;
  --insight-box-section-gap: var(--space-3);
  --insight-box-divider: var(--rule-quiet);
  --insight-box-header-font: var(--type-section-heading);
  --insight-box-header-color: var(--component-primary);
  --insight-box-header-gap: var(--space-2);
  --insight-box-list-indent: var(--space-5);
}

.executive-synthesis {
  --executive-synthesis-gap: var(--grid-gutter);
  --executive-synthesis-columns: 1fr;
  --executive-synthesis-branch-gap: var(--space-3);
  --executive-synthesis-heading-font: var(--type-callout);
  --executive-synthesis-heading-color: var(--component-primary);
  --executive-synthesis-heading-rule: var(--rule-emphasis);
  --executive-synthesis-heading-rule-gap: var(--space-2);
  --executive-synthesis-body-font: var(--type-body);
  --executive-synthesis-body-color: var(--ink);
  --executive-synthesis-list-indent: var(--space-5);
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

.quote-cluster {
  --quote-cluster-columns: 1fr;
  --quote-cluster-gap: var(--grid-gutter);
  --quote-item-gap: var(--space-2);
  --quote-mark-gap: var(--space-1);
  --quote-item-padding-x: var(--space-0);
  --quote-item-padding-y: var(--space-0);
  --quote-item-bg: transparent;
  --quote-item-color: var(--ink);
  --quote-item-border: 0;
  --quote-item-radius: var(--component-radius);
  --quote-item-shadow: var(--component-shadow);
  --quote-mark-font: var(--type-section-title);
  --quote-mark-color: var(--component-primary);
  --quote-body-bg: var(--surface-1);
  --quote-body-border: var(--rule-quiet);
  --quote-body-radius: var(--component-radius);
  --quote-body-padding-x: var(--space-4);
  --quote-body-padding-y: var(--space-3);
  --quote-caret-size: var(--space-3);
  --quote-caret-inline-position: 50%;
  --quote-caret-angle: 45deg;
  --quote-text-font: var(--type-body);
  --quote-text-color: var(--ink);
  --quote-attribution-gap: var(--space-1);
  --quote-attribution-font: var(--type-label);
  --quote-attribution-color: var(--ink);
  --quote-detail-font: var(--type-source);
  --quote-detail-color: var(--text-secondary);
  --quote-attribution-inline-offset: var(--space-4);
  --quote-avatar-size: var(--icon-lg);
  --quote-avatar-gap: var(--space-2);
  --quote-avatar-bg: var(--surface-2);
  --quote-avatar-border: var(--rule-quiet);
  --quote-avatar-radius: var(--radius-round);
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

.table-cell-status-set {
  --table-cell-completion-fill: var(--component-primary);
  --table-cell-completion-track: var(--chart-segment);
  --table-cell-completion-size: var(--icon-lg);
  --table-cell-completion-gap: var(--space-2);
  --table-cell-completion-font: var(--type-label);
  --table-cell-status-positive: var(--status-positive);
  --table-cell-status-caution: var(--status-caution);
  --table-cell-status-negative: var(--status-negative);
  --table-cell-status-missing: var(--chart-segment);
  --table-cell-status-marker-size: var(--icon-sm);
  --table-cell-status-gap: var(--space-2);
  --table-cell-status-font: var(--type-body-compact);
  --table-cell-heat-1: var(--heatmap-primary-1);
  --table-cell-heat-2: var(--heatmap-primary-2);
  --table-cell-heat-3: var(--heatmap-primary-3);
  --table-cell-heat-4: var(--heatmap-primary-4);
  --table-cell-heat-5: var(--heatmap-primary-5);
  --table-cell-heat-on-low: var(--ink);
  --table-cell-heat-on-high: var(--on-primary);
  --table-cell-heat-missing: var(--surface-1);
  --table-cell-heat-missing-color: var(--muted-ink);
  --table-cell-heat-font: var(--type-label);
  --table-cell-heat-min-size: var(--chart-row-height);
  --table-cell-heat-padding: var(--space-2);
  --table-cell-legend-font: var(--type-body-compact);
  --table-cell-legend-color: var(--ink);
  --table-cell-legend-gap: var(--space-3);
  --table-cell-legend-item-gap: var(--space-2);
  --table-cell-legend-swatch-size: var(--icon-md);
  --table-cell-legend-rule: var(--rule-quiet);
}
```

## Registered variants

### Regions

- `open`: transparent surface, no outer boundary, optional quiet header underline. Default for analytical exhibits.
- `boxed-neutral`: surface-1, quiet border, standard panel padding. Use only for a true semantic boundary.
- `header-highlight`: open body with one primary-tint or neutral header band. Use for parallel peer regions.

### Insight box and terminal action surface

- `tonal`: primary tint with ink text. Default.
- `neutral`: surface-1 with ink text. Use when a primary tint would compete with the exhibit.
- `dotted`: transparent surface with the quiet dotted boundary. Use when a filled surface would be too heavy.
- `primary`: component-primary with on-primary text. Use only for the deck's decisive action or explicit stage moment.

### Quote cluster

- `one-up`: one focused quote on a centered internal measure.
- `two-up`: two equal peer items across a full field or stacked in a half-width section.
- `three-up`: three equal peer items; section use requires a dominant wide region.
- `four-up`: balanced two-by-two full-field construction.
- `five-up`: balanced three-plus-two full-field construction for very short pre-read evidence.
- `callout`: a fully enclosed quote body with one small caret pointing to the attribution below.
- `contained`: one rounded enclosure containing the quote body and attribution.

Attribution center or left alignment and an optional circular photo to the left of the name and title are independent options. Left-aligned callouts shift and angle the caret toward the leading attribution block. The line-only quote treatment is not registered.

Width, text alignment, multi-paragraph padding, an internal section header, and an internal divider are independent options rather than additional surface variants. Body copy remains regular weight; only the optional internal header uses the stronger heading role. Filled variants remain borderless. Use the dotted boundary only with the transparent `dotted` variant.

### Tracker

- `sequential-circles`: three to six short peer sections in one full horizontal map.
- `split-contents`: a parent or framing field on the left with three to eleven section or subsection items on the right.
- `compact-label`: exact parent and active-child labels above the analytical action title.
- `compact-number-strip`: stable section numbers in one quiet analytical header strip.
- `numbered-section-break`: a material transition with title left and large section number right.

### Table

- `open`: no outer border, quiet row rules, unfilled or quiet header. Default for dense evidence.
- `primary-header`: component-primary header with on-primary text. Use for short comparison tables when the header aids scanning.
- `status`: open table plus explicit status text or symbols. Status tints may support, never replace, those cues.

## Semantic states

`active`, `selected`, `positive`, `caution`, `negative`, `forecast`, and `missing` are the only shared state names. A component may define a narrower domain. Each state must document its threshold or trigger and its non-colour cue. Do not create colour-only states such as `blue`, `green`, `highlight`, or `special`.
