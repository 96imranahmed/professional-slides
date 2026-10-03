"""A template deck becomes a house profile (runtime/import-template.py) and a
deck spec applies it through `template`: palette overlay, chrome margins,
typography and density, with explicit spec fields still winning."""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import ROOT, RUNTIME, NODE, run_node, requires_python_package

SKILL = ROOT / "skills" / "professional-slides"

# python-pptx is optional at test time (see requirements.txt); the importer
# imports it itself, so it is loaded only when present and its class skips otherwise.
try:
    import importlib.util
    from pptx import Presentation
    from pptx.util import Inches
    _spec = importlib.util.spec_from_file_location('template_importer', RUNTIME / 'import-template.py')
    importer = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(importer)
except ImportError:  # pragma: no cover - exercised only without python-pptx
    Presentation = Inches = importer = None


@requires_python_package('pptx')
class TemplateImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        # Build a small evergreen deck, then read it back as a template.
        # A small probe deck: two pages, deliberately light, so the importer has
        # to measure a sparse house rather than assume ours.
        spec = {"schema": "professional-slides.deck/v3", "id": "tpl", "palette": "evergreen", "footer": "House test", "fill": "airy",
                "slides": [{"title": "Revenue grew nine percent while costs held flat across every region", "exhibit": {"type": "chart.column", "heading": "Revenue by year", "unit": "$m", "categories": ["2023", "2024", "2025"], "series": [{"name": "Revenue", "values": [40, 46, 52]}]}, "points": ["Growth came from the core", "Costs held flat", "Margin widened three points"]},
                           {"title": "Three regions carry the growth while two are flat", "points": ["North grew 12%", "South grew 9%", "East grew 8%", "West flat", "Central flat"]}]}
        (cls.tmp / "tpl.deck.json").write_text(json.dumps(spec))
        # The probe's pages are sparse on purpose, so the build lists their
        # empty bands as blockers (exit 2); the deck is written either way.
        built = subprocess.run([NODE, str(RUNTIME / "build-deck.mjs"), str(cls.tmp / "tpl.deck.json"), str(cls.tmp / "out"), "--no-render"], capture_output=True, text=True, cwd=ROOT, timeout=300)
        assert built.returncode in (0, 2), built.stderr
        cls.pptx = cls.tmp / "out" / "tpl.pptx"
        result = subprocess.run([sys.executable, str(RUNTIME / "import-template.py"), str(cls.pptx), "--base", "midnight", "--out", str(cls.tmp / "house.json")], check=True, capture_output=True, text=True, cwd=ROOT, timeout=120)
        cls.summary = json.loads(result.stdout)
        cls.house = json.loads((cls.tmp / "house.json").read_text())

    def test_profile_reads_the_palette_fonts_chrome_and_density(self):
        colors = self.house["palette"]["colors"]
        self.assertEqual(self.house["schema"], "professional-slides.house/v1")
        self.assertEqual(colors["color.ink"], "#212427")
        self.assertEqual(colors["color.componentPrimary"], "#0E7A5E")
        self.assertIn(colors["color.accent"], {"#16814B", "#5FB08F"}, "an evergreen green: the theme accent or the most used bright fill")
        self.assertEqual(colors["color.chartSeries1"], "#0E7A5E")
        self.assertEqual(self.house["typography"]["body"], "Arial")
        chrome = self.house["chrome"]
        self.assertEqual(chrome["left"], 60)
        self.assertGreaterEqual(chrome["bodyTop"], chrome["titleTop"] + 48)
        self.assertIn(self.house["density"], {"live-pitch", "executive", "pre-read"})
        self.assertEqual(self.house["footer"], "House test")
        self.assertFalse(any("Arial" in o for o in self.house["observations"]), "Arial is always usable")

    def test_profile_measures_the_house_weight(self):
        # The template is the house's own answer to how much a page carries, so
        # the profile carries a fill level and a weight contract, and says how
        # it got them.
        self.assertIn(self.house["fill"], {"airy", "balanced", "full"})
        weight = self.house["weight"]
        self.assertEqual(sorted(weight), ["columnFill", "elements", "pageWords", "plotSpan", "pointWords", "tableFill"])
        self.assertLessEqual(weight["pageWords"], 260)
        self.assertLessEqual(weight["columnFill"], 0.80)
        self.assertTrue(any("Weight measured from the template" in o for o in self.house["observations"]))
        self.assertIn("medianBodyCoverage", self.house["stats"])

    def test_spec_applies_the_template_and_explicit_fields_win(self):
        house = json.dumps(self.house)
        result = run_node(f'''
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {{applyTemplate,toDeckPlan}} from './skills/professional-slides/runtime/compose.mjs';
import {{planDeck}} from './skills/professional-slides/runtime/planner.mjs';
import {{CHROME,configureChrome}} from './skills/professional-slides/runtime/core.mjs';
const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||'/tmp','house-'));
fs.writeFileSync(path.join(dir,'house.json'),{json.dumps(house)});
const spec={{schema:'professional-slides.deck/v3',id:'t',template:'house.json',slides:[{{title:'Revenue grew nine percent while costs held flat',points:['a','b','c']}}]}};
const applied=applyTemplate(spec,dir);
assert.equal(applied.template,undefined);
assert.equal(applied.palette.base,'midnight');assert.ok(['#16814B','#5FB08F'].includes(applied.palette.colors['color.accent']));
assert.equal(applied.chrome.left,60);assert.equal(applied.footer,'House test');
// An explicit palette on the spec wins over the template's.
assert.equal(applyTemplate({{...spec,palette:'crimson'}},dir).palette,'crimson');
const plan=toDeckPlan(spec,dir);
assert.equal(plan.chrome.left,60);assert.equal(plan.palette.colors['color.componentPrimary'],'#0E7A5E');
// The compiled deck carries the overlay's colours and restores the chrome afterwards.
const {{deck}}=planDeck(plan);
assert.equal(deck.tokens['color.accent'].value,applied.palette.colors['color.accent']);
assert.equal(deck.palette.id,'tpl');
assert.equal(CHROME.left,60);
configureChrome({{left:80,right:80,titleTop:50,bodyTop:180,footerTop:660}});
assert.equal(CHROME.left,80);assert.equal(CHROME.sourceTop,624);
assert.throws(()=>configureChrome({{left:5}}),/margins/);
configureChrome(null);assert.equal(CHROME.left,60);assert.equal(CHROME.sourceTop,648);
console.log(JSON.stringify({{ok:true}}));
''')
        self.assertTrue(result["ok"])


class HouseFooterTests(unittest.TestCase):
    def cli(self, *args):
        return subprocess.run([NODE, *map(str, args)], capture_output=True, text=True,
                              env={**os.environ, 'RUNTIME_PYTHON': sys.executable}, cwd=ROOT, timeout=120)

    def test_empty_footer_overrides_house_and_raw_planner_compilation_still_works(self):
        """PR #4 follow-up: an empty footer could not override the house's, and raw planner specs stopped compiling."""
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            house = root / 'house.json'
            house.write_text(json.dumps({'schema': 'professional-slides.house/v1', 'footer': 'House name'}))
            run_node(f'''
import assert from 'node:assert/strict';
import {{applyTemplate,toDeckPlan}} from './skills/professional-slides/runtime/compose.mjs';
const spec={{schema:'professional-slides.deck/v3',template:'house.json',slides:[{{title:'Growth funds expansion',points:['Evidence supports the decision']}}]}};
const base={json.dumps(str(root))};
assert.equal(applyTemplate(spec,base).footer,'House name');
assert.equal(applyTemplate({{...spec,footer:''}},base).footer,'');
assert.equal(applyTemplate({{...spec,footer:'Custom'}},base).footer,'Custom');
console.log(JSON.stringify({{ok:true}}));
''')
            plan = {'id': 'raw', 'slides': [{'id': 'one', 'title': 'Growth funds expansion', 'items': [{'id': 'body', 'component': 'paragraph', 'props': {'text': 'Evidence supports expansion.'}}]}]}
            file = root / 'spec.json'; file.write_text(json.dumps(plan))
            result = self.cli(ROOT / 'evals/scripts/compile_scene.mjs', file, root / 'scene.json')
            self.assertEqual(result.returncode, 0, result.stderr)


@requires_python_package('pptx')
class AspectRatioTests(unittest.TestCase):
    def test_template_coordinates_match_across_aspect_ratios(self):
        """PR #4 follow-up: a template's chrome was read in different coordinates at 4:3, 16:9 and 9:16."""
        with tempfile.TemporaryDirectory() as tmp:
            profiles = []
            for width, height in [(10, 7.5), (16, 9), (9, 16)]:
                prs = Presentation()
                slide = prs.slides.add_slide(prs.slide_layouts[1])
                slide.shapes.title.text = 'Growth funds expansion'
                slide.placeholders[1].text = 'Evidence supports expansion across three regions.'
                sx, sy = Inches(width) / prs.slide_width, Inches(height) / prs.slide_height
                surfaces = [*prs.slide_masters, *prs.slide_layouts, *prs.slides]
                # Snapshot inherited placeholder geometry before changing its
                # master; otherwise later placeholders are scaled twice.
                frames = [(shape, shape.left, shape.top, shape.width, shape.height)
                          for surface in surfaces for shape in surface.shapes]
                for shape, left, top, shape_width, shape_height in frames:
                    shape.left = round(left * sx); shape.width = round(shape_width * sx)
                    shape.top = round(top * sy); shape.height = round(shape_height * sy)
                prs.slide_width, prs.slide_height = Inches(width), Inches(height)
                file = Path(tmp) / f'{width}-{height}.pptx'; prs.save(file)
                profiles.append(importer.analyse(file, 'midnight'))
            for profile in profiles[1:]:
                self.assertEqual(profile['chrome'], profiles[0]['chrome'])
                self.assertEqual(profile['stats']['medianBodyCoverage'], profiles[0]['stats']['medianBodyCoverage'])
            self.assertLess(profiles[0]['chrome']['footerTop'], 690)


if __name__ == "__main__":
    unittest.main()
