"""A column of pills is one kind of thing.

A column of figure pills read "$12.5B" over "Duration unclear": the pill
promised a value and gave a caveat. Every pill in a column is a figure in one
unit; "n/a" is set as a plain dash.
"""
import unittest

from node_probe import run_node

AUTHOR = "./skills/professional-slides/runtime/author-deck.mjs"


class PillColumnTests(unittest.TestCase):
    def test_pills_hold_figures_in_one_unit(self):
        result = run_node(f'''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {{ authorDeck }} from '{AUTHOR}';
const S = {{ kind: 'comparison', what: 'Announced compute commitments by supplier' }};
const page = (cells) => ({{ id: 'p1', type: 'lookup', form: 'table', commentary: 'none', takeaway: false, why: 'Each commitment is looked up with its annual mean', settles: S,
  title: 'Announced compute commitments differ in size and in what is disclosed',
  exhibit: {{ columns: ['Supplier', 'Announced total', {{ label: 'Simple mean per year', type: 'highlight', surface: 'bubble' }}],
    rows: [['Northcloud', '$50B over four years', cells[0]], ['Eastgrid', 'Up to $30B', cells[1]], ['Southrack', '$10B over six years', cells[2]]] }} }});
const run = async (cells) => {{
  const out = await authorDeck({{ deck: {{ schema: 'professional-slides.deck/v3', id: 'd' }}, pages: [page(cells)] }}, {{ baseDir: fs.mkdtempSync(path.join(os.tmpdir(), 'pills-')) }});
  const slide = out.deck.slides.find((s) => s.id === 'p1');
  return {{ errors: out.findings.filter((f) => f.code === 'PAGE_DOES_NOT_COMPOSE').map((f) => f.repair),
    pills: slide ? slide.nodes.filter((n) => n.role === 'table-bubble').length : 0 }};
}};
console.log(JSON.stringify({{ words: await run(['$12.5B', 'Duration unclear', '~$1.7B']), units: await run(['$12.5B', '40%', '~$1.7B']),
  none: await run(['$12.5B', 'n/a', '~$1.7B']), clean: await run(['$12.5B', '>$10B', '~$1.7B']) }}));
''')
        self.assertIn('mixes figures with words ("Duration unclear")', result['words']['errors'][0])
        self.assertIn('mixes units', result['units']['errors'][0])
        self.assertEqual(result['none']['errors'], [])
        self.assertEqual(result['none']['pills'], 2)  # "n/a" is a plain dash, not a pill
        self.assertEqual(result['clean']['errors'], [])
        self.assertEqual(result['clean']['pills'], 3)


if __name__ == '__main__':
    unittest.main()
