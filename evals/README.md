# evals

Verification for `skills/professional-slides` covers content and plan contracts,
composition, export, readback, rendered geometry and delivery-review bindings.
Passing these checks does not establish editorial or visual taste.

## Cold runs

`cold-run/` is the review loop as a command. A cold run is the skill used the
way a stranger uses it — a brief, no context, no corrections — and every defect
found here over two days of review was found by a person opening a PDF
afterwards. `cold-run/score.mjs` scores the plan and the build separately and
refuses to average them, because a plan that passes while its deck does not is a
different problem from the reverse. See `cold-run/README.md`.

```bash
node evals/cold-run/score.mjs out/deck.plan.json out/
```

## Commands

```bash
# everything: unit tests, content-stage and cold-run numbers for the example decks
evals/run.sh

# plus the LibreOffice end-to-end render (~10 s, skipped without soffice)
evals/run.sh --slow

# unit tests only
python3 -m unittest discover -s evals/tests -p 'test_*.py'
node evals/scripts/run_tests.mjs

# deterministic page gates on any scene + render (item 11)
python3 skills/professional-slides/runtime/gates/page_gates.py \
    scene.json render_dir/ [--report out.json] \
    [--profile executive|pre-read|live-pitch] [--only CODE,CODE]

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
