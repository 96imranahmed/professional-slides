# Theming

Theming owns every reusable visual value and every binding between a visual value and a slide component. The open composition model owns page-level arrangement. Components own semantic jobs and internal geometry. No component or slide may invent a local palette, type scale, spacing scale, line grammar, radius, or shadow.

## Runtime palette presets

Set `palette` once on the deck specification: `mckinsey` (default), `bcg`, or `bain`. These are brand-inspired presentation-role mappings, not official firm templates. Palette selection changes colour tokens, never component geometry, spacing, or type sizes. The reference-fidelity benchmark retains `consulting-toolkit` explicitly.

- `mckinsey`: navy, electric blue, and cyan from the [published 2020 design system](https://cdn.mckinsey.com/assets/sketch/McK_DS_core_Artboards.pdf).
- `bcg`: green and warm neutrals from the [public BCG site](https://www.bcg.com/about/corporate-newsroom).
- `bain`: red and grey from a [joint Bain publication](https://www.baincapital.com/news/embedded-financial-services-what-it-takes-prosper-new-value-chain), not a brand-guide claim.

`runtime/palettes.mjs` records provenance and maps each preset into the canonical token names. The compiler resolves a fresh token map per deck. HTML custom properties, scene styles, native theme slots, and Artifact Tool readback must agree. A token may use a native theme slot only when its resolved value matches that slot. Pie-label foregrounds are selected against the resolved slice colour. Reject unknown or slide-local palette overrides.

Company typography is independent of palette. Deck-level `typography` supplies body, display, serif, and an explicit semibold native-face mapping. `weight.semibold` requests 600 for direct annotations. Record an unavailable-weight fallback in the manifest; the Arial default explicitly resolves to its native bold face. Resolve the chosen family before measuring text, and validate its face, size, and weight in both adapters. See [`runtime/README.md`](../../runtime/README.md#palette-and-company-fonts) for configuration.

## Resolve one active theme

A resolved deck theme has four layers:

1. **Visual family** defines colour, typeface, surface, line, and shape character.
2. **Density profile** defines type sizes, spacing, margins, guides, grid gutters, and evidence capacity.
3. **Component variant** binds semantic tokens to a component construction such as an open analytical region, tonal action surface, or compact tracker.
4. **Semantic state** changes only the tokens needed to express a real state such as positive, caution, negative, active, selected, or forecast.

Resolve the layers in that order. A later layer may override a named token, but it may not introduce an undeclared literal. Content-driven instance values such as a chart percentage, bubble position, or bar height are not theme values.

Read:

- [Token registry](tokens.md) for the complete variable contract and exact native defaults.
- [Component bindings](component-bindings.md) for the variables each component consumes.
- [HTML and CSS contract](html-css-contract.md) when adding or revising an inline structural specimen.

## Visual families

| Family | Use when | Character | Avoid when |
| --- | --- | --- | --- |
| `executive-light` | no approved reference exists; default for consulting analysis, diligence, strategy, and programme work | white canvas, cool neutrals, navy-blue primary, restrained analytical colour | an approved source or brand system must be followed |
| `executive-dark` | stage presentation, keynote, or screen-first executive delivery benefits from a dark field | deep blue-black canvas, pale type, bright but controlled cyan-blue primary | dense pre-reads, print-heavy review, or mixed light and dark slides without a declared transition |
| `warm-editorial` | founder narrative, customer story, culture, or strategy communication benefits from a less institutional voice | warm paper canvas, charcoal type, terracotta primary, optional serif display role | risk, status, or data colour would be confused with the warm accent |
| `reference-derived` | a source deck, corporate template, or brand system admitted by the [asset authorization record](../components/icons-and-logos.md#asset-authorization-record) is authoritative | derived from inspected masters, layouts, placeholders, and recurring components | the source is merely inspirational, incomplete, or absent from the authorization record |

Use one family across a deck. A cover or chapter transition may use the family's inverse surface, but that is a registered layout variant, not a second theme. Do not mix named families for variety.

## Density profiles

| Profile | Default use | Behaviour |
| --- | --- | --- |
| `live-pitch` | narrated pitch or keynote | largest type, widest spacing, lowest evidence density |
| `executive` | ordinary executive presentation | moderate density and strong hierarchy |
| `pre-read` | evidence-led document read without narration | compact but readable type and tighter analytical rhythm |
| `appendix` | source-rich analytical support | smallest approved type and tightest grid; never a way to compress a main-story slide |

Choose density per coherent slide family, not per individual slide. A deck may have an `executive` main story and an `appendix` appendix. It may not switch density because one page is overcrowded.

## Cascade and inheritance

Use this precedence, from lowest to highest:

1. primitive scale;
2. visual-family semantic tokens;
3. density-profile layout and type tokens;
4. named component binding;
5. named component variant;
6. semantic state;
7. content-driven instance variable.

An override is valid only when it has a semantic name and applies to every matching instance. Reject slide-local values such as a one-off hex colour, `17px` padding, locally smaller title, unique border, or hand-tuned text inset.

Every executable component must declare its consumed token IDs. Scene compilation rejects undeclared use before HTML or PowerPoint serialization.

## Theme manifest

Before authoring a new deck or redesigning an existing one, record:

- visual family and density profile by slide range;
- canvas size and platform unit mapping;
- verified font family and fallback;
- primary, neutral, status, and chart-series mappings;
- title, content, footer, and grid guides;
- selected variant for every repeated component family;
- semantic-state thresholds and their non-colour cues;
- authorized reference-derived overrides;
- any platform fallback that must materialize inherited values.

For PowerPoint, also compile these values into the machine-readable [PowerPoint acceptance manifest](../tools/powerpoint/acceptance.md). Enumerate allowed fonts, colours, scheme-colour roles, font sizes, slide dimensions, copy ceilings, and repeated-role rules before export. Do not expand the allowlist to bless accidental output.

Include a colour ledger that resolves each semantic role to one exact swatch for the deck and identifies the slide or component families allowed to consume it. The same semantic role must resolve identically in PowerPoint and Google Slides. Images may contain their source colours, but editable text, shapes, lines, tables, trackers, callouts, and non-data chart decoration may use only declared roles. Chart-series and status colours remain limited to their declared evidence semantics.

This may be a concise authoring note, builder object, or theme section in the deck contract. It is not a second token registry.

## Reference-derived themes

Inspect the complete approved reference before deriving values. Preserve intentional master and layout inheritance. Map every observed value to the nearest canonical token and keep the canonical token name even when its value changes. If the reference lacks a required role, fill the gap with the quietest compatible value from the reference system rather than mixing in another named family.

Reference-derived themes must still provide the complete required token set, readable contrast, stable title anchors, a coherent spacing scale, one component-primary role, neutral comparators, and non-colour status cues. Record every departure from the source that is required for legibility or platform compatibility.

## Theme quality gates

- Body and compact text should meet at least `4.5:1` contrast against its surface. Large display text and essential graphical boundaries should meet at least `3:1`.
- Colour never carries status, selection, forecast, or comparison alone.
- `component-primary` remains one structural accent. Chart-series colours do not become decorative component colours.
- Spacing uses the registered scale. Crowding is repaired through composition or copy, not fractional local tuning.
- Radius and shadow default to restrained or absent. A reference-derived construction may use more only when it is consistent and intentional.
- Every repeated component resolves to one named binding and variant.
- PowerPoint and Google Slides adapters materialize the same resolved values and are rendered separately.
- A final object-level colour audit finds no undeclared editable-object colour and no semantic role resolving to multiple swatches without an authorized platform fallback.
