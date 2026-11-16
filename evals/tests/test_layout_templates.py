"""A page set on a grid of its own, written as CSS grid writes one.

The template says where things sit and nothing about what they are: the page
keeps its content in the fields every page has, and each named area takes the
content of its name or what `place` stacks in it. The layout engine (Taffy, a CSS
grid engine) resolves the tracks, so `fr`, `auto`, a length and `minmax()` mean
what they mean in a browser, and the HTML output carries the same grid.
"""
import unittest

from node_probe import run_node

PAGE = '''
import { toDeckPlan } from './evals/support/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
import { slideHtml } from './skills/professional-slides/runtime/emit/emit_html.mjs';
const points = ['Answers in about 150 ms', 'Top of the voice benchmark', 'Built for contact-center scale'].map((lead) => ({ lead, text: 'A sentence of explanation that runs on for a line or so beside the chart.' }));
const base = { title: 'Moving the model could cut total spend by 8% to 30%', kpi: { value: '8-30%', label: 'of total spend' }, points,
  exhibit: { type: 'chart.column', heading: 'Spend', unit: '%', categories: ['A', 'B', 'C'], series: [{ name: 'Share', values: [23, 22, 18] }] } };
const compose = (slides, layouts) => planDeck(toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'grids', ...(layouts ? { layouts } : {}), slides })).deck;
const frames = (slide) => Object.fromEntries(slide.componentInstances.map((instance) => [instance.id, instance.frame]));
const refused = (grid, more = {}) => { try { compose([{ id: 'r', ...base, ...more, grid }]); return null; } catch (error) { return error.message; } };
'''


class GridTemplateTests(unittest.TestCase):
    def test_areas_take_the_content_of_their_name_on_css_tracks(self):
        result = run_node(PAGE + '''
const deck = compose([{ id: 'a', ...base, grid: { columns: '2fr 1fr', rows: 'auto 1fr', areas: ['exhibit kpi', 'exhibit points'] } },
  { id: 'b', ...base, grid: { columns: 'minmax(400px, 1fr) 3fr', areas: ['side exhibit'], gap: 'space.6', place: { side: { content: ['kpi', 'points'], heading: 'Why it matters', align: 'center' } } } }]);
const a = frames(deck.slides[0]), b = frames(deck.slides[1]);
const html = slideHtml(deck.slides[0]);
console.log(JSON.stringify({ a, b, grid: /data-layout="grid"[^>]*data-template="auto 1fr \\/ 2fr 1fr"/.test(html), css: /grid-template-columns:[0-9.]+px [0-9.]+px/.test(html) }));
''')
        a, b = result['a'], result['b']
        # 2fr and 1fr of the body less one gap; the number's row is as tall as the number, the points take the rest.
        self.assertAlmostEqual(a['a-exhibit']['width'], 2 * a['a-kpi']['width'], delta=0.01)
        # A page's areas stand a major gap apart (space.major, 32px) unless the template names its own.
        self.assertAlmostEqual(a['a-exhibit']['width'] + a['a-kpi']['width'] + 32, 1160, delta=0.01)
        # The points are blocks of their own cell, under the number and within the exhibit's height.
        points = sorted((frame for key, frame in a.items() if key.startswith('a-points-')), key=lambda frame: frame['y'])
        self.assertEqual(a['a-kpi']['x'], points[0]['x'])
        gap = points[0]['y'] - (a['a-kpi']['y'] + a['a-kpi']['height'])
        self.assertGreaterEqual(gap, 16 - 0.01)
        self.assertLessEqual(points[-1]['y'] + points[-1]['height'], a['a-exhibit']['y'] + a['a-exhibit']['height'] + 0.01)
        # minmax(400px, 1fr) beside 3fr: a quarter of the row would be 284px, so the floor holds.
        self.assertAlmostEqual(b['b-side']['width'], 400, delta=0.01)
        self.assertAlmostEqual(b['b-exhibit']['width'], 1160 - 400 - 32, delta=0.01)
        self.assertLess(b['b-side']['x'], b['b-exhibit']['x'])
        # The HTML carries the same grid: the tracks as written beside the tracks as resolved.
        self.assertTrue(result['grid'])
        self.assertTrue(result['css'])

    def test_a_deck_keeps_its_own_templates_and_a_page_takes_one_by_name(self):
        result = run_node(PAGE + '''
const layouts = { 'lead-left': { columns: '1fr 2fr', areas: ['text exhibit'], place: { text: ['kpi', 'points'] } } };
const named = frames(compose([{ id: 'n', ...base, grid: 'lead-left' }], layouts).slides[0]);
const inline = frames(compose([{ id: 'n', ...base, grid: layouts['lead-left'] }]).slides[0]);
console.log(JSON.stringify({ same: JSON.stringify(named) === JSON.stringify(inline), order: named['n-kpi'].x < named['n-exhibit'].x, unknown: refused('missing') }));
''')
        self.assertTrue(result['same'])
        self.assertTrue(result['order'])
        self.assertIn('layouts', result['unknown'])

    def test_a_grid_never_drops_or_invents_content_and_says_what_is_wrong(self):
        result = run_node(PAGE + '''
console.log(JSON.stringify({
  unplaced: refused({ areas: ['exhibit kpi'] }),
  absent: refused({ areas: ['exhibit points', 'exhibit paragraphs'] }, { kpi: undefined }),
  notContent: refused({ areas: ['exhibit sidebar'] }),
  ragged: refused({ areas: ['exhibit points', 'kpi'] }),
  shape: refused({ areas: ['exhibit points', 'kpi exhibit'] }),
  track: refused({ columns: '2fr wide', areas: ['exhibit points'] }, { kpi: undefined }),
  twice: refused({ areas: ['exhibit points', 'kpi side'], place: { side: 'points' } }) }));
''')
        self.assertIn('gives it no area', result['unplaced'])
        self.assertIn('the page has none', result['absent'])
        self.assertIn('not content a page carries', result['notContent'])
        self.assertIn('same number of columns', result['ragged'])
        self.assertIn('not a rectangle', result['shape'])
        self.assertIn('a track is', result['track'])
        self.assertIn('more than one area', result['twice'])

    def test_a_typed_page_takes_a_grid_as_its_commentary(self):
        result = run_node('''
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
const page = { id: 'p', type: 'ranking', form: 'column', title: 'Spend is concentrated in three lines', source: 'Billing, 2026',
  exhibit: { heading: 'Spend', unit: '%', categories: ['A', 'B', 'C'], series: [{ name: 'Share', values: [23, 22, 18] }] },
  points: ['The first line carries a quarter of spend', 'The second is close behind it'], kpi: { value: '63%', label: 'in three lines' },
  grid: { columns: '2fr 1fr', rows: 'auto 1fr', areas: ['exhibit kpi', 'exhibit points'] } };
const slide = compilePage(page, 0);
let orphan = null; try { compilePage({ ...page, commentary: 'beside' }, 0); } catch (error) { orphan = error.message; }
console.log(JSON.stringify({ layout: slide.layout, areas: slide.grid.areas.map((area) => area.name), orphan }));
''')
        self.assertEqual(result['layout'], 'template')
        self.assertEqual(result['areas'], ['exhibit', 'kpi', 'points'])
        self.assertIn('commentary "grid"', result['orphan'])


if __name__ == '__main__':
    unittest.main()
