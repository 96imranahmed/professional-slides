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

## Semantic HTML contracts

### Curves

```html
<figure class="horizons" data-archetype="chart.horizons" data-variant="curves" data-content="portfolio-horizons">
  <svg class="horizons__plot" viewBox="0 0 1000 420" role="img" aria-labelledby="horizons-curves-title">
    <title id="horizons-curves-title">Three growth horizons across time and value</title>
    <defs><marker id="horizons-arrow" orient="auto" markerWidth="8" markerHeight="8" refX="7" refY="4"><path d="M0 0 L8 4 L0 8 Z" /></marker></defs>
    <path class="horizons__axis" data-axis="time" d="M80 370H940" marker-end="url(#horizons-arrow)" />
    <path class="horizons__axis" data-axis="value" d="M80 370V40" marker-end="url(#horizons-arrow)" />
    <g class="horizon" data-horizon-id="horizon-1"><path class="horizon__curve" d="M80 370 C120 285 230 245 360 245" /><text class="horizon__label">Horizon 1</text><text class="horizon__title">Strengthen the core</text><text class="horizon__description">Improve the mature business and fund the next sources of growth.</text></g>
    <g class="horizon" data-horizon-id="horizon-2"><path class="horizon__curve" d="M350 245 C390 160 500 120 630 120" /><text class="horizon__label">Horizon 2</text><text class="horizon__title">Scale emerging plays</text><text class="horizon__description">Expand proven opportunities that can become substantial businesses.</text></g>
    <g class="horizon" data-horizon-id="horizon-3"><path class="horizon__curve" d="M620 120 C660 70 780 45 900 45" /><text class="horizon__label">Horizon 3</text><text class="horizon__title">Create future options</text><text class="horizon__description">Explore new opportunities before their model is fully proven.</text></g>
  </svg>
</figure>
```

### Annotated steps

```html
<figure class="horizons" data-archetype="chart.horizons" data-variant="stepped" data-content="portfolio-horizons">
  <ol class="horizons__steps">
    <li class="horizon" data-horizon-id="horizon-1"><span class="horizon__rule"></span><h3>Strengthen the core</h3><p class="horizon__timeframe">Near term</p><dl><div><dt>Focus</dt><dd>Core performance</dd></div></dl><p>Improve the mature business and fund the next sources of growth.</p></li>
    <li class="horizon" data-horizon-id="horizon-2"><span class="horizon__rule"></span><h3>Scale emerging plays</h3><p class="horizon__timeframe">Medium term</p><dl><div><dt>Focus</dt><dd>Repeatable growth</dd></div></dl><p>Expand proven opportunities that can become substantial businesses.</p></li>
    <li class="horizon" data-horizon-id="horizon-3"><span class="horizon__rule"></span><h3>Create future options</h3><p class="horizon__timeframe">Long term</p><dl><div><dt>Focus</dt><dd>Option creation</dd></div></dl><p>Explore new opportunities before their model is fully proven.</p></li>
  </ol>
</figure>
```

### Minimal steps

```html
<figure class="horizons" data-archetype="chart.horizons" data-variant="stepped-minimal" data-content="portfolio-horizons">
  <ol class="horizons__steps horizons__steps--minimal">
    <li class="horizon" data-horizon-id="horizon-1"><span class="horizon__rule"></span><h3>Strengthen the core</h3><p>Improve performance now.</p></li>
    <li class="horizon" data-horizon-id="horizon-2"><span class="horizon__rule"></span><h3>Scale emerging plays</h3><p>Build repeatable growth.</p></li>
    <li class="horizon" data-horizon-id="horizon-3"><span class="horizon__rule"></span><h3>Create future options</h3><p>Explore the next model.</p></li>
  </ol>
</figure>
```

```css
.horizons { margin: 0; color: var(--ink); font: var(--type-body); }
.horizons__plot { width: 100%; height: 100%; overflow: visible; }
.horizons__axis { fill: none; stroke: var(--ink); stroke-width: var(--line-standard); }
#horizons-arrow path { fill: var(--ink); }
.horizon__curve { fill: none; stroke: var(--chart-series-1); stroke-width: var(--line-standard); }
.horizon__label, .horizon__title, .horizons__steps h3 { font: var(--type-heading); font-weight: var(--weight-semibold); }
.horizon__description, .horizons__steps p, .horizons__steps dl { font: var(--type-body); }
.horizons__steps { list-style: none; margin: 0; padding: 0; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: var(--space-5); align-items: end; }
.horizon__rule { display: block; border-top: var(--line-standard) solid var(--component-primary); }
.horizon__timeframe { color: var(--text-secondary); }
.horizons__steps--minimal dl { display: none; }
```

## Platform mapping

Render all axes, curve segments, stage rules, and text as editable native primitives. The curve is a deterministic sequence of line segments, so PowerPoint and HTML preserve the same geometry without native-chart smoothing or reflow.

## Failure modes

Treating conceptual horizons as a precise forecast, mixing unrelated initiatives into one horizon, using colour as the only horizon cue, adding a detached legend, approximating axis arrows with text glyphs, shrinking only the stage copy, or forcing developed narratives into too many narrow columns.

## Acceptance test

The sequence from current core to future options remains understandable in grayscale, every horizon maps to one ordered semantic record, arrowheads are explicit native line endpoints, and the selected density variant fits without clipping or a local type override.
