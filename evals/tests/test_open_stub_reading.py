"""An untyped stub has one reading: the plan's, the draft's and the critic's.

Two changes met on the exhibit a spine declares by a `basis` stub with no
`type`, on a page whose form leaves the kind to the author (panels, the chart
under a metric strip). The plan gives such a stub a kind - of the kinds that
carry its measures equally well, the one this deck's draw takes - and prints
it on the page's line. The draft completes the page and compiles it, and its
witness used to draw the stub as a bar or a line by the measure's axis,
whatever the plan had printed.

There is one reading now (author-deck.mjs openKindsByPage): the kind the plan
prints is the kind the draft's witness draws, the kind the draft stands the
stub in as for the structure rules, and its class is the class the critic is
told. Where the kind the plan gives could not be that - the stub as written
has the critic told another class, or the kind cannot be written from the
stub's measures - the draft refuses the page and names the kind.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, SKILL, run_node

AUTHOR = SKILL / "runtime" / "author-deck.mjs"
FIXTURE = ROOT / "evals" / "quality" / "fixtures" / "variety"
# The pages of the fixture's spine whose exhibits are of open kinds, as an author writes them before the critique: every cut
# of two panels pages declared by an untyped stub, the chart under a strip likewise, and a panels page whose stubs say what
# they are - a table by `as`, a donut by `type`.
STUBBED = {
    "v10": {"form": "row", "commentary": "captions", "exhibits": [{"basis": {"measures": [f"i-profile/{name}"]}} for name in ("punctuality", "cost", "fleet-age")]},
    "v19": {"form": "row", "commentary": "captions", "exhibits": [{"basis": {"measures": [f"i-money/{name}"]}} for name in ("revenue", "punctuality")]},
    "v05": {"form": "metric-strip", "commentary": "none", "metrics": [{"basis": {"measures": ["i-journeys/growth"]}}], "exhibit": {"basis": {"measures": ["i-journeys/journeys"]}}},
    "v24": {"form": "row", "commentary": "captions", "exhibits": [{"basis": {"measures": ["i-punctual/punctuality"], "as": "table"}}, {"type": "chart.donut", "basis": {"measures": ["i-revenue-parts/revenue"]}}]},
}
OPEN = ("v10", "v19", "v05")
SEEDS = ("a", "b")


def stage(tmp, seed):
    doc = json.loads((FIXTURE / "variety.pages.json").read_text(encoding="utf-8"))
    doc["deck"]["variation"] = seed
    doc["pages"] = [{**page, **STUBBED[page["id"]]} for page in doc["pages"] if page.get("id") in STUBBED]
    shutil.copy(FIXTURE / "variety.insights.json", Path(tmp) / "variety.insights.json")
    file = Path(tmp) / "variety.pages.json"
    file.write_text(json.dumps(doc), encoding="utf-8")
    return file


READ = '''
import fs from 'node:fs'; import path from 'node:path';
import * as A from './skills/professional-slides/runtime/author-deck.mjs';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
const dir = DIR, kinds = KINDS;
const doc = JSON.parse(fs.readFileSync(path.join(dir, 'variety.pages.json'), 'utf8'));
const insights = await A.readInsights(dir, 'variety', { alternatives: [] });
const measures = S.recordedMeasures([...insights.values()]);
const exhibitsOf = (page) => [page?.exhibit, ...(page?.exhibits ?? [])].filter((ex) => ex && typeof ex === 'object');
const pageOf = (pages, id) => pages.find((page) => String(page.id) === id);
// What a draft refuses of what a page declares it shows: the compile's refusal, an exhibit that cannot be drawn, a page left to the layout.
const BOUND = ['COMPILE', 'BINDING_UNRESOLVED', 'PAGE_DOES_NOT_COMPOSE', 'SPINE_UNDRAWABLE', 'SPINE_UNDETERMINED'];
const refused = (run) => run.blocking.filter((f) => BOUND.includes(f.code) && f.id !== undefined).map((f) => [String(f.id), f.code, String(f.repair).slice(0, 300)]);
const draft = await A.authorDeck(doc, { baseDir: dir, insights, draft: true, fit: false });
// What the critic is told: the packet of the storyline critique of this draft, as the loop writes it.
fs.writeFileSync(path.join(dir, 'variety.deck.json'), JSON.stringify(draft.spec));
const step = await S.prepareStoryline(path.join(dir, 'variety.deck.json'), path.join(dir, 'out'));
const packet = JSON.parse(fs.readFileSync(path.join(step.dir, 'packet.json'), 'utf8'));
fs.rmSync(step.dir, { recursive: true, force: true });
const told = (id) => Object.fromEntries(pageOf(packet.pages, id).measures.map((m) => [m.ref, (m.line.match(/\\[(?:not drawn yet: critiqued as|the page shows it) (plotted|tabulated|stated as a figure)/) ?? [])[1] ?? null]));
const viewsOf = (run, id) => Object.fromEntries(Object.entries(S.storyStructure(run.spec, measures).find((p) => p.id === id).views ?? {}).map(([ref, views]) => [ref, views.map((view) => JSON.parse(view)[0])]));
const hashes = (run) => S.storylinePageHashes(run.spec, measures);
// Laid out two ways. As the plan tells the author to: the kind it printed written on each untyped stub (a draft again). And in
// full: the draft's own witness - copy and unbound content added, the stub drawn - compiled as any pages file is.
const typed = { ...doc, pages: doc.pages.map((page) => { let at = -1; const give = (ex) => { at += 1; return ex && !ex.type && kinds[page.id]?.[at] ? { type: kinds[page.id][at], ...ex } : ex; };
  return { ...page, ...(page.exhibit ? { exhibit: give(page.exhibit) } : {}), ...(page.exhibits ? { exhibits: page.exhibits.map(give) } : {}) }; }) };
const named = await A.authorDeck(typed, { baseDir: dir, insights, draft: true, fit: false });
const laid = await A.authorDeck(draft.witness.doc, { baseDir: dir, insights, fit: false, fill: false });
const ids = doc.pages.map((page) => String(page.id));
console.log(JSON.stringify({ status: step.status, refused: refused(draft), namedRefused: refused(named), laidRefused: refused(laid),
  witness: Object.fromEntries(ids.map((id) => [id, exhibitsOf(pageOf(draft.witness.doc.pages, id)).map((ex) => ex.type ?? null)])),
  told: Object.fromEntries(ids.map((id) => [id, told(id)])), views: Object.fromEntries(ids.map((id) => [id, viewsOf(draft, id)])),
  binding: [S.storylineBinding(draft.spec, measures), S.storylineBinding(named.spec, measures), S.storylineBinding(laid.spec, measures), packet.binding],
  pages: Object.fromEntries(ids.map((id) => [id, [hashes(draft)[id], hashes(named)[id], hashes(laid)[id], packet.pageHashes[id]]])),
  share: (draft.standings.find((st) => st.code === 'VARIETY_KIND_SHARE')?.line ?? '') }));
'''

CLASS_WORDS = {"chart": "plotted", "table": "tabulated", "figure": "stated as a figure"}


def class_of(kind):
    return "chart" if kind.startswith("chart") else "table" if kind == "table" else "figure"


@unittest.skipUnless(NODE, "needs Node.js")
class OneReadingTests(unittest.TestCase):
    """The plan, the draft and the storyline packet on one spine, under two seeds."""

    @classmethod
    def setUpClass(cls):
        cls.runs = {}
        for seed in SEEDS:
            with tempfile.TemporaryDirectory() as tmp:
                file = stage(tmp, seed)
                plan = subprocess.run([NODE, str(AUTHOR), str(file), "--plan"], cwd=ROOT, capture_output=True, text=True, timeout=600)
                printed = json.loads(plan.stdout)["plan"]
                kinds = {page: printed["fit"][page]["kinds"] for page in OPEN}
                lines = {page: next(line for line in plan.stderr.splitlines() if line.startswith(f"  {page} ")) for page in STUBBED}
                # A strip's chart is the page's one exhibit: its kind is the first the plan gives the page.
                read = run_node(READ.replace("DIR", json.dumps(tmp)).replace("KINDS", json.dumps(kinds)))
                cls.runs[seed] = {"plan": printed, "kinds": kinds, "lines": lines, **read}

    def test_the_plan_prints_a_kind_for_every_untyped_stub_and_none_for_a_stub_that_says_what_it_is(self):
        for seed, run in self.runs.items():
            self.assertEqual({page: len(kinds) for page, kinds in run["kinds"].items()}, {"v10": 3, "v19": 2, "v05": 1}, seed)
            for page, kinds in run["kinds"].items():
                self.assertTrue(all(kind.startswith("chart.") for kind in kinds), (seed, page, kinds))
                self.assertIn(f"exhibits {', '.join(kinds)}", run["lines"][page], seed)
            self.assertNotIn("kinds", run["plan"]["fit"].get("v24", {}), seed)
        # The two seeds are two decks: a deck's hand gives the stubs of one reading task one kind, and not the same under both.
        self.assertNotEqual(self.runs["a"]["kinds"], self.runs["b"]["kinds"])

    def test_the_drafts_witness_draws_each_stub_as_the_kind_the_plan_printed(self):
        for seed, run in self.runs.items():
            self.assertEqual(run["refused"], [], seed)
            for page, kinds in run["kinds"].items():
                self.assertEqual(run["witness"][page], kinds, (seed, page))
            # A stub that says it is a table is drawn as one, and a typed stub as its type, under every seed.
            self.assertEqual(run["witness"]["v24"], ["table", "chart.donut"], seed)
            # And the draft counts them so for the structure rules, where it stands the stubs in as the same kinds: the three
            # panels of one ranking are three of the plan's kind, not three bars because their measures run over members.
            given = [kind for page in OPEN for kind in run["kinds"][page]]
            self.assertIn(f"{run['kinds']['v10'][0]} {given.count(run['kinds']['v10'][0])}", run["share"], seed)

    def test_the_critic_is_told_the_class_of_the_kind_the_plan_printed(self):
        stubs = {page: [ex["basis"]["measures"] for ex in ([spec["exhibit"]] if "exhibit" in spec else spec["exhibits"])] for page, spec in STUBBED.items()}
        for seed, run in self.runs.items():
            self.assertEqual(run["status"], "packet-written", seed)
            for page in STUBBED:
                for at, refs in enumerate(stubs[page]):
                    kind = run["witness"][page][at]
                    for ref in refs:
                        # In the packet's own words, and in the record the critique is bound to.
                        self.assertEqual(run["told"][page][ref], CLASS_WORDS[class_of(kind)], (seed, page, ref))
                        self.assertEqual(run["views"][page][ref], [class_of(kind)], (seed, page, ref))
            self.assertEqual(run["told"]["v24"]["i-punctual/punctuality"], "tabulated", seed)

    def test_laying_the_pages_out_with_the_kinds_the_plan_printed_leaves_the_binding_unchanged(self):
        for seed, run in self.runs.items():
            self.assertEqual(run["namedRefused"], [], seed)
            self.assertEqual(run["laidRefused"], [], seed)
            # One binding: the draft's, the same spine with the plan's kinds written on its stubs, its witness compiled in full,
            # and the packet the critic answers.
            self.assertEqual(len(set(run["binding"])), 1, (seed, run["binding"]))
            for page, hashes in run["pages"].items():
                self.assertEqual(len(set(hashes)), 1, (seed, page))
        # The binding holds the class and not the kind: two decks that draw the stubs two ways are bound to one spine.
        self.assertEqual(self.runs["a"]["binding"][0], self.runs["b"]["binding"][0])


@unittest.skipUnless(NODE, "needs Node.js")
class RefusedAndNamedTests(unittest.TestCase):
    """Where the kind the plan gives cannot be the one reading, the draft refuses the page and names the kind."""

    PROBE = '''
import fs from 'node:fs';
import { completePage } from './skills/professional-slides/runtime/spine-witness.mjs';
import { measureRegistry } from './skills/professional-slides/runtime/measures.mjs';
const log = JSON.parse(fs.readFileSync('./evals/quality/fixtures/variety/variety.insights.json', 'utf8')).insights;
const registry = measureRegistry(new Map(log.map((item) => [item.id, item])));
const page = (exhibits) => ({ id: 'x1', type: 'panels', form: 'row', commentary: 'captions', title: 'Punctuality leads the peers and fares carry the revenue', why: 'Two cuts side by side',
  evidence: ['i-punctual', 'i-cost-field'], settles: { kind: 'comparison', what: 'the two cuts', measures: ['i-punctual/punctuality', 'i-cost-field/cost'], relation: { kind: 'separate', reason: 'each is read alone' } }, exhibits });
const stub = (measure, more = {}) => ({ basis: { measures: [measure], ...more } });
const done = (exhibits, kinds) => { const made = completePage(page(exhibits), { registry, kinds: kinds ? new Map(kinds) : null }); return made.why ? { why: made.why, directed: made.directed === true } : { types: made.page.exhibits.map((ex) => ex.type), given: made.filled.exhibits.map((slot) => slot.given ?? null) }; };
const two = [stub('i-punctual/punctuality'), stub('i-cost-field/cost')];
console.log(JSON.stringify({ none: done(two, null), given: done(two, [[0, 'chart.lollipop'], [1, 'chart.column']]),
  // A scatter sets two measures against each other: one measure over its members cannot be written as one, and a bar can.
  unwritable: done(two, [[0, 'chart.scatter'], [1, 'chart.bar']]),
  // The stub says it is a table, so that is what the critic is told: a chart given to it would be another class.
  otherClass: done([stub('i-punctual/punctuality', { as: 'table' }), two[1]], [[0, 'chart.bar'], [1, 'chart.bar']]),
  // A typed stub is the author's: a kind given for its place is not read.
  typed: done([{ type: 'chart.bar', ...two[0] }, two[1]], [[0, 'chart.lollipop'], [1, 'chart.lollipop']]) }));
'''

    def test_a_kind_of_another_class_or_one_the_stubs_measures_cannot_be_written_as_is_refused_by_name(self):
        result = run_node(self.PROBE)
        # With no plan to read, a stub is drawn by its measure's axis, as it was.
        self.assertEqual(result["none"], {"types": ["chart.bar", "chart.bar"], "given": [None, None]})
        self.assertEqual(result["given"], {"types": ["chart.lollipop", "chart.column"], "given": ["chart.lollipop", "chart.column"]})
        self.assertEqual(result["typed"], {"types": ["chart.bar", "chart.lollipop"], "given": [None, "chart.lollipop"]})
        unwritable = result["unwritable"]
        self.assertTrue(unwritable["directed"])
        self.assertIn("exhibit 1's `basis` stub has no `type`, and the plan gives it `chart.scatter`", unwritable["why"])
        self.assertIn("which cannot be written from what the stub declares - a scatter sets 2 measures against each other", unwritable["why"])
        self.assertIn("write the exhibit's `type` on the stub (`chart.bar` plots its measure over members)", unwritable["why"])
        other = result["otherClass"]
        self.assertTrue(other["directed"])
        self.assertIn("the plan gives it `chart.bar`", other["why"])
        self.assertIn("which has the critic told i-punctual/punctuality plotted where the stub as written has it told tabulated", other["why"])


if __name__ == "__main__":
    unittest.main()
