"""One process of the parallel eval runner (run_tests.mjs).

Reads test module names on stdin, one per line, runs each module's tests in
this process, and writes one JSON line per module to the file descriptor named
by PS_RESULT_FD (default 3). Results go to their own descriptor because tests
print, and some spawn children that inherit stdout; nothing a test writes can
be mistaken for a result.

Each worker process keeps its own warm Node probe worker (node_probe.py holds
it in module state), so N workers means N independent Node processes.
"""
from __future__ import annotations

import io
import json
import os
import sys
import time
import traceback
import unittest
from pathlib import Path

TESTS = Path(__file__).resolve().parents[1] / "tests"


def reset_gate_state() -> None:
    """Start each module from the page gates' defaults, as its own process would.

    `page_gates.run_gates` configures the module for the deck it reads (its
    fill, its weight, the rules it predates) and leaves it so; a module that
    ran an airy deck left the next module in this process measuring against
    airy floors, and a test of the balanced floor failed one run in several.
    """
    gates = sys.modules.get("page_gates")
    if gates is not None:
        gates.configure()
        gates.configure_rules()


def run_module(name: str) -> dict:
    reset_gate_state()
    started = time.perf_counter()
    stream = io.StringIO()
    try:
        suite = unittest.defaultTestLoader.loadTestsFromName(name)
    except Exception:  # an import error is the module's failure, not the runner's
        return {"module": name, "testsRun": 0, "failures": [],
                "errors": [{"id": name, "traceback": traceback.format_exc()}], "skipped": [],
                "expectedFailures": 0, "unexpectedSuccesses": [], "seconds": round(time.perf_counter() - started, 3)}
    result = unittest.TextTestRunner(stream=stream, verbosity=0).run(suite)
    return {
        "module": name,
        "testsRun": result.testsRun,
        "failures": [{"id": test.id(), "traceback": text} for test, text in result.failures],
        "errors": [{"id": test.id() if hasattr(test, "id") else str(test), "traceback": text} for test, text in result.errors],
        "skipped": [{"id": test.id() if hasattr(test, "id") else str(test), "reason": reason} for test, reason in result.skipped],
        "expectedFailures": len(result.expectedFailures),
        "unexpectedSuccesses": [test.id() for test in result.unexpectedSuccesses],
        "seconds": round(time.perf_counter() - started, 3),
    }


def main() -> int:
    sys.path.insert(0, str(TESTS))
    os.chdir(TESTS.parents[1])
    channel = os.fdopen(int(os.environ.get("PS_RESULT_FD", "3")), "w", buffering=1, encoding="utf-8")
    for line in sys.stdin:
        name = line.strip()
        if name:
            channel.write(json.dumps(run_module(name)) + "\n")
            channel.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
