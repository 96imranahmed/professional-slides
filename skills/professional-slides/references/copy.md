# Copy

Every sentence on a page adds a claim, evidence, interpretation, decision, action, source or necessary navigation. Write the exhibit first, then the title, then whatever interpretation is still missing.

## Action titles

Prefer readable numerals and precise nouns to long spelled-out quantities. The title should foreground the decision-relevant result; a calculation method belongs there only when explaining the method is the page's job.

State the answer, not the topic: `[subject] [verb of change or state] [magnitude or comparator]`, in 12 words at most (`TITLE_WORDS`, refused at compile) and two lines at most (`TITLE_LINES`), about 10 as the norm, so it sets on one line. This is the one statement of the title limit; other references cite the gate. The period, population and scope go in the `subtitle` ([the standfirst](page-types.md#the-standfirst)). Use the most decision-relevant supported comparison, magnitude, segment or threshold. Match the verb to the evidence: measured exposure supports *is exposed*, a sensitivity supports *could reach*, an approved minute supports *will proceed*.

The title leads with the finding. When the evidence is thinner than the wording, narrow the claim - a segment, a period, a measure, a softer verb - and keep its direction; the limitation goes in the subtitle or a note, never in place of the finding. A title that says what the evidence lacks, cannot settle or leaves undisclosed is a gap, not an answer ([Answer under uncertainty](storylining.md#answer-under-uncertainty)); more than 15% of them is refused (`TITLE_GAP_SHARE`). A count with no comparator ("The fleet is 116 aircraft") says how many, not against what; it is advised (`TITLE_COUNT_ONLY`).

| Instead of | Write |
| --- | --- |
| Financial performance, 2015-2022 | Costs grew 9% a year against revenue's 5%, turning profit into loss by 2022 |
| Workforce and productivity | Workforce fell from 26,000 to 22,000 while mail per employee neared the 330,000 ceiling |
| The 45-minute limit looks plausible for some central-office journeys | Transit rides use only 15-28 of the 45 minutes; walking and waiting decide which locations qualify |
| Four neighborhoods offer distinct combinations of schools and everyday activity | All six locations clear the school screen; commute and rent cut the list to two |
| Enterprise depth remains unproven | Firm A leads large accounts, 500 to 320; retention is not yet published |

Hedges mark a finding that has not been written yet: *looks plausible, some, may, offers, distinct combinations, requires verification, potentially, a range of, various, considerations*. Replace each with the measured fact.

Structural pages use their fixed heading. An executive summary may use `Executive summary`, an evidence-supported answer title, or `Executive summary: <answer>`. An explanatory page may name the mechanism or distinction when a takeaway would overstate it.

## Executive summary

A synthesis explains its scoped answer to the depth the communication job needs.

1. Develop the distinct claims and decisive evidence that support the answer, with the material limitations and the conditions that would change the decision. One developed statement may carry a branch while another needs three.
2. Choose the composition from the relationship: developed points (`summary` form `executive-summary`), label and body rows (`parallel` form `labelled-rows`), parallel domains, an ordered situation-outlook-action sequence, or an exhibit that carries the synthesis itself.
3. Integrate the recommendation or condition where it belongs in the argument, preserving the alternatives and the criterion that changes their preference.
4. Read the summary alone: can the reader explain the governing answer, the supporting case and the material countercase?

Write it dense: four to six developed statements, each a claim with its evidence, its qualification and what follows, in 204 body words at most - the text page's upper quartile, which `WORDS` holds the summary to. The first statements carry the situation, the complication and the question it raises; the rest answer it, one per pillar. Three one-line bullets and a takeaway band is a table of contents for the argument, not the argument. Use a point's `points` for the parts it lists (the options compared, the criteria, the conditions). A closing band is optional; the last statement can carry the consequence.

A summary runs to a second page only when the content needs it - a request with several questions, each with its own lean and reversal trigger - and each page is held to the same ceiling. Answer every sub-question of the request here with its lean and confidence ([Answer under uncertainty](storylining.md#answer-under-uncertainty)).

Summary theme headings state substantive conclusions - "Career and industry", not "Chapter 1".

## Body copy

Develop enough text for the reader to understand the evidence, reasoning, material qualifications and decision consequence without narration. Do not impose a universal word ceiling: a decision pre-read often needs developed paragraphs or lead-and-body rows alongside its exhibit. Short labels and an action title cannot substitute for an explanation of why the result matters or when it holds. Compare substantive text coverage with strong reference pages serving the same reading task. Fit the composition to necessary copy at readable type, then remove redundancy; do not abbreviate away the reasoning to preserve an oversized visual or whitespace.

The title and exhibit may complete a simple page's argument without a separate closing sentence. Add a consequence only when it advances that argument, and keep qualifications beside the claims they limit. Text volume is not a quota: definitions, repeated headlines and generic advice do not make a thin argument more complete.

Use plain words, short sentences and explicit uncertainty, in complete sentences with the connective words the reasoning needs.

Translate technical terms that can suggest a different ordinary meaning. Network subset capacity checks are not customer demand cuts; model states are not observed outcomes. Name the relevant entity in the visible wording. Column headings name their field concisely; avoid sentence-length headings that repeat the exhibit's purpose, while preserving qualifiers needed to interpret the values.

| Instead of | Write |
| --- | --- |
| Further work may be required | Public evidence does not show retention |
| Hold. Wait for cash recovery. | We recommend holding the position until cash generation improves. |
| Simplify accelerated training | Make accelerated training easier to adopt |
| $8-12M annual potential over 18-24 months | $8-12M annually; 18-24 months to implement |

Keep neighbouring bullets parallel in meaning and grammar. Keep planning language - *slide job*, *exhibit logic*, *so what*, *hypothesis*, *decision relevance* - out of the rendered page.

Separate a value's measurement period from its implementation timing, and keep annual, one-off, gross and net outcomes explicit. An option row preserves the action, the outcome with its basis, the timing and the enabling condition: `Consolidate supplier contracts; $6-9M annual potential; 12-18 months to implement; subject to service-level testing`.

Numbers belong on marks. Replace a sentence that transcribes the chart with labelled endpoints and a title that carries the consequence.

### How much prose in one run

Word count is not shape. A deck can clear its text-coverage score with one block of 150 to 200 words per page and still read as an essay with pictures.

The skill's targets for an analytic page (the numbers live in `runtime/weight.json`):

| | Typical well-made page | Write to |
| --- | --- | --- |
| Text blocks per page | median 4 (quartiles 2 and 5) | two or three, more when the evidence has that many findings |
| Words per block | median 56 (quartiles 41 and 86) | 41-86, the band `TEXT_FRAGMENTED` holds the prose pages' median to; a chart's heading and label rows count as blocks, as they did on the reference pages |
| Longest block on a page | median 128, third quartile 152 | never past 152 |
| Pages with a single block | about one in seven | rare, and only when one finding is the whole page |

`TEXT_BLOCK_TOO_LONG` fails a dot-dash whose longest planned run passes 152 words, and the same plan is checked again on the composed scene, so the shape cannot be lost between stages.

The repair is not a shorter sentence. It is two or three points that each make their own claim: split the run at the place where it stops proving one thing and starts proving the next, and give the second half its own lead. A page whose commentary is one block is asserting that its evidence supports exactly one finding, which is sometimes true and usually not.

The opposite failure is the fragment: a bold lead and one sentence of twenty words, three to a column, each restating a value the exhibit already prints. It clears the word floor by adding points rather than developing them.

Commentary is two or three developed points of about 41 to 86 words each. A developed point has three parts: the finding (with the number the reader should see first - an unmarked point is marked on its own figure), the mechanism or basis behind it (the sample it rests on, what drives it), and what the reader should do about it. Two developed points beat three fragments. The band is a gate: a deck whose prose pages run a median words-per-block outside it is refused (`TEXT_FRAGMENTED`), and the review's density pass judges the pages the density profile flags ([Taste review](taste-review.md#density-pass)). How this relates to the page's word floor and ceiling is in [Word measures](evaluation/index.md#word-measures). A takeaway band is a separate rule: one or two lines (`TAKEAWAY_LONG`, refused at compile).

## Where each kind of sentence goes

| Job | What to write | Where it belongs |
| --- | --- | --- |
| Evidence | A sourced fact, value, observation, example or client requirement, with its scope | The primary exhibit, or a grouped evidence section |
| Interpretation | A supported consequence, dependency, trade-off or constraint beyond those premises | Place each distinct insight in the title, an anchored annotation or commentary beside its evidence; avoid repeating the same proposition across them |
| Action | What the audience should decide or do, why the evidence supports it, and the condition that limits it | The decision page or the close |
| Qualification | The minimum wording needed to decode a measure or avoid an overclaim | Beside the affected value, with derivations in notes |

Read the whole page in order and remove duplicate propositions. A new sourced fact earns its place without a deduction attached; adding *therefore* to a fact does not make it an insight. Reject commentary that would survive replacing the subject and the numbers: "growth remains strong, but risks remain" adds no decision logic.

A page may need no separate insight, one, or two complementary insights. Let the evidence decide. A callout and a closing `soWhat` should not become stacked summary boxes by habit. Keep both only when each contributes distinct reasoning and their placement helps the reader; otherwise merge, relocate or remove the extra message. For example, a sensitivity page can retain the downside-income observation while its rent recommendation belongs on the action page.

## Labels and hierarchy

Separate a bold lead from its body with a colon, full stop or a deliberate new line. A color/weight change alone must not join two clauses into a broken sentence.

Keep a label when it helps the audience decode data, navigation, timing, ownership, units or scenario state. Rhetorical role labels - *Answer*, *Key takeaway*, *What it means* - are replaced by the substantive heading or the sentence itself, and a parent heading adds information beyond its children. Every label visibly belongs to its content through proximity, alignment, a table field or a shared container. Use inline named examples when the name and explanation are one thought: **Pilot programme:** a controlled rollout tests demand before full deployment. Place interpretation beside the evidence it explains, emphasize the decision-changing phrase rather than whole paragraphs, and keep the decisive insight visible without a complete read of the body.

## Notes and methodology

Keep the analytical argument on the slide and put routine arithmetic, familiar metric definitions and full derivations in speaker notes or a requested methodology appendix. When explaining a calculation or method *is* the communication job, that material is the exhibit and belongs on the page. Use one methodology footnote per page at source size for the qualification that would otherwise repeat beside every number - an assumed tax rate, a forecast state, an excluded asset class. For a pre-read, test the page without narration: speaker notes cannot supply reasoning the reader needs.

## Punctuation and voice

Watch dot separators. A bullet or middle dot joining two labels - `1972 • First annual report`, `Investor pulse · Q4` - spreads through every eyebrow, footer and caption until the deck reads as a menu. Well-made decks do use it, so this is a matter of restraint rather than a rule: write the qualifier in brackets, after a comma, on its own eyebrow line or as a column, and separate sources with a semicolon.

Audience-facing copy uses commas, full stops, parentheses and clear connectors in place of em dashes; a sourced quotation containing one is replaced by another exact excerpt or an attributed paraphrase. Use the punctuation a clear list, qualification or notation needs, and rewrite a sentence that collects colons, semicolons and parenthetical asides. Watch for repeated *not just X, but Y* constructions, false contrasts, rhetorical questions and unsupported superlatives such as *transformative*.

## Decision close

Match the close to the stage established at intake:

- **Diagnosis or option selection** - state the finding and which options merit the next defined test, with the evidence and enabling conditions. Potential savings stay potential; uncosted ideas stay uncosted.
- **Authorization** - recommend the supported choice, its scope, resources and owner, with the strongest countercase and the condition that changes the decision.
- **Explanation** - synthesize what the audience can now understand or apply, and the material limits.

Separate what the audience decides now from later approvals, combine duplicate commitments, and keep the authority boundary and the decisive caveat visible. If the authorization already makes the vote concrete, join its final return instruction and recording requirements there instead of adding a second prose resolution. Keep exact trigger identities in the keyed register when they serve lookup. Instructions to the reader belong here, on the action page, rather than as captions on evidence pages.

## Copy QA

1. Check every sentence against the relevance rule above.
2. Check that each title is supported by its exhibit, verb for verb.
3. Apply [heading ownership](design.md#one-heading-owner-per-exhibit): every title, subtitle and exhibit heading adds unique information.
4. Re-read each page with its title and any detached conclusion hidden: the exhibit still carries the argument.
5. Read insight and recommendation copy aloud; complete sentences sound natural rather than clipped or padded.
6. Scan the final artifact for em dashes and repeat until there are none.

## Consistency after a revision

A corrected sentence is not a corrected argument. Search every title, commentary,
callout, comparison, summary and closing recommendation for the same assertion.
Remove stale absolute language such as “only”, “every” and “never” unless the
stated population establishes it. Selected examples support scoped observations;
a correlation does not prove a mechanism. A judgement label does not excuse
mismatched media, unequal populations or unsupported certainty.

Use one concise scope statement near the evidence, then explain what the evidence
does establish. Do not replace overclaiming with several repeated caveats. Delete
recap pages that add no new proof or decision; update cross-references afterwards.
