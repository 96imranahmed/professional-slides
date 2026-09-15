# Production benchmark and curated learning

Evaluate complete decks and bounded revisions separately. Synthetic fixtures test mechanics; label them synthetic and keep them outside human-preference claims. Include dense pre-reads, sparse pitches, mixed evidence and incomplete inputs. Hold out entire decks and topics, not neighbouring slides from the same document.

`runtime/benchmark.mjs` consumes JSON run records and reports median/p95 elapsed time, model calls, cache hits and quality failures. Set budgets explicitly from a measured baseline. It also computes reviewer confusion counts against human labels; absent human labels produce `not-measured`, never a fabricated score. Run regressions for underdevelopment, overpacking, lost qualifications, incorrect comparison, stale dependencies and malformed review output.

A record contains `id`, `mode` (fresh-build or revision), `totalMs`, `accepted`, and optional `modelCalls`, `cacheHits`, `humanPreferred`, `humanMaterialDefect`, `reviewerMaterialDefect`. Keep evidence paths/hashes alongside real run records. Do not interpret successful schema tests as visual-quality improvement.

Use `runtime/learning-corpus.mjs` to validate a curated dataset manifest. Each example requires an explicit authorized-use statement, brief, evidence, accepted specification, render files, human decision, origin and split. Keep synthetic examples labelled and separate from human-approved training data. Before/after edits must preserve the same input evidence. Reject missing files, stale hashes, contradictory labels and deck leakage across splits. Dataset collection is an explicit project artifact workflow; it does not write personal or project memory automatically.

Start with retrieval and regression evaluation. Fine-tuning is optional and requires a stable specification and evidence that it improves held-out rendered output, repair count, latency or cost. Never populate human decisions from the generator's self-assessment.

## Reproducible corpus and paired runs

Repository `evals/scripts/reconcile_source_corpus.mjs` consumes saved firm-review JSON records, verifies every accessible original hash, deduplicates documents by hash and retains aliases, numbering, review scope, access counts and uncertainty. Acquisition totals and reviewed-document totals remain separate.

`evals/scripts/production_benchmark.mjs manifest.json output-directory` executes named frozen runtime arms on complete supplied cases, writes anonymized result IDs and keeps the arm key separate. Manifest `cases` contain `id`, `input`, `kind` (`deck-plan` for compile regressions, otherwise production delivery) and `origin`; `arms` contain `id` and an absolute runtime `root`. Complete source-aware cases are regression inputs, not independent forward authors. Record first-attempt failures without repairing away the baseline. Research time is absent unless separately measured; never label compile-only timings end-to-end latency.

Use `calibrateFindings()` in the benchmark owner for attributed human labels by defect category. It reports false positives, false negatives, precision and recall, leaving unlabelled evaluation `not-measured`. Do not substitute model judgments for human preference, or reuse source-aware repairs as a held-out authoring result.


## Design and review-speed amendment regressions

Evaluate the amended skill on paired complete-deck renders: narrative continuity, visible insights, useful evidence area, repetition and navigation need human judgments separate from factual/geometry gates. Include a school-like entity introduced without its parent comparison, duplicate conclusion pages, top-heavy analytical pages, useful text-led reasoning and legitimate deliberate whitespace.

Runtime regression coverage must establish that unrelated global research/membership changes preserve local caches, changed source bytes and declared dependencies invalidate them, tracker reorder changes invalidate navigation, model packets deduplicate shared extracts, local and global work share bounded concurrency, and malformed review identifiers fail as review errors. Record packet bytes, cache causes and separate stage times. Performance targets are hypotheses until measured on held-out tasks without increasing missed material defects.
