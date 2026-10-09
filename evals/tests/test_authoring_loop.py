"""The authoring loop: one pass reports everything, in the order it is best fixed.

A real fifty-page run needed 33 compiles, 19 of them refused. After the first
full compile came a tail of runs that each revealed one finding the run before
could have reported: a page was tried as four forms to clear an empty band, a
rule over the deck's mix fired once the pages it counted finally compiled, and
the executive summary failing to compile was reported as a deck with no
summary and an answer no page carried. These hold the repair:

* a run reports the deck's structure first, then each page, then the deck's
  aggregates, and fixing exactly what it reports reveals nothing it could
  have reported;
* every run says where the deck stands against every structure and aggregate
  rule, so a refusal is never the first time its rule is mentioned;
* a page that does not fit has its type's other forms and placements tried
  for it, composed and gated, and the finding lists the ones that pass;
* `--page` reports a page against the whole deck, `--plan` allocates forms
  and placements before the pages are written.
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
EXAMPLES = SKILL / "examples"
FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"

# The worked example of every page type with five defects planted in it, of
# three classes, and the repair of exactly what a run reports of them.
PLANTED = '''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { authorDeck } from './skills/professional-slides/runtime/author-deck.mjs';
const examples = path.resolve('skills/professional-slides/examples');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'one-pass-'));
fs.cpSync(path.join(examples, 'assets'), path.join(dir, 'assets'), { recursive: true });
const clean = JSON.parse(fs.readFileSync(path.join(examples, 'page-types.pages.json'), 'utf8'));
const page = (doc, id) => doc.pages.find((p) => p.id === id);
const original = (id) => clean.pages.find((p) => p.id === id);
const plant = (doc) => {
  // S, seen only through a page that does not compile: three trend pages in a row, the third without its so-what bar.
  const moved = page(doc, 'p03c');
  doc.pages.splice(doc.pages.indexOf(moved), 1);
  doc.pages.splice(doc.pages.indexOf(page(doc, 'p03b')) + 1, 0, moved);
  delete moved.bar;
  // P, layout: panels stacked over a band of points leave a column of the page empty.
  page(doc, 'p10').form = 'stack';
  // P, compile, on the page the deck's opening and its answer rest on.
  delete page(doc, 'p01').points;
  // S: declared players nobody introduces by their marks.
  doc.deck.players = ['Northvale Rail', 'Pennine Express', 'Coastline Trains'];
  // G, and P on its page: a share drawn as two bars, which the deck's craft floor refuses however few there are.
  page(doc, 'p26').exhibit = { type: 'chart.column', heading: 'Journeys by time of day, FY26', unit: '% of journeys', categories: ['Peak', 'Off-peak'], series: [{ name: 'Share', values: [38, 62] }] };
  return doc;
};
const planted = plant(structuredClone(clean));
const tell = (run) => run.blocking.map((f) => ({ code: f.code, class: f.class, id: f.id ?? null, provisional: Boolean(f.provisional), partial: Boolean(f.partial) }));
'''


def cli(*args, cwd=None, timeout=300):
    return subprocess.run([NODE, str(AUTHOR), *map(str, args)], cwd=cwd or ROOT, capture_output=True, text=True, timeout=timeout,
                          env={**os.environ, "RUNTIME_NODE_MODULES": str(ROOT / "node_modules")})


def examples_deck(tmp, mutate=None):
    """The worked example deck copied into `tmp` with its pictures, `mutate` applied to its pages document."""
    work = Path(tmp)
    work.mkdir(parents=True, exist_ok=True)
    shutil.copytree(EXAMPLES / "assets", work / "assets")
    doc = json.loads((EXAMPLES / "page-types.pages.json").read_text(encoding="utf-8"))
    if mutate:
        mutate(doc)
    file = work / "page-types.pages.json"
    file.write_text(json.dumps(doc), encoding="utf-8")
    return file


def plant(doc):
    """The planted defects of PLANTED, on a pages document."""
    pages = doc["pages"]
    by = {p.get("id"): p for p in pages}
    moved = by["p03c"]
    pages.remove(moved)
    pages.insert(pages.index(by["p03b"]) + 1, moved)
    del moved["bar"]
    by["p10"]["form"] = "stack"
    del by["p01"]["points"]
    doc["deck"]["players"] = ["Northvale Rail", "Pennine Express", "Coastline Trains"]
    by["p26"]["exhibit"] = {"type": "chart.column", "heading": "Journeys by time of day, FY26", "unit": "% of journeys", "categories": ["Peak", "Off-peak"],
                            "series": [{"name": "Share", "values": [38, 62]}]}


class OnePassTests(unittest.TestCase):
    def test_fixing_what_a_run_reports_reveals_nothing_it_could_have_reported(self):
        result = run_node(PLANTED + '''
const first = await authorDeck(planted, { baseDir: dir });
// The repair of each finding, and nothing else: the bar and the points written back, the run of three broken,
// the players dropped, the chart given its series back, and the first alternative the fit search verified taken as it is listed.
const fixed = structuredClone(planted);
page(fixed, 'p03c').bar = original('p03c').bar;
page(fixed, 'p01').points = original('p01').points;
fixed.pages.splice(fixed.pages.indexOf(page(fixed, 'p03c')), 1);
fixed.pages.splice(clean.pages.indexOf(original('p03c')), 0, structuredClone(original('p03c')));
delete fixed.deck.players;
page(fixed, 'p26').exhibit = original('p26').exhibit;
const fit = first.blocking.find((f) => f.id === 'p10' && f.alternatives)?.alternatives;
Object.assign(page(fixed, 'p10'), fit.pass[0]);
const second = await authorDeck(fixed, { baseDir: dir });
console.log(JSON.stringify({ first: tell(first), second: tell(second), declared: first.declared, taken: fit.pass[0] }));
''')
        first = result["first"]
        # Every planted defect is reported in the one run, and nothing else is.
        self.assertEqual(sorted(((f["class"], f["code"], f["id"]) for f in first), key=str),
                         sorted([("S", "VARIETY_TYPE_RUN", None), ("S", "PLAYERS_UNMARKED", None), ("P", "COMPILE", "p01"), ("P", "COMPILE", "p03c"),
                                 ("P", "SCENE_VOID", "p10"), ("P", "TEXT_COVERAGE_LOW", "p26"), ("G", "CRAFT_TRIVIAL_CHARTS", None)], key=str))
        # The run of three is only there because the page that does not compile is counted as the type it declares.
        self.assertEqual(result["declared"], ["p01", "p03c"])
        self.assertTrue(next(f for f in first if f["code"] == "VARIETY_TYPE_RUN")["provisional"])
        # The aggregate is read from the pages that composed, and says so.
        self.assertTrue(next(f for f in first if f["code"] == "CRAFT_TRIVIAL_CHARTS")["partial"])
        # Structure first, then the pages in deck order, then the aggregates.
        self.assertEqual([f["class"] for f in first], ["S", "S", "P", "P", "P", "P", "G"])
        self.assertEqual([f["id"] for f in first if f["class"] == "P"], ["p01", "p03c", "p10", "p26"])
        self.assertEqual(result["taken"], {"form": "row", "commentary": "below"})
        self.assertEqual(result["second"], [], "the repaired deck reveals nothing the first run could have reported")

    def test_a_page_that_does_not_compile_neither_hides_nor_invents_a_deck_rule(self):
        # The executive summary failing to compile used to be reported as a deck with no summary whose answer no
        # claim carries: two findings that fixing the page would have cleared, and that sent the author to rewrite
        # the answer. The deck is read with the page standing in as what it declares.
        result = run_node(PLANTED + '''
const only = structuredClone(clean);
delete page(only, 'p01').points;
// A reader quotes the answer's first clause as its verdict (answer-lead).
const { judgementSession, withJudgements } = await import('./skills/professional-slides/runtime/judgements.mjs');
const reader = judgementSession({ oracle: (kind, answer) => (kind === 'answer-lead' ? { verdict: 'verdict', lead: answer.split(/[.;:,]/)[0] } : null) });
const run = await withJudgements(reader, () => authorDeck(only, { baseDir: dir }));
console.log(JSON.stringify({ blocking: tell(run), summary: run.standings.find((s) => s.code === 'NO_SUMMARY').line,
  answer: run.standings.filter((s) => s.code === 'CONTENT_ANSWER_UNCARRIED').map((s) => [s.key, s.state]) }));
''')
        self.assertEqual([(f["code"], f["id"]) for f in result["blocking"]], [("COMPILE", "p01")])
        self.assertIn("present: ok", result["summary"])
        # The titles' coverage, the opening title's lead, and its share of the whole answer.
        self.assertEqual(sorted(result["answer"]), [["coverage", "ok"], ["lead", "ok"], ["title", "ok"]])

    def test_a_page_that_does_not_compile_still_answers_for_what_it_rests_on(self):
        # Dependencies are read from the page as written, so a compile refusal on a page does not hold back
        # the finding on the measure its exhibit names.
        with tempfile.TemporaryDirectory() as tmp:
            for name in ("finance.pages.json", "finance.insights.json", "finance.analysis.json"):
                shutil.copy(FIXTURES / name, Path(tmp) / name)
            file = Path(tmp) / "finance.pages.json"
            doc = json.loads(file.read_text(encoding="utf-8"))
            page = next(p for p in doc["pages"] if p.get("type") and isinstance(p.get("exhibit"), dict) and p["exhibit"].get("basis"))
            page["why"] = "short"
            page["exhibit"]["basis"] = {**page["exhibit"]["basis"], "measures": ["no-such-insight/no-such-measure"]}
            file.write_text(json.dumps(doc), encoding="utf-8")
            run = cli(file, "--check")
            self.assertEqual(run.returncode, 2, run.stderr[-800:])
            log = [json.loads(line) for line in (Path(tmp) / "finance.author-log.jsonl").read_text().splitlines()][-1]
            mine = {f["code"] for f in log["findings"] if f.get("id") == page["id"]}
            self.assertIn("COMPILE", mine)
            self.assertIn("BASIS_UNKNOWN", mine)

    def test_the_report_runs_structure_then_pages_then_aggregates(self):
        with tempfile.TemporaryDirectory() as tmp:
            file = examples_deck(tmp, plant)
            run = cli(file, "--check")
            self.assertEqual(run.returncode, 2)
            report = run.stderr
            order = [report.index(header) for header in ("S. Deck structure", "P. Page-local", "G. Deck aggregates", "Where the deck stands:")]
            self.assertEqual(order, sorted(order))
            self.assertLess(report.index("COMPILE [p01]"), report.index("COMPILE [p03c]"))
            self.assertLess(report.index("COMPILE [p03c]"), report.index("SCENE_VOID [p10]"))
            self.assertIn("provisional: p01, p03c did not compile", report)
            # Nothing is written by a refused run, and the log keeps each finding's class.
            self.assertFalse((Path(tmp) / "page-types.deck.json").exists())
            log = json.loads((Path(tmp) / "page-types.author-log.jsonl").read_text().splitlines()[-1])
            self.assertEqual(sorted(f["class"] for f in log["findings"]), ["G", "P", "P", "P", "P", "S", "S"])


class StandingTests(unittest.TestCase):
    def test_every_run_says_where_the_deck_stands(self):
        with tempfile.TemporaryDirectory() as tmp:
            file = examples_deck(tmp)
            for flags in (["--draft"], ["--check"], []):
                run = cli(file, *flags)
                self.assertEqual(run.returncode, 0, run.stderr[-600:])
                summary = json.loads(run.stdout)
                self.assertIn("Where the deck stands:", run.stderr)
                for line in ("VARIETY_EXHIBIT_MIX.table.max: pages carried by a table", "VARIETY_TYPE_RUN: pages of one type in a row", "PAGE_SHAPE_FLAT.share: pages on the commonest architecture",
                             "NO_SUMMARY: an opening executive summary: present: ok", "PLAN_STYLE_ENTROPY.entropy"):
                    self.assertTrue(any(s.startswith(line) for s in summary["standing"]["S"]), (flags, line))
                for line in ("EVIDENCE_DEPTH: values the median chart page plots", "DECK_INK: median analytical page", "DECK_SCENE_VOID: pages thin", "DECK_CRAFT.highlight",
                             "TEXT_FRAGMENTED.floor: median words a block on the prose pages"):
                    self.assertTrue(any(s.startswith(line) for s in summary["standing"]["G"]), (flags, line))
                # The one rule only the render measures on the page's text is estimated from the scene, and says it is an estimate.
                self.assertTrue(all("estimated from the scene; the render measures it" in s for s in summary["standing"]["G"] if s.startswith("TEXT_FRAGMENTED")), flags)
                # The broken and the tight come first, so the line to act on is the first one read.
                tight = [s for s in summary["standing"]["S"] if "at the cap" in s or "at the floor" in s]
                self.assertIn("at the floor, 1 fewer blocks", " ".join(tight))
                self.assertEqual(summary["standing"]["S"][:len(tight)], tight)

    def test_a_deck_level_refusal_was_a_standing_line_the_run_before(self):
        # The worked example carries two-or-more-exhibit pages on 9 of its 44: at the floor. The run that passes
        # says so, in pages; one such page fewer is the refusal, and its standing says by how much.
        result = run_node(PLANTED + '''
const before = await authorDeck(structuredClone(clean), { baseDir: dir });
const fewer = structuredClone(clean);
fewer.pages = fewer.pages.filter((p) => p.id !== 'p26');
const after = await authorDeck(fewer, { baseDir: dir });
const line = (run) => run.standings.find((s) => s.code === 'VARIETY_PANELS');
console.log(JSON.stringify({ before: { blocking: tell(before), line: line(before).line, state: line(before).state }, after: { blocking: tell(after).map((f) => f.code), line: line(after).line } }));
''')
        self.assertEqual(result["before"]["blocking"], [])
        self.assertEqual(result["before"]["state"], "at")
        self.assertIn("9 of 44 pages, 20.5%; floor 20%: at the floor, 1 fewer blocks", result["before"]["line"])
        self.assertIn("VARIETY_PANELS", result["after"]["blocking"])
        self.assertIn("8 of 43 pages, 18.6%; floor 20%: short by 1 page - BLOCKS", result["after"]["line"])

    def test_an_aggregate_names_each_pages_part_in_it(self):
        result = run_node(PLANTED + '''
import { contributions } from './skills/professional-slides/runtime/deck-report.mjs';
const run = await authorDeck(structuredClone(clean), { baseDir: dir });
const depth = run.standings.find((s) => s.code === 'EVIDENCE_DEPTH'), ink = run.standings.find((s) => s.code === 'DECK_INK');
console.log(JSON.stringify({ depth: Object.keys(depth.each).length, ink: Object.keys(ink.each).slice(0, 3), part: contributions(run.standings, ['p03', 'p22b']) }));
''')
        self.assertGreater(result["depth"], 8)
        # The page gates name pages by position; the report names them by id.
        self.assertTrue(all(key.startswith("p") for key in result["ink"]), result["ink"])
        self.assertTrue(any(line.startswith("EVIDENCE_DEPTH: this page") for line in result["part"]["p03"]))
        self.assertTrue(any(line.startswith("DECK_INK: this page") for line in result["part"]["p22b"]))


class FitSearchTests(unittest.TestCase):
    def test_a_page_with_an_empty_band_lists_the_layouts_that_fit_is_left_as_written_and_the_search_is_bounded(self):
        result = run_node(PLANTED + '''
const only = structuredClone(clean);
page(only, 'p10').form = 'stack';
const before = JSON.stringify(only);
const run = await authorDeck(only, { baseDir: dir });
const found = run.blocking.find((f) => f.id === 'p10');
const fitOf = async (options) => (await authorDeck(structuredClone(only), { baseDir: dir, ...options })).blocking.find((f) => f.id === 'p10').alternatives;
const capped = await fitOf({ fitCap: 1 }), again = await fitOf({}), off = await fitOf({ fit: false });
console.log(JSON.stringify({ code: found.code, fit: found.alternatives, untouched: JSON.stringify(only) === before, compiledAs: run.spec.slides.find((s) => s.id === 'p10').arrange,
  count: run.blocking.length, capped, same: JSON.stringify(found.alternatives) === JSON.stringify(again), off: off ?? null }));
''')
        self.assertEqual(result["code"], "SCENE_VOID")
        self.assertEqual(result["count"], 1)
        fit = result["fit"]
        self.assertIn({"form": "row", "commentary": "below"}, fit["pass"])
        # An alternative that needs content the page lacks is listed with what it needs, and is not composed.
        needs = {f'{c["form"]}/{c["commentary"]}': item["needs"] for item in fit["needs"] for c in item["choices"]}
        self.assertIn("caption", needs["row/captions"])
        self.assertIn("three or four", needs["grid/below"])
        self.assertTrue(result["untouched"], "the search never applies an alternative")
        self.assertEqual(result["compiledAs"], "stack")
        # The search is bounded by a count of alternatives and by nothing else: no clock stops it, so a loaded machine gets the same answer.
        self.assertTrue(result["same"])
        self.assertEqual(fit["untried"], [])
        capped = result["capped"]
        self.assertEqual(len(capped["pass"]) + len(capped["fail"]), 1)
        self.assertEqual(len(capped["untried"]), 1)
        self.assertIn("1 alternatives a page are composed", capped["capped"])
        self.assertIsNone(result["off"])

    def test_the_repair_leads_with_the_verified_alternative(self):
        with tempfile.TemporaryDirectory() as tmp:
            def stack(doc):
                next(p for p in doc["pages"] if p.get("id") == "p10")["form"] = "stack"
            file = examples_deck(tmp, stack)
            run = cli(file, "--check")
            self.assertEqual(run.returncode, 2)
            self.assertIn('SCENE_VOID [p10]', run.stderr)
            self.assertIn('With the same content, form "row", commentary "below"', run.stderr)
            # Without a render the alternative is a pass of the scene's checks, and is called nothing more.
            self.assertIn('passes the scene checks: form "row", commentary "below"', run.stderr)
            self.assertIn("not rendered - what only a render shows is checked by `--check --render`", run.stderr)
            self.assertNotIn("(verified", run.stderr)
            self.assertIn("needs:  stack/captions", run.stderr)
            # A refused check writes no deck: its run log, and what the search composed, remembered beside the pages file.
            self.assertEqual(sorted(p.name for p in Path(tmp).iterdir()), ["assets", "page-types.author-cache.json", "page-types.author-log.jsonl", "page-types.pages.json"])
            cache_file = Path(tmp) / "page-types.author-cache.json"
            cache = json.loads(cache_file.read_text())
            verdicts = cache["fits"]["p10"]["verdicts"]
            self.assertEqual([v["remaining"] for v in verdicts][:1], [[]])
            # Each verdict that passed keeps its alternative's blocks, so a later run reads the shift against the band without composing again.
            self.assertTrue(all("blocks" in verdict for verdict in verdicts if not verdict["remaining"]), verdicts)
            self.assertTrue(all(set(verdict["blocks"]) == {"count", "wordsPerBlock", "prose"} for verdict in verdicts if "blocks" in verdict))
            # An entry whose key matches is used as it stands...
            cache["fits"]["p10"]["verdicts"][0]["remaining"] = ["PLANTED: a verdict only the cache holds"]
            cache_file.write_text(json.dumps(cache))
            again = cli(file, "--check")
            self.assertIn("PLANTED: a verdict only the cache holds", again.stderr)
            # ...and one whose key does not match is never trusted: the page changed, so it is searched again.
            cache_file.write_text(json.dumps(cache))
            doc = json.loads(file.read_text())
            next(p for p in doc["pages"] if p.get("id") == "p10")["why"] += " as read across the two stations"
            file.write_text(json.dumps(doc))
            changed = cli(file, "--check")
            self.assertNotIn("PLANTED", changed.stderr)
            self.assertIn('passes the scene checks: form "row", commentary "below"', changed.stderr)

    def test_the_alternatives_are_gated_in_one_call_and_held_to_the_decks_structure(self):
        # The machinery, with the deck's own functions replaced: every alternative of every page goes through the
        # page gates in one call, and one that passes them but would break a structure rule is not offered.
        result = run_node('''
import { alternativeChoices, fitSearch, fitLines } from './skills/professional-slides/runtime/fit-search.mjs';
const page = (id) => ({ id, type: 'schedule', form: 'timeline', commentary: 'below', title: 'T', exhibit: { items: [1, 2, 3, 4] }, points: ['a'] });
const targets = ['a', 'b'].map((id, index) => ({ id, page: page(id), index }));
let gateCalls = 0, composed = 0;
const fits = await fitSearch(targets, {
  spec: { slides: targets.map((t) => ({ id: t.id })) }, deck: { slides: [{ id: 'cover' }] }, perPage: 2,
  compile: (alt) => { if (alt.commentary === 'none') throw new Error(`${alt.id}: commentary "none" has no place for the points`); return { id: alt.id, form: alt.form, commentary: alt.commentary }; },
  compose: async (spec) => { composed += 1; return { deck: { slides: spec.slides.map((s) => ({ id: s.id, form: s.form, commentary: s.commentary })) }, pageErrors: [] }; },
  pageGates: (deck) => { gateCalls += 1; return { ran: true, findings: deck.slides.map((s, i) => (s.commentary === 'so-what-bar' ? { slide: i + 1, code: 'SCENE_VOID', severity: 'blocker', measured: { from: 400, to: 560 } } : null)).filter(Boolean) }; },
  localFindings: () => [], structure: (id, slide) => (id === 'b' && slide.commentary === 'beside' ? ['VARIETY_COLUMN'] : []),
  brief: (f) => `${f.code}: an empty band of ${f.measured.to - f.measured.from}px` });
console.log(JSON.stringify({ choices: alternativeChoices(page('a')).slice(0, 4), a: fits.get('a'), b: fits.get('b'), gateCalls, composed, lines: fitLines(fits.get('b')) }));
''')
        # Nearest first: the same form with another placement, then another form with the same placement.
        self.assertEqual([f'{c["form"]}/{c["commentary"]}' for c in result["choices"]], ["timeline/beside", "timeline/so-what-bar", "timeline/none", "gantt/below"])
        self.assertEqual(result["gateCalls"], 1, "one call to the page gates for every alternative of every page")
        self.assertEqual(result["composed"], 2, "a round a deck: both pages take their nth alternative together")
        self.assertEqual(result["a"]["pass"], [{"form": "timeline", "commentary": "beside"}])
        self.assertEqual(result["a"]["fail"], [{"form": "timeline", "commentary": "so-what-bar", "remaining": ["SCENE_VOID: an empty band of 160px"]}])
        self.assertEqual(result["b"]["pass"], [])
        self.assertEqual(result["b"]["fail"][0], {"form": "timeline", "commentary": "beside", "remaining": [], "structure": ["VARIETY_COLUMN"]})
        self.assertTrue(any("would break VARIETY_COLUMN (deck structure)" in line for line in result["lines"]["lines"]))
        self.assertTrue(any(line.startswith("needs:  timeline/none") for line in result["lines"]["lines"]))
        self.assertTrue(result["a"]["untried"] and "alternatives a page are composed" in result["a"]["capped"])
        self.assertIn("No other form or placement of this type fits", result["lines"]["lead"])


class PageRunTests(unittest.TestCase):
    def test_a_page_run_answers_for_its_pages_against_the_whole_deck(self):
        with tempfile.TemporaryDirectory() as tmp:
            file = examples_deck(tmp, plant)
            # A healthy page of a deck with blockers elsewhere: its run is clean, and it writes nothing.
            healthy = cli(file, "--check", "--page", "p07")
            self.assertEqual(healthy.returncode, 0, healthy.stderr[-600:])
            summary = json.loads(healthy.stdout)
            self.assertTrue(summary["ok"])
            self.assertTrue(any(line.startswith("EVIDENCE_DEPTH: this page") for line in summary["pages"]["p07"]))
            self.assertTrue(summary["standing"]["S"] and summary["standing"]["G"])
            self.assertEqual(sorted(summary["structureElsewhere"]), ["PLAYERS_UNMARKED", "VARIETY_TYPE_RUN"])
            self.assertIn("not counted in this run's exit code", healthy.stderr)
            self.assertFalse((Path(tmp) / "page-types.deck.json").exists())
            # The page with the empty band: its own finding, with its alternatives, and nobody else's.
            void = cli(file, "--check", "--page", "p10")
            self.assertEqual(void.returncode, 2)
            self.assertIn("1 finding to fix in page-types.pages.json (P 1)", void.stderr)
            self.assertIn("SCENE_VOID [p10]", void.stderr)
            self.assertNotIn("COMPILE [p01]", void.stderr)
            # A page whose declared type breaks a structure rule answers for the rule.
            run = cli(file, "--check", "--page", "p03c,p07")
            self.assertEqual(run.returncode, 2)
            # The run of three names it, and so does the players rule, which reads the first three analytical pages.
            self.assertIn("(S 2, P 1)", run.stderr)
            self.assertIn("VARIETY_TYPE_RUN", run.stderr.split("Where the deck stands:")[0])
            self.assertIn("COMPILE [p03c]", run.stderr)
            log = [json.loads(line) for line in (Path(tmp) / "page-types.author-log.jsonl").read_text().splitlines()]
            self.assertEqual(log[-1]["named"], ["p03c", "p07"])
            self.assertEqual(log[-1]["mode"], "page")
            # Without --check: still a report, never a write.
            self.assertEqual(cli(file, "--page", "p07").returncode, 0)
            self.assertFalse((Path(tmp) / "page-types.deck.json").exists())

    def test_a_page_run_names_only_pages_the_deck_has(self):
        with tempfile.TemporaryDirectory() as tmp:
            file = examples_deck(tmp)
            run = cli(file, "--check", "--page", "p99")
            self.assertEqual(run.returncode, 1)
            self.assertIn('No page "p99" in page-types.pages.json', run.stderr)


class PlanTests(unittest.TestCase):
    @staticmethod
    def spine(doc):
        # The worked deck cut back to its claims: it has no insight log and its exhibits plot typed numbers, so nothing here
        # says what a page will show. The plan still allocates it - that is what these tests read - and refuses it for what
        # the draft of its proposal would: bound facts the spine leaves to the layout (`unlayable`, below).
        keep = ("id", "title", "type", "why", "kind", "evidence", "settles")
        doc["pages"] = [{k: v for k, v in p.items() if k in keep} if p.get("type") else p for p in doc["pages"]]

    def test_a_spine_is_given_forms_and_placements_that_satisfy_the_structure_rules(self):
        with tempfile.TemporaryDirectory() as tmp:
            file = examples_deck(tmp, self.spine)
            before = file.read_text()
            run = cli(file, "--plan")
            plan = json.loads(run.stdout)
            # The allocation is whole and satisfies the structure rules. The run is refused all the same: read in the forms the
            # plan proposes, as the draft will read it, this spine leaves to the layout what the critique is bound to - numbers
            # its charts will plot that no measure records, and a summary with nothing to fill it.
            self.assertEqual(run.returncode, 2, run.stderr[-800:])
            self.assertEqual({f["code"] for f in plan["unlayable"]}, {"SPINE_UNDETERMINED", "SPINE_UNFILLED"})
            self.assertTrue(plan["plan"]["satisfied"])
            self.assertEqual(plan["plan"]["unsatisfied"], [])
            self.assertEqual(len(plan["plan"]["pages"]), 44)
            self.assertTrue(all(" proposed" in row for row in plan["plan"]["pages"]))
            # The forms a plan chooses freely cannot carry two exhibits on enough of these pages, so it takes a form
            # built for its own data on the fewest pages that mend the rule, and says what that form reads.
            special = [row for row in plan["plan"]["pages"] if "(reads its own data)" in row]
            self.assertTrue(0 < len(special) <= 3, special)
            self.assertIn("taken to meet a structure rule; this form reads", run.stderr)
            self.assertFalse([line for line in plan["standing"]["S"] if "BLOCKS" in line])
            # A page of panels has no exhibit yet and its form does not say what kind each is: the plan estimates them, marks the
            # page, and claims the rules are met only as far as the pages declare their exhibits.
            self.assertTrue(plan["plan"]["estimated"])
            self.assertEqual(sorted(row.split(" ")[0] for row in plan["plan"]["pages"] if "(exhibit estimated)" in row), sorted(plan["plan"]["estimated"]))
            self.assertTrue(all(row.split(" ")[1].split("/")[0] in ("panels", "numbers", "options") for row in plan["plan"]["pages"] if "(exhibit estimated)" in row))
            self.assertIn("Proposed allocation (satisfies every structure rule as far as the pages declare their exhibits; nothing was written", run.stderr)
            self.assertIn("is a reading of that estimate", run.stderr)
            self.assertEqual(file.read_text(), before, "a plan is a proposal: the pages file is not rewritten")
            # Nothing is written but the run log's line: a plan is a refusable run of the tool, and is counted (run-log.mjs).
            self.assertEqual(sorted(p.name for p in Path(tmp).iterdir()), ["assets", "page-types.author-log.jsonl", "page-types.pages.json"])
            logged = [json.loads(line) for line in (Path(tmp) / "page-types.author-log.jsonl").read_text().splitlines()]
            self.assertEqual([(entry["mode"], entry["ok"]) for entry in logged], [("plan", False)])
            self.assertEqual({f["code"] for f in logged[0]["findings"]}, {"SPINE_UNDETERMINED", "SPINE_UNFILLED"})
            # Every choice is one the catalogue compiles: a form of the type, a placement of the form.
            catalogue = run_node('''
import { PAGE_TYPES, placementsOf } from './skills/professional-slides/runtime/page-types.mjs';
console.log(JSON.stringify(Object.fromEntries(Object.entries(PAGE_TYPES).map(([type, t]) => [type, Object.fromEntries(Object.keys(t.forms).map((form) => [form, placementsOf(type, form)]))]))));
''')
            for row in plan["plan"]["pages"]:
                choice = row.split(" ")[1]
                kind, form, commentary = choice.split("/")
                self.assertIn(commentary, catalogue[kind][form], row)

    def test_a_declared_form_is_kept_and_only_its_placement_is_proposed(self):
        # A run declared a form on every page and left the placement to the plan: the plan reported "0 keep the form and
        # placement they declare", called every page "proposed" and replaced declared forms without saying so. A declared
        # form is a declared choice: it is kept while only its placement is open, and where a broken rule can be mended
        # no other way the change is reported as one, with the form the page declared.
        def forms_only(doc):
            keep = {"id", "kind", "type", "title", "why", "settles", "evidence", "form"}
            doc["pages"] = [{k: v for k, v in p.items() if k in keep} if p.get("type") else p for p in doc["pages"]]
        with tempfile.TemporaryDirectory() as tmp:
            file = examples_deck(tmp, forms_only)
            declared = {p["id"]: p["form"] for p in json.loads(file.read_text())["pages"] if p.get("type")}
            run = cli(file, "--plan")
            # Refused for the bound facts this cut-back spine leaves to the layout (above), with its allocation printed whole.
            self.assertEqual(run.returncode, 2, run.stderr[-800:])
            self.assertEqual({f["code"] for f in json.loads(run.stdout)["unlayable"]}, {"SPINE_UNDETERMINED", "SPINE_UNFILLED"})
            rows = json.loads(run.stdout)["plan"]["pages"]
            kept = [row for row in rows if row.split(" ")[1].split("/")[1] == declared[row.split(" ")[0]]]
            moved = [row for row in rows if row not in kept]
            self.assertGreaterEqual(len(kept), 40)
            self.assertTrue(all(row.split(" ")[2] == "placed" for row in kept), kept[:3])
            self.assertFalse([row for row in rows if " proposed" in row])       # no page with a declared form is "given" one
            # A form that does change is a reported change, never a silent proposal.
            for row in moved:
                self.assertIn(f"changed (declared {declared[row.split(' ')[0]]})", row)
            self.assertIn(f"0 keep the form and placement they declare, {len(kept)} keep the form they declare and are given a placement, 0 are given both, {len(moved)} would change", run.stderr)
            self.assertIn("form declared, placement proposed", run.stderr)

    def test_a_rule_the_types_alone_break_is_named_as_unsatisfiable(self):
        # The worked spine with every analytical page a trend. Which rules the page types alone break is read off the types,
        # not off how far the search looked, so the search is cut at a count here.
        result = run_node('''
import fs from 'node:fs';
import { planOf } from './skills/professional-slides/runtime/author-deck.mjs';
import { allocateStructure } from './skills/professional-slides/runtime/deck-structure.mjs';
const doc = JSON.parse(fs.readFileSync('skills/professional-slides/examples/page-types.pages.json', 'utf8'));
const keep = ['id', 'title', 'type', 'why', 'kind', 'evidence', 'settles'];
doc.pages = doc.pages.map((p) => (p.type ? Object.fromEntries(Object.entries(p).filter(([k]) => keep.includes(k))) : p));
for (const p of doc.pages) if (p.type && !['summary', 'statement'].includes(p.type)) p.type = 'trend';
const plan = allocateStructure(doc, { planOf, maxEvaluations: 200 });
console.log(JSON.stringify({ satisfied: plan.satisfied, unsatisfied: plan.unsatisfied.map((u) => ({ code: u.code, fixedByTypes: u.fixedByTypes })) }));
''')
        self.assertFalse(result["satisfied"])
        fixed = {u["code"] for u in result["unsatisfied"] if u["fixedByTypes"]}
        self.assertTrue({"VARIETY_TYPE_SHARE", "VARIETY_TYPE_RUN"} <= fixed, result["unsatisfied"])

    def test_a_plan_is_read_from_a_spine(self):
        with tempfile.TemporaryDirectory() as tmp:
            def untitled(doc):
                self.spine(doc)
                del next(p for p in doc["pages"] if p.get("id") == "p07")["title"]
            run = cli(examples_deck(tmp, untitled), "--plan")
            self.assertEqual(run.returncode, 2)
            self.assertIn("p07: needs its `title`", run.stderr)


class BuildParityTests(unittest.TestCase):
    """What the build checks before it renders is checked by the compile, under the build's own code."""

    def test_an_evaluation_too_short_is_refused_by_the_check_as_by_the_build(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            for name in ("finance.pages.json", "finance.insights.json", "finance.analysis.json"):
                shutil.copy(FIXTURES / name, work / name)
            file = work / "finance.pages.json"
            self.assertEqual(cli(file).returncode, 0)
            doc = json.loads(file.read_text(encoding="utf-8"))
            doc["deck"]["purpose"] = "evaluation"
            file.write_text(json.dumps(doc), encoding="utf-8")
            run = cli(file, "--check")
            self.assertEqual(run.returncode, 2)
            self.assertIn("EVALUATION_TOO_SHORT", run.stderr.split("Where the deck stands:")[0])
            self.assertIn("EVALUATION_TOO_SHORT: pages the deck composes, cover and appendix included", run.stderr)
            self.assertIn("floor 50: short by", run.stderr)
            # The build refuses the same deck under the same code: the check met it first.
            deck = work / "finance.deck.json"
            spec = json.loads(deck.read_text())
            spec["purpose"] = "evaluation"
            deck.write_text(json.dumps(spec))
            build = subprocess.run([NODE, str(SKILL / "runtime" / "build-deck.mjs"), str(deck), str(work / "out"), "--no-render", "--no-fetch"], cwd=ROOT, capture_output=True, text=True, timeout=300)
            self.assertEqual(build.returncode, 2)
            self.assertIn("EVALUATION_TOO_SHORT", build.stderr)

    def test_the_final_check_is_named_where_a_renderer_is_installed(self):
        result = run_node('''
import { describe } from './skills/professional-slides/runtime/doctor.mjs';
const binaries = { soffice: { found: true, path: '/usr/bin/soffice' }, pdftoppm: { found: true, path: '/usr/bin/pdftoppm' }, pdftotext: { found: true, path: '/usr/bin/pdftotext' } };
const reviewer = { host: 'claude', wanted: ['claude'], chosen: 'claude', ok: true, clis: { claude: { path: '/usr/bin/claude', signedIn: true }, codex: { path: null, signedIn: false } } };
const report = { ready: true, render: true, node: { version: '22.0.0', required: '>=20.9', ok: true }, python: { candidates: [], chosen: 'python3', export: null }, binaries, reviewer, optional: {}, install: [] };
console.log(JSON.stringify({ lines: describe(report) }));
''')
        self.assertTrue(any("--check --render" in line for line in result["lines"]))


if __name__ == "__main__":
    unittest.main()
