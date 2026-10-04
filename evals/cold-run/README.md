# Cold-run evals

A cold run is the skill used the way a stranger uses it: a brief, no context, no
corrections, no one watching. Every defect found in this repository over two days
of review was found by a person opening a PDF and looking at it — a loop that
runs once per person per afternoon and finds things only after fifty pages exist.

This directory is that loop as a command.

```bash
# score a plan, a build, or both
node evals/cold-run/score.mjs out/deck.plan.json out/
node evals/cold-run/score.mjs out/deck.plan.json          # plan alone
node evals/cold-run/score.mjs - out/                       # build alone
node evals/cold-run/score.mjs out/deck.plan.json out/ --json
```

Exit 0 when the run clears every bar, 2 when it does not.

Where the author's run log is beside the plan or the build directory
(`<id>.author-log.jsonl`, which `author-deck.mjs` appends to on every run), the
report also carries what the run cost - `cost`: compile runs and refused runs
by mode (draft, check, full), runs a page, refusals by code and by page, and
the longest streak of refused runs on one page. The numbers are counted from
the log (`runtime/run-log.mjs`), never estimated, and reported, never scored:
a run that kept no log has no `cost`, and a deck is not accepted for being cheap.

## Why it scores two things and refuses to average them

- **The plan** — the dot-dash, through `plan_gates.mjs`. What the deck was going
  to be before anything was drawn.
- **The build** — a built output directory, through the build bars in
  `runtime/build-bars.mjs` (`designStatistics` and `scoreBuild`, re-exported by
  `score.mjs`) read off `scene.json`: the same bars delivery refuses a deck
  under, applied from 12 analytical pages, with the empty-frame ceiling on every
  deck. What it turned out to be.

They disagree more often than you would expect, and the disagreement is the
finding. The Marvel plan recorded nine architectures and 0.888 entropy — a good
score — and produced a deck carrying 2.9 distinct exhibits per ten pages, no
table treatment and no chart annotation. **A plan can only be judged on what it
records.** So the build is the check on the plan, and the plan is the check on
the brief. One combined number would have hidden which of the two was wrong.

## How to do a cold run

1. Pick a brief from `briefs/`, or write one. Give the model the brief and
   nothing else — no examples, no corrections, no "remember to use icons".
2. Let it produce the plan and build the deck, exactly as a stranger would.
3. Score it. Read the report; then **look at the montage**, because the
   beautification pass in `references/design.md` catches what these numbers
   cannot.
4. If it found something, record it: a new specimen, and a gate or a piece of
   guidance so the next run cannot repeat it.

## `briefs/`

Three, each aimed at a different failure. Marvel and the rollout have failed in
the way their row says; London has not been run yet. These are the quality
eval's development set (`evals/quality/run.mjs --set dev`).

| Brief | What it is there to catch |
| --- | --- |
| `marvel-vs-dc.md` | The craft gap. An ordinary comparison that passed every gate and still read as dry. |
| `london-vs-new-york.md` | Geography drawn as paragraphs beside a stock photograph instead of as an annotated map. |
| `network-rollout.md` | The long scorecard: a twelve-row table on a four-point scale, which the skill can draw and almost never does. |

## `specimens/`

Recorded runs. A run kept only as the numbers scoring once produced cannot
fail - no change to the gates ever reaches it - so a run worth keeping is kept
as what it wrote:

| Specimen | Holds | Why it is kept |
| --- | --- | --- |
| `anthropic-vs-openai-2026/` | pages, plan, scene (gzipped), compiled deck | Delivered on 27 September after passing every gate and its delivery review (7.8); an independent reader rated it 6.5 and did not accept it. Today's rules must refuse it. |
| `emirates-v8/` | pages, plan | A storyline the critique rated 5/10 with three blockers while every plan gate passed: the plan gates' blind spot, kept in view. |

A specimen that kept its author log as `author-log.jsonl` has its cost
counted from it and recorded with the stamp (`recorded.cost`).

`specimen.json` in each says what is known from outside the gates (delivery,
reviews, `foundByLooking`), the verdict today's rules must still reach
(`expect`), and the stamp: the verdict the rules returned and the sha256 of the
weight.json they read (`recorded`). `test_cold_run.py` scores every stored
specimen live, holds it to `expect`, and - while weight.json is unchanged -
to its recorded verdict.

```bash
node evals/cold-run/specimens.mjs            # verdicts under today's rules
node evals/cold-run/specimens.mjs --stamp    # after a deliberate rule change: record the new verdicts
node evals/cold-run/baseline.mjs [--stamp]   # the example decks, compiled in-process and scored
```

The older `*.json` specimens beside them are records of numbers from runs whose
inputs were not kept (the first Marvel plan was 118KB and was not stored). They
are kept for what they say, and `foundByLooking` in each is a claim the suite
keeps: every entry of `2026-09-18-network-rollout.json` has a test in
the composition and table tests (`evals/tests/test_compose_text.py`, `test_compose_layouts.py`, `test_compose_tables.py`, `test_tables.py`, `test_chart_annotations.py`). `evals/quality/defects.json` labels all
of these findings with the gate that should catch them, and
`evals/quality/gate-validity.mjs` measures how many the gates do.

`example-deck-baseline.json` is the harness pointed at the example decks, which
is how you know the harness is not simply strict. Where one misses a bar, that
is a finding about the deck rather than a reason to move the bar.

## Producing runs

`evals/quality/run.mjs` does steps 1 to 3 without a person: a headless agent
per brief and run, the deck scored here, judged blind, and compared with the
previous skill version's deck for the same brief. Generating a deck is not
deterministic and does not belong in the unit suite, so the suite tests that
harness with a fake agent and judge, and tests this one on stored specimens.
Step 4 - looking at the montage - stays a person's job.
