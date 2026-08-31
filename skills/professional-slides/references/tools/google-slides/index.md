# Google Slides Integration

Read this folder for every native Google Slides deliverable. Select the route from the source state; do not treat all Google Slides requests as blank-deck API authoring.

## Files

- [API integration](api-integration.md): native connector, Google Slides REST API, Google Drive import/export, batching, object IDs, readback, and capability boundaries.
- [Rendering](rendering.md): PDF export, ordered PNG rendering, thumbnails, structural checks, and parity QA.

## Route the request

| Situation | Preferred route |
| --- | --- |
| Existing native Slides deck | Read and edit natively through the Google Drive/Slides connector |
| Native Slides reference/template | Copy once, inspect all slides, duplicate exemplars or use inspected layouts |
| Net-new native deck in Codex | Create and verify PPTX, then import as native Google Slides |
| Direct Slides API explicitly requested | Create/read with Slides API and mutate through `batchUpdate` |
| Dual PPTX + Google Slides delivery | Verify PPTX, import, then separately verify the native deck |

Do not round-trip an existing native deck through PPTX unless the user asks. Do not return an uploaded Office file or preview link as if it were a native Google Slides presentation.

## Common adapter contract

The native adapter should expose equivalents of:

- `getPresentation`: retrieve the full presentation resource;
- `copyPresentation`: create the working copy when a template must be preserved;
- `batchUpdate`: apply ordered mutations;
- `readback`: retrieve final slide/object state and IDs;
- `exportPdf`: export the final native deck once for full rendering;
- `exportPptx`: optional secondary-format delivery;
- `publishLink`: return the canonical native presentation URL.

## Native invariants

- Preserve theme, masters, layouts, placeholder IDs, notes, links, and native media where the API supports them.
- Reuse rich native exemplars before building fresh slide-local structures.
- Keep meaning-bearing text editable.
- Map every retained/replaced/deleted object in a duplicated exemplar.
- Use object IDs, not array positions, for mutation targets.
- Complete structural changes before final ordering and rendering.
- Render the latest final native state, not the pre-import PPTX.

## Geometry implementation

Keep the design system platform-neutral until the native adapter boundary. The Slides API represents element size and position through dimensions and affine transforms with point or EMU units; convert named design guides and [theme spacing tokens](../../theming/tokens.md) once, use a single rounding policy, and reuse the resulting values throughout the mutation batch.

- Preserve and reuse inspected master, layout, placeholder, and exemplar geometry for an existing native deck.
- Use stable object IDs and groups for repeated structures; do not infer geometry targets from slide or element array positions.
- Define text styles from the design typography roles and component contract, including font family, size, weight, line spacing, paragraph spacing, and alignment. The Slides REST API does not expose a general PowerPoint-style internal-margin property for shapes; preserve inspected template insets when possible or implement component padding through explicit outer and inner geometry.
- Apply size, transform, shape, and text updates with narrow field masks so unrelated native properties survive.
- Read back final transforms, sizes, text styles, slide order, and object IDs, then export and inspect the native render because equal numeric guides can still differ optically after import or font substitution.

Read [API integration](api-integration.md) for request construction and [rendering](rendering.md) for native visual proof.

## Capability boundaries

The Google Slides API reads and writes slide objects, while the Google Drive API handles file import, export, copy, location, and sharing. A connector may expose both behind higher-level actions. Confirm which operations are callable before planning the mutation.

If the native connector is unavailable for a requested native deliverable, report the missing integration. Do not silently substitute a local PPTX.
