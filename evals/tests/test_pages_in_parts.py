"""Every command finds a page wherever it was written: in the pages file, in a part an include names, or in the appendix.

The workspace's pages file is read as written for edits, and as the deck is built from it (parts spliced in, the
appendix after the body) for every lookup; an edit is written back to the file that holds its page.
"""
import unittest

from node_probe import run_node
from test_review_findings import WORKSPACE


class PagesInPartsTests(unittest.TestCase):
    def test_lookups_fingerprint_and_page_edits_follow_parts_and_the_appendix(self):
        result = run_node(WORKSPACE + '''
import { openWorkspace, fingerprint, selectPage, expanded, authoringInputs, rewritePages } from './skills/professional-slides/runtime/public/workspace.mjs';
const unwritten = (id) => ({ id, title: 'A page waiting for its type' });
const work = workspace({ pages: [judged('one', 'One page in the pages file'), { include: 'pages/part.json' }], appendix: [{ include: 'appendix/part.json' }] },
  { 'pages/part.json': { pages: [unwritten('two')] }, 'appendix/part.json': { pages: [judged('three', 'Three in an appendix part')] } });
const opened = await openWorkspace(work);
const before = await fingerprint(opened);
// A part edited is the deck edited: the source hash moves.
const part = read(work, 'pages/part.json'); part.pages[0].title = 'A page waiting for its type, renamed'; fs.writeFileSync(path.join(work, 'pages/part.json'), JSON.stringify(part));
const after = await fingerprint(opened);
const whole = expanded(opened);
// A page from a part, and one from the appendix, are found by id and by place.
const found = ['two', 'three', '3'].map((selector) => selectPage(whole, selector).page.id);
// What still needs writing is asked of the page in its part.
const inputs = authoringInputs(opened).map((input) => input.page);
// An edit is written where its page lives, and the includes stay as written.
const written = await rewritePages(opened, { three: (page) => ({ ...page, title: 'Three, retitled' }), one: (page) => ({ ...page, title: 'One, retitled' }) });
console.log(JSON.stringify({ moved: before !== after, found, inputs, written: written.map((file) => path.relative(opened.root, file)).sort(),
  root: read(work, 'deck.pages.json'), appendixPart: read(work, 'appendix/part.json').pages[0].title }));
''')
        self.assertTrue(result['moved'])
        self.assertEqual(result['found'], ['two', 'three', 'three'])
        self.assertEqual(result['inputs'], ['two'])
        self.assertEqual(result['written'], ['appendix/part.json', 'deck.pages.json'])
        self.assertEqual(result['root']['pages'][0]['title'], 'One, retitled')
        self.assertEqual(result['root']['pages'][1], {'include': 'pages/part.json'})
        self.assertEqual(result['root']['appendix'], [{'include': 'appendix/part.json'}])
        self.assertEqual(result['appendixPart'], 'Three, retitled')

    def test_inspect_finds_a_page_in_a_part_and_the_build_reports_its_notes(self):
        result = run_node(WORKSPACE + '''
const noted = { ...judged('two', 'Two things in a part'), uncertainties: ['The March figure is provisional.'] };
const work = workspace({ pages: [judged('one', 'One page in the pages file'), { include: 'pages/part.json' }] }, { 'pages/part.json': { pages: [noted] } });
const inspected = await execute(['inspect', work, '--slide', 'two']);
const all = await execute(['inspect', work]);
console.log(JSON.stringify({ status: inspected.status, page: inspected.pages?.map((p) => p.id), all: all.pages?.map((p) => p.id) }));
''')
        self.assertEqual(result['page'], ['two'])
        self.assertEqual(result['all'], ['one', 'two'])


if __name__ == '__main__':
    unittest.main()
