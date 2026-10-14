"""What makes a table treated, and a chart's data table set under its categories.

A table is treated when it carries a treatment named in gates/table-treatments.json:
heat cells, Harvey balls or dots, in-cell bars, state marks, logos, icons or a
total band. Zebra banding is not one.
"""

from __future__ import annotations

import sys
import unittest

from node_probe import ROOT, run_node

GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"
sys.path.insert(0, str(GATES))

import deck_gates  # noqa: E402


class DefinitionTests(unittest.TestCase):
    @staticmethod
    def page(*nodes):
        return {"id": "p", "componentInstances": [{"id": "chrome", "component": "slide-chrome"}, {"id": "t", "instanceId": "p:t", "component": "table"}],
                "nodes": [{"role": "action-title", "type": "text", "text": "A finding"},
                          *({**n, "data": {**n.get("data", {}), "componentInstance": "p:t"}} for n in nodes)]}

    def treated(self, *nodes):
        slide = self.page(*nodes)
        return deck_gates.table_treated(slide, slide["componentInstances"][1])

    def test_zebra_banding_is_not_a_treatment(self):
        self.assertFalse(self.treated({"role": "table-zebra-band"}, {"role": "table-cell"}))
        self.assertFalse(self.treated({"role": "table-row-band", "data": {"rowStyle": "group"}}))

    def test_each_named_treatment_is_one(self):
        for node in ({"role": "table-cell", "data": {"cellType": "heatmap"}}, {"role": "table-rating-sector"},
                     {"role": "table-dot"}, {"role": "table-bar"}, {"role": "table-progress-fill"},
                     {"role": "table-status-pill"}, {"role": "table-check"}, {"role": "table-lamp"},
                     {"role": "table-header-logo"}, {"role": "table-logo"}, {"role": "table-cell-icon-glyph"},
                     {"role": "table-row-band", "data": {"rowStyle": "total"}}):
            with self.subTest(node=node):
                self.assertTrue(self.treated(node))

    def test_a_treatment_belongs_to_its_own_table(self):
        # Two tables on one page: the bars in the second do not treat the first.
        slide = {"id": "p", "componentInstances": [{"id": "t1", "instanceId": "p:t1", "component": "table"},
                                                   {"id": "t2", "instanceId": "p:t2", "component": "table"}],
                 "nodes": [{"role": "table-cell", "data": {"componentInstance": "p:t1"}},
                           {"role": "table-bar", "data": {"componentInstance": "p:t2"}}]}
        self.assertEqual([deck_gates.table_treated(slide, c) for c in slide["componentInstances"]], [False, True])


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
