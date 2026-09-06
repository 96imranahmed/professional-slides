# Chart Callouts

Chart callouts attach interpretation to a specific mark, interval, gap, threshold, or outlier inside quantitative evidence. They are distinct from a detached slide-level synthesis or action, which is governed by the [`Insight Box`](insight-box.md).

## Growth-rate callout

Use a bracket, interval line, arrow, or endpoint label to show a supported absolute change, percentage-point change, CAGR, or index movement. Name the period and basis. Distinguish `%` from percentage points and do not calculate CAGR across inconsistent periods.

## Authoring decision

For each chart, identify the comparison the reader must verify before allocating the plot. When the claim depends on growth, a gap, margin expansion, or a threshold crossing, request the corresponding annotation in the chart's content props. Endpoint values and a claim in the title do not show the calculated change on the exhibit. Omit the extra annotation when the plotted measure already is that change, such as directly labelled year-over-year growth bars, or when the same comparison is already encoded clearly; record that reason in the storyboard.

Use `changeAnnotations` for a supported A-to-B change or gap, `referenceLines` for a decision threshold, and `annotations` for an evidence-linked observation. These inputs have different jobs. An empty `annotations: []` does not request growth arrows, and the renderer does not infer them from prose. Bind endpoints to exact category and series keys, reconcile the displayed calculation with source precision, and reserve the shared annotation band before sizing marks. For example:

```js
// Column-chart props: values are 80 and 100 for the same measure.
{
  categories: ["Prior", "Current"],
  series: [{ name: "Revenue", values: [80, 100] }],
  dataLabels: true,
  highlights: [{ category: "Current", style: "bar" }],
  changeAnnotations: [{
    start: { category: "Prior", series: "Revenue" },
    end: { category: "Current", series: "Revenue" },
    style: "arrow", text: "+25%"
  }]
}
```

For grouped comparisons, name both series at the same category; for margin changes use percentage points. Axis-based bar, column, stacked, line, waterfall, scatter, bubble, and combo charts accept keyed observations and supported A-to-B changes. Chronological vertical columns, stacked columns, lines, waterfalls, and combo charts may also carry an annotation rail. Horizontal bars, scatter, bubble, pie, and donut charts do not accept an annotation rail; pie and donut charts use direct segment labels and reject ordered change annotations. Reflow or change the encoding if the keyed annotation cannot fit; do not silently drop the proof. Verify the requested label and connector in the final render, not only in the source or scene.

## Key-observation callout

Use one short sentence placed beside the decisive mark, with a leader line that terminates at the exact evidence. State the pattern and its implication only when the action title does not already make both obvious. Avoid generic headings such as “Key takeaway,” “What it means,” or “Read the outliers.”

Choose one supported treatment:

- `callout` is the default: a canvas surface with a primary outline and a defined arrowhead. Set `border: false` for the borderless variant; retain the same text, spacing, and connector. Prefer a straight horizontal or vertical connector, using a diagonal only when the available space requires it.
- The former tinted `takeaway-box` treatment is retired. Legacy inputs resolve to `callout`; new specimens use the retained callout construction.
- `orthogonal-dot` uses a horizontal or vertical leader with no arrowhead and a small primary endpoint dot on the exact evidence. Prefer it when the plot provides a clear straight corridor. If the box or corridor would cover a mark, marker, point highlight, data label, reference label, or peer annotation, reject the treatment and use another orientation or `callout`; do not bend or diagonalize it silently. It also accepts `border: false`.

Keep the endpoint dot subordinate to the data mark. A straight leader attaches to the nearest box edge and ends at the keyed data coordinate, never merely near the series.

## Threshold and outlier callout

Draw the threshold in the plot area and label its source or decision meaning. Label an outlier directly with its value and identity. Do not recolour unrelated points to create contrast; use the registered peer base and one declared highlight.

## Shared highlight and change grammar

Use these constructions across chart families rather than redrawing one-off treatments:

- `endpoint arrow`: a directional line with an explicit native triangular end arrowhead connects exact A and B evidence. Put the calculated absolute, percentage-point, percentage, CAGR, or index change in one compact label centered on the line. It may span two bars, two line points, or two declared series within one category.
- `interval bracket`: a quiet span and two drops connect exact endpoints when the selected range matters more than direction. It may cover a long time range or repeat across grouped categories when every bracket compares the same series pair.
- `start-to-end construction`: a quiet horizontal span, start drop, and terminal line with an explicit native triangular end arrowhead connect an opening state to a reconciled closing state. Use it for a waterfall or total stack bridge, not as a decorative roof over unrelated categories.
- `annotation rail`: aligned rows below category labels carry necessary secondary measures. Each bubble contains one numeric value, optionally with its unit, or an explicit `N/A` state. Put the measure name and shared unit at the left of the row; use separate rows for separate measures, never a sentence or expression inside one bubble. Bind entries to exact category keys and omit rows that repeat plotted values.
- `forecast band`: one open plot region marks the complete estimate or forecast interval. Bind its boundary and tint to the forecast state, label it once, and keep the underlying marks in the same series mapping as history unless scenario identity changes.
- `focal span`: one theme-primary outline or light-neutral tint identifies a decision-relevant period, category, or group while leaving every mark and label readable. Give the span symmetric cross-axis breathing room and keep labels clear of its edge. Use the outline when the boundary matters and the tint when the whole region matters. The span must name the selection basis and must not recolour peers into false categories.
- `segment emphasis`: retain the segment's category hue, strengthen only its approved intensity or outline, and mute peer segments through theme bindings. Use when one segment, rather than the whole row or column, proves the title.
- `evidence leader`: one short leader terminates at the exact mark, boundary, or gap. Use for outliers, thresholds, and decisive values, not for decorative arrows that merely point toward a chart.
- `orthogonal evidence leader`: one straight horizontal or vertical leader uses the `orthogonal-dot` treatment above and ends at the exact keyed mark.

Choose one primary highlight mechanism. A forecast band may coexist with one evidence leader because forecast is a data state. Do not surround one fact with several competing marks.

For multiple measures use `annotationRail: { rows: [{ label: "EPS, $", items: [{ category: "Base", text: "12.5" }] }, { label: "P/E", items: [{ category: "Base", text: "27x" }] }] }`. These are illustrative values, not evidence. The single-row `{ label, items }` form remains supported. The renderer reserves each row and its left label before sizing the plot; if the plot cannot fit, recompose instead of compressing the bubbles.

Change labels use the active theme's component primary and on-primary text; leaders use the quiet rule role. Never introduce a bright local colour. Change lines must stop clear of data labels and terminate at their exact keyed evidence.

Change bubbles also contain one numeric value, such as `+18%` or `+4.2pp`. Put the metric, basis and period in the exhibit heading or adjacent labels, not inside the bubble. Sentence-length evidence callouts remain a separate treatment.

Typography, contrast, clearance, and fit follow the canonical [direct-label gate](../charts/index.md#direct-label-gate). This owner adds only callout geometry: surfaces, leaders, endpoint binding, and the highlight or change mechanism.

Apply the shared [focus and comparator colours](../charts/index.md#focus-and-comparator-colours) when selecting a category, series, or region highlight.

## Theme contract

The component consumes `--chart-callout-font`, `--chart-callout-color`, `--chart-callout-bg`, `--chart-callout-border`, `--chart-callout-leader`, `--chart-callout-padding`, `--chart-callout-series`, `--chart-callout-highlight`, `--chart-callout-muted-region`, `--chart-callout-forecast-region`, `--chart-callout-forecast-border`, `--chart-callout-line-width`, `--chart-callout-emphasis-width`, and `--chart-callout-label-radius`. [Component bindings](../theming/component-bindings.md#evidence-components) owns every resolved default.

## Acceptance check

Verify every callout terminates at its evidence. A dot-ended leader is exactly horizontal or vertical, has no arrowhead, clears every protected chart element, and places its dot on the keyed target. Calculations reconcile to plotted values and periods. Forecast and focal regions state their basis. Wording adds meaning. Marks survive without colour. One primary highlight leads. Apply the [`Insight Box`](insight-box.md) limits to any detached synthesis or terminal action.
