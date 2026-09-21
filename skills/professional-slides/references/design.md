# Design

Design makes the argument easier to see. Use the fewest visual rules that give the deck one voice.

## The numbers

- Canvas 1280 x 720 px (16:9). At the adapter boundary, 96 px = 1 in and 1 px = 0.75 pt.
- Outer margins 60 px on all sides.
- 12-column grid: 82 px columns, 16 px gutters. The grid is a guide for alignment, not a quota to fill.
- Action title 24 pt, at most two lines, anchored at the same x and y on every analytical page. One-line and two-line titles start at the same point; dependent content moves down when the title wraps. The right 20% of the title band is reserved for a tracker label or sticker.
- Section and exhibit headings 14-16 pt. Body 12-14 pt. Chart furniture - axis ticks, direct labels, legend rows - 9-10 pt. Source and footnotes 8 pt.
- A hero exhibit occupies at least 40% of the content area on an analytical page.
- Repeated layouts follow comparable reading tasks; review repetitive runs in context.
- Trailing empty band below the content: 8% or less of the content area.
- Spacing comes from the registered scale (`space.1` to `space.6`). Related objects align to common edges and baselines; padding, row rhythm and gaps stay constant within a component family.

Title, source, footer, page number and navigation are registered components. The page shell allocates them once and passes the remaining body frame to the composition.

## Allocate evidence before geometry

Count the real categories, rows, stages, comparison fields and words before assigning boxes. Then choose the composition from the reading task:

| Reading task | Composition |
| --- | --- |
| Compare several options on common criteria | One analytical table or repeated evidence group with a stable schema. Keep lever, benefit basis, horizon, dependency and status in distinct columns. |
| Explain why the selected option works | A developed mechanism, driver decomposition or dependency exhibit. |
| Compare magnitudes or changes | A chart with the relevant comparator on a common basis; a table when precise lookup across mixed fields is the job. |
| Relate evidence at two levels | A composite with one dominant field and a clearly subordinate decomposition. Allocate width by the labels and proof each field needs. |
| Show timing or sequence | A relationship component with explicit stage labels and dependencies. Unequal duration needs a real time scale; ordinal positions encode order only. |
| Compare several measures for the same entities | A shared-row exhibit with quantitative marks and exact-value columns, one entity order, denominators attached to their measures. |
| Reconcile reported, adjusted and potential results | An aligned reconciliation with current value, adjustment, result and basis; a bridge when the movements reconcile. |
| Test hypotheses across a portfolio | Nested family and hypothesis rows with assessment and visible supporting evidence. |
| Coordinate dates, deliverables and decision bodies | Shared time columns with distinct workstream or governance lanes, so same-week coordination stays visible. |
| Show a range of uncertain outcomes | Comparable scenarios or supported range bands with their bases attached. |

For comparable options, draft all rows before deciding the page count. Split a long exhibit at a meaningful boundary and repeat its schema, column widths and units. Give a source row its own page when that row has a distinct developed argument.

Resolve capacity with the actual longest labels and fullest rows, measured at the allocated width. When a component does not fit: remove duplicate copy, rebalance widths, regroup the evidence, or select a denser density profile for the whole family. Content keeps its qualifiers and its readable type.

## Deck rhythm

Keep palette, type, anchors and component grammar constant while choosing page structures for different questions. Repetition is right for comparable markets, periods or options that share a scale. A long run of the same silhouette for different questions means the pages inherited a layout before their argument was developed.

Record a short structure description per page - dominant encoding, shared comparison axis or entity key, nesting, how supporting evidence attaches - and review them together before export. Repeated descriptions need a comparability reason.

Match container height to content: size the container to the measured group and place that group deliberately in the field. Open card grids centre as one group with natural gaps; do not centre each row in a separate oversized slot. A sole list on a text or executive-summary page centres as one measured group in its body track. A list beneath a metric strip or followed by other content stays attached to that content. A coloured surface should not dominate a few short lines. Remove duplicate qualifying boxes before adding more furniture.

## Sections, rules and boundaries

Region width communicates weight: equal tracks imply peers, a narrow track implies support. Use the quietest boundary that makes the relationship legible - whitespace, then a rule, then a surface change.

Choose one treatment per repeated slide family:

- **Open** (default for analytical regions): shared guides, proximity, alignment and typography, with one quiet rule under a header when scanning needs it.
- **Boxed**: enclose the smallest region that is a real semantic boundary - a persistent rail, an implication, a decision area. One exterior edge, one padding system, one named variant across instances.
- **Highlighted header**: a theme-derived band above each of two to four peer regions, bodies left open. Peer bands share height, text role, padding, fill and baseline.

Chart headings keep their rule; non-chart headings use it only when substantial content needs separating. Place a heading rule `space.2` below the measured last text line and reserve `space.3` after it. Give every visible line exactly one job: boundary, separator, leader or state accent.

For a left exhibit and right interpretation, record the relationship first: a supported inference uses the inference boundary variant, adjacent context uses a dashed divider or a muted panel. Use marked inference arrows only where the authored relationship requires one; their frequency is not a quota. A child region is not a miniature slide: it has no second action title, footer, page number or source system.

## One heading owner per exhibit

The slide title states the page's conclusion. Each distinct chart gets one heading naming its measure and unit. Tables and non-chart exhibits normally need no extra heading; retain one only when it identifies a distinct comparison that the title and column labels do not identify. A section wrapping a single chart stays untitled and lets the chart own its heading, unit and rule. A parent heading earns its place when it groups several genuinely distinct child exhibits; the children then name only their own measures.

Every supporting item has a visible relationship to its evidence: keyed annotations on the chart for observations about particular points, and a deliberately allocated section beneath or beside the exhibit for developed explanation. Attach qualifications to the evidence they qualify.

Horizontally centre a chart's visible plot and category field within its own section, accounting for occupied axis labels, so an unused value-axis gutter does not push a sparse chart right.

## Colour

Colour carries meaning. Resolve the whole palette from the theme: `component-primary`, neutral surfaces, text roles, rules, status roles and `chart-series-1` through `chart-series-6`.

One identical component-primary swatch serves tracker emphasis, structural highlights and primary actions. Titles use their registered text colour, normally ink. Chart-series colours stay in charts. Status colours encode a defined measure and always carry a second, non-colour cue.

Body and compact text reach at least 4.5:1 contrast against their surface; large display text and essential graphical boundaries reach 3:1.

Check embedded charts against their actual row surface, including totals. Keep
the series colour; use a contrasting boundary when its fill merges into a band,
and give the value label the row's readable foreground.

## Typography

Use the registered roles: cover title, action title, section title, body, compact body, label, source. Keep the title role at one size across a slide family. Prefer one line; when two are needed, wrap at a meaningful phrase and avoid a lone final word.

Distinguish an orienting label from a claim. "Investments" identifies a track; a conclusion-bearing heading states what the evidence says. Express nesting through spacing, indentation and weight before adding colour or surfaces. Use bold inline emphasis for the decision-changing phrase or value, keeping the whole sentence and its qualification in one paragraph.

Page furniture - titles, trackers, source lines, page numbers - keeps the deck's base typography across density profiles, so a larger schedule label does not enlarge its title or footer.

## Images and icons

Use an image or icon when it improves meaning or recognition: a place, a product, a physical quality, a stable taxonomy. Keep one visual style and prefer editable vectors and real library icons. Resolve names against the available library before authoring, then verify the rendered glyph; an initial-letter fallback does not satisfy an intended icon. Apply the chosen treatment to every peer in a set. Evidence of safety, quality or performance comes from data, and illustrative imagery sits beside it rather than standing in for it.

## Visual review

Read the title sequence, then every rendered spread, then full-size pages wherever detail is uncertain. Distribution measurements describe the reference corpus; they do not prescribe a quota of charts, annotations, colours, photographs, icons, words or layouts. Do not add content or furniture to hit those distributions. Keep the same construction when the comparison job is the same.

Check in this order:

1. **Argument and evidence.** Reconcile every count in a title, repeated recommendation, denominator, total and duration with its actual members and inputs. A box containing two films counts as two films. Cross-check the opening answer, body and close, including every condition and exception. A reversal condition must affect the actual recommended work or option. Selected examples do not establish universal claims; an observed association does not establish causality.
2. **Focus.** Identify what the title asks the reader to compare. Every tint, coloured mark and highlighted phrase must support that exact comparison. Neutral is valid. A coherent set may contain several highlighted marks; never infer a focus from the largest value, the first title match or the neighbouring slide.
3. **Table grammar.** Choose the category axis positively during planning: distinct event types, error classes or award classes use filled category cells with white labels, including one-row categories. Follow the [category contract](charts.md#category-and-verdict-semantics); individual records and repeated attributes such as DC / DC / Marvel / Marvel remain plain. Unordered categories do not get sequence numbers. Explicit good/bad verdicts may use positive/negative colours on short text labels or check/cross icons only (for example Cleared in green and Missed in red). Chart marks and backgrounds retain house palette colours, including charts whose series describe good/bad outcomes. Keep the words or symbols; identity and subjective preference do not imply a status. Parallel dimensions use dimension headers. A plain verdict is joined to the table with continuous row fills. Add a gutter only for an explicitly chosen inference arrow. A table-wide arrow sits at the centre of the evidence body, independent of row emphasis; per-row arrows are a separate explicit variant. Chevron headers have no underline. Number pills use one consistent size and only explicitly selected count columns. Harvey balls and heat scales require a defined rubric.
4. **Heading ownership.** The action title states the claim. Each chart has one descriptive heading and its default underline; a slide subtitle does not suppress that heading. A subtitle is optional: remove it when it repeats the chart heading in meaning, even with different words. Keep each measure, population, period and unit in one appropriate place; preserve unique scope in the chart heading or source note. Tables and non-chart exhibits need no extra exhibit title by default; their slide action title and column labels carry the hierarchy. An established unruled house style may be retained as a deck-wide exception. Keep peer heading rules aligned.
5. **Evidence qualifiers.** Use `evidenceStatus` for Judgement, Estimate or other evidence states: it occupies the shared subtitle band in the same typography on every applicable page. Qualify mixed evidence locally. Generic `tag` is page metadata governed by the house style, not a substitute for an evidence state. Do not add ad hoc text above the action title or move its anchor.
6. **Commentary and spacing.** Commentary is optional. Retain only consequences, caveats, mechanisms or decisions the exhibit cannot show. Centre a sparse unheaded group vertically as one measured block, including at full density; keep natural gaps between its items. Align headed peer sections at their headings. During planning, consider a bottom insight when a developed page leaves its decision consequence buried and has a clear closing band; use a concise consequence, not a repeat of its title or body. Do not stretch bullets or invent a KPI to fill a column. Remove duplicate callouts and closing strips.
7. **Relationships.** Arrows imply direction or inference. Chevron stages imply progression; use rectangular headers for parallel alternatives. Rules must separate actual fields. Surfaces must enclose an actual group.
8. **Whole-deck consistency.** Compare common title anchors, evidence-state treatments, header grammar, number formatting, row rhythm and recurring families. A change of unit or explicit column alignment must not change unrelated table styling. Inserting an unrelated slide must not change focus, arrow semantics or table treatment on its neighbours.

The review may find a substantive thin page even when counts pass. Its repair is a better argument, appropriate consolidation or a better use of space, not a decorative quota. Whitespace, exhibit-area and label-count measurements are advisory: a compact process or centered group can be complete, and a chart may communicate through a readable axis and selected value anchors. The visual reviewer still rejects visibly poor balance. Preserve text fit, collisions, clipping, truthful scales and content completeness as blocking checks.

## Working from a reference deck

When a reference is authorized, render and inspect the full deck, identify its layouts, anchors, typography, spacing, colours, tables, charts and recurring components, separate deliberate rules from one-off exceptions, and reuse the closest valid structure. Before redesigning a source page, record its strongest device, evidence payload, heading hierarchy, focal emphasis and normalized readable type size, then map those onto the proposed page and compare the two at equal viewing size. A modern theme may change colour, spacing and styling while keeping the evidence relationships at least as easy to read.

## Cross-slide check

Review the montage first, then every slide at full size:

- title and content anchors;
- type size and wrapping;
- colour roles;
- table and chart grammar;
- repeated component states;
- repeated structures retained for comparable jobs, and structural changes justified by a different evidence relationship;
- deck rhythm, including repetitive runs and oversized containers;
- clipping, overlap, broken assets, dead space;
- tracker pages carrying the complete approved item set, with one selected state per governed page;
- object fills, lines and text colours resolving to declared semantic roles.

When the same defect appears more than once, repair the rule that owns it.

### Page architecture and repetition

Count the relationship between evidence regions, not small style differences. A chart or table above two commentary columns, three commentary columns, cards or prose, with or without a closing insight strip, is one architecture: evidence over commentary. Mirroring evidence and commentary is also one architecture. Changing chart type, colour, markers or subtitle height does not create variety. A chart combined with a developed process, dependency diagram or decision structure is a composite evidence page: classify the relationship between both exhibits, rather than treating the diagram as commentary. The second exhibit must explain a different part of the claim.

Review the planned sequence before composing: no one architecture should exceed 40% of analytical pages, and ten-page windows should show at least three genuinely different relationships. These are blocking repetition screens, not a recipe for rotating templates. A declared series exception needs a real repeated comparison task and reviewer justification. Inspect the resulting montage after rendering; the plan cannot certify the pixels.

Use reference pages to choose meaningful alternatives: paired measures on a common basis; aligned small multiples; a full-width bridge with anchored explanations; shared quantitative rows; one decisive metric with its proof; an actual ordered route; a branching decision; a calendar of competing commitments; a network of dependencies; an integrated qualitative comparison. A second panel must add evidence, not restate the first. Preserve shared scales and denominators; do not invent a chart, an icon or an image simply to increase variety. Tables and non-chart exhibits need an extra heading only when it distinguishes peer evidence regions.

On a calendar, make the decision-relevant phase boundary visible in the geometry or labels: a trial and optional continuation cannot be one uninterrupted band distinguished only in a footer. Proposed schedules must remain distinct from observed activity.

A menu of independent alternatives is not a sequence: omit numbered-step treatment unless order matters. An ordered route, independent options and individual trials must not share a quantitative ranking as equivalent packages. Name the work before its supporting duration or prerequisite; repeated “No prior” labels are metadata, not hero metrics.
