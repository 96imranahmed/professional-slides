"""The calibration tooling: the targets can be re-derived, and only as numbers.

The set the targets were measured on lives outside the repository and is found
through PS_CALIBRATION_CORPUS. These tests run the tools on a synthetic set in a
temp directory: that the reading-task builder writes the shape the runtime
reads and nothing that names a page, that the text-form measure counts blocks
the way it says, that the tools share the page gates' constants instead of
copying them, and that the comparison table reads keys weight.json still has.
"""
from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import ROOT, run_node

CALIBRATION = ROOT / "evals" / "calibration"
RUNTIME = ROOT / "skills" / "professional-slides" / "runtime"


def load(name):
    sys.path.insert(0, str(CALIBRATION))
    spec = importlib.util.spec_from_file_location(f"calibration_{name}", CALIBRATION / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def tool(name, *args, corpus=None):
    env = {k: v for k, v in os.environ.items() if k != "PS_CALIBRATION_CORPUS"}
    if corpus is not None:
        env["PS_CALIBRATION_CORPUS"] = str(corpus)
    return subprocess.run([sys.executable, str(CALIBRATION / name), *args], capture_output=True, text=True, env=env, cwd=ROOT)


class CorpusLocationTests(unittest.TestCase):
    def test_every_tool_needs_the_set_named_in_the_environment(self):
        for name, args in [("build_reading_tasks.py", []), ("measure_text_form.py", []),
                           ("measure_corpus.py", ["words", "/dev/null"])]:
            with self.subTest(tool=name):
                out = tool(name, *args)
                self.assertNotEqual(out.returncode, 0)
                self.assertIn("PS_CALIBRATION_CORPUS", out.stderr + out.stdout)

    def test_the_tools_use_the_page_gates_constants_rather_than_a_copy(self):
        constants = load("corpus").gate_constants()
        gates = importlib.util.spec_from_file_location("page_gates_check", RUNTIME / "gates" / "page_gates.py")
        module = importlib.util.module_from_spec(gates)
        gates.loader.exec_module(module)
        self.assertIs(type(constants["NUMERIC_TOKEN"]), type(module.NUMERIC_TOKEN))
        self.assertEqual(constants["NUMERIC_TOKEN"].pattern, module.NUMERIC_TOKEN.pattern)
        self.assertEqual((constants["CANVAS_W"], constants["CANVAS_H"]), (1280, 720))
        self.assertEqual(constants["FOOTER_TOP"], module.FOOTER_TOP)


class CalibrationReadingTaskTests(unittest.TestCase):
    def test_the_builder_writes_numbers_in_the_shape_the_runtime_reads(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            judgements, measures = [], []
            words = {("chart", False): [30, 40, 50, 60, 70], ("chart", True): [90, 100, 110, 120],
                     ("table", False): [100, 150, 200], ("text", False): [120, 130, 140], ("mixed", True): [80, 90]}
            for (family, commentary), bodies in words.items():
                for i, body in enumerate(bodies):
                    key = f"deck-{family}-{commentary}-{i}.pdf#3"
                    judgements.append({"page": key, "kind": "content", "family": family, "hasCommentary": commentary})
                    measures.append([key, body + 40, 0, body, 0, f"docs/{key}", 3])
            judgements.append({"page": "cover.pdf#1", "kind": "cover", "family": "text", "hasCommentary": False})
            measures.append(["cover.pdf#1", 12, 0, 12, 0, "docs/cover.pdf", 1])
            judgements.append({"page": "blank.pdf#2", "kind": "content", "family": "chart", "hasCommentary": False})
            measures.append(["blank.pdf#2", 0, 0, 0, 0, "docs/blank.pdf", 2])
            (root / "page-judgements.json").write_text(json.dumps(judgements))
            (root / "page-measures.json").write_text(json.dumps(measures))
            out = tool("build_reading_tasks.py", corpus=root)
            self.assertEqual(out.returncode, 0, out.stderr)
            self.assertNotIn(".pdf", out.stdout, "the targets name no document")
            result = json.loads(out.stdout)
        tasks = result["tasks"]
        shipped = json.loads((RUNTIME / "reading-tasks.json").read_text())["tasks"]
        for name, task in tasks.items():
            with self.subTest(task=name):
                self.assertEqual(set(task), {"commentary", "bodyWords", "totalWords"})
                self.assertIn(name, shipped, "a task the text contract knows")
                self.assertLessEqual(task["bodyWords"]["q1"], task["bodyWords"]["median"])
                self.assertLessEqual(task["bodyWords"]["median"], task["bodyWords"]["q3"])
        self.assertEqual(tasks["chart-led"]["bodyWords"], {"q1": 40.0, "median": 50.0, "q3": 60.0})
        self.assertEqual(tasks["chart-led"]["totalWords"], {"median": 90.0})
        self.assertIs(tasks["chart-led"]["commentary"], False)
        self.assertIs(tasks["chart-with-commentary"]["commentary"], True)
        self.assertIsNone(tasks["text-page"]["commentary"])
        # Pooled across chart, table and diagram, cover and zero-word page left out.
        self.assertEqual(tasks["exhibit-led"]["bodyWords"]["median"], 65.0)
        self.assertNotIn("diagram-led", tasks)


class CalibrationTextFormTests(unittest.TestCase):
    def test_blocks_are_runs_of_lines_without_the_title_labels_or_sources(self):
        measure = load("measure_text_form")
        page = "\n".join([
            "Margins recovered as freight repriced",  # the title
            "",
            "Freight costs fell by a third over the year and the",
            "business kept most of the saving",
            "",
            "Q1",  # a label
            "",
            "Two of five regions still lose money on every order they ship",
            "",
            "Source: company accounts",
            "12",
        ])
        self.assertEqual(measure.block_sizes(page), [17, 12])
        summary = measure.summarise([{"blocks": 2, "wordsPerBlock": 14.0, "longestBlock": 16},
                                     {"blocks": 1, "wordsPerBlock": 40.0, "longestBlock": 40},
                                     {"blocks": 4, "wordsPerBlock": 20.0, "longestBlock": 30}])
        self.assertEqual(summary["pagesMeasured"], 3)
        self.assertEqual(summary["blocksPerPage"]["median"], 2)
        self.assertEqual(summary["singleBlockPages"], 0.333)
        self.assertNotIn("file", json.dumps(summary))


class CompareTests(unittest.TestCase):
    def test_the_comparison_reads_targets_weight_json_still_carries(self):
        result = run_node('''
import {ROWS,measureScene,compare} from './evals/calibration/compare.mjs';
import {toDeckPlan} from './evals/support/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
import fs from 'node:fs';
const dir='./skills/professional-slides/examples';
const scene=planDeck(toDeckPlan(JSON.parse(fs.readFileSync(dir+'/nyc-or-sf.deck.json','utf8')),dir)).deck;
const deck=measureScene(scene,'nyc-or-sf');
console.log(JSON.stringify({missing:ROWS.filter(r=>r[2]===null).map(r=>r[1]),deck,table:compare([deck])}));
''')
        # Body words and every mix and craft target come from weight.json; a
        # renamed key would print "-" silently, so an absent one fails here.
        self.assertEqual(result["missing"], [])
        self.assertGreater(result["deck"]["pages"], 0)
        self.assertIn("tables treated", result["table"])


if __name__ == "__main__":
    unittest.main()
