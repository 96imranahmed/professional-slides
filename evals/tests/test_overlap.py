"""Collisions (runtime/validate-overlap.mjs): the rendered overlap audit in a browser,
the scene checks the build and authoring run without one, and routed connectors.
"""
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, requires_chromium, run_node

RUNTIME = "./skills/professional-slides/runtime"


class OverlapTests(unittest.TestCase):
    @requires_chromium
    def test_rendered_collision_gate_rejects_bad_cases_and_accepts_declared_layers(self):
        results = run_node(r'''
import { createRequire } from 'node:module';
import { textPrimitive, rectPrimitive, ellipsePrimitive, linePrimitive, token } from './skills/professional-slides/runtime/core.mjs';
import { renderSlideHtml } from './evals/support/html.mjs';
import { auditSlideOverlaps } from './evals/support/overlap-audit.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', {paths:[process.env.RUNTIME_NODE_MODULES]}));
const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_BROWSER_PATH});
const page = await browser.newPage({viewport:{width:1280,height:720}});
const frame = {x:100,y:100,width:180,height:30};
const text = (id, overrides={}) => textPrimitive({id,frame,text:'Readable text',style:{fontFamily:token('font.body'),fontSize:token('type.heading'),color:token('color.ink'),valign:'top'},...overrides});
const line = (id,y,role='rule') => linePrimitive({id,role,x1:90,y1:y,x2:350,y2:y,style:{stroke:token('color.ink'),lineWidth:token('line.hairline')}});
const box = (id,role='box',f=frame) => rectPrimitive({id,role,frame:f,style:{fill:token('color.surfaceMuted'),stroke:'none'}});
const cell = () => ({...box('cell','table-cell',{x:90,y:90,width:300,height:100}),data:{row:0,column:0}});
const bullet = (row=0) => ({...box('bullet','table-bullet',{x:108,y:108,width:5,height:5}),data:{row,column:0}});
const mapLeader=(id,x1,y1,x2,y2,featureId='west')=>linePrimitive({id,role:'map-label-leader',x1,y1,x2,y2,style:{stroke:token('color.ink'),lineWidth:token('line.standard')},data:{featureId}});
const cases = {
  map_own_land:[box('land','map-land',{x:90,y:90,width:200,height:100}),mapLeader('leader',120,120,320,120)],
  map_foreign_land:[{...box('land','map-land',{x:90,y:90,width:200,height:100}),data:{componentInstance:'foreign'}},mapLeader('leader',120,120,320,120)],
  map_own_joint:[mapLeader('a',100,100,200,100),mapLeader('b',200,100,240,150)],
  map_cross_feature_lines:[mapLeader('a',100,100,220,160),mapLeader('b',100,160,220,100,'east')],
  map_same_feature_cross_without_joint:[mapLeader('a',100,100,220,160),mapLeader('b',100,160,220,100)],
  map_leader_crosses_text:[text('label'),mapLeader('leader',90,113,350,113)],
  table_own_bullet:[cell(),bullet()],
  table_wrong_row:[cell(),bullet(1)],
  table_backing_hides_bullet:[bullet(),cell()],
  roadmap_own_label:[box('band','roadmap-phase',{x:90,y:90,width:300,height:100}),text('label',{role:'process-label'})],
  roadmap_band_overpaints_label:[text('label',{role:'process-label'}),box('band','roadmap-phase',{x:90,y:90,width:300,height:100})],
  roadmap_label_outside_band:[box('band','roadmap-phase',{x:140,y:90,width:300,height:100}),text('label',{role:'process-label'})],
  text_text:[text('a'),text('b')],
  text_rule:[text('a'),line('b',113)],
  clipped_text:[text('a',{frame:{...frame,width:80,height:24},text:'This heading wraps across multiple lines'})],
  shape_shape:[box('a'),box('b','box',{...frame,x:140})],
  unrelated_container:[box('a','box',{x:90,y:90,width:300,height:200}),text('b')],
  container_does_not_excuse_text_collision:[box('a','panel-surface',{x:90,y:90,width:300,height:200}),text('b'),text('c')],
  annotation_crossing_label:[text('a'),line('b',113,'annotation-leader')],
  unequal_header_gap:[text('header:heading',{role:'section-heading',data:{headerTop:100,ruleGap:8,textLayout:{lines:['Readable text']}}}),line('header:rule',146,'section-heading-rule')],
  native_backing_hides_text:[text('a',{data:{paintOrder:1}}),{...box('b','panel-surface',{x:90,y:90,width:300,height:200}),data:{paintOrder:2}}],
  foreign_surface:[{...box('a','panel-surface',{x:90,y:90,width:300,height:200}),data:{componentInstance:'surface-owner'}},text('b',{data:{componentInstance:'foreign-owner'}})],
  nested_surface:[{...box('a','section-surface',{x:90,y:90,width:300,height:200}),data:{componentInstance:'parent'}},text('b',{data:{componentInstance:'child',componentAncestors:['parent']}})],
  stroked_shape:[rectPrimitive({id:'a',role:'box',frame:{x:90,y:90,width:300,height:100},style:{fill:'none',stroke:token('color.ink'),lineWidth:token('line.standard')}}),text('b',{frame:{x:89,y:100,width:40,height:30}})],
  own_tree_endpoint:[line('a',113,'tree-connector'),box('b','organization-node',{x:340,y:90,width:80,height:50})],
  foreign_tree_endpoint:[{...line('a',113,'tree-connector'),data:{...line('a',113,'tree-connector').data,componentInstance:'tree-a'}},{...box('b','organization-node',{x:340,y:90,width:80,height:50}),data:{componentInstance:'tree-b'}}],
  separated:[text('a'),text('b',{frame:{...frame,y:180}})],
  surface_and_own_text:[box('a','panel-surface',{x:90,y:90,width:300,height:200}),text('b')],
  marker_and_cue:[ellipsePrimitive({id:'a',role:'status-marker',frame:{x:100,y:100,width:32,height:32},style:{fill:token('color.componentPrimary'),stroke:'none'}}),text('b',{role:'status-cue',text:'1',frame:{x:108,y:104,width:16,height:24}})],
  masked_grid:[line('a',113,'chart-gridline'),box('b','chart-mark',{x:90,y:90,width:300,height:100}),text('c',{role:'data-label'})],
  callout_inside_own_bar:[{...box('bar','chart-mark',{x:90,y:90,width:300,height:60}),data:{category:'Beta'}},{...box('note','annotation-surface',{x:100,y:100,width:120,height:30}),data:{insideMark:true,category:'Beta'}}],
  callout_inside_foreign_bar:[{...box('bar','chart-mark',{x:90,y:90,width:300,height:60}),data:{category:'Alpha'}},{...box('note','annotation-surface',{x:100,y:100,width:120,height:30}),data:{insideMark:true,category:'Beta'}}],
  callout_on_bar_unflagged:[{...box('bar','chart-mark',{x:90,y:90,width:300,height:60}),data:{category:'Beta'}},{...box('note','annotation-surface',{x:100,y:100,width:120,height:30}),data:{category:'Beta'}}]
};
const output={};
for (const [id,nodes] of Object.entries(cases)) {
  nodes.forEach(n=>{if(!n.data.componentInstance)n.data.componentInstance=id;});
  const slide={id,nodes};
  await page.setContent(renderSlideHtml(slide));
  const audit=await auditSlideOverlaps(page,slide);
  output[id]={accepted:audit.accepted,overlaps:audit.unexpected.length,overflow:audit.textOverflow.length};
}
await browser.close();
console.log(JSON.stringify(output));
''')
        for case in ["map_foreign_land", "map_cross_feature_lines", "map_same_feature_cross_without_joint", "map_leader_crosses_text", "text_text", "text_rule", "clipped_text", "shape_shape", "unrelated_container", "container_does_not_excuse_text_collision", "annotation_crossing_label", "unequal_header_gap", "native_backing_hides_text", "foreign_surface", "foreign_tree_endpoint", "stroked_shape", "table_wrong_row", "table_backing_hides_bullet", "roadmap_band_overpaints_label", "roadmap_label_outside_band", "callout_inside_foreign_bar", "callout_on_bar_unflagged"]:
            self.assertFalse(results[case]["accepted"], case)
        for case in ["map_own_land", "map_own_joint", "separated", "surface_and_own_text", "nested_surface", "marker_and_cue", "masked_grid", "table_own_bullet", "own_tree_endpoint", "roadmap_own_label", "callout_inside_own_bar"]:
            self.assertTrue(results[case]["accepted"], case)
        self.assertGreater(results["clipped_text"]["overflow"], 0)

    def test_orthogonal_routes_avoid_intermediate_nodes(self):
        result = run_node('''
import { routeConnector } from './skills/professional-slides/runtime/routing.mjs';
const obstacles=[{x:0,y:0,width:100,height:40},{x:0,y:70,width:100,height:40},{x:0,y:140,width:100,height:40}];
const path=routeConnector({x:50,y:40},{x:50,y:140},obstacles);
const interiorCrossing=path.slice(1).some((p,i)=>{const a=path[i];return a.x===p.x && a.x>0 && a.x<100 && Math.max(a.y,p.y)>70 && Math.min(a.y,p.y)<110;});
console.log(JSON.stringify({interiorCrossing,orthogonal:path.slice(1).every((p,i)=>p.x===path[i].x || p.y===path[i].y)}));
''')
        self.assertEqual(result, {"interiorCrossing": False, "orthogonal": True})


class SceneCollisionTests(unittest.TestCase):
    """A label is read by its glyphs, and a line through them is found before the render."""

    def test_scene_collisions_find_a_struck_label_and_a_descending_numeral(self):
        """Fifty-page audit: arrow labels struck through by their arrows, display-serif numerals descending into a rule."""
        result = run_node(f"""
import {{ sceneCollisions }} from '{RUNTIME}/validate-overlap.mjs';
const text = (id, role, frame, extra = {{}}) => ({{ id, type: 'text', role, text: 'label 35', frame, style: {{ align: 'left', valign: 'top', fontFamily: {{ tokenId: 'font.body' }}, fontSize: {{ value: 10 }} }}, data: {{ textLayout: {{ width: frame.width, height: frame.height }} }}, ...extra }});
const line = (id, role, x1, y1, x2, y2) => ({{ id, type: 'line', role, frame: {{ x: x1, y: Math.min(y1, y2), width: x2 - x1, height: Math.abs(y2 - y1) }}, data: {{ x1, y1, x2, y2 }} }});
const numeral = (font) => ({{ id: 'n', type: 'text', role: 'divider-number', text: '3', frame: {{ x: 60, y: 100, width: 200, height: 200 }}, style: {{ valign: 'bottom', fontFamily: {{ tokenId: font }}, fontSize: {{ value: 170 }} }}, data: {{}} }});
const bar = {{ id: 'b', type: 'rect', role: 'divider-accent', frame: {{ x: 60, y: 320, width: 64, height: 4 }} }};
console.log(JSON.stringify({{
  struck: sceneCollisions({{ id: 's', nodes: [text('t', 'flow-arrow-label', {{ x: 100, y: 100, width: 60, height: 14 }}), line('l', 'flow-arrow', 80, 107, 200, 107)] }}).map((f) => f.code),
  clear: sceneCollisions({{ id: 's', nodes: [text('t', 'flow-arrow-label', {{ x: 100, y: 80, width: 60, height: 14 }}), line('l', 'flow-arrow', 80, 107, 200, 107)] }}).length,
  serif: sceneCollisions({{ id: 's', nodes: [numeral('font.display'), bar] }}).map((f) => f.code),
  lining: sceneCollisions({{ id: 's', nodes: [numeral('font.body'), bar] }}).length,
}}));
""")
        self.assertEqual(result["struck"], ["TEXT_ON_LINE"])
        self.assertEqual(result["clear"], 0)
        self.assertEqual(result["serif"], ["DESCENDER_ON_RULE"])
        self.assertEqual(result["lining"], 0)

    def test_a_label_is_read_by_its_glyphs_not_the_slot_it_is_set_in(self):
        """Fifty-page audit: read as its 60px slot, a value label had its own series' segments through it."""
        # A line chart's value label is a 60px slot round four figures. Read as
        # ink, the slot put the series' own segments through every label.
        result = run_node(f"""
import {{ sceneCollisions, inkBox }} from '{RUNTIME}/validate-overlap.mjs';
const label = {{ id: 'v', type: 'text', role: 'data-label', text: '91.2', frame: {{ x: 872.9, y: 331.9, width: 60, height: 24 }},
  style: {{ align: 'center', valign: 'mid', bold: true, fontFamily: {{ value: 'Arial' }}, fontSize: {{ value: 10 }} }}, data: {{}} }};
const line = (x1, y1, x2, y2) => ({{ id: 'l', type: 'line', role: 'chart-line', frame: {{ x: x1, y: Math.min(y1, y2), width: x2 - x1, height: Math.abs(y2 - y1) }}, data: {{ x1, y1, x2, y2 }} }});
const ink = inkBox(label);
console.log(JSON.stringify({{ ink,
  beside: sceneCollisions({{ id: 's', nodes: [label, line(902.9, 325.9, 965.1, 362.7)] }}).length,
  through: sceneCollisions({{ id: 's', nodes: [label, line(850, 344, 960, 344)] }}).map((f) => f.code) }}));
""")
        self.assertLess(result["ink"]["width"], 30)
        self.assertLess(result["ink"]["height"], 12)
        self.assertEqual(result["beside"], 0, "the segment leaving the point passes the slot's corner, not the figures")
        self.assertEqual(result["through"], ["TEXT_ON_LINE"])

    def test_a_reference_label_is_set_clear_of_the_series_it_crosses(self):
        """Fifty-page audit: a break-even label took the first free corner and the series ran through it."""
        # A break-even line at zero, crossed by a joined series near the
        # plot's right end: the label took the first free corner of the marks
        # and the series ran through it.
        result = run_node(f"""
import {{ REGISTRY }} from '{RUNTIME}/registry.mjs';
import {{ sceneCollisions }} from '{RUNTIME}/validate-overlap.mjs';
const costs = [0, 20, 40, 55, 60, 80, 85, 100];
const points = [15, 45].flatMap((take) => costs.map((x) => ({{ name: `${{take}}% take, $${{x}} cost`, x, y: 100 - take - x, series: `${{take}}% take`, showLabel: false }})));
const nodes = REGISTRY.get('chart.scatter').render({{ id: 'c', frame: {{ x: 60, y: 160, width: 780, height: 460 }}, props: {{ points, connect: true,
  xLabel: 'Serving cost, $', yLabel: 'Contribution, $', xScale: {{ min: 0, max: 100, step: 25 }}, yScale: {{ min: -50, max: 100, step: 25 }},
  referenceLines: [{{ value: 0, label: 'Break-even: $55 at 45% take, $85 at 15%' }}], annotations: [], highlights: [] }} }}).nodes;
console.log(JSON.stringify(sceneCollisions({{ id: 's', nodes }}).map((f) => f.code)));
""")
        self.assertEqual(result, [])


class SceneDesignFindingTests(unittest.TestCase):
    """The scene checks are gate findings, and the build and authoring both read them."""

    def test_the_scene_checks_are_gate_findings_the_build_reports(self):
        """Fifty-page audit: the scene checks reach the build as findings with a severity each."""
        result = run_node(f"""
import {{ sceneDesignFindings, OVERLAP_CODES, OVERLAP_SEVERITY }} from '{RUNTIME}/validate-overlap.mjs';
import {{ withFindings, buildOutcome }} from '{RUNTIME}/build-deck.mjs';
import {{ applyRulesVersion }} from '{RUNTIME}/weight.mjs';
const text = (id, frame) => ({{ id, type: 'text', role: 'flow-arrow-label', text: 'agent role', frame, style: {{ align: 'left', valign: 'top', fontSize: {{ value: 10 }} }}, data: {{}} }});
const arrow = {{ id: 'a', type: 'line', role: 'flow-arrow', frame: {{ x: 80, y: 107, width: 120, height: 0 }}, data: {{ x1: 80, y1: 107, x2: 200, y2: 107 }} }};
const box = {{ id: 'b', type: 'rect', role: 'flow-step', frame: {{ x: 300, y: 80, width: 100, height: 60 }} }};
const scene = {{ slides: [{{ id: 'cover', nodes: [] }}, {{ id: 'p1', nodes: [text('t', {{ x: 100, y: 100, width: 60, height: 14 }}), arrow] }}, {{ id: 'p2', nodes: [text('e', {{ x: 240, y: 100, width: 59, height: 14 }}), box] }}] }};
const found = sceneDesignFindings(scene);
const outcome = (findings) => buildOutcome({{ preflight: withFindings({{ passed: true, findings: [] }}, findings), readback: {{ accepted: true }} }}, {{ render: false }});
const older = applyRulesVersion(found, {{ workflow: 'existing_deck_revision', rulesVersion: 2 }});
console.log(JSON.stringify({{ found: found.map((f) => [f.slide, f.id, f.code, f.severity]), codes: Object.keys(OVERLAP_CODES).sort(), held: Object.keys(OVERLAP_SEVERITY).sort(),
  status: outcome(found).status, blockers: outcome(found).blockers.map((b) => b.code), edgeOnly: outcome(found.filter((f) => f.code === 'TEXT_ON_EDGE')).status,
  older: outcome(older).status }}));
""")
        self.assertEqual(result["codes"], result["held"], "every scene check has a severity")
        self.assertIn([2, "p1", "TEXT_ON_LINE", "blocker"], result["found"])
        self.assertIn([3, "p2", "TEXT_ON_EDGE", "advisory"], result["found"])
        self.assertEqual(result["status"], "built-with-blockers")
        self.assertEqual(result["blockers"], ["TEXT_ON_LINE"])
        self.assertEqual(result["edgeOnly"], "built-unrendered")
        self.assertEqual(result["older"], "built-unrendered", "a revision under older rules hears it as advice")

    def test_the_build_and_authoring_run_the_scene_checks(self):
        """Fifty-page audit: the checks shipped unwired, imported by the eval suite alone."""
        # A loader hook stands in for validate-overlap.mjs wherever the runtime
        # imports it, adding one planted finding to what the real checks find.
        # The build's preflight report and the author's findings must carry it.
        planted = {"slide": 1, "id": "planted", "code": "TEXT_ON_LINE", "severity": "blocker",
                   "measured": {"planted": True}, "threshold": "no contact", "repair": "Planted by the test."}
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            real = (ROOT / "skills/professional-slides/runtime/validate-overlap.mjs").as_uri()
            (tmp / "shim.mjs").write_text(
                f"export * from {json.dumps(real)};\n"
                f"import {{ sceneDesignFindings as real }} from {json.dumps(real)};\n"
                f"export function sceneDesignFindings(scene) {{ return [...real(scene), {json.dumps(planted)}]; }}\n")
            (tmp / "hooks.mjs").write_text(
                "const SHIM = new URL('./shim.mjs', import.meta.url).href;\n"
                "export async function resolve(specifier, context, next) {\n"
                "  const found = await next(specifier, context);\n"
                "  return found.url.endsWith('/runtime/validate-overlap.mjs') && context.parentURL !== SHIM ? { ...found, url: SHIM, shortCircuit: true } : found;\n"
                "}\n")
            (tmp / "register.mjs").write_text("import { register } from 'node:module';\nregister('./hooks.mjs', import.meta.url);\n")
            hooked = [NODE, "--import", (tmp / "register.mjs").as_uri()]
            spec = {"schema": "professional-slides.deck/v3", "id": "probe", "cover": {"title": "A probe deck"},
                    "slides": [{"title": "A page that states one finding in a sentence", "layout": "text",
                                "points": ["A point that says something about the finding and why it matters."]}]}
            (tmp / "probe.deck.json").write_text(json.dumps(spec))
            build = subprocess.run([*hooked, str(ROOT / "skills/professional-slides/runtime/build-deck.mjs"), str(tmp / "probe.deck.json"), str(tmp / "out"), "--preflight"],
                                   cwd=ROOT, capture_output=True, text=True, timeout=300)
            self.assertIn(build.returncode, (0, 2), build.stderr)
            preflight = json.loads((tmp / "out" / "preflight-gates.json").read_text())
            self.assertIn("planted", [f.get("id") for f in preflight["findings"]], "the build does not report the scene checks")
            authored = subprocess.run([*hooked, "--input-type=module", "--eval", f"""
import {{ authorDeck, scaffoldPage }} from {json.dumps((ROOT / "skills/professional-slides/runtime/author-deck.mjs").as_uri())};
const doc = {{ deck: {{ schema: 'professional-slides.deck/v3', id: 'probe' }}, pages: [scaffoldPage('trend', {{ id: 'p01' }})] }};
const out = await authorDeck(doc, {{ baseDir: {json.dumps(str(tmp))} }});
console.log(JSON.stringify([...out.findings, ...out.pageGateAdvisories].map((f) => f.id ?? null)));
"""], cwd=ROOT, capture_output=True, text=True, timeout=300)
            self.assertEqual(authored.returncode, 0, authored.stderr)
            self.assertIn("planted", json.loads(authored.stdout.strip().splitlines()[-1]), "authoring does not read the scene checks")


if __name__ == "__main__":
    unittest.main()
