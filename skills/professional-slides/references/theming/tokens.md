# Theme Token Registry

This guide explains token roles and inheritance. [Runtime core](../../runtime/core.mjs) owns token definitions and density resolution; [palettes](../../runtime/palettes.mjs) and [typography](../../runtime/typography.mjs) resolve deck overrides. Both adapters consume those resolved values.

## Units and canvas

Runtime scenes use a `1280 × 720` canvas. At the adapter boundary:

- `96px = 1in`;
- `1px = 0.75pt`;
- percentages and grid fractions resolve inside the parent region;
- `fontSizePt` tokens already use points; do not convert them again.

Do not preserve browser pixels literally after translation. Preserve the named token, relationship, and rendered result.

## Primitive and role tokens

Use semantic token IDs declared by the registered component. Canonical generation writes resolved values to `design-manifest.json` and per-slide values to `scene.json` under `slides[].tokens`. These generated records are the value reference for the exact deck; do not maintain a second CSS value catalog. See [generation](../../runtime/generation.mjs).

### Resolved table heat scales

The runtime materializes `color.heat.<palette>.<stop>` (CSS `--heat-<palette>-<stop>`) for stops 0–10. `theme-sequential` interpolates canvas to component-primary, `red-white` interpolates negative to canvas, and `red-white-green` interpolates negative through canvas at stop 5 to positive. These are derived theme tokens, not cell-local colours. A declared score domain maps consistently to the nearest stop; cells and legend consume the identical token. Text uses the contrasting ink or on-primary role. Missing evidence uses the neutral missing treatment rather than a scale endpoint.

`color.componentPrimary` (`--component-primary`) resolves to `#051C2C` dark navy for McKinsey, `#197A56` green for BCG, and `#CB2027` red for Bain. Primary surfaces, category cells and inference markers share this role. McKinsey's primary tint is `#E6E8EA`; its bright blue remains available as a distinct chart-series colour, not a structural primary. Company themes override the palette tokens, not individual components.

## Density profiles

Choose a registered density profile in the content plan. Runtime density resolution owns its coordinates and type roles.

`chart-label` and `chart-annotation` remain distinct semantic roles so legends, direct values, and interpretation can retain their correct weight and native metadata. Their size and line height resolve to the active body role in every density profile. Title subtitles also use body size. Chart units instead match the adjacent chart heading's size in both inline and stacked states; regular weight and secondary colour distinguish the unit. When an extensible exhibit crosses a registered capacity threshold, the planner promotes the whole page to `pre-read` or `appendix`; all page type roles step down together. Do not shrink one legend, datapoint, cell, or annotation locally to solve ordinary crowding. If the promoted page still does not fit, shorten copy, enlarge the exhibit, select another encoding, or split the slide. A verified source-design constraint or other major fit issue may justify one documented reference-derived exception, but it must remain legible and appear in the treatment ledger rather than as an unrecorded local override.

## Chart comparator role

`--chart-comparator` maps to runtime `color.chartComparator`, default `#D9DDE0`. It is the light-grey background-evidence role for a focal comparison, independent of the categorical series palette and text-secondary colour. Focus uses `--component-primary`; series identities continue to use `--chart-series-1` through `--chart-series-6` when required. Apply the [focus and comparator contract](../charts/index.md#focus-and-comparator-colours), including contrast checks and theme-bound exceptions for dark or reference-derived canvases.

## Required reference-derived palette

An authorized reference-derived theme overrides the supported runtime palette and typography inputs while preserving semantic token IDs. Resolve source roles from the inspected reference and document any fallback. Follow the [theme extension contract](index.md).

## Token discipline

- Primitive tokens are never used to express meaning.
- Semantic tokens describe visual meaning and may be rebound by a visual family.
- Component tokens in the binding registry are the shared component styling interface.
- Status tokens require a declared threshold and a text, symbol, or pattern cue.
- Chart-series tokens are ordered encodings, not a decoration palette.
- Literal visual values belong in runtime token definitions or authorized theme inputs, never in slide-local styling.
