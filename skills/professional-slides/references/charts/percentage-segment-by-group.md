# Percentage Segments by User Group

## Best for

Survey results or other mutually exclusive response distributions where the audience must compare how the percentage mix differs across user groups. Each horizontal bar represents one group, every bar resolves to 100%, and each segment represents the same response category in the same order.

Use [general stacked bars](stacked.md) for ordinary part-to-whole analysis that does not require the group cap, focal-category sorting, calculated `Other` row, or adjacent insight extraction defined here. Use [bar and column](bar-column.md) instead when respondents may select multiple answers and the categories therefore do not sum to 100%.

## Analytical contract

Define one focal response as `Category A` before sorting. It should be the response most relevant to the action title, not whichever category happens to produce the most dramatic order. The chart answers: which user groups report more or less of `Category A`, and how does the remaining response mix explain that difference?

## Data contract

Provide:

- mutually exclusive user groups and the respondent count for each group;
- two to five response categories with stable labels and one declared `Category A`;
- raw response counts where available, otherwise percentages and denominators;
- treatment of missing responses, nonresponse, weighting, suppressed samples, and rounding;
- the rule used to select named groups and construct `Other`;
- source, survey period, question wording, population, and total sample size.

Each displayed row must reconcile to 100% within the disclosed rounding tolerance. Do not normalize a multiple-select question into this chart, because that would imply a whole that does not exist.

## Group selection and ordering

Display no more than five group rows in the primary chart. When the source contains more than five groups, retain four named groups and use the fifth row for `Other`. Select the four named groups using a declared analytical rule—normally the groups with the highest `Category A` share, or a decision-relevant set named in the storyboard—and do not quietly choose groups only because they support the desired claim.

Sort named groups from highest to lowest `Category A`. Keep `Other` last even when its calculated `Category A` share would place it elsewhere, because it is an aggregate rather than a comparable named group. Preserve this order across related pages and platforms unless a later slide explicitly changes the comparison task.

Calculate every `Other` segment from the omitted groups' respondent counts, not from an unweighted average of their percentages:

```text
Other category share = sum(group respondent count x group category share) / sum(omitted group respondent counts)
```

If respondent counts are unavailable, do not fabricate a weighted `Other`. Show fewer named groups and disclose the omission, or retain the original grouping if the source already supplies a valid aggregate.

If the response scale itself contains more than five categories, collapse only substantively compatible low-frequency responses into a separately defined response-category `Other`. Never use one `Other` label to mix omitted user groups with omitted response options.

## Construction

- Use horizontal 100% stacked bars with one shared 0% to 100% width and no perspective, rounded ends, or decorative gaps between segments.
- Keep response segments in the same left-to-right order in every row; the legend must use that exact order.
- Place user-group labels on one shared left guide and align every bar to one shared plot start and end.
- Put the survey question or concise metric above the plot and include `% of respondents`, population, period, and sample size in the subtitle or note.
- Show integer percentage labels inside segments when they fit at the `label` type role with sufficient contrast. Move a narrow value immediately outside its segment or use an evidence-attached annotation; never shrink the label arbitrarily.
- Use thin paper-coloured separators only when adjoining segment colours need separation. Do not add axes, gridlines, or a frame when the 100% bar width already establishes the scale.
- Disclose when figures do not sum to 100% because of rounding and when group sample sizes differ materially.

## Segment palette and highlighting

Resolve all segment colours from the active [theme token registry](../theming/tokens.md). Bind each response category to one stable palette role or derived tint and preserve that mapping across every group, related slide, and target platform. A legend is required unless every segment is directly labelled with its category.

`Category A` should normally receive `chart-series-1`, which usually resolves to the deck's primary colour because it controls the row order. Assign the remaining response categories to the minimum additional chart-series colours required by the data; use the light neutral chart-segment role for a residual, inactive, or intentionally subdued response. Do not reuse chart-series hues on the insight region, row labels, headings, or other structural components. Any palette extension remains subject to the design system's chart-palette contract.

When one segment needs emphasis, keep its category meaning intact: render that segment at the resolved full-strength palette value, subdue its peer segments with approved tints or opacity, and attach a direct annotation. Do not recolour the highlighted mark to a hue that means a different response category. Use a theme-resolved row tint, edge marker, or label weight only when the entire group—not one response segment—is the evidence.

## Insight extraction region

An optional highlight region may sit beside the plot to extract one to three decision-relevant insights. Each insight must name the compared groups or response category, state the observed gap or pattern, and explain why it matters; it must not narrate every visible value or repeat the action title.

Keep the plot at least eight grid columns wide and the insight region no wider than four columns. Bind the region to the active [terminal action-surface variant](../theming/component-bindings.md#terminal-action-surface) and [component section treatment](../components/guidelines.md), including its surface, rule, spacing, typography, and padding. Use the same insight-region treatment across the slide family. If the prose becomes coequal with the evidence or requires a causal argument, use the [argument-with-chart](../slide-types/argument-with-chart.md) archetype rather than compressing the chart.

Link each insight to its evidence with the same category colour, a short leader, or a shared numbered marker. Use one of these mechanisms consistently; do not combine a saturated rail, multiple highlighted rows, coloured outlines, and several leaders.

## Structural HTML reference

This simplified HTML is a geometry and state reference, not a browser implementation requirement. Theme variables own the actual palette, typography, spacing, and implication treatment; PowerPoint and Google Slides adapters recreate the same relationships with native charts or editable shapes.

```html
<div class="percentage-segment-layout">
  <section class="survey-distribution" aria-labelledby="survey-title">
    <header class="exhibit-header">
      <h2 id="survey-title">Response mix by user group</h2>
      <p>% of respondents; n = 1,240</p>
      <ul class="legend" aria-label="Response categories">
        <li><span class="swatch category-a"></span>Category A</li>
        <li><span class="swatch category-b"></span>Category B</li>
        <li><span class="swatch category-c"></span>Category C</li>
      </ul>
    </header>

    <div class="group-row is-highlighted">
      <span class="group-label">Group 1</span>
      <div class="segments" role="img" aria-label="Group 1: 46% Category A, 39% Category B, 15% Category C">
        <span class="segment category-a" style="--share:46">46</span>
        <span class="segment category-b" style="--share:39">39</span>
        <span class="segment category-c" style="--share:15">15</span>
      </div>
    </div>
    <div class="group-row">
      <span class="group-label">Group 2</span>
      <div class="segments" role="img" aria-label="Group 2: 39% Category A, 44% Category B, 17% Category C">
        <span class="segment category-a" style="--share:39">39</span>
        <span class="segment category-b" style="--share:44">44</span>
        <span class="segment category-c" style="--share:17">17</span>
      </div>
    </div>
    <div class="group-row">
      <span class="group-label">Group 3</span>
      <div class="segments" role="img" aria-label="Group 3: 31% Category A, 50% Category B, 19% Category C">
        <span class="segment category-a" style="--share:31">31</span>
        <span class="segment category-b" style="--share:50">50</span>
        <span class="segment category-c" style="--share:19">19</span>
      </div>
    </div>
    <div class="group-row">
      <span class="group-label">Group 4</span>
      <div class="segments" role="img" aria-label="Group 4: 25% Category A, 54% Category B, 21% Category C">
        <span class="segment category-a" style="--share:25">25</span>
        <span class="segment category-b" style="--share:54">54</span>
        <span class="segment category-c" style="--share:21">21</span>
      </div>
    </div>
    <div class="group-row is-other">
      <span class="group-label">Other</span>
      <div class="segments" role="img" aria-label="Other groups: 20% Category A, 57% Category B, 23% Category C">
        <span class="segment category-a" style="--share:20">20</span>
        <span class="segment category-b" style="--share:57">57</span>
        <span class="segment category-c" style="--share:23">23</span>
      </div>
    </div>
  </section>

  <aside class="insight-region" aria-label="Key insights">
    <h3>What this means</h3>
    <p><strong>1</strong> Category A falls 21 points from Group 1 to Group 4.</p>
    <p><strong>2</strong> Category B absorbs most of the difference across groups.</p>
  </aside>
</div>
```

```css
.percentage-segment-layout { display: grid; grid-template-columns: minmax(0, 8fr) minmax(0, 4fr); gap: var(--space-5); }
.survey-distribution { display: grid; align-content: start; row-gap: var(--space-3); }
.exhibit-header { display: grid; row-gap: var(--space-2); margin-block-end: var(--space-2); }
.legend { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); }
.group-row { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 8fr); align-items: center; gap: var(--space-3); }
.segments { display: flex; width: 100%; min-block-size: var(--chart-row-height); overflow: hidden; }
.segment { flex: var(--share) 0 0; display: grid; place-items: center; min-width: 0; }
.category-a { background: var(--chart-category-a-muted); }
.category-b { background: var(--chart-category-b); }
.category-c { background: var(--chart-category-c); }
.is-highlighted .segment.category-a { background: var(--chart-category-a); }
.insight-region { display: grid; align-content: start; gap: var(--space-3); background: var(--implication-surface); border-inline-start: var(--implication-rule); padding: var(--space-4); }
```

## Platform mapping

Prefer one native 100% stacked horizontal bar chart when the platform preserves series order, group order, labels, and normalized widths. If native chart padding or label behavior prevents the five-row composition or insight alignment, build the bars from editable rectangles whose widths are calculated from a shared plot width. Keep the underlying source table and calculated `Other` row available for readback.

In both PowerPoint and Google Slides, explicitly set category order, series order, plot bounds, legend order, label values, and the palette mapping. Render the saved artifact and verify that conversion has not reversed the stack, re-sorted the groups, hidden narrow labels, or changed the highlight state.

## Failure modes

More than five rows, an unweighted `Other`, a different segment order by row, sorting by a different category on each page, more than five response colours, response categories that do not form a whole, unreadable labels inside narrow segments, multiple competing highlights, a generic insight panel that does not cite evidence, and local colours that break the deck-wide chart palette.

## Acceptance test

Verify that every row reconciles to 100% after rounding; the named groups descend by `Category A`; `Other` is last and correctly weighted; response labels, legend order, segment order, and colours match across all rows; no more than five group rows are displayed; every highlighted segment retains its category meaning; and each insight points to a visible comparison in the exact final render.
