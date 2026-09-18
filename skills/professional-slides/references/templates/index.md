# Deck-type templates

A template gives a recurring audience decision its decision architecture: the governing question, the default branches, the chapter spine and the evidence each chapter owes. It seeds a hypothesis tree and a dot-dash; the story, the titles, the layouts and the visual system come from the rest of the skill. `registry.json` is the machine-readable catalogue.

## Select by the primary decision

- [`commercial-due-diligence.md`](commercial-due-diligence.md) - a buyer, seller, investor or lender testing market attractiveness, customer quality, competitive position, commercial performance and plan credibility.
- [`startup-pitch-deck.md`](startup-pitch-deck.md) - investors deciding whether to fund a startup and engage in the next stage.
- [`project-progress-update.md`](project-progress-update.md) - a sponsor, steering committee, board or public authority deciding whether a programme remains on track and what intervention is required.

When no template matches the brief, write the storyline directly. When two seem to apply, choose the one matching the audience's primary decision and treat the other as a bounded supporting workstream.

## Instantiate it

Before layout, resolve the actual audience and decision, the root question, a one-sentence governing thought, branch-specific evidence states, the exact chapter labels, the chapter-to-page mapping and the closing decision. Carry that architecture into the storyboard, the source ledger and the dot-dash.

Template branches and chapter labels are seeds. Merge, split, rename or omit them before approval when the brief and the evidence justify it and the resulting structure stays MECE. Once the tracker map is approved, every occurrence uses those exact labels.

Keep a coverage ledger: each core job is retained, merged, omitted with a reason, or unresolved. A shorter deck may merge related jobs while keeping every test visible in the hypothesis tree or the section structure, so a merge stays a merge rather than a quiet omission.

For an existing deck, inventory the current architecture slide for slide before editing, and treat template gaps as recommendations until a structural rebuild is authorized.

## Specimen copy

Reusable specimens use neutral prompts - `(Insert action title)`, `(Insert section title)`, `(Insert chart title)`, `(Insert supporting point)` - rather than client, industry or company claims as default copy. Each advertised specimen carries a short speaker note with three fields: `Use when`, `Why`, and `Action title`, explaining the decision context, the analytical reason the form fits, and the kind of conclusion its title should state. Covers, dividers and tracker pages state the navigation title that applies instead.

## Adding a template

Add one when a recurring audience decision needs its own decision architecture; extend an existing template when its root decision and branches still fit. A new file carries: `Mandate`, `Decision question`, `Thesis and scope`, `Story structure`, `Analytical jobs`, `Evidence`, `Navigation`, `Failure checks` and `Acceptance check`. Register it in `registry.json` with a unique `id`, matching `file`, `stable` or `experimental` status, a decision sentence, audience labels and useful aliases.

## Acceptance check

- the template matches the audience's primary decision;
- the governing thought answers the root question and names its material conditions;
- every retained branch has evidence, an explicit unresolved test, or a declared disposition;
- chapter labels are frozen before tracker implementation, and every core page maps to one chapter;
- the chapter order accumulates toward the decision;
- the synthesis and the close express one thesis at different evidence levels;
- deviations improve the fit to the actual brief and leave no decision branch uncovered.
