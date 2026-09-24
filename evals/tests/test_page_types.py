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
const years = ['2019','2020','2021','2022','2023'];
const base = {{ id: 'p1', type: 'trend', form: 'line', commentary: 'on-exhibit', takeaway: false, why: 'The break is the claim and sits where it happens', settles: {{ kind: 'qualitative', what: 'The evidence recorded for this page' }},
  title: 'Traffic fell and recovered', exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 2, 4, 5] }}], annotations: [{{ category: '2020', text: 'Traffic fell to a fifth when the network was grounded' }}] }} }};
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
const years = ['2019','2020','2021','2022','2023'];
const chart = (extra = {{}}) => ({{ categories: years, series: [{{ name: 'x', values: [1, 2, 3, 4, 5] }}], annotations: [{{ category: '2021', text: 'The turn came when grounded capacity returned to the network' }}], ...extra }});
const stamped = Array.from({{ length: 14 }}, (_, i) => ({{ id: 's' + i, type: 'trend', form: 'line', commentary: 'below', takeaway: 'So what ' + i,
  why: 'Every page takes the same shape here', settles: {{ kind: 'qualitative', what: 'The evidence recorded for this page' }}, title: 'Finding ' + i, exhibit: chart(), points: ['a', 'b', 'c'], highlight: ['a', 'b', 'c'] }}));
let refused = compileDeck({{ deck: {{ schema: 'professional-slides.deck/v3', id: 'd' }}, pages: stamped }}).findings.map((f) => f.code).sort();
const kinds = [
  {{ type: 'trend', form: 'line', commentary: 'on-exhibit', exhibit: chart() }},
  {{ type: 'ranking', form: 'bar', commentary: 'beside', points: ['a'], exhibit: {{ categories: ['A','B','C','D','E'], series: [{{ name: 'x', values: [5,4,3,2,1] }}], highlights: [{{ category: 'A' }}] }} }},
  {{ type: 'panels', form: 'row', commentary: 'captions', exhibits: [0, 1].map((i) => ({{ type: 'chart.column', categories: ['A','B','C','D'], series: [{{ name: 'x', values: [1, 2, 3, 4] }}], caption: 'Segment ' + i + ' grew fastest where capacity was added first' }})) }},
  {{ type: 'scorecard', form: 'harvey', commentary: 'in-exhibit', exhibit: {{ columns: ['Option', {{ label: 'Fit', type: 'harvey' }}], rows: [['A', {{ type: 'harvey', value: 2 }}]] }} }},
  {{ type: 'mechanism', form: 'flow', commentary: 'below', points: ['a', 'b'], highlight: ['a', 'b'], exhibit: {{ nodes: [{{ id: 'x' }}, {{ id: 'y' }}, {{ id: 'z' }}], edges: [] }} }},
  {{ type: 'numbers', form: 'hero-number', commentary: 'beside', kpi: {{ value: '5', label: 'x' }}, points: ['a'], exhibit: {{ type: 'table', columns: ['A', 'B'], rows: [['x', '1']] }} }},
  {{ type: 'argument', form: 'memo', commentary: 'none', paragraphs: ['Prose.'] }},
];
const chosen = Array.from({{ length: 14 }}, (_, i) => ({{ id: 'c' + i, takeaway: i % 7 === 0 ? 'Close' : false, why: 'Chosen for what this page has to show', settles: {{ kind: 'qualitative', what: 'The evidence recorded for this page' }}, title: 'Finding ' + i, ...structuredClone(kinds[i % kinds.length]) }}));
const ok = compileDeck({{ deck: {{ schema: 'professional-slides.deck/v3', id: 'd' }}, pages: chosen }});
const untyped = varietyFindings({{ slides: Array.from({{ length: 13 }}, (_, i) => ({{ id: 'u' + i, title: 't' }})) }}, {{ structureOf }}).map((f) => f.code);
const edited = structuredClone(ok.spec); edited.slides[0].layout = 'exhibit-top';
console.log(JSON.stringify({{ refused, chosen: ok.findings.map((f) => f.code), untyped,
  edited: varietyFindings(edited, {{ structureOf }}).map((f) => f.code) }}));
''')
        self.assertEqual(result['refused'], ['VARIETY_COMMENTARY', 'VARIETY_SIGNATURE', 'VARIETY_TAKEAWAY',
                                             'VARIETY_TYPE_RANGE', 'VARIETY_TYPE_RUN', 'VARIETY_TYPE_SHARE'])  # panels counts from 15 pages
        self.assertEqual(result['chosen'], [])
        self.assertEqual(result['untyped'], ['PAGE_TYPE_UNDECLARED'])
        self.assertEqual(result['edited'], ['PAGE_TYPE_EDITED'])


class SourceChecksTests(unittest.TestCase):
    """What the forward test found only at build time is now refused where it is written."""

    def test_words_data_and_keys_are_checked_at_compile(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
import {{ compileDeck }} from '{AUTHOR}';
const years = ['2019','2020','2021','2022','2023'];
const trend = (annotations) => ({{ id: 't', type: 'trend', form: 'line', commentary: 'on-exhibit', takeaway: false, why: 'The break is the claim here', settles: {{ kind: 'qualitative', what: 'The evidence recorded for this page' }},
  title: 'Traffic fell and recovered', exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 2, 4, 5] }}], annotations }} }});
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
const years = ['2019','2020','2021','2022','2023'];
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
const S = {{ kind: 'rate', what: 'The operator annual reports, five years' }};
const long = 'Traffic fell to a fifth when the network was grounded and recovered only as aircraft returned from storage in stages';
const trend = {{ id: 't', type: 'trend', form: 'line', commentary: 'on-exhibit', takeaway: false, why: 'The break is the claim here', settles: S,
  title: 'Traffic fell and recovered', exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 2, 4, 5] }}], annotations: [{{ category: '2020', text: long }}] }} }};
const strip = {{ id: 'm', type: 'numbers', form: 'metric-strip', commentary: 'below', points: ['a'], takeaway: false, why: 'Three numbers carry this claim', settles: S,
  title: 'Three numbers', metrics: [{{ value: '1', label: 'a' }}], exhibit: {{ type: 'table', columns: ['A', 'B'], rows: [['x', '1']] }} }};
// A short argument page: its content plan is derived from the composed page and held to the text-page floor.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'author-'));
const memo = {{ id: 'm1', type: 'argument', form: 'memo', commentary: 'none', takeaway: false, why: 'A short argument page for the test',
  settles: {{ kind: 'qualitative', what: 'The operator statement of its plan' }}, adds: null, title: 'The plan rests on three commitments made this year', paragraphs: ['One short sentence.'] }};
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
  title: 'The book leads the set', points: ['A point.'], exhibit: {{ categories: ['A','B','C','D','E'], series: [{{ name: 'x', values: [5,4,3,2,1] }}], highlights: [{{ category: 'A' }}] }} }});
const derived = compilePage(ranking(['i2']), 0, {{ insights }});
const onExhibit = {{ id: 'o', type: 'trend', form: 'line', commentary: 'on-exhibit', takeaway: false, why: 'The break is the claim here', settles: {{ kind: 'rate', what: 'Five years of reports' }},
  title: 'Traffic fell and recovered', exhibit: {{ categories: ['2019','2020','2021','2022','2023'], series: [{{ name: 'x', values: [5,1,2,4,5] }}], highlights: [{{ category: '2020' }}] }} }};
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
  title: 'The plan rests on three commitments made this year', paragraphs: ['One short sentence.'] }};
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
  exhibit: {{ categories: ['A','B','C','D','E'], series: [{{ name: 'x', values: [5,4,3,2,1] }}], highlights: [{{ category: 'A' }}] }} }};
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
const years = ['2019','2020','2021','2022'];
const callouts = (n) => compilePage({{ ...base, id: 't', type: 'trend', form: 'line', commentary: 'on-exhibit', title: 'Traffic',
  exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 3, 5] }}], annotations: Array.from({{ length: n }}, (_, i) => ({{ category: years[i], text: 'The network was grounded and traffic fell to a fifth' }})) }} }});
const rail = (text) => compilePage({{ ...base, id: 'r', type: 'trend', form: 'line', commentary: 'rail', rail: text, title: 'Traffic',
  exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 3, 5] }}], highlights: [{{ category: '2020' }}] }} }});
const stray = (draft) => error(() => compilePage({{ ...base, id: 's', type: 'trend', form: 'line', commentary: 'beside', title: 'Traffic',
  points: ['Traffic fell to a fifth', 'It recovered by 2022'], highlight: ['a fifth', 'never written'],
  exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 3, 5] }}], highlights: [{{ category: '2020' }}] }} }}, 0, {{ draft }}));
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
  title: 'The plan rests on three commitments made this year', paragraphs: ['One short sentence.'] }};
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


if __name__ == '__main__':
    unittest.main()
