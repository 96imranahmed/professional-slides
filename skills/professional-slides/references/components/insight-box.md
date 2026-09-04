# Insight Box

An insight box is the slide's one detached synthesis surface. It may state an insight, implication, recommendation, decision, condition, or next action that the evidence does not already communicate. It is not a chart annotation, evidence paragraph, decorative footer strip, or container for several unrelated points.

Use at most one insight box per slide. Never repeat it by section, column, branch, row, paragraph, metric, or chart. If several sections seem to need separate boxes, consolidate them into one governing synthesis or split the page. In a full-width layout, place the box after the evidence and normally near the lower content guide. When a parent composition assigns a synthesis or implication rail, use that slot. Body copy uses regular weight; only an optional internal title may use the stronger heading role. Centre text by default. A full-width box may use left alignment for long, ordered, or structured content.

Treat surface, width, alignment, and internal structure as independent choices. Select one surface variant for the slide family, then add only the options the content requires:

- `tonal`: light component-primary accent fill with no border. Default.
- `neutral`: light grey or neutral fill with no border when the primary tint would compete with the exhibit.
- `dotted`: transparent surface with a quiet dotted outline when a filled block would feel too heavy.
- `primary`: component-primary fill with on-primary text. Reserve for the deck's decisive action or explicit stage moment.
- `data-width="full"`: consume the width allocated by the parent layout.
- `data-align="left"`: left-align structured or long full-width content; otherwise keep the default centered alignment.
- `.insight-box__header`: optional internal header for a substantive grouping such as **Retention signal and expansion gate**. Do not add a production-role label.
- The optional internal header is text-only. Never add a line directly below it.
- `data-divider="between-sections"`: optional internal divider between two cohesive content sections. Do not use dividers as decoration or to collect unrelated points.
- `data-content="multi-paragraph"`: increase the top and bottom padding when two or more paragraphs or sections need a calmer vertical frame.

## Theme contract

| Component | Consumed custom properties | Canonical source |
| --- | --- | --- |
| insight box | `--insight-box-bg`, `--insight-box-color`, `--insight-box-font`, `--insight-box-padding-x`, `--insight-box-padding-y`, `--insight-box-padding-y-multi`, `--insight-box-border`, `--insight-box-dotted-border`, `--insight-box-radius`, `--insight-box-min-height`, `--insight-box-text-align`, `--insight-box-align-items`, `--insight-box-section-gap`, `--insight-box-divider`, `--insight-box-header-font`, `--insight-box-header-color`, `--insight-box-header-gap`, `--insight-box-list-indent` | [component bindings](../theming/component-bindings.md#text-and-section-components) |

## Structural HTML specimens

Each root isolates one reusable construction. The wrapper exists only to render the component at slide scale; the component itself does not own external position or width.

### Tonal, full width, centered

~~~html
<main class="deck" data-theme="executive-light" data-density="executive"><section class="insight-box-specimen" aria-label="Tonal full-width insight box"><aside class="insight-box" data-variant="tonal" data-width="full">Proceed only after week-eight retention stays above 55% for three cohorts.</aside></section></main>
~~~

### Neutral, full width, left aligned, with header

~~~html
<main class="deck" data-theme="executive-light" data-density="executive"><section class="insight-box-specimen" aria-label="Neutral full-width insight box with header"><aside class="insight-box" data-variant="neutral" data-width="full" data-align="left"><h2 class="insight-box__header">Retention signal and expansion gate</h2><ul class="insight-box__body"><li>Week-eight retention improved in three consecutive cohorts.</li><li>The latest cohort reached 58%, above the 55% gate.</li><li>Expand only while contribution margin remains above 30%.</li></ul></aside></section></main>
~~~

### Dotted outline, no background

~~~html
<main class="deck" data-theme="warm-editorial" data-density="executive"><section class="insight-box-specimen" aria-label="Dotted outline insight box"><aside class="insight-box" data-variant="dotted">Twenty qualified accounts support one market pilot; fund rollout only after five convert.</aside></section></main>
~~~

### Tonal with an internal divider

~~~html
<main class="deck" data-theme="executive-light" data-density="executive"><section class="insight-box-specimen" aria-label="Tonal insight box with internal divider"><aside class="insight-box" data-variant="tonal" data-content="multi-paragraph" data-divider="between-sections"><section class="insight-box__section">There is capacity to serve approximately 45 additional accounts within the current operating model.</section><section class="insight-box__section">At current economics, that capacity represents approximately $60 million of addressable value.</section></aside></section></main>
~~~

### Primary decisive action

~~~html
<main class="deck" data-theme="executive-dark" data-density="executive"><section class="insight-box-specimen" aria-label="Primary insight box"><aside class="insight-box" data-variant="primary">Approve stage two after every workstream has one owner, one control, and one weekly measure.</aside></section></main>
~~~

~~~css
.insight-box-specimen{box-sizing:border-box;width:var(--slide-width);height:var(--slide-height);display:grid;place-items:center;padding:var(--slide-margin-block) var(--slide-margin-inline);background:var(--canvas);color:var(--ink)}.insight-box-specimen>.insight-box:not([data-width="full"]){width:66.666%}
.insight-box{--insight-box-bg:var(--surface-action);--insight-box-color:var(--ink);--insight-box-font:var(--weight-regular) var(--size-callout)/var(--line-callout) var(--font-sans);--insight-box-padding-x:var(--space-5);--insight-box-padding-y:var(--space-4);--insight-box-padding-y-multi:var(--space-6);--insight-box-border:0;--insight-box-dotted-border:var(--line-hairline) dotted var(--page-guideline);--insight-box-radius:var(--component-radius);--insight-box-min-height:var(--space-9);--insight-box-text-align:center;--insight-box-align-items:center;--insight-box-section-gap:var(--space-3);--insight-box-divider:var(--rule-quiet);--insight-box-header-font:var(--type-section-heading);--insight-box-header-color:var(--component-primary);--insight-box-header-gap:var(--space-2);--insight-box-list-indent:var(--space-5);box-sizing:border-box;display:flex;flex-direction:column;align-items:var(--insight-box-align-items);justify-content:center;gap:var(--insight-box-section-gap);max-width:100%;min-height:var(--insight-box-min-height);padding:var(--insight-box-padding-y) var(--insight-box-padding-x);background:var(--insight-box-bg);color:var(--insight-box-color);border:var(--insight-box-border);border-radius:var(--insight-box-radius);font:var(--insight-box-font);text-align:var(--insight-box-text-align)}
.insight-box[data-variant="neutral"]{--insight-box-bg:var(--surface-1)}.insight-box[data-variant="dotted"]{--insight-box-bg:transparent;--insight-box-border:var(--insight-box-dotted-border)}.insight-box[data-variant="primary"]{--insight-box-bg:var(--component-primary);--insight-box-color:var(--on-primary);--insight-box-header-color:var(--on-primary)}.insight-box[data-width="full"]{width:100%}.insight-box[data-align="left"]{--insight-box-text-align:left;--insight-box-align-items:stretch}
.insight-box[data-content="multi-paragraph"]{--insight-box-padding-y:var(--insight-box-padding-y-multi)}
.insight-box__header,.insight-box__body,.insight-box__section{margin:0}.insight-box__header{width:100%;padding-bottom:var(--insight-box-header-gap);font:var(--insight-box-header-font);color:var(--insight-box-header-color)}.insight-box__body{width:100%}.insight-box ul.insight-box__body{padding-left:var(--insight-box-list-indent)}.insight-box__section{width:100%}.insight-box[data-divider="between-sections"] .insight-box__section+.insight-box__section{padding-top:var(--insight-box-section-gap);border-top:var(--insight-box-divider)}
~~~

## Native translation

Create one editable group containing the background shape and editable text. Keep body paragraphs at regular weight; only the optional internal title uses the heading role. Filled variants have no outline. The dotted variant has no fill and uses the theme's quiet dotted boundary. Materialize an internal header as a separate text object only when it names a real content section, and never add a header underline. Materialize a divider only between two content sections, not above the first or below the last. Increase symmetric top and bottom padding for multi-paragraph or multi-section content. Keep the group vertically centered in its assigned region and preserve the selected surface and alignment across the slide family unless the content requires a deliberate exception.

## Check

Verify the statement adds distinct synthesis and does not duplicate the evidence. Use one registered fill or the dotted no-fill variant. Filled variants have no border. Body text is regular; only an optional internal title is bold. Keep contrast readable and text centred by default. Left alignment requires full-width or structured content. Multi-paragraph content needs symmetric vertical padding. Headers name real content. Dividers separate cohesive sections. Every object remains editable.
