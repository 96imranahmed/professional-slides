# Executive Synthesis

The executive synthesis is a distinct slide type. It is not an agenda, contents page, tracker, scorecard, RAG dashboard, or collection of status cards. Give it the visible structural label **Executive summary** and do not add a subtitle, kicker, or eyebrow.

## Use and content

Use it near the start of an executive pre-read when the audience needs the answer before the supporting analysis. Do not force it into an existing deck unless the requested revision authorizes the structural change.

The page needs one governing answer in the title, two to four supporting branches, proof for each branch, the decision consequence of each branch, and one overall action, condition, or recommendation. Each branch is a distinct paragraph group with a primary-colour subheading and supporting prose or bullets. A verdict without proof is not synthesis.

## Layout

Use one column for a linear argument, two columns for peer paragraphs, and three columns only when three parallel groups are genuinely co-equal. Branches are open, borderless, and backgroundless. They do not have top accent lines. The active document style may add a consistent underline directly below every branch heading; otherwise use accent text alone. Do not vary that choice within the page. Put the overall action or condition in the reusable [`Insight Box`](../components/insight-box.md). Do not add a tracker or repeated status strip.

## HTML scaffolds

Each root demonstrates one density and theme. Change only `data-theme` to reuse the structure. None includes a subtitle.

### One column

~~~html
<main class="deck" data-theme="executive-light" data-density="executive"><section class="slide" aria-label="One-column executive summary"><header class="action-title"><h1>Executive summary</h1></header><section class="executive-synthesis" data-variant="one-column" data-heading-style="text"><article class="executive-synthesis__branch"><h2>Standardize the core journey</h2><p>Repeated handoffs drive delay and rework. One default path removes avoidable variation.</p></article><article class="executive-synthesis__branch"><h2>Make ownership explicit</h2><p>One accountable owner should govern each outcome and exception path.</p></article><article class="executive-synthesis__branch"><h2>Instrument value before scaling</h2><p>Comparable measures let leaders target causes and sequence investment.</p></article><aside class="insight-box" data-variant="tonal" data-width="full">Approve the standard model and release funding against measured adoption gates.</aside></section><footer class="source-line">Source: Illustrative executive synthesis</footer></section></main>
~~~

### Two columns

~~~html
<main class="deck" data-theme="warm-editorial" data-density="executive"><section class="slide" aria-label="Two-column executive summary"><header class="action-title"><h1>Executive summary</h1></header><section class="executive-synthesis" data-variant="two-column" data-heading-style="underline"><article class="executive-synthesis__branch"><h2>Customer demand is shifting</h2><p>Faster service and visible status now shape trust and retention.</p></article><article class="executive-synthesis__branch"><h2>Operations remain fragmented</h2><p>Manual handoffs and unclear ownership constrain throughput.</p></article><article class="executive-synthesis__branch"><h2>Technology can unlock control</h2><p>Shared data and integration make end-to-end performance visible.</p></article><article class="executive-synthesis__branch"><h2>Adoption determines value</h2><p>Capability building must track the rollout sequence.</p></article><aside class="insight-box" data-variant="neutral" data-width="full" data-align="left">Prioritize the standard journey, accountable owners, and adoption measures.</aside></section><footer class="source-line">Source: Illustrative executive synthesis</footer></section></main>
~~~

### Three columns

~~~html
<main class="deck" data-theme="executive-dark" data-density="executive"><section class="slide" aria-label="Three-column executive summary"><header class="action-title"><h1>Executive summary</h1></header><section class="executive-synthesis" data-variant="three-column" data-heading-style="text"><article class="executive-synthesis__branch"><h2>Objectives</h2><ul><li>Reduce avoidable delay.</li><li>Improve customer visibility.</li><li>Increase accountable ownership.</li></ul></article><article class="executive-synthesis__branch"><h2>Project approach</h2><ul><li>Define the standard journey.</li><li>Test priority exceptions.</li><li>Measure value before rollout.</li></ul></article><article class="executive-synthesis__branch"><h2>Deliverables</h2><ul><li>Approved operating model.</li><li>Sequenced implementation plan.</li><li>Adoption and value scorecard.</li></ul></article><aside class="insight-box" data-variant="primary" data-width="full">Launch the first market after owners, controls, and measures are confirmed.</aside></section><footer class="source-line">Source: Illustrative executive synthesis</footer></section></main>
~~~

~~~css
.slide{box-sizing:border-box;width:var(--slide-width);height:var(--slide-height);display:grid;grid-template-rows:auto 1fr auto;gap:var(--slide-column-gap);padding:var(--slide-padding-block) var(--slide-padding-inline);background:var(--slide-bg);color:var(--slide-color)}
.slide{--slide-bg:var(--canvas);--slide-color:var(--ink);--slide-padding-inline:var(--slide-margin-inline);--slide-padding-block:var(--slide-margin-block);--slide-column-gap:var(--grid-gutter)}
.action-title{--action-title-font:var(--type-action-title);--action-title-color:var(--ink);--action-title-rule:var(--rule-page);--action-title-gap:var(--title-separator-gap);font:var(--action-title-font);color:var(--action-title-color);border-bottom:var(--action-title-rule);padding-bottom:var(--action-title-gap)}.action-title h1{margin:0;font:inherit}
.executive-synthesis{--executive-synthesis-gap:var(--grid-gutter);--executive-synthesis-branch-gap:var(--space-3);--executive-synthesis-heading-font:var(--type-callout);--executive-synthesis-heading-color:var(--component-primary);--executive-synthesis-heading-rule:var(--rule-emphasis);--executive-synthesis-heading-rule-gap:var(--space-2);--executive-synthesis-body-font:var(--type-body);--executive-synthesis-body-color:var(--ink);--executive-synthesis-list-indent:var(--space-5);display:grid;grid-template-columns:var(--executive-synthesis-columns);gap:var(--executive-synthesis-gap);min-height:0;align-content:stretch}
.executive-synthesis[data-variant="one-column"]{--executive-synthesis-columns:1fr;grid-template-rows:repeat(3,minmax(0,1fr)) auto}.executive-synthesis[data-variant="two-column"]{--executive-synthesis-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr)) auto}.executive-synthesis[data-variant="three-column"]{--executive-synthesis-columns:repeat(3,minmax(0,1fr));grid-template-rows:minmax(0,1fr) auto}
.executive-synthesis__branch{display:flex;flex-direction:column;justify-content:center;gap:var(--executive-synthesis-branch-gap);padding:0;border:0;background:transparent}.executive-synthesis__branch h2{margin:0;font:var(--executive-synthesis-heading-font);color:var(--executive-synthesis-heading-color);border:0}.executive-synthesis[data-heading-style="underline"] .executive-synthesis__branch h2{padding-bottom:var(--executive-synthesis-heading-rule-gap);border-bottom:var(--executive-synthesis-heading-rule)}.executive-synthesis__branch p,.executive-synthesis__branch ul{margin:0;font:var(--executive-synthesis-body-font);color:var(--executive-synthesis-body-color)}.executive-synthesis__branch ul{padding-left:var(--executive-synthesis-list-indent)}.executive-synthesis>.insight-box{grid-column:1/-1}
.source-line{font:var(--type-source);color:var(--text-secondary);border-top:var(--rule-quiet);padding-top:var(--space-1)}
~~~

## Check

- The page title is Executive summary and has no subtitle.
- Paragraph regions are open and borderless; any heading underline sits below the heading, never above the text box.
- Every branch includes a conclusion, proof, and consequence.
- The reusable insight box gives one explicit action or condition.
- The page cannot be mistaken for navigation or status reporting.
- The close of the deck still aligns with this answer.
