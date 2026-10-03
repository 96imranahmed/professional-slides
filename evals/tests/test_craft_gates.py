"""Deck craft floors (runtime/gates/craft_gates.mjs).

A 62-page deck shipped with eleven of sixteen charts plotting two numbers, no
table treated, five step diagrams and six airlines compared and never
introduced; an Emirates deck coded its sources and spent its brand colour on
every bar. The floors read the spec and the built scene, and block.
"""
import unittest

from node_probe import run_node


class CraftFloorTests(unittest.TestCase):
    def test_two_number_charts_steps_and_unintroduced_players_block(self):
        """62-page deck: eleven of sixteen charts plotted two numbers, five step diagrams, players never introduced."""
        result = run_node('''
import { craftFindings, trivialChart, trendChart } from './skills/professional-slides/runtime/gates/craft_gates.mjs';
const pair = { type: 'chart.column', categories: ['A', 'B'], series: [{ name: 'Fleet', values: [30, 120] }] };
const trend = { type: 'chart.line', categories: ['2020','2021','2022','2023','2024'], series: [{ name: 'Revenue', values: [1,2,3,4,5] }] };
const page = (i, exhibit) => ({ id: 'p' + i, title: 'A finding on page ' + i, exhibit });
const slides = [...Array.from({ length: 8 }, (_, i) => page(i, pair)), ...Array.from({ length: 4 }, (_, i) => page(10 + i, { type: 'steps', steps: [] })), page(20, trend)];
const codes = (spec) => craftFindings(spec, { slides: [] }).filter(f => f.severity === 'blocker').map(f => f.code).sort();
console.log(JSON.stringify({
  pair: trivialChart(pair), trend: trivialChart(trend), isTrend: trendChart(trend),
  blocked: codes({ slides, players: ['One', 'Two', 'Three'] }),
  catalogue: codes({ slides, purpose: 'catalogue', players: ['One', 'Two', 'Three'] }),
  short: codes({ slides: slides.slice(0, 5) }) }));
''')
        self.assertTrue(result['pair'])
        self.assertFalse(result['trend'])
        self.assertTrue(result['isTrend'])
        self.assertEqual(result['blocked'], ['CRAFT_PLAYERS_UNINTRODUCED', 'CRAFT_STEP_OVERUSE', 'CRAFT_TRIVIAL_CHARTS'])
        self.assertEqual(result['catalogue'], [])
        self.assertEqual(result['short'], [])

    def test_zebra_rows_are_not_a_table_treatment(self):
        """62-page deck: zebra rows were counted as a table treatment."""
        result = run_node('''
import { craftFindings } from './skills/professional-slides/runtime/gates/craft_gates.mjs';
const slides = Array.from({ length: 12 }, (_, i) => ({ id: 'p' + i, title: 'Page ' + i, exhibit: { type: 'table', columns: ['A'], rows: [['x']] } }));
const scene = (role) => ({ slides: Array.from({ length: 12 }, () => ({ nodes: [{ role: 'action-title' }, { role }], componentInstances: [{ component: 'table' }] })) });
const codes = (role) => craftFindings({ slides }, scene(role)).map(f => f.code);
console.log(JSON.stringify({ zebra: codes('table-zebra-band'), harvey: codes('table-harvey-ball') }));
''')
        self.assertIn('CRAFT_TABLES_PLAIN', result['zebra'])
        self.assertNotIn('CRAFT_TABLES_PLAIN', result['harvey'])


class CraftFinishTests(unittest.TestCase):
    """An Emirates deck delivered at 8/10 that a reader called ugly on sight."""

    def test_shares_as_bars_coded_sources_and_brand_emphasis(self):
        """Emirates deck: a share drawn as two bars, sources written as codes, and the brand colour spent on every bar."""
        result = run_node('''
import { craftFindings, shareAsBars, codedSource } from './skills/professional-slides/runtime/gates/craft_gates.mjs';
import { identityColors } from './skills/professional-slides/runtime/design-systems.mjs';
const share = { type: 'chart.bar', categories: ['Cargo', 'Other'], series: [{ name: 'Share', values: [12, 88] }] };
const pair = { type: 'chart.bar', categories: ['2025', '2030 target'], series: [{ name: 'Pax', values: [141, 330] }] };
const trend = { type: 'chart.line', categories: ['2020','2021','2022','2023','2024'], series: [{ name: 'Revenue', values: [1,2,3,4,5] }] };
const slides = [share, trend, trend, trend, trend, trend, trend, trend].map((exhibit, i) => ({ id: 'p' + i, title: 'A finding on page ' + i, exhibit, source: 'Source: Emirates Group Annual Report 2025-26' }))
  .concat(Array.from({ length: 6 }, (_, i) => ({ id: 'q' + i, title: 'Text page ' + i, source: i ? 'Source: IATA' : 'Source: E26+DXB+SKY; exact URL in source ledger' })));
const codes = craftFindings({ slides }, { slides: [] }).filter(f => f.severity === 'blocker').map(f => f.code).sort();
const c = identityColors({ primary: '#C8102E', accent: '#C49A6C' });
console.log(JSON.stringify({ share: shareAsBars(share), pair: shareAsBars(pair), coded: codedSource('Source: E26+DXB+SKY'), named: codedSource('Source: Dubai Airports, Feb 2026'), codes, accent: c['color.accent'], base: c['color.chartSeries1'] }));
''')
        self.assertTrue(result['share'])
        self.assertFalse(result['pair'])
        self.assertTrue(result['coded'])
        self.assertFalse(result['named'])
        self.assertEqual(result['codes'], ['CRAFT_SOURCE_CODES', 'CRAFT_TRIVIAL_CHARTS'])  # one share-as-bars chart of eight still blocks
        self.assertEqual(result['accent'], '#C8102E')  # the brand colour marks the focus
        self.assertNotEqual(result['base'], '#C8102E')  # and is not spent on every other bar


if __name__ == "__main__":
    unittest.main()
