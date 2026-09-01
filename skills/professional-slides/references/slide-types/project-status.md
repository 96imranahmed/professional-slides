# Project Status

This is a specialized composition profile. Select [`process and roadmap`](process-roadmap.md) when sequence and milestones dominate, [`comparison and options`](comparison-options.md) when workstreams are being assessed on common criteria, or [`recommendation and action plan`](recommendation-action-plan.md) when intervention, owners, and commitments dominate.

## Use when

A sponsor or steering committee must understand progress against plan, milestone confidence, workstream completeness, critical dependencies, and the few interventions required to protect the outcome.

## Content contract

- reporting period and baseline plan;
- three to seven workstreams or milestones;
- actual progress, forecast state, and variance or confidence basis;
- named dependency, risk, or decision only when it can affect outcome or timing;
- one terminal action when sponsor intervention is required.

## Layout

Use one of three variants: a milestone timeline with current state and forecast; a workstream table with progress circles or one-to-five evidence scores; or a two-part page with one progress chart and one risk/action table. Do not combine all three. Align current-period markers, status definitions, and workstream order across the deck.

## Structural HTML reference

```html
<section class="status-page" data-role="project-status">
  <header data-role="action-title">Delivery remains on programme, but systems integration now controls the critical path</header>
  <main class="status-page__body">
    <div class="status-page__milestones" data-role="timeline"><span>Design complete</span><span aria-current="step">Integration test</span><span>Trial operations</span><span>Opening</span></div>
    <table data-role="workstream-status"><thead><tr><th>Workstream</th><th>Complete</th><th>Forecast</th><th>Critical dependency</th></tr></thead><tbody><tr><th>Systems</th><td>68%</td><td>Watch</td><td>End-to-end test pass</td></tr><tr><th>Stations</th><td>91%</td><td>On plan</td><td>Final assurance closeout</td></tr></tbody></table>
  </main>
  <aside class="insight-box" data-role="insight-box" data-variant="tonal">Protect the trial window by resolving the integration test owner and recovery plan this month.</aside>
</section>
```

```css
.status-page { width: 1280px; height: 720px; display: grid; grid-template-rows: auto 1fr auto; gap: var(--space-4); padding: var(--slide-margin-y) var(--slide-margin-x); }
.status-page > header { font: var(--type-action-title); border-bottom: var(--rule-page); padding-bottom: var(--space-3); }
.status-page__body { display: grid; grid-template-rows: auto 1fr; gap: var(--space-5); }
.status-page__milestones { display: grid; grid-template-columns: repeat(4, 1fr); border-top: var(--rule-page); padding-top: var(--space-3); }
.status-page__milestones span { font: var(--type-label); color: var(--muted-ink); }
.status-page__milestones [aria-current="step"] { color: var(--component-primary); font-weight: 700; }
.status-page table { width: 100%; border-collapse: collapse; font: var(--type-body-compact); }
.status-page th, .status-page td { padding: var(--space-3); border-bottom: var(--rule-quiet); text-align: left; }
```

Use the indicators from [`comparison-indicators`](../components/comparison-indicators.md) when a table encodes completion or one-to-five scores. The reusable [`Insight Box`](../components/insight-box.md) supplies its own borderless surface and consumes the slide's single detached-callout budget.

## Failure modes

Traffic lights without thresholds or a same-slide legend, heatmaps without named anchors or a same-slide legend, percent-complete values with no baseline, every workstream marked green, a decorative timeline with no timing semantics, several action boxes, and status copy that does not identify the decision or dependency.

## Acceptance test

The sponsor can identify current state, the first binding dependency, forecast consequence, accountable intervention, and next decision without reading a separate narrative page.
