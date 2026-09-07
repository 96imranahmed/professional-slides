# Evaluation

Use this guide to decide whether a deck is ready. Keep generated decks, renders, plans, and review reports in ignored `output/` or `deliverables/` directories, never in committed source.

For an evaluation, create a fresh output subdirectory and preserve the inputs and review evidence there. Keep control and treatment independent.

## Per-deck self-review

For skill-development tests, independently review the story before judging rendering. `evals/scripts/validate_story_plan.py` takes the original brief, proposed plan, and all supporting evidence/assumption ledgers via `--support`. It requires at least 90 in each of six story dimensions and no major or blocker finding. Preserve exact input hashes and adjudicate findings against the complete packet; a missing judge input is a harness defect, not an author failure.

Test reusable changes with fresh-context authors on materially different communication jobs. Give them only the brief, raw evidence, and frozen skill, not earlier answers or reviewer repairs. Keep the first candidate and all review results; distinguish first-pass acceptance from later repaired delivery. Passing a small holdout set supports those tested cases, not a universal quality claim.

Review the exact final editable artifact, not only the source code or an intermediate render.

1. Render every slide.
2. Review the full montage for story, rhythm, and repetition.
3. Inspect every slide at full size.
4. Check titles, evidence, sources, and uncertainty.
5. Check clipping, overlap, broken assets, and unreadable text.
6. Apply the deletion test.
7. For PowerPoint, require the four accepted artifacts in [PowerPoint reports](#powerpoint-reports); follow the linked platform owners for commands and repair loops.

Every planned slide maps to exactly one sequenced dot. New decks and structural revisions require a validated pre-authoring contract. Every full deck or recreation must include an executive summary in the approved dot-dash and final artifact. Bounded individual-slide edits preserve their authorized scope.

## Hard release gates

Release only when all apply:

### Story

- The deck answers the brief and has one governing thought.
- The title spine fulfils the [communication job](../storylining/index.md#write-the-title-spine): a clear executive memo for a decision, or a coherent explanatory progression for teaching.
- Each slide has one narrative job and one dominant exhibit.
- The mandatory executive summary and dot-dash pass the [standalone argument and evidence test](../storylining/dot-dash.md#standalone-argument-and-evidence-test). The summary preserves the approved governing branches and overall action and passes the [standalone narrative test](../components/copy.md#executive-summary-narrative).
- The close follows from the evidence. Implication slides show the canonical evidence-to-implication arrow; proximity alone does not express that relationship.
- Every decisive case maps to visible proof, including dedicated evidence slides where needed. Reject table-heavy synthesis that lacks the graphs needed to test its numerical claims, and statistics unrelated to the slide’s criterion.
- Missing data is explicit; a missing-data statement never counts as completed analysis.

### Evidence

- Claims reconcile with their exhibits and sources.
- Every page passes the [no-recap and new-deduction gate](../components/copy.md#no-recap-and-new-deduction-gate). Graph/table narration in any supporting copy and non-deductive insight boxes are release-blocking defects, not minor copy suggestions. The final review records explicit per-slide copy evidence.
- Facts, estimates, claims, and inferences are distinguishable.
- Charts use the correct scale, units, labels, and series.
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

All PowerPoint contract, semantic, exported-file, per-slide visual, and cross-slide consistency gates are subcommands of `evals/scripts/validate_pptx.py`. The script reads the canonical storylining, composition, design, component, chart, and evaluation owners through its `SKILL_REFERENCE_MAP`; do not create a parallel validator rulebook or another `validate_pptx*.py` entrypoint.

## PowerPoint reports

Every final PowerPoint candidate requires four acceptance artifacts bound to the same exact PPTX hash and governing inputs:

- an accepted canonical generation receipt proving that the deck used the shared planner, scene, registry, theme tokens, HTML observer, PptxGenJS adapter, and Artifact Tool observer rather than a parallel builder;
- an accepted deterministic hard report from [PowerPoint hard acceptance](../tools/powerpoint/acceptance.md);
- an accepted per-slide visual report from [PowerPoint rendering and QA](../tools/powerpoint/rendering.md#independent-visual-reports);
- an accepted cross-slide consistency report from the same rendering owner, using a different approved judge model.

Every slide and deck dimension must score at least 90, every comparison group must accept, and no blocker or major finding may remain. The platform owners define commands, inspection scope, and rejection handling; this evaluation owner defines the release requirement.

Run `python evals/scripts/validate_pptx.py provenance <deck.pptx> --receipt <canonical-generation-receipt.json> --generation-script <builder.mjs> --require-planning` for ordinary net-new decks. The gate recomputes the canonical runtime hash, reconciles the scene and design manifest, matches every scene node to the exact native PowerPoint object, binds the authoring script, and rejects direct PptxGenJS calls. Visual similarity cannot substitute for this proof.

## Component-runtime gate

After changing layout, tokens, components, charts, or adapters, run `npm run check` and then the golden runtime gate with the bundled workspace paths. The golden deck places compatible variants of one component on paginated grid boards, keeps dense or full-frame variants isolated, and includes a curated non-duplicative composition set. The exhaustive layout suite remains in regression tests. The report records every default and non-default component instance as an explicit coverage key, independent of slide count, and rejects duplicate visual branches that differ only by a variant name. Release validation uses the canonical McKinsey palette; other supported palette inputs remain fast contract checks rather than duplicate visual decks. The validator renders the HTML observer and exact saved PPTX, imports the PPTX with Artifact Tool, and rejects missing names, theme drift, or visual disagreement. Review both contact sheets and the lowest-scoring individual fixtures before accepting the report.

Require the overlap gate in component reports. It checks rendered HTML line boxes and visible SVG geometry, then checks imported PPTX frames, paint order, recovered text, and explicit line counts. Reject text clipping, accidental text/text, text/rule, shape/shape, and connector collisions, and unequal peer heading clearances. A text backing must precede its text in native paint order. The imported-frame check does not replace exact-PPTX image review. Intentional containment and masking must match `runtime/overlap-policy.mjs`; a shared component, chart, or overlay alone never exempts a collision. Keep per-slide coverage and named violations, and test the gate with deliberately broken fixtures.

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
7. declare acceptance thresholds before reviewing results.

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
- the four [PowerPoint acceptance artifacts](#powerpoint-reports) for every self or treatment PPTX, with material paths, the same exact candidate hash, approved distinct judge models for visual and consistency review, iteration counts, and `accepted: true`;
- reference comparison when required;
- fresh-run preparation evidence;
- reviewer notes.

Keep the exact candidate, renders, governing inputs, and validator reports together. Do not claim acceptance from a narrative summary alone.
