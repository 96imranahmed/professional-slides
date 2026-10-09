# Theming

Every reusable visual value lives in the theme. Components consume named tokens; slides consume components.

## Design systems

A palette changes colour; a design system changes the page. Two decks on unrelated subjects built in one frame - the same cover, chapter panels, title position, commentary rail and takeaway band - read as one deck in two colours, whatever their charts. Set `design` once on the deck; `runtime/design-systems.mjs` owns the values.

| `design` | Reader and occasion | Frame | Page repertoire to plan for |
| --- | --- | --- | --- |
| `consulting` (default) | steering committees, boards, diligence | white canvas, sans titles top-left over a thin grey rule margin to margin, commentary rail right, tinted takeaway band, dark cover, numbered chapter panels | exhibit with commentary, tables with treatments, metrics strips, trackers |
| `editorial` | pre-reads, strategy narratives and essays read alone | warm paper, large regular serif titles over a hairline run edge to edge, wide margins, commentary left of the exhibit, the takeaway as a serif close over a hairline, typographic cover and chapter pages, panels opened | text pages that carry an argument, a photograph beside prose (`picture` form `picture-hero`), quotations (`statement` form `quotes`), fewer and larger exhibits, statement pages between parts |
| `journal` | evidence-led briefings where the chart is the argument | red tab over short bold sans titles, the finding as a standfirst under the title, tight margins, zebra tables, no tinted boxes, masthead cover | full-width annotated charts with commentary in columns beneath (commentary `below`), small multiples (`panels` form `grid`), metrics over an exhibit (`numbers` form `metric-strip`), record tables |
| `keynote` | decks presented to a room, launches, pitches | titles reversed out of a colour block, larger type, the takeaway as a statement with an accent bar, colour-field cover and chapter pages, full-bleed picture covers | one idea a page: hero numbers (`numbers` form `hero-number`), metrics over an exhibit, two-up comparisons (`options` form `two-up`), statement and picture pages, sparse text |

The system biases the layout chooser toward its repertoire and translates the author's panel tones into its grammar (an editorial page has no navy column), but it cannot make pages it was not given. Plan the slides for the system: a keynote dot-dash built from forty exhibit-with-commentary pages is a consulting deck in keynote colours. Choose each page's type and form from what it must show *and* from the system's repertoire.

`identity: { primary, accent }` takes the colours from the subject - a franchise's house colours, a brand's, a flag's - onto any system: primary and accent are darkened until they read as text, tints and a chart-series ramp are derived, and the raw accent stays bright as a chart series. A deck about a recognisable subject carries its identity; two decks in one system on different subjects then differ at a glance.

**Variation between runs.** Two runs of one brief should not produce the same deck. `variation` on the deck (any string; a new deck takes a fresh one from `runtime/variation.mjs`) draws reproducibly from what the system leaves open: list markers, table rows, the tracker, the contents page, how lead-in points are marked, two shapes the chooser leans toward and its tie-break order. Page structure is chosen page by page through [page types](page-types.md); the variation varies the styling those choices leave open. A contents style the variation draws is set only where the deck's sections fit it (columns hold two to six), and the list otherwise; a style the deck names itself (`agendaStyle`) that cannot hold its sections is refused where the deck is authored (`CONTENTS_UNFIT`).

**The draw and the plan.** The same script names two featured page types from the system's repertoire, and `--plan` reads the draw. Among forms that carry a page's claim equally well it prefers a form a featured entry names (`plan.prefersForms`, `prefersKinds` in the script's output), then the deck's own hand: for each reading task the seed draws an order of the kinds that can carry it best (`plan.hand` prints the tasks that leave a choice, lead mark first), and a page takes the mark whose turn it is - so one deck is mostly one mark for one task, and two decks planned from one spine lead with different marks on the pages whose claim leaves a choice, and differ only there ([Which form carries which claim](design.md#which-form-carries-which-claim)).

Few repertoire entries name a form that competes with another of equal fit - a strip against a hero number, bars in cells against a heat map, small multiples against six lines on one scale, a bullet against a bar. The system frames the page and the claim chooses the exhibit, so the seed, not the system, carries the difference between two plans: on the decks this was measured on, two systems under one seed drew the same mix of exhibit kinds and differed in the form of one to four pages in a hundred. A system is not given a preferred mark among equals beyond those entries, and the look is not drawn by the seed: the occasions in the table above are different occasions, not equals, and the look is the user's stored answer - two decks for one user are in one system by design, and what tells them apart is the hand.

**Choosing.** The system is chosen in the [design intake](#design-intake) before a new deck is planned, never by silent default. Record the choice and reason in the brief. An explicit palette, chrome or tracker on the deck still overrides the system's default.

## Design intake

How a user's decks look is a habit, not a property of one deck, so it is asked once per user and stored: `runtime/preferences.mjs` keeps the answers in a file outside any project (`$PROFESSIONAL_SLIDES_HOME/preferences.json`, else `$XDG_CONFIG_HOME/professional-slides/`, else `~/.professional-slides/`), with when and how each was chosen (`asked`, `inferred` from a reference deck, or a `default` accepted) and a reference deck recorded only as a hash of its path. Where the sandbox blocks the home directory it falls back to `.professional-slides/` in the working directory and says so (`location`, `locationReason` in its output); set `$PROFESSIONAL_SLIDES_HOME` to choose the place.

**1. Read what is stored.** Before planning a new deck run `node runtime/preferences.mjs show`: it prints the stored answers, `missing` (the questions still to ask), `unset` (each answer not yet given, with the default the question would recommend - nothing is applied for it), the `deckKeys` the stored answers set and a `reuse` line. Where the host keeps its own memory of the user (Claude Code's memory files, a Codex memory, a project instruction file), read that too; an answer found only there is stored with `set` before asking anything. Nothing missing: tell the user the `reuse` line - what was reused and that they can change it - and go on. The brief's own instructions still win for this deck ("make it look like our annual report") and are not stored unless the user says to.

**2. Ask only what is missing: question 1 first, then the rest together.** When question 1 is missing, ask it alone first - a reference deck answers most of the others. Then ask whatever is still missing together, in this order, at most five more questions, each with its recommended default marked and a note that any answer can be changed later. Show each question's sheet from `assets/design-options/` beside it; `options.json` there lists every tile's label, meaning and deck keys.

| # | Question | Options | Default | Show |
| --- | --- | --- | --- | --- |
| 1 | Is there a deck or template in the style you want? PPTX or POTX is best; a PDF or screenshots also work. | a file, or no | no | - |
| 2 | Which look? | `consulting`, `editorial`, `journal`, `keynote` | by the occasion in the table above: `consulting` for a board, steering committee or diligence paper; `editorial` for a pre-read read alone; `journal` for an evidence-led briefing; `keynote` for a deck presented to a room. `consulting` where the brief does not say | `design-systems.png` |
| 3 | Colours: the subject's own, your brand's, or a named palette? | `subject` (each deck takes its subject's identity colours when it has recognisable ones, else the system's), `brand` (give one or two hex colours, and a logo wordmark if wanted), `system`, `midnight`, `evergreen`, `crimson`, `graphite` | `subject` | `palettes.png` |
| 4 | How should pages show where the reader is? | `pills`, `label`, `breadcrumb`, `number-strip`, `repeat-contents` (the contents page again before each section), `none`, or `auto` (each deck's variation draws label, breadcrumb or number strip) | `auto` | `trackers.png` |
| 5 | Title treatment, and filled or open surfaces? | title: `system`, `rule`, `full`, `bar`, `band`, `block`, `tab`, `none`; surfaces: `reference`, `open` | `system`; `reference` | `title-treatments.png`, `surfaces.png` |
| 6 | Who reads it, and how? | `live-pitch`: presented to a room, one idea a page, about 40 body words or fewer (each page's word floor is a quarter of its reading task's); `executive`: presented or sent, about 95 to 120 body words a page with commentary beside the evidence; `pre-read`: read alone, 120 body words a page and up | `executive` | - |

Close the message with one optional line: fonts (only faces installed on the machine), a footer line reused on every deck (a confidentiality marking, the firm's name) and a cover wordmark. A user who answers only some questions takes the defaults for the rest; store those with `--source default`.

**A reference deck answers most of it.** If question 1 gets a file, stop and infer before asking anything else. A PPTX or POTX: `python3 runtime/import-template.py <file> --out house.json`, then `node runtime/preferences.mjs set --from-house house.json --reference <file>`; the house profile's palette, faces, margins, title rule, nearest system and density are stored as `inferred`. A PDF or screenshots: `python3 runtime/infer-style.py <file.pdf | page.png ...>` reads the canvas, the most used colours (suggested as brand primary and accent) and the title treatment off the pixels, and names what it could not read (`notInferred`). Tell the user in two or three lines what was inferred and from what evidence, then ask only the questions still missing (usually the tracker and density), with the same sheets.

**A website answers the colours and the type.** Where the user points at a brand's site, or the deck is about a company whose look it should take: `node runtime/preferences.mjs from-site <url>` reads the page's stylesheets and proposes `colours: "brand"` with `brand: { primary, accent }` - the most used dark colour and the most used mid-tone, greys passed over - and `typography: { body, display }`, the face the running text is set in and the face the headings take, with the line that stores them as `inferred`. Show the user what it found before setting it. A face the deck is set in is measured from its installed files: `python3 runtime/font-table.py --family "<face>"` writes its widths to the user's fonts folder, where the runtime reads them; where the face is not installed, installing it is the user's to do, and until then the deck is set in Arial and says so.

**Hosts.** Show the sheet images with the questions: attach or open them where the host can, else give their paths.

- *A structured question tool* (Claude Code's `AskUserQuestion`: up to four questions a call, two to four options each, "Other" always offered): question 1 in its own call, then the remaining questions in one or two calls. Put the recommended option first, marked as recommended, with the option's meaning and the sheet's path in its description or preview. A question with more options than the tool takes lists the likeliest three beside the default and names the rest in the question text, answerable through "Other".
- *No such tool* (Codex, a plain chat): question 1 in one short message, then one numbered message with the rest, the defaults marked and the sheets attached or linked.

Never block on the intake for a one-page fix or an existing-deck revision; those keep the deck's own design.

**Regenerate in the user's frame.** The stored sheets are drawn on the consulting system in its own colours. Once the user has given brand colours or picked a system, `node runtime/design-options.mjs <out-dir> --design <system> --brand '#RRGGBB,#RRGGBB' [--wordmark "Name"] [--only trackers,title-treatments]` rebuilds the sheets through the real pipeline (it needs LibreOffice), so the remaining questions are answered on their own pages.

**3. Store the answers** as soon as the user gives them: `node runtime/preferences.mjs set design=editorial colours=brand 'brand={"primary":"#0B6E4F","accent":"#F2A900"}' tracker=label titleRule=system surfaces=reference density=pre-read` (JSON values, or bare strings). In a host with memory, also save a one-line note that design preferences live in that file, if the host's conventions allow a note of that kind. `get`, `clear [key]` and `path` read, forget and locate them.

**4. Carry them into the deck.** `node runtime/preferences.mjs apply <id>.pages.json` writes the deck keys into the pages file's `deck` (or a deck spec's top level), filling only keys the deck does not already set, and prints the `reuse` line. Each answer sets exactly these deck keys:

| Answer | Deck keys |
| --- | --- |
| `design` | `design` |
| `colours: "brand"` + `brand` | `identity: { primary, accent }` |
| `colours:` a palette name | `palette: "<name>"` on `consulting`; on another system `palette: { base, colors }` with the palette's `color.*` roles over the system's frame |
| `colours: "subject"` or `"system"` | nothing; the author sets `identity` per deck when the subject has colours |
| `titleRule` | `palette.colors`: `style.titleRule`, `style.titleRuleLength`, `style.titleRuleColor` (and `line.titleRule: 4` for `bar`); `system` sets nothing |
| `tracker` | `tracker` (`none` is `false`; `auto` sets nothing, so the variation draws one) |
| `surfaces` | `surfaces` |
| `density` | `density`; the fill follows (`live-pitch` airy, `executive` balanced, `pre-read` full), and so do the word floors (`live-pitch` a quarter of each reading task's lower quartile) |
| `typography` | `typography` (a body face other than Arial takes a bold semibold mapping) |
| `footer`, `wordmark` | `footer`, `logo` (the cover wordmark) |
| `house` (inferred) | `design`, `palette`, `typography`, `chrome`, `pageTemplate`, `density`, `fill`, `weight` from the house profile |

The deck file is then the record of the choice: a later change to the preferences does not rewrite a deck already planned.

## Palettes

Set `palette` once on the deck specification: `midnight` (default), `evergreen`, `crimson` or `graphite`. They are named role mappings. They set colours and registered house treatments, including title weight, rules, heading bands and display face; these treatments can change text wrapping and available exhibit space, so each variation must be rendered. `color.componentPrimary` (`--component-primary`) resolves to `#051C2C` navy for `midnight`, `#0E7A5E` green for `evergreen`, `#CC0000` red for `crimson` and black for `graphite`. The `midnight` preset's primary tint is `#E6E8EA`; its bright blue stays a chart series rather than a structural primary. `--chart-comparator` (default `#D9DDE0`) is the light-grey background-evidence role for a focal comparison, independent of both the series palette and the secondary text colour. `runtime/palettes.mjs` maps each preset onto the canonical token names, and the compiler resolves one fresh token map per deck.

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

This section owns density. The deck sets one `density`, and with it one body size for every page: a page type refuses `density` on a page, no preset sets it, and structural and tracker pages take `executive` unless the deck sets another. Appendix pages are set at `appendix`. A chart's mark count may step its own labels down one size; nothing else on the page shrinks. When content does not fit, change the page, not its type size: remove duplication, enlarge the exhibit, choose another form, split the page or move it to the appendix. Measure the content at its allocated width.

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

## The title band

A content page's header is, top to bottom: the tracker (or kicker), the action title, an optional standfirst, the rule that closes the band, then the body. Three strong analytical pages in four close the title band with a rule or a band, most with a thin rule margin to margin or edge to edge and some with a short accent bar, so the house draws one by default: `consulting` and the `midnight`, `crimson` and `graphite` palettes a thin rule, `editorial` a hairline across the page, `evergreen` a short accent bar. `journal` keeps its red tab and `keynote` its colour block, which already close the band.

The rule sits at a fixed height, one gap above the body, and the title and its standfirst are set down on it: a one-line title drops to meet the rule instead of leaving it stranded under 50px of air, and the body starts at the same height whether the title took one line or two. Only a band too tall for that - two title lines and a standfirst - pushes the rule and the body down together. The standfirst (`subtitle` on the page) is set in body type and the secondary colour between the title and the rule; see [page types](page-types.md#the-standfirst).

A title that wraps is balanced: it is set at the narrowest width that keeps its line count, so its lines run to about the same length and the last is never one to three stranded words. The PPTX title placeholder takes the same width and a soft line break where the render broke, so PowerPoint's own metrics cannot move a word back; an author's own line break is kept as written. Analytical chart headings retain their own heading/unit treatment.

## House style tokens

Each palette sets its `style.*` keyword tokens beyond its colours; components read them through `houseStyle(id)` and a page may still ask for a specific title variant.

| Token | Values |
| --- | --- |
| `style.titleWeight` | `bold` \| `regular` |
| `style.titleRule` | `none` \| `rule` closing the title band \| `band` behind it \| `block` reversed out of the primary \| `tab` in the accent at the top edge |
| `style.titleRuleLength` | `content` margin to margin \| `full` page edge to edge \| `short` a 64px bar under the title |
| `style.titleRuleColor` | `rule` \| `ink` \| `accent` \| `primary`: a palette role, so a subject's identity recolours an accent bar |
| `line.titleRule`, `layout.titleRuleGap` | the rule's weight in px (1 for a hairline, 3 to 4 for a bar) and the air on either side of it (12px) |
| `style.tagPlacement` | `top-right` small caps \| `below-title` accent pill \| `above-title` accent label |
| `style.chartHeading` | `text` \| `band`, a filled grey band with white heading |
| `style.listMarker`, `style.tableRows` | `dot` \| `dash`; `rules` \| `zebra` |
| `style.labelWeight` | `bold` \| `regular` value labels, in the scene and the native chart |
| `style.titleLead` | `accent`: the lead in the accent before the rest; `pipe`: "Topic \| statement", the `evergreen` title |

The `midnight` palette also sets `font.display` to a serif; `examples/house-style.deck.json` shows the same eight pages under any palette. The display face sets titles only: data figures - metric and fact values, divider, agenda and closing numerals - are set in the body face, bold, with lining numerals, since a serif's old-style figures sit at uneven heights and descend below the line.

## Surface treatments

A page drawn as type on the canvas with hairlines reads light at a glance however many words it carries: a table set as text on the page colour, white cards outlined on a cream page, one thin line across an empty plot, roadmap dots on a rail. Five `style.*` tokens set how much of a page's structure is filled surface, and their defaults are the weight of a well-made analytical page:

| Token | Reference (default) | Open |
| --- | --- | --- |
| `style.tableHeader` | `band`: the header a filled band in the ink, reversed type | `rule`: bold type over a rule |
| `style.tableLabels` | `tint`: a row-label column on `color.surfaceTint` | `plain` |
| `style.cards` | `tint`: cards, quotation boxes and quadrants filled, no outline | `outline`: hairline cards on the canvas |
| `style.marks` | `reference`: lines at `line.medium` with 12px markers, a light area under a lone line (never under two or more), dumbbell dots a quarter larger on alternate row bands, map land and a cycle's hub on the filled surface | `light` |
| `style.timeline` | `blocks`: each roadmap stage headed by a filled chevron on a heavier spine | `dots` |

`color.surfaceTint` is the palette's ink mixed 86% toward its canvas (`resolvePalette` derives it unless a palette sets it): about 30 grey levels under a white or cream page, a warm stone on paper and a cool grey under navy. Type on a fill keeps its role colour only where it still reads at 4.5:1 (`readableOn` in `core.mjs`), else it takes the ink.

The two sets are named in `design-systems.mjs`. Every system takes `reference`; the journal keeps its character with plain label columns and outlined cards. `surfaces: "open"` on the deck takes the light set, and a single token in the palette overrides one treatment. A table can opt out alone with `headerBand: false` or `labelColumn: false`. `SCENE_INK` and `DECK_INK` ([evaluation](evaluation/index.md#ink-estimate)) estimate the result at authoring.

## Template decks and house profiles

`runtime/import-template.py template.pptx [--base midnight|evergreen|crimson|graphite] [--out house.json]` reads a template deck and writes a house profile:

```json
{ "schema": "professional-slides.house/v1", "source": "template.pptx",
  "palette": { "base": "evergreen", "id": "template", "label": "template",
               "colors": { "color.ink": "#575757", "color.componentPrimary": "#03522D", "color.accent": "#29BA74", "color.accentTint": "#E1F5EC", "color.chartSeries1": "#03522D", "…": "…", "style.titleWeight": "regular" } },
  "typography": { "body": "Arial", "display": "Arial", "semibold": { "family": "Arial", "nativeBold": true, "effectiveWeight": 700 } },
  "chrome": { "left": 66, "right": 66, "titleTop": 65, "bodyTop": 220, "footerTop": 667 },
  "footer": "Document title", "density": "executive", "complexity": "medium",
  "observations": ["Accent taken from the most used bright fill #29BA74", "Body face 'Trebuchet MS' is not installed; Arial used"],
  "stats": { "slides": 16, "medianWordsPerSlide": 113, "medianShapesPerSlide": 21.5, "charts": 4, "tables": 2, "themeColors": {}, "themeFonts": {}, "topFills": [] } }
```

How the values are chosen. Ink is the theme's `dk2` when it is a saturated brand dark (a navy, a forest green) and `dk1` otherwise; the primary is `accent1` when it is a brand dark, else the most used dark fill; the accent is the most used bright saturated fill that is not the primary (the bright green, the electric blue), else `accent2`; the chart series are the primary followed by the theme accents, greys appended; tints are the primary and accent mixed 86–88% toward white; the muted surface is `lt2` when light enough. Title weight comes from the master's title style, a title rule or band from a line or filled rectangle on the master under the title (a line across 95% of the page is a `full` rule, a shorter one `content`); a master with neither sets `style.titleRule: "none"`, so the page stays open as the template draws it. Chrome comes from the slides' own title and body placeholders (medians, scaled to 1280 px), with cover-style titles below 35% of the page height excluded. Density: 90 words or 18 shapes per slide and up is `pre-read`, 35 words or 8 shapes is `executive`, less is `live-pitch`.

A palette may also be written by hand as `{ "base": "midnight", "colors": { "color.accent": "#E1251B", "style.titleRule": "none" } }`: colour tokens take `#RRGGBB`, `style.*` and `font.*` tokens overlay the base's house style, and `line.*` and `layout.*` take pixels (`"line.titleRule": 2, "layout.titleRuleGap": 16`). `chrome` on the deck takes `left`, `right`, `titleTop`, `bodyTop`, `footerTop` (and optionally `sourceTop`, `footerRuleY`); the composer scales the table line budget to the body height the chrome leaves, and the page gates read the resulting content frame.

## Choose the kind of variation

A request for alternative decks normally asks for different ways to explain the evidence. Before changing palette, define each version’s reader question, narrative order, evidence hierarchy and page types in its own pages file. Reuse the verified facts and scope, but rewrite, consolidate or relocate material where the new argument needs it. A decision guide, a diagnostic and a mechanism-led explanation should remain distinguishable with colour removed. Swapping chart types inside the same repeated page is not enough. Record a source-to-page map and the rationale for every material change. Review alternatives side by side, including deletion candidates and their normalized architectures.

Use cosmetic variations only when the user explicitly wants the same content restyled. The following preservation rules apply to that narrower task.

## Same-content style variations

Freeze the approved titles, claims, figures, labels, sources, notes, ordering and stage contracts before making style variations. Change deck-level palette, typography, surfaces and registered component treatments; compare authoring content and rendered text afterward so reflow cannot silently remove evidence. A palette change can change salience: categorical colours must not create an unintended highlighted cohort. When a treemap has an explicit focal item, keep other tiles neutral.

Every variant needs a fresh full-deck taste review and bound delivery record. A passing review of the original does not transfer to a new style. Inspect dense tables, stacked labels, highlighted prose, navigation and the canvas at full size. Foreground contrast is measured against the final displayed fill after focus overrides, not against the nominal series colour. Status colour follows [one rule](design.md#status-colour): chart marks and their legend swatches keep chart-series colours in every variant. Choose preset accents that remain legible both as text on the page and behind white compact labels; use a quieter readable swatch when a bright accent fails that dual role. The evergreen preset uses a darker green accent for this reason.

The exported slide background must resolve `color.canvas`; white is not an implicit substitute for a warm or dark family. Saved-file readback verifies it. Repair a failed role or exporter at its shared owner, preserve each candidate, regenerate affected variants and reassess without a score floor.

A font change can change where a title wraps. The title is rebalanced at build time (the balanced break above) with its wording, type size, line count and left anchor kept; do not shorten the argument to accommodate a style.

When an alternative changes the reader task, rebuild its question, governing answer, ranked criteria and per-slide `serves` mapping before authoring. Preserve source provenance, but do not inherit a previous version’s decision contract unchanged. Verify both the coverage preflight and the rendered gates; a visual pass alone is not a complete build.

All named presets default to plain chart headings with inline units and a rule. Do not put the unit on a separate line or add a filled heading tile by switching palettes. A legacy band remains an explicit custom house-profile option only.

## Fill and weight

`fill` is `full`, `balanced` or `airy`; it follows the density when omitted. `weight` overrides individual values, then falls back to an imported house profile and the fill defaults. `runtime/weight.json` is the single numeric contract read by the composer and gates; do not copy its thresholds into a second implementation. The [evaluation reference](evaluation/index.md#target-calibration) sets out the targets behind it.

| Key | What it measures |
| --- | --- |
| `pageWords` | words in the **body** of a content page - the title band, source and notes excluded (`THIN_PAGE`) |
| `columnFill` | how far down its own track the commentary column occupies (`THIN_COLUMN`) |
| `pointWords` | mean words per point in that column, so points are findings and not labels (`POINT_DEPTH`) |
| `plotSpan` | how much of the exhibit frame the marks must span (`PLOT_SPAN`) |
| `tableFill` | how much of the page's row budget a table uses (`THIN_TABLE`) |
| `elements` | evidence elements on an analytical page; 2 on a document-weight deck (`THIN_EVIDENCE`) |


Read each gate’s reported severity. Distribution diagnostics cannot justify unsupported prose, forced highlights or empty furniture. Sparse groups follow [Design](design.md#space-type-and-boundaries) even at full density; fit, truthful scales and blocking content checks still apply.
