# Quote Cluster

The quote cluster presents one to five sourced statements as qualitative evidence. It is a component, not a page layout. Give it one explicit content job, then place it in the smallest row, column, grid, or section composition that preserves that relationship. Use the executable `quote-cluster` registry owner rather than drawing quote cards directly on a slide.

Use a quote only when the speaker's language proves, qualifies, or humanizes the page-level claim. A quote does not become stronger evidence because it is larger, boxed, or repeated.

## Count and placement router

Count, placement, treatment, arrangement, and attribution placement are separate inputs. `data-variant` selects the internal quote count. `data-placement` declares whether the cluster is dominant or sectional. `data-treatment` selects `contained`, `callout`, or `speech-bubble`. `data-arrangement="staggered"` recreates the original three-voice diagonal composition; all other combinations use a grid. `data-attribution-placement` selects `inside`, `below-center`, or `below-left` within the compatible treatment.

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
- Follow the canonical [copy punctuation gate](copy.md#punctuation). A source passage containing an em dash is ineligible as a displayed quote. Use another exact excerpt or a faithful attributed paraphrase without quotation marks. Preserve the original in the source record; never edit a quotation.
- Attribute every quote. Show the speaker name, then role and organization when known and permitted. Use an approved anonymized identity such as `Operations leader, European retailer` when confidentiality requires it.
- Keep quote items at one evidentiary level. If one statement is the conclusion and others only support it, use one `one-up` quote plus separate evidence rather than a false peer grid.
- Use one page-level source treatment. `data-source-id` may connect individual statements to numbered source entries, but each quote item does not receive a duplicate source block.

Starting budgets, measured as rendered lines at the registered quote text role and excluding attribution, are three to seven for `one-up`, three to six for `two-up`, three to five for `three-up`, two to four for `four-up`, and two to three for `five-up`. These are capacity guides, not permission to shrink text. If the render exceeds them, shorten with source approval, reduce the count, enlarge the valid region, or split the slide.

## Styling principles

- A dominant one-up quote uses the section-title text role, the hero quotation-mark role, and a centered internal measure up to `980px` wide and `440px` high. Its quote body begins below the opening quotation mark rather than sharing the mark's top line. Two-up uses heading-sized quote text. Denser counts step down through the body roles rather than shrinking locally.
- Contained and callout treatments use one prominent opening mark and one matching closing mark, with the closing mark aligned to the lower right of its quote body.
- The original speech-bubble treatment uses one opening mark, a clipped lower-right corner as its pointer, and a bold left-aligned attribution inside the enclosure. Reserve the snipped corner's width so the caption never crosses the diagonal. It does not add a second tail or a closing mark.
- Keep each mark visually attached to its statement and attribution. Do not push the name to the bottom of the available field.
- When the quotes do not need the full content height, vertically center the complete quote cluster rather than stretching every item to fill the page.
- Keep peer items equal in width, internal padding, mark size, text role, closing-mark position, and attribution spacing.
- Preserve the treatment and placement selected in the [router](#count-and-placement-router) across the quote family.
- Use one integrated attribution pointer only in the `callout` treatment. The editable callout outline includes the pointer, so the bottom rule stops at the pointer opening and never crosses behind it.
- Apply the router's attribution placement. For `below-left`, align the complete attribution block to the box's leading content guide while the pointer aims into that block.
- Standard contained attribution defaults to right alignment; speech-bubble attribution defaults to left alignment. Do not independently align an outside attribution away from its caret.
- `data-avatar="true"` places the circular profile, name, and subtitle together in a left-aligned row beneath the quote enclosure. Reserve space for this complete row inside each item's allocation. Use a photo admitted by the [asset authorization record](icons-and-logos.md#asset-authorization-record) or an explicit placeholder, and omit the circle when no image is available.
- Avoid repeated heavy boxes when the selected treatment does not improve grouping.
- Preserve the action title as the first read. A single quote may be large, but it must not imitate a second title.
- Order peer quotes by the analytical logic named in the page title, not by the visual length of the statements.

## Theme contract

The component consumes `--quote-cluster-columns`, `--quote-cluster-gap`, `--quote-stagger-inline-offset`, `--quote-stagger-block-gap`, `--quote-item-gap`, `--quote-mark-gap`, `--quote-item-padding-x`, `--quote-item-padding-y`, `--quote-item-bg`, `--quote-item-color`, `--quote-item-border`, `--quote-item-radius`, `--quote-item-shadow`, `--quote-mark-font`, `--quote-mark-color`, `--quote-body-bg`, `--quote-body-border`, `--quote-body-radius`, `--quote-body-padding-x`, `--quote-body-padding-y`, `--quote-caret-size`, `--quote-caret-inline-position`, `--quote-caret-angle`, `--quote-snip-size`, `--quote-text-font`, `--quote-text-color`, `--quote-attribution-gap`, `--quote-attribution-font`, `--quote-attribution-color`, `--quote-detail-font`, `--quote-detail-color`, `--quote-attribution-inline-offset`, `--quote-avatar-size`, `--quote-avatar-gap`, `--quote-avatar-bg`, `--quote-avatar-border`, and `--quote-avatar-radius`. [Component bindings](../theming/component-bindings.md#evidence-components) owns every default.

## Structural HTML reference

### One quote as the dominant content item

```html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide" aria-label="Single quote evidence example">
    <header class="action-title"><h1>One customer statement makes the operational benefit tangible</h1></header>
    <div class="slide-layout" data-layout="full-field">
      <section class="layout-region" data-slot="evidence">
        <div class="quote-cluster" data-variant="one-up" data-placement="full-field" data-treatment="contained" data-attribution-placement="inside">
          <figure class="quote-cluster__item" data-source-id="1">
            <blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>(Insert approved verbatim excerpt from source 1)</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote>
            <figcaption>(Insert speaker, role, and organization)</figcaption>
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
        <div class="quote-cluster" data-variant="two-up" data-placement="section" data-treatment="callout" data-attribution-placement="below-center">
          <figure class="quote-cluster__item" data-source-id="1">
            <blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>(Insert approved verbatim excerpt from source 1)</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote>
            <figcaption>(Insert speaker, role, and organization)</figcaption>
          </figure>
          <figure class="quote-cluster__item" data-source-id="2">
            <blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>(Insert approved verbatim excerpt from source 2)</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote>
            <figcaption>(Insert speaker, role, and organization)</figcaption>
          </figure>
        </div>
      </section>
    </div>
    <footer class="source-line">Source: 1. Interview reference; 2. Interview reference</footer>
  </section>
</main>
```

### Callout attribution placement variants

Use `below-center` when the voice is the natural centered caption to one quote box. Use `below-left` when the source identity should begin at the box's far-left content guide. Both variants keep the speaker name and title outside the box and use one integrated editable callout outline that points to the attribution.

```html
<div class="quote-cluster" data-variant="one-up" data-placement="full-field" data-treatment="callout" data-attribution-placement="below-left">
  <figure class="quote-cluster__item" data-source-id="1">
    <blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>(Insert approved verbatim excerpt from source 1)</p><span class="quote-cluster__mark quote-cluster__mark--close" aria-hidden="true">”</span></blockquote>
    <figcaption><strong>(Insert speaker name)</strong><span>(Insert speaker title and organization)</span></figcaption>
  </figure>
</div>
```

### Three to five peer quotes

Reuse the quote item shown in the two-up specimen once per source, assign consecutive `data-source-id` values, and select `data-variant="three-up"`, `four-up`, or `five-up`. Prefer the contained treatment for a calm evidence grid and the callout treatment only when attribution pointers materially improve the reading order. Default three-up to the registered `executive` profile and four-up or five-up to `pre-read`; otherwise enlarge the region, reduce the count, or split the slide.

The parent title must state the cross-quote pattern, such as `Three customer segments describe the same unmet need`; it must not merely announce the number of quotations. Keep one shared source line with the numbered interview or transcript references.

### Three original speech bubbles

Use this only when the source design calls for the original staggered quote language. The clipped lower-right corner provides the speech cue, so do not add an external caret, closing mark, or decorative connector.

```html
<div class="quote-cluster" data-variant="three-up" data-placement="full-field" data-treatment="speech-bubble" data-arrangement="staggered" data-attribution-align="left">
  <figure class="quote-cluster__item"><blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>(Insert approved verbatim excerpt from source 1)</p></blockquote><figcaption>(Insert speaker, role, and organization)</figcaption></figure>
  <figure class="quote-cluster__item"><blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>(Insert approved verbatim excerpt from source 2)</p></blockquote><figcaption>(Insert speaker, role, and organization)</figcaption></figure>
  <figure class="quote-cluster__item"><blockquote><span class="quote-cluster__mark quote-cluster__mark--open" aria-hidden="true">“</span><p>(Insert approved verbatim excerpt from source 3)</p></blockquote><figcaption>(Insert speaker, role, and organization)</figcaption></figure>
</div>
```

```css
.quote-cluster {
  --quote-cluster-columns: 1fr;
  --quote-cluster-gap: var(--grid-gutter);
  --quote-stagger-inline-offset: var(--space-8);
  --quote-stagger-block-gap: var(--space-4);
  --quote-item-gap: var(--space-2);
  --quote-mark-gap: var(--space-1);
  --quote-item-padding-x: var(--space-0);
  --quote-item-padding-y: var(--space-0);
  --quote-item-bg: transparent;
  --quote-item-color: var(--ink);
  --quote-item-border: 0;
  --quote-item-radius: var(--component-radius);
  --quote-item-shadow: var(--component-shadow);
  --quote-mark-font: var(--type-quote-mark);
  --quote-mark-color: var(--component-primary);
  --quote-body-bg: var(--surface-1);
  --quote-body-border: var(--rule-quiet);
  --quote-body-radius: var(--component-radius);
  --quote-body-padding-x: var(--space-4);
  --quote-body-padding-y: var(--space-3);
  --quote-caret-size: var(--space-3);
  --quote-caret-inline-position: 50%;
  --quote-caret-angle: 45deg;
  --quote-snip-size: var(--space-5);
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

.quote-cluster[data-attribution-placement="below-left"] {
  --quote-caret-inline-position: calc(var(--quote-body-padding-x) + var(--quote-caret-size));
  --quote-caret-angle: 38deg;
}

.quote-cluster[data-attribution-placement="below-left"] figcaption {
  justify-content: start;
  justify-items: start;
  padding-inline-start: var(--quote-attribution-inline-offset);
  text-align: left;
}

.quote-cluster[data-avatar="true"] figcaption {
  grid-template-columns: var(--quote-avatar-size) minmax(0, 1fr);
  align-items: center;
  column-gap: var(--quote-avatar-gap);
  justify-content: start;
  justify-items: start;
  text-align: left;
}

.quote-cluster[data-avatar="true"] .quote-cluster__avatar {
  display: block;
}

.quote-cluster[data-variant="one-up"] {
  --quote-cluster-columns: 1fr 10fr 1fr;
  --quote-text-font: var(--type-section-title);
  --quote-mark-font: var(--type-quote-mark-hero);
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

.quote-cluster[data-treatment="speech-bubble"] .quote-cluster__item {
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - var(--quote-snip-size)), calc(100% - var(--quote-snip-size)) 100%, 0 100%);
  border: var(--quote-body-border);
  background: var(--quote-body-bg);
}

.quote-cluster[data-treatment="speech-bubble"] figcaption {
  justify-content: start;
  justify-items: start;
  padding-inline-end: var(--quote-snip-size);
  text-align: left;
}

.quote-cluster[data-treatment="contained"]:not([data-avatar="true"]) figcaption {
  justify-content: end;
  justify-items: end;
  text-align: right;
}

.quote-cluster[data-treatment="contained"][data-avatar="true"] {
  --quote-item-bg: transparent;
  --quote-item-border: 0;
}

.quote-cluster[data-treatment="contained"][data-avatar="true"] blockquote {
  --quote-body-bg: var(--surface-1);
  --quote-body-border: var(--rule-quiet);
  --quote-body-padding-x: var(--space-4);
  --quote-body-padding-y: var(--space-3);
}

.quote-cluster[data-treatment="speech-bubble"] .quote-cluster__mark--close {
  display: none;
}

.quote-cluster[data-arrangement="staggered"] {
  display: block;
}

.quote-cluster[data-arrangement="staggered"] > .quote-cluster__item {
  width: calc(62% - var(--quote-stagger-inline-offset));
}

.quote-cluster[data-arrangement="staggered"] > .quote-cluster__item:nth-child(2) {
  margin-inline-start: auto;
  margin-block-start: var(--quote-stagger-block-gap);
}

.quote-cluster[data-arrangement="staggered"] > .quote-cluster__item:nth-child(3) {
  margin-inline-start: var(--quote-stagger-inline-offset);
  margin-block-start: var(--quote-stagger-block-gap);
}
```

## Runtime contract

Serialize the [router](#count-and-placement-router) through `quotes`, `treatment`, `placement`, `arrangement`, `attributionPlacement`, and `attributionAlign`; `avatar` enables the authorized circular portrait option. Each quote may supply `portrait: {dataUri, alt, authorization}` using an embedded, pre-cropped square PNG, descriptive alt text and its asset-authorization record. Portraits remain native picture objects in PowerPoint. Alternatively supply up to three characters in `avatarText` as an explicit placeholder. An absent portrait and absent initials omit the circle. Quote, attribution and subtitle fields must be strings.

`attributionAlign` accepts `left`, `center`, or `right`. It defaults to `left` for `below-left` and speech bubbles, `right` for contained attribution, and `center` for centered callouts. Enabling `avatar` defaults to and requires `below-left`, placing the complete profile row outside the enclosure. `below-center` requires `center`, `below-left` requires `left`, and incompatible placement-and-alignment pairs are rejected. Non-default alignment is included in the resolved variant identity. Registered golden variants are representative specimens; they do not claim to enumerate every valid content-and-alignment combination.

## Native translation

- Build the cluster as one editable group and each quote item as a nested editable group.
- Create quotation marks as editable text, not icons, images, or raster assets. Anchor the closing mark to the lower right of contained and callout bodies; omit it from the original speech bubble.
- Resolve the count grid inside the parent region after subtracting registered gaps. For `five-up`, use six equal internal tracks: each item spans two tracks and the last two occupy tracks two through three and four through five.
- Keep statement and attribution text in separate native text boxes, but group them with a compact registered gap. Never bottom-align the attribution to the full parent field.
- Translate the callout treatment to one editable custom callout geometry whose bottom outline opens into its pointer. Do not composite a closed rectangle and triangle because that leaves a rule between the box and pointer. For `below-left`, align the source block to the leading content guide and place the pointer above that block. Translate the contained treatment to one rounded editable enclosure that includes the attribution. Translate the original speech bubble to an editable single-snip rectangle with its clipped corner at lower right.
- When an avatar is enabled, use one circular crop mask to the left of the name and title. Keep the image replaceable and preserve its original aspect ratio. Omit the avatar group entirely when the photo is absent from the [asset authorization record](icons-and-logos.md#asset-authorization-record).
- When the statements are short, vertically center the complete cluster in its allocated region rather than distributing or stretching its items to fill the region.
- Keep the page title, shared source, footer, and navigation outside the quote-cluster group.

## Acceptance check

- Every displayed statement is traceable to a real source and every speaker identity is accurate or explicitly anonymized.
- The count variant matches the actual number of quote items.
- Every item follows the mark and treatment rules in [styling principles](#styling-principles).
- A sectional cluster remains subordinate to the page title and dominant exhibit.
- No quote is clipped, autofitted, or locally reduced below the registered role.
- Peers share one treatment and attribution placement; an integrated pointer aims at its attribution with no intervening line.
- An enabled avatar is a circular photo from the [asset authorization record](icons-and-logos.md#asset-authorization-record), or an explicit placeholder, to the left of the name and title; missing photos do not leave empty circles.
- The final render contains no arbitrary speech tails, unscaled decorative marks, decorative portraits, or repeated heavy boxes unless an approved reference explicitly requires them. A staggered speech-bubble cluster matches the registered clipped-corner construction rather than approximating it with unrelated shapes.
- Hiding any quote removes a necessary evidentiary clause. If not, delete it.
