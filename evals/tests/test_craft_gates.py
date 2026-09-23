"""Deck craft floors and the route map.

A 62-page deck shipped with eleven of sixteen charts plotting two numbers, no
table treated, no chart annotated, five step diagrams, no icons, six airlines
compared and never introduced, and a map whose 34px discs sat on country
centres with twelve countries filled. The floors read the built deck and
block; the map places cities, draws routes and crops to the network.
"""
import unittest

from node_probe import run_node


class CraftFloorTests(unittest.TestCase):
    def test_two_number_charts_steps_and_unintroduced_players_block(self):
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
        result = run_node('''
import { craftFindings } from './skills/professional-slides/runtime/gates/craft_gates.mjs';
const slides = Array.from({ length: 12 }, (_, i) => ({ id: 'p' + i, title: 'Page ' + i, exhibit: { type: 'table', columns: ['A'], rows: [['x']] } }));
const scene = (role) => ({ slides: Array.from({ length: 12 }, () => ({ nodes: [{ role: 'action-title' }, { role }], componentInstances: [{ component: 'table' }] })) });
const codes = (role) => craftFindings({ slides }, scene(role)).map(f => f.code);
console.log(JSON.stringify({ zebra: codes('table-zebra-band'), harvey: codes('table-harvey-ball') }));
''')
        self.assertIn('CRAFT_TABLES_PLAIN', result['zebra'])
        self.assertNotIn('CRAFT_TABLES_PLAIN', result['harvey'])


class RouteMapTests(unittest.TestCase):
    def test_cities_routes_and_crop(self):
        result = run_node('''
import { mapNodes } from './skills/professional-slides/runtime/maps.mjs';
const frame = { x: 0, y: 0, width: 800, height: 450 };
const markers = [{ id: 'ruh', label: 'Riyadh', longitude: 46.7, latitude: 24.7, hub: true }, { id: 'lhr', label: 'London', longitude: -0.45, latitude: 51.5 }, { id: 'bom', label: 'Mumbai', longitude: 72.9, latitude: 19.1 }];
const nodes = mapNodes({ id: 'm', frame, props: { geography: 'world', crop: 'fit', markers, routes: [{ from: 'ruh', to: 'lhr' }, { from: 'ruh', to: 'bom', status: 'planned' }] } });
let refused = null;
try { mapNodes({ id: 'm', frame, props: { geography: 'world', markers: [{ country: 'IND', label: 'Mumbai' }] } }); } catch (e) { refused = e.message; }
const dot = nodes.find(n => n.role === 'map-marker' && !n.data.hub);
const routes = nodes.filter(n => n.role === 'map-route');
const land = nodes.filter(n => n.role === 'map-land');
console.log(JSON.stringify({ dot: dot.frame.width, routes: routes.length, dashes: routes[1].data.paths.length, solid: routes[0].data.paths.length,
  land: land.length, refused, labels: nodes.filter(n => n.role === 'map-label').length }));
''')
        self.assertEqual(result['dot'], 10)
        self.assertEqual(result['routes'], 2)
        self.assertEqual(result['solid'], 1)
        self.assertGreater(result['dashes'], 4)
        self.assertLess(result['land'], 120)  # cropped to the network, not every country
        self.assertIn('longitude and latitude', result['refused'])
        self.assertEqual(result['labels'], 3)



class SizeLegendAndNotesTests(unittest.TestCase):
    def test_valued_markers_need_a_legend_and_it_scales_by_area(self):
        result = run_node('''
import { mapNodes, valueDiameter } from './skills/professional-slides/runtime/maps.mjs';
const frame = { x: 0, y: 0, width: 800, height: 450 };
const markers = [{ id: 'a', label: 'Riyadh', longitude: 46.7, latitude: 24.7, hub: true }, { id: 'b', label: 'Shanghai', longitude: 121.5, latitude: 31.2, value: 25 }, { id: 'c', label: 'Warsaw', longitude: 21, latitude: 52.2, value: 2 }];
let refused = null; try { mapNodes({ id: 'm', frame, props: { geography: 'world', crop: 'fit', markers } }); } catch (e) { refused = e.message; }
const out = {};
for (const style of ['row', 'stacked']) out[style] = mapNodes({ id: 'm', frame, props: { geography: 'world', crop: 'fit', markers, sizeLegend: { label: 'City population, m', style } } }).filter(n => n.role === 'map-size-legend-circle').length;
console.log(JSON.stringify({ refused, ratio: (valueDiameter(25, 25) / valueDiameter(6.25, 25)), ...out }));
''')
        self.assertIn('sizeLegend.label', result['refused'])
        self.assertAlmostEqual(result['ratio'], 2.0, places=3)  # a quarter of the value, half the diameter
        self.assertGreaterEqual(result['row'], 2)
        self.assertEqual(result['row'], result['stacked'])

    def test_long_bar_notes_move_to_a_column_instead_of_overlapping(self):
        result = run_node('''
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const cats = ['Riyadh Air','IndiGo','Akasa Air','Breeze Airways','STARLUX','Norse Atlantic','Etihad Airways','Emirates','Qatar Airways'];
const props = { categories: cats, series: [{ name: 'Orders', values: [124,100,72,60,17,0,0,0,0] }], categoryNotes: cats.map((_, i) => i % 2 ? '28 months, leased at first' : '39 months to service') };
const nodes = REGISTRY.get('chart.bar').render({ id: 'c', frame: { x: 0, y: 0, width: 1160, height: 240 }, props }).nodes;
const notes = nodes.filter(n => n.role === 'category-note'), labels = nodes.filter(n => n.role === 'category-label');
const overlap = (a, b) => a.frame.x < b.frame.x + b.frame.width && b.frame.x < a.frame.x + a.frame.width && a.frame.y < b.frame.y + b.frame.height && b.frame.y < a.frame.y + a.frame.height;
console.log(JSON.stringify({ column: notes.every(n => n.data.column), clash: notes.some(n => labels.some(l => overlap(n, l))) || notes.some((n, i) => notes.some((m, j) => i !== j && overlap(n, m))) }));
''')
        self.assertTrue(result['column'])
        self.assertFalse(result['clash'])

if __name__ == '__main__':
    unittest.main()
