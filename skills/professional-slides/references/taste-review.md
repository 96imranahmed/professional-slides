# The taste review

The pass no threshold makes. Every defect this skill has caught that mattered
was caught by a person opening the rendered pages and looking at them — the
gates found the geometry, and a reader found that the deck said nothing. This is
that reader, as a step in the build.

Run one independent reviewer over the whole deck per iteration. Preserve each rendered candidate and its report. When the user requests iteration, repair the highest-impact findings at their earliest shared owner, rebuild, and run a fresh review. Do not tell the reviewer what score to produce. Stop only when the requested standard is actually met, with no unresolved major or blocker findings; disclose unavailable evidence.

## Running it

After a build, `out/rendered/` holds `spread-N.png` — the deck at reading size,
four pages to a sheet, each page's number burned into its corner. Spawn **one**
subagent with the brief below and the spread paths. It reads the images itself;
do not paste them into the prompt.

```
Read every spread in <out>/rendered/. Follow <skill>/references/taste-review.md
and <skill>/references/design.md. Return the JSON described there and nothing else.
```

The report lands at `out/taste-review.json`. Treat `blocker` findings as build
failures and `major` as fix-before-delivery, exactly like a gate finding.

## The brief

You are the first reader. Nobody has explained the deck to you and nobody will.

**Read the titles alone first, in order, before you look at a single page.**
Write down what you think the deck argues. If the titles do not add up to an
argument, that is the first finding and it outranks everything else on this
list.

Check the factual premise and evidence state against dated sources and disclosed assumptions: distinguish an announced transaction from a completed one, platform usage from paid customers, and a modeled hurdle from a forecast. Apply the evidence reconciliation contract in [Storylining](storylining.md#reconcile-evidence-before-design).

Then look at the pages. Reconcile every promised criterion with a page that actually develops it; listing a dimension in a scorecard is not coverage. Read appendix conclusions as claims too: an exhibit about one population cannot substantiate a claim about an unshown comparator. Reconcile reused totals, sample membership, denominators and durations before rating. Read the full argument again after a global correction: stale versions often survive in a chart comment, a summary or the close. A judgement label cannot excuse an unbounded claim. For each spread ask:

1. **Where does the eye land first, and is that the finding?** If the first
   thing you see is a grey box, a heading, or the largest table cell rather than
   the thing the title claims, say so.
2. **Does the commentary tell you anything the exhibit does not?** A column that
   restates the table beside it in different words is dead weight. Quote the
   sentence.
3. **Could this page be deleted without loss?** Name every page that could. A
   fifty-page deck that should be thirty is a worse deck, not a longer one.
4. **Is anything misaligned, overlapping, clipped, or floating in space** that a
   person would notice in one second? Two panels read across must share a
   baseline. A rule under nothing is a defect. A box two lines tall around one
   line of text is a defect.
5. **Does the page use one visual grammar or three?** A horizon band, a photo
   strip and an icon list on one page is three.
6. **Is the same page here twice?** Two tables with the same columns, two charts
   with the same shape, two lists with the same lead structure — across the deck,
   not just the spread.
7. **Does the deck ever measure anything?** Count the pages carrying a plot. If
   a comparison is argued for fifty pages and charted on one, say so plainly.

Before scoring, audit heading ownership on every page: does the subtitle merely paraphrase the chart heading? If so, remove it and preserve unique scope once. Tables and non-chart exhibits need no extra exhibit heading. Check that filled category cells distinguish category labels instead of repeating a membership attribute. Where the verdict explicitly means good/bad, confine status colour to short text labels or check/cross icons. Reject automatic red/green status mapping on chart marks, series swatches or backgrounds; ordinary house-palette colours remain valid. These are semantic checks even when lexical-overlap gates pass.

Test the comparison against the reader's decision, not just its labels: initial commitment and full optional commitment must be comparable on both sides. Check whether a small aggregate needs named contributors on the page. A column labelled implication or decision must change the reader's choice or delimit an inference; a metric definition under that heading is still redundant.

Check series identity on the saved chart: every series needs a legend or direct name, including after label settings change. Check the kinds of items compared: editorial conclusions are not peer events, and examples are not stages. A page title must describe the displayed distribution, including exceptions, rather than exaggerating a house-wide pattern.

Audit the sequence using normalized architectures: chart/table above two or three commentary columns, prose or cards, with or without an insight strip, is one design. Swapping chart types, mirroring panels or adding furniture does not count. A repetitive deck cannot receive an excellent score because each individual page is tidy. Compare actual representative pages to strong reference pages at full size and identify what their evidence relationships do better.

If user inspection exposes a recurring defect missed by an accepted review, withdraw that acceptance as a quality signal, update the relevant design/review rule, and reassess the full next candidate. A prior score is not a floor and successive iterations need not improve. Document user calibration separately from the independent score; do not average them or manufacture agreement.

For alternative decks, compare the versions with colour and typography ignored. Identify the different narrative order, evidence relationships and reader task. A palette-only set cannot pass as content or visualization alternatives. Read the ending for repeated recommendations: consolidate selection criteria, named options, commitment and next steps when several pages merely restate the same choice.

Calibrate against the strongest comparable reference pages, not the previous candidate’s score. An exceptional score requires a developed argument and evidence relationship on the weakest page as well as the best page; clean geometry and absence of defects alone are insufficient. Record concrete reference comparisons and remaining limitations before assigning the rating.

A median supports a statement about the typical observation; a consistency claim also needs a spread measure. Search summaries, scorecards and the close for the same wording after correcting a statistical interpretation. Decomposition bridges must disclose the baseline and allocation order and must not turn an arithmetic contribution into a causal claim.

Before accepting a distribution, reproduce its summaries from the named observations and stated quantile method. Check observation date and cohort counts against the exhibit. A familiar population label or a source-family name is insufficient. At the ending, return to the original reader decision; do not introduce a new comparison there. Attach event-specific interpretation to its event when detached commentary weakens the mechanism.

After replacing an exhibit or its data, reconcile the displayed source map as well as speaker notes and sidecar records: remove obsolete measures and identify the new edition, population or primary record. Inspect selective line labels against every series, not only the labelled point; omit a nonessential label if its placement creates false attribution.


Then, across the whole deck:

- **Name the worst page and say why.** Not the weakest — the worst.
- **Name the best page**, so the deck has something to imitate.
- **Rate it out of ten**, as a reader receiving it, with one sentence of
  justification. Be honest; a 4 that says why is worth more than a 7 that does
  not.

### What not to report

- Anything a gate already measures numerically — ink, type size, characters per
  line, word counts. Those have thresholds; you have judgement. Use it.
- Preferences. "I would have used blue" is not a finding. "The accent is on the
  row that is not the answer" is.
- The same defect on twenty pages, twenty times. Report it once, list the pages.

### What to return

Use `runtime/reviewer.mjs` as the single transport schema: `accepted`, `summary`, `rating` (0–10), `binding`, `inspectedSlides`, and `findings` with `slide` (stable ID or null), `code`, `severity`, `reason`, and `repair`. A precise new upper-case code is allowed. Major and blocker findings prevent acceptance. Record the titles-only argument, best/worst pages and deletion candidates in a companion narrative if useful.

Compute `binding` with `reviewBinding(out)` only after inspecting the current files. It hashes the editable deck, scene and every render. `inspectedSlides` lists every current slide ID actually inspected. Delivery rejects a stale binding or incomplete coverage. Any subsequent build needs a fresh review.

For reference benchmarking, preserve an inventory of every requested reference, its availability, hash and pages inspected. Report deck coverage and page coverage separately. Representative pages from every deck establish all-deck sample coverage, not full-page coverage. Inspect strong comparable examples at full size and name the devices they use more effectively. Damaged or unavailable reference pages remain explicit gaps; they do not count as a visual pass. Scores assess argument, evidence, copy, hierarchy, exhibit choice and rhythm. They are independent judgements, not mechanical transforms of gate statistics.

## Why this exists rather than more thresholds

Three decks in this repository passed every gate and were wrong in the eye. The
last one cleared 40-odd numeric thresholds and was rated 2 out of 10, because
its commentary restated its tables, its tables were the same table, and fifty
pages of comparison carried one chart. Each of those is now a gate — but they
became gates *because somebody looked*, and the next class of defect will not be
in the list until somebody looks again.

A threshold catches what it was told to catch. This catches what nobody thought
of, which is the only thing worth spending a model on.
