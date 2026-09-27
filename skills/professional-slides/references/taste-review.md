# The taste review

The storyline critique is ready for the deck's current title spine first ([Storylining](storylining.md#stress-test-the-storyline)); the author checks the deck's claims; then one independent first reader inspects the finished candidate exhaustively, and later passes only verify. Passing gates establishes only the checks they measure. This review owns editorial judgment, reference comparison and the score; [Design](design.md) owns the visual rules and [Storylining](storylining.md) the evidence rules.

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

## Order of the reviews

1. **Storyline critique** of the dot-dash, before the copy is written: exhaustive pass, revise, verification passes until it says `ready`.
2. **Gate:** `storyline-review.json` says `ready`, no major or blocker item is open across its passes, and it is bound to the current title spine. `reviewer.mjs` will not write a deck-review packet, and delivery will not accept a deck review, until it is; a spine edited after the critique names its changed pages and asks for the critique to be run again first.
3. **Full copy and build**, then the [self-check](#self-check).
4. **Deck review pass 1**, exhaustive ([below](#pass-one-is-exhaustive)).
5. **Fix and rebuild.**
6. **Verification passes** ([below](#later-passes-verify)), at most three passes in all.
7. **Deliver** when no major or blocker finding from any pass is open.

## The rubric

Every page is checked on every page dimension, and the deck on the three deck dimensions. The rubric in `runtime/reviewer.mjs` holds the same list and the prompt prints it.

| Dimension | Scope | What is checked |
| --- | --- | --- |
| `argument` | page | The title states the finding the page proves, and the exhibit and commentary prove it; the claim goes no further than its evidence; the page's job in the argument is clear. |
| `evidence` | page | Every number reproduced against its source and the other pages that print it; evidence deep enough for the claim (the whole peer set, the trend with its rate, not two numbers); compatible bases, units and periods; members compared on the same measures, n/a where one does not publish a measure. |
| `chart` | page | The form fits the comparison (ranking, trend, share, bridge, distribution); honest axes - time spaced by time, bars from a zero baseline, scale and units stated; the subject highlighted and rivals muted; an annotation marking the finding; no two-number chart. |
| `table` | page | Verdict, score and status cells encoded (Harvey balls, ratings, pills, bars), not plain words; totals defined and filled; units in the headers; numbers right-aligned and rounded alike; meaningful row and column order. |
| `text` | page | Density right for the reading task; the longest block readable; no sentence restating the title or exhibit; jargon explained; an action title that commits in two lines or fewer; a subtitle that adds scope, not a second title. |
| `layout` | page | No empty band; the exhibit dominates and the page balances; edges aligned; hierarchy reads title, exhibit, commentary; the frame occupied, not a small figure in a large box. |
| `identity` | page | Named companies, products and places carry logos, product images or maps where recognition matters; a player is introduced before it is compared. |
| `sourcing` | page | Every number and claim has a source a reader can look up, with its as-at date; footnotes define estimates, bases and exclusions. |
| `consistency` | deck | No construction repeated across a window of neighbouring pages; equal things styled alike; one term for one thing; one number format, unit and rounding per measure. |
| `rhythm` | deck | Sections open, develop and close; page types vary with the reading task; the sequence builds; no page previews or re-proves another. |
| `bookends` | deck | The executive summary states the answer and pillars the body proves, with its numbers; the close states the decision, conditions and next step and agrees with the summary. |

**Severity** is calibrated so the same defect gets the same level on every deck (defined once in `runtime/review-passes.mjs`):

- **blocker:** a reader would be misled or the page cannot be shown - a wrong or unreconciled number, a claim its evidence contradicts, a distorting encoding (unequal time gaps drawn equal, a truncated bar baseline), clipped or unreadable content, an unfinished element (a blank total row, a placeholder).
- **major:** a partner would send the page back - the point arrives late, at avoidable cost or with the wrong emphasis: the wrong chart form, a judgement table set as plain text, a wall of text, an empty band, a missing identity anchor, a construction repeated across neighbouring pages, density wrong for the task.
- **minor:** polish noticed only on close reading that does not change what the reader takes away.
- **none:** an observation needing no action.

## Pass one is exhaustive

Every later pass only verifies, so the first pass is the only one that may find everything, and it must. A first pass that samples ("e.g. p11, p16-p19") leaves the author to find the rest and the next pass to find them again - the loop never ends. Validation (`validateReview`) refuses a pass-one review that:

- misses any rendered page in `pages`, the coverage record: one entry per page with its `verdict` (`ok`, `minor`, `major`, `blocker`) and `checks`, a short note for each page dimension ("n/a - no table on this page" where there is nothing to check);
- gives a page a verdict other than the worst open finding naming it;
- files a deck finding without its full page list: `scope: "deck"` lists every affected page in `slides`, and a list given by example ("e.g.", "such as", "etc.") or a reason naming a page the list leaves out is refused;
- leaves a finding without an `id`, a rubric `dimension`, a concrete `repair` (what to add, replace, move, merge, cut, plot or rewrite) or `checkable` (a rule, or null);
- skips the **completeness self-check**: `completeness` holds one entry per dimension, `findings` when any was filed under it, or `clean` with what was checked and why nothing was found;
- omits the `assessment` (argument, evidence, visual, copy, sequence, best page, worst page, most repetitive sequence, most deletable page).

### Long decks: section reviewers

Above 24 pages the packet splits the first pass, so that no reader has fifty pages to hold:

- **Section prompts** (`review-packet/sections/s1.md`, ...): one section per divider, short ones folded together, none over 14 pages; each reviewer checks its pages on every page dimension.
- **The spine prompt** (`sections/spine.md`): the deck dimensions across the whole sequence, the assessment, the rating and the density comparison.
- **Run them in parallel** where the harness has subagents, one fresh reviewer each; save the answers as `review-packet/parts/<id>.json` and run `node runtime/reviewer.mjs merge out/` (or pass the parts folder to `deliver-deck.mjs --review`). The `codex` and `claude` backends run the parts in parallel themselves; a harness without subagents works through `prompt.md` alone, page by page.
- **The merge** refuses a part that misses a page of its section, joins a deck finding seen from several sections (same code and dimension) into one over the union of its pages at the worst severity, renumbers colliding ids, and recomputes page verdicts, since a spine finding can raise a page its section reviewer passed.

## Later passes verify

Pass two and after record `pass` and `verifies` (the binding of the review verified), and do three things only:

1. **A status for every open finding** in `statuses`: `fixed`, `partly fixed`, `not fixed` or `regressed`, with the evidence seen. A partly fixed finding may carry a lower residual `severity`. A missing status is refused.
2. **The pages to read** - those whose scene or render changed, the neighbours of deleted pages, and the pages open major or blocker findings name - recorded in `pages` as in pass one. Unchanged pages keep their verdicts and "right" density judgements.
3. **New findings only if additive:** major or blocker, with a `basis` - `changed` (on a changed page), `regression` (introduced by the rebuild, justified) or `missed` (a blocker the first pass demonstrably could not see, with a `justification` of why). A new minor finding, a new finding on an unchanged page that is not a justified blocker, and a repeat of an open finding are refused.

Delivery keeps each validated pass in `review-history/` with its ledger: every finding raised by any pass and its latest status. The deck is accepted when the reviewer accepts and no major or blocker finding from any pass is open. The loop is capped at three passes (`--max-passes`); a deck still rejected after the third goes back to the user with its open findings, and another pass runs only when the user asks. Pass `--full-review` when the repair changed the argument itself (a new answer, a re-pulled dataset, a reordered storyline): it starts a new lineage with an exhaustive pass.

## Every checkable finding becomes a check

The review judges only what code cannot: whether the argument holds, what deserves emphasis, whether a page earns its place. A defect a deterministic check could have caught before the build - a callout covering a data label, a title over two lines, a caption that repeats its panel heading, a table using a third of its frame - is a review spent doing a check's job. The reviewer marks each such finding with `checkable: { rule, measure }`: the rule a check would enforce, and what it would measure against what threshold. Judgement findings carry `checkable: null`.

Recording a review writes those findings to `review-history/check-candidates.json` (`checkCandidates(review)` in `runtime/reviewer.mjs`), one entry per rule, with its slides, the reviews that raised it and a count. When fixing the skill ([SKILL.md, Iterate the reusable skill](../SKILL.md#iterate-the-reusable-skill)), turn each candidate into a compile-time check in `author-deck.mjs` / `page-types.mjs` or a composition check in its owner, with a test, so the same defect never reaches a review twice. A candidate a gate already reports but too late - after the build rather than at authoring - is moved earlier, not dismissed.

## Independent first reading

Spawn one reviewer per whole-deck candidate, or one per section plus a spine reviewer for a long deck ([above](#long-decks-section-reviewers)). Give the realistic brief, exact artifact paths, source records and available references. Withhold prior scores, the requested target, the repair list and preferred verdict until the reviewer has written its first assessment. Keep prior-review artifacts and peer status summaries outside the first reader's context; if exposure occurs, disclose it and use a fresh reader for the independent score. Then permit targeted regression verification without revising history to match an expected result.

```text
Review <candidate> as its intended reader, using <brief> and <source records>.
Read the current skill's Storylining, Design and Taste review guidance.
Read the titles first, then every spread in <out>/rendered/, then every page at full size on every rubric dimension.
Compare strong relevant pages of any reference deck the user supplied.
Write an independent assessment before consulting prior scores or repairs.
Return the bound review: a verdict and a note per dimension for every page, every affected page for every deck finding, and the completeness self-check.
```

Do not supply a desired score. Keep each candidate and report. Iterate requested work at its earliest shared owner; if the user ends iteration, report the last verified result and remaining limitations.

## Three reading scales

1. **Title spine:** write what the deck argues before opening slides. Does it answer the actual choice/horizon or promised explanation? Trace every decisive branch to proof. Check summary and close against the same scope, approval unit and evidence state. Identify the strongest countercase and the consequence of missing research.
2. **Every page, at full size:** inspect the actual evidence, labels, emphasis, hierarchy and reading effort on each rubric dimension, using the four-up spreads to compare neighbours. Use the design decisions at their owner, including useful omitted cues, semantic table roles, heading ownership and text-only status colors. Does the finding appear before the furniture? Does commentary add something? Are comparisons local and equivalent? Do recorded treatments survive nested composition and export?
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

Do not list twenty copies of one defect: file it once, as a deck finding listing every affected page, with its cause and earliest owner. A semantic or visible defect can be substantive even when all numeric gates pass. Do not report preferences, manufacture a fault quota or turn distribution statistics into a taste formula.

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

Return `out/review.json` to the schema `runtime/reviewer.mjs` writes into the packet: pass one carries `pass: 1`, `verifies: null`, `accepted`, `summary`, `rating`, `binding`, `pages`, `findings` (each with `id`, `scope`, `slides`, `dimension`, `code`, `severity`, `reason`, `repair`, `checkable`), `completeness`, `assessment` and `density` (the density pass above); a later pass carries `pass`, `verifies`, `pages` for the pages it read, `statuses`, additive `findings` with `basis` and `justification`, and `density`. Precise uppercase finding codes are allowed. Open major/blocker findings prevent acceptance.

Compute `binding` with `reviewBinding(out)` after inspecting current files. It hashes PPTX, scene and every render. `pages` covers every current page on pass one and every page the packet names on a later pass. Delivery rejects a stale or incomplete review; every rebuild requires a new pass, which is a verification of the changed pages unless `--full-review` is passed.

When the user supplied reference decks, keep an inventory of them with the pages inspected; sampling every reference deck is not inspecting every page. Historical reports and unavailable/damaged pages do not count as fresh visual inspection. Disclose missing model/source verification. Technical validation, editorial acceptance and user acceptance remain distinct.
