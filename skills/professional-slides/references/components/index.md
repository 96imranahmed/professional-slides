# Components

Components are reusable slide elements. Use them only when they perform a clear job. [`Theming`](../theming/index.md) owns their reusable visual values and [`component bindings`](../theming/component-bindings.md) define the custom-property interface each component consumes.

## Owners

- [Copy](copy.md): titles, labels, body text, and copy QA.
- [Text boxes](text-box.md): text-container geometry and overflow.
- [Insight boxes](insight-box.md): reusable slide-level insights, implications, recommendations, decisions, and actions.
- [Quote clusters](quote-cluster.md): one to five sourced statements in full-field or sectional placements.
- [Trackers](trackers/index.md): navigation.
- [Guidelines](guidelines.md): rules, borders, and section treatments.
- [Split-section boundaries](guidelines.md#split-section-relationships): inference dividers, related-context separators, and internal grey-panel sections.
- [Arrows](arrows.md): inference, transfer, handoff, and transition marks.
- [Relationship components](relationships.md): processes, roadmaps, timelines, journeys, trees, organizations, matrices, funnels, and connectors.
- [Tree-based insight and implication tables](relationships.md#tree-based-insight-and-implication-tables): branching drivers with leaf-aligned insight and implication rows.
- [Maps](maps.md): sourced editable world, regional, and country geographies with highlights and location-bound markers.
- [Icons, category images, and logos](icons-and-logos.md): semantic icons, category imagery, and brand marks.
- [Chart callouts](chart-callouts.md): evidence-linked annotations and leaders.
- [Chart titles](#chart-titles): shared graph headings, same-size units, rules, and measured title bands.
- [Chart legends](chart-legends.md): shared series, category, status, and actual/forecast keys.
- [Chart groups](chart-legends.md#coordinated-chart-groups): two to four charts with shared category mapping and one legend.
- [Analytical tables](../charts/heatmap-table.md): shared table headers, alignment, composition, and native translation.
- [Table cell status and comparison indicators](comparison-indicators.md): completion spinners, traffic-light cells, heatmap cells, and their required legends.
- [Item indicators](item-indicators.md): numbered or lettered row and category markers.
- [Metric fields](metric-fields.md): large numeric evidence.

Read only the owner needed for the component being used.

Keep semantics, inputs, theme bindings, and acceptance criteria in the component owner. Implement geometry once in the [runtime component](../../runtime/README.md#component-contract) and generate previews from its scene. Keep exact visual values in the canonical token registry.

## Action-title block

Use the canonical [title anchor and wrap rules](../design/index.md#typography-system).

The untracked analytical-header template contains an action-title slot. A tracked analytical-header template contains both a tracker-label slot and an action-title slot. Apply the selected template across its full declared range.

Titles default to `without-line`. Select `with-line` only when the design calls for a separator; place it `space-2` below the measured last text line, not the bottom of the allocated title box. Both variants retain the same text, type, colour, anchor, and allocated space. Keep the choice consistent within a slide family, and record deliberate exceptions in the treatment ledger. Neither variant adds a subtitle or metadata label.

Use `props.variant` on `action-title` or `section-title`, `chrome.titleVariant` for built-in slide titles, and `titleVariant` in content plans. A deck plan supplies the default, which an individual slide may explicitly override. All routes consume the same title renderer. Unknown variants and conflicting legacy `rule` values are rejected; every registered variant has an isolated HTML/PPTX fixture.

These are hierarchy levels of one title family, not separate visual designs. Likewise, `section` owns the surface, padding and child-content area, while `section-heading` owns its reusable heading leaf. Keep container and leaf tests distinct; group them together in the golden gallery.

## Deck cover

Keep the cover title very short: name the document or topic rather than placing the recommendation or argument on the cover. A succinct subtitle states the deck’s scope or purpose, such as “Market performance and prospects”. Do not turn it into a thesis summary, evidence-date inventory, price snapshot or methodology paragraph. Put the recommendation in the executive summary and provenance in the relevant evidence pages or notes. Prefer one line per field; the renderer's two-line capacity is a fit limit, not a writing target.

Use the shared `cover` component in [`runtime/registry.mjs`](../../runtime/registry.mjs) for a plain deck title and optional subtitle. It inherits the deck canvas, display and body fonts, ink and secondary-text colours, the deck-title size, and the standard body size for the subtitle. Both lines share the page's left guide; the measured block is vertically centred with `space.5` between title and subtitle.

Do not add default decoration, branding, rules, dates, or footer copy. The plain variant accepts `title` and `subtitle`, freezes measured line breaks for both adapters, and rejects copy exceeding two lines per field instead of shrinking it. Select `half-image` with a sourced `image` when place, product or subject imagery earns half the cover. The left half retains the short title and subtitle; the right contains the prepared image without distortion. Prepare a crop matching that half if it must fill the field. Both variants are tested in the golden set.

## Section dividers

Use `section-divider` with one `title`, such as “Section A”; it has no subtitle, number label, or orientation copy. The measured title is vertically centred on the page's left guide and inherits `font.display` and `type.deckTitle`.

Set `mode` to `dark` (default: ink background, on-primary text) or `light` (canvas background, ink text). Title contrast must reach 4.5:1. Page furniture remains owned by `pageTemplate`; its `none`, `bottom`, and `top-and-bottom` rule options work in both modes. All six combinations have isolated golden fixtures. Optional company name, page number and sources use the shared footer; nothing is added implicitly. These replacement dividers are tested in the golden set, not against the retired labelled reference divider.

## Chart titles

`chart-title` is registered in [`runtime/registry.mjs`](../../runtime/registry.mjs). Graph headings share the section-heading font, colour, level, rule spacing, and measured wrapping. Inputs are `heading`, optional `unit`, and optional `variant`; `headerBandHeight` aligns wrapped peers in a coordinated group.

- `underlined` is the default. Its rule sits `space.2` below the complete measured title band. Retain it over charts, including headings with units. A neighbouring non-chart region does not inherit this rule; use an unruled heading or no heading when appropriate.
- `unit` is the explicit borderless alternative and requires nonempty unit text. Use it only when the chart's peer regions are also borderless.

Keep a short unit such as `$B`, `%`, or `index` on the same line as the heading, preceded by a comma. The unit remains a separate editable text object at exactly the heading's font size, with regular weight and `color.chartUnit`; hierarchy comes from weight and colour, not a smaller unit. Shorten the heading first. Only when the measured heading and unit still cannot fit does the component place the unit on a second line at the same size with `space.1` clearance. Put a material period or population in the heading when it remains concise, for example `Q2 2026 reported-to-normalized income bridge, $B`; do not overload the unit with `$B, Q2 2026`.

The component consumes the section-heading tokens plus `color.chartUnit` and `space.1`. It rejects empty or multi-line units and an allocated frame shorter than its measured content. Charts with `heading`/`unit` props and chart groups invoke this same owner; neither creates a local header or automatic period/status label. Both variants have isolated golden fixtures, including inline-unit and measured stacked-fallback coverage, in HTML and PowerPoint.

## Callouts and annotations

Use a callout only when it adds evidence, interpretation, or a decision that the exhibit does not already communicate. Use the reusable [`insight box`](insight-box.md) for a detached slide-level synthesis surface.

The [`insight box`](insight-box.md#check) owns the one-per-slide detached-synthesis limit and permitted states; consumers link to that check.

Apply the canonical [rhetorical-role label rule](copy.md#labels) to every callout.

## Sources and footers

Page furniture belongs to the deck's page template, implemented by [`page-template.mjs`](../../runtime/page-template.mjs) and consumed by slide chrome and the content planner. Default to no header or footer rule. The `bottom` variant adds a rule above the footer; `top-and-bottom` also adds a top-page rule. These choices are independent of title and chart-heading underlines.

`page-template` renders furniture only. `slide-chrome` composes it with the shared action title; it does not define another furniture style.

Place sources at bottom left on the same baseline as the page number. Place the company name immediately left of the bottom-right number, or use the top-right brand slot with an [authorized logo component](icons-and-logos.md#entity-logos). Reserve the logo's width before measuring the title. Never repeat the company in both slots automatically or fabricate a logo when only a name is available.

Measure the left citation slot after reserving the company and number. Wrapped sources extend upward; notes sit above them, and the body frame contracts accordingly. Never overlap, shrink, or silently truncate footer copy. Keep a separate source row only for an explicitly selected reference treatment. The standalone source component also defaults to no rule. Runtime settings and inheritance are documented under [page templates](../../runtime/README.md#page-templates).

Keep page numbers, sources, confidentiality marks, and approved brand elements in stable positions. The visible source line names the publisher or company, document or dataset, and relevant date or period. Give every material claim, chart series, quotation, and calculation a stable source ID in the authoring source; map derived values to their input IDs and label them `analyst calculation`. Put full URLs, document identifiers, page or table references, access dates, and calculation notes in speaker notes or a source appendix. The rendered footer must remain readable, while the editable artifact must preserve the complete claim-to-source mapping.

Do not use the footer as a second title, implication strip, or decorative rail.

## Sequential states

When a component repeats across slides, define its states once and change only the data or active state. Keep geometry, labels, and semantics stable.

## Check

- Every component has a clear audience job.
- Repeated components use one shared definition.
- Components do not compete with the title or dominant exhibit.
- Labels and colours carry real meaning.
- Deleting decoration does not weaken the slide.
