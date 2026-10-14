"""Page types: every page is a type, and the compiler derives its structure.

A page names its type; its form defaults to the type's first and its
commentary to the placement its own text asks for. The compiler derives the
layout from those choices, refuses only what cannot be drawn, and sets aside -
and says so - what a placement does not draw.
"""
import unittest

from node_probe import RUNTIME, run_node

KIT = "./skills/professional-slides/runtime/page-types.mjs"
AUTHOR = "./skills/professional-slides/runtime/author-deck.mjs"

PRELUDE = """
import assert from 'node:assert/strict';
import { compilePage, describeTypes } from './skills/professional-slides/runtime/page-types.mjs';
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const S = { kind: 'comparison', what: 'The operator annual reports' };
const base = { takeaway: false, why: 'The page type fits the claim this page makes', settles: S, adds: 'The commentary names the mechanism the exhibit cannot show' };
const compose = (pages) => composeAll({ schema: 'professional-slides.deck/v3', id: 't', slides: pages.map((p, i) => compilePage(p, i)) }, '.').deck.slides;
const error = (fn) => { try { fn(); return null; } catch (e) { return (e.pageErrors ?? [e.message]).join(' | '); } };
// The emphasised text of a composed page, runs joined across line breaks.
const lit = (slide) => slide.nodes.map((n) => (n.runs || []).map((r) => (r.text === '\\n' ? ' ' : r.accent || r.bold ? r.text.replace(/\\n/g, ' ') : ' | ')).join('')).join(' | ');
const years = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
const regions = ['Europe', 'East Asia & Australasia', 'Americas', 'West Asia & Indian Ocean', 'Africa', 'Middle East'];
"""

DECK = """
import {toDeckPlan} from './evals/support/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const build=(slides, extra={})=>planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'d',tracker:false,slides,...extra},'.')).deck;
"""


class CompileTests(unittest.TestCase):
    def test_the_choices_default_and_set_the_structure(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
const years = ['2019','2020','2021','2022','2023','2024','2025','2026'];
const base = {{ id: 'p1', type: 'trend', form: 'line', commentary: 'on-exhibit', takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'The break is the claim and sits where it happens', settles: {{ kind: 'comparison', what: 'The evidence recorded for this page' }},
  title: 'Traffic fell and recovered', exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 2, 4, 5, 6, 6, 7] }}], annotations: [{{ category: '2020', text: 'Traffic fell to a fifth when the network was grounded' }}] }} }};
const error = (page) => {{ try {{ compilePage(page); return null; }} catch (e) {{ return e.message; }} }};
const ok = compilePage(base);
const side = compilePage({{ ...base, commentary: 'beside', points: ['One', 'Two'], highlight: ['One', 'Two'], takeaway: 'So what' }});
const panels = compilePage({{ id: 'p2', type: 'panels', form: 'row', commentary: 'captions', takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'Three airlines answer the same question side by side', settles: {{ kind: 'comparison', what: 'The evidence recorded for this page' }},
  title: 'Each hub grew', exhibits: [0, 1].map((i) => ({{ type: 'chart.column', categories: ['A', 'B', 'C', 'D'], series: [{{ name: 'x', values: [1, 2, 3, 4] }}], caption: 'Hub ' + i + ' added traffic in every year of the run' }})) }});
console.log(JSON.stringify({{
  layout: ok.layout, type: ok.exhibit.type, pageType: ok.pageType.type, close: ok.soWhat ?? null,
  sideLayout: side.layout, sideClose: side.soWhat, arrange: panels.arrange,
  defaults: (({{ pageType }}) => [pageType.form, pageType.commentary])(compilePage({{ ...base, form: undefined, commentary: undefined }})),
  pointsDefault: compilePage({{ ...base, commentary: undefined, points: ['One', 'Two'] }}).pageType.commentary,
  noCommentary: error({{ ...base, commentary: undefined }}), noTakeaway: error({{ ...base, takeaway: undefined }}),
  noForm: error({{ ...base, form: 'pie' }}), layoutWritten: error({{ ...base, layout: 'exhibit-top' }}),
  pointsOnExhibit: compilePage({{ ...base, points: ['x'] }}).pageType.advisories, bare: error({{ ...base, exhibit: {{ ...base.exhibit, annotations: [] }} }}),
  twoPeriods: error({{ ...base, exhibit: {{ ...base.exhibit, categories: ['2019', '2020'] }} }}),
  noCaption: error({{ id: 'p3', type: 'panels', form: 'row', commentary: 'captions', takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'Two measures that together prove it', settles: {{ kind: 'comparison', what: 'The evidence recorded for this page' }},
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
        # A form defaults to the type's first, commentary to what the page's own text asks for.
        self.assertEqual(result['defaults'], ['line', 'on-exhibit'])
        self.assertEqual(result['pointsDefault'], 'beside')
        self.assertIsNone(result['noCommentary'])
        self.assertIn('`form` is one of', result['noForm'])
        self.assertIsNone(result['noTakeaway'])  # takeaway is optional: absent, the page closes on its exhibit
        self.assertIn('set by the page', result['layoutWritten'])
        self.assertTrue(any('points set aside' in note for note in result['pointsOnExhibit']))
        # How a chart is marked and how many periods it shows are the writer's.
        self.assertIsNone(result['bare'])
        self.assertIsNone(result['twoPeriods'])
        self.assertIn('caption', result['noCaption'])


class BeyondOneColumnTests(unittest.TestCase):
    """Pages that are not one exhibit with a text column beside it.

    A generated deck drew two pages in five as one exhibit and a column, and
    passed the variety contract, because the patterns strong decks use instead -
    labelled row blocks, exhibits joined by arrows, a so-what bar - could not be
    drawn, and the contract counted declared choices rather than drawn pages.
    """

    # Shared page parts, spliced into each probe.
    PAGES = '''
const S = { kind: 'comparison', what: 'The operator statement of its plan' };
const base = { takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'The page type fits the claim this page makes', settles: S };
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
        return run_node(f"import {{ compilePage }} from '{KIT}';\n"
                        f"import {{ compileDeck }} from '{AUTHOR}';\n"
                        "import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';\n"
                        + self.PAGES + body)

    def test_each_new_form_compiles_and_composes(self):
        result = self.probe('''
const charts = rows({ blocks: [0, 1].map((i) => ({ label: 'Area ' + (i + 1), points: [point('first'), point('second')], exhibit: bars('Journey time') })) });
const pages = [rows(), { ...charts, id: 'rows-charts' }, rows({ id: 'rows-bar', commentary: 'so-what-bar', bar: 'The three constraints together cap the peak until the depot is extended in 2029' }, 5),
  sequence(), sequence({ id: 'seq-two', commentary: 'so-what-bar', exhibits: sequence().exhibits.slice(0, 2).map(({ caption, ...ex }) => ex),
    bar: 'Faster trains win journeys on every flow, so electrification leads the second phase of the plan' }), ranked()];
const { spec } = compileDeck({ deck: { schema: 'professional-slides.deck/v3', id: 'd' }, pages });
const { deck } = composeAll(spec, '.');
const nodes = (id) => deck.slides.find((s) => s.id === id).nodes;
const count = (id, test) => nodes(id).filter(test).length;
console.log(JSON.stringify({ composed: deck.slides.map((s) => s.id),
  layouts: Object.fromEntries(spec.slides.map((s) => [s.id, s.layout ?? s.arrange])),
  labels: count('rows', (n) => n.role === 'side-panel'), labelsFive: count('rows-bar', (n) => n.role === 'side-panel'),
  metrics: count('rows', (n) => n.role === 'metric-value'), rowCharts: count('rows-charts', (n) => n.role === 'chart-mark'),
  arrows: count('seq', (n) => n.role === 'relationship-arrow'), arrowsTwo: count('seq-two', (n) => n.role === 'relationship-arrow'),
  bars: ['rows-bar', 'seq-two', 'bar'].map((id) => count(id, (n) => n.role === 'insight-surface')),
  closes: spec.slides.map((s) => s.soWhat?.style ?? null) }));
''')
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
}));
''')
        # What the layout cannot hold is refused.
        self.assertIn('"in-exhibit", "so-what-bar"', result['rowsBelow'])
        self.assertIn('1 to 5', result['rowsSix'])
        self.assertIn('2 blocks', result['chartsThree'])
        self.assertIn('in its rows', result['pageExhibit'])
        self.assertIn('2 to 3 steps', result['seqFour'])
        self.assertIn('heading', result['seqUnheaded'])
        self.assertIn('write it as `bar`', result['noBar'])
        self.assertIn('two lines', result['longBar'])
        # How a row is labelled and how many bullets it takes are the writer's; what the placement does not draw is set aside.
        for key in ('longLabel', 'oneBullet', 'mixed', 'strayBlock', 'markedBlock', 'barAndTakeaway', 'barElsewhere', 'barPoints'):
            self.assertIsNone(result[key], key)

    def test_the_catalogue_and_schema_publish_the_new_forms(self):
        result = run_node(f'''
import {{ describeTypes, pageSchema }} from '{KIT}';
const schema = pageSchema();
const parallel = schema.properties.pages.items.oneOf.find((s) => s.properties.type?.const === 'parallel');
const panels = schema.properties.pages.items.oneOf.find((s) => s.properties.type?.const === 'panels');
console.log(JSON.stringify({{ types: describeTypes(), parallelForms: parallel.properties.form.enum, blocks: Boolean(parallel.properties.blocks),
  panelsForms: panels.properties.form.enum, panelsCommentary: panels.properties.commentary.enum, bar: Boolean(panels.properties.bar) }}));
''')
        for published in ('labelled-rows 1-5 blocks', 'sequence 2-3 exhibits', '`so-what-bar`', '`bar`'):
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
const {{ spec }} = compileDeck(doc);
const typed = spec.slides.filter((s) => s.pageType);
console.log(JSON.stringify({{ forms: typed.map((s) => s.pageType.form), commentary: typed.map((s) => s.pageType.commentary) }}));
''')
        self.assertIn('labelled-rows', result['forms'])
        self.assertIn('sequence', result['forms'])
        self.assertIn('so-what-bar', result['commentary'])


class SourceChecksTests(unittest.TestCase):
    """What the forward test found only at build time is now refused where it is written."""

    def test_words_data_and_keys_are_checked_at_compile(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
import {{ compileDeck }} from '{AUTHOR}';
const years = ['2019','2020','2021','2022','2023','2024','2025','2026'];
const trend = (annotations) => ({{ id: 't', type: 'trend', form: 'line', commentary: 'on-exhibit', takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'The break is the claim here', settles: {{ kind: 'comparison', what: 'The evidence recorded for this page' }},
  title: 'Traffic fell and recovered', exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 2, 4, 5, 6, 6, 7] }}], annotations }} }});
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
const pair = {{ type: 'chart.column', categories: ['H1 25', 'H1 26'], series: [{{ name: 'x', values: [46, 31] }}], caption: 'Guests fell by a third in the first half' }};
console.log(JSON.stringify({{
  labels: error(() => compilePage(trend([{{ category: '2020', text: 'Low' }}]))),
  sentence: error(() => compilePage(trend([{{ category: '2020', text: 'Traffic fell to a fifth when the network was grounded' }}]))),
  panelPair: error(() => compilePage({{ id: 'p', type: 'panels', form: 'row', commentary: 'captions', takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'Two cuts of the shock side by side', settles: {{ kind: 'comparison', what: 'The evidence recorded for this page' }},
    title: 'The shock', exhibits: [pair, {{ ...pair, caption: 'April traffic was a tenth of the June level' }}] }})),
  pieData: error(() => compilePage({{ id: 'c', type: 'composition', form: 'donut', commentary: 'beside', points: ['a'], takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'The mix is the claim here', settles: {{ kind: 'comparison', what: 'The evidence recorded for this page' }},
    title: 'Mix', exhibit: {{ categories: ['A', 'B'], series: [{{ name: 'x', values: [60, 40] }}] }} }})),
  sliver: error(() => compilePage({{ id: 'c', type: 'composition', form: 'pie', commentary: 'beside', points: ['a'], takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'The mix is the claim here', settles: {{ kind: 'comparison', what: 'The evidence recorded for this page' }},
    title: 'Mix', exhibit: {{ labels: ['A', 'B', 'C'], values: [80, 17, 3] }} }})),
  unknownKey: error(() => compileDeck({{ deck: {{ id: 'd' }}, pages: [{{ ...trend([{{ category: '2020', text: 'Traffic fell to a fifth when the network was grounded' }}]), highlightRow: 2 }}] }})),
}}));
''')
        # A short label, two numbers in a panel and a thin slice are the writer's call; data a form cannot read is not.
        self.assertIsNone(result['labels'])
        self.assertIsNone(result['sentence'])
        self.assertIsNone(result['panelPair'])
        self.assertIn('`labels`', result['pieData'])
        self.assertIsNone(result['sliver'])
        self.assertIn('highlightRow', result['unknownKey'])

    def test_callouts_are_measured_and_a_broken_page_leaves_the_rest_composed_gated_and_derived(self):
        result = run_node(f'''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {{ compilePage }} from '{KIT}';
import {{ authorDeck }} from '{AUTHOR}';
const years = ['2019','2020','2021','2022','2023','2024','2025','2026'];
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
const S = {{ kind: 'comparison', what: 'The operator statement of its plan' }};
const long = 'Traffic fell to a fifth when the network was grounded and recovered only as aircraft returned from storage in stages';
const trend = {{ id: 't', type: 'trend', form: 'line', commentary: 'on-exhibit', takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'The break is the claim here', settles: {{ kind: 'rate', what: 'The operator annual reports, five years' }},
  title: 'Traffic fell and recovered', exhibit: {{ categories: years, series: [{{ name: 'Pax', values: [5, 1, 2, 4, 5, 6, 6, 7] }}], annotations: [{{ category: '2020', text: long }}] }} }};
const strip = {{ id: 'm', type: 'numbers', form: 'metric-strip', commentary: 'below', points: ['a'], takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'Three numbers carry this claim', settles: S,
  title: 'Three numbers', metrics: [{{ value: '1', label: 'a' }}], exhibit: {{ type: 'table', columns: ['A', 'B'], rows: [['x', '1'], ['y', '2'], ['z', '3']] }} }};
// One run of three pages: a table whose first row is short a cell (it compiles and does not compose), a trend of a form it
// does not have (it does not compile), and a short argument page - composed, gated, budgeted and its content plan derived all the same.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'author-'));
const broken = {{ id: 'b', type: 'lookup', form: 'table', commentary: 'none', takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'The measures are looked up here', settles: S,
  title: 'The measures sit in one table', exhibit: {{ columns: ['A', 'B'], rows: [['x'], ['y', '2'], ['z', '3']] }} }};
const bad = {{ id: 'bad', type: 'trend', form: 'no-such-form', commentary: 'none', takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'The page type fits the claim here', settles: S, title: 'Two years',
  exhibit: {{ categories: ['2019', '2020'], series: [{{ name: 'x', values: [1, 2] }}] }} }};
const memo = {{ id: 'm1', type: 'argument', form: 'memo', commentary: 'none', takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'A short argument page for the test', settles: S,
  title: 'The plan rests on three commitments made this year', paragraphs: ['One short sentence.'], panel: {{ text: 'All three commitments are funded this year: the £340 million grant, the £160 million loan drawn in tranches, and the fare reform that waits for the new timetable.' }} }};
const out = await authorDeck({{ deck: {{ schema: 'professional-slides.deck/v3', id: 'd' }}, pages: [broken, bad, memo] }}, {{ baseDir: dir }});
console.log(JSON.stringify({{ long: error(() => compilePage(trend)), strip: error(() => compilePage(strip)),
  failed: [...out.failedIds].sort(), composed: out.deck.slides.map((s) => s.id), codes: out.blocking.map((f) => f.code + ':' + (f.id ?? '')) }}));
''')
        self.assertIn('callout box', result['long'])
        self.assertIn('`commentary` is one of "none"', result['strip'])
        # Neither the page that does not compile nor the one that does not compose hides the rest of the deck.
        self.assertEqual(result['failed'], ['b', 'bad'])
        self.assertIn('COMPILE:bad', result['codes'])
        self.assertIn('PAGE_DOES_NOT_COMPOSE:b', result['codes'])
        self.assertIn('m1', result['composed'])  # the page that compiled was composed and gated in the same run

    def test_every_compose_error_is_said_at_once(self):
        result = run_node(f'''
import {{ composeAll }} from './skills/professional-slides/runtime/compose-all.mjs';
let all = null;
try {{ composeAll({{ schema: 'professional-slides.deck/v3', id: 'x', slides: [
  {{ id: 'a', title: 'One bad chart page here', exhibit: {{ type: 'chart.bar', categories: ['A', 'B'], series: [{{ name: 'x', values: [1] }}] }} }},
  {{ id: 'b', title: 'Another page that is fine now', points: ['ok'] }},
  {{ id: 'c', title: 'A second bad chart page', exhibit: {{ type: 'chart.nope' }} }}] }}, '.'); }} catch (e) {{ all = e.pageErrors; }}
console.log(JSON.stringify({{ all }}));
''')
        self.assertEqual(len(result['all']), 2)  # both broken pages, in one run
        self.assertTrue(any(e.startswith('c:') for e in result['all']))

class PublishedLimitsTests(unittest.TestCase):
    def test_what_a_form_holds_and_how_points_are_marked(self):
        result = run_node(f'''
import {{ compilePage }} from '{KIT}';
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
const base = {{ takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'The page type fits the claim here', settles: {{ kind: 'share', what: 'The annual report split' }} }};
const pie = (labels, values) => compilePage({{ ...base, id: 'c', type: 'composition', form: 'pie', commentary: 'beside', points: ['A point.'], title: 'Mix',
  exhibit: {{ labels, values }} }});
const road = (n) => compilePage({{ ...base, id: 'r', type: 'schedule', form: 'roadmap', commentary: 'none', title: 'Plan',
  exhibit: {{ items: Array.from({{ length: n }}, (_, i) => ({{ label: 'Phase ' + i, date: '202' + i }})) }} }});
const points = ['Cargo carried 2.4m tonnes, up 3%', 'Thirteen freighters flew in March', 'The margin is not disclosed'];
const bars = {{ ...base, id: 'b', type: 'ranking', form: 'bar', commentary: 'beside', points, title: 'Ranked',
  exhibit: {{ categories: ['A','B','C','D','E','F','G','H'], series: [{{ name: 'x', values: [8,7,6,5,4,3,2,1] }}], highlights: [{{ category: 'A' }}] }} }};
console.log(JSON.stringify({{ six: error(() => pie(['a','b','c','d','e','f'], [1,1,1,1,1,1])), two: error(() => pie(['cargo','other'], [12, 88])),
  small: error(() => pie(['Asia','Europe','Middle East'], [7, 4, 3])), three: error(() => road(3)), four: error(() => road(4)),
  one: (({{ highlight, pageType }}) => ({{ highlight, advisories: pageType.advisories }}))(compilePage({{ ...bars, highlight: '2.4m tonnes' }})),
  figures: compilePage({{ ...bars, points: ['Cargo carried 2.4m tonnes, up 3%', 'In FY22 thirteen freighters flew 1,400 hours', 'Yield rose to $1.2bn in 2025'] }}).highlight,
  each: error(() => compilePage({{ ...bars, highlight: ['2.4m tonnes', 'Thirteen freighters'] }})) }}));
''')
        self.assertIn('2 to 5 labels', result['six'])  # what a pie can draw
        # How many parts a pie shows and how many items a roadmap runs are the writer's.
        for key in ('two', 'small', 'three', 'four'):
            self.assertIsNone(result[key], key)
        # An unmarked point is marked on its own figure - a percentage, an amount or a count, never a year.
        self.assertEqual(result['one']['highlight'], '2.4m tonnes')
        self.assertIsNone(result['one'].get('advisories'))
        self.assertEqual(result['figures'], ['2.4m', '1,400', '$1.2bn'])
        self.assertIsNone(result['each'])


class RerunGapsTests(unittest.TestCase):
    """What the last authored deck found: each limit it met only by failing."""

    def test_waffle_hero_values_callouts_rail_and_stray_highlights(self):
        result = run_node(f'''
import {{ compilePage, describeTypes, railCapacity }} from '{KIT}';
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
const base = {{ takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'The page type fits the claim here', settles: {{ kind: 'count', what: 'The route page count' }} }};
const waffle = (series) => compilePage({{ ...base, id: 'w', type: 'composition', form: 'waffle', commentary: 'beside', title: 'Outstations by region', points: ['Asia holds half of the fourteen outstations.', 'Africa holds one.'],
  exhibit: {{ categories: ['Asia', 'Europe', 'Middle East', 'Africa'], series }} }});
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
        self.assertIsNone(result['strayDraft'])  # a phrase written nowhere is set aside, not refused
        self.assertIsNone(result['strayFull'])
        self.assertGreater(result['capacity'], 20)
        for published in ('3 callouts', 'rail about', 'values 10 characters'):
            self.assertIn(published, result['catalogue'])

    def test_a_column_over_its_height_says_by_how_much(self):
        # A hero number with points beside its exhibit went from a band left
        # empty, to a column over its height, to an empty column, one point at
        # a time. A column over its height says by how much.
        result = run_node(f'''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {{ authorDeck }} from '{AUTHOR}';
const example = JSON.parse(fs.readFileSync('./skills/professional-slides/examples/page-types.pages.json', 'utf8'));
const hero = example.pages.find((p) => p.type === 'numbers' && p.form === 'hero-number');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'author-'));
const long = 'On the low case the path flattens after FY29 and ends at 56.5 million, because the timetable levers still deliver while electrification does not arrive in time.';
const over = {{ ...hero, id: 'over', points: [...hero.points, long, long, long, long], highlight: hero.highlight }};
const run = async (page) => authorDeck({{ deck: {{ schema: 'professional-slides.deck/v3', id: 'd' }}, pages: [page] }}, {{ baseDir: dir }});
const fits = await run(hero), overflows = await run(over);
console.log(JSON.stringify({{ fits: fits.blocking.map((f) => f.code),
  overflow: overflows.blocking.filter((f) => f.code === 'PAGE_DOES_NOT_COMPOSE').map((f) => f.repair) }}));
''')
        self.assertEqual(result['fits'], [])
        self.assertEqual(len(result['overflow']), 1)
        self.assertRegex(result['overflow'][0], r'-side: the column holds \d+px of content in \d+px - over by \d+px, about \d+ lines? of body text')

class EvidenceDepthTests(unittest.TestCase):
    """What a page plots, counted, and the forms built for many values."""

    def test_the_counter_counts_what_each_exhibit_draws(self):
        result = run_node(f'''
import {{ plottedValues }} from './skills/professional-slides/runtime/evidence.mjs';
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
        self.assertEqual(result['scatter'], 6)  # a point is read on both axes, as a box is its five figures
        self.assertEqual(result['waffle'], 3)  # a waffle counts its parts, not its squares
        self.assertEqual(result['pie'], 3)
        self.assertEqual(result['grid'], 6)
        self.assertEqual(result['boxes'], 10)  # five figures a box
        self.assertEqual(result['table'], 4)  # numeric cells, not the row label
        self.assertEqual(result['group'], 6)
        self.assertEqual(result['panels'], 6)

    def test_the_many_value_forms_compile_and_compose(self):
        result = run_node(f'''
import {{ compilePage, describeTypes, pageSchema }} from '{KIT}';
import {{ composeAll }} from './skills/professional-slides/runtime/compose-all.mjs';
const error = (fn) => {{ try {{ fn(); return null; }} catch (e) {{ return e.message; }} }};
const base = {{ takeaway: false, adds: 'The commentary names the mechanism the exhibit cannot show', why: 'The page type fits the claim here', settles: {{ kind: 'rank', what: 'The operator annual reports' }} }};
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
console.log(JSON.stringify({{ pageErrors, line: pages[0].exhibit, group: pages[2].exhibit.type, aligned: pages[2].exhibit.aligned,
  labelled, lanes, sorted: compilePage({{ ...distribution, exhibit: {{ ...distribution.exhibit, series: [{{ name: 'Cost', values: members.map((_, i) => (i % 2 ? 14 : 20) + i) }}] }} }}).exhibit.series[0].values,
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
        self.assertEqual(len(result['labelled']), 1)  # the members are named once, down the first column
        self.assertEqual(len(result['lanes']), 3)
        self.assertTrue(all(lane == result['lanes'][0] for lane in result['lanes']))  # every measure's bars level with its member
        self.assertEqual(result['sorted'], sorted(result['sorted'], reverse=True))  # a distribution is set in order of its value
        # A field of twelve, a subject left unmarked and two peers are the writer's; a base the series do not run over is not.
        self.assertIsNone(result['unmarked'])
        self.assertIsNone(result['short'])
        self.assertIn('indexBase', result['noBase'])
        self.assertIsNone(result['twoPeers'])
        self.assertIn('hold two measures', result['besideThree'])
        for published in ('distribution 2-40 categories', 'aligned-bars 1-4 series', 'indexed 1-8 series', 'indexBase'):
            self.assertIn(published, result['catalogue'])
        self.assertIn('aligned-bars', result['schema'])

    def test_the_text_limits_are_the_page_gates_own(self):
        result = run_node(f'''
import {{ TEXT_LIMITS }} from '{KIT}';
console.log(JSON.stringify(TEXT_LIMITS));
''')
        import sys
        sys.path.insert(0, str(RUNTIME / 'gates'))
        import page_gates
        self.assertEqual(result['titleLines'], page_gates.THRESHOLDS['title_lines_max'])
        self.assertEqual(result['takeawayLines'], 2)

if __name__ == '__main__':
    unittest.main()


class PublishedCatalogueTests(unittest.TestCase):
    """`--types` publishes the limits an author would otherwise learn from errors."""

    def test_types_publishes_the_icon_names(self):
        """Fifty-six-page re-author: icon names were learnt from errors."""
        result = run_node(PRELUDE + """
console.log(JSON.stringify({ types: describeTypes() }));
""")
        types = result["types"]
        self.assertIn("plane", types)

    def test_an_unknown_icon_is_refused_at_compile_with_the_nearest(self):
        """Fifty-six-page re-author: an unknown icon name was learnt from a render error, not refused with the nearest names."""
        result = run_node(PRELUDE + """
import { nearestIcons, iconDefinition } from './skills/professional-slides/runtime/icons.mjs';
const page = (icon) => ({ ...base, id: 'p', type: 'parallel', form: 'cards', commentary: 'none', title: 'Three levers carry the plan through to the end of the decade',
  exhibit: { items: ['Fleet', 'Network', 'Product'].map((title) => ({ title, icon, text: 'A lever the plan pulls in each of the next three years, with its own owner.' })) } });
console.log(JSON.stringify({ refused: error(() => compilePage(page('aeroplanes'))), alias: Boolean(iconDefinition('aircraft')), plane: Boolean(iconDefinition('plane')), near: nearestIcons('ships') }));
""")
        self.assertIn("plane", result["refused"])
        self.assertIn("--icons", result["refused"])
        self.assertTrue(result["alias"] and result["plane"])
        self.assertEqual(result["near"][0], "ship")


class CatalogueRouteTests(unittest.TestCase):
    """Every chart and preset the composer can draw is reached by a page type, or says why not."""

    def test_every_preset_is_routed_or_marked_internal(self):
        """Rebuilt fifty-page deck: forms the renderer could draw had no page type that reached them."""
        result = run_node(f'''
import fs from 'node:fs';
import {{ PRESET_ROUTES, compilePage, PAGE_TYPES }} from '{KIT}';
import {{ SHAPE_NAMES, PAGE_SHAPE_NAMES, composeSlide }} from './evals/support/compose.mjs';
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
        """Rebuilt fifty-page deck: the panel-only charts became forms, each with a worked page."""
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
        # A radar is square: beside its points it holds the body's height, where
        # over points below it sat small between two white margins.
        self.assertEqual(result['radar'], ['beside', 'beside-left', 'rail', 'below', 'none'])

    def test_a_form_refuses_only_what_it_cannot_draw(self):
        """Rebuilt fifty-page deck: a form refuses what it cannot draw."""
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
        # A box plot draws no callout, so "on-exhibit" has nowhere to write; marking the subject and the window are the writer's.
        self.assertIn('`commentary` is one of', result['onExhibit'])
        for key in ('unmarked', 'marked', 'short', 'fine'):
            self.assertIsNone(result[key], key)


class SectionPageTests(unittest.TestCase):
    def test_a_section_is_numbered_once_and_the_closing_bolds_only_its_leads(self):
        """Fifty-page audit: sections were numbered three ways and closing messages were set wholly in bold."""
        result = run_node(f"""
import {{ compilePage }} from '{KIT}';
import {{ REGISTRY }} from './skills/professional-slides/runtime/registry.mjs';
{DECK}
const deck = build([compilePage({{ id: 's1', kind: 'section', title: '01 / Demand and market position', summary: 'Audience and spend' }}), {{ id: 'p', title: 'A page', points: ['One point.'] }},
  compilePage({{ id: 's2', kind: 'section', title: '02 / Revenue', summary: 'Scale' }}), {{ id: 'q', title: 'Another page', points: ['One point.'] }}]);
const divider = deck.slides.find((s) => s.nodes.some((n) => n.role === 'divider-title'));
const out = REGISTRY.get('takeaways').render({{ id: 't', frame: {{ x: 0, y: 0, width: 1280, height: 720 }}, props: {{ items: ['Short run: OpenAI is better placed for attention and distribution across its billion weekly users.', 'Capital: the larger raise and the higher mark belong to different firms.'] }} }}).nodes;
const item = out.find((n) => n.role === 'takeaways-item');
console.log(JSON.stringify({{ compiled: compilePage({{ id: 's1', kind: 'section', title: '01 / Demand' }}).title,
  title: divider.nodes.find((n) => n.role === 'divider-title').text, numeral: divider.nodes.find((n) => n.role === 'divider-number')?.style.fontFamily.tokenId ?? null,
  runs: item.runs.map((r) => r.bold), bold: item.style.bold }}));
""")
        self.assertEqual(result["compiled"], "Demand")
        self.assertEqual(result["title"], "Demand and market position")
        self.assertIn(result["numeral"], (None, "font.body"))
        self.assertEqual(result["runs"], [True, False])
        self.assertFalse(result["bold"])
