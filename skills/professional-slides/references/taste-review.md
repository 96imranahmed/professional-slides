# The taste review

The pass no threshold makes. Every defect this skill has caught that mattered
was caught by a person opening the rendered pages and looking at them — the
gates found the geometry, and a reader found that the deck said nothing. This is
that reader, as a step in the build.

**Run it once.** One subagent, one pass over the spreads, one report back. It is
not a loop and it is not per page: a reviewer who sees four pages at a time sees
the deck's grammar, which is where most of the damage is, and a reviewer who
sees one page at a time sees none of it.

## Running it

After a build, `out/rendered/` holds `spread-N.png` — the deck at reading size,
four pages to a sheet, each page's number burned into its corner. Spawn **one**
subagent with the brief below and the spread paths. It reads the images itself;
do not paste them into the prompt.

```
Read every spread in <out>/rendered/. Follow <skill>/references/taste-review.md
and <skill>/references/design.md. Return the JSON described there and nothing else.
```

The report lands at `out/taste-review.json`. Treat `blocker` findings as build
failures and `major` as fix-before-delivery, exactly like a gate finding.

## The brief

You are the first reader. Nobody has explained the deck to you and nobody will.

**Read the titles alone first, in order, before you look at a single page.**
Write down what you think the deck argues. If the titles do not add up to an
argument, that is the first finding and it outranks everything else on this
list.

Then look at the pages. For each spread ask:

1. **Where does the eye land first, and is that the finding?** If the first
   thing you see is a grey box, a heading, or the largest table cell rather than
   the thing the title claims, say so.
2. **Does the commentary tell you anything the exhibit does not?** A column that
   restates the table beside it in different words is dead weight. Quote the
   sentence.
3. **Could this page be deleted without loss?** Name every page that could. A
   fifty-page deck that should be thirty is a worse deck, not a longer one.
4. **Is anything misaligned, overlapping, clipped, or floating in space** that a
   person would notice in one second? Two panels read across must share a
   baseline. A rule under nothing is a defect. A box two lines tall around one
   line of text is a defect.
5. **Does the page use one visual grammar or three?** A horizon band, a photo
   strip and an icon list on one page is three.
6. **Is the same page here twice?** Two tables with the same columns, two charts
   with the same shape, two lists with the same lead structure — across the deck,
   not just the spread.
7. **Does the deck ever measure anything?** Count the pages carrying a plot. If
   a comparison is argued for fifty pages and charted on one, say so plainly.

Then, across the whole deck:

- **Name the worst page and say why.** Not the weakest — the worst.
- **Name the best page**, so the deck has something to imitate.
- **Rate it out of ten**, as a reader receiving it, with one sentence of
  justification. Be honest; a 4 that says why is worth more than a 7 that does
  not.

### What not to report

- Anything a gate already measures numerically — ink, type size, characters per
  line, word counts. Those have thresholds; you have judgement. Use it.
- Preferences. "I would have used blue" is not a finding. "The accent is on the
  row that is not the answer" is.
- The same defect on twenty pages, twenty times. Report it once, list the pages.

### What to return

```json
{
  "rating": 4,
  "ratingWhy": "one sentence",
  "argument": "what the titles alone say the deck argues, or why they do not add up",
  "worstPage": { "page": 17, "why": "one sentence" },
  "bestPage": { "page": 9, "why": "one sentence" },
  "deletable": [12, 19, 41],
  "findings": [
    {
      "pages": [10, 36, 44],
      "code": "TWIN_CELLS",
      "severity": "blocker",
      "seen": "what you saw, concretely, quoting text where it is text",
      "repair": "what to do, as an instruction a person can act on"
    }
  ]
}
```

`code` is one of the review codes in `runtime/reviewer.mjs`, or an upper-case
name of your own if none fits — a code that does not exist yet is a finding
about the vocabulary and is worth having. `severity` is `blocker`,
`major` or `minor`.

## Why this exists rather than more thresholds

Three decks in this repository passed every gate and were wrong in the eye. The
last one cleared 40-odd numeric thresholds and was rated 2 out of 10, because
its commentary restated its tables, its tables were the same table, and fifty
pages of comparison carried one chart. Each of those is now a gate — but they
became gates *because somebody looked*, and the next class of defect will not be
in the list until somebody looks again.

A threshold catches what it was told to catch. This catches what nobody thought
of, which is the only thing worth spending a model on.
