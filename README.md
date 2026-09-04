# Professional Slides

A single Codex plugin for planning, building, and checking editable consulting presentations. Approved content flows through reusable components and an open composition tree into one resolved scene. HTML and PptxGenJS consume that scene; Artifact Tool imports the saved PowerPoint to verify names, geometry, and theme inheritance.

The McKinsey, BCG, and Bain palettes are independent, brand-inspired presets, not official firm templates or endorsements. Company fonts are configured separately.

## Structure

- `skills/professional-slides/SKILL.md` routes new decks, structural revisions, and bounded slide edits.
- `skills/professional-slides/references/` owns storylining, design, component semantics, charts, deck templates, platform guidance, and QA.
- `skills/professional-slides/runtime/` owns executable composition, tokens, component geometry, and adapters. Start with its [runtime guide](skills/professional-slides/runtime/README.md).
- `evals/` owns validators, fixtures, scenario briefs, and regression tests.
- `.codex-plugin/plugin.json` exposes the one canonical skill.

## Use

Invoke `$professional-slides` with the audience, decision, evidence limits, delivery context, output platform, and any authorized reference. New decks require an approved storyline before authoring. Existing-deck and bounded-slide requests preserve the unaffected content and design.

The runtime currently produces editable PowerPoint primitives, including charts. Charts are not native workbook-backed chart objects. Google Slides remains a downstream import or separately validated platform workflow; PowerPoint parity does not prove Google Slides fidelity. The built-in media fixtures demonstrate placement, not a library of corporate logos or photographs.

## Extend

Use the [component contract](skills/professional-slides/runtime/README.md#component-contract) for geometry and variants, the [composition model](skills/professional-slides/references/composition/index.md) for relationships, and the [template authoring contract](skills/professional-slides/references/templates/authoring.md) for recurring audience decisions. Keep each semantic rule in its canonical owner.

Register every rendering variant with representative props and size. New registrations enter the golden set automatically. Components consume declared theme tokens; HTML serializes them as CSS variables, while PowerPoint materializes the same values and native theme. CSS is not a second layout engine.

## Development checks

Use the bundled workspace dependencies returned by Codex's `load_workspace_dependencies`: set `RUNTIME_NODE`, `RUNTIME_NODE_MODULES`, `RUNTIME_PYTHON`, `RUNTIME_BIN_DIR`, and `PRESENTATION_SKILL_DIR`. Set `PLAYWRIGHT_BROWSER_PATH` if using a browser outside Playwright's installation. The Python environment needs PyYAML. Do not alter the bundled libraries.

```bash
"$RUNTIME_PYTHON" -m unittest discover -s evals/tests -p 'test_*.py'
"$RUNTIME_PYTHON" evals/scripts/validate_template_registry.py
"$RUNTIME_NODE" evals/scripts/generate_golden_set.mjs
"$RUNTIME_NODE" evals/scripts/generate_golden_set.mjs --check
"$RUNTIME_NODE" evals/scripts/validate_reference_fidelity.mjs --source-root /path/to/consulting-toolkit
"$RUNTIME_PYTHON" evals/scripts/validate_reference_copy.py --model gpt-5.6-terra
"$RUNTIME_PYTHON" evals/run_evals.py --check
```

Also run the installed plugin-creator's `validate_plugin.py` against this repository and skill-creator's `quick_validate.py` against the skill directory. After source changes, reinstall `professional-slides@personal` and compare the installed manifest, skill, and eval files with the source.

### Golden component evaluation

Every golden run generates three palette decks containing all components, registered variants, layout fixtures, and standard compositions. Gates check coverage, text fit, overlaps, package structure, Artifact Tool readback, theme binding, and HTML-to-PPTX image parity. Inspect the paired renders and lowest-scoring fixtures as well as the reports.

Accepted runs remain under `output/golden/runs/`. `output/golden/index.html` points to the latest accepted set. A failed run cannot replace it; `golden:check` rejects evidence from changed sources. Do not reset `output/` for a golden rerun.

The source-fidelity gate additionally requires the authorized consulting-toolkit directory, including its inventory and both source-image sets. Those external reference assets are not distributed in this repository. Promote its newly accepted `reference-fidelity-report.json` to `evals/reference-fidelity-eval.json`; the release check rejects stale or incomplete evidence. Capability inventory is a separate check:

```bash
"$RUNTIME_NODE" evals/scripts/import_consulting_toolkit.mjs --source /path/to/consulting-toolkit/index.html
```

### End-to-end scenario evaluation

`evals/cases.json` contains authoring scenarios, not pre-generated results. Running tests or golden decks does not execute those scenarios. Supply the case's evidence and cutoff, generate its requested artifacts, and record per-case results before claiming scenario coverage.

For a user-authorized fresh scenario reset, `prepare_eval_run.py --run-id <unique-id>` clears this repository's generated `output/` directory and creates an isolated workspace. This also removes retained golden output, so preserve any golden set the user still needs elsewhere first. Do not reuse generated storylines, builders, renders, or QA from a previous scenario run. Validate completed results with:

```bash
"$RUNTIME_PYTHON" evals/run_evals.py --mode self --results /path/to/results.json
```

Automated checks do not establish sound writing, factual accuracy, or native PowerPoint/Google Slides behavior. Report the actual renderer used and any platform checks not performed.
