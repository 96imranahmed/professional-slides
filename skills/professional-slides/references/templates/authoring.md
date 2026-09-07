# Template Authoring Contract

Use this contract to add a deck type without duplicating the rest of the skill.

## Admission rule

Add a template only when a recurring audience decision needs a distinct decision architecture. A sector, brand, visual theme, or one-off outline is not a template. Extend an existing template when its root decision and analytical branches still fit.

## Required file structure

Create one kebab-case Markdown file with these sections:

- `Mandate`: audience, decision, and conditions for using the template;
- `Decision question`: one root question the governing thought must answer;
- `Thesis and scope`: default hypothesis branches and explicit boundaries;
- `Story structure`: chapter spine and sequencing logic, without fixed page counts;
- `Analytical jobs`: evidence obligations routed to registered component, chart, and composition owners;
- `Evidence`: source, uncertainty, cutoff, and missing-data rules;
- `Navigation`: default chapter-label seeds and recommended tracker behavior, or an explicit `none` decision when navigation is not warranted. State how the seeds may be merged, renamed, or omitted under the [`instantiation contract`](index.md#instantiation-contract);
- `Page composition`: only template-specific needs, with direct links to the canonical composition, chart, component and design owners instead of restating their rules;
- `Failure checks`: ways the template can create a misleading or incomplete deck;
- `Acceptance check`: observable completeness tests.

Link to `../storylining/pre-authoring-contract.md` and `../composition/index.md`. Templates must not redefine shared storylining, composition, components, charts, design tokens, platform mechanics, or evaluation rules.

## Registry entry

Add exactly one entry to [`registry.json`](registry.json) with a unique `id`, matching `file`, `stable` or `experimental` status, a decision sentence, audience labels, and useful aliases. Every template Markdown file except `index.md` and this contract must be registered.

~~~json
{
  "id": "example-deck",
  "file": "example-deck.md",
  "status": "experimental",
  "primaryDecision": "Whether the audience should take the stated action.",
  "audiences": ["decision maker"],
  "aliases": ["example"]
}
~~~

## Validation

Run:

~~~bash
python evals/scripts/validate_template_registry.py
~~~

Add the architecture assertion to `evals/tests/test_source_structure.py`: verify the file is registered, every required section is present, and one template-specific decision-architecture invariant holds. Run it with `python -m unittest discover -s evals/tests -p 'test_source_structure.py'`. Add an evaluation case when the template is mature enough to claim support. Registration proves structural validity, not deck quality.
