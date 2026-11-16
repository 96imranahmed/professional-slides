"""The components moved onto the text roles set their content at body size or larger and refuse what they cannot hold.

Process steps, a quote cluster's quotations, a status list's items, a panel's text and a KPI tile's label were set in
caption type in boxes of a fixed size: a long detail ran out of its box, and four quotations dropped below body size to
fit theirs. Each now sets its words in their role (text-roles.mjs), measures them where it draws them, and grows or
refuses - naming what does not fit and by how much - rather than setting the words smaller.
"""
import unittest

from node_probe import run_node

PRELUDE = '''
import { createRegistry } from './skills/professional-slides/runtime/registry.mjs';
import { tokenValue, token } from './skills/professional-slides/runtime/core.mjs';
import { TEXT_ROLES } from './skills/professional-slides/runtime/text-roles.mjs';
const registry = createRegistry(), body = tokenValue(token('type.body'));
const draw = (id, props, frame) => registry.get(id).render({ id: 'c', frame: { x: 0, y: 0, ...frame }, props }).nodes;
const refusal = (f) => { try { f(); return null; } catch (error) { return error.message; } };
// Every text a component draws: its role, whether that role is content, and its size against body size.
const texts = (nodes) => nodes.filter((n) => n.type === 'text').map((n) => ({ role: n.role, textRole: n.data?.textRole ?? null, content: Boolean(TEXT_ROLES[n.data?.textRole]?.content), size: tokenValue(n.style.fontSize) }));
const quote = (words) => ({ quote: words, attribution: 'A rider', detail: 'Leeds' });
'''


class ContentAtBodySizeTests(unittest.TestCase):
    def test_every_word_the_moved_components_draw_is_role_stamped_and_content_is_body_size_or_larger(self):
        result = run_node(PRELUDE + '''
const long = 'The capsules were weighed, X-rayed and logged before they were sealed in argon for the next quarter century.';
const pages = {
  process: draw('process', { items: [{ label: 'Intake', period: 'Dec 1999', detail: long }, { label: 'Seal', detail: 'Argon-filled steel tubes.' }, { label: 'Reopen', detail: 'A ceremony.' }] }, { width: 1160, height: 300 }),
  column: draw('process', { items: [{ label: 'Intake', detail: long }, { label: 'Seal', detail: 'Tubes.' }, { label: 'Store', detail: 'Underground.' }] }, { width: 700, height: 420 }),
  quotes: draw('quote-cluster', { quotes: [1, 2, 3, 4].map((i) => quote(`Quotation number ${i}, a sentence or two a rider said about the trains.`)), treatment: 'contained', placement: 'full-field' }, { width: 1160, height: 520 }),
  section: draw('quote-cluster', { quotes: [quote('One quotation set in a section of the page.'), quote('And a second one under it.')], treatment: 'contained', placement: 'section' }, { width: 560, height: 460 }),
  status: draw('status-list', { items: [{ label: 'Data migration', status: 'positive' }, { label: 'Training', status: 'caution' }] }, { width: 600, height: 200 }),
  panel: draw('panel', { heading: 'Why now', text: long }, { width: 400, height: 240 }),
  callout: draw('callout', { lead: 'How to read', text: 'Each row pairs one decision with the date it falls due.' }, { width: 360, height: 120 }),
  tile: draw('metric', { value: '41k', label: 'Paid seats', delta: '+18%' }, { width: 240, height: 160 }),
  highlights: draw('highlight-strip', { items: [{ heading: 'Renewals', description: '91%, four points above plan' }, { heading: 'Churn', description: 'Down to 6%' }] }, { width: 1160, height: 160 }),
};
console.log(JSON.stringify({ body, pages: Object.fromEntries(Object.entries(pages).map(([k, nodes]) => [k, texts(nodes)])) }));
''')
        for name, nodes in result['pages'].items():
            with self.subTest(component=name):
                self.assertTrue(nodes)
                self.assertEqual([n['role'] for n in nodes if not n['textRole']], [])
                for n in nodes:
                    if n['content']:
                        self.assertGreaterEqual(n['size'], result['body'], n['role'])
        # A quotation is content whatever the cluster: four up and in a section, body size, where it was caption type.
        for name in ('quotes', 'section'):
            sizes = {n['size'] for n in result['pages'][name] if n['role'] == 'quote-body'}
            self.assertEqual(sizes, {result['body']}, name)
        # A KPI tile's label says what its figure counts: a note at body size; the figure keeps its own, larger, size.
        tile = {n['role']: n for n in result['pages']['tile']}
        self.assertEqual((tile['metric-label']['textRole'], tile['metric-label']['size']), ('note', result['body']))
        self.assertEqual(tile['metric-value']['textRole'], 'figure')
        self.assertGreater(tile['metric-value']['size'], result['body'])


class MeasuredRefusalTests(unittest.TestCase):
    def test_a_component_too_small_for_its_words_says_which_and_by_how_much(self):
        result = run_node(PRELUDE + '''
const long = 'Kept at twelve degrees and thirty-five per cent humidity, forty metres down in a former salt mine, checked by torch every month for leaks.';
const four = (words) => [1, 2, 3, 4].map((i) => quote(i === 3 ? words : `Quotation ${i}.`));
console.log(JSON.stringify({
  quote: refusal(() => draw('quote-cluster', { quotes: four(Array(12).fill(long).join(' ')), treatment: 'contained', placement: 'full-field' }, { width: 1160, height: 520 })),
  grown: (() => { const nodes = draw('quote-cluster', { quotes: [quote(Array(3).fill(long).join(' ')), quote('Short.')], treatment: 'contained', placement: 'full-field' }, { width: 1160, height: 520 });
    return Math.max(...nodes.filter((n) => n.role === 'quote-surface').map((n) => n.frame.height)); })(),
  strip: refusal(() => draw('process', { items: [{ label: 'Store', detail: long }, { label: 'Seal' }, { label: 'Open' }] }, { width: 600, height: 120 })),
  column: refusal(() => draw('process', { items: [1, 2, 3, 4, 5].map((i) => ({ label: `Stage ${i}`, detail: long })) }, { width: 600, height: 340 })),
  status: refusal(() => draw('status-list', { items: [1, 2, 3, 4].map((i) => ({ label: `${long} ${i}`, status: 'positive' })) }, { width: 400, height: 120 })),
  panel: refusal(() => draw('panel', { heading: 'Why now', text: Array(4).fill(long).join(' ') }, { width: 300, height: 120 })),
  chevrons: refusal(() => draw('chevron-process', { items: [{ label: 'Survey', details: Array(12).fill('Map every den within five kilometres of the site') }, { label: 'Build', details: ['Walls'] }] }, { width: 1160, height: 300 })),
  rollout: refusal(() => draw('initiative-rollout', { years: ['Y1', 'Y2', 'Y3'], rows: [{ label: 'A', phases: [long, 'Go live', 'Tune'] }] }, { width: 700, height: 100 })),
}));
''')
        self.assertRegex(result['quote'], r'Quote 3 \(".*"\) needs a box \d+px tall .* over by \d+px')
        # A box in a row of three or fewer grows to the quotation it holds, past the row's usual 300px.
        self.assertGreater(result['grown'], 300)
        self.assertIn('"Store"', result['strip'])
        self.assertIn('the stages need', result['column'])
        self.assertIn('status list needs', result['status'])
        self.assertIn('Panel "Why now" needs', result['panel'])
        self.assertIn('"Survey"', result['chevrons'])
        self.assertIn('Rollout row "A" needs', result['rollout'])


class ChevronAccentTests(unittest.TestCase):
    def test_the_steps_named_active_take_the_accent_by_index_label_or_heading(self):
        result = run_node('''
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { token, tokenValue } from './skills/professional-slides/runtime/core.mjs';
const items = [{ heading: 'Live', label: 'Qualify', details: ['One'] }, { heading: 'Live', label: 'Meet', details: ['Two'] }, { heading: 'Next', label: 'Enrol', details: ['Three'] }, { heading: 'Next', label: 'Learn', details: ['Four'] }];
const fills = (active) => REGISTRY.get('chevron-process').render({ id: 'c', frame: { x: 0, y: 0, width: 1160, height: 360 }, props: { items, active } }).nodes
  .filter((n) => n.role === 'process-band').map((n) => n.style.fill);
const accent = tokenValue(token('color.accent'));
const marked = (active) => fills(active).map((fill) => (typeof fill === 'string' ? fill : tokenValue(fill)) === accent);
let refused = null;
try { fills('Later'); } catch (error) { refused = error.message; }
console.log(JSON.stringify({ heading: marked('Next'), index: marked(1), list: marked([0, 'Learn']), none: marked(undefined), refused }));
''')
        self.assertEqual(result['heading'], [False, False, True, True])
        self.assertEqual(result['index'], [False, True, False, False])
        self.assertEqual(result['list'], [True, False, False, True])
        self.assertEqual(result['none'], [False, False, False, False])
        self.assertIn('is not a step', result['refused'])


if __name__ == '__main__':
    unittest.main()
