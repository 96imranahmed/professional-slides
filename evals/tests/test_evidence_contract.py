"""The evidence contract: measures, computed analyses, and what each page rests on.

A fifty-page evaluation deck carried a chart of one measure on a page titled
on another. A repair for variety had copied the chart from another page,
appended its insight id to `evidence` and left the citation as it was, and
every check passed it: they read the page's structure, and an insight was a
sentence nothing could be computed from or checked against. The same deck
walked its records one page each, so the findings that need two records - the
alternatives on common measures, the gap between two series, the headroom to a
threshold - had no page.

These cover the three parts of the repair: an insight's numbers recorded as
measures; analyses the runtime executes over them before the outline; and the
claim and each exhibit held to the measures they name.
"""
import json
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, ROOT, run_node

FIXTURES = ROOT / "evals" / "quality" / "fixtures" / "evidence"

LOG = '''
const FY = ['FY21', 'FY22', 'FY23', 'FY24', 'FY25', 'FY26'];
const insights = [
  { id: 'i-bal', shape: 'series', sources: ['sources/a.csv'], cite: ['annual-report'],
    measures: { cash: { unit: 'GBP m', population: 'the company', periods: FY, values: [15, 21, 37, 43, 50, 55] },
                debt: { unit: 'GBP m', population: 'the company', periods: FY, values: [108, 96, 82, 68, 58, 56] },
                staff: { unit: 'people', population: 'the company', periods: FY, values: [900, 950, 990, 1010, 1040, 1100] } } },
  { id: 'i-peers', shape: 'fact', sources: ['sources/b.csv'],
    measures: { profit: { unit: 'GBP m', population: 'four couriers', period: 'latest year', members: ['Alpha', 'Beta', 'Gamma'], values: [20, 3, null],
                          unavailable: { Gamma: 'reports in another currency at group level' }, boundaries: { Beta: 'calendar year' } },
                margin: { unit: '%', population: 'four couriers', period: 'latest year', members: ['Alpha', 'Beta', 'Delta'], values: [15, 8, 21] } } },
];
const plan = (analyses) => ({ analyses: analyses.map((a) => ({ soWhat: 'It changes what the answer can claim', strength: 'strong', ...a })) });
'''


class MeasureTests(unittest.TestCase):
    def test_a_measure_says_its_unit_population_axis_and_values(self):
        result = run_node('''
import { measureProblems, measureRegistry, unmeasuredInsights, hasMeasures } from './skills/professional-slides/runtime/measures.mjs';
const bad = { id: 'x', shape: 'series', measures: {
  a: { population: 'the company', periods: ['FY25', 'FY26'], values: [1, 2] },
  b: { unit: '%', periods: ['FY25', 'FY26'], values: [1, 2] },
  c: { unit: '%', population: 'the company', periods: ['FY25', 'FY26'], values: [1] },
  d: { unit: '%', population: 'the company', members: ['A', 'B'], period: '2026', values: [1, null] },
  e: { unit: '%', population: 'the company', value: 4 },
  f: { unit: '%', population: 'the company', period: '2026', value: 4, assumed: true } } };
const good = { id: 'y', shape: 'fact', sources: ['sources/y.csv'], cite: ['k'], measures: { m: { unit: 'GBP m', population: 'the company', period: '2026', value: 4 } } };
const prose = { id: 'z', shape: 'series', finding: 'numbers in a sentence' };
const words = { id: 'q', shape: 'qualitative', finding: 'a judgement' };
console.log(JSON.stringify({ problems: measureProblems(bad), good: measureProblems(good), registry: [...measureRegistry([good, prose]).keys()], cite: measureRegistry([good]).get('y/m').cite,
  unmeasured: unmeasuredInsights(new Map([['y', good], ['z', prose], ['q', words]])), has: [hasMeasures([prose, words]), hasMeasures([good])] }));
''')
        problems = "\n".join(result["problems"])
        for expected in ("x/a: say the `unit`", "x/b: say the `population`", "x/c: 2 periods need 2 `values`", 'x/d: B is null', "x/e: say the `period`", "x/f: an assumed measure says why"):
            self.assertIn(expected, problems)
        self.assertEqual(result["good"], [])
        self.assertEqual(result["registry"], ["y/m"])
        self.assertEqual(result["cite"], ["k"])
        # A sentence of numbers is the gap; a judgement has no numbers to record.
        self.assertEqual(result["unmeasured"], ["z"])
        self.assertEqual(result["has"], [False, True])


class AnalysisTests(unittest.TestCase):
    def test_the_runtime_computes_across_records_and_says_what_it_could_not(self):
        result = run_node(LOG + '''
import { runAnalyses, analysisInsights } from './skills/professional-slides/runtime/analysis.mjs';
const { results, problems } = runAnalyses(plan([
  { id: 'A-net', op: 'gap', inputs: ['i-bal/debt', 'i-bal/cash'] },
  { id: 'A-floor', op: 'threshold', inputs: ['A-net/result'], safe: 'below', threshold: { value: 20, rationale: 'the covenant ceiling the lenders are assumed to set' } },
  { id: 'A-path', op: 'scenario', inputs: ['i-bal/cash'], method: 'linear', assumptions: [{ name: 'annual cash use', value: -12, rationale: 'the disruption year repeats without recovery' }],
    horizon: ['FY27', 'FY28', 'FY29'], threshold: { value: 25, rationale: 'the minimum liquidity the board is assumed to hold' } },
  { id: 'A-mixed', op: 'gap', inputs: ['i-bal/cash', 'i-bal/staff'] },
  { id: 'A-index', op: 'index', inputs: ['i-bal/cash', 'i-bal/staff'] },
  { id: 'A-absent', op: 'gap', inputs: ['i-bal/cash', 'i-plan/retirements'], missing: ['retirement schedule by year: not in the records'] },
  { id: 'A-peers', op: 'compare', inputs: ['i-peers/profit', 'i-peers/margin'] },
  { id: 'A-all', op: 'compare', inputs: ['i-peers/profit', 'i-peers/margin'], members: ['Alpha', 'Beta', 'Epsilon', 'Gamma', 'Delta'] },
  { id: 'A-growth', op: 'growth', inputs: ['i-bal/cash'] },
]), insights, { alternatives: ['Alpha', 'Beta', 'Epsilon'] });
// With no players declared, a comparison runs over every member its measures list.
const open = runAnalyses(plan([{ id: 'A-peers', op: 'compare', inputs: ['i-peers/profit', 'i-peers/margin'] }]), insights, {}).results[0];
const by = Object.fromEntries(results.map((r) => [r.id, r]));
const derived = Object.fromEntries(analysisInsights(results).map((i) => [i.id, i]));
console.log(JSON.stringify({ problems, status: Object.fromEntries(results.map((r) => [r.id, r.status])),
  net: by['A-net'].measures.result.values, floor: [by['A-floor'].measures.headroom.value, by['A-floor'].assumptions.length],
  path: [by['A-path'].measures.path.values, by['A-path'].crossesAt, by['A-path'].assumptions.map((a) => a.name)],
  mixed: by['A-mixed'].reason, absent: [by['A-absent'].missing, 'A-absent' in derived],
  index: by['A-index'].measures.cash.values.at(-1), growth: by['A-growth'].measures.percent.value,
  players: [by['A-peers'].table.members, by['A-peers'].others, by['A-peers'].finding, by['A-peers'].uncovered, by['A-peers'].measures.margin.members], open: [open.table.members, open.others ?? null],
  table: by['A-all'].table.members, epsilon: by['A-all'].table.columns.map((c) => c.cells.Epsilon), gamma: by['A-all'].table.columns[0].cells.Gamma,
  beta: by['A-all'].table.columns[0].cells.Beta, sensitivity: by['A-all'].sensitivity, uncovered: by['A-all'].uncovered, named: [by['A-all'].others ?? null, by['A-all'].finding],
  shapes: Object.fromEntries(Object.values(derived).map((i) => [i.id, i.shape])), netInputs: derived['A-net'].inputs, netSources: derived['A-net'].sources }));
''')
        self.assertEqual(result["problems"], [])
        self.assertEqual(result["status"], {"A-net": "computed", "A-floor": "assumed", "A-path": "assumed", "A-mixed": "unavailable", "A-index": "computed",
                                            "A-absent": "unavailable", "A-peers": "computed", "A-all": "computed", "A-growth": "computed"})
        self.assertEqual(result["net"], [93, 75, 45, 25, 8, 1])  # debt less cash, period by period: no derived number is typed
        self.assertEqual(result["floor"], [19, 1])  # a threshold nobody recorded is an assumption, listed as one
        self.assertEqual(result["path"], [[55, 43, 31, 19], "FY29", ["annual cash use", "threshold"]])
        self.assertIn("a gap needs one unit", result["mixed"])  # GBP m less people is not a number
        self.assertEqual(result["absent"], [["i-plan/retirements", "retirement schedule by year: not in the records"], False])  # an analysis that cannot run carries no page
        self.assertEqual(round(result["index"], 1), 366.7)
        self.assertEqual(round(result["growth"], 1), 266.7)
        # A deck that declares its players compares those: a measure that also lists other members does not bury them. The
        # members left out are named in the result and counted in the finding, and are added by naming them in `members`.
        members, others, finding, uncovered, margin = result["players"]
        self.assertEqual(members, ["Alpha", "Beta", "Epsilon"])
        self.assertEqual(others, ["Gamma", "Delta"])
        self.assertIn("2 other members of these measures are not compared", finding)
        self.assertIn("name the members to compare in `members`", finding)
        self.assertEqual(uncovered, ["Epsilon"])
        self.assertEqual(margin, ["Alpha", "Beta", "Epsilon"])     # and the result's measures run over the members compared
        self.assertEqual(result["open"], [["Alpha", "Beta", "Gamma", "Delta"], None])
        # Named in `members`, every one takes its row, with n/a kept and the boundary carried.
        self.assertEqual(result["table"], ["Alpha", "Beta", "Epsilon", "Gamma", "Delta"])
        self.assertIsNone(result["named"][0])
        self.assertNotIn("not compared", result["named"][1])
        self.assertTrue(all(cell["value"] is None and cell["unavailable"] == "not in this record" for cell in result["epsilon"]))
        self.assertEqual(result["gamma"]["unavailable"], "reports in another currency at group level")
        self.assertEqual(result["beta"]["boundary"], "calendar year")
        self.assertEqual(result["uncovered"], ["Epsilon", "Gamma"])  # a declared player with no record, and a member disclosed on nothing
        # Who leads under each priority: the lead is shown to depend on it, not averaged away.
        self.assertEqual([(p["priority"], p["leader"]) for p in result["sensitivity"]["byPriority"]], [("profit", "Alpha"), ("margin", "Delta")])
        self.assertFalse(result["sensitivity"]["holdsUnderEveryPriority"])
        self.assertIsNone(result["sensitivity"]["mostLeads"])
        self.assertEqual(result["shapes"]["A-peers"], "roster")
        self.assertEqual(result["shapes"]["A-net"], "series")
        self.assertEqual(result["netInputs"], ["i-bal/debt", "i-bal/cash"])
        self.assertEqual(result["netSources"], ["sources/a.csv"])

    def test_a_plan_is_refused_before_anything_is_computed(self):
        result = run_node(LOG + '''
import { runAnalyses, planProblems } from './skills/professional-slides/runtime/analysis.mjs';
console.log(JSON.stringify({ bad: planProblems({ analyses: [{ id: 'A1', op: 'average', inputs: ['i-bal/cash'], soWhat: 'It changes the answer for the reader', strength: 'strong' },
    { id: 'A2', op: 'gap', inputs: ['i-bal/cash'], soWhat: 'It changes the answer for the reader', strength: 'strong' }, { id: 'A2', op: 'growth', inputs: ['i-bal/cash'], soWhat: 'short', strength: 'vital' }] }),
  none: planProblems(null), ran: runAnalyses({ analyses: [{ id: 'A1', op: 'average' }] }, insights).results.length,
  scenario: runAnalyses(plan([{ id: 'S', op: 'scenario', inputs: ['i-bal/cash'], horizon: ['FY27'], assumptions: [{ name: 'burn', value: -5 }] }]), insights).results[0] }));
''')
        text = "\n".join(result["bad"])
        self.assertIn("A1: `op` is one of compare, gap", text)
        self.assertIn("A2: gap reads 2 measures", text)
        self.assertIn("A2: the id is used twice", text)
        self.assertIn("`soWhat` says what follows", text)
        self.assertIn("`strength` is one of", text)
        self.assertEqual(result["none"], [])
        self.assertEqual(result["ran"], 0)
        # An assumption with no rationale is not an assumption the reader can weigh.
        self.assertEqual(result["scenario"]["status"], "unavailable")
        self.assertIn("rationale", result["scenario"]["reason"])

    def test_a_comparisons_members_are_validated_and_a_scenario_starts_at_the_period_its_value_is_recorded_for(self):
        # A run compared 23 members where the deck declared five players, because `members` was undocumented; and a scenario
        # on a single value drew its start as "base", a label no reader can place.
        result = run_node(LOG + '''
import { runAnalyses, planProblems, ANALYSIS_OPS } from './skills/professional-slides/runtime/analysis.mjs';
const single = [...insights, { id: 'i-vis', shape: 'fact', sources: ['sources/c.csv'], measures: { visitors: { unit: 'k', population: 'the museums', period: '2025', value: 260 }, undated: { unit: 'k', population: 'the museums', period: 'FY27', value: 30 } } }];
const scenario = (input, horizon) => runAnalyses(plan([{ id: 'S', op: 'scenario', inputs: [input], method: 'compound', horizon,
  assumptions: [{ name: 'growth', value: 10, unit: '% a year', rationale: 'the growth recorded last year continues unchanged' }] }]), single).results[0];
console.log(JSON.stringify({
  bad: planProblems(plan([{ id: 'A', op: 'compare', inputs: ['i-peers/profit'], members: 'Alpha' }, { id: 'B', op: 'compare', inputs: ['i-peers/profit'], members: ['Alpha'] },
    { id: 'C', op: 'gap', inputs: ['i-bal/debt', 'i-bal/cash'], members: ['Alpha', 'Beta'] }])),
  good: planProblems(plan([{ id: 'A', op: 'compare', inputs: ['i-peers/profit'], members: ['Alpha', 'Beta'] }])), does: ANALYSIS_OPS.compare.does,
  dated: scenario('i-vis/visitors', ['2026', '2027']).measures.path.periods,
  // A horizon that already uses the value's own period keeps the two apart.
  clash: scenario('i-vis/undated', ['FY27', 'FY28']).measures.path.periods,
  series: scenario('i-bal/cash', ['FY27', 'FY28']).measures.path.periods }));
''')
        self.assertEqual(len(result["bad"]), 3)
        self.assertTrue(all("`members` lists the two or more members a `compare` sets side by side" in problem for problem in result["bad"]), result["bad"])
        self.assertEqual(result["good"], [])
        self.assertIn("the members named in `members`", result["does"])
        self.assertEqual(result["dated"], ["2025", "2026", "2027"])
        self.assertEqual(result["clash"], ["base", "FY27", "FY28"])
        self.assertEqual(result["series"], ["FY26", "FY27", "FY28"])

    def test_what_cannot_be_computed_honestly_is_unavailable_or_carries_its_boundary(self):
        result = run_node("""
import { runAnalyses } from './skills/professional-slides/runtime/analysis.mjs';
import { measureRegistry } from './skills/professional-slides/runtime/measures.mjs';
const base = { finding: 'f', shape: 'series', calculation: 'c', sources: ['s.csv'], soWhat: 'It bears on the decision at hand', strength: 'strong' };
const log = [
  { ...base, id: 'a', measures: { parts: { unit: 'GBP m', population: 'p', period: 'FY26', members: ['x', 'y'], values: [15, -5] },
      now: { unit: 'GBP m', population: 'p', period: 'FY24', members: ['x', 'y'], values: [4, 6] }, then: { unit: 'GBP m', population: 'q', period: 'FY19', members: ['x', 'y'], values: [1, 0] },
      s1: { unit: 'GBP m', population: 'p', periods: ['FY24', 'FY25'], values: [10, 12] }, s2: { unit: 'staff', population: 'p', periods: ['FY24', 'FY25'], values: [5, 5] } } }];
const an = (o) => ({ soWhat: 'It bears on the decision at hand', strength: 'supporting', ...o });
const { results } = runAnalyses({ analyses: [
  an({ id: 'share', op: 'share', inputs: ['a/parts'] }),
  an({ id: 'gap', op: 'gap', inputs: ['a/now', 'a/then'] }),
  an({ id: 'ratio', op: 'ratio', inputs: ['a/now', 'a/then'] }),
  an({ id: 'index', op: 'index', inputs: ['a/s1', 'a/s2'] }),
  an({ id: 'bare', op: 'scenario', inputs: ['a/s1'], assumptions: [{ name: 'growth', value: 2, rationale: 'the last year repeated each year' }], horizon: ['FY26'], threshold: { value: 20 } }),
  an({ id: 'units', op: 'scenario', inputs: ['a/s1'], assumptions: [{ name: 'hires', value: 2, unit: 'staff', rationale: 'the last year repeated each year' }], horizon: ['FY26'] }),
] }, log);
const by = Object.fromEntries(results.map((r) => [r.id, r]));
const registry = measureRegistry([...log, ...results.filter((r) => r.measures).map((r) => ({ id: r.id, derived: true, inputs: r.inputs, measures: r.measures }))]);
console.log(JSON.stringify({ share: [by.share.status, by.share.reason], gap: [by.gap.status, by.gap.boundaries.some((b) => b.includes('not one period'))],
  ratio: [by.ratio.measures.result.values, Object.keys(by.ratio.measures.result.unavailable)], bare: [by.bare.status, by.bare.reason.includes('rationale')], units: [by.units.status, by.units.reason.includes('GBP m a period')],
  lineage: [registry.get('index/s1').inputs, registry.get('index/s2').inputs, registry.get('gap/result').inputs, registry.get('a/s1').inputs] }));
""")
        self.assertEqual(result["share"][0], "unavailable")  # a negative part is not a share of a whole
        self.assertIn("negative part", result["share"][1])
        self.assertEqual(result["gap"], ["computed", True])  # two records for different years, said beside the result
        self.assertEqual(result["ratio"], [[4, None], ["y"]])  # nothing is divided by zero, and the gap says why
        self.assertEqual(result["bare"], ["unavailable", True])  # a threshold nobody recorded needs its reason
        self.assertEqual(result["units"], ["unavailable", True])  # staff a year do not add to GBP m
        # Each indexed series comes from its own input; a gap from both; a record from nothing.
        self.assertEqual(result["lineage"], [["a/s1"], ["a/s2"], ["a/now", "a/then"], []])

    def test_the_cli_writes_the_results_beside_the_pages_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            for name in ("finance.pages.json", "finance.insights.json", "finance.analysis.json"):
                (Path(tmp) / name).write_text((FIXTURES / name).read_text(encoding="utf-8"), encoding="utf-8")
            run = subprocess.run([NODE, str(ROOT / "skills/professional-slides/runtime/analysis.mjs"), str(Path(tmp) / "finance.pages.json")], capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            written = json.loads((Path(tmp) / "finance.analysis-results.json").read_text(encoding="utf-8"))
            self.assertEqual([r["id"] for r in written["results"]], ["A-ocf", "A-earn", "A-cushion", "A-peers", "A-cover", "A-floor", "A-loans", "A-loans-year", "A-liquid-year", "A-index", "A-short-year"])
            self.assertEqual(json.loads(run.stdout)["assumed"], 0)  # the liquidity floor is a recorded rule, not an assumption
            (Path(tmp) / "finance.analysis.json").unlink()
            bare = subprocess.run([NODE, str(ROOT / "skills/professional-slides/runtime/analysis.mjs"), str(Path(tmp) / "finance.pages.json")], capture_output=True, text=True)
            self.assertEqual(bare.returncode, 2)
            self.assertIn("compare", bare.stderr)  # it says what can be run


WIDE = """
const FY = ['FY24', 'FY25', 'FY26'];
const base = { finding: 'f', calculation: 'c', sources: ['s.csv'], soWhat: 'It bears on the decision at hand', strength: 'strong' };
const insights = [
  { ...base, id: 'i-network', shape: 'peer-set', measures: {
      open: { unit: 'depots', population: 'three couriers, depots open', period: '2026', members: ['Alpha', 'Beta', 'Gamma'], values: [200, 120, 10] },
      planned: { unit: 'depots', population: 'three couriers, depots planned', period: '2026', members: ['Alpha', 'Beta', 'Gamma'], values: [50, 80, 150], boundaries: { Gamma: 'no opening dates' } },
      rented: { unit: 'depots', population: 'three couriers, rented', period: '2026', members: ['Alpha', 'Beta', 'Gamma'], values: [5, null, 1], unavailable: { Beta: 'not disclosed' } } } },
  { ...base, id: 'i-alpha', shape: 'series', measures: {
      parcels: { unit: 'm', population: 'Alpha', periods: FY, values: [40, 48, 50] },
      depots: { unit: 'depots', population: 'Alpha, depots at year end', periods: FY, values: [180, 190, 200] },
      margin: { unit: '%', population: 'Alpha', periods: FY, values: [9.4, 2, -6.1] } } },
  { ...base, id: 'i-beta', shape: 'series', measures: { parcels: { unit: 'm', population: 'Beta', periods: FY, values: [20, 25, 30] } } },
  { ...base, id: 'i-market', shape: 'fact', measures: {
      total: { unit: 'm', population: 'the home market', period: '2026', value: 140 },
      domestic: { unit: '% of parcels', population: 'the home market', period: '2026', value: 45 },
      floor: { unit: '%', population: 'Alpha', period: 'covenant', value: 5, standard: true } } },
];
const an = (o) => ({ soWhat: 'It bounds what the entrant can take', strength: 'strong', ...o });
"""


class WiderOperationTests(unittest.TestCase):
    """Sums, products and stated alignment: one calculation is one analysis, in a unit that means something."""

    def test_a_capacity_ceiling_is_a_sum_and_a_product_with_its_alignment_and_premise_stated(self):
        # One courier's depots open and planned, at another's parcels per depot, as a share of the other: the
        # calculation that took five chained analyses, two of them zero-growth scenarios used to line labels up.
        result = run_node(WIDE + """
import { runAnalyses, analysisInsights } from './skills/professional-slides/runtime/analysis.mjs';
import { measureRegistry } from './skills/professional-slides/runtime/measures.mjs';
const at = { 'A-all/result': 'Gamma', 'i-alpha/parcels': 'FY26', 'i-alpha/depots': 'FY26' };
const { results, problems } = runAnalyses({ analyses: [
  an({ id: 'A-all', op: 'sum', inputs: ['i-network/open', 'i-network/planned'] }),
  an({ id: 'A-ceiling', op: 'product', inputs: ['A-all/result', 'i-alpha/parcels'], over: ['i-alpha/depots'], at,
       assumptions: [{ name: "Gamma handles Alpha's parcels per depot", rationale: 'Gamma publishes no parcel count, so the leader stands in' }] }),
  an({ id: 'A-share', op: 'ratio', percent: true, inputs: ['A-ceiling/result', 'i-alpha/parcels'], at: { 'i-alpha/parcels': 'FY26' } }),
  an({ id: 'A-unaligned', op: 'product', inputs: ['i-network/planned', 'i-alpha/parcels'] }),
  an({ id: 'A-nolabel', op: 'gap', inputs: ['i-alpha/parcels', 'i-beta/parcels'], at: { 'i-beta/parcels': 'FY30' } }),
  an({ id: 'A-premise', op: 'gap', inputs: ['i-alpha/parcels', 'i-beta/parcels'], assumptions: [{ name: 'same basis' }] }),
  an({ id: 'A-absent', op: 'product', inputs: ['i-alpha/parcels', 'i-beta/parcels'], over: ['i-gamma/depots'] }),
] }, insights);
const by = Object.fromEntries(results.map((r) => [r.id, r]));
const registry = measureRegistry([...insights, ...analysisInsights(results)]);
console.log(JSON.stringify({ problems, status: Object.fromEntries(results.map((r) => [r.id, r.status])),
  all: [by['A-all'].measures.result.values, by['A-all'].measures.result.unit, by['A-all'].boundaries],
  ceiling: [by['A-ceiling'].measures.result.value, by['A-ceiling'].measures.result.unit, by['A-ceiling'].assumptions.map((a) => a.name), by['A-ceiling'].inputs, by['A-ceiling'].boundaries, by['A-ceiling'].finding],
  share: [by['A-share'].measures.result.value, by['A-share'].measures.result.unit],
  lineage: [registry.get('A-ceiling/result').inputs, registry.get('A-ceiling/result').assumed, registry.get('A-share/result').assumed, registry.get('A-all/result').inputs],
  unaligned: by['A-unaligned'].reason, nolabel: by['A-nolabel'].reason, premise: by['A-premise'].reason, absent: [by['A-absent'].missing, by['A-absent'].reason] }));
""")
        self.assertEqual(result["problems"], [])
        self.assertEqual(result["status"], {"A-all": "computed", "A-ceiling": "assumed", "A-share": "assumed", "A-unaligned": "unavailable", "A-nolabel": "unavailable",
                                            "A-premise": "unavailable", "A-absent": "unavailable"})
        # Member by member, the boundary carried - and, the two being measures of different populations (open, planned), the sum says it adds across them.
        self.assertEqual(result["all"], [[250, 200, 160], "depots", ["i-network/open describes three couriers, depots open and i-network/planned describes three couriers, depots planned: the result is across different populations",
                                                                    "i-network/planned Gamma: no opening dates"]])
        value, unit, premises, inputs, boundaries, finding = result["ceiling"]
        self.assertEqual([value, unit], [40, "m"])  # 160 depots x 50 m / 200 depots: depots cancel, parcels are left
        self.assertEqual(premises, ["Gamma handles Alpha's parcels per depot"])  # a premise nobody recorded makes the result an assumed one
        self.assertEqual(inputs, ["A-all/result", "i-alpha/parcels", "i-alpha/depots"])  # what it is divided by is part of what it rests on
        # Nothing is aligned silently: each value read at a stated label is a boundary note.
        for ref, label in (("A-all/result", "Gamma"), ("i-alpha/parcels", "FY26"), ("i-alpha/depots", "FY26")):
            self.assertIn(f"{ref} is read at {label}, as the plan states", boundaries)
        self.assertIn("A-all/result at Gamma times i-alpha/parcels at FY26 over i-alpha/depots at FY26 is 40 m", finding)
        self.assertEqual(result["share"], [80, "%"])
        self.assertEqual(result["lineage"], [["A-all/result", "i-alpha/parcels", "i-alpha/depots"], True, True, ["i-network/open", "i-network/planned"]])
        # A member measure against a series cannot be aligned without a choice, and the refusal says what to write.
        self.assertIn('`at: { "i-network/planned": "<member>" }`', result["unaligned"])
        self.assertIn("has no period FY30", result["nolabel"])
        self.assertIn("each { name, rationale }", result["premise"])
        self.assertEqual(result["absent"][0], ["i-gamma/depots"])  # a divisor nobody recorded is a missing input, named

    def test_units_compose_soundly_and_a_unit_nobody_says_is_reported(self):
        result = run_node(WIDE + """
import { runAnalyses, planProblems } from './skills/professional-slides/runtime/analysis.mjs';
import { composeUnit, isPercentUnit } from './skills/professional-slides/runtime/measures.mjs';
const { results } = runAnalyses({ analyses: [
  an({ id: 'A-per', op: 'ratio', inputs: ['i-alpha/depots', 'i-alpha/parcels'] }),
  an({ id: 'A-back', op: 'ratio', inputs: ['i-network/planned', 'A-per/result'], at: { 'A-per/result': 'FY26' } }),
  an({ id: 'A-domestic', op: 'product', inputs: ['i-market/domestic', 'i-market/total'] }),
  an({ id: 'A-odd', op: 'product', inputs: ['i-alpha/parcels', 'i-alpha/depots'] }),
  an({ id: 'A-named', op: 'product', inputs: ['i-alpha/parcels', 'i-alpha/depots'], unit: 'm depots-parcels', unitRationale: 'the plan names the composite for the appendix table' }),
  an({ id: 'A-bare', op: 'product', inputs: ['i-alpha/parcels', 'i-alpha/depots'], unit: 'm' }),
  an({ id: 'A-pct', op: 'product', inputs: ['i-alpha/parcels', 'i-alpha/depots'], percent: true }),
  an({ id: 'A-unlike', op: 'ratio', percent: true, inputs: ['i-alpha/parcels', 'i-alpha/depots'] }),
  an({ id: 'A-spread', op: 'gap', inputs: ['i-alpha/parcels', 'i-market/total'] }),
  an({ id: 'A-total', op: 'sum', inputs: ['i-network/planned'] }),
  an({ id: 'A-hole', op: 'sum', inputs: ['i-network/rented'] }),
  an({ id: 'A-points', op: 'sum', inputs: ['i-alpha/margin'] }),
  an({ id: 'A-units', op: 'sum', inputs: ['i-network/open', 'i-alpha/parcels'] }),
] }, insights);
const by = Object.fromEntries(results.map((r) => [r.id, r]));
const unit = (id) => by[id].measures?.result.unit ?? null;
console.log(JSON.stringify({ status: Object.fromEntries(results.map((r) => [r.id, r.status])),
  per: unit('A-per'), back: [unit('A-back'), by['A-back'].measures.result.values, by['A-back'].boundaries],
  domestic: [by['A-domestic'].measures.result.value, unit('A-domestic'), by['A-domestic'].boundaries],
  odd: [unit('A-odd'), by['A-odd'].boundaries], named: [unit('A-named'), by['A-named'].boundaries], bare: by['A-bare'].reason, pct: by['A-pct'].reason,
  unlike: by['A-unlike'].boundaries, spread: [by['A-spread'].measures.result.values, by['A-spread'].boundaries],
  total: [by['A-total'].measures.result.value, by['A-total'].measures.result.period], hole: by['A-hole'].reason, points: by['A-points'].reason, units: by['A-units'].reason,
  compose: [composeUnit(['depots'], ['depots per m']), composeUnit(['depots', 'm per depots']), composeUnit(['GBP m'], ['gbp m']), composeUnit(['crews a year', 'year']),
    composeUnit(['%', 'm'], [], { fractions: true }), composeUnit(['a', 'b'], ['c', 'd'])],
  percent: ['%', '% of revenue', 'percentage points', 'pp', 'GBP m', 'people'].map(isPercentUnit),
  plan: planProblems({ analyses: [an({ id: 'P1', op: 'ratio', inputs: ['a/b', 'c/d'], over: ['e/f'] }), an({ id: 'P2', op: 'gap', inputs: ['a/b', 'c/d'], at: 'FY26' }),
    an({ id: 'P3', op: 'gap', inputs: ['a/b', 'c/d'], at: { 'x/y': 'FY26' } }), an({ id: 'P4', op: 'product', inputs: ['a/b'] }), an({ id: 'P5', op: 'sum', inputs: ['a/b'] })] }) }));
""")
        self.assertEqual(result["status"], {"A-per": "computed", "A-back": "computed", "A-domestic": "computed", "A-odd": "computed", "A-named": "computed", "A-bare": "unavailable",
                                            "A-pct": "unavailable", "A-unlike": "computed", "A-spread": "computed", "A-total": "computed", "A-hole": "unavailable", "A-points": "unavailable", "A-units": "unavailable"})
        self.assertEqual(result["per"], "depots per m")
        # Depots over depots per m is m, never "depots per depots per m"; one value read at a label stands against every member, and says so.
        self.assertEqual(result["back"][:2], ["m", [12.5, 20, 37.5]])
        self.assertIn("A-per/result at FY26 is one value, set against each of the 3 members of i-network/planned", result["back"][2])
        # A percentage in a product is the fraction it is: 45% of 140 m is 63 m.
        self.assertEqual(result["domestic"], [63, "m", ["i-market/domestic is a percentage, applied as a fraction"]])
        self.assertEqual(result["odd"][0], "m x depots")
        self.assertTrue(any("does not simplify" in note and "`unitRationale`" in note for note in result["odd"][1]))  # a composed unit is never printed as if it were one
        self.assertEqual(result["named"][0], "m depots-parcels")
        self.assertTrue(any('stated by the plan (the inputs compose to "m x depots")' in note for note in result["named"][1]))
        self.assertIn("`unitRationale`", result["bare"])  # a stated unit needs its reason
        self.assertIn("not a bare number", result["pct"])
        self.assertTrue(any("percentage is of unlike units" in note for note in result["unlike"]))
        # A single value against a series is set against each period, and the result says it was.
        self.assertEqual(result["spread"], [[-100, -92, -90], ["i-alpha/parcels describes Alpha and i-market/total describes the home market: the result is across different populations",
                                                               "i-market/total is one value (2026), set against each of the 3 periods of i-alpha/parcels"]])
        self.assertEqual(result["total"], [280, "2026"])
        self.assertIn("a total with a part missing is not the total", result["hole"])
        self.assertIn("percentages of different periods do not add", result["points"])
        self.assertIn("a sum needs one unit", result["units"])
        self.assertEqual([c["unit"] for c in result["compose"]], ["m", "m", "ratio", "crews", "m", "a x b per c per d"])
        self.assertEqual([c["simple"] for c in result["compose"]], [True, True, True, True, True, False])
        self.assertEqual(result["compose"][4]["scale"], 0.01)
        self.assertEqual(result["percent"], [True, True, True, True, False, False])
        text = "\n".join(result["plan"])
        self.assertIn("P1: `over` lists the one to four measures a product is divided by", text)
        self.assertIn("P2: `at` says which value of an input to read", text)
        self.assertIn("P3: `at` says which value of an input to read", text)
        self.assertIn("P4: product reads 2 to 8 measures", text)
        self.assertNotIn("P5", text)  # one measure can be added up over its own axis

    def test_a_percentage_moves_in_points(self):
        # A margin going from 9.4% to -6.1% was reported as "-164.9%": a percentage of a percentage nobody can read.
        result = run_node(WIDE + """
import { runAnalyses } from './skills/professional-slides/runtime/analysis.mjs';
const { results } = runAnalyses({ analyses: [an({ id: 'A-swing', op: 'growth', inputs: ['i-alpha/margin'] }), an({ id: 'A-asked', op: 'growth', inputs: ['i-alpha/margin'], relative: true }),
  an({ id: 'A-vol', op: 'growth', inputs: ['i-alpha/parcels'] })] }, insights);
console.log(JSON.stringify(results.map((r) => [Object.fromEntries(Object.entries(r.measures).map(([name, m]) => [name, [m.value, m.unit]])), r.finding])));
""")
        swing, asked, pax = result
        self.assertEqual(swing[0], {"change": [-15.5, "percentage points"]})
        self.assertIn("-15.5 points", swing[1])
        self.assertNotIn("164", swing[1])
        # Asked for explicitly, the relative change is given, and labelled as what it is.
        self.assertEqual(asked[0]["percent"], [-164.893617, "% of the starting percentage"])
        # A measure that is not a percentage keeps its change, its percentage change and its rate.
        self.assertEqual(pax[0], {"change": [10, "m"], "percent": [25, "%"], "rate": [11.803399, "% a period"]})


class CatalogueTests(unittest.TestCase):
    """The analyses the measures allow, on the table before a critic asks for them."""

    def test_the_catalogue_lists_what_can_be_computed_as_plan_entries_with_their_findings(self):
        result = run_node(WIDE + """
import { analysisCatalogue, catalogueHint, planProblems, runAnalyses } from './skills/professional-slides/runtime/analysis.mjs';
const players = [{ name: 'Alpha' }, { name: 'Beta', aliases: ['Beta Air'] }, 'Gamma'];
const plan = { analyses: [an({ id: 'A-gap', op: 'gap', inputs: ['i-alpha/parcels', 'i-beta/parcels'] }), an({ id: 'A-cmp', op: 'compare', inputs: ['i-network/open'] })] };
const cat = analysisCatalogue(insights, { players, plan });
const entry = (id) => cat.entries.find((e) => e.entry.id === id);
// Every entry pastes into a plan once the author says what follows from it.
const pasted = { analyses: cat.entries.map((e) => an(e.entry)) };
// A log with one insight of nine like measures: the pairs are capped, and the catalogue says so.
const wide = [{ ...base, id: 'i-wide', shape: 'fact', measures: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`m${i}`, { unit: 'sites', population: 'the estate', period: '2026', value: i + 1 }])) }];
const capped = analysisCatalogue(wide);
console.log(JSON.stringify({ counts: cat.counts, ids: cat.entries.map((e) => e.entry.id), keys: [...new Set(cat.entries.flatMap((e) => Object.keys(e.entry)))].sort(),
  growth: [entry('C-growth-i-alpha-margin').finding, entry('C-growth-i-alpha-parcels').status],
  gap: [entry('C-gap-i-alpha-parcels-i-beta-parcels').inPlan, entry('C-ratio-i-alpha-parcels-i-beta-parcels').inPlan, entry('C-gap-i-alpha-parcels-i-beta-parcels').players],
  compare: [entry('C-compare-i-network-open-i-network-planned-i-network-rented').entry.inputs, entry('C-compare-i-network-open-i-network-planned-i-network-rented').inPlan],
  threshold: [entry('C-threshold-i-alpha-margin').entry.threshold, entry('C-threshold-i-alpha-margin').finding],
  pasted: [planProblems(pasted), runAnalyses(pasted, insights, { alternatives: ['Alpha', 'Beta', 'Gamma'] }).results.filter((r) => r.status === 'unavailable').length],
  hint: [catalogueHint(insights, { players, plan, stem: 'deck' }), catalogueHint(insights, { players, plan: { analyses: [plan.analyses[1]] }, stem: 'deck' }), catalogueHint(insights, { players: [], plan: null })],
  capped: [capped.counts.entries, capped.capped], none: analysisCatalogue([]).counts.entries }));
""")
        counts = result["counts"]
        self.assertEqual(counts["byOp"], {"compare": 1, "gap": 4, "ratio": 4, "growth": 4, "rank": 2, "threshold": 1})
        self.assertEqual([counts["entries"], counts["inPlan"], counts["cannotRun"]], [16, 2, 0])
        self.assertEqual(len(set(result["ids"])), 16)
        self.assertEqual(result["keys"], ["id", "inputs", "op", "threshold"])  # what follows from each is the author's to say: no entry carries a soWhat
        # Growth over the full span for every series - in points for a percentage.
        self.assertIn("-15.5 points", result["growth"][0])
        self.assertEqual(result["growth"][1], "computed")
        # One quantity for two players, across two insights: the gap is in the plan already, the ratio is not.
        self.assertEqual(result["gap"], [["A-gap"], [], True])
        self.assertEqual(result["compare"], [["i-network/open", "i-network/planned", "i-network/rented"], ["A-cmp"]])
        # A threshold is proposed only against a value the log marks as a standard, never against one guessed from its name.
        self.assertEqual(result["threshold"][0], {"ref": "i-market/floor"})
        self.assertIn("breached by 11.1", result["threshold"][1])
        self.assertEqual(result["pasted"], [[], 0])
        used, unused, none = result["hint"]
        self.assertIsNone(used)  # the plan already runs one of the analyses about the players
        self.assertIn("node runtime/analysis.mjs deck.pages.json --catalogue", unused)
        self.assertIsNone(none)
        # Thirty-six pairs of nine like measures are seventy-two entries; six are listed and the rest are said to be left out.
        self.assertEqual(result["capped"][0], 6)
        self.assertEqual(len(result["capped"][1]), 1)
        self.assertIn("i-wide: 66 more gaps and ratios", result["capped"][1][0])
        self.assertEqual(result["none"], 0)

    def test_the_cli_prints_the_catalogue_and_the_draft_points_to_it(self):
        runtime = ROOT / "skills/professional-slides/runtime"
        with tempfile.TemporaryDirectory() as tmp:
            for name in ("finance.pages.json", "finance.insights.json", "finance.analysis.json"):
                (Path(tmp) / name).write_text((FIXTURES / name).read_text(encoding="utf-8"), encoding="utf-8")
            run = subprocess.run([NODE, str(runtime / "analysis.mjs"), str(Path(tmp) / "finance.pages.json"), "--catalogue"], capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            out = json.loads(run.stdout)
            self.assertFalse((Path(tmp) / "finance.analysis-results.json").exists(), "the catalogue is read, nothing is written")
            by_inputs = {(e["entry"]["op"], tuple(e["entry"]["inputs"])): e for e in out["entries"]}
            # The plan's own gap and comparison are marked as already run; growth is offered over every series.
            self.assertEqual(by_inputs[("gap", ("i-liquidity/liquid", "i-liquidity/short-liabilities"))]["inPlan"], ["A-cushion"])
            self.assertEqual(by_inputs[("compare", ("i-peers/margin", "i-peers/loan-growth", "i-peers/liquidity-cover", "i-peers/capital"))]["inPlan"], ["A-peers"])
            self.assertEqual(sum(1 for e in out["entries"] if e["entry"]["op"] == "growth"), 9)
            self.assertTrue(all(e["status"] in ("computed", "assumed") and e["finding"] for e in out["entries"]))
            self.assertEqual(out["catalogue"]["entries"], len(out["entries"]))
            # A plan that only compares the players: the draft's summary says what else the measures allow.
            plan = json.loads((Path(tmp) / "finance.analysis.json").read_text(encoding="utf-8"))
            plan["analyses"] = [a for a in plan["analyses"] if a["op"] == "compare"]
            (Path(tmp) / "finance.analysis.json").write_text(json.dumps(plan), encoding="utf-8")
            pages = json.loads((Path(tmp) / "finance.pages.json").read_text(encoding="utf-8"))
            # The pages that name a dropped analysis - in `evidence`, a bound series or a token - go with it: a reference to an analysis nobody runs is refused in a draft too.
            dropped = lambda page: any(not ref.startswith("A-peers") for ref in re.findall(r"A-[\w-]+", json.dumps(page)))
            pages["pages"] = [page for page in pages["pages"] if not dropped(page)]
            # A draft refuses a new deck that does not open on its executive summary - a page of the argument, which the critique
            # is bound to - so the cut deck keeps one: the fixture's, resting on the comparison alone, its table still to be drawn.
            summary_page = {"id": "f0", "type": "summary", "form": "executive-summary", "commentary": "none", "title": "Harbour grows faster than its peers on thinner liquidity: funding comes first",
                            "why": "The reader needs the answer before the evidence for it", "evidence": ["A-peers"], "exhibit": {}}
            pages["pages"] = [summary_page, *pages["pages"]]
            (Path(tmp) / "finance.pages.json").write_text(json.dumps(pages), encoding="utf-8")
            draft = subprocess.run([NODE, str(runtime / "author-deck.mjs"), str(Path(tmp) / "finance.pages.json"), "--draft", "--check"], capture_output=True, text=True)
            summary = json.loads(draft.stdout) if draft.stdout.strip() else {}
            self.assertIn("--catalogue", summary.get("catalogue", ""), draft.stderr[-800:])


class InsightLogPartsTests(unittest.TestCase):
    """A log extracted by several workers at once: parts merged, ids refused twice, one measure recorded twice reported."""

    def test_parts_merge_into_one_log_and_a_measure_recorded_twice_is_a_finding(self):
        result = run_node(f"""
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {{ compileDeck, readInsights }} from './skills/professional-slides/runtime/author-deck.mjs';
import {{ alternativesOf }} from './skills/professional-slides/runtime/analysis.mjs';
import {{ readInsightLog, measureConflicts }} from './skills/professional-slides/runtime/measures.mjs';
import * as S from './skills/professional-slides/runtime/storyline.mjs';
const FIX = '{FIXTURES}';
const load = (name) => JSON.parse(fs.readFileSync(path.join(FIX, name), 'utf8'));
const whole = load('finance.insights.json'), doc = load('finance.pages.json');
const stage = (parts, own = []) => {{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parts-'));
  fs.mkdirSync(path.join(dir, 'insights'));
  fs.copyFileSync(path.join(FIX, 'finance.analysis.json'), path.join(dir, 'finance.analysis.json'));
  for (const [name, items] of Object.entries(parts)) fs.writeFileSync(path.join(dir, 'insights', name), JSON.stringify({{ insights: items }}));
  fs.writeFileSync(path.join(dir, 'finance.insights.json'), JSON.stringify({{ schema: whole.schema, include: Object.keys(parts).map((name) => `insights/${{name}}`), insights: own }}));
  return dir;
}};
const read = (dir) => readInsights(dir, 'finance', {{ alternatives: alternativesOf(doc.deck) }});
const refused = (dir) => read(dir).then(() => null, (error) => error.message);
const spine = async (dir) => compileDeck(doc, {{ insights: await read(dir), draft: true, partial: true }}).spineFindings.filter((f) => f.code === 'MEASURES_CONFLICT');
const [a, b, c] = [whole.insights.slice(0, 2), whole.insights.slice(2, 4), whole.insights.slice(4)];
const single = await readInsights(FIX, 'finance', {{ alternatives: alternativesOf(doc.deck) }});
const split = stage({{ 'subject.json': b, 'peers.json': c }}, a);
const merged = await read(split);
// The storyline's packet is built from the same merged log: the analyses it shows are the single log's.
const packetOf = async (dir) => {{
  const out = path.join(dir, 'out'); fs.mkdirSync(out, {{ recursive: true }}); fs.mkdirSync(path.join(dir, 'sources'), {{ recursive: true }});
  for (const item of whole.insights) for (const file of item.sources) fs.writeFileSync(path.join(dir, file), 'illustrative');
  const specPath = path.join(dir, 'finance.deck.json');
  fs.writeFileSync(specPath, JSON.stringify(compileDeck(doc, {{ insights: await read(dir), draft: true, partial: true }}).spec));
  const step = await S.prepareStoryline(specPath, out);
  return JSON.parse(fs.readFileSync(path.join(step.dir, 'packet.json'), 'utf8'));
}};
const wholeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parts-'));
for (const file of ['finance.insights.json', 'finance.analysis.json']) fs.copyFileSync(path.join(FIX, file), path.join(wholeDir, file));
const [packetWhole, packetSplit] = [await packetOf(wholeDir), await packetOf(split)];
// Two workers record one measure: the same numbers, the same number at another precision, and another number.
const again = (edit) => {{ const copy = structuredClone(whole.insights.find((i) => i.id === 'i-cash')); copy.id = 'i-cash-again'; edit(copy.measures.ocf); return copy; }};
const conflict = async (edit) => {{ const dir = stage({{ 'one.json': whole.insights, 'two.json': [again(edit)] }}); const found = await spine(dir); return found.map((f) => [f.severity, f.pages, f.repair]); }};
const same = await conflict(() => {{}});
const rounded = await conflict((m) => {{ m.values = m.values.map((v, i) => (i === 0 ? v + 0.04 : v)); }});
const apart = await conflict((m) => {{ m.values = m.values.map((v, i) => (i === 7 ? v + 9 : v)); }});
const renamed = await conflict((m) => {{ m.population = 'Harbour Credit Union, statutory basis'; m.values = m.values.map((v) => v + 9); }});
// A revision recorded under the rules before the check hears the contradiction as advice.
const olderDir = stage({{ 'one.json': whole.insights, 'two.json': [again((m) => {{ m.values = m.values.map((v, i) => (i === 7 ? v + 9 : v)); }})] }});
const older = compileDeck({{ ...doc, deck: {{ ...doc.deck, workflow: 'existing_deck_revision', rulesVersion: 4, inventory: 'x.inventory.json' }} }}, {{ insights: await read(olderDir), draft: true, partial: true }}).spineFindings.filter((f) => f.code === 'MEASURES_CONFLICT');
console.log(JSON.stringify({{
  ids: [[...single.keys()], [...merged.keys()]], parts: (await readInsightLog(split, 'finance')).parts, where: [merged.get('i-loans').part ?? null, merged.get('i-earn').part, merged.get('i-peers').part],
  analyses: [single.analysis.results.map((r) => [r.id, r.status, r.finding]), merged.analysis.results.map((r) => [r.id, r.status, r.finding])], clean: (await spine(split)).length,
  packet: [packetWhole.analyses.map((x) => x.line), packetSplit.analyses.map((x) => x.line), packetWhole.pages.length === packetSplit.pages.length],
  twice: await refused(stage({{ 'one.json': [...a, ...b], 'two.json': [...b.slice(0, 1), ...c] }})),
  absent: await refused((() => {{ const dir = stage({{ 'one.json': whole.insights }}); fs.rmSync(path.join(dir, 'insights', 'one.json')); return dir; }})()),
  nested: await refused((() => {{ const dir = stage({{ 'one.json': whole.insights }}); fs.writeFileSync(path.join(dir, 'insights', 'one.json'), JSON.stringify({{ include: ['x.json'], insights: [] }})); return dir; }})()),
  shape: await refused((() => {{ const dir = stage({{ 'one.json': whole.insights }}); fs.writeFileSync(path.join(dir, 'finance.insights.json'), JSON.stringify({{ include: 'insights/one.json' }})); return dir; }})()),
  same, rounded, apart, renamed, older: older.map((f) => [f.severity, f.waived]),
  direct: measureConflicts([...whole.insights, again((m) => {{ m.values = m.values.map((v, i) => (i === 7 ? v + 9 : v)); }})]).map((x) => [x.kind, x.refs, x.at.map((cell) => cell.label)]) }}));
""")
        single, merged = result["ids"]
        self.assertEqual(merged, single)  # the parts, merged in the order listed after the log's own insights, are the one log
        self.assertEqual(result["parts"], [{"file": "insights/subject.json", "insights": 2}, {"file": "insights/peers.json", "insights": 4}])
        self.assertEqual(result["where"], [None, "insights/subject.json", "insights/peers.json"])
        self.assertEqual(result["analyses"][1], result["analyses"][0])  # and the analyses computed over it are the same
        self.assertEqual(result["clean"], 0)
        whole_lines, split_lines, same_pages = result["packet"]
        self.assertEqual(split_lines, whole_lines)  # the critic's packet reads the merged log too
        self.assertTrue(whole_lines and same_pages)
        # An id recorded by two workers is refused, with both places.
        self.assertIn("i-earn is recorded in insights/one.json and in insights/two.json", result["twice"])
        self.assertIn("the part insights/one.json is not beside the log", result["absent"])
        self.assertIn("a part does not include other parts", result["nested"])
        self.assertIn("`include` lists the parts of the log as paths beside it", result["shape"])
        # The same measure recorded twice: an advisory to keep one, where the two agree or differ only in rounding.
        self.assertEqual([[f[0], f[1]] for f in result["same"]], [["advisory", ["i-cash", "i-cash-again"]]])
        self.assertIn("i-cash/ocf (insights/one.json) and i-cash-again/ocf (insights/two.json)", result["same"][0][2])
        self.assertEqual([f[0] for f in result["rounded"]], ["advisory"])
        self.assertIn("at different precision", result["rounded"][0][2])
        # Two records that hold different numbers for one period block: a page would rest on whichever was named.
        self.assertEqual([f[0] for f in result["apart"]], ["blocker"])
        self.assertIn("fy26", result["apart"][0][2].lower())
        self.assertIn("keep the number it gives", result["apart"][0][2])
        self.assertEqual(result["renamed"], [])  # another population is another measure: the repair the message offers clears the finding
        self.assertEqual(result["older"], [["advisory", {"rulesVersion": 4, "introducedIn": 5}]])
        self.assertEqual(result["direct"], [["contradiction", ["i-cash/ocf", "i-cash-again/ocf"], ["fy26"]]])

    def test_the_analysis_cli_reads_a_log_in_parts(self):
        with tempfile.TemporaryDirectory() as tmp:
            whole = json.loads((FIXTURES / "finance.insights.json").read_text(encoding="utf-8"))
            (Path(tmp) / "insights").mkdir()
            (Path(tmp) / "insights" / "a.json").write_text(json.dumps({"insights": whole["insights"][:3]}), encoding="utf-8")
            (Path(tmp) / "insights" / "b.json").write_text(json.dumps({"insights": whole["insights"][3:]}), encoding="utf-8")
            (Path(tmp) / "finance.insights.json").write_text(json.dumps({"include": ["insights/a.json", "insights/b.json"]}), encoding="utf-8")
            for name in ("finance.pages.json", "finance.analysis.json"):
                (Path(tmp) / name).write_text((FIXTURES / name).read_text(encoding="utf-8"), encoding="utf-8")
            cli = [NODE, str(ROOT / "skills/professional-slides/runtime/analysis.mjs"), str(Path(tmp) / "finance.pages.json")]
            run = subprocess.run(cli, capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual(json.loads(run.stdout)["unavailable"], [])
            (Path(tmp) / "insights" / "b.json").write_text(json.dumps({"insights": whole["insights"][2:]}), encoding="utf-8")
            twice = subprocess.run(cli, capture_output=True, text=True)
            self.assertEqual(twice.returncode, 2)
            self.assertIn("is recorded in insights/a.json and in insights/b.json", twice.stderr)


class OutlineTests(unittest.TestCase):
    """What holds before the outline: the spine rules, in a draft as in the full compile."""

    def test_a_log_of_sentences_and_a_comparison_never_run_are_refused_in_a_draft(self):
        result = run_node(f'''
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {{ compileDeck, readInsights, authorDeck }} from './skills/professional-slides/runtime/author-deck.mjs';
import {{ alternativesOf }} from './skills/professional-slides/runtime/analysis.mjs';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outline-'));
const load = (name) => JSON.parse(fs.readFileSync(path.join('{FIXTURES}', name), 'utf8'));
const stage = (name, {{ insights = load(`${{name}}.insights.json`), analysis = true }} = {{}}) => {{
  fs.writeFileSync(path.join(dir, `${{name}}.insights.json`), JSON.stringify(insights));
  if (analysis && fs.existsSync(path.join('{FIXTURES}', `${{name}}.analysis.json`))) fs.copyFileSync(path.join('{FIXTURES}', `${{name}}.analysis.json`), path.join(dir, `${{name}}.analysis.json`));
  else fs.rmSync(path.join(dir, `${{name}}.analysis.json`), {{ force: true }});
}};
const spine = async (name, options) => {{ stage(name, options); const doc = load(`${{name}}.pages.json`);
  const insights = await readInsights(dir, name, {{ alternatives: alternativesOf(doc.deck) }});
  return compileDeck(doc, {{ insights, draft: true, partial: true }}).spineFindings.map((f) => [f.code, f.severity]); }};
const sentences = load('finance.insights.json'); for (const item of sentences.insights) delete item.measures;
const finance = load('finance.pages.json');
stage('finance', {{ insights: sentences, analysis: false }});
const prose = compileDeck(finance, {{ insights: await readInsights(dir, 'finance', {{ alternatives: alternativesOf(finance.deck) }}), draft: true, partial: true }}).spineFindings;
// A revision recorded under the rules before the contract hears it as advice.
stage('finance', {{ analysis: false }});
const older = compileDeck({{ ...finance, deck: {{ ...finance.deck, workflow: 'existing_deck_revision', rulesVersion: 3, inventory: 'x.inventory.json' }} }},
  {{ insights: await readInsights(dir, 'finance', {{ alternatives: alternativesOf(finance.deck) }}), draft: true, partial: true }}).spineFindings;
// A comparison over a measure that holds none of the declared players has not compared them.
const junk = load('finance.insights.json');
junk.insights.push({{ id: 'i-junk', finding: 'Two others differ on a count', shape: 'fact', calculation: 'a count for two others', sources: ['sources/i-junk.csv'], soWhat: 'It bears directly on nothing the deck decides', strength: 'context',
  measures: {{ count: {{ unit: 'items', population: 'two others', period: 'FY26', members: ['Zed', 'Why'], values: [1, 2] }} }} }});
fs.writeFileSync(path.join(dir, 'finance.insights.json'), JSON.stringify(junk));
fs.writeFileSync(path.join(dir, 'finance.analysis.json'), JSON.stringify({{ analyses: [{{ id: 'A-junk', op: 'compare', inputs: ['i-junk/count'], soWhat: 'Two others set side by side', strength: 'context' }}] }}));
const unplaced = compileDeck(finance, {{ insights: await readInsights(dir, 'finance', {{ alternatives: alternativesOf(finance.deck) }}), draft: true, partial: true }}).spineFindings.filter((f) => f.code === 'ANALYSIS_REQUIRED');
stage('finance');
const derived = await readInsights(dir, 'finance', {{ alternatives: alternativesOf(finance.deck) }});
console.log(JSON.stringify({{ clean: await spine('finance'), noAnalysis: await spine('finance', {{ analysis: false }}), prose: prose.map((f) => [f.code, f.pages?.length ?? 0]),
  proseRepair: prose[0].repair, unplaced: unplaced.map((f) => [f.severity, f.measured.compared, f.measured.unplaced.length]), older: older.filter((f) => f.code === 'ANALYSIS_REQUIRED').map((f) => [f.severity, f.waived]),
  explainer: await spine('explainer'), ops: await spine('public-ops'), derived: [derived.get('A-peers').shape, derived.get('A-peers').derived, derived.analysis.results.length] }}));
fs.rmSync(dir, {{ recursive: true, force: true }});
''')
        self.assertEqual(result["clean"], [])
        # Eight declared players and no computed comparison: refused before the outline.
        self.assertEqual(result["noAnalysis"], [["ANALYSIS_REQUIRED", "blocker"]])
        self.assertEqual(result["unplaced"], [["blocker", ["A-junk"], 8]])  # run, and none of the eight players is in it
        self.assertEqual(result["prose"], [["MEASURES_MISSING", 8]])
        self.assertIn("as data", result["proseRepair"])
        self.assertEqual(result["older"], [["advisory", {"rulesVersion": 3, "introducedIn": 4}]])
        # A deck that compares nothing is not asked for a matrix, and one service with no players is not either.
        self.assertEqual(result["explainer"], [])
        self.assertEqual(result["ops"], [])
        self.assertEqual(result["derived"], ["roster", True, 11])


class DependencyTests(unittest.TestCase):
    def test_seeded_defects_are_caught_on_the_fixture_decks_and_clean_decks_raise_nothing(self):
        result = run_node('''
import { measure, SEEDED } from './evals/quality/evidence-validity.mjs';
const out = await measure();
console.log(JSON.stringify({ accepted: out.accepted, clean: out.clean.map((d) => [d.deck, d.pages, d.findings]), seeded: Object.entries(out.seeded).map(([name, d]) => [name, d.planted, d.caught, d.missed]), defects: Object.keys(SEEDED).length }));
''')
        self.assertEqual([deck for deck, _, _ in result["clean"]], ["explainer", "finance", "product", "public-ops"])
        for deck, pages, findings in result["clean"]:
            # Advisories count: a typed number the trace cannot place on a clean deck is a false positive too.
            self.assertEqual(findings, [], f"{deck} is a clean deck: a finding on it is a false positive")
        # The seventeen ways an exhibit disagrees with its page, a typed table cell and a typed sentence number changed
        # (once known limits, now traced), and two references that cannot be bound.
        self.assertEqual(result["defects"], 21)
        for name, planted, caught, missed in result["seeded"]:
            with self.subTest(defect=name):
                self.assertGreater(planted, 0, "no fixture page takes this defect")
                self.assertEqual(caught, planted, missed)
        self.assertTrue(result["accepted"])

    def test_a_chart_copied_onto_another_claim_is_refused_in_each_dress_the_contract_reads(self):
        # The benchmark's defect, step by step, on a fixture deck of another subject: the copy, then
        # each way an author might try to make the copy pass.
        result = run_node(f'''
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import {{ readInsights }} from './skills/professional-slides/runtime/author-deck.mjs';
import {{ measureProblems }} from './skills/professional-slides/runtime/measures.mjs';
import {{ dependencyFindings }} from './skills/professional-slides/runtime/gates/dependency_gates.mjs';
import {{ alternativesOf }} from './skills/professional-slides/runtime/analysis.mjs';
const doc = JSON.parse(fs.readFileSync(path.join('{FIXTURES}', 'finance.pages.json'), 'utf8'));
const insights = await readInsights('{FIXTURES}', 'finance', {{ alternatives: alternativesOf(doc.deck) }});
const codes = (mutate) => {{ const d = structuredClone(doc); mutate(d.pages.find((p) => p.id === 'f2'), d); return dependencyFindings(d, insights).filter((f) => f.id === 'f2').map((f) => f.code); }};
const branches = (d) => structuredClone(d.pages.find((p) => p.id === 'f4').exhibits[1]);
// The same deck with one more analysis in its plan: branches indexed beside cash flow, to try the index's output as proof of a cash-flow claim.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'launder-'));
for (const file of ['finance.insights.json', 'finance.analysis.json']) fs.copyFileSync(path.join('{FIXTURES}', file), path.join(tmp, file));
const plan = JSON.parse(fs.readFileSync(path.join(tmp, 'finance.analysis.json'), 'utf8'));
plan.analyses.push({{ id: 'A-x', op: 'index', inputs: ['i-efficiency/branches', 'i-cash/ocf'], soWhat: 'Branches and cash flow on one base', strength: 'context' }});
fs.writeFileSync(path.join(tmp, 'finance.analysis.json'), JSON.stringify(plan));
const widened = await readInsights(tmp, 'finance', {{ alternatives: alternativesOf(doc.deck) }});
const indexed = widened.get('A-x').measures.branches;
const laundered = (() => {{ const d = structuredClone(doc); const p = d.pages.find((x) => x.id === 'f2');
  p.exhibit = {{ heading: 'Branches, indexed', unit: indexed.unit, categories: indexed.periods, series: [{{ name: 'Branches', values: indexed.values }}], basis: {{ measures: ['A-x/branches'], role: 'proof' }} }};
  p.evidence.push('A-x'); return dependencyFindings(d, widened).filter((f) => f.id === 'f2').map((f) => f.code); }})();
fs.rmSync(tmp, {{ recursive: true, force: true }});
const onPage = (id, mutate) => {{ const d = structuredClone(doc); mutate(d.pages.find((p) => p.id === id), d); return dependencyFindings(d, insights).filter((f) => f.id === id).map((f) => f.code); }};
console.log(JSON.stringify({{
  clean: codes(() => {{}}),
  copied: codes((p, d) => {{ p.exhibit = {{ ...branches(d), basis: {{ measures: ['i-efficiency/branches'], role: 'proof' }} }}; p.evidence.push('i-efficiency'); }}),
  relabelled: codes((p, d) => {{ p.exhibit = {{ ...branches(d), basis: {{ measures: ['i-cash/ocf'], role: 'proof' }} }}; }}),
  beside: codes((p, d) => {{ p.exhibit = {{ ...branches(d), basis: {{ measures: ['i-cash/ocf', 'i-efficiency/branches'], role: 'proof' }} }}; p.evidence.push('i-efficiency'); }}),
  laundered,
  handLineage: measureProblems({{ id: 'i-x', inputs: ['i-cash/ocf'], measures: {{ m: {{ unit: 'GBP m', population: 'p', period: 'FY26', value: 1 }} }} }}).length,
  metric: codes((p) => {{ p.metrics[0].value = '+43%'; }}),
  // One point of the claim's measure added to the copied chart, and the two measures on one scale in two units.
  onePoint: onPage('f1', (p, d) => {{ const b = branches(d); p.exhibit = {{ ...b, series: [...b.series, {{ name: 'Loans', values: [null, null, null, null, null, null, null, 648] }}], basis: {{ measures: ['i-loans/loans', 'i-efficiency/branches'], role: 'proof' }} }}; p.evidence.push('i-efficiency'); }}),
  twoUnits: onPage('f1', (p, d) => {{ const b = branches(d); p.exhibit = {{ ...p.exhibit, series: [...p.exhibit.series, ...b.series], basis: {{ measures: ['i-loans/loans', 'i-efficiency/branches'], role: 'proof' }} }}; p.evidence.push('i-efficiency'); }}),
  // What a metric prints: a unit letter is read, a sign is held, the first number is the one stated, a label is not a number.
  metrics: Object.fromEntries(['4.3pp', '+4.3%', '-4.3%', '999x', '+900% (FY25: 47)', 'FY26', '4.26'].map((value) => [value, codes((p) => {{ p.metrics[0].value = value; }})])),
  // The peer margins drawn as a ranking, each rounded to a whole number.
  rounded: onPage('f5', (p) => {{ Object.assign(p, {{ type: 'ranking', form: 'bar', commentary: 'none', settles: {{ kind: 'rank', what: 'net interest margin across eight credit unions', measures: ['A-peers/margin'] }},
    exhibit: {{ heading: 'Net interest margin, FY26', unit: '%', categories: ['Northgate', 'Castlefield', 'Ferrybridge', 'Harbour', 'Eastbank', 'Millrace', 'Greyfriars', 'Dunmore'],
      series: [{{ name: 'Margin', values: [3.4, 3.1, 3.0, 2.9, 2.8, 2.6, 2.4, 2.2].map((v) => Math.round(v)) }}], basis: {{ measures: ['A-peers/margin'], role: 'proof' }} }} }}); }}),
  tableUnshown: onPage('f0', (p) => {{ p.exhibit.basis.measures.push('i-peers/loan-growth'); }}),
  tableCell: onPage('f0', (p) => {{ p.exhibit.rows[0][2] = '999m'; }}),
  undeclared: codes((p, d) => {{ p.exhibit = branches(d); delete p.exhibit.basis; p.evidence.push('i-efficiency'); }}),
  asContext: codes((p, d) => {{ p.exhibit = branches(d); p.evidence.push('i-efficiency'); }}),
  contextNoMetrics: codes((p, d) => {{ p.exhibit = branches(d); p.evidence.push('i-efficiency'); for (const m of p.metrics) {{ delete m.basis; if (m.measure) {{ delete m.measure; delete m.format; m.value = '-21.4%'; }} }} }}),
  typedSource: codes((p) => {{ p.source = 'Source: annual report (i-cash)'; }}),
  message: (() => {{ const d = structuredClone(doc); const p = d.pages.find((x) => x.id === 'f2'); p.exhibit = {{ ...branches(d), basis: {{ measures: ['i-efficiency/branches'], role: 'proof' }} }}; p.evidence.push('i-efficiency');
    return dependencyFindings(d, insights).find((f) => f.code === 'PROOF_OFF_CLAIM').repair; }})() }}));
''')
        self.assertEqual(result["clean"], [])
        self.assertEqual(result["copied"], ["PROOF_OFF_CLAIM"])
        self.assertIn("the claim is about i-cash/ocf, i-earn/pat", result["message"])
        self.assertEqual(sorted(set(result["relabelled"])), ["BASIS_UNIT", "BASIS_VALUES"])  # branches are not GBP m, nor the cash-flow numbers, whatever the basis says
        # Naming the claim's measure beside the one drawn does not make the chart its proof.
        self.assertEqual(result["beside"], ["BASIS_UNIT", "BASIS_VALUES"])
        # An index of branches computed beside cash flow is still about branches.
        self.assertEqual(result["laundered"], ["PROOF_OFF_CLAIM"])
        self.assertEqual(result["handLineage"], 1)  # the log cannot say what a measure is computed from
        self.assertEqual(result["metric"], ["BASIS_VALUES"])  # a metric prints a number of its measure
        self.assertEqual(result["onePoint"], ["BASIS_UNIT", "BASIS_VALUES"])  # one point of the claim's measure is not the measure drawn
        self.assertEqual(result["twoUnits"], ["BASIS_UNIT"])  # one scale, one unit
        self.assertEqual(result["metrics"], {"4.3pp": [], "+4.3%": [], "4.26": [], "FY26": [],
                                             "-4.3%": ["BASIS_VALUES"], "999x": ["BASIS_VALUES"], "+900% (FY25: 47)": ["BASIS_VALUES"]})
        self.assertEqual(result["rounded"], ["BASIS_VALUES"])  # 3.4 drawn as 3
        self.assertEqual(result["tableUnshown"], ["BASIS_VALUES"])  # a table names only the measures it shows
        # One changed cell of a table is no value of a measure the page rests on: reported, as advice.
        self.assertEqual(result["tableCell"], ["NUMBER_UNTRACED"])
        self.assertEqual(result["undeclared"], ["BASIS_MISSING"])
        # As declared context it stays, with its reason, for the reviewer to judge: the metrics still prove the claim.
        self.assertEqual(result["asContext"], [])
        self.assertEqual(result["contextNoMetrics"], ["PROOF_MISSING"])
        self.assertEqual(result["typedSource"], ["SOURCE_UNCITED"])

    def test_the_dependencies_are_set_aside_for_the_composer_and_kept_for_the_critique(self):
        result = run_node(f'''
import fs from 'node:fs'; import path from 'node:path';
import {{ compileDeck, readInsights, withoutDependencies }} from './skills/professional-slides/runtime/author-deck.mjs';
import {{ storylineBinding, storyStructure }} from './skills/professional-slides/runtime/storyline.mjs';
import {{ alternativesOf }} from './skills/professional-slides/runtime/analysis.mjs';
import {{ DEPENDENCY_CODES }} from './skills/professional-slides/runtime/gates/dependency_gates.mjs';
import {{ RULES }} from './skills/professional-slides/runtime/weight.mjs';
const doc = JSON.parse(fs.readFileSync(path.join('{FIXTURES}', 'finance.pages.json'), 'utf8'));
const insights = await readInsights('{FIXTURES}', 'finance', {{ alternatives: alternativesOf(doc.deck) }});
const spec = (d) => compileDeck(d, {{ insights, partial: true }}).spec;
const base = spec(doc);
const f4 = base.slides.find((s) => s.id === 'f4'), f2 = base.slides.find((s) => s.id === 'f2');
const pageOf = (d, id) => d.pages.find((p) => p.id === id);
const reworded = structuredClone(doc); pageOf(reworded, 'f4').exhibits[1].caption = 'A different caption of eight words or more, reworded only';
const rebased = structuredClone(doc); pageOf(rebased, 'f4').exhibits[1].basis.role = 'proof'; delete pageOf(rebased, 'f4').exhibits[1].basis.relevance;
const redrawn = structuredClone(doc); pageOf(redrawn, 'f4').form = 'stack'; pageOf(redrawn, 'f4').exhibits[1].type = 'chart.bar';
const bare = structuredClone(pageOf(doc, 'f1')); bare.settles = {{ measures: ['i-loans/loans'] }};
const stripped = withoutDependencies(bare);
console.log(JSON.stringify({{ leaked: JSON.stringify(base.slides).includes('"basis"') && !JSON.stringify(base.slides.map((s) => ({{ ...s, pageType: null }}))).includes('"basis"'),
  inSlide: JSON.stringify(base.slides.map((s) => ({{ ...s, pageType: null }}))).includes('"basis"'),
  kept: f4.pageType.dependencies.exhibits.map((b) => b.role), metrics: f2.pageType.dependencies.metrics.length, claim: f2.pageType.content.settles.measures,
  source: [f2.source, f4.source], bound: storyStructure(base).find((p) => p.id === 'f4').shows,
  sameWhenReworded: storylineBinding(spec(reworded)) === storylineBinding(base), sameWhenRedrawn: [spec(redrawn).slides.find((s) => s.id === 'f4').pageType.form, storylineBinding(spec(redrawn)) === storylineBinding(base)], changedWhenRebased: storylineBinding(spec(rebased)) !== storylineBinding(base),
  derivedSettles: [stripped.page.settles, stripped.dependencies.claim], versioned: Object.keys(DEPENDENCY_CODES).every((code) => RULES.introduced['4'].includes(code)) }}));
''')
        self.assertFalse(result["inSlide"])  # `basis` is the author's statement, not a prop the composer draws
        self.assertEqual(result["kept"], ["proof", "context"])
        self.assertEqual(result["metrics"], 2)
        self.assertEqual(result["claim"], ["i-cash/ocf", "i-earn/pat"])
        # No page typed a citation: each is written from the insights it plots.
        self.assertEqual(result["source"], ["Source: Harbour Credit Union annual report 2026 (illustrative)"] * 2)
        # The claim's measure as proof, and what the second exhibit adds as context: which exhibit draws which is the layout's.
        self.assertEqual(result["bound"], ["context:i-efficiency/branches", "proof:i-efficiency/cost-income"])
        self.assertEqual(result["sameWhenRedrawn"], ["stack", True])  # another form and chart type on the same measures
        self.assertTrue(result["sameWhenReworded"])  # a caption is copy
        self.assertTrue(result["changedWhenRebased"])  # what an exhibit is on the page to do is the argument
        self.assertEqual(result["derivedSettles"], [None, {"measures": ["i-loans/loans"]}])  # the insights supply the kind
        self.assertTrue(result["versioned"])


class RelationTests(unittest.TestCase):
    def test_two_measures_a_reader_must_subtract_are_set_on_one_scale(self):
        # "Cash growth has nearly closed the debt gap" over a cash chart and a
        # liabilities chart: the gap was in the title and in neither panel.
        result = run_node(LOG + '''
import { dependencyFindings, relationRepair, RELATION_KINDS } from './skills/professional-slides/runtime/gates/dependency_gates.mjs';
const log = new Map(insights.map((i) => [i.id, i]));
const panel = (name, measure, values) => ({ type: 'chart.line', heading: name, unit: measure === 'staff' ? 'people' : 'GBP m', categories: FY, series: [{ name, values }], caption: `${name} at each year end`, basis: { measures: [`i-bal/${measure}`] } });
const page = (settles, exhibits = [panel('Cash', 'cash', [15, 21, 37, 43, 50, 55]), panel('Debt', 'debt', [108, 96, 82, 68, 58, 56])]) =>
  ({ id: 'p1', type: 'panels', form: 'row', evidence: ['i-bal'], settles: { kind: 'comparison', what: 'cash and debt', measures: ['i-bal/cash', 'i-bal/debt'], ...settles }, exhibits });
const codes = (p) => dependencyFindings({ pages: [p] }, log).map((f) => f.code);
const repair = relationRepair(page({ relation: { kind: 'gap' } }), log);
const merged = { ...page({ relation: { kind: 'gap' } }), exhibits: undefined, exhibit: repair.exhibit };
const units = page({ measures: ['i-bal/cash', 'i-bal/staff'] }, [panel('Cash', 'cash', [15, 21, 37, 43, 50, 55]), panel('Staff', 'staff', [900, 950, 990, 1010, 1040, 1100])]);
console.log(JSON.stringify({ undeclared: codes(page({})), split: codes(page({ relation: { kind: 'gap' } })), unreasoned: codes(page({ relation: { kind: 'separate' } })),
  separate: codes(page({ relation: { kind: 'separate', reason: 'Each balance is looked up on its own by the treasury team' } })),
  unknown: codes(page({ relation: { kind: 'vibes' } })), merged: codes(merged), repair: [repair.pair, repair.replaces, repair.exhibit.series, repair.exhibit.select, repair.kept],
  typedKeys: ['unit', 'categories', 'basis'].filter((key) => key in repair.exhibit),
  caption: repair.exhibit.caption, differentUnits: codes(units), indexAsked: codes({ ...units, settles: { ...units.settles, relation: { kind: 'index' } } }),
  none: relationRepair(units, log), kinds: Object.keys(RELATION_KINDS),
  // Panels that drew part of the window keep it: the merged exhibit selects the periods they plotted.
  window: relationRepair(page({ relation: { kind: 'gap' } }, [{ ...panel('Cash', 'cash', [43, 50, 55]), categories: FY.slice(3) }, { ...panel('Debt', 'debt', [68, 58, 56]), categories: FY.slice(3) }]), log).exhibit.select,
  // A panel whose series is no measure's own values (a typed rounding the gate would refuse) cannot be named by reference: the merge stays typed.
  typed: Object.keys(relationRepair(page({ relation: { kind: 'gap' } }, [panel('Cash', 'cash', [15, 21, 37, 43, 50, 99]), panel('Debt', 'debt', [108, 96, 82, 68, 58, 56])]), log).exhibit).filter((key) => ['unit', 'categories', 'basis'].includes(key)) }));
''')
        self.assertEqual(result["undeclared"], ["RELATION_UNDECLARED"])
        self.assertEqual(result["split"], ["RELATION_SPLIT"])
        self.assertEqual(result["unreasoned"], ["RELATION_SPLIT"])
        self.assertEqual(result["separate"], [])  # read separately, with the reason a reviewer judges
        self.assertEqual(result["unknown"], ["RELATION_UNDECLARED"])
        self.assertEqual(result["merged"], [])  # both on one scale: the gap is on the page
        # The merged exhibit names its measures; the runtime writes the unit, the axis and every number the panels drew.
        self.assertEqual(result["repair"], [["i-bal/cash", "i-bal/debt"], [0, 1], [{"measure": "i-bal/cash", "name": "Cash"}, {"measure": "i-bal/debt", "name": "Debt"}],
                                            None, {"numbers": True, "categories": True}])
        self.assertEqual(result["typedKeys"], [])
        self.assertEqual(result["window"], {"periods": ["FY24", "FY25", "FY26"]})
        self.assertEqual(result["typed"], ["unit", "categories", "basis"])
        self.assertEqual(result["caption"], "Cash at each year end. Debt at each year end.")  # nothing the page said is dropped
        # Different units are not compared by default; an index is asked for by name.
        self.assertEqual(result["differentUnits"], [])
        self.assertEqual(result["indexAsked"], ["RELATION_SPLIT"])
        self.assertIsNone(result["none"])
        self.assertEqual(result["kinds"], ["gap", "ratio", "levels", "index", "separate"])


if __name__ == "__main__":
    unittest.main()
