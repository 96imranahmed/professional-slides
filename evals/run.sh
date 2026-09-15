#!/usr/bin/env bash
# Run the eval suite.
#
#   evals/run.sh            unit tests + the deterministic page gates
#   evals/run.sh --slow     also the LibreOffice end-to-end render
#   evals/run.sh --golden   only the reference-image golden check
#
# Everything here is vendor-neutral: python3 with Pillow, numpy and python-pptx,
# plus node for the geometry probes. No Chromium, no Codex runtime.
set -euo pipefail
cd "$(dirname "$0")/.."

PYTHON="${RUNTIME_PYTHON:-$(command -v python3)}"
NODE="${RUNTIME_NODE:-$(command -v node)}"
# Several node-side gates call configureRuntime(), which throws when the Codex
# runtime cache is absent. Point it at whatever is on PATH.
export RUNTIME_PYTHON="$PYTHON" RUNTIME_NODE="$NODE"
if [ -z "${RUNTIME_NODE_MODULES:-}" ]; then
  node_root="$(dirname "$(dirname "$NODE")")"
  for candidate in "$node_root/lib/node_modules" "$node_root/node_modules"; do
    [ -d "$candidate" ] && RUNTIME_NODE_MODULES="$candidate" && break
  done
fi
export RUNTIME_NODE_MODULES="${RUNTIME_NODE_MODULES:-}"

case "${1:-}" in
  --golden)
    exec "$PYTHON" evals/scripts/golden_reference.py check evals/golden/reference
    ;;
  --slow)
    export PS_RUN_SLOW=1
    ;;
esac

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
"$PYTHON" evals/scripts/golden_reference.py check evals/golden/reference >/dev/null

echo "== node-side gates =="
"$NODE" evals/scripts/check_source_quality.mjs

exit "$suite_status"
