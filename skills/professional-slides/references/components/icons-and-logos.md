# Icons, Category Images, and Logos

Icons and logos identify real entities, categories, capabilities, steps, or repeated states. Images may add recognition, context, or evidence when they communicate more than an abstract mark. Use visuals to reduce repeated copy or improve scanning, never to add density. Use assets admitted by the [asset authorization record](#asset-authorization-record) and one registered icon library per deck. Without a registered library, default to Lucide. Use another coherent library only when it supplies a clearer named icon for a registered semantic slot that Lucide cannot represent at slide scale, or when the asset record requires that visual system.

## Asset authorization record

Before reuse, register each external image, logo, icon library, visual system, or source deck in `assetAuthorizationRecord` in the [pre-authoring deck contract](../storylining/pre-authoring-contract.md). For a bounded revision without that contract, use the same field in the revision's acceptance manifest. Record its source URL or repository path, rights or user-approval reference, permitted use, required attribution, canonical stored asset path, and fallback when reuse is not permitted. The user message, brand guideline, licence, or asset-owner approval that establishes permission is the authoritative evidence. Missing evidence means use a labelled placeholder, text fallback, or no asset; do not infer permission. Later references to an `approved` or `authorized` visual mean an entry in this record.

## Select and register the icon system

Before authoring, identify the semantic slots that may benefit from icons: category fields, concise section headings, capability or step markers, row labels, and repeated table-cell states. Use an icon when it makes peers easier to distinguish, replaces repeated low-information copy, lightens a dense row or cell, or improves the page's visual balance and scan path. Do not add icons merely to occupy whitespace, decorate every heading, or make a weak composition look finished.

Record each selected icon's meaning, library, exact icon name, size, stroke or fill treatment, colour role, and label behavior in the deck's semantic treatment registry. Reuse the same icon for the same meaning across the deck and do not reuse it for a different meaning. Use an icon with text until the mapping is obvious; use an icon alone only when a column heading, nearby legend, or repeated convention makes the meaning unambiguous.

For Lucide, use the actual vector definition from the available Lucide package or official SVG source and preserve its `24 x 24` viewBox, rounded joins and caps, and outline grammar. Do not redraw a Lucide-like approximation, substitute emoji or icon-font glyphs, or invent a generic circle or square when a named semantic icon is intended. Do not force a weak Lucide metaphor: if no icon reads clearly at slide scale, retain the text or use another approved coherent library.

## Entity logos

Use logos in market maps, bubble charts, ecosystem diagrams, customer landscapes, or comparison headers when rapid entity recognition materially reduces reading effort. Preserve aspect ratio, clear space, and legibility. Place each logo on a neutral backing only when contrast requires it; do not recolour a trademark to fit the palette unless the brand guidelines explicitly permit it.

Use one delivery-safe asset treatment for a peer set. For PowerPoint, prefer byte-embedded PNG assets when SVG support has not been proven in the exact target renderer; preserve the source SVG separately when useful. Do not mix blank or weakly supported SVG placeholders, raster logos, and bold typographic substitutes in one peer set. If one entity must fall back to text, render every peer through the same logo-plus-label geometry and label weight so the fallback reads as intentional rather than broken.

Asset validity is a rendered-output gate. Inspect every logo at full size in the exported PowerPoint render and confirm that the mark is non-blank, recognizable, sharp enough for its displayed size, and visually aligned with its peers. A source file that opens locally or an image object present in the PPTX does not prove that the logo renders correctly.

In hub-and-spoke or partnership diagrams, group peers by a named role before drawing connectors. Use no connectors when proximity and a central label already establish membership; otherwise use short orthogonal or deliberately routed connectors that terminate at node boundaries. Crossing radial lines, lines through labels, and decorative network spaghetti are release defects.

When a logo is absent from the [asset authorization record](#asset-authorization-record), use the organization name in the deck's label role. Do not invent a pseudo-logo, scrape a low-resolution mark, or substitute a generic icon that could be mistaken for the entity.

## Category icons and images

Choose one registered visual treatment for a category composition, normally three to five mutually exclusive peers:

- `icon-only` uses one semantic icon per category when a compact abstract cue improves differentiation;
- `image-only` uses one relevant image per category when concrete subject matter, place, product, or use context is more informative than an icon;
- `icon-image` uses one image plus one semantic icon per category when they perform distinct jobs, such as the image showing the concrete example while the icon reinforces the stable taxonomy.

Apply the selected treatment to every peer. An icon-led treatment requires an icon for every category; an image-led treatment requires an image for every category. Keep icon boxes, stroke width, optical size, baseline, label depth, and accent role identical across peers. Keep image frames, crop ratios, displayed heights, focal treatment, and visual weight consistent across peers. Omit an absent image or icon slot entirely rather than leaving a blank frame or placeholder.

The category label and evidence must carry the meaning. Icons should accelerate scanning and images should make the category more concrete. Use `icon-image` only when each visual contributes independent meaning; do not overlay or pair a generic icon with a photograph that already communicates the same idea. Retain source traceability for every image, preserve its aspect ratio, and use deliberate crops that remain recognizable in the exact final render. Do not use decorative stock imagery merely to fill the row.

Within one visual role, do not mix filled and outline icon families, photographic cutouts, emoji, and logos. A coordinated `icon-image` treatment may pair one consistent icon family with one consistent image treatment across all peers. Do not put each icon in a different accent colour unless hue is a declared category encoding used consistently elsewhere.

## Row and cell icons

Use compact icons when they make repeated rows or cells faster to scan. Suitable roles include category, binary, direction, completeness, risk, and availability. Pair icons with labels for nuanced or infrequent states. A standalone icon may replace repeated words only when a header or legend defines it and no exact value is hidden.

Keep a row icon inside the label cell rather than adding a decorative icon column. Center state icons within comparable cells and keep their box, optical size, stroke, baseline, and text gap consistent. Do not replace exact values, dates, owners, evidence qualifiers, or materially different status language with icons, and do not use several near-synonymous icons merely for variety. Route progress circles and one-to-five rubric marks through [`comparison-indicators`](comparison-indicators.md); semantic row and cell icons still follow the library and registry rules here.

## Theme contract

| Component | Consumed custom properties | Canonical source |
| --- | --- | --- |
| semantic icon | `--icon-color`, `--icon-size`, `--icon-stroke`, `--icon-bg` | [component bindings](../theming/component-bindings.md#media-and-identity-components) |
| logo backing | `--logo-bg`, `--logo-border`, `--logo-padding`, `--logo-radius` | [component bindings](../theming/component-bindings.md#media-and-identity-components) |
| image frame | `--image-bg`, `--image-border`, `--image-radius`, `--image-caption-font`, `--image-caption-color`, `--image-caption-gap` | [component bindings](../theming/component-bindings.md#media-and-identity-components) |
| category composition | `--category-row-gap`, `--category-item-gap`, `--category-heading-gap`, `--category-rule`, `--category-padding-top`, `--category-image-ratio`, `--category-heading-font`, `--category-body-font`, `--category-body-color` | [component bindings](../theming/component-bindings.md#media-and-identity-components) |

## Structural HTML reference

This fragment inherits the themed deck root from its slide.

```html
<section class="category-row" data-role="category-comparison" data-visual-treatment="icon-image">
  <article class="category">
    <figure class="category__image-frame"><img class="category__image" src="assets/demand.jpg" alt="Customer demand visible through a digital ordering interface"></figure>
    <div class="category__heading"><svg class="category__icon" viewBox="0 0 24 24" data-icon-library="lucide" data-icon-name="chart-no-axes-column-increasing" aria-hidden="true"><path d="M5 21v-6"/><path d="M12 21V9"/><path d="M19 21V3"/></svg><h2>Demand</h2></div>
    <p>Size the reachable need and growth drivers.</p>
  </article>
  <article class="category">
    <figure class="category__image-frame"><img class="category__image" src="assets/customers.jpg" alt="Customers using the service in a real operating context"></figure>
    <div class="category__heading"><svg class="category__icon" viewBox="0 0 24 24" data-icon-library="lucide" data-icon-name="users-round" aria-hidden="true"><path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/></svg><h2>Customers</h2></div>
    <p>Test retention, concentration, and willingness to pay.</p>
  </article>
  <article class="category">
    <figure class="category__image-frame"><img class="category__image" src="assets/competition.jpg" alt="Competing products presented side by side"></figure>
    <div class="category__heading"><svg class="category__icon" viewBox="0 0 24 24" data-icon-library="lucide" data-icon-name="swords" aria-hidden="true"><path d="m13 19 6-6"/><path d="M14.5 17.5 3.586 6.586A2 2 0 0 1 3 5.172V3h2.172a2 2 0 0 1 1.414.586L17.5 14.5"/><path d="m14.828 6.172 2.586-2.586A2 2 0 0 1 18.828 3H21v2.172a2 2 0 0 1-.586 1.414l-2.586 2.586"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="m5 14 4 4"/><path d="m5 21-2-2"/><path d="M7.5 16.5 4 20"/></svg><h2>Competition</h2></div>
    <p>Explain choice, differentiation, and durable advantage.</p>
  </article>
</section>
```

This specimen shows the combined treatment. For `image-only`, set `data-visual-treatment="image-only"` and remove each `category__icon` element. For `icon-only`, set `data-visual-treatment="icon-only"` and remove each `category__image-frame` element. The absent slot collapses; do not preserve empty space.

```css
.category-row { --category-row-gap: var(--space-6); --category-item-gap: var(--space-3); --category-heading-gap: var(--space-2); --category-rule: var(--rule-page); --category-padding-top: var(--space-4); --category-image-ratio: 4 / 3; --category-heading-font: var(--type-section-heading); --category-body-font: var(--type-body); --category-body-color: var(--text-secondary); display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--category-row-gap); }
.category { display: grid; grid-auto-rows: auto; gap: var(--category-item-gap); align-content: start; border-top: var(--category-rule); padding-top: var(--category-padding-top); }
.category__image-frame { width: 100%; aspect-ratio: var(--category-image-ratio); margin: 0; overflow: hidden; }
.category__image { display: block; width: 100%; height: 100%; object-fit: cover; }
.category__heading { display: flex; align-items: center; gap: var(--category-heading-gap); }
.category__icon { width: var(--icon-size); height: var(--icon-size); fill: none; stroke: var(--icon-color); stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.category h2, .category p { margin: 0; }
.category h2 { font: var(--category-heading-font); }
.category p { font: var(--category-body-font); color: var(--category-body-color); }
```

## Acceptance check

Give every mark a semantic or compositional purpose. Consider `icon-only`, `image-only`, and `icon-image` treatments. Retain visuals only when they improve differentiation, recognition, readability, balance, or scanning. Peers share one treatment, crop grammar, and registered icon system. Combined icons and images perform different jobs. Use actual Lucide vectors. Keep icon-only cells clear. Logos must be authorized, recognizable, and visible in the final render. Apply one fallback treatment for missing marks. Keep connectors clear of labels and unrelated nodes.
