# Evaluation

This file is the sole human-facing evaluation guide. `cases.json` contains the editable evaluation cases and thresholds; `run_evals.py` validates result data and applies the gates. A deck passing self-review does not prove the skill is effective—effectiveness requires a blinded control-versus-treatment comparison.

## Per-deck self-review

Run this loop before delivering any deck:

1. Freeze the exact editable artifact and render every slide from that artifact.
2. Collect the selected template instance and template-coverage ledger when applicable, hypothesis tree, complete dot-dash, validated pre-authoring deck contract and validator output, tracker map, storyboard, action-title spine, source ledger, QA ledger, platform readback, full-size slide renders, and deck montage. For a new deck, preserve proof that contract validation preceded slide-document creation; for an existing-deck revision, preserve proof that its complete as-is inventory preceded the first mutation.
3. Create a page-numbered structure ledger from the rendered output. For every structural state required by the workflow mode and validated contract, record the actual slide number and rendered title: cover, standalone executive synthesis, contents tracker, each material chapter-transition tracker, decision close, and appendix when used. A planned storyboard or tracker map does not prove that the final deck contains required pages. An existing-deck revision may record an absent executive summary as `missing_recommended` without adding it when the revision scope did not authorize structural change.
4. Inspect every release gate below and repair every defect. A release candidate may not carry a known minor defect; the harsh anti-slop pass uses zero unresolved findings rather than accepting a cosmetic backlog.
5. Compare the candidate at montage scale and full-slide scale against at least three recent, relevant public benchmark pages of the same communication mode. Record the observable gap in navigation, hierarchy, exhibit finish, table finish, density, typography, and implication placement; a brand resemblance is not evidence of quality.
6. Audit every slide at full size. For each page, record its narrative job, two concrete rendered observations, and explicit pass results for the deletion, specificity, composition-fit, and visual-finish tests. Any unresolved finding blocks release. Then score the final artifact with the rubric in this file and cite at least one concrete observation for every dimension. Record all recognized `majorDefects` and `minorDefects`; never omit a defect to preserve the score.
7. Record a result with `arm: "self"` and run:

   ```bash
   python evals/run_evals.py --mode self --results result.json
   ```

8. Regenerate and re-render after every material repair until the gate passes.

For dual-format work, freeze and score the final PPTX and native Google Slides deck separately. Preserve the exact PPTX, canonical Slides URL and presentation ID, separate renders and readbacks, and a parity ledger. Evidence from one platform cannot stand in for the other.

Self-review is a delivery safeguard. Never report its score as causal evidence that the skill improves deck quality.

## Release gates

All gates are required unless the user explicitly narrows the deliverable.

### Brief and story

- audience, decision, governing thought, delivery mode, and output are resolved;
- a matching deck-type template is instantiated when applicable, without copying a canned page list or bypassing the problem-specific hypothesis tree;
- the declared engagement mode matches the document title, evidence base, analytical coverage, and strength of recommendation; a full commercial-DD request is not silently downgraded into a red-flag review or preliminary public-source screen;
- the template-coverage ledger accounts for every core job as retained, deliberately merged, or omitted with a decision-relevant rationale; a missing-data statement never counts as completed analysis;
- the workflow is explicitly classified as `new_deck` or `existing_deck_revision`, and the corresponding pre-authoring contract validates at the required stage; bypassing this gate is a non-compensating `pre_authoring_gate_bypassed` major defect;
- for a new deck, an explicitly owner-approved dot-dash exists as a reviewable artifact from before slide-document creation; every planned slide maps to exactly one sequenced dot, every dot has at least one substantive dash, every analytical dot carries page-specific evidence, proof or exhibit, and implication support, every core analytical dot maps to a hypothesis node, and every core dot names its thesis role and exact chapter;
- for an existing-deck revision, a complete as-is dot-dash enumerates every source slide exactly once and was validated before the first mutation; a narrow edit does not require approval of the inventory, but a target dot-dash and approval are required before an authorized structural change;
- a new multi-chapter executive pre-read has a cumulative arc and a standalone answer-first executive synthesis immediately after the cover and before the contents tracker when the selected template requires that sequence; an existing-deck revision without that page records a recommendation and does not force-add it outside the authorized scope;
- every rendered executive-synthesis page required or retained by the contract carries the visible structural label `Executive summary` or an approved local-language equivalent; an answer-first title, notes entry, or storyboard record alone does not satisfy this gate;
- the governing thought is explicit and semantically consistent across the executive synthesis when required or present, chapter conclusions, recommendation, and close;
- a multi-chapter pre-read establishes one complete tracker map on a contents page, repeats the same full-state component at material chapter transitions, uses exact chapter labels from the dot-dash, and does not count isolated running labels as the tracker;
- tracker selection fits the deck length and delivery mode: a long pre-read defaults to contents plus segmented full-state chapter transitions and leaves analytical pages free of multi-item navigation; a permanent top rail is reserved for a shallow deck in which persistent orientation is worth the reduced title and exhibit space;
- full-state tracker pages pass the transition-density test: each marks a material shift, navigation does not consume roughly one page in five or more in a short analytical deck without an explicit live-delivery rationale, and one- or two-page branches are consolidated or use the approved compact state;
- the page-numbered structure ledger identifies every state required by the validated contract, including the standalone executive synthesis, contents tracker, full-state transition trackers, and evidence-backed close when applicable; any contract-required state absent from the final render is a major defect even when it exists in the storyboard or source code, while a missing executive summary recorded as `missing_recommended` in an existing-deck revision is a recommendation rather than an unauthorized insertion;
- each slide has one narrative job, one claim, and one dominant exhibit;
- action titles read as a coherent executive memo, state a decision-relevant conclusion or action, and use the most material supported magnitude, comparison, period, segment, or threshold when it sharpens the claim;
- the close resolves the opening and names the decision or next action;
- essential proof remains in the core story rather than being hidden in appendix.

### Evidence

- claims are verified or explicitly marked illustrative or unresolved;
- values reconcile with labels, units, periods, currencies, and populations;
- actual, estimate, forecast, target, and scenario states are explicit;
- sources and material transformations are traceable;
- no facts, quotes, images, logos, people, citations, or calculations are invented;
- every embedded or linked visual asset is inspected in the exact final render; a valid source file does not pass when its rendered mark is blank, illegible, soft, clipped, optically inconsistent, or replaced by a pseudo-logo.

### Design and visual integrity

- one theme governs typography, color, spacing, shapes, charts, and components;
- the final deck has one semantic treatment registry, every non-neutral colour maps to one declared role, and no recurring role uses an undeclared slide-local variant;
- each ordinary analytical slide resolves boxed numbers, filled table headings, active tracker states, text accents, selected structural marks, and primary action fields to one identical component-primary swatch; chart-series colours appear only in data encodings, chart segments use the registered neutral when subdued, and peer values use one base role unless the title or a necessary annotation explains the exception;
- implication, recommendation, decision, and next-action regions use the registered shared action treatment rather than changing colour or construction between slides;
- the terminal implication, recommendation, decision, or next-action surface is bottom-anchored after the evidence by default; placing it above the exhibit is a major hierarchy defect unless an approved source template or explicit live-delivery sequence requires the exception;
- every slide has at most one visually distinct callout region and at most one terminal action surface; call-to-action, recommendation, decision, next-action, and data-request treatments are mutually exclusive states of the same component and are never rendered as separate stacked boxes;
- every visible micro-heading or container label passes the copy guide's visible-label gate; a callout or terminal action surface begins with its substantive message and carries no label such as “IC conclusion,” “Recommendation,” “Implication,” “Decision gate,” “Key takeaway,” “Important observation,” or a synonymous role announcement when placement and wording already establish the role;
- action titles contain no em dash except uneditable quoted or official wording, and the deck has no repeated em-dash cadence in other audience-facing copy;
- analytical tables use one registered header treatment without decorative per-column colour changes;
- analytical tables are composed exhibits rather than raw spreadsheet grids: hierarchy comes from spacing, alignment, selective rules, grouped headings, and data-semantic emphasis; full boxing of every cell, uniform heavy borders, decorative dark fills, and undifferentiated row rhythm are major defects when they make the table look unfinished;
- comparable chart, table, diagram, and comparison headers use one registered treatment throughout the deck, with the open underlined treatment preferred unless the approved theme or a semantic boundary requires another mode;
- peer chart series, timeline stops, table columns, metrics, and panels share the registered base treatment unless the title, legend, direct label, or necessary annotation states the semantic reason for an exception; order or position alone never justifies a highlight;
- bounded recommendation and decision statements are horizontally and vertically centered unless the registered component is an ordered action list, multi-field accountability region, or long evidence block covered by the text-box exception;
- calls to action, recommendations, and decision panels use one uninterrupted surface without a left-hand stripe, edge marker, tab, or ornamental accent; in executive due-diligence pre-reads they include both the action and its governing condition, evidence test, or stop trigger rather than repeating the title as a sparse slogan;
- core due-diligence analytical pages contain enough evidence, scope, unresolved tests, and decision context to be read without narration; whitespace supports hierarchy but does not substitute for omitted analysis;
- the declared evidence-density mode matches the delivery context; diligence pre-reads may use compact `12 pt` body and table roles when needed, while live pitch pages use materially larger type and less copy, and no page shrinks below its mode to rescue an overloaded composition;
- a live startup pitch contains both a team-credibility proof and a milestone-based raise or use-of-funds proof, separately by default; founder names in notes, a mission close, or a budget list do not satisfy these jobs;
- a project-progress pre-read names the approved baseline, first binding critical-path constraint, residual risk after mitigation, forecast consequence, trigger, owner, and sponsor action; attractive outcome metrics or a generic status scorecard do not substitute for the critical-path and risk jobs;
- the commercial-DD evidence-composition ledger demonstrates question-appropriate chart, table, diagram, and model choices; a table-only core deck, decorative chart variety, or omission of the trend, distribution, position, funnel, bridge, scenario, or sensitivity evidence required by retained branches is a major defect;
- logos, icons, progress circles, and one-to-five scores appear only when their entity, category, completion, or rubric semantics are defined and remain intelligible through text or symbols without colour;
- chart-attached growth, threshold, gap, and observation callouts reconcile to the plotted evidence and do not become detached generic insight boxes;
- every core chart has a defensible visual question, a dominant comparison, an intentional plot area, direct labels or a necessary legend, and a visible endpoint, benchmark, threshold, or change that proves the title; isolated bars, decorative metric tiles, or default-chart scaffolds that do not resolve the analytical question are `under_resolved_exhibit` major defects;
- the cover contains only necessary document-identification content: no evidence-boundary or analytical panel, pipe-separated metadata, all-caps decorative strapline, ornamental divider, repeated deck descriptor, or default tracker;
- every analytical action title begins at the exact registered template-level `x` and `y` anchor, including one-line and two-line states; titles preserve the registered font size, one-line fit is attempted through faithful editing and the approved width, and necessary two-line titles wrap at meaningful phrase boundaries without orphaned words while moving only the title separator and dependent content anchors down without collision;
- every slide governed by the tracked analytical-header template contains both its tracker-label and action-title fields at the exact registered anchors, widths, typography roles, and gap, with no intermittent omission or slide-local repositioning inside the declared range;
- every analytical-header tracker label equals the active tracker record or its one approved compact form and never concatenates a subsection, page topic, slide type, or other slide-local qualifier;
- a long commercial due-diligence pre-read with three to five stable top-level chapters uses contents plus segmented full-state chapter transitions by default; analytical pages use one stable action-title header without a permanent multi-item top rail, unless an approved source template provides a better evidence-backed navigation system;
- every logo used in a peer set is visibly non-blank, recognizable, sharp, and consistently aligned in the exact final PowerPoint render; unsupported SVG placeholders, mixed logo/wordmark weight, inconsistent clear space, and connector lines that overshoot or cross labels are major defects;
- core commercial due-diligence pages use the analytical width and vertical content zone for necessary evidence, scope, unresolved tests, and decision consequence; unexplained empty zones that could hold required analysis are major defects even when no object technically overflows;
- title, content, source, footer, and navigation anchors are consistent;
- bolding follows the registered type roles and one intentional scan path; mixed peer weights, arbitrary bold fragments, accidental all-bold blocks, or weight changes used to repair spacing are major defects;
- every repeated gap, inset, baseline, and text-to-rule relationship resolves to a registered spacing token or named optical correction; visibly uneven local spacing is a major defect when it changes the family rhythm and a minor defect otherwise, and either state blocks release;
- every full-size slide has a clear first read and evidence hierarchy;
- there is no unintended overlap, clipping, overflow, broken wrapping, unreadable label, unresolved placeholder, or production note;
- charts, tables, image crops, connectors, contrast, and non-color semantics work;
- the montage shows deliberate rhythm without sudden changes or repeated gimmicks;
- when the brief requests consulting-benchmark quality, the QA package records a recent public reference set of the same deck type, the transferable observations, at least one candidate-versus-reference comparison, and the repair loop applied to the owning definitions rather than copying brand assets or proprietary layouts;
- template tutorials, construction grids, indexes, and sample branding are absent.

Investigate every overlap warning. Record rare intentional overlaps as explicit design decisions rather than suppressing them silently.

### Platform and delivery

- the requested editable deliverable exists, opens, and matches its final renders;
- PowerPoint masters, layouts, charts, tables, and text remain safely editable;
- Google Slides is native and has been checked after import for fonts, wraps, crops, chart semantics, line weights, notes, and links;
- dual-format outputs are validated independently;
- filenames and versions are clear, only requested artifacts are delivered, and limitations are concrete;
- completion claims rely on the latest final artifact and render set.

### Cross-slide consistency pass

Run this pass after the complete editable artifact exists and repeat it after the final render. Build a slide-by-slide header matrix from the actual artifact or native platform readback, not from intended source code. For each page, record the page type, applied master or layout, declared header-template variant, expected tracker-record identifier, approved label form, actual tracker-label text, actual action title, field visibility, `x`, `y`, width, height, typography role, title line state, separator position, and any named exception.

Compare every governed slide with the declared template range and fail the pass when a required field is missing, an undeclared field appears, geometry or typography drifts, or an exception is not represented by a named page type. Compare the actual tracker-label text with the active tracker record or its approved compact form; reject generated synonyms, page-local labels, and strings assembled from multiple fields. When a second navigation level is approved, validate it as its own field and record rather than as modified top-level label text.

Inspect the matrix numerically, then inspect the montage and representative full-size renders to catch visual drift, wrapping, conversion, or master-inheritance defects that object readback misses. Repair the owning master, layout, template, component, or tracker record, regenerate every affected slide, and rerun the complete pass. Slide-local nudges or isolated text replacements do not satisfy the pass when the shared definition remains inconsistent.

The pass succeeds only when every slide is accounted for, every governed template field is present exactly where declared, every tracker label has approved provenance, and the final editable artifact and render agree.

## Defect handling

Track defects during the internal loop:

| Slide | Gate | Defect | Severity | Fix | Re-rendered | Status |
| --- | --- | --- | --- | --- | --- | --- |

- **Critical:** wrong conclusion or data, corrupt/missing artifact, unreadable content, misleading chart, or inaccessible deliverable.
- **Major:** bypassed or failed pre-authoring gate; incomplete new-deck or as-is existing-deck dot-dash; unclear or changing thesis; missing or visibly unlabelled standalone executive synthesis, contents, or chapter-transition tracker state when required by the validated contract; missing required tracker-label field; wrong navigation system for the deck length; mixed analytical-header grammar; implication surface placed above the evidence without a valid exception; any redundant role label or reserved label column on a callout or terminal action surface; under-resolved core exhibit; raw spreadsheet-grid table; reference-quality gap; blank or inconsistent logo treatment; under-composed core analytical canvas; unmapped analytical slide; generic or repeated copy; decorative component; clipping; overlap; broken hierarchy; font reflow; inconsistent component; typography-weight drift; spacing-rhythm drift; arbitrary colour emphasis; missing source; or material template deviation. An existing deck's missing executive summary is not a defect by itself when the as-is contract records it as `missing_recommended` and adding it was outside the authorized scope.
- **Minor:** a microscopic local issue with no effect on meaning. Minor defects still block release; record them rather than silently upgrading them to clean.

Do not deliver with a critical, major, or minor defect. A tool limitation is disclosed as a blocked release, not silently reclassified as acceptable polish.

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
3. state the governing thesis from the executive synthesis when required or present, otherwise from the opening answer and close of an existing deck, and verify that chapter conclusions and the close preserve it;
4. inspect every slide at full size and the montage;
5. reconcile numbers, chart semantics, units, and sources;
6. verify platform correctness and editability;
7. score all dimensions below from 1 to 5;
8. identify only allowed critical-failure codes;
9. inspect the exact rendered audience-facing text, inventory every retained short label outside axes, legends, table headers, navigation, scenarios, units, dates, and accountability fields, and state the indispensable distinction each retained label encodes;
10. cite slide- or object-level evidence for every dimension and failure.

Do not award points for extra slides, complexity, brand imitation, or claims of QA without current renders. Penalize decorative structure, vague titles, untraceable evidence, conversion defects, and polished work that does not enable the requested decision.

After evaluation, restore `control` and `treatment` labels and run:

```bash
python evals/run_evals.py --mode release --results result.json
```

The release passes only when every runnable case has both arms, treatment meets the absolute and improvement thresholds, no treatment has a critical failure, and no dimension regresses beyond the configured tolerance.

## Scoring rubric

Score from 1 to 5 in increments of `0.1` using only final-artifact evidence. The runner converts the mean to a 100-point score, but the mean cannot compensate for a weak dimension: every dimension must score at least `4.9`, no major or minor defect may remain, every slide must pass the full-size anti-slop audit, and every unresolved finding blocks release. A `5.0` requires no actionable improvement opportunity after reference comparison and full-size inspection; `4.9` is reserved for reference-caliber work whose only observable difference is preference rather than a repair. A coherent, attractive, executive-usable deck with visible design or exhibit improvements is a `4.0` to `4.5`, not a `4.9`.

| Score | Meaning |
| --- | --- |
| 1 | Fails the brief or has material defects; extensive rework required |
| 2 | Directionally usable, but major analytical or design reconstruction is still required |
| 3 | Coherent internal draft; usable for discussion but visibly templated, incomplete, or inconsistent |
| 4 | Strong professional work; executive-usable, yet still materially below recent best-in-class reference pages |
| 5 | Reference-caliber partner-review work; analytically resolved, visually controlled, persuasive, and free of actionable defects |

### Hard quality gates and score caps

The runner rejects a result even when its arithmetic mean exceeds `98` when the required workflow proof is absent, any dimension is below `4.9`, any declared major or minor defect remains, any slide lacks a full-size audit, any slide has an unresolved anti-slop finding, fewer than three candidate-versus-reference comparisons are recorded, or any unexplained role label remains. Record major defects using the configured codes: `wrong_navigation_system`, `mixed_header_grammar`, `misplaced_implication_surface`, `under_resolved_exhibit`, `raw_grid_table`, `under_composed_canvas`, `inconsistent_component`, `reference_quality_gap`, `redundant_role_label`, `missing_required_structure`, `header_field_omission`, `broken_asset_render`, `pre_authoring_gate_bypassed`, `typography_or_spacing_drift`, `generic_or_redundant_copy`, and `decorative_component`.

Use the following caps while judging before entering the numeric score:

- any major defect caps the overall quality judgment at `79/100` and blocks delivery;
- any minor defect caps the overall quality judgment at `94/100` and blocks the `98+` gate;
- a slide-design or chart-integrity score above `4.5` is invalid when the evaluator can name a material page-level repair to navigation, header grammar, implication placement, plot construction, table composition, or whitespace;
- a `4.9` or `5.0` requires candidate-versus-reference evidence, not adjectives such as polished, clean, or professional;
- no dimension may borrow credit from another: correct sources do not raise slide design, editable shapes do not raise chart integrity, and complete coverage does not raise narrative logic when the argument is weak.

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
- for `self` and `treatment`, `preAuthoringReview` with `workflowMode`, non-empty `contractPath` and `validatorOutputPath`, `contractValidated: true`, `dotDashCoverageVerified: true`, the applicable `validationStage` (`before_slide_document_creation` for `new_deck` or `before_first_mutation` for `existing_deck_revision`), and `executiveSummaryDisposition`. For a new deck the disposition is `required_present`, `present`, or `not_required` as allowed by the selected template and delivery mode; for an existing deck it is `present` or `missing_recommended`. Control results may omit this skill-specific process evidence;
- `scores` containing exactly the eight configured dimensions, each from 1 to 5 in increments of `0.1`;
- `criticalFailures` containing only configured codes;
- `majorDefects` containing only configured codes and remaining empty for a passing result;
- `minorDefects` containing concrete slide-level issues and remaining empty for a passing result;
- `antiSlopReview` with `renderedTextInspected: true`, `fullDeckMontageInspected: true`, a positive `expectedSlideCount`, one `slideAudits` entry for every numbered slide, at least three `benchmarkComparisons`, an `unexplainedRoleLabels` list that must be empty to pass, and a `retainedLabels` inventory whose entries identify the slide, exact text, legitimate element role, and indispensable distinction encoded. Each slide audit names the narrative job, confirms full-size inspection, passes the deletion, specificity, composition-fit, and visual-finish tests, records at least two concrete observations, and contains no unresolved finding. Each benchmark comparison identifies the candidate slide, public reference, comparison dimension, observed gap, and whether the gap was repaired or no material gap remained;
- `evidence` with at least one concrete observation per dimension;
- optional `notes`.

Store result packages outside the skill unless they are intentionally curated fixtures. Preserve randomized label mappings separately from evaluator inputs. Use aggregate and dimension deltas to diagnose change; visual polish never compensates for misleading data, a corrupt artifact, wrong platform, invented evidence, or reference-fidelity failure.
