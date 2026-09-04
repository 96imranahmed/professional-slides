# Google Slides API Integration

Use the workspace-configured native connector when it supports the required read, mutation, readback, and export operations. Use direct Google REST APIs only when the host exposes them or the user explicitly requests that route.

## Codex connector route

For an existing native presentation:

1. Resolve the presentation ID from the canonical URL.
2. Fetch the full presentation resource; omit restrictive fields during the initial design-system parse.
3. Write the raw response to a task workspace rather than placing a large deck in model context.
4. Parse masters, layouts, placeholders, styles, theme colors, slide IDs, and exemplar geometry.
5. Render the unchanged source once and inspect every slide.
6. Copy the source once for template-following work.
7. Apply consolidated native mutations.
8. Read back the final structure once, finalize order, and remove unused source slides last.

For net-new native delivery, use the route selected in the [Google Slides route table](index.md#route-the-request). This file owns only the import mechanics below.

## Google Slides REST API

The service endpoint is `https://slides.googleapis.com`. Core methods:

- `POST /v1/presentations` creates a blank presentation;
- `GET /v1/presentations/{presentationId}` returns current structure;
- `POST /v1/presentations/{presentationId}:batchUpdate` applies mutations;
- `GET /v1/presentations/{presentationId}/pages/{pageObjectId}` reads a page;
- `GET /v1/presentations/{presentationId}/pages/{pageObjectId}/thumbnail` generates a slide thumbnail.

Use Google client libraries when available. Authenticate with the least scope that supports the requested operation; separate file-sharing authorization from content-edit authorization.

## Batch updates

Build a deterministic ordered request list. Common request types include:

- `createSlide` or `duplicateObject`;
- `updateSlidesPosition`;
- `createShape`, `createImage`, `createTable`, or `createSheetsChart`;
- `insertText`, `deleteText`, and paragraph/bullet operations;
- `updateTextStyle`, `updateShapeProperties`, `updatePageProperties`;
- `replaceAllText` only for controlled, unique placeholders;
- `deleteObject` for explicitly mapped stale objects.

Specify object IDs when later requests in the same batch refer to newly created objects. Keep IDs stable in the storyboard/operation map. Do not infer target IDs from page order after structural mutations.

Use field masks for update requests so unrelated properties remain unchanged. Read back the updated presentation and verify requested changes against actual object state.

## Geometry and text-style operations

Translate the named design guides, [theme roles and spacing tokens](../../theming/tokens.md), and component contracts into Slides API values at one adapter boundary. The API accepts point or EMU dimensions and uses affine transforms for page-element position and scale; do not mix units inside one geometry helper or repeatedly round converted values.

- Use `createShape`, `createImage`, `createTable`, `createSlide`, or `duplicateObject` to establish native objects and stable IDs.
- Use element size and `updatePageElementTransform` operations for position and scale. Preserve existing rotation and shear unless the requested design changes them.
- Use `updateShapeProperties` for fills, outlines, shadows, and shape-level text-container behavior; use narrow field masks.
- Use `updateTextStyle`, `updateParagraphStyle`, bullet requests, and text-range operations to apply design roles without flattening mixed text runs.
- Derive panel padding, continuation labels, trackers, and footers from component definitions, not local literals. The Slides REST API lacks a general internal-margin setting. Preserve inspected template geometry or place a separate inner text box within the component bounds.
- Group objects only when the group represents a reusable or jointly moving component, and only when the object types support grouping; tables, placeholders, and videos cannot be grouped. Do not group unrelated objects merely to simplify selection.
- Read back the final size, transform, text runs, paragraph styles, and object IDs after mutation. Then render the native deck to catch font reflow, crop changes, chart padding, and optical drift that structural readback cannot prove.

## Template and exemplar operations

Prefer `duplicateObject` for a rendered exemplar with rich slide-local content. Use `createSlide` from an inspected layout only when inherited placeholders are sufficient. Before duplicating, map every image, video, chart, table, group, shape, text box, footer, and placeholder to keep, replace, rewrite, or delete.

Preserve mixed text runs and native bullet formatting. Avoid broad `deleteText(ALL)` plus uniform restyling because it destroys template hierarchy. Delete unused bulleted paragraphs rather than leaving blank bullets.

## Google Drive import

To convert a PPTX to Google Slides through Drive API v3, create a file with Google Slides MIME type while uploading the PowerPoint media:

```text
metadata mimeType: application/vnd.google-apps.presentation
media mimeType: application/vnd.openxmlformats-officedocument.presentationml.presentation
```

Check `about.importFormats` because supported conversions are dynamic. Import creates a native presentation; updating an existing native file with converted media replaces its full content, so do not use it as a patch operation.

After import:

- capture the native file ID and canonical URL;
- read back the native presentation;
- verify slide count and order;
- render all slides;
- repair conversion defects natively.

## Google Drive export

Use Drive `files.export` for Google Workspace files. Relevant target MIME types include PDF and Microsoft PowerPoint. Verify the current export-format table before relying on a target type.

Export is a snapshot of native state. Use the exported PDF for rendering and the exported PPTX only when the user requested a PowerPoint copy; do not assume the PPTX is visually identical without separate QA.

## Readback and concurrency

- Read the latest presentation immediately before a mutation that depends on object IDs or order.
- Use revision/write-control facilities when the integration exposes them.
- Consolidate mutations to reduce race windows and quota use.
- Do not keep stale object references after slides are duplicated, deleted, or reordered.
- Confirm the delivered slide IDs and final order through one structural readback before output rendering.

## API failure handling

- Treat invalid object IDs, mismatched placeholders, and unsupported properties as planning errors; re-read structure rather than guessing.
- Retry transient quota/service errors with bounded exponential backoff.
- Do not replay a non-idempotent batch blindly after an ambiguous failure; read back first.
- Do not make more than two visual repair batches without a concrete new defect or a structural change that invalidates QA.

## Official references

- [Google Slides API reference](https://developers.google.com/workspace/slides/api/reference/rest)
- [Slide operations](https://developers.google.com/workspace/slides/api/samples/slides)
- [Batch requests](https://developers.google.com/workspace/slides/api/guides/batch)
- [Drive uploads and Workspace import](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Drive export formats](https://developers.google.com/workspace/drive/api/guides/ref-export-formats)
