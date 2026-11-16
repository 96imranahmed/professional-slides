"""tasteful-layout: the arrangement of a group of blocks is chosen, not ruled.

Every arrangement that keeps the reading order is laid out by Taffy and scored
on how it reads - text past its readable measure, empty frame, columns ending at
different heights, a squeezed exhibit - and the best one stands. The module
knows nothing about slides: blocks, a frame and a measure in, a choice out.
"""
import unittest

from node_probe import run_node

MODULE = '''
import { arrange } from './skills/professional-slides/runtime/tasteful-layout/index.mjs';
import { TASTE } from './skills/professional-slides/runtime/core.mjs';
// The runtime's own taste, so a change to the presets is a change these tests see; the gaps and the measure are its tokens' values.
const PRESETS = { gap: { major: 32, minor: 16 }, measure: { min: 240, max: 480 }, fill: TASTE.fill, weights: TASTE.weights };
const text = (id, chars) => ({ id, chars });
const chart = { id: 'chart', sizing: 'fill' };
// A block of text is as tall as its lines at the width it is given, read at 480px at most.
const measure = (block, width) => Math.ceil((block.chars * 6.6) / Math.min(width, 480)) * 20;
const pick = (blocks, frame) => { const r = arrange({ id: 'g', blocks }, frame, measure, PRESETS); return { kind: r.kind, shares: r.shares, columns: r.columns, share: r.share, score: r.score, frames: r.frames, scores: r.scores }; };
'''


class TastefulLayoutTests(unittest.TestCase):
    def test_peers_sit_side_by_side_where_each_can_be_read_and_stack_where_not(self):
        result = run_node(MODULE + '''
const paragraphs = [text('a', 110), text('b', 130)];
console.log(JSON.stringify({ wide: pick(paragraphs, { width: 686, height: null }), narrow: pick(paragraphs, { width: 320, height: null }),
  three: pick([...paragraphs, text('c', 120)], { width: 1160, height: null }) }));
''')
        self.assertEqual(result['wide']['kind'], 'row')
        self.assertEqual(result['narrow']['kind'], 'column')
        # A candidate that sets a block too narrow to read is disqualified, not merely marked down.
        self.assertTrue(all(s['total'] is None for s in result['narrow']['scores'] if s['kind'] != 'column'))
        self.assertEqual((result['three']['kind'], result['three']['shares']), ('row', [1, 1, 1]))

    def test_an_exhibit_takes_the_larger_share_beside_its_points(self):
        result = run_node(MODULE + '''
console.log(JSON.stringify({ beside: pick([chart, text('a', 120), text('b', 140), text('c', 110)], { width: 1160, height: 508 }) }));
''')
        beside = result['beside']
        self.assertEqual((beside['kind'], beside['share']), ('lead', 2))
        chart, first = beside['frames'][0], beside['frames'][1]
        self.assertAlmostEqual(chart['height'], 508, delta=1)
        self.assertGreater(chart['width'], 1.9 * first['width'])
        # Every candidate is reported with its measures, best first, so a caller can see why.
        totals = [s['total'] for s in beside['scores'] if s['total'] is not None]
        self.assertEqual(totals, sorted(totals))
        self.assertTrue(all(key in beside['scores'][0] for key in ('whitespace', 'balance', 'uniformity', 'regularity', 'proportion', 'simplicity')))

    def test_the_presets_are_the_callers_and_the_gap_follows_what_a_group_holds(self):
        result = run_node(MODULE + '''
let refused = null;
try { arrange({ id: 'g', blocks: [text('a', 100), text('b', 100)] }, { width: 900, height: null }, measure); } catch (error) { refused = error.message; }
const words = arrange({ id: 'g', blocks: [text('a', 100), text('b', 100)] }, { width: 900, height: null }, measure, PRESETS);
const page = arrange({ id: 'g', blocks: [chart, text('a', 100)] }, { width: 900, height: 500 }, measure, PRESETS);
const own = arrange({ id: 'g', gap: 40, blocks: [text('a', 100), text('b', 100)] }, { width: 900, height: null }, measure, PRESETS);
const between = (r) => (r.kind === 'row' ? r.frames[1].x - r.frames[0].x - r.frames[0].width : r.frames[1].y - r.frames[0].y - r.frames[0].height);
console.log(JSON.stringify({ refused, words: [words.gap, between(words)], page: [page.gap, between(page)], own: own.gap }));
''')
        self.assertIn('takes its presets from the caller', result['refused'])
        self.assertEqual(result['words'], [16, 16])
        self.assertEqual(result['page'], [32, 32])
        self.assertEqual(result['own'], 40)

    def test_a_group_inside_a_group_is_arranged_in_the_frame_it_is_given(self):
        result = run_node(MODULE + '''
const r = arrange({ id: 'page', blocks: [chart, { id: 'side', blocks: [text('number', 12), text('a', 120), text('b', 140), text('c', 110)] }] }, { width: 1160, height: 508 }, measure, PRESETS);
console.log(JSON.stringify({ outer: r.kind, shares: r.shares, inner: r.frames[1].children.kind, innerWidth: r.frames[1].width, blocks: r.frames[1].children.frames.map((f) => f.id) }));
''')
        self.assertEqual((result['outer'], result['shares']), ('row', [2, 1]))
        self.assertEqual(result['inner'], 'column')
        self.assertEqual(result['blocks'], ['number', 'a', 'b', 'c'])

    def test_the_engine_arranges_a_flow_left_to_it(self):
        result = run_node('''
import { component, flow, resolveLayout } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const paragraph = (id) => component({ id, component: 'paragraph', props: { text: 'Long prompts drive the surcharge, and the two recommendations that shorten them cut the context behind it for every call.' }, size: { height: 'hug' } });
const group = () => flow({ id: 'prose', direction: 'best', children: [paragraph('a'), paragraph('b')] });
const at = (width) => resolveLayout(group(), { x: 0, y: 0, width, height: null }, REGISTRY).map((p) => [p.frame.x, p.frame.y]);
console.log(JSON.stringify({ wide: at(700), narrow: at(320) }));
''')
        # Side by side in a wide frame, stacked in a narrow one.
        self.assertEqual(result['wide'][0][1], result['wide'][1][1])
        self.assertGreater(result['wide'][1][0], result['wide'][0][0])
        self.assertEqual(result['narrow'][0][0], result['narrow'][1][0])
        self.assertGreater(result['narrow'][1][1], result['narrow'][0][1])


class ArrangedPageTests(unittest.TestCase):
    """A page left to the engine: the exhibit and its commentary beside each other or one over the other, whichever reads better."""

    def test_short_points_run_across_under_the_exhibit_and_a_long_argument_stands_beside_it(self):
        result = run_node('''
import { toDeckPlan } from './evals/support/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const exhibit = { type: 'chart.column', heading: 'Spend', unit: '%', categories: ['A', 'B', 'C', 'D'], series: [{ name: 'Share', values: [23, 22, 18, 12] }] };
const short = ['Answers in about 150 ms', 'Top of the voice benchmark', 'Built for contact-center scale'].map((lead) => ({ lead, text: 'A sentence of explanation that runs on for a line or so.' }));
const long = Array.from({ length: 5 }, (_, at) => ({ lead: 'Finding ' + (at + 1), text: 'A developed finding that takes several lines to state, with the evidence it rests on, the condition that would change it and what the reader should do about it this quarter.' }));
const frames = (points) => { const slide = planDeck(toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'a', slides: [{ id: 's', title: 'Spend is concentrated in three lines', layout: 'arranged', exhibit, points }] })).deck.slides[0];
  const of = (match) => slide.componentInstances.filter((instance) => match(instance)).map((instance) => instance.frame);
  return { chart: of((i) => i.component === 'chart.column')[0], lists: of((i) => i.component === 'bullet-list') }; };
console.log(JSON.stringify({ short: frames(short), long: frames(long) }));
''')
        short, long = result['short'], result['long']
        # Three short points: the chart takes the page's width and the points one row under it, in columns.
        self.assertGreater(short['chart']['width'], 1100)
        self.assertEqual(len({lst['y'] for lst in short['lists']}), 1)
        self.assertTrue(all(lst['y'] > short['chart']['y'] + short['chart']['height'] for lst in short['lists']))
        # Five developed findings would flatten the chart into a strip: they stand beside it instead, and it keeps its height.
        self.assertLess(long['chart']['width'], 900)
        self.assertGreater(long['chart']['height'], 500)
        self.assertTrue(all(lst['x'] > long['chart']['x'] + long['chart']['width'] for lst in long['lists']))

    def test_a_typed_page_leaves_the_placement_to_the_engine_with_commentary_auto(self):
        result = run_node('''
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
const slide = compilePage({ id: 'p', type: 'ranking', form: 'column', commentary: 'auto', title: 'Spend is concentrated in three lines', source: 'Billing, 2026',
  exhibit: { heading: 'Spend', unit: '%', categories: ['A', 'B', 'C'], series: [{ name: 'Share', values: [23, 22, 18] }] }, points: ['The first line carries a quarter of spend', 'The second is close behind it'] }, 0);
console.log(JSON.stringify({ layout: slide.layout }));
''')
        self.assertEqual(result['layout'], 'arranged')


if __name__ == '__main__':
    unittest.main()
