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
- `Navigation`: exact chapter labels and recommended tracker behavior, or an explicit `none` decision when navigation is not warranted;
- `Page composition`: only template-specific composition needs;
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

Then add a source-structure test for the template's distinct decision architecture and an evaluation case when the template is mature enough to claim support. Registration proves structural validity, not deck quality.
