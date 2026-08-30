# Evaluation

This file is the sole human-facing evaluation guide. `cases.json` contains the editable evaluation cases and thresholds; `run_evals.py` validates result data and applies the gates. A deck passing self-review does not prove the skill is effective—effectiveness requires a blinded control-versus-treatment comparison.

## Per-deck self-review

Run this loop before delivering any deck:

1. Freeze the exact editable artifact and render every slide from that artifact.
2. Collect the storyboard, source ledger, QA ledger, platform readback, full-size slide renders, and deck montage.
3. Inspect every release gate below and repair all critical or major defects.
4. Score the final artifact with the rubric in this file and cite at least one concrete observation for every dimension.
5. Record a result with `arm: "self"` and run:

   ```bash
   python evals/run_evals.py --mode self --results result.json
   ```

6. Regenerate and re-render after every material repair until the gate passes.

For dual-format work, freeze and score the final PPTX and native Google Slides deck separately. Preserve the exact PPTX, canonical Slides URL and presentation ID, separate renders and readbacks, and a parity ledger. Evidence from one platform cannot stand in for the other.

Self-review is a delivery safeguard. Never report its score as causal evidence that the skill improves deck quality.

## Release gates

All gates are required unless the user explicitly narrows the deliverable.

### Brief and story

- audience, decision, governing thought, delivery mode, and output are resolved;
- the story has a cumulative arc and an answer-first executive synthesis;
- each slide has one narrative job, one claim, and one dominant exhibit;
- action titles read as a coherent executive memo;
- the close resolves the opening and names the decision or next action;
- essential proof remains in the core story rather than being hidden in appendix.

### Evidence

- claims are verified or explicitly marked illustrative or unresolved;
- values reconcile with labels, units, periods, currencies, and populations;
- actual, estimate, forecast, target, and scenario states are explicit;
- sources and material transformations are traceable;
- no facts, quotes, images, logos, people, citations, or calculations are invented.

### Design and visual integrity

- one theme governs typography, color, spacing, shapes, charts, and components;
- title, content, source, footer, and navigation anchors are consistent;
- every full-size slide has a clear first read and evidence hierarchy;
- there is no unintended overlap, clipping, overflow, broken wrapping, unreadable label, unresolved placeholder, or production note;
- charts, tables, image crops, connectors, contrast, and non-color semantics work;
- the montage shows deliberate rhythm without sudden changes or repeated gimmicks;
- template tutorials, construction grids, indexes, and sample branding are absent.

Investigate every overlap warning. Record rare intentional overlaps as explicit design decisions rather than suppressing them silently.

### Platform and delivery

- the requested editable deliverable exists, opens, and matches its final renders;
- PowerPoint masters, layouts, charts, tables, and text remain safely editable;
- Google Slides is native and has been checked after import for fonts, wraps, crops, chart semantics, line weights, notes, and links;
- dual-format outputs are validated independently;
- filenames and versions are clear, only requested artifacts are delivered, and limitations are concrete;
- completion claims rely on the latest final artifact and render set.

## Defect handling

Track defects during the internal loop:

| Slide | Gate | Defect | Severity | Fix | Re-rendered | Status |
| --- | --- | --- | --- | --- | --- | --- |

- **Critical:** wrong conclusion or data, corrupt/missing artifact, unreadable content, misleading chart, or inaccessible deliverable.
- **Major:** clipping, overlap, broken hierarchy, font reflow, inconsistent component, missing source, or material template deviation.
- **Minor:** local spacing, alignment, or polish issue that does not affect meaning.

Do not deliver with critical or major defects. A minor defect may remain only when it is tool-limited, does not change meaning, and is disclosed.

## Skill-effectiveness evaluation

Run the matched evaluation before publishing a material change to instructions, cases, platform routes, or generation behavior.

For every enabled case in `cases.json`:

1. create isolated control and treatment workspaces;
2. hold model, runtime, prompt, fixtures, source access, budget, and platform route constant;
3. make this skill unavailable only in control and load it normally in treatment;
4. start both arms from fresh context and prevent cross-arm inspection;
5. preserve editable artifacts, final renders, generation traces, storyboards, source ledgers, and QA evidence;
6. use exact exported PowerPoint renders and native Google Slides renders.

A case with `fixture.required: true` may be skipped only when the authorized fixture is unavailable. Record the reason and do not include it in the denominator; never invent a substitute reference.

### Blind evaluation protocol

Randomize artifact labels so the evaluator cannot infer the arm. Supply only the brief, authorized fixtures, final editable artifact or platform readback, final slide renders, montage, source ledger, and QA evidence. Do not reveal skill instructions, arm names, filenames, or generation commentary.

The evaluator must:

1. confirm the requested deliverable and final-artifact evidence;
2. read action titles in order and summarize the argument;
3. inspect every slide at full size and the montage;
4. reconcile numbers, chart semantics, units, and sources;
5. verify platform correctness and editability;
6. score all dimensions below from 1 to 5;
7. identify only allowed critical-failure codes;
8. cite slide- or object-level evidence for every dimension and failure.

Do not award points for extra slides, complexity, brand imitation, or claims of QA without current renders. Penalize decorative structure, vague titles, untraceable evidence, conversion defects, and polished work that does not enable the requested decision.

After evaluation, restore `control` and `treatment` labels and run:

```bash
python evals/run_evals.py --mode release --results result.json
```

The release passes only when every runnable case has both arms, treatment meets the absolute and improvement thresholds, no treatment has a critical failure, and no dimension regresses beyond the configured tolerance.

## Scoring rubric

Score whole numbers from 1 to 5 using only final-artifact evidence. The runner converts the mean to a 100-point score.

| Score | Meaning |
| --- | --- |
| 1 | Fails the brief or has material defects; extensive rework required |
| 2 | Partially usable with major gaps or inconsistent execution |
| 3 | Competent and usable with visible improvement opportunities |
| 4 | Executive-ready and coherent with only minor issues |
| 5 | Exceptional, persuasive, polished, and robust under inspection |

| Dimension | What to judge |
| --- | --- |
| `briefFidelity` | Audience, decision, scope, format, and unsupported-content discipline |
| `narrativeLogic` | Governing thought, chapter logic, action-title spine, slide jobs, and close |
| `slideDesign` | Hierarchy, density, alignment, typography, contrast, composition, and rhythm |
| `chartIntegrity` | Encoding choice, reconciliation, scales, units, states, annotations, and title proof |
| `platformCorrectness` | Requested native deliverable, authoring route, openability, and render match |
| `editability` | Safe editing of text, charts, tables, diagrams, masters, layouts, and groups |
| `sourceIntegrity` | Traceability, periods, units, transformations, honest unknowns, and reference fidelity |
| `qaEvidence` | Current renders, full-deck inspection, readback, defects, and evidence-backed claims |

Allowed critical failures are:

- `corrupt_artifact`
- `missing_deliverable`
- `invented_evidence`
- `misleading_chart`
- `unreadable_render`
- `wrong_platform`
- `reference_fidelity_breach`

Apply a critical failure only when material; describe its location and impact.

## Result contract

The result JSON contains `runId`, ISO-like `createdAt`, optional `skippedCases`, and a non-empty `results` array. Each result contains:

- `caseId` matching an enabled case;
- `arm`: `self`, `control`, or `treatment`;
- non-empty `artifactPaths` and `renderPaths`;
- `scores` containing exactly the eight configured dimensions, each from 1 to 5;
- `criticalFailures` containing only configured codes;
- `evidence` with at least one concrete observation per dimension;
- optional `notes`.

Store result packages outside the skill unless they are intentionally curated fixtures. Preserve randomized label mappings separately from evaluator inputs. Use aggregate and dimension deltas to diagnose change; visual polish never compensates for misleading data, a corrupt artifact, wrong platform, invented evidence, or reference-fidelity failure.
