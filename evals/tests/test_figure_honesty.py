"""A figure is read as a picture of its numbers, so it has to be one.

Two defects from the same cold run, found by looking and invisible to every
gate the repository had.

The first is a table long enough to split: each half computed its in-cell bar
scale from the rows it happened to receive, so a $440m bar on the second page
was drawn longer than a $1,148m bar on the first. The scale belongs to the
column, not to the page it lands on.

The second is a five-step staircase inside a plot frame with a baseline, its
blocks all one size, labelled 126, 143, 136, 148 and 330 minutes. A staircase
says sequence and says it well; what it cannot say is magnitude, and a page
that prints quantities on equal blocks says two things at once.
"""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, run_node

GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"
sys.path.insert(0, str(GATES))
import page_gates  # noqa: E402


def block(index):
    return {"type": "rect", "role": "step-block",
            "frame": {"x": 60 + index * 140, "y": 300, "width": 138, "height": 76}}


def label(text):
    return {"type": "text", "role": "step-text", "text": text}


def figure(texts, *, baseline=True, sizes=None):
    nodes = [block(i) for i in range(len(texts))]
    if sizes:
        for node, height in zip(nodes, sizes):
            node["frame"]["height"] = height
    if baseline:
        nodes.append({"type": "line", "role": "step-baseline", "frame": {"x": 60, "y": 668, "width": 720, "height": 0}})
    nodes.extend(label(t) for t in texts)
    return {"id": "s37", "componentInstances": [{"id": "steps", "component": "steps"}], "nodes": nodes}


def run(gate, *args):
    findings = []
    gate(*args, findings)
    return findings


class UnscaledFigureTests(unittest.TestCase):
    MINUTES = ["126 min. Sets the tone", "143 min. The first crossover",
               "136 min. Best-reviewed solo film", "148 min. Splits the cast",
               "330 min. The payoff"]

    def test_equal_blocks_carrying_unequal_quantities_are_reported(self):
        findings = run(page_gates.gate_unscaled_figure, 37, figure(self.MINUTES))
        self.assertEqual([f["code"] for f in findings], ["UNSCALED_FIGURE"])
        self.assertEqual(findings[0]["measured"]["unit"], "min")
        self.assertEqual(findings[0]["measured"]["values"][0], 126.0)
        self.assertIn("cannot draw them", findings[0]["repair"])

    def test_a_figure_that_prints_no_quantities_is_a_sequence_and_passes(self):
        self.assertEqual(run(page_gates.gate_unscaled_figure, 37, figure(
            ["Sets the tone", "The first crossover", "Best-reviewed solo film",
             "Splits the cast", "The payoff"])), [])

    def test_a_figure_drawn_to_its_numbers_passes(self):
        self.assertEqual(run(page_gates.gate_unscaled_figure, 37,
                             figure(self.MINUTES, sizes=[30, 34, 32, 35, 78])), [])

    def test_quantities_within_half_as_much_again_are_not_a_misdrawing(self):
        # Five blocks of one size for 126 to 148 minutes is a rounding, not a
        # claim: the gate is for the figure that draws 330 as it draws 126.
        self.assertEqual(run(page_gates.gate_unscaled_figure, 37, figure(self.MINUTES[:4])), [])

    def test_a_figure_with_no_plot_furniture_is_not_claiming_a_scale(self):
        self.assertEqual(run(page_gates.gate_unscaled_figure, 37,
                             figure(self.MINUTES, baseline=False)), [])


class SplitTableScaleTests(unittest.TestCase):
    """One table, one scale, however many pages it lands on."""

    def setUp(self):
        if not NODE:
            self.skipTest("Node.js is not available")

    def test_both_halves_of_a_split_table_share_one_bar_scale(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {paginateTable, styleTable} from './skills/professional-slides/runtime/compose.mjs';
const rows = [];
for (let i = 0; i < 24; i += 1) rows.push([`Film ${i + 1} with a title long enough to wrap`, String(1200 - i * 40)]);
const pages = paginateTable({id: 's1', title: 'Box office', exhibit: {type: 'table',
  columns: ['Film', {label: 'Gross', unit: '$m', bar: true}], rows}});
assert.ok(pages.length > 1, 'the table split');
const scales = pages.map((page) => styleTable(page.exhibit).scales['gross-bar']);
assert.deepEqual(scales[0], scales[1]);
console.log(JSON.stringify(scales[0]));
''')
        self.assertEqual(result["min"], 0)
        self.assertGreaterEqual(result["max"], 1200)

    def test_an_unsplit_table_still_reads_its_scale_off_its_own_column(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
const table = styleTable({type: 'table', columns: ['Film', {label: 'Gross', unit: '$m', bar: true}],
  rows: [['A', '41'], ['B', '33'], ['C', '30']]});
console.log(JSON.stringify(table.scales['gross-bar']));
''')
        self.assertEqual(result["max"], 45)


if __name__ == "__main__":
    unittest.main()


class TitleCountTests(unittest.TestCase):
    """A title that counts is a title a reader checks, in about a second."""

    @staticmethod
    def quadrants(headings, title="Three of four common tastes point at DC; the fourth carries the money"):
        nodes = [{"type": "text", "role": "action-title", "text": title}]
        nodes.extend({"type": "text", "role": "quadrant-title", "text": heading} for heading in headings)
        return {"id": "s30", "componentInstances": [{"id": "q", "component": "quadrants"}], "nodes": nodes}

    HEADINGS = ["One great thing in one evening: DC", "A long story that pays off: Marvel",
                "An argument about power: DC", "Company and comedy: Marvel"]

    def test_a_title_its_own_exhibit_contradicts_is_reported(self):
        findings = run(page_gates.gate_title_count, 30, self.quadrants(self.HEADINGS))
        self.assertEqual([f["code"] for f in findings], ["TITLE_COUNT"])
        self.assertEqual(findings[0]["measured"]["counted"], 2)
        self.assertEqual(findings[0]["threshold"], 3)

    def test_a_title_the_exhibit_supports_passes(self):
        headings = list(self.HEADINGS)
        headings[1] = "A long story that pays off: DC"
        self.assertEqual(run(page_gates.gate_title_count, 30, self.quadrants(headings)), [])

    def test_a_count_of_something_the_page_does_not_name_is_not_measured(self):
        # "Four of the six measures are countable" over panels that say neither
        # "measures" nor anything else countable: there is nothing to count, and
        # a gate that guesses here is a gate that fires on good work.
        self.assertEqual(run(page_gates.gate_title_count, 5, self.quadrants(
            self.HEADINGS, title="Three of four common tastes point at Neither house")), [])

    def test_a_title_that_states_no_count_is_left_alone(self):
        self.assertEqual(run(page_gates.gate_title_count, 30, self.quadrants(
            self.HEADINGS, title="Common tastes point at DC more often than at Marvel")), [])
