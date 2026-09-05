# Dot-Dash

The dot-dash is the slide-by-slide story before design work begins.

## Definition

- **Dot:** the exact proposed audience-facing title of one slide.
- **Dash:** the evidence, exhibit, implication, source need, or open question that supports that title and makes the slide useful.

Represent every planned slide in production order with exactly one dot. The dot is not a separate summary, hidden planning label, or description of the slide's job: it is the underlying title that should appear on the authored slide. Every dot must contain at least one substantive dash.

For an analytical slide, use the complete proposed action title as the dot. It should state the supported conclusion or action, not merely name a topic. For a structural slide, use the exact visible heading, such as `Executive summary`, `Contents`, or `1 Financial context`. For a cover, use the exact proposed deck title. Format structural ordinals through the canonical [item-indicator owner](../components/item-indicators.md).

## Planning grammar

Write the review artifact as Markdown in this form:

1. **Dot:** Exact proposed audience-facing slide title or structural heading
   - **Dash:** decisive evidence or content.
   - **Dash:** exhibit form and source.
   - **Dash:** implication, condition, navigation state, or open test.

Do not add a separate `Slide title` field, make the owner infer a title from planning prose, or add filler dashes to create symmetry. A slide's communication job may be tracked separately in the storyboard or contract, but it does not replace or paraphrase the dot.

When the approved story is compiled into the pre-authoring contract, copy each dot verbatim into that slide record's `title`. When the deck is authored, use that approved title on the slide. Any title change is a dot-dash change and follows the approval rule below.

## Review artifact structure

Present the plan in this order:

1. decision setup;
2. explained hypothesis logic, with a rendered decision map when useful;
3. tracker and section map, including none when no visible tracker is needed;
4. complete dot-dash grouped by section;
5. coverage of hypothesis branches and template jobs.

Do not present a flat slide list when section logic matters.

Include every structural page explicitly: cover, visibly labelled executive synthesis when required, contents, every repeated tracker state, close, and authored appendix page.

## Keep navigation parallel to the story

When a visible hierarchical tracker is justified, assign one parent tracker ID to each dot-dash section and one chapter tracker ID to each analytical subgroup. Record the applicable IDs on every dot. The parent order, chapter order, labels, and slide ranges must match the section map exactly. Do not invent tracker labels during authoring.

## Existing decks

First write an as-is dot-dash with one dot for every current slide. Each dot records that slide's exact current title or structural heading. Record a missing recommended structure, but recommend one and do not insert it without authorization.

When the user approves a structural change, write the target dot-dash and revalidate the contract.

## Approval gate

For a net-new deck or any target-story or structural change, use the available feedback mechanism to gather feedback. Retain dated owner confirmation linked to the exact approved dot-dash version or hash in the pre-authoring contract's `approvalEvidence` field. Revise until approved, and do not create a slide document, ghost deck, or production file before that record exists. A faithful authorized revision to an existing deck may proceed from the as-is dot-dash without new approval when titles, order, and structure remain unchanged; any change to those fields returns to this approval gate.

If the story or any proposed slide title changes after approval, update the affected dots and obtain approval again.

## Check

- Every planned slide has one dot containing the exact proposed visible title or heading and at least one real dash.
- Analytical dots are supported action titles; structural dots are exact visible headings.
- The sequence answers the main question.
- The hypothesis branches map to the story.
- The dots form a coherent title spine when read alone.
- Navigation pages are explicit and necessary.
- Every contract title and authored slide title remains verbatim-traceable to its approved dot.
- The plan is approved and traceable to the final deck.

## Grounded worked example

This compact teaching example adapts public figures from [SlideScience's dot-dash guide](https://slidescience.co/storytelling-in-powerpoint/). [Working With McKinsey](https://workingwithmckinsey.blogspot.com/2013/07/McKinsey-storyline-dot-dash.html) also describes dots as storyline statements and dashes as their support. The figures demonstrate grammar only; they are not a current view of Australia Post.

### Decision setup

- Communication job: decide whether further cost reduction can restore profitability.
- Governing answer: productivity improved near its stated limits, so management must quantify revenue options before approving the recovery plan.
- Tracker decision: use the canonical compact-number-strip on governed analytical slides 3 to 5 because the plan has three named sections and consecutive evidence pages; omit it from the cover, executive summary, and close.

### Section map

| Section | Slides | Purpose |
| --- | --- | --- |
| Answer | 1 to 2 | Frame the decision and answer. |
| Evidence | 3 to 5 | Establish the gap and test cost headroom. |
| Action | 6 | Set the next decision gate. |

### Complete dot-dash

1. **Dot:** Postal operator profitability recovery
   - **Dash:** Cover with audience and reporting period.

2. **Dot:** Executive summary
   - **Dash:** Further cost action is unlikely to close the gap alone; quantify revenue options before approving the plan.

3. **Dot:** Costs grew materially faster than revenue, moving annual profit into loss between 2015 and 2022
   - **Dash:** Compare published annual revenue growth of 5% with cost growth of 9%.
   - **Dash:** Show the published movement from positive 10 billion to negative 13 billion in annual profit or loss.

4. **Dot:** Workforce reduction lifted output per employee close to the stated operating ceiling
   - **Dash:** Show workforce falling from 26,000 to 22,000 between 2019 and 2022.
   - **Dash:** Show mail per employee rising from 265,000 to 325,000 against a stated 330,000 ceiling.

5. **Dot:** Processing and delivery unit costs improved beyond the cited industry benchmarks
    - **Dash:** Compare processing cost per piece falling from 0.70 to 0.63.
    - **Dash:** Compare delivery cost per piece falling from 0.34 to 0.29.

6. **Dot:** Quantify revenue options before approving the recovery plan
   - **Dash:** Require contribution, feasibility, service impact, timing, owner, and downside case.
   - **Dash:** Pause if the options do not reconcile to the residual gap.

### Parallelism check

- Each slide has one dot and substantive support.
- The title spine moves from answer to evidence to action.
- The section map matches the dot-dash sequence.
- The explicit compact-number-strip decision matches the short story.
