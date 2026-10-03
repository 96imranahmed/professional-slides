# evals

Verification for `skills/professional-slides` covers content and plan contracts,
composition, export, readback, rendered geometry and delivery-review bindings.
Passing these checks does not establish editorial or visual taste. The pipeline
the skill itself runs is [SKILL.md](../skills/professional-slides/SKILL.md#pipeline);
none of it is repeated here.

## Quality eval

`quality/` is the end-to-end measurement the unit suite cannot make: a headless
agent given a brief and nothing else, the deck it delivers judged blind from
its renders, and a pairwise comparison with the previous skill version on the
same brief. Results accumulate in `quality/results.jsonl`, keyed by skill
version, judge model, brief and run. Development briefs are the cold-run
briefs; `quality/briefs/heldout/` is never used for tuning. See
`quality/README.md`.

Each run packages this checkout, gives a headless agent the brief in an empty
workspace, judges the delivered deck blind from its renders against
`quality/rubric.md`, and compares it pairwise with the latest stored deck of a
different skill version (the git tree hash of `skills/`) on the same brief.
`quality/anchors/` holds pages with a known place on the rating scale for
checking the judge; its scores are provisional until a person has scored them.
`quality/defects.json` labels the defects people found on the stored specimens
with the gate that should catch each, and `gate-validity.mjs` replays them.

```bash
node evals/quality/run.mjs --set dev --runs 3 [--agent claude] [--judge claude] [--dry-run]
node evals/quality/run.mjs --report                # the summary for this skill version
node evals/quality/gate-validity.mjs               # per-gate recall and precision on labelled defects
node evals/quality/evidence-validity.mjs           # the evidence contract: seeded defects caught, clean fixture decks clear, known limits listed
node evals/quality/critic-calibration.mjs --repeats 5 [--dry-run]   # the storyline critic on frozen packets: its spread, and planted anchors
```

## Cold runs

`cold-run/` is the review loop as a command. A cold run is the skill used the
way a stranger uses it — a brief, no context, no corrections. `cold-run/score.mjs`
scores the plan and the build separately and refuses to average them, because a
plan that passes while its deck does not is a different problem from the
reverse. Recorded runs are kept as inputs under `cold-run/specimens/<name>/` and
scored again, live, under today's rules. See `cold-run/README.md`.

```bash
node evals/cold-run/score.mjs out/deck.plan.json out/
node evals/cold-run/specimens.mjs [--stamp]   # the stored runs under today's rules; --stamp records new verdicts
node evals/cold-run/baseline.mjs [--stamp]    # the example decks, compiled and scored
```

## Calibration

`calibration/` re-derives the targets in `runtime/reading-tasks.json` and
`runtime/weight.json` from a calibration set kept outside the repository and
found through the `PS_CALIBRATION_CORPUS` environment variable. It holds
tooling only: no data file that could name the set's documents sits in the
repository, and the shipped targets are numbers. See `calibration/README.md`.

## Commands

```bash
# everything: unit tests, the example decks' content stage and build bars,
# the stored specimens and gate validity
evals/run.sh

# plus the LibreOffice end-to-end render (test_end_to_end_render.py, ~5 s)
evals/run.sh --slow

# unit tests only: parallel, with a dependency preflight and a skip report.
# --jobs N workers (default: CPUs, at most 8); --serial one worker; --strict fails
# on a test skipped for a missing dependency; --slow adds the opt-in LibreOffice
# end-to-end tests (PS_RUN_SLOW=1); --pattern GLOB picks modules; --verbose
node evals/scripts/run_tests.mjs [--jobs N] [--serial] [--strict] [--slow] [--pattern GLOB] [--verbose]
python3 -m unittest discover -s evals/tests -p 'test_*.py'

# source checks (npm run check:syntax): syntax, the embedded probes, and dead
# exports - an export no runtime module, eval script, test probe or code example
# in the docs imports; it fails on any, unless evals/scripts/dead_exports.mjs
# names it in PUBLIC_API with the reason it is kept
node evals/scripts/check_source_quality.mjs
node evals/scripts/dead_exports.mjs

# deterministic page gates on any scene + render
python3 skills/professional-slides/runtime/gates/page_gates.py \
    scene.json render_dir/ [--report out.json] \
    [--profile executive|pre-read|live-pitch] [--only CODE,CODE]

# compile a spec into a scene the gates and the emitter can read
node evals/scripts/compile_scene.mjs spec.json scene.json

# rebuild a gate-readable scene from a .pptx built by an older pipeline
python3 evals/scripts/pptx_scene_probe.py deck.pptx scene.json
```

## Reference census

`scripts/reference_census.py` measures a rendered deck page by page — words and
numeric tokens, body ink, occupied grid cells, empty bands, title rules, and,
given the scene or pages file, exhibits per page, one-exhibit-plus-column pages,
plotted values per chart page and one-to-three-word title last lines — and sets
it beside a reference census. `reference_census.json` holds the numbers for a
sample of strong consulting pages; the sample stays outside the repository, so
pass another PDF or census JSON to `--reference` to compare against something
else.

Every per-page statistic is taken over the deck's analytical pages: the cover,
section dividers, agendas and generated pages (picture credits) are left out,
told apart by the scene and the compiled deck spec, or guessed from the render
without a scene; a scanned reference is measured whole, and the printed notes
say which applied. Plotted values are the compiler's: given the compiled spec
(`--deck`, or the `<id>.deck.json` beside `--pages`), the chart pages are those
with `pageType.chart` - the chart page types and panels carrying a chart - and
each counts `pageType.values`, the number `author-deck.mjs` prints as `plotted`.

```bash
python3 evals/scripts/reference_census.py out/rendered/deck.pdf \
    --scene out/scene.json --pages deck.pages.json \
    --reference evals/reference_census.json [--out census.json]
```

## Page gates

`runtime/gates/page_gates.py` measures the resolved scene and, where the
question is optical, the rendered PNG. Exit 0 pass, 2 findings. Every finding is
`{slide, code, measured, threshold, repair}`.

See the [evaluation contract](../skills/professional-slides/references/evaluation/index.md)
for blocking checks and advisory statistics. Each generated report carries
the thresholds actually used; the [page-gate implementation](../skills/professional-slides/runtime/gates/page_gates.py)
owns the profile and role-specific rules.

Whether a page needs additional interpretation is an editorial review decision. There is no mandatory closing-consequence gate: a necessary caveat may complete the evidence, and a separate `soWhat` is optional.

Content-stage summaries distinguish quantitative evidence kinds from structured
qualitative kinds. Neither share certifies that a claim is sourced or correct;
the reviewer must inspect its evidence.

Install Node test dependencies with `npm ci`, then install the browser used by
rendered overlap tests with `npx playwright install chromium`. Use Node 20.9+
and set `RUNTIME_PYTHON` when the Python dependencies live outside the default
interpreter. `RUNTIME_NODE_MODULES` defaults to this checkout's `node_modules`.
