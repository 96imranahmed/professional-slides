"""The storyline critique: bound to the story's structure, fed the insight log.

A critique is only worth its verdict for the storyline it read. Rewording a
page keeps it; changing what a page argues or shows asks for a new one. The
insight log travels with the packet so the critic can see whether the titles
were written from findings.
"""
import unittest

from node_probe import run_node


class StorylineTests(unittest.TestCase):
    def test_binding_follows_structure_not_wording(self):
        result = run_node('''
import { storylineBinding, validateStorylineReview, checkInsights, describeExhibit, STORYLINE_DIMENSIONS } from './skills/professional-slides/runtime/storyline.mjs';
const spec = { slides: [{ id: 'a', title: 'Riyadh Air opened 14 destinations in 16 weeks', exhibit: { type: 'chart.line', categories: ['M1','M2','M3','M4','M5'], series: [{ name: 'Destinations', values: [1,3,6,10,14] }] }, points: ['A sentence.'] }] };
const reworded = structuredClone(spec); reworded.slides[0].points = ['A different sentence.'];
const retitled = structuredClone(spec); retitled.slides[0].title = 'Riyadh Air has 14 destinations';
const binding = storylineBinding(spec);
const ready = { pass: 1, verifies: null, verdict: 'ready', binding, rating: 8, summary: 'The answer is sharp and the pillars hold on the evidence shown.',
  spine: 'Read alone, the one title states the finding the whole storyline rests on, with its rate.', answer: 'Riyadh Air is opening destinations faster than any recent Gulf entrant did.',
  answerParts: [{ part: 'Is Riyadh Air up and coming', verdict: 'answered', missingEvidence: '' }],
  pillars: [{ pillar: 'Speed', pages: ['a'], verdict: 'holds', overlap: 'A single pillar; nothing overlaps.', strongestCounter: 'Small base', reversal: 'The ramp stalls below ten routes a quarter.', answered: true }],
  pages: [{ page: 'a', verdict: 'ok', claim: 'a rate, not a count', shape: 'a monthly series', sourcing: { status: 'n/a', insights: [], note: 'no insight log in this probe' }, restatement: 'first page', consequence: 'states the pace' }],
  numbers: 'One figure, printed once; nothing to reconcile.', sectionFlow: 'A single page; there are no sections to order.', execSummary: 'The title is the summary and states the answer.',
  missingAnalyses: [], cutOrMerge: [], findings: [], topFixes: ['None material'],
  completeness: STORYLINE_DIMENSIONS.map((check) => ({ check, result: 'clean', note: `Checked ${check} on this one-page storyline; nothing to raise.` })) };
const revalued = structuredClone(spec); revalued.slides[0].exhibit.series[0].values = [14, 10, 6, 3, 1];
console.log(JSON.stringify({
  same: storylineBinding(reworded) === binding, changed: storylineBinding(retitled) !== binding,
  ok: validateStorylineReview(ready, reworded), stale: validateStorylineReview(ready, retitled).length,
  revise: validateStorylineReview({ ...ready, verdict: 'revise' }, spec).length, missing: validateStorylineReview(null, spec).length,
  bare: validateStorylineReview({ verdict: 'ready', binding }, spec), revalued: storylineBinding(revalued) !== binding,
  twoNumber: describeExhibit({ type: 'chart.column', categories: ['A', 'B'], series: [{ name: 'x', values: [1, 2] }] }),
  plainTable: describeExhibit({ type: 'table', columns: ['Airline', 'Note'], rows: [['A', 'words'], ['B', 'more words']] }),
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
        self.assertEqual(result['missing'], 1)
        self.assertTrue(any('summary' in e for e in result['bare']))  # a verdict alone is not a critique
        self.assertTrue(result['revalued'])  # a trend that reverses is a different story
        self.assertIn('TWO-NUMBER', result['twoNumber'])
        self.assertIn('PLAIN GRID', result['plainTable'])
        self.assertIn('0 of 4 cells carry a number', result['plainTable'])
        self.assertEqual(len(result['insights']), 2)  # i2: no calculation, and its source is missing
        # Graded as the authoring compile grades them (one definition: storyline.mjs insightGradeProblems).
        self.assertTrue(any('strength' in p for p in result['ungraded']) and any('soWhat' in p for p in result['ungraded']))
        self.assertTrue(any('PILLAR_UNSUPPORTED' in p and 'Demand' in p for p in result['pillar']))
        self.assertTrue(any('shape' in p for p in result['unshaped']))  # the data's shape decides the pages it can carry
        self.assertIn('no insight log', result['none'][0])


    def test_the_gate_binds_the_spine_not_the_copy(self):
        # Every copy fix after the deck review used to force a new critique:
        # the binding held every exhibit row, item and point. It now holds the
        # spine - titles, each page's claim and what settles it, page and
        # exhibit types, the plotted numbers - and the request and answer.
        result = run_node('''
import { storylineBinding } from './skills/professional-slides/runtime/storyline.mjs';
const page = (o = {}) => ({ id: 'p03', title: 'Enterprise spend shifted toward the subject before the funding surge',
  pageType: { type: 'trend', form: 'column', content: { claim: 'Enterprise spend shifted toward the subject', settles: { kind: 'qualitative', what: 'survey snapshots' } } },
  exhibit: { type: 'chart.column', categories: ['2023', '2024', '2025'], series: [{ name: 'Subject', values: [12, 24, 40] }], caption: 'Categorical snapshots.' },
  points: ['A sentence of commentary.'], ...o });
const table = { id: 'p04', title: 'Terms differ by counterparty', exhibit: { type: 'table', columns: ['Party', 'Term'], rows: [['A', 'Five years'], ['B', { text: '7 yrs', value: 7 }]] } };
const spec = (o = {}, t = table, deck = {}) => ({ id: 'deck', request: 'Who is better positioned, and why?', answer: 'The subject leads enterprise spend.', slides: [page(o), t], ...deck });
const base = storylineBinding(spec());
const same = (s) => storylineBinding(s) === base;
console.log(JSON.stringify({
  commentary: same(spec({ points: ['A rewritten sentence of commentary with a new number, 41%.'] })),
  caption: same(spec({ exhibit: { ...page().exhibit, caption: 'Survey snapshots at unequal intervals.' } })),
  cellText: same(spec({}, { ...table, exhibit: { ...table.exhibit, rows: [['A', 'Five-year term'], ['B', { text: '7 years', value: 7 }]] } })),
  categoryLabel: same(spec({ exhibit: { ...page().exhibit, categories: ['FY23', 'FY24', 'FY25'] } })),
  title: same(spec({ title: 'A different finding' })),
  claim: same(spec({ pageType: { ...page().pageType, content: { ...page().pageType.content, claim: 'Spend moved away from the subject' } } })),
  pageType: same(spec({ pageType: { ...page().pageType, form: 'line' } })),
  exhibitType: same(spec({ exhibit: { ...page().exhibit, type: 'chart.bar' } })),
  values: same(spec({ exhibit: { ...page().exhibit, series: [{ name: 'Subject', values: [40, 24, 12] }] } })),
  cellValue: same(spec({}, { ...table, exhibit: { ...table.exhibit, rows: [['A', 'Five years'], ['B', { text: '9 yrs', value: 9 }]] } })),
  request: same(spec({}, table, { request: 'Which company should an investor back?' })),
  answer: same(spec({}, table, { answer: 'Neither can be ranked.' })),
}));
''')
        for kept in ['commentary', 'caption', 'cellText', 'categoryLabel']:
            self.assertTrue(result[kept], kept)
        for moved in ['title', 'claim', 'pageType', 'exhibitType', 'values', 'cellValue', 'request', 'answer']:
            self.assertFalse(result[moved], moved)

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
  provenance: { backend: 'subagent', model: 'fixture', promptHash: await hash(one.dir) }, spine: 'The titles read as a growth story and build to the answer in order.',
  answer: 'The subject is winning on growth and must show retention to be winning overall.', answerParts: [{ part: 'Is the subject winning', verdict: 'answered', missingEvidence: '' }],
  pillars: [{ pillar: 'Growth', pages: ['p01', 'p02'], verdict: 'holds', overlap: 'A single pillar here.', strongestCounter: 'Growth bought with discounts.', reversal: 'Retention below peers.', answered: false }],
  numbers: 'The two pages print no shared figure.', sectionFlow: 'One section opens and closes in the order a reader follows.', execSummary: 'No summary page in this probe; the title carries the answer.',
  missingAnalyses: [{ id: 'M1', analysis: 'Cohort retention by vintage', why: 'Retention decides whether growth is winning.', data: 'Company filings cohort tables', public: 'known', severity: 'major' }],
  cutOrMerge: [], findings: [], topFixes: ['Run cohort retention'], completeness: S.STORYLINE_DIMENSIONS.map(clean) };
await fs.writeFile(path.join(out, 'storyline-review.json'), JSON.stringify(first));
await S.prepareStoryline(specPath, out);
await fs.writeFile(specPath, JSON.stringify(spec('The subject grew fastest of five carriers')));
await fs.mkdir(path.join(dir, 'sources'), { recursive: true });
await fs.writeFile(path.join(dir, 'sources', 'search-retention.md'), 'Searched filings, investor decks and press for cohort retention: none published.');
const two = await S.prepareStoryline(specPath, out);
const verify = (status) => ({ pass: 2, verifies: first.binding, verdict: 'ready', rating: 8, binding: S.storylineBinding(spec('The subject grew fastest of five carriers')), summary: 'The retention analysis was searched for and is not published anywhere.',
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
