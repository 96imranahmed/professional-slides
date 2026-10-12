# Design intake

How a user's decks look is a habit, not a property of one deck, so it is asked once and stored. `runtime/preferences.mjs` keeps the answers in a file outside any project (`$PROFESSIONAL_SLIDES_HOME/preferences.json`, else `$XDG_CONFIG_HOME/professional-slides/`, else `~/.professional-slides/`), with when and how each was chosen. A one-page fix or a revision of an existing deck keeps that deck's own design and asks nothing.

## 1. Read what is stored

`node runtime/preferences.mjs show` prints the stored answers, what is `missing`, and a `reuse` line. Nothing missing: tell the user the `reuse` line - what is reused, and that they can change it - and go on. The brief's own instructions still win for this deck ("make it look like our annual report").

## 2. Ask only what is missing

Ask the reader questions first (who reads the deck, what they already know, what it is for - see [Storylining](storylining.md)). Then the design questions still missing: the first alone, the rest together, each with its recommended default and its sheet from `assets/design-options/` (`options.json` there lists every option's meaning and deck keys).

| # | Question | Options | Default | Sheet |
| --- | --- | --- | --- | --- |
| 1 | Is there a deck or template in the style you want? | a PPTX or POTX (best), a PDF or screenshots, or no | no | - |
| 2 | Which look? | `consulting`, `editorial`, `journal`, `keynote` | by the occasion, below | `design-systems.png` |
| 3 | Colours: the subject's own, your brand's, or a named palette? | `subject`, `brand` (one or two hex colours), `system`, `midnight`, `evergreen`, `crimson`, `graphite` | `subject` | `palettes.png` |
| 4 | How should pages show where the reader is? | `pills`, `label`, `breadcrumb`, `number-strip`, `side-rail`, `repeat-contents`, `none`, `auto` | `auto` | `trackers.png` |
| 5 | Title treatment (no line under the title unless the user's decks set one), and filled or open surfaces? | title: `system`, `rule`, `full`, `bar`, `band`, `block`, `tab`, `none`; surfaces: `reference`, `open` | `system`; `reference` | `title-treatments.png`, `surfaces.png` |

| `design` | For | Frame |
| --- | --- | --- |
| `consulting` | boards, steering committees, diligence | white canvas, titles top-left with no rule under them, commentary beside the exhibit, numbered chapter panels |
| `editorial` | pre-reads and narratives read alone | warm paper, large serif titles, wide margins, typographic cover and chapter pages |
| `journal` | evidence-led briefings where the chart is the argument | red tab over short bold titles, the finding as a standfirst, tight margins |
| `keynote` | decks presented to a room | titles reversed out of a colour block, larger type, colour-field and picture covers |

A user who answers only some questions takes the defaults for the rest. With a structured question tool (Claude Code's `AskUserQuestion`, up to four questions a call), put the recommended option first; without one, ask in one numbered message with the defaults marked.

**A reference deck answers most of it.** A PPTX or POTX: `$RUNTIME_PYTHON runtime/import-template.py <file> --out house.json`, then `node runtime/preferences.mjs set --from-house house.json --reference <file>`; its palette, faces, margins, title rule, nearest system and density are stored as inferred; its density is the one setting here that is the deck's rather than the person's, and it carries over only from a reference deck - otherwise the storyline sets it from how this reader reads the deck. Note whether its content pages set a line under the title: only then do this deck's pages carry a `subtitle`. A PDF or screenshots: `$RUNTIME_PYTHON runtime/infer-style.py <file.pdf | page.png ...>` reads the canvas, the main colours and the title treatment off the pixels and says what it could not read. Tell the user what was inferred, then ask only what is still missing.

**A website answers the colours and the type.** `node runtime/preferences.mjs from-site <url>` reads the site's stylesheets and proposes `colours: "brand"` with `brand: { primary, accent }` and `typography: { body, display }`. Show the user what it found before storing it. A face the deck is set in is measured from its installed files (`$RUNTIME_PYTHON runtime/font-table.py --family "<face>"`); where it is not installed, the deck is set in Arial and says so.

Once the user has given colours or picked a look, `node runtime/design-options.mjs <out-dir> --design <system> --brand '#RRGGBB,#RRGGBB'` redraws the sheets in their frame for the remaining questions (it needs PowerPoint or LibreOffice, and poppler).

## 3. Store and apply

`node runtime/preferences.mjs set design=editorial colours=brand 'brand={"primary":"#0B6E4F","accent":"#F2A900"}' tracker=label` stores answers as soon as they are given; `get`, `clear [key]` and `path` read, forget and locate them. `node runtime/preferences.mjs apply <id>.pages.json` writes the deck keys the answers set into the pages file's `deck`, filling only keys the deck does not already set. The deck file is then the record of the choice.

| Answer | Deck keys |
| --- | --- |
| `design` | `design` |
| `colours: "brand"` + `brand` | `identity: { primary, accent }` |
| `colours:` a palette | `palette` |
| `colours: "subject"` | nothing: set `identity` per deck when the subject has its own colours (a brand's, a flag's) |
| `tracker`, `surfaces`, `typography` | the key of the same name (`tracker: "none"` is `false`; `auto` leaves it to the deck's `variation`) |
| `titleRule` | the palette's title-rule styles |
| `footer`, `wordmark` | `footer`, `logo` |
| a house profile | `design`, `palette`, `typography`, `chrome`, `pageTemplate`, `density`, `fill` |

`variation` on the deck (any string; `node runtime/variation.mjs` prints a fresh one) varies what the design leaves open - list markers, table rows, the tracker's style - so two decks from one brief do not look the same.
