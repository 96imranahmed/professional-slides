"""Design defects still visible on a rebuilt fifty-page deck, each held at the
place the page is composed or compiled.

A summary's four points left a band of air between their rows; staircases
left empty triangles; one page's row tables mixed in-cell bars with plain
figures and repeated their figures in the row labels; a bar was labelled "12"
where the copy said 11.6; a rising cost was coloured as good news; forms the
renderer could draw had no page that reached them; and three places told an
author a callout's length from a number nobody measured.
"""
import unittest

from node_probe import run_node, REFERENCES

KIT = "./skills/professional-slides/runtime/page-types.mjs"


class CalloutCapacityTests(unittest.TestCase):
    """Every message about a callout's length reads the box's own measure."""

    def test_the_refusal_and_the_redraws_say_the_measured_capacity(self):
        result = run_node(f'''
import {{ compilePage, calloutCapacity, describeTypes }} from '{KIT}';
import {{ countInWords }} from './skills/professional-slides/runtime/chart-annotations.mjs';
import {{ REDRAWS }} from './skills/professional-slides/runtime/gates/variety_gates.mjs';
const years = ['2019','2020','2021','2022','2023','2024','2025','2026'];
const long = 'Traffic fell to a fifth of its level when the whole network was grounded for the spring and summer';
let refusal = null;
try {{ compilePage({{ id: 't', type: 'trend', form: 'line', commentary: 'on-exhibit', takeaway: false, adds: 'The callout names the mechanism the exhibit cannot show',
  why: 'The break is the claim here', settles: {{ kind: 'rate', what: 'The evidence recorded for this page' }}, title: 'Traffic fell and recovered',
  exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 2, 4, 5, 6, 6, 7] }}], annotations: [{{ category: '2020', text: long }}] }} }}); }}
catch (e) {{ refusal = e.message; }}
const n = calloutCapacity();
console.log(JSON.stringify({{ n, words: countInWords(n), refusal, redraw: REDRAWS.find((r) => r.holding === 'notes on particular marks').choice,
  types: describeTypes().includes(`a chart callout holds about ${{n}} words`) }}));
''')
        self.assertGreater(result['n'], 4)
        self.assertIn(f"a callout holds about {result['words']} words", result['refusal'])
        self.assertIn(f"about {result['words']} words each", result['redraw'])
        self.assertTrue(result['types'])
        docs = (REFERENCES / 'page-types.md').read_text(encoding='utf-8')
        self.assertIn(f"about {result['words']} words each", docs)
        self.assertNotIn('about twelve words', result['refusal'] + result['redraw'])


PLANNED = '''
import {{ toDeckPlan }} from './skills/professional-slides/runtime/compose.mjs';
import {{ planDeck }} from './skills/professional-slides/runtime/planner.mjs';
const plan = (slides) => planDeck(toDeckPlan({{ schema: 'professional-slides.deck/v3', id: 'd', slides }})).deck;
'''


class QuotedPrecisionTests(unittest.TestCase):
    """A label carries the precision the page's copy quotes for the same value."""

    def test_a_figure_the_copy_quotes_keeps_its_decimal(self):
        result = run_node(PLANNED.format() + '''
const chart = { type: 'chart.bar', heading: 'Announced face value', unit: '$B', categories: ['Azure', 'AWS one', 'AWS two', 'Akamai'],
  series: [{ name: 'Face value', values: [250, 100, 100, 11.6] }] };
const page = (subtitle) => ({ id: 's', title: 'Each lab has signed compute contracts worth over $100 billion', subtitle, layout: 'exhibit-full', exhibit: chart });
const labels = (deck) => deck.slides[0].nodes.filter((n) => n.role === 'data-label').map((n) => n.text);
const quoted = plan([page("Announced face values; Akamai's $11.6B is in an SEC filing")]);
const silent = plan([page('Announced face values; payment timing is undisclosed')]);
const native = (deck) => deck.slides[0].componentInstances.find((c) => c.component === 'chart.bar')?.nativeChart ?? null;
console.log(JSON.stringify({ quoted: labels(quoted), silent: labels(silent), nativeQuoted: native(quoted), nativeSilent: Boolean(native(silent)) }));
''')
        self.assertIn('11.6', result['quoted'])
        self.assertIn('250', result['quoted'])
        # Unquoted, the chart keeps its one precision: whole numbers past 100.
        self.assertIn('12', result['silent'])
        self.assertNotIn('11.6', result['silent'])
        # A series of mixed precision is drawn, not handed to one native number format.
        self.assertIsNone(result['nativeQuoted'])
        self.assertTrue(result['nativeSilent'])

    def test_only_figures_written_with_decimals_are_quoted(self):
        result = run_node('''
import { figuresWithDecimals, formatValue } from './skills/professional-slides/runtime/value-format.mjs';
const quoted = figuresWithDecimals(['Revenue of $1,234.56m and 4.75% growth in 2026, 57% of visits']);
console.log(JSON.stringify({ quoted, two: formatValue(4.75, { values: [480, 4.75], quotedFigures: quoted }), whole: formatValue(57.4, { values: [480, 57.4], quotedFigures: quoted }) }));
''')
        self.assertEqual(result['quoted'], [{'value': 1234.56, 'decimals': 2}, {'value': 4.75, 'decimals': 2}])
        self.assertEqual(result['two'], '4.75')
        self.assertEqual(result['whole'], '57')


class PolarityTests(unittest.TestCase):
    """A delta and a trend arrow are coloured by merit, not by sign."""

    def test_a_rising_cost_is_the_bad_state(self):
        result = run_node('''
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const metric = (props) => REGISTRY.get('metric').render({ id: 'm', frame: { x: 0, y: 0, width: 300, height: 160 }, props }).nodes.find((n) => n.role === 'metric-delta').style.color.tokenId;
const table = REGISTRY.get('table').render({ id: 't', frame: { x: 0, y: 0, width: 700, height: 300 }, props: {
  columns: ['Measure', { label: 'Trend', type: 'trend' }, { label: 'Queue', type: 'trend', better: 'down' }],
  rows: [['Revenue', { type: 'trend', value: 'up' }, { type: 'trend', value: 'up' }],
         { better: 'down', cells: ['Unit cost', { type: 'trend', value: 'up' }, { type: 'trend', value: 'down' }] },
         ['Churn', { type: 'trend', value: 'down', better: 'down' }, { type: 'trend', value: 'flat' }]] } }).nodes;
const rings = table.filter((n) => n.role === 'table-trend').map((n) => n.style.stroke.tokenId);
let refused = null;
try { metric({ value: '4.1%', label: 'Churn', delta: '+0.3 pts', better: 'lower' }); } catch (e) { refused = e.message; }
console.log(JSON.stringify({
  revenueUp: metric({ value: '$4.1B', label: 'Revenue', delta: '+8%' }),
  costUp: metric({ value: '$1.2B', label: 'Cost to serve', delta: '+8%', better: 'down' }),
  costDown: metric({ value: '$1.0B', label: 'Cost to serve', delta: '-6%', better: 'down' }),
  rings, refused }));
''')
        self.assertEqual(result['revenueUp'], 'color.positive')
        self.assertEqual(result['costUp'], 'color.negative')
        self.assertEqual(result['costDown'], 'color.positive')
        # Row by row: revenue up (good), a queue up (bad: the column says down);
        # a cost row rising (bad) and its queue falling (good); churn falling (good), flat (grey).
        self.assertEqual(result['rings'], ['color.positive', 'color.negative', 'color.negative', 'color.positive', 'color.positive', 'color.textSecondary'])
        self.assertIn('"up" or "down"', result['refused'])

    def test_the_author_sets_it_on_a_typed_page_and_a_wrong_value_is_refused(self):
        result = run_node(f'''
import {{ compilePage, pageSchema }} from '{KIT}';
const page = (better) => ({{ id: 'n', type: 'numbers', form: 'metric-strip', commentary: 'none', why: 'The strip carries the change and the chart shows the path',
  settles: {{ kind: 'rate', what: 'Unit cost over eight years' }}, title: 'Unit cost fell by two fifths as volume doubled',
  metrics: [{{ value: '-40%', label: 'Unit cost since 2019', delta: '-40%', better }}, {{ value: '2.1x', label: 'Volume since 2019' }}],
  exhibit: {{ type: 'chart.line', categories: ['2019','2020','2021','2022','2023','2024','2025','2026'], series: [{{ name: 'Cost', values: [10, 9.4, 9, 8.1, 7.6, 7, 6.4, 6] }}],
    annotations: [{{ category: '2022', text: 'Second plant opens and the fixed cost is shared' }}] }} }});
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
const schema = pageSchema('numbers');
console.log(JSON.stringify({{ down: compilePage(page('down')).metrics[0].better, wrong: error(() => compilePage(page('lower'))),
  schema: schema.properties.metrics.items.properties.better.enum, kpi: schema.properties.kpi.properties.better.enum }}));
''')
        self.assertEqual(result['down'], 'down')
        self.assertIn('`better` on metrics[0] is "lower"', result['wrong'])
        self.assertEqual(result['schema'], ['up', 'down'])
        self.assertEqual(result['kpi'], ['up', 'down'])


SUMMARY_POINTS = [
    {"lead": "Reach", "text": "The incumbent has more than one billion weekly users and 57% of visits to six major sites, a direct funnel into subscriptions, ads and workplace sales. No matched series is public, so this is a reach lead, not a profit verdict."},
    {"lead": "Paid work", "text": "The challenger passed the incumbent in a US purchase-incidence panel in May and led 43.8% to 39.8% in August, with more than 500 accounts above $1 million a year. Buyers may pay both and retention is unpublished."},
    {"lead": "Capability", "text": "The challenger's model scores highest of five tested models on the current index, while a rival matches the second at a lower cost per task. Cost per successful customer task at matched effort is the test that decides procurement."},
    {"lead": "Capital and horizon", "text": "The incumbent disclosed $122 billion of committed financing and an undrawn revolver; the challenger announced $65 billion at a later mark. Neither publishes funded cash net of timed obligations, so capital quality stays unranked."},
]


class SummaryLedgerTests(unittest.TestCase):
    """Four developed findings fill the summary's body, row by row, with no band between them."""

    def test_four_findings_run_down_the_body_as_a_ledger(self):
        import json
        result = run_node(PLANNED.format() + f'''
const deck = plan([{{ id: 's', title: 'The incumbent leads reach and funding; the challenger leads paid work', role: 'executive-summary', layout: 'text', pointsStyle: 'prose',
  points: {json.dumps(SUMMARY_POINTS)} }}]);
const slide = deck.slides[0];
const text = slide.nodes.filter((n) => ['list-lead', 'list-item'].includes(n.role) && n.frame).map((n) => n.frame).sort((a, b) => a.y - b.y);
const rules = slide.nodes.filter((n) => n.role === 'subsection-rule').map((n) => n.frame.y);
const body = slide.contentFrame;
// The widest run of rows no text crosses, between the first line and the last.
let gap = 0; for (let i = 1; i < text.length; i++) gap = Math.max(gap, text[i].y - Math.max(...text.slice(0, i).map((f) => f.y + f.height)));
console.log(JSON.stringify({{ top: text[0].y - body.y, foot: body.y + body.height - Math.max(...text.map((f) => f.y + f.height)), gap, rules: rules.length,
  heads: new Set(slide.nodes.filter((n) => n.role === 'list-lead').map((n) => n.frame.x)).size, widest: Math.max(...slide.nodes.filter((n) => n.role === 'list-item').map((n) => n.frame.width)) }}));
''')
        # The first finding starts under the title and the last ends at the body's foot.
        self.assertLess(result['top'], 24)
        self.assertLess(result['foot'], 48)
        # No band of air between findings: the widest gap is a row's spacing, not a third of the page.
        self.assertLess(result['gap'], 110)
        self.assertEqual(result['rules'], 3)
        # The leads read down one column, and the statements keep a reading measure.
        self.assertEqual(result['heads'], 1)
        self.assertLessEqual(result['widest'], 610)


class StaircaseTests(unittest.TestCase):
    """A staircase uses its frame: solid steps, and the commentary in the space it climbs into."""

    STEPS = [{"label": "Publish", "text": "The lab introduces the protocol"},
             {"label": "Adopt", "text": "Tool builders implement servers and clients"},
             {"label": "Donate", "text": "The protocol moves to a foundation"},
             {"label": "Compete", "text": "Several labs build on the interface"}]

    def test_the_commentary_sits_over_the_lower_steps_and_the_stair_climbs_the_body(self):
        import json
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
import {{ toDeckPlan }} from './skills/professional-slides/runtime/compose.mjs';
import {{ planDeck }} from './skills/professional-slides/runtime/planner.mjs';
const page = compilePage({{ id: 'm', type: 'mechanism', form: 'steps', commentary: 'below', takeaway: false, why: 'Four stages show how the standard spread',
  settles: {{ kind: 'sequence', what: 'The dated stages of the protocol' }}, title: 'The protocol spread from one lab to the field in four steps',
  adds: 'The points say why openness limits capture',
  exhibit: {{ items: {json.dumps(self.STEPS)} }},
  points: ['The lab helped establish the protocol as a common way for assistants to connect to tools and data, and donating it widened its reach.',
           'That same openness limits capture: a customer can route work to another model if quality, price or policy changes.'],
  highlight: ['common way for assistants', 'openness limits capture'] }});
const {{ deck }} = planDeck(toDeckPlan({{ schema: 'professional-slides.deck/v3', id: 'd', slides: [page] }}));
const slide = deck.slides[0], body = slide.contentFrame;
const columns = slide.nodes.filter((n) => n.role === 'step-column').map((n) => n.frame);
const treads = slide.nodes.filter((n) => n.role === 'step-block').map((n) => n.frame);
const points = slide.nodes.filter((n) => n.role === 'list-item').map((n) => n.frame);
const texts = slide.nodes.filter((n) => n.role === 'step-text').map((n) => n.frame);
console.log(JSON.stringify({{ body, columns, treads, points, texts }}));
''')
        body, columns, treads, points = result['body'], result['columns'], result['treads'], result['points']
        self.assertEqual(len(columns), 4)
        # Each step is solid from its tread to the baseline, and the stair stands on the body's foot.
        for column, tread in zip(columns, treads):
            self.assertAlmostEqual(column['y'], tread['y'], places=3)
        foot = body['y'] + body['height']
        self.assertTrue(all(abs(c['y'] + c['height'] - foot) < 2 for c in columns))
        # The last step reaches the top of the body; the points sit above the first two steps.
        self.assertLess(treads[-1]['y'] - body['y'], 16)
        right = max(p['x'] + p['width'] for p in points)
        bottom = max(p['y'] + p['height'] for p in points)
        self.assertLess(right, columns[2]['x'])
        self.assertLess(bottom, treads[1]['y'])
        self.assertLess(points[0]['y'] - body['y'], 60)
        # Each description sits inside its own step, under the tread.
        for text, tread, column in zip(result['texts'], treads, columns):
            self.assertGreaterEqual(text['y'], tread['y'] + tread['height'])
            self.assertLessEqual(text['x'] + text['width'], column['x'] + column['width'] + 0.5)

    def test_commentary_too_long_for_the_space_stays_under_the_stair(self):
        import json
        long = "A lasting lead requires retained paid tasks at positive contribution and cash coverage of compute obligations; neither firm discloses these on a matched basis, so the outcome can remain open for years while both grow quickly."
        result = run_node(PLANNED.format() + f'''
const deck = plan([{{ id: 's', title: 'Three steps', layout: 'exhibit-top', pageType: {{ type: 'mechanism', form: 'steps' }},
  exhibit: {{ type: 'steps', items: {json.dumps(self.STEPS[:3])} }}, points: {json.dumps([{"lead": "Near term", "text": long}, {"lead": "Long term", "text": long}, {"lead": "Reversal", "text": long}])} }}]);
const slide = deck.slides[0];
const columns = slide.nodes.filter((n) => n.role === 'step-column').map((n) => n.frame);
const points = slide.nodes.filter((n) => ['list-item', 'paragraph'].includes(n.role) || /points/.test(n.id)).filter((n) => n.frame && n.type === 'text').map((n) => n.frame);
console.log(JSON.stringify({{ stairFoot: Math.max(...columns.map((c) => c.y + c.height)), pointsTop: Math.min(...points.map((p) => p.y)) }}));
''')
        self.assertLess(result['stairFoot'], result['pointsTop'])


class RowTableTests(unittest.TestCase):
    """One page's row tables share a treatment, and a row's label does not repeat its figures."""

    def test_row_tables_on_one_page_share_a_treatment(self):
        result = run_node(PLANNED.format() + '''
const block = (label, head, rows) => ({ label, points: ['A point that says what the row shows and why it matters here.', 'A second point with the qualification.'],
  exhibit: { type: 'table', columns: [{ label: head, type: 'category' }, 'Count'], rows } });
const deck = plan([{ id: 's', title: 'Three measures of the account base', layout: 'labelled-rows', blocks: [
  block('Large accounts', 'Accounts above $1M', [['Two years earlier', '~12'], ['February 2026', '>500']]),
  block('Enterprise breadth', 'Fortune 10', [['Customers', '8'], ['Not disclosed', '2']]),
  block('Coding dollars', 'Claude Code', [['Revenue', '2,500'], ['Enterprise share', '50']]) ] }]);
const sizes = (d) => [...new Set(d.slides[0].nodes.filter((n) => ['table-cell-text', 'table-header-text'].includes(n.role)).map((n) => n.style.fontSize.value))];
// A unit line under one table's header costs it the height, and its type steps down: the page's tables step together.
const units = plan([{ id: 't', title: 'Three measures of the account base', layout: 'labelled-rows', blocks: [
  block('Large accounts', 'Accounts above $1M', [['Two years earlier', '~12'], ['February 2026', '>500']]),
  { ...block('Enterprise breadth', 'Fortune 10', []), exhibit: { type: 'table', columns: [{ label: 'Fortune 10', type: 'category' }, { label: 'Companies', unit: 'of 10' }], rows: [['Claude customers', '8'], ['Not disclosed as customers', '2']] } },
  block('Coding dollars', 'Claude Code', [['Annualized revenue', '>$2.5B'], ['Share from enterprises', '>50%']]) ] }]);
console.log(JSON.stringify({ bars: deck.slides[0].nodes.filter((n) => n.role === 'table-bar').length, sizes: sizes(deck), unitSizes: sizes(units) }));
''')
        # Two tables of exact figures could take bars; the bounds in the first cannot, so none does.
        self.assertEqual(result['bars'], 0)
        # And one type size across the page's tables.
        self.assertEqual(len(result['sizes']), 1)
        self.assertEqual(len(result['unitSizes']), 1)

    def test_a_label_repeating_its_rows_figures_is_refused(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
const table = (head, rows) => ({{ type: 'table', columns: [{{ label: 'Lab', type: 'category' }}, head], rows }});
const page = (labels) => ({{ id: 'r', type: 'parallel', form: 'labelled-rows', commentary: 'in-exhibit', takeaway: false, why: 'Each financing state sits beside its figures',
  settles: {{ kind: 'comparison', what: 'Dated funding and valuation states' }}, title: 'One lab raised more; the other took the higher mark',
  blocks: [{{ label: labels[0], points: ['The first lab closed its round in March.', 'The second announced its round in May.'], exhibit: table('Round, $B', [['First', '122'], ['Second', '65']]) }},
           {{ label: labels[1], points: ['The first priced its round in March.', 'The second priced a later round in May.'], exhibit: table('Post-money, $B', [['First', '852'], ['Second', '965']]) }}] }});
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
console.log(JSON.stringify({{ repeated: error(() => compilePage(page(['First $122B\\nSecond $65B', 'Post-money mark']))), named: error(() => compilePage(page(['Round size', 'Post-money mark']))) }}));
''')
        self.assertIn('repeats 122 and 65', result['repeated'])
        self.assertIsNone(result['named'])


class HeroNumberTests(unittest.TestCase):
    """The first thing said about the hero number sits under it, not under a box's air."""

    def test_the_points_follow_the_number(self):
        result = run_node(PLANNED.format() + '''
const deck = plan([{ id: 's', title: 'The lead model scores five points above the next two', layout: 'hero-number', subtitle: 'Index v4.3.2, max effort, September 2026',
  kpi: { value: '58', label: 'Lead model on the index', sublabel: 'Five points above the next two, 22 September' },
  points: ['The index placed the lead model at 58 on 22 September, the highest score in that snapshot; an earlier test had two rivals tied at 53, so one release changed the leader in a week.',
           'The index combines selected tasks and configurations. Teams should evaluate their own work, effort settings and reliability, especially for long agent runs.'],
  exhibit: { type: 'chart.bar', heading: 'Index score', unit: 'points', categories: ['A', 'B', 'C', 'D', 'E'], series: [{ name: 'Score', values: [58, 53, 53, 48, 37] }] } }]);
const nodes = deck.slides[0].nodes;
const metric = Math.max(...nodes.filter((n) => n.role?.startsWith('metric-') && n.frame).map((n) => n.frame.y + n.frame.height));
const first = Math.min(...nodes.filter((n) => n.role === 'list-item' && n.frame).map((n) => n.frame.y));
console.log(JSON.stringify({ gap: first - metric }));
''')
        self.assertGreaterEqual(result['gap'], 0)
        self.assertLess(result['gap'], 32)


class CatalogueRouteTests(unittest.TestCase):
    """Every chart and preset the composer can draw is reached by a page type, or says why not."""

    def test_every_preset_is_routed_or_marked_internal(self):
        result = run_node(f'''
import fs from 'node:fs';
import {{ PRESET_ROUTES, compilePage, PAGE_TYPES }} from '{KIT}';
import {{ SHAPE_NAMES, PAGE_SHAPE_NAMES, composeSlide }} from './skills/professional-slides/runtime/compose.mjs';
const example = JSON.parse(fs.readFileSync('./skills/professional-slides/examples/page-types.pages.json', 'utf8'));
const pages = [...example.pages, ...(example.appendix || [])];
const out = {{ missing: [], unreached: [] }};
for (const [group, names] of [['shapes', SHAPE_NAMES], ['layouts', PAGE_SHAPE_NAMES]]) for (const name of names) {{
  const route = PRESET_ROUTES[group][name];
  if (!route) {{ out.missing.push(name); continue; }}
  if (route.internal) continue;
  if (route.type && !PAGE_TYPES[route.type]?.forms[route.form ?? Object.keys(PAGE_TYPES[route.type].forms)[0]]) {{ out.unreached.push(`${{name}}: ${{route.type}}/${{route.form}} is not a form`); continue; }}
  if (route.commentary && route.type && !(PAGE_TYPES[route.type].commentary.includes(route.commentary))) {{ out.unreached.push(`${{name}}: ${{route.type}} takes no ${{route.commentary}}`); continue; }}
  // Composed from the worked page of the route where the example deck has one.
  const page = pages.find((p) => p.type && (!route.type || p.type === route.type) && (!route.form || p.form === route.form) && (!route.commentary || p.commentary === route.commentary));
  if (!page) continue;
  const slide = compilePage(page, 0);
  if (group === 'shapes') {{ if (slide.shape !== name && slide.role !== name) out.unreached.push(`${{name}}: ${{page.id}} writes ${{slide.shape ?? slide.role}}`); continue; }}
  const recent = [];
  try {{ composeSlide(slide, 0, './skills/professional-slides/examples', 'balanced', 1, recent); }} catch (e) {{ out.unreached.push(`${{name}}: ${{e.message}}`); continue; }}
  if (recent[0] !== name) out.unreached.push(`${{name}}: ${{page.id}} composes as ${{recent[0]}}`);
}}
console.log(JSON.stringify(out));
''')
        self.assertEqual(result['missing'], [])
        self.assertEqual(result['unreached'], [])

    def test_the_panel_only_charts_are_forms_with_worked_pages(self):
        result = run_node(f'''
import fs from 'node:fs';
import {{ PAGE_TYPES, compilePage, pageSchema }} from '{KIT}';
const example = JSON.parse(fs.readFileSync('./skills/professional-slides/examples/page-types.pages.json', 'utf8'));
const forms = {{ 'ranking/boxplot': 'chart.boxplot', 'trend/sparklines': 'chart.sparklines', 'composition/pictogram': 'pictogram',
  'profiles/radar': 'chart.radar', 'schedule/horizons': 'chart.horizons', 'trend/model': 'model-page' }};
const out = {{}};
for (const [key, target] of Object.entries(forms)) {{
  const [type, form] = key.split('/');
  const page = example.pages.find((p) => p.type === type && p.form === form);
  const slide = page ? compilePage(page, 0) : null;
  out[key] = {{ catalogue: PAGE_TYPES[type].forms[form] === target, worked: Boolean(page),
    drawn: slide ? [slide.exhibit?.type, ...(slide.exhibits || []).map((e) => e.type), slide.shape, slide.layout].filter(Boolean) : [] }};
}}
const radar = pageSchema('profiles').allOf.find((r) => r.if.properties.form.const === 'radar');
console.log(JSON.stringify({{ out, radar: radar?.then.properties.commentary.enum }}));
''')
        for key, entry in result['out'].items():
            self.assertTrue(entry['catalogue'], key)
            self.assertTrue(entry['worked'], f'{key} has no worked page for --example')
        self.assertIn('chart.boxplot', result['out']['ranking/boxplot']['drawn'])
        self.assertIn('model-page', result['out']['trend/model']['drawn'])
        self.assertEqual(result['radar'], ['below', 'none'])

    def test_a_form_refuses_what_it_cannot_draw(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
const base = {{ takeaway: false, why: 'The spread of each member is the claim here', settles: {{ kind: 'rank', what: 'Monthly punctuality by operator' }}, adds: 'The points say where the bad months come from' }};
const box = (extra) => ({{ ...base, id: 'b', type: 'ranking', form: 'boxplot', commentary: 'below', title: 'One operator swings more than its five peers',
  points: ['The median month is on the peer median at 89%.', 'The range runs 17 points, from 77% to 94%.'],
  exhibit: {{ categories: ['A', 'B', 'C', 'D'], boxes: [1, 2, 3, 4].map((i) => ({{ min: 80 + i, q1: 84 + i, median: 88, q3: 90, max: 94 }})), ...extra }} }});
const spark = (items) => ({{ ...base, id: 's', type: 'trend', form: 'sparklines', commentary: 'so-what-bar', bar: 'The lines that run a train every half hour recovered and the others did not',
  settles: {{ kind: 'rate', what: 'Journeys by line against FY19' }}, adds: null, title: 'Two of four lines are back above their FY19 level', exhibit: {{ items, highlights: [{{ category: 'East' }}] }} }});
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
console.log(JSON.stringify({{
  unmarked: error(() => compilePage(box({{}}))),
  marked: error(() => compilePage(box({{ highlights: [{{ category: 'D' }}] }}))),
  onExhibit: error(() => compilePage({{ ...box({{ highlights: [{{ category: 'D' }}] }}), commentary: 'on-exhibit' }})),
  short: error(() => compilePage(spark([{{ label: 'East', values: [1, 2, 3] }}, {{ label: 'West', values: [1, 2, 3] }}]))),
  fine: error(() => compilePage(spark(['East', 'West', 'North', 'South'].map((label, i) => ({{ label, values: [100, 60 + i, 80 + i, 95 + i] }}))))) }}));
''')
        self.assertIn('marks its subject', result['unmarked'])
        self.assertIsNone(result['marked'])
        self.assertIn('choose `commentary`', result['onExhibit'])
        self.assertIn('four or more periods', result['short'])
        self.assertIsNone(result['fine'])

if __name__ == "__main__":
    unittest.main()
