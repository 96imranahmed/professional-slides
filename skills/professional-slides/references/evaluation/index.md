# Evaluation

A deck is ready when the deterministic page gates pass, the review accepts it, and the exported file renders as intended. Keep generated decks, renders, plans and review reports in one task-owned `output/` directory.

## Page gates

Measured on the rendered page, before any model is consulted. Each is a blocking result.

| Gate | Threshold |
| --- | --- |
| Ink coverage | at least 18% of the content area |
| Trailing dead band | at most 8% |
| Action title | at most two lines, within 14 words |
| Body type | 10 to 14 pt |
| Characters per line | 45 to 90 |
| Body words, exhibit page | at most 100 |
| Hero exhibit, analytical page | at least 40% of the content area |
| Layout repetition | no layout on more than 40% of pages |
| Axis ticks | nice numbers |
| Geometry | every object inside its frame, no unintended overlap |
| Title spine | no hedge lexicon; no two titles sharing more than 60% of their tokens |
| Coverage | every ranked criterion has a comparative exhibit across all options |

## Review codes

The model review reads each rendered page together with its text, layout roles, mapped evidence and the deck question, and receives that page's gate measurements as inputs. It may block with these codes:

`FACTUAL_ERROR`, `UNSUPPORTED_CLAIM`, `MISLEADING_COMPARISON`, `MISSING_EVIDENCE`, `MISSING_ARGUMENT`, `UNREADABLE`, `OVERFLOW`, `BROKEN_GEOMETRY`, `PROVENANCE`, `BROKEN_DEPENDENCY`.

Every blocking finding names the exact defect and a repair that is a sentence a person can act on. Findings without one of these codes are advisory and settle within the bounded repair pass. `rules.json` holds the machine-readable rule IDs and severities.

## Review dimensions

**Story.** The deck answers the brief and has one governing thought. The title spine reads as an executive memo, or as a coherent explanatory progression. Each page has one job and one dominant exhibit, every decisive case maps to visible proof, and the close follows from the evidence. Missing data is explicit and counts as a gap rather than as completed analysis.

**Evidence.** Claims reconcile with their exhibits and sources; facts, estimates and inferences stay distinguishable; charts use the correct scale, units, labels and series; every plotted coordinate encodes a real measure, calculation or named category position; requested annotations appear in the render; focal marks separate from comparators in colour and in greyscale.

**Design.** The exported file and its full-size renders match the declared theme, colour ledger and treatment ledger. The composition fits the evidence and keeps one dominant exhibit, deck rhythm passes separately from style consistency, and labels sit beside the content they name.

**Platform.** The requested editable format opens, native objects stay editable, fonts, charts, tables, notes and sources survive export, and the output directory contains only the requested deliverables.

## Per-deck self-review

1. Render every slide.
2. Review the montage for story, rhythm and repetition.
3. Inspect every slide at full size.
4. Check titles, evidence, sources and uncertainty.
5. Check clipping, overlap, broken assets and unreadable text.
6. Apply the deletion test to every page.

## Comparing against a reference deck

Inspect every source page and every candidate render at full size, record the page mappings including deliberate consolidations and splits, and normalize type size against the source's visible crop. For each exhibit, identify the source's strongest analytical device and show how the candidate preserves or improves its function. Keeping every word and number does not pass when the reader must reconstruct a grouping the source made visible.
