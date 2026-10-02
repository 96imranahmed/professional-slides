"""Where the calibration set lives, and the constants shared with the page gates.

The set is a folder of third-party decks that never enters this repository.
Every tool here reads its location from `PS_CALIBRATION_CORPUS`, and nothing a
tool writes into the repository names a document from it: the runtime keeps
numbers only (runtime/reading-tasks.json, runtime/weight.json).
"""
from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGE_GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates" / "page_gates.py"
ENV = "PS_CALIBRATION_CORPUS"


def corpus_root() -> Path:
    """The calibration set's root, from the environment, or a clear exit."""
    value = os.environ.get(ENV)
    if not value:
        sys.exit(f"Set {ENV} to the calibration set's root (see evals/calibration/README.md).")
    root = Path(value).expanduser()
    if not root.is_dir():
        sys.exit(f"{ENV}={value} is not a directory.")
    return root


def gate_constants():
    """The page gates' own token pattern and canvas, so a corpus count and a
    gate count mean the same thing without a copy that can drift."""
    gates_dir = str(PAGE_GATES.parent)
    if gates_dir not in sys.path:
        sys.path.insert(0, gates_dir)
    spec = importlib.util.spec_from_file_location("page_gates_for_calibration", PAGE_GATES)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    ink = sys.modules.get("ink") or importlib.import_module("ink")
    return {
        "NUMERIC_TOKEN": module.NUMERIC_TOKEN,
        "FOOTER_TOP": module.FOOTER_TOP,
        "BODY_TOP": module.VOID_TOP,
        "CANVAS_W": ink.CANVAS_W,
        "CANVAS_H": ink.CANVAS_H,
        "INK_LUMINANCE": ink.INK_LUMINANCE,
        "SURFACE_LUMINANCE": ink.SURFACE_LUMINANCE,
    }
