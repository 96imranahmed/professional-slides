# Judge anchors

A judge's rating means something only against pages whose place on the scale is
already known. These are those pages: rendered slides, frozen as images, each
with the score a person gave it. The quality runner shows every scored anchor to
the judge as a single page, collects the judge's 1–10 rating, and reports the
judge's mean absolute error against the human score. A judge whose error grows
after a model or prompt change is a judge whose deck ratings moved for reasons
that have nothing to do with the decks.

## The set

`anchors.json` (schema: `schema.json`) lists 18 pages.

- **High (10).** Pages from the example decks: the fictional rail operator's
  growth plan (`examples/page-types.deck.json`) and the component gallery
  (`examples/gallery-acceptance.deck.json`). Each is a page whose exhibit proves
  its title - a coded scorecard, an annotated series, a bridge, a keyed map.
- **Low (8).** Pages from the `anthropic-vs-openai-2026` cold-run specimen that a
  reader marked as defective: dead space, a time series drawn as a scatter,
  multi-series scatters with no legend, number cards, colliding labels. The
  `defectClass` matches `../defects.json`.

Every anchor is `provisional: true` with `humanScore: null`. Until a person
scores them, the runner lists the anchors and computes no error.

## Scoring an anchor

1. Open the image and score the page on the rubric's page scale
   (`../rubric.md`, "Page scale"), without looking at `why`.
2. Set `humanScore`, `scoredBy` (initials) and `scoredOn` (ISO date), and set
   `provisional` to `false`.
3. Two people scoring independently and averaging is better than one; record
   the mean and note the spread in the commit message.

Do not re-render an anchor. The image is what was scored: `sha256` pins it, and
the runner refuses an anchor whose bytes no longer match.

## Adding anchors

Keep the set between 10 and 40 pages and roughly balanced across the scale; a
set of only very good and very bad pages says little about the middle, where
most real pages sit. Middle anchors (`tier: "middle"`) are the most useful next
addition. Take them from runs whose renders are kept, never from a brief in
`../briefs/heldout/`.
