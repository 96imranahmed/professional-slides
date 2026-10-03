"""The evidence contract: measures, computed analyses, and what each page rests on.

A fifty-page evaluation deck carried a fleet-age chart on a page titled on
cash flow. A repair for variety had copied the chart from another page,
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
    measures: { profit: { unit: 'GBP m', population: 'four carriers', period: 'latest year', members: ['Alpha', 'Beta', 'Gamma'], values: [20, 3, null],
                          unavailable: { Gamma: 'reports in another currency at group level' }, boundaries: { Beta: 'calendar year' } },
                margin: { unit: '%', population: 'four carriers', period: 'latest year', members: ['Alpha', 'Beta', 'Delta'], values: [15, 8, 21] } } },
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
  { id: 'A-absent', op: 'gap', inputs: ['i-bal/cash', 'i-fleet/retirements'], missing: ['retirement schedule by year: not in the records'] },
  { id: 'A-peers', op: 'compare', inputs: ['i-peers/profit', 'i-peers/margin'] },
  { id: 'A-growth', op: 'growth', inputs: ['i-bal/cash'] },
]), insights, { alternatives: ['Alpha', 'Beta', 'Epsilon'] });
const by = Object.fromEntries(results.map((r) => [r.id, r]));
const derived = Object.fromEntries(analysisInsights(results).map((i) => [i.id, i]));
console.log(JSON.stringify({ problems, status: Object.fromEntries(results.map((r) => [r.id, r.status])),
  net: by['A-net'].measures.result.values, floor: [by['A-floor'].measures.headroom.value, by['A-floor'].assumptions.length],
  path: [by['A-path'].measures.path.values, by['A-path'].crossesAt, by['A-path'].assumptions.map((a) => a.name)],
  mixed: by['A-mixed'].reason, absent: [by['A-absent'].missing, 'A-absent' in derived],
  index: by['A-index'].measures.cash.values.at(-1), growth: by['A-growth'].measures.percent.value,
  table: by['A-peers'].table.members, epsilon: by['A-peers'].table.columns.map((c) => c.cells.Epsilon), gamma: by['A-peers'].table.columns[0].cells.Gamma,
  beta: by['A-peers'].table.columns[0].cells.Beta, sensitivity: by['A-peers'].sensitivity, uncovered: by['A-peers'].uncovered,
  shapes: Object.fromEntries(Object.values(derived).map((i) => [i.id, i.shape])), netInputs: derived['A-net'].inputs, netSources: derived['A-net'].sources }));
''')
        self.assertEqual(result["problems"], [])
        self.assertEqual(result["status"], {"A-net": "computed", "A-floor": "assumed", "A-path": "assumed", "A-mixed": "unavailable", "A-index": "computed",
                                            "A-absent": "unavailable", "A-peers": "computed", "A-growth": "computed"})
        self.assertEqual(result["net"], [93, 75, 45, 25, 8, 1])  # debt less cash, period by period: no derived number is typed
        self.assertEqual(result["floor"], [19, 1])  # a threshold nobody recorded is an assumption, listed as one
        self.assertEqual(result["path"], [[55, 43, 31, 19], "FY29", ["annual cash use", "threshold"]])
        self.assertIn("a gap needs one unit", result["mixed"])  # GBP m less people is not a number
        self.assertEqual(result["absent"], [["i-fleet/retirements", "retirement schedule by year: not in the records"], False])  # an analysis that cannot run carries no page
        self.assertEqual(round(result["index"], 1), 366.7)
        self.assertEqual(round(result["growth"], 1), 266.7)
        # Every alternative takes its row, with n/a kept and the boundary carried.
        self.assertEqual(result["table"], ["Alpha", "Beta", "Epsilon", "Gamma", "Delta"])
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

    def test_the_cli_writes_the_results_beside_the_pages_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            for name in ("finance.pages.json", "finance.insights.json", "finance.analysis.json"):
                (Path(tmp) / name).write_text((FIXTURES / name).read_text(encoding="utf-8"), encoding="utf-8")
            run = subprocess.run([NODE, str(ROOT / "skills/professional-slides/runtime/analysis.mjs"), str(Path(tmp) / "finance.pages.json")], capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            written = json.loads((Path(tmp) / "finance.analysis-results.json").read_text(encoding="utf-8"))
            self.assertEqual([r["id"] for r in written["results"]], ["A-ocf", "A-earn", "A-cushion", "A-peers", "A-floor"])
            self.assertEqual(json.loads(run.stdout)["assumed"], 1)
            (Path(tmp) / "finance.analysis.json").unlink()
            bare = subprocess.run([NODE, str(ROOT / "skills/professional-slides/runtime/analysis.mjs"), str(Path(tmp) / "finance.pages.json")], capture_output=True, text=True)
            self.assertEqual(bare.returncode, 2)
            self.assertIn("compare", bare.stderr)  # it says what can be run


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
stage('finance');
const derived = await readInsights(dir, 'finance', {{ alternatives: alternativesOf(finance.deck) }});
console.log(JSON.stringify({{ clean: await spine('finance'), noAnalysis: await spine('finance', {{ analysis: false }}), prose: prose.map((f) => [f.code, f.pages?.length ?? 0]),
  proseRepair: prose[0].repair, older: older.filter((f) => f.code === 'ANALYSIS_REQUIRED').map((f) => [f.severity, f.waived]),
  explainer: await spine('explainer'), ops: await spine('public-ops'), derived: [derived.get('A-peers').shape, derived.get('A-peers').derived, derived.analysis.results.length] }}));
fs.rmSync(dir, {{ recursive: true, force: true }});
''')
        self.assertEqual(result["clean"], [])
        # Eight declared players and no computed comparison: refused before the outline.
        self.assertEqual(result["noAnalysis"], [["ANALYSIS_REQUIRED", "blocker"]])
        self.assertEqual(result["prose"], [["MEASURES_MISSING", 6]])
        self.assertIn("as data", result["proseRepair"])
        self.assertEqual(result["older"], [["advisory", {"rulesVersion": 3, "introducedIn": 4}]])
        # A deck that compares nothing is not asked for a matrix, and one service with no players is not either.
        self.assertEqual(result["explainer"], [])
        self.assertEqual(result["ops"], [])
        self.assertEqual(result["derived"], ["roster", True, 5])


class DependencyTests(unittest.TestCase):
    def test_seeded_defects_are_caught_on_held_out_decks_and_clean_decks_raise_nothing(self):
        result = run_node('''
import { measure, SEEDED } from './evals/quality/evidence-validity.mjs';
const out = await measure();
console.log(JSON.stringify({ accepted: out.accepted, clean: out.clean.map((d) => [d.deck, d.pages, d.findings]), seeded: Object.entries(out.seeded).map(([name, d]) => [name, d.planted, d.caught, d.missed]), defects: Object.keys(SEEDED).length }));
''')
        self.assertEqual([deck for deck, _, _ in result["clean"]], ["explainer", "finance", "product", "public-ops"])
        for deck, pages, findings in result["clean"]:
            self.assertEqual(findings, [], f"{deck} is a clean deck: a finding on it is a false positive")
        self.assertEqual(result["defects"], 14)
        for name, planted, caught, missed in result["seeded"]:
            with self.subTest(defect=name):
                self.assertGreater(planted, 0, "no fixture page takes this defect")
                self.assertEqual(caught, planted, missed)
        self.assertTrue(result["accepted"])

    def test_a_chart_copied_onto_another_claim_is_refused_however_it_is_dressed(self):
        # The benchmark's defect, step by step, on a held-out deck: the copy, then
        # each way an author might try to make the copy pass.
        result = run_node(f'''
import fs from 'node:fs'; import path from 'node:path';
import {{ readInsights }} from './skills/professional-slides/runtime/author-deck.mjs';
import {{ dependencyFindings }} from './skills/professional-slides/runtime/gates/dependency_gates.mjs';
import {{ alternativesOf }} from './skills/professional-slides/runtime/analysis.mjs';
const doc = JSON.parse(fs.readFileSync(path.join('{FIXTURES}', 'finance.pages.json'), 'utf8'));
const insights = await readInsights('{FIXTURES}', 'finance', {{ alternatives: alternativesOf(doc.deck) }});
const codes = (mutate) => {{ const d = structuredClone(doc); mutate(d.pages.find((p) => p.id === 'f2'), d); return dependencyFindings(d, insights).filter((f) => f.id === 'f2').map((f) => f.code); }};
const branches = (d) => structuredClone(d.pages.find((p) => p.id === 'f4').exhibits[1]);
console.log(JSON.stringify({{
  clean: codes(() => {{}}),
  copied: codes((p, d) => {{ p.exhibit = {{ ...branches(d), basis: {{ measures: ['i-efficiency/branches'], role: 'proof' }} }}; p.evidence.push('i-efficiency'); }}),
  relabelled: codes((p, d) => {{ p.exhibit = {{ ...branches(d), basis: {{ measures: ['i-cash/ocf'], role: 'proof' }} }}; }}),
  undeclared: codes((p, d) => {{ p.exhibit = branches(d); delete p.exhibit.basis; p.evidence.push('i-efficiency'); }}),
  asContext: codes((p, d) => {{ p.exhibit = branches(d); p.evidence.push('i-efficiency'); }}),
  contextNoMetrics: codes((p, d) => {{ p.exhibit = branches(d); p.evidence.push('i-efficiency'); for (const m of p.metrics) delete m.basis; }}),
  typedSource: codes((p) => {{ p.source = 'Source: annual report (i-cash)'; }}),
  message: (() => {{ const d = structuredClone(doc); const p = d.pages.find((x) => x.id === 'f2'); p.exhibit = {{ ...branches(d), basis: {{ measures: ['i-efficiency/branches'], role: 'proof' }} }}; p.evidence.push('i-efficiency');
    return dependencyFindings(d, insights).find((f) => f.code === 'PROOF_OFF_CLAIM').repair; }})() }}));
''')
        self.assertEqual(result["clean"], [])
        self.assertEqual(result["copied"], ["PROOF_OFF_CLAIM"])
        self.assertIn("the claim is about i-cash/ocf, i-earn/pat", result["message"])
        self.assertEqual(result["relabelled"], ["BASIS_UNIT", "BASIS_VALUES"])  # branches are not GBP m, nor the cash-flow numbers, whatever the basis says
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
const bare = structuredClone(pageOf(doc, 'f1')); bare.settles = {{ measures: ['i-loans/loans'] }};
const stripped = withoutDependencies(bare);
console.log(JSON.stringify({{ leaked: JSON.stringify(base.slides).includes('"basis"') && !JSON.stringify(base.slides.map((s) => ({{ ...s, pageType: null }}))).includes('"basis"'),
  inSlide: JSON.stringify(base.slides.map((s) => ({{ ...s, pageType: null }}))).includes('"basis"'),
  kept: f4.pageType.dependencies.exhibits.map((b) => b.role), metrics: f2.pageType.dependencies.metrics.length, claim: f2.pageType.content.settles.measures,
  source: [f2.source, f4.source], bound: storyStructure(base).find((p) => p.id === 'f4').exhibits.map((e) => e.basis?.role),
  sameWhenReworded: storylineBinding(spec(reworded)) === storylineBinding(base), changedWhenRebased: storylineBinding(spec(rebased)) !== storylineBinding(base),
  derivedSettles: [stripped.page.settles, stripped.dependencies.claim], versioned: Object.keys(DEPENDENCY_CODES).every((code) => RULES.introduced['4'].includes(code)) }}));
''')
        self.assertFalse(result["inSlide"])  # `basis` is the author's statement, not a prop the composer draws
        self.assertEqual(result["kept"], ["proof", "context"])
        self.assertEqual(result["metrics"], 2)
        self.assertEqual(result["claim"], ["i-cash/ocf", "i-earn/pat"])
        # No page typed a citation: each is written from the insights it plots.
        self.assertEqual(result["source"], ["Source: Harbour Credit Union annual report 2026 (illustrative)"] * 2)
        self.assertEqual(result["bound"], ["proof", "context"])
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
  unknown: codes(page({ relation: { kind: 'vibes' } })), merged: codes(merged), repair: [repair.pair, repair.replaces, repair.exhibit.series.map((s) => s.name), repair.exhibit.unit, repair.kept],
  caption: repair.exhibit.caption, differentUnits: codes(units), indexAsked: codes({ ...units, settles: { ...units.settles, relation: { kind: 'index' } } }),
  none: relationRepair(units, log), kinds: Object.keys(RELATION_KINDS) }));
''')
        self.assertEqual(result["undeclared"], ["RELATION_UNDECLARED"])
        self.assertEqual(result["split"], ["RELATION_SPLIT"])
        self.assertEqual(result["unreasoned"], ["RELATION_SPLIT"])
        self.assertEqual(result["separate"], [])  # read separately, with the reason a reviewer judges
        self.assertEqual(result["unknown"], ["RELATION_UNDECLARED"])
        self.assertEqual(result["merged"], [])  # both on one scale: the gap is on the page
        self.assertEqual(result["repair"], [["i-bal/cash", "i-bal/debt"], [0, 1], ["Cash", "Debt"], "GBP m", {"numbers": True, "categories": True}])
        self.assertEqual(result["caption"], "Cash at each year end Debt at each year end")  # nothing the page said is dropped
        # Different units are not compared by default; an index is asked for by name.
        self.assertEqual(result["differentUnits"], [])
        self.assertEqual(result["indexAsked"], ["RELATION_SPLIT"])
        self.assertIsNone(result["none"])
        self.assertEqual(result["kinds"], ["gap", "ratio", "levels", "index", "separate"])


if __name__ == "__main__":
    unittest.main()
