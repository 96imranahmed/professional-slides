# Calibration

The skill's targets - the word floors per reading task, the ink and void
percentiles, the share of pages carrying each kind of exhibit, how often a
table is treated or a chart annotated, how prose is broken into blocks - were
measured on a set of strong analytical decks kept outside this repository. The
runtime ships the numbers only (`runtime/reading-tasks.json`,
`runtime/weight.json`); nothing shipped, and nothing here, names a document in
the set or says where it lives. That separation is deliberate: an installed
copy of the skill once went looking for the set on the user's disk.

This directory is the measurement tooling, so the targets can be re-derived
when the set grows or a method changes. It never holds the set or any file that
names its documents.

## The set

Point `PS_CALIBRATION_CORPUS` at its root. Every tool reads it from there and
refuses to run without it.

| File in the root | Written by | Read by |
| --- | --- | --- |
| `index.csv` - `listing_id, firm, category, status, format, pages, local_path, duplicate, title` | you | `measure_corpus.py` |
| the documents `index.csv` points at | you | `measure_corpus.py`, `measure_text_form.py` |
| `excluded-categories.txt` (optional) - categories left out of every figure, one per line: prose reports and market overviews rather than presentation-format work | you | `measure_corpus.py` |
| `page-judgements.json` - the vision pass over sampled pages, one object per page as `rubric.md` asks | the vision pass | `build_reading_tasks.py` |
| `page-measures.json` - `pdftotext -layout` counts per judged page, rows `[key, totalWords, _, bodyWords, ...]` (the builder reads columns 0, 1 and 3) | you | `build_reading_tasks.py` |
| `text-form-pages.json` - `{"pages": [{"file": "<relative path>", "pages": [n, ...]}]}`, analytic pages only | you | `measure_text_form.py` |

Everything the tools write that is per document or per page names documents.
Write it inside the set's root or another directory outside the repository.

## The tools

- `measure_corpus.py words|pixels|sample` - word counts, y-bands and numeric
  tokens off `pdftotext -bbox`; ink, dead band, internal and column void off a
  1280x720 render with the page gates' own luminance cuts; and a one-page-per-
  deck sample for the vision pass. The numeric-token pattern and the canvas are
  imported from `runtime/gates/page_gates.py` and `ink.py`, so a corpus count
  and a gate count cannot drift apart.
- `rubric.md` - the vision pass's questions: page kind, exhibit family,
  whether the title is a claim, commentary, highlighted phrase, chart
  annotation, table rows and treatment, source line.
- `build_reading_tasks.py` - body-word quartiles and total-word median per
  reading task, from every judged content page. Numbers only.
- `measure_text_form.py` - blocks per page, words per block, longest block.
  Numbers only; `--samples FILE` writes the per-page rows, outside the repo.
- `compare.mjs <build dir>…` - a built deck's measures beside the targets and
  the gates' floors, one instrument pointed at both populations. A report, not
  a gate.

## Regenerating `runtime/reading-tasks.json`

```bash
export PS_CALIBRATION_CORPUS=/path/to/the/set
python3 evals/calibration/measure_corpus.py words  "$PS_CALIBRATION_CORPUS/work/words.jsonl"
python3 evals/calibration/measure_corpus.py pixels "$PS_CALIBRATION_CORPUS/work/words.jsonl" "$PS_CALIBRATION_CORPUS/work/pixels.jsonl"
python3 evals/calibration/measure_corpus.py sample "$PS_CALIBRATION_CORPUS/work/pixels.jsonl" "$PS_CALIBRATION_CORPUS/work/sample"
# run the vision pass over work/sample/sample.pdf with rubric.md -> page-judgements.json
# count body and total words for each judged page -> page-measures.json
python3 evals/calibration/build_reading_tasks.py > /tmp/reading-tasks.json
diff skills/professional-slides/runtime/reading-tasks.json /tmp/reading-tasks.json
```

Fed the page records the current file was built from, the builder reproduces
`runtime/reading-tasks.json` exactly (quartiles by `statistics.quantiles`,
inclusive; `exhibit-led` and `exhibit-with-commentary` pool the chart, table
and diagram tasks). Copy the new file over the runtime's only after reading the
diff: a floor that moves changes which decks the text contract refuses.

## Regenerating the `weight.json` targets

`weight.json` belongs to the gates and is edited by hand from these outputs;
no tool writes it. Where each target comes from:

| `weight.json` key | Source |
| --- | --- |
| `reference.benchmark` (body-word percentiles, heavy share) | `words` pass, analytical pages |
| `reference.slides` (ink, dead band, void percentiles; words; numeric tokens; drawings) | `pixels` and `words` passes |
| `reference.judged` (claim titles, commentary, highlighted phrase, source line, by family) | vision pass shares |
| `plan.mix.*.observed` / `present` | vision pass: share of pages per family / share of decks using it |
| `plan.craft.tableTreated.observed`, `chartAnnotated.observed`, `tableRows` | vision pass over table and chart pages |
| `plan.textForm` | `measure_text_form.py` |

After changing `weight.json`, re-score the stored cold-run specimens and read
what moved:

```bash
node evals/cold-run/specimens.mjs          # verdicts under the new rules
node evals/cold-run/specimens.mjs --stamp  # record them, with the new weight.json hash
node evals/cold-run/baseline.mjs --stamp   # the example decks, likewise
node evals/quality/gate-validity.mjs       # per-gate recall and precision on the labelled defects
```
