# Relationship Components

Relationship components show order, dependency, hierarchy, progression, position, geography, or conversion. They are reusable components inside the open [composition model](../composition/index.md), not page templates.

## Registered components

| Component | Required encoding | Acceptance condition |
| --- | --- | --- |
| `process` | ordered steps on one equal-interval rail; optional active index changes marker state, not spacing | order and current step are clear; connectors terminate at step boundaries |
| `roadmap` | ordered stage bands with a declared period or maturity basis; optional active stage | every band has a stage label and any shown timing reconciles with stage order |
| `timeline` | dated events positioned on a declared time scale; use equal intervals only when the labels are ordinal rather than elapsed time | placement never implies a false interval and every event maps to one date or period |
| `journey` | one actor, ordered stages, and stage-aligned touchpoints | stage order and actor remain explicit; touchpoints stay attached to the correct stage |
| `tree` | one root, stable child IDs, depth-based layers, and explicit parent-child links | hierarchy can be reconstructed from nodes and connectors without relying on position alone |
| `organization` | one accountable root role, reporting layers, stable role IDs, and reporting links | size does not imply rank; every reporting line has one valid manager and report |
| `matrix` | two named axes with direction and domain, plus labelled points and optional focal point | every point remains inside the domain and labels do not obscure comparative position |
| [`map`](maps.md) | an authorized standard geography, coordinate-bound locations, labels, values or states, and a legend when an encoding is shared | every marker resolves to the intended location and all values remain traceable |
| `funnel` | ordered stages, one denominator, proportional widths, values, and optional conversion rates | stage values and displayed conversion rates reconcile; any inflow or non-monotonic stage is explained |
| `connector` | one source ID, target ID, relationship, boundary anchors, and optional substantive label | the route avoids unrelated nodes and text, and direction remains unambiguous without colour |

Choose the component from the relationship the audience must decode. Do not use a process for unordered peers, a roadmap without progression, a tree without parent-child logic, or a funnel when stages do not share a valid population.

## Tree-based insight and implication tables

Use `insight-tree-table` when one root finding branches through named drivers into leaf evidence and every leaf needs an aligned interpretation or implication. The tree is the evidence structure; the adjacent fields are not independent tables. Use a flat analytical table when rows do not share parent-child logic, and use the standalone `tree` when the leaf-level interpretation does not need to remain row-aligned.

The executable contract is:

- one stable root ID and label;
- one to four branches, each with a stable ID, label, and at least one leaf;
- two to seven leaves overall, each with a stable ID, label, one aligned insight, and one to four implications;
- three substantive headers for the tree, insight, and implication fields;
- `rowTreatment: "tonal"` by default, or `"open"` when whitespace already separates the aligned rows.

One to three branches normally retain the requested page density. Four branches, or six to seven leaves overall, require at least `pre-read`; the planner promotes the complete page so the action title, headers, node labels, insight rows, implication rows, and annotations remain one coherent type system. This is a capacity state, not a separate business-content variant. If seven leaf rows still do not fit the available body frame at the promoted density, enlarge the valid region or split the hierarchy.

The root, branch, and leaf boxes use one repeated treatment and retain equal peer geometry. Orthogonal connectors terminate at node boundaries and sit behind the nodes. A compact disc-chevron connects each leaf to its aligned insight. A separate native line with a triangular end arrowhead connects that insight to its implication. Neither connector column receives a header rule, and the implication arrows never sit on top of row rules. Tonal rows use the theme-bound neutral surface and preserve the same vertical gaps as the open treatment.

The action title states the governing branch logic and resulting consequence. It should not say only “Driver tree,” “Insights,” or “Implications.”

```html
<section class="insight-tree-table" data-row-treatment="tonal" aria-label="Driver tree with aligned implications">
  <header class="insight-tree-table__headers">
    <h2>(Insert driver tree heading)</h2>
    <h2>(Insert insight heading)</h2>
    <h2>(Insert implication heading)</h2>
  </header>
  <div class="insight-tree-table__body">
    <div class="insight-tree-table__tree" role="tree">(Insert root, branches, leaves, and native connectors)</div>
    <ol class="insight-tree-table__rows">
      <li><span class="arrow" data-variant="disc-chevron"></span><p>(Insert aligned insight)</p><span class="arrow" data-variant="line"></span><p>(Insert implication)</p></li>
    </ol>
  </div>
</section>
```

```css
.insight-tree-table {
  --insight-tree-node-bg: var(--component-primary);
  --insight-tree-node-color: var(--on-primary);
  --insight-tree-connector: var(--rule);
  --insight-tree-row-bg: var(--surface-2);
  --insight-tree-row-color: var(--ink);
  --insight-tree-gap: var(--space-2);
  --insight-tree-node-padding: var(--space-3);
  --insight-tree-arrow-size: var(--icon-md);
  --insight-tree-rule: var(--line-hairline);
  --insight-tree-arrow-rule: var(--line-standard);
}

.insight-tree-table[data-row-treatment="open"] {
  --insight-tree-row-bg: var(--surface-1);
}
```

The native implementation lives in [`runtime/insight-tree-table.mjs`](../../runtime/insight-tree-table.mjs). HTML and PowerPoint receive the same editable rectangles, text, orthogonal connector lines, disc chevrons, and terminal arrowheads.

For `roadmap`, use equal-width bands for ordinal or maturity stages; use proportional widths only when elapsed time is the declared encoding, and record the relevant `period` or `maturity` on each stage. For `timeline`, normalize dates to the declared domain before calculating event positions. For `matrix`, declare axis labels, low-to-high direction, and domain. The [map owner](maps.md) defines authorized geographies, crop-relative coordinates, country anchors, and analytical region caveats. For `funnel`, calculate every width and conversion from the same denominator contract.

## Construction

- Keep one reading direction and stable node order.
- Calculate connectors from node boundaries after layout; never route a connector through text or an unrelated node.
- Use direct routing only when the segment clears every non-endpoint node and label; otherwise use an orthogonal route.
- Keep peer nodes equal unless size or position encodes a declared value.
- Put evidence in nodes or attached annotations, not in decorative captions around the diagram.
- Use sections only when they state a real grouping; the relationship component still owns its internal geometry.
- Use stable IDs for every node and connector so HTML, PowerPoint, and Artifact Tool can reconcile the same objects.

## Theme and adapter contract

The relationship owners consume these complete theme interfaces; do not add local colours, type sizes, rules, or radii.

| Component family | Consumed custom properties |
| --- | --- |
| `process`, `timeline`, `journey` | `--component-primary`, `--surface-1`, `--on-primary`, `--ink`, `--text-secondary`, `--font-body`, `--type-compact`, `--type-label`, `--line-standard`, `--line-hairline`, `--radius-round` |
| `roadmap` | the process properties plus `--component-primary-tint`, `--surface-2`, `--rule`, `--type-heading`, `--radius-small` |
| `tree`, `organization` | `--component-primary`, `--component-primary-tint`, `--surface-1`, `--surface-2`, `--rule`, `--on-primary`, `--ink`, `--text-secondary`, `--font-body`, `--type-compact`, `--line-hairline`, `--line-standard`, `--radius-none`, `--radius-small` |
| `matrix` | `--component-primary`, `--chart-series-2`, `--surface-1`, `--rule`, `--ink`, `--status-positive`, `--status-caution`, `--status-negative`, `--on-primary`, `--font-body`, `--type-label`, `--line-hairline`, `--line-standard`, `--radius-none`, `--radius-round` |
| `funnel` | `--component-primary`, `--chart-series-2`, `--chart-series-3`, `--chart-series-4`, `--on-primary`, `--ink`, `--font-body`, `--type-compact`, `--line-hairline`, `--radius-small` |
| `connector` | `--component-primary`, `--on-primary`, `--font-body`, `--type-label`, `--line-standard`, `--line-hairline`, `--icon-md`, `--radius-round` |

The executable token declarations, preferred sizes, fixture content, and native geometry live in [`runtime/registry.mjs`](../../runtime/registry.mjs); canonical defaults live in [theme bindings](../theming/component-bindings.md). The [scene-to-native mapper](../tools/css-to-native-mapper.md) owns platform translation.

## Acceptance check

The relationship is clear without narration. Every node and connector has one job. Labels do not collide, lines terminate on valid boundaries, state is not conveyed by colour alone, and the exact HTML and PowerPoint renders preserve the same order, hierarchy, geometry, and emphasis.
