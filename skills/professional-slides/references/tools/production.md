# Production workflow

Use one approved, substantive deck specification, then deterministic preflight, canonical generation and one coordinated rendered review. One initial review plus one targeted repair pass is the default. Further repair requires a named unresolved material defect. Never deliver an unresolved correctness failure as accepted or restart the loop for editorial taste.

## Commands and ownership

From the skill directory (resolve the bundled Node runtime and `RUNTIME_NODE_MODULES` through workspace dependencies):

```bash
node runtime/build-deck.mjs /absolute/deck-spec.json /absolute/output/deck --preflight
node runtime/build-deck.mjs /absolute/deck-spec.json /absolute/output/deck
node runtime/deliver-deck.mjs /absolute/deck-spec.json /absolute/output/deck
node runtime/review-deck.mjs --pptx /absolute/output/deck/deck.pptx --scene /absolute/output/deck/scene.json --render-dir /absolute/output/deck/rendered --contract /absolute/output/deck/contract.json --report /absolute/output/deck/review.json
```

The build command derives story-plan, contract, treatment ledger, theme and acceptance manifests from one `professional-slides.deck-spec/v2` input. It performs measured compile preflight before export. Generation uses one Artifact Tool import for observation and slide PNGs; all reviewers reuse these PNGs. A canonical receipt binds the actual PPTX and generated files. `generated-needs-review` is deliberately not an acceptance claim.

Input shape and executable examples: [composition recipes](../composition/recipes.md) and `examples/decision-pre-read.json` under the skill. `deckPlan` contains ordinary canonical planner records. `context` carries the main question and governing answer. Each analytical slide has `argument: {question, answer, evidence: [sourceId], interpretation, qualification, disposition, rationale}`; evidence records contain `id`, `text`, `source` and `basis` (unit, period, population/geography and observed/assumed status as applicable). Omit a qualification only if none materially affects interpretation. Never treat evidence metadata as independent proof.

The repository's `validate_pptx.py hard` and `provenance` commands remain developer/diagnostic owners for exact package checks. The installed production command is portable; it does not require the developer checkout or golden corpus. Use the delivery command to run package/provenance checks and coordinated review together.

## Severity and completeness

Whole-deck outcome review is required in addition to local object checks. It receives the original user brief, research requirements, complete visible slide sequence, source provenance and the montage. It tests whether the audience can make the requested comparison, whether missing research was avoidable, and whether the visual relationships support that work. An author-selected decision stage, a repeated caveat or successful structural checks cannot excuse an unfulfilled brief. Text-led decks remain valid when their evidence and composition do the requested job.

The machine-readable [rule registry](../evaluation/rules.json) owns the rule IDs and severity. Facts, evidence, comparison meaning, unreadable text, overflow, broken dependencies and provenance are material. A missing-argument finding must name the absent premise or relationship and a concrete repair. Raw blank space or low word count never suffices. Unsupported content does not become acceptable because it is dense.

Copy and visual judgments share one target inventory. Attach whole-page findings to its title; review each page's argument and appearance. Preserve necessary interpretation, synthesis, qualification and navigation. Word counts and editorial preferences are advisory unless a user explicitly imposed a constraint. Scores are diagnostics. Pure redundancy is advisory unless it obscures material meaning.

Inspect the full montage once for order and recurring constructions. The coordinated reviewer consumes exact images and scoped evidence; the author also checks the montage. Separate copy, visual and consistency model passes are diagnostic tools, not three mandatory production loops.

## Reuse and bounded execution

Review batches contain at most four slides and default to two workers, splitting earlier when their estimated payload exceeds 48 KB; `--batch-size` and `--concurrency` allow bounded adjustment. Each batch retains complete local context. Assess slides independently; explicit `dependsOn` and argument `buildsOn` records supply cross-slide argument dependencies. Use the whole outline for navigation. Do not reuse a result after a changed image, local content, mapped source, policy, reviewer settings or declared dependency. Final reports still bind the entire current PPTX and inventory. `--check` verifies an existing report without model calls; diagnostic subsets cannot authorize a whole deck.

The same output directory retains `.review-cache`. Use delivery `--fresh` for an explicit fresh-data request: it clears only that output directory's build/review caches and repair history. Source inputs are preserved; supply freshly researched evidence in the spec. No other deck's output is deleted.

Performance records separate build and review phases, model calls, cache hits, exports and imports. Research must be timed separately by the author. Performance budgets are targets until measured; report actual median and p95 for fresh builds and revisions, and keep quality failures visible.

## Repair matrix

| Finding | Repair owner | Recheck |
| --- | --- | --- |
| Wrong value, period, scope | Evidence and authoritative spec | Affected source dependents, then exact artifact |
| Missing comparison or explanation | Argument plan | Affected page and declared dependents |
| Clipping or overflow | Composition/geometry | Affected renders; shared changes invalidate their users |
| Wording preference | Editorial advice | Settle after the bounded pass |
| Unsupported component | Tested fallback or separate runtime development | Release certification outside production |
| Changed theme | Deck theme | All affected renders and comparisons |

## Release and learning

Pin instructions, policy, schema, runtime and examples through the plugin release fingerprint. Certify one completed batch; verify installed/source parity. Do not run developer golden tests during ordinary generation.

Use the [benchmark and learning protocol](../evaluation/production-benchmark.md) to assess output quality, speed, reviewer calibration and curated examples. Synthetic fixtures exercise mechanics and are labelled as such. They do not establish human preference or real-world quality gains.

## Executable contracts and reuse

New production specifications use v2; v1 remains a compatibility input with fewer semantic guarantees. V2 requires `context.decisionStage`, `executiveSummaryDecision` and, when a synthesis is present, ordered `synthesisGroups` with branch-to-evidence coverage. The canonical Python synthesis validator owns these rules. Multi-page groups record their transition into detail.

Each evidence `basis` has `unit`, `period`, `population` and `status` (observed, estimated, assumed, target, potential or qualitative). Optional `grossNet` and `recurrence` preserve those distinctions. Declared `comparisons` contain evidence IDs and require an explicit qualification when their bases differ. Each analytical argument has `bindings: [{text, visibleIds, evidenceIds}]`; text must exist in emitted objects belonging to those component IDs. The reviewer still checks whether the cited evidence supports the claim. Optional `relationships` assert parent-child containment, aligned evidence rows or shared-axis alignment using actual component IDs.

Preflight writes `argument-proposals.json` with evidence-linked merge/deepen/retain suggestions. These are proposals, not automatic changes to an approved story. Use measured candidates from the recipe owner to select geometry before approval. Reuse the validated preflight compile when its spec, source bytes, fonts and runtime still match. Local changes reuse unaffected compiled slides. Unchanged complete builds verify cached artifact hashes before avoiding export/import.

Delivery forwards `--model`, `--reasoning-effort`, `--batch-size`, `--batch-bytes`, `--concurrency` and `--timeout-ms`. Hard and provenance checks run concurrently before model review. Each slide has an explicit page-review target, including image-only pages; dependency images travel with their scoped context and invalidate reuse when changed. Compact successful reviews retain exact coverage and grounding. Rejected findings are cached too, so unchanged defects do not trigger another model call.

`repair-history.json` records changed candidates, model calls and unresolved defects. After the bounded repair allowance, use `--material-defect "specific unresolved defect"` to justify another changed-candidate review. A transient transport retry does not authorize re-judging content. Stage deadlines terminate stalled processes; completed review batches remain reusable.


## Consolidated planning and bounded review

Resolve continuity, duplicate claims, comparison coverage, navigation and exhibit choices in one consolidated pre-export planning review. Incorporate it into the existing dot-dash/pre-authoring step, not a stack of overlapping audits. After export, inspect the exact artifact and montage for repeated layouts, unexplained detail, buried insights and weak space allocation as well as factual and geometry defects. “Readable and unclipped” alone is not design acceptance.

Consolidate findings by cause with affected slide IDs and one coordinated repair. Distinguish factual errors, missing decisive evidence, visual failures, stylistic preferences and irreducible uncertainty. A local slide need not restate the complete brief when declared dependencies supply its premise. New research demands must name an actual unsupported claim or an omitted requirement within the agreed scope; genuine later discoveries still remain material.

Malformed reviewer output is a transport/schema problem, not a deck defect. Permit one schema repair attempt for invalid coverage or identifiers, preserving the candidate. Never rewrite sound deck content to accommodate an invalid review record.

Cache local judgments by local content/render, relevant requirements, source bytes and declared dependencies; keep full story/coverage review global. Deduplicate sources within model packets without discarding their original evidence. Run independent local and global checks against one immutable candidate under a shared concurrency limit. Source changes invalidate true dependents and final reports remain bound to exact artifact hashes.

Measure source ingestion, input hashing, packet construction, each local batch and whole-deck review separately, with calls, cache hits/misses and payload bytes. Concurrent stage durations can overlap and must not be added as wall time. Benchmark lighter settings before changing defaults; report research separately from generation/review. Optimize the measured critical path, not merely PPTX export.
