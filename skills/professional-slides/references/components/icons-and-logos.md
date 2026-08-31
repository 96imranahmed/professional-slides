# Icons and Logos

Icons and logos identify a real entity, category, capability, operating step, or repeated state. They may also reduce repeated copy and create restrained visual rhythm when that materially improves scanability or composition; icon density is not a goal. Use only authorized logos and one consistent icon library for the complete deck. When no approved brand or reference icon library is specified, prefer Lucide as the neutral source rather than drawing icons from memory or mixing arbitrary SVGs; another coherent library is valid when it offers a materially better semantic match or the approved visual system requires it.

## Select and register the icon system

Before authoring, identify the semantic slots that may benefit from icons: category fields, concise section headings, capability or step markers, row labels, and repeated table-cell states. Use an icon when it makes peers easier to distinguish, replaces repeated low-information copy, lightens a dense row or cell, or improves the page's visual balance and scan path. Do not add icons merely to occupy whitespace, decorate every heading, or make a weak composition look finished.

Record each selected icon's meaning, library, exact icon name, size, stroke or fill treatment, colour role, and label behavior in the deck's semantic treatment registry. Reuse the same icon for the same meaning across the deck and do not reuse it for a different meaning. Use an icon with text until the mapping is obvious; use an icon alone only when a column heading, nearby legend, or repeated convention makes the meaning unambiguous.

For Lucide, use the actual vector definition from the available Lucide package or official SVG source and preserve its `24 x 24` viewBox, rounded joins and caps, and outline grammar. Do not redraw a Lucide-like approximation, substitute emoji or icon-font glyphs, or invent a generic circle or square when a named semantic icon is intended. Do not force a weak Lucide metaphor: if no icon reads clearly at slide scale, retain the text or use another approved coherent library.

## Entity logos

Use logos in market maps, bubble charts, ecosystem diagrams, customer landscapes, or comparison headers when rapid entity recognition materially reduces reading effort. Preserve aspect ratio, clear space, and legibility. Place each logo on a neutral backing only when contrast requires it; do not recolour a trademark to fit the palette unless the brand guidelines explicitly permit it.

Use one delivery-safe asset treatment for a peer set. For PowerPoint, prefer byte-embedded PNG assets when SVG support has not been proven in the exact target renderer; preserve the source SVG separately when useful. Do not mix blank or weakly supported SVG placeholders, raster logos, and bold typographic substitutes in one peer set. If one entity must fall back to text, render every peer through the same logo-plus-label geometry and label weight so the fallback reads as intentional rather than broken.

Asset validity is a rendered-output gate. Inspect every logo at full size in the exported PowerPoint render and confirm that the mark is non-blank, recognizable, sharp enough for its displayed size, and visually aligned with its peers. A source file that opens locally or an image object present in the PPTX does not prove that the logo renders correctly.

In hub-and-spoke or partnership diagrams, group peers by a named role before drawing connectors. Use no connectors when proximity and a central label already establish membership; otherwise use short orthogonal or deliberately routed connectors that terminate at node boundaries. Crossing radial lines, lines through labels, and decorative network spaghetti are release defects.

When an authorized logo is unavailable, use the organization name in the deck's label role. Do not invent a pseudo-logo, scrape a low-resolution mark, or substitute a generic icon that could be mistaken for the entity.

## Category icons

When icons materially improve differentiation in a category composition, use one icon per mutually exclusive category, normally three to five categories. Icon-led category profiles require an icon for every peer rather than leaving arbitrary gaps. Keep the icon box, stroke width, optical size, baseline, label depth, and accent role identical across peers. The category label and evidence must carry the meaning; the icon should allow faster scanning, add compositional polish, and never encode a second taxonomy.

Do not mix filled and outline icon families, photographic cutouts, emoji, and logos in one peer set. Do not put each icon in a different accent colour unless hue is a declared category encoding used consistently elsewhere.

## Row and cell icons

Use compact icons in tables, scorecards, comparison grids, or action lists when they make repeated rows or cells faster to scan and visually lighter. Suitable uses include an inline category icon before a row label, or a stable mark for a repeated binary, directional, completeness, risk, or availability state. Prefer an icon-plus-label when the state is nuanced or appears only a few times; a standalone icon may replace repeated words such as `included`, `not included`, `up`, or `down` only when the header or legend defines the mapping and the icon does not hide an exact value.

Keep a row icon inside the label cell rather than adding a decorative icon column. Center state icons within comparable cells and keep their box, optical size, stroke, baseline, and text gap consistent. Do not replace exact values, dates, owners, evidence qualifiers, or materially different status language with icons, and do not use several near-synonymous icons merely for variety. Route progress circles and one-to-five rubric marks through [`comparison-indicators`](comparison-indicators.md); semantic row and cell icons still follow the library and registry rules here.

## Structural HTML reference

```html
<section class="category-row" data-role="category-overview">
  <article class="category" data-state="peer">
    <svg class="category__icon" viewBox="0 0 24 24" data-icon-library="lucide" data-icon-name="chart-no-axes-column-increasing" aria-hidden="true"><path d="M5 21v-6"/><path d="M12 21V9"/><path d="M19 21V3"/></svg>
    <h2>Demand</h2><p>Size the reachable need and growth drivers.</p>
  </article>
  <article class="category" data-state="peer">
    <svg class="category__icon" viewBox="0 0 24 24" data-icon-library="lucide" data-icon-name="users-round" aria-hidden="true"><path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/></svg>
    <h2>Customers</h2><p>Test retention, concentration, and willingness to pay.</p>
  </article>
  <article class="category" data-state="peer">
    <svg class="category__icon" viewBox="0 0 24 24" data-icon-library="lucide" data-icon-name="swords" aria-hidden="true"><path d="m13 19 6-6"/><path d="M14.5 17.5 3.586 6.586A2 2 0 0 1 3 5.172V3h2.172a2 2 0 0 1 1.414.586L17.5 14.5"/><path d="m14.828 6.172 2.586-2.586A2 2 0 0 1 18.828 3H21v2.172a2 2 0 0 1-.586 1.414l-2.586 2.586"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="m5 14 4 4"/><path d="m5 21-2-2"/><path d="M7.5 16.5 4 20"/></svg>
    <h2>Competition</h2><p>Explain choice, differentiation, and durable advantage.</p>
  </article>
</section>
```

```css
.category-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-6); }
.category { display: grid; grid-template-rows: auto auto 1fr; gap: var(--space-3); align-content: start; border-top: var(--rule-page); padding-top: var(--space-4); }
.category__icon { width: var(--icon-lg); height: var(--icon-lg); fill: none; stroke: var(--component-primary); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.category h2, .category p { margin: 0; }
.category h2 { font: var(--type-section-heading); }
.category p { font: var(--type-body); color: var(--text-secondary); }
```

## Acceptance check

Every visual mark has a declared semantic or compositional purpose, candidate category and table regions were considered for icon-led treatment, and each retained icon materially improves differentiation, readability, density, balance, or scan rhythm. All peer icons come from one registered system and share one treatment; Lucide marks use actual library vectors rather than approximations; icon-only cells remain unambiguous; logos remain authorized, recognizable, and non-blank in the exact final render; missing marks fall back through one declared peer treatment; and connectors never cross labels or unrelated nodes.
