"""The authoring loop says only what it checked.

An independent review found five claims of the loop that did not hold. The
fit search called an alternative "the same content" when its form ignored a
field the page wrote; `--plan` judged a spine on exhibit kinds it had guessed,
under a wall-clock budget that changed its answer on a loaded machine; a page
with a reference that did not bind hid its own compile refusal until the next
run, and a section written without an id compiled and then failed the build;
`--page` filed a finding about two pages under one of them; and a scaffold
bound to the author's insight kept the worked example's words. These hold the
repair. (A page run now leaves the deck's aggregates to the whole-deck run, and
says so.)
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, SKILL, run_node

AUTHOR = SKILL / "runtime" / "author-deck.mjs"
BUILD = SKILL / "runtime" / "build-deck.mjs"
EXAMPLES = SKILL / "examples"
MARKS = ("annotations", "highlights", "referenceLines", "events", "changeAnnotations", "focusSeries", "change", "cagr", "growth")


def cli(*args, script=AUTHOR, cwd=None, timeout=600):
    return subprocess.run([NODE, str(script), *map(str, args)], cwd=cwd or ROOT, capture_output=True, text=True, timeout=timeout,
                          env={**os.environ, "RUNTIME_NODE_MODULES": str(ROOT / "node_modules")})


def worked_deck(tmp, mutate=None):
    """The worked deck of every page type in a folder of its own, with its assets; `mutate` edits the document."""
    doc = json.loads((EXAMPLES / "page-types.pages.json").read_text(encoding="utf-8"))
    if mutate:
        mutate(doc)
    shutil.copytree(EXAMPLES / "assets", Path(tmp) / "assets")
    file = Path(tmp) / "page-types.pages.json"
    file.write_text(json.dumps(doc), encoding="utf-8")
    return file


def page_of(doc, page_id):
    return next(p for p in doc["pages"] if p.get("id") == page_id)


def exhibits_of(page):
    return [ex for ex in [page.get("exhibit"), *(page.get("exhibits") or [])] if isinstance(ex, dict)]


class SameContentTests(unittest.TestCase):
    def test_an_alternative_that_ignores_a_field_the_page_wrote_is_not_the_same_content(self):
        # A cycle with its centre named, short of copy beside it: a row of steps under the points fits the page and draws no centre.
        def short(doc):
            page = page_of(doc, "p11")
            page["points"], page["highlight"] = page["points"][:2], page["highlight"][:2]
        with tempfile.TemporaryDirectory() as tmp:
            run = cli(worked_deck(tmp, short), "--check", "--fit-cap", "12")
            # Two points that own the column beside the cycle now centre on it, so the page composes as written: nothing is
            # searched and no alternative that drops a field the page wrote (the steps, which draw no centre) is proposed.
            self.assertEqual(run.returncode, 0, run.stderr[-1500:])
            self.assertNotIn("fits, dropping content", run.stderr)
            self.assertNotIn("No other form or placement of this type fits with the same content", run.stderr)

    def test_which_fields_a_form_draws_is_read_off_its_composition(self):
        result = run_node('''
import { fitSearch, fitLines } from './skills/professional-slides/runtime/fit-search.mjs';
const page = { id: 'p1', type: 'mechanism', form: 'cycle', commentary: 'beside', why: 'w', title: 't', points: ['a', 'b'],
  exhibit: { type: 'cycle', center: 'Loop', items: [{ label: 'One', text: 'first' }, { label: 'Two', text: 'second' }] } };
// A stand-in composer: a cycle draws everything; steps draw each item's label and nothing else of the exhibit; no form draws `why`.
const drawn = async (p) => { const ex = p.exhibit ?? {};
  if (!p.title) return { slide: null, scene: null };
  const shown = p.form === 'cycle' ? [ex.center, ...(ex.items || []).flatMap((i) => [i.label, i.text])] : (ex.items || []).map((i) => i.label);
  return { slide: JSON.stringify({ ...p, why: undefined }), scene: JSON.stringify([p.title, p.points, shown]) }; };
const search = (alternatives) => fitSearch([{ id: 'p1', page, index: 0 }], { spec: { slides: [{ id: 'p1' }] }, deck: { slides: [{ id: 'cover', nodes: [] }] }, perPage: alternatives,
  compile: (p) => { if (!['cycle', 'steps'].includes(p.form) || !['beside', 'below'].includes(p.commentary)) throw new Error('p1: not offered here'); return { id: 'p1', form: p.form }; },
  compose: async (spec) => ({ deck: { slides: [{ id: 'p1', nodes: [] }] }, pageErrors: [] }), pageGates: () => ({ ran: true, findings: [] }), localFindings: () => [], structure: () => [], brief: (f) => f.code, drawn });
const fit = (await search(12)).get('p1');
console.log(JSON.stringify({ pass: fit.pass, partial: fit.partial, lead: fitLines(fit).lead, lines: fitLines(fit).lines.filter((l) => l.startsWith('fits')),
  none: fitLines({ pass: [], partial: fit.partial, fail: [], needs: [], untried: [] }).lead }));
''')
        self.assertEqual(result["pass"], [{"form": "cycle", "commentary": "below"}])
        # Steps drop the centre and each item's text; the whole list is not dropped, since its labels are drawn.
        self.assertEqual([[alt["form"], alt["drops"]] for alt in result["partial"]], [["steps", ["exhibit.center", "exhibit.items[].text"]]] * 2)
        self.assertTrue(result["lead"].startswith('With the same content, form "cycle", commentary "below" passes the scene checks'))
        self.assertEqual(len(result["lines"]), 2)
        self.assertTrue(all(line.startswith('fits, dropping content: form "steps", commentary "be') and "does not draw `exhibit.center`, `exhibit.items[].text`: not the same content" in line for line in result["lines"]), result["lines"])
        # With nothing that keeps the content, the repair does not lead with an alternative: it says the content has to change.
        self.assertTrue(result["none"].startswith("No other form or placement of this type fits with the same content (2 tried; 2 fit only by dropping a field the page wrote"))


class PlanTests(unittest.TestCase):
    def test_a_deck_that_compiles_clean_is_planned_on_the_standings_its_compile_reports(self):
        with tempfile.TemporaryDirectory() as tmp:
            file = worked_deck(tmp)
            check, plan = cli(file, "--check"), cli(file, "--plan")
            self.assertEqual([check.returncode, plan.returncode], [0, 0], plan.stderr[-600:])
            checked, planned = json.loads(check.stdout), json.loads(plan.stdout)
            self.assertEqual(planned["declared"]["blocking"], [])
            self.assertNotIn("estimated", planned["plan"])
            self.assertTrue(all(row.endswith(" declared") for row in planned["plan"]["pages"]))
            # Every structure line the plan prints is a line the compile prints, value for value.
            self.assertTrue(planned["standing"]["S"])
            self.assertEqual([line for line in planned["standing"]["S"] if line not in checked["standing"]["S"]], [])
            self.assertIn("As declared, the deck satisfies its structure rules.", plan.stderr)
            # Its pages carry their copy, so the plan composes them as written and reads their blocks as the check does: one number.
            words = lambda line: float(re.search(r"median words a block on the prose pages ([\d.]+);", line).group(1))  # noqa: E731
            self.assertEqual([line.split(":")[0] for line in planned["standing"]["estimated"]], ["TEXT_FRAGMENTED.floor", "TEXT_FRAGMENTED.ceiling"])
            # The plan composes each page out of the deck's chrome (no section tracker), so a centred column sits a few pixels
            # from where the check sets it, and the row reading moves by a few words: the two agree within the estimate's margin.
            self.assertLessEqual(abs(words(planned["standing"]["estimated"][0]) - words(next(line for line in checked["standing"]["G"] if line.startswith("TEXT_FRAGMENTED.floor")))), 4.0)

    def test_a_page_with_no_exhibit_yet_is_estimated_and_marked_and_the_verdict_says_so(self):
        # The same deck as a spine that keeps its forms and placements and has no exhibit written: what a form sets is read,
        # and only the pages whose form leaves the exhibit's kind to the author are estimated.
        def spine(doc):
            keep = ("id", "title", "type", "why", "kind", "evidence", "settles", "form", "commentary")
            doc["pages"] = [{k: v for k, v in p.items() if k in keep} if p.get("type") else p for p in doc["pages"]]
        with tempfile.TemporaryDirectory() as tmp:
            run = cli(worked_deck(tmp, spine), "--plan")
            plan = json.loads(run.stdout)
            estimated = plan["plan"]["estimated"]
            self.assertTrue(estimated)
            rows = {row.split(" ")[0]: row for row in plan["plan"]["pages"]}
            self.assertTrue(all("(exhibit estimated)" in rows[page] for page in estimated))
            self.assertTrue(all(rows[page].split(" ")[1].split("/")[0] in ("panels", "numbers", "options", "picture") for page in estimated), [rows[page] for page in estimated])
            # A trend drawn as a line, a ranking as bars, a cycle: the form says what the exhibit is, and nothing is estimated.
            self.assertNotIn("(exhibit estimated)", rows["p03"])
            self.assertNotIn("(exhibit estimated)", rows["p11"])
            self.assertIn(f"{len(estimated)} pages have no exhibit written yet whose kind the form sets", run.stderr)
            self.assertIn("As declared, on that estimate,", run.stderr)
            self.assertNotIn("As declared, the deck's structure rules refuse it", run.stderr)

    def test_the_search_is_bounded_by_a_count_and_says_when_the_count_stopped_it(self):
        result = run_node('''
import fs from 'node:fs';
import { planOf } from './skills/professional-slides/runtime/author-deck.mjs';
import { allocateStructure } from './skills/professional-slides/runtime/deck-structure.mjs';
import { placementsOf } from './skills/professional-slides/runtime/page-types.mjs';
const doc = JSON.parse(fs.readFileSync('skills/professional-slides/examples/page-types.pages.json', 'utf8'));
for (const page of doc.pages) if (page.type && placementsOf(page.type, page.form).includes('beside')) page.commentary = 'beside';
const full = allocateStructure(doc, { planOf }), again = allocateStructure(doc, { planOf }), cut = allocateStructure(doc, { planOf, maxEvaluations: 10 });
const rows = (plan) => plan.pages.map((p) => `${p.id} ${p.form} ${p.commentary} ${p.source}`).join('|');
console.log(JSON.stringify({ full: [full.satisfied, full.capped, full.steps > 0, full.evaluations > 10], same: rows(full) === rows(again) && full.evaluations === again.evaluations,
  before: full.declared.findings.filter((f) => f.severity === 'blocker').map((f) => f.code), changed: full.pages.filter((p) => p.source === 'changed').length,
  proposed: full.pages.filter((p) => p.source === 'proposed').length, cut: [cut.satisfied, cut.capped, cut.steps, cut.unsatisfied.map((u) => u.code)], spent: cut.evaluations }));
''')
        self.assertEqual(result["full"], [True, False, True, True])
        self.assertTrue(result["same"])
        # Every page that takes commentary beside its exhibit: the column cap is broken as declared, and the plan says which
        # declared choices to change rather than only that the deck fails - and proposes nothing the pages declare.
        self.assertIn("VARIETY_COLUMN", result["before"])
        self.assertGreater(result["changed"], 0)
        self.assertEqual(result["proposed"], 0)
        # Stopped by its count with a rule still broken, the plan says it was stopped and which rule is left.
        satisfied, capped, steps, left = result["cut"]
        self.assertEqual([satisfied, capped], [False, True])
        self.assertLessEqual(steps, 1)
        self.assertIn("VARIETY_COLUMN", left)
        # The count holds inside a pass, not only between passes: a widened pass once ran past it by thousands.
        self.assertLessEqual(result["spent"], 12)


class OnePassTests(unittest.TestCase):
    def test_a_page_whose_reference_does_not_bind_is_still_compiled_for_its_refusal(self):
        result = run_node('''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { authorDeck } from './skills/professional-slides/runtime/author-deck.mjs';
const examples = path.resolve('skills/professional-slides/examples');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unbound-'));
fs.cpSync(path.join(examples, 'assets'), path.join(dir, 'assets'), { recursive: true });
const doc = JSON.parse(fs.readFileSync(path.join(examples, 'page-types.pages.json'), 'utf8'));
const page = (id) => doc.pages.find((p) => p.id === id);
// A token that names no recorded measure, on a page that has also lost its `why`...
page('p05').title += ' {{i9/none | 0}}'; delete page('p05').why;
// ...a bound exhibit that cannot be filled, on a page that has also lost its `why`...
page('p03').exhibit = { heading: 'Journeys', series: [{ measure: 'i9/none', name: 'Journeys' }] }; delete page('p03').why;
// ...and a token alone, on a page with nothing else wrong.
page('p06').exhibit.heading += ' {{i9/none | 0}}';
const run = await authorDeck(doc, { baseDir: dir, fit: false });
const of = (id) => run.blocking.filter((f) => f.id === id).map((f) => f.code).sort();
const why = (id) => run.blocking.find((f) => f.id === id && f.code === 'COMPILE')?.repair ?? '';
// The repair of exactly what the run reported: the references and the two sentences.
const fixed = JSON.parse(fs.readFileSync(path.join(examples, 'page-types.pages.json'), 'utf8'));
const after = await authorDeck(fixed, { baseDir: dir, fit: false });
console.log(JSON.stringify({ p05: of('p05'), p03: of('p03'), p06: of('p06'), says: [why('p05').includes('why'), why('p03').includes('why')], after: after.blocking.map((f) => f.code) }));
''')
        self.assertEqual(result["p05"], ["BINDING_UNRESOLVED", "COMPILE"])
        self.assertEqual(result["p03"], ["BINDING_UNRESOLVED", "COMPILE"])
        self.assertEqual(result["p06"], ["BINDING_UNRESOLVED"])  # no refusal is invented for a page whose only fault is its reference
        self.assertEqual(result["says"], [True, True])
        self.assertEqual(result["after"], [])

    def test_a_section_written_without_an_id_is_named_once_and_the_build_takes_it(self):
        def unnamed(doc):
            at = next(i for i, p in enumerate(doc["pages"]) if p.get("id") == "p07c")
            doc["pages"].insert(at, {"kind": "section", "title": "Money and the timetable change"})
        with tempfile.TemporaryDirectory() as tmp:
            file = worked_deck(tmp, unnamed)
            compiled = cli(file)
            self.assertEqual(compiled.returncode, 0, compiled.stderr[-600:])
            deck = json.loads((Path(tmp) / "page-types.deck.json").read_text())
            section = next(s for s in deck["slides"] if s.get("title") == "Money and the timetable change")
            self.assertRegex(section["id"], r"^section-\d+$")
            content = json.loads((Path(tmp) / "page-types.content.json").read_text())
            self.assertIn(section["id"], [page["id"] for page in content["pages"]])
            built = cli(Path(tmp) / "page-types.deck.json", Path(tmp) / "out", "--no-render", "--no-fetch", script=BUILD)
            self.assertEqual(built.returncode, 0, built.stderr[-800:])
            self.assertNotIn("TEXT_PLAN_CHANGED", built.stderr)


class MovedCommentaryTests(unittest.TestCase):
    def test_points_declared_beside_and_drawn_below_are_told_to_the_author(self):
        """Three pages of a 60-page deck declared their points beside a chart and were drawn under it, and nothing said so."""
        result = run_node('''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { authorDeck } from './skills/professional-slides/runtime/author-deck.mjs';
const examples = path.resolve('skills/professional-slides/examples');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moved-'));
fs.cpSync(path.join(examples, 'assets'), path.join(dir, 'assets'), { recursive: true });
const doc = JSON.parse(fs.readFileSync(path.join(examples, 'page-types.pages.json'), 'utf8'));
const page = doc.pages.find((p) => p.id === 'p03');
// Two short points beside a ten-year line: too little for the column, so the composer sets them under the chart.
Object.assign(page, { commentary: 'beside', points: ['Journeys recovered to their FY19 level in FY24.', 'They have grown every year since.'] });
const run = await authorDeck(doc, { baseDir: dir, fit: false });
console.log(JSON.stringify(run.advisories.filter((f) => f.code === 'COMMENTARY_MOVED').map((f) => [f.id, f.measured.declared, f.measured.drawn])));
''')
        self.assertEqual(result, [["p03", "beside", "below"]])


class UnwrittenDeckTests(unittest.TestCase):
    def test_a_check_says_it_wrote_no_deck_json_and_whether_the_one_on_disk_is_these_pages(self):
        """On the BA retest a clean `--check --render` was taken for a compile:
        it wrote no deck.json, said nothing of it, and the build read one ten
        minutes older than the pages. A full compile records the pages it was
        compiled from; a check says it wrote none, why, the command that
        writes one, and whether the one on disk is these pages."""
        with tempfile.TemporaryDirectory() as tmp:
            file = worked_deck(tmp)
            self.assertEqual(cli(file).returncode, 0)
            deck = Path(tmp) / "page-types.deck.json"
            self.assertEqual(list(json.loads(deck.read_text())["compiledFrom"]["files"]), ["page-types.pages.json"])
            current = cli(file, "--check")
            self.assertEqual(current.returncode, 0, current.stderr[-600:])
            self.assertEqual(json.loads(current.stdout)["deckJson"], {"file": "page-types.deck.json", "written": False, "why": "--check checks the pages and writes nothing",
                                                                      "writes": "node runtime/author-deck.mjs page-types.pages.json", "onDisk": "current"})
            self.assertIn("No page-types.deck.json was written: --check checks the pages and writes nothing.", current.stderr)
            # The same pages written again: the deck.json on disk is no longer theirs, and the check and the build both say so.
            file.write_text(json.dumps(json.loads(file.read_text()), indent=1), encoding="utf-8")
            stale = cli(file, "--check")
            self.assertEqual(json.loads(stale.stdout)["deckJson"]["onDisk"], "stale")
            self.assertIn("The one on disk was compiled from older pages, and the build refuses it (DECK_OLDER_THAN_PAGES).", stale.stderr)
            built = cli(deck, Path(tmp) / "out", "--no-render", "--no-fetch", script=BUILD)
            self.assertEqual(built.returncode, 2, built.stderr[-600:])
            self.assertIn("Refused (DECK_OLDER_THAN_PAGES)", built.stderr)


class PageRunTests(unittest.TestCase):
    def test_a_finding_about_two_pages_is_reported_to_a_run_of_either(self):
        def repeated(doc):
            page_of(doc, "p06")["title"] = page_of(doc, "p05")["title"]
        with tempfile.TemporaryDirectory() as tmp:
            file = worked_deck(tmp, repeated)
            for page in ("p05", "p06"):
                run = cli(file, "--check", "--page", page)
                self.assertEqual(run.returncode, 2, f"{page}: {run.stderr[:300]}")
                self.assertIn("CONTENT_CLAIM_REPEATS", run.stderr.split("deck-level rules are the whole-deck run's")[0])
            # A page the finding does not name still passes: the finding is not spread over the deck.
            self.assertEqual(cli(file, "--check", "--page", "p02").returncode, 0)

    def test_a_page_run_leaves_a_blocking_aggregate_to_the_whole_deck_run(self):
        """A page run once answered for every aggregate one of its pages was counted in - a page holding a bare chart for
        the deck's share of marked charts - and each section's writer chased a rate the whole deck sets. An aggregate is
        read over every page composed, which a page run does not compose: the whole-deck run holds it, and the page run
        says so in its one line, and answers for the page's own findings."""
        # The deck's marked charts taken out, and the marks off the rest: the share of charts marking anything falls under its floor.
        def bare(doc):
            marked = lambda p: any(key in ex for ex in exhibits_of(p) for key in MARKS)
            required = {"p05", "p07b", "p07d", "p03c", "p24c"}
            doc["pages"] = [p for p in doc["pages"] if not (p.get("type") and p.get("commentary") == "on-exhibit" and marked(p)) and p.get("id") not in required]
            for p in doc["pages"]:
                for ex in exhibits_of(p):
                    for key in MARKS:
                        ex.pop(key, None)
        with tempfile.TemporaryDirectory() as tmp:
            file = worked_deck(tmp, bare)
            doc = json.loads(file.read_text())
            charted = next(p["id"] for p in doc["pages"] if p.get("type") == "trend" and exhibits_of(p))
            whole = cli(file, "--check")
            self.assertEqual(whole.returncode, 2)
            self.assertIn("CRAFT_CHARTS_BARE", whole.stderr.split("Where the deck stands")[0])
            run = cli(file, "--check", "--page", charted, "--json")
            report = json.loads(run.stdout)
            self.assertEqual(run.returncode, 0, report)
            self.assertEqual(report["pages"][charted]["findings"], [])
            self.assertIn("deck-level rules are the whole-deck run's", report["deck"])
            self.assertNotIn("CRAFT_CHARTS_BARE", run.stdout)

    def test_the_pages_a_finding_names_are_read_off_it_its_own_first(self):
        result = run_node('''
import { pagesOf } from './skills/professional-slides/runtime/deck-report.mjs';
console.log(JSON.stringify([pagesOf({ id: 'p6', pages: ['p5', 'p6'] }), pagesOf({ slide: ['p1', null] }), pagesOf({ id: 'p1' }), pagesOf({ code: 'X' })]));
''')
        self.assertEqual(result, [["p6", "p5"], ["p1"], ["p1"], []])


class ScaffoldTests(unittest.TestCase):
    def test_a_scaffold_bound_to_an_insight_carries_none_of_the_examples_words(self):
        result = run_node('''
import { scaffoldPage, workedExamples } from './skills/professional-slides/runtime/author-deck.mjs';
const graded = { finding: 'a finding', calculation: 'a calculation', soWhat: 'It bears on the decision at hand', strength: 'strong', sources: [] };
const series = { ...graded, id: 'i-clinics', shape: 'series', breadth: { periods: 8, series: 1 }, measures: { visits: { unit: 'visits k', population: 'the group', periods: ['FY19', 'FY20', 'FY21', 'FY22', 'FY23', 'FY24', 'FY25', 'FY26'], values: [31, 36, 40, 44, 47, 52, 58, 61] },
  small: { unit: 'ratio', population: 'the group', period: 'FY26', value: 0.043 } } };
const texts = (node, out = []) => { if (typeof node === 'string') out.push(node); else if (node && typeof node === 'object') for (const [key, value] of Object.entries(node)) if (!['id', 'type', 'form', 'commentary', 'measure', 'format', 'category', 'evidence', 'series', 'limits'].includes(key)) texts(value, out); return out; };
const example = (type) => workedExamples().pages.find((p) => p.type === type);
const out = {};
for (const type of ['trend', 'numbers']) {
  const page = scaffoldPage(type, { id: 'p00', insight: series }), worked = new Set(texts(example(type)));
  out[type] = { annotations: (page.exhibit.annotations || []).map((a) => a.text), kept: texts(page).filter((text) => worked.has(text)), kpi: page.kpi ?? null, bound: page.exhibit.series };
}
// Unbound, the scaffold is still the worked example's own page: its data and its words, to copy the shape of.
const plain = scaffoldPage('trend', { id: 'p00' });
console.log(JSON.stringify({ ...out, plain: plain.exhibit.heading === example('trend').exhibit.heading }));
''')
        for kind in ("trend", "numbers"):
            with self.subTest(type=kind):
                page = result[kind]
                self.assertTrue(page["annotations"])
                self.assertEqual(page["kept"], [], "a sentence of the worked example on the author's data")
                self.assertEqual(page["bound"], [{"measure": "i-clinics/visits", "name": "visits"}])
        # A bound figure's format keeps the number it prints: one decimal place would print 0.0 for 0.043.
        self.assertEqual(result["numbers"]["kpi"]["format"], "0.000")
        self.assertTrue(result["plain"])


if __name__ == "__main__":
    unittest.main()
