"""Three export defects a fifty-page evaluation deck surfaced.

A standalone donut named none of its categories; a highlighted phrase just
after a line wrap split a takeaway into two PowerPoint paragraphs; and a 100%
stack printed 35.8 in its scene and 36 in PowerPoint.
"""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from node_probe import run_node  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / "skills/professional-slides/runtime"


class DonutLegendTests(unittest.TestCase):
    def test_a_composed_donut_names_its_categories_and_its_native_chart_keeps_the_legend(self):
        result = run_node("""
import { toDeckPlan } from './skills/professional-slides/runtime/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const spec={schema:'professional-slides.deck/v3',id:'d',cover:{title:'x'},slides:[{title:'Two firms supply most of the judged pages',layout:'exhibit-full',
  exhibit:{type:'chart.donut',heading:'Pages by firm',unit:'pages',labels:['BCG','McKinsey','Bain'],values:[75,52,5]}}]};
const {deck}=planDeck(toDeckPlan(spec,'.'));
const page=deck.slides.at(-1);
const donut=page.componentInstances.find(c=>c.component==='chart.donut');
console.log(JSON.stringify({variant:donut.variant,legend:page.nodes.filter(n=>n.role==='legend-label').map(n=>n.text),native:donut.nativeChart?.legend}));
""")
        self.assertEqual(result["variant"], "legend-top-right")
        self.assertEqual(result["legend"], ["BCG", "McKinsey", "Bain"])
        self.assertTrue(result["native"])


class HighlightWrapTests(unittest.TestCase):
    def test_a_highlight_after_a_wrap_keeps_one_source_paragraph(self):
        result = run_node("""
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const text='Hold pages to the strong benchmarks. The diagram floor still binds, because the floor is hard, but it is the first number to re-measure as more diagram pages are judged.';
const nodes=REGISTRY.get('insight').render({id:'i',frame:{x:0,y:0,width:900,height:120},props:{text,highlight:'diagram'}}).nodes;
const body=nodes.find(n=>n.role==='insight-body');
const src=body.data.textLayout.sourceRuns||[];
console.log(JSON.stringify({wrapped:body.text.includes('\\n'),runsHaveBreak:(body.runs||[]).some(r=>r.text.includes('\\n')),
  sourceRuns:src.length,sourceBreak:src.some(r=>r.text.includes('\\n')),joined:src.map(r=>r.text).join('')===text}));
""")
        self.assertTrue(result["wrapped"])
        self.assertGreater(result["sourceRuns"], 1)
        self.assertFalse(result["sourceBreak"])
        self.assertTrue(result["joined"])


class ImageDividerFooterTests(unittest.TestCase):
    def test_the_footer_stays_in_the_panel_not_on_the_photograph(self):
        # White footer type over a crowd in the photo was unreadable.
        result = run_node("""
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const img = {dataUri:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',width:1,height:1,alt:'A photograph',authorization:'test'};
const nodes = REGISTRY.get('section-divider').render({id:'d',frame:{x:0,y:0,width:1280,height:720},props:{title:'The test',companyName:'A deck footer',image:img}}).nodes;
const photo = nodes.find(n=>n.role==='divider-image'), foot = nodes.find(n=>n.role==='footer-right');
console.log(JSON.stringify({photoLeft:photo.frame.x, footRight:foot ? foot.frame.x+foot.frame.width : null}));
""")
        self.assertIsNotNone(result["footRight"])
        self.assertLessEqual(result["footRight"], result["photoLeft"])


class BarScaleTests(unittest.TestCase):
    def test_bar_columns_can_share_a_scale_and_print_no_template_key(self):
        # Four "% of films" columns each scaled to their own maximum could not
        # be read across a row, and each printed "(unit, common scale 0 to N)".
        result = run_node("""
import { toDeckPlan } from './skills/professional-slides/runtime/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const col = (label) => ({label, unit: '% of films', bar: true, barScale: 'share'});
const spec={schema:'professional-slides.deck/v3',id:'b',cover:{title:'x'},slides:[{title:'The lead holds until the bars reward peaks over consistency',layout:'exhibit-full',
  exhibit:{type:'table',columns:[{label:'Franchise'},col('Loose bars'),col('Strict bars')],rows:[['A','100','12'],['B','67','50'],['C','47','32']]}}]};
const page=planDeck(toDeckPlan(spec,'.')).deck.slides.at(-1);
const bars=page.nodes.filter(n=>n.role==='table-bar');
const width=(row,col)=>bars.find(n=>n.data?.row===row&&n.data?.column===col)?.frame.width;
console.log(JSON.stringify({key:page.nodes.some(n=>/common scale/.test(String(n.text||''))), ratio: width(1,2)/width(1,1)}));
""")
        self.assertFalse(result["key"])
        # 50 against 67 on one scale, not each bar at its own column's maximum.
        self.assertAlmostEqual(result["ratio"], 50 / 67, places=2)


class DeclaredDecimalsTests(unittest.TestCase):
    def test_a_declared_format_rounds_half_away_from_zero_like_powerpoint(self):
        # 3.55 is stored as 3.5499...; toFixed printed 3.5 on the drawn chart
        # while PowerPoint printed 3.6 on the native one.
        result = run_node("""
import { formatValue } from './skills/professional-slides/runtime/value-format.mjs';
console.log(JSON.stringify([3.55, -1.25, 2.345].map(v => formatValue(v, {valueFormat: {decimals: 1}}))));
""")
        self.assertEqual(result, ["3.6", "-1.3", "2.3"])


class SeriesRoundingTests(unittest.TestCase):
    def test_the_native_label_format_matches_the_drawn_one(self):
        sys.path.insert(0, str(RUNTIME / "emit"))
        from pptx import Presentation  # noqa: E402
        scene = run_node("""
import { toDeckPlan } from './skills/professional-slides/runtime/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const spec={schema:'professional-slides.deck/v3',id:'r',cover:{title:'x'},slides:[{title:'BCG leads with charts and McKinsey with text',layout:'exhibit-full',
  exhibit:{type:'chart.stacked-column',percent:true,heading:'Pages by family',categories:['BCG','McKinsey'],
    series:[{name:'Chart',values:[24,12]},{name:'Text',values:[13,15]},{name:'Table',values:[14,10]}]}}]};
console.log(JSON.stringify(planDeck(toDeckPlan(spec,'.')).deck));
""")
        labels = [n["text"] for n in scene["slides"][-1]["nodes"] if n["role"] == "data-label"]
        self.assertIn("47.1", labels)
        with tempfile.TemporaryDirectory() as tmp:
            scene_path, pptx_path = Path(tmp) / "scene.json", Path(tmp) / "r.pptx"
            scene_path.write_text(json.dumps(scene))
            subprocess.run([sys.executable, str(RUNTIME / "emit" / "emit_pptx.py"), str(scene_path), str(pptx_path)],
                           check=True, capture_output=True)
            chart = next(s.chart for s in Presentation(pptx_path).slides[-1].shapes if s.has_chart)
            # One decimal where the scene has one, none where it has none: the
            # drawn chart writes 47.1 beside 27, so the native chart must too.
            self.assertEqual(chart.plots[0].data_labels.number_format, "General")


class ScatterAxisTests(unittest.TestCase):
    def test_a_scatter_names_both_axes_and_ticks_at_its_declared_step(self):
        # A scatter accepted xLabel, yLabel and xScale and drew none of them:
        # an unnamed pair of axes running to 120 on a percentage measure.
        result = run_node("""
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const n=REGISTRY.get('chart.scatter').render({id:'s',frame:{x:0,y:0,width:700,height:420},props:{xLabel:'Mean score, %',yLabel:'Share of films, %',
  xScale:{min:40,max:90,step:10},yScale:{min:0,max:100,step:25},points:[{name:'A',x:84,y:100},{name:'B',x:50,y:20}]}}).nodes;
const text=(role,axis)=>n.filter(x=>x.role===role&&x.data?.axis===axis).map(x=>x.text);
console.log(JSON.stringify({titles:n.filter(x=>x.role==='axis-title').map(x=>x.text),x:text('axis-label','x'),y:text('axis-label','y')}));
""")
        self.assertEqual(result["titles"], ["Mean score, %", "Share of films, %"])
        self.assertEqual(result["x"], ["40", "50", "60", "70", "80", "90"])
        self.assertEqual(result["y"][0], "0")
        self.assertEqual(result["y"][-1], "100")
        self.assertEqual(len(result["y"]), 5)


class LineLabelSideTests(unittest.TestCase):
    def test_a_trough_label_sits_below_and_the_scene_and_native_chart_agree(self):
        # Bond's mean gross by decade: every label above its marker set 540,
        # 869 and 901 on the line itself.
        values = [1000, 930, 540, 711, 869, 1375, 901]
        sys.path.insert(0, str(ROOT / "skills/professional-slides/runtime/emit"))
        try:
            import importlib
            emit = importlib.import_module("emit_pptx")
        except ModuleNotFoundError:
            self.skipTest("python-pptx is not installed")
        python_sides = emit.line_label_sides(values)
        js = run_node(f"""
import {{ lineLabelSides }} from './skills/professional-slides/runtime/charts.mjs';
console.log(JSON.stringify(lineLabelSides({values})));
""")
        self.assertEqual(python_sides, js)
        self.assertEqual(python_sides, ["above", "above", "below", "above", "below", "above", "right"])


class PictureRowTests(unittest.TestCase):
    def test_a_poster_row_sets_its_text_on_the_picture_centre_and_keeps_the_poster_upright(self):
        # A row of posters cropped to landscape slivers, the film's name set at
        # the poster's top edge and its gross half a poster lower.
        import base64, struct, zlib
        def png(w, h):
            chunk = lambda kind, body: struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xffffffff)
            raw = b"".join(b"\x00" + b"\x80\x80\x80" * w for _ in range(h))
            return base64.b64encode(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
                                    + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")).decode()
        result = run_node(f"""
import {{ REGISTRY }} from './skills/professional-slides/runtime/registry.mjs';
const media={{dataUri:'data:image/png;base64,{png(20, 30)}',width:20,height:30,alt:'A poster',authorization:'test fixture'}};
const n=REGISTRY.get('table').render({{id:'t',frame:{{x:0,y:0,width:900,height:400}},props:{{columns:[{{label:'',type:'photo',width:{{px:96}}}},{{label:'Film'}},{{label:'Critics',unit:'%'}}],rows:[[{{media}},'A film with a name','81']]}}}}).nodes;
const photo=n.find(x=>x.role==='table-photo'), texts=n.filter(x=>x.type==='text'&&x.data?.row===0);
const centre=f=>f.y+f.height/2;
console.log(JSON.stringify({{ratio:photo.frame.height/photo.frame.width, offsets:texts.map(x=>Math.abs(centre(x.frame)-centre(photo.frame)))}}));
""")
        self.assertAlmostEqual(result["ratio"], 1.5, places=2)
        self.assertTrue(all(o < 3 for o in result["offsets"]), result["offsets"])


if __name__ == "__main__":
    unittest.main()
