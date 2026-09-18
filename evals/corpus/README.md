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

## What it says

**The wide word numbers were right.** Median 195 words a page against the 196 the
file already claimed, p25 120 against 127, p75 289 against 282. Whatever produced
those, they hold.

**The band split was not.** The body band runs to a median of 154 words, not 128;
the title band to 17, not 20; the footer to 12, not 19. Every profile in
`page_gates.py` derives from `bands.body`, so all four were about 20% tight.

**Ink: the median was right and the floor was not.** Published pages run a median
ink share of 0.191 — the file said 0.19. But the first quartile is 0.112, so the
`full` floor of 0.14 rejects **36%** of published client pages and `balanced` at
0.115 rejects 26%. A floor that fails a third of the corpus is not measuring
emptiness. At 0.08 it fails 11%, and on pages with a chart, 10%.

**Emptiness gates were far too loose in the other direction.** Real pages leave
almost nothing trailing: dead band median 0.000, p90 0.049 against a 0.06–0.08
ceiling; internal void median 0.019, p90 0.069 against a 0.16–0.32 ceiling. The
void ceilings could tighten by a factor of three before they touched a real page.

**Charts and tables are worked much harder than the plan gates ask.** Of pages
carrying a chart, **63%** annotate it — a callout, a bracket, a CAGR pill, a shaded
band, a recoloured mark — and **79%** print values on the marks. Of pages carrying a
table, **89%** treat it: banded rows, colour-coded cells, harvey balls, icons,
in-cell bars, a total row set apart. The plan gates asked for 0.20 and 0.25. The
50-page deck that shipped 18 unannotated charts and 10 untreated tables passed
both, comfortably.

**A third of published pages carry no exhibit at all.** 30% of content pages are
type alone, and they behave nothing like exhibit pages: 264 words against 196,
six numeric tokens against 27, a claim in the title 28% of the time against 76%,
and a commentary column **4%** of the time against 73%. The skill has no such page
in its vocabulary. It builds every page as an exhibit with a commentary column
beside it, which is how a deck ends up with fifty pages of commentary restating
the exhibit next to it.

**Numbers on a page are a chart's obligation, not every page's.** Chart pages
carry a median of 27 numeric tokens (p25 16.5). Diagram pages carry 3.5. The
single `numbers_per_page_min: 8` applied to any page with an exhibit rejects 29%
of published exhibit pages, almost all of them diagrams and structural tables.

**Pictures are not a quota.** `plan.mix.picture.min` asks for 5% of pages to be
carried by a photograph. 0.8% of published pages are. Pictures appear on 11.8% of
pages, always as support.

### The table

| what the skill said | where it said it | what the corpus says |
|---|---|---|
| body band 128 words | `reference.slides.bands.body` | 154 (p25 85, p75 244) |
| title band 20 / footer 19 | same | 17 / 12 |
| words p25 127, median 196, p75 282 | `reference.corpus` | 120 / 195 / 289 |
| numeric tokens 17 | `reference.slides` | 11 over all pages; 27 on chart pages, 3.5 on diagrams |
| ink median 0.19, q1 0.121 | `reference.slides` | 0.191, 0.112 |
| heavy share 0.42 | `reference.slides` | 0.53 |
| ink floor 0.14 / 0.115 / 0.05 | `geometryByFill` | fails 36% / 26% / 3% of published pages |
| dead band ≤ 0.06–0.14 | `geometryByFill` | real p90 0.049 |
| internal void ≤ 0.16–0.32 | `geometryByFill` | real p90 0.069 |
| chart annotated ≥ 0.20 | `plan.craft` | 0.63 |
| table treated ≥ 0.25 | `plan.craft` | 0.89 |
| table rows median 6 | `plan.craft` | 7 (p25 3, p75 12) |
| chart share ≥ 0.35 | `plan.mix` | 0.37 dominant, 0.45 present |
| table share ≤ 0.25 | `plan.mix` | 0.11 dominant, 0.16 present |
| diagram share ≥ 0.07 | `plan.mix` | 0.08 dominant, 0.11 present |
| picture share ≥ 0.05 | `plan.mix` | 0.008 dominant |
| — no band at all — | `plan.mix` | text pages are 0.30 of the deck |

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
