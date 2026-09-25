"""One review per deck: the author's claim self-check, then scoped verification.

Three full reviews of the Harry Potter evaluation rejected it mostly on claims
the author could have reproduced with the data open. The ledger lists them, the
self-check must cover them before a review is requested, and a review after a
rejection reads only the pages that changed or were blocked.
"""
import unittest

from node_probe import run_node


class ClaimLedgerTests(unittest.TestCase):
    def test_ledger_lists_claims_and_flags_a_summary_figure_no_page_shows(self):
        result = run_node('''
import { buildLedger } from './skills/professional-slides/runtime/claims.mjs';
const t = (role, text) => ({ type: 'text', role, text });
const scene = { slides: [
  { id: 'exec', role: 'executive-summary', nodes: [t('action-title', 'The series wins'), t('list-item', 'Every film cleared $1.34bn in 2025 dollars. An 85% bar hands the lead to a rival.')] },
  { id: 'floor', nodes: [t('action-title', 'The weakest film is the highest floor'), t('data-label', '1,337'), t('axis-label', 'Films')] },
  { id: 'plain', nodes: [t('action-title', 'Method and sources'), t('paragraph', 'Records come from public trackers.')] },
] };
const ledger = buildLedger(scene);
console.log(JSON.stringify({ claims: ledger.claims.map(c => c.slide + ':' + c.text), findings: ledger.findings.map(f => f.numbers), pages: Object.keys(ledger.pageHashes), spine: ledger.spine.length }));
''')
        # $1.34bn is shown as 1,337 ($m); the 85% bar is shown nowhere.
        self.assertEqual(result['findings'], [['85']])
        self.assertIn('floor:The weakest film is the highest floor', result['claims'])
        self.assertNotIn('plain', result['pages'])
        self.assertEqual(result['spine'], 3)

    def test_self_check_needs_a_current_verdict_for_each_page_with_claims(self):
        result = run_node('''
import { buildLedger, validateSelfCheck } from './skills/professional-slides/runtime/claims.mjs';
const t = (role, text) => ({ type: 'text', role, text });
const scene = (title) => ({ slides: [{ id: 'a', nodes: [t('action-title', title)] }, { id: 'b', nodes: [t('action-title', 'Only one rival comes close')] }] });
const before = buildLedger(scene('Eight films cleared $750m'));
const check = { pages: Object.fromEntries(Object.entries(before.pageHashes).map(([k, v]) => [k, { claims: v, verified: true }])), findings: {}, spine: 'Read the titles alone; no two pages prove the same proposition.' };
const after = buildLedger(scene('Seven films cleared $750m'));
console.log(JSON.stringify({ missing: validateSelfCheck(null, before).length, ok: validateSelfCheck(check, before), stale: validateSelfCheck(check, after) }));
''')
        self.assertEqual(result['missing'], 1)
        self.assertEqual(result['ok'], [])
        # Only the page whose claim changed needs checking again.
        self.assertEqual(len(result['stale']), 1)
        self.assertIn(': a', result['stale'][0])
        self.assertNotIn('b', result['stale'][0].split(': ')[-1])


class VerificationScopeTests(unittest.TestCase):
    def test_second_review_reads_changed_and_blocked_pages_and_inherits_the_rest(self):
        result = run_node('''
import { verificationScope, withInheritedDensity } from './skills/professional-slides/runtime/reviewer.mjs';
const prior = { binding: 'b1', slideHashes: { a: '1', b: '2', c: '3', d: '4' }, review: { accepted: false, rating: 6, findings: [
  { slide: 'b', code: 'FACTUAL_ERROR', severity: 'major', reason: 'x', repair: 'y' },
  { slide: 'd', code: 'EDITORIAL', severity: 'minor', reason: 'x', repair: '' },
  { slide: null, code: 'LAYOUT_MONOTONY', severity: 'major', reason: 'x', repair: 'y' }],
  density: { deck: 'd', pages: [{ slide: 'c', verdict: 'right', reason: 'r' }, { slide: 'a', verdict: 'right', reason: 'r' }] } } };
const scope = verificationScope(prior, { a: 'changed', b: '2', c: '3', d: '4' });
const review = withInheritedDensity({ density: { deck: 'd', pages: [] } }, scope);
console.log(JSON.stringify({ must: scope.mustInspect, deck: scope.priorBlocking.filter(f => !f.slide).length, inherited: review.density.pages.map(p => p.slide), none: verificationScope(null, {}) }));
''')
        self.assertEqual(result['must'], ['a', 'b'])
        self.assertEqual(result['deck'], 1)
        # a changed, so its density is judged again; c's verdict carries over.
        self.assertEqual(result['inherited'], ['c'])
        self.assertIsNone(result['none'])


if __name__ == '__main__':
    unittest.main()
