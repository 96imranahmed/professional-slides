# Theming System

Read this directory whenever defining or applying a deck's visual theme. A
theme is a complete system of tokens, masters, layout behavior, chart styling,
and component states; it is not merely a color palette.

## Files

- [Design foundations](design-foundations.md): answer-first narrative,
  hierarchy, density, typography, layout, and exhibit fundamentals shared by
  every theme.
- [Template intake](template-intake.md): safe inspection and adaptation of
  user-authorized reference decks before deriving a theme.
- [Theme specification](theme-system.md): how to define, implement, and test a
  theme across PowerPoint and Google Slides.
- [Reference-derived patterns](reference-derived-patterns.md): reusable visual
  principles observed in the approved Slideworks and Umbrex source decks.
- [`theme-spec.schema.json`](theme-spec.schema.json): machine-readable contract
  for a theme profile.
- [`theme-spec.example.json`](theme-spec.example.json): a neutral consulting
  theme demonstrating that contract.
- [`source-manifest.json`](source-manifest.json): hashes and structural evidence
  for the approved reference files without redistributing them.

## Selection order

1. If the user provides a reference deck, derive the theme from that deck and
   preserve its master/layout system.
2. If the user provides brand guidance, translate it into the theme contract
   while maintaining consulting-grade hierarchy and contrast.
3. If neither exists, use a neutral theme based on the example specification.

Do not mix visual systems from multiple references slide by slide. When two
references are supplied, synthesize one explicit theme contract before
authoring and document which source informs each design dimension.
