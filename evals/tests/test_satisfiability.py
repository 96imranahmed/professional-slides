"""Every form in the catalogue can be written, and every repair it prints is true.

A run met eight forms with no worked page (logo-table, fact-grid, stat-list,
timeline, roadmap, dumbbell, treemap, waffle) and wrote each by trial against
the compiler. Writing the missing pages found worse: three forms no page could
satisfy at all - a bullet ranking (the type asks for a mark the chart refuses
to draw), a decision tree (the renderer takes two branches, the type asked for
three parts) and a rank flow (its `entities` were not counted as parts).

So the catalogue is enumerated here and each form is held to a worked page
that stands on its own: printed by `--example <type>/<form>`, it compiles,
composes and passes the scene's page gates, the scene's design checks and its
own text plan as the only page of a deck, under the current rules. The check
runs with no insight log and no render: a worked page declares no measures,
so the evidence contract (gates/dependency_gates.mjs) and the render's gates
are not part of what it shows. A form added without such a page, or a gate
changed so that a form's page can no longer pass, fails here rather than in
an author's run.
A scaffold filled with its example's content compiles, and where a refusal
says what is allowed, the code allows it.
"""
from __future__ import annotations

import json
import subprocess
import unittest

from node_probe import NODE, ROOT, run_node

RUNTIME = ROOT / "skills" / "professional-slides" / "runtime"

STANDALONE = '''
import { compileDeck, composeForAuthoring, sceneGateFindings, scaffoldPage, workedExamples } from './skills/professional-slides/runtime/author-deck.mjs';
import { PAGE_TYPES, compilePage } from './skills/professional-slides/runtime/page-types.mjs';
import { sceneDesignFindings } from './skills/professional-slides/runtime/validate-overlap.mjs';
import { deriveContent } from './skills/professional-slides/runtime/derive-content.mjs';
import { runContentGates } from './skills/professional-slides/runtime/gates/content_gates.mjs';
const dir = './skills/professional-slides/examples';
const examples = workedExamples();
const catalogue = Object.entries(PAGE_TYPES).flatMap(([type, t]) => Object.keys(t.forms).map((form) => `${type}/${form}`));
// The page as the only page of a new deck, held to the current rules: what
// refuses it at compile, at composition, in the page gates (the findings that
// name a page), in the scene's design checks and in its own text plan.
async function standalone(page) {
  const problems = [];
  const { spec, compileErrors } = compileDeck({ deck: { ...examples.deck, workflow: undefined, rulesVersion: undefined }, pages: [page] }, { partial: true });
  if (compileErrors.length) return compileErrors.map((message) => `COMPILE ${message}`);
  const composed = await composeForAuthoring(spec, dir);
  if (composed.error || composed.pageErrors.length) return [`COMPOSE ${composed.error ?? composed.pageErrors.join('; ')}`];
  const gates = sceneGateFindings(composed.deck, undefined, spec);
  if (!gates.ran) return [`the page gates did not run: ${gates.reason}`];
  problems.push(...gates.findings.filter((f) => f.slide).map((f) => `${f.code} ${JSON.stringify(f.measured)}`));
  problems.push(...sceneDesignFindings(composed.deck).filter((f) => f.severity === 'blocker').map((f) => `${f.code} ${String(f.repair ?? '').slice(0, 120)}`));
  const content = runContentGates(deriveContent(spec, composed.deck), { required: true, deck: spec });
  problems.push(...content.findings.filter((f) => f.page && ['blocking', 'blocker'].includes(f.severity)).map((f) => `${f.code} ${String(f.repair ?? '').slice(0, 120)}`));
  return problems;
}
'''


def author(*args):
    return subprocess.run([NODE, str(RUNTIME / "author-deck.mjs"), *args], capture_output=True, text=True, cwd=ROOT, timeout=180)


class SatisfiabilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = run_node(STANDALONE + '''
const worked = new Map();
for (const page of examples.pages.filter((p) => p.type)) { const key = `${page.type}/${page.form}`; if (!worked.has(key)) worked.set(key, page); }
const out = {};
for (const key of catalogue) out[key] = worked.has(key) ? { id: worked.get(key).id, problems: await standalone(worked.get(key)) } : null;
// Every worked page, not only the first of its form, stands on its own.
const others = {};
for (const page of examples.pages.filter((p) => p.type && worked.get(`${p.type}/${p.form}`) !== p)) others[page.id] = await standalone(page);
console.log(JSON.stringify({ catalogue, out, others }));
''')

    def test_the_catalogue_is_the_one_the_types_command_prints(self):
        printed = author("--types").stdout
        forms = self.result["catalogue"]
        self.assertGreaterEqual(len(forms), 94)
        for key in forms:
            kind, form = key.split("/")
            self.assertIn(f"## {kind}", printed)
            self.assertRegex(printed, rf"(?m)^- form: .*\b{form}\b")

    def test_every_form_has_a_worked_page(self):
        missing = [key for key, page in self.result["out"].items() if page is None]
        self.assertEqual(missing, [], "forms with no worked page for `--example <type>/<form>`: " + ", ".join(missing))

    def test_every_worked_page_passes_on_its_own(self):
        failing = {key: page["problems"] for key, page in self.result["out"].items() if page and page["problems"]}
        self.assertEqual(failing, {}, "worked pages that do not pass as the only page of a deck:\n" + "\n".join(
            f"  {key} ({self.result['out'][key]['id']}): {'; '.join(problems)}" for key, problems in failing.items()))
        self.assertEqual({page: problems for page, problems in self.result["others"].items() if problems}, {})

    def test_the_example_command_reaches_every_form(self):
        # One call for a type prints all its forms; a form is asked for by name.
        for kind in sorted({key.split("/")[0] for key in self.result["catalogue"]}):
            with self.subTest(type=kind):
                pages = json.loads(author("--example", kind).stdout)
                forms = {page["form"] for page in pages}
                self.assertEqual(forms, {key.split("/")[1] for key in self.result["catalogue"] if key.startswith(kind + "/")})
        for key in ("profiles/logo-table", "numbers/fact-grid", "numbers/stat-list", "schedule/timeline", "schedule/roadmap", "ranking/dumbbell", "composition/treemap", "composition/waffle"):
            with self.subTest(form=key):
                result = author("--example", key)
                self.assertEqual(result.returncode, 0, result.stderr)
                [page] = json.loads(result.stdout)
                self.assertEqual(f'{page["type"]}/{page["form"]}', key)

    def test_the_worked_pages_are_about_the_fictional_operator(self):
        examples = json.loads((ROOT / "skills/professional-slides/examples/page-forms.pages.json").read_text(encoding="utf-8"))
        self.assertIn("Northvale", examples["deck"]["answer"])
        ids = [page["id"] for page in examples["pages"]]
        self.assertEqual(len(ids), len(set(ids)))
        # Every source line names its source: a folder path is nothing a reader can look up (source-cites-pointer read one so).
        self.assertTrue(all("illustrative" in page["source"].lower() for page in examples["pages"]))


class ScaffoldTests(unittest.TestCase):
    def test_a_scaffold_filled_with_its_examples_content_compiles(self):
        # The scaffold's prompts - the title, the reason, what settles it, what
        # the commentary adds, the source - are the only things an author has
        # to write; with the example's own in their place, the page compiles.
        result = run_node(STANDALONE + '''
const PROMPTS = ['title', 'why', 'settles', 'adds', 'source', 'subtitle'];
const out = {};
for (const type of Object.keys(PAGE_TYPES)) {
  const scaffold = scaffoldPage(type, { id: 'x' }), example = examples.pages.find((p) => p.type === type);
  const prompts = Object.entries(scaffold).filter(([, value]) => typeof value === 'string' && /^\\(.*\\)$/.test(value)).map(([key]) => key)
    .concat(scaffold.settles && /^\\(.*\\)$/.test(scaffold.settles.what) ? ['settles'] : []);
  const filled = { ...scaffold };
  for (const key of PROMPTS) if (example[key] !== undefined) filled[key] = example[key];
  let error = null;
  try { compilePage(filled, 0); } catch (e) { error = e.message; }
  let bare = null;
  try { compilePage(scaffold, 0); } catch (e) { bare = e.message; }
  out[type] = { error, bare, prompts: [...new Set(prompts)], sameData: JSON.stringify(scaffold.exhibit ?? scaffold.exhibits ?? null) === JSON.stringify(example.exhibit ?? example.exhibits ?? null) };
}
console.log(JSON.stringify({ out }));
''')["out"]
        self.assertEqual(len(result), 20)
        for kind, page in result.items():
            with self.subTest(type=kind):
                self.assertIsNone(page["error"], page["error"])
                self.assertIsNone(page["bare"], page["bare"])  # and as printed, before anything is filled in
                self.assertIn("title", page["prompts"])
                self.assertIn("why", page["prompts"])
                self.assertTrue(page["sameData"])


class RepairTextTests(unittest.TestCase):
    """Where a refusal says what is allowed, the code allows it."""

    # A figure the notation does not account for is asked about (heading-states-result); this reader takes every figure it
    # is asked about for a result, except the ones a test names, so what the notation sets aside is what passes unasked.
    PROBE = '''
import { REGISTRY } from './skills/professional-slides/runtime/registry.mjs';
import { judgementSession, withJudgements } from './skills/professional-slides/runtime/judgements.mjs';
const title = REGISTRY.get('chart-title');
const describes = new Set(), asked = [];
const reader = judgementSession({ oracle: (kind, said) => { asked.push(said.text); return describes.has(said.text) ? 'describes' : 'result'; } });
const refusal = (props) => withJudgements(reader, () => { try { title.resolveVariant(props); return null; } catch (error) { return error.message; } });
'''

    def test_an_index_base_in_a_chart_heading_is_allowed_as_the_message_says(self):
        result = run_node(self.PROBE + '''
console.log(JSON.stringify({
  bare: refusal({ heading: 'Passengers carried, 2018 = 100' }), fiscal: refusal({ heading: 'Seats flown, FY19 = 100' }), quarter: refusal({ heading: 'Orders, Q1 2019 = 100' }),
  worded: refusal({ heading: 'Index, 2021 = 100' }), unit: refusal({ heading: 'Passengers carried', unit: '2018 = 100' }),
  result: refusal({ heading: 'Passengers carried, 2018 = 100, up 12%' }), decimal: refusal({ heading: 'Passengers carried, 2018 = 100.5' }),
  thousand: refusal({ heading: 'Revenue 2018 = 1000' }), noPeriod: refusal({ heading: 'Share = 100' }) }));
''')
        for allowed in ("bare", "fiscal", "quarter", "worded", "unit"):
            self.assertIsNone(result[allowed], f"{allowed}: {result[allowed]}")
        # A figure beside the base is still a result, and a number set equal to
        # something that is not a period is not an index base.
        self.assertIn('carries "12%"', result["result"])
        for refused in ("decimal", "thousand", "noPeriod"):
            self.assertIn("must not contain statistics", result[refused])

    def test_a_share_of_a_base_period_is_a_unit_and_a_figure_after_it_is_still_a_result(self):
        result = run_node(self.PROBE + '''
const units = { year: '% of 2019', month: '% of Feb-2020 baseline', quarter: '% vs Q3-2019', share: 'Share of 2019 rent',
  appended: '% of 2019, up 12%', equated: '% of 2019 = 85', decimal: '% of 2019.5' };
describes.add('Share of 2019 rent');
console.log(JSON.stringify(Object.fromEntries(Object.entries(units).map(([key, unit]) => [key, refusal({ heading: 'Weekly office attendance', unit })]))));
''')
        # A percentage of a base period is notation, set aside; a share of a base year in words is read, and described.
        for allowed in ("year", "month", "quarter", "share"):
            self.assertIsNone(result[allowed], f"{allowed}: {result[allowed]}")
        # A year in words ("value of 2019") is a period: only its notation - a colon, a sign, a decimal - makes it a value.
        for refused in ("appended", "equated", "decimal"):
            self.assertIn("must not contain statistics", result[refused])

    def test_every_example_the_message_lists_as_allowed_is_allowed(self):
        # The refusal ends: a heading may name a period ("FY26", "2 August 2026"), a sample ("n = 240"), a set or a threshold
        # that defines the measure ("top 40", "20 suppliers", "below 60% of median income"), a model by its designation
        # ("X77", "505X"), an index base ("2019 = 100") or a rank scale ("1 = best"). The notation is set aside unasked; a set
        # or a threshold is read, and a reader takes it for what defines the measure.
        result = run_node(self.PROBE + '''
const message = refusal({ heading: 'Revenue up 12%' });
const listed = [...message.slice(message.indexOf('may name')).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const scale = (text) => (/^1 = /.test(text) ? `rank, ${text}` : text);
const read = ['top 40', '20 suppliers', 'below 60% of median income'];
for (const text of read) { describes.add(`Operators by size, ${text}`); describes.add(text); }
asked.length = 0;
const headings = listed.map((text) => refusal({ heading: `Operators by size, ${scale(text)}` })), units = listed.map((text) => refusal({ heading: 'Operators by size', unit: scale(text) }));
console.log(JSON.stringify({ listed, headings, units, asked: [...new Set(asked)] }));
''')
        self.assertEqual(result["listed"], ["FY26", "2 August 2026", "n = 240", "top 40", "20 suppliers", "below 60% of median income", "X77", "505X", "2019 = 100", "1 = best"])
        self.assertEqual(result["headings"], [None] * 10)
        self.assertEqual(result["units"], [None] * 10)
        self.assertEqual(sorted(result["asked"]), sorted(["Operators by size, top 40", "Operators by size, 20 suppliers", "Operators by size, below 60% of median income",
                                                          "top 40", "20 suppliers", "below 60% of median income"]))

    def test_a_form_the_catalogue_offers_is_not_refused_by_its_own_type(self):
        # The three forms no page could satisfy, each compiled at its least.
        result = run_node(STANDALONE + '''
const base = { takeaway: false, why: 'The page type fits the claim it is asked to carry', title: 'Five of eight measures missed target in the year' };
const error = (page) => { try { compilePage(page, 0); return null; } catch (e) { return e.message; } };
const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
console.log(JSON.stringify({
  bullet: error({ ...base, id: 'b', type: 'ranking', form: 'bullet', commentary: 'so-what-bar', bar: 'The two widest misses share one cause, the oldest units in service.', settles: { kind: 'comparison', what: 'eight measures against target' },
    exhibit: { heading: 'Measures', unit: '% of target', categories: names, series: [{ name: 'Actual', values: [86, 91, 97, 88, 93, 102, 104, 99] }], targets: names.map(() => 100), ranges: names.map(() => [80, 95, 110]) } }),
  unmarked: error({ ...base, id: 'u', type: 'ranking', form: 'bullet', commentary: 'so-what-bar', bar: 'The two widest misses share one cause, the oldest units in service.', settles: { kind: 'comparison', what: 'eight measures against target' },
    exhibit: { heading: 'Measures', unit: '% of target', categories: names, series: [{ name: 'Actual', values: [86, 91, 97, 88, 93, 102, 104, 99] }] } }),
  // `targets` is a bullet chart's mark and no other chart's: a bar, a lollipop or a column ignores the key and stays bare.
  targetsElsewhere: Object.fromEntries(['bar', 'lollipop', 'column'].map((form) => [form, error({ ...base, id: 'o', type: 'ranking', form, commentary: 'so-what-bar', bar: 'The two widest misses share one cause, the oldest units in service.', settles: { kind: 'comparison', what: 'eight measures against target' },
    exhibit: { heading: 'Measures', unit: '% of target', categories: names, series: [{ name: 'Actual', values: [86, 91, 97, 88, 93, 102, 104, 99] }], targets: names.map(() => 100) } })])),
  tree: error({ ...base, id: 't', type: 'mechanism', form: 'tree', commentary: 'none', settles: { kind: 'structure', what: 'how the question divides' },
    exhibit: { root: 'Can it grow?', branches: [{ id: 'a', label: 'Capacity', conclusions: [{ id: 'a1', text: 'Peak is full' }, { id: 'a2', text: 'Off-peak is empty' }] }, { id: 'b', label: 'Demand', conclusions: [{ id: 'b1', text: 'Frequency wins trips' }, { id: 'b2', text: 'Fares do not' }] }], conclusion: 'Yes, off-peak' } }),
  thinTree: error({ ...base, id: 't', type: 'mechanism', form: 'tree', commentary: 'none', settles: { kind: 'structure', what: 'how the question divides' },
    exhibit: { root: 'Can it grow?', branches: [{ id: 'a', label: 'Capacity', conclusions: [{ id: 'a1', text: 'Peak is full' }] }, { id: 'b', label: 'Demand', conclusions: [{ id: 'b1', text: 'Frequency wins trips' }] }], conclusion: 'Yes' } }),
  rankFlow: error({ ...base, id: 'r', type: 'mechanism', form: 'rank-flow', commentary: 'none', settles: { kind: 'rank', what: 'rank of three lines over three years' },
    exhibit: { periods: ['FY24', 'FY25', 'FY26'], entities: [{ name: 'Valley', ranks: [3, 2, 1] }, { name: 'Dales', ranks: [1, 1, 2] }, { name: 'Coast', ranks: [2, 3, 3] }] } }) }));
''')
        self.assertIsNone(result["bullet"], result["bullet"])
        self.assertIn("marks its finding", result["unmarked"])  # without its targets a bullet chart marks nothing
        for form, refusal in result["targetsElsewhere"].items():
            self.assertIn("marks its finding", refusal or "", form)
        self.assertIsNone(result["tree"], result["tree"])
        self.assertIn("three or more parts", result["thinTree"])
        self.assertIsNone(result["rankFlow"], result["rankFlow"])


if __name__ == "__main__":
    unittest.main()
