# Design System

Design should make the argument easier to see. Use the fewest visual rules needed for a coherent deck. [`Theming`](../theming/index.md) owns reusable values and component bindings; this file owns the visual decisions applied to the resolved composition.

## Select one design mode

Choose one:

- **Reference-led:** follow a source deck or template admitted by the [asset authorization record](../components/icons-and-logos.md#asset-authorization-record).
- **Clean native standard:** default when no approved reference or explicit custom direction exists. Use the Codex Grid layout, registered components, and standard tracker, chart-heading, and legend variants.
- **Custom user-directed:** use only when the owner explicitly approves a distinct visual direction and record that approval in the deck contract.

Then resolve one [visual family and density profile](../theming/index.md#resolve-one-active-theme). Do not mix reference styles with a new house style.

## Compose the page

Use the [composition model](../composition/index.md) for the content-item contract, relationship-based layout selection, and nesting rules. Design begins after that tree resolves: select the visual family, density, guides, treatment, and hierarchy that make the declared relationships visible. [Slide layouts](slide-layouts.md) owns the corresponding page-geometry guidance.

Do not impose the same card grid, three-column layout, process rail, or footer strip on most slides. Give each slide one dominant exhibit; route any detached synthesis or terminal action through the canonical [`Insight Box`](../components/insight-box.md). Evidence-attached chart annotations follow [`chart callouts`](../components/chart-callouts.md).

Whitespace must support hierarchy. It must not conceal missing evidence or undersized content. On an executive pre-read, one dominant analytical item should normally occupy 60% to 90% of the usable content field. The examples of comparison, qualifier, definition, period, and attached interpretation are non-scored planning prompts; the [copy owner](../components/copy.md) defines completeness.

## Select an evidence-density mode

Use one mode for each slide family:

- **Live pitch:** large type, low density, one idea per page.
- **Executive presentation:** moderate density and strong visual hierarchy.
- **Executive pre-read:** denser evidence that remains readable without narration.
- **Analytical appendix:** compact, precise, and source-rich.

Never shrink text to make the wrong composition fit. Simplify the copy or redesign the page.

## Colour system

Use colour for meaning, not decoration.

Resolve the complete palette from the [theme token registry](../theming/tokens.md). It includes `component-primary`, its `text-accent` alias, neutral surfaces, text roles, structural rules, status roles, and `chart-series-1` to `chart-series-6`.

Use one identical component-primary swatch across titles, tracker emphasis, structural highlights, and primary actions. Do not use chart colours for non-chart decoration. Do not use RAG colours unless they encode a defined measure and also have a non-colour cue.

### Semantic treatment registry

Before authoring, record the [theme manifest](../theming/index.md#theme-manifest) and create one deck treatment ledger. For every slide or contiguous slide range, name the visual family, density, analytical-header template, tracker state, page layout, tables, callouts, sources, charts, and repeated component variants. Reuse those treatments. Create a new variant only when the meaning changes, and record the semantic reason as an explicit exception rather than tuning one slide locally.

The ledger owns one `tableHeader` record with `variantId`, `fillRole`, `textRole`, `ruleRole`, `rowHeightToken`, `paddingXToken`, and `paddingYToken`. Every analytical table references that record by `variantId`; no slide carries a parallel header definition.

## Implication emphasis system

Use a separate implication or action region only when it adds a distinct conclusion, condition, owner, or action that is not already clear from the title and exhibit.

Choose one registered [`insight-box`](../components/insight-box.md) variant, normally a light tonal or neutral surface, or the dotted no-fill treatment when a filled block would be too heavy. Reserve the primary surface for a decisive action or stage moment. Do not stack an implication box and a recommendation box. If deletion changes nothing, remove the region.

## Typography system

Use the [registered typography roles](../theming/tokens.md#primitive-and-role-tokens): cover title, action title, section title, body, compact body, label, and source.

Keep the registered title role at one font size across a slide family. Every ordinary analytical title uses the exact same deck-level `x` and `y` anchor. One-line and two-line titles start at the same point; dependent content moves down when the title wraps.

Prefer one line. When two lines are needed, wrap at a meaningful phrase and avoid a lone final word. Do not condense, locally shrink, or move a title to balance one slide.

Use readable body text. Dense pre-reads may be compact, but the final render must still work at normal viewing size.

## Spacing system

Use the [registered spacing scale and density profile](../theming/tokens.md#density-profiles). Align related objects to common edges and baselines. Keep internal padding, row rhythm, and gaps consistent within each component family.

Do not use tiny spacing differences to make a crowded layout fit. Remove or regroup content instead.

## Canvas, guides, and grid

Use a 16:9 canvas unless the source specifies otherwise. Resolve the exact values through the active density profile and define:

- outer page margins;
- the analytical title anchor;
- the optional title separator and content start;
- the shared footer/source row and content boundary, following the [page-template owner](../components/index.md#sources-and-footers);
- a simple 12-column analytical grid.

The grid is a guide, not a requirement to fill every column. Give the dominant exhibit most of the canvas. Set diagram nodes before drawing connectors. Keep recurring objects on exact shared anchors.

A tracked analytical-header template contains the tracker label and action title. An untracked template contains only the action title. Declare which slides each template governs before authoring.

## Image and icon system

Use images and icons only when they improve meaning or recognition. Keep one visual style. Prefer editable vectors and real library icons over improvised symbols. Do not add an icon to fill empty space.

Design owns only the image and icon geometry. The component guide owns meaning and selection.

## Reference intake

When a reference deck is authorized:

1. render and inspect the full deck;
2. identify its layouts, anchors, typography, spacing, colours, tables, charts, and recurring components;
3. separate deliberate rules from one-off exceptions;
4. reuse the closest valid structure.

Do not copy source content or assets unless authorized. Do not claim fidelity without comparing the final render with the reference.

## Cross-slide QA

Review the montage first, then every slide at full size.

Reconcile the rendered deck against the treatment ledger slide by slide. A consistency audit must identify the shared definition used for every repeated title, header, tracker, table, callout, source, chart role, and semantic colour. It must also list each intentional exception with its slide, role, and content reason. An unexplained exception is drift, not variety.

Check:

- title and content anchors;
- type size and wrapping;
- colour roles;
- table and chart grammar;
- repeated component states;
- visual variety driven by evidence;
- clipping, overlap, broken assets, and dead space.
- full tracker pages contain the complete approved item set with numbers and labels;
- compact tracker states remain present and selected correctly on every slide in each governed range;
- editable object fills, lines, and text colours resolve to declared semantic roles rather than slide-local literals.

Repair the owning rule when the same defect appears more than once. Keep intentional exceptions only when the content requires them.

## Cross-platform fallbacks and QA

PowerPoint and Google Slides may render differently. Use native editable objects where possible, then render each final platform separately. A successful export is not visual proof.
