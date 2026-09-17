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


class WeightContractTests(unittest.TestCase):
    """The density floors a deck (or its template) sets, and the gates that read
    them. Density is not the defect the gates exist for; empty is."""

    def scene(self, slides, **kw):
        return deck(slides, **kw)

    def test_the_floors_follow_the_fill_level(self):
        slides = [page(1, ["chart.bar"], texts=["short"])]
        balanced = page_gates.run_gates(self.scene(slides))
        self.assertEqual(balanced["weight"]["pageWords"], 95)
        airy = page_gates.run_gates(self.scene(slides, fill="airy"))
        self.assertEqual(airy["weight"]["pageWords"], 0)
        self.assertNotIn("THIN_PAGE", codes(airy))
        self.assertIn("THIN_PAGE", codes(balanced))

    def test_a_declared_weight_overrides_the_fill_default(self):
        slides = [page(1, ["chart.bar"], texts=["a b c d e f g h i j"])]
        report = page_gates.run_gates(self.scene(slides, weight={"pageWords": 5}))
        self.assertEqual(report["weight"]["pageWords"], 5)
        self.assertNotIn("THIN_PAGE", codes(report))

    def test_a_short_column_and_shallow_points_are_reported(self):
        sid = "s01"
        instances = [
            {"id": "chrome", "component": "slide-chrome"},
            {"id": f"{sid}-0", "component": "chart.bar", "frame": {"x": 60, "y": 162, "width": 700, "height": 460}},
            {"id": f"{sid}-1", "component": "section", "frame": {"x": 820, "y": 162, "width": 360, "height": 460}},
        ]
        nodes = [
            {"type": "text", "role": "list-item", "text": "Wealth grew", "frame": {"x": 830, "y": 180, "width": 340, "height": 20}},
            {"type": "text", "role": "list-item", "text": "Retail flat", "frame": {"x": 830, "y": 210, "width": 340, "height": 20}},
        ]
        instances[-1]["id"] = f"{sid}-side"
        slide = {"id": sid, "componentInstances": instances, "nodes": nodes}
        found = codes(page_gates.run_gates(deck([slide])))
        self.assertIn("THIN_COLUMN", found)
        self.assertIn("POINT_DEPTH", found)

    def test_the_report_carries_the_density_numbers(self):
        slides = [page(1, ["chart.bar"], texts=["a b c"])]
        report = page_gates.run_gates(deck(slides))
        density = report["density"]
        self.assertEqual(density["pageWords"]["floor"], 95)
        self.assertEqual(density["pageWords"]["referenceMedian"], 196)
        self.assertIn("columnFill", density)
        self.assertIn("plotSpan", density)

    def test_the_runtime_and_the_gates_read_one_contract(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {resolveWeight, WEIGHT_BY_FILL, normalizeWeight} from './skills/professional-slides/runtime/weight.mjs';
import {composeDeck, applyTemplate} from './skills/professional-slides/runtime/compose.mjs';
// Fill sets the floors; the deck overrides them; a bad key is refused.
assert.equal(resolveWeight({}, 'full').pageWords, WEIGHT_BY_FILL.full.pageWords);
assert.equal(resolveWeight({weight:{pageWords:150}}, 'balanced').pageWords, 150);
assert.throws(()=>normalizeWeight({nope:1}),/Unknown/);
assert.throws(()=>normalizeWeight({columnFill:4}),/between/);
// The contract reaches the deck plan, so the gates judge the same numbers.
const spec={schema:'professional-slides.deck/v3',id:'d',fill:'full',slides:[{title:'T',points:['a','b']}]};
assert.equal(composeDeck(spec).weight.pageWords, WEIGHT_BY_FILL.full.pageWords);
assert.equal(composeDeck({...spec,weight:{pageWords:111}}).weight.pageWords, 111);
// A template's house profile carries fill and weight into a deck that sets neither.
const house={schema:'professional-slides.house/v1',palette:{base:'bcg',id:'h',label:'H',colors:{}},fill:'full',weight:{pageWords:140,columnFill:0.7}};
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'house-'));
fs.writeFileSync(path.join(dir,'house.json'), JSON.stringify(house));
const applied=applyTemplate({schema:'professional-slides.deck/v3',id:'d',template:'house.json',slides:[]}, dir);
assert.equal(applied.fill,'full');
assert.equal(applied.weight.pageWords,140);
// An explicit deck weight still wins over the template's.
const kept=applyTemplate({schema:'professional-slides.deck/v3',id:'d',template:'house.json',weight:{pageWords:80},slides:[]}, dir);
assert.equal(kept.weight.pageWords,80);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result["accepted"])

    def test_the_side_column_fills_its_track_unless_the_deck_is_airy(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const chart={type:'chart.bar',categories:['a','b','c','d'],series:[{name:'s',values:[1,2,3,4]}]};
const side=(slide,fill)=>composeSlide(slide,0,process.cwd(),fill).items.find(i=>i.id==='s01-row').items.find(i=>i.id==='s01-side');
const page={title:'T',exhibit:chart,points:['one','two','three']};
assert.equal(side(page,'balanced').items[0].props.distribute,true,'a balanced column spreads its points');
assert.equal(side(page,'full').items[0].props.distribute,true);
assert.equal(side(page,'airy').items[0].props.distribute,undefined,'an airy deck keeps its air');
// A thin column narrows and gives the width to the exhibit.
assert.equal(side(page,'balanced').size.width.fr,0.8);
const deep={title:'T',exhibit:chart,points:[
 {lead:'Wealth nearly doubled',text:'Advisory fees grew 18% a year while lending margins compressed, so the mix shifted to fee income across the book.'},
 {lead:'Corporate slipped',text:'Lending margins compressed through the rate cycle and the corporate book lost a fifth of its contribution.'},
 {lead:'Retail held',text:'Deposit growth offset the fee decline, leaving retail flat against a falling market.'}]};
assert.equal(side(deep,'balanced').size.width.fr,1);
// A number alone in the column takes no filler heading.
assert.equal(side({title:'T',exhibit:chart,kpi:{value:'78%',label:'share'}},'balanced').heading,undefined);
assert.equal(side(page,'balanced').heading,'What it means');
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result["accepted"])

    def test_bar_weight_follows_the_category_count(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const registry=createRegistry();
const frame={x:0,y:0,width:600,height:400};
const draw=(n)=>{
  const categories=Array.from({length:n},(_,i)=>`c${i}`);
  const props={categories,series:[{name:'s',values:categories.map((_,i)=>10+i)}],heading:'H'};
  const nodes=registry.get('chart.column').render({id:'c',frame,props}).nodes;
  const marks=nodes.filter(node=>node.role==='chart-mark');
  return marks[0].frame.width/(frame.width/n);
};
assert.ok(draw(3)>draw(8),'few categories take fatter bars');
assert.ok(draw(3)>0.6,'three bars are not ribbons');
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result["accepted"])


class BannerAndRangeTests(unittest.TestCase):
    """The exhibit banner is one line, and a floating band prints its ends
    outside itself, in ink."""

    def test_a_two_line_banner_is_reported(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const registry=createRegistry();
const frame={x:0,y:0,width:720,height:60};
const render=(props)=>registry.get('chart-title').render({id:'h',frame,props}).nodes;
// A unit written as a sentence pushes the band to two lines; the heading node
// records the fallback so the gates can report it.
const long=render({heading:'Published annual pay for research-connected PM roles',unit:'$k, published base-salary band',unitPlacement:'inline'});
const wrapped=long.find(n=>(n.data||{}).headingWrapped);
assert.ok(wrapped,'the fallback is recorded');
// A heading and a real unit fit on one line and nothing is recorded.
const short=render({heading:'Published annual pay for PM roles at AI labs',unit:'$k',unitPlacement:'inline'});
assert.equal(short.find(n=>(n.data||{}).headingWrapped),undefined);
assert.equal(short.find(n=>n.role==='chart-unit').data.chartUnitPlacement,'inline');
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result["accepted"])

    def test_the_gate_reads_the_recorded_fallback(self):
        slide = {
            "id": "s01",
            "componentInstances": [
                {"id": "chrome", "component": "slide-chrome"},
                {"id": "s01-0", "component": "chart.bar", "frame": {"x": 60, "y": 162, "width": 700, "height": 440}},
            ],
            "nodes": [
                {"type": "text", "role": "section-heading", "text": "Published annual pay for research-connected PM roles",
                 "frame": {"x": 60, "y": 140, "width": 700, "height": 40},
                 "data": {"headingWrapped": True, "textLayout": {"source": "Published annual pay for research-connected PM roles"}}},
            ],
        }
        report = page_gates.run_gates(deck([slide]))
        self.assertIn("HEADING_WRAPS", codes(report))

    def test_a_range_chart_is_drawn_so_its_ends_read_in_ink(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {nativeChartSpec} from './skills/professional-slides/runtime/core.mjs';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const props={categories:['A','B'],low:[305,385],high:[385,460],heading:'H',unit:'$k'};
// PowerPoint can only label inside a stacked band, so the range chart stays shapes.
assert.equal(nativeChartSpec('chart.range',props,{x:0,y:0,width:600,height:300}),null);
const nodes=createRegistry().get('chart.range').render({id:'r',frame:{x:0,y:0,width:600,height:300},props}).nodes;
const marks=nodes.filter(n=>n.role==='chart-mark');
const labels=nodes.filter(n=>n.role==='data-label');
assert.equal(labels.length,4,'a low and a high label per band');
const low=labels.find(n=>n.data.end==='low'), high=labels.find(n=>n.data.end==='high');
const band=marks[0];
assert.ok(low.frame.x+low.frame.width<=band.frame.x+1,'the low value sits left of the band');
assert.ok(high.frame.x>=band.frame.x+band.frame.width-1,'the high value sits right of it');
assert.equal(low.style.color.tokenId,'color.ink');
assert.equal(high.style.color.tokenId,'color.ink');
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result["accepted"])


class CorpusCalibrationTests(unittest.TestCase):
    """The floors are calibrated against the reference corpus, and the page can
    carry the furniture that corpus carries."""

    def test_ink_floors_track_the_measured_corpus(self):
        # 192 sampled pages of published client decks: median ink 19%, lower
        # quartile 12%. A balanced page floors just under that quartile.
        self.assertGreaterEqual(page_gates.FILL_LEVELS["balanced"]["ink_min"], 0.11)
        self.assertGreaterEqual(page_gates.FILL_LEVELS["full"]["ink_min"], 0.13)
        self.assertLess(page_gates.FILL_LEVELS["airy"]["ink_min"], 0.11)
        self.assertEqual(page_gates.REFERENCE_PAGE["inkMedian"], 0.19)

    def test_a_small_image_is_a_mark_not_a_photograph(self):
        # The reference pages carry a small image on about half their pages
        # (median 0.5% of the page): logos, icons, spot art. The photograph
        # budget is about decoration, so it starts at 3% of the canvas.
        def slide_with(width, height):
            return {"id": "s01", "componentInstances": [{"id": "chrome", "component": "slide-chrome"},
                                                        {"id": "s01-0", "component": "image-frame",
                                                         "frame": {"x": 60, "y": 162, "width": width, "height": height}}],
                    "nodes": [{"type": "image", "role": "image", "frame": {"x": 60, "y": 162, "width": width, "height": height}},
                              {"type": "text", "role": "list-item", "text": "The mark is not the argument"}]}
        icons = [slide_with(120, 100) for _ in range(8)]
        for index, slide in enumerate(icons, start=1):
            slide["id"] = f"s{index:02d}"
            slide["componentInstances"][1]["id"] = f"s{index:02d}-0"
        self.assertNotIn("IMAGE_BUDGET", codes(page_gates.run_gates(deck(icons))))
        photos = [slide_with(600, 400) for _ in range(8)]
        for index, slide in enumerate(photos, start=1):
            slide["id"] = f"s{index:02d}"
            slide["componentInstances"][1]["id"] = f"s{index:02d}-0"
        self.assertIn("IMAGE_BUDGET", codes(page_gates.run_gates(deck(photos))))

    def test_a_page_carries_numbered_notes(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const page=composeSlide({title:'T',points:['a','b'],note:['Excludes the 2019 disposal','FY22 basis; figures may not sum']},0);
assert.equal(page.note,'Notes: 1. Excludes the 2019 disposal   2. FY22 basis; figures may not sum');
assert.equal(composeSlide({title:'T',points:['a'],note:'Single line'},0).note,'Note: Single line');
assert.equal(composeSlide({title:'T',points:['a'],note:[]},0).note,undefined);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result["accepted"])


class FurnitureTests(unittest.TestCase):
    """The density the corpus carries and we did not: numbered footnotes bound to
    a label, a chart that tabulates itself, and a table that goes denser before
    it splits."""

    def test_footnotes_mark_their_label_and_print_numbered(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const chart={type:'chart.column',heading:'Annual investment',unit:'$B',categories:['2019','2020','2021','2022','2023'],series:[{name:'Deal value',values:[48,62,70,62,39]}],change:{from:'2022',to:'2023'}};
const page=composeSlide({title:'Activity declined between 2022 and 2023',exhibit:chart,points:['Deal value fell by a third'],
  footnotes:[{on:'2022',text:'2022 includes two $4B+ deals that did not repeat'},{text:'Values are announced enterprise values'}]},0);
assert.equal(page.note,'Notes: 1. 2022 includes two $4B+ deals that did not repeat   2. Values are announced enterprise values');
const find=(item)=>item.component?[item]:(item.items||[]).flatMap(find);
const drawn=page.items.flatMap(find).find(i=>String(i.component||'').startsWith('chart.'));
// The marker lands on the printed label, and the annotation that names the same
// category still resolves, because inside an exhibit every occurrence is marked.
assert.deepEqual(drawn.props.categories,['2019','2020','2021','2022\\u00b9','2023']);
assert.equal(drawn.props.changeAnnotations[0].start,'2022\\u00b9');
// The title still highlights the category it names, marker or not.
assert.equal(drawn.props.highlights[0].category,'2022\\u00b9');
// Nine is the limit, and a footnote needs text.
assert.throws(()=>composeSlide({title:'T',points:['a'],footnotes:Array.from({length:10},()=>({text:'x'}))},0),/at most nine/);
assert.throws(()=>composeSlide({title:'T',points:['a'],footnotes:[{on:'x'}]},0),/needs text/);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result["accepted"])

    def test_a_chart_can_tabulate_itself(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const page=composeSlide({title:'T',points:['a','b'],exhibit:{type:'chart.column',heading:'Revenue',unit:'$m',
  categories:['FY23','FY24','FY25'],series:[{name:'Revenue',values:[52,58.4,61]},{name:'Cost',values:[47,51,55]}],dataTable:true}},0);
const find=(item)=>item.component?[item]:(item.items||[]).flatMap(find);
const parts=page.items.flatMap(find);
assert.ok(parts.find(i=>String(i.component||'').startsWith('chart.')),'the chart stays the hero');
const table=parts.find(i=>i.component==='table');
// Values print the way the chart's own labels do: whole numbers from ten up.
assert.deepEqual(table.props.rows,[['Revenue','52','58','61'],['Cost','47','51','55']]);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result["accepted"])

    def test_a_dense_table_cell_is_allowed_below_body_type(self):
        slide = {"id": "s01", "componentInstances": [{"id": "chrome", "component": "slide-chrome"},
                                                     {"id": "s01-0", "component": "table",
                                                      "frame": {"x": 60, "y": 162, "width": 1160, "height": 460}}],
                 "nodes": [{"type": "text", "role": "table-cell-text", "text": "Region 1",
                            "style": {"fontSize": {"value": 9.0}},
                            "frame": {"x": 60, "y": 200, "width": 200, "height": 16}},
                           {"type": "text", "role": "paragraph", "text": "Prose stays at body size",
                            "style": {"fontSize": {"value": 9.0}},
                            "frame": {"x": 60, "y": 240, "width": 400, "height": 16}}]}
        report = page_gates.run_gates(deck([slide]))
        findings = [f for f in report["findings"] if f["code"] == "TYPE_RANGE"]
        roles = {f["measured"]["role"] for f in findings}
        self.assertIn("paragraph", roles)
        self.assertNotIn("table-cell-text", roles)


class BandFurnitureTests(unittest.TestCase):
    """The band above the title, the headers on a label table and the second
    statement box: the small furniture the reference pages carry page after page."""

    def test_a_kicker_prints_above_the_title_and_yields_to_a_left_tracker(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck, component} from './skills/professional-slides/runtime/core.mjs';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const REGISTRY=createRegistry(), frame={x:0,y:0,width:1280,height:720};
const chrome=(props)=>compileDeck({slides:[{id:'s1',frame,composition:component({id:'chrome',component:'slide-chrome',frame,
  props:{title:'Drivers are the most exposed occupation',source:'Source: fixture',...props}})}]},REGISTRY).slides[0].nodes;
const kickerOf=(nodes)=>nodes.filter(n=>n.role==='kicker');
const titleOf=(nodes)=>nodes.find(n=>n.role==='action-title');

const plain=chrome({});
const withKicker=chrome({kicker:'People'});
const label=kickerOf(withKicker);
assert.equal(label.length,1,'the kicker renders');
assert.equal(label[0].text,'People');
// It sits above the title, which steps down to make room for it.
assert.ok(label[0].frame.y < titleOf(withKicker).frame.y);
assert.ok(titleOf(withKicker).frame.y > titleOf(plain).frame.y);
// One line only: the band is furniture, not a second title.
assert.throws(()=>chrome({kicker:'A whole sentence of argument that belongs in the title of the page instead'}),/one line/);

// Pills hug the right margin, so the kicker keeps the left of that row.
const pills=chrome({kicker:'People',tracker:{construction:'compact-pills',items:[{id:'A',label:'Where'},{id:'B',label:'Why'},{id:'C',label:'What next'}],selectedId:'B'}});
assert.equal(kickerOf(pills).length,1,'a pill tracker leaves the left of the row free');
// A left-anchored tracker already names the section, so it wins the slot.
const breadcrumb=chrome({kicker:'People',tracker:{construction:'compact-label',items:[{id:'A',label:'Where the exposure sits'},{id:'B',label:'Why it persists'},{id:'C',label:'What to do'}],selectedId:'A'}});
assert.equal(kickerOf(breadcrumb).length,0,'the tracker wins the slot');
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_two_statements_read_as_a_pair_centred_on_the_exhibit(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const rows=[{label:'Passenger vehicle drivers',text:'2.1k jobs, 82% Black or African American'},
            {label:'Light truck drivers',text:'0.3k jobs, 77% Black or African American'}];
const side=(page)=>{const walk=(item)=>String(item.id||'').endsWith('-side')?[item]:(item.items||[]).flatMap(walk);
  return page.items.flatMap(walk)[0];};
const two=composeSlide({title:'T',rows,insights:['Four in five workers are Black or African American','Automation potential runs above 70%']},0);
const column=side(two);
const boxes=column.items.filter(i=>i.component==='insight');
assert.equal(boxes.length,2,'both statements are placed');
// A reading, then its consequence: the first plain in the column, the second in
// the box under it. Two equal boxes read as two unrelated labels.
assert.deepEqual(boxes.map(b=>b.props.variant),['plain','tonal']);
// Statements and nothing else are read against the exhibit, so the pair centres
// on it rather than hugging the top of the track or spreading down it.
assert.equal(column.leftover,'center');
const one=composeSlide({title:'T',rows,insights:['Four in five workers are Black or African American']},0);
const single=side(one);
assert.equal(single.items.find(i=>i.component==='insight').props.variant,'tonal','one statement is the box');
assert.equal(single.leftover,'center');
assert.throws(()=>composeSlide({title:'T',rows,insights:['a','b','c']},0),/at most two insights/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_a_column_of_statement_boxes_stacks_instead_of_spreading(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {flow, component, resolveLayout} from './skills/professional-slides/runtime/core.mjs';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
// Nothing in a column of hugged boxes can absorb the slack, so distributing it
// pins one box to the top of the track and the other to the bottom.
const block=(id)=>component({id,component:'insight',props:{text:'A finding worth a box of its own'},size:{height:'hug'}});
const gapUnder=(leftover)=>{
  const column=flow({id:'col',direction:'column',gap:0,size:{width:300,height:600},...(leftover?{leftover}:{}),children:[block('a'),block('b')]});
  const frames=Object.fromEntries(resolveLayout(column,{x:0,y:0,width:300,height:600},createRegistry()).map(p=>[p.node.id,p.frame]));
  return frames.b.y-(frames.a.y+frames.a.height);
};
assert.ok(gapUnder('distribute')>200,'distribute would pin them apart');
assert.equal(gapUnder(null),0,'stacked, the second box follows the first');
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_a_label_table_heads_its_columns(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const rows=[{label:'Passenger vehicle drivers',text:'2.1k jobs, 82% Black or African American'},
            {label:'Light truck drivers',text:'0.3k jobs, 77% Black or African American'}];
const headed=composeSlide({title:'T',columns:['Occupation','What the data shows'],rows,soWhat:'The exposure is concentrated'},0);
const find=(item)=>item.component?[item]:(item.items||[]).flatMap(find);
const table=headed.items.flatMap(find).find(i=>i.component==='table');
assert.deepEqual(table.props.columns.map(c=>c.label),['Occupation','What the data shows']);
// Without headers the table still builds, and nothing invents a heading.
const bare=composeSlide({title:'T',rows},0);
const plain=bare.items.flatMap(find).find(i=>i.component==='table');
assert.ok(!plain.props.columns||plain.props.columns.every(c=>!String(c.label??c).trim()));
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result["accepted"])

    def test_a_document_weight_deck_offers_a_small_chart_its_own_table(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const chart={type:'chart.column',heading:'Revenue',unit:'$m',categories:['FY21','FY22','FY23','FY24','FY25'],
  series:[{name:'Revenue',values:[44,49,52,58,61]}]};
const kinds=(page)=>{const find=(item)=>item.component?[item]:(item.items||[]).flatMap(find);
  return page.items.flatMap(find).map(i=>i.component);};
// elements: 1 - the chart is the page's only evidence element.
const light=composeSlide({title:'T',exhibit:JSON.parse(JSON.stringify(chart)),points:['a b c d e','f g h i j']},0,'.', 'balanced',1);
assert.ok(!kinds(light).includes('table'));
// elements: 2 - the cheapest second element is the chart's own numbers.
const document=composeSlide({title:'T',exhibit:JSON.parse(JSON.stringify(chart)),points:['a b c d e','f g h i j']},0,'.', 'full',2);
assert.ok(kinds(document).includes('table'),'the chart tabulates itself');
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result["accepted"])


class CorpusBenchmarkTests(unittest.TestCase):
    """The review that produced these floors should be repeatable, not a one-off:
    the flagship example is measured the way the reference corpus was measured,
    and the numbers have to stay in the band the corpus sets.

    Reference medians, over 192 sampled pages of published client decks:
    196 words of page text, 135 text blocks, 18 numeric tokens, 27 words set at
    9pt or smaller. Ours are floors, not targets - the point is that a change
    that quietly empties the pages fails here instead of in a screenshot."""

    def test_the_flagship_example_stays_inside_the_corpus_band(self):
        result = run_node('''
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
const path='./skills/professional-slides/examples/slideworks.deck.json';
const spec=JSON.parse(fs.readFileSync(path,'utf8'));
const {deck}=planDeck(toDeckPlan(spec,'./skills/professional-slides/examples'));
const median=(values)=>{const s=[...values].sort((a,b)=>a-b);const m=s.length>>1;
  return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const pages=[];
for(const slide of deck.slides){
  const texts=slide.nodes.filter(n=>typeof n.text==='string'&&n.text.trim());
  const words=texts.reduce((sum,n)=>sum+n.text.trim().split(/\\s+/).length,0);
  // A cover, a divider or a statement page is not an analytical page; the
  // corpus measurement excluded them the same way, by a word floor.
  if(words<25) continue;
  const size=(n)=>Number(n.style?.fontSize?.value ?? n.style?.fontSize ?? 0);
  pages.push({words,blocks:texts.length,
    numeric:texts.reduce((sum,n)=>sum+(n.text.match(/\\d/g)?1:0),0),
    small:texts.filter(n=>size(n)>0&&size(n)<=9).reduce((sum,n)=>sum+n.text.trim().split(/\\s+/).length,0)});
}
const measured={pages:pages.length,words:median(pages.map(p=>p.words)),blocks:median(pages.map(p=>p.blocks)),
  numeric:median(pages.map(p=>p.numeric)),small:median(pages.map(p=>p.small))};
console.log(JSON.stringify(measured));
''')
        # Floors are set a step under what the deck measures today, so ordinary
        # drift is fine and a page-emptying change is not.
        # Measured on the scene, one block per text node, where the corpus was
        # measured on the rendered page, one block per printed line: 16 pages
        # today at 128 words, 37.5 blocks, 20 numeric blocks and 24.5 words of
        # small type per page.
        self.assertGreaterEqual(result["pages"], 12)
        self.assertGreaterEqual(result["words"], 110, "page text has fallen away from the corpus band")
        self.assertGreaterEqual(result["blocks"], 30, "the page has lost its furniture: labels, units, notes")
        self.assertGreaterEqual(result["numeric"], 14, "the evidence has stopped carrying numbers")
        self.assertGreaterEqual(result["small"], 16, "the small type - labels, units, notes - has gone")
