# Cross-Page Components

This directory owns sentence-level copy, text containers, section treatments, and recurring components that appear across slides. Visual tokens and layout anchors belong to [`design/`](../design/index.md); tables and chart legends belong to [`charts/`](../charts/index.md); slide-specific compositions belong to [`slide-types/`](../slide-types/index.md).

Implement recurring components through themes, masters, and layouts instead of copying them slide by slide. They should remain secondary to the slide's claim.

## Files

- Read [`copy.md`](copy.md) for sentence contribution, element copy roles, action-title wording, direct language, anti-AI patterns, and copy QA.
- Read [`text-box.md`](text-box.md) for text-container geometry, margins, wrapping, bullets, overflow, and platform-neutral container QA.
- Read [`guidelines.md`](guidelines.md) for boxing, open layouts, highlighted section headers, component lines, panels, action sections, and named treatment variants.
- Read [`trackers/`](trackers/index.md) for tracker-system selection, contents and heading pages, subsection states, running labels, visual guides, and navigation QA.
- Continue in this index for cover and title slides, action-title blocks, sequential reveals, footers, sources, annotations, appendix behavior, and brand slots.

## Cover and title slide

The cover identifies the document; it does not summarize the analysis or prove that the work is rigorous. Start with one title, then add only the factual subtitle and quiet metadata required to identify, route, version, or file the deck. Suitable metadata includes the client or subject, audience, document type, author, date, and version when each field is genuinely useful. Use authorized branding only.

Use one clean hierarchy on one visual field. Separate necessary metadata through position, whitespace, line breaks, and type hierarchy according to the metadata copy rule in [`copy`](copy.md#metadata-and-separator-copy). Do not repeat the deck type, audience, transaction state, or subject in an eyebrow, title, subtitle, and footer.

Do not place an evidence-boundary box, assumption panel, methodology panel, decision panel, recommendation bar, source block, or analytical caveat on the cover. Put decision-relevant evidence limits on the first analytical or approach slide and preserve detailed provenance in the source ledger or speaker notes. A legal or contractual disclosure may appear only when required, using the exact approved wording and the quietest readable treatment.

Do not add an all-caps strapline, consulting-method label, short accent rule, outlined container, frame, or divider merely to make the cover look designed. An official classification such as confidentiality or draft status may appear only when it is required for document handling; use the exact required wording as secondary metadata rather than as a decorative headline. A visible line is permitted only when it belongs to an approved cover layout and separates real content regions; the default cover has no ornamental divider.

Omit the tracker, page number, source line, continuation marker, and analytical title separator by default. A source template may retain a cover element only when it is authorized, structurally meaningful, and consistent with the approved theme—not simply because it appeared in an example deck.

## Action-title block

Bind every analytical action-title block to the exact deck-level title anchor defined by [`design`](../design/index.md#canvas-guides-and-grid), with the same top-left starting point on every slide. One-line and two-line states start at identical coordinates; never shift an individual title to balance the content below it. Apply one maximum width, approved line-count variants, and one text role across analytical slides, then follow the action-title wording contract in [`copy`](copy.md#action-title-wording).

Prefer the approved one-line state and keep the registered title font size unchanged. When the title cannot remain faithful and readable on one line, use the approved two-line state: preserve the title's type role and top anchor, increase the block height, then move the title separator and every dependent content-top anchor down by the same resolved amount. Do not let the second line collide with a fixed guideline or analytical canvas.

Subtitles are optional named variants. Their permissible copy job is defined in [`copy`](copy.md#element-copy-roles); this index owns their placement and visibility within the title-block component.

## Sequential reveal and continuation states

Use sequential slides only when staged disclosure materially improves comprehension, live facilitation, or decision pacing. Do not duplicate slides merely to create animation-like movement or inflate the deck.

- Keep the slide-family guides, title position, component positions, axes, and source region fixed across the sequence.
- Preserve prior content in the same position unless the narrative explicitly replaces or corrects it. Introduce the new element through the established accent or state change.
- Use a stable continuation label such as `1/2`, `2/2` only when the pages form one analytical unit. Do not confuse continuation numbering with deck page numbers or chapter trackers.
- Preserve the action-title progression defined by [`storylining`](../storylining/index.md); a reveal may hold or advance the claim only when the storyboard specifies that state.
- Update trackers, page numbers, cross-references, and appendix references after adding or removing a reveal state.
- Inspect the sequence in order and in the montage. It should read as intentional progression rather than accidental repetition.

## Footer and page metadata

Define fixed positions and visibility rules for page number, confidentiality, date/version, project label, and source. Keep them visually secondary and omit empty placeholders. Do not repeat the deck title unless it adds navigation.

## Sources

Show a concise readable source line in the footer safe zone:

> Source: Organization; dataset or report; period. Note: material caveat.

Use semicolon-separated entries or numbered markers for multiple sources. Preserve the evidence record defined by [`storylining`](../storylining/index.md#attach-evidence-and-implication) in speaker notes or the source ledger; this component controls only its concise on-slide representation and placement.

Do not hide a decision-relevant caveat in microtext.

## Callouts and annotations

Use at most one visually distinct callout region on a slide. This single budget covers implication, recommendation, decision, caveat, warning, next step, and data-request treatments; do not stack an implication panel with a second recommendation or data-request bar. Within that budget, a call to action, recommendation, decision, next action, or data request is one terminal-action component state, so a slide may contain no more than one of those surfaces. Combine the recommendation and requested action into one continuous region when both are needed. The region must carry one governing consequence, condition, or action. Supporting phrases or bullets may sit inside the same continuous region only when they serve that one message. If the slide requires a second independent callout or terminal action, move it into the main argument, combine it under the governing message, or split the slide.

In an executive due-diligence pre-read, do not reduce the callout to a sparse slogan that repeats the title. Use the available region to connect the finding to the decision: state the governing conclusion and the material condition, evidence gap, stop trigger, or next test that follows from it. One or two compact sentences are normally sufficient. Keep the region concise enough to remain subordinate to the evidence, but complete enough to stand alone when an investment committee scans the page.

A call to action, recommendation, or decision strip uses the deck's shared action surface without a left-hand stripe, edge marker, tab, or ornamental accent. Emphasis comes from the continuous field, centered statement, contrast, and spacing. An edge-accented treatment may remain available for a theme-defined implication or annotation, but it must not be reused on the action component.

Use one grammar across the deck:

- insight: implication of nearby evidence;
- definition: necessary scope or terminology;
- caveat: limitation that changes interpretation;
- decision: approval or choice required;
- milestone: dated or gated event.

Prefer proximity and a short leader line to heavy boxes. Do not use detached labels, speech bubbles, or decorative stickers unless required by the source theme.

## Appendix and brand slots

Appendix pages continue the numbering system or use an explicit appendix scheme, preserve sources, and use descriptive titles. Cross-reference them from the main story, but do not move essential proof out of the core deck.

Define logo and organization-name slots in the master. Use only authorized assets. Leave an unavailable logo slot empty rather than creating a pseudo-logo or retaining source-template branding.

## Acceptance checks

- specialized copy, text-box, section-treatment, and tracker components pass the acceptance check in their linked owner exactly once;
- the cover contains only necessary document-identification content and has no analytical panel, decorative strapline, ornamental divider, repeated metadata, or default tracker;
- each slide has no more than one visually distinct callout region, no more than one terminal action surface, and does not stack implication, recommendation, decision, call-to-action, caveat, warning, next-step, or data-request treatments;
- sequential-reveal slides preserve fixed anchors and use coherent continuation states;
- footer and source areas do not collide with content;
- title and appendix visibility rules are respected; every analytical action title starts at the same deck-level top-left anchor, keeps the registered font size, avoids orphaned second-line words, and moves only the separator and dependent content anchors when the approved two-line state is required;
- master components are not duplicated as slide-local overlays;
- all placeholders are filled or intentionally removed.
