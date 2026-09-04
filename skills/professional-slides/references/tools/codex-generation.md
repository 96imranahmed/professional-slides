# Codex Generation

Use this guide when Codex creates or edits a presentation with its bundled presentation runtime. It owns runtime discovery and the generation loop. The canonical scene and PptxGenJS writer create net-new PowerPoint; Artifact Tool imports the exact saved file as the downstream observer. The [scene-to-native mapper](css-to-native-mapper.md) owns the shared adapter contract.

## Load the active runtime guidance

Call `mcp__codex_app__load_workspace_dependencies`, shown as `load_workspace_dependencies` in the app, before authoring. Require returned paths for the Node executable, Node modules, Python environment, and presentation rendering tools. Use those paths without installing or guessing another runtime. If the interface is unavailable or omits a required path, stop and report the missing capability.

Read the active bundled Presentations plugin `README.md` at `openai-primary-runtime/presentations/<active-version>/README.md` for the tools available in that Codex build. Then read the current package-exported API references:

- `@oai/artifact-tool/docs/presentations/API_QUICK_START.md`
- `@oai/artifact-tool/docs/presentations/api/API_DOCS.md`

Do not hard-code the plugin version or copy the runtime API catalog into this skill. Use `presentation.help(...)` for focused discovery when the API reference leaves a capability unclear.

## Render the reference before translating it

When the source is an HTML/CSS specimen, render it first at the intended slide aspect ratio and inspect the result at full size. The rendered specimen, not the DOM structure alone, is the visual target.

Record the resolved theme variables, font roles, content frame, region bounds, gaps, alignment, intrinsic widths, wrapping, borders, radii, shadows, and image crops. Use those measurements to define canonical scene tokens, component geometry, and composition constraints. Do not maintain an independent CSS layout that the PowerPoint writer must guess.

If the source is an existing deck, render and inspect the editable source before changing it. Preserve its master, layout, and slide hierarchy where the runtime supports them.

## Choose the closest editable construction

Map the rendered design to the canonical scene:

- Use row/column flow, grid, overlay, absolute, and nested section nodes for composition.
- Use positioned scene primitives for fixed page chrome, exact regions, and geometry that is not flow-driven.
- Use editable text boxes or paragraphs with runs for text. Preserve hierarchy, wrapping, and alignment before chasing minor optical differences.
- Use registered editable tables and chart primitives when the evidence is tabular or quantitative. Do not replace editable evidence with a screenshot.
- Use verified source images and vectors for visual assets. Preserve crop, focal treatment, and provenance.
- Resolve deck theme roles into shared runtime constants or supported token strings. Do not invent a second palette or scatter local values through the builder.

Do not translate HTML elements one for one. Translate the visual and semantic relationships. HTML is generated from the resolved scene only after composition; it does not control PowerPoint.

## Compare, repair, and export

Use short render loops while authoring:

1. Render the HTML/CSS or source-deck reference.
2. Build one representative scene component or composition family.
3. Render its HTML serialization and exact PptxGenJS output, then compare them at full size and foreground level.
4. Repair the mapping through shared geometry, theme, or component definitions rather than isolated slide nudges.
5. Repeat for every materially different slide family.

After the complete deck is built, export through PptxGenJS, run the [Artifact Tool compatibility proof](powerpoint/artifact-tool.md#required-interpretation-proof), and follow the canonical [PowerPoint rendering](powerpoint/rendering.md), [hard acceptance](powerpoint/acceptance.md), and [evaluation](../evaluation/index.md) owners. For consulting-toolkit changes, `npm run validate:runtime` and `npm run validate:fidelity` must both pass. Generation success is not release evidence.
