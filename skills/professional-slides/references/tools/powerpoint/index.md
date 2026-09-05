# PowerPoint Integration

Read this folder for every PPTX deliverable. Choose the authoring surface first, then follow its rendering path. Do not mix APIs opportunistically inside one deck unless a documented round trip preserves the theme, master/layout tree, object editability, and notes.

## Files

- [PptxGenJS](pptxgenjs.md): the production writer for the canonical scene, with explicit calls for masters, editable text, shapes, tables, chart primitives, notes, and file output.
- [Artifact Tool](artifact-tool.md): the required downstream adapter and observer for import, inspection, rendering, and compatibility proof. It remains available for bounded edits when import preservation is the primary need.
- [Office.js and Microsoft Graph](office-js-and-graph.md): editing inside a running PowerPoint client and storing/distributing files through OneDrive or SharePoint.
- [Rendering](rendering.md): native render, exported-file render, overflow checks, contact sheets, and release evidence.
- [Hard acceptance](acceptance.md): exported-PPTX package, copy-budget, theme-variable, and repeated-role validation.

## Select the integration

| Situation | Authoring surface | File transport | Rendering |
| --- | --- | --- | --- |
| Codex creates a new local PPTX | canonical scene -> PptxGenJS | Local filesystem | Artifact Tool import plus exact saved-PPTX render and HTML parity |
| Codex performs a bounded imported-deck edit | Artifact Tool when it preserves the source hierarchy | Local filesystem | Artifact Tool PNG/layout plus final-PPTX render |
| Agent runs inside PowerPoint | Office.js PowerPoint API | Current open document | Export current document, then PowerPoint/PDF render |
| Store or publish a finished PPTX | None; do not edit through Graph | Microsoft Graph DriveItem upload/download | Graph PDF conversion or downloaded-file renderer |
| Existing reference/template | Import and edit inherited source objects | Local or cloud file provider | Before/after source-pattern comparison |

Microsoft Graph is a file/storage API for this workflow. Do not describe it as a shape-level PowerPoint authoring API. Office.js is the Microsoft API for interacting with slides and shapes in an open PowerPoint host.

## Common adapter contract

Use the [platform contract](../index.md) and [scene-to-native mapping](../css-to-native-mapper.md). The selected adapter owns its concrete API calls and unit conversion. [Rendering](rendering.md) and [hard acceptance](acceptance.md) determine delivery eligibility.

## PowerPoint-specific boundaries

- Preserve the source master -> layout -> slide hierarchy for template work.
- Put only static repeated furniture and inherited placeholders in masters or layouts. Build data-bearing repeated components from one shared component definition.
- Preserve or explicitly replace speaker notes and source blocks.
- Do not claim desktop PowerPoint behavior unless the file was opened there.
- Office.js reads the existing master, layout, placeholder, shape, and text properties before applying deltas; it preserves the host geometry rather than rebuilding from neutral defaults.

## Capability detection

Check capabilities before authoring:

- Can the runtime import and export PPTX?
- Can it preserve themes, masters, layouts, and notes?
- Can it render slides and return object/layout metadata?
- Can it create editable chart primitives and native tables while preserving the scene contract?
- Can it access the required fonts?
- Can the Office.js host satisfy the required PowerPoint API set?
- Can the storage API upload, download, or convert the final file?

If a required capability is missing, choose a supported adapter before editing. Do not discover the limitation after rebuilding the deck.
