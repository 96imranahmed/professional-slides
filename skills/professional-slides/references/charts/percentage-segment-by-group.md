# Percentage Segments by User Group

## Best for

Survey results or other mutually exclusive response distributions where the audience must compare how the percentage mix differs across user groups. Each horizontal bar represents one group, every bar resolves to 100%, and each segment represents the same response category in the same order.

Use [general stacked bars](stacked.md) for ordinary part-to-whole analysis that does not require the group cap, focal-category sorting, calculated `Other` row, or adjacent insight extraction defined here. Use [bar and column](bar-column.md) instead when respondents may select multiple answers and the categories therefore do not sum to 100%.

## Guidance note

- Use when mutually exclusive response distributions must be compared across a small number of user groups.
- Why: equal-length 100 percent bars isolate composition differences while stable segment order preserves comparability.
- Action title: state which groups over- or under-index on the focal response and why that difference matters.

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

Show at most five group rows. With more source groups, retain four named groups and use the fifth row for `Other`. Select named groups through a declared rule, normally highest `Category A` share or a storyboard-defined set. Never select groups only because they support the claim.

Sort named groups from highest to lowest `Category A`. Keep `Other` last even when its calculated `Category A` share would place it elsewhere, because it is an aggregate rather than a comparable named group. Preserve this order across related pages and platforms unless a later slide explicitly changes the comparison task.

Calculate every `Other` segment from the omitted groups' respondent counts, not from an unweighted average of their percentages:

```text
Other category share = sum(group respondent count x group category share) / sum(omitted group respondent counts)
```

Equivalently, for response `r`, divide the sum of omitted-group responses in `r` by the sum of omitted-group respondents after applying the declared missing-response policy consistently to both numerator and denominator.

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

Assign `Category A` to `chart-series-1`, the deck's primary chart colour, because it controls the row order. Change that mapping only to preserve an existing cross-slide category encoding or resolve a documented contrast failure, and record the exception in the treatment ledger. Assign the remaining response categories to the minimum additional chart-series colours required by the data; use the light neutral chart-segment role for a residual, inactive, or intentionally subdued response. Do not reuse chart-series hues on the insight region, row labels, headings, or other structural components. Any palette extension remains subject to the design system's chart-palette contract.

When one segment needs emphasis, preserve its category meaning. Use its full-strength palette value, subdue peers with approved tints or opacity, and annotate it directly. Never recolour it to another category's hue. Use a row tint, edge marker, or label weight only when the whole group is the evidence.

## Insight extraction

An optional side section may hold one to three decision-relevant statements. When used, all statements sit inside the slide's single [`Insight Box`](../components/insight-box.md). Each statement names the compared groups or category, states the observed pattern, and explains its relevance. Do not narrate every value or repeat the title.

Keep the plot at least eight grid columns wide and the insight section no wider than four columns. Apply the selected treatment from the [Insight Box owner](../components/insight-box.md). If the prose becomes coequal with the chart or requires a causal argument, give it an explicit content job and compose a weighted row rather than compressing the plot.

Link each insight to its evidence with the same category colour, a short leader, or a shared numbered marker. Use one of these mechanisms consistently; do not combine a saturated rail, multiple highlighted rows, coloured outlines, and several leaders.

## Structural HTML reference

This simplified HTML is a geometry and state reference, not a browser implementation requirement. Theme variables own the actual palette, typography, spacing, and implication treatment; the PowerPoint runtime recreates the same relationships with editable shapes.

```html
<div class="percentage-segment-layout">
  <section class="survey-distribution" aria-labelledby="survey-title">
    <header class="exhibit-header">
      <h2 id="survey-title">Purchase priority differs by user role</h2>
      <p>% of UK enterprise software users; Q2 2026; n = 1,240</p>
      <ul class="legend" aria-label="Response categories">
        <li><span class="swatch category-a"></span>Ease of use</li>
        <li><span class="swatch category-b"></span>Feature depth</li>
        <li><span class="swatch category-c"></span>Other priority</li>
      </ul>
    </header>

    <div class="group-row is-highlighted">
      <span class="group-label">Administrators</span>
      <div class="segments" role="img" aria-label="Administrators: 46% ease of use, 39% feature depth, 15% other priority">
        <span class="segment category-a" style="--share:46">46</span>
        <span class="segment category-b" style="--share:39">39</span>
        <span class="segment category-c" style="--share:15">15</span>
      </div>
    </div>
    <div class="group-row">
      <span class="group-label">Analysts</span>
      <div class="segments" role="img" aria-label="Analysts: 39% ease of use, 44% feature depth, 17% other priority">
        <span class="segment category-a" style="--share:39">39</span>
        <span class="segment category-b" style="--share:44">44</span>
        <span class="segment category-c" style="--share:17">17</span>
      </div>
    </div>
    <div class="group-row">
      <span class="group-label">Operators</span>
      <div class="segments" role="img" aria-label="Operators: 31% ease of use, 50% feature depth, 19% other priority">
        <span class="segment category-a" style="--share:31">31</span>
        <span class="segment category-b" style="--share:50">50</span>
        <span class="segment category-c" style="--share:19">19</span>
      </div>
    </div>
    <div class="group-row">
      <span class="group-label">Executives</span>
      <div class="segments" role="img" aria-label="Executives: 25% ease of use, 54% feature depth, 21% other priority">
        <span class="segment category-a" style="--share:25">25</span>
        <span class="segment category-b" style="--share:54">54</span>
        <span class="segment category-c" style="--share:21">21</span>
      </div>
    </div>
    <div class="group-row is-other">
      <span class="group-label">Other roles</span>
      <div class="segments" role="img" aria-label="Other roles: 20% ease of use, 57% feature depth, 23% other priority">
        <span class="segment category-a" style="--share:20">20</span>
        <span class="segment category-b" style="--share:57">57</span>
        <span class="segment category-c" style="--share:23">23</span>
      </div>
    </div>
  </section>

  <aside class="insight-region" aria-label="Key insights">
    <h3>Ease of use declines 21 points from administrators to executives</h3>
    <p>Feature depth absorbs 15 points of the difference, while other priorities absorb six.</p>
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

Build the rows from editable rectangles whose widths use one shared plot width. Freeze group order, stack order, legend order, labels, normalized widths, and the calculated `Other` values in the scene so an adapter cannot reverse or re-sort them.

## Failure modes

Reject more than five rows, an unweighted `Other`, changing segment order, inconsistent sorting, or more than five response colours. Also reject incomplete wholes, unreadable labels, competing highlights, generic insights, and colours outside the deck palette.

## Acceptance test

Verify every row reconciles to 100% after rounding. Named groups descend by `Category A`; `Other` is last and weighted correctly. Labels, legend order, segments, and colours match across rows. Show at most five rows. Highlights preserve category meaning. Each insight cites a visible comparison in the final render.
