"""Roles are each measure's own, and a table of tokens is not a typed table.

Two things a real run paid for in split pages and extra runs:

- A page that shows the claim's measure and a context measure in one chart
  could not say so: a `basis` role and a bound exhibit's `role` were the
  exhibit's, so the author moved context measures into tiles and tables of
  their own on seven pages. A series - bound, or named in a typed exhibit's
  `basis.roles` - now carries its own role and relevance, and the dependency
  gate, the storyline's `shows`, the critic's notes and the rule that
  something on the page proves the claim all read roles measure by measure.
- A table whose numbers were all tokens, or a fact grid whose figures were all
  bound, was treated as typed as soon as any other cell held a digit - a year,
  "FY26", a rank - or because a bound value is a bare number, and was refused
  for naming no measure. What counts as a typed measurement is now the number
  trace's reading: labels, years, ordinals and counts in a phrase are not.
"""
from __future__ import annotations

import unittest

from node_probe import run_node

FINANCE = '''
import fs from 'node:fs';
import { compileDeck, readInsights } from './skills/professional-slides/runtime/author-deck.mjs';
import { dependencyFindings, dependencyNotes, relationRepair } from './skills/professional-slides/runtime/gates/dependency_gates.mjs';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
const dir = './evals/quality/fixtures/evidence';
const doc = () => JSON.parse(fs.readFileSync(dir + '/finance.pages.json', 'utf8'));
const insights = await readInsights(dir, 'finance', { alternatives: doc().deck.players });
const M = S.recordedMeasures([...insights.values()]);
// One page of the fixture changed by `change`, compiled, with what the dependency gate, the binding and the critic's notes say of it.
const run = (id, change) => { const d = doc(); change(d.pages.find((p) => p.id === id), d);
  const compiled = compileDeck(d, { insights, partial: true }); const slide = compiled.spec.slides.find((s) => s.id === id);
  const bases = slide ? Object.values(slide.pageType.dependencies ?? {}).flat().filter(Boolean) : [];
  return { errors: [...compiled.compileErrors, ...compiled.bindingFindings.map((f) => f.repair)], findings: dependencyFindings(d, insights).filter((f) => f.id === id && f.severity === 'blocker').map((f) => [f.code, f.repair]),
    shows: slide ? S.shownMeasures(slide) : null, bases, notes: slide ? dependencyNotes({ bases, settles: slide.pageType.content.settles }) : null,
    series: slide?.exhibit?.series?.map((s) => Object.keys(s).sort()) ?? null, hash: slide ? S.storylinePageHashes(compiled.spec, M)[id] : null,
    packet: slide ? S.storyStructure(compiled.spec, M).find((p) => p.id === id).shows : null }; };
const RELEVANCE = 'Liabilities due within a year are what the liquid assets have to cover';
// f3 claims liquid assets alone; its chart draws liquid assets and short-term liabilities.
const claimLiquid = (page) => { page.settles = { kind: 'rate', what: 'liquid assets at year end', measures: ['i-liquidity/liquid'] }; };
'''


class SeriesRoleTests(unittest.TestCase):
    def test_a_bound_series_carries_its_own_role_and_relevance(self):
        result = run_node(FINANCE + '''
const mixed = run('f3', (page) => { claimLiquid(page); Object.assign(page.exhibit.series[1], { role: 'context', relevance: RELEVANCE }); });
const whole = run('f3', (page) => { claimLiquid(page); });
console.log(JSON.stringify({ mixed, wholeShows: whole.shows, wholeFindings: whole.findings.map((f) => f[0]), moved: mixed.hash !== whole.hash }));
''')
        mixed = result["mixed"]
        self.assertEqual(mixed["errors"], [])
        self.assertEqual(mixed["findings"], [])
        # The storyline's `shows` reads the role of each measure, in one exhibit.
        self.assertEqual(mixed["shows"], ["context:i-liquidity/short-liabilities", "proof:i-liquidity/liquid"])
        self.assertEqual(mixed["packet"], mixed["shows"])
        self.assertEqual(result["wholeShows"], ["proof:i-liquidity/liquid", "proof:i-liquidity/short-liabilities"])
        # The critic is shown the context measure with the relevance claimed for it, and nothing for the proof.
        self.assertEqual(mixed["notes"], ['context i-liquidity/short-liabilities - relevance claimed: "Liabilities due within a year are what the liquid assets have to cover"'])
        # The basis the runtime writes keeps the exhibit's role as the default and the series' own beside it; the series drawn carries neither key.
        basis = mixed["bases"][0]
        self.assertEqual([basis["role"], basis["roles"]], ["proof", {"i-liquidity/short-liabilities": {"role": "context", "relevance": "Liabilities due within a year are what the liquid assets have to cover"}}])
        self.assertEqual(mixed["series"], [["name", "values"], ["name", "values"]])
        # A measure's role is part of the argument the critique is bound to.
        self.assertTrue(result["moved"])

    def test_a_context_series_still_needs_its_relevance(self):
        result = run_node(FINANCE + '''
console.log(JSON.stringify({ none: run('f3', (page) => { claimLiquid(page); page.exhibit.series[1].role = 'context'; }).findings,
  short: run('f3', (page) => { claimLiquid(page); Object.assign(page.exhibit.series[1], { role: 'context', relevance: 'for context' }); }).findings.map((f) => f[0]),
  // The exhibit's own relevance stands for a context series that states none.
  inherited: run('f3', (page) => { claimLiquid(page); page.exhibit.series[1].role = 'context'; page.exhibit.relevance = RELEVANCE; }).findings,
  unknown: run('f3', (page) => { claimLiquid(page); page.exhibit.series[1].role = 'backdrop'; }).findings.map((f) => f[0]) }));
''')
        self.assertEqual([f[0] for f in result["none"]], ["CONTEXT_UNEXPLAINED"])
        self.assertIn("i-liquidity/short-liabilities as context beside the claim's measure", result["none"][0][1])
        self.assertIn("on its bound series", result["none"][0][1])
        self.assertEqual(result["short"], ["CONTEXT_UNEXPLAINED"])
        self.assertEqual(result["inherited"], [])
        self.assertEqual(result["unknown"], ["BASIS_UNKNOWN"])

    def test_proof_is_read_measure_by_measure(self):
        result = run_node(FINANCE + '''
const ctx = (series, at) => Object.assign(series[at], { role: 'context', relevance: RELEVANCE });
console.log(JSON.stringify({
  // The claim's own measure drawn as context, the other as proof: the proof is off the claim.
  swapped: run('f3', (page) => { claimLiquid(page); ctx(page.exhibit.series, 0); }).findings.map((f) => f[0]),
  // Every measure the page shows is context: nothing proves the claim.
  all: run('f3', (page) => { claimLiquid(page); ctx(page.exhibit.series, 0); ctx(page.exhibit.series, 1); }).findings,
  // The exhibit is context by default and one series says it is the proof.
  inverted: run('f3', (page) => { claimLiquid(page); page.exhibit.role = 'context'; page.exhibit.relevance = RELEVANCE; page.exhibit.series[0].role = 'proof'; }) }));
''')
        self.assertEqual(result["swapped"], ["PROOF_OFF_CLAIM"])
        self.assertEqual([f[0] for f in result["all"]], ["PROOF_MISSING"])
        self.assertIn("every measure its exhibits show is context", result["all"][0][1])
        self.assertEqual(result["inverted"]["findings"], [])
        self.assertEqual(result["inverted"]["shows"], ["context:i-liquidity/short-liabilities", "proof:i-liquidity/liquid"])

    def test_a_typed_exhibit_gives_a_measure_its_role_in_its_basis(self):
        result = run_node(FINANCE + '''
const typed = (roles) => (page) => { claimLiquid(page); page.exhibit = { heading: 'Liquid assets and liabilities due within a year', unit: 'GBP m', categories: ['FY19', 'FY20', 'FY21', 'FY22', 'FY23', 'FY24', 'FY25', 'FY26'],
  series: [{ name: 'Liquid assets', values: [120, 131, 150, 162, 158, 171, 180, 196] }, { name: 'Short-term liabilities', values: [96, 104, 118, 121, 139, 160, 172, 188] }],
  basis: { measures: ['i-liquidity/liquid', 'i-liquidity/short-liabilities'], role: 'proof', ...(roles ? { roles } : {}) }, highlights: [{ category: 'FY26' }] }; };
const ok = run('f3', typed({ 'i-liquidity/short-liabilities': { role: 'context', relevance: RELEVANCE } }));
console.log(JSON.stringify({ ok: [ok.errors, ok.findings, ok.shows, ok.notes],
  bare: run('f3', typed({ 'i-liquidity/short-liabilities': 'context' })).findings.map((f) => f[0]),
  stray: run('f3', typed({ 'i-cash/ocf': { role: 'context', relevance: RELEVANCE } })).findings,
  wrong: run('f3', typed({ 'i-liquidity/short-liabilities': { role: 'aside' } })).findings.map((f) => f[0]),
  // A spine's stub states the same, before the exhibit is drawn.
  stub: (() => { const d = doc(); const page = d.pages.find((p) => p.id === 'f3'); claimLiquid(page); delete page.bar; page.exhibit = { basis: { measures: ['i-liquidity/liquid', 'i-liquidity/short-liabilities'], roles: { 'i-liquidity/short-liabilities': { role: 'context', relevance: RELEVANCE } } } };
    const compiled = compileDeck(d, { insights, draft: true, partial: true }); return [compiled.compileErrors, S.shownMeasures(compiled.spec.slides.find((s) => s.id === 'f3'))]; })() }));
''')
        errors, findings, shows, notes = result["ok"]
        self.assertEqual([errors, findings], [[], []])
        self.assertEqual(shows, ["context:i-liquidity/short-liabilities", "proof:i-liquidity/liquid"])
        self.assertEqual(len(notes), 1)
        self.assertEqual(result["bare"], ["CONTEXT_UNEXPLAINED"])          # the role alone is accepted as a role, and still owes its relevance
        self.assertEqual([f[0] for f in result["stray"]], ["BASIS_UNKNOWN"])
        self.assertIn("which the basis does not name in `measures`", result["stray"][0][1])
        self.assertEqual(result["wrong"], ["BASIS_UNKNOWN"])
        self.assertEqual(result["stub"], [[], ["context:i-liquidity/short-liabilities", "proof:i-liquidity/liquid"]])


class TokenTableTests(unittest.TestCase):
    def test_a_table_whose_every_measurement_is_a_token_has_its_basis_written(self):
        result = run_node(FINANCE + '''
// The summary table cut to its five rows of tokens, with no basis; `beside` is typed into one cell beside the tokens.
const tokens = (beside) => (page) => { page.exhibit.rows = page.exhibit.rows.slice(0, 5).map((row) => [...row]); if (beside !== undefined) page.exhibit.rows[0][3] = beside; delete page.exhibit.basis;
  page.settles.measures = ['i-loans/loans', 'i-cash/ocf', 'i-earn/pat', 'i-liquidity/liquid', 'i-liquidity/short-liabilities']; };
const read = (beside) => { const r = run('f0', tokens(beside)); return { codes: r.findings.map((f) => f[0]), repair: r.findings.find((f) => f[0] === 'BASIS_MISSING')?.[1] ?? null, measures: r.bases[0]?.measures?.length ?? 0, errors: r.errors }; };
console.log(JSON.stringify({ plain: read(), labels: read('Up since FY19; restated in 2026; ranked 3rd of 8 lenders'), rank: read('Rank 3'),
  percent: read('Up 5.7% a year'), alone: read('3'), bar: read({ type: 'bar', value: 12 }) }));
''')
        # The basis is written from the measures its tokens print: ten as the fixture has it, nine once one cell's token is typed over.
        for name, measures in (("plain", 10), ("labels", 9), ("rank", 9)):
            with self.subTest(case=name):
                self.assertEqual(result[name]["errors"], [])
                self.assertEqual(result[name]["codes"], [], name)
                self.assertEqual(result[name]["measures"], measures)
        # A typed measurement beside the tokens makes it a typed exhibit again, and the refusal says which number.
        for name, typed in (("percent", "5.7%"), ("alone", "3"), ("bar", "12")):
            with self.subTest(case=name):
                self.assertIn("BASIS_MISSING", result[name]["codes"])
                self.assertIn(f"still types {typed}", result[name]["repair"])
                self.assertIn("A year, a period label, an ordinal and a count in a phrase are not measurements", result[name]["repair"])

    def test_a_fact_grid_of_bound_figures_needs_no_basis(self):
        result = run_node(FINANCE + '''
const figures = [{ measure: 'i-cash/ocf@FY26', format: '0', label: 'Operating cash flow, FY26' }, { measure: 'i-earn/pat@FY26', format: '0', label: 'Profit after tax, FY26' },
  { measure: 'A-ocf/percent', format: '+0.0%', label: 'Operating cash flow on the year' }, { measure: 'A-earn/percent', format: '+0.0%', label: 'Profit on the year' }];
const grid = (items) => (page) => { Object.assign(page, { form: 'fact-grid', commentary: 'none' }); delete page.metrics; page.exhibit = { items }; };
const bound = run('f2', grid(figures));
const mixed = run('f2', grid([...figures.slice(0, 3), { value: '4.3%', label: 'Profit on the year' }]));
console.log(JSON.stringify({ bound: [bound.errors, bound.findings, bound.bases[0]?.measures ?? null], mixed: mixed.findings.map((f) => [f[0], f[1].includes('still types 4.3%')]) }));
''')
        errors, findings, measures = result["bound"]
        self.assertEqual([errors, findings], [[], []])
        self.assertEqual(measures, ["i-cash/ocf", "i-earn/pat", "A-ocf/percent", "A-earn/percent"])
        self.assertIn(["BASIS_MISSING", True], result["mixed"])

    def test_an_exhibit_with_no_reference_is_held_as_before(self):
        # The base rule is kept where nothing is written by reference: an exhibit with numbers in it and no basis names
        # no measure, whatever those numbers are. Only what the runtime wrote changes what is asked.
        result = run_node(FINANCE + '''
const typed = run('f1', (page) => { delete page.exhibit.basis; });
const yearsOnly = run('f0', (page) => { page.exhibit = { type: 'table', columns: ['Measure', 'First reported', 'Latest'], rows: [['Loan book', 'FY19', 'FY26'], ['Profit after tax', 'FY19', 'FY26'], ['Liquid assets', 'FY19', 'FY26']] }; });
console.log(JSON.stringify({ typed: typed.findings.map((f) => f[0]), yearsOnly: yearsOnly.findings.map((f) => f[0]) }));
''')
        self.assertIn("BASIS_MISSING", result["typed"])
        self.assertIn("BASIS_MISSING", result["yearsOnly"])

    def test_the_trace_and_the_binding_read_a_measurement_alike(self):
        result = run_node('''
import { measurementsIn } from './skills/professional-slides/runtime/printed-numbers.mjs';
const read = (text, figure = true) => measurementsIn(text, figure).map((n) => n.shown);
console.log(JSON.stringify({ label: read('FY26'), year: read('2026'), ordinal: read('3rd'), phrase: read('3 of 8 sites'), rank: read('Rank 3'), alone: read('648'), approx: read('~50'),
  percent: read('5.7%'), money: read('CHF26m'), sentence: read('8 branches closed', false), decimal: read('grew 4.3 times', false) }));
''')
        for name in ("label", "year", "ordinal", "phrase", "rank", "sentence"):
            self.assertEqual(result[name], [], name)
        self.assertEqual([result["alone"], result["approx"], result["percent"], result["money"], result["decimal"]], [["648"], ["50"], ["5.7%"], ["CHF26m"], ["4.3"]])


if __name__ == "__main__":
    unittest.main()
