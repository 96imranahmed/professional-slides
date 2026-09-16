"""The shape of a deck, measured rather than reviewed.

The failure these gates exist for is a real deck: forty pages, twenty of them a
row of film posters with a caption under each, no sections, no tracker, every
comparison left as two columns of examples, and value labels printed inside the
bars. Nothing in it broke a geometric rule. So the rules are here: what carries
a page, how often a photograph may, whether a page reaches a verdict, and
whether a reader can tell where they are.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATES = ROOT / "skills" / "professional-slides" / "runtime" / "gates"
sys.path.insert(0, str(GATES))
import page_gates  # noqa: E402

from node_probe import run_node  # noqa: E402


def page(index, components=(), photos=0, texts=(), stacked=False):
    """A page as the gates see it: top-level component instances, image
    primitives and text nodes."""
    sid = f"s{index:02d}"
    instances = [{"id": "chrome", "component": "slide-chrome"}]
    for i, component in enumerate(components):
        frame = {"x": 60 + (0 if stacked else i * 300), "y": 162 + (i * 200 if stacked else 0),
                 "width": 560, "height": 180 if stacked else 400}
        instances.append({"id": f"{sid}-{i}", "component": component, "frame": frame})
    nodes = [{"type": "image", "role": "image",
              "frame": {"x": 60 + i * 260, "y": 200, "width": 240, "height": 200}}
             for i in range(photos)]
    nodes += [{"type": "text", "role": "body", "text": text} for text in texts]
    return {"id": sid, "componentInstances": instances, "nodes": nodes}


def deck(slides, **kw):
    return {"slides": [{"id": "cover", "componentInstances": [{"id": "cover", "component": "cover"}], "nodes": []}] + slides, **kw}


def codes(report):
    return {finding["code"] for finding in report["findings"]}


class PhotographBudgetTests(unittest.TestCase):
    def test_a_gallery_deck_is_rejected_on_pictures_mix_and_argument(self):
        # Eight picture pages in ten, six of them consecutive, captions only.
        slides = [page(i, ["image-frame", "image-frame", "image-frame"], photos=3,
                       texts=["A family whose arguments survive the adventure."])
                  for i in range(1, 9)]
        slides += [page(9, ["chart.bar"]), page(10, ["table"])]
        report = page_gates.run_gates(deck(slides))
        found = codes(report)
        self.assertIn("IMAGE_BUDGET", found)
        self.assertIn("IMAGE_RUN", found)
        self.assertIn("EVIDENCE_MIX", found)
        self.assertIn("MISSING_ARGUMENT", found)
        budget = next(f for f in report["findings"] if f["code"] == "IMAGE_BUDGET")
        self.assertEqual(budget["measured"]["share"], 0.8)
        self.assertIsNone(budget["slide"])

    def test_photographs_within_the_budget_pass(self):
        slides = [page(i, ["chart.column"]) for i in range(1, 8)]
        slides += [page(8, ["image-frame", "insight"], photos=1, texts=["Lockers cut the visit."])]
        slides += [page(9, ["table"]), page(10, ["chart.bar"])]
        found = codes(page_gates.run_gates(deck(slides)))
        self.assertNotIn("IMAGE_BUDGET", found)
        self.assertNotIn("IMAGE_RUN", found)
        self.assertNotIn("EVIDENCE_MIX", found)
        self.assertNotIn("MISSING_ARGUMENT", found)

    def test_structural_pages_may_carry_photographs(self):
        # A photo cover, a photo divider and a photo closing statement are free.
        structural = [
            {"id": "divider", "componentInstances": [{"id": "divider", "component": "section-divider"}],
             "nodes": [{"type": "image", "role": "image", "frame": {"x": 0, "y": 0, "width": 640, "height": 720}}]},
            {"id": "close", "componentInstances": [{"id": "close", "component": "statement"}],
             "nodes": [{"type": "image", "role": "image", "frame": {"x": 0, "y": 0, "width": 640, "height": 720}}]},
        ]
        slides = [page(i, ["chart.column"]) for i in range(1, 9)] + structural
        self.assertNotIn("IMAGE_BUDGET", codes(page_gates.run_gates(deck(slides))))


class ArgumentTests(unittest.TestCase):
    def test_a_two_panel_comparison_needs_a_verdict(self):
        slides = [page(1, ["image-frame", "image-frame"], photos=2, texts=["Marvel", "DC"])]
        self.assertIn("MISSING_ARGUMENT", codes(page_gates.run_gates(deck(slides))))
        with_verdict = [page(1, ["image-frame", "image-frame", "insight"], photos=2,
                             texts=["DC's standalone films outgross the MCU's by 12% a release."])]
        self.assertNotIn("MISSING_ARGUMENT", codes(page_gates.run_gates(deck(with_verdict))))

    def test_a_data_page_argues_through_its_title_and_marks(self):
        # A chart or table page carries its claim on the marks; it is not asked
        # for a side column as well.
        slides = [page(1, ["chart.bar"]), page(2, ["table"])]
        self.assertNotIn("MISSING_ARGUMENT", codes(page_gates.run_gates(deck(slides))))


class MetricStackTests(unittest.TestCase):
    def test_one_number_over_a_table_is_reported(self):
        slides = [page(1, ["metric", "table"], stacked=True)]
        self.assertIn("METRIC_STACK", codes(page_gates.run_gates(deck(slides))))

    def test_a_strip_of_three_over_a_table_is_a_row_of_measures(self):
        sid = "s01"
        instances = [{"id": "chrome", "component": "slide-chrome"}]
        for i in range(3):
            instances.append({"id": f"{sid}-{i}", "component": "metric",
                              "frame": {"x": 60 + i * 380, "y": 162, "width": 360, "height": 104}})
        instances.append({"id": f"{sid}-3", "component": "table",
                          "frame": {"x": 60, "y": 300, "width": 1160, "height": 300}})
        slide = {"id": sid, "componentInstances": instances, "nodes": []}
        self.assertNotIn("METRIC_STACK", codes(page_gates.run_gates(deck([slide]))))


class SeparatorTests(unittest.TestCase):
    def test_a_bullet_between_two_labels_is_reported(self):
        slides = [page(1, ["chart.bar"], texts=["1939 • Marvel Comics #1"])]
        report = page_gates.run_gates(deck(slides))
        self.assertIn("DOT_SEPARATOR", codes(report))
        self.assertEqual(next(f for f in report["findings"] if f["code"] == "DOT_SEPARATOR")["slide"], 2)

    def test_a_middle_dot_in_a_source_line_is_reported(self):
        slides = [page(1, ["chart.bar"], texts=["Sources: NYPD · 8 Sep 2026 · links in notes"])]
        self.assertIn("DOT_SEPARATOR", codes(page_gates.run_gates(deck(slides))))

    def test_an_interpunct_inside_a_word_is_left_alone(self):
        # "kW·h" is a unit, not two labels joined.
        slides = [page(1, ["chart.bar"], texts=["Storage cost per kW·h, 2019-2024"])]
        self.assertNotIn("DOT_SEPARATOR", codes(page_gates.run_gates(deck(slides))))

    def test_a_list_marker_is_not_a_separator(self):
        slides = [page(1, ["chart.bar"], texts=["• Letters volume fell 8% a year\n• Parcels grew"])]
        self.assertNotIn("DOT_SEPARATOR", codes(page_gates.run_gates(deck(slides))))


class DeckStructureTests(unittest.TestCase):
    def test_a_long_deck_without_sections_or_a_tracker_is_reported(self):
        slides = [page(i, ["chart.column"]) for i in range(1, 14)]
        self.assertIn("NO_SECTIONS", codes(page_gates.run_gates(deck(slides))))

    def test_sections_with_a_tracker_satisfy_it(self):
        slides = []
        for i in range(1, 14):
            slide = page(i, ["chart.column"])
            slide["nodes"].append({"type": "text", "role": "tracker-label", "text": "Where the money goes"})
            slides.append(slide)
        slides.append({"id": "divider", "componentInstances": [{"id": "divider", "component": "section-divider"}], "nodes": []})
        self.assertNotIn("NO_SECTIONS", codes(page_gates.run_gates(deck(slides))))

    def test_a_short_deck_is_left_alone(self):
        slides = [page(i, ["chart.column"]) for i in range(1, 9)]
        self.assertNotIn("NO_SECTIONS", codes(page_gates.run_gates(deck(slides))))

    def test_one_family_of_page_is_reported(self):
        slides = [page(i, ["cards"], photos=0, texts=["x"]) for i in range(1, 12)]
        found = codes(page_gates.run_gates(deck(slides)))
        self.assertIn("PAGE_VARIETY", found)
        self.assertIn("EVIDENCE_MIX", found)


class ComposerTests(unittest.TestCase):
    def test_a_lone_metric_over_a_table_becomes_the_side_column_number(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {composeSlide, composeDeck} from './skills/professional-slides/runtime/compose.mjs';
const table={type:'table',columns:['Criterion','Marvel','DC'],rows:[['Gross','$10.1bn','$2.8bn'],['Films','27','15']]};
// One tile above a table floats; it becomes the hero number beside its evidence.
const page=composeSlide({title:'T',metrics:[{value:'78%',label:'MCU share of combined gross'}],exhibit:table,soWhat:'The cohort decides it.'},0);
const row=page.items.find(i=>i.id==='s01-row');
assert.ok(row,'the page is a hero row, not a strip over a table');
assert.equal(row.items.filter(i=>i.component==='metric').length,0);
const side=row.items.find(i=>i.id==='s01-side');
const kpi=side.items.find(i=>i.component==='metric');
assert.equal(kpi.props.value,'78%');
assert.equal(kpi.props.tone,'hero');
// Three tiles still read as a strip of measures above the exhibit.
const strip=composeSlide({title:'T',metrics:['1','2','3'],exhibit:table,points:['a','b']},0);
assert.equal(strip.items[0].items.length,3);
// A comparison tints the side it decides for.
const find=(item)=>item.id==='s01-exhibit'?item:(item.items||[]).map(find).find(Boolean);
const cmp=(extra)=>find(composeSlide({title:'T',exhibit:{type:'compare',left:{heading:'Marvel',points:['27 films']},right:{heading:'DC',points:['15 films']},...extra},points:['a','b']},0).items.find(i=>i.id==='s01-row'));
assert.equal(cmp({}).props.highlightColumn,1,'before/after keeps the after column');
assert.equal(cmp({winner:'left'}).props.highlightColumn,0);
assert.equal(cmp({winner:'DC'}).props.highlightColumn,1);
assert.equal(cmp({winner:false}).props.highlightColumn,undefined);
assert.throws(()=>cmp({winner:'Neither'}),/winner/);
// A deck with sections tracks them by default; `agenda` tracks instead.
const spec=(extra)=>({schema:'professional-slides.deck/v3',id:'d',slides:[
  {kind:'section',title:'One'},{title:'A',points:['x','y']},
  {kind:'section',title:'Two'},{title:'B',points:['x','y']}],...extra});
const trackers=(deck)=>deck.slides.filter(s=>s.tracker).length;
assert.equal(trackers(composeDeck(spec({}))),2,'pills on both content pages');
assert.equal(trackers(composeDeck(spec({sectionTabs:false}))),0);
assert.equal(trackers(composeDeck(spec({agenda:true}))),0,'the contents page is the tracker instead');
assert.equal(composeDeck(spec({agenda:true})).slides.filter(s=>s.id&&String(s.id).startsWith('agenda')).length,2);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result["accepted"])


class OutsideLabelTests(unittest.TestCase):
    def test_the_native_emitter_leaves_headroom_and_never_labels_inside_a_bar(self):
        sys.path.insert(0, str(ROOT / "skills" / "professional-slides" / "runtime" / "emit"))
        import emit_pptx

        self.assertEqual(emit_pptx._nice_ceiling(619 * emit_pptx.LABEL_HEADROOM), 800)
        self.assertEqual(emit_pptx._nice_ceiling(4.2 * emit_pptx.LABEL_HEADROOM), 5)
        self.assertGreater(emit_pptx.LABEL_HEADROOM, 1.0)
        source = (ROOT / "skills" / "professional-slides" / "runtime" / "emit" / "emit_pptx.py").read_text()
        inside = [line for line in source.splitlines() if "INSIDE_END" in line]
        # Only a floating range band keeps an inside label: it has no outside.
        self.assertEqual(len(inside), 1)
        self.assertIn("lab.position = XL_LABEL_POSITION.INSIDE_END", inside[0])


if __name__ == "__main__":
    unittest.main()
