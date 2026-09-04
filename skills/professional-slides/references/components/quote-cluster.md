# Quote Cluster

The quote cluster presents one to five sourced statements as qualitative evidence. It is a component, not a page layout. Give the quote cluster one explicit content job, then place it in the smallest row, column, grid, or section composition that preserves that relationship.

Use a quote only when the speaker's language proves, qualifies, or humanizes the page-level claim. A quote does not become stronger evidence because it is larger, boxed, or repeated.

## Count and placement router

Count and placement are separate decisions. `data-variant` selects the internal quote count. `data-placement` declares whether the cluster is the dominant content item or sits inside one section of a broader slide.

| Variant | Use when | Default full-field geometry | Section use |
| --- | --- | --- | --- |
| `one-up` | one statement carries the qualitative proof | one focused statement on a centered internal measure | allowed in any compatible composition |
| `two-up` | two peer voices corroborate or contrast one point | two equal columns | allowed side by side in a wide region or stacked in a half-width region |
| `three-up` | three genuinely co-equal voices establish a pattern | three equal columns | allowed only in a dominant region with short quotes |
| `four-up` | four compact peer statements must be scanned as a set | balanced two-by-two field | full field only |
| `five-up` | five very short voices add necessary breadth in a pre-read | balanced three-plus-two field | full field only |

Use `one-up` or `two-up` for live delivery. `three-up` and `four-up` suit executive or pre-read evidence. Use `five-up` only when every voice adds a distinct necessary clause and the rendered text remains readable. More than five quotes belong across multiple slides, in an appendix, or in a separate evidence document.

Within a section, the cluster inherits the parent region's width and position. It never creates another page title, source zone, footer, tracker, or miniature slide frame. The parent [slide layout](../design/slide-layouts.md) owns the section allocation and external gap.

## Evidence and copy contract

- Use exact, attributable source language. Never invent a quote, speaker, title, organization, or sentiment.
- Keep the speaker's meaning intact. If a quote is shortened or stitched from non-contiguous passages, disclose the edit and retain a traceable source.
- A paraphrase is not a quote. Remove the quotation mark and present it as ordinary evidence or interpretation.
- Follow the canonical [copy punctuation gate](copy.md#punctuation). A source passage containing prohibited punctuation is ineligible as a displayed quote. Use another exact excerpt or a faithful attributed paraphrase without quotation marks. Preserve the original in the source record; never edit a quotation.
- Attribute every quote. Show the speaker name, then role and organization when known and permitted. Use an approved anonymized identity such as `Operations leader, European retailer` when confidentiality requires it.
- Keep quote items at one evidentiary level. If one statement is the conclusion and others only support it, use one `one-up` quote plus separate evidence rather than a false peer grid.
- Use one page-level source treatment. `data-source-id` may connect individual statements to numbered source entries, but each quote item does not receive a duplicate source block.

Starting line budgets per quote body, excluding attribution, are three to seven for `one-up`, three to six for `two-up`, three to five for `three-up`, two to four for `four-up`, and two to three for `five-up`. These are capacity guides, not permission to shrink text. If the render exceeds them, shorten with source approval, reduce the count, enlarge the valid region, or split the slide.

## Styling principles

- Every treatment uses one restrained opening mark and one closing mark, with the closing mark aligned to the lower right of its quote body.
- Keep the closing mark visually attached to the statement and attribution. Do not push the name to the bottom of the available field.
- When the quotes do not need the full content height, vertically center the complete quote cluster rather than stretching every item to fill the page.
- Keep peer items equal in width, internal padding, mark size, text role, closing-mark position, and attribution spacing.
- Select one enclosed treatment for the quote family: `callout` or `contained`. Do not use the line-only treatment. Count and placement remain independent axes.
- Use one small attribution caret only in the `callout` treatment. It points from the enclosed quote body to the speaker attribution immediately below.
- Center the speaker name and title by default. `data-attribution-align="left"` left-aligns both lines; in the callout treatment, shift and angle the caret toward that leading attribution block.
- `data-avatar="true"` may add one circular photo crop to the left of the name and title. Use a photo admitted by the [asset authorization record](icons-and-logos.md#asset-authorization-record) or an explicit placeholder, and omit the circle when no image is available.
- Do not surround a four- or five-quote field with repeated heavy boxes unless the selected treatment genuinely improves grouping and the text remains readable.
- Preserve the action title as the first read. A single quote may be large, but it must not imitate a second title.
- Order peer quotes by the analytical logic named in the page title, not by the visual length of the statements.

## Theme contract

The component consumes `--quote-cluster-columns`, `--quote-cluster-gap`, `--quote-item-gap`, `--quote-mark-gap`, `--quote-item-padding-x`, `--quote-item-padding-y`, `--quote-item-bg`, `--quote-item-color`, `--quote-item-border`, `--quote-item-radius`, `--quote-item-shadow`, `--quote-mark-font`, `--quote-mark-color`, `--quote-body-bg`, `--quote-body-border`, `--quote-body-radius`, `--quote-body-padding-x`, `--quote-body-padding-y`, `--quote-caret-size`, `--quote-caret-inline-position`, `--quote-caret-angle`, `--quote-text-font`, `--quote-text-color`, `--quote-attribution-gap`, `--quote-attribution-font`, `--quote-attribution-color`, `--quote-detail-font`, `--quote-detail-color`, `--quote-attribution-inline-offset`, `--quote-avatar-size`, `--quote-avatar-gap`, `--quote-avatar-bg`, `--quote-avatar-border`, and `--quote-avatar-radius`. [Component bindings](../theming/component-bindings.md#evidence-components) owns every default.

## Structural HTML reference

### One quote as the dominant content item

```html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide" aria-label="Single quote evidence example">
    <header class="action-title"><h1>One customer statement makes the operational benefit tangible</h1></header>
    <div class="slide-layout" data-layout="full-field">
      <section class="layout-region" data-slot="evidence">
        <div class="quote-cluster" data-variant="one-up" data-placement="full-field" data-treatment="contained">
          <figure class="quote-cluster__item" data-source-id="1">
            <blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>[verbatim excerpt; source 1]</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote>
            <figcaption>[speaker, role, organization]</figcaption>
          </figure>
        </div>
      </section>
    </div>
    <footer class="source-line">Source: 1. Interview or transcript reference</footer>
  </section>
</main>
```

### Two quotes embedded in one section with a callout treatment

```html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide" aria-label="Sectional quote evidence example">
    <header class="action-title"><h1>Usage data and customer language point to the same adoption barrier</h1></header>
    <div class="slide-layout" data-layout="soft-split-50-50">
      <section class="layout-region" data-slot="primary"><div class="layout-content">Primary chart or analysis</div></section>
      <section class="layout-region" data-slot="secondary">
        <h2>Customer evidence</h2>
        <div class="quote-cluster" data-variant="two-up" data-placement="section" data-treatment="callout">
          <figure class="quote-cluster__item" data-source-id="1">
            <blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>[verbatim excerpt; source 1]</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote>
            <figcaption>[speaker, role, organization]</figcaption>
          </figure>
          <figure class="quote-cluster__item" data-source-id="2">
            <blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>[verbatim excerpt; source 2]</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote>
            <figcaption>[speaker, role, organization]</figcaption>
          </figure>
        </div>
      </section>
    </div>
    <footer class="source-line">Source: 1. Interview reference; 2. Interview reference</footer>
  </section>
</main>
```

### Three peer quotes with contained attribution

```html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide" aria-label="Three quote evidence example">
    <header class="action-title"><h1>Three customer segments describe the same unmet need</h1></header>
    <div class="slide-layout" data-layout="full-field">
      <section class="layout-region" data-slot="evidence">
        <div class="quote-cluster" data-variant="three-up" data-placement="full-field" data-treatment="contained" data-attribution-align="left">
          <figure class="quote-cluster__item" data-source-id="1"><blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>[verbatim excerpt; source 1]</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote><figcaption>[speaker, role, organization]</figcaption></figure>
          <figure class="quote-cluster__item" data-source-id="2"><blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>[verbatim excerpt; source 2]</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote><figcaption>[speaker, role, organization]</figcaption></figure>
          <figure class="quote-cluster__item" data-source-id="3"><blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>[verbatim excerpt; source 3]</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote><figcaption>[speaker, role, organization]</figcaption></figure>
        </div>
      </section>
    </div>
    <footer class="source-line">Source: numbered interview or transcript references</footer>
  </section>
</main>
```

### Four peer quotes

```html
<main class="deck" data-theme="executive-light" data-density="pre-read">
  <section class="slide" aria-label="Four quote evidence example">
    <header class="action-title"><h1>Four customer voices corroborate the workflow constraint</h1></header>
    <div class="slide-layout" data-layout="full-field">
      <section class="layout-region" data-slot="evidence">
        <div class="quote-cluster" data-variant="four-up" data-placement="full-field" data-treatment="callout" data-attribution-align="left">
          <figure class="quote-cluster__item" data-source-id="1"><blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>[verbatim excerpt; source 1]</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote><figcaption>[speaker, role, organization]</figcaption></figure>
          <figure class="quote-cluster__item" data-source-id="2"><blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>[verbatim excerpt; source 2]</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote><figcaption>[speaker, role, organization]</figcaption></figure>
          <figure class="quote-cluster__item" data-source-id="3"><blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>[verbatim excerpt; source 3]</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote><figcaption>[speaker, role, organization]</figcaption></figure>
          <figure class="quote-cluster__item" data-source-id="4"><blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>[verbatim excerpt; source 4]</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote><figcaption>[speaker, role, organization]</figcaption></figure>
        </div>
      </section>
    </div>
    <footer class="source-line">Source: numbered interview or transcript references</footer>
  </section>
</main>
```

### Five peer quotes

```html
<main class="deck" data-theme="executive-light" data-density="pre-read">
  <section class="slide" aria-label="Five quote evidence example">
    <header class="action-title"><h1>Feedback is consistent across five roles in the buying group</h1></header>
    <div class="slide-layout" data-layout="full-field">
      <section class="layout-region" data-slot="evidence">
        <div class="quote-cluster" data-variant="five-up" data-placement="full-field" data-treatment="contained" data-attribution-align="left">
          <figure class="quote-cluster__item" data-source-id="1"><blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>[verbatim excerpt; source 1]</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote><figcaption>[speaker, role, organization]</figcaption></figure>
          <figure class="quote-cluster__item" data-source-id="2"><blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>[verbatim excerpt; source 2]</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote><figcaption>[speaker, role, organization]</figcaption></figure>
          <figure class="quote-cluster__item" data-source-id="3"><blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>[verbatim excerpt; source 3]</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote><figcaption>[speaker, role, organization]</figcaption></figure>
          <figure class="quote-cluster__item" data-source-id="4"><blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>[verbatim excerpt; source 4]</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote><figcaption>[speaker, role, organization]</figcaption></figure>
          <figure class="quote-cluster__item" data-source-id="5"><blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>[verbatim excerpt; source 5]</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote><figcaption>[speaker, role, organization]</figcaption></figure>
        </div>
      </section>
    </div>
    <footer class="source-line">Source: numbered interview or transcript references</footer>
  </section>
</main>
```

```css
.quote-cluster {
  --quote-cluster-columns: 1fr;
  --quote-cluster-gap: var(--grid-gutter);
  --quote-item-gap: var(--space-2);
  --quote-mark-gap: var(--space-1);
  --quote-item-padding-x: var(--space-0);
  --quote-item-padding-y: var(--space-0);
  --quote-item-bg: transparent;
  --quote-item-color: var(--ink);
  --quote-item-border: 0;
  --quote-item-radius: var(--component-radius);
  --quote-item-shadow: var(--component-shadow);
  --quote-mark-font: var(--type-section-title);
  --quote-mark-color: var(--component-primary);
  --quote-body-bg: var(--surface-1);
  --quote-body-border: var(--rule-quiet);
  --quote-body-radius: var(--component-radius);
  --quote-body-padding-x: var(--space-4);
  --quote-body-padding-y: var(--space-3);
  --quote-caret-size: var(--space-3);
  --quote-caret-inline-position: 50%;
  --quote-caret-angle: 45deg;
  --quote-text-font: var(--type-body);
  --quote-text-color: var(--ink);
  --quote-attribution-gap: var(--space-1);
  --quote-attribution-font: var(--type-label);
  --quote-attribution-color: var(--ink);
  --quote-detail-font: var(--type-source);
  --quote-detail-color: var(--text-secondary);
  --quote-attribution-inline-offset: var(--space-4);
  --quote-avatar-size: var(--icon-lg);
  --quote-avatar-gap: var(--space-2);
  --quote-avatar-bg: var(--surface-2);
  --quote-avatar-border: var(--rule-quiet);
  --quote-avatar-radius: var(--radius-round);

  display: grid;
  grid-template-columns: var(--quote-cluster-columns);
  grid-auto-rows: max-content;
  align-content: center;
  gap: var(--quote-cluster-gap);
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.quote-cluster__item {
  display: grid;
  align-content: start;
  gap: var(--quote-item-gap);
  min-width: 0;
  margin: 0;
  padding: var(--quote-item-padding-y) var(--quote-item-padding-x);
  border: var(--quote-item-border);
  border-radius: var(--quote-item-radius);
  background: var(--quote-item-bg);
  box-shadow: var(--quote-item-shadow);
  color: var(--quote-item-color);
}

.quote-cluster blockquote {
  display: grid;
  position: relative;
  gap: var(--quote-mark-gap);
  margin: 0;
  padding: var(--quote-body-padding-y) var(--quote-body-padding-x);
  border: var(--quote-body-border);
  border-radius: var(--quote-body-radius);
  background: var(--quote-body-bg);
}

.quote-cluster__mark {
  color: var(--quote-mark-color);
  font: var(--quote-mark-font);
  line-height: 1;
}

.quote-cluster__mark--close {
  justify-self: end;
}

.quote-cluster blockquote p {
  margin: 0;
  color: var(--quote-text-color);
  font: var(--quote-text-font);
}

.quote-cluster figcaption {
  display: grid;
  gap: var(--quote-attribution-gap);
  justify-content: center;
  justify-items: center;
  text-align: center;
}

.quote-cluster__attribution {
  display: grid;
  gap: var(--quote-attribution-gap);
}

.quote-cluster__avatar {
  display: none;
  width: var(--quote-avatar-size);
  height: var(--quote-avatar-size);
  overflow: hidden;
  border: var(--quote-avatar-border);
  border-radius: var(--quote-avatar-radius);
  background: var(--quote-avatar-bg);
  object-fit: cover;
}

.quote-cluster figcaption strong {
  color: var(--quote-attribution-color);
  font: var(--quote-attribution-font);
}

.quote-cluster figcaption span {
  color: var(--quote-detail-color);
  font: var(--quote-detail-font);
}

.quote-cluster[data-attribution-align="left"] {
  --quote-caret-inline-position: calc(var(--quote-body-padding-x) + var(--quote-caret-size));
  --quote-caret-angle: 38deg;
}

.quote-cluster[data-attribution-align="left"] figcaption {
  justify-content: start;
  justify-items: start;
  padding-inline-start: var(--quote-attribution-inline-offset);
  text-align: left;
}

.quote-cluster[data-avatar="true"] figcaption {
  grid-template-columns: var(--quote-avatar-size) minmax(0, 1fr);
  align-items: center;
  column-gap: var(--quote-avatar-gap);
}

.quote-cluster[data-avatar="true"] .quote-cluster__avatar {
  display: block;
}

.quote-cluster[data-variant="one-up"] {
  --quote-cluster-columns: 1fr 10fr 1fr;
  --quote-text-font: var(--type-section-title);
  --quote-mark-font: var(--type-cover-title);
}

.quote-cluster[data-variant="one-up"] > .quote-cluster__item {
  grid-column: 2;
}

.quote-cluster[data-variant="two-up"] {
  --quote-cluster-columns: repeat(2, minmax(0, 1fr));
  --quote-text-font: var(--type-callout);
}

.quote-cluster[data-variant="three-up"] {
  --quote-cluster-columns: repeat(3, minmax(0, 1fr));
}

.quote-cluster[data-variant="four-up"] {
  --quote-cluster-columns: repeat(2, minmax(0, 1fr));
  --quote-text-font: var(--type-body-compact);
}

.quote-cluster[data-variant="five-up"] {
  --quote-cluster-columns: repeat(6, minmax(0, 1fr));
  --quote-text-font: var(--type-body-compact);
}

.quote-cluster[data-variant="five-up"] > .quote-cluster__item {
  grid-column: span 2;
}

.quote-cluster[data-variant="five-up"] > .quote-cluster__item:nth-child(4) {
  grid-column: 2 / span 2;
}

.quote-cluster[data-variant="five-up"] > .quote-cluster__item:nth-child(5) {
  grid-column: 4 / span 2;
}

.quote-cluster[data-placement="section"] {
  --quote-cluster-columns: 1fr;
  --quote-cluster-gap: var(--space-4);
  --quote-text-font: var(--type-body-compact);
  --quote-mark-font: var(--type-section-heading);
}

.quote-cluster[data-placement="section"][data-variant="one-up"] > .quote-cluster__item {
  grid-column: 1;
}

.quote-cluster[data-treatment="callout"] {
  --quote-item-gap: var(--space-4);
  --quote-body-radius: var(--radius-2);
}

.quote-cluster[data-treatment="callout"] blockquote::after {
  content: "";
  position: absolute;
  left: var(--quote-caret-inline-position);
  bottom: calc(var(--quote-caret-size) / -2);
  width: var(--quote-caret-size);
  height: var(--quote-caret-size);
  border-right: var(--quote-body-border);
  border-bottom: var(--quote-body-border);
  background: var(--quote-body-bg);
  transform: translateX(-50%) rotate(var(--quote-caret-angle));
}

.quote-cluster[data-treatment="contained"] {
  --quote-item-padding-x: var(--space-4);
  --quote-item-padding-y: var(--space-4);
  --quote-item-bg: var(--surface-1);
  --quote-item-border: var(--rule-quiet);
  --quote-item-radius: var(--radius-3);
}

.quote-cluster[data-treatment="contained"] blockquote {
  --quote-body-bg: transparent;
  --quote-body-border: 0;
  --quote-body-padding-x: var(--space-0);
  --quote-body-padding-y: var(--space-0);
}
```

## Variants and states

Count and placement use the router above. In `section` mode, items stack unless a wide eight- to ten-column parent section preserves the full-field grid readably. All other variant behavior is defined in the [styling principles](#styling-principles).

## Native translation

- Build the cluster as one editable group and each quote item as a nested editable group.
- Create both quotation marks as editable text, not icons, images, or raster assets. Anchor the closing mark to the lower right of the quote body.
- Resolve the count grid inside the parent region after subtracting registered gaps. For `five-up`, use six equal internal tracks: each item spans two tracks and the last two occupy tracks two through three and four through five.
- Keep statement and attribution text in separate native text boxes, but group them with a compact registered gap. Never bottom-align the attribution to the full parent field.
- Translate the callout treatment to an editable enclosed quote body plus one editable caret pointing to the attribution below. For left alignment, move the caret toward the leading edge and angle it toward the attribution block. Translate the contained treatment to one rounded editable enclosure that includes the attribution.
- When an avatar is enabled, use one circular crop mask to the left of the name and title. Keep the image replaceable and preserve its original aspect ratio. Omit the avatar group entirely when the photo is absent from the [asset authorization record](icons-and-logos.md#asset-authorization-record).
- When the statements are short, vertically center the complete cluster in its allocated region rather than distributing or stretching its items to fill the region.
- Keep the page title, shared source, footer, and navigation outside the quote-cluster group.

## Acceptance check

- Every displayed statement is traceable to a real source and every speaker identity is accurate or explicitly anonymized.
- The count variant matches the actual number of quote items.
- Every item has a restrained opening mark and a closing mark at the lower right of its quote body.
- All peer items share geometry, type roles, padding, mark placement, and compact attribution spacing.
- The attribution follows the closing mark without auto margins or an artificial blank vertical field.
- A short cluster is vertically centered inside its allocated region.
- A sectional cluster remains subordinate to the page title and dominant exhibit.
- No quote is clipped, autofitted, or locally reduced below the registered role.
- The selected treatment is consistent across peers: enclosed body with one attribution caret, or rounded enclosure containing the attribution. No line-only quote treatment remains.
- The attribution is centered or left-aligned consistently across the cluster. A left-aligned callout shifts and angles its caret toward the attribution.
- An enabled avatar is a circular photo from the [asset authorization record](icons-and-logos.md#asset-authorization-record), or an explicit placeholder, to the left of the name and title; missing photos do not leave empty circles.
- The final render contains no arbitrary speech tails, oversized marks, decorative portraits, or repeated heavy boxes unless an approved reference explicitly requires them.
- Hiding any quote removes a necessary evidentiary clause. If not, delete it.
- Every displayed quote passes the canonical [copy punctuation gate](copy.md#punctuation).
