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

from node_probe import ROOT, RUNTIME, NODE, run_node

SKILL = ROOT / "skills" / "professional-slides"


class TemplateImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        # Build a small BCG deck, then read it back as a template.
        spec = {"schema": "professional-slides.deck/v3", "id": "tpl", "palette": "bcg", "footer": "House test",
                "slides": [{"title": "Revenue grew nine percent while costs held flat across every region", "exhibit": {"type": "chart.column", "heading": "Revenue by year", "unit": "$m", "categories": ["2023", "2024", "2025"], "series": [{"name": "Revenue", "values": [40, 46, 52]}]}, "points": ["Growth came from the core", "Costs held flat", "Margin widened three points"]},
                           {"title": "Three regions carry the growth while two are flat", "points": ["North grew 12%", "South grew 9%", "East grew 8%", "West flat", "Central flat"]}]}
        (cls.tmp / "tpl.deck.json").write_text(json.dumps(spec))
        subprocess.run([NODE, str(RUNTIME / "build-deck.mjs"), str(cls.tmp / "tpl.deck.json"), str(cls.tmp / "out"), "--no-render"], check=True, capture_output=True, cwd=ROOT, timeout=300)
        cls.pptx = cls.tmp / "out" / "tpl.pptx"
        result = subprocess.run([sys.executable, str(RUNTIME / "import-template.py"), str(cls.pptx), "--base", "mckinsey", "--out", str(cls.tmp / "house.json")], check=True, capture_output=True, text=True, cwd=ROOT, timeout=120)
        cls.summary = json.loads(result.stdout)
        cls.house = json.loads((cls.tmp / "house.json").read_text())

    def test_profile_reads_the_palette_fonts_chrome_and_density(self):
        colors = self.house["palette"]["colors"]
        self.assertEqual(self.house["schema"], "professional-slides.house/v1")
        self.assertEqual(colors["color.ink"], "#212427")
        self.assertEqual(colors["color.componentPrimary"], "#0E7A5E")
        self.assertIn(colors["color.accent"], {"#2FBF71", "#5FB08F"}, "a BCG green: the theme accent or the most used bright fill")
        self.assertEqual(colors["color.chartSeries1"], "#0E7A5E")
        self.assertEqual(self.house["typography"]["body"], "Arial")
        chrome = self.house["chrome"]
        self.assertEqual(chrome["left"], 60)
        self.assertGreaterEqual(chrome["bodyTop"], chrome["titleTop"] + 48)
        self.assertIn(self.house["density"], {"live-pitch", "executive", "pre-read"})
        self.assertEqual(self.house["footer"], "House test")
        self.assertFalse(any("Arial" in o for o in self.house["observations"]), "Arial is always usable")

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
assert.equal(applied.palette.base,'mckinsey');assert.ok(['#2FBF71','#5FB08F'].includes(applied.palette.colors['color.accent']));
assert.equal(applied.chrome.left,60);assert.equal(applied.footer,'House test');
// An explicit palette on the spec wins over the template's.
assert.equal(applyTemplate({{...spec,palette:'bain'}},dir).palette,'bain');
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


if __name__ == "__main__":
    unittest.main()
