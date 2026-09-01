# Slide Layouts

Slide layouts allocate the analytical canvas into page-level regions. They do not define the narrative job, evidence logic, chart type, or component internals.

Choose in this order:

1. select one [narrative archetype](../slide-types/index.md);
2. select one [evidence composition](../slide-types/evidence-compositions.md);
3. choose the simplest layout below that exposes the relationship among the regions;
4. place registered components inside the layout slots.

Use `full-field` by default. Add a split only when the boundary itself helps the audience understand hierarchy, parity, context, support, or inference.

## Layout router

| Layout | Use when | Region relationship | Do not use when |
| --- | --- | --- | --- |
| `cover-split-50-50` | two distinct but co-governing branches need strong visual separation and one branch benefits from an accent surface | equal weight, strong contrast | the branches are merely peer exhibits that should share one analytical surface |
| `section-split-50-50` | two peer sections answer the same question and each needs its own subordinate heading | equal weight, explicit section identity | one section is context, method, or synthesis for the other |
| `context-detail-20-80` | a compact framing field, category label, premise, or scope governs a much larger evidence field | subordinate context to dominant detail | the narrow region needs substantial evidence or an independent conclusion |
| `soft-split-50-50` | methodology, definitions, assumptions, or explanatory text are jointly necessary with an exhibit | related support, quiet separation | the two regions are independent peers or require strong contrast |
| `full-field` | one chart, diagram, table, map, or text structure carries the proof | one uninterrupted field | a distinct section boundary is required to decode the argument |
| `implication-split` | evidence or a finding visibly leads to one separate decision-relevant consequence | directional inference from A to B | proximity or the action title already makes the inference obvious |

`Cover` describes the strong surface treatment, not a deck-cover slide. Every analytical use still has one page-level action title. If the two halves contain genuinely unrelated claims, they belong on separate slides.

## General principles

- Region width communicates rhetorical weight. Equal widths imply peer importance; a narrow rail implies a subordinate framing role.
- A surface change is stronger than a rule, and a rule is stronger than whitespace. Use the quietest boundary that makes the relationship clear.
- Each region contributes one necessary clause to the action title. A region is not a miniature slide and never receives another action title, footer, page number, or source system.
- Use subordinate section headings only when they help decode parallel or non-peer roles. Do not add headings merely to fill the grid.
- Keep one dominant exhibit. A split may contain multiple components, but it must not create competing storylines.
- Mirror a layout only when reading direction, source-template authority, or a focal visual warrants it. Mirroring does not change slot meaning.
- Preserve the global title, source, footer, and navigation anchors while changing the body layout.

## Slot contract

Every variant uses the same semantic frame:

- `primary`: the dominant or first-read content region;
- `secondary`: a peer or supporting region;
- `context`: a compact framing region;
- `evidence`: the region that proves the claim;
- `inference`: an optional connector slot using the registered [arrow component](../components/arrows.md);
- `implication`: the consequence region, normally using the registered [Insight Box](../components/insight-box.md).

Components keep their own internal geometry and theme bindings. The layout owns only slot position, allocation, gap, boundary, and reading order.

## Theme contract

| Custom property | Default binding | Purpose |
| --- | --- | --- |
| `--slide-layout-gap` | `--grid-gutter` | gap between open regions |
| `--slide-layout-rule` | `--rule-quiet` | optional soft boundary |
| `--slide-layout-accent-bg` | `--component-primary` | strong split surface |
| `--slide-layout-accent-color` | `--on-primary` | text and marks on the accent surface |
| `--slide-layout-soft-bg` | `--surface-1` | optional quiet supporting surface |
| `--slide-layout-color` | `--ink` | default region text colour |
| `--slide-layout-heading-font` | `--type-section-heading` | subordinate section-heading role |
| `--slide-layout-heading-color` | `--ink` | subordinate heading colour |
| `--slide-layout-heading-rule` | `--rule-page` | registered section-heading underline |
| `--slide-layout-heading-gap` | `--space-2` | heading-to-content spacing |
| `--slide-layout-region-padding` | `--space-5` | inset for filled or divided regions |

## Structural HTML reference

### 50-50 cover split

```html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide" aria-label="Strong equal split example">
    <header class="action-title"><h1>One governing claim connects two distinct branches</h1></header>
    <div class="slide-layout" data-layout="cover-split-50-50">
      <section class="layout-region" data-slot="primary">Primary branch components</section>
      <section class="layout-region" data-slot="secondary" data-tone="accent">Contrasting branch components</section>
    </div>
    <footer class="source-line">Source: registered source treatment</footer>
  </section>
</main>
```

### 50-50 section split

```html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide" aria-label="Peer section split example">
    <header class="action-title"><h1>Peer evidence reaches one common conclusion</h1></header>
    <div class="slide-layout" data-layout="section-split-50-50">
      <section class="layout-region" data-slot="primary"><h2>Peer section A</h2><div class="layout-content">First exhibit</div></section>
      <section class="layout-region" data-slot="secondary"><h2>Peer section B</h2><div class="layout-content">Second exhibit</div></section>
    </div>
    <footer class="source-line">Source: registered source treatment</footer>
  </section>
</main>
```

### 20-80 context and detail split

```html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide" aria-label="Context and detail split example">
    <header class="action-title"><h1>A broad frame organizes the detailed proof</h1></header>
    <div class="slide-layout" data-layout="context-detail-20-80">
      <aside class="layout-region" data-slot="context"><h2>Scope or premise</h2></aside>
      <section class="layout-region" data-slot="evidence"><div class="layout-content">Dominant evidence components</div></section>
    </div>
    <footer class="source-line">Source: registered source treatment</footer>
  </section>
</main>
```

### 50-50 soft split

```html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide" aria-label="Related soft split example">
    <header class="action-title"><h1>The method and result are jointly necessary</h1></header>
    <div class="slide-layout" data-layout="soft-split-50-50">
      <section class="layout-region" data-slot="primary"><div class="layout-content">Method or explanation</div></section>
      <section class="layout-region" data-slot="secondary"><div class="layout-content">Chart or design</div></section>
    </div>
    <footer class="source-line">Source: registered source treatment</footer>
  </section>
</main>
```

### Full field

```html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide" aria-label="Full evidence field example">
    <header class="action-title"><h1>One dominant exhibit carries the proof</h1></header>
    <div class="slide-layout" data-layout="full-field">
      <section class="layout-region" data-slot="evidence"><div class="layout-content">Single chart, diagram, table, map, or narrative structure</div></section>
    </div>
    <footer class="source-line">Source: registered source treatment</footer>
  </section>
</main>
```

### Implication split

```html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide" aria-label="Evidence to implication split example">
    <header class="action-title"><h1>The observed pattern changes the decision</h1></header>
    <div class="slide-layout" data-layout="implication-split">
      <section class="layout-region" data-slot="evidence"><div class="layout-content">Evidence or finding components</div></section>
      <div class="slide-layout__inference" data-slot="inference"><span class="arrow" data-variant="disc-chevron" aria-label="therefore"></span></div>
      <aside class="layout-region insight-box" data-slot="implication" data-variant="tonal">One decision-relevant consequence</aside>
    </div>
    <footer class="source-line">Source: registered source treatment</footer>
  </section>
</main>
```

```css
.slide-layout {
  --slide-layout-gap: var(--grid-gutter);
  --slide-layout-rule: var(--rule-quiet);
  --slide-layout-accent-bg: var(--component-primary);
  --slide-layout-accent-color: var(--on-primary);
  --slide-layout-soft-bg: var(--surface-1);
  --slide-layout-color: var(--ink);
  --slide-layout-heading-font: var(--type-section-heading);
  --slide-layout-heading-color: var(--ink);
  --slide-layout-heading-rule: var(--rule-page);
  --slide-layout-heading-gap: var(--space-2);
  --slide-layout-region-padding: var(--space-5);

  display: grid;
  gap: var(--slide-layout-gap);
  min-height: 0;
  color: var(--slide-layout-color);
}

.layout-region,
.layout-content {
  min-width: 0;
  min-height: 0;
}

.layout-region > h2 {
  margin: 0 0 var(--slide-layout-heading-gap);
  border-bottom: var(--slide-layout-heading-rule);
  color: var(--slide-layout-heading-color);
  font: var(--slide-layout-heading-font);
}

.slide-layout[data-layout="cover-split-50-50"] {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
}

.slide-layout[data-layout="cover-split-50-50"] > [data-slot="primary"] {
  padding-inline-end: var(--slide-layout-region-padding);
}

.slide-layout[data-layout="cover-split-50-50"] > [data-tone="accent"] {
  padding: var(--slide-layout-region-padding);
  background: var(--slide-layout-accent-bg);
  color: var(--slide-layout-accent-color);
}

.slide-layout[data-layout="section-split-50-50"],
.slide-layout[data-layout="soft-split-50-50"] {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.slide-layout[data-layout="soft-split-50-50"] > [data-slot="secondary"] {
  border-left: var(--slide-layout-rule);
  padding-inline-start: var(--slide-layout-region-padding);
}

.slide-layout[data-layout="context-detail-20-80"] {
  grid-template-columns: minmax(0, 1fr) minmax(0, 4fr);
}

.slide-layout[data-layout="context-detail-20-80"] > [data-slot="context"] {
  background: var(--slide-layout-soft-bg);
  padding: var(--slide-layout-region-padding);
}

.slide-layout[data-layout="full-field"] {
  grid-template-columns: minmax(0, 1fr);
}

.slide-layout[data-layout="implication-split"] {
  grid-template-columns: minmax(0, 8fr) minmax(0, 1fr) minmax(0, 3fr);
  align-items: stretch;
}

.slide-layout__inference {
  display: grid;
  place-items: center;
}
```

## Morphing rules

Morph the page by changing `data-layout` and slot allocation, not by rewriting component internals.

- `full-field` to `section-split-50-50`: split only when the evidence becomes two true peers with matched headings and comparable geometry.
- `section-split-50-50` to `soft-split-50-50`: soften the boundary when one side explains, qualifies, or supports the other.
- `soft-split-50-50` to `context-detail-20-80`: narrow the supporting side when it becomes framing context rather than co-equal content.
- any split to `full-field`: collapse the secondary material into the title, annotation, notes, or appendix when the primary exhibit can carry the claim alone.
- `implication-split` to another layout: remove the inference slot when the arrow only restates obvious reading order. Preserve a separate implication region only if it adds a distinct consequence.
- `cover-split-50-50` to `section-split-50-50`: remove the accent field when contrast no longer carries meaning and the two branches should read as analytical peers.

Do not morph when the new geometry changes the audience job, turns peers into a false sequence, or hides an independent conclusion. Re-select the archetype or split the slide instead.

## Native translation

Build every region as an editable group on the registered content guides. Resolve equal splits as equal usable widths after subtracting the registered gap. Resolve `20-80` as one-fifth and four-fifths of the usable field. Resolve `implication-split` as evidence, one connector track, and consequence, with an approximate `8 + 1 + 3` allocation.

Keep the action title, source, footer, and tracker outside the body-layout group. Use native fills and lines for boundaries, preserve component editability inside every region, and place connectors behind or between content groups according to the [arrow component](../components/arrows.md).

## Acceptance check

- The selected layout makes the relationship among regions clearer than `full-field` would.
- The slide still has one action title, one narrative archetype, one evidence composition, and one dominant exhibit.
- Every region has a necessary role and no region behaves like an independent slide.
- Equal regions are genuinely peers; narrow regions are genuinely subordinate.
- The implication connector means `therefore`, not sequence, decoration, or reading order.
- Changing layout does not change component internals, palette literals, typography roles, sources, or evidence meaning.
- The final native render preserves the registered title, content, source, and footer anchors without clipping or dead space.
