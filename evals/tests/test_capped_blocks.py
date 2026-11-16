"""Where a block goes when it does not take all the height it is offered.

Three arrow rows in a headed panel were given the whole panel and centred
themselves in it: the heading stayed at the top, the rows floated in the middle
and 120px of nothing stood between the two. A three-item agenda stopped at its
rows' height cap and the height it left went to the foot of the page, so the
list sat at the top over an empty third. One rule covers both: a block that
stops short of its frame says how much it uses (`measureCeiling`), the engine
sizes its track to that, and what is left is the column's free height, placed
like any other - the group in the middle, its heading with it, as much air
above as below. A list no longer centres itself.
"""
import unittest

from node_probe import run_node

PAGE = '''
import { toDeckPlan } from './evals/support/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const slideOf = (slide) => planDeck(toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'c', slides: [{ id: 's', ...slide }] })).deck.slides[0];
const of = (page, role) => page.nodes.filter((n) => n.role === role);
const instance = (page, pick) => page.componentInstances.find(pick);
const foot = (f) => f.y + f.height;
'''

HERO = PAGE + '''
const page = slideOf({ title: 'Moving the model could cut the cost of a minute by about a third', layout: 'hero-number',
  kpi: { value: '33%', label: 'lower cost per minute on the new model' }, source: 'Billing, twelve months',
  exhibit: { type: 'arrow-rows', heading: 'Why move?', items: [
    { icon: 'people', label: 'Tuned for contact centres', text: 'Finds the right playbook among thousands of intents and follows it step by step.' },
    { icon: 'bolt', label: 'Thinks while it speaks', text: 'Answers in about 150 ms, so callers do not hear a pause before each answer.' },
    { icon: 'star', label: 'Top performance', text: 'Top five in every skill of the benchmark and first for sounding natural.' }] } });
'''

AGENDA = PAGE + '''
const topics = ['Introductions', 'Usage at a glance', 'Insights from the filter agent', 'Your priorities', 'Roadmap', 'Wrap-up'];
const agenda = (n) => { const page = slideOf({ title: 'Agenda', layout: 'exhibit-full', exhibit: { type: 'agenda-rows', items: topics.slice(0, n).map((topic) => ({ topic, text: 'What it covers in a line' })) } });
  return { body: page.contentFrame, frame: instance(page, (i) => i.component === 'agenda-rows').frame, rules: of(page, 'agenda-row-rule').map((r) => r.frame.y) }; };
'''


class HeadedPanelTests(unittest.TestCase):
    def test_arrow_rows_start_a_block_gap_under_their_heading_and_the_panel_sits_in_the_middle(self):
        result = run_node(HERO + '''
const panel = instance(page, (i) => i.id === 's-exhibit-panel').frame, rows = instance(page, (i) => i.component === 'arrow-rows').frame;
const shapes = of(page, 'arrow-row-shape').map((n) => n.frame).sort((a, b) => a.y - b.y);
const heading = of(page, 'section-heading')[0].frame;
console.log(JSON.stringify({ body: page.contentFrame, panel, rows, heading, first: shapes[0].y, last: foot(shapes.at(-1)), gaps: shapes.slice(1).map((s, at) => s.y - foot(shapes[at])) }));
''')
        body, panel, rows = result['body'], result['panel'], result['rows']
        # The first row starts where the component's frame does, and that frame a heading band under the panel's top:
        # the heading-to-content gap is the band, not the panel's spare height (it was about 120px).
        self.assertAlmostEqual(result['first'], rows['y'], delta=0.5)
        self.assertLess(rows['y'] - panel['y'], 60)
        self.assertLess(result['first'] - (result['heading']['y'] + result['heading']['height']), 32)
        # The rows open their gaps as far as the page's loosest gap and no further, and end at the panel's foot.
        for gap in result['gaps']:
            self.assertGreater(gap, 16)
            self.assertLessEqual(gap, 48.01)
        self.assertAlmostEqual(result['last'], panel['y'] + panel['height'], delta=0.5)
        # The panel is as tall as its group and stands in the middle of the body, heading and all.
        self.assertLess(panel['height'], body['height'] - 100)
        self.assertAlmostEqual(panel['y'] - body['y'], (body['y'] + body['height']) - (panel['y'] + panel['height']), delta=2)

    def test_a_list_draws_from_the_top_of_a_frame_taller_than_it_uses_and_says_how_much_that_is(self):
        result = run_node('''
import { createRegistry } from './skills/professional-slides/runtime/registry.mjs';
const registry = createRegistry(), frame = { x: 0, y: 100, width: 760, height: 480 };
const cases = { 'arrow-rows': ['arrow-row-shape', { items: [{ label: 'One', text: 'What follows from it' }, { label: 'Two', text: 'What follows from it' }, { label: 'Three', text: 'What follows from it' }] }],
  'stat-list': ['stat-value', { items: [{ value: '58%', text: 'choose it for the source' }, { value: '12%', text: 'can name the source' }] }],
  pictogram: ['pictogram-label', { rows: [{ label: 'Outrun it', value: 8 }, { label: 'Own a plan', value: 2 }], of: 10 }] };
console.log(JSON.stringify(Object.fromEntries(Object.entries(cases).map(([id, [role, props]]) => { const definition = registry.get(id);
  const tops = (at) => definition.render({ id: 'x', frame: at, props }).nodes.filter((n) => n.role === role).map((n) => n.frame.y);
  const ceiling = definition.measureCeiling({ frame, props }), natural = definition.measureContent({ frame, props }).height;
  return [id, { ceiling, natural, top: Math.min(...tops(frame)), tall: tops(frame), fitted: tops({ ...frame, height: ceiling }) }]; }))));
''')
        for name, drawn in result.items():
            # No band above the first row: the list does not centre itself in the 480px it was given.
            self.assertLess(drawn['top'] - 100, 20, name)
            self.assertGreater(drawn['ceiling'], drawn['natural'], name)
            self.assertLess(drawn['ceiling'], 480, name)
            # Past its ceiling more height changes nothing: the rows are where they are in a frame of exactly that height.
            for tall, fitted in zip(drawn['tall'], drawn['fitted']):
                self.assertAlmostEqual(tall, fitted, delta=0.5, msg=name)


class AgendaTests(unittest.TestCase):
    def test_three_items_have_as_much_air_above_as_below(self):
        result = run_node(AGENDA + 'console.log(JSON.stringify(agenda(3)));')
        body, frame = result['body'], result['frame']
        above, below = frame['y'] - body['y'], (body['y'] + body['height']) - (frame['y'] + frame['height'])
        self.assertAlmostEqual(above, below, delta=3)
        self.assertGreater(above, 48)
        # The rows are at their cap, the last rule on the frame's foot: the group is the rows, not the rows and a band.
        self.assertAlmostEqual(frame['height'], 3 * 120, delta=0.5)
        self.assertAlmostEqual(result['rules'][-1], frame['y'] + frame['height'], delta=0.5)

    def test_six_items_still_fill_the_body(self):
        result = run_node(AGENDA + 'console.log(JSON.stringify(agenda(6)));')
        body, frame = result['body'], result['frame']
        self.assertAlmostEqual(frame['y'], body['y'], delta=0.5)
        self.assertAlmostEqual(frame['height'], body['height'], delta=0.5)

    def test_a_near_miss_starts_at_the_top(self):
        # Four rows stop 48px short of the body: 24px above them would read as a mistake, so they start at its top.
        result = run_node(AGENDA + 'console.log(JSON.stringify(agenda(4)));')
        self.assertAlmostEqual(result['frame']['y'], result['body']['y'], delta=0.5)


class RowPeerTests(unittest.TestCase):
    def test_peers_in_a_row_share_their_top_and_bottom_lines(self):
        result = run_node(PAGE + '''
const table = (heading, n) => ({ type: 'table', heading, columns: ['Lever', 'Members'], rows: Array.from({ length: n }, (_, at) => ['Lever ' + (at + 1), String(1000 * (at + 1))]) });
const page = slideOf({ title: 'Two plans, side by side', layout: 'two-up', exhibits: [table('Plan A', 3), table('Plan B', 6)] });
const tables = page.componentInstances.filter((i) => i.component === 'table').map((i) => i.frame);
console.log(JSON.stringify({ body: page.contentFrame, tables }));
''')
        first, second = result['tables']
        # A short table beside a long one is not capped on its own: the two keep one height, top and foot.
        self.assertAlmostEqual(first['y'], second['y'], delta=0.5)
        self.assertAlmostEqual(first['y'] + first['height'], second['y'] + second['height'], delta=0.5)

    def test_a_capped_exhibit_and_the_points_beside_it_keep_one_row(self):
        result = run_node(HERO + '''
const row = instance(page, (i) => i.id === 's-row').frame, panel = instance(page, (i) => i.id === 's-exhibit-panel').frame, kpi = instance(page, (i) => i.component === 'metric').frame;
console.log(JSON.stringify({ row, panel, kpi }));
''')
        row, panel, kpi = result['row'], result['panel'], result['kpi']
        # The row is as tall as its tallest block needs; the figure beside the panel is centred on the same middle line.
        self.assertAlmostEqual(panel['y'], row['y'], delta=0.5)
        self.assertAlmostEqual(panel['height'], row['height'], delta=0.5)
        self.assertAlmostEqual(kpi['y'] + kpi['height'] / 2, row['y'] + row['height'] / 2, delta=2)


if __name__ == '__main__':
    unittest.main()
