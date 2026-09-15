# Evaluation

Use this guide to decide whether a deck is ready. Keep generated decks, renders, plans, and review reports in one task-owned `output/` directory outside the installed plugin, never in committed source.

For a new evaluation attempt, create a task-owned output subdirectory and preserve its inputs and review evidence. Reuse unchanged, hash-bound source extracts rather than duplicating source acquisition. Keep control and treatment independent when the task includes a controlled comparison.

## Choose the evaluation mode

Declare what is being evaluated before selecting commands. These modes separate evidence gathering from artifact acceptance; they do not create alternate release gates.

| Mode | Evidence and appropriate checks |
| --- | --- |
| Original-document analysis | Review the authorized source scope using exact files, cached text/OCR, title-sequence context and necessary original-page checks. Record every document's disposition and access limits under [source evidence](../storylining/source-evidence.md). No recreation, per-source-slide model calls or full golden run is required. |
| Guidance or contract change | Batch related changes, check consistency across canonical references and evaluator instructions, and run focused schema/semantic cases appropriate to the change. Source examples inform the cases; rebuilding the source corpus is not a validation requirement. |
| Runtime or export change | Reproduce the affected behavior with complete representative inputs, then apply the component-runtime and exact-artifact gates below. A demonstrated capability gap, not a pattern name, justifies a new primitive. |
| Generated-deck delivery or reference comparison | Review the exact final editable artifact and required rendered coverage. A source-only analysis or accepted contract does not substitute for these gates. |

Preserve the user's requested scope. An executive-summary review uses the title spine and neighboring pages to establish context; it is not an exhaustive slide audit. Report available, reviewed and uncertain documents separately from inaccessible listings. Missing access prevents claims about those originals, not useful analysis of the verified subset.

## Per-deck self-review

Production acceptance follows the [severity and repair policy](../tools/production.md). Scores are diagnostics; material defects and complete evidence coverage determine acceptance. Developer certification and corpus research remain separate from ordinary generation.

Honor explicit reviewer settings through the [production workflow](../tools/production.md). Legacy visual and consistency commands remain optional diagnostics; their model-diversity options do not add production gates.

Test reusable changes with fresh-context authors on materially different communication jobs. Give them only the brief, raw evidence, and frozen skill, not earlier answers or reviewer repairs. Keep the first candidate and all review results; distinguish first-pass acceptance from later repaired delivery. Passing a small holdout set supports those tested cases, not a universal quality claim.

Review the exact final editable artifact, not only the source code or an intermediate render.

1. Render every slide.
2. Review the full montage for story, rhythm, and repetition.
3. Inspect every slide at full size.
4. Check titles, evidence, sources, and uncertainty.
5. Check clipping, overlap, broken assets, and unreadable text.
6. Apply the deletion test.

Every planned slide maps to exactly one sequenced dot. New decks and structural revisions require a validated [pre-authoring contract](../storylining/pre-authoring-contract.md), including the canonical summary decision and any purpose-specific exception. Bounded individual-slide edits preserve their authorized scope. An original-document analysis records the source's actual synthesis role or absence; it does not impose new pages on the original.

## Review dimensions

Review these dimensions under the canonical severity policy; the checklist does not introduce additional style blockers.

### Story

- The deck answers the brief and has one governing thought.
- The title spine fulfils the [communication job](../storylining/index.md#write-the-title-spine): a clear executive memo for a decision, or a coherent explanatory progression for teaching.
- Each slide has one narrative job and one dominant exhibit.
- The planned synthesis and dot-dash satisfy the canonical summary decision and the [standalone argument and evidence test](../storylining/dot-dash.md#standalone-argument-and-evidence-test) for their declared communication scope. Preserve approved governing branches, qualifications and any supported action using the [copy owner](../components/copy.md#executive-summary-narrative); do not demand an unplanned summary or redundant close from an allowed exception.
- The close follows from the evidence. Use implication chevrons at only one or two deliberate emphasis points; other supported relationships use clear grouping and reading order. Reject automatic chevrons on every insight.
- Every decisive case maps to visible proof, including dedicated evidence slides where needed. Reject table-heavy synthesis that lacks the graphs needed to test its numerical claims, and statistics unrelated to the slide’s criterion.
- Missing data is explicit; a missing-data statement never counts as completed analysis.

### Evidence

- Claims reconcile with their exhibits and sources.
- Review contribution and analytical completeness. Supported interpretation and synthesis are valid; material unsupported claims block release. Editorial duplication is advisory.
- Facts, estimates, claims, and inferences are distinguishable.
- Charts use the correct scale, units, labels, and series. The [meaningful-position gate](../charts/index.md#meaningful-position-gate) is mandatory: inspect source transformations as well as renders and reject arbitrary within-category offsets, jitter, or scatter axes without two meaningful measures. Visual scores cannot override this evidence defect.
- The final render contains each requested [change, gap, or threshold annotation](../components/chart-callouts.md#authoring-decision), and focal marks pass the [primary/comparator contrast check](../charts/index.md#focus-and-comparator-colours).
- Tables are composed exhibits rather than raw spreadsheet grids.
- No evidence is invented.

### Design

- The exact editable artifact and full-size renders pass the declared [theme](../theming/index.md), colour ledger, treatment ledger, and [design](../design/index.md) checks with no unexplained drift.
- Status tables and heatmaps pass [comparison indicators](../components/comparison-indicators.md); navigation passes [trackers](../components/trackers/index.md).
- Audience text passes [copy](../components/copy.md), and detached synthesis passes the [insight-box](../components/insight-box.md) cardinality and treatment checks.
- The chosen [composition](../composition/index.md) fits the evidence, keeps one dominant exhibit, and leaves no under-composed analytical canvas.
- [Deck rhythm](../design/index.md#deck-rhythm) passes separately from style consistency; repetitive chart runs and empty closing cards need an analytical reason, not a matching palette.
- Every slide passes the full-size anti-slop audit with no unexplained object, label, treatment, or inconsistency.

### Substance and grouping rejection checks

Record a per-slide verdict with the exact claim, visible premises, inference limit, and any failed grouping in the review evidence. Apply the [claim-to-proof check](../components/copy.md#claim-to-proof-check) before layout and again to the exact render. A slide fails when its title exceeds the evidence, a comparative claim supplies only one side, a conclusion replaces evidence with imagery, or material statistical context is absent. Missing research is an unresolved gap, not permission to use unsupported rhetoric.

Reject dangling headings, unaligned name/value text, detached qualifications, and side rails whose items have no visible parent or evidence relationship. Check actual label-to-content proximity and alignment at full size, not only whether the objects exist. Apply [analytical composites](../design/slide-layouts.md#analytical-composites) and [category visuals](../components/icons-and-logos.md#category-icons-and-images).

At montage scale, reject an unjustified repeated image-plus-text silhouette, images on every analytical page, or a repair that turns every page into the same table or card template. Structural covers may be sparse; analytical pages must earn their space with readable evidence and reasoning. Passing geometry checks does not establish any of these semantic or visual gates.

### Platform

- The requested editable format exists and opens.
- Native objects remain editable where expected.
- Fonts, charts, tables, notes, and sources survive export.
- PowerPoint and Google Slides are checked separately when both are requested.
- The final output directory contains only requested deliverables.

## PowerPoint validation owner

`runtime/validate_pptx.py` owns deterministic package and provenance checks and optional legacy diagnostics. `evals/scripts/validate_pptx.py` is a compatibility entry point to that implementation. The production review owner is `runtime/review-deck.mjs`; do not add parallel validators.

## PowerPoint reports

The [production workflow](../tools/production.md) owns the required receipt, package/provenance checks, coordinated review, montage inspection and scoped rerun policy. `runtime/deliver-deck.mjs` runs the automated checks together. Separate visual and consistency reports are optional diagnostics for a named investigation, not additional mandatory review loops.

## Component-runtime gate

After changing runtime layout, tokens, components, charts, or adapters, run `npm run check` and then the golden runtime gate with the bundled workspace paths. The golden deck places compatible variants of one component on paginated grid boards, keeps dense or full-frame variants isolated, and includes a curated non-duplicative composition set. The exhaustive layout suite remains in regression tests. The report records every default and non-default component instance as an explicit coverage key, independent of slide count, and rejects duplicate visual branches that differ only by a variant name. Release validation uses the canonical McKinsey palette; other supported palette inputs remain fast contract checks rather than duplicate visual decks. The validator renders the HTML observer and exact saved PPTX, imports the PPTX with Artifact Tool, and rejects missing names, theme drift, or visual disagreement. Review both contact sheets and the lowest-scoring individual fixtures before accepting the report.

Require the overlap gate in component reports. It checks rendered HTML line boxes and visible SVG geometry, then checks imported PPTX frames, paint order, recovered text, and explicit line counts. Reject text clipping, accidental text/text, text/rule, shape/shape, and connector collisions, and unequal peer heading clearances. A text backing must precede its text in native paint order. The imported-frame check does not replace exact-PPTX image review. Intentional containment and masking must match `runtime/overlap-policy.mjs`; a shared component, chart, or overlay alone never exempts a collision. Keep per-slide coverage and named violations, and test the gate with deliberately broken fixtures.

## Defects

Use the [canonical severity policy](../tools/production.md#severity-and-completeness) and [rule registry](rules.json). The legacy term `critical` maps to `blocker`. A major or blocker finding must identify a concrete material failure; generic wording, repeated treatments, raw tables or style drift alone remain editorial advice. Scores cannot compensate for a material defect.

## Skill-effectiveness evaluation

Self-review proves only that a deck is deliverable. It does not prove that the skill improves performance.

### Comparison with a reference deck

Inspect every source page and every exact candidate render at full size, then compare the complete sequences. Record source-to-candidate page mappings, including deliberate consolidations, splits and omissions. For differing aspect ratios, check both equal visible height and fit-to-width views. Use the source's visible crop when normalizing type size; a PDF media box with extra margins can conceal a legibility regression.

For each substantive exhibit, identify the source's strongest analytical device and demonstrate how the candidate preserves or improves its function. Check the actual relationships: nested stages, option families, hypothesis–assessment–evidence rows, common scales, scenario bands, totals, and the distinction between current, estimated and potential results. Retaining all words and numbers does not pass when the reader must reconstruct a grouping or comparison that was visible in the source.

Judge evidence, insight, copy, hierarchy, comparison effort, readable density and visual execution separately. Reject material regressions in any dimension, including tiny type inside an underused canvas, fragmented comparables, misplaced emphasis and unsupported stronger claims. A modern theme may change colours, spacing and styling; it must retain the evidence relationships and make them at least as easy to read. Do not average away a weak page or use a high similarity score as proof of equivalence. Incorrect or misleading source treatments must be corrected, with the reason recorded.

Attribute each deficit to available input, authoring guidance, component capability or export behavior before changing the skill. In a blind forward test, distinguish withheld source facts from author losses, while retaining enough raw evidence to express the relationships being tested. Preserve the first plan and artifact, record every repair, and evaluate generalized changes on a fresh case before claiming first-pass improvement.

### Batch analysis, changes and rendered comparison

For original-only analysis, batch the complete authorized set of document dispositions and source-backed findings before proposing changes. Reuse unchanged extracts and original-page images using the [source evidence cache](../storylining/source-evidence.md#bounded-extraction-fallback). A changed review policy may require reconsidering a disposition; it does not invalidate the unchanged source bytes or require fresh OCR. Do not regenerate the corpus or run one model call per source slide to derive guidance.

For implementation, group related fixes by canonical owner and run appropriate checks once on the coherent batch. Repeat checks when inputs or implementation change, a failure needs resolution, or new evidence raises a concrete concern. Guidance-only changes use their focused contract and consistency checks; runtime changes use the component gate. Record what was checked and what remains outside scope. The rendered-comparison workflow below applies when actual candidate artifacts are part of the task.

Inspect a complete related set of source and candidate slides before starting repairs. Consolidate repeated deficits by canonical owner, retaining the exact page mappings and complete difficult inputs. Update the base guidance and shared components together, and preflight every affected composition with its full copy. Then freeze that source batch, export the affected candidates together, run the complete component gate once, and inspect source/before/after comparisons in one review pass. Avoid one-slide export loops while known related changes remain unimplemented. A failed preflight is useful evidence; fix its shared cause before paying for another full render.

Keep first-attempt artifacts immutable and label source-aware repair batches explicitly. Record which defects the batch was meant to close and evaluate every mapped slide afterward; fixing the motivating screenshot does not close the other mappings. New findings become the next coherent batch. Batch efficiency does not remove exact-artifact rendering or the per-page comparison requirement.

For a release comparison:

1. use the same brief, inputs, runtime, budget, and platform for control and treatment;
2. keep the arms independent;
3. blind reviewers to the arm;
4. score the configured dimensions;
5. record critical, major, and minor defects;
6. compare overall and per-dimension results;
7. declare acceptance thresholds before reviewing results.

The treatment passes only when it clears the absolute threshold, improves by the required amount, and does not create a material dimension regression.

## Result contract

For original-document analysis, retain the source register, exact reviewed ranges and numbering systems, extraction/cache provenance, per-document dispositions, access limitations and source-backed findings. Do not fill absent artifact paths or acceptance scores with invented values. The result fields below apply to generated self/treatment candidates and controlled comparisons.

Each result records:

- case ID and arm;
- artifact and render paths;
- pre-authoring review for self and treatment;
- dimension scores;
- critical, major, and minor defects;
- coordinated review with complete slide coverage;

- reference comparison when required;
- fresh-run preparation evidence;
- reviewer notes.

Keep the exact candidate, renders, governing inputs, and validator reports together. Do not claim acceptance from a narrative summary alone.
