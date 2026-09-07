# Dot-Dash

The dot-dash is the slide-by-slide story before design work begins.

## Definition

- **Dot:** the exact proposed audience-facing title of one slide.
- **Dash:** the evidence, exhibit, implication, source need, or open question that supports that title and makes the slide useful.

Represent every planned slide in production order with exactly one dot. The dot is not a separate summary, hidden planning label, or description of the slide's job: it is the underlying title that should appear on the authored slide. Every dot must contain at least one substantive dash.

For an analytical slide, use the complete proposed action title as the dot. It should state the supported conclusion or action, not merely name a topic. For a structural slide, use the exact visible heading, such as `Executive summary`, `Contents`, or `1 Financial context`. For a cover, use the exact proposed deck title. Format structural ordinals through the canonical [item-indicator owner](../components/item-indicators.md).

For explanatory pages, use the [storylining title rule](index.md#write-the-title-spine): a precise mechanism or distinction heading is valid when the page teaches rather than recommends.

## Ask questions that sharpen the argument

Before drafting the dot-dash, test whether the brief is specific enough to support a compelling argument for its intended audience. A broad topic is not an argument. When missing context could change the governing answer, evidence selection, priorities, or recommendation, ask the user targeted questions to narrow it down. This applies across topics; do not impose a domain-specific intake checklist.

Use the conversation and supplied brief first. Ask several questions together when several material uncertainties remain, then follow up selectively on answers that expose a decisive trade-off. Choose questions for their effect on the argument, not to fill a standard questionnaire. Useful lines of inquiry include:

- Who is this for, who makes the decision, and whose preferences matter? If it is for a client, establish the relevant client identity and context rather than assuming the user's preferences apply.
- What decision, change in belief, or action should the deck enable? What would a successful outcome look like?
- Which priorities, criteria, or trade-offs matter most, and which constraints are non-negotiable?
- What alternatives, current position, or baseline are under consideration? What is already known or believed?
- What time horizon, resources, or circumstances could change the answer?
- What is the strongest concern or counterargument, and what evidence would change the audience's mind?

Adapt the wording and selection to the actual brief. Do not ask again for known answers, invent preferences, assume a client shares the user's priorities, or steer the answers toward a preferred conclusion. If the brief is already sufficient, proceed without an unnecessary interview. For an explanatory deck, narrow the audience's knowledge gap and intended understanding rather than inventing a decision.

Summarize the resulting argument brief above the dot-dash: audience, intended outcome, decisive criteria, constraints, and unresolved questions. Distinguish user/client statements from author assumptions. Explain how the answers change the provisional thesis, the proof required, and what belongs outside the story. Merely recording the answers without changing a generic outline does not satisfy this step.

While waiting, continue research or design work that does not depend on the answer. Keep a material unknown explicit; do not finalize a personalized recommendation around an invented preference. If the user wants a general treatment or elects to proceed without further context, use transparent conditional arguments and record that scope.

Before presenting the plan, apply a specificity check: could the same title spine and recommendation be reused unchanged for a materially different audience or decision? If so, identify what is missing and ask a useful follow-up or revise the argument. The remedy is a sharper supported thesis, not superficial personalization or extra labels.

## Planning grammar

Present the approval artifact as a table by default, with one row per slide in production order. Use the host's table artifact when available; otherwise render and save a Markdown table. Do not replace the review table with a long numbered prose list unless the owner requests that format.

| Slide | Dot: exact proposed title | Dash: argument and evidence | Key insight | Linked data and sources | Design: layout, sections, and imagery |
| --- | --- | --- | --- | --- | --- |
| 1 | Exact proposed audience-facing title or structural heading | Decisive argument, evidence and source, implication or qualification, and any unresolved test | The decisive supported inference, stated explicitly | Direct links to the data rows, calculations, and primary sources used for this conclusion | Layout and reading order; ordered section/component types; arguments assigned to each section; material chart/table inputs; image subjects and crop intent |

Every analytical row must explicitly name its key insight and link the underlying data or specific source evidence. Link both the original source and the matched dataset or calculation when the conclusion is derived; a source list at the end is insufficient.

Keep complete reasoning in cells; use concise clauses or in-cell line breaks where supported. Include every structural and appendix page. Preserve section grouping through separate tables under the approved section headings when needed, retaining continuous slide numbering. State shared theme, density, and navigation choices once above the table and identify slide-specific exceptions in their rows.

The table is the review and approval surface, not a requirement to use tables in the finished deck. Revise affected rows in the same artifact so changes are easy to compare, retain its version or hash with owner confirmation, and pass that exact approved table plus the structured item/composition mapping into authoring. Do not require duplicate approval of a prose rendering or silently summarize away approved design inputs.

Do not add a separate `Slide title` field, make the owner infer a title from planning prose, or add filler dashes to create symmetry. A slide's communication job may be tracked separately in the storyboard or contract, but it does not replace or paraphrase the dot.

When the approved story is compiled into the pre-authoring contract, copy each dot verbatim into that slide record's `title`. When the deck is authored, use that approved title on the slide. Any title change updates the dot-dash and follows the authorization rule below.

## Standalone argument and evidence test

Include a fully written executive summary near the start of every full-deck plan, with its own dot and complete supporting dashes. Put its actual governing answer, decisive evidence, reasoning, and material qualification in the approval table; “summarise the findings” is not content.

Read the executive summary and dot-dash without slides or narration. Together they must resolve the main question unambiguously to the extent the evidence permits: every decisive branch has proof, the proof supports the inference, the strongest relevant countercase is addressed, and the resulting verdict or action follows. Unsupported certainty fails this test. Revise the claim or obtain missing evidence before approval.

For each analytical case, record the actual values or specific examples, source, population and period, comparator, inference limit, and the slide or slides that will present the proof. A conclusion table does not substitute for that proof. Use dedicated evidence slides when the trend, distribution, or relationship needs room; link their findings into the synthesis slide. Mark missing evidence as unresolved rather than filling space with unrelated statistics.

Match the evidence to the criterion. Revenue supports commercial reach, not audience satisfaction or storytelling quality. Where relevant, test independent measures such as audience ratings alongside revenue. For a ratings-versus-gross analysis, match film IDs and cohorts, record rating date, vote counts, exclusions and sample size, show the scatter and any reported correlation, and distinguish association from causation. These are illustrative measures: use topic-appropriate primary evidence, not a mandatory entertainment-data checklist. Narrow or reject a proposed relationship if the data does not support it.

### Mandatory chart-choice diagnosis

Before approving each analytical dot, inspect the actual available observations and calculate derived values. Its design cell must state: (1) the decision question, (2) data provenance and shape, including observed versus modeled versus mechanically extrapolated, (3) available periods and matched units/population, (4) the chosen encoding and why it exposes useful information, (5) the nearest alternative and why it is rejected, and (6) the new deduction in any secondary insight. Carry this record into `chartSelection` in the authoring contract. Missing diagnosis blocks the dot-dash, even if the proposed chart is registered and renders correctly.

Apply the [chart-selection table](../charts/index.md#select-from-the-available-evidence-before-dot-dash-approval). For example, a single annual housing-addition rate multiplied over five years provides an endpoint comparison, not evidence of changing momentum: plan common-period bars on the left and a calculated required-pace implication on the right. Put fixed-rate/fixed-population assumptions in the note, not an insight box. Reject that line-chart choice at planning time; do not postpone the decision to visual QA.

For every proposed graph, put both axes’ meanings and their source fields or calculations in the design cell. Apply the [meaningful-position gate](../charts/index.md#meaningful-position-gate) before approval; category bands with fabricated within-band coordinates fail.

Audit the planned exhibit mix. Keep tables for comparisons that benefit from rows and columns; use graphs to expose numerical patterns that prose cells conceal. Record the evidence-to-implication relationship and choose only one or two marked emphasis points under the arrow-restraint rule; compact grouping is sufficient elsewhere.

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

If the story, any proposed slide title, or a material slide design choice changes after approval, update the affected dots and design plans. An explicit user request to fix or replace that item authorizes the scoped change; do not ask the user to approve their own instruction again. Seek approval only for a material change outside the authorized scope.

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

## Component choice audit

In each slide's design cell, name the primary component and variant, then every secondary component and variant (or `none`). Give a content-specific reason for each. Consider other suitable variants; do not choose the first registered option by habit. Audit secondary halves and rails independently of the main exhibit. Explain recurring table/schema choices once for their comparison family. Apply the [main and secondary design audit](../design/index.md#main-and-secondary-design-audit) before showing the revised plan.


Summary theme-to-body mapping is semantic planning metadata. Do not put chapter references on the summary canvas to satisfy navigation checks. Develop the substantive argument and finish with a supported priority or conditional choice.


### Measurement choice precedes chart choice

Prefer the source's native units and compact direct values, with growth annotations where change matters. Use clearly labelled percentage changes when relative change is the question. Do not routinely rebase population, trips, counts or financial values to 100 merely to make unequal entities look similar. An index is justified only when its common-base trajectory answers a specific question that native units or percentage changes cannot express as clearly.

The design cell must name the measurement basis (`native`, `percentage-change`, `per-capita`, `rebased-index`, or `published-index`). For a rebased index, record `chartSelection.indexJustification`, `indexBase: {period, value}`, and `absoluteValueContext`. Explain the discarded native-unit or percentage-change alternative and the magnitude information normalization hides. The planner rejects a rebased index without this record. A source-published index remains its native measurement, but declare `published-index` so it cannot be confused with an invented rebase.

Also specify point labels, value-axis visibility and growth-annotation treatment before authoring. With fewer than six line-chart points, default to a value label on every dot and omit the left quantitative axis. If a quantitative axis is retained for a justified reading task, use the registered diagonal growth connector and circular badge (`style: arrow`); a bracket is valid when that axis is absent. Never remove the date/category axis merely because the value axis is omitted.
