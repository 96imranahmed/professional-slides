# Cross-Deck Components

Components establish continuity across the deck. Implement recurring components
through themes, masters, and layouts rather than copying them slide by slide.
Keep them quiet enough that the slide's claim remains dominant.

## 1. Action-title block

Required on analytical slides.

- Fixed x/y anchor and maximum width across the deck.
- One or two lines; never allow accidental wrapping beyond the title zone.
- Sentence case by default.
- Optional small chapter kicker above the title only when it improves
  navigation.
- Optional exhibit subtitle below, limited to metric, scope, unit, and period.

The title states the insight. Do not add a redundant page topic label.

## 2. Section tracker

A tracker shows the audience where they are in the narrative. Use it for decks
with three or more meaningful chapters, especially long pre-reads.

### Variants

- **Top rail:** short chapter names across the top edge; active chapter uses the
  accent and inactive chapters use muted rules/text.
- **Progress line:** thin line with chapter stops; active stop and completed
  segment highlighted.
- **Section tab:** compact active chapter label in a fixed corner; best when
  chapter names are too long for a full rail.
- **Numbered slider:** chapter numbers aligned on a line, with the current
  number emphasized; use only when numbering helps the narrative.

### Rules

- Keep the tracker outside the main content zone.
- Use short, stable chapter labels.
- Update it through the relevant layout or master state.
- Do not combine multiple tracker variants in one deck.
- Hide it on title, divider, and full-bleed slides unless the reference theme
  explicitly keeps it.
- Use progress semantics honestly; do not imply completion when the tracker
  merely shows navigation.

## 3. Section divider

Use a divider to create a deliberate rhythm between major chapters.

- Show chapter number and a claim-oriented chapter title.
- Add one short setup sentence only when it creates the question the next
  section answers.
- Use the dark-canvas theme variant when established.
- Keep the page sparse; do not turn it into an executive-summary slide.
- Use the same section order and label as the tracker.

## 4. Agenda or table of contents

Include only when the deck length, presentation context, or user request makes
navigation valuable. An agenda should reflect the narrative, not a generic
template index.

- Limit to three to six chapters.
- Use descriptive chapter names.
- Optionally highlight the current chapter on section re-entry for long decks.
- Do not include template categories, authoring instructions, or unused
  sections from a source library.

## 5. Footer rail

The footer may contain page number, confidentiality, date/version, organization
or project label, and source. Define exact positions and visibility rules.

- Keep metadata visually secondary.
- Use a consistent page number format.
- Omit page number on the title slide unless required.
- Do not repeat the deck title if it adds no navigational value.
- Never leave unresolved placeholders such as "Date", "Footer", or "Slide
  Number" in the exported file.

## 6. Sources

Use a concise visible source line and fuller notes-based provenance.

Visible form:

> Source: Organization; dataset/report title; period. Note: material caveat.

For multiple sources, use semicolon-separated entries or numbered source
markers. Keep the text readable and within the footer safe zone. Do not hide an
important methodology caveat in illegibly small source text.

Speaker notes or a source ledger should capture:

- full citation and URL/file;
- retrieval date;
- data filters and transformations;
- calculation method;
- image/license provenance;
- whether the value is actual, estimate, forecast, scenario, or illustrative.

## 7. Callouts and annotations

Use one callout grammar throughout the deck.

- **Insight callout:** the implication of nearby evidence.
- **Definition:** a necessary term or scope clarification.
- **Caveat:** a limitation that materially changes interpretation.
- **Decision marker:** the choice or approval required.
- **Milestone marker:** a dated or gated event on a timeline.

Use position, leader lines, and a controlled accent before using boxes. Avoid
speech bubbles, stickers, and decorative labels unless the reference theme
requires them.

## 8. Legends and keys

- Prefer direct labels for one or two series.
- Use a legend only when it reduces clutter.
- Keep series order in the legend identical to visual order.
- Define icon, status, line, and fill semantics once.
- Do not use color swatches with unexplained meanings.

## 9. Tables

Treat tables as components with defined states:

- header;
- body;
- subtotal/total;
- comparison or selected column;
- variance or status;
- note/footnote.

Use alignment, whitespace, and thin rules before fills. Right-align numbers,
align decimals when material, left-align descriptive text, and apply consistent
units. Avoid repeating units in every cell when a column heading can carry
them.

## 10. Appendix system

Appendix slides must remain usable and traceable.

- Use an appendix divider and optional subsections.
- Continue page numbers or use an explicit appendix numbering scheme.
- Use descriptive titles and preserve sources.
- Cross-reference appendix pages from the main story when they support a claim.
- Keep methodology, sensitivity, detailed tables, glossary, and source details
  here, but never move essential proof out of the main story.

## 11. Brand placeholders

Define logo and organization-name slots in the master. Use authentic assets
only. If no approved logo is available, leave the slot empty; do not create a
pseudo-logo or retain source-template branding.

## Component acceptance checks

- same anchors and styles on every applicable slide;
- active section state matches actual chapter;
- no orphaned or duplicated tracker labels;
- no footer collisions with body content;
- page numbers increment correctly;
- source text remains readable;
- master/layout components are not duplicated as slide-local overlays;
- dark and light variants use the correct colors and contrast;
- all placeholders are filled or removed intentionally.
