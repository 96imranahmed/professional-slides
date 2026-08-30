# Theme Specification

Define the theme before slide implementation. Store the result as a JSON object
conforming to [`theme-spec.schema.json`](theme-spec.schema.json).

## 1. Theme contract

A complete theme defines:

- canvas dimensions and safe zones;
- construction grid and spacing unit;
- typography families, weights, sizes, and line spacing;
- semantic colors and approved combinations;
- fills, strokes, corner behavior, and icon style;
- chart series order and emphasis behavior;
- table header, body, subtotal, and highlight states;
- title, section, content, and appendix masters/layouts;
- recurring components and their exact anchors;
- dark-slide and light-slide variants;
- PowerPoint-to-Google-Slides fallback rules.

Do not author slides until each required token has a defined value or an
explicit inheritance source.

## 2. Typography

Choose a primary family that is installed or safely substitutable on both
target platforms. Define an explicit fallback stack. Use no more than four
functional text roles unless a reference requires more:

- display: deck titles and section dividers;
- action title: slide-level conclusion;
- body: prose, labels, and tables;
- micro: source lines, footers, and annotations.

For each role specify family, size, weight, color, line spacing, paragraph
spacing, alignment, and text-box inset. Theme-level typography must be applied
through masters, layouts, and styles, not manually re-created on each slide.

Use actual font names from the source package, not a visually similar guess.
If a source font is unavailable, choose and document a metrically reasonable
fallback, then re-render every affected slide.

## 3. Color semantics

Define colors by role rather than by slide:

- `ink`: primary text and key data;
- `mutedInk`: secondary text and axes;
- `paper`: primary background;
- `panel`: low-emphasis grouping fill;
- `rule`: separators and gridlines;
- `accent`: the main argumentative highlight;
- `accentSecondary`: a second series or comparison state;
- `positive`, `caution`, `negative`: outcome states used sparingly;
- `darkCanvas`, `onDark`: section and title variants.

Maintain sufficient contrast for projection and export. Reserve the strongest
accent for the item that proves the title. Context series should recede into
neutral or low-saturation tones.

Never assign meaning solely through red versus green. Pair color with a label,
symbol, position, or pattern.

## 4. Grid and spacing

Specify:

- slide size;
- outer margins;
- title, body, and footer bounds;
- column count and gutters;
- base spacing unit;
- common vertical anchors;
- default chart and table plot areas.

The construction grid is not a visible style. Any visible grid or guide layer
present in a source template must be classified as authoring furniture and
hidden or removed in delivered slides unless the source explicitly treats it
as audience-facing.

## 5. Shape language

Default to flat rectangles, rules, and simple circles. Define:

- corner radius or square-corner rule;
- stroke widths and colors;
- arrowhead and connector style;
- icon family and line weight;
- callout treatment;
- emphasis states for selected versus contextual elements.

Avoid an unbounded library of decorative shapes. A theme should make unlike
slides feel related without forcing every idea into the same motif.

## 6. Chart theme

Define a deterministic series order. The first or highlighted series should
use `accent`; contextual series should use neutrals. Specify:

- axis, tick, and gridline styling;
- label font and number formats;
- actual/forecast treatment;
- target, benchmark, and variance annotations;
- confidence or scenario bands;
- chart title and source alignment;
- minimum legible size at presentation scale.

Do not depend on application defaults, which differ between PowerPoint and
Google Slides.

## 7. Tables

Define styles for header row, body rows, alternating fill if used, subtotal,
total, selected cells, status cells, and footnote markers. Use rules and
whitespace before cell fills. Highlight only the values that change the
conclusion.

## 8. Master and layout family

At minimum, implement title, section divider, standard light content, standard
dark content when used, chart-led, table-led, full-bleed visual when justified,
and appendix layouts.

The source reference may use many more layouts; preserve those when editing the
source. For a new synthesized system, keep the master family small and let
archetype modules vary within stable content zones.

## 9. Cross-platform fallbacks

For every non-system font, chart feature, transparency, SVG, mask, connector,
and custom geometry, define the Google Slides fallback. Favor native editable
objects that survive import. When exact fidelity and editability conflict,
follow the user's priority and record the tradeoff.

## 10. Theme QA

Render a representative set containing title, divider, executive summary,
chart, table, process, and appendix slides. Check type substitution, text
reflow, color accuracy, master inheritance, margins, title anchors, chart
styling, footer placement, dark/light continuity, and platform parity.

Theme QA is incomplete until the same representative set has been rendered in
every requested final platform.
