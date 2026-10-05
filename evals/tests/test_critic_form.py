"""The storyline critic's form: what it is shown to name pages by, and what the runtime settles for it.

Two real runs and a calibration lost a correction round or more to form: a
closing page named by a guessed id because the spine listing printed ids for
content pages only, a pillar's pages given as a range, a finding whose text
named pages its list left out, a `fixed` status that needed a section's id the
prompt never printed, a corrected answer the critic's tools could not write
over the refused one, and a section title proposed inside the nine words the
prompt allowed that the divider did not hold.

The listing now prints every page's id; a range is expanded and a page a spine
item's own text names is added, both recorded as the runtime's doing; a page is
never read by its position; a refused answer is moved aside so the corrected
one is a new file; the pass that verifies a repair is told which pages moved;
and a proposed section title is composed on its divider.
"""
from __future__ import annotations

import unittest

from node_probe import run_node
from test_storyline_closure import LOOP

# The finance fixture with two sections, staged as a spine and brought to its first packet.
SECTIONED = LOOP + '''
const sectioned = (d) => { const at = (id) => d.pages.findIndex((p) => p.id === id);
  d.pages.splice(at('f1'), 0, { id: 's1', kind: 'section', title: 'Growth and what paid for it' });
  d.pages.splice(at('f3'), 0, { id: 's2', kind: 'section', title: 'Liquidity under the growth' }); };
const finding = (id, pages, problem, o = {}) => ({ id, scope: 'spine', pages, check: 'answer', severity: 'major', problem, fix: 'State the condition the answer depends on in the summary and the close.', ...o });
const withFindings = (packet, ids, findings, o = {}) => first(packet, ids, [], { findings, topFixes: ['Mend the answer'],
  completeness: S.STORYLINE_DIMENSIONS.map((check) => ({ check, result: check === 'answer' && findings.length ? 'findings' : 'clean', note: check === 'answer' && findings.length ? 'Filed the items on the answer.' : `Checked ${check} across the spine and found nothing to raise.` })), ...o });
const reviewPath = (deck) => path.join(deck.out, 'storyline-review.json');
const exists = (file) => fs.access(file).then(() => true, () => false);
'''


class ListingTests(unittest.TestCase):
    def test_every_line_of_the_spine_listing_prints_its_pages_id(self):
        result = run_node(SECTIONED + '''
const deck = await stage('finance', {}, sectioned);
const one = await S.prepareStoryline(deck.specPath, deck.out);
const packet = await packetOf(one);
const prompt = await fs.readFile(path.join(one.dir, 'prompt.md'), 'utf8');
await clear(deck);
console.log(JSON.stringify({ ids: packet.pages.map((p) => [p.id, p.kind ?? 'content']), lines: packet.pages.map((p) => prompt.includes(`${p.n}. [${p.id}] `)),
  section: prompt.split('\\n').find((line) => line.includes('-- section:')), position: /as "page 12"/.test(prompt), byId: prompt.includes('Name a page by the id in brackets on its line') }));
''')
        self.assertIn(["s2", "section"], result["ids"])
        self.assertTrue(all(result["lines"]), result)                    # a divider's line carries its id as a content page's does
        self.assertRegex(result["section"], r"^\d+\. \[s1\] -- section: Growth")
        self.assertFalse(result["position"])                             # the invitation to name a page by its position is gone
        self.assertTrue(result["byId"])


class OfferedSchemaTests(unittest.TestCase):
    def test_a_critic_is_not_offered_a_key_its_packet_gives_it_nothing_to_answer_with(self):
        # A real critic of a revision twice filled `carried` - the answers to items a retired lineage left open - with the
        # slides the revision carried, because the schema it was handed offered the key on every first pass; the whole answer
        # was refused each time. The schema handed over leaves the key out where the packet carries no such item, and the
        # refusal of one written anyway says what the key is not.
        result = run_node(SECTIONED + '''
const deck = await stage('finance', {}, sectioned);
const one = await S.prepareStoryline(deck.specPath, deck.out);
const packet = await packetOf(one);
const schema = JSON.parse(await fs.readFile(path.join(one.dir, 'schema.json'), 'utf8'));
const ids = packet.pages.filter((p) => p.kind === 'content').map((p) => p.id);
const stray = await answer(deck, withFindings(packet, ids, [], { carried: [{ item: 'slide 2', stands: true, evidence: 'The slide is carried as it is and still says what it said.' }] }));
const empty = await answer(deck, withFindings(packet, ids, [], { carried: [] }));
await clear(deck);
console.log(JSON.stringify({ offered: Object.hasOwn(schema.properties, 'carried'), validated: Object.hasOwn(S.STORYLINE_SPINE_SCHEMA.properties, 'carried'), stray: [stray.status, stray.errors ?? []], empty: [empty.status, empty.errors ?? []] }));
''')
        self.assertFalse(result["offered"])
        self.assertTrue(result["validated"])                                # a lineage that does carry items is still answered in it
        self.assertEqual(result["stray"][0], "invalid")
        self.assertTrue(any("this packet carries none: leave `carried` out" in error and "what stands on one is a finding" in error for error in result["stray"][1]), result["stray"][1])
        self.assertFalse(any("carried" in error for error in result["empty"][1]), result["empty"][1])   # an empty list says nothing, and nothing is said of it


class SettledFormTests(unittest.TestCase):
    def test_a_range_is_expanded_and_a_page_the_text_names_is_added_and_both_are_recorded(self):
        result = run_node(SECTIONED + '''
const deck = await stage('finance', {}, sectioned);
const one = await S.prepareStoryline(deck.specPath, deck.out);
const p1 = await packetOf(one);
const ids = p1.pages.filter((p) => p.kind === 'content').map((p) => p.id);
// A pillar's pages as a range that runs across a divider, and a spine finding whose text names two pages its list leaves out.
const review = withFindings(p1, ids, [finding('F1', ['f0'], 'The answer rests on the loan growth shown on f1 and the cushion on f3, and neither condition is stated where the answer is.')],
  { pillars: [{ pillar: 'Growth on thinner liquidity', pages: ['f0', 'f1-f4', 'f5 to f6'], verdict: 'weak', overlap: 'One pillar; nothing overlaps.', strongestCounter: 'The cushion may rebuild.', reversal: 'Liquid assets above short-term liabilities.', answered: false }] });
const step = await answer(deck, review);
const written = JSON.parse(await fs.readFile(reviewPath(deck), 'utf8'));
const record = JSON.parse(await fs.readFile(path.join(deck.dir, '.reviews', 'finance', 'storyline-history', 'pass-1.json'), 'utf8'));
// The gate reads the critique the loop recorded, settled.
const gate = await S.storylineGate(deck.spec, deck.out, { deckPath: deck.specPath });
// A page named by its position is not read as the page at that position: nothing is added, nothing refused.
const deck2 = await stage('finance', {}, sectioned);
const two = await S.prepareStoryline(deck2.specPath, deck2.out);
const p2 = await packetOf(two);
const positional = await answer(deck2, withFindings(p2, ids, [finding('F1', ['f0', 'f6'], 'The answer is stated on the summary and again at the close, as page 3 and slides 4-5 would lead a reader to expect, without its condition.')]));
const kept = JSON.parse(await fs.readFile(reviewPath(deck2), 'utf8')).findings[0].pages;
await clear(deck); await clear(deck2);
console.log(JSON.stringify({ status: step.status, errors: step.errors ?? [], said: step.formMended ?? [], pillar: written.pillars[0].pages, finding: written.findings[0].pages,
  recorded: (record.formMended ?? []).map((m) => [m.at, m.did, m.pages.join(',')]), ledger: record.ledger.find((e) => e.id === 'F1').pages, gate: gate.filter((e) => /unknown page|leaves out/.test(e)),
  positional: [positional.status, positional.errors ?? [], kept, positional.formMended ?? null] }));
''')
        self.assertEqual(result["errors"], [])
        self.assertEqual(result["status"], "revise")
        # The range runs over the content pages between its ends; the divider between f2 and f3 is not one of the pillar's pages.
        self.assertEqual(result["pillar"], ["f0", "f1", "f2", "f3", "f4", "f5", "f6"])
        self.assertEqual(result["finding"], ["f0", "f1", "f3"])
        self.assertEqual(result["ledger"], ["f0", "f1", "f3"])
        self.assertIn(["findings[0] (F1)", "named", "f1,f3"], result["recorded"])
        self.assertIn(["pillars[0]", "range", "f1,f2,f3,f4"], result["recorded"])
        self.assertTrue(any('F1' in line and 'f1, f3 added to its pages, since its text names them' in line for line in result["said"]), result["said"])
        self.assertTrue(any('"f1-f4" read as f1, f2, f3, f4' in line for line in result["said"]), result["said"])
        self.assertEqual(result["gate"], [])
        self.assertEqual(result["positional"], ["revise", [], ["f0", "f6"], None])

    def test_a_refused_answer_is_moved_aside_so_the_corrected_one_is_a_new_file(self):
        result = run_node(SECTIONED + '''
const deck = await stage('finance', {}, sectioned);
const one = await S.prepareStoryline(deck.specPath, deck.out);
const p1 = await packetOf(one);
const ids = p1.pages.filter((p) => p.kind === 'content').map((p) => p.id);
const refused = await answer(deck, withFindings(p1, ids, [finding('F1', ['f0', 'p49'], 'The closing page restates the answer without the condition the summary gives for it.')]));
const after = [await exists(reviewPath(deck)), refused.refused ? await exists(refused.refused) : false];
// The corrected answer is written by a tool that may create a file and never overwrite one.
let created = true;
try { await fs.writeFile(reviewPath(deck), JSON.stringify(withFindings(p1, ids, [finding('F1', ['f0', 'f6'], 'The closing page restates the answer without the condition the summary gives for it.')])), { flag: 'wx' }); } catch { created = false; }
const corrected = await S.prepareStoryline(deck.specPath, deck.out);
// An answer that does not parse is moved aside too.
const deck2 = await stage('finance', {}, sectioned);
await S.prepareStoryline(deck2.specPath, deck2.out);
await fs.writeFile(reviewPath(deck2), '{ "pass": 1, ');
const broken = await S.prepareStoryline(deck2.specPath, deck2.out);
const gone = !(await exists(reviewPath(deck2)));
await clear(deck); await clear(deck2);
console.log(JSON.stringify({ refused: [refused.status, refused.errors, path.basename(refused.refused ?? ''), refused.note ?? ''], after, created, corrected: corrected.status, broken: [broken.status, path.basename(broken.refused ?? ''), gone] }));
''')
        self.assertEqual(result["refused"][0], "invalid")
        self.assertTrue(any("unknown page p49" in e for e in result["refused"][1]))
        self.assertEqual(result["refused"][2], "storyline-review.refused.json")
        self.assertIn("free to write", result["refused"][3])
        self.assertEqual(result["after"], [False, True])
        self.assertTrue(result["created"])
        self.assertEqual(result["corrected"], "revise")
        self.assertEqual(result["broken"], ["invalid", "storyline-review.refused.json", True])


class VerificationFormTests(unittest.TestCase):
    def test_the_pass_that_verifies_a_repair_names_the_pages_that_moved_a_divider_among_them(self):
        result = run_node(SECTIONED + '''
const deck = await stage('finance', {}, sectioned);
const one = await S.prepareStoryline(deck.specPath, deck.out);
const p1 = await packetOf(one);
const ids = p1.pages.filter((p) => p.kind === 'content').map((p) => p.id);
await answer(deck, withFindings(p1, ids, [finding('F1', ['f1', 'f2'], 'The section claims the growth paid for itself, which the two pages under it do not show.', { check: 'claim' })],
  { completeness: S.STORYLINE_DIMENSIONS.map((check) => ({ check, result: check === 'claim' ? 'findings' : 'clean', note: check === 'claim' ? 'Filed the item on the section claim.' : `Checked ${check} across the spine and found nothing to raise.` })) }));
// The repair is made on the section's divider: its pages stay as they were.
await deck.write({}, (d) => { sectioned(d); d.pages.find((p) => p.id === 's1').title = 'Growth, and the funding it drew on'; });
const two = await S.prepareStoryline(deck.specPath, deck.out);
const p2 = await packetOf(two);
const prompt = await fs.readFile(path.join(two.dir, 'prompt.md'), 'utf8');
const fixed = (artifact) => verification(p2, p1.binding, [status('F1', 'fixed', { severity: 'major', pages: ['f1', 'f2'], ...(artifact ? { artifact } : {}) })]);
const bare = await answer(deck, fixed(null));
const named = await answer(deck, fixed('s1'));
await clear(deck);
console.log(JSON.stringify({ changed: p2.scope.changed, moved: prompt.match(/what moved since that pass is ([^(]*)/)?.[1]?.trim(), divider: prompt.includes('[s1] -- section: Growth, and the funding it drew on  [changed]'),
  bare: [bare.status, (bare.errors ?? []).some((e) => e.includes('name it in `artifact`'))], named: named.status }));
''')
        self.assertEqual(result["changed"], ["s1"])
        self.assertEqual(result["moved"], "s1")                 # the rule that asks for an id says which ids there are
        self.assertTrue(result["divider"])                        # and the divider's line carries it
        self.assertEqual(result["bare"], ["invalid", True])
        self.assertEqual(result["named"], "ready")


class SectionTitleLimitTests(unittest.TestCase):
    def test_a_proposed_section_title_is_held_to_the_divider_not_to_a_count_of_short_words(self):
        result = run_node(SECTIONED + '''
import { sectionTitleRoom, sectionTitleFits } from './skills/professional-slides/runtime/spine-fit.mjs';
import { titleLimits, titleLimitsLine } from './skills/professional-slides/runtime/review-floors.mjs';
const deck = await stage('finance', {}, sectioned);
const one = await S.prepareStoryline(deck.specPath, deck.out);
const p1 = await packetOf(one);
const prompt = await fs.readFile(path.join(one.dir, 'prompt.md'), 'utf8');
const ids = p1.pages.filter((p) => p.kind === 'content').map((p) => p.id);
const room = sectionTitleRoom(deck.spec, deck.dir);
// A title inside the most words the divider holds, of long words: it does not fit, and the count of words did not say so.
const LONG = ['Consolidated', 'international', 'profitability', 'notwithstanding', 'extraordinary', 'restructuring', 'commitments', 'throughout', 'neighbouring', 'jurisdictions', 'represented', 'comprehensively'];
const long = LONG.slice(0, room.words).join(' '), short = 'Growth and its funding';
const propose = (title) => withFindings(p1, ids, [finding('F1', ['s1'], 'The section title claims more than the two pages under it show of the growth.', { check: 'claim', fix: `Retitle the section "${title}" so it claims only what its pages show.` })],
  { completeness: S.STORYLINE_DIMENSIONS.map((check) => ({ check, result: check === 'claim' ? 'findings' : 'clean', note: check === 'claim' ? 'Filed the item on the section claim.' : `Checked ${check} across the spine and found nothing to raise.` })) });
const unfit = await answer(deck, propose(long));
const fit = await answer(deck, propose(short));
await clear(deck);
console.log(JSON.stringify({ room, limits: p1.limits.sectionTitle, line: titleLimitsLine(p1.limits), inPrompt: prompt.includes(titleLimitsLine(p1.limits)), fits: [sectionTitleFits(deck.spec, deck.dir, long, ['s1']), sectionTitleFits(deck.spec, deck.dir, short, ['s1'])],
  words: long.split(' ').length, unfit: [unfit.status, (unfit.errors ?? []).filter((e) => e.includes('does not fit its divider'))], fit: fit.status }));
''')
        room = result["room"]
        self.assertLess(room["title"]["words"], room["words"])           # long words fill the divider in fewer words than prose does
        self.assertEqual(result["limits"]["sure"], room["title"]["words"])
        self.assertEqual(result["limits"]["words"], room["words"])
        self.assertIn(f"fits this deck's dividers at {room['title']['words']} words or fewer, never past {room['words']}", result["line"])
        self.assertTrue(result["inPrompt"])
        self.assertEqual(result["fits"], [False, True])
        self.assertLessEqual(result["words"], room["words"])             # inside the limit the prompt used to state
        self.assertEqual(result["unfit"][0], "invalid")
        self.assertEqual(len(result["unfit"][1]), 1)
        self.assertIn("SPINE_UNFIT", result["unfit"][1][0])
        self.assertEqual(result["fit"], "revise")


class RevisionFormTests(unittest.TestCase):
    def test_a_revisions_critique_is_settled_the_same_way_over_the_pages_it_carries(self):
        # A revision's spine holds the user's carried slides beside the pages the runtime composes: a range runs over both,
        # and a page the text names is added whether it is carried or composed.
        result = run_node('''
import { settleCritiqueForm } from './skills/professional-slides/runtime/storyline.mjs';
import { settlePageList, pageRefs } from './skills/professional-slides/runtime/review-passes.mjs';
const ids = ['s01', 's02', 'sec-1', 's03', 'mix', 's04'], content = ['s01', 's02', 's03', 'mix', 's04'];
const review = { findings: [{ id: 'F1', scope: 'spine', pages: ['mix'], problem: 'The new page restates what s03 already says of the channels.', fix: 'Cut the restatement from mix or from s04.' },
  { id: 'F2', scope: 'page', pages: ['mix'], problem: 'This page finding names s01 in passing and stays on its one page.', fix: 'Leave it.' }],
  cutOrMerge: [{ id: 'C1', pages: ['s02-s03'], action: 'merge', freedUse: 'The room goes to `mix`.', severity: 'minor' }], pillars: [{ pages: ['s01 to mix'] }] };
const { review: settled, mended } = settleCritiqueForm(review, ids, content);
console.log(JSON.stringify({ f1: settled.findings[0].pages, f2: settled.findings[1].pages, cut: settled.cutOrMerge[0].pages, pillar: settled.pillars[0].pages, mended: mended.map((m) => [m.at, m.did]),
  untouched: JSON.stringify(review.findings[0].pages), hyphenated: settlePageList(['sec-1'], ids).mended.length, positions: [[...pageRefs('page 2 and s04', ids)], [...pageRefs('page 2 and s04', ids, { positions: false })]] }));
''')
        self.assertEqual(result["f1"], ["s03", "mix", "s04"])
        self.assertEqual(result["f2"], ["mix"])                              # a page finding stays on its page
        # The divider between them is not merged; the page the text names is - an id that is also a word, where it is written as an id.
        self.assertEqual(result["cut"], ["s02", "s03", "mix"])
        self.assertEqual(result["pillar"], ["s01", "s02", "s03", "mix"])
        self.assertEqual(result["mended"], [["findings[0] (F1)", "named"], ["cutOrMerge[0] (C1)", "range"], ["cutOrMerge[0] (C1)", "named"], ["pillars[0]", "range"]])
        self.assertEqual(result["untouched"], '["mix"]')                     # the critic's own answer is not edited in place
        self.assertEqual(result["hyphenated"], 0)                            # an id with a hyphen of its own is an id
        self.assertEqual(result["positions"], [["s04", "s02"], ["s04"]])


if __name__ == "__main__":
    unittest.main()
