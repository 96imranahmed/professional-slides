# Relationship network

Use a relationship network when a bounded set of participants has explicit reciprocal, directed or non-directional relationships. It expresses connectivity, not organizational reporting, a time sequence or a quantitative position. Do not infer edges from proximity or turn a cycle into a hierarchy.

The canonical owner is `runtime/relationship-network.mjs`. It exports `relationshipNetwork`, `RELATIONSHIP_NETWORK_TOKENS` and neutral `RELATIONSHIP_NETWORK_VARIANTS`. The `relationship-network` registry entry consumes them; adapters emit native editable text, rectangles and line connectors. Never use a screenshot of the source diagram as the generated exhibit.

## Typed hub-and-ring input

- `variant: hub-ring` arranges one center and three to six perimeter nodes. Four perimeter nodes use the corners; other supported counts use clockwise elliptical placement from the top. Positions only express the declared graph arrangement.
- `nodes` contains exact unique `id`, nonempty `label` and optional nonempty `body` for every participant.
- `centerId` names the coordinating participant. It is not an inferred manager.
- `ringOrder` names every other node exactly once in meaningful clockwise order.
- `edges` explicitly names unique `id`, exact `from` and `to` node IDs, nonempty semantic `relation`, and `direction: forward | bidirectional | none`. Forward points from `from` to `to`; bidirectional has arrowheads at both ends. None has no arrowhead.
- Supported edges are center spokes and adjacent perimeter pairs. The layout never invents missing perimeter or center connections. Self-edges, duplicate endpoint pairs, unknown endpoints, disconnected displayed nodes and nonadjacent perimeter chords reject. Use one bidirectional edge rather than two coincident opposite edges.
- Visible edge labels are not supported in this bounded layout. Necessary relationship language must be in the participant description or another suitable composition; do not silently discard an edge label.

The `directed-spokes` neutral registry specimen exercises the same hub-ring layout with forward-only edges. It is not a separate topic template.

## Geometry and typography

Every label and body uses the current shared body role, with bold labels. Labels and bodies are measured before layout; node height grows from actual wrapped content plus shared padding and heading/body gap. The center has only a measured muted surface, never a full-height filler panel. Other nodes have a quiet border that gives connectors a definite participant boundary.

Each connector is clipped to the measured node rectangle plus `space.2` clearance at both ends, and reserves clear line length between endpoints. Lines crossing unrelated participant rectangles reject. Node overlap, insufficient connector space and content outside the allocated frame reject rather than shrinking text or deleting participants. Node boxes retain native editable text; changes in body length are remeasured before the graph is emitted.

The owner consumes only its declared body/font, color, line and spacing tokens. Source icons and decorative circular paths are optional visual devices; do not approximate supplied artwork. The relationship topology and all substantive role descriptions remain mandatory.

## Semantics and verification

Every node has its exact logical node ID and an owned heading/body. Every edge exports exact node dependencies, semantic relation and original direction. Adapters receive `startArrow`/`startArrowType` and `endArrow`/`endArrowType`, preserving reciprocal relationships in native output and the HTML observer.

Verify every source edge against the exported node/edge ledger and every node description against the evidence. Inspect the exact output for arrowhead direction, visible clearance, node content, absence of accidental crossings, center/perimeter prominence and readability at the source comparison height. A compile pass proves neither source equivalence nor final visual quality.
