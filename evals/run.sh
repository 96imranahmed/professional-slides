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
print("%s | %d pages, %d%% measured, kinds %s"
      % (state, r["pages"], round(100 * r["statistics"]["measured"]), kinds))
' || true
done
[ "$found" = 1 ] || echo "  none: no example deck carries its content stage"

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

echo "== cold-run baseline =="
# The same harness a cold run is scored with, pointed at the example decks. It
# prints rather than fails: where a hand-authored deck misses a bar that is a
# finding about the deck, and the number moving is the thing to notice.
for deck in gallery-acceptance house-style nyc-or-sf slideworks; do
  if [ -d "/tmp/ps-build-$deck" ]; then
    printf '  %-20s ' "$deck"
    # `|| true`: the scorer exits 2 on a deck that misses a bar, and under
    # `set -e` with pipefail that would end the run at the first one - which is
    # exactly the deck worth printing.
    { "$NODE" evals/cold-run/score.mjs - "/tmp/ps-build-$deck" 2>/dev/null || true; } | sed -n 's/^ *\(pass\|FAIL\) *\([a-zA-Z]*\) *\([0-9.]*\).*/\2=\3/p' | tr '\n' ' '
    echo
  fi
done
[ -d /tmp/ps-build-gallery-acceptance ] || echo "  (build the example decks into /tmp/ps-build-<name> to populate this)"

echo "== against the corpus =="
# The question no gate answers: by how much, and in which direction. Same
# instrument pointed at our decks and at the client-work numbers in the
# contract. SKILL.md used to carry an "Ours today" column measured a different
# way; it rotted and was deleted. This does not rot, because it is computed.
built=""
for deck in gallery-acceptance house-style nyc-or-sf slideworks; do
  [ -f "/tmp/ps-build-$deck/scene.json" ] && built="$built /tmp/ps-build-$deck"
done
if [ -n "$built" ]; then
  "$NODE" evals/corpus/compare.mjs $built || true
else
  echo "  (build the example decks into /tmp/ps-build-<name> to populate this)"
fi

echo "== golden reference =="
"$PYTHON" evals/scripts/check_release.py >/dev/null

echo "== node-side gates =="
"$NODE" evals/scripts/check_source_quality.mjs

exit "$suite_status"
