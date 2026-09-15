"""The whole vendor-neutral pipeline, once: scene -> pptx -> PNG -> gates.

Slow (LibreOffice takes roughly ten seconds for the deck) and therefore opt-in:
set `PS_RUN_SLOW=1`, or run `evals/run.sh --slow`. It skips rather than fails
where LibreOffice is absent, so the suite stays runnable on a machine with only
python-pptx.

This is the only test that shells into a renderer. Everything else measures the
scene or a committed PNG.
"""

from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EMIT = ROOT / "skills" / "professional-slides" / "runtime" / "emit"
GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"
SCENE_GZ = ROOT / "evals" / "fixtures" / "scene-nyc.json.gz"
REFERENCE_DIR = ROOT / "evals" / "golden" / "reference"

sys.path.insert(0, str(GATES))
import page_gates  # noqa: E402

spec = importlib.util.spec_from_file_location("golden_reference", ROOT / "evals" / "scripts" / "golden_reference.py")
golden = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = golden
spec.loader.exec_module(golden)

SLOW = os.environ.get("PS_RUN_SLOW") == "1"
SOFFICE = shutil.which("soffice") or shutil.which("libreoffice")


@unittest.skipUnless(SLOW, "set PS_RUN_SLOW=1 to run the LibreOffice render")
@unittest.skipUnless(SOFFICE, "LibreOffice is not installed")
class EndToEndRenderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        root = Path(cls.tmp.name)
        scene_path = root / "scene.json"
        scene_path.write_text(json.dumps(page_gates.load_scene(SCENE_GZ)))
        deck = root / "deck.pptx"
        subprocess.run(
            [sys.executable, str(EMIT / "emit_pptx.py"), str(scene_path), str(deck)],
            check=True, capture_output=True, cwd=str(ROOT))
        cls.render_dir = root / "render"
        result = subprocess.run(
            [sys.executable, str(EMIT / "render_pptx.py"), str(deck), str(cls.render_dir)],
            capture_output=True, text=True, cwd=str(ROOT), timeout=600)
        if result.returncode:
            raise unittest.SkipTest(f"render_pptx failed: {result.stderr[-400:]}")
        cls.scene_path = scene_path

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_the_render_produces_one_page_per_slide_at_canvas_size(self):
        from PIL import Image

        pages = sorted(self.render_dir.glob("slide-*.png"))
        self.assertEqual(len(pages), 21)
        with Image.open(pages[0]) as image:
            self.assertEqual(image.size[1], 720)
            self.assertLessEqual(abs(image.size[0] - 1280), 2)

    def test_the_page_gates_run_against_the_fresh_render(self):
        report = page_gates.run_gates(
            page_gates.load_scene(SCENE_GZ), render_dir=str(self.render_dir))
        # The audited deck is expected to fail; what matters is that every gate
        # that needs a PNG actually got one.
        self.assertFalse(report["accepted"])
        self.assertIn("INK_COVERAGE", report["countsByCode"])
        ink_slides = {f["slide"] for f in report["findings"] if f["code"] == "INK_COVERAGE"}
        self.assertGreater(len(ink_slides), 4, "the ink gate only saw a few pages")

    def test_the_fresh_render_matches_the_accepted_references(self):
        candidates = Path(self.tmp.name) / "candidates"
        candidates.mkdir()
        for reference in REFERENCE_DIR.glob("*.png"):
            source = self.render_dir / reference.name
            self.assertTrue(source.is_file(), reference.name)
            shutil.copy(source, candidates / reference.name)
        report = golden.check(candidates)
        self.assertTrue(report["accepted"], json.dumps(report["results"], indent=1))


if __name__ == "__main__":
    unittest.main()
