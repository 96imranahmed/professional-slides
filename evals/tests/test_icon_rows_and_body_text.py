"""Parallel reasons are an icon list, and a page's content is never set in caption type.

`parallel/icon-rows` draws the `icon-rows` component: a tinted square tile with
the item's icon in the accent, a bold lead at heading size beside it and the
description under the lead at body size in the secondary colour. Nothing points
anywhere; a row that leads to a consequence is `arrow-rows`, and the catalogue
offers icon rows first. The figure a page turns on (`kpi`, a `display` metric)
says what it measures in bold heading type, with its sub-line at body size.
Words that are a page's content are body text or larger; the caption sizes are
for the source line, the footer, chart labels and dense table cells.
"""
import unittest

from node_probe import run_node

ROWS = '''
import { createRegistry } from './skills/professional-slides/runtime/registry.mjs';
import { tokenValue, token } from './skills/professional-slides/runtime/core.mjs';
const registry = createRegistry(), definition = registry.get('icon-rows'), frame = { x: 40, y: 100, width: 760, height: 480 };
const reasons = [
  { icon: 'people', label: 'Tuned for contact centres', text: 'Finds the right playbook among thousands of intents and follows it step by step, bringing callers back when they drift from it.' },
  { icon: 'bolt', label: 'Thinks while it speaks', text: 'Answers in about 150 ms.' },
  { icon: 'star', label: 'Top performance', text: 'Top five in every skill of the benchmark and first for sounding natural.' },
  { label: 'No icon given' }, { label: 'Fifth' }, { label: 'Sixth' }, { label: 'One too many' }];
const draw = (items, at = frame) => { const nodes = definition.render({ id: 'r', frame: at, props: { items } }).nodes; const of = (role) => nodes.filter((n) => n.role === role);
  return { tiles: of('icon-row-tile'), glyphs: of('icon-row-icon-glyph'), numbers: of('icon-row-number'), labels: of('icon-row-label'), texts: of('icon-row-text'), nodes }; };
const refusal = (run) => { try { run(); return null; } catch (error) { return String(error.message); } };
const foot = (f) => f.y + f.height, mid = (f) => f.y + f.height / 2, centre = (f) => f.x + f.width / 2;
const px = (node) => tokenValue(node.style.fontSize);
'''

PAGE = '''
import { toDeckPlan } from './evals/support/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
import { tokenValue, token } from './skills/professional-slides/runtime/core.mjs';
const slideOf = (slide) => planDeck(toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'c', slides: [{ id: 's', ...slide }] })).deck.slides[0];
const of = (page, role) => page.nodes.filter((n) => n.role === role);
const foot = (f) => f.y + f.height;
const reasons = [
  { icon: 'people', label: 'Tuned for contact centres', text: 'Finds the right playbook among thousands of intents and follows it step by step.' },
  { icon: 'bolt', label: 'Thinks while it speaks', text: 'Answers in about 150 ms, so callers do not hear a pause before each answer.' },
  { icon: 'star', label: 'Top performance', text: 'Top five in every skill of the benchmark and first for sounding natural.' }];
const hero = (kpi, exhibit = { type: 'icon-rows', heading: 'Why move?', items: reasons }) => slideOf({ title: 'Moving the model could cut the cost of a minute by about a third', layout: 'hero-number', kpi, source: 'Billing, twelve months', exhibit });
'''


class IconRowsGeometryTests(unittest.TestCase):
    def test_each_row_opens_on_a_square_tinted_tile_with_its_icon_inside(self):
        result = run_node(ROWS + '''
const d = draw(reasons.slice(0, 3));
console.log(JSON.stringify({ tiles: d.tiles.map((t, at) => ({ square: t.frame.width === t.frame.height, x: t.frame.x, fill: t.style.fill.tokenId, radius: t.style.radius.tokenId,
  inside: d.glyphs[at].frame.x >= t.frame.x && d.glyphs[at].frame.y >= t.frame.y && d.glyphs[at].frame.x + d.glyphs[at].frame.width <= t.frame.x + t.frame.width && foot(d.glyphs[at].frame) <= foot(t.frame),
  centred: Math.abs(centre(d.glyphs[at].frame) - centre(t.frame)) < 0.5 && Math.abs(mid(d.glyphs[at].frame) - mid(t.frame)) < 0.5,
  share: d.glyphs[at].frame.width / t.frame.width, stroke: d.glyphs[at].style.stroke.tokenId, icon: d.glyphs[at].data.icon })),
  first: d.tiles[0].frame.y - frame.y, rings: d.nodes.filter((n) => /ring|arrow/.test(n.role)).length }));
''')
        self.assertEqual([tile['icon'] for tile in result['tiles']], ['people', 'bolt', 'star'])
        for tile in result['tiles']:
            self.assertTrue(tile['square'] and tile['inside'] and tile['centred'], tile)
            self.assertEqual((tile['x'], tile['fill'], tile['radius'], tile['stroke']), (40, 'color.accentTint', 'radius.small', 'color.accent'))
            # The icon is a mark inside the tile, not a fill of it.
            self.assertGreater(tile['share'], 0.3)
            self.assertLess(tile['share'], 0.7)
        # Drawn from the top of the frame, with no ring round the icon and no arrow anywhere.
        self.assertAlmostEqual(result['first'], 0, delta=0.01)
        self.assertEqual(result['rings'], 0)

    def test_leads_and_descriptions_share_one_left_edge_and_their_type(self):
        result = run_node(ROWS + '''
const d = draw(reasons.slice(0, 3));
console.log(JSON.stringify({ labelX: [...new Set(d.labels.map((n) => n.frame.x))], textX: [...new Set(d.texts.map((n) => n.frame.x))], tileRight: d.tiles[0].frame.x + d.tiles[0].frame.width,
  lead: d.labels.map((n) => [n.style.fontSize.tokenId, n.style.bold, n.style.color.tokenId]), text: d.texts.map((n) => [n.style.fontSize.tokenId, n.style.bold, n.style.color.tokenId]),
  under: d.texts.every((n, at) => n.frame.y >= foot(d.labels[at].frame) && n.frame.y - foot(d.labels[at].frame) < 12),
  level: d.labels.every((n, at) => Math.abs(n.frame.y - d.tiles[at].frame.y) < 0.5), within: d.texts.every((n) => n.frame.x + n.frame.width <= frame.x + frame.width + 0.01),
  body: px(d.texts[0]) >= tokenValue(token('type.body')) && px(d.labels[0]) > px(d.texts[0]) }));
''')
        self.assertEqual(len(result['labelX']), 1)
        self.assertEqual(result['labelX'], result['textX'])
        self.assertGreaterEqual(result['labelX'][0] - result['tileRight'], 12)
        for lead in result['lead']:
            self.assertEqual(lead, ['type.heading', True, 'color.ink'])
        for text in result['text']:
            self.assertEqual(text, ['type.body', False, 'color.textSecondary'])
        self.assertTrue(result['under'] and result['level'] and result['within'] and result['body'])

    def test_rows_are_as_tall_as_their_copy_and_the_gaps_are_even_up_to_the_loosest(self):
        result = run_node(ROWS + '''
const rowsOf = (d) => d.tiles.map((t, at) => ({ top: t.frame.y, foot: Math.max(foot(t.frame), d.texts[at] ? foot(d.texts[at].frame) : 0) }));
const gaps = (d) => rowsOf(d).slice(1).map((r, at) => r.top - rowsOf(d)[at].foot);
const props = { items: reasons.slice(0, 3) }, natural = definition.measureContent({ frame, props }).height, ceiling = definition.measureCeiling({ frame, props });
const narrow = { ...frame, width: 300 };
console.log(JSON.stringify({ natural, ceiling, tall: gaps(draw(reasons.slice(0, 3))), fitted: gaps(draw(reasons.slice(0, 3), { ...frame, height: natural })),
  used: rowsOf(draw(reasons.slice(0, 3))).at(-1).foot - frame.y, heights: rowsOf(draw(reasons.slice(0, 3), narrow)).map((r) => r.foot - r.top), tile: draw(reasons.slice(0, 3)).tiles[0].frame.height }));
''')
        # In a frame taller than the list the gaps open evenly as far as the page's loosest gap, and no further.
        self.assertAlmostEqual(result['tall'][0], result['tall'][1], delta=0.01)
        self.assertAlmostEqual(result['tall'][0], 48, delta=0.01)
        self.assertAlmostEqual(result['fitted'][0], result['fitted'][1], delta=0.01)
        self.assertLess(result['fitted'][0], result['tall'][0])
        # The list says how much height it uses, and uses exactly that.
        self.assertGreater(result['ceiling'], result['natural'])
        self.assertAlmostEqual(result['used'], result['ceiling'], delta=0.5)
        # A row whose description wraps is taller than its tile; none is shorter.
        self.assertGreater(result['heights'][0], result['heights'][1])
        for height in result['heights']:
            self.assertGreaterEqual(height, result['tile'] - 0.01)

    def test_an_item_without_an_icon_prints_its_number_in_the_tile_and_a_lone_lead_is_centred_on_it(self):
        result = run_node(ROWS + '''
const d = draw(reasons.slice(0, 4)), tile = d.tiles[3].frame, number = d.numbers[0];
console.log(JSON.stringify({ tiles: d.tiles.length, glyphs: d.glyphs.length, numbers: d.numbers.map((n) => n.text), align: number.style.align, bold: number.style.bold,
  inside: number.frame.x === tile.x && number.frame.width === tile.width && number.frame.y >= tile.y && foot(number.frame) <= foot(tile), level: Math.abs(mid(number.frame) - mid(tile)) < 0.5,
  lead: Math.abs(mid(d.labels[3].frame) - mid(tile)) < 0.5, x: d.labels[3].frame.x === d.labels[0].frame.x }));
''')
        self.assertEqual((result['tiles'], result['glyphs'], result['numbers']), (4, 3, ['4']))
        self.assertEqual((result['align'], result['bold']), ('center', True))
        self.assertTrue(result['inside'] and result['level'] and result['lead'] and result['x'])


class IconRowsContentTests(unittest.TestCase):
    def test_two_to_six_items_are_drawn_and_any_other_count_is_refused_by_name(self):
        result = run_node(ROWS + '''
const tall = { ...frame, height: 640 };
console.log(JSON.stringify({ drawn: [2, 3, 4, 5, 6].map((n) => draw(reasons.slice(0, n), tall).tiles.length), seven: refusal(() => draw(reasons, tall)), one: refusal(() => draw(reasons.slice(0, 1))),
  none: refusal(() => draw(undefined)), unlabelled: refusal(() => draw([{ text: 'No lead' }, { label: 'Second' }])), icon: refusal(() => draw([{ label: 'First', icon: 'no-such-icon' }, { label: 'Second' }])),
  short: refusal(() => draw(reasons.slice(0, 3), { ...frame, height: 120 })), narrow: refusal(() => draw(reasons.slice(0, 3), { ...frame, width: 180 })) }));
''')
        self.assertEqual(result['drawn'], [2, 3, 4, 5, 6])
        self.assertIn('Icon rows take 2 to 6 items', result['seven'])
        self.assertIn('this list has 7', result['seven'])
        self.assertIn('this list has 1', result['one'])
        self.assertIn('this list has 0', result['none'])
        self.assertIn('Icon row 1 needs a `label`', result['unlabelled'])
        self.assertIn('no-such-icon', result['icon'])
        self.assertIn('drop a row or shorten the descriptions', result['short'])
        self.assertIn('too narrow', result['narrow'])


class IconRowsFormTests(unittest.TestCase):
    def test_the_form_is_in_the_catalogue_before_arrow_rows_with_its_fields_limits_and_tokens(self):
        result = run_node('''
import { PAGE_TYPES, LIMITS, describeTypes } from './skills/professional-slides/runtime/page-types.mjs';
import { formFields } from './skills/professional-slides/runtime/form-fields.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const forms = Object.keys(PAGE_TYPES.parallel.forms), definition = REGISTRY.get('icon-rows'), arrows = REGISTRY.get('arrow-rows');
const catalogue = describeTypes();
console.log(JSON.stringify({ forms, draws: PAGE_TYPES.parallel.forms['icon-rows'], limit: LIMITS['icon-rows'], exhibit: Object.keys(formFields('parallel', 'icon-rows').exhibit),
  declared: ['color.accent', 'color.accentTint', 'color.ink', 'color.textSecondary', 'type.heading', 'type.body', 'space.1', 'space.4', 'space.5', 'space.8', 'space.loose', 'icon.medium', 'radius.small'].filter((id) => !definition.tokens.includes(id)),
  ceiling: typeof definition.measureCeiling, iconUse: definition.guidance.useWhen, arrowUse: arrows.guidance.useWhen, sample: definition.sample.items.length,
  sparing: catalogue.split('\\n').find((line) => line.startsWith('- use sparingly') && line.includes('arrow-rows')) ?? null }));
''')
        forms = result['forms']
        self.assertEqual(forms[0], 'cards')
        self.assertLess(forms.index('icon-rows'), forms.index('arrow-rows'))
        self.assertEqual(result['draws'], 'icon-rows')
        self.assertEqual(result['limit'], {'key': 'items', 'min': 2, 'max': 6})
        self.assertEqual(result['exhibit'], ['items'])
        self.assertEqual(result['declared'], [])
        self.assertEqual(result['ceiling'], 'function')
        # Each form says when it is the one to use, and the arrows send parallel reasons to the icon list.
        self.assertIn('parallel reasons, features or benefits', result['iconUse'])
        self.assertIn('only where each', result['arrowUse'])
        self.assertIn('icon rows', result['arrowUse'])
        self.assertGreaterEqual(result['sample'], 2)
        # The catalogue an author reads lists the arrows as the rarer form and names the icon list as the usual one.
        self.assertIsNotNone(result['sparing'])
        self.assertIn('icon-rows', result['sparing'])

    def test_the_worked_example_compiles_and_composes_as_icon_rows(self):
        result = run_node('''
import fs from 'node:fs';
import { compileDeck, composeForAuthoring } from './skills/professional-slides/runtime/author-deck.mjs';
const dir = './skills/professional-slides/examples';
const example = JSON.parse(fs.readFileSync(dir + '/page-forms.pages.json', 'utf8'));
const page = example.pages.find((p) => p.id === 'f-parallel-icon-rows');
const { spec } = compileDeck({ deck: { ...example.deck, workflow: undefined, rulesVersion: undefined }, pages: [page] });
const composed = await composeForAuthoring(spec, dir);
if (composed.error || composed.pageErrors?.length) throw new Error(composed.error ?? composed.pageErrors.join('; '));
const slide = composed.deck.slides.find((s) => s.id === 'f-parallel-icon-rows');
const body = slide.contentFrame, rows = slide.componentInstances.find((i) => i.component === 'icon-rows').frame;
console.log(JSON.stringify({ items: page.exhibit.items.length, components: slide.componentInstances.map((i) => i.component), tiles: slide.nodes.filter((n) => n.role === 'icon-row-tile').length,
  texts: slide.nodes.filter((n) => n.role === 'icon-row-text').length, inside: rows.y >= body.y - 0.5 && rows.y + rows.height <= body.y + body.height + 0.5 }));
''')
        self.assertIn('icon-rows', result['components'])
        self.assertNotIn('arrow-rows', result['components'])
        self.assertEqual(result['tiles'], result['items'])
        self.assertEqual(result['texts'], result['items'])
        self.assertTrue(result['inside'])

    def test_a_typed_page_refuses_a_seventh_item(self):
        result = run_node('''
import fs from 'node:fs';
import { compileDeck } from './skills/professional-slides/runtime/author-deck.mjs';
const example = JSON.parse(fs.readFileSync('./skills/professional-slides/examples/page-forms.pages.json', 'utf8'));
const page = example.pages.find((p) => p.id === 'f-parallel-icon-rows');
const refusal = (changed) => { try { const out = compileDeck({ deck: { ...example.deck, workflow: undefined, rulesVersion: undefined }, pages: [{ ...page, ...changed }] }); return JSON.stringify(out.errors ?? out.problems ?? null); } catch (error) { return String(error.message); } };
console.log(JSON.stringify({ seven: refusal({ exhibit: { items: Array.from({ length: 7 }, (_, at) => ({ label: 'Reason ' + (at + 1) })) } }) }));
''')
        self.assertIn('f-parallel-icon-rows', result['seven'])
        self.assertIn('6', result['seven'])

    def test_beside_a_figure_the_list_sits_under_its_heading_and_the_panel_in_the_middle(self):
        result = run_node(PAGE + '''
const page = hero({ value: '33%', label: 'lower cost per minute on the new model' });
const panel = page.componentInstances.find((i) => i.id === 's-exhibit-panel').frame, rows = page.componentInstances.find((i) => i.component === 'icon-rows').frame;
const tiles = of(page, 'icon-row-tile').map((n) => n.frame).sort((a, b) => a.y - b.y), heading = of(page, 'section-heading')[0].frame, figure = of(page, 'metric-value')[0].frame;
console.log(JSON.stringify({ body: page.contentFrame, panel, rows, first: tiles[0].y, headingFoot: foot(heading), figureMid: figure.y + figure.height / 2 }));
''')
        body, panel, rows = result['body'], result['panel'], result['rows']
        self.assertAlmostEqual(result['first'], rows['y'], delta=0.5)
        # The heading is directly over the list: a heading band, not the panel's spare height.
        self.assertLess(result['first'] - result['headingFoot'], 32)
        # The panel is as tall as its group and stands in the middle of the body, level with the figure.
        self.assertLess(panel['height'], body['height'] - 60)
        self.assertAlmostEqual(panel['y'] - body['y'], (body['y'] + body['height']) - (panel['y'] + panel['height']), delta=2)
        self.assertLess(abs(result['figureMid'] - (panel['y'] + panel['height'] / 2)), 60)


class DisplayFigureTextTests(unittest.TestCase):
    def test_a_display_figures_label_is_bold_heading_type_in_ink_and_its_sub_line_body_text(self):
        result = run_node('''
import { createRegistry } from './skills/professional-slides/runtime/registry.mjs';
import { tokenValue } from './skills/professional-slides/runtime/core.mjs';
const metric = createRegistry().get('metric'), frame = { x: 60, y: 200, width: 360, height: 320 };
const drawn = (props) => { const nodes = metric.render({ id: 'm', frame, props: { value: '33%', label: 'lower cost per minute on the new model', sublabel: 'from 26 to about 17 cents', delta: '+9 pts', ...props } }).nodes;
  const one = (role) => nodes.find((n) => n.role === role), type = (n) => [n.style.fontSize.tokenId, n.style.bold, n.style.color.tokenId];
  const height = metric.measureContent({ frame, props: { value: '33%', label: 'lower cost per minute on the new model', sublabel: 'from 26 to about 17 cents', delta: '+9 pts', ...props } }).height;
  const texts = nodes.filter((n) => n.type === 'text');
  return { value: tokenValue(one('metric-value').style.fontSize), label: type(one('metric-label')), sublabel: type(one('metric-sublabel')), delta: one('metric-delta').style.fontSize.tokenId,
    measured: height, extent: Math.max(...texts.map((n) => n.frame.y + n.frame.height)) - Math.min(...texts.map((n) => n.frame.y)),
    order: one('metric-label').frame.y > one('metric-value').frame.y && one('metric-sublabel').frame.y >= one('metric-label').frame.y + one('metric-label').frame.height }; };
console.log(JSON.stringify({ hero: drawn({ tone: 'hero', variant: 'display' }), plain: drawn({ variant: 'display', valign: 'top' }), dark: drawn({ tone: 'dark', variant: 'display' }), tile: drawn({}), prominent: drawn({ variant: 'prominent' }),
  body: tokenValue(metric.render({ id: 'm', frame, props: { value: '1', label: 'x', sublabel: 'y', variant: 'display' } }).nodes.find((n) => n.role === 'metric-sublabel').style.fontSize) }));
''')
        for name in ('hero', 'plain'):
            drawn = result[name]
            self.assertEqual(drawn['label'], ['type.heading', True, 'color.ink'], name)
            self.assertEqual(drawn['sublabel'], ['type.body', False, 'color.textSecondary'], name)
            self.assertEqual(drawn['delta'], 'type.body', name)
            self.assertTrue(drawn['order'], name)
            self.assertGreater(drawn['value'], 2 * result['body'], name)
        # What the column is sized to is what is drawn: measurement and drawing read one type.
        self.assertLessEqual(abs(result['hero']['measured'] - result['hero']['extent']), 1)
        # On a dark tile the words keep the tile's pale type, at the display sizes.
        self.assertEqual(result['dark']['label'][:2], ['type.heading', True])
        self.assertNotEqual(result['dark']['label'][2], 'color.ink')
        # A tile in a strip is furniture-dense and keeps its caption sizes.
        for name in ('tile', 'prominent'):
            self.assertEqual(result[name]['label'][:2], ['type.compact', False], name)
            self.assertEqual(result[name]['sublabel'][0], 'type.label', name)

    def test_every_way_a_lone_figure_is_set_says_what_it_measures_at_body_size_or_larger(self):
        # `kpi` is set stacked, stacked smaller, beside its explanation or boxed (compose-arrangements.mjs): whichever
        # the engine picks, and whichever a recorded choice names, no word of it is below body size.
        result = run_node(PAGE + '''
const body = tokenValue(token('type.body'));
const kpi = { value: '33%', label: 'lower cost per minute on the new model', sublabel: 'A third of the bill for the same minutes, measured over twelve months of billing.' };
const sizes = (page) => page.nodes.filter((n) => n.type === 'text' && /(^|-)s-kpi/.test(String(n.id))).map((n) => ({ role: n.role, size: tokenValue(n.style.fontSize) }));
const page = (choices) => slideOf({ title: 'Moving the model could cut the cost of a minute', layout: 'hero-number', kpi, ...(choices ? { choices } : {}), exhibit: { type: 'icon-rows', heading: 'Why move?', items: reasons } });
const picked = page(), decision = picked.decisions.find((d) => d.candidates.some((c) => c.label.includes('s-kpi=')));
const pages = { picked, ...Object.fromEntries(decision.candidates.map((c) => { try { return [c.label, page({ [decision.id]: c.label })]; } catch (error) { return [c.label, null]; } })) };
console.log(JSON.stringify({ body, pages: Object.fromEntries(Object.entries(pages).filter(([, page]) => page).map(([name, page]) => [name, sizes(page)])) }));
''')
        self.assertIn('picked', result['pages'])
        # The figure's own realisations are all among the candidates the engine weighed.
        for way in ('stacked', 'beside', 'boxed'):
            self.assertTrue(any(name.endswith('s-kpi=' + way) for name in result['pages']), (way, list(result['pages'])))
        for name, texts in result['pages'].items():
            self.assertGreaterEqual(len(texts), 2, name)
            for text in texts:
                self.assertGreaterEqual(text['size'], result['body'], (name, text))


# The words these roles draw are a page's content: a description in a list, a tile or a diagram, a caption under a panel
# or a logo, a card's foot, a person's role and points. Each was set in a caption size and is body text now.


class ContentTextSizeTests(unittest.TestCase):
    def test_no_content_role_is_set_below_body_size_anywhere_in_the_component_gallery(self):
        result = run_node('''
import fs from 'node:fs';
import { toDeckPlan } from './evals/support/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
import { createRegistry } from './skills/professional-slides/runtime/registry.mjs';
import { tokenValue, token } from './skills/professional-slides/runtime/core.mjs';
const ROLES = new Set(['icon-row-label', 'icon-row-text', 'metric-label', 'metric-sublabel', 'insight-caption', 'pictogram-text', 'nested-text', 'spectrum-text',
  'capsule-text', 'fact-text', 'step-text', 'person-role', 'person-point', 'worksheet-prompt', 'card-footer', 'framework-tier-text',
  'logo-caption', 'venn-text', 'placement-text', 'flow-step-text', 'list-item', 'process-detail-item']), body = tokenValue(token('type.body')), dir = './skills/professional-slides/examples';
const { deck } = planDeck(toDeckPlan(JSON.parse(fs.readFileSync(dir + '/gallery-acceptance.deck.json', 'utf8')), dir));
const registry = createRegistry(), draw = (id, props, frame = { x: 60, y: 160, width: 1160, height: 480 }) => registry.get(id).render({ id: 'x', frame, props }).nodes;
// A display figure's words are content; a tile's in a strip are furniture, so only the display figure's are read.
const display = draw('metric', { value: '33%', label: 'lower cost per minute', sublabel: 'from 26 to about 17 cents', tone: 'hero', variant: 'display' }, { x: 60, y: 160, width: 380, height: 320 });
const drawn = [
  ...deck.slides.flatMap((slide) => slide.nodes.filter((n) => !/^metric-/.test(n.role))), ...display,
  ...draw('nested-circles', { items: [{ label: 'The whole', value: 100, display: '100', text: 'Everyone who could buy' }, { label: 'Served', value: 40, display: '40', text: 'Those the product reaches' }] }, { x: 60, y: 160, width: 760, height: 420 }),
  ...draw('venn', { sets: [{ id: 'a', label: 'Set A', text: 'What only A holds' }, { id: 'b', label: 'Set B', text: 'What only B holds' }], overlaps: [{ sets: ['a', 'b'], label: 'Both' }] }, { x: 60, y: 160, width: 760, height: 440 }),
  ...draw('placement', { columns: [{ label: 'Grow', text: 'Invest ahead of demand' }, { label: 'Hold', text: 'Fund from cash flow' }], items: [{ label: 'Rail', column: 0 }, { label: 'Bus', column: 1 }, { label: 'Ferry', column: 1 }] }),
  ...draw('cards', { items: [{ title: 'North', text: 'Twelve sites', footer: 'Live since 2024' }, { title: 'South', text: 'Nine sites', footer: 'Live since 2025' }] }),
  ...draw('framework', { variant: 'pyramid', tiers: [{ label: 'Apex' }, { label: 'Middle', text: 'What the middle tier means' }, { label: 'Base', text: 'What the base tier means' }] }),
  ...draw('paragraph', { text: 'The finding this panel carries, set under it.', variant: 'caption' }, { x: 60, y: 600, width: 360, height: 60 })];
const seen = {};
for (const n of drawn) if (n.type === 'text' && ROLES.has(n.role)) seen[n.role] = Math.min(seen[n.role] ?? Infinity, tokenValue(n.style.fontSize));
console.log(JSON.stringify({ body, seen, roles: [...ROLES], small: ['type.compact', 'type.label', 'type.source'].map((id) => tokenValue(token(id))) }));
''')
        # Every role is drawn at least once, so the scan cannot pass by seeing nothing.
        self.assertEqual(sorted(set(result['roles']) - set(result['seen'])), [])
        for role, size in result['seen'].items():
            self.assertGreaterEqual(size, result['body'], role)
        for size in result['small']:
            self.assertLess(size, result['body'])


if __name__ == '__main__':
    unittest.main()
