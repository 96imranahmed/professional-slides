# The taste review

The author checks the deck's claims first; then one independent first reader inspects the finished candidate once. Passing gates establishes only the checks they measure. This review owns editorial judgment, reference comparison and the score; [Design](design.md) owns the visual rules and [Storylining](storylining.md) the evidence rules.

## Self-check

Every review round the author could have prevented costs a rebuild and a fifty-page reading. In the recorded Harry Potter evaluation, three full reviews in a row rejected the deck mostly on things visible with the data open: figures mistyped from the records, a superlative a rival also met, a comparison set applied to one franchise and not the others, a summary figure no page showed, and one proposition proved on three pages. The self-check settles those before the review.

Each build writes `claims.json`: the title spine in order and every sentence that states a number or a universal, ranked or comparative claim (only, every, highest, beats, more than), by page. It also flags `SUMMARY_UNPROVED`: a summary figure no proving page prints. Before requesting a review:

1. **Finish the deck.** Pictures sourced, every page present, nothing still planned. A review started on a changing deck is discarded.
2. **Reproduce every claim** in `claims.json` from the source records, not from memory or the deck's own text. For each superlative or "only", find the rival that comes closest. Check units, bases (nominal or real, with or without re-releases), and that the comparison set is one rule applied to every member, the subject included.
3. **Read the title spine alone.** Merge or cut pages that prove a proposition another page already proves; make sure every figure and reversal condition in the summary and close appears on the page that proves it.
4. **Look at every rendered page once** for the defects the gates cannot count: an empty band under the title, a hero number repeating the title, stock key lines, mismatched scales, one highlight used inconsistently.

Fix what fails and rebuild, then record `out/self-check.json`:

```json
{ "pages": { "<slide id>": { "claims": "<pageHashes[slide id] from claims.json>", "verified": true } },
  "findings": { "SUMMARY_UNPROVED:<claim id>": "what was done about it" },
  "spine": "which pages were merged or cut on the title-spine pass, or why none were" }
```

Delivery refuses to request a review until every page that makes claims has a current verdict (`SELF_CHECK_INCOMPLETE`). A page's hash covers only its claims, so after a rebuild only pages whose claims changed need checking again. The record is the author's statement that the claims were reproduced; do not fill it in without doing so.

## One review, then verification

The first review reads the whole deck and is the independent score; by default it is the only one, and any further review round, of the storyline or of the deck design, runs when the user asks for it. It reports every major and blocker defect it sees in that one pass. Delivery keeps each validated review in `review-history/`. When a rejected deck is rebuilt, the next review is a verification: it reads only the pages whose scene or render changed and the pages the previous review blocked, checks each earlier blocking finding, and inherits the earlier verdict and "right" density judgements for every other page. It cannot open new findings on pages nobody touched, so a fix round converges. Pass `--full-review` when the repair changed the argument itself (a new answer, a re-pulled dataset, a reordered storyline); otherwise a verification is the right second round.

## Every checkable finding becomes a check

The review judges only what code cannot: whether the argument holds, what deserves emphasis, whether a page earns its place. A defect a deterministic check could have caught before the build - a callout covering a data label, a title over two lines, a caption that repeats its panel heading, a table using a third of its frame - is a review spent doing a check's job. The reviewer marks each such finding with `checkable: { rule, measure }`: the rule a check would enforce, and what it would measure against what threshold. Judgement findings carry `checkable: null`.

Recording a review writes those findings to `review-history/check-candidates.json` (`checkCandidates(review)` in `runtime/reviewer.mjs`), one entry per rule, with its slides, the reviews that raised it and a count. When fixing the skill ([SKILL.md, Iterate the reusable skill](../SKILL.md#iterate-the-reusable-skill)), turn each candidate into a compile-time check in `author-deck.mjs` / `page-types.mjs` or a composition check in its owner, with a test, so the same defect never reaches a review twice. A candidate a gate already reports but too late - after the build rather than at authoring - is moved earlier, not dismissed.

## Independent first reading

Spawn one reviewer per whole-deck candidate. Give the realistic brief, exact artifact paths, source records and available references. Withhold prior scores, the requested target, the repair list and preferred verdict until the reviewer has written its first assessment. Keep prior-review artifacts and peer status summaries outside the first reader's context; if exposure occurs, disclose it and use a fresh reader for the independent score. Then permit targeted regression verification without revising history to match an expected result.

```text
Review <candidate> as its intended reader, using <brief> and <source records>.
Read the current skill's Storylining, Design and Taste review guidance.
Read the titles first, then every spread in <out>/rendered/; open a page at full size only where a spread shows a possible defect.
Compare strong relevant pages of any reference deck the user supplied.
Write an independent assessment before consulting prior scores or repairs.
Return the bound review and literal reference/page coverage with concrete comparisons.
```

Do not supply a desired score. Keep each candidate and report. Iterate requested work at its earliest shared owner; if the user ends iteration, report the last verified result and remaining limitations.

## Three reading scales

1. **Title spine:** write what the deck argues before opening slides. Does it answer the actual choice/horizon or promised explanation? Trace every decisive branch to proof. Check summary and close against the same scope, approval unit and evidence state. Identify the strongest countercase and the consequence of missing research.
2. **Every page, through its spread:** inspect the actual evidence, labels, emphasis, hierarchy and reading effort on the four-up spreads, opening a page at full size only to confirm a suspected defect. Use the design decisions at their owner, including useful omitted cues, semantic table roles, heading ownership and text-only status colors. Does the finding appear before the furniture? Does commentary add something? Are comparisons local and equivalent? Do recorded treatments survive nested composition and export?
3. **Every spread and the whole sequence:** compare normalized evidence relationships, density and narrative progression. Different chart types or two/three commentary columns do not establish variety. Preserve purposeful comparison series while challenging repeated informational jobs.

**Finish is judged, not assumed.** A reviewer reading for the argument accepted a deck at 8/10 whose pages a reader called ugly on sight. Before the argument, look at the montage the way the reader will, and raise a major finding for each of these that recurs on more than a couple of pages:
- half a page empty, or a list set in the left half with nothing beside it;
- a small figure (three dots on a line, two ranks) floating in a band sized for a chart;
- a table stretched into tall rows of short phrases;
- emphasis the wrong way round: the rival or the target in the loudest colour, the subject muted;
- a share or two numbers drawn as a two-bar chart;
- source lines a reader cannot look up (ledger codes, "see source ledger");
- repeated page shapes (metric beside table) that make pages indistinguishable at thumbnail size.

A deck with a recurring finish defect is not scored above 7, however sound the argument.

At each scale judge the saved artifact, not its labels or metadata. A declaration of category treatment is not a filled cell; a diagram with arrows is not a developed mechanism. A complete compact summary does not need extra metrics or icons.

For a pre-read, explicitly test substantive text coverage against the task targets in `density-profile.json` and any reference the user supplied. Can the reader explain why the evidence supports the claim, the relevant mechanism, the material limitation and the decision consequence from the page alone? Flag recurring terse labels, unsupported takeaways and large empty regions where necessary explanation is absent. Repair the missing reasoning before resizing visuals; extra repeated sentences or a mandatory insight box do not satisfy this check.

## Density pass

The word floor in the dot-dash is hard, so no page ships under the target for its reading task. Clearing it is not the same as reading well. Each build writes `density-profile.json`: the rendered pages measured the way the targets are set (body words against the page's reading task, text blocks per page, words per block, longest block) beside the targets, with every page outside the target band flagged.

Read the deck comparison first. A typical well-made page carries four blocks of about 56 words, its longest block under 152, and body words at the task median. Then open every flagged page and give it a verdict:

- **right:** the density suits the job. A chart-led page with one line of takeaway may rightly sit light, and a record table may rightly run dense.
- **too thin:** the reader cannot explain the claim, mechanism, limitation or consequence from the page.
- **too dense:** padding, restatement or detail the page does not need to prove its title. A page padded to clear the floor goes here.
- **wrong shape:** the words are right in number and wrong in form, for example one long block where a well-made page makes three points.

Record `density.deck` (the deck's medians against the targets and what that means for a reader) and one `density.pages` entry per flagged page. Delivery refuses a review that skips a flagged page, and any verdict other than right blocks it as `DENSITY_MISMATCH`. Judge the page, not the number: the profile asks the question and the reader answers it.

## Adversarial editorial challenge

Name the worst page, best page and most repetitive sequence. For the most deletable page, draft the strongest merger/replacement concept and identify what evidence would be lost. If retaining it is better for this brief, explain why. The 50+ evaluation minimum does not protect filler, an unnecessary preview or a methods lesson that can be joined to its result. Audit lookup can earn its appendix role without being counted as another argument.

Challenge the least-supported conclusion or permission. Inspect interacting constraints together: a released hour may not be schedulable or cancellable; a prototype success may not establish an integrated replay. A generic instruction to test a mechanism is not the tested mechanism. Keep synthetic illustrations separate from empirical premises and readiness evidence.

Reconcile decisive quantities to named records: populations, units, horizons, scenario parameters and accounting bases. After a revision, trace a changed claim through notes, source map, summary and close. Inspect baseline-to-repair transitions at their actual failure boundary and retain unchanged failures. Reproduce material summaries when the evidence is supplied; do not infer cohort membership from a familiar label. Cross-check trigger thresholds against the governing inequalities and trace capacity changes through upstream inputs and permissions. Reproducing the calculation does not verify that its assumptions agree with the deck.

Do not list twenty copies of one defect. Name the cause, affected IDs and earliest owner. A semantic or visible defect can be substantive even when all numeric gates pass. Do not report preferences, manufacture a fault quota or turn distribution statistics into a taste formula.

## Benchmark and score

Before scoring, compare the candidate with the [atlas](reference-atlas.md) devices and, when the user supplied reference decks, with their strong comparable pages. Compare the evidence relationship and reader effort: what would a strong page make visible that the candidate leaves to prose or mental joins? Do not copy reference quirks that conflict with the user brief. Reference material is only what the user supplies in the task: do not search the filesystem for other decks or documents to benchmark against.

Record argument, evidence, visual explanation, hierarchy/copy and sequence quality separately in the narrative. Use calibrated anchors, not a mechanical average:

- **5:** understandable in parts, but weak proof, repetitive structure or costly reading materially limits usefulness.
- **7:** useful and mostly supported, with substantial editorial/design work still needed.
- **9:** strong argument and evidence, effective visual explanation, coherent rhythm; remaining weaknesses are limited and explicit.
- **9.5+:** exceptional against strong comparable references across the deck, including its least effective page. No avoidable generic framework, unearned duplicate or missing decisive relationship is excused by a clean build.

No major/blocker findings is necessary for acceptance, but not sufficient for an exceptional score. A valid appendix lookup need not be spectacular; it must earn its place and be efficient for its task. A prior score is not a floor. User calibration remains separate, never averaged into the independent rating. If user inspection exposes a recurring missed defect, withdraw the earlier acceptance as a quality signal and reassess the next full candidate.

## Coverage and report

Skill evaluation defaults to at least 50 rendered pages; below-minimum diagnostics need an explicit user override to qualify. Mark an evaluation deck `purpose: "evaluation"` and the build refuses it under 50 pages (`EVALUATION_TOO_SHORT`). Page count establishes eligibility, not quality. [Evaluation](evaluation/index.md#forward-testing-the-skill) owns unseen transfer cases.

Return `out/taste-review.json` using `runtime/reviewer.mjs`: `accepted`, `summary`, `rating`, `binding`, `inspectedSlides`, `density` (the density pass above), `findings` with `slide`, `code`, `severity`, `reason`, `repair`. Precise uppercase finding codes are allowed. Major/blocker findings prevent acceptance. The companion narrative holds first-reading argument, merger challenge, best/worst pages, dimension assessment, comparisons and limits.

Compute `binding` with `reviewBinding(out)` after inspecting current files. It hashes PPTX, scene and every render. `inspectedSlides` contains all current IDs actually inspected; a verification review lists the IDs its packet names. Delivery rejects a stale or incomplete review; every rebuild requires a new review, which is a verification of the changed pages unless `--full-review` is passed.

When the user supplied reference decks, keep an inventory of them with the pages inspected; sampling every reference deck is not inspecting every page. Historical reports and unavailable/damaged pages do not count as fresh visual inspection. Disclose missing model/source verification. Technical validation, editorial acceptance and user acceptance remain distinct.
