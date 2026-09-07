# Artifact lifecycle

The installed plugin contains reusable code and guidance only. It is read-only during user work. Import the canonical runtime using its resolved skill path; resolve user inputs and outputs from the task workspace, never relative to the plugin directory.

Use one `output/<task>/` root. Keep the final deck and its exact acceptance evidence there, with `data/` for the compact source extract and calculations, `rendered/` for the current saved-file renders, and `scratch/` only for temporary intermediates. A user-specified destination takes precedence, but must still be outside the installed plugin. Do not create duplicate `tmp/`, `deliverables/`, and `renders/` roots.

Retain the latest deliverable, rebuild script and required inputs, source provenance, and reports bound to its exact hash. After successful completion, remove task-owned intermediate renders, superseded candidates and large raw downloads when the retained extract and source record are sufficient for the agreed reproducibility need. Preserve unique source documents, user files and requested history. Never delete another task’s files as automatic cleanup. A moved file invalidates path-dependent receipts; preserve or regenerate those records rather than declaring stale evidence current.

Run plugin Python validators with `PYTHONDONTWRITEBYTECODE=1` so imports do not create cache files inside the installation.

Installing must not execute rendering, download research, generate fixtures, or run evaluations. Developers build an allowlisted package with `evals/scripts/package_plugin.py`; install that directory, not the working checkout. The package contains no generated output, scratch, deliverables, dependencies, Git history or personal project configuration. Full golden runs are developer checks, not required work for someone creating a deck. Developer runs use `output/golden/`; release staging uses `output/package/`.
