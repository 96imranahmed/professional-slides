# Trackers and Navigation

A tracker answers: where are we in the deck? It is never an executive summary, scorecard, progress report, risk view, or status dashboard.

## When to omit it

Default to no visible tracker for decks with no more than two named sections or fewer than three governed analytical slides. Never place a tracker on the executive-summary slide. Use a compact tracker when the deck has at least three named sections and any section contains at least two consecutive governed analytical slides. Use a full tracker page for a governing-question change introducing at least three analytical slides.

## Choose one full state and, if needed, one compact state

Use one system. Full and compact states share the same label map: IDs, order, and active state remain exact. `compact-label` displays the active labels; `compact-number-strip` may omit labels visually but retains their underlying IDs and order.

The native standard pairs `sequential-circles` full states with `compact-number-strip` analytical states. Use `split-contents` or `compact-label` only when hierarchy or recognition requires them. Never improvise a tracker.

| Construction | Use when |
| --- | --- |
| `sequential-circles` full state | Default for three to six short peer sections. Center the rail vertically. |
| `split-contents` full state | Parent title left; three to eleven items right. A longer list is a density state. Use circular numbers unless the source requires otherwise. |
| `compact-label` analytical state | Parent and active-child labels above the action title. |
| `compact-number-strip` analytical state | Stable section numbers in one quiet strip. |
| `numbered-section-break` transition state | Full-canvas pause with title left and large number right. |
| `hierarchical-segmented` system | Pair `split-contents` as the full parent-and-child state, `compact-label` as the governed analytical state, and `numbered-section-break` as the parent transition. Use the same parent and child IDs in every state. |

See the [structural specimens](specimens.md).

## Contents progress pages

A contents overview may have no selection. A progress page marks exactly one item with circle or row emphasis.

When planned, show the full tracker at every major section change. Never introduce one isolated late-section page.

On `split-contents`, the left field contains the section title only: no subtitle, kicker, or body. The right backdrop fills the slide height through the outer right edge. Vertically center the complete contents list; never top-anchor a short list.

For a hierarchy, keep the parent left and only its children right. Allow hierarchical numbers such as `8.1` through `8.8`.

Selection needs a non-colour cue. Preserve peer inset, baseline, marker size, and rule thickness. Do not imply completion.

Give split-content rows equal padding. Its optical list width is normally around three quarters of the right field, with generous space after short labels. The backdrop fills height to the right edge.

## Parent and chapter hierarchy

A hierarchical tracker has two levels:

- The **parent tracker** names deck chapters and appears in full on contents and transitions.
- The **chapter tracker** names one parent's analytical subgroups and selects one per governed page.

Match the dot-dash: parent IDs equal section IDs; chapter-item IDs equal analytical subgroup IDs; labels, order, and ranges remain exact. Cover, executive summary, and close are untracked. See the [example](../../storylining/dot-dash.md#grounded-worked-example).

Use `hierarchical-segmented` only when both levels help. Apply the construction selected in the router above and the linked [structural specimens](specimens.md).

## Analytical-page placement

Place compact trackers above the action title. `compact-label` keeps parent and child semantically separate within one tight inline cluster. Prefer one editable text box with inline runs. If styles require separate objects, size them to rendered content and use one small theme gap around the separator. Never use distant anchors, stretch the cluster across the title, or leave label-dependent gaps. `compact-number-strip` uses stable numbers. Selection never changes baseline or rule thickness.

Do not repeat the contents construction on analytical pages.

## Tracker contract

Define once:

- stable item IDs, labels, order, and slide ranges;
- the complete item set shown on every full tracker page, including each approved number and label;
- one selected item per tracked progress, transition, or analytical page;
- one full construction and, if needed, one compact construction;
- one selected-state grammar shared by every occurrence;
- clear visibility rules for cover, contents, transition, analytical, close, and appendix pages.

For `hierarchical-segmented`, define parent and chapter IDs on every governed slide. A label-bearing variant cannot appear intermittently. Never append the page topic.

## Visual rules

Use one accent plus neutrals. Do not use chart-series colours, RAG colours, or per-item colours.

Bias numbered tracker markers to circles. Squares require an explicit source exception.

Apply the canonical [item-indicator ordinal format](../item-indicators.md) to tracker markers. Preserve approved hierarchical or source-required identifiers.

Keep number treatment, label hierarchy, and selection grammar consistent.

## Check

- The tracker communicates navigation only.
- It is absent when it adds no orientation value.
- The rendered deck matches the IDs, labels, order, selected states, ranges, constructions, and visibility rules declared in the tracker contract.
- Every approved major section change contains its planned tracker page; the montage has no isolated late-section tracker.
- Split contents pages use a title-only left field, circular number markers, a full-height right-hand backdrop through the right edge, and a vertically centered contents list.
- Displayed ordinal markers and numbered section headings pass the [item-indicator ordinal check](../item-indicators.md).
- Every compact-label breadcrumb reads as one tight inline phrase; the separator never floats in a fixed remote column.
- Structural edits update tracker ranges, page numbers, and cross-references.
- The montage shows no stale, skipped, duplicated, or intermittently missing state.
