# Lines and Section Treatments

This file owns the component-level grammar for enclosing, separating, or heading content regions. [`Theming`](../theming/index.md) owns colour, rule, spacing, typography, shape tokens, and component bindings; [`composition`](../composition/index.md) owns page structure; [`text-box`](text-box.md) owns text-container geometry. Use the modes here to express an actual grouping or hierarchy, never to decorate an otherwise unstructured page.

## Choose one section treatment

Assign one primary treatment to each repeated slide family before authoring its pages. Peer regions at the same hierarchical level must use the same treatment, and comparable chart, table, diagram, and comparison headers must use one deck-wide analytical-header treatment. Prefer the open treatment with a quiet underline because it scales across exhibits without consuming analytical space. Different semantic roles may coexist—for example, an open analytical canvas beside a theme-defined implication rail—but do not alternate treatments among equivalent regions merely for variety.

Use the shared `section-heading` component for every peer analytical-region heading. A chart-side description and an analytical takeaway rail (`content-rail` with `treatment="open"`) share typography, colour, and one header band. Measure wrapping before layout; size the band to the tallest peer and bottom-align the text. Place each rule `space-2` below the text box, so one-line and multiline headings retain equal clearance. Reserve `space-3` after the rule before section content. The runtime token IDs are `space.2` and `space.3`. An insight rail (`content-rail` with `treatment="muted"`) keeps the shared typography without an underline.

The executable `content-rail` contract accepts `heading`, an `items` string array, `treatment` set to `open` or `muted`, and optional `dividerLeft`. The executable `section-boundary` contract accepts only `variant`: `inference`, `related`, or `subsection`. Their registered geometry and token declarations live in [`runtime/registry.mjs`](../../runtime/registry.mjs); this file owns when each variant is valid.

| Mode | Use when | Construction | Do not use when |
| --- | --- | --- | --- |
| **Boxing** | a region is a real semantic boundary, persistent side rail, implication, decision area, or peer container whose contents must be read together | enclose the region with the theme's approved fill, border, or both; derive child positions from one internal grid and padding system | whitespace and alignment already make the grouping clear, or the result would fragment the page into card-like compartments |
| **None / open** | one dominant chart, table, diagram, or argument already establishes hierarchy and the page benefits from maximum analytical space; this is the default for repeated analytical sections | use shared guides, proximity, whitespace, typography, and alignment without a visible enclosure; when a visible header boundary aids scanning, place one quiet rule directly below the header across the region width | adjacent regions could be mistaken for one group or a required semantic state would become invisible |
| **Highlighted section header** | two to four parallel sections, stages, lenses, or workstreams need prominent labels while their bodies should remain open | place one theme-derived header band above each region and keep the evidence area below unenclosed | the regions are not peers, the headings do not aid scanning, or the bands would compete with the action title |

### Boxing

Box the smallest region that represents the intended semantic boundary. A box may be a bounded panel within the analytical canvas or a full-height rail that terminates on the slide-family guides. Preserve one exterior edge, one padding system, and one named component variant across every instance.

Use the theme's neutral panel, registered primary tint, or component-primary according to the region's meaning. A saturated full-height rail is appropriate only when the theme establishes component-primary as a persistent implication treatment and the contrast supports the assigned typography roles. Do not combine a strong fill, heavy outline, shadow, rounded corners, and primary edge unless that complete construction is an inherited reference style.

Inside a box, align headings, values, bullets, icons, and dividers to the component's internal guides rather than the slide's outer guides. Equal boxes imply equal semantic weight; size a dominant recommendation or consequence differently when its narrative role is genuinely stronger.

### None / open

`None` means no visible enclosure. Use shared starts and ends, content tops, whitespace and typography to establish grouping. Keep the background continuous; faint rectangles still count as boxes. Analytical header rules follow [the shared treatment](#choose-one-section-treatment); title and footer rules follow the page template.

### Highlighted section headers

Use highlighted headers as an alternative to boxing when parallel content regions need stronger scanability but do not need enclosed bodies. The header band must align to the exact width of its region, and all peer bands must share height, text role, padding, fill role, edge geometry, and baseline.

Resolve the band from component-primary, its registered low-chroma tint, or a neutral surface; do not introduce a second accent or assign each section a different decorative colour. Maintain sufficient text contrast and keep the action title visually dominant. A rectangular, tabbed, or notched edge may be used only as a single theme-level variant repeated consistently.

Place explanatory subtitles, diagrams, charts, or lists below the band on the region's normal canvas. Do not wrap the body in an additional border unless a separately named semantic state requires boxing; a highlighted header plus a generic box usually states the same boundary twice.

The shared section heading owns heading text and its optional rule only. It has no subtitle, period, status, or right-aligned metadata slot. This applies to standalone headings, sections, and content rails; the runtime rejects `subtitle` inputs.

## Component line grammar

### Split-section relationships

For a left exhibit and right-hand interpretation, record the relationship in the plan and treatment ledger before selecting a boundary:

- **Supported inference:** use `section-boundary` with `variant="inference"`: a quiet vertical divider interrupted by a compact right-pointing disc-chevron. The left must support the right-hand conclusion; position alone does not imply causation.
- **Related context:** use `variant="related"`, a simple dashed vertical divider, or one light-grey `section` with `treatment="muted"`. Do not add an arrow for assumptions, caveats, or adjacent commentary that the exhibit does not establish.
- **Sections inside a grey panel:** reuse `section-heading` without a rule and ordinary body-text components. Put a `variant="subsection"` horizontal separator only between cohesive groups. All section and subsection headings share one heading size; all body copy shares one body size. Use spacing and separators, not shrinking fonts, to distinguish groups.

Reserve the boundary inside the inter-section gap, from the content top to the content bottom, excluding the title and footer. Divider segments stop clear of the inference marker. Use either the dashed divider or grey enclosure for context, not both. Keep the same boundary meaning across comparable slides. Arbitrary nested sections remain valid; no evidence/synthesis slot taxonomy is required.

### Line construction

Every visible component line must have exactly one job: boundary, separator, leader, or state accent. Chart axes and gridlines belong to [`charts`](../charts/index.md); diagram connectors belong to [relationship components](relationships.md); this file governs only lines that structure reusable components and content regions.

- Resolve line colour, weight, dash, and cap from the active theme; do not create slide-local line values.
- Use continuous quiet rules for ordinary separators; split-section context uses the dashed variant above. Reserve an accent line for a named state or theme-defined emphasis treatment.
- Start and end a separator on the parent component's guides. Do not leave almost-aligned rules, arbitrary overhangs, or gaps that look accidental.
- Follow the selected section treatment; header rules span the region width, and muted insight rails have no heading rule.
- Keep the same line meaning across the deck. A colour or dash used for a separator must not become a forecast, connector, or status encoding elsewhere.

## Theme inheritance and named variants

Store each selected treatment as a named theme or component variant containing its surface, outline, separator, header, padding, and text-style bindings. The component definition may bind to different tokens in light, dark, compact, or reference-derived modes, but each variant must have an explicit applicability rule. Platform adapters materialize the resolved values only when native master, layout, or theme inheritance cannot preserve them.

Detached implication regions use the active [`Insight Box`](insight-box.md) variant. Action sections and semantic states inherit their named component variant. Do not reinterpret either locally as a generic box or highlighted header.

## Acceptance check

- each visible line, box, fill, or highlighted header expresses a named grouping, hierarchy, or state;
- peer regions use one treatment and one resolved variant;
- comparable analytical headers use one deck-wide treatment, with the open underlined form preferred unless an approved theme or semantic boundary requires another mode;
- peer headings pass the shared treatment and measured-clearance contract above in both rendered outputs;
- the action title remains the first read and the dominant evidence remains clear;
- boundaries terminate on valid component or slide-family guides;
- split-section arrows express supported inferences; related context has a dashed divider or grey panel, and nested panel headings/body retain their shared sizes;
- fills, outlines, headers, padding, and text roles match the active theme after final rendering;
- no region is double-framed by a header band, fill, border, and shadow without an approved inherited reason.
