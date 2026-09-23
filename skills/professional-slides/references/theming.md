# Theming

Every reusable visual value lives in the theme. Components consume named tokens; slides consume components.

## Design systems

A palette changes colour; a design system changes the page. Two decks on unrelated subjects built in one frame - the same cover, chapter panels, title position, commentary rail and takeaway band - read as one deck in two colours, whatever their charts. Set `design` once on the deck; `runtime/design-systems.mjs` owns the values.

| `design` | Reader and occasion | Frame | Page repertoire to plan for |
| --- | --- | --- | --- |
| `consulting` (default) | steering committees, boards, diligence read against firm decks | white canvas, sans titles top-left, commentary rail right, tinted takeaway band, dark cover, numbered chapter panels | exhibit with commentary, tables with treatments, metrics strips, trackers |
| `editorial` | pre-reads, strategy narratives and essays read alone | warm paper, large regular serif titles, wide margins, commentary left of the exhibit, the takeaway as a serif close over a hairline, typographic cover and chapter pages, panels opened | text pages that carry an argument, a photograph beside prose (`picture-hero`), quotations, fewer and larger exhibits, statement pages between parts |
| `journal` | evidence-led briefings where the chart is the argument | red tab over short bold sans titles, the finding as a standfirst under the title, tight margins, zebra tables, no tinted boxes, masthead cover | full-width annotated charts with commentary in columns beneath (`exhibit-top`), small multiples (`grid`), metrics over an exhibit, record tables |
| `keynote` | decks presented to a room, launches, pitches | titles reversed out of a colour block, larger type, the takeaway as a statement with an accent bar, colour-field cover and chapter pages, full-bleed picture covers | one idea a page: hero numbers (`kpi`), metrics over an exhibit, split-tone comparisons, statement and picture pages, sparse text |

The system biases the layout chooser toward its repertoire and translates the author's panel tones into its grammar (an editorial page has no navy column), but it cannot make pages it was not given. Plan the slides for the system: a keynote dot-dash built from forty exhibit-with-commentary pages is a consulting deck in keynote colours. Choose each page's slide type from what it must show *and* from the system's repertoire.

`identity: { primary, accent }` takes the colours from the subject - a franchise's house colours, a brand's, a flag's - onto any system: primary and accent are darkened until they read as text, tints and a chart-series ramp are derived, and the raw accent stays bright as a chart series. A deck about a recognisable subject carries its identity; two decks in one system on different subjects then differ at a glance.

**Choosing.** Ask the user before planning a new deck: either supply a deck in the house or style they want (import it with `import-template.py`; the profile names the nearest system and why, and its colours, faces and margins override the system's), or pick a system. Show `assets/design-systems.png`, the same pages in all four, when asking. Record the choice and reason in the brief. An explicit palette, chrome or tracker on the deck still overrides the system's default.

## Palettes

Set `palette` once on the deck specification: `mckinsey` (default), `bcg`, `bain` or `deloitte`. These are brand-inspired role mappings, not official templates. They set colours and registered house treatments, including title weight, rules, heading bands and display face; these treatments can change text wrapping and available exhibit space, so each variation must be rendered. `color.componentPrimary` (`--component-primary`) resolves to `#051C2C` navy for `mckinsey`, `#0E7A5E` green for `bcg`, `#CC0000` red for `bain` and black for `deloitte`. McKinsey's primary tint is `#E6E8EA`; its bright blue stays a chart series rather than a structural primary. `--chart-comparator` (default `#D9DDE0`) is the light-grey background-evidence role for a focal comparison, independent of both the series palette and the secondary text colour. `runtime/palettes.mjs` records provenance and maps each preset onto the canonical token names, and the compiler resolves one fresh token map per deck.

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

Slide titles default to an open canvas, without a horizontal rule or a background band. Preserve the measured title-to-body clearance. A separator remains an explicit reference-derived choice; it is not added merely because a palette changes. Analytical chart headings retain their own heading/unit treatment.

## House style tokens

Each palette sets seven `style.*` keyword tokens beyond its colours; components read them through `houseStyle(id)` and a page may still ask for a specific title variant. `style.titleWeight` (`bold` | `regular`), `style.titleRule` (`none` | `rule` under the title | `band` behind it), `style.tagPlacement` (`top-right` small caps | `below-title` accent pill | `above-title` accent label), `style.chartHeading` (`text` | `band`, a filled grey band with white heading), `style.listMarker` (`dot` | `dash`), `style.tableRows` (`rules` | `zebra`), `style.labelWeight`, `style.titleLead` (`accent`: the lead in the accent before the rest; `pipe`: "Topic | statement", the BCG title) (`bold` | `regular` value labels, in the scene and the native chart). The `mckinsey` palette also sets `font.display` to a serif; `examples/house-style.deck.json` shows the same eight pages under any palette.

## Template decks and house profiles

`runtime/import-template.py template.pptx [--base mckinsey|bcg|bain|deloitte] [--out house.json]` reads a template deck and writes a house profile:

```json
{ "schema": "professional-slides.house/v1", "source": "template.pptx",
  "palette": { "base": "bcg", "id": "template", "label": "template",
               "colors": { "color.ink": "#575757", "color.componentPrimary": "#03522D", "color.accent": "#29BA74", "color.accentTint": "#E1F5EC", "color.chartSeries1": "#03522D", "…": "…", "style.titleWeight": "regular" } },
  "typography": { "body": "Arial", "display": "Arial", "semibold": { "family": "Arial", "nativeBold": true, "effectiveWeight": 700 } },
  "chrome": { "left": 66, "right": 66, "titleTop": 65, "bodyTop": 220, "footerTop": 667 },
  "footer": "Document title", "density": "executive", "complexity": "medium",
  "observations": ["Accent taken from the most used bright fill #29BA74", "Body face 'Trebuchet MS' is not installed; Arial used"],
  "stats": { "slides": 16, "medianWordsPerSlide": 113, "medianShapesPerSlide": 21.5, "charts": 4, "tables": 2, "themeColors": {}, "themeFonts": {}, "topFills": [] } }
```

How the values are chosen. Ink is the theme's `dk2` when it is a saturated brand dark (a navy, a forest green) and `dk1` otherwise; the primary is `accent1` when it is a brand dark, else the most used dark fill; the accent is the most used bright saturated fill that is not the primary (the bright green, the electric blue), else `accent2`; the chart series are the primary followed by the theme accents, greys appended; tints are the primary and accent mixed 86–88% toward white; the muted surface is `lt2` when light enough. Title weight comes from the master's title style, a title rule or band from a line or filled rectangle on the master under the title. Chrome comes from the slides' own title and body placeholders (medians, scaled to 1280 px), with cover-style titles below 35% of the page height excluded. Density: 90 words or 18 shapes per slide and up is `pre-read`, 35 words or 8 shapes is `executive`, less is `live-pitch`.

A palette may also be written by hand as `{ "base": "mckinsey", "colors": { "color.accent": "#E1251B", "style.titleRule": "none" } }`: colour tokens take `#RRGGBB`, and `style.*` and `font.*` tokens overlay the base's house style. `chrome` on the deck takes `left`, `right`, `titleTop`, `bodyTop`, `footerTop` (and optionally `sourceTop`, `footerRuleY`); the composer scales the table line budget to the body height the chrome leaves, and the page gates read the resulting content frame.

## Choose the kind of variation

A request for alternative decks normally asks for different ways to explain the evidence. Before changing palette, define each version’s reader question, narrative order, evidence hierarchy and visualization choices in the slide plan. Reuse the verified facts and scope, but rewrite, consolidate or relocate material where the new argument needs it. A decision guide, a diagnostic and a mechanism-led explanation should remain distinguishable with colour removed. Swapping chart types inside the same repeated page is not enough. Record a source-to-page map and the rationale for every material change. Review alternatives side by side, including deletion candidates and their normalized architectures.

Use cosmetic variations only when the user explicitly wants the same content restyled. The following preservation rules apply to that narrower task.

## Same-content style variations

Freeze the approved titles, claims, figures, labels, sources, notes, ordering and stage contracts before making style variations. Change deck-level palette, typography, surfaces and registered component treatments; compare authoring content and rendered text afterward so reflow cannot silently remove evidence. A palette change can change salience: categorical colours must not create an unintended highlighted cohort. When a treemap has an explicit focal item, keep other tiles neutral.

Every variant needs a fresh full-deck taste review and bound delivery record. A passing review of the original does not transfer to a new style. Inspect dense tables, stacked labels, highlighted prose, navigation and the canvas at full size. Foreground contrast is measured against the final displayed fill after focus overrides, not against the nominal series colour. Positive/negative status colouring is limited to short text or compact status icons; chart marks and their legend swatches use chart-series colours, never a status override. Choose preset accents that remain legible both as text on the page and behind white compact labels; use a quieter readable swatch when a bright brand-inspired accent fails that dual role. The BCG-inspired preset uses a darker green accent for this reason.

The exported slide background must resolve `color.canvas`; white is not an implicit substitute for a warm or dark family. Saved-file readback verifies it. Repair a failed role or exporter at its shared owner, preserve each candidate, regenerate affected variants and reassess without a score floor.

A font change can leave a single final word on the second title line. Rebalance its text frame within the existing title band while preserving the exact wording, type size, line count and left anchor; do not shorten the argument to accommodate a style.

When an alternative changes the reader task, rebuild its question, governing answer, ranked criteria and per-slide `serves` mapping before authoring. Preserve source provenance, but do not inherit a previous version’s decision contract unchanged. Verify both the coverage preflight and the rendered gates; a visual pass alone is not a complete build.

All named presets default to plain chart headings with inline units and a rule. Do not put the unit on a separate line or add a filled heading tile by switching palettes. A legacy band remains an explicit custom house-profile option only.

## Fill and weight

`fill` is `full`, `balanced` or `airy`; it follows the density when omitted. `weight` overrides individual values, then falls back to an imported house profile and the fill defaults. `runtime/weight.json` is the single numeric contract read by the composer and gates; do not copy its thresholds into a second implementation. The [evaluation reference](evaluation/index.md#corpus-calibration) records its corpus basis.

| Key | What it measures |
| --- | --- |
| `pageWords` | words in the **body** of a content page - the title band, source and notes excluded (`THIN_PAGE`) |
| `columnFill` | how far down its own track the commentary column occupies (`THIN_COLUMN`) |
| `pointWords` | mean words per point in that column, so points are findings and not labels (`POINT_DEPTH`) |
| `plotSpan` | how much of the exhibit frame the marks must span (`PLOT_SPAN`) |
| `tableFill` | how much of the page's row budget a table uses (`THIN_TABLE`) |
| `elements` | evidence elements on an analytical page; 2 on a document-weight deck (`THIN_EVIDENCE`) |


Read each gate’s reported severity. Distribution diagnostics cannot justify unsupported prose, forced highlights or empty furniture. Sparse groups follow [Design](design.md#deck-rhythm) even at full density; fit, truthful scales and blocking content checks still apply.
