# Artifact Tool API

Use `@oai/artifact-tool` when the Codex presentation runtime is available. It is
the primary local PPTX authoring adapter because it can create editable objects,
import existing files, inspect stable IDs, render slides, export layout data,
and write PPTX.

## Runtime setup

Load the host-provided workspace dependencies. Use the returned absolute paths
for Node, Node modules, and rendering binaries. Do not guess or install a second
runtime. Put builders and intermediate artifacts in a task-specific temporary
directory.

For a standalone `.mjs` builder using a bare import, make the host-provided Node
modules visible from that temporary directory without modifying the dependency
bundle.

```js
import fs from "node:fs/promises";
import {
  FileBlob,
  Presentation,
  PresentationFile,
} from "@oai/artifact-tool";
```

## Create

Create the presentation with an explicit slide size and implement theme tokens
before adding slide-local content.

```js
const presentation = Presentation.create({
  slideSize: { width: 1280, height: 720 },
});
const slide = presentation.slides.add();
```

Use native collections for shapes, text, images, tables, and charts. Use
consistent object names for deterministic inspection and later repairs.

## Import and edit

Import an existing PPTX rather than recreating it:

```js
const presentation = await PresentationFile.importPptx(
  await FileBlob.load(sourcePptx),
);
```

Inspect before resolving targets:

```js
const inventory = await presentation.inspect({
  kind: "slide,textbox,shape,image,table,chart,notes,layout",
  maxChars: 12000,
});
```

Resolve by inspected ID. For reference-template work, preserve masters/layouts,
duplicate the nearest source slide, and edit inherited objects in place. Do not
blank text broadly or add new overlays above unused placeholders.

## Render during authoring

Render an affected slide plus its layout metadata:

```js
const png = await presentation.export({
  slide,
  format: "png",
  scale: 1,
});
const layout = await slide.export({ format: "layout" });
```

Render the full presentation as a montage for deck-level rhythm:

```js
const montage = await presentation.export({
  format: "webp",
  montage: true,
  scale: 1,
});
```

The montage is supplementary. Inspect each full-size slide render separately.

## Export the candidate

```js
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(finalPptx);
```

The exported file becomes the candidate of record. Re-render that exact PPTX
through the exported-file path in [rendering](rendering.md); the in-memory render
does not prove that PPTX serialization preserved every element.

## Source templates

When the source PPTX supplies the design:

- inspect every source slide and layout;
- preserve theme parts and the master/layout hierarchy;
- map every output slide to a source exemplar;
- edit inherited objects by stable ID;
- preserve mixed text-run and paragraph styles;
- fill or delete every inherited placeholder intentionally;
- compare the final render to the mapped source pattern.

If the tool cannot preserve a required source structure, stop and report the
specific unsupported operation. Do not silently replace the source with a
theme-matched rebuild.

## Notes and provenance

Use the native speaker-notes API when supported. Maintain a `[Sources]` block
for externally sourced claims and assets. Inspect the exported notes before
delivery because import/export behavior can differ from visible-slide behavior.

## Failure boundaries

- Do not use a successful `exportPptx` call as visual proof.
- Do not ignore connector-routing, overflow, or overlap warnings.
- Do not use direct OOXML mutation as a routine authoring path.
- Do not use a rasterized slide as the editable deliverable.
- Do not mix a source template with a second layout library.

## Local API source

The authoritative implementation reference in Codex is the bundled
Presentations skill's `artifact_tool_docs/API_QUICK_START.md` and
`artifact_tool_docs/api/API_DOCS.md`. Load those current local files before
writing a builder rather than relying on examples copied into this repository.
