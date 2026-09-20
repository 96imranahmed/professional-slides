"""The page shape repertoire, the commentary column and the deck's front matter.

A review of a 40-page deck found five consecutive pages carrying an identical
column of numbered discs. Measuring it against the corpus found the deeper
cause: the deck ran 1.3 distinct page architectures per ten analytical pages
with 69% on one shape, where the reference client decks run about five per ten
and never let one past a quarter. These tests hold the repertoire that fixed it.
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

from node_probe import run_node

ROOT = Path(__file__).resolve().parents[2]
SKILL = ROOT / "skills" / "professional-slides"
COMPOSE = "./skills/professional-slides/runtime/compose.mjs"

sys.path.insert(0, str(SKILL / "runtime" / "gates"))
import page_gates  # noqa: E402


class PageShapeTests(unittest.TestCase):
    def test_a_page_composed_alone_keeps_its_established_shape(self):
        # Scoring must not change what a single page does: with no history the
        # order is best fit, then the declared order, and exhibit-left is first.
        result = run_node(f'''
import assert from 'node:assert/strict';
import {{composeSlide}} from '{COMPOSE}';
const chart={{type:'chart.bar',heading:'Share',unit:'%',categories:['a','b','c','d','e','f'],series:[{{name:'s',values:[1,2,3,4,5,6]}}]}};
const page=composeSlide({{id:'s01',title:'T',exhibit:chart,points:['alpha beta','gamma delta']}},0);
const row=page.items.find((i)=>i.id==='s01-row');
assert.ok(row,'the exhibit keeps its side column');
assert.equal(row.items[0].id,'s01-exhibit','and the exhibit is on the left');
console.log(JSON.stringify({{ok:true}}));
''')
        self.assertTrue(result["ok"])

    def test_consecutive_pages_vary_placement_without_inventing_order(self):
        result = run_node(f'''
import {{composeSlide}} from '{COMPOSE}';
const chart={{type:'chart.bar',heading:'Share',unit:'%',categories:['a','b','c','d','e','f'],series:[{{name:'s',values:[1,2,3,4,5,6]}}]}};
const points=[{{lead:'One',text:'carries the first finding here'}},{{lead:'Two',text:'carries the second finding here'}}];
const recent=[], styles=[], shapes=[];
for (let i=0;i<6;i++) {{
  const page=composeSlide({{title:'T',exhibit:chart,points}},i,undefined,'balanced',1,recent,styles);
  const row=page.items.find((x)=>x.id&&/-row$|-stack$/.test(x.id));
  shapes.push(row&&row.id.endsWith('-stack')?'top':(row.items[0].id||'').endsWith('-side')?'right':'left');
  recent.splice(4); styles.splice(3);
}}
console.log(JSON.stringify({{shapes, styles}}));
''')
        # Placement can vary, but unordered findings never acquire numbers.
        self.assertGreaterEqual(len(set(result["shapes"])), 2, result["shapes"])
        self.assertNotIn("numbered", result["styles"])

    def test_an_exhibit_that_needs_the_measure_keeps_it(self):
        # A gantt and a sentence-celled table cannot be narrowed to make room
        # for a side column; the chooser has to know before it picks.
        result = run_node(f'''
import assert from 'node:assert/strict';
import {{composeSlide}} from '{COMPOSE}';
const wide={{type:'table',columns:['Dimension','Marvel examples','DC examples'],
  rows:[['Source of power','Thor is a god; Tony Stark builds armor; Peter Parker gains powers.','Superman is an alien; Bruce Wayne trains; Diana is an Amazon.']]}};
const page=composeSlide({{id:'s01',title:'T',exhibit:wide,points:['alpha beta gamma','delta epsilon zeta']}},0);
// Either full width on its own, or full width above its commentary - what it
// must never be is squeezed into two thirds beside a side column.
const find=(it)=>it&&(it.id==='s01-exhibit'?it:(it.items||[]).map(find).find(Boolean));
const table=page.items.map(find).find(Boolean);
assert.ok(table,'the table is on the page');
assert.equal(page.items.some((i)=>i.id==='s01-row'),false,'the table keeps the full measure');
console.log(JSON.stringify({{ok:true}}));
''')
        self.assertTrue(result["ok"])


class ColumnShapeTests(unittest.TestCase):
    def test_every_named_style_renders(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
import {POINT_STYLE_NAMES} from './skills/professional-slides/runtime/compose.mjs';
const R=createRegistry();
const items=[{lead:'Renewals',text:'held at 91%, four points above plan',icon:'check'},
             {lead:'Pipeline',text:'is 3.1x against a 3.5x target'}];
const markers={'icon-lead':{marker:'icon',inlineLead:true},'icon-framed':{marker:'icon-ring'},
  prose:{marker:'none'},ruled:{marker:'rule'},lettered:{marker:'letter'},numbered:{marker:'number'},bulleted:{}};
const drawn={};
for (const name of POINT_STYLE_NAMES) {
  const nodes=R.get('bullet-list').render({id:'l',frame:{x:0,y:0,width:360,height:420},props:{variant:'body',items,...markers[name]}}).nodes;
  assert.ok(nodes.filter((n)=>n.type==='text').length>=2,`${name} renders its text`);
  drawn[name]=[...new Set(nodes.map((n)=>n.role))].sort().join(',');
}
console.log(JSON.stringify({names:POINT_STYLE_NAMES, drawn}));
''')
        self.assertGreaterEqual(len(result["names"]), 6)
        # The shapes are genuinely different devices, not one thing renamed.
        self.assertGreaterEqual(len(set(result["drawn"].values())), 4, result["drawn"])

    def test_a_hollow_disc_marks_an_open_item(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const R=createRegistry();
const nodes=R.get('bullet-list').render({id:'l',frame:{x:0,y:0,width:360,height:300},props:{variant:'body',marker:'number',
  items:[{text:'Done and dusted'},{text:'Still open',state:'open'}]}}).nodes;
const discs=nodes.filter((n)=>n.role==='list-marker'&&n.type==='ellipse');
assert.equal(discs.length,2);
assert.notDeepEqual(discs[0].style.fill,discs[1].style.fill,'the open item is hollow');
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])


class TableTreatmentTests(unittest.TestCase):
    def test_the_implication_column_draws_once_or_every_row(self):
        result = run_node(f'''
import assert from 'node:assert/strict';
import {{styleTable}} from '{COMPOSE}';
import {{createRegistry}} from './skills/professional-slides/runtime/registry.mjs';
const R=createRegistry();
const rows=(n)=>Array.from({{length:n}},(_, i)=>[`Row ${{i}}`,'evidence','more','the verdict']);
const draw=(n,highlightRow)=>{{
  const t=styleTable({{type:'table',columns:['Criterion','Marvel','DC',{{label:'Verdict',implication:true}}],
    rows:rows(n),...(highlightRow===undefined?{{}}:{{highlightRow}})}});
  const nodes=R.get('table').render({{id:'t',frame:{{x:0,y:0,width:1160,height:420}},props:{{...t,density:'body'}}}}).nodes;
  return nodes.filter((x)=>x.role==='table-implication'&&x.type==='ellipse').length;
}};
assert.equal(draw(3),3,'a short table marks every row');
// Past five rows it says it once - on the row the table emphasises, because a
// disc centred in the gutter marks whichever row happens to be halfway down.
assert.equal(draw(6,2),1,'a long one says it once, on the marked row');
assert.equal(draw(6),1,'an explicit table-wide inference is centred independently of row focus');
console.log(JSON.stringify({{ok:true}}));
''')
        self.assertTrue(result["ok"])

    def test_heat_and_bubble_columns_change_what_the_cell_is(self):
        result = run_node(f'''
import assert from 'node:assert/strict';
import {{styleTable}} from '{COMPOSE}';
import {{createRegistry}} from './skills/professional-slides/runtime/registry.mjs';
const R=createRegistry();
const t=styleTable({{type:'table',columns:['Film',{{label:'Opening',bubble:true}},{{label:'Score',heat:true}}],
  rows:[['Endgame','357.1',5],['Wonder Woman','103.3',2]]}});
const nodes=R.get('table').render({{id:'t',frame:{{x:0,y:0,width:900,height:300}},props:{{...t,density:'body'}}}}).nodes;
assert.equal(nodes.filter((n)=>n.role==='table-bubble').length,2,'every value gets its pill');
assert.ok(nodes.some((n)=>n.role==='table-cell'&&n.style&&n.style.fill),'the heat column is filled');
console.log(JSON.stringify({{ok:true}}));
''')
        self.assertTrue(result["ok"])


class FrontMatterTests(unittest.TestCase):
    def test_a_deck_can_have_both_section_pills_and_a_contents_page(self):
        # They used to be mutually exclusive, which is why a deck with section
        # tabs silently had no contents page anywhere.
        result = run_node(f'''
import {{composeDeck}} from '{COMPOSE}';
const spec=(extra)=>({{schema:'professional-slides.deck/v3',id:'d',slides:[
  {{kind:'section',title:'One'}},{{title:'A',points:['x','y']}},
  {{kind:'section',title:'Two'}},{{title:'B',points:['x','y']}}],...extra}});
const rep=(d)=>({{tracked:d.slides.filter((s)=>s.tracker).length,
                 contents:d.slides.filter((s)=>String(s.id||'').startsWith('agenda')).length}});
console.log(JSON.stringify({{
  fallback: rep(composeDeck(spec({{}}))),
  legacy: rep(composeDeck(spec({{agenda:true}}))),
  off: rep(composeDeck(spec({{contents:false}}))),
}}));
''')
        self.assertEqual(result["fallback"], {"tracked": 2, "contents": 1})
        # The old spelling still tracks by repeating the contents page.
        self.assertEqual(result["legacy"], {"tracked": 0, "contents": 2})
        self.assertEqual(result["off"], {"tracked": 2, "contents": 0})

    def test_the_takeaways_page_does_not_stretch_three_lines_over_a_page(self):
        # It divided the whole track by the item count, so three one-line
        # messages took a 150px row each and left the page half empty.
        result = run_node('''
import {createRegistry} from './skills/professional-slides/runtime/registry.mjs';
const R=createRegistry();
const nodes=R.get('takeaways').render({id:'t',frame:{x:0,y:0,width:1280,height:720},props:{title:'Key takeaways',
  items:['The lead survives every sensitivity test.','The broader comparison stays competitive.','Choose the criterion first.']}}).nodes;
const items=nodes.filter((n)=>n.role==='takeaways-item');
console.log(JSON.stringify({gaps: items.slice(1).map((n,i)=>Math.round(n.frame.y-(items[i].frame.y+items[i].frame.height)))}));
''')
        for gap in result["gaps"]:
            self.assertLessEqual(gap, 80, f"the messages are adrift: {result['gaps']}")


class GateVocabularyTests(unittest.TestCase):
    def test_the_new_deck_gates_are_registered_and_documented(self):
        index = (SKILL / "references" / "evaluation" / "index.md").read_text(encoding="utf-8")
        for code in ("PAGE_SHAPE_FLAT", "COLUMN_MONOTONY", "NO_CONTENTS", "NO_SUMMARY"):
            self.assertIn(code, page_gates.GATE_CODES, code)
            self.assertIn(f"`{code}`", index, f"{code} is not in the evaluation table")

    def test_chart_plus_process_counts_as_composite_evidence(self):
        chart = {"component": "chart.bar", "frame": {"x": 60, "y": 140, "width": 1160, "height": 220}}
        process = {"component": "chevron-process", "frame": {"x": 60, "y": 400, "width": 1160, "height": 200}}
        mixed = {"componentInstances": [chart, process]}
        self.assertEqual(page_gates.page_architecture(mixed), "evidence-stack")
        prose = {"component": "bullet-list", "frame": process["frame"]}
        self.assertEqual(page_gates.page_architecture({"componentInstances": [chart, prose]}), "evidence-over-commentary")
        self.assertEqual(page_gates.page_architecture({"componentInstances": [process]}), "chevron-process")

    def test_page_architecture_reads_past_the_exhibit_type(self):
        # LAYOUT_MONOTONY could not see the defect because a bar chart beside a
        # points column and a line chart beside a points column are two
        # signatures. The architecture is what a reader sees from a distance.
        def slide(chart):
            return {"id": "s01", "componentInstances": [
                {"id": "s01-0", "component": chart, "frame": {"x": 60, "y": 162, "width": 700, "height": 400}},
                {"id": "s01-1", "component": "bullet-list", "frame": {"x": 800, "y": 162, "width": 360, "height": 400}}]}
        self.assertEqual(page_gates.page_architecture(slide("chart.bar")),
                         page_gates.page_architecture(slide("chart.line")))
        self.assertEqual(page_gates.page_architecture(slide("chart.bar")),
                            page_gates.page_architecture(slide("table")))

    def test_commentary_count_and_insight_do_not_invent_architectures(self):
        def slide(count, cards=False, insight=False):
            nodes = [{"component": "chart.bar", "frame": {"x": 60, "y": 140, "width": 1160, "height": 300}}]
            nodes += [{"component": "cards" if cards else "paragraph", "frame": {"x": 60 + n * 350, "y": 470, "width": 330, "height": 90}} for n in range(count)]
            if insight: nodes.append({"component": "insight", "frame": {"x": 60, "y": 610, "width": 1160, "height": 40}})
            return {"componentInstances": nodes}
        expected = page_gates.page_architecture(slide(2))
        for count, cards, insight in [(3, False, False), (2, False, True), (3, True, True)]:
            self.assertEqual(expected, page_gates.page_architecture(slide(count, cards, insight)))
        findings = []
        slides = [slide(2), slide(3), slide(3, True, True)] * 4
        page_gates.gate_page_shape_flat(slides, list(range(12)), findings, "balanced")
        self.assertTrue(any(f["code"] == "PAGE_SHAPE_FLAT" for f in findings))
        self.assertNotIn("PAGE_SHAPE_FLAT", page_gates.ADVISORY_CODES)


if __name__ == "__main__":
    unittest.main()


class TableHalvesTests(unittest.TestCase):
    """A ranking gets a second architecture, and only where halving is honest.

    A page carrying one wide exhibit and no commentary had exactly one viable
    shape, `exhibit-full` - which is right for a six-column findings table and
    wrong for a twelve-row ranking, where it runs a narrow list down the centre
    of the page and leaves half of it empty. `table-halves` cuts that table in
    reading order and sets the two halves side by side, each with its header.

    The guard matters more than the shape: halving doubles the column count and
    halves the width each column gets, so anything that needs the full measure,
    reads top to bottom as one run, or carries typed cells stays whole.
    """

    def test_a_long_narrow_ranking_halves_and_everything_else_does_not(self):
        result = run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const rows = (n) => Array.from({length: n}, (_, i) => [String(i+1), `Segment ${i+1}`, String(1240 - i*90)]);
const page = (exhibit, extra = {}) => composeSlide({id:'s1', title:'Twelve segments ranked by the pool they carry', exhibit, ...extra}, 0);
// Several shapes build an `s1-row`; only this one builds the two halves.
const halved = (p) => (p.items.find((item) => item.id === 's1-row')?.items || [])
  .some((item) => item.id === 's1-exhibit-b');
const ranking = {type:'table', columns:['Rank','Segment','Revenue pool'], rows: rows(12)};

// Asked for by name, the halves are built: two panels, the rows in reading
// order, both carrying the header.
const explicit = page(ranking, {layout:'table-halves'});
const row = explicit.items.find((item) => item.id === 's1-row');
assert.equal(row.items.length, 2);
assert.deepEqual(row.items[0].props.rows.map((r) => r[0]), ['1','2','3','4','5','6']);
assert.deepEqual(row.items[1].props.rows.map((r) => r[0]), ['7','8','9','10','11','12']);
assert.deepEqual(row.items[0].props.columns, row.items[1].props.columns);

// Too few rows to be worth halving.
assert.equal(halved(page({...ranking, rows: rows(8)}, {layout:'table-halves'})), true, 'by name, it still halves');
// Left to the composer, a short table never reaches the shape at all.
const short = page({...ranking, rows: rows(8)});
assert.equal(halved(short), false);
// Commentary means the page has something to arrange already.
assert.equal(halved(page(ranking, {points:['one','two'], layout:'auto'})), false);
// A fourth column, a long cell, a derived column, a total row, a treated
// column or a typed cell each keep the table whole.
const keepsWhole = [
  {...ranking, columns:['Rank','Segment','Revenue pool','Growth'], rows: rows(12).map((r) => [...r, '5%'])},
  {...ranking, rows: rows(12).map((r, i) => i ? r : [r[0], 'A segment whose name runs past the halving limit', r[2]])},
  {...ranking, derive:['share']},
  {...ranking, total:true},
  {...ranking, columns:['Rank','Segment',{label:'Revenue pool', unit:'$m', bar:true}]},
  {...ranking, rows: rows(12).map((r, i) => i ? r : [r[0], r[1], {type:'heatmap', value:3}])},
];
for (const [at, exhibit] of keepsWhole.entries()) {
  assert.equal(halved(page(exhibit)), false, `case ${at} should not halve`);
}
console.log(JSON.stringify({ok:true}));
''')
        self.assertTrue(result["ok"])
