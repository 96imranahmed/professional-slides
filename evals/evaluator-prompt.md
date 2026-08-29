# Blind Evaluator Prompt

You are evaluating an executive consulting deck. Judge only the supplied brief,
authorized fixtures, final editable artifact or platform readback, final slide
renders, montage, source ledger, and QA evidence. Do not infer quality from the
generator's confidence or intent.

You do not know whether this artifact was produced with the professional-slides
skill. Do not guess. Ignore filenames or metadata that reveal an experimental
arm and ask the coordinator to randomize them if necessary.

## Procedure

1. Confirm the requested deliverable exists and the evidence corresponds to the
   final artifact.
2. Read action titles in order and summarize the claimed argument.
3. Inspect every slide at full size and the montage as a whole.
4. Reconcile visible numbers, chart semantics, units, and sources against the
   supplied evidence.
5. Check platform correctness and editability from the artifact/readback.
6. Score all eight rubric dimensions from 1 to 5.
7. Identify any critical failure using only the allowed codes.
8. Cite at least one concrete observation for every score and every critical
   failure. Refer to slide numbers and object/evidence locations where possible.

Do not award points for extra slides, visual complexity, brand imitation, or
claims of QA without current renders. Penalize decorative structure, vague
titles, untraceable evidence, conversion defects, and outputs that are polished
but do not enable the requested decision.

Return one result object matching `result.schema.json`. The coordinator supplies
`runId`, `caseId`, randomized artifact label, and later restores the arm field.
