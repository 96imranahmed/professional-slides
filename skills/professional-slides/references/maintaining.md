# Maintaining the skill

For work on the skill itself - its references, runtime and examples - rather than on a deck.

## Iterate the reusable skill

For a rejected candidate, find the earliest failed handoff in the [pipeline](../SKILL.md#pipeline). Missing proof returns to [Storylining](storylining.md); a weak encoding or a lost cue to [Design](design.md) or [Composition](composition.md); deterministic geometry or export errors to the shared runtime. Repair that owner and its example or check before rebuilding. A task-local exporter or a patch to the final output is not a reusable improvement.

Keep each rule at one owner and link to it. Use instructions and contrasting examples for judgment, and code for deterministic behaviour; a rule the author meets only by failing belongs in the catalogue (`author-deck.mjs --types`) or in a better message. Test a changed principle on another, materially different case and on its counterexample. Keep the candidate and report history: a rebuild invalidates its review, and the next one verifies the changed pages. Do not tell an independent reviewer the score to produce.

`author-deck.mjs <id>.pages.json --log` lists the findings that came back run after run. Each recurring finding names a limit the author could not see or a message that did not say what to do; fix it at the source - a published budget, a scaffold, a better repair message - rather than in the next deck.

## Evaluating the skill

Skill evaluations default to at least 50 rendered pages, cover and appendix included, unless the user sets that evaluation's length. Set `purpose: "evaluation"` on an evaluation deck; the build then refuses it under 50 pages. Choose a question with enough evidence breadth before drafting: fifty pages of repeated calculation is a weaker evaluation, not a compliant way to extend a small case, and the appendix counts toward the length. Short probes remain diagnostics. Ordinary decks follow the user's brief. [Evaluation](evaluation/index.md#forward-testing-the-skill) owns transfer testing.

When releasing a changed skill, package and install the source version, verify the source, package and installed hashes, and regenerate the evaluation through the installed runtime ([Production](tools/production.md#portable-evidence-and-release)). Keep technical checks, independent taste judgment and user acceptance separate.
