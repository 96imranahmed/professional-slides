"""The authoring surface: named passes, named shapes, and a key check.

The composer used to be one 337-line function of unnamed sequential rewrites
with no check on the keys it was handed, so a misspelled key composed silently
and produced a page missing the thing the author wrote. It is now an ordered
list of named passes over a declared vocabulary; these tests hold that shape.
"""
from __future__ import annotations

import re
import unittest

from node_probe import REFERENCES, run_node

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


class ComposeErrorTests(unittest.TestCase):
    """A refusal says which page it is about.

    The runtime throws in hundreds of places and almost none of those messages
    name a page, so "A soWhat list needs at least one line" sent an author
    hunting through a fifty-page spec. `composeSlide` is the only place a page
    is composed and the only one that knows both its id and its title, so it
    names the page on the way out.
    """

    def compose_error(self, slide, index=0):
        return run_node(f'''
import {{composeSlide}} from '{COMPOSE}';
let message = '';
try {{ composeSlide({slide}, {index}); }}
catch (error) {{ message = error.message; }}
console.log(JSON.stringify({{message}}));
''')["message"]

    CHART = "{type:'chart.bar',categories:['a','b','c'],series:[{name:'s',values:[1,2,3]}]}"

    def test_a_refusal_names_the_page_and_its_title(self):
        # `soWhat: []` is refused deep in the composer, by a message that knows
        # nothing about which page it is building.
        message = self.compose_error(
            "{id:'finance-path',title:'The tariff keeps each year above the covenant',"
            f"exhibit:{self.CHART},soWhat:[]}}")
        self.assertTrue(message.startswith("finance-path"), message)
        self.assertIn("The tariff keeps each year above the covenant", message)
        self.assertIn("soWhat list", message)

    def test_a_message_that_already_names_its_page_is_not_named_twice(self):
        message = self.compose_error(
            f"{{id:'s02',title:'T',layout:'exhibit-left',exhibit:{self.CHART}}}", 1)
        self.assertEqual(message.count("s02"), 1, message)

    def test_a_page_with_no_id_is_named_by_its_position(self):
        message = self.compose_error(f"{{title:'T',exhibit:{self.CHART},soWhat:[]}}", 6)
        self.assertTrue(message.startswith("s07"), message)


class ClosedValueSetTests(unittest.TestCase):
    """A key with a fixed set of values names that set once.

    `implication` was spelled out in the composer's map, again in the error it
    throws, and again in composition.md and design.md - four files to edit to
    add one variant, and nothing noticing when one of them was missed. The
    composer exports the set, the error is built from it, and the references
    have to list exactly it.
    """

    def implications(self):
        return run_node(f'''
import {{IMPLICATION_NAMES}} from '{COMPOSE}';
console.log(JSON.stringify({{names: [...IMPLICATION_NAMES]}}));
''')["names"]

    def test_the_refusal_names_every_accepted_value(self):
        names = self.implications()
        result = run_node(f'''
import {{composeSlide}} from '{COMPOSE}';
const chart={{type:'chart.bar',categories:['a','b','c'],series:[{{name:'s',values:[1,2,3]}}]}};
let message = '';
try {{ composeSlide({{id:'s01',title:'T',layout:'exhibit-left',implication:'wiggle',exhibit:chart,
  points:[{{text:'A finding worth a line of its own.'}}]}},0); }}
catch (error) {{ message = error.message; }}
console.log(JSON.stringify({{message}}));
''')["message"]
        self.assertIn("unknown implication", result)
        for name in names:
            self.assertIn(f'"{name}"', result, f"the refusal does not offer {name}")
        self.assertIn("false", result, "the refusal does not offer the default")

    def test_the_references_list_exactly_the_accepted_values(self):
        names = set(self.implications())
        prose = (REFERENCES / "composition.md").read_text(encoding="utf-8")
        listed = set(re.findall(r'`"([a-z-]+)"`', prose.split("`implication` names the mark")[1].split("\n")[0]))
        self.assertEqual(
            listed, names,
            "composition.md and the composer disagree about what `implication` accepts")


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
