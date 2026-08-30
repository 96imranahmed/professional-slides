# Comparison and Options

## Use when

The audience must compare alternatives, scenarios, vendors, segments, or current and future states using a common decision basis.

Use a decomposition instead when the goal is to explain how one system breaks apart. Use a roadmap when sequence, rather than tradeoff, drives the decision.

## Narrative contract

The audience should understand the comparison basis, material differences, recommended option, and the tradeoff or risk that remains.

## Content contract

- action title stating the decision or material difference;
- two to four alternatives;
- three to seven decision criteria with comparable evidence;
- explicit recommendation state and concise rationale;
- scoring method, weights, thresholds, and missing-data treatment in notes;
- source treatment for external benchmarks or vendor claims.

## Layout

Use a table when exact comparison matters. Use equal-width narratives when each option has qualitatively different logic. Use a 2x2 only when two independent continuous dimensions genuinely determine the choice.

- keep option widths and criterion heights consistent;
- reserve the first column for concise criterion labels;
- align evidence to a shared baseline inside each row;
- place the recommendation marker in the header or final synthesis row;
- keep sensitivity or qualification close to the affected criterion.

## Visual rules

- Use comparable grammar and units across cells.
- Prefer whitespace and subtle rules to fully boxed cells.
- Highlight the recommended option once, not every favorable cell.
- Define score and status color semantics; pair color with text or symbols.
- Show unavailable and non-comparable data explicitly.
- Keep the underlying values editable and auditable.

## Variants

- options matrix;
- current/future state;
- benchmark comparison;
- 2x2 prioritization matrix;
- scenario comparison with shared metrics;
- weighted decision matrix with calculation detail in the appendix.

## Failure modes

- criteria selected after the preferred answer;
- arbitrary traffic lights without thresholds;
- long prose in every cell;
- inconsistent units or evidence depth;
- visual endorsement unsupported by the score;
- a decorative 2x2 with invented axes.

## Acceptance test

Hide the recommendation styling and ask whether the same option still wins from the visible evidence. If not, the slide is advocacy rather than analysis.
