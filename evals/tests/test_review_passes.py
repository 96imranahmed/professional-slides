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
import * as P from './skills/professional-slides/runtime/review-passes.mjs';
const IDS = ['p01', 'p02', 'p03', 'p04', 'p05', 'p06'];
const RANK = ['none', 'minor', 'major', 'blocker'];
const checks = () => Object.fromEntries(R.PAGE_DIMENSIONS.map((d) => [d, `checked ${d} on the page`]));
const pageEntry = (slide, verdict = 'ok') => ({ slide, verdict, checks: checks() });
const finding = (o = {}) => ({ id: 'F1', scope: 'page', slides: ['p02'], dimension: 'chart', code: 'MISLEADING_TIME_AXIS', severity: 'major',
  reason: 'Monthly observations with gaps are drawn at equal spacing, steepening the growth.',
  repair: 'Replot the line on a true time axis so the gaps show as gaps.', checkable: null, ...o });
const worstOn = (findings, id) => findings.filter((f) => f.slides.includes(id) && f.severity !== 'none').map((f) => f.severity).sort((a, b) => RANK.indexOf(b) - RANK.indexOf(a))[0];
const density = { deck: 'No density profile was built for this fixture, so no medians are compared.', pages: [] };
const prov = (promptHash = 'd'.repeat(64)) => ({ backend: 'subagent', model: 'fixture-model', promptHash });
const blocks = (findings) => findings.some((f) => ['major', 'blocker'].includes(f.severity));
function firstPass(findings = [], o = {}, ids = IDS) {
  return { pass: 1, verifies: null, accepted: !blocks(findings),
    summary: 'The deck argues well; one chart misleads.', rating: blocks(findings) ? 7 : 8.5, binding: 'a'.repeat(64), opened: [...ids], provenance: prov(),
    pages: ids.map((id) => pageEntry(id, worstOn(findings, id) ?? 'ok')), findings,
    completeness: R.DIMENSIONS.map((d) => findings.some((f) => f.dimension === d) ? { dimension: d, result: 'findings', note: 'Filed the findings above.' }
      : { dimension: d, result: 'clean', note: `Checked ${d} on every page and found nothing to raise.` }),
    assessment: Object.fromEntries(R.ASSESSMENT_KEYS.map((k) => [k, `A sentence about ${k}.`])), density, ...o };
}
// The spine critique (the default); storyFull adds the page-level entries of --full.
function storyReady(spec, o = {}) {
  const ids = spec.slides.map((s) => s.id);
  return { pass: 1, verifies: null, verdict: 'ready', rating: 8, binding: S.storylineBinding(spec), summary: 'The answer is sharp and the pillars hold on the evidence shown.',
    spine: 'Read alone, the titles build from the market to the answer without a gap or a repeated step.',
    answer: 'The subject is growing faster than every rival on every measure that matters.',
    answerParts: [{ part: 'Which company is winning', verdict: 'answered', missingEvidence: '' }],
    pillars: [{ pillar: 'Growth', pages: ids, verdict: 'holds', overlap: 'No overlap with any other pillar.', strongestCounter: 'The base is still small.', reversal: 'Growth below the peer median for two years.', answered: true }],
    numbers: 'Every figure matches across the pages that print it.', sectionFlow: 'The sections open, develop and close in order.',
    execSummary: 'The summary states the answer the body proves.', missingAnalyses: [], cutOrMerge: [], findings: [], topFixes: ['None material'],
    completeness: S.STORYLINE_DIMENSIONS.map((check) => ({ check, result: 'clean', note: `Checked ${check} across the spine and found nothing to raise.` })),
    // The two judgements and the rating follow the verdict, as a critic's would.
    ...(o.verdict === 'revise' ? { rating: 6, compliance: { verdict: 'incomplete', note: 'An open item is still within reach of the team.' }, sufficiency: { verdict: 'insufficient', note: 'The answer outruns its evidence while the item is open.' } } : { compliance: { verdict: 'complete', note: 'Nothing the evidence in scope allows is left undone.' }, sufficiency: { verdict: 'sufficient', note: 'The evidence supports the answer as it is stated.' } }), ...o };
}
const storyFull = (spec, o = {}) => storyReady(spec, { pages: spec.slides.map((s) => ({ page: s.id, verdict: 'ok', claim: 'a finding', shape: 'trend with its rate', sourcing: { status: 'n/a', insights: [], note: 'no log' }, restatement: 'moves on', consequence: 'states it' })), ...o });
const specOf = (ids = IDS, titles = {}) => ({ schema: 'professional-slides.deck/v3', id: 'fixture', request: 'Which company is winning this market, and why?', answer: 'The subject is.',
  slides: ids.map((id) => ({ id, title: titles[id] ?? `Title of ${id} states one finding` })) });
// The hash of the packet a critique or review answers, read from the staged packet.
const hashOf = async (staging) => JSON.parse(await fs.readFile(path.join(staging, 'packet.json'), 'utf8')).promptHash;
// A fixture folder and the staging folders its lineage stores point at.
async function cleanup(dir) {
  for (const deck of await fs.readdir(path.join(dir, '.reviews')).catch(() => [])) for (const file of ['review-packet.json', 'storyline-packet.json']) {
    const staging = await fs.readFile(path.join(dir, '.reviews', deck, file), 'utf8').then((t) => JSON.parse(t).staging, () => null);
    if (staging) await fs.rm(staging, { recursive: true, force: true });
  }
  await fs.rm(dir, { recursive: true, force: true });
}
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
  rebuttal: errors(firstPass([finding()], { authorResponse: 'F1 is a stylistic preference; the axis is fine.' })),
  unopened: errors(firstPass([finding()], { opened: ['p02'] })),
  lowAndClean: errors(firstPass([], { rating: 7.5 })),
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
        # A field the schema does not name - an author's rebuttal - is not part of a review.
        self.assertTrue(any('authorResponse' in e for e in result['rebuttal']))
        # `opened` is what the reader looked at, and a first pass opens every page.
        self.assertTrue(any('opened' in e and 'p01' in e for e in result['unopened']))
        # A rating under the bar with nothing major open leaves the author nothing to repair.
        self.assertTrue(any('below the acceptance bar' in e for e in result['lowAndClean']))

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
const prior = { binding: 'b'.repeat(64), pass: 1, pageHashes: Object.fromEntries(IDS.map((id) => [id, 'h'])), review: firstPass([finding()]) };
const scope = R.verificationScope(prior, { ...prior.pageHashes, p04: 'changed' });
const status = (o = {}) => ({ finding: 'F1', status: 'fixed', evidence: 'The line now sits on a true time axis with the gaps visible.', ...o });
const verify = (o = {}) => ({ pass: 2, verifies: 'b'.repeat(64), accepted: true, summary: 'The repair held on the chart page.', rating: 8, binding: 'a'.repeat(64),
  opened: ['p02', 'p04'], provenance: prov(), pages: [pageEntry('p02'), pageEntry('p04')], statuses: [status()], findings: [], density, ...o });
const added = (o) => ({ ...finding({ id: 'F9', ...o }), basis: 'changed', justification: '', evidence: '', ...(o.basis ? { basis: o.basis } : {}), ...(o.justification ? { justification: o.justification } : {}), ...(o.evidence ? { evidence: o.evidence } : {}) });
const check = (review, o = {}) => R.validateReview(review, IDS, { scope, ledger: scope.ledger, ...o });
'''

    def test_a_later_pass_gives_every_open_finding_a_status_and_adds_only_what_is_additive(self):
        result = run_node(self.PRIOR + '''
const table = { dimension: 'table', code: 'UNFINISHED_TOTAL_ROW', reason: 'The rebuilt table ends with a Total label and a blank result row.', repair: 'Fill the total row with the column sums or cut the row.' };
const justification = 'The first pass read an older render in which the table sat behind the legend and the row was hidden.';
const pageText = { p05: 'Route economics\\nTotal | 412 | 388 | —\\nSource: filings' };
console.log(JSON.stringify({
  scope: { pass: scope.pass, changed: scope.changed, must: scope.mustInspect, capped: scope.capped },
  good: check(verify()),
  noStatus: check(verify({ statuses: [] })),
  noEvidence: check(verify({ statuses: [status({ evidence: 'ok' })] })),
  minorUnchanged: check(verify({ findings: [added({ slides: ['p05'], severity: 'minor', dimension: 'text', code: 'LONG_LABEL', reason: 'The label wording runs long for its box.', repair: 'Shorten the label to the product name only.' })] })),
  majorChanged: check(verify({ accepted: false, pages: [pageEntry('p02'), pageEntry('p04', 'major')], findings: [added({ slides: ['p04'], ...table })] })),
  majorUnchanged: check(verify({ accepted: false, findings: [added({ slides: ['p05'], ...table })] })),
  // A missed major on an unchanged page is admitted on the page's own words.
  missedUnquoted: check(verify({ accepted: false, findings: [added({ slides: ['p05'], ...table, basis: 'missed', justification })] })),
  missedMajor: check(verify({ accepted: false, findings: [added({ slides: ['p05'], ...table, basis: 'missed', justification, evidence: 'Total | 412 | 388 | —' })] })),
  missedMisquoted: check(verify({ accepted: false, findings: [added({ slides: ['p05'], ...table, basis: 'missed', justification, evidence: 'Total | 999 | 000' })] }), { pageText }),
  missedQuoted: check(verify({ accepted: false, findings: [added({ slides: ['p05'], ...table, basis: 'missed', justification, evidence: 'total | 412 | 388' })] }), { pageText }),
  missedBlocker: check(verify({ accepted: false, findings: [added({ slides: ['p05'], ...table, severity: 'blocker', basis: 'missed', justification, evidence: 'Total | 412 | 388 | —' })] })),
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
        # A missed major is admitted now - but only with the page quoted, and the quote must be on the page.
        self.assertTrue(any('quotes the evidence' in e for e in result['missedUnquoted']), result['missedUnquoted'])
        self.assertEqual(result['missedMajor'], [])
        self.assertTrue(any('not printed on p05' in e for e in result['missedMisquoted']), result['missedMisquoted'])
        self.assertEqual(result['missedQuoted'], [])
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
const at = (pass) => R.verificationScope({ ...prior, pass }, { ...prior.pageHashes, p04: 'changed' });
console.log(JSON.stringify({
  fixed: R.reviewOutcome(verify(), scope.ledger).accepted,
  lowRated: R.reviewOutcome(verify({ rating: 7.8 }), scope.ledger),
  notFixed: R.reviewOutcome(notFixed, scope.ledger), notFixedValid: check(notFixed),
  partly: R.reviewOutcome(partly, scope.ledger), partlyValid: check(partly),
  third: at(2).capped, fourth: at(3).capped, fourthPass: at(3).pass, custom: R.verificationScope({ ...prior, pass: 3 }, prior.pageHashes, { maxPasses: 4 }).capped,
  // The scope a verifier is handed never carries the earlier rating.
  scopeKeys: Object.keys(scope),
}));
''')
        self.assertTrue(result['fixed'])
        # Nothing open is not enough: the deck must be rated at the bar.
        self.assertFalse(result['lowRated']['accepted'])
        self.assertIn('REVIEW_RATING', [b['code'] for b in result['lowRated']['blocking']])
        self.assertFalse(result['notFixed']['accepted'])
        self.assertEqual([b['id'] for b in result['notFixed']['blocking']], ['F1'])
        self.assertEqual(result['notFixedValid'], [])
        # A partly fixed finding no longer drops from major to minor on the
        # reviewer's say-so: it keeps its severity, blocks, and the lowered
        # severity is refused.
        self.assertFalse(result['partly']['accepted'])
        self.assertEqual([(b['id'], b['severity']) for b in result['partly']['blocking']], [('F1', 'major')])
        self.assertTrue(any('keeps its major severity' in e for e in result['partlyValid']), result['partlyValid'])
        self.assertFalse(result['third'])
        self.assertTrue(result['fourth'])
        self.assertEqual(result['fourthPass'], 4)
        self.assertFalse(result['custom'])
        self.assertNotIn('priorRating', result['scopeKeys'])

    def test_a_deck_finding_drops_only_when_its_measure_passes(self):
        # TABLE_MONOTONY is a deck finding with a deterministic measure: the
        # share of treated tables and the exhibit variety. "Partly fixed" may
        # lower it only when that measure passes on the rebuilt scene.
        result = run_node(FIXTURES + '''
const ids = Array.from({ length: 12 }, (_, i) => `q${String(i + 1).padStart(2, '0')}`);
const page = (id, component, roles) => ({ id, nodes: [{ type: 'text', role: 'action-title', text: `Title of ${id}` }, ...roles.map((role) => ({ type: 'rect', role })),
  ...Array.from({ length: 14 }, () => ({ type: 'rect', role: 'mark' }))], componentInstances: [{ component: 'slide-chrome' }, { component }] });
const kinds = ['table', 'chart.bar', 'chart.line', 'map', 'cards', 'steps', 'timeline', 'framework', 'comparison-table', 'heatmap', 'chart.scatter', 'matrix'];
const scene = (treated) => ({ slides: ids.map((id, i) => page(id, kinds[i], /table|heatmap/.test(kinds[i]) ? (treated ? ['table-harvey'] : ['table-cell']) : kinds[i].startsWith('chart') ? ['chart-callout'] : [])) });
const monotony = finding({ id: 'F1', scope: 'deck', slides: ['q01', 'q09', 'q10'], dimension: 'consistency', code: 'TABLE_MONOTONY',
  reason: 'The same plain grid carries q01, q09 and q10, so three different comparisons read alike.', repair: 'Encode the verdict columns with Harvey balls or bars so each table shows its judgement.' });
const first = firstPass([monotony], {}, ids);
const prior = { binding: 'b'.repeat(64), pass: 1, pageHashes: Object.fromEntries(ids.map((id) => [id, 'h'])), review: first, ledger: R.deckLedger([], first) };
const scope = R.verificationScope(prior, { ...prior.pageHashes, q01: 'rebuilt', q09: 'rebuilt', q10: 'rebuilt' });
const review = { pass: 2, verifies: 'b'.repeat(64), accepted: true, summary: 'The tables now encode their verdicts with Harvey balls.', rating: 8.2, binding: 'a'.repeat(64),
  opened: ['q01', 'q09', 'q10'], provenance: prov(), pages: ['q01', 'q09', 'q10'].map((id) => pageEntry(id, 'minor')),
  statuses: [{ finding: 'F1', status: 'partly fixed', severity: 'minor', evidence: 'Harvey balls now carry the verdict columns; one header still reads alike.' }], findings: [], density };
const judge = (s) => { const downgrade = R.downgradeRule(s); return { errors: R.validateReview(review, ids, { scope, ledger: scope.ledger, downgrade }), outcome: R.reviewOutcome(review, scope.ledger, { downgrade }).accepted }; };
console.log(JSON.stringify({ plain: judge(scene(false)), treated: judge(scene(true)) }));
''')
        self.assertTrue(any('keeps its major severity' in e for e in result['plain']['errors']), result['plain'])
        self.assertFalse(result['plain']['outcome'])
        self.assertEqual(result['treated']['errors'], [])
        self.assertTrue(result['treated']['outcome'])


class DensityVerificationTests(unittest.TestCase):
    def test_an_open_density_finding_is_judged_again_and_can_close(self):
        # Pass one judged p03 too thin. The rebuild fixed it, so the profile no
        # longer flags it - and the verification pass, which only asked about
        # flagged pages, never judged it again: its density finding stayed
        # open and blocked delivery on every later pass.
        result = run_node(FIXTURES + '''
const hashes = Object.fromEntries(IDS.map((id) => [id, 'h']));
const first = firstPass([], { accepted: false, density: { deck: 'The deck sits near its targets apart from one page that is thin for its job.',
  pages: [{ slide: 'p03', verdict: 'too thin', reason: 'The page states a finding without the reasoning behind it.' }] } });
const prior = { binding: 'b'.repeat(64), pass: 1, pageHashes: hashes, review: first, ledger: R.deckLedger([], first) };
const scope = R.verificationScope(prior, { ...hashes, p03: 'rebuilt' });
const rebuilt = { deck: {}, pages: [{ id: 'p03', page: 3, flags: [] }], flaggedPages: [] };
const verify = (pages) => ({ pass: 2, verifies: 'b'.repeat(64), accepted: true, summary: 'The rebuilt page now carries its reasoning.', rating: 8, binding: 'a'.repeat(64),
  opened: ['p03'], provenance: prov(), pages: [pageEntry('p03')], statuses: [], findings: [], density: { deck: 'The deck now sits on its targets on every measure compared.', pages } });
const silent = verify([]);
const judged = verify([{ slide: 'p03', verdict: 'right', reason: 'The page now gives the reasoning behind its finding.' }]);
const packet = { scope, density: rebuilt, slides: [], titles: [], montage: 'm.png', schema: R.VERIFICATION_SCHEMA, binding: 'a'.repeat(64) };
console.log(JSON.stringify({ rejudge: scope.rejudge.map((p) => p.slide), must: scope.mustInspect, asked: R.verificationPrompt(packet).includes('- p03: earlier judged too thin'),
  silent: R.validateDensityReview(silent, rebuilt, scope),
  judged: [...R.validateReview(judged, IDS, { scope, ledger: scope.ledger }), ...R.validateDensityReview(judged, rebuilt, scope)],
  accepted: R.reviewOutcome(judged, scope.ledger).accepted }));
''')
        self.assertEqual(result['rejudge'], ['p03'])
        self.assertIn('p03', result['must'])
        self.assertTrue(result['asked'])
        self.assertTrue(any('p03' in e for e in result['silent']), result['silent'])
        self.assertEqual(result['judged'], [])
        self.assertTrue(result['accepted'])


class SectionMergeTests(unittest.TestCase):
    PARTS = FIXTURES + '''
const dead = (id, slides) => finding({ id, scope: 'deck', slides, dimension: 'layout', code: 'DEAD_SPACE', reason: `Large empty bands under the exhibit on ${slides.join(', ')}.`, repair: 'Enlarge the exhibit to fill the band on each page.' });
const section = (id, slides, findings) => ({ part: { kind: 'section', id, slides }, binding: 'a'.repeat(64), accepted: false, summary: 'The section reads well apart from its bands.', rating: 7,
  opened: [...slides], provenance: prov(), pages: slides.map((s) => pageEntry(s, worstOn(findings, s) ?? 'ok')), findings,
  completeness: R.PAGE_DIMENSIONS.map((d) => findings.some((f) => f.dimension === d) ? { dimension: d, result: 'findings', note: 'Filed above.' } : { dimension: d, result: 'clean', note: `Checked ${d} on each page of the section; nothing to raise.` }) });
const s1 = section('s1', ['p01', 'p02', 'p03'], [dead('F1', ['p01', 'p03'])]);
const s2 = section('s2', ['p04', 'p05', 'p06'], [dead('F1', ['p05']), finding({ id: 'F2', slides: ['p04'], severity: 'minor', reason: 'The axis title repeats the chart heading word for word.', repair: 'Cut the axis title and keep the unit in the heading.' })]);
const spine = { part: { kind: 'spine', id: 'spine', slides: IDS }, binding: 'a'.repeat(64), accepted: false, summary: 'Sound argument; repeated tables and empty bands.', rating: 6, opened: [], provenance: prov(), pages: [],
  findings: [finding({ id: 'F1', scope: 'deck', slides: ['p02', 'p05'], dimension: 'consistency', code: 'TABLE_MONOTONY', reason: 'The same dark first-column table carries p02 and p05.', repair: 'Redraw p05 as a ranked bar so the pair reads differently.' })],
  completeness: R.DECK_DIMENSIONS.map((d) => d === 'consistency' ? { dimension: d, result: 'findings', note: 'Filed above.' } : { dimension: d, result: 'clean', note: `Checked ${d} across the whole sequence; nothing to raise.` }),
  assessment: Object.fromEntries(R.ASSESSMENT_KEYS.map((k) => [k, `A sentence about ${k}.`])), density };
'''

    def test_parallel_section_reviews_merge_into_one_first_pass(self):
        result = run_node(self.PARTS + '''
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

    def test_the_merge_reads_the_parts_a_backend_run_saved(self):
        # A codex run saves each part as <id>.json and its raw output beside it
        # as <id>.last-message.json. `reviewer.mjs merge` read both, counted
        # every part twice and refused its own run; one reader now serves the
        # deck merge, delivery's --review <dir> and the storyline merge.
        result = run_node(self.PARTS + '''
const dir = await builtDeck();
const parts = path.join(dir, 'review-packet', 'parts');
await fs.mkdir(parts, { recursive: true });
for (const part of [s1, s2, spine]) for (const name of [`${part.part.id}.json`, `${part.part.id}.last-message.json`]) await fs.writeFile(path.join(parts, name), JSON.stringify(part));
const merged = await R.mergeReviewDirectory(dir, parts);
const read = await P.readParts(parts);
await cleanup(dir);
console.log(JSON.stringify({ status: merged.status, errors: merged.errors ?? [], files: read.files }));
''')
        self.assertEqual(result['errors'], [])
        self.assertEqual(result['status'], 'merged')
        self.assertEqual(result['files'], ['s1.json', 's2.json', 'spine.json'])

    def test_both_loops_split_and_join_their_parts_the_same_way(self):
        # The storyline's splitter never cut a long section, so a forty-page
        # section went to one critic; its merge never refused a page two
        # sections both read. Both loops now share one splitter and one check.
        result = run_node(FIXTURES + '''
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'storyline-split-'));
const specPath = path.join(dir, 'fixture.deck.json');
const content = Array.from({ length: 40 }, (_, i) => ({ id: `q${i + 1}`, title: `Title of q${i + 1} states one finding` }));
await fs.writeFile(specPath, JSON.stringify({ ...specOf([]), slides: [{ id: 'd1', kind: 'section', title: 'The whole market' }, ...content] }));
const { packet } = await S.buildStorylinePacket(specPath, path.join(dir, 'out'), { mode: 'full' });
await cleanup(dir);
const part = (kind, id, pages) => ({ part: { kind, id, pages }, binding: 'x' });
const twice = S.mergeStorylineParts([part('section', 's1', ['p01', 'p02']), part('section', 's2', ['p02', 'p03']), part('spine', 'spine', [])],
  { binding: 'x', pages: ['p01', 'p02', 'p03'].map((id) => ({ id, kind: 'content' })), sections: null });
console.log(JSON.stringify({ sizes: packet.sections.map((s) => s.pages.length), covered: packet.sections.flatMap((s) => s.pages).length, twice: twice.errors }));
''')
        self.assertEqual(result['covered'], 40)
        self.assertTrue(all(n <= 16 for n in result['sizes']), result['sizes'])
        self.assertTrue(any('p02 covered by two section parts' in e for e in result['twice']))


class StorylineBeforeDeckReviewTests(unittest.TestCase):
    def test_the_deck_review_packet_waits_for_a_ready_storyline_on_the_current_spine(self):
        result = run_node(FIXTURES + '''
const dir = await builtDeck();
const spec = specOf();
const specPath = path.join(dir, 'fixture.deck.json');
await fs.writeFile(specPath, JSON.stringify(spec));
const attempt = async (s) => { try { return (await R.buildReviewPacket({ outputDirectory: dir, spec: s, deckPath: specPath })).packetDir; } catch (e) { return e.message; } };
const none = await attempt(spec);
const { dir: staging } = await S.buildStorylinePacket(specPath, dir);
const provenance = prov(await hashOf(staging));
await fs.writeFile(path.join(dir, 'storyline-review.json'), JSON.stringify(storyReady(spec, { verdict: 'revise', topFixes: ['Show the whole peer set'], provenance })));
const revise = await attempt(spec);
await fs.writeFile(path.join(dir, 'storyline-review.json'), JSON.stringify(storyReady(spec, { provenance })));
const packetDir = await attempt(spec);
const staged = (await fs.readdir(packetDir)).sort();
const prompt = await fs.readFile(path.join(packetDir, 'prompt.md'), 'utf8');
const retitled = specOf(IDS, { p03: 'A different claim now stands on page three' });
const changed = await attempt(retitled);
const deliver = (await import('./skills/professional-slides/runtime/deliver-deck.mjs')).deliverDeck;
await fs.writeFile(specPath, JSON.stringify(retitled));
const refused = await deliver(specPath, dir, { skipBuild: true, reviewFile: path.join(dir, 'nothing.json') });
await cleanup(dir);
console.log(JSON.stringify({ none, revise, staged, outside: !packetDir.startsWith(dir), request: prompt.includes("THE USER'S REQUEST (verbatim"),
  requestText: prompt.includes('Which company is winning this market, and why?'), hashLine: /"promptHash": "[a-f0-9]{64}"/.test(prompt), readFiles: /references\\/[a-z-]+\\.md/.test(prompt),
  changed, refusedAt: refused.rejectedAt, reason: refused.blockers[0].reason }));
''')
        self.assertIn('storyline-review.json is missing', result['none'])
        self.assertIn('says revise', result['revise'])
        # The packet is staged outside the output directory with only what the reviewer is given.
        self.assertTrue(result['outside'])
        self.assertEqual(result['staged'], ['packet.json', 'prompt.md', 'rendered', 'schema.json'])
        # It carries the user's request verbatim and the hash the answer echoes, and sends the reviewer to no other file.
        self.assertTrue(result['request'] and result['requestText'] and result['hashLine'])
        self.assertFalse(result['readFiles'])
        self.assertIn('re-run the storyline critique first', result['changed'])
        self.assertIn('p03', result['changed'])
        # Delivery refuses a supplied deck review the same way, before reading it.
        self.assertEqual(result['refusedAt'], 'storyline')
        self.assertIn('re-run the storyline critique first', result['reason'])

    def test_the_gate_accepts_only_a_recorded_pass_or_the_packets_answer(self):
        # The gate used to fall back to validating a critique that matched no
        # recorded pass and no packet: a hand-written pass-1 file that said
        # ready passed, and reset the three-pass cap with it. And with a record
        # it read the verdict from the editable file rather than the record.
        result = run_node(FIXTURES + '''
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'storyline-gate-'));
const specPath = path.join(dir, 'fixture.deck.json'), out = path.join(dir, 'out');
await fs.mkdir(out);
const spec = specOf(['p01', 'p02', 'p03']);
await fs.writeFile(specPath, JSON.stringify(spec));
const reviewPath = path.join(out, 'storyline-review.json');
await fs.writeFile(reviewPath, JSON.stringify(storyReady(spec)));
const handWritten = await S.storylineGate(spec, out, { deckPath: specPath });
await fs.rm(reviewPath);
const step = await S.prepareStoryline(specPath, out);
const critique = storyReady(spec, { verdict: 'revise', provenance: prov(await hashOf(step.dir)), findings: [{ id: 'F1', scope: 'page', pages: ['p02'], check: 'claim', severity: 'major', problem: 'The title reports a count without an implication.', fix: 'Rewrite the title as the finding the count supports.' }] });
critique.completeness.find((c) => c.check === 'claim').result = 'findings';
await fs.writeFile(reviewPath, JSON.stringify({ ...critique, authorResponse: 'F1 misreads the page; the count is the finding.' }));
const rebutted = await S.prepareStoryline(specPath, out);
await fs.writeFile(reviewPath, JSON.stringify(critique));
const recorded = await S.prepareStoryline(specPath, out);
await fs.writeFile(reviewPath, JSON.stringify({ ...critique, verdict: 'ready', findings: [] }));
const edited = await S.storylineGate(spec, out, { deckPath: specPath });
// A new output directory is the same lineage: the record is found beside the deck.
const elsewhere = await S.storylineGate(spec, path.join(dir, 'out-2'), { deckPath: specPath });
const store = (await fs.readdir(path.join(dir, '.reviews', 'fixture'))).sort();
await cleanup(dir);
console.log(JSON.stringify({ handWritten, rebutted, recorded: recorded.status, edited, elsewhere, store }));
''')
        self.assertTrue(any('answers no packet' in e for e in result['handWritten']), result['handWritten'])
        self.assertEqual(result['rebutted']['status'], 'invalid')
        self.assertTrue(any('authorResponse' in e for e in result['rebutted']['errors']), result['rebutted'])
        self.assertEqual(result['recorded'], 'revise')
        self.assertTrue(any('says revise' in e for e in result['edited']), result['edited'])
        self.assertTrue(any('says revise' in e for e in result['elsewhere']), result['elsewhere'])
        self.assertEqual(result['store'], ['storyline-history', 'storyline-packet.json'])


class StorylinePassTests(unittest.TestCase):
    def test_a_first_critique_covers_every_page_without_sampling(self):
        # The page-level critique (--full): every content page, no sampling.
        result = run_node(FIXTURES + '''
const spec = specOf(['p01', 'p02', 'p03']);
const missing = storyFull(spec); missing.pages = missing.pages.slice(0, 2);
const sampled = storyFull(spec, { verdict: 'revise', findings: [{ id: 'F1', scope: 'spine', pages: ['p01'], check: 'claim', severity: 'major', problem: 'Several titles report counts, e.g. p01 and p02, without an implication.', fix: 'Rewrite each title as the finding the count supports.' }] });
sampled.pages[0].verdict = 'major';
const unsupported = storyFull(spec); unsupported.pages[1].sourcing = { status: 'unsupported', insights: [], note: 'no insight carries the claim' };
const readyWithMajor = storyFull(spec, { findings: [{ id: 'F1', scope: 'page', pages: ['p02'], check: 'shape', severity: 'major', problem: 'A two-number chart carries a ranking claim.', fix: 'Plot the whole peer set ranked on the same basis.' }] });
readyWithMajor.pages[1].verdict = 'major'; readyWithMajor.completeness.find((c) => c.check === 'shape').result = 'findings';
console.log(JSON.stringify({ ok: S.validateStorylineReview(storyFull(spec), spec), missing: S.validateStorylineReview(missing, spec),
  sampled: S.validateStorylineReview(sampled, spec), unsupported: S.validateStorylineReview(unsupported, spec), readyWithMajor: S.validateStorylineReview(readyWithMajor, spec) }));
''')
        self.assertEqual(result['ok'], [])
        self.assertTrue(any('p03' in e for e in result['missing']))
        self.assertTrue(any('by example' in e for e in result['sampled']))
        self.assertTrue(any('unsupported claim' in e for e in result['unsupported']))
        self.assertTrue(any('verdict is ready while F1' in e for e in result['readyWithMajor']))

    def test_the_spine_critique_answers_the_request_in_ten_items_or_fewer(self):
        # The first Emirates critique returned 141 items from 272 KB of prompts,
        # and the Anthropic deck answered two of its three questions "unranked".
        # The spine critique returns at most ten items; its answer check fails
        # an answer that declines part of the request; and only data known to
        # be public can carry a major missing analysis.
        result = run_node(FIXTURES + '''
const spec = specOf(['p01', 'p02', 'p03']);
const item = (i) => ({ id: `F${i}`, scope: 'page', pages: ['p02'], check: 'claim', severity: 'minor', problem: `Minor point number ${i} about the claim on this page.`, fix: 'Rewrite the title so it states the implication, not the count.' });
const eleven = storyReady(spec, { findings: Array.from({ length: 11 }, (_, i) => item(i + 1)) });
eleven.completeness.find((c) => c.check === 'claim').result = 'findings';
const parts = (verdicts) => verdicts.map(([part, verdict, missingEvidence = '']) => ({ part, verdict, missingEvidence }));
const twoUnranked = storyReady(spec, { answerParts: parts([['short run', 'answered'], ['long run', 'cannot rank', 'No audited retention or margin series exists for either company.'], ['capital structure', 'cannot rank', 'The debt terms of both facilities are private.']]) });
const answerFinding = { id: 'F1', scope: 'spine', pages: ['p01', 'p02', 'p03'], check: 'answer', severity: 'major', problem: 'Two of the three questions are left unranked by the answer.', fix: 'Commit to a directional call on the long run with its confidence and reversal.' };
const flagged = storyReady(spec, { verdict: 'revise', answerParts: twoUnranked.answerParts, findings: [answerFinding] });
flagged.completeness.find((c) => c.check === 'answer').result = 'findings';
const oneUnranked = storyReady(spec, { answerParts: parts([['short run', 'answered'], ['long run', 'cannot rank', 'No audited retention or margin series exists for either company.']]) });
const unnamed = storyReady(spec, { answerParts: parts([['long run', 'cannot rank']]) });
const missing = (pub) => storyReady(spec, { verdict: 'revise', missingAnalyses: [{ id: 'M1', analysis: 'Cohort retention by vintage', why: 'Retention decides the long-run call.', data: 'Company S-1 cohort tables', public: pub, remedy: 'retrieval', severity: 'major' }] });
const m = (r) => { r.completeness.find((c) => c.check === 'missing').result = 'findings'; return r; };
console.log(JSON.stringify({ eleven: S.validateStorylineReview(eleven, spec), twoUnranked: S.validateStorylineReview(twoUnranked, spec), flagged: S.validateStorylineReview(flagged, spec),
  oneUnranked: S.validateStorylineReview(oneUnranked, spec), unnamed: S.validateStorylineReview(unnamed, spec),
  speculative: S.validateStorylineReview(m(missing('speculative')), spec), known: S.validateStorylineReview(m(missing('known')), spec),
  declines: S.declinesIn('OpenAI leads reach; Anthropic leads enterprise. Neither has a provably superior capital structure, and the long run cannot be ranked.') }));
''')
        self.assertTrue(any('at most 10 items' in e for e in result['eleven']), result['eleven'])
        self.assertTrue(any('answer check fails' in e for e in result['twoUnranked']), result['twoUnranked'])
        # Filed as a major answer finding with the verdict at revise, the critique is valid - and the gate says revise.
        self.assertTrue(result['flagged'] and all('says revise' in e for e in result['flagged']), result['flagged'])
        self.assertEqual(result['oneUnranked'], [])
        self.assertTrue(any('missingEvidence' in e for e in result['unnamed']))
        self.assertTrue(any('known to be public' in e for e in result['speculative']), result['speculative'])
        self.assertTrue(result['known'] and all('says revise' in e for e in result['known']), result['known'])
        self.assertEqual(len(result['declines']), 2)

    def test_the_storyline_loop_verifies_changed_pages_and_converges(self):
        result = run_node(FIXTURES + '''
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'storyline-passes-'));
const specPath = path.join(dir, 'fixture.deck.json'), out = path.join(dir, 'out');
await fs.mkdir(out);
const ids = ['p01', 'p02', 'p03', 'p04'];
await fs.writeFile(specPath, JSON.stringify(specOf(ids)));
const one = await S.prepareStoryline(specPath, out);
const weak = { id: 'F1', scope: 'page', pages: ['p02'], check: 'claim', severity: 'major', problem: 'The title reports a count without an implication.', fix: 'Rewrite the title as the finding the count supports.' };
const critique = storyReady(specOf(ids), { verdict: 'revise', findings: [weak], provenance: prov(await hashOf(one.dir)) });
critique.completeness.find((c) => c.check === 'claim').result = 'findings';
await fs.writeFile(path.join(out, 'storyline-review.json'), JSON.stringify(critique));
const revise = await S.prepareStoryline(specPath, out);
const revised = specOf(ids, { p02: 'The subject added routes twice as fast as its nearest rival' });
await fs.writeFile(specPath, JSON.stringify(revised));
const two = await S.prepareStoryline(specPath, out);
const packet = JSON.parse(await fs.readFile(path.join(two.dir, 'packet.json'), 'utf8'));
const verification = (o = {}) => ({ pass: 2, verifies: critique.binding, verdict: 'ready', rating: 8, binding: S.storylineBinding(revised), summary: 'The rewritten title now states the finding the count supports.',
  compliance: { verdict: 'complete', note: 'Nothing the evidence in scope allows is left undone.' }, sufficiency: { verdict: 'sufficient', note: 'The evidence supports the answer as it is stated.' },
  provenance: prov(packet.promptHash), statuses: [{ finding: 'F1', status: 'fixed', evidence: 'The title now states the rate against the nearest rival.' }], findings: [], topFixes: [], ...o });
await fs.writeFile(path.join(out, 'storyline-review.json'), JSON.stringify(verification({ findings: [{ id: 'F2', scope: 'page', pages: ['p04'], check: 'consequence', severity: 'minor', problem: 'The page could say more about what follows.', fix: 'Add the consequence for the decision in one line.', basis: 'changed', justification: '', evidence: '' }] })));
const nit = await S.prepareStoryline(specPath, out);
await fs.writeFile(path.join(out, 'storyline-review.json'), JSON.stringify(verification({ provenance: prov('0'.repeat(64)) })));
const forged = await S.prepareStoryline(specPath, out);
await fs.writeFile(path.join(out, 'storyline-review.json'), JSON.stringify(verification()));
const ready = await S.prepareStoryline(specPath, out);
const gate = await S.storylineGate(revised, out, { deckPath: specPath });
const moved = await S.storylineGate(specOf(ids, { p02: 'The subject added routes twice as fast as its nearest rival', p03: 'A new claim' }), out, { deckPath: specPath });
const capped = P.nextPassScope({ pass: 3, binding: 'b'.repeat(64), pageHashes: S.storylinePageHashes(revised), review: critique }, { ...S.storylinePageHashes(revised), p03: 'x' }, { ids, ledger: [] });
// Switching to the page-level critique is a new lineage: it needs a reason.
const switched = await S.prepareStoryline(specPath, out, { mode: 'full' });
const withReason = await S.prepareStoryline(specPath, out, { mode: 'full', reason: 'The user asked for a page-level critique before the copy.' });
await cleanup(dir);
console.log(JSON.stringify({ one: [one.status, one.pass, one.mode], revise: revise.status, two: [two.status, two.pass], scope: [packet.scope.changed, packet.scope.mustInspect, 'ledger' in packet.scope, 'priorRating' in packet.scope],
  nit: [nit.status, nit.errors?.some((e) => e.includes('not additive'))], forged: [forged.status, forged.errors?.some((e) => e.includes('promptHash'))], ready: ready.status, gate, moved, capped: capped.capped,
  switched, withReason: [withReason.status, withReason.mode, withReason.pass] }));
''')
        self.assertEqual(result['one'], ['packet-written', 1, 'spine'])
        self.assertEqual(result['revise'], 'revise')  # the spine has not changed since the critique
        self.assertEqual(result['two'], ['packet-written', 2])
        # The spine verifier reads the whole (small) spine; the staged packet carries no ledger and no earlier rating.
        self.assertEqual(result['scope'], [['p02'], [], False, False])
        self.assertEqual(result['nit'], ['invalid', True])
        self.assertEqual(result['forged'], ['invalid', True])
        self.assertEqual(result['ready'], 'ready')
        self.assertEqual(result['gate'], [])
        self.assertTrue(any('p03' in e and 're-run the storyline critique first' in e for e in result['moved']))
        self.assertTrue(result['capped'])
        self.assertEqual(result['switched']['status'], 'refused')
        self.assertTrue(any('--reason' in e for e in result['switched']['errors']))
        self.assertEqual(result['withReason'], ['packet-written', 'full', 1])



if __name__ == '__main__':
    unittest.main()
