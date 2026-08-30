# Source Guide

This index describes the content under `src/`. Each concept has one owner so the guidance remains mutually exclusive and collectively exhaustive (MECE).

## Ownership

- [`storylining/`](storylining/index.md) owns the governing thought, argument structure, chapter sequence, storyboard, action-title spine, and narrative QA.
- [`design/`](design/index.md) owns composition, hierarchy, visual tokens, theme modes, reference intake, and cross-platform design fallbacks.
- [`slide-types/`](slide-types/index.md) owns the narrative contract for each supported slide archetype.
- [`charts/`](charts/index.md) owns quantitative encodings and chart-specific construction rules.
- [`components/`](components/index.md) owns recurring deck furniture such as titles, navigation, footers, sources, and appendix behavior.
- [`tools/`](tools/index.md) owns PowerPoint and Google Slides implementation and rendering mechanics.

Evaluation and release evidence live outside this document section under `evals/`.

## Reading order

### For a new or materially revised deck

1. Read storylining first and construct the dot-dash for the deck, including the proposed action-title sequence, evidence for each page, rough exhibit choice, and rough design order.
2. Once the dot-dash is coherent, read design and outline the deck-wide design system. Consult components to identify techniques or recurring structures that may affect pagination or cause additional slides to be added, such as section dividers, tracker transitions, or content that must be split to maintain readable spacing.
3. Only then consult the relevant slide types and, when applicable, the associated chart guidance. Choose the archetype and encoding that best prove each action title; do not force the story into a preferred template.
4. Compile the detailed deck design, including the slide sequence, slide family, content hierarchy, alignment guides, component states, sources, and platform fallbacks for every page.
5. Consult the target-platform tools to understand how to build, render, validate, and deliver the deck in PowerPoint, Google Slides, or both.

The dot-dash is the bridge between narrative and design. At minimum, each line should identify the slide's narrative job, draft action title, evidence or unresolved question, dominant exhibit, audience implication, and transition to the next page. It should be detailed enough to expose gaps and repetition before layout work begins, but it should not contain platform-specific coordinates or API implementation.

### For modifications to an existing deck

1. Inspect the complete existing deck before editing: read the action-title spine, render all pages, identify the active master and layouts, inventory recurring components, and distinguish deliberate exceptions from broken consistency.
2. Classify the change as narrative, design-system, slide-type, chart, component, or platform-specific work, then read only the owners required for that scope. Read adjacent owners when the modification changes page count, chapter order, tracker state, source treatment, or cross-platform behavior.
3. Preserve the existing deck's approved visual system and closest valid layout unless the request explicitly authorizes a redesign. Reuse established anchors, guides, spacing, component states, chart grammar, and page rhythm rather than introducing a parallel convention.
4. Update the dot-dash and action-title spine when the change alters the argument, slide order, or evidence. Recompute chapter boundaries, page numbers, trackers, cross-references, appendix references, and transitions after slides are added, removed, or reordered.
5. Repair any resulting incompleteness, including orphaned titles, repeated claims, missing evidence, broken alignment, inconsistent component states, stale sources, clipped objects, empty placeholders, or platform-conversion defects.
6. Render and inspect the entire affected deck, not only the edited pages. A local change is complete only when surrounding slides, the title spine, the montage, and the requested final platform remain coherent.

For a narrow repair, read this index and only the owner of the affected behavior. Expand the scope only when direct inspection shows the defect propagates into another owner or another slide.

## Alignment guides

Alignment is a deck-wide system, not a final polishing pass. Every visible object should relate to a deliberate page guide, another object, or a defined internal grid. Avoid coordinates chosen by eye on individual slides: isolated nudges create cumulative drift, make later edits harder, and cause PowerPoint and Google Slides versions to diverge.

This section defines the alignment workflow shared across subsystems. [`design/`](design/index.md) remains the owner of the active visual tokens and approved reference geometry; [`components/`](components/index.md) owns recurring cross-page furniture; and [`tools/`](tools/index.md) owns the platform-specific coordinate implementation. When a supplied template or brand system defines different guides, derive and use those guides consistently instead of forcing the neutral defaults below.

### Guide hierarchy

Use three levels of guides and resolve them in order:

1. **Deck guides** define the canvas, safe margins, title anchor, content zone, source zone, footer zone, chapter tracker, and shared columns. They remain constant across the deck except for explicitly defined title, divider, dark, or appendix variants.
2. **Slide-family guides** define the repeated silhouette for an archetype or layout family, such as a chart with a right-hand implication panel, a two-column comparison, a process row, or an executive synthesis. Pages in the same family should share anchors even when their content differs.
3. **Local guides** organize objects inside a single exhibit, group, chart, table, or diagram. They may vary by content, but they must terminate on deck or slide-family guides and use the same spacing scale.

Do not create a local guide to excuse an object that is visibly misaligned with the page. Do not force unrelated objects onto one guide merely to create mathematical symmetry; the audience should perceive the intended grouping and hierarchy first.

### Coordinate model and default canvas

Use a top-left origin. `x` increases from left to right and `y` increases from top to bottom. Store geometry in one canonical unit per implementation and convert only at the platform boundary. PowerPoint authoring commonly uses inches or points; Google Slides API geometry commonly uses English Metric Units or points. The platform tool must preserve the same intended guide positions after conversion and rendering.

The neutral fallback uses a 16:9 canvas measuring 13.333 by 7.5 inches. The primary left and right content guides are 0.67 and approximately 12.67 inches, creating a 12-inch working width. These are fallback values, not permission to overwrite an approved template's master geometry.

| Guide | Default position | Purpose |
| --- | --- | --- |
| canvas left | `x = 0.00` | physical slide edge; backgrounds may bleed to it |
| primary left | `x = 0.67` | left edge for titles, body content, charts, tables, and sources |
| primary right | `x = 12.67` | right edge for the principal content system |
| canvas right | `x = 13.333` | physical slide edge; backgrounds may bleed to it |
| title top | `y = 0.38` | top of the action-title block on analytical pages |
| title bottom | `y = 1.18` | default bottom of the title block; allow only defined title variants |
| title separator | `y = 1.25` | optional rule or lower title-zone reference |
| content top | `y = 1.45` | typical top of the main analytical canvas |
| content bottom | `y = 6.80` | typical lower boundary for meaning-bearing content |
| source baseline | `y = 6.92` | typical on-slide source or note position |
| footer top | `y = 7.15` | top of page number, confidentiality, and footer metadata |
| canvas bottom | `y = 7.50` | physical slide edge; backgrounds may bleed to it |

Keep backgrounds, full-bleed images, and deliberate color fields separate from the content-safe guides. A visual may extend beyond the primary margins only when it is intentionally cropped, decorative rather than meaning-bearing, or part of an approved full-bleed layout. Titles, labels, values, sources, and editable content should remain inside the safe system.

### Twelve-column analytical grid

The neutral analytical grid uses 12 columns, approximately 0.853 inches per column, with 0.16-inch gutters. The values below are rounded for authoring; calculate from the canonical canvas and margin values in code so rounding error does not accumulate.

| Column | Start `x` | End `x` |
| --- | ---: | ---: |
| 1 | `0.670` | `1.523` |
| 2 | `1.683` | `2.536` |
| 3 | `2.696` | `3.549` |
| 4 | `3.709` | `4.562` |
| 5 | `4.722` | `5.575` |
| 6 | `5.735` | `6.588` |
| 7 | `6.748` | `7.601` |
| 8 | `7.761` | `8.614` |
| 9 | `8.774` | `9.627` |
| 10 | `9.787` | `10.640` |
| 11 | `10.800` | `11.653` |
| 12 | `11.813` | `12.666` |

Use column spans rather than arbitrary widths. Common starting structures include:

| Structure | Suggested spans | Typical use |
| --- | --- | --- |
| full analytical canvas | `12` | one dominant chart, table, map, or diagram |
| equal halves | `6 + 6` | comparison, before/after, two-part argument |
| thirds | `4 + 4 + 4` | three mutually exclusive options or evidence blocks |
| narrow-wide-narrow | `3 + 6 + 3` | central process, decision tree, or hero evidence with side context |
| evidence plus implication | `8 + 4` | chart or table with a right-hand conclusion panel |
| context plus evidence | `4 + 8` | definitions or assumptions beside the dominant exhibit |

Account for gutters between spans. Do not place two objects against the same column boundary and then add an unrelated manual gap; use the gutter or a defined multiple of the spacing unit. If content cannot fit a valid span at readable type sizes, change the composition, split the page, or choose another slide family.

### Vertical rhythm and spacing scale

Use a 6-point base unit, equivalent to approximately 0.083 inches. Build spacing from intentional multiples rather than isolated values:

| Step | Points | Approximate inches | Typical use |
| --- | ---: | ---: | --- |
| 1x | `6 pt` | `0.083` | tight label-to-value or icon-to-label relationship |
| 2x | `12 pt` | `0.167` | related text blocks, compact table padding, chart label separation |
| 3x | `18 pt` | `0.250` | paragraph or grouped-object separation |
| 4x | `24 pt` | `0.333` | separation between meaningful subgroups |
| 6x | `36 pt` | `0.500` | separation between major page regions |
| 8x | `48 pt` | `0.667` | major chapter or title-page spacing |

Proximity communicates relationship. Use smaller gaps within a group and larger gaps between groups; do not rely on boxes, rules, or color fills to compensate for ambiguous spacing. Repeated groups must use the same internal padding and inter-group gap unless content hierarchy clearly requires a documented exception.

Text spacing must be measured from text-box geometry and paragraph settings, not from the apparent top or bottom of visible glyphs. Fonts have different ascenders, descenders, and internal metrics, so two text boxes with equal `y` values may not look aligned after substitution. Use consistent text margins, line spacing, paragraph spacing, vertical anchoring, and autofit behavior before applying optical corrections.

### Anchor selection rules

Choose one dominant alignment relationship for each object. Prefer relationships in this order:

1. align to a deck-level safe-margin, title, content, source, or footer guide;
2. align to the start or end of a defined grid column;
3. align to the edge or baseline of the object that establishes the local hierarchy;
4. distribute repeated peers within a defined container;
5. apply a small optical correction only after the geometric system is correct.

Use left-edge alignment for most text and analytical content because it creates the strongest scan path. Use right-edge alignment for numbers, terminal labels, and content intentionally anchored to the right side. Use center alignment only for truly symmetric compositions, small icon-label groups, or sparse title/divider pages; centering several unrelated text blocks usually weakens hierarchy.

When objects have different shapes, align the edge the audience actually perceives. For example, align a text label to the chart plot area rather than the chart object's outer frame, align a callout to the visible image crop rather than the uncropped source bounds, and align a rounded card by its exterior edge rather than the inset text box.

### Text alignment

- Keep action titles on the same left anchor and within the same maximum width for a slide family. Use a defined two-line variant rather than moving the content zone independently on one page.
- Align text boxes by their actual containers, then standardize internal margins. Avoid adding spaces, tabs, or transparent characters to simulate alignment.
- Use a shared baseline for peer labels, values, or headers. If font substitution makes the baseline appear uneven, correct paragraph and font settings before changing object coordinates.
- Keep bullet indents, hanging indents, bullet-to-text gaps, and nesting levels consistent. A wrapped bullet should align with the start of its text, not with the bullet glyph.
- Align numeric columns by decimal point or right edge when comparison matters. Keep units in a consistent position and do not mix values with and without units in the same comparison column.
- Do not shrink one text box or alter its line spacing solely to preserve a row. Shorten the copy, widen the valid span, or split the content.

### Shape, card, and panel alignment

- Define the outer container first, then derive all internal padding from the spacing scale. Do not position child objects independently against the slide when they conceptually belong to the container.
- Use equal widths and heights only for peers with equal semantic weight. A primary recommendation may legitimately occupy more space than supporting considerations.
- Distribute peer containers by their outer edges, not by the centers of text inside them. Confirm that first and last objects terminate on valid guides.
- Keep border widths inside or outside the intended visible edge consistently. A thick stroke can make mathematically aligned shapes look offset.
- Use panels sparingly. Alignment and whitespace should carry grouping before a border or background fill is introduced.

### Chart alignment

- Treat the plot area, axes, labels, legend, title, annotations, and source as separate alignment regions. The plot area—not the outer chart frame—is usually the meaningful guide for comparison with nearby content.
- Align plot areas across small multiples so equal values occupy comparable positions. Hold axis ranges, zero baselines, category order, and plot dimensions constant unless a declared analytical reason requires a difference.
- Align the zero baseline of adjacent charts whenever the audience will compare magnitude. Do not vertically center charts with different baselines and imply false comparability.
- Reserve space for long category labels before setting the plot guide. If labels force a larger left inset, apply the same plot-area inset to comparable charts or choose a different construction.
- Place legends, units, periods, and forecast keys on shared guides. Do not let an automatically positioned legend change the plot width from slide to slide.
- Attach annotations to the datum or region they explain. Use consistent leader-line endpoints and avoid crossing the plot, labels, or other leaders.

### Table alignment

- Align the table's outer edge to deck or column guides, then define column boundaries from the comparison task rather than dividing width evenly by default.
- Left-align descriptive text, right-align comparable numbers, and use decimal alignment when precision matters. Center only compact categorical markers whose labels have similar length.
- Keep headers aligned with their columns and maintain consistent cell padding. Do not use manual spaces or line breaks to force values into position.
- Align row labels and values to a consistent baseline. Increase row height for genuinely necessary wrapping rather than vertically compressing type.
- Align subtotal and total rules across the full relevant comparison span. Use indentation, weight, and whitespace consistently to show hierarchy.
- When two tables appear on one page, align their header baselines, comparable column boundaries, row rhythm, and bottom edge when possible. If row counts differ materially, top-align them and avoid stretching one table merely to equalize height.

### Diagram, process, and connector alignment

- Establish node centers or edges on a shared grid before drawing connectors. Connectors should attach to defined ports and remain orthogonal or consistently angled.
- Align peers on the axis that communicates their relationship: horizontal for sequence, vertical for hierarchy, radial only when cyclic structure is essential.
- Use equal inter-node gaps for equal transitions. A larger gap should signal a real phase break, handoff, uncertainty, or elapsed-time difference.
- Keep arrowheads, line weights, corner radii, and label offsets consistent. Do not hand-draw independent line segments that separate when nodes move.
- Place connector labels in reserved whitespace and align them consistently to the connector or transition midpoint. Never let a connector pass through text.
- For decomposition trees, align each child group beneath or beside its parent, keep sibling spacing consistent, and size branches according to the logic rather than the amount of available decoration.

### Image and icon alignment

- Align the visible crop, focal point, or mask—not hidden image bounds—to the intended guide. Use consistent aspect ratios for peer images.
- Establish crop windows first, then place the source image inside them. Reusing a crop frame produces more stable alignment than manually sizing each image.
- Align icons by their perceived optical mass. Icons with different viewboxes may require small documented optical offsets after their containers are geometrically aligned.
- Keep icon sizes and icon-to-label gaps consistent within one semantic family. Do not mix filled, outlined, circular, and square icon grammars merely to fill space.
- Treat logos as protected assets with clear-space rules. Align the logo slot, not an irregular visible mark, and never distort the aspect ratio.

### Cross-page components and repeated anchors

Titles, trackers, dividers, page numbers, confidentiality labels, dates, sources, and brand slots must use master or layout anchors wherever the platform allows. Define their coordinates and visibility rules once, then bind slides to those definitions.

Tracker labels and markers must align to the same chapter map across the full deck. Recompute active, inactive, and completed states after slide or chapter changes. A tracker should not move because one chapter label is longer; reserve a stable label region, shorten labels, or use a defined tracker variant.

Sources should begin on a shared left anchor and stay inside a reserved safe zone. If a source wraps, increase the source region through a defined layout variant or shorten the displayed citation while preserving full provenance elsewhere. Never move the footer independently to make room on one slide.

### Cross-slide alignment and rhythm

Alignment should remain visible when the deck is viewed as a montage. Repeated slide families should share title positions, content tops, dominant exhibit boundaries, implication-panel edges, source baselines, and footer anchors. Deliberate variation should come from the narrative job—not from accidental coordinate drift.

Use the following continuity rules:

- keep the primary left and right anchors stable across analytical pages;
- keep title and source zones stable within each layout family;
- align repeated charts, tables, and panels to the same column spans;
- preserve component positions across light and dark variants unless the master explicitly defines another anchor set;
- keep equivalent evidence at equivalent visual weight across comparison pages;
- alternate silhouettes only when the story changes job, emphasis, or chapter;
- inspect consecutive slides for objects that jump by a few pixels without a narrative reason.

### Alignment workflow for each slide

1. Confirm the slide's narrative job, action title, dominant exhibit, and implication before placing objects.
2. Select the closest approved master, layout, slide family, or reference exemplar.
3. Activate or instantiate the deck guides and the relevant slide-family guides.
4. Place the action title, content region, source, footer, and cross-page components first.
5. Choose column spans for the dominant exhibit and supporting content.
6. Build the exhibit inside its container using local guides and the spacing scale.
7. Standardize internal text margins, padding, axes, labels, and connector ports.
8. Align and distribute peers numerically, then inspect optical alignment at full render size.
9. Check the slide beside its preceding and following pages and in the full montage.
10. Record any deliberate guide exception in the builder or layout definition so it remains reproducible.

### Programmatic implementation contract

Do not scatter literal coordinates throughout the generation script. Define named guide constants for the canvas, margins, title, content, source, footer, columns, gutters, and spacing scale. Derive positions and spans through helper functions so additions and revisions remain internally consistent.

At minimum, the implementation should be able to answer:

- Which deck guide or slide-family guide owns this object's position?
- Is the object's width a valid column span or a deliberate documented exception?
- Is the gap to its neighbor a defined spacing multiple?
- Does a repeated component inherit from a master or layout rather than a local copy?
- Will the same intended guide survive unit conversion and native rendering on the target platform?
- Can a slide be inserted, removed, or reordered without manually repositioning every tracker, page number, or footer?

Prefer helpers such as `columnStart(n)`, `columnSpan(start, count)`, `placeInRegion(region, inset)`, and `alignPeers(objects, edge)` over copied numeric literals. Use a single rounding policy at the final platform boundary; do not repeatedly round intermediate calculations.

### Alignment QA and tolerances

Coordinate correctness is necessary but not sufficient. Fonts, strokes, image crops, chart internals, and renderer differences can make equal coordinates look misaligned. Validate both geometry and final pixels.

Use these default tolerances unless the approved template or platform requires stricter values:

| Relationship | Default tolerance | Required response |
| --- | ---: | --- |
| repeated master or component anchor | exact stored value | fix the source definition; do not nudge individual slides |
| primary title, content, source, or footer edge | `0.01 in` | correct the object or layout anchor |
| related object edge within one exhibit | `0.02 in` | align numerically, then inspect optically |
| peer text baseline | approximately `1 pt` | normalize font, paragraph, and margin settings before moving the box |
| repeated gap or padding | approximately `2 pt` | restore the spacing token or container inset |
| raster or SVG optical correction | smallest visible correction | document the offset and reuse it for the asset family |

Run these checks on every final platform:

- compare the coordinates of repeated anchors and components;
- inspect full-size renders for visible edge, baseline, and spacing drift;
- inspect the montage for cross-slide jumps and inconsistent page silhouettes;
- verify that chart plot areas—not only chart frames—align where comparisons are intended;
- verify that tables preserve comparable column boundaries and numeric alignment;
- inspect dark/light and imported/native variants for changes caused by font substitution, stroke rendering, crop behavior, or unit conversion;
- re-render the complete affected deck after repairs.

### Alignment anti-patterns

Reject the following unless an approved reference or explicit narrative purpose requires them:

- positioning objects by eye without reference to named guides;
- using spaces, tabs, empty text boxes, or transparent shapes as alignment tools;
- mixing several nearly identical left edges or content tops on one page;
- centering unrelated objects because their bounding boxes happen to be similar;
- equalizing container sizes when the content hierarchy is unequal;
- aligning chart frames while plot areas, baselines, or axes remain inconsistent;
- forcing content to fit by shrinking type, reducing margins, or violating the source/footer zone;
- nudging a recurring component locally instead of fixing its master or layout;
- copying rounded coordinates from one platform into another without canonical conversion;
- accepting a mathematically even layout that appears visually unbalanced after rendering;
- introducing an exception without documenting and reusing it as a defined variant.

## Maintenance rule

Every directory under `src/` must contain an `index.md`. An index owns shared rules and routing for that directory; child files contain only type-specific or platform-specific detail. Update the owner instead of repeating a rule in a second subsystem.

Keep this source guide focused on ownership, reading order, and cross-subsystem alignment. Put visual tokens and reference-derived geometry in design, recurring component definitions in components, archetype-specific compositions in slide types, quantitative encoding rules in charts, and API or rendering mechanics in tools.
