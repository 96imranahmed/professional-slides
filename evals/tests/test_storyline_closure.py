"""How a storyline item closes, and what the critic is told before it judges.

A storyline critique sent a deck back three times for the same missing
analyses. Each revision added a caveat - the page now said what the evidence
did not establish - and each pass reported "partly fixed". Two things were
wrong with the loop. Nothing tied closing a missing analysis to the analysis
existing, so a qualification could pass for a repair. And the author was
confined to the records supplied, which the critic was not told: it asked,
pass after pass, for data nobody was allowed to fetch, under a request it was
told was verbatim and had in fact been reconstructed.

These hold the repair: a missing analysis names how it can be supplied and
closes on a computed artifact a page rests on; a retrieval the evidence scope
forbids stays open at its severity and the storyline can pass only as
provisional, on a deck that offers its answer as provisional; compliance and
sufficiency are two judgements held to the ledger; the rating is on one
anchored scale; and the critic is told how the request came to be.
"""
import unittest

from node_probe import ROOT, run_node

FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"

LOOP = f'''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
import * as P from './skills/professional-slides/runtime/review-passes.mjs';
import {{ compileDeck, readInsights }} from './skills/professional-slides/runtime/author-deck.mjs';
import {{ alternativesOf }} from './skills/professional-slides/runtime/analysis.mjs';
const FIX = '{FIXTURES}';
// A fixture deck staged as a task folder: its spine compiled, its insight log and analysis plan beside it.
async function stage(name, deckPatch = {{}}, initial = null) {{
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'closure-'));
  const out = path.join(dir, 'out'); await fs.mkdir(out);
  for (const file of [`${{name}}.insights.json`, `${{name}}.analysis.json`]) await fs.copyFile(path.join(FIX, file), path.join(dir, file)).catch(() => {{}});
  const log = JSON.parse(await fs.readFile(path.join(dir, `${{name}}.insights.json`), 'utf8'));
  await fs.mkdir(path.join(dir, 'sources'));
  for (const item of log.insights) for (const file of item.sources) await fs.writeFile(path.join(dir, file), 'illustrative');
  const doc = JSON.parse(await fs.readFile(path.join(FIX, `${{name}}.pages.json`), 'utf8'));
  const specPath = path.join(dir, `${{name}}.deck.json`);
  // `mutate` edits a copy of the pages document before it is compiled: how a test moves the storyline between passes.
  const write = async (patch = {{}}, mutate = initial) => {{
    const edited = structuredClone(doc);
    if (mutate) mutate(edited);
    const deck = {{ ...edited.deck, ...deckPatch, ...patch }};
    const insights = await readInsights(dir, name, {{ alternatives: alternativesOf(deck) }});
    const {{ spec }} = compileDeck({{ ...edited, deck }}, {{ insights, draft: true, partial: true }});
    await fs.writeFile(specPath, JSON.stringify(spec));
    return spec;
  }};
  return {{ dir, out, specPath, write, spec: await write() }};
}}
const packetOf = async (step) => JSON.parse(await fs.readFile(path.join(step.dir, 'packet.json'), 'utf8'));
const judged = (complete, sufficiency) => ({{ compliance: {{ verdict: complete ? 'complete' : 'incomplete', note: 'Judged against what the evidence in scope allows.' }},
  sufficiency: {{ verdict: sufficiency, note: 'Judged against the answer as it is stated.' }} }});
const missing = (id, remedy, pub = 'known', severity = 'major') => ({{ id, analysis: `The analysis ${{id}} the answer turns on`, why: 'It would change which district takes the first crews.', data: 'The records named in the packet', public: pub, remedy, severity }});
// A first spine critique that sends the storyline back for the analyses it names.
const first = (packet, ids, missingAnalyses, o = {{}}) => ({{ pass: 1, verifies: null, verdict: 'revise', rating: 6, binding: packet.binding, summary: 'The argument holds in outline but two analyses it turns on are missing.',
  ...judged(false, 'insufficient'), provenance: {{ backend: 'subagent', model: 'fixture', promptHash: packet.promptHash }},
  spine: 'Read alone, the titles build from the rise in response time to where the crews should go.', answer: 'Demand per crew and handover drive the rise; two districts take the first crews.',
  answerParts: [{{ part: 'Why are response times rising', verdict: 'answered', missingEvidence: '' }}, {{ part: 'Where should the first crews go', verdict: 'answered', missingEvidence: '' }}],
  pillars: [{{ pillar: 'Demand and handover', pages: ids, verdict: 'weak', overlap: 'One pillar; nothing overlaps.', strongestCounter: 'Vehicles, not crews, may bind.', reversal: 'Vehicle availability below crews on shift.', answered: false }}],
  numbers: 'The figures agree across the pages that print them.', sectionFlow: 'One section, opened and closed in order.', execSummary: 'No summary page in this short spine; the titles carry it.',
  missingAnalyses, cutOrMerge: [], findings: [], topFixes: ['Run the missing analyses'],
  completeness: S.STORYLINE_DIMENSIONS.map((check) => ({{ check, result: check === 'missing' ? 'findings' : 'clean', note: check === 'missing' ? 'Filed the missing analyses.' : `Checked ${{check}} across the spine and found nothing to raise.` }})), ...o }});
const verification = (packet, verifies, statuses, o = {{}}) => ({{ pass: 2, verifies, verdict: 'ready', rating: 8, binding: packet.binding, summary: 'Each open item was checked against what the packet now holds.',
  ...judged(true, 'sufficient'), provenance: {{ backend: 'subagent', model: 'fixture', promptHash: packet.promptHash }}, statuses, findings: [], topFixes: [], ...o }});
const status = (finding, s, o = {{}}) => ({{ finding, status: s, evidence: 'The packet lists the analysis and the page that rests on it.', ...o }});
const answer = async (deck, review) => {{ await fs.writeFile(path.join(deck.out, 'storyline-review.json'), JSON.stringify(review)); return S.prepareStoryline(deck.specPath, deck.out); }};
const said = (step, text) => (step.errors || []).some((e) => e.includes(text));
const clear = async (deck) => {{ const packet = JSON.parse(await fs.readFile(path.join(deck.dir, '.reviews', path.basename(deck.specPath).replace('.deck.json', ''), 'storyline-packet.json'), 'utf8').catch(() => 'null'));
  if (packet?.staging) await fs.rm(packet.staging, {{ recursive: true, force: true }}); await fs.rm(deck.dir, {{ recursive: true, force: true }}); }};
'''


class ClosureTests(unittest.TestCase):
    def test_a_missing_analysis_closes_on_its_artifact_and_a_forbidden_one_stays_open(self):
        result = run_node(LOOP + '''
// At the first pass no page rests on the headroom analysis; the team's repair is to rest the page on it.
const unrest = (d) => { for (const page of d.pages) if (Array.isArray(page.evidence)) page.evidence = page.evidence.filter((id) => id !== 'B-headroom'); };
const deck = await stage('public-ops', {}, unrest);
const one = await S.prepareStoryline(deck.specPath, deck.out);
const p1 = await packetOf(one);
const prompt = await fs.readFile(path.join(one.dir, 'prompt.md'), 'utf8');
const ids = p1.pages.filter((p) => p.kind === 'content').map((p) => p.id);
const critique = first(p1, ids, [missing('M1', 'computable', 'speculative'), missing('M2', 'retrieval')]);
const revise = await answer(deck, critique);
// The team narrows what it offers: the answer is now provisional, and says what it leaves open.
await deck.write({ answer: 'On the board papers alone, demand per crew and handover drive the rise; Uplands and Valley take the first crews, provisionally.',
  answerStatus: 'provisional', answerLimits: ['Whether vehicles rather than crews bind cannot be settled without the fleet register'] }, null);
const two = await S.prepareStoryline(deck.specPath, deck.out);
const p2 = await packetOf(two);
const prompt2 = await fs.readFile(path.join(two.dir, 'prompt.md'), 'utf8');
const pass = (statuses, o) => answer(deck, verification(p2, critique.binding, statuses, o));
const provisional = { verdict: 'provisional', rating: 7, ...judged(true, 'provisional') };
const caveat = await pass([status('M1', 'fixed'), status('M2', 'scope-limited')], provisional);
const notRun = await pass([status('M1', 'fixed', { artifact: 'B-vehicles' }), status('M2', 'scope-limited')], provisional);
const handWritten = await pass([status('M1', 'fixed', { artifact: 'o-response' }), status('M2', 'scope-limited')], provisional);
const unrested = await pass([status('M1', 'fixed', { artifact: 'B-districts-unused' }), status('M2', 'scope-limited')], provisional);
const searched = await pass([status('M1', 'fixed', { artifact: 'B-headroom' }), status('M2', 'unavailable', { searchLog: 'sources/o-response.csv' })]);
const ready = await pass([status('M1', 'fixed', { artifact: 'B-headroom' }), status('M2', 'scope-limited')]);
const sufficient = await pass([status('M1', 'fixed', { artifact: 'B-headroom' }), status('M2', 'scope-limited')], { ...provisional, ...judged(true, 'sufficient') });
const lowered = await pass([status('M1', 'fixed', { artifact: 'B-headroom' }), status('M2', 'scope-limited', { severity: 'minor' })], provisional);
const overrated = await pass([status('M1', 'fixed', { artifact: 'B-headroom' }), status('M2', 'scope-limited')], { ...provisional, rating: 8 });
const wrongItem = await pass([status('M1', 'scope-limited'), status('M2', 'scope-limited')], { ...provisional, ...judged(false, 'insufficient'), verdict: 'revise', rating: 6 });
const accepted = await pass([status('M1', 'fixed', { artifact: 'B-headroom' }), status('M2', 'scope-limited')], provisional);
const spec = JSON.parse(await fs.readFile(deck.specPath, 'utf8'));
const gate = await S.storylineGate(spec, deck.out, { deckPath: deck.specPath });
const outcome = await S.storylineOutcome(spec, deck.out, { deckPath: deck.specPath });
// A deck that then claims its answer is final cannot keep a provisional pass.
const final = { ...spec }; delete final.answerStatus; delete final.answerLimits;
const finalGate = await S.storylineGate(final, deck.out, { deckPath: deck.specPath });
await clear(deck);
// A second deck where the analysis was computed and rested on from the start, and the only thing
// that moves between the passes is the last page's title: nothing an open item can close on.
const still = await stage('public-ops');
const s1 = await packetOf(await S.prepareStoryline(still.specPath, still.out));
const sids = s1.pages.filter((p) => p.kind === 'content').map((p) => p.id);
const filed = first(s1, sids, [missing('M1', 'computable', 'speculative')], { findings: [{ id: 'F1', scope: 'page', pages: [sids[0]], check: 'claim', severity: 'major', problem: 'The title states a topic, not what the series shows.', fix: 'State the rise and its size in the title.' }],
  completeness: S.STORYLINE_DIMENSIONS.map((check) => ({ check, result: ['missing', 'claim'].includes(check) ? 'findings' : 'clean', note: ['missing', 'claim'].includes(check) ? `Filed an item under ${check}.` : `Checked ${check} across the spine and found nothing to raise.` })) });
await answer(still, filed);
await still.write({}, (d) => { d.pages.at(-1).title = `${d.pages.at(-1).title} now`; });
const s2 = await packetOf(await S.prepareStoryline(still.specPath, still.out));
const unmoved = await answer(still, verification(s2, filed.binding, [status('F1', 'fixed'), status('M1', 'fixed', { artifact: 'B-headroom' })]));
await clear(still);
console.log(JSON.stringify({ one: one.status, revise: revise.status, two: [two.status, p2.scope.answerChanged],
  unmoved: [unmoved.status, said(unmoved, 'already computed and rested on, unchanged'), said(unmoved, 'does not close on a storyline that did not move'), s2.scope.changed.includes(sids[0])],
  told: [prompt.includes('EVIDENCE SCOPE: closed'), prompt.includes('only the board papers supplied by the service may be used'), prompt.includes('B-vehicles [gap, unavailable]'), prompt.includes('B-path [scenario, assumed]')],
  told2: [prompt2.includes('THE ANSWER IS OFFERED AS PROVISIONAL'), prompt2.includes('THE ANSWER HAS CHANGED')],
  analyses: p1.analyses.map((a) => [a.id, a.status]),
  caveat: [caveat.status, said(caveat, 'fixed on its artifact')], notRun: [notRun.status, said(notRun, 'could not be run')], handWritten: [handWritten.status, said(handWritten, 'not among the packet\\'s computed analyses')],
  unrested: [unrested.status, said(unrested, 'not among the packet')], searched: [searched.status, said(searched, 'the evidence scope is closed')],
  ready: [ready.status, said(ready, 'verdict is ready while M2'), said(ready, 'sufficiency is sufficient while M2')], sufficient: [sufficient.status, said(sufficient, 'sufficiency is sufficient while M2')],
  lowered: [lowered.status, said(lowered, 'keeps its major severity')], overrated: [overrated.status, said(overrated, '7 or less')],
  wrongItem: [wrongItem.status, said(wrongItem, 'the team can still act on it')],
  accepted: [accepted.status, accepted.limits?.length], gate, outcome: [outcome.verdict, outcome.open.map((e) => [e.id, e.severity]), outcome.answerLimits.length], finalGate: finalGate.some((e) => e.includes('offers its answer as final')) }));
''')
        self.assertEqual(result["one"], "packet-written")
        self.assertEqual(result["revise"], "revise")
        self.assertEqual(result["two"], ["packet-written", True])
        # The critic is told the scope, what the runtime computed, and what it could not.
        self.assertEqual(result["told"], [True, True, True, True])
        self.assertEqual(result["told2"], [True, True])
        self.assertIn(["B-vehicles", "unavailable"], result["analyses"])
        # A qualification is not the analysis; nor is a run that failed, nor an insight written by hand.
        self.assertEqual(result["caveat"], ["invalid", True])
        self.assertEqual(result["notRun"], ["invalid", True])
        self.assertEqual(result["handWritten"], ["invalid", True])
        self.assertEqual(result["unrested"], ["invalid", True])
        # Nor does an item close on what already stood when it was filed, or on a page that did not move.
        self.assertEqual(result["unmoved"], ["invalid", True, True, False])
        self.assertEqual(result["searched"], ["invalid", True])  # nothing could be searched
        # The forbidden retrieval stays open at its severity: not ready, not sufficient, not lowered.
        self.assertEqual(result["ready"], ["invalid", True, True])
        self.assertEqual(result["sufficient"], ["invalid", True])
        self.assertEqual(result["lowered"], ["invalid", True])
        self.assertEqual(result["overrated"], ["invalid", True])
        self.assertEqual(result["wrongItem"], ["invalid", True])  # a computable analysis is not excused by the scope
        # Provisional is a pass of its own: the gate opens, and the record keeps what stayed open.
        self.assertEqual(result["accepted"], ["provisional", 1])
        self.assertEqual(result["gate"], [])
        self.assertEqual(result["outcome"], ["provisional", [["M2", "major"]], 1])
        self.assertTrue(result["finalGate"])

    def test_what_a_remedy_allows_and_what_narrowing_needs(self):
        result = run_node(LOOP + '''
const deck = await stage('product');
const one = await S.prepareStoryline(deck.specPath, deck.out);
const p1 = await packetOf(one);
const ids = p1.pages.filter((p) => p.kind === 'content').map((p) => p.id);
const check = (review) => S.validateStorylineRecord(review, { ids, contentIds: ids, mode: 'spine', analyses: p1.analyses, evidenceScope: p1.evidenceScope, answerStatus: p1.answerStatus });
const guess = check(first(p1, ids, [missing('M1', 'retrieval', 'speculative')]));
const computable = check(first(p1, ids, [missing('M1', 'computable', 'speculative')]));
const assumption = check(first(p1, ids, [missing('M1', 'assumption', 'speculative', 'blocker')], { rating: 5 }));
const noRemedy = check(first(p1, ids, [{ ...missing('M1', 'retrieval'), remedy: undefined }]));
const overrated = check(first(p1, ids, [missing('M1', 'computable', 'speculative', 'blocker')]));
const complete = check(first(p1, ids, [missing('M1', 'retrieval')], judged(true, 'insufficient')));
const provisional = check(first(p1, ids, [missing('M1', 'retrieval')], { verdict: 'provisional', ...judged(true, 'provisional') }));
const critique = first(p1, ids, [missing('M1', 'retrieval')]);
await answer(deck, critique);
// A title changes; the answer does not.
const doc = JSON.parse(await fs.readFile(deck.specPath, 'utf8'));
doc.slides[0].title = 'New onboarding lifts retention 15 points by March'; doc.slides[0].pageType.content.claim = doc.slides[0].title;
await fs.writeFile(deck.specPath, JSON.stringify(doc));
const two = await S.prepareStoryline(deck.specPath, deck.out);
const p2 = await packetOf(two);
const narrowedSame = await answer(deck, verification(p2, critique.binding, [status('M1', 'narrowed')]));
const limitedOpen = await answer(deck, verification(p2, critique.binding, [status('M1', 'scope-limited')], { verdict: 'revise', rating: 6, ...judged(true, 'insufficient') }));
// The answer now claims less, and the item no longer bears on it. (The refused answers are cleared: the next packet is for the new spine.)
await fs.rm(path.join(deck.out, 'storyline-review.json'));
await fs.writeFile(deck.specPath, JSON.stringify({ ...doc, answer: 'Lumen leads on retention among the two products that publish it, and invests there.' }));
const three = await S.prepareStoryline(deck.specPath, deck.out);
const p3 = await packetOf(three);
const narrowed = await answer(deck, verification(p3, critique.binding, [status('M1', 'narrowed', { evidence: 'The answer now claims the lead only among the two products that publish retention.' })]));
await clear(deck);
console.log(JSON.stringify({ guess, computable, assumption, noRemedy: noRemedy.some((e) => e.includes('remedy')), overrated, complete, provisional,
  two: [two.status, p2.scope.answerChanged], narrowedSame: [narrowedSame.status, said(narrowedSame, 'the answer has not changed')],
  limitedOpen: [limitedOpen.status, said(limitedOpen, 'evidence scope is open')], three: p3.scope.answerChanged, narrowed: narrowed.status,
  remedies: Object.keys(S.REMEDIES), statuses: S.STORYLINE_STATUSES, verdicts: S.STORYLINE_VERDICTS, closed: P.CLOSED }));
''')
        # A guess at what might be published is still never major; an analysis the packet can compute, or assume, needs no public source.
        self.assertTrue(any("known to be public" in e for e in result["guess"]), result["guess"])
        self.assertEqual(result["computable"], [])
        self.assertEqual(result["assumption"], [])
        self.assertTrue(result["noRemedy"])
        self.assertTrue(any("5 or less" in e for e in result["overrated"]), result["overrated"])  # a blocker open caps the rating
        self.assertTrue(any("compliance is complete while M1" in e for e in result["complete"]), result["complete"])  # the scope is open: the team can fetch it
        self.assertTrue(any("provisional is for a storyline whose only open items the evidence scope forbids" in e for e in result["provisional"]), result["provisional"])
        self.assertEqual(result["two"], ["packet-written", False])
        self.assertEqual(result["narrowedSame"], ["invalid", True])
        self.assertEqual(result["limitedOpen"], ["invalid", True])
        self.assertTrue(result["three"])
        self.assertEqual(result["narrowed"], "ready")
        self.assertEqual(result["remedies"], ["computable", "assumption", "retrieval"])
        self.assertEqual(result["statuses"][-3:], ["unavailable", "narrowed", "scope-limited"])
        self.assertEqual(result["verdicts"], ["ready", "provisional", "revise"])
        self.assertNotIn("scope-limited", result["closed"])  # a limit recorded, never a defect excused


class ProvenanceTests(unittest.TestCase):
    def test_the_critic_is_told_how_the_request_came_to_be(self):
        result = run_node(LOOP + '''
import { requestPrompt } from './skills/professional-slides/runtime/reviewer.mjs';
const verbatim = await stage('explainer');
const rebuilt = await stage('explainer', { requestProvenance: 'reconstructed' });
const read = async (deck) => { const step = await S.prepareStoryline(deck.specPath, deck.out); return { step, prompt: step.dir ? await fs.readFile(path.join(step.dir, 'prompt.md'), 'utf8') : '' }; };
const a = await read(verbatim), b = await read(rebuilt);
const bad = await stage('explainer', { requestProvenance: 'remembered', evidenceScope: { retrieval: 'closed' }, answerStatus: 'provisional' });
const refused = await S.prepareStoryline(bad.specPath, bad.out);
const statements = P.deckStatementFindings(bad.spec).map((f) => f.code);
const deckReview = { request: 'What should we do?', answer: 'This.' };
console.log(JSON.stringify({ verbatim: [a.prompt.includes('(verbatim - the yardstick'), a.prompt.includes('EVIDENCE SCOPE')],
  rebuilt: [b.prompt.includes('(verbatim'), b.prompt.includes('(reconstructed: rebuilt from a brief'), b.prompt.includes('not the user\\'s own words')],
  bindings: a.step.binding !== b.step.binding, hashes: [P.requestHash(verbatim.spec) === P.sha256(verbatim.spec.request), P.requestHash(rebuilt.spec) !== P.requestHash(verbatim.spec)],
  refused: [refused.status, refused.errors.join(' ')], statements,
  deck: [requestPrompt(deckReview).includes('(verbatim - the yardstick'), requestPrompt({ ...deckReview, requestProvenance: 'paraphrased', evidenceScope: { retrieval: 'closed', note: 'the data room only' }, answerStatus: { status: 'provisional', limits: ['The margin by segment is not in the data room'] } })] }));
await clear(verbatim); await clear(rebuilt); await clear(bad);
''')
        self.assertEqual(result["verbatim"], [True, False])
        self.assertEqual(result["rebuilt"], [False, True, True])
        # A critique of a reconstructed request is not a critique of the verbatim one.
        self.assertTrue(result["bindings"])
        self.assertEqual(result["hashes"], [True, True])  # a deck that says nothing keeps the hash of its words alone
        self.assertEqual(result["refused"][0], "refused")
        for part in ("requestProvenance", "evidenceScope", "answerLimits"):
            self.assertIn(part, result["refused"][1])
        self.assertEqual(result["statements"], ["STATEMENT_INVALID"])
        # The deck's reviewer is told the same, in the same words.
        self.assertTrue(result["deck"][0])
        self.assertIn("(paraphrased: the author's restatement", result["deck"][1])
        self.assertIn("EVIDENCE SCOPE: closed - only the evidence supplied may be used (the data room only)", result["deck"][1])
        self.assertIn("THE ANSWER IS OFFERED AS PROVISIONAL", result["deck"][1])


if __name__ == "__main__":
    unittest.main()


class ScopeTests(unittest.TestCase):
    def test_the_author_cannot_close_the_evidence_scope_on_a_request_that_does_not_say_so(self):
        result = run_node(LOOP + '''
const note = 'only what the team already has on file';
const tried = async (patch) => { const deck = await stage('explainer', patch); const step = await S.prepareStoryline(deck.specPath, deck.out); await clear(deck); return [step.status, (step.errors || []).join(' ')]; };
const request = 'Explain how the signalling upgrade works. Use only the documents in the project folder.';
console.log(JSON.stringify({
  unquoted: await tried({ evidenceScope: { retrieval: 'closed', note } }),
  invented: await tried({ evidenceScope: { retrieval: 'closed', note, quote: 'use nothing but the papers supplied' } }),
  paraphrased: await tried({ request, requestProvenance: 'paraphrased', evidenceScope: { retrieval: 'closed', note, quote: 'Use only the documents in the project folder' } }),
  quoted: await tried({ request, evidenceScope: { retrieval: 'closed', note, quote: 'Use only the documents in the project folder' } }) }));
''')
        self.assertEqual(result["unquoted"][0], "refused")
        self.assertIn("quotes, in `quote`, the words of the `request`", result["unquoted"][1])
        self.assertEqual(result["invented"][0], "refused")  # words the request does not contain
        self.assertEqual(result["paraphrased"][0], "refused")
        self.assertIn("rests on the user's own words", result["paraphrased"][1])
        self.assertEqual(result["quoted"][0], "packet-written")
