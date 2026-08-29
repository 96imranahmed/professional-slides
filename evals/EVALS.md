# Evaluation Flow

Use two related but distinct evaluation loops. A deck can pass self-review
without proving the skill is effective; effectiveness requires a blinded
control-versus-treatment comparison.

## 1. Per-deck self-review

Run this before delivering any deck:

1. Freeze the exact editable artifact and render every slide from that artifact.
2. Collect the blueprint, source ledger, QA ledger, platform readback, individual
   slide renders, and deck montage.
3. Give those materials and [`evaluator-prompt.md`](evaluator-prompt.md) to an
   evaluator with `arm: "self"`.
4. Score every dimension in [`rubric.md`](rubric.md), cite concrete slide-level
   evidence, and record all critical failures.
5. Run `python evals/run_evals.py --mode self --results result.json`.
6. Repair the artifact and repeat from a fresh final render until the gate passes.

Self-review is a delivery safeguard. Do not report its score as causal evidence
that the skill improves deck quality.

## 2. Skill effectiveness evaluation

Run this before publishing a material change to instructions, reference files,
schemas, or generation workflow.

### Generate the paired artifacts

For every enabled case in [`cases.json`](cases.json):

1. Create isolated control and treatment workspaces.
2. Hold the model, runtime, prompt, fixtures, source access, time/token budget,
   and platform route constant.
3. In the control arm, make this skill unavailable. In the treatment arm, load
   this skill normally.
4. Start both arms from fresh context. Do not let either arm inspect the other's
   outputs.
5. Preserve the editable artifact, final renders, generation trace, blueprint,
   source ledger, and QA evidence for each arm.
6. Use exact PowerPoint export renders and native Google Slides renders, not
   intermediate previews.

Cases with `fixture.required: true` must use an authorized fixture matching the
declared role. Never replace a missing reference deck with an invented one;
mark the case skipped with the reason and keep it out of the denominator.

### Evaluate blind

Randomize artifact labels before evaluation so the evaluator cannot infer the
arm. Give the evaluator the brief, approved fixtures, final artifacts/renders,
and supporting evidence—but not the skill instructions, arm names, filenames,
or generation commentary. Use a separate model call or human reviewer when
possible. The generating agent's self-score is not a blind result.

After scoring, restore `control` and `treatment` arm labels in the result JSON
and run:

```bash
python evals/run_evals.py --mode release --results path/to/results.json
```

The release gate passes only when:

- every enabled, runnable case has both arms;
- treatment mean is at least the configured absolute threshold;
- treatment improvement over control meets the configured minimum;
- no treatment result has a critical failure;
- no rubric dimension regresses beyond the allowed tolerance;
- every score includes observable evidence from the final artifact.

## Result package

Store each run outside the skill package unless it is a small, intentionally
curated fixture. A result package contains:

```text
run/
|-- result.json
|-- <case-id>/
|   |-- control/<editable artifact, renders, evidence>
|   `-- treatment/<editable artifact, renders, evidence>
`-- randomized-label-map.json
```

Validate `result.json` against [`result.schema.json`](result.schema.json). The
runner also performs dependency-free structural validation so it can run in a
minimal Python environment.

## Interpreting results

Use the aggregate score to decide whether the change improves the skill. Use
dimension and case deltas to diagnose why. A higher visual score does not
compensate for misleading data, a corrupt artifact, wrong platform, invented
evidence, or a reference-fidelity breach.

Do not tune only to these cases. Add a case when a recurring, generalizable
failure mode is discovered; keep briefs varied enough to test transfer rather
than memorization.
