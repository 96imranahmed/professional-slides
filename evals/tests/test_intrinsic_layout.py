import unittest

from test_source_structure import run_node


class IntrinsicLayoutTests(unittest.TestCase):
    def test_nested_hug_measures_authored_copy_at_the_allocated_width(self):
        result = run_node("""
import { component, flow, grid, section, resolveLayout } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const list = (id, items) => component({id, component:'bullet-list', props:{variant:'body',items},size:{height:'hug'}});
const group = (id, items) => section({id,heading:'Enabling capabilities',size:{height:'hug'},children:[list(id+'-copy',items)]});
const short = ['Capture data.', 'Automate processes.'];
const root = flow({id:'two-groups',direction:'column',gap:16,children:[group('a',short),group('b',short)]});
const frame = {x:0,y:0,width:1000,height:450};
const placements=resolveLayout(root,frame,REGISTRY);
const rendered=REGISTRY.get('section').render({id:'a',frame:placements[0].frame,props:placements[0].node});
const nested=resolveLayout(flow({id:'copy',direction:'column',children:[list('body',short)]}),rendered.contentFrame,REGISTRY);
const measured=REGISTRY.get('bullet-list').measureContent({frame:rendered.contentFrame,props:{variant:'body',items:short}}).height;
const prose=['Compare the operating requirements across divisions before selecting a common service model.'];
const widths=[260,740];
const row=flow({id:'row',direction:'row',gap:0,children:widths.map((width,i)=>({...list('row-'+i,prose),size:{width,height:'hug'}}))});
const columns=grid({id:'grid',columns:widths,rows:['hug'],columnGap:0,children:widths.map((_,i)=>({...list('grid-'+i,prose),cell:{column:i,row:0}}))});
const rowFrames=resolveLayout(row,frame,REGISTRY).map(p=>p.frame);
const gridFrames=resolveLayout(columns,frame,REGISTRY).map(p=>p.frame);
console.log(JSON.stringify({heights:placements.map(p=>p.frame.height),inner:nested[0].frame.height,measured,rowFrames,gridFrames}));
""")
        self.assertLess(sum(result["heights"]), 300)
        self.assertAlmostEqual(result["inner"], result["measured"], places=2)
        self.assertGreater(result["rowFrames"][0]["height"], result["rowFrames"][1]["height"])
        self.assertEqual(result["gridFrames"][0]["height"], result["gridFrames"][1]["height"])
        self.assertAlmostEqual(result["gridFrames"][0]["height"], result["rowFrames"][0]["height"], places=2)

    def test_measured_content_still_rejects_a_real_overflow(self):
        result = run_node("""
import { component, flow, resolveLayout } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const root=flow({id:'long',direction:'column',children:[component({id:'copy',component:'bullet-list',size:{height:'hug'},props:{variant:'body',items:Array(10).fill('A developed observation preserves its evidence and the condition that changes the decision.')}})]});
let error=null;try{resolveLayout(root,{x:0,y:0,width:240,height:180},REGISTRY);}catch(e){error=e.message;}
console.log(JSON.stringify({error}));
""")
        self.assertIn("only 180px is available", result["error"])


if __name__ == "__main__":
    unittest.main()
