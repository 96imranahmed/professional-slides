# Client-deck benchmark

Use this protocol when developing the skill against externally sourced client presentations. Keep source documents, extracted evidence, case records, generated decks, and review results under one ignored `output/<task>/` directory. Commit reusable tooling and generalized skill improvements only.

## Corpus admission

Record every linked candidate, its listing URL, document URL, download result, content hash, page count, and admission decision. Admit presentation-format work for an identifiable client or commissioned decision. Exclude prose reports, general industry or market publications, and promotional or conference material without a client assignment. Judge ambiguous documents from their content, not the filename alone. Preserve exclusion reasons and download failures; neither counts as completed evaluation. Deduplicate exact document bytes while retaining every source link.

Retain only slide-deck files in the source corpus. For a mixed bundle, extract complete identifiable presentation sections, record the parent hash and original page ranges, and remove the prose bundle and its prose extracts. A deck titled “Final report” remains eligible when its actual pages are presentation slides. Preserve the exclusion record, not a local copy of the excluded report.

## Forward pass

Build an evidence packet containing the audience, assignment, contemporaneous facts, source qualifications, and underlying analytical exhibits. Withhold the original action-title spine, executive synthesis, recommendations, slide sequence, and layout. Preserve a source-to-evidence map separately for audit. Facts extracted from a completed deck can still carry selection bias; describe this as evidence-conditioned first-pass generation, not proof of generation from an unseen real-world engagement.

Freeze the skill and evidence hashes before writing the complete dot-dash and slide design plan. Preserve that first candidate before any backward comparison. Include every planned page, explicit evidence dependencies, uncertainty, and intended exhibits. Missing evidence remains a gap, not invented proof.

## Backward pass

Inspect every source slide and compare the source argument, generated argument, and rendered candidate. Map source pages to candidate pages, permitting deliberate splits or consolidations only when all material reasoning survives. Score insight and inference quality, decision completeness, copy quality, evidence density, exhibit choice, visual hierarchy, and deck rhythm separately. Compare analytical relationships and readable evidence capacity under the current theme; legacy styling and pixel similarity are not the target.

Record omitted tests, unsupported claims, lost qualifiers, illegible compression, sparse substitutes for developed exhibits, and inappropriate chart or layout substitutions with exact page references. Do not average away a failed slide or substitute text extraction for visual review.

## Repair and held-out evaluation

Repair the narrowest canonical owner that explains an observed gap. Distinguish content architecture, slide narrative, evidence composition, chart semantics, component geometry, and theme. Prefer an existing owner or variant; introduce a type only for a distinct reusable job. Keep decision-architecture families few and select them by audience decision rather than industry.

Keep repaired candidates separate from first-pass candidates. After freezing a revised skill, rerun new independent contexts on materially different cases without supplying prior answers or reviewer repairs. Preserve development and held-out partitions; reviewing a holdout for repair consumes it as development evidence. Report the partition, first-pass results, remaining failures, and measured coverage explicitly.

## Acceptance

Declare thresholds before judging. Every admitted deck requires a complete forward plan, a source-page comparison, rendered evidence, and a closed gap ledger. Generated PowerPoint candidates must pass the existing canonical provenance, deterministic, visual, and consistency gates. Each substantive page must preserve decision-relevant evidence and qualifications at comparable readable density. A corpus-wide equivalence claim requires every admitted case to pass; incomplete, inaccessible, or failed cases remain visible. A passing finite corpus supports only its measured coverage, not universal zero-shot equivalence.

Use `evals/scripts/validate_client_deck_benchmark.py <manifest.json> --report <report.json>` to audit coverage and evidence hashes. Bind the complete listing inventory with `inventory: {path, sha256}`; each source record uses its inventory ID or an explicit `listingId` when a mixed bundle yields multiple decks. Every inventory entry needs an admission record, including excluded and inaccessible documents. The audit checks admitted and excluded pages, complete source/candidate render inventories, bound acceptance reports, per-page comparison dimensions, and preserved first-pass evidence. A repaired candidate is counted separately from an unchanged first pass. This accounting audit relies on the recorded page counts and independent judges; it does not itself inspect pixels or establish visual quality.
