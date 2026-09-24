"""Design systems: decks on different subjects must not share one page frame.

Two fifty-page decks on unrelated subjects came out with the same cover, the
same chapter panels, the same title position, the same commentary rail and the
same takeaway band; only the accent differed. A design system sets the frame,
`identity` the colours, and each system leans the layout chooser toward its own
repertoire.
"""
import unittest

from node_probe import run_node


class DesignResolutionTests(unittest.TestCase):
    def test_each_system_resolves_a_different_frame(self):
        result = run_node('''
import { applyDesign, DESIGN_NAMES } from './skills/professional-slides/runtime/design-systems.mjs';
const out = {};
for (const design of DESIGN_NAMES) {
  const spec = applyDesign({ id: 'd', design, slides: [] });
  out[design] = { takeaway: spec.designLayout.takeaway, commentary: spec.designLayout.commentary,
    cover: spec.palette.colors['style.coverLayout'], divider: spec.palette.colors['style.dividerLayout'],
    canvas: spec.palette.colors['color.canvas'] ?? '#FFFFFF', chrome: spec.chrome ?? null };
}
out.untouched = applyDesign({ id: 'd', palette: 'evergreen', slides: [] }).palette;
out.override = applyDesign({ id: 'd', design: 'editorial', chrome: { left: 60 }, palette: { base: 'evergreen', colors: { 'color.accent': '#123456' } }, slides: [] });
console.log(JSON.stringify(out));
''')
        frames = {name: (v['takeaway'], v['cover'], v['divider']) for name, v in result.items() if name in ('consulting', 'editorial', 'journal', 'keynote')}
        self.assertEqual(len(set(frames.values())), 4, frames)
        self.assertEqual(result['editorial']['commentary'], 'left')
        self.assertNotEqual(result['editorial']['canvas'], '#FFFFFF')
        # A deck that names no design keeps exactly what it had.
        self.assertEqual(result['untouched'], 'evergreen')
        # The author's own palette colours and chrome win over the system.
        self.assertEqual(result['override']['palette']['colors']['color.accent'], '#123456')
        self.assertEqual(result['override']['palette']['base'], 'evergreen')
        self.assertEqual(result['override']['chrome'], {'left': 60})

    def test_identity_colours_read_as_text_and_keep_the_bright_accent_for_marks(self):
        result = run_node('''
import { identityColors } from './skills/professional-slides/runtime/design-systems.mjs';
import { contrastRatio } from './skills/professional-slides/runtime/palettes.mjs';
const c = identityColors({ primary: '#740001', accent: '#D3A625' });
let error = null; try { identityColors({ primary: 'gold' }); } catch (e) { error = e.message; }
console.log(JSON.stringify({ primary: contrastRatio(c['color.componentPrimary'], '#FFFFFF'), accent: contrastRatio(c['color.accent'], '#FFFFFF'), mark: c['color.chartSeries2'], error }));
''')
        self.assertGreaterEqual(result['primary'], 4.5)
        self.assertGreaterEqual(result['accent'], 4.5)
        self.assertEqual(result['mark'], '#D3A625')  # the secondary colour is the second series; the accent is the brand
        self.assertIn('#RRGGBB', result['error'])


class DesignCompositionTests(unittest.TestCase):
    def test_systems_move_the_commentary_the_takeaway_and_the_panels(self):
        result = run_node('''
import { toDeckPlan } from './skills/professional-slides/runtime/compose.mjs';
const page = { title: 'Revenue grew 40% while costs held flat across the period', exhibit: { type: 'chart.column', categories: ['2021','2022','2023'], series: [{ name: 'Revenue', values: [10, 12, 14] }] },
  points: [{ lead: 'Growth came from price', text: 'Volumes held while list prices rose' }, { lead: 'Costs held', text: 'Headcount was flat across the three years' }],
  pointsTone: 'dark', soWhat: 'Pricing, not volume, carried the growth.' };
const walk = (items, out = []) => { for (const i of items || []) { out.push(i); walk(i.items, out); } return out; };
const out = {};
for (const design of ['consulting', 'editorial', 'journal', 'keynote']) {
  const plan = toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'd', design, slides: [page] }, '.');
  const slide = plan.slides[0], items = walk(slide.items);
  const row = items.find(i => i.layout === 'flow.row');
  out[design] = { first: row?.items?.[0]?.id ?? null, takeaway: items.find(i => i.component === 'insight')?.props?.variant ?? null,
    subtitle: slide.subtitle ?? null, stacked: items.some(i => i.id === 'd01-below' || /-below$/.test(i.id || '')),
    // An open section is a region, not a panel: the column is one now that it
    // starts at the top rather than sitting in a centring flow.
    panel: items.find(i => i.treatment && i.treatment !== 'open')?.treatment ?? null };
}
console.log(JSON.stringify(out));
''')
        self.assertEqual(result['consulting']['takeaway'], 'tonal')
        self.assertEqual(result['editorial']['takeaway'], 'rule')
        self.assertEqual(result['keynote']['takeaway'], 'statement')
        # The journal sets the finding as the standfirst and puts the columns under the chart.
        self.assertEqual(result['journal']['subtitle'], 'Pricing, not volume, carried the growth.')
        self.assertIsNone(result['journal']['takeaway'])
        self.assertTrue(result['journal']['stacked'])
        # Editorial reads commentary first, on the left.
        self.assertNotIn('exhibit', result['editorial']['first'] or '')
        self.assertIn('exhibit', result['consulting']['first'])
        # The navy panel becomes the system's own ground.
        self.assertEqual(result['consulting']['panel'], 'dark')
        self.assertIsNone(result['editorial']['panel'])
        self.assertEqual(result['keynote']['panel'], 'primary')
        self.assertEqual(result['editorial']['first'], 's01-side')


if __name__ == '__main__':
    unittest.main()
