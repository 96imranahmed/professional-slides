# Evaluation

Use this guide to decide whether a deck is ready. The plugin repository's `evals/cases.json` defines the development cases, defect names, dimensions, and thresholds. `evals/run_evals.py` validates result files.

## Fresh-run isolation

Every evaluation starts by completely clearing only the repository's exact output directory and creating a new workspace under tmp/eval-runs:

~~~bash
python evals/scripts/prepare_eval_run.py --run-id <unique-run-id>
~~~

Never copy, seed, patch, or resume generated material from an earlier run. Prior generated eval materials are not inputs. Reference decks, fixtures, sources, skills, and runtimes may remain fixed.

Keep the run manifest with the evidence package. Control and treatment use separate subdirectories and may not inspect each other's outputs.

## Per-deck self-review

Review the exact final editable artifact, not only the source code or an intermediate render.

1. Render every slide.
2. Review the full montage for story, rhythm, and repetition.
3. Inspect every slide at full size.
4. Check titles, evidence, sources, and uncertainty.
5. Check clipping, overlap, broken assets, and unreadable text.
6. Apply the deletion test.
7. For PowerPoint, require the three accepted reports in [PowerPoint reports](#powerpoint-reports); follow the linked platform owners for commands and repair loops.

Every planned slide maps to exactly one sequenced dot. New decks and structural revisions require a validated pre-authoring contract. A missing executive summary is not a defect by itself in an existing deck when the revision did not authorize adding one.

## Hard release gates

Release only when all apply:

### Story

- The deck answers the brief and has one governing thought.
- The title spine reads as a clear executive memo.
- Each slide has one narrative job and one dominant exhibit.
- The executive summary, when required, preserves the approved governing branches and overall action.
- The close follows from the evidence.
- Missing data is explicit; a missing-data statement never counts as completed analysis.

### Evidence

- Claims reconcile with their exhibits and sources.
- Facts, estimates, claims, and inferences are distinguishable.
- Charts use the correct scale, units, labels, and series.
- Tables are composed exhibits rather than raw spreadsheet grids.
- No evidence is invented.

### Design

- The exact editable artifact and full-size renders pass the declared [theme](../theming/index.md), colour ledger, treatment ledger, and [design](../design/index.md) checks with no unexplained drift.
- Status tables and heatmaps pass [comparison indicators](../components/comparison-indicators.md); navigation passes [trackers](../components/trackers/index.md).
- Audience text passes [copy](../components/copy.md), and detached synthesis passes the [insight-box](../components/insight-box.md) cardinality and treatment checks.
- The chosen [composition](../composition/index.md) fits the evidence, keeps one dominant exhibit, and leaves no under-composed analytical canvas.
- Every slide passes the full-size anti-slop audit with no unexplained object, label, treatment, or inconsistency.

### Platform

- The requested editable format exists and opens.
- Native objects remain editable where expected.
- Fonts, charts, tables, notes, and sources survive export.
- PowerPoint and Google Slides are checked separately when both are requested.
- The final output directory contains only requested deliverables.

## PowerPoint validation owner

All PowerPoint contract, semantic, exported-file, per-slide visual, and cross-slide consistency gates are subcommands of `evals/scripts/validate_pptx.py`. The script reads the canonical storylining, composition, design, component, chart, and evaluation owners through its `SKILL_REFERENCE_MAP`; do not create a parallel validator rulebook or another `validate_pptx*.py` entrypoint.

## PowerPoint reports

Every final PowerPoint candidate requires three reports bound to the same exact PPTX hash and governing inputs:

- an accepted deterministic hard report from [PowerPoint hard acceptance](../tools/powerpoint/acceptance.md);
- an accepted per-slide visual report from [PowerPoint rendering and QA](../tools/powerpoint/rendering.md#independent-visual-reports);
- an accepted cross-slide consistency report from the same rendering owner, using a different approved judge model.

Every slide and deck dimension must score at least 90, every comparison group must accept, and no blocker or major finding may remain. The platform owners define commands, inspection scope, and rejection handling; this evaluation owner defines the release requirement.

## Consulting-toolkit source coverage

When the deliverable includes the consulting-toolkit HTML gallery, validate the exact file before visual review:

```bash
node evals/scripts/import_consulting_toolkit.mjs --source <consulting-toolkit/index.html>
```

The validator ignores the obsolete hand-picked section before `Source slide gallery`, verifies all 205 source cards against `slide-inventory.json`, and maps every source slide to registered components plus an open composition primitive. It rejects unknown components, unknown compositions, missing cards, extra cards, and uncovered slides. This inventory mapping measures capability coverage; it does not select layouts for production slides. Production selection begins from item jobs and content relationships.

## Component-runtime gate

After changing layout, tokens, components, charts, or adapters, run `evals/scripts/validate_component_runtime.mjs` with the bundled workspace runtime paths. It creates one isolated slide per registered component and named variant plus composition/planner fixtures, renders the HTML observer and exact saved PPTX, imports the PPTX with Artifact Tool, and rejects missing names, theme drift, or visual disagreement. Review both contact sheets and the lowest-scoring individual fixtures before accepting the report.

Require the overlap gate in both component and reference-fidelity reports. It checks rendered HTML line boxes and visible SVG geometry, then checks imported PPTX frames, paint order, recovered text, and explicit line counts. Reject text clipping, accidental text/text, text/rule, shape/shape, and connector collisions, and unequal peer heading clearances. A text backing must precede its text in native paint order. The imported-frame check does not replace exact-PPTX image review. Intentional containment and masking must match `runtime/overlap-policy.mjs`; a shared component, chart, or overlay alone never exempts a collision. Keep per-slide coverage and named violations, and test the gate with deliberately broken fixtures.

## Reference-fidelity gate

After changing the consulting-toolkit runtime, run `npm run validate:fidelity`. The gate generates eighteen source-mapped composition families, renders the HTML observer and exact native-only PPTX at 3840 by 2160, and compares both outputs against both source-image sets. It rejects package media, native chart parts, undeclared token use, missing Artifact Tool names, frame drift above one pixel, or any visual metric below its calibrated floor. Keep the accepted `evals/reference-fidelity-eval.json`; `evals/run_evals.py --check` rejects a stale source hash or incomplete fixture set.

## Reference-copy gate

After editing skill guidance or specimens, use Luna or Terra as an independent judge. Choose a model different from the authoring model:

```bash
python3 evals/scripts/validate_reference_copy.py --model gpt-5.6-terra
```

The judge reviews every reference file for concision, specificity, non-redundancy, and actionability. The script omits executable code but includes visible HTML specimen copy. Its JSON schema, exact file manifest, current reference hash, score threshold, and blocker rules are deterministic. Every dimension must score at least 90, with no blocker or major findings. `evals/run_evals.py --check` rejects missing, stale, malformed, or failed reports.

## Defects

The authoring term `critical` maps to the reporting severity `blocker`. Critical defects include corrupt or missing artifacts, invented evidence, misleading charts, unreadable renders, wrong platforms, and reference-fidelity breaches.

Major defects include missing required structure, a bypassed pre-authoring gate, wrong navigation, broken assets, unsupported titles, generic copy, repeated decorative components, raw tables, under-resolved exhibits, inconsistent headers, and typography or spacing drift.

Do not average defects away. One critical defect fails the deck. One major defect blocks release. The mean cannot compensate for a weak dimension.

## Skill-effectiveness evaluation

Self-review proves only that a deck is deliverable. It does not prove that the skill improves performance.

For a release comparison:

1. use the same brief, inputs, runtime, budget, and platform for control and treatment;
2. keep the arms independent;
3. blind reviewers to the arm;
4. score the configured dimensions;
5. record critical, major, and minor defects;
6. compare overall and per-dimension results;
7. require every threshold in cases.json.

The treatment passes only when it clears the absolute threshold, improves by the required amount, and does not create a material dimension regression.

## Result contract

Each result records:

- case ID and arm;
- artifact and render paths;
- pre-authoring review for self and treatment;
- dimension scores;
- critical, major, and minor defects;
- anti-slop review with one audit record per slide;
- deck-consistency review with material theme-manifest, treatment-ledger, and audit paths, full-deck comparison, palette-role verification, tracker-map verification, repeated-component verification, and zero unresolved findings;
- PowerPoint acceptance review with material manifest and report paths, the exact candidate hash, and `accepted: true` for every self or treatment PPTX;
- independent visual review with its material report path, approved judge model, exact candidate hash, iteration count, and `accepted: true` for every self or treatment PPTX;
- cross-slide consistency review with a material report path, a different approved judge model, the exact candidate hash, iteration count, and `accepted: true`;
- reference comparison when required;
- fresh-run preparation evidence;
- reviewer notes.

Validate results with:

~~~bash
python evals/run_evals.py validate-result path/to/result.json
~~~

The CLI requires every declared artifact, render, contract, validator output, and run manifest to exist as a non-empty file inside the fresh run workspace. Use the validator output as evidence. Do not claim a pass from a narrative summary alone.
