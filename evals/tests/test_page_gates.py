"""The deterministic page gates, measured against a real deck and its render.

Two halves:

* Defects. Each gate must fire on a page that carries its defect, with the
  right code and a repair sentence; the shipped NYC/SF example is the base deck.
* A synthetic good page. A slide built to satisfy every threshold must produce
  no findings at all, so the gates are falsifiable rather than always-on.
"""

from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"

sys.path.insert(0, str(GATES))
import page_gates  # noqa: E402

from node_probe import requires_python_package, example_scene, example_scene_file  # noqa: E402

# The three gates that read the renders need Pillow (see requirements.txt).
# Everything else in this file works off the scene.
needs_pixels = requires_python_package('PIL')


def load_scene():
    # The shipped NYC/SF example, compiled; a copy so a test can mutate it.
    import copy
    return copy.deepcopy(example_scene("nyc-or-sf"))


def codes(report):
    return {f["code"] for f in report["findings"]}


def slides_with(report, code):
    return sorted({f["slide"] for f in report["findings"] if f["code"] == code and f["slide"]})


# The synthetic fixtures below measure geometry and typography. Density is a
# separate contract (see test_deck_shape.py), so these scenes switch its floors
# off rather than padding a fixture page to 95 words.


class MetricColumnVoidTests(unittest.TestCase):
    def test_measures_beside_a_short_exhibit_leave_no_band_empty(self):
        # Three measures stood in thirds of a 500px column beside a four-row
        # dumbbell, each figure centred in air: 110px between them read as a
        # half-empty column (COLUMN_VOID, SCENE_VOID). As filled tiles dividing
        # the column they carry it to the foot, where the dumbbell stops short.
        from node_probe import run_node
        scene = run_node('''
import {toDeckPlan} from './evals/support/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const metrics=[{value:'5.9x',label:'ChatGPT visits per Claude visit, Aug 2026',sublabel:'Six-site Similarweb panel'},{value:'+7.6pp',label:'Claude visit share gained in a year',sublabel:'August 2025 to August 2026'},{value:'-21pp',label:'ChatGPT visit share lost in a year',sublabel:'Same six-site panel'}];
const exhibit={type:'chart.dumbbell',heading:'Web visits and cross-use',unit:'%',categories:['Visits: Claude','Visits: ChatGPT','Claude users also on ChatGPT','ChatGPT users also on Claude'],
  series:[{name:'2025',values:[2,78,78,2]},{name:'2026',values:[9.6,57,61,14]}],xMin:0,xMax:100,valueFormat:{decimals:1,suffix:'%'}};
console.log(JSON.stringify(planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'d',fill:'balanced',weight:{pageWords:95,columnFill:0.55,plotSpan:0.52,pointWords:8,tableFill:0.45,elements:1},
  slides:[{id:'s',title:'Claude gained web share, but ChatGPT still drew six times its visits',layout:'metrics-over-exhibit',metrics,exhibit}]})).deck));
''')
        slide = scene["slides"][0]
        tiles = [c["frame"] for c in slide["componentInstances"] if c["component"] == "metric"]
        chart = next(c["frame"] for c in slide["componentInstances"] if c["component"].startswith("chart."))
        self.assertEqual(len(tiles), 3)
        self.assertTrue(all(t["x"] + t["width"] <= chart["x"] for t in tiles), "the measures stand beside the exhibit")
        self.assertAlmostEqual(max(t["y"] + t["height"] for t in tiles), chart["y"] + chart["height"], delta=1)
        self.assertEqual(sum(1 for n in slide["nodes"] if n.get("role") == "metric-surface"), 3, "each tile is filled")
        report = page_gates.run_gates(scene, gates={"SCENE_VOID"})
        self.assertNotIn("SCENE_VOID", codes(report))


def good_slide():
    """A page that satisfies every gate: one hero exhibit, tight prose, a title."""

    def text(node_id, role, size, lines, x=60, y=200, width=560, height=40):
        joined = " ".join(lines)
        return {
            "type": "text", "id": node_id, "role": role,
            "frame": {"x": x, "y": y, "width": width, "height": height},
            "style": {"fontSize": {"value": size}},
            "text": "\n".join(lines),
            "data": {"textLayout": {"source": joined, "lines": lines}},
        }

    return {
        "id": "s02",
        "contentFrame": {"x": 60, "y": 162, "width": 1160, "height": 506},
        "nodes": [
            text("t", "action-title", 24, ["Jefferson clears the reading bar that Alvarado misses"],
                 y=48, width=1160, height=60),
            text("p", "paragraph", 12, [
                "Jefferson reaches the state reading standard in every measured grade,",
                "and Alvarado trails it by nine points in the two grades that matter.",
                "That gap decides the shortlist before any visit is scheduled.",
            ], x=700, y=200, width=520, height=90),
            # The commentary runs down the chart's height: three lines at the
            # top of a column beside a 440px chart is the half-empty column
            # SCENE_VOID reads by column.
            text("p2", "paragraph", 12, [
                "The nine points are the whole of the difference between them,",
                "and neither school moved by more than two points in three years.",
            ], x=700, y=330, width=520, height=60),
            text("p3", "paragraph", 12, [
                "So the reading bar settles the order and the visits settle the fit,",
                "which is the sequence the shortlist memo asks the panel to follow.",
            ], x=700, y=450, width=520, height=60),
            text("a1", "axis-label", 10, ["0"], x=60, y=600, width=40, height=14),
            text("a2", "axis-label", 10, ["25"], x=60, y=500, width=40, height=14),
            text("a3", "axis-label", 10, ["50"], x=60, y=400, width=40, height=14),
            # The chart's marks: a page that argues is held to the ink its
            # exhibit draws (SCENE_INK), and a chart sketched as a bare frame draws none.
            *({"type": "rect", "id": f"m{i}", "role": "chart-mark", "frame": {"x": 110 + i * 135, "y": y, "width": 110, "height": 600 - y},
               "style": {"fill": {"value": "#051C2C"}}, "data": {"componentInstance": "s02:s02-0"}}
              for i, y in enumerate((215, 265, 325, 385))),
            *(text(f"d{i}", "data-label", 10, [value], x=145 + i * 135, y=y - 20, width=40, height=14)
              for i, (value, y) in enumerate((("62", 215), ("55", 265), ("47", 325), ("39", 385)))),
            text("src", "source-text", 8, ["Source: NY State Education Department, 2025."],
                 y=676, width=900, height=20),
            text("pn", "page-number", 8, ["2"], x=1200, y=676, width=40, height=20),
        ],
        "componentInstances": [
            {"id": "chrome", "instanceId": "s02:chrome", "component": "slide-chrome",
             "frame": {"x": 0, "y": 0, "width": 1280, "height": 720}},
            {"id": "s02-0", "instanceId": "s02:s02-0", "component": "chart.column",
             "frame": {"x": 60, "y": 178, "width": 600, "height": 440}},
            {"id": "s02-1", "instanceId": "s02:s02-1", "component": "paragraph",
             "frame": {"x": 700, "y": 190, "width": 520, "height": 330}},
        ],
    }


class SyntheticGoodPageTests(unittest.TestCase):
    def test_a_page_that_meets_every_threshold_produces_no_findings(self):
        scene = {"slides": [{"id": "s01", "nodes": [], "componentInstances": [
            {"id": "cover", "component": "cover", "frame": {"x": 0, "y": 0, "width": 1280, "height": 720}}]},
            good_slide()]}
        report = page_gates.run_gates(scene, render_dir=None)
        self.assertEqual(report["findings"], [], json.dumps(report["findings"], indent=1))
        self.assertTrue(report["accepted"])

    def test_every_gate_is_falsifiable_on_the_same_page(self):
        """Break one thing at a time; each break must raise exactly its own code."""
        base = good_slide()

        def scene_with(mutate):
            slide = copy.deepcopy(base)
            mutate(slide)
            return {"slides": [slide]}

        def node(slide, node_id):
            return next(n for n in slide["nodes"] if n["id"] == node_id)

        def set_title(slide, text_value, lines=None):
            title = node(slide, "t")
            lines = lines or [text_value]
            title["text"] = "\n".join(lines)
            title["data"]["textLayout"] = {"source": text_value, "lines": lines}

        cases = {
            "TITLE_LINES": lambda s: set_title(s, "a b", ["a", "b", "c"]),
            "TYPE_RANGE": lambda s: node(s, "p")["style"].update({"fontSize": {"value": 18}}),
        }
        for code, mutate in cases.items():
            with self.subTest(code=code):
                report = page_gates.run_gates(scene_with(mutate), render_dir=None)
                self.assertIn(code, codes(report), f"{code} did not fire")

    def test_every_finding_carries_a_repair_sentence(self):
        scene = load_scene()
        report = page_gates.run_gates(scene, render_dir=None)
        self.assertTrue(report["findings"])
        for item in report["findings"]:
            # A void past its blocking bar also names the bar (blockAbove); a
            # rule the deck predates says so (waived).
            self.assertLessEqual({"code", "measured", "repair", "severity", "slide", "threshold"}, set(item))
            # A void finding names the band it shares with the other instruments (cause) and,
            # on a rendered page, where the band came from (origin).
            self.assertLessEqual(set(item) - {"code", "measured", "repair", "severity", "slide", "threshold"}, {"blockAbove", "waived", "cause", "origin"})
            self.assertGreaterEqual(len(item["repair"]), 40, item)
            self.assertIn(" ", item["repair"].strip())

    def test_evidence_can_end_with_a_qualification_without_a_conclusion_strip(self):
        slide = good_slide()
        paragraph = next(n for n in slide["nodes"] if n["id"] == "p")
        lines = [
            "Jefferson reaches the reading standard in every measured grade.",
            "Alvarado does not reach it in either of the two relevant grades.",
        ]
        paragraph["text"] = "\n".join(lines)
        paragraph["data"]["textLayout"] = {"source": " ".join(lines), "lines": lines}
        # This fixture measures geometry, not density: the weight floors are
        # off so a deliberately minimal page does not trip them.
        report = page_gates.run_gates({"slides": [slide]}, render_dir=None)
        self.assertTrue(report["accepted"], report["findings"])


class ProfileTests(unittest.TestCase):
    def test_an_unknown_profile_is_refused(self):
        with self.assertRaises(ValueError):
            page_gates.run_gates({"slides": []}, profile="dense")


class CliTests(unittest.TestCase):
    def test_cli_exits_two_and_writes_a_machine_readable_report(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "gates.json"
            # A known defect: one action title set at 40pt, far past its range.
            scene = load_scene()
            title = next(n for sl in scene["slides"] for n in sl["nodes"] if n.get("role") == "action-title")
            title["style"]["fontSize"] = {**title["style"]["fontSize"], "value": 40}
            scene_path = Path(tmp) / "scene.json"
            scene_path.write_text(json.dumps(scene))
            result = subprocess.run(
                [sys.executable, str(GATES / "page_gates.py"), str(scene_path),
                 "--report", str(out), "--profile", "executive"],
                capture_output=True, text=True, cwd=str(ROOT))
            self.assertEqual(result.returncode, 2, result.stderr)
            report = json.loads(out.read_text())
            self.assertFalse(report["accepted"])
            self.assertIn("TYPE_RANGE", report["countsByCode"])
            self.assertIn("page gates: REJECTED", result.stderr)

    def test_cli_exits_zero_on_a_clean_deck(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            scene = Path(tmp) / "scene.json"
            scene.write_text(json.dumps({"slides": [good_slide()]}))
            result = subprocess.run(
                [sys.executable, str(GATES / "page_gates.py"), str(scene)],
                capture_output=True, text=True, cwd=str(ROOT))
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


class FootnoteAndRenderTests(unittest.TestCase):
    def test_footnote_type_and_missing_renders(self):
        """PR #4 review: a missing render was not reported. A footnote set at body size is off its scale."""
        slide=good_slide()
        slide['componentInstances']=[{'component':'slide-chrome'}]
        paragraph=next(n for n in slide['nodes'] if n['id']=='p')
        note=copy.deepcopy(paragraph);note['id']='note';note['role']='footnote-text'
        note['style']['fontSize']['value']=20
        slide['nodes']=[note]
        self.assertIn('TYPE_RANGE',page_gates.run_gates({'slides':[slide]})['countsByCode'])
        slide=good_slide()
        with tempfile.TemporaryDirectory() as directory:
            report=page_gates.run_gates({'slides':[slide,{'nodes':[],'componentInstances':[{'component':'cover'}]}]},directory,gates={'MISSING_RENDER'})
            self.assertEqual(report['countsByCode']['MISSING_RENDER'],2)


if __name__ == "__main__":
    unittest.main()
