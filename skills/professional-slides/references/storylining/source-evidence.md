# Source evidence and original-document review

## Research provenance

Separate evidence records by `kind`: `source`, `user`, `calculation`, or `interpretation`. A source record carries `provenance` with a local extract path, SHA-256, source URL, retrieval date and locator. Preserve the source extract independently of slide prose. A user record identifies the supplied statement; a calculation names input evidence IDs and its formula; an interpretation names its premises. Legacy untyped declarations are unverified author material. A URL attached to an author's conclusion is not independent supporting evidence.

Use a UTF-8 text extract for `provenance.path`, resolved relative to the input specification; retain original documents separately where needed. Production copies the verified extract into the build and automatically supplies its bytes to the reviewer. Source hashes bind review and cache reuse. Include the underlying source IDs in each slide's evidence scope as well as derived records, so reviewers can inspect the premises.

Record decisive research requirements in `context.researchRequirements`: criterion, status (`resolved`, `uncertain`, `unavailable`, `needs-user`, or `unperformed`), evidence IDs, and the remaining limit. Perform accessible, decision-relevant research before export. Distinguish unavailable information after an attempted lookup from research simply not undertaken. The whole-deck review judges whether remaining gaps undermine the original requested outcome; uncertainty alone is not failure and does not justify inventing a winner.

Use this owner when an existing document supplies claims, storyline or design evidence. Keep intake separate from authoring: acquiring or reviewing an original does not authorize rebuilding it, and a source review does not certify a generated artifact. The [pre-authoring contract](pre-authoring-contract.md) owns planning fields and executable requirements; this guide owns evidence interpretation and review procedure.

## Identify the document before using it

Record the exact local bytes and SHA-256, source URL and resolved URL, title, date or version, and any identity uncertainty. Verify the file's actual format rather than its extension or HTTP content type. A PDF needs a readable PDF structure; a native PPTX needs its presentation package and actual slide parts. A successful request or plausible title is not proof of identity.

Distinguish source form from file format:

| Source form | Appropriate evidence use |
| --- | --- |
| Native presentation | Native slide sequence, visible copy and editable relationships; use native slide numbers. |
| Landscape slide PDF or hybrid | Visible page geometry and slide-like relationships, with the actual crop and any mixed page types recorded. |
| Portrait prose report or proposal | Argument, qualifications and continuation; do not silently import its page geometry as a landscape slide requirement. |
| Filing or extract | Only the identified included material, preserving wrapper pages, omissions and parent identity. |
| Embedded deck | Identify its cover and boundaries inside the containing file; keep citations tied to the physical container. |

A related report with the same topic is not the requested presentation. Check the date, edition, authorship, opening pages and sequence against the listing or supplied reference. If only an extract or companion is available, label it as such instead of claiming the parent is complete. File naming, a hosting page and a consultant logo can support provenance but do not independently establish authorship or client authorization.

Record contribution provenance when material includes another adviser, client team or third-party evidence. Preserve interim, draft, discussion-only, narration-dependent and unvalidated status. These limits affect the lessons and claims that can be drawn; do not convert a discussion question, proposed option or announced intention into an approved decision.

## Keep identity, access and review states separate

Maintain a per-document record, not only an aggregate success count. The evidence register should carry the following information; serialize it using the current contract schema rather than assuming these labels are new runtime fields.

| Record | Required distinction |
| --- | --- |
| Identity | Verified, provisional or mismatched; title/version, exact file hash, URL and the reason for the judgement. |
| Availability | Available file, inaccessible source or missing requested material; record attempts and access limitations without bypassing login or paywalls. |
| Review | Not reviewed, reviewed within an explicit scope, or uncertain because necessary evidence remains unreadable. |
| Relationship | Listing alias, exact-file duplicate, companion, extract or embedded document; link to the corresponding source record. |
| Scope and disposition | Whole-deck synthesis, workstream/chapter summary, diagnostic findings, teaching overview, closing synthesis, no located summary, or unresolved. Include the actual reviewed ranges and evidence for the disposition. |

Count listing entries, deduplicated listings, unique file hashes and reviewed unique documents separately. Two aliases may share one file; one listing may contain a presentation and several companions. Equal titles do not prove equal files, and equal hashes do not make two listing entries independent evidence. Preserve rejected identity candidates separately from verified documents; do not include them in downloaded-deck or reviewed-deck totals.

Provisional provenance must remain visible in findings and handoffs. A verified hash establishes which bytes were inspected, not that the bytes have the claimed authorship or scope. State which conclusions remain usable and which depend on unresolved identity, version or completeness. Never infer corpus-wide coverage or quality from the accessible subset.

## Cite the correct page system

Use one-based **physical PDF pages** for PDF evidence and one-based **native slides** for native presentations. Record printed page labels separately; they may restart, omit a cover, use Roman numerals or differ after a filing wrapper. For example, a citation may say physical PDF page 14, printed page 1. Preserve the mapping rather than applying one assumed offset to a mixed document.

Office-to-text conversion can reflow a presentation into a different number of pages. That count is not the native slide count and must not be used in citations or coverage. Native PPTX slide order comes from the presentation's ordered slide relationships, not a filename sort or the order of extracted XML text. Notes remain notes unless explicitly being reviewed as narration.

For embedded decks and extracts, cite both the containing file and the included range. A parent document's printed page number is a useful locator, not evidence that omitted parent pages were acquired or reviewed. When comparing visible size, use the actual source crop; record whether normalization is equal visible height or fit to width. Neither view substitutes for the other when aspect ratios differ.

## Recognize synthesis by function and context

Read the title sequence and neighboring pages before classifying a summary. Recognize source-language headings and unlabelled synthesis; English keyword matching is only a locator. A contents entry, cover subtitle or repeated navigation heading does not establish a summary page. A theme preview lists topics; an executive synthesis develops the answer, evidence and relevant limits. A closing synthesis or chapter summary is valid evidence within its stated scope, not automatically a front whole-deck summary.

Review the complete logical span, including continuation pages and interleaved exhibits. A numbered continuation label is a clue, not permission to invent a missing page. Record observed page membership, source language, communication role, transition into detail and any gap. Use the canonical [storyline guidance](index.md) and [copy owner](../components/copy.md) to assess substantive completeness; do not impose a fixed heading, branch count or detached close merely to classify an original.

## Bounded extraction fallback

Start with an exact-file text and title-sequence extract. Reuse an unchanged cached extract when its source hash, extraction method/version, page system and coverage still match. Preserve page boundaries, language and the distinction between body text and notes. Cache the extraction evidence separately from later interpretation.

If text is empty, fragmented or inconsistent with the visible document, inspect the necessary original pages. Reuse verified OCR before running new OCR; if needed, OCR only the bounded candidate summary span and adjacent context required to resolve its role. Record the tool/method, exact source hash, reviewed pages and unresolved uncertainty. Verify material figures, negation, qualifiers and reading order against the original image when OCR affects a finding.

Empty extraction is not evidence that a summary is absent. If bounded inspection cannot resolve the relevant pages, use an uncertain disposition and explain the missing evidence. Do not manufacture a transcription, recreate slides to make them readable, or claim a complete source review from a partial extraction.

## Review originals without rebuilding them

For a requested corpus or source-pattern analysis, declare the authorized scope first: for example, executive summaries with title-sequence context. Review each available unique document in turn, preserve a disposition even when no relevant synthesis is found, and collect findings across the complete requested set. Necessary original-page image checks are source inspection, not slide generation.

Batch the findings by canonical owner and distinguish existing coverage, conflicting guidance, missing metadata and demonstrated runtime gaps. A source pattern alone does not prove a new renderer is needed. Keep proposals grounded in exact source ranges and limits; do not make acceptance claims for artifacts that were never created.

Use the [evaluation modes](../evaluation/index.md#choose-the-evaluation-mode) and [artifact lifecycle](../tools/artifact-lifecycle.md) to select checks and retain evidence. Original-only analysis requires no fresh recreation, per-source-slide model calls or full golden run. Changed or exported artifacts still require their applicable release gates.


## Research to the planned comparison

Before drafting, build an alternatives-by-criteria coverage matrix in the evidence plan. Every shortlisted option needs evidence for the user's decisive criteria or an explicit, justified open status. Choose the required geography, period, unit and population before collecting isolated facts. Do not equate unresearched accessible information with an unknown future office or other missing user input.

Research the inputs required by the planned exhibit: coordinates/access evidence for a map, matched attributes for rental comparisons, and actual values for sensitivity calculations. Keep observations separate from modeled waiting times, budgets and access assumptions. Extract the relevant original evidence with provenance and sufficient context for independent verification; omit navigation boilerplate and unrelated material. An author's summary is not a substitute for the source bytes.
