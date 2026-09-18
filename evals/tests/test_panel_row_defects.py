"""Three defects found by reading a built fifty-page deck at full size.

None of them is a number out of range and none of them failed a gate. A page
set two small tables side by side, "Batman: order" against "Joker: chaos", and
drew the left one on a grey ground and the right one on the canvas - so one
side read as the answer and the other as the footnote, for no reason the page
gave. The ground also padded its contents inward, which the plain half did not,
so the two tables' header rows landed sixteen pixels apart and the row stopped
reading across at all.

On another page a table arrived under a horizontal rule with nothing above the
rule: the row rule gives a panel whose neighbour is named a blank band of the
same height, and the blank band was inking its rule.

And two pages closed with three sentences in a row, separated as three columns,
that answered no shared question - "the series ran from 1992 to 1995" beside
"interpretation: the format offers repeated encounters". Three columns claim
three parallel answers; three sentences that happen to number three are a list.

Each test below is one of those, written so it fails again if the page goes
back to how it looked.
"""
import unittest

from node_probe import run_node


class PanelRowTreatmentTests(unittest.TestCase):
    """Panels in a row are drawn the same way and start on the same line."""

    def test_two_panels_in_a_row_are_not_tinted_by_alternation(self):
        # The composed page: two captioned tables, which the chooser sends to
        # `split-tone`, whose left half carried `treatment: "muted"` because it
        # was the left half - an alternation, not a decision about the content.
        run_node('''
import assert from 'node:assert/strict';
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const panel=(heading,caption,rows)=>({type:'table',heading,caption,columns:['Trait','Reading'],rows});
const spec={schema:'professional-slides.deck/v3',id:'order-and-chaos',slides:[{
  title:'Order and chaos are one page read twice',
  exhibits:[
    panel('Batman: order','Order is a method: the same answer every time.',
      [['Method','Repeatable'],['Motive','Fixed'],['Outcome','Contained']]),
    panel('Joker: chaos','Chaos is a method too: a different answer each time.',
      [['Method','Improvised'],['Motive','Shifting'],['Outcome','Open']]),
  ]}]};
const nodes=planDeck(toDeckPlan(spec)).deck.slides[0].nodes;
assert.equal(nodes.filter(n=>n.role==='section-surface').length,0,'neither half is singled out');
const headings=nodes.filter(n=>n.role==='section-heading');
assert.deepEqual(headings.map(n=>n.text),['Batman: order','Joker: chaos']);
assert.equal(headings[0].frame.y,headings[1].frame.y,'the two headings sit on one line');
const tops=nodes.filter(n=>n.role==='table-header-text'&&n.text==='Trait').map(n=>n.frame.y);
assert.equal(tops.length,2);
assert.equal(tops[0],tops[1],'and the tables under them start on one top');
console.log('{}');
''')

    def test_a_row_falls_back_to_one_ground_unless_every_panel_names_its_own(self):
        # A ground on one panel and nothing on its neighbour is the alternation;
        # a ground on each is the page saying which side it means.
        run_node('''
import assert from 'node:assert/strict';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const panel=(id,heading,treatment)=>({id,...(treatment?{treatment}:{}),heading,
  size:{width:{fr:1},height:'fill'},
  items:[{id:`${id}-table`,component:'table',props:{columns:['Trait','Reading'],
    rows:[['Method','Repeatable'],['Motive','Fixed']]}}]});
const row=(a,b)=>planDeck({id:'d',slides:[{id:'p',title:'Order and chaos are one page read twice',
  items:[{id:'row',layout:'flow.row',items:[a,b]}]}]}).deck.slides[0].nodes;
const tops=(nodes)=>nodes.filter(n=>n.role==='table-header-text'&&n.text==='Trait').map(n=>n.frame.y);
// One half names a ground, the other takes the default: the difference is an
// alternation and the row falls back to the open ground.
const drifted=row(panel('a','Batman: order','muted'),panel('b','Joker: chaos'));
assert.equal(drifted.filter(n=>n.role==='section-surface').length,0);
assert.equal(...tops(drifted).slice(0,2));
// Both halves name one: the page meant it, and the grounds hold.
const decided=row(panel('a','Batman: order','muted'),panel('b','Joker: chaos','open'));
assert.equal(decided.filter(n=>n.role==='section-surface').length,1,'the named ground is drawn');
const [left,right]=tops(decided);
assert.equal(left,right,'and the surface still starts its table where its peer starts one');
console.log('{}');
''')

    def test_a_ground_with_a_wrapped_heading_keeps_the_row_on_one_top(self):
        # The surface pads inward and inks no rule of its own, so its contents
        # used to start a baseline unit above its neighbour's - and a heading
        # that wrapped beside it opened the gap to a whole line.
        run_node('''
import assert from 'node:assert/strict';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const panel=(id,heading,treatment)=>({id,treatment,heading,size:{width:{fr:1},height:'fill'},
  items:[{id:`${id}-table`,component:'table',props:{columns:['Trait','Reading'],
    rows:[['Method','Repeatable'],['Motive','Fixed']]}}]});
const nodes=planDeck({id:'d',slides:[{id:'p',title:'Order and chaos are one page read twice',
  items:[{id:'row',layout:'flow.row',items:[
    panel('a','Batman keeps order by method and by the same answer every time','muted'),
    panel('b','Joker','open')]}]}]}).deck.slides[0].nodes;
const tops=nodes.filter(n=>n.role==='table-header-text'&&n.text==='Trait').map(n=>n.frame.y);
assert.equal(tops.length,2);
assert.equal(tops[0],tops[1],'a wrapped heading raises the band for both panels, not one');
console.log('{}');
''')

    def test_the_commentary_rail_is_not_a_peer_of_the_exhibit(self):
        # `pointsTone` is the page asking for a grey commentary column. It is
        # read down, not across, so the row rule leaves its ground alone.
        run_node('''
import assert from 'node:assert/strict';
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const spec={schema:'professional-slides.deck/v3',id:'rail',slides:[{
  title:'The rail keeps the ground the page asked for',
  exhibit:{type:'chart.column',heading:'Appearances',unit:'count',
    categories:['1992','1993','1994','1995'],series:[{name:'Episodes',values:[28,20,10,5]}]},
  pointsTone:'muted',
  points:['Order is the method','Chaos is also a method']}]};
const nodes=planDeck(toDeckPlan(spec)).deck.slides[0].nodes;
const surfaces=nodes.filter(n=>n.role==='section-surface');
assert.equal(surfaces.length,1,'the rail keeps its grey ground');
assert.ok(surfaces[0].frame.x>640,'and it is the right-hand column, not the exhibit');
console.log('{}');
''')


class BlankHeadingTests(unittest.TestCase):
    """A rule under nothing is a rule under nothing."""

    def test_a_panel_with_no_heading_draws_no_rule_and_keeps_its_band(self):
        run_node('''
import assert from 'node:assert/strict';
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const table=(rows)=>({type:'table',columns:['Trait','Reading'],rows});
const spec={schema:'professional-slides.deck/v3',id:'unheaded',slides:[{
  title:'Two tables read across the page',arrange:'row',
  exhibits:[table([['Method','Repeatable'],['Motive','Fixed']]),
            table([['Method','Improvised'],['Motive','Shifting']])]}]};
const nodes=planDeck(toDeckPlan(spec)).deck.slides[0].nodes;
assert.equal(nodes.filter(n=>n.role==='section-heading').length,0,'nothing is printed');
assert.equal(nodes.filter(n=>n.role==='section-heading-rule').length,0,'so nothing is ruled');
const tops=nodes.filter(n=>n.role==='table-header-text'&&n.text==='Trait').map(n=>n.frame.y);
assert.equal(tops[0],tops[1],'and the band that exists for the row rule is still reserved');
console.log('{}');
''')

    def test_a_blank_band_beside_a_named_one_still_lines_the_two_up(self):
        # The blank band is the row rule's doing, so it must keep its height:
        # drawing nothing is not the same as taking no space.
        run_node('''
import assert from 'node:assert/strict';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const panel=(id,heading)=>({id,heading,size:{width:{fr:1},height:'fill'},
  items:[{id:`${id}-table`,component:'table',props:{columns:['Trait','Reading'],
    rows:[['Method','Repeatable'],['Motive','Fixed']]}}]});
const nodes=planDeck({id:'d',slides:[{id:'p',title:'One panel is named and one is not',
  items:[{id:'row',layout:'flow.row',items:[panel('a','Batman: order'),panel('b',' ')]}]}]})
  .deck.slides[0].nodes;
assert.deepEqual(nodes.filter(n=>n.role==='section-heading').map(n=>n.text),['Batman: order']);
assert.equal(nodes.filter(n=>n.role==='section-heading-rule').length,1,'one heading, one rule');
const tops=nodes.filter(n=>n.role==='table-header-text'&&n.text==='Trait').map(n=>n.frame.y);
assert.equal(tops.length,2);
assert.equal(tops[0],tops[1],'the unnamed panel still starts where the named one does');
console.log('{}');
''')


class ProseRowTests(unittest.TestCase):
    """Three columns are three parallel answers, or they are a list."""

    def test_sentences_that_are_not_parallel_stack_under_the_exhibit(self):
        # The page's close: three sentences of different kinds - a fact, an
        # example, an interpretation - set as three columns under the chart.
        run_node('''
import assert from 'node:assert/strict';
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const spec={schema:'professional-slides.deck/v3',id:'series',slides:[{
  title:'The animated series is where the pairing was first drawn',layout:'exhibit-top',
  exhibit:{type:'chart.column',heading:'Appearances',unit:'count',
    categories:['1992','1993','1994','1995'],series:[{name:'Episodes',values:[28,20,10,5]}]},
  points:[
    'Batman: The Animated Series ran from 1992 to 1995 in the catalogue',
    'Harley\\u2019s documented introduction offers a concrete example of a character created for television and carried back into print',
    'Interpretation: the series format offers repeated encounters with a cast, which is where a supporting character can be developed',
  ]}]};
const paragraphs=planDeck(toDeckPlan(spec)).deck.slides[0].nodes.filter(n=>n.role==='paragraph');
assert.equal(paragraphs.length,3);
assert.equal(new Set(paragraphs.map(n=>n.frame.x)).size,1,'one column, not three');
assert.equal(new Set(paragraphs.map(n=>n.frame.y)).size,3,'the three read down the page');
const tops=paragraphs.map(n=>n.frame.y);
assert.deepEqual(tops,[...tops].sort((a,b)=>a-b),'in the order they were written');
console.log('{}');
''')

    def test_parallel_columns_still_read_across(self):
        # Short phrases of one length, and led points whose leads become the
        # columns' headings: both are three parallel answers to one question.
        run_node('''
import assert from 'node:assert/strict';
import {toDeckPlan} from './skills/professional-slides/runtime/compose.mjs';
import {planDeck} from './skills/professional-slides/runtime/planner.mjs';
const exhibit={type:'chart.column',heading:'Appearances',unit:'count',
  categories:['1992','1993','1994','1995'],series:[{name:'Episodes',values:[28,20,10,5]}]};
const row=(points)=>{
  const spec={schema:'professional-slides.deck/v3',id:'series',slides:[{
    title:'Three readings of one run',layout:'exhibit-top',exhibit,points}]};
  return planDeck(toDeckPlan(spec)).deck.slides[0].nodes.filter(n=>n.role==='paragraph');
};
const fragments=row(['Episodes fell every year','The first year carries the run','The last year is a coda']);
assert.equal(fragments.length,3);
assert.equal(new Set(fragments.map(n=>n.frame.x)).size,3,'three columns');
assert.equal(new Set(fragments.map(n=>n.frame.y)).size,1,'on one line');
const led=row([
  {lead:'The peak is the first year',text:'Twenty-eight episodes ran before the format settled into its later shape'},
  {lead:'The fall is steady',text:'Each year afterwards carries roughly half the episodes of the year before it'},
  {lead:'The coda is short',text:'Five episodes close the run, which is a season in name rather than in length'}]);
assert.equal(new Set(led.map(n=>n.frame.x)).size,3,'a lead on every column is the shared structure');
assert.equal(new Set(led.map(n=>n.frame.y)).size,1);
// A lead on some and not others is not a structure the three of them share.
const mixed=row([
  {lead:'The peak is the first year',text:'Twenty-eight episodes ran before the format settled'},
  'Each year afterwards carries roughly half the episodes of the year before it',
  'Five episodes close the run, which is a season in name rather than in length']);
assert.equal(new Set(mixed.map(n=>n.frame.x)).size,1,'mixed construction stacks');
console.log('{}');
''')


if __name__ == "__main__":
    unittest.main()
