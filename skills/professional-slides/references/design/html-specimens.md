# Structural HTML Specimens

Use a structural HTML specimen only when prose does not make a reusable component or page geometry clear. It is a spatial reference, not a browser deliverable or a second rule set. Follow the complete [component HTML and CSS contract](../theming/html-css-contract.md).

## Contract

- Keep it small.
- Use a 1280 × 720 or equivalent 16:9 canvas.
- Use semantic class names and named design tokens.
- Declare the example visual family and density on one `.deck` root.
- List every consumed component variable in a theme-contract table.
- Bind namespaced component variables to the canonical theme registry.
- Show editable text, shapes, and vectors.
- Do not embed a PNG, screenshot, base64 image, or external dependency.
- Demonstrate only the states needed to explain the geometry.

The owning Markdown file states the rule. A specimen may live beside it or in a focused supporting file when inline code would make the guidance harder to read.

## Use

Read the prose first. Translate the semantic regions into native PowerPoint or Google Slides objects. Follow the active deck grid and [resolved theme](../theming/index.md) rather than copying CSS measurements literally.

If the specimen conflicts with the prose or adds decoration, the prose wins and the specimen must be fixed or removed.
