# The reference corpus

Until now every floor in `runtime/weight.json` was calibrated on the four decks in
`skills/professional-slides/examples/` — decks this repository wrote. The file said
otherwise (`"Published McKinsey, BCG and Bain client decks"`), but nothing in the
tree could reproduce those numbers, and one of the four, `slideworks`, printed
`80%` over a chart that gave 29 of 33. A floor derived from that is a floor that
says *look like what you already make*.

This directory replaces that with a measurement anyone can re-run.

## What was measured

670 downloaded, non-duplicate PDFs from twelve firms — McKinsey, BCG, Bain,
Accenture, Deloitte, PwC/Strategy&, LEK, EY, KPMG, AT Kearney, Booz Allen Hamilton
and Alvarez & Marsal. 639 of them are landscape presentations; 518 survive the
admission rule in `evals/client-deck-benchmark.md`, which excludes prose reports
and general market publications. Within those, a page counts as analytical when it
is landscape, is neither the first nor the last page, carries at least twenty
words, and carries something below its title band. That leaves **16,334 pages**.

Three instruments, in rising cost and falling sample size:

| pass | instrument | sample |
|---|---|---|
| `words` | `pdftotext -bbox`; word counts in ten y-bands, numeric tokens by the gate's own regex | 16,334 pages |
| `pixels` | `pdftoppm` to the same 1280×720 canvas `page_gates.py` reads, same luminance cuts | 2,125 pages, 426 decks |
| `judged` | a vision pass against `rubric.md` — family, craft, whether the title makes a claim | 264 pages, one per deck |

`corpus-summary.json` holds the result, `page-measures.json` and
`page-judgements.json` the per-page rows behind the vision pass, and
`measure_corpus.py` re-runs all three.

## Two corpora, not one

The 670 PDFs are not one population. The index separates **client-project work** —
decks made for an engagement, by BCG, McKinsey and Bain — from **published
thought leadership** in deck format, which is most of what is publicly
downloadable. They behave differently, so the floors come from the first and the
second is recorded beside it as a contrast.

| | client projects | published work |
|---|---|---|
| decks / analytical pages | 28 / 3,606 | 396 / 12,678 |
| words a page (p25 / median / p75) | 126 / **189** / 267 | 119 / 198 / 297 |
| body band | **148** | 157 |
| ink (q1 / median) | 0.118 / **0.184** | 0.112 / 0.191 |
| internal void p90 | 0.060 | 0.069 |
| pages carried by a chart | **30%** | 37% |
| pages carried by a table | **20%** | 11% |
| pages with no exhibit | **25%** | 30% |
| titles that state a claim | **65%** | 55% |
| pages with a commentary column | **33%** | 43% |
| charts carrying an annotation | **80%** | 63% |
| tables carrying a treatment | **100%** (32 of 32) | 89% |
| table rows (median) | **5** | 7 |
| numeric tokens on a chart page | **26** | 27 |

**The page geometry is the same; the craft is not.** Words, bands, ink and void
differ by a few per cent between the two — which is why the geometric floors can
be trusted from either sample. Everything a reader would call craft differs
sharply: client decks annotate four charts in five and treat *every* table, write
a claim into two titles in three, and use a commentary column on only a third of
pages. Published work is looser on all four, and its 30% text-page share is
inflated by forewords, prose spreads and quote pages that no client deck carries.

A page of type is real in both (25% and 30%), but a client text page is 166 words
against a published one's 264: it is a numbered argument on tinted cards, not an
essay. It highlights a phrase 71% of the time.

## What it says

**The wide word numbers were right.** Client decks run a median of 189 words a page
against the 196 the file already claimed, p25 126 against 127, p75 267 against 282.
Whatever produced those, they hold.

**The band split was not.** In client decks the body band runs to a median of 148
words, not 128; the title band to 18, not 20; the footer to 13, not 19. Every
profile in `page_gates.py` derives from `bands.body`, so all four were tight.

**Ink: the median was right and the floor was not.** Client pages run a median ink
share of 0.184 — the file said 0.19. But the first quartile is 0.118, so the `full`
floor of 0.14 rejects **31%** of them and `balanced` at 0.115 rejects 22%. A floor
that fails a third of real client work is not measuring emptiness.

**Emptiness gates were far too loose in the other direction.** Real pages leave
almost nothing trailing: dead band median 0.000, p90 0.033 on client work; internal
void median 0.021, p90 0.060 against a ceiling of 0.16 to 0.32 that fired on 1.4%
of them. The void ceilings could tighten by a factor of three before they touched a
real page.

**Charts and tables are worked much harder than the plan gates ask.** In client
decks **80%** of pages carrying a chart annotate it — a callout, a bracket, a CAGR
pill, a shaded band, a recoloured mark — and **every one** of the 32 pages carrying
a table treats it: banded rows, colour-coded cells, harvey balls, icons, in-cell
bars, a total row set apart. Not one plain grid. The plan gates asked for 0.20 and
0.25, which is how the 50-page deck that shipped 18 unannotated charts and 10
untreated tables passed both comfortably.

**A quarter of client pages carry no exhibit at all**, and they behave nothing
like exhibit pages: a commentary column **13%** of the time against 38% on chart
pages, three numeric tokens against 26, a claim in the title 42% of the time
against 89%. They highlight a phrase 71% of the time — the emphasis does the work
the exhibit would. The skill has no such page in its vocabulary. It builds every
page as an exhibit with a commentary column beside it, which is how a deck ends up
with fifty pages of commentary restating the exhibit next to it.

**The commentary column is not the house default.** Only a third of client pages
carry one at all, and on a page of type it is rare enough to be a mistake.

**Numbers on a page are a chart's obligation, not every page's.** Client chart
pages carry a median of 26 numeric tokens (p25 20); diagram pages carry 4 and text
pages 3. The single `numbers_per_page_min: 8` applied to any page with an exhibit
rejected 29% of published exhibit pages, almost all of them process chains and
structural matrices whose evidence is the structure.

**Pictures are not a quota.** `plan.mix.picture.min` asked for 5% of pages to be
carried by a photograph. 1.6% of client pages are, and only 7% carry one at all.

### The table

| what the skill said | where it said it | client projects | published work |
|---|---|---|---|
| body band 128 words | `reference.slides.bands.body` | **148** | 157 |
| title band 20 / footer 19 | same | **18 / 13** | 17 / 12 |
| words p25 127, median 196, p75 282 | `reference.corpus` | **126 / 189 / 267** | 119 / 198 / 297 |
| numeric tokens 17 | `reference.slides` | **13**; 26 on a chart page, 4 on a diagram | 11; 27 / 3.5 |
| ink median 0.19, q1 0.121 | `reference.slides` | **0.184 / 0.118** | 0.191 / 0.112 |
| heavy share 0.42 | `reference.slides` | **0.51** | 0.54 |
| ink floor 0.14 / 0.115 / 0.05 | `geometryByFill` | fails **31% / 22% / 6%** | 36% / 26% / 3% |
| internal void ≤ 0.16–0.32 | `geometryByFill` | p90 **0.060** | p90 0.069 |
| chart annotated ≥ 0.20 | `plan.craft` | **0.80** | 0.63 |
| table treated ≥ 0.25 | `plan.craft` | **1.00** | 0.89 |
| table rows median 6 | `plan.craft` | **5** (p25 3) | 7 |
| chart share ≥ 0.35 | `plan.mix` | **0.30** dominant, 0.40 present | 0.37 / 0.45 |
| table share ≤ 0.25 | `plan.mix` | **0.20** dominant, 0.26 present | 0.11 / 0.16 |
| diagram share ≥ 0.07 | `plan.mix` | **0.10** dominant | 0.08 |
| picture share ≥ 0.05 | `plan.mix` | **0.016** dominant, 0.07 present | 0.008 / 0.118 |
| — no band at all — | `plan.mix` | text pages are **0.25** of the deck | 0.30 |
| — never measured — | — | titles that state a claim **0.65** | 0.55 |
| — never measured — | — | pages with a commentary column **0.33** | 0.43 |

## What this is not

The vision pass is one model's reading of 264 images against a written rubric, not
a panel of consultants. Family and title calls are reliable; `chartAnnotated` and
`tableTreated` are judgement calls at the margin, and both were read generously —
a shaded band counts. Treat 0.63 and 0.89 as *far above 0.20 and 0.25*, not as
figures to three places.

The corpus is what was publicly downloadable, so it leans towards published
thought leadership over client work: 532 of 967 listings are marked
`Consulting presentations` and only 46 `Client projects`. Published work is
prettier and less numerate than the pack a team actually walks a client through.
Where the corpus is *less* demanding than the skill — titles make a claim only 55%
of the time — that is a reason to keep the skill's rule, not to relax it. The
corpus is a floor on craft, not a ceiling on it.

McKinsey is under-represented after the admission filter (28 decks of 518),
because most of its downloadable material is MGI and industry reports. BCG,
Accenture, PwC/Strategy& and Booz Allen carry the sample.

## Re-running it

```sh
python3 evals/corpus/measure_corpus.py words  <corpus> words.jsonl
python3 evals/corpus/measure_corpus.py pixels <corpus> words.jsonl pixels.jsonl
python3 evals/corpus/measure_corpus.py sample <corpus> pixels.jsonl out/
```

Then hand `out/sample.pdf` and `rubric.md` to a vision pass and keep its JSON as
`page-judgements.json`. The corpus itself is not in this repository: it is 2.1GB
of third-party PDFs.

## The Slideworks library

The McKinsey, BCG and Bain decks listed by slideworks.io are part of the corpus,
under `slideworks/` beside `index.csv`: a coverage record of all 351 listings, the
141 with no usable download and why, the 207 unique documents on disk (9,835
pages) with their hashes, a browsable `index.html`, and `decks/<firm>/` links to
the canonical PDFs rather than copies. `build_slideworks_library.py` rebuilds it
from `index.csv`. Nothing about the collection lives in the repository's
`output/` folder, which is working space.

The design-style inventory in `styles/` samples 300 of its pages alongside 100
from the rest of the corpus, classified into 85 styles (`classified.json`). A
second draw of 200 pages from the firms' published and infographic reports
(`sample-published.json`, `classified-published.json`) looked for styles client
work lacks: 195 of its 198 content pages fitted the 85, and the three that did
not were one new style, radial bars (`C-radial`). The same pages carried five
devices the charts could not set, now drawn: delta pills over columns, icons or
logos on a category axis, a growth column at the end of a line chart, a discrete
assessment scale and the radial bars themselves. `style-classification.csv` at
the corpus root holds the page-by-page result for all 600 pages, with a `sample`
column saying which draw each came from.
