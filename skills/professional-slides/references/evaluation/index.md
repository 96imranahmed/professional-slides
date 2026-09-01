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
7. Repair defects and rerun the checks.

Every planned slide maps to exactly one sequenced dot. New decks and structural revisions require a validated pre-authoring contract. A missing executive summary is not a defect by itself in an existing deck when the revision did not authorize adding one.

## Hard release gates

Release only when all apply:

### Story

- The deck answers the brief and has one governing thought.
- The title spine reads as a clear executive memo.
- Each slide has one narrative job and one dominant exhibit.
- The executive summary, when required, is the registered synthesis slide type.
- The close follows from the evidence.
- Missing data is explicit; a missing-data statement never counts as completed analysis.

### Evidence

- Claims reconcile with their exhibits and sources.
- Facts, estimates, claims, and inferences are distinguishable.
- Charts use the correct scale, units, labels, and series.
- Tables are composed exhibits rather than raw spreadsheet grids.
- No evidence is invented.

### Design

- One identical component-primary swatch governs structural emphasis.
- The exact final editable artifacts pass the declared colour ledger with no undeclared editable-object colours or unexplained role-to-swatch drift.
- Additional colours encode real data, not decoration or status.
- Every traffic-light table and heatmap includes a readable same-slide legend with the exact states, thresholds, anchors, and palette used in the exhibit.
- Trackers communicate navigation only and are omitted when unnecessary.
- Analytical headers and tracker labels are consistent across their declared ranges.
- Every full tracker page shows the complete approved numbered and labelled item set; every tracked analytical page carries the correct selected compact state without gaps.
- Copy has no redundant role label or reserved label column.
- A terminal action, implication, recommendation, or call to action is used only when it adds distinct meaning. These are mutually exclusive states of the same component.
- Every section contains at most one insight box or terminal action surface, and ordinary analytical slides do not repeat the component across rows, columns, branches, metrics, or charts.
- The layout fits the evidence and is not a repeated card, column, or process template.
- No under-composed core analytical canvas remains.
- Every slide passes the full-size anti-slop audit.
- The final artifact readback contains zero Unicode em dash characters. Any match is a release-blocking defect with no exceptions.

### Platform

- The requested editable format exists and opens.
- Native objects remain editable where expected.
- Fonts, charts, tables, notes, and sources survive export.
- PowerPoint and Google Slides are checked separately when both are requested.
- The final output directory contains only requested deliverables.

## Defects

Critical defects include corrupt or missing artifacts, invented evidence, misleading charts, unreadable renders, wrong platforms, and reference-fidelity breaches.

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
- deck-consistency review with material theme-manifest and audit paths, full-deck comparison, palette-role verification, tracker-map verification, repeated-component verification, and zero unresolved findings;
- reference comparison when required;
- fresh-run preparation evidence;
- reviewer notes.

Validate results with:

~~~bash
python evals/run_evals.py validate-result path/to/result.json
~~~

The CLI requires every declared artifact, render, contract, validator output, and run manifest to exist as a non-empty file inside the fresh run workspace. Use the validator output as evidence. Do not claim a pass from a narrative summary alone.
