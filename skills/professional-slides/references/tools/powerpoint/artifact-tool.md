# Artifact Tool adapter

For net-new Professional Slides output, PptxGenJS writes the canonical scene and `@oai/artifact-tool` is the required downstream adapter and observer. The saved PPTX is acceptable only when Artifact Tool can import, inspect, and render it without losing scene identity or theme semantics.

Artifact Tool may still be the authoring surface for a bounded existing-deck edit when its import/export path best preserves the inherited master, layout, and object tree. Do not mix both writers inside one candidate.

## Runtime setup

Load the host-provided workspace dependencies and read the package-exported references before use:

- `@oai/artifact-tool/docs/presentations/API_QUICK_START.md`
- `@oai/artifact-tool/docs/presentations/api/API_DOCS.md`

Use the returned Node, module, Python, and rendering paths. Do not install or guess a second runtime.

## Downstream adapter contract

Import the exact saved file:

```js
const presentation = await PresentationFile.importPptx(
  await FileBlob.load(candidatePptx),
);
```

Then collect:

- deck, slide, shape, textbox, chart, table, image, notes, and layout inspection records;
- one layout export per slide;
- the presentation proto for theme colors and fonts;
- one PNG per slide from the exact imported candidate.

Normalize these outputs into `professional-slides.observed-deck/v1`. Strip only the `ps:` namespace when comparing object names; retain the complete name in raw inspection evidence.

## Required interpretation proof

For a canonical-scene candidate, require all of the following:

- imported slide count equals scene slide count;
- every scene node has one recovered named object;
- every recovered object frame is within one pixel of its canonical scene frame;
- the color scheme and font scheme are named `Professional Slides`;
- every native palette slot equals the canonical token binding;
- slide size equals the canonical canvas conversion;
- the package contains no rasterized component media or native chart parts;
- the imported render passes parity against the HTML serialization.

The implementation lives at [`skills/professional-slides/runtime/adapters/artifact-tool.mjs`](../../../runtime/adapters/artifact-tool.mjs). The isolated gate is [`evals/scripts/validate_component_runtime.mjs`](../../../../../evals/scripts/validate_component_runtime.mjs), and the source-mapped gate is [`evals/scripts/validate_reference_fidelity.mjs`](../../../../../evals/scripts/validate_reference_fidelity.mjs). These repository-relative links are checked by the source-structure test.

## Existing-deck edits

When Artifact Tool authors a bounded imported-deck change, inspect before resolving targets and use stable IDs. Preserve inherited masters, layouts, objects, mixed text runs, and notes, then follow [PowerPoint rendering and QA](rendering.md). If the API cannot preserve a required source structure, report that boundary instead of silently rebuilding the slide.

## Failure boundaries

- Import success is not compatibility proof.
- An in-memory render is not saved-file proof.
- Object count without stable-name parity is insufficient.
- A correct theme palette does not prove that slide objects reference the intended color-map roles.
- Full-slide similarity alone is insufficient for sparse slides; use foreground comparison.
- Do not accept a PPTX whose charts, wedges, annotations, or legends visibly differ from the HTML fixture.
