# PowerPoint Hard Acceptance

Every PowerPoint candidate needs a machine-readable acceptance manifest and a deterministic check of the exact exported `.pptx`. The repository implementation is the `hard` subcommand of the single validation owner, `evals/scripts/validate_pptx.py`. It reads the ZIP/XML package and never changes the deck.

## Keep copy deliberately small

Treat these as ceilings, not targets:

| density | title words | counted words per slide | words per text shape | paragraphs per text shape |
| --- | ---: | ---: | ---: | ---: |
| `live-pitch` | 10 | 30 | 14 | 3 |
| `executive` | 12 | 55 | 20 | 4 |
| `pre-read` | 12 | 85 | 28 | 5 |
| `appendix` | 14 | 130 | 40 | 6 |

Draft to roughly half the relevant ceiling. Use a slide override only when a real evidence or provenance need requires it. Do not use an override to preserve avoidable prose. Source, footer, and page-number shapes may be excluded from word budgets by a declared shape-name pattern, but every visible string remains subject to forbidden-character checks.

## Acceptance manifest

Compile one JSON manifest from the approved deck contract, theme manifest, and treatment ledger before export. It has this shape:

```json
{
  "schemaVersion": 1,
  "deck": {
    "slideCount": 1,
    "slideSizeEmu": { "width": 12192000, "height": 6858000 },
    "titles": ["Margin recovery is credible"],
    "requireTheme": true,
    "requireSlideLayout": true,
    "requireSlideMaster": true
  },
  "copy": {
    "forbiddenCharacters": ["\u2014"],
    "maxTitleWords": 12,
    "maxWordsPerSlide": 55,
    "maxWordsPerTextShape": 20,
    "maxParagraphsPerTextShape": 4,
    "excludedShapeNamePatterns": ["(?i)^source", "(?i)^footer", "(?i)^page-number"],
    "slideOverrides": {}
  },
  "theme": {
    "allowedFonts": ["Arial"],
    "allowedColors": ["111111", "FFFFFF", "3D8DFF"],
    "allowedSchemeColors": ["dk1", "lt1", "tx1", "bg1", "accent1", "phClr"],
    "allowedFontSizesPt": [10, 12, 18, 32],
    "minimumFontSizePt": 10,
    "fontSizeTolerancePt": 0.05
  },
  "roles": [
    {
      "id": "action-title",
      "slides": [1],
      "shapeNamePattern": "^action-title$",
      "requiredCountPerSlide": 1,
      "fontFamilies": ["Arial"],
      "fontSizesPt": [32],
      "textColors": ["111111"],
      "bold": true,
      "geometryEmu": { "x": 609600, "y": 438150, "cx": 10972800, "cy": 723900 },
      "geometryToleranceEmu": 0,
      "consistentAcrossSlides": ["x", "y", "cx", "cy", "fontFamilies", "fontSizesPt", "textColors", "bold"]
    }
  ]
}
```

List every materialized font, six-digit RGB value, scheme-colour role, and font-size token used by slides, charts, layouts, masters, and themes. Do not declare a value after the validator discovers it. Fix the builder or theme when an undeclared value appears.

Use role rules for repeated semantic objects such as action titles, analytical headers, trackers, footers, page numbers, and recurring callouts. Select shapes through stable names or placeholder types. State exact values when the theme fixes them. Use `consistentAcrossSlides` when a role should inherit one construction across its declared range.

## Deterministic command

From this repository, run:

```bash
python3 evals/scripts/validate_pptx.py hard path/to/candidate.pptx \
  --manifest path/to/powerpoint-acceptance.json \
  --report path/to/powerpoint-acceptance-report.json
```

Use the bundled workspace Python when the host Python cannot load its XML parser. A zero exit status and `"accepted": true` are required. Preserve the report with the candidate hash.

## What the script rejects

The validator rejects:

- corrupt ZIPs, malformed XML, duplicate parts, missing content types, broken internal relationships, missing slide, layout, master, or theme links, and wrong slide size or count;
- a title that does not match the approved title exactly;
- copy beyond a declared ceiling or containing a forbidden character;
- undeclared fonts, colours, scheme-colour roles, font sizes, or below-floor text;
- missing, duplicated, restyled, moved, or inconsistently materialized role shapes.

This is the hard package and variable gate. It does not replace rendering, visual inspection, evidence reconciliation, or editability checks.

## Reject, repair, rerun

`rejected` is a blocking result. Repair the source builder, shared theme, component, content, or acceptance manifest only when the manifest was wrong. Never mutate PPTX XML to silence a finding. Export a new candidate, render it, and run the hard validator again. Repeat until the exact candidate is accepted. Only the accepted candidate hash may be delivered.
