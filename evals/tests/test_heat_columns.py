"""A heat column takes recorded values, and says everything wrong with it at once.

`heat: true` on a column of recorded values gave two refusals in two runs,
neither of which said what a heat column takes: "A heat column needs numeric
cells; "n/a" is not one", and then, with the n/a gone, "Table score is outside
its declared domain" - the column's numbers had been handed to a scale of
scores from 1 to 5. A heat column now takes scores from 1 to 5 as they stand,
and any other figures as recorded values, shaded across the column's own range
(or across a `domain` it declares) with each cell keeping its figure; a figure
marked missing keeps its words and takes no shade; and one refusal names every
cell that is wrong, with what the column takes.
"""
from __future__ import annotations

import unittest

from node_probe import run_node

HEAT = '''
import { compileDeck, composeForAuthoring } from './skills/professional-slides/runtime/author-deck.mjs';
const names = ['Harbour', 'Northgate', 'Millrace', 'Castlefield', 'Dunmore', 'Eastbank'];
const page = (column, cells, extra = {}) => ({ id: 'p1', type: 'lookup', form: 'table', commentary: 'in-exhibit', title: 'Northgate leads the six lenders on margin and on growth', why: 'The reader looks up each lender against the measure',
  settles: { kind: 'comparison', what: 'net interest margin across six lenders' }, exhibit: { columns: ['Lender', { label: 'Margin', unit: '%', heat: true, ...column }, 'Note'], rows: names.map((name, i) => [name, cells[i], 'As reported']), ...extra } });
const heatOf = (node, out = []) => { if (Array.isArray(node)) node.forEach((child) => heatOf(child, out)); else if (node && typeof node === 'object') { if (node.data?.heatStep !== undefined && node.role !== undefined) out.push(node.data.heatStep);
  for (const value of Object.values(node)) if (value && typeof value === 'object') heatOf(value, out); } return out; };
const run = async (column, cells, extra) => { const doc = { deck: { schema: 'professional-slides.deck/v3', id: 'heat', request: 'Compare the six lenders on margin for the board' }, pages: [page(column, cells, extra)] };
  const compiled = compileDeck(doc, { partial: true });
  const composed = compiled.spec.slides.length ? await composeForAuthoring(compiled.spec, '.') : { pageErrors: [] };
  const text = JSON.stringify(composed.deck?.slides?.[0]?.nodes ?? '');
  return { compile: compiled.compileErrors, errors: composed.pageErrors ?? [], drawn: Boolean(composed.deck?.slides?.length), printed: ['2.9', '3.4', 'n/a', '3.1', '2.2', '2.8'].filter((figure) => text.includes(`"${figure}`)), heat: /heat/.test(text) }; };
'''


class HeatColumnTests(unittest.TestCase):
    def test_recorded_values_are_shaded_across_their_own_range_and_keep_their_figures(self):
        result = run_node(HEAT + '''
console.log(JSON.stringify({ raw: await run({}, ['2.9', '3.4', 'n/a', '3.1', '2.2', '2.8']), percent: await run({}, ['2.9%', '3.4%', 'not disclosed', '3.1%', '2.2%', '2.8%']),
  scores: await run({}, ['1', '3', '5', '2', '4', '3']), domain: await run({ domain: [0, 5] }, ['2.9', '3.4', 'n/a', '3.1', '2.2', '2.8']) }));
''')
        for name in ("raw", "percent", "scores", "domain"):
            with self.subTest(case=name):
                self.assertEqual([result[name]["compile"], result[name]["errors"]], [[], []])
                self.assertTrue(result[name]["drawn"])
                self.assertTrue(result[name]["heat"])
        # Each cell keeps the figure its author wrote, and the missing one its words.
        self.assertEqual(result["raw"]["printed"], ["2.9", "3.4", "n/a", "3.1", "2.2", "2.8"])

    def test_the_steps_follow_the_columns_range_or_the_domain_it_declares(self):
        result = run_node('''
import { styleTable } from './skills/professional-slides/runtime/compose-tables.mjs';
const table = (column, cells) => styleTable({ type: 'table', columns: ['Lender', { label: 'Margin', unit: '%', heat: true, ...column }], rows: cells.map((cell, i) => [`Lender ${i + 1}`, cell]) });
const steps = (styled) => styled.rows.map((row) => { const cell = (Array.isArray(row) ? row : row.cells)[1]; return cell.type === 'heatmap' ? cell.value : cell.text; });
const own = table({}, ['2.0', '3.0', 'n/a', '4.0', '2.5']), declared = table({ domain: [0, 4] }, ['2.0', '3.0', 'n/a', '4.0', '2.5']), scores = table({}, ['1', '3', '5', '2']);
const scaleOf = (styled) => Object.values(styled.scales ?? {}).find((scale) => scale.type === 'heatmap');
console.log(JSON.stringify({ own: steps(own), declared: steps(declared), scores: steps(scores), ramp: [scaleOf(own).ramp, scaleOf(declared).ramp], figures: own.rows.map((row) => row[1].figure ?? null), scoreScale: scaleOf(scores).anchors }));
''')
        # Five equal steps from the lowest figure to the highest: 2.0 is the lowest, 4.0 the highest, 3.0 the middle.
        self.assertEqual(result["own"], [1, 3, "n/a", 5, 2])
        # Across a declared domain of 0 to 4 the same figures sit higher: the shade means the same in every table.
        self.assertEqual(result["declared"], [3, 4, "n/a", 5, 4])
        self.assertEqual(result["scores"], [1, 3, 5, 2])
        self.assertEqual(result["ramp"], [{"low": "2.0%", "high": "4.0%"}, {"low": "0%", "high": "4%"}])
        self.assertEqual(result["figures"], ["2.0", "3.0", None, "4.0", "2.5"])
        self.assertEqual(result["scoreScale"]["1"], "Lowest")

    def test_one_refusal_says_everything_wrong_with_the_column_and_what_it_takes(self):
        result = run_node(HEAT + '''
console.log(JSON.stringify({ words: (await run({}, ['2.9', 'high', 'n/a', 'tbc', '2.2', '2.8'])).errors,
  outside: (await run({ domain: [0, 3] }, ['2.9', '3.4', 'n/a', 'x', '2.2', '3.1'])).errors, shape: (await run({ domain: [5, 1] }, ['2.9', '3.4', 'n/a', '3.1', '2.2', '2.8'])).errors }));
''')
        words, outside, shape = result["words"], result["outside"], result["shape"]
        self.assertEqual([len(words), len(outside), len(shape)], [1, 1, 1])
        self.assertIn('"high", "tbc" are not a number', words[0])
        self.assertIn('written "n/a" or "not disclosed"', words[0])
        self.assertIn("whole scores from 1 to 5 as they stand", words[0])
        self.assertIn("`domain: [low, high]`", words[0])
        # Both problems of one column in one run: a cell that is no number and two outside the declared domain.
        self.assertIn('"x" is not a number', outside[0])
        self.assertIn('"3.4", "3.1" lie outside the `domain` it declares (0 to 3)', outside[0])
        self.assertIn("its `domain` is [low, high], two numbers with low under high", shape[0])


if __name__ == "__main__":
    unittest.main()
