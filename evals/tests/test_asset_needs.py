"""What a deck needs from the network is decided at the compile (runtime/asset-needs.mjs).

A deck that declared its players introduced them with logo placeholders, which
the compile accepted and the build fetched. With no network the build drew the
names, and the craft floor refused the deck for showing no marks - after the
render, and with nothing an offline author could do about it. The compile now
says what the build would fetch and what the choices are: supply the files,
let the build fetch, or declare on the deck that it is built without the
network, which the build honours and the reviews are told.
"""
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import ROOT, run_node

NODE = shutil.which("node")
RUNTIME = ROOT / "skills" / "professional-slides" / "runtime"
FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"
REASON = "The build machine has no network access and the client supplied no logo files"


class AssetNeedTests(unittest.TestCase):
    def test_what_is_missing_is_named_with_the_file_that_would_supply_it(self):
        result = run_node('''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import { assetNeeds, assetFindings, assetNotice, assetReport, assetsPrompt } from './skills/professional-slides/runtime/asset-needs.mjs';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-needs-'));
const spec = (o = {}) => ({ id: 'd', players: ['North Rail', { name: 'Harbour & Co', logo: { alt: 'Harbour & Co logo' } }, { name: 'Supplied', logo: { path: 'client/supplied.png' } }],
  slides: [{ id: 'p1', title: 'A page', photo: { alt: 'The depot at night' }, exhibit: { type: 'map', markers: [{ place: 'Leeds' }, { label: 'York', longitude: -1.08, latitude: 53.96 }] } },
    { id: 'p2', title: 'Another', pictures: [{ alt: 'The depot at night' }, { alt: 'A client photograph', fetch: false }, { alt: 'North Rail logo' }] }], ...o });
const none = await assetNeeds(spec(), dir);
const stated = await assetFindings(spec(), dir);
await fs.mkdir(path.join(dir, 'assets', 'logos'), { recursive: true });
await fs.writeFile(path.join(dir, 'assets', 'logos', 'north-rail.jpg'), 'jpeg');
await fs.writeFile(path.join(dir, 'assets', 'places.json'), JSON.stringify({ Leeds: { longitude: -1.55, latitude: 53.8 } }));
const some = await assetNeeds(spec(), dir);
const offline = { assets: { fetch: 'none', reason: 'The build machine has no network access at all' } };
const declared = await assetFindings(spec(offline), dir);
const reports = [await assetReport(spec(), dir), await assetReport(spec(), dir, { fetched: false }), await assetReport(spec(offline), dir)];
await fs.mkdir(path.join(dir, 'assets', 'pictures'), { recursive: true });
await fs.writeFile(path.join(dir, 'assets', 'logos', 'harbour-co.png'), 'png');
await fs.writeFile(path.join(dir, 'assets', 'pictures', 'the-depot-at-night.jpg'), 'jpeg');
const supplied = [await assetFindings(spec(), dir), await assetReport(spec(), dir), await assetFindings(spec(offline), dir)];
await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify({ none, some, stated: { statement: stated.statement, findings: stated.findings.map((f) => [f.code, f.severity]), notice: assetNotice(stated.statement) },
  declared: { statement: declared.statement, findings: declared.findings.map((f) => [f.code, f.severity, f.repair]), notice: assetNotice(declared.statement) },
  reports, prompts: reports.map(assetsPrompt), supplied: [supplied[0].statement, supplied[1], supplied[2].findings.map((f) => f.code), assetNotice(supplied[2].statement)], silent: [assetNotice(null), assetsPrompt(null)] }));
''')
        # A player that carries its own logo file, a picture opted out of fetching and a marker with coordinates need nothing.
        self.assertEqual(result['none'], {'logos': [{'name': 'North Rail', 'file': 'assets/logos/north-rail.png'}, {'name': 'Harbour & Co', 'file': 'assets/logos/harbour-co.png'}],
                                          'pictures': [{'alt': 'The depot at night', 'file': 'assets/pictures/the-depot-at-night.jpg'}], 'places': ['Leeds']})
        # A file in the assets folder (either extension) and a cached place are no longer needs.
        self.assertEqual(result['some'], {'logos': [{'name': 'Harbour & Co', 'file': 'assets/logos/harbour-co.png'}],
                                          'pictures': [{'alt': 'The depot at night', 'file': 'assets/pictures/the-depot-at-night.jpg'}], 'places': []})
        stated = result['stated']
        self.assertEqual(stated['findings'], [['ASSETS_NEEDED', 'advisory']])
        self.assertEqual(stated['statement']['fetch'], 'build')
        self.assertEqual(stated['statement']['needsNetwork'], {'logos': ['North Rail', 'Harbour & Co'], 'pictures': ['The depot at night'], 'places': ['Leeds']})
        a, b, c = stated['statement']['choices']
        for said in ['(a) supply the files', 'assets/logos/north-rail.png', 'assets/logos/harbour-co.png', 'assets/pictures/the-depot-at-night.jpg', '`longitude` and `latitude` on each marker (Leeds)']:
            self.assertIn(said, a)
        self.assertIn('(b) let the build fetch them: the default', b)
        for said in ['(c) declare the deck is built without the network', '"assets": { "fetch": "none", "reason": "<a sentence saying why>" }', 'introduced by name', 'the reviewer\'s packet and the delivery report', '`BAR_UNSOURCED_PICTURES`']:
            self.assertIn(said, c)
        self.assertTrue(stated['notice'].startswith('Assets: the build will fetch from the network - logos: North Rail, Harbour & Co'))
        self.assertEqual(stated['notice'].count('\n  ('), 3)  # the three choices, a line each
        declared = result['declared']
        self.assertEqual([f[:2] for f in declared['findings']], [['ASSETS_OFFLINE', 'advisory']])
        self.assertIn('the build fetches nothing: 1 logo (Harbour & Co), 1 photograph will not be available', declared['findings'][0][2])
        self.assertEqual(declared['statement']['notAvailable'], {'logos': ['Harbour & Co'], 'pictures': ['The depot at night'], 'places': []})
        self.assertIn('built without the network ("The build machine has no network access at all")', declared['notice'])
        # What a build records: whether it fetched, the declaration, and what was still missing.
        self.assertEqual([r['fetch'] for r in result['reports']], ['build', 'skipped', 'none'])
        self.assertEqual(result['reports'][2]['reason'], 'The build machine has no network access at all')
        self.assertEqual(result['reports'][2]['notAvailable']['logos'], ['Harbour & Co'])
        self.assertIn('could not obtain the logos of Harbour & Co', result['prompts'][0])
        offline = result['prompts'][2]
        for said in ['ASSETS NOT AVAILABLE', 'declares it was built without network access', 'its reason: "The build machine has no network access at all"', 'the logos of Harbour & Co', 'introduced by name',
                     'not a ruling', 'do file one where a page does not work without its marks']:
            self.assertIn(said, offline)
        # With every file supplied there is nothing to say - and an offline declaration then leaves nothing unavailable.
        self.assertEqual(result['supplied'][:2], [None, None])
        self.assertEqual(result['supplied'][2], ['ASSETS_OFFLINE'])
        self.assertIn('Every planned file is already in the assets folder', result['supplied'][3])
        self.assertEqual(result['silent'], [None, ''])

    def test_the_declaration_is_a_deck_statement_checked_with_the_others(self):
        result = run_node(f'''
import {{ deckStatementFindings }} from './skills/professional-slides/runtime/review-passes.mjs';
import {{ assetsDeclaration }} from './skills/professional-slides/runtime/asset-needs.mjs';
const check = (assets) => deckStatementFindings({{ workflow: 'new_deck', request: 'Who is better positioned, and why?', assets }}).map((f) => [f.code, f.severity, f.repair]);
console.log(JSON.stringify({{ good: check({{ fetch: 'none', reason: '{REASON}' }}), build: check({{ fetch: 'build' }}), absent: check(undefined),
  unreasoned: check({{ fetch: 'none', reason: 'offline' }}), unknown: check({{ fetch: 'never' }}), bare: check('none'), extra: check({{ fetch: 'none', reason: '{REASON}', logos: false }}),
  read: [assetsDeclaration({{ assets: {{ fetch: 'none', reason: ' {REASON} ' }} }}), assetsDeclaration({{}}), assetsDeclaration({{ assets: {{ fetch: 'build' }} }})] }}));
''')
        self.assertEqual([result['good'], result['build'], result['absent']], [[], [], []])
        for bad, said in [('unreasoned', 'says in `reason` why the deck is built without the network'), ('unknown', '`assets` is { fetch, reason }'), ('bare', '`assets` is { fetch, reason }'), ('extra', 'takes fetch and reason only (got logos)')]:
            self.assertEqual([f[:2] for f in result[bad]], [['STATEMENT_INVALID', 'blocker']], bad)
            self.assertIn(said, result[bad][0][2], bad)
        self.assertEqual(result['read'], [{'fetch': 'none', 'reason': REASON}, {'fetch': 'build'}, {'fetch': 'build'}])

    def test_an_offline_deck_introduces_its_players_by_name_and_is_not_blocked_for_their_logos(self):
        result = run_node(f'''
import {{ craftFindings }} from './skills/professional-slides/runtime/gates/craft_gates.mjs';
const slides = Array.from({{ length: 12 }}, (_, i) => ({{ id: 'p' + i, title: 'A finding on page ' + i }}));
const players = ['North Rail', {{ name: 'Harbour & Co', aliases: ['Harbour'] }}, 'Millrace'];
const text = (t) => ({{ type: 'text', role: 'table-cell-text', text: t }});
const scene = (nodes) => ({{ slides: [{{ id: 'p0', nodes: [{{ type: 'text', role: 'action-title', text: 'The three operators' }}, ...nodes] }}] }});
const named = scene([text('North Rail'), text('Harbour'), text('Millrace runs the coast')]);
const marked = scene([{{ type: 'image', role: 'table-logo' }}]);
const offline = {{ fetch: 'none', reason: '{REASON}' }};
const players_ = (spec, sc) => craftFindings(spec, sc).filter((f) => f.code === 'CRAFT_PLAYERS_UNINTRODUCED').map((f) => [f.severity, f.measured, f.repair]);
console.log(JSON.stringify({{ online: players_({{ slides, players }}, named), offline: players_({{ slides, players, assets: offline }}, named),
  unnamed: players_({{ slides, players, assets: offline }}, scene([text('North Rail'), text('Millrace')])), marked: players_({{ slides, players, assets: offline }}, marked),
  // A revision recorded before the rule existed hears it as an advisory either way.
  build: players_({{ slides, players, assets: {{ fetch: 'build' }} }}, named).map((f) => f[0]) }}));
''')
        # Without the declaration the floor blocks as it did, and now says what an offline build can do about it.
        self.assertEqual([f[0] for f in result['online']], ['blocker'])
        self.assertIn('either put each logo in assets/logos/ beside the pages file', result['online'][0][2])
        self.assertIn('declare `assets: { fetch: "none", reason }`', result['online'][0][2])
        self.assertEqual(result['build'], ['blocker'])
        # With it, players named on a page are introduced: said as an advisory, with the reason, never blocking.
        self.assertEqual([f[0] for f in result['offline']], ['advisory'])
        self.assertEqual(result['offline'][0][1], {'players': 3, 'logoPages': 0, 'kinds': ['logo'], 'assets': 'none'})
        self.assertIn(f'it declares it is built without the network ("{REASON}")', result['offline'][0][2])
        self.assertIn('The reviewer is told the logos were not available', result['offline'][0][2])
        # The declaration is not a way to skip the introduction: a player named on no page still blocks.
        self.assertEqual([f[0] for f in result['unnamed']], ['blocker'])
        self.assertEqual(result['unnamed'][0][1]['unnamed'], ['Harbour & Co'])
        self.assertIn('Harbour & Co is named on no page', result['unnamed'][0][2])
        self.assertEqual(result['marked'], [])  # a deck that shows its marks has nothing to answer

    def test_a_player_is_named_by_whole_words_in_a_pages_content_not_in_its_source_line(self):
        # "Named on a page" was a substring search over every text node: a
        # player named only in a citation counted as introduced, and a player
        # called "Rus" was named by the word "Russia".
        result = run_node(f'''
import {{ craftFindings }} from './skills/professional-slides/runtime/gates/craft_gates.mjs';
const slides = Array.from({{ length: 12 }}, (_, i) => ({{ id: 'p' + i, title: 'A finding on page ' + i }}));
const players = ['North Rail', {{ name: 'Rus', aliases: ['RUS Lines'] }}, 'Millrace'];
const node = (role, text) => ({{ type: 'text', role, text }});
const scene = (...nodes) => ({{ slides: [{{ id: 'p0', nodes: [node('action-title', 'The three operators'), ...nodes] }}] }});
const unnamed = (...nodes) => craftFindings({{ slides, players, assets: {{ fetch: 'none', reason: '{REASON}' }} }}, scene(...nodes)).filter((f) => f.code === 'CRAFT_PLAYERS_UNINTRODUCED').map((f) => [f.severity, f.measured.unnamed ?? []]);
const cells = [node('table-cell-text', 'North Rail'), node('table-cell-text', 'Millrace')];
console.log(JSON.stringify({{
  content: unnamed(...cells, node('table-cell-text', 'Rus')), wrapped: unnamed(...cells, node('category-label', 'RUS\\nLines')), punctuated: unnamed(...cells, node('paragraph', 'Of the three (Rus, chiefly) one runs the coast.')),
  title: unnamed(node('action-title', 'North Rail, Rus and Millrace run the coast')),
  substring: unnamed(...cells, node('paragraph', 'Russia regulates all three; the Millraces of the trust own the track.')),
  source: unnamed(...cells, node('source-text', 'Source: Rus annual report 2026')), footnote: unnamed(...cells, node('footnote-text', 'Rus is not covered here')),
  footer: unnamed(...cells, node('footer-left', 'Prepared for Rus')), tracker: unnamed(...cells, node('tracker-compact-label', 'Rus')), credit: unnamed(...cells, node('picture-credit', 'Photo: Rus')) }}));
''')
        for where in ['content', 'wrapped', 'punctuated', 'title']:
            self.assertEqual(result[where], [['advisory', []]], where)
        # A name inside a longer word, or printed only where a page cites, notes or navigates, introduces nobody.
        for where in ['substring', 'source', 'footnote', 'footer', 'tracker', 'credit']:
            self.assertEqual(result[where], [['blocker', ['Rus']]], where)


@unittest.skipUnless(NODE, "Node.js is not available")
class OfflinePhotographTests(unittest.TestCase):
    """The offline declaration covers photographs as it covers logos, so `noPictures` keeps its meaning.

    A run with no network and no picture supplied wrote `noPictures` with a reason that was true and was not what the
    key is for - a subject with nothing to look at. Declared offline with no photograph supplied, a deck is expected to
    carry no picture page: the floor advises, and the compile, the build result and the reviewer say so. A photograph
    a page still plans stays an empty frame, which delivery refuses.
    """

    def test_an_offline_deck_supplied_no_photograph_is_not_blocked_for_carrying_none(self):
        result = run_node(f'''
import {{ craftFindings }} from './skills/professional-slides/runtime/gates/craft_gates.mjs';
const slides = Array.from({{ length: 22 }}, (_, i) => ({{ id: 'p' + i, title: 'A finding on page ' + i }}));
const scene = {{ slides: [{{ id: 'p0', nodes: [{{ type: 'text', role: 'action-title', text: 'A finding' }}] }}] }};
const offline = {{ fetch: 'none', reason: '{REASON}' }};
const pictures = (spec, options = {{}}) => {{ const standings = []; const found = craftFindings(spec, scene, {{ standings, ...options }}).filter((f) => f.code === 'CRAFT_NO_PICTURES').map((f) => [f.severity, f.measured, f.repair]);
  const standing = standings.find((st) => st.code === 'CRAFT_NO_PICTURES'); return {{ found, standing: [standing.applies, standing.blocks] }}; }};
console.log(JSON.stringify({{ online: pictures({{ slides }}), offline: pictures({{ slides, assets: offline }}), supplied: pictures({{ slides, assets: offline }}, {{ picturesSupplied: 2 }}),
  waived: pictures({{ slides, noPictures: 'The subject is a pricing rule' }}), build: pictures({{ slides, assets: {{ fetch: 'build' }} }}) }}));
''')
        # Without the declaration the floor blocks as it did, and says which statement an offline build makes.
        self.assertEqual([f[0] for f in result['online']['found']], ['blocker'])
        self.assertIn('`assets: { fetch: "none", reason }`', result['online']['found'][0][2])
        self.assertEqual(result['online']['standing'], [True, True])
        self.assertEqual([f[0] for f in result['build']['found']], ['blocker'])
        # Declared offline with no photograph supplied: advised, with the reason, and where the deck stands says it does not block.
        self.assertEqual([f[0] for f in result['offline']['found']], ['advisory'])
        self.assertEqual(result['offline']['found'][0][1], {'pages': 22, 'pictures': 0, 'assets': 'none'})
        self.assertIn(f'it is built without the network ("{REASON}")', result['offline']['found'][0][2])
        self.assertIn('no photograph is supplied in assets/pictures/', result['offline']['found'][0][2])
        self.assertIn('BAR_UNSOURCED_PICTURES', result['offline']['found'][0][2])
        self.assertEqual(result['offline']['standing'], [True, False])
        # The declaration is not a way round photographs that were supplied: with files in assets/pictures/ the floor holds.
        self.assertEqual([f[0] for f in result['supplied']['found']], ['blocker'])
        # `noPictures` is what it was: the sentence of a subject with nothing to look at.
        self.assertEqual(result['waived'], {'found': [], 'standing': [False, True]})

    def test_the_compile_the_build_result_and_the_reviewer_say_no_photograph_was_expected(self):
        result = run_node('''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import { assetFindings, assetNotice, assetReport, assetsPrompt, suppliedPictures } from './skills/professional-slides/runtime/asset-needs.mjs';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-pictures-'));
const offline = { fetch: 'none', reason: 'The build machine has no network access at all' };
const bare = { id: 'd', assets: offline, slides: [{ id: 'p1', title: 'A page' }] };
const planned = { ...bare, slides: [{ id: 'p1', title: 'A page', photo: { alt: 'The depot at night' } }] };
const stated = await assetFindings(bare, dir), plan = await assetFindings(planned, dir);
const reports = [await assetReport(bare, dir), await assetReport(planned, dir)];
await fs.mkdir(path.join(dir, 'assets', 'pictures'), { recursive: true });
await fs.writeFile(path.join(dir, 'assets', 'pictures', 'the-depot-at-night.jpg'), 'jpeg');
await fs.writeFile(path.join(dir, 'assets', 'pictures', 'notes.txt'), 'not a picture');
const supplied = [await suppliedPictures(dir), (await assetFindings(planned, dir)).statement.photographs, (await assetReport(planned, dir)).photographs];
await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify({ statement: stated.statement, notice: assetNotice(stated.statement), repair: stated.findings[0].repair, planRepair: plan.findings[0].repair, planStatement: plan.statement.photographs,
  reports, prompts: reports.map(assetsPrompt), supplied, online: assetsPrompt({ fetch: 'build', notAvailable: { logos: [], pictures: [], places: [] } }) }));
''')
        self.assertEqual(result['statement']['photographs'], {'supplied': 0, 'expected': False})
        self.assertIn('Photographs: no photograph is supplied in assets/pictures/ and none is fetched, so the deck is expected to carry no picture page', result['notice'])
        self.assertIn('no `noPictures` is needed', result['notice'])
        self.assertIn('expected to carry no picture page', result['repair'])
        # A photograph a page still plans is named as what delivery refuses, whatever the deck declares.
        self.assertEqual(result['planStatement'], {'supplied': 0, 'expected': True})
        self.assertIn('stay empty frames, which delivery refuses (`BAR_UNSOURCED_PICTURES`)', result['planRepair'])
        # The build result records it, and the reviewer is told - even where nothing else is missing.
        self.assertEqual([report['photographs'] for report in result['reports']], [{'supplied': 0}, {'supplied': 0}])
        self.assertIn('No photograph was supplied to it and none was fetched, so the deck was expected to carry no picture page', result['prompts'][0])
        self.assertIn('do not file a finding only because the deck has no photograph', result['prompts'][0])
        self.assertIn('do file one where a page does not work without its marks or pictures', result['prompts'][0])
        self.assertIn('1 planned photograph', result['prompts'][1])
        # Only image files count as supplied.
        self.assertEqual(result['supplied'], [1, {'supplied': 1, 'expected': True}, {'supplied': 1}])
        self.assertEqual(result['online'], '')

    def test_a_planned_photograph_left_empty_is_still_a_build_bar_miss_under_the_declaration(self):
        result = run_node('''
import { scoreBuild } from './skills/professional-slides/runtime/build-bars.mjs';
const page = (roles) => ({ id: 's', nodes: [{ role: 'action-title', type: 'text' }, ...roles.map((role) => ({ role, type: 'rect', frame: { x: 0, y: 0, width: 400, height: 300 } })), ...Array(20).fill({ role: 'm', type: 'rect' })],
  componentInstances: [{ component: 'slide-chrome' }, { component: 'image-frame' }] });
const scene = { slides: [page(['image-frame']), page([]), page([])] };
const scored = scoreBuild(scene);
console.log(JSON.stringify({ unsourced: scored.statistics.unsourcedPictures, missed: scored.findings.filter((f) => f.measure === 'unsourcedPictures').map((f) => [f.code, f.ceiling]) }));
''')
        # The bar reads the built scene and nothing of the deck's declaration: an empty frame is refused offline as online.
        self.assertEqual(result['unsourced'], 1)
        self.assertEqual(result['missed'], [['BAR_UNSOURCED_PICTURES', 0]])


class CompileNoticeTests(unittest.TestCase):
    """The compile says it, on a draft too, before any build is run."""

    def stage(self, patch=None):
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        for name in ["finance.pages.json", "finance.insights.json", "finance.analysis.json"]:
            shutil.copy(FIXTURES / name, tmp / name)
        doc = json.loads((tmp / "finance.pages.json").read_text())
        doc["deck"].update(patch or {})
        (tmp / "finance.pages.json").write_text(json.dumps(doc))
        (tmp / "sources").mkdir()
        for insight in json.loads((tmp / "finance.insights.json").read_text())["insights"]:
            for source in insight["sources"]:
                (tmp / source).write_text("illustrative")
        return tmp

    def compile(self, tmp, *flags):
        return subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(tmp / "finance.pages.json"), *flags], capture_output=True, text=True, cwd=ROOT)

    def test_a_draft_names_the_logos_the_build_would_fetch_and_the_three_choices(self):
        tmp = self.stage()
        run = self.compile(tmp, "--draft")
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("Assets: the build will fetch from the network - logos: Harbour, Northgate, Millrace", run.stderr)
        for choice in ["(a) supply the files beside the pages file: each logo as a PNG or JPEG at assets/logos/harbour.png", "(b) let the build fetch them", '(c) declare the deck is built without the network, on `deck`: "assets": { "fetch": "none"']:
            self.assertIn(choice, run.stderr)
        summary = json.loads(run.stdout)
        self.assertEqual(summary["assets"]["fetch"], "build")
        self.assertEqual(len(summary["assets"]["needsNetwork"]["logos"]), 8)
        self.assertIn("ASSETS_NEEDED", summary["advisories"])

    def test_the_offline_declaration_is_recorded_on_the_deck_and_a_malformed_one_is_refused(self):
        tmp = self.stage({"assets": {"fetch": "none", "reason": REASON}})
        run = self.compile(tmp, "--draft")
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn(f'Assets: the deck is built without the network ("{REASON}"). Not available, and said so to the reviewer - logos: Harbour', run.stderr)
        summary = json.loads(run.stdout)
        self.assertEqual([summary["assets"]["fetch"], summary["assets"]["reason"]], ["none", REASON])
        self.assertIn("ASSETS_OFFLINE", summary["advisories"])
        self.assertNotIn("ASSETS_NEEDED", summary["advisories"])
        # The compiled deck carries the declaration to the build and the reviews.
        self.assertEqual(json.loads((tmp / "finance.deck.json").read_text())["assets"], {"fetch": "none", "reason": REASON})
        # Supplying the files instead: nothing left to say.
        supplied = self.stage()
        (supplied / "assets" / "logos").mkdir(parents=True)
        for name in json.loads((supplied / "finance.pages.json").read_text())["deck"]["players"]:
            shutil.copy(ROOT / "skills" / "professional-slides" / "assets" / "simple-icons" / "github-color.png", supplied / "assets" / "logos" / f"{name.lower()}.png")
        run = self.compile(supplied, "--draft")
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertNotIn("Assets:", run.stderr)
        self.assertNotIn("assets", json.loads(run.stdout))
        bad = self.stage({"assets": {"fetch": "none", "reason": "offline"}})
        run = self.compile(bad, "--draft")
        self.assertEqual(run.returncode, 2)
        self.assertIn("STATEMENT_INVALID", run.stderr)
        self.assertIn("says in `reason` why the deck is built without the network", run.stderr)


if __name__ == "__main__":
    unittest.main()
