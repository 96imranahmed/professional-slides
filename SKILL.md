---
name: professional-slides
description: Create or revise executive consulting decks in PowerPoint or Google Slides when the work requires answer-first storylining, evidence-led slide architecture, reusable slide archetypes, decision-quality charts, consistent cross-deck components, reference-template fidelity, and rendered QA.
---

# Professional Slides

Create decision-ready consulting presentations with the clarity and craft often
described as "McKinsey-style": answer-first, logically complete, evidence-led,
visually restrained, and precise. This skill is independent and is not
affiliated with McKinsey & Company.

## Establish the brief

Before authoring, resolve or infer these six inputs:

1. Audience and their level of subject knowledge.
2. The decision, belief, or action the deck must enable.
3. The single governing answer or question.
4. Required evidence, source constraints, and unresolved data gaps.
5. Delivery context: pre-read, live presentation, workshop, or appendix-heavy
   analytical pack.
6. Output target: PowerPoint, native Google Slides, or both.

Ask only for missing inputs that would materially change the result. Do not
block on cosmetic preferences; derive them from an approved reference deck or
use the defaults in [design foundations](src/theming/design-foundations.md).

Write the communication job before storyboarding:

> By the end, **[audience]** should **[decide / understand / approve / do]**
> because **[governing answer]**.

## Route the work

- Read the [skill pack overview](src/overview/index.md) when changing
  the package structure or deciding where new guidance belongs.
- Always read [design foundations](src/theming/design-foundations.md).
- Always read the [theming system](src/theming/index.md) before defining
  or changing colors, typography, masters, or visual tone.
- Read the [slide-type router](src/slide-types/index.md) when
  storyboarding, then read only the selected slide type's file.
- Read the [chart router](src/charts/index.md) for any quantitative
  exhibit, then read only the selected chart family's file.
- Read [components](src/components/index.md) when setting the theme, master,
  navigation, sources, footers, or section behavior.
- If a PPTX, PDF, screenshot set, or native deck is supplied as a visual
  reference, read [template intake](src/theming/template-intake.md) before
  planning. Treat the supplied reference as authoritative within the user's
  reuse rights.
- Read the [PowerPoint integration](tools/powerpoint/index.md) for PPTX
  creation, editing, API selection, or rendering.
- Read the [Google Slides integration](tools/google-slides/index.md) for
  native Google Slides, import, API selection, or rendering.
- Read [quality assurance](evals/quality-assurance.md) before implementation
  and again before delivery.
- Use the [self-evaluation flow](evals/EVALS.md) for per-deck self-review. Run
  the blind control-versus-skill evaluation suite before publishing material
  changes to this skill.

## Build an answer-first storyline

1. Form a governing thought that answers the deck's central question.
2. Decompose it into mutually exclusive, collectively sufficient supporting
   claims. Use three to five chapters unless the content genuinely requires a
   different shape.
3. Sequence claims so each slide creates the need for the next: context ->
   evidence -> implication -> decision, or another arc suited to the brief.
4. Give each slide one narrative job, one primary claim, and one dominant
   exhibit. Put supporting detail in notes or the appendix.
5. Read all action titles in order. They must form a coherent executive summary
   without requiring the body of the slides.
6. Remove slides that repeat a point, show analysis without an implication, or
   do not change the audience's understanding or decision.

Use a horizontal storyboard before layout work. Design the evidence and page
silhouette only after the slide's claim is stable.

## Create a deck blueprint

Express the plan as structured data before authoring. Start with
[`examples/deck-blueprint.example.json`](examples/deck-blueprint.example.json)
and validate it with:

```bash
python scripts/validate_blueprint.py path/to/deck-blueprint.json
```

For each slide, record:

- narrative role and action title;
- one primary claim;
- selected archetype and dominant exhibit;
- evidence and source state;
- implication or audience takeaway;
- any reference slide being reused;
- speaker-note and appendix requirements.

The blueprint is a design contract, not audience-facing content. Do not expose
its production notes on the slides.

## Author the deck

- Use a 16:9 canvas unless the user or source template requires otherwise.
- Preserve editable text, charts, tables, and simple diagrams whenever the
  target platform supports them.
- Use the approved theme, master, and layouts; do not simulate recurring chrome
  with copied slide-local shapes.
- Keep one dominant visual hierarchy. Avoid dashboard-like card collections,
  decorative badges, ornamental icons, and repeated labels that do not improve
  comprehension.
- Prefer a chart, table, or direct visual comparison to explanatory prose when
  evidence can carry the point more clearly.
- Shorten copy or change the layout before shrinking type.
- Never invent facts, quotes, people, benchmarks, sources, or calculation
  results. Clearly mark genuine unknowns in the working artifact and resolve or
  remove them before delivery.
- Put source citations in a consistent slide-level source area and retain fuller
  provenance in speaker notes when the toolchain supports it.

## Apply the one-shot quality loop

"One shot" means the first delivered artifact has already passed an internal
iteration loop:

1. Generate the complete deck from the validated blueprint.
2. Render every slide at presentation size.
3. Inspect every slide individually and the deck as a montage.
4. Fix content, hierarchy, alignment, overflow, chart semantics, source, and
   platform-conversion defects.
5. Re-render affected slides and repeat until all release gates in
   [quality assurance](evals/quality-assurance.md) pass.

Do not claim visual quality from source code or object-tree inspection alone.
The final rendered artifact is the evidence.

## Deliver

Return the requested editable deck, not only previews or PDFs. For dual-format
delivery, validate PowerPoint and native Google Slides separately because
import can change fonts, wrapping, crops, line weights, and chart behavior.
Briefly state what was created, the formats delivered, which reference template
was used, and any unresolved content limitations. Do not claim reference
fidelity or platform parity without direct comparison of the final renders.
