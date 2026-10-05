"""The words a block are estimated from the scene, and steer the plan and the fit search.

`TEXT_FRAGMENTED` holds the prose pages' median words a block inside the
middle half of the reference pages'. It is measured on the rendered PDF, so a
run first met it at the render: a plan had proposed "points below" on eight
chart pages, where the chart's own labels count as blocks and the points set
side by side read as one, and the deck could not reach the band.

So the same reading is applied to the composed scene: its text nodes' lines,
set on rows as pdftotext sets the rendered page, with a block ending where the
page leaves a band without text (gates/density_profile.py scene_blocks). The
unrendered compile prints the deck's standing from it, marked as an estimate
with the margin it was calibrated to; the plan composes each page that
carries its copy under each placement and steers its free choices away from
placements that take the median out of the band - a page with no copy yet has
no reading, and the plan prints no number for it; and the fit search does not
propose an alternative that does. The rule and its band are unchanged, and
only the render blocks on it. (That a written deck's plan reads the number its
check reads is held in test_author_loop_honesty, beside that check; that the
fit cache keeps each alternative's blocks, in test_authoring_loop.)
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, RUNTIME, SKILL, run_node

sys.path.insert(0, str(RUNTIME / "gates"))
import density_profile  # noqa: E402

EXAMPLES = SKILL / "examples"


def text(role, x, y, lines, line_height=20, width=400):
    return {"type": "text", "role": role, "text": "\n".join(lines), "frame": {"x": x, "y": y, "width": width, "height": line_height * len(lines)},
            "data": {"textLayout": {"lineHeight": line_height, "lines": lines}}}


def label(role, x, y, words, height=20):
    return {"type": "text", "role": role, "text": words, "frame": {"x": x, "y": y, "width": 60, "height": height}}


class SceneBlockTests(unittest.TestCase):
    def test_blocks_are_read_off_the_scene_as_the_render_reads_them(self):
        point = ["Marlow lent eighty two thousand books to its readers", "in the year, nine thousand more than the branch in", "second place, and has ranked first every year since."]
        slide = {"id": "p1", "readingTask": "chart-with-commentary", "nodes": [
            text("action-title", 60, 58, ["Marlow lends more books than any other branch"], 36),
            text("tracker-compact-label", 60, 30, ["Contents / The branch"], 16),
            text("section-heading", 60, 154, ["Loans, the ten busiest branches"], 24),
            # A point beside the chart, and a second one a paragraph's space below it.
            text("list-item", 840, 178, point), text("list-item", 840, 300, point),
            # A chart's labels on the first point's rows are part of its block; a value alone on a row past it is a label, and dropped.
            label("category-label", 60, 200, "MRL"), label("data-label", 400, 200, "82.4"),
            label("data-label", 400, 420, "47.3"),
            text("source-text", 60, 683, ["Source: branch returns 2025"], 12), label("page-number", 1196, 683, "20", 12),
        ]}
        blocks = density_profile.scene_blocks(slide)
        words = sum(len(line.split()) for line in point)
        # The heading and the first point run on with no band between them, with the chart's row; the second point stands alone.
        self.assertEqual(blocks, [5 + words + 2, words])
        # The title, the tracker, the source line and the page number are left out, as on the rendered page.
        profile = density_profile.scene_fragmentation({"slides": [{"id": "cover", "nodes": []}, slide]})
        self.assertEqual([p["blocks"] for p in profile["pages"]], [2])
        self.assertEqual(profile["pages"][0]["prose"], True)

    def test_the_deck_standing_is_an_estimate_that_never_blocks(self):
        point = ["a point of four words"] * 3
        page = lambda n, task: {"id": f"p{n}", "readingTask": task, "nodes": [text("list-item", 60, 200, point), text("list-item", 60, 400, point)]}  # noqa: E731
        scene = {"slides": [{"id": "cover", "nodes": []}, *[page(n, "chart-with-commentary") for n in range(9)], page(9, "chart-led")]}
        standings = density_profile.scene_fragmentation(scene)["standings"]
        self.assertEqual([(s["code"], s["key"], s["side"], s["bar"]) for s in standings],
                         [("TEXT_FRAGMENTED", "floor", "min", density_profile.TEXT_FORM["wordsPerBlock"]["q1"]), ("TEXT_FRAGMENTED", "ceiling", "max", density_profile.TEXT_FORM["wordsPerBlock"]["q3"])])
        for standing in standings:
            self.assertEqual([standing["value"], standing["estimated"], standing["blocks"], standing["applies"], standing["tolerance"]], [15, True, False, True, density_profile.SCENE_TOLERANCE])
            self.assertEqual(len(standing["each"]), 9)      # the prose pages, each with its own figure; a chart-led page is not one
        # The margin the estimate is said with is one figure in both languages.
        tolerance = run_node("import { BLOCK_ESTIMATE_TOLERANCE } from './skills/professional-slides/runtime/deck-structure.mjs'; console.log(JSON.stringify({ tolerance: BLOCK_ESTIMATE_TOLERANCE }));")
        self.assertEqual(tolerance["tolerance"], density_profile.SCENE_TOLERANCE)


class CompileEstimateTests(unittest.TestCase):
    def test_an_unrendered_compile_says_where_the_deck_stands_and_that_it_is_an_estimate(self):
        result = run_node('''
import fs from 'node:fs';
import { authorDeck } from './skills/professional-slides/runtime/author-deck.mjs';
import { standingLine } from './skills/professional-slides/runtime/gates/gate_classes.mjs';
const dir = './skills/professional-slides/examples';
const doc = JSON.parse(fs.readFileSync(`${dir}/page-types.pages.json`, 'utf8'));
const run = await authorDeck(doc, { baseDir: dir, fit: false });
const standings = run.standings.filter((st) => st.code === 'TEXT_FRAGMENTED');
const base = { code: 'TEXT_FRAGMENTED', key: 'floor', what: 'median words a block on the prose pages', bar: 41.3, side: 'min', unit: 'words', applies: true, blocks: false, estimated: true, tolerance: 4 };
console.log(JSON.stringify({ standings: standings.map((st) => ({ key: st.key, value: st.value, estimated: st.estimated, blocks: st.blocks, line: st.line, each: Object.keys(st.each ?? {}).length })),
  blocking: run.blocking.filter((f) => f.code === 'TEXT_FRAGMENTED').length, budget: run.budget.filter((b) => b.blocks).length,
  near: standingLine({ ...base, value: 39.8 }), far: standingLine({ ...base, value: 30 }) }));
''')
        self.assertEqual([s["key"] for s in result["standings"]], ["floor", "ceiling"])
        for standing in result["standings"]:
            self.assertTrue(standing["estimated"])
            self.assertFalse(standing["blocks"])
            self.assertIn("estimated from the scene; the render measures it: --check --render", standing["line"])
            self.assertGreater(standing["each"], 8)
            self.assertGreater(standing["value"], 20)
        self.assertEqual(result["blocking"], 0)
        self.assertGreater(result["budget"], 30)        # every page's budget carries its own blocks
        # Inside the margin it was calibrated to, the estimate does not call the render's verdict; well outside it, it does.
        self.assertIn("short by 1.5 words - inside the estimate's margin of 4 words: the render decides", result["near"])
        self.assertIn("short by 11.3 words - would block at the render", result["far"])


class PlanEstimateTests(unittest.TestCase):
    def test_the_plan_steers_its_free_choices_by_the_estimate_and_never_refuses_on_it(self):
        result = run_node('''
import fs from 'node:fs';
import { allocateStructure } from './skills/professional-slides/runtime/deck-structure.mjs';
import { planOf } from './skills/professional-slides/runtime/author-deck.mjs';
// The worked deck cut back to a spine: every page keeps its type and form, and two keep the points below they declare.
const src = JSON.parse(fs.readFileSync('skills/professional-slides/examples/page-types.pages.json', 'utf8'));
const keep = ['id', 'kind', 'type', 'form', 'why', 'title', 'settles', 'evidence'];
let kept = 0;
const doc = { deck: src.deck, pages: src.pages.map((p) => p.type ? Object.fromEntries(Object.entries(p).filter(([k]) => keep.includes(k) || (k === 'commentary' && p.commentary === 'below' && kept++ < 2))) : p) };
const declared = doc.pages.filter((p) => p.commentary).map((p) => p.id);
// A stand-in for the composed estimate: three placements break a page's text into 20-word blocks, the others hold 45.
const SHORT = ['below', 'on-exhibit', 'none'];
const blocksOf = (p, choice) => ({ count: 4, wordsPerBlock: SHORT.includes(choice.commentary) ? 20 : 45, prose: true });
const steered = allocateStructure(doc, { planOf, blocksOf }), plain = allocateStructure(doc, { planOf });
const worst = allocateStructure(doc, { planOf, blocksOf: () => ({ count: 4, wordsPerBlock: 20, prose: true }) });
const sizes = (plan) => plan.pages.filter((p) => p.type).map((p) => SHORT.includes(p.commentary) ? 20 : 45).sort((a, b) => a - b);
const median = (v) => (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
const changed = (plan) => plan.pages.filter((p) => p.source === 'changed').map((p) => `${p.id} ${p.form}`).sort();
const at = (plan, id) => plan.pages.find((p) => p.id === id).commentary;
console.log(JSON.stringify({ pages: sizes(plain).length, declared: declared.map((id) => at(steered, id)), medians: [median(sizes(steered)), median(sizes(plain))], changed: [changed(steered), changed(plain)],
  forms: doc.pages.filter((p) => p.type).every((p) => steered.pages.find((q) => q.id === p.id).form === plain.pages.find((q) => q.id === p.id).form),
  estimate: steered.structure.standings.filter((st) => st.estimated).map((st) => [st.code, st.key, st.value, st.blocks, st.tolerance]), plain: plain.structure.standings.filter((st) => st.estimated).length,
  unsatisfied: [steered.unsatisfied.map((u) => u.code), plain.unsatisfied.map((u) => u.code), worst.unsatisfied.map((u) => u.code)],
  worst: worst.structure.standings.filter((st) => st.estimated && st.key === 'floor').map((st) => st.value) }));
''')
        low = density_profile.TEXT_FORM["wordsPerBlock"]["q1"]
        self.assertEqual(result["pages"] % 2, 0)
        # The two declared placements are kept: no declared choice is changed for an estimate, and no form is.
        self.assertEqual(result["declared"], ["below", "below"])
        self.assertEqual(result["changed"][0], result["changed"][1])   # what the structure rules change, and nothing more
        self.assertTrue(result["forms"])
        # Steered, enough open pages take a placement that keeps the text whole and still satisfies the same rules, and the deck
        # stands inside the band - never further from it than the structure rules alone leave it (which, with points under the
        # exhibit held to an eighth of the deck, is inside it here too; the worst case below is the one steering cannot lift).
        self.assertGreaterEqual(result["medians"][0], result["medians"][1])
        self.assertGreaterEqual(result["medians"][0], low)
        self.assertEqual({(code, key) for code, key, _, _, _ in result["estimate"]}, {("TEXT_FRAGMENTED", "floor"), ("TEXT_FRAGMENTED", "ceiling")})
        self.assertTrue(all(blocks is False and tolerance == density_profile.SCENE_TOLERANCE for _, _, _, blocks, tolerance in result["estimate"]))
        self.assertEqual(result["estimate"][0][2], result["medians"][0])
        self.assertEqual(result["plain"], 0)                     # without an estimate the plan says nothing of the rule
        # An estimate never makes a plan unsatisfied: the rule is the render's - even where no placement reaches the band.
        self.assertEqual(result["unsatisfied"][0], result["unsatisfied"][1])
        self.assertEqual(result["unsatisfied"][2], result["unsatisfied"][1])
        self.assertEqual(result["worst"], [20])

    def stage(self):
        """The worked deck cut back to a spine that writes no copy, in a folder of its own."""
        tmp = Path(tempfile.mkdtemp(prefix="fragment-plan-"))
        self.addCleanup(shutil.rmtree, tmp, True)
        shutil.copytree(EXAMPLES / "assets", tmp / "assets")
        doc = json.loads((EXAMPLES / "page-types.pages.json").read_text())
        keep = {"id", "kind", "type", "form", "commentary", "why", "title", "settles", "evidence", "exhibit", "exhibits", "metrics", "kpi", "blocks", "rows", "photo", "pictures"}
        doc["pages"] = [{k: v for k, v in page.items() if k in keep} if page.get("type") else page for page in doc["pages"]]
        (tmp / "page-types.pages.json").write_text(json.dumps(doc))
        return tmp / "page-types.pages.json"

    def test_the_plan_prints_no_number_for_copy_that_is_not_written(self):
        # A run's plan printed "median words a block 48.1; floor 41.3: 6.8 words to spare" from pages composed with a stand-in
        # for their copy - three points of 56 words - and the first check of the written deck measured 24.8: nine pages changed
        # form after the critique was ready. Words a block are a property of the copy, so a spine has no reading: the plan
        # prints the rule and what a block is, and no number.
        plan = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), str(self.stage()), "--plan"], capture_output=True, text=True, cwd=ROOT, timeout=600)
        printed = json.loads(plan.stdout)
        self.assertNotIn("estimated", printed["standing"], plan.stderr[-1500:])
        self.assertNotRegex(plan.stderr, r"TEXT_FRAGMENTED\.(floor|ceiling): median words a block on the prose pages \d")
        low, high = density_profile.TEXT_FORM["wordsPerBlock"]["q1"], density_profile.TEXT_FORM["wordsPerBlock"]["q3"]
        self.assertIn(f"TEXT_FRAGMENTED is not read here: ", plan.stderr)
        self.assertIn(f"pages carry no copy yet, and the rule is on the copy - the prose pages' median words a block, held between {low} and {high}", plan.stderr)
        self.assertIn("`--check` prints the deck's standing from the composed pages as soon as they carry copy", plan.stderr)
        self.assertNotIn("TEXT_FRAGMENTED", [item["code"] for item in printed["plan"]["unsatisfied"]])


class FitSearchEstimateTests(unittest.TestCase):
    def test_an_alternative_that_takes_the_deck_out_of_the_band_is_not_proposed(self):
        result = run_node('''
import { fitSearch, fitLines } from './skills/professional-slides/runtime/fit-search.mjs';
const page = { id: 'p1', type: 'trend', form: 'line', commentary: 'beside', title: 't', why: 'w', points: ['a', 'b'], exhibit: { categories: ['a'], series: [] } };
const shifts = [];
const search = (aggregate) => fitSearch([{ id: 'p1', page, index: 0 }], { spec: { slides: [{ id: 'p1' }] }, deck: { slides: [{ id: 'cover', nodes: [] }] }, perPage: 2,
  compile: (p) => ({ id: 'p1', form: p.form, commentary: p.commentary }), compose: async (spec) => ({ deck: { slides: [{ id: 'p1', nodes: [] }] }, pageErrors: [] }),
  // The page budget's estimate of each alternative's blocks, by its place in the gated batch.
  pageGates: (deck) => ({ ran: true, findings: [], budget: deck.slides.map((slide, at) => ({ slide: at + 1, id: slide.id, blocks: { count: 5, wordsPerBlock: 20 + at, prose: true } })) }),
  localFindings: () => [], structure: () => [], brief: (f) => f.code, aggregate });
const out = (await search((id, blocks) => { shifts.push([id, blocks.wordsPerBlock]); return blocks.wordsPerBlock < 22 ? [`would take the deck's median words a block under its band - an estimated ${blocks.wordsPerBlock}`] : []; })).get('p1');
const free = (await search(null)).get('p1');
console.log(JSON.stringify({ pass: out.pass.length, fail: out.fail.map((alt) => alt.aggregate ?? null), lines: fitLines(out).lines.filter((line) => line.startsWith('fails')), shifts, free: free.pass.length }));
''')
        self.assertEqual(result["free"], 2)       # with nothing read off the text, both alternatives pass
        self.assertEqual(result["pass"], 1)       # the one that takes the median out of the band is not proposed
        self.assertEqual(len(result["fail"]), 1)
        self.assertIn("would take the deck's median words a block under its band", result["fail"][0][0])
        self.assertIn("would take the deck's median words a block under its band", result["lines"][0])
        self.assertEqual([wpb for _, wpb in result["shifts"]], [21, 22])   # each alternative is asked with its own blocks


if __name__ == "__main__":
    unittest.main()
