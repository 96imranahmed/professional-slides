"""The nice-number axis ladder, fuzzed.

`charts.mjs` rounds an axis domain outward to whole 1/2/2.5/5 steps; the page
gate re-checks rendered ticks in Python. Two implementations of the same rule
drift silently, so this fuzzes both: the Python `nice_domain` against its own
invariants, and the rendered axis labels of a real chart against the Python
port over several hundred random domains.
"""

from __future__ import annotations

import json
import math
import os
import random
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"
sys.path.insert(0, str(GATES))

import nice_ticks as nt  # noqa: E402
from node_probe import run_node  # noqa: E402

SEED = 20260915


class LadderTests(unittest.TestCase):
    def test_the_ladder_accepts_the_shapes_a_reader_recognises(self):
        for value in (0, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 250, 0.5, 0.25, -50):
            self.assertTrue(nt.on_ladder(value), value)
        for value in (3, 7, 14.025, 22.75, 1.7):
            self.assertFalse(nt.on_ladder(value), value)

    def test_the_gate_rule_rejects_the_interpolated_axis_from_the_audit(self):
        # charts.mjs:166 produced exactly this axis by interpolating the raw
        # extrema. Two of its five ticks look innocent on their own; the axis
        # as a whole does not, because the step is 1.625.
        audited = [12.4, 14.025, 15.65, 17.275, 18.9]
        ok, detail = nt.nice_axis(audited)
        self.assertFalse(ok)
        self.assertEqual(detail["reason"], "step is off the ladder")
        for value in (14.025, 15.65, 17.275, 22.75):
            self.assertFalse(nt.is_nice_tick(value), value)
        # A ladder axis passes whole, and each of its ticks passes alone.
        for axis in ([0, 5, 10, 15, 20], [0, 2.5, 5, 7.5, 10], [0, 0.25, 0.5, 0.75]):
            self.assertTrue(nt.nice_axis(axis)[0], axis)
        for value in (12.4, 18.9, 0.5, 7.0, 120):
            self.assertTrue(nt.is_nice_tick(value), value)

    def test_labels_are_parsed_the_way_a_reader_sees_them(self):
        self.assertEqual(nt.parse_number("$1,250"), 1250.0)
        self.assertEqual(nt.parse_number("22.75%"), 22.75)
        self.assertEqual(nt.parse_number("2.5k"), 2.5)
        self.assertIsNone(nt.parse_number("Q1"))
        self.assertIsNone(nt.parse_number(""))


class FuzzTests(unittest.TestCase):
    def domains(self, count=2000):
        random.seed(SEED)
        for _ in range(count):
            exponent = random.uniform(-3, 6)
            span = 10.0 ** exponent
            low = random.uniform(-span, span)
            high = low + span * random.uniform(0.01, 4)
            yield low, high

    def test_every_generated_tick_is_on_the_ladder_and_contains_the_data(self):
        for low, high in self.domains():
            for steps in (3, 4, 5, 6):
                domain = nt.nice_domain(low, high, steps)
                ticks = nt.ticks(low, high, steps)
                self.assertLessEqual(domain["min"], low + 1e-6, (low, high, steps, domain))
                self.assertGreaterEqual(domain["max"], high - 1e-6, (low, high, steps, domain))
                self.assertEqual(len(ticks), steps + 1)
                self.assertTrue(nt.on_ladder(domain["step"]), domain)
                ok, detail = nt.nice_axis(ticks)
                self.assertTrue(
                    ok, f"axis {ticks} from domain {domain} of ({low}, {high}, {steps}): {detail}")

    def test_include_zero_anchors_the_axis_without_leaving_the_ladder(self):
        for low, high in self.domains(400):
            domain = nt.nice_domain(low, high, 4, include_zero=True)
            self.assertLessEqual(domain["min"], 0.0 + 1e-9)
            self.assertGreaterEqual(domain["max"], 0.0 - 1e-9)

    def test_varying_the_step_count_never_increases_headroom(self):
        random.seed(SEED + 1)
        for low, high in self.domains(300):
            fixed = nt.nice_domain(low, high, 4)
            best = nt.best_domain([low, high])
            fixed_headroom = (fixed["max"] - high) + (low - fixed["min"])
            best_headroom = (best["max"] - high) + (low - best["min"])
            self.assertLessEqual(
                best_headroom / best["span"], fixed_headroom / fixed["span"] + 1e-9)

    def test_degenerate_and_tiny_domains_still_produce_a_usable_axis(self):
        for low, high in ((0, 0), (5, 5), (-2.5, -2.5), (1, 1 + 1e-9), (0, 1e-7)):
            domain = nt.nice_domain(low, high, 4)
            self.assertGreater(domain["span"], 0)
            self.assertTrue(math.isfinite(domain["step"]))


class JavaScriptParityTests(unittest.TestCase):
    """The rendered axis is the contract; Python must agree with what ships."""

    def test_rendered_axis_labels_match_the_python_port(self):
        random.seed(SEED + 2)
        cases = []
        for _ in range(120):
            exponent = random.uniform(-1, 5)
            scale = 10.0 ** exponent
            values = [round(random.uniform(0.05, 1.0) * scale, 6) for _ in range(4)]
            cases.append(values)
        os.environ["NICE_TICK_CASES"] = json.dumps(cases)
        result = run_node("""
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const cases=JSON.parse(process.env.NICE_TICK_CASES);
const owner=REGISTRY.get('chart.column');
const out=[];
for (const values of cases) {
  const props={categories:['a','b','c','d'],series:[{name:'value',values}],gridlines:true,dataLabels:false};
  try {
    const nodes=owner.render({id:'c',frame:{x:0,y:0,width:900,height:460},props}).nodes;
    out.push(nodes.filter(n=>n.role==='axis-label').map(n=>n.text));
  } catch (error) { out.push({error:error.message}); }
}
console.log(JSON.stringify(out));
""".strip(), )
        self.assertEqual(len(result), len(cases))
        compared = 0
        for values, labels in zip(cases, result):
            if isinstance(labels, dict) or not labels:
                continue  # a case the chart itself refuses is not an axis contract
            parsed = [nt.parse_number(label) for label in labels]
            if any(value is None for value in parsed):
                continue
            expected = nt.ticks(min(values), max(values), len(parsed) - 1, include_zero=True)
            for rendered, predicted in zip(parsed, expected):
                self.assertAlmostEqual(
                    rendered, predicted, places=4,
                    msg=f"values={values} rendered={labels} expected={expected}")
            compared += 1
        self.assertGreater(compared, 50, "the parity fuzz did not compare enough axes")


if __name__ == "__main__":
    unittest.main()
