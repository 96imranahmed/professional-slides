"""Where a column's unclaimed height goes.

A list beside an exhibit hugged the top of its column over an empty foot; spread
from edge to edge instead, three short points stood a hundred pixels apart down
a column and read as labels adrift in it. A list is as tall as its points, and
the column it sits in opens the gaps between its blocks evenly, as far as the
page's loosest (`space.loose`), then sets them as one group in the middle of
the column, with what height is left split above and below.
"""
import unittest

from node_probe import run_node


class FreeSpaceTests(unittest.TestCase):
    def test_points_beside_an_exhibit_sit_in_the_middle_of_their_column(self):
        result = run_node('''
import { toDeckPlan } from './evals/support/compose.mjs';
import { planDeck } from './skills/professional-slides/runtime/planner.mjs';
const points = ['Answers in about 150 ms', 'Top of the voice benchmark', 'Built for contact-center scale'].map((lead) => ({ lead, text: 'A sentence of explanation that runs to a second line in a narrow side column beside the chart.' }));
const { deck } = planDeck(toDeckPlan({ schema: 'professional-slides.deck/v3', id: 'beside', slides: [{ id: 's', title: 'Moving the model could cut total spend by 8% to 30%',
  exhibit: { type: 'chart.column', heading: 'Spend', unit: '%', categories: ['A', 'B', 'C'], series: [{ name: 'Share', values: [23, 22, 18] }] }, pointsStyle: 'prose', points }] }));
const instances = deck.slides[0].componentInstances, blocks = instances.filter((instance) => instance.component === 'bullet-list').map((instance) => instance.frame).sort((x, y) => x.y - y.y);
const row = instances.find((instance) => instance.id === 's-row').frame;
console.log(JSON.stringify({ row, blocks, gaps: blocks.slice(1).map((block, at) => block.y - (blocks[at].y + blocks[at].height)) }));
''')
        row, blocks, gaps = result['row'], result['blocks'], result['gaps']
        above, below = blocks[0]['y'] - row['y'], (row['y'] + row['height']) - (blocks[-1]['y'] + blocks[-1]['height'])
        # The gaps between the points open evenly, as far as the page's loosest (space.loose, 48px) and no further...
        self.assertAlmostEqual(gaps[0], gaps[1], delta=1)
        self.assertGreater(gaps[0], 16)
        self.assertLessEqual(gaps[0], 48.01)
        # ...and what height is still left sits above and below the group, heading and all, as much one side as the other.
        self.assertLess(abs(above - below), 40)


if __name__ == '__main__':
    unittest.main()
