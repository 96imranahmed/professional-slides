# evals

Verification for `skills/professional-slides` covers the pages file's contract,
binding, composition, export, readback and rendered geometry.
Passing these checks does not establish editorial or visual taste. The pipeline
the skill itself runs is [SKILL.md](../skills/professional-slides/SKILL.md#pipeline);
none of it is repeated here.

## Point changes

`point-change/` is the skill's second workflow as a command: a change to one
page of a deck the user already has - a figure that stands on three slides, a
title, an exhibit redrawn - run the way `SKILL.md` tells an author to run it,
on decks made on the spot. It checks that the change was made, that every
other slide came out byte for byte as it went in, that a figure left behind
on another slide was caught, and that nothing but the changed pages was
refused; and it counts the commands the run took. See
`point-change/README.md`.

```bash
node evals/point-change/run.mjs [--task <id>] [--agent claude]
```

## Support code

`support/` holds the code only the suite runs, kept out of the shipped runtime
so the plugin carries nothing a deck does not use: the composer's entry point
the tests import (`compose.mjs`, re-exporting `runtime/compose-*.mjs`), the
component fixtures, the HTML adapter and the browser overlap audit with its
layering policy.

## Commands

Iterate on the modules a change touches, `--pattern "test_<module>.py"`, or on
the fast tier, `--fast` (about a third of the full suite's wall time): every
test except the property sweeps and end-to-end authoring classes listed, each
with its reason, in `heavy-tests.json`. Run the full suite, with no flag, once
before a commit or push. One run holds the machine at a time: a second run
waits for the first, saying so, since two run together each take twice as long;
a lock left by a run that was killed is taken over.

```bash
# everything: unit tests, the example decks' content stage and the source checks
evals/run.sh

# plus the LibreOffice end-to-end render (test_end_to_end_render.py, ~5 s)
evals/run.sh --slow

# unit tests only: parallel, with a dependency preflight and a skip report.
# --jobs N workers (default: CPUs, at most 8); --serial one worker; --strict fails
# on a test skipped for a missing dependency; --slow adds the opt-in LibreOffice
# end-to-end tests (PS_RUN_SLOW=1); --fast leaves out the heavy classes
# evals/heavy-tests.json lists; --pattern GLOB picks modules; --verbose
node evals/scripts/run_tests.mjs [--jobs N] [--serial] [--strict] [--slow] [--fast] [--pattern GLOB] [--verbose]
python3 -m unittest discover -s evals/tests -p 'test_*.py'

# source checks (npm run check:syntax): syntax, the embedded probes, and dead
# exports - an export no runtime module, eval script, test probe or code example
# in the docs imports; it fails on any, unless evals/scripts/dead_exports.mjs
# names it in PUBLIC_API with the reason it is kept
node evals/scripts/check_source_quality.mjs
node evals/scripts/dead_exports.mjs

# deterministic page gates on any scene + render
python3 skills/professional-slides/runtime/gates/page_gates.py \
    scene.json [render_dir/] [--report out.json] \
    [--profile executive|pre-read|live-pitch|appendix] [--only CODE,CODE]

# compile a spec into a scene the gates and the emitter can read
node evals/scripts/compile_scene.mjs spec.json scene.json

# rebuild a gate-readable scene from a .pptx built by an older pipeline
python3 evals/scripts/pptx_scene_probe.py deck.pptx scene.json
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
