"""WCAG luminance and contrast, one definition in Python, held to the scene's.

The scene picks a label's colour on a fill with palettes.mjs `contrastRatio`
and core.mjs `onFill`; the emitter sets the native chart's labels and the
template importer judges a house's colours with runtime/emit/color.py. A
second Python copy once read the sRGB knee at 0.03928 where the scene reads
0.04045, so one module serves both, and these tests hold it to the
JavaScript bit for bit.
"""

from __future__ import annotations

import json
import os
import random
import sys
import unittest

from node_probe import RUNTIME, run_node

sys.path.insert(0, str(RUNTIME / "emit"))

import color  # noqa: E402


def colours(count=1500, seed=20260929):
    rng = random.Random(seed)
    fixed = ["#000000", "#FFFFFF", "#86BC25", "#051C2C", "#929BA3", "#0A0A0A", "#0B0B0B", "#808080", "#FF0000", "#00FF00", "#0000FF"]
    greys = [f"#{n:02X}{n:02X}{n:02X}" for n in range(256)]
    return fixed + greys + [f"#{rng.randrange(1 << 24):06X}" for _ in range(count)]


class ContrastParityTests(unittest.TestCase):
    def test_contrast_and_the_label_on_a_fill_match_the_scene(self):
        fills = colours()
        os.environ["COLOR_PARITY_FILLS"] = json.dumps(fills)
        result = run_node("""
import {contrastRatio} from './skills/professional-slides/runtime/palettes.mjs';
import {onFill, tokenValue, TOKENS} from './skills/professional-slides/runtime/core.mjs';
import {withDesignTokens} from './skills/professional-slides/runtime/design-context.mjs';
const fills = JSON.parse(process.env.COLOR_PARITY_FILLS);
const on = '#FFFFFF', ink = '#051C2C';
const tokens = {...TOKENS, 'color.onPrimary': {...TOKENS['color.onPrimary'], value: on}, 'color.ink': {...TOKENS['color.ink'], value: ink}};
const chosen = withDesignTokens(tokens, () => fills.map((fill) => tokenValue(onFill(fill))));
console.log(JSON.stringify({
  white: fills.map((fill) => contrastRatio(fill, '#FFFFFF')),
  black: fills.map((fill) => contrastRatio(fill, '#000000')),
  pairs: fills.slice(1).map((fill, i) => contrastRatio(fill, fills[i])),
  chosen, on, ink,
}));
""")
        self.assertEqual(result["white"], [color.contrast(f, "#FFFFFF") for f in fills])
        self.assertEqual(result["black"], [color.contrast(f, "#000000") for f in fills])
        self.assertEqual(result["pairs"], [color.contrast(f, fills[i]) for i, f in enumerate(fills[1:])])
        self.assertEqual([c.upper() for c in result["chosen"]],
                         [color.on_fill(f, result["on"], result["ink"]).upper() for f in fills])

    def test_luminance_reads_the_scene_knee_and_both_spellings(self):
        # 8-bit channels put nothing between the two knees in use (0.03928 and
        # 0.04045), so the knee is checked on the channel itself.
        self.assertEqual(color.channel(0.04045), 0.04045 / 12.92)
        self.assertGreater(color.channel(0.0405), 0.0405 / 12.92)
        self.assertEqual(color.luminance("#86BC25"), color.luminance("86BC25"))
        self.assertEqual(color.luminance("#FFFFFF"), 1.0)
        self.assertEqual(color.luminance("#000000"), 0.0)
        self.assertEqual(color.luminance("not a colour"), 1.0)

    def test_the_emitter_and_the_importer_share_the_module(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("import_template_colour", RUNTIME / "import-template.py")
        try:
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
        except (ImportError, SystemExit):
            self.skipTest("python-pptx is not installed")
        self.assertIs(module.luminance, color.luminance)
        self.assertIs(module.contrast, color.contrast)
        # The emitter's label colour is the module's rule, not a copy of it.
        import emit_pptx
        self.assertIs(emit_pptx.on_fill, color.on_fill)
        for name in ("luminance", "channel", "contrast"):
            self.assertIs(getattr(emit_pptx, name, getattr(color, name)), getattr(color, name), name)


if __name__ == "__main__":
    unittest.main()
