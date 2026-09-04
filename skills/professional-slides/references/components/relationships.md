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
| `map` | a base map admitted by the [asset authorization record](icons-and-logos.md#asset-authorization-record), coordinate-bound locations, labels, values or states, and a legend when an encoding is shared; use an authorized base map or omit the asset when approval is absent | every marker resolves to the intended location and all values remain traceable |
| `funnel` | ordered stages, one denominator, proportional widths, values, and optional conversion rates | stage values and displayed conversion rates reconcile; any inflow or non-monotonic stage is explained |
| `connector` | one source ID, target ID, relationship, boundary anchors, and optional substantive label | the route avoids unrelated nodes and text, and direction remains unambiguous without colour |

Choose the component from the relationship the audience must decode. Do not use a process for unordered peers, a roadmap without progression, a tree without parent-child logic, or a funnel when stages do not share a valid population.

For `roadmap`, record `period` or `maturity` on each stage when band width or position encodes it. For `timeline`, normalize dates to the declared domain before calculating event positions. For `matrix`, declare axis labels, low-to-high direction, and domain. For `map`, use normalized asset coordinates tied to the approved base map. For `funnel`, calculate every width and conversion from the same denominator contract.

## Construction

- Keep one reading direction and stable node order.
- Calculate connectors from node boundaries after layout; never route a connector through text or an unrelated node.
- Use orthogonal routing for dense structures and direct routing for a short unambiguous relationship.
- Keep peer nodes equal unless size or position encodes a declared value.
- Put evidence in nodes or attached annotations, not in decorative captions around the diagram.
- Use sections only when they state a real grouping; the relationship component still owns its internal geometry.
- Use stable IDs for every node and connector so HTML, PowerPoint, and Artifact Tool can reconcile the same objects.

## Theme and adapter contract

The executable token list, preferred size, fixture content, and native geometry live in [`runtime/registry.mjs`](../../runtime/registry.mjs). Resolve fills, rules, state accents, type, spacing, and radii through the canonical [theme bindings](../theming/component-bindings.md). The [scene-to-native mapper](../tools/css-to-native-mapper.md) owns platform translation.

## Acceptance check

The relationship is clear without narration. Every node and connector has one job. Labels do not collide, lines terminate on valid boundaries, state is not conveyed by colour alone, and the exact HTML and PowerPoint renders preserve the same order, hierarchy, geometry, and emphasis.
