# Cross-Deck Components

This file owns recurring deck-wide furniture and its behavior. Visual tokens
belong to [`theming/`](theming/index.md); tables and chart legends belong to
[`charts/`](charts/index.md); slide-specific compositions belong to
[`slide-types/`](slide-types/index.md).

Implement recurring components through themes, masters, and layouts instead of
copying them slide by slide. They should remain secondary to the slide's claim.

## Action-title block

Use a fixed anchor, maximum width, line count, and text role across analytical
slides. The title states the insight; do not add a redundant topic label.

An optional kicker may identify the chapter. An optional subtitle may state
metric, scope, unit, or period. Neither should compete with the conclusion.

## Navigation

Use one navigation system for decks with three or more meaningful chapters:

- **Top rail:** short chapter names; active chapter uses the accent.
- **Progress line:** chapter stops on a thin line; current state is explicit.
- **Section tab:** compact fixed-corner label for long chapter names.
- **Numbered tracker:** chapter numbers when numbering aids comprehension.

Keep navigation outside the content zone, use stable chapter labels, and hide
it on title or divider slides unless the approved theme keeps it. Never imply
completion when the component only indicates position.

## Section dividers and agenda

A divider marks a real chapter boundary with the same number and label used by
navigation. Keep it sparse: chapter title plus at most one setup sentence.

Use an agenda only when deck length or delivery context makes navigation
valuable. Limit it to the real narrative chapters; never preserve template
indexes, unused sections, or authoring instructions.

## Footer and page metadata

Define fixed positions and visibility rules for page number, confidentiality,
date/version, project label, and source. Keep them visually secondary and omit
empty placeholders. Do not repeat the deck title unless it adds navigation.

## Sources

Show a concise readable source line in the footer safe zone:

> Source: Organization; dataset or report; period. Note: material caveat.

Use semicolon-separated entries or numbered markers for multiple sources.
Speaker notes or the source ledger should retain:

- full citation and URL or file;
- retrieval date;
- filters, transformations, and calculation method;
- image and license provenance;
- actual, estimate, forecast, scenario, or illustrative status.

Do not hide a decision-relevant caveat in microtext.

## Callouts and annotations

Use one grammar across the deck:

- insight: implication of nearby evidence;
- definition: necessary scope or terminology;
- caveat: limitation that changes interpretation;
- decision: approval or choice required;
- milestone: dated or gated event.

Prefer proximity and a short leader line to heavy boxes. Do not use detached
labels, speech bubbles, or decorative stickers unless required by the source
theme.

## Appendix and brand slots

Appendix pages continue the numbering system or use an explicit appendix
scheme, preserve sources, and use descriptive titles. Cross-reference them from
the main story, but do not move essential proof out of the core deck.

Define logo and organization-name slots in the master. Use only authorized
assets. Leave an unavailable logo slot empty rather than creating a pseudo-logo
or retaining source-template branding.

## Acceptance checks

- anchors and styles are consistent on every applicable slide;
- navigation matches the actual chapter and page sequence;
- footer and source areas do not collide with content;
- title, divider, and appendix visibility rules are respected;
- master components are not duplicated as slide-local overlays;
- all placeholders are filled or intentionally removed.
