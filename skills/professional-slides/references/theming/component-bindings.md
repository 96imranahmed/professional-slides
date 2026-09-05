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
| action-title block | `--action-title-font`, `--action-title-color`, `--action-title-rule`, `--action-title-gap`, `--action-title-width` | action-title role, `ink`, no rule (`with-line`: page rule), `space-2`, density title width |
| section title | `--section-title-font`, `--section-title-color`, `--section-title-rule`, `--section-title-gap` | section-title role, `ink`, no rule (`with-line`: quiet rule), `space-2` |
| source and footer | `--source-font`, `--source-color`, `--source-rule`, `--source-gap` | source role, secondary text, no rule by default, `space-1` |
| tracker | All properties in the `.tracker` declaration in the [canonical alias layer](#canonical-alias-layer) | That declaration is the exact property-to-default mapping, including all typography, colour, rule, gap, padding, marker, width, radius, and edge-share values. Do not derive defaults from the navigation variant's name. |

## Text and section components

| Component | Required custom properties | Default binding |
| --- | --- | --- |
| body copy | `--body-font`, `--body-color`, `--body-paragraph-gap` | body role, `ink`, `space-3` |
| compact label | `--label-font`, `--label-color`, `--label-gap` | label role, secondary text, `space-1` |
| shared section heading | `--section-heading-font`, `--section-heading-color`, `--section-heading-rule`, `--section-heading-gap` | section-heading role, `ink`, quiet rule, `space-2`; insight and synthesis variants set the rule to none |
| open analytical region | `--region-bg`, `--region-color`, `--region-rule`, `--region-padding` | transparent, `ink`, quiet rule, `space-0` |
| neutral panel | `--panel-bg`, `--panel-color`, `--panel-border`, `--panel-radius`, `--panel-shadow`, `--panel-padding` | surface-1, `ink`, quiet rule, component radius, component shadow, `space-4` |
| highlighted header | `--section-header-bg`, `--section-header-color`, `--section-header-font`, `--section-header-padding`, `--section-header-rule` | primary tint, `ink`, section-heading role, `space-3`, no extra rule |
| insight box and terminal action surface | `--insight-box-bg`, `--insight-box-color`, `--insight-box-font`, `--insight-box-padding-x`, `--insight-box-padding-y`, `--insight-box-padding-y-multi`, `--insight-box-border`, `--insight-box-dotted-border`, `--insight-box-radius`, `--insight-box-min-height`, `--insight-box-text-align`, `--insight-box-align-items`, `--insight-box-section-gap`, `--insight-box-divider`, `--insight-box-header-font`, `--insight-box-header-color`, `--insight-box-header-gap`, `--insight-box-list-indent` | primary tint, `ink`, regular-weight callout size, `space-5`, `space-4`, `space-6`, none, quiet dotted boundary, component radius, `space-9`, center, center, `space-3`, quiet rule, section-heading role, component primary, `space-2`, `space-5` |
| arrow | `--arrow-color`, `--arrow-surface`, `--arrow-on-surface`, `--arrow-connector`, `--arrow-size`, `--arrow-emphasis-size`, `--arrow-wide-size`, `--arrow-stroke`, `--arrow-connector-stroke` | component primary, component primary, on-primary text, page guideline, icon-md, icon-lg, `space-6`, standard line, hairline |
| item indicator | `--item-indicator-bg`, `--item-indicator-color`, `--item-indicator-border`, `--item-indicator-accent-bg`, `--item-indicator-accent-color`, `--item-indicator-keyline`, `--item-indicator-size`, `--item-indicator-font`, `--item-indicator-radius-square`, `--item-indicator-radius-circle` | inverse surface, on-inverse text, none, component primary, on-primary text, hairline in on-inverse, icon-lg, label role, square radius, round radius |

## Evidence components

| Component | Required custom properties | Default binding |
| --- | --- | --- |
| metric field | `--metric-font`, `--metric-hero-font`, `--metric-color`, `--metric-label-font`, `--metric-label-color`, `--metric-divider`, `--metric-gap` | metric roles, component-primary, label role, secondary text, quiet rule, `space-3` |
| [data table](../charts/heatmap-table.md#table-header-contract) | `--table-font`, `--table-compact-font`, `--table-header-bg`, `--table-header-color`, `--table-row-rule`, `--table-cell-padding-x`, `--table-cell-padding-y`, `--table-cell-number-bg`, `--table-cell-number-color`, `--table-cell-number-font`, `--table-cell-number-min-size`, `--table-cell-number-padding` | body roles, surface-2, text-primary, quiet rule, `space-3`, `space-2`, component primary, on-primary, body, icon-md, `space-1` |
| chart plot | `--chart-bg`, `--chart-axis`, `--chart-grid`, `--chart-label-font`, `--chart-label-color`, `--chart-series-1` through `--chart-series-6`, `--chart-neutral` | canvas, page guideline, chart gridline, chart-label role, secondary text, semantic series, chart segment |
| chart callout | `--chart-callout-font`, `--chart-callout-color`, `--chart-callout-bg`, `--chart-callout-border`, `--chart-callout-leader`, `--chart-callout-padding`, `--chart-callout-series`, `--chart-callout-highlight`, `--chart-callout-muted-region`, `--chart-callout-forecast-region`, `--chart-callout-forecast-border`, `--chart-callout-line-width`, `--chart-callout-emphasis-width`, `--chart-callout-label-radius` | chart-annotation role, `ink`, canvas, quiet rule, page guideline, `space-2`, chart series 1, component primary, surface-1, primary tint, emphasis rule, registered line widths, round radius |
| chart legend | All properties in `.chart-legend` in the [canonical alias layer](#canonical-alias-layer) | That declaration gives the exact property-to-token mapping for font, colour, gaps, key size, line length, series, neutral key, and forecast border. |
| quote cluster | `--quote-cluster-columns`, `--quote-cluster-gap`, `--quote-stagger-inline-offset`, `--quote-stagger-block-gap`, `--quote-item-gap`, `--quote-mark-gap`, `--quote-item-padding-x`, `--quote-item-padding-y`, `--quote-item-bg`, `--quote-item-color`, `--quote-item-border`, `--quote-item-radius`, `--quote-item-shadow`, `--quote-mark-font`, `--quote-mark-color`, `--quote-body-bg`, `--quote-body-border`, `--quote-body-radius`, `--quote-body-padding-x`, `--quote-body-padding-y`, `--quote-caret-size`, `--quote-caret-inline-position`, `--quote-caret-angle`, `--quote-snip-size`, `--quote-text-font`, `--quote-text-color`, `--quote-attribution-gap`, `--quote-attribution-font`, `--quote-attribution-color`, `--quote-detail-font`, `--quote-detail-color`, `--quote-attribution-inline-offset`, `--quote-avatar-size`, `--quote-avatar-gap`, `--quote-avatar-bg`, `--quote-avatar-border`, `--quote-avatar-radius` | named count grid, density gutter, `space-8` inline stagger, `space-4` block stagger, compact item and mark rhythm, zero outer inset and boundary before treatment rebinding, `ink`, component radius and shadow, quote-mark roles, component primary, surface-1 enclosed body, quiet body border, component radius, registered body inset, `space-3` caret centered at `45deg`, `space-5` snip, body role, `ink`, `space-1`, label role, `ink`, source role, secondary text, `space-4` left-attribution inset, icon-lg circular avatar on surface-2 with quiet boundary |
| table-cell status and comparison indicator | All properties in `.table-cell-status-set` in the [canonical alias layer](#canonical-alias-layer) | That declaration gives the exact property-to-token mapping for completion, status, heatmap, rating, and legend typography, colours, dimensions, and spacing. |
| diagram node | `--node-bg`, `--node-color`, `--node-border`, `--node-font`, `--node-padding`, `--node-radius`, `--connector-color`, `--connector-width` | canvas, `ink`, quiet rule, body role, `space-3`, component radius, page guideline, hairline |
| tree-based insight and implication table | `--insight-tree-node-bg`, `--insight-tree-node-color`, `--insight-tree-connector`, `--insight-tree-row-bg`, `--insight-tree-row-color`, `--insight-tree-gap`, `--insight-tree-node-padding`, `--insight-tree-arrow-size`, `--insight-tree-rule`, `--insight-tree-arrow-rule` | component primary, on-primary, quiet rule, surface-2, ink, `space-2`, `space-3`, icon-md, hairline, standard line |
| [map](../components/maps.md) | `--map-land`, `--map-highlight`, `--map-boundary`, `--map-label-font`, `--map-label-color`, `--map-marker-bg`, `--map-marker-color`, `--map-marker-line` | surface-1, component primary, canvas, label role, secondary text, canvas, ink, hairline |

## Media and identity components

| Component | Required custom properties | Default binding |
| --- | --- | --- |
| semantic icon | `--icon-color`, `--icon-size`, `--icon-stroke`, `--icon-bg` | component-primary, icon-md, standard line, transparent |
| logo backing | `--logo-bg`, `--logo-border`, `--logo-padding`, `--logo-radius` | canvas, quiet rule, `space-2`, component radius |
| image frame | `--image-bg`, `--image-border`, `--image-radius`, `--image-caption-font`, `--image-caption-color`, `--image-caption-gap` | surface-1, none, component radius, source role, secondary text, `space-2` |
| category composition | `--category-row-gap`, `--category-item-gap`, `--category-heading-gap`, `--category-rule`, `--category-padding-top`, `--category-image-ratio`, `--category-heading-font`, `--category-body-font`, `--category-body-color` | registered spacing and rule roles, approved image ratio, section-heading role, body role, secondary text |

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
  --action-title-rule: 0;
  --action-title-gap: var(--space-2);
  --action-title-width: var(--title-width);
}

.action-title[data-variant="with-line"] {
  --action-title-rule: var(--rule-page);
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
  --tracker-selected-surface: var(--component-primary-tint);
  --tracker-selected-text: var(--ink);
  --tracker-selected-marker-rule: var(--line-standard) solid var(--tracker-active);
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

.tracker--split-contents[data-selection-treatment="inverse"] {
  --tracker-selected-surface: var(--tracker-active);
  --tracker-selected-text: var(--tracker-active-text);
  --tracker-selected-marker-rule: var(--line-standard) solid var(--tracker-active-text);
}

.tracker--split-contents[data-mode="dark"][data-selection-treatment="tint"] {
  --tracker-selected-surface: var(--surface-1);
}

.source-line {
  --source-font: var(--type-source);
  --source-color: var(--text-secondary);
  --source-rule: 0;
  --source-gap: var(--space-1);
}

.source-line[data-variant="with-line"] {
  --source-rule: var(--rule-quiet);
}

.section-title {
  --section-title-font: var(--type-section-title);
  --section-title-color: var(--ink);
  --section-title-rule: 0;
  --section-title-gap: var(--space-2);
}

.section-title[data-variant="with-line"] {
  --section-title-rule: var(--rule-quiet);
}

.body-copy {
  --body-font: var(--type-body);
  --body-color: var(--ink);
  --body-paragraph-gap: var(--space-3);
}

.compact-label {
  --label-font: var(--type-label);
  --label-color: var(--text-secondary);
  --label-gap: var(--space-1);
}

.section-heading {
  --section-heading-font: var(--type-section-heading);
  --section-heading-color: var(--ink);
  --section-heading-rule: var(--rule-quiet);
  --section-heading-gap: var(--space-2);
}

.section-heading[data-variant="insight"],
.section-heading[data-variant="synthesis"] {
  --section-heading-rule: 0;
}

.section--open {
  --region-bg: transparent;
  --region-color: var(--ink);
  --region-rule: var(--rule-quiet);
  --region-padding: var(--space-0);
}

.panel {
  --panel-bg: var(--surface-1);
  --panel-color: var(--ink);
  --panel-border: var(--rule-quiet);
  --panel-radius: var(--component-radius);
  --panel-shadow: var(--component-shadow);
  --panel-padding: var(--space-4);
}

.section-header {
  --section-header-bg: var(--component-primary-tint);
  --section-header-color: var(--ink);
  --section-header-font: var(--type-section-heading);
  --section-header-padding: var(--space-3);
  --section-header-rule: 0;
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
  --quote-stagger-inline-offset: var(--space-8);
  --quote-stagger-block-gap: var(--space-4);
  --quote-item-gap: var(--space-2);
  --quote-mark-gap: var(--space-1);
  --quote-item-padding-x: var(--space-0);
  --quote-item-padding-y: var(--space-0);
  --quote-item-bg: transparent;
  --quote-item-color: var(--ink);
  --quote-item-border: 0;
  --quote-item-radius: var(--component-radius);
  --quote-item-shadow: var(--component-shadow);
  --quote-mark-font: var(--type-quote-mark);
  --quote-mark-color: var(--component-primary);
  --quote-body-bg: var(--surface-1);
  --quote-body-border: var(--rule-quiet);
  --quote-body-radius: var(--component-radius);
  --quote-body-padding-x: var(--space-4);
  --quote-body-padding-y: var(--space-3);
  --quote-caret-size: var(--space-3);
  --quote-caret-inline-position: 50%;
  --quote-caret-angle: 45deg;
  --quote-snip-size: var(--space-5);
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
  --table-header-bg: var(--surface-2);
  --table-header-color: var(--ink);
  --table-row-rule: var(--rule-quiet);
  --table-cell-padding-x: var(--space-3);
  --table-cell-padding-y: var(--space-2);
}

.chart-field {
  --chart-bg: var(--canvas);
  --chart-axis: var(--page-guideline);
  --chart-grid: var(--chart-gridline);
  --chart-label-font: var(--type-chart-label);
  --chart-label-color: var(--text-secondary);
  --chart-neutral: var(--chart-segment);
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
  --table-cell-binary-line: var(--line-hairline);
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
  --table-cell-rating-fill: var(--component-primary);
  --table-cell-rating-track: var(--chart-segment);
  --table-cell-rating-size: var(--icon-lg);
  --table-cell-rating-gap: var(--space-2);
  --table-cell-rating-font: var(--type-label);
  --table-cell-number-bg: var(--component-primary);
  --table-cell-number-color: var(--on-primary);
  --table-cell-number-font: var(--type-body);
  --table-cell-number-min-size: var(--icon-md);
  --table-cell-number-padding: var(--space-1);
  --table-cell-legend-font: var(--type-body-compact);
  --table-cell-legend-color: var(--ink);
  --table-cell-legend-gap: var(--space-3);
  --table-cell-legend-item-gap: var(--space-2);
  --table-cell-legend-swatch-size: var(--icon-md);
  --table-cell-legend-rule: var(--rule-quiet);
}

.chart-legend {
  --chart-legend-font: var(--type-chart-label);
  --chart-legend-color: var(--ink);
  --chart-legend-gap: var(--space-4);
  --chart-legend-item-gap: var(--space-2);
  --chart-legend-key-size: var(--icon-sm);
  --chart-legend-line-length: var(--space-7);
  --chart-legend-series-1: var(--chart-series-1);
  --chart-legend-series-2: var(--chart-series-2);
  --chart-legend-series-3: var(--chart-series-3);
  --chart-legend-series-4: var(--chart-series-4);
  --chart-legend-series-5: var(--chart-series-5);
  --chart-legend-series-6: var(--chart-series-6);
  --chart-legend-neutral: var(--chart-segment);
  --chart-legend-forecast-border: var(--rule-page);
}

.chart-with-callout {
  --chart-callout-font: var(--type-chart-annotation);
  --chart-callout-color: var(--ink);
  --chart-callout-bg: var(--canvas);
  --chart-callout-border: var(--rule-quiet);
  --chart-callout-leader: var(--page-guideline);
  --chart-callout-padding: var(--space-2);
  --chart-callout-series: var(--chart-series-1);
  --chart-callout-highlight: var(--component-primary);
  --chart-callout-muted-region: var(--surface-1);
  --chart-callout-forecast-region: var(--component-primary-tint);
  --chart-callout-forecast-border: var(--rule-emphasis);
  --chart-callout-line-width: var(--line-hairline);
  --chart-callout-emphasis-width: var(--line-standard);
  --chart-callout-label-radius: var(--radius-round);
}

.diagram-node {
  --node-bg: var(--canvas);
  --node-color: var(--ink);
  --node-border: var(--rule-quiet);
  --node-font: var(--type-body);
  --node-padding: var(--space-3);
  --node-radius: var(--component-radius);
  --connector-color: var(--page-guideline);
  --connector-width: var(--line-hairline);
}

.map-geography {
  --map-land: var(--surface-1);
  --map-highlight: var(--component-primary);
  --map-boundary: var(--canvas);
  --map-label-font: var(--type-label);
  --map-label-color: var(--text-secondary);
  --map-marker-bg: var(--canvas);
  --map-marker-color: var(--ink);
  --map-marker-line: var(--line-hairline);
}

.semantic-icon {
  --icon-color: var(--component-primary);
  --icon-size: var(--icon-md);
  --icon-stroke: var(--line-standard);
  --icon-bg: transparent;
}

.logo-backing {
  --logo-bg: var(--canvas);
  --logo-border: var(--rule-quiet);
  --logo-padding: var(--space-2);
  --logo-radius: var(--component-radius);
}

.image-frame {
  --image-bg: var(--surface-1);
  --image-border: 0;
  --image-radius: var(--component-radius);
  --image-caption-font: var(--type-source);
  --image-caption-color: var(--text-secondary);
  --image-caption-gap: var(--space-2);
}

.category-row {
  --category-row-gap: var(--space-6);
  --category-item-gap: var(--space-3);
  --category-heading-gap: var(--space-2);
  --category-rule: var(--rule-page);
  --category-padding-top: var(--space-4);
  --category-image-ratio: 4 / 3;
  --category-heading-font: var(--type-section-heading);
  --category-body-font: var(--type-body);
  --category-body-color: var(--text-secondary);
}
```

## Registered variants

Variant meaning and geometry live with their component owner. Use:

- [guidelines](../components/guidelines.md) for section treatments and headers;
- [insight boxes](../components/insight-box.md) for detached synthesis and terminal actions;
- [quote clusters](../components/quote-cluster.md) for quote counts and treatments;
- [trackers](../components/trackers/index.md) for navigation states;
- [composition](../composition/index.md) plus [comparison indicators](../components/comparison-indicators.md) for table construction and status.

This file owns only each variant's aliases and default bindings.

## Semantic states

`active`, `selected`, `positive`, `caution`, `negative`, `actual`, `estimate`, `forecast`, `target`, `scenario`, and `missing` are the only shared state names. A component may define a narrower domain. Each state must document its threshold or trigger and its non-colour cue. Do not create colour-only states such as `blue`, `green`, `highlight`, or `special`.
