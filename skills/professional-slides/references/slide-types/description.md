# Description Slide

This is the base slide type for three to five repeated categories, trends, findings, capabilities, workstreams, or other sibling descriptions. Use it when aligned rows explain what each item is, contains, or exemplifies without making a separate row-level inference.

## Use when

The audience must understand a small taxonomy or repeated set before later pages examine its parts. Suitable examples include trends, diligence branches, customer needs, value levers, operating capabilities, risk families, or programme workstreams. Select [`decomposition`](decomposition.md) when the page explains how the items form one whole, or [`comparison and options`](comparison-options.md) when peers are evaluated on a common decision basis.

## Content contract

- three to five parallel items whose relationship is clear from the action title and column headings;
- one concise label plus one, two, three, or more aligned detail fields that perform the same jobs for every item;
- an optional number or letter from [`item indicators`](../components/item-indicators.md) when explicit ordering or stable cross-reference improves scanning;
- one consistent category visual treatment from [`icons, category images, and logos`](../components/icons-and-logos.md): `icon-only`, `image-only`, or `icon-image` when the visuals materially improve scanning or recognition;
- one action title explaining why the repeated set matters.

## Layout

Use one row for three or four compact categories, two rows for four or five categories with more evidence, or aligned category rows when every category needs a description and one consistent secondary field. Use one left-hand parent field plus aligned child rows when hierarchy matters. Use open fields with top rules or whitespace before boxed cards. Keep peers equal unless the narrative explicitly names one as dominant.

For a one-row category composition, use icons, images, or both. Icons provide a compact semantic cue; images make a category, example, product, place, or use context concrete. A combined treatment is valid only when the icon and image perform distinct jobs. Apply the selected treatment to every peer, keep peer image crops and icon geometry consistent, and retain the category label and description rather than asking either visual to carry the argument alone.

Aligned rows form one **description ledger**, not a data table, when the row labels identify the repeated items and the remaining fields explain them rather than provide comparable measurements. A ledger may use one, two, three, or more detail columns. Define each detail field's semantic job before allocating columns, and repeat the same fields and geometry in every row. Use one of four named constructions:

- `trend-with-examples` for category, description, and examples;
- `icon-label-narrative` for an icon-plus-label field and one narrative field;
- `label-only-narrative` for a label field and one narrative field when icons do not add meaning.
- `embedded-indicator-narrative` for a numbered or lettered marker embedded into the leading edge of the category field, followed by one or more aligned detail columns.

When several detail columns make the component dense, set `data-content-density="dense"` on the ledger. Reduce the typography aliases inside the ledger as one unit; do not change the action title or any other slide furniture. Four or more detail columns are acceptable only when the fields remain scannable at the delivered size.

An item indicator may occupy its own narrow grid column or use the embedded construction. In a dedicated column, center the marker horizontally within that column and vertically within the row. Do not draw a heading rule over an empty indicator header cell.

Every row shares one vertical centerline. Center each label, narrative block, secondary field, icon, and indicator as a complete content block within the row instead of top-aligning shorter fields beside taller ones. A filled label field may stretch to the row's content height, but its contents remain vertically centered. Use symmetric block padding so the content center does not drift toward either divider.

Do not add an implication arrow merely to restate left-to-right reading order. Use alignment and the active theme's section treatment. If every row makes a real inference from a description or finding to its own consequence, extend this base through [`Description with Implication Slide`](description-with-implication.md). If the rows combine into one page-level decision or action, use one terminal action surface instead of repeated row outcomes.

## Structural references

Use the category visual-row specimen in [`icons, category images, and logos`](../components/icons-and-logos.md#structural-html-reference) for `icon-only`, `image-only`, and combined `icon-image` category fields. The four theme-bound description-ledger HTML specimens are owned below. For the hierarchical variant, place the parent statement in the first three grid columns and the repeated description field in the remaining nine columns.

## Theme contract

| Component | Consumed custom properties | Default binding |
| --- | --- | --- |
| slide canvas | `--slide-bg`, `--slide-color`, `--slide-padding-inline`, `--slide-padding-block`, `--slide-column-gap` | `canvas`, `ink`, density margins, density grid gutter |
| action title | `--action-title-font`, `--action-title-color`, `--action-title-rule`, `--action-title-gap`, `--action-title-width` | action-title role, `ink`, page rule, density separator gap and title width |
| ledger | `--description-slide-gap`, `--description-slide-row-gap`, `--description-slide-row-rule`, `--description-slide-row-padding`, `--description-slide-columns`, `--description-slide-dense-font` | density grid gutter, `space-2`, quiet rule, `space-2`, named layout variant, compact body role |
| column heading | `--description-slide-heading-font`, `--description-slide-heading-color`, `--description-slide-heading-rule`, `--description-slide-heading-gap` | body-sized column-heading role, `ink`, page rule, `space-2` |
| item label | `--description-slide-label-bg`, `--description-slide-label-color`, `--description-slide-label-font`, `--description-slide-label-padding`, `--description-slide-label-gap`, `--description-slide-label-embedded-padding` | inverse surface, on-inverse text, section-heading role, `space-4`, `space-3`, `space-6` |
| narrative field | `--description-slide-body-font`, `--description-slide-body-color`, `--description-slide-body-gap`, `--description-slide-list-indent` | compact body role, `ink`, `space-2`, `space-5` |
| secondary field | `--description-slide-side-bg`, `--description-slide-side-color`, `--description-slide-side-font`, `--description-slide-side-padding` | transparent, `ink`, compact body role, `space-4` |
| semantic icon | `--description-slide-icon-color`, `--description-slide-icon-size`, `--description-slide-icon-stroke` | component primary, icon-lg, standard line |
| source | `--source-font`, `--source-color`, `--source-rule`, `--source-gap` | source role, secondary text, quiet rule, `space-1` |

## Structural HTML reference

Each root demonstrates one active visual family and density. The same markup may use `executive-light`, `executive-dark`, or `warm-editorial` by changing only `data-theme`.

### Trend with examples

~~~html
<main class="deck" data-theme="executive-dark" data-density="pre-read">
  <section class="slide" aria-label="Three trends with descriptions and examples">
    <header class="action-title" data-lines="one">
      <h1>Three trends are raising expectations for speed, visibility, and personalization</h1>
    </header>

    <section class="description-slide" data-variant="trend-with-examples" data-detail-columns="2">
      <div class="description-slide__head" aria-hidden="true">
        <span>Trend</span><span>Description</span><span>Examples</span>
      </div>
      <article class="description-slide__row">
        <h2 class="description-slide__label">Instant service</h2>
        <ul class="description-slide__body">
          <li>Customers expect real-time confirmation and status.</li>
          <li>Manual handoffs become visible as avoidable delay.</li>
          <li>Self-service shifts routine demand away from agents.</li>
        </ul>
        <ul class="description-slide__side"><li>Live order tracking</li><li>Automated status alerts</li></ul>
      </article>
      <article class="description-slide__row">
        <h2 class="description-slide__label">Connected journeys</h2>
        <ul class="description-slide__body">
          <li>Users expect context to persist across channels.</li>
          <li>Duplicate data entry erodes trust and completion.</li>
          <li>Shared identity enables a consistent experience.</li>
        </ul>
        <ul class="description-slide__side"><li>Cross-channel case history</li><li>Single customer profile</li></ul>
      </article>
      <article class="description-slide__row">
        <h2 class="description-slide__label">Relevant guidance</h2>
        <ul class="description-slide__body">
          <li>Customers reward guidance matched to their context.</li>
          <li>Generic outreach creates noise without clear value.</li>
          <li>Trusted data supports timely next-best actions.</li>
        </ul>
        <ul class="description-slide__side"><li>Contextual recommendations</li><li>Proactive service prompts</li></ul>
      </article>
    </section>

    <footer class="source-line">Source: Illustrative trend structure</footer>
  </section>
</main>
~~~

### Icon and label narrative

~~~html
<main class="deck" data-theme="warm-editorial" data-density="executive">
  <section class="slide" aria-label="Five icon-led categories with narratives">
    <header class="action-title" data-lines="one">
      <h1>Five capabilities must work together to improve service performance</h1>
    </header>

    <section class="description-slide" data-variant="icon-label-narrative" data-detail-columns="1">
      <div class="description-slide__head" aria-hidden="true"><span>Capability</span><span>Role in the system</span></div>
      <article class="description-slide__row">
        <h2 class="description-slide__label"><svg class="description-slide__icon" viewBox="0 0 24 24" data-icon-library="lucide" data-icon-name="circle-gauge" aria-hidden="true"><path d="M15.6 2.7a10 10 0 1 0 5.7 5.7"/><circle cx="12" cy="12" r="2"/><path d="M13.4 10.6 19 5"/></svg><span>Operational control</span></h2>
        <p class="description-slide__body">Standard workflows and visible performance measures reduce avoidable variation while preserving necessary local judgment.</p>
      </article>
      <article class="description-slide__row">
        <h2 class="description-slide__label"><svg class="description-slide__icon" viewBox="0 0 24 24" data-icon-library="lucide" data-icon-name="accessibility" aria-hidden="true"><circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-6 1"/><path d="m5 8 3-3 5.5 3-2.36 3.5"/><path d="M4.24 14.5a5 5 0 0 0 6.88 6"/><path d="M13.76 17.5a5 5 0 0 0-6.88-6"/></svg><span>Customer access</span></h2>
        <p class="description-slide__body">Inclusive channels, clear language, and consistent status information let customers complete more journeys without assistance.</p>
      </article>
      <article class="description-slide__row">
        <h2 class="description-slide__label"><svg class="description-slide__icon" viewBox="0 0 24 24" data-icon-library="lucide" data-icon-name="network" aria-hidden="true"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg><span>Connected technology</span></h2>
        <p class="description-slide__body">Shared identity, integrated records, and reliable interfaces make end-to-end visibility possible across the operating model.</p>
      </article>
      <article class="description-slide__row">
        <h2 class="description-slide__label"><svg class="description-slide__icon" viewBox="0 0 24 24" data-icon-library="lucide" data-icon-name="building" aria-hidden="true"><path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/></svg><span>Accountable organization</span></h2>
        <p class="description-slide__body">Clear decision rights and capability ownership turn new tools and processes into sustained operational practice.</p>
      </article>
      <article class="description-slide__row">
        <h2 class="description-slide__label"><svg class="description-slide__icon" viewBox="0 0 24 24" data-icon-library="lucide" data-icon-name="eye-off" aria-hidden="true"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg><span>Risk visibility</span></h2>
        <p class="description-slide__body">Explicit controls and exception reporting make operational, customer, and data risks visible before they compound.</p>
      </article>
    </section>

    <footer class="source-line">Source: Illustrative capability structure</footer>
  </section>
</main>
~~~

### Label-only narrative

~~~html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide" aria-label="Five labeled categories with narratives">
    <header class="action-title" data-lines="two">
      <h1>Five workstreams address the operating model from process through performance</h1>
    </header>

    <section class="description-slide" data-variant="label-only-narrative" data-detail-columns="1">
      <div class="description-slide__head" aria-hidden="true"><span>Workstream</span><span>Scope</span></div>
      <article class="description-slide__row"><h2 class="description-slide__label">Process</h2><p class="description-slide__body">Simplify core journeys, remove avoidable handoffs, and define the standard path plus controlled exceptions.</p></article>
      <article class="description-slide__row"><h2 class="description-slide__label">Experience</h2><p class="description-slide__body">Improve channel continuity, status transparency, and service recovery across priority customer journeys.</p></article>
      <article class="description-slide__row"><h2 class="description-slide__label">Technology</h2><p class="description-slide__body">Connect systems of record, automate repetitive work, and improve data quality for operational decisions.</p></article>
      <article class="description-slide__row"><h2 class="description-slide__label">Organization</h2><p class="description-slide__body">Clarify decision rights, strengthen delivery capabilities, and align incentives with end-to-end outcomes.</p></article>
      <article class="description-slide__row"><h2 class="description-slide__label">Performance</h2><p class="description-slide__body">Tie measures to value, establish review cadence, and make tradeoffs visible to accountable owners.</p></article>
    </section>

    <footer class="source-line">Source: Illustrative workstream structure</footer>
  </section>
</main>
~~~

### Embedded indicator with three detail columns

~~~html
<main class="deck" data-theme="executive-light" data-density="pre-read">
  <section class="slide" aria-label="Four numbered trends with three detail columns">
    <header class="action-title" data-lines="one">
      <h1>Four shifts are changing demand, economics, and execution requirements</h1>
    </header>

    <section class="description-slide" data-variant="embedded-indicator-narrative" data-detail-columns="3" data-content-density="dense">
      <div class="description-slide__head" aria-hidden="true"><span>Trend</span><span>Signal</span><span>Meaning</span><span>Example</span></div>
      <article class="description-slide__row">
        <h2 class="description-slide__label" data-indicator-placement="embedded"><span class="item-indicator" data-shape="circle" data-placement="embedded-start" data-contrast="inverse-keyline">1</span><span>Instant service</span></h2>
        <p class="description-slide__body">Customers expect live confirmation.</p><p class="description-slide__body">Delay is now visible.</p><p class="description-slide__side">Status alerts</p>
      </article>
      <article class="description-slide__row">
        <h2 class="description-slide__label" data-indicator-placement="embedded"><span class="item-indicator" data-shape="circle" data-placement="embedded-start" data-contrast="inverse-keyline">2</span><span>Connected journeys</span></h2>
        <p class="description-slide__body">Context must persist across channels.</p><p class="description-slide__body">Repeated entry erodes trust.</p><p class="description-slide__side">Shared history</p>
      </article>
      <article class="description-slide__row">
        <h2 class="description-slide__label" data-indicator-placement="embedded"><span class="item-indicator" data-shape="circle" data-placement="embedded-start" data-contrast="inverse-keyline">3</span><span>Relevant guidance</span></h2>
        <p class="description-slide__body">Advice must match customer context.</p><p class="description-slide__body">Generic outreach loses value.</p><p class="description-slide__side">Next-best action</p>
      </article>
      <article class="description-slide__row">
        <h2 class="description-slide__label" data-indicator-placement="embedded"><span class="item-indicator" data-shape="circle" data-placement="embedded-start" data-contrast="inverse-keyline">4</span><span>Visible performance</span></h2>
        <p class="description-slide__body">Comparable measures expose variation.</p><p class="description-slide__body">Owners can target root causes.</p><p class="description-slide__side">Control tower</p>
      </article>
    </section>

    <footer class="source-line">Source: Illustrative trend structure</footer>
  </section>
</main>
~~~

~~~css
.slide {
  --slide-bg: var(--canvas);
  --slide-color: var(--ink);
  --slide-padding-inline: var(--slide-margin-inline);
  --slide-padding-block: var(--slide-margin-block);
  --slide-column-gap: var(--grid-gutter);

  box-sizing: border-box;
  width: var(--slide-width);
  height: var(--slide-height);
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: var(--slide-column-gap);
  padding: var(--slide-padding-block) var(--slide-padding-inline);
  background: var(--slide-bg);
  color: var(--slide-color);
}

.action-title {
  --action-title-font: var(--type-action-title);
  --action-title-color: var(--ink);
  --action-title-rule: var(--rule-page);
  --action-title-gap: var(--title-separator-gap);
  --action-title-width: var(--title-width);

  width: var(--action-title-width);
  color: var(--action-title-color);
  border-bottom: var(--action-title-rule);
  padding-bottom: var(--action-title-gap);
}

.action-title h1 { margin: 0; font: var(--action-title-font); }

.description-slide {
  --description-slide-gap: var(--grid-gutter);
  --description-slide-row-gap: var(--space-2);
  --description-slide-row-rule: var(--rule-quiet);
  --description-slide-row-padding: var(--space-1);
  --description-slide-columns: 3fr 9fr;
  --description-slide-heading-font: var(--type-column-heading);
  --description-slide-heading-color: var(--ink);
  --description-slide-heading-rule: var(--rule-page);
  --description-slide-heading-gap: var(--space-2);
  --description-slide-label-bg: var(--surface-inverse);
  --description-slide-label-color: var(--on-inverse);
  --description-slide-label-font: var(--type-section-heading);
  --description-slide-label-padding: var(--space-4);
  --description-slide-label-gap: var(--space-3);
  --description-slide-label-embedded-padding: var(--space-6);
  --description-slide-body-font: var(--type-body-compact);
  --description-slide-body-color: var(--ink);
  --description-slide-body-gap: var(--space-2);
  --description-slide-list-indent: var(--space-5);
  --description-slide-side-bg: transparent;
  --description-slide-side-color: var(--ink);
  --description-slide-side-font: var(--type-body-compact);
  --description-slide-side-padding: var(--space-4);
  --description-slide-icon-color: var(--component-primary);
  --description-slide-icon-size: var(--icon-lg);
  --description-slide-icon-stroke: var(--line-standard);
  --description-slide-dense-font: var(--type-body-compact);

  min-height: 0;
  display: grid;
  grid-template-rows: auto;
  grid-auto-rows: 1fr;
  gap: var(--description-slide-row-gap);
}

.description-slide[data-detail-columns="1"] { --description-slide-columns: 3fr 9fr; }
.description-slide[data-detail-columns="2"] { --description-slide-columns: 2fr 7fr 3fr; }
.description-slide[data-detail-columns="3"] { --description-slide-columns: 3fr 3fr 3fr 3fr; }

.description-slide[data-variant="icon-label-narrative"],
.description-slide[data-variant="label-only-narrative"] {
  --description-slide-label-bg: var(--surface-1);
  --description-slide-label-color: var(--component-primary);
}

.description-slide[data-content-density="dense"] {
  --description-slide-label-font: var(--description-slide-dense-font);
  --description-slide-body-font: var(--description-slide-dense-font);
  --description-slide-side-font: var(--description-slide-dense-font);
}

.description-slide__head,
.description-slide__row {
  display: grid;
  grid-template-columns: var(--description-slide-columns);
  gap: var(--description-slide-gap);
}

.description-slide__head span {
  padding-bottom: var(--description-slide-heading-gap);
  border-bottom: var(--description-slide-heading-rule);
  color: var(--description-slide-heading-color);
  font: var(--description-slide-heading-font);
}

.description-slide__row {
  align-items: center;
  min-height: 0;
  border-bottom: var(--description-slide-row-rule);
  padding-block: var(--description-slide-row-padding);
}

.description-slide__row:last-of-type { border-bottom: 0; }

.description-slide__label {
  align-self: stretch;
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--description-slide-label-gap);
  padding: var(--description-slide-label-padding);
  background: var(--description-slide-label-bg);
  color: var(--description-slide-label-color);
  font: var(--description-slide-label-font);
}

.description-slide__label[data-indicator-placement="embedded"] {
  position: relative;
  padding-inline-start: var(--description-slide-label-embedded-padding);
}

.description-slide__body,
.description-slide__side { margin: 0; align-self: center; }

.description-slide__body {
  color: var(--description-slide-body-color);
  font: var(--description-slide-body-font);
}

ul.description-slide__body,
ul.description-slide__side {
  display: grid;
  gap: var(--description-slide-body-gap);
  padding-inline-start: var(--description-slide-list-indent);
}

.description-slide__side {
  padding: var(--description-slide-side-padding);
  background: var(--description-slide-side-bg);
  color: var(--description-slide-side-color);
  font: var(--description-slide-side-font);
}

.description-slide__icon {
  flex: none;
  width: var(--description-slide-icon-size);
  height: var(--description-slide-icon-size);
  fill: none;
  stroke: var(--description-slide-icon-color);
  stroke-width: var(--description-slide-icon-stroke);
  stroke-linecap: round;
  stroke-linejoin: round;
}

.source-line {
  --source-font: var(--type-source);
  --source-color: var(--text-secondary);
  --source-rule: var(--rule-quiet);
  --source-gap: var(--space-1);

  padding-top: var(--source-gap);
  border-top: var(--source-rule);
  color: var(--source-color);
  font: var(--source-font);
}
~~~

## Variants and states

- `trend-with-examples` uses three open semantic fields. The examples column supplies concrete instances, not another conclusion.
- `icon-label-narrative` uses one registered Lucide icon per peer. The icon reinforces the label and never replaces it.
- `label-only-narrative` removes the icon slot entirely. Do not leave empty icon space or add a decorative square.
- `embedded-indicator-narrative` uses the reusable item indicator on the leading edge of the label field. Its default specimen uses the preferred `inverse-keyline` treatment so the dark circle remains distinct from the inverse label field through a slight on-inverse border. The marker identifies the row; it does not encode status.
- `data-detail-columns` may declare one, two, or three registered grids. For more detail fields, resolve `--description-slide-columns` against the same 12-column system and keep each semantic field wide enough to scan.
- `data-content-density="dense"` normalizes label, body, and secondary-field typography to the dense component role. The column heading remains bold at the same size and line height as the body. Dense mode never changes `.action-title` or another slide-level type role.
- Column headings use the bold `type-column-heading` role at the same size and line height as compact body text. They do not use the larger category or section-heading role.
- Every row uses one vertical centerline. Multi-line fields center as complete blocks, while filled label fields may stretch without moving their contents off that centerline.
- Internal rows use the quiet divider. The final row has no bottom divider because the footer or slide guide closes the exhibit.
- The native theme variants change visual-family values only. Density may change scale and guides, but it may not be used to compress one overcrowded row.

No shared semantic state is demonstrated. Add `data-state` only when a category has a defined state, threshold, and non-colour cue.

## Native translation

Translate each row or category column into one editable native group aligned to the resolved 12-column grid. Materialize the selected visual family and density through builder constants or native theme values. Keep label, narrative, and every detail field on stable column guides, and keep every peer on one repeated internal grid. Align the vertical center of every content block to the row center, including multi-line text treated as one block. A filled label surface may span the row's content height, but center its text and icon within that surface. Build item indicators as editable native shapes and text. Center a dedicated indicator in both its column and row; for an embedded indicator, center the marker on the label field's leading boundary so it juts out consistently. Use editable SVG or native icon geometry. Keep each category image as a replaceable native image object with a deliberate crop, and keep labels, icons, and descriptions editable rather than flattening the composition.

## Specimen acceptance check

- Exactly one Description Slide type is declared.
- The repeated labels are parallel siblings that answer one parent question.
- Every row uses the same semantic fields and one repeated geometry.
- Every label, detail block, icon, and indicator is vertically centered on the row's shared centerline.
- One, two, three, or more detail columns are permitted only when each column has a stable semantic job and remains legible.
- Dedicated-column indicators are centered horizontally and vertically; embedded indicators overlap the category field edge consistently and remain distinct from its fill.
- Dense mode changes only component typography and leaves the action title unchanged.
- The final row divider is absent, leaving one unambiguous footer or slide guide below the component.
- Changing only `data-theme` preserves structure and meaning.
- Changing only `data-density` preserves construction and uses registered type and spacing scales.
- Secondary fields do not repeat the action title or masquerade as implications.
- Category visuals use one registered `icon-only`, `image-only`, or `icon-image` treatment across every peer; images share one crop grammar and combined visuals perform distinct jobs.
- Icons, when used, come from one registered library and are present for every peer.
- All copy, sources, and fields remain editable in the native slide artifact.

## Failure modes

Overlapping categories, generic icons, decorative stock images, inconsistent peer crops, redundant icon-image pairs, different accent colours for peers, slogans without scope, five categories that do not cover the parent question, decorative category cards that consume more space than their evidence, implication arrows attached to descriptions that make no inference, and table styling applied to prose that is not comparative data.

## Acceptance test

Removing any category creates a real gap, merging any two loses a decision-relevant distinction, the selected `icon-only`, `image-only`, or `icon-image` treatment improves scanning or recognition without carrying unsupported meaning, every secondary field performs the same semantic job, and the labels recur consistently in later pages when the taxonomy becomes navigation.
