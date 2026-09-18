"""What looking at the first cold run found that no threshold reported.

The rollout brief produced a deck that passed every plan gate, cleared every
craft bar, and carried 11.25 exhibits per ten pages. Opening the PDF found six
defects anyway, and none of them is a number out of range: a list centred away
from the thing it reads from, a rating column that refused to draw because two
of its twelve rows honestly said "Open", a disc drawn larger than the space
measured for it, a chevron that read as a verdict on France, and a callout box
two and a half times the size of its own sentence.

Each test below is one of those, written so it fails again if the page goes
back to how it looked.
"""
import unittest

from node_probe import run_node


class ListTrackTests(unittest.TestCase):
    """A list centres its leftover only when it owns the track it sits in."""

    def test_a_split_list_lands_both_halves_on_one_top(self):
        # Page 4 of the run: five findings cut into 3 and 2. Each half centred
        # its own leftover, so the two columns started at different heights and
        # the page read as two lists rather than one set of five.
        run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const find=(items,pred)=>{for(const it of items){if(pred(it))return it;const r=it.items?find(it.items,pred):null;if(r)return r;}return null;};
const slide=composeSlide({title:'Five findings',points:[
  'Readiness decides the first wave and only three markets carry full data today',
  'The prize sits behind the longest filings, which no later start recovers',
  'Cost to serve confirms the order rather than contesting it',
  'Two markets stay open and re-enter at the month-13 gate',
  'The committee approves a gate, not a sequence',
]},0);
const a=find(slide.items,i=>i.id==='s01-points-a'), b=find(slide.items,i=>i.id==='s01-points-b');
assert.equal(a.props.centre,false); assert.equal(b.props.centre,false);
// And the renderer honours it: both halves put their first line on one top.
const list=REGISTRY.get('bullet-list');
const top=(props,items)=>list.render({id:'l',frame:{x:0,y:100,width:400,height:360},
  props:{...props,items}}).nodes.filter(n=>n.type==='text').map(n=>n.frame.y).sort((x,y)=>x-y)[0];
assert.equal(top(a.props,a.props.items),top(b.props,b.props.items));
// Left to centre itself, the shorter half starts lower - which is the defect.
const {centre:_drop,...centred}=a.props;
assert.ok(top(centred,b.props.items)>top(centred,a.props.items));
console.log('{}');
''')

    def test_a_list_under_a_kpi_stays_under_it(self):
        # Pages 9 and 11: a kpi with the points reading from it, and the points
        # centred in what the kpi left over - which opened a gap between the
        # number and the first thing said about it.
        run_node('''
import assert from 'node:assert/strict';
import {composeSlide} from './skills/professional-slides/runtime/compose.mjs';
const find=(items,pred)=>{for(const it of items){if(pred(it))return it;const r=it.items?find(it.items,pred):null;if(r)return r;}return null;};
const exhibit={type:'chart.bar',categories:['a','b','c','d'],series:[{name:'s',values:[1,2,3,4]}]};
const points=['The first thing the number says','The second thing the number says'];
const withKpi=composeSlide({title:'T',exhibit,kpi:{value:'$232m',label:'Annual contribution'},points},0);
assert.equal(find(withKpi.items,i=>i.id==='s01-points').props.centre,false);
const withInsight=composeSlide({title:'T',exhibit,insight:'Where cost and prize disagree, readiness settles it.',points},0);
assert.equal(find(withInsight.items,i=>i.id==='s01-points').props.centre,false);
// Alone in the track the list still spreads and centres what is left over.
const alone=composeSlide({title:'T',exhibit,points},0);
const list=find(alone.items,i=>i.id==='s01-points');
assert.equal(list.props.distribute,true); assert.equal(list.props.centre,undefined);
console.log('{}');
''')


class RatingColumnTests(unittest.TestCase):
    """"Open" is not zero, and a column that says so is still a rating."""

    def test_a_rating_column_survives_a_minority_of_honest_unknowns(self):
        # The brief asked for exactly this: ten markets rated on a four-point
        # scale and two with no local data, which had to "stay visible as open
        # rather than being scored as zero". Every cell had to be a scale word,
        # so the column stayed plain text and the ten that were rated lost their
        # scale - the deck's densest table drew no treatment at all.
        run_node('''
import assert from 'node:assert/strict';
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
const markets=['Netherlands','Ireland','Sweden','Poland','Germany','France','Spain','Italy','Portugal','Czechia','Romania','Greece'];
const ratings=['Full','Full','Full','Strong','Strong','Partial','Strong','Partial','Partial','Weak','Open','Open'];
const ex={columns:['Market',{label:'Data readiness',unit:'four-point assessment'},'Cost to serve'],
  rows:markets.map((m,i)=>[m,ratings[i],String(20+i)])};
const out=styleTable(ex);
const cells=out.rows.map(r=>r[1]);
assert.equal(cells.filter(c=>c&&c.type==='harvey').length,10);
// The two unknowns keep the word the author wrote, beside the discs.
assert.deepEqual(cells.slice(10),['Open','Open']);
assert.equal(out.rows[0][1].value,4); assert.equal(out.rows[9][1].value,1);
assert.equal(out.scales.rating.anchors['4'],'Full','the disc prints its anchor word, not "4/4"');
console.log('{}');
''')

    def test_a_column_of_mostly_unknowns_is_not_a_rating(self):
        run_node('''
import assert from 'node:assert/strict';
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
const rows=[['A','Full','1'],['B','Open','2'],['C','Open','3'],['D','N/A','4'],['E','Strong','5'],['F','TBD','6']];
const out=styleTable({columns:['Market',{label:'Data readiness'},'Cost'],rows});
assert.ok(out.rows.every(r=>typeof r[1]==='string'),'four blanks and two ratings is not a scale');
console.log('{}');
''')

    def test_the_disc_is_the_size_the_table_measured_for_it(self):
        # A dense table reserves the small marker; the cell drew the medium one,
        # so on the twelve-row scorecard the disc sat on top of its own word.
        run_node('''
import assert from 'node:assert/strict';
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const words=['Full','Strong','Partial','Weak','Full','Strong','Partial','Weak','Full','Strong','Partial','Weak'];
const ex=styleTable({columns:['Market',{label:'Data readiness'},'Cost to serve'],
  rows:words.map((w,i)=>[`Market ${i+1}`,w,String(20+i)])});
const nodes=REGISTRY.get('table').render({id:'t',frame:{x:0,y:0,width:820,height:400},
  props:{density:'dense',columns:ex.columns,rows:ex.rows,scales:ex.scales}}).nodes;
const discs=nodes.filter(n=>n.type==='ellipse');
assert.ok(discs.length>=12,'a disc per rated row');
const labels=nodes.filter(n=>n.type==='text'&&words.includes(n.text));
assert.ok(labels.length>=12,'every rated cell prints its anchor word, not "3/4"');
for(const label of labels){
  const beside=discs.filter(d=>Math.abs((d.frame.y+d.frame.height/2)-(label.frame.y+label.frame.height/2))<6);
  assert.ok(beside.length,'each word has its disc on the same line');
  for(const disc of beside) assert.ok(disc.frame.x+disc.frame.width<=label.frame.x+0.5,
    'and the disc ends before the word begins');
}
console.log('{}');
''')


class ImplicationGutterTests(unittest.TestCase):
    """At five rows or more the gutter is one device, not a mark on a row."""

    def test_a_long_table_draws_the_gutter_once_down_its_own_column(self):
        # On the twelve-market scorecard the single chevron landed on the
        # France row and read as a verdict on France.
        run_node('''
import assert from 'node:assert/strict';
import {styleTable} from './skills/professional-slides/runtime/compose.mjs';
const rows=Array.from({length:12},(_,i)=>[`Market ${i+1}`,`${i}`,`Wave ${i%3+1}`]);
const long=styleTable({columns:['Market','Prize',{label:'Decision',implication:true}],rows});
const at=long.columns.findIndex(c=>c.type==='implication');
assert.equal(long.columns[at].divider,true);
assert.ok(long.rows.every(r=>r[at].draw===false),'no row carries its own chevron');
// Four rows or fewer, the eye follows each line across and every row keeps one.
const short=styleTable({columns:['Market','Prize',{label:'Decision',implication:true}],rows:rows.slice(0,4)});
const shortAt=short.columns.findIndex(c=>c.type==='implication');
assert.equal(short.columns[shortAt].divider,undefined);
assert.ok(short.rows.every(r=>r[shortAt].draw===undefined));
console.log('{}');
''')

    def test_the_rule_spans_the_evidence_and_stops_above_a_total(self):
        # Drawn to the foot of the table the hairline crossed the dark total
        # band, and the disc came to rest one row low.
        run_node('''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const columns=['Wave',{label:'',type:'implication',width:{px:52},divider:true},'Decision'];
const blank={type:'implication',relation:'implies',draw:false};
const body=Array.from({length:6},(_,i)=>[`Wave ${i+1}`,blank,'Approve today']);
const render=rows=>REGISTRY.get('table').render({id:'t',frame:{x:0,y:0,width:900,height:400},props:{columns,rows}}).nodes
  .filter(n=>n.role==='table-implication');
const dashed=nodes=>nodes.filter(n=>n.type==='line'&&n.style.dash==='dash');
const span=rules=>[Math.min(...rules.map(r=>r.frame.y)),Math.max(...rules.map(r=>r.frame.y+r.frame.height))];
const plain=render(body), rules=dashed(plain), disc=plain.find(n=>n.type==='ellipse');
assert.equal(plain.filter(n=>n.type==='ellipse').length,1,'one disc for the whole table');
assert.equal(rules.length,2,'the rule runs above and below the disc');
const [top,foot]=span(rules), centre=disc.frame.y+disc.frame.height/2;
assert.ok(Math.abs((top+foot)/2-centre)<1,'the disc is centred on what the rule spans');
// Add a total and the span shortens: a total is the same rows added up.
const withTotal=render([...body,{cells:['Total',blank,'26'],style:'total'}]);
const [,footWithTotal]=span(dashed(withTotal));
assert.ok(Math.abs(footWithTotal-foot)<1,'the total row is outside the rule');
const discWithTotal=withTotal.find(n=>n.type==='ellipse');
assert.ok(Math.abs((discWithTotal.frame.y+discWithTotal.frame.height/2)-centre)<1,'and does not move the disc');
console.log('{}');
''')


class CalloutSizeTests(unittest.TestCase):
    """A callout is the size of what it says."""

    def test_a_short_note_gets_a_box_its_own_size(self):
        # "$46m, 11-month filing" arrived in a 260x56 rectangle - two and a half
        # times its own text, with the leader dropping out of the empty half.
        run_node('''
import assert from 'node:assert/strict';
import {REGISTRY} from './skills/professional-slides/runtime/registry.mjs';
const chart=REGISTRY.get('chart.column');
const box=text=>{
  const nodes=chart.render({id:'bars',frame:{x:40,y:40,width:760,height:420},
    props:{...chart.sample,dataLabels:false,referenceLines:[],annotations:[{category:'2026',text}]}}).nodes;
  return nodes.find(n=>n.role==='annotation-surface').frame;
};
const LONG='The only route to a month-12 launch runs through a month-one filing';
const short=box('$46m'), medium=box('$46m, 11-month filing'), long=box(LONG);
assert.ok(short.width<medium.width,'the box follows the text');
assert.ok(medium.width<long.width);
assert.ok(long.width<=260,'260 is the width it wraps at, and the widest it gets');
assert.ok(short.height<long.height,'and two lines are taller than one');
assert.ok(short.height>=32,'while a two-word note is still a box, not a stamp');
assert.ok(medium.width<200,'the defect: a one-line note in a 260px rectangle');
// The foot stays where the leader expects it, whatever the box's height.
assert.ok(Math.abs((short.y+short.height)-(long.y+long.height))<1);
console.log('{}');
''')


if __name__ == "__main__":
    unittest.main()
