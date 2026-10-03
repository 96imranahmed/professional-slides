"""The composer's text (runtime/compose.mjs): lists, prose rows, summaries and highlights.

How points set beside or under an exhibit start, split and read - down or
across - and where a page's highlighted phrase lands. Each test composes a
page and reads the frames and runs it drew.
"""
import unittest

from node_probe import run_node

DECK = """
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const build=(slides, extra={})=>planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'d',tracker:false,slides,...extra},'.')).deck;
"""

PLANNED = '''
import {{ toDeckPlan }} from './skills/professional-slides/runtime/compose.mjs';
import {{ planDeck }} from './skills/professional-slides/runtime/planner.mjs';
const plan = (slides) => planDeck(toDeckPlan({{ schema: 'professional-slides.deck/v3', id: 'd', slides }})).deck;
'''

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

SUMMARY_POINTS = [
    {"lead": "Reach", "text": "The incumbent has more than one billion weekly users and 57% of visits to six major sites, a direct funnel into subscriptions, ads and workplace sales. No matched series is public, so this is a reach lead, not a profit verdict."},
    {"lead": "Paid work", "text": "The challenger passed the incumbent in a US purchase-incidence panel in May and led 43.8% to 39.8% in August, with more than 500 accounts above $1 million a year. Buyers may pay both and retention is unpublished."},
    {"lead": "Capability", "text": "The challenger's model scores highest of five tested models on the current index, while a rival matches the second at a lower cost per task. Cost per successful customer task at matched effort is the test that decides procurement."},
    {"lead": "Capital and horizon", "text": "The incumbent disclosed $122 billion of committed financing and an undrawn revolver; the challenger announced $65 billion at a later mark. Neither publishes funded cash net of timed obligations, so capital quality stays unranked."},
]


class ListTrackTests(unittest.TestCase):
    """A list centres its leftover only when it owns the track it sits in."""

    def test_a_split_list_lands_both_halves_on_one_top(self):
        """First cold run: five findings cut into 3 and 2 centred each half, so the columns started at different heights."""
        # Page 4 of the run: five findings cut into 3 and 2. Each half centred
        # its own leftover, so the two columns started at different heights and
        # the page read as two lists rather than one set of five.
        run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const find=(items,pred)=>{for(const it of items){if(pred(it))return it;const r=it.items?find(it.items,pred):null;if(r)return r;}return null;};
const slide=composeSlide({title:'Five findings',points:[
  'Readiness decides the first wave and only three markets carry full data today',
  'The prize sits behind the longest filings, which no later start recovers',
  'Cost to serve confirms the order rather than contesting it',
  'Two markets stay open and re-enter at the month-13 gate',
  'The committee approves a gate, not a sequence',
]},0);
const a=find(slide.items,i=>i.id==='s01-points-a'), b=find(slide.items,i=>i.id==='s01-points-b');
assert.equal(a.props.centre,false); assert.equal(b.props.centre,false);
// And the renderer honours it: both halves put their first line on one top.
const list=REGISTRY.get('bullet-list');
const top=(props,items)=>list.render({id:'l',frame:{x:0,y:100,width:400,height:360},
  props:{...props,items}}).nodes.filter(n=>n.type==='text').map(n=>n.frame.y).sort((x,y)=>x-y)[0];
assert.equal(top(a.props,a.props.items),top(b.props,b.props.items));
// Left to centre itself, the shorter half starts lower - which is the defect.
const {centre:_drop,...centred}=a.props;
assert.ok(top(centred,b.props.items)>top(centred,a.props.items));
console.log('{}');
''')

    def test_a_list_under_a_kpi_stays_under_it(self):
        """First cold run: points centred under a kpi opened a gap between the number and the first thing said about it."""
        # Pages 9 and 11: a kpi with the points reading from it, and the points
        # centred in what the kpi left over - which opened a gap between the
        # number and the first thing said about it.
        run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const find=(items,pred)=>{for(const it of items){if(pred(it))return it;const r=it.items?find(it.items,pred):null;if(r)return r;}return null;};
const exhibit={type:'chart.bar',categories:['a','b','c','d'],series:[{name:'s',values:[1,2,3,4]}]};
const points=['The first thing the number says','The second thing the number says'];
const withKpi=composeSlide({title:'T',exhibit,kpi:{value:'$232m',label:'Annual contribution'},points},0);
assert.equal(find(withKpi.items,i=>i.id==='s01-points').props.centre,false);
const withInsight=composeSlide({title:'T',exhibit,insight:'Where cost and prize disagree, readiness settles it.',points},0);
assert.equal(find(withInsight.items,i=>i.id==='s01-points').props.centre,false);
// Under the column's own heading it also starts at the top: the points read
// down from "What it means", and the slack belongs at the foot rather than
// half of it between the heading rule and the first line.
const headed=composeSlide({title:'T',exhibit,points},0);
assert.equal(find(headed.items,i=>i.id==='s01-points').props.centre,false);
// Alone in an unheaded track the list spreads from the top too: centring the
// leftover put as much air above the first point as under the last.
const alone=composeSlide({title:'T',exhibit,points,pointsHeading:false},0);
const list=find(alone.items,i=>i.id==='s01-points');
assert.equal(list.props.distribute,true); assert.equal(list.props.centre,false); assert.equal(list.size.height,'fill');
console.log('{}');
''')


class ProseRowTests(unittest.TestCase):
    """Three columns are three parallel answers, or they are a list."""

    def test_sentences_that_are_not_parallel_stack_under_the_exhibit(self):
        """Fifty-page read: a fact, an example and an interpretation were set as three columns under a chart."""
        # The page's close: three sentences of different kinds - a fact, an
        # example, an interpretation - set as three columns under the chart.
        run_node('''
import assert from 'node:assert/strict';
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const spec={schema:'professional-slides.deck/v3',id:'series',slides:[{
  title:'The animated series is where the pairing was first drawn',layout:'exhibit-top',
  exhibit:{type:'chart.column',heading:'Appearances',unit:'count',
    categories:['1992','1993','1994','1995'],series:[{name:'Episodes',values:[28,20,10,5]}]},
  points:[
    'Batman: The Animated Series ran from 1992 to 1995 in the catalogue',
    'Harley\\u2019s documented introduction offers a concrete example of a character created for television and carried back into print',
    'Interpretation: the series format offers repeated encounters with a cast, which is where a supporting character can be developed',
  ]}]};
const paragraphs=planDeck(toDeckPlan(spec)).deck.slides[0].nodes.filter(n=>n.role==='paragraph');
assert.equal(paragraphs.length,3);
// A list reads down - in two columns, so it keeps its measure and still fills
// the band under the exhibit instead of leaving the right half empty.
const [a,b,c]=paragraphs;
assert.equal(a.frame.x,b.frame.x,'the first two read down the first column');
assert.ok(b.frame.y>a.frame.y,'in the order they were written');
assert.ok(c.frame.x>a.frame.x+a.frame.width-1,'the third opens the second column');
assert.equal(c.frame.y,a.frame.y,'at the top of it');
assert.ok(c.frame.x+c.frame.width>900,'the list spans the width of the band');
console.log('{}');
''')

    def test_parallel_columns_still_read_across(self):
        """Fifty-page read: parallel phrases and led points still read across as columns."""
        # Short phrases of one length, and led points whose leads become the
        # columns' headings: both are three parallel answers to one question.
        run_node('''
import assert from 'node:assert/strict';
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const exhibit={type:'chart.column',heading:'Appearances',unit:'count',
  categories:['1992','1993','1994','1995'],series:[{name:'Episodes',values:[28,20,10,5]}]};
const row=(points)=>{
  const spec={schema:'professional-slides.deck/v3',id:'series',slides:[{
    title:'Three readings of one run',layout:'exhibit-top',exhibit,points}]};
  return planDeck(toDeckPlan(spec)).deck.slides[0].nodes.filter(n=>n.role==='paragraph');
};
const fragments=row(['Episodes fell every year','The first year carries the run','The last year is a coda']);
assert.equal(fragments.length,3);
assert.equal(new Set(fragments.map(n=>n.frame.x)).size,3,'three columns');
assert.equal(new Set(fragments.map(n=>n.frame.y)).size,1,'on one line');
const led=row([
  {lead:'The peak is the first year',text:'Twenty-eight episodes ran before the format settled into its later shape'},
  {lead:'The fall is steady',text:'Each year afterwards carries roughly half the episodes of the year before it'},
  {lead:'The coda is short',text:'Five episodes close the run, which is a season in name rather than in length'}]);
assert.equal(new Set(led.map(n=>n.frame.x)).size,3,'a lead on every column is the shared structure');
assert.equal(new Set(led.map(n=>n.frame.y)).size,1);
// A lead on some and not others is not a structure the three of them share.
const mixed=row([
  {lead:'The peak is the first year',text:'Twenty-eight episodes ran before the format settled'},
  'Each year afterwards carries roughly half the episodes of the year before it',
  'Five episodes close the run, which is a season in name rather than in length']);
assert.equal(mixed[0].frame.x,mixed[1].frame.x,'mixed construction reads down, not across');
assert.ok(mixed[1].frame.y>mixed[0].frame.y);
console.log('{}');
''')


class PointsUnderPanelsTests(unittest.TestCase):
    def test_points_below_a_row_of_panels_run_in_columns_at_a_readable_measure(self):
        """Fifty-six-page re-author: points under a row of panels ran 150 characters a line."""
        result = run_node(PRELUDE + """
const points = ['Europe and East Asia with Australasia earn AED75.3bn together, 59% of the revenue, so the long-haul premium markets carry the business.',
  'Africa added AED970m in the year, close to the gains of the two far larger regions, and is the fastest-growing market.',
  'The Americas were the only region to shrink, falling 3.2% as routes were cut back after the shock to hub traffic.'];
const page = (n) => ({ ...base, id: 'p' + n, type: 'panels', form: 'row', commentary: 'below', title: 'Revenue grew fastest where the network is smallest',
  highlight: ['59% of the revenue', 'AED970m', 'only region to shrink'].slice(0, n), points: points.slice(0, n),
  exhibits: [{ type: 'chart.bar', heading: 'Revenue', unit: 'AED bn', categories: regions, series: [{ name: 'Revenue', values: [39.6, 35.7, 21, 12.5, 10.9, 9] }] },
             { type: 'chart.bar', heading: 'Change', unit: '%', categories: regions, series: [{ name: 'Change', values: [3.1, 3.2, -3.2, 1.1, 9.7, 2.7] }] }] });
const [two, three] = compose([page(2), page(3)]);
const items = (s) => s.nodes.filter((n) => n.role === 'list-item').map((n) => ({ x: n.frame.x, width: n.frame.width, longest: Math.max(...n.data.textLayout.lines.map((l) => l.length)) }));
const panels = two.componentInstances.filter((c) => c.component === 'chart.bar').map((c) => c.frame);
console.log(JSON.stringify({ two: items(two), three: items(three), panels }));
""")
        for layout in (result["two"], result["three"]):
            self.assertTrue(all(item["longest"] <= 90 for item in layout), layout)
        self.assertEqual(len({round(i["x"]) for i in result["three"]}), 3, "three across")
        # One point to a panel sits under its panel.
        for item, panel in zip(sorted(result["two"], key=lambda i: i["x"]), sorted(result["panels"], key=lambda p: p["x"])):
            self.assertGreaterEqual(item["x"], panel["x"] - 1)
            self.assertLessEqual(item["x"] + item["width"], panel["x"] + panel["width"] + 1)


class SummaryLedgerTests(unittest.TestCase):
    """Four developed findings fill the summary's body, row by row, with no band between them."""

    def test_four_developed_summary_points_run_as_a_ledger_at_a_reading_measure(self):
        """Fifty-page audit: an executive summary ran four findings across the body at 160 characters a line."""
        # Two by two, the pairs centred in each half of the body left a band of
        # air a third of the page tall between them; one finding a row, the
        # lead beside its statement, reads down the body in order.
        result = run_node(DECK + """
const text = (i) => `Finding ${i} is developed across a full sentence of evidence, with the number that proves it and the qualification that bounds it for the reader.`;
const deck = build([{ id: 's', title: 'The answer and its proof', layout: 'text', points: [1, 2, 3, 4].map((i) => ({ lead: `Lead ${i}`, text: text(i) })) }]);
const items = deck.slides[0].nodes.filter((n) => n.role === 'list-item');
const leads = deck.slides[0].nodes.filter((n) => n.role === 'list-lead');
console.log(JSON.stringify({ xs: [...new Set(items.map((n) => Math.round(n.frame.x)))].length, ys: [...new Set(items.map((n) => Math.round(n.frame.y)))].length,
  widest: Math.max(...items.map((n) => n.frame.width)), beside: leads.every((l) => l.frame.x + l.frame.width < Math.min(...items.map((n) => n.frame.x))) }));
""")
        self.assertEqual(result["xs"], 1)
        self.assertEqual(result["ys"], 4)
        self.assertTrue(result["beside"])
        self.assertLess(result["widest"], 600)

    def test_four_findings_run_down_the_body_as_a_ledger(self):
        """Rebuilt fifty-page deck: a summary's four points left a band of air a third of the page tall between their rows."""
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


class PhraseHighlightTests(unittest.TestCase):
    """A page's highlight lands wherever the page writes the phrase."""

    def test_every_place_a_page_writes_its_phrase_draws_it(self):
        """Fifty-six-page re-author: a highlight compiled on a summary, a rail, a comparison and a matrix and rendered no accent anywhere."""
        result = run_node(PRELUDE + """
const summary = { ...base, id: 'es', type: 'summary', form: 'executive-summary', commentary: 'none', title: 'The operator leads on scale, margin and network today',
  highlight: ['11.4 million more', 'yield rose 53%'],
  points: ['The operator carried 53.2 million passengers, 11.4 million more than its nearest rival, and its hub stayed the busiest.',
           'It earned a 15.0% margin because yield rose 53% in ten years while unit cost rose 30%.'],
  exhibit: { type: 'table', columns: ['Pillar', 'Evidence', 'Condition'], rows: [['Scale', '53.2m passengers', 'Traffic recovers'], ['Economics', '15.0% margin', 'Yield holds'], ['Network', 'First in the region', 'Banks restored']] } };
const rail = { ...base, id: 'rl', type: 'trend', form: 'line', commentary: 'rail', title: 'Hub traffic is ten percent above its 2019 level',
  highlight: '95.2m against 54.3m',
  rail: 'The smaller hubs grew faster from smaller bases; the larger hub still handled 95.2m against 54.3m in the latest year.',
  exhibit: { heading: 'Passengers', unit: 'million', categories: years, referenceLines: [{ value: 86, label: '2019 level' }],
    series: [{ name: 'Hub', values: [89, 86, 26, 29, 66, 87, 92, 95] }, { name: 'Rival', values: [37, 39, 13, 18, 36, 46, 53, 54] }] } };
const compare = { ...base, id: 'cp', type: 'options', form: 'compare', commentary: 'in-exhibit', title: 'The smaller aircraft is flying while the larger one waits',
  highlight: 'not an operator date',
  exhibit: { left: { heading: 'Smaller type', points: ['In service: 19 aircraft', 'On order: 54 aircraft'] },
             right: { heading: 'Larger type', points: ['In service: none', 'Arriving: the maker aims for 2027, not an operator date'] }, winner: 'left' } };
const matrix = { ...base, id: 'mx', type: 'matrix', form: 'findings-matrix', commentary: 'in-exhibit', title: 'Headline destination counts hide incompatible definitions',
  highlight: '91 actually operated',
  columns: ['Carrier', 'Published claim', 'Why it cannot be ranked'],
  rows: [{ label: 'First', cells: [['152 cities', 'Operated at year end'], 'A snapshot that excludes partner cities'] },
         { label: 'Second', cells: [['110 published destinations', '91 actually operated in December'], 'Includes seasonal and planned services'] },
         { label: 'Third', cells: [['219 routes', 'Across six hubs'], 'Routes are city pairs, not cities'] }] };
const bar = { ...base, id: 'sb', type: 'trend', form: 'column', commentary: 'so-what-bar', title: 'Passengers recovered past their 2019 level by 2023',
  highlight: 'eight points of margin', bar: 'Each year of recovery since 2023 has added about eight points of margin to the network.',
  exhibit: { heading: 'Passengers', unit: 'million', categories: years, series: [{ name: 'Passengers', values: [89, 86, 26, 29, 66, 87, 92, 95] }], referenceLines: [{ value: 86, label: '2019 level' }] } };
const captions = { ...base, id: 'pc', type: 'panels', form: 'row', commentary: 'captions', title: 'Revenue grew fastest where the network is smallest',
  highlight: 'only region that shrank',
  exhibits: [{ type: 'chart.bar', heading: 'Revenue', unit: 'AED bn', categories: regions, series: [{ name: 'Revenue', values: [39.6, 35.7, 21, 12.5, 10.9, 9] }], caption: 'Europe and East Asia earn well over half of the revenue between them' },
             { type: 'chart.bar', heading: 'Change', unit: '%', categories: regions, series: [{ name: 'Change', values: [3.1, 3.2, -3.2, 1.1, 9.7, 2.7] }], caption: 'The Americas were the only region that shrank over the year' }] };
const slides = compose([summary, rail, compare, matrix, bar, captions]);
console.log(JSON.stringify(Object.fromEntries(slides.map((s) => [s.id, lit(s)]))));
""")
        self.assertIn("11.4 million more", result["es"], "points below an executive summary's table")
        self.assertIn("yield rose 53%", result["es"])
        self.assertIn("95.2m", result["rl"], "the rail")
        self.assertIn("not an operator date", result["cp"], "a comparison column")
        self.assertIn("91 actually operated", result["mx"], "a bulleted matrix cell")
        self.assertIn("eight points of margin", result["sb"], "the so-what bar")
        self.assertIn("only region that shrank", result["pc"], "a panel caption")

    def test_a_title_naming_one_of_several_series_greys_the_rest(self):
        """Fifty-page audit: four saturated series when the title named one of them."""
        result = run_node(DECK + """
const deck = build([{ id: 's', title: 'Enterprise spend shifted toward Anthropic', layout: 'exhibit-full',
  exhibit: { type: 'chart.column', heading: 'Spend share', unit: '%', categories: ['2023', '2024', '2025'],
    series: [{ name: 'Anthropic', values: [12, 24, 40] }, { name: 'OpenAI', values: [50, 34, 27] }, { name: 'Google', values: [7, 12, 21] }, { name: 'Other', values: [31, 30, 12] }] } }]);
const marks = deck.slides[0].nodes.filter((n) => n.role === 'chart-mark');
const fill = (series) => [...new Set(marks.filter((m) => m.data.series === series).map((m) => m.style.fill.tokenId))];
console.log(JSON.stringify({ subject: fill('Anthropic'), peers: [...new Set(['OpenAI', 'Google', 'Other'].flatMap(fill))] }));
""")
        self.assertEqual(result["subject"], ["color.componentPrimary"])
        self.assertEqual(result["peers"], ["color.chartComparator"])


if __name__ == "__main__":
    unittest.main()
