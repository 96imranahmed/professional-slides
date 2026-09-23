"""The storyline critique: bound to the story's structure, fed the insight log.

A critique is only worth its verdict for the storyline it read. Rewording a
page keeps it; changing what a page argues or shows asks for a new one. The
insight log travels with the packet so the critic can see whether the titles
were written from findings.
"""
import unittest

from node_probe import run_node


class StorylineTests(unittest.TestCase):
    def test_binding_follows_structure_not_wording(self):
        result = run_node('''
import { storylineBinding, validateStorylineReview, checkInsights, describeExhibit } from './skills/professional-slides/runtime/storyline.mjs';
const spec = { slides: [{ id: 'a', title: 'Riyadh Air opened 14 destinations in 16 weeks', exhibit: { type: 'chart.line', categories: ['M1','M2','M3','M4','M5'], series: [{ name: 'Destinations', values: [1,3,6,10,14] }] }, points: ['A sentence.'] }] };
const reworded = structuredClone(spec); reworded.slides[0].points = ['A different sentence.'];
const retitled = structuredClone(spec); retitled.slides[0].title = 'Riyadh Air has 14 destinations';
const binding = storylineBinding(spec);
const ready = { verdict: 'ready', binding, rating: 8, topFixes: [] };
console.log(JSON.stringify({
  same: storylineBinding(reworded) === binding, changed: storylineBinding(retitled) !== binding,
  ok: validateStorylineReview(ready, reworded), stale: validateStorylineReview(ready, retitled).length,
  revise: validateStorylineReview({ ...ready, verdict: 'revise' }, spec).length, missing: validateStorylineReview(null, spec).length,
  twoNumber: describeExhibit({ type: 'chart.column', categories: ['A', 'B'], series: [{ name: 'x', values: [1, 2] }] }),
  plainTable: describeExhibit({ type: 'table', columns: ['Airline', 'Note'], rows: [['A', 'words'], ['B', 'more words']] }),
  insights: checkInsights({ insights: [{ id: 'i1', finding: 'f', calculation: 'c', sources: ['sources/x.csv'] }, { id: 'i2', finding: 'f', sources: ['sources/y.csv'] }] }, ['x.csv']).problems,
  none: checkInsights(null).problems }));
''')
        self.assertTrue(result['same'])
        self.assertTrue(result['changed'])
        self.assertEqual(result['ok'], [])
        self.assertEqual(result['stale'], 1)
        self.assertEqual(result['revise'], 1)
        self.assertEqual(result['missing'], 1)
        self.assertIn('TWO-NUMBER', result['twoNumber'])
        self.assertIn('PLAIN GRID', result['plainTable'])
        self.assertIn('0 of 4 cells carry a number', result['plainTable'])
        self.assertEqual(len(result['insights']), 2)  # i2: no calculation, and its source is missing
        self.assertIn('no insight log', result['none'][0])


if __name__ == '__main__':
    unittest.main()
