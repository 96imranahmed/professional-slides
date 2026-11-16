"""Type is set by role, and a page's tracks are a choice the engine makes.

A component names what each piece of its text is - a figure's `statement`, a list item's `lead`, its `note` - and one
table (text-roles.mjs) says how that role is set: content is never below body size and never wider than its reading
measure, and a set text reports the ink it takes and how its lines break. A template may offer its columns several ways
(`columns: ["1fr 2fr", "2fr 3fr"]`); the page's grid is then a choice between grids, weighed by the engine like any
other way of setting a page - a statement left with a widow in the narrow column counts against it - recorded as a
decision and held by a recorded choice.
"""
import unittest

from node_probe import run_node

HERO = '''
import { toDeckPlan } from './evals/support/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const reasons = [
  { icon: 'people', label: 'Tuned for contact centres', text: 'Finds the right playbook among thousands of intents and follows it step by step.' },
  { icon: 'bolt', label: 'Thinks while it speaks', text: 'Answers in about 150 ms, so callers do not hear a pause before each answer.' },
  { icon: 'star', label: 'Top performance', text: 'Top five in every skill of the benchmark and first for sounding natural.' }];
const hero = (extra = {}) => planDeck(toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'c', slides: [{ id: 's', title: 'Moving the model could cut the cost of a minute by a third',
  layout: 'hero-number', kpi: { value: '33%', label: 'lower LLM cost per minute with Tilt-1 vs. GPT-5.1' }, exhibit: { type: 'icon-rows', heading: 'Why move?', items: reasons }, ...extra }] })).deck.slides[0];
const tracks = (slide) => slide.decisions.find((d) => d.id === 's-row-tracks');
const statement = (slide) => slide.nodes.find((n) => n.role === 'metric-label');
'''


class RoleTableTests(unittest.TestCase):
    def test_content_roles_are_never_below_body_size_and_furniture_keeps_its_small_sizes(self):
        result = run_node('''
import { TEXT_ROLES, roleSize, roleMeasure } from './skills/professional-slides/runtime/text-roles.mjs';
import { tokenValue, token } from './skills/professional-slides/runtime/core.mjs';
const refusal = (f) => { try { f(); return null; } catch (error) { return error.message; } };
console.log(JSON.stringify({ body: tokenValue(token('type.body')), max: tokenValue(token('measure.max')),
  roles: Object.fromEntries(Object.entries(TEXT_ROLES).map(([name, role]) => [name, { content: role.content, display: role.display, size: tokenValue(token(roleSize(name))), measure: roleMeasure(name) }])),
  larger: tokenValue(token(roleSize('body', 'type.sectionTitle'))), largerMeasure: roleMeasure('body', 'type.sectionTitle'),
  smaller: refusal(() => roleSize('body', 'type.compact')), furnitureSmaller: refusal(() => roleSize('axis', 'type.source')) }));
''')
        roles = result['roles']
        self.assertEqual({name for name, role in roles.items() if role['content']}, {'statement', 'lead', 'body', 'note', 'band'})
        self.assertEqual({name for name, role in roles.items() if role['display']}, {'figure', 'mark'})
        for name, role in roles.items():
            if role['content']:
                self.assertGreaterEqual(role['size'], result['body'], name)
                # The measure is a count of characters: in proportion to the size, measure.max at body size; a band spans
                # what it is read off instead (serialised as null).
                if name == 'band':
                    self.assertIsNone(role['measure'])
                else:
                    self.assertAlmostEqual(role['measure'], result['max'] * role['size'] / result['body'], delta=0.01)
            else:
                # Furniture keeps its small size; a display mark (a figure, a numeral in a disc) is sized where it is set.
                if not role['display']:
                    self.assertLess(role['size'], result['body'], name)
                self.assertIsNone(role['measure'])  # Infinity, serialised as null: furniture is read a word at a time
        # A role's size is its floor: a pull quote is body text set larger, at a measure scaled to its size; no text is
        # set below its role's size, content or furniture.
        self.assertGreater(result['larger'], result['body'])
        self.assertAlmostEqual(result['largerMeasure'], result['max'] * result['larger'] / result['body'], delta=0.01)
        self.assertIn("a role's size is its floor", result['smaller'])
        self.assertIn("a role's size is its floor", result['furnitureSmaller'])

    def test_set_text_wraps_at_its_measure_reports_its_ink_and_draws_what_it_measured(self):
        result = run_node('''
import { setText, drawText, roleMeasure } from './skills/professional-slides/runtime/text-roles.mjs';
const sentence = 'Finds the right playbook among thousands of intents, follows it step by step and brings callers back when they drift from it.';
const wide = setText('note', sentence, 1100), narrow = setText('note', sentence, 300);
const drawn = drawText('t', 'icon-row-text', { x: 100, y: 40, width: 1100 }, wide), centred = drawText('c', 'x', { x: 100, y: 40, width: 1100 }, wide, { align: 'center' });
console.log(JSON.stringify({ measure: roleMeasure('note'), wide: { wrap: wide.wrap, ink: wide.inkWidth, lines: wide.lines.length }, narrow: { wrap: narrow.wrap, ink: narrow.inkWidth },
  drawn: { x: drawn.frame.x, width: drawn.frame.width, height: drawn.frame.height, text: drawn.text, role: drawn.data.textRole, size: drawn.style.fontSize.tokenId, color: drawn.style.color.tokenId },
  centred: centred.frame.x, measuredText: wide.text, measuredHeight: wide.height }));
''')
        self.assertAlmostEqual(result['wide']['wrap'], result['measure'], delta=0.5)
        self.assertLessEqual(result['wide']['ink'], result['measure'] + 0.5)
        self.assertGreater(result['wide']['lines'], 1)
        self.assertEqual(result['narrow']['wrap'], 300)
        self.assertLessEqual(result['narrow']['ink'], 300)
        # Ranged left at the column's edge in a frame the measure wide, or centred in the column; the text drawn is the text measured.
        self.assertEqual(result['drawn']['x'], 100)
        self.assertAlmostEqual(result['drawn']['width'], result['measure'], delta=0.5)
        self.assertAlmostEqual(result['centred'], 100 + (1100 - result['measure']) / 2, delta=0.5)
        self.assertEqual((result['drawn']['text'], result['drawn']['height']), (result['measuredText'], result['measuredHeight']))
        self.assertEqual((result['drawn']['role'], result['drawn']['size'], result['drawn']['color']), ('note', 'type.body', 'color.textSecondary'))

    def test_a_widow_is_measured_and_a_one_line_setting_is_not(self):
        result = run_node('''
import { setText, settingOf } from './skills/professional-slides/runtime/text-roles.mjs';
const claim = 'lower LLM cost per minute with Tilt-1 vs. GPT-5.1';
console.log(JSON.stringify([376, 451, 564].map((width) => { const set = setText('statement', claim, width); return { lines: set.lines.length, last: set.lastFill, cost: settingOf(set) }; })));
''')
        third, two_fifths, half = result
        self.assertEqual(third['lines'], 2)
        self.assertLess(third['last'], 1 / 3)
        self.assertGreater(third['cost'], 0.1)
        self.assertLessEqual(third['cost'], 0.5)
        for one_line in (two_fifths, half):
            self.assertEqual((one_line['lines'], one_line['cost']), (1, 0))


class IconRowsMeasureTests(unittest.TestCase):
    def test_icon_rows_keep_their_measure_at_page_width_and_beside_a_figure(self):
        result = run_node(HERO + '''
import { createRegistry } from './skills/professional-slides/runtime/registry.mjs';
import { roleMeasure } from './skills/professional-slides/runtime/text-roles.mjs';
const rows = createRegistry().get('icon-rows'), props = { items: reasons };
const full = rows.render({ id: 'r', frame: { x: 60, y: 140, width: 1160, height: 500 }, props }).nodes;
const inks = rows.measureContent({ frame: { x: 0, y: 0, width: 1160 }, props }).inkWidth;
const page = hero(), beside = page.nodes.filter((n) => n.role === 'icon-row-text'), list = page.componentInstances.find((i) => i.component === 'icon-rows').frame;
const width = (nodes, role) => Math.max(...nodes.filter((n) => n.role === role).map((n) => n.frame.width));
console.log(JSON.stringify({ note: roleMeasure('note'), lead: roleMeasure('lead'), fullText: width(full, 'icon-row-text'), fullLead: width(full, 'icon-row-label'), inks,
  left: [...new Set(full.filter((n) => n.role === 'icon-row-text').map((n) => n.frame.x))], beside: Math.max(...beside.map((n) => n.frame.width)), besideLeft: beside.every((n) => n.frame.x < list.x + 80), list: list.width }));
''')
        # At the page's width the descriptions stop at their measure (a tenth's slack at most), ranged left on one edge.
        self.assertLessEqual(result['fullText'], result['note'] * 1.1 + 0.5)
        self.assertLessEqual(result['fullLead'], result['lead'] * 1.1 + 0.5)
        self.assertEqual(len(result['left']), 1)
        # What the list reports to the engine is the ink it takes, not the width it was given.
        self.assertLess(result['inks'], 1160 - 300)
        # Beside a figure the column is wider than the measure too, and the text keeps it there.
        self.assertGreater(result['list'], result['note'])
        self.assertLessEqual(result['beside'], result['note'] * 1.1 + 0.5)
        self.assertTrue(result['besideLeft'])


class TemplateTrackTests(unittest.TestCase):
    def test_a_template_lists_alternative_tracks_the_first_its_preference(self):
        result = run_node('''
import { resolveTemplate } from './skills/professional-slides/runtime/layout-templates.mjs';
const refusal = (grid) => { try { resolveTemplate(grid, null, 'p'); return null; } catch (error) { return error.message; } };
const one = resolveTemplate({ columns: '1fr 2fr', areas: ['kpi exhibit'] }, null, 'p');
const several = resolveTemplate({ columns: ['1fr 2fr', '2fr 3fr', '1fr 1fr'], areas: ['kpi exhibit'] }, null, 'p');
const both = resolveTemplate({ columns: ['1fr 2fr', '1fr 1fr'], rows: ['auto 1fr', '1fr 1fr'], areas: ['exhibit kpi', 'points insight'] }, null, 'p');
console.log(JSON.stringify({ one: one.tracks ?? null, columns: several.columns, labels: several.tracks.map((t) => t.label), second: several.tracks[1].columns, both: both.tracks.map((t) => t.label),
  wrongCount: refusal({ columns: ['1fr 2fr', '1fr 1fr 1fr'], areas: ['kpi exhibit'] }), twice: refusal({ columns: ['1fr 2fr', '1fr  2fr'], areas: ['kpi exhibit'] }), bad: refusal({ columns: ['1fr 2fr', 'wide'], areas: ['kpi exhibit'] }) }));
''')
        self.assertIsNone(result['one'])
        self.assertEqual(result['columns'], [{'fr': 1}, {'fr': 2}])
        self.assertEqual(result['labels'], ['1fr 2fr', '2fr 3fr', '1fr 1fr'])
        self.assertEqual(result['second'], [{'fr': 2}, {'fr': 3}])
        self.assertEqual(result['both'], ['1fr 2fr / auto 1fr', '1fr 2fr / 1fr 1fr', '1fr 1fr / auto 1fr', '1fr 1fr / 1fr 1fr'])
        self.assertIn('the tracks are 3 by 1', result['wrongCount'])
        self.assertIn('offered twice', result['twice'])
        self.assertIn('a track is', result['bad'])

    def test_the_hero_page_offers_its_tracks_and_sets_the_statement_on_one_line(self):
        result = run_node(HERO + '''
const page = hero(), decision = tracks(page);
console.log(JSON.stringify({ chosen: decision.chosen, offered: decision.candidates.map((c) => c.label), measures: Object.keys(decision.candidates[0]),
  settings: Object.fromEntries(decision.candidates.map((c) => [c.label, c.setting])), lines: statement(page).text.split('\\n').length, role: statement(page).data.textRole }));
''')
        self.assertEqual(sorted(result['offered']), sorted(['column / s-row=1fr 2fr', 'column / s-row=2fr 3fr', 'column / s-row=1fr 1fr']))
        self.assertIn('setting', result['measures'])
        # The third of the page leaves the statement's last word alone; the engine takes the wider column it needs.
        self.assertGreater(result['settings']['column / s-row=1fr 2fr'], result['settings'][result['chosen']])
        self.assertNotEqual(result['chosen'], 'column / s-row=1fr 2fr')
        self.assertEqual((result['lines'], result['role']), (1, 'statement'))

    def test_a_short_statement_keeps_the_preference_and_a_recorded_choice_holds(self):
        result = run_node(HERO + '''
const short = planDeck(toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'c', slides: [{ id: 's', title: 'Moving the model could cut the cost of a minute by a third',
  layout: 'hero-number', kpi: { value: '33%', label: 'lower cost per minute' }, exhibit: { type: 'icon-rows', heading: 'Why move?', items: reasons } }] })).deck.slides[0];
const held = hero({ choices: { 's-row-tracks': 'column / s-row=1fr 2fr' } });
const column = (slide) => slide.nodes.find((n) => n.role === 'metric-value').frame.width;
console.log(JSON.stringify({ short: tracks(short).chosen, held: tracks(held), lines: statement(held).text.split('\\n').length, widths: [column(held), column(hero())] }));
''')
        # A tie goes to the template's preference.
        self.assertEqual(result['short'], 'column / s-row=1fr 2fr')
        # A judge's choice stands, and the decision says it was held.
        self.assertEqual(result['held']['chosen'], 'column / s-row=1fr 2fr')
        self.assertTrue(result['held']['held'])
        self.assertEqual(result['lines'], 2)
        self.assertLess(result['widths'][0], result['widths'][1])


# Every page the example decks and the gallery draw: the scenes the scans below read.
SCAN = '''
import fs from 'node:fs';
import path from 'node:path';
import { toDeckPlan } from './evals/support/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
import { authorDeck, workedExamples } from './skills/professional-slides/runtime/author-deck.mjs';
import { TEXT_ROLES } from './skills/professional-slides/runtime/text-roles.mjs';
const dir = './skills/professional-slides/examples', pagesDir = './evals/regression/site-gallery/pages';
const decks = ['gallery-acceptance', 'house-style', 'nyc-or-sf'].map((name) => planDeck(toDeckPlan(JSON.parse(fs.readFileSync(`${dir}/${name}.deck.json`, 'utf8')), dir)).deck);
const doc = workedExamples();
doc.pages = [...doc.pages, ...fs.readdirSync(pagesDir).filter((name) => name.endsWith('.json')).sort().flatMap((name) => JSON.parse(fs.readFileSync(path.join(pagesDir, name), 'utf8')))];
const authored = await authorDeck(doc, { baseDir: dir });
const slides = [...decks.flatMap((deck) => deck.slides), ...(authored.deck?.slides ?? [])];
'''


class SeriesAndBandTests(unittest.TestCase):
    def test_a_band_spans_what_it_is_read_off_and_a_series_of_one_liners_runs_across_or_none_does(self):
        result = run_node('''
import { setText, oneLineEach, roleMeasure } from './skills/professional-slides/runtime/text-roles.mjs';
const sentence = 'Sell a Valentine express on the cheap direct route, and stop pricing convoys like letters: four birds in a sling cost four times as much to fly, so charge keys and seeds what they really cost.';
const band = setText('band', sentence, 1100), body = setText('body', sentence, 1100);
const short = ['The cruiser gets 40 cabins with round windows and a glass viewing deck.', 'Twelve pilots log 200 hours each in the simulator.'];
const long = [...short, 'An empty loop round the Moon proves the route, the oxygen budget and the coffee machine, with a test dummy in every cabin, twice over, before a single paying guest is allowed anywhere near the airlock.'];
console.log(JSON.stringify({ bandWrap: band.wrap, bodyWrap: body.wrap, measure: roleMeasure('body'), across: oneLineEach('body', short, 1100), notAcross: oneLineEach('body', long, 1100),
  spanned: setText('body', short[0], 1100, { lines: true }).wrap }));
''')
        # A closing band runs the width it is read across; body text stops at the reading measure.
        self.assertEqual(result['bandWrap'], 1100)
        self.assertEqual(result['bodyWrap'], result['measure'])
        # A series is set across its column only when every text in it is one line there.
        self.assertTrue(result['across'])
        self.assertFalse(result['notAcross'])
        self.assertEqual(result['spanned'], 1100)


class ContentRoleScanTests(unittest.TestCase):
    def test_every_text_set_in_a_content_role_is_at_least_body_size_across_the_examples_and_the_gallery(self):
        # The guard that replaces the audits: whatever a component sets in a content role, on any page the examples and
        # the gallery draw, is body text or larger.
        result = run_node(SCAN + '''
const seen = {}, under = [];
for (const slide of slides) for (const node of slide.nodes) {
  const role = node.data?.textRole;
  if (node.type !== 'text' || !role || !TEXT_ROLES[role]?.content) continue;
  seen[role] = (seen[role] ?? 0) + 1;
  // A token reference resolves under each slide's own tokens: the slide's body size is the floor.
  const body = slide.tokens?.['type.body']?.value ?? 12;
  if (node.style.fontSize.value < body - 0.01) under.push([slide.id, node.id, node.style.fontSize.value, body]);
}
console.log(JSON.stringify({ slides: slides.length, seen, under: under.slice(0, 10) }));
''')
        self.assertGreater(result['slides'], 100)
        # Every content role is drawn somewhere, so the scan cannot pass by seeing nothing.
        self.assertEqual(sorted(result['seen']), ['band', 'body', 'lead', 'note', 'statement'])
        self.assertEqual(result['under'], [])

    def test_every_text_a_component_draws_is_set_in_a_role_but_the_listed_furniture_still_to_move(self):
        # A text drawn without a role is a text no rule holds: a component that names a type token for its words could set
        # content at caption size again. So every text node the examples and the gallery draw carries its role stamp
        # (text-roles.mjs drawText), apart from the families listed here - each still to move onto the roles, and each
        # listed by the node roles it draws today. The list can only shrink: an entry nothing draws any more fails too, so
        # migrating a family means taking it off.
        result = run_node(SCAN + '''
const unstamped = {}, stamped = {}, unknown = [];
for (const slide of slides) {
  const component = new Map((slide.componentInstances ?? []).map((instance) => [instance.id, instance.component]));
  for (const node of slide.nodes) {
    if (node.type !== 'text') continue;
    const instance = node.data?.componentInstance ?? '', owner = component.get(instance.split(':').slice(1).join(':')) ?? component.get(instance) ?? '(page)';
    if (node.data?.textRole) { if (!TEXT_ROLES[node.data.textRole]) unknown.push([slide.id, node.id, node.data.textRole]); (stamped[owner] ??= new Set()).add(node.data.textRole); continue; }
    (unstamped[owner] ??= new Set()).add(node.role);
  }
}
const sets = (map) => Object.fromEntries(Object.entries(map).map(([key, roles]) => [key, [...roles].sort()]));
console.log(JSON.stringify({ unstamped: sets(unstamped), stamped: sets(stamped), unknown: unknown.slice(0, 5) }));
''')
        # Charts and the chart-like figures draw their axes, data labels, legends and annotations as furniture still
        # named by type token (chart-*.mjs, legends.mjs, maps.mjs, gantt.mjs, horizons.mjs). Every chart may draw these.
        chart_furniture = {'annotation-text', 'axis-label', 'axis-title', 'category-group-label', 'category-label', 'category-note',
                           'chart-annotation', 'chart-band-label', 'chart-bracket-label', 'chart-centre-value', 'chart-delta-label',
                           'chart-event-label', 'chart-period-label', 'chart-question', 'chart-question-badge-label',
                           'chart-question-base', 'chart-reference-label', 'chart-unit', 'data-label', 'legend-label', 'section-heading'}
        table_cells = {'table-bubble-label', 'table-cell-attribution', 'table-cell-text', 'table-group-text', 'table-header-text',
                       'table-header-unit', 'table-legend', 'table-progress-label', 'table-sparkline-label', 'table-status-label',
                       'table-trend-glyph'}
        listed = {
            # The tables' cells, headers and keys (tables.mjs): dense cells, still sized by the table's own type steps.
            'table': table_cells, 'heatmap': {'table-cell-text', 'table-header-text', 'table-legend'}, 'trend-rows': {'table-cell-text', 'table-header-text'},
            # The page's chrome: titles, subtitle, source, footer, page number, tracker, cover, divider, statement and
            # takeaways pages, a section's heading, a reference page's native title, an exhibit link's figure.
            'slide-chrome': {'action-subtitle', 'action-title', 'footer-right', 'footnote-text', 'page-number', 'page-tag', 'source-text', 'title-numeral', 'tracker-compact-label'},
            'cover': {'cover-date', 'cover-logo', 'cover-subtitle', 'cover-title'},
            'section-divider': {'divider-contents', 'divider-number', 'divider-title', 'footer-right'},
            'statement': {'footer-right', 'page-number', 'statement-subtext', 'statement-text'},
            'takeaways': {'footer-right', 'page-number', 'takeaways-item', 'takeaways-numeral', 'takeaways-title'},
            'section': {'section-heading'}, 'reference-page': {'text'}, 'exhibit-link': {'exhibit-link-label'},
            # Components whose words are content and are still to move (each its own module): the framework house, the
            # gantt, the map's labels, the insight tree, the relationship network, the horizons chart's panels and the
            # decision tree's labels.
            'framework': {'framework-foundation-text', 'framework-pillar-point', 'framework-pillar-title', 'framework-roof-text'},
            'gantt': {'gantt-bar-label', 'gantt-group-label', 'gantt-label', 'gantt-milestone-label', 'gantt-period', 'gantt-tier', 'gantt-today-label'},
            'map': {'map-label', 'map-marker-value', 'map-size-legend-label'},
            'insight-tree-table': {'insight-tree-header', 'insight-tree-implication-text', 'insight-tree-insight-text', 'node-label'},
            'relationship-network': {'network-node-label'},
            'chart.horizons': {'axis-title', 'horizon-description', 'horizon-detail-label', 'horizon-detail-value', 'horizon-label', 'horizon-timeframe', 'horizon-title'},
            'tree': {'decision-conclusion', 'decision-label'},
        }
        allowed = lambda owner: listed.get(owner, chart_furniture if owner.startswith('chart.') or owner == 'chart-group' else set())
        bypass = {owner: sorted(set(roles) - allowed(owner)) for owner, roles in result['unstamped'].items() if set(roles) - allowed(owner)}
        self.assertEqual(bypass, {}, 'text drawn without a role (text-roles.mjs) by a component not listed as still to move')
        self.assertEqual(result['unknown'], [])
        # The list only shrinks: every entry is still drawn unstamped somewhere, so a migrated family is taken off it.
        seen = {owner: set(roles) for owner, roles in result['unstamped'].items()}
        charts = set().union(*(roles for owner, roles in seen.items() if owner.startswith('chart.') and owner != 'chart.horizons' or owner == 'chart-group'))
        stale = {owner: sorted(roles - seen.get(owner, set())) for owner, roles in listed.items() if roles - seen.get(owner, set())}
        self.assertEqual(stale, {})
        self.assertEqual(sorted(chart_furniture - charts), [])
        # The components moved onto the roles draw every word in one: none of them is on the list.
        for owner in ('process', 'roadmap', 'timeline', 'journey', 'chevron-process', 'initiative-rollout', 'highlight-strip', 'organization',
                      'bullet-list', 'insight', 'callout', 'paragraph', 'status-list', 'quote-cluster', 'cards', 'quadrants', 'metric', 'agenda',
                      'stat-list', 'pictogram', 'capsules', 'fact-grid', 'spectrum', 'layers', 'nested-circles', 'venn', 'placement', 'speech',
                      'worksheet', 'side-statement', 'radial-bars', 'flow', 'rank-flow', 'sankey', 'cycle', 'steps', 'people', 'logos', 'matrix',
                      'funnel', 'icon-rows', 'arrow-rows', 'agenda-rows', 'zone-matrix', 'device-frame'):
            with self.subTest(component=owner):
                self.assertNotIn(owner, result['unstamped'])


if __name__ == '__main__':
    unittest.main()
