"""The saved file is a function of its scene, and its labels read on their marks.

The review binds itself to the .pptx's hash. Two builds of one scene wrote
byte-identical scene.json and different files: python-pptx stamps every zip
entry with the clock and writes each native chart's workbook through
XlsxWriter, which stamps its creation date, so every review was void for the
next build of the same deck.

And a stacked segment's label took white wherever the fill's luminance fell
under 0.45 - white at 2.3:1 on a green where ink reads at 9:1 - while the pie
beside it, and the scene, chose whichever of the two reads better.
"""
from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import time
import unittest
import zipfile
from pathlib import Path

from node_probe import requires_python_package, run_node

ROOT = Path(__file__).resolve().parents[2]
EMIT = ROOT / "skills" / "professional-slides" / "runtime" / "emit"
sys.path.insert(0, str(EMIT))


def chart_scene():
    """One slide with a native stacked chart and a freeform, the parts that stamp dates and cost time."""
    return json.loads(run_node('''
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
const spec = { schema: 'professional-slides.deck/v3', id: 'det', cover: { title: 'Determinism' }, slides: [
  { id: 's1', title: 'Segments stack to the whole in every year', exhibit: { type: 'chart.stacked-column', categories: ['2022', '2023', '2024'],
    series: [{ name: 'A', values: [3, 4, 5] }, { name: 'B', values: [2, 2, 3] }] } },
  { id: 's2', title: 'A second chart keeps the workbook count honest', exhibit: { type: 'chart.column', categories: ['A', 'B', 'C', 'D'],
    series: [{ name: 'x', values: [4, 3, 2, 1] }] } }] };
console.log(JSON.stringify(JSON.stringify(composeAll(spec, process.cwd()).deck)));
'''))


@requires_python_package("pptx")
class DeterministicEmitTests(unittest.TestCase):
    def test_two_builds_of_one_scene_write_the_same_bytes(self):
        from emit_pptx import Emitter
        scene = chart_scene()
        with tempfile.TemporaryDirectory() as tmp:
            first, second = Path(tmp) / "a.pptx", Path(tmp) / "b.pptx"
            Emitter(json.loads(json.dumps(scene))).run(first)
            # A zip records time to two seconds; wait past a tick so the clock
            # would show if anything still read it.
            time.sleep(2.1)
            Emitter(json.loads(json.dumps(scene))).run(second)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with zipfile.ZipFile(first) as package:
                workbooks = [n for n in package.namelist() if n.startswith("ppt/embeddings/") and n.endswith(".xlsx")]
                self.assertTrue(workbooks, "the scene carries native charts")
                self.assertEqual({info.date_time for info in package.infolist()}, {(1980, 1, 1, 0, 0, 0)})
                self.assertIn(b"1980-01-01T00:00:00Z", package.read("docProps/core.xml"))
                with zipfile.ZipFile(io.BytesIO(package.read(workbooks[0]))) as book:
                    self.assertIn(b"1980-01-01T00:00:00Z", book.read("docProps/core.xml"))
                    self.assertEqual({info.date_time for info in book.infolist()}, {(1980, 1, 1, 0, 0, 0)})

    def test_the_file_still_opens_as_a_deck_with_its_charts(self):
        from emit_pptx import Emitter
        from pptx import Presentation
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "a.pptx"
            Emitter(chart_scene()).run(path)
            deck = Presentation(str(path))
            charts = [shape for slide in deck.slides for shape in slide.shapes if getattr(shape, "has_chart", False)]
            self.assertEqual(len(charts), 2)
            self.assertEqual(len(list(charts[0].chart.plots[0].series)), 2)


@requires_python_package("pptx")
class OnFillParityTests(unittest.TestCase):
    def test_the_emitter_sets_labels_as_the_scene_does_on_every_palette_colour(self):
        from emit_pptx import on_fill
        result = run_node('''
import { onFill, tokenValue, TOKENS, THEME_SLOT_TOKENS } from './skills/professional-slides/runtime/core.mjs';
import { PALETTES, resolvePalette } from './skills/professional-slides/runtime/palettes.mjs';
import { DESIGN_SYSTEMS } from './skills/professional-slides/runtime/design-systems.mjs';
import { withDesignTokens } from './skills/professional-slides/runtime/design-context.mjs';
const hex = (v) => typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v);
const cases = [];
const collect = (tokens, colors, source) => withDesignTokens(tokens, () => {
  const on = tokenValue('color.onPrimary'), ink = tokenValue('color.ink');
  for (const [key, value] of Object.entries(colors)) if (key.startsWith('color.') && hex(value))
    cases.push({ source, key, fill: value, on, ink, chosen: tokenValue(onFill(value)) });
});
for (const id of Object.keys(PALETTES)) { const tokens = resolvePalette(id, TOKENS, THEME_SLOT_TOKENS).tokens; collect(tokens, Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, v.value])), id); }
const walk = (value, out) => { if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { if (k.startsWith('color.') && hex(v)) out[k] = v; else walk(v, out); } return out; };
for (const [name, system] of Object.entries(DESIGN_SYSTEMS)) {
  const colors = walk(system, {});
  const tokens = { ...TOKENS, ...Object.fromEntries(Object.entries(colors).filter(([k]) => TOKENS[k]).map(([k, v]) => [k, { ...TOKENS[k], value: v }])) };
  collect(tokens, colors, name);
}
console.log(JSON.stringify(cases));
''')
        self.assertGreater(len(result), 60)
        mismatched = [c for c in result if on_fill(c["fill"], c["on"], c["ink"]).upper() != c["chosen"].upper()]
        self.assertEqual(mismatched, [])

    def test_a_mid_tone_fill_takes_the_ink(self):
        from color import contrast, on_fill
        # The accent green that took white at 2.3:1 under the luminance cut.
        self.assertEqual(on_fill("#86BC25", "#FFFFFF", "#000000"), "#000000")
        self.assertGreater(contrast("#86BC25", "#000000"), 9)
        self.assertLess(contrast("#86BC25", "#FFFFFF"), 2.5)
        self.assertEqual(on_fill("#051C2C", "#FFFFFF", "#051C2C"), "#FFFFFF")

    def test_one_rule_serves_both_label_sites(self):
        source = (EMIT / "emit_pptx.py").read_text(encoding="utf-8")
        self.assertNotIn("< 0.45", source)
        self.assertEqual(source.count("on_fill("), 2)  # the stacked segments and the pie slices
        import color
        import emit_pptx
        self.assertIs(emit_pptx.on_fill, color.on_fill)  # one definition (color.py)


@requires_python_package("pptx")
class FreeformTests(unittest.TestCase):
    def test_a_cached_offset_draws_the_same_path(self):
        from emit_pptx import CachedFreeform
        from pptx import Presentation
        from pptx.shapes.freeform import FreeformBuilder
        from pptx.util import Emu
        points = [(Emu(1000 + (i * 37) % 900), Emu(2000 + (i * 53) % 700)) for i in range(400)]

        def draw(builder_class):
            deck = Presentation()
            slide = deck.slides.add_slide(deck.slide_layouts[6])
            builder = builder_class.new(slide.shapes, points[0][0], points[0][1], 1.0, 1.0)
            builder.add_line_segments(points[1:], close=True)
            shape = builder.convert_to_shape(0, 0)
            return (shape.left, shape.top, shape.width, shape.height), shape._element.xml.split("<a:custGeom>")[1]

        self.assertEqual(draw(CachedFreeform), draw(FreeformBuilder))


if __name__ == "__main__":
    unittest.main()
