#!/usr/bin/env bash
# Run the eval suite.
#
#   evals/run.sh            unit tests + the deterministic page gates
#   evals/run.sh --slow     also the LibreOffice end-to-end render
#   evals/run.sh --golden   only the reference-image golden check
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
  --golden)
    exec "$PYTHON" evals/scripts/check_release.py
    ;;
  --slow)
    export PS_RUN_SLOW=1
    ;;
esac

suite_status=0
echo "== unit tests =="
"$PYTHON" -m unittest discover -s evals/tests -p "test_*.py" || suite_status=$?

echo "== page gates (fixture deck) =="
# The audited fixture deck is expected to fail; this prints the counts so a
# change in the runtime shows up as a change in the numbers.
"$PYTHON" skills/professional-slides/runtime/gates/page_gates.py \
  evals/fixtures/scene-nyc.json.gz evals/golden/reference \
  --report /tmp/page-gates-fixture.json || true
"$PYTHON" - <<'PY'
import json
report = json.load(open("/tmp/page-gates-fixture.json"))
for code, count in report["countsByCode"].items():
    print(f"  {code:18} {count}")
PY

echo "== golden reference =="
"$PYTHON" evals/scripts/check_release.py >/dev/null

echo "== node-side gates =="
"$NODE" evals/scripts/check_source_quality.mjs

exit "$suite_status"
