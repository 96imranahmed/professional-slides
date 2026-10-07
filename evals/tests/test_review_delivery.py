"""The review loop end to end: packet, review, verification, confirmation, delivery.

The Anthropic deck was delivered at 7.8 after thirteen deck reviews across two
lineages, each a fresh pass one because every new output directory restarted
the loop; its final verification claimed fifty pages inspected and read one; a
fresh reader rated it 6.5; and the cold-run bars said it was not a deliverable
deck. These tests drive delivery the way an agent does - `--reviewer packet`,
answer the staged prompt, `--review` the answer - on a small prebuilt deck
(`--skip-build`), and hold each of those failures shut.
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import run_node, ROOT, RUNTIME, NODE, requires_python_package


FIXTURES = '''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import * as R from './skills/professional-slides/runtime/reviewer.mjs';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
import * as P from './skills/professional-slides/runtime/review-passes.mjs';
import { deliverDeck } from './skills/professional-slides/runtime/deliver-deck.mjs';
const checks = () => Object.fromEntries(R.PAGE_DIMENSIONS.map((d) => [d, `checked ${d} on the page`]));
const pageEntry = (slide, verdict = 'ok') => ({ slide, verdict, checks: checks() });
const density = { deck: 'No density profile was built for this fixture, so no medians are compared.', pages: [] };
const clean = (dims, found = []) => dims.map((d) => found.includes(d) ? { dimension: d, result: 'findings', note: 'Filed the findings above.' } : { dimension: d, result: 'clean', note: `Checked ${d} on every page and found nothing to raise.` });
const assessment = () => Object.fromEntries(R.ASSESSMENT_KEYS.map((k) => [k, `A sentence about ${k}.`]));
const major = (o = {}) => ({ id: 'F1', scope: 'page', slides: ['p02'], dimension: 'chart', code: 'MISLEADING_TIME_AXIS', severity: 'major',
  reason: 'Monthly observations with gaps are drawn at equal spacing, steepening the growth.', repair: 'Replot the line on a true time axis so the gaps show as gaps.', touches: ['layout'], checkable: null, ...o });

// A prebuilt deck: `count` analytical pages after a cover. `rich` pages each
// draw a different exhibit with its treatment; a poor deck draws one kind of
// table over and over, which misses the variety and treatment bars.
const KINDS = ['chart.bar', 'chart.line', 'table', 'map', 'cards', 'steps', 'timeline', 'framework', 'comparison-table', 'heatmap', 'chart.scatter', 'matrix', 'chart.column', 'waterfall'];
async function prebuilt({ count = 6, rich = true, deck = {} } = {}) {
  const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'review-delivery-')));
  const out = path.join(dir, 'out');
  await fs.mkdir(path.join(out, 'rendered'), { recursive: true });
  const ids = Array.from({ length: count }, (_, i) => `p${String(i + 1).padStart(2, '0')}`);
  const page = (id, i) => {
    const kind = rich ? KINDS[i % KINDS.length] : 'table';
    const roles = /table|heatmap/.test(kind) ? (rich ? ['table-harvey'] : ['table-cell']) : kind.startsWith('chart') ? ['chart-callout'] : [];
    return { id, nodes: [{ type: 'text', role: 'action-title', text: `Title of ${id} states one finding` }, { type: 'text', role: 'paragraph', text: `On ${id} the total is 412 against 388 a year earlier.` },
      ...roles.map((role) => ({ type: 'rect', role })), ...Array.from({ length: 14 }, () => ({ type: 'rect', role: 'mark' }))],
      componentInstances: [{ component: 'slide-chrome' }, { component: kind }] };
  };
  const scene = { slides: [{ id: 'cover', nodes: [{ type: 'text', role: 'cover-title', text: 'The deck' }], componentInstances: [{ component: 'cover' }] }, ...ids.map(page)] };
  await fs.writeFile(path.join(out, 'scene.json'), JSON.stringify(scene));
  await fs.writeFile(path.join(out, 'deck.pptx'), 'editable');
  await fs.writeFile(path.join(out, 'build-result.json'), JSON.stringify({ status: 'built', gates: { passed: true }, pptxPath: path.join(out, 'deck.pptx') }));
  for (const [i] of scene.slides.entries()) await fs.writeFile(path.join(out, 'rendered', `slide-${i + 1}.png`), `pixels ${i}`);
  await fs.writeFile(path.join(out, 'rendered', 'montage.png'), 'montage');
  await fs.writeFile(path.join(out, 'claims.json'), JSON.stringify({ pageHashes: {}, findings: [] }));
  await fs.writeFile(path.join(out, 'self-check.json'), JSON.stringify({ pages: {}, findings: {}, spine: 'Read the titles alone; no two pages prove the same proposition.' }));
  const spec = { schema: 'professional-slides.deck/v3', id: 'fixture', workflow: 'new_deck', request: 'Who is better positioned in the short run and the long run?',
    answer: 'The subject leads on both horizons.', slides: [{ id: 'cover', kind: 'cover', title: 'The deck' }, ...ids.map((id) => ({ id, title: `Title of ${id} states one finding` }))], ...deck };
  const specPath = path.join(dir, 'fixture.deck.json');
  await fs.writeFile(specPath, JSON.stringify(spec));
  return { dir, out, specPath, spec, ids: ['cover', ...ids], store: path.join(dir, '.reviews', 'fixture') };
}

// The storyline gate, brought to ready through its own loop.
async function storylineReady({ out, specPath, spec }) {
  const step = await S.prepareStoryline(specPath, out);
  const hash = JSON.parse(await fs.readFile(path.join(step.dir, 'packet.json'), 'utf8')).promptHash;
  const pages = spec.slides.filter((s) => !s.kind).map((s) => s.id);
  await fs.writeFile(path.join(out, 'storyline-review.json'), JSON.stringify({ pass: 1, verifies: null, verdict: 'ready', rating: 8, binding: S.storylineBinding(spec),
    summary: 'The answer is sharp and the pillars hold on the evidence shown.', provenance: { backend: 'subagent', model: 'fixture-critic', promptHash: hash },
    compliance: { verdict: 'complete', note: 'Nothing the evidence in scope allows is left undone.' }, sufficiency: { verdict: 'sufficient', note: 'The evidence supports the answer as it is stated.' },
    spine: 'Read alone, the titles build from the market to the answer without a gap or a repeated step.', answer: 'The subject leads on both horizons, on the evidence shown.',
    answerParts: [{ part: 'short run', verdict: 'answered', missingEvidence: '' }, { part: 'long run', verdict: 'answered', missingEvidence: '' }],
    pillars: [{ pillar: 'Lead', pages, verdict: 'holds', overlap: 'A single pillar; nothing overlaps.', strongestCounter: 'The base is small.', reversal: 'Growth below peers for two years.', answered: true }],
    numbers: 'Every figure matches across the pages that print it.', sectionFlow: 'The sections open, develop and close in order.', execSummary: 'The summary states the answer the body proves.',
    missingAnalyses: [], cutOrMerge: [], findings: [], topFixes: ['None material'],
    completeness: S.STORYLINE_DIMENSIONS.map((check) => ({ check, result: 'clean', note: `Checked ${check} across the spine and found nothing to raise.` })) }));
  const ready = await S.prepareStoryline(specPath, out);
  if (ready.status !== 'ready') throw new Error(`storyline fixture not ready: ${JSON.stringify(ready)}`);
}

// The packet delivery wrote, and an answer to it.
const record = async (d) => JSON.parse(await fs.readFile(path.join(d.store, 'review-packet.json'), 'utf8'));
const provenanceOf = (rec) => ({ backend: 'subagent', model: 'fixture-reviewer', promptHash: rec.promptHash });
const write = async (d, name, value) => { const file = path.join(d.dir, name); await fs.writeFile(file, JSON.stringify(value)); return file; };
function firstPass(rec, ids, findings = [], o = {}) {
  const worst = (id) => findings.filter((f) => f.slides.includes(id)).map((f) => f.severity).includes('major') ? 'major' : 'ok';
  return { pass: 1, verifies: null, accepted: !findings.length, summary: 'The deck argues its answer; one chart misleads.', rating: findings.length ? 7 : 8.5,
    binding: rec.binding, opened: [...ids], provenance: provenanceOf(rec), pages: ids.map((id) => pageEntry(id, worst(id))), findings,
    completeness: clean(R.DIMENSIONS, findings.map((f) => f.dimension)), assessment: assessment(), density, ...o };
}
const deliver = (d, o = {}) => deliverDeck(d.specPath, d.out, { skipBuild: true, ...o });
const exists = (file) => fs.access(file).then(() => true, () => false);
// The deck's folder, and the staging folders its packets were written to.
async function done(d) {
  for (const file of ['review-packet.json', 'storyline-packet.json']) {
    const staging = await fs.readFile(path.join(d.store, file), 'utf8').then((t) => JSON.parse(t).staging, () => null);
    if (staging) await fs.rm(staging, { recursive: true, force: true });
  }
  await fs.rm(d.dir, { recursive: true, force: true });
}
'''


class DeliveryLoopTests(unittest.TestCase):
    def test_a_deck_made_under_a_closed_scope_is_delivered_as_one_with_where_the_limit_is_written(self):
        result = run_node(FIXTURES + '''
const closed = (o) => ({ evidenceScope: { retrieval: 'closed', note: 'the brief supplies the records and closes the list', quote: 'Use only the records supplied with this brief', ...o } });
const run = async (deck, brief) => { const d = await prebuilt({ deck });
  if (brief) { await fs.mkdir(path.join(d.dir, 'sources'), { recursive: true }); await fs.writeFile(path.join(d.dir, 'sources', 'brief.md'), brief); }
  await storylineReady(d);
  const pending = await deliver(d, { reviewer: 'packet' });
  const report = JSON.parse(await fs.readFile(path.join(d.out, 'delivery.json'), 'utf8').catch(() => 'null'));
  const prompt = await fs.readFile(path.join((await record(d)).staging, 'prompt.md'), 'utf8').catch(() => '');
  await done(d);
  return { stage: pending.stage, scope: (pending.evidenceScope ?? report?.evidenceScope) ?? null, told: prompt.split('\\n').find((line) => line.startsWith('EVIDENCE SCOPE')) ?? '' }; };
console.log(JSON.stringify({
  reconstructed: await run({ requestProvenance: 'reconstructed', ...closed({ source: 'sources/brief.md' }) }, 'Who is better positioned? Use only the records supplied with this brief.'),
  verbatim: await run({ request: 'Who is better positioned in the short run and the long run? Use only the records supplied with this brief.', ...closed({}) }, null),
  open: await run({}, null) }));
''')
        scope = result["reconstructed"]["scope"]
        self.assertEqual([scope["retrieval"], scope["source"], scope["requestProvenance"], scope["quote"]], ["closed", "sources/brief.md", "reconstructed", "Use only the records supplied with this brief"])
        self.assertIn("the limit is quoted from the file that sets it (sources/brief.md", result["reconstructed"]["told"])   # the deck's reviewer is told as the critic was
        self.assertEqual([result["verbatim"]["scope"]["retrieval"], result["verbatim"]["scope"]["requestProvenance"], "source" in result["verbatim"]["scope"]], ["closed", "verbatim", False])
        self.assertIsNone(result["open"]["scope"])

    def test_packet_review_verification_confirmation_accept(self):
        result = run_node(FIXTURES + '''
const d = await prebuilt();
await storylineReady(d);
// Pass 1: the packet is staged; the review finds a major, and the deck is rejected.
const pending1 = await deliver(d, { reviewer: 'packet' });
const rec1 = await record(d);
const rejected = await deliver(d, { reviewFile: await write(d, 'r1.json', firstPass(rec1, d.ids, [major()])) });
// The author repairs page 2 and rebuilds it.
await fs.writeFile(path.join(d.out, 'rendered', 'slide-3.png'), 'pixels repaired');
const pending2 = await deliver(d, { reviewer: 'packet' });
const rec2 = await record(d);
const prompt2 = await fs.readFile(path.join(rec2.staging, 'prompt.md'), 'utf8');
const verification = { pass: 2, verifies: rec1.binding, accepted: true, summary: 'The time axis now spaces months by time; the repair held.', rating: 8.4, binding: rec2.binding,
  opened: ['p02'], provenance: provenanceOf(rec2), pages: [pageEntry('p02')], statuses: [{ finding: 'F1', status: 'fixed', evidence: 'The line now sits on a true time axis with the gaps visible.' }], findings: [], density };
// The verification accepts; delivery does not deliver yet - it stages a blind confirmation read.
const confirming = await deliver(d, { reviewFile: await write(d, 'r2.json', verification) });
const rec3 = await record(d);
const confirmationPrompt = await fs.readFile(path.join(rec3.staging, 'prompt.md'), 'utf8');
const stagedPacket = await fs.readFile(path.join(rec3.staging, 'packet.json'), 'utf8');
const confirmation = { confirms: rec2.binding, accepted: true, summary: 'A clear deck that answers both horizons with its evidence on the page.', rating: 8.6, binding: rec3.binding,
  opened: [...d.ids], provenance: provenanceOf(rec3), pages: d.ids.map((id) => ({ slide: id, verdict: 'ok', note: `Read ${id} at full size; nothing to raise.` })), findings: [], assessment: assessment() };
const accepted = await deliver(d, { reviewFile: await write(d, 'c1.json', confirmation) });
const delivery = JSON.parse(await fs.readFile(path.join(d.out, 'delivery.json'), 'utf8'));
const delivered = await exists(path.join(d.out, 'fixture-DELIVERED.pptx'));
const history = (await fs.readdir(path.join(d.store, 'review-history'))).sort();
await done(d);
console.log(JSON.stringify({ pending1: [pending1.review.status, pending1.review.mode, pending1.review.pass, pending1.review.packet.startsWith(d.out)],
  rejected: [rejected.accepted, rejected.rejectedAt, rejected.blockers.map((b) => b.code)], pending2: [pending2.review.mode, pending2.review.pass, pending2.review.pages],
  priorRatingShown: /earlier rating was|rated 7/i.test(prompt2), confirming: [confirming.accepted, confirming.review.status, confirming.review.mode, confirming.review.pass],
  blind: [rec3.kind, confirmationPrompt.includes('Monthly observations with gaps'), confirmationPrompt.includes('MISLEADING_TIME_AXIS'), /\\b7(\\.\\d)?\\/10|rating was/.test(confirmationPrompt), stagedPacket.includes('"ledger"')],
  accepted: [accepted.accepted, accepted.stage, delivered], score: delivery.score, history }));
''')
        self.assertEqual(result['pending1'], ['pending', 'full', 1, False])
        self.assertEqual(result['rejected'], [False, 'review pass 1 of 3', ['MISLEADING_TIME_AXIS', 'REVIEW_RATING']])
        self.assertEqual(result['pending2'], ['verification', 2, 1])
        self.assertFalse(result['priorRatingShown'])
        self.assertEqual(result['confirming'], [False, 'pending', 'confirmation', 2])
        # The confirmation reader is told nothing of the ledger, the findings or the ratings.
        self.assertEqual(result['blind'], ['confirmation', False, False, False, False])
        self.assertEqual(result['accepted'], [True, 'delivered', True])
        # delivery.json reports the confirmation's rating as the deck's score.
        self.assertEqual(result['score']['rating'], 8.6)
        self.assertIn('confirmation', result['score']['from'])
        # The lineage lives beside the deck, not in out/.
        self.assertEqual(result['history'], ['confirmation-1.json', 'pass-1.json', 'pass-2.json'])

    def test_a_confirmation_that_raises_a_major_rejects_and_spends_the_read(self):
        result = run_node(FIXTURES + '''
const d = await prebuilt();
await storylineReady(d);
await deliver(d, { reviewer: 'packet' });
const rec1 = await record(d);
await deliver(d, { reviewFile: await write(d, 'r1.json', firstPass(rec1, d.ids, [major()])) });
await fs.writeFile(path.join(d.out, 'rendered', 'slide-3.png'), 'pixels repaired');
await deliver(d, { reviewer: 'packet' });
const rec2 = await record(d);
await deliver(d, { reviewFile: await write(d, 'r2.json', { pass: 2, verifies: rec1.binding, accepted: true, summary: 'The time axis now spaces months by time; the repair held.', rating: 8.4, binding: rec2.binding,
  opened: ['p02'], provenance: provenanceOf(rec2), pages: [pageEntry('p02')], statuses: [{ finding: 'F1', status: 'fixed', evidence: 'The line now sits on a true time axis with the gaps visible.' }], findings: [], density }) });
const rec3 = await record(d);
const dead = major({ id: 'F1', slides: ['p04'], dimension: 'layout', code: 'DEAD_SPACE', reason: 'The lower half of the page is empty under a small table.', repair: 'Enlarge the table to fill the band or merge the page with p05.', touches: ['layout', 'structure'] });
const refused = await deliver(d, { reviewFile: await write(d, 'c1.json', { confirms: rec2.binding, accepted: false, summary: 'Sound argument, but half of page four is empty space.', rating: 7.4, binding: rec3.binding,
  opened: [...d.ids], provenance: provenanceOf(rec3), pages: d.ids.map((id) => ({ slide: id, verdict: id === 'p04' ? 'major' : 'ok', note: `Read ${id} at full size.` })), findings: [dead], assessment: assessment() }) });
const delivered = await exists(path.join(d.out, 'fixture-DELIVERED.pptx'));
const note = await fs.readFile(path.join(d.out, 'REJECTED.md'), 'utf8');
// The next pass verifies the confirmation's finding too.
await fs.writeFile(path.join(d.out, 'rendered', 'slide-5.png'), 'pixels filled');
const pending3 = await deliver(d, { reviewer: 'packet' });
const prompt3 = await fs.readFile(path.join((await record(d)).staging, 'prompt.md'), 'utf8');
await done(d);
console.log(JSON.stringify({ refused: [refused.accepted, refused.rejectedAt, refused.blockers.map((b) => b.code)], delivered, noted: note.includes('REVIEW_UNCONFIRMED'),
  pending3: [pending3.review.mode, pending3.review.pass], carried: prompt3.includes('conf1.F1 · DEAD_SPACE') }));
''')
        self.assertEqual(result['refused'][:2], [False, 'confirmation'])
        self.assertEqual(result['refused'][2][0], 'REVIEW_UNCONFIRMED')
        self.assertIn('DEAD_SPACE', result['refused'][2])
        self.assertIn('REVIEW_RATING', result['refused'][2])
        self.assertFalse(result['delivered'])
        self.assertTrue(result['noted'])
        self.assertEqual(result['pending3'], ['verification', 3])
        self.assertTrue(result['carried'])

    def test_a_rerun_after_acceptance_hands_over_the_same_delivery(self):
        made = run_node(FIXTURES + '''
const d = await prebuilt();
await storylineReady(d);
// To a confirmed acceptance: a rejected pass 1, an accepting verification, an accepting confirmation read.
await deliver(d, { reviewer: 'packet' });
const rec1 = await record(d);
await deliver(d, { reviewFile: await write(d, 'r1.json', firstPass(rec1, d.ids, [major()])) });
await fs.writeFile(path.join(d.out, 'rendered', 'slide-3.png'), 'pixels repaired');
await deliver(d, { reviewer: 'packet' });
const rec2 = await record(d);
await deliver(d, { reviewFile: await write(d, 'r2.json', { pass: 2, verifies: rec1.binding, accepted: true, summary: 'The time axis now spaces months by time; the repair held.', rating: 8.4, binding: rec2.binding,
  opened: ['p02'], provenance: provenanceOf(rec2), pages: [pageEntry('p02')], statuses: [{ finding: 'F1', status: 'fixed', evidence: 'The line now sits on a true time axis with the gaps visible.' }], findings: [], density }) });
const rec3 = await record(d);
const c1 = await write(d, 'c1.json', { confirms: rec2.binding, accepted: true, summary: 'A clear deck that answers both horizons with its evidence on the page.', rating: 8.6, binding: rec3.binding,
  opened: [...d.ids], provenance: provenanceOf(rec3), pages: d.ids.map((id) => ({ slide: id, verdict: 'ok', note: `Read ${id} at full size; nothing to raise.` })), findings: [], assessment: assessment() });
const accepted = await deliver(d, { reviewFile: c1 });
const read = (file) => fs.readFile(file, 'utf8').catch(() => null);
const deliveryFile = path.join(d.out, 'delivery.json'), deliverable = path.join(d.out, 'fixture-DELIVERED.pptx');
const before = { delivery: await read(deliveryFile), packet: await read(path.join(d.store, 'review-packet.json')), history: (await fs.readdir(path.join(d.store, 'review-history'))).sort() };
// The same command again, and a plain rerun: the approved build is handed over again, with no new read.
const again = await deliver(d, { reviewFile: c1 });
const plain = await deliver(d, { reviewer: 'packet' });
const unchanged = async () => [await read(deliveryFile) === before.delivery, await read(path.join(d.store, 'review-packet.json')) === before.packet,
  JSON.stringify((await fs.readdir(path.join(d.store, 'review-history'))).sort()) === JSON.stringify(before.history), await read(deliverable) === 'editable'];
const reruns = { again: [again.accepted, again.stage, again.score], plain: [plain.accepted, plain.stage, plain.score], unchanged: await unchanged() };
// With the copy and its report gone, a rerun writes them again from the lineage.
await fs.rm(deliveryFile, { force: true }); await fs.rm(deliverable, { force: true });
const restored = await deliver(d, { reviewer: 'packet' });
const rewritten = JSON.parse(await read(deliveryFile));
// A pass-1 acceptance is final the same way.
const p = await prebuilt();
await storylineReady(p);
await deliver(p, { reviewer: 'packet' });
const first = await deliver(p, { reviewFile: await write(p, 'r1.json', firstPass(await record(p), p.ids)) });
const firstDelivery = await read(path.join(p.out, 'delivery.json'));
const firstRerun = await deliver(p, { reviewer: 'packet' });
const passOne = [first.accepted, firstRerun.accepted, firstRerun.score, await read(path.join(p.out, 'delivery.json')) === firstDelivery, await exists(path.join(p.out, 'fixture-DELIVERED.pptx'))];
await done(p);
console.log(JSON.stringify({ dir: d.dir, out: d.out, spec: d.specPath, store: d.store, accepted: [accepted.accepted, accepted.score], reruns,
  restored: [restored.accepted, restored.score, rewritten.accepted, rewritten.score, await exists(deliverable)], passOne }));
''')
        try:
            self.assertEqual(made['accepted'][0], True)
            score = made['accepted'][1]
            self.assertEqual(score['rating'], 8.6)
            self.assertEqual(made['reruns']['again'], [True, 'delivered', score])
            self.assertEqual(made['reruns']['plain'], [True, 'delivered', score])
            # The same delivery.json, no new packet or pass, the same deliverable.
            self.assertEqual(made['reruns']['unchanged'], [True, True, True, True])
            self.assertEqual(made['restored'], [True, score, True, score, True])
            self.assertEqual(made['passOne'][:2], [True, True])
            self.assertEqual(made['passOne'][2], {'rating': 8.5, 'from': 'review pass 1'})
            self.assertEqual(made['passOne'][3:], [True, True])
            # From the command line the rerun exits 0 and leaves the delivery as it was.
            delivery = Path(made['out'], 'delivery.json')
            text = delivery.read_text()
            rerun = subprocess.run([NODE, str(RUNTIME / 'deliver-deck.mjs'), made['spec'], made['out'], '--skip-build', '--reviewer', 'packet'], capture_output=True, text=True)
            self.assertEqual(rerun.returncode, 0, rerun.stderr)
            self.assertEqual(delivery.read_text(), text)
            self.assertTrue(Path(made['out'], 'fixture-DELIVERED.pptx').exists())
            # A rebuilt page is a different outcome: the approved copy is withdrawn while the next pass waits.
            rebuilt = run_node(FIXTURES + f'''
const d = {{ specPath: {json.dumps(made['spec'])}, out: {json.dumps(made['out'])} }};
await fs.writeFile(path.join(d.out, 'rendered', 'slide-5.png'), 'pixels rebuilt');
const report = await deliver(d, {{ reviewer: 'packet' }});
console.log(JSON.stringify({{ review: [report.accepted, report.review?.status, report.review?.mode, report.review?.pass], delivered: await exists(path.join(d.out, 'fixture-DELIVERED.pptx')) }}));
''')
            self.assertEqual(rebuilt, {'review': [False, 'pending', 'verification', 3], 'delivered': False})
        finally:
            run_node(FIXTURES + f'''
await done({{ dir: {json.dumps(made['dir'])}, store: {json.dumps(made['store'])} }});
console.log(JSON.stringify({{ ok: true }}));
''')


class DeliveryRejectionTests(unittest.TestCase):
    def test_rating_provenance_and_unknown_keys_reject(self):
        result = run_node(FIXTURES + '''
const d = await prebuilt();
await storylineReady(d);
await deliver(d, { reviewer: 'packet' });
const rec = await record(d);
const attempt = async (name, review) => deliver(d, { reviewFile: await write(d, name, review) });
const summary = (r) => [r.rejectedAt, [...new Set(r.blockers.map((b) => b.code))], r.blockers.map((b) => b.reason).join(' | ')];
const lowClean = summary(await attempt('low.json', firstPass(rec, d.ids, [], { rating: 7.8, accepted: false })));
const { provenance, ...bare } = firstPass(rec, d.ids);
const noProvenance = summary(await attempt('bare.json', bare));
// A wrong prompt hash on an answer that echoes the packet's binding is stamped by the runtime; a reviewer that names no model is not.
const forged = summary(await attempt('forged.json', firstPass(rec, d.ids, [], { provenance: { backend: 'subagent', promptHash: '0'.repeat(64) } })));
const rebuttal = summary(await attempt('rebuttal.json', firstPass(rec, d.ids, [], { authorResponse: 'The reviewer misread page two.' })));
const oneOpened = summary(await attempt('glance.json', firstPass(rec, d.ids, [], { opened: ['p02'] })));
await done(d);
console.log(JSON.stringify({ lowClean, noProvenance, forged, rebuttal, oneOpened }));
''')
        self.assertEqual(result['lowClean'][:2], ['invalid review', ['INVALID_REVIEW']])
        self.assertIn('below the acceptance bar of 8', result['lowClean'][2])
        self.assertEqual(result['noProvenance'][:2], ['review provenance', ['REVIEW_PROVENANCE']])
        self.assertEqual(result['forged'][:2], ['review provenance', ['REVIEW_PROVENANCE']])
        self.assertEqual(result['rebuttal'][:2], ['invalid review', ['INVALID_REVIEW']])
        self.assertIn('authorResponse', result['rebuttal'][2])
        # A full pass that opened one page of seven has not read the deck.
        self.assertEqual(result['oneOpened'][:2], ['invalid review', ['INVALID_REVIEW']])
        self.assertIn('not opened', result['oneOpened'][2])

    def test_a_build_bar_miss_blocks_unless_waived_and_confirmed(self):
        result = run_node(FIXTURES + '''
const plain = await prebuilt({ count: 12, rich: false });
await storylineReady(plain);
const unwaived = await deliver(plain, { reviewer: 'packet' });
await done(plain);
const reason = 'A lookup deck: every page is the same register of facilities, and a reader compares rows, not devices.';
const waived = await prebuilt({ count: 12, rich: false, deck: { waivers: [{ code: 'BAR_EXHIBIT_VARIETY', reason }, { code: 'BAR_TABLES_TREATED', reason }] } });
await storylineReady(waived);
const pending = await deliver(waived, { reviewer: 'packet' });
const rec = await record(waived);
const prompt = await fs.readFile(path.join(rec.staging, 'prompt.md'), 'utf8');
const verdicts = (verdict) => [{ code: 'BAR_EXHIBIT_VARIETY', verdict, reason: 'The pages are one register; a varied device would hide the row comparison.' },
  { code: 'BAR_TABLES_TREATED', verdict: 'confirmed', reason: 'The cells are facility names and dates; nothing is judged.' }];
const refused = await deliver(waived, { reviewFile: await write(waived, 'refused.json', firstPass(rec, waived.ids, [], { waivers: verdicts('refused') })) });
await fs.writeFile(path.join(waived.out, 'rendered', 'slide-2.png'), 'pixels again');
await deliver(waived, { reviewer: 'packet' });
await done(waived);
const again = await prebuilt({ count: 12, rich: false, deck: { waivers: [{ code: 'BAR_EXHIBIT_VARIETY', reason }, { code: 'BAR_TABLES_TREATED', reason }] } });
await storylineReady(again);
await deliver(again, { reviewer: 'packet' });
const rec2 = await record(again);
const unjudged = await deliver(again, { reviewFile: await write(again, 'unjudged.json', firstPass(rec2, again.ids)) });
await deliver(again, { reviewer: 'packet', fullReview: true, reason: 'Restarting the fixture lineage to answer the waivers.' });
const rec3 = await record(again);
const confirmed = await deliver(again, { reviewFile: await write(again, 'confirmed.json', firstPass(rec3, again.ids, [], { waivers: verdicts('confirmed') })) });
const badWaiver = await prebuilt({ count: 12, rich: false, deck: { waivers: [{ code: 'MORE_TABLES_PLEASE', reason: 'short' }] } });
await storylineReady(badWaiver);
const invalid = await deliver(badWaiver, { reviewer: 'packet' });
await done(again); await done(badWaiver);
console.log(JSON.stringify({ unwaived: [unwaived.rejectedAt, unwaived.blockers.map((b) => b.code)], pending: [pending.review?.status, pending.bars.waived],
  shown: prompt.includes('BUILD-BAR WAIVERS') && prompt.includes('BAR_EXHIBIT_VARIETY') && prompt.includes(reason),
  refused: [refused.rejectedAt, refused.blockers.map((b) => b.code)], unjudged: [unjudged.rejectedAt, unjudged.blockers[0].reason],
  confirmed: [confirmed.accepted, confirmed.score?.rating], invalid: [invalid.rejectedAt, [...new Set(invalid.blockers.map((b) => b.code))]] }));
''')
        self.assertEqual(result['unwaived'][0], 'build bars')
        self.assertIn('BAR_EXHIBIT_VARIETY', result['unwaived'][1])
        self.assertIn('BAR_TABLES_TREATED', result['unwaived'][1])
        self.assertEqual(result['pending'], ['pending', ['BAR_EXHIBIT_VARIETY', 'BAR_TABLES_TREATED']])
        self.assertTrue(result['shown'])
        self.assertEqual(result['refused'], ['review pass 1 of 3', ['BAR_EXHIBIT_VARIETY']])
        self.assertEqual(result['unjudged'][0], 'invalid review')
        self.assertIn('verdict', result['unjudged'][1])
        self.assertEqual(result['confirmed'], [True, 8.5])
        self.assertEqual(result['invalid'], ['waivers', ['WAIVERS_INVALID']])

    def test_delivery_keeps_the_severity_the_build_gave_each_finding(self):
        # A build with one blocker and sixteen advisories was refused with
        # seventeen "blocking ... major" findings, two of them "measured
        # [object Object]": delivery relabelled every finding of a failed
        # report. A finding has the severity its gate gave it; delivery blocks
        # on blockers and on an unwaived build bar, and lists the rest as advisories.
        result = run_node(FIXTURES + '''
const advisories = [
  { slide: 3, code: 'UNANNOTATED', severity: 'advisory', measured: 0, threshold: 'one annotation on the chart', repair: 'Check whether a decisive comparator is missing at its mark.' },
  { slide: 4, code: 'SCENE_VOID', severity: 'advisory', measured: { kind: 'column', band: 0.1356, from: 202, to: 285, column: 'left' }, threshold: 0.13, repair: 'Set the group at the top of its column.' },
  { slide: null, code: 'DECK_CRAFT', severity: 'advisory', measured: { highlight: 0.19, tablesTreated: 0.64 }, threshold: { highlight: 0.35, tablesTreated: 0.75 }, repair: 'Review whether the decisive comparison needs emphasis.' }];
const blocker = { slide: null, code: 'CRAFT_PLAYERS_UNINTRODUCED', severity: 'blocker', measured: { players: 5, logoPages: 0 }, threshold: 1, repair: 'Introduce the players early on one page.' };
// The build's result as build-deck writes it: the scene gates' findings before the render (preflight) and after it (gates).
const built = async (d, { preflight = [], gates = [] }) => {
  const blocks = (list) => list.some((f) => f.severity === 'blocker');
  await fs.writeFile(path.join(d.out, 'build-result.json'), JSON.stringify({ status: blocks([...preflight, ...gates]) ? 'built-with-blockers' : 'built', pptxPath: path.join(d.out, 'deck.pptx'),
    preflight: { passed: !blocks(preflight), findings: preflight }, gates: { passed: !blocks(gates), findings: gates }, readback: { accepted: true, findings: [] } }));
};
const blocked = await prebuilt();
await storylineReady(blocked);
await built(blocked, { preflight: [...advisories, blocker], gates: advisories });
const refused = await deliver(blocked, { reviewer: 'packet' });
const note = await fs.readFile(path.join(blocked.out, 'REJECTED.md'), 'utf8');
await done(blocked);
// Advisories alone, and no bar missed: the deck reaches the deck review.
const advised = await prebuilt();
await storylineReady(advised);
await built(advised, { preflight: advisories, gates: advisories });
const reviewed = await deliver(advised, { reviewer: 'packet' });
const noNote = !(await exists(path.join(advised.out, 'REJECTED.md')));
await done(advised);
// A missed build bar is named as one, with the bar it misses and how it is waived; the advisories stay advisories beside it.
const plain = await prebuilt({ count: 12, rich: false });
await storylineReady(plain);
await built(plain, { preflight: advisories, gates: advisories });
const barred = await deliver(plain, { reviewer: 'packet' });
const barNote = await fs.readFile(path.join(plain.out, 'REJECTED.md'), 'utf8');
await done(plain);
const section = (text, heading) => (text.split('## ').find((part) => part.startsWith(heading)) ?? '').split('\\n').filter((l) => l.startsWith('- '));
console.log(JSON.stringify({
  refused: [refused.rejectedAt, refused.blockers.map((b) => [b.code, b.severity]), refused.advisories.map((b) => [b.code, b.severity])],
  note: { head: note.split('\\n')[2], blockers: section(note, 'Blockers'), advisories: section(note, 'Advisories (not blocking)'), object: note.includes('[object Object]'), major: / · major:/.test(note),
    measured: [note.includes('measured players 5, logoPages 0, threshold 1'), note.includes('measured kind column, band 0.1356, from 202, to 285, column left, threshold 0.13'), note.includes('threshold highlight 0.35, tablesTreated 0.75')] },
  reviewed: [reviewed.accepted, reviewed.rejectedAt ?? null, reviewed.review?.status, noNote],
  barred: [barred.rejectedAt, [...new Set(barred.blockers.map((b) => `${b.kind}/${b.severity}`))], barred.blockers.map((b) => b.code).sort(), barred.advisories.length],
  barNote: { head: barNote.split('\\n')[2], bars: section(barNote, 'Build bars missed (waivable)'), blockers: section(barNote, 'Blockers').length, advisories: section(barNote, 'Advisories (not blocking)').length },
}));
''')
        self.assertEqual(result['refused'], ['page gates', [['CRAFT_PLAYERS_UNINTRODUCED', 'blocker']], [['UNANNOTATED', 'advisory'], ['SCENE_VOID', 'advisory'], ['DECK_CRAFT', 'advisory']]])
        note = result['note']
        self.assertEqual(note['head'], '1 blocking finding(s); 3 advisories, which do not block. No deliverable was written.')
        self.assertEqual(len(note['blockers']), 1)
        self.assertIn('· CRAFT_PLAYERS_UNINTRODUCED · blocker:', note['blockers'][0])
        # Each advisory once, though both runs of the scene's gates reported it, and under its own severity.
        self.assertEqual(len(note['advisories']), 3)
        self.assertTrue(all(' · advisory: ' in line for line in note['advisories']), note['advisories'])
        self.assertEqual([note['object'], note['major']], [False, False])
        self.assertEqual(note['measured'], [True, True, True])  # a structured measure is printed by its parts
        self.assertEqual(result['reviewed'], [False, None, 'pending', True])
        self.assertEqual(result['barred'][:2], ['build bars', ['build bar/blocker']])
        self.assertIn('BAR_EXHIBIT_VARIETY', result['barred'][2])
        self.assertEqual(result['barred'][3], 3)
        bars = result['barNote']
        self.assertIn('of them a build bar missed; 3 advisories, which do not block', bars['head'])
        self.assertEqual([bars['blockers'], bars['advisories']], [0, 3])
        variety = next(line for line in bars['bars'] if 'BAR_EXHIBIT_VARIETY' in line)
        self.assertIn('· BAR_EXHIBIT_VARIETY · build bar missed: exhibitVarietyPerTen measured', variety)
        self.assertIn('against a floor of', variety)
        self.assertIn('or waive it: if the deck is right to miss this bar, record `waivers: [{ "code": "BAR_EXHIBIT_VARIETY", "reason": "<a sentence saying why>" }]` on `deck` in <id>.pages.json', variety)
        self.assertIn('the reviewer is shown the waiver and must confirm it', variety)

    def test_an_offline_build_says_so_to_the_reviewer_and_in_the_delivery_record(self):
        # A deck built without the network declares it (asset-needs.mjs): the
        # build records which files were not available, and the reviewer's
        # packet and delivery.json carry the declaration and its reason. It is
        # shown to the reviewer, who still judges the pages.
        result = run_node(FIXTURES + '''
const reason = 'The build machine has no network access and the client supplied no logo files';
const assets = { fetch: 'none', reason, notAvailable: { logos: ['North Rail', 'Harbour'], pictures: [], places: [] } };
const d = await prebuilt({ deck: { assets: { fetch: 'none', reason } } });
await storylineReady(d);
const build = JSON.parse(await fs.readFile(path.join(d.out, 'build-result.json'), 'utf8'));
await fs.writeFile(path.join(d.out, 'build-result.json'), JSON.stringify({ ...build, assets }));
const pending = await deliver(d, { reviewer: 'packet' });
const rec = await record(d);
const prompt = await fs.readFile(path.join(rec.staging, 'prompt.md'), 'utf8');
const packet = JSON.parse(await fs.readFile(path.join(rec.staging, 'packet.json'), 'utf8'));
const accepted = await deliver(d, { reviewFile: await write(d, 'review.json', firstPass(rec, d.ids)) });
const recorded = JSON.parse(await fs.readFile(path.join(d.out, 'delivery.json'), 'utf8'));
await done(d);
// A build that says nothing of its assets adds nothing to the packet.
const plain = await prebuilt();
await storylineReady(plain);
await deliver(plain, { reviewer: 'packet' });
const plainPrompt = await fs.readFile(path.join((await record(plain)).staging, 'prompt.md'), 'utf8');
await done(plain);
console.log(JSON.stringify({ pending: [pending.review?.status, pending.assets], packet: packet.assets,
  prompt: ['ASSETS NOT AVAILABLE', `its reason: "${reason}"`, 'the logos of North Rail, Harbour', 'introduced by name', 'do file one where a page does not work without its marks'].map((said) => prompt.includes(said)),
  accepted: [accepted.accepted, recorded.assets], plain: plainPrompt.includes('ASSETS NOT AVAILABLE') }));
''')
        assets = {'fetch': 'none', 'reason': 'The build machine has no network access and the client supplied no logo files', 'notAvailable': {'logos': ['North Rail', 'Harbour'], 'pictures': [], 'places': []}}
        self.assertEqual(result['pending'], ['pending', assets])
        self.assertEqual(result['packet'], assets)
        self.assertEqual(result['prompt'], [True] * 5)
        self.assertEqual(result['accepted'], [True, assets])
        self.assertFalse(result['plain'])

    def test_a_waiver_takes_exactly_one_verdict(self):
        result = run_node(FIXTURES + '''
const reason = 'A lookup deck: every page is the same register of facilities, and a reader compares rows, not devices.';
const d = await prebuilt({ count: 12, rich: false, deck: { waivers: [{ code: 'BAR_EXHIBIT_VARIETY', reason }, { code: 'BAR_TABLES_TREATED', reason }] } });
await storylineReady(d);
await deliver(d, { reviewer: 'packet' });
const rec = await record(d);
const verdict = (code, v) => ({ code, verdict: v, reason: 'The pages are one register; a varied device would hide the row comparison.' });
// The reviewer confirms the variety waiver and then refuses it: two verdicts for one bar.
const twice = [verdict('BAR_EXHIBIT_VARIETY', 'confirmed'), verdict('BAR_TABLES_TREATED', 'confirmed'), verdict('BAR_EXHIBIT_VARIETY', 'refused')];
const report = await deliver(d, { reviewFile: await write(d, 'twice.json', firstPass(rec, d.ids, [], { waivers: twice })) });
const delivered = await exists(path.join(d.out, 'fixture-DELIVERED.pptx'));
// Every read that judges waivers holds them to one verdict each, and acceptance never takes the first of two.
const { waivers } = rec;
const review = firstPass(rec, d.ids, [], { waivers: twice });
const confirmation = { confirms: 'c'.repeat(64), accepted: true, summary: 'A clear deck that answers both horizons with its evidence on the page.', rating: 8.6, binding: rec.binding,
  opened: [...d.ids], provenance: provenanceOf(rec), pages: d.ids.map((id) => ({ slide: id, verdict: 'ok', note: `Read ${id} at full size; nothing to raise.` })), findings: [], assessment: assessment(), waivers: twice };
const spine = { part: { kind: 'spine', id: 'spine', slides: d.ids }, binding: rec.binding, accepted: true, summary: 'The sequence builds to the answer without a repeated step.', rating: 8.5,
  opened: [], provenance: provenanceOf(rec), pages: [], findings: [], completeness: clean(R.DECK_DIMENSIONS), assessment: assessment(), density, waivers: twice };
const twiceErrors = (errors) => errors.filter((e) => e.includes('BAR_EXHIBIT_VARIETY'));
const stranger = [verdict('BAR_EXHIBIT_VARIETY', 'confirmed'), verdict('BAR_TABLES_TREATED', 'confirmed'), verdict('BAR_LAYOUT_RANGE', 'confirmed')];
await done(d);
console.log(JSON.stringify({ report: [report.accepted, report.rejectedAt, (report.blockers || []).map((b) => b.reason).join(' | ')], delivered,
  review: twiceErrors(R.validateReview(review, d.ids, { waivers })), confirmation: twiceErrors(R.validateConfirmation(confirmation, d.ids, { confirms: 'c'.repeat(64), waivers })),
  part: twiceErrors(R.validatePart(spine, d.ids, { waivers })), stranger: R.validateReview(firstPass(rec, d.ids, [], { waivers: stranger }), d.ids, { waivers }).filter((e) => e.includes('BAR_LAYOUT_RANGE')),
  outcome: R.reviewOutcome(review, [], { waivers }), confirmationOutcome: R.confirmationOutcome(confirmation, { waivers }).accepted }));
''')
        self.assertEqual(result['report'][:2], [False, 'invalid review'])
        self.assertIn('BAR_EXHIBIT_VARIETY', result['report'][2])
        self.assertFalse(result['delivered'])
        for read in ['review', 'confirmation', 'part']:
            self.assertEqual(len(result[read]), 1, read)
            self.assertIn('one verdict', result[read][0])
        # A verdict for a bar the deck does not waive is refused as before.
        self.assertEqual(len(result['stranger']), 1)
        self.assertFalse(result['outcome']['accepted'])
        self.assertIn('BAR_EXHIBIT_VARIETY', [b['code'] for b in result['outcome']['blocking']])
        self.assertFalse(result['confirmationOutcome'])

    def test_a_new_deck_without_its_request_is_refused(self):
        result = run_node(FIXTURES + '''
const d = await prebuilt({ deck: { request: undefined } });
const report = await deliver(d, { reviewer: 'packet' });
const story = await S.prepareStoryline(d.specPath, d.out);
await done(d);
console.log(JSON.stringify({ at: report.rejectedAt, codes: report.blockers.map((b) => b.code), story: story.status }));
''')
        self.assertEqual(result, {'at': 'request', 'codes': ['REQUEST_MISSING'], 'story': 'refused'})


class LineageTests(unittest.TestCase):
    def test_a_new_output_directory_continues_the_lineage_and_restarts_are_bounded(self):
        result = run_node(FIXTURES + '''
const d = await prebuilt();
await storylineReady(d);
await deliver(d, { reviewer: 'packet' });
const rec1 = await record(d);
await deliver(d, { reviewFile: await write(d, 'r1.json', firstPass(rec1, d.ids, [major()])) });
// The same deck rebuilt into another output directory: pass 2, not a fresh pass 1.
const out2 = path.join(d.dir, 'out-2');
await fs.cp(d.out, out2, { recursive: true });
const build = JSON.parse(await fs.readFile(path.join(out2, 'build-result.json'), 'utf8'));
await fs.writeFile(path.join(out2, 'build-result.json'), JSON.stringify({ ...build, pptxPath: path.join(out2, 'deck.pptx') }));
await fs.writeFile(path.join(out2, 'rendered', 'slide-3.png'), 'pixels repaired');
const elsewhere = await deliverDeck(d.specPath, out2, { skipBuild: true, reviewer: 'packet' });
const noReason = await deliver(d, { reviewer: 'packet', fullReview: true });
const first = await deliver(d, { reviewer: 'packet', fullReview: true, reason: 'The answer changed after the data was re-pulled.' });
await deliver(d, { reviewFile: await write(d, 'r2.json', firstPass(await record(d), d.ids, [major()])) });
const second = await deliver(d, { reviewer: 'packet', fullReview: true, reason: 'Starting again once more for the fixture.' });
const approved = await deliver(d, { reviewer: 'packet', fullReview: true, reason: 'The user asked for a fresh reading.', userApproved: true });
const lineage = JSON.parse(await fs.readFile(path.join(d.store, 'review-history', 'lineage.json'), 'utf8'));
await done(d);
console.log(JSON.stringify({ elsewhere: [elsewhere.review.mode, elsewhere.review.pass], noReason: [noReason.rejectedAt, noReason.blockers[0].code],
  first: [first.review.pass, first.restarted?.archived], second: [second.rejectedAt, second.blockers[0].code, second.blockers[0].reason.includes('--user-approved')],
  approved: [approved.review.pass, approved.restarted?.archived], restarts: lineage.restarts.map((r) => [r.reason.slice(0, 10), r.userApproved]) }));
''')
        self.assertEqual(result['elsewhere'], ['verification', 2])
        self.assertEqual(result['noReason'], ['review lineage', 'LINEAGE_RESTART'])
        self.assertEqual(result['first'], [1, 'lineage-1'])
        self.assertEqual(result['second'], ['review lineage', 'LINEAGE_RESTART', True])
        self.assertEqual(result['approved'], [1, 'lineage-2'])
        self.assertEqual(result['restarts'], [['The answer', False], ['The user a', True]])

    def test_the_pass_cap_holds(self):
        result = run_node(FIXTURES + '''
const d = await prebuilt();
await storylineReady(d);
await deliver(d, { reviewer: 'packet' });
const rec1 = await record(d);
await deliver(d, { reviewFile: await write(d, 'r1.json', firstPass(rec1, d.ids, [major()])) });
const capped = await deliver(d, { reviewer: 'packet', maxPasses: 1 });
await done(d);
console.log(JSON.stringify({ capped: [capped.rejectedAt, capped.blockers[0].code] }));
''')
        self.assertEqual(result['capped'], ['review cap', 'REVIEW_PASS_CAP'])


REVISION = FIXTURES + '''
// A revision of an imported deck: every page carries its source slide, and the
// inventory beside the deck holds what each source slide said and drew
// (`drew`: a page id's source slide's tables, charts and pictures).
async function revised(edit = (slides) => slides, drew = {}) {
  const d = await prebuilt({ deck: { workflow: 'existing_deck_revision', inventory: 'fixture.inventory.json', request: undefined } });
  const body = d.spec.slides.filter((s) => !s.kind);
  const inventory = { schema: 'professional-slides.inventory/v1', id: 'fixture', slides: [{ index: 1, id: 's01', title: 'The deck', paragraphs: [], tables: [], charts: [] },
    ...body.map((s, i) => ({ index: i + 2, id: `s0${i + 2}`, title: s.title, paragraphs: [{ text: `On ${s.id} the total is 412 against 388 a year earlier.`, level: 0 }], tables: [], charts: [], pictures: [], ...drew[s.id] }))] };
  await fs.writeFile(path.join(d.dir, 'fixture.inventory.json'), JSON.stringify(inventory));
  const slides = edit(body.map((s, i) => ({ ...s, points: [`On ${s.id} the total is 412 against 388 a year earlier.`], pageType: { type: 'numbers', form: 'tiles', sourceSlide: i + 2, content: { claim: s.title } } })));
  d.spec = { ...d.spec, cover: { title: 'The deck' }, slides: [d.spec.slides[0], ...slides] };
  await fs.writeFile(d.specPath, JSON.stringify(d.spec));
  return { ...d, inventory };
}
'''


class RevisionTests(unittest.TestCase):
    def test_what_a_revision_changed_against_its_source_deck(self):
        result = run_node(REVISION + '''
const same = await revised();
const retitled = await revised((slides) => slides.map((s) => s.id === 'p03' ? { ...s, title: 'A sharper finding for page three', pageType: { ...s.pageType, content: { claim: 'A sharper finding for page three' } } } : s));
const recopied = await revised((slides) => slides.map((s) => s.id === 'p05' ? { ...s, points: ['On p05 the total fell to 301, a third below the year before, as two routes closed.'] } : s));
const cut = await revised((slides) => slides.filter((s) => s.id !== 'p04'));
const changes = (d) => P.revisionChanges(d.spec, d.inventory);
const out = { same: changes(same), retitled: changes(retitled), recopied: changes(recopied), cut: changes(cut) };
for (const d of [same, retitled, recopied, cut]) await done(d);
console.log(JSON.stringify(out));
''')
        self.assertFalse(result['same']['spineChanged'])
        self.assertEqual(result['same']['content'], [])
        self.assertEqual(result['retitled']['spine'], ['p03'])
        # New words and numbers on a page change its content, not the spine.
        self.assertFalse(result['recopied']['spineChanged'])
        self.assertEqual(result['recopied']['content'], ['p05'])
        # A cut slide changes the spine at the gap.
        self.assertEqual(result['cut']['dropped'], [5])
        self.assertEqual(result['cut']['spine'], ['p03', 'p05'])

    def test_a_revision_with_its_spine_unchanged_needs_no_critique_and_a_changed_one_is_scoped(self):
        result = run_node(REVISION + '''
const same = await revised((slides) => slides.map((s) => s.id === 'p05' ? { ...s, points: ['On p05 the total fell to 301, a third below the year before, as two routes closed.'] } : s));
const ready = await S.prepareStoryline(same.specPath, same.out);
const gate = await S.storylineGate(same.spec, same.out, { deckPath: same.specPath });
// The deck review of that revision reads the one page whose copy changed.
const pending = await deliver(same, { reviewer: 'packet' });
const rec = await record(same);
const prompt = await fs.readFile(path.join(rec.staging, 'prompt.md'), 'utf8');
const scoped = (o = {}) => ({ ...firstPass(rec, ['p05']), ...o });
const wide = await deliver(same, { reviewFile: await write(same, 'wide.json', firstPass(rec, same.ids)) });
await deliver(same, { reviewer: 'packet' });
const rec2 = await record(same);
const outside = major({ slides: ['p02'] });
const offPage = await deliver(same, { reviewFile: await write(same, 'off.json', { ...firstPass(rec2, ['p05']), findings: [outside], accepted: false, rating: 7, pages: [pageEntry('p05')] }) });
await deliver(same, { reviewer: 'packet' });
const rec3 = await record(same);
const accepted = await deliver(same, { reviewFile: await write(same, 'scoped.json', firstPass(rec3, ['p05'])) });
await done(same);
const moved = await revised((slides) => slides.map((s) => s.id === 'p03' ? { ...s, title: 'A sharper finding for page three', pageType: { ...s.pageType, content: { claim: 'A sharper finding for page three' } } } : s));
const step = await S.prepareStoryline(moved.specPath, moved.out);
const spinePrompt = await fs.readFile(path.join(step.dir, 'prompt.md'), 'utf8');
const packet = JSON.parse(await fs.readFile(path.join(step.dir, 'packet.json'), 'utf8'));
const critique = (findings) => ({ pass: 1, verifies: null, verdict: 'revise', rating: 7, binding: packet.binding, summary: 'The retitled page now overclaims what its evidence can carry.',
  compliance: { verdict: 'incomplete', note: 'An open item is still within reach of the team.' }, sufficiency: { verdict: 'insufficient', note: 'The answer outruns its evidence while the item is open.' },
  provenance: { backend: 'subagent', model: 'fixture', promptHash: packet.promptHash }, spine: 'The titles read in order and build to the answer, with one overreach.',
  answer: 'The subject leads on both horizons, on the evidence shown.', answerParts: [{ part: 'short run', verdict: 'answered', missingEvidence: '' }],
  pillars: [{ pillar: 'Lead', pages: ['p01', 'p02', 'p03'], verdict: 'weak', overlap: 'A single pillar; nothing overlaps.', strongestCounter: 'The base is small.', reversal: 'Growth below peers.', answered: true }],
  numbers: 'Every figure matches across the pages that print it.', sectionFlow: 'The sections open, develop and close in order.', execSummary: 'The summary states the answer the body proves.',
  missingAnalyses: [], cutOrMerge: [], findings, topFixes: ['Pull the claim back to the evidence'],
  completeness: S.STORYLINE_DIMENSIONS.map((check) => ({ check, result: check === 'claim' ? 'findings' : 'clean', note: check === 'claim' ? 'Filed F1 on the claim.' : `Checked ${check} and found nothing to raise.` })) });
const item = (page) => ({ id: 'F1', scope: 'page', pages: [page], check: 'claim', severity: 'major', ifUnfixed: 'The committee would act on a claim the deck does not show.', problem: 'The title claims more than its evidence shows on this page.', fix: 'Pull the title back to the finding the evidence supports.' });
await fs.writeFile(path.join(moved.out, 'storyline-review.json'), JSON.stringify(critique([item('p02')])));
const unchangedItem = await S.prepareStoryline(moved.specPath, moved.out);
await fs.writeFile(path.join(moved.out, 'storyline-review.json'), JSON.stringify(critique([item('p03')])));
const changedItem = await S.prepareStoryline(moved.specPath, moved.out);
await done(moved);
console.log(JSON.stringify({ ready: [ready.status, ready.pass], gate, pending: [pending.review.mode, pending.review.pages], marked: prompt.includes('THIS IS A REVISION') && /\\[p05\\][^\\n]*\\[changed\\]/.test(prompt),
  wide: [wide.rejectedAt, wide.blockers.some((b) => /did not change in this revision/.test(b.reason))], offPage: offPage.blockers.some((b) => /did not change in this revision/.test(b.reason)),
  accepted: [accepted.accepted, accepted.score?.rating], spine: [step.status, step.pass, /\\[p03\\][^\\n]*\\[changed\\]/.test(spinePrompt), /\\[p02\\][^\\n]*\\[changed\\]/.test(spinePrompt)],
  unchangedItem: [unchangedItem.status, (unchangedItem.errors || []).some((e) => /did not change in this revision/.test(e))], changedItem: changedItem.status }));
''')
        self.assertEqual(result['ready'], ['ready', 0])
        self.assertEqual(result['gate'], [])
        self.assertEqual(result['pending'], ['revision', 1])
        self.assertTrue(result['marked'])
        self.assertEqual(result['wide'], ['invalid review', True])
        self.assertTrue(result['offPage'])
        self.assertEqual(result['accepted'], [True, 8.5])
        self.assertEqual(result['spine'], ['packet-written', 1, True, False])
        self.assertEqual(result['unchangedItem'], ['invalid', True])
        self.assertEqual(result['changedItem'], 'revise')

    def test_a_page_drawn_unlike_its_source_slide_is_read_beside_the_copy_changes(self):
        result = run_node(REVISION + '''
// p05's copy changes; p03 says what its source slide said, and only how it is drawn may change.
const recopied = (s) => (s.id === 'p05' ? { ...s, points: ['On p05 the total fell to 301, a third below the year before, as two routes closed.'] } : s);
const redrawn = (change, drew = {}) => revised((slides) => slides.map(recopied).map((s) => (s.id === 'p03' ? change(s) : s)), drew);
const series = { categories: ['2023', '2024'], series: [{ name: 'Total', values: [388, 412] }] };
const column = { p03: { charts: [{ type: 'COLUMN_CLUSTERED', title: null, ...series }] } };
const picture = (file) => ({ p03: { pictures: [{ file, width: 400, height: 300, alt: 'The route map' }] } });
const cases = {
  asItWas: await redrawn((s) => s),
  styled: await redrawn((s) => ({ ...s, style: 'accent' })),
  framed: await redrawn((s) => ({ ...s, frame: 'card' })),
  icons: await redrawn((s) => ({ ...s, points: s.points.map((text) => ({ text, icon: 'route' })) })),
  // Another page type: the same words and numbers drawn as cards instead of text.
  asCards: await redrawn(({ points, ...s }) => ({ ...s, pageType: { ...s.pageType, type: 'parallel', form: 'cards' }, exhibit: { type: 'cards', items: points.map((text) => ({ title: 'Total', text })) } })),
  newPicture: await redrawn((s) => ({ ...s, pictures: [{ path: 'assets/fixture/s04-2.png', alt: 'The route map' }] }), picture('assets/fixture/s04-1.png')),
  samePicture: await redrawn((s) => ({ ...s, pictures: [{ path: 'assets/fixture/s04-1.png', alt: 'The route map' }] }), picture('assets/fixture/s04-1.png')),
  lineForColumns: await redrawn((s) => ({ ...s, exhibit: { type: 'chart.line', ...series } }), column),
  sameColumns: await redrawn((s) => ({ ...s, exhibit: { type: 'chart.column', ...series } }), column),
  chartForTable: await redrawn((s) => ({ ...s, exhibit: { type: 'chart.column', ...series } }), { p03: { tables: [{ rows: 3, cols: 2, cells: [['Year', 'Total'], ['2023', '388'], ['2024', '412']] }] } }),
};
const content = Object.fromEntries(Object.entries(cases).map(([name, d]) => [name, P.revisionChanges(d.spec, d.inventory).content]));
// Delivery reads both pages, and a finding on the redrawn one is the review's to file.
const mixed = cases.styled;
const pending = await deliver(mixed, { reviewer: 'packet' });
const rec = await record(mixed);
const prompt = await fs.readFile(path.join(rec.staging, 'prompt.md'), 'utf8');
const onRedrawn = await deliver(mixed, { reviewFile: await write(mixed, 'redrawn.json', firstPass(rec, ['p03', 'p05'], [major({ slides: ['p03'] })])) });
// A revision that changes no words or numbers is a restyle: every page is read.
const restyle = await revised((slides) => slides.map((s) => (s.id === 'p03' ? { ...s, style: 'accent' } : s)));
const restyled = P.revisionChanges(restyle.spec, restyle.inventory);
const restylePending = await deliver(restyle, { reviewer: 'packet' });
for (const d of [...Object.values(cases), restyle]) await done(d);
console.log(JSON.stringify({ content, pending: [pending.review.mode, pending.review.pages], marked: prompt.includes('[p03]') && prompt.split('\\n').some((l) => l.includes('[p03]') && l.includes('[changed]')),
  onRedrawn: [onRedrawn.rejectedAt, onRedrawn.blockers.map((b) => b.code)], restyle: [restyled.restyle, restyled.copy, restyled.content, restylePending.review.mode, restylePending.review.pages] }));
''')
        content = result['content']
        self.assertEqual(content['asItWas'], ['p05'])
        # A drawing setting, another page type, another picture or chart than the source slide's: the page is read.
        for name in ['styled', 'framed', 'icons', 'asCards', 'newPicture', 'lineForColumns', 'chartForTable']:
            self.assertEqual(content[name], ['p03', 'p05'], name)
        # The source slide's own picture and chart, drawn as it drew them, are not a change.
        self.assertEqual(content['samePicture'], ['p05'])
        self.assertEqual(content['sameColumns'], ['p05'])
        self.assertEqual(result['pending'], ['revision', 2])
        self.assertTrue(result['marked'])
        self.assertEqual(result['onRedrawn'], ['review pass 1 of 3', ['MISLEADING_TIME_AXIS', 'REVIEW_RATING']])
        self.assertEqual(result['restyle'], [True, [], ['p03'], 'full', 7])


class BackendTests(unittest.TestCase):
    def test_auto_prefers_the_host_cli_and_falls_back_to_a_packet_when_not_signed_in(self):
        result = run_node(FIXTURES + '''
const has = (names) => (name) => names.includes(name);
const pick = (env, names) => P.detectBackend('auto', { env, has: has(names) });
const detection = { claudeHost: pick({ CLAUDECODE: '1' }, ['codex', 'claude']), codexHost: pick({ CODEX_SANDBOX: 'seatbelt' }, ['codex', 'claude']),
  noHost: pick({}, ['codex', 'claude']), hostMissing: pick({ CLAUDECODE: '1' }, ['codex']), none: pick({}, []), forced: pick({ PS_REVIEWER: 'packet', CLAUDECODE: '1' }, ['claude']) };
// A codex CLI that is installed but not signed in.
const d = await prebuilt();
await storylineReady(d);
const bin = path.join(d.dir, 'bin'); await fs.mkdir(bin);
await fs.writeFile(path.join(bin, 'codex'), '#!/bin/sh\\necho "Error: Not logged in. Please run codex login" >&2\\nexit 1\\n', { mode: 0o755 });
const previous = process.env.PATH;
process.env.PATH = `${bin}:${previous}`;
let report;
try { report = await deliver(d, { reviewer: 'codex' }); } finally { process.env.PATH = previous; }
await done(d);
console.log(JSON.stringify({ detection, fallback: [report.review.status, /not signed in/.test(report.review.note)], auth: P.isAuthFailure(new Error('codex exec exited 1\\nError: Not logged in')), other: P.isAuthFailure(new Error('model overloaded')),
  model: P.reviewerModel('codex'), claudeModel: P.reviewerModel('claude') }));
''')
        self.assertEqual(result['detection'], {'claudeHost': 'claude', 'codexHost': 'codex', 'noHost': 'codex', 'hostMissing': 'codex', 'none': 'packet', 'forced': 'packet'})
        self.assertEqual(result['fallback'], ['pending', True])
        self.assertTrue(result['auth'])
        self.assertFalse(result['other'])
        # The evaluation rules' reviewer model is the one codex runs with.
        rules = json.loads((ROOT / 'skills/professional-slides/references/evaluation/rules.json').read_text())
        self.assertEqual(result['model'], rules['reviewer']['defaultModel'])
        self.assertIsNone(result['claudeModel'])


class DeliveryCliTests(unittest.TestCase):
    def test_removed_and_incomplete_flags_are_usage_errors(self):
        with tempfile.TemporaryDirectory() as tmp:
            spec = Path(tmp) / 'x.deck.json'
            spec.write_text(json.dumps({'id': 'x', 'slides': []}))
            brief = subprocess.run([NODE, str(RUNTIME / 'deliver-deck.mjs'), str(spec), str(Path(tmp) / 'out'), '--brief', 'Numeric-only pills are required'], capture_output=True, text=True)
            self.assertEqual(brief.returncode, 1)
            self.assertIn('--brief was removed', brief.stderr)
            restart = subprocess.run([NODE, str(RUNTIME / 'deliver-deck.mjs'), str(spec), str(Path(tmp) / 'out'), '--full-review'], capture_output=True, text=True)
            self.assertEqual(restart.returncode, 1)
            self.assertIn('--reason', restart.stderr)

    def test_the_cli_waits_for_a_packet_and_refuses_an_unproven_review(self):
        made = run_node(FIXTURES + '''
const d = await prebuilt();
await storylineReady(d);
console.log(JSON.stringify({ dir: d.dir, out: d.out, spec: d.specPath, store: d.store }))
''')
        try:
            cli = lambda *args: subprocess.run([NODE, str(RUNTIME / 'deliver-deck.mjs'), made['spec'], made['out'], '--skip-build', *args], capture_output=True, text=True)
            waiting = cli('--reviewer', 'packet')
            self.assertEqual(waiting.returncode, 3, waiting.stderr)
            pending = json.loads(waiting.stdout)['review']
            self.assertTrue(Path(pending['packet'], 'prompt.md').exists())
            record = json.loads(Path(made['store'], 'review-packet.json').read_text())
            review = Path(made['dir'], 'unproven.json')
            review.write_text(json.dumps({'pass': 1, 'verifies': None, 'accepted': True, 'summary': 'A review written without the packet it should answer.', 'rating': 9,
                                          'binding': record['binding'], 'findings': []}))
            refused = cli('--review', str(review))
            self.assertEqual(refused.returncode, 2, refused.stderr)
            self.assertIn('INVALID_REVIEW', Path(made['out'], 'REJECTED.md').read_text())
            self.assertFalse(Path(made['out'], 'fixture-DELIVERED.pptx').exists())
        finally:
            run_node(FIXTURES + f'''
await done({{ dir: {json.dumps(made['dir'])}, store: {json.dumps(made['store'])} }});
console.log(JSON.stringify({{ ok: true }}));
''')

    def test_a_build_refusal_is_a_rejection_with_its_findings_not_a_crash(self):
        with tempfile.TemporaryDirectory() as tmp:
            spec = Path(tmp) / 'short-eval.deck.json'
            spec.write_text(json.dumps({'schema': 'professional-slides.deck/v3', 'id': 'short-eval', 'purpose': 'evaluation', 'cover': {'title': 'A short evaluation'},
                                        'slides': [{'title': f'Page {i} states one finding in a sentence', 'layout': 'text', 'points': ['A point that says something about the finding.']} for i in range(5)]}))
            out = Path(tmp) / 'out'
            run = subprocess.run([NODE, str(RUNTIME / 'deliver-deck.mjs'), str(spec), str(out), '--reviewer', 'packet'], capture_output=True, text=True)
            self.assertEqual(run.returncode, 2, run.stderr)
            self.assertNotIn('    at ', run.stderr)
            self.assertIn('EVALUATION_TOO_SHORT', (out / 'REJECTED.md').read_text())


if __name__ == '__main__':
    unittest.main()


@requires_python_package('pptx')
class DeliveryGateTests(unittest.TestCase):
    def cli(self, *args):
        return subprocess.run([NODE, *map(str, args)], capture_output=True, text=True,
                              env={**os.environ, 'RUNTIME_PYTHON': sys.executable}, cwd=ROOT, timeout=120)

    def test_unrendered_build_cannot_be_delivered_even_with_old_built_status(self):
        """PR #4 follow-up: an unrendered build edited to say "built" was delivered without its rendered gates."""
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); out = root / 'out'; spec = root / 'spec.json'
            spec.write_text(json.dumps({'schema': 'professional-slides.deck/v3', 'id': 'safe', 'cover': {'title': 'Decision'}, 'slides': []}))
            result = self.cli(RUNTIME / 'build-deck.mjs', spec, out, '--no-render')
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)['status'], 'built-unrendered')
            review = root / 'accepted.json'
            review.write_text(json.dumps({'accepted': True, 'summary': 'Accepted to verify that rendered gates cannot be bypassed.', 'findings': []}))
            for status in ['built-unrendered', 'built']:
                build = json.loads((out / 'build-result.json').read_text()); build['status'] = status
                (out / 'build-result.json').write_text(json.dumps(build))
                delivered = out / 'safe-DELIVERED.pptx'; delivered.write_text('stale')
                result = self.cli(RUNTIME / 'deliver-deck.mjs', spec, out, '--skip-build', '--review', review)
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertIn('MISSING_RENDERED_GATES', [f['code'] for f in json.loads(result.stdout)['blockers']])
                self.assertFalse(delivered.exists())
