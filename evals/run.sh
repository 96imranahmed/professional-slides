#!/usr/bin/env bash
# Run the eval suite.
#
#   evals/run.sh            unit tests, the worked examples' compile and the
#                           node-side source checks
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

echo "== worked examples compile =="
# The worked pages are what --example and --scaffold print: each must compile as it stands.
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cp -R skills/professional-slides/examples/assets "$work/"
for pages in skills/professional-slides/examples/*.pages.json; do
  cp "$pages" "$work/"
  printf '  %-28s ' "$(basename "$pages")"
  if "$NODE" skills/professional-slides/runtime/author-deck.mjs "$work/$(basename "$pages")" --check >/dev/null 2>"$work/check.txt"; then echo "compiles"; else echo "REFUSED"; suite_status=1; tail -20 "$work/check.txt"; fi
done

echo "== node-side gates =="
"$NODE" evals/scripts/check_source_quality.mjs

echo "== chart stress =="
# Every chart kind drawn under awkward inputs; a crash, broken geometry or a finding count past the baseline fails.
"$NODE" evals/scripts/chart_stress.mjs || suite_status=1

exit "$suite_status"
