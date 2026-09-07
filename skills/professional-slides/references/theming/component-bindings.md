# Component Theme Bindings

This guide maps component roles to theme semantics. The tables retain descriptive alias vocabulary for the component guides; they are not an executable CSS interface. Registered runtime components declare the token IDs they consume and own the exact bindings. See the [component contract](../../runtime/README.md#component-contract).

## Binding rules

- Declare consumed token IDs once in the registered runtime component.
- Select a variant only for a named construction.
- Select a semantic state only with a documented non-colour cue.
- External position and size belong to the parent layout. Internal padding belongs to the component.
- An absent property inherits from the base binding. It does not receive a local literal.

## Canvas and repeated furniture

| Component | Descriptive aliases | Semantic binding |
| --- | --- | --- |
| slide canvas | `--slide-bg`, `--slide-color`, `--slide-padding-inline`, `--slide-padding-block`, `--slide-column-gap` | `canvas`, `ink`, density margins, density grid gutter |
| slide layout frame | `--slide-layout-gap`, `--slide-layout-rule`, `--slide-layout-accent-bg`, `--slide-layout-accent-color`, `--slide-layout-soft-bg`, `--slide-layout-color`, `--slide-layout-heading-font`, `--slide-layout-heading-color`, `--slide-layout-heading-rule`, `--slide-layout-heading-gap`, `--slide-layout-region-padding` | density grid gutter, quiet rule, component primary, on-primary text, surface-1, `ink`, section-heading role, `ink`, page rule, `space-2`, `space-5` |
| action-title block | `--action-title-font`, `--action-title-color`, `--action-title-rule`, `--action-title-gap`, `--action-title-width` | action-title role, `ink`, no rule (`with-line`: page rule), `space-2`, density title width |
| section title | `--section-title-font`, `--section-title-color`, `--section-title-rule`, `--section-title-gap` | section-title role, `ink`, no rule (`with-line`: quiet rule), `space-2` |
| source and footer | `--source-font`, `--source-color`, `--source-rule`, `--source-gap` | source role, secondary text, no rule by default, `space-1` |
| tracker | Typography, selection, rules, spacing, and markers | [Tracker owner](../components/trackers/index.md); resolve exact values through the registered runtime component. |

## Text and section components

| Component | Descriptive aliases | Semantic binding |
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

| Component | Descriptive aliases | Semantic binding |
| --- | --- | --- |
| metric field | `--metric-font`, `--metric-hero-font`, `--metric-color`, `--metric-label-font`, `--metric-label-color`, `--metric-divider`, `--metric-gap` | metric roles, component-primary, label role, secondary text, quiet rule, `space-3` |
| [data table](../charts/heatmap-table.md#table-header-contract) | `--table-font`, `--table-compact-font`, `--table-header-bg`, `--table-header-color`, `--table-row-rule`, `--table-cell-padding-x`, `--table-cell-padding-y`, `--table-cell-number-bg`, `--table-cell-number-color`, `--table-cell-number-font`, `--table-cell-number-min-size`, `--table-cell-number-padding` | body roles, surface-2, text-primary, quiet rule, `space-3`, `space-2`, component primary, on-primary, body, icon-md, `space-1` |
| chart plot | `--chart-bg`, `--chart-axis`, `--chart-grid`, `--chart-label-font`, `--chart-label-color`, `--chart-series-1` through `--chart-series-6`, `--chart-neutral` | canvas, page guideline, chart gridline, chart-label role, secondary text, semantic series, chart segment |
| chart callout | `--chart-callout-font`, `--chart-callout-color`, `--chart-callout-bg`, `--chart-callout-border`, `--chart-callout-leader`, `--chart-callout-padding`, `--chart-callout-series`, `--chart-callout-highlight`, `--chart-callout-muted-region`, `--chart-callout-forecast-region`, `--chart-callout-forecast-border`, `--chart-callout-line-width`, `--chart-callout-emphasis-width`, `--chart-callout-label-radius` | chart-annotation role, `ink`, canvas, quiet rule, page guideline, `space-2`, chart series 1, component primary, surface-1, primary tint, emphasis rule, registered line widths, round radius |
| chart legend | Typography, gaps, keys, series, and forecast cues | [Legend owner](../components/chart-legends.md); the runtime declares consumed tokens. |
| quote cluster | `--quote-cluster-columns`, `--quote-cluster-gap`, `--quote-stagger-inline-offset`, `--quote-stagger-block-gap`, `--quote-item-gap`, `--quote-mark-gap`, `--quote-item-padding-x`, `--quote-item-padding-y`, `--quote-item-bg`, `--quote-item-color`, `--quote-item-border`, `--quote-item-radius`, `--quote-item-shadow`, `--quote-mark-font`, `--quote-mark-color`, `--quote-body-bg`, `--quote-body-border`, `--quote-body-radius`, `--quote-body-padding-x`, `--quote-body-padding-y`, `--quote-caret-size`, `--quote-caret-inline-position`, `--quote-caret-angle`, `--quote-snip-size`, `--quote-text-font`, `--quote-text-color`, `--quote-attribution-gap`, `--quote-attribution-font`, `--quote-attribution-color`, `--quote-detail-font`, `--quote-detail-color`, `--quote-attribution-inline-offset`, `--quote-avatar-size`, `--quote-avatar-gap`, `--quote-avatar-bg`, `--quote-avatar-border`, `--quote-avatar-radius` | named count grid, density gutter, `space-8` inline stagger, `space-4` block stagger, compact item and mark rhythm, zero outer inset and boundary before treatment rebinding, `ink`, component radius and shadow, quote-mark roles, component primary, surface-1 enclosed body, quiet body border, component radius, registered body inset, `space-3` caret centered at `45deg`, `space-5` snip, body role, `ink`, `space-1`, label role, `ink`, source role, secondary text, `space-4` left-attribution inset, icon-lg circular avatar on surface-2 with quiet boundary |
| table-cell status and comparison indicator | Completion, status, heatmap, rating, and legend roles | [Comparison owner](../components/comparison-indicators.md); cells and legend share the resolved scale. |
| diagram node | `--node-bg`, `--node-color`, `--node-border`, `--node-font`, `--node-padding`, `--node-radius`, `--connector-color`, `--connector-width` | canvas, `ink`, quiet rule, body role, `space-3`, component radius, page guideline, hairline |
| tree-based insight and implication table | `--insight-tree-node-bg`, `--insight-tree-node-color`, `--insight-tree-connector`, `--insight-tree-row-bg`, `--insight-tree-row-color`, `--insight-tree-gap`, `--insight-tree-node-padding`, `--insight-tree-arrow-size`, `--insight-tree-rule`, `--insight-tree-arrow-rule` | component primary, on-primary, quiet rule, surface-2, ink, `space-2`, `space-3`, icon-md, hairline, standard line |
| [map](../components/maps.md) | `--map-land`, `--map-highlight`, `--map-boundary`, `--map-label-font`, `--map-label-color`, `--map-marker-bg`, `--map-marker-color`, `--map-marker-line` | surface-1, component primary, canvas, label role, secondary text, canvas, ink, hairline |

## Media and identity components

| Component | Descriptive aliases | Semantic binding |
| --- | --- | --- |
| semantic icon | `--icon-color`, `--icon-size`, `--icon-stroke`, `--icon-bg` | component-primary, icon-md, standard line, transparent |
| logo backing | `--logo-bg`, `--logo-border`, `--logo-padding`, `--logo-radius` | canvas, quiet rule, `space-2`, component radius |
| image frame | `--image-bg`, `--image-border`, `--image-radius`, `--image-caption-font`, `--image-caption-color`, `--image-caption-gap` | surface-1, none, component radius, source role, secondary text, `space-2` |
| category composition | `--category-row-gap`, `--category-item-gap`, `--category-heading-gap`, `--category-rule`, `--category-padding-top`, `--category-image-ratio`, `--category-heading-font`, `--category-body-font`, `--category-body-color` | registered spacing and rule roles, approved image ratio, section-heading role, body role, secondary text |

## Registered variants

Variant meaning and geometry live with their component owner. Use:

- [guidelines](../components/guidelines.md) for section treatments and headers;
- [insight boxes](../components/insight-box.md) for detached synthesis and terminal actions;
- [quote clusters](../components/quote-cluster.md) for quote counts and treatments;
- [trackers](../components/trackers/index.md) for navigation states;
- [composition](../composition/index.md) plus [comparison indicators](../components/comparison-indicators.md) for table construction and status.

Exact variant bindings live in the runtime owner.

## Semantic states

`active`, `selected`, `positive`, `caution`, `negative`, `actual`, `estimate`, `forecast`, `target`, `scenario`, and `missing` are the only shared state names. A component may define a narrower domain. Each state must document its threshold or trigger and its non-colour cue. Do not create colour-only states such as `blue`, `green`, `highlight`, or `special`.
