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
| [`connector`](arrows.md) | one source ID, target ID, relationship and boundary anchors; the arrow owner defines variants and labels | the route avoids unrelated nodes and text, and direction remains unambiguous without colour |

Choose the component from the relationship the audience must decode. Do not use a process for unordered peers, a roadmap without progression, a tree without parent-child logic, or a funnel when stages do not share a valid population.

The runtime `process` and process-style `roadmap` accept stage objects with `label` and optional `period`, `maturity`, and short `detail`. Each supplied field is rendered on its own line and measured at the stage width. Roadmap labels sit inside their stage bands, above the band fill in paint order; empty decorative bands must not cover or detach from the stage copy. A stage that cannot fit its complete text rejects rather than clipping or shrinking it. Use the existing `wave-columns` roadmap for developed activity and deliverable lists. The process-style roadmap uses equal ordinal spacing; its duration labels do not make the bands proportional to elapsed time.

The `wave-columns` variant measures each stage's optional range, heading, activities and deliverables at the allocated column width. Its shared activity and deliverable rows align across stages, with the deliverable row placed below the fullest activity list. Use its intrinsic height for a hugged group. Empty ranges and lists produce no placeholder or orphan heading. Reject a frame that cannot hold all supplied rows; fixed text-box heights must never let activities run into deliverables.

## Tree-based insight and implication tables

Use `insight-tree-table` when one root finding branches through named drivers into leaf evidence and every leaf needs an aligned interpretation or implication. The tree is the evidence structure; the adjacent fields are not independent tables. Use a flat analytical table when rows do not share parent-child logic, and use the standalone `tree` when the leaf-level interpretation does not need to remain row-aligned.

The executable contract is:

- one stable root ID and label;
- one to four branches, each with a stable ID, label, and at least one leaf;
- two to seven leaves overall, each with a stable ID, label, one aligned insight, and one to four implications;
- three substantive headers for the tree, insight, and implication fields;
- `rowTreatment: "tonal"` by default, or `"open"` when whitespace already separates the aligned rows.

Declare one page density for the coherent hierarchy family and measure all branches and leaf rows at that size. If density is unspecified, four branches or six to seven leaves suggest `pre-read`; an explicit density takes precedence. When changing profile, change the action title, headers, node labels, insight rows, implication rows and annotations together. This is a capacity choice, not a separate business-content variant. If the complete hierarchy still does not fit, enlarge the valid region or split at a meaningful branch boundary.

The root, branch, and leaf boxes use one repeated treatment and retain equal peer geometry. Orthogonal connectors terminate at node boundaries and sit behind the nodes. A compact disc-chevron connects each leaf to its aligned insight. A separate native line with a triangular end arrowhead connects that insight to its implication. Neither connector column receives a header rule, and the implication arrows never sit on top of row rules. Tonal rows use the theme-bound neutral surface and preserve the same vertical gaps as the open treatment.

The action title states the governing branch logic and resulting consequence. It should not say only “Driver tree,” “Insights,” or “Implications.”

The native implementation lives in [`runtime/insight-tree-table.mjs`](../../runtime/insight-tree-table.mjs). HTML and PowerPoint receive the same editable rectangles, text, orthogonal connector lines, disc chevrons, and terminal arrowheads.

For `roadmap`, use equal-width bands for ordinal or maturity stages; use proportional widths only when elapsed time is the declared encoding, and record the relevant `period` or `maturity` on each stage. For `timeline`, normalize dates to the declared domain before calculating event positions. For `matrix`, supply `xAxis` and `yAxis`, each with `label`, `minLabel`, and `maxLabel`. Coordinates run from 0 to 1, left to right and bottom to top; the rendered labels state both domains and directions. The [map owner](maps.md) defines authorized geographies, crop-relative coordinates, country anchors, and analytical region caveats. For `funnel`, calculate every width from the first stage denominator. Zero values have no bar; a separate label column preserves legibility without inflating narrow stages.

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
| `process`, `timeline`, `journey` | `--component-primary`, `--surface-1`, `--on-primary`, `--ink`, `--text-secondary`, `--font-body`, `--type-compact`, `--type-label`, `--space-2`, `--line-standard`, `--line-hairline`, `--radius-round` |
| `roadmap` | the process properties plus `--component-primary-tint`, `--surface-2`, `--rule`, `--type-heading`, `--radius-small` |
| `tree`, `organization` | `--component-primary`, `--component-primary-tint`, `--surface-1`, `--surface-2`, `--rule`, `--on-primary`, `--ink`, `--text-secondary`, `--font-body`, `--type-compact`, `--line-hairline`, `--line-standard`, `--radius-none`, `--radius-small` |
| `matrix` | `--component-primary`, `--chart-series-2`, `--surface-1`, `--rule`, `--ink`, `--status-positive`, `--status-caution`, `--status-negative`, `--on-primary`, `--font-body`, `--type-label`, `--line-hairline`, `--line-standard`, `--radius-none`, `--radius-round` |
| `funnel` | `--component-primary`, `--chart-series-2`, `--chart-series-3`, `--chart-series-4`, `--on-primary`, `--ink`, `--font-body`, `--type-compact`, `--line-hairline`, `--radius-small` |

The executable token declarations, preferred sizes, fixture content, and native geometry live in [`runtime/registry.mjs`](../../runtime/registry.mjs); canonical defaults live in [theme bindings](../theming/component-bindings.md). The [scene-to-native mapper](../tools/css-to-native-mapper.md) owns platform translation.

## Acceptance check

The relationship is clear without narration. Every node and connector has one job. Labels do not collide, lines terminate on valid boundaries, state is not conveyed by colour alone, and the exact HTML and PowerPoint renders preserve the same order, hierarchy, geometry, and emphasis.


## Phase spacing and supporting rows

Keep successive phase bands visually connected, with compact separation at their tips rather than wide empty gutters. Group each heading, band and supporting list closely. The canonical `chevron-process` uses compact overlapping bands and spaced bullet rows by default; `detailStyle: "circled-number"` uses circular ordinal markers when sequence matters. Do not type `(1)`, `(2)` or plain numbered paragraphs into the detail copy. Leave deliberate space between successive supporting rows, while keeping wrapped lines within one point close together. Check the actual rendered gaps rather than only the allocated phase frames.

## Decision conclusions

Select `tree` variant `decision-conclusions` for a two-sided decision with leaf outcomes. Supply `root`, two `branches` with stable `id`, `label` and one to three identified `conclusions: [{id, text}]`, plus one overall `conclusion`. Keep each branch and its leaves in one structural colour family, with labels carrying the meaning in grayscale. Connectors terminate at boxes; the neutral conclusion band spans both families. Single-level decision trees are invalid. The default is `decision-conclusions`, with three visible node layers: root, intermediate decision branches, terminal outcomes. Allocate at least 900 × 440; use another composition when the content does not contain enough meaningful branch logic. Do not use branching to suggest probabilities or causality unsupported by the evidence.
