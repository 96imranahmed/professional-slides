# Quality Assurance

The first delivered deck should already have passed an internal create -> render
-> inspect -> revise loop. Source code, object-tree checks, and a successful file
export are necessary evidence, but they do not prove presentation quality.

## Release gates

All gates are required unless the user explicitly narrows the deliverable.

### 1. Brief gate

- audience, purpose, decision, governing thought, delivery mode, and output
  format are resolved;
- supplied references and reuse constraints are recorded;
- unresolved data gaps are labeled, not guessed.

### 2. Story gate

- the deck has a cumulative narrative arc;
- executive summary states answer, reasons, and action;
- every slide has one narrative job and one primary claim;
- action titles read as a coherent executive memo;
- every exhibit proves or explains its title;
- the close resolves the opening and makes the decision or next step clear;
- appendix material is separated without hiding essential evidence.

### 3. Evidence gate

- all non-trivial claims are verified or explicitly illustrative;
- numbers reconcile and match labels;
- units, periods, currencies, sample sizes, and actual/forecast states are clear;
- sources are traceable;
- calculations and transformations are documented;
- no invented facts, quotes, images, logos, people, or citations appear.

### 4. Design-system gate

- one theme governs typography, palette, spacing, shape language, charts,
  tables, and components;
- title, body, and footer anchors are consistent;
- dark/light variants belong to the same system;
- section trackers and page numbers match the real sequence;
- reference-template rules are preserved or deviations are documented;
- authoring grids, tutorial slides, template indexes, and sample branding are
  absent from the final deck.

### 5. Slide-level visual gate

Inspect every rendered slide at full size for:

- a clear first read and evidence hierarchy;
- no unintended overlap;
- no clipping or out-of-bounds objects;
- no accidental title wrapping;
- no orphan lines, widows, or broken bullets;
- readable charts, tables, labels, sources, and footnotes;
- consistent alignment and spacing;
- correct image crop and resolution;
- clean connectors with no line-through-label errors;
- no unresolved placeholders or production notes;
- sufficient contrast and non-color-only semantics.

Any overlap warning must be investigated. Fix unintended overlaps and record the
rare intentional overlap as an explicit design decision.

### 6. Deck-level visual gate

Inspect a montage/contact sheet for:

- visual rhythm and silhouette variety;
- consistent density across chapters;
- deliberate title/divider cadence;
- no repeated visual gimmick;
- no sudden theme, margin, or typography changes;
- balanced use of charts, tables, process pages, and synthesis;
- a minimal title slide and a decisive close.

### 7. Platform gate

For PowerPoint:

- PPTX opens and exports cleanly;
- masters and layouts remain intact;
- charts, tables, and text are editable;
- final package contains no empty inherited placeholders.

For Google Slides:

- the final link is a native deck;
- fonts, wraps, crops, chart semantics, and line weights were checked after
  import;
- notes and links were verified where supported.

For both formats, validate each independently. One format passing does not prove
the other.

### 8. Delivery gate

- final filenames are clear and versioned appropriately;
- only requested deliverables are handed off;
- the editable deck is included;
- limitations are concrete and concise;
- completion claims cite direct evidence from the latest final artifacts.

## QA ledger

Track defects during the internal loop with:

| Slide | Gate | Defect | Severity | Fix | Re-rendered | Status |
| --- | --- | --- | --- | --- | --- | --- |

Do not deliver with unresolved critical or major defects. A minor defect may
remain only when it is genuinely tool-limited, does not change meaning, and is
disclosed.

## Severity

- **Critical:** wrong conclusion/data, missing slide, corrupt file, unreadable
  content, misleading chart, or inaccessible final deliverable.
- **Major:** clipping, overlap, broken hierarchy, unsupported font reflow,
  inconsistent component, missing source, or material template deviation.
- **Minor:** small spacing, alignment, or polish issue that does not affect
  comprehension.

## Final proof

Keep the latest renders and the exact final file together during QA. Re-render
after every material change. Never base a completion claim on an earlier export
or a prepared upload form.

Record the result with the [evaluation rubric](rubric.md) and run the
per-deck gate described in [the evaluation flow](EVALS.md). This
self-review validates the deck; only the blind paired release suite evaluates
whether the skill itself improves outcomes.
