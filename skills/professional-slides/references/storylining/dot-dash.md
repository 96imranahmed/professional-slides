# Dot-Dash

The dot-dash is the slide-by-slide story before design work begins.

## Definition

- **Dot:** the exact proposed audience-facing title of one slide.
- **Dash:** the evidence, exhibit, implication, source need, or open question that supports that title and makes the slide useful.

Represent every planned slide in production order with exactly one dot. The dot is not a separate summary, hidden planning label, or description of the slide's job: it is the underlying title that should appear on the authored slide. Every dot must contain at least one substantive dash.

For an analytical slide, use the complete proposed action title as the dot. It should state the supported conclusion or action, not merely name a topic. For a structural slide, use the exact visible heading, such as `Executive summary`, `Contents`, or `1 Financial context`. For a cover, use the exact proposed deck title. Format structural ordinals through the canonical [item-indicator owner](../components/item-indicators.md).

For explanatory pages, use the [storylining title rule](index.md#write-the-title-spine): a precise mechanism or distinction heading is valid when the page teaches rather than recommends.

## Planning grammar

Present the approval artifact as a table by default, with one row per slide in production order. Use the host's table artifact when available; otherwise render and save a Markdown table. Do not replace the review table with a long numbered prose list unless the owner requests that format.

| Slide | Dot: exact proposed title | Dash: argument and evidence | Key insight | Linked data and sources | Design: layout, sections, and imagery |
| --- | --- | --- | --- | --- | --- |
| 1 | Exact proposed audience-facing title or structural heading | Decisive argument, evidence and source, implication or qualification, and any unresolved test | The decisive supported inference, stated explicitly | Direct links to the data rows, calculations, and primary sources used for this conclusion | Layout and reading order; ordered section/component types; arguments assigned to each section; material chart/table inputs; image subjects and crop intent |

Every analytical row must explicitly name its key insight and link the underlying data or specific source evidence. Link both the original source and the matched dataset or calculation when the conclusion is derived; a source list at the end is insufficient.

Keep complete reasoning in cells; use concise clauses or in-cell line breaks where supported. Include every structural and appendix page. Preserve section grouping through separate tables under the approved section headings when needed, retaining continuous slide numbering. State shared theme, density, and navigation choices once above the table and identify slide-specific exceptions in their rows.

The table is the review and approval surface, not a requirement to use tables in the finished deck. Revise affected rows in the same artifact so changes are easy to compare, retain its version or hash with owner confirmation, and pass that exact approved table plus the structured item/composition mapping into authoring. Do not require duplicate approval of a prose rendering or silently summarize away approved design inputs.

Do not add a separate `Slide title` field, make the owner infer a title from planning prose, or add filler dashes to create symmetry. A slide's communication job may be tracked separately in the storyboard or contract, but it does not replace or paraphrase the dot.

When the approved story is compiled into the pre-authoring contract, copy each dot verbatim into that slide record's `title`. When the deck is authored, use that approved title on the slide. Any title change is a dot-dash change and follows the approval rule below.

## Standalone argument and evidence test

Include a fully written executive summary near the start of every full-deck plan, with its own dot and complete supporting dashes. Put its actual governing answer, decisive evidence, reasoning, and material qualification in the approval table; “summarise the findings” is not content.

Read the executive summary and dot-dash without slides or narration. Together they must resolve the main question unambiguously to the extent the evidence permits: every decisive branch has proof, the proof supports the inference, the strongest relevant countercase is addressed, and the resulting verdict or action follows. Unsupported certainty fails this test. Revise the claim or obtain missing evidence before approval.

For each analytical case, record the actual values or specific examples, source, population and period, comparator, inference limit, and the slide or slides that will present the proof. A conclusion table does not substitute for that proof. Use dedicated evidence slides when the trend, distribution, or relationship needs room; link their findings into the synthesis slide. Mark missing evidence as unresolved rather than filling space with unrelated statistics.

Match the evidence to the criterion. Revenue supports commercial reach, not audience satisfaction or storytelling quality. Where relevant, test independent measures such as audience ratings alongside revenue. For a ratings-versus-gross analysis, match film IDs and cohorts, record rating date, vote counts, exclusions and sample size, show the scatter and any reported correlation, and distinguish association from causation. IMDb is an optional source, not a mandatory metric for every deck. Narrow or reject a proposed relationship if the data does not support it.

Audit the planned exhibit mix. Keep tables for comparisons that benefit from rows and columns; use graphs to expose numerical patterns that prose cells conceal. Record the evidence-to-implication arrow in the design plan wherever that relationship is shown.

## Slide design plan

Include a design plan with every dot, including structural slides. The owner reviews the argument and its visual expression together before authoring. Use plain language in the review artifact and retain stable item IDs and registered component names in the handoff. Read the relevant composition, design, component, and chart owners before proposing these choices.

For each slide, specify:

- **Layout and reading order:** the dominant exhibit, arrangement of sections, relative emphasis or proportions when material, and how the reader moves through the evidence. Use the open composition model rather than inventing a fixed page taxonomy.
- **Sections and types:** each ordered section's substantive heading when used, semantic job, and registered component type or variant, such as a chart, comparison table, developed bullet list, image, or the single optional insight box. Structural slides may have one title or navigation item and no analytical sections.
- **Arguments and evidence:** the claim each section develops, the evidence or source gap it carries, and how it supports or qualifies the dot. State relationships such as comparison, sequence, or inference; do not repeat the slide title as section content.
- **Material inputs:** chart categories, series, units, comparison basis and annotation targets; table columns and row logic; image subject, source and crop intent; or other component arguments that affect meaning. Specify theme and density inheritance and any justified variant exception. Exact coordinates and token-resolved sizes remain implementation details unless the owner supplied them.

Keep the plan proportional to the slide. Do not add empty sections, decorative treatments, or speculative data to fill this list. Mark unresolved evidence or component support explicitly and resolve any gap that could change the argument or composition before approval.

For example, a comparison slide may specify: “Two peer sections with equal emphasis, read left to right. Left: `chart.column` with directly labelled adoption rates by segment, arguing that demand concentrates in two segments. Right: a typed comparison table with segment, delivery constraint, and evidence columns, testing whether capacity can serve that demand. Both sections use underlined headings. Sources and caveats attach to the relevant items. No detached insight box.” The actual plan must supply the relevant values or identify their source gap, rather than reuse this illustrative wording as content.

### Validate before approval and carry into authoring

Before presenting the dot-dash, check that each section earns its place, its evidence supports its argument, the reading order supports the dot, and the selected components can express the required content. Apply the [claim-to-proof check](../components/copy.md#claim-to-proof-check): record actual supporting values or specific examples, the comparator, and the limit of the inference. Reject title-only arguments and generic image captions before asking for approval. State whether each slide uses no imagery, icons, or evidence-bearing images and why; specify how annotations, labels, and any supporting section connect to the evidence. Check likely capacity at the inherited body size, peer title and comparison consistency, and insight-box cardinality. This is an early design review, not a claim of rendered fit or final visual acceptance.

After approval, include the exact reviewed dot-dash and its per-slide design plans in the authoring model's input. Map each section to stable `items` with jobs, registered components, content props and peer relationships, then serialize the reviewed arrangement into the existing composition/planner inputs. Do not give the model only the title and supporting prose and ask it to rediscover the design. If `auto` is used, retain the approved arrangement constraints and verify the resolved composition satisfies them. Preserve a traceable mapping in the pre-authoring contract, not a second competing layout schema.

Changes to an approved argument, section type, reading order, or material visual encoding require an updated design plan and owner approval under the existing approval rule. Routine text-fit and token-based geometry adjustments within the approved design do not. If rendering exposes a material design problem, return to the affected plan rather than silently substituting a new composition.

## Review artifact structure

Present the plan in this order:

1. communication setup and audience objective;
2. explained hypothesis logic or concept dependencies, with a map when useful and within the requested output scope;
3. tracker and section map, including none when no visible tracker is needed;
4. complete dot-dash with per-slide design plans grouped by section;
5. coverage of the problem branches or concepts and any selected template jobs.

Do not present a flat slide list when section logic matters.

Include every structural page explicitly: cover, mandatory visibly labelled executive summary, contents, every repeated tracker state, close, and authored appendix page.

## Keep navigation parallel to the story

When a visible hierarchical tracker is justified, assign one parent tracker ID to each dot-dash section and one chapter tracker ID to each analytical subgroup. Record the applicable IDs on every dot. The parent order, chapter order, labels, and slide ranges must match the section map exactly. Do not invent tracker labels during authoring.

## Existing decks

First write an as-is dot-dash with one dot for every current slide. Each dot records that slide's exact current title or structural heading. Record a missing recommended structure, but recommend one and do not insert it without authorization.

When the user approves a structural change, write the target dot-dash and revalidate the contract.

## Approval gate

For a net-new deck or any target-story or structural change, use the available feedback mechanism to gather feedback. Retain dated owner confirmation linked to the exact approved dot-dash version or hash in the pre-authoring contract's `approvalEvidence` field. Revise until approved, and do not create a slide document, ghost deck, or production file before that record exists. A faithful authorized revision to an existing deck may proceed from the as-is dot-dash without new approval when titles, order, and structure remain unchanged; any change to those fields returns to this approval gate.

If the story, any proposed slide title, or a material slide design choice changes after approval, update the affected dots and design plans and obtain approval again.

Explicit standing auto-approval satisfies the approval gate within its stated scope. Record that user instruction, its date, and each approved plan version or hash; do not fabricate a separate user review or repeatedly request confirmation. Approval does not waive evidence or quality checks.

Keep literal user requirements separate from author interpretations and implementation choices in briefs, addenda and review packets. Auto-approval authorizes the scoped work; it does not turn an analyst-selected threshold, assumption or design application into a user-specified requirement. Label superseded author choices as history, not current constraints.

## Check

- Every planned slide has one dot containing the exact proposed visible title or heading, at least one real dash, and a reviewed slide design plan.
- Analytical dots are supported action titles; structural dots are exact visible headings.
- The sequence answers the main question.
- The problem branches or concept dependencies map to the story.
- The dots form a coherent title spine when read alone.
- Navigation pages are explicit and necessary.
- Every contract title and authored slide title remains verbatim-traceable to its approved dot.
- The plan is approved and traceable to the final deck.

## Grounded worked example

The expanded list below explains the grammar; present its slide records as the table above for owner approval. This compact teaching example adapts public figures from [SlideScience's dot-dash guide](https://slidescience.co/storytelling-in-powerpoint/). [Working With McKinsey](https://workingwithmckinsey.blogspot.com/2013/07/McKinsey-storyline-dot-dash.html) also describes dots as storyline statements and dashes as their support. The figures demonstrate grammar only; they are not a current view of Australia Post.

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
   - **Design:** Minimal cover with the deck title and a short audience/period identity line; no analytical sections.

2. **Dot:** Executive summary
   - **Dash:** Further cost action is unlikely to close the gap alone; quantify revenue options before approving the plan.
   - **Design:** Executive synthesis with ordered developed bullet-list sections for the financial gap, productivity limits, and revenue decision. Map evidence from slides 3 to 5 to those arguments and close with one overall action.

3. **Dot:** Costs grew materially faster than revenue, moving annual profit into loss between 2015 and 2022
   - **Dash:** Compare published annual revenue growth of 5% with cost growth of 9%.
   - **Dash:** Show the published movement from positive 10 billion to negative 13 billion in annual profit or loss.
   - **Design:** Two peer column charts with matched underlined headings, one comparing revenue and cost growth in percent, the other comparing profit/loss endpoints in billions. Keep units separate and use direct labels; the paired comparisons establish the widening financial gap.

4. **Dot:** Workforce reduction lifted output per employee close to the stated operating ceiling
   - **Dash:** Show workforce falling from 26,000 to 22,000 between 2019 and 2022.
   - **Dash:** Show mail per employee rising from 265,000 to 325,000 against a stated 330,000 ceiling.
   - **Design:** One comparison table ordered by 2019, 2022, and stated ceiling, with workforce and productivity in separate labelled columns. Mark unavailable ceiling workforce data explicitly. The ceiling comparison tests remaining productivity headroom.

5. **Dot:** Processing and delivery unit costs improved beyond the cited industry benchmarks
    - **Dash:** Compare processing cost per piece falling from 0.70 to 0.63.
    - **Dash:** Compare delivery cost per piece falling from 0.34 to 0.29.
    - **Design:** One comparison table with processing and delivery rows and baseline, current, and benchmark columns. Preserve the source units and benchmark provenance; unresolved benchmark values must be supplied before approval. The comparison tests whether further unit-cost reductions are credible.

6. **Dot:** Quantify revenue options before approving the recovery plan
   - **Dash:** Require contribution, feasibility, service impact, timing, owner, and downside case.
   - **Dash:** Pause if the options do not reconcile to the residual gap.
   - **Design:** One developed bullet list grouped by option economics, feasibility, and approval condition. Assign the required evidence to each group and keep the residual-gap condition visible; no unsupported numerical ranking.

### Parallelism check

- Each slide has one dot and substantive support.
- The title spine moves from answer to evidence to action.
- The section map matches the dot-dash sequence.
- The explicit compact-number-strip decision matches the short story.
