---
name: professional-slides
description: Create or revise executive consulting decks in PowerPoint or Google Slides when the work requires answer-first storylining, evidence-led slide architecture, decision-quality charts, reference-template fidelity, and rendered QA.
---

# Professional Slides

Create decision-ready consulting presentations that are answer-first, logically complete, evidence-led, visually restrained, and precise. This skill is independent and is not affiliated with McKinsey & Company.

## Establish the brief

Resolve or infer:

1. audience and subject knowledge;
2. decision, belief, or action the deck must enable;
3. governing answer or exact question;
4. required evidence, source constraints, and data gaps;
5. delivery context: pre-read, live, workshop, or analytical pack;
6. output: PowerPoint, native Google Slides, or both.

Ask only for missing inputs that would materially change the result.

## Route only what the task needs

- Start with the [`src` guide](src/index.md). When the brief matches a named deck type, read the [template router](src/templates/index.md) and only the selected deck-type template before constructing the story.
- Always read [storylining](src/storylining/index.md), its [pre-authoring contract](src/storylining/pre-authoring-contract.md), and the single [design system](src/design/index.md). When an owner links a structural HTML specimen, read it as spatial grounding and translate its semantic regions into native editable slide objects rather than treating it as a browser artifact.
- Read the [slide-type router](src/slide-types/index.md) when storyboarding, then only the selected archetype file and, for multi-exhibit or decomposed-section pages, the shared [evidence-composition guide](src/slide-types/evidence-compositions.md).
- Read the [chart router](src/charts/index.md) for quantitative exhibits, then only the selected chart-family files.
- Read [components](src/components/index.md) for copy, text containers, section treatments, titles, trackers, navigation, dividers, footers, sources, appendix behavior, or brand slots; its index routes to the specialized component pages.
- Read the [PowerPoint tools](src/tools/powerpoint/index.md) or [Google Slides tools](src/tools/google-slides/index.md) only for requested target platforms.
- Read the [evaluation index](evals/index.md) before implementation and delivery for self-review, release QA, and skill-effectiveness testing.

Each concept has one owner: deck-type decision architecture in templates, narrative in storylining, composition and visual tokens in design, recurring furniture in components, slide jobs in slide types, quantitative encoding in charts, platform mechanics in tools, and release evidence in evals. Do not restate rules across boundaries.

## Build the deck

1. Classify the work as `new_deck` or `existing_deck_revision`, then select and instantiate one deck-type template if the brief matches one. Use its decision question, required branches, chapter logic, and tracker contract as a starting architecture rather than copying a canned page list.
2. For `new_deck`, follow the storylining workflow to construct the problem hypothesis tree, mapped slide-by-slide dot-dash, governing thought, narrative arc, action-title spine, and platform-neutral storyboard. Require one supported dot per planned slide and explicit owner approval of the complete dot-dash before creating any slide document. When the runtime supports interactive feedback gathering, use it to present the outline, iterate on requested changes, and obtain approval of the revised version. Freeze the root question, one-sentence governing thought, approved dot-dash, chapter sequence, and tracker page sequence before slide authoring begins.
3. For `existing_deck_revision`, inspect the complete source deck and create an as-is dot-dash that enumerates every existing slide exactly once before the first mutation. Do not force-add an executive summary, contents page, transition, or other new-deck structural state. When an executive summary is absent, recommend adding one and record the recommendation without implementing it unless the requested scope or explicit owner approval authorizes the structural change. Update and seek approval for a target dot-dash only when the revision changes the argument, slide order, page count, or structural architecture.
4. Compile the applicable dot-dash into the [pre-authoring deck contract](src/storylining/pre-authoring-contract.md) and run `python scripts/validate_deck_contract.py path/to/deck-contract.json`. For `new_deck`, preserve a successful validation from before slide-document creation; for `existing_deck_revision`, preserve one from before the first mutation. Do not begin production while the contract fails, and revalidate after any approved structural change.
5. Resolve the design system, freeze its semantic treatment registry, select one tracked or untracked analytical-header template with required tracker-label and action-title slots plus an exact visibility range, apply the copy guide's visible-label gate, and resolve recurring component states before mapping each storyboard page to one narrative archetype, one evidence composition, and any required chart family. Treat a visible role label on a callout, action surface, implication, recommendation, conclusion, decision, observation, or takeaway as a release defect when the sentence or placement already communicates that role; write the substantive message directly and retain only labels required to decode data, navigation, scenario state, or accountability. For a new deck, instantiate every early executive-synthesis or full-state tracker page required by the selected template and delivery mode. For an existing deck, diagnose missing structural states but do not add them outside the authorized revision scope.
6. Author the complete candidate through one supported adapter for each requested platform. Preserve approved template structures and authorized assets, and never invent facts or evidence. If the story changes during production, update and reapprove the hypothesis tree, dot-dash, chapter tracker, contract, and title spine before continuing.

## Verify and deliver

Before delivery, run the complete [per-deck self-review](evals/index.md#per-deck-self-review), including its cross-slide consistency pass and harsh anti-slop audit, against the exact final editable artifact. Audit every slide at full size and the complete montage, record two specific observations per slide, compare at least three candidate pages with recent relevant reference pages, and block release for any unresolved deletion-test, specificity, composition-fit, visual-finish, role-label, structure, asset-rendering, typography, spacing, exhibit, table, density, or component defect. The evaluation owner defines the result schema and remaining release evidence; do not create a parallel checklist here.

For dual-format delivery, validate PowerPoint and native Google Slides independently. Return the requested editable artifacts, identify the reference used, and disclose concrete unresolved limitations. Do not claim reference fidelity, platform parity, or effectiveness without direct final-artifact evidence.
