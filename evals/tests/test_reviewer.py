"""The reviewer's packet (runtime/reviewer.mjs, build-bars.mjs): what the deck is made of, beside the question asked.

Every other check in the skill is a number. The visual review is a look, and
it is the only thing that catches a deck which clears every number and still
reads as dry - so the reviewer is handed what the deck is made of, and the
prompt asks the questions that look needs.
"""
import unittest

from node_probe import run_node


class DesignStatisticsTests(unittest.TestCase):
    def test_the_packet_carries_what_the_deck_is_made_of(self):
        """A generated 50-page deck cleared every number and still read as dry; the review is handed its make-up."""
        run_node(r'''
import assert from 'node:assert/strict';
import {designStatistics, CODES, reviewPrompt} from './skills/professional-slides/runtime/reviewer.mjs';
const page=(components,roles)=>({id:'s',nodes:[{role:'action-title',type:'text',text:'A finding'},
  ...roles.map(r=>({role:r,type:'rect'}))],componentInstances:['slide-chrome',...components].map(c=>({component:c}))});
const scene={slides:[
  page(['table'],['table-rating-track','table-cell']),
  page(['table'],['table-cell']),
  page(['chart.column'],['chart-bracket']),
  page(['chart.bar'],['chart-mark']),
]};
const s=designStatistics(scene);
assert.equal(s.contentPages,4);
assert.equal(s.tables,2); assert.equal(s.tablesTreated,0.5);
assert.equal(s.charts,2); assert.equal(s.chartsAnnotated,0.5);
assert.equal(s.distinctExhibits,3);
assert.equal(s.exhibitVarietyPerTen,7.5);
assert.ok(s.drawingsPerPage>0,'drawn elements are counted, not just chart marks');
assert.ok(s.reference.drawingsPerPage===32,'and set beside what a published page carries');
assert.ok(s.reference.tablesTreated===0.89&&s.reference.chartsAnnotated===0.63,'measured, not guessed');
// A slide with no action title is chrome, not a page to judge.
assert.equal(designStatistics({slides:[{id:'c',nodes:[{role:'cover-title',type:'text'}],componentInstances:[]}]}).contentPages,0);

// The beautification codes exist and the prompt actually asks the questions.
for (const code of ['NO_VISUAL_ANCHOR','UNANNOTATED_PLOT','TABLE_MONOTONY','MIXED_GRAMMAR','DECORATION','NARROW_REPERTOIRE'])
  assert.ok(CODES[code],`${code} is a reviewable code`);
const prompt=reviewPrompt({statistics:s,titles:[],slides:[],codes:CODES,schema:{},montage:'m'});
assert.match(prompt,/VISUAL REVIEW/);
assert.match(prompt,/NARROW_REPERTOIRE/);
assert.ok(prompt.includes('"exhibitVarietyPerTen": 7.5'),'candidate diagnostics reach the reviewer');
assert.ok(!prompt.includes('"reference"') && !prompt.includes('7.1 to 8.3'),'historical aggregates are not presented as reference targets');
assert.match(prompt,/Read the deck through its spreads/);
assert.match(prompt,/If the user supplied reference decks/);assert.match(prompt,/never search the machine/);
assert.match(prompt,/peer status summaries/);
// The standard is embedded, condensed: a reviewer in a clean staging directory
// reads no skill file, and is not sent to read 15-25K tokens of guidance.
assert.match(prompt,/THE STANDARD\. You need no other file/);
assert.match(prompt,/is not rated above 7/);
assert.ok(!/references\/[a-z-]+\.md/.test(prompt),'no reading list');
assert.match(prompt,/most deletable page/);
console.log(JSON.stringify({ok:true}));
''')


if __name__ == "__main__":
    unittest.main()
