#!/usr/bin/env python3
"""Golden set by reference image (revamp item 17).

The previous golden set rendered every component at its own `preferredSize`,
audited coverage by comparing `goldenSetSpecs()` to `goldenSetSpecs()`, and
failed if and only if a source byte changed - so it could never fail on a
quality regression, and always failed on a harmless refactor.

This inverts both halves:

* The reference is an accepted PNG under `evals/golden/reference/<id>.png`,
  compared at full 1280x720.
* A source-hash change is not a failure. A pixel regression is.

Two numbers per image, both of which must pass:

* mean absolute difference over all channels, normalised to 0-1, <= 0.02
* foreground mismatch ratio <= 0.12, where foreground is any pixel that is ink
  (luminance < 235) in either image - this is the number that catches text that
  moved, a bar that changed height or a label that disappeared, which a mean
  over a mostly white canvas will not.

    golden_reference.py check  candidates/   [--report out.json]
    golden_reference.py accept candidates/   [--only id,id]
    golden_reference.py list

`check` exits 0 when every candidate matches, 2 on a regression, 1 on a usage
error. A candidate with no reference is reported as `unreferenced`, not as a
pass.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REFERENCE_DIR = ROOT / "evals" / "golden" / "reference"
CANVAS = (1280, 720)
INK_LUMINANCE = 235

MEAN_ABS_MAX = 0.02
FOREGROUND_MISMATCH_MAX = 0.12
# A pixel counts as changed when any channel moves by more than this, out of 255.
CHANNEL_TOLERANCE = 24


def load(path):
    from PIL import Image

    with Image.open(path) as image:
        rgb = image.convert("RGB")
        if rgb.size != CANVAS:
            rgb = rgb.resize(CANVAS, Image.LANCZOS)
        return rgb.copy()


def compare(reference_path, candidate_path):
    """Return the two numbers plus enough context to act on a failure."""
    import numpy as np

    reference = np.asarray(load(reference_path), dtype=np.int16)
    candidate = np.asarray(load(candidate_path), dtype=np.int16)
    difference = np.abs(reference - candidate)
    mean_abs = float(difference.mean() / 255.0)

    def ink(array):
        luminance = (0.299 * array[:, :, 0] + 0.587 * array[:, :, 1] + 0.114 * array[:, :, 2])
        return luminance < INK_LUMINANCE

    foreground = ink(reference) | ink(candidate)
    foreground_pixels = int(foreground.sum())
    changed = (difference.max(axis=2) > CHANNEL_TOLERANCE) & foreground
    mismatch = float(changed.sum() / foreground_pixels) if foreground_pixels else 0.0
    return {
        "meanAbs": round(mean_abs, 5),
        "foregroundMismatch": round(mismatch, 5),
        "foregroundPixels": foreground_pixels,
        "changedPixels": int(changed.sum()),
        "pass": mean_abs <= MEAN_ABS_MAX and mismatch <= FOREGROUND_MISMATCH_MAX,
    }


def candidates(directory):
    return sorted(Path(directory).glob("*.png"))


def check(directory, report_path=None):
    if Path(directory).resolve() == REFERENCE_DIR.resolve():
        raise ValueError("Golden candidates must be rendered separately from references")
    results = []
    for candidate in candidates(directory):
        reference = REFERENCE_DIR / candidate.name
        if not reference.is_file():
            results.append({"id": candidate.stem, "status": "unreferenced",
                            "candidate": str(candidate)})
            continue
        measured = compare(reference, candidate)
        results.append({
            "id": candidate.stem,
            "status": "pass" if measured["pass"] else "regression",
            "candidate": str(candidate),
            "reference": str(reference),
            **measured,
        })
    missing = sorted(
        path.stem for path in REFERENCE_DIR.glob("*.png")
        if not (Path(directory) / path.name).is_file())
    report = {
        "schema": "professional-slides.golden-reference/v1",
        "thresholds": {"meanAbs": MEAN_ABS_MAX, "foregroundMismatch": FOREGROUND_MISMATCH_MAX},
        "referenceDirectory": str(REFERENCE_DIR),
        "candidateDirectory": str(directory),
        "missingCandidates": missing,
        "results": results,
        "accepted": all(item["status"] == "pass" for item in results) and not missing and bool(results),
    }
    if report_path:
        out = Path(report_path)
        tmp = out.with_suffix(out.suffix + ".tmp")
        tmp.write_text(json.dumps(report, indent=1), encoding="utf-8")
        os.replace(tmp, out)
    return report


def accept(directory, only=None):
    REFERENCE_DIR.mkdir(parents=True, exist_ok=True)
    written = []
    for candidate in candidates(directory):
        if only and candidate.stem not in only:
            continue
        target = REFERENCE_DIR / candidate.name
        image = load(candidate)
        image.save(target, optimize=True)
        written.append(target.name)
    return written


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("action", choices=("check", "accept", "list"))
    parser.add_argument("directory", nargs="?", default=None)
    parser.add_argument("--report", default=None)
    parser.add_argument("--only", default=None, help="Comma-separated reference ids")
    parser.add_argument("--accept", action="store_true",
                        help="With `check`, update the references instead of failing")
    args = parser.parse_args(argv)

    if args.action == "list":
        for path in sorted(REFERENCE_DIR.glob("*.png")):
            print(f"{path.stem}\t{path.stat().st_size}")
        return 0

    if not args.directory:
        parser.error("check and accept need a candidate directory")
    only = {item.strip() for item in args.only.split(",")} if args.only else None

    if args.action == "accept" or args.accept:
        written = accept(args.directory, only)
        print(json.dumps({"accepted": written}, indent=1))
        return 0

    report = check(args.directory, args.report)
    if not args.report:
        print(json.dumps(report, indent=1))
    regressions = [r for r in report["results"] if r["status"] != "pass"]
    summary = f"golden: {len(report['results']) - len(regressions)} pass, {len(regressions)} not"
    if report["missingCandidates"]:
        summary += f", {len(report['missingCandidates'])} reference(s) had no candidate"
    print(summary, file=sys.stderr)
    return 0 if report["accepted"] else 2


if __name__ == "__main__":
    sys.exit(main())
