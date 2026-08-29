# Process and Roadmap

## Use when

The claim depends on sequence, phases, workstreams, handoffs, milestones, or an
operating flow.

Use an action plan when named accountability and near-term commitments are the
main message. Use decomposition when the relationship is hierarchical rather
than temporal.

## Narrative contract

The audience should understand order, dependencies, ownership, milestones,
and what changes between stages.

## Content contract

- action title stating the implementation insight;
- three to six phases in the main story;
- objective, activities, output, and owner where decision-relevant;
- explicit milestones, gates, or handoffs;
- actual/plan or now/next/later state;
- dates and durations only at their supported precision.

## Layout

Use horizontal flow for time and sequence. Use vertical lanes for governance,
ownership, or parallel workstreams. Align gates to the time axis and keep a
single direction of travel.

If distances encode duration, make them proportional and label the scale. If
the flow is schematic, say so. Put task-level workplans in the appendix.

## Visual rules

- Create connectors before nodes so lines remain behind content.
- Use one milestone vocabulary and one connector style.
- Accent the current phase, critical path, or decision gate.
- Keep lane heights and phase boundaries aligned.
- Avoid chevrons unless the shape conveys real progression.
- Label dependencies at their connection point, not in a detached legend.

## Variants

- phased roadmap;
- high-level Gantt;
- swimlane process;
- operating cadence;
- rollout waves by geography, function, or product;
- customer or employee journey.

## Platform implementation

Use grouped editable primitives, stable object identifiers, and theme-derived
spacing. Avoid SmartArt or custom geometry that cannot be inspected or that
degrades on Google Slides import. After export, verify connector routing,
grouping, and the position of every milestone against the time axis.

## Failure modes

- false precision in dates, effort, or dependencies;
- crossing connectors;
- inconsistent milestone symbols;
- process art with no outputs or ownership;
- equal-width phases presented as a scaled timeline;
- detailed task lists shrinking the whole slide.

## Acceptance test

Trace the flow without reading body copy. The order, current state, material
handoffs, and final outcome should remain clear.
