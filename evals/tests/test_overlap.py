import unittest
from evals.tests.test_source_structure import run_node


class OverlapTests(unittest.TestCase):
    def test_rendered_collision_gate_rejects_bad_cases_and_accepts_declared_layers(self):
        results = run_node(r'''
import { createRequire } from 'node:module';
import { textPrimitive, rectPrimitive, ellipsePrimitive, linePrimitive, token } from './skills/professional-slides/runtime/core.mjs';
import { renderSlideHtml } from './skills/professional-slides/runtime/adapters/html.mjs';
import { auditSlideOverlaps } from './skills/professional-slides/runtime/validate-overlap.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', {paths:[process.env.RUNTIME_NODE_MODULES]}));
const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_BROWSER_PATH});
const page = await browser.newPage({viewport:{width:1280,height:720}});
const frame = {x:100,y:100,width:180,height:30};
const text = (id, overrides={}) => textPrimitive({id,frame,text:'Readable text',style:{fontFamily:token('font.body'),fontSize:token('type.heading'),color:token('color.ink'),valign:'top'},...overrides});
const line = (id,y,role='rule') => linePrimitive({id,role,x1:90,y1:y,x2:350,y2:y,style:{stroke:token('color.ink'),lineWidth:token('line.hairline')}});
const box = (id,role='box',f=frame) => rectPrimitive({id,role,frame:f,style:{fill:token('color.surfaceMuted'),stroke:'none'}});
const cases = {
  text_text:[text('a'),text('b')],
  text_rule:[text('a'),line('b',113)],
  clipped_text:[text('a',{frame:{...frame,width:80,height:24},text:'This heading wraps across multiple lines'})],
  shape_shape:[box('a'),box('b','box',{...frame,x:140})],
  unrelated_container:[box('a','box',{x:90,y:90,width:300,height:200}),text('b')],
  container_does_not_excuse_text_collision:[box('a','panel-surface',{x:90,y:90,width:300,height:200}),text('b'),text('c')],
  annotation_crossing_label:[text('a'),line('b',113,'annotation-leader')],
  unequal_header_gap:[text('header:heading',{role:'section-heading',data:{headerTop:100,ruleGap:8,textLayout:{lines:['Readable text']}}}),line('header:rule',146,'section-heading-rule')],
  native_backing_hides_text:[text('a',{data:{paintOrder:1}}),{...box('b','panel-surface',{x:90,y:90,width:300,height:200}),data:{paintOrder:2}}],
  separated:[text('a'),text('b',{frame:{...frame,y:180}})],
  surface_and_own_text:[box('a','panel-surface',{x:90,y:90,width:300,height:200}),text('b')],
  marker_and_cue:[ellipsePrimitive({id:'a',role:'status-marker',frame:{x:100,y:100,width:32,height:32},style:{fill:token('color.componentPrimary'),stroke:'none'}}),text('b',{role:'status-cue',text:'1',frame:{x:108,y:104,width:16,height:24}})],
  masked_grid:[line('a',113,'chart-gridline'),box('b','chart-mark',{x:90,y:90,width:300,height:100}),text('c',{role:'data-label'})]
};
const output={};
for (const [id,nodes] of Object.entries(cases)) {
  nodes.forEach(n=>n.data.componentInstance=id);
  const slide={id,nodes};
  await page.setContent(renderSlideHtml(slide));
  const audit=await auditSlideOverlaps(page,slide);
  output[id]={accepted:audit.accepted,overlaps:audit.unexpected.length,overflow:audit.textOverflow.length};
}
await browser.close();
console.log(JSON.stringify(output));
''')
        for case in ["text_text", "text_rule", "clipped_text", "shape_shape", "unrelated_container", "container_does_not_excuse_text_collision", "annotation_crossing_label", "unequal_header_gap", "native_backing_hides_text"]:
            self.assertFalse(results[case]["accepted"], case)
        for case in ["separated", "surface_and_own_text", "marker_and_cue", "masked_grid"]:
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


if __name__ == "__main__":
    unittest.main()
