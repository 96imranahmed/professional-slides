# Office.js and Microsoft Graph

Use Office.js when code is running inside a PowerPoint add-in and must interact with the currently open presentation. Use Microsoft Graph for OneDrive or SharePoint file transport, permissions, versions, download, or server-side format conversion. They solve different layers of the workflow.

## Office.js PowerPoint object model

Mutations run inside `PowerPoint.run` and are committed with `context.sync()`:

```js
await PowerPoint.run(async (context) => {
  const slide = context.presentation.getSelectedSlides().getItemAt(0);
  const box = slide.shapes.addTextBox("Decision-ready title", {
    left: 48,
    top: 36,
    width: 620,
    height: 48,
  });
  box.name = "action-title";
  box.textFrame.textRange.font.bold = true;
  await context.sync();
});
```

The API uses points for shape position and size. Slides, shapes, text frames, text ranges, fills, lines, groups, masters, and layouts have different support levels across PowerPoint clients and requirement sets. Check support at runtime with `Office.context.requirements.isSetSupported()`.

### Slides and layouts

`SlideCollection.add()` creates a slide. `AddSlideOptions` can select a known master/layout pair. Master and layout IDs are opaque and a selected layout must belong to the selected master. Maintain a friendly-name-to-ID map derived from the current deck; do not hardcode IDs from another presentation.

Indexing is not uniform across all APIs: PowerPoint collections commonly use zero-based `getItemAt`, while some Common API selection results use one-based slide indexes. Normalize indexes at the adapter boundary.

### Shapes and stable targeting

`slide.shapes` can add geometric shapes, lines, and text boxes. Set intentional names on created shapes. Where supported, bindings can provide stable access to objects that must be refreshed from an external data source.

Batch logical changes within one `PowerPoint.run` call when practical. Load only the properties needed, synchronize, then mutate. Handle deleted or missing objects explicitly instead of recreating duplicates.

### Retrieve the current PPTX

The Common API's `Office.context.document.getFileAsync()` can retrieve the current document. `Office.FileType.Compressed` yields PPTX bytes in slices. Close the returned file after reading all slices. This is the bridge from an in-app edit session to external storage or rendering.

Do not assume every host supports PDF retrieval through the same method. Detect the file-type capability and use a supported external render path.

## Microsoft Graph DriveItem API

Graph stores the finished PPTX in OneDrive or SharePoint. Core operations:

- upload/replace a small file with `PUT .../content`;
- create an upload session for large files;
- download with `GET .../content` and follow the short-lived preauthenticated redirect;
- request a supported conversion with `GET .../content?format=pdf`;
- manage filename, parent, permissions, versions, and sharing separately.

Graph does not expose the PowerPoint slide/shape object model. Do not use file upload success as evidence that the deck renders correctly.

### Upload

Use a binary body and the least-privileged file permission suitable for the user's scope. For small files:

```http
PUT /me/drive/items/{parent-id}:/{filename}.pptx:/content
Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation
```

Use an upload session for larger files or unreliable networks. Record the returned DriveItem ID and eTag for readback.

### Download and conversion

```http
GET /me/drive/items/{item-id}/content
GET /me/drive/items/{item-id}/content?format=pdf
```

Download URLs are preauthenticated and temporary; do not persist them. Download the file/PDF into the task workspace, verify bytes and page count, and render locally.

## Integration sequence

```text
Office.js edit -> context.sync -> getFileAsync(compressed)
-> verify PPTX bytes -> render/QA -> Graph upload
-> Graph readback/download -> hash/metadata verification
```

For a server-generated deck, skip Office.js and author locally. For an in-app interactive add-in, do not upload or overwrite a cloud file until the user has authorized that state change.

## Official references

- [PowerPoint add-ins](https://learn.microsoft.com/en-us/office/dev/add-ins/powerpoint/)
- [PowerPoint JavaScript object model](https://learn.microsoft.com/en-us/office/dev/add-ins/powerpoint/core-concepts)
- [Create and format shapes](https://learn.microsoft.com/en-us/office/dev/add-ins/powerpoint/shapes)
- [Add and delete slides](https://learn.microsoft.com/en-us/office/dev/add-ins/powerpoint/add-slides)
- [Get the whole document](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/get-the-whole-document-from-an-add-in-for-powerpoint-or-word?tabs=powerpoint)
- [Upload DriveItem content](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0)
- [Download DriveItem content](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0)
- [Convert DriveItem content](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content-format?view=graph-rest-1.0)
