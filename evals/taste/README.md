# Tuning the layout engine's taste on a corpus

The layout engine (`skills/professional-slides/runtime/tasteful-layout`) chooses how a page is arranged by scoring every
candidate on seven measures: white-space fraction, balance, uniformity, regularity, proportion, simplicity and variety. How sharply
each one bites is a weight in `TASTE.weights` (`skills/professional-slides/runtime/core.mjs`), with per-density overrides
in `DENSITY_PROFILES[...].taste`. The weights shipped are a first setting. This is how to check them against a corpus of
real decks, and change them on evidence.

Nothing here needs PowerPoint or LibreOffice: candidates are drawn as HTML and photographed by a headless browser.

## 1. Set up

```bash
git clone <this repository> && cd professional-slides
npm install                                   # Playwright, for the candidate sheets
npx playwright install chromium
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
export RUNTIME_PYTHON=$PWD/.venv/bin/python RUNTIME_NODE_MODULES=$PWD/node_modules
alias slides="node $PWD/skills/professional-slides/runtime/command.mjs"
```

## 2. What the corpus is

A folder of workspaces, one a deck: each holds a `project.json` and a pages file (`deck.pages.json`), as `slides init`
or `slides import` leaves them. A page reaches the engine's judgement wherever the engine chose between two or more
ways of setting its content: the blocks of a commentary column, a `kpi` figure, the points. `"commentary": "auto"` on a
page with one exhibit and points also leaves the whole arrangement (beside or below) to it, so set it on the pages
whose placement you want judged; a page with nothing for the engine to choose yields no verdict.

Every workspace must pass `slides check <work>` first: a page that does not compose stops the round.

## 3. Collect verdicts

A verdict is one decision put to a judge: the candidates drawn, each with its measures, and the one chosen.

```bash
slides judge <work> --json          # needs-input: one sheet a page under <work>/judgement/<page>.png
```

Each `requiredInputs` entry names a page, a decision id, the candidate labels (the first is the engine's choice) and the
sheet. Look at the sheet, choose by how the page reads, and write the choices to a file:

```json
{ "p07": { "p07-row-flow-best": "row 2:1" }, "p12": { "p12-side-flow-best": "column / p12-kpi=stacked" } }
```

```bash
slides judge <work> --choices choices.json     # kept on the pages, and filed in <work>/judgement/verdicts.jsonl
slides judge <work> --json                     # again: a choice can open one inside it; a page is asked at most three times
```

Repeat until `judge` reports nothing open. The judge can be you, or the coding agent running the skill (it is told to
choose among what is drawn and never to rewrite a page to improve its layout). Choosing the engine's own candidate is a
verdict too, and worth as much: it is what tells the fit which pages the weights already get right.

To judge the same decks again from scratch, delete the pages' `choices` and the workspace's `judgement/verdicts.jsonl`.

## 4. Check the weights, and fit them

```bash
node evals/scripts/taste_fit.mjs <corpus folder>          # share of verdicts the engine's own choice agrees with
node evals/scripts/taste_fit.mjs <corpus folder> --fit    # and weights that agree with more of them
```

The report gives `share` (agreement with the weights as shipped), every decision where the judge chose otherwise,
`judgeBetterOn` (per measure: positive where the judge's choices were more often the better ones on it, so a weight to
raise), and with `--fit` the fitted weights and their agreement. Scores are recomputed from the recorded measures, so
this takes a moment and lays nothing out.

Read it before using it:

- Under a few dozen verdicts the fit follows the noise. Treat `fitted` as a direction, not a setting.
- If agreement stays low whatever the weights, the measures are missing something the judge sees. That is a new measure
  or a new candidate, argued from the pages in `disagreed`, not a weight.
- A verdict only compares the candidates that were drawn (three at most). It says nothing about arrangements the engine
  never proposed.

## 5. Apply and verify

Put the weights you accept into `TASTE.weights` in `skills/professional-slides/runtime/core.mjs` (density-specific ones
into `DENSITY_PROFILES`), then:

```bash
npm run check                                      # the suite, including the verdicts kept as tests (test_judgement.py)
node evals/scripts/site_gallery.mjs                # which reproduced gallery pages the change moved
node evals/scripts/site_gallery.mjs --approve      # after looking at them: record the layout as it is now
```

Rebuild a deck or two from the corpus and look at the pages before keeping the change.
