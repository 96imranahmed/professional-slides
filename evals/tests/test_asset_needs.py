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
        # A player that carries its own logo file, a picture opted out of fetching and a marker with coordinates need nothing;
        # a deck that names no flag and plans no illustration needs none of either.
        self.assertEqual(result['none'], {'logos': [{'name': 'North Rail', 'file': 'assets/logos/north-rail.png'}, {'name': 'Harbour & Co', 'file': 'assets/logos/harbour-co.png'}], 'flags': [],
                                          'pictures': [{'alt': 'The depot at night', 'file': 'assets/pictures/the-depot-at-night.jpg'}], 'illustrations': [], 'places': ['Leeds']})
        # A file in the assets folder (either extension) and a cached place are no longer needs.
        self.assertEqual(result['some'], {'logos': [{'name': 'Harbour & Co', 'file': 'assets/logos/harbour-co.png'}], 'flags': [],
                                          'pictures': [{'alt': 'The depot at night', 'file': 'assets/pictures/the-depot-at-night.jpg'}], 'illustrations': [], 'places': []})
        stated = result['stated']
        self.assertEqual(stated['findings'], [['ASSETS_NEEDED', 'advisory']])
        self.assertEqual(stated['statement']['fetch'], 'build')
        self.assertEqual(stated['statement']['needsNetwork'], {'logos': ['North Rail', 'Harbour & Co'], 'flags': [], 'pictures': ['The depot at night'], 'illustrations': [], 'places': ['Leeds']})
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
        self.assertEqual(declared['statement']['notAvailable'], {'logos': ['Harbour & Co'], 'flags': [], 'pictures': ['The depot at night'], 'illustrations': [], 'places': []})
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

    def test_the_declaration_is_a_deck_key_checked_with_the_others(self):
        result = run_node(f'''
import {{ deckKeyProblems }} from './skills/professional-slides/runtime/deck-keys.mjs';
import {{ assetsDeclaration }} from './skills/professional-slides/runtime/asset-needs.mjs';
const check = (assets) => deckKeyProblems(assets === undefined ? {{}} : {{ assets }});
console.log(JSON.stringify({{ good: check({{ fetch: 'none', reason: '{REASON}' }}), build: check({{ fetch: 'build' }}), absent: check(undefined),
  unreasoned: check({{ fetch: 'none', reason: 'offline' }}), unknown: check({{ fetch: 'never' }}), bare: check('none'), extra: check({{ fetch: 'none', reason: '{REASON}', logos: false }}),
  read: [assetsDeclaration({{ assets: {{ fetch: 'none', reason: ' {REASON} ' }} }}), assetsDeclaration({{}}), assetsDeclaration({{ assets: {{ fetch: 'build' }} }})] }}));
''')
        self.assertEqual([result['good'], result['build'], result['absent']], [[], [], []])
        for bad, said in [('unreasoned', 'says in `reason` why the deck is built without the network'), ('unknown', '`assets` is { fetch, reason }'), ('bare', 'it was given'), ('extra', 'takes fetch and reason only (got logos)')]:
            self.assertEqual(len(result[bad]), 1, bad)
            self.assertIn(said, result[bad][0], bad)
        self.assertEqual(result['read'], [{'fetch': 'none', 'reason': REASON}, {'fetch': 'build'}, {'fetch': 'build'}])

@unittest.skipUnless(NODE, "Node.js is not available")
class OfflinePhotographTests(unittest.TestCase):
    """The offline declaration covers photographs as it covers logos, so `noPictures` keeps its meaning.

    A run with no network and no picture supplied wrote `noPictures` with a reason that was true and was not what the
    key is for - a subject with nothing to look at. Declared offline with no photograph supplied, a deck is expected to
    carry no picture page: the floor advises, and the compile, the build result and the reviewer say so. A photograph
    a page still plans stays an empty frame, which delivery refuses.
    """

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

class CompileNoticeTests(unittest.TestCase):
    """The compile says it, on a check too, before any build is run."""

    def stage(self, patch=None):
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        for name in ["finance.pages.json", "finance.insights.json"]:
            shutil.copy(FIXTURES / name, tmp / name)
        doc = json.loads((tmp / "finance.pages.json").read_text())
        # The pages that rest on the fixture's computed analyses ("A-..."), which a deck now records as measures of its own.
        doc["pages"] = [page for page in doc["pages"] if '"A-' not in json.dumps(page) and "{{A-" not in json.dumps(page)]
        doc["deck"].update(patch or {})
        (tmp / "finance.pages.json").write_text(json.dumps(doc))
        (tmp / "sources").mkdir()
        for insight in json.loads((tmp / "finance.insights.json").read_text())["insights"]:
            for source in insight["sources"]:
                (tmp / source).write_text("illustrative")
        return tmp

    def compile(self, tmp, *flags):
        return subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(tmp / "finance.pages.json"), *flags], capture_output=True, text=True, cwd=ROOT)

    def test_a_check_names_the_logos_the_build_would_fetch_and_the_three_choices(self):
        tmp = self.stage()
        run = self.compile(tmp, "--check")
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
        run = self.compile(tmp)
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
        run = self.compile(supplied, "--check")
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertNotIn("Assets:", run.stderr)
        self.assertNotIn("assets", json.loads(run.stdout))
        bad = self.stage({"assets": {"fetch": "none", "reason": "offline"}})
        run = self.compile(bad, "--check")
        self.assertEqual(run.returncode, 2)
        self.assertIn("`assets` on `deck` is not in the form the build reads", run.stderr)
        self.assertIn("says in `reason` why the deck is built without the network", run.stderr)


if __name__ == "__main__":
    unittest.main()
