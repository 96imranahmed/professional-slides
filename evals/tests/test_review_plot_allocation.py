"""Aligned bar columns in one unit share one physical scale, so a bar's length
means the same in every column."""
import unittest
from node_probe import run_node

PRELUDE = """
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
"""

class ReviewPlotAllocationTests(unittest.TestCase):
    def test_aligned_same_units_share_pixels_per_unit(self):
        r=run_node(PRELUDE+"""
const categories=['A','B','C','D','E','F','G'];
const values=[[1,4,17,26,58,48,35],[2,6,15,22,56,60,75]];
const render=(units)=>REGISTRY.get('chart-group').render({id:'rank',frame:{x:0,y:0,width:1100,height:360},props:{aligned:true,charts:values.map((v,i)=>({heading:String(2025+i),unit:units[i],component:'chart.bar',props:{categories,series:[{name:String(i),values:v}]}}))}}).nodes;
const ratios=(nodes)=>[0,1].map(i=>{const n=nodes.find(n=>n.role==='chart-mark'&&n.data.category==='F'&&n.data.childChart.endsWith(':'+i));return n.frame.width/values[i][5];});
console.log(JSON.stringify({same:ratios(render(['rank','rank'])),different:ratios(render(['rank','index']))}));
""")
        self.assertAlmostEqual(*r['same'],delta=0.001)
        self.assertNotAlmostEqual(*r['different'],delta=0.01)

if __name__=='__main__':unittest.main()
