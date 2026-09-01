# Description with Implication Slide

This slide type explicitly inherits from [`Description Slide`](description.md). It preserves the base slide's repeated labels, detail columns, density behavior, indicator placements, row dividers, footer relationship, and theme discipline, then adds one mandatory inference arrow and one decision-relevant implication to every row.

Use it when the audience must trace each description, finding, or condition to a distinct consequence, choice, risk, or opportunity. The row arrow means **therefore**. It is not a process connector and must not be added when the right-hand field is only another description; in that case, use the base Description Slide.

## Use when

Use three to five parallel rows for diagnostic findings and consequences, market shifts and strategic implications, risks and management responses, or observed conditions and operating outcomes. The audience should be able to scan any row independently and answer both questions: what is true, and what follows from it?

## Inheritance contract

- Start with a valid Description Slide row: optional label or item indicator plus one or more aligned detail fields.
- Add one dedicated arrow column after the description region and one implication field after the arrow.
- Preserve the base component's title, density, theme, indicator, divider, and editability rules unless this owner explicitly overrides them.
- Inherit the base row centerline: center the description fields, arrow, implication, label contents, and indicators vertically as complete blocks within every row.
- Keep one repeated geometry across all rows. The implication extension does not authorize unrelated cards, fills, or per-row variants.
- Use [`arrows`](../components/arrows.md) for the inference mark and [`item indicators`](../components/item-indicators.md) for numbered or lettered markers.

## Boundary

- Unlike [`Description Slide`](description.md), every row must make a real inference and therefore owns an arrow and implication field.
- Unlike [`text-led implication`](text-led-implication.md), this slide has several row-level reasoning chains rather than one page-level terminal implication.
- Unlike [`process and roadmap`](process-roadmap.md), the arrows encode logic rather than time, sequence, dependency, or handoff.
- If the right-hand field only restates an outcome or label, remove the arrow and use the base Description Slide.

## Implication treatment

The default treatment is `open`: no background, with the implication carried by the callout type role. Use `subtle` only when a true implication needs a stronger boundary from dense findings. Bind it to the quiet neutral `surface-1`, which appears as very light gray in a light theme. Ordinary impact or outcome text receives no background merely because it occupies the right-hand column. Never use `surface-action`, `component-primary-tint`, or another saturated action treatment for row implications.

The copy is illustrative geometry, not client evidence. Replace it with sourced content and an action title supported by that content.

## Theme contract

| Component | Consumed custom properties | Default binding |
| --- | --- | --- |
| slide canvas | `--slide-bg`, `--slide-color`, `--slide-padding-inline`, `--slide-padding-block`, `--slide-column-gap` | `canvas`, `ink`, density margins, density grid gutter |
| action title | `--action-title-font`, `--action-title-color`, `--action-title-rule`, `--action-title-gap`, `--action-title-width` | action-title role, `ink`, page rule, density separator gap and title width |
| inherited description ledger | inherited `--description-slide-*` aliases for row gaps, rules, headings, labels, detail typography, density, and indicators | [`Description Slide`](description.md) bindings |
| extension grid | `--description-implication-columns` | named grid containing base description fields plus arrow and implication columns |
| inference arrow | reusable [`arrow`](../components/arrows.md) component | preferred `disc-chevron` variant |
| implication | `--description-implication-implication-bg`, `--description-implication-implication-subtle-bg`, `--description-implication-implication-color`, `--description-implication-implication-font`, `--description-implication-implication-padding` | transparent, `surface-1`, `ink`, callout role, `space-0` |
| row indicator | reusable [`item indicator`](../components/item-indicators.md) component | square or circle with `column` or `embedded-start` placement |
| source | `--source-font`, `--source-color`, `--source-rule`, `--source-gap` | source role, secondary text, quiet rule, `space-1` |

## Structural HTML reference

### Labeled findings to subtle implication

~~~html
<main class="deck" data-theme="executive-light" data-density="pre-read">
  <section class="slide" aria-label="Operating findings and their implications">
    <header class="action-title" data-lines="one">
      <h1>Five operating gaps constrain throughput, experience, and scalable performance</h1>
    </header>

    <section class="description-slide description-implication" data-variant="labeled-findings-to-implication" data-detail-columns="1" data-implication-treatment="subtle">
      <div class="description-slide__head description-implication__head" aria-hidden="true">
        <span>Area</span><span>Key early findings</span><span></span><span>Implication</span>
      </div>
      <article class="description-slide__row description-implication__row">
        <h2 class="description-slide__label description-implication__label">Operational efficiency</h2>
        <ul class="description-slide__body description-implication__body"><li>Processes vary by site.</li><li>Rework increases cycle time.</li><li>Simplification can remove avoidable steps.</li></ul>
        <svg class="arrow description-implication__arrow-slot" data-variant="disc-chevron" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="m25 17 15 15-15 15"/></svg>
        <p class="description-implication__implication">Cycle time and cost can fall together if the standard path removes repeated handoffs.</p>
      </article>
      <article class="description-slide__row description-implication__row">
        <h2 class="description-slide__label description-implication__label">Customer experience</h2>
        <ul class="description-slide__body description-implication__body"><li>Journeys fragment across touchpoints.</li><li>Status visibility is limited.</li><li>Repeat enquiries consume capacity.</li></ul>
        <svg class="arrow description-implication__arrow-slot" data-variant="disc-chevron" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="m25 17 15 15-15 15"/></svg>
        <p class="description-implication__implication">A connected journey should improve satisfaction while reducing avoidable service demand.</p>
      </article>
      <article class="description-slide__row description-implication__row">
        <h2 class="description-slide__label description-implication__label">Technology enablement</h2>
        <ul class="description-slide__body description-implication__body"><li>Applications remain siloed.</li><li>Data quality constrains insight.</li><li>End-to-end visibility is weak.</li></ul>
        <svg class="arrow description-implication__arrow-slot" data-variant="disc-chevron" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="m25 17 15 15-15 15"/></svg>
        <p class="description-implication__implication">Integration is a prerequisite for scalable control, reporting, and automation.</p>
      </article>
      <article class="description-slide__row description-implication__row">
        <h2 class="description-slide__label description-implication__label">People and organization</h2>
        <ul class="description-slide__body description-implication__body"><li>Decision rights are unclear.</li><li>Digital capability gaps remain.</li><li>Adoption ownership is diffuse.</li></ul>
        <svg class="arrow description-implication__arrow-slot" data-variant="disc-chevron" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="m25 17 15 15-15 15"/></svg>
        <p class="description-implication__implication">Clear accountability and targeted capability building are needed to sustain the change.</p>
      </article>
      <article class="description-slide__row description-implication__row">
        <h2 class="description-slide__label description-implication__label">Financial performance</h2>
        <ul class="description-slide__body description-implication__body"><li>Low-value activity carries high cost.</li><li>Measures are weakly tied to outcomes.</li><li>Tradeoffs are not visible.</li></ul>
        <svg class="arrow description-implication__arrow-slot" data-variant="disc-chevron" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="m25 17 15 15-15 15"/></svg>
        <p class="description-implication__implication">Outcome-linked measures can redirect resources toward margin and growth priorities.</p>
      </article>
    </section>

    <footer class="source-line">Source: Illustrative diagnostic structure</footer>
  </section>
</main>
~~~

### Numbered descriptions to open implications

~~~html
<main class="deck" data-theme="warm-editorial" data-density="executive">
  <section class="slide" aria-label="Five priorities and their implications">
    <header class="action-title" data-lines="one">
      <h1>Five design choices determine whether the new model scales beyond the pilot</h1>
    </header>

    <section class="description-slide description-implication" data-variant="numbered-description-to-implication" data-detail-columns="1" data-implication-treatment="open">
      <div class="description-slide__head description-implication__head" aria-hidden="true">
        <span></span><span>Description</span><span></span><span>Implication</span>
      </div>
      <article class="description-slide__row description-implication__row">
        <span class="item-indicator description-implication__indicator-slot" data-shape="square" data-placement="column">01</span>
        <p class="description-slide__body description-implication__body"><strong>Standardize the core.</strong> Define one default journey and a limited set of controlled exceptions.</p>
        <svg class="arrow description-implication__arrow-slot" data-variant="disc-chevron" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="m25 17 15 15-15 15"/></svg>
        <p class="description-implication__implication">Local teams can move faster without recreating the operating model in every market.</p>
      </article>
      <article class="description-slide__row description-implication__row">
        <span class="item-indicator description-implication__indicator-slot" data-shape="square" data-placement="column">02</span>
        <p class="description-slide__body description-implication__body"><strong>Make ownership explicit.</strong> Assign one accountable owner to each end-to-end outcome.</p>
        <svg class="arrow description-implication__arrow-slot" data-variant="disc-chevron" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="m25 17 15 15-15 15"/></svg>
        <p class="description-implication__implication">Decisions and escalations can be resolved at the level where customer value is created.</p>
      </article>
      <article class="description-slide__row description-implication__row">
        <span class="item-indicator description-implication__indicator-slot" data-shape="square" data-placement="column">03</span>
        <p class="description-slide__body description-implication__body"><strong>Instrument the journey.</strong> Capture status, demand, failure, and recovery at common control points.</p>
        <svg class="arrow description-implication__arrow-slot" data-variant="disc-chevron" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="m25 17 15 15-15 15"/></svg>
        <p class="description-implication__implication">Leaders gain one comparable view of performance and can target the causes of variation.</p>
      </article>
      <article class="description-slide__row description-implication__row">
        <span class="item-indicator description-implication__indicator-slot" data-shape="square" data-placement="column">04</span>
        <p class="description-slide__body description-implication__body"><strong>Automate selectively.</strong> Prioritize repetitive handoffs with stable rules and measurable volume.</p>
        <svg class="arrow description-implication__arrow-slot" data-variant="disc-chevron" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="m25 17 15 15-15 15"/></svg>
        <p class="description-implication__implication">Investment follows provable value while judgment-heavy exceptions remain visible to people.</p>
      </article>
      <article class="description-slide__row description-implication__row">
        <span class="item-indicator description-implication__indicator-slot" data-shape="square" data-placement="column">05</span>
        <p class="description-slide__body description-implication__body"><strong>Scale capability with rollout.</strong> Tie training and coaching to the sequence of market adoption.</p>
        <svg class="arrow description-implication__arrow-slot" data-variant="disc-chevron" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="m25 17 15 15-15 15"/></svg>
        <p class="description-implication__implication">Each market reaches operational readiness before it inherits the new tools and measures.</p>
      </article>
    </section>

    <footer class="source-line">Source: Illustrative operating-model structure</footer>
  </section>
</main>
~~~

### Embedded indicators to open implications

~~~html
<main class="deck" data-theme="executive-light" data-density="pre-read">
  <section class="slide" aria-label="Four lettered trends and their implications">
    <header class="action-title" data-lines="one">
      <h1>Four market shifts require distinct responses across the operating model</h1>
    </header>

    <section class="description-slide description-implication" data-variant="embedded-indicator-description-to-implication" data-detail-columns="2" data-content-density="dense" data-implication-treatment="open">
      <div class="description-slide__head description-implication__head" aria-hidden="true">
        <span>Trend</span><span>Signal</span><span>Context</span><span></span><span>Implication</span>
      </div>
      <article class="description-slide__row description-implication__row">
        <h2 class="description-slide__label description-implication__label" data-indicator-placement="embedded"><span class="item-indicator" data-shape="circle" data-placement="embedded-start" data-contrast="inverse-keyline">A</span><span>Instant service</span></h2>
        <p class="description-slide__body description-implication__body">Response expectations keep rising.</p><p class="description-slide__body description-implication__body">Manual handoffs expose delay.</p>
        <svg class="arrow description-implication__arrow-slot" data-variant="disc-chevron" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="m25 17 15 15-15 15"/></svg>
        <p class="description-implication__implication">Standard paths should remove avoidable waiting time.</p>
      </article>
      <article class="description-slide__row description-implication__row">
        <h2 class="description-slide__label description-implication__label" data-indicator-placement="embedded"><span class="item-indicator" data-shape="circle" data-placement="embedded-start" data-contrast="inverse-keyline">B</span><span>Connected journeys</span></h2>
        <p class="description-slide__body description-implication__body">Customers move between channels.</p><p class="description-slide__body description-implication__body">Context is repeatedly lost.</p>
        <svg class="arrow description-implication__arrow-slot" data-variant="disc-chevron" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="m25 17 15 15-15 15"/></svg>
        <p class="description-implication__implication">Shared identity becomes a service requirement.</p>
      </article>
      <article class="description-slide__row description-implication__row">
        <h2 class="description-slide__label description-implication__label" data-indicator-placement="embedded"><span class="item-indicator" data-shape="circle" data-placement="embedded-start" data-contrast="inverse-keyline">C</span><span>Relevant guidance</span></h2>
        <p class="description-slide__body description-implication__body">Generic outreach is ignored.</p><p class="description-slide__body description-implication__body">Trusted context improves relevance.</p>
        <svg class="arrow description-implication__arrow-slot" data-variant="disc-chevron" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="m25 17 15 15-15 15"/></svg>
        <p class="description-implication__implication">Data quality now constrains growth as well as control.</p>
      </article>
      <article class="description-slide__row description-implication__row">
        <h2 class="description-slide__label description-implication__label" data-indicator-placement="embedded"><span class="item-indicator" data-shape="circle" data-placement="embedded-start" data-contrast="inverse-keyline">D</span><span>Visible performance</span></h2>
        <p class="description-slide__body description-implication__body">Variation is hard to compare.</p><p class="description-slide__body description-implication__body">Measures differ by market.</p>
        <svg class="arrow description-implication__arrow-slot" data-variant="disc-chevron" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="m25 17 15 15-15 15"/></svg>
        <p class="description-implication__implication">Common measures are needed before leaders can target causes.</p>
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

.description-implication {
  --description-implication-gap: var(--description-slide-gap);
  --description-implication-row-gap: var(--description-slide-row-gap);
  --description-implication-row-rule: var(--description-slide-row-rule);
  --description-implication-row-padding: var(--description-slide-row-padding);
  --description-implication-columns: 2fr 5fr 1fr 4fr;
  --description-implication-heading-font: var(--description-slide-heading-font);
  --description-implication-heading-color: var(--description-slide-heading-color);
  --description-implication-heading-rule: var(--description-slide-heading-rule);
  --description-implication-heading-gap: var(--description-slide-heading-gap);
  --description-implication-label-bg: var(--description-slide-label-bg);
  --description-implication-label-color: var(--description-slide-label-color);
  --description-implication-label-font: var(--description-slide-label-font);
  --description-implication-label-padding: var(--description-slide-label-padding);
  --description-implication-label-embedded-padding: var(--description-slide-label-embedded-padding);
  --description-implication-body-font: var(--description-slide-body-font);
  --description-implication-body-color: var(--description-slide-body-color);
  --description-implication-body-gap: var(--description-slide-body-gap);
  --description-implication-list-indent: var(--description-slide-list-indent);
  --description-implication-implication-bg: transparent;
  --description-implication-implication-subtle-bg: var(--surface-1);
  --description-implication-implication-color: var(--ink);
  --description-implication-implication-font: var(--type-callout);
  --description-implication-implication-padding: var(--space-0);
  --description-implication-dense-font: var(--description-slide-dense-font);

  min-height: 0;
  display: grid;
  grid-template-rows: auto;
  grid-auto-rows: 1fr;
  gap: var(--description-implication-row-gap);
}

.description-implication[data-variant="numbered-description-to-implication"] {
  --description-implication-columns: 1fr 4fr 1fr 6fr;
}

.description-implication[data-variant="embedded-indicator-description-to-implication"] {
  --description-implication-columns: 3fr 2fr 2fr 1fr 4fr;
}

.description-implication[data-detail-columns="3"] {
  --description-implication-columns: 2fr 2fr 2fr 2fr 1fr 3fr;
}

.description-implication[data-content-density="dense"] {
  --description-implication-label-font: var(--description-implication-dense-font);
  --description-implication-body-font: var(--description-implication-dense-font);
  --description-implication-implication-font: var(--description-implication-dense-font);
}

.description-implication[data-implication-treatment="subtle"] {
  --description-implication-implication-bg: var(--description-implication-implication-subtle-bg);
  --description-implication-implication-padding: var(--space-4);
}

.description-implication__head,
.description-implication__row {
  display: grid;
  grid-template-columns: var(--description-implication-columns);
  gap: var(--description-implication-gap);
}

.description-implication__head span {
  padding-bottom: var(--description-implication-heading-gap);
  border-bottom: var(--description-implication-heading-rule);
  color: var(--description-implication-heading-color);
  font: var(--description-implication-heading-font);
}

.description-implication__head span:empty {
  border-bottom: 0;
}

.description-implication__row {
  min-height: 0;
  align-items: center;
  padding-block: var(--description-implication-row-padding);
  border-bottom: var(--description-implication-row-rule);
}

.description-implication__row:last-of-type { border-bottom: 0; }

.description-implication__label {
  align-self: stretch;
  margin: 0;
  display: flex;
  align-items: center;
  padding: var(--description-implication-label-padding);
  background: var(--description-implication-label-bg);
  color: var(--description-implication-label-color);
  font: var(--description-implication-label-font);
}

.description-implication__label[data-indicator-placement="embedded"] {
  position: relative;
  padding-inline-start: var(--description-implication-label-embedded-padding);
}

.description-implication__body {
  margin: 0;
  color: var(--description-implication-body-color);
  font: var(--description-implication-body-font);
}

ul.description-implication__body {
  display: grid;
  gap: var(--description-implication-body-gap);
  padding-inline-start: var(--description-implication-list-indent);
}

.description-implication__arrow-slot {
  justify-self: center;
}

.description-implication__implication {
  margin: 0;
  padding: var(--description-implication-implication-padding);
  background: var(--description-implication-implication-bg);
  color: var(--description-implication-implication-color);
  font: var(--description-implication-implication-font);
}

.description-implication__indicator-slot { place-self: center; }

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

- `labeled-findings-to-implication` preserves a named diagnostic area plus a compact finding cluster before the arrow.
- `numbered-description-to-implication` uses the index as navigation and gives the description more narrative space.
- `embedded-indicator-description-to-implication` uses a circular number or letter on the leading edge of the label field, followed by one or more aligned detail fields. Its default specimen uses `inverse-keyline`, producing a slight on-inverse border against the label field.
- `data-detail-columns` declares how many description detail fields precede the arrow. For three or more fields, resolve a readable grid before authoring copy.
- `data-content-density="dense"` normalizes label, body, and implication typography to the dense component role. Column headings remain bold at the same size and line height as the body, and `.action-title` never changes.
- `open` is the default implication treatment: transparent background and callout typography.
- `subtle` is permitted only for a true implication and binds to `surface-1`. It may not bind to the action tint or a saturated fill.
- The arrow is mandatory in both constructions because it carries the row's logical transition. Use the reusable `arrow` component and its preferred `disc-chevron` variant for repeated rows. The `line` variant is a compact fallback only when the resolved row geometry cannot support the disc without crowding.
- Empty index and arrow header cells have no rule. Only labeled heading cells receive the heading underline.
- Internal rows use the quiet divider. The final row has no bottom divider because the footer or slide guide closes the exhibit.
- Every row inherits one vertical centerline from Description Slide. Description blocks, arrows, implications, labels, and indicators align to it even when their line counts differ.

No shared semantic state is demonstrated. Add `data-state` only when the row has a defined threshold and non-colour cue.

## Native translation

Translate each row into one editable native group on the resolved 12-column grid. Keep labels or indicators, all description details, arrows, and implications on stable guides. Align every content block to one row-center axis, treating multi-line description and implication copy as complete blocks rather than top-aligned text. Center dedicated indicators horizontally in their column and vertically in their row. Center embedded indicators on the leading label boundary so they jut out without clipping. Build the preferred implication arrow as an editable filled circle with one centered on-primary chevron; preserve one size and axis across the rows. Materialize `open` as no shape fill and `subtle` as the resolved quiet neutral surface. Do not flatten the ledger to an image.

## Acceptance check

- Exactly one Description with Implication Slide is declared and it inherits the Description Slide root and row roles.
- Every row makes one description-to-implication inference.
- Every arrow can be read as “therefore” and shares one geometry.
- Every label, description block, arrow, implication, and indicator is vertically centered on the row's shared centerline.
- Dedicated indicator markers are centered in both axes; embedded markers overlap the label edge consistently and remain distinct from its fill.
- Dense mode changes only internal ledger typography and leaves the action title unchanged.
- The final row divider is absent, leaving one unambiguous footer or slide guide below the component.
- Open implications have no background.
- Subtle implications use only `surface-1`; neither treatment uses `surface-action` or `component-primary-tint`.
- Changing only `data-theme` or `data-density` preserves structure and meaning.
- All copy, sources, arrows, and fields remain editable in the native slide artifact.
