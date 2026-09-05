import unittest

from test_source_structure import run_node


class TrackerTemplateTests(unittest.TestCase):
    def test_full_and_compact_variants_share_one_exact_tracker_map(self):
        result = run_node(r"""
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { componentFixtureSpecs, componentVariantFixtureSpecs } from './skills/professional-slides/runtime/fixtures.mjs';
const page=REGISTRY.get('tracker-page'),label=REGISTRY.get('tracker-label');
assert.equal(Object.keys(page.variants).length,16);
assert.equal(Object.keys(label.variants).length,6);
const fixtures=[...componentFixtureSpecs(),...componentVariantFixtureSpecs()];
assert.equal(fixtures.filter(s=>s.target==='tracker-page').length,16);
assert.equal(fixtures.filter(s=>s.target==='tracker-label').length,6);
assert.equal(page.variants['split-selected-long-light'].props.items.length,8);
const items=['A','B','C','D'].map(id=>({id,label:`Section ${id}`}));
const frame={x:0,y:0,width:1280,height:720};
const full=page.render({id:'full',frame,props:{trackerId:'map',items,selectedId:'B',layout:'split-contents',mode:'light',density:'regular'}}).nodes;
const compact=label.render({id:'compact',frame:{x:60,y:30,width:1160,height:20},props:{trackerId:'map',items,selectedId:'B',construction:'compact-breadcrumb',parentTitle:'Contents',mode:'light'}}).nodes;
const selected=full.filter(n=>n.data.selected).map(n=>n.data.sectionId).filter(Boolean);
assert.deepEqual([...new Set(selected)],['B']);
assert.equal(compact[0].data.trackerId,'map');
assert.equal(compact[0].data.sectionId,'B');
assert.equal(compact[0].text,'Contents / B. Section B');
for(const props of [
 {items:items.slice(0,2)},
 {items:[...items,{id:'A',label:'Duplicate'}]},
 {items,selectedId:'Z'},
 {items,selectedId:'B',layout:'cards'},
 {items,selectedId:'B',layout:'sequential-circles',density:'long'},
 {items,selectedId:'B',layout:'split-contents',selectionTreatment:'glow'},
 {items,selectedId:'B',layout:'sequential-circles',selectionTreatment:'tint'}
]) assert.throws(()=>page.render({id:'bad',frame,props}));
assert.throws(()=>label.render({id:'bad',frame:{x:0,y:0,width:400,height:20},props:{items,selectedId:null}}));
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_selection_changes_cues_not_peer_geometry(self):
        result = run_node(r"""
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const page=REGISTRY.get('tracker-page'),items=['A','B','C','D'].map(id=>({id,label:`Section ${id}`})),frame={x:0,y:0,width:1280,height:720};
for(const layout of ['sequential-circles','split-contents']) for(const mode of ['light','dark']) {
 const base={trackerId:'map',items,layout,mode,density:'regular'};
 const overview=page.render({id:'same',frame,props:{...base,selectedId:null}}).nodes;
 const selected=page.render({id:'same',frame,props:{...base,selectedId:'B'}}).nodes;
 for(const role of ['tracker-marker','tracker-marker-label','tracker-item-label']) {
  const a=overview.filter(n=>n.role===role).map(n=>n.frame),b=selected.filter(n=>n.role===role).map(n=>n.frame);
  assert.deepEqual(b,a,`${layout} ${mode} ${role}`);
 }
 const active=selected.find(n=>n.role==='tracker-marker'&&n.data.sectionId==='B');
 assert.equal(active.style.fill.tokenId,mode==='light'?'color.componentPrimary':layout==='sequential-circles'?'color.onPrimary':'color.componentPrimary');
 const activeLabel=selected.find(n=>n.role==='tracker-marker-label'&&n.data.sectionId==='B');
 if (layout==='split-contents') {
  assert.equal(active.style.stroke.tokenId,'color.componentPrimary');
  assert.equal(activeLabel.style.color.tokenId,'color.onPrimary');
  const selection=selected.find(n=>n.role==='tracker-selection');
  assert.equal(selection.style.fill.tokenId,mode==='dark'?'color.surface':'color.componentPrimaryTint');
  assert.equal(selection.data.selectionTreatment,'tint');
 } else if (mode==='dark') {
  assert.equal(active.style.stroke.tokenId,'color.onPrimary');
 }
}
const split=page.render({id:'split',frame,props:{trackerId:'map',items,selectedId:'B',layout:'split-contents',mode:'light',density:'regular'}}).nodes;
const backdrop=split.find(n=>n.role==='tracker-backdrop'),rows=split.filter(n=>n.role==='tracker-marker');
assert.equal(backdrop.frame.x+backdrop.frame.width,1280);
const listTop=Math.min(...rows.map(n=>n.frame.y)),listBottom=Math.max(...rows.map(n=>n.frame.y+n.frame.height));
assert.ok(Math.abs((listTop+listBottom)/2-360)<2);
const highlight=split.find(n=>n.role==='tracker-selection');
assert.ok(highlight.frame.width/backdrop.frame.width>=0.60&&highlight.frame.width/backdrop.frame.width<=0.80);
assert.ok(!split.some(n=>n.role==='tracker-subtitle'));
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_inverted_selected_rows_invert_the_marker_outline(self):
        result = run_node(r"""
import assert from 'node:assert/strict';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const page=REGISTRY.get('tracker-page');
const items=['A','B','C','D'].map(id=>({id,label:`Section ${id}`}));
const nodes=page.render({id:'split-dark',frame:{x:0,y:0,width:1280,height:720},props:{trackerId:'map',items,selectedId:'B',layout:'split-contents',mode:'dark',density:'regular',selectionTreatment:'inverse'}}).nodes;
const selection=nodes.find(node=>node.role==='tracker-selection');
const marker=nodes.find(node=>node.role==='tracker-marker'&&node.data.sectionId==='B');
const markerLabel=nodes.find(node=>node.role==='tracker-marker-label'&&node.data.sectionId==='B');
assert.equal(selection.style.fill.tokenId,'color.componentPrimary');
assert.equal(selection.data.selectionTreatment,'inverse');
assert.equal(marker.style.fill.tokenId,'color.componentPrimary');
assert.equal(marker.style.stroke.tokenId,'color.onPrimary');
assert.equal(marker.style.lineWidth.tokenId,'line.standard');
assert.equal(markerLabel.style.color.tokenId,'color.onPrimary');
assert.notEqual(marker.style.stroke.tokenId,marker.style.fill.tokenId);
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])

    def test_planner_places_compact_tracker_above_action_title(self):
        result = run_node(r"""
import assert from 'node:assert/strict';
import { planSlide } from './skills/professional-slides/runtime/planner.mjs';
import { compileDeck } from './skills/professional-slides/runtime/core.mjs';
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
const items=['A','B','C'].map(id=>({id,label:`Section ${id}`}));
const planned=planSlide({id:'content',title:'Evidence supports the selected section',tracker:{trackerId:'map',items,selectedId:'B',construction:'compact-label',mode:'light'},items:[{id:'body',job:'develop the evidence',component:'paragraph',props:{text:'The selected evidence advances the governing argument.'}}]});
const slide=compileDeck({slides:[planned.spec]},REGISTRY).slides[0];
const tracker=slide.nodes.find(n=>n.role==='tracker-compact-label'),title=slide.nodes.find(n=>n.role==='action-title');
assert.ok(tracker.frame.y+tracker.frame.height<title.frame.y);
assert.equal(tracker.data.sectionId,'B');
assert.equal(slide.componentInstances.find(n=>n.component==='slide-chrome').variant,'without-line');
assert.equal(planned.decision.tracker.selectedId,'B');
console.log(JSON.stringify({accepted:true}));
""")
        self.assertTrue(result["accepted"])


if __name__ == "__main__":
    unittest.main()
