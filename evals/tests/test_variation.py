"""Run-to-run variation: one brief planned twice should not give one deck.

The runtime broke every tie the same way and the author pinned the same two
layouts on 31 of 43 pages. A deck's `variation` draws, reproducibly, from what
its design system leaves open, and a plan that pins most layouts is told so.
"""
import unittest

from node_probe import run_node


class VariationTests(unittest.TestCase):
    def test_a_seed_is_reproducible_and_seeds_differ(self):
        result = run_node('''
import { planningDraw } from './skills/professional-slides/runtime/variation.mjs';
const draws = ['a', 'b', 'c', 'd', 'e', 'f'].map(seed => planningDraw(seed, 'consulting'));
console.log(JSON.stringify({ again: JSON.stringify(planningDraw('a', 'consulting')) === JSON.stringify(draws[0]),
  distinct: new Set(draws.map(d => JSON.stringify([d.featured, d.runtime]))).size }));
''')
        self.assertTrue(result['again'])
        self.assertGreaterEqual(result['distinct'], 4)

    def test_the_system_keeps_what_it_fixes(self):
        result = run_node('''
import { applyDesign } from './skills/professional-slides/runtime/design-systems.mjs';
const rows = ['a','b','c','d','e','f','g','h'].map(v => applyDesign({ id: 'd', design: 'journal', variation: v, slides: [] }).palette.colors['style.tableRows']);
const free = ['a','b','c','d','e','f','g','h'].map(v => applyDesign({ id: 'd', variation: v, slides: [] }).palette.colors['style.tableRows']);
const pinned = applyDesign({ id: 'd', variation: 'a', tracker: 'pills', slides: [] }).tracker;
console.log(JSON.stringify({ rows: [...new Set(rows)], free: [...new Set(free)].sort(), pinned }));
''')
        self.assertEqual(result['rows'], ['zebra'])
        self.assertEqual(result['free'], ['rules', 'zebra'])
        self.assertEqual(result['pinned'], 'pills')

    def test_unpinned_pages_vary_between_seeds_and_pinned_ones_do_not(self):
        result = run_node('''
import { toDeckPlan } from './skills/professional-slides/runtime/compose.mjs';
const page = (i) => ({ title: 'Revenue rose in every region while costs held flat ' + i,
  exhibit: { type: 'chart.column', categories: ['2021','2022','2023','2024'], series: [{ name: 'Revenue', values: [10, 12, 14, 15 + i] }] },
  points: [{ lead: 'Price led', text: 'List prices rose while volumes held across the period' }, { lead: 'Costs held', text: 'Headcount was flat across the four years' }] });
const slides = Array.from({ length: 10 }, (_, i) => page(i));
const walk = (items) => (items || []).map(i => (i.layout || i.component) + (i.items ? '[' + walk(i.items) + ']' : '')).join(',');
const shapes = (variation, pin) => toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'd', variation, slides: pin ? slides.map(s => ({ ...s, layout: 'exhibit-left' })) : slides }, '.').slides.map(s => walk(s.items)).join('|');
const seeds = ['a','b','c','d','e','f'];
console.log(JSON.stringify({ free: new Set(seeds.map(v => shapes(v))).size, pinned: new Set(seeds.map(v => shapes(v, true))).size }));
''')
        self.assertGreater(result['free'], 1)
        self.assertEqual(result['pinned'], 1)


if __name__ == '__main__':
    unittest.main()
