"""Five work streams in one runtime: what holds only once they are combined.

Each stream was built and tested alone. These run the combinations no one
stream could test, through the runtime itself, on the evidence fixtures
(`evals/quality/fixtures/evidence/`: `finance` has bound pages, `public-ops`
a closed evidence scope and a scenario) and, where a rule reads a deck too
long for a fixture, on the worked example deck:

* every stream's codes are classed, and one run reports them in class order
  with the standings every structure rule owes;
* a deck that declares it is built without the network has its players floor
  decided at the compile and at the rendered check as the build decides it,
  and the asset statement is printed on a refused run too;
* a bound page passes through the fit search, the plan, a part file, a page
  run, a scaffold with its limits, and the storyline's binding;
* the worked page of every form passes the page-local checks of the stricter
  compile, with nothing traced where there is no insight log;
* a pages file and an insight log both in parts are one deck to every reader,
  and the run log counts page runs and renders beside drafts, checks and full
  compiles.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import HAS_RENDERER, NODE, ROOT, SKILL, requires_python_package, run_node

AUTHOR = SKILL / "runtime" / "author-deck.mjs"
ANALYSIS = SKILL / "runtime" / "analysis.mjs"
BUILD = SKILL / "runtime" / "build-deck.mjs"
EXAMPLES = SKILL / "examples"
FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"
OFFLINE = {"fetch": "none", "reason": "The build machine has no network access and no logo files were supplied"}


def run(script, *args, timeout=900):
    return subprocess.run([NODE, str(script), *map(str, args)], cwd=ROOT, capture_output=True, text=True, timeout=timeout,
                          env={**os.environ, "RUNTIME_NODE_MODULES": str(ROOT / "node_modules")})


def stage(tmp, name, mutate=None):
    """An evidence fixture copied into `tmp` as a task folder; `mutate(doc)` edits its pages document. Returns the pages file."""
    work = Path(tmp)
    for suffix in ("pages", "insights", "analysis"):
        shutil.copy(FIXTURES / f"{name}.{suffix}.json", work / f"{name}.{suffix}.json")
    file = work / f"{name}.pages.json"
    if mutate:
        doc = json.loads(file.read_text(encoding="utf-8"))
        mutate(doc)
        file.write_text(json.dumps(doc), encoding="utf-8")
    return file


def page_of(doc, page_id):
    return next(p for p in doc["pages"] if p.get("id") == page_id)


def log_of(file):
    stem = file.name.replace(".pages.json", "")
    return [json.loads(line) for line in (file.parent / f"{stem}.author-log.jsonl").read_text(encoding="utf-8").splitlines()]


# A fixture read and compiled in memory: `page(id)` is the authored page, `author(doc)` the run.
PROBE = f'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {{ authorDeck, readInsights }} from './skills/professional-slides/runtime/author-deck.mjs';
import {{ alternativesOf }} from './skills/professional-slides/runtime/analysis.mjs';
const FIX = '{FIXTURES}';
const load = (name) => JSON.parse(fs.readFileSync(path.join(FIX, `${{name}}.pages.json`), 'utf8'));
const author = async (name, doc, options = {{}}) => authorDeck(doc, {{ baseDir: FIX, insights: await readInsights(FIX, name, {{ alternatives: alternativesOf(doc.deck) }}), ...options }});
const page = (doc, id) => doc.pages.find((p) => p.id === id);
'''

# Two developed points and the model form: the chart beside a short column leaves a band of the column empty.
MISFIT = '''
const misfit = (doc) => { const p = page(doc, 'f6'); delete p.bar; p.form = 'model'; p.commentary = 'beside'; p.adds = 'Why cash flow lags the loan book in the last year';
  p.points = ['Loans have grown every year since FY19 and stand well above where they started, which is the growth the board asked for and the reason the balance sheet is now larger than at any time in the period shown',
    'Operating cash flow is the one measure that fell back in the last year, which is why new lending now draws on the liquidity cushion rather than on cash the business generates, and why funding comes before further lending in the plan']; };
'''


class ClassesAndOrderTests(unittest.TestCase):
    """Item 1: every stream's codes have a class, and a run files them in it."""

    def test_the_new_codes_sit_in_the_classes_the_report_order_depends_on(self):
        result = run_node('''
import { GATE_CLASSES, STANDING_FREE } from './skills/professional-slides/runtime/gates/gate_classes.mjs';
const codes = ['NUMBER_UNTRACED', 'BINDING_UNRESOLVED', 'MEASURES_CONFLICT', 'CONTENTS_UNFIT', 'ASSETS_NEEDED', 'ASSETS_OFFLINE'];
console.log(JSON.stringify({ classes: Object.fromEntries(codes.map((code) => [code, GATE_CLASSES[code]])), free: codes.filter((code) => STANDING_FREE[code]) }));
''')
        self.assertEqual(result["classes"], {"NUMBER_UNTRACED": "P", "BINDING_UNRESOLVED": "P", "MEASURES_CONFLICT": "S", "CONTENTS_UNFIT": "S", "ASSETS_NEEDED": "S", "ASSETS_OFFLINE": "S"})
        # The contents page has a count to have room in, so it owes a standing; the others say why they owe none.
        self.assertEqual(sorted(result["free"]), ["ASSETS_NEEDED", "ASSETS_OFFLINE", "MEASURES_CONFLICT"])

    def test_one_run_reports_a_log_conflict_then_an_unbound_page_and_says_where_the_deck_stands(self):
        with tempfile.TemporaryDirectory() as tmp:
            def unbind(doc):
                page_of(doc, "f6")["exhibit"]["series"][0]["measure"] = "A-index/no-such-series"
            file = stage(tmp, "finance", unbind)
            # One measure recorded twice with different numbers: a second insight repeats the loan book, one year changed.
            log_path = Path(tmp) / "finance.insights.json"
            log = json.loads(log_path.read_text(encoding="utf-8"))
            loans = next(item for item in log["insights"] if item["id"] == "i-loans")
            twin = json.loads(json.dumps(loans))
            twin["id"] = "i-loans-again"
            twin["measures"]["loans"]["values"][-1] += 40
            log["insights"].append(twin)
            log_path.write_text(json.dumps(log), encoding="utf-8")
            checked = run(AUTHOR, file, "--check")
            self.assertEqual(checked.returncode, 2, checked.stderr[-1200:])
            report = checked.stderr
            self.assertIn("2 findings to fix in finance.pages.json (S 1, P 1)", report)
            order = [report.index(mark) for mark in ("Assets:", "S. Deck structure", "MEASURES_CONFLICT", "P. Page-local", "BINDING_UNRESOLVED [f6]", "Where the deck stands:")]
            self.assertEqual(order, sorted(order))
            # The unbound page is stood in for by its declared choices: the structure rules still read seven pages, marked
            # provisional, and the aggregates the six that composed.
            standing = report.split("Where the deck stands:")[1]
            self.assertIn("PAGE_SHAPE_FLAT.share: pages on the commonest architecture (evidence-only) 4 of 7 pages", standing)
            self.assertIn("(provisional)", standing.split("Deck aggregates")[0])
            self.assertIn("(measured on the 6 pages that composed)", standing.split("Deck aggregates")[1])
            # The answer rule's three bars each say where the deck stands (the summary's title and the page as a whole).
            for key in ("CONTENT_ANSWER_UNCARRIED.coverage", "CONTENT_ANSWER_UNCARRIED.lead", "CONTENT_ANSWER_UNCARRIED.upfront"):
                self.assertIn(key, report)
            entry = log_of(file)[-1]
            self.assertEqual([entry["v"], entry["mode"], entry["pages"], entry["ok"]], [2, "check", 7, False])
            self.assertEqual(sorted((f["code"], f["class"]) for f in entry["findings"]), [("BINDING_UNRESOLVED", "P"), ("MEASURES_CONFLICT", "S")])

    def test_a_contents_page_past_its_style_is_a_structure_finding_with_a_standing(self):
        result = run_node(PROBE + '''
const doc = load('finance');
doc.deck.agendaStyle = 'columns';
const sections = ['Growth', 'Cash', 'Liquidity', 'Cost', 'Peers', 'Index', 'Outlook'];
doc.pages = doc.pages.flatMap((p, i) => (i === 0 ? [p] : [{ kind: 'section', title: sections[i - 1] }, p])).concat([{ kind: 'section', title: sections[6] }, { ...structuredClone(page(doc, 'f5')), id: 'f7', title: 'Harbour ranks fourth of eight on margin among its regional peers' }]);
const run = await author('finance', doc, { fit: false });
const found = run.blocking.find((f) => f.code === 'CONTENTS_UNFIT');
console.log(JSON.stringify({ found: found ? { class: found.class, measured: found.measured } : null, first: run.blocking[0]?.class, line: run.standings.find((s) => s.code === 'CONTENTS_UNFIT')?.line }));
''')
        self.assertEqual(result["found"], {"class": "S", "measured": {"sections": 7, "style": "columns", "holds": [2, 6]}})
        self.assertEqual(result["first"], "S")
        self.assertEqual(result["line"], "CONTENTS_UNFIT: sections on the contents page (the column style the deck names) 7; cap 6: over by 1 sections - BLOCKS")


# The worked example deck with five declared players introduced on an early page (the worked logo table, its cells
# naming each player and carrying no file) and no logo on disk: the one deck long enough for the craft floors, which
# a seven-page fixture is not.
PLAYERS = '''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { authorDeck } from './skills/professional-slides/runtime/author-deck.mjs';
const examples = path.resolve('skills/professional-slides/examples');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'streams-'));
fs.cpSync(path.join(examples, 'assets'), path.join(dir, 'assets'), { recursive: true });
fs.rmSync(path.join(dir, 'assets', 'logos'), { recursive: true, force: true });
const named = JSON.parse(fs.readFileSync(path.join(examples, 'page-types.pages.json'), 'utf8'));
const table = structuredClone(JSON.parse(fs.readFileSync(path.join(examples, 'page-forms.pages.json'), 'utf8')).pages.find((p) => p.id === 'f-profiles-logo-table'));
const players = table.exhibit.rows.map((row) => row[0].media.alt.replace(/ logo$/, ''));
for (const [i, row] of table.exhibit.rows.entries()) row[0] = { type: 'logo', player: players[i], media: { alt: `${players[i]} logo` } };
named.deck.players = players;
named.pages.splice(named.pages.findIndex((p) => p.id === 'p03'), 0, { ...table, id: 'p02b' });
'''


def players_deck(tmp, declare=True, stranger=None):
    """The worked example deck of PLAYERS as a task folder; returns its pages file."""
    work = Path(tmp)
    shutil.copytree(EXAMPLES / "assets", work / "assets")
    shutil.rmtree(work / "assets" / "logos", ignore_errors=True)
    doc = json.loads((EXAMPLES / "page-types.pages.json").read_text(encoding="utf-8"))
    table = next(p for p in json.loads((EXAMPLES / "page-forms.pages.json").read_text(encoding="utf-8"))["pages"] if p["id"] == "f-profiles-logo-table")
    players = [row[0]["media"]["alt"].removesuffix(" logo") for row in table["exhibit"]["rows"]]
    for name, row in zip(players, table["exhibit"]["rows"]):
        row[0] = {"type": "logo", "player": name, "media": {"alt": f"{name} logo"}}
    doc["deck"]["players"] = players + ([stranger] if stranger else [])
    if declare:
        doc["deck"]["assets"] = OFFLINE
    doc["pages"].insert(next(i for i, p in enumerate(doc["pages"]) if p.get("id") == "p03"), {**table, "id": "p02b"})
    file = work / "page-types.pages.json"
    file.write_text(json.dumps(doc), encoding="utf-8")
    return file, players


class OfflineAssetsTests(unittest.TestCase):
    """Item 3: the players floor under a declared offline build, at the compile as at the build."""

    def test_the_asset_statement_is_printed_on_a_refused_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            def unbind(doc):
                page_of(doc, "f1")["title"] = "Loans grew {{A-loans/no-such-measure | 0%}} in seven years"
            refused = run(AUTHOR, stage(tmp, "finance", unbind), "--check")
            self.assertEqual(refused.returncode, 2)
            self.assertTrue(refused.stderr.startswith("Assets: the build will fetch from the network - logos: Harbour, Northgate"), refused.stderr[:300])
            self.assertLess(refused.stderr.index('"assets": { "fetch": "none"'), refused.stderr.index("The deck is not ready"))
        with tempfile.TemporaryDirectory() as tmp:
            def declare(doc):
                doc["deck"]["assets"] = OFFLINE
            checked = run(AUTHOR, stage(tmp, "finance", declare), "--check")
            self.assertEqual(checked.returncode, 0, checked.stderr[-800:])
            summary = json.loads(checked.stdout)
            self.assertEqual([summary["assets"]["fetch"], len(summary["assets"]["notAvailable"]["logos"])], ["none", 8])
            self.assertIn("ASSETS_OFFLINE", summary["advisories"])
            self.assertTrue(checked.stderr.startswith("Assets: the deck is built without the network"))

    def test_the_compile_decides_the_players_floor_as_the_build_does_under_the_declaration(self):
        result = run_node(PLAYERS + '''
const tell = async (doc) => { const run = await authorDeck(doc, { baseDir: dir, fit: false });
  const at = (list) => { const f = list.find((x) => x.code === 'CRAFT_PLAYERS_UNINTRODUCED'); return f ? { severity: f.severity, class: f.class, pending: Boolean(f.pending), assets: f.measured?.assets ?? null, unnamed: f.measured?.unnamed ?? null } : null; };
  return { blocking: at(run.blocking), advised: at(run.advisories), line: run.standings.find((s) => s.code === 'CRAFT_PLAYERS_UNINTRODUCED').line, codes: run.blocking.map((f) => f.code),
    assets: run.advisories.filter((f) => /^ASSETS_/.test(f.code)).map((f) => [f.code, f.class, f.severity]), statement: run.assets?.fetch }; };
const waiting = await tell(named);
const declared = structuredClone(named); declared.deck.assets = { fetch: 'none', reason: 'The build machine has no network access and no logo files were supplied' };
const offline = await tell(declared);
const stranger = structuredClone(declared); stranger.deck.players = [...players, 'Zennor Mutual'];
const unnamed = await tell(stranger);
fs.rmSync(dir, { recursive: true, force: true });
console.log(JSON.stringify({ waiting, offline, unnamed }));
''')
        # With nothing declared the compile cannot know what the build will fetch: reported, and decided at the render.
        self.assertIsNone(result["waiting"]["blocking"])
        self.assertEqual(result["waiting"]["advised"], {"severity": "advisory", "class": "G", "pending": True, "assets": None, "unnamed": None})
        self.assertEqual(result["waiting"]["assets"], [["ASSETS_NEEDED", "S", "advisory"]])
        self.assertIn("player logos drawn 0; floor 1: short by 1 logos - advisory", result["waiting"]["line"])
        self.assertNotIn("PLAYERS_UNMARKED", result["waiting"]["codes"])   # every player is introduced by its mark on a page
        # Declared offline, nothing waits: every player is named on a page, so the floor advises, here as at the build.
        self.assertIsNone(result["offline"]["blocking"])
        self.assertEqual(result["offline"]["advised"], {"severity": "advisory", "class": "G", "pending": False, "assets": "none", "unnamed": None})
        self.assertIn("player logos drawn 0; floor 1: short by 1 logos - advisory", result["offline"]["line"])
        self.assertEqual([result["offline"]["assets"], result["offline"]["statement"]], [[["ASSETS_OFFLINE", "S", "advisory"]], "none"])
        # A player named on no page still blocks, at the compile: no build will fetch its mark.
        self.assertEqual(result["unnamed"]["blocking"], {"severity": "blocker", "class": "G", "pending": False, "assets": "none", "unnamed": ["Zennor Mutual"]})
        self.assertIn("short by 1 logos - BLOCKS", result["unnamed"]["line"])


@unittest.skipUnless(os.environ.get("PS_RUN_SLOW") == "1", "opt-in: set PS_RUN_SLOW=1 or pass --slow")
@unittest.skipUnless(NODE and HAS_RENDERER, "needs Node.js, LibreOffice (soffice) and pdftoppm on PATH")
@requires_python_package("pptx", "PIL", "numpy")
class OfflineRenderTests(unittest.TestCase):
    """Item 3, rendered: `--check --render` and `build-deck --no-fetch` say the same of the players floor."""

    def test_the_rendered_check_and_the_build_agree_under_the_declaration(self):
        with tempfile.TemporaryDirectory() as tmp:
            file, players = players_deck(tmp)
            checked = run(AUTHOR, file, "--check", "--render")
            self.assertEqual(checked.returncode, 0, checked.stderr[-1500:])
            summary = json.loads(checked.stdout)
            self.assertEqual(summary["render"]["blockers"], 0)
            self.assertEqual(summary["assets"]["fetch"], "none")
            self.assertIn("CRAFT_PLAYERS_UNINTRODUCED", summary["advisories"])
            self.assertTrue(log_of(file)[-1]["render"])
            self.assertEqual(run(AUTHOR, file).returncode, 0)
            built = run(BUILD, file.parent / "page-types.deck.json", file.parent / "out", "--no-fetch")
            result = json.loads((file.parent / "out" / "build-result.json").read_text(encoding="utf-8"))
            self.assertEqual([built.returncode, result["status"], [b["code"] for b in result.get("blockers", [])]], [0, "built", []])
            self.assertEqual([result["assets"]["fetch"], result["assets"]["notAvailable"]["logos"]], ["none", players])
        with tempfile.TemporaryDirectory() as tmp:
            file, _ = players_deck(tmp, stranger="Zennor Mutual")
            checked = run(AUTHOR, file, "--check", "--render")
            self.assertEqual(checked.returncode, 2)
            self.assertTrue(checked.stderr.startswith("Assets: the deck is built without the network"))
            refusal = checked.stderr.split("Where the deck stands:")[0]
            # A player with no logo cell and no name on a page: the structure rule names it, and so does the floor, at the compile.
            self.assertIn("(S 2, G 1)", refusal)
            self.assertIn('PLAYERS_UNMARKED  {"players":', refusal.split("G. Deck aggregates")[0])
            self.assertIn("Zennor Mutual is named on no page", refusal.split("G. Deck aggregates")[1])
            # The note for a floor that waits on a fetch is not said of a deck that declares it fetches nothing.
            self.assertNotIn("This check fetches nothing", refusal)
            # The build refuses the same deck before it renders, and the check says so.
            self.assertIn("Not rendered: the build refuses the deck before it renders (VARIETY_REJECTED)", checked.stderr)


class BoundPagesTests(unittest.TestCase):
    """Item 4: a page that names its measures, through every other stream's machinery."""

    def test_the_fit_search_offers_a_bound_page_alternatives_that_pass_and_stay_bound(self):
        result = run_node(PROBE + MISFIT + '''
const doc = load('finance'); misfit(doc);
const first = await author('finance', doc);
const finding = first.blocking.find((f) => f.id === 'f6' && f.alternatives);
const choice = finding?.alternatives.pass.find((c) => c.form === 'indexed' && c.commentary === 'beside');
// The alternative taken into the page as written: the exhibit is untouched, so it still names its measures.
const taken = structuredClone(doc); Object.assign(page(taken, 'f6'), choice ?? {});
const second = await author('finance', taken);
const slide = second.spec.slides.find((s) => s.id === 'f6');
console.log(JSON.stringify({ codes: first.blocking.filter((f) => f.id === 'f6').map((f) => f.code), pass: finding?.alternatives.pass ?? [], fail: finding?.alternatives.fail.length,
  needs: (finding?.alternatives.needs ?? []).flatMap((n) => n.choices.map((c) => c.form)), authored: page(taken, 'f6').exhibit.series.map((s) => [s.measure, s.values === undefined]),
  after: second.blocking.filter((f) => f.id === 'f6').map((f) => f.code), basis: slide?.pageType.dependencies.exhibits[0].measures, values: slide?.exhibit.series.map((s) => s.values.length) }));
''')
        self.assertEqual(result["codes"], ["SCENE_VOID"])
        self.assertIn({"form": "indexed", "commentary": "beside"}, result["pass"])
        self.assertIn({"form": "line", "commentary": "beside"}, result["pass"])
        # A form the measures cannot fill is not offered as passing.
        self.assertIn("stacked-column", result["needs"])
        self.assertEqual(result["after"], [])
        self.assertEqual(result["authored"], [[f"A-index/{name}", True] for name in ("loans", "liquid", "short-liabilities", "ocf")])
        self.assertEqual(result["basis"], ["A-index/loans", "A-index/liquid", "A-index/short-liabilities", "A-index/ocf"])
        self.assertEqual(result["values"], [8, 8, 8, 8])

    def test_the_plan_allocates_a_spine_whose_pages_will_be_bound(self):
        with tempfile.TemporaryDirectory() as tmp:
            def spine(doc):
                for page in doc["pages"]:
                    page.pop("form", None)
                    page.pop("commentary", None)
            planned = run(AUTHOR, stage(tmp, "finance", spine), "--plan")
            self.assertEqual(planned.returncode, 0, planned.stderr[-800:])
            plan = json.loads(planned.stdout)["plan"]
            self.assertTrue(plan["satisfied"])
            self.assertEqual(len(plan["pages"]), 7)
            self.assertTrue(all(row.endswith(" proposed") or "(reads its own data)" in row for row in plan["pages"]))
            # A plan is logged as a plan, never as a compile run: `--log` counts it beside them.
            logged = [json.loads(line) for line in (Path(tmp) / "finance.author-log.jsonl").read_text().splitlines()]
            self.assertEqual([(entry["mode"], entry["ok"]) for entry in logged], [("plan", True)])
            cost = json.loads(run(AUTHOR, str(Path(tmp) / "finance.pages.json"), "--log").stdout)
            self.assertEqual([cost["runs"], cost["plans"]], [0, {"runs": 1, "refused": 0}])
            self.assertIn("Not counted", cost["counted"])

    def test_a_bound_page_in_a_part_is_checked_alone_and_names_its_part(self):
        with tempfile.TemporaryDirectory() as tmp:
            part = Path(tmp) / "pages" / "funding.pages.json"
            part.parent.mkdir()

            def split(doc):
                moved = [page_of(doc, "f2"), page_of(doc, "f6")]
                doc["pages"] = [p for p in doc["pages"] if p not in moved] + [{"include": "pages/funding.pages.json"}]
                part.write_text(json.dumps({"pages": moved}), encoding="utf-8")
            file = stage(tmp, "finance", split)
            whole = run(AUTHOR, file, "--check")
            self.assertEqual(whole.returncode, 0, whole.stderr[-800:])
            self.assertEqual(json.loads(whole.stdout)["pages"], 7)
            alone = run(AUTHOR, file, "--check", "--page", "f6")
            self.assertEqual(alone.returncode, 0, alone.stderr[-800:])
            self.assertEqual(list(json.loads(alone.stdout)["pages"]), ["f6"])
            # A reference in the part that does not bind: the page run refuses it, in its class, and names the part to edit.
            pages = json.loads(part.read_text(encoding="utf-8"))
            pages["pages"][1]["exhibit"]["series"][3]["measure"] = "A-index/cashflow"
            part.write_text(json.dumps(pages), encoding="utf-8")
            broken = run(AUTHOR, file, "--check", "--page", "f6")
            self.assertEqual(broken.returncode, 2)
            self.assertIn("1 finding to fix in finance.pages.json (P 1)", broken.stderr)
            self.assertIn("BINDING_UNRESOLVED [f6 in pages/funding.pages.json]", broken.stderr)
            self.assertIn('names "A-index/cashflow", which the insight log\'s measures do not hold', broken.stderr)
            # Another worker's page run is not refused by it.
            self.assertEqual(run(AUTHOR, file, "--check", "--page", "f3").returncode, 0)
            entries = log_of(file)
            self.assertEqual([(e["mode"], e.get("named"), e["pages"], e["ok"]) for e in entries], [("check", None, 7, True), ("page", ["f6"], 7, True), ("page", ["f6"], 7, False), ("page", ["f3"], 7, True)])
            self.assertEqual(entries[2]["findings"], [{"code": "BINDING_UNRESOLVED", "class": "P", "id": "f6", "message": entries[2]["findings"][0]["message"]}])

    def test_a_page_run_lists_its_own_untraced_numbers(self):
        with tempfile.TemporaryDirectory() as tmp:
            def typed(doc):
                page_of(doc, "f3")["bar"] = "The cushion fell to 8 million while short-term liabilities reached 123.4 million, so funding comes before further lending"
            file = stage(tmp, "finance", typed)
            mine = json.loads(run(AUTHOR, file, "--check", "--page", "f3").stdout)
            self.assertEqual(mine["untracedNumbers"], {"f3": ["bar: 123.4 million"]})
            self.assertIn("NUMBER_UNTRACED [f3]", mine["advisories"])
            other = json.loads(run(AUTHOR, file, "--check", "--page", "f4").stdout)
            self.assertNotIn("untracedNumbers", other)
            self.assertFalse([line for line in other["advisories"] if "[f3]" in line])
            self.assertEqual(list(json.loads(run(AUTHOR, file, "--check").stdout)["untracedNumbers"]), ["f3"])

    def test_a_scaffold_is_bound_and_closes_on_its_limits(self):
        with tempfile.TemporaryDirectory() as tmp:
            scaffold = run(AUTHOR, stage(tmp, "finance"), "--scaffold", "trend", "--evidence", "i-loans")
            self.assertEqual(scaffold.returncode, 0, scaffold.stderr)
            page = json.loads(scaffold.stdout)
            self.assertEqual(page["exhibit"]["series"], [{"measure": "i-loans/loans", "name": "loans"}])
            self.assertNotIn("categories", page["exhibit"])
            self.assertEqual(page["settles"], {"measures": ["i-loans/loans"]})
            self.assertEqual(list(page)[-1], "limits")
            self.assertEqual([page["limits"]["type"], page["limits"]["form"], page["limits"]["title"]["words"]["max"]], ["trend", "line", 15])
            # Pasted whole, limits block and all, the scaffold compiles and binds.
            result = run_node(PROBE + f'''
const doc = load('finance');
const scaffold = {json.dumps(page)};
doc.pages.push({{ ...scaffold, id: 'f9', title: 'Loans have grown in every year since FY19 without a pause', why: 'The loan book over eight years, as recorded' }});
const run = await author('finance', doc, {{ fit: false }});
console.log(JSON.stringify({{ mine: run.blocking.filter((f) => f.id === 'f9' && ['COMPILE', 'BINDING_UNRESOLVED'].includes(f.code)).length, values: run.spec.slides.find((s) => s.id === 'f9')?.exhibit.series[0].values.length }}));
''')
            self.assertEqual(result, {"mine": 0, "values": 8})


# A fixture staged with a ready spine critique: its insight log and analysis plan beside the compiled deck.
STORY = f'''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
import {{ compileDeck, readInsights }} from './skills/professional-slides/runtime/author-deck.mjs';
import {{ alternativesOf }} from './skills/professional-slides/runtime/analysis.mjs';
const FIX = '{FIXTURES}';
async function staged(name) {{
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'streams-story-'));
  const out = path.join(dir, 'out'); await fs.mkdir(out);
  for (const file of [`${{name}}.insights.json`, `${{name}}.analysis.json`]) await fs.copyFile(path.join(FIX, file), path.join(dir, file));
  const log = JSON.parse(await fs.readFile(path.join(dir, `${{name}}.insights.json`), 'utf8'));
  await fs.mkdir(path.join(dir, 'sources'));
  for (const item of log.insights) for (const file of item.sources) await fs.writeFile(path.join(dir, file), 'illustrative');
  const doc = JSON.parse(await fs.readFile(path.join(FIX, `${{name}}.pages.json`), 'utf8'));
  const specPath = path.join(dir, `${{name}}.deck.json`);
  const write = async (mutate = null) => {{
    const edited = structuredClone(doc); if (mutate) mutate(edited);
    const insights = await readInsights(dir, name, {{ alternatives: alternativesOf(edited.deck) }});
    const {{ spec, bindingFindings }} = compileDeck(edited, {{ insights, partial: true }});
    await fs.writeFile(specPath, JSON.stringify(spec));
    return {{ spec, unbound: bindingFindings.map((f) => f.id) }};
  }};
  return {{ dir, out, specPath, write, logPath: path.join(dir, `${{name}}.insights.json`), log, first: await write() }};
}}
const ready = (packet, ids) => ({{ pass: 1, verifies: null, verdict: 'ready', rating: 8, binding: packet.binding, summary: 'The answer is sharp and the pillars hold on the evidence the spine names.',
  compliance: {{ verdict: 'complete', note: 'Judged against what the evidence in scope allows.' }}, sufficiency: {{ verdict: 'sufficient', note: 'Judged against the answer as it is stated.' }},
  provenance: {{ backend: 'subagent', model: 'fixture', promptHash: packet.promptHash }},
  spine: 'Read alone, the titles build from the growth of the loan book to what it now draws on.', answer: 'Growth is faster than the peers on thinner liquidity; funding comes first.',
  answerParts: [{{ part: 'Is the growth safe', verdict: 'answered', missingEvidence: '' }}, {{ part: 'How does it compare with its peers', verdict: 'answered', missingEvidence: '' }}],
  pillars: [{{ pillar: 'Growth on thinner liquidity', pages: ids, verdict: 'holds', overlap: 'One pillar; nothing overlaps.', strongestCounter: 'The cushion may rebuild as loans season.', reversal: 'Liquid assets above short-term liabilities by the old margin.', answered: true }}],
  numbers: 'The figures agree across the pages that print them.', sectionFlow: 'One section, opened and closed in order.', execSummary: 'The summary page states the answer and its proof.',
  missingAnalyses: [], cutOrMerge: [], findings: [], topFixes: ['None material'],
  completeness: S.STORYLINE_DIMENSIONS.map((check) => ({{ check, result: 'clean', note: `Checked ${{check}} across the spine and found nothing to raise.` }})) }});
const page = (d, id) => d.pages.find((p) => p.id === id);
'''


class BoundArgumentTests(unittest.TestCase):
    """Item 4, the storyline: what a bound page shows is the argument, and how it is drawn is not."""

    def test_a_bound_exhibit_is_what_the_page_shows_and_redrawing_it_keeps_a_ready_critique(self):
        result = run_node(STORY + '''
const deck = await staged('finance');
const one = await S.prepareStoryline(deck.specPath, deck.out);
const packet = JSON.parse(await fs.readFile(path.join(one.dir, 'packet.json'), 'utf8'));
const ids = packet.pages.filter((p) => p.kind === 'content').map((p) => p.id);
await fs.writeFile(path.join(deck.out, 'storyline-review.json'), JSON.stringify(ready(packet, ids)));
const settled = await S.prepareStoryline(deck.specPath, deck.out);
const gate = async (written) => S.storylineGate(written.spec, deck.out, { deckPath: deck.specPath });
// A layout repair of the bound exhibit: the same measures, drawn as a column chart with the bar reworded.
const redrawn = await deck.write((d) => { const f3 = page(d, 'f3'); f3.form = 'column'; f3.bar = f3.bar.replace('funding', 'new funding'); });
const kept = await gate(redrawn);
// A metric bound to another measure is another argument.
const rebound = await gate(await deck.write((d) => { page(d, 'f2').metrics.find((m) => m.measure === 'A-ocf/percent').measure = 'A-earn/percent'; }));
// The number a token prints is part of the title: a changed record changes the title the critique read.
const loans = deck.log.insights.find((item) => item.id === 'i-loans').measures.loans;
await fs.writeFile(deck.logPath, JSON.stringify({ ...deck.log, insights: deck.log.insights.map((item) => item.id === 'i-loans' ? { ...item, measures: { ...item.measures, loans: { ...loans, values: loans.values.map((v, i) => (i === loans.values.length - 1 ? v + 25 : v)) } } } : item) }));
const moved = await deck.write();
const retitled = await gate(moved);
await fs.writeFile(deck.logPath, JSON.stringify(deck.log));
const restored = await gate(await deck.write());
const f1 = (spec) => spec.slides.find((s) => s.id === 'f1').title;
const shown = (id) => packet.pages.find((p) => p.id === id).measures.map((m) => [m.ref, m.role]);
if (packet.staging) await fs.rm(packet.staging, { recursive: true, force: true });
await fs.rm(deck.dir, { recursive: true, force: true });
console.log(JSON.stringify({ unbound: deck.first.unbound, status: [one.status, settled.status], titles: [f1(deck.first.spec), packet.pages.find((p) => p.id === 'f1').title, f1(moved.spec)],
  f6: shown('f6'), f2: shown('f2'), form: redrawn.spec.slides.find((s) => s.id === 'f3').pageType.form, kept, rebound, retitled, restored }));
''')
        self.assertEqual(result["unbound"], [])
        self.assertEqual(result["status"], ["packet-written", "ready"])
        # The token is written out before the title is read: the critic, and the binding, see the number.
        self.assertEqual(result["titles"][0], result["titles"][1])
        self.assertNotIn("{{", result["titles"][0])
        self.assertRegex(result["titles"][0], r"^Loans grew \d+% in seven years to \d+ million$")
        self.assertNotEqual(result["titles"][2], result["titles"][0])
        # A bound exhibit's measures, and a bound metric's, are what the page shows.
        self.assertEqual(result["f6"], [[f"A-index/{name}", "proof"] for name in ("loans", "liquid", "short-liabilities", "ocf")])
        self.assertIn(["A-ocf/percent", "proof"], result["f2"])
        self.assertEqual([result["form"], result["kept"]], ["column", []])
        for changed, pages in (("rebound", "f2"), ("retitled", "f0, f1, f6")):
            self.assertEqual(len(result[changed]), 1, changed)
            self.assertIn(f"the spine changed after the storyline critique ({pages}: a title,", result[changed][0], changed)
        self.assertEqual(result["restored"], [])


class WorkedFormsTests(unittest.TestCase):
    """Item 6: the worked page of every form, under the compile that now runs the build's own page-local checks."""

    def test_every_worked_form_page_is_clean_page_by_page_and_untraced_without_an_insight_log(self):
        # The forms file is a catalogue, not a deck: as one deck its structure and aggregates are refused, which is
        # the point of reading them apart - no page of it has a page-local finding, and with no insight log beside
        # it nothing is held to a measure or traced.
        result = run_node('''
import path from 'node:path';
import { authorDeck, workedExamples } from './skills/professional-slides/runtime/author-deck.mjs';
import { readPagesFile } from './skills/professional-slides/runtime/pages-file.mjs';
import { PAGE_TYPES } from './skills/professional-slides/runtime/page-types.mjs';
const dir = path.resolve('skills/professional-slides/examples');
const doc = await readPagesFile(path.join(dir, 'page-forms.pages.json'));
const run = await authorDeck(doc, { baseDir: dir, insights: null });
const worked = new Set(workedExamples().pages.filter((p) => p.type).map((p) => `${p.type}/${p.form}`));
console.log(JSON.stringify({ pages: doc.pages.length, composed: run.complete, local: run.blocking.filter((f) => f.class === 'P').map((f) => `${f.code} ${f.id}`),
  classes: [...new Set(run.blocking.map((f) => f.class))].sort(), evidence: run.advisories.filter((f) => /^(NUMBER_UNTRACED|BINDING_|BASIS_|CLAIM_MEASURES|PROOF_)/.test(f.code)).length,
  unworked: Object.entries(PAGE_TYPES).flatMap(([type, t]) => Object.keys(t.forms).map((form) => `${type}/${form}`)).filter((key) => !worked.has(key)) }));
''')
        self.assertGreater(result["pages"], 30)
        self.assertTrue(result["composed"])
        self.assertEqual(result["local"], [])
        self.assertEqual(result["classes"], ["G", "S"])
        self.assertEqual(result["evidence"], 0)
        self.assertEqual(result["unworked"], [])


def split_public_ops(tmp):
    """`public-ops` with its pages and its insight log both in parts: the pages file, and the two part files' paths."""
    work = Path(tmp)
    (work / "pages").mkdir()
    (work / "insights").mkdir()

    def split(doc):
        (work / "pages" / "crews.pages.json").write_text(json.dumps({"pages": doc["pages"][3:]}), encoding="utf-8")
        doc["pages"] = doc["pages"][:3] + [{"include": "pages/crews.pages.json"}]
    file = stage(tmp, "public-ops", split)
    log = json.loads((work / "public-ops.insights.json").read_text(encoding="utf-8"))
    (work / "insights" / "districts.json").write_text(json.dumps({"insights": log["insights"][3:]}), encoding="utf-8")
    (work / "public-ops.insights.json").write_text(json.dumps({**log, "insights": log["insights"][:3], "include": ["insights/districts.json"]}), encoding="utf-8")
    (work / "sources").mkdir()
    for item in log["insights"]:
        for source in item.get("sources", []):
            (work / source).write_text("illustrative fixture data\n", encoding="utf-8")
    return file


class PartsEverywhereTests(unittest.TestCase):
    """Item 5: a pages file in parts and an insight log in parts are one deck to every reader."""

    def test_the_compile_the_analyses_and_the_storyline_read_both_kinds_of_parts(self):
        # The fixture is an evidence fixture, not a finished deck: its mechanism page is too thin for its frame, so its
        # check is refused. Whole or in parts, it is refused for the same findings.
        found = lambda file: sorted((f["code"], f.get("id")) for f in log_of(file)[-1]["findings"])
        with tempfile.TemporaryDirectory() as whole_dir, tempfile.TemporaryDirectory() as tmp:
            whole = stage(whole_dir, "public-ops")
            unsplit = run(AUTHOR, whole, "--check")
            catalogue = json.loads(run(ANALYSIS, whole, "--catalogue").stdout)["catalogue"]
            file = split_public_ops(tmp)
            checked = run(AUTHOR, file, "--check")
            self.assertEqual([checked.returncode, unsplit.returncode], [2, 2])
            self.assertEqual(found(file), found(whole))
            self.assertIn(("TEXT_COVERAGE_LOW", "o5"), found(file))
            self.assertEqual(checked.stderr.split("Where the deck stands:")[1].split("Page budgets:")[0], unsplit.stderr.split("Where the deck stands:")[1].split("Page budgets:")[0])
            # A finding on a page that came from a part names the part; one on a page of the root file does not.
            self.assertIn("TEXT_COVERAGE_LOW [o5 in pages/crews.pages.json]", checked.stderr)
            self.assertNotIn("TEXT_COVERAGE_LOW [o5 in", unsplit.stderr)
            # The analysis CLI: the catalogue and the run, over the merged log.
            listed = run(ANALYSIS, file, "--catalogue")
            self.assertEqual(listed.returncode, 0, listed.stderr)
            self.assertEqual(json.loads(listed.stdout)["catalogue"], catalogue)
            self.assertEqual(run(ANALYSIS, file).returncode, 0)
            results = json.loads((Path(tmp) / "public-ops.analysis-results.json").read_text(encoding="utf-8"))["results"]
            self.assertEqual(sorted(r["id"] for r in results), sorted(a["id"] for a in json.loads((Path(tmp) / "public-ops.analysis.json").read_text(encoding="utf-8"))["analyses"]))
            # The bound scenario page, inside a part, resting on an insight recorded in a part of the log: clean on its own page run.
            alone = run(AUTHOR, file, "--check", "--page", "o6")
            self.assertEqual(alone.returncode, 0, alone.stderr[-800:])
            self.assertEqual(list(json.loads(alone.stdout)["pages"]), ["o6"])
            # The storyline reads the deck compiled from the parts, the merged log beside it and the closed scope.
            result = run_node(f'''
import fs from 'node:fs/promises'; import path from 'node:path';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
import {{ compileDeck, readInsights }} from './skills/professional-slides/runtime/author-deck.mjs';
import {{ readPagesFile }} from './skills/professional-slides/runtime/pages-file.mjs';
const dir = {json.dumps(tmp)};
const doc = await readPagesFile(path.join(dir, 'public-ops.pages.json'));
const {{ spec, bindingFindings, compileErrors }} = compileDeck(doc, {{ insights: await readInsights(dir, 'public-ops'), partial: true }});
await fs.writeFile(path.join(dir, 'public-ops.deck.json'), JSON.stringify(spec));
const step = await S.prepareStoryline(path.join(dir, 'public-ops.deck.json'), path.join(dir, 'out'));
const packet = JSON.parse(await fs.readFile(path.join(step.dir, 'packet.json'), 'utf8'));
const prompt = await fs.readFile(path.join(step.dir, 'prompt.md'), 'utf8');
await fs.rm(step.dir, {{ recursive: true, force: true }});
const o6 = packet.pages.find((p) => p.id === 'o6'), o4 = packet.pages.find((p) => p.id === 'o4');
console.log(JSON.stringify({{ refused: [...bindingFindings, ...compileErrors].length, status: step.status, pages: packet.pages.map((p) => p.id), o6: o6.measures.map((m) => m.ref), o4: o4.evidence.map((e) => [e.id, Boolean(e.missing)]),
  closed: prompt.includes('only the board papers supplied by the service may be used') }}));
''')
            self.assertEqual([result["refused"], result["status"], result["pages"]], [0, "packet-written", ["o0", "o1", "o2", "o3", "o5", "o6", "o4", "o7"]])
            # The scenario's path, joined to the recorded series in one bound line, is what the page shows.
            self.assertIn("B-path/path", result["o6"])
            # An insight recorded in a part of the log is found by the page that rests on it.
            self.assertEqual(result["o4"], [["o-districts", False], ["B-districts", False], ["o-standard", False]])
            self.assertTrue(result["closed"])
            # The run log counts each kind of run, and `--log` reads it as the run cost.
            # The draft passes - the spine states its question and opens on its summary - and the full compile is refused for the thin mechanism page.
            self.assertEqual([run(AUTHOR, file, "--draft", "--check").returncode, run(AUTHOR, file).returncode], [0, 2])
            cost = json.loads(run(AUTHOR, file, "--log").stdout)
            self.assertEqual([cost["runs"], cost["refused"], cost["pages"], cost["runsPerPage"]], [4, 2, 8, 0.5])
            self.assertEqual(cost["modes"], {"check": {"runs": 1, "refused": 1}, "page": {"runs": 1, "refused": 0}, "draft": {"runs": 1, "refused": 0}, "full": {"runs": 1, "refused": 1}})
            self.assertEqual(cost["refusalsByPage"]["o5"]["runs"], 2)
            self.assertNotIn("note", cost)
            self.assertTrue(all(entry["v"] == 2 for entry in log_of(file)))
            self.assertFalse((Path(tmp) / "public-ops.plan.json").exists())

    def test_an_id_written_twice_across_the_parts_is_refused_by_each_reader(self):
        with tempfile.TemporaryDirectory() as tmp:
            file = split_public_ops(tmp)
            part = Path(tmp) / "insights" / "districts.json"
            log = json.loads(part.read_text(encoding="utf-8"))
            root = json.loads((Path(tmp) / "public-ops.insights.json").read_text(encoding="utf-8"))
            log["insights"].append(root["insights"][0])
            part.write_text(json.dumps(log), encoding="utf-8")
            twice = f'{root["insights"][0]["id"]} is recorded in public-ops.insights.json and in insights/districts.json'
            for refused in (run(AUTHOR, file, "--check"), run(ANALYSIS, file, "--catalogue")):
                self.assertEqual(refused.returncode, 2)
                self.assertIn(twice, refused.stderr)

    def test_the_evals_scripts_read_a_pages_file_in_parts(self):
        with tempfile.TemporaryDirectory() as whole_dir, tempfile.TemporaryDirectory() as tmp:
            probe = "import json, sys; sys.path.insert(0, sys.argv[1]); import reference_census; print(json.dumps(reference_census.pages_file_values(__import__('pathlib').Path(sys.argv[2]))))"
            counted = [json.loads(subprocess.run([sys.executable, "-c", probe, str(ROOT / "evals" / "scripts"), str(file)], capture_output=True, text=True, check=True).stdout)
                       for file in (stage(whole_dir, "public-ops"), split_public_ops(tmp))]
            self.assertEqual(counted[1], counted[0])
            self.assertIn("o4", counted[0])


if __name__ == "__main__":
    unittest.main()
