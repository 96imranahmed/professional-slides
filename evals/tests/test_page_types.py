"""Page types: every page chooses its structure, and the deck's choices are gated.

A deck authored through one helper came out as one page fifty times: a closing
line on every page and bullets under the exhibit on nearly all of them. Pages
are now written as types whose choices have no defaults; the compiler derives
the structure from the choices, and the variety contract reads them before
anything is drawn.
"""
import unittest

from node_probe import RUNTIME, run_node

KIT = "./skills/professional-slides/runtime/page-types.mjs"
AUTHOR = "./skills/professional-slides/runtime/author-deck.mjs"


class CompileTests(unittest.TestCase):
    def test_every_choice_is_required_and_sets_the_structure(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
const years = ['2019','2020','2021','2022','2023','2024','2025','2026'];
const base = {{ id: 'p1', type: 'trend', form: 'line', commentary: 'on-exhibit', takeaway: false, why: 'The break is the claim and sits where it happens', settles: {{ kind: 'qualitative', what: 'The evidence recorded for this page' }},
  title: 'Traffic fell and recovered', exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 2, 4, 5, 6, 6, 7] }}], annotations: [{{ category: '2020', text: 'Traffic fell to a fifth when the network was grounded' }}] }} }};
const error = (page) => {{ try {{ compilePage(page); return null; }} catch (e) {{ return e.message; }} }};
const ok = compilePage(base);
const side = compilePage({{ ...base, commentary: 'beside', points: ['One', 'Two'], highlight: ['One', 'Two'], takeaway: 'So what' }});
const panels = compilePage({{ id: 'p2', type: 'panels', form: 'row', commentary: 'captions', takeaway: false, why: 'Three airlines answer the same question side by side', settles: {{ kind: 'qualitative', what: 'The evidence recorded for this page' }},
  title: 'Each hub grew', exhibits: [0, 1].map((i) => ({{ type: 'chart.column', categories: ['A', 'B', 'C', 'D'], series: [{{ name: 'x', values: [1, 2, 3, 4] }}], caption: 'Hub ' + i + ' added traffic in every year of the run' }})) }});
console.log(JSON.stringify({{
  layout: ok.layout, type: ok.exhibit.type, pageType: ok.pageType.type, close: ok.soWhat ?? null,
  sideLayout: side.layout, sideClose: side.soWhat, arrange: panels.arrange,
  noCommentary: error({{ ...base, commentary: undefined }}), noTakeaway: error({{ ...base, takeaway: undefined }}),
  noForm: error({{ ...base, form: 'pie' }}), layoutWritten: error({{ ...base, layout: 'exhibit-top' }}),
  pointsOnExhibit: error({{ ...base, points: ['x'] }}), bare: error({{ ...base, exhibit: {{ ...base.exhibit, annotations: [] }} }}),
  twoPeriods: error({{ ...base, exhibit: {{ ...base.exhibit, categories: ['2019', '2020'] }} }}),
  noCaption: error({{ id: 'p3', type: 'panels', form: 'row', commentary: 'captions', takeaway: false, why: 'Two measures that together prove it', settles: {{ kind: 'qualitative', what: 'The evidence recorded for this page' }},
    title: 't', exhibits: [0, 1].map(() => ({{ type: 'chart.bar', categories: ['a', 'b', 'c', 'd'], series: [{{ name: 'x', values: [1, 2, 3, 4] }}] }})) }}),
}}));
''')
        self.assertEqual(result['layout'], 'exhibit-full')
        self.assertEqual(result['type'], 'chart.line')  # the form sets the exhibit type
        self.assertEqual(result['pageType'], 'trend')
        self.assertIsNone(result['close'])
        self.assertEqual(result['sideLayout'], 'exhibit-left')
        self.assertEqual(result['sideClose'], 'So what')
        self.assertEqual(result['arrange'], 'row')
        for key in ('noCommentary', 'noTakeaway', 'noForm'):
            self.assertIn('choose', result[key])
        self.assertIn('set by the page', result['layoutWritten'])
        self.assertIn('move the points', result['pointsOnExhibit'])
        self.assertIn('marks its finding', result['bare'])
        self.assertIn('four or more periods', result['twoPeriods'])
        self.assertIn('caption', result['noCaption'])


class VarietyContractTests(unittest.TestCase):
    def test_a_stamped_deck_is_refused_and_a_chosen_one_compiles(self):
        result = run_node(f'''
import {{ compileDeck }} from '{AUTHOR}';
import {{ varietyFindings }} from './skills/professional-slides/runtime/gates/variety_gates.mjs';
import {{ structureOf }} from '{KIT}';
const years = ['2019','2020','2021','2022','2023','2024','2025','2026'];
const chart = (extra = {{}}) => ({{ categories: years, series: [{{ name: 'x', values: [1, 2, 3, 4, 5, 6, 7, 8] }}], annotations: [{{ category: '2021', text: 'The turn came when grounded capacity returned to the network' }}], ...extra }});
const stamped = Array.from({{ length: 14 }}, (_, i) => ({{ id: 's' + i, type: 'trend', form: 'line', commentary: 'below', takeaway: 'So what ' + i,
  why: 'Every page takes the same shape here', settles: {{ kind: 'qualitative', what: 'The evidence recorded for this page' }}, title: 'Finding ' + i, exhibit: chart(), points: ['a', 'b', 'c'], highlight: ['a', 'b', 'c'] }}));
let refused = compileDeck({{ deck: {{ schema: 'professional-slides.deck/v3', id: 'd' }}, pages: stamped }}).findings.map((f) => f.code).sort();
const kinds = [
  {{ type: 'trend', form: 'line', commentary: 'on-exhibit', exhibit: chart() }},
  {{ type: 'ranking', form: 'bar', commentary: 'beside', points: ['a'], exhibit: {{ categories: ['A','B','C','D','E','F','G','H'], series: [{{ name: 'x', values: [8,7,6,5,4,3,2,1] }}], highlights: [{{ category: 'A' }}] }} }},
  {{ type: 'panels', form: 'row', commentary: 'captions', exhibits: [0, 1].map((i) => ({{ type: 'chart.column', categories: ['A','B','C','D'], series: [{{ name: 'x', values: [1, 2, 3, 4] }}], caption: 'Segment ' + i + ' grew fastest where capacity was added first' }})) }},
  {{ type: 'scorecard', form: 'harvey', commentary: 'in-exhibit', exhibit: {{ columns: ['Option', {{ label: 'Fit', type: 'harvey' }}], rows: [['A', {{ type: 'harvey', value: 2 }}]] }} }},
  {{ type: 'mechanism', form: 'flow', commentary: 'below', points: ['a', 'b'], highlight: ['a', 'b'], exhibit: {{ nodes: [{{ id: 'x' }}, {{ id: 'y' }}, {{ id: 'z' }}], edges: [] }} }},
  {{ type: 'numbers', form: 'hero-number', commentary: 'beside', kpi: {{ value: '5', label: 'x' }}, points: ['a'], exhibit: {{ type: 'table', columns: ['A', 'B'], rows: [['x', '1']] }} }},
  {{ type: 'argument', form: 'memo', commentary: 'none', paragraphs: ['Prose.'], panel: {{ text: 'The conclusion the reader keeps.' }} }},
];
const chosen = Array.from({{ length: 14 }}, (_, i) => ({{ id: 'c' + i, takeaway: i % 7 === 0 ? 'Close' : false, why: 'Chosen for what this page has to show', settles: {{ kind: 'qualitative', what: 'The evidence recorded for this page' }}, title: 'Finding ' + i, ...structuredClone(kinds[i % kinds.length]) }}));
const ok = compileDeck({{ deck: {{ schema: 'professional-slides.deck/v3', id: 'd' }}, pages: chosen }});
const untyped = varietyFindings({{ slides: Array.from({{ length: 13 }}, (_, i) => ({{ id: 'u' + i, title: 't' }})) }}, {{ structureOf }}).map((f) => f.code);
const edited = structuredClone(ok.spec); edited.slides[0].layout = 'exhibit-top';
console.log(JSON.stringify({{ refused, chosen: ok.findings.map((f) => f.code), untyped,
  edited: varietyFindings(edited, {{ structureOf }}).map((f) => f.code) }}));
''')
        # Panels counts from 15 pages; fourteen trends of eight values each sit on the page floor, so the deck is thin too.
        self.assertEqual(result['refused'], ['EVIDENCE_DEPTH', 'VARIETY_COMMENTARY', 'VARIETY_SIGNATURE', 'VARIETY_TAKEAWAY',
                                             'VARIETY_TYPE_RANGE', 'VARIETY_TYPE_RUN', 'VARIETY_TYPE_SHARE'])
        self.assertEqual(result['chosen'], [])
        self.assertEqual(result['untyped'], ['PAGE_TYPE_UNDECLARED'])
        self.assertEqual(result['edited'], ['PAGE_TYPE_EDITED'])


class BeyondOneColumnTests(unittest.TestCase):
    """Pages that are not one exhibit with a text column beside it.

    A generated deck drew two pages in five as one exhibit and a column, and
    passed the variety contract, because the patterns strong decks use instead -
    labelled row blocks, exhibits joined by arrows, a so-what bar - could not be
    drawn, and the contract counted declared choices rather than drawn pages.
    """

    # Shared page parts, spliced into each probe.
    PAGES = '''
const S = { kind: 'qualitative', what: 'The operator statement of its plan' };
const base = { takeaway: false, why: 'The page type fits the claim this page makes', settles: S };
const point = (n) => 'The ' + n + ' constraint binds in the morning peak and lifting it takes a funded scheme';
const rows = (extra = {}, n = 3) => ({ ...base, id: 'rows', type: 'parallel', form: 'labelled-rows', commentary: 'in-exhibit',
  title: 'Three constraints hold the peak where it is: fleet, track and depot',
  blocks: Array.from({ length: n }, (_, i) => ({ label: 'Constraint ' + (i + 1), points: [point('first'), point('second')], metric: { value: String(90 + i) + '%', label: 'of capacity used' } })), ...extra });
const bars = (heading) => ({ type: 'chart.bar', heading, unit: 'minutes', categories: ['Leeds', 'York', 'Selby', 'Hull'], series: [{ name: 'x', values: [58, 49, 36, 24] }] });
const sequence = (extra = {}) => ({ ...base, id: 'seq', type: 'panels', form: 'sequence', commentary: 'captions',
  title: 'Faster trains win more journeys on every flow of the line',
  exhibits: ['Journey time', 'Journeys won', 'Line journeys'].map((h, i) => ({ ...bars(h), caption: 'Step ' + (i + 1) + ' of the chain holds on every one of the four flows' })), ...extra });
const ranked = (extra = {}) => ({ ...base, id: 'bar', type: 'ranking', form: 'bar', commentary: 'so-what-bar',
  title: 'Northvale gives the smallest off-peak discount of seven operators',
  exhibit: { heading: 'Off-peak discount', unit: '%', categories: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], series: [{ name: 'x', values: [46, 41, 38, 36, 35, 29, 24, 21, 18] }], highlights: [{ category: 'I' }] },
  bar: 'A deeper discount on an hourly service buys few riders, so the fare change follows the timetable', ...extra });
const error = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
'''

    def probe(self, body):
        return run_node(f"import {{ compilePage, skeletonOf }} from '{KIT}';\n"
                        f"import {{ compileDeck }} from '{AUTHOR}';\n"
                        "import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';\n"
                        "import { varietyFindings } from './skills/professional-slides/runtime/gates/variety_gates.mjs';\n"
                        + self.PAGES + body)

    def test_each_new_form_compiles_and_composes(self):
        result = self.probe('''
const charts = rows({ blocks: [0, 1].map((i) => ({ label: 'Area ' + (i + 1), points: [point('first'), point('second')], exhibit: bars('Journey time') })) });
const pages = [rows(), { ...charts, id: 'rows-charts' }, rows({ id: 'rows-bar', commentary: 'so-what-bar', bar: 'The three constraints together cap the peak until the depot is extended in 2029' }, 5),
  sequence(), sequence({ id: 'seq-two', commentary: 'so-what-bar', exhibits: sequence().exhibits.slice(0, 2).map(({ caption, ...ex }) => ex),
    bar: 'Faster trains win journeys on every flow, so electrification leads the second phase of the plan' }), ranked()];
const { spec, findings } = compileDeck({ deck: { schema: 'professional-slides.deck/v3', id: 'd' }, pages });
const { deck } = composeAll(spec, '.');
const nodes = (id) => deck.slides.find((s) => s.id === id).nodes;
const count = (id, test) => nodes(id).filter(test).length;
console.log(JSON.stringify({ findings: findings.map((f) => f.code), composed: deck.slides.map((s) => s.id),
  layouts: Object.fromEntries(spec.slides.map((s) => [s.id, s.layout ?? s.arrange])),
  labels: count('rows', (n) => n.role === 'side-panel'), labelsFive: count('rows-bar', (n) => n.role === 'side-panel'),
  metrics: count('rows', (n) => n.role === 'metric-value'), rowCharts: count('rows-charts', (n) => n.role === 'chart-mark'),
  arrows: count('seq', (n) => n.role === 'relationship-arrow'), arrowsTwo: count('seq-two', (n) => n.role === 'relationship-arrow'),
  bars: ['rows-bar', 'seq-two', 'bar'].map((id) => count(id, (n) => n.role === 'insight-surface')),
  closes: spec.slides.map((s) => s.soWhat?.style ?? null) }));
''')
        self.assertEqual(result['findings'], [])  # a short deck: the contract starts at twelve pages
        self.assertEqual(sorted(result['composed']), sorted(['rows', 'rows-charts', 'rows-bar', 'seq', 'seq-two', 'bar']))
        self.assertEqual(result['layouts']['rows'], 'labelled-rows')
        self.assertEqual(result['layouts']['seq'], 'sequence')
        self.assertEqual(result['labels'], 3)  # a filled label block per row
        self.assertEqual(result['labelsFive'], 5)
        self.assertEqual(result['metrics'], 3)  # and the row's number at its right
        self.assertGreater(result['rowCharts'], 0)
        self.assertEqual(result['arrows'], 2)  # an arrow between each step and the next
        self.assertEqual(result['arrowsTwo'], 1)
        self.assertEqual(result['bars'], [1, 1, 1])
        self.assertEqual(result['closes'], [None, None, 'bar', None, 'bar', 'bar'])

    def test_the_rows_fill_the_body(self):
        result = self.probe('''
const { spec } = compileDeck({ deck: { schema: 'professional-slides.deck/v3', id: 'd' }, pages: [rows({}, 4)] });
const { deck } = composeAll(spec, '.');
const panels = deck.slides[0].nodes.filter((n) => n.role === 'side-panel').map((n) => n.frame);
const source = deck.slides[0].nodes.find((n) => n.role === 'source-text' || n.role === 'source');
console.log(JSON.stringify({ heights: panels.map((f) => Math.round(f.height)), xs: panels.map((f) => Math.round(f.x)),
  bottom: Math.round(Math.max(...panels.map((f) => f.y + f.height))) }));
''')
        self.assertEqual(len(set(result['heights'])), 1)  # the rows share the body equally
        self.assertEqual(len(set(result['xs'])), 1)  # and the labels align down the left edge
        self.assertGreater(result['bottom'], 600)  # to the foot of the page

    def test_the_new_choices_are_checked_where_they_are_written(self):
        result = self.probe('''
const long = Array.from({ length: 60 }, () => 'word').join(' ');
console.log(JSON.stringify({
  rowsBelow: error(() => compilePage(rows({ commentary: 'below', points: ['a', 'b'] }))),
  rowsSix: error(() => compilePage(rows({}, 6))),
  longLabel: error(() => compilePage(rows({ blocks: rows().blocks.map((b, i) => (i ? b : { ...b, label: 'The whole fleet is in use every peak' })) }))),
  oneBullet: error(() => compilePage(rows({ blocks: rows().blocks.map((b, i) => (i ? b : { ...b, points: ['One'] })) }))),
  mixed: error(() => compilePage(rows({ blocks: rows().blocks.map((b, i) => (i ? b : { label: b.label, points: b.points })) }))),
  chartsThree: error(() => compilePage(rows({ blocks: rows().blocks.map(({ metric, ...b }) => ({ ...b, exhibit: bars('Journey time') })) }))),
  pageExhibit: error(() => compilePage(rows({ exhibit: bars('x') }))),
  strayBlock: error(() => compilePage(rows({ highlight: ['first constraint', 'never written'] }))),
  markedBlock: error(() => compilePage(rows({ highlight: ['first constraint'] }))),
  seqFour: error(() => compilePage(sequence({ exhibits: [...sequence().exhibits, sequence().exhibits[0]] }))),
  seqUnheaded: error(() => compilePage(sequence({ exhibits: sequence().exhibits.map((ex, i) => (i ? ex : { ...ex, heading: undefined })) }))),
  barAndTakeaway: error(() => compilePage(ranked({ takeaway: 'Close on a line as well' }))),
  noBar: error(() => compilePage(ranked({ bar: undefined }))),
  barElsewhere: error(() => compilePage(ranked({ commentary: 'on-exhibit', exhibit: { ...ranked().exhibit, annotations: [{ category: 'E', text: 'Northvale discounts least of the seven operators in the set' }] } }))),
  longBar: error(() => compilePage(ranked({ bar: long }))),
  barPoints: error(() => compilePage(ranked({ points: ['a', 'b'] }))),
  draftBar: error(() => compilePage(ranked({ bar: undefined }), 0, { draft: true })),
}));
''')
        self.assertIn('"in-exhibit", "so-what-bar"', result['rowsBelow'])
        self.assertIn('2 to 5', result['rowsSix'])
        self.assertIn('is a sentence', result['longLabel'])
        self.assertIn('two to four', result['oneBullet'])
        self.assertIn('every row one or none', result['mixed'])
        self.assertIn('2 blocks', result['chartsThree'])
        self.assertIn('in its rows', result['pageExhibit'])
        self.assertIn('never written', result['strayBlock'])  # a highlight is checked against the rows' bullets
        self.assertIsNone(result['markedBlock'])
        self.assertIn('2 to 3 steps', result['seqFour'])
        self.assertIn('heading', result['seqUnheaded'])
        self.assertIn('takeaway: false', result['barAndTakeaway'])
        self.assertIn('write it as `bar`', result['noBar'])
        self.assertIn('choose commentary "so-what-bar"', result['barElsewhere'])
        self.assertIn('two lines', result['longBar'])
        self.assertIn('second commentary', result['barPoints'])
        self.assertIsNone(result['draftBar'])  # a draft spine need not carry its copy yet

    def test_the_catalogue_and_schema_publish_the_new_forms(self):
        result = run_node(f'''
import {{ describeTypes, pageSchema }} from '{KIT}';
const schema = pageSchema();
const parallel = schema.properties.pages.items.oneOf.find((s) => s.properties.type?.const === 'parallel');
const panels = schema.properties.pages.items.oneOf.find((s) => s.properties.type?.const === 'panels');
console.log(JSON.stringify({{ types: describeTypes(), parallelForms: parallel.properties.form.enum, blocks: Boolean(parallel.properties.blocks),
  panelsForms: panels.properties.form.enum, panelsCommentary: panels.properties.commentary.enum, bar: Boolean(panels.properties.bar) }}));
''')
        for published in ('labelled-rows 2-5 blocks', 'sequence 2-3 exhibits', '`so-what-bar`', '`bar`'):
            self.assertIn(published, result['types'])
        self.assertIn('labelled-rows', result['parallelForms'])
        self.assertTrue(result['blocks'])
        self.assertIn('sequence', result['panelsForms'])
        self.assertIn('so-what-bar', result['panelsCommentary'])
        self.assertTrue(result['bar'])

    def test_the_worked_example_carries_every_new_form_and_passes(self):
        result = run_node(f'''
import fs from 'node:fs';
import {{ compileDeck }} from '{AUTHOR}';
const doc = JSON.parse(fs.readFileSync('./skills/professional-slides/examples/page-types.pages.json', 'utf8'));
const {{ spec, findings }} = compileDeck(doc);
const typed = spec.slides.filter((s) => s.pageType);
console.log(JSON.stringify({{ findings: findings.map((f) => f.code), forms: typed.map((s) => s.pageType.form), commentary: typed.map((s) => s.pageType.commentary) }}));
''')
        self.assertEqual(result['findings'], [])
        self.assertIn('labelled-rows', result['forms'])
        self.assertIn('sequence', result['forms'])
        self.assertIn('so-what-bar', result['commentary'])


class DrawnVarietyTests(unittest.TestCase):
    """The variety contract counts pages as a reader sees them."""

    def test_skeletons_placements_and_closes_are_counted_as_drawn(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
import {{ varietyFindings, VARIETY }} from './skills/professional-slides/runtime/gates/variety_gates.mjs';
const S = {{ kind: 'qualitative', what: 'The operator statement of its plan' }};
const base = {{ takeaway: false, why: 'The page type fits the claim this page makes', settles: S }};
const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const pts = ['Traffic fell to a fifth', 'It recovered by 2022'];
const trend = compilePage({{ ...base, id: 't', type: 'trend', form: 'line', commentary: 'beside', points: pts, highlight: ['a fifth', 'by 2022'], title: 'Traffic recovered',
  exhibit: {{ categories: years, series: [{{ name: 'x', values: [5, 1, 2, 4, 5, 6, 6, 7] }}], highlights: [{{ category: '2020' }}] }} }});
const stats = compilePage({{ ...base, id: 's', type: 'numbers', form: 'stat-list', commentary: 'beside', points: pts, highlight: ['a fifth', 'by 2022'], title: 'Three numbers',
  exhibit: {{ items: [{{ value: '5m', label: 'a' }}, {{ value: '1m', label: 'b' }}, {{ value: '4m', label: 'c' }}] }} }});
const steps = compilePage({{ ...base, id: 'm', type: 'mechanism', form: 'steps', commentary: 'beside-left', points: pts, highlight: ['a fifth', 'by 2022'], title: 'Three steps',
  exhibit: {{ items: ['Grounded', 'Restarted', 'Recovered'] }} }});
const full = compilePage({{ ...base, id: 'f', type: 'trend', form: 'line', commentary: 'on-exhibit', title: 'Traffic recovered',
  exhibit: {{ categories: years, series: [{{ name: 'x', values: [5, 1, 2, 4, 5, 6, 6, 7] }}], annotations: [{{ category: '2020', text: 'Traffic fell to a fifth when the network was grounded' }}] }} }});
// Synthetic decks of fourteen pages, each spreading its types so only the rule under test fires.
const TYPES = ['trend', 'ranking', 'composition', 'relationship', 'bridge', 'mechanism', 'scorecard', 'lookup', 'panels', 'schedule', 'numbers', 'parallel', 'place', 'options'];
const page = (i, choice) => ({{ id: 'p' + i, title: 'Page ' + i, pageType: {{ type: TYPES[i], commentary: ['none', 'in-exhibit', 'captions', 'on-exhibit'][i % 4], takeaway: false, skeleton: 'skeleton ' + i, ...choice }} }});
const deck = (choices) => ({{ slides: Array.from({{ length: 14 }}, (_, i) => page(i, choices(i))) }});
const codes = (spec) => varietyFindings(spec).map((f) => f.code);
const mirrored = deck((i) => (i < 5 ? {{ commentary: i % 2 ? 'beside-left' : 'beside' }} : {{}}));
const drawn = deck((i) => (i < 2 ? {{ skeleton: 'exhibit-full · 1 chart · open' }} : {{}}));
const repeated = deck((i) => (i < 4 ? {{ skeleton: 'exhibit-full · 1 chart · open' }} : {{}}));
const bars = deck((i) => (i < 4 ? {{ commentary: 'so-what-bar' }} : {{}}));
console.log(JSON.stringify({{ trend: trend.pageType.skeleton, stats: stats.pageType.skeleton, steps: steps.pageType.skeleton, full: full.pageType.skeleton,
  mirrored: varietyFindings(mirrored).find((f) => f.code === 'VARIETY_COMMENTARY')?.measured ?? null,
  drawn: codes(drawn), repeated: varietyFindings(repeated).find((f) => f.code === 'VARIETY_SIGNATURE') ?? null, bars: codes(bars),
  caps: {{ commentary: VARIETY.commentaryShareMax, signature: VARIETY.signatureShareMax }} }}));
''')
        # A trend beside its points, a stat list beside its points and a mirrored
        # staircase with its points on the left are one drawn page.
        self.assertEqual(result['trend'], result['stats'])
        self.assertEqual(result['trend'], result['steps'])
        self.assertNotEqual(result['trend'], result['full'])
        # Five column pages, three on the right and two on the left: one placement at 36%.
        self.assertEqual(result['mirrored']['commentary'], 'beside')
        self.assertEqual(result['mirrored']['pages'], 5)
        self.assertEqual(result['drawn'], [])  # two of fourteen drawn alike is a deck, not a template
        self.assertEqual(result['repeated']['measured']['pages'], 4)
        self.assertEqual(result['repeated']['slide'], ['p0', 'p1', 'p2', 'p3'])  # the pages are named
        self.assertIn('labelled-rows', result['repeated']['repair'])  # and the alternatives offered
        self.assertIn('VARIETY_TAKEAWAY', result['bars'])  # a so-what bar is a close
        self.assertLessEqual(result['caps']['commentary'], 0.3)
        self.assertLessEqual(result['caps']['signature'], 0.2)


class SourceChecksTests(unittest.TestCase):
    """What the forward test found only at build time is now refused where it is written."""

    def test_words_data_and_keys_are_checked_at_compile(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
import {{ compileDeck }} from '{AUTHOR}';
const years = ['2019','2020','2021','2022','2023','2024','2025','2026'];
const trend = (annotations) => ({{ id: 't', type: 'trend', form: 'line', commentary: 'on-exhibit', takeaway: false, why: 'The break is the claim here', settles: {{ kind: 'qualitative', what: 'The evidence recorded for this page' }},
  title: 'Traffic fell and recovered', exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 2, 4, 5, 6, 6, 7] }}], annotations }} }});
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
const pair = {{ type: 'chart.column', categories: ['H1 25', 'H1 26'], series: [{{ name: 'x', values: [46, 31] }}], caption: 'Guests fell by a third in the first half' }};
console.log(JSON.stringify({{
  labels: error(() => compilePage(trend([{{ category: '2020', text: 'Low' }}]))),
  sentence: error(() => compilePage(trend([{{ category: '2020', text: 'Traffic fell to a fifth when the network was grounded' }}]))),
  panelPair: error(() => compilePage({{ id: 'p', type: 'panels', form: 'row', commentary: 'captions', takeaway: false, why: 'Two cuts of the shock side by side', settles: {{ kind: 'qualitative', what: 'The evidence recorded for this page' }},
    title: 'The shock', exhibits: [pair, {{ ...pair, caption: 'April traffic was a tenth of the June level' }}] }})),
  pieData: error(() => compilePage({{ id: 'c', type: 'composition', form: 'donut', commentary: 'beside', points: ['a'], takeaway: false, why: 'The mix is the claim here', settles: {{ kind: 'qualitative', what: 'The evidence recorded for this page' }},
    title: 'Mix', exhibit: {{ categories: ['A', 'B'], series: [{{ name: 'x', values: [60, 40] }}] }} }})),
  sliver: error(() => compilePage({{ id: 'c', type: 'composition', form: 'pie', commentary: 'beside', points: ['a'], takeaway: false, why: 'The mix is the claim here', settles: {{ kind: 'qualitative', what: 'The evidence recorded for this page' }},
    title: 'Mix', exhibit: {{ labels: ['A', 'B', 'C'], values: [80, 17, 3] }} }})),
  unknownKey: error(() => compileDeck({{ deck: {{ id: 'd' }}, pages: [{{ ...trend([{{ category: '2020', text: 'Traffic fell to a fifth when the network was grounded' }}]), highlightRow: 2 }}] }})),
}}));
''')
        self.assertIn('writing it there', result['labels'])
        self.assertIsNone(result['sentence'])
        self.assertIn('two numbers', result['panelPair'])
        self.assertIn('`labels`', result['pieData'])
        self.assertIn('under 5%', result['sliver'])
        self.assertIn('highlightRow', result['unknownKey'])

    def test_callouts_are_measured_and_the_content_plan_is_derived(self):
        result = run_node(f'''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {{ compilePage }} from '{KIT}';
import {{ authorDeck }} from '{AUTHOR}';
import {{ deriveContent }} from './skills/professional-slides/runtime/derive-content.mjs';
import {{ runContentGates }} from './skills/professional-slides/runtime/gates/content_gates.mjs';
const years = ['2019','2020','2021','2022','2023','2024','2025','2026'];
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
const S = {{ kind: 'rate', what: 'The operator annual reports, five years' }};
const long = 'Traffic fell to a fifth when the network was grounded and recovered only as aircraft returned from storage in stages';
const trend = {{ id: 't', type: 'trend', form: 'line', commentary: 'on-exhibit', takeaway: false, why: 'The break is the claim here', settles: S,
  title: 'Traffic fell and recovered', exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 2, 4, 5, 6, 6, 7] }}], annotations: [{{ category: '2020', text: long }}] }} }};
const strip = {{ id: 'm', type: 'numbers', form: 'metric-strip', commentary: 'below', points: ['a'], takeaway: false, why: 'Three numbers carry this claim', settles: S,
  title: 'Three numbers', metrics: [{{ value: '1', label: 'a' }}], exhibit: {{ type: 'table', columns: ['A', 'B'], rows: [['x', '1']] }} }};
// A short argument page: its content plan is derived from the composed page and held to the text-page floor.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'author-'));
const memo = {{ id: 'm1', type: 'argument', form: 'memo', commentary: 'none', takeaway: false, why: 'A short argument page for the test',
  settles: {{ kind: 'qualitative', what: 'The operator statement of its plan' }}, adds: null, title: 'The plan rests on three commitments made this year', paragraphs: ['One short sentence.'], panel: {{ text: 'All three commitments are funded this year.' }} }};
const out = await authorDeck({{ deck: {{ schema: 'professional-slides.deck/v3', id: 'd' }}, pages: [memo] }}, {{ baseDir: dir }});
const content = deriveContent(out.spec, out.deck);
const page = content.pages.find((p) => p.id === 'm1');
const gates = runContentGates(content, {{ required: true }});
console.log(JSON.stringify({{ long: error(() => compilePage(trend)), strip: error(() => compilePage(strip)),
  task: page.textReference.task, claim: page.claim, planned: page.textPlan.some((b) => b.text === 'One short sentence.'),
  low: gates.findings.some((f) => f.code === 'TEXT_COVERAGE_LOW' && f.id === 'm1') }}));
''')
        self.assertIn('callout box', result['long'])
        self.assertIn('metric strip', result['strip'])
        self.assertEqual(result['task'], 'text-page')
        self.assertEqual(result['claim'], 'The plan rests on three commitments made this year')  # the claim is the title
        self.assertTrue(result['planned'])  # the text plan is the page as composed
        self.assertTrue(result['low'])  # and a short page is held to its reading task's floor

    def test_evidence_shapes_draft_and_every_error_at_once(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
import {{ composeAll }} from './skills/professional-slides/runtime/compose-all.mjs';
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
const insights = new Map([['i1', {{ id: 'i1', shape: 'fact', finding: 'Two airlines carried 53m and 42m.' }}], ['i2', {{ id: 'i2', shape: 'peer-set', finding: 'Ten airlines ranked by orders.' }}]]);
const ranking = (evidence) => ({{ id: 'r', type: 'ranking', form: 'bar', commentary: 'beside', takeaway: false, why: 'Where every member stands is the claim', evidence,
  title: 'The book leads the set', points: ['A point.'], exhibit: {{ categories: ['A','B','C','D','E','F','G','H'], series: [{{ name: 'x', values: [8,7,6,5,4,3,2,1] }}], highlights: [{{ category: 'A' }}] }} }});
const derived = compilePage(ranking(['i2']), 0, {{ insights }});
const onExhibit = {{ id: 'o', type: 'trend', form: 'line', commentary: 'on-exhibit', takeaway: false, why: 'The break is the claim here', settles: {{ kind: 'rate', what: 'Five years of reports' }},
  title: 'Traffic fell and recovered', exhibit: {{ categories: ['2019','2020','2021','2022','2023','2024','2025','2026'], series: [{{ name: 'x', values: [5,1,2,4,5,6,6,7] }}], highlights: [{{ category: '2020' }}] }} }};
let all = null;
try {{ composeAll({{ schema: 'professional-slides.deck/v3', id: 'x', slides: [
  {{ id: 'a', title: 'One bad chart page here', exhibit: {{ type: 'chart.bar', categories: ['A', 'B'], series: [{{ name: 'x', values: [1] }}] }} }},
  {{ id: 'b', title: 'Another page that is fine now', points: ['ok'] }},
  {{ id: 'c', title: 'A second bad chart page', exhibit: {{ type: 'chart.nope' }} }}] }}, '.'); }} catch (e) {{ all = e.pageErrors; }}
console.log(JSON.stringify({{ twoNumbers: error(() => compilePage(ranking(['i1']), 0, {{ insights }})), missing: error(() => compilePage(ranking([]), 0, {{ insights }})),
  settles: derived.pageType.content.settles, draft: error(() => compilePage(onExhibit, 0, {{ draft: true }})), full: error(() => compilePage(onExhibit)), all }}));
''')
        self.assertIn('peer-set', result['twoNumbers'])  # a ranking needs the whole set; two numbers are a research task
        self.assertIn('evidence', result['missing'])
        self.assertEqual(result['settles']['kind'], 'rank')  # settles derived from the insight's shape
        self.assertIsNone(result['draft'])  # a draft spine need not carry its callouts yet
        self.assertIn('annotations', result['full'])
        self.assertEqual(len(result['all']), 2)  # both broken pages, in one run
        self.assertTrue(any(e.startswith('c:') for e in result['all']))

    def test_the_thin_page_floor_is_the_reading_task_floor(self):
        import sys
        sys.path.insert(0, str(RUNTIME / 'gates'))
        import page_gates
        words = lambda n: {'nodes': [{'type': 'text', 'role': 'paragraph', 'text': ' '.join(['word'] * n),
                                      'frame': {'x': 80, 'y': 200, 'width': 800, 'height': 200}}], 'componentInstances': []}
        chart_led, table_commentary = [], []
        page_gates.gate_thin_page(1, {**words(60), 'readingTask': 'chart-led'}, chart_led)
        page_gates.gate_thin_page(1, {**words(60), 'readingTask': 'table-with-commentary'}, table_commentary)
        self.assertEqual(chart_led, [])  # 60 words is a full chart page carrying its own callouts
        self.assertEqual(table_commentary[0]['code'], 'THIN_PAGE')

    def test_a_regional_map_on_the_coarse_coastline_is_advised(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
const markers = [{{ label: 'Leeds', longitude: -1.55, latitude: 53.8 }}, {{ label: 'York', longitude: -1.08, latitude: 53.96 }}, {{ label: 'Hull', longitude: -0.34, latitude: 53.74 }}];
const page = compilePage({{ id: 'm', type: 'place', form: 'map', commentary: 'beside', points: ['A point.'], takeaway: false, why: 'Where the network runs is the claim',
  settles: {{ kind: 'structure', what: 'The operator route map' }}, title: 'The network is three cities', exhibit: {{ geography: 'europe', crop: 'fit', markers }} }});
console.log(JSON.stringify({{ advisories: page.pageType.advisories ?? [] }}));
''')
        self.assertTrue(any(a.startswith('MAP_COARSE') for a in result['advisories']))

    def test_a_broken_page_does_not_hide_the_others(self):
        result = run_node(f'''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {{ authorDeck }} from '{AUTHOR}';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'author-'));
const S = {{ kind: 'qualitative', what: 'The operator statement of its plan' }};
const broken = {{ id: 'b', type: 'lookup', form: 'table', commentary: 'none', takeaway: false, why: 'The measures are looked up here', settles: S,
  title: 'The measures sit in one table', exhibit: {{ columns: ['A', 'B'], rows: [['x']] }} }};
const memo = {{ id: 'm', type: 'argument', form: 'memo', commentary: 'none', takeaway: false, why: 'A short argument page for the test', settles: S,
  title: 'The plan rests on three commitments made this year', paragraphs: ['One short sentence.'], panel: {{ text: 'All three commitments are funded this year.' }} }};
const out = await authorDeck({{ deck: {{ schema: 'professional-slides.deck/v3', id: 'd' }}, pages: [broken, memo] }}, {{ baseDir: dir }});
console.log(JSON.stringify({{ failed: [...out.failedIds], composed: out.deck.slides.map((s) => s.id), codes: out.findings.map((f) => f.code) }}));
''')
        self.assertEqual(result['failed'], ['b'])
        self.assertIn('m', result['composed'])  # the rest of the deck is still composed and checked
        self.assertIn('PAGE_DOES_NOT_COMPOSE', result['codes'])


class PublishedLimitsTests(unittest.TestCase):
    def test_limits_minimums_counts_highlights_and_the_answer_message(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
import {{ runContentGates }} from './skills/professional-slides/runtime/gates/content_gates.mjs';
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
const base = {{ takeaway: false, why: 'The page type fits the claim here', settles: {{ kind: 'share', what: 'The annual report split' }} }};
const pie = (labels, values) => compilePage({{ ...base, id: 'c', type: 'composition', form: 'pie', commentary: 'beside', points: ['A point.'], title: 'Mix',
  exhibit: {{ labels, values }} }});
const road = (n) => compilePage({{ ...base, id: 'r', type: 'schedule', form: 'roadmap', commentary: 'none', title: 'Plan',
  exhibit: {{ items: Array.from({{ length: n }}, (_, i) => ({{ label: 'Phase ' + i, date: '202' + i }})) }} }});
const points = ['Cargo carried 2.4m tonnes, up 3%', 'Thirteen freighters flew in March', 'The margin is not disclosed'];
const bars = {{ ...base, id: 'b', type: 'ranking', form: 'bar', commentary: 'beside', points, title: 'Ranked',
  exhibit: {{ categories: ['A','B','C','D','E','F','G','H'], series: [{{ name: 'x', values: [8,7,6,5,4,3,2,1] }}], highlights: [{{ category: 'A' }}] }} }};
const content = {{ question: 'Is Emirates the strongest Gulf airline system?', answer: 'Emirates is the strongest Gulf airline system today',
  pages: [{{ id: 'p02', n: 2, claim: 'Revenue grew while costs held', settles: {{ kind: 'rate', what: 'x' }}, adds: null }}] }};
const answer = runContentGates(content).findings.find((f) => f.code === 'CONTENT_ANSWER_UNCARRIED');
console.log(JSON.stringify({{ six: error(() => pie(['a','b','c','d','e','f'], [1,1,1,1,1,1])), two: error(() => pie(['cargo','other'], [12, 88])),
  small: error(() => pie(['Asia','Europe','Middle East'], [7, 4, 3])), three: error(() => road(3)), four: error(() => road(4)),
  one: error(() => compilePage({{ ...bars, highlight: '2.4m tonnes' }})), each: error(() => compilePage({{ ...bars, highlight: ['2.4m tonnes', 'Thirteen freighters'] }})),
  answer: answer?.repair ?? '' }}));
''')
        self.assertIn('2 to 5 labels', result['six'])
        self.assertIn('numbers page', result['two'])
        self.assertIn('small count', result['small'])
        self.assertIn('four or more dated items', result['three'])
        self.assertIsNone(result['four'])
        self.assertIn('mark the finding in each point', result['one'])
        self.assertIsNone(result['each'])
        self.assertIn('p02', result['answer'])  # names where to say it and the closest title


class RerunGapsTests(unittest.TestCase):
    """What the last authored deck found: each limit it met only by failing."""

    def test_waffle_hero_values_callouts_rail_and_stray_highlights(self):
        result = run_node(f'''
import {{ compilePage, describeTypes, railCapacity }} from '{KIT}';
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
const base = {{ takeaway: false, why: 'The page type fits the claim here', settles: {{ kind: 'count', what: 'The route page count' }} }};
const waffle = (series) => compilePage({{ ...base, id: 'w', type: 'composition', form: 'waffle', commentary: 'beside', title: 'Outstations by region',
  exhibit: {{ categories: ['Asia', 'Europe', 'Middle East', 'Africa'], series }} }}, 0, {{ draft: true }});
const facts = (value) => compilePage({{ ...base, id: 'f', type: 'numbers', form: 'fact-grid', commentary: 'none', title: 'Cash',
  exhibit: {{ items: [value, '32.0bn', '56.2bn'].map((v) => ({{ value: v, label: 'AED' }})) }} }});
const years = ['2019','2020','2021','2022','2023','2024','2025','2026'];
const callouts = (n) => compilePage({{ ...base, id: 't', type: 'trend', form: 'line', commentary: 'on-exhibit', title: 'Traffic',
  exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 3, 5, 6, 6, 7, 7] }}], annotations: Array.from({{ length: n }}, (_, i) => ({{ category: years[i], text: 'The network was grounded and traffic fell to a fifth' }})) }} }});
const rail = (text) => compilePage({{ ...base, id: 'r', type: 'trend', form: 'line', commentary: 'rail', rail: text, title: 'Traffic',
  exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 3, 5, 6, 6, 7, 7] }}], highlights: [{{ category: '2020' }}] }} }});
const stray = (draft) => error(() => compilePage({{ ...base, id: 's', type: 'trend', form: 'line', commentary: 'beside', title: 'Traffic',
  points: ['Traffic fell to a fifth', 'It recovered by 2022'], highlight: ['a fifth', 'never written'],
  exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 3, 5, 6, 6, 7, 7] }}], highlights: [{{ category: '2020' }}] }} }}, 0, {{ draft }}));
console.log(JSON.stringify({{
  waffle: error(() => waffle([{{ name: 'Outstations', values: [7, 4, 2, 1] }}])),
  waffleTwo: error(() => waffle([{{ name: 'a', values: [7, 4, 2, 1] }}, {{ name: 'b', values: [1, 1, 1, 1] }}])),
  hero: error(() => compilePage({{ ...base, id: 'h', type: 'numbers', form: 'hero-number', commentary: 'beside', title: 'Target', kpi: {{ value: '2.3x', label: 'target' }}, points: ['a', 'b'] }}, 0, {{ draft: true }})),
  longValue: error(() => facts('AED54.9 billion')), shortValue: error(() => facts('54.9bn')),
  threeCallouts: error(() => callouts(3)), fourCallouts: error(() => callouts(4)),
  longRail: error(() => rail(Array.from({{ length: 80 }}, () => 'word').join(' '))),
  shortRail: error(() => rail('Traffic fell to a fifth in 2020 and was back by 2022')),
  strayDraft: stray(true), strayFull: stray(false),
  capacity: railCapacity(), catalogue: describeTypes(),
}}));
''')
        self.assertIsNone(result['waffle'])  # one series of whole counts: the small-count page the pie refuses
        self.assertIn('one series', result['waffleTwo'])
        self.assertIn('1 exhibit', result['hero'])  # named at compile, not a TypeError at composition
        self.assertIn('10 characters', result['longValue'])
        self.assertIsNone(result['shortValue'])
        self.assertIsNone(result['threeCallouts'])
        self.assertIn('3 callouts at most', result['fourCallouts'])
        self.assertIn('eight lines', result['longRail'])
        self.assertIsNone(result['shortRail'])
        self.assertIn('never written', result['strayDraft'])  # a draft with its points written checks them
        self.assertIn('never written', result['strayFull'])
        self.assertGreater(result['capacity'], 20)
        for published in ('3 callouts', 'rail about', 'values 10 characters'):
            self.assertIn(published, result['catalogue'])

    def test_one_compile_error_leaves_the_rest_gated_and_budgeted(self):
        result = run_node(f'''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {{ authorDeck }} from '{AUTHOR}';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'author-'));
const S = {{ kind: 'qualitative', what: 'The operator statement of its plan' }};
const bad = {{ id: 'bad', type: 'trend', form: 'line', commentary: 'none', takeaway: false, why: 'The page type fits the claim here', settles: S, title: 'Two years',
  exhibit: {{ categories: ['2019', '2020'], series: [{{ name: 'x', values: [1, 2] }}] }} }};
const memo = {{ id: 'm', type: 'argument', form: 'memo', commentary: 'none', takeaway: false, why: 'A short argument page for the test', settles: S,
  title: 'The plan rests on three commitments made this year', paragraphs: ['One short sentence.'], panel: {{ text: 'All three commitments are funded this year.' }} }};
const out = await authorDeck({{ deck: {{ schema: 'professional-slides.deck/v3', id: 'd' }}, pages: [bad, memo] }}, {{ baseDir: dir }});
console.log(JSON.stringify({{ codes: out.findings.map((f) => f.code + ':' + (f.id ?? '')), composed: out.deck.slides.map((s) => s.id),
  floor: out.deck.slides.find((s) => s.id === 'm')?.wordFloor ?? null, ceiling: out.deck.slides.find((s) => s.id === 'm')?.wordCeiling ?? null }}));
''')
        self.assertIn('COMPILE:bad', result['codes'])
        self.assertIn('m', result['composed'])  # the page that compiled was composed and gated in the same run
        self.assertEqual(result['floor'], 121)  # text-page q1 (120.5), the one floor every check reads
        self.assertGreater(result['ceiling'], result['floor'])

    def test_every_budget_ceiling_sits_above_its_floor(self):
        result = run_node('''
import { READING_TASK_BANK } from './skills/professional-slides/runtime/text-contract.mjs';
import { wordBudgetOf } from './skills/professional-slides/runtime/derive-content.mjs';
console.log(JSON.stringify(Object.fromEntries(Object.keys(READING_TASK_BANK).map((task) => [task, wordBudgetOf(task)]))));
''')
        for task, budget in result.items():
            self.assertGreater(budget['ceiling'], budget['floor'], task)


class EvidenceDepthTests(unittest.TestCase):
    """A generated fifty-page deck's chart pages plotted a median of five values
    against about twenty-two on strong decks' pages. What a page plots is now
    counted, floored at compile, held to a deck median, and required of the
    insight log's data before any page rests on it."""

    def test_the_counter_counts_what_each_exhibit_draws(self):
        result = run_node(f'''
import {{ plottedValues }} from '{KIT}';
const years = ['2019','2020','2021','2022'];
console.log(JSON.stringify({{
  line: plottedValues({{ type: 'chart.line', categories: years, series: [{{ name: 'a', values: [1, 2, 3, 4] }}, {{ name: 'b', values: [1, null, 3, 4] }}] }}),
  scatter: plottedValues({{ type: 'chart.scatter', points: [{{ x: 1, y: 2 }}, {{ x: 2, y: 3 }}, {{ x: 3, y: 1 }}] }}),
  waffle: plottedValues({{ type: 'chart.waffle', categories: ['a', 'b', 'c'], series: [{{ name: 'n', values: [40, 30, 30] }}] }}),
  pie: plottedValues({{ type: 'chart.pie', labels: ['a', 'b', 'c'], values: [5, 3, 2] }}),
  grid: plottedValues({{ type: 'chart.bubble-grid', rows: ['a', 'b'], columns: ['x', 'y', 'z'], values: [[1, 2, 3], [4, 5, 6]] }}),
  boxes: plottedValues({{ type: 'chart.boxplot', categories: ['a', 'b'], boxes: [{{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }}, {{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }}] }}),
  table: plottedValues({{ type: 'table', columns: ['Line', 'FY25', 'FY26', 'Note'], rows: [['FY24 line', '12', '14', 'up'], ['Coast', {{ value: 9 }}, '11%', 'flat']] }}),
  group: plottedValues({{ type: 'chart-group', charts: [0, 1].map(() => ({{ component: 'chart.bar', props: {{ categories: ['a', 'b', 'c'], series: [{{ name: 'x', values: [3, 2, 1] }}] }} }})) }}),
  panels: plottedValues([{{ type: 'chart.column', categories: years, series: [{{ name: 'x', values: [1, 2, 3, 4] }}] }}, {{ type: 'chart.pie', labels: ['a', 'b'], values: [1, 2] }}]),
}}));
''')
        self.assertEqual(result['line'], 7)  # a missing value is not plotted
        self.assertEqual(result['scatter'], 3)
        self.assertEqual(result['waffle'], 3)  # a waffle counts its parts, not its squares
        self.assertEqual(result['pie'], 3)
        self.assertEqual(result['grid'], 6)
        self.assertEqual(result['boxes'], 10)  # five figures a box
        self.assertEqual(result['table'], 4)  # numeric cells, not the row label
        self.assertEqual(result['group'], 6)
        self.assertEqual(result['panels'], 6)

    def test_a_thin_chart_page_is_refused_with_the_way_to_deepen_it(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
const base = {{ takeaway: false, why: 'The page type fits the claim here', settles: {{ kind: 'rate', what: 'The operator annual reports' }}, title: 'Traffic', commentary: 'beside', points: ['A point.'] }};
const years = ['2019','2020','2021','2022'];
const trend = (series) => compilePage({{ ...base, id: 't', type: 'trend', form: 'line', exhibit: {{ categories: years, series, highlights: [{{ category: '2020' }}] }} }}, 0, {{ draft: true }});
const bridge = (n) => compilePage({{ ...base, id: 'b', type: 'bridge', form: 'waterfall', exhibit: {{ categories: Array.from({{ length: n }}, (_, i) => 'Step ' + i), values: Array.from({{ length: n }}, (_, i) => i ? 1 : 10), totals: [0, n - 1] }} }}, 0, {{ draft: true }});
const panel = (n) => ({{ type: 'chart.column', categories: years.slice(0, n), series: [{{ name: 'x', values: [1, 2, 3, 4].slice(0, n) }}], caption: 'Each panel says what it adds to the other one here' }});
const ok = trend([{{ name: 'a', values: [5, 1, 3, 5] }}, {{ name: 'b', values: [4, 2, 3, 4] }}]);
console.log(JSON.stringify({{
  thin: error(() => trend([{{ name: 'a', values: [5, 1, 3, 5] }}])), deep: ok.pageType,
  bridgeFour: error(() => bridge(4)), bridgeFive: error(() => bridge(5)),
  donut: error(() => compilePage({{ ...base, id: 'd', type: 'composition', form: 'donut', exhibit: {{ labels: ['a', 'b', 'c', 'd'], values: [40, 30, 20, 10] }} }}, 0, {{ draft: true }})),
  panels: error(() => compilePage({{ ...base, id: 'p', type: 'panels', form: 'row', commentary: 'captions', points: undefined, exhibits: [panel(3), panel(3)] }}, 0, {{ draft: true }})),
  ranking: error(() => compilePage({{ ...base, id: 'r', type: 'ranking', form: 'bar', exhibit: {{ categories: ['A','B','C','D','E'], series: [{{ name: 'x', values: [5, 4, 3, 2, 1] }}], highlights: [{{ category: 'A' }}] }} }}, 0, {{ draft: true }})),
}}));
''')
        self.assertIn('plots 4 values', result['thin'])
        self.assertIn('indexed', result['thin'])  # the message names the way to deepen a trend
        self.assertEqual(result['deep']['values'], 8)  # a second series doubles a four-period trend
        self.assertTrue(result['deep']['chart'])
        self.assertIn('plots 4 values', result['bridgeFour'])  # start, two steps and end restate a difference
        self.assertIsNone(result['bridgeFive'])  # a bridge's steps are the drivers it has: five bars is a bridge
        self.assertIsNone(result['donut'])  # one whole's parts are not floored
        self.assertIn('plots 6 values', result['panels'])
        self.assertIn('distribution', result['ranking'])

    def test_the_deck_median_is_gated_and_reported(self):
        result = run_node('''
import { varietyFindings, evidenceDepth } from './skills/professional-slides/runtime/gates/variety_gates.mjs';
const types = ['trend', 'ranking', 'composition', 'relationship', 'bridge', 'panels', 'scorecard', 'mechanism'];
const deck = (values, charts) => ({ slides: Array.from({ length: 16 }, (_, i) => ({ id: 'p' + i, title: 'Finding ' + i,
  pageType: { type: types[i % 8], commentary: ['beside', 'below', 'none', 'rail'][i % 4], takeaway: false, ...(i < charts ? { chart: true, values: values[i % values.length] } : { values: 30 }) } })) });
const codes = (spec) => varietyFindings(spec).map((f) => f.code);
console.log(JSON.stringify({ thin: codes(deck([9, 10, 12], 12)), deep: codes(deck([12, 18, 30], 12)), depth: evidenceDepth(deck([9, 10, 12], 12).slides),
  few: codes(deck([9], 7)) }));
''')
        self.assertIn('EVIDENCE_DEPTH', result['thin'])
        self.assertNotIn('EVIDENCE_DEPTH', result['deep'])
        self.assertEqual(result['depth']['chartPages'], 12)
        self.assertEqual(result['depth']['median'], 10)
        self.assertEqual(len(result['depth']['thinnest']), 5)
        self.assertNotIn('EVIDENCE_DEPTH', result['few'])  # under eight chart pages a median says little

    def test_an_insight_records_breadth_its_shape_needs(self):
        result = run_node(f'''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {{ breadthProblem, breadthOf }} from '{KIT}';
import {{ readInsights }} from '{AUTHOR}';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insights-'));
const log = (insights) => {{ fs.writeFileSync(path.join(dir, 'd.insights.json'), JSON.stringify({{ insights }})); return readInsights(dir, 'd').then(() => null, (e) => e.message); }};
const series = (breadth) => ({{ id: 's', shape: 'series', breadth }});
console.log(JSON.stringify({{
  short: breadthProblem(series({{ periods: 4, series: 1 }})), peers: breadthProblem(series({{ periods: 4, series: 3 }})), long: breadthProblem(series({{ periods: 8 }})),
  fewPeers: breadthProblem({{ id: 'r', shape: 'peer-set', breadth: {{ members: 4 }} }}),
  fromData: breadthOf({{ shape: 'series', data: {{ categories: ['2019', '2020', '2021', '2022'], series: [{{ name: 'a' }}, {{ name: 'b' }}] }} }}),
  bridgeData: breadthProblem({{ id: 'b', shape: 'bridge', data: {{ categories: ['Start', 'Price', 'End'] }} }}),
  unrecorded: breadthProblem({{ id: 'u', shape: 'peer-set' }}), fact: breadthProblem({{ id: 'f', shape: 'fact' }}),
  logged: await log([{{ id: 'a', shape: 'peer-set', breadth: {{ members: 3 }} }}, {{ id: 'b', shape: 'series' }}, {{ id: 'c', shape: 'fact' }}]),
  clean: await log([{{ id: 'a', shape: 'peer-set', breadth: {{ members: 12 }} }}, {{ id: 'c', shape: 'qualitative' }}]),
}}));
''')
        self.assertIn('research task', result['short'])
        self.assertIsNone(result['peers'])  # four periods for the subject and its peers is a series
        self.assertIsNone(result['long'])
        self.assertIn('4 members', result['fewPeers'])
        self.assertEqual(result['fromData'], {'periods': 4, 'series': 2})
        self.assertIn('1 steps', result['bridgeData'])
        self.assertIn('record how wide', result['unrecorded'])  # an old log is told what to add
        self.assertIsNone(result['fact'])
        self.assertIn('2 insights', result['logged'])  # every narrow insight named at once
        self.assertIsNone(result['clean'])

    def test_the_many_value_forms_compile_and_compose(self):
        result = run_node(f'''
import {{ compilePage, describeTypes, pageSchema }} from '{KIT}';
import {{ composeAll }} from './skills/professional-slides/runtime/compose-all.mjs';
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
const base = {{ takeaway: false, why: 'The page type fits the claim here', settles: {{ kind: 'rank', what: 'The operator annual reports' }} }};
const years = ['FY19','FY20','FY21','FY22','FY23','FY24'];
const peers = ['Subject', 'Peer A', 'Peer B', 'Peer C'];
const indexed = {{ ...base, id: 'i', type: 'trend', form: 'indexed', commentary: 'none', title: 'The subject recovered more slowly than every peer since FY19',
  exhibit: {{ heading: 'Journeys by operator', categories: years, indexBase: 'FY19', subject: 'Subject',
    series: peers.map((name, k) => ({{ name, values: years.map((_, t) => 50 * (k + 1) * (1 + t * (0.02 + k * 0.01))) }})) }} }};
indexed.commentary = 'rail'; indexed.rail = 'The peers that added off-peak frequency recovered first; the subject kept its hourly timetable.';
const members = Array.from({{ length: 20 }}, (_, i) => 'Operator ' + String.fromCharCode(65 + i));
const distribution = {{ ...base, id: 'd', type: 'ranking', form: 'distribution', commentary: 'rail', rail: 'The subject sits ninth of twenty on unit cost, just under the median of the field.',
  title: 'The subject is ninth of twenty on cost per train-km', exhibit: {{ heading: 'Cost per train-km', categories: members,
    series: [{{ name: 'Cost', values: members.map((_, i) => 14 + i * 0.5) }}], highlights: [{{ category: 'Operator I' }}] }} }};
const aligned = {{ ...base, id: 'a', type: 'ranking', form: 'aligned-bars', commentary: 'below', points: ['The subject is mid-table on intensity.', 'Its off-peak runs hourly.'],
  highlight: ['mid-table', 'hourly'], title: 'The subject is mid-table on intensity because its off-peak runs hourly',
  exhibit: {{ categories: members.slice(0, 8), highlights: [{{ category: 'Operator D' }}], series: [
    {{ name: 'Journeys per km', unit: 'thousand', values: [142, 131, 118, 104, 97, 88, 71, 60] }},
    {{ name: 'Off-peak frequency', unit: 'trains an hour', values: [2.6, 2.4, 2.1, 1.4, 1.8, 1.2, 1.0, 1.1], valueFormat: {{ decimals: 1 }} }},
    {{ name: 'Peak load', unit: '%', values: [94, 92, 90, 95, 86, 81, 78, 75] }}] }} }};
const pages = [indexed, distribution, aligned].map((p, i) => compilePage(p, i));
let composed = null, pageErrors = null;
try {{ composed = composeAll({{ schema: 'professional-slides.deck/v3', id: 'forms', slides: pages }}, '.'); }} catch (e) {{ pageErrors = e.pageErrors ?? [e.message]; }}
const group = composed?.deck.slides[2].nodes ?? [];
const labelled = [...new Set(group.filter((n) => n.role === 'category-label').map((n) => n.data?.childChart))];
const bars = group.filter((n) => n.role === 'chart-mark' && n.data?.childChart);
const lanes = [...new Set(bars.map((n) => n.data.childChart))].map((c) => bars.filter((n) => n.data.childChart === c).map((n) => Math.round(n.frame.y)));
const schema = pageSchema().properties.pages.items.oneOf.find((s) => s.properties.type.const === 'ranking');
console.log(JSON.stringify({{ pageErrors, line: pages[0].exhibit, group: pages[2].exhibit.type, aligned: pages[2].exhibit.aligned, values: pages.map((p) => p.pageType.values),
  labelled, lanes, unsorted: error(() => compilePage({{ ...distribution, exhibit: {{ ...distribution.exhibit, series: [{{ name: 'Cost', values: members.map((_, i) => (i % 2 ? 14 : 20) + i) }}] }} }})),
  unmarked: error(() => compilePage({{ ...distribution, exhibit: {{ ...distribution.exhibit, highlights: [] }} }})),
  short: error(() => compilePage({{ ...distribution, exhibit: {{ ...distribution.exhibit, categories: members.slice(0, 12), series: [{{ name: 'Cost', values: members.slice(0, 12).map((_, i) => i) }}] }} }})),
  noBase: error(() => compilePage({{ ...indexed, exhibit: {{ ...indexed.exhibit, indexBase: 'FY10' }} }})),
  twoPeers: error(() => compilePage({{ ...indexed, exhibit: {{ ...indexed.exhibit, series: indexed.exhibit.series.slice(0, 3) }} }})),
  besideThree: error(() => compilePage({{ ...aligned, commentary: 'beside' }})),
  catalogue: describeTypes(), schema: JSON.stringify(schema.allOf ?? []) }}));
''')
        self.assertIsNone(result['pageErrors'])  # all three forms compose
        line = result['line']
        self.assertEqual(line['type'], 'chart.line')
        self.assertTrue(all(s['values'][0] == 100 for s in line['series']))  # rebased by the compiler, not by hand
        self.assertEqual(line['focusSeries'], 'Subject')
        self.assertNotIn('indexBase', line)
        self.assertEqual(result['group'], 'chart-group')
        self.assertTrue(result['aligned'])
        self.assertEqual(result['values'], [24, 20, 24])
        self.assertEqual(len(result['labelled']), 1)  # the members are named once, down the first column
        self.assertEqual(len(result['lanes']), 3)
        self.assertTrue(all(lane == result['lanes'][0] for lane in result['lanes']))  # every measure's bars level with its member
        self.assertIn('sorted', result['unsorted'])
        self.assertIn('marks the subject', result['unmarked'])
        self.assertIn('15 to 40 categories', result['short'])
        self.assertIn('indexBase', result['noBase'])
        self.assertIn('4 to 8 series', result['twoPeers'])
        self.assertIn('hold two measures', result['besideThree'])
        for published in ('distribution 15-40 categories', 'aligned-bars 2-4 series', 'indexed 4-8 series', 'plots 8+ values', 'indexBase'):
            self.assertIn(published, result['catalogue'])
        self.assertIn('aligned-bars', result['schema'])


if __name__ == '__main__':
    unittest.main()
