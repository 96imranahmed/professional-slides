# Metric Fields

Metric fields present one to three headline values whose comparison or implication is central to the slide. Use them when the values themselves are the evidence; use a chart when trend, distribution, relationship, or composition matters.

## Variant selection

- **Open metric row:** default for two or three peer metrics. Use value, short divider, label, and one explanatory line without enclosing cards.
- **Hero plus peers:** use when one metric is explicitly dominant and two smaller values qualify it. The action title or adjacent copy must explain the hierarchy.
- **Metric with decision band:** use when one to three metrics support one terminal action or implication. The band is the slide's single callout or terminal-action region.
- **Compact score strip:** use inside an executive synthesis or comparison slide when the values summarize previously established evidence rather than create a new analytical job.

Do not create a separate box for each value by default. Peers share the same value role, divider length, label grammar, description depth, and base colour. Emphasize one metric only when the title or a direct annotation explains why it is exceptional.

## Content contract

Every metric includes a value, unit or basis, period or population when material, concise label, and one interpretation or definition when the value could be misunderstood. Use comparable units and periods across peers or make the difference explicit.

## Structural HTML reference

```html
<section class="metric-slide" data-role="metric-field">
  <header class="metric-slide__title" data-role="action-title">Enterprise reach is broad, but conversion evidence remains incomplete</header>
  <main class="metric-row metric-row--open">
    <article class="metric" data-state="peer"><strong>13M</strong><span class="metric__rule"></span><h2>registered users</h2><p>Large public footprint</p></article>
    <article class="metric" data-state="peer"><strong>2M+</strong><span class="metric__rule"></span><h2>public models</h2><p>Broad supply participation</p></article>
    <article class="metric" data-state="peer"><strong>500K+</strong><span class="metric__rule"></span><h2>datasets</h2><p>Wide discovery surface</p></article>
  </main>
  <footer data-role="source">Source: illustrative structural specimen.</footer>
</section>
```

```css
.metric-slide { width: 1280px; height: 720px; padding: var(--slide-margin-y) var(--slide-margin-x); display: grid; grid-template-rows: auto 1fr auto; background: var(--canvas); color: var(--ink); }
.metric-slide__title { font: var(--type-action-title); border-bottom: var(--rule-page); padding-bottom: var(--space-3); }
.metric-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-6); align-items: center; }
.metric { display: grid; grid-template-rows: auto auto auto auto; gap: var(--space-2); align-content: center; }
.metric strong { font: var(--type-metric); color: var(--component-primary); }
.metric__rule { width: 44%; border-top: var(--rule-quiet); }
.metric h2, .metric p { margin: 0; }
.metric h2 { font: var(--type-section-heading); }
.metric p { font: var(--type-body); color: var(--text-secondary); }
```

For the hero-plus-peers variant, change only the grid proportion and the hero value role. For the decision-band variant, add one uninterrupted `action-surface` after the row and consume the slide's single terminal-action budget. Do not wrap the metrics in cards or add a left edge to the action surface.

### Hero plus peers

```html
<main class="metric-row metric-row--hero-plus-peers" data-role="metric-field">
  <article class="metric metric--hero" data-state="dominant"><strong>68%</strong><span class="metric__rule"></span><h2>weekly active teams</h2><p>The retained cohort that drives the decision</p></article>
  <article class="metric" data-state="peer"><strong>24%</strong><span class="metric__rule"></span><h2>paid conversion</h2><p>Qualified enterprise workspaces</p></article>
  <article class="metric" data-state="peer"><strong>4.2×</strong><span class="metric__rule"></span><h2>expansion</h2><p>Usage growth among retained teams</p></article>
</main>
```

```css
.metric-row--hero-plus-peers { display: grid; grid-template-columns: 1.8fr 1fr 1fr; gap: var(--space-6); align-items: end; }
.metric--hero strong { font: var(--type-metric-hero); }
.metric--hero { padding-right: var(--space-6); border-right: var(--rule-quiet); }
```

### Metrics with decision band

```html
<section class="metric-slide metric-slide--decision" data-role="metric-page">
  <header data-role="action-title">The launch clears the demand gate but not the retention gate</header>
  <main class="metric-row metric-row--open" data-role="metric-field">
    <article class="metric" data-state="peer"><strong>1.8×</strong><span class="metric__rule"></span><h2>demand versus plan</h2><p>First ninety days</p></article>
    <article class="metric" data-state="peer"><strong>42%</strong><span class="metric__rule"></span><h2>week-eight retention</h2><p>Below the 55% follow-on threshold</p></article>
  </main>
  <aside class="action-surface" data-role="action-surface">Fund the next market only after week-eight retention reaches the stated gate.</aside>
</section>
```

```css
.metric-slide--decision { width: 1280px; height: 720px; padding: var(--slide-margin-y) var(--slide-margin-x); display: grid; grid-template-rows: auto 1fr auto; gap: var(--space-4); }
.metric-slide--decision > header { font: var(--type-action-title); border-bottom: var(--rule-page); padding-bottom: var(--space-3); }
.metric-slide--decision .action-surface { display: grid; place-items: center; min-height: 72px; padding: var(--space-3) var(--space-5); background: var(--surface-action); border: 0; font: var(--type-callout); text-align: center; }
```

The compact score-strip variant uses the same open-row geometry at the `label` and `body-compact` roles inside the executive-synthesis grid. It does not add a second title, card frame, or action surface.

## Acceptance check

The values are comparable or explicitly qualified, peer styling is identical, the slide contains no unexplained highlighted metric, each description adds interpretation rather than restating the label, and the composition remains clear without enclosing cards.
