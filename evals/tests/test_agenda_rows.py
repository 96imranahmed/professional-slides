"""An agenda is a page of its own: a numbered row a topic, the rows filling the body.

`summary/agenda` draws the `agenda-rows` component: rows of one height down the
frame with a hairline under each, a square numbered tile, the topic in bold and
its description at one column across every row. `active` marks the item a
meeting has reached. The component holds two to eight items and says how far
its rows grow, so a short agenda stays one group instead of bands of air.
"""
import unittest

from node_probe import run_node

PAGE = '''
import { toDeckPlan } from './evals/support/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const topics = ['Introductions', 'Usage at a glance', 'Insights from the filter agent', 'Your priorities and new use cases', 'Roadmap', 'Wrap-up', 'Commercials', 'Any other business', 'One too many'];
const items = (n) => topics.slice(0, n).map((topic, at) => ({ topic, text: 'What item ' + (at + 1) + ' covers in a line' }));
const slide = (exhibit) => planDeck(toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'a', slides: [{ id: 's', title: 'Agenda', layout: 'exhibit-full', exhibit: { type: 'agenda-rows', ...exhibit } }] })).deck.slides[0];
const drawn = (exhibit) => {
  const page = slide(exhibit), frame = page.componentInstances.find((i) => i.component === 'agenda-rows').frame;
  const of = (role) => page.nodes.filter((n) => n.role === role);
  return { frame, tiles: of('agenda-row-tile'), numbers: of('agenda-row-number'), topics: of('agenda-row-topic'), texts: of('agenda-row-text'), rules: of('agenda-row-rule') };
};
const refusal = (run) => { try { run(); return null; } catch (error) { return String(error.message); } };
const mid = (f) => f.y + f.height / 2;
'''


class AgendaRowsGeometryTests(unittest.TestCase):
    def test_six_rows_are_one_height_and_fill_the_frame(self):
        result = run_node(PAGE + '''
const d = drawn({ items: items(6) });
const ys = d.rules.map((r) => r.frame.y), steps = ys.slice(1).map((y, at) => y - ys[at]);
console.log(JSON.stringify({ rows: d.rules.length, steps, first: ys[0] - d.frame.y, foot: d.frame.y + d.frame.height - ys[5],
  full: d.rules.every((r) => Math.abs(r.frame.x - d.frame.x) < 0.5 && Math.abs(r.frame.width - d.frame.width) < 0.5) }));
''')
        self.assertEqual(result['rows'], 6)
        for step in result['steps']:
            self.assertAlmostEqual(step, result['first'], delta=0.5)
        # The last rule is the frame's foot: the rows use all the height the body gives them.
        self.assertAlmostEqual(result['foot'], 0, delta=0.5)
        self.assertTrue(result['full'])

    def test_the_tile_is_square_centred_in_its_row_and_holds_its_number(self):
        result = run_node(PAGE + '''
const d = drawn({ items: items(6) }), row = d.frame.height / 6;
console.log(JSON.stringify(d.tiles.map((t, at) => ({ square: t.frame.width === t.frame.height, share: t.frame.height / row, radius: t.style.radius.tokenId,
  centred: Math.abs(mid(t.frame) - (d.frame.y + (at + 0.5) * row)) < 0.5, text: d.numbers[at].text, bold: d.numbers[at].style.bold, align: d.numbers[at].style.align,
  inside: d.numbers[at].frame.y >= t.frame.y - 0.01 && d.numbers[at].frame.y + d.numbers[at].frame.height <= t.frame.y + t.frame.height + 0.01
    && d.numbers[at].frame.x === t.frame.x && d.numbers[at].frame.width === t.frame.width && d.numbers[at].data.textLayout.width < t.frame.width,
  level: Math.abs(mid(d.numbers[at].frame) - mid(t.frame)) < 0.5 }))));
''')
        self.assertEqual([tile['text'] for tile in result], ['1', '2', '3', '4', '5', '6'])
        for tile in result:
            self.assertTrue(tile['square'] and tile['centred'] and tile['inside'] and tile['level'], tile)
            self.assertAlmostEqual(tile['share'], 0.7, delta=0.02)
            self.assertEqual((tile['radius'], tile['bold'], tile['align']), ('radius.small', False, 'center'))

    def test_topic_and_description_are_centred_on_the_row_and_the_description_column_is_one(self):
        result = run_node(PAGE + '''
const d = drawn({ items: items(6) });
console.log(JSON.stringify({ level: d.topics.every((t, at) => Math.abs(mid(t.frame) - mid(d.tiles[at].frame)) < 0.5 && Math.abs(mid(d.texts[at].frame) - mid(t.frame)) < 0.5),
  topicX: [...new Set(d.topics.map((t) => t.frame.x))], textX: [...new Set(d.texts.map((t) => t.frame.x))], at: (d.texts[0].frame.x - d.frame.x) / d.frame.width,
  clear: d.topics.every((t, at) => t.frame.x >= d.tiles[at].frame.x + d.tiles[at].frame.width + 16 && t.frame.x + t.data.textLayout.width < d.texts[at].frame.x),
  type: [d.topics[0].style.fontSize.tokenId, d.topics[0].style.bold, d.texts[0].style.fontSize.tokenId, d.texts[0].style.bold, d.texts[0].style.color.tokenId] }));
''')
        self.assertTrue(result['level'])
        self.assertEqual(len(result['topicX']), 1)
        self.assertEqual(len(result['textX']), 1)
        self.assertAlmostEqual(result['at'], 0.55, delta=0.005)
        self.assertTrue(result['clear'])
        self.assertEqual(result['type'], ['type.heading', True, 'type.body', False, 'color.textSecondary'])

    def test_a_short_agenda_grows_its_rows_to_a_cap_and_stays_one_group(self):
        # Three rows stretched to the body's height are three bands of air: the rows stop at a cap, the tile at its own,
        # and the engine leaves the rest as the page's foot.
        result = run_node(PAGE + '''
const three = drawn({ items: items(3) }), six = drawn({ items: items(6) }), eight = drawn({ items: items(8) });
const row = (d) => d.rules[1].frame.y - d.rules[0].frame.y;
console.log(JSON.stringify({ rows: [row(three), row(six), row(eight)], used: three.frame.height, body: six.frame.height, tiles: [three, six, eight].map((d) => d.tiles[0].frame.width),
  eightFills: Math.abs(eight.rules[7].frame.y - (eight.frame.y + eight.frame.height)) < 0.5 }));
''')
        three, six, eight = result['rows']
        self.assertGreater(three, six)
        self.assertGreater(six, eight)
        self.assertLessEqual(three, 120.5)
        self.assertAlmostEqual(result['used'], 3 * three, delta=0.5)
        self.assertLess(result['used'], result['body'])
        self.assertLessEqual(result['tiles'][0], 72)
        self.assertTrue(result['eightFills'])

    def test_active_recolours_one_row_and_only_that_row(self):
        result = run_node(PAGE + '''
const d = drawn({ items: items(5), active: 2 }), plain = drawn({ items: items(5) });
console.log(JSON.stringify({ tiles: d.tiles.map((t) => t.style.fill.tokenId), topics: d.topics.map((t) => t.style.color.tokenId), flags: d.tiles.map((t) => t.data.active),
  plain: [...new Set([...plain.tiles.map((t) => t.style.fill.tokenId), ...plain.topics.map((t) => t.style.color.tokenId)])] }));
''')
        primary = 'color.componentPrimary'
        self.assertEqual(result['tiles'], [primary, primary, 'color.accent', primary, primary])
        self.assertEqual(result['topics'], ['color.ink', 'color.ink', 'color.accent', 'color.ink', 'color.ink'])
        self.assertEqual(result['flags'], [False, False, True, False, False])
        self.assertEqual(sorted(result['plain']), [primary, 'color.ink'])


class AgendaRowsContentTests(unittest.TestCase):
    def test_two_to_eight_items_are_drawn_and_any_other_count_is_refused_by_name(self):
        result = run_node(PAGE + '''
console.log(JSON.stringify({ drawn: [2, 3, 4, 5, 6, 7, 8].map((n) => drawn({ items: items(n) }).tiles.length),
  nine: refusal(() => slide({ items: items(9) })), one: refusal(() => slide({ items: items(1) })) }));
''')
        self.assertEqual(result['drawn'], [2, 3, 4, 5, 6, 7, 8])
        self.assertIn('An agenda takes 2 to 8 items', result['nine'])
        self.assertIn('this one has 9', result['nine'])
        self.assertIn('split the agenda over two pages', result['nine'])
        self.assertIn('this one has 1', result['one'])

    def test_numbers_default_to_the_running_order_and_an_authored_one_is_printed(self):
        result = run_node(PAGE + '''
const d = drawn({ items: [{ topic: 'Welcome', number: 'A' }, { topic: 'Review' }, { topic: 'Close', number: 9 }] });
console.log(JSON.stringify({ numbers: d.numbers.map((n) => n.text), texts: d.texts.length,
  long: refusal(() => slide({ items: [{ topic: 'Welcome', number: '100' }, { topic: 'Review' }] })),
  untitled: refusal(() => slide({ items: [{ text: 'No topic' }, { topic: 'Review' }] })),
  active: refusal(() => slide({ items: items(3), active: 3 })) }));
''')
        self.assertEqual(result['numbers'], ['A', '2', '9'])
        self.assertEqual(result['texts'], 0)
        self.assertIn('one or two characters', result['long'])
        self.assertIn('Agenda item 1 needs a `topic`', result['untitled'])
        self.assertIn('0 to 2', result['active'])


class AgendaFormTests(unittest.TestCase):
    def test_the_form_is_in_the_catalogue_with_its_fields_and_limits(self):
        result = run_node('''
import { PAGE_TYPES, LIMITS, exhibitRange, placementsOf } from './skills/professional-slides/runtime/page-types.mjs';
import { formFields } from './skills/professional-slides/runtime/form-fields.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const fields = formFields('summary', 'agenda'), definition = REGISTRY.get('agenda-rows');
console.log(JSON.stringify({ draws: PAGE_TYPES.summary.forms.agenda, limit: LIMITS['agenda-rows'], exhibits: exhibitRange('summary', 'agenda'), commentary: placementsOf('summary', 'agenda'),
  exhibit: Object.keys(fields.exhibit), declared: ['color.componentPrimary', 'color.accent', 'color.onPrimary', 'color.textSecondary', 'color.rule', 'color.surface', 'type.metric', 'type.heading', 'type.body', 'radius.small', 'line.hairline'].filter((id) => !definition.tokens.includes(id)),
  ceiling: typeof definition.measureCeiling }));
''')
        self.assertEqual(result['draws'], 'agenda-rows')
        self.assertEqual(result['limit'], {'key': 'items', 'min': 2, 'max': 8})
        self.assertEqual(result['exhibits'], [1, 1])
        self.assertEqual(result['commentary'], ['none'])
        self.assertEqual(result['exhibit'], ['items', 'active'])
        self.assertEqual(result['declared'], [])
        self.assertEqual(result['ceiling'], 'function')

    def test_the_worked_example_compiles_and_composes_as_agenda_rows(self):
        result = run_node('''
import fs from 'node:fs';
import { compileDeck, composeForAuthoring } from './skills/professional-slides/runtime/author-deck.mjs';
const dir = './skills/professional-slides/examples';
const example = JSON.parse(fs.readFileSync(dir + '/page-forms.pages.json', 'utf8'));
const page = example.pages.find((p) => p.id === 'f-summary-agenda');
const { spec } = compileDeck({ deck: { ...example.deck, workflow: undefined, rulesVersion: undefined }, pages: [page] });
const composed = await composeForAuthoring(spec, dir);
if (composed.error || composed.pageErrors?.length) throw new Error(composed.error ?? composed.pageErrors.join('; '));
const slide = composed.deck.slides.find((s) => s.id === 'f-summary-agenda');
console.log(JSON.stringify({ items: page.exhibit.items.length, active: page.exhibit.active, components: slide.componentInstances.map((i) => i.component),
  tiles: slide.nodes.filter((n) => n.role === 'agenda-row-tile').map((t) => t.style.fill.tokenId) }));
''')
        self.assertIn('agenda-rows', result['components'])
        self.assertEqual(len(result['tiles']), result['items'])
        self.assertEqual([at for at, fill in enumerate(result['tiles']) if fill == 'color.accent'], [result['active']])

    def test_a_typed_page_refuses_a_ninth_item_and_an_agenda_without_its_exhibit(self):
        result = run_node('''
import fs from 'node:fs';
import { compileDeck } from './skills/professional-slides/runtime/author-deck.mjs';
const example = JSON.parse(fs.readFileSync('./skills/professional-slides/examples/page-forms.pages.json', 'utf8'));
const page = example.pages.find((p) => p.id === 'f-summary-agenda');
const refusal = (changed) => { try { const out = compileDeck({ deck: { ...example.deck, workflow: undefined, rulesVersion: undefined }, pages: [{ ...page, ...changed }] }); return JSON.stringify(out.errors ?? out.problems ?? null); } catch (error) { return String(error.message); } };
const nine = Array.from({ length: 9 }, (_, at) => ({ topic: 'Topic ' + (at + 1) }));
console.log(JSON.stringify({ nine: refusal({ exhibit: { items: nine } }), bare: refusal({ exhibit: undefined }) }));
''')
        self.assertIn('f-summary-agenda', result['nine'])
        self.assertIn('8', result['nine'])
        self.assertIn('carries 1 exhibit; this one has 0', result['bare'])


if __name__ == '__main__':
    unittest.main()
