# The taste review

One independent first reader inspects each candidate after generation. Passing gates establishes only the checks they measure. This review owns editorial judgment, reference comparison and the score; [Design](design.md) owns the visual rules and [Storylining](storylining.md) the evidence rules.

## Independent first reading

Spawn one reviewer per whole-deck candidate. Give the realistic brief, exact artifact paths, source records and available references. Withhold prior scores, the requested target, the repair list and preferred verdict until the reviewer has written its first assessment. Keep prior-review artifacts and peer status summaries outside the first reader's context; if exposure occurs, disclose it and use a fresh reader for the independent score. Then permit targeted regression verification without revising history to match an expected result.

```text
Review <candidate> as its intended reader, using <brief> and <source records>.
Read the current skill's Storylining, Design and Taste review guidance.
Read the titles first, then every original and spread in <out>/rendered/.
Compare strong relevant originals from every requested reference deck.
Write an independent assessment before consulting prior scores or repairs.
Return the bound review and literal reference/page coverage with concrete comparisons.
```

Do not supply a desired score. Keep each candidate and report. Iterate requested work at its earliest shared owner; if the user ends iteration, report the last verified result and remaining limitations.

## Three reading scales

1. **Title spine:** write what the deck argues before opening slides. Does it answer the actual choice/horizon or promised explanation? Trace every decisive branch to proof. Check summary and close against the same scope, approval unit and evidence state. Identify the strongest countercase and the consequence of missing research.
2. **Every original page:** inspect the actual evidence, labels, emphasis, hierarchy and reading effort at full size. Use the design decisions at their owner, including useful omitted cues, semantic table roles, heading ownership and text-only status colors. Does the finding appear before the furniture? Does commentary add something? Are comparisons local and equivalent? Do recorded treatments survive nested composition and export?
3. **Every spread and the whole sequence:** compare normalized evidence relationships, density and narrative progression. Different chart types or two/three commentary columns do not establish variety. Preserve purposeful comparison series while challenging repeated informational jobs.

At each scale judge the saved artifact, not its labels or metadata. A declaration of category treatment is not a filled cell; a diagram with arrows is not a developed mechanism. A complete compact summary does not need extra metrics or icons.

For a pre-read, explicitly test substantive text coverage against comparable reference originals. Can the reader explain why the evidence supports the claim, the relevant mechanism, the material limitation and the decision consequence from the page alone? Flag recurring terse labels, unsupported takeaways and large empty regions where necessary explanation is absent. Repair the missing reasoning before resizing visuals; extra repeated sentences or a mandatory insight box do not satisfy this check.

## Density pass

The word floor in the dot-dash is hard, so no page ships under the client pages doing its job. Clearing it is not the same as reading like them. Each build writes `density-profile.json`: the rendered pages measured the way the corpus was (body words against the page's reading task, text blocks per page, words per block, longest block) beside the client targets, with every page outside the target band flagged.

Read the deck comparison first. The client median page carries four blocks of about 56 words, its longest block under 152, and body words at the task median. Then open every flagged page and give it a verdict:

- **right:** the density suits the job. A chart-led page with one line of takeaway may rightly sit light, and a record table may rightly run dense.
- **too thin:** the reader cannot explain the claim, mechanism, limitation or consequence from the page.
- **too dense:** padding, restatement or detail the page does not need to prove its title. A page padded to clear the floor goes here.
- **wrong shape:** the words are right in number and wrong in form, for example one long block where the client page makes three points.

Record `density.deck` (the deck's medians against the targets and what that means for a reader) and one `density.pages` entry per flagged page. Delivery refuses a review that skips a flagged page, and any verdict other than right blocks it as `DENSITY_MISMATCH`. Judge the page, not the number: the profile asks the question and the reader answers it.

## Adversarial editorial challenge

Name the worst page, best page and most repetitive sequence. For the most deletable page, draft the strongest merger/replacement concept and identify what evidence would be lost. If retaining it is better for this brief, explain why. The 50+ evaluation minimum does not protect filler, an unnecessary preview or a methods lesson that can be joined to its result. Audit lookup can earn its appendix role without being counted as another argument.

Challenge the least-supported conclusion or permission. Inspect interacting constraints together: a released hour may not be schedulable or cancellable; a prototype success may not establish an integrated replay. A generic instruction to test a mechanism is not the tested mechanism. Keep synthetic illustrations separate from empirical premises and readiness evidence.

Reconcile decisive quantities to named records: populations, units, horizons, scenario parameters and accounting bases. After a revision, trace a changed claim through notes, source map, summary and close. Inspect baseline-to-repair transitions at their actual failure boundary and retain unchanged failures. Reproduce material summaries when the evidence is supplied; do not infer cohort membership from a familiar label. Cross-check trigger thresholds against the governing inequalities and trace capacity changes through upstream inputs and permissions. Reproducing the calculation does not verify that its assumptions agree with the deck.

Do not list twenty copies of one defect. Name the cause, affected IDs and earliest owner. A semantic or visible defect can be substantive even when all numeric gates pass. Do not report preferences, manufacture a fault quota or turn distribution statistics into a taste formula.

## Benchmark and score

Before scoring, inspect strong comparable originals from each requested reference. Compare the evidence relationship and reader effort: what does the reference make visible that the candidate leaves to prose or mental joins? Use the [atlas](reference-atlas.md) to find suitable devices, not to substitute schematics for original reference inspection. Do not copy reference quirks that conflict with the user brief.

Record argument, evidence, visual explanation, hierarchy/copy and sequence quality separately in the narrative. Use calibrated anchors, not a mechanical average:

- **5:** understandable in parts, but weak proof, repetitive structure or costly reading materially limits usefulness.
- **7:** useful and mostly supported, with substantial editorial/design work still needed.
- **9:** strong argument and evidence, effective visual explanation, coherent rhythm; remaining weaknesses are limited and explicit.
- **9.5+:** exceptional against strong comparable references across the deck, including its least effective page. No avoidable generic framework, unearned duplicate or missing decisive relationship is excused by a clean build.

No major/blocker findings is necessary for acceptance, but not sufficient for an exceptional score. A valid appendix lookup need not be spectacular; it must earn its place and be efficient for its task. A prior score is not a floor. User calibration remains separate, never averaged into the independent rating. If user inspection exposes a recurring missed defect, withdraw the earlier acceptance as a quality signal and reassess the next full candidate.

## Coverage and report

Skill evaluation defaults to at least 50 rendered pages; below-minimum diagnostics need an explicit user override to qualify. Mark an evaluation deck `purpose: "evaluation"` and the build refuses it under 50 pages (`EVALUATION_TOO_SHORT`). Page count establishes eligibility, not quality. [Evaluation](evaluation/index.md#forward-testing-the-skill) owns unseen transfer cases.

Return `out/taste-review.json` using `runtime/reviewer.mjs`: `accepted`, `summary`, `rating`, `binding`, `inspectedSlides`, `density` (the density pass above), `findings` with `slide`, `code`, `severity`, `reason`, `repair`. Precise uppercase finding codes are allowed. Major/blocker findings prevent acceptance. The companion narrative holds first-reading argument, merger challenge, best/worst pages, dimension assessment, comparisons and limits.

Compute `binding` with `reviewBinding(out)` after inspecting current files. It hashes PPTX, scene and every render. `inspectedSlides` contains all current IDs actually inspected. Delivery rejects stale/incomplete review; every rebuild requires a fresh review.

Keep a reference inventory with path/hash, availability, total pages and exact originals inspected. Distinguish deck coverage from page coverage; sampling every reference deck is not inspecting every page. Historical reports and unavailable/damaged pages do not count as fresh visual inspection. Disclose missing model/source verification. Technical validation, editorial acceptance and user acceptance remain distinct.
