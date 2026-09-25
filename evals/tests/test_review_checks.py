"""Every review finding a machine check could have caught becomes a proposed check.

A review is the most expensive loop in the skill: a full reading of the rendered
deck. When it spends a finding on something code could have measured - a title
over two lines, a callout over a data label - the skill is missing a check. The
reviewer marks such a finding with `checkable: { rule, measure }`, judgement
findings carry null, and recording the review keeps the candidates in
`review-history/check-candidates.json` for the next round of fixing the skill.
"""
import unittest

from node_probe import run_node


FINDINGS = '''
const findings = [
  { slide: 'p04', code: 'BROKEN_GEOMETRY', severity: 'major', reason: 'The FY26 callout sits on top of the 48.3 data label.',
    repair: 'Move the callout above the plot so the value label shows.',
    checkable: { rule: 'A chart callout never overlaps a data label', measure: 'Intersection area of each callout box with each value-label box; any overlap fails' } },
  { slide: 'p09', code: 'MISSING_ARGUMENT', severity: 'major', reason: 'The page never says why the bridge matters for the plan.',
    repair: 'Add a closing sentence that states what the bridge implies for the plan.', checkable: null },
  { slide: 'p11', code: 'EDITORIAL', severity: 'minor', reason: 'The word "loop" is used twice in the title.', repair: '' },
];
'''


class CheckableSchemaTests(unittest.TestCase):
    def test_checkable_is_optional_and_accepts_an_object_or_null(self):
        result = run_node(FINDINGS + '''
import { REVIEW_SCHEMA, validateReview } from './skills/professional-slides/runtime/reviewer.mjs';
const item = REVIEW_SCHEMA.properties.findings.items;
const review = { accepted: false, summary: 'The deck argues well but one callout hides a value.', findings };
console.log(JSON.stringify({
  required: item.required, type: item.properties.checkable.type, keys: item.properties.checkable.required,
  errors: validateReview(review, ['p04', 'p09', 'p11']),
}));
''')
        self.assertNotIn('checkable', result['required'])
        self.assertEqual(sorted(result['type']), ['null', 'object'])
        self.assertEqual(result['keys'], ['rule', 'measure'])
        # An old review with no `checkable` on a finding (p11) still validates.
        self.assertEqual(result['errors'], [])

    def test_a_malformed_checkable_is_refused(self):
        result = run_node('''
import { validateReview } from './skills/professional-slides/runtime/reviewer.mjs';
const finding = (checkable) => ({ slide: 'a', code: 'OVERFLOW', severity: 'minor', reason: 'The label runs past its box edge.', repair: '', checkable });
const errors = (checkable) => validateReview({ accepted: true, summary: 'A finished deck with one minor defect.', findings: [finding(checkable)] }, ['a']);
console.log(JSON.stringify({ text: errors('a label overlaps'), empty: errors({ rule: 'x', measure: '' }), extra: errors({ rule: 'A label stays inside its box', measure: 'Label width against box width', owner: 'x' }) }));
''')
        self.assertTrue(any('checkable' in e for e in result['text']))
        self.assertTrue(any('checkable.rule' in e for e in result['empty']))
        self.assertTrue(any('checkable.measure' in e for e in result['empty']))
        self.assertTrue(any('owner' in e for e in result['extra']))

    def test_both_prompts_ask_the_reviewer_to_fill_it(self):
        result = run_node('''
import { reviewPrompt, verificationPrompt, REVIEW_SCHEMA, CODES } from './skills/professional-slides/runtime/reviewer.mjs';
const packet = { brief: 'b', answer: 'a', titles: ['1. T'], slides: [{ id: 's1', index: 1, title: 'T', gateFindings: [], image: 'x.png' }], codes: CODES,
  schema: REVIEW_SCHEMA, statistics: {}, density: null, craft: [], montage: 'm.png', inspectedSlides: ['s1'], binding: 'f'.repeat(64),
  scope: { mustInspect: ['s1'], priorBlocking: [], priorRating: 6 } };
console.log(JSON.stringify({ full: reviewPrompt(packet), verify: verificationPrompt(packet) }));
''')
        for prompt in (result['full'], result['verify']):
            self.assertIn('CHECKABLE FINDINGS', prompt)
            self.assertIn('checkable: { rule, measure }', prompt)
            self.assertIn('null for judgement', prompt)


class CheckCandidatesTests(unittest.TestCase):
    def test_check_candidates_lists_only_checkable_findings(self):
        result = run_node(FINDINGS + '''
import { checkCandidates } from './skills/professional-slides/runtime/reviewer.mjs';
console.log(JSON.stringify({ candidates: checkCandidates({ findings }), none: checkCandidates({}), nothing: checkCandidates(null) }));
''')
        self.assertEqual(len(result['candidates']), 1)
        candidate = result['candidates'][0]
        self.assertEqual(candidate['slide'], 'p04')
        self.assertEqual(candidate['code'], 'BROKEN_GEOMETRY')
        self.assertEqual(candidate['severity'], 'major')
        self.assertEqual(candidate['rule'], 'A chart callout never overlaps a data label')
        self.assertIn('Intersection area', candidate['measure'])
        self.assertEqual(result['none'], [])
        self.assertEqual(result['nothing'], [])

    def test_recording_merges_candidates_by_rule_across_reviews(self):
        result = run_node(FINDINGS + '''
import { mkdtemp, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordCheckCandidates, CHECK_CANDIDATES } from './skills/professional-slides/runtime/reviewer.mjs';
const dir = await mkdtemp(join(tmpdir(), 'check-candidates-'));
// A review with nothing checkable writes no file.
const quiet = await recordCheckCandidates(dir, { findings: [findings[1]] }, join(dir, 'review-history', 'review-1.json'));
const wrote = await access(join(dir, 'review-history', CHECK_CANDIDATES)).then(() => true, () => false);
await recordCheckCandidates(dir, { findings }, join(dir, 'review-history', 'review-2.json'));
// The same rule raised again on another page, with different capitalisation.
const again = { ...findings[0], slide: 'p20', checkable: { ...findings[0].checkable, rule: 'A chart callout never overlaps a DATA label' } };
await recordCheckCandidates(dir, { findings: [again] }, join(dir, 'review-history', 'review-3.json'));
const file = JSON.parse(await readFile(join(dir, 'review-history', CHECK_CANDIDATES), 'utf8'));
console.log(JSON.stringify({ quiet: quiet.file, wrote, file }));
''')
        self.assertIsNone(result['quiet'])
        self.assertFalse(result['wrote'])
        candidates = result['file']['candidates']
        self.assertEqual(len(candidates), 1)
        entry = candidates[0]
        self.assertEqual(entry['count'], 2)
        self.assertEqual(entry['slides'], ['p04', 'p20'])
        self.assertEqual(entry['reviews'], ['review-2.json', 'review-3.json'])
        self.assertEqual(entry['code'], 'BROKEN_GEOMETRY')


if __name__ == '__main__':
    unittest.main()
