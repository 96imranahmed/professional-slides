# Horizons charts

## Best for

Showing how a portfolio moves from the current core through emerging growth plays to future options. The encoding is conceptual: it communicates sequence, maturity, and expected value contribution, not a precise forecast.

## Guidance note

- Use when current, emerging, and future growth plays must be understood as one portfolio across time.
- Why: staggered curves or stepped stages make the temporal sequence and changing contribution explicit.
- Action title: state how the portfolio shifts across horizons and what must be protected, scaled, or explored.

## Data contract

Use `chart.horizons` with one ordered `horizons` array. Each horizon requires a stable `id` and `label`, and may add `title`, `timeframe`, `description`, `summary`, zero to four `{ label, value }` details, a registered `colorIndex`, and normalized `start` and `end` positions. The array order owns the sequence. Starts must not move backwards and each end must follow its start.

The owner accepts three variants:

- `curves` is the default Three Horizons model. It uses conceptual value-over-time axes with proper triangular arrowheads, staggered editable curves, direct horizon labels, and concise descriptions.
- `stepped` removes the conceptual axes and curves. It uses ascending horizontal stage rules with a developed title, timeframe, details, and narrative in each column.
- `stepped-minimal` keeps the same ascending stage structure but shows only the title, optional timeframe, and one summary or description. Use it when the storyline needs the sequence without the full explanatory payload.

The variants are visual treatments of the same ordered horizon model, not separate business-topic templates. Change the variant instead of rebuilding the page when the audience needs more or less explanation.

Variant payloads are strict. `curves` accepts conceptual `xLabel` and `yLabel` but rejects stepped-only `timeframe`, `summary`, and `details`. `stepped` accepts timeframe, details, and developed description but rejects axis labels and summary. `stepped-minimal` accepts timeframe plus one summary or description, rejects axes and details, and does not silently discard unsupported fields.

## Construction

- Use direct labels rather than a legend. Position and order remain the primary cues; colour only reinforces them.
- Curves rise within separate vertical bands and never imply measured confidence intervals or exact year-by-year values.
- Both axes in `curves` are native lines with explicit triangular arrowheads. Do not approximate an arrow with a glyph.
- Stepped rules use one theme-bound structural colour across all stages. Do not recolour every stage merely because it has a different order.
- Keep every label, timeframe, detail, and description at its registered semantic type role. Capacity changes the page density; it does not create a local small-font exception.
- `curves` and `stepped` support two to five horizons. `stepped-minimal` supports two to ten, subject to deterministic text-fit checks. Split the exhibit when the content no longer fits.

## Platform mapping

Render all axes, curve segments, stage rules, and text as editable native primitives. The curve is a deterministic sequence of line segments, so PowerPoint and HTML preserve the same geometry without native-chart smoothing or reflow.

## Failure modes

Treating conceptual horizons as a precise forecast, mixing unrelated initiatives into one horizon, using colour as the only horizon cue, adding a detached legend, approximating axis arrows with text glyphs, shrinking only the stage copy, or forcing developed narratives into too many narrow columns.

## Acceptance test

The sequence from current core to future options remains understandable in grayscale, every horizon maps to one ordered semantic record, arrowheads are explicit native line endpoints, and the selected density variant fits without clipping or a local type override.
