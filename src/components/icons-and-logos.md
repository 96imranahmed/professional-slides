# Icons and Logos

Icons and logos identify a real entity, category, capability, or operating step. They are evidence-navigation aids, not decoration. Use only authorized logos and a single consistent icon library for the complete deck; Lucide or another restrained outline system is the neutral default when no brand library is specified.

## Entity logos

Use logos in market maps, bubble charts, ecosystem diagrams, customer landscapes, or comparison headers when rapid entity recognition materially reduces reading effort. Preserve aspect ratio, clear space, and legibility. Place each logo on a neutral backing only when contrast requires it; do not recolour a trademark to fit the palette unless the brand guidelines explicitly permit it.

Use one delivery-safe asset treatment for a peer set. For PowerPoint, prefer byte-embedded PNG assets when SVG support has not been proven in the exact target renderer; preserve the source SVG separately when useful. Do not mix blank or weakly supported SVG placeholders, raster logos, and bold typographic substitutes in one peer set. If one entity must fall back to text, render every peer through the same logo-plus-label geometry and label weight so the fallback reads as intentional rather than broken.

Asset validity is a rendered-output gate. Inspect every logo at full size in the exported PowerPoint render and confirm that the mark is non-blank, recognizable, sharp enough for its displayed size, and visually aligned with its peers. A source file that opens locally or an image object present in the PPTX does not prove that the logo renders correctly.

In hub-and-spoke or partnership diagrams, group peers by a named role before drawing connectors. Use no connectors when proximity and a central label already establish membership; otherwise use short orthogonal or deliberately routed connectors that terminate at node boundaries. Crossing radial lines, lines through labels, and decorative network spaghetti are release defects.

When an authorized logo is unavailable, use the organization name in the deck's label role. Do not invent a pseudo-logo, scrape a low-resolution mark, or substitute a generic icon that could be mistaken for the entity.

## Category icons

Use one icon per mutually exclusive category, normally three to five categories. Keep the icon box, stroke width, optical size, baseline, label depth, and accent role identical across peers. The category label and evidence must carry the meaning; the icon should allow faster scanning, not encode a second taxonomy.

Do not mix filled and outline icon families, photographic cutouts, emoji, and logos in one peer set. Do not put each icon in a different accent colour unless hue is a declared category encoding used consistently elsewhere.

## Structural HTML reference

```html
<section class="category-row" data-role="category-overview">
  <article class="category" data-state="peer">
    <svg class="category__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/></svg>
    <h2>Demand</h2><p>Size the reachable need and growth drivers.</p>
  </article>
  <article class="category" data-state="peer">
    <svg class="category__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M3 19c1-4 3-6 6-6s5 2 6 6m0-5c3 0 5 2 6 5"/></svg>
    <h2>Customers</h2><p>Test retention, concentration, and willingness to pay.</p>
  </article>
  <article class="category" data-state="peer">
    <svg class="category__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M7 20V9l5-5 5 5v11M10 20v-6h4v6"/></svg>
    <h2>Competition</h2><p>Explain choice, differentiation, and durable advantage.</p>
  </article>
</section>
```

```css
.category-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-6); }
.category { display: grid; grid-template-rows: auto auto 1fr; gap: var(--space-3); align-content: start; border-top: var(--rule-page); padding-top: var(--space-4); }
.category__icon { width: var(--icon-lg); height: var(--icon-lg); fill: none; stroke: var(--component-primary); stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
.category h2, .category p { margin: 0; }
.category h2 { font: var(--type-section-heading); }
.category p { font: var(--type-body); color: var(--text-secondary); }
```

## Acceptance check

Every visual mark identifies a necessary entity or category, all peer icons come from one system and share one treatment, logos remain authorized, recognizable, and non-blank in the exact final render, missing marks fall back through one declared peer treatment, connectors never cross labels or unrelated nodes, and removing an icon or logo would make the page harder to scan or interpret.
