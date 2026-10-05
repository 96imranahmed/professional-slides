"""The rendering runtime asked the same questions in several places, and the
answers drifted apart. Each test here holds one of those places to one answer.

- A highlighted single-series column was a grey band in the scene and a column
  in the accent in the native chart; it is the column in the accent in both.
- A page's phrase written in another case ("Only one of five" for "the only one
  of five") passed compile and was drawn plain on the so-what bar, the points,
  a caption and the rail; it is set wherever the text says it.
- Three points on a photograph's card ran as three 190px columns; they run two
  to a row, in open type.
- "+25bps", "12 pts", "4.5/5" and "£38m p.a." were words to the table's pill
  check and figures to the chart's bubble; one pattern reads them all.
- A flat line on a combo's second scale was refused as too flat to read.
- A table's own bulleted cell (`items`) never took the page's phrase, and one
  point under a row of panels dropped its phrase and its bold lead.
"""
import json
import sys
import unittest
from pathlib import Path

from node_probe import run_node

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "skills" / "professional-slides" / "runtime" / "gates"))
import page_gates  # noqa: E402

DECK = r"""
import {toDeckPlan} from './evals/support/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const chart=(heading,extra={})=>({type:'chart.column',heading,unit:'%',categories:['2022','2023','2024'],series:[{name:'s',values:[1,2,3]}],...extra});
const build=(slides)=>planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'d',tracker:false,slides})).deck;
const lit=(nodes)=>nodes.flatMap((n)=>(n.runs||[]).filter((r)=>r.accent||r.bold).map((r)=>[n.role,r.text.trim(),Boolean(r.accent)]));
"""


class HighlightedColumnTests(unittest.TestCase):
    def test_the_scene_and_the_native_chart_light_the_same_column(self):
        result = run_node(r"""
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
import {nativeChartSpec} from './skills/professional-slides/runtime/core.mjs';
const props={categories:['A','B','C'],series:[{name:'Value',values:[40,70,55]}],highlights:[{category:'B'}],annotations:[],referenceLines:[]};
const frame={x:0,y:0,width:600,height:360};
const nodes=REGISTRY.get('chart.column').render({id:'c',frame,props}).nodes;
const marks=nodes.filter((n)=>n.role==='chart-mark');
console.log(JSON.stringify({accent:marks.filter((n)=>n.style.fill.tokenId==='color.accent').map((n)=>n.data.category),
  bands:nodes.filter((n)=>n.role==='chart-highlight').length, native:nativeChartSpec('chart.column',props,frame,nodes)?.highlightIndices??null}));
""")
        self.assertEqual(result["accent"], ["B"], "the column itself is lit, as a bar is")
        self.assertEqual(result["bands"], 0, "no grey band behind a column the native chart paints")
        self.assertEqual(result["native"], [1])


class PhraseCaseTests(unittest.TestCase):
    def test_a_phrase_in_another_case_is_set_wherever_the_text_says_it(self):
        result = run_node(DECK + r"""
const deck=build([
  {id:'a',title:'The operator is the only one of five to grow its margin',layout:'exhibit-left',exhibit:chart('Margin'),highlight:'ONLY ONE of five',
    points:['It is the only one of five operators whose margin rose.','Costs fell faster than fares.'],soWhat:{style:'bar',text:'Only one of five grew, and it did so on cost.'}},
  {id:'b',title:'Two panels, each with its finding',layout:'two-up',highlight:'Only One Of Five',
    exhibits:[chart('Margin',{caption:'Only one of five rose'}),chart('Cost',{caption:'Costs fell at every operator'})]},
  {id:'c',title:'A memo with its panel',layout:'text',highlight:'only ONE of five',
    paragraphs:['The operator is the only one of five to grow its margin in the year, and it did so by cutting cost rather than raising fares.'],
    panel:{text:'Only one of five grew its margin',tone:'dark'}}]);
console.log(JSON.stringify(Object.fromEntries(deck.slides.map((s)=>[s.id,lit(s.nodes)]))));
""")
        roles = lambda page: {role for role, text, _ in result[page] if text.lower() == "only one of five"}
        self.assertEqual(roles("a"), {"list-item", "insight-body"}, "a point and the so-what bar")
        self.assertIn("insight-caption", roles("b"), "the caption under its panel, set as text rather than a box")
        self.assertEqual(roles("c"), {"side-panel-text", "paragraph"}, "the rail's statement and the memo's prose")
        # Cut from the text as written, never from the phrase as offered.
        self.assertTrue(all(text in ("only one of five", "Only one of five") for page in result.values() for _, text, _ in page if text.lower() == "only one of five"))

    def test_accent_runs_match_regardless_of_case_and_keep_the_texts_own(self):
        result = run_node(r"""
import {accentRuns} from './skills/professional-slides/runtime/text-layout.mjs';
console.log(JSON.stringify(accentRuns('Revenue grew in FY24 at the only one of five','Only One Of Five')));
""")
        self.assertEqual(result[-1], {"text": "only one of five", "bold": True, "accent": True})


class PhotoCardPointsTests(unittest.TestCase):
    def test_three_points_on_a_photo_card_run_two_to_a_row_in_open_type(self):
        scene = run_node(DECK + r"""
const sentence='Demand recovered faster at the hub than on the network, so the fuller aircraft carried the margin back.';
const deck=build([{id:'p',title:'The hub recovered first and carried the margin',layout:'photo-backdrop',photo:{alt:'The terminal apron'},pointsTone:'dark',
  exhibit:chart('Traffic'),points:['Hub first','Network later','Margin back'].map((lead)=>({lead,text:sentence}))}]);
console.log(JSON.stringify(deck));
""")
        slide = scene["slides"][0]
        items = [n for n in slide["nodes"] if n.get("role") in ("list-item", "list-lead")]
        rows = sorted({round(n["frame"]["y"]) for n in items if n["role"] == "list-lead"})
        self.assertEqual(len(rows), 2, "two rows: two points, then one")
        columns = {round(n["frame"]["x"]) for n in items if n["role"] == "list-lead"}
        self.assertEqual(len(columns), 2)
        # Open type on the card: ink, not the reversed white a dark panel takes.
        self.assertTrue(all(n["style"]["color"]["tokenId"] != "color.onPrimary" for n in items))
        found = []
        page_gates.gate_cpl(1, slide, found)
        self.assertEqual(found, [], "no column too narrow for prose")


class ScalarFigureTests(unittest.TestCase):
    def test_one_pattern_reads_a_figure_in_a_pill_a_bubble_and_a_measure_cell(self):
        result = run_node(r"""
import {figureUnit} from './skills/professional-slides/runtime/value-format.mjs';
import {normalizeAnnotationRail} from './skills/professional-slides/runtime/chart-annotations.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const figures=['+25bps','12 pts','4.5/5','£38m p.a.','$12.5bn','3.2x','~40%','−1.5pp','1,200','€4bn+'];
const words=['Duration unclear','10.48 / 22','about 50','EPS 10.48 × 22x','~50–60'];
const pills=(texts)=>{try{REGISTRY.get('table').render({id:'t',frame:{x:0,y:0,width:700,height:400},props:{columns:[{label:'Item',type:'text'},{label:'Change',type:'highlight'}],
  rows:texts.map((text,i)=>[{type:'text',text:'Row '+i},{type:'highlight',text,surface:'bubble'}])}});return null;}catch(e){return e.message;}};
const rail=(text)=>{try{normalizeAnnotationRail({annotationRail:{items:[{category:'A',text}]}});return true;}catch{return false;}};
console.log(JSON.stringify({units:Object.fromEntries(figures.map((f)=>[f,figureUnit(f)])),words:words.map(figureUnit),
  bps:pills(['+25bps','-10bps','+5bps']),pts:pills(['12 pts','8 pts']),scores:pills(['4.5/5','3.9/5']),perYear:pills(['£38m p.a.','£12m p.a.']),
  mixed:pills(['+25bps','12%']),worded:pills(['+25bps','Duration unclear']),
  rail:figures.map(rail),railWords:words.map(rail)}));
""")
        self.assertEqual(result["units"], {"+25bps": "bps", "12 pts": "pts", "4.5/5": "/5", "£38m p.a.": "£m p.a.", "$12.5bn": "$bn",
                                           "3.2x": "x", "~40%": "%", "−1.5pp": "pp", "1,200": "", "€4bn+": "€bn"})
        self.assertEqual(result["words"], [None] * 5)
        for key in ("bps", "pts", "scores", "perYear"):
            self.assertIsNone(result[key], f"{key}: a column of one unit is not words mixed with figures")
        self.assertIn("mixes units", result["mixed"])
        self.assertIn("mixes figures with words", result["worded"])
        self.assertEqual(result["rail"], [True] * 10, "a bubble takes what a pill takes")
        self.assertEqual(result["railWords"], [False] * 5)

    def test_the_verdict_check_reads_measures_by_the_same_pattern(self):
        # Read off the compiler's refusals: a verdict column of figures is a
        # measure exactly where SCALAR_FIGURE reads a figure, and words where it does not.
        result = run_node(r"""
import {SCALAR_FIGURE} from './skills/professional-slides/runtime/value-format.mjs';
import {compilePage} from './skills/professional-slides/runtime/page-types.mjs';
const base={takeaway:false,why:'The page compares the two firms on the same terms',settles:{kind:'comparison',what:'Company filings, 2025 to 2026'},adds:'The commentary names what the exhibit cannot'};
const page=(cell)=>({...base,id:'p1',type:'lookup',form:'table',commentary:'none',title:'The near-term commercial call is split between the two firms',
  exhibit:{columns:[{label:'Criterion',type:'category'},'Confidence','Reason'],rows:[['Consumer reach',cell,'Weekly users'],['Enterprise adoption',cell,'Ramp panel'],['Coding',cell,'Units differ']]}});
const refused=(cell)=>{try{compilePage(page(cell));return false;}catch(e){return /VERDICT_TABLE_PLAIN/.test(e.message);}};
const cells=['+25bps','12 pts','4.5/5','$12.5bn','3.2x','~40%','−1.5pp','1,200','€4bn+','High','Medium','Duration unclear','about 50','~50–60'];
console.log(JSON.stringify(cells.map((cell)=>({cell,figure:SCALAR_FIGURE.test(cell),refused:refused(cell)}))));
""")
        self.assertTrue(any(r["figure"] for r in result) and any(not r["figure"] for r in result))
        for row in result:
            with self.subTest(cell=row["cell"]):
                self.assertEqual(row["refused"], not row["figure"])


class FlatComboLineTests(unittest.TestCase):
    def test_a_flat_line_on_its_own_scale_is_drawn_and_a_shallow_one_still_refused(self):
        result = run_node(r"""
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const frame={x:0,y:0,width:900,height:420};
const render=(values,height=420)=>{try{return REGISTRY.get('chart.combo').render({id:'c',frame:{...frame,height},props:{categories:['FY22','FY23','FY24'],
  series:[{name:'Revenue',values:[100,120,140]},{name:'Margin',values}],secondaryAxis:true,yMin:0,y2Min:0,y2Max:100,annotations:[],highlights:[],referenceLines:[]}}).nodes.filter((n)=>n.role==='chart-marker').length;}catch(e){return e.message;}};
console.log(JSON.stringify({flat:render([12,12,12]),shallow:render([12,12.4,12.8])}));
""")
        self.assertEqual(result["flat"], 3, "a margin held level is the finding")
        self.assertIn("rises", str(result["shallow"]))


class CellAndPointEmphasisTests(unittest.TestCase):
    def test_a_tables_bulleted_cell_takes_the_pages_phrase(self):
        result = run_node(DECK + r"""
const deck=build([{id:'t',title:'Two operators lead on cost and one on fares',layout:'exhibit-full',highlight:'Lowest unit cost',
  exhibit:{type:'table',columns:[{label:'Operator',type:'text'},{label:'Findings',type:'bullets'}],
    rows:[['North',{type:'bullets',items:['Lowest unit cost in the set','Fares held flat']}],['South',{type:'bullets',items:['Highest yield','Costs rising']}]]}}]);
console.log(JSON.stringify(lit(deck.slides[0].nodes)));
""")
        self.assertTrue(any(text == "Lowest unit cost" and accent for _, text, accent in result), result)

    def test_one_point_under_panels_keeps_its_bold_lead_and_its_phrase(self):
        result = run_node(DECK + r"""
const deck=build([{id:'u',title:'Margin and cost moved together at one operator',layout:'two-up',highlight:'only one of five',
  exhibits:[chart('Margin'),chart('Cost')],points:[{lead:'Margin and cost moved together',text:'at only one of five operators in the year.'}]}]);
console.log(JSON.stringify(lit(deck.slides[0].nodes).filter(([role])=>role==='paragraph')));
""")
        self.assertIn(["paragraph", "Margin and cost moved together", False], result, "the lead in bold")
        self.assertIn(["paragraph", "only one of five", True], result, "the phrase in the accent")


class SharedRuleTests(unittest.TestCase):
    def test_the_shared_rules_answer_as_their_callers_did(self):
        result = run_node(r"""
import {onFill,cardFill} from './skills/professional-slides/runtime/core.mjs';
import {spacedLabelIndices} from './skills/professional-slides/runtime/time-axis.mjs';
import {chartFrame,topBand,BAR_HEADROOM} from './skills/professional-slides/runtime/charts.mjs';
import {evidenceTreatment} from './skills/professional-slides/runtime/chart-annotations.mjs';
import {unknownIcon} from './skills/professional-slides/runtime/icons.mjs';
const frame={x:0,y:0,width:800,height:400};
console.log(JSON.stringify({
  dark:onFill('#101820').tokenId, light:onFill('#f4f4f4').tokenId,
  spaced:spacedLabelIndices([0,30,60,200,230],100), bunchedEnd:spacedLabelIndices([0,150,300,310],100),
  band:chartFrame(frame,{topLegend:2,headroom:BAR_HEADROOM}).y-frame.y, topBand:topBand(2,BAR_HEADROOM),
  alias:evidenceTreatment({treatment:'takeaway-box'}), plain:evidenceTreatment({}),
  icon:unknownIcon('planee'), card:Object.keys(cardFill())}));
""")
        self.assertEqual(result["dark"], "color.onPrimary")
        self.assertEqual(result["light"], "color.ink")
        self.assertEqual(result["spaced"], [0, 4], "the latest over 200, which it crowds")
        self.assertEqual(result["bunchedEnd"], [0, 1, 3], "the latest kept over the one before it")
        self.assertEqual(result["band"], result["topBand"], "the frame and the row budget agree")
        self.assertEqual((result["alias"], result["plain"]), ("callout", "callout"))
        self.assertIn("Unknown icon: planee; the nearest are plane", result["icon"])
        self.assertEqual(result["card"], ["fill", "stroke"])


if __name__ == "__main__":
    unittest.main()
