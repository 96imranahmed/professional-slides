"""Shared Node probe for the eval suite.

A test that wants to exercise real geometry runs a small ES module against the
runtime and reads its JSON on stdout. Keeping the helper here (rather than in a
test file other tests import) means deleting a test file never breaks the rest
of the suite.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKILL = ROOT / "skills" / "professional-slides"
RUNTIME = SKILL / "runtime"
REFERENCES = SKILL / "references"
NODE = os.environ.get("RUNTIME_NODE") or shutil.which("node")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def run_node(source: str) -> dict:
    if not NODE:
        raise unittest.SkipTest("Node.js is not available")
    result = subprocess.run(
        [NODE, "--input-type=module", "--eval", source],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "RUNTIME_NODE_MODULES": os.environ.get("RUNTIME_NODE_MODULES", str(ROOT / "node_modules"))},
    )
    if result.returncode:
        raise AssertionError(f"Node probe exited {result.returncode}\n{result.stderr}\n{result.stdout}")
    return json.loads(result.stdout)
