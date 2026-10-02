"""One definition of a treated table, read by every treated-table share.

Three measures report the share of a deck's tables that carry a treatment:
DECK_CRAFT in the page gates (deck_gates.py craft_rates), the build bar
BAR_TABLES_TREATED (build-bars.mjs designStatistics) and the craft floor
CRAFT_TABLES_PLAIN (craft_gates.mjs sceneStatistics). They count the same
tables and call the same ones treated:

* every table on an analytical page, one by one, but a row block's small
  table - the row's evidence beside its bullets, which TABLE_TOO_SHORT
  exempts at authoring (page-types.mjs TABLE_ROWS);
* treated when it carries a treatment named in gates/table-treatments.json:
  heat cells, Harvey balls or dots, in-cell bars, state marks, logos, icons
  or a total band. Zebra banding is not one.

These tests hold the three to that, on the stored specimen and a composed deck.
"""

from __future__ import annotations

import gzip
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

from node_probe import ROOT, run_node

GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"
sys.path.insert(0, str(GATES))

import deck_gates  # noqa: E402
import page_gates  # noqa: E402

SPECIMEN = ROOT / "evals" / "cold-run" / "specimens" / "anthropic-vs-openai-2026" / "scene.json.gz"

# The three JavaScript counts of one scene file, and which tables it exempts.
MEASURES_JS = """
import fs from 'node:fs';
import zlib from 'node:zlib';
import {designStatistics, tableStatistics, rowBlockSmallTable} from './skills/professional-slides/runtime/build-bars.mjs';
import {sceneStatistics} from './skills/professional-slides/runtime/gates/craft_gates.mjs';
let raw = fs.readFileSync(process.env.TABLE_TREATMENT_SCENE);
if (raw[0] === 0x1f) raw = zlib.gunzipSync(raw);
const scene = JSON.parse(raw);
const design = designStatistics(scene), craft = sceneStatistics(scene), tables = tableStatistics(scene);
console.log(JSON.stringify({
  tables, design: { tables: design.tables, share: design.tablesTreated }, craft: { tables: craft.tables, treated: craft.tablesTreated },
  exempt: scene.slides.map((slide) => (slide.componentInstances || []).filter((c) => rowBlockSmallTable(slide, c)).map((c) => c.id)),
}));
"""


def python_counts(scene):
    """(tables, treated) as DECK_CRAFT counts them over the pages run_gates reads."""
    slides = scene["slides"]
    pages = [slides[i] for i in range(len(slides))
             if not page_gates.GENERATED_PAGE.match(str(slides[i].get("id") or "")) and not page_gates.is_cover(slides[i], i)]
    rates = deck_gates.craft_rates(pages)
    return len(rates.tables), round((rates.treated or 0) * len(rates.tables))


def exempt_in_python(scene):
    return [[c.get("id") for c in slide.get("componentInstances", []) if deck_gates.row_block_small_table(slide, c)]
            for slide in scene["slides"]]


def measures_in_node(path):
    os.environ["TABLE_TREATMENT_SCENE"] = str(path)
    return run_node(MEASURES_JS)


class OneCountTests(unittest.TestCase):
    def assert_one_count(self, scene, node):
        tables, treated = python_counts(scene)
        self.assertEqual((tables, treated), (node["tables"]["tables"], node["tables"]["treated"]))
        self.assertEqual((node["craft"]["tables"], node["craft"]["treated"]), (tables, treated))
        self.assertEqual(node["design"]["tables"], tables)
        self.assertEqual(node["design"]["share"], round(treated / tables, 2) if tables else None)
        self.assertEqual(exempt_in_python(scene), node["exempt"])

    def test_the_three_measures_count_the_stored_specimen_alike(self):
        scene = json.loads(gzip.decompress(SPECIMEN.read_bytes()))
        node = measures_in_node(SPECIMEN)
        self.assertGreater(node["tables"]["tables"], 10)
        self.assert_one_count(scene, node)

    def test_the_three_measures_count_a_composed_deck_alike(self):
        result = run_node("""
import { toDeckPlan } from './skills/professional-slides/runtime/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const plan = (slides) => planDeck(toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'd', slides })).deck;
const points = ['A point that says what the row shows and why it matters here.', 'A second point with the qualification.'];
const block = (label, rows) => ({ label, points, exhibit: { type: 'table', columns: [{ label: 'Measure', type: 'category' }, 'Value'], rows } });
const two = [['Before', 'about a dozen'], ['After', 'several hundred']];
const three = [['Before', 'about a dozen'], ['During', 'a few dozen'], ['After', 'several hundred']];
const towns = ['Leeds', 'York', 'Hull', 'Bath', 'Derby', 'Ely'];
console.log(JSON.stringify(plan([
  { id: 'a', title: 'Three measures of the account base in two rows each', layout: 'labelled-rows',
    blocks: [block('Large accounts', two), block('Enterprise breadth', two), block('Coding revenue', two)] },
  { id: 'b', title: 'Three measures of the account base in three rows each', layout: 'labelled-rows',
    blocks: [block('Large accounts', three), block('Enterprise breadth', three)] },
  { id: 'c', title: 'Six towns name their own mayor and set their own budget', exhibit: { type: 'table',
    columns: [{ label: 'Town', type: 'category' }, 'Mayor', 'Budget owner'], rows: towns.map((t) => [t, 'elected by the town council', 'the town clerk']) } },
  { id: 'd', title: 'The eastern lines carry most of the load', exhibit: { type: 'table',
    columns: [{ label: 'Line', type: 'category' }, { label: 'Share', unit: '%', heat: true }, 'Growth'], rows: [['North', '3', '12'], ['South', '2', '8'], ['East', '5', '21']] } },
  { id: 'e', title: 'The four lines add up to the network', exhibit: { type: 'table',
    columns: [{ label: 'Line', type: 'category' }, 'Riders', 'Cost'], rows: [['North', 'many', 'high'], ['South', 'some', 'mid'], ['East', 'few', 'low'], { style: 'total', cells: ['Network', 'all', 'all'] }] } },
])));
""")
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "scene.json"
            path.write_text(json.dumps(result), encoding="utf-8")
            node = measures_in_node(path)
        self.assert_one_count(result, node)
        # Two three-row tables on b, and c, d and e; a's two-row tables are exempt.
        self.assertEqual(node["tables"]["tables"], 5)
        self.assertEqual([len(ids) for ids in node["exempt"]], [3, 0, 0, 0, 0])
        treated = {slide["id"]: [deck_gates.table_treated(slide, c) for c in deck_gates.counted_tables(slide)] for slide in result["slides"]}
        self.assertEqual(treated["c"], [False], "a grid of words carries no treatment")
        self.assertEqual(treated["d"], [True], "heat cells")
        self.assertEqual(treated["e"], [True], "a total band")


class DefinitionTests(unittest.TestCase):
    @staticmethod
    def page(*nodes):
        return {"id": "p", "componentInstances": [{"id": "chrome", "component": "slide-chrome"}, {"id": "t", "instanceId": "p:t", "component": "table"}],
                "nodes": [{"role": "action-title", "type": "text", "text": "A finding"},
                          *({**n, "data": {**n.get("data", {}), "componentInstance": "p:t"}} for n in nodes)]}

    def treated(self, *nodes):
        slide = self.page(*nodes)
        return deck_gates.table_treated(slide, slide["componentInstances"][1])

    def test_zebra_banding_is_not_a_treatment(self):
        self.assertFalse(self.treated({"role": "table-zebra-band"}, {"role": "table-cell"}))
        self.assertFalse(self.treated({"role": "table-row-band", "data": {"rowStyle": "group"}}))

    def test_each_named_treatment_is_one(self):
        for node in ({"role": "table-cell", "data": {"cellType": "heatmap"}}, {"role": "table-rating-sector"},
                     {"role": "table-dot"}, {"role": "table-bar"}, {"role": "table-progress-fill"},
                     {"role": "table-status-pill"}, {"role": "table-check"}, {"role": "table-lamp"},
                     {"role": "table-header-logo"}, {"role": "table-logo"}, {"role": "table-cell-icon-glyph"},
                     {"role": "table-row-band", "data": {"rowStyle": "total"}}):
            with self.subTest(node=node):
                self.assertTrue(self.treated(node))

    def test_a_treatment_belongs_to_its_own_table(self):
        # Two tables on one page: the bars in the second do not treat the first.
        slide = {"id": "p", "componentInstances": [{"id": "t1", "instanceId": "p:t1", "component": "table"},
                                                   {"id": "t2", "instanceId": "p:t2", "component": "table"}],
                 "nodes": [{"role": "table-cell", "data": {"componentInstance": "p:t1"}},
                           {"role": "table-bar", "data": {"componentInstance": "p:t2"}}]}
        self.assertEqual([deck_gates.table_treated(slide, c) for c in slide["componentInstances"]], [False, True])

    def test_the_list_lives_in_one_file(self):
        lists = json.loads((GATES / "table-treatments.json").read_text(encoding="utf-8"))["treatments"]
        self.assertEqual(deck_gates.TABLE_TREATMENTS, lists)
        # No measure keeps a list of its own.
        for path in (GATES.parent / "build-bars.mjs", GATES / "craft_gates.mjs"):
            self.assertNotIn("const TREATMENT", path.read_text(encoding="utf-8"), path.name)
        self.assertNotIn("TREATED_ROLE", (GATES / "deck_gates.py").read_text(encoding="utf-8"))
        self.assertIn("table-treatments.json", (GATES.parent / "build-bars.mjs").read_text(encoding="utf-8"))
        self.assertIn("tableStatistics", (GATES / "craft_gates.mjs").read_text(encoding="utf-8"))


class RowBlockTests(unittest.TestCase):
    def test_the_threshold_is_the_one_table_too_short_holds_a_table_to(self):
        result = run_node("""
import { compilePage } from './skills/professional-slides/runtime/page-types.mjs';
import { scaffoldPage } from './skills/professional-slides/runtime/author-deck.mjs';
import { ROW_BLOCK_TABLE_ROWS } from './skills/professional-slides/runtime/build-bars.mjs';
const base = scaffoldPage('lookup');
Object.assign(base, { title: 'Eastern costs a third more to run than the electric lines',
  why: 'A lookup page holds the measures a reader compares line by line', settles: { kind: 'structure', what: 'Line operating statistics for FY26' },
  adds: 'The implication column says which line grows first and why' });
const rows = (n) => { const page = structuredClone(base); page.exhibit.rows = page.exhibit.rows.filter((r) => Array.isArray(r)).slice(0, n); return page; };
const error = (page) => { try { compilePage(page, 0); return null; } catch (e) { return e.message; } };
console.log(JSON.stringify({ threshold: ROW_BLOCK_TABLE_ROWS, under: error(rows(ROW_BLOCK_TABLE_ROWS - 1)), at: error(rows(ROW_BLOCK_TABLE_ROWS)) }));
""")
        self.assertEqual(result["threshold"], deck_gates.ROW_BLOCK_TABLE_ROWS)
        self.assertIn("TABLE_TOO_SHORT", result["under"] or "")
        self.assertNotIn("TABLE_TOO_SHORT", result["at"] or "")


if __name__ == "__main__":
    unittest.main()
