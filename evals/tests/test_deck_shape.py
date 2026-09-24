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

from node_probe import run_node, requires_python_package  # noqa: E402


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


# SeparatorTests removed with the `DOT_SEPARATOR` gate. "A bullet joining two
# labels is a tic, not a structure" was asserted in a docstring with no
# reference deck behind it, and published decks use exactly that construction in
# eyebrow lines and source strings. A punctuation blacklist is not a measurement.


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
assert.equal(cmp({}).props.highlightColumn,undefined,'comparison has no inferred winner');
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


# The native chart emitter writes through python-pptx (requirements.txt).
@requires_python_package('pptx')
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
        self.assertEqual(density["bodyWords"]["floor"], 95)
        self.assertEqual(density["bodyWords"]["referenceMedian"], 148)
        self.assertIn("footerWords", density)
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
const house={schema:'professional-slides.house/v1',palette:{base:'evergreen',id:'h',label:'H',colors:{}},fill:'full',weight:{pageWords:140,columnFill:0.7}};
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

    def test_the_side_column_fills_its_track_on_every_deck(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const chart={type:'chart.bar',categories:['a','b','c','d'],series:[{name:'s',values:[1,2,3,4]}]};
const side=(slide,fill)=>composeSlide(slide,0,process.cwd(),fill).items.find(i=>i.id==='s01-row').items.find(i=>i.id==='s01-side');
const page={title:'T',exhibit:chart,points:['one','two','three']};
assert.equal(side(page,'balanced').items[0].props.distribute,true,'a balanced column spreads its points');
assert.equal(side(page,'full').items[0].props.distribute,true);
// An airy deck spreads too. White space *between* the points is what airy
// means; the same space pooled under the last one is an unfinished page.
assert.equal(side(page,'airy').items[0].props.distribute,true,'an airy deck puts its air between the points');
// A thin column narrows and gives the width to the exhibit - toward the depth
// a well-made side column runs, never under the width a line of prose needs
// (a third of the 1068px row at fr 1; 280px is fr 0.71).
const thin=side(page,'balanced').size.width.fr;
assert.ok(thin<1&&thin>0.7,`thin column fr ${thin}`);
const deep={title:'T',exhibit:chart,points:[
 {lead:'Wealth nearly doubled',text:'Advisory fees grew 18% a year while lending margins compressed, so the mix shifted to fee income across the book.'},
 {lead:'Corporate slipped',text:'Lending margins compressed through the rate cycle and the corporate book lost a fifth of its contribution.'},
 {lead:'Retail held',text:'Deposit growth offset the fee decline, leaving retail flat against a falling market.'}]};
const deepFr=side(deep,'balanced').size.width.fr;
assert.ok(deepFr<=1&&deepFr>=thin,`a deeper column narrows less (${deepFr} against ${thin})`);
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
        """Each fill level is a percentile of the corpus, not a taste.

        140 rendered pages of real client-project decks: median ink 0.184,
        first quartile 0.118, tenth percentile 0.077. So an `airy` deck promises
        to beat the emptiest 6% of client pages, a `balanced` deck the emptiest
        11%, a `full` deck the emptiest quarter. The old ladder floored
        `balanced` at 0.115 and `full` at 0.14, which rejected 22% and 31% of
        them - a floor that fails a third of real client work is measuring
        something other than emptiness. The wider 2,125-page sample gives the
        same answers within two points: geometry is not what separates client
        work from published thought leadership.
        """
        levels = page_gates.FILL_LEVELS
        self.assertEqual(levels["full"]["ink_min"], page_gates.REFERENCE_PAGE["inkQ1"])
        self.assertEqual(levels["balanced"]["ink_min"], page_gates.REFERENCE_PAGE["inkP10"])
        self.assertLess(levels["airy"]["ink_min"], levels["balanced"]["ink_min"])
        self.assertEqual(page_gates.REFERENCE_PAGE["inkMedian"], 0.184)
        # And the ladder is monotone with what it costs: each step up flags more
        # of the corpus than the step below it.
        flagged = page_gates.REFERENCE_PAGE["exceedance"]["inkBelow"]
        self.assertLess(flagged["0.05"], flagged["0.077"])
        self.assertLess(flagged["0.077"], flagged["0.118"])

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
// Naming a category in the title does not invent a chart highlight.
assert.deepEqual(drawn.props.highlights ?? [],[]);
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

    def test_a_standfirst_replaces_the_title_rule_rather_than_stacking_under_it(self):
        # A rule and a standfirst do the same job - they close the title band -
        # so a page takes one or the other. The standfirst carries the measure
        # and the rule carries nothing, so the standfirst wins.
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck, component} from './skills/professional-slides/runtime/core.mjs';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const REGISTRY=createRegistry(), frame={x:0,y:0,width:1280,height:720};
const chrome=(props)=>compileDeck({slides:[{id:'s1',frame,composition:component({id:'chrome',component:'slide-chrome',frame,
  props:{title:'Every segment recovered, and only new-age tech is below 2021',source:'Source: fixture',titleVariant:'with-line',...props}})}]},REGISTRY).slides[0].nodes;
const rules=(nodes)=>nodes.filter(n=>n.role==='title-rule').length;
assert.equal(rules(chrome({})),1,'a page with no standfirst keeps its rule');
const standfirst=chrome({subtitle:'Announced deal value by segment, India, $B'});
assert.equal(rules(standfirst),0,'the standfirst takes the place of the rule');
const sub=standfirst.find(n=>n.role==='action-subtitle');
const title=standfirst.find(n=>n.role==='action-title');
assert.ok(sub,'the standfirst renders');
assert.ok(sub.frame.y>title.frame.y,'and sits under the title');
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result["ok"])

    def test_a_change_arrow_lifts_clear_of_the_values_it_spans(self):
        # The arrow runs mark to mark and its bubble rides the midpoint, so on
        # a falling series it lands on the interior bar and the value printed
        # above it. It climbs into the band the chart already reserved for it.
        result = run_node("""
import assert from 'node:assert/strict';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const REGISTRY=createRegistry();
const frame={x:0,y:0,width:420,height:420};
const props={heading:'Announced deal value',unit:'$B',categories:['2021','2022','2023'],
  series:[{name:'Deal value',values:[42,37,30]}],
  changeAnnotations:[{text:'-29%',start:{category:'2021'},end:{category:'2023'}}]};
const nodes=REGISTRY.get('chart.column').render({id:'c',frame,props}).nodes;
const hits=(a,b)=>!(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
const bubble=nodes.find(n=>n.role==='annotation-surface');
assert.ok(bubble,'the change bubble renders');
for(const node of nodes.filter(n=>n.role==='data-label'||n.role==='chart-mark')){
  assert.ok(!hits(bubble.frame,node.frame),'the bubble sits on '+node.role+' '+(node.text||''));
}
console.log(JSON.stringify({ok:true}));
""")
        self.assertTrue(result["ok"])

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
// Statements and nothing else sit together at the top of the track, level with
// the exhibit: not spread down it (they would pin to opposite ends of an empty
// track), and not centred on it (a band of air above them as tall as the one
// below, which the band gates read by column).
assert.equal(column.leftover,undefined);
const one=composeSlide({title:'T',rows,insights:['Four in five workers are Black or African American']},0);
const single=side(one);
assert.equal(single.items.find(i=>i.component==='insight').props.variant,'tonal','one statement is the box');
assert.equal(single.leftover,undefined);
assert.throws(()=>composeSlide({title:'T',rows,insights:['a','b','c']},0),/at most two insights/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_a_short_commentary_column_narrows_and_starts_at_the_top(self):
        """A column that fills little of its track used to centre on the
        exhibit, which put a band of air above its first line as tall as the
        one under its last. It starts at the top and narrows instead, so its
        text runs deeper and the exhibit takes the width; the middle is the
        author's to ask for."""
        result = run_node("""
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const exhibit={type:'chart.column',heading:'Local supply by weather case',unit:'ML/day',
  categories:['Highland','Central','East','Coast'],
  series:[{name:'Normal',values:[40,65,42,48]},{name:'Design Dry',values:[28,47,27,33]}]};
const side=(page)=>{const walk=(item)=>String(item.id||'').endsWith('-side')?[item]:(item.items||[]).flatMap(walk);
  return page.items.flatMap(walk)[0];};
const build=(points)=>side(composeSlide({id:'s',title:'Local supply falls together in the design drought',
  layout:'exhibit-left',pointsHeading:false,pointsStyle:'prose',exhibit,points},0));
// One prose point against a headed chart leaves most of the track empty: it
// starts at the top, and the column narrows to give the chart the width.
const sentence='Each weather state reduces several local sources together. No probability is assigned to the scenarios and the gaps between them are not confidence intervals.';
const point={lead:'The model does not treat four districts as four independent hedges.',text:sentence};
const short=build([point]);
assert.notEqual(short.leftover,'center');
assert.ok(short.size.width.fr<1,`a short column narrows (fr ${short.size.width.fr})`);
// A column with enough body to fill its track keeps its width, and starts at the top too.
const full=build(Array.from({length:5},(_,i)=>({lead:`Finding ${i+1}`,text:sentence})));
assert.notEqual(full.leftover,'center');
assert.ok(full.size.width.fr>=1);
// The middle is still there for an author who asks for it.
const asked=side(composeSlide({id:'s',title:'Local supply falls together in the design drought',
  layout:'exhibit-left',pointsHeading:false,pointsStyle:'prose',pointsAlign:'middle',exhibit,points:[point]},0));
assert.equal(asked.leftover,'center');
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_the_gutter_mark_is_chosen_and_points_the_way_the_argument_runs(self):
        """`implication` names one of a range the reference decks use, rather
        than switching the dashed rule on. The block arrow is the loud end of
        it: across a gutter between columns, down a band across the page."""
        result = run_node("""
import assert from 'node:assert/strict';
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const exhibit={type:'chart.column',heading:'Local supply by weather case',unit:'ML/day',
  categories:['Highland','Central'],series:[{name:'Normal',values:[40,65]}]};
const page=(id,implication,extra={})=>({id,title:'Local supply falls together in the design drought',
  layout:'exhibit-left',implication,pointsHeading:false,pointsStyle:'prose',exhibit,
  points:[{lead:'Four districts are not four hedges.',text:'Each weather state reduces several local sources together.'}],...extra});
const build=(slides)=>planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'d',tracker:false,slides})).deck;
const marks=(slide)=>slide.nodes.filter(n=>String(n.id).includes('-implication'));
const deck=build([page('a',false),page('b','rule'),page('c','arrow'),page('d','chevron'),page('e','divider-chevron')]);
const [none,rule,arrow,chevron,dashed]=deck.slides;
assert.equal(marks(none).length,0,'false draws nothing');
assert.deepEqual(marks(rule).map(n=>n.role),['relationship-divider']);
assert.equal(marks(rule)[0].style.dash,undefined,'the quiet rule is solid');
// Down a gutter between two columns the arrow points across at the meaning.
assert.equal(marks(arrow)[0].data.geometry,'rightArrow');
assert.ok(marks(chevron).some(n=>n.role==='relationship-disc'));
assert.equal(marks(chevron).filter(n=>n.role==='relationship-divider').length,0,'the disc stands alone');
assert.equal(marks(dashed).find(n=>n.role==='relationship-divider').style.dash,'dash');
// On a band drawn across the page it points down at what follows from the row.
const band=build([{id:'f',title:'The four measures move together in the design drought',
  layout:'exhibit-full',implication:'arrow',pointsHeading:false,pointsStyle:'prose',exhibit,
  metrics:[{value:'40',label:'Highland'},{value:'65',label:'Central'}],
  points:[{lead:'Four districts are not four hedges.',text:'Each weather state reduces several local sources together.'}]}]).slides[0];
assert.equal(marks(band)[0].data.geometry,'downArrow');
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

    def test_chart_data_tables_require_an_authored_request_at_any_deck_weight(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const chart={type:'chart.column',heading:'Revenue and cost',unit:'$m',categories:['FY21','FY22','FY23','FY24','FY25'],
  series:[{name:'Revenue',values:[44,49,52,58,61]},{name:'Cost',values:[40,44,47,51,55]}]};
const kinds=(page)=>{const find=(item)=>item.component?[item]:(item.items||[]).flatMap(find);
  return page.items.flatMap(find).map(i=>i.component);};
// Deck weight does not duplicate the chart's numbers in a second exhibit.
const light=composeSlide({title:'T',exhibit:JSON.parse(JSON.stringify(chart)),points:['a b c d e','f g h i j']},0,'.', 'balanced',1);
assert.ok(!kinds(light).includes('table'));
const document=composeSlide({title:'T',exhibit:JSON.parse(JSON.stringify(chart)),points:['a b c d e','f g h i j']},0,'.', 'full',2);
assert.ok(!kinds(document).includes('table'));
const requested=composeSlide({title:'T',exhibit:{...chart,dataTable:true}},0,'.','full',2);
assert.ok(kinds(requested).includes('table'),'explicit exact-value supplements remain supported');
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



class HeavyPageTests(unittest.TestCase):
    """The page shapes the reference decks carry and we did not: the findings
    matrix, the grouped measure table, the accent phrase inside a sentence, the
    icon list, and the deck-level finding that asks for a heavy page at all."""

    def test_a_row_matrix_carries_bulleted_cells_under_a_lead(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const page=composeSlide({title:'Five challenges shape the sector',
  columns:['Challenge','A - Pre-COVID trends','B - Impacts'],
  rows:[{label:'Health of transit',icon:'people',cells:[
          {lead:'Strong base, declining ridership',points:['34% of workers commute by transit','15% decline in rail ridership'],highlight:'34%'},
          {lead:'Ridership drop and funding gaps',points:['38% of pre-COVID Metrobus ridership']}]},
        {label:'Managing the curbside',cells:[
          {lead:'Pressure from delivery',points:['10,000 new rideshare drivers a year']},
          'Continued rise of e-commerce']}],
  source:'US Census'},0);
const find=(item)=>item.component?[item]:(item.items||[]).flatMap(find);
const table=page.items.flatMap(find).find(i=>i.component==='table');
assert.deepEqual(table.props.columns.map(c=>c.label),['Challenge','A - Pre-COVID trends','B - Impacts']);
// Unordered labels keep their own icons without invented sequence counters.
const [label,first,second]=table.props.rows[0];
assert.equal(label.sectionNumber,undefined);
assert.equal(label.icon,'people');
assert.equal(label.surface,'plain');
// Each content cell is a bulleted list under a bold lead, and the phrase the
// row turns on is set in the accent.
assert.equal(first.type,'bullets');
assert.equal(first.lead,'Strong base, declining ridership');
assert.deepEqual(first.items,['34% of workers commute by transit','15% decline in rail ridership']);
assert.equal(first.accent,'34%');
assert.equal(second.type,'bullets');
// A plain string cell stays text; the second row also remains unordered.
assert.equal(table.props.rows[1][2].type,'text');
assert.equal(table.props.rows[1][0].sectionNumber,undefined);
// One to three content columns; four is a table, not a matrix.
assert.throws(()=>composeSlide({title:'T',rows:[{label:'a',cells:['a','b','c','d']}]},0),/one to three/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_a_table_groups_its_measures_and_units_its_columns(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck, component} from './skills/professional-slides/runtime/core.mjs';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const REGISTRY=createRegistry(), frame={x:0,y:0,width:1160,height:400};
const props={treatment:'open',
  columns:[{label:'Subsector',type:'text'},
           {group:'Size',label:'Jobs, 2019',unit:'#',type:'text',align:'right'},
           {group:'Growth',label:'CAGR 2014-19',unit:'%',type:'text',align:'right'},
           {group:'Growth',label:'CAGR 2019-24',unit:'%',type:'text',align:'right'}],
  rows:[['Transit and ground passenger','10,156','18%','-4%'],['Rail transportation','1,580','-2%','-4%']]};
const nodes=compileDeck({slides:[{id:'s1',frame,composition:component({id:'t',component:'table',frame,props})}]},REGISTRY).slides[0].nodes;
const groups=nodes.filter(n=>n.role==='table-group-text');
// One band per contiguous run, so the two CAGR columns share one "Growth".
assert.deepEqual(groups.map(n=>n.text),['Size','Growth']);
const growth=groups.find(n=>n.text==='Growth'), size=groups.find(n=>n.text==='Size');
assert.ok(growth.frame.x > size.frame.x);
assert.equal(nodes.filter(n=>n.role==='table-group-rule').length,2);
// The unit sits under its own column label, not in the cells.
const units=nodes.filter(n=>n.role==='table-header-unit');
assert.deepEqual(units.map(n=>n.text),['#','%','%']);
const label=nodes.find(n=>n.role==='table-header-text'&&n.text==='Jobs, 2019');
const unit=units[0];
assert.ok(unit.frame.y >= label.frame.y + label.frame.height - 0.01);
// A group that reappears further along is two different things.
assert.throws(()=>compileDeck({slides:[{id:'s2',frame,composition:component({id:'t2',component:'table',frame,
  props:{...props,columns:[{group:'A',label:'x',type:'text'},{group:'B',label:'y',type:'text'},{group:'A',label:'z',type:'text'},{label:'w',type:'text'}]}})}]},REGISTRY),/contiguous/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_a_highlight_sets_its_phrase_in_the_accent(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {accentRuns} from './skills/professional-slides/runtime/text-layout.mjs';
import {compileDeck, component} from './skills/professional-slides/runtime/core.mjs';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
assert.deepEqual(accentRuns('Improved quality of care for patients','Improved quality of care'),
  [{text:'Improved quality of care',bold:true,accent:true},{text:' for patients',bold:false}]);
// A phrase that is not in the sentence is a typo, not a silent no-op.
assert.throws(()=>accentRuns('Easier access for residents','Cheaper access'),/does not occur/);
assert.equal(accentRuns('No highlight here',undefined),null);
const REGISTRY=createRegistry(), frame={x:0,y:0,width:520,height:300};
const props={variant:'body',items:[{text:'Improved quality of care for patients',highlight:'Improved quality of care'},
                                   {text:'Easier access to behavioral health services',highlight:'Easier access'}]};
const nodes=compileDeck({slides:[{id:'s1',frame,composition:component({id:'l',component:'bullet-list',frame,props})}]},REGISTRY).slides[0].nodes;
const items=nodes.filter(n=>n.role==='list-item');
assert.equal(items.length,2);
assert.ok(items[0].runs.some(run=>run.accent),'the phrase carries the accent');
assert.equal(items[0].runs.map(r=>r.text).join(''),items[0].text);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_an_all_icon_list_sets_plain_accent_glyphs_on_the_first_line(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck, component} from './skills/professional-slides/runtime/core.mjs';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const REGISTRY=createRegistry(), frame={x:0,y:0,width:520,height:400};
const build=(props)=>compileDeck({slides:[{id:'s1',frame,composition:component({id:'l',component:'bullet-list',frame,props})}]},REGISTRY).slides[0].nodes;
const items=[{icon:'people',text:'Improved quality of care for patients across every site in the network'},
             {icon:'money',text:'Decreased operational costs to employers'}];
const plain=build({variant:'body',items});
// No ring: the glyph alone, in the accent, on the first line of its item.
assert.equal(plain.filter(n=>n.role==='list-icon-ring').length,0);
const glyphs=plain.filter(n=>n.role==='list-icon-glyph');
assert.equal(glyphs.length,2);
assert.equal(glyphs[0].style.stroke.tokenId,'color.accent');
const [firstItem,secondItem]=plain.filter(n=>n.role==='list-item');
// The glyph is taller than a line, so it sits at the top of its item rather
// than floating in the middle of a four-line block.
assert.ok(Math.abs(glyphs[0].frame.y - firstItem.frame.y) < 4, 'the glyph tops out with its item');
assert.ok(glyphs[1].frame.y >= secondItem.frame.y - 4);
// Rows are set apart: a reading gap, not the tight list spacing.
assert.ok(secondItem.frame.y - (firstItem.frame.y + firstItem.frame.height) >= 12);
// The ringed marker is still available for a list that wants it.
const ringed=build({variant:'body',items,marker:'icon-ring'});
assert.equal(ringed.filter(n=>n.role==='list-icon-ring').length,2);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_a_deck_of_identical_weight_pages_is_reported(self):
        # Ten pages that all carry the same modest page text: every page passes
        # THIN_PAGE and the deck still has nothing behind the argument.
        body = " ".join(["evidence"] * 120)
        flat = [page(index, ["chart.bar"], texts=[body]) for index in range(1, 11)]
        found = page_gates.run_gates(deck(flat))
        self.assertIn("DECK_FLAT", codes(found))
        # One page that carries the detail is what the finding asks for.
        heavy = flat[:-1] + [page(10, ["table"], texts=[" ".join(["evidence"] * 300)])]
        self.assertNotIn("DECK_FLAT", codes(page_gates.run_gates(deck(heavy))))
        # An airy deck is not asked for a heavy page at all.
        self.assertNotIn("DECK_FLAT", codes(page_gates.run_gates(deck(flat, fill="airy"))))


class CategoryNoteTests(unittest.TestCase):
    """A second line under the category label: the base of the measure, the year,
    the unit of that column. The reference charts carry it; ours did not."""

    def test_a_category_note_takes_the_line_under_its_label(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck, component, nativeChartSpec} from './skills/professional-slides/runtime/core.mjs';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const REGISTRY=createRegistry(), frame={x:0,y:0,width:900,height:420};
const base={heading:'Institutions ranking the factor first',unit:'%',
  categories:['Productivity','Business needs','Compliance'],series:[{name:'Share',values:[41,26,18]}]};
const build=(props,componentId='chart.column')=>compileDeck({slides:[{id:'s1',frame,
  composition:component({id:'c',component:componentId,frame,props})}]},REGISTRY).slides[0].nodes;
const withNotes=build({...base,categoryNotes:['n=412','n=388','n=401']});
const notes=withNotes.filter(n=>n.role==='category-note');
assert.deepEqual(notes.map(n=>n.text),['n=412','n=388','n=401']);
const labels=withNotes.filter(n=>n.role==='category-label');
// The note sits under its own label, at label size and in secondary ink.
assert.ok(notes[0].frame.y >= labels[0].frame.y + labels[0].frame.height - 0.01);
assert.equal(notes[0].style.fontSize.tokenId,'type.chartLabel');
assert.equal(notes[0].style.color.tokenId,'color.textSecondary');
// On a bar chart the pair is one block, the label above the note.
const bars=build({...base,categoryNotes:['n=412','n=388','n=401']},'chart.bar');
const barNote=bars.filter(n=>n.role==='category-note')[0], barLabel=bars.filter(n=>n.role==='category-label')[0];
assert.ok(barNote.frame.y >= barLabel.frame.y + barLabel.frame.height - 0.01);
// PowerPoint places its own category axis, so a chart with notes is drawn.
assert.equal(nativeChartSpec('chart.column',{...base,categoryNotes:['n=412']},frame),null);
assert.ok(nativeChartSpec('chart.column',base,frame));
// One entry per category, in category order.
assert.throws(()=>build({...base,categoryNotes:['a','b','c','d']}),/one entry per category/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])


class BodyFloorTests(unittest.TestCase):
    """The floor counts the body. The title band, the source and the notes are
    not evidence, and a page that clears a page-wide floor on the strength of a
    third note has padded the band the reference decks keep shortest."""

    def test_the_floor_ignores_the_title_band_and_the_footer(self):
        body = " ".join(["evidence"] * 96)
        slide = page(1, ["chart.bar"], texts=[body])
        self.assertNotIn("THIN_PAGE", codes(page_gates.run_gates(deck([slide]))))
        # The same page with its body moved into notes is thin, not full.
        noted = page(1, ["chart.bar"], texts=[" ".join(["evidence"] * 20)])
        noted["nodes"].append({"type": "text", "role": "source-text", "text": " ".join(["basis"] * 90)})
        found = codes(page_gates.run_gates(deck([noted])))
        self.assertIn("THIN_PAGE", found)
        # And a page whose footer runs past a third of its text is reported.
        heavy = page(2, ["chart.bar"], texts=[body])
        heavy["nodes"].append({"type": "text", "role": "footnote-text", "text": " ".join(["basis"] * 60)})
        self.assertIn("NOTE_HEAVY", codes(page_gates.run_gates(deck([heavy]))))

    def test_the_density_report_carries_both_bands(self):
        report = page_gates.run_gates(deck([page(1, ["chart.bar"], texts=[" ".join(["evidence"] * 96)])]))
        density = report["density"]
        self.assertEqual(density["bodyWords"]["referenceMedian"], 148)
        self.assertEqual(density["footerWords"]["referenceMedian"], 13)


class DerivedColumnTests(unittest.TestCase):
    """Columns computed from the table's own numbers: the cheapest honest
    density a page can carry, and where a reference measure table finds its
    fifth and sixth columns."""

    def test_share_rank_and_change_are_computed_from_the_table(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
const styled=styleTable({type:'table',treatment:'open',derive:['share','rank','change'],
  deriveFrom:'Jobs, 2019',deriveAgainst:'Jobs, 2014',total:true,
  columns:[{label:'Subsector',type:'text'},{label:'Jobs, 2014',type:'text',align:'right'},{label:'Jobs, 2019',type:'text',align:'right'}],
  rows:[['Transit','8600','10200'],['Couriers','1200','1600'],['Rail','1600','1580']]});
assert.deepEqual(styled.columns.map(c=>c.label),['Subsector','Jobs, 2014','Jobs, 2019','Share','Rank','Change']);
assert.deepEqual(styled.columns.slice(3).map(c=>c.unit),['% of total','of 3','%']);
const body=styled.rows.filter(r=>Array.isArray(r));
// Share of the measure's total, rank on it, and the change against the earlier
// column. Direction alone does not establish a favorable/adverse verdict.
const cell=(value)=>typeof value==='string'?value:value.text;
assert.deepEqual(body[0].slice(3).map(cell),['76','1','+19']);
assert.deepEqual(body[1].slice(3).map(cell),['12','2','+33']);
assert.deepEqual(body[2].slice(3).map(cell),['12','3','\u22121.3']);
assert.equal(body[2][5].tone,undefined);
// Four-figure counts read with a separator, and the total row closes the table.
assert.equal(body[0][2],'10,200');
const total=styled.rows.find(r=>!Array.isArray(r)&&r.style==='total');
assert.equal(total.cells[0],'Total');
assert.equal(total.cells[2],'13,380');
assert.equal(total.cells[3],'100');
assert.equal(total.cells[4],' ');
// A derived name that is not one of the four, and a table with nothing to
// derive from, are errors rather than silent omissions.
assert.throws(()=>styleTable({type:'table',derive:['median'],columns:['A','B'],rows:[['x','1']]}),/Unknown derived column/);
assert.throws(()=>styleTable({type:'table',derive:['share'],columns:['A','B'],rows:[['x','y']]}),/needs a column of numbers/);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_a_measure_cell_carries_its_qualifier_under_it(self):
        result = run_node("""
import assert from 'node:assert/strict';
import {compileDeck, component} from './skills/professional-slides/runtime/core.mjs';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const REGISTRY=createRegistry(), frame={x:0,y:0,width:900,height:300};
const props={treatment:'open',columns:[{label:'Subsector',type:'text'},{label:'Jobs',type:'text',align:'right'}],
  rows:[['Transit',{text:'10,156',sub:'+18% since 2014',align:'right'}]]};
const nodes=compileDeck({slides:[{id:'s',frame,composition:component({id:'t',component:'table',frame,props})}]},REGISTRY).slides[0].nodes;
const value=nodes.find(n=>n.text==='10,156'), sub=nodes.find(n=>n.role==='table-cell-sub');
assert.ok(sub,'the qualifier prints');
assert.equal(sub.text,'+18% since 2014');
assert.equal(sub.style.fontSize.tokenId,'type.label');
assert.equal(sub.style.color.tokenId,'color.textSecondary');
assert.ok(sub.frame.y >= value.frame.y + value.frame.height - 0.01,'under the measure, not beside it');
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])
