"""A chart prints its values at one precision, a bridge's labels add up, and a map's names stay with their markers.

The BA retest's review rejected pages that every gate passed. hb02 called 2025
out as 174.5 passengers a flight over a bar the chart rounded to 175, since the
chart read no callout for the precision the page quotes. sh04's lollipop raised
only the quoted BA rate to two places, so Air France printed 1.6 beside BA's
1.60, higher-looking yet lower. fd06's bridge printed its quoted ends to two
places and its steps to one: 0.63, +0.0, -0.1, +0.2 and 0.71, which add to
0.73. lc02's valued hub discs over north-west Europe sat on each other, and
Heathrow's name landed beside Amsterdam's +4.4%.
"""
import unittest

from node_probe import run_node

PLANNED = '''
import { toDeckPlan } from './evals/support/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const plan = (slides) => planDeck(toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'd', slides })).deck;
const labels = (deck) => deck.slides[0].nodes.filter((n) => n.role === 'data-label').map((n) => n.text);
'''


class OneChartPrecisionTests(unittest.TestCase):
    def test_a_quoted_value_raises_every_label_of_its_chart(self):
        """BA retest sh04: the quoted 1.60 printed at two places and Air France's 1.58 at one."""
        result = run_node('''
import { formatValue } from './skills/professional-slides/runtime/value-format.mjs';
const values = [0.11, 0.21, 0.41, 0.74, 0.87, 1.11, 1.58, 1.6, 1.7, 2.63, 2.7];
const props = { values, quotedFigures: [{ value: 1.6, decimals: 2 }, { value: 0.74, decimals: 2 }] };
console.log(JSON.stringify(values.map((v) => formatValue(v, props))));
''')
        self.assertEqual(result, ['0.11', '0.21', '0.41', '0.74', '0.87', '1.11', '1.58', '1.60', '1.70', '2.63', '2.70'])

    def test_a_chart_reads_its_own_callouts_for_the_precision_the_page_quotes(self):
        """BA retest hb02: a callout of 174.5 a flight stood over a bar labelled 175."""
        result = run_node(PLANNED + '''
const chart = (annotations) => ({ type: 'chart.column', heading: 'Passengers per flight', categories: ['2021', '2022', '2023', '2024', '2025'],
  series: [{ name: 'Passengers per flight', values: [100.5, 160.4, 170.6, 174, 174.5] }], highlights: [{ category: '2025' }], annotations });
const page = (annotations) => ({ id: 's', title: 'Heathrow carries more passengers on each flight than ever before', layout: 'exhibit-full', exhibit: chart(annotations) });
console.log(JSON.stringify({ called: labels(plan([page([{ category: '2025', text: '174.5 a flight in 2025, the most yet' }])])),
  silent: labels(plan([page([{ category: '2025', text: 'The most in the five years' }])])) }));
''')
        self.assertEqual(result['called'], ['100.5', '160.4', '170.6', '174.0', '174.5'])
        # With nothing quoted the chart keeps its whole numbers past a hundred.
        self.assertEqual(result['silent'][-1], '175')


class BridgeLabelTests(unittest.TestCase):
    def test_a_bridge_prints_its_steps_at_the_precision_that_adds_up_to_its_ends(self):
        """BA retest fd06: ends quoted to two places, steps printed to one, and the steps added to 0.73, not 0.71."""
        result = run_node('''
import { waterfall } from './skills/professional-slides/runtime/chart-specialty.mjs';
const draw = (props) => waterfall({ id: 'w', frame: { x: 0, y: 0, width: 900, height: 480 }, props: { categories: ['2024', 'Revenue', 'Non-fuel', 'Fuel', '2025'], totals: [0, 4], ...props } })
  .filter((n) => n.role === 'data-label').map((n) => n.text);
console.log(JSON.stringify({ quoted: draw({ values: [0.63, 0.01, -0.12, 0.19, 0.71], quotedFigures: [{ value: 0.63, decimals: 2 }, { value: 0.71, decimals: 2 }] }),
  unquoted: draw({ values: [1.24, 0.14, 0.14, 0, 1.52] }) }));
''')
        self.assertEqual(result['quoted'], ['0.63', '+0.01', '-0.12', '+0.19', '0.71'])
        # At one place 1.2 + 0.1 + 0.1 + 0.0 is 1.4, not the 1.5 printed: the chart takes the second place, which adds up.
        self.assertEqual(result['unquoted'], ['1.24', '+0.14', '+0.14', '+0.00', '1.52'])


class MapMarkerTests(unittest.TestCase):
    def test_close_valued_markers_are_spread_apart_and_each_name_stays_with_its_own(self):
        """BA retest lc02: Heathrow, Amsterdam, Paris, Frankfurt and Munich's valued discs overlapped and swapped names."""
        result = run_node('''
import { mapNodes } from './skills/professional-slides/runtime/maps.mjs';
import { sceneChartFindings } from './skills/professional-slides/runtime/validate-overlap.mjs';
const hubs = [['London Heathrow', -0.454, 51.47, 4.4], ['Amsterdam', 4.764, 52.31, -4.1], ['Paris CDG', 2.55, 49.01, -5.4], ['Frankfurt', 8.57, 50.03, -10.4], ['Munich', 11.79, 48.35, -9.5], ['Istanbul', 28.75, 41.28, 24]];
const markers = hubs.map(([label, longitude, latitude, value]) => ({ label, longitude, latitude, value, style: 'badge', display: `${value > 0 ? '+' : ''}${value.toFixed(1)}%`, hub: label === 'London Heathrow' }));
const nodes = mapNodes({ id: 'm', frame: { x: 0, y: 0, width: 360, height: 220 }, props: { geography: 'emea', crop: 'fit', markers } });
const discs = nodes.filter((n) => n.role === 'map-marker' && n.data?.badge);
let overlaps = 0;
for (let i = 0; i < discs.length; i++) for (let j = i + 1; j < discs.length; j++) {
  const [a, b] = [discs[i].frame, discs[j].frame];
  if (Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2) < (a.width + b.width) / 2) overlaps += 1;
}
console.log(JSON.stringify({ overlaps, astray: sceneChartFindings({ id: 's', nodes }).filter((f) => f.code === 'MAP_LABEL_ASTRAY'), placed: nodes.filter((n) => n.role === 'map-marker-place').length }));
''')
        self.assertEqual(result['overlaps'], 0)
        self.assertEqual(result['astray'], [])
        # A disc drawn away from its airport keeps a dot on the airport.
        self.assertGreater(result['placed'], 0)

    def test_a_name_nearer_another_marker_than_its_own_is_refused(self):
        """BA retest lc02: Heathrow's name sat under Amsterdam's disc, so its value read as Amsterdam's."""
        result = run_node('''
import { sceneChartFindings } from './skills/professional-slides/runtime/validate-overlap.mjs';
const disc = (i, x) => ({ id: `d${i}`, type: 'ellipse', role: 'map-marker', frame: { x, y: 100, width: 40, height: 40 }, data: { markerIndex: i } });
const label = (x) => ({ id: 'l0', type: 'text', role: 'map-label', text: 'London Heathrow', frame: { x, y: 145, width: 90, height: 14 }, data: { markerIndex: 0 } });
const leader = { id: 'k0', type: 'line', role: 'map-label-leader', x1: 0, y1: 0, x2: 1, y2: 1, data: { markerIndex: 0 } };
const run = (nodes) => sceneChartFindings({ id: 's', nodes }).filter((f) => f.code === 'MAP_LABEL_ASTRAY').map((f) => [f.label, f.marker, f.nearer]);
console.log(JSON.stringify({ astray: run([disc(0, 100), disc(1, 200), label(195)]), own: run([disc(0, 100), disc(1, 200), label(90)]), led: run([disc(0, 100), disc(1, 200), label(195), leader]) }));
''')
        self.assertEqual(result['astray'], [['London Heathrow', 0, 1]])
        self.assertEqual(result['own'], [])
        # A leader to its own marker joins a name set farther out.
        self.assertEqual(result['led'], [])


if __name__ == "__main__":
    unittest.main()
