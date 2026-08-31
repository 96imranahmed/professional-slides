# Components

Components are reusable slide elements. Use them only when they perform a clear job. [`Theming`](../theming/index.md) owns their reusable visual values and [`component bindings`](../theming/component-bindings.md) define the custom-property interface each specimen should consume.

## Owners

- [Copy](copy.md): titles, labels, body text, and copy QA.
- [Text boxes](text-box.md): text-container geometry and overflow.
- [Trackers](trackers/index.md): navigation.
- [Guidelines](guidelines.md): rules, borders, and section treatments.
- [Icons and logos](icons-and-logos.md): semantic icons and brand marks.
- [Chart callouts](chart-callouts.md): evidence-linked annotations and leaders.
- [Comparison indicators](comparison-indicators.md): scores and state indicators.
- [Metric fields](metric-fields.md): large numeric evidence.

Read only the owner needed for the component being used.

When adding or revising an inline specimen, include its variables, HTML, and CSS in the owning Markdown file using the [HTML and CSS contract](../theming/html-css-contract.md). Keep exact palette, type, spacing, line, radius, and shadow values in the canonical token registry rather than copying them into the component.

## Action-title block

Every analytical slide uses the same title anchor, width, and type role. One-line and two-line titles share the same top-left starting point. When a title wraps, move the title separator and every dependent content-top anchor down together.

The untracked analytical-header template contains an action-title slot. A tracked analytical-header template contains both a tracker-label slot and an action-title slot. Apply the selected template across its full declared range.

## Callouts and annotations

Use a callout only when it adds evidence, interpretation, or a decision that the exhibit does not already communicate.

A slide may have no more than one terminal action surface. Recommendation, implication, decision, next action, and data request are alternative states of that same component.

Do not prepend labels such as `IC conclusion`, `Recommendation`, or `Key takeaway` when the statement already explains its role.

## Sources and footers

Keep page numbers, sources, confidentiality marks, and approved brand elements in stable positions. Sources must be readable in the final render and traceable to the claim.

Do not use the footer as a second title, implication strip, or decorative rail.

## Sequential states

When a component repeats across slides, define its states once and change only the data or active state. Keep geometry, labels, and semantics stable.

## Check

- Every component has a clear audience job.
- Repeated components use one shared definition.
- Components do not compete with the title or dominant exhibit.
- Labels and colours carry real meaning.
- Deleting decoration does not weaken the slide.
