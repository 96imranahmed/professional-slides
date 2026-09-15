---
name: professional-slides
description: Create or revise PowerPoint and Google Slides with substantive arguments, evidence-rich readable pages, editable components, and bounded rendered QA. Use for new decks, structural revisions, and individual-slide edits.
---

# Professional Slides

Produce a substantive, decision-useful argument with readable evidence and clear hierarchy. Preserve complete reasoning and material qualifications. Density follows the reading task: analytical pre-reads should stand alone; a pitch may deliberately reveal less. Empty space, brevity, novelty and decorative variety are not quality objectives.

## Choose the task route

- **New deck or structural revision:** read [storylining](references/storylining/index.md), the [production workflow](references/tools/production.md), and [composition](references/composition/index.md). Use [templates](references/templates/index.md) only when a template or reference applies. Inspect an existing deck before structural revisions.
- **Bounded copy or visual revision:** inspect affected slides and the existing montage, preserve unrelated content, and load only the relevant component owner. Reuse verified unchanged renders; expand scope only for shared changes. Do not restart storyline approval for a local edit.
- **Runtime or skill development:** use [runtime guidance](runtime/README.md#content-planning) and [evaluation](references/evaluation/index.md). Complete the implementation batch before developer golden rendering. Ordinary deck production uses a tested release and does not modify shared runtime code.
- Load chart, table, theme, asset and platform owners only for selected components or an actual uncertainty. [Design](references/design/index.md), [copy](references/components/copy.md), [theming](references/theming/index.md), and [tools](references/tools/index.md) remain canonical owners.

## Plan the argument before geometry

Preserve the original user brief in `context.originalBrief`. A request for help deciding requires researched alternatives and a supported recommendation or decision boundary; do not substitute a checklist of research the author has not performed. Use [source evidence](references/storylining/source-evidence.md) to distinguish unperformed work from uncertainty remaining after research.

Gather a scoped evidence ledger with source, measure, period, geography/population, unit and uncertainty. Never invent evidence or imply comparability that the sources do not support. Match the title's commitment to the evidence and decision stage.

For each page, plan its question, answer, evidence, interpretation and material qualification. One coherent question may need several linked exhibits. Use the [composition recipes](references/composition/recipes.md) to choose relationships from the question, not the topic. Assess each thin page: merge with a related page, deepen using available evidence, or retain deliberate simplicity for a stated narrative purpose. Do not invent analysis or add filler to satisfy density.

For new/structurally revised decks, present one substantive design-aware dot-dash for owner approval: exact titles, evidence, component choices and layout relationships. Existing authorization remains valid; do not add calibration or storyboard approval gates. The approved plan is the authoritative specification consumed by the runtime; derived artifacts must not introduce new decisions.

## Compose readable, substantive pages

Use registered editable components and shared theme tokens. Keep comparable measures, encodings, scales, periods and recurring treatments consistent. Preserve exact approved titles, material caveats, source provenance and user-supplied assets.

Evaluate content by its contribution: evidence, explanation, comparison, qualification, synthesis, navigation or action. Useful interpretation can restate a finding to explain its importance. An insight may synthesize supported evidence; it need not introduce a novel deduction. Remove redundant transcription and unsupported conclusions. Supporting prose may be plain text linked to an actual exhibit; it does not require a visible heading or box.

Allocate body regions according to measured content. Use coordinated density profiles, content-sized supporting groups and readable body text. Word counts are diagnostics unless the user explicitly imposes a ceiling. Keep internal metadata and notes out of visible-copy counts. A sparse analytical page needs a missing-argument diagnosis, not a pixel quota; a dense page must still fit and remain readable.

Use conditional annotations: label changes directly when that communicates the relationship; add arrows/brackets only when they clarify a distinct comparison with exact anchors. Select variants deliberately and preserve useful consistency. Plan overview and section-transition trackers for substantial multi-section decks when navigation helps; honor explicit user preferences.

## Generate and verify

For net-new PowerPoint, use `runtime/generation.mjs` through the declarative command in [production](references/tools/production.md). `writeCanonicalDeckPlan()` owns planning, compilation, the PptxGenJS adapter and Artifact Tool observation/rendering. Keep the receipt and exact artifact hashes. Never create parallel raw slide builders or tune local literals to bypass a component defect.

Run deterministic preflight before model review. Inspect the exact editable artifact's renders and its full montage in one coordinated review stage. Check facts, readability, missing reasoning and consistency; consolidate findings by cause. Reuse unchanged slide review evidence and the same candidate renders. All slides must be covered before final acceptance.

The [rule registry](references/evaluation/rules.json) and [production workflow](references/tools/production.md) own severity and repair policy. Incorrect facts, misleading comparisons, missing evidence, unreadable content, broken geometry or provenance remain blockers. Editorial preferences are advisory. One initial review and one targeted repair pass are the default; additional passes require a specific unresolved material defect. Do not declare an unresolved defect accepted when the repair budget ends. Report the precise limitation.

Deliver the verified artifact with material limitations. Generation success alone is not editorial acceptance. For dual-format output, verify each final format. Performance and human-preference claims require measured evidence.


## Quality, diagnosis and release discipline

Quality requires a coherent argument, visible insights, useful visual relationships and deliberate pacing as well as accurate, readable output. Choose the relationship, then the exhibit, then supporting prose. “Make it longer” means deeper evidence, alternatives or counterarguments, not additional slices of existing content.

Diagnose argument, evidence, hierarchy, composition and implementation separately. More research does not repair hierarchy; font enlargement does not repair a fragmented story. Complete and certify runtime/skill changes before producing a deck with that release. Keep detailed mechanics in the focused owners linked above.
