# Evaluation

This file is the sole human-facing evaluation guide. `cases.json` contains the editable evaluation cases and thresholds; `run_evals.py` validates result data and applies the gates. A deck passing self-review does not prove the skill is effective—effectiveness requires a blinded control-versus-treatment comparison.

## Per-deck self-review

Run this loop before delivering any deck:

1. Freeze the exact editable artifact and render every slide from that artifact.
2. Collect the selected template instance and template-coverage ledger when applicable, hypothesis tree, approved dot-dash, tracker map, storyboard, action-title spine, source ledger, QA ledger, platform readback, full-size slide renders, and deck montage.
3. Create a page-numbered structure ledger from the rendered output. For every required structural state, record the actual slide number and rendered title: cover, standalone executive synthesis, contents tracker, each material chapter-transition tracker, decision close, and appendix when used. A planned storyboard or tracker map does not prove that the final deck contains these pages.
4. Inspect every release gate below and repair all critical or major defects.
5. Score the final artifact with the rubric in this file and cite at least one concrete observation for every dimension.
6. Record a result with `arm: "self"` and run:

   ```bash
   python evals/run_evals.py --mode self --results result.json
   ```

7. Regenerate and re-render after every material repair until the gate passes.

For dual-format work, freeze and score the final PPTX and native Google Slides deck separately. Preserve the exact PPTX, canonical Slides URL and presentation ID, separate renders and readbacks, and a parity ledger. Evidence from one platform cannot stand in for the other.

Self-review is a delivery safeguard. Never report its score as causal evidence that the skill improves deck quality.

## Release gates

All gates are required unless the user explicitly narrows the deliverable.

### Brief and story

- audience, decision, governing thought, delivery mode, and output are resolved;
- a matching deck-type template is instantiated when applicable, without copying a canned page list or bypassing the problem-specific hypothesis tree;
- the declared engagement mode matches the document title, evidence base, analytical coverage, and strength of recommendation; a full commercial-DD request is not silently downgraded into a red-flag review or preliminary public-source screen;
- the template-coverage ledger accounts for every core job as retained, deliberately merged, or omitted with a decision-relevant rationale; a missing-data statement never counts as completed analysis;
- an explicitly owner-approved dot-dash exists as a reviewable artifact from before slide-document creation; every planned slide maps to exactly one sequenced dot, every dot has at least one substantive dash, every analytical dot carries page-specific evidence, proof or exhibit, and implication support, every core analytical dot maps to a hypothesis node, and every core dot names its thesis role and exact chapter;
- the story has a cumulative arc and a standalone answer-first executive synthesis immediately after the cover and before the contents tracker in a multi-chapter decision deck;
- the governing thought is explicit and semantically consistent across the executive synthesis, chapter conclusions, recommendation, and close;
- a multi-chapter pre-read establishes one complete tracker map on a contents page, repeats the same full-state component at material chapter transitions, uses exact chapter labels from the dot-dash, and does not count isolated running labels as the tracker;
- the page-numbered structure ledger identifies the rendered standalone executive synthesis, contents tracker, every required full-state transition tracker, and evidence-backed close; any required state that is absent from the final render is a major defect even when it exists in the storyboard or source code;
- each slide has one narrative job, one claim, and one dominant exhibit;
- action titles read as a coherent executive memo, state a decision-relevant conclusion or action, and use the most material supported magnitude, comparison, period, segment, or threshold when it sharpens the claim;
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
- the final deck has one semantic treatment registry, every non-neutral colour maps to one declared role, and no recurring role uses an undeclared slide-local variant;
- each ordinary analytical slide resolves boxed numbers, filled table headings, active tracker states, text accents, selected structural marks, and primary action fields to one identical component-primary swatch; chart-series colours appear only in data encodings, chart segments use the registered neutral when subdued, and peer values use one base role unless the title or a necessary annotation explains the exception;
- implication, recommendation, decision, and next-action regions use the registered shared action treatment rather than changing colour or construction between slides;
- every slide has at most one visually distinct callout region and at most one terminal action surface; call-to-action, recommendation, decision, next-action, and data-request treatments are mutually exclusive states of the same component and are never rendered as separate stacked boxes;
- every visible micro-heading or container label passes the copy guide's visible-label gate; generic labels such as “Implication” and “First data request” are absent when placement and wording already establish the role;
- action titles contain no em dash except uneditable quoted or official wording, and the deck has no repeated em-dash cadence in other audience-facing copy;
- analytical tables use one registered header treatment without decorative per-column colour changes;
- comparable chart, table, diagram, and comparison headers use one registered treatment throughout the deck, with the open underlined treatment preferred unless the approved theme or a semantic boundary requires another mode;
- peer chart series, timeline stops, table columns, metrics, and panels share the registered base treatment unless the title, legend, direct label, or necessary annotation states the semantic reason for an exception; order or position alone never justifies a highlight;
- bounded recommendation and decision statements are horizontally and vertically centered unless the registered component is an ordered action list, multi-field accountability region, or long evidence block covered by the text-box exception;
- calls to action, recommendations, and decision panels use one uninterrupted surface without a left-hand stripe, edge marker, tab, or ornamental accent; in executive due-diligence pre-reads they include both the action and its governing condition, evidence test, or stop trigger rather than repeating the title as a sparse slogan;
- core due-diligence analytical pages contain enough evidence, scope, unresolved tests, and decision context to be read without narration; whitespace supports hierarchy but does not substitute for omitted analysis;
- the cover contains only necessary document-identification content: no evidence-boundary or analytical panel, pipe-separated metadata, all-caps decorative strapline, ornamental divider, repeated deck descriptor, or default tracker;
- every analytical action title begins at the exact same deck-level `x` and `y` anchor, including one-line and two-line states; titles preserve the registered font size, one-line fit is attempted through faithful editing and the approved width, and necessary two-line titles wrap at meaningful phrase boundaries without orphaned words while moving only the title separator and dependent content anchors down without collision;
- every slide governed by a label-bearing tracker variant shows the exact active label or its one approved compact form in the registered position, with no intermittent omissions inside the declared range;
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
- **Major:** missing or unfollowed dot-dash, unclear or changing thesis, missing standalone executive synthesis, missing contents or chapter-transition tracker state, incoherent tracker, unmapped analytical slide, clipping, overlap, broken hierarchy, font reflow, inconsistent component, arbitrary colour emphasis, mixed analytical-header treatments, missing source, or material template deviation.
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
2. compare every core action title and chapter state with the approved dot-dash and tracker map, then read the titles in order and summarize the argument;
3. state the governing thesis from the executive synthesis and verify that chapter conclusions and the close preserve it;
4. inspect every slide at full size and the montage;
5. reconcile numbers, chart semantics, units, and sources;
6. verify platform correctness and editability;
7. score all dimensions below from 1 to 5;
8. identify only allowed critical-failure codes;
9. cite slide- or object-level evidence for every dimension and failure.

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
| `narrativeLogic` | Governing thought, hypothesis-to-dot traceability, chapter and tracker logic, action-title spine, slide jobs, and close |
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
