#!/usr/bin/env bash
# Run the eval suite.
#
#   evals/run.sh            unit tests, the example decks' content stage and
#                           build bars, the stored specimens, gate validity
#   evals/run.sh --slow     also the LibreOffice end-to-end render
#                           (PS_RUN_SLOW=1, read by test_end_to_end_render.py)
#
# Everything here is vendor-neutral: python3 with Pillow, numpy and python-pptx,
# plus node and Playwright Chromium for the rendered geometry probes.
set -euo pipefail
cd "$(dirname "$0")/.."

PYTHON="${RUNTIME_PYTHON:-$(command -v python3)}"
NODE="${RUNTIME_NODE:-$(command -v node)}"
# Use explicitly configured interpreters or the executables on PATH.
export RUNTIME_PYTHON="$PYTHON" RUNTIME_NODE="$NODE"
export RUNTIME_NODE_MODULES="${RUNTIME_NODE_MODULES:-$PWD/node_modules}"

case "${1:-}" in
  --slow)
    export PS_RUN_SLOW=1
    ;;
esac

echo "== unit tests =="
suite_status=0
"$PYTHON" -m unittest discover -s evals/tests -p "test_*.py" || suite_status=$?

echo "== content stage (example plans) =="
# The stage that decides whether a deck measures anything, run over whatever
# example decks carry one. `plan_gates.mjs` and `content_gates.mjs` spent weeks
# wired into nothing: a grep for either returned one hit, a sentence in a
# reference document, while the deck they would have caught reached a reader.
found=0
for plan in skills/professional-slides/examples/*.content.json; do
  [ -e "$plan" ] || continue
  found=1
  printf '  %-28s ' "$(basename "$plan")"
  "$NODE" skills/professional-slides/runtime/gates/content_gates.mjs "$plan" --json \
    | "$PYTHON" -c '
import json, sys
r = json.load(sys.stdin)
kinds = ",".join(f"{n}:{c}" for n, c in r["statistics"]["kinds"].items() if c)
state = "accepted" if r["accepted"] else "REJECTED " + ",".join(r["countsByCode"])
print("%s | %d pages, %d%% quantitative kinds, %d%% structured kinds, kinds %s"
      % (state, r["pages"], round(100 * r["statistics"]["quantitativeKindShare"]),
         round(100 * r["statistics"]["structuredKindShare"]), kinds))
' || true
done
[ "$found" = 1 ] || echo "  none: no example deck carries its content stage"

echo "== cold-run baseline =="
# The same harness a cold run is scored with, pointed at the example decks,
# compiled in-process so nothing has to be built first. It prints rather than
# fails: where a hand-authored deck misses a bar that is a finding about the
# deck, and the number moving is the thing to notice.
"$NODE" evals/cold-run/baseline.mjs || true

echo "== stored specimens =="
# Recorded runs scored again under today's rules; test_cold_run.py holds the
# expected verdicts, this prints where each stands.
"$NODE" evals/cold-run/specimens.mjs || true

echo "== gate validity =="
# Per-gate recall and precision against the defects people found on the
# specimens (evals/quality/defects.json).
"$NODE" evals/quality/gate-validity.mjs || true

echo "== node-side gates =="
"$NODE" evals/scripts/check_source_quality.mjs

exit "$suite_status"
