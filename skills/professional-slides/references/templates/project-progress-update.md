# Project Progress Update

## Mandate

Use this template when a sponsor, board, or steering group must decide whether a programme remains on track and what action is needed.

## Decision question

> Is the approved outcome still achievable, what now controls it, and what must the sponsor decide?

The deck should cover:

1. approved baseline;
2. delivered progress;
3. current critical path;
4. residual risk and readiness;
5. latest forecast and downside;
6. owner actions and sponsor decisions.

## Delivery mode

Choose live update, executive pre-read, public-authority review, or recovery review. A live update is shorter and lower density. A pre-read carries more evidence and sources.

Use a visible tracker only when it materially improves orientation. A simple two-part update should normally omit it.

## Thesis and scope

State the reporting cutoff, approved baseline, programme perimeter, forecast basis, and decision horizon. Distinguish actual, forecast, target, and retrospective context.

Use [storylining](../storylining/index.md) and validate the [pre-authoring contract](../storylining/pre-authoring-contract.md) before production.

## Story structure

A full update usually contains:

1. cover;
2. standalone executive summary;
3. baseline and forecast movement;
4. delivered progress;
5. critical path and dependencies;
6. residual risk, readiness, and assurance;
7. forecast, recovery, and sponsor action;
8. appendix.

The executive summary must state the overall answer, proof, decision consequences, and sponsor action. It is not a status dashboard.

## Navigation

Default to `tracker.system: none` for live updates and simple two-part reviews; otherwise use the [tracker router](../components/trackers/index.md). Seed an eligible tracker map with `Baseline and progress`, `Critical path`, `Risk and readiness`, `Forecast and downside`, and `Actions and decisions`; approved replacements become exact under the [template instantiation contract](index.md#instantiation-contract). Omit unused chapters from both the dot-dash and tracker map; never rename a retained tracker label locally.

## Analytical jobs

### Baseline and progress

Show the approved baseline, current position, and material variance. Use a timeline, milestone view, or chart that makes the change visible.

Do not use completion percentages without a defined denominator.

### Critical path

Name the first binding constraint, its dependencies, and the date or outcome it controls. A list of workstreams is not a critical-path analysis.

### Residual risk and readiness

Show what remains after mitigation. Define evidence thresholds for readiness, safety, operations, people, systems, or assurance where relevant.

Avoid traffic-light labels unless the measure and threshold are explicit. Prefer the actual evidence, trigger, consequence, and owner.

### Forecast and downside

State the latest forecast and its basis. Show the consequence of slippage, failed tests, unresolved defects, or dependency delay. Distinguish a forecast window from a fixed date.

### Actions and decisions

Every material action needs an owner, timing, completion evidence, and the decision it enables. Keep management actions separate from sponsor decisions.

## Evidence

Use dated, attributable programme evidence. Cite every slide. Reconcile numbers across milestones, workstreams, risks, and forecast views.

Do not infer unnamed owners or unpublished status.

## Page composition

Use the [open composition model](../composition/index.md). Match the exhibit to the job: timeline for forecast movement, dependency diagram for critical path, table for owned actions, and chart for measurable performance.

Do not repeat a status-card grid across the deck. Use one accent colour plus neutrals unless a defined metric needs more.

## Failure checks

Reject the deck when:

- the baseline or cutoff is unclear;
- progress is shown without the first binding constraint;
- risk is listed without residual consequence;
- forecast and target are mixed;
- traffic-light colours substitute for evidence;
- actions lack owners or completion evidence;
- the executive summary is a tracker;
- the same generic layout is used for most pages;
- sources are missing.

## Acceptance check

The deck makes the baseline, progress, critical path, residual risk, forecast consequence, triggers, owners, and sponsor decisions clear. The exact final artifact passes rendered QA.
