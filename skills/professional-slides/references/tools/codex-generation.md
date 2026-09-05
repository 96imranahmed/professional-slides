# Codex Generation

Use this guide when Codex creates or edits a presentation with its bundled presentation runtime. It owns runtime discovery and the generation loop. For net-new PowerPoint, `runtime/generation.mjs` is the production entrypoint: `writeCanonicalDeckPlan()` resolves the approved content plan through the same canonical scene, registry, theme tokens, HTML observer, PptxGenJS writer, and Artifact Tool observer used by the golden set. The [scene-to-native mapper](css-to-native-mapper.md) owns the shared adapter contract.

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

Follow the canonical [scene-to-native mapper pipeline](css-to-native-mapper.md#mapping-pipeline) for scene primitives, composition, editable evidence, token resolution, HTML serialization, PowerPoint writing, and Artifact Tool observation. Use the inspected reference measurements and semantic relationships as mapper inputs. Do not translate DOM elements one for one or replace editable evidence with a screenshot.

Do not author a separate raw PptxGenJS deck builder, even when it can pass output-only visual review. Import `writeCanonicalDeckPlan()` from `runtime/generation.mjs`, supply the approved deck plan, output directory, file stem, and the current authoring script path, and retain `canonical-generation-receipt.json`. The receipt binds the exact PPTX to the design manifest, scene, registry, runtime source hash, planning decisions, HTML observer, Artifact Tool observation, and authoring script. A missing, stale, or rejected receipt blocks the deck.

## Compare, repair, and export

Run the mapper's verification stage in short build, render, compare, and shared-repair loops for every materially different slide family. After the complete deck is built, hand off to the canonical [PowerPoint integration and release owner](powerpoint/index.md). Consulting-toolkit changes must also pass `npm run validate:runtime` and `npm run validate:fidelity`; generation success alone is not release evidence.
