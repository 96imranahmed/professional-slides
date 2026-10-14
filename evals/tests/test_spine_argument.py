"""The storyline critique's argument reading: the deck review's argument rubric, read on the spine's records, once.

On ba4 the storyline critique rated the spine 8 and closed; the deck review then
rejected the deck at 5/10, and 34 of its findings were visible from the spine
alone - "outrank" with no common measure, a record 2025 margin set against 2018
before IFRS 16, a seat share across all ventures beside IAG's own share. The
critic read for flow and was never shown a measure's population, boundaries,
basis or its sources' dates, so a comparison across bases could not be seen.

The first pass now lists every title and every comparison a page's `settles`
names as an item, prints the records behind them, and refuses an answer
without a verdict on each. A failing item's fix is checked as the lead will
apply it, and applied word for word it closes with no second reading.
"""
import unittest

from node_probe import run_node
from test_storyline_closure import LOOP

ARGUED = LOOP + '''
import * as R from './skills/professional-slides/runtime/reviewer.mjs';
import * as A from './skills/professional-slides/runtime/spine-argument.mjs';
const holds = (packet, except = {}) => packet.argument.items.map((item) => except[item.id] ?? { item: item.id, verdict: 'holds' });
const fails = (item, code, fix) => ({ item, verdict: 'fails', code, problem: 'The records the page rests on show the defect named here, on its measure and member.', fix });
'''


class PacketTests(unittest.TestCase):
    def test_the_first_packet_lists_every_title_and_comparison_with_the_records_behind_them(self):
        # The ba4 critic was never shown a boundary, a basis or a source's date: Dunmore's capital ratio is a calendar year
        # beside the others' fiscal years, which only the measure's boundaries say.
        result = run_node(ARGUED + '''
const deck = await stage('finance');
const one = await S.prepareStoryline(deck.specPath, deck.out);
const packet = await packetOf(one);
const prompt = await fs.readFile(path.join(one.dir, 'prompt.md'), 'utf8');
const schema = JSON.parse(await fs.readFile(path.join(one.dir, 'schema.json'), 'utf8'));
await clear(deck);
console.log(JSON.stringify({ items: packet.argument.items.map((i) => i.id), boundary: prompt.includes('| boundaries: Dunmore: calendar year, not fiscal'),
  population: prompt.includes('- i-peers/capital: % of risk-weighted assets | '), source: /- regulator-returns: .+/.test(prompt),
  codes: Object.entries(A.SPINE_ARGUMENT_CODES).every(([code, means]) => prompt.includes(`- ${code}: ${means}`)), required: schema.required.includes('argument') }));
''')
        self.assertIn("title:f0", result["items"])
        self.assertIn("title:f4", result["items"])
        self.assertIn("compare:f5", result["items"])                      # eight credit unions on four measures
        self.assertNotIn("compare:f1", result["items"])                   # one series over time sets nothing against anything
        self.assertTrue(result["boundary"], result)
        self.assertTrue(result["population"], result)
        self.assertTrue(result["source"], result)
        self.assertTrue(result["codes"], result)                          # the reviewer's argument codes, in its words
        self.assertTrue(result["required"], result)

    def test_the_reviewer_and_the_critic_read_one_table_of_argument_codes(self):
        result = run_node(ARGUED + '''
console.log(JSON.stringify({ same: Object.entries(P.ARGUMENT_CODES).every(([code, means]) => R.CODES[code] === means),
  spine: Object.keys(P.ARGUMENT_CODES).every((code) => R.decidableAt({ code }) === 'spine'),
  coined: ['COUNTER_EVIDENCE_OMITTED', 'MISSING_MEMBER'].every((code) => R.CODES[code] !== undefined) }));
''')
        self.assertEqual(result, {"same": True, "spine": True, "coined": True})


class AnswerTests(unittest.TestCase):
    def test_an_answer_without_a_verdict_on_every_item_is_refused(self):
        result = run_node(ARGUED + '''
const deck = await stage('finance');
const one = await S.prepareStoryline(deck.specPath, deck.out);
const packet = await packetOf(one);
const ids = packet.pages.filter((p) => !p.kind || p.kind === 'content').map((p) => p.id);
const short = first(packet, ids, [], { argument: holds(packet).filter((v) => v.item !== 'compare:f5') });
const refused = await answer(deck, short);
const whole = await answer(deck, first(packet, ids, [], { argument: holds(packet) }));
await clear(deck);
console.log(JSON.stringify({ refused: refused.status, said: said(refused, 'compare:f5'), whole: whole.status }));
''')
        self.assertEqual(result["refused"], "invalid")
        self.assertTrue(result["said"], result)
        self.assertEqual(result["whole"], "ready")

    def test_a_failing_items_fix_is_checked_as_the_lead_will_apply_it(self):
        # Each fix is the full replacement of one field; one that would trip a rule refuses the answer before anyone applies it.
        result = run_node(ARGUED + '''
const deck = await stage('finance');
const one = await S.prepareStoryline(deck.specPath, deck.out);
const packet = await packetOf(one);
const ids = packet.pages.filter((p) => !p.kind || p.kind === 'content').map((p) => p.id);
const long = 'Profit rose again in the year while operating cash flow fell sharply and the gap between the two now matters a great deal for funding';
const verdicts = holds(packet, {
  'title:f2': fails('title:f2', 'FACTUAL_ERROR', { title: 'Profit rose again while operating cash flow fell 57% in the year' }),
  'title:f3': fails('title:f3', 'UNCLEAR_ARGUMENT', { title: long }),
  'title:f4': fails('title:f4', 'UNSUPPORTED_CLAIM', { evidence: ['i-efficiency', 'i-nowhere'] }),
  'compare:f5': fails('compare:f5', 'MISSING_MEMBER', { peerSet: 'regional credit unions' }),
  'title:f5': fails('title:f5', 'MISLEADING_COMPARISON', { basis: { measure: 'i-peers/capital', at: 'Zedbank', note: 'calendar year, not fiscal year' } }),
  'title:f1': fails('title:f1', 'EDITORIAL', { title: 'Loans grew in seven years' }),
});
const refused = S.judgeCritique(first(packet, ids, [], { argument: verdicts }), S.packetContext(packet));
const good = holds(packet, { 'compare:f5': fails('compare:f5', 'MISLEADING_COMPARISON', { basis: { measure: 'i-peers/capital', at: 'Eastbank', note: 'not published for FY26' } }) });
const accepted = S.judgeCritique(first(packet, ids, [], { argument: good }), S.packetContext(packet));
await clear(deck);
const hit = (text) => refused.errors.some((e) => e.includes(text));
console.log(JSON.stringify({ number: hit('prints 57%'), long: hit('title:f3') && hit('fix.title'), unknown: hit('i-nowhere'), peerSet: hit('regional credit unions'),
  member: hit('Zedbank'), code: hit('title:f1') && hit('the code the deck review would file'),
  accepted: accepted.errors, open: (accepted.ledger || []).filter((e) => e.status === 'open').map((e) => [e.id, e.code, e.severity, e.repair.startsWith('Apply word for word')]) }));
''')
        for check in ("number", "long", "unknown", "peerSet", "member", "code"):
            self.assertTrue(result[check], (check, result))
        self.assertEqual(result["accepted"], [])
        self.assertEqual(result["open"], [["compare:f5", "MISLEADING_COMPARISON", "major", True]])


class ClosureTests(unittest.TestCase):
    def test_a_fix_applied_word_for_word_closes_with_no_second_reading(self):
        # On ba4 a checker's own fixes voided its verdicts and the spine reopened for a third pass over six titles. Applied as
        # given, the fix is the change the critic read: the item closes and the critique is ready, with no packet written.
        result = run_node(ARGUED + '''
const title = 'Profit kept rising in FY26 while operating cash flow fell back';
const setTitle = (text) => (d) => { d.pages.find((p) => p.id === 'f2').title = text; };
const run = async (applied) => {
  const deck = await stage('finance');
  const one = await S.prepareStoryline(deck.specPath, deck.out);
  const packet = await packetOf(one);
  const ids = packet.pages.filter((p) => !p.kind || p.kind === 'content').map((p) => p.id);
  const filed = await answer(deck, first(packet, ids, [], { argument: holds(packet, { 'title:f2': fails('title:f2', 'UNCLEAR_ARGUMENT', { title }) }) }));
  await deck.write({}, setTitle(applied));
  const next = await S.prepareStoryline(deck.specPath, deck.out);
  const store = path.join(deck.dir, '.reviews', 'finance', 'storyline-history');
  const passes = await P.readPasses(store);
  const gate = await S.storylineGate(JSON.parse(await fs.readFile(deck.specPath, 'utf8')), deck.out, { deckPath: deck.specPath });
  await clear(deck);
  return { filed: filed.status, open: filed.open, next: next.status, pass: next.pass, kinds: passes.map((p) => p.kind ?? 'critic'), gate };
};
console.log(JSON.stringify({ given: await run(title), reworded: await run('Profit kept rising in FY26 as operating cash flow fell back') }));
''')
        given, reworded = result["given"], result["reworded"]
        self.assertEqual(given["filed"], "revise")
        self.assertTrue(any(item.startswith("title:f2") for item in given["open"]), given)
        self.assertEqual(given["next"], "ready", given)                    # no verification pass for the fix applied as given
        self.assertEqual(given["kinds"], ["critic", "applied-fixes"])
        self.assertEqual(given["gate"], [])
        self.assertEqual(reworded["next"], "packet-written", reworded)     # a title reworded is a change the critic reads
        self.assertEqual(reworded["kinds"], ["critic"])


class FormTests(unittest.TestCase):
    def test_the_schema_handed_over_requires_every_field_validation_requires(self):
        # The ba4 critic took three attempts: `provenance.model` was required by the validator and by no schema it was handed.
        # Each field of a valid answer is taken out in turn; where the loop (which stamps the prompt hash itself) then refuses
        # the answer, the schema the critic was given must have required that field.
        result = run_node(ARGUED + '''
const deck = await stage('finance');
const one = await S.prepareStoryline(deck.specPath, deck.out);
const packet = await packetOf(one);
const schema = JSON.parse(await fs.readFile(path.join(one.dir, 'schema.json'), 'utf8'));
await clear(deck);
const ids = packet.pages.filter((p) => !p.kind || p.kind === 'content').map((p) => p.id);
const valid = first(packet, ids, [], { argument: holds(packet, { 'compare:f5': fails('compare:f5', 'MISLEADING_COMPARISON', { basis: { measure: 'i-peers/capital', at: 'Eastbank', note: 'not published for FY26' } }) }) });
const ctx = S.packetContext(packet);
const refused = (answer) => S.judgeCritique(S.stampProvenance(answer, packet), ctx).errors.length > 0;
const at = valid.argument.findIndex((entry) => entry.verdict === 'fails'), entry = schema.properties.argument.items;
const levels = [
  ['', (a) => a, schema.required],
  ['provenance.', (a) => a.provenance, schema.properties.provenance.required],
  ['argument[].', (a) => a.argument[at], [...entry.required, ...(entry.then?.required || [])]],
  ['fix.basis.', (a) => a.argument[at].fix.basis, entry.properties.fix.properties.basis.required],
];
const unrequired = [];
for (const [label, holder, required] of levels) for (const key of Object.keys(holder(valid))) {
  const cut = structuredClone(valid); delete holder(cut)[key];
  if (refused(cut) && !(required || []).includes(key)) unrequired.push(label + key);
}
console.log(JSON.stringify({ valid: refused(valid), unrequired, stampedHash: schema.properties.provenance.required.includes('promptHash') }));
''')
        self.assertFalse(result["valid"], result)
        self.assertEqual(result["unrequired"], [])
        self.assertFalse(result["stampedHash"])                            # the runtime stamps the hash: not the critic's to copy

    def test_a_basis_note_on_a_measure_of_one_value_says_where_it_goes(self):
        result = run_node(ARGUED + '''
const deck = await stage('finance');
const one = await S.prepareStoryline(deck.specPath, deck.out);
const prompt = await fs.readFile(path.join(one.dir, 'prompt.md'), 'utf8');
await clear(deck);
console.log(JSON.stringify({ said: prompt.includes('"value" for a measure of one value') }));
''')
        self.assertTrue(result["said"])


class SplitTests(unittest.TestCase):
    def test_a_split_argument_reading_is_read_by_section_and_joined_whole(self):
        # One ba4 reader of 178 items in a 73K-token prompt took 20 minutes and missed defects its records showed. Split, each
        # section's critic reads its own pages' items beside the spine critic, and the join still refuses an item left out.
        result = run_node(ARGUED + '''
const deck = await stage('finance');
const one = await S.prepareStoryline(deck.specPath, deck.out, { split: true });
const packet = await packetOf(one);
const ids = packet.pages.filter((p) => !p.kind || p.kind === 'content').map((p) => p.id);
const staged = await fs.readdir(path.join(one.dir, 'sections'));
const spinePrompt = await fs.readFile(path.join(one.dir, 'sections', 'spine.md'), 'utf8');
const { pass: _p, verifies: _v, argument: _a, ...spine } = first(packet, ids, []);
const save = (id, body) => fs.writeFile(path.join(one.dir, 'parts', `${id}.json`), JSON.stringify(body));
const prov = { backend: 'subagent', model: 'fixture' };
await save('spine', { ...spine, part: { kind: 'spine', id: 'spine', pages: ids } });
const reading = (part, drop = null) => ({ part: { kind: 'argument', id: part.id, pages: part.pages }, binding: packet.binding, provenance: prov,
  argument: packet.argument.items.filter((item) => part.pages.includes(item.page) && item.id !== drop).map((item) => ({ item: item.id, verdict: 'holds' })) });
for (const part of packet.argumentParts) await save(part.id, reading(part, 'compare:f5'));
const short = await S.mergeStorylineDirectory(deck.specPath, deck.out);
for (const part of packet.argumentParts) await save(part.id, reading(part));
const whole = await S.mergeStorylineDirectory(deck.specPath, deck.out);
await clear(deck);
console.log(JSON.stringify({ parts: packet.argumentParts.map((p) => p.id), staged, spineHasNone: !spinePrompt.includes('THE ARGUMENT READING. This is'),
  short: short.status, said: (short.errors || []).some((e) => e.includes('compare:f5')), whole: whole.status }));
''')
        self.assertTrue(result["parts"], result)
        self.assertIn("spine.md", result["staged"])
        self.assertTrue(all(f"{p}.md" in result["staged"] for p in result["parts"]), result)
        self.assertTrue(result["spineHasNone"], result)                    # the spine critic keeps the deck-level work only
        self.assertEqual(result["short"], "invalid")
        self.assertTrue(result["said"], result)
        self.assertEqual(result["whole"], "ready", result)


if __name__ == "__main__":
    unittest.main()
