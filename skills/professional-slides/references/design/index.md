# Design System

Design should make the argument easier to see. Use the fewest visual rules needed for a coherent deck. [`Theming`](../theming/index.md) owns reusable values and component bindings; this file owns visual decisions and composition.

## Select one design mode

Choose one:

- **Reference-led:** follow an approved source deck or template.
- **Clean native:** use a restrained consulting system when no reference exists.

Then resolve one [visual family and density profile](../theming/index.md#resolve-one-active-theme). Do not mix reference styles with a new house style.

## Compose the page

Start with the claim and evidence, then choose the layout.

- Trend: chart.
- Sequence: timeline or process.
- Comparison: table, chart, or parallel fields.
- Causal logic: diagram.
- Synthesis: executive answer spine.
- Decision: conditions, actions, or gates.

Do not impose the same card grid, three-column layout, process rail, or footer strip on most slides. One slide should have one dominant exhibit and no more than one distinct callout or terminal action surface.

Whitespace must support hierarchy. It must not conceal missing evidence or undersized content.

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

Before authoring, record the [theme manifest](../theming/index.md#theme-manifest) and name the treatment for titles, analytical headers, tables, callouts, trackers, sources, and charts. Reuse it. Create a new variant only when the meaning changes.

## Implication emphasis system

Use a separate implication or action region only when it adds a distinct conclusion, condition, owner, or action that is not already clear from the title and exhibit.

Choose one registered [terminal action-surface variant](../theming/component-bindings.md#terminal-action-surface), such as a rule, a light tonal area, or stronger type. Do not stack an implication box and a recommendation box. If deletion changes nothing, remove the region.

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
- the title separator and content start;
- the footer and source zone;
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

Check:

- title and content anchors;
- type size and wrapping;
- colour roles;
- table and chart grammar;
- repeated component states;
- visual variety driven by evidence;
- clipping, overlap, broken assets, and dead space.

Repair the owning rule when the same defect appears more than once. Keep intentional exceptions only when the content requires them.

## Cross-platform fallbacks and QA

PowerPoint and Google Slides may render differently. Use native editable objects where possible, then render each final platform separately. A successful export is not visual proof.
