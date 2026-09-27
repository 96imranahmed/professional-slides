"""The review loop: an exhaustive first pass, convergent verification passes, and
the storyline critique ready before any deck review.

A first-pass review that sampled its pages ("e.g. p11, p16-p19") left the
author to find the rest, and every later review found some more - a loop with
no end. Pass one is now held to every page and every rubric dimension, and a
deck finding to every page it affects. Later passes give each open finding a
status and may add only serious, additive findings. Three passes at most; the
deck is accepted when nothing major is open across them. And the deck review
waits for a storyline critique that is ready for the spine as it stands.
"""
import unittest

from node_probe import run_node


FIXTURES = '''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import * as R from './skills/professional-slides/runtime/reviewer.mjs';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
const IDS = ['p01', 'p02', 'p03', 'p04', 'p05', 'p06'];
const RANK = ['none', 'minor', 'major', 'blocker'];
const checks = () => Object.fromEntries(R.PAGE_DIMENSIONS.map((d) => [d, `checked ${d} on the page`]));
const pageEntry = (slide, verdict = 'ok') => ({ slide, verdict, checks: checks() });
const finding = (o = {}) => ({ id: 'F1', scope: 'page', slides: ['p02'], dimension: 'chart', code: 'MISLEADING_TIME_AXIS', severity: 'major',
  reason: 'Monthly observations with gaps are drawn at equal spacing, steepening the growth.',
  repair: 'Replot the line on a true time axis so the gaps show as gaps.', checkable: null, ...o });
const worstOn = (findings, id) => findings.filter((f) => f.slides.includes(id) && f.severity !== 'none').map((f) => f.severity).sort((a, b) => RANK.indexOf(b) - RANK.indexOf(a))[0];
const density = { deck: 'No density profile was built for this fixture, so no medians are compared.', pages: [] };
function firstPass(findings = [], o = {}, ids = IDS) {
  return { pass: 1, verifies: null, accepted: !findings.some((f) => ['major', 'blocker'].includes(f.severity)),
    summary: 'The deck argues well; one chart misleads.', rating: 7, binding: 'a'.repeat(64),
    pages: ids.map((id) => pageEntry(id, worstOn(findings, id) ?? 'ok')), findings,
    completeness: R.DIMENSIONS.map((d) => findings.some((f) => f.dimension === d) ? { dimension: d, result: 'findings', note: 'Filed the findings above.' }
      : { dimension: d, result: 'clean', note: `Checked ${d} on every page and found nothing to raise.` }),
    assessment: Object.fromEntries(R.ASSESSMENT_KEYS.map((k) => [k, `A sentence about ${k}.`])), density, ...o };
}
function storyReady(spec, o = {}) {
  const ids = spec.slides.map((s) => s.id);
  return { pass: 1, verifies: null, verdict: 'ready', rating: 8, binding: S.storylineBinding(spec), summary: 'The answer is sharp and the pillars hold on the evidence shown.',
    spine: 'Read alone, the titles build from the market to the answer without a gap or a repeated step.',
    answer: 'The subject is growing faster than every rival on every measure that matters.',
    pillars: [{ pillar: 'Growth', pages: ids, verdict: 'holds', overlap: 'No overlap with any other pillar.', strongestCounter: 'The base is still small.', reversal: 'Growth below the peer median for two years.', answered: true }],
    pages: ids.map((id) => ({ page: id, verdict: 'ok', claim: 'a finding', shape: 'trend with its rate', sourcing: { status: 'n/a', insights: [], note: 'no log' }, restatement: 'moves on', consequence: 'states it' })),
    numbers: 'Every figure matches across the pages that print it.', sectionFlow: 'The sections open, develop and close in order.',
    execSummary: 'The summary states the answer the body proves.', missingAnalyses: [], cutOrMerge: [], findings: [], topFixes: ['None material'],
    completeness: S.STORYLINE_DIMENSIONS.map((check) => ({ check, result: 'clean', note: `Checked ${check} across the spine and found nothing to raise.` })), ...o };
}
const specOf = (ids = IDS, titles = {}) => ({ schema: 'professional-slides.deck/v3', id: 'fixture', brief: 'Which company is winning?', answer: 'The subject is.',
  slides: ids.map((id) => ({ id, title: titles[id] ?? `Title of ${id} states one finding` })) });
async function builtDeck(ids = IDS) {
  // The real path: delivery resolves its output directory, and the binding hashes the PPTX path relative to it.
  const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'review-passes-')));
  await fs.mkdir(path.join(dir, 'rendered'));
  await fs.writeFile(path.join(dir, 'scene.json'), JSON.stringify({ slides: ids.map((id) => ({ id, nodes: [{ type: 'text', role: 'action-title', text: `Title of ${id}` }], componentInstances: [] })) }));
  await fs.writeFile(path.join(dir, 'deck.pptx'), 'editable');
  await fs.writeFile(path.join(dir, 'build-result.json'), JSON.stringify({ status: 'built', gates: { passed: true }, pptxPath: path.join(dir, 'deck.pptx') }));
  for (const [i] of ids.entries()) await fs.writeFile(path.join(dir, 'rendered', `slide-${i + 1}.png`), `pixels ${i}`);
  await fs.writeFile(path.join(dir, 'claims.json'), JSON.stringify({ pageHashes: {}, findings: [] }));
  await fs.writeFile(path.join(dir, 'self-check.json'), JSON.stringify({ pages: {}, findings: {}, spine: 'Read the titles alone; no two pages prove the same proposition.' }));
  return dir;
}
'''


class FirstPassCoverageTests(unittest.TestCase):
    def test_a_first_pass_must_cover_every_page_and_list_every_affected_page(self):
        result = run_node(FIXTURES + '''
const errors = (review) => R.validateReview(review, IDS);
const missing = firstPass([finding()]); missing.pages = missing.pages.filter((p) => p.slide !== 'p05');
const deck = (reason, slides = ['p01', 'p03']) => finding({ id: 'F2', scope: 'deck', slides, dimension: 'layout', code: 'DEAD_SPACE', reason,
  repair: 'Enlarge the exhibit to fill the band on each page.' });
const wrongVerdict = firstPass([finding()]); wrongVerdict.pages[1].verdict = 'ok';
const incomplete = firstPass([]); incomplete.completeness = incomplete.completeness.slice(1);
const cleanButFound = firstPass([finding()]); cleanButFound.completeness.find((c) => c.dimension === 'chart').result = 'clean';
cleanButFound.completeness.find((c) => c.dimension === 'chart').note = 'Checked every chart for its axis, baseline and highlight.';
const unnoted = firstPass([]); delete unnoted.pages[0].checks.table;
const pageOnTwo = firstPass([finding({ slides: ['p02', 'p04'] })]);
console.log(JSON.stringify({
  ok: errors(firstPass([finding()])),
  missing: errors(missing),
  sampled: errors(firstPass([deck('Large empty bands under the exhibit, e.g. p01, p03.')])),
  etc: errors(firstPass([deck('Large empty bands on p01, p03 etc. under the exhibit.')])),
  unnamed: errors(firstPass([deck('Large empty bands on p01, p03 and p05 under the exhibit.')])),
  range: errors(firstPass([deck('Large empty bands across p01-p03 under the exhibit.', ['p01', 'p02', 'p03'])])),
  noPages: errors(firstPass([deck('Large empty bands under the exhibit.', [])])),
  wrongVerdict: errors(wrongVerdict), incomplete: errors(incomplete), cleanButFound: errors(cleanButFound), unnoted: errors(unnoted),
  pageOnTwo: errors(pageOnTwo), noCheckable: errors(firstPass([(({ checkable, ...f }) => f)(finding())])),
  accepted: errors(firstPass([finding()], { accepted: true })),
}));
''')
        self.assertEqual(result['ok'], [])
        self.assertTrue(any('p05' in e and 'missing' in e for e in result['missing']))
        self.assertTrue(any('by example' in e for e in result['sampled']))
        self.assertTrue(any('etc.' in e for e in result['etc']))
        self.assertTrue(any('p05' in e and 'leaves out' in e for e in result['unnamed']))
        self.assertEqual(result['range'], [])  # a range names p02, and the list carries it
        self.assertTrue(result['noPages'])
        self.assertTrue(any('verdict' in e for e in result['wrongVerdict']))
        self.assertTrue(any('completeness' in e and 'missing' in e for e in result['incomplete']))
        self.assertTrue(any('marked clean' in e for e in result['cleanButFound']))
        self.assertTrue(any('table' in e for e in result['unnoted']))
        self.assertTrue(any('deck finding' in e for e in result['pageOnTwo']))
        self.assertTrue(any('checkable is required' in e for e in result['noCheckable']))
        self.assertTrue(any('accepted cannot be true' in e for e in result['accepted']))

    def test_the_prompt_carries_the_rubric_and_the_page_list(self):
        result = run_node(FIXTURES + '''
const packet = { brief: 'b', answer: 'a', titles: ['1. [p01] T'], slides: [{ id: 'p01', index: 1, title: 'T', gateFindings: [], image: 'x.png', absent: ['table'] }],
  codes: R.CODES, schema: R.REVIEW_SCHEMA, statistics: {}, density: null, craft: [], montage: 'm.png', binding: 'f'.repeat(64) };
const prompt = R.reviewPrompt(packet);
console.log(JSON.stringify({ dims: R.DIMENSIONS.every((d) => prompt.includes(`- ${d} (`)), sev: ['blocker:', 'major:', 'minor:'].every((s) => prompt.includes(s)),
  every: prompt.includes('EVERY page'), sample: prompt.includes('"e.g."'), page: prompt.includes('[p01] page 1'), na: prompt.includes('n/a: table') }));
''')
        self.assertEqual(result, {'dims': True, 'sev': True, 'every': True, 'sample': True, 'page': True, 'na': True})


class VerificationPassTests(unittest.TestCase):
    PRIOR = FIXTURES + '''
const prior = { binding: 'b'.repeat(64), pass: 1, slideHashes: Object.fromEntries(IDS.map((id) => [id, 'h'])), review: firstPass([finding()]) };
const scope = R.verificationScope(prior, { ...prior.slideHashes, p04: 'changed' });
const status = (o = {}) => ({ finding: 'F1', status: 'fixed', evidence: 'The line now sits on a true time axis with the gaps visible.', ...o });
const verify = (o = {}) => ({ pass: 2, verifies: 'b'.repeat(64), accepted: true, summary: 'The repair held on the chart page.', rating: 8, binding: 'a'.repeat(64),
  pages: [pageEntry('p02'), pageEntry('p04')], statuses: [status()], findings: [], density, ...o });
const added = (o) => ({ ...finding({ id: 'F9', ...o }), basis: 'changed', justification: '', ...(o.basis ? { basis: o.basis } : {}), ...(o.justification ? { justification: o.justification } : {}) });
const check = (review) => R.validateReview(review, IDS, { scope, ledger: scope.ledger });
'''

    def test_a_later_pass_gives_every_open_finding_a_status_and_adds_only_what_is_additive(self):
        result = run_node(self.PRIOR + '''
const table = { dimension: 'table', code: 'UNFINISHED_TOTAL_ROW', reason: 'The rebuilt table ends with a Total label and a blank result row.', repair: 'Fill the total row with the column sums or cut the row.' };
console.log(JSON.stringify({
  scope: { pass: scope.pass, changed: scope.changed, must: scope.mustInspect, capped: scope.capped },
  good: check(verify()),
  noStatus: check(verify({ statuses: [] })),
  noEvidence: check(verify({ statuses: [status({ evidence: 'ok' })] })),
  minorUnchanged: check(verify({ findings: [added({ slides: ['p05'], severity: 'minor', dimension: 'text', code: 'LONG_LABEL', reason: 'The label wording runs long for its box.', repair: 'Shorten the label to the product name only.' })] })),
  majorChanged: check(verify({ accepted: false, pages: [pageEntry('p02'), pageEntry('p04', 'major')], findings: [added({ slides: ['p04'], ...table })] })),
  majorUnchanged: check(verify({ accepted: false, findings: [added({ slides: ['p05'], ...table })] })),
  missedMajor: check(verify({ accepted: false, findings: [added({ slides: ['p05'], ...table, basis: 'missed', justification: 'The first pass read an older render in which the table sat behind the legend and the row was hidden.' })] })),
  missedBlocker: check(verify({ accepted: false, findings: [added({ slides: ['p05'], ...table, severity: 'blocker', basis: 'missed', justification: 'The first pass read an older render in which the table sat behind the legend and the row was hidden.' })] })),
  repeat: check(verify({ accepted: false, pages: [pageEntry('p02', 'major'), pageEntry('p04')], statuses: [status({ status: 'not fixed', evidence: 'The months are still drawn at equal spacing on the axis.' })],
    findings: [added({ id: 'F9', slides: ['p02'] })] })),
  reusedId: check(verify({ accepted: false, pages: [pageEntry('p02'), pageEntry('p04', 'major')], findings: [added({ id: 'F1', slides: ['p04'], ...table })] })),
  wrongPass: check(verify({ pass: 3 })), wrongLineage: check(verify({ verifies: 'c'.repeat(64) })),
  unread: check(verify({ pages: [pageEntry('p02')] })),
}));
''')
        self.assertEqual(result['scope'], {'pass': 2, 'changed': ['p04'], 'must': ['p02', 'p04'], 'capped': False})
        self.assertEqual(result['good'], [])
        self.assertTrue(any('missing F1' in e for e in result['noStatus']))
        self.assertTrue(any('evidence' in e for e in result['noEvidence']))
        self.assertTrue(any('not additive' in e for e in result['minorUnchanged']))
        self.assertEqual(result['majorChanged'], [])
        self.assertTrue(any('did not change' in e for e in result['majorUnchanged']))
        self.assertTrue(any('only a blocker' in e for e in result['missedMajor']))
        self.assertEqual(result['missedBlocker'], [])
        self.assertTrue(any('already F1' in e for e in result['repeat']))
        self.assertTrue(any('already in the ledger' in e for e in result['reusedId']))
        self.assertTrue(any('pass must be 2' in e for e in result['wrongPass']))
        self.assertTrue(any('verifies' in e for e in result['wrongLineage']))
        self.assertTrue(any('p04' in e for e in result['unread']))

    def test_acceptance_is_read_off_every_pass_and_the_loop_is_capped(self):
        result = run_node(self.PRIOR + '''
const notFixed = verify({ accepted: false, pages: [pageEntry('p02', 'major'), pageEntry('p04')], statuses: [status({ status: 'not fixed', evidence: 'The months are still drawn at equal spacing on the axis.' })] });
const partly = verify({ pages: [pageEntry('p02', 'minor'), pageEntry('p04')], statuses: [status({ status: 'partly fixed', severity: 'minor', evidence: 'The axis is true to time; one gap is still unlabelled.' })] });
const at = (pass) => R.verificationScope({ ...prior, pass }, { ...prior.slideHashes, p04: 'changed' });
console.log(JSON.stringify({
  fixed: R.reviewOutcome(verify(), scope.ledger).accepted,
  notFixed: R.reviewOutcome(notFixed, scope.ledger), notFixedValid: check(notFixed),
  partly: R.reviewOutcome(partly, scope.ledger).accepted, partlyValid: check(partly),
  third: at(2).capped, fourth: at(3).capped, fourthPass: at(3).pass, custom: R.verificationScope({ ...prior, pass: 3 }, prior.slideHashes, { maxPasses: 4 }).capped,
}));
''')
        self.assertTrue(result['fixed'])
        self.assertFalse(result['notFixed']['accepted'])
        self.assertEqual([b['id'] for b in result['notFixed']['blocking']], ['F1'])
        self.assertEqual(result['notFixedValid'], [])
        self.assertTrue(result['partly'])
        self.assertEqual(result['partlyValid'], [])
        self.assertFalse(result['third'])
        self.assertTrue(result['fourth'])
        self.assertEqual(result['fourthPass'], 4)
        self.assertFalse(result['custom'])


class SectionMergeTests(unittest.TestCase):
    def test_parallel_section_reviews_merge_into_one_first_pass(self):
        result = run_node(FIXTURES + '''
const dead = (id, slides) => finding({ id, scope: 'deck', slides, dimension: 'layout', code: 'DEAD_SPACE', reason: `Large empty bands under the exhibit on ${slides.join(', ')}.`, repair: 'Enlarge the exhibit to fill the band on each page.' });
const section = (id, slides, findings) => ({ part: { kind: 'section', id, slides }, binding: 'a'.repeat(64), accepted: false, summary: 'The section reads well apart from its bands.', rating: 7,
  pages: slides.map((s) => pageEntry(s, worstOn(findings, s) ?? 'ok')), findings,
  completeness: R.PAGE_DIMENSIONS.map((d) => findings.some((f) => f.dimension === d) ? { dimension: d, result: 'findings', note: 'Filed above.' } : { dimension: d, result: 'clean', note: `Checked ${d} on each page of the section; nothing to raise.` }) });
const s1 = section('s1', ['p01', 'p02', 'p03'], [dead('F1', ['p01', 'p03'])]);
const s2 = section('s2', ['p04', 'p05', 'p06'], [dead('F1', ['p05']), finding({ id: 'F2', slides: ['p04'], severity: 'minor', reason: 'The axis title repeats the chart heading word for word.', repair: 'Cut the axis title and keep the unit in the heading.' })]);
const spine = { part: { kind: 'spine', id: 'spine', slides: IDS }, binding: 'a'.repeat(64), accepted: false, summary: 'Sound argument; repeated tables and empty bands.', rating: 6, pages: [],
  findings: [finding({ id: 'F1', scope: 'deck', slides: ['p02', 'p05'], dimension: 'consistency', code: 'TABLE_MONOTONY', reason: 'The same dark first-column table carries p02 and p05.', repair: 'Redraw p05 as a ranked bar so the pair reads differently.' })],
  completeness: R.DECK_DIMENSIONS.map((d) => d === 'consistency' ? { dimension: d, result: 'findings', note: 'Filed above.' } : { dimension: d, result: 'clean', note: `Checked ${d} across the whole sequence; nothing to raise.` }),
  assessment: Object.fromEntries(R.ASSESSMENT_KEYS.map((k) => [k, `A sentence about ${k}.`])), density };
const { review, errors } = R.mergeReviewParts([s1, s2, spine], IDS);
const gap = R.mergeReviewParts([s1, spine], IDS);
const short = R.mergeReviewParts([{ ...s1, pages: s1.pages.slice(0, 2) }, s2, spine], IDS);
const sections = R.reviewSections({ slides: Array.from({ length: 40 }, (_, i) => ({ id: `q${i + 1}`, nodes: i % 10 === 0 && i ? [{ type: 'text', role: 'divider', text: `Section ${i / 10}` }] : [{ type: 'text', role: 'action-title', text: 'T' }], componentInstances: [] })) });
console.log(JSON.stringify({ errors, valid: R.validateReview(review, IDS), ids: review.findings.map((f) => f.id),
  dead: review.findings.filter((f) => f.code === 'DEAD_SPACE').map((f) => f.slides), verdicts: Object.fromEntries(review.pages.map((p) => [p.slide, p.verdict])),
  rating: review.rating, from: review.mergedFrom, gap: gap.errors, short: short.errors,
  sections: sections.map((s) => s.slides.length), covered: sections.flatMap((s) => s.slides).length }));
''')
        self.assertEqual(result['errors'], [])
        self.assertEqual(result['valid'], [])
        self.assertEqual(len(set(result['ids'])), len(result['ids']))
        # The same recurring defect seen from two sections is one finding over all its pages.
        self.assertEqual(result['dead'], [['p01', 'p03', 'p05']])
        # The spine's finding raises p02, which its section reviewer passed.
        self.assertEqual(result['verdicts']['p02'], 'major')
        self.assertEqual(result['verdicts']['p04'], 'minor')
        self.assertEqual(result['verdicts']['p06'], 'ok')
        self.assertEqual(result['rating'], 6)
        self.assertEqual(result['from'], ['s1', 's2', 'spine'])
        self.assertTrue(any('p04' in e for e in result['gap']))
        self.assertTrue(any('p03' in e for e in result['short']))
        self.assertEqual(result['covered'], 40)
        self.assertTrue(all(n <= 14 for n in result['sections']))


class StorylineBeforeDeckReviewTests(unittest.TestCase):
    def test_the_deck_review_packet_waits_for_a_ready_storyline_on_the_current_spine(self):
        result = run_node(FIXTURES + '''
const dir = await builtDeck();
const spec = specOf();
const specPath = path.join(dir, 'fixture.deck.json');
await fs.writeFile(specPath, JSON.stringify(spec));
const attempt = async (s) => { try { await R.buildReviewPacket({ outputDirectory: dir, spec: s }); return 'written'; } catch (e) { return e.message; } };
const none = await attempt(spec);
await S.buildStorylinePacket(specPath, dir);
await fs.writeFile(path.join(dir, 'storyline-review.json'), JSON.stringify(storyReady(spec, { verdict: 'revise', topFixes: ['Show the whole peer set'] })));
const revise = await attempt(spec);
await fs.writeFile(path.join(dir, 'storyline-review.json'), JSON.stringify(storyReady(spec)));
const ready = await attempt(spec);
const prompt = await fs.readFile(path.join(dir, 'review-packet', 'prompt.md'), 'utf8').then(() => true, () => false);
const retitled = specOf(IDS, { p03: 'A different claim now stands on page three' });
const changed = await attempt(retitled);
const deliver = (await import('./skills/professional-slides/runtime/deliver-deck.mjs')).deliverDeck;
await fs.writeFile(specPath, JSON.stringify(retitled));
const refused = await deliver(specPath, dir, { skipBuild: true, reviewFile: path.join(dir, 'nothing.json') });
await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify({ none, revise, ready, prompt, changed, refusedAt: refused.rejectedAt, reason: refused.blockers[0].reason }));
''')
        self.assertIn('storyline-review.json is missing', result['none'])
        self.assertIn('says revise', result['revise'])
        self.assertEqual(result['ready'], 'written')
        self.assertTrue(result['prompt'])
        self.assertIn('re-run the storyline critique first', result['changed'])
        self.assertIn('p03', result['changed'])
        # Delivery refuses a supplied deck review the same way, before reading it.
        self.assertEqual(result['refusedAt'], 'storyline')
        self.assertIn('re-run the storyline critique first', result['reason'])

    def test_delivery_enforces_the_pass_cap_and_the_ledger(self):
        result = run_node(FIXTURES + '''
const dir = await builtDeck();
const spec = specOf();
const specPath = path.join(dir, 'fixture.deck.json');
await fs.writeFile(specPath, JSON.stringify(spec));
await fs.writeFile(path.join(dir, 'storyline-review.json'), JSON.stringify(storyReady(spec)));
const { deliverDeck } = await import('./skills/professional-slides/runtime/deliver-deck.mjs');
const binding = await R.reviewBinding(dir);
const write = async (name, review) => { const file = path.join(dir, name); await fs.writeFile(file, JSON.stringify(review)); return file; };
const first = await deliverDeck(specPath, dir, { skipBuild: true, reviewFile: await write('r1.json', firstPass([finding()], { binding })) });
const capped = await deliverDeck(specPath, dir, { skipBuild: true, maxPasses: 1, reviewFile: await write('r2.json', {}) });
const second = await deliverDeck(specPath, dir, { skipBuild: true, reviewFile: await write('r3.json', { pass: 2, verifies: binding, accepted: true, summary: 'The repair held on the chart page.', rating: 8, binding,
  pages: [pageEntry('p02')], statuses: [{ finding: 'F1', status: 'fixed', evidence: 'The line now sits on a true time axis with the gaps visible.' }], findings: [], density }) });
const history = (await fs.readdir(path.join(dir, 'review-history'))).filter((f) => f.startsWith('review-')).sort();
const last = JSON.parse(await fs.readFile(path.join(dir, 'review-history', history.at(-1)), 'utf8'));
await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify({ first: [first.accepted, first.rejectedAt], capped: [capped.rejectedAt, capped.blockers[0].code], second: [second.accepted, second.review.pass],
  lineage: [last.pass, last.verifies === binding], ledger: last.ledger.map((e) => [e.id, e.status]) }));
''')
        self.assertEqual(result['first'], [False, 'review pass 1 of 3'])
        self.assertEqual(result['capped'], ['review cap', 'REVIEW_PASS_CAP'])
        self.assertEqual(result['second'], [True, 2])
        self.assertEqual(result['lineage'], [2, True])
        self.assertEqual(result['ledger'], [['F1', 'fixed']])


class StorylinePassTests(unittest.TestCase):
    def test_a_first_critique_covers_every_page_without_sampling(self):
        result = run_node(FIXTURES + '''
const spec = specOf(['p01', 'p02', 'p03']);
const missing = storyReady(spec); missing.pages = missing.pages.slice(0, 2);
const sampled = storyReady(spec, { verdict: 'revise', findings: [{ id: 'F1', scope: 'spine', pages: ['p01'], check: 'claim', severity: 'major', problem: 'Several titles report counts, e.g. p01 and p02, without an implication.', fix: 'Rewrite each title as the finding the count supports.' }] });
sampled.pages[0].verdict = 'major';
const unsupported = storyReady(spec); unsupported.pages[1].sourcing = { status: 'unsupported', insights: [], note: 'no insight carries the claim' };
const readyWithMajor = storyReady(spec, { findings: [{ id: 'F1', scope: 'page', pages: ['p02'], check: 'shape', severity: 'major', problem: 'A two-number chart carries a ranking claim.', fix: 'Plot the whole peer set ranked on the same basis.' }] });
readyWithMajor.pages[1].verdict = 'major'; readyWithMajor.completeness.find((c) => c.check === 'shape').result = 'findings';
console.log(JSON.stringify({ ok: S.validateStorylineReview(storyReady(spec), spec), missing: S.validateStorylineReview(missing, spec),
  sampled: S.validateStorylineReview(sampled, spec), unsupported: S.validateStorylineReview(unsupported, spec), readyWithMajor: S.validateStorylineReview(readyWithMajor, spec) }));
''')
        self.assertEqual(result['ok'], [])
        self.assertTrue(any('p03' in e for e in result['missing']))
        self.assertTrue(any('by example' in e for e in result['sampled']))
        self.assertTrue(any('unsupported claim' in e for e in result['unsupported']))
        self.assertTrue(any('verdict is ready while F1' in e for e in result['readyWithMajor']))

    def test_the_storyline_loop_verifies_changed_pages_and_converges(self):
        result = run_node(FIXTURES + '''
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'storyline-passes-'));
const specPath = path.join(dir, 'fixture.deck.json'), out = path.join(dir, 'out');
await fs.mkdir(out);
const ids = ['p01', 'p02', 'p03', 'p04'];
await fs.writeFile(specPath, JSON.stringify(specOf(ids)));
const one = await S.prepareStoryline(specPath, out);
const weak = { id: 'F1', scope: 'page', pages: ['p02'], check: 'claim', severity: 'major', problem: 'The title reports a count without an implication.', fix: 'Rewrite the title as the finding the count supports.' };
const critique = storyReady(specOf(ids), { verdict: 'revise', findings: [weak] });
critique.pages[1].verdict = 'major'; critique.completeness.find((c) => c.check === 'claim').result = 'findings';
await fs.writeFile(path.join(out, 'storyline-review.json'), JSON.stringify(critique));
const revise = await S.prepareStoryline(specPath, out);
const revised = specOf(ids, { p02: 'The subject added routes twice as fast as its nearest rival' });
await fs.writeFile(specPath, JSON.stringify(revised));
const two = await S.prepareStoryline(specPath, out);
const packet = JSON.parse(await fs.readFile(path.join(out, 'storyline-review', 'packet.json'), 'utf8'));
const entry = (page, verdict = 'ok') => ({ page, verdict, claim: 'a finding now', shape: 'trend with its rate', sourcing: { status: 'n/a', insights: [], note: 'no log' }, restatement: 'moves on', consequence: 'states it' });
const verification = (o = {}) => ({ pass: 2, verifies: critique.binding, verdict: 'ready', rating: 8, binding: S.storylineBinding(revised), summary: 'The rewritten title now states the finding the count supports.',
  pages: [entry('p02')], statuses: [{ finding: 'F1', status: 'fixed', evidence: 'The title now states the rate against the nearest rival.' }], findings: [], topFixes: [], ...o });
await fs.writeFile(path.join(out, 'storyline-review.json'), JSON.stringify(verification({ findings: [{ id: 'F2', scope: 'page', pages: ['p04'], check: 'consequence', severity: 'minor', problem: 'The page could say more about what follows.', fix: 'Add the consequence for the decision in one line.', basis: 'changed', justification: '' }] })));
const nit = await S.prepareStoryline(specPath, out);
await fs.writeFile(path.join(out, 'storyline-review.json'), JSON.stringify(verification()));
const ready = await S.prepareStoryline(specPath, out);
const gate = await S.storylineGate(revised, out);
const moved = await S.storylineGate(specOf(ids, { p02: 'The subject added routes twice as fast as its nearest rival', p03: 'A new claim' }), out);
const capped = S.storylineScope({ pass: 3, binding: 'b'.repeat(64), pageHashes: S.storylinePageHashes(revised), review: critique, ledger: [] }, { ...S.storylinePageHashes(revised), p03: 'x' }, ids);
await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify({ one: [one.status, one.pass], revise: revise.status, two: [two.status, two.pass], scope: [packet.scope.changed, packet.scope.mustInspect],
  nit: [nit.status, nit.errors?.some((e) => e.includes('not additive'))], ready: ready.status, gate, moved, capped: capped.capped }));
''')
        self.assertEqual(result['one'], ['packet-written', 1])
        self.assertEqual(result['revise'], 'revise')  # the spine has not changed since the critique
        self.assertEqual(result['two'], ['packet-written', 2])
        self.assertEqual(result['scope'], [['p02'], ['p02']])
        self.assertEqual(result['nit'], ['invalid', True])
        self.assertEqual(result['ready'], 'ready')
        self.assertEqual(result['gate'], [])
        self.assertTrue(any('p03' in e and 're-run the storyline critique first' in e for e in result['moved']))
        self.assertTrue(result['capped'])


if __name__ == '__main__':
    unittest.main()
