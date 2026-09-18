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

## Why it scores two things and refuses to average them

- **The plan** — the dot-dash, through `plan_gates.mjs`. What the deck was going
  to be before anything was drawn.
- **The build** — a built output directory, through `designStatistics` read off
  `scene.json`. What it turned out to be.

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

Three, chosen because each has already failed in a different way.

| Brief | What it is there to catch |
| --- | --- |
| `marvel-vs-dc.md` | The craft gap. An ordinary comparison that passed every gate and still read as dry. |
| `london-vs-new-york.md` | Geography drawn as paragraphs beside a stock photograph instead of as an annotated map. |
| `network-rollout.md` | The long scorecard: a twelve-row table on a four-point scale, which the skill can draw and almost never does. |

## `specimens/`

Recorded runs, as measurements rather than as artefacts. The plans themselves are
not stored — the Marvel plan is 118KB and would rot — only what scoring produced.
A specimen is useful because it is a run nobody can re-argue: these are the
numbers from a deck that passed every gate the skill had at the time.

`example-deck-baseline.json` is the same harness pointed at the four example
decks, which is how you know the harness is not simply strict. Two of them miss a
bar today, and that is a finding about those decks rather than a reason to move
the bar: `slideworks` treats one table in six against a reference of about half,
and `house-style` treats none of its one table.

## What this cannot do

It cannot run the model. Generating a deck is not deterministic and does not
belong in a test suite, so `test_cold_run.py` checks the harness — that the
scorer measures what it claims, that the bars are the contract's bars, and that a
run like the recorded one still fails. Producing the run is a human step, and the
point of this directory is that scoring it afterwards is not.
