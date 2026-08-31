# Structural HTML Specimens

Structural HTML specimens translate the guide's spatial rules into a compact, inspectable reference. They are not browser deliverables, image previews, or a second policy layer. Markdown owns the decision logic and design rules; an accompanying specimen shows one valid arrangement of those rules so an authoring model can understand geometry, hierarchy, and state.

## Specimen contract

- Embed the smallest useful HTML and CSS directly in the owning Markdown file so the rule and its spatial example are read together.
- Use a fixed `1280 × 720` slide canvas or an equivalent `16:9` aspect ratio, semantic class names, CSS Grid or Flexbox, and custom properties for unresolved theme tokens.
- Represent text as realistic short phrases rather than lorem ipsum, but do not encode live facts, brand copy, or proprietary examples.
- Use `data-role`, `data-state`, or class names to expose semantic purpose such as `action-title`, `chart-field`, `tracker-item`, `active`, `muted`, `action-surface`, or `source`.
- Keep text, shapes, SVG marks, and component boundaries editable in concept. Do not embed a PNG, screenshot, base64 image, canvas bitmap, or generated preview in Markdown.
- Do not load external stylesheets, fonts, scripts, icon kits, or web services. When an icon is required, use a minimal inline SVG whose stroke behavior can be mapped to the selected icon library at implementation time.
- Bind all colours, typography, rules, and spacing to named custom properties. A specimen may show fallback values only inside one token block; component selectors must not invent slide-local literals.
- Show one semantic state per specimen unless the owner is explicitly demonstrating a state family such as inactive/active/completed tracker items or actual/forecast chart marks.
- Keep accessibility and export behavior visible: use text or symbols in addition to colour, maintain logical reading order, and avoid hover-only meaning.

## Authoring use

Read the owning prose first, then treat its HTML as one spatial implementation. Translate the semantic regions into native PowerPoint or Google Slides objects through the platform adapter. Preserve the approved deck grid and token registry rather than copying CSS measurements literally.

When the rendered slide reveals a conflict between the specimen and the prose, the prose wins and the specimen must be repaired before reuse. A specimen that adds an undeclared accent, extra label, callout, card, or action surface is a guide defect even when it looks polished.

## Coverage expectation

Provide a structural specimen for every tracker variant, every reusable component with more than one visual state, every chart family whose construction is not obvious from prose alone, and every slide archetype whose page geometry materially affects the result. A router may point to specimens in its child owners, but it must not duplicate their HTML.

## Acceptance check

The specimen uses one 16:9 canvas, resolves every visual property through the active token system, includes no raster preview or external dependency, contains no role forbidden by the prose, and can be translated into native editable slide objects without guessing the intended hierarchy.
