# Executive Synthesis

## Use when

- opening an executive pre-read after the title;
- summarizing a recommendation and its reasons;
- closing an analytical section with a decision-oriented synthesis.

Do not use it as an agenda or a collection of titles copied from later slides.

For every multi-chapter decision deck, create one standalone executive synthesis immediately after the cover and before the contents tracker. Do not imply the summary through a recommendation on another page, distribute it across chapter conclusions, or omit it because the action titles appear answer-first.

## Narrative contract

The audience should understand the answer, the two to four reasons it is true, and the action or implication without reading the rest of the deck.

## Content contract

- governing answer or recommendation;
- two to four mutually distinct support branches;
- one proof point per branch;
- implication or decision for each branch when useful;
- one explicit overall decision or next step.

If the support branches are not collectively sufficient, the page is not an executive synthesis.

## Layout

Use the **answer spine** as the default executive-summary design: one governing answer in the action-title zone, followed by three or four aligned support rows and one restrained decision strip. Each row reads left to right as branch claim, proof, and consequence. This creates a complete page-level argument without reproducing the detailed slides that follow.

- Reserve the normal title zone for the governing answer; use a subtitle only for scope, period, confidence, or decision context.
- Start the analytical body on the standard content-top guide and finish above the shared source/footer zone.
- Allocate roughly `3 + 6 + 3` columns to branch claim, proof, and consequence. If consequences are not distinct by branch, use `3 + 9` columns and place one overall decision strip below the rows instead.
- Use three rows by default and four only when every branch is mutually distinct and necessary. Give rows equal height unless evidence genuinely requires one documented dominant row.
- Align every branch claim, proof sentence, metric, and consequence to common vertical guides. Keep the proof column visually dominant through width, not through heavier decoration.
- Separate rows through whitespace or quiet rules from the active component treatment. Do not box every cell or create independent cards.
- Place the overall decision, recommendation, or immediate next step in a shallow bottom strip or a narrow right-hand decision region, never both.
- Apply the [`visible label gate`](../components/copy.md#visible-label-gate) to the decision region. Its default content is the direct action or condition itself, without a generic “Recommendation” or “Decision” prefix.

Use columns only when the support branches are true peers and each can be expressed at comparable depth. Use stacked rows when the logic is causal, sequential, or requires longer evidence. Keep unit widths equal unless one branch is explicitly dominant.

### Supporting design guide

The following HTML is a structural guide for the default answer-spine design. It is not a browser-delivery template and does not own resolved colours, fonts, spacing values, borders, or platform mechanics. Bind its roles to the active [`design`](../design/index.md), [`text-box`](../components/text-box.md), and [`section-treatment`](../components/guidelines.md) definitions.

```html
<section class="exec-summary">
  <header class="exec-summary__title">
    <h1>The recommendation is attractive, provided two diligence risks are resolved</h1>
    <p>Current public evidence; decision required</p>
  </header>
  <main class="exec-summary__spine">
    <article class="exec-summary__row">
      <h2>Market attractiveness</h2>
      <p><strong>Demand is durable:</strong> the category is growing and the target is concentrated in the fastest-growing customer segment.</p>
      <p>Supports the strategic case</p>
    </article>
    <article class="exec-summary__row">
      <h2>Competitive position</h2>
      <p><strong>Differentiation is credible:</strong> retention and win-rate evidence point to a defensible workflow advantage.</p>
      <p>Validate durability in diligence</p>
    </article>
    <article class="exec-summary__row">
      <h2>Economics and risk</h2>
      <p><strong>Value creation is plausible:</strong> base-case returns clear the hurdle, but customer concentration remains material.</p>
      <p>Condition approval on mitigation</p>
    </article>
  </main>
  <aside class="exec-summary__decision">Proceed to confirmatory diligence with explicit concentration and retention gates.</aside>
</section>
```

```css
.exec-summary { display: grid; grid-template-rows: auto 1fr auto; width: 1280px; height: 720px; padding: var(--slide-margin-y) var(--slide-margin-x); background: var(--canvas); color: var(--text-primary); }
.exec-summary__title { padding-bottom: var(--space-5); }
.exec-summary__title h1 { margin: 0; font: var(--type-action-title); }
.exec-summary__title p { margin: var(--space-2) 0 0; font: var(--type-subtitle); color: var(--text-secondary); }
.exec-summary__spine { display: grid; grid-template-rows: repeat(3, 1fr); }
.exec-summary__row { display: grid; grid-template-columns: 3fr 6fr 3fr; gap: var(--space-4); align-items: start; padding: var(--space-4) 0; border-top: var(--rule-quiet); }
.exec-summary__row h2, .exec-summary__row p { margin: 0; }
.exec-summary__row h2 { font: var(--type-section-heading); }
.exec-summary__row p { font: var(--type-body); }
.exec-summary__decision { display: grid; place-items: center; padding: var(--space-3) var(--space-4); background: var(--surface-callout); border-inline-start: var(--rule-accent); font: var(--type-callout); text-align: center; }
```

If the active slide family does not use a filled decision strip, substitute its named rule-separated, edge-accented, or typographic implication treatment. The hierarchy and geometry remain the same.

## Visual rules

- Give each branch claim the strongest local weight.
- Use one number, short evidence phrase, or small evidence marker per branch.
- Separate with whitespace or thin rules rather than heavy cards.
- Apply the accent to the decision or strongest proof, not every heading.
- Keep copy parallel and comparable across branches.

## Variants

- **Answer spine:** three or four stacked claim / proof / consequence rows plus one overall decision; use for most executive summaries.
- **Parallel branch grid:** two to four equal columns or a `2 × 2` field; use only when the branches are peers, their copy depth is comparable, and reading order does not matter.
- **Headline proof:** two to four headline metrics or short findings in one restrained top strip, with a corresponding explanation below; use only when every headline maps one-to-one to a support branch and the numbers materially prove the governing answer.
- **Situation / complication / resolution:** three stacked sections that summarize the starting state, the change or tension, and the recommended response; use when the deck follows that narrative and each section includes the evidence necessary to support the final answer.

Do not combine the variants. A page with a headline strip, four boxed branches, an implication rail, and a decision footer has multiple competing summaries and should be simplified.

## Failure modes

- dense prose with no proof hierarchy;
- more than four equal branches;
- generic headings such as "Key takeaway";
- repeated content without synthesis;
- recommendation highlighted before evidence supports it;
- headline metrics that do not map to the support branches below;
- branch columns with materially different copy depths forced into equal boxes;
- a decorative image occupying analytical space without contributing evidence;
- more than one decision, implication, or next-step region.

## Acceptance test

Hide the rest of the deck. A decision-maker should be able to identify this as the standalone early executive summary and state the answer, the two to four sufficient reasons, the proof behind each reason, and the required action from this page alone. Then remove each branch in turn: every retained branch must weaken the governing answer when removed, and no branch may merely preview a later slide title.
