# Tools

This directory owns platform implementation and rendering mechanics. It does
not redefine storylining, slide archetypes, charts, components, or theming.

## Choose the route

- Read [`powerpoint/`](powerpoint/index.md) for editable PPTX authoring,
  PowerPoint-specific APIs, adapter selection, and saved-file rendering.
- Read [`google-slides/`](google-slides/index.md) for native Google Slides
  authoring, import/export, Slides API operations, and native rendering.
- For dual-format delivery, build and verify each final platform independently
  and keep a parity ledger for conversion-sensitive differences.

Use one authoring adapter for each candidate artifact. Object-tree inspection
supports debugging, but final quality claims require renders from the exact
editable artifact being delivered.
