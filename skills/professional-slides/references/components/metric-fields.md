# Metric Fields

Metric fields present one to three headline values whose comparison or implication is central to the slide. Use them when the values themselves are the evidence; use a chart when trend, distribution, relationship, or composition matters.

## Variant selection

- **Open metric row:** default for two or three peer metrics. Use value, short divider, label, and one explanatory line without enclosing cards.
- **Hero plus peers:** use when one metric is explicitly dominant and two smaller values qualify it. The action title or adjacent copy must explain the hierarchy.
- **Metric with decision band:** use when one to three metrics support one terminal action or implication. The band is the slide's single callout or terminal-action surface.
- **Compact score strip:** use inside an executive synthesis or comparison slide when the values summarize previously established evidence rather than create a new analytical job.

Do not create a separate box for each value by default. Peers share the same value role, divider length, label grammar, description depth, and base colour. Emphasize one metric only when the title or a direct annotation explains why it is exceptional.

## Content contract

Every metric includes a value, unit or basis, period or population when material, and a concise label. Add one interpretation or definition when the metric is a ratio, proxy, threshold result, nonstandard unit, or otherwise lacks a self-evident denominator. Use comparable units and periods across peers or make the difference explicit.

## Theme contract

| Component | Consumed custom properties | Canonical source |
| --- | --- | --- |
| metric field | `--metric-font`, `--metric-hero-font`, `--metric-color`, `--metric-label-font`, `--metric-label-color`, `--metric-divider`, `--metric-gap` | [component bindings](../theming/component-bindings.md#evidence-components) |

## Construction details

For the hero-plus-peers variant, change only the grid proportion and the hero value role. For the decision-band variant, route the post-row decision through the reusable [`Insight Box`](insight-box.md). Do not wrap the metrics in cards or add an edge accent to the insight box.

### Metrics with decision band

The `insight-box` geometry and theme values come from its component owner; the metric slide supplies only its position in the page grid.

The compact score-strip variant uses the same open-row geometry at the `label` and `body-compact` roles inside its parent grid. It does not add a second title, card frame, or insight box.

## Acceptance check

Verify values are comparable or qualified. Keep peer styling identical. Explain every highlighted metric. Descriptions add interpretation instead of repeating labels. The composition remains clear without cards.
