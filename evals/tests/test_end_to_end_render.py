"""The whole pipeline once, through LibreOffice: spec, scene, PPTX, renders, gates.

Every other test stops short of the renderer or stubs it. This one builds a
shipped example deck the way a user does and checks that what comes out the
far end was measured on its pixels: a PNG per slide, the review sheets, the
saved file read back, and page gates that ran on the renders rather than
skipping them. It takes several seconds and needs LibreOffice and poppler, so
it runs only when asked for: `evals/run.sh --slow`,
`node evals/scripts/run_tests.mjs --slow`, or PS_RUN_SLOW=1.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import HAS_RENDERER, NODE, ROOT, requires_python_package

EXAMPLES = ROOT / "skills" / "professional-slides" / "examples"
BUILD = ROOT / "skills" / "professional-slides" / "runtime" / "build-deck.mjs"
PYTHON = os.environ.get("RUNTIME_PYTHON") or sys.executable


@unittest.skipUnless(os.environ.get("PS_RUN_SLOW") == "1", "opt-in: set PS_RUN_SLOW=1 or pass --slow")
@unittest.skipUnless(NODE and HAS_RENDERER, "needs Node.js, LibreOffice (soffice) and pdftoppm on PATH")
@requires_python_package("pptx", "PIL", "numpy")
class EndToEndRenderTests(unittest.TestCase):
    def test_an_example_deck_is_built_rendered_read_back_and_gated_on_its_pixels(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / "examples"
            shutil.copytree(EXAMPLES / "assets", work / "assets")
            spec = work / "house-style.deck.json"
            shutil.copy(EXAMPLES / "house-style.deck.json", spec)
            out = Path(tmp) / "out"
            env = {**os.environ, "PROFESSIONAL_SLIDES_HOME": str(Path(tmp) / "home"),
                   "RUNTIME_NODE_MODULES": str(ROOT / "node_modules")}
            result = subprocess.run([NODE, str(BUILD), str(spec), str(out), "--python", PYTHON],
                                    cwd=ROOT, capture_output=True, text=True, env=env, timeout=600)
            # 2 is a deck built with findings; the pipeline still ran end to end.
            self.assertIn(result.returncode, (0, 2), result.stderr[-1500:])
            build = json.loads((out / "build-result.json").read_text())
            self.assertTrue(build["status"].startswith("built"), build["status"])
            self.assertNotEqual(build["status"], "built-unrendered")
            scene = json.loads((out / "scene.json").read_text())
            rendered = out / "rendered"
            slides = sorted(rendered.glob("slide-*.png"))
            self.assertEqual(len(slides), len(scene["slides"]), "a PNG per slide")
            self.assertTrue((rendered / "montage.png").is_file())
            self.assertTrue(list(rendered.glob("spread-*.png")), "the review sheets")
            self.assertTrue(list(out.glob("*.pptx")))
            self.assertTrue(build["readback"], "the saved file was read back")
            gates = json.loads((out / "gates.json").read_text())
            self.assertFalse(gates.get("pixelGatesSkipped"), "the page gates measured the renders")


if __name__ == "__main__":
    unittest.main()
