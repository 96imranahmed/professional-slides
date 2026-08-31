# Lines and Section Treatments

This file owns the component-level grammar for enclosing, separating, or heading content regions. [`Theming`](../theming/index.md) owns colour, rule, spacing, typography, shape tokens, and component bindings; [`design`](../design/index.md) owns composition; [`text-box`](text-box.md) owns text-container geometry; slide types own page composition. Use the modes here to express an actual grouping or hierarchy, never to decorate an otherwise unstructured page.

## Choose one section treatment

Assign one primary treatment to each repeated slide family before authoring its pages. Peer regions at the same hierarchical level must use the same treatment, and comparable chart, table, diagram, and comparison headers must use one deck-wide analytical-header treatment. Prefer the open treatment with a quiet underline because it scales across exhibits without consuming analytical space. Different semantic roles may coexist—for example, an open analytical canvas beside a theme-defined implication rail—but do not alternate treatments among equivalent regions merely for variety.

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

`None` means no visible section enclosure, not no structure. Establish the grouping through shared starts and ends, consistent content tops, proximity, whitespace intervals, typography roles, and a clear dominant exhibit. Keep backgrounds continuous and avoid faint rectangles that function as undeclared boxes. For repeated chart, table, diagram, and comparison headers, default to one quiet underline aligned to the full region width and use that construction consistently across the deck.

Thin rules may still perform necessary deck-level jobs such as separating the title zone, source zone, footer, or selected open analytical header, but they must not be added around the analytical content to compensate for weak alignment. Use the open underlined mode by default when a chart or diagram already provides strong internal structure.

### Highlighted section headers

Use highlighted headers as an alternative to boxing when parallel content regions need stronger scanability but do not need enclosed bodies. The header band must align to the exact width of its region, and all peer bands must share height, text role, padding, fill role, edge geometry, and baseline.

Resolve the band from component-primary, its registered low-chroma tint, or a neutral surface; do not introduce a second accent or assign each section a different decorative colour. Maintain sufficient text contrast and keep the action title visually dominant. A rectangular, tabbed, or notched edge may be used only as a single theme-level variant repeated consistently.

Place explanatory subtitles, diagrams, charts, or lists below the band on the region's normal canvas. Do not wrap the body in an additional border unless a separately named semantic state requires boxing; a highlighted header plus a generic box usually states the same boundary twice.

## Component line grammar

Every visible component line must have exactly one job: boundary, separator, leader, or state accent. Chart axes and gridlines belong to [`charts`](../charts/index.md); diagram connectors belong to the relevant [`slide type`](../slide-types/index.md); this file governs only lines that structure reusable components and content regions.

- Resolve line colour, weight, dash, and cap from the active theme; do not create slide-local line values.
- Use continuous quiet rules for ordinary boundaries and separators. Reserve an accent line for a named state or theme-defined emphasis treatment.
- Start and end a separator on the parent component's guides. Do not leave almost-aligned rules, arbitrary overhangs, or gaps that look accidental.
- Use one boundary mechanism at a time. Fill, whitespace, header band, or rule should carry the grouping; stacking all four makes the hierarchy noisy.
- Do not add short decorative strokes beneath headings. An underline is valid only as the selected open analytical-header treatment, spans the region width, and repeats for comparable chart, table, diagram, and comparison headers.
- Keep the same line meaning across the deck. A colour or dash used for a separator must not become a forecast, connector, or status encoding elsewhere.

## Theme inheritance and named variants

Store each selected treatment as a named theme or component variant containing its surface, outline, separator, header, padding, and text-style bindings. The component definition may bind to different tokens in light, dark, compact, or reference-derived modes, but each variant must have an explicit applicability rule. Platform adapters materialize the resolved values only when native master, layout, or theme inheritance cannot preserve them.

Implication regions inherit the active [`terminal action-surface variant`](../theming/component-bindings.md#terminal-action-surface). Action sections and semantic states inherit their named component variant. Do not reinterpret either locally as a generic box or highlighted header.

## Acceptance check

- each visible line, box, fill, or highlighted header expresses a named grouping, hierarchy, or state;
- peer regions use one treatment and one resolved variant;
- comparable analytical headers use one deck-wide treatment, with the open underlined form preferred unless an approved theme or semantic boundary requires another mode;
- the action title remains the first read and the dominant evidence remains clear;
- boundaries terminate on valid component or slide-family guides;
- fills, outlines, headers, padding, and text roles match the active theme after final rendering;
- removing decorative lines or boxes does not reduce comprehension because no decorative lines or boxes remain;
- no region is double-framed by a header band, fill, border, and shadow without an approved inherited reason.
