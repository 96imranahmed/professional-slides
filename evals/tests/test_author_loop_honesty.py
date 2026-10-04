"""The authoring loop says only what it checked.

An independent review found five claims of the loop that did not hold. The
fit search called an alternative "the same content" when its form ignored a
field the page wrote; `--plan` judged a spine on exhibit kinds it had guessed,
under a wall-clock budget that changed its answer on a loaded machine; a page
with a reference that did not bind hid its own compile refusal until the next
run, and a section written without an id compiled and then failed the build;
`--page` filed a finding about two pages under one of them and passed a page
that a blocking aggregate counted; and a scaffold bound to the author's
insight kept the worked example's words. These hold the repair.
"""
from __future__ import annotations

import json
import os
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
            self.assertEqual(run.returncode, 2)
            # Neither is proposed: under the points the page's text breaks into short blocks, and the deck - a tenth of a word
            # above the floor of its words a block - would be refused at the render (it is: 37.3 against 41.3 with the cycle
            # set so). The search says that, where it once called the cycle "verified" and the render then refused the deck.
            self.assertIn("No other form or placement of this type fits with the same content", run.stderr)
            self.assertIn('fails:  form "cycle", commentary "below" - would take the deck\'s median words a block under its band', run.stderr)
            self.assertNotIn("passes the scene checks", run.stderr)
            self.assertNotIn("verified", run.stderr)
            # The verdict is remembered with what it drops, so a later run says the same without composing again.
            cache = json.loads((Path(tmp) / "page-types.author-cache.json").read_text())
            verdict = lambda form: {k: v for k, v in next(v for v in cache["fits"]["p11"]["verdicts"] if v["form"] == form and v["commentary"] == "below").items() if k != "blocks"}  # noqa: E731
            self.assertEqual(verdict("cycle"), {"form": "cycle", "commentary": "below", "remaining": []})
            self.assertEqual(verdict("steps"), {"form": "steps", "commentary": "below", "remaining": [], "drops": ["exhibit.center"]})
            again = cli(Path(tmp) / "page-types.pages.json", "--check", "--fit-cap", "12")
            self.assertIn('fails:  form "steps", commentary "below" - would take the deck\'s median words a block under its band', again.stderr)

    def test_which_fields_a_form_draws_is_read_off_its_composition(self):
        result = run_node('''
import { fitSearch, fitLines, writtenFields } from './skills/professional-slides/runtime/fit-search.mjs';
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
console.log(JSON.stringify({ fields: writtenFields(page).map((f) => f.path), pass: fit.pass, partial: fit.partial, lead: fitLines(fit).lead, lines: fitLines(fit).lines.filter((l) => l.startsWith('fits')),
  none: fitLines({ pass: [], partial: fit.partial, fail: [], needs: [], untried: [] }).lead }));
''')
        self.assertEqual(result["fields"], ["why", "title", "points", "exhibit", "exhibit.center", "exhibit.items", "exhibit.items[].label", "exhibit.items[].text"])
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
  cut: [cut.satisfied, cut.capped, cut.steps, cut.unsatisfied.map((u) => u.code)] }));
''')
        self.assertEqual(result["full"], [True, False, True, True])
        self.assertTrue(result["same"])
        # Stopped by its count with a rule still broken, the plan says it was stopped and which rule is left.
        satisfied, capped, steps, left = result["cut"]
        self.assertEqual([satisfied, capped, steps], [False, True, 1])
        self.assertIn("VARIETY_COLUMN", left)


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


class PageRunTests(unittest.TestCase):
    def test_a_finding_about_two_pages_is_reported_to_a_run_of_either(self):
        def repeated(doc):
            page_of(doc, "p06")["title"] = page_of(doc, "p05")["title"]
        with tempfile.TemporaryDirectory() as tmp:
            file = worked_deck(tmp, repeated)
            for page in ("p05", "p06"):
                run = cli(file, "--check", "--page", page)
                self.assertEqual(run.returncode, 2, f"{page}: {run.stderr[:300]}")
                self.assertIn("CONTENT_CLAIM_REPEATS", run.stderr.split("Where the deck stands")[0])
            # A page the finding does not name still passes: the finding is not spread over the deck.
            self.assertEqual(cli(file, "--check", "--page", "p02").returncode, 0)

    def test_a_page_counted_in_a_blocking_aggregate_answers_for_it(self):
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
            run = cli(file, "--check", "--page", charted)
            self.assertEqual(run.returncode, 2)
            findings, rest = run.stderr.split("Each page's part in the deck's aggregates:")
            self.assertIn("G. Deck aggregates", findings.split("Deck aggregate findings these pages are not counted in")[0])
            self.assertIn("CRAFT_CHARTS_BARE", findings.split("Deck aggregate findings these pages are not counted in")[0])
            # Its part in the aggregates names the craft rate it counts towards, and which way it pulls.
            self.assertIn(f"{charted}: CRAFT_CHARTS_BARE: this page counts as 1 chart page, 0 marking something on the plot", " ".join(rest.split()))
            self.assertIn("pulls the deck the wrong way", rest)
            # A page with no chart has no part in it: the finding is listed apart, and the run answers for the page alone.
            other = cli(file, "--check", "--page", "p02")
            self.assertIn("Deck aggregate findings these pages are not counted in (not counted in this run's exit code; the whole-deck run holds them):", other.stderr)
            self.assertNotIn("p02: CRAFT_CHARTS_BARE", other.stderr)

    def test_the_pages_a_finding_is_made_of_are_read_off_its_rule(self):
        result = run_node('''
import { contributorsOf, contributions, pagesOf } from './skills/professional-slides/runtime/deck-report.mjs';
const standings = [
  { code: 'RATE', class: 'G', what: 'charts marked', value: 0.2, bar: 0.3, side: 'min', state: 'short' },
  { code: 'EACH', class: 'G', what: 'numbers a page', value: 9, bar: 15, side: 'min', state: 'short', each: { p1: 4, p2: 30 } },
  { code: 'CAP', class: 'G', what: 'pages of one kind', value: 3, bar: 2, side: 'max', state: 'over', pages: ['p2', 'p3'] }];
const parts = { p1: { charts: 1, chartsAnnotated: 0 }, p2: { charts: 1, chartsAnnotated: 1 }, p3: { charts: 0, chartsAnnotated: 0 } };
const rates = { RATE: { of: 'charts', done: 'chartsAnnotated', noun: 'chart page', verb: 'marked' } };
const of = (code, more = {}) => contributorsOf({ code, class: 'G', ...more }, standings, { parts, rates });
console.log(JSON.stringify({ rate: of('RATE'), each: of('EACH'), cap: of('CAP'), named: of('OTHER', { slide: ['p3'] }), none: of('OTHER'),
  pages: [pagesOf({ id: 'p6', pages: ['p5', 'p6'] }), pagesOf({ slide: ['p1', null] }), pagesOf({ id: 'p1' })], lines: contributions(standings, ['p1', 'p3'], { parts, rates }) }));
''')
        self.assertEqual(result["rate"], ["p1"])   # the page holding a chart that is not marked
        self.assertEqual(result["each"], ["p1"])   # the page on the wrong side of the bar
        self.assertEqual(result["cap"], ["p2", "p3"])  # the pages counted against the cap
        self.assertEqual([result["named"], result["none"]], [["p3"], []])
        self.assertEqual(result["pages"], [["p6", "p5"], ["p1"], ["p1"]])
        self.assertEqual(result["lines"]["p1"][0], "RATE: this page counts as 1 chart page, 0 marked (deck 0.2 charts marked; floor 0.3) - pulls the deck the wrong way")
        self.assertFalse([line for line in result["lines"]["p3"] if line.startswith("RATE")])


class WhatARunWritesTests(unittest.TestCase):
    def test_a_check_writes_no_deck_and_the_two_files_it_does_write_are_the_ones_documented(self):
        def stack(doc):
            page_of(doc, "p10")["form"] = "stack"
        with tempfile.TemporaryDirectory() as tmp:
            file = worked_deck(tmp, stack)
            self.assertEqual(cli(file, "--check").returncode, 2)
            # A refused check of a page the fit search answered: the run log and the search's cache, and nothing else.
            self.assertEqual(sorted(p.name for p in Path(tmp).iterdir()), ["assets", "page-types.author-cache.json", "page-types.author-log.jsonl", "page-types.pages.json"])
        for doc_file, said in ((SKILL / "references" / "page-types.md", "no deck is written (the run log and the fit cache are)"), (AUTHOR, "<id>.author-log.jsonl and may update the fit search's")):
            self.assertIn(said, " ".join(doc_file.read_text(encoding="utf-8").replace("//", " ").split()))


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
  out[type] = { heading: page.exhibit.heading, annotations: (page.exhibit.annotations || []).map((a) => a.text), kept: texts(page).filter((text) => worked.has(text)), points: page.points ?? null, kpi: page.kpi ?? null, bound: page.exhibit.series };
}
// Unbound, the scaffold is still the worked example's own page: its data and its words, to copy the shape of.
const plain = scaffoldPage('trend', { id: 'p00' });
console.log(JSON.stringify({ ...out, plain: plain.exhibit.heading === example('trend').exhibit.heading }));
''')
        for kind in ("trend", "numbers"):
            with self.subTest(type=kind):
                page = result[kind]
                self.assertEqual(page["heading"], "(Exhibit heading: what is measured, for whom, in which unit)")
                self.assertTrue(page["annotations"])
                self.assertEqual(set(page["annotations"]), {"(What happened here, and why it matters)"})
                self.assertEqual(page["kept"], [], "a sentence of the worked example on the author's data")
                self.assertEqual(page["bound"], [{"measure": "i-clinics/visits", "name": "visits"}])
        self.assertTrue(all(point.startswith("(A point:") for point in result["numbers"]["points"]))
        # A bound figure's format keeps the number it prints: one decimal place would print 0.0 for 0.043.
        self.assertEqual(result["numbers"]["kpi"]["format"], "0.000")
        self.assertTrue(result["plain"])


if __name__ == "__main__":
    unittest.main()
