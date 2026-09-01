# Tracker Structural Specimens

These specimens show the distinct navigation constructions owned by [Trackers and Navigation](index.md). They are spatial references for editable native slides, not browser deliverables. Use one full state and, only when needed, one compact state for a deck.

## Theme contract

| Property | Default binding |
| --- | --- |
| `--tracker-font` | label role |
| `--tracker-heading-font` | section-title role |
| `--tracker-item-font` | body role |
| `--tracker-item-strong-font` | callout role |
| `--tracker-number-font` | section-heading role |
| `--tracker-section-number-font` | section-number role |
| `--tracker-active` | component primary |
| `--tracker-active-text` | on-primary text |
| `--tracker-inactive` | muted ink |
| `--tracker-ink` | ink |
| `--tracker-canvas` | canvas |
| `--tracker-surface` | surface-1 |
| `--tracker-tint` | component-primary tint |
| `--tracker-rule` | quiet rule |
| `--tracker-page-rule` | page rule |
| `--tracker-emphasis-rule` | emphasis rule |
| `--tracker-gap` | `space-2` |
| `--tracker-item-gap` | `space-5` |
| `--tracker-list-gap` | `space-3` |
| `--tracker-list-width` | `72%` of the available split-content field |
| `--tracker-padding` | `space-4` |
| `--tracker-marker-size` | `space-9` |
| `--tracker-compact-marker-size` | `icon-md` |
| `--tracker-radius` | round radius |
| `--tracker-edge-share` | content-driven half-item share |

## Structural HTML reference

### Sequential circles full state

Use for three to six short peer sections. A contents overview may omit `data-state`; a progress page marks exactly one item as selected.

```html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide tracker tracker-page" data-variant="sequential-circles" aria-label="Contents, section three selected">
    <header class="tracker-page__heading">
      <h1>Contents</h1>
    </header>
    <nav class="tracker tracker--sequential-circles" aria-label="Deck sections">
      <span class="tracker__sequence-rule" style="--tracker-edge-share: 12.5%" aria-hidden="true"></span>
      <ol>
        <li>
          <span class="tracker__marker">01</span>
          <h2>Context</h2>
          <p>Why the decision matters</p>
        </li>
        <li>
          <span class="tracker__marker">02</span>
          <h2>Evidence</h2>
          <p>What the analysis shows</p>
        </li>
        <li data-state="selected" aria-current="step">
          <span class="tracker__marker">03</span>
          <h2>Options</h2>
          <p>Where the choices differ</p>
        </li>
        <li>
          <span class="tracker__marker">04</span>
          <h2>Decision</h2>
          <p>What must happen next</p>
        </li>
      </ol>
    </nav>
  </section>
</main>
```

### Split contents full state and in-section progress state

Use the left field for the parent section title only. Do not add a subtitle, kicker, description, or framing paragraph. Use the right field for the child items. Its backdrop runs the full slide height and reaches the outer right edge; vertically center the complete list within that field. Use circular number markers by default. A long child list uses `data-list-density="long"` while retaining the same construction. Hierarchical numbers remain editable text.

```html
<main class="deck" data-theme="executive-light" data-density="pre-read">
  <section class="slide tracker tracker-page" data-variant="split-contents" aria-label="Conclusion contents, item 8.7 selected">
    <div class="tracker-page__split">
      <header class="tracker-page__parent">
        <h1>8. Conclusion</h1>
      </header>
      <nav class="tracker tracker--split-contents" data-list-density="long" aria-label="Conclusion subsections">
        <ol>
          <li><span class="tracker__marker">8.1</span><span>Growth model overview</span></li>
          <li><span class="tracker__marker">8.2</span><span>Target description</span></li>
          <li><span class="tracker__marker">8.3</span><span>Business case</span></li>
          <li><span class="tracker__marker">8.4</span><span>Management and human capital</span></li>
          <li><span class="tracker__marker">8.5</span><span>Valuation performance</span></li>
          <li><span class="tracker__marker">8.6</span><span>Financial analysis</span></li>
          <li data-state="selected" aria-current="step"><span class="tracker__marker">8.7</span><strong>IPO readiness</strong></li>
          <li><span class="tracker__marker">8.8</span><span>Appendix</span></li>
        </ol>
      </nav>
    </div>
  </section>
</main>
```

### Compact label analytical header

Use when parent and child names carry more meaning than numbers. The labels remain separate from the page topic.

```html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide tracker analytical-page" aria-label="Analytical page in section 8.7">
    <header class="tracker-analytical-header" data-variant="compact-label">
      <nav class="tracker tracker--compact-label" aria-label="Current deck position">
        <span class="tracker__parent">8. Conclusion</span>
        <span class="tracker__separator" aria-hidden="true">/</span>
        <span class="tracker__current" aria-current="step">8.7 IPO readiness</span>
      </nav>
      <h1>Readiness depends on resolving two evidence gaps</h1>
    </header>
  </section>
</main>
```

### Compact number strip analytical header

Use when stable numbers provide sufficient orientation. Keep full labels in the contents state, notes, or an approved nearby legend.

```html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide tracker analytical-page" aria-label="Analytical page in section three">
    <header class="tracker-analytical-header" data-variant="compact-number-strip">
      <nav class="tracker tracker--compact-number-strip" aria-label="Deck sections">
        <ol>
          <li aria-label="Context">01</li>
          <li aria-label="Evidence">02</li>
          <li data-state="selected" aria-current="step" aria-label="Options">03</li>
          <li aria-label="Decision">04</li>
        </ol>
      </nav>
      <h1>Two options preserve value while limiting execution risk</h1>
    </header>
  </section>
</main>
```

### Numbered full-canvas section break

Use only at a material chapter change. The title stays on the left and the large section number occupies the right field.

```html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide tracker tracker-section-break" data-variant="numbered-section-break" aria-label="Section 02, Background and context">
    <div class="tracker-section-break__body">
      <h1>Background and context</h1>
      <div class="tracker-section-break__number" aria-hidden="true">02</div>
    </div>
  </section>
</main>
```

```css
.tracker {
  --tracker-font: var(--type-label);
  --tracker-heading-font: var(--type-section-title);
  --tracker-item-font: var(--type-body);
  --tracker-item-strong-font: var(--type-callout);
  --tracker-number-font: var(--type-section-heading);
  --tracker-section-number-font: var(--type-section-number);
  --tracker-active: var(--component-primary);
  --tracker-active-text: var(--on-primary);
  --tracker-inactive: var(--muted-ink);
  --tracker-ink: var(--ink);
  --tracker-canvas: var(--canvas);
  --tracker-surface: var(--surface-1);
  --tracker-tint: var(--component-primary-tint);
  --tracker-rule: var(--rule-quiet);
  --tracker-page-rule: var(--rule-page);
  --tracker-emphasis-rule: var(--rule-emphasis);
  --tracker-gap: var(--space-2);
  --tracker-item-gap: var(--space-5);
  --tracker-list-gap: var(--space-3);
  --tracker-list-width: 72%;
  --tracker-padding: var(--space-4);
  --tracker-marker-size: var(--space-9);
  --tracker-compact-marker-size: var(--icon-md);
  --tracker-radius: var(--radius-round);
  --tracker-edge-share: 0;
}

.tracker-page,
.analytical-page,
.tracker-section-break {
  box-sizing: border-box;
  width: var(--slide-width);
  min-height: var(--slide-height);
  padding: var(--slide-margin-block) var(--slide-margin-inline);
  color: var(--tracker-ink);
  background: var(--tracker-canvas);
}

.tracker-page__heading {
  border-bottom: var(--tracker-page-rule);
  padding-bottom: var(--tracker-gap);
}

.tracker-page__heading h1,
.tracker-page__parent h1,
.tracker-section-break h1 {
  margin: 0;
  font: var(--tracker-heading-font);
}

.tracker ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

.tracker-page[data-variant="sequential-circles"] {
  display: grid;
  grid-template-rows: auto 1fr;
}

.tracker--sequential-circles {
  position: relative;
  align-self: center;
}

.tracker--sequential-circles .tracker__sequence-rule {
  position: absolute;
  inset-inline: var(--tracker-edge-share);
  top: calc(var(--tracker-marker-size) / 2);
  height: var(--line-hairline);
  background: var(--tracker-inactive);
}

.tracker--sequential-circles ol {
  position: relative;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: var(--tracker-item-gap);
}

.tracker--sequential-circles li {
  display: grid;
  justify-items: center;
  align-content: start;
  gap: var(--tracker-gap);
  text-align: center;
  color: var(--tracker-inactive);
}

.tracker--sequential-circles .tracker__marker {
  display: grid;
  place-items: center;
  width: var(--tracker-marker-size);
  height: var(--tracker-marker-size);
  border: var(--tracker-rule);
  border-radius: var(--tracker-radius);
  background: var(--tracker-surface);
  color: var(--tracker-inactive);
  font: var(--tracker-number-font);
}

.tracker--sequential-circles h2,
.tracker--sequential-circles p {
  margin: 0;
}

.tracker--sequential-circles h2 {
  font: var(--tracker-item-strong-font);
}

.tracker--sequential-circles p {
  font: var(--tracker-item-font);
}

.tracker--sequential-circles li[data-state="selected"] {
  color: var(--tracker-ink);
  font-weight: var(--weight-bold);
}

.tracker--sequential-circles li[data-state="selected"] .tracker__marker {
  border: var(--tracker-emphasis-rule);
  background: var(--tracker-active);
  color: var(--tracker-active-text);
}

.tracker-page__split {
  display: grid;
  grid-template-columns: 5fr 7fr;
  min-height: var(--slide-height);
}

.tracker-page[data-variant="split-contents"] {
  padding: 0 0 0 var(--slide-margin-inline);
}

.tracker-page__parent,
.tracker--split-contents {
  display: grid;
  align-content: center;
}

.tracker-page__parent {
  padding-right: var(--tracker-item-gap);
}

.tracker--split-contents {
  box-sizing: border-box;
  min-height: var(--slide-height);
  width: 100%;
  padding: var(--tracker-padding) var(--tracker-item-gap);
  background: var(--tracker-surface);
}

.tracker--split-contents ol {
  display: grid;
  gap: var(--tracker-list-gap);
  width: var(--tracker-list-width);
  max-width: 100%;
}

.tracker--split-contents[data-list-density="long"] {
  --tracker-list-gap: var(--space-2);
  --tracker-item-font: var(--type-body-compact);
}

.tracker--split-contents li {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--tracker-gap);
  width: 100%;
  padding: var(--tracker-gap);
  font: var(--tracker-item-font);
}

.tracker--split-contents .tracker__marker {
  display: grid;
  place-items: center;
  min-width: var(--tracker-compact-marker-size);
  min-height: var(--tracker-compact-marker-size);
  border: var(--tracker-rule);
  border-radius: var(--tracker-radius);
  color: var(--tracker-inactive);
  background: var(--tracker-canvas);
  font: var(--tracker-font);
}

.tracker--split-contents li[data-state="selected"] {
  background: var(--tracker-tint);
}

.tracker--split-contents li[data-state="selected"] .tracker__marker {
  border: var(--tracker-rule);
  background: var(--tracker-active);
  color: var(--tracker-active-text);
}

.tracker-analytical-header {
  display: grid;
  gap: var(--tracker-gap);
  border-bottom: var(--tracker-page-rule);
  padding-bottom: var(--tracker-gap);
}

.tracker-analytical-header h1 {
  margin: 0;
  font: var(--type-action-title);
}

.tracker--compact-label {
  display: flex;
  align-items: center;
  gap: var(--tracker-gap);
  font: var(--tracker-font);
}

.tracker--compact-label .tracker__parent,
.tracker--compact-label .tracker__separator {
  color: var(--tracker-inactive);
}

.tracker--compact-label .tracker__current {
  color: var(--tracker-active);
}

.tracker--compact-number-strip ol {
  display: flex;
  align-items: center;
  gap: var(--tracker-item-gap);
}

.tracker--compact-number-strip li {
  min-width: var(--tracker-compact-marker-size);
  padding-bottom: var(--tracker-gap);
  color: var(--tracker-inactive);
  border-bottom: var(--tracker-rule);
  text-align: center;
  font: var(--tracker-font);
}

.tracker--compact-number-strip li[data-state="selected"] {
  color: var(--tracker-active);
  border-bottom: var(--tracker-rule);
}

.tracker-section-break {
  display: grid;
  grid-template-rows: auto 1fr auto;
  border-top: var(--tracker-page-rule);
  border-bottom: var(--tracker-page-rule);
}

.tracker-section-break__body {
  display: grid;
  grid-template-columns: 5fr 7fr;
  align-items: center;
}

.tracker-section-break h1 {
  max-width: 100%;
}

.tracker-section-break__number {
  justify-self: end;
  color: var(--tracker-active);
  font: var(--tracker-section-number-font);
}
```

## Variants and states

- `sequential-circles` is the full horizontal map. `selected` changes the marker fill, keyline, label weight, and current-item metadata.
- `split-contents` is the full two-field map. `data-list-density="long"` tightens only the registered gap and type role. It does not create another layout.
- `compact-label` carries exact parent and child names in the analytical header.
- `compact-number-strip` carries the same ordered IDs in a quieter analytical header.
- `numbered-section-break` is a transition state, not an analytical page and not a second contents system.

## Native translation

- Translate each list item into one editable group containing its marker and text.
- Translate `aria-current="step"` and `data-state="selected"` into the builder's selected state and preserve the non-colour cue.
- Keep the parent field, child list, compact header, and section-break number on registered page guides.
- Materialize every rule as an editable native line. Do not rely on browser pseudo-elements.
- Preserve hierarchical numbers as text so structural edits can recalculate them.

## Acceptance check

- The contents overview has zero selected items or a progress page has exactly one.
- Every tracked transition and analytical page has exactly one selected item.
- The selected item is visible without colour through fill, keyline, weight, or underline.
- Selection never changes an item's inset, baseline, marker size, or rule thickness.
- In split contents, every row shares the same padding and the selected highlight uses a balanced portion of the available field, with generous space after short labels; it neither hugs the text nor fills the field by default.
- The compact breadcrumb keeps parent and current labels on one typographic level and uses no underline.
- The sequential circle rail is vertically centered in the available content field below the heading.
- The full and compact states share identical IDs, labels, order, and current item.
- A long list remains a split-contents density state.
- The compact tracker sits above the action title and never replaces it.
- The numbered section break uses the active section ID and exact approved title.
- Every object remains editable in PowerPoint or Google Slides.
