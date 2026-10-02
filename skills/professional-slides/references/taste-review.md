# The taste review

The storyline critique is ready for the deck's current spine first ([Storylining](storylining.md#stress-test-the-storyline)); the author checks the deck's claims; then one independent first reader inspects the finished candidate exhaustively, later passes only verify, and a fresh reader confirms any acceptance a verification pass reached. Passing gates establishes only the checks they measure. This review owns editorial judgment, reference comparison, the score and the rules of both review loops - the storyline critique runs by the same passes, caps and lineage; [Design](design.md) owns the visual rules and [Storylining](storylining.md) the evidence rules. Both reviews judge the deck against the user's request as recorded verbatim in the deck's `request` - never against the author's restatement of it; a new deck without it is refused (`REQUEST_MISSING`).

## Self-check

Every review round the author could have prevented costs a rebuild and a fifty-page reading. Most rejections the author could have prevented are visible with the data open: a figure mistyped from the records, a superlative a rival also meets, a comparison set applied to one member and not the others, a summary figure no page shows, one proposition proved on three pages. The self-check settles those before the review.

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

1. **Storyline critique** of the dot-dash, before the copy is written: `storyline.mjs <id>.deck.json out/` critiques the spine - the request, the governing answer, the sections, the titles in order, and each page's one-line claim, insight ids, page type and plotted numbers - from a packet of a line a page, and returns at most ten items. `--full` adds the page-level critique of every content page. Exhaustive pass, revise, verification passes until it says `ready`, at most three ([Stress-test the storyline](storylining.md#stress-test-the-storyline)).
2. **Gate:** the latest critique says `ready`, no major or blocker item is open across its passes, and it is bound to the current spine: the request and answer, each page's title, claim and what it settles, its page and exhibit types, and the numbers it plots. Rewording, commentary and table-cell text carry over; the deck review's verification pass checks the storyline items of the pages it rereads. Only a pass `storyline.mjs` recorded, or the answer to the packet it wrote, counts: a critique written into the file by hand is refused, and a recorded verdict is read from its record, not from the editable file. `reviewer.mjs` will not write a deck-review packet, and delivery will not accept a deck review, until the gate is ready (`STORYLINE_UNREVIEWED`). A full `author-deck.mjs` compile and `build-deck.mjs` print a warning while it is not ready, and do not stop.
3. **Full copy and build**, the [build bars](#acceptance-confirmation-and-build-bars), then the [self-check](#self-check).
4. **Deck review pass 1**, exhaustive ([below](#pass-one-is-exhaustive)).
5. **Fix and rebuild.**
6. **Verification passes** ([below](#later-passes-verify)), at most three passes in all.
7. **Confirmation read** when the accepting pass is a verification: delivery stages it and exits 3; the answer goes in `out/confirmation.json` and is submitted with `--review out/confirmation.json`. Then **deliver** ([below](#acceptance-confirmation-and-build-bars)).

Every command in the loop exits 0 done, 2 refused (a rejection, an invalid answer, a loop at its cap), 3 waiting on a reader - the printed `note` names the staged prompt and where to save the answer - and 1 on a crash.

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
- omits the `assessment` (argument, evidence, visual, copy, sequence, best page, worst page, most repetitive sequence, most deletable page);
- leaves a page out of `opened`, the pages the reader actually opened at full size - recorded apart from `binding`, which the packet prints and which says only which build was read;
- rates the deck below 8 while filing nothing major: that rating says substantial work remains, and the work is the findings;
- carries a field its schema does not name, at any level (an author's rebuttal is not part of a review).

### Long decks: section reviewers

Above 24 pages the packet splits the deck review's first pass, so that no reader has fifty pages to hold (the storyline's `--full` critique splits the same way above 30 content pages, at most 16 a section):

- **Section prompts** (`sections/s1.md`, ... in the staged packet): one section per divider, short ones folded together, none over 14 pages; each reviewer checks its pages on every page dimension.
- **The spine prompt** (`sections/spine.md`): the deck dimensions across the whole sequence, the assessment, the rating and the density comparison.
- **Run them in parallel** where the harness has subagents, one fresh reviewer each; save the answers as `parts/<id>.json` in the staged packet and run `node runtime/reviewer.mjs merge <id>.deck.json out/` (or pass the parts folder to `deliver-deck.mjs --review`). The `codex` and `claude` backends run the parts in parallel themselves; a harness without subagents works through `prompt.md` alone, page by page.
- **The merge** refuses a part that misses a page of its section, a page two section parts both read, and a section with no part; it reads `parts/<id>.json` only (a backend's raw `<id>.last-message.json` beside it is not a part); it joins a deck finding seen from several sections (same code and dimension) into one over the union of its pages at the worst severity, renumbers colliding ids, and recomputes page verdicts, since a spine finding can raise a page its section reviewer passed.

## Later passes verify

Pass two and after record `pass` and `verifies` (the binding of the review verified). The verifier is not told any earlier rating. It does three things only:

1. **A status for every open finding** in `statuses`: `fixed`, `partly fixed`, `not fixed` or `regressed`, with the evidence seen. A partly fixed finding keeps its severity: only a deck finding whose deterministic measure now passes on the rebuilt scene may drop (`TABLE_MONOTONY` when the table-treatment and variety measures pass, `NO_VISUAL_ANCHOR` when every page it names carries a picture, logo, icon or map; DOWNGRADE_MEASURES in `runtime/build-bars.mjs` lists them), and the packet marks which. A missing status is refused.
2. **The pages to read** - those whose scene or render changed, the neighbours of deleted pages, and the pages open major or blocker findings name - recorded in `pages` and `opened` as in pass one. Unchanged pages keep their verdicts and "right" density judgements. Every page an open density finding names gets a fresh density verdict whether or not the profile still flags it: that finding closes only on a verdict of `right`.
3. **New findings only if additive:** major or blocker, with a `basis` - `changed` (on a changed page), `regression` (introduced by the rebuild, justified) or `missed` (a major or blocker on an unchanged page, with `evidence` quoting the page exactly as printed and a `justification` of why the earlier pass could not see it). A new minor finding, a missed finding whose quote is not on the page, and a repeat of an open finding are refused.

A review that does not validate is refused as `INVALID_REVIEW`, a transport problem to resend rather than a deck defect. The loop is capped at three passes (`--max-passes`); a deck still rejected after the third goes back to the user with its open findings (`REVIEW_PASS_CAP`), and another pass runs only when the user asks.

## Acceptance, confirmation and build bars

- **The bar is 8.** A pass accepts only at a rating of 8 or more with no major or blocker finding from any pass open; below 8 the deck is rejected (`REVIEW_RATING`).
- **Build bars.** Delivery measures the built scene against the craft bars (`runtime/build-bars.mjs`: exhibit variety, tables treated, charts annotated, drawings per page from 12 analytical pages; no empty picture frame on any deck). A miss blocks delivery (`BAR_EXHIBIT_VARIETY` and its siblings) unless the deck carries a waiver, `waivers: [{ code, reason }]` in pages.json, and the accepting review confirms it: the packet shows each waiver and the review returns a verdict for each. A malformed waiver is `WAIVERS_INVALID`, refused at authoring and again at delivery.
- **Confirmation read.** When the accepting pass is a verification, delivery stages one more packet: a fresh reader - no ledger, no earlier rating, no earlier findings - reads the final artifact whole, opens every page, answers in `out/confirmation.json`, and must accept at the same bar (`REVIEW_UNCONFIRMED` otherwise; its findings join the ledger for the next pass). The cost is bounded at three passes and one confirmation; past that the deck goes back to the user. `delivery.json` reports the confirming reader's rating as the deck's score.
- **Provenance.** Every packet is staged in a clean temporary directory holding only the renders, the packet, the prompts and the schemas, and ends with its prompt hash. Every answer carries `provenance: { backend, model, promptHash }` echoing it; an answer that does not is refused (`REVIEW_PROVENANCE`). `--reviewer auto` runs the host's own CLI first and leaves a packet when the CLI is not signed in; the codex model comes from `evaluation/rules.json`.
- **Revisions.** A revision (`workflow: "existing_deck_revision"`) is compared, page by page through each page's `sourceSlide`, with the inventory it was imported from. A changed title, a moved page, a new page or a cut beside one changes the spine; changed words or numbers change the content. One whose spine is unchanged needs no storyline critique; otherwise the critique reads the spine changes. The deck review's first pass reads the content changes and files findings only where they are involved (every page, when only the styling changed).
- **Lineage.** Both loops keep their passes beside the deck file, keyed by deck id (`<deck dir>/.reviews/<id>/storyline-history/` and `review-history/`, with each pass's ledger, and `lineage.json` logging every restart), so a rebuild into another output directory continues the same lineage and cap. `--full-review` starts a new lineage with an exhaustive pass, for a repair that changed the argument itself, and needs `--reason`, which is logged; a second restart needs `--user-approved` (`LINEAGE_RESTART`). Switching the storyline critique between the spine and `--full` is a restart too.

## Every checkable finding becomes a check

The review judges only what code cannot: whether the argument holds, what deserves emphasis, whether a page earns its place. A defect a deterministic check could have caught before the build - a callout covering a data label, a title over two lines, a caption that repeats its panel heading, a table using a third of its frame - is a review spent doing a check's job. The reviewer marks each such finding with `checkable: { rule, measure }`: the rule a check would enforce, and what it would measure against what threshold. Judgement findings carry `checkable: null`.

Recording a review writes those findings to `<deck dir>/.reviews/<id>/review-history/check-candidates.json`, one entry per rule, with its slides, the reviews that raised it and a count. When fixing the skill ([Iterate the reusable skill](maintaining.md#iterate-the-reusable-skill)), turn each candidate into a compile-time check in `author-deck.mjs` / `page-types.mjs` or a composition check in its owner, with a test, so the same defect never reaches a review twice. A candidate a gate already reports but too late - after the build rather than at authoring - is moved earlier, not dismissed.

## Independent first reading

Spawn one reviewer per whole-deck candidate, or one per section plus a spine reviewer for a long deck ([above](#long-decks-section-reviewers)). Give it the staged `prompt.md` and nothing else: the prompt carries the user's request verbatim, the condensed review standard, the rubric and the page list, with the renders beside it, so the reviewer reads no skill file and cannot reach the output directory. Withhold prior scores, the requested target, the repair list and preferred verdict; verification prompts never state an earlier rating. Keep prior-review artifacts and peer status summaries outside the reader's context; if exposure occurs, disclose it and use a fresh reader for the independent score. Then permit targeted regression verification without revising history to match an expected result.

```text
Review the deck in <staged prompt.md> as its intended reader, against the user's request printed there.
Read the titles first, then every spread, then every page at full size on every rubric dimension.
Compare strong relevant pages of any reference deck the user supplied.
Return the bound review with `opened` and `provenance` as the prompt asks: a verdict and a note per dimension for every page, every affected page for every deck finding, and the completeness self-check.
```

Do not supply a desired score. Keep each candidate and report. Iterate requested work at its earliest shared owner; if the user ends iteration, report the last verified result and remaining limitations.

## Three reading scales

1. **Title spine:** write what the deck argues before opening slides. Does it answer the actual choice/horizon or promised explanation? Trace every decisive branch to proof. Check summary and close against the same scope, approval unit and evidence state. Identify the strongest countercase and the consequence of missing research.
2. **Every page, at full size:** inspect the actual evidence, labels, emphasis, hierarchy and reading effort on each rubric dimension, using the four-up spreads to compare neighbours. Use the design decisions at their owner, including useful omitted cues, semantic table roles, heading ownership and text-only status colors. Does the finding appear before the furniture? Does commentary add something? Are comparisons local and equivalent? Do recorded treatments survive nested composition and export?
3. **Every spread and the whole sequence:** compare normalized evidence relationships, density and narrative progression. Different chart types or two/three commentary columns do not establish variety. Preserve purposeful comparison series while challenging repeated informational jobs.

**Finish is judged, not assumed.** A deck can hold its argument and still look unfinished on sight. Before the argument, look at the montage the way the reader will, and raise a major finding for each of these that recurs on more than a couple of pages:
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

The word floor in the dot-dash is hard, so no page ships under the target for its reading task. Clearing it is not the same as reading well. Each build writes `density-profile.json`: the rendered pages measured the way the targets are set (body words against the page's reading task, text blocks per page, words per block, longest block) beside the targets, with every page outside the target band flagged. How these measures relate to the word floors and ceilings is set out once in [Evaluation](evaluation/index.md#word-measures).

One measure is not the reader's call. A deck whose prose pages run a median words per block outside the band strong pages keep (41 to 86) is refused at the build as `TEXT_FRAGMENTED` - under it the copy is broken into labels, over it set as slabs - and the repair is the copy, before any review.

Read the deck comparison first, against the targets in [Copy](copy.md#how-much-prose-in-one-run). Then open every flagged page and give it a verdict:

- **right:** the density suits the job. A chart-led page with one line of takeaway may rightly sit light, and a record table may rightly run dense. On a page with commentary or prose whose blocks average outside 41 to 86 words, `right` must quote in `point` the developed point that makes it right - 40 words or more, word for word as the page prints it; a page of fragments or one slab has none to quote, so it is not right.
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
- **8:** the delivery bar: nothing major open and the remaining weaknesses limited.
- **9:** strong argument and evidence, effective visual explanation, coherent rhythm; remaining weaknesses are limited and explicit.
- **9.5+:** exceptional against strong comparable references across the deck, including its least effective page. No avoidable generic framework, unearned duplicate or missing decisive relationship is excused by a clean build.

No major/blocker findings is necessary for acceptance, but not sufficient for an exceptional score. A valid appendix lookup need not be spectacular; it must earn its place and be efficient for its task. A prior score is not a floor. User calibration remains separate, never averaged into the independent rating. If user inspection exposes a recurring missed defect, withdraw the earlier acceptance as a quality signal and reassess the next full candidate.

## Coverage and report

Skill evaluation defaults to at least 50 rendered pages; below-minimum diagnostics need an explicit user override to qualify. Mark an evaluation deck `purpose: "evaluation"` and the build refuses it under 50 pages (`EVALUATION_TOO_SHORT`). Page count establishes eligibility, not quality. [Evaluation](evaluation/index.md#forward-testing-the-skill) owns unseen transfer cases.

Return the answer to the schema `runtime/reviewer.mjs` writes into the packet; a key the schema does not name is refused at any level:

- **Pass one** (`out/review.json`): `pass: 1`, `verifies: null`, `accepted`, `summary`, `rating`, `binding`, `opened`, `provenance`, `pages`, `findings` (each with `id`, `scope`, `slides`, `dimension`, `code`, `severity`, `reason`, `repair`, `checkable`), `completeness`, `assessment`, `density` (the density pass above: `deck`, and per flagged page `slide`, `verdict`, `reason` and, where required, `point`) and, when the packet shows waivers, `waivers`.
- **A later pass** (`out/review.json`): `pass`, `verifies`, `opened`, `provenance`, `pages` for the pages it read, `statuses`, additive `findings` with `basis`, `justification` and `evidence`, and `density`.
- **The confirmation read** (`out/confirmation.json`): `confirms`, a verdict and note for every page, its findings and the assessment.

Precise uppercase finding codes are allowed. Open major/blocker findings prevent acceptance.

The packet states `binding`: it hashes the PPTX, scene, every render and the request. `pages` covers every current page on pass one and every page the packet names on a later pass. Delivery rejects a stale or incomplete review; every rebuild requires a new pass, which is a verification of the changed pages unless `--full-review` is passed.

When the user supplied reference decks, keep an inventory of them with the pages inspected; sampling every reference deck is not inspecting every page. Historical reports and unavailable/damaged pages do not count as fresh visual inspection. Disclose missing model/source verification. Technical validation, editorial acceptance and user acceptance remain distinct.
