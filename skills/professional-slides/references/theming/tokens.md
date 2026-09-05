# Theme Token Registry

This file is the canonical registry for theme variables. CSS custom-property syntax is the portable notation. PowerPoint and Google Slides adapters resolve the same names into native shape, text, line, and layout values.

## Units and canvas

Structural specimens use a `1280 × 720` canvas. At the adapter boundary:

- `96px = 1in`;
- `1px = 0.75pt`;
- percentages and grid fractions resolve inside the parent region;
- type sizes resolve to points using the same `0.75` conversion unless a verified reference master supplies native values.

Do not preserve browser pixels literally after translation. Preserve the named token, relationship, and rendered result.

## Primitive and role tokens

```css
.deck {
  --slide-width: 1280px;
  --slide-height: 720px;

  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 40px;
  --space-8: 48px;
  --space-9: 64px;
  --space-10: 80px;

  --line-hairline: 1px;
  --line-standard: 2px;
  --line-emphasis: 4px;
  --radius-0: 0;
  --radius-1: 2px;
  --radius-2: 4px;
  --radius-3: 8px;
  --radius-round: 999px;
  --shadow-none: none;
  --shadow-soft: 0 2px 8px rgb(0 0 0 / 12%);
  --component-radius: var(--radius-0);
  --component-shadow: var(--shadow-none);

  --font-sans: Arial, "Helvetica Neue", sans-serif;
  --font-display: var(--font-sans);
  --font-mono: "Courier New", monospace;
  --weight-regular: 400;
  --weight-medium: 600;
  --weight-bold: 700;

  --type-cover-title: var(--weight-bold) var(--size-cover-title) / var(--line-cover-title) var(--font-display);
  --type-action-title: var(--weight-bold) var(--size-action-title) / var(--line-action-title) var(--font-display);
  --type-section-title: var(--weight-bold) var(--size-section-title) / var(--line-section-title) var(--font-display);
  --type-section-number: var(--weight-regular) var(--size-section-number) / var(--line-section-number) var(--font-display);
  --type-quote-mark: var(--weight-bold) var(--size-quote-mark) / var(--line-quote-mark) var(--font-display);
  --type-quote-mark-hero: var(--weight-bold) var(--size-quote-mark-hero) / var(--line-quote-mark-hero) var(--font-display);
  --type-section-heading: var(--weight-bold) var(--size-section-heading) / var(--line-section-heading) var(--font-sans);
  --type-column-heading: var(--weight-bold) var(--size-body-compact) / var(--line-body-compact) var(--font-sans);
  --type-body: var(--weight-regular) var(--size-body) / var(--line-body) var(--font-sans);
  --type-body-compact: var(--weight-regular) var(--size-body-compact) / var(--line-body-compact) var(--font-sans);
  --type-callout: var(--weight-medium) var(--size-callout) / var(--line-callout) var(--font-sans);
  --type-label: var(--weight-bold) var(--size-label) / var(--line-label) var(--font-sans);
  --type-source: var(--weight-regular) var(--size-source) / var(--line-source) var(--font-sans);
  --type-metric: var(--weight-bold) var(--size-metric) / var(--line-metric) var(--font-sans);
  --type-metric-hero: var(--weight-bold) var(--size-metric-hero) / var(--line-metric-hero) var(--font-sans);
  --type-chart-label: var(--weight-regular) var(--size-chart-label) / var(--line-chart-label) var(--font-sans);
  --type-chart-annotation: var(--weight-medium) var(--size-chart-annotation) / var(--line-chart-annotation) var(--font-sans);

  --rule-page: var(--line-standard) solid var(--page-guideline);
  --rule-quiet: var(--line-hairline) solid var(--divider-rule);
  --rule-emphasis: var(--line-emphasis) solid var(--component-primary);
  --surface-action: var(--component-primary-tint);
  --implication-surface: var(--surface-action);
  --implication-rule: var(--rule-emphasis);
  --positive: var(--status-positive);
  --caution: var(--status-caution);
  --negative: var(--status-negative);
  --chart-category-a: var(--chart-series-1);
  --chart-category-a-muted: var(--chart-segment);
  --chart-category-b: var(--chart-series-2);
  --chart-category-c: var(--chart-series-3);
  --heatmap-primary-1: color-mix(in srgb, var(--component-primary) 12%, var(--canvas));
  --heatmap-primary-2: color-mix(in srgb, var(--component-primary) 28%, var(--canvas));
  --heatmap-primary-3: color-mix(in srgb, var(--component-primary) 48%, var(--canvas));
  --heatmap-primary-4: color-mix(in srgb, var(--component-primary) 60%, var(--canvas));
  --heatmap-primary-5: var(--component-primary);
  --icon-sm: 16px;
  --icon-md: 24px;
  --icon-lg: 36px;
}
```

The aliases at the end preserve existing specimen vocabulary. New component specimens should use the namespaced bindings in [component bindings](component-bindings.md).

### Resolved table heat scales

The runtime materializes `color.heat.<palette>.<stop>` (CSS `--heat-<palette>-<stop>`) for stops 0–10. `theme-sequential` interpolates canvas to component-primary, `red-white` interpolates negative to canvas, and `red-white-green` interpolates negative through canvas at stop 5 to positive. These are derived theme tokens, not cell-local colours. A declared score domain maps consistently to the nearest stop; cells and legend consume the identical token. Text uses the contrasting ink or on-primary role. Missing evidence uses the neutral missing treatment rather than a scale endpoint.

`color.componentPrimary` (`--component-primary`) resolves to `#051C2C` dark navy for McKinsey, `#197A56` green for BCG, and `#CB2027` red for Bain. Primary surfaces, category cells and inference markers share this role. McKinsey's primary tint is `#E6E8EA`; its bright blue remains available as a distinct chart-series colour, not a structural primary. Company themes override the palette tokens, not individual components.

## Density profiles

The pixel values below are structural coordinates on the canonical specimen canvas.

```css
.deck[data-density="live-pitch"] {
  --slide-margin-inline: 72px;
  --slide-margin-block: 48px;
  --slide-margin-x: var(--slide-margin-inline);
  --slide-margin-y: var(--slide-margin-block);
  --title-anchor-x: 72px;
  --title-anchor-y: 52px;
  --title-width: 1136px;
  --title-separator-gap: 16px;
  --content-top-single: 144px;
  --content-top-wrapped: 188px;
  --footer-height: 28px;
  --grid-columns: 12;
  --grid-gutter: 24px;
  --size-cover-title: 56px;
  --line-cover-title: 62px;
  --size-action-title: 36px;
  --line-action-title: 42px;
  --size-section-title: 32px;
  --line-section-title: 38px;
  --size-section-number: 280px;
  --line-section-number: 280px;
  --size-quote-mark: 72px;
  --line-quote-mark: 72px;
  --size-quote-mark-hero: 112px;
  --line-quote-mark-hero: 112px;
  --size-section-heading: 24px;
  --line-section-heading: 29px;
  --size-body: 21px;
  --line-body: 29px;
  --size-body-compact: 18px;
  --line-body-compact: 24px;
  --size-callout: 20px;
  --line-callout: 26px;
  --size-label: 15px;
  --line-label: 19px;
  --size-source: 11px;
  --line-source: 14px;
  --size-metric: 44px;
  --line-metric: 48px;
  --size-metric-hero: 64px;
  --line-metric-hero: 68px;
  --size-chart-label: var(--size-body);
  --line-chart-label: var(--line-body);
  --size-chart-annotation: var(--size-body);
  --line-chart-annotation: var(--line-body);
  --chart-row-height: 44px;
}

.deck[data-density="executive"] {
  --slide-margin-inline: 64px;
  --slide-margin-block: 44px;
  --slide-margin-x: var(--slide-margin-inline);
  --slide-margin-y: var(--slide-margin-block);
  --title-anchor-x: 64px;
  --title-anchor-y: 46px;
  --title-width: 1152px;
  --title-separator-gap: 14px;
  --content-top-single: 126px;
  --content-top-wrapped: 164px;
  --footer-height: 26px;
  --grid-columns: 12;
  --grid-gutter: 20px;
  --size-cover-title: 48px;
  --line-cover-title: 54px;
  --size-action-title: 32px;
  --line-action-title: 38px;
  --size-section-title: 28px;
  --line-section-title: 34px;
  --size-section-number: 240px;
  --line-section-number: 240px;
  --size-quote-mark: 64px;
  --line-quote-mark: 64px;
  --size-quote-mark-hero: 96px;
  --line-quote-mark-hero: 96px;
  --size-section-heading: 21px;
  --line-section-heading: 26px;
  --size-body: 18px;
  --line-body: 25px;
  --size-body-compact: 16px;
  --line-body-compact: 21px;
  --size-callout: 17px;
  --line-callout: 22px;
  --size-label: 13px;
  --line-label: 17px;
  --size-source: 10px;
  --line-source: 13px;
  --size-metric: 38px;
  --line-metric: 42px;
  --size-metric-hero: 56px;
  --line-metric-hero: 60px;
  --size-chart-label: var(--size-body);
  --line-chart-label: var(--line-body);
  --size-chart-annotation: var(--size-body);
  --line-chart-annotation: var(--line-body);
  --chart-row-height: 38px;
}

.deck[data-density="pre-read"] {
  --slide-margin-inline: 56px;
  --slide-margin-block: 38px;
  --slide-margin-x: var(--slide-margin-inline);
  --slide-margin-y: var(--slide-margin-block);
  --title-anchor-x: 56px;
  --title-anchor-y: 40px;
  --title-width: 1168px;
  --title-separator-gap: 12px;
  --content-top-single: 112px;
  --content-top-wrapped: 146px;
  --footer-height: 24px;
  --grid-columns: 12;
  --grid-gutter: 16px;
  --size-cover-title: 44px;
  --line-cover-title: 50px;
  --size-action-title: 28px;
  --line-action-title: 34px;
  --size-section-title: 25px;
  --line-section-title: 30px;
  --size-section-number: 220px;
  --line-section-number: 220px;
  --size-quote-mark: 56px;
  --line-quote-mark: 56px;
  --size-quote-mark-hero: 84px;
  --line-quote-mark-hero: 84px;
  --size-section-heading: 19px;
  --line-section-heading: 23px;
  --size-body: 16px;
  --line-body: 22px;
  --size-body-compact: 14px;
  --line-body-compact: 19px;
  --size-callout: 15px;
  --line-callout: 20px;
  --size-label: 12px;
  --line-label: 15px;
  --size-source: 9px;
  --line-source: 12px;
  --size-metric: 34px;
  --line-metric: 38px;
  --size-metric-hero: 48px;
  --line-metric-hero: 52px;
  --size-chart-label: var(--size-body);
  --line-chart-label: var(--line-body);
  --size-chart-annotation: var(--size-body);
  --line-chart-annotation: var(--line-body);
  --chart-row-height: 34px;
}

.deck[data-density="appendix"] {
  --slide-margin-inline: 48px;
  --slide-margin-block: 32px;
  --slide-margin-x: var(--slide-margin-inline);
  --slide-margin-y: var(--slide-margin-block);
  --title-anchor-x: 48px;
  --title-anchor-y: 34px;
  --title-width: 1184px;
  --title-separator-gap: 10px;
  --content-top-single: 98px;
  --content-top-wrapped: 128px;
  --footer-height: 22px;
  --grid-columns: 12;
  --grid-gutter: 12px;
  --size-cover-title: 40px;
  --line-cover-title: 46px;
  --size-action-title: 25px;
  --line-action-title: 30px;
  --size-section-title: 22px;
  --line-section-title: 27px;
  --size-section-number: 200px;
  --line-section-number: 200px;
  --size-quote-mark: 48px;
  --line-quote-mark: 48px;
  --size-quote-mark-hero: 72px;
  --line-quote-mark-hero: 72px;
  --size-section-heading: 17px;
  --line-section-heading: 21px;
  --size-body: 14px;
  --line-body: 19px;
  --size-body-compact: 12px;
  --line-body-compact: 16px;
  --size-callout: 13px;
  --line-callout: 17px;
  --size-label: 11px;
  --line-label: 14px;
  --size-source: 8px;
  --line-source: 10px;
  --size-metric: 30px;
  --line-metric: 34px;
  --size-metric-hero: 42px;
  --line-metric-hero: 46px;
  --size-chart-label: var(--size-body);
  --line-chart-label: var(--line-body);
  --size-chart-annotation: var(--size-body);
  --line-chart-annotation: var(--line-body);
  --chart-row-height: 30px;
}
```

`chart-label` and `chart-annotation` remain distinct semantic roles so legends, direct values, and interpretation can retain their correct weight and native metadata. Their size and line height resolve to the active body role in every density profile. The same default applies to title subtitles and chart unit rows. When an extensible exhibit crosses a registered capacity threshold, the planner promotes the whole page to `pre-read` or `appendix`; all page type roles step down together. Do not shrink one legend, datapoint, cell, or annotation locally to solve ordinary crowding. If the promoted page still does not fit, shorten copy, enlarge the exhibit, select another encoding, or split the slide. A verified source-design constraint or other major fit issue may justify one documented reference-derived exception, but it must remain legible and appear in the treatment ledger rather than as an unrecorded local override.

## Executive light palette

```css
.deck[data-theme="executive-light"] {
  --canvas: #ffffff;
  --surface-1: #f6f8fa;
  --surface-2: #e9eef2;
  --surface-inverse: #173047;
  --ink: #18232d;
  --text-secondary: #4c5a66;
  --muted-ink: #5f6c77;
  --on-primary: #ffffff;
  --on-inverse: #ffffff;
  --component-primary: #1f5a85;
  --component-primary-tint: #dceaf4;
  --text-accent: var(--component-primary);
  --page-guideline: #23384b;
  --divider-rule: #c8d1d9;
  --chart-gridline: #dfe5ea;
  --chart-segment: #a9b4be;
  --status-positive: #2f7244;
  --status-positive-tint: #dcecdf;
  --on-status-positive: #ffffff;
  --status-caution: #986000;
  --status-caution-tint: #f5e8c8;
  --status-negative: #a83b3b;
  --status-negative-tint: #f3dddd;
  --on-status-negative: #ffffff;
  --status-info: #1f5a85;
  --status-info-tint: #dceaf4;
  --chart-series-1: #1f5a85;
  --chart-series-2: #2d766f;
  --chart-series-3: #72588f;
  --chart-series-4: #b26a24;
  --chart-series-5: #4e6fa8;
  --chart-series-6: #826557;
}
```

## Executive dark palette

```css
.deck[data-theme="executive-dark"] {
  --canvas: #101820;
  --surface-1: #18242e;
  --surface-2: #23333f;
  --surface-inverse: #f4f7fa;
  --ink: #f4f7fa;
  --text-secondary: #c5d0d9;
  --muted-ink: #a7b4bf;
  --on-primary: #07131b;
  --on-inverse: #101820;
  --component-primary: #68b5df;
  --component-primary-tint: #173d52;
  --text-accent: var(--component-primary);
  --page-guideline: #dbe5ec;
  --divider-rule: #405361;
  --chart-gridline: #30434f;
  --chart-segment: #72818d;
  --status-positive: #69c787;
  --status-positive-tint: #193d2a;
  --on-status-positive: #07131b;
  --status-caution: #efb44f;
  --status-caution-tint: #493719;
  --status-negative: #ed8585;
  --status-negative-tint: #4b2528;
  --on-status-negative: #07131b;
  --status-info: #68b5df;
  --status-info-tint: #173d52;
  --chart-series-1: #68b5df;
  --chart-series-2: #63c2ad;
  --chart-series-3: #b69be0;
  --chart-series-4: #efb44f;
  --chart-series-5: #8ba7f0;
  --chart-series-6: #d99b7c;
}
```

## Warm editorial palette

```css
.deck[data-theme="warm-editorial"] {
  --canvas: #fbf8f2;
  --surface-1: #f2ebe1;
  --surface-2: #e7dbcd;
  --surface-inverse: #2c2925;
  --ink: #2c2925;
  --text-secondary: #5d574f;
  --muted-ink: #71695f;
  --on-primary: #ffffff;
  --on-inverse: #fbf8f2;
  --component-primary: #934b34;
  --component-primary-tint: #efddd5;
  --text-accent: var(--component-primary);
  --page-guideline: #3e3933;
  --divider-rule: #cfc3b5;
  --chart-gridline: #ded4c8;
  --chart-segment: #aa9e91;
  --status-positive: #4f714b;
  --status-positive-tint: #e1eadc;
  --on-status-positive: #ffffff;
  --status-caution: #956115;
  --status-caution-tint: #f3e6c8;
  --status-negative: #a2443e;
  --status-negative-tint: #f1dcda;
  --on-status-negative: #ffffff;
  --status-info: #486c7a;
  --status-info-tint: #dce8eb;
  --chart-series-1: #934b34;
  --chart-series-2: #3f746f;
  --chart-series-3: #9a7628;
  --chart-series-4: #5e708c;
  --chart-series-5: #795a73;
  --chart-series-6: #6d7044;
  --font-display: Georgia, "Times New Roman", serif;
}
```

## Required reference-derived palette

A `reference-derived` theme must declare every semantic colour token used by the three named palettes, plus `--font-sans`, `--font-display`, `--component-radius`, and `--component-shadow`. It may change values, not names. Missing values inherit from the closest inspected source role first and `executive-light` only as a documented last resort.

## Token discipline

- Primitive tokens are never used to express meaning.
- Semantic tokens describe visual meaning and may be rebound by a visual family.
- Component tokens in the binding registry are the interface used by component CSS.
- Status tokens require a declared threshold and a text, symbol, or pattern cue.
- Chart-series tokens are ordered encodings, not a decoration palette.
- Literal colours, font sizes, gaps, margins, radii, and shadows are permitted only inside this registry or an authorized reference-derived registry.
