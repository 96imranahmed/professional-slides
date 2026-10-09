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
// A stub says what its exhibit will show where a page of its type cannot show the whole measure plotted, which is how an undeclared
// measure is read: the summary's table shows two years of each measure and one lender's margin (a draft refuses the stub that leaves it unsaid).
const VIEWS = { f0: { as: 'table', labels: { from: 'FY25', to: 'FY26' }, members: ['Harbour'] } };
const viewed = (id, kept) => (VIEWS[id] && kept.basis ? { basis: { ...kept.basis, ...VIEWS[id] } } : kept);
const spine = ({ stubs = true } = {}) => { const d = doc(); d.pages = d.pages.map((page) => (page.type ? { ...Object.fromEntries(KEYS.filter((k) => page[k] !== undefined).map((k) => [k, page[k]])),
  ...(stubs && page.exhibit ? { exhibit: viewed(page.id.replace(/r\\d+$/, ''), stub(page.exhibit)) } : {}), ...(stubs && page.exhibits ? { exhibits: page.exhibits.map(stub) } : {}), ...(stubs && page.metrics ? { metrics: page.metrics.map(stub) } : {}) } : page)); return d; };
// The same spine under sections: three pillars, each with a title of `words` words.
const WORDS = 'liquidity cover narrows while lending grows faster than the deposits that fund it across every branch region'.split(' ');
const titled = (n, lead) => [lead, ...WORDS].slice(0, n).join(' ');
// A spine long enough for the deck's structure rules to apply: the fixture's pages four times over, behind a page that introduces the players.
const longSpine = (stubs) => { const d = spine({ stubs }); const pages = d.pages; d.pages = [];
  for (let round = 0; round < 4; round += 1) for (const page of pages) d.pages.push(round ? { ...page, id: `${page.id}r${round}` } : page);
  d.pages.splice(1, 0, { id: 'pp', type: 'profiles', form: 'logo-table', commentary: 'in-exhibit', title: 'Eight lenders compete for the same regional deposits and borrowers', why: 'The players are introduced before they are compared',
    evidence: ['A-peers'], settles: { kind: 'comparison', what: 'the eight lenders', measures: ['A-peers/margin'] }, ...(stubs ? { exhibit: { basis: { measures: ['A-peers/margin'], as: 'table' } } } : {}) });
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
        # Six and eight words straddle what the dividers hold (some designs and trackers take each, some refuse it) and
        # twelve is past it everywhere; a shorter title passes everywhere and nothing refuses it later, so it proves nothing more.
        result = run_node(SPINE + '''
import { DESIGN_NAMES } from './skills/professional-slides/runtime/design-systems.mjs';
const cases = [];
for (const [at, design] of DESIGN_NAMES.entries()) for (const tracker of [undefined, 'pills', 'label', 'number-strip', 'repeat-contents']) for (const n of [6, 8, 12]) {
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
// The draft's own reading of the titles (spine-fit.mjs, on the draft's compile); a whole draft where the composition's report is read too.
const fit = (d) => ({ unfit: spineFitFindings(compileDeck(d, { insights, draft: true, partial: true }).spec, dir).map((f) => [f.id, f.measured, f.repair]) });
const draft = async (d) => { const run = await authorDeck(d, { baseDir: dir, insights, draft: true });
  return { unfit: run.blocking.filter((f) => f.code === 'SPINE_UNFIT').map((f) => [f.id, f.measured, f.repair]), composing: run.advisories.filter((f) => f.code === 'PAGE_DOES_NOT_COMPOSE').length }; };
const long = ['Growth in lending outpaces the deposits behind it', 'Funding the growth from deposits costs more each year', 'Cover narrows every year against the floor'];
const cover = (d, title, subtitle) => { d.deck.cover = { title, subtitle }; return d; };
console.log(JSON.stringify({ pills: fit(sectioned(long, { tracker: 'pills' })), label: fit(sectioned(long, { tracker: 'label' })),
  // A setting the deck names wrongly is no title's doing: it stays the composition's to report.
  wrong: await draft(sectioned(['Growth', 'Funding', 'Cover'], { tracker: 'dots' })),
  cover: fit(cover(sectioned(['Growth', 'Funding', 'Cover']), Array.from({ length: 40 }, (_, i) => WORDS[i % WORDS.length]).join(' '), 'Board paper')),
  subtitle: fit(cover(sectioned(['Growth', 'Funding', 'Cover']), 'Harbour', Array.from({ length: 60 }, (_, i) => WORDS[i % WORDS.length]).join(' '))) }));
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

    def test_a_divider_that_plans_a_photograph_is_measured_with_one(self):
        """A hundred-page deck's section titles fitted its dividers in the draft and were refused once the photographs
        were fetched: a divider with a photograph keeps its title in a panel of 42% of the page."""
        result = run_node(SPINE + '''
const withPhotos = (d) => { for (const page of d.pages) if (page.kind === 'section') page.image = { alt: 'a regional branch', search: 'credit union branch' }; return d; };
const room = (photos) => { const d = sectioned(['One', 'Two', 'Three']); const { spec } = compileDeck(photos ? withPhotos(d) : d, { insights, draft: true, partial: true }); return sectionTitleRoom(spec, dir); };
const bare = room(false), pictured = room(true);
const prose = 'the operator added capacity on the busiest routes before demand returned in full'.split(' ');
const proseOf = (n) => Array.from({ length: n }, (_, i) => prose[i % prose.length]).join(' ');
const fits = (n, photos) => { const d = sectioned([proseOf(n), 'Two', 'Three']); return spineFitFindings(compileDeck(photos ? withPhotos(d) : d, { insights, draft: true, partial: true }).spec, dir).filter((f) => f.id === 's1').length === 0; };
console.log(JSON.stringify({ bare, pictured, between: [fits(bare.words, false), fits(bare.words, true)] }));
''')
        self.assertLess(result["pictured"]["words"], result["bare"]["words"], "the photograph's panel holds fewer words")
        # A title the full-width divider holds is refused where the divider will carry its photograph.
        self.assertEqual(result["between"], [True, False])

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
import { repairOf } from './skills/professional-slides/runtime/gates/gate_classes.mjs';
const read = (d) => { const plan = allocateStructure(d, { insights, planOf });
  const standing = (code) => plan.declared.standings.find((st) => st.code === code);
  return { depth: standing('EVIDENCE_DEPTH').value, each: Object.values(standing('EVIDENCE_DEPTH').each ?? {}), panels: standing('VARIETY_PANELS').count, players: standing('PLAYERS_UNMARKED')?.value ?? null,
    unsatisfied: plan.unsatisfied.map((u) => u.code).filter((code) => ['EVIDENCE_DEPTH', 'PLAYERS_UNMARKED', 'VARIETY_PANELS'].includes(code)) }; };
const stubbed = read(longSpine(true)), bare = read(longSpine(false));
const draft = await authorDeck(longSpine(true), { baseDir: dir, insights, draft: true });
const line = (code) => draft.standings.find((st) => st.code === code), structure = (list) => list.filter((f) => f.class === 'S');
console.log(JSON.stringify({ stubbed, bare, draft: { depth: line('EVIDENCE_DEPTH').value, panels: line('VARIETY_PANELS').count, players: line('PLAYERS_UNMARKED').value, // The four rounds repeat the fixture's titles, which is the one thing a draft holds against this spine.
  // The pages of the later rounds are the first round's pages again - the same claim measures, the same views - which a draft now holds too.
  blocking: draft.blocking.map((f) => f.code).filter((code) => !['CONTENT_CLAIM_REPEATS', 'PROOF_REPEATS'].includes(code)), repeats: draft.blocking.filter((f) => f.code === 'PROOF_REPEATS').map((f) => f.rule),
  // Each structure rule the draft blocks or leaves to the full compile, with what its repair can be settled by.
  structure: structure(draft.blocking).map((f) => [f.code, repairOf(f).settledLater]), deferred: structure(draft.advisories).filter((f) => f.deferred).map((f) => [f.code, f.settledBy]) } }));
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
        # What a draft holds against this spine is what no form or placement mends, which the storyline critique is bound to: the
        # page types the four rounds repeat. The range of exhibit kinds - twenty-nine pages ask for twelve - the search over every
        # form the catalogue allows now reaches, since cards that print no figure count as text, not against the cap on pages of
        # figures (rules version 7: two pages here).
        self.assertEqual(draft["blocking"], ["VARIETY_TYPE_SHARE"])
        self.assertTrue(draft["repeats"])
        self.assertEqual(set(draft["repeats"]), {"PROOF_REPEATS.identical"})
        # A structure rule blocks in a draft only where no copy, layout or fit settles it; one a form or placement mends waits.
        self.assertIn(["VARIETY_TYPE_SHARE", None], draft["structure"])
        self.assertTrue(all(kind is None for _, kind in draft["structure"]), draft["structure"])
        self.assertTrue(draft["deferred"])
        self.assertTrue(all(kind in ("copy", "layout", "fit") for _, kind in draft["deferred"]), draft["deferred"])

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
        # The critique is bound to a page's kind, title, claim, type, what settles it, what it rests on and what it shows.
        # A draft is the full compile of the page completed with placeholder copy, so over every form of the catalogue: the
        # page as written has one record in a draft and in the full compile, the numbers its exhibits draw included; and the
        # page with nothing drawn is either refused or read exactly as the page its draft proves can be laid out from it.
        result = run_node('''
import { PAGE_TYPES } from './skills/professional-slides/runtime/page-types.mjs';
import { workedExamples, compileDeck } from './skills/professional-slides/runtime/author-deck.mjs';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
const worked = workedExamples();
const SPINE = ['id', 'kind', 'type', 'form', 'commentary', 'takeaway', 'why', 'title', 'settles', 'evidence', 'adds'];
const typed = worked.pages.filter((p) => p.type);
const doc = (pages) => ({ deck: worked.deck, ...(worked.sources ? { sources: worked.sources } : {}), pages });
const records = (spec) => new Map(S.storyStructure(spec).map((page) => [page.id, page]));
const differing = [], forms = new Set(typed.map((page) => `${page.type}/${page.form}`));
const same = (a, b, name, page, skip = []) => { const moved = Object.keys({ ...a, ...b }).filter((key) => !skip.includes(key) && JSON.stringify(a?.[key]) !== JSON.stringify(b?.[key])); if (moved.length) differing.push([page.id, `${page.type}/${page.form}`, name, moved]); };
const full = compileDeck(doc(typed), { partial: true });
const written = compileDeck(doc(typed), { draft: true, partial: true });
const bare = compileDeck(doc(typed.map((page) => Object.fromEntries(SPINE.filter((key) => page[key] !== undefined).map((key) => [key, page[key]])))), { draft: true, partial: true });
const fullOf = records(full.spec), writtenOf = records(written.spec), bareOf = records(bare.spec), witnessOf = records(bare.witness.spec);
const refused = new Set(bare.failed.map((f) => String(f.id)));
let accepted = 0;
for (const page of typed) {
  if (!fullOf.has(page.id)) { differing.push([page.id, `${page.type}/${page.form}`, 'the worked page does not compile', full.failed.find((f) => f.id === page.id)?.message]); continue; }
  same(fullOf.get(page.id), writtenOf.get(page.id), 'written', page);
  // A bare page is refused by its compile, or as undetermined where the critic's reading of it is not its witness's (a
  // worked page that plots typed numbers: the spine names none of them). One the draft takes argues what the worked page does.
  if (refused.has(page.id) || JSON.stringify(bareOf.get(page.id)) !== JSON.stringify(witnessOf.get(page.id))) continue;
  accepted += 1;
  same(bareOf.get(page.id), fullOf.get(page.id), 'spine against the worked page', page, ['shows', 'measures', 'views', 'drawn']);
}
const catalogue = Object.entries(PAGE_TYPES).flatMap(([type, t]) => Object.keys(t.forms).map((form) => `${type}/${form}`));
console.log(JSON.stringify({ differing, walked: forms.size, accepted, missing: catalogue.filter((form) => !forms.has(form)) }));
''')
        self.assertEqual(result["missing"], [])
        self.assertGreaterEqual(result["walked"], 90)
        self.assertEqual(result["differing"], [])
        # Most of the catalogue is a page whose bare spine a draft can prove; the rest it refuses, never reads loosely.
        self.assertGreaterEqual(result["accepted"], 40)


if __name__ == "__main__":
    unittest.main()
