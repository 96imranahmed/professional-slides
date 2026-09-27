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


class ShortTableTests(unittest.TestCase):
    def test_two_row_tables_are_refused_and_twins_merge(self):
        result = run_node('''
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
const error = (page) => { try { compilePage(page); return null; } catch (e) { return e.message; } };
const base = { takeaway: false, why: 'Each product is looked up with its disclosed measures', settles: { kind: 'comparison', what: 'Disclosed coding product measures' } };
const table = (heading, rows) => ({ type: 'table', heading, columns: ['Measure', 'Value', 'Date'], rows });
const two = [['Revenue run rate', '>$2.5B', 'Feb 2026'], ['Enterprise share', 'More than half', 'Feb 2026']];
const three = [...two, ['Weekly users', 'n/a', 'Feb 2026']];
console.log(JSON.stringify({
  short: error({ ...base, id: 's', type: 'lookup', form: 'table', commentary: 'none', title: 'Coding metrics cannot be reduced to one share', exhibit: table('Claude Code', two) }),
  twins: error({ ...base, id: 't', type: 'panels', form: 'stack', commentary: 'none', title: 'Coding metrics cannot be reduced to one share', exhibits: [table('Claude Code', three), table('Codex', three)] }),
  ok: error({ ...base, id: 'o', type: 'lookup', form: 'table', commentary: 'none', title: 'Coding metrics cannot be reduced to one share', exhibit: { type: 'table', columns: ['Measure', 'Claude Code', 'Codex', 'Date'], rows: [['Revenue run rate', '>$2.5B', 'n/a', 'Feb 2026'], ['Enterprise share', 'More than half', 'n/a', 'Feb 2026'], ['Weekly users', 'n/a', '>5M', 'Jun 2026']] } }),
}));
''')
        self.assertIn('TABLE_TOO_SHORT', result['short'])
        self.assertIn('TABLE_PANELS_MERGE', result['twins'])
        self.assertIsNone(result['ok'])


class SameMeasuresTests(unittest.TestCase):
    def test_members_are_compared_on_the_same_measures(self):
        result = run_node('''
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
const error = (page, opts) => { try { compilePage(page, 0, opts); return null; } catch (e) { return e.message; } };
const base = { takeaway: false, why: 'Each product is set against its disclosed measures', settles: { kind: 'comparison', what: 'Disclosed coding product measures' } };
const table = (heading, rows) => ({ type: 'table', heading, columns: ['Measure', 'Value', 'Date'], rows });
const code = table('Claude Code', [['Revenue run rate', '>$2.5B', 'Feb 2026'], ['Enterprise share', '>50%', 'Feb 2026'], ['Paid seats', 'n/a', 'Feb 2026']]);
const codex = table('Codex', [['Weekly users', '>5M', 'Jun 2026'], ['Knowledge-worker share of use', '~20%', 'Jun 2026'], ['Paid seats', 'n/a', 'Jun 2026']]);
const bars = (heading, unit) => ({ type: 'chart.column', heading, unit, categories: ['2021', '2022', '2023', '2024', '2025'], series: [{ name: 'x', values: [1, 2, 3, 4, 5] }] });
const players = [{ name: 'Northwind' }, { name: 'Southgate' }];
const panels = (a, b) => ({ ...base, id: 'p', type: 'panels', form: 'row', commentary: 'none', title: 'Both firms grew, measured differently', exhibits: [a, b] });
console.log(JSON.stringify({
  tables: error({ ...base, id: 't', type: 'panels', form: 'stack', commentary: 'none', title: 'Coding metrics cannot be reduced to one share', exhibits: [code, codex] }),
  panels: error(panels(bars('Northwind revenue', '$bn'), bars('Southgate weekly users', 'm users')), { players }),
  samePanels: error(panels(bars('Northwind revenue', '$bn'), bars('Southgate revenue', '$bn')), { players }),
}));
''')
        self.assertIn('COMPARISON_MEASURES_DIFFER', result['tables'])
        self.assertIn('COMPARISON_MEASURES_DIFFER', result['panels'])
        self.assertNotIn('COMPARISON_MEASURES_DIFFER', result['samePanels'] or '')


if __name__ == '__main__':
    unittest.main()
