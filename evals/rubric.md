# Deck Evaluation Rubric

Score each dimension from 1 to 5 using only observable evidence from the final
artifact, renders, readback, and supplied provenance. Use whole numbers for an
individual result. The runner converts the mean to a 100-point score.

## Scale

| Score | Meaning |
| --- | --- |
| 1 | Fails the brief or contains material defects; extensive rework required |
| 2 | Partially usable but has major gaps or inconsistent execution |
| 3 | Competent and usable with visible improvement opportunities |
| 4 | Executive-ready, coherent, and well executed with only minor issues |
| 5 | Exceptional: precise, persuasive, polished, and robust under inspection |

## Dimensions

### Brief fidelity

The output answers the requested question for the named audience, supports the
intended decision, follows requested scope and format, and does not introduce
unsupported content.

### Narrative logic

The governing thought is clear; chapters are logically complete; action titles
form a coherent memo; each slide has one job; and the close resolves the ask.

### Slide design

Hierarchy, density, composition, alignment, typography, spacing, contrast, and
deck rhythm support fast executive reading. There are no visible layout defects.

### Chart integrity

Chart selection matches the analytical question; values reconcile; scales,
units, states, and annotations are honest; and the visual proves the title.
If no chart is required, score whether the agent correctly avoided one.

### Platform correctness

The requested PowerPoint or native Google Slides deliverable exists, opens,
uses the appropriate authoring route, and matches its final renders. Dual-format
work is verified separately.

### Editability

Meaning-bearing text, charts, tables, and simple diagrams remain editable where
the platform supports them. Masters/layouts, grouping, and object structure
make reasonable future edits safe.

### Source integrity

Claims and data are traceable; sources, periods, units, and transformations are
clear; illustrative data is labeled; and no evidence or reference fidelity is
invented.

### QA evidence

The result includes current final renders, full-deck inspection, structural
checks, defect resolution, and completion claims that match direct evidence.

## Critical failures

Any treatment critical failure fails the release gate regardless of score:

- `corrupt_artifact`
- `missing_deliverable`
- `invented_evidence`
- `misleading_chart`
- `unreadable_render`
- `wrong_platform`
- `reference_fidelity_breach`

Apply a critical failure only when the issue is material. Describe its location
and impact in evidence; never use the flag as a substitute for scoring.
