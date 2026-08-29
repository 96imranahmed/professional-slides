# Charts

Choose the chart from the analytical question, not from the template catalog.
The action title states the conclusion; the chart makes that conclusion easy to
verify.

## Selection map

| Question | Default chart | Common alternative |
| --- | --- | --- |
| Which category is larger or smaller? | Sorted bar/column | Dot plot |
| How has a measure changed over time? | Line | Column for discrete periods |
| How does a total divide into parts? | Stacked bar/column | 100% stacked for shares |
| What explains a change from start to finish? | Waterfall | Variance bars |
| How do two or three variables relate? | Scatter/bubble | Quadrant plot |
| Where are concentrations, gaps, or priorities? | Heatmap/matrix | Highlight table |

Avoid pie and donut charts by default. Use them only for a small number of
parts, a single total, and an audience that benefits from the familiar form.
Never use them for precise comparison.

## Universal construction rules

1. Compute and check the result before designing the visual.
2. Match the chart to the claim and use an honest scale.
3. Put metric, unit, population, and period in the exhibit subtitle or labels.
4. Use one accent for the evidence that proves the title; mute context.
5. Direct-label where practical and remove redundant legends.
6. Reduce gridlines, ticks, borders, decimals, and effects that do not improve
   interpretation.
7. State actual, estimate, forecast, target, and scenario distinctions.
8. Cite the source and retain calculation methodology.
9. Keep charts editable unless the user explicitly prioritizes pixel fidelity.
10. Verify labels, scales, and series after PowerPoint/Google Slides conversion.

## 1. Bar and column charts

### Best for

- category comparison;
- ranking;
- discrete periods;
- paired actual versus benchmark.

### Choose orientation

- Use horizontal bars for long category labels or rankings.
- Use vertical columns for a small number of ordered periods.
- Sort by value unless a natural, chronological, or strategic order matters.

### Design

- Start quantitative axes at zero unless a clearly signaled analytical reason
  requires otherwise.
- Keep gaps between bars consistent and narrower than the bars.
- Use direct value labels when they remove the need for a scale.
- Highlight one bar or group; keep the rest neutral.
- Use clustered bars only when the within-category comparison matters.
- Use a dot plot when many close values make bars visually heavy.

### Avoid

- more than roughly 10-12 categories on a main-story slide;
- rotated labels;
- stacked bars when exact segment comparison is the primary task;
- decorative pictograms in place of a numeric scale.

## 2. Line charts

### Best for

- trends and inflection points;
- comparison of trajectories;
- actual versus forecast over time.

### Design

- Keep time intervals consistent and left-to-right.
- Use no more than four emphasized series in the main story; use small multiples
  for more.
- Label series at their endpoints when lines do not cross excessively.
- Show forecast with a dashed line, lighter tone, or shaded region and an
  explicit boundary.
- Annotate only decisive peaks, troughs, crossings, or events.
- Use a common scale for small multiples intended for comparison.

### Avoid

- smoothing that changes the apparent data;
- dual axes unless the different units are essential and the relationship is
  clearly explained;
- markers on every point when the line already carries the trend.

## 3. Stacked bars and areas

### Best for

- composition across categories or time;
- contribution to a total;
- share shifts with a stable category set.

### Design

- Use 100% stacking for share, absolute stacking for total magnitude.
- Put the most important or stable series on the baseline.
- Keep segment order constant.
- Limit the number of segments; group immaterial categories into "Other" only
  with a disclosed rule.
- Label totals above stacks when both total and composition matter.
- Prefer stacked bars to stacked areas when exact category comparison matters.

### Avoid

- comparing middle segments across many bars;
- using area charts for irregular time intervals;
- too many similar colors or labels inside narrow segments.

## 4. Waterfalls

### Best for

- explaining a bridge from start to finish;
- price-volume-mix, margin, headcount, cash, or variance drivers;
- positive and negative contribution.

### Design

- Show start and end totals as anchored columns.
- Use a consistent semantic treatment for positive, negative, and subtotal.
- Order drivers causally, chronologically, or by contribution and state the
  chosen order.
- Label each contribution and verify that the bridge reconciles exactly after
  rounding.
- Add a variance callout only when it changes the conclusion.

### Avoid

- bridges that do not reconcile;
- hiding an unexplained residual in "Other";
- mixing percentage-point and absolute contributions on one bridge.

## 5. Scatter and bubble charts

### Best for

- relationship between two measures;
- segmentation and prioritization;
- a third magnitude encoded by bubble area.

### Design

- Label the axes with units and direction of desirability when relevant.
- Use bubble area, not diameter, to encode magnitude.
- Add quadrant lines only when thresholds are meaningful and documented.
- Label only highlighted points; provide a key or appendix for all points.
- Use transparency or slight jitter only when overlap would hide observations,
  and disclose transformations that affect interpretation.
- Add a trend line only with an appropriate method and avoid causal language
  unless the analysis supports it.

### Avoid

- bubbles whose sizes are decorative;
- unlabeled outliers central to the conclusion;
- arbitrary quadrant names or thresholds.

## 6. Heatmaps and highlight tables

### Best for

- patterns across two categorical dimensions;
- assessment results;
- capability gaps, risk, prioritization, or schedule intensity;
- exact values plus selective emphasis.

### Design

- Use a sequential scale for magnitude and a diverging scale only when there is
  a meaningful midpoint.
- Keep cell size and row/column order consistent.
- Provide a legend with endpoints and units.
- Sort rows and columns to reveal structure when no natural order exists.
- Use a highlight table when exact numbers matter more than the color pattern.
- Verify color contrast and add symbols or values where accessibility requires.

### Avoid

- rainbow scales;
- red/green-only coding;
- more precision than the underlying method supports;
- color differences too subtle to survive projection or export.

## Annotation grammar

Use annotations to explain meaning, not restate values.

- Place the annotation close to the evidence with a short leader line.
- Use a short claim followed by the value or cause.
- Keep one annotation style throughout the deck.
- Distinguish external events, targets, and analytical callouts.
- Do not cover data marks or create crossing leaders.

## Chart source and method

The visible source line should identify organization/dataset and period. Speaker
notes or the source ledger should retain the full file/URL, retrieval date,
filters, formulas, and any rounding. If data is illustrative, label it
"Illustrative" on the slide and do not present it as evidence.

