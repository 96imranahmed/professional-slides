# Evidence Compositions

This file owns the composition variants used when an analytical slide contains one or more evidence sections. It does not define another narrative archetype. Choose exactly one archetype from the [slide-type router](index.md), then choose exactly one composition here. Use `single evidence field` by default when no sectioning is needed.

## Composition router

| Relationship among evidence | Composition | Typical use |
| --- | --- | --- |
| One exhibit carries the claim | Single evidence field | one chart, map, table, diagram, or calculation bridge |
| Two to four peer exhibits answer the same question at the same level | Parallel evidence field | comparable trends, segments, geographies, cohorts, scenarios, or small multiples |
| Two to four peer exhibits establish the pattern and a distinct region synthesizes the decision consequence | Parallel evidence with synthesis | coordinated charts plus an implication or investment-insight rail |
| Two or three non-peer sections build the proof through a deliberate sequence or change of analytical resolution | Progressive evidence path | mechanism to benchmark to geographic detail, market to segment to customer evidence, or category pattern to local deep dive |
| One to three values carry the quantitative claim without a meaningful trend or distribution | Single evidence field using the [metric-page profile](metric-page.md) | scale, threshold, stage, or compact progress evidence |

These modes are mutually exclusive at page level. A page cannot be both parallel and progressive: peer sections are interchangeable in reading order, while progressive sections lose meaning when reordered. A synthesis region changes a parallel field into `parallel evidence with synthesis` only when it interprets evidence already shown; if the region introduces another necessary evidence function, use a progressive path. Do not describe either composition as a second archetype.

## Universal section contract

Every section must contribute one necessary clause to the page-level action title. A section is a bounded evidence role, not a miniature slide.

Each section may contain:

- one subordinate heading that states its evidence subclaim or comparison question;
- one primary exhibit or a tightly coupled small-multiple set;
- only the labels, legend, annotation, and methodological note needed to read that exhibit;
- source markers that resolve to the page's shared source treatment.

Sections do not receive independent action titles, page numbers, footers, logos, generic takeaways, or duplicate source blocks. Use the page title for the conclusion, section headings for the supporting clauses, and the shared footer for provenance.

Before adding a section, state its contribution in one sentence. Delete it when the remaining page still proves the title, merge it when another section answers the same subquestion, and split the page when the section requires its own conclusion or creates a second storyline.

## Single evidence field

Use one uninterrupted analytical field when one exhibit is sufficient. The exhibit may contain internally coordinated marks, series, or a chart plus an attached calculation, but it should still answer one evidence question without panel navigation.

Prefer this mode by default. Do not divide the page merely because a source template contains columns or boxes.

## Parallel evidence field

Use two to four peer panels when each panel answers the same question for a different entity, measure, segment, geography, or scenario and the audience must compare the panels directly.

- Give peers equal visual weight unless one is explicitly the benchmark or focal case.
- Use one shared legend and one stable series mapping wherever the panels share categories.
- Hold plot dimensions, axis ranges, time windows, baselines, label positions, and panel-heading roles constant wherever the measures are comparable.
- Align panel headings, plot-area tops, zero baselines, and terminal values; do not align only the outer chart frames.
- Use direct labels to remove repetitive legends, but do not repeat the same legend under every panel.
- Limit the primary field to four panels. Move additional cuts to an appendix, sequence them across pages, or use a table when exact lookup is the real task.

A 2-by-2 arrangement is still one parallel field when all four panels are peers. A pair of side-by-side charts is not an argument-with-chart page merely because it has two columns.

## Parallel evidence with synthesis

Use this mode when the peer exhibits establish the facts but the audience also needs one separately visible synthesis, implication, or investment consequence.

Reserve approximately eight to nine grid columns for the evidence field and three to four columns for the synthesis region. The evidence may use two side-by-side panels, a 2-by-2 grid, or two primary sections that each contain one tightly coupled pair of small charts. The synthesis region contains one governing implication. It may include a short cohesive list only when every item supports that implication inside one continuous region; never render several independent implication cards or add another callout elsewhere on the slide. Inherit the active [terminal action-surface variant](../theming/component-bindings.md#terminal-action-surface) and [component section treatment](../components/guidelines.md).

Apply the [`visible label gate`](../components/copy.md#visible-label-gate) inside the synthesis region. Begin with the specific interpretation or action; do not add “What it means,” “Read the outliers,” “Insight,” “Synthesis,” or another generic rail heading.

Each synthesis item must connect to named evidence through a matching category colour, number, section label, or concise leader. It must state what changes for the decision rather than list values already visible in the charts. Keep the action title as the page's first read; a saturated rail must not become a competing title page.

If the synthesis region contains the mechanism required to interpret the evidence, choose the [`argument-with-chart`](argument-with-chart.md) archetype. If it only extracts the consequence of patterns that remain interpretable on their own, retain [`chart-led insight`](chart-led-insight.md).

## Progressive evidence path

Use two or three non-peer sections when the proof must move through different evidence functions or levels of resolution. Common paths include context to quantified comparison to geographic deep dive, market trend to segment economics to customer evidence, or category pattern to benchmark to localized implication.

- Give each section a distinct evidence function and preserve a deliberate reading direction.
- Use subordinate headings that form a logical sentence with the page title; avoid generic nouns such as `Market`, `Customers`, or `Competition` without a claim.
- Size sections according to the evidence they must carry rather than forcing equal widths. A text mechanism may use four columns while a chart or map uses the remaining eight; three-step paths may use `4 + 4 + 4`, `4 + 3 + 5`, or another documented grid allocation.
- Use whitespace, aligned headings, or one theme-approved separator to expose the progression. Do not box every section or add arrows when reading order is already obvious.
- Preserve one page-level conclusion. If each section produces an independent implication, convert the sequence into separate slides or an executive synthesis.

The evidence modalities may differ—text, chart, map, table, diagram, or calculation—but they must remain mutually necessary parts of the same proof. A collection of useful exhibits without a directional logic is a dashboard, not a progressive evidence path.

## Nested section decomposition

One primary section may be decomposed once when its children are true peers that answer the parent section's single subquestion. For example, a `Transformation pressure` section may contain two comparable regional charts, while a parallel `Restructuring pressure` section contains the same regional comparison.

Use no more than one nested section level in the main story. Child panels inherit the parent heading, grid, palette mapping, scale policy, and legend. Give them short comparison labels rather than another header band. If a child needs explanatory prose, a different source system, or its own implication, it has outgrown the parent section and should become another primary section or slide.

Nested decomposition does not relax the four-panel limit for the primary evidence field. Count the leaf exhibits that the audience must scan, not only the visible parent containers.

## Commercial-diligence applications

Commercial due diligence often needs denser proof because the conclusion may depend on market attractiveness, customer behavior, competitive intensity, and economics. Density is acceptable only when the sections form one argument.

Use:

- a parallel field for the same metric across segments, cohorts, regions, or competitors;
- parallel evidence with synthesis when several cuts establish one pattern and the investment implication must be explicit;
- a progressive path when the page moves from market-level evidence to segment or customer detail;
- separate slides when market, customer, competition, and economics each have independent conclusions.

Do not use the section system to compress an entire diligence workplan onto one page. A CDD slide still needs one action title, one claim, a limited evidence field, readable chart labels, and a clear source trail.

## Section geometry and styling

Set primary section boundaries on the [design grid](../design/index.md#canvas-guides-and-grid), use the [theming spacing scale](../theming/tokens.md#density-profiles), and choose the enclosing, open, or highlighted-header treatment through [component guidelines](../components/guidelines.md). The active theme owns colours, typography, rules, surfaces, and insight-region variants.

Keep peer section headers at one height and baseline. Keep peer plot areas comparable even when automatic chart frames differ. Align a text section to the visible plot area or map crop beside it, not to hidden object bounds. Use one shared content top, one source baseline, and one footer zone.

When one section uses a map or irregular silhouette, align its heading and analytical bounding region to the neighboring chart rather than stretching the map to fill arbitrary whitespace. When panels need different legends or units, place each close to its exhibit while keeping their visual hierarchy subordinate to the section headings.

## Failure modes

- naming `multi-chart` as a narrative archetype instead of selecting the slide's actual communication job;
- unrelated charts placed together because they fit a grid;
- two or more independent action titles inside one page;
- peer panels with non-comparable scales, time ranges, ordering, or colour meanings;
- a synthesis rail that repeats the title or narrates every chart;
- more than one nested decomposition level;
- card-like boxes around every section;
- section headings that identify topics but do not state evidence subclaims;
- shrinking labels or sources to preserve an overfilled page;
- a diligence dashboard that mixes market, customer, competitor, and operational claims without one governing conclusion.

## Acceptance test

Identify the selected narrative archetype and exactly one composition mode. Then hide each section in turn: every retained section must remove a necessary clause of proof when hidden. Reorder peer panels without changing meaning; a parallel field should survive, while a progressive path should not. Verify that all leaf exhibits remain readable, comparable where required, aligned to valid guides, and connected to one page-level conclusion in the final render.
