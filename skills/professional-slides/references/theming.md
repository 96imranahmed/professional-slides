# Theming

Every reusable visual value lives in the theme. Components consume named tokens; slides consume components.

## Palettes

Set `palette` once on the deck specification: `mckinsey` (default), `bcg` or `bain` - brand-inspired presentation-role mappings that change colour tokens only, never geometry, spacing or type size. `color.componentPrimary` (`--component-primary`) resolves to `#051C2C` navy for `mckinsey`, `#197A56` green for `bcg`, `#CB2027` red for `bain`. McKinsey's primary tint is `#E6E8EA`; its bright blue stays a chart series rather than a structural primary. `--chart-comparator` (default `#D9DDE0`) is the light-grey background-evidence role for a focal comparison, independent of both the series palette and the secondary text colour. `runtime/palettes.mjs` records provenance and maps each preset onto the canonical token names, and the compiler resolves one fresh token map per deck.

Typography is independent of palette. Deck-level `typography` supplies body, display, serif and an explicit semibold native face; `weight.semibold` requests 600 for direct annotations. Resolve the family before measuring text and validate face, size and weight in both adapters.

## The four layers

1. **Visual family** - colour, typeface, surface, line and shape character.
2. **Density profile** - type sizes, spacing, margins, guides, gutters, evidence capacity.
3. **Component variant** - binds semantic tokens to one construction, such as an open analytical region or a compact tracker.
4. **Semantic state** - changes only the tokens that express a real state: positive, caution, negative, active, selected, forecast.

Resolve in that order, and let every new value enter through a named token, so a slide-local hex, a `17px` padding or a one-off border resolves back to its semantic role first. Content-driven instance values - a chart percentage, a bubble position, a bar height - are data rather than theme values. Precedence runs from the primitive scale through visual-family tokens, density tokens, component binding, component variant and semantic state to the content instance value. Every executable component declares the token IDs it consumes, and compilation checks that declaration before serialization.

## Visual families

| Family | Use when | Character |
| --- | --- | --- |
| `executive-light` | default for consulting analysis, diligence, strategy and programme work | white canvas, cool neutrals, navy primary, restrained analytical colour |
| `executive-dark` | stage presentation or screen-first executive delivery | deep blue-black canvas, pale type, controlled cyan-blue primary |
| `warm-editorial` | founder narrative, customer story, culture or strategy communication | warm paper canvas, charcoal type, terracotta primary, optional serif display |
| `reference-derived` | an authorized source deck, corporate template or brand system is authoritative | derived from the inspected masters, layouts and recurring components |

Use one family across a deck. A cover or chapter transition may use the family's inverse surface as a registered layout variant.

## Density profiles

| Profile | Use | Behaviour |
| --- | --- | --- |
| `live-pitch` | narrated pitch or keynote | largest type, widest spacing, lowest evidence density |
| `executive` | ordinary executive presentation; the default | moderate density, strong hierarchy |
| `pre-read` | evidence-led document read without narration | compact but readable type, tighter analytical rhythm |
| `appendix` | source-rich analytical support | smallest approved type and tightest grid |

Declare the profile per coherent slide family; a deck may run an `executive` main story with a `pre-read` analytical family. A profile changes every content type role together, while page furniture keeps the deck's base typography. When an exhibit crosses a capacity threshold, promote the whole page to the next profile rather than reducing one legend, cell or annotation. Measure the content at its allocated width: keep the larger type when the exhibit fits, and otherwise remove duplication, enlarge the exhibit, choose another encoding, or split the slide.

## Theme manifest

Before authoring, record: visual family and density profile by slide range; canvas size and unit mapping; verified font family and fallback; primary, neutral, status and chart-series mappings; title, content, footer and grid guides; the selected variant for every repeated component family; semantic-state thresholds and their non-colour cues; and any authorized reference-derived override.

Include a colour ledger that resolves each semantic role to one exact swatch and names the component families allowed to consume it. Images keep their source colours; editable text, shapes, lines, tables, trackers and callouts resolve to declared roles.

For a reference-derived theme, inspect the approved reference first and map every observed value onto the nearest canonical token, keeping the token name even when the value changes. Where the reference lacks a required role, fill it with the quietest compatible value from the same system, so the result still provides the complete token set, readable contrast, stable title anchors and non-colour status cues.

## Theme quality gates

- Body and compact text reach 4.5:1 contrast against their surface; large display text and essential graphical boundaries reach 3:1.
- Status, selection, forecast and comparison each carry a non-colour cue alongside the colour.
- `component-primary` stays one structural accent; chart-series colours stay in charts.
- Spacing resolves to the registered scale; crowding is repaired through composition or copy.
- Radius and shadow stay restrained unless a reference-derived construction uses them consistently.
- Every repeated component resolves to one named binding and variant.
- A final object-level audit finds every editable-object colour resolving to a declared role, and every role resolving to one swatch.

Resolved values for the exact deck are written to `design-manifest.json`, and per-slide values to `scene.json` under `slides[].tokens`; those generated records are the value reference for that deck.

## House style tokens

Each palette sets seven `style.*` keyword tokens beyond its colours; components read them through `houseStyle(id)` and a page may still ask for a specific title variant. `style.titleWeight` (`bold` | `regular`), `style.titleRule` (`none` | `rule` under the title | `band` behind it), `style.tagPlacement` (`top-right` small caps | `below-title` accent pill | `above-title` accent label), `style.chartHeading` (`text` | `band`, a filled grey band with white heading), `style.listMarker` (`dot` | `dash`), `style.tableRows` (`rules` | `zebra`), `style.labelWeight` (`bold` | `regular` value labels, in the scene and the native chart). The `mckinsey` palette also sets `font.display` to a serif; `examples/house-style.deck.json` shows the same eight pages under any palette.
