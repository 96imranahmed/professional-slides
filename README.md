# Professional Slides

A single Codex plugin for planning, building, and checking editable consulting presentations. Approved content flows through reusable components and an open composition tree into one resolved scene. HTML and PptxGenJS consume that scene; Artifact Tool imports the saved PowerPoint to verify names, geometry, and theme inheritance.

The McKinsey, BCG, and Bain palettes are independent, brand-inspired presets, not official firm templates or endorsements. Company fonts are configured separately.

## Structure

- `skills/professional-slides/SKILL.md` routes new decks, structural revisions, and bounded slide edits.
- `skills/professional-slides/references/` owns storylining, design, component semantics, charts, deck templates, platform guidance, and QA.
- `skills/professional-slides/runtime/` owns executable composition, tokens, component geometry, and adapters. Start with its [runtime guide](skills/professional-slides/runtime/README.md).
- `evals/` owns reusable validators and regression tests. Generated decks, scratch and evaluation reports belong under one ignored `output/` root.
- `.codex-plugin/plugin.json` exposes the one canonical skill.

## Use

Invoke `$professional-slides` with the audience, decision, evidence limits, delivery context, output platform, and any authorized reference. New decks require an approved storyline before authoring. Existing-deck and bounded-slide requests preserve the unaffected content and design.

The runtime currently produces editable PowerPoint primitives, including charts. Charts are not native workbook-backed chart objects. Google Slides remains a downstream import or separately validated platform workflow; PowerPoint parity does not prove Google Slides fidelity. The built-in media fixtures demonstrate placement, not a library of corporate logos or photographs.

## Distribution and user files

Build a clean package with `python3 evals/scripts/package_plugin.py`. The installable directory is `output/package/professional-slides`; point the marketplace entry or local install source there, never at a used working checkout. The allowlist includes reusable skills, runtime, validators and tests, with a hash inventory. It excludes local research, generated decks, scratch, dependencies and personal configuration. Installation does no generation.

Users create task artifacts in `output/<task>/` in their own project, outside the installed plugin. The canonical export runtime rejects plugin-local writes, including symlink aliases. A developer checkout may write only under its own `output/`. Retain the latest useful output and required rebuild/QA inputs; remove superseded task-owned intermediates rather than copying them into a release. See [artifact lifecycle](skills/professional-slides/references/tools/artifact-lifecycle.md).

## Extend

Use the [component contract](skills/professional-slides/runtime/README.md#component-contract) for geometry and variants, the [composition model](skills/professional-slides/references/composition/index.md) for relationships, and the [template authoring contract](skills/professional-slides/references/templates/authoring.md) for recurring audience decisions. Keep each semantic rule in its canonical owner.

Register every rendering variant with representative props and size. New registrations enter the golden set automatically. Components consume declared theme tokens; HTML serializes them as CSS variables, while PowerPoint materializes the same values and native theme. CSS is not a second layout engine.

## Development checks

`npm run check` runs syntax/whitespace checks and fast tests. `check:syntax` is not a semantic linter. These tests do not require regenerating cached visual reports after each edit. `npm run check:release` still requires a hash-verified golden set, including both render images for every fixture.

Rendering dependencies are pinned in `package.json` and their resolved transitive manifests in `evals/runtime-lock.json`. The lock records the Codex bundle, Node version and platform used for acceptance, including private packages unavailable through public npm. Run `"$RUNTIME_NODE" evals/scripts/runtime_lock.mjs` before rendering. A different bundle/platform requires a reviewed lock refresh and new visual acceptance, not a silent upgrade. Never modify bundled dependencies.

The table compiler uses Prettier 3.6.2 formatting; keep normalization, measurement and rendering in separate named helpers.

Use the bundled workspace dependencies returned by Codex's `load_workspace_dependencies`: set `RUNTIME_NODE`, `RUNTIME_NODE_MODULES`, `RUNTIME_PYTHON`, `RUNTIME_BIN_DIR`, and `PRESENTATION_SKILL_DIR`. Set `PLAYWRIGHT_BROWSER_PATH` if using a browser outside Playwright's installation. The Python environment needs PyYAML. Do not alter the bundled libraries.

```bash
"$RUNTIME_PYTHON" -m unittest discover -s evals/tests -p 'test_*.py'
"$RUNTIME_PYTHON" evals/scripts/validate_template_registry.py
"$RUNTIME_NODE" evals/scripts/generate_golden_set.mjs
"$RUNTIME_NODE" evals/scripts/generate_golden_set.mjs --check
```

Also run the installed plugin-creator's `validate_plugin.py` against this repository and skill-creator's `quick_validate.py` against the skill directory. After source changes, rebuild the clean package, reinstall from its marketplace entry and compare the installed manifest, skill, and eval files with the source.

### Golden component evaluation

Every golden run generates one canonical McKinsey deck containing all components, registered variants, layout fixtures, and standard compositions. Compatible variants share paginated review boards, with explicit instance-level coverage retained for every branch. Gates check coverage, text fit, overlaps, package structure, Artifact Tool readback, theme binding, and HTML-to-PPTX image parity. Inspect the paired renders and lowest-scoring fixtures as well as the reports.

Accepted runs remain under `output/golden/runs/`. `output/golden/index.html` points to the latest accepted set. A failed run cannot replace it; `golden:check` rejects evidence from changed sources. Do not reset `output/` for a golden rerun.

Automated checks do not establish sound writing, factual accuracy, or native PowerPoint/Google Slides behavior. Report the actual renderer used and any platform checks not performed.
