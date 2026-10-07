"""The storyline critique: bound to the argument, fed the insight log.

A critique is only worth its verdict for the argument it read. Laying a page
out, redrawing it or rewording it keeps the critique; changing what a page
claims, what settles it, or the insights and measures it rests on asks for a
new one. The insight log travels with the packet so the critic can see whether
the titles were written from findings.
"""
import unittest

from node_probe import run_node


class StorylineTests(unittest.TestCase):
    def test_binding_follows_the_argument_not_the_wording_or_the_drawing(self):
        result = run_node('''
import { storylineBinding, validateStorylineReview, checkInsights, describeExhibit, STORYLINE_DIMENSIONS } from './skills/professional-slides/runtime/storyline.mjs';
const spec = { slides: [{ id: 'a', title: 'Northvale Rail opened 14 stations in 16 weeks', exhibit: { type: 'chart.line', categories: ['M1','M2','M3','M4','M5'], series: [{ name: 'Stations', values: [1,3,6,10,14] }] }, points: ['A sentence.'] }] };
const reworded = structuredClone(spec); reworded.slides[0].points = ['A different sentence.'];
const retitled = structuredClone(spec); retitled.slides[0].title = 'Northvale Rail has 14 stations';
const binding = storylineBinding(spec);
const ready = { pass: 1, verifies: null, verdict: 'ready', binding, rating: 8, summary: 'The answer is sharp and the pillars hold on the evidence shown.',
  compliance: { verdict: 'complete', note: 'Nothing the evidence in scope allows is left undone.' }, sufficiency: { verdict: 'sufficient', note: 'The evidence supports the answer as it is stated.' },
  spine: 'Read alone, the one title states the finding the whole storyline rests on, with its rate.', answer: 'Northvale Rail is opening stations faster than any recent regional entrant did.',
  answerParts: [{ part: 'Is Northvale Rail up and coming', verdict: 'answered', missingEvidence: '' }],
  pillars: [{ pillar: 'Speed', pages: ['a'], verdict: 'holds', overlap: 'A single pillar; nothing overlaps.', strongestCounter: 'Small base', reversal: 'The ramp stalls below ten routes a quarter.', answered: true }],
  pages: [{ page: 'a', verdict: 'ok', claim: 'a rate, not a count', shape: 'a monthly series', sourcing: { status: 'n/a', insights: [], note: 'no insight log in this probe' }, restatement: 'first page', consequence: 'states the pace' }],
  numbers: 'One figure, printed once; nothing to reconcile.', sectionFlow: 'A single page; there are no sections to order.', execSummary: 'The title is the summary and states the answer.',
  missingAnalyses: [], cutOrMerge: [], findings: [], topFixes: ['None material'],
  completeness: STORYLINE_DIMENSIONS.map((check) => ({ check, result: 'clean', note: `Checked ${check} on this one-page storyline; nothing to raise.` })) };
const revalued = structuredClone(spec); revalued.slides[0].exhibit.series[0].values = [14, 10, 6, 3, 1];
console.log(JSON.stringify({
  same: storylineBinding(reworded) === binding, changed: storylineBinding(retitled) !== binding,
  ok: validateStorylineReview(ready, reworded), stale: validateStorylineReview(ready, retitled).length,
  // The verdict is read off the items: a critic's "revise" with nothing open is ready, and an open major sends it back.
  revise: validateStorylineReview({ ...ready, verdict: 'revise', findings: [{ id: 'F1', scope: 'page', pages: ['a'], check: 'claim', severity: 'major', ifUnfixed: 'The committee would back a plan on a count, not the rate it needs.',
    problem: 'The title states a count, not the rate the claim rests on.', fix: 'State the rate of opening against the plan.' }] }, spec).length,
  saidRevise: validateStorylineReview({ ...ready, verdict: 'revise' }, spec).length, missing: validateStorylineReview(null, spec).length,
  bare: validateStorylineReview({ verdict: 'ready', binding }, spec), revalued: storylineBinding(revalued) !== binding,
  twoNumber: describeExhibit({ type: 'chart.column', categories: ['A', 'B'], series: [{ name: 'x', values: [1, 2] }] }),
  plainTable: describeExhibit({ type: 'table', columns: ['Operator', 'Note'], rows: [['A', 'words'], ['B', 'more words']] }),
  insights: checkInsights({ insights: [{ id: 'i1', finding: 'f', calculation: 'c', shape: 'series', breadth: { periods: 8 }, sources: ['sources/x.csv'], strength: 'strong', soWhat: 'It sets the pace of the plan' },
    { id: 'i2', finding: 'f', shape: 'fact', sources: ['sources/y.csv'], strength: 'context', soWhat: 'It frames the market for the reader' }] }, ['x.csv']).problems,
  ungraded: checkInsights({ insights: [{ id: 'i4', finding: 'f', calculation: 'c', shape: 'fact', sources: ['sources/x.csv'], strength: 'high' }] }, ['x.csv']).problems,
  pillar: checkInsights({ insights: [{ id: 'i5', finding: 'f', calculation: 'c', shape: 'fact', sources: ['sources/x.csv'], strength: 'context', soWhat: 'It frames the market for the reader' }] }, ['x.csv'],
    [{ kind: 'section', title: 'Demand', evidence: [] }, { kind: 'content', title: 'A page', evidence: ['i5'] }]).problems,
  unshaped: checkInsights({ insights: [{ id: 'i3', finding: 'f', calculation: 'c', sources: ['sources/x.csv'] }] }, ['x.csv']).problems,
  none: checkInsights(null).problems }));
''')
        self.assertTrue(result['same'])
        self.assertTrue(result['changed'])
        self.assertEqual(result['ok'], [])
        self.assertEqual(result['stale'], 1)
        self.assertEqual(result['revise'], 1)
        self.assertEqual(result['saidRevise'], 0)
        self.assertEqual(result['missing'], 1)
        self.assertTrue(any('summary' in e for e in result['bare']))  # a verdict alone is not a critique
        # An exhibit that names no recorded measure is bound by the numbers it draws: a trend that reverses is a different story.
        # (Where it names one, the record is bound: test_the_gate_binds_the_argument_not_the_layout.)
        self.assertTrue(result['revalued'])
        self.assertIn('TWO-NUMBER', result['twoNumber'])
        self.assertIn('PLAIN GRID', result['plainTable'])
        self.assertIn('0 of 4 cells carry a number', result['plainTable'])
        self.assertEqual(len(result['insights']), 2)  # i2: no calculation, and its source is missing
        # Graded as the authoring compile grades them (one definition: storyline.mjs insightGradeProblems).
        self.assertTrue(any('strength' in p for p in result['ungraded']) and any('soWhat' in p for p in result['ungraded']))
        self.assertTrue(any('PILLAR_UNSUPPORTED' in p and 'Demand' in p for p in result['pillar']))
        self.assertTrue(any('shape' in p for p in result['unshaped']))  # the data's shape decides the pages it can carry
        self.assertIn('no insight log', result['none'][0])


    def test_the_gate_binds_the_argument_not_the_layout(self):
        # The binding used to hold each exhibit's type and every number it
        # drew, so any layout repair after a critique reopened it and an author
        # laid the whole deck out before each pass. It now holds the argument:
        # the request, the answer and its status, the pages in order, and per
        # page its title, claim, page type, what settles it, the insights it
        # rests on and the measures it declares it shows, with their recorded values
        # and what the page shows of each: which periods or members, in what
        # class of exhibit. An exhibit that names no measure is bound by its numbers.
        result = run_node('''
import { storylineBinding, storylinePageHashes, storyStructure, recordedMeasures, shownMeasures } from './skills/professional-slides/runtime/storyline.mjs';
import { PAGE_TYPES, familyOf } from './skills/professional-slides/runtime/page-types.mjs';
const log = (o = {}) => [{ id: 'i-spend', measures: { subject: { unit: '%', periods: ['2023', '2024', '2025'], values: [12, 24, 40], ...o }, rival: { unit: '%', periods: ['2023', '2024', '2025'], values: [30, 28, 27] } } },
  { id: 'i-terms', measures: { years: { unit: 'years', members: ['A', 'B'], values: [5, 7] } } }];
const type = (o = {}, content = {}, dependencies = {}) => ({ type: 'trend', form: 'column', commentary: 'below', takeaway: false, why: 'The shift is a rate over three years',
  content: { claim: 'Enterprise spend shifted toward the subject', settles: { kind: 'rate', what: 'survey snapshots', measures: ['i-spend/subject'], relation: null }, evidence: ['i-spend'], ...content },
  dependencies: { exhibits: [{ measures: ['i-spend/subject'], role: 'proof' }], ...dependencies }, ...o });
const page = (o = {}) => ({ id: 'p03', title: 'Enterprise spend shifted toward the subject before the funding surge', pageType: type(),
  exhibit: { type: 'chart.column', categories: ['2023', '2024', '2025'], series: [{ name: 'Subject', values: [12, 24, 40] }], caption: 'Categorical snapshots.', highlights: [{ category: '2025' }] },
  points: ['A sentence of commentary.'], ...o });
const table = { id: 'p04', title: 'Terms differ by counterparty', exhibit: { type: 'table', columns: ['Party', 'Term'], rows: [['A', 'Five years'], ['B', { text: '7 yrs', value: 7 }]] } };
const section = { id: 's1', kind: 'section', title: 'Demand' }, close = { id: 's2', kind: 'section', title: 'Capital' };
const spec = (o = {}, deck = {}, slides = null) => ({ id: 'deck', request: 'Who is better positioned, and why?', answer: 'The subject leads enterprise spend.', slides: slides ?? [section, page(o), close, table], ...deck });
const measures = recordedMeasures(log());
const base = storylineBinding(spec(), measures);
const same = (s, m = measures, from = null) => storylineBinding(s, m) === (from ? storylineBinding(spec({}, {}, from), measures) : base);
const moved = (s, m = measures, from = spec()) => { const was = storylinePageHashes(from, measures), now = storylinePageHashes(s, m); return Object.keys(now).filter((id) => was[id] !== now[id]); };
// An exhibit beside the claim's that names no measure.
const unnamed = (values) => ({ type: 'chart.line', categories: ['a', 'b', 'c'], series: [{ name: 'Other', values }] });
// A page that ranks a whole peer set, drawn from its measure.
const ranked = (o = {}) => ({ id: 'p05', title: 'B holds the longer term', pageType: { type: 'ranking', form: 'bar', content: { claim: 'B holds the longer term', settles: { kind: 'rank', what: 'term by party', measures: ['i-terms/years'] }, evidence: ['i-terms'] },
  dependencies: { exhibits: [{ measures: ['i-terms/years'], role: 'proof' }] } }, exhibit: { type: 'chart.bar', categories: ['A', 'B'], series: [{ name: 'Term', values: [5, 7] }], ...o } });
const exhibit = page().exhibit;
console.log(JSON.stringify({
  // The layout: every one of these keeps a ready critique.
  layout: {
    form: same(spec({ pageType: type({ form: 'line' }) })),
    exhibitType: same(spec({ exhibit: { ...exhibit, type: 'chart.line' } })),
    commentaryPlace: same(spec({ pageType: type({ commentary: 'so-what-bar', takeaway: true }), soWhat: 'The shift came first.' })),
    why: same(spec({ pageType: type({ why: 'A reworded reason for the page type, eight words' }) })),
    commentary: same(spec({ points: ['A rewritten sentence of commentary with a new number, 41%.'] })),
    caption: same(spec({ exhibit: { ...exhibit, caption: 'Survey snapshots at unequal intervals.' } })),
    highlights: same(spec({ exhibit: { ...exhibit, highlights: [{ category: '2023' }] } })),
    drawnValues: same(spec({ exhibit: { ...exhibit, series: [{ name: 'Subject', values: [12.0, 24.4, 39.6] }] } })),
    cellText: same(spec({}, {}, [section, page(), close, { ...table, exhibit: { ...table.exhibit, rows: [['A', 'Five-year term'], ['B', { text: 'seven years', value: 7 }]] } }])),
    membersReordered: same(spec({}, {}, [section, page(), close, ranked({ categories: ['B', 'A'], series: [{ name: 'Term', values: [7, 5] }] })]), measures, [section, page(), close, ranked()]),
    laidOut: same(spec({ exhibit: undefined, points: undefined })),
    twoExhibitsOfTheClaim: same(spec({ exhibits: [exhibit], exhibit: { ...exhibit, type: 'chart.line' }, pageType: type({ form: 'combo' }, {}, { exhibits: [{ measures: ['i-spend/subject'], role: 'proof' }, { measures: ['i-spend/subject'] }] }) })),
    metricOfTheClaim: same(spec({ pageType: type({}, {}, { metrics: [{ measures: ['i-spend/subject'] }] }) })),
    evidenceOrder: same(spec({ pageType: type({}, { evidence: ['i-spend', 'i-spend'] }) })),
  },
  // The argument: every one of these needs the critique again, and names the page that moved.
  argument: {
    title: moved(spec({ title: 'A different finding' })),
    claim: moved(spec({ pageType: type({}, { claim: 'Spend moved away from the subject' }) })),
    pageType: moved(spec({ pageType: type({ type: 'ranking' }) })),
    settlesKind: moved(spec({ pageType: type({}, { settles: { kind: 'comparison', what: 'survey snapshots', measures: ['i-spend/subject'] } }) })),
    settlesWhat: moved(spec({ pageType: type({}, { settles: { kind: 'rate', what: 'a panel of buyers', measures: ['i-spend/subject'] } }) })),
    settlesMeasure: moved(spec({ pageType: type({}, { settles: { kind: 'rate', what: 'survey snapshots', measures: ['i-spend/rival'] } }) })),
    relation: moved(spec({ pageType: type({}, { settles: { kind: 'rate', what: 'survey snapshots', measures: ['i-spend/subject'], relation: { kind: 'gap' } } }) })),
    evidence: moved(spec({ pageType: type({}, { evidence: ['i-spend', 'i-terms'] }) })),
    shownMeasure: moved(spec({ pageType: type({}, {}, { exhibits: [{ measures: ['i-spend/subject', 'i-spend/rival'], role: 'proof' }] }) })),
    role: moved(spec({ pageType: type({}, {}, { exhibits: [{ measures: ['i-spend/subject'], role: 'proof' }, { measures: ['i-spend/rival'], role: 'context', relevance: 'The rival sets the pace the subject is measured against' }] }) })),
    recordedValues: moved(spec(), recordedMeasures(log({ values: [40, 24, 12] }))),
    recordedUnit: moved(spec(), recordedMeasures(log({ unit: 'firms' }))),
    recordedAxis: moved(spec(), recordedMeasures(log({ periods: ['2021', '2023', '2025'] }))),
    // What the page shows of a measure it names: a window, a dropped period, labels that are not the measure's, another class of exhibit, a figure beside the chart.
    window: moved(spec({ exhibit: { ...exhibit, categories: ['2023', '2024'], series: [{ name: 'Subject', values: [12, 24] }], highlights: [{ category: '2024' }] } })),
    droppedPeriod: moved(spec({ exhibit: { ...exhibit, categories: ['2023', '2025'], series: [{ name: 'Subject', values: [12, 40] }] } })),
    categoryLabel: moved(spec({ exhibit: { ...exhibit, categories: ['FY23', 'FY24', 'FY25'] } })),
    exhibitClass: moved(spec({ exhibit: { type: 'table', columns: ['Year', 'Subject'], rows: [['2023', '12%'], ['2024', '24%'], ['2025', '40%']] } })),
    tableWindow: moved(spec({ exhibit: { type: 'table', columns: ['Year', 'Subject'], rows: [['2024', '24%'], ['2025', '40%']] } })),
    figureInstead: moved(spec({ exhibit: undefined, metrics: [{ value: '40%', label: 'of buyers in 2025' }], pageType: type({}, {}, { exhibits: undefined, metrics: [{ measures: ['i-spend/subject'], role: 'proof' }] }) })),
    figureBeside: moved(spec({ metrics: [{ value: '40%', label: 'of buyers in 2025' }], pageType: type({}, {}, { metrics: [{ measures: ['i-spend/subject'], role: 'proof' }] }) })),
    secondWindow: moved(spec({ exhibits: [{ ...exhibit, categories: ['2024', '2025'], series: [{ name: 'Subject', values: [24, 40] }] }], pageType: type({}, {}, { exhibits: [{ measures: ['i-spend/subject'], role: 'proof' }, { measures: ['i-spend/subject'] }] }) })),
    // An exhibit that names no measure is bound by the numbers it draws, as every exhibit of a deck with no log is.
    cellValue: moved(spec({}, {}, [section, page(), close, { ...table, exhibit: { ...table.exhibit, rows: [['A', 'Five years'], ['B', { text: '9 yrs', value: 9 }]] } }])),
    unnamedValues: moved(spec({ exhibits: [unnamed([3, 2, 1])] }), measures, spec({ exhibits: [unnamed([1, 2, 3])] })),
    added: moved(spec({}, {}, [section, page(), { ...page(), id: 'p03b' }, close, table])),
    cut: storylinePageHashes(spec({}, {}, [section, page(), close]), measures).p04 === undefined,
  },
  deck: {
    reordered: same(spec({}, {}, [section, table, close, page()])), sectionsSwapped: same(spec({}, {}, [close, page(), section, table])), cut: same(spec({}, {}, [section, page(), close])),
    request: same(spec({}, { request: 'Which company should an investor back?' })), provenance: same(spec({}, { requestProvenance: 'reconstructed' })),
    answer: same(spec({}, { answer: 'Neither can be ranked.' })), answerStatus: same(spec({}, { answerStatus: 'provisional', answerLimits: ['Whether the lead holds past the next round'] })),
  },
  // A measure the page does not show may change without touching it, and a deck with no log binds the refs alone.
  otherMeasure: same(spec(), recordedMeasures([{ ...log()[0], measures: { ...log()[0].measures, rival: { unit: '%', periods: ['2023', '2024', '2025'], values: [1, 2, 3] } } }, log()[1]])),
  noLog: [storylineBinding(spec()) === storylineBinding(spec({ exhibit: { ...exhibit, type: 'chart.line' } })), storylineBinding(spec()) !== storylineBinding(spec({ title: 'A different finding' })),
    storylineBinding(spec()) !== storylineBinding(spec({ exhibit: { ...exhibit, series: [{ name: 'Subject', values: [40, 24, 12] }] } })),
    storylineBinding(spec()) !== storylineBinding(spec({ exhibit: { ...exhibit, categories: ['2023', '2024'], series: [{ name: 'Subject', values: [12, 24] }] } })),
    storylineBinding(spec()) !== storylineBinding(spec({ exhibit: { type: 'table', columns: ['Year', 'Subject'], rows: [['2023', { text: '12%', value: 12 }], ['2024', { text: '24%', value: 24 }], ['2025', { text: '40%', value: 40 }]] } }))],
  // What a page not yet drawn is read as, for every page type: a table where the type's exhibit is one (page-types.mjs familyOf).
  natural: Object.keys(PAGE_TYPES).filter((kind) => (JSON.parse(storyStructure(spec({ exhibit: undefined, pageType: type({ type: kind }) }), measures).find((p) => p.id === 'p03').views['i-spend/subject'][0])[0] === 'table') !== (familyOf(kind) === 'table')),
  scalar: storyStructure(spec({ exhibit: undefined, pageType: type({}, { settles: { kind: 'count', what: 'one figure', measures: ['i-one/total'] }, evidence: ['i-one'] }, { exhibits: undefined }) }), recordedMeasures([{ id: 'i-one', measures: { total: { unit: 'm', value: 4 } } }])).find((p) => p.id === 'p03').views,
  views: storyStructure(spec(), measures).find((p) => p.id === 'p03').views, undrawn: storyStructure(spec({ exhibit: undefined }), measures).find((p) => p.id === 'p03').views,
  windowed: storyStructure(spec({ exhibit: { ...exhibit, categories: ['2023', '2024'], series: [{ name: 'Subject', values: [12, 24] }] } }), measures).find((p) => p.id === 'p03').views,
  shows: shownMeasures(page({ pageType: type({}, {}, { exhibits: [{ measures: ['i-spend/subject'] }, { measure: 'i-spend/rival', role: 'context' }], metrics: [{ measures: ['i-terms/years'] }] }) })),
  fields: [...new Set(storyStructure(spec(), measures).flatMap((p) => Object.keys(p)))],
}));
''')
        for edit, kept in result['layout'].items():
            self.assertTrue(kept, edit)
        for edit, pages in result['argument'].items():
            self.assertEqual(pages, {'cut': True, 'added': ['p03b', 's2'], 'cellValue': ['p04']}.get(edit, ['p03']), edit)
        for edit, kept in result['deck'].items():
            self.assertFalse(kept, edit)
        self.assertTrue(result['otherMeasure'])
        # No log: the form is still the layout's, and the numbers drawn, the periods drawn and the class of exhibit are bound.
        self.assertEqual(result['noLog'], [True, True, True, True, True])
        # A measure shown whole in its natural class is what a page not yet drawn is read as; a window is not.
        self.assertEqual(result['views'], {'i-spend/subject': ['["chart","all"]']})
        self.assertEqual(result['undrawn'], result['views'])
        self.assertEqual(result['natural'], [])
        # A measure of one value has one view - a figure - whatever exhibit carries it.
        self.assertEqual(result['scalar'], {'i-one/total': ['["figure"]']})
        self.assertEqual(result['windowed'], {'i-spend/subject': ['["chart",["2023","2024"]]']})
        # A measure of the claim is proof by definition; an exhibit or a metric adds what the claim does not name, with its role.
        self.assertEqual(result['shows'], ['context:i-spend/rival', 'proof:i-spend/subject', 'proof:i-terms/years'])
        # The whole of what a page is bound to: nothing of its form, its commentary's place or its copy; of its exhibits, what they show of each
        # measure (`views`) and, where one names no measure, its class and numbers (`drawn`).
        self.assertEqual(result['fields'], ['id', 'kind', 'title', 'claim', 'type', 'settles', 'rests', 'shows', 'measures', 'views', 'drawn'])

    def test_what_the_critic_is_shown_is_what_the_critique_is_bound_to(self):
        # The spine packet lists the argument only: a drafted exhibit's form
        # and numbers are not in it, since a critic who judges them files an
        # item no change to the argument can close. The page-level packet
        # shows drafted exhibits and copy, said to be a draft.
        result = run_node('''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import { prepareStoryline } from './skills/professional-slides/runtime/storyline.mjs';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'shown-'));
await fs.writeFile(path.join(dir, 'd.insights.json'), JSON.stringify({ insights: [{ id: 'i-spend', finding: 'Spend on the subject rose from 12% to 40% of buyers in three years', calculation: 'share of panel firms buying', shape: 'series', breadth: { periods: 6 },
  strength: 'strong', soWhat: 'The shift came before the funding surge', sources: ['sources/panel.csv'],
  measures: { subject: { unit: '%', periods: ['2020', '2021', '2022', '2023', '2024', '2025'], values: [5, 7, 9, 12, 24, 40] }, rival: { unit: '%', members: ['North', 'South'], values: [30, 27] } } }] }));
const spec = { id: 'd', workflow: 'new_deck', request: 'Who is better positioned, and why?', answer: 'The subject leads enterprise spend.', slides: [
  { id: 'p01', title: 'Enterprise spend shifted toward the subject before the funding surge', points: ['A drafted sentence of commentary that is not the argument.'],
    pageType: { type: 'trend', form: 'column', commentary: 'below', content: { claim: 'Enterprise spend shifted toward the subject before the funding surge', settles: { kind: 'rate', what: 'share of panel firms buying, 2020 to 2025', measures: ['i-spend/subject'] }, evidence: ['i-spend'] },
      dependencies: { exhibits: [{ measures: ['i-spend/subject'], role: 'proof' }, { measures: ['i-spend/rival'], role: 'context', relevance: 'The rival shows the base the subject took share from' }] } },
    exhibits: [{ type: 'chart.column', heading: 'DRAFTED-HEADING', categories: ['2024', '2025'], series: [{ name: 'Subject', values: [24, 41.5] }] }, { type: 'chart.bar', categories: ['North', 'South'], series: [{ name: 'Rival', values: [30, 27] }] }] }] };
const specPath = path.join(dir, 'd.deck.json');
await fs.writeFile(specPath, JSON.stringify(spec));
const read = async (mode, out) => { const step = await prepareStoryline(specPath, path.join(dir, out), { mode }); const text = await fs.readFile(path.join(step.dir, 'prompt.md'), 'utf8');
  const packet = JSON.parse(await fs.readFile(path.join(step.dir, 'packet.json'), 'utf8')); await fs.rm(step.dir, { recursive: true, force: true }); return { text, packet }; };
const spine = await read('spine', 'out');
await fs.rm(path.join(dir, '.reviews'), { recursive: true, force: true });
const full = await read('full', 'out2');
await fs.rm(dir, { recursive: true, force: true });
const line = (text) => text.split('\\n').find((l) => l.includes('[p01]')) ?? '';
console.log(JSON.stringify({
  spine: { line: line(spine.text), form: /column|chart\\./.test(line(spine.text)), drafted: spine.text.includes('DRAFTED-HEADING') || spine.text.includes('41.5'), copy: spine.text.includes('drafted sentence'),
    rule: spine.text.includes('File no item that only a redrawn or reworded page would fix') },
  full: { measures: full.text.includes('i-spend/subject: 2020 5, 2021 7, 2022 9, 2023 12, 2024 24, 2025 40 %'), type: full.text.includes('page type: trend'), settled: full.text.includes('settled by: rate: share of panel firms buying, 2020 to 2025'),
    form: full.text.includes('page type: trend/') || full.text.includes('explanation below'), drafted: full.text.includes('drafted exhibits (not settled): chart.column') && full.text.includes('DRAFTED-HEADING'), copy: full.text.includes('drafted copy (not settled)') || !full.text.includes('drafted sentence'),
    rule: full.text.includes('anything marked a draft is the author') },
  packet: [Object.keys(spine.packet.pages[0]).sort(), spine.packet.pages[0].type, spine.packet.pages[0].measures.map((m) => [m.ref, m.role])],
}));
''')
        spine = result['spine']
        self.assertIn('| trend, settled by rate |', spine['line'])
        # The critic is shown what the page shows of each measure: the drafted chart's window of two periods, not the six recorded.
        self.assertIn('shows: i-spend/subject: 2020 5, 2021 7, 2022 9, 2023 12, 2024 24, 2025 40 % [the page shows it plotted, 2 of its 6 periods: 2024, 2025]; i-spend/rival (context): North 30, South 27 % [the page shows it plotted, whole]', spine['line'])
        self.assertIn('declared: context i-spend/rival - relevance claimed: "The rival shows the base the subject took share from"', spine['line'])
        self.assertIn('rests on: i-spend', spine['line'])
        self.assertEqual([spine['form'], spine['drafted'], spine['copy'], spine['rule']], [False, False, False, True])
        self.assertEqual(result['full'], {'measures': True, 'type': True, 'settled': True, 'form': False, 'drafted': True, 'copy': True, 'rule': True})
        self.assertEqual(result['packet'][1:], ['trend', [['i-spend/subject', 'proof'], ['i-spend/rival', 'context']]])
        self.assertNotIn('exhibits', result['packet'][0])
        self.assertNotIn('keyNumbers', result['packet'][0])

    def test_a_ready_critique_reopens_when_a_page_stops_showing_what_it_read(self):
        # A ready critique used to survive a chart that dropped the period its
        # title turns on, a `select` that hid the latest years, and a chart
        # swapped for a table: the binding held the measure, not what the page
        # showed of it. The gate now names the page; a redrawn form passes.
        result = run_node('''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'views-'));
const out = path.join(dir, 'out'); await fs.mkdir(out);
await fs.writeFile(path.join(dir, 'v.insights.json'), JSON.stringify({ insights: [{ id: 'i-cash', finding: 'Cash flow rose for five years and fell by a fifth in the sixth', calculation: 'operating cash flow by year', shape: 'series', breadth: { periods: 6 },
  strength: 'strong', soWhat: 'Growth is now absorbing the cash it used to produce', sources: ['sources/accounts.csv'], measures: { ocf: { unit: 'm', periods: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'], values: [58, 61, 66, 72, 84, 66] } } }] }));
const categories = ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'], values = [58, 61, 66, 72, 84, 66];
const spec = (exhibit) => ({ id: 'v', workflow: 'new_deck', request: 'Can the firm fund its growth from its own cash?', answer: 'No: cash flow fell by a fifth in the latest year.', slides: [
  { id: 'p01', title: 'Cash flow fell by a fifth in the latest year', pageType: { type: 'trend', form: 'column', commentary: 'below',
      content: { claim: 'Cash flow fell by a fifth in the latest year', settles: { kind: 'rate', what: 'operating cash flow, six years', measures: ['i-cash/ocf'] }, evidence: ['i-cash'] },
      dependencies: { exhibits: [{ measures: ['i-cash/ocf'], role: 'proof' }] } }, ...(exhibit ? { exhibit } : {}) }] });
const specPath = path.join(dir, 'v.deck.json');
const write = (exhibit) => fs.writeFile(specPath, JSON.stringify(spec(exhibit)));
const whole = { type: 'chart.column', categories, series: [{ name: 'Cash flow', values }] };
// The critique reads the spine before the page is drawn, and says ready.
await write(null);
const one = await S.prepareStoryline(specPath, out);
const prompt = await fs.readFile(path.join(one.dir, 'prompt.md'), 'utf8');
const packet = JSON.parse(await fs.readFile(path.join(one.dir, 'packet.json'), 'utf8'));
await fs.writeFile(path.join(out, 'storyline-review.json'), JSON.stringify({ pass: 1, verifies: null, verdict: 'ready', rating: 8, binding: one.binding, summary: 'The answer is sharp and the one page proves it on the recorded series.',
  compliance: { verdict: 'complete', note: 'Nothing the evidence in scope allows is left undone.' }, sufficiency: { verdict: 'sufficient', note: 'The evidence supports the answer as it is stated.' },
  provenance: { backend: 'subagent', model: 'fixture', promptHash: packet.promptHash }, spine: 'Read alone, the one title states the finding the storyline rests on, with its size.',
  answer: 'No: cash flow fell by a fifth in the latest year, so growth needs outside funding.', answerParts: [{ part: 'Can the firm fund its growth', verdict: 'answered', missingEvidence: '' }],
  pillars: [{ pillar: 'Cash', pages: ['p01'], verdict: 'holds', overlap: 'A single pillar; nothing overlaps.', strongestCounter: 'One weak year', reversal: 'Cash flow recovers above its peak.', answered: true }],
  numbers: 'One figure, printed once; nothing to reconcile.', sectionFlow: 'A single page; there are no sections to order.', execSummary: 'The title is the summary and states the answer.',
  missingAnalyses: [], cutOrMerge: [], findings: [], topFixes: ['None material'],
  completeness: S.STORYLINE_DIMENSIONS.map((check) => ({ check, result: 'clean', note: `Checked ${check} on this one-page storyline; nothing to raise.` })) }));
const ready = await S.prepareStoryline(specPath, out);
const gate = async (exhibit) => { await write(exhibit); return S.storylineGate(spec(exhibit), out, { deckPath: specPath }); };
const laidOut = await gate(whole);
const redrawn = await gate({ ...whole, type: 'chart.line', caption: 'A new caption.', highlights: [{ category: 'Y6' }] });
const dropped = await gate({ ...whole, categories: categories.slice(0, 5), series: [{ name: 'Cash flow', values: values.slice(0, 5) }] });
const tabled = await gate({ type: 'table', columns: ['Year', 'Cash flow'], rows: categories.map((year, i) => [year, String(values[i])]) });
// The verification pass the loop then writes names the page and shows the critic the window.
await write({ ...whole, categories: categories.slice(0, 5), series: [{ name: 'Cash flow', values: values.slice(0, 5) }] });
const next = await S.prepareStoryline(specPath, out);
const verify = await fs.readFile(path.join(next.dir, 'prompt.md'), 'utf8');
await fs.rm(one.dir, { recursive: true, force: true }); await fs.rm(next.dir, { recursive: true, force: true }); await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify({ undrawn: prompt.split('\\n').find((l) => l.includes('[p01]')), ready: [ready.status, ready.note], laidOut, redrawn, dropped, tabled,
  next: [next.status, next.pass], verify: verify.split('\\n').find((l) => l.includes('[p01]')) }));
''')
        # Before it is drawn the page is read as showing the measure whole, and the critic is told so.
        self.assertIn('[not drawn yet: critiqued as plotted, every one of its 6 periods]', result['undrawn'])
        self.assertEqual(result['ready'][0], 'ready')
        self.assertIn('which periods or members of a measure a page shows', result['ready'][1])
        # Laid out whole, and redrawn in another chart form with new copy: the critique stands.
        self.assertEqual([result['laidOut'], result['redrawn']], [[], []])
        for stopped in ['dropped', 'tabled']:
            self.assertEqual(len(result[stopped]), 1, stopped)
            self.assertIn('p01', result[stopped][0])
            self.assertIn('which periods or members of a measure the page shows', result[stopped][0])
        self.assertEqual(result['next'], ['packet-written', 2])
        self.assertIn('[the page shows it plotted, 5 of its 6 periods: Y1 to Y5]', result['verify'])
        self.assertIn('[changed]', result['verify'])

    def test_a_lineage_recorded_under_an_older_binding_is_retired_not_capped(self):
        # A pass recorded before the binding held what it holds now hashed its
        # pages differently: read against today's hashes every page had
        # "changed", the next run wrote a verification of all of them, and a
        # lineage at its third pass was capped for a change nobody made.
        result = run_node('''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stale-'));
const out = path.join(dir, 'out'); await fs.mkdir(out);
const spec = { id: 'o', workflow: 'new_deck', request: 'Is the subject winning its market?', answer: 'Yes, on growth.', slides: [{ id: 'p01', title: 'The subject grew fastest of five rivals' }, { id: 'p02', title: 'Rivals grew more slowly on every measure' }] };
const specPath = path.join(dir, 'o.deck.json');
await fs.writeFile(specPath, JSON.stringify(spec));
const history = path.join(dir, '.reviews', 'o', 'storyline-history');
await fs.mkdir(history, { recursive: true });
// Three passes as an older runtime recorded them: no binding version, page hashes of another definition, a major item still open.
const ledger = [{ id: 'F1', code: 'STORY_CLAIM', dimension: 'claim', severity: 'major', pages: ['p01'], reason: 'The claim is a count', repair: 'State the rate', status: 'not fixed', raisedIn: 1, updatedIn: 3 }];
for (const pass of [1, 2, 3]) await fs.writeFile(path.join(history, `pass-${pass}.json`), JSON.stringify({ review: { pass, verifies: pass === 1 ? null : 'b'.repeat(64), verdict: 'revise', rating: 6, binding: 'a'.repeat(64) },
  binding: 'a'.repeat(64), pass, verifies: null, pageHashes: { p01: 'old-1', p02: 'old-2' }, ledger, mode: 'spine' }));
await fs.writeFile(path.join(out, 'storyline-review.json'), JSON.stringify({ pass: 3, binding: 'a'.repeat(64), verdict: 'revise' }));
const gate = await S.storylineGate(spec, out, { deckPath: specPath });
const step = await S.prepareStoryline(specPath, out);
const lineage = JSON.parse(await fs.readFile(path.join(history, 'lineage.json'), 'utf8'));
const archived = await fs.readdir(path.join(history, 'retired-1'));
const left = (await fs.readdir(history)).filter((f) => f.startsWith('pass-'));
const answer = await fs.readFile(path.join(out, 'storyline-review.json'), 'utf8').then(() => true, () => false);
const packet = JSON.parse(await fs.readFile(path.join(step.dir, 'packet.json'), 'utf8'));
// A second run changes nothing: the lineage is current now.
const again = await S.prepareStoryline(specPath, out);
await fs.rm(step.dir, { recursive: true, force: true }); await fs.rm(again.dir, { recursive: true, force: true }); await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify({ gate, step: [step.status, step.pass, step.retired], scope: packet.scope, version: packet.bindingVersion, lineage, archived: archived.sort(), left, answer, again: [again.status, again.pass, again.retired ?? null] }));
''')
        self.assertEqual(len(result['gate']), 1)
        self.assertIn('recorded under binding version 1', result['gate'][0])
        self.assertIn('not counted against the pass cap', result['gate'][0])
        # A first pass, not a capped fourth: nothing of the old lineage is verified or counted.
        self.assertEqual(result['step'][:2], ['packet-written', 1])
        self.assertIn('archived in', result['step'][2])
        self.assertIsNone(result['scope'])
        self.assertEqual(result['version'], 5)
        self.assertEqual(result['archived'], ['pass-1.json', 'pass-2.json', 'pass-3.json', 'storyline-review.json'])
        self.assertEqual([result['left'], result['answer']], [[], False])
        # Logged as a retirement with why, and not as a restart, which a second time would need the user's approval.
        self.assertEqual(result['lineage']['restarts'], [])
        self.assertEqual([r['passes'] for r in result['lineage']['retired']], [3])
        self.assertEqual([r['carried'] for r in result['lineage']['retired']], [1])  # the major item still open goes with the new packet
        self.assertIn('binding version 1', result['lineage']['retired'][0]['note'])
        self.assertEqual(result['again'], ['packet-written', 1, None])

    def test_a_retired_lineage_carries_its_open_blocking_items_into_the_new_first_pass(self):
        # Retirement archived the passes and wrote a clean first packet that
        # said nothing of the blocker still open in them: a serious problem a
        # critic had seen was dropped by a version change. The new packet
        # lists them, and the critique answers each or is refused.
        result = run_node('''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'carried-'));
const out = path.join(dir, 'out'); await fs.mkdir(out);
const spec = { id: 'o', workflow: 'new_deck', request: 'Is the subject winning its market?', answer: 'Yes, on growth.', slides: [{ id: 'p01', title: 'The subject grew fastest of five rivals' }, { id: 'p02', title: 'Rivals grew more slowly on every measure' }] };
const specPath = path.join(dir, 'o.deck.json');
await fs.writeFile(specPath, JSON.stringify(spec));
const history = path.join(dir, '.reviews', 'o', 'storyline-history');
await fs.mkdir(history, { recursive: true });
// Three passes under an older binding version: a blocker restated once, a major, and a minor that is not carried; one item closed.
const ledger = [{ id: 'F1', code: 'STORY_CLAIM', dimension: 'claim', severity: 'blocker', pages: ['p01'], reason: 'The claim is contradicted by the evidence', repair: 'Withdraw it', status: 'not fixed', raisedIn: 1, updatedIn: 3,
    folded: [{ id: 'N4', pass: 2, severity: 'blocker', pages: ['p01'], reason: 'The rivals named are not the five in the log' }] },
  { id: 'F2', code: 'STORY_SHAPE', dimension: 'shape', severity: 'major', pages: ['p02'], reason: 'The comparison leaves out the largest rival', repair: 'Add it', status: 'partly fixed', raisedIn: 1, updatedIn: 3 },
  { id: 'F3', code: 'STORY_SHAPE', dimension: 'shape', severity: 'minor', pages: ['p02'], reason: 'The order of the rivals is arbitrary', repair: 'Rank them', status: 'not fixed', raisedIn: 1, updatedIn: 3 },
  { id: 'F4', code: 'STORY_CLAIM', dimension: 'claim', severity: 'major', pages: ['p02'], reason: 'The title states no rate', repair: 'State it', status: 'fixed', raisedIn: 1, updatedIn: 2 }];
for (const pass of [1, 2, 3]) await fs.writeFile(path.join(history, `pass-${pass}.json`), JSON.stringify({ review: { pass, verifies: pass === 1 ? null : 'b'.repeat(64), verdict: 'revise', rating: 4, binding: 'a'.repeat(64) },
  binding: 'a'.repeat(64), bindingVersion: 2, pass, verifies: null, pageHashes: { p01: 'old-1', p02: 'old-2' }, ledger, mode: 'spine' }));
const step = await S.prepareStoryline(specPath, out);
const read = async (at) => ({ packet: JSON.parse(await fs.readFile(path.join(at.dir, 'packet.json'), 'utf8')), prompt: await fs.readFile(path.join(at.dir, 'prompt.md'), 'utf8') });
const first = await read(step);
const lineage = async () => JSON.parse(await fs.readFile(path.join(history, 'lineage.json'), 'utf8'));
const logged = await lineage();
// A second run before the critique is answered writes the same packet: the items are still carried.
const again = await S.prepareStoryline(specPath, out);
const second = await read(again);
const critique = (extra) => ({ pass: 1, verifies: null, verdict: 'ready', rating: 8, binding: again.binding, summary: 'The answer is sharp and the two pages prove it on the recorded growth of the five rivals.',
  compliance: { verdict: 'complete', note: 'Nothing the evidence in scope allows is left undone.' }, sufficiency: { verdict: 'sufficient', note: 'The evidence supports the answer as it is stated.' },
  provenance: { backend: 'subagent', model: 'fixture', promptHash: second.packet.promptHash }, spine: 'Read alone, the two titles state the finding the storyline rests on, with its comparison.',
  answer: 'Yes: the subject grew fastest of the five rivals, on every measure the log records.', answerParts: [{ part: 'Is the subject winning', verdict: 'answered', missingEvidence: '' }],
  pillars: [{ pillar: 'Growth', pages: ['p01', 'p02'], verdict: 'holds', overlap: 'A single pillar; nothing overlaps.', strongestCounter: 'One strong year', reversal: 'A rival outgrows it next year.', answered: true }],
  numbers: 'No figure is printed twice; nothing to reconcile.', sectionFlow: 'Two pages in one section; the order follows the claim.', execSummary: 'The first title is the summary and states the answer.',
  missingAnalyses: [], cutOrMerge: [], findings: [], topFixes: ['None material'],
  completeness: S.STORYLINE_DIMENSIONS.map((check) => ({ check, result: 'clean', note: `Checked ${check} on this two-page storyline; nothing to raise.` })), ...extra });
const answer = async (extra) => { await fs.writeFile(path.join(out, 'storyline-review.json'), JSON.stringify(critique(extra))); return S.prepareStoryline(specPath, out); };
const gone = 'The spine now names the five rivals of the log and the claim matches their recorded growth.';
const silent = await answer({});
const half = await answer({ carried: [{ item: 'F1', stands: false, evidence: gone }] });
const unfiled = await answer({ carried: [{ item: 'F1', stands: false, evidence: gone }, { item: 'F2', stands: true, evidence: 'The largest rival is still missing from the comparison on p02.' }] });
const stranger = await answer({ carried: [{ item: 'F1', stands: false, evidence: gone }, { item: 'F2', stands: false, evidence: gone + ' It includes the largest.' }, { item: 'F3', stands: false, evidence: gone }] });
const done = await answer({ carried: [{ item: 'F1', stands: false, evidence: gone }, { item: 'F2', stands: false, evidence: 'All five rivals of the log, the largest among them, are in the comparison on p02.' }] });
const settled = await lineage();
await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify({ step: [step.status, step.pass, step.retired], carried: first.packet.carried, block: first.prompt.split('\\n').filter((l) => /^OPEN WHEN|^- F\\d/.test(l)), logged: logged.retired.map((r) => [r.passes, r.carried, (r.open || []).map((e) => e.id)]),
  again: [again.status, again.pass, (second.packet.carried || []).map((e) => e.id)], silent: [silent.status, silent.errors], half: [half.status, half.errors], unfiled: [unfiled.status, unfiled.errors], stranger: [stranger.status, stranger.errors],
  done: [done.status, done.pass], settled: settled.retired.map((r) => [r.carried, typeof r.settledIn]), schema: Object.keys(S.STORYLINE_SPINE_SCHEMA.properties).includes('carried') }));
''')
        self.assertEqual(result['step'][:2], ['packet-written', 1])
        self.assertIn('Its 2 open blocking items are carried into the new packet (F1, F2)', result['step'][2])
        # The blocking items still open, each with every statement it holds; the minor one and the closed one are not carried.
        self.assertEqual([[item['id'], item['severity'], item['pages']] for item in result['carried']], [['F1', 'blocker', ['p01']], ['F2', 'major', ['p02']]])
        self.assertIn('The claim is contradicted by the evidence', result['carried'][0]['text'])
        self.assertIn('The rivals named are not the five in the log', result['carried'][0]['text'])
        self.assertEqual(len(result['block']), 3)
        self.assertIn('left 2 blocking items open', result['block'][0])
        self.assertIn('say in `carried` whether it still stands', result['block'][0])
        self.assertIn('- F1 · claim · blocker · p01: The claim is contradicted by the evidence', result['block'][1])
        # The log says how many were carried, and which.
        self.assertEqual(result['logged'], [[3, 2, ['F1', 'F2']]])
        self.assertEqual(result['again'], ['packet-written', 1, ['F1', 'F2']])
        self.assertTrue(result['schema'])
        # The critique answers each carried item, and files the ones that stand, or it is not a critique of this packet.
        self.assertEqual(result['silent'][0], 'invalid')
        self.assertEqual(len(result['silent'][1]), 2)
        self.assertIn('F1 was open when the earlier lineage was retired and is not answered', result['silent'][1][0])
        self.assertEqual([result['half'][0], len(result['half'][1])], ['invalid', 1])
        self.assertIn('F2 was open when the earlier lineage was retired', result['half'][1][0])
        self.assertEqual(result['unfiled'][0], 'invalid')
        self.assertIn('F2 still stands, so it is an item of this pass', result['unfiled'][1][0])
        self.assertEqual(result['stranger'][0], 'invalid')
        self.assertIn('F3 is not among the carried items (F1, F2)', result['stranger'][1][0])
        self.assertEqual(result['done'], ['ready', 1])
        # Answered once, they are the new lineage's from here on.
        self.assertEqual(result['settled'], [[2, 'string']])

    def test_the_spine_packet_is_small_and_carries_the_request(self):
        # A fifty-page spine packet was 124 KB because every prompt repeated
        # the whole page listing. The spine critique reads a line a page.
        result = run_node('''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import { prepareStoryline } from './skills/professional-slides/runtime/storyline.mjs';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'spine-packet-'));
const pages = Array.from({ length: 50 }, (_, i) => ({ id: `p${String(i + 1).padStart(2, '0')}`, title: `Finding number ${i + 1} states what the evidence shows and what follows for the decision`,
  pageType: { type: 'trend', form: 'line', commentary: 'below', content: { claim: `Finding number ${i + 1}`, evidence: ['i-1'] } },
  exhibit: { type: 'chart.line', categories: ['2021', '2022', '2023', '2024', '2025', '2026'], series: [{ name: 'Subject', values: [1, 2, 3, 4, 5, 6] }, { name: 'Rival', values: [2, 3, 3, 4, 4, 5] }] },
  points: ['A long paragraph of commentary that the spine critique does not read, because it judges the argument and not the copy. '.repeat(4)] }));
const specPath = path.join(dir, 'big.deck.json');
await fs.writeFile(specPath, JSON.stringify({ id: 'big', workflow: 'new_deck', request: 'Who is better positioned in the short run and the long run?', answer: 'The subject leads on both horizons.', slides: pages }));
const noRequest = path.join(dir, 'bare.deck.json');
await fs.writeFile(noRequest, JSON.stringify({ id: 'bare', workflow: 'new_deck', answer: 'x', slides: pages.slice(0, 2) }));
const step = await prepareStoryline(specPath, path.join(dir, 'out'));
const prompt = await fs.readFile(path.join(step.dir, 'prompt.md'), 'utf8');
const refused = await prepareStoryline(noRequest, path.join(dir, 'out'));
await fs.rm(dir, { recursive: true, force: true }); await fs.rm(step.dir, { recursive: true, force: true });
console.log(JSON.stringify({ status: step.status, mode: step.mode, bytes: Buffer.byteLength(prompt), request: prompt.includes('Who is better positioned in the short run and the long run?'),
  commentary: prompt.includes('does not read'), refused }));
''')
        self.assertEqual([result['status'], result['mode']], ['packet-written', 'spine'])
        self.assertLess(result['bytes'], 20000)  # a line a page and the standard; the full listing ran to 124 KB
        self.assertTrue(result['request'])
        self.assertFalse(result['commentary'])
        self.assertEqual(result['refused']['status'], 'refused')
        self.assertTrue(any('request' in e for e in result['refused']['errors']))

    def test_a_missing_analysis_closes_as_unavailable_only_on_a_search_log(self):
        # Critics may not search the web, and used to have no way to close a
        # missing analysis the team searched for and could not find.
        result = run_node('''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'unavailable-'));
const out = path.join(dir, 'out'); await fs.mkdir(out);
const specPath = path.join(dir, 'm.deck.json');
const spec = (title) => ({ id: 'm', request: 'Is the subject winning its market?', answer: 'Yes, on growth.', slides: [{ id: 'p01', title }, { id: 'p02', title: 'Rivals grew more slowly on every measure' }] });
await fs.writeFile(specPath, JSON.stringify(spec('The subject grew fastest')));
const hash = async (dir) => JSON.parse(await fs.readFile(path.join(dir, 'packet.json'), 'utf8')).promptHash;
const one = await S.prepareStoryline(specPath, out);
const clean = (check) => ({ check, result: check === 'missing' ? 'findings' : 'clean', note: check === 'missing' ? 'Filed M1 for cohort retention.' : `Checked ${check} across the spine and found nothing.` });
const first = { pass: 1, verifies: null, verdict: 'revise', rating: 6, binding: S.storylineBinding(spec('The subject grew fastest')), summary: 'The growth call stands but retention would change it; run it.',
  compliance: { verdict: 'incomplete', note: 'An open item is still within reach of the team.' }, sufficiency: { verdict: 'insufficient', note: 'The answer outruns its evidence while the item is open.' },
  provenance: { backend: 'subagent', model: 'fixture', promptHash: await hash(one.dir) }, spine: 'The titles read as a growth story and build to the answer in order.',
  answer: 'The subject is winning on growth and must show retention to be winning overall.', answerParts: [{ part: 'Is the subject winning', verdict: 'answered', missingEvidence: '' }],
  pillars: [{ pillar: 'Growth', pages: ['p01', 'p02'], verdict: 'holds', overlap: 'A single pillar here.', strongestCounter: 'Growth bought with discounts.', reversal: 'Retention below peers.', answered: false }],
  numbers: 'The two pages print no shared figure.', sectionFlow: 'One section opens and closes in the order a reader follows.', execSummary: 'No summary page in this probe; the title carries the answer.',
  missingAnalyses: [{ id: 'M1', analysis: 'Cohort retention by vintage', why: 'Retention decides whether growth is winning.', data: 'Company filings cohort tables', public: 'known', remedy: 'retrieval', severity: 'major', ifUnfixed: 'The committee would back growth that retention may not support.' }],
  cutOrMerge: [], findings: [], topFixes: ['Run cohort retention'], completeness: S.STORYLINE_DIMENSIONS.map(clean) };
await fs.writeFile(path.join(out, 'storyline-review.json'), JSON.stringify(first));
await S.prepareStoryline(specPath, out);
await fs.writeFile(specPath, JSON.stringify(spec('The subject grew fastest of five rivals')));
await fs.mkdir(path.join(dir, 'sources'), { recursive: true });
await fs.writeFile(path.join(dir, 'sources', 'search-retention.md'), 'Searched filings, investor decks and press for cohort retention: none published.');
const two = await S.prepareStoryline(specPath, out);
const verify = (status) => ({ pass: 2, verifies: first.binding, verdict: 'ready', rating: 8, binding: S.storylineBinding(spec('The subject grew fastest of five rivals')), summary: 'The retention analysis was searched for and is not published anywhere.',
  compliance: { verdict: 'complete', note: 'Nothing the evidence in scope allows is left undone.' }, sufficiency: { verdict: 'sufficient', note: 'The evidence supports the answer as it is stated.' },
  provenance: { backend: 'subagent', model: 'fixture', promptHash: '' }, statuses: [{ finding: 'M1', evidence: 'The search log lists filings, decks and press with no cohort data.', ...status }], findings: [], topFixes: [] });
const answer = async (status) => { const review = verify(status); review.provenance.promptHash = await hash(two.dir); await fs.writeFile(path.join(out, 'storyline-review.json'), JSON.stringify(review)); return S.prepareStoryline(specPath, out); };
const noLog = await answer({ status: 'unavailable' });
const wrongLog = await answer({ status: 'unavailable', searchLog: 'sources/nothing-here.md' });
const logged = await answer({ status: 'unavailable', searchLog: 'sources/search-retention.md' });
await fs.rm(JSON.parse(await fs.readFile(path.join(dir, '.reviews', 'm', 'storyline-packet.json'), 'utf8')).staging, { recursive: true, force: true });
await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify({ noLog, wrongLog, logged: logged.status }));
''')
        self.assertEqual(result['noLog']['status'], 'invalid')
        self.assertTrue(any('searchLog' in e for e in result['noLog']['errors']), result['noLog'])
        self.assertTrue(any('not a file under' in e for e in result['wrongLog']['errors']), result['wrongLog'])
        self.assertEqual(result['logged'], 'ready')


if __name__ == '__main__':
    unittest.main()


class PassAllowanceTests(unittest.TestCase):
    def test_the_passes_the_user_allowed_at_the_outline_are_the_critiques_cap(self):
        """Hundred-page deck: a title narrowed after the self-check waited on the user's go-ahead for each pass past three."""
        result = run_node('''
import { passCap } from './skills/professional-slides/runtime/storyline.mjs';
import { deckKeyProblems } from './skills/professional-slides/runtime/deck-keys.mjs';
const granted = { max: 5, granted: 'Yes, allow two more passes', at: '2026-10-07' };
console.log(JSON.stringify({
  none: passCap({}), allowed: passCap({ storylinePasses: granted }), asked: passCap({ storylinePasses: granted }, 6), lower: passCap({ storylinePasses: { max: 4, granted: 'ok go' } }, 3),
  valid: deckKeyProblems({ storylinePasses: granted }),
  bare: deckKeyProblems({ storylinePasses: { max: 5 } }), many: deckKeyProblems({ storylinePasses: { max: 12, granted: 'as many as needed' } }),
}));
''')
        self.assertEqual([result["none"], result["allowed"], result["asked"], result["lower"]], [3, 5, 6, 4])
        self.assertEqual(result["valid"], [])
        self.assertTrue(result["bare"] and "the user's words" in result["bare"][0], result["bare"])
        self.assertTrue(result["many"], "an allowance past eight passes is refused")
