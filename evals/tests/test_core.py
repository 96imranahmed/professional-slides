"""The scene compiler (runtime/core.mjs): which charts go native, and the slide cache.

A chart is handed to PowerPoint as a native chart only when Office can draw
what the scene drew - a format Office cannot express, a named scatter or a keyed
forecast stays drawn. And a cached slide is reused only for the chrome it was
compiled against.
"""
import unittest

from node_probe import run_node


class NativeChartSpecTests(unittest.TestCase):
    def test_rich_formats_and_named_scatter_preserve_scene_rendering(self):
        """PR #4 review: currency, percent, grouped and compact formats, and a named scatter, went native and lost what the scene printed."""
        result = run_node('''
import assert from 'node:assert/strict';
import {nativeChartSpec} from './skills/professional-slides/runtime/core.mjs';
const frame={x:0,y:0,width:500,height:300}, props={categories:['A'],values:[1200000]};
for(const valueFormat of [{prefix:'$'},{suffix:'%'},{grouping:true},{sign:'always'},{compactUnit:'m'},'percent'])
 assert.equal(nativeChartSpec('chart.column',{...props,valueFormat},frame),null);
assert.ok(nativeChartSpec('chart.column',{...props,valueFormat:{decimals:2}},frame));
assert.equal(nativeChartSpec('chart.scatter',{points:[{x:1,y:2,name:'Alpha',series:'First'},{x:2,y:3,name:'Beta',series:'Second'}]},frame),null);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])

    def test_a_keyed_forecast_stays_drawn(self):
        """PR #4 follow-up: a native forecast kept the grey tint and lost the key that says what grey means."""
        # `forecastFrom` used to be a native case above: PowerPoint kept the
        # grey per-point tint and nothing said what grey meant. The drawn chart
        # now keys the forecast (legend entry, dashed boundary), which Office
        # cannot place against its own plot, so the chart is assembled as shapes.
        scene = run_node('''
import {compileDeck} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const slides=[{id:'f',composition:{nodeType:'component',id:'plot',component:'chart.column',props:{categories:['A','B','C'],series:[{name:'Revenue',values:[20,40,45]}],forecastFrom:'B'},frame:{x:60,y:160,width:1000,height:460}}}];
console.log(JSON.stringify(compileDeck({id:'charts',slides},REGISTRY)));
''')
        source = scene['slides'][0]
        self.assertIsNone(source['componentInstances'][0].get('nativeChart'))
        self.assertTrue(any(n['role'] == 'chart-forecast-divider' for n in source['nodes']))


class SlideCacheTests(unittest.TestCase):
    def test_cached_slide_respects_resolved_chrome(self):
        """PR #4 review: a cached slide was reused after the deck's chrome changed."""
        result=run_node('''
import assert from 'node:assert/strict';
import {compileDeck} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const slideCache=new Map(),spec={slides:[{id:'one',chrome:{title:'Growth funds expansion'},composition:{nodeType:'component',id:'p',component:'paragraph',props:{text:'Evidence'},frame:{x:60,y:160,width:500,height:100}}}]};
const a=compileDeck(spec,REGISTRY,{slideCache});
const changed={...spec,chrome:{left:100,bodyTop:190}};
const b=compileDeck(changed,REGISTRY,{slideCache});
const fresh=compileDeck(changed,REGISTRY);
assert.deepEqual(b.slides,fresh.slides);
assert.notDeepEqual(a.slides[0].contentFrame,b.slides[0].contentFrame);
assert.equal(slideCache.size,2);
console.log(JSON.stringify({accepted:true}));
''')
        self.assertTrue(result['accepted'])


if __name__ == "__main__":
    unittest.main()
