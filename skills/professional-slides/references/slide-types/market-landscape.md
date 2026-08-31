# Market Landscape

This is a specialized composition profile for entity maps. Select the parent archetype from the analytical job: [`chart-led insight`](chart-led-insight.md) for a quantitative relationship, [`comparison and options`](comparison-options.md) for peer evaluation, or [`decomposition`](decomposition.md) for an ecosystem or value-chain map.

## Use when

Entity identity is necessary to understand concentration, positioning, white space, capability coverage, ecosystem roles, or competitive clusters. Use a table when exact multi-criterion lookup matters more than spatial pattern.

## Content contract

- defined entity universe and inclusion threshold;
- stable x and y measures, cluster bands, or ecosystem roles;
- authorized logos or text fallbacks;
- explicit size encoding when bubbles vary;
- one declared highlight whose meaning is stated in the title, legend, or annotation;
- sources and date because market landscapes age quickly.

## Layout

Reserve most of the analytical body for one map or matrix. Use logos inside equal-size nodes when position is the encoding; use logo-centered bubbles only when area encodes a documented magnitude. Align capability bands to shared column guides. Put explanatory prose in one attached synthesis region only when required.

Keep every plot mark inside the registered analytical body, below the title separator and above the source zone. When a concentric, radial, or bubble composition cannot fit labels without collision, switch to aligned bands, a matrix, or a grouped ecosystem field. Do not shrink labels or let oversized circles run behind the title to preserve a preferred diagram form.

## Structural HTML reference

```html
<figure class="logo-landscape" data-role="market-landscape">
  <div class="logo-landscape__plot">
    <span class="axis axis--y">Enterprise depth</span><span class="axis axis--x">Workflow breadth</span>
    <article class="entity-bubble" style="--x:74%;--y:24%;--size:96px" data-state="highlight"><span class="entity-logo">A</span><b>Company A</b></article>
    <article class="entity-bubble" style="--x:45%;--y:52%;--size:72px" data-state="peer"><span class="entity-logo">B</span><b>Company B</b></article>
    <article class="entity-bubble" style="--x:22%;--y:68%;--size:58px" data-state="peer"><span class="entity-logo">C</span><b>Company C</b></article>
  </div>
  <figcaption>Bubble area represents documented scale; position represents the two labelled measures.</figcaption>
</figure>
```

```css
.logo-landscape { margin: 0; display: grid; grid-template-rows: 1fr auto; gap: var(--space-2); }
.logo-landscape__plot { position: relative; min-height: 500px; border-left: var(--rule-page); border-bottom: var(--rule-page); background: linear-gradient(var(--divider-rule) 1px, transparent 1px), linear-gradient(90deg, var(--divider-rule) 1px, transparent 1px); background-size: 25% 25%; }
.entity-bubble { position: absolute; left: var(--x); bottom: var(--y); width: var(--size); aspect-ratio: 1; transform: translate(-50%,50%); display: grid; place-items: center; border-radius: 50%; border: 2px solid var(--component-primary); background: var(--canvas); }
.entity-bubble[data-state="peer"] { border-color: var(--muted-ink); }
.entity-bubble b { position: absolute; top: calc(100% + var(--space-1)); white-space: nowrap; font: var(--type-label); }
.entity-logo { font: var(--type-section-heading); }
.axis { position: absolute; font: var(--type-label); color: var(--text-secondary); }
```

Replace letter placeholders with authorized logos at implementation time; the specimen deliberately contains no external or raster assets.

## Failure modes

Invented axes, diameter-based bubble sizing, decorative logos without analytical position, too many unlabeled entities, mixed logo clear space, unexplained highlight, crossed connectors, oversized marks invading the title or source zones, and a market map that omits the inclusion rule.

## Acceptance test

The map's spatial pattern remains meaningful when the logos are replaced by text labels, every position and size reconciles to a defined measure or role, and the highlighted entity is analytically exceptional rather than merely the focal company.
