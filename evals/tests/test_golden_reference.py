"""The reference-image golden set (revamp item 17).

The gate that matters: a pixel regression fails, a source change does not. Both
halves are asserted here by mutating an accepted reference and re-checking it.
"""

from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "evals" / "scripts" / "golden_reference.py"
REFERENCE_DIR = ROOT / "evals" / "golden" / "reference"

spec = importlib.util.spec_from_file_location("golden_reference", SCRIPT)
golden = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = golden
spec.loader.exec_module(golden)

try:
    from PIL import Image, ImageDraw
except ImportError:  # pragma: no cover
    Image = None


def requires_pil(test):
    return unittest.skipIf(Image is None, "Pillow is not installed")(test)


class GoldenReferenceTests(unittest.TestCase):
    @requires_pil
    def test_the_seeded_references_are_full_resolution_pages(self):
        references = sorted(REFERENCE_DIR.glob("*.png"))
        self.assertEqual([p.name for p in references],
                         ["slide-15.png", "slide-2.png", "slide-5.png", "slide-6.png"])
        for path in references:
            with Image.open(path) as image:
                self.assertEqual(image.size, (1280, 720), path.name)

    def test_reference_directory_cannot_be_its_own_candidate(self):
        with self.assertRaisesRegex(ValueError, "separately"):
            golden.check(REFERENCE_DIR)

    @requires_pil
    def test_an_unchanged_render_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            for path in REFERENCE_DIR.glob("*.png"):
                shutil.copy(path, Path(tmp) / path.name)
            report = golden.check(tmp)
            self.assertTrue(report["accepted"], json.dumps(report["results"], indent=1))
            for result in report["results"]:
                self.assertEqual(result["meanAbs"], 0.0)
                self.assertEqual(result["foregroundMismatch"], 0.0)

    @requires_pil
    def test_a_pixel_regression_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            for path in REFERENCE_DIR.glob("*.png"):
                shutil.copy(path, Path(tmp) / path.name)
            target = Path(tmp) / "slide-6.png"
            with Image.open(target) as image:
                edited = image.convert("RGB")
            draw = ImageDraw.Draw(edited)
            # Move the content band: exactly the kind of regression a blurred
            # 640x360 thumbnail at an 80% mismatch threshold could not see.
            draw.rectangle([120, 200, 900, 520], fill=(255, 255, 255))
            edited.save(target)
            report = golden.check(tmp)
            self.assertFalse(report["accepted"])
            failed = [r for r in report["results"] if r["status"] == "regression"]
            self.assertEqual([r["id"] for r in failed], ["slide-6"])
            self.assertGreater(failed[0]["foregroundMismatch"],
                               golden.FOREGROUND_MISMATCH_MAX)

    @requires_pil
    def test_a_small_antialiasing_shift_is_tolerated(self):
        with tempfile.TemporaryDirectory() as tmp:
            for path in REFERENCE_DIR.glob("*.png"):
                shutil.copy(path, Path(tmp) / path.name)
            target = Path(tmp) / "slide-2.png"
            with Image.open(target) as image:
                edited = image.convert("RGB").point(lambda value: min(255, value + 6))
            edited.save(target)
            report = golden.check(tmp)
            self.assertTrue(report["accepted"], json.dumps(report["results"], indent=1))

    @requires_pil
    def test_a_missing_reference_is_reported_not_silently_passed(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = next(REFERENCE_DIR.glob("*.png"))
            shutil.copy(source, Path(tmp) / "brand-new-page.png")
            report = golden.check(tmp)
            self.assertFalse(report["accepted"])
            self.assertEqual(report["results"][0]["status"], "unreferenced")
            self.assertEqual(len(report["missingCandidates"]), 4)

    @requires_pil
    def test_accept_writes_a_new_reference_into_a_temporary_root(self):
        original = golden.REFERENCE_DIR
        with tempfile.TemporaryDirectory() as tmp:
            candidates = Path(tmp) / "candidates"
            candidates.mkdir()
            shutil.copy(next(REFERENCE_DIR.glob("*.png")), candidates / "new-page.png")
            golden.REFERENCE_DIR = Path(tmp) / "reference"
            try:
                written = golden.accept(candidates)
                self.assertEqual(written, ["new-page.png"])
                self.assertTrue((golden.REFERENCE_DIR / "new-page.png").is_file())
                self.assertTrue(golden.check(candidates)["accepted"])
            finally:
                golden.REFERENCE_DIR = original

    def test_cli_check_rejects_self_comparison(self):
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "check", str(REFERENCE_DIR)],
            capture_output=True, text=True, cwd=str(ROOT))
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("separately", result.stderr)


if __name__ == "__main__":
    unittest.main()
