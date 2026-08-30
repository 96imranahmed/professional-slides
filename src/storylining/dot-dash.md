# Dot-Dash

This file owns the dot-dash grammar, hypothesis-to-story traceability, approval gate, and ghost-deck handoff. Build and prioritize the [`hypothesis tree`](hypothesis-tree.md) before using it; [`index.md`](index.md) owns the surrounding narrative workflow and final storyboard.

## Definition

The dot-dash is the text-only, slide-by-slide blueprint that converts the prioritized hypothesis tree into the deck's argument before pages are designed. A dot is the governing assertion or communication job for one planned slide; a dash is a subordinate reason, fact, analysis, exhibit, implication, transition, or open item that supports or qualifies that dot. The dot-dash is not a chapter summary, a list of topics, a transcript of all analysis, or a set of slide layouts.

Represent every planned slide in production order with exactly one dot, including the cover, executive synthesis, contents, chapter transitions, analytical pages, decision close, and any appendix page that will be authored. A dot cannot stand for a chapter or an unspecified run of slides. Split one assertion into several sequenced dots when its proofs require several pages, and split any dot that contains two independent primary claims. Write an analytical dot as a provisional action title and label every dot with a dot ID, its exact approved chapter or tracker item, and the hypothesis-tree node or nodes it resolves; use `NAV` for a purely structural page.

Every dot must contain at least one substantive dash that defines what the audience will receive on that page. A structural dot uses dashes to specify its communication function, required content, and tracker or transition state. An analytical dot normally uses at least three content dashes, kept separate rather than compressed into a broad sentence, to specify:

- the decisive evidence or reasoning required to support the assertion, including the relevant comparison, magnitude, period, population, or threshold when available;
- the expected analytical exhibit or qualitative proof, its required inputs, and the source or model dependency, without visual coordinates;
- the audience implication, decision consequence, or transition that makes the next dot necessary;
- any material uncertainty, unresolved test, owner, and effect on the conclusion.

Add further evidence dashes when one page needs several mutually necessary proof points. Do not compress a whole chapter into a few generic dashes such as `market attractive`, `customers value neutrality`, or `economics credible`; each surviving slide needs its own assertion and enough page-specific support to guide analysis, sourcing, and exhibit construction.

## Planning grammar

```text
● D04 [CH2: Standalone quality] [H2.1] Enterprise retention of [FY26 rate] supports the base case, but the [point] SMB gap requires a downside case
  — Thesis role: strengthen / qualify / test / operationalize the governing thought
  — Evidence: enterprise gross retention was [validated rate] in FY26 versus [validated rate] for SMB; show cohorts, period, population, and source IDs
  — Evidence: the plan assumes one blended retention rate; quantify the revenue and valuation effect of segment-specific rates
  — Exhibit: cohort-retention comparison plus a compact base-versus-downside bridge using the reconciled model inputs
  — Implication: keep the enterprise case, but condition price and the next dot's plan test on validated SMB churn
  — Open: missing test, owner, and effect if unresolved
```

The labels are control fields, not required on-slide copy. Use verified values when available and retain useful numbers in the provisional title when they materially sharpen the conclusion. When a value is unavailable, name the required metric, comparison, source, or decision threshold as unresolved rather than inventing a placeholder fact. A structural page may have fewer dashes than an analytical page, but no dot may be empty.

## Map the hypothesis tree to the story

Maintain this traceability list alongside the outline:

| Tree node | Hypothesis status | Dot or disposition | Evidence state | Story consequence |
| --- | --- | --- | --- | --- |
| `H1.1` | supported / contradicted / mixed / untested / blocked | `D02`, appendix, parked, or unresolved | available analysis, required test, or gap | claim advanced, claim narrowed, risk disclosed, or no-decision condition |

Every analytical dot must map to at least one hypothesis node. Every core or high-priority hypothesis must map to a dot or carry an explicit appendix, parked, or unresolved disposition. A dot may synthesize several sibling hypotheses only when their combined result supports one conclusion; a hypothesis may appear in several dots only when each page performs a distinct narrative job rather than repeating the same claim. Navigation pages may use `NAV` instead of a hypothesis ID and must not introduce unsupported analytical conclusions.

Read the dots without their dashes. They should form a complete answer-first executive memo from the audience's starting point to the required decision. Then read each dot with its dashes and confirm that the page-specific support is sufficient, non-redundant, quantified where the evidence permits, and honest about uncertainty. Finally compare the dot sequence with the intended page sequence; the counts and order must reconcile exactly.

## Thesis and chapter coherence

Every core dot must strengthen, qualify, test, or operationalize the governing thought. A dot that merely reports an available fact, describes a product area, or fills a requested topic without changing the thesis belongs in the appendix, must be rewritten around its decision contribution, or must be removed.

Write the chapter sequence above the dots using the exact tracker labels. Each chapter must resolve one distinct branch of the root question, and its final dot must state what that branch means for the governing thought. The next chapter must be necessary because of the previous chapter's conclusion; if the chapters could be freely reordered without changing the argument, the outline is an evidence inventory rather than a storyline.

The first executive answer and the closing decision must be semantically equivalent: the close may narrow the answer with evidence, conditions, or gates, but it must not reveal a different thesis. Read the first answer, chapter-ending dots, and final decision as one chain before approving the outline.

## Approval gate

Review and revise the complete outline with the relevant decision owners before creating a deck document, layout, or exhibit. If the agent runtime provides `gather feedback` or an equivalent interactive review capability, present the reviewable dot-dash through it, ask the owner to approve or request revisions, apply every accepted change, and resubmit the complete revised artifact until the owner explicitly approves it. If that capability is unavailable, provide the reviewable artifact in the available channel and request the same explicit approval. Silence, lack of edits, approval of the brief, or approval of an earlier version does not count as approval of the current dot-dash.

Do not create a PowerPoint file, native Google Slides document, ghost deck, or other slide document until the explicitly approved dot-dash is preserved as a reviewable artifact. A storyboard, page list, set of action titles, or agent self-check does not replace owner approval. When production changes the thesis, chapter order, page sequence, action-title meaning, or evidence role, update and reapprove the complete dot-dash before changing the deck.

## Ghost-deck handoff

When visual review will expose sequencing or content gaps, create a low-fidelity ghost deck from the approved dot-dash and storyboard. Populate the proposed action titles, one-line evidence intent, rough exhibit placeholders, and source or data-status notes; leave detailed analysis and production styling unfinished.

Use the ghost only to test whether the story works, identify what content exists, expose what is missing, and assign the minimum work required to complete surviving pages. Changes discovered in the ghost must flow back into the hypothesis tree, dot-dash, and storyboard before production continues.

## Acceptance check

- The dots alone form a complete answer-first memo.
- Every planned slide has exactly one sequenced dot, every dot has at least one substantive dash, and the dot sequence reconciles to the planned page sequence.
- Every analytical dot maps to the hypothesis tree and advances the audience's understanding or decision.
- Every core dot names one approved chapter and one thesis role, and every chapter uses the exact tracker label.
- Every analytical dot contains page-specific evidence, exhibit or proof, and implication dashes; every dash supports or qualifies its parent dot and does not introduce a second primary claim.
- Provisional action titles state a decision-relevant conclusion or action and include a supported magnitude, comparison, period, segment, or threshold whenever it materially sharpens the claim.
- Evidence states and missing tests remain explicit.
- Core hypotheses have dots or declared dispositions, and lower-priority work remains visible without entering the core story by default.
- Chapter conclusions accumulate toward the governing thought and cannot be freely reordered without weakening the argument.
- The executive answer and closing decision preserve one thesis, with later conditions traceable to intervening evidence.
- The current complete outline has explicit owner approval, obtained through the runtime's interactive feedback capability when available, before any slide document is created.
