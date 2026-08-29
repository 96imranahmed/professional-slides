# PowerPoint Integration

Read this folder for every PPTX deliverable. Choose the authoring surface first,
then follow its rendering path. Do not mix APIs opportunistically inside one
deck unless a documented round trip preserves the theme, master/layout tree,
object editability, and notes.

## Files

- [Artifact Tool](artifact-tool.md): Codex-native creation, import, inspection,
  editing, rendering, and PPTX export.
- [Office.js and Microsoft Graph](office-js-and-graph.md): editing inside a
  running PowerPoint client and storing/distributing files through OneDrive or
  SharePoint.
- [Rendering](rendering.md): native render, exported-file render, overflow
  checks, contact sheets, and release evidence.

## Select the integration

| Situation | Authoring surface | File transport | Rendering |
| --- | --- | --- | --- |
| Codex creates or edits a local PPTX | `@oai/artifact-tool` | Local filesystem | Artifact Tool PNG/layout plus final-PPTX render |
| Agent runs inside PowerPoint | Office.js PowerPoint API | Current open document | Export current document, then PowerPoint/PDF render |
| Store or publish a finished PPTX | None; do not edit through Graph | Microsoft Graph DriveItem upload/download | Graph PDF conversion or downloaded-file renderer |
| Existing reference/template | Import and edit inherited source objects | Local or cloud file provider | Before/after source-pattern comparison |

Microsoft Graph is a file/storage API for this workflow. Do not describe it as
a shape-level PowerPoint authoring API. Office.js is the Microsoft API for
interacting with slides and shapes in an open PowerPoint host.

## Common adapter contract

Whatever host implements the skill, keep these stages explicit:

```text
read(source?) -> inspect -> plan -> author/edit -> export -> render -> inspect -> revise -> publish
```

The platform adapter should expose the equivalent of:

- `readDeck`: obtain the full presentation or import the PPTX;
- `inspectDeck`: return stable slide/object/layout identifiers and properties;
- `applyOperations`: create or mutate editable objects;
- `exportPptx`: write the exact candidate deliverable;
- `renderDeck`: produce one ordered image per final slide;
- `publish`: upload only after the candidate passes QA.

Keep source reads and mutations separate. A successful API mutation is not a
quality result; only the rendered exported candidate is eligible for delivery.

## Non-negotiable invariants

- Preserve the source master -> layout -> slide hierarchy for template work.
- Use stable object IDs or names; do not target objects only by visual order.
- Make charts, tables, text, and simple diagrams editable.
- Keep recurring components in masters/layouts.
- Preserve or explicitly replace speaker notes and source blocks.
- Shorten copy or change layouts before shrinking text.
- Render every slide from the latest final PPTX.
- Do not claim desktop PowerPoint behavior unless the file was opened there.

## Capability detection

Check capabilities before authoring:

- Can the runtime import and export PPTX?
- Can it preserve themes, masters, layouts, and notes?
- Can it render slides and return object/layout metadata?
- Can it create native charts and tables?
- Can it access the required fonts?
- Can the Office.js host satisfy the required PowerPoint API set?
- Can the storage API upload, download, or convert the final file?

If a required capability is missing, choose a supported adapter before editing.
Do not discover the limitation after rebuilding the deck.
