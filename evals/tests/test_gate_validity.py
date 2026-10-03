"""Gate validity: the stored specimens replayed through today's gates.

`evals/quality/defects.json` labels what people found on the specimens with the
gate that should catch it; `evals/quality/gate-validity.mjs` replays the stored
scenes and plans and reports per-gate recall and precision. These tests hold
the table to the gate vocabulary (a renamed code must not silently drop out of
the measurement) and check the replay and its arithmetic.
"""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

from node_probe import ROOT, requires_chromium, run_node

QUALITY = ROOT / "evals" / "quality"
SPECIMENS = ROOT / "evals" / "cold-run" / "specimens"
DEFECTS = json.loads((QUALITY / "defects.json").read_text(encoding="utf-8"))["defects"]


def page_gate_codes():
    spec = importlib.util.spec_from_file_location(
        "page_gates_vocab", ROOT / "skills" / "professional-slides" / "runtime" / "gates" / "page_gates.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return set(module.GATE_CODES)


class DefectTableTests(unittest.TestCase):
    def test_every_label_names_a_gate_that_exists(self):
        vocabulary = run_node('''
import {PLAN_CODES} from './skills/professional-slides/runtime/gates/plan_gates.mjs';
import {VARIETY_CODES} from './skills/professional-slides/runtime/gates/variety_gates.mjs';
import {CRAFT_CODES} from './skills/professional-slides/runtime/gates/craft_gates.mjs';
import {BUILD_BARS} from './evals/cold-run/score.mjs';
import {OVERLAP_CODES} from './skills/professional-slides/runtime/validate-overlap.mjs';
import {CHART_FORM_CODES} from './skills/professional-slides/runtime/page-types.mjs';
console.log(JSON.stringify([...Object.keys(PLAN_CODES),...Object.keys(VARIETY_CODES),...Object.keys(CRAFT_CODES),
  ...Object.keys(BUILD_BARS).map(k=>'BUILD:'+k),'RENDERED_OVERLAP',...Object.keys(OVERLAP_CODES),...Object.keys(CHART_FORM_CODES)]));
''')
        known = set(vocabulary) | page_gate_codes()
        for defect in DEFECTS:
            with self.subTest(defect=defect["defect"][:50]):
                self.assertTrue(defect["expectedGate"] is None or defect["expectedGate"] in known, defect["expectedGate"])

    def test_every_row_says_where_what_and_who(self):
        specimens = {p.name for p in SPECIMENS.iterdir() if p.is_dir()} | {p.stem for p in SPECIMENS.glob("*.json")}
        for defect in DEFECTS:
            with self.subTest(defect=defect["defect"][:50]):
                self.assertIn(defect["specimen"], specimens)
                self.assertTrue(defect["defect"].strip())
                self.assertTrue(defect["class"].strip())
                self.assertIn(defect["source"], {"human", "independent review", "delivery review", "storyline review"})
                self.assertTrue(defect["pages"] is None or (defect["pages"] and all(isinstance(p, int) and p >= 1 for p in defect["pages"])))

    def test_the_human_findings_on_the_delivered_deck_are_all_labelled(self):
        human = [(d["class"], d["pages"][0]) for d in DEFECTS
                 if d["specimen"] == "anthropic-vs-openai-2026" and d["source"] == "human"]
        self.assertEqual(sorted(p for c, p in human if c == "dead-space"), [2, 20, 21, 22, 29, 36, 41])
        self.assertEqual(sorted(p for c, p in human if c == "legend"), [15, 24, 30])
        self.assertEqual(sorted(p for c, p in human if c == "number-cards"), [10, 18, 27, 38])
        self.assertEqual(sorted(p for c, p in human if c == "collision"), [22, 26, 44, 48])
        self.assertEqual(sorted(p for c, p in human if c == "chart-form"), [15])


class ReplayTests(unittest.TestCase):
    def test_the_stored_specimens_replay_through_every_gate_they_have_inputs_for(self):
        result = run_node('''
import {measure} from './evals/quality/gate-validity.mjs';
console.log(JSON.stringify(await measure()));
''')
        specimens = result["specimens"]
        anthropic = specimens["anthropic-vs-openai-2026"]
        self.assertTrue(anthropic["replayed"])
        self.assertEqual(anthropic["ran"], ["page (scene)", "build", "design (scene)", "plan", "variety", "craft", "chart form"])
        self.assertEqual(specimens["emirates-v8"]["ran"], ["plan"])
        self.assertFalse(specimens["2026-09-19-marvel-vs-dc"]["replayed"])
        gates = result["gates"]
        self.assertEqual(gates["SCENE_VOID"]["labelled"], 7)
        for code, gate in gates.items():
            with self.subTest(gate=code):
                self.assertLessEqual(gate["caught"], gate["labelled"])
                self.assertLessEqual(gate["onLabel"], gate["fired"])
                for measure in ("recall", "precision"):
                    self.assertTrue(gate[measure] is None or 0 <= gate[measure] <= 1)
        # Every page-level label on a replayed build is scored, caught or not.
        scored = [d for d in result["defects"] if d["specimen"] == "anthropic-vs-openai-2026"]
        self.assertEqual(len(scored), len([d for d in DEFECTS if d["specimen"] == "anthropic-vs-openai-2026"
                                           and d.get("revision") != "earlier"]))
        for defect in scored:
            self.assertIn(defect["caught"], (True, False, None))
        # The delivered deck's variety and build failures are caught today.
        self.assertEqual(gates["VARIETY_TABLES"]["caught"], 1)
        self.assertEqual(gates["BUILD:exhibitVarietyPerTen"]["caught"], 1)
        # The number cards, unkeyed scatters, dots over time and collisions
        # it found by eye are caught by the compile's chart-form refusals and
        # the scene checks.
        for code in ("NUMBER_CARDS", "SCATTER_UNKEYED", "SCATTER_OVER_TIME", "TEXT_ON_LINE", "DESCENDER_ON_RULE"):
            self.assertEqual(gates[code]["caught"], gates[code]["labelled"], code)
        self.assertNotIn("number-cards", result["ungated"])

    def test_recall_and_precision_arithmetic(self):
        result = run_node('''
import {validity,pageResolver} from './evals/quality/gate-validity.mjs';
const defects=[
  {specimen:'s',pages:[2],defect:'a',class:'void',expectedGate:'V'},
  {specimen:'s',pages:[5],defect:'b',class:'void',expectedGate:'V'},
  {specimen:'s',pages:null,defect:'c',class:'deck',expectedGate:'D'},
  {specimen:'s',pages:[7],defect:'d',class:'legend',expectedGate:null},
  {specimen:'s',pages:[3],defect:'e',class:'void',expectedGate:'V',revision:'earlier'},
  {specimen:'gone',pages:[1],defect:'f',class:'void',expectedGate:'V'}];
const findings={s:{findings:[{code:'V',pages:[2]},{code:'V',pages:[9]},{code:'V',pages:[]},{code:'D',pages:[]},{code:'X',pages:[7]}]}};
const r=validity(defects,findings);
const resolve=pageResolver({scene:{slides:[{id:'cover'},{id:'p1'},{id:'p2'}]},plan:{pages:[{id:'cover',n:1},{id:'p2',n:2}]}});
console.log(JSON.stringify({gates:r.gates,ungated:r.ungated,notReplayed:r.notReplayed,
  ids:resolve(['p2','cover','nope']),planN:resolve(2,'plan'),slide:resolve(3,'scene')}));
''')
        self.assertEqual(result["gates"]["V"], {"labelled": 2, "caught": 1, "fired": 3, "onLabel": 1, "recall": 0.5, "precision": 0.33})
        self.assertEqual(result["gates"]["D"], {"labelled": 1, "caught": 1, "fired": 1, "onLabel": 1, "recall": 1, "precision": 1})
        self.assertEqual(result["ungated"], {"legend": {"defects": 1, "firedHere": {"X": 1}}})
        self.assertEqual(result["notReplayed"], 2)
        # Plan page 2 is scene slide 3 once the build inserted its own pages.
        self.assertEqual(result["ids"], [1, 3])
        self.assertEqual(result["planN"], [3])
        self.assertEqual(result["slide"], [3])


class OverlapReplayTests(unittest.TestCase):
    """The rendered overlap audit, apart from the scene replay: it launches a browser."""

    @requires_chromium
    def test_the_overlap_audit_is_measured_when_chromium_is_there(self):
        result = run_node('''
import {overlapFindings} from './evals/quality/gate-validity.mjs';
import {loadSpecimen} from './evals/cold-run/specimens.mjs';
const findings=await overlapFindings(loadSpecimen('anthropic-vs-openai-2026').scene);
console.log(JSON.stringify(findings.map(f=>[f.code,f.slide])));
''')
        self.assertTrue(result)
        self.assertEqual({code for code, _ in result}, {"RENDERED_OVERLAP"})
        self.assertTrue(all(1 <= slide <= 50 for _, slide in result))
        # The collisions on this build are labelled with the scene checks that
        # read them without a browser (validate-overlap sceneCollisions).
        labelled = {d["pages"][0]: d["expectedGate"] for d in DEFECTS if d["class"] == "collision"
                    and d["specimen"] == "anthropic-vs-openai-2026" and d.get("revision") != "earlier"}
        self.assertEqual(labelled, {22: "TEXT_ON_LINE", 26: "DESCENDER_ON_RULE", 44: "DESCENDER_ON_RULE", 48: "TEXT_ON_LINE"})


if __name__ == "__main__":
    unittest.main()
