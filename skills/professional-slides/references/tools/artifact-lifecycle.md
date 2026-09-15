# Artifact lifecycle

The installed plugin contains reusable code and guidance only. It is read-only during user work. Import the canonical runtime using its resolved skill path; resolve user inputs and outputs from the task workspace, never relative to the plugin directory.

Use one `output/<task>/` root. Keep the final deck and its exact acceptance evidence there, with `data/` for the compact source extract and calculations, `rendered/` for the current saved-file renders, and `scratch/` only for temporary intermediates. A user-specified destination takes precedence, but must still be outside the installed plugin. Do not create duplicate `tmp/`, `deliverables/`, and `renders/` roots.

Retain the latest deliverable, rebuild script and required inputs, source provenance, and reports bound to its exact hash. After successful completion, remove task-owned intermediate renders, superseded candidates and large raw downloads when the retained extract and source record are sufficient for the agreed reproducibility need. Preserve unique source documents, user files and requested history. Never delete another task’s files as automatic cleanup. A moved file invalidates path-dependent receipts; preserve or regenerate those records rather than declaring stale evidence current.

## Source review and cached evidence

Original-document analysis uses the same task-owned output root without creating a deck or a parallel deliverables tree. Keep the source register and unique original files, cached extracts/OCR, necessary original-page images and review findings together. Follow [source evidence](../storylining/source-evidence.md) for identity, aliases, extracts, native numbering, review scope and access limitations. Acquisition logs and one-off corpus scripts are task artifacts, not installed skill content.

Separate immutable evidence from interpretation. Key an extraction cache by the exact source hash, actual format, extraction method/version, page system and covered ranges. Key a review disposition by that evidence plus the authorized scope and relevant review-policy version. Changed wording in a proposal does not require downloading or OCRing unchanged originals again; a different source version, extraction failure or missing range does.

Retain original-source bytes when reproducibility, visual evidence or requested history depends on them; text alone does not preserve source hierarchy. Preserve rejected or provisional identity candidates separately and exclude them from verified coverage. An alias can point to a retained exact file without duplicating the bytes. A derived page image or extract records its parent hash and range and must never replace the parent silently.

Batch related review findings and implementation changes. Reuse valid cached evidence, record which checks apply to the batch, and rerun only for changed inputs, failures or concrete unresolved concerns. An original-only review does not require recreated slides, per-source-slide model calls or a full golden run. For an actual generated or modified artifact, retain the exact artifact-bound validation evidence required by [evaluation](../evaluation/index.md#choose-the-evaluation-mode); cached source review is not artifact acceptance.

## Plugin installation and developer outputs

Run plugin Python validators with `PYTHONDONTWRITEBYTECODE=1` so imports do not create cache files inside the installation.

Installing must not execute rendering, download research, generate fixtures, or run evaluations. Developers build an allowlisted package with `evals/scripts/package_plugin.py`; install that directory, not the working checkout. The package contains no generated output, scratch, deliverables, dependencies, Git history or personal project configuration. Full golden runs are developer checks, not required work for someone creating a deck. Developer runs use `output/golden/`; release staging uses `output/package/`.
