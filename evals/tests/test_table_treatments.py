"""What makes a table treated, and a chart's data table set under its categories.

A table is treated when it carries a treatment named in gates/table-treatments.json:
heat cells, Harvey balls or dots, in-cell bars, state marks, logos, icons or a
total band. Zebra banding is not one.
"""

from __future__ import annotations

import unittest

from node_probe import ROOT, run_node


class ChartDataTableTests(unittest.TestCase):
    def test_a_charts_data_table_sits_under_its_categories_and_carries_the_figures(self):
        # The model page printed its table in columns of its own - a 228px
        # label column, then six even ones - under bars centred in the chart's
        # own slots, so FY29's figures sat a third of a column off FY29's bars;
        # and every bar printed the figure the table printed under it. Now the
        # chart sets its plot over the table's value columns and leaves the
        # figures to the table; a chart that asks for both is refused.
        result = run_node("""
import assert from 'node:assert/strict';
import { toDeckPlan } from './evals/support/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const series = [{ name: 'Central', values: [48.3, 49.6, 51.8, 54.4, 57.3, 60] }, { name: 'Low', values: [48.3, 49.4, 51.1, 53.2, 55, 56.5] }];
const categories = ['FY26', 'FY27', 'FY28', 'FY29', 'FY30', 'FY31'];
const offsets = {};
for (const [type, note] of [['chart.column', 'bars'], ['chart.line', 'points'], ['chart.combo', 'combo']]) {
  const chart = { type, heading: 'Journeys by case', unit: 'million', categories, series, dataTable: true,
    ...(type === 'chart.combo' ? {} : { annotations: [{ category: 'FY29', series: 'Central', text: 'Electric trains enter service' }] }) };
  const slide = planDeck(toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'd', slides: [{ id: 'm', title: 'The central case reaches 60 million journeys by FY31', exhibit: chart }] })).deck.slides[0];
  const mid = (n) => n.frame.x + n.frame.width / 2;
  const table = slide.nodes.filter((n) => n.data?.chartData && n.role === 'table-cell-text' && /^[0-9]/.test(n.text));
  // The category's own label is set at its centre: a slot's middle, a point.
  const labels = slide.nodes.filter((n) => n.role === 'category-label');
  offsets[note] = categories.map((category, i) => {
    const cell = table.filter((n) => n.text === series[0].values[i].toFixed(1))[0];
    return Math.abs(mid(cell) - mid(labels.find((n) => n.text === category)));
  });
  const figures = slide.nodes.filter((n) => n.role === 'data-label' && !n.data?.chartData).map((n) => n.text);
  assert.deepEqual(figures, [], `${type}: the table carries the figures, not the marks`);
}
for (const [note, list] of Object.entries(offsets)) assert.ok(list.every((d) => d <= 1), `${note}: each figure sits under its own category (${list.map((d) => d.toFixed(2))})`);
assert.throws(() => planDeck(toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'd', slides: [{ id: 'm', title: 'The central case reaches 60 million journeys by FY31',
  exhibit: { type: 'chart.column', categories, series, dataTable: true, dataLabels: true } }] })), /prints every value.*dataLabels: true/);
console.log(JSON.stringify({ ok: true, offsets }));
""")
        self.assertTrue(result["ok"])


if __name__ == "__main__":
    unittest.main()
