"""The authoring surface: named passes, named shapes, and a key check.

The composer used to be one 337-line function of unnamed sequential rewrites
with no check on the keys it was handed, so a misspelled key composed silently
and produced a page missing the thing the author wrote. It is now an ordered
list of named passes over a declared vocabulary; these tests hold that shape.
"""
from __future__ import annotations

import unittest

from node_probe import run_node

COMPOSE = "./skills/professional-slides/runtime/compose.mjs"


class SlideKeyTests(unittest.TestCase):
    def test_a_misspelled_key_is_refused_with_the_key_it_meant(self):
        result = run_node(f'''
import assert from 'node:assert/strict';
import {{composeSlide}} from '{COMPOSE}';
const chart={{type:'chart.bar',categories:['a','b','c'],series:[{{name:'s',values:[1,2,3]}}]}};
// The page composes with the right spelling.
assert.ok(composeSlide({{id:'s01',title:'T',subtitle:'Measure',exhibit:chart}},0));
// And is refused with the wrong one, naming what it probably meant.
assert.throws(()=>composeSlide({{id:'s01',title:'T',subtitile:'Measure',exhibit:chart}},0),/unknown slide key/);
assert.throws(()=>composeSlide({{id:'s01',title:'T',subtitile:'Measure',exhibit:chart}},0),/subtitle/);
assert.throws(()=>composeSlide({{id:'s01',title:'T',footnote:[],exhibit:chart}},0),/footnotes/);
console.log(JSON.stringify({{ok:true}}));
''')
        self.assertTrue(result["ok"])

    def test_note_and_notes_are_documented_as_the_different_things_they_are(self):
        # One character apart and they do opposite things: `note` prints on the
        # page, `notes` never does. The vocabulary says which is which.
        result = run_node(f'''
import assert from 'node:assert/strict';
import {{SLIDE_KEYS}} from '{COMPOSE}';
assert.match(SLIDE_KEYS.note,/footnote/);
assert.match(SLIDE_KEYS.notes,/speaker notes/);
assert.match(SLIDE_KEYS.notes,/never on the page/);
console.log(JSON.stringify({{keys:Object.keys(SLIDE_KEYS).length}}));
''')
        self.assertGreaterEqual(result["keys"], 40)


class PassOrderTests(unittest.TestCase):
    def test_the_passes_run_in_the_order_the_pipeline_needs(self):
        result = run_node(f'''
import {{PASS_NAMES}} from '{COMPOSE}';
console.log(JSON.stringify({{passes:PASS_NAMES}}));
''')
        passes = result["passes"]
        # Footnote markers are attached before anything reads the exhibit, the
        # shape preset runs before the passes whose defaults it sets, and the
        # explicitly requested data table is built before it is stacked.
        self.assertLess(passes.index("footnotes"), passes.index("read-the-data"))
        self.assertLess(passes.index("shape"), passes.index("build-the-data-table"))
        self.assertLess(passes.index("build-the-data-table"), passes.index("stack-the-data-table"))
        self.assertLess(passes.index("split-into-small-multiples"), passes.index("build-the-data-table"))

    def test_a_failing_pass_says_which_pass_and_which_page(self):
        result = run_node(f'''
import assert from 'node:assert/strict';
import {{composeSlide}} from '{COMPOSE}';
const split={{type:'chart.column',heading:'H',categories:['a'],split:true,series:[{{name:'one',values:[1]}}]}};
assert.throws(()=>composeSlide({{id:'s04',title:'T',exhibit:split}},3),/s04 \\(split-into-small-multiples\\)/);
console.log(JSON.stringify({{ok:true}}));
''')
        self.assertTrue(result["ok"])


class PageShapeTests(unittest.TestCase):
    """The composition presets the shared reference names are shapes the composer builds."""

    def test_every_documented_shape_exists(self):
        import pathlib
        result = run_node(f'''
import {{SHAPE_NAMES}} from '{COMPOSE}';
console.log(JSON.stringify({{shapes:SHAPE_NAMES}}));
''')
        skill = (pathlib.Path(__file__).resolve().parents[2] / "skills" / "professional-slides" / "references" / "composition.md").read_text(encoding="utf-8")
        for shape in result["shapes"]:
            self.assertIn(f"`{shape}`", skill, f"The composition reference never names the {shape} shape")
        self.assertGreaterEqual(len(result["shapes"]), 5)

    def test_a_shape_sets_what_that_shape_needs_and_yields_to_the_page(self):
        result = run_node(f'''
import assert from 'node:assert/strict';
import {{composeSlide}} from '{COMPOSE}';
const chart={{type:'chart.column',heading:'Deal value',unit:'$B',categories:['2021','2022','2023'],
  series:[{{name:'PE',values:[42,37,30]}},{{name:'VC',values:[19,12,7]}}]}};
// A model page tabulates its own chart without being asked.
const model=composeSlide({{id:'s01',title:'T',shape:'model-page',exhibit:chart}},0);
assert.equal(model.density,'pre-read');
assert.equal(model.items.filter((i)=>i.id==='s01-exhibit').length,0,'the chart stacked over its table');
// The page's own density still wins over the shape's default.
assert.equal(composeSlide({{id:'s02',title:'T',shape:'model-page',density:'executive',exhibit:chart}},1).density,'executive');
// A shape that cannot be built from what the page carries says so.
assert.throws(()=>composeSlide({{id:'s03',title:'T',shape:'model-page',points:['a','b']}},2),/chart over its own data table/);
assert.throws(()=>composeSlide({{id:'s03',title:'T',shape:'nonsense',exhibit:chart}},2),/Unknown page shape/);
console.log(JSON.stringify({{ok:true}}));
''')
        self.assertTrue(result["ok"])


if __name__ == "__main__":
    unittest.main()
