# Component HTML and CSS Contract

Inline HTML and CSS are structural guidance for native slide creation. They show hierarchy, editable regions, states, and token bindings. They are not browser deliverables and do not outrank the component prose.

## Required Markdown structure

When a component owner includes a specimen, use this order:

1. component purpose and semantic rules;
2. `## Theme contract` listing every consumed custom property and its default binding;
3. `## Structural HTML reference` with one minimal semantic HTML example;
4. one CSS block containing component aliases and geometry;
5. `## Variants and states` for only the demonstrated differences;
6. native translation and acceptance notes.

The component file lists the variables it consumes. Exact global values remain in the [token registry](tokens.md), so a component file does not copy an entire palette or density profile.

## Root declaration

Every specimen starts from one themed deck root:

```html
<main class="deck" data-theme="executive-light" data-density="executive">
  <section class="slide" aria-label="Example analytical slide">
    <!-- component specimen -->
  </section>
</main>
```

The visual family and density are examples. The authoring task substitutes the resolved theme manifest.

## Component example

```html
<header class="action-title" data-lines="one">
  <h1>Retention improved after onboarding was simplified</h1>
</header>
```

```css
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

.action-title h1 {
  margin: 0;
  font: var(--action-title-font);
}
```

The namespaced aliases are the component API. Geometry consumes the aliases. Theme families and density profiles change the resolved values without rewriting component CSS.

## Allowed literals

Component CSS may use:

- `0`, `auto`, `none`, `inherit`, percentages, grid fractions, and semantic keywords;
- structural relationships such as `display: grid`, `place-items`, or `aspect-ratio`;
- content-driven instance variables such as `--value`, `--share`, `--series`, `--x`, `--y`, `--size`, `--height`, and `--bottom`;
- a named component alias whose default is bound to the canonical registry.

Component CSS may not contain:

- literal hex, RGB, HSL, or named paint colours;
- local font families, font sizes, line heights, margins, gaps, padding, radii, shadows, or line widths;
- a global semantic token deep inside child geometry when a namespaced component alias should mediate it;
- browser-only behavior that cannot be translated into editable native objects;
- external dependencies, scripts, base64 assets, screenshots, or rasterized text.

Use an inline `style` attribute only for content data such as `style="--value: 72"` or `style="--x: 38%; --y: 64%"`. Never use it to tune appearance.

## Variants and states

Use `data-variant` for a registered construction and `data-state` for a semantic state:

```html
<aside class="action-surface" data-variant="tonal" data-state="active">
  Proceed if the next cohort sustains retention above the agreed threshold.
</aside>
```

A variant may rebind component aliases. It may not restate complete geometry or introduce raw values. A state changes only the cues that express that state and always preserves a non-colour cue.

## Native translation

| HTML or CSS concept | PowerPoint or Google Slides translation |
| --- | --- |
| semantic element | editable group or named shape collection |
| grid or flex relationship | calculated native coordinates on registered guides |
| custom property | resolved builder constant, master value, placeholder style, or theme value |
| border or rule | native line with resolved colour, width, dash, and cap |
| background | native editable fill |
| text role | native text style with verified font, size, weight, colour, and paragraph settings |
| pseudo-element | explicit editable shape only when it conveys meaning |
| data attribute | component variant or state in the builder model |

Do not flatten the specimen to an image. Recalculate native coordinates from the resolved theme and verify the final platform render.

## Acceptance check

- Every consumed custom property appears in the component's theme-contract table.
- Every custom property resolves through the canonical registry or an authorized reference-derived theme.
- Changing only `data-theme` preserves semantics and geometry while changing visual family values.
- Changing only `data-density` preserves semantics and component construction while changing registered scale and guides.
- Repeated components share identical alias bindings unless a named variant or semantic state applies.
- The native artifact remains editable and its rendered result matches the intended hierarchy.

