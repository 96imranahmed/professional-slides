# Insight Box

An insight box contains the slide's one detached, supported new deduction. Every instance must pass the [no-recap and new-deduction gate](copy.md#no-recap-and-new-deduction-gate). A summary of the graph, repeated title, evidence paragraph, or methodology note is never insight. Recommendations and next actions qualify only when their reason or condition expresses the deduction. Omit the box when no defensible new conclusion exists.

Default to one untitled, complete sentence that connects the conclusion to its material reason or condition. Combine a headline and its explanation when they express one thought; do not add a separate title, role label, or arrow. Follow the [natural-copy rule](copy.md#body-copy), preserving uncertainty without clipped command sequences or unnecessary padding.

Place developed explanation or additional evidence in a deliberate adjacent bullet-list section, not this component. Neither bullets nor a filled surface may shelter a recap. Plain paragraphs floating below an exhibit are not an alternative insight treatment. Dense, well-written evidence is welcome; do not compress it into unclear fragments merely to fit a box.

Use at most one insight box per slide. Never repeat it by section, column, branch, row, paragraph, metric, or chart. If several sections seem to need separate boxes, consolidate them into one governing synthesis or split the page. In a full-width layout, place the box after the evidence; do not force it onto the lower content guide when that creates a large empty gap. When a parent composition assigns a synthesis or implication rail, use that slot. Body copy uses regular weight; only an optional internal title may use the stronger heading role. Centre text by default. A full-width box may use left alignment for long, ordered, or structured content.

When the box closes the argument, it is the last substantive content on the page. Do not leave a dangling caveat, label, explanatory paragraph, or second takeaway below it. Integrate a material qualification into the relevant evidence bullet above, or into the insight sentence when it directly limits that action. Keep genuine source and footnote furniture in the footer; do not shrink substantive limitations into footnotes to hide them.

Treat surface, width, alignment, and internal structure as independent choices. Select one surface variant for the slide family, then add only the options the content requires:

- `tonal`: light component-primary accent fill with no border. Default.
- `neutral`: light grey or neutral fill with no border when the exhibit already uses component-primary as its sole focal emphasis.
- `dotted`: transparent surface with a quiet dotted outline when a filled block would feel too heavy.
- `primary`: component-primary fill with on-primary text. Reserve for the deck's decisive action or explicit stage moment.
- Full width: consume the width allocated by the parent layout.
- Left alignment: left-align structured or long full-width content; otherwise keep the default centered alignment.
- Internal header: optional internal header for a substantive grouping such as **Retention signal and expansion gate**. Do not add a production-role label.
- The optional internal header is text-only. Never add a line directly below it.

## Compact attachment to supporting text

Treat supporting paragraphs or bullets and the following insight as one content-sized group. Position the box from the measured bottom of the preceding text, using the smallest standard theme spacing token that preserves readable separation. Do not distribute the two items across the height of a rail, insert a flexible spacer, or pin the box to a lower anchor. If the rail needs vertical centering, center the combined group, preserving its compact internal gap. Keep the box’s own text padding intact; fix the external gap rather than squeezing its contents. Reject unexplained dead space between the supporting text and insight in full-size review.

## Theme contract

| Component | Consumed custom properties | Canonical source |
| --- | --- | --- |
| insight box | `--insight-box-bg`, `--insight-box-color`, `--insight-box-font`, `--insight-box-padding-x`, `--insight-box-padding-y`, `--insight-box-padding-y-multi`, `--insight-box-border`, `--insight-box-dotted-border`, `--insight-box-radius`, `--insight-box-min-height`, `--insight-box-text-align`, `--insight-box-align-items`, `--insight-box-section-gap`, `--insight-box-divider`, `--insight-box-header-font`, `--insight-box-header-color`, `--insight-box-header-gap`, `--insight-box-list-indent` | [component bindings](../theming/component-bindings.md#text-and-section-components) |

## Native translation

The shared runtime component is `insight`, with `variant: tonal | neutral | dotted | primary`, `text`, optional `align: left | center`, and optional substantive `heading`. The parent supplies its frame; use `measureContent` to reserve token-based padding and the measured text height. Overflow fails rather than shrinking type. HTML and PowerPoint consume the same measured text, palette and font bindings.

Create one editable group containing the background shape and editable text. Keep body paragraphs at regular weight; only the optional internal title uses the heading role. Filled variants have no outline. The dotted variant has no fill and uses the theme's quiet dotted boundary. Materialize an internal header as a separate text object only when it names a real content section, and never add a header underline. Keep the group vertically centered in its assigned region and preserve the selected surface and alignment across the slide family unless the content requires a deliberate exception.

## Check

Apply the opening cardinality and synthesis rules. Use one registered fill or the dotted no-fill variant. Filled variants have no border. Body text is regular; only an optional internal title is bold. Keep contrast readable and text centred by default. Left alignment requires full-width or structured content. Headers name real content. Every object remains editable.


Measurement bases, scope qualifiers and scenario assumptions use `evidence-note`, which reuses the canonical neutral surface and typography with distinct semantic roles. Supply heading, text and `semantic: {kind: "evidence-note", relatedTo: [exhibitId]}`. The referenced exhibit must exist. A generic headed paragraph does not provide containment and fails on an analytical page. Deductions continue to use insight.

## Mandatory criticality

Apply the hard [criticality gate](../design/index.md#criticality-is-a-hard-acceptance-gate). Omit optional headings that paraphrase the body. Derived comparison requirements can support the insight as a second point; do not move them to a chart callout merely to avoid the insight test.
