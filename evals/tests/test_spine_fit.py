"""What the storyline critique binds is proven layable before the critique.

A real run wrote section titles of ten words. `--limits` said a section title
holds ten, three drafts and three critique passes went by, and the first full
compile then refused four dividers: under the deck's design a numbered divider
keeps 58% of the width. The critique is bound to section titles, so shortening
them needed a pass beyond the cap and the deck could not be delivered.

So a draft and a plan compose everything the critique binds whose fit does not
wait on unwritten content - the dividers, the contents page, the tracker, each
page's title band, and the cover - under the deck's own settings, and refuse
what does not fit with the room it has. These tests hold the property that
follows: a spine that passes its draft meets no later composition refusal
whose repair is to change a title.

They also hold what a spine of `basis` stubs is read as - the exhibits it
declares, never exhibits that plot nothing - so that `--plan` and `--draft`
both reach exit 0 on it, and that a page's bound record is the same in a draft
as in a full compile for every form in the catalogue.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, RUNTIME, run_node

FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"

# A spine of the finance fixture: its pages with their spine keys alone, each exhibit and metric kept as a `basis` stub.
SPINE = '''
import fs from 'node:fs';
import { authorDeck, compileDeck, readInsights, planOf } from './skills/professional-slides/runtime/author-deck.mjs';
import { composeAll } from './skills/professional-slides/runtime/compose-all.mjs';
import { allocateStructure } from './skills/professional-slides/runtime/deck-structure.mjs';
import { spineFitFindings, sectionTitleRoom } from './skills/professional-slides/runtime/spine-fit.mjs';
const dir = './evals/quality/fixtures/evidence';
const doc = () => JSON.parse(fs.readFileSync(dir + '/finance.pages.json', 'utf8'));
const insights = await readInsights(dir, 'finance', { alternatives: doc().deck.players });
const KEYS = ['id', 'kind', 'type', 'form', 'commentary', 'takeaway', 'why', 'title', 'settles', 'evidence', 'adds'];
const refs = (item) => [...(Array.isArray(item?.series) ? item.series.flatMap((s) => [].concat(s?.measure ?? [])) : []), ...(item?.measure !== undefined ? [item.measure] : [])].map((ref) => String(ref).split('@')[0]);
const stub = (item) => (item?.basis ? { basis: item.basis } : refs(item).length ? { basis: { measures: [...new Set(refs(item))], role: item.role ?? 'proof' } } : {});
const spine = ({ stubs = true } = {}) => { const d = doc(); d.pages = d.pages.map((page) => (page.type ? { ...Object.fromEntries(KEYS.filter((k) => page[k] !== undefined).map((k) => [k, page[k]])),
  ...(stubs && page.exhibit ? { exhibit: stub(page.exhibit) } : {}), ...(stubs && page.exhibits ? { exhibits: page.exhibits.map(stub) } : {}), ...(stubs && page.metrics ? { metrics: page.metrics.map(stub) } : {}) } : page)); return d; };
// The same spine under sections: three pillars, each with a title of `words` words.
const WORDS = 'liquidity cover narrows while lending grows faster than the deposits that fund it across every branch region'.split(' ');
const titled = (n, lead) => [lead, ...WORDS].slice(0, n).join(' ');
// A spine long enough for the deck's structure rules to apply: the fixture's pages four times over, behind a page that introduces the players.
const longSpine = (stubs) => { const d = spine({ stubs }); const pages = d.pages; d.pages = [];
  for (let round = 0; round < 4; round += 1) for (const page of pages) d.pages.push(round ? { ...page, id: `${page.id}r${round}` } : page);
  d.pages.splice(1, 0, { id: 'pp', type: 'profiles', form: 'logo-table', commentary: 'in-exhibit', title: 'Eight lenders compete for the same regional deposits and borrowers', why: 'The players are introduced before they are compared',
    evidence: ['A-peers'], settles: { kind: 'comparison', what: 'the eight lenders', measures: ['A-peers/margin'] }, ...(stubs ? { exhibit: { basis: { measures: ['A-peers/margin'] } } } : {}) });
  return d; };
const sectioned = (titles, deck = {}) => { const d = spine(); const pages = d.pages; d.deck = { ...d.deck, ...deck };
  d.pages = [pages[0], { id: 's1', kind: 'section', title: titles[0] }, pages[1], pages[2], { id: 's2', kind: 'section', title: titles[1] }, pages[3], pages[4], { id: 's3', kind: 'section', title: titles[2] }, pages[5], pages[6]]; return d; };
'''


class SpineFitTests(unittest.TestCase):
    def test_a_section_title_that_does_not_fit_its_divider_is_refused_in_a_draft_with_its_room(self):
        result = run_node(SPINE + '''
const long = sectioned([titled(4, 'Growth:'), titled(16, 'Funding:'), titled(4, 'Cover:')]);
const draft = await authorDeck(long, { baseDir: dir, insights, draft: true });
const unfit = draft.blocking.filter((f) => f.code === 'SPINE_UNFIT');
const room = unfit[0]?.measured;
// The title cut to the room the finding gives fits, and a word more does not.
const cut = (n) => sectioned([titled(4, 'Growth:'), titled(n, 'Funding:'), titled(4, 'Cover:')]);
const at = async (n) => (await authorDeck(cut(n), { baseDir: dir, insights, draft: true })).blocking.filter((f) => f.code === 'SPINE_UNFIT').length;
console.log(JSON.stringify({ unfit: unfit.map((f) => [f.id, f.class, f.severity]), room, repair: unfit[0]?.repair, composing: draft.blocking.concat(draft.advisories).filter((f) => f.code === 'PAGE_DOES_NOT_COMPOSE' && f.id === 's2').length,
  fits: room ? [await at(room.fits.words), await at(room.fits.words + 1)] : null }));
''')
        self.assertEqual(result["unfit"], [["s2", "P", "blocker"]])
        room = result["room"]
        self.assertEqual(room["title"]["words"], 16)
        self.assertGreater(room["fits"]["words"], 0)
        self.assertLess(room["fits"]["words"], 16)
        self.assertGreater(room["fits"]["characters"], 0)
        # The message says the room, in words and characters, and why it matters now.
        self.assertIn(f"its first {room['fits']['words']} words ({room['fits']['characters']} characters) fit", result["repair"])
        self.assertIn("storyline critique is bound to it", result["repair"])
        # Reported once, by the finding that says the room: not again as a page that does not compose.
        self.assertEqual(result["composing"], 0)
        self.assertEqual(result["fits"], [0, 1])

    def test_a_spine_that_passes_its_draft_meets_no_later_refusal_over_a_bound_title(self):
        # The property, over the designs, the trackers and a range of title lengths: where the draft holds nothing against
        # the titles, the dividers, the contents page and every title band compose in the deck as the build composes it.
        result = run_node(SPINE + '''
import { DESIGN_NAMES } from './skills/professional-slides/runtime/design-systems.mjs';
const cases = [];
for (const [at, design] of DESIGN_NAMES.entries()) for (const tracker of [undefined, 'pills', 'label', 'number-strip', 'repeat-contents']) for (const n of [4, 8, 10, 12, 14]) {
  const variation = ['a1', 'b7'][(at + n) % 2];
  const d = sectioned([titled(n, 'Growth:'), titled(n, 'Funding:'), titled(n, 'Cover:')], { design, variation, ...(tracker ? { tracker } : {}) });
  const { spec } = compileDeck(d, { insights, draft: true, partial: true });
  const unfit = spineFitFindings(spec, dir);
  // The same deck laid out: the fixture's own pages under these sections, composed whole.
  const laid = doc(); const body = laid.pages; laid.deck = d.deck;
  laid.pages = d.pages.map((page) => (page.kind ? page : body.find((p) => p.id === page.id)));
  const full = compileDeck(laid, { insights, partial: true });
  let errors = [];
  try { errors = composeAll(structuredClone(full.spec), dir, { partial: true }).pageErrors ?? []; } catch (error) { errors = error.pageErrors ?? [error.message]; }
  const titleErrors = errors.filter((message) => /section title|section labels|Agenda items|tracker/i.test(message));
  cases.push({ design, tracker: tracker ?? null, n, variation, draftRefuses: unfit.length > 0, laterRefuses: titleErrors.length > 0, compileErrors: full.compileErrors.length });
}
const broken = cases.filter((c) => !c.draftRefuses && c.laterRefuses);
console.log(JSON.stringify({ cases: cases.length, refused: cases.filter((c) => c.draftRefuses).length, passed: cases.filter((c) => !c.draftRefuses).length, later: cases.filter((c) => c.laterRefuses).length,
  compileErrors: cases.filter((c) => c.compileErrors).length, broken }));
''')
        self.assertEqual(result["compileErrors"], 0)
        self.assertGreater(result["refused"], 10)   # the long titles are refused somewhere
        self.assertGreater(result["passed"], 10)    # and the short ones pass
        self.assertGreater(result["later"], 0)      # the full composition does refuse long titles
        self.assertEqual(result["broken"], [])

    def test_the_tracker_and_the_cover_are_composed_too_and_a_refusal_no_title_lifts_is_left_alone(self):
        result = run_node(SPINE + '''
const draft = async (d) => { const run = await authorDeck(d, { baseDir: dir, insights, draft: true });
  return { unfit: run.blocking.filter((f) => f.code === 'SPINE_UNFIT').map((f) => [f.id, f.measured, f.repair]), composing: run.advisories.filter((f) => f.code === 'PAGE_DOES_NOT_COMPOSE').length }; };
const long = ['Growth in lending outpaces the deposits behind it', 'Funding the growth from deposits costs more each year', 'Cover narrows every year against the floor'];
const cover = (d, title, subtitle) => { d.deck.cover = { title, subtitle }; return d; };
console.log(JSON.stringify({ pills: await draft(sectioned(long, { tracker: 'pills' })), label: await draft(sectioned(long, { tracker: 'label' })),
  // A setting the deck names wrongly is no title's doing: it stays the composition's to report.
  wrong: await draft(sectioned(['Growth', 'Funding', 'Cover'], { tracker: 'dots' })),
  cover: await draft(cover(sectioned(['Growth', 'Funding', 'Cover']), Array.from({ length: 40 }, (_, i) => WORDS[i % WORDS.length]).join(' '), 'Board paper')),
  subtitle: await draft(cover(sectioned(['Growth', 'Funding', 'Cover']), 'Harbour', Array.from({ length: 60 }, (_, i) => WORDS[i % WORDS.length]).join(' '))) }));
''')
        # Section titles too long to set as pills: one finding, with the words each title may run to and the sections over it.
        self.assertEqual(len(result["pills"]["unfit"]), 1)
        page, measured, repair = result["pills"]["unfit"][0]
        self.assertGreater(measured["sectionTitleWords"]["max"], 0)
        self.assertEqual(measured["over"], ["s1", "s2", "s3"])
        self.assertIn("Pill tracker labels must fit one line", repair)
        self.assertIn(f"no section title runs past {measured['sectionTitleWords']['max']} words", repair)
        self.assertEqual(result["label"]["unfit"], [])           # the same titles under a tracker that holds them
        self.assertEqual(result["wrong"]["unfit"], [])
        self.assertGreater(result["wrong"]["composing"], 0)
        self.assertEqual([f[0] for f in result["cover"]["unfit"]], ["cover"])
        self.assertGreater(result["cover"]["unfit"][0][1]["fits"]["words"], 0)
        self.assertEqual([f[0] for f in result["subtitle"]["unfit"]], ["cover"])
        self.assertIn("the subtitle is what runs long", result["subtitle"]["unfit"][0][2])

    def test_a_page_title_that_runs_past_its_lines_is_refused_in_a_draft(self):
        result = run_node(SPINE + '''
const d = spine();
const long = 'Operating cash flow fell by a fifth while profit after tax rose for a fifth consecutive financial year';
d.pages.find((p) => p.id === 'f2').title = long.split(' ').slice(0, 12).join(' ') ;
const fine = (await authorDeck(d, { baseDir: dir, insights, draft: true })).blocking.filter((f) => f.code === 'SPINE_UNFIT');
// Twelve long words: within the title's word limit, and past its two lines in the title band.
d.pages.find((p) => p.id === 'f2').title = 'Extraordinarily disproportionate counterproductive misunderstandings notwithstanding, institutional interdependencies overwhelmingly characterise telecommunications infrastructure internationally';
const run = await authorDeck(d, { baseDir: dir, insights, draft: true });
const unfit = run.blocking.filter((f) => f.code === 'SPINE_UNFIT');
console.log(JSON.stringify({ fine: fine.length, unfit: unfit.map((f) => [f.id, f.measured.lines, f.measured.linesMax, f.measured.fits.words]), repair: unfit[0]?.repair ?? null }));
''')
        self.assertEqual(result["fine"], 0)
        self.assertEqual(len(result["unfit"]), 1)
        page, lines, most, fits = result["unfit"][0]
        self.assertEqual([page, most], ["f2", 2])
        self.assertGreater(lines, 2)
        self.assertGreater(fits, 0)
        self.assertIn("TITLE_LINES", result["repair"])

    def test_the_published_section_title_limit_is_the_one_the_deck_s_dividers_hold(self):
        result = run_node(SPINE + '''
import { deckLimits } from './skills/professional-slides/runtime/limits.mjs';
const prose = 'the operator added capacity on the busiest routes before demand returned in full'.split(' ');
const proseOf = (n) => Array.from({ length: n }, (_, i) => prose[i % prose.length]).join(' ');
const out = [];
for (const design of ['consulting', 'editorial']) for (const variation of ['a1', 'c3']) {
  const d = sectioned(['One', 'Two', 'Three'], { design, variation });
  const { spec } = compileDeck(d, { insights, draft: true, partial: true });
  const room = sectionTitleRoom(spec, dir);
  const fits = (n) => spineFitFindings(compileDeck(sectioned([proseOf(n), 'Two', 'Three'], { design, variation }), { insights, draft: true, partial: true }).spec, dir).filter((f) => f.id === 's1').length === 0;
  out.push({ design, variation, room, at: fits(room.words), past: fits(room.words + 1) });
}
console.log(JSON.stringify({ out, generic: deckLimits().sectionTitle, deck: deckLimits({ sectionTitle: out[0].room }).sectionTitle }));
''')
        for case in result["out"]:
            self.assertTrue(case["at"], case)
            self.assertFalse(case["past"], case)
            self.assertGreater(case["room"]["characters"], case["room"]["words"])
        self.assertEqual(result["deck"]["words"]["max"], result["out"][0]["room"]["words"])
        self.assertEqual(result["deck"]["characters"]["max"], result["out"][0]["room"]["characters"])
        self.assertIn("SPINE_UNFIT", result["deck"]["codes"])
        self.assertNotIn("characters", result["generic"])   # the house default is said to be that
        self.assertIn("name the pages file", result["generic"]["note"])


class SpineCliTests(unittest.TestCase):
    """`--draft`, `--plan` and `--limits` on a pages file, as an author runs them."""

    def write(self, expression):
        tmp = Path(tempfile.mkdtemp(prefix="spine-fit-"))
        self.addCleanup(shutil.rmtree, tmp, True)
        for name in ("finance.insights.json", "finance.analysis.json"):
            shutil.copy(FIXTURES / name, tmp / name)
        (tmp / "finance.pages.json").write_text(json.dumps(run_node(SPINE + f"console.log(JSON.stringify({expression}));")))
        return tmp / "finance.pages.json"

    def run_cli(self, pages, *flags):
        return subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(pages), *flags], capture_output=True, text=True)

    def test_a_stubbed_spine_reaches_exit_0_of_both_plan_and_draft(self):
        pages = self.write("spine()")
        plan, draft = self.run_cli(pages, "--plan"), self.run_cli(pages, "--draft")
        self.assertEqual(plan.returncode, 0, plan.stderr[-2000:])
        self.assertEqual(draft.returncode, 0, draft.stderr[-2000:])

    def test_the_plan_of_a_long_stubbed_spine_is_not_refused_for_exhibits_it_has_not_drawn(self):
        # On a spine long enough for the rules to apply, basis-only stubs made the plan exit 2: "the median chart page
        # plots 0", and players unmarked on a profiles page that was only a stub.
        # (The fixture four times over repeats its page types, which is the one rule this spine does break.)
        plan = self.run_cli(self.write("longSpine(true)"), "--plan")
        printed = json.loads(plan.stdout)["plan"]
        self.assertEqual([item["code"] for item in printed["unsatisfied"]], ["VARIETY_TYPE_SHARE"], plan.stderr[-2500:])
        self.assertNotIn("values the median chart page plots 0", plan.stderr)
        self.assertNotIn("PLAYERS_UNMARKED: compared players with no logo on the cover or the first 3 pages 8", plan.stderr)

    def test_a_long_section_title_is_refused_by_the_draft_and_the_plan_and_the_limit_is_the_decks(self):
        pages = self.write("sectioned([titled(4, 'Growth:'), titled(16, 'Funding:'), titled(4, 'Cover:')], { variation: 'a1' })")
        draft, plan = self.run_cli(pages, "--draft"), self.run_cli(pages, "--plan")
        self.assertEqual(draft.returncode, 2, draft.stderr[-1500:])
        self.assertIn("SPINE_UNFIT [s2]", draft.stderr)
        self.assertEqual(plan.returncode, 2, plan.stderr[-1500:])
        self.assertEqual([item["id"] for item in json.loads(plan.stdout)["unfit"]], ["s2"])
        self.assertIn("SPINE_UNFIT", plan.stderr)
        limits = json.loads(self.run_cli(pages, "--limits").stdout)["sectionTitle"]
        self.assertTrue(limits["words"]["measured"])
        self.assertIn("characters", limits)
        room = json.loads(plan.stdout)["unfit"][0]["measured"]["fits"]
        # What the limit prints is of the same order as the room the refusal gives: both are the deck's divider.
        self.assertLessEqual(abs(limits["characters"]["max"] - room["characters"]), 25)


class StubbedSpineTests(unittest.TestCase):
    """A `basis` stub is a declaration: read as the exhibit it declares, never as one that plots nothing."""

    def test_a_stub_is_read_as_the_exhibit_it_declares(self):
        result = run_node(SPINE + '''
import { declaredSlide } from './skills/professional-slides/runtime/page-types.mjs';
import { stubsOf, evidenceExhibits } from './skills/professional-slides/runtime/deck-structure.mjs';
const page = (id) => spine().pages.find((p) => p.id === id);
const stand = (p) => declaredSlide(p, 0, { exhibitType: evidenceExhibits(p, insights), players: doc().deck.players, stubs: stubsOf(p, insights) });
const f1 = stand(page('f1')), f4 = stand(page('f4'));
// A stub that names no recorded measure says nothing of how much it plots; one that states a window plots that window.
const unnamed = stand({ ...page('f1'), exhibit: { basis: { measures: ['i-nowhere/x'] } } });
const windowed = stand({ ...page('f1'), exhibit: { basis: { measures: ['i-loans/loans'], labels: { from: 'FY24' } } } });
const tabled = stand({ ...page('f4'), exhibits: [{ basis: { measures: ['i-efficiency/cost-income'], as: 'table' } }, { basis: { measures: ['i-efficiency/branches'] } }] });
const profile = stand({ id: 'pp', type: 'profiles', form: 'logo-table', commentary: 'in-exhibit', title: 'Eight lenders', why: 'w', exhibit: { basis: { measures: ['A-peers/margin'] } } });
console.log(JSON.stringify({ f1: [f1.exhibit.type, f1.pageType.values, f1.pageType.chart ?? false], f4: [f4.exhibits.map((ex) => ex.type), f4.pageType.values],
  unnamed: 'values' in unnamed.pageType, windowed: windowed.pageType.values, tabled: tabled.exhibits.map((ex) => ex.type), profile: (profile.exhibit.items || []).length, players: doc().deck.players.length }));
''')
        self.assertEqual(result["f1"], ["chart.line", 8, True])          # the eight loan-book values its measure holds
        self.assertEqual(result["f4"][0], ["chart.line", "chart.line"])
        self.assertEqual(result["f4"][1], 16)
        self.assertFalse(result["unnamed"])                               # unread, not zero
        self.assertEqual(result["windowed"], 3)                           # FY24, FY25, FY26
        self.assertEqual(result["tabled"], ["table", "chart.line"])
        self.assertEqual(result["profile"], result["players"])            # a stubbed profiles page still introduces the players

    def test_the_plan_and_the_draft_read_a_stubbed_spine_as_they_read_a_bare_one(self):
        # The run's own failure: on a deck long enough for the rules to apply, basis-only stubs gave "the median chart
        # page plots 0", unmarked players and too few pages of two exhibits - and the same spine without stubs passed.
        result = run_node(SPINE + '''
const read = (d) => { const plan = allocateStructure(d, { insights, planOf });
  const standing = (code) => plan.declared.standings.find((st) => st.code === code);
  return { depth: standing('EVIDENCE_DEPTH').value, each: Object.values(standing('EVIDENCE_DEPTH').each ?? {}), panels: standing('VARIETY_PANELS').count, players: standing('PLAYERS_UNMARKED')?.value ?? null,
    unsatisfied: plan.unsatisfied.map((u) => u.code).filter((code) => ['EVIDENCE_DEPTH', 'PLAYERS_UNMARKED', 'VARIETY_PANELS'].includes(code)) }; };
const stubbed = read(longSpine(true)), bare = read(longSpine(false));
const draft = await authorDeck(longSpine(true), { baseDir: dir, insights, draft: true });
const line = (code) => draft.standings.find((st) => st.code === code);
console.log(JSON.stringify({ stubbed, bare, draft: { depth: line('EVIDENCE_DEPTH').value, panels: line('VARIETY_PANELS').count, players: line('PLAYERS_UNMARKED').value, // The four rounds repeat the fixture's titles, which is the one thing a draft holds against this spine.
  blocking: draft.blocking.map((f) => f.code).filter((code) => code !== 'CONTENT_CLAIM_REPEATS') } }));
''')
        stubbed, bare, draft = result["stubbed"], result["bare"], result["draft"]
        self.assertGreater(stubbed["depth"], 0)
        self.assertTrue(stubbed["each"])
        self.assertTrue(all(values > 0 for values in stubbed["each"]), stubbed["each"])
        self.assertEqual(stubbed["panels"], bare["panels"])
        self.assertEqual(stubbed["players"], 0)
        self.assertEqual(stubbed["unsatisfied"], [])
        # A draft reads the undrawn pages the same way, so its standings are the plan's.
        self.assertEqual([draft["depth"], draft["panels"], draft["players"]], [stubbed["depth"], stubbed["panels"], 0])
        # What a draft holds against this spine is what the plan holds against it: the page types the four rounds repeat,
        # which no form or placement mends and the storyline critique is bound to. (It was left to the full compile.)
        self.assertEqual(draft["blocking"], ["VARIETY_TYPE_SHARE"])


    def test_a_page_that_does_not_compile_stands_in_with_what_its_bound_exhibit_will_plot(self):
        # A page refused for its copy, its exhibit bound to its measures: stood in for as the binding wrote it, it plots the
        # measures' values. Read as written - series that name measures and carry no numbers - it counted as a chart page
        # plotting nothing, which dragged the deck's median down and raised a second finding the page did not earn.
        result = run_node(SPINE + '''
// The fixture's pages four times over, so the deck is long enough for the depth rule to be read.
const longDeck = () => { const d = doc(); const pages = d.pages; d.pages = []; for (let round = 0; round < 4; round += 1) for (const page of pages) d.pages.push(round ? { ...page, id: `${page.id}r${round}` } : page); return d; };
const d = longDeck(); delete d.pages.find((p) => p.id === 'f3').why;
const run = await authorDeck(d, { baseDir: dir, insights, fit: false });
const depth = run.standings.find((st) => st.code === 'EVIDENCE_DEPTH');
const whole = (await authorDeck(longDeck(), { baseDir: dir, insights, fit: false })).standings.find((st) => st.code === 'EVIDENCE_DEPTH');
console.log(JSON.stringify({ blocking: run.blocking.filter((f) => f.id === 'f3').map((f) => f.code), each: depth.each?.f3 ?? null, whole: whole.each?.f3 ?? null, value: [depth.value, whole.value] }));
''')
        self.assertEqual(result["blocking"], ["COMPILE"])
        self.assertEqual(result["each"], 16)                 # two series of eight periods, as the compiled page plots
        self.assertEqual(result["each"], result["whole"])
        self.assertEqual(result["value"][0], result["value"][1])


class BoundRecordTests(unittest.TestCase):
    def test_every_form_has_the_same_bound_record_in_a_draft_and_in_a_full_compile(self):
        # The critique is bound to a page's kind, title, claim, type, what settles it and what it rests on. A form that
        # set the page's kind only once its copy arrived read as a changed argument at layout (a takeaways page did).
        result = run_node('''
import { compilePage, PAGE_TYPES } from './skills/professional-slides/runtime/page-types.mjs';
import { workedExamples, withoutDependencies } from './skills/professional-slides/runtime/author-deck.mjs';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
const worked = workedExamples();
const SPINE = ['id', 'kind', 'type', 'form', 'commentary', 'takeaway', 'why', 'title', 'settles', 'evidence', 'adds'];
const compile = (page, options) => { const { page: authored, dependencies } = withoutDependencies(page); const slide = compilePage(authored, 0, { players: worked.deck.players, ...options });
  if (dependencies && slide.pageType) slide.pageType.dependencies = dependencies.declared; return slide; };
const record = (slide) => S.storyStructure({ slides: [slide] })[0];
const differing = [], forms = new Set();
for (const page of worked.pages.filter((p) => p.type)) {
  forms.add(`${page.type}/${page.form}`);
  const full = record(compile(page, {}));
  const spine = Object.fromEntries(SPINE.filter((key) => page[key] !== undefined).map((key) => [key, page[key]]));
  // The page with nothing drawn, and the page as written compiled as a draft: neither may differ from the full compile,
  // but for the numbers an exhibit draws, which the spine has not drawn yet.
  for (const [name, draft] of [['spine', record(compile(spine, { draft: true, spine: true }))], ['written', record(compile(page, { draft: true, spine: true }))]]) {
    const keys = Object.keys({ ...full, ...draft }).filter((key) => !(name === 'spine' && key === 'drawn'));
    const moved = keys.filter((key) => JSON.stringify(full[key]) !== JSON.stringify(draft[key]));
    if (moved.length) differing.push([page.id, `${page.type}/${page.form}`, name, moved]);
  }
}
const catalogue = Object.entries(PAGE_TYPES).flatMap(([type, t]) => Object.keys(t.forms).map((form) => `${type}/${form}`));
console.log(JSON.stringify({ differing, walked: forms.size, missing: catalogue.filter((form) => !forms.has(form)) }));
''')
        self.assertEqual(result["missing"], [])
        self.assertGreaterEqual(result["walked"], 90)
        self.assertEqual(result["differing"], [])


if __name__ == "__main__":
    unittest.main()
