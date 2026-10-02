"""The nice-number axis ladder, fuzzed.

`charts.mjs` rounds an axis domain outward to whole 1/2/2.5/5 steps
(`range()`) and divides it into ticks (`tickCount()`); `nice_ticks.py` ports
both for the Python readers - the page gate and the native chart's headroom
stop - and holds the gate's rule for a rendered axis. Two implementations of
one rule drift silently, so this holds the port to the JavaScript over many
domains, and the rendered axis labels of a real chart to the port.
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


def domains(count=2000, seed=SEED):
    """(low, high) pairs across nine decades, signed, whole and fractional."""
    rng = random.Random(seed)
    for _ in range(count):
        span = 10.0 ** rng.uniform(-3, 6)
        low = rng.choice([0.0, rng.uniform(-span, span), round(rng.uniform(-span, span), rng.randint(0, 4))])
        high = low + span * rng.uniform(0.01, 4)
        if rng.random() < 0.3:
            high = round(high, rng.randint(0, 4))
        yield low, max(high, low + 1e-6)


class LadderTests(unittest.TestCase):
    def test_the_ladder_accepts_the_shapes_a_reader_recognises(self):
        for value in (0, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 250, 0.5, 0.25, -50):
            self.assertTrue(nt.on_ladder(value), value)
        for value in (3, 7, 14.025, 22.75, 1.7):
            self.assertFalse(nt.on_ladder(value), value)

    def test_the_gate_rule_rejects_the_interpolated_axis_from_the_audit(self):
        # Interpolating the raw extrema produces exactly this axis. Two of its
        # five ticks look innocent on their own; the axis as a whole does not,
        # because the step is 1.625.
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

    def test_to_fixed_rounds_a_tie_away_from_zero_as_javascript_does(self):
        # Python's round() takes a tie to the even digit; toFixed takes it away from zero.
        self.assertEqual(nt.to_fixed(0.125, 2), 0.13)
        self.assertEqual(nt.to_fixed(-0.125, 2), -0.13)
        self.assertEqual(nt.to_fixed(2.5, 0), 3.0)
        self.assertEqual(nt.to_fixed(0.1 + 0.2, 10), 0.3)


class DomainTests(unittest.TestCase):
    def test_every_domain_is_whole_ladder_steps_and_contains_the_data(self):
        for low, high in domains():
            for zero in (False, True):
                domain = nt.nice_range([low, high], include_zero=zero)
                where = (low, high, zero, domain)
                self.assertLessEqual(domain["min"], low + 1e-6, where)
                self.assertGreaterEqual(domain["max"], high - 1e-6, where)
                self.assertIn(domain["steps"], nt.TICK_COUNTS, where)
                self.assertTrue(nt.on_ladder(domain["step"]), where)
                ok, detail = nt.nice_axis(nt.axis_ticks(domain["min"], domain["max"], domain["steps"]))
                self.assertTrue(ok, f"{where}: {detail}")
                if zero:
                    self.assertLessEqual(domain["min"], 0.0)
                    self.assertGreaterEqual(domain["max"], 0.0)

    def test_the_tightest_division_wins_and_four_wins_a_tie(self):
        # The span each step count needs on its own, from the same ladder.
        def span(low, high, steps):
            for candidate in nt.step_candidates((high - low) / steps):
                start = math.floor(low / candidate + 1e-9) * candidate
                if start + candidate * steps >= high - 1e-9:
                    return candidate * steps
        for low, high in domains(400, SEED + 1):
            domain = nt.nice_range([low, high])
            spans = {steps: span(low, high, steps) for steps in nt.TICK_COUNTS}
            tightest = min(spans.values())
            self.assertLessEqual(domain["step"] * domain["steps"], tightest * (1 + 1e-9), (low, high, spans))
            if abs(spans[4] - tightest) <= 1e-9:
                self.assertEqual(domain["steps"], 4, (low, high, spans))

    def test_degenerate_and_tiny_domains_still_produce_a_usable_axis(self):
        for low, high in ((0, 0), (5, 5), (-2.5, -2.5), (1, 1 + 1e-9), (0, 1e-7)):
            domain = nt.nice_range([low, high])
            self.assertGreater(domain["span"], 0)
            self.assertTrue(math.isfinite(domain["step"]))


class JavaScriptParityTests(unittest.TestCase):
    """The renderer's domain is the contract; the port must reproduce it."""

    def test_nice_range_is_the_renderers_range(self):
        pairs = [list(pair) for pair in domains(1500, SEED + 3)]
        pairs += [[0, 0], [5, 5], [-2.5, -2.5], [0, 1e-7], [132, 313], [0, 693.28], [0, 4.704],
                  [-50, 50], [12.4, 18.9], [0, 100], [0.1, 0.3], [-0.004, 0.0021], [1e5, 1.00001e5]]
        os.environ["NICE_RANGE_PAIRS"] = json.dumps(pairs)
        result = run_node("""
import {numericBounds} from './skills/professional-slides/runtime/charts.mjs';
const pairs = JSON.parse(process.env.NICE_RANGE_PAIRS);
console.log(JSON.stringify(pairs.map(([low, high]) => [false, true].map((includeZero) => {
  const bounds = numericBounds([low, high], {includeZero});
  return [bounds.min, bounds.max, bounds.span];
}))));
""")
        self.assertEqual(len(result), len(pairs))
        for (low, high), both in zip(pairs, result):
            for zero, expected in zip((False, True), both):
                domain = nt.nice_range([low, high], include_zero=zero)
                self.assertEqual([domain["min"], domain["max"], domain["span"]], expected, (low, high, zero))

    def test_tick_count_is_the_renderers_tick_count(self):
        domains_ = [[nt.nice_range([low, high])[k] for k in ("min", "max")] for low, high in domains(600, SEED + 4)]
        domains_ += [[0, 6], [0, 7], [0, 12.5], [0, 15], [-1, 1], [0, 0.3]]
        os.environ["TICK_COUNT_DOMAINS"] = json.dumps(domains_)
        result = run_node("""
import {tickCount} from './skills/professional-slides/runtime/charts.mjs';
console.log(JSON.stringify(JSON.parse(process.env.TICK_COUNT_DOMAINS).map(([low, high]) => tickCount(low, high))));
""")
        self.assertEqual(result, [nt.tick_count(low, high) for low, high in domains_])

    def test_rendered_axis_labels_are_the_ports_ticks(self):
        rng = random.Random(SEED + 2)
        cases = []
        for _ in range(120):
            scale = 10.0 ** rng.uniform(-1, 5)
            cases.append([round(rng.uniform(0.05, 1.0) * scale, 6) for _ in range(4)])
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
    out.push(nodes.filter(n=>n.role==='axis-label').map(n=>n.data.value));
  } catch (error) { out.push({error:error.message}); }
}
console.log(JSON.stringify(out));
""".strip())
        self.assertEqual(len(result), len(cases))
        compared = 0
        for values, drawn in zip(cases, result):
            if isinstance(drawn, dict) or not drawn:
                continue  # a case the chart itself refuses is not an axis contract
            domain = nt.nice_range(values, include_zero=True)
            self.assertEqual(drawn, nt.axis_ticks(domain["min"], domain["max"]), f"values={values}")
            compared += 1
        self.assertGreater(compared, 50, "the parity fuzz did not compare enough axes")


if __name__ == "__main__":
    unittest.main()
