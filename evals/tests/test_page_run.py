"""A page run: the pages a writer names, compiled, composed and gated in the deck's context, and nothing else.

Writers check their own sections side by side, on decks of fifty to a hundred
pages. A page run once compiled, composed and gated the whole deck: it cost
what the deck cost, printed every deck-wide finding to every section, whose
agent then chased codes that were not its own, and rendered nothing while a
page anywhere else did not compose. These hold a page run to its pages
(runtime/page-run.mjs):

* of the pages it names it reports what the whole-deck run reports of them:
  every page-local finding, and the rules that read a page against its
  neighbours as they declare themselves - a run of one type, a claim two
  pages make, a number printed two ways - in a draft as in a check;
* the deck's other rules are the whole-deck run's, said in one line;
* its cost is its pages': on a deck of six pages or of sixty it composes the
  pages it names among the deck's structural pages, and they print the
  places they hold in the deck;
* its render, and the record a section review reads, stand while another
  section's page does not compile.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import HAS_RENDERER, NODE, ROOT, SKILL, requires_python_package, run_node

AUTHOR = SKILL / "runtime" / "author-deck.mjs"
SECTION_REVIEW = SKILL / "runtime" / "section-review.mjs"
EXAMPLES = SKILL / "examples"
FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"


def cli(*args, script=AUTHOR, timeout=900):
    return subprocess.run([NODE, str(script), *map(str, args)], cwd=ROOT, capture_output=True, text=True, timeout=timeout,
                          env={**os.environ, "RUNTIME_NODE_MODULES": str(ROOT / "node_modules")})


# The worked deck of every page type in a folder of its own, with what a deck mid-writing carries planted in it: a run of
# three pages of one type whose third does not compile, a page whose panels leave a band empty, two pages that make one
# claim, a share drawn as two bars, and a page that has lost its exhibit.
STAGE = '''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { authorDeck, readInsights } from './skills/professional-slides/runtime/author-deck.mjs';
import { heldOnPageRun } from './skills/professional-slides/runtime/page-run.mjs';
import { pagesOf } from './skills/professional-slides/runtime/deck-report.mjs';
import { alternativesOf } from './skills/professional-slides/runtime/analysis.mjs';
const examples = path.resolve('skills/professional-slides/examples');
const worked = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-run-'));
  fs.cpSync(path.join(examples, 'assets'), path.join(dir, 'assets'), { recursive: true });
  return { dir, doc: JSON.parse(fs.readFileSync(path.join(examples, 'page-types.pages.json'), 'utf8')) };
};
const page = (doc, id) => doc.pages.find((p) => p.id === id);
const plant = (doc) => {
  const moved = page(doc, 'p03c');
  doc.pages.splice(doc.pages.indexOf(moved), 1);
  doc.pages.splice(doc.pages.indexOf(page(doc, 'p03b')) + 1, 0, moved);
  delete moved.bar;
  page(doc, 'p10').form = 'stack';
  page(doc, 'p06').title = page(doc, 'p05').title;
  page(doc, 'p26').exhibit = { type: 'chart.column', heading: 'Journeys by time of day, FY26', unit: '% of journeys', categories: ['Peak', 'Off-peak'], series: [{ name: 'Share', values: [38, 62] }] };
  delete page(doc, 'p12').exhibit;
  return doc;
};
// What a run says of `named` that a page run holds: each finding by its code, whether it blocks, and the named pages it names.
const said = (run, named) => [...run.blocking.map((f) => ({ ...f, holds: 'blocks' })), ...run.advisories.map((f) => ({ ...f, holds: 'advises' }))]
  .filter((f) => heldOnPageRun(f) && pagesOf(f).some((id) => named.has(id)))
  .map((f) => `${f.code} ${f.holds} ${pagesOf(f).filter((id) => named.has(id)).join(',')}`).sort();
// The deck's sections, each the pages between two dividers: what one writer checks.
const sections = (doc) => { const out = []; let at = [];
  for (const p of [...doc.pages, ...(doc.appendix || [])]) { if (p?.kind === 'section') { if (at.length) out.push(at); at = []; } else if (p?.id) at.push(String(p.id)); }
  return at.length ? [...out, at] : out; };
// Every section's page run against the whole-deck run: what either says that the other does not, and every finding compared.
const compare = async (doc, options, groups = sections(doc)) => {
  const whole = await authorDeck(doc, { ...options, fit: false });
  const differ = [], compared = [];
  for (const ids of groups) {
    const named = new Set(ids);
    const run = await authorDeck(doc, { ...options, fit: false, pages: named });
    const a = said(whole, named), b = said(run, named);
    compared.push(...a);
    if (JSON.stringify(a) !== JSON.stringify(b)) differ.push({ ids, whole: a.filter((x) => !b.includes(x)), page: b.filter((x) => !a.includes(x)) });
  }
  return { differ, codes: [...new Set(compared.map((line) => line.split(' ')[0]))].sort(), compared: compared.length };
};
'''


@unittest.skipUnless(NODE, "Node.js is not available")
class EquivalenceTests(unittest.TestCase):
    def test_a_section_run_reports_what_the_whole_deck_run_reports_of_its_pages(self):
        result = run_node(STAGE + '''
const { dir, doc } = worked();
const check = await compare(plant(structuredClone(doc)), { baseDir: dir });
const draft = await compare(plant(structuredClone(doc)), { baseDir: dir, draft: true });
console.log(JSON.stringify({ check, draft }));
''')
        for mode in ("check", "draft"):
            self.assertEqual(result[mode]["differ"], [], mode)
        # Every kind of finding a page run holds is among those compared: a compile refusal and an empty band of its own, a
        # run of one type read off its neighbours' declared types, a claim another page makes too.
        self.assertTrue({"COMPILE", "SCENE_VOID", "VARIETY_TYPE_RUN", "CONTENT_CLAIM_REPEATS"} <= set(result["check"]["codes"]), result["check"]["codes"])
        self.assertGreaterEqual(result["check"]["compared"], 10)

    def test_a_page_run_on_a_deck_bound_to_its_insight_log_reports_what_the_whole_deck_run_does(self):
        # Each page alone, on decks whose exhibits and figures are written out of the insight log, where the numbers the
        # pages state between them are read off every page's declarations and the log.
        result = run_node(STAGE + '''
const FIX = path.resolve('evals/quality/fixtures/evidence');
const out = {};
for (const name of ['finance', 'public-ops']) {
  const doc = JSON.parse(fs.readFileSync(path.join(FIX, `${name}.pages.json`), 'utf8'));
  const insights = await readInsights(FIX, name, { alternatives: alternativesOf(doc.deck) });
  const ids = [...doc.pages, ...(doc.appendix || [])].filter((p) => p?.id && !p.kind).map((p) => [String(p.id)]);
  out[name] = await compare(doc, { baseDir: FIX, insights }, ids);
}
console.log(JSON.stringify(out));
''')
        for name, found in result.items():
            self.assertEqual(found["differ"], [], name)
            self.assertGreater(found["compared"], 0, name)

    def test_the_numbers_and_proofs_two_pages_state_are_read_off_the_other_pages_declarations(self):
        # One measure recorded twice with one number apart, each record ranked on its own page; a series plotted again
        # whole on a later page, and once more in part. Each page alone hears what the whole-deck run says of it.
        result = run_node(STAGE + '''
const NETWORKS = ['Aster', 'Boreal', 'Cinder', 'Dune', 'Ember', 'Fjord', 'Gale', 'Heron'], FY = ['FY19', 'FY20', 'FY21', 'FY22', 'FY23', 'FY24', 'FY25', 'FY26'];
const graded = { finding: 'a finding', calculation: 'a calculation', soWhat: 'It bears on the decision at hand', strength: 'strong', sources: ['sources/a.csv'] };
const sites = (values) => ({ sites: { unit: 'clinics', population: 'Eight networks', period: 'September 2026', members: NETWORKS, values } });
const insights = new Map([
  { ...graded, id: 'i1', shape: 'peer-set', measures: sites([312, 284, 171, 12, 77, 95, 131, 88]) },
  { ...graded, id: 'i5', shape: 'peer-set', cite: ['tables'], measures: sites([312, 284, 176, 12, 77, 95, 131, 88]) },
  { ...graded, id: 'i4', shape: 'series', measures: { visits: { unit: 'visits m', population: 'Aster', periods: FY, values: [31.4, 33.8, 24.1, 29.7, 38.5, 44.2, 47.32, 48.6] },
    rival: { unit: 'visits m', population: 'Boreal', periods: FY, values: [18.2, 19.9, 14.6, 17.3, 22.8, 27.5, 30.4, 29.1] } } },
].map((item) => [item.id, item]));
const rank = (id, measure) => ({ id, type: 'ranking', form: 'bar', commentary: 'so-what-bar', why: 'The whole set on one measure, the subject marked', evidence: [measure.split('/')[0]],
  title: `Aster runs the largest estate of the eight networks, page ${id}`, bar: 'The estate gap is what the entrant has to close before it can match the coverage',
  settles: { kind: 'rank', what: 'clinics open', measures: [measure] }, exhibit: { heading: 'Clinics open', series: [{ measure, name: 'Sites' }], highlights: [{ category: 'Aster' }] } });
const trend = (id, series) => ({ id, type: 'trend', form: 'line', commentary: 'so-what-bar', why: 'The movement over time is the claim, so the series is drawn', evidence: ['i4'],
  title: `Aster saw more visits every year, page ${id}`, bar: 'The growth has slowed to a crawl, which is what the plan has to explain first',
  settles: { kind: 'rate', what: 'visits a year', measures: series.map((s) => s.measure) }, exhibit: { heading: 'Visits', series, highlights: [{ category: 'FY26' }] } });
const both = [{ measure: 'i4/visits', name: 'Aster' }, { measure: 'i4/rival', name: 'Boreal' }];
const doc = { deck: { schema: 'professional-slides.deck/v3', id: 'probe', workflow: 'new_deck', request: 'How have visits moved?' },
  pages: [trend('p1', both), rank('p2', 'i1/sites'), trend('p3', [both[0]]), rank('p4', 'i5/sites'), trend('p5', both)] };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-run-'));
console.log(JSON.stringify(await compare(doc, { baseDir: dir, insights }, doc.pages.map((p) => [p.id]))));
''')
        self.assertEqual(result["differ"], [])
        self.assertTrue({"NUMBERS_DISAGREE", "PROOF_REPEATS"} <= set(result["codes"]), result["codes"])

    def test_a_page_prints_its_place_in_the_deck_and_a_reference_resolves_to_the_page_it_names(self):
        # The page run composes p23 without the pages before it: it still prints the number the deck gives it, and a
        # reference to a page it does not compose prints that page's place in the deck.
        result = run_node(STAGE + '''
const { dir, doc } = worked();
const p = page(doc, 'p23');
p.points = [`${p.points[0]} (page {{page:p26}})`, ...p.points.slice(1)];
const whole = await authorDeck(doc, { baseDir: dir, fit: false });
const run = await authorDeck(doc, { baseDir: dir, fit: false, pages: new Set(['p23']) });
const shown = (deck) => { const slide = deck.slides.find((s) => String(s.sourceSlideId ?? s.id) === 'p23');
  return { number: slide.nodes.find((n) => n.role === 'page-number')?.text ?? null, reference: slide.nodes.map((n) => String(n.text ?? '').match(/\\(page \\d+\\)/)?.[0]).find(Boolean) ?? null }; };
console.log(JSON.stringify({ whole: shown(whole.deck), page: shown(run.deck) }));
''')
        self.assertIsNotNone(result["whole"]["number"])
        self.assertIsNotNone(result["whole"]["reference"])
        self.assertEqual(result["page"], result["whole"])


@unittest.skipUnless(NODE, "Node.js is not available")
class SpineLockTests(unittest.TestCase):
    def test_a_page_run_holds_the_lock_on_its_own_pages_and_reads_the_order_off_the_pages_file(self):
        """A page run compiles its own pages alone, so the lock reads their arguments as compiled and the deck's order as
        the pages file declares it: a page whose own argument moved is named to its run and to no other, and of two
        pages swapped the one the whole-deck run names is named to its own run."""
        result = run_node('''
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
const page = (id, title) => ({ id, title, points: ['A point written as copy, eight words long.'], pageType: { type: 'trend', form: 'line', content: { claim: title, settles: { kind: 'change', what: `what ${id} measures`, measures: [] }, evidence: [`i-${id}`] } } });
const base = { id: 'lock', slides: ['a', 'b', 'c', 'd'].map((id) => page(id, `Page ${id} states its claim in words`)), appendix: [page('e', 'Page e holds the detail behind the claims')] };
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-run-lock-'));
const history = path.join(dir, '.reviews', 'lock', 'storyline-history');
await fs.mkdir(history, { recursive: true });
await fs.writeFile(path.join(history, 'pass-1.json'), JSON.stringify({ review: { verdict: 'ready' }, pass: 1, binding: S.storylineBinding(base), pageHashes: S.storylinePageHashes(base), bindingVersion: 5 }));
const all = (spec) => [...spec.slides, ...spec.appendix];
const held = (lock) => lock && { pages: lock.pages, moved: lock.moved };
const run = async (mutate, named) => { const spec = structuredClone(base); mutate(spec);
  const only = new Set(named), own = { ...spec, slides: spec.slides.filter((p) => only.has(p.id)), appendix: spec.appendix.filter((p) => only.has(p.id)) };
  const whole = held(await S.spineLock(spec, path.join(dir, 'out'), { deckPath: path.join(dir, 'lock.deck.json') }));
  const part = held(await S.spineLock(own, path.join(dir, 'out'), { deckPath: path.join(dir, 'lock.deck.json'), only, order: all(spec).map((p) => p.id) }));
  return { whole, part }; };
const retitle = (s) => { const b = s.slides[1]; b.title = 'Page b states a narrower claim now'; b.pageType.content.claim = b.title; };
const swap = (s) => { [s.slides[1], s.slides[2]] = [s.slides[2], s.slides[1]]; };
const out = { titleOwn: await run(retitle, ['b']), titleOther: await run(retitle, ['c', 'd']), copy: await run((s) => { s.slides[1].points = ['Copy rewritten after the critique.']; }, ['b']),
  swapB: await run(swap, ['b']), swapC: await run(swap, ['c']) };
await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify(out));
''')
        self.assertEqual(result["titleOwn"]["part"], {"pages": ["b"], "moved": []})
        self.assertIsNone(result["titleOther"]["part"])
        self.assertIsNone(result["copy"]["part"])
        [moved] = result["swapB"]["whole"]["moved"]
        runs = {"b": result["swapB"]["part"], "c": result["swapC"]["part"]}
        self.assertEqual(runs[moved], {"pages": [], "moved": [moved]})
        self.assertIsNone(runs["c" if moved == "b" else "b"])


@unittest.skipUnless(NODE, "Node.js is not available")
class CostTests(unittest.TestCase):
    def test_a_page_run_costs_its_pages_not_the_deck(self):
        """Five pages checked on a deck of six content pages and on one of sixty, each in three sections: the run composes
        the five among the structural pages on both, and takes about as long on the larger deck. The whole-deck run of the
        larger deck composes every page, for contrast."""
        result = run_node(STAGE + '''
const { dir, doc: worked0 } = worked();
const typed = worked0.pages.filter((p) => p.type && p.type !== 'summary');
const deckOf = (n) => { const pages = [worked0.pages[0]], every = Math.ceil(n / 3);
  for (let i = 0; i < n; i += 1) {
    if (i % every === 0) pages.push({ kind: 'section', id: `s${i / every + 1}`, title: `Part ${i / every + 1}` });
    pages.push({ ...structuredClone(typed[i % typed.length]), id: `q${i + 1}` });
  }
  return { ...worked0, pages }; };
const named = new Set(['q2', 'q3', 'q4', 'q5', 'q6']);
const runOf = async (n) => { const doc = deckOf(n), started = performance.now();
  const run = await authorDeck(doc, { baseDir: dir, fit: false, pages: named });
  return { ms: performance.now() - started, slides: run.deck.slides.length, pages: [...new Set(run.deck.slides.filter((s) => /^q\\d+$/.test(String(s.sourceSlideId ?? s.id))).map((s) => String(s.sourceSlideId ?? s.id)))].sort() }; };
await runOf(6);
const small = await runOf(6), large = await runOf(60);
const whole = await authorDeck(deckOf(60), { baseDir: dir, fit: false });
console.log(JSON.stringify({ small, large, whole: whole.deck.slides.length }));
''')
        small, large = result["small"], result["large"]
        self.assertEqual(small["pages"], ["q2", "q3", "q4", "q5", "q6"])
        self.assertEqual(large["pages"], small["pages"])
        self.assertEqual(large["slides"], small["slides"])
        self.assertGreater(result["whole"], 60)
        # Generous: the larger deck's declarations are read, and the machine is shared with the rest of the suite.
        self.assertLess(large["ms"], 2 * small["ms"] + 1500, result)


@unittest.skipUnless(NODE, "Node.js is not available")
class ReportTests(unittest.TestCase):
    def test_a_page_run_lists_its_own_pages_and_the_decks_rules_in_one_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            shutil.copytree(EXAMPLES / "assets", work / "assets")
            shutil.copy(EXAMPLES / "page-types.pages.json", work / "page-types.pages.json")
            compact = cli(work / "page-types.pages.json", "--check", "--page", "p07,p10", "--json")
            text = cli(work / "page-types.pages.json", "--check", "--page", "p07,p10")
            rules = run_node("import { DECK_RULES } from './skills/professional-slides/runtime/page-run.mjs'; console.log(JSON.stringify(DECK_RULES.length));")
        self.assertEqual(compact.returncode, 0, compact.stderr[-600:])
        report = json.loads(compact.stdout)
        self.assertEqual(sorted(report["pages"]), ["p07", "p10"])
        self.assertEqual(sorted(report), ["deck", "ok", "pages"])
        self.assertIn(f"{rules} deck-level rules are the whole-deck run's", report["deck"])
        self.assertIn("node runtime/author-deck.mjs page-types.pages.json --check", report["deck"])
        # The text run says the same line once, and none of the deck's standings.
        self.assertEqual(text.stderr.count(f"{rules} deck-level rules are the whole-deck run's"), 1)
        self.assertNotIn("Where the deck stands", text.stderr)
        self.assertNotIn("VARIETY_", text.stderr + text.stdout)


@unittest.skipUnless(os.environ.get("PS_RUN_SLOW") == "1", "opt-in: set PS_RUN_SLOW=1 or pass --slow")
@unittest.skipUnless(NODE and HAS_RENDERER, "needs Node.js, LibreOffice (soffice) and pdftoppm on PATH")
@requires_python_package("pptx", "PIL", "numpy")
class RenderTests(unittest.TestCase):
    def test_a_section_renders_and_is_staged_for_review_while_another_section_does_not_compile(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            shutil.copytree(EXAMPLES / "assets", work / "assets")
            doc = json.loads((EXAMPLES / "page-types.pages.json").read_text(encoding="utf-8"))
            # The first section in a part of its own, the second in another; a page of the second has lost its exhibit.
            first = [p["id"] for p in doc["pages"]].index("s1"), [p["id"] for p in doc["pages"]].index("s2")
            second = [p["id"] for p in doc["pages"]].index("s3")
            part_a, part_b = doc["pages"][first[0]:first[1]], doc["pages"][first[1]:second]
            next(p for p in part_b if p.get("id") == "p12").pop("exhibit")
            (work / "pages").mkdir()
            (work / "pages" / "a.pages.json").write_text(json.dumps({"pages": part_a}), encoding="utf-8")
            (work / "pages" / "b.pages.json").write_text(json.dumps({"pages": part_b}), encoding="utf-8")
            doc["pages"] = doc["pages"][:first[0]] + [{"include": "pages/a.pages.json"}, {"include": "pages/b.pages.json"}] + doc["pages"][second:]
            file = work / "page-types.pages.json"
            file.write_text(json.dumps(doc), encoding="utf-8")
            ids = [p["id"] for p in part_a]
            # The whole deck renders only once every page composes.
            whole = cli(file, "--check", "--render")
            self.assertEqual(whole.returncode, 2)
            self.assertIn("Not rendered: not every page compiled and composed", whole.stderr)
            # The section renders, each of its pages recorded clean.
            checked = cli(file, "--check", "--render", "--page", ",".join(ids))
            self.assertEqual(checked.returncode, 0, checked.stderr[-1500:])
            summary = json.loads(checked.stdout)
            self.assertEqual(summary["render"]["slides"], len(ids))
            records = {i: json.loads((work / "out" / "page-check" / f"{i}.json").read_text()) for i in ids}
            self.assertTrue(all(record["clean"] for record in records.values()), {i: r["blocking"] for i, r in records.items()})
            self.assertTrue(all((work / "out" / "page-check" / f"{i}.png").exists() for i in ids))
            # A page of the run that does not compile is left out of its render and said; the rest of the run renders.
            broken = cli(file, "--check", "--render", "--page", "p11,p12")
            self.assertEqual(broken.returncode, 2)
            self.assertIn("COMPILE [p12 in pages/b.pages.json]", broken.stderr)
            self.assertIn("p12 did not compile or compose, and is not rendered", broken.stderr)
            self.assertTrue((work / "out" / "page-check" / "p11.png").exists())
            self.assertFalse((work / "out" / "page-check" / "p12.png").exists())
            # The section's review is staged on those records, the other section mid-edit.
            staged = cli(file, work / "out", "--section", "a", script=SECTION_REVIEW)
            self.assertEqual(staged.returncode, 3, staged.stdout + staged.stderr[-800:])
            self.assertEqual(json.loads(staged.stdout)["pages"], len(ids))


if __name__ == "__main__":
    unittest.main()
