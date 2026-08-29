# Slide Archetypes

Use these six archetypes as compositional systems, not rigid templates. Each is
compatible with PowerPoint and Google Slides and should be implemented with the
active theme's masters, typography, colors, spacing, and components.

Title, section-divider, agenda, and appendix-divider slides are described in
[components](components.md) because they organize the deck rather than prove a
business claim.

## Choose the archetype

| Narrative job | Primary archetype |
| --- | --- |
| State the whole answer and supporting logic | Executive synthesis |
| Explain causes, drivers, or issue structure | Decomposition |
| Prove a quantitative conclusion | Chart-led insight |
| Compare choices or alternatives | Comparison and options |
| Explain sequence, phases, or operating flow | Process and roadmap |
| Convert the answer into owners and action | Recommendation and action plan |

Do not select a layout because it looks varied. Select it because its reading
order matches the slide's reasoning.

## 1. Executive synthesis

### Use when

- opening an executive pre-read after the title;
- summarizing a recommendation and its reasons;
- closing an analytical section with a decision-oriented synthesis.

### Narrative contract

The audience should understand the answer, the two to four reasons it is true,
and the action or implication without reading the rest of the deck.

### Structure

- action title across the standard title zone;
- optional one-sentence governing thought directly below;
- two to four aligned rows or columns;
- each unit contains a claim, one proof point, and implication;
- a final decision or next-step statement at the bottom or right.

Use rows when the logic is sequential or causal. Use columns when the branches
are parallel. Keep unit widths equal unless one branch is explicitly dominant.

### Design details

- Give the claim the strongest text weight.
- Use one number, short phrase, or small evidence marker per unit.
- Use a thin rule or whitespace to separate units; avoid heavy cards.
- Apply the accent to the recommended action or most important proof, not every
  heading.
- If the page needs more than four units or a paragraph per unit, split it.

### Variants

- answer / evidence / implication rows;
- three-column recommendation logic;
- before / change / value synthesis;
- decision / rationale / risk / mitigation.

### Anti-patterns

- agenda masquerading as summary;
- copied titles from later slides without synthesis;
- equal emphasis on every sentence;
- dense prose with no evidence hierarchy.

## 2. Decomposition

### Use when

- breaking a problem into mutually exclusive drivers;
- showing an issue, hypothesis, value-driver, or capability tree;
- explaining root causes or a system's layers.

### Narrative contract

The audience should see how the whole breaks into parts, why the highlighted
branch matters, and whether the structure is exhaustive or intentionally
partial.

### Structure

- root question or outcome on the left or top;
- two to five first-level branches;
- no more than three visible levels in the main story;
- short labels on nodes, with evidence or annotations adjacent;
- highlighted path or branch tied to the action title.

Use left-to-right trees for causal or issue logic and top-down trees for
hierarchy. Use a matrix instead if two independent dimensions define the space.

### Design details

- Create connectors before nodes so lines remain behind shapes.
- Keep sibling nodes the same visual weight.
- Use one connector style and one direction of flow.
- Highlight the relevant path with the accent; mute unselected branches.
- Align nodes to the construction grid and maintain consistent depth spacing.
- Put detailed definitions in notes or appendix, not inside the nodes.

### Variants

- issue tree;
- hypothesis tree with status markers;
- value-driver tree with quantified contribution;
- capability stack or architecture layers;
- 2x2 or 3x3 matrix for dual-axis decomposition.

### Anti-patterns

- overlapping branches;
- decorative honeycombs without a true relationship;
- mixed causal, organizational, and chronological semantics;
- exhaustive taxonomies with unreadable labels.

## 3. Chart-led insight

### Use when

- a quantitative pattern is the strongest proof of the slide's claim;
- showing magnitude, trend, composition, variance, distribution, or
  relationship.

### Narrative contract

The audience should see the pattern quickly, understand the measure and scope,
and know why the pattern changes the decision.

### Structure

- action title;
- optional exhibit subtitle containing metric, unit, population, and period;
- chart occupying 60% to 85% of the body area;
- direct annotations on the decisive points;
- optional takeaway rail or implication box using the remaining width;
- source and methodology in the footer/notes.

### Design details

- Choose the chart using [charts](charts.md).
- Remove non-informative borders, gridlines, legends, and decimals.
- Direct-label the highlighted series where practical.
- Use neutral context and one accent for the evidence that proves the title.
- Align zero baselines and use honest scales.
- Clearly distinguish actual, forecast, target, and scenario states.
- Keep all labels readable at 100% zoom after cross-platform conversion.

### Variants

- full-width chart;
- two-thirds chart plus one-third takeaway rail;
- small-multiple charts with shared scales;
- chart plus supporting metric and calculation bridge.

### Anti-patterns

- a chart that merely repeats the title;
- dual-axis charts that imply a relationship without justification;
- many colors with no semantic meaning;
- chart screenshots when native editable charts are feasible.

## 4. Comparison and options

### Use when

- comparing alternatives, scenarios, vendors, segments, or operating models;
- making evaluation criteria and tradeoffs explicit;
- showing current versus future state.

### Narrative contract

The audience should understand the comparison basis, the material differences,
the recommended option, and the tradeoff or risk that remains.

### Structure

- action title;
- two to four option columns or rows;
- three to seven decision criteria;
- consistent evidence in each cell;
- explicit recommendation state;
- optional short rationale or sensitivity note.

Use a table when exact comparison matters. Use side-by-side narratives when
each option has qualitatively different logic. Use a 2x2 only when two
independent continuous dimensions genuinely drive the choice.

### Design details

- Keep option widths and criterion heights consistent.
- Use concise criteria labels and comparable grammar.
- Prefer subtle rules and whitespace over full cell boxing.
- Highlight the recommended option once, usually with an accent rule or header.
- Explain weights, scores, and thresholds in notes or an appendix.
- Show missing or non-comparable data explicitly; do not imply equivalence.

### Variants

- options matrix;
- current / future state;
- benchmark comparison;
- 2x2 prioritization matrix;
- scenario comparison with shared metrics.

### Anti-patterns

- criteria chosen after the preferred answer;
- arbitrary traffic lights with no thresholds;
- every cell filled with long prose;
- visual recommendation unsupported by the underlying score.

## 5. Process and roadmap

### Use when

- explaining phases, workstreams, handoffs, milestones, or an operating flow;
- showing how a recommendation will be implemented;
- sequencing decisions over time.

### Narrative contract

The audience should understand the order, dependencies, ownership, milestones,
and what changes between stages.

### Structure

- action title;
- horizontal flow for time or sequence, vertical flow for governance or
  swimlanes;
- three to six phases in the main story;
- each phase contains objective, key activities, output, and owner as needed;
- milestones or decision gates aligned to the time axis;
- explicit now/next/later or actual/plan state.

### Design details

- Use real spacing proportional to time only when dates are meaningful; label
  schematic timelines as such.
- Keep arrows and connectors behind nodes and labels.
- Use the accent for the current phase, critical path, or decision gate.
- Avoid chevrons when they add no information beyond a numbered list.
- Separate workstreams into aligned lanes and keep milestone semantics
  consistent.
- Put detailed task lists in appendix workplans.

### Variants

- phased roadmap;
- Gantt or high-level workplan;
- swimlane process;
- operating cadence;
- waves by geography, function, or product;
- customer or employee journey.

### Anti-patterns

- false precision in dates or effort;
- crossing connectors;
- five different milestone symbols;
- process art with no owners or outputs.

## 6. Recommendation and action plan

### Use when

- concluding a decision deck;
- translating analysis into initiatives, owners, timing, value, and risk;
- requesting approval or commitment.

### Narrative contract

The audience should know exactly what is recommended, why now, who owns each
action, when it happens, what value it creates, and what decision is required.

### Structure

- action title stating the recommendation or decision;
- three to five initiatives or actions;
- owner, timing, impact, and first milestone for each;
- dependencies and risks only when they alter sequencing or approval;
- explicit decision ask or next meeting at the bottom/right.

### Design details

- Order actions by sequence or value, not alphabetically.
- Keep the decision ask visually distinct but integrated with the composition.
- Use tables for precise owner/timing information and a roadmap for temporal
  relationships.
- Quantify impact ranges and confidence where available.
- Use status colors only with defined semantics and accessible labels.
- Keep accountability names or roles editable and easy to update.

### Variants

- recommendation with rationale and risk;
- 30/60/90-day action plan;
- initiative portfolio with value and effort;
- governance and decision-rights page;
- pilot charter with scope, metrics, and exit criteria.

### Anti-patterns

- generic "next steps" with no owner or date;
- recommendations not supported by the deck;
- inflated benefit numbers without method;
- closing on a detail rather than the decision.

## Archetype adaptation rules

- Preserve the narrative contract even when adapting to a source layout.
- If the source layout cannot hold the evidence legibly, choose another source
  slide or split the content; do not layer a parallel design over it.
- For Google Slides, avoid custom geometry or masks that do not survive import.
- For PowerPoint, keep recurring structures in layouts and editable objects.
- Vary silhouettes across adjacent slides, but keep title, margins, source, and
  section behavior consistent.

