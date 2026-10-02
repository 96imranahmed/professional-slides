# Quality eval

The unit suite checks that each part of the skill does what it says. It cannot
say whether the decks got better. This directory is the end-to-end measurement:
a headless agent is given a brief and nothing else, the deck it delivers is
judged blind, and the result is compared with the previous version of the
skill on the same brief.

```bash
node evals/quality/run.mjs --set dev --runs 3                 # the development briefs
node evals/quality/run.mjs --set heldout --runs 3             # the held-out briefs
node evals/quality/run.mjs --set all --runs 3 --agent claude --judge claude
node evals/quality/run.mjs --set dev --runs 1 --dry-run       # print the commands, run nothing
node evals/quality/run.mjs --report                           # the summary for this skill version
```

A run costs real model time: an agent run builds a whole deck, and every
judged deck is one or two judge calls. `--dry-run` shows exactly what would be
called.

## What one run does

1. **Agent.** An empty temporary workspace, and the agent command from
   `config.json` with `{prompt}` set to the brief as a stranger would type it -
   the "Why this brief is in the suite" paragraph is removed, since it says what
   the run is there to catch. For the `claude` agent, `{plugin}` is a fresh
   package of this checkout (`evals/scripts/package_plugin.py`) loaded with
   `--plugin-dir`, so the run measures this working tree rather than whatever
   is installed. `PROFESSIONAL_SLIDES_HOME` points into the workspace so stored
   design preferences cannot make two runs differ.
2. **Collect.** The build directory (the one holding `scene.json`, preferring a
   delivered one), its renders and review sheets, `delivery.json`, and the
   pages, plan and deck files are kept under `runs/<skill>/<brief>/…`
   (git-ignored). Review and storyline histories (`.reviews/`) are never
   collected. A run that leaves no rendered deck is recorded as `no-deck` or
   `agent-failed`; that is a result, not a gap. Delivery ends with a
   confirmation read of the accepted deck; a run that stops before it (a review
   or confirmation packet waiting) is still judged, and recorded as not
   delivered with its `deliveryStage`.
3. **Score.** The cold-run scorer (`../cold-run/score.mjs`) runs the build
   bars on the scene and the plan gates on the plan.
4. **Judge, blind.** A packet directory holding only `brief.md`, `rubric.md`
   (condensed; five dimensions and majors) and the rendered pages as contact
   sheets. No pages file, plan, scene, reviews, self-check, storyline critique
   or history: a page that needs its author's explanation is a page that does
   not work. The judge returns
   `{rating, dimensions: {argument, evidence, visual, copy, sequence}, majors}`.
5. **Pairwise.** The same judge sees this deck and the most recent stored deck
   from a different skill version for the same brief, agent and prompt, as
   `deck-1/` and `deck-2/` in an order fixed by a hash of the pair - never
   labelled old or new. The preference is mapped back to `current`,
   `previous` or `tie`.
6. **Record.** One line in `results.jsonl`, keyed by skill version, judge
   model, brief and run. A key already recorded is refused, never doubled; new
   runs continue the run count.

The skill version is the git tree hash of `skills/` at HEAD, with
`+dirty.<digest>` of any uncommitted change to it, so two different working
trees never share a key.

## The report

Per brief: runs, mean rating, standard deviation, min and max, decks not
produced, how many cleared the build bars and the plan gates, and the pairwise
record (won-tied-lost) with its win rate, where a tie counts a half. Overall:
the pairwise win rate against the previous version. Three runs is the least
that shows spread; a mean moving by less than the standard deviation is noise.

## Briefs

- **dev** - the cold-run briefs in `../cold-run/briefs/`. Look at these runs,
  find what failed, fix the skill.
- **heldout** - `briefs/heldout/`. Never used to tune the skill: nobody reads a
  held-out run to decide what to change. They say whether fixes made against
  the dev briefs generalise. See `briefs/heldout/README.md` for what to do when
  one is spent.

## Commands and placeholders

`config.json` holds argv templates. Agent: `{prompt}`, `{workspace}`,
`{plugin}`. Judge: `{prompt}`, `{packet}`, `{schema}` (the JSON schema the
answer must match: `judge-schema.json`, `pairwise-schema.json`,
`anchor-judge-schema.json`), `{model}`. The `claude` entries were checked
against `claude --help`. The `codex` agent entry is marked `unverified`: its
flags were written without the CLI installed, and Codex loads plugins from its
marketplace rather than from `{plugin}`, so install the package first. The
runner prints the `unverified` note whenever that entry is used.

The prompt defaults to the brief alone (`prompts.brief`). A headless run cannot
answer the design intake or approve a dot-dash; if runs stop to ask, that is a
finding about the skill. `--prompt unattended` adds one line telling the agent
nobody will answer - it changes the run, so it is part of what a result row
records and pairwise only compares like with like.

## Judge calibration

`anchors/` holds rendered pages with a known place on the page scale. Once a
person has scored them, every run reports the judge's mean absolute error over
the scored anchors and records it as an `anchors` row; until then the runner
says none are scored. See `anchors/README.md`.

## Gate validity

`defects.json` labels what people found on the stored specimens with the gate
that should catch each defect. `gate-validity.mjs` replays the stored scenes and
plans through today's gates and prints per-gate recall and precision:

```bash
node evals/quality/gate-validity.mjs
node evals/quality/gate-validity.mjs --overlap                 # also the Chromium overlap audit
node evals/quality/gate-validity.mjs --renders anthropic-vs-openai-2026=path/to/rendered
```

A defect with `expectedGate: null` is one no gate measures yet; the report
lists what fired on those pages, which is where a new gate starts.

## Tests

`evals/tests/test_quality_eval.py` runs the whole loop with
`fixtures/fake-agent.mjs` and `fixtures/fake-judge.mjs`: no model is called. It
checks blinding (the fake agent writes author files carrying a marker, and the
fake judge reports any packet file carrying it), pairing through the shuffled
order, results keying and the summary's arithmetic.
`evals/tests/test_gate_validity.py` covers the replay.
