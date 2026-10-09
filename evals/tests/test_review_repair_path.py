"""One standard for the two judges, and a way back from the deck review.

A benchmark's storyline was rated 8 and ready; the review of the drawn deck
then rejected it at 6.5 with 110 findings, 31 of them on the argument and its
evidence. Most repairs it asked for changed facts the storyline critique
binds, the critique's three passes were spent, and the author could only
change copy. Every section reviewer's first answer was refused on form,
because the prompt offered three dimensions the validator refuses on a
section part. And one reviewer asked for shorter commentary where a build gate
needs longer blocks, which it could not see.

These tests hold the repairs: the critic is given the reviewer's own checks,
severity scale and rating scale from one definition; a deck finding the spine
already decided is recorded as such; every finding says what its repair
changes and a rejection groups them by it; each rejected review pass grants
one scoped storyline pass outside the cap; the reviewer is shown the floors a
repair must stay inside; and a section part written as the prompt describes
validates. Each is exercised on a new deck and on a one-page revision.
"""
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import run_node, ROOT, NODE
from test_review_delivery import FIXTURES, REVISION


# A critique of `spec` for `packet` at `pass`: ready, or sent back with `findings`.
CRITIQUE = '''
const critique = (packet, { findings = [], statuses = null, open = findings.length > 0 } = {}) => {
  const base = { pass: packet.pass, verifies: packet.verifies, verdict: open ? 'revise' : 'ready', rating: open ? 6 : 8, binding: packet.binding,
    summary: open ? 'The storyline is sent back for the item filed below.' : 'The answer is sharp and the pillars hold on the evidence shown.',
    provenance: { backend: 'subagent', model: 'fixture-critic', promptHash: packet.promptHash },
    compliance: { verdict: open ? 'incomplete' : 'complete', note: open ? 'An open item is still within reach of the team.' : 'Nothing the evidence in scope allows is left undone.' },
    sufficiency: { verdict: open ? 'insufficient' : 'sufficient', note: open ? 'The answer outruns its evidence while the item is open.' : 'The evidence supports the answer as it is stated.' } };
  if (statuses) return { ...base, statuses, findings, topFixes: [] };
  const pages = packet.pages.filter((p) => !p.kind || p.kind === 'content').map((p) => p.id);
  return { ...base, spine: 'Read alone, the titles build from the market to the answer without a gap or a repeated step.', answer: 'The subject leads on both horizons, on the evidence shown.',
    answerParts: [{ part: 'short run', verdict: 'answered', missingEvidence: '' }, { part: 'long run', verdict: 'answered', missingEvidence: '' }],
    pillars: [{ pillar: 'Lead', pages, verdict: open ? 'weak' : 'holds', overlap: 'A single pillar; nothing overlaps.', strongestCounter: 'The base is small.', reversal: 'Growth below peers for two years.', answered: true }],
    numbers: 'Every figure matches across the pages that print it.', sectionFlow: 'The sections open, develop and close in order.', execSummary: 'The summary states the answer the body proves.',
    missingAnalyses: [], cutOrMerge: [], findings, topFixes: ['None material'],
    completeness: S.STORYLINE_DIMENSIONS.map((check) => ({ check, result: findings.some((f) => f.check === check) ? 'findings' : 'clean', note: findings.some((f) => f.check === check) ? 'Filed the item above.' : `Checked ${check} across the spine and found nothing to raise.` })) };
};
const staged = async (step) => JSON.parse(await fs.readFile(path.join(step.dir, 'packet.json'), 'utf8'));
// One step of the storyline loop answered: the packet's critique saved, and the loop run again.
const answer = async (d, step, o = {}) => { await fs.writeFile(path.join(d.out, 'storyline-review.json'), JSON.stringify(critique(await staged(step), o))); return S.prepareStoryline(d.specPath, d.out); };
const retitle = async (d, id, title) => { d.spec = { ...d.spec, slides: d.spec.slides.map((s) => (s.id === id ? { ...s, title, ...(s.pageType ? { pageType: { ...s.pageType, content: { ...s.pageType.content, claim: title } } } : {}) } : s)) }; await fs.writeFile(d.specPath, JSON.stringify(d.spec)); };
const item = (id, page) => ({ id, scope: 'page', pages: [page], check: 'claim', severity: 'major', ifUnfixed: 'The committee would act on a claim the deck does not show.', problem: 'The title claims more than its evidence shows on this page.', fix: 'Pull the title back to the finding the evidence supports.' });
const fixed = (id) => ({ finding: id, status: 'fixed', evidence: 'The title now states only what the measure on the page shows.' });
'''


class OneStandardTests(unittest.TestCase):
    def test_the_critic_is_given_every_clause_the_spine_decides_in_the_reviewers_words(self):
        result = run_node(FIXTURES + '''
const d = await prebuilt();
const step = await S.prepareStoryline(d.specPath, d.out);
const spine = await fs.readFile(path.join(step.dir, 'prompt.md'), 'utf8');
const review = R.rubricPrompt();
const clauses = Object.entries(P.RUBRIC_CLAUSES).flatMap(([dimension, { clauses }]) => clauses.map((c) => ({ dimension, ...c })));
const atSpine = clauses.filter((c) => c.spine), atPage = clauses.filter((c) => !c.spine);
// The line of the prompt that states a check.
const line = (check) => spine.split('\\n').find((l) => l.startsWith(`- ${check} (`)) ?? '';
const out = {
  counts: [clauses.length, atSpine.length],
  // Every clause the spine decides is printed under the check it names, word for word, and is in the reviewer's rubric.
  missingAtSpine: atSpine.filter((c) => !line(c.spine).includes(c.text)).map((c) => c.text), missingInRubric: clauses.filter((c) => !review.includes(c.text)).map((c) => c.text),
  // A clause that needs the drawn page is not asked of the critic.
  leaked: atPage.filter((c) => spine.includes(c.text)).map((c) => c.text),
  checks: Object.fromEntries(Object.entries(S.STORYLINE_CHECKS).map(([check, said]) => [check, said.held.length])),
  dimensions: Object.fromEntries(R.DIMENSIONS.map((dim) => [dim, P.dimensionAt(dim)])),
  // One severity scale: the critic's sentence for a level is the opening of the reviewer's.
  severity: ['blocker', 'major', 'minor', 'none'].map((level) => spine.includes(`- ${level}: ${P.ARGUMENT_SEVERITIES[level]}`) && P.SEVERITY_DEFINITIONS[level].startsWith(P.ARGUMENT_SEVERITIES[level]) && review.includes(P.SEVERITY_DEFINITIONS[level])),
  // One rating scale in both prompts; the reviewer's carries its caps, the critic's rating is a second reading beside its items.
  rating: [spine.includes(P.ratingScale({ capped: false })), R.STANDARDS.includes(P.ratingScale({ rendered: true })), P.ratingScale().includes('With a blocker open the rating is 5 or less; with a major open, 7 or less')],
  anchors: ['2 or less - no argument: the question restated, or facts without an answer', '8 - the bar: nothing major open and the remaining weaknesses limited'].every((anchor) => P.ratingScale().includes(anchor) && P.ratingScale({ rendered: true }).includes(anchor)),
  bytes: Buffer.byteLength(spine) };
await done(d);
console.log(JSON.stringify(out));
''')
        self.assertEqual(result['missingAtSpine'], [])
        self.assertEqual(result['missingInRubric'], [])
        self.assertEqual(result['leaked'], [])
        self.assertEqual(result['counts'], [43, 15])
        # Which checks carry the reviewer's clauses, and how many each.
        self.assertEqual({k: v for k, v in result['checks'].items() if v}, {'claim': 2, 'shape': 2, 'sourcing': 1, 'restatement': 2, 'spine': 1, 'numbers': 2, 'flow': 3, 'summary': 2})
        self.assertEqual(result['dimensions'], {'argument': 'spine', 'evidence': 'spine', 'chart': 'page', 'table': 'page', 'text': 'both', 'layout': 'page', 'identity': 'both',
                                                'sourcing': 'page', 'consistency': 'page', 'rhythm': 'spine', 'bookends': 'spine'})
        self.assertEqual(result['severity'], [True, True, True, True])
        self.assertEqual(result['rating'], [True, True, True])
        self.assertTrue(result['anchors'])

    def test_a_deck_finding_the_spine_decided_is_recorded_as_one_the_critique_owed(self):
        result = run_node(FIXTURES + '''
const f = (code, dimension, o = {}) => major({ id: `${code}-${dimension}`, code, dimension, ...o });
const findings = [f('UNSUPPORTED_CLAIM', 'argument'), f('MISLEADING_COMPARISON', 'consistency'), f('HEDGED_TITLE', 'text'), f('FLAT_TABLE', 'argument'), f('WALL_OF_TEXT', 'bookends'),
  f('UNRECONCILED_NUMBER', 'evidence'), f('REPEATED_JOB', 'rhythm'), f('SCENE_INK', 'chart'), f('TIMELINE_SPACING', 'text'), f('PROVENANCE', 'sourcing', { severity: 'minor' })];
const items = R.deckItems({ findings });
const ledger = P.advanceLedger([], { pass: 1 }, items);
console.log(JSON.stringify({ at: Object.fromEntries(items.map((i) => [i.id, i.decidable])), agreement: R.spineAgreement(ledger), every: Object.keys(R.CODES).every((code) => ['spine', 'page'].includes(R.decidableAt({ code }))),
  codes: R.CODES_AT_SPINE, label: R.SPINE_LABEL }));
''')
        self.assertEqual(result['at'], {
            # The reviewer's own codes are classed by the code, whatever dimension they were filed under.
            'UNSUPPORTED_CLAIM-argument': 'spine', 'MISLEADING_COMPARISON-consistency': 'spine', 'HEDGED_TITLE-text': 'spine',
            'FLAT_TABLE-argument': 'page', 'WALL_OF_TEXT-bookends': 'page', 'PROVENANCE-sourcing': 'page',
            # A code the reviewer coined, or a gate's, by its dimension: at the spine only where every clause of the dimension is.
            'UNRECONCILED_NUMBER-evidence': 'spine', 'REPEATED_JOB-rhythm': 'spine', 'SCENE_INK-chart': 'page', 'TIMELINE_SPACING-text': 'page'})
        self.assertEqual(result['agreement']['findings'], 5)
        self.assertEqual(result['agreement']['blocking'], 5)
        self.assertEqual(result['agreement']['label'], 'visible at the spine')
        self.assertTrue(result['every'])
        self.assertEqual(result['codes'], ['FACTUAL_ERROR', 'UNSUPPORTED_CLAIM', 'MISLEADING_COMPARISON', 'UNCLEAR_ARGUMENT', 'HEDGED_TITLE'])

    def test_two_measures_that_may_be_one_quantity_recorded_twice_are_put_to_the_critic(self):
        result = run_node(FIXTURES + '''
// Two pages show the same margin from two insights, which agree on two years and disagree on the third; a third measure differs by rounding alone.
const d = await prebuilt({ count: 3 });
const measure = (values, unit = '%') => ({ unit, periods: ['FY24', 'FY25', 'FY26'], values });
const insight = (id, measures) => ({ id, finding: `What ${id} records about the margin`, shape: 'series', calculation: 'as reported', sources: [], strength: 'strong', soWhat: 'It bears on the decision the deck is for', measures });
await fs.writeFile(path.join(d.dir, 'fixture.insights.json'), JSON.stringify({ insights: [insight('i-a', { margin: measure([8.1, 8.4, 8.5]) }), insight('i-b', { net: measure([8.1, 8.4, 9.1]), rounded: measure([8.12, 8.41, 8.5]) }),
  insight('i-c', { passengers: measure([8.1, 20, 30], 'passengers m'), other: measure([40, 50, 60]) })] }));
const shows = (id, refs) => ({ id, title: `Title of ${id} states one finding`, pageType: { type: 'trend', content: { claim: `Title of ${id} states one finding`, evidence: [...new Set(refs.map((r) => r.split('/')[0]))], settles: { kind: 'rate', what: 'the margin by year', measures: refs } } } });
d.spec = { ...d.spec, slides: [d.spec.slides[0], shows('p01', ['i-a/margin']), shows('p02', ['i-b/net', 'i-b/rounded']), shows('p03', ['i-c/passengers', 'i-c/other'])] };
await fs.writeFile(d.specPath, JSON.stringify(d.spec));
const step = await S.prepareStoryline(d.specPath, d.out);
const packet = JSON.parse(await fs.readFile(path.join(step.dir, 'packet.json'), 'utf8'));
const prompt = await fs.readFile(path.join(step.dir, 'prompt.md'), 'utf8');
await done(d);
console.log(JSON.stringify({ reconcile: packet.reconcile, asked: prompt.includes('FIGURES TO RECONCILE') && prompt.includes('a blocker `numbers` finding naming both') }));
''')
        # One pair: the same unit, different insights, agreeing on two years and differing on one. Rounding, another unit and a measure that differs everywhere are not listed.
        self.assertEqual(result['reconcile'], ['i-a/margin (shown on p01) and i-b/net (shown on p02), %: agree on 2 of the 3 they share; differ on FY26, 8.5 against 9.1'])
        self.assertTrue(result['asked'])

    def test_a_revisions_critique_applies_the_added_checks_to_the_changed_page_only(self):
        result = run_node(REVISION + CRITIQUE + '''
const d = await revised((slides) => slides.map((s) => s.id === 'p03' ? { ...s, title: 'A sharper finding for page three', pageType: { ...s.pageType, content: { claim: 'A sharper finding for page three' } } } : s));
const step = await S.prepareStoryline(d.specPath, d.out);
const packet = await staged(step);
const prompt = await fs.readFile(path.join(step.dir, 'prompt.md'), 'utf8');
// An item under a check the reviewer's clauses were added to, on a page the revision did not touch, is still refused.
const off = await answer(d, step, { findings: [{ ...item('F1', 'p02'), check: 'shape' }] });
const on = await answer(d, step, { findings: [{ ...item('F1', 'p03'), check: 'shape' }] });
await done(d);
console.log(JSON.stringify({ revision: packet.revision, held: prompt.includes('members compared on the same measures'), scoped: prompt.includes('File items only where the revision is involved'),
  prompts: (await Promise.resolve(1)), off: [off.status, (off.errors || []).some((e) => /did not change in this revision/.test(e))], on: on.status }));
''')
        self.assertEqual(result['revision']['changed'], ['p03'])
        self.assertTrue(result['held'])
        self.assertTrue(result['scoped'])
        self.assertEqual(result['off'], ['invalid', True])
        self.assertEqual(result['on'], 'revise')


class RepairReachTests(unittest.TestCase):
    def test_a_finding_says_what_its_repair_changes_and_the_registry_says_whether_that_reopens_the_argument(self):
        result = run_node(FIXTURES + '''
import { REVIEW_TOUCHES, SETTLED_LATER } from './skills/professional-slides/runtime/gates/gate_classes.mjs';
const reach = (touches, code = 'MISLEADING_TIME_AXIS') => S.repairReach({ code, ...(touches ? { touches } : {}) });
const errors = (o) => R.validateReview({ accepted: false, summary: 'A deck with one finding to repair.', rating: 7, pages: [], findings: [major(o)] }, ['p02']).filter((e) => /touches|retitle/.test(e));
const schema = R.REVIEW_SCHEMA.properties.findings.items;
const retitle = [{ page: 'p02', title: 'The line shows the gap the months open' }];
console.log(JSON.stringify({
  words: Object.keys(REVIEW_TOUCHES), required: schema.required.includes('touches'), offered: schema.properties.touches.items.enum,
  // Every word writes fields of the one registry: the layout's three, or a field the critique is bound to.
  vocabulary: Object.values(REVIEW_TOUCHES).flatMap((t) => t.writes).every((field) => Object.hasOwn(SETTLED_LATER, field) || Object.hasOwn(S.BOUND_FIELDS, field)),
  stated: Object.fromEntries(Object.keys(REVIEW_TOUCHES).map((word) => [word, reach([word])])), mixed: reach(['copy', 'title']),
  // A record that does not say: by its code, where the code's repairs are all one or the other.
  unstated: { HEDGED_TITLE: reach(null, 'HEDGED_TITLE'), DEAD_SPACE: reach(null, 'DEAD_SPACE'), UNCLEAR_ARGUMENT: reach(null, 'UNCLEAR_ARGUMENT'), coined: reach(null), TEXT_FRAGMENTED: reach(null, 'TEXT_FRAGMENTED'), SPINE_UNFIT: reach(null, 'SPINE_UNFIT') },
  // Validation asks that it is said, on every finding, in the listed words; whether it is right is the reviewer's judgement.
  missing: errors({ touches: undefined }), empty: errors({ touches: [] }).length, unknown: errors({ touches: ['wording'] }), fine: errors({ touches: ['copy', 'structure'] }), none: errors({ severity: 'none', touches: [] }),
  // A finding of severity none asks for no repair, and still says so.
  noneMissing: errors({ severity: 'none', touches: undefined }), notList: errors({ touches: 'copy' }),
  // The repair's sentence is not read for what it changes: what the reviewer says in `touches` stands.
  unread: Object.fromEntries(Object.entries({ retitle: 'Retitle the page to the one measure its exhibit shows today.', rewrite: 'Rewrite the section title so it claims what its pages prove.', merge: 'Enlarge the table to fill the band or merge the page with p03.',
    cut: 'Cut the page and move its one number to the summary table.' }).map(([name, repair]) => [name, errors({ repair, touches: ['copy', 'layout'] })])),
  // A title it proposes is a field, and a finding that gives one says title in `touches`.
  retitled: [errors({ retitle, touches: ['title'] }), errors({ retitle, touches: ['copy'] })],
  carried: R.deckItems({ findings: [major({ touches: ['title'] })] })[0].touches, density: R.deckItems({ findings: [], density: { pages: [{ slide: 'p02', verdict: 'too thin', reason: 'The page carries a title and nothing a reader can use.' }] } })[0].touches,
  // A finding recorded before every finding had to say it is read by its code.
  recorded: S.repairReach(R.deckItems({ findings: [major({ touches: undefined, code: 'DEAD_SPACE' })] })[0]) }));
''')
        self.assertEqual(result['words'], ['copy', 'layout', 'exhibit-view', 'title', 'claim', 'evidence', 'structure'])
        self.assertTrue(result['required'])
        self.assertEqual(result['offered'], result['words'])
        self.assertTrue(result['vocabulary'])
        self.assertEqual(result['stated'], {'copy': 'layout', 'layout': 'layout', 'exhibit-view': 'argument', 'title': 'argument', 'claim': 'argument', 'evidence': 'argument', 'structure': 'argument'})
        self.assertEqual(result['mixed'], 'argument')
        self.assertEqual(result['unstated'], {'HEDGED_TITLE': 'argument', 'DEAD_SPACE': 'layout', 'UNCLEAR_ARGUMENT': 'unstated', 'coined': 'unstated', 'TEXT_FRAGMENTED': 'layout', 'SPINE_UNFIT': 'argument'})
        # A refusal names the finding that leaves it out.
        self.assertEqual(len(result['missing']), 1)
        self.assertTrue(result['missing'][0].startswith('findings[0] (F1): touches is missing - every finding says what its repair changes'), result['missing'][0])
        self.assertEqual(result['empty'], 1)
        self.assertIn('got wording', result['unknown'][0])
        self.assertEqual(result['fine'], [])
        self.assertEqual(result['none'], [])
        self.assertEqual(len(result['noneMissing']), 1)
        self.assertIn('findings[0] (F1): touches is missing', result['noneMissing'][0])
        self.assertIn('touches is not a list', result['notList'][0])
        self.assertEqual(result['unread'], {'retitle': [], 'rewrite': [], 'merge': [], 'cut': []})
        self.assertEqual(result['retitled'][0], [])
        self.assertEqual(len(result['retitled'][1]), 1)
        self.assertIn('findings[0] (F1): retitle rewrites a title and touches leaves out title: add "title" to touches', result['retitled'][1][0])
        self.assertEqual(result['carried'], ['title'])
        self.assertEqual(result['density'], ['copy'])
        self.assertEqual(result['recorded'], 'layout')

    def test_a_rejection_lists_what_is_repairable_without_reopening_the_argument_apart_from_what_reopens_it(self):
        result = run_node(FIXTURES + '''
const d = await prebuilt();
await storylineReady(d);
await deliver(d, { reviewer: 'packet' });
const rec = await record(d);
const findings = [major(), major({ id: 'F2', slides: ['p03'], dimension: 'argument', code: 'UNSUPPORTED_CLAIM', touches: ['title', 'copy'],
  reason: 'The title says the subject leads on every measure and the page shows one measure.', repair: 'Rewrite the title to the one measure the page shows, or add the other measures to the exhibit.',
  retitle: [{ page: 'p03', title: 'The subject leads the market on revenue, the one measure shown', words: { min: 8, max: 12 } }] }),
  major({ id: 'F3', slides: ['p04'], dimension: 'text', code: 'WALL_OF_TEXT', severity: 'minor', touches: ['copy'], repair: 'Cut the second paragraph, which restates the title.' })];
const rejected = await deliver(d, { reviewFile: await write(d, 'r1.json', { ...firstPass(rec, d.ids, findings), pages: d.ids.map((id) => pageEntry(id, id === 'p04' ? 'minor' : ['p02', 'p03'].includes(id) ? 'major' : 'ok')) }) });
const note = await fs.readFile(path.join(d.out, 'REJECTED.md'), 'utf8');
const pass = JSON.parse(await fs.readFile(path.join(d.store, 'review-history', 'pass-1.json'), 'utf8'));
await done(d);
const section = (heading) => (note.split('\\n## ').find((part) => part.startsWith(heading)) ?? '');
console.log(JSON.stringify({ at: rejected.rejectedAt, blockers: rejected.blockers.map((b) => [b.id, b.reach ?? null, b.decidable ?? null]), repairs: rejected.review.repairs, atSpine: rejected.review.atSpine, recorded: pass.atSpine,
  headings: note.split('\\n').filter((l) => l.startsWith('## ')), layout: [section('Repairable without reopening the argument').includes('MISLEADING_TIME_AXIS'), section('Repairable without reopening the argument').includes('UNSUPPORTED_CLAIM')],
  argument: [section('Reopen the argument').includes('UNSUPPORTED_CLAIM'), section('Reopen the argument').includes('visible at the spine'), section('Reopen the argument').includes('node runtime/storyline.mjs'),
    section('Reopen the argument').includes(S.POST_REVIEW_RULE)],
  // The title the reviewer proposes is a field, printed beside the repair for the author.
  proposed: section('Reopen the argument').includes('[Title proposed - p03: "The subject leads the market on revenue, the one measure shown", 8-12 words]'),
  rating: section('Blockers').includes('REVIEW_RATING'), lead: note.split('\\n')[4] }));
''')
        self.assertEqual(result['at'], 'review pass 1 of 3')
        self.assertEqual(result['blockers'], [['F1', 'layout', 'page'], ['F2', 'argument', 'spine'], ['rating', None, None]])
        self.assertEqual(result['repairs'], {'layout': 1, 'argument': 1, 'unstated': 0})
        # The open findings the storyline critic could have decided are counted on the pass, minor ones too.
        self.assertEqual(result['atSpine'], {'label': 'visible at the spine', 'findings': 1, 'blocking': 1})
        self.assertEqual(result['recorded']['ids'], ['F2'])
        self.assertEqual(result['headings'], ['## Blockers', '## Repairable without reopening the argument (1)', '## Reopen the argument (1)'])
        self.assertEqual(result['layout'], [True, False])
        self.assertEqual(result['argument'], [True, True, True, True])
        self.assertTrue(result['proposed'])
        self.assertTrue(result['rating'])
        self.assertIn('1 repairable without reopening the argument; 1 reopen the argument', result['lead'])

    def test_a_new_review_whose_finding_does_not_say_what_its_repair_changes_is_refused_naming_it(self):
        result = run_node(FIXTURES + '''
const d = await prebuilt();
await storylineReady(d);
await deliver(d, { reviewer: 'packet' });
const rec = await record(d);
const findings = [major(), major({ id: 'F2', slides: ['p03'], touches: undefined })];
const refused = await deliver(d, { reviewFile: await write(d, 'r1.json', { ...firstPass(rec, d.ids, findings), pages: d.ids.map((id) => pageEntry(id, ['p02', 'p03'].includes(id) ? 'major' : 'ok')) }) });
await done(d);
console.log(JSON.stringify({ at: refused.rejectedAt, blockers: refused.blockers.map((b) => [b.code, b.reason]) }));
''')
        self.assertEqual(result['at'], 'invalid review')
        self.assertEqual(len(result['blockers']), 1)
        code, reason = result['blockers'][0]
        self.assertEqual(code, 'INVALID_REVIEW')
        self.assertIn('findings[1] (F2): touches is missing', reason)


class PostReviewPassTests(unittest.TestCase):
    """Each rejected deck-review pass grants one scoped storyline pass outside the critique's cap."""

    SPENT = FIXTURES + CRITIQUE + '''
// A storyline brought to ready on its third and last pass.
async function spent(d) {
  let step = await S.prepareStoryline(d.specPath, d.out);
  step = await answer(d, step, { findings: [item('F1', 'p02')] });
  await retitle(d, 'p02', 'Page two states a narrower finding');
  step = await S.prepareStoryline(d.specPath, d.out);
  step = await answer(d, step, { open: true, statuses: [{ finding: 'F1', status: 'not fixed', evidence: 'The title still claims more than the page shows.' }] });
  await retitle(d, 'p02', 'Page two states only what its measure shows');
  step = await S.prepareStoryline(d.specPath, d.out);
  const ready = await answer(d, step, { statuses: [fixed('F1')] });
  if (ready.status !== 'ready' || ready.pass !== 3) throw new Error(`not ready at pass 3: ${JSON.stringify(ready)}`);
}
// The deck review's first pass, rejecting with `findings`.
async function reviewed(d, findings) {
  await deliver(d, { reviewer: 'packet' });
  return deliver(d, { reviewFile: await write(d, 'r1.json', firstPass(await record(d), d.ids, findings)) });
}
const claim = (page, o = {}) => major({ id: `F-${page}`, slides: [page], dimension: 'argument', code: 'UNSUPPORTED_CLAIM', touches: ['title'],
  reason: 'The title says the subject leads on every measure and the page shows one measure.', repair: 'Rewrite the title to the one measure the page shows.', ...o });
const history = async (d) => (await S.readStorylineHistory(d.store)).map((h) => [h.pass, h.review.verdict, h.postReview ? h.postReview.pages : null, h.kind ?? null]);
'''

    def test_the_pass_is_not_there_before_a_deck_review_and_one_is_there_after(self):
        result = run_node(self.SPENT + '''
const d = await prebuilt();
await spent(d);
// With the cap spent and no deck review, a changed title goes to the user.
await retitle(d, 'p03', 'Page three states a narrower finding');
const before = await S.prepareStoryline(d.specPath, d.out);
await retitle(d, 'p03', 'Title of p03 states one finding');
// The deck review rejects: one finding whose repair is the title of p03, one that is layout only on p04.
const rejected = await reviewed(d, [claim('p03'), major({ id: 'F9', slides: ['p04'] })]);
await retitle(d, 'p03', 'Page three states a narrower finding');
const gate = await S.storylineGate(d.spec, d.out, { deckPath: d.specPath });
const step = await S.prepareStoryline(d.specPath, d.out);
const packet = await staged(step);
const prompt = await fs.readFile(path.join(step.dir, 'prompt.md'), 'utf8');
// An item on a page outside the pass is refused; the pass then verifies p03 and is recorded as a post-review pass.
const outside = await answer(d, step, { statuses: [], findings: [{ ...item('F7', 'p05'), basis: 'missed', justification: 'The earlier pass could not see this because the page was not drawn when it read the spine.', evidence: 'Title of p05 states one finding' }] });
const ready = await answer(d, step, { statuses: [] });
const passes = await history(d);
// The budget is one: a second change after it is an ordinary pass, and the cap is spent.
await retitle(d, 'p03', 'Page three states a still narrower finding');
const again = await S.prepareStoryline(d.specPath, d.out);
// The deck review's own loop goes on under its own cap: the next pass is its second.
await retitle(d, 'p03', 'Page three states a narrower finding');
await fs.writeFile(path.join(d.out, 'rendered', 'slide-4.png'), 'pixels repaired');
const next = await deliver(d, { reviewer: 'packet' });
await done(d);
console.log(JSON.stringify({ before: [before.status, /is not available: no deck review has read this deck yet/.test(before.message ?? '')], rejected: rejected.rejectedAt, gate: gate.length,
  step: [step.status, step.pass, step.postReview], scope: [packet.scope.postReview.reviewPass, packet.scope.postReview.pages, packet.scope.postReview.findings.map((f) => [f.id, f.reach]), packet.scope.changed, packet.maxPasses],
  prompt: { opening: prompt.includes('the one post-review pass that deck review pass 1 allows'), uncapped: prompt.includes('it does not count against the cap of 3'), finding: prompt.includes('F-p03 · UNSUPPORTED_CLAIM'), layoutFinding: prompt.includes('F9 ·'),
    read: prompt.split('PAGES TO READ')[1].split('DATA FOUND')[0].split('\\n').filter((l) => /^\\d+\\. \\[/.test(l)).map((l) => l.match(/\\[(\\w+)\\]/)[1]), checks: prompt.includes('THE CHECKS.') },
  outside: [outside.status, (outside.errors || []).some((e) => /post-review pass, which reads p03 and the answer only; p05 is outside it/.test(e))],
  ready: [ready.status, ready.pass], passes, again: [again.status, /the one post-review pass deck review pass 1 allows is spent/.test(again.message ?? '')], next: [next.review?.status, next.review?.mode, next.review?.pass, next.review?.maxPasses] }));
''')
        self.assertEqual(result['before'], ['capped', True])
        self.assertEqual(result['rejected'], 'review pass 1 of 3')
        self.assertEqual(result['gate'], 1)  # the changed title is not passed by the old critique
        self.assertEqual(result['step'], ['packet-written', 4, {'reviewPass': 1, 'pages': ['p03']}])
        # Scoped to the page the argument finding names: the layout finding's page is not in it.
        self.assertEqual(result['scope'], [1, ['p03'], [['F-p03', 'argument']], ['p03'], 3])
        self.assertEqual(result['prompt'], {'opening': True, 'uncapped': True, 'finding': True, 'layoutFinding': False, 'read': ['p03'], 'checks': True})
        self.assertEqual(result['outside'], ['invalid', True])
        self.assertEqual(result['ready'], ['ready', 4])
        # The lineage marks the pass by kind, which is what keeps it out of the count of the critique's own three.
        self.assertEqual(result['passes'], [[1, 'revise', None, None], [2, 'revise', None, None], [3, 'ready', None, None], [4, 'ready', ['p03'], 'post-review']])
        self.assertEqual(result['again'], ['capped', True])
        self.assertEqual(result['next'], ['pending', 'verification', 2, 3])

    def test_it_reads_only_the_pages_the_findings_name(self):
        result = run_node(self.SPENT + '''
const d = await prebuilt();
await spent(d);
await reviewed(d, [claim('p03'), major({ id: 'F9', slides: ['p04'] })]);
// p04's finding is layout only: changing its title is not the repair the review asked for, so the pass does not cover it.
await retitle(d, 'p03', 'Page three states a narrower finding');
await retitle(d, 'p04', 'Page four says something else entirely');
const wide = await S.prepareStoryline(d.specPath, d.out);
await done(d);
// A review whose findings are all layout grants nothing: no repair of them reaches the argument.
const e = await prebuilt();
await spent(e);
await reviewed(e, [major()]);
await retitle(e, 'p02', 'Page two says something else entirely');
const none = await S.prepareStoryline(e.specPath, e.out);
await done(e);
console.log(JSON.stringify({ wide: [wide.status, /p04 changed, and no open finding of deck review pass 1 whose repair reaches the argument names it \\(it names p03\\)/.test(wide.message ?? '')],
  none: [none.status, /no open finding of deck review pass 1 has a repair that reaches the argument/.test(none.message ?? '')] }));
''')
        self.assertEqual(result['wide'], ['capped', True])
        self.assertEqual(result['none'], ['capped', True])

    def test_a_revisions_post_review_pass_reads_the_one_page_and_not_the_users_deck(self):
        result = run_node(REVISION + self.SPENT.replace(FIXTURES, '') + '''
// A revision that retitled p03: its critique reads that page, and is brought to ready on its last pass.
const d = await revised((slides) => slides.map((s) => s.id === 'p03' ? { ...s, title: 'A sharper finding for page three', pageType: { ...s.pageType, content: { claim: 'A sharper finding for page three' } } } : s));
let step = await S.prepareStoryline(d.specPath, d.out);
step = await answer(d, step, { findings: [item('F1', 'p03')] });
await retitle(d, 'p03', 'A finding for page three that its number shows');
step = await answer(d, await S.prepareStoryline(d.specPath, d.out), { open: true, statuses: [{ finding: 'F1', status: 'not fixed', evidence: 'The title still claims more than the page shows.' }] });
await retitle(d, 'p03', 'Page three: the total is 412 against 388');
const ready = await answer(d, await S.prepareStoryline(d.specPath, d.out), { statuses: [fixed('F1')] });
// The deck review of the revision reads the one changed page and sends its title back - in a finding that also names p02, a page of the
// user's deck the revision did not touch, where the old form of the claim still stands.
await deliver(d, { reviewer: 'packet' });
const rec = await record(d);
// It lists a page the revision did not change, so it says whose remedy it is: the changed page's own (`aboutImported: false`).
const both = claim('p03', { scope: 'deck', slides: ['p02', 'p03'], aboutImported: false, reason: 'The title of p03 says the total rose, and p02 still gives the total as flat.', repair: 'Rewrite the title of p03 to the one measure the page shows, and state the same total on p02.' });
const rejected = await deliver(d, { reviewFile: await write(d, 'r1.json', { ...firstPass(rec, ['p03'], [both]) }) });
const note = await fs.readFile(path.join(d.out, 'REJECTED.md'), 'utf8');
// Nothing obliges a storyline pass while only the user's page would be read: with p03 as it was, there is nothing to verify.
const idle = await S.prepareStoryline(d.specPath, d.out);
await retitle(d, 'p03', 'Page three: the total rose 6% to 412');
const post = await S.prepareStoryline(d.specPath, d.out);
// A later pass keeps the first pass's rule: no finding on the user's pages alone. Its prompt says so, and its validator holds it.
await answer(d, post, { statuses: [] });
await fs.writeFile(path.join(d.out, 'rendered', 'slide-4.png'), 'pixels repaired');
const second = await deliver(d, { reviewer: 'packet' });
const verify = await fs.readFile(path.join((await record(d)).staging, 'prompt.md'), 'utf8');
const scope = { pass: 2, verifies: rec.binding, maxPasses: 3, mustInspect: ['p03'], changed: ['p03'], deleted: [], open: [], rejudge: [] };
const alone = R.validateReview({ pass: 2, verifies: rec.binding, accepted: false, summary: 'One page of the deck as imported is weak.', rating: 7, binding: rec.binding, opened: ['p03'], pages: [], statuses: [],
  findings: [major({ id: 'F9', slides: ['p02'], basis: 'missed', justification: 'The earlier pass read only the changed page and so could not have seen this one.', evidence: 'the total is 412' })] }, d.ids, { scope, ledger: [], imported: ['p01', 'p02', 'p04', 'p05', 'p06'] });
const packet = await staged(post);
const prompt = await fs.readFile(path.join(post.dir, 'prompt.md'), 'utf8');
const files = (await fs.readdir(post.dir)).sort();
await done(d);
console.log(JSON.stringify({ ready: [ready.status, ready.pass], rejected: [rejected.rejectedAt, rejected.revision], post: [post.status, post.pass, post.postReview], files,
  imported: rejected.blockers.map((b) => b.imported ?? null), noted: note.includes("[About the imported deck: p02 is the user's page as imported, which this revision did not change. Repair the changed page;"),
  idle: idle.status, second: [second.review?.mode, second.review?.pass, second.review?.pages], told: verify.includes("THIS DECK IS A REVISION of the user's existing deck. p01, p02, p04, p05, p06 are pages of it that the revision did not change: validation refuses a new finding that names only those."), shown: packet.scope.postReview.findings.map((f) => f.pages), alone: alone.filter((e) => /as imported/.test(e)),
  read: prompt.split('PAGES TO READ')[1].split('DATA FOUND')[0].split('\\n').filter((l) => /^\\d+\\. \\[/.test(l)).length, context: prompt.split('THE TITLE SPINE NOW')[1].split('PAGES TO READ')[0].split('\\n').filter((l) => /^\\d+\\. \\[/.test(l)).length,
  measures: prompt.split('THE TITLE SPINE NOW')[1].split('PAGES TO READ')[0].includes('rests on:') }));
''')
        self.assertEqual(result['ready'], ['ready', 3])
        self.assertEqual(result['rejected'], ['review pass 1 of 3', {'changed': 1, 'of': 6}])
        # The finding names the changed page and a page of the imported deck: the rejection says which is the user's, and the pass reads the changed one only.
        self.assertEqual(result['imported'], [['p02'], None])
        self.assertTrue(result['noted'])
        self.assertEqual(result['idle'], 'ready')
        self.assertEqual(result['post'], ['packet-written', 4, {'reviewPass': 1, 'pages': ['p03']}])
        self.assertEqual(result['shown'], [['p03']])
        # The deck review's own second pass verifies the changed page and the page its open finding names, and no more.
        self.assertEqual(result['second'], ['verification', 2, 2])
        self.assertTrue(result['told'])
        self.assertEqual(len(result['alone']), 1)
        self.assertIn("p02 is the user's page as imported, unchanged by this revision", result['alone'][0])
        # One prompt, one page read; the user's other pages appear as titles for context and nothing more.
        self.assertEqual(result['files'], ['packet.json', 'prompt.md', 'schema.json'])
        self.assertEqual(result['read'], 1)
        self.assertEqual(result['context'], 7)  # the cover and the six pages, a title each
        self.assertFalse(result['measures'])


# A built deck's measured outputs, written beside the fixture's scene the way the build writes them.
FLOORS = '''
import { reviewFloors, floorsPrompt, floorErrors, titleErrors, titleLimits, retitleErrors } from './skills/professional-slides/runtime/review-floors.mjs';
async function measured(d, { fragmented = 54.5 } = {}) {
  const scene = JSON.parse(await fs.readFile(path.join(d.out, 'scene.json'), 'utf8'));
  scene.slides.forEach((slide, i) => { if (i) Object.assign(slide, { readingTask: 'chart-with-commentary', wordFloor: 96, wordCeiling: 293 }); });
  scene.slides[2].nodes.push({ type: 'text', role: 'source-text', text: 'Source: the annual report of the subject for the year' });
  await fs.writeFile(path.join(d.out, 'scene.json'), JSON.stringify(scene));
  const ids = scene.slides.slice(1).map((s) => s.id);
  const standing = (key, side, bar) => ({ code: 'TEXT_FRAGMENTED', key, what: 'median words a block on the prose pages', value: fragmented, bar, side, unit: 'words', applies: true, blocks: true, each: Object.fromEntries(ids.slice(0, 3).map((id) => [id, 48])) });
  await fs.writeFile(path.join(d.out, 'density-profile.json'), JSON.stringify({ deck: { comparedPages: 3, wordsPerBlock: { measured: fragmented, target: 55.8, band: [41.3, 86.5], position: 'within' } }, flaggedPages: [],
    standings: [standing('floor', 'min', 41.3), standing('ceiling', 'max', 86.5)], pages: ids.map((id, i) => ({ page: i + 2, id, task: 'chart-with-commentary', bodyWords: 150 + i, blocks: 3, wordsPerBlock: 48, longestBlock: 70, flags: [] })) }));
  await fs.writeFile(path.join(d.out, 'gates.json'), JSON.stringify({ findings: [], standings: [
    { code: 'PAGE_SHAPE_FLAT', key: 'share', what: 'pages on the commonest architecture', value: 0.4, bar: 0.4, side: 'max', count: 2, of: 5, applies: true, blocks: true, pages: [2, 3] },
    { code: 'EVIDENCE_MIX', what: 'pages carrying a chart, a table or measured tiles', value: 0.8, bar: 0.45, side: 'min', count: 4, of: 5, applies: true, blocks: false }] }));
  return scene;
}
'''


class ReviewFloorsTests(unittest.TestCase):
    def test_the_reviewer_is_shown_the_floors_from_the_builds_own_outputs(self):
        result = run_node(FIXTURES + FLOORS + '''
const d = await prebuilt();
const scene = await measured(d);
await storylineReady(d);
await deliver(d, { reviewer: 'packet' });
const rec = await record(d);
const packet = JSON.parse(await fs.readFile(path.join(rec.staging, 'packet.json'), 'utf8'));
const prompt = await fs.readFile(path.join(rec.staging, 'prompt.md'), 'utf8');
const floors = await reviewFloors(d.out, scene);
// A deck not rendered has no profile: the floors are what the scene alone says.
await fs.rm(path.join(d.out, 'density-profile.json'));
const bare = await reviewFloors(d.out, scene);
await done(d);
console.log(JSON.stringify({ p01: packet.floors.pages.p01, p02: packet.floors.pages.p02, deck: packet.floors.deck, band: packet.floors.band, pages: Object.keys(packet.floors.pages),
  said: ['FLOORS THE BUILD HOLDS', '- p01: 150 body words, held to 96-293 (chart-with-commentary); 3 blocks at 48 words a block (a prose page: counts toward the deck\\'s 41.3-86.5 band); counts toward PAGE_SHAPE_FLAT.share',
    'TEXT_FRAGMENTED.floor: median words a block on the prose pages 54.5; floor 41.3', 'PAGE_SHAPE_FLAT.share: pages on the commonest architecture 2 of 5 pages, 40%; cap 40%: at the cap, 1 more blocks'].map((text) => prompt.includes(text)),
  titles: [packet.floors.titles.title.words.max, prompt.includes('Titles: a page title runs to 6-15 words (10 the norm) on 2 lines at most. A title a finding proposes in `retitle`')], roomy: prompt.includes('EVIDENCE_MIX'), same: JSON.stringify(floors.pages.p01) === JSON.stringify(packet.floors.pages.p01), bare: [bare.band, bare.pages.p01.words, bare.pages.p01.blocks ?? null] }));
''')
        self.assertEqual(result['p01'], {'words': {'now': 150, 'floor': 96, 'ceiling': 293, 'task': 'chart-with-commentary'}, 'blocks': {'count': 3, 'wordsPerBlock': 48, 'prose': True}, 'rules': ['PAGE_SHAPE_FLAT.share']})
        # The footer's share is counted from the scene with the gate's own bands, against the gate's own bar.
        self.assertEqual(result['p02']['footer'], {'share': 0.48, 'max': 0.3})
        self.assertEqual(result['band'], [41.3, 86.5])
        self.assertEqual(len(result['deck']), 3)  # the rule at its cap and the two sides of the words-a-block band; a rule with room is not listed
        self.assertEqual(result['pages'], ['p01', 'p02', 'p03', 'p04', 'p05', 'p06'])
        self.assertEqual(result['said'], [True, True, True, True])
        self.assertFalse(result['roomy'])
        self.assertEqual(result['titles'], [15, True])
        self.assertTrue(result['same'])
        self.assertEqual(result['bare'], [None, {'now': 11, 'floor': 96, 'ceiling': 293, 'task': 'chart-with-commentary'}, None])

    def test_a_repair_that_states_a_count_the_build_refuses_says_how_the_page_stays_inside(self):
        result = run_node(FIXTURES + FLOORS + '''
const d = await prebuilt();
const scene = await measured(d);
const floors = await reviewFloors(d.out, scene);
const errors = (o) => floorErrors([major({ slides: ['p01'], ...o })], floors);
const out = {
  under: errors({ repair: 'Cut the commentary to about 60 words so the chart leads the page.' }), over: errors({ repair: 'Add the mechanism and the limitation, taking the page to 320-350 words.' }),
  inside: errors({ repair: 'Cut the commentary to about 120-150 words in two blocks.' }), blocks: errors({ repair: 'Split the points so each runs to 20 words a block.' }),
  said: errors({ repair: 'Cut the commentary to about 60 words so the chart leads the page.', floors: 'The page changes to a chart-led form, whose floor is 42 words.' }),
  unstated: errors({ repair: 'Halve the commentary so the chart leads the page.' }), elsewhere: floorErrors([major({ slides: ['cover'], repair: 'Cut the cover to 5 words.' })], floors),
  // Delivery holds an answer to it: the review is refused on form, not recorded.
  review: R.validateReview({ accepted: false, summary: 'A deck with one finding to repair.', rating: 7, pages: [], findings: [major({ slides: ['p01'], repair: 'Cut the commentary to about 60 words so the chart leads the page.' })] }, d.ids, { floors }).filter((e) => /floors/.test(e)).length,
  part: R.validatePart({ part: { kind: 'section', id: 's1', slides: ['p01'] }, findings: [major({ slides: ['p01'], repair: 'Cut the commentary to about 60 words so the chart leads the page.' })] }, d.ids, { floors }).filter((e) => /floors/.test(e)).length,
  offered: 'floors' in R.REVIEW_SCHEMA.properties.findings.items.properties && !R.REVIEW_SCHEMA.properties.findings.items.required.includes('floors') };
// A length given for one part of the page is not the page's: only a count the sentence gives for the body is held to the band.
out.part_of_page = errors({ repair: 'Keep the two row notes and add one developed takeaway of 40 to 60 words under the table.' });
out.target = errors({ repair: 'Cut the restatement from the third block. Target about 60 words.' }).length;
// A title the finding proposes, or sizes, in `retitle` is held to the title limits, and `floors` does not excuse it.
const titled = await reviewFloors(d.out, scene, { spec: d.spec, base: d.dir });
const long = 'The subject leads the market on revenue, on margin, on growth and on reach in every year shown';
const retitled = (entry, o = {}) => major({ slides: ['p01'], touches: ['title'], repair: 'Retitle the page to the measures its exhibit shows.', retitle: [{ page: 'p01', ...entry }], ...o });
out.titles = titled.titles;
out.title = [floorErrors([retitled({ title: long }, { floors: 'The subtitle takes the period and the scope.' })], titled), floorErrors([retitled({ title: 'The subject leads the market on revenue and margin' })], titled),
  floorErrors([retitled({ words: { min: 16, max: 18 } })], titled), floorErrors([retitled({ title: long })], floors),
  // A title in the repair's sentence alone is not read: the finding says it in `retitle`, or it is not held.
  floorErrors([major({ slides: ['p01'], repair: `Retitle to "${long}".` })], titled)];
// A length the sentence gives a title is the title's, not a count asked of the page's body.
out.titleInSentence = floorErrors([retitled({ words: { min: 12, max: 12 } }, { repair: 'Rewrite the title to 12 words so that it names one measure.' })], floors);
// A section title is held to what this deck's dividers hold: the page an entry names says which title is meant.
const limits = { title: titled.titles.title, sectionTitle: { words: 9, lines: 2 } };
const ten = [{ page: 's1', title: 'The subject out-earns each reporting rival with almost no debt' }];
out.section = [titleErrors(ten, limits, 'F1', { dividers: ['s1'] }), titleErrors(ten, limits, 'F1'), titleErrors([{ page: 's1', words: { min: 10, max: 12 } }], limits, 'F1', { dividers: ['s1'] }).length];
// Its form holds without the limits: a page of the finding's own, once, with a title, a length or both.
out.form = [retitleErrors([{ page: 'p09', title: 'A title for another page' }], ['p01'], 'F1'), retitleErrors([{ page: 'p01' }], ['p01'], 'F1'), retitleErrors([{ page: 'p01', words: { min: 12, max: 8 } }], ['p01'], 'F1'),
  retitleErrors([], ['p01'], 'F1'), retitleErrors([{ page: 'p01', title: 'A title for the page', note: 'x' }, { page: 'p01', title: 'Another title for it' }], ['p01'], 'F1'), retitleErrors(undefined, ['p01'], 'F1')];
const withDivider = titleLimits({ slides: [{ id: 's1', kind: 'section', title: 'The market' }, ...d.spec.slides] }, d.dir);
out.measured = [withDivider.sectionTitle.lines, withDivider.sectionTitle.words > 2 && withDivider.sectionTitle.words < 30, 'sectionTitle' in titled.titles];
await done(d);
console.log(JSON.stringify(out));
''')
        self.assertEqual(len(result['under']), 1)
        self.assertIn('asks for 60 words on p01, and the build holds that page to 96-293 body words (it carries 150)', result['under'][0])
        self.assertIn('320-350 words', result['over'][0])
        self.assertEqual(result['inside'], [])
        self.assertIn('20 words a block on p01, a prose page', result['blocks'][0])
        self.assertEqual(result['said'], [])
        self.assertEqual(result['unstated'], [])  # only a stated number is caught; the prompt and the gate hold the rest
        self.assertEqual(result['elsewhere'], [])
        self.assertEqual([result['review'], result['part']], [1, 1])
        self.assertTrue(result['offered'])
        self.assertEqual(result['part_of_page'], [])
        self.assertEqual(result['target'], 1)
        self.assertEqual(result['titles'], {'title': {'words': {'min': 6, 'max': 15, 'target': 10}, 'lines': 2}})
        # Without the deck, no title limit is shown and none is held; a title in the sentence alone is not read.
        self.assertEqual([len(e) for e in result['title']], [1, 0, 1, 0, 0])
        self.assertIn('the title it proposes for p01 runs to 18 words', result['title'][0][0])
        self.assertIn('the build refuses a page title past 15 (TITLE_WORDS): propose one of 15 words or fewer', result['title'][0][0])
        self.assertIn('asks for a title of 16-18 words on p01', result['title'][2][0])
        self.assertEqual(result['titleInSentence'], [])
        self.assertIn('runs to 10 words', result['section'][0][0])
        self.assertIn('refuses a section title past 9', result['section'][0][0])
        self.assertEqual([result['section'][1], result['section'][2]], [[], 1])  # a page that is not a divider holds a page title
        self.assertEqual([len(e) for e in result['form']], [1, 1, 1, 1, 2, 0])
        self.assertIn("names page p09: its page is one of the finding's own (p01)", result['form'][0][0])
        self.assertIn('gives neither the title proposed nor a length', result['form'][1][0])
        self.assertEqual(result['measured'], [2, True, False])

    def test_a_one_page_revision_is_shown_one_pages_floors(self):
        result = run_node(REVISION + FLOORS + '''
const d = await revised((slides) => slides.map((s) => s.id === 'p05' ? { ...s, points: ['On p05 the total fell to 301, a third below the year before, as two routes closed.'] } : s));
await measured(d);
const critique = await S.prepareStoryline(d.specPath, d.out);
const pending = await deliver(d, { reviewer: 'packet' });
const rec = await record(d);
const packet = JSON.parse(await fs.readFile(path.join(rec.staging, 'packet.json'), 'utf8'));
const prompt = await fs.readFile(path.join(rec.staging, 'prompt.md'), 'utf8');
const files = (await fs.readdir(rec.staging)).filter((f) => f !== 'rendered').sort();
const listed = prompt.split('Per page (body words')[1].split('\\n\\n')[0].split('\\n').filter((l) => l.startsWith('- p'));
await done(d);
console.log(JSON.stringify({ critique: [critique.status, critique.pass], review: [pending.review.mode, pending.review.pages, pending.review.sections], files, floors: Object.keys(packet.floors.pages), listed: listed.map((l) => l.slice(2, 5)),
  example: prompt.includes('"slides":["p05"]'), deck: packet.floors.deck.length, titles: packet.floors.titles.title.words.max }));
''')
        # A one-page copy revision: no storyline prompt, and one review prompt that reads one page.
        self.assertEqual(result['critique'], ['ready', 0])
        self.assertEqual(result['review'], ['revision', 1, 0])
        self.assertEqual(result['files'], ['packet.json', 'prompt.md', 'schema.json'])
        self.assertEqual(result['floors'], ['p05'])
        self.assertEqual(result['listed'], ['p05'])
        self.assertTrue(result['example'])
        self.assertEqual(result['deck'], 3)  # the deck's rules a repair of that page could break are still said
        self.assertEqual(result['titles'], 15)


class SectionFormTests(unittest.TestCase):
    PARTS = FIXTURES + '''
// A deck long enough to be read in sections, and the packet delivery stages for it.
async function long(deck = {}) {
  const d = await prebuilt({ count: 30, deck });
  await storylineReady(d);
  const pending = await deliver(d, { reviewer: 'packet' });
  const rec = await record(d);
  const read = async (name) => fs.readFile(path.join(rec.staging, name), 'utf8');
  return { d, rec, pending, read, section: rec.sections[0] };
}
// A section part written exactly as its prompt describes: the prompt's own example finding and completeness entry, one entry per dimension it lists.
const asPrompted = (rec, section, prompt, o = {}) => {
  const example = JSON.parse(prompt.split('A finding that passes: ')[1].split('\\n')[0]);
  const entry = JSON.parse(prompt.split('A completeness entry that passes: ')[1].split('\\n')[0]);
  const dims = prompt.split('`completeness` holds exactly one entry for each of ')[1].split(', and for no other dimension')[0].split(', ');
  return { part: JSON.parse(prompt.split('Set part to ')[1].split('. Bind to')[0]), binding: rec.binding, accepted: false, summary: 'The section argues its part; one chart leaves its finding unmarked.', rating: 7,
    opened: [...section.slides], provenance: provenanceOf(rec), pages: section.slides.map((id) => pageEntry(id, id === example.slides[0] ? 'major' : 'ok')), findings: [example],
    completeness: dims.map((dimension) => (dimension === example.dimension ? { dimension, result: 'findings', note: 'Filed F1: the gap is unmarked.' } : { ...entry, dimension, note: entry.note.replace(entry.dimension, dimension) })),
    density: { deck: 'Judged by the spine reviewer for the whole deck.', pages: [] }, ...o };
};
'''

    def test_a_section_part_written_as_its_prompt_describes_validates(self):
        result = run_node(self.PARTS + '''
const { d, rec, read, section } = await long();
const prompt = await read(`sections/${section.id}.md`);
const part = asPrompted(rec, section, prompt);
const schema = JSON.parse(await read('part-schema.json')), spineSchema = JSON.parse(await read('spine-part-schema.json'));
const spine = await read('sections/spine.md');
const out = { errors: R.validatePart(part, d.ids), rule: prompt.includes('`completeness` holds exactly one entry for each of argument, evidence, chart, table, text, layout, identity, sourcing, and for no other dimension'),
  // The schema a section reviewer is shown offers the page dimensions and nothing the validator refuses of a section.
  completeness: schema.properties.completeness.items.properties.dimension.enum, findings: schema.properties.findings.items.properties.dimension.enum, extra: ['assessment', 'waivers'].filter((key) => key in schema.properties),
  inPrompt: prompt.includes(JSON.stringify(schema)), rubric: R.DECK_DIMENSIONS.filter((dim) => prompt.includes(`- ${dim} (deck)`)),
  told: prompt.includes("consistency, rhythm, bookends are read across the whole deck by the spine reviewer: you write no note, no completeness entry and no finding under them"),
  spine: [spineSchema.properties.completeness.items.properties.dimension.enum, spineSchema.properties.findings.items.properties.dimension.enum.length, spineSchema.required.includes('assessment'), spine.includes(JSON.stringify(spineSchema)),
    spine.includes('`completeness` holds exactly one entry for each of consistency, rhythm, bookends, and for no other dimension')] };
// Whatever a schema's enum offers, the validator of that kind of part accepts; what the validator refuses, the schema does not offer.
out.agree = R.DIMENSIONS.map((dimension) => {
  const offered = out.completeness.includes(dimension);
  const errors = R.validatePart({ ...part, completeness: [...part.completeness.filter((c) => c.dimension !== dimension), { dimension, result: 'clean', note: 'Checked it on every page given and found nothing to raise.' }] }, d.ids);
  return offered === !errors.some((e) => /unknown dimension/.test(e));
});
out.deckFinding = R.validatePart({ ...part, findings: [{ ...part.findings[0], dimension: 'consistency' }] }, d.ids).filter((e) => /dimension must be one of/.test(e));
out.withAssessment = R.validatePart({ ...part, assessment: assessment() }, d.ids).filter((e) => /assessment/.test(e)).length;
await done(d);
console.log(JSON.stringify(out));
''')
        self.assertEqual(result['errors'], [])
        self.assertTrue(result['rule'])
        page = ['argument', 'evidence', 'chart', 'table', 'text', 'layout', 'identity', 'sourcing']
        self.assertEqual(result['completeness'], page)
        self.assertEqual(result['findings'], page)
        self.assertEqual(result['extra'], [])
        self.assertTrue(result['inPrompt'])
        self.assertEqual(result['rubric'], [])
        self.assertTrue(result['told'])
        self.assertEqual(result['spine'], [['consistency', 'rhythm', 'bookends'], 11, True, True, True])
        self.assertEqual(result['agree'], [True] * 11)
        self.assertIn("consistency is the spine reviewer's", result['deckFinding'][0])
        self.assertEqual(result['withAssessment'], 1)

    def test_the_prompt_states_the_rules_the_validator_enforces_and_a_refusal_gathers_them(self):
        result = run_node(self.PARTS + '''
const { d, rec, read, section } = await long();
const prompt = await read(`sections/${section.id}.md`);
const good = asPrompted(rec, section, prompt);
const [a, b, c] = section.slides;
const f = (id, slides, o = {}) => ({ ...good.findings[0], id, slides, scope: slides.length > 1 ? 'deck' : 'page', ...o });
// The form failures of the benchmark's first answers, each in several places.
const bad = { ...good, pages: section.slides.map((id) => pageEntry(id, [a, b, c].includes(id) ? 'major' : 'ok')), findings: [
  f('F1', [a], { repair: 'Give the chart a bracket between the two end labels with the gap.' }), f('F2', [b], { repair: 'Tidy it.' }), f('F3', [c], { repair: 'Put the gap on the chart where the reader looks for it first.' }),
  f('F4', [a, b], { reason: `The same unmarked gap recurs on several pages, including ${a} and ${b}, so the reader subtracts each time.` }),
  f('F5', [a, b], { reason: `The gap is unmarked on ${a}, ${b} and ${c}, so the reader subtracts each time.` }), f('F6', [a], { touches: undefined })],
  completeness: [...good.completeness.map((entry) => (entry.dimension === 'sourcing' ? { ...entry, result: 'clean', note: 'ok' } : entry)), { dimension: 'consistency', result: 'clean', note: 'Checked the constructions across my pages and found none repeated.' },
    { dimension: 'rhythm', result: 'clean', note: 'Checked the order of my pages and found that it builds.' }] };
const errors = R.validatePart(bad, d.ids).map((e) => `${section.id}: ${e}`);
const grouped = R.groupedErrors(errors, R.PAGE_DIMENSIONS);
const rules = R.formRules(R.PAGE_DIMENSIONS);
// Every rule the prompt states is one the validator enforces: each error above falls under a stated rule, and each stated rule is in the prompt.
const out = { errors: errors.length, grouped: grouped.length, unmatched: errors.filter((e) => !rules.some((r) => r.matches.test(e))), stated: rules.filter((r) => !prompt.includes(r.rule)).map((r) => r.id),
  repair: grouped.find((g) => /concrete repair sentence/.test(g)), verbs: R.REPAIR_VERBS.every((verb) => prompt.includes(verb)), sampled: grouped.find((g) => /by example/.test(g)), completeness: grouped.find((g) => /completeness: unknown dimension/.test(g)),
  // The corrected part: the prompt's verbs, every page listed, no sampling word, the listed dimensions only.
  corrected: R.validatePart({ ...bad, findings: [f('F1', [a], { repair: 'Add a bracket between the two end labels and label it with the gap.' }), f('F5', [a, b, c], { reason: `The gap is unmarked on ${a}, ${b} and ${c}, so the reader subtracts each time.` })], completeness: good.completeness }, d.ids),
  // An id that is an ordinary word names a page only where it is written as an id.
  word: [[...P.pageRefs('The cover ratio is on no mark, and the summary repeats it.', ['cover', 'summary', 'p01'])], [...P.pageRefs('The date on [cover] differs from p01.', ['cover', 'summary', 'p01'])]] };
// The merge reports the same errors gathered: what delivery prints once per rule.
await fs.mkdir(path.join(rec.staging, 'parts'), { recursive: true });
await fs.writeFile(path.join(rec.staging, 'parts', `${section.id}.json`), JSON.stringify(bad));
const merged = await R.mergeReviewDirectory(d.out, null, { spec: d.spec, deckPath: d.specPath });
out.merged = [merged.status, merged.grouped.length < merged.errors.length, merged.grouped.some((g) => /places break one rule/.test(g))];
await done(d);
console.log(JSON.stringify(out));
''')
        self.assertEqual(result['unmatched'], [])
        self.assertEqual(result['stated'], [])
        self.assertGreater(result['errors'], result['grouped'])
        # One line a rule: the rule as the prompt stated it, every place it was broken, and the first error in full.
        self.assertIn('3 places break one rule - `repair`, on every finding whose severity is not none: 40 characters or more for a major or blocker', result['repair'])
        self.assertIn('F1', result['repair'])
        self.assertIn('F3', result['repair'])
        self.assertIn('none of the verbs the rule looks for is in it', result['repair'])
        self.assertTrue(result['verbs'])
        self.assertIn('lists pages by example ("including ...")', result['sampled'])  # broken once: said as it was raised
        self.assertIn('2 places break one rule - `completeness` holds exactly one entry for each of', result['completeness'])
        self.assertEqual(result['corrected'], [])
        self.assertEqual(result['word'], [[], ['cover', 'p01']])
        self.assertEqual(result['merged'], ['invalid', True, True])


class StorylineFormTests(unittest.TestCase):
    """The critic's prompt states the rules of form its validator enforces, from one table."""

    def test_a_critique_written_as_the_spine_prompt_describes_validates_and_every_refusal_is_a_stated_rule(self):
        result = run_node(FIXTURES + CRITIQUE + '''
const d = await prebuilt();
const step = await S.prepareStoryline(d.specPath, d.out);
const packet = await staged(step);
const prompt = await fs.readFile(path.join(step.dir, 'prompt.md'), 'utf8');
const rules = S.storylineFormRules({ cap: S.SPINE_ITEM_MAX });
const context = { ids: packet.pages.map((p) => p.id), contentIds: packet.pages.filter((p) => !p.kind || p.kind === 'content').map((p) => p.id), mode: packet.mode, promptHash: packet.promptHash, limits: packet.limits };
const errors = (o, edit = (c) => c) => S.validateStorylineRecord(edit(critique(packet, o)), context);
const spine = (id, pages, o = {}) => ({ ...item(id, pages[0]), scope: 'spine', pages, ...o });
// Each rule of form broken once, as a critic breaks it.
const broken = {
  cap: errors({ findings: Array.from({ length: 11 }, (_, i) => item(`F${i + 1}`, `p0${(i % 6) + 1}`)) }),
  pages: errors({ findings: [{ ...item('F1', 'p02'), pages: ['p02', 'p03'] }] }),
  sampled: errors({ findings: [spine('F1', ['p02', 'p03'], { problem: 'Several titles claim more than their pages show, including p02 and p03 among them.' })] }),
  title: errors({ findings: [{ ...item('F1', 'p02'), retitle: [{ page: 'p02', title: 'The subject leads the market on revenue, on margin, on growth and on reach in every year shown' }] }] }),
  retitle: errors({ findings: [{ ...item('F1', 'p02'), retitle: [{ page: 'p03', title: 'A narrower title for the next page' }] }] }) };
const all = Object.values(broken).flat();
// The fix's sentence is not read for a title: one it quotes and does not give in `retitle` is not held.
const unread = errors({ findings: [{ ...item('F1', 'p02'), fix: 'Retitle to "The subject leads the market on revenue, on margin, on growth and on reach in every year shown".' }] });
// A page a spine finding's text names and its list leaves out is not a refusal: the runtime adds it and says it did.
const leftOut = S.settleCritiqueForm(critique(packet, { findings: [spine('F1', ['p02'], { problem: 'The claim on p02 is restated on p03 with the same measure and no new step.' })] }), context.ids, context.contentIds);
await done(d);
console.log(JSON.stringify({ leftOut: [leftOut.review.findings[0].pages, leftOut.mended.map((m) => [m.did, m.pages]), S.validateStorylineRecord(leftOut.review, context)], good: errors({}), found: errors({ findings: [item('F1', 'p02')] }), limits: packet.limits, shown: prompt.includes('LIMITS THE BUILD HOLDS: a page title runs to 6-15 words (10 the norm) on 2 lines at most.'),
  stated: rules.filter((rule) => !prompt.includes(`- ${rule.rule}`)).map((rule) => rule.id), ids: rules.map((rule) => rule.id), unmatched: all.filter((e) => !rules.some((rule) => rule.matches.test(e))),
  each: Object.fromEntries(Object.entries(broken).map(([name, list]) => [name, list.length])), title: broken.title[0], retitle: broken.retitle[0], unread, cap: broken.cap[0].slice(0, 44) }));
''')
        self.assertEqual(result['good'], [])
        self.assertEqual(result['found'], [])
        self.assertEqual(result['limits'], {'title': {'words': {'min': 6, 'max': 15, 'target': 10}, 'lines': 2}})
        self.assertTrue(result['shown'])
        self.assertEqual(result['ids'], ['cap', 'pages', 'sampled', 'title'])
        self.assertEqual(result['leftOut'], [['p02', 'p03'], [['named', ['p03']]], []])
        self.assertEqual(result['stated'], [])     # every rule the validator enforces is in the prompt, word for word
        self.assertEqual(result['unmatched'], [])  # and every refusal above is one of them
        self.assertTrue(all(n >= 1 for n in result['each'].values()), result['each'])
        self.assertIn('the title it proposes for p02 runs to 18 words', result['title'])
        self.assertIn("retitle[0] names page p03: its page is one of the finding's own (p02)", result['retitle'])
        self.assertEqual(result['unread'], [])
        self.assertEqual(result['cap'], 'the spine critique returns at most 10 items ')

    def test_a_long_spines_section_and_spine_parts_are_offered_only_what_a_critic_judges(self):
        result = run_node(FIXTURES + '''
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'storyline-parts-'));
const specPath = path.join(dir, 'fixture.deck.json');
const content = Array.from({ length: 40 }, (_, i) => ({ id: `q${i + 1}`, title: `Title of q${i + 1} states one finding` }));
await fs.writeFile(specPath, JSON.stringify({ id: 'fixture', workflow: 'new_deck', request: 'Who leads in the short run and the long run?', answer: 'The subject leads on both horizons.', slides: [{ id: 'd1', kind: 'section', title: 'The whole market' }, ...content] }));
const { dir: staging, packet } = await S.buildStorylinePacket(specPath, path.join(dir, 'out'), { mode: 'full' });
const read = async (name) => fs.readFile(path.join(staging, name), 'utf8');
const section = packet.sections[0];
const [sectionPrompt, spinePrompt] = [await read(`sections/${section.id}.md`), await read('sections/spine.md')];
const [sectionSchema, spineSchema] = [JSON.parse(await read('part-schema.json')), JSON.parse(await read('spine-part-schema.json'))];
// What the runtime reads off the ledger is offered to neither part: a critic is asked only what it judges.
const derived = (schema) => Object.keys(schema.properties).filter((key) => ['verdict', 'compliance', 'sufficiency', 'completeness'].includes(key));
const out = { offered: [derived(sectionSchema), derived(spineSchema)], kinds: [sectionSchema.properties.part.properties.kind.enum, spineSchema.properties.part.properties.kind.enum],
  inPrompt: [sectionPrompt.includes(JSON.stringify(sectionSchema)), spinePrompt.includes(JSON.stringify(spineSchema))],
  required: [sectionSchema.required.includes('answerParts'), spineSchema.required.includes('answerParts')], divider: packet.limits.sectionTitle.lines };
await fs.rm(dir, { recursive: true, force: true }); await fs.rm(staging, { recursive: true, force: true });
console.log(JSON.stringify(out));
''')
        self.assertEqual(result['offered'], [[], []])
        self.assertEqual(result['kinds'], [['section'], ['spine']])
        self.assertEqual(result['inPrompt'], [True, True])
        self.assertEqual(result['required'], [False, True])
        self.assertEqual(result['divider'], 2)  # a deck with dividers is told what a section title holds


class DeckReviewRepeatsTests(unittest.TestCase):
    """The repeat measurement on a deck-review packet delivery staged, with a fake reviewer: no model is called."""

    def repeats(self, staging, tmp, env=None):
        config = Path(tmp) / 'config.json'
        config.write_text(json.dumps({'defaults': {'judge': 'fake'}, 'judges': {'fake': {'model': 'fixture', 'timeoutMinutes': 1,
                                      'command': [NODE, str(ROOT / 'evals' / 'quality' / 'fixtures' / 'fake-reviewer.mjs'), '{prompt}', '{schemaJson}']}}}))
        out = Path(tmp) / 'review.json'
        run = subprocess.run([NODE, str(ROOT / 'evals' / 'quality' / 'critic-calibration.mjs'), '--config', str(config), '--out', str(out), '--repeats', '3', '--review-packet', staging],
                             capture_output=True, text=True, cwd=ROOT, env={**os.environ, **(env or {})})
        return run, json.loads(out.read_text())['review']

    def test_one_staged_packet_answered_three_times_gives_the_spread_and_the_findings_the_spine_owed(self):
        staged = run_node(FIXTURES + '''
const d = await prebuilt();
await storylineReady(d);
await deliver(d, { reviewer: 'packet' });
const rec = await record(d);
console.log(JSON.stringify({ dir: d.dir, staging: rec.staging }));
''')
        self.addCleanup(shutil.rmtree, staged['dir'], ignore_errors=True)
        self.addCleanup(shutil.rmtree, staged['staging'], ignore_errors=True)
        with tempfile.TemporaryDirectory() as tmp:
            run, clean = self.repeats(staged['staging'], tmp)
            self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
            self.assertEqual((clean['kind'], clean['pages'], clean['valid'], clean['accepted']), ('deck-review', 7, 3, 3))
            self.assertEqual(clean['rating'], {'n': 3, 'mean': 8.4, 'sd': 0.2, 'min': 8.2, 'max': 8.6})
            self.assertEqual(clean['atSpine']['mean'], 0)
            # A reviewer that finds a title outrunning its page: every answer holds one blocking finding the critic could have decided.
            run, found = self.repeats(staged['staging'], tmp, env={'FAKE_REVIEWER_FINDING': '1'})
            self.assertEqual((found['valid'], found['accepted'], found['findings']['mean'], found['atSpine']['mean']), (3, 0, 1, 1))
            self.assertIn('blocking findings the storyline critic could have decided: 1', run.stdout)
            # A storyline packet is not a deck-review packet: said, not run.
            wrong = subprocess.run([NODE, str(ROOT / 'evals' / 'quality' / 'critic-calibration.mjs'), '--review-packet', tmp], capture_output=True, text=True, cwd=ROOT)
            self.assertEqual(wrong.returncode, 1)
            self.assertIn('holds no first-pass deck-review packet', wrong.stderr)


if __name__ == '__main__':
    unittest.main()
