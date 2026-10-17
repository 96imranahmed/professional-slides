"""What a form reads, published (author-deck.mjs --schema <type>/<form>, --schema <kind>, --schema kinds).

`--schema <type>` set an exhibit down as `{ type: "object" }`, so a writer who
needed a timeline's items, a rollout's rows, a chart's `select` or a table's
heat read the renderers for them. These tests hold the reference to the code
it describes: every form of every type prints its fields, every key of a
kind's registered sample is described, every mark a chart can draw has its
shape and is listed for the charts that draw it, the forms the brief named
print what they read, and each output stays small enough to read in a turn.
"""
from __future__ import annotations

import json
import subprocess
import unittest

from node_probe import NODE, ROOT, RUNTIME, run_node


def schema(arg):
    run = subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), "--schema", arg], capture_output=True, text=True, cwd=ROOT, timeout=120)
    return run.returncode, run.stdout, run.stderr


def keys(fields):
    """Every field name an exhibit block describes, its marks, bound fields and conventions among them."""
    out = set()
    for key, value in (fields or {}).items():
        out.update(value) if key in ("marks", "bound", "conventions") and isinstance(value, dict) else out.add(key)
    return {key.split("[]")[0] for key in out}


class CatalogueTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = run_node("""
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { CHART_DECORATIONS } from './skills/professional-slides/runtime/chart-decorations.mjs';
import { PAGE_TYPES } from './skills/professional-slides/runtime/page-types.mjs';
import { KINDS, MARKS, formFields, kindFields } from './skills/professional-slides/runtime/form-fields.mjs';
const forms = Object.entries(PAGE_TYPES).flatMap(([type, t]) => Object.keys(t.forms).map((form) => [`${type}/${form}`, formFields(type, form)]));
const samples = Object.fromEntries(Object.keys(KINDS).filter((kind) => REGISTRY.get(kind)?.sample).map((kind) => [kind, { sample: Object.keys(REGISTRY.get(kind).sample), page: KINDS[kind].page ? Object.keys(KINDS[kind].page) : null, fields: kindFields(kind)?.exhibit ?? null }]));
const draws = Object.fromEntries([...REGISTRY.values()].filter((d) => d.category === 'chart' && d.decorations).map((d) => [d.id, d.decorations.draws]));
console.log(JSON.stringify({ forms: Object.fromEntries(forms), samples, decorations: Object.keys(CHART_DECORATIONS), marks: Object.keys(MARKS), draws }));
""")

    def test_every_form_of_every_type_prints_the_fields_it_reads(self):
        for name, fields in self.result["forms"].items():
            own = keys(fields.get("exhibit")) | (set(fields["page"]) - {"title", "why", "settles", "evidence", "subtitle", "takeaway", "source", "note", "footnotes", "highlight", "points", "paragraphs", "adds", "rail", "bar", "exhibits[].caption"})
            self.assertGreaterEqual(len(own), 1, f"{name} prints no field of its own")
            self.assertTrue(fields["commentary"], name)

    def test_every_key_of_a_kinds_sample_is_described(self):
        for kind, entry in self.result["samples"].items():
            described = set(entry["page"] or []) | keys(entry["fields"]) | {"title"}
            self.assertEqual([key for key in entry["sample"] if key not in described], [], f"{kind}: a key its sample writes is not in the reference")

    def test_every_mark_has_its_shape_and_each_chart_lists_the_marks_it_draws(self):
        self.assertEqual(sorted(set(self.result["decorations"]) - set(self.result["marks"])), [])
        line = self.result["forms"]["trend/line"]["exhibit"]
        listed = keys(line)
        for mark in self.result["draws"]["chart.line"]:
            self.assertIn(mark, listed)
        # A mark a chart does not draw is not offered: a bar chart draws no periods.
        self.assertNotIn("periods", self.result["forms"]["ranking/bar"]["exhibit"]["marks"])


class NamedFormsTests(unittest.TestCase):
    def test_a_chart_form_prints_its_series_bindings_marks_and_axis_bounds(self):
        code, out, _ = schema("trend/column")
        self.assertEqual(code, 0)
        fields = json.loads(out)
        self.assertEqual(fields["draws"], "chart.column")
        exhibit = keys(fields["exhibit"])
        for key in ("series", "categories", "select", "categoryBreaks", "highlights", "annotations", "yMin", "yMax", "dataTable", "valueFormat"):
            self.assertIn(key, exhibit, key)
        self.assertIn("categoryColumns", fields["exhibit"]["dataTable"])  # the runtime's own, named where it comes from
        self.assertNotIn("conventions", fields["exhibit"])
        self.assertIn("NICE_TICKS", fields["exhibit"]["yMin"])

    def test_schedule_forms_print_their_items_and_rows(self):
        rollout = json.loads(schema("schedule/rollout")[1])
        self.assertEqual(rollout["draws"], "initiative-rollout")
        self.assertIn("phases: string[one per year]", rollout["exhibit"]["rows"])
        self.assertIn("years", rollout["exhibit"])
        timeline = json.loads(schema("schedule/timeline")[1])
        self.assertIn("date? | period?", timeline["exhibit"]["items"])
        self.assertIn("eras", timeline["exhibit"])
        roadmap = json.loads(schema("schedule/roadmap")[1])
        self.assertIn("items", roadmap["exhibit"])

    def test_a_table_form_prints_its_columns_rows_heat_and_better(self):
        table = json.loads(schema("lookup/table")[1])["exhibit"]
        for key in ("columns", "rows", "columns[].heat", "columns[].better", "tokens"):
            self.assertIn(key, keys(table) | set(table), key)
        self.assertIn("heat?", table["columns"])
        self.assertIn('`better: "down"` turns it', table["columns[].heat"])
        harvey = json.loads(schema("scorecard/harvey")[1])
        self.assertIn('`type: "harvey"` cells, 0-4', harvey["coded"])

    def test_a_form_prints_what_it_requires_and_its_placements_fields(self):
        indexed = json.loads(schema("trend/indexed")[1])
        # The base and the subject default to the first period and the first series.
        self.assertEqual(indexed["required"][:2], ["categories", "series"])
        self.assertIn("series: 1-8", indexed["required"])
        self.assertIn("indexBase", indexed["exhibit"])
        self.assertIn("(rail)", indexed["page"]["rail"])
        rollout = json.loads(schema("parallel/labelled-rows")[1])
        self.assertIn("blocks", rollout["page"])

    def test_kinds_lists_each_kind_with_the_forms_that_draw_it_and_a_kind_prints_its_fields(self):
        code, out, _ = schema("kinds")
        self.assertEqual(code, 0)
        kinds = json.loads(out)
        self.assertEqual(kinds["kinds"]["chart.line"], "trend/line, trend/indexed")
        self.assertIn("scorecard/harvey", kinds["kinds"]["table"])
        self.assertIn("panels/row", kinds["typed"])
        self.assertIn("no form of its own", kinds["kinds"]["status-list"])
        code, out, _ = schema("chart.bar")
        self.assertEqual(code, 0)
        bar = json.loads(out)
        self.assertEqual(bar["drawnBy"], "ranking/bar, ranking/distribution")
        self.assertIn("categoryBreaks", bar["exhibit"]["marks"])
        code, _, err = schema("trend/nonesuch")
        self.assertEqual(code, 1)
        self.assertIn("its forms: line, column", err)

    def test_each_output_stays_compact(self):
        sizes = run_node("""
import { PAGE_TYPES } from './skills/professional-slides/runtime/page-types.mjs';
import { exhibitKinds, formFields } from './skills/professional-slides/runtime/form-fields.mjs';
const sizes = Object.entries(PAGE_TYPES).flatMap(([type, t]) => Object.keys(t.forms).map((form) => JSON.stringify(formFields(type, form), null, 1).length));
console.log(JSON.stringify({ most: Math.max(...sizes), kinds: JSON.stringify(exhibitKinds(), null, 1).length }));
""")
        self.assertLess(sizes["most"], 10000)
        self.assertLess(sizes["kinds"], 5000)


if __name__ == "__main__":
    unittest.main()
