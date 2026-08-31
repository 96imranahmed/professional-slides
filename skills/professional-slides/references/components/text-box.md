# Text Boxes

This file owns text-container geometry and behavior. [`Theming`](../theming/index.md) owns typography and spacing tokens, [`design`](../design/index.md) owns composition, and [`copy`](copy.md) owns the words placed inside each container. Every text box inherits its visual and paragraph defaults from the active slide theme, including the applicable master, layout, placeholder, and component definition; this file does not create a parallel text style.

Every text box must have a declared typography role, parent region, internal margins, alignment, wrapping policy, maximum line expectation, and overflow response. Resolve those properties through theme inheritance first. A slide-local override is permitted only when the content has a distinct semantic role that the theme does not represent, and the exception must be named and reused rather than tuned by eye.

## Container contract

- Start from the nearest theme-provided text style or component variant. Inherit its font family, size, weight, color, line height, paragraph spacing, fill, border, margins, and alignment; do not restate inherited values on individual slides.
- Apply one declared [`theming` typography role](../theming/tokens.md#primitive-and-role-tokens) to the complete container. When native inheritance is unavailable, resolve that role from the active theme once at the adapter boundary rather than substituting a slide-local value.
- Align the container to a deck, slide-family, or component guide, then standardize its internal margins. Do not align visible glyphs with spaces, tabs, empty paragraphs, or transparent characters.
- Use top vertical alignment for most analytical text. Use middle alignment only for compact labels, values, buttons, or symmetric callouts whose height is intentionally fixed.
- Set line height and paragraph spacing from the design system. Do not use blank lines to simulate paragraph or group spacing.
- Define wrapping deliberately. A wrapped bullet aligns to the start of its text, not the bullet glyph; a wrapped heading keeps the same role and line height rather than shrinking locally.
- Keep action titles to the approved line-count variant without changing the registered title font size. First edit the title and use its full approved width to preserve one line. If a faithful title still requires two lines, wrap at a meaningful phrase boundary and slightly earlier when that prevents a lone orphaned word; never leave a single short word stranded on the second line merely because the box can technically fit it. Set a content limit appropriate to each body component instead of relying on autofit to compress unlimited text.
- Treat clipping, autofit, and shrink-to-fit as diagnostic signals rather than default solutions. Shorten the copy, enlarge the valid region, select another component, or split the slide.
- Inspect text after final font substitution and native rendering because equal box coordinates do not guarantee equal visible baselines.

## Internal spacing

Use the active theme's spacing tokens rather than local values. The table declares semantic token bindings, not fixed measurements; resolve each named token from the theme in force for the deck.

| Text container | Theme spacing binding | Notes |
| --- | --- | --- |
| bare text box | `space-0` to `space-1` | use only when the box sits directly on a page guide and the platform does not require a safety inset |
| compact label or value | `space-2` horizontal; `space-1` vertical | keep the label visually attached to its value or marker |
| callout or annotation | `space-4` horizontal; `space-3` vertical | allow room for a leader line, icon, or semantic accent |
| standard panel or card | `space-4` on all sides | increase to `space-5` for a sparse executive panel |
| action or recommendation panel | `space-5` horizontal; `space-4` vertical | preserve hierarchy among heading, action, owner, and timing |
| footer or source box | `space-0` horizontal; `space-1` vertical | align to the reserved source or footer region rather than adding a decorative container |

The active theme or an approved reference may bind these component roles to different tokens. Preserve the inherited binding across every instance instead of normalizing it to this table or adding a local inset. External gap belongs to the parent layout; internal padding belongs to the component.

## Recommendation and decision panels

Center the primary recommendation or decision statement horizontally and vertically within a bounded recommendation panel or shallow decision strip. This centered treatment is the default because the region represents one decisive message rather than an evidence paragraph. Preserve the action-title hierarchy and use the active action-panel spacing binding.

Place the terminal recommendation, decision, implication, next-action, or data-request surface after the evidence in the audience's reading order and anchor it to the lower content guide by default. In analytical pre-reads, a full-width action surface directly below the title incorrectly makes the consequence precede its proof and consumes the most valuable exhibit space. Permit a top-anchored exception only when an approved source template establishes it or a live reveal intentionally states the decision before unveiling evidence; register that exception for the complete slide family.

Use at most one terminal action surface per slide. “Call to action,” “recommendation,” “decision,” “next action,” and “data request” are mutually exclusive states of this same component, not separate boxes that may be stacked. When a slide contains both a recommendation and its requested action, combine them into one continuous panel with one governing sentence or cohesive statement. Put supporting rationale in the analytical body; split the slide only when the audience truly must make two independent decisions.

Do not add a left-hand stripe, side rail, edge marker, tab, or decorative accent to a call-to-action, recommendation, or decision panel. Use one uninterrupted surface and derive emphasis from the registered fill, text contrast, centered alignment, and internal spacing.

Do not reserve a separate label column, heading row, badge, kicker, or eyebrow inside a terminal action surface merely to name its role. The recommendation, implication, conclusion, decision, or action sentence occupies the full usable width of the surface. Add a compact field label only when several fields must be distinguished for execution, such as `Owner`, `Due`, `Trigger`, or named scenario states; the field must carry information that cannot be inferred from position or sentence grammar.

For executive due-diligence pre-reads, the centered statement should usually include both the recommended action and the condition or evidence test that governs it. Do not leave a wide decision strip visually empty around a short slogan or repeat the action title verbatim. Prefer one or two compact sentences that remain legible at the registered body or callout role; if the necessary content becomes a list or multi-part workplan, switch to the explicit left-aligned exception below.

Use left alignment only when the panel contains an ordered action list, several independently scannable fields, or sufficiently long supporting text that centering would impair reading. Do not center a multi-row action table, rationale column, owner list, or evidence block. Apply the chosen exception to the complete named component variant rather than changing alignment slide by slide.

## Bullets and lists

- Keep bullet indent, hanging indent, bullet-to-text gap, nesting depth, and paragraph spacing consistent within a component family.
- Use one bullet level whenever possible. A second level is acceptable only for a real subordinate relationship; move deeper detail to the appendix.
- Use theme spacing tokens between bullets and larger tokens between groups. Do not insert blank bullets as spacers.
- If a list requires a smaller type role or more than two nesting levels to fit, rewrite it, split the slide, or choose another slide type.
- Apply the parallel-language and sentence-contribution rules in [`copy`](copy.md); do not solve a copy problem through indentation or compression.

## Platform boundary

Use native theme, master, layout, placeholder, and component inheritance wherever the selected platform exposes it. When an adapter cannot preserve or express an inherited property, materialize the resolved theme value through one centralized fallback shared by every matching container; never introduce slide-local literals. Platform-specific operations belong in [`tools`](../tools/index.md), not here.

## Acceptance check

Compare the inherited theme source, declared container properties, final-platform readback, and rendering. Reject any unexplained local override or mutation in role, font, color, fill, border, guide, margin, alignment, line or paragraph spacing, wrap, indent, baseline, overflow, or autofit behavior. Confirm that each slide has at most one terminal action surface; bounded recommendation and decision statements are centered unless their registered component variant meets the explicit left-alignment exception, contain enough decision context for their document type, have no left-hand stripe or ornamental edge accent, and contain no redundant role label or reserved label column.
