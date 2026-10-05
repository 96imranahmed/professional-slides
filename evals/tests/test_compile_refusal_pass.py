"""One storyline pass outside the cap, where the runtime's own compile refuses what its own draft passed.

Three runs ended with no deck because the full compile refused bound facts
the draft had accepted, after the critique's last pass was spent. A draft is
now the full compile of the spine, so the two cannot disagree by design; this
is what holds if they ever do. The compile records its own refusal in the
deck's lineage - only while the deck is still the storyline the critique read,
only for a finding every repair of which changes a bound fact, and only where
the draft of the same pages did not raise it - and the loop grants one
verification pass on that record: those pages and the answer, shown the
findings, once in a lineage, never where another page moved.

It is not an author's to claim, by a statement or by an act. A first version
granted it on the step of the page compile that refused - the page's shape, its
evidence - and a ninth callout, a key the composer does not read or an exhibit
not written yet is refused by those steps: an author who added one after
`ready` earned a pass on that page. A page the page compile refuses never
earns it now: a page the draft passes has a layout the compile takes.

No input makes the draft and the compile disagree, which is the point, so the
disagreement is staged the only way it can be: the compile's finding handed to
the record as the compile would hand it, with a draft that raised nothing.
"""
from __future__ import annotations

import unittest

from node_probe import NODE, ROOT, run_node
from test_storyline_closure import LOOP

STAGED = LOOP + f'''
import {{ spawnSync }} from 'node:child_process';
const AUTHOR = '{ROOT}/skills/professional-slides/runtime/author-deck.mjs';
const page = (d, id) => d.pages.find((p) => p.id === id);
const doc0 = JSON.parse(await fs.readFile(path.join(FIX, 'finance.pages.json'), 'utf8'));
// The fixture laid out, its critique ready on the storyline as the full compile reads it, with the critique's one pass spent.
async function readyOn(deckPatch = {{}}) {{
  const deck = await stage('finance', deckPatch);
  const pagesFile = path.join(deck.dir, 'finance.pages.json');
  let compiled = null, measures = null;
  const write = async (edit = () => {{}}) => {{ const next = structuredClone(doc0); edit(next); next.deck = {{ ...next.deck, ...deckPatch }}; await fs.writeFile(pagesFile, JSON.stringify(next));
    const insights = await readInsights(deck.dir, 'finance', {{ alternatives: alternativesOf(next.deck) }});
    compiled = compileDeck(next, {{ insights, partial: true }}); measures = S.recordedMeasures([...insights.values()]);
    const order = new Map(next.pages.map((p, i) => [p.id, i]));
    const slides = [...compiled.spec.slides, ...compiled.failed.filter((f) => f.record).map((f) => f.record)].sort((a, b) => order.get(a.id) - order.get(b.id));
    await fs.writeFile(deck.specPath, JSON.stringify({{ ...compiled.spec, slides }})); }};
  await write();
  const one = await S.prepareStoryline(deck.specPath, deck.out, {{ maxPasses: 1 }});
  const p1 = await packetOf(one);
  const ids = p1.pages.filter((p) => p.kind === 'content').map((p) => p.id);
  const ready = await answer(deck, first(p1, ids, [], {{ verdict: 'ready', rating: 8, ...judged(true, 'sufficient'), summary: 'The answer is sharp and the pillars hold on the evidence the spine names.', topFixes: ['None material'],
    pillars: [{{ pillar: 'Growth on thinner liquidity', pages: ids, verdict: 'holds', overlap: 'One pillar; nothing overlaps.', strongestCounter: 'The cushion may rebuild as loans season.', reversal: 'Liquid assets above short-term liabilities by the old margin.', answered: true }}],
    completeness: S.STORYLINE_DIMENSIONS.map((check) => ({{ check, result: 'clean', note: `Checked ${{check}} across the spine and found nothing to raise.` }})) }}));
  // The full compile, as the author runs it; and a finding of the full compile handed to the lineage as the compile hands it.
  const compile = () => spawnSync('{NODE}', [AUTHOR, pagesFile, '--check'], {{ encoding: 'utf8' }});
  const found = (findings, drafted = []) => S.recordCompileRefusal(deck.specPath, {{ spec: compiled.spec, refused: compiled.failed.filter((f) => !f.unbound), findings, measures, drafted: async () => drafted }});
  const record = () => fs.readFile(path.join(deck.dir, '.reviews', 'finance', 'compile-refusal.json'), 'utf8').then(JSON.parse, () => null);
  const next = (o = {{}}) => S.prepareStoryline(deck.specPath, deck.out, {{ maxPasses: 1, ...o }});
  return {{ deck, write, compile, found, record, next, pagesFile, ready: ready.status, binding: p1.binding }};
}}
// A finding every repair of which writes a bound field, on a page of the storyline.
const UNPROVEN = {{ code: 'PROOF_MISSING', id: 'f4', severity: 'blocker', repair: 'f4: the claim is about measures and nothing on the page is declared to prove them' }};
// The mend, which changes what the critique is bound to on that page.
const mended = (d) => {{ page(d, 'f4').title = 'Costs fell to 62% of income while the branch count stayed at twelve'; }};
'''


class CompileRefusalPassTests(unittest.TestCase):
    def test_a_finding_the_draft_passed_and_the_compile_raises_allows_one_pass_on_its_pages_and_no_more(self):
        result = run_node(STAGED + '''
const run = async (deckPatch) => {
  const t = await readyOn(deckPatch);
  const record = await t.found([UNPROVEN]);
  await t.write(mended);
  const two = await t.next();
  const p2 = two.dir ? await packetOf(two) : null;
  const prompt = two.dir ? await fs.readFile(path.join(two.dir, 'prompt.md'), 'utf8') : '';
  // An item on a page the pass does not read is refused; a verdict on the page it reads is taken.
  const stray = await answer(t.deck, verification(p2, t.binding, [], { verdict: 'revise', rating: 6, ...judged(false, 'insufficient'), findings: [{ id: 'N1', scope: 'page', pages: ['f1'], check: 'claim', severity: 'major',
    problem: 'The claim on this page goes further than the series it shows supports.', fix: 'State the growth over the window the page shows and no more.', basis: 'changed', justification: 'The revision changed the page this item is on.', evidence: '' }] }));
  const taken = await answer(t.deck, verification(p2, t.binding, []));
  const history = JSON.parse(await fs.readFile(path.join(t.deck.dir, '.reviews', 'finance', 'storyline-history', 'pass-2.json'), 'utf8'));
  // The pass is spent: another change to the same page is an ordinary pass, and the cap holds it.
  await t.write((d) => { mended(d); page(d, 'f4').title = 'Costs fell to 62% of income with every one of the twelve branches kept'; });
  const again = await t.next();
  await clear(t.deck);
  return { ready: t.ready, record: record && [record.binding === t.binding, record.pages, record.findings.map((f) => [f.id, f.code])],
    two: [two.status, two.pass, two.compileRefusal ?? null, p2?.scope.changed], opening: prompt.split('\\n')[0], shown: prompt.includes('WHAT THE COMPILE REFUSED') && /- R1 · PROOF_MISSING · blocker · f4: f4: the claim is about measures/.test(prompt),
    stray: [stray.status, stray.errors ?? []], taken: taken.status, kind: [history.kind, history.compileRefusal.pages, history.compileRefusal.refusals.map((r) => [r.page, r.code])],
    again: [again.status, again.message ?? ''] };
};
console.log(JSON.stringify({ new: await run({}), revision: await run({ workflow: 'existing_deck_revision' }) }));
''')
        for name in ("new", "revision"):
            run = result[name]
            self.assertEqual(run["ready"], "ready", name)
            self.assertEqual(run["record"], [True, ["f4"], [["f4", "PROOF_MISSING"]]], name)
            # The critique's one pass is spent, and the storyline loop still writes this one.
            self.assertEqual(run["two"][:2], ["packet-written", 2], name)
            self.assertEqual(run["two"][2]["pages"], ["f4"], name)
            self.assertEqual(run["two"][3], ["f4"], name)
            self.assertIn("the runtime's own compile then refused, on that storyline", run["opening"], name)
            self.assertIn("it does not count against the cap of 1", run["opening"], name)
            self.assertTrue(run["shown"], name)
            self.assertEqual(run["stray"][0], "invalid", name)
            self.assertTrue(any("the pass a compile refusal allowed, which reads f4 and the answer only; f1 is outside it" in error for error in run["stray"][1]), run["stray"][1])
            self.assertEqual(run["taken"], "ready", name)
            self.assertEqual(run["kind"], ["compile-refusal", ["f4"], [["f4", "PROOF_MISSING"]]], name)
            self.assertEqual(run["again"][0], "capped", name)
            self.assertIn("the one pass a compile refusal allows in a lineage is spent", run["again"][1], name)

    def test_nothing_an_author_adds_after_ready_earns_the_pass(self):
        # Each of these is refused by the full compile on a storyline that is still the one the critique read. The first three
        # were granted the pass when it was read off the step of the page compile that refused; the draft of the same pages
        # refuses or completes each, so none is a disagreement of the runtime with itself, and none is recorded.
        result = run_node(STAGED + '''
const provocations = {
  callouts: (d) => { const ex = page(d, 'f2').exhibit; ex.annotations = Array.from({ length: 9 }, () => ({ category: 'FY26', text: 'A note the plot does not need here' })); },
  unknownKey: (d) => { page(d, 'f4').madeUp = 1; },
  copyLeftOut: (d) => { for (const p of d.pages) if (p.type) { delete p.points; delete p.rail; delete p.bar; delete p.adds; } },
  untypedPanel: (d) => { delete page(d, 'f4').exhibits[1].type; },
};
const out = {};
for (const [name, provoke] of Object.entries(provocations)) {
  const t = await readyOn();
  await fs.writeFile(t.pagesFile, JSON.stringify((() => { const d = structuredClone(doc0); provoke(d); return d; })()));
  const run = t.compile(), record = await t.record();
  await t.write(mended);
  const next = await t.next();
  out[name] = { exit: run.status, said: run.stderr.includes('the runtime disagrees with itself'), record, next: next.status };
  await clear(t.deck);
}
console.log(JSON.stringify(out));
''')
        for name, run in result.items():
            self.assertEqual([run["exit"], run["said"], run["record"], run["next"]], [2, False, None, "capped"], name)

    def test_the_record_holds_only_what_the_draft_passed_and_only_bound_findings_of_the_ready_storyline(self):
        result = run_node(STAGED + '''
const t = await readyOn();
// The draft of the same pages raises it too: both say it, so the runtime agrees with itself.
const agreed = await t.found([UNPROVEN], [UNPROVEN]);
// A page the page compile refuses, whatever step refused it; a finding the copy or the layout can mend; a finding on no page of the storyline.
const compiled = await t.found([{ code: 'COMPILE', id: 'f4', severity: 'blocker', stage: 'shape', repair: 'f4: 2 exhibits have no `type`' }]);
const mendable = await t.found([{ code: 'TILES_ONE_MEASURE', id: 'f4', severity: 'blocker', repair: 'f4: two tiles of one measure' }, { code: 'SCENE_VOID', id: 'f4', severity: 'blocker', repair: 'f4: a band stands empty' }]);
const elsewhereFound = await t.found([{ ...UNPROVEN, id: 'zz' }, { ...UNPROVEN, id: undefined }]);
// No compile raised anything: the author changes a bound fact of a page, and the cap holds.
await t.write(mended);
const noRecord = await t.next();
// The compile's finding was on f4, and the author changes another page with it; and only another page.
const wide = await readyOn();
await wide.found([UNPROVEN]);
await wide.write((d) => { mended(d); page(d, 'f1').title = 'Loans grew 57% in seven years, twice the pace of deposits'; });
const outside = await wide.next();
const other = await readyOn();
await other.found([UNPROVEN]);
await other.write((d) => { page(d, 'f1').title = 'Loans grew 57% in seven years, twice the pace of deposits'; });
const elsewhere = await other.next();
// A deck that is no longer the storyline the critique read records nothing.
const drifted = await readyOn();
await drifted.write((d) => { page(d, 'f1').title = 'Loans grew 57% in seven years, twice the pace of deposits'; });
const drift = await drifted.found([UNPROVEN]);
// A record written by hand for another storyline is not this lineage's.
const forged = await readyOn();
await fs.writeFile(path.join(forged.deck.dir, '.reviews', 'finance', 'compile-refusal.json'), JSON.stringify({ binding: 'not-this-binding', pass: 1, pages: ['f4'], findings: [{ id: 'f4', code: 'PROOF_MISSING', reason: 'claimed' }] }));
await forged.write(mended);
const forgedNext = await forged.next();
for (const x of [t, wide, other, drifted, forged]) await clear(x.deck);
console.log(JSON.stringify({ nulls: [agreed, compiled, mendable, elsewhereFound, drift], noRecord: [noRecord.status, noRecord.message ?? ''], outside: [outside.status, outside.message ?? ''], elsewhere: [elsewhere.status, elsewhere.message ?? ''],
  forged: [forgedNext.status, forgedNext.message ?? ''] }));
''')
        self.assertEqual(result["nulls"], [None] * 5)
        self.assertEqual(result["noRecord"][0], "capped")
        self.assertIn("no full compile of this deck has raised, on the storyline the critique passed as ready", result["noRecord"][1])
        self.assertEqual(result["outside"][0], "capped")
        self.assertIn("f1 changed, and the compile refused nothing bound on it (it refused f4)", result["outside"][1])
        self.assertEqual(result["elsewhere"][0], "capped")
        self.assertIn("f1 changed, and the compile refused nothing bound on it", result["elsewhere"][1])
        self.assertEqual(result["forged"][0], "capped")
        self.assertIn("was of another storyline than the one the latest pass read", result["forged"][1])


if __name__ == "__main__":
    unittest.main()
