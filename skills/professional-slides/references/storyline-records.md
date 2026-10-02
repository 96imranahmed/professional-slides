# Storyline records

The records the runtime keeps for a deck, and the contract each meets. A deck authored as [page types](page-types.md#the-pages-file-is-the-dot-dash) writes none of these by hand: `author-deck.mjs` derives the content plan and the plan file from `<id>.pages.json` and runs their gates in the same pass. This page is the reference for what those derived files hold, for reading a gate's finding, and for a deck built outside the pages file.

## Planning contract

This section owns what a deck must carry to be built; other references link here.

| Deck | Must carry |
| --- | --- |
| New (`workflow: "new_deck"`) | the user's `request` verbatim (`REQUEST_MISSING`); `<id>.content.json`, `<id>.plan.json` and `<id>.deck.json` together, from one full `author-deck.mjs` compile (`STAGE_MISSING`, `STAGE_CONTRACT`); a unique stable ID on every slide, with the same exact title in all three; an opening summary declaring `role: "executive-summary"` before the first section (`NO_SUMMARY`), whose content [Copy](copy.md#executive-summary) owns |
| Rebuilt (`workflow: "existing_deck_revision"`) | `inventory` on `deck`, naming the `<id>.inventory.json` beside the pages file (`REVISION_INVENTORY_MISSING`); each page's `sourceSlide`; every imported slide mapped to a page type (`REVISION_UNMAPPED`). It may carry partial plans ([Revising an existing deck](storylining.md#revising-an-existing-deck)) |

Records join by ID, never by position. Content and design records cover every authored slide, including cover, dividers and appendix; mark structural content records `role: "structural"`, which keeps their text checks without an analytical claim. Revisions keep unaffected records but reconcile every changed dependency.

`purpose` on the deck changes what it is held to. `purpose: "evaluation"` marks a skill-evaluation deck, which the build refuses under 50 rendered pages (`EVALUATION_TOO_SHORT`). `purpose: "catalogue"` marks a component gallery that makes no argument: the storyline gate, the variety contract and the craft floors are skipped. Never set it on a deck that argues something.

Use `{{page:stable-id}}` for cross-references; they resolve after pagination, including split-page ranges. A section map owns tracker labels, order and membership.

## Content design

For each page the content plan records `claim`, `settles`, `adds` and `highlight`:

```json
{
  "schema": "professional-slides.content/v1", "id": "capacity",
  "question": "Which queues need the first capacity review?",
  "answer": "Review the three queues containing 56 of 64 unresolved requests first.",
  "pages": [{
    "id": "queue-load", "n": 2,
    "claim": "Three queues contain 56 of 64 unresolved requests",
    "settles": {"kind": "count", "what": "Six named queues: 24, 2, 16, 16, 4, 2 unresolved requests in the same snapshot"},
    "adds": "Volume prioritizes investigation; the required resource still depends on each queue's constraint.",
    "highlight": null
  }]
}
```

`settles.kind` is `count`, `share`, `rank`, `rate`, `sequence`, `comparison`, `structure` or `qualitative`; a chart or table page is never `qualitative`, since it measures something. With an insight log, a page's `evidence` names its insights and `settles` is derived from them. `adds` is what the commentary says that the exhibit cannot; a page with no commentary leaves it out. `highlight` is an exact phrase for emphasis or null; it is not an instruction to infer a chart maximum.

What a page `settles` usually names its page type: a `rank` is a ranking, a `rate` a trend, a `structure` a mechanism or a composition, several `comparison`s of one question a panels page. The type is chosen while the claim is written, and the storyline critique judges the sequence's rhythm with the argument.

## Complete visible copy and the reference text gate

The dot-dash is the full writing draft. The derived content file carries `textContract: "complete"` and, for every page, `textPlan: [{id, role, text}]` - every heading, explanation, table cell, chart label, formatted value, annotation, note and source, with roles `title`, `body`, `exhibit`, `qualification`, `source` or `furniture`. Recurring shell text is furniture: excluded from density scores, but its wording must survive composition and export.

Each page also carries `textReference: {task}`, the reading task it performs, whose word targets ship in `runtime/reading-tasks.json` (lower quartile, median, upper quartile). Body counts include exhibit labels and qualifications; the title, footer and any line opening with Source or Note are counted separately.

| Task | The page | Target body words, median |
| --- | --- | --- |
| `chart-led` | A chart with at most a line of takeaway | 55 |
| `chart-with-commentary` | A chart with developed points beside or below | 150 |
| `table-led` / `table-with-commentary` | A table, without or with a commentary column | 167 / 220 |
| `diagram-led` / `diagram-with-commentary` | A diagram, without or with a commentary column | 126 / 113 |
| `text-page` | Prose or points with no exhibit | 136 |
| `mixed` | Two or more exhibit families on one page | 127 |

The build checks the declared task against the composed page (`TEXT_TASK_MISMATCH`) and refuses a takeaway band past two lines (`TAKEAWAY_LONG`).

- **Below the floor.** The matched lower quartile, scaled by the deck's `density` (a `live-pitch` deck is held to a quarter of it), is a hard floor (`TEXT_COVERAGE_LOW`): develop the missing reasoning or move the page to the task it performs.
- **Above the floor.** The build's density profile compares each rendered page with the targets, and the review's density pass judges every page it flags, so a page padded to clear the floor fails there instead.
- **Neither is a quota.** Do not pad or let repeated labels stand in for explanation.

`textCoverageScore = 100 × planned body words / reference median body words` is a relative index, not a taste rating. The same wording and reference comparison hold through the plan, the spec, the composed scene, the saved PPTX and the rendered PDF. If composition splits a page, each resulting page is reconciled into its own text plan. `text-coverage.json` reports composition retention; `rendered-text-coverage.json` checks the planned fragments in the saved PDF's text.

## The plan file

Choose an evidence relationship before a component ([Design](design.md), [reference atlas](reference-atlas.md)). For a difficult page, sketch materially different structures and keep the one that makes the comparison easiest; this is an internal design choice, not a user approval step.

```json
{
  "schema": "professional-slides.plan/v1",
  "noPictures": "The evidence is a queue roster; photographs would not identify its bottleneck",
  "pages": [{
    "id": "queue-load", "n": 2,
    "title": "Three queues contain 56 of 64 unresolved requests",
    "exhibit": "chart.bar", "variant": "neutral",
    "why": "Compare all six counts; annotate the named three-queue set and its total, preserving the other counts.",
    "architecture": "exhibit-full", "anchors": false,
    "highlight": null, "annotation": "named set and total", "insight": "none", "items": 6
  }]
}
```

| Field | Meaning |
| --- | --- |
| `id`, `title` | Stable slide ID and exact approved title |
| `n`, `kind` | Reporting position; `kind` marks a cover as `cover`; analytical pages use `content` or omit it |
| `exhibit`, `variant` | Selected encoding and treatment; implementation controls belong in deck props |
| `why` | Evidence relationship, shared key or scale, hierarchy, treatment and merger decision |
| `architecture` | Explicit normalized structure; `auto` is not a considered design |
| `anchors` | Authored supported icons or images, or false when unnecessary |
| `highlight` | Exact phrase or null; chart and table focus is selected by exact keys in deck props |
| `treatment`, `annotation` | Intended visual choices, naming the affected children in `why` |
| `insight` | `filled`, `outline` or `none`; the sentence itself belongs in the content and the deck |
| `rows`, `items` | Actual evidence size for capacity planning |
| `series` | A deliberately comparable repeated task, with its rationale |
| `workflow`, `inventory`, `sourceSlide` | A revision's workflow, the inventory it was imported from, and each page's slide in the source deck |
| `shape`, `pageType`, `commentary` | The evidence shape, the page type record and the commentary placement the compile wrote |

A page field the plan does not have is refused (`PLAN_SCHEMA`), with the fields it named: nothing reads it. Six older names are read once, as the plan is read, into the field they mean - `layout` as `architecture`, `points` as `items`, `dataShape` as `shape`, `exhibitVariant` as `variant`, and `reason` and `exhibitReason` as `why` - and a page that gives a field under both names keeps its own (`readPlanPages` in `runtime/gates/plan_gates.mjs`).

`node runtime/gates/plan_gates.mjs <id>.plan.json` and `node runtime/gates/content_gates.mjs <id>.content.json` run the gates on a hand-written record; the build runs the sidecars it finds. Mix, icon, treatment and density statistics are advisory, never decoration quotas. Classify every component in a composite, not only the dominant exhibit; [Composition](composition.md) owns allocation and peer anchors.
