"""Filling the page without stretching it, and two runtime placement bugs.

The Emirates deck showed a composer that gave an exhibit with a natural height
the whole of its region and left the difference as a band in the middle of the
page: 180px between a wave roadmap and its commentary, three card boxes with
their copy in the top half, a findings matrix in compact type over a 50px gap.
Components that can grow legibly now say how far (`measureCeiling`), use the
room as rhythm - a type step and row padding for a table, item spacing for a
roadmap, gaps and centred copy for a card - and the column keeps whatever is
left as one bottom margin, with the commentary against its exhibit.

Also: a gantt bar's label struck through by the Today line, and a status-pill
column starved by column sizing until the author pinned it at 150px.
"""
import unittest

from node_probe import run_node


PAGE = r"""
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const build=slide=>planDeck(toDeckPlan({schema:'professional-slides.deck/v3',id:'fill',tracker:false,slides:[{id:'s',...slide}]})).deck.slides[0];
const bottom=ns=>Math.max(...ns.map(n=>n.frame.y+n.frame.height));
const top=ns=>Math.min(...ns.map(n=>n.frame.y));
const inst=(page,id)=>page.componentInstances.find(c=>c.id===id);
const mine=(page,id)=>page.nodes.filter(n=>String(n.data?.componentInstance||'').endsWith(id)&&n.frame.height>0);
"""

POINTS = """[{lead:'Orders are not aircraft',text:'Firm orders, exercised options and deliveries are different populations; adding every headline would overstate the fleet.'},
 {lead:'An execution gap',text:'The design is credible, but the gap to the incumbent is measured in deliveries rather than in orders.'}]"""


class ExhibitTopFillTests(unittest.TestCase):
    def test_roadmap_takes_rhythm_and_the_commentary_follows_it(self):
        result = run_node(PAGE + r"""
const page=build({title:'Orders can build a competing hub if they are delivered',layout:'exhibit-top',pointsHeading:false,
 exhibit:{type:'roadmap',variant:'wave-columns',items:[
  {heading:'Orders',range:'Oct 2024 to Jun 2025',activities:['60 A321neo firm with Airbus','25 A350-1000 firm'],deliverables:['A fleet on paper']},
  {heading:'Launch',range:'Jun 2026',activities:['Commercial service begins','Three 787-9 delivered'],deliverables:['Five destinations on sale']},
  {heading:'Build-out',range:'Jul to Sep 2026',activities:['Six 787-9 delivered','Six more A350-1000','28 options exercised'],deliverables:['14 outstations listed']}]},
 points:""" + POINTS + r"""});
const roadmap=inst(page,'s-exhibit'), below=inst(page,'s-below');
const drawn=mine(page,'s-exhibit');
console.log(JSON.stringify({roadmap:roadmap.frame,below:below.frame,inkBottom:bottom(drawn),inkTop:top(drawn),body:page.contentFrame,
 lists:drawn.filter(n=>/roadmap-(activities|deliverables)/.test(n.role)).map(n=>n.frame),rail:drawn.find(n=>n.role==='roadmap-marker').frame}));
""")
        roadmap, below, body = result['roadmap'], result['below'], result['body']
        # The roadmap draws to the foot of its frame: no blank band inside it.
        self.assertAlmostEqual(result['inkBottom'], roadmap['y'] + roadmap['height'], delta=10)
        # The commentary sits against it (one flow gap), not at the page's foot
        # with the leftover between them.
        self.assertLessEqual(below['y'] - (roadmap['y'] + roadmap['height']), 17)
        # The slack is the bottom margin, and it is one margin, not the old
        # 180px band: the stages took rhythm first.
        margin = body['y'] + body['height'] - (below['y'] + below['height'])
        self.assertGreater(margin, 0)
        self.assertLess(margin, 150)
        # No gap inside the roadmap reaches a seventh of the body (SCENE_VOID).
        lists = sorted(result['lists'], key=lambda f: f['y'])
        activities_bottom = max(f['y'] + f['height'] for f in lists if f['y'] < lists[-1]['y'] - 1)
        self.assertLess(lists[-1]['y'] - activities_bottom, body['height'] / 7)
        self.assertLess(lists[0]['y'] - (result['rail']['y'] + result['rail']['height']), body['height'] / 7)

    def test_cards_centre_their_copy_and_hold_the_commentary_against_them(self):
        result = run_node(PAGE + r"""
const card=(title,value,text,icon)=>({title,value,text,icon});
const page=build({title:'Two new carriers widen the competition in the region',layout:'exhibit-top',pointsHeading:false,
 exhibit:{type:'cards',tone:'outline',items:[card('Dammam carrier','3 routes','First flight on 20 September, with two more cities.','flag'),
  card('flynas','15.8m','Passengers in 2025 on 71 aircraft.','growth'),card('Riyadh Air','14 cities','Listed outstations in September.','globe')]},
 points:""" + POINTS + r"""});
const cards=inst(page,'s-exhibit'), below=inst(page,'s-below');
const ns=mine(page,'s-exhibit');
const surface=ns.find(n=>n.role==='card-surface').frame;
const copy=ns.filter(n=>n.frame.x>=surface.x-0.5&&n.frame.x+n.frame.width<=surface.x+surface.width+0.5&&n.role!=='card-surface');
console.log(JSON.stringify({cards:cards.frame,below:below.frame,surface,copyTop:top(copy),copyBottom:bottom(copy),body:page.contentFrame}));
""")
        s = result['surface']
        above, under = result['copyTop'] - s['y'], s['y'] + s['height'] - result['copyBottom']
        # The copy sits in the middle of its box, not in the top half of it.
        self.assertAlmostEqual(above, under, delta=6)
        # The box ends where the frame does and the commentary follows it.
        self.assertAlmostEqual(s['y'] + s['height'], result['cards']['y'] + result['cards']['height'], delta=1)
        self.assertLessEqual(result['below']['y'] - (result['cards']['y'] + result['cards']['height']), 17)


class TableFillTests(unittest.TestCase):
    MATRIX = r"""
const rows=[['Network and finance investor',['11.4m more passengers on the matched year','AED19.7bn airline profit after tax','DXB first in the region'],'Emirates'],
 ['Premium-service traveller',['Skytrax second globally, first in region','Business-class and seat awards','More than 160 summer gateways'],'Qatar Airways, subject to the itinerary and fare'],
 ['Price-sensitive regional traveller',['Air Arabia 20.8% margin','No fare sample available here','A composite score would imply false precision'],'Depends on fare and nonstop access'],
 ['Long-run strategist',['Saudi target of 330m passengers by 2030','Riyadh Air firm orders and 787s arriving','DWC phase one within the decade'],'Emirates today; re-test at each milestone']];
const matrix=extra=>build({title:'The preferred airline changes with the decision being made',shape:'findings-matrix',columns:['Decision maker','Evidence on this record','Preferred'],
 rows:rows.map(([label,points,verdict])=>({label,cells:[points,verdict]})),soWhat:'Emirates is the most complete system on this evidence; the best ticket still depends on the journey.',...extra});
const read=page=>{const t=inst(page,'s-exhibit'),w=inst(page,'s-sowhat');const cells=mine(page,'s-exhibit').filter(n=>n.role==='table-cell-text'||n.role==='table-bullet-text'||String(n.role).startsWith('table-'));
 return {table:t.frame,sowhat:w.frame,body:page.contentFrame,size:mine(page,'s-exhibit').find(n=>n.type==='text'&&n.role!=='table-header-text')?.style.fontSize.tokenId,ink:bottom(cells)};};
"""

    def test_a_composer_density_steps_up_and_the_takeaway_follows_the_table(self):
        result = run_node(PAGE + self.MATRIX + r"""
console.log(JSON.stringify(read(matrix({}))));
""")
        # A findings matrix defaults to compact; handed a page with room it is
        # set a type step up rather than padded out.
        self.assertEqual(result['size'], 'type.body')
        # The table ends where it draws and the takeaway sits under it; the
        # slack is under the takeaway.
        table, sowhat, body = result['table'], result['sowhat'], result['body']
        self.assertLessEqual(sowhat['y'] - (table['y'] + table['height']), 17)
        self.assertGreaterEqual(body['y'] + body['height'] - (sowhat['y'] + sowhat['height']), 0)

    def test_an_authored_density_and_a_short_frame_keep_their_step(self):
        result = run_node(r"""
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const table=REGISTRY.get('table');
const props={columns:['Case','Evidence'],rows:[['A','One line of evidence'],['B','Another line of evidence'],['C','A third line']],density:'compact',fillHeight:true};
const size=(extra,height)=>table.render({id:'t',frame:{x:72,y:162,width:1136,height},props:{...props,...extra}}).nodes.find(n=>n.role==='table-cell-text').style.fontSize.tokenId;
const natural=h=>table.measureContent({frame:{x:72,y:162,width:1136,height:h},props:{...props,density:'body',fillHeight:false}}).height;
const ceiling=table.measureCeiling({frame:{x:72,y:162,width:1136,height:500},props:{...props,typeStep:true}});
console.log(JSON.stringify({authored:size({},500),stepped:size({typeStep:true},500),tight:size({typeStep:true},natural(Infinity)-1),ceiling,body:natural(Infinity)}));
""")
        # Without `typeStep` (an author's density) the table keeps compact type.
        self.assertEqual(result['authored'], 'type.compact')
        self.assertEqual(result['stepped'], 'type.body')
        # A frame that cannot hold the lighter step keeps the asked-for one.
        self.assertEqual(result['tight'], 'type.compact')
        # The ceiling is the stepped table plus its capped row growth: more
        # than its natural height, far less than the frame.
        self.assertGreater(result['ceiling'], result['body'])
        self.assertLess(result['ceiling'], 500)


class CeilingLayoutTests(unittest.TestCase):
    def test_a_column_holds_a_table_to_its_ceiling_but_row_peers_keep_the_height(self):
        result = run_node(r"""
import {compileDeck,component,flow,section,token} from './skills/professional-slides/runtime/core.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const table=id=>component({id,component:'table',props:{columns:['Case','Value'],rows:[['A','10'],['B','20']],fillHeight:true},size:{width:{fr:1},height:'fill'}});
const note=id=>component({id,component:'paragraph',props:{text:'The takeaway read off the table above it.'},size:{width:{fr:1},height:'hug'}});
const column=(id)=>flow({id,direction:'column',leftover:'distribute',children:[table(`${id}-t`),note(`${id}-n`)]});
const frame={x:72,y:162,width:1136,height:506};
const page=compileDeck({slides:[{id:'c',frame,composition:column('col')}]},REGISTRY).slides[0];
const paired=section({id:'pair',composition:flow({id:'pair-row',direction:'row',children:[
  section({id:'l',composition:flow({id:'l-col',direction:'column',children:[table('l-t'),note('l-n')]}),size:{width:{fr:1},height:'fill'}}),
  section({id:'r',composition:flow({id:'r-col',direction:'column',children:[component({id:'r-c',component:'chart.column',props:{categories:['A','B'],series:[{name:'Value',values:[10,20]}]},size:{width:{fr:1},height:'fill'}}),note('r-n')]}),size:{width:{fr:1},height:'fill'}})]}),size:{width:{fr:1},height:'fill'}});
const peers=compileDeck({slides:[{id:'p',frame,composition:flow({id:'root',direction:'column',children:[paired]})}]},REGISTRY).slides[0];
const f=(deck,id)=>deck.componentInstances.find(c=>c.id===id).frame;
console.log(JSON.stringify({table:f(page,'col-t'),note:f(page,'col-n'),left:f(peers,'l-n'),right:f(peers,'r-n'),peerTable:f(peers,'l-t')}));
""")
        table, note = result['table'], result['note']
        # The table stops at its ceiling and the takeaway follows it, even in a
        # `distribute` column: ceiling slack is the bottom margin, not a gap.
        self.assertLess(table['height'], 506 - note['height'] - 16 - 40)
        self.assertAlmostEqual(note['y'], table['y'] + table['height'] + 16, delta=1)
        # Peers in a row - a table beside a chart that fills whatever it gets -
        # keep every pixel, so the notes under them stay level.
        self.assertAlmostEqual(result['left']['y'], result['right']['y'], delta=0.5)
        self.assertGreater(result['peerTable']['height'], table['height'])


class GanttBarLabelTests(unittest.TestCase):
    def test_a_bar_label_never_sits_under_the_today_line_or_a_milestone(self):
        result = run_node(r"""
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const props={periods:['2019','2020','2021','2022','2023','2024','2025','2026','2027','2028','2029','2030'],today:7.7,groups:[
 {name:'Boeing 777-9',rows:[{label:'Original first-delivery aim',from:0,to:1,milestones:[{at:1,label:'2020 aim missed'}]},
  {label:'Certification and first delivery',from:1,to:8,text:'Testing about 50% complete by July 2026',milestones:[{at:8,label:'2027 aim'}],tone:'accent'}]},
 {name:'Emirates fleet',rows:[{label:'270 777X on order',from:7,to:10,text:'None in service'},{label:'Bridge: A350s and retrofits',from:6,to:10},
  {label:'Review in March 2030 if no 777X flies',from:10,to:11}]}]};
const nodes=REGISTRY.get('gantt').render({id:'g',frame:{x:72,y:190,width:747,height:430},props}).nodes;
const today=nodes.find(n=>n.role==='gantt-today');
const labels=nodes.filter(n=>n.role==='gantt-bar-label').map(n=>{const w=n.data.textLayout.width;const x=n.style.align==='right'?n.frame.x+n.frame.width-w:n.frame.x;return {text:n.text,x,right:x+w,row:n.data.row,placement:n.data.placement};});
const marks=nodes.filter(n=>n.role==='gantt-milestone'||n.role==='gantt-milestone-label').map(n=>{const w=n.data.textLayout?.width??n.frame.width;const x=n.style.align==='right'?n.frame.x+n.frame.width-w:n.frame.x;return {row:n.data.row,x,right:x+w};});
const bars=nodes.filter(n=>n.role==='gantt-bar').map(n=>({row:n.data.row,x:n.frame.x,right:n.frame.x+n.frame.width}));
console.log(JSON.stringify({today:today.data.x1,labels,marks,bars}));
""")
        today = result['today']
        by_text = {l['text']: l for l in result['labels']}
        self.assertEqual(set(by_text), {'Testing about 50% complete by July 2026', 'None in service'})
        for label in result['labels']:
            # Clear of the Today line ...
            self.assertFalse(label['x'] - 1 < today < label['right'] + 1, label)
            # ... and of every milestone mark and label on its row.
            for mark in (m for m in result['marks'] if m['row'] == label['row']):
                self.assertTrue(label['right'] <= mark['x'] + 0.5 or label['x'] >= mark['right'] - 0.5, (label, mark))
        # "None in service" cannot fit either side of the line inside its short
        # bar, so it is set beside the bar rather than struck through.
        none = by_text['None in service']
        bar = next(b for b in result['bars'] if b['row'] == none['row'])
        self.assertNotEqual(none['placement'], 'inside')
        self.assertTrue(none['right'] <= bar['x'] or none['x'] >= bar['right'])
        # The long label still fits inside its bar before the line.
        self.assertEqual(by_text['Testing about 50% complete by July 2026']['placement'], 'inside')


class StatusPillColumnTests(unittest.TestCase):
    def test_a_status_column_reserves_its_pill_before_sharing_the_width(self):
        result = run_node(r"""
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const ex={columns:['Check and next reading','Reverses the finding if','Reading today',{label:'Status',type:'rag'}],rows:[
 ['Traffic, May 2027','The passenger gap on the same March year is zero or negative','+11.4m in FY2025-26; Qatar fell 3%','on-track'],
 ['Economics, May 2028','Airline margin after tax is below 10%, an analyst threshold, in both FY27 and FY28','15.0% in FY2025-26, up from 14.9%','on-track'],
 ['Connectivity, OAG 2027','A Gulf hub ranks ahead of DXB, which then calls for airline-itinerary analysis','DXB first in region, 31st globally','on-track'],
 ['Fleet, March 2030','No 777X is in service; reassess growth against A350 and 787 deliveries and reopen the overall judgment','Certification about halfway; aim 2027','at-risk']],treatment:'dimensions'};
const props={...styleTable(ex),density:'body',fillHeight:true};
const nodes=REGISTRY.get('table').render({id:'t',frame:{x:72,y:162,width:1136,height:506},props}).nodes;
const pills=nodes.filter(n=>n.role==='table-status-pill').map(n=>n.frame);
console.log(JSON.stringify({weights:props.columns.map(c=>c.width),pills}));
""")
        # The composer's weight for the status column is still its word width
        # (84 against 444): the table, not the author, reserves the pill.
        self.assertLess(result['weights'][3], 100)
        self.assertEqual(len(result['pills']), 4)
        for pill in result['pills']:
            self.assertLessEqual(pill['x'] + pill['width'], 72 + 1136 + 0.5)


if __name__ == '__main__':
    unittest.main()
